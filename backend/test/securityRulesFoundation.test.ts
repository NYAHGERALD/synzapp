import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(testDir, '..', '..');
const firestoreRules = readFileSync(resolve(workspaceRoot, 'firestore.rules'), 'utf8');
const storageRules = readFileSync(resolve(workspaceRoot, 'storage.rules'), 'utf8');
const firebaseConfig = readFileSync(resolve(workspaceRoot, 'firebase.json'), 'utf8');

describe('security rules foundation', () => {
  it('registers Firestore and Storage rule files in Firebase config', () => {
    const config = JSON.parse(firebaseConfig) as {
      firestore?: { rules?: string };
      storage?: { rules?: string };
    };

    assert.equal(config.firestore?.rules, 'firestore.rules');
    assert.equal(config.storage?.rules, 'storage.rules');
  });

  it('keeps Firestore rules tenant-scoped and default-deny', () => {
    assert.match(firestoreRules, /function isActiveTenant\(tenantId\)/);
    assert.match(firestoreRules, /request\.auth\.token\.tenantId == tenantId/);
    assert.match(firestoreRules, /request\.auth\.token\.status == 'ACTIVE'/);
    assert.match(firestoreRules, /match \/organizations\/\{tenantId\}/);
    assert.match(firestoreRules, /match \/\{document=\*\*\}/);
    assert.match(firestoreRules, /allow read, write: if false;/);
    assert.doesNotMatch(firestoreRules, /allow\s+(read|write|create|update|delete|list|get)(,\s*\w+)*:\s*if\s+true/);
  });

  it('keeps Storage rules tenant-scoped and blocks client writes', () => {
    assert.match(storageRules, /function isActiveTenant\(tenantId\)/);
    assert.match(storageRules, /request\.auth\.token\.tenantId == tenantId/);
    assert.match(storageRules, /request\.auth\.token\.status == 'ACTIVE'/);
    assert.match(storageRules, /match \/organizations\/\{tenantId\}/);
    assert.match(storageRules, /match \/\{path=\*\*\}/);
    assert.match(storageRules, /allow read, write: if false;/);
    assert.doesNotMatch(storageRules, /allow\s+(write|create|update|delete)(,\s*\w+)*:\s*if\s+true/);
  });
});
