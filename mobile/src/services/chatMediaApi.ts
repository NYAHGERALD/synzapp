import { fromByteArray, toByteArray } from 'base64-js';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import nacl from 'tweetnacl';
import { getSynzappApiBaseUrl } from './apiConfig';
import { getRegisteredDeviceHeaders } from './deviceIdentity';
import type { ChatMediaAttachment, ChatMediaKind } from './chatApi';

export const CHAT_MEDIA_LIMITS: Record<ChatMediaKind, number> = {
  audio: 16 * 1024 * 1024,
  file: 100 * 1024 * 1024,
  image: 8 * 1024 * 1024,
  video: 64 * 1024 * 1024
};

interface MediaUploadSession {
  expiresAt: string;
  maxEncryptedSizeBytes: number;
  mediaId: string;
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

  return {
    ...media,
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
    kind: localMedia.kind,
    localUri: localMedia.uri,
    mediaId: session.mediaId,
    nonce: encryptedMedia.nonce,
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

export async function downloadAndDecryptChatMedia(input: {
  chatType?: 'DIRECT' | 'GROUP';
  contactId: string;
  idToken: string;
  media: ChatMediaAttachment;
  onProgress?: (progress: number) => void;
}): Promise<string> {
  if (input.media.localUri) {
    const localUri = await getExistingLocalMediaUri(input.media.localUri);

    if (localUri) {
      return localUri;
    }
  }

  if (!input.media.mediaId || !input.media.key || !input.media.nonce) {
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
    mediaId: input.media.mediaId
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

  const encryptedBase64 = await FileSystem.readAsStringAsync(encryptedUri, {
    encoding: FileSystem.EncodingType.Base64
  });
  const plaintext = nacl.secretbox.open(
    toByteArray(encryptedBase64),
    toByteArray(input.media.nonce),
    toByteArray(input.media.key)
  );

  if (!plaintext) {
    throw new Error('Unable to decrypt this media.');
  }

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
