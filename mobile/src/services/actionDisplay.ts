import type { ActionPriority, ActionRecord, ActionStatus } from './actionApi';

/**
 * Turning an action into the words and colours a person reads.
 *
 * Kept out of the components so it can be tested without rendering anything,
 * and so the same wording is used everywhere an action appears.
 */

export function describeStatus(status: ActionStatus): string {
  if (status === 'IN_PROGRESS') return 'In progress';
  if (status === 'BLOCKED') return 'Blocked';
  if (status === 'DONE') return 'Done, not verified';
  if (status === 'VERIFIED') return 'Verified';
  // Named rather than left to the fall-through below, which would have shown a
  // cancelled action as "Open" — the one word it must never say.
  if (status === 'CANCELLED') return 'Cancelled';

  return 'Open';
}

export function describePriority(priority: ActionPriority): string {
  if (priority === 'CRITICAL') return 'Critical';
  if (priority === 'HIGH') return 'High';
  if (priority === 'LOW') return 'Low';

  return 'Medium';
}

/**
 * Priority and status colours, in both themes.
 *
 * A single fixed set does not work: the deep red and green that read well on
 * white disappear against black. Each has a lighter twin for dark mode, so the
 * meaning survives the theme rather than the exact hue.
 */
const PRIORITY_COLORS: Record<ActionPriority, { dark: string; light: string }> = {
  CRITICAL: { dark: '#FF6B5E', light: '#C0392B' },
  HIGH: { dark: '#FBBF24', light: '#B7791F' },
  MEDIUM: { dark: '#60A5FA', light: '#2F6FB0' },
  LOW: { dark: '#A1A1AA', light: '#6B7280' }
};

const STATUS_COLORS: Record<ActionStatus, { dark: string; light: string }> = {
  OPEN: { dark: '#A1A1AA', light: '#6B7280' },
  IN_PROGRESS: { dark: '#60A5FA', light: '#2F6FB0' },
  BLOCKED: { dark: '#FF6B5E', light: '#C0392B' },
  DONE: { dark: '#FBBF24', light: '#B7791F' },
  VERIFIED: { dark: '#34D399', light: '#1E8449' },
  // Muted on purpose. A cancelled action is not a failure to be flagged, it is
  // work that is no longer wanted, and it should recede rather than shout.
  CANCELLED: { dark: '#8B8B93', light: '#8E8E93' }
};

/**
 * The dot beside an action in the list. Three colours, and only three.
 *
 * Green means closed and confirmed, orange means somebody still owes something,
 * red means stopped. Six statuses fold onto those three because the dot is a
 * signal read at a glance down a long list, not a legend: a person scanning for
 * what needs them should not have to tell six hues apart.
 *
 * Cancelled is red here although the pill elsewhere keeps it grey. The grey was
 * chosen so cancelled work would recede; in a list where the dot is the only
 * marking left, receding means invisible, and "this one stopped" is exactly
 * what somebody scanning needs to see.
 */
const STATUS_DOT_COLORS: Record<ActionStatus, { dark: string; light: string }> = {
  // Still owed something.
  OPEN: { dark: '#FBBF24', light: '#B7791F' },
  IN_PROGRESS: { dark: '#FBBF24', light: '#B7791F' },
  // Done, but still owed a verification.
  DONE: { dark: '#FBBF24', light: '#B7791F' },
  // Stopped.
  BLOCKED: { dark: '#FF6B5E', light: '#C0392B' },
  CANCELLED: { dark: '#FF6B5E', light: '#C0392B' },
  // Closed and confirmed.
  VERIFIED: { dark: '#34D399', light: '#1E8449' }
};

export function statusDotColor(status: ActionStatus, isDark = false): string {
  const pair = STATUS_DOT_COLORS[status] || STATUS_DOT_COLORS.OPEN;

  return isDark ? pair.dark : pair.light;
}

/** The stripe down the side of the bubble. Priority, not status. */
export function priorityColor(priority: ActionPriority, isDark = false): string {
  const pair = PRIORITY_COLORS[priority] || PRIORITY_COLORS.MEDIUM;

  return isDark ? pair.dark : pair.light;
}

export function statusColor(status: ActionStatus, isDark = false): string {
  const pair = STATUS_COLORS[status] || STATUS_COLORS.OPEN;

  return isDark ? pair.dark : pair.light;
}

/** Who is expected to deal with it, in words rather than an id. */
export function describeOwner(action: ActionRecord): string {
  if (action.responsiblePersonName) {
    return action.responsiblePersonName;
  }

  // Never a blank. An action nobody is named on is owned by the group, and
  // saying so is what stops it sitting unnoticed.
  return `${action.responsibleGroupName} (nobody named yet)`;
}

/** What the row says under the title. */
export function describeActionLine(action: ActionRecord): string {
  const parts = [describeStatus(action.status), describeOwner(action)];

  if (action.status === 'BLOCKED' && action.blockedReason) {
    parts[0] = `Blocked: ${action.blockedReason}`;
  }

  return parts.join(' · ');
}

export function isActionOutstanding(action: ActionRecord): boolean {
  // Cancelled work is finished, not owed. Counting it would keep a badge lit
  // over something nobody is going to do.
  return action.status !== 'VERIFIED' && action.status !== 'CANCELLED';
}

/** Sorted the way a chat reads: oldest first, newest at the bottom. */
export function sortActionsForThread(actions: ActionRecord[]): ActionRecord[] {
  return [...actions].sort((left, right) => left.createdAtMs - right.createdAtMs);
}

/** How much work a group is carrying, in plain words rather than two numbers. */
export function describeCounts(pending: number, unverified: number): string {
  const parts: string[] = [];

  if (pending) {
    parts.push(pending === 1 ? '1 action open' : `${pending} actions open`);
  }

  if (unverified) {
    parts.push(unverified === 1 ? '1 waiting to be verified' : `${unverified} waiting to be verified`);
  }

  return parts.join(' \u00b7 ');
}

/**
 * Drops the actions raised before this person cleared the conversation.
 *
 * Deleting a chat is scoped to one account: the dialog says so, and the server
 * records the moment as `clearedAt` rather than destroying anything. Actions,
 * though, are company records. They live in their own store, keyed by the chat
 * they came from, because an accountability record that anybody can erase by
 * deleting a chat is worth nothing, and the console and the auditor's export
 * both read from it.
 *
 * Those two facts collide in the thread. Re-open a chat that was deleted and
 * emptied from Trash, and the action bubbles come straight back, each one
 * carrying the text of the message it was raised from. The conversation the
 * person was told had gone reappears, quoted back at them.
 *
 * So the record stays and the **view** honours the deletion, which is the same
 * bargain the messages already strike. Actions raised afterwards still appear,
 * and nothing here touches the department group's copy, the Actions console or
 * the export.
 */
export function filterActionsAfterChatCleared(
  actions: ActionRecord[],
  clearedAt?: string | null
): ActionRecord[] {
  if (!clearedAt) {
    return actions;
  }

  const clearedAtMs = Date.parse(clearedAt);

  // An unreadable timestamp must not empty the thread.
  if (!Number.isFinite(clearedAtMs)) {
    return actions;
  }

  return actions.filter((action) => action.createdAtMs > clearedAtMs);
}
