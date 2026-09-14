import type { ChatMediaAttachment } from './chatApi';
import {
  createMediaPreparationReportState,
  markMediaPreparationReported,
  shouldReportMediaPreparation
} from './mediaPreparationReporting';
import {
  listLocalChatMediaPreparationQueue,
  removeLocalChatMediaPreparationQueueItem,
  upsertLocalChatMediaPreparationQueueItem,
  type LocalChatMediaPreparationQueueItem,
  type LocalChatMediaPreparationStatus
} from './localChatStore';
import {
  cancelNativeMediaPreparation,
  prepareNativeMediaAsset,
  subscribeNativeMediaPreparationEvents
} from './nativeMediaPicker';
import { attachChatMediaPoster } from './chatMediaPosterQueue';
import {
  buildMediaTransferProgressKey,
  publishMediaTransferProgress
} from './chatMediaTransferProgress';
import {
  buildVideoTranscodeRequestId,
  cancelNativeVideoTranscode,
  subscribeNativeVideoTranscodeEvents,
  transcodeChatVideo
} from './nativeVideoTranscoder';

interface LocalChatScopeInput {
  ownerUid: string;
  tenantId: string;
}

export interface PrepareChatMediaQueueInput extends LocalChatScopeInput {
  chatType: 'DIRECT' | 'GROUP';
  contactId: string;
  media: ChatMediaAttachment;
  mediaIndex?: number;
  onPreparedMediaUpdated?: (media: ChatMediaAttachment) => void;
  messageId: string;
  onProgress?: (media: ChatMediaAttachment, progress: number) => void;
}

export interface CancelChatMediaPreparationInput extends LocalChatScopeInput {
  assetIdentifier?: string | null;
  queueId?: string | null;
}

export interface ClearChatMediaPreparationInput extends LocalChatScopeInput {
  assetIdentifier?: string | null;
  contactId: string;
  mediaIndex?: number;
  messageId: string;
}

const activePreparationPromises = new Map<string, Promise<ChatMediaAttachment>>();

export async function prepareChatMediaAttachmentThroughQueue(
  input: PrepareChatMediaQueueInput
): Promise<ChatMediaAttachment> {
  const assetIdentifier = normalizeAssetIdentifier(input.media.nativeAssetIdentifier);

  if (!assetIdentifier) {
    return input.media;
  }

  const mediaIndex = Math.max(0, Math.round(input.mediaIndex || 0));
  const queueId = buildPreparationQueueId(input.contactId, input.messageId, mediaIndex, assetIdentifier);
  const activePromise = activePreparationPromises.get(queueId);

  if (activePromise) {
    return activePromise;
  }

  const preparationPromise = runQueuedPreparation({
    ...input,
    assetIdentifier,
    mediaIndex,
    queueId
  }).finally(() => {
    activePreparationPromises.delete(queueId);
  });

  activePreparationPromises.set(queueId, preparationPromise);
  return preparationPromise;
}

export async function listRecoverableChatMediaPreparations(
  input: LocalChatScopeInput & { contactId?: string }
): Promise<LocalChatMediaPreparationQueueItem[]> {
  const queueItems = await listLocalChatMediaPreparationQueue(input);

  return queueItems.filter((item) =>
    item.status === 'queued' ||
    item.status === 'preparing' ||
    item.status === 'failed'
  );
}

export async function cancelChatMediaPreparation(input: CancelChatMediaPreparationInput): Promise<boolean> {
  const queueId = typeof input.queueId === 'string' && input.queueId.trim() ? input.queueId.trim() : '';
  const assetIdentifier = normalizeAssetIdentifier(input.assetIdentifier);
  let didCancelNative = false;

  if (assetIdentifier) {
    didCancelNative = await cancelNativeMediaPreparation({ assetIdentifier });
  }

  if (queueId) {
    await removeLocalChatMediaPreparationQueueItem({
      ownerUid: input.ownerUid,
      queueId,
      tenantId: input.tenantId
    }).catch(() => undefined);
  }

  return didCancelNative || Boolean(queueId);
}

