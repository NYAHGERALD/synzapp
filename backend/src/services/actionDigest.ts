/**
 * What one person's reminder says, and whether it is worth sending at all.
 *
 * The unit is the person, not the action. Ten outstanding actions produce one
 * notification, because ten notifications produce nought — somebody who is told
 * ten things at eight in the morning has been told nothing, and has learned to
 * clear the whole group without reading it.
 *
 * The rule that does the most work here is the one about silence: a digest that
 * says "0 open" is exactly what teaches a person to swipe a reminder away
 * before reading it, and the day that habit forms is the day the overdue
 * escalation stops working too.
 */

export interface ActionDigestCounts {
  awaitingVerification: number;
  open: number;
  overdue: number;
}

export interface DigestableAction {
  dueAtMs: number | null;
  responsiblePersonUid: string | null;
  status: string;
}

/** Statuses that mean somebody still owes the work. */
const OPEN_STATUSES = ['OPEN', 'IN_PROGRESS', 'BLOCKED'];

/**
 * What this person is carrying.
 *
 * Only their own. A reminder about somebody else's work is a reminder people
 * learn to ignore, and it teaches them to ignore the ones that were theirs.
 *
 * An overdue action is counted once, as overdue, rather than in both columns —
 * "3 open and 1 overdue" reads as four things, and it is three.
 */
export function countActionsForDigest(input: {
  actions: DigestableAction[];
  nowMs: number;
  uid: string;
  /** Actions this person is able to verify, which is never their own work. */
  verifiableCount: number;
}): ActionDigestCounts {
  let open = 0;
  let overdue = 0;

  for (const action of input.actions) {
    if (action.responsiblePersonUid !== input.uid) {
      continue;
    }

    if (!OPEN_STATUSES.includes(action.status)) {
      continue;
    }

    if (action.dueAtMs && action.dueAtMs < input.nowMs) {
      overdue += 1;
      continue;
    }

    open += 1;
  }

  return {
    awaitingVerification: Math.max(input.verifiableCount, 0),
    open,
    overdue
  };
}

/**
 * The reminder itself, or null when there is nothing to say.
 *
 * Overdue leads, because on a locked screen the first few words are the only
 * ones that are read, and overdue is the part that needs somebody today.
 */
export function buildActionDigest(counts: ActionDigestCounts): {
  body: string;
  title: string;
} | null {
  const parts: string[] = [];

  if (counts.overdue > 0) {
    parts.push(counts.overdue === 1 ? '1 action is overdue' : `${counts.overdue} actions are overdue`);
  }

  if (counts.open > 0) {
    parts.push(counts.open === 1 ? '1 is open' : `${counts.open} are open`);
  }

  if (counts.awaitingVerification > 0) {
    parts.push(counts.awaitingVerification === 1
      ? '1 is waiting to be verified'
      : `${counts.awaitingVerification} are waiting to be verified`);
  }

  if (!parts.length) {
    return null;
  }

  return {
    body: `${joinNaturally(parts)}.`,
    // The title says whether this needs today or this week, so somebody can
    // decide without opening it.
    title: counts.overdue > 0 ? 'Actions overdue' : 'Your actions'
  };
}

/**
 * Whether anything at all is outstanding.
 *
 * Kept separate so a caller can decide not to do the work of building a message
 * it is not going to send.
 */
export function hasAnythingOutstanding(counts: ActionDigestCounts): boolean {
  return counts.open > 0 || counts.overdue > 0 || counts.awaitingVerification > 0;
}

/**
 * "a, b and c" rather than "a, b, c".
 *
 * A notification is read as a sentence, and a comma-separated list reads as a
 * form.
 */
function joinNaturally(parts: string[]): string {
  if (parts.length === 1) {
    return capitalise(parts[0]);
  }

  const last = parts[parts.length - 1];
  const rest = parts.slice(0, -1);

  return capitalise(`${rest.join(', ')} and ${last}`);
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
