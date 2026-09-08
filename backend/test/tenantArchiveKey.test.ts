import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildArchiveKeyId } from '../src/services/tenantArchiveKeyService.ts';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const archiveKeys = readFileSync(
  resolve(backendRoot, 'src', 'services', 'tenantArchiveKeyService.ts'),
  'utf8'
);

describe('the private key is never stored in the database', () => {
  it('wraps it with KMS before storing', () => {
    // Stored plainly, anyone with database access could read every message that
    // company has ever sent.
    assert.match(archiveKeys, /await getKmsClient\(\)\.encrypt\(/);
    assert.match(archiveKeys, /wrappedPrivateKey: Buffer\.from\(wrapped\.ciphertext\)/);
  });

  it('never writes the unwrapped key', () => {
    assert.doesNotMatch(archiveKeys, /privateKeyPem,\s*\n\s*publicKeyPem/);
    assert.doesNotMatch(archiveKeys, /set\(\{[^}]*privateKeyPem/);
  });

  it('refuses to continue if wrapping produced nothing', () => {
    assert.match(archiveKeys, /if \(!wrapped\.ciphertext\)/);
  });

  it('records which KMS key wrapped it', () => {
    // Needed to unwrap later, and to know which key destroys this archive.
    assert.match(archiveKeys, /wrappingKeyName/);
  });
});

describe('messaging keeps working when the archive cannot be set up', () => {
  it('turns a creation failure into null rather than throwing', () => {
    // Losing messaging to protect a compliance feature is the wrong trade, so
    // the create call must be caught and turned into null.
    assert.match(archiveKeys, /return createTenantArchiveKey\(tenantId\)\.catch\(/);
    assert.match(archiveKeys, /return null;/);
  });

  it('records why the key could not be created', () => {
    // A swallowed failure here means the organization silently accumulates
    // messages it can never produce, and the first symptom is an empty
    // compliance search months later. Catching it is right; hiding it is not.
    assert.match(archiveKeys, /console\.error\('\[SynzappArchiveKey\]/);
  });

  it('accepts the project id Cloud Run actually provides', () => {
    // Cloud Run does not set GOOGLE_CLOUD_PROJECT. Relying on it alone built a
    // key name with an empty project and every wrap failed.
    assert.match(archiveKeys, /FIREBASE_PROJECT_ID/);
  });
});

describe('key ids', () => {
  it('are stable for the same public key', () => {
    const pem = '-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----\n';

    assert.equal(buildArchiveKeyId(pem), buildArchiveKeyId(pem));
  });

  it('differ for different keys', () => {
    assert.notEqual(buildArchiveKeyId('one'), buildArchiveKeyId('two'));
  });

  it('reveal nothing secret', () => {
    // Derived from the public half only.
    assert.match(archiveKeys, /createHash\('sha256'\)\.update\(publicKeyPem\)/);
  });
});

describe('reading the archive is kept separate from building it', () => {
  it('has an unwrap function that nothing calls yet', () => {
    // The archive accumulates before anything can read it, so a mistake in the
    // building does not also expose the reading.
    assert.match(archiveKeys, /export async function unwrapTenantArchivePrivateKey/);
  });

  it('uses the same encryption family as the rest of the product', () => {
    // So a sending app treats this as one more device, not a second code path.
    assert.match(archiveKeys, /generateKeyPairSync\('x25519'\)/);
  });
});

describe('the key is created safely without an admin doing anything', () => {
  it('is created before the first message is sealed, so nothing is missed', () => {
    // getTenantArchivePublicKey is called while building the sender's
    // encryption context, which happens before the message is encrypted.
    assert.match(archiveKeys, /createTenantArchiveKey\(tenantId\)/);
  });

  it('refuses to overwrite a key another sender created first', () => {
    // Two people sending their first message at the same moment would both
    // find no key. With `set`, the loser's messages would be sealed to a key
    // that no longer exists - unreadable forever and silent about it.
    assert.match(archiveKeys, /\.create\(\{/);
    assert.doesNotMatch(archiveKeys, /archiveKeyRef\(tenantId\)\.set\(/);
  });

  it('retries a momentary key-store failure rather than sending unarchived', () => {
    assert.match(archiveKeys, /WRAP_ATTEMPTS/);
  });
});
