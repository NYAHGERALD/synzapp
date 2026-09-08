import { describe, expect, it } from 'vitest';
import {
  buildAcknowledgementCsv,
  buildAcknowledgementFileName,
  toCsvCell
} from './announcementExport';
import type { ConsoleAnnouncement, ConsoleAnnouncementRecipient } from './complianceApi';

const announcement: ConsoleAnnouncement = {
  acknowledgedCount: 1,
  announcementId: 'a1',
  audienceSummary: 'Production and Line A',
  audiences: [],
  body: 'Wash line 3 down completely before the next run.',
  bodyRemovedAtMs: null,
  createdAtMs: Date.UTC(2026, 2, 4, 9, 30),
  createdByName: 'Ada Org',
  createdByUid: 'u1',
  expectedRecipientCount: 2,
  readCount: 2,
  requiresAcknowledgement: true,
  subject: 'Allergen change on line 3'
};

const recipients: ConsoleAnnouncementRecipient[] = [
  {
    acknowledgedAtMs: Date.UTC(2026, 2, 4, 10, 0),
    departmentId: 'd1',
    displayName: 'Dev Worker',
    readAtMs: Date.UTC(2026, 2, 4, 9, 45),
    status: 'ACKNOWLEDGED',
    uid: 'u2'
  },
  {
    acknowledgedAtMs: null,
    departmentId: 'd1',
    displayName: 'Eli Worker',
    readAtMs: null,
    status: 'DELIVERED',
    uid: 'u3'
  }
];

describe('toCsvCell', () => {
  it('quotes and escapes quotes', () => {
    expect(toCsvCell('He said "no"')).toBe('"He said ""no"""');
  });

  it('defuses a value a spreadsheet would treat as a formula', () => {
    // A name beginning with = becomes a formula in Excel, which is how a
    // record turns into an error, or something worse.
    expect(toCsvCell('=1+1')).toBe('"\'=1+1"');
    expect(toCsvCell('+44 7700 900000')).toBe('"\'+44 7700 900000"');
    expect(toCsvCell('-5')).toBe('"\'-5"');
    expect(toCsvCell('@someone')).toBe('"\'@someone"');
  });
});

describe('buildAcknowledgementCsv', () => {
  it('states what was being confirmed before listing who confirmed it', () => {
    const csv = buildAcknowledgementCsv(announcement, recipients);

    expect(csv).toContain('"Allergen change on line 3"');
    expect(csv).toContain('"Wash line 3 down completely before the next run."');
    expect(csv).toContain('"Production and Line A"');
  });

  it('lists each person with what they actually did', () => {
    const csv = buildAcknowledgementCsv(announcement, recipients);

    expect(csv).toContain('"Dev Worker","Confirmed"');
    expect(csv).toContain('"Eli Worker","Not opened"');
  });

  it('says so when retention removed the words, and still lists the people', () => {
    const csv = buildAcknowledgementCsv(
      { ...announcement, body: '', bodyRemovedAtMs: Date.now() },
      recipients
    );

    expect(csv).toContain('Removed under a retention rule');
    expect(csv).toContain('"Dev Worker","Confirmed"');
  });
});

describe('buildAcknowledgementFileName', () => {
  it('names the file after the subject and the day', () => {
    expect(buildAcknowledgementFileName(announcement)).toBe(
      'Allergen-change-on-line-3-2026-03-04-acknowledgements.csv'
    );
  });

  it('copes with a subject that is all punctuation', () => {
    expect(buildAcknowledgementFileName({ ...announcement, subject: '!!!' })).toBe(
      'announcement-2026-03-04-acknowledgements.csv'
    );
  });
});
