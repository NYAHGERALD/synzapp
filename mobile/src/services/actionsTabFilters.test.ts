import { describe, expect, it } from 'vitest';
import { buildActionFilterCounts, filterActionsByTab } from './actionsTabFilters';
import type { ActionRecord, ActionStatus } from './actionApi';

function action(status: ActionStatus): ActionRecord {
  return { actionId: `a_${status}`, status } as ActionRecord;
}

const everyEnding = [
  action('OPEN'),
  action('IN_PROGRESS'),
  action('BLOCKED'),
  action('DONE'),
  action('VERIFIED'),
  action('CANCELLED')
];

describe('what each tab shows', () => {
  it('counts work that is still owed as outstanding', () => {
    const outstanding = filterActionsByTab(everyEnding, 'outstanding').map((a) => a.status);

    expect(outstanding).toEqual(['OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE']);
  });

  it('does not call cancelled work outstanding', () => {
    // Nobody is going to do it, so it must not keep a number lit.
    expect(filterActionsByTab([action('CANCELLED')], 'outstanding')).toEqual([]);
  });

  it('keeps work that is merely done as still owed, because it needs verifying', () => {
    expect(filterActionsByTab([action('DONE')], 'outstanding')).toHaveLength(1);
  });

  it('puts both endings under done', () => {
    const done = filterActionsByTab(everyEnding, 'done').map((a) => a.status);

    expect(done).toEqual(['VERIFIED', 'CANCELLED']);
  });

  it('shows everything under all', () => {
    expect(filterActionsByTab(everyEnding, 'all')).toHaveLength(6);
  });

  it('never loses or duplicates an action between the two halves', () => {
    const outstanding = filterActionsByTab(everyEnding, 'outstanding').length;
    const done = filterActionsByTab(everyEnding, 'done').length;

    expect(outstanding + done).toBe(everyEnding.length);
  });
});

describe('the counts beside each tab', () => {
  it('agrees with what each tab actually lists', () => {
    const counts = buildActionFilterCounts(everyEnding);

    expect(counts.outstanding).toBe(filterActionsByTab(everyEnding, 'outstanding').length);
    expect(counts.done).toBe(filterActionsByTab(everyEnding, 'done').length);
    expect(counts.all).toBe(everyEnding.length);
  });

  it('is all zeroes for an empty department', () => {
    expect(buildActionFilterCounts([])).toEqual({ all: 0, done: 0, outstanding: 0 });
  });
});
