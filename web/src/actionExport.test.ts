import { describe, expect, it } from 'vitest';
import {
  buildActionCsv,
  buildActionFileName,
  buildActionRegisterCsv,
  describeActionStatus
} from './actionExport';
import type { ConsoleAction, ConsoleActionEvent } from './complianceApi';

function action(overrides: Partial<ConsoleAction> = {}): ConsoleAction {
  return {
    actionId: 'action_1',
    attachmentCount: 0,
    blockedReason: null,
    bodyRemovedAtMs: null,
    completedAtMs: 1700000200000,
    completedByName: 'Dev Fitter',
    completedByUid: 'user_fitter',
    completionNote: 'Belt replaced and line restarted',
    createdAtMs: 1700000000000,
    createdByName: 'Cara Operator',
    createdByUid: 'user_operator',
    dueAtMs: null,
    priority: 'HIGH',
    responsibleDepartmentId: 'dept_maintenance',
    responsibleGroupId: 'group_maintenance',
    responsibleGroupName: 'Maintenance',
    responsiblePersonName: null,
    responsiblePersonUid: null,
    sourceChatId: 'chat_line_5',
    sourceChatName: 'Line 5',
    sourceMessageId: 'message_1',
    startedAtMs: null,
    status: 'VERIFIED',
    title: 'Issue with tortillas on line 5',
    verifiedAtMs: 1700000300000,
    verifiedByName: 'Cara Operator',
    verifiedByUid: 'user_operator',
    ...overrides
  };
}

const events: ConsoleActionEvent[] = [
  {
    actorName: 'Cara Operator',
    actorUid: 'user_operator',
    atMs: 1700000000000,
    eventId: 'event_1',
    fromStatus: null,
    kind: 'CREATED',
    note: null,
    toStatus: 'OPEN'
  },
  {
    actorName: 'Dev Fitter',
    actorUid: 'user_fitter',
    atMs: 1700000200000,
    eventId: 'event_2',
    fromStatus: 'OPEN',
    kind: 'STATUS_CHANGED',
    note: 'Belt replaced',
    toStatus: 'DONE'
  }
];

describe('the action export', () => {
  it('states who did the work and who verified it, not just the status', () => {
    const csv = buildActionCsv(action(), events);

    expect(csv).toContain('Dev Fitter');
    expect(csv).toContain('Cara Operator');
    expect(csv).toContain('Verified at (UTC)');
  });

  it('includes the history in order', () => {
    const csv = buildActionCsv(action(), events);
    const raised = csv.indexOf('Raised from a message');
    const done = csv.indexOf('Marked done');

    expect(raised).toBeGreaterThan(-1);
    expect(done).toBeGreaterThan(raised);
  });

  it('says the words were removed but still shows the history', () => {
    const csv = buildActionCsv(
      action({ bodyRemovedAtMs: 1700000400000, title: '' }),
      events
    );

    expect(csv).toContain('Removed under a retention rule');
    expect(csv).toContain('Dev Fitter');
  });

  it('never leaves the responsible person blank in the register', () => {
    const csv = buildActionRegisterCsv([action()]);

    expect(csv).toContain('Nobody named');
  });
});

describe('spreadsheet safety', () => {
  it('defuses a title that would otherwise run as a formula', () => {
    const csv = buildActionCsv(action({ title: '=cmd|calc' }), []);

    expect(csv).toContain('"\'=cmd|calc"');
    expect(csv).not.toContain('"=cmd|calc"');
  });

  it('defuses a name in the register too', () => {
    const csv = buildActionRegisterCsv([action({ createdByName: '+1 attacker' })]);

    expect(csv).toContain('"\'+1 attacker"');
  });

  it('escapes a quote rather than breaking the row', () => {
    const csv = buildActionCsv(action({ title: 'The "big" mixer' }), []);

    expect(csv).toContain('"The ""big"" mixer"');
  });
});

describe('the file name', () => {
  it('is something an auditor can file, with the date', () => {
    expect(buildActionFileName(action())).toMatch(
      /^Issue-with-tortillas-on-line-5-\d{4}-\d{2}-\d{2}-action\.csv$/
    );
  });

  it('still produces a name when the title has been removed', () => {
    expect(buildActionFileName(action({ title: '' }))).toContain('action-');
  });
});

describe('status wording', () => {
  it('never says just Done, because done is not verified', () => {
    expect(describeActionStatus('DONE')).toBe('Done, not verified');
    expect(describeActionStatus('VERIFIED')).toBe('Verified');
  });
});
