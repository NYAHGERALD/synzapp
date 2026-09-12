import type {
  ChatImageAttachment,
  ChatMediaAttachment,
  ChatMessage
} from './chatApi';
import { resolveLocalChatMediaUri } from './chatMediaPaths';

/**
 * How a chat thread is assembled from the several sources that describe it.
 *
 * A single message can arrive from the local outbox, the encrypted cache, a
 * realtime envelope, and a REST fetch — often at the same time, and not always
 * agreeing. This module decides which copy wins and what the merged result
 * looks like.
 *
 * It lives outside the chat screen so it can be tested directly. Every defect
 * this logic has produced — duplicate bubbles, a bubble vanishing mid-send,
 * media that lost its local file on merge — was invisible while it was buried
 * in a 47,000-line component.
 */

/**
 * The stable identity of a chat message for de-duplication and row keys.
 *
 * An outgoing message is created locally with `clientMessageId = queueId` and is
 * later echoed back by the server under a different `messageId` (the envelope
 * id). Keying on `messageId` alone makes those look like two different
 * messages, which renders the bubble twice and remounts the row when the queued
 * copy is dropped.
 *
 * Defined here rather than in the API layer so reconciliation stays testable
 * without pulling in networking and native modules.
 */
export function getChatMessageIdentityKey(message: ChatMessage): string {
  const clientMessageId = (message.clientMessageId || '').trim();

  return clientMessageId || message.messageId;
}

export function getMessageMedia(message: ChatMessage): ChatMediaAttachment | null {
  return message.media || message.mediaItems?.[0] || message.image || null;
}

export function getMessageMediaItems(message: ChatMessage): ChatMediaAttachment[] {
  if (Array.isArray(message.mediaItems) && message.mediaItems.length) {
    return message.mediaItems;
  }

  const media = getMessageMedia(message);

  return media ? [media] : [];
}

export function getMediaLocalUri(media: ChatMediaAttachment | null): string {
  if (!media) {
    return '';
  }

  const storedUri = media.localUri ||
    (typeof (media as ChatImageAttachment).dataUrl === 'string'
      ? (media as ChatImageAttachment).dataUrl || ''
      : '');

  // Stored paths carry the app container id they were written under, and iOS
  // changes that on reinstall and update. Re-root them before use, or the tile
  // renders black against a path that no longer exists.
  return resolveLocalChatMediaUri(storedUri);
}

export function toChatImageAttachment(media: ChatMediaAttachment): ChatImageAttachment {
  return {
    ...media,
    contentType: 'image/jpeg',
    height: media.height || 1,
    kind: 'image',
    width: media.width || 1
  };
}

/**
 * Collapses the copies of a thread into one ordered list.
 *
 * Two rows are the same message if they agree on *either* identifier. A locally
 * queued message and its server echo share a `clientMessageId` but not a
 * `messageId`; a message cached before `clientMessageId` existed has only a
 * `messageId`. Indexing both ways collapses each pair instead of rendering the
 * same message twice under two keys.
 */
export function uniqueChatMessages(messages: ChatMessage[]): ChatMessage[] {
  const messagesByKey = new Map<string, ChatMessage>();
  const canonicalKeyByAlias = new Map<string, string>();

  messages.forEach((message) => {
    const identityKey = getChatMessageIdentityKey(message);
    const aliases = [identityKey, message.messageId];
    const canonicalKey = aliases
      .map((alias) => canonicalKeyByAlias.get(alias))
      .find((existingKey): existingKey is string => Boolean(existingKey)) || identityKey;
    const existingMessage = messagesByKey.get(canonicalKey);

    aliases.forEach((alias) => canonicalKeyByAlias.set(alias, canonicalKey));
    messagesByKey.set(canonicalKey, mergeChatMessageWithLocalState(existingMessage, message));
  });

  return [...messagesByKey.values()].sort(compareChatMessagesBySentAt);
}

