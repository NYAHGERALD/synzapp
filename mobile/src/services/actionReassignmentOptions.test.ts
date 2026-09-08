import { describe, expect, it } from 'vitest';
import {
  ACTION_REASSIGNMENT_REASONS,
  canSubmitReassignment
} from './actionReassignmentOptions';

const form = (overrides = {}) => ({
  detail: '',
  isChangingPerson: true,
  nextPersonUid: 'ben',
  reasonId: 'UNAVAILABLE' as const,
  ...overrides
});

describe('when the move can be sent', () => {
  it('allows a preset on its own', () => {
    expect(canSubmitReassignment(form())).toBe(true);
  });

  it('waits for a reason to be chosen', () => {
    expect(canSubmitReassignment(form({ reasonId: null }))).toBe(false);
  });

  it('waits for the text when the preset says nothing', () => {
    expect(canSubmitReassignment(form({ reasonId: 'OTHER' }))).toBe(false);
    expect(canSubmitReassignment(form({ detail: 'short', reasonId: 'OTHER' }))).toBe(false);
    expect(canSubmitReassignment(form({ detail: 'Covering the oven line', reasonId: 'OTHER' }))).toBe(true);
  });

  it('does not count surrounding spaces towards the text', () => {
    expect(canSubmitReassignment(form({ detail: '        ', reasonId: 'OTHER' }))).toBe(false);
  });

  it('refuses while the person has not actually changed', () => {
    // Otherwise somebody explains themselves at length and moves nothing.
    expect(canSubmitReassignment(form({ isChangingPerson: false }))).toBe(false);
  });

  it('allows handing it back to the whole team', () => {
    expect(canSubmitReassignment(form({ nextPersonUid: null }))).toBe(true);
  });
});

describe('the reasons offered', () => {
  it('matches the five the server accepts', () => {
    expect(ACTION_REASSIGNMENT_REASONS.map((option) => option.id)).toEqual([
      'UNAVAILABLE',
      'WRONG_PERSON',
      'NEEDS_OTHER_SKILLS',
      'WORKLOAD',
      'OTHER'
    ]);
  });

  it('reads as something somebody would say on a shift', () => {
    for (const option of ACTION_REASSIGNMENT_REASONS) {
      expect(option.label.length).toBeGreaterThan(4);
      expect(option.label).not.toMatch(/_/);
    }
  });
});
