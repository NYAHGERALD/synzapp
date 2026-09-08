import { fromByteArray, toByteArray } from 'base64-js';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import nacl from 'tweetnacl';
import { getSynzappApiBaseUrl } from './apiConfig';
import {
  downloadFileWithNativeBackgroundTransfer,
  uploadFileWithNativeBackgroundTransfer
} from './chatBackgroundTransferApi';
import { getRegisteredDeviceHeaders } from './deviceIdentity';
import {
  decryptNativeMediaFile,
  encryptNativeMediaFile,
  getNativeMediaPipelineCapabilities,
  getNativePersistentMediaDirectory
} from './nativeMediaPicker';
import { transcodeChatVideo } from './nativeVideoTranscoder';
import {
  getActiveChatMediaDirectory,
  getCacheChatMediaDirectory,
  getLegacyDocumentChatMediaDirectory,
  getNativeChatMediaCacheDirectory,
  getPersistentChatMediaDirectory,
  isManagedChatMediaUri,
  resolveLocalChatMediaUri,
  setPersistentChatMediaDirectory
} from './chatMediaPaths';
import type { ChatMediaAttachment, ChatMediaKind } from './chatApi';

export type ChatMediaQualityMode = 'hd' | 'standard';

export {
  getActiveChatMediaDirectory,
  resolveLocalChatMediaUri,
  toPortableChatMediaUri
} from './chatMediaPaths';

export const CHAT_MEDIA_LIMITS: Record<ChatMediaKind, number> = {
  audio: 16 * 1024 * 1024,
  file: 100 * 1024 * 1024,
  image: 100 * 1024 * 1024,
  video: 250 * 1024 * 1024
};
const CHAT_MEDIA_MAX_POLICY_LIMITS: Record<ChatMediaKind, number> = {
  audio: 64 * 1024 * 1024,
  file: 500 * 1024 * 1024,
  image: 250 * 1024 * 1024,
  video: 1024 * 1024 * 1024
};

interface MediaUploadSession {
  chunkCount?: number;
  chunkSizeBytes?: number;
  expiresAt: string;
  maxEncryptedSizeBytes: number;
  mediaId: string;
  partUploadUrls?: Array<{
    partIndex: number;
    uploadUrl: string;
  }>;
  uploadUrl: string;
}

interface MediaDownloadSession {
  contentType: string;
  downloadUrl: string;
  encryptedSizeBytes: number;
  expiresAt: string;
  fileName: string;
  kind: ChatMediaKind;
  mediaId: string;
}

export interface ChatMediaUploadRecoveryState {
  chatType?: 'DIRECT' | 'GROUP';
  expiresAt: string;
  media: ChatMediaAttachment;
  mediaId: string;
  partNativeTransferIds?: string[];
  uploadedPartIndexes?: number[];
  uploadMode?: 'chunked' | 'single';
}

export interface LocalChatMediaInput {
  contentType: string;
  durationMs?: number;
  fileName: string;
  height?: number;
  kind: ChatMediaKind;
  nativeAssetIdentifier?: string;
  originalContentType?: string;
  originalHeight?: number;
  originalSizeBytes?: number;
  originalUri?: string;
  originalWidth?: number;
  qualityMode?: ChatMediaQualityMode;
  sizeBytes: number;
  thumbnailContentType?: string;
  thumbnailDataUrl?: string;
  thumbnailHeight?: number;
  thumbnailWidth?: number;
  uri: string;
  width?: number;
}

const chatMediaCacheDirectory = getCacheChatMediaDirectory();
const legacyChatMediaDocumentDirectory = getLegacyDocumentChatMediaDirectory();
const nativeChatMediaCacheDirectory = getNativeChatMediaCacheDirectory();
const CHAT_MEDIA_CHUNK_UPLOAD_THRESHOLD_BYTES = 8 * 1024 * 1024;
const CHAT_MEDIA_DEFAULT_CHUNK_SIZE_BYTES = 4 * 1024 * 1024;
const CHAT_MEDIA_LARGE_INTERACTIVE_CHUNK_SIZE_BYTES = 8 * 1024 * 1024;
const CHAT_MEDIA_LARGE_INTERACTIVE_THRESHOLD_BYTES = 20 * 1024 * 1024;
const CHAT_MEDIA_CACHE_SOFT_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;
const CHAT_MEDIA_CACHE_DEFAULT_RETENTION_DAYS = 30;
const CHAT_MEDIA_LARGE_UPLOAD_WORKER_CONCURRENCY = 1;
const CHAT_MEDIA_NATIVE_PART_UPLOAD_CONCURRENCY = 4;
/**
 * Above this, encryption is done natively.
 *
 * It used to be 8 MB, which read as "only huge files need the native path".
 * What it actually meant was that the common case never took it: a photo is two
 * to five megabytes and a transcoded video lands around six or seven, so both
 * went through the JavaScript Secretbox instead. That path encrypts in 2 MB
 * blocks and, as the note on the chunk size says, the block size *is* the
 * freeze duration, because nothing can interrupt one.
 *
 * A quarter of a megabyte is low enough that anything worth encrypting goes
 * native and high enough that a tiny attachment does not pay the per-call cost
 * of crossing into it. Native failing is already handled: it logs and falls
 * back to the JavaScript path on its own.
 */
const CHAT_MEDIA_NATIVE_AEAD_MIN_BYTES = 256 * 1024;
const CHAT_MEDIA_UPLOAD_WORKING_FILE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * Where chat media actually lives once storage has been initialised.
 *
 * Caches is the fallback only. iOS deletes Caches under storage pressure and
 * Android may reclaim it, which is why sent and received media used to vanish
 * and have to be fetched again - an offline-first app cannot store its offline
 * data somewhere the OS is free to empty.
 */
let chatMediaStorageInitialization: Promise<void> | null = null;
let chatMediaCacheSoftLimitBytes = CHAT_MEDIA_CACHE_SOFT_LIMIT_BYTES;
let chatMediaCacheRetentionDays = CHAT_MEDIA_CACHE_DEFAULT_RETENTION_DAYS;
let activeChatMediaLimits: Record<ChatMediaKind, number> = { ...CHAT_MEDIA_LIMITS };
let activeLargeUploadWorkerCount = 0;
const largeUploadWorkerWaiters: Array<() => void> = [];

/**
 * Moves chat media onto storage the OS will not reclaim, once per launch.
 *
 * Anything already sitting in the old cache directory is migrated across, so a
 * device that has been using Synzapp keeps the media it already downloaded
 * rather than re-fetching all of it.
 */
export async function initializeChatMediaStorage(): Promise<void> {
  if (chatMediaStorageInitialization) {
    return chatMediaStorageInitialization;
  }

  chatMediaStorageInitialization = (async () => {
    const nativeDirectory = await getNativePersistentMediaDirectory().catch(() => null);

    if (!nativeDirectory) {
      return;
    }

    await FileSystem.makeDirectoryAsync(nativeDirectory, { intermediates: true }).catch(() => undefined);
    setPersistentChatMediaDirectory(nativeDirectory);

    await migrateChatMediaDirectory(chatMediaCacheDirectory, nativeDirectory);
    await migrateChatMediaDirectory(legacyChatMediaDocumentDirectory, nativeDirectory);
  })().catch(() => undefined);

  return chatMediaStorageInitialization;
}

