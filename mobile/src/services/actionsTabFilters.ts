import { isActionOutstanding } from './actionDisplay';
import type { ActionRecord } from './actionApi';

/**
 * The three views of the Actions screen.
 *
 * Kept out of the component so the meaning of each can be tested without
 * rendering anything. "Outstanding" is the one that matters: it is what a
 * department opens the screen to see, and it is the number a supervisor is
 * judged on, so it must not quietly include work that is finished.
 */

export type ActionsTabFilter = 'all' | 'done' | 'outstanding';

/**
 * Still owed by somebody.
 *
 * Cancelled work is not owed, and neither is verified work. Both are finished,
 * for different reasons, and counting either would keep a number lit over
 * something nobody is going to do.
 */
export function filterActionsByTab(
  actions: ActionRecord[],
  filter: ActionsTabFilter
): ActionRecord[] {
  if (filter === 'outstanding') {
    return actions.filter(isActionOutstanding);
  }

  if (filter === 'done') {
    return actions.filter((action) => !isActionOutstanding(action));
  }

  return actions;
}

/** What each tab would show, so the counts and the lists cannot disagree. */
export function buildActionFilterCounts(
  actions: ActionRecord[]
): Record<ActionsTabFilter, number> {
  return {
    all: actions.length,
    done: filterActionsByTab(actions, 'done').length,
    outstanding: filterActionsByTab(actions, 'outstanding').length
  };
}
