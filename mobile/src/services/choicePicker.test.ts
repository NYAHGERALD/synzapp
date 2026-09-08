import { describe, expect, it } from 'vitest';
import { filterChoiceOptions } from './choicePicker';

const options = [
  { id: 'g1', meta: '4 people', name: 'Bakery' },
  { id: 'g2', meta: '1 person', name: 'Human Resources', searchText: 'HR people staff' },
  { id: 'g3', meta: '9 people', name: 'Night Shift' }
];

describe('finding a team or a person', () => {
  it('returns everything before anything is typed', () => {
    expect(filterChoiceOptions(options, '')).toBe(options);
    expect(filterChoiceOptions(options, '   ')).toBe(options);
  });

  it('finds by name', () => {
    expect(filterChoiceOptions(options, 'bak').map((option) => option.id)).toEqual(['g1']);
  });

  it('ignores capitals, because nobody searches in lower case on purpose', () => {
    expect(filterChoiceOptions(options, 'NIGHT').map((option) => option.id)).toEqual(['g3']);
  });

  it('finds by the line underneath, so "9 people" finds the big team', () => {
    expect(filterChoiceOptions(options, '9 people').map((option) => option.id)).toEqual(['g3']);
  });

  it('finds by the words filed against it, so "HR" finds Human Resources', () => {
    // Nobody types "Human Resources" when they mean HR.
    expect(filterChoiceOptions(options, 'hr').map((option) => option.id)).toEqual(['g2']);
  });

  it('finds nothing for a name nobody has', () => {
    expect(filterChoiceOptions(options, 'zzz')).toEqual([]);
  });

  it('copes with an empty list', () => {
    expect(filterChoiceOptions([], 'anything')).toEqual([]);
  });
});