/**
 * Moves files from an older media directory into the persistent one.
 *
 * Both live inside the app container, so these are renames rather than copies -
 * migrating a large library costs almost nothing. Encrypted upload working
 * files are skipped; they are disposable by design.
 */
async function migrateChatMediaDirectory(
  sourceDirectory: string | null,
  targetDirectory: string
): Promise<void> {
  if (!sourceDirectory || sourceDirectory === targetDirectory) {
    return;
  }

  const fileNames = await FileSystem.readDirectoryAsync(sourceDirectory).catch(() => []);

  for (const fileName of fileNames) {
    if (/^upload(?:_part)?_.*\.bin$/u.test(fileName)) {
      continue;
    }

    const targetUri = `${targetDirectory}${fileName}`;
    const existingTarget = await FileSystem.getInfoAsync(targetUri).catch(() => null);

    if (existingTarget?.exists) {
      continue;
    }

    await FileSystem.moveAsync({
      from: `${sourceDirectory}${fileName}`,
      to: targetUri
    }).catch(() => undefined);
  }
}

export async function cacheLocalChatMedia(media: LocalChatMediaInput): Promise<LocalChatMediaInput> {
  ensureMediaSize(media.kind, media.sizeBytes);

  if (isDataUri(media.uri)) {
    return media;
  }

  const persistentDirectory = getPersistentChatMediaDirectory();

  // Already in persistent storage - nothing to do.
  if (persistentDirectory && media.uri.startsWith(persistentDirectory)) {
    return media;
  }

  // Exports and transcodes land in the native cache, which the OS may reclaim.
  // Move them into persistent storage rather than copying: both directories are
  // inside the app container, so this is a rename and costs nothing even for a
  // large video.
  if (persistentDirectory && isSynzappMediaCacheUri(media.uri)) {
    const movedUri = await moveMediaIntoPersistentStorage(media);

    if (movedUri) {
      return { ...media, uri: movedUri };
    }

    return media;
  }

  if (isSynzappMediaCacheUri(media.uri)) {
    return media;
  }

  await ensureMediaCacheDirectory();

  const sourceInfo = await FileSystem.getInfoAsync(media.uri);

  if (!sourceInfo.exists) {
    throw new Error('This media is no longer available on this device.');
  }

  const sourceSizeBytes = typeof sourceInfo.size === 'number' && sourceInfo.size > 0
    ? sourceInfo.size
    : media.sizeBytes;

  ensureMediaSize(media.kind, sourceSizeBytes);

  const cachedUri = getMediaCacheFileUri(
    `local_${Date.now()}_${randomHex(5)}_${sanitizeLocalCacheFileName(media.fileName, media.kind)}`
  );

  await FileSystem.copyAsync({
    from: media.uri,
    to: cachedUri
  });

  const cachedInfo = await FileSystem.getInfoAsync(cachedUri);
  const cachedSizeBytes = cachedInfo.exists && typeof cachedInfo.size === 'number' && cachedInfo.size > 0
    ? cachedInfo.size
    : sourceSizeBytes;
  const cachedOriginalUri = await cacheOriginalMediaUri(media);
  await pruneChatMediaCache({
    protectedUris: [cachedUri, cachedOriginalUri || media.originalUri || '']
  }).catch(() => undefined);

  return {
    ...media,
    originalUri: cachedOriginalUri || media.originalUri,
    sizeBytes: cachedSizeBytes,
    uri: cachedUri
  };
}

/**
 * Renames a file from a cache directory into persistent storage.
 *
 * Returns null when the move fails, in which case the caller keeps the original
 * path - a media file that cannot be relocated should still send.
 */
async function moveMediaIntoPersistentStorage(media: LocalChatMediaInput): Promise<string | null> {
  const persistentDirectory = getPersistentChatMediaDirectory();

  if (!persistentDirectory) {
    return null;
  }

  const fileName = media.uri.split('/').pop() || '';

  if (!fileName) {
    return null;
  }

  await FileSystem.makeDirectoryAsync(persistentDirectory, { intermediates: true })
    .catch(() => undefined);

  const targetUri = `${persistentDirectory}${fileName.replace(/[^A-Za-z0-9._-]/g, '_')}`;
  const existingTarget = await FileSystem.getInfoAsync(targetUri).catch(() => null);

  if (existingTarget?.exists) {
    return targetUri;
  }

  const didMove = await FileSystem.moveAsync({ from: media.uri, to: targetUri })
    .then(() => true)
    .catch(() => false);

  return didMove ? targetUri : null;
}

export async function clearChatMediaStorage(input?: {
  includeLegacyDocumentStorage?: boolean;
}): Promise<void> {
  const directories = [
    chatMediaCacheDirectory,
    // Plaintext media now stays in the native cache instead of being copied out
    // of it, so a tenant wipe has to clear that directory too - as does the
    // persistent store, which is where media actually lives.
    nativeChatMediaCacheDirectory,
    getPersistentChatMediaDirectory(),
    input?.includeLegacyDocumentStorage === false ? null : legacyChatMediaDocumentDirectory
  ].filter((directory): directory is string => Boolean(directory));

  await Promise.all(directories.map((directory) =>
    FileSystem.deleteAsync(directory, { idempotent: true }).catch(() => undefined)
  ));
}

export function setChatMediaCacheBudgetBytes(budgetBytes: number): void {
  if (!Number.isFinite(budgetBytes) || budgetBytes <= 0) {
    chatMediaCacheSoftLimitBytes = CHAT_MEDIA_CACHE_SOFT_LIMIT_BYTES;
    return;
  }

  chatMediaCacheSoftLimitBytes = Math.max(256 * 1024 * 1024, Math.round(budgetBytes));
}

export function setChatMediaCacheRetentionDays(retentionDays: number): void {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    chatMediaCacheRetentionDays = CHAT_MEDIA_CACHE_DEFAULT_RETENTION_DAYS;
    return;
  }

  chatMediaCacheRetentionDays = Math.min(Math.max(Math.round(retentionDays), 1), 365);
}

export function setChatMediaLimitBytes(limits: Partial<Record<ChatMediaKind, number>> | null | undefined): void {
  activeChatMediaLimits = {
    audio: normalizeChatMediaLimit('audio', limits?.audio),
    file: normalizeChatMediaLimit('file', limits?.file),
    image: normalizeChatMediaLimit('image', limits?.image),
    video: normalizeChatMediaLimit('video', limits?.video)
  };
}

export async function enforceChatMediaCachePolicy(): Promise<void> {
  await cleanupStaleChatUploadWorkingFiles();
  await pruneChatMediaCache();
}

export async function getChatMediaNativePipelineStatus(): Promise<{
  backgroundMultipartUploadWorkerAvailable: boolean;
  killedAppSecretboxWorkerAvailable: boolean;
  reason?: string;
  secretboxAlgorithm: 'nacl-secretbox-xsalsa20-poly1305';
}> {
  return getNativeMediaPipelineCapabilities();
}

