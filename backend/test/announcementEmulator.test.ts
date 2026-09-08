import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

/**
 * Announcements, run for real against a Firestore emulator.
 *
 * Every rule in section 5 of the plan has a test here, by number. A rule with
 * no test is not a rule: it is a sentence in a document that a future change
 * will quietly break.
 *
 * These seed real people, send real announcements and read back what actually
 * happened. Nothing here asserts that the source contains a word.
 */

const EMULATOR_PROJECT_ID = 'synzapp-rules-test';
const TENANT = 'tenant_announcements';

const ORG_ADMIN = 'user_org_admin';
const PRODUCTION_ADMIN = 'user_production_admin';
const TEAM_LEAD = 'user_team_lead';
const WORKER_ONE = 'user_worker_one';
const WORKER_TWO = 'user_worker_two';
const OUTSIDER = 'user_warehouse_worker';

let firestore: typeof import('../src/config/firebaseAdmin.js')['firestore'];
let announcements: typeof import('../src/services/announcementService.js');
let holds: typeof import('../src/services/legalHoldService.js');

function tokenFor(uid: string) {
  return { uid } as unknown as import('firebase-admin/auth').DecodedIdToken;
}

async function seedPerson(input: {
  departmentId: string;
  displayName: string;
  permissions?: string[];
  role: string;
  status?: string;
  uid: string;
}) {
  const status = input.status || 'ACTIVE';

  await firestore.collection('identityDirectory').doc(input.uid).set({
    departmentId: input.departmentId,
    permissions: input.permissions || [],
    profileComplete: true,
    role: input.role,
    status,
    tenantId: TENANT
  });
  await firestore
    .collection('organizations')
    .doc(TENANT)
    .collection('users')
    .doc(input.uid)
    .set({
      departmentId: input.departmentId,
      displayName: input.displayName,
      role: input.role,
      status,
      tenantId: TENANT
    });
}

