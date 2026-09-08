import { describe, expect, it } from 'vitest';
import {
  announcementBelongsInChat,
  findAnnouncementsForChatList,
  countOutstandingForReader,
  findAnnouncementToPin
} from './announcementChatMatching';
import type { Announcement } from './announcementApi';

/**
 * Every test here is a row of section 8a of the plan. If a rule is removed, one
 * of these fails.
 */

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

const reader = { departmentId: 'dept_production', uid: 'user_worker' };

const productionChat = {
  directContactUid: null,
  chatDepartmentId: 'dept_production',
  groupId: 'group_production_default',
  isDepartmentDefaultChat: true
};

const lineAChat = {
  directContactUid: null,
  chatDepartmentId: 'dept_production',
  groupId: 'group_line_a',
  isDepartmentDefaultChat: false
};

const warehouseChat = {
  directContactUid: null,
  chatDepartmentId: 'dept_warehouse',
  groupId: 'group_warehouse_default',
  isDepartmentDefaultChat: true
};

describe('which chat an announcement appears in', () => {
  it('pins a group announcement in that group and nowhere else', () => {
    const groupNotice = announcement({
      audiences: [{ kind: 'GROUP', targetId: 'group_line_a', targetName: 'Line A' }]
    });

    expect(announcementBelongsInChat(groupNotice, lineAChat, reader)).toBe(true);
    expect(announcementBelongsInChat(groupNotice, productionChat, reader)).toBe(false);
  });

  it('pins a department announcement in that department default chat', () => {
    const departmentNotice = announcement({
      audiences: [{ kind: 'DEPARTMENT', targetId: 'dept_production', targetName: 'Production' }]
    });

    expect(announcementBelongsInChat(departmentNotice, productionChat, reader)).toBe(true);
    // Not in an ordinary group inside the department: it would appear twice.
    expect(announcementBelongsInChat(departmentNotice, lineAChat, reader)).toBe(false);
    expect(announcementBelongsInChat(departmentNotice, warehouseChat, reader)).toBe(false);
  });

  it('pins a company-wide announcement in the reader own department chat', () => {
    // There is no company-wide chat, so this is where everyone sees it.
    expect(announcementBelongsInChat(announcement(), productionChat, reader)).toBe(true);
  });

  it('does not pin a company-wide announcement in another department chat', () => {
    // Otherwise somebody in three departments' chats sees the same notice
    // three times.
    expect(announcementBelongsInChat(announcement(), warehouseChat, reader)).toBe(false);
  });

  it('shows a sender nothing for their own announcement', () => {
    const mine = announcement({ createdByUid: reader.uid });

    expect(announcementBelongsInChat(mine, productionChat, reader)).toBe(false);
  });
});

describe('findAnnouncementToPin', () => {
  it('ignores anything already confirmed', () => {
    const done = announcement({ myStatus: 'ACKNOWLEDGED' });

    expect(findAnnouncementToPin([done], productionChat, reader)).toBeNull();
  });

  it('ignores anything that never asked for a reply', () => {
    const noReply = announcement({ requiresAcknowledgement: false });

    expect(findAnnouncementToPin([noReply], productionChat, reader)).toBeNull();
  });

  it('shows the newest when several are waiting', () => {
    const older = announcement({ announcementId: 'older', createdAtMs: 1_000 });
    const newer = announcement({ announcementId: 'newer', createdAtMs: 9_000 });

    expect(findAnnouncementToPin([older, newer], productionChat, reader)?.announcementId).toBe(
      'newer'
    );
  });

  it('returns nothing when there is nothing, which is the usual case', () => {
    expect(findAnnouncementToPin([], productionChat, reader)).toBeNull();
  });
});

describe('countOutstandingForReader', () => {
  it('counts only what still needs a reply', () => {
    expect(
      countOutstandingForReader([
        announcement({ announcementId: '1' }),
        announcement({ announcementId: '2', myStatus: 'ACKNOWLEDGED' }),
        announcement({ announcementId: '3', requiresAcknowledgement: false }),
        announcement({ announcementId: '4', myStatus: 'READ' })
      ])
    ).toBe(2);
  });
});

describe('a notice sent to one person', () => {
  const personal = announcement({
    announcementId: 'personal',
    audienceSummary: 'Dev Worker',
    audiences: [{ kind: 'PERSON', targetId: 'user_worker', targetName: 'Dev Worker' }],
    createdByUid: 'user_org_admin'
  });

  const chatWithSender = {
    chatDepartmentId: null,
    directContactUid: 'user_org_admin',
    groupId: null,
    isDepartmentDefaultChat: false
  };

  it('pins in the chat with whoever sent it', () => {
    expect(announcementBelongsInChat(personal, chatWithSender, reader)).toBe(true);
  });

  it('does not pin in a chat with somebody else', () => {
    expect(
      announcementBelongsInChat(personal, { ...chatWithSender, directContactUid: 'someone_else' }, reader)
    ).toBe(false);
  });

  it('does not pin for a different person', () => {
    expect(
      announcementBelongsInChat(personal, chatWithSender, { ...reader, uid: 'another_worker' })
    ).toBe(false);
  });

  it('is listed at the top of the chat list until confirmed', () => {
    expect(findAnnouncementsForChatList([personal], reader).map((a) => a.announcementId)).toEqual([
      'personal'
    ]);
    expect(
      findAnnouncementsForChatList([{ ...personal, myStatus: 'ACKNOWLEDGED' }], reader)
    ).toEqual([]);
  });

  it('does not list a group announcement there, which has a chat of its own', () => {
    expect(findAnnouncementsForChatList([announcement()], reader)).toEqual([]);
  });
});
