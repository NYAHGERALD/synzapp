import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

/**
 * Compliance, run for real against a Firestore emulator.
 *
 * Written after a rule that named three people was found to delete everyone's
 * chats. That bug sat in plain sight through a full code audit, because the
 * tests around it asserted that the source *contained* certain text rather than
 * running it. A test that checks what code looks like can only confirm what its
 * author already believed.
 *
 * These seed real conversations, run the real services, and assert what
 * actually happens to real data.
 */

const EMULATOR_PROJECT_ID = 'synzapp-rules-test';
const TENANT_ID = 'tenant_compliance_integration';
const DAY_MS = 24 * 60 * 60 * 1000;

const ALICE = 'user_alice';
const BOB = 'user_bob';
const CARLA = 'user_carla';
const DAVE = 'user_dave';

let firestore: typeof import('../src/config/firebaseAdmin.js')['firestore'];
let evaluator: typeof import('../src/services/retentionEvaluatorService.js');
let simulation: typeof import('../src/services/retentionSimulationService.js');
let policies: typeof import('../src/services/retentionPolicyService.js');
let holds: typeof import('../src/services/legalHoldService.js');
let disposition: typeof import('../src/services/dispositionService.js');
let shredder: typeof import('../src/services/dispositionShredderService.js');
let search: typeof import('../src/services/complianceSearchService.js');
let explain: typeof import('../src/services/retentionExplainService.js');
let policyDocs: typeof import('../src/services/policyDocumentService.js');

