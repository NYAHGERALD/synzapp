import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

/**
 * Actions, run for real against a Firestore emulator.
 *
 * Every rule in the Create Action plan has a test here. These seed real people
 * and real groups, raise real actions and read back what actually happened.
 * Nothing here asserts that the source contains a word.
 */

const EMULATOR_PROJECT_ID = 'synzapp-rules-test';
const TENANT = 'tenant_actions';

const ORG_ADMIN = 'user_org_admin';
const MAINTENANCE_ADMIN = 'user_maintenance_admin';
const OPERATOR = 'user_operator';
const FITTER = 'user_fitter';
const SECOND_FITTER = 'user_second_fitter';
const OUTSIDER = 'user_outsider';

const MAINTENANCE_GROUP = 'group_maintenance';
const SOURCE_CHAT = 'chat_line_five';

let firestore: typeof import('../src/config/firebaseAdmin.js')['firestore'];
let actions: typeof import('../src/services/actionService.js');
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

async function raiseAction(overrides: Record<string, unknown> = {}) {
  return actions.createAction(tokenFor(OPERATOR), {
    priority: 'HIGH',
    responsibleGroupId: MAINTENANCE_GROUP,
    sourceChatId: SOURCE_CHAT,
    sourceChatName: 'Line 5',
    sourceMessageId: 'message_1',
    title: 'Issue with tortillas on line 5',
    ...overrides
  } as Parameters<typeof actions.createAction>[1]);
}

