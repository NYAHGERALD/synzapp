/**
 * Reading a chat push well enough to say "this phone has it".
 *
 * Kept apart from anything that touches the platform so it can be tested, and
 * because the code that uses it runs **headless**: when a push arrives with the
 * app shut, Android starts a bare JavaScript context with no screens and no
 * React tree. Anything subtle in there is very hard to see going wrong.
 *
 * What this decides is only *whether* a push is one we should acknowledge, and
 * *which conversation* it names. Sending the receipt is somebody else's job.
 */

export interface ChatDeliveryReceiptTarget {
  chatType: 'DIRECT' | 'GROUP';
  /** The group for a group message, the sender for a direct one. */
  contactId: string;
}

/** The only kind of push worth a delivery receipt. */
const CHAT_MESSAGE_TYPE = 'chat.message';

/**
 * The conversation a push is about, or null if it is not a chat message.
 *
 * Deliberately unforgiving about shape and deliberately quiet about it. A push
 * payload is data that arrived over the network, and the alternative to
 * returning null is throwing inside a background task, where nothing is
 * watching and the platform's only response is to kill the task.
 */
export function readChatDeliveryReceiptTarget(data: unknown): ChatDeliveryReceiptTarget | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const payload = data as Record<string, unknown>;

  if (payload.type !== CHAT_MESSAGE_TYPE) {
    return null;
  }

  const contactId = typeof payload.contactId === 'string' ? payload.contactId.trim() : '';

  if (!contactId) {
    return null;
  }

  return {
    chatType: payload.chatType === 'GROUP' ? 'GROUP' : 'DIRECT',
    contactId
  };
}

/**
 * Where a push hides its data, which is not the same on both platforms.
 *
 * Android hands the task the data map directly; iOS wraps it in the APNs
 * payload under `body`. Both shapes are checked rather than one being assumed,
 * because the wrong guess fails silently in a place with no logs.
 */
export function readChatPushData(notification: unknown): unknown {
  if (!notification || typeof notification !== 'object') {
    return null;
  }

  const candidate = notification as Record<string, unknown>;

  if (candidate.type === CHAT_MESSAGE_TYPE) {
    return candidate;
  }

  for (const key of ['data', 'body', 'notification'] as const) {
    const nested = candidate[key];

    if (nested && typeof nested === 'object') {
      const found = readChatPushData(nested);

      if (found) {
        return found;
      }
    }
  }

  return null;
}

/**
 * Receipts worth sending, with the duplicates dropped.
 *
 * Several messages in one conversation produce several pushes, and each would
 * otherwise be acknowledged separately even though one receipt covers the whole
 * conversation. Deduplicating here keeps a busy group from turning into a burst
 * of identical requests from a phone that may be on a bad connection.
 */
export function dedupeDeliveryReceiptTargets(
  targets: ChatDeliveryReceiptTarget[]
): ChatDeliveryReceiptTarget[] {
  const seen = new Set<string>();

  return targets.filter((target) => {
    const key = `${target.chatType}:${target.contactId}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}
