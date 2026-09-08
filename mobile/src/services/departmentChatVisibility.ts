/**
 * The one chat a person can never get rid of.
 *
 * A department's group is made by the server the moment the department exists,
 * and every member of that department belongs to it. Nobody starts it and
 * nobody can leave it, so none of the rules that decide whether an ordinary
 * conversation is worth listing apply to it.
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
 * Every other chat earns its place by having a message, a preview or something
 * unread — an empty conversation with somebody is a contact, not a chat. A
 * department's group has no such threshold: it was invisible until the first
 * message happened to be sent, which meant a newly created department could not
 * be found by the very people put in it, and a member who cleared it lost the
 * one place their department's work is coordinated.
 */
export function mustAlwaysAppearInChatList(chat: DepartmentChatCandidate | null | undefined): boolean {
  return isDepartmentChat(chat);
}