/**
 * Orders two messages by when they were sent.
 *
 * `sentAt` is an ISO-8601 string, so plain relational comparison already orders
 * it correctly, and costs a fraction of `localeCompare`, which runs full Unicode
 * collation for every pair. This sort runs three times over the whole history
 * for each arriving message, and once more when the thread renders, so on a long
 * conversation the saving lands on the JS thread the keyboard animation shares.
 *
 * Messages sent in the same instant fall back to the id, so the order is stable
 * rather than left to whatever the engine's sort happens to do.
 */
export function compareChatMessagesBySentAt(first: ChatMessage, second: ChatMessage): number {
  if (first.sentAt !== second.sentAt) {
    return first.sentAt < second.sentAt ? -1 : 1;
  }

  if (first.messageId === second.messageId) {
    return 0;
  }

  return first.messageId < second.messageId ? -1 : 1;
}

/**
 * Returns `candidate` only when it actually differs from `existing`.
 *
 * Message rows are memoized on object identity, so handing back a fresh object
 * holding identical values re-renders that bubble for nothing. In a thread with
 * hundreds of photos and videos, every realtime event merges cache with server
 * response and would otherwise churn every message the two have in common.
 */
export function keepChatMessageIdentity(
  existing: ChatMessage,
  candidate: ChatMessage
): ChatMessage {
  const keys = new Set([
    ...Object.keys(existing),
    ...Object.keys(candidate)
  ]) as Set<keyof ChatMessage>;

  for (const key of keys) {
    if (!isSameMessageValue(existing[key], candidate[key])) {
      return candidate;
    }
  }

  return existing;
}

/**
 * Whether two message fields mean the same thing.
 *
 * The merge always writes `media`, `mediaItems` and `image`, even for a plain
 * text message that has none. Comparing key counts therefore reported every
 * text message as changed — which is most of a thread — so the identity
 * optimisation did nothing for exactly the messages there are most of. Absent,
 * null and empty are treated as one value here.
 */
function isSameMessageValue(existingValue: unknown, candidateValue: unknown): boolean {
  if (Object.is(existingValue, candidateValue)) {
    return true;
  }

  if (isEmptyMessageValue(existingValue) && isEmptyMessageValue(candidateValue)) {
    return true;
  }

  if (
    existingValue && candidateValue &&
    typeof existingValue === 'object' && typeof candidateValue === 'object'
  ) {
    // media, mediaItems, replyTo and reactions are rebuilt by the merge, so
    // compare their contents rather than their identity.
    return JSON.stringify(existingValue) === JSON.stringify(candidateValue);
  }

  return false;
}

function isEmptyMessageValue(value: unknown): boolean {
  return value === undefined ||
    value === null ||
    (Array.isArray(value) && value.length === 0);
}

/**
 * Delivery only moves forward.
 *
 * An accepted message keeps a copy in the outbox until the write that replaces
 * it lands, and that copy still reads "queued". Any refresh in between merges
 * the outbox in last, which used to overwrite "sent" and flip the bubble back —
 * visible to the user as Queued, Sent, Queued, Sent.
 *
 * The server cannot un-accept a message, so a status may advance but never
 * regress. A send that genuinely fails was never "sent" to begin with, so it is
 * unaffected by this.
 */
const CHAT_DELIVERY_RANK: Record<string, number> = {
  queued: 1,
  sent: 2,
  delivered: 3,
  read: 4
};

function furthestDeliveryStatus(
  existing: ChatMessage['deliveryStatus'],
  next: ChatMessage['deliveryStatus']
): ChatMessage['deliveryStatus'] {
  const existingRank = CHAT_DELIVERY_RANK[existing || ''] || 0;
  const nextRank = CHAT_DELIVERY_RANK[next || ''] || 0;

  return nextRank >= existingRank ? next : existing;
}

