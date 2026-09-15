import { describe, expect, it } from 'vitest';
import { buildAuditCsv } from './auditExport';
import type { ConsoleAuditEvent } from './complianceApi';

function event(overrides: Partial<ConsoleAuditEvent> = {}): ConsoleAuditEvent {
  return {
    action: 'EMPLOYEE_DEACTIVATED',
    actorName: 'Cara Operator',
    actorUid: 'uid_cara',
    createdAtMs: 1700000000000,
    eventId: 'event_1',
    ipAddress: '203.0.113.7',
    metadata: {},
    reason: null,
    status: 'SUCCESS',
    ...overrides
  };
}

describe('the CSV an auditor is handed', () => {
  it('names the person who acted', () => {
    /**
     * This column was the raw Firebase uid alone, so an auditor received a file
     * of 28-character strings with no way to turn any of them into a person.
     */
    const csv = buildAuditCsv([event()]);

    expect(csv).toContain('Cara Operator');
  });

  it('keeps the identifier in its own column', () => {
    // Two people can share a name, and only the identifier settles which one
    // acted.
    const csv = buildAuditCsv([event()]);
    const [header] = csv.split('\n');

    expect(header).toContain('Actor');
    expect(header).toContain('Actor ID');
    expect(csv).toContain('uid_cara');
  });

  it('falls back to the identifier when the directory has no name', () => {
    // Somebody deleted, or an account the directory never knew, must still be
    // identifiable rather than blank.
    const csv = buildAuditCsv([event({ actorName: null })]);

    expect(csv).toContain('uid_cara');
  });

  it('leaves the actor blank when there is no actor at all', () => {
    const csv = buildAuditCsv([event({ actorName: null, actorUid: null })]);

    expect(csv).not.toContain('uid_cara');

    // Every cell is quoted, so an absent actor is two empty quoted cells: the
    // name and the identifier, both blank, rather than a missing column.
    const [, row] = csv.split('\n');
    const cells = row.split(',');

    expect(cells[3]).toBe('""');
    expect(cells[4]).toBe('""');
  });
});
