/**
 * When a chat the user deleted should come back.
 *
 * Deleting a chat clears it from this device's list and records the contact id
 * so it stays cleared — otherwise the next contact refresh would put it straight
 * back. Nothing cleared that record when the other person wrote again, so a new
 * message arrived, raised an unread badge, and then vanished the moment the chat
 * was tapped: opening it hit the same guard and removed it from the list.
 *
 * Deleting a chat means "clear this from my list", not "block this person". A
 * new message has to bring the conversation back, the way it does in WhatsApp.
 */

export interface DeletedChatRevivalInput {
  /** True when the event carries messages rather than only metadata. */
  hasIncomingMessages: boolean;
  isLocallyDeleted: boolean;
}

/**
 * Whether an event should resurrect a locally deleted conversation.
 *
 * Only actual messages revive it. Presence, typing and profile updates arrive
 * constantly for every contact, and reviving on those would make a deleted chat
 * reappear on its own — which is the behaviour the deletion record exists to
 * prevent.
 */
export function shouldReviveDeletedChat(input: DeletedChatRevivalInput): boolean {
  return input.isLocallyDeleted && input.hasIncomingMessages;
}

/**
 * Whether an event for a deleted conversation should be ignored entirely.
 *
 * The counterpart to the rule above: anything that is not a message, for a
 * conversation the user deleted, is dropped.
 */
export function shouldIgnoreDeletedChatEvent(input: DeletedChatRevivalInput): boolean {
  return input.isLocallyDeleted && !input.hasIncomingMessages;
}