export async function cleanupStaleChatUploadWorkingFiles(input: {
  olderThanMs?: number;
  protectedUris?: string[];
} = {}): Promise<number> {
  if (!chatMediaCacheDirectory) {
    return 0;
  }

  const protectedUris = new Set((input.protectedUris || []).filter(Boolean));
  const olderThanMs = Number.isFinite(input.olderThanMs)
    ? Math.max(60 * 60 * 1000, Math.round(input.olderThanMs || CHAT_MEDIA_UPLOAD_WORKING_FILE_RETENTION_MS))
    : CHAT_MEDIA_UPLOAD_WORKING_FILE_RETENTION_MS;
  const cutoffSeconds = (Date.now() - olderThanMs) / 1000;
  const fileNames = await FileSystem.readDirectoryAsync(chatMediaCacheDirectory).catch(() => []);
  let deletedCount = 0;

  for (const fileName of fileNames) {
    if (!/^upload(?:_part)?_.*\.bin$/u.test(fileName)) {
      continue;
    }

    const uri = getMediaCacheFileUri(fileName);
    if (protectedUris.has(uri)) {
      continue;
    }

    const info = await FileSystem.getInfoAsync(uri).catch(() => null);
    if (!info?.exists) {
      continue;
    }

    const modificationTime = typeof info.modificationTime === 'number' ? info.modificationTime : 0;
    if (modificationTime <= 0 || modificationTime > cutoffSeconds) {
      continue;
    }

    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
    deletedCount += 1;
  }

  return deletedCount;
}

export async function getChatMediaCacheSizeBytes(): Promise<number> {
  // Both directories hold governed chat media plaintext, so cache reporting and
  // budget enforcement have to account for both.
  const directories = [chatMediaCacheDirectory, nativeChatMediaCacheDirectory, getPersistentChatMediaDirectory()]
    .filter((directory): directory is string => Boolean(directory));
  const directorySizes = await Promise.all(directories.map(async (directory) => {
    const fileNames = await FileSystem.readDirectoryAsync(directory).catch(() => []);
    const sizes = await Promise.all(fileNames.map(async (fileName) => {
      const info = await FileSystem.getInfoAsync(`${directory}${fileName}`).catch(() => null);

      return info?.exists && typeof info.size === 'number' && info.size > 0 ? info.size : 0;
    }));

    return sizes.reduce((total, size) => total + size, 0);
  }));

  return directorySizes.reduce((total, size) => total + size, 0);
}

export async function uploadEncryptedChatMedia(input: {
  chatType?: 'DIRECT' | 'GROUP';
  contactId: string;
  idToken: string;
  media: LocalChatMediaInput;
  onNativeTransferStarted?: (transferId: string) => void;
  onNativeTransferIdsUpdated?: (transferIds: string[]) => void;
  onProgress?: (progress: number) => void;
  onUploadRecoveryState?: (state: ChatMediaUploadRecoveryState) => void;
}): Promise<ChatMediaAttachment> {
  // Compress before caching so the copy check below sees the final file. Library
  // media is normally already compressed by the preparation queue; this catches
  // the paths that bypass it - camera capture, forwards, and resends.
  const compressedMedia = await compressChatVideoForUpload(input.media);
  const localMedia = await cacheLocalChatMedia(compressedMedia);

  ensureMediaSize(localMedia.kind, localMedia.sizeBytes);

  if (shouldUseNativeAeadMediaEncryption(localMedia)) {
    const nativeMedia = await uploadNativeAeadEncryptedChatMedia({
      ...input,
      media: localMedia
    }).catch((error: unknown) => {
      // Never rethrow — the Secretbox path below still works. But a silent
      // fallback here is expensive and invisible: JavaScript encryption of a
      // 146 MB video blocks the single JS thread for tens of seconds in bursts,
      // which is felt as the whole app freezing. Say so.
      logMediaEncryption('native AEAD failed, falling back to JavaScript Secretbox', {
        message: error instanceof Error ? error.message : String(error),
        sizeBytes: localMedia.sizeBytes
      });
      return null;
    });

    if (nativeMedia) {
      return nativeMedia;
    }
  }

  if (localMedia.sizeBytes > CHAT_MEDIA_CHUNK_UPLOAD_THRESHOLD_BYTES) {
    return withLargeMediaUploadWorkerSlot(() =>
      uploadChunkedEncryptedChatMedia({
        ...input,
        media: localMedia
      })
    );
  }

  return uploadSingleEncryptedChatMedia({
    ...input,
    media: localMedia
  });
}

/**
 * Last-chance video compression before encryption.
 *
 * Already-compressed output is recognised by its cache file name, so the common
 * path (library media, already handled by the preparation queue) costs one
 * string check. Any failure returns the input untouched - a compression problem
 * must never become a send failure.
 */
async function compressChatVideoForUpload(media: LocalChatMediaInput): Promise<LocalChatMediaInput> {
  if (media.kind !== 'video' || isDataUri(media.uri) || isAlreadyTranscodedMediaUri(media.uri)) {
    return media;
  }

  const transcoded = await transcodeChatVideo({
    fileName: media.fileName,
    qualityMode: media.qualityMode,
    requestId: `upload_transcode_${Date.now()}_${randomHex(5)}`,
    sizeBytes: media.sizeBytes,
    sourceUri: media.uri
  }).catch(() => null);

  if (!transcoded?.fileUri) {
    return media;
  }

  return {
    ...media,
    contentType: 'video/mp4',
    durationMs: transcoded.durationMs || media.durationMs,
    height: transcoded.height || media.height,
    sizeBytes: transcoded.sizeBytes || media.sizeBytes,
    uri: transcoded.fileUri,
    width: transcoded.width || media.width
  };
}

function isAlreadyTranscodedMediaUri(uri: string): boolean {
  return /\/transcoded_[^/]*$/u.test(uri);
}

function logMediaEncryption(outcome: string, details: Record<string, unknown>): void {
  const detailText = Object.entries(details)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');

  console.log(`[SynzappMediaEncryption] ${outcome}${detailText ? ` ${detailText}` : ''}`);
}

function shouldUseNativeAeadMediaEncryption(media: LocalChatMediaInput): boolean {
  return media.sizeBytes >= CHAT_MEDIA_NATIVE_AEAD_MIN_BYTES &&
    (media.kind === 'video' || media.kind === 'image' || media.kind === 'file') &&
    !isDataUri(media.uri);
}

