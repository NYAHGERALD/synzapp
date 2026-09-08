import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

/**
 * Announcements at the size that breaks a naive design.
 *
 * Section 6 of the plan sets budgets for an organization of five thousand.
 * They were written down and never measured, which makes them aspirations
 * rather than requirements. This measures them.
 *
 * The numbers here are from a Firestore emulator on a developer machine, which
 * is slower than production for writes and faster for network. They are a
 * guard against a design that scans everything, not a promise about latency.
 */

const EMULATOR_PROJECT_ID = 'synzapp-rules-test';
const TENANT = 'tenant_scale';
const ORG_ADMIN = 'user_scale_admin';
const STAFF_COUNT = 5_000;

let firestore: typeof import('../src/config/firebaseAdmin.js')['firestore'];
let announcements: typeof import('../src/services/announcementService.js');

function tokenFor(uid: string) {
  return { uid } as unknown as import('firebase-admin/auth').DecodedIdToken;
}

async function seedStaff() {
  const usersRef = firestore.collection('organizations').doc(TENANT).collection('users');
  const existing = await usersRef.count().get();

  if (existing.data().count >= STAFF_COUNT) {
    return;
  }

  // Written in batches, because five thousand individual writes take minutes
  // and this has to be runnable often enough that somebody actually runs it.
  for (let start = 0; start < STAFF_COUNT; start += 500) {
    const batch = firestore.batch();

    for (let index = start; index < Math.min(start + 500, STAFF_COUNT); index += 1) {
      const uid = `user_staff_${index}`;

      batch.set(usersRef.doc(uid), {
        departmentId: 'dept_floor',
        displayName: `Staff Member ${index}`,
        role: 'EMPLOYEE',
        status: 'ACTIVE',
        tenantId: TENANT
      });
    }

    await batch.commit();
  }
}

describe('announcements at five thousand', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, () => {
  before(async () => {
    process.env.FIREBASE_PROJECT_ID ||= EMULATOR_PROJECT_ID;
    process.env.FIREBASE_STORAGE_BUCKET ||= `${EMULATOR_PROJECT_ID}.appspot.com`;

    const admin = await import('../src/config/firebaseAdmin.js');
    firestore = admin.firestore;
    announcements = await import('../src/services/announcementService.js');

    await firestore.recursiveDelete(firestore.collection('organizations').doc(TENANT));
    await firestore.collection('identityDirectory').doc(ORG_ADMIN).set({
      departmentId: 'dept_floor',
      permissions: [],
      profileComplete: true,
      role: 'ORG_ADMIN',
      status: 'ACTIVE',
      tenantId: TENANT
    });
    await firestore
      .collection('organizations')
      .doc(TENANT)
      .collection('users')
      .doc(ORG_ADMIN)
      .set({
        departmentId: 'dept_floor',
        displayName: 'Scale Admin',
        role: 'ORG_ADMIN',
        status: 'ACTIVE',
        tenantId: TENANT
      });

    await seedStaff();
  });

  it('sends to five thousand people, and the count is right', async () => {
    const startedAt = Date.now();
    const record = await announcements.createAnnouncement(tokenFor(ORG_ADMIN), {
      audiences: [{ kind: 'ORGANIZATION', targetId: null, targetName: 'Everyone' }],
      body: 'Site closed on Monday for the annual clean.',
      requiresAcknowledgement: true,
      subject: 'Site closure'
    });
    const elapsed = Date.now() - startedAt;

    console.log(`      sending to ${record.expectedRecipientCount}: ${elapsed}ms`);

    assert.equal(record.expectedRecipientCount, STAFF_COUNT + 1);
    assert.equal(record.deliveredCount, STAFF_COUNT + 1);
    assert.equal(record.state, 'SENT');
  });

  it('opens the first page of recipients without reading them all', async () => {
    const snapshot = await firestore
      .collection('organizations')
      .doc(TENANT)
      .collection('announcements')
      .orderBy('createdAtMs', 'desc')
      .limit(1)
      .get();
    const announcementId = snapshot.docs[0].id;

    const startedAt = Date.now();
    const page = await announcements.listAnnouncementRecipients(tokenFor(ORG_ADMIN), {
      announcementId
    });
    const elapsed = Date.now() - startedAt;

    console.log(`      first page of recipients: ${elapsed}ms`);

    assert.equal(page.recipients.length, 50, 'a page is fifty, not five thousand');
    assert.ok(page.nextCursor, 'and there is more to come');
    // The budget in section 6. Generous, because the point is to catch a design
    // that reads every row, not to time a laptop.
    assert.ok(elapsed < 500, `first page took ${elapsed}ms, budget is 500ms`);
  });

  it('shows the counts without counting the rows', async () => {
    const snapshot = await firestore
      .collection('organizations')
      .doc(TENANT)
      .collection('announcements')
      .orderBy('createdAtMs', 'desc')
      .limit(1)
      .get();

    const startedAt = Date.now();
    const record = snapshot.docs[0].data() as { acknowledgedCount: number; deliveredCount: number };
    const elapsed = Date.now() - startedAt;

    console.log(`      reading the counts: ${elapsed}ms`);

    // One document read, whatever the size of the audience. If this ever
    // becomes a query over the recipients, this test still passes but the
    // number above will climb.
    assert.equal(record.deliveredCount, STAFF_COUNT + 1);
    assert.equal(record.acknowledgedCount, 0);
  });

  it('works out who a hold covers without reading five thousand rows', async () => {
    const snapshot = await firestore
      .collection('organizations')
      .doc(TENANT)
      .collection('announcements')
      .orderBy('createdAtMs', 'desc')
      .limit(1)
      .get();

    const startedAt = Date.now();
    const holds = await announcements.findHoldsCoveringAnnouncement(TENANT, snapshot.docs[0].id);
    const elapsed = Date.now() - startedAt;

    console.log(`      checking legal holds: ${elapsed}ms`);

    assert.deepEqual(holds, []);
    assert.ok(elapsed < 500, `hold check took ${elapsed}ms, budget is 500ms`);
  });
});
