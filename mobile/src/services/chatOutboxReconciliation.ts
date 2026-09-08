import type { ChatImageAttachment, ChatMediaAttachment, ChatMessage } from './chatApi';
import {
  getChatMessageIdentityKey,
  getMessageMedia,
  getMessageMediaItems,
  uniqueChatMessages
} from './chatMessageReconciliation';

/**
 * What happens to a message as it stops being "sending" and becomes "sent".
 *
 * This is the handover that has produced the most user-visible damage: a bubble
 * that vanished and came back, media that lost its local file the moment the
 * server acknowledged it, and a video that still showed a progress ring after a
 * restart. All three were ordering and merge mistakes in a few lines buried in
 * a very large component.
 *
 * The decisions are pure and live here so they can be asserted directly. The
 * caller keeps the I/O — loading the cache, writing it back, updating state.
 */

export interface SyncedPendingMessageInput {
  /** Messages currently in the encrypted conversation cache. */
  cachedMessages: ChatMessage[];
  /** The queue id the message was sent under; also its client identity. */
  pendingQueueId: string;
  /** The message as the server accepted it. */
  sentMessage: ChatMessage;
  /** Messages currently on screen, which may hold local media the cache lacks. */
  visibleMessages: ChatMessage[];
}

export interface SyncedPendingMessageResult {
  /** The subset safe to persist — queued messages never enter the cache. */
  messagesToPersist: ChatMessage[];
  /** The full cache-side list, including anything still queued. */
  nextCachedMessages: ChatMessage[];
  /** The message to show, carrying both server identity and local media. */
  sentMessage: ChatMessage;
}

/**
 * Folds an accepted message back into the thread.
 *
 * Two rules carry the weight:
 *
 * - The server copy inherits the client identity, so it reconciles onto the
 *   bubble already on screen rather than arriving as a second message under the
 *   server-assigned envelope id.
 * - Local media survives. The server has no idea this device already holds the
 *   file it is describing, so a plain overwrite blanks media the user is
 *   looking at.
 */
export function reconcileSyncedPendingMessage(
  input: SyncedPendingMessageInput
): SyncedPendingMessageResult {
  const isPendingLocalMessage = (message: ChatMessage) =>
    getChatMessageIdentityKey(message) === input.pendingQueueId;

  const pendingLocalMessage = [...input.cachedMessages, ...input.visibleMessages]
    .find(isPendingLocalMessage) || null;

  const sentMessage: ChatMessage = {
    ...mergeSyncedMessageWithPendingLocalMedia(input.sentMessage, pendingLocalMessage),
    clientMessageId: input.sentMessage.clientMessageId || input.pendingQueueId
  };

  const nextCachedMessages = uniqueChatMessages([
    ...input.cachedMessages.filter((message) => !isPendingLocalMessage(message)),
    sentMessage
  ]);

  return {
    // Queued messages live in the outbox, never the conversation cache — the
    // outbox is what makes an interrupted send recoverable.
    messagesToPersist: nextCachedMessages.filter((message) => message.deliveryStatus !== 'queued'),
    nextCachedMessages,
    sentMessage
  };
}

/** Applies the accepted message to the visible thread. */
export function applySyncedPendingMessageToVisible(
  visibleMessages: ChatMessage[],
  pendingQueueId: string,
  sentMessage: ChatMessage
): ChatMessage[] {
  return uniqueChatMessages([
    ...visibleMessages.filter(
      (message) => getChatMessageIdentityKey(message) !== pendingQueueId
    ),
    sentMessage
  ]);
}