async function uploadNativeAeadEncryptedChatMedia(input: {
  chatType?: 'DIRECT' | 'GROUP';
  contactId: string;
  idToken: string;
  media: LocalChatMediaInput;
  onNativeTransferStarted?: (transferId: string) => void;
  onProgress?: (progress: number) => void;
  onUploadRecoveryState?: (state: ChatMediaUploadRecoveryState) => void;
}): Promise<ChatMediaAttachment | null> {
  const localMedia = input.media;
  const capabilities = await getNativeMediaPipelineCapabilities();

  if (!capabilities.nativeAeadMediaEncryptionAvailable) {
    logMediaEncryption('native AEAD unavailable on this device, using JavaScript Secretbox', {
      reason: capabilities.reason,
      sizeBytes: localMedia.sizeBytes
    });
    return null;
  }

  input.onProgress?.(0.06);
  const encryptedMedia = await encryptNativeMediaFile({
    chunkSizeBytes: getChatMediaUploadChunkSize(localMedia),
    fileName: localMedia.fileName,
    sourceUri: localMedia.uri
  });

  if (!encryptedMedia) {
    return null;
  }

  input.onProgress?.(0.36);
  const session = await createMediaUploadSession({
    chatType: input.chatType,
    contactId: input.contactId,
    contentType: localMedia.contentType,
    encryptedSizeBytes: encryptedMedia.encryptedSizeBytes,
    fileName: localMedia.fileName,
    idToken: input.idToken,
    kind: localMedia.kind,
    originalSizeBytes: localMedia.sizeBytes
  });
  const recoverableMedia: ChatMediaAttachment = {
    chunkSizeBytes: encryptedMedia.chunkSizeBytes,
    contentType: localMedia.contentType,
    durationMs: localMedia.durationMs,
    encryptedSizeBytes: encryptedMedia.encryptedSizeBytes,
    encryptionMode: 'native-chacha20poly1305-chunked-v1',
    fileName: localMedia.fileName,
    height: localMedia.height,
    key: encryptedMedia.key,
    kind: localMedia.kind,
    localUri: localMedia.uri,
    mediaId: session.mediaId,
    partCount: encryptedMedia.partCount,
    partNonces: encryptedMedia.partNonces,
    qualityMode: localMedia.qualityMode,
    sizeBytes: localMedia.sizeBytes,
    thumbnailContentType: localMedia.thumbnailContentType,
    thumbnailDataUrl: localMedia.thumbnailDataUrl,
    thumbnailHeight: localMedia.thumbnailHeight,
    thumbnailWidth: localMedia.thumbnailWidth,
    transferProgress: 0.36,
    transferStatus: 'uploading',
    width: localMedia.width
  };

  input.onUploadRecoveryState?.({
    chatType: input.chatType,
    expiresAt: session.expiresAt,
    media: recoverableMedia,
    mediaId: session.mediaId,
    uploadMode: 'single'
  });

  await uploadEncryptedFile({
    encryptedFileUri: encryptedMedia.encryptedFileUri,
    onNativeTransferStarted: input.onNativeTransferStarted,
    onProgress: (progress) => input.onProgress?.(0.36 + progress * 0.52),
    uploadUrl: session.uploadUrl
  });
  await completeMediaUpload({
    chatType: input.chatType,
    contactId: input.contactId,
    idToken: input.idToken,
    mediaId: session.mediaId
  });
  input.onProgress?.(0.92);

  return {
    ...recoverableMedia,
    transferProgress: 0.92,
    transferStatus: 'uploading'
  };
}

async function withLargeMediaUploadWorkerSlot<T>(operation: () => Promise<T>): Promise<T> {
  await acquireLargeMediaUploadWorkerSlot();

  try {
    return await operation();
  } finally {
    releaseLargeMediaUploadWorkerSlot();
  }
}

function acquireLargeMediaUploadWorkerSlot(): Promise<void> {
  if (activeLargeUploadWorkerCount < CHAT_MEDIA_LARGE_UPLOAD_WORKER_CONCURRENCY) {
    activeLargeUploadWorkerCount += 1;
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    largeUploadWorkerWaiters.push(() => {
      activeLargeUploadWorkerCount += 1;
      resolve();
    });
  });
}

function releaseLargeMediaUploadWorkerSlot(): void {
  activeLargeUploadWorkerCount = Math.max(activeLargeUploadWorkerCount - 1, 0);
  const nextWaiter = largeUploadWorkerWaiters.shift();

  if (nextWaiter) {
    nextWaiter();
  }
}

async function uploadSingleEncryptedChatMedia(input: {
  chatType?: 'DIRECT' | 'GROUP';
  contactId: string;
  idToken: string;
  media: LocalChatMediaInput;
  onNativeTransferStarted?: (transferId: string) => void;
  onProgress?: (progress: number) => void;
  onUploadRecoveryState?: (state: ChatMediaUploadRecoveryState) => void;
}): Promise<ChatMediaAttachment> {
  const localMedia = input.media;
  input.onProgress?.(0.08);
  const encryptedMedia = await encryptLocalMediaFile(localMedia.uri);

  input.onProgress?.(0.42);
  const session = await createMediaUploadSession({
    chatType: input.chatType,
    contactId: input.contactId,
    contentType: localMedia.contentType,
    encryptedSizeBytes: encryptedMedia.encryptedSizeBytes,
    fileName: localMedia.fileName,
    idToken: input.idToken,
    kind: localMedia.kind,
    originalSizeBytes: localMedia.sizeBytes
  });
  const recoverableMedia: ChatMediaAttachment = {
    contentType: localMedia.contentType,
    durationMs: localMedia.durationMs,
    encryptedSizeBytes: encryptedMedia.encryptedSizeBytes,
    fileName: localMedia.fileName,
    height: localMedia.height,
    key: encryptedMedia.key,
    encryptionMode: 'secretbox-v1',
    kind: localMedia.kind,
    localUri: localMedia.uri,
    mediaId: session.mediaId,
    nonce: encryptedMedia.nonce,
    qualityMode: localMedia.qualityMode,
    sizeBytes: localMedia.sizeBytes,
    thumbnailContentType: localMedia.thumbnailContentType,
    thumbnailDataUrl: localMedia.thumbnailDataUrl,
    thumbnailHeight: localMedia.thumbnailHeight,
    thumbnailWidth: localMedia.thumbnailWidth,
    transferProgress: 0.42,
    transferStatus: 'uploading',
    width: localMedia.width
  };

  input.onUploadRecoveryState?.({
    chatType: input.chatType,
    expiresAt: session.expiresAt,
    media: recoverableMedia,
    mediaId: session.mediaId,
    uploadMode: 'single'
  });

  await uploadEncryptedFile({
    encryptedFileUri: encryptedMedia.encryptedFileUri,
    onNativeTransferStarted: input.onNativeTransferStarted,
    onProgress: (progress) => input.onProgress?.(0.42 + progress * 0.46),
    uploadUrl: session.uploadUrl
  });
  await completeMediaUpload({
    chatType: input.chatType,
    contactId: input.contactId,
    idToken: input.idToken,
    mediaId: session.mediaId
  });
  input.onProgress?.(0.92);

  return {
    ...recoverableMedia,
    transferProgress: 0.92,
    transferStatus: 'uploading'
  };
}

