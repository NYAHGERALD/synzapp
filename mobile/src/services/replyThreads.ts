import type { ChatMessage } from './chatApi';

/**
 * Replies, and the group they make in the conversation.
 *
 * A reply is an ordinary message that happens to name its parent. It is sent
 * when it is sent, so it lands at the bottom of the conversation like anything
 * else — **the message being answered never moves**. What ties the two together
 * across that distance is a count under the original, and a wireframe copy of
 * the original at the head of the group.
 *
 * Kept apart from the components so it can be tested: what counts as one group,
 * and what the count says, are rules rather than layout.
 *
 * See SYNZAPP_REPLY_THREADS_PLAN.md.
 */

export interface ReplyGroupItem {
  /** The message itself. */
  message: ChatMessage;
  /** True for the first reply of a run, which draws the wireframe copy. */
  isGroupStart: boolean;
  /** True for the last reply of a run, which closes the bracket. */
  isGroupEnd: boolean;
}

/** Whether this message answers another one. */
export function isReply(message: ChatMessage): boolean {
  return Boolean(message.replyTo?.messageId);
}

/**
 * Which messages start and end a run of replies to the same parent.
 *
 * Consecutive replies to one message are one group with one wireframe copy at
 * the top: five answers to "send Segit to the front" should not repeat the
 * question five times. A reply to a different message, or an ordinary message
 * in between, starts a new group.
 */
export function markReplyGroups(messages: ChatMessage[]): ReplyGroupItem[] {
  return messages.map((message, index) => {
    const parentId = message.replyTo?.messageId || null;

    if (!parentId) {
      return { isGroupEnd: false, isGroupStart: false, message };
    }

    const previousParentId = messages[index - 1]?.replyTo?.messageId || null;
    const nextParentId = messages[index + 1]?.replyTo?.messageId || null;

    return {
      isGroupEnd: nextParentId !== parentId,
      isGroupStart: previousParentId !== parentId,
      message
    };
  });
}

/**
 * The line under a message that has been answered.
 *
 * Says nothing at all when there are no replies: a row reading "0 replies"
 * under every message in a conversation is noise on every line.
 */
export function describeReplyCount(replyCount: number): string | null {
  const safeCount = Math.max(0, Math.round(replyCount || 0));

  if (safeCount <= 0) {
    return null;
  }

  return safeCount === 1 ? '1 reply' : `${safeCount} replies`;
}

/**
 * Counts kept for the messages on screen.
 *
 * Built from the device's own store rather than from what is loaded, because
 * a parent and its replies are deliberately far apart here — the parent keeps
 * its place in the history and the replies keep theirs. Counting what happens
 * to be in memory would be wrong exactly when the distance is greatest, which
 * is the normal case rather than the edge case.
 */
export type ReplyCountsByMessageId = Record<string, number>;

/** The reply ids in a page of messages, grouped by the message they answer. */
export function collectReplyIdsInMessages(messages: ChatMessage[]): Record<string, string[]> {
  const idsByParent: Record<string, string[]> = {};

  messages.forEach((message) => {
    const parentId = message.replyTo?.messageId;

    if (parentId) {
      idsByParent[parentId] = [...(idsByParent[parentId] || []), message.messageId];
    }
  });

  return idsByParent;
}

/**
 * The two sources joined by identity, not by size.
 *
 * The store knows replies this session never loaded; the loaded messages know
 * one just sent that has not been written yet. **Neither is a superset of the
 * other**, so comparing their sizes cannot work: nine stored against two loaded
 * is eleven if those two are new, and nine if they are two of the nine. A count
 * cannot tell those apart — only the ids can.
 *
 * That mistake shipped once, as `Math.max`, and it undercounted exactly when
 * somebody had just replied: the moment they were most likely to look.
 */
export function mergeReplyIds(
  stored: Record<string, string[]>,
  loaded: Record<string, string[]>
): ReplyCountsByMessageId {
  const counts: ReplyCountsByMessageId = {};
  const parentIds = new Set([...Object.keys(stored), ...Object.keys(loaded)]);

  parentIds.forEach((parentId) => {
    const union = new Set([...(stored[parentId] || []), ...(loaded[parentId] || [])]);

    if (union.size > 0) {
      counts[parentId] = union.size;
    }
  });

  return counts;
}

/**
 * Names whoever wrote the message a reply group is answering.
 *
 * The quotation at the head of a group is drawn in the colour of whoever
 * replied, not whoever was quoted, so without a name there is nothing saying
 * which of the two people it came from — and answering your own message looked
 * identical to answering theirs.
 *
 * "You" for your own, matching how the group member list already refers to the
 * reader. In a group the contact is the room, so the author has to be found by
 * uid; a member who has since left is named rather than left blank, because an
 * unattributed quotation is the thing being fixed here.
 */
export function getReplyAuthorName(input: {
  contactName: string;
  currentUid: string;
  groupMemberByUid: Map<string, { displayName: string }>;
  isGroupChat: boolean;
  senderUid: string;
}): string {
  if (input.senderUid && input.senderUid === input.currentUid) {
    return 'You';
  }

  if (!input.isGroupChat) {
    return input.contactName.trim() || 'Them';
  }

  return input.groupMemberByUid.get(input.senderUid)?.displayName.trim() || 'Former member';
}
