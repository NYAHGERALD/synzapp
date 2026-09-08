import { toCsvCell } from './announcementExport';
import type { ConsoleAuditEvent } from './complianceApi';

/**
 * The audit log as a file an auditor can be handed.
 *
 * Every cell goes through `toCsvCell`, which quotes it and defuses a leading
 * `=`, `+`, `-` or `@`. Without that a reason somebody typed into the app is a
 * formula the moment the file is opened in Excel — an audit export is exactly
 * the file most likely to be opened by somebody who trusts it.
 */

const COLUMNS = [
  'Time (UTC)',
  'Event',
  'Outcome',
  'Actor',
  'Reason',
  'Details',
  'IP address'
] as const;

/** Flattened rather than nested, because a spreadsheet has no idea what JSON is. */
function describeMetadata(metadata: Record<string, unknown>): string {
  return Object.entries(metadata)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('; ');
}

export function buildAuditCsv(events: ConsoleAuditEvent[]): string {
  const lines = [COLUMNS.map((column) => toCsvCell(column)).join(',')];

  for (const event of events) {
    lines.push([
      toCsvCell(event.createdAtMs ? new Date(event.createdAtMs).toISOString() : ''),
      toCsvCell(event.action),
      toCsvCell(event.status),
      toCsvCell(event.actorUid || ''),
      toCsvCell(event.reason || ''),
      toCsvCell(describeMetadata(event.metadata)),
      toCsvCell(event.ipAddress || '')
    ].join(','));
  }

  return lines.join('\n');
}

export function buildAuditFileName(fromMs: number | null, toMs: number | null): string {
  const stamp = (ms: number | null) => (ms ? new Date(ms).toISOString().slice(0, 10) : 'all');

  return `synzapp-audit-${stamp(fromMs)}-to-${stamp(toMs)}.csv`;
}
