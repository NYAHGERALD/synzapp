import { randomUUID } from 'node:crypto';
import { DecodedIdToken } from 'firebase-admin/auth';
import type { DocumentReference } from 'firebase-admin/firestore';
import { fieldValue, firestore, storageBucket } from '../config/firebaseAdmin.js';
import type { RegisteredDeviceIdentity } from './deviceIdentityService.js';
import { getEncryptedDirectContext } from './encryptedMessageEnvelopeService.js';
import { getGroupChatMediaContext } from './groupChatService.js';

export type ChatMediaKind = 'audio' | 'file' | 'image' | 'video';

export interface CreateEncryptedChatMediaUploadInput {
  contentType: string;
  encryptedSizeBytes: number;
  fileName: string;
  kind: ChatMediaKind;
  originalSizeBytes?: number;
}

export interface EncryptedChatMediaUploadSession {
  expiresAt: string;
  maxEncryptedSizeBytes: number;
  mediaId: string;
  uploadUrl: string;
}

export interface EncryptedChatMediaDownloadSession {
  contentType: string;
  downloadUrl: string;
  encryptedSizeBytes: number;
  expiresAt: string;
  fileName: string;
  kind: ChatMediaKind;
  mediaId: string;
}

interface ChatMediaRecord {
  chatId?: string;
  chatType?: ChatMediaScope;
  contentType?: string;
  encryptedSizeBytes?: number;
  expiresAtMs?: number | null;
  fileName?: string;
  groupId?: string;
  kind?: ChatMediaKind;
  participantIds?: string[];
  recipientUid?: string;
  retentionPolicy?: 'DIRECT_TEMPORARY' | 'DURABLE_GROUP_HISTORY';
  status?: string;
  storagePath?: string;
  tenantId?: string;
  uploadedByDeviceId?: string;
  uploadedByUid?: string;
}

type ChatMediaScope = 'DIRECT' | 'GROUP';

interface ChatMediaContext {
  chatId: string;
  chatRef: DocumentReference;
  chatType: ChatMediaScope;
  participantIds: string[];
  tenantId: string;
}

const CHAT_MEDIA_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CHAT_MEDIA_SIGNED_URL_TTL_MS = 15 * 60 * 1000;
const CHAT_MEDIA_LIMITS: Record<ChatMediaKind, number> = {
  audio: 16 * 1024 * 1024,
  file: 100 * 1024 * 1024,
  image: 8 * 1024 * 1024,
  video: 64 * 1024 * 1024
};

export async function createEncryptedChatMediaUploadSession(
  decodedToken: DecodedIdToken,
  activeDevice: RegisteredDeviceIdentity,
  contactId: string,
  input: CreateEncryptedChatMediaUploadInput,
  chatType: ChatMediaScope = 'DIRECT'
): Promise<EncryptedChatMediaUploadSession> {
  const context = await getChatMediaContext(decodedToken, contactId, chatType);
  const kind = input.kind;
  const maxEncryptedSizeBytes = CHAT_MEDIA_LIMITS[kind];
  const encryptedSizeBytes = Math.ceil(input.encryptedSizeBytes);

  if (!maxEncryptedSizeBytes) {
    throw validationError('Media type is not supported.');
  }

  if (!encryptedSizeBytes || encryptedSizeBytes > maxEncryptedSizeBytes) {
    throw validationError(getMediaTooLargeMessage(kind));
  }

  const contentType = normalizeContentType(input.contentType, kind);
  const fileName = sanitizeFileName(input.fileName, kind);
  const mediaId = `media_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 18)}`;
  const storagePath = [
    'tenants',
    context.tenantId,
    'chats',
    context.chatId,
    'messageEnvelopes',
    'pending',
    'encryptedAttachments',
    mediaId
  ].join('/');
  const expiresAtMs = Date.now() + CHAT_MEDIA_TTL_MS;

  await context.chatRef.collection('mediaAttachments').doc(mediaId).set({
    chatId: context.chatId,
    chatType: context.chatType,
    contentType,
    createdAt: fieldValue.serverTimestamp(),
    encryptedSizeBytes,
    expiresAtMs,
    fileName,
    groupId: context.chatType === 'GROUP' ? context.chatId : null,
    kind,
    originalSizeBytes: input.originalSizeBytes || null,
    participantIds: context.participantIds,
    recipientUid: context.chatType === 'DIRECT'
      ? context.participantIds.find((uid) => uid !== decodedToken.uid) || null
      : null,
    status: 'PENDING_UPLOAD',
    storagePath,
    tenantId: context.tenantId,
    updatedAt: fieldValue.serverTimestamp(),
    uploadedByDeviceId: activeDevice.deviceId,
    uploadedByUid: decodedToken.uid
  });

  const uploadUrl = await getSignedStorageUrl(storagePath, 'write', {
    contentType: 'application/octet-stream',
    expiresAtMs: Date.now() + CHAT_MEDIA_SIGNED_URL_TTL_MS
  });

  return {
    expiresAt: new Date(Date.now() + CHAT_MEDIA_SIGNED_URL_TTL_MS).toISOString(),
    maxEncryptedSizeBytes,
    mediaId,
    uploadUrl
  };
}

