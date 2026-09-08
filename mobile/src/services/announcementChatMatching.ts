import type { Announcement } from './announcementApi';

/**
 * Which announcement, if any, belongs at the top of the chat you just opened.
 *
 * Decided here, in memory, from announcements already loaded. Opening a chat
 * must not wait on a network call it never needed before: people open chats
 * fifty times a day and would feel every one of them.
 */

export interface ChatContext {
  /** The department this chat belongs to, when it is a department's own chat. */
  chatDepartmentId: string | null;
  /** The person on the other side, for a one-to-one chat. */
  directContactUid: string | null;
  /** The group behind this chat, when it is a group chat. */
  groupId: string | null;
  /** True for the chat a department gets automatically. */
  isDepartmentDefaultChat: boolean;
}

export interface ReaderContext {
  departmentId: string | null;
  uid: string;
}

/**
 * Whether this announcement belongs in this chat, for this reader.
 *
 * There is no company-wide chat, so an announcement to everyone appears in the
 * reader's own department chat. Everybody has a department and every department
 * has a chat, so nobody is left without a place to see it.
 */
export function announcementBelongsInChat(
  announcement: Announcement,
  chat: ChatContext,
  reader: ReaderContext
): boolean {
  // Their own notice, shown back to them as something to action, is noise.
  if (announcement.createdByUid === reader.uid) {
    return false;
  }

  // An announcement may name several audiences. It belongs here if any one of
  // them points at this chat, and it is still shown only once.
  return (announcement.audiences || []).some((audience) => {
    // A notice to one person belongs in the chat with whoever sent it. Same
    // rule as everywhere else: it appears in the chat it relates to.
    if (audience.kind === 'PERSON') {
      return (
        audience.targetId === reader.uid &&
        !!chat.directContactUid &&
        chat.directContactUid === announcement.createdByUid
      );
    }

    if (audience.kind === 'GROUP') {
      return !!chat.groupId && chat.groupId === audience.targetId;
    }

    if (audience.kind === 'DEPARTMENT') {
      return (
        chat.isDepartmentDefaultChat &&
        !!chat.chatDepartmentId &&
        chat.chatDepartmentId === audience.targetId
      );
    }

    // Everyone at the company: the reader's own department chat, and only
    // theirs. Pinning it to every chat they are in would show it five times.
    return (
      chat.isDepartmentDefaultChat &&
      !!reader.departmentId &&
      chat.chatDepartmentId === reader.departmentId
    );
  });
}

/**
 * The one to pin at the top of this chat.
 *
 * Only ones still awaiting this person's confirmation, newest first. Returns
 * null when there is nothing to show, which is the ordinary case and must cost
 * nothing.
 */
export function findAnnouncementToPin(
  announcements: Announcement[],
  chat: ChatContext,
  reader: ReaderContext
): Announcement | null {
  let pinned: Announcement | null = null;

  for (const announcement of announcements) {
    if (!announcement.requiresAcknowledgement) {
      continue;
    }

    if (announcement.myStatus === 'ACKNOWLEDGED') {
      continue;
    }

    if (!announcementBelongsInChat(announcement, chat, reader)) {
      continue;
    }

    if (!pinned || announcement.createdAtMs > pinned.createdAtMs) {
      pinned = announcement;
    }
  }

  return pinned;
}

/** How many are waiting on this person, for a badge on the tab. */
export function countOutstandingForReader(announcements: Announcement[]): number {
  return announcements.filter(
    (announcement) =>
      announcement.requiresAcknowledgement && announcement.myStatus !== 'ACKNOWLEDGED'
  ).length;
}

/**
 * Announcements to pin at the top of the chat list.
 *
 * A notice sent to one person may have no chat to sit in: the sender might be
 * somebody they have never messaged. Rather than let it be missed, it is pinned
 * where a person's eye lands when they open the app.
 *
 * The top, not the bottom. Every messaging app puts what matters above the
 * conversations, and a card floating over the tab bar covers the last row.
 */
export function findAnnouncementsForChatList(
  announcements: Announcement[],
  reader: ReaderContext
): Announcement[] {
  return announcements
    .filter((announcement) => announcement.requiresAcknowledgement)
    .filter((announcement) => announcement.myStatus !== 'ACKNOWLEDGED')
    .filter((announcement) => announcement.createdByUid !== reader.uid)
    .filter((announcement) =>
      (announcement.audiences || []).some(
        (audience) => audience.kind === 'PERSON' && audience.targetId === reader.uid
      )
    )
    .sort((left, right) => right.createdAtMs - left.createdAtMs);
}
