import { createHash } from 'node:crypto';

/**
 * The canonical id of a conversation.
 *
 * A direct chat is named by **both** the people in it, hashed, so the same two
 * people always produce the same id whichever of them is asking, and nobody can
 * name a conversation they are not part of. That last property is the point: an
 * id a caller can invent is an id a caller can use to read somebody else's
 * conversation.
 *
 * The chat system has always worked this way. This module exists because the
 * function had been copied into two services and was about to be copied into a
 * third — and a security primitive that lives in three places is one that will
 * eventually differ in one of them.
 */

/**
 * Names the conversation between two people.
 *
 * Sorted before hashing so that `(a, b)` and `(b, a)` are the same
 * conversation. Callers pass their own uid and the other person's, which is
 * why a caller can only ever produce ids for chats they are in.
 */
export function buildDirectChatId(uid: string, contactId: string): string {
  const participantKey = [uid, contactId].sort().join('|');

  return `direct_${createHash('sha256').update(participantKey).digest('hex')}`;
}

/** Whether a stored id is already in the canonical form. */
export function isCanonicalDirectChatId(chatId: string): boolean {
  return /^direct_[0-9a-f]{64}$/.test(chatId);
}
