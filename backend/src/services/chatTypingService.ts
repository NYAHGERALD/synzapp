/**
 * Who is typing, right now.
 *
 * Held in memory and nowhere else, deliberately. Typing is the most perishable
 * thing in the product: it is true for two seconds and meaningless afterwards.
 * Writing it to Firestore would put a document write behind every few
 * keystrokes of every person in the company, and would drag something with no
 * evidential value into retention, legal hold and the auditor's export.
 *
 * It follows `chatPresenceService` exactly — a map, a listener set, and a timer
 * — because the two answer the same shape of question and a second pattern for
 * the same job is a second thing to keep correct.
 *
 * **It expires on its own.** A person whose phone loses signal mid-word never
 * sends the "stopped" that would clear them, so every entry carries a deadline
 * and clears itself. Without that, "typing…" is a state somebody can get stuck
 * in for as long as the app is open, which reads as a bug in the chat rather
 * than a lost connection.
 */

export interface ChatTypingUpdate {
  chatType: 'DIRECT' | 'GROUP';
  /**
   * What the reader's chat list keys this conversation by: the typist's own id
   * in a direct chat, the group's id in a group. Sent rather than derived so
   * the client never has to work out which of the two it is holding.
   */
  conversationKey: string;
  isTyping: boolean;
  /**
   * Exactly who may see this, or null for a group.
   *
   * Presence can be told to anybody — being online is not about a conversation.
   * Typing is: telling everyone who has somebody in their contacts that they
   * are typing would say who they are talking to. A direct chat names its one
   * recipient; a group is filtered by whether the reader can see the group at
   * all, which is the same question as membership.
   */
  recipientUids: string[] | null;
  tenantId: string;
  typingName: string;
  typingUid: string;
}

type TypingListener = (update: ChatTypingUpdate) => void;

interface TypingRecord {
  expiryTimer: ReturnType<typeof setTimeout>;
  update: ChatTypingUpdate;
}

/**
 * How long a typing notice lives without being renewed.
 *
 * The client re-sends every few seconds while somebody is still typing, so this
 * only has to outlast that gap plus a slow network. Long enough not to flicker
 * between keystrokes; short enough that a dead connection clears within a
 * breath rather than sitting there.
 */
const TYPING_EXPIRY_MS = 7000;

const typingByKey = new Map<string, TypingRecord>();
const listeners = new Set<TypingListener>();

/**
 * Records that somebody is typing, and renews the deadline.
 *
 * Only the first notice for a conversation is announced. Renewals keep it alive
 * silently, so a person typing a long message does not send a broadcast to
 * every one of their colleagues' phones every three seconds.
 */
export function markChatUserTyping(input: Omit<ChatTypingUpdate, 'isTyping'>): void {
  const key = buildKey(input.typingUid, input.conversationKey);
  const existing = typingByKey.get(key);

  if (existing) {
    clearTimeout(existing.expiryTimer);
  }

  const update: ChatTypingUpdate = { ...input, isTyping: true };

  typingByKey.set(key, {
    expiryTimer: setTimeout(() => clearChatUserTyping(input.typingUid, input.conversationKey), TYPING_EXPIRY_MS),
    update
  });

  if (!existing) {
    emit(update);
  }
}

/**
 * Clears it — because they sent the message, cleared the box, left the chat, or
 * simply stopped and the deadline ran out.
 */
export function clearChatUserTyping(typingUid: string, conversationKey: string): void {
  const key = buildKey(typingUid, conversationKey);
  const record = typingByKey.get(key);

  if (!record) {
    return;
  }

  clearTimeout(record.expiryTimer);
  typingByKey.delete(key);
  emit({ ...record.update, isTyping: false });
}

/** Clears everything for one person, for when their socket goes. */
export function clearAllChatTypingForUser(typingUid: string): void {
  for (const [key, record] of typingByKey) {
    if (record.update.typingUid === typingUid) {
      clearTimeout(record.expiryTimer);
      typingByKey.delete(key);
      emit({ ...record.update, isTyping: false });
    }
  }
}

export function subscribeChatTypingUpdates(listener: TypingListener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/**
 * Whether this reader is allowed to see this notice.
 *
 * Exported and pure so the rule can be argued with in a test rather than only
 * in a socket. Every clause is a way somebody could otherwise learn who a
 * colleague is talking to.
 */
export function canSeeTypingUpdate(input: {
  readerTenantId: string;
  readerUid: string;
  update: ChatTypingUpdate;
  visibleConversationKeys: Set<string>;
}): boolean {
  const { readerTenantId, readerUid, update, visibleConversationKeys } = input;

  if (update.tenantId !== readerTenantId) {
    return false;
  }

  // Your own typing is not news to you, and echoing it back would light up your
  // own header while you type.
  if (update.typingUid === readerUid) {
    return false;
  }

  // A direct chat names exactly who it is for.
  if (update.recipientUids && !update.recipientUids.includes(readerUid)) {
    return false;
  }

  // And in every case, only for a conversation this person can already see.
  // For a group that is the same question as membership.
  return visibleConversationKeys.has(update.conversationKey);
}

function emit(update: ChatTypingUpdate): void {
  for (const listener of listeners) {
    try {
      listener(update);
    } catch {
      // One broken socket must not stop the others being told.
    }
  }
}

function buildKey(typingUid: string, conversationKey: string): string {
  return `${typingUid}:${conversationKey}`;
}
