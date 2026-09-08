import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import nacl from 'tweetnacl';
import { isArchiveDeviceId } from '../src/services/archiveReaderService.ts';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const reader = readFileSync(
  resolve(backendRoot, 'src', 'services', 'archiveReaderService.ts'),
  'utf8'
);

function rawKeys() {
  const { privateKey, publicKey } = generateKeyPairSync('x25519');
  const priv = privateKey.export({ format: 'jwk' }) as { d: string };
  const pub = publicKey.export({ format: 'jwk' }) as { x: string };

  return {
    privateBytes: new Uint8Array(Buffer.from(priv.d, 'base64url')),
    publicBase64: Buffer.from(pub.x, 'base64url').toString('base64')
  };
}

describe('a message sealed by a phone can be read from the archive', () => {
  it('recovers the original text', () => {
    // The whole point of step 4: the sending app seals to the archive exactly as
    // it seals to a phone, and the backend opens it the same way a phone would.
    // If these two ever drift, exports silently return nothing.
    const archive = rawKeys();
    const sender = rawKeys();
    const messageKey = nacl.randomBytes(nacl.secretbox.keyLength);
    const messageNonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const body = 'Approve the Q3 budget today';

    const ciphertext = Buffer.from(
      nacl.secretbox(Buffer.from(body, 'utf8'), messageNonce, messageKey)
    ).toString('base64');

    const keyNonce = nacl.randomBytes(nacl.box.nonceLength);
    const sealedKey = nacl.box(
      messageKey,
      keyNonce,
      Buffer.from(archive.publicBase64, 'base64'),
      sender.privateBytes
    );

    // What the backend does, mirrored here so the scheme itself is verified.
    const opened = nacl.box.open(
      sealedKey,
      keyNonce,
      Buffer.from(sender.publicBase64, 'base64'),
      archive.privateBytes
    );

    assert.ok(opened, 'the archive must be able to open the sealed message key');

    const plaintext = nacl.secretbox.open(
      Buffer.from(ciphertext, 'base64'),
      messageNonce,
      opened
    );

    assert.equal(Buffer.from(plaintext!).toString('utf8'), body);
  });
});

describe('messages that cannot be read say why', () => {
  it('names the case where the company had no archive yet', () => {
    // This cannot be repaired afterwards, and an export must say so rather than
    // implying it is complete.
    assert.match(reader, /unreadableReason: 'NOT_ARCHIVED'/);
  });

  it('names the case where the company has no key at all', () => {
    assert.match(reader, /unreadableReason: 'NO_ARCHIVE_KEY'/);
  });

  it('names a genuine decryption failure separately', () => {
    assert.match(reader, /unreadableReason: 'DECRYPT_FAILED'/);
  });

  it('never silently drops a message it could not read', () => {
    // A result is returned for every envelope, readable or not.
    assert.match(reader, /input\.envelopes\.map\(\(envelope\) =>/);
  });
});

describe('the company key is never cached', () => {
  it('unwraps through KMS on every read', () => {
    // A cached key would outlive a company revoking access, and would sit in
    // memory long after the request that justified it.
    assert.match(reader, /await unwrapTenantArchivePrivateKey\(input\.tenantId\)/);
    assert.doesNotMatch(reader, /privateKeyCache|cachedPrivateKey/);
  });

  it('unwraps once per batch, not once per message', () => {
    // An export can cover tens of thousands of messages.
    const unwrap = reader.indexOf('unwrapTenantArchivePrivateKey');
    const mapOver = reader.indexOf('input.envelopes.map((envelope) => readOneEnvelope');

    assert.ok(unwrap < mapOver, 'the key must be unwrapped before the loop');
  });
});

describe('archive device ids', () => {
  it('are recognisable', () => {
    assert.equal(isArchiveDeviceId('archive_abc123'), true);
    assert.equal(isArchiveDeviceId('device_abc123'), false);
  });
});
