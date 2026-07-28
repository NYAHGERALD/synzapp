import { fromByteArray, toByteArray } from 'base64-js';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import nacl from 'tweetnacl';
import { getSynzappApiBaseUrl } from './apiConfig';
import { getRegisteredDeviceHeaders } from './deviceIdentity';
import type { ChatMediaAttachment, ChatMediaKind } from './chatApi';

export type ChatMediaQualityMode = 'hd' | 'standard';

export const CHAT_MEDIA_LIMITS: Record<ChatMediaKind, number> = {
  audio: 16 * 1024 * 1024,
  file: 100 * 1024 * 1024,
  image: 100 * 1024 * 1024,
  video: 250 * 1024 * 1024
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

export interface LocalChatMediaInput {
  contentType: string;
  durationMs?: number;
  fileName: string;
  height?: number;
  kind: ChatMediaKind;
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

const chatMediaCacheDirectory = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}Synzapp/Media/`
  : FileSystem.cacheDirectory
    ? `${FileSystem.cacheDirectory}Synzapp/Media/`
    : null;
const CHAT_MEDIA_CHUNK_UPLOAD_THRESHOLD_BYTES = 512 * 1024;
const CHAT_MEDIA_CHUNK_SIZE_BYTES = 512 * 1024;

export async function cacheLocalChatMedia(media: LocalChatMediaInput): Promise<LocalChatMediaInput> {
  ensureMediaSize(media.kind, media.sizeBytes);

  if (isDataUri(media.uri) || isSynzappMediaCacheUri(media.uri)) {
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

  return {
    ...media,
    originalUri: cachedOriginalUri || media.originalUri,
    sizeBytes: cachedSizeBytes,
    uri: cachedUri
  };
}

export async function uploadEncryptedChatMedia(input: {
  chatType?: 'DIRECT' | 'GROUP';
  contactId: string;
  idToken: string;
  media: LocalChatMediaInput;
  onProgress?: (progress: number) => void;
}): Promise<ChatMediaAttachment> {
  const localMedia = await cacheLocalChatMedia(input.media);

  ensureMediaSize(localMedia.kind, localMedia.sizeBytes);

  if (localMedia.sizeBytes > CHAT_MEDIA_CHUNK_UPLOAD_THRESHOLD_BYTES) {
    return uploadChunkedEncryptedChatMedia({
      ...input,
      media: localMedia
    });
  }

  return uploadSingleEncryptedChatMedia({
    ...input,
    media: localMedia
  });
}

async function uploadSingleEncryptedChatMedia(input: {
  chatType?: 'DIRECT' | 'GROUP';
  contactId: string;
  idToken: string;
  media: LocalChatMediaInput;
  onProgress?: (progress: number) => void;
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

  await uploadEncryptedFile({
    encryptedFileUri: encryptedMedia.encryptedFileUri,
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
    transferProgress: 0.92,
    transferStatus: 'uploading',
    width: localMedia.width
  };
}

async function uploadChunkedEncryptedChatMedia(input: {
  chatType?: 'DIRECT' | 'GROUP';
  contactId: string;
  idToken: string;
  media: LocalChatMediaInput;
  onProgress?: (progress: number) => void;
}): Promise<ChatMediaAttachment> {
  const localMedia = input.media;
  const chunkSizeBytes = CHAT_MEDIA_CHUNK_SIZE_BYTES;
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
  let uploadedBytes = 0;

  for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
    await yieldToMediaUi();

    const partStart = partIndex * chunkSizeBytes;
    const partLength = Math.min(chunkSizeBytes, localMedia.sizeBytes - partStart);
    const partSession = partUploadUrls.find((part) => part.partIndex === partIndex);

    if (!partSession) {
      throw new Error('Media upload session is missing a chunk.');
    }

    const encryptedPart = await encryptLocalMediaChunk({
      keyBytes,
      length: partLength,
      partIndex,
      position: partStart,
      sourceUri: localMedia.uri
    });

    partNonces.push(encryptedPart.nonce);
    await yieldToMediaUi();

    await uploadEncryptedFile({
      encryptedFileUri: encryptedPart.encryptedFileUri,
      onProgress: (progress) => {
        const uploadedPartBytes = progress * partLength;
        input.onProgress?.(0.04 + ((uploadedBytes + uploadedPartBytes) / Math.max(localMedia.sizeBytes, 1)) * 0.82);
      },
      uploadUrl: partSession.uploadUrl
    });

    uploadedBytes += partLength;
    input.onProgress?.(0.04 + (uploadedBytes / Math.max(localMedia.sizeBytes, 1)) * 0.82);
    await FileSystem.deleteAsync(encryptedPart.encryptedFileUri, { idempotent: true }).catch(() => undefined);
    await yieldToMediaUi();
  }

  await completeMediaUpload({
    chatType: input.chatType,
    contactId: input.contactId,
    idToken: input.idToken,
    mediaId: session.mediaId
  });
  input.onProgress?.(0.92);

  return {
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
    partCount,
    partNonces,
    qualityMode: localMedia.qualityMode,
    sizeBytes: localMedia.sizeBytes,
    thumbnailContentType: localMedia.thumbnailContentType,
    thumbnailDataUrl: localMedia.thumbnailDataUrl,
    thumbnailHeight: localMedia.thumbnailHeight,
    thumbnailWidth: localMedia.thumbnailWidth,
    transferProgress: 0.92,
    transferStatus: 'uploading',
    width: localMedia.width
  };
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

  if (originalSizeBytes <= 0 || originalSizeBytes > CHAT_MEDIA_LIMITS[media.kind]) {
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
  onProgress?: (progress: number) => void;
}): Promise<string> {
  const mediaId = input.media.mediaId;
  if (input.media.localUri) {
    const localUri = await getExistingLocalMediaUri(input.media.localUri);

    if (localUri) {
      return localUri;
    }
  }

  const hasSinglePartEncryption = input.media.encryptionMode !== 'chunked-secretbox-v1' &&
    Boolean(mediaId && input.media.key && input.media.nonce);
  const hasChunkedEncryption = input.media.encryptionMode === 'chunked-secretbox-v1' &&
    Boolean(mediaId && input.media.key && input.media.chunkSizeBytes && input.media.partCount) &&
    Array.isArray(input.media.partNonces) &&
    input.media.partNonces.length === input.media.partCount;

  if (!mediaId || (!hasSinglePartEncryption && !hasChunkedEncryption)) {
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
  if (sizeBytes > CHAT_MEDIA_LIMITS[kind]) {
    const label = kind === 'image'
      ? 'Photo'
      : kind === 'video'
        ? 'Video'
        : kind === 'audio'
          ? 'Voice note'
          : 'File';

    throw new Error(`${label} is too large to send.`);
  }
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
  onProgress?: (progress: number) => void;
  uploadUrl: string;
}): Promise<void> {
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
  if (!chatMediaCacheDirectory) {
    throw new Error('Local media storage is not available.');
  }

  return `${chatMediaCacheDirectory}${fileName.replace(/[^A-Za-z0-9._-]/g, '_')}`;
}

function isDataUri(uri: string): boolean {
  return uri.trim().startsWith('data:');
}

function isSynzappMediaCacheUri(uri: string): boolean {
  return Boolean(chatMediaCacheDirectory && uri.startsWith(chatMediaCacheDirectory));
}

async function getExistingLocalMediaUri(uri: string): Promise<string | null> {
  if (isDataUri(uri)) {
    return uri;
  }

  if (!uri.trim()) {
    return null;
  }

  const info = await FileSystem.getInfoAsync(uri).catch(() => null);

  return info?.exists ? uri : null;
}

async function ensureMediaCacheDirectory(): Promise<void> {
  if (!chatMediaCacheDirectory) {
    throw new Error('Local media storage is not available.');
  }

  await FileSystem.makeDirectoryAsync(chatMediaCacheDirectory, { intermediates: true }).catch(() => undefined);
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
