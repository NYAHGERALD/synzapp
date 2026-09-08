import { createHash, createPublicKey, generateKeyPairSync, randomBytes } from 'node:crypto';
import { KeyManagementServiceClient } from '@google-cloud/kms';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';

/**
 * The key pair that lets a company read its own message archive.
 *
 * Synzapp encrypts every message separately to each device allowed to read it.
 * The compliance archive becomes one more such reader: sending apps are handed
 * this public key alongside the recipient devices and encrypt to it exactly as
 * they would to a phone. Nothing about the message format changes.
 *
 * **The private half is never stored in the database.** It is wrapped by Google
 * Cloud KMS first, so the database holds only an encrypted blob. Reading a
 * company's messages then needs database access *and* permission to use the KMS
 * key, and every use of that key is logged by Google outside our own logs.
 *
 * This is also what makes destruction real. Destroying the KMS key makes every
 * copy of that company's archive unreadable at once — including in backups and
 * replicas we could never chase down individually.
 *
 * **A company without a key pair keeps working exactly as before.** The key is
 * created on demand, and messages sent before it existed stay unreadable to the
 * archive. That cannot be retrofitted, and an export covering that period has to
 * say so rather than implying it is complete.
 */

const KMS_LOCATION = process.env.SYNZAPP_KMS_LOCATION?.trim() || 'us-central1';
const KMS_KEYRING = process.env.SYNZAPP_KMS_KEYRING?.trim() || 'synzapp-compliance';
const KMS_KEY = process.env.SYNZAPP_KMS_KEY?.trim() || 'tenant-archive-wrap';

export interface TenantArchiveKeyRecord {
  createdAtMs: number;
  /** Identifies which key a message was encrypted to, so rotation stays possible. */
  keyId: string;
  publicKeyPem: string;
  /** The private key, encrypted by KMS. Never usable on its own. */
  wrappedPrivateKey: string;
  wrappingKeyName: string;
}

export interface TenantArchivePublicKey {
  /**
   * The raw public key, base64, in the same shape a device uses.
   *
   * Exposed this way so a sending app can treat the archive as one more
   * recipient device rather than needing a second code path for it.
   */
  keyAgreementPublicKey: string;
  keyId: string;
  publicKeyPem: string;
}

/**
 * Converts a PEM public key to the raw base64 form devices use.
 *
 * X25519 public keys are 32 bytes. A JWK exposes exactly those bytes as its `x`
 * value, base64url encoded, so this converts rather than parsing DER by hand.
 */
export function toRawPublicKeyBase64(publicKeyPem: string): string {
  const jwk = createPublicKey(publicKeyPem).export({ format: 'jwk' }) as { x?: string };

  if (!jwk.x) {
    throw new Error('The archive public key could not be read.');
  }

  return Buffer.from(jwk.x, 'base64url').toString('base64');
}

let kmsClient: KeyManagementServiceClient | null = null;

function getKmsClient(): KeyManagementServiceClient {
  if (!kmsClient) {
    kmsClient = new KeyManagementServiceClient();
  }

  return kmsClient;
}

function getWrappingKeyName(): string {
  // FIREBASE_PROJECT_ID is included because Cloud Run does not set
  // GOOGLE_CLOUD_PROJECT. Without it the project id came out empty, the key
  // name became "projects//locations/..." and every wrap failed — silently,
  // because the callers swallowed the error. The visible effect was an
  // organization that appeared to have no compliance archive at all.
  const projectId = process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.GCLOUD_PROJECT?.trim() ||
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    '';

  if (!projectId) {
    throw new Error(
      'No Google Cloud project is configured, so the compliance archive key cannot be protected.'
    );
  }

  return `projects/${projectId}/locations/${KMS_LOCATION}/keyRings/${KMS_KEYRING}/cryptoKeys/${KMS_KEY}`;
}

function archiveKeyRef(tenantId: string) {
  return firestore
    .collection('tenants')
    .doc(tenantId)
    .collection('archiveKeys')
    .doc('current');
}

/**
 * The company's archive public key, creating one the first time it is asked for.
 *
 * Returns null when key management is unavailable rather than throwing. A
 * company must keep being able to send messages even if the archive cannot be
 * set up — losing messaging to protect a compliance feature is the wrong trade.
 */
export async function getTenantArchivePublicKey(
  tenantId: string
): Promise<TenantArchivePublicKey | null> {
  const existing = await archiveKeyRef(tenantId).get().catch(() => null);

  if (existing?.exists) {
    const record = existing.data() as TenantArchiveKeyRecord;

    return {
      keyAgreementPublicKey: toRawPublicKeyBase64(record.publicKeyPem),
      keyId: record.keyId,
      publicKeyPem: record.publicKeyPem
    };
  }

  return createTenantArchiveKey(tenantId).catch((error: unknown) => {
    // Never rethrown: a failure here must not stop someone sending a message.
    // But it must not be invisible either — this failing means the
    // organization silently accumulates messages it can never produce, and the
    // only prior symptom was an empty compliance search months later.
    console.error('[SynzappArchiveKey] could not create tenant archive key', {
      message: error instanceof Error ? error.message : String(error),
      tenantId
    });

    return null;
  });
}

