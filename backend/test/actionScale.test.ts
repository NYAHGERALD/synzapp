import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

/**
 * Actions at the size a real plant reaches.
 *
 * A maintenance group in a factory accumulates thousands of actions over a
 * year. The budgets here are the ones in section 14 of the Create Action plan.
 * They exist so that a change which turns a counter read into a row count
 * fails here rather than on somebody's phone.
 */

const EMULATOR_PROJECT_ID = 'synzapp-rules-test';
const TENANT = 'tenant_action_scale';
const GROUP = 'group_maintenance_scale';
const OPERATOR = 'user_scale_operator';
const FITTER = 'user_scale_fitter';
const ACTION_COUNT = 5000;

let firestore: typeof import('../src/config/firebaseAdmin.js')['firestore'];
let actions: typeof import('../src/services/actionService.js');

function tokenFor(uid: string) {
  return { uid } as unknown as import('firebase-admin/auth').DecodedIdToken;
}

async function timed<T>(run: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const startedAt = Date.now();
  const value = await run();

  return { ms: Date.now() - startedAt, value };
}

describe('actions at scale', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, () => {
  before(async () => {
    process.env.FIREBASE_PROJECT_ID ||= EMULATOR_PROJECT_ID;
    process.env.FIREBASE_STORAGE_BUCKET ||= `${EMULATOR_PROJECT_ID}.appspot.com`;

    const admin = await import('../src/config/firebaseAdmin.js');
    firestore = admin.firestore;
    actions = await import('../src/services/actionService.js');

    await firestore.recursiveDelete(firestore.collection('organizations').doc(TENANT));

    for (const uid of [OPERATOR, FITTER]) {
      await firestore.collection('identityDirectory').doc(uid).set({
        departmentId: 'dept_maintenance',
        permissions: [],
        profileComplete: true,
        role: 'EMPLOYEE',
        status: 'ACTIVE',
        tenantId: TENANT
      });
      await firestore
        .collection('organizations')
        .doc(TENANT)
        .collection('users')
        .doc(uid)
        .set({ departmentId: 'dept_maintenance', displayName: uid, role: 'EMPLOYEE', status: 'ACTIVE' });
    }

    const group = firestore.collection('organizations').doc(TENANT).collection('groups').doc(GROUP);

    await group.set({
      autoMembershipDepartmentId: null,
      departmentId: 'dept_maintenance',
      memberPolicy: 'EXPLICIT',
      name: 'Maintenance'
    });
    await group.collection('members').doc(FITTER).set({ status: 'ACTIVE' });

    // Written straight to Firestore rather than through the service: this is
    // a year of history, not five thousand things somebody typed today.
    const collection = firestore.collection('organizations').doc(TENANT).collection('actions');
    let batch = firestore.batch();

    for (let index = 0; index < ACTION_COUNT; index += 1) {
      const ref = collection.doc();

      batch.set(ref, {
        actionId: ref.id,
        attachmentCount: 0,
        blockedReason: null,
        bodyRemovedAtMs: null,
        completedAtMs: null,
        completedByName: null,
        completedByUid: null,
        completionNote: null,
        createdAtMs: Date.now() - index * 1000,
        createdByName: 'Scale Operator',
        createdByUid: OPERATOR,
        dueAtMs: null,
        priority: 'MEDIUM',
        responsibleDepartmentId: 'dept_maintenance',
        responsibleGroupId: GROUP,
        responsibleGroupName: 'Maintenance',
        responsiblePersonName: null,
        responsiblePersonUid: null,
        sourceChatId: 'chat_scale',
        sourceChatName: 'Line 5',
        sourceDepartmentId: 'dept_maintenance',
        sourceMessageId: `message_${index}`,
        startedAtMs: null,
        status: 'OPEN',
        tenantId: TENANT,
        title: `Fault number ${index}`,
        updatedAtMs: Date.now(),
        verifiedAtMs: null,
        verifiedByName: null,
        verifiedByUid: null
      });

      if ((index + 1) % 400 === 0) {
        await batch.commit();
        batch = firestore.batch();
      }
    }

    await batch.commit();
    await group.set({ openActionCount: ACTION_COUNT, unverifiedActionCount: 0 }, { merge: true });
  });

  it(`opens the first page of ${ACTION_COUNT} actions inside the budget`, async () => {
    const { ms, value } = await timed(() =>
      actions.listActions(tokenFor(FITTER), { groupId: GROUP })
    );

    console.log(`    first page: ${ms}ms`);
    assert.equal(value.actions.length, 30);
    assert.ok(value.nextCursor, 'there should be more pages');
    assert.ok(ms < 200, `first page took ${ms}ms, budget is 200ms`);
  });

  it('returns the newest actions, not an arbitrary thirty', async () => {
    const page = await actions.listActions(tokenFor(FITTER), { groupId: GROUP });
    const timestamps = page.actions.map((action) => action.createdAtMs);
    const sorted = [...timestamps].sort((left, right) => right - left);

    assert.deepEqual(timestamps, sorted);
    assert.equal(page.actions[0].title, 'Fault number 0');
  });

  it('counts without reading five thousand rows', async () => {
    const { ms, value } = await timed(() => actions.getActionCounts(tokenFor(FITTER), GROUP));

    console.log(`    counts: ${ms}ms`);
    assert.equal(value.pending, ACTION_COUNT);
    assert.ok(ms < 50, `counts took ${ms}ms, budget is 50ms`);
  });

  it('raises a new action at full size without slowing down', async () => {
    const { ms, value } = await timed(() => actions.createAction(tokenFor(OPERATOR), {
      priority: 'HIGH',
      responsibleGroupId: GROUP,
      sourceChatId: 'chat_scale',
      sourceChatName: 'Line 5',
      sourceMessageId: 'message_new',
      title: 'One more fault'
    }));

    console.log(`    create: ${ms}ms`);
    assert.equal(value.status, 'OPEN');
    assert.ok(ms < 800, `create took ${ms}ms, budget is 800ms`);
  });
});