describe('announcements, run against real data', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, () => {
  beforeEach(async () => {
    process.env.FIREBASE_PROJECT_ID ||= EMULATOR_PROJECT_ID;
    process.env.FIREBASE_STORAGE_BUCKET ||= `${EMULATOR_PROJECT_ID}.appspot.com`;

    const admin = await import('../src/config/firebaseAdmin.js');
    firestore = admin.firestore;
    announcements = await import('../src/services/announcementService.js');
    holds = await import('../src/services/legalHoldService.js');

    const existingHolds = await firestore
      .collection('tenants')
      .doc(TENANT)
      .collection('legalHolds')
      .listDocuments();

    await Promise.all(existingHolds.map((doc) => doc.delete()));

    for (const path of ['identityDirectory']) {
      const docs = await firestore.collection(path).listDocuments();
      await Promise.all(docs.map((doc) => doc.delete()));
    }

    await firestore.recursiveDelete(firestore.collection('organizations').doc(TENANT));

    await seedPerson({ departmentId: 'dept_production', displayName: 'Ada Org', role: 'ORG_ADMIN', uid: ORG_ADMIN });
    await seedPerson({
      departmentId: 'dept_production',
      displayName: 'Ben Production',
      permissions: ['announcements.send', 'groups.create'],
      role: 'DEPT_ADMIN',
      uid: PRODUCTION_ADMIN
    });
    await seedPerson({
      departmentId: 'dept_production',
      displayName: 'Cara Lead',
      permissions: ['groups.create'],
      role: 'EMPLOYEE',
      uid: TEAM_LEAD
    });
    await seedPerson({ departmentId: 'dept_production', displayName: 'Dev Worker', role: 'EMPLOYEE', uid: WORKER_ONE });
    await seedPerson({ departmentId: 'dept_production', displayName: 'Eli Worker', role: 'EMPLOYEE', uid: WORKER_TWO });
    await seedPerson({ departmentId: 'dept_warehouse', displayName: 'Fay Warehouse', role: 'EMPLOYEE', uid: OUTSIDER });

    const lineA = firestore
      .collection('organizations')
      .doc(TENANT)
      .collection('groups')
      .doc('group_line_a');

    await lineA.set({
      autoMembershipDepartmentId: null,
      departmentId: 'dept_production',
      memberPolicy: 'EXPLICIT',
      name: 'Line A'
    });

    for (const uid of [TEAM_LEAD, WORKER_ONE]) {
      await lineA.collection('members').doc(uid).set({ status: 'ACTIVE', uid });
    }
  });

  const organizationAudience = {
    kind: 'ORGANIZATION' as const,
    targetId: null,
    targetName: 'Everyone'
  };

  async function sendToEveryone(senderUid = ORG_ADMIN) {
    return announcements.createAnnouncement(tokenFor(senderUid), {
      audiences: [organizationAudience],
      body: 'Allergen change on line 3 from Monday.',
      requiresAcknowledgement: true,
      subject: 'Allergen change'
    });
  }

  describe('who it reaches', () => {
    it('reaches every active person when an Org Admin sends to the organization', async () => {
      const record = await sendToEveryone();

      assert.equal(record.expectedRecipientCount, 6);
      assert.equal(record.state, 'SENT');
      assert.equal(record.deliveredCount, 6);
    });

    it('leaves out people who no longer work here', async () => {
      await seedPerson({
        departmentId: 'dept_production',
        displayName: 'Gone Person',
        role: 'EMPLOYEE',
        status: 'DEACTIVATED',
        uid: 'user_departed'
      });

      const record = await sendToEveryone();

      // Counting somebody who has left would make every announcement look
      // permanently unacknowledged.
      assert.equal(record.expectedRecipientCount, 6);
    });

    it('freezes the list, so a later joiner was not told (rule 5.1)', async () => {
      const record = await sendToEveryone();

      await seedPerson({
        departmentId: 'dept_production',
        displayName: 'New Starter',
        role: 'EMPLOYEE',
        uid: 'user_new_starter'
      });

      const { recipients } = await announcements.listAnnouncementRecipients(tokenFor(ORG_ADMIN), {
        announcementId: record.announcementId
      });

      assert.equal(recipients.length, 6);
      assert.ok(!recipients.some((person) => person.uid === 'user_new_starter'));
    });

    it('refuses an audience with nobody in it', async () => {
      await firestore
        .collection('organizations')
        .doc(TENANT)
        .collection('groups')
        .doc('group_empty')
        .set({
          autoMembershipDepartmentId: null,
          departmentId: 'dept_production',
          memberPolicy: 'EXPLICIT',
          name: 'Empty'
        });

      await assert.rejects(
        announcements.createAnnouncement(tokenFor(ORG_ADMIN), {
          audiences: [{ kind: 'GROUP', targetId: 'group_empty', targetName: 'Empty' }],
          body: 'Nobody is here.',
          requiresAcknowledgement: false,
          subject: 'Nobody'
        }),
        /nobody in that audience/i
      );
    });
  });

  describe('groups whose members come from a department', () => {
    it('reaches the department, even though nobody has a member row', async () => {
      // This is how the product creates a department group. Reading a
      // memberIds array found nobody and refused the send.
      await firestore
        .collection('organizations')
        .doc(TENANT)
        .collection('groups')
        .doc('group_warehouse')
        .set({
          autoMembershipDepartmentId: 'dept_warehouse',
          departmentId: 'dept_warehouse',
          memberPolicy: 'DEPARTMENT_PLUS_EXPLICIT',
          name: 'Warehouse team'
        });

      const record = await announcements.createAnnouncement(tokenFor(ORG_ADMIN), {
        audiences: [{ kind: 'GROUP', targetId: 'group_warehouse', targetName: 'Warehouse team' }],
        body: 'Dock 2 is closed tomorrow.',
        requiresAcknowledgement: true,
        subject: 'Dock closure'
      });

      assert.equal(record.expectedRecipientCount, 1);
    });

    it('counts somebody once when they are in the department and named as well', async () => {
      const group = firestore
        .collection('organizations')
        .doc(TENANT)
        .collection('groups')
        .doc('group_both');

      await group.set({
        autoMembershipDepartmentId: 'dept_warehouse',
        departmentId: 'dept_warehouse',
        memberPolicy: 'DEPARTMENT_PLUS_EXPLICIT',
        name: 'Warehouse plus'
      });
      await group.collection('members').doc(OUTSIDER).set({ status: 'ACTIVE', uid: OUTSIDER });

      const record = await announcements.createAnnouncement(tokenFor(ORG_ADMIN), {
        audiences: [{ kind: 'GROUP', targetId: 'group_both', targetName: 'Warehouse plus' }],
        body: 'Counted once.',
        requiresAcknowledgement: false,
        subject: 'Duplicate check'
      });

      assert.equal(record.expectedRecipientCount, 1);
    });
  });

  describe('who may send', () => {
    it('refuses a department admin another department', async () => {
      await assert.rejects(
        announcements.createAnnouncement(tokenFor(PRODUCTION_ADMIN), {
          audiences: [{ kind: 'DEPARTMENT', targetId: 'dept_warehouse', targetName: 'Warehouse' }],
          body: 'Not yours to send.',
          requiresAcknowledgement: false,
          subject: 'Wrong department'
        }),
        /not allowed/i
      );
    });

    it('lets a department admin address their own department', async () => {
      const record = await announcements.createAnnouncement(tokenFor(PRODUCTION_ADMIN), {
        audiences: [{ kind: 'DEPARTMENT', targetId: 'dept_production', targetName: 'Production' }],
        body: 'Line meeting at 6am.',
        requiresAcknowledgement: true,
        subject: 'Line meeting'
      });

      assert.equal(record.expectedRecipientCount, 5);
    });

    it('lets a group creator address their own group, and nothing wider', async () => {
      const record = await announcements.createAnnouncement(tokenFor(TEAM_LEAD), {
        audiences: [{ kind: 'GROUP', targetId: 'group_line_a', targetName: 'Line A' }],
        body: 'Swap at 2pm.',
        requiresAcknowledgement: false,
        subject: 'Shift swap'
      });

      assert.equal(record.expectedRecipientCount, 2);

      await assert.rejects(
        announcements.createAnnouncement(tokenFor(TEAM_LEAD), {
          audiences: [{ kind: 'DEPARTMENT', targetId: 'dept_production', targetName: 'Production' }],
          body: 'Overreaching.',
          requiresAcknowledgement: false,
          subject: 'Too wide'
        }),
        /not allowed/i
      );
    });

    it('refuses an ordinary employee entirely', async () => {
      await assert.rejects(
        announcements.createAnnouncement(tokenFor(WORKER_TWO), {
          audiences: [{ kind: 'GROUP', targetId: 'group_line_a', targetName: 'Line A' }],
          body: 'Not mine to send.',
          requiresAcknowledgement: false,
          subject: 'No permission'
        }),
        /not allowed/i
      );
    });
  });

  describe('acknowledging', () => {
    it('counts a person once however many times they press it (rule 5.7)', async () => {
      const record = await sendToEveryone();

      // Two devices, one person, at the same moment.
      await Promise.all([
        announcements.acknowledgeAnnouncement(tokenFor(WORKER_ONE), record.announcementId),
        announcements.acknowledgeAnnouncement(tokenFor(WORKER_ONE), record.announcementId)
      ]);

      const after = await firestore
        .collection('organizations')
        .doc(TENANT)
        .collection('announcements')
        .doc(record.announcementId)
        .get();

      assert.equal((after.data() as { acknowledgedCount: number }).acknowledgedCount, 1);
    });

    it('keeps the count and the rows agreeing after several people acknowledge', async () => {
      const record = await sendToEveryone();

      await Promise.all([
        announcements.acknowledgeAnnouncement(tokenFor(WORKER_ONE), record.announcementId),
        announcements.acknowledgeAnnouncement(tokenFor(WORKER_TWO), record.announcementId),
        announcements.acknowledgeAnnouncement(tokenFor(TEAM_LEAD), record.announcementId)
      ]);

      const after = await firestore
        .collection('organizations')
        .doc(TENANT)
        .collection('announcements')
        .doc(record.announcementId)
        .get();
      const rows = await firestore
        .collection('organizations')
        .doc(TENANT)
        .collection('announcements')
        .doc(record.announcementId)
        .collection('recipients')
        .get();
      const acknowledgedRows = rows.docs.filter(
        (doc) => (doc.data() as { acknowledgedAtMs: number | null }).acknowledgedAtMs
      );

      assert.equal(
        (after.data() as { acknowledgedCount: number }).acknowledgedCount,
        acknowledgedRows.length,
        'the number shown must match the rows underneath it'
      );
      assert.equal(acknowledgedRows.length, 3);
    });

    it('refuses somebody it was never sent to (rule 5.5)', async () => {
      const record = await announcements.createAnnouncement(tokenFor(TEAM_LEAD), {
        audiences: [{ kind: 'GROUP', targetId: 'group_line_a', targetName: 'Line A' }],
        body: 'Line A only.',
        requiresAcknowledgement: true,
        subject: 'Line A'
      });

      await assert.rejects(
        announcements.acknowledgeAnnouncement(tokenFor(OUTSIDER), record.announcementId),
        /not sent to you/i
      );
    });

    it('keeps a person on the record after they leave the company (rule 5.2)', async () => {
      const record = await sendToEveryone();

      await announcements.acknowledgeAnnouncement(tokenFor(WORKER_ONE), record.announcementId);

      // They are dismissed the following week.
      await firestore.collection('identityDirectory').doc(WORKER_ONE).update({ status: 'DELETED' });
      await firestore
        .collection('organizations')
        .doc(TENANT)
        .collection('users')
        .doc(WORKER_ONE)
        .update({ status: 'DELETED' });

      const { recipients } = await announcements.listAnnouncementRecipients(tokenFor(ORG_ADMIN), {
        announcementId: record.announcementId
      });
      const theirRow = recipients.find((person) => person.uid === WORKER_ONE);

      assert.ok(theirRow, 'removing somebody must not erase the proof they were told');
      assert.equal(theirRow?.status, 'ACKNOWLEDGED');
    });
  });

  describe('retention', () => {
    it('removes the words and keeps the receipt (rule 5.4)', async () => {
      const record = await sendToEveryone();

      await announcements.acknowledgeAnnouncement(tokenFor(WORKER_ONE), record.announcementId);
      await announcements.removeAnnouncementBody(TENANT, record.announcementId);

      const after = await firestore
        .collection('organizations')
        .doc(TENANT)
        .collection('announcements')
        .doc(record.announcementId)
        .get();
      const rows = await firestore
        .collection('organizations')
        .doc(TENANT)
        .collection('announcements')
        .doc(record.announcementId)
        .collection('recipients')
        .get();

      assert.ok((after.data() as { bodyRemovedAtMs: number | null }).bodyRemovedAtMs);
      assert.equal(
        (after.data() as { acknowledgedCount: number }).acknowledgedCount,
        1,
        'the proof must outlive the words'
      );
      assert.equal(rows.size, 6);
    });
  });

  describe('several audiences at once', () => {
    it('counts somebody in two chosen audiences only once', async () => {
      // Cara is in the Production department and in Line A. If she appears
      // twice, the total on an audit screen disagrees with the names under it.
      const record = await announcements.createAnnouncement(tokenFor(ORG_ADMIN), {
        audiences: [
          { kind: 'DEPARTMENT', targetId: 'dept_production', targetName: 'Production' },
          { kind: 'GROUP', targetId: 'group_line_a', targetName: 'Line A' }
        ],
        body: 'Both audiences overlap.',
        requiresAcknowledgement: true,
        subject: 'Overlap'
      });

      const rows = await firestore
        .collection('organizations')
        .doc(TENANT)
        .collection('announcements')
        .doc(record.announcementId)
        .collection('recipients')
        .get();

      // Five in Production; Line A adds nobody new.
      assert.equal(record.expectedRecipientCount, 5);
      assert.equal(rows.size, 5);
    });

    it('refuses the whole send when one audience is not theirs', async () => {
      // Silently dropping the refused audience would send something narrower
      // than the sender believes they sent.
      await assert.rejects(
        announcements.createAnnouncement(tokenFor(PRODUCTION_ADMIN), {
          audiences: [
            { kind: 'DEPARTMENT', targetId: 'dept_production', targetName: 'Production' },
            { kind: 'DEPARTMENT', targetId: 'dept_warehouse', targetName: 'Warehouse' }
          ],
          body: 'One of these is not mine.',
          requiresAcknowledgement: false,
          subject: 'Mixed'
        }),
        /not allowed to send an announcement to Warehouse/
      );
    });

    it('describes several audiences in words', () => {
      assert.equal(
        announcements.describeAudiences([
          { kind: 'DEPARTMENT', targetId: 'd', targetName: 'Production' },
          { kind: 'GROUP', targetId: 'g', targetName: 'Line A' }
        ]),
        'Production and Line A'
      );
      assert.equal(
        announcements.describeAudiences([
          { kind: 'GROUP', targetId: '1', targetName: 'Line A' },
          { kind: 'GROUP', targetId: '2', targetName: 'Line B' },
          { kind: 'GROUP', targetId: '3', targetName: 'Line C' },
          { kind: 'GROUP', targetId: '4', targetName: 'Line D' }
        ]),
        'Line A, Line B and 2 others'
      );
    });
  });

  describe('one named person', () => {
    it('reaches exactly that person when an Org Admin sends it', async () => {
      const record = await announcements.createAnnouncement(tokenFor(ORG_ADMIN), {
        audiences: [{ kind: 'PERSON', targetId: WORKER_TWO, targetName: 'Eli Worker' }],
        body: 'Your procedure has changed.',
        requiresAcknowledgement: true,
        subject: 'Procedure change'
      });

      assert.equal(record.expectedRecipientCount, 1);

      const rows = await firestore
        .collection('organizations')
        .doc(TENANT)
        .collection('announcements')
        .doc(record.announcementId)
        .collection('recipients')
        .get();

      assert.deepEqual(rows.docs.map((doc) => doc.id), [WORKER_TWO]);
    });

    it('lets a department admin address somebody in their own department', async () => {
      const record = await announcements.createAnnouncement(tokenFor(PRODUCTION_ADMIN), {
        audiences: [{ kind: 'PERSON', targetId: WORKER_ONE, targetName: 'Dev Worker' }],
        body: 'A word about the line.',
        requiresAcknowledgement: true,
        subject: 'Line note'
      });

      assert.equal(record.expectedRecipientCount, 1);
    });

    it('refuses a department admin somebody in another department', async () => {
      await assert.rejects(
        announcements.createAnnouncement(tokenFor(PRODUCTION_ADMIN), {
          audiences: [{ kind: 'PERSON', targetId: OUTSIDER, targetName: 'Fay Warehouse' }],
          body: 'Not mine to send.',
          requiresAcknowledgement: false,
          subject: 'Wrong person'
        }),
        /not allowed/i
      );
    });

    it('refuses a team lead singling somebody out', async () => {
      // Running a group is not the same as issuing a notice to one person.
      await assert.rejects(
        announcements.createAnnouncement(tokenFor(TEAM_LEAD), {
          audiences: [{ kind: 'PERSON', targetId: WORKER_ONE, targetName: 'Dev Worker' }],
          body: 'Not mine to send.',
          requiresAcknowledgement: false,
          subject: 'Singling out'
        }),
        /not allowed/i
      );
    });

    it('counts a person once when they are also in a chosen group', async () => {
      const record = await announcements.createAnnouncement(tokenFor(ORG_ADMIN), {
        audiences: [
          { kind: 'GROUP', targetId: 'group_line_a', targetName: 'Line A' },
          { kind: 'PERSON', targetId: WORKER_ONE, targetName: 'Dev Worker' }
        ],
        body: 'Overlapping again.',
        requiresAcknowledgement: false,
        subject: 'Overlap'
      });

      // Line A is Cara and Dev. Naming Dev as well adds nobody.
      assert.equal(record.expectedRecipientCount, 2);
    });
  });

  describe('the count shown before sending', () => {
    it('matches what actually gets sent', async () => {
      // The number on the button and the number of people who receive it must
      // be the same number, or the confirmation step is a lie.
      const audiences = [
        { kind: 'DEPARTMENT' as const, targetId: 'dept_production', targetName: 'Production' },
        { kind: 'GROUP' as const, targetId: 'group_line_a', targetName: 'Line A' }
      ];

      const preview = await announcements.previewAnnouncementAudience(tokenFor(ORG_ADMIN), audiences);
      const record = await announcements.createAnnouncement(tokenFor(ORG_ADMIN), {
        audiences,
        body: 'Preview must match.',
        requiresAcknowledgement: false,
        subject: 'Preview check'
      });

      assert.equal(preview.recipientCount, record.expectedRecipientCount);
    });

    it('says nobody before anything is chosen', async () => {
      const preview = await announcements.previewAnnouncementAudience(tokenFor(ORG_ADMIN), []);

      assert.equal(preview.recipientCount, 0);
    });

    it('refuses to count an audience the sender may not reach', async () => {
      await assert.rejects(
        announcements.previewAnnouncementAudience(tokenFor(PRODUCTION_ADMIN), [
          { kind: 'DEPARTMENT', targetId: 'dept_warehouse', targetName: 'Warehouse' }
        ]),
        /not allowed/i
      );
    });
  });

  describe('the groups a sender may address', () => {
    it('shows an Org Admin every group, including ones they are not in', async () => {
      // The chat list shows only groups you are in, because a group chat you
      // are not in is one you cannot read. Addressing one is a different act.
      const groups = await announcements.listAnnouncementAudienceGroups(tokenFor(ORG_ADMIN));

      assert.ok(
        groups.some((group) => group.groupId === 'group_line_a'),
        'an Org Admin runs the company and may address any of its groups'
      );
    });

    it('shows a department admin the groups in their own department', async () => {
      await firestore
        .collection('organizations')
        .doc(TENANT)
        .collection('groups')
        .doc('group_warehouse_only')
        .set({
          autoMembershipDepartmentId: null,
          departmentId: 'dept_warehouse',
          memberPolicy: 'EXPLICIT',
          name: 'Warehouse only',
          status: 'ACTIVE'
        });

      const groups = await announcements.listAnnouncementAudienceGroups(tokenFor(PRODUCTION_ADMIN));

      assert.ok(groups.some((group) => group.groupId === 'group_line_a'));
      assert.ok(
        !groups.some((group) => group.groupId === 'group_warehouse_only'),
        'and not another department\'s'
      );
    });

    it('shows a team lead only the groups they are actually in', async () => {
      const groups = await announcements.listAnnouncementAudienceGroups(tokenFor(TEAM_LEAD));

      assert.deepEqual(groups.map((group) => group.groupId), ['group_line_a']);
    });

    it('counts the members the same way the send will', async () => {
      const groups = await announcements.listAnnouncementAudienceGroups(tokenFor(ORG_ADMIN));
      const lineA = groups.find((group) => group.groupId === 'group_line_a');

      // A picker that promises twelve people and sends to two is worse than
      // one that says nothing.
      assert.equal(lineA?.memberCount, 2);
    });
  });

  describe('what the sender can see', () => {
    it('shows a sender their own announcement even when they were not a recipient', async () => {
      // An Org Admin announcing to a group they are not in used to lose sight
      // of it entirely: their own notice, and its counts, were invisible.
      const record = await announcements.createAnnouncement(tokenFor(ORG_ADMIN), {
        audiences: [{ kind: 'GROUP', targetId: 'group_line_a', targetName: 'Line A' }],
        body: 'Line A only.',
        requiresAcknowledgement: true,
        subject: 'Line A notice'
      });

      const mine = await announcements.listAnnouncementsForPerson(tokenFor(ORG_ADMIN));
      const found = mine.find((entry) => entry.announcementId === record.announcementId);

      assert.ok(found, 'a sender must be able to see what they sent');
      assert.equal(found?.myStatus, null, 'and it is not something they must confirm');
    });

    it('still hides an announcement from somebody it was never sent to', async () => {
      const record = await announcements.createAnnouncement(tokenFor(TEAM_LEAD), {
        audiences: [{ kind: 'GROUP', targetId: 'group_line_a', targetName: 'Line A' }],
        body: 'Line A only.',
        requiresAcknowledgement: false,
        subject: 'Line A only'
      });

      const theirs = await announcements.listAnnouncementsForPerson(tokenFor(OUTSIDER));

      assert.ok(!theirs.some((entry) => entry.announcementId === record.announcementId));
    });
  });

  describe('closing the loop', () => {
    it('marks the moment everybody has confirmed, exactly once', async () => {
      const record = await announcements.createAnnouncement(tokenFor(ORG_ADMIN), {
        audiences: [{ kind: 'PERSON', targetId: WORKER_ONE, targetName: 'Dev Worker' }],
        body: 'Just you.',
        requiresAcknowledgement: true,
        subject: 'One person'
      });

      const ref = firestore
        .collection('organizations')
        .doc(TENANT)
        .collection('announcements')
        .doc(record.announcementId);

      assert.equal((await ref.get()).data()?.everyoneConfirmedNotifiedAtMs, undefined);

      await announcements.acknowledgeAnnouncement(tokenFor(WORKER_ONE), record.announcementId);

      const firstMark = (await ref.get()).data()?.everyoneConfirmedNotifiedAtMs;

      assert.ok(firstMark, 'the sender is told once everybody has confirmed');

      // Confirming again must not mark it a second time.
      await announcements.acknowledgeAnnouncement(tokenFor(WORKER_ONE), record.announcementId);

      assert.equal((await ref.get()).data()?.everyoneConfirmedNotifiedAtMs, firstMark);
    });

    it('says nothing while somebody has still not confirmed', async () => {
      const record = await sendToEveryone();

      await announcements.acknowledgeAnnouncement(tokenFor(WORKER_ONE), record.announcementId);

      const after = await firestore
        .collection('organizations')
        .doc(TENANT)
        .collection('announcements')
        .doc(record.announcementId)
        .get();

      assert.equal(after.data()?.everyoneConfirmedNotifiedAtMs, undefined);
    });
  });

  describe('what it says', () => {
    it('keeps the words, so a reader can actually read them', async () => {
      // Without this the app asks somebody to confirm having read something it
      // never showed them, and the record would not survive a question.
      const record = await sendToEveryone();

      assert.equal(record.body, 'Allergen change on line 3 from Monday.');
    });

    it('is gone once retention removes it, not merely marked as removed', async () => {
      const record = await sendToEveryone();

      await announcements.removeAnnouncementBody(TENANT, record.announcementId);

      const after = await firestore
        .collection('organizations')
        .doc(TENANT)
        .collection('announcements')
        .doc(record.announcementId)
        .get();
      const data = after.data() as { body: string; bodyRemovedAtMs: number | null };

      assert.equal(data.body, '', 'the words must actually be gone');
      assert.ok(data.bodyRemovedAtMs);
    });
  });

  describe('legal hold', () => {
    it('refuses to remove the words while a hold covers the company (rule 5.3)', async () => {
      const record = await sendToEveryone();

      await holds.applyLegalHold({
        actorUid: ORG_ADMIN,
        caseId: 'CASE-2026-11',
        description: 'Regulator request into the March allergen incident.',
        tenantId: TENANT
      });

      await assert.rejects(
        announcements.removeAnnouncementBody(TENANT, record.announcementId),
        /CASE-2026-11/,
        'a retention rule must not destroy what a court has asked to be kept'
      );

      const after = await firestore
        .collection('organizations')
        .doc(TENANT)
        .collection('announcements')
        .doc(record.announcementId)
        .get();

      assert.equal((after.data() as { bodyRemovedAtMs: number | null }).bodyRemovedAtMs, null);
    });

    it('refuses when the hold names one recipient among thousands', async () => {
      const record = await sendToEveryone();

      await holds.applyLegalHold({
        actorUid: ORG_ADMIN,
        caseId: 'CASE-2026-12',
        custodianUids: [WORKER_TWO],
        description: 'Claim brought by one employee.',
        tenantId: TENANT
      });

      await assert.rejects(
        announcements.removeAnnouncementBody(TENANT, record.announcementId),
        /CASE-2026-12/
      );
    });

    it('allows removal when the hold names nobody on this announcement', async () => {
      const record = await announcements.createAnnouncement(tokenFor(TEAM_LEAD), {
        audiences: [{ kind: 'GROUP', targetId: 'group_line_a', targetName: 'Line A' }],
        body: 'Line A only.',
        requiresAcknowledgement: false,
        subject: 'Line A'
      });

      // The custodian is in the warehouse, and was never sent this.
      await holds.applyLegalHold({
        actorUid: ORG_ADMIN,
        caseId: 'CASE-2026-13',
        custodianUids: [OUTSIDER],
        description: 'Unrelated matter.',
        tenantId: TENANT
      });

      await announcements.removeAnnouncementBody(TENANT, record.announcementId);

      const after = await firestore
        .collection('organizations')
        .doc(TENANT)
        .collection('announcements')
        .doc(record.announcementId)
        .get();

      assert.ok(
        (after.data() as { bodyRemovedAtMs: number | null }).bodyRemovedAtMs,
        'a hold on somebody unrelated must not freeze everything'
      );
    });
  });

  describe('reminders', () => {
    it('allows one, then refuses another the same day', async () => {
      const record = await sendToEveryone();
      const now = Date.now();

      assert.equal(announcements.canSendReminder({ ...record, state: 'SENT' }, now), true);
      assert.equal(
        announcements.canSendReminder({ ...record, lastReminderAtMs: now, state: 'SENT' }, now + 60_000),
        false
      );
      assert.equal(
        announcements.canSendReminder(
          { ...record, lastReminderAtMs: now, state: 'SENT' },
          now + 25 * 60 * 60 * 1000
        ),
        true
      );
    });

    it('does not chase people once everybody has acknowledged', async () => {
      const record = await sendToEveryone();

      assert.equal(
        announcements.canSendReminder(
          { ...record, acknowledgedCount: record.expectedRecipientCount, state: 'SENT' },
          Date.now()
        ),
        false
      );
    });
  });

  describe('sending at scale', () => {
    it('finishes an interrupted send instead of telling half the company', async () => {
      const record = await sendToEveryone();

      // Simulate a crash partway: two rows written, the rest lost, the job
      // still marked as sending.
      const rows = await firestore
        .collection('organizations')
        .doc(TENANT)
        .collection('announcements')
        .doc(record.announcementId)
        .collection('recipients')
        .get();

      await Promise.all(rows.docs.slice(2).map((doc) => doc.ref.delete()));
      await firestore
        .collection('organizations')
        .doc(TENANT)
        .collection('announcements')
        .doc(record.announcementId)
        .update({ deliveredCount: 2, state: 'SENDING' });

      const everybody = await firestore
        .collection('organizations')
        .doc(TENANT)
        .collection('users')
        .get();

      await announcements.fanOutAnnouncement(
        TENANT,
        record.announcementId,
        everybody.docs.map((doc) => ({
          acknowledgedAtMs: null,
          deliveredAtMs: null,
          departmentId: (doc.data() as { departmentId?: string }).departmentId || null,
          displayName: String((doc.data() as { displayName?: string }).displayName || ''),
          readAtMs: null,
          status: 'DELIVERED' as const,
          uid: doc.id
        }))
      );

      const after = await firestore
        .collection('organizations')
        .doc(TENANT)
        .collection('announcements')
        .doc(record.announcementId)
        .get();
      const finalRows = await firestore
        .collection('organizations')
        .doc(TENANT)
        .collection('announcements')
        .doc(record.announcementId)
        .collection('recipients')
        .get();

      assert.equal((after.data() as { state: string }).state, 'SENT');
      assert.equal(finalRows.size, 6, 'the resumed send must reach everybody');
      assert.equal(
        (after.data() as { deliveredCount: number }).deliveredCount,
        6,
        'and the count must not double-count the rows that were already there'
      );
    });
  });
});