async function uploadChunkedEncryptedChatMedia(input: {
  chatType?: 'DIRECT' | 'GROUP';
  contactId: string;
  idToken: string;
  media: LocalChatMediaInput;
  onNativeTransferStarted?: (transferId: string) => void;
  onNativeTransferIdsUpdated?: (transferIds: string[]) => void;
  onProgress?: (progress: number) => void;
  onUploadRecoveryState?: (state: ChatMediaUploadRecoveryState) => void;
}): Promise<ChatMediaAttachment> {
  const localMedia = input.media;
  const chunkSizeBytes = getChatMediaJsFallbackChunkSize();
  const partCount = Math.ceil(localMedia.sizeBytes / chunkSizeBytes);
  const encryptedSizeBytes = localMedia.sizeBytes + partCount * nacl.secretbox.overheadLength;
  const keyBytes = Crypto.getRandomBytes(nacl.secretbox.keyLength);
  const session = await createMediaUploadSession({
    chatType: input.chatType,
    chunkCount: partCount,
    chunkSizeBytes,
    contactId: input.contactId,
    contentType: localMedia.contentType,
    encryptedSizeBytes,
    fileName: localMedia.fileName,
    idToken: input.idToken,
    kind: localMedia.kind,
    originalSizeBytes: localMedia.sizeBytes
  });
  const partUploadUrls = session.partUploadUrls || [];

  if (partUploadUrls.length !== partCount) {
    throw new Error('Secure chunked media upload is not available yet. Please wait for the backend deployment to finish, then try again.');
  }

  input.onProgress?.(0.04);

  const partNonces: string[] = [];
  const uploadedPartIndexes: number[] = [];
  const encryptedPartUploadTasks: Array<() => Promise<void>> = [];
  const buildRecoverableMedia = (progress: number): ChatMediaAttachment => ({
    chunkSizeBytes,
    contentType: localMedia.contentType,
    durationMs: localMedia.durationMs,
    encryptedSizeBytes,
    encryptionMode: 'chunked-secretbox-v1',
    fileName: localMedia.fileName,
    height: localMedia.height,
    key: fromByteArray(keyBytes),
    kind: localMedia.kind,
    localUri: localMedia.uri,
    mediaId: session.mediaId,
    partCount: partNonces.length === partCount ? partCount : undefined,
    partNonces: partNonces.length ? [...partNonces] : undefined,
    qualityMode: localMedia.qualityMode,
    sizeBytes: localMedia.sizeBytes,
    thumbnailContentType: localMedia.thumbnailContentType,
    thumbnailDataUrl: localMedia.thumbnailDataUrl,
    thumbnailHeight: localMedia.thumbnailHeight,
    thumbnailWidth: localMedia.thumbnailWidth,
    transferProgress: progress,
    transferStatus: 'uploading',
    width: localMedia.width
  });

  let recoverableMedia = buildRecoverableMedia(0.08);

  input.onUploadRecoveryState?.({
    chatType: input.chatType,
    expiresAt: session.expiresAt,
    media: recoverableMedia,
    mediaId: session.mediaId,
    partNativeTransferIds: [],
    uploadedPartIndexes: [],
    uploadMode: 'chunked'
  });

  let uploadedBytes = 0;
  const nativeTransferIds: string[] = [];

  for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
    await yieldToMediaUi();

    const partStart = partIndex * chunkSizeBytes;
    const partLength = Math.min(chunkSizeBytes, localMedia.sizeBytes - partStart);
    const partSession = partUploadUrls.find((part) => part.partIndex === partIndex);

    if (!partSession) {
      throw new Error('Media upload session is missing a chunk.');
    }

    await yieldToMediaUi();
    const encryptedPart = await encryptLocalMediaChunk({
      keyBytes,
      length: partLength,
      partIndex,
      position: partStart,
      sourceUri: localMedia.uri
    });
    await yieldToMediaUi();

    partNonces.push(encryptedPart.nonce);
    recoverableMedia = buildRecoverableMedia(0.08 + (uploadedBytes / Math.max(localMedia.sizeBytes, 1)) * 0.78);
    input.onUploadRecoveryState?.({
      chatType: input.chatType,
      expiresAt: session.expiresAt,
      media: recoverableMedia,
      mediaId: session.mediaId,
      partNativeTransferIds: nativeTransferIds,
      uploadedPartIndexes: [...uploadedPartIndexes],
      uploadMode: 'chunked'
    });

    await yieldToMediaUi();

    encryptedPartUploadTasks.push(async () => {
      await uploadEncryptedFile({
        encryptedFileUri: encryptedPart.encryptedFileUri,
        onNativeTransferStarted: (transferId) => {
          nativeTransferIds.push(transferId);
          input.onNativeTransferStarted?.(transferId);
          input.onNativeTransferIdsUpdated?.([...nativeTransferIds]);
        },
        onProgress: (progress) => {
          const completedBytes = uploadedPartIndexes.reduce((total, uploadedPartIndex) => {
            const uploadedPartStart = uploadedPartIndex * chunkSizeBytes;
            return total + Math.min(chunkSizeBytes, localMedia.sizeBytes - uploadedPartStart);
          }, 0);
          const uploadedPartBytes = progress * partLength;
          input.onProgress?.(0.08 + ((completedBytes + uploadedPartBytes) / Math.max(localMedia.sizeBytes, 1)) * 0.78);
        },
        uploadUrl: partSession.uploadUrl
      });

      uploadedBytes += partLength;
      uploadedPartIndexes.push(partIndex);
      recoverableMedia = buildRecoverableMedia(0.08 + (uploadedBytes / Math.max(localMedia.sizeBytes, 1)) * 0.78);
      input.onUploadRecoveryState?.({
        chatType: input.chatType,
        expiresAt: session.expiresAt,
        media: recoverableMedia,
        mediaId: session.mediaId,
        partNativeTransferIds: nativeTransferIds,
        uploadedPartIndexes: [...uploadedPartIndexes],
        uploadMode: 'chunked'
      });
      input.onProgress?.(0.08 + (uploadedBytes / Math.max(localMedia.sizeBytes, 1)) * 0.78);
    });

    if (encryptedPartUploadTasks.length >= CHAT_MEDIA_NATIVE_PART_UPLOAD_CONCURRENCY) {
      const uploadTasks = encryptedPartUploadTasks.splice(0, encryptedPartUploadTasks.length);
      await Promise.all(uploadTasks.map((uploadTask) => uploadTask()));
    }
    await yieldToMediaUi();
  }

  if (encryptedPartUploadTasks.length) {
    await Promise.all(encryptedPartUploadTasks.map((uploadTask) => uploadTask()));
  }

  await completeMediaUpload({
    chatType: input.chatType,
    contactId: input.contactId,
    idToken: input.idToken,
    mediaId: session.mediaId
  });
  input.onProgress?.(0.92);

  return {
    ...recoverableMedia,
    transferProgress: 0.92,
    transferStatus: 'uploading'
  };
}

/**
 * Chunk size for the JavaScript Secretbox fallback.
 *
 * Encrypting a chunk is one uninterrupted block of work on the single JS
 * thread: a base64 read, `nacl.secretbox` over the whole buffer, then a base64
 * write. Yielding between chunks does nothing for the time spent inside one, so
 * the chunk size *is* the freeze duration. At 8 MB each block ran into seconds,
 * which is felt as the app locking up while a large video sends.
 *
 * Smaller chunks mean more parts and slightly more overhead. That is the right
 * trade for a fallback path — this only runs when native encryption is
 * unavailable, and a responsive app matters more than the throughput of a path
 * that should be rare.
 */
const CHAT_MEDIA_JS_FALLBACK_CHUNK_SIZE_BYTES = 2 * 1024 * 1024;

function getChatMediaJsFallbackChunkSize(): number {
  return CHAT_MEDIA_JS_FALLBACK_CHUNK_SIZE_BYTES;
}

function getChatMediaUploadChunkSize(media: LocalChatMediaInput): number {
  if (
    media.sizeBytes >= CHAT_MEDIA_LARGE_INTERACTIVE_THRESHOLD_BYTES &&
    (media.kind === 'video' || media.kind === 'image' || media.kind === 'file')
  ) {
    return CHAT_MEDIA_LARGE_INTERACTIVE_CHUNK_SIZE_BYTES;
  }

  return CHAT_MEDIA_DEFAULT_CHUNK_SIZE_BYTES;
}

export async function completeUploadedChatMedia(input: {
  chatType?: 'DIRECT' | 'GROUP';
  contactId: string;
  idToken: string;
  mediaId: string;
}): Promise<void> {
  await completeMediaUpload(input);
}

