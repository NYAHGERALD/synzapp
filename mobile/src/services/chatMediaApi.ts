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
  uri: string;
  width?: number;
}

const chatMediaCacheDirectory = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}Synzapp/Media/`
  : FileSystem.cacheDirectory
    ? `${FileSystem.cacheDirectory}Synzapp/Media/`
    : null;

export async function uploadEncryptedChatMedia(input: {
  chatType?: 'DIRECT' | 'GROUP';
  contactId: string;
  idToken: string;
  media: LocalChatMediaInput;
  onProgress?: (progress: number) => void;
}): Promise<ChatMediaAttachment> {
  ensureMediaSize(input.media.kind, input.media.sizeBytes);
  input.onProgress?.(0.08);
  const encryptedMedia = await encryptLocalMediaFile(input.media.uri);

  input.onProgress?.(0.42);
  const session = await createMediaUploadSession({
    chatType: input.chatType,
    contactId: input.contactId,
    contentType: input.media.contentType,
    encryptedSizeBytes: encryptedMedia.encryptedSizeBytes,
    fileName: input.media.fileName,
    idToken: input.idToken,
    kind: input.media.kind,
    originalSizeBytes: input.media.sizeBytes
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
    contentType: input.media.contentType,
    durationMs: input.media.durationMs,
    encryptedSizeBytes: encryptedMedia.encryptedSizeBytes,
    fileName: input.media.fileName,
    height: input.media.height,
    key: encryptedMedia.key,
    kind: input.media.kind,
    localUri: input.media.uri,
    mediaId: session.mediaId,
    nonce: encryptedMedia.nonce,
    sizeBytes: input.media.sizeBytes,
    transferProgress: 0.92,
    transferStatus: 'uploading',
    width: input.media.width
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
    return input.media.localUri;
  }

  if (!input.media.mediaId || !input.media.key || !input.media.nonce) {
    throw new Error('This media message cannot be downloaded.');
  }

  const encryptedUri = getMediaCacheFileUri(`${input.media.mediaId}.encrypted`);
  const plainUri = getMediaCacheFileUri(`${input.media.mediaId}.${getFileExtension(input.media)}`);

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

  await FileSystem.writeAsStringAsync(plainUri, fromByteArray(plaintext), {
    encoding: FileSystem.EncodingType.Base64
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

async function ensureMediaCacheDirectory(): Promise<void> {
  if (!chatMediaCacheDirectory) {
    throw new Error('Local media storage is not available.');
  }

  await FileSystem.makeDirectoryAsync(chatMediaCacheDirectory, { intermediates: true }).catch(() => undefined);
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
