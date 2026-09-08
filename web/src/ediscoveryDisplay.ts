import type {
  ArchivedMessageHit,
  ArchiveUnreadableReason,
  ComplianceExportSummary
} from './complianceApi';

/**
 * The words the eDiscovery screen shows.
 *
 * Written for an Org Admin, not an engineer. The people who run a search here
 * are responding to a legal request, and every phrase has to survive being read
 * out to somebody who will rely on it — so "NOT_ARCHIVED" becomes a sentence
 * that says whether the gap can be fixed, and an incomplete export says so in
 * the first words rather than in a count somebody has to total up.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SearchHitRow {
  attachments: string;
  conversation: string;
  isReadable: boolean;
  preview: string;
  sender: string;
  sentAt: string;
}

export function formatUnreadableReason(reason: ArchiveUnreadableReason): string {
  switch (reason) {
    case 'NOT_ARCHIVED':
      return 'Sent before this organization kept a compliance copy. It cannot be recovered.';
    case 'NO_ARCHIVE_KEY':
      return 'This organization has no compliance key yet, so no message can be read.';
    case 'DECRYPT_FAILED':
      return 'The copy exists but could not be opened. Report this.';
    default:
      return 'This message could not be read.';
  }
}

export function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${Math.max(sizeBytes, 0)} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let value = sizeBytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10} ${units[unitIndex]}`;
}

export function formatSentAt(sentAtMs: number, nowMs: number): string {
  const date = new Date(sentAtMs);
  const dayLabel = date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const timeLabel = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  // Anything inside a day gets the time only in the relative line, because a
  // search over "yesterday" is common and the date repeated on every row is
  // noise.
  if (nowMs - sentAtMs < DAY_MS && nowMs >= sentAtMs) {
    return `Today ${timeLabel}`;
  }

  return `${dayLabel} ${timeLabel}`;
}

export function toSearchHitRow(hit: ArchivedMessageHit, nowMs: number): SearchHitRow {
  const isReadable = hit.unreadableReason === null;

  return {
    attachments: hit.media.length
      ? `${hit.media.length} file${hit.media.length === 1 ? '' : 's'}`
      : '',
    conversation: hit.conversationKind === 'GROUP' ? 'Group chat' : 'Direct chat',
    isReadable,
    preview: isReadable
      ? truncatePreview(hit.text || '')
      : formatUnreadableReason(hit.unreadableReason as ArchiveUnreadableReason),
    sender: hit.senderUid,
    sentAt: formatSentAt(hit.sentAtMs, nowMs)
  };
}

function truncatePreview(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();

  if (!cleaned) {
    return '(no text, attachment only)';
  }

  return cleaned.length > 160 ? `${cleaned.slice(0, 159)}…` : cleaned;
}

/**
 * One sentence describing an export, leading with whether it is complete.
 *
 * An administrator forwards these to a lawyer. If something is missing, that
 * has to be the first thing read, not a number they have to compare against
 * another number.
 */
export function describeExport(summary: ComplianceExportSummary): string {
  const messages = `${summary.includedMessages} message${summary.includedMessages === 1 ? '' : 's'}`;
  const files = summary.includedMediaFiles
    ? ` and ${summary.includedMediaFiles} file${summary.includedMediaFiles === 1 ? '' : 's'}`
    : '';

  if (summary.completeness === 'COMPLETE') {
    return `Complete: ${messages}${files}, ${formatBytes(summary.sizeBytes)}.`;
  }

  const missing: string[] = [];

  if (summary.excludedMessages) {
    missing.push(`${summary.excludedMessages} message${summary.excludedMessages === 1 ? '' : 's'}`);
  }

  if (summary.excludedMediaFiles) {
    missing.push(`${summary.excludedMediaFiles} file${summary.excludedMediaFiles === 1 ? '' : 's'}`);
  }

  return `Incomplete: ${messages}${files} included, ${missing.join(' and ')} could not be included.`
    + ' The manifest inside says why.';
}

/**
 * Whether the criteria are worth sending.
 *
 * Not a safety rule — an organization-wide search is legitimate. It exists so an
 * administrator who mistypes a date range is told before they wait for a search
 * that was never going to match anything.
 */
export function validateSearchCriteria(input: {
  fromMs: number | null;
  toMs: number | null;
}): string | null {
  if (input.fromMs !== null && input.toMs !== null && input.fromMs > input.toMs) {
    return 'The start date is after the end date.';
  }

  return null;
}

/**
 * A person's name for display, falling back to their id.
 *
 * Search results carry ids, and an Org Admin reading a result cannot act on one.
 * The fallback matters: somebody who has left the organization is no longer in
 * the staff list, and showing a blank sender for their messages would be worse
 * than showing the raw id.
 */
export function nameForUid(
  people: { displayName: string; uid: string }[],
  uid: string
): string {
  return people.find((person) => person.uid === uid)?.displayName || uid;
}

/**
 * Elapsed time on a running export, as a person would say it.
 *
 * Deliberately not a percentage. The export happens inside one request on the
 * server, so a bar here could only be invented — and an invented progress bar
 * on a compliance screen is worse than an honest clock, because it implies the
 * system knows something it does not.
 */
export function formatElapsed(seconds: number): string {
  if (seconds < 60) {
    return `${Math.max(seconds, 0)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

/** A date the user picked, shown the way they would write it. */
export function formatPickedDate(value: string): string {
  if (!value) {
    return '';
  }

  const parsed = new Date(`${value}T00:00:00`);

  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** An ISO day string from a picked Date, in the viewer's own timezone. */
export function toDateOnlyValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  // Built from local parts rather than toISOString, which shifts to UTC and can
  // land a picked date on the day before.
  return `${year}-${month}-${day}`;
}

/**
 * How far an export has got, as a real fraction of the work.
 *
 * Null while the total is still unknown — during the search, nobody knows how
 * many messages there are, and a bar that starts moving before the work is
 * measured is a guess dressed up as a fact. The console shows an
 * indeterminate state instead until there is something true to show.
 */
export function exportProgressFraction(summary: {
  processedMessages?: number;
  state?: string;
  totalMessages?: number;
}): number | null {
  if (summary.state === 'READY') {
    return 1;
  }

  const total = summary.totalMessages || 0;

  if (!total) {
    return null;
  }

  const processed = Math.min(Math.max(summary.processedMessages || 0, 0), total);

  // Held just short of complete while packaging: writing the file still has to
  // happen, and showing 100% before the download exists invites a click that
  // fails.
  return Math.min(processed / total, 0.99);
}

/** Whether the console should keep polling this export. */
export function isExportInProgress(summary: { state?: string }): boolean {
  return summary.state === 'PENDING' || summary.state === 'RUNNING';
}

/** One line describing a running or finished export. */
export function describeExportProgress(summary: {
  error?: string | null;
  processedMessages?: number;
  stage?: string;
  state?: string;
  totalMessages?: number;
}): string {
  if (summary.state === 'FAILED') {
    return summary.error || 'This export could not be built.';
  }

  if (summary.state === 'READY') {
    return 'Ready to download.';
  }

  const total = summary.totalMessages || 0;

  if (total) {
    return `${summary.stage || 'Working'}: ${summary.processedMessages || 0} of ${total}.`;
  }

  return summary.stage || 'Working';
}