async function cacheOriginalMediaUri(media: LocalChatMediaInput): Promise<string | null> {
  if (!media.originalUri || media.originalUri === media.uri || isDataUri(media.originalUri)) {
    return null;
  }

  if (isSynzappMediaCacheUri(media.originalUri)) {
    return media.originalUri;
  }

  const originalInfo = await FileSystem.getInfoAsync(media.originalUri).catch(() => null);

  if (!originalInfo?.exists) {
    return null;
  }

  const originalSizeBytes = typeof originalInfo.size === 'number' && originalInfo.size > 0
    ? originalInfo.size
    : media.originalSizeBytes || 0;

  if (originalSizeBytes <= 0 || originalSizeBytes > (activeChatMediaLimits[media.kind] || CHAT_MEDIA_LIMITS[media.kind])) {
    return null;
  }

  const cachedOriginalUri = getMediaCacheFileUri(
    `original_${Date.now()}_${randomHex(5)}_${sanitizeLocalCacheFileName(media.fileName, media.kind)}`
  );

  await FileSystem.copyAsync({
    from: media.originalUri,
    to: cachedOriginalUri
  });

  return cachedOriginalUri;
}

export async function downloadAndDecryptChatMedia(input: {
  chatType?: 'DIRECT' | 'GROUP';
  contactId: string;
  idToken: string;
  media: ChatMediaAttachment;
  onNativeTransferStarted?: (transferId: string) => void;
  onProgress?: (progress: number) => void;
}): Promise<string> {
  const mediaId = input.media.mediaId;
  if (input.media.localUri) {
    const localUri = await getExistingLocalMediaUri(input.media.localUri);

    if (localUri) {
      return localUri;
    }
  }

  const hasNativeAeadEncryption = input.media.encryptionMode === 'native-chacha20poly1305-chunked-v1' &&
    Boolean(mediaId && input.media.key && input.media.chunkSizeBytes && input.media.partCount) &&
    Array.isArray(input.media.partNonces) &&
    input.media.partNonces.length === input.media.partCount;
  const hasSinglePartEncryption = input.media.encryptionMode !== 'chunked-secretbox-v1' &&
    input.media.encryptionMode !== 'native-chacha20poly1305-chunked-v1' &&
    Boolean(mediaId && input.media.key && input.media.nonce);
  const hasChunkedEncryption = input.media.encryptionMode === 'chunked-secretbox-v1' &&
    Boolean(mediaId && input.media.key && input.media.chunkSizeBytes && input.media.partCount) &&
    Array.isArray(input.media.partNonces) &&
    input.media.partNonces.length === input.media.partCount;

  if (!mediaId || (!hasSinglePartEncryption && !hasChunkedEncryption && !hasNativeAeadEncryption)) {
    throw new Error('This media message cannot be downloaded.');
  }

  const encryptedUri = getMediaCacheFileUri(`${input.media.mediaId}.encrypted`);
  const plainUri = getMediaCacheFileUri(`${input.media.mediaId}.${getFileExtension(input.media)}`);
  const plainTemporaryUri = getMediaCacheFileUri(`${input.media.mediaId}.${getFileExtension(input.media)}.download`);

  await ensureMediaCacheDirectory();
  const cachedPlainFile = await FileSystem.getInfoAsync(plainUri);

  if (cachedPlainFile.exists) {
    input.onProgress?.(1);
    return plainUri;
  }

  const session = await getMediaDownloadSession({
    chatType: input.chatType,
    contactId: input.contactId,
    idToken: input.idToken,
    mediaId
  });

  await FileSystem.deleteAsync(encryptedUri, { idempotent: true }).catch(() => undefined);

  const nativeDownload = await downloadFileWithNativeBackgroundTransfer({
    destinationUri: encryptedUri,
    onNativeTransferStarted: input.onNativeTransferStarted,
    onProgress: (progress) => input.onProgress?.(Math.min(progress, 0.96)),
    url: session.downloadUrl
  });

  if (!nativeDownload) {
    const download = FileSystem.createDownloadResumable(
      session.downloadUrl,
      encryptedUri,
      {},
      (progress) => {
        const total = progress.totalBytesExpectedToWrite || session.encryptedSizeBytes || 1;
        input.onProgress?.(Math.min(progress.totalBytesWritten / total, 0.96));
      }
    );
    const result = await download.downloadAsync();

    if (!result || result.status < 200 || result.status >= 300) {
      throw new Error('Unable to download this media.');
    }
  }

  if (input.media.encryptionMode === 'native-chacha20poly1305-chunked-v1') {
    const decrypted = await decryptNativeMediaFile({
      chunkSizeBytes: input.media.chunkSizeBytes || 0,
      encryptedFileUri: encryptedUri,
      fileName: input.media.fileName,
      key: input.media.key || '',
      originalSizeBytes: input.media.sizeBytes,
      partCount: input.media.partCount || 0,
      partNonces: input.media.partNonces || []
    });

    if (!decrypted?.fileUri) {
      throw new Error('Unable to decrypt this media.');
    }

    await FileSystem.deleteAsync(plainUri, { idempotent: true }).catch(() => undefined);
    await FileSystem.moveAsync({
      from: decrypted.fileUri,
      to: plainUri
    });
    await FileSystem.deleteAsync(encryptedUri, { idempotent: true }).catch(() => undefined);
    input.onProgress?.(1);
    await pruneChatMediaCache({
      protectedUris: [plainUri]
    }).catch(() => undefined);

    return plainUri;
  }

  const plaintext = input.media.encryptionMode === 'chunked-secretbox-v1'
    ? await decryptChunkedMediaFile(encryptedUri, input.media)
    : await decryptSinglePartMediaFile(encryptedUri, input.media);

  await FileSystem.deleteAsync(plainTemporaryUri, { idempotent: true }).catch(() => undefined);
  await FileSystem.writeAsStringAsync(plainTemporaryUri, fromByteArray(plaintext), {
    encoding: FileSystem.EncodingType.Base64
  });
  await FileSystem.deleteAsync(plainUri, { idempotent: true }).catch(() => undefined);
  await FileSystem.moveAsync({
    from: plainTemporaryUri,
    to: plainUri
  });
  await FileSystem.deleteAsync(encryptedUri, { idempotent: true }).catch(() => undefined);
  input.onProgress?.(1);
  await pruneChatMediaCache({
    protectedUris: [plainUri]
  }).catch(() => undefined);

  return plainUri;
}

async function decryptSinglePartMediaFile(
  encryptedUri: string,
  media: ChatMediaAttachment
): Promise<Uint8Array> {
  if (!media.key || !media.nonce) {
    throw new Error('This media message cannot be decrypted.');
  }

  const encryptedBase64 = await FileSystem.readAsStringAsync(encryptedUri, {
    encoding: FileSystem.EncodingType.Base64
  });
  const plaintext = nacl.secretbox.open(
    toByteArray(encryptedBase64),
    toByteArray(media.nonce),
    toByteArray(media.key)
  );

  if (!plaintext) {
    throw new Error('Unable to decrypt this media.');
  }

  return plaintext;
}