export function mergeSyncedMessageWithPendingLocalMedia(
  syncedMessage: ChatMessage,
  pendingMessage: ChatMessage | null
): ChatMessage {
  if (!pendingMessage) {
    return syncedMessage;
  }

  const pendingMediaItems = getMessageMediaItems(pendingMessage);
  const nextMedia = syncedMessage.media
    ? mergeSyncedMediaWithPendingLocalMedia(
        syncedMessage.media,
        pendingMediaItems[0] || getMessageMedia(pendingMessage)
      )
    : null;
  const nextMediaItems = Array.isArray(syncedMessage.mediaItems) && syncedMessage.mediaItems.length
    ? syncedMessage.mediaItems.map((media, index) =>
        mergeSyncedMediaWithPendingLocalMedia(media, pendingMediaItems[index]))
    : [];

  return {
    ...syncedMessage,
    image: nextMedia?.kind === 'image'
      ? {
          ...nextMedia,
          contentType: 'image/jpeg',
          height: nextMedia.height || 1,
          kind: 'image',
          width: nextMedia.width || 1
        } as ChatImageAttachment
      : syncedMessage.image,
    media: nextMedia,
    mediaItems: nextMediaItems
  };
}

export function mergeSyncedMediaWithPendingLocalMedia(
  syncedMedia: ChatMediaAttachment,
  pendingMedia?: ChatMediaAttachment | null
): ChatMediaAttachment {
  if (!pendingMedia?.localUri || pendingMedia.localUri.startsWith('data:')) {
    return syncedMedia;
  }

  // Match on the server id when both know it, otherwise on the file's own
  // identity. Attaching the wrong local file to a message would show one
  // person's photo under another's message, so this stays strict.
  const isSameMedia = Boolean(
    syncedMedia.mediaId && pendingMedia.mediaId && syncedMedia.mediaId === pendingMedia.mediaId
  ) || (
    syncedMedia.kind === pendingMedia.kind &&
    syncedMedia.fileName === pendingMedia.fileName &&
    syncedMedia.sizeBytes === pendingMedia.sizeBytes
  );

  if (!isSameMedia) {
    return syncedMedia;
  }

  return {
    ...syncedMedia,
    localUri: pendingMedia.localUri,
    thumbnailContentType: syncedMedia.thumbnailContentType || pendingMedia.thumbnailContentType,
    thumbnailDataUrl: syncedMedia.thumbnailDataUrl || pendingMedia.thumbnailDataUrl,
    thumbnailHeight: syncedMedia.thumbnailHeight || pendingMedia.thumbnailHeight,
    thumbnailWidth: syncedMedia.thumbnailWidth || pendingMedia.thumbnailWidth,
    transferProgress: 1,
    transferStatus: 'available'
  };
}

/**
 * The state an attachment reaches once its upload finishes.
 *
 * Written back to the cached message, not only to screen state. Skipping that
 * write left the message saying "preparing" forever, so reopening the app
 * showed a progress ring over a video that had been sent long before.
 */
export function buildUploadedMediaState(uploadedMedia: ChatMediaAttachment): ChatMediaAttachment {
  return {
    ...uploadedMedia,
    transferProgress: 1,
    transferStatus: 'available'
  };
}

export type MissingLocalMediaAction = 'keep' | 'rebase' | 'redownload' | 'ignore';

/**
 * What to do about media whose stored path no longer resolves.
 *
 * A stored path can stop pointing at anything without the message changing at
 * all: iOS reclaims the caches directory under storage pressure, and an install
 * or update moves the app container. The message still claims the media is
 * local, so nothing re-fetches it and the tile stays blank forever.
 *
 * `resolvedUri` is what the file system actually found — null when the file is
 * genuinely gone.
 */
export function resolveMissingLocalMediaAction(input: {
  canRedownload: boolean;
  resolvedUri: string | null;
  storedUri: string;
}): MissingLocalMediaAction {
  if (!input.storedUri) {
    return 'ignore';
  }

  if (input.resolvedUri === input.storedUri) {
    return 'keep';
  }

  // Same file, different container path. Record the corrected one rather than
  // spending bandwidth re-fetching something already on disk.
  if (input.resolvedUri) {
    return 'rebase';
  }

  return input.canRedownload ? 'redownload' : 'ignore';
}

/** The attachment to store when its local file is gone and must be fetched again. */
export function buildMissingLocalMediaState(media: ChatMediaAttachment): ChatMediaAttachment {
  return {
    ...media,
    localUri: undefined,
    transferProgress: 0,
    transferStatus: undefined
  };
}