export async function markEncryptedChatMediaUploaded(
  decodedToken: DecodedIdToken,
  contactId: string,
  mediaId: string,
  chatType: ChatMediaScope = 'DIRECT'
): Promise<{ mediaId: string; status: 'AVAILABLE' }> {
  const { mediaRef, record } = await getAuthorizedMediaRecord(decodedToken, contactId, mediaId, chatType);

  if (record.uploadedByUid !== decodedToken.uid) {
    throw authorizationError('This media upload is not available.');
  }

  if (!record.storagePath) {
    throw notFoundError('Media was not found.');
  }

  const [exists] = await storageBucket.file(record.storagePath).exists();

  if (!exists) {
    throw validationError('Encrypted media upload has not finished yet.');
  }

  const update: {
    expiresAtMs?: null;
    retentionPolicy?: 'DURABLE_GROUP_HISTORY';
    status: 'AVAILABLE';
    updatedAt: FirebaseFirestore.FieldValue;
    uploadedAt: FirebaseFirestore.FieldValue;
  } = {
    status: 'AVAILABLE',
    updatedAt: fieldValue.serverTimestamp(),
    uploadedAt: fieldValue.serverTimestamp()
  };

  if (chatType === 'GROUP') {
    update.expiresAtMs = null;
    update.retentionPolicy = 'DURABLE_GROUP_HISTORY';
  }

  await mediaRef.set(update, { merge: true });

  return {
    mediaId,
    status: 'AVAILABLE'
  };
}

export async function createEncryptedChatMediaDownloadSession(
  decodedToken: DecodedIdToken,
  contactId: string,
  mediaId: string,
  chatType: ChatMediaScope = 'DIRECT'
): Promise<EncryptedChatMediaDownloadSession> {
  const { record } = await getAuthorizedMediaRecord(decodedToken, contactId, mediaId, chatType);

  if (record.status !== 'AVAILABLE' || !record.storagePath) {
    throw notFoundError('Media was not found.');
  }

  const expiresAtMs = Date.now() + CHAT_MEDIA_SIGNED_URL_TTL_MS;
  const downloadUrl = await getSignedStorageUrl(record.storagePath, 'read', { expiresAtMs });

  return {
    contentType: record.contentType || 'application/octet-stream',
    downloadUrl,
    encryptedSizeBytes: record.encryptedSizeBytes || 0,
    expiresAt: new Date(expiresAtMs).toISOString(),
    fileName: record.fileName || 'attachment',
    kind: record.kind || 'file',
    mediaId
  };
}