async function decryptChunkedMediaFile(
  encryptedUri: string,
  media: ChatMediaAttachment
): Promise<Uint8Array> {
  if (
    !media.key ||
    !media.chunkSizeBytes ||
    !media.partCount ||
    !Array.isArray(media.partNonces) ||
    media.partNonces.length !== media.partCount
  ) {
    throw new Error('This media message cannot be decrypted.');
  }

  const keyBytes = toByteArray(media.key);
  const chunks: Uint8Array[] = [];
  let encryptedPosition = 0;
  let totalPlaintextBytes = 0;

  for (let partIndex = 0; partIndex < media.partCount; partIndex += 1) {
    const plainPartLength = Math.min(
      media.chunkSizeBytes,
      Math.max(media.sizeBytes - partIndex * media.chunkSizeBytes, 0)
    );
    const encryptedPartLength = plainPartLength + nacl.secretbox.overheadLength;
    const encryptedBase64 = await FileSystem.readAsStringAsync(encryptedUri, {
      encoding: FileSystem.EncodingType.Base64,
      length: encryptedPartLength,
      position: encryptedPosition
    });
    const plaintext = nacl.secretbox.open(
      toByteArray(encryptedBase64),
      toByteArray(media.partNonces[partIndex]),
      keyBytes
    );

    if (!plaintext) {
      throw new Error('Unable to decrypt this media.');
    }

    chunks.push(plaintext);
    totalPlaintextBytes += plaintext.length;
    encryptedPosition += encryptedPartLength;
  }

  return concatUint8Arrays(chunks, totalPlaintextBytes);
}

function ensureMediaSize(kind: ChatMediaKind, sizeBytes: number): void {
  const limitBytes = activeChatMediaLimits[kind] || CHAT_MEDIA_LIMITS[kind];

  if (sizeBytes > limitBytes) {
    const label = kind === 'image'
      ? 'Photo'
      : kind === 'video'
        ? 'Video'
        : kind === 'audio'
          ? 'Voice note'
          : 'File';

    throw new Error(`${label} exceeds the ${formatByteCount(limitBytes)} company media limit.`);
  }
}

function normalizeChatMediaLimit(kind: ChatMediaKind, value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(Math.round(value), 1024 * 1024), CHAT_MEDIA_MAX_POLICY_LIMITS[kind])
    : CHAT_MEDIA_LIMITS[kind];
}

function formatByteCount(sizeBytes: number): string {
  const safeSize = Number.isFinite(sizeBytes) ? Math.max(sizeBytes, 0) : 0;

  if (safeSize >= 1024 * 1024) {
    return `${(safeSize / (1024 * 1024)).toFixed(safeSize >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }

  if (safeSize >= 1024) {
    return `${Math.round(safeSize / 1024)} KB`;
  }

  return `${Math.round(safeSize)} B`;
}

async function createMediaUploadSession(input: {
  chatType?: 'DIRECT' | 'GROUP';
  chunkCount?: number;
  chunkSizeBytes?: number;
  contactId: string;
  contentType: string;
  encryptedSizeBytes: number;
  fileName: string;
  idToken: string;
  kind: ChatMediaKind;
  originalSizeBytes: number;
}): Promise<MediaUploadSession> {
  const path = input.chatType === 'GROUP'
    ? `/api/profile/chat/groups/${encodeURIComponent(input.contactId)}/media/upload-session`
    : `/api/profile/chat/conversations/${encodeURIComponent(input.contactId)}/media/upload-session`;
  const response = await fetch(
    `${getSynzappApiBaseUrl()}${path}`,
    {
      body: JSON.stringify({
        chunkCount: input.chunkCount,
        chunkSizeBytes: input.chunkSizeBytes,
        contentType: input.contentType,
        encryptedSizeBytes: input.encryptedSizeBytes,
        fileName: input.fileName,
        kind: input.kind,
        originalSizeBytes: input.originalSizeBytes
      }),
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.idToken}`,
        'Content-Type': 'application/json',
        ...(await getRegisteredDeviceHeaders(input.idToken))
      },
      method: 'POST'
    }
  );

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  const body = await response.json() as { session: MediaUploadSession };

  return body.session;
}

async function completeMediaUpload(input: {
  chatType?: 'DIRECT' | 'GROUP';
  contactId: string;
  idToken: string;
  mediaId: string;
}): Promise<void> {
  const path = input.chatType === 'GROUP'
    ? `/api/profile/chat/groups/${encodeURIComponent(input.contactId)}/media/${encodeURIComponent(input.mediaId)}/complete`
    : `/api/profile/chat/conversations/${encodeURIComponent(input.contactId)}/media/${encodeURIComponent(input.mediaId)}/complete`;
  const response = await fetch(
    `${getSynzappApiBaseUrl()}${path}`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.idToken}`,
        ...(await getRegisteredDeviceHeaders(input.idToken))
      },
      method: 'POST'
    }
  );

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }
}

async function getMediaDownloadSession(input: {
  chatType?: 'DIRECT' | 'GROUP';
  contactId: string;
  idToken: string;
  mediaId: string;
}): Promise<MediaDownloadSession> {
  const path = input.chatType === 'GROUP'
    ? `/api/profile/chat/groups/${encodeURIComponent(input.contactId)}/media/${encodeURIComponent(input.mediaId)}/download`
    : `/api/profile/chat/conversations/${encodeURIComponent(input.contactId)}/media/${encodeURIComponent(input.mediaId)}/download`;
  const response = await fetch(
    `${getSynzappApiBaseUrl()}${path}`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.idToken}`,
        ...(await getRegisteredDeviceHeaders(input.idToken))
      },
      method: 'GET'
    }
  );

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  const body = await response.json() as { session: MediaDownloadSession };

  return body.session;
}

async function encryptLocalMediaFile(uri: string): Promise<{
  encryptedFileUri: string;
  encryptedSizeBytes: number;
  key: string;
  nonce: string;
}> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64
  });
  const keyBytes = Crypto.getRandomBytes(nacl.secretbox.keyLength);
  const nonceBytes = Crypto.getRandomBytes(nacl.secretbox.nonceLength);
  const encryptedBytes = nacl.secretbox(toByteArray(base64), nonceBytes, keyBytes);
  const encryptedFileUri = getMediaCacheFileUri(`upload_${Date.now()}_${randomHex(5)}.bin`);

  await ensureMediaCacheDirectory();
  await FileSystem.writeAsStringAsync(encryptedFileUri, fromByteArray(encryptedBytes), {
    encoding: FileSystem.EncodingType.Base64
  });

  return {
    encryptedFileUri,
    encryptedSizeBytes: encryptedBytes.length,
    key: fromByteArray(keyBytes),
    nonce: fromByteArray(nonceBytes)
  };
}

async function encryptLocalMediaChunk(input: {
  keyBytes: Uint8Array;
  length: number;
  partIndex: number;
  position: number;
  sourceUri: string;
}): Promise<{
  encryptedFileUri: string;
  encryptedSizeBytes: number;
  nonce: string;
}> {
  const base64 = await FileSystem.readAsStringAsync(input.sourceUri, {
    encoding: FileSystem.EncodingType.Base64,
    length: input.length,
    position: input.position
  });
  const nonceBytes = Crypto.getRandomBytes(nacl.secretbox.nonceLength);
  const encryptedBytes = nacl.secretbox(toByteArray(base64), nonceBytes, input.keyBytes);
  const encryptedFileUri = getMediaCacheFileUri(`upload_part_${Date.now()}_${input.partIndex}_${randomHex(5)}.bin`);

  await ensureMediaCacheDirectory();
  await FileSystem.writeAsStringAsync(encryptedFileUri, fromByteArray(encryptedBytes), {
    encoding: FileSystem.EncodingType.Base64
  });

  return {
    encryptedFileUri,
    encryptedSizeBytes: encryptedBytes.length,
    nonce: fromByteArray(nonceBytes)
  };
}

function yieldToMediaUi(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0);
    });
  });
}

