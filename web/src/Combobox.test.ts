import { describe, expect, it } from 'vitest';
import { filterComboboxOptions, measureComboboxPlacement } from './Combobox';

describe('filterComboboxOptions', () => {
  const states = ['Alabama', 'Maine', 'Maryland', 'Massachusetts', 'Oklahoma'];

  it('returns everything when nothing has been typed', () => {
    expect(filterComboboxOptions(states, '')).toEqual(states);
    expect(filterComboboxOptions(states, '   ')).toEqual(states);
  });

  it('puts the options that start with the text before the ones that merely contain it', () => {
    // "Alabama" and "Oklahoma" both contain "ma", but somebody typing "ma"
    // is looking for Maine.
    expect(filterComboboxOptions(states, 'ma')).toEqual([
      'Maine',
      'Maryland',
      'Massachusetts',
      'Alabama',
      'Oklahoma'
    ]);
  });

  it('ignores capitals', () => {
    expect(filterComboboxOptions(states, 'MAINE')).toEqual(['Maine']);
  });

  it('returns nothing when there is no match', () => {
    expect(filterComboboxOptions(states, 'zzz')).toEqual([]);
  });
});

describe('measureComboboxPlacement', () => {
  it('opens downwards with room to spare', () => {
    const placement = measureComboboxPlacement({
      triggerBottom: 200,
      triggerTop: 160,
      viewportHeight: 900
    });

    expect(placement.dropUp).toBe(false);
    expect(placement.maxHeight).toBe(288);
  });

  it('opens upwards when the field sits near the bottom of the window', () => {
    const placement = measureComboboxPlacement({
      triggerBottom: 860,
      triggerTop: 820,
      viewportHeight: 900
    });

    expect(placement.dropUp).toBe(true);
  });

  it('never asks for more height than the window has', () => {
    const placement = measureComboboxPlacement({
      triggerBottom: 300,
      triggerTop: 260,
      viewportHeight: 500
    });

    expect(placement.maxHeight).toBeLessThanOrEqual(500 - 300);
  });

  it('stays usable in a very short window rather than collapsing to nothing', () => {
    const placement = measureComboboxPlacement({
      triggerBottom: 180,
      triggerTop: 140,
      viewportHeight: 220
    });

    expect(placement.maxHeight).toBeGreaterThanOrEqual(168);
  });
});