export function mergeChatMessageWithLocalState(
  existingMessage: ChatMessage | undefined,
  nextMessage: ChatMessage
): ChatMessage {
  if (!existingMessage) {
    return nextMessage;
  }

  const mediaItems = mergeChatMessageMediaItems(
    getMessageMediaItems(existingMessage),
    getMessageMediaItems(nextMessage)
  );
  const media = mergeChatMessageMedia(
    getMessageMedia(existingMessage),
    getMessageMedia(nextMessage)
  ) || mediaItems[0] || null;
  const image = media?.kind === 'image'
    ? toChatImageAttachment(media)
    : null;

  return keepChatMessageIdentity(existingMessage, {
    ...existingMessage,
    ...nextMessage,
    deliveryStatus: furthestDeliveryStatus(
      existingMessage.deliveryStatus,
      nextMessage.deliveryStatus
    ),
    image,
    media,
    mediaItems,
    reactions: Array.isArray(nextMessage.reactions)
      ? nextMessage.reactions
      : existingMessage.reactions || nextMessage.reactions || []
  });
}

export function mergeChatMessageMediaItems(
  existingMediaItems: ChatMediaAttachment[],
  nextMediaItems: ChatMediaAttachment[]
): ChatMediaAttachment[] {
  if (!existingMediaItems.length && !nextMediaItems.length) {
    return [];
  }

  const longestLength = Math.max(existingMediaItems.length, nextMediaItems.length);
  const mergedItems: ChatMediaAttachment[] = [];

  for (let index = 0; index < longestLength; index += 1) {
    const mergedMedia = mergeChatMessageMedia(
      existingMediaItems[index] || null,
      nextMediaItems[index] || null
    );

    if (mergedMedia) {
      mergedItems.push(mergedMedia);
    }
  }

  return mergedItems;
}

/**
 * Merges two views of one attachment.
 *
 * The rule that matters: a local file already on the device is never lost to a
 * server copy that does not know about it. The server has no idea the recipient
 * has already downloaded the media, so a naive overwrite would blank a photo
 * the user is currently looking at.
 */
export function mergeChatMessageMedia(
  existingMedia: ChatMediaAttachment | null,
  nextMedia: ChatMediaAttachment | null
): ChatMediaAttachment | null {
  if (!existingMedia && !nextMedia) {
    return null;
  }

  const existingLocalUri = getMediaLocalUri(existingMedia);
  const nextLocalUri = getMediaLocalUri(nextMedia);
  const localUri = nextLocalUri || existingLocalUri || undefined;
  const mergedMedia: ChatMediaAttachment = {
    ...(existingMedia || {}),
    ...(nextMedia || {}),
    localUri
  } as ChatMediaAttachment;

  if (existingLocalUri && !nextLocalUri) {
    mergedMedia.transferStatus = existingMedia?.transferStatus === 'failed'
      ? 'failed'
      : existingMedia?.transferStatus === 'uploading' ||
        existingMedia?.transferStatus === 'queued' ||
        existingMedia?.transferStatus === 'preparing'
        ? existingMedia.transferStatus
        : 'available';
    mergedMedia.transferProgress = mergedMedia.transferStatus === 'available'
      ? 1
      : existingMedia?.transferProgress;
  } else if (localUri && !mergedMedia.transferStatus && mergedMedia.mediaId) {
    mergedMedia.transferStatus = 'available';
    mergedMedia.transferProgress = 1;
  }

  return mergedMedia;
}

/**
 * Re-attaches a conversation's outbox to a cache-derived message list.
 *
 * In-flight messages are deliberately excluded from the conversation cache, so
 * the outbox is the only place a queued or uploading bubble exists. Any path
 * that rebuilds the visible thread from cache must pass through here, otherwise
 * it silently erases every send still in progress.
 */
export function withPendingChatMessages(
  messages: ChatMessage[],
  pendingMessages: ChatMessage[]
): ChatMessage[] {
  if (!pendingMessages.length) {
    return messages;
  }

  return uniqueChatMessages([...messages, ...pendingMessages]);
}

/**
 * The stable list-row key for a message.
 *
 * Keyed on client identity so the row is not unmounted and remounted when a
 * queued message is replaced by its server echo — a remount is what makes an
 * in-flight media bubble visibly blink.
 */
export function getChatMessageRowKey(message: ChatMessage): string {
  return `message-${getChatMessageIdentityKey(message)}`;
}