export async function clearChatMediaPreparation(input: ClearChatMediaPreparationInput): Promise<void> {
  const assetIdentifier = normalizeAssetIdentifier(input.assetIdentifier);
  const mediaIndex = typeof input.mediaIndex === 'number'
    ? Math.max(0, Math.round(input.mediaIndex))
    : null;
  const queueItems = await listLocalChatMediaPreparationQueue({
    contactId: input.contactId,
    limit: 200,
    ownerUid: input.ownerUid,
    tenantId: input.tenantId
  }).catch(() => []);
  const matchingItems = queueItems.filter((item) =>
    item.messageId === input.messageId &&
    (mediaIndex === null || item.mediaIndex === mediaIndex) &&
    (!assetIdentifier || item.assetIdentifier === assetIdentifier)
  );

  if (assetIdentifier) {
    await cancelNativeMediaPreparation({ assetIdentifier }).catch(() => false);
  }

  // Stop an in-flight compression too. Deleting a pending message should not
  // leave a MediaCodec/AVAssetWriter pipeline burning CPU on a video nobody is
  // going to send.
  await cancelNativeVideoTranscode(buildVideoTranscodeRequestId({
    mediaIndex: mediaIndex === null ? 0 : mediaIndex,
    messageId: input.messageId
  })).catch(() => false);

  await Promise.all(matchingItems.map((item) =>
    removeLocalChatMediaPreparationQueueItem({
      ownerUid: input.ownerUid,
      queueId: item.queueId,
      tenantId: input.tenantId
    }).catch(() => undefined)
  ));
}

