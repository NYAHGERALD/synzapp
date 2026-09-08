import type { RetentionSimulation } from './complianceApi';

/**
 * The simulation panel's words.
 *
 * Written for an Org Admin who is about to delete company records permanently.
 * Every line has to be readable without help, and honest when the answer is
 * unwelcome — a reassuring number here would be the most damaging kind of
 * mistake this product can make.
 */

export interface SimulationLine {
  /** True for the line that carries the consequence. */
  isPrimary?: boolean;
  label: string;
  tone: 'danger' | 'neutral' | 'safe';
  value: string;
}

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`;
}

export function buildSimulationLines(simulation: RetentionSimulation): SimulationLine[] {
  const lines: SimulationLine[] = [
    {
      isPrimary: true,
      label: 'Would be deleted on the next run',
      tone: simulation.wouldDeleteNow ? 'danger' : 'safe',
      value: simulation.wouldDeleteNow
        ? `${plural(simulation.wouldDeleteNow, 'chat', 'chats')}`
          + ` (${plural(simulation.messagesAffectedNow, 'message', 'messages')})`
        : 'Nothing'
    },
    {
      label: 'Would be deleted later, as they age',
      tone: 'neutral',
      value: plural(simulation.wouldDeleteLater, 'chat', 'chats')
    },
    {
      label: 'Kept, with no end date',
      tone: 'neutral',
      value: plural(simulation.keptIndefinitely, 'chat', 'chats')
    }
  ];

  // Only shown when a hold exists. A zero here would read as reassurance about
  // something the administrator never asked about.
  if (simulation.heldByLegalHold) {
    lines.push({
      label: 'Protected by a legal hold, so this rule cannot touch them',
      tone: 'safe',
      value: plural(simulation.heldByLegalHold, 'chat', 'chats')
    });
  }

  return lines;
}

/** One sentence stating the consequence, before any table of numbers. */
export function describeSimulationHeadline(simulation: RetentionSimulation): string {
  if (!simulation.examined) {
    return 'There are no conversations to apply this rule to yet.';
  }

  if (!simulation.wouldDeleteNow && !simulation.wouldDeleteLater) {
    return 'This rule would not delete anything. Everything in scope is kept.';
  }

  if (!simulation.wouldDeleteNow) {
    return `Nothing would be deleted today. ${plural(simulation.wouldDeleteLater, 'chat', 'chats')}`
      + ' would become due later as they get older.';
  }

  return `Switching this on would delete ${plural(simulation.wouldDeleteNow, 'chat', 'chats')}`
    + ` on the next nightly run: ${plural(simulation.messagesAffectedNow, 'message', 'messages')}.`
    + ' This cannot be undone.';
}

/**
 * What this rule adds beyond the rules already running.
 *
 * Null when it adds nothing new, so the panel can stay quiet rather than
 * printing a zero the administrator has to interpret.
 */
export function describeAddedEffect(simulation: RetentionSimulation): string | null {
  if (!simulation.wouldDeleteNow) {
    return null;
  }

  if (!simulation.newlyDueFromThisPolicy) {
    return 'All of these are already due under your existing rules. This rule adds nothing new.';
  }

  if (simulation.newlyDueFromThisPolicy === simulation.wouldDeleteNow) {
    return 'All of these become due because of this rule.';
  }

  return `${plural(simulation.newlyDueFromThisPolicy, 'chat', 'chats')} of these`
    + ' become due because of this rule; the rest were already due.';
}

/** Warning when the scan could not read everything, so counts are a floor. */
export function describeScanLimit(simulation: RetentionSimulation): string | null {
  if (!simulation.scanLimited) {
    return null;
  }

  return 'Your organization has more conversations than one check can read, so the real'
    + ' numbers are higher than those shown.';
}

export function formatOldestAffected(
  simulation: RetentionSimulation
): string | null {
  if (simulation.oldestAffectedAtMs === null) {
    return null;
  }

  return new Date(simulation.oldestAffectedAtMs).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}
