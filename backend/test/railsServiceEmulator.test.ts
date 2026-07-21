import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { DecodedIdToken } from 'firebase-admin/auth';

const EMULATOR_PROJECT_ID = 'synzapp-rules-test';
const TENANT_ID = 'tenant_rails_integration';
const OWNER_UID = 'rails_owner';
const APPROVER_UID = 'rails_approver';

let firestore: typeof import('../src/config/firebaseAdmin.js')['firestore'];

describe('RAILS service emulator integration', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, () => {
  let service: typeof import('../src/services/railsService.js');

  beforeEach(async () => {
    process.env.FIREBASE_PROJECT_ID ||= EMULATOR_PROJECT_ID;
    process.env.FIREBASE_STORAGE_BUCKET ||= `${EMULATOR_PROJECT_ID}.appspot.com`;

    const firebaseAdmin = await import('../src/config/firebaseAdmin.js');
    service = await import('../src/services/railsService.js');
    firestore = firebaseAdmin.firestore;

    await clearIntegrationData();
    await seedIntegrationTenant();
  });

  it('persists loop state, audit activity, notifications, and standardization blockers through real services', async () => {
    const token = buildDecodedToken(OWNER_UID, 'ORG_ADMIN');

    const created = await service.createRailsItem(token, {
      approverUid: APPROVER_UID,
      dueDate: '2026-07-21',
      priority: 'High',
      title: 'Integration proof loop'
    });

    assert.equal(created.status, 'New');
    assert.equal(created.owner.uid, OWNER_UID);
    assert.equal(created.approver?.uid, APPROVER_UID);

    const itemRef = firestore
      .collection('organizations')
      .doc(TENANT_ID)
      .collection('railsItems')
      .doc(created.id);
    const createdSnapshot = await itemRef.get();
    assert.equal(createdSnapshot.exists, true);
    assert.equal(createdSnapshot.get('title'), 'Integration proof loop');

    const createdActivity = await service.listRailsItemActivity(token, created.id);
    assert.equal(createdActivity.activity.some((event) => event.type === 'RAILS_CREATED'), true);

    const notificationSnapshot = await firestore
      .collection('organizations')
      .doc(TENANT_ID)
      .collection('railsNotificationQueue')
      .get();
    assert.equal(notificationSnapshot.size, 1);
    assert.equal(notificationSnapshot.docs[0].get('type'), 'RAILS_APPROVER_REQUESTED');

    const notificationEventSnapshot = await firestore
      .collection('organizations')
      .doc(TENANT_ID)
      .collection('notificationEvents')
      .get();
    assert.equal(notificationEventSnapshot.size, 1);
    assert.equal(notificationEventSnapshot.docs[0].get('channel'), 'rails');

    await assert.rejects(
      () => service.updateRailsItem(token, created.id, { standardizationStatus: 'Verified' }),
      /Document the standardization target before closure|Attach the standardization document before verification/
    );

    const afterStandardizationUpdate = await service.updateRailsItem(token, created.id, {
      standardization: 'Update the bakery pre-op checklist and retrain line leads.',
      standardizationDueDate: '2026-07-28',
      standardizationOwnerUid: OWNER_UID,
      standardizationType: 'Checklist',
      standardizationVerification: 'Supervisor confirms the revised checklist is used for three consecutive shifts.'
    });
    assert.equal(afterStandardizationUpdate.standardizationStatus, 'Not Started');

    const requiredEvidenceId = afterStandardizationUpdate.evidence.find((entry) => entry.status === 'Required')?.evidenceId;
    assert.ok(requiredEvidenceId);

    const afterEvidence = await service.addRailsEvidence(token, created.id, {
      evidenceId: requiredEvidenceId,
      label: 'Problem photo or file',
      status: 'Attached'
    });
    assert.equal(afterEvidence.evidence.some((entry) => entry.evidenceId === requiredEvidenceId && entry.status === 'Attached'), true);

    const activity = await service.listRailsItemActivity(token, created.id);
    assert.equal(activity.activity.some((event) => event.type === 'RAILS_STANDARDIZATION_UPDATED'), true);
    assert.equal(activity.activity.some((event) => event.type === 'RAILS_EVIDENCE_UPDATED'), true);

    const tenantAuditSnapshot = await firestore
      .collection('organizations')
      .doc(TENANT_ID)
      .collection('railsAuditEvents')
      .where('itemId', '==', created.id)
      .get();
    assert.equal(tenantAuditSnapshot.size >= 3, true);
  });
});

async function clearIntegrationData() {
  await Promise.all([
    firestore.recursiveDelete(firestore.collection('identityDirectory').doc(OWNER_UID)),
    firestore.recursiveDelete(firestore.collection('identityDirectory').doc(APPROVER_UID)),
    firestore.recursiveDelete(firestore.collection('organizations').doc(TENANT_ID))
  ]);
}

async function seedIntegrationTenant() {
  const organizationRef = firestore.collection('organizations').doc(TENANT_ID);
  const batch = firestore.batch();

  batch.set(firestore.collection('identityDirectory').doc(OWNER_UID), {
    claimsVersion: 1,
    permissions: [],
    profileComplete: true,
    role: 'ORG_ADMIN',
    status: 'ACTIVE',
    tenantId: TENANT_ID
  });
  batch.set(firestore.collection('identityDirectory').doc(APPROVER_UID), {
    claimsVersion: 1,
    permissions: [],
    profileComplete: true,
    role: 'DEPT_ADMIN',
    status: 'ACTIVE',
    tenantId: TENANT_ID
  });
  batch.set(organizationRef, {
    companyName: 'Rails Integration Co',
    status: 'ACTIVE',
    tenantId: TENANT_ID
  });
  batch.set(organizationRef.collection('departments').doc('bakery'), {
    departmentId: 'bakery',
    name: 'Bakery',
    status: 'ACTIVE',
    tenantId: TENANT_ID
  });
  batch.set(organizationRef.collection('users').doc(OWNER_UID), {
    departmentId: 'bakery',
    departmentName: 'Bakery',
    displayName: 'Rails Owner',
    role: 'ORG_ADMIN',
    roleName: 'Organization Admin',
    status: 'ACTIVE',
    tenantId: TENANT_ID
  });
  batch.set(organizationRef.collection('users').doc(APPROVER_UID), {
    departmentId: 'bakery',
    departmentName: 'Bakery',
    displayName: 'Rails Approver',
    role: 'DEPT_ADMIN',
    roleName: 'Department Admin',
    status: 'ACTIVE',
    tenantId: TENANT_ID
  });

  await batch.commit();
}

function buildDecodedToken(uid: string, role: 'ORG_ADMIN' | 'DEPT_ADMIN'): DecodedIdToken {
  const nowSeconds = Math.floor(Date.now() / 1000);

  return {
    aud: EMULATOR_PROJECT_ID,
    auth_time: nowSeconds,
    claimsVersion: 1,
    exp: nowSeconds + 3600,
    firebase: { identities: {}, sign_in_provider: 'phone' },
    iat: nowSeconds,
    iss: `https://securetoken.google.com/${EMULATOR_PROJECT_ID}`,
    permissions: [],
    phone_number: '+15555550100',
    role,
    status: 'ACTIVE',
    sub: uid,
    tenantId: TENANT_ID,
    uid
  } as unknown as DecodedIdToken;
}