async function runQueuedPreparation(
  input: PrepareChatMediaQueueInput & {
    assetIdentifier: string;
    mediaIndex: number;
    queueId: string;
  }
): Promise<ChatMediaAttachment> {
  const existingItem = await loadExistingPreparation(input);

  if (existingItem?.status === 'ready' && existingItem.preparedMedia?.localUri) {
    // A video queued while offline, or by a build from before posters were
    // attached here, is finished off now rather than sent bare. Costs nothing
    // for anything that already has one.
    return attachChatMediaPoster(existingItem.preparedMedia);
  }

  const attempts = Math.max(0, existingItem?.attempts || 0);
  const baseQueuedMedia: ChatMediaAttachment = {
    ...input.media,
    transferProgress: existingItem?.progress || input.media.transferProgress || 0,
    transferStatus: 'preparing'
  };

  await persistPreparationQueueItem(input, {
    attempts,
    media: baseQueuedMedia,
    progress: baseQueuedMedia.transferProgress || 0,
    status: 'queued'
  });

  /**
   * Android raises one of these per 8 KB copied, so a photo arrives as hundreds.
   * Each used to redraw the ring and write a SQLite row carrying the base64
   * thumbnail. iOS delivers the same copy in a handful of callbacks, which is
   * most of why this felt slow on one platform and not the other.
   */
  const reportState = createMediaPreparationReportState();
  const subscription = subscribeNativeMediaPreparationEvents((event) => {
    if (event.assetIdentifier !== input.assetIdentifier) {
      return;
    }

    const progress = normalizeProgress(event.progress);
    const status = mapNativePreparationStatus(event.status);
    const isTerminal = status === 'ready' || status === 'failed' || status === 'cancelled';
    const nowMs = Date.now();

    if (!shouldReportMediaPreparation({ isTerminal, nowMs, progress, state: reportState })) {
      return;
    }

    markMediaPreparationReported(reportState, progress, nowMs);
    const progressMedia: ChatMediaAttachment = {
      ...baseQueuedMedia,
      transferProgress: progress,
      transferStatus: status === 'failed' || status === 'cancelled' ? 'failed' : 'preparing'
    };

    // Feed the bubble's ring so export shows a real percentage rather than an
    // anonymous spinner. Preparation is the longest phase of a large video, so
    // leaving it unmeasured is what made sending feel stalled.
    publishMediaTransferProgress(
      buildMediaTransferProgressKey(input.messageId, input.mediaIndex),
      { progress, status: 'preparing' }
    );
    input.onProgress?.(progressMedia, progress);
    void persistPreparationQueueItem(input, {
      attempts,
      lastError: event.message || null,
      media: progressMedia,
      progress,
      status
    });
  });

  try {
    await persistPreparationQueueItem(input, {
      attempts: attempts + 1,
      media: baseQueuedMedia,
      progress: baseQueuedMedia.transferProgress || 0,
      status: 'preparing'
    });

    const preparedResult = await prepareNativeMediaAsset({
      assetIdentifier: input.assetIdentifier,
      contentType: input.media.contentType,
      fileName: input.media.fileName,
      kind: input.media.kind === 'video' ? 'video' : input.media.kind === 'image' ? 'image' : undefined
    });

    if (!preparedResult?.fileUri) {
      throw new Error('Synzapp could not prepare this media from the device library.');
    }

    const exportedMedia: ChatMediaAttachment = {
      ...input.media,
      contentType: preparedResult.contentType || input.media.contentType,
      fileName: preparedResult.fileName || input.media.fileName,
      height: preparedResult.height || input.media.height,
      localUri: preparedResult.fileUri,
      nativeAssetIdentifier: undefined,
      sizeBytes: preparedResult.sizeBytes || input.media.sizeBytes,
      transferProgress: 0,
      transferStatus: 'uploading',
      width: preparedResult.width || input.media.width
    };

    // Compress video before it reaches encryption and upload. This runs behind
    // an already-visible bubble, so the chat stays usable while it works, and it
    // is what turns a 200 MB camera file into a ~15 MB transfer.
    const preparedMedia = await transcodePreparedVideo({
      attempts: attempts + 1,
      baseQueuedMedia,
      input,
      media: exportedMedia
    });

    // Saved before the poster is made, so a crash mid-poster cannot cost the
    // export that just took the longest.
    await persistPreparationQueueItem(input, {
      attempts: attempts + 1,
      media: baseQueuedMedia,
      preparedMedia,
      progress: 1,
      status: 'ready'
    });

    // Awaited, unlike before. The poster travels inside the message, so one
    // produced after this returns is attached to a message that has already
    // been encrypted and sent, and only the sender ever sees it. That is why a
    // video recorded on the phone reached the other side with an empty bubble.
    //
    // This is not a new cost on the way to sending. It runs after the export
    // above, behind a bubble that has been on screen since the video was
    // chosen, and reads one frame from a file that is already on disk. Photos
    // and videos that came from the library return from it untouched.
    const preparedMediaWithPoster = await attachChatMediaPoster(preparedMedia);

    if (preparedMediaWithPoster !== preparedMedia) {
      input.onPreparedMediaUpdated?.(preparedMediaWithPoster);
      await persistPreparationQueueItem(input, {
        attempts: attempts + 1,
        media: baseQueuedMedia,
        preparedMedia: preparedMediaWithPoster,
        progress: 1,
        status: 'ready'
      }).catch(() => undefined);
    }

    return preparedMediaWithPoster;
  } catch (error) {
    const failedMedia: ChatMediaAttachment = {
      ...input.media,
      transferProgress: 0,
      transferStatus: 'failed'
    };

    await persistPreparationQueueItem(input, {
      attempts: attempts + 1,
      lastError: getErrorMessage(error, 'Unable to prepare media.'),
      media: failedMedia,
      progress: 0,
      status: 'failed'
    });
    throw error;
  } finally {
    subscription?.remove();
  }
}

/**
 * Compresses a prepared video, reporting progress on the existing bubble.
 *
 * Every failure path returns the untouched input. A video that cannot be
 * compressed - unsupported codec, missing native module, cancelled, or a
 * re-encode that came out larger - still sends exactly as it does today.
 */