async function getAuthorizedMediaRecord(
  decodedToken: DecodedIdToken,
  contactId: string,
  mediaId: string,
  chatType: ChatMediaScope
) {
  const context = await getChatMediaContext(decodedToken, contactId, chatType);
  const safeMediaId = mediaId.trim();

  if (!/^media_[A-Za-z0-9_-]{12,80}$/.test(safeMediaId)) {
    throw notFoundError('Media was not found.');
  }

  const mediaRef = context.chatRef.collection('mediaAttachments').doc(safeMediaId);
  const mediaSnapshot = await mediaRef.get();

  if (!mediaSnapshot.exists) {
    throw notFoundError('Media was not found.');
  }

  const record = mediaSnapshot.data() as ChatMediaRecord;
  const expiresAtMs = typeof record.expiresAtMs === 'number' ? record.expiresAtMs : null;
  const isExpired = expiresAtMs !== null && expiresAtMs <= Date.now();
  const isMissingRequiredExpiry = context.chatType === 'DIRECT' && expiresAtMs === null;

  if (
    record.tenantId !== context.tenantId ||
    record.chatId !== context.chatId ||
    (record.chatType || 'DIRECT') !== context.chatType ||
    !Array.isArray(record.participantIds) ||
    !record.participantIds.includes(decodedToken.uid) ||
    isMissingRequiredExpiry ||
    isExpired
  ) {
    throw notFoundError('Media was not found.');
  }

  return {
    mediaRef,
    record
  };
}

async function getChatMediaContext(
  decodedToken: DecodedIdToken,
  contactId: string,
  chatType: ChatMediaScope
): Promise<ChatMediaContext> {
  if (chatType === 'GROUP') {
    const context = await getGroupChatMediaContext(decodedToken, contactId);

    return {
      chatId: context.chatId,
      chatRef: context.chatRef,
      chatType: 'GROUP',
      participantIds: context.memberIds,
      tenantId: context.tenantId
    };
  }

  const context = await getEncryptedDirectContext(decodedToken, contactId);

  return {
    chatId: context.chatId,
    chatRef: context.chatRef,
    chatType: 'DIRECT',
    participantIds: [decodedToken.uid, context.contactId].sort(),
    tenantId: context.tenantId
  };
}

async function getSignedStorageUrl(
  storagePath: string,
  action: 'read' | 'write',
  options: {
    contentType?: string;
    expiresAtMs: number;
  }
): Promise<string> {
  try {
    const [url] = await storageBucket.file(storagePath).getSignedUrl({
      action,
      contentType: options.contentType,
      expires: options.expiresAtMs,
      version: 'v4'
    });

    return url;
  } catch (error) {
    if (isMissingStorageBucketError(error)) {
      throw validationError('Encrypted media storage is not ready yet. Please try again later.');
    }

    throw error;
  }
}

function normalizeContentType(contentType: string, kind: ChatMediaKind): string {
  const safeContentType = contentType.trim().toLowerCase();

  if (kind === 'image' && /^image\/(jpeg|jpg|png|webp)$/.test(safeContentType)) {
    return safeContentType === 'image/jpg' ? 'image/jpeg' : safeContentType;
  }

  if (kind === 'video' && /^video\/[a-z0-9.+-]+$/.test(safeContentType)) {
    return safeContentType;
  }

  if (kind === 'audio' && /^audio\/[a-z0-9.+-]+$/.test(safeContentType)) {
    return safeContentType;
  }

  if (kind === 'file' && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(safeContentType)) {
    return safeContentType;
  }

  if (kind === 'file') {
    return 'application/octet-stream';
  }

  throw validationError('Media type is not supported.');
}

function sanitizeFileName(fileName: string, kind: ChatMediaKind): string {
  const fallbackName = kind === 'image'
    ? 'photo.jpg'
    : kind === 'video'
      ? 'video.mp4'
      : kind === 'audio'
        ? 'voice-note.m4a'
        : 'attachment';
  const safeName = fileName
    .trim()
    .replace(/[^\w .()+-]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 120);

  return safeName || fallbackName;
}

function getMediaTooLargeMessage(kind: ChatMediaKind): string {
  if (kind === 'image') {
    return 'Photo is too large after compression.';
  }

  if (kind === 'video') {
    return 'Video is too large after compression.';
  }

  if (kind === 'audio') {
    return 'Voice note is too large to send.';
  }

  return 'File is too large to send.';
}

function isMissingStorageBucketError(error: unknown): boolean {
  return error instanceof Error &&
    /bucket|storage|does not exist|could not load the default credentials/i.test(error.message);
}

function authorizationError(message: string): Error {
  const error = new Error(message);
  error.name = 'AuthorizationError';
  return error;
}

function notFoundError(message: string): Error {
  const error = new Error(message);
  error.name = 'NotFoundError';
  return error;
}

function validationError(message: string): Error {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
}
