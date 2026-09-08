import { describe, expect, it } from 'vitest';
import {
  countAnnouncementsNeedingAttention,
  countOutstanding,
  describeAcknowledgement,
  describeAudience,
  describeMyStatus,
  shouldPinToTop,
  sortAnnouncementsForReader
} from './announcementDisplay';
import type { Announcement } from './announcementApi';

function announcement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    acknowledgedCount: 0,
    announcementId: 'a1',
    body: 'Wash line 3 down completely before the next run.',
    audienceSummary: 'Everyone at the company',
    audiences: [{ kind: 'ORGANIZATION', targetId: null, targetName: 'Everyone' }],
    bodyRemovedAtMs: null,
    createdAtMs: 1_000,
    createdByName: 'Ada Org',
    createdByUid: 'user_org_admin',
    expectedRecipientCount: 43,
    myStatus: 'DELIVERED',
    readCount: 0,
    requiresAcknowledgement: true,
    subject: 'Allergen change',
    ...overrides
  };
}

describe('sortAnnouncementsForReader', () => {
  it('puts anything still needing a reply above everything else', () => {
    const sorted = sortAnnouncementsForReader([
      announcement({ announcementId: 'old-done', createdAtMs: 5_000, myStatus: 'ACKNOWLEDGED' }),
      announcement({ announcementId: 'needs-reply', createdAtMs: 1_000 })
    ]);

    // Newer, but already dealt with, so it goes second.
    expect(sorted.map((entry) => entry.announcementId)).toEqual(['needs-reply', 'old-done']);
  });

  it('is newest first among ones that need nothing', () => {
    const sorted = sortAnnouncementsForReader([
      announcement({ announcementId: 'older', createdAtMs: 1_000, requiresAcknowledgement: false }),
      announcement({ announcementId: 'newer', createdAtMs: 9_000, requiresAcknowledgement: false })
    ]);

    expect(sorted.map((entry) => entry.announcementId)).toEqual(['newer', 'older']);
  });
});

describe('describeAcknowledgement', () => {
  it('counts plainly, the way somebody repeats it to an inspector', () => {
    expect(describeAcknowledgement(announcement({ acknowledgedCount: 40 }))).toBe(
      '40 of 43 confirmed. 3 still to reply.'
    );
  });

  it('says so when everybody has replied', () => {
    expect(
      describeAcknowledgement(announcement({ acknowledgedCount: 43 }))
    ).toBe('Everyone has confirmed. 43 of 43.');
  });

  it('does not ask for replies that were never wanted', () => {
    expect(
      describeAcknowledgement(announcement({ requiresAcknowledgement: false }))
    ).toBe('Sent to 43 people. No reply needed.');
  });

  it('says one person, not one people', () => {
    expect(
      describeAcknowledgement(
        announcement({ expectedRecipientCount: 1, requiresAcknowledgement: false })
      )
    ).toBe('Sent to 1 person. No reply needed.');
  });

  it('never shows a negative number, whatever the server sends', () => {
    // A count ahead of the expected total would otherwise read
    // "-2 still to reply", which destroys trust in the whole screen.
    expect(countOutstanding(announcement({ acknowledgedCount: 45 }))).toBe(0);
  });
});

describe('describeMyStatus', () => {
  it('asks the person who has not replied', () => {
    expect(describeMyStatus('DELIVERED')).toMatch(/please confirm/i);
    expect(describeMyStatus('READ')).toMatch(/please confirm/i);
  });

  it('tells the person who has, and when', () => {
    const when = Date.UTC(2026, 2, 4, 9, 30);

    expect(describeMyStatus('ACKNOWLEDGED', when)).toContain('You confirmed this on');
  });
});

describe('describeAudience', () => {
  it('says who it went to in words', () => {
    expect(describeAudience(announcement())).toBe('Everyone at the company');
    expect(
      describeAudience(
        announcement({
          audienceSummary: '',
          audiences: [{ kind: 'DEPARTMENT', targetId: 'd1', targetName: 'Production' }]
        })
      )
    ).toBe('Production department');
    expect(
      describeAudience(
        announcement({
          audienceSummary: '',
          audiences: [{ kind: 'GROUP', targetId: 'g1', targetName: 'Line A' }]
        })
      )
    ).toBe('Line A');
  });
});

describe('shouldPinToTop', () => {
  it('pins one that still needs a reply, and releases it once given', () => {
    expect(shouldPinToTop(announcement())).toBe(true);
    expect(shouldPinToTop(announcement({ myStatus: 'ACKNOWLEDGED' }))).toBe(false);
    expect(shouldPinToTop(announcement({ requiresAcknowledgement: false }))).toBe(false);
  });
});

describe('the announcements badge', () => {
  it('counts one nobody has opened yet', () => {
    expect(countAnnouncementsNeedingAttention([
      announcement({ createdByUid: 'boss', myStatus: 'DELIVERED' })
    ], 'me')).toBe(1);
  });

  it('keeps counting one that was read but still needs confirming', () => {
    // Clearing the badge the moment a notice requiring a signature is glanced
    // at would drop it exactly when it starts to matter.
    expect(countAnnouncementsNeedingAttention([
      announcement({ createdByUid: 'boss', myStatus: 'READ', requiresAcknowledgement: true })
    ], 'me')).toBe(1);
  });

  it('stops counting once it is confirmed', () => {
    expect(countAnnouncementsNeedingAttention([
      announcement({ createdByUid: 'boss', myStatus: 'ACKNOWLEDGED', requiresAcknowledgement: true })
    ], 'me')).toBe(0);
  });

  it('stops counting a read one that never needed confirming', () => {
    expect(countAnnouncementsNeedingAttention([
      announcement({ createdByUid: 'boss', myStatus: 'READ', requiresAcknowledgement: false })
    ], 'me')).toBe(0);
  });

  it('never counts your own, which you could not clear', () => {
    expect(countAnnouncementsNeedingAttention([
      announcement({ createdByUid: 'me', myStatus: 'DELIVERED' }),
      announcement({ createdByUid: 'me', myStatus: 'READ', requiresAcknowledgement: true })
    ], 'me')).toBe(0);
  });

  it('ignores one addressed to somebody else', () => {
    expect(countAnnouncementsNeedingAttention([
      announcement({ createdByUid: 'boss', myStatus: null })
    ], 'me')).toBe(0);
  });

  it('is zero when there is nothing', () => {
    expect(countAnnouncementsNeedingAttention([], 'me')).toBe(0);
  });
});