async function transcodePreparedVideo(input: {
  attempts: number;
  baseQueuedMedia: ChatMediaAttachment;
  input: PrepareChatMediaQueueInput & {
    assetIdentifier: string;
    mediaIndex: number;
    queueId: string;
  };
  media: ChatMediaAttachment;
}): Promise<ChatMediaAttachment> {
  const media = input.media;

  if (media.kind !== 'video' || !media.localUri) {
    return media;
  }

  const requestId = buildVideoTranscodeRequestId({
    mediaIndex: input.input.mediaIndex,
    messageId: input.input.messageId
  });
  const subscription = subscribeNativeVideoTranscodeEvents((event) => {
    if (event.requestId !== requestId || event.status !== 'running') {
      return;
    }

    const progress = normalizeProgress(event.progress);
    const progressMedia: ChatMediaAttachment = {
      ...input.baseQueuedMedia,
      transferProgress: progress,
      transferStatus: 'preparing'
    };

    // Compression is the long pole for a big video, so surface its real
    // percentage on the bubble instead of an indeterminate spinner.
    publishMediaTransferProgress(
      buildMediaTransferProgressKey(input.input.messageId, input.input.mediaIndex),
      { progress, status: 'preparing' }
    );
    input.input.onProgress?.(progressMedia, progress);
    void persistPreparationQueueItem(input.input, {
      attempts: input.attempts,
      media: progressMedia,
      progress,
      status: 'preparing'
    });
  });

  try {
    const transcoded = await transcodeChatVideo({
      fileName: media.fileName,
      qualityMode: media.qualityMode,
      requestId,
      sizeBytes: media.sizeBytes,
      sourceUri: media.localUri
    });

    if (!transcoded) {
      return media;
    }

    return {
      ...media,
      contentType: 'video/mp4',
      durationMs: transcoded.durationMs || media.durationMs,
      height: transcoded.height || media.height,
      localUri: transcoded.fileUri,
      sizeBytes: transcoded.sizeBytes || media.sizeBytes,
      width: transcoded.width || media.width
    };
  } catch {
    await cancelNativeVideoTranscode(requestId).catch(() => false);
    return media;
  } finally {
    subscription?.remove();
  }
}

async function loadExistingPreparation(
  input: PrepareChatMediaQueueInput & { queueId: string }
): Promise<LocalChatMediaPreparationQueueItem | null> {
  const queueItems = await listLocalChatMediaPreparationQueue({
    contactId: input.contactId,
    limit: 100,
    ownerUid: input.ownerUid,
    tenantId: input.tenantId
  }).catch(() => []);

  return queueItems.find((item) => item.queueId === input.queueId) || null;
}

async function persistPreparationQueueItem(
  input: PrepareChatMediaQueueInput & {
    assetIdentifier: string;
    mediaIndex: number;
    queueId: string;
  },
  state: {
    attempts: number;
    lastError?: string | null;
    media: ChatMediaAttachment;
    preparedMedia?: ChatMediaAttachment | null;
    progress: number;
    status: LocalChatMediaPreparationStatus;
  }
): Promise<void> {
  await upsertLocalChatMediaPreparationQueueItem({
    assetIdentifier: input.assetIdentifier,
    attempts: state.attempts,
    chatType: input.chatType,
    contactId: input.contactId,
    lastError: state.lastError || null,
    media: state.media,
    mediaIndex: input.mediaIndex,
    messageId: input.messageId,
    ownerUid: input.ownerUid,
    preparedMedia: state.preparedMedia || null,
    progress: normalizeProgress(state.progress),
    queueId: input.queueId,
    status: state.status,
    tenantId: input.tenantId
  });
}

function mapNativePreparationStatus(status: unknown): LocalChatMediaPreparationStatus {
  if (status === 'completed') {
    return 'ready';
  }

  if (status === 'cancelled') {
    return 'cancelled';
  }

  if (status === 'failed') {
    return 'failed';
  }

  return 'preparing';
}

function buildPreparationQueueId(
  contactId: string,
  messageId: string,
  mediaIndex: number,
  assetIdentifier: string
): string {
  return [
    'prepare',
    sanitizeQueueKey(contactId),
    sanitizeQueueKey(messageId),
    Math.max(0, Math.round(mediaIndex)),
    sanitizeQueueKey(assetIdentifier)
  ].join(':').slice(0, 420);
}

function sanitizeQueueKey(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 96) || 'item';
}

function normalizeAssetIdentifier(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function normalizeProgress(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(value, 0), 1)
    : 0;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  return fallback;
}