async function uploadEncryptedFile(input: {
  encryptedFileUri: string;
  onNativeTransferStarted?: (transferId: string) => void;
  onProgress?: (progress: number) => void;
  uploadUrl: string;
}): Promise<void> {
  const nativeUpload = await uploadFileWithNativeBackgroundTransfer({
    fileUri: input.encryptedFileUri,
    headers: {
      'Content-Type': 'application/octet-stream'
    },
    method: 'PUT',
    onNativeTransferStarted: input.onNativeTransferStarted,
    onProgress: input.onProgress,
    url: input.uploadUrl
  });

  if (nativeUpload) {
    await FileSystem.deleteAsync(input.encryptedFileUri, { idempotent: true }).catch(() => undefined);
    return;
  }

  const uploadTask = FileSystem.createUploadTask(
    input.uploadUrl,
    input.encryptedFileUri,
    {
      headers: {
        'Content-Type': 'application/octet-stream'
      },
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT
    },
    (progress) => {
      const total = progress.totalBytesExpectedToSend || 1;
      input.onProgress?.(Math.min(progress.totalBytesSent / total, 1));
    }
  );
  const result = await uploadTask.uploadAsync();

  await FileSystem.deleteAsync(input.encryptedFileUri, { idempotent: true }).catch(() => undefined);

  if (!result || result.status < 200 || result.status >= 300) {
    throw new Error('Unable to upload encrypted media.');
  }
}

function getMediaCacheFileUri(fileName: string): string {
  const directory = getActiveChatMediaDirectory();

  if (!directory) {
    throw new Error('Local media storage is not available.');
  }

  return `${directory}${fileName.replace(/[^A-Za-z0-9._-]/g, '_')}`;
}

function isDataUri(uri: string): boolean {
  return uri.trim().startsWith('data:');
}

function isSynzappMediaCacheUri(uri: string): boolean {
  return isManagedChatMediaUri(uri);
}

/**
 * Returns the media URI only if the file is actually readable right now.
 *
 * Beyond the container rename above, iOS may purge anything under Caches when
 * storage runs low. Callers use the null to fall back to the embedded thumbnail
 * and re-download, instead of rendering a black tile.
 */
export async function getExistingLocalMediaUri(uri: string): Promise<string | null> {
  if (isDataUri(uri)) {
    return uri;
  }

  if (!uri.trim()) {
    return null;
  }

  const resolvedUri = resolveLocalChatMediaUri(uri);
  const info = await FileSystem.getInfoAsync(resolvedUri).catch(() => null);

  if (info?.exists) {
    return resolvedUri;
  }

  if (resolvedUri === uri) {
    return null;
  }

  // Fall back to the original path in case this file was never ours to rebase.
  const originalInfo = await FileSystem.getInfoAsync(uri).catch(() => null);

  return originalInfo?.exists ? uri : null;
}

async function ensureMediaCacheDirectory(): Promise<void> {
  const directory = getActiveChatMediaDirectory();

  if (!directory) {
    throw new Error('Local media storage is not available.');
  }

  await FileSystem.makeDirectoryAsync(directory, { intermediates: true }).catch(() => undefined);
}

async function pruneChatMediaCache(input: {
  protectedUris?: string[];
} = {}): Promise<void> {
  if (!getActiveChatMediaDirectory()) {
    return;
  }

  const protectedUris = new Set((input.protectedUris || []).filter(Boolean));
  // Prune both governed plaintext directories. Natively prepared and transcoded
  // media is no longer copied into chatMediaCacheDirectory, so pruning only that
  // one would let the native cache grow past the tenant cache budget.
  const directories = [chatMediaCacheDirectory, nativeChatMediaCacheDirectory, getPersistentChatMediaDirectory()]
    .filter((directory): directory is string => Boolean(directory));
  const files = (await Promise.all(directories.map(async (directory) => {
    const fileNames = await FileSystem.readDirectoryAsync(directory).catch(() => []);

    return Promise.all(fileNames.map(async (fileName) => {
      const uri = `${directory}${fileName}`;
      const info = await FileSystem.getInfoAsync(uri).catch(() => null);

      if (!info?.exists) {
        return null;
      }

      return {
        isProtected: protectedUris.has(uri),
        modificationTime: typeof info.modificationTime === 'number' ? info.modificationTime : 0,
        size: typeof info.size === 'number' && info.size > 0 ? info.size : 0,
        uri
      };
    }));
  }))).flat();
  const existingFiles = files
    .filter((file): file is { isProtected: boolean; modificationTime: number; size: number; uri: string } => Boolean(file));
  const deletableFiles = existingFiles
    .filter((file) => !file.isProtected)
    .sort((first, second) => first.modificationTime - second.modificationTime);
  let totalBytes = existingFiles.reduce((total, file) => total + file.size, 0);
  const retentionCutoffSeconds = Date.now() / 1000 - (chatMediaCacheRetentionDays * 24 * 60 * 60);

  for (const file of deletableFiles) {
    if (file.modificationTime <= 0 || file.modificationTime >= retentionCutoffSeconds) {
      continue;
    }

    await FileSystem.deleteAsync(file.uri, { idempotent: true }).catch(() => undefined);
    totalBytes -= file.size;
  }

  const softLimitBytes = chatMediaCacheSoftLimitBytes;
  const targetBytes = Math.floor(softLimitBytes * 0.82);

  if (totalBytes <= softLimitBytes) {
    return;
  }

  for (const file of deletableFiles) {
    if (totalBytes <= targetBytes) {
      return;
    }

    await FileSystem.deleteAsync(file.uri, { idempotent: true }).catch(() => undefined);
    totalBytes -= file.size;
  }
}

function sanitizeLocalCacheFileName(fileName: string, kind: ChatMediaKind): string {
  const fallbackName = kind === 'image'
    ? 'photo.jpg'
    : kind === 'video'
      ? 'video.mp4'
      : kind === 'audio'
        ? 'voice-note.m4a'
        : 'attachment';
  const safeFileName = (fileName || fallbackName)
    .trim()
    .replace(/[^\w .()+-]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 96);

  return safeFileName || fallbackName;
}

function getFileExtension(media: ChatMediaAttachment): string {
  const nameExtension = media.fileName.split('.').pop()?.replace(/[^A-Za-z0-9]/g, '').toLowerCase();

  if (nameExtension) {
    return nameExtension.slice(0, 12);
  }

  if (media.kind === 'image') {
    const contentType = media.contentType.trim().toLowerCase();

    if (contentType === 'image/png') {
      return 'png';
    }

    if (contentType === 'image/webp') {
      return 'webp';
    }

    if (contentType === 'image/heic') {
      return 'heic';
    }

    if (contentType === 'image/heif') {
      return 'heif';
    }

    return 'jpg';
  }

  if (media.kind === 'video') {
    return 'mp4';
  }

  if (media.kind === 'audio') {
    return 'm4a';
  }

  return 'bin';
}

function randomHex(byteCount: number): string {
  return Array.from(Crypto.getRandomBytes(byteCount))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function concatUint8Arrays(chunks: Uint8Array[], totalLength: number): Uint8Array {
  const output = new Uint8Array(totalLength);
  let offset = 0;

  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });

  return output;
}

async function getResponseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();

    if (typeof body?.error === 'string') {
      return body.error;
    }
  } catch {
    return 'Unable to prepare media.';
  }

  return 'Unable to prepare media.';
}
