import assert from 'node:assert/strict';
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
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

describe('Firestore emulator tenant rules', () => {
  before(async () => {
    testEnv = await initializeTestEnvironment({
      firestore: {
        rules: readFileSync(resolve('..', 'firestore.rules'), 'utf8')
      },
      projectId: 'synzapp-rules-test'
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seedFirestore();
  });

  after(async () => {
    await testEnv.cleanup();
  });

  it('allows active users to read their own tenant profile', async () => {
    const db = employeeContext('user_a', 'tenant_a').firestore();

    await assertSucceeds(getDoc(doc(db, 'organizations/tenant_a/users/user_a')));
  });

  it('denies cross-tenant profile reads', async () => {
    const db = employeeContext('user_a', 'tenant_a').firestore();

    await assertFails(getDoc(doc(db, 'organizations/tenant_b/users/user_b')));
  });

  it('denies inactive users even with matching tenant claim', async () => {
    const db = testEnv.authenticatedContext('user_a', {
      permissions: [],
      role: 'EMPLOYEE',
      status: 'SUSPENDED',
      tenantId: 'tenant_a'
    }).firestore();

    await assertFails(getDoc(doc(db, 'organizations/tenant_a/users/user_a')));
  });

  it('allows direct-chat participants to read chat metadata and their encrypted envelope', async () => {
    const db = employeeContext('user_a', 'tenant_a').firestore();

    await assertSucceeds(getDoc(doc(db, 'organizations/tenant_a/directChats/chat_ab')));
    await assertSucceeds(getDoc(doc(db, 'organizations/tenant_a/directChats/chat_ab/encryptedEnvelopes/env_1')));
  });

  it('denies non-participants from direct-chat metadata and envelopes', async () => {
    const db = employeeContext('user_c', 'tenant_a').firestore();

    await assertFails(getDoc(doc(db, 'organizations/tenant_a/directChats/chat_ab')));
    await assertFails(getDoc(doc(db, 'organizations/tenant_a/directChats/chat_ab/encryptedEnvelopes/env_1')));
  });

  it('blocks client writes to backend-owned tenant records', async () => {
    const db = employeeContext('user_a', 'tenant_a').firestore();

    await assertFails(setDoc(doc(db, 'organizations/tenant_a/departments/quality'), {
      name: 'Quality',
      status: 'ACTIVE',
      tenantId: 'tenant_a'
    }));
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

async function seedFirestore() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, 'organizations/tenant_a'), {
      companyName: 'Tenant A',
      status: 'ACTIVE',
      tenantId: 'tenant_a'
    });
    await setDoc(doc(db, 'organizations/tenant_b'), {
      companyName: 'Tenant B',
      status: 'ACTIVE',
      tenantId: 'tenant_b'
    });
    await setDoc(doc(db, 'organizations/tenant_a/users/user_a'), {
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      tenantId: 'tenant_a'
    });
    await setDoc(doc(db, 'organizations/tenant_a/users/user_c'), {
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      tenantId: 'tenant_a'
    });
    await setDoc(doc(db, 'organizations/tenant_b/users/user_b'), {
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      tenantId: 'tenant_b'
    });
    await setDoc(doc(db, 'organizations/tenant_a/directChats/chat_ab'), {
      participantIds: ['user_a', 'user_b'],
      tenantId: 'tenant_a'
    });
    await setDoc(doc(db, 'organizations/tenant_a/directChats/chat_ab/encryptedEnvelopes/env_1'), {
      recipientUid: 'user_b',
      senderUid: 'user_a',
      tenantId: 'tenant_a'
    });
  });
}