describe('compliance, run against real data', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, () => {
  beforeEach(async () => {
    process.env.FIREBASE_PROJECT_ID ||= EMULATOR_PROJECT_ID;
    process.env.FIREBASE_STORAGE_BUCKET ||= `${EMULATOR_PROJECT_ID}.appspot.com`;

    const admin = await import('../src/config/firebaseAdmin.js');

    firestore = admin.firestore;
    evaluator = await import('../src/services/retentionEvaluatorService.js');
    simulation = await import('../src/services/retentionSimulationService.js');
    policies = await import('../src/services/retentionPolicyService.js');
    holds = await import('../src/services/legalHoldService.js');
    disposition = await import('../src/services/dispositionService.js');
    shredder = await import('../src/services/dispositionShredderService.js');
    search = await import('../src/services/complianceSearchService.js');
    explain = await import('../src/services/retentionExplainService.js');
    policyDocs = await import('../src/services/policyDocumentService.js');

    await clearAll();
    await seedConversations();
  });

  describe('a rule only touches the people it names', () => {
    it('leaves other people\'s chats completely alone', async () => {
      // The bug this file exists for. A rule for Alice must not queue Carla's
      // chat with Dave, no matter how old it is.
      await activePolicy({ scopeKind: 'user', scopeTargets: [ALICE] });
      await evaluator.evaluateTenantRetention({ tenantId: TENANT_ID });

      // The exact set, not just a count: Alice's two old conversations and
      // nothing else. Carla and Dave's chat is the one that must never appear.
      assert.deepEqual(
        (await queuedSubjectRefs()).sort(),
        ['directChat/alice_bob', 'group/old_group'],
        'a rule naming Alice must reach only the conversations Alice is in'
      );
    });

    it('covers a chat because the named person is in it, whoever wrote the messages', async () => {
      // Naming Bob must reach the Alice-Bob chat: what he received is his
      // record too.
      await activePolicy({ scopeKind: 'user', scopeTargets: [BOB] });
      await evaluator.evaluateTenantRetention({ tenantId: TENANT_ID });

      assert.ok((await queuedSubjectRefs()).includes('directChat/alice_bob'));
    });

    it('refuses to save a narrow rule that names nobody', async () => {
      // Better than tolerating it: a rule covering nobody is always a mistake,
      // and the dangerous reading — "no filter, therefore everything" — must
      // never become reachable.
      await assert.rejects(
        activePolicy({ scopeKind: 'user', scopeTargets: [] }),
        /at least one target/i
      );

      const summary = await evaluator.evaluateTenantRetention({ tenantId: TENANT_ID });

      assert.equal(summary.queued, 0);
    });

    it('leaves everyone alone when only one person is named', async () => {
      // Carla and Dave share no conversation with Bob, so a rule for Bob must
      // never touch them.
      await activePolicy({ scopeKind: 'user', scopeTargets: [BOB] });
      await evaluator.evaluateTenantRetention({ tenantId: TENANT_ID });

      assert.ok(!(await queuedSubjectRefs()).includes('directChat/carla_dave'));
    });

    it('an organization-wide rule reaches every old chat', async () => {
      await activePolicy({ scopeKind: 'organization', scopeTargets: [] });
      await evaluator.evaluateTenantRetention({ tenantId: TENANT_ID });

      const queued = await queuedSubjectRefs();

      assert.ok(queued.includes('directChat/alice_bob'));
      assert.ok(queued.includes('directChat/carla_dave'));
    });

    it('reaches group chats, not only direct ones', async () => {
      await activePolicy({ scopeKind: 'organization', scopeTargets: [] });
      await evaluator.evaluateTenantRetention({ tenantId: TENANT_ID });

      assert.ok((await queuedSubjectRefs()).includes('group/old_group'));
    });
  });

  describe('nothing expired is deleted', () => {
    it('leaves a recent chat alone', async () => {
      await activePolicy({ scopeKind: 'organization', scopeTargets: [] });
      await evaluator.evaluateTenantRetention({ tenantId: TENANT_ID });

      assert.ok(
        !(await queuedSubjectRefs()).includes('directChat/recent_chat'),
        'a chat inside the keep-for period must not be queued'
      );
    });

    it('a rule that only keeps never queues anything', async () => {
      await activePolicy({ action: 'retain', scopeKind: 'organization', scopeTargets: [] });

      const summary = await evaluator.evaluateTenantRetention({ tenantId: TENANT_ID });

      assert.equal(summary.queued, 0);
    });
  });

  describe('a legal hold outranks every rule', () => {
    it('withholds a chat the hold covers instead of queueing it', async () => {
      await activePolicy({ scopeKind: 'organization', scopeTargets: [] });
      await holds.applyLegalHold({
        actorUid: 'admin',
        caseId: 'CASE-1',
        custodianUids: [],
        description: 'Everything frozen',
        tenantId: TENANT_ID
      });

      const summary = await evaluator.evaluateTenantRetention({ tenantId: TENANT_ID });

      assert.equal(summary.queued, 0, 'a hold must stop every deletion');
      assert.ok(summary.withheld > 0);
      assert.deepEqual(await queuedSubjectRefs(), []);
    });
  });

  describe('a simulation predicts exactly what the real run does', () => {
    it('the count it promises is the count that actually gets queued', async () => {
      // If these ever disagree, an administrator activates a rule expecting one
      // thing and gets another.
      const draft = { action: 'delete' as const, durationDays: 30, scopeKind: 'user' as const, scopeTargets: [ALICE] };
      const predicted = await simulation.simulateRetentionPolicy({ ...draft, tenantId: TENANT_ID });

      await activePolicy(draft);
      const summary = await evaluator.evaluateTenantRetention({ tenantId: TENANT_ID });

      assert.equal(
        predicted.wouldDeleteNow,
        summary.queued,
        'the simulation must predict the real result'
      );
    });

    it('predicts nothing for a rule that names nobody', async () => {
      const predicted = await simulation.simulateRetentionPolicy({
        action: 'delete',
        durationDays: 30,
        scopeKind: 'user',
        scopeTargets: [],
        tenantId: TENANT_ID
      });

      assert.equal(predicted.wouldDeleteNow, 0);
    });

    it('counts what a hold protects, and promises no deletion', async () => {
      await holds.applyLegalHold({
        actorUid: 'admin',
        caseId: 'CASE-2',
        custodianUids: [],
        description: 'Frozen',
        tenantId: TENANT_ID
      });

      const predicted = await simulation.simulateRetentionPolicy({
        action: 'delete',
        durationDays: 30,
        scopeKind: 'organization',
        tenantId: TENANT_ID
      });

      assert.equal(predicted.wouldDeleteNow, 0);
      assert.ok(predicted.heldByLegalHold > 0);
    });

    it('writes nothing at all', async () => {
      const before = await countDocs();

      await simulation.simulateRetentionPolicy({
        action: 'delete',
        durationDays: 30,
        scopeKind: 'organization',
        tenantId: TENANT_ID
      });

      assert.deepEqual(await countDocs(), before, 'a simulation must change nothing');
    });
  });

  describe('a policy is never silently enforced', () => {
    it('a newly created policy queues nothing until it is switched on', async () => {
      await policies.saveRetentionPolicy({
        actorUid: 'admin',
        policy: {
          action: 'delete',
          durationDays: 30,
          name: 'Draft rule',
          scopeKind: 'organization',
          scopeTargets: []
        },
        tenantId: TENANT_ID
      });

      const summary = await evaluator.evaluateTenantRetention({ tenantId: TENANT_ID });

      assert.equal(summary.queued, 0, 'a policy must not act before it is activated');
    });
  });


  describe('explaining one conversation', () => {
    it('names the rule that decided the outcome', async () => {
      await activePolicy({ scopeKind: 'organization', scopeTargets: [] });

      const [chat] = await explain.explainConversationRetention({
        conversationIds: ['alice_bob'],
        tenantId: TENANT_ID
      });

      assert.equal(chat.conversationId, 'alice_bob');
      assert.equal(chat.governingPolicyName, 'Test rule');
      assert.ok(chat.steps.length > 0, 'the reasoning must be shown, not just the answer');
    });

    it('names the case freezing a conversation', async () => {
      await activePolicy({ scopeKind: 'organization', scopeTargets: [] });
      await holds.applyLegalHold({
        actorUid: 'admin',
        caseId: 'CASE-EXPLAIN',
        custodianUids: [],
        description: 'Frozen for explaining',
        tenantId: TENANT_ID
      });

      const [chat] = await explain.explainConversationRetention({
        conversationIds: ['alice_bob'],
        tenantId: TENANT_ID
      });

      assert.equal(chat.isOnHold, true);
      assert.equal(chat.blockingHoldCaseId, 'CASE-EXPLAIN');
    });

    it('says why a rule did NOT reach this conversation', async () => {
      // Asked as often as the opposite, and a list of only the matches cannot
      // answer it.
      await activePolicy({ scopeKind: 'user', scopeTargets: [ALICE] });

      const [chat] = await explain.explainConversationRetention({
        conversationIds: ['carla_dave'],
        tenantId: TENANT_ID
      });

      const rule = chat.rulesConsidered.find((candidate) => candidate.name === 'Test rule');

      assert.equal(rule?.applies, false);
      assert.match(rule?.reason || '', /Nobody in this chat is named/i);
    });

    it('shows people by name, not by identifier', async () => {
      const [chat] = await explain.explainConversationRetention({
        conversationIds: ['alice_bob'],
        tenantId: TENANT_ID
      });

      assert.equal(chat.participantNames.length, 2);
    });

    it('can answer for one person across their conversations', async () => {
      const forAlice = await explain.explainConversationRetention({
        custodianUid: ALICE,
        tenantId: TENANT_ID
      });

      const ids = forAlice.map((chat) => chat.conversationId).sort();

      assert.deepEqual(ids, ['alice_bob', 'old_group', 'recent_chat']);
    });
  });


  describe('policy versions, run against real storage', () => {
    it('a draft can be edited without creating a new version each save', async () => {
      // Otherwise the history fills with every intermediate save while somebody
      // is still writing, and becomes unusable.
      const first = await policyDocs.savePolicyDraft({
        body: 'A'.repeat(60), slug: 'privacy', summary: 'First attempt', title: 'Privacy'
      });
      const second = await policyDocs.savePolicyDraft({
        body: 'B'.repeat(60), slug: 'privacy', summary: 'Second attempt', title: 'Privacy'
      });

      assert.equal(first.version, second.version);
      assert.equal((await policyDocs.listPolicyVersions('privacy')).length, 1);
    });

    it('nothing is public until it is published', async () => {
      await policyDocs.savePolicyDraft({
        body: 'C'.repeat(60), slug: 'privacy', summary: 'Draft only', title: 'Privacy'
      });

      assert.equal(await policyDocs.getPublishedPolicy('privacy'), null);
    });

    it('publishing makes it public and records who did it', async () => {
      await policyDocs.savePolicyDraft({
        body: 'D'.repeat(60), slug: 'privacy', summary: 'Ready', title: 'Privacy'
      });
      await policyDocs.publishPolicyDraft({ publishedByEmail: 'gcnyah@synzapp.com', slug: 'privacy' });

      const published = await policyDocs.getPublishedPolicy('privacy');

      assert.ok(published);
      assert.equal(published.state, 'PUBLISHED');
      assert.equal(published.publishedByEmail, 'gcnyah@synzapp.com');
      assert.ok((published.publishedAtMs || 0) > 0);
    });

    it('a published version is never changed by later work', async () => {
      // The whole reason to keep versions is to prove what was in force on a
      // given day. A version that can change afterwards proves nothing.
      await policyDocs.savePolicyDraft({
        body: 'ORIGINAL '.repeat(10), slug: 'privacy', summary: 'v1', title: 'Privacy'
      });
      const v1 = await policyDocs.publishPolicyDraft({
        publishedByEmail: 'gcnyah@synzapp.com', slug: 'privacy'
      });

      await policyDocs.savePolicyDraft({
        body: 'REPLACEMENT '.repeat(10), slug: 'privacy', summary: 'v2', title: 'Privacy'
      });
      await policyDocs.publishPolicyDraft({ publishedByEmail: 'gcnyah@synzapp.com', slug: 'privacy' });

      const stillV1 = await policyDocs.getPolicyVersion('privacy', v1.version);

      assert.ok(stillV1);
      assert.match(stillV1.body, /ORIGINAL/);
      assert.doesNotMatch(stillV1.body, /REPLACEMENT/);
    });

    it('the newest published version is the one shown', async () => {
      await policyDocs.savePolicyDraft({
        body: 'FIRST '.repeat(12), slug: 'terms', summary: 'v1', title: 'Terms'
      });
      await policyDocs.publishPolicyDraft({ publishedByEmail: 'a@synzapp.com', slug: 'terms' });
      await policyDocs.savePolicyDraft({
        body: 'SECOND '.repeat(12), slug: 'terms', summary: 'v2', title: 'Terms'
      });
      await policyDocs.publishPolicyDraft({ publishedByEmail: 'a@synzapp.com', slug: 'terms' });

      const published = await policyDocs.getPublishedPolicy('terms');

      assert.match(published?.body || '', /SECOND/);
      assert.equal((await policyDocs.listPolicyVersions('terms')).length, 2);
    });

    it('privacy and terms keep separate histories', async () => {
      await policyDocs.savePolicyDraft({
        body: 'P '.repeat(30), slug: 'privacy', summary: 'p', title: 'Privacy'
      });
      await policyDocs.publishPolicyDraft({ publishedByEmail: 'a@synzapp.com', slug: 'privacy' });

      assert.equal((await policyDocs.listPolicyVersions('terms')).length, 0);
      assert.equal(await policyDocs.getPublishedPolicy('terms'), null);
    });
  });

  describe('destruction refuses to run unless everything is right', () => {
    it('does nothing at all until an organization switches it on', async () => {
      // Destruction is off per organization by default. This is the last guard
      // between a mistaken policy and permanent loss.
      await queueApprovedItem('directChat/alice_bob');

      const summary = await shredder.runDispositionShredder({ tenantId: TENANT_ID });

      assert.equal(summary.skippedDisabled, true);
      assert.equal(summary.purged, 0);
      assert.ok(await conversationExists('directChats', 'alice_bob'));
    });

    it('waits out the grace period even after approval', async () => {
      await shredder.setDispositionShreddingEnabled({ enabled: true, tenantId: TENANT_ID });
      await queueApprovedItem('directChat/alice_bob', Date.now());

      const summary = await shredder.runDispositionShredder({ tenantId: TENANT_ID });

      assert.equal(summary.purged, 0);
      assert.ok(summary.inGrace > 0, 'a just-approved batch must sit in grace, not be destroyed');
      assert.ok(await conversationExists('directChats', 'alice_bob'));
    });

    it('a hold applied after approval still stops the destruction', async () => {
      // The most important guarantee in the product: a freeze wins even at the
      // last moment, after somebody already approved the deletion.
      await shredder.setDispositionShreddingEnabled({ enabled: true, tenantId: TENANT_ID });
      await queueApprovedItem('directChat/alice_bob', Date.now() - 30 * DAY_MS);
      await holds.applyLegalHold({
        actorUid: 'admin',
        caseId: 'CASE-LATE',
        custodianUids: [],
        description: 'Applied after approval',
        tenantId: TENANT_ID
      });

      const summary = await shredder.runDispositionShredder({ tenantId: TENANT_ID });

      assert.equal(summary.purged, 0);
      assert.ok(summary.stoppedByHold > 0);
      assert.ok(
        await conversationExists('directChats', 'alice_bob'),
        'a legal hold must stop destruction even after approval'
      );
    });

    it('destroys the messages when every condition is met', async () => {
      await shredder.setDispositionShreddingEnabled({ enabled: true, tenantId: TENANT_ID });
      await seedMessages('alice_bob');
      await queueApprovedItem('directChat/alice_bob', Date.now() - 30 * DAY_MS);

      assert.equal(await messageCount('alice_bob'), 2, 'messages should exist before');

      const summary = await shredder.runDispositionShredder({ tenantId: TENANT_ID });

      assert.equal(summary.purged, 1);
      assert.equal(await messageCount('alice_bob'), 0, 'messages should be gone after');
    });

    it('never touches a conversation that was not approved', async () => {
      await shredder.setDispositionShreddingEnabled({ enabled: true, tenantId: TENANT_ID });
      await seedMessages('carla_dave');
      await queueApprovedItem('directChat/alice_bob', Date.now() - 30 * DAY_MS);
      await shredder.runDispositionShredder({ tenantId: TENANT_ID });

      assert.equal(
        await messageCount('carla_dave'),
        2,
        'an unrelated conversation must survive untouched'
      );
    });
  });

  describe('search finds the right messages', () => {
    it('returns only the named person\'s conversations', async () => {
      await seedMessages('alice_bob');
      await seedMessages('carla_dave');

      const found = await search.searchArchivedMessages({
        custodianUids: [ALICE],
        tenantId: TENANT_ID
      });

      assert.ok(found.hits.length > 0);
      assert.ok(
        found.hits.every((hit) => hit.conversationId === 'alice_bob'),
        'a search for Alice must not return Carla and Dave\'s messages'
      );
    });

    it('respects a date range', async () => {
      await seedMessages('alice_bob');

      const found = await search.searchArchivedMessages({
        fromMs: Date.now() + DAY_MS,
        tenantId: TENANT_ID
      });

      assert.equal(found.hits.length, 0, 'nothing was sent in the future');
    });

    it('returns messages it cannot read, rather than hiding them', async () => {
      // A search that dropped them would show an empty period and an
      // administrator would report it as empty.
      await seedMessages('alice_bob');

      const found = await search.searchArchivedMessages({ tenantId: TENANT_ID });

      assert.ok(found.hits.length > 0, 'unreadable messages must still be listed');
      assert.ok(found.hits.every((hit) => hit.unreadableReason !== null));
      assert.ok(found.hits.every((hit) => hit.text === null));
    });
  });
});

