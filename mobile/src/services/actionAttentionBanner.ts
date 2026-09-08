import type { PersonalActionCounts } from './actionApi';

/**
 * The line above the chat list, telling somebody what they still owe.
 *
 * Chat is where people already are, which is the only reason this is worth
 * putting there. An Actions tab nobody opens tells nobody anything.
 *
 * Two rules do the work. It says nothing when there is nothing — a line
 * showing zeroes is a line the eye stops reading, and then it is worthless on
 * the day it matters. And overdue is named first, because that is the part that
 * needs somebody today and the rest can wait.
 */

export interface ActionAttentionBanner {
  /** Whether anything in it is late, so the line can be coloured accordingly. */
  isUrgent: boolean;
  text: string;
}

export function buildActionAttentionBanner(
  counts: PersonalActionCounts | null
): ActionAttentionBanner | null {
  if (!counts) {
    return null;
  }

  const parts: string[] = [];

  if (counts.overdue > 0) {
    parts.push(`${counts.overdue} overdue`);
  }

  if (counts.open > 0) {
    parts.push(`${counts.open} open`);
  }

  if (counts.awaitingVerification > 0) {
    parts.push(`${counts.awaitingVerification} to verify`);
  }

  if (!parts.length) {
    return null;
  }

  return {
    isUrgent: counts.overdue > 0,
    // Short, because it sits on one line above a list somebody came here to
    // read. The detail is one tap away.
    text: parts.join(' · ')
  };
}
