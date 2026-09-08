import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deriveBlobRetention,
  isBlobPurgeable,
  isHoldActive,
  resolveRetentionOutcome,
  type LegalHold,
  type RetentionPolicy
} from '../src/services/retentionEvaluation.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const CREATED_AT = Date.UTC(2026, 0, 1);
const NOW = Date.UTC(2026, 5, 1);

function policy(overrides: Partial<RetentionPolicy> = {}): RetentionPolicy {
  return {
    action: 'retain',
    durationDays: 30,
    id: 'policy-1',
    scopeKind: 'organization',
    ...overrides
  };
}

function resolve(policies: RetentionPolicy[], holds: LegalHold[] = [], nowMs = NOW) {
  return resolveRetentionOutcome({
    holds,
    nowMs,
    policies,
    subject: { createdAtMs: CREATED_AT }
  });
}

describe('precedence rule 1 — a hold suspends everything', () => {
  it('blocks destruction regardless of policy', () => {
    const outcome = resolve(
      [policy({ action: 'delete', durationDays: 1 })],
      [{ id: 'hold-1' }]
    );

    assert.equal(outcome.isOnHold, true);
    assert.equal(outcome.purgeAfterMs, null);
    assert.equal(outcome.blockingHoldId, 'hold-1');
  });

  it('lets obligations keep accruing underneath the hold', () => {
    // The plan is explicit: the hold prevents the exit, it does not pause the
    // clock. Releasing it must not resurrect an already-expired obligation.
    const outcome = resolve([policy({ durationDays: 30 })], [{ id: 'hold-1' }]);

    assert.equal(outcome.retainUntilMs, CREATED_AT + 30 * DAY_MS);
  });

  it('names the hold in the explanation, first', () => {
    const outcome = resolve([policy()], [{ id: 'hold-7' }]);

    assert.match(outcome.explanation[0], /hold-7/);
  });
});

describe('legal hold release grace', () => {
  it('keeps protecting until the delay expires', () => {
    const hold: LegalHold = { delayUntilMs: NOW + DAY_MS, id: 'hold-1', releasedAtMs: NOW - DAY_MS };

    // A hold lifted by mistake must not hand evidence straight to the disposer.
    assert.equal(isHoldActive(hold, NOW), true);
  });

  it('stops protecting once the delay has passed', () => {
    const hold: LegalHold = { delayUntilMs: NOW - DAY_MS, id: 'hold-1', releasedAtMs: NOW - 2 * DAY_MS };

    assert.equal(isHoldActive(hold, NOW), false);
  });

  it('stops protecting immediately when released with no delay', () => {
    assert.equal(isHoldActive({ id: 'hold-1', releasedAtMs: NOW - 1 }, NOW), false);
  });

  it('protects indefinitely when never released', () => {
    assert.equal(isHoldActive({ id: 'hold-1' }, NOW), true);
  });
});

describe('precedence rule 2 — retention beats deletion', () => {
  it('retains when one policy retains and another deletes', () => {
    const outcome = resolve([
      policy({ action: 'delete', durationDays: 1, id: 'delete-1' }),
      policy({ action: 'retain', durationDays: 365, id: 'retain-1' })
    ]);

    assert.equal(outcome.governingPolicyId, 'retain-1');
    assert.equal(outcome.purgeAfterMs, null);
    assert.equal(outcome.retainUntilMs, CREATED_AT + 365 * DAY_MS);
  });
});

describe('precedence rule 3 — the longest retention wins', () => {
  it('survives to the end of the longest obligation', () => {
    const outcome = resolve([
      policy({ durationDays: 30, id: 'short' }),
      policy({ durationDays: 2555, id: 'long' }),
      policy({ durationDays: 90, id: 'medium' })
    ]);

    assert.equal(outcome.governingPolicyId, 'long');
    assert.equal(outcome.retainUntilMs, CREATED_AT + 2555 * DAY_MS);
  });
});

describe('precedence rule 4 — most specific scope, then shortest', () => {
  it('prefers a conversation-scoped deletion over an org-wide one', () => {
    const outcome = resolve([
      policy({ action: 'delete', durationDays: 3650, id: 'org', scopeKind: 'organization' }),
      policy({ action: 'delete', durationDays: 30, id: 'conversation', scopeKind: 'conversation' })
    ]);

    assert.equal(outcome.governingPolicyId, 'conversation');
  });

  it('prefers a user scope over an organization scope', () => {
    const outcome = resolve([
      policy({ action: 'delete', durationDays: 30, id: 'org', scopeKind: 'organization' }),
      policy({ action: 'delete', durationDays: 3650, id: 'user', scopeKind: 'user' })
    ]);

    assert.equal(outcome.governingPolicyId, 'user');
  });

  it('breaks a tie between equal scopes with the shortest duration', () => {
    const outcome = resolve([
      policy({ action: 'delete', durationDays: 90, id: 'longer', scopeKind: 'user' }),
      policy({ action: 'delete', durationDays: 30, id: 'shorter', scopeKind: 'user' })
    ]);

    assert.equal(outcome.governingPolicyId, 'shorter');
  });
});

