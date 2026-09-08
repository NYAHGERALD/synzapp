import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateRetentionPolicyInput } from '../src/services/retentionPolicyService.ts';
import { validateLegalHoldInput } from '../src/services/legalHoldService.ts';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const policyService = readFileSync(
  resolve(backendRoot, 'src', 'services', 'retentionPolicyService.ts'),
  'utf8'
);
const holdService = readFileSync(
  resolve(backendRoot, 'src', 'services', 'legalHoldService.ts'),
  'utf8'
);

function policyInput(overrides: Partial<Parameters<typeof validateRetentionPolicyInput>[0]> = {}) {
  return {
    action: 'retain' as const,
    durationDays: 365,
    name: 'Finance records',
    scopeKind: 'organization' as const,
    ...overrides
  };
}

describe('retention policy validation', () => {
  it('accepts a well-formed org-wide policy', () => {
    assert.equal(validateRetentionPolicyInput(policyInput()), null);
  });

  it('requires a name', () => {
    assert.match(validateRetentionPolicyInput(policyInput({ name: '   ' })) || '', /needs a name/);
  });

  it('rejects a duration under one day', () => {
    assert.match(validateRetentionPolicyInput(policyInput({ durationDays: 0 })) || '', /at least one day/);
  });

  it('requires targets for a narrow scope', () => {
    // An empty target list on a user scope would silently behave as org-wide,
    // which is the widest possible blast radius reached by accident.
    const error = validateRetentionPolicyInput(policyInput({ scopeKind: 'user', scopeTargets: [] }));

    assert.match(error || '', /needs at least one target/);
  });

  it('accepts a narrow scope that names its targets', () => {
    assert.equal(
      validateRetentionPolicyInput(policyInput({ scopeKind: 'user', scopeTargets: ['uid-1'] })),
      null
    );
  });
});

describe('policies are versioned, never mutated', () => {
  it('supersedes the previous version instead of overwriting it', () => {
    // Reconstructing why an item was deleted needs the policy as it stood then.
    assert.match(policyService, /supersededAtMs: nowMs/);
    assert.match(policyService, /previousVersions\.docs\.forEach/);
  });

  it('excludes superseded versions from the active list', () => {
    assert.match(policyService, /where\('supersededAtMs', '==', null\)/);
  });
});

describe('a new policy cannot delete anything', () => {
  it('always writes in simulation', () => {
    assert.match(policyService, /state: 'SIMULATION'/);
    assert.doesNotMatch(policyService, /state: 'ACTIVE'(?![^\n]*\|)/);
  });

  it('only enforces policies that were explicitly activated', () => {
    // A simulated policy reaching the disposer would delete data the operator
    // was told was only being modelled.
    assert.match(policyService, /policy\.state === 'ACTIVE'/);
  });
});

describe('legal hold validation', () => {
  it('requires a case reference', () => {
    const error = validateLegalHoldInput({ caseId: '  ', description: 'Retain finance chats' });

    assert.match(error || '', /case reference/);
  });

  it('requires a description of what is preserved', () => {
    // A hold routinely outlives whoever applied it.
    const error = validateLegalHoldInput({ caseId: 'CASE-1', description: '' });

    assert.match(error || '', /description/);
  });

  it('accepts a complete hold', () => {
    assert.equal(validateLegalHoldInput({ caseId: 'CASE-1', description: 'Retain finance chats' }), null);
  });
});

describe('hold release is never instant', () => {
  it('sets a delay when a hold is released', () => {
    // A hold lifted in error is recoverable; evidence shredded in the same
    // second is not.
    assert.match(holdService, /delayUntilMs = nowMs \+ HOLD_RELEASE_DELAY_MS/);
  });

  it('keeps a released hold in the active list until the delay expires', () => {
    assert.match(holdService, /holds\.filter\(\(hold\) => isHoldActive\(hold, nowMs\)\)/);
  });
});

describe('an active hold blocks tenant deletion', () => {
  it('throws rather than warning', () => {
    // Offboarding destroys everything a hold exists to preserve, and someone in
    // a hurry clicks through a warning.
    assert.match(holdService, /export async function assertTenantDeletableUnderHolds/);
    assert.match(holdService, /cannot be deleted while/);
  });

  it('names the cases blocking the deletion', () => {
    assert.match(holdService, /activeHolds\.map\(\(hold\) => hold\.caseId\)/);
  });
});

describe('the hold backstop is wired to tenant deletion', () => {
  const deletionService = readFileSync(
    resolve(backendRoot, 'src', 'services', 'organizationDeletionService.ts'),
    'utf8'
  );

  it('checks holds before deleting an organization', () => {
    assert.match(deletionService, /await assertTenantDeletableUnderHolds\(context\.tenantId\)/);
  });

  it('checks after the typed confirmation, not before', () => {
    // So the operator is told a hold blocks them only once they have genuinely
    // asked to delete, rather than as noise on a screen they were browsing.
    const confirmationIndex = deletionService.indexOf('to confirm deleting this organization');
    const holdIndex = deletionService.indexOf('assertTenantDeletableUnderHolds(context.tenantId)');

    assert.ok(confirmationIndex > 0 && holdIndex > confirmationIndex);
  });
});

describe('the evaluator turns a policy into something to review', () => {
  const evaluator = readFileSync(
    resolve(backendRoot, 'src', 'services', 'retentionEvaluatorService.ts'),
    'utf8'
  );

  it('only considers activated policies', () => {
    // A policy in simulation must be modellable without producing something an
    // administrator can approve.
    assert.match(evaluator, /listEnforceableRetentionPolicies/);
  });

  it('does nothing when no policy is active', () => {
    assert.match(evaluator, /if \(!policies\.length\) \{\s*\n\s*return summary;/);
  });

  it('never queues content under a hold', () => {
    assert.match(evaluator, /if \(outcome\.isOnHold\) \{\s*\n\s*summary\.withheld \+= 1;/);
  });

  it('keeps content whose obligation has not expired', () => {
    assert.match(evaluator, /outcome\.purgeAfterMs === null \|\| outcome\.purgeAfterMs > nowMs/);
  });

  it('does not queue the same conversation twice', () => {
    // The job runs repeatedly; duplicates would make the queue meaningless.
    assert.match(evaluator, /queuedSubjects\.has\(subjectRef\)/);
  });

  it('destroys nothing itself', () => {
    // Queuing is not destruction. Nothing here may delete.
    assert.doesNotMatch(evaluator, /\.delete\(\)/);
  });
});
