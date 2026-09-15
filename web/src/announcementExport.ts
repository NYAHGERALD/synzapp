import type {
  ConsoleAnnouncement,
  ConsoleAnnouncementRecipient
} from './complianceApi';

/**
 * The acknowledgement record, as a file an auditor can open.
 *
 * CSV rather than a spreadsheet format, because it opens in Excel, in Numbers,
 * in Google Sheets and in a text editor, and because an auditor asked for
 * "the list" wants something they can sort, not something they must install
 * software to read.
 */

/**
 * Escapes one value.
 *
 * A leading =, +, - or @ makes a spreadsheet treat text as a formula, which is
 * how a name becomes an error message, or worse, a command. Prefixing an
 * apostrophe stops it being read as one.
 */
export function toCsvCell(value: string): string {
  // Tab and carriage return too: some spreadsheets strip them before deciding
  // whether the cell is a formula, so the character after them is what counts.
  const dangerous = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;

  return `"${dangerous.replace(/"/g, '""')}"`;
}

function formatTime(ms: number | null): string {
  return ms ? new Date(ms).toISOString() : '';
}

function describeStatus(recipient: ConsoleAnnouncementRecipient): string {
  if (recipient.acknowledgedAtMs) {
    return 'Confirmed';
  }

  return recipient.readAtMs ? 'Opened, not confirmed' : 'Not opened';
}

/**
 * The whole record: what was said, who it went to, and what each person did.
 *
 * The heading block matters as much as the rows. A list of names with no
 * statement of what they were confirming proves nothing on its own.
 */
export function buildAcknowledgementCsv(
  announcement: ConsoleAnnouncement,
  recipients: ConsoleAnnouncementRecipient[]
): string {
  const lines: string[] = [];

  lines.push(['Announcement', toCsvCell(announcement.subject)].join(','));
  lines.push(['Sent by', toCsvCell(announcement.createdByName)].join(','));
  lines.push(['Sent at', toCsvCell(new Date(announcement.createdAtMs).toISOString())].join(','));
  lines.push(['Sent to', toCsvCell(announcement.audienceSummary)].join(','));
  lines.push(['People', toCsvCell(String(announcement.expectedRecipientCount))].join(','));
  lines.push(['Confirmed', toCsvCell(String(announcement.acknowledgedCount))].join(','));
  lines.push(
    [
      'Message',
      toCsvCell(
        announcement.bodyRemovedAtMs
          ? 'Removed under a retention rule. The confirmations below are kept.'
          : announcement.body
      )
    ].join(',')
  );
  lines.push('');
  lines.push(['Name', 'Status', 'Opened at (UTC)', 'Confirmed at (UTC)'].join(','));

  for (const recipient of recipients) {
    lines.push(
      [
        toCsvCell(recipient.displayName),
        toCsvCell(describeStatus(recipient)),
        toCsvCell(formatTime(recipient.readAtMs)),
        toCsvCell(formatTime(recipient.acknowledgedAtMs))
      ].join(',')
    );
  }

  return lines.join('\n');
}

/** A file name an auditor can file: the subject, and the date it was sent. */
export function buildAcknowledgementFileName(announcement: ConsoleAnnouncement): string {
  const safeSubject = announcement.subject
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'announcement';
  const day = new Date(announcement.createdAtMs).toISOString().slice(0, 10);

  return `${safeSubject}-${day}-acknowledgements.csv`;
}
