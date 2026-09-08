import { createPrivateKey } from 'node:crypto';
import nacl from 'tweetnacl';
import { unwrapTenantArchivePrivateKey } from './tenantArchiveKeyService.js';

/**
 * Reads a company's archived messages.
 *
 * This is the only code in Synzapp that can turn a stored message back into
 * text, and it exists for one reason: a company under a legal obligation has to
 * be able to produce its own records. Retention, legal holds and exports all
 * depend on it.
 *
 * **Every read unwraps the company's key through KMS.** Nothing is cached. A
 * cached key would survive a company revoking access, and would sit in memory
 * long after the request that justified it. The cost is a KMS call per read;
 * the benefit is that Google's own logs show every single time a company's
 * archive was opened, outside anything Synzapp controls.
 *
 * **Reading is separated from everything that writes.** The archive is built by
 * the sending apps and never touched here, so a mistake in this file cannot
 * damage the record it is reading.
 */

export interface ArchivedEnvelope {
  ciphertext: string;
  /** Message keys, one per reader, keyed by device id. */
  encryptedKeysByDevice?: Record<string, string>;
  envelopeId: string;
  nonce: string;
  senderKeyAgreementPublicKey?: string;
  senderUid?: string;
  sentAtMs?: number;
}

export interface ArchiveReadResult {
  /** Null when this message cannot be read, with the reason in `unreadableReason`. */
  plaintext: string | null;
  envelopeId: string;
  /**
   * Why a message could not be read.
   *
   * Carried through to the export manifest rather than dropped. An export that
   * quietly omits messages is worse than one that lists what it could not
   * include, because somebody will swear to its completeness.
   */
  unreadableReason: 'NOT_ARCHIVED' | 'NO_ARCHIVE_KEY' | 'DECRYPT_FAILED' | null;
}

/** The device id an archive key is presented under. */
export function isArchiveDeviceId(deviceId: string): boolean {
  return deviceId.startsWith('archive_');
}

/**
 * Reads a batch of archived messages for one company.
 *
 * Batched so the company's key is unwrapped once for the whole read rather than
 * once per message — an export can cover tens of thousands of messages, and a
 * KMS call each would be both slow and a wall of noise in the audit log.
 */
export async function readArchivedEnvelopes(input: {
  envelopes: ArchivedEnvelope[];
  tenantId: string;
}): Promise<ArchiveReadResult[]> {
  if (!input.envelopes.length) {
    return [];
  }

  const privateKeyPem = await unwrapTenantArchivePrivateKey(input.tenantId)
    .catch((error: unknown) => {
      // Reported as NO_ARCHIVE_KEY below either way, but "the key is missing"
      // and "the key exists and KMS refused us" need different fixes and must
      // not look identical in the logs.
      console.error('[SynzappArchiveKey] could not unwrap tenant archive key', {
        message: error instanceof Error ? error.message : String(error),
        tenantId: input.tenantId
      });

      return null;
    });

  if (!privateKeyPem) {
    // No archive key at all. Every message is unreadable, and says so.
    return input.envelopes.map((envelope) => ({
      envelopeId: envelope.envelopeId,
      plaintext: null,
      unreadableReason: 'NO_ARCHIVE_KEY' as const
    }));
  }

  const privateKeyBytes = toRawPrivateKeyBytes(privateKeyPem);

  if (!privateKeyBytes) {
    return input.envelopes.map((envelope) => ({
      envelopeId: envelope.envelopeId,
      plaintext: null,
      unreadableReason: 'NO_ARCHIVE_KEY' as const
    }));
  }

  return input.envelopes.map((envelope) => readOneEnvelope(envelope, privateKeyBytes));
}

function readOneEnvelope(
  envelope: ArchivedEnvelope,
  privateKeyBytes: Uint8Array
): ArchiveReadResult {
  const archiveDeviceId = Object.keys(envelope.encryptedKeysByDevice || {})
    .find(isArchiveDeviceId);

  // Sent before the company had an archive. This cannot be repaired after the
  // fact — the message key was never encrypted to a reader that still exists.
  if (!archiveDeviceId) {
    return {
      envelopeId: envelope.envelopeId,
      plaintext: null,
      unreadableReason: 'NOT_ARCHIVED'
    };
  }

  try {
    const messageKey = unsealMessageKey({
      encryptedKey: envelope.encryptedKeysByDevice?.[archiveDeviceId] || '',
      privateKeyBytes,
      senderPublicKeyBase64: envelope.senderKeyAgreementPublicKey || ''
    });

    if (!messageKey) {
      return {
        envelopeId: envelope.envelopeId,
        plaintext: null,
        unreadableReason: 'DECRYPT_FAILED'
      };
    }

    return {
      envelopeId: envelope.envelopeId,
      plaintext: openSecretBox(envelope.ciphertext, envelope.nonce, messageKey),
      unreadableReason: null
    };
  } catch {
    return {
      envelopeId: envelope.envelopeId,
      plaintext: null,
      unreadableReason: 'DECRYPT_FAILED'
    };
  }
}

/**
 * Recovers the message key that was sealed to the archive.
 *
 * Mirrors exactly what a receiving phone does. The sending app seals the message
 * key with `nacl.box` using the archive's public key and its own private key, so
 * this opens it with `nacl.box.open` using the archive's private key and the
 * sender's public key. Any deviation here silently fails to read real messages,
 * which is why this uses the same library rather than an equivalent.
 */
function unsealMessageKey(input: {
  encryptedKey: string;
  privateKeyBytes: Uint8Array;
  senderPublicKeyBase64: string;
}): Uint8Array | null {
  if (!input.encryptedKey || !input.senderPublicKeyBase64) {
    return null;
  }

  const payload = JSON.parse(input.encryptedKey) as {
    ciphertext?: string;
    nonce?: string;
    version?: number;
  };

  if (payload.version !== 1 || !payload.ciphertext || !payload.nonce) {
    return null;
  }

  return nacl.box.open(
    Buffer.from(payload.ciphertext, 'base64'),
    Buffer.from(payload.nonce, 'base64'),
    Buffer.from(input.senderPublicKeyBase64, 'base64'),
    input.privateKeyBytes
  );
}

/** Opens the message body once its key is recovered. */
function openSecretBox(ciphertext: string, nonce: string, messageKey: Uint8Array): string | null {
  const plaintext = nacl.secretbox.open(
    Buffer.from(ciphertext, 'base64'),
    Buffer.from(nonce, 'base64'),
    messageKey
  );

  return plaintext ? Buffer.from(plaintext).toString('utf8') : null;
}

/**
 * The archive private key as the 32 raw bytes nacl expects.
 *
 * Stored as PEM because that is what Node generates; nacl works in raw bytes.
 * A JWK exposes exactly those bytes as its `d` value.
 */
function toRawPrivateKeyBytes(privateKeyPem: string): Uint8Array | null {
  const jwk = createPrivateKey(privateKeyPem).export({ format: 'jwk' }) as { d?: string };

  return jwk.d ? new Uint8Array(Buffer.from(jwk.d, 'base64url')) : null;
}
