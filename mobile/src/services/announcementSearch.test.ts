import { describe, expect, it } from 'vitest';
import type { Announcement } from './announcementApi';
import { buildAnnouncementSearchText, filterAnnouncements } from './announcementSearch';

function makeAnnouncement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    acknowledgedCount: 0,
    announcementId: 'a1',
    audiences: [{ kind: 'GROUP', targetId: 'g1', targetName: 'Bakery' }],
    audienceSummary: '1 group',
    body: 'Please let us clean the oven before the shift ends.',
    bodyRemovedAtMs: null,
    createdAtMs: 1,
    createdByName: 'Gerald Nyah',
    createdByUid: 'u1',
    expectedRecipientCount: 1,
    myStatus: null,
    readCount: 0,
    requiresAcknowledgement: true,
    subject: 'Please clean the oven',
    ...overrides
  } as Announcement;
}

describe('what a notice can be found by', () => {
  it('reaches the subject, the body, the sender and the audience', () => {
    const text = buildAnnouncementSearchText(makeAnnouncement());

    expect(text).toContain('Please clean the oven');
    expect(text).toContain('clean the oven before the shift');
    expect(text).toContain('Gerald Nyah');
    expect(text).toContain('Bakery');
  });
});

describe('searching notices', () => {
  const notices = [
    makeAnnouncement(),
    makeAnnouncement({
      announcementId: 'a2',
      audiences: [{ kind: 'DEPARTMENT', targetId: 'd1', targetName: 'Packing' }],
      body: 'The line stops at four.',
      createdByName: 'Ada First',
      subject: 'Shift change'
    })
  ];

  it('gives everything back for an empty search', () => {
    expect(filterAnnouncements(notices, '   ').length).toBe(2);
  });

  it('finds one by the department it went to', () => {
    expect(filterAnnouncements(notices, 'packing').map((n) => n.announcementId)).toEqual(['a2']);
  });

  it('finds one by who sent it', () => {
    expect(filterAnnouncements(notices, 'gerald').map((n) => n.announcementId)).toEqual(['a1']);
  });

  it('finds one by a phrase only the body holds', () => {
    expect(filterAnnouncements(notices, 'line stops').map((n) => n.announcementId)).toEqual(['a2']);
  });

  it('takes the words in any order', () => {
    expect(filterAnnouncements(notices, 'oven bakery').map((n) => n.announcementId)).toEqual(['a1']);
    expect(filterAnnouncements(notices, 'bakery oven').map((n) => n.announcementId)).toEqual(['a1']);
  });

  it('ignores case and stray spacing', () => {
    expect(filterAnnouncements(notices, '  BAKERY   OVEN ').length).toBe(1);
  });

  it('finds nothing rather than guessing', () => {
    expect(filterAnnouncements(notices, 'forklift')).toEqual([]);
  });
});
