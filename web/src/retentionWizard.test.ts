import { describe, expect, it } from 'vitest';
import {
  canAdvance,
  createRetentionPolicyDraft,
  describeDraft,
  getDraftBlockingError,
  getStepError,
  parseDurationDays,
  parseScopeTargets,
  toCreateInput,
  type RetentionPolicyDraft
} from './retentionWizard';

function draft(overrides: Partial<RetentionPolicyDraft> = {}): RetentionPolicyDraft {
  return { ...createRetentionPolicyDraft(), name: 'Contractor conversations', ...overrides };
}

describe('parseScopeTargets', () => {
  it('accepts one target per line', () => {
    expect(parseScopeTargets('alice\nbob\ncarol')).toEqual(['alice', 'bob', 'carol']);
  });

  it('accepts a comma-separated paste', () => {
    expect(parseScopeTargets('alice, bob , carol')).toEqual(['alice', 'bob', 'carol']);
  });

  it('ignores blank lines and stray whitespace', () => {
    expect(parseScopeTargets('  alice \n\n\n bob  \n')).toEqual(['alice', 'bob']);
  });

  it('removes duplicates', () => {
    // A pasted list with a repeat should not inflate the count shown for scope.
    expect(parseScopeTargets('alice\nbob\nalice')).toEqual(['alice', 'bob']);
  });

  it('returns nothing for empty text', () => {
    expect(parseScopeTargets('   \n  ')).toEqual([]);
  });
});

describe('parseDurationDays', () => {
  it('accepts a whole number', () => {
    expect(parseDurationDays('90')).toBe(90);
  });

  it('rejects zero and negatives', () => {
    expect(parseDurationDays('0')).toBeNull();
    expect(parseDurationDays('-5')).toBeNull();
  });

  it('rejects anything that is not a plain number', () => {
    // "90 days" or "9o" reaching the backend as a duration is a policy that
    // deletes on a schedule nobody intended.
    expect(parseDurationDays('90 days')).toBeNull();
    expect(parseDurationDays('9o')).toBeNull();
    expect(parseDurationDays('1.5')).toBeNull();
    expect(parseDurationDays('')).toBeNull();
  });
});

describe('step gating', () => {
  it('will not leave the name step empty', () => {
    expect(canAdvance(draft({ name: '   ' }), 0)).toBe(false);
    expect(getStepError(draft({ name: '' }), 0)).toMatch(/name/i);
  });

  it('allows an organization scope with no targets', () => {
    expect(canAdvance(draft({ scopeKind: 'organization' }), 1)).toBe(true);
  });

  it('will not leave a narrow scope with no targets', () => {
    // An empty list on a user scope would behave as org-wide — the widest
    // possible reach, arrived at by accident.
    const empty = draft({ scopeKind: 'user', scopeTargetsText: '' });

    expect(canAdvance(empty, 1)).toBe(false);
    expect(getStepError(empty, 1)).toMatch(/at least one/i);
  });

  it('allows a narrow scope once targets are given', () => {
    expect(canAdvance(draft({ scopeKind: 'user', scopeTargetsText: 'alice' }), 1)).toBe(true);
  });

  it('requires a valid duration before leaving the retention step', () => {
    expect(canAdvance(draft({ durationDays: '0' }), 3)).toBe(false);
    expect(canAdvance(draft({ durationDays: '90' }), 3)).toBe(true);
  });

  it('does not require a duration for retain-only', () => {
    expect(canAdvance(draft({ action: 'retain', durationDays: '' }), 3)).toBe(true);
  });
});

describe('getDraftBlockingError', () => {
  it('is silent for a complete draft', () => {
    expect(getDraftBlockingError(draft())).toBeNull();
  });

  it('catches a field emptied after its step was passed', () => {
    // The admin can go back and clear a field; the review step must not offer a
    // Create button that is going to fail.
    expect(getDraftBlockingError(draft({ name: '' }))).toMatch(/name/i);
  });

  it('catches an empty narrow scope from the review step', () => {
    const broken = draft({ scopeKind: 'conversation', scopeTargetsText: '' });

    expect(getDraftBlockingError(broken)).toMatch(/at least one/i);
  });
});

describe('toCreateInput', () => {
  it('sends no targets for an organization scope', () => {
    const input = toCreateInput(draft({ scopeKind: 'organization', scopeTargetsText: 'ignored' }));

    expect(input.scopeTargets).toEqual([]);
  });

  it('sends parsed targets for a narrow scope', () => {
    const input = toCreateInput(draft({ scopeKind: 'user', scopeTargetsText: 'alice\nbob' }));

    expect(input.scopeTargets).toEqual(['alice', 'bob']);
  });

  it('trims the name', () => {
    expect(toCreateInput(draft({ name: '  Finance  ' })).name).toBe('Finance');
  });

  it('still sends a valid duration for retain-only', () => {
    // The API requires a number even where the action ignores it.
    expect(toCreateInput(draft({ action: 'retain', durationDays: '' })).durationDays).toBe(1);
  });
});

describe('describeDraft', () => {
  it('says nothing is deleted for retain-only', () => {
    expect(describeDraft(draft({ action: 'retain' }))).toMatch(/never deleted|indefinitely/i);
  });

  it('states the delay for retain-then-delete', () => {
    const summary = describeDraft(draft({ action: 'retain_then_delete', durationDays: '90' }));

    expect(summary).toMatch(/90 days/);
    expect(summary).toMatch(/then delete/);
  });

  it('counts the people in a narrow scope', () => {
    const summary = describeDraft(draft({ scopeKind: 'user', scopeTargetsText: 'a\nb\nc' }));

    expect(summary).toMatch(/3 people/);
  });
});
