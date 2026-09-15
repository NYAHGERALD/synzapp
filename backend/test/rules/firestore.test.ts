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
  collection,
  doc,
  getDoc,
  getDocs,
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

  it('denies direct client access to backend-owned RAILS system records', async () => {
    const db = employeeContext('user_a', 'tenant_a').firestore();

    await assertFails(getDoc(doc(db, 'organizations/tenant_a/railsItems/rails_1')));
    await assertFails(getDocs(collection(db, 'organizations/tenant_a/railsItems/rails_1/activity')));
    await assertFails(getDoc(doc(db, 'organizations/tenant_a/railsAuditEvents/rails_evt_1')));
    await assertFails(getDoc(doc(db, 'organizations/tenant_a/railsNotificationQueue/rails_note_1')));
    await assertFails(getDoc(doc(db, 'organizations/tenant_a/notificationEvents/rails_note_1')));
  });

  it('denies direct client writes to backend-owned RAILS system records', async () => {
    const db = employeeContext('user_a', 'tenant_a').firestore();

    await assertFails(setDoc(doc(db, 'organizations/tenant_a/railsItems/rails_2'), {
      status: 'Closed',
      tenantId: 'tenant_a',
      title: 'Client write attempt'
    }));
    await assertFails(setDoc(doc(db, 'organizations/tenant_a/railsItems/rails_1/activity/rails_evt_2'), {
      summary: 'Tamper attempt',
      tenantId: 'tenant_a',
      type: 'RAILS_UPDATED'
    }));
    await assertFails(setDoc(doc(db, 'organizations/tenant_a/railsAuditEvents/rails_evt_2'), {
      summary: 'Tamper attempt',
      tenantId: 'tenant_a',
      type: 'RAILS_UPDATED'
    }));
    await assertFails(setDoc(doc(db, 'organizations/tenant_a/railsNotificationQueue/rails_note_2'), {
      message: 'Tamper attempt',
      tenantId: 'tenant_a'
    }));
  });
  /**
   * A root cause analysis holds who was involved, whether anybody was injured,
   * who reported it and which lot and shift it happened on. These rules used to
   * hand all of it to every employee in the company, and let them rewrite it.
   */
  it('denies an employee reading an RCA incident they are not part of', async () => {
    const db = employeeContext('user_a', 'tenant_a').firestore();

    await assertFails(getDoc(doc(db, 'organizations/tenant_a/rcaIncidents/incident_1')));
  });

  it('denies listing every RCA incident in the company', async () => {
    const db = employeeContext('user_a', 'tenant_a').firestore();

    await assertFails(getDocs(collection(db, 'organizations/tenant_a/rcaIncidents')));
  });

  it('denies reading RCA sessions, nodes, CAPA actions and evidence logs', async () => {
    const db = employeeContext('user_a', 'tenant_a').firestore();
    const paths = [
      'organizations/tenant_a/rcaIncidents/incident_1/rcaSessions/session_1',
      'organizations/tenant_a/rcaIncidents/incident_1/rcaSessions/session_1/nodes/node_1',
      'organizations/tenant_a/rcaIncidents/incident_1/rcaSessions/session_1/capaActions/capa_1',
      'organizations/tenant_a/rcaIncidents/incident_1/evidenceLogs/evidence_1'
    ];

    for (const path of paths) {
      await assertFails(getDoc(doc(db, path)));
    }
  });

  it('denies an employee altering an RCA incident', async () => {
    /**
     * The old rule checked only that the existing document was not CLOSED, so
     * rootCause, status, createdByUid and participantUids were all settable by
     * anybody — while the backend refuses to reopen a closed RCA outside a
     * governed workflow. That record is regulatory evidence.
     */
    const db = employeeContext('user_a', 'tenant_a').firestore();

    await assertFails(setDoc(doc(db, 'organizations/tenant_a/rcaIncidents/incident_1'), {
      participantUids: ['user_a'],
      rootCause: 'Somebody else did it',
      status: 'CLOSED',
      tenantId: 'tenant_a'
    }));
  });

  it('denies creating an RCA incident from a client', async () => {
    const db = employeeContext('user_a', 'tenant_a').firestore();

    await assertFails(setDoc(doc(db, 'organizations/tenant_a/rcaIncidents/incident_2'), {
      createdByUid: 'user_a',
      status: 'OPEN',
      tenantId: 'tenant_a'
    }));
  });

  it('denies writing an RCA node, CAPA action and presence record', async () => {
    const db = employeeContext('user_a', 'tenant_a').firestore();
    const paths = [
      'organizations/tenant_a/rcaIncidents/incident_1/rcaSessions/session_1/nodes/node_2',
      'organizations/tenant_a/rcaIncidents/incident_1/rcaSessions/session_1/capaActions/capa_2',
      'organizations/tenant_a/rcaIncidents/incident_1/rcaSessions/session_1/presence/user_a'
    ];

    for (const path of paths) {
      await assertFails(setDoc(doc(db, path), { tenantId: 'tenant_a', uid: 'user_a' }));
    }
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
    await setDoc(doc(db, 'organizations/tenant_a/railsItems/rails_1'), {
      ownerUid: 'user_a',
      status: 'In Progress',
      tenantId: 'tenant_a',
      title: 'Fire under the oven'
    });
    await setDoc(doc(db, 'organizations/tenant_a/railsItems/rails_1/activity/rails_evt_1'), {
      actorUid: 'user_a',
      itemId: 'rails_1',
      summary: 'Created RAILS loop.',
      tenantId: 'tenant_a',
      type: 'RAILS_CREATED'
    });
    await setDoc(doc(db, 'organizations/tenant_a/railsAuditEvents/rails_evt_1'), {
      actorUid: 'user_a',
      itemId: 'rails_1',
      summary: 'Created RAILS loop.',
      tenantId: 'tenant_a',
      type: 'RAILS_CREATED'
    });
    await setDoc(doc(db, 'organizations/tenant_a/railsNotificationQueue/rails_note_1'), {
      itemId: 'rails_1',
      message: 'RAILS update',
      recipientUids: ['user_a'],
      tenantId: 'tenant_a',
      type: 'RAILS_LOOP_ASSIGNED'
    });
    await setDoc(doc(db, 'organizations/tenant_a/notificationEvents/rails_note_1'), {
      channel: 'rails',
      notificationId: 'rails_note_1',
      recipientUids: ['user_a'],
      tenantId: 'tenant_a',
      type: 'RAILS_LOOP_ASSIGNED'
    });
    /**
     * An incident user_a has nothing to do with. The backend would refuse them:
     * they neither created it nor appear in participantUids.
     */
    await setDoc(doc(db, 'organizations/tenant_a/rcaIncidents/incident_1'), {
      createdByUid: 'user_c',
      participantUids: ['user_c'],
      reportedBy: 'Line supervisor',
      status: 'OPEN',
      tenantId: 'tenant_a',
      title: 'Hand injury on the wrapper',
      wasAnyoneInjured: true,
      whoWasInvolved: 'Night shift packer'
    });
    await setDoc(doc(db, 'organizations/tenant_a/rcaIncidents/incident_1/rcaSessions/session_1'), {
      incidentId: 'incident_1',
      status: 'OPEN',
      tenantId: 'tenant_a'
    });
    await setDoc(
      doc(db, 'organizations/tenant_a/rcaIncidents/incident_1/rcaSessions/session_1/nodes/node_1'),
      { label: 'Guard removed', sessionId: 'session_1', tenantId: 'tenant_a' }
    );
    await setDoc(
      doc(db, 'organizations/tenant_a/rcaIncidents/incident_1/rcaSessions/session_1/capaActions/capa_1'),
      { description: 'Refit the guard', sessionId: 'session_1', tenantId: 'tenant_a' }
    );
    await setDoc(
      doc(db, 'organizations/tenant_a/rcaIncidents/incident_1/evidenceLogs/evidence_1'),
      { fileName: 'wrapper.jpg', tenantId: 'tenant_a' }
    );
  });
}
