import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  getBytes,
  ref,
  uploadBytes
} from 'firebase/storage';

let testEnv: RulesTestEnvironment;

describe('Storage emulator tenant rules', () => {
  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'synzapp-rules-test',
      storage: {
        rules: readFileSync(resolve('..', 'storage.rules'), 'utf8')
      }
    });
  });

  beforeEach(async () => {
    await seedStorage();
  });

  after(async () => {
    await testEnv.cleanup();
  });

  it('allows active tenant users to read their tenant company logo', async () => {
    const storage = employeeContext('user_a', 'tenant_a').storage();

    await assertSucceeds(getBytes(ref(storage, 'organizations/tenant_a/company/logo/company-logo.png')));
  });

  it('denies cross-tenant company logo reads', async () => {
    const storage = employeeContext('user_a', 'tenant_a').storage();

    await assertFails(getBytes(ref(storage, 'organizations/tenant_b/company/logo/company-logo.png')));
  });

  it('allows users to read only their own encrypted chat backup', async () => {
    const storage = employeeContext('user_a', 'tenant_a').storage();

    await assertSucceeds(getBytes(ref(storage, 'organizations/tenant_a/users/user_a/chat-backups/latest.synzappbackup')));
    await assertFails(getBytes(ref(storage, 'organizations/tenant_a/users/user_b/chat-backups/latest.synzappbackup')));
  });

  it('blocks client writes to backend-owned storage paths', async () => {
    const storage = employeeContext('user_a', 'tenant_a').storage();

    await assertFails(uploadBytes(
      ref(storage, 'organizations/tenant_a/users/user_a/profile/profile-photo.jpg'),
      new Uint8Array([1, 2, 3])
    ));
  });
});

function employeeContext(uid: string, tenantId: string) {
  return testEnv.authenticatedContext(uid, {
    permissions: [],
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    tenantId
  });
}

async function seedStorage() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const storage = context.storage();

    await uploadBytes(
      ref(storage, 'organizations/tenant_a/company/logo/company-logo.png'),
      new Uint8Array([1, 2, 3])
    );
    await uploadBytes(
      ref(storage, 'organizations/tenant_b/company/logo/company-logo.png'),
      new Uint8Array([1, 2, 3])
    );
    await uploadBytes(
      ref(storage, 'organizations/tenant_a/users/user_a/chat-backups/latest.synzappbackup'),
      new Uint8Array([1, 2, 3])
    );
    await uploadBytes(
      ref(storage, 'organizations/tenant_a/users/user_b/chat-backups/latest.synzappbackup'),
      new Uint8Array([1, 2, 3])
    );
  });
}