async function activePolicy(input: {
  action?: 'delete' | 'retain' | 'retain_then_delete';
  durationDays?: number;
  scopeKind: 'conversation' | 'organization' | 'user';
  scopeTargets: string[];
}) {
  const saved = await policies.saveRetentionPolicy({
    actorUid: 'admin',
    policy: {
      action: input.action || 'delete',
      durationDays: input.durationDays ?? 30,
      name: 'Test rule',
      scopeKind: input.scopeKind,
      scopeTargets: input.scopeTargets
    },
    tenantId: TENANT_ID
  });

  await policies.setRetentionPolicyState({
    policyId: saved.id,
    state: 'ACTIVE',
    tenantId: TENANT_ID
  });

  return saved;
}


async function queueApprovedItem(subjectRef: string, decidedAtMs = Date.now()): Promise<void> {
  await firestore.collection('tenants').doc(TENANT_ID)
    .collection('dispositionItems').doc(subjectRef.replace(/\//g, '_')).set({
      decidedAtMs,
      eligibleAtMs: Date.now() - 40 * DAY_MS,
      id: subjectRef.replace(/\//g, '_'),
      itemCount: 2,
      label: subjectRef,
      purgeByMs: Date.now() + DAY_MS,
      state: 'APPROVED',
      subjectRef,
      tenantId: TENANT_ID
    });
}

/** Messages whose sender and recipient match who is actually in the chat. */
const CHAT_PARTICIPANTS: Record<string, [string, string]> = {
  alice_bob: [ALICE, BOB],
  carla_dave: [CARLA, DAVE],
  recent_chat: [ALICE, CARLA]
};

async function seedMessages(chatId: string): Promise<void> {
  const chatRef = firestore.collection('organizations').doc(TENANT_ID)
    .collection('directChats').doc(chatId);
  const [sender, recipient] = CHAT_PARTICIPANTS[chatId] || [ALICE, BOB];

  for (const [index, id] of ['m1', 'm2'].entries()) {
    await chatRef.collection('encryptedEnvelopes').doc(id).set({
      ciphertext: 'x',
      encryptedKeysByDevice: {},
      envelopeId: id,
      nonce: 'n',
      recipientUid: recipient,
      senderUid: sender,
      sentAtMs: Date.now() - (10 + index) * DAY_MS
    });
  }
}

async function messageCount(chatId: string): Promise<number> {
  const snapshot = await firestore.collection('organizations').doc(TENANT_ID)
    .collection('directChats').doc(chatId).collection('encryptedEnvelopes').get();

  return snapshot.size;
}

async function conversationExists(collection: string, id: string): Promise<boolean> {
  const snapshot = await firestore.collection('organizations').doc(TENANT_ID)
    .collection(collection).doc(id).get();

  return snapshot.exists;
}

async function queuedSubjectRefs(): Promise<string[]> {
  const queue = await disposition.listDispositionQueue(TENANT_ID);

  return queue.filter((item) => item.state !== 'WITHHELD').map((item) => item.subjectRef);
}

async function countDocs(): Promise<number> {
  const [queue, policyList, holdList] = await Promise.all([
    firestore.collection('tenants').doc(TENANT_ID).collection('dispositionItems').get(),
    firestore.collection('tenants').doc(TENANT_ID).collection('retentionPolicies').get(),
    firestore.collection('tenants').doc(TENANT_ID).collection('legalHolds').get()
  ]);

  return queue.size + policyList.size + holdList.size;
}

async function clearAll(): Promise<void> {
  const tenantRef = firestore.collection('tenants').doc(TENANT_ID);
  const orgRef = firestore.collection('organizations').doc(TENANT_ID);

  for (const name of ['dispositionItems', 'retentionPolicies', 'legalHolds']) {
    const snapshot = await tenantRef.collection(name).get();

    await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
  }

  for (const name of ['directChats', 'groups']) {
    const snapshot = await orgRef.collection(name).get();

    for (const doc of snapshot.docs) {
      const envelopes = await doc.ref.collection('encryptedEnvelopes').get();

      await Promise.all(envelopes.docs.map((envelope) => envelope.ref.delete()));
      await doc.ref.delete();
    }
  }

  await tenantRef.collection('settings').doc('retention').delete().catch(() => undefined);

  for (const slug of ['privacy', 'terms']) {
    const policyRef = firestore.collection('synzappPolicies').doc(slug);
    const versions = await policyRef.collection('versions').get();

    await Promise.all(versions.docs.map((doc) => doc.ref.delete()));
    await policyRef.delete().catch(() => undefined);
  }
}

async function seedConversations(): Promise<void> {
  const orgRef = firestore.collection('organizations').doc(TENANT_ID);
  const oldMs = Date.now() - 400 * DAY_MS;
  const recentMs = Date.now() - 2 * DAY_MS;

  await orgRef.collection('directChats').doc('alice_bob').set({
    lastMessageAtMs: oldMs,
    messageCount: 40,
    participantIds: [ALICE, BOB],
    title: 'Alice and Bob'
  });

  await orgRef.collection('directChats').doc('carla_dave').set({
    lastMessageAtMs: oldMs,
    messageCount: 25,
    participantIds: [CARLA, DAVE],
    title: 'Carla and Dave'
  });

  await orgRef.collection('directChats').doc('recent_chat').set({
    lastMessageAtMs: recentMs,
    messageCount: 5,
    participantIds: [ALICE, CARLA],
    title: 'Recent'
  });

  await orgRef.collection('groups').doc('old_group').set({
    lastMessageAtMs: oldMs,
    messageCount: 60,
    participantIds: [ALICE, BOB, CARLA],
    title: 'Old group'
  });
}