describe('actions, run against real data', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, () => {
  beforeEach(async () => {
    process.env.FIREBASE_PROJECT_ID ||= EMULATOR_PROJECT_ID;
    process.env.FIREBASE_STORAGE_BUCKET ||= `${EMULATOR_PROJECT_ID}.appspot.com`;

    const admin = await import('../src/config/firebaseAdmin.js');
    firestore = admin.firestore;
    actions = await import('../src/services/actionService.js');
    holds = await import('../src/services/legalHoldService.js');

    const existingHolds = await firestore
      .collection('tenants')
      .doc(TENANT)
      .collection('legalHolds')
      .listDocuments();

    await Promise.all(existingHolds.map((doc) => doc.delete()));

    const identities = await firestore.collection('identityDirectory').listDocuments();
    await Promise.all(identities.map((doc) => doc.delete()));
    await firestore.recursiveDelete(firestore.collection('organizations').doc(TENANT));

    await seedPerson({ departmentId: 'dept_production', displayName: 'Ada Org', role: 'ORG_ADMIN', uid: ORG_ADMIN });
    await seedPerson({
      departmentId: 'dept_maintenance',
      displayName: 'Ben Maintenance',
      role: 'DEPT_ADMIN',
      uid: MAINTENANCE_ADMIN
    });
    await seedPerson({ departmentId: 'dept_production', displayName: 'Cara Operator', role: 'EMPLOYEE', uid: OPERATOR });
    await seedPerson({ departmentId: 'dept_maintenance', displayName: 'Dev Fitter', role: 'EMPLOYEE', uid: FITTER });
    await seedPerson({
      departmentId: 'dept_maintenance',
      displayName: 'Eli Fitter',
      role: 'EMPLOYEE',
      uid: SECOND_FITTER
    });
    await seedPerson({ departmentId: 'dept_warehouse', displayName: 'Fay Outside', role: 'EMPLOYEE', uid: OUTSIDER });

    const group = firestore
      .collection('organizations')
      .doc(TENANT)
      .collection('groups')
      .doc(MAINTENANCE_GROUP);

    await group.set({
      autoMembershipDepartmentId: null,
      departmentId: 'dept_maintenance',
      memberPolicy: 'EXPLICIT',
      name: 'Maintenance'
    });
    await group.collection('members').doc(FITTER).set({ status: 'ACTIVE' });
    await group.collection('members').doc(SECOND_FITTER).set({ status: 'ACTIVE' });
  });

  it('raises an action from a message and keeps what it came from', async () => {
    const action = await raiseAction();

    assert.equal(action.title, 'Issue with tortillas on line 5');
    assert.equal(action.status, 'OPEN');
    assert.equal(action.sourceChatId, SOURCE_CHAT);
    assert.equal(action.sourceMessageId, 'message_1');
    assert.equal(action.createdByName, 'Cara Operator');
  });

  it('names the responsible group from the group record, not from the request', async () => {
    const action = await raiseAction({ responsibleGroupName: 'Not this name' });

    assert.equal(action.responsibleGroupName, 'Maintenance');
    assert.equal(action.responsibleDepartmentId, 'dept_maintenance');
  });

  it('allows an action with no named person, owned by the group', async () => {
    const action = await raiseAction();

    assert.equal(action.responsiblePersonUid, null);
    assert.equal(action.responsibleGroupId, MAINTENANCE_GROUP);
  });

  it('records a named person when one is chosen', async () => {
    const action = await raiseAction({ responsiblePersonUid: FITTER });

    assert.equal(action.responsiblePersonUid, FITTER);
    assert.equal(action.responsiblePersonName, 'Dev Fitter');
  });

  it('refuses a named person who is not in the organization', async () => {
    await assert.rejects(() => raiseAction({ responsiblePersonUid: 'user_ghost' }), /not found/i);
  });

  it('refuses a group that does not exist', async () => {
    await assert.rejects(() => raiseAction({ responsibleGroupId: 'group_ghost' }), /not found/i);
  });

  it('writes a created event so the history starts at the beginning', async () => {
    const action = await raiseAction();
    const detail = await actions.getAction(tokenFor(OPERATOR), action.actionId);

    assert.equal(detail.events.length, 1);
    assert.equal(detail.events[0].kind, 'CREATED');
    assert.equal(detail.events[0].actorUid, OPERATOR);
  });

  it('counts a new action as pending on its group', async () => {
    await raiseAction();

    const counts = await actions.getActionCounts(tokenFor(FITTER), MAINTENANCE_GROUP);

    assert.equal(counts.pending, 1);
    assert.equal(counts.unverified, 0);
  });

  it('lets a member of the responsible group start the work', async () => {
    const action = await raiseAction();
    const updated = await actions.changeActionStatus(tokenFor(FITTER), {
      actionId: action.actionId,
      status: 'IN_PROGRESS'
    });

    assert.equal(updated.status, 'IN_PROGRESS');
    assert.ok(updated.startedAtMs);
  });

  it('refuses somebody outside the responsible group', async () => {
    const action = await raiseAction();

    await assert.rejects(() => actions.changeActionStatus(tokenFor(OUTSIDER), {
      actionId: action.actionId,
      status: 'IN_PROGRESS'
    }), /cannot change/i);
  });

  it('insists on a reason before an action can be blocked', async () => {
    const action = await raiseAction();

    await assert.rejects(() => actions.changeActionStatus(tokenFor(FITTER), {
      actionId: action.actionId,
      status: 'BLOCKED'
    }), /waiting on/i);
  });

  it('records what a blocked action is waiting on', async () => {
    const action = await raiseAction();
    const blocked = await actions.changeActionStatus(tokenFor(FITTER), {
      actionId: action.actionId,
      blockedReason: 'Waiting on a drive belt',
      status: 'BLOCKED'
    });

    assert.equal(blocked.status, 'BLOCKED');
    assert.equal(blocked.blockedReason, 'Waiting on a drive belt');
  });

  it('keeps a blocked action in the pending count, because it is not done', async () => {
    const action = await raiseAction();

    await actions.changeActionStatus(tokenFor(FITTER), {
      actionId: action.actionId,
      blockedReason: 'Waiting on a drive belt',
      status: 'BLOCKED'
    });

    const counts = await actions.getActionCounts(tokenFor(FITTER), MAINTENANCE_GROUP);

    assert.equal(counts.pending, 1);
  });

  it('records who completed it and their note', async () => {
    const action = await raiseAction();
    const done = await actions.changeActionStatus(tokenFor(FITTER), {
      actionId: action.actionId,
      note: 'Belt replaced and line restarted',
      status: 'DONE'
    });

    assert.equal(done.status, 'DONE');
    assert.equal(done.completedByUid, FITTER);
    assert.equal(done.completedByName, 'Dev Fitter');
    assert.equal(done.completionNote, 'Belt replaced and line restarted');
    assert.ok(done.completedAtMs);
  });

  it('moves a completed action out of pending and into unverified', async () => {
    const action = await raiseAction();

    await actions.changeActionStatus(tokenFor(FITTER), {
      actionId: action.actionId,
      status: 'DONE'
    });

    const counts = await actions.getActionCounts(tokenFor(FITTER), MAINTENANCE_GROUP);

    assert.equal(counts.pending, 0);
    assert.equal(counts.unverified, 1);
  });

  it('refuses to reach VERIFIED through an ordinary status change', async () => {
    const action = await raiseAction();

    await assert.rejects(() => actions.changeActionStatus(tokenFor(FITTER), {
      actionId: action.actionId,
      status: 'VERIFIED'
    }), /use verify/i);
  });

  it('refuses to verify an action that is not done', async () => {
    const action = await raiseAction();

    await assert.rejects(
      () => actions.verifyAction(tokenFor(OPERATOR), action.actionId),
      /only a completed action/i
    );
  });

  it('never lets the person who did the work verify it', async () => {
    const action = await raiseAction();

    await actions.changeActionStatus(tokenFor(FITTER), {
      actionId: action.actionId,
      status: 'DONE'
    });

    await assert.rejects(
      () => actions.verifyAction(tokenFor(FITTER), action.actionId),
      /cannot verify/i
    );
  });

  it('lets the person who raised it verify it', async () => {
    const action = await raiseAction();

    await actions.changeActionStatus(tokenFor(FITTER), {
      actionId: action.actionId,
      status: 'DONE'
    });

    const verified = await actions.verifyAction(tokenFor(OPERATOR), action.actionId);

    assert.equal(verified.status, 'VERIFIED');
    assert.equal(verified.verifiedByUid, OPERATOR);
    assert.ok(verified.verifiedAtMs);
  });

  it('clears the unverified count once verified', async () => {
    const action = await raiseAction();

    await actions.changeActionStatus(tokenFor(FITTER), { actionId: action.actionId, status: 'DONE' });
    await actions.verifyAction(tokenFor(OPERATOR), action.actionId);

    const counts = await actions.getActionCounts(tokenFor(FITTER), MAINTENANCE_GROUP);

    assert.equal(counts.pending, 0);
    assert.equal(counts.unverified, 0);
  });

  it('refuses to change a verified action', async () => {
    const action = await raiseAction();

    await actions.changeActionStatus(tokenFor(FITTER), { actionId: action.actionId, status: 'DONE' });
    await actions.verifyAction(tokenFor(OPERATOR), action.actionId);

    await assert.rejects(() => actions.changeActionStatus(tokenFor(FITTER), {
      actionId: action.actionId,
      status: 'IN_PROGRESS'
    }), /verified/i);
  });

  it('keeps the whole history, in order', async () => {
    const action = await raiseAction();

    await actions.changeActionStatus(tokenFor(FITTER), { actionId: action.actionId, status: 'IN_PROGRESS' });
    await actions.changeActionStatus(tokenFor(FITTER), { actionId: action.actionId, status: 'DONE' });
    await actions.verifyAction(tokenFor(OPERATOR), action.actionId);

    const detail = await actions.getAction(tokenFor(OPERATOR), action.actionId);

    assert.deepEqual(detail.events.map((event) => event.kind), [
      'CREATED',
      'STATUS_CHANGED',
      'STATUS_CHANGED',
      'VERIFIED'
    ]);
  });

  it('lists the actions for a group, newest first', async () => {
    await raiseAction({ title: 'First fault', sourceMessageId: 'message_1' });
    await raiseAction({ title: 'Second fault', sourceMessageId: 'message_2' });

    const page = await actions.listActions(tokenFor(FITTER), { groupId: MAINTENANCE_GROUP });

    assert.equal(page.actions.length, 2);
    assert.equal(page.actions[0].title, 'Second fault');
  });

  it('lists the actions raised from one chat', async () => {
    await raiseAction({ sourceMessageId: 'message_1' });
    await raiseAction({ sourceChatId: 'chat_other', sourceMessageId: 'message_2' });

    const page = await actions.listActions(tokenFor(OPERATOR), { chatId: SOURCE_CHAT });

    assert.equal(page.actions.length, 1);
    assert.equal(page.actions[0].sourceChatId, SOURCE_CHAT);
  });

  it('retention removes the words but never the record of who did what', async () => {
    const action = await raiseAction();

    await actions.changeActionStatus(tokenFor(FITTER), {
      actionId: action.actionId,
      note: 'Belt replaced',
      status: 'DONE'
    });
    await actions.verifyAction(tokenFor(OPERATOR), action.actionId);
    await actions.removeActionBody(TENANT, action.actionId);

    const detail = await actions.getAction(tokenFor(OPERATOR), action.actionId);

    assert.equal(detail.action.title, '');
    assert.equal(detail.action.completionNote, null);
    assert.equal(detail.attachments.length, 0);
    assert.ok(detail.action.bodyRemovedAtMs);
    // The part a company actually needs survives.
    assert.equal(detail.action.completedByUid, FITTER);
    assert.equal(detail.action.verifiedByUid, OPERATOR);
    assert.equal(detail.events.length, 3);
  });

  it('a legal hold stops retention removing an action', async () => {
    const action = await raiseAction();

    await holds.applyLegalHold({
      actorUid: ORG_ADMIN,
      caseId: 'CASE-2026-11',
      custodianUids: [OPERATOR],
      description: 'Regulator asked for line 5 records',
      tenantId: TENANT
    });

    await assert.rejects(
      () => actions.removeActionBody(TENANT, action.actionId),
      /legal hold/i
    );
  });

  it('refuses an upload larger than the limit', async () => {
    await assert.rejects(() => actions.createActionUpload(tokenFor(OPERATOR), {
      contentType: 'image/jpeg',
      kind: 'image',
      sizeBytes: 60 * 1024 * 1024
    }), /too large/i);
  });

  it('refuses a file whose type does not match what it claims to be', async () => {
    await assert.rejects(() => actions.createActionUpload(tokenFor(OPERATOR), {
      contentType: 'application/zip',
      kind: 'image',
      sizeBytes: 1024
    }), /does not look like a photo/i);
  });

  it('reserves an upload without the client choosing where it lands', async () => {
    const ticket = await actions.createActionUpload(tokenFor(OPERATOR), {
      contentType: 'image/jpeg',
      kind: 'image',
      sizeBytes: 2048
    });

    assert.ok(ticket.attachmentId);
    assert.ok(ticket.uploadUrl.startsWith('http'));
    assert.ok(ticket.expiresAtMs > Date.now());
  });

  it('refuses an attachment id that was never reserved', async () => {
    await assert.rejects(
      () => raiseAction({ attachmentIds: ['not_a_real_ticket'] }),
      /not recognised/i
    );
  });

  it('refuses an attachment somebody else reserved', async () => {
    const ticket = await actions.createActionUpload(tokenFor(FITTER), {
      contentType: 'image/jpeg',
      kind: 'image',
      sizeBytes: 2048
    });

    // Raised by the operator, using a ticket the fitter reserved.
    await assert.rejects(
      () => raiseAction({ attachmentIds: [ticket.attachmentId] }),
      /belongs to somebody else/i
    );
  });

  it('refuses an attachment whose file never finished uploading', async () => {
    const ticket = await actions.createActionUpload(tokenFor(OPERATOR), {
      contentType: 'image/jpeg',
      kind: 'image',
      sizeBytes: 2048
    });

    await assert.rejects(
      () => raiseAction({ attachmentIds: [ticket.attachmentId] }),
      /did not finish uploading/i
    );
  });

  it('refuses a removed employee raising an action', async () => {
    await seedPerson({
      departmentId: 'dept_production',
      displayName: 'Cara Operator',
      role: 'EMPLOYEE',
      status: 'REMOVED',
      uid: OPERATOR
    });

    await assert.rejects(() => raiseAction(), /cannot create actions/i);
  });
});
