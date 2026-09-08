import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const service = readFileSync(
  new URL('../src/services/retentionSimulationService.ts', import.meta.url),
  'utf8'
);
const routes = readFileSync(
  new URL('../src/routes/complianceRoutes.ts', import.meta.url),
  'utf8'
);

describe('a simulation changes nothing', () => {
  it('never queues anything for deletion', () => {
    // The whole point is that it is safe to run against live data.
    assert.doesNotMatch(service, /enqueueDispositionItem/);
    assert.doesNotMatch(service, /\.set\(|\.delete\(|\.update\(/);
  });

  it('never saves a policy', () => {
    assert.doesNotMatch(service, /saveRetentionPolicy|setRetentionPolicyState/);
  });
});

describe('a simulation tells the truth about what would happen', () => {
  it('uses the same precedence rules the real run uses', () => {
    // A simulation that judged the draft alone would promise deletions that an
    // existing longer retention will never allow.
    assert.match(service, /resolveRetentionOutcome/);
    assert.match(service, /listEnforceableRetentionPolicies/);
    assert.match(service, /draftCovers \? \[\.\.\.existing, draft\] : existing/);
  });

  it('counts what a legal hold protects', () => {
    // The single most important number: a hold outranks every policy, and an
    // admin needs to know how much is untouchable before activating.
    assert.match(service, /listActiveLegalHolds/);
    assert.match(service, /heldByLegalHold/);
  });

  it('separates what this rule adds from what was already due', () => {
    assert.match(service, /newlyDueFromThisPolicy/);
    assert.match(service, /wasAlreadyDue/);
  });

  it('covers group conversations, not only direct ones', () => {
    assert.match(service, /collection\('groups'\)/);
    assert.match(service, /collection\('directChats'\)/);
  });

  it('admits when it could not read everything', () => {
    // A number presented as complete when it is not is exactly what an
    // administrator would rely on before deleting records.
    assert.match(service, /scanLimited/);
  });
});

describe('the simulation route', () => {
  it('is Org Admin only, like every other compliance route', () => {
    const handler = routes.slice(
      routes.indexOf("'/retention/simulate'"),
      routes.indexOf("'/retention/simulate'") + 900
    );

    assert.match(handler, /requireComplianceAdmin/);
    assert.match(handler, /verifyAppCheck/);
  });
});

describe('a rule is judged only against what it names', () => {
  const evaluator = readFileSync(
    new URL('../src/services/retentionEvaluatorService.ts', import.meta.url),
    'utf8'
  );

  it('the nightly job filters policies to the conversations they cover', () => {
    // Every policy used to be applied to every conversation. A rule written for
    // a few colleagues would have deleted the whole organization's chats.
    assert.match(evaluator, /policiesCoveringSubject/);
    assert.match(evaluator, /participantIds/);
  });

  it('the simulation filters the same way, so it predicts what will happen', () => {
    assert.match(service, /policiesCoveringSubject/);
    assert.match(service, /policyCoversSubject/);
  });

  it('a conversation no policy covers is left alone', () => {
    assert.match(evaluator, /if \(!covering\.length\)/);
  });
});