/**
 * Creates a company's archive key pair.
 *
 * X25519 because that is what the rest of Synzapp's message encryption uses, so
 * a sending app can treat this as one more device without a second code path.
 */
const WRAP_ATTEMPTS = 3;
const WRAP_RETRY_DELAY_MS = 250;

async function wrapWithRetry(wrappingKeyName: string, privateKeyPem: string) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= WRAP_ATTEMPTS; attempt += 1) {
    try {
      return await getKmsClient().encrypt({
        name: wrappingKeyName,
        plaintext: Buffer.from(privateKeyPem, 'utf8')
      });
    } catch (error) {
      lastError = error;

      if (attempt < WRAP_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, WRAP_RETRY_DELAY_MS * attempt));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('The archive key could not be protected.');
}

export async function createTenantArchiveKey(
  tenantId: string
): Promise<TenantArchivePublicKey> {
  const { privateKey, publicKey } = generateKeyPairSync('x25519');
  const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
  const wrappingKeyName = getWrappingKeyName();

  // Retried because a momentary KMS failure here is not a momentary problem:
  // the message being sent right now would be sealed with no archive copy and
  // could never be produced for a legal request afterwards.
  const [wrapped] = await wrapWithRetry(wrappingKeyName, privateKeyPem);

  if (!wrapped.ciphertext) {
    throw new Error('The archive key could not be protected.');
  }

  const record: TenantArchiveKeyRecord = {
    createdAtMs: Date.now(),
    // Derived from the public key, so it is stable and reveals nothing secret.
    keyId: createHash('sha256').update(publicKeyPem).digest('hex').slice(0, 32),
    publicKeyPem,
    wrappedPrivateKey: Buffer.from(wrapped.ciphertext).toString('base64'),
    wrappingKeyName
  };

  // `create` rather than `set`: two people sending their first message at the
  // same moment would both find no key and both write one, and the loser's
  // messages would be sealed to a key that no longer exists — unreadable
  // forever, with nothing to show anything went wrong. Whoever loses the race
  // adopts the winner's key instead.
  try {
    await archiveKeyRef(tenantId).create({
      ...record,
      createdAt: fieldValue.serverTimestamp()
    });
  } catch {
    const winner = await archiveKeyRef(tenantId).get();

    if (winner.exists) {
      const existing = winner.data() as TenantArchiveKeyRecord;

      return {
        keyAgreementPublicKey: toRawPublicKeyBase64(existing.publicKeyPem),
        keyId: existing.keyId,
        publicKeyPem: existing.publicKeyPem
      };
    }

    throw new Error('The archive key could not be stored.');
  }

  return {
    keyAgreementPublicKey: toRawPublicKeyBase64(record.publicKeyPem),
    keyId: record.keyId,
    publicKeyPem: record.publicKeyPem
  };
}

/**
 * Unwraps a company's archive private key.
 *
 * Deliberately separate from everything else, and called by nothing yet. Reading
 * a company's messages is the most sensitive operation in the product, and the
 * archive is built up before anything is able to read it — so a mistake in the
 * building does not also expose the reading.
 */
export async function unwrapTenantArchivePrivateKey(
  tenantId: string
): Promise<string | null> {
  const snapshot = await archiveKeyRef(tenantId).get().catch(() => null);

  if (!snapshot?.exists) {
    return null;
  }

  const record = snapshot.data() as TenantArchiveKeyRecord;
  const [unwrapped] = await getKmsClient().decrypt({
    ciphertext: Buffer.from(record.wrappedPrivateKey, 'base64'),
    name: record.wrappingKeyName
  });

  return unwrapped.plaintext ? Buffer.from(unwrapped.plaintext).toString('utf8') : null;
}

/** A random id for tests and callers that need one without touching KMS. */
export function buildArchiveKeyId(publicKeyPem: string): string {
  return createHash('sha256').update(publicKeyPem || randomBytes(16).toString('hex'))
    .digest('hex')
    .slice(0, 32);
}

export interface TenantArchiveKeyStatus {
  createdAtMs: number | null;
  exists: boolean;
  keyId: string | null;
  /** Present when a key could not be created, so the console can show why. */
  problem: string | null;
}

/**
 * Whether a company has a compliance archive key, without creating one.
 *
 * Separate from `getTenantArchivePublicKey`, which creates on demand. A status
 * screen that quietly created the thing it was reporting on would make the
 * problem it exists to reveal impossible to see.
 */
export async function getTenantArchiveKeyStatus(
  tenantId: string
): Promise<TenantArchiveKeyStatus> {
  const existing = await archiveKeyRef(tenantId).get().catch(() => null);

  if (existing?.exists) {
    const record = existing.data() as TenantArchiveKeyRecord;

    return {
      createdAtMs: record.createdAtMs || null,
      exists: true,
      keyId: record.keyId || null,
      problem: null
    };
  }

  // No key. Report whether one *could* be made, because "nobody has sent a
  // message yet" and "the key store is misconfigured" look identical on screen
  // and need completely different responses.
  try {
    getWrappingKeyName();

    return { createdAtMs: null, exists: false, keyId: null, problem: null };
  } catch (error) {
    return {
      createdAtMs: null,
      exists: false,
      keyId: null,
      problem: error instanceof Error ? error.message : 'The archive key cannot be protected.'
    };
  }
}
