import { describe, expect, it } from 'vitest';
import type { DispositionItem, LegalHoldSummary, RetentionPolicy } from './complianceApi';
import {
  formatHoldState,
  formatRelativeDay,
  formatRetentionDuration,
  splitDispositionQueue,
  toDispositionRow,
  toHoldRow,
  toPolicyRow
} from './complianceDisplay';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 30);

function policy(overrides: Partial<RetentionPolicy> = {}): RetentionPolicy {
  return {
    action: 'retain_then_delete',
    anchor: 'created',
    contentTypes: [],
    createdAtMs: NOW,
    durationDays: 2555,
    id: 'p1',
    name: 'Global baseline',
    policyKey: 'k1',
    scopeKind: 'organization',
    scopeTargets: [],
    state: 'ACTIVE',
    version: 1,
    ...overrides
  };
}

function hold(overrides: Partial<LegalHoldSummary> = {}): LegalHoldSummary {
  return {
    appliedAtMs: NOW - 10 * DAY_MS,
    caseId: 'CASE-1',
    custodianUids: [],
    delayUntilMs: null,
    description: 'Nkemdi v. Synzapp',
    id: 'h1',
    releasedAtMs: null,
    ...overrides
  };
}

function item(overrides: Partial<DispositionItem> = {}): DispositionItem {
  return {
    eligibleAtMs: NOW - 6 * DAY_MS,
    id: 'd1',
    itemCount: 12400,
    label: '#ops-alerts',
    purgeByMs: NOW + 10 * DAY_MS,
    state: 'PENDING',
    subjectRef: 'conversation/ops',
    ...overrides
  };
}

describe('formatRetentionDuration', () => {
  it('reads whole years as years', () => {
    expect(formatRetentionDuration(365)).toBe('1 year');
    expect(formatRetentionDuration(1095)).toBe('3 years');
  });

  it('does not round a duration that is not whole years', () => {
    // "1 year" for a 400-day policy tells an administrator something untrue
    // about how long their records survive.
    expect(formatRetentionDuration(400)).toBe('400 days');
  });

  it('reads whole months as months', () => {
    expect(formatRetentionDuration(90)).toBe('3 months');
  });

  it('handles a single day', () => {
    expect(formatRetentionDuration(1)).toBe('1 day');
  });
});

describe('toPolicyRow', () => {
  it('shows a plain retain as indefinite rather than a duration', () => {
    // Showing "7 years" for a retain-only policy would imply an end it has not.
    expect(toPolicyRow(policy({ action: 'retain' })).duration).toBe('Indefinite');
  });

  it('shows a duration for retain-then-delete', () => {
    expect(toPolicyRow(policy({ durationDays: 2555 })).duration).toBe('7 years');
  });

  it('describes an org-wide scope in full', () => {
    // Worded for an Org Admin: "chat", not "conversation in the tenant".
    expect(toPolicyRow(policy()).scopeSummary).toMatch(/Every chat/);
    expect(toPolicyRow(policy()).scopeSummary).toMatch(/your company/);
  });

  it('counts targets for a narrow scope', () => {
    const row = toPolicyRow(policy({ scopeKind: 'user', scopeTargets: ['a', 'b', 'c'] }));

    expect(row.scopeDetail).toBe('3 people');
  });

  it('marks a simulated policy so it is not mistaken for a live one', () => {
    expect(toPolicyRow(policy({ state: 'SIMULATION' })).state).toBe('Simulation');
  });
});

describe('formatHoldState', () => {
  it('is active while never released', () => {
    expect(formatHoldState(hold(), NOW)).toBe('Active');
  });

  it('is releasing while the delay is still running', () => {
    // Calling this "Released" would tell an admin the evidence is already
    // exposed, when it is still protected.
    const releasing = hold({ delayUntilMs: NOW + 3 * DAY_MS, releasedAtMs: NOW - DAY_MS });

    expect(formatHoldState(releasing, NOW)).toBe('Releasing');
  });

  it('is released once the delay has passed', () => {
    const released = hold({ delayUntilMs: NOW - DAY_MS, releasedAtMs: NOW - 8 * DAY_MS });

    expect(formatHoldState(released, NOW)).toBe('Released');
  });
});

describe('toHoldRow', () => {
  it('says all custodians when none are named', () => {
    expect(toHoldRow(hold(), NOW).detail).toMatch(/All custodians/);
  });

  it('counts named custodians', () => {
    expect(toHoldRow(hold({ custodianUids: ['a', 'b'] }), NOW).detail).toMatch(/2 custodians/);
  });

  it('shows when protection actually ends for a releasing hold', () => {
    const row = toHoldRow(hold({ delayUntilMs: NOW + 3 * DAY_MS, releasedAtMs: NOW }), NOW);

    expect(row.detail).toMatch(/protected until/);
  });
});

describe('formatRelativeDay', () => {
  it('reads the past and the future', () => {
    expect(formatRelativeDay(NOW - 6 * DAY_MS, NOW)).toBe('6 days ago');
    expect(formatRelativeDay(NOW + 2 * DAY_MS, NOW)).toBe('in 2 days');
  });

  it('says today rather than 0 days', () => {
    expect(formatRelativeDay(NOW, NOW)).toBe('today');
  });

  it('does not pluralise a single day', () => {
    expect(formatRelativeDay(NOW - DAY_MS, NOW)).toBe('1 day ago');
  });
});

describe('splitDispositionQueue', () => {
  it('separates held batches from reviewable ones', () => {
    const queue = splitDispositionQueue(
      [item(), item({ id: 'd2', state: 'WITHHELD' })],
      NOW
    );

    expect(queue.reviewable).toHaveLength(1);
    expect(queue.withheldCount).toBe(1);
  });

  it('counts held batches rather than hiding them', () => {
    // An empty queue reads the same whether nothing expired or everything is
    // frozen, and those are very different situations to be in.
    const queue = splitDispositionQueue([item({ state: 'WITHHELD' })], NOW);

    expect(queue.reviewable).toHaveLength(0);
    expect(queue.withheldCount).toBe(1);
  });

  it('drops batches already destroyed', () => {
    const queue = splitDispositionQueue([item({ state: 'PURGED' })], NOW);

    expect(queue.reviewable).toHaveLength(0);
    expect(queue.withheldCount).toBe(0);
  });

  it('formats item counts with separators', () => {
    expect(toDispositionRow(item({ itemCount: 41200 }), NOW).items).toBe('41,200');
  });
});
