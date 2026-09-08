/**
 * The chats a person can never lose track of.
 *
 * A department's group is made by the server the moment the department exists,
 * and every member of that department belongs to it. Nobody starts it and
 * nobody can leave it, so none of the rules that decide whether an ordinary
 * conversation is worth listing apply to it.
 *
 * Every other group is now treated the same way, because the Groups tab that
 * used to be the way back to a silent one has gone: the chat list is the only
 * list of groups there is.
 *
 * Kept apart from `adminChatSupport.ts` because that file imports React Native
 * and so cannot be tested. This rule decides whether somebody can find their
 * own department, which is worth pinning down.
 */

export interface DepartmentChatCandidate {
  chatType?: string | null;
  isDepartmentDefault?: boolean | null;
}

/** Whether this chat is a department's own group. */
export function isDepartmentChat(chat: DepartmentChatCandidate | null | undefined): boolean {
  if (!chat) {
    return false;
  }

  return chat.chatType === 'GROUP' && chat.isDepartmentDefault === true;
}

/**
 * Whether a chat must be listed regardless of what is in it.
 *
 * A **direct** chat earns its place by having a message, a preview or something
 * unread: an empty conversation with somebody is a contact, not a chat, and
 * everybody in the company would otherwise be listed.
 *
 * A **group** does not have to earn anything. Somebody made it and put you in
 * it, which is a decision about you rather than a conversation waiting to
 * start. A department's group was already exempt — it was invisible until the
 * first message happened to be sent, so a newly created department could not be
 * found by the very people put in it — and an ordinary group has exactly the
 * same problem the moment the Groups tab is not there to fall back on.
 */
export function mustAlwaysAppearInChatList(chat: DepartmentChatCandidate | null | undefined): boolean {
  return chat?.chatType === 'GROUP';
}