describe('retain versus retain_then_delete', () => {
  it('keeps a plain retain indefinitely', () => {
    assert.equal(resolve([policy({ action: 'retain' })]).purgeAfterMs, null);
  });

  it('gives retain_then_delete a purge date at the end of retention', () => {
    const outcome = resolve([policy({ action: 'retain_then_delete', durationDays: 30 })]);

    assert.equal(outcome.purgeAfterMs, CREATED_AT + 30 * DAY_MS);
  });
});

describe('no policy at all', () => {
  it('keeps the item rather than deleting it', () => {
    const outcome = resolve([]);

    // Defaulting to deletion when no policy matches would destroy a tenant's
    // history the moment a policy was misconfigured.
    assert.equal(outcome.purgeAfterMs, null);
    assert.match(outcome.explanation.join(' '), /kept indefinitely/);
  });
});

describe('deriveBlobRetention', () => {
  it('takes the longest retention of every referencing message', () => {
    const blob = deriveBlobRetention([
      { isLive: true, purgeAfterMs: CREATED_AT + 30 * DAY_MS, retainUntilMs: CREATED_AT + 30 * DAY_MS },
      { isLive: true, purgeAfterMs: CREATED_AT + 365 * DAY_MS, retainUntilMs: CREATED_AT + 365 * DAY_MS }
    ]);

    assert.equal(blob.derivedRetainUntilMs, CREATED_AT + 365 * DAY_MS);
  });

  it('is kept indefinitely when any reference is indefinite', () => {
    const blob = deriveBlobRetention([
      { isLive: true, purgeAfterMs: CREATED_AT + 30 * DAY_MS, retainUntilMs: CREATED_AT + 30 * DAY_MS },
      { isLive: true, purgeAfterMs: null, retainUntilMs: CREATED_AT + 90 * DAY_MS }
    ]);

    // A blob cannot outlive the *shortest* obligation — only the longest.
    assert.equal(blob.purgeAfterMs, null);
  });

  it('counts only live references', () => {
    const blob = deriveBlobRetention([
      { isLive: true, purgeAfterMs: 0, retainUntilMs: 0 },
      { isLive: false, purgeAfterMs: 0, retainUntilMs: 0 },
      { isLive: false, purgeAfterMs: 0, retainUntilMs: 0 }
    ]);

    assert.equal(blob.liveRefCount, 1);
  });

  it('treats an unreferenced blob as immediately purgeable', () => {
    const blob = deriveBlobRetention([]);

    assert.equal(blob.liveRefCount, 0);
    assert.equal(blob.purgeAfterMs, 0);
  });
});

describe('isBlobPurgeable', () => {
  it('refuses while any live message still references it', () => {
    // This is the check a date alone misses, and the one that produced restores
    // full of empty frames: expired media under still-live messages.
    const purgeable = isBlobPurgeable(
      { derivedRetainUntilMs: NOW - DAY_MS, liveRefCount: 1, purgeAfterMs: NOW - DAY_MS },
      NOW
    );

    assert.equal(purgeable, false);
  });

  it('refuses while retention has not expired', () => {
    const purgeable = isBlobPurgeable(
      { derivedRetainUntilMs: NOW + DAY_MS, liveRefCount: 0, purgeAfterMs: NOW - DAY_MS },
      NOW
    );

    assert.equal(purgeable, false);
  });

  it('refuses when the blob must be kept indefinitely', () => {
    const purgeable = isBlobPurgeable(
      { derivedRetainUntilMs: NOW - DAY_MS, liveRefCount: 0, purgeAfterMs: null },
      NOW
    );

    assert.equal(purgeable, false);
  });

  it('allows once retention has passed and nothing references it', () => {
    const purgeable = isBlobPurgeable(
      { derivedRetainUntilMs: NOW - DAY_MS, liveRefCount: 0, purgeAfterMs: NOW - DAY_MS },
      NOW
    );

    assert.equal(purgeable, true);
  });
});
