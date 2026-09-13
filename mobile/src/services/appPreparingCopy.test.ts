import { describe, expect, it } from 'vitest';

import {
  APP_PREPARING_DOT_COUNT,
  APP_PREPARING_DOT_DIM_OPACITY,
  APP_PREPARING_PHRASE,
  getPreparingDotCycleMs,
  getPreparingDotLeadInMs,
  getPreparingDotTrailMs
} from './appPreparingCopy';

describe('the preparing screen', () => {
  it('says one honest thing, with no trailing punctuation of its own', () => {
    // The dots are drawn and animated separately, so the sentence must not
    // carry its own or the row shows six.
    expect(APP_PREPARING_PHRASE).toBe('Setting up your account');
    expect(APP_PREPARING_PHRASE.endsWith('.')).toBe(false);
  });

  it('gives every dot the same length cycle, so the wave cannot drift', () => {
    const cycles = Array.from({ length: APP_PREPARING_DOT_COUNT }, (unused, index) =>
      getPreparingDotCycleMs(index));

    expect(new Set(cycles).size).toBe(1);
  });

  it('staggers the dots, rather than lighting them together', () => {
    expect(getPreparingDotLeadInMs(0)).toBe(0);
    expect(getPreparingDotLeadInMs(1)).toBeGreaterThan(getPreparingDotLeadInMs(0));
    expect(getPreparingDotLeadInMs(2)).toBeGreaterThan(getPreparingDotLeadInMs(1));
    expect(getPreparingDotTrailMs(APP_PREPARING_DOT_COUNT - 1)).toBe(0);
  });

  it('keeps a resting dot visible, so the row never loses one', () => {
    expect(APP_PREPARING_DOT_DIM_OPACITY).toBeGreaterThan(0);
    expect(APP_PREPARING_DOT_DIM_OPACITY).toBeLessThan(1);
  });

  it('treats a nonsense index as the first dot rather than going negative', () => {
    expect(getPreparingDotLeadInMs(-3)).toBe(0);
    expect(getPreparingDotTrailMs(99)).toBe(0);
  });
});
