import type { Announcement, AnnouncementRecipientStatus } from './announcementApi';

/**
 * Turning an announcement into the words shown on screen.
 *
 * Kept out of the screen so it can be tested without a phone. Every sentence a
 * person reads about a safety notice is worth getting right, and a wrong count
 * on an audit screen is worse than no count.
 */

/** Newest first, and anything still needing a reply above everything else. */
export function sortAnnouncementsForReader(announcements: Announcement[]): Announcement[] {
  const needsReply = (entry: Announcement) =>
    entry.requiresAcknowledgement && entry.myStatus !== 'ACKNOWLEDGED';

  return [...announcements].sort((left, right) => {
    if (needsReply(left) !== needsReply(right)) {
      return needsReply(left) ? -1 : 1;
    }

    return right.createdAtMs - left.createdAtMs;
  });
}

/** How many still owe an answer. Never negative, whatever the server says. */
export function countOutstanding(announcement: Announcement): number {
  return Math.max(announcement.expectedRecipientCount - announcement.acknowledgedCount, 0);
}

/**
 * The line under an announcement, for the person who sent it.
 *
 * Plain counting, not percentages. "40 of 43" is what somebody repeats to an
 * inspector; "93%" is not.
 */
export function describeAcknowledgement(announcement: Announcement): string {
  if (!announcement.requiresAcknowledgement) {
    return `Sent to ${announcement.expectedRecipientCount} ${
      announcement.expectedRecipientCount === 1 ? 'person' : 'people'
    }. No reply needed.`;
  }

  const outstanding = countOutstanding(announcement);

  if (outstanding === 0) {
    return `Everyone has confirmed. ${announcement.acknowledgedCount} of ${announcement.expectedRecipientCount}.`;
  }

  return `${announcement.acknowledgedCount} of ${announcement.expectedRecipientCount} confirmed. ${outstanding} still to reply.`;
}

/** What the recipient is told about their own state. */
export function describeMyStatus(
  status: AnnouncementRecipientStatus | null,
  acknowledgedAtMs?: number | null
): string {
  if (status === 'ACKNOWLEDGED') {
    return acknowledgedAtMs
      ? `You confirmed this on ${new Date(acknowledgedAtMs).toLocaleString()}.`
      : 'You confirmed this.';
  }

  return 'Please confirm you have read this.';
}

/** Who it went to, in words rather than a code. */
export function describeAudience(announcement: Announcement): string {
  if (announcement.audienceSummary) {
    return announcement.audienceSummary;
  }

  const first = announcement.audiences?.[0];

  if (!first) {
    return 'Nobody';
  }

  if (first.kind === 'ORGANIZATION') {
    return 'Everyone at the company';
  }

  return first.kind === 'DEPARTMENT' ? `${first.targetName} department` : first.targetName;
}

/** True when this one should sit pinned at the top until it is dealt with. */
export function shouldPinToTop(announcement: Announcement): boolean {
  return announcement.requiresAcknowledgement && announcement.myStatus !== 'ACKNOWLEDGED';
}

/**
 * How many announcements still want something from this person.
 *
 * Two things count, and they are not the same: one nobody has read yet, and one
 * that was read but still needs confirming. Counting only the unread would
 * clear the badge the moment a notice requiring a signature was glanced at,
 * which is the moment it starts mattering most.
 *
 * A person's own announcements never count. Sending something is not a task
 * left undone, and a badge over your own notice is a badge that can never be
 * cleared.
 */
export function countAnnouncementsNeedingAttention(
  announcements: Announcement[],
  currentUid: string
): number {
  return announcements.filter((announcement) => {
    if (announcement.createdByUid === currentUid) {
      return false;
    }

    // Null means they are not a recipient at all, so nothing is owed.
    if (!announcement.myStatus) {
      return false;
    }

    if (announcement.myStatus === 'DELIVERED') {
      return true;
    }

    return announcement.requiresAcknowledgement && announcement.myStatus !== 'ACKNOWLEDGED';
  }).length;
}
