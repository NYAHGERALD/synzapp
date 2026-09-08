import type { ConsoleAction, ConsoleActionEvent } from './complianceApi';
import { toCsvCell } from './announcementExport';

/**
 * The action record, as a file an auditor can open.
 *
 * The history is the point. A row saying an action is verified proves nothing
 * on its own; the file has to show who raised it, who did the work, who
 * confirmed it, and when each of those happened.
 */

function formatTime(ms: number | null): string {
  return ms ? new Date(ms).toISOString() : '';
}

export function describeActionStatus(status: ConsoleAction['status']): string {
  if (status === 'IN_PROGRESS') return 'In progress';
  if (status === 'BLOCKED') return 'Blocked';
  if (status === 'DONE') return 'Done, not verified';
  if (status === 'VERIFIED') return 'Verified';

  return 'Open';
}

function describeEvent(event: ConsoleActionEvent): string {
  if (event.kind === 'CREATED') return 'Raised from a message';
  if (event.kind === 'VERIFIED') return 'Verified';
  if (event.toStatus === 'IN_PROGRESS') return 'Work started';
  if (event.toStatus === 'BLOCKED') return 'Waiting on something';
  if (event.toStatus === 'DONE') return 'Marked done';

  return 'Reopened';
}

/**
 * One action and everything that happened to it.
 *
 * The heading block states the facts; the rows below are the history in order.
 */
export function buildActionCsv(action: ConsoleAction, events: ConsoleActionEvent[]): string {
  const lines: string[] = [];

  lines.push(['Action', toCsvCell(
    action.bodyRemovedAtMs
      ? 'Removed under a retention rule. The history below is kept.'
      : action.title
  )].join(','));
  lines.push(['Status', toCsvCell(describeActionStatus(action.status))].join(','));
  lines.push(['Priority', toCsvCell(action.priority)].join(','));
  lines.push(['Responsible team', toCsvCell(action.responsibleGroupName)].join(','));
  lines.push(['Responsible person', toCsvCell(action.responsiblePersonName || 'Nobody named')].join(','));
  lines.push(['Raised by', toCsvCell(action.createdByName)].join(','));
  lines.push(['Raised in', toCsvCell(action.sourceChatName)].join(','));
  lines.push(['Raised at (UTC)', toCsvCell(formatTime(action.createdAtMs))].join(','));
  lines.push(['Due (UTC)', toCsvCell(formatTime(action.dueAtMs))].join(','));
  lines.push(['Completed by', toCsvCell(action.completedByName || '')].join(','));
  lines.push(['Completed at (UTC)', toCsvCell(formatTime(action.completedAtMs))].join(','));
  lines.push(['What was done', toCsvCell(action.completionNote || '')].join(','));
  lines.push(['Verified by', toCsvCell(action.verifiedByName || '')].join(','));
  lines.push(['Verified at (UTC)', toCsvCell(formatTime(action.verifiedAtMs))].join(','));
  lines.push('');
  lines.push(['What happened', 'Who', 'When (UTC)', 'Note'].join(','));

  for (const event of events) {
    lines.push(
      [
        toCsvCell(describeEvent(event)),
        toCsvCell(event.actorName),
        toCsvCell(formatTime(event.atMs)),
        toCsvCell(event.note || '')
      ].join(',')
    );
  }

  return lines.join('\n');
}

/** Every action in one file, for a period rather than a single case. */
export function buildActionRegisterCsv(actions: ConsoleAction[]): string {
  const lines: string[] = [];

  lines.push([
    'Action',
    'Status',
    'Priority',
    'Responsible team',
    'Responsible person',
    'Raised by',
    'Raised in',
    'Raised at (UTC)',
    'Completed by',
    'Completed at (UTC)',
    'Verified by',
    'Verified at (UTC)'
  ].join(','));

  for (const action of actions) {
    lines.push(
      [
        toCsvCell(action.bodyRemovedAtMs ? 'Removed under a retention rule' : action.title),
        toCsvCell(describeActionStatus(action.status)),
        toCsvCell(action.priority),
        toCsvCell(action.responsibleGroupName),
        toCsvCell(action.responsiblePersonName || 'Nobody named'),
        toCsvCell(action.createdByName),
        toCsvCell(action.sourceChatName),
        toCsvCell(formatTime(action.createdAtMs)),
        toCsvCell(action.completedByName || ''),
        toCsvCell(formatTime(action.completedAtMs)),
        toCsvCell(action.verifiedByName || ''),
        toCsvCell(formatTime(action.verifiedAtMs))
      ].join(',')
    );
  }

  return lines.join('\n');
}

export function buildActionFileName(action: ConsoleAction): string {
  const safeTitle = action.title
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'action';
  const day = new Date(action.createdAtMs).toISOString().slice(0, 10);

  return `${safeTitle}-${day}-action.csv`;
}

export function buildActionRegisterFileName(): string {
  return `actions-register-${new Date().toISOString().slice(0, 10)}.csv`;
}
