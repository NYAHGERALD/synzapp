import { fromByteArray, toByteArray } from 'base64-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';
import { getSynzappApiBaseUrl } from './apiConfig';
import { toPortableChatMediaUri } from './chatMediaPaths';
import type { ChatMessage } from './chatApi';
import { getRegisteredDeviceHeaders } from './deviceIdentity';
import {
  clearScopedRecoveryKey,
  getChatBackupRecoveryKeyStorageKey,
  readScopedRecoveryKey,
  type RecoveryKeyStore
} from './chatBackupRecoveryKeyScope';
import {
  listCachedChatConversations,
  LocalConversationRecord,
  restoreCachedChatConversations
} from './localChatStore';

interface EncryptedPayload {
  ciphertext: string;
  nonce: string;
  version: 1;
}

interface ChatBackupPlaintext {
  backupCreatedAt: string;
  conversations: LocalConversationRecord[];
  ownerUid: string;
  tenantId: string;
  version: 1;
}

export interface EncryptedChatBackupMetadata {
  backupCreatedAt: string;
  backupId: 'latest';
  backupVersion: 1;
  conversationCount: number;
  keyFingerprint: string;
  messageCount: number;
  sizeBytes: number;
  uploadedAt: string;
}

export interface ChatBackupPolicy {
  adminApprovalRequired: boolean;
  encryptedBackupsEnabled: boolean;
  recoveryKeyRequired: boolean;
  selfRestoreEnabled: boolean;
  updatedAt: string | null;
  updatedByUid: string | null;
}

export interface EncryptedChatBackupResult {
  createdRecoveryKey: boolean;
  metadata: EncryptedChatBackupMetadata;
  recoveryKey: string;
}

export interface EncryptedChatRestoreResult {
  backupCreatedAt: string;
  conversationCount: number;
  messageCount: number;
  uploadedAt: string;
}

const chatBackupSecureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: 'synzapp.chat.backup.v1'
};

/** Matches the server's own ceiling, so the failure is explained here. */
const MAX_BACKUP_CIPHERTEXT_LENGTH = 4_500_000;

export async function createEncryptedChatBackup(input: {
  idToken: string;
  ownerUid: string;
  tenantId: string;
}): Promise<EncryptedChatBackupResult> {
  const recoveryKeyResult = await getOrCreateChatBackupRecoveryKey(input.ownerUid);
  const conversations = await listCachedChatConversations({
    ownerUid: input.ownerUid,
    tenantId: input.tenantId
  });
  const backupCreatedAt = new Date().toISOString();
  const plaintext: ChatBackupPlaintext = {
    backupCreatedAt,
    conversations: conversations.map(toPortableConversationRecord),
    ownerUid: input.ownerUid,
    tenantId: input.tenantId,
    version: 1
  };
  const encryptedPayload = encryptJson(plaintext, recoveryKeyResult.keyBytes);

  console.log(
    `[SynzappBackup] built conversations=${conversations.length} ciphertextKb=${Math.round(encryptedPayload.ciphertext.length / 1024)}`
  );

  // Said plainly rather than as a bare upload failure. The server's limit is a
  // fixed 4.5 MB, so a backup that outgrows it will keep failing every time
  // until something is removed, and "unable to sync" gives nobody a way to act.
  if (encryptedPayload.ciphertext.length > MAX_BACKUP_CIPHERTEXT_LENGTH) {
    throw new Error(
      `This chat history is too large to back up (${Math.round(encryptedPayload.ciphertext.length / 1024)} KB of a ${Math.round(MAX_BACKUP_CIPHERTEXT_LENGTH / 1024)} KB limit). Clearing older chats will bring it back under.`
    );
  }
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/profile/chat/backups/latest`, {
    body: JSON.stringify({
      algorithm: 'nacl-secretbox+synzapp-chat-backup-v1',
      backupCreatedAt,
      backupVersion: 1,
      ciphertext: encryptedPayload.ciphertext,
      conversationCount: conversations.length,
      keyFingerprint: getRecoveryKeyFingerprint(recoveryKeyResult.keyBytes),
      messageCount: conversations.reduce((count, conversation) => count + conversation.messages.length, 0),
      nonce: encryptedPayload.nonce
    }),
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${input.idToken}`,
      'Content-Type': 'application/json',
      ...(await getRegisteredDeviceHeaders(input.idToken))
    },
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  const body = await response.json() as { metadata: EncryptedChatBackupMetadata };

  return {
    createdRecoveryKey: recoveryKeyResult.created,
    metadata: body.metadata,
    recoveryKey: recoveryKeyResult.recoveryKey
  };
}

export async function getChatBackupPolicy(idToken: string): Promise<ChatBackupPolicy> {
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/profile/chat/backups/policy`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...(await getRegisteredDeviceHeaders(idToken))
    },
    method: 'GET'
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  const body = await response.json() as { policy: ChatBackupPolicy };

  return body.policy;
}

export async function restoreLatestEncryptedChatBackup(input: {
  idToken: string;
  ownerUid: string;
  recoveryKey?: string;
  tenantId: string;
}): Promise<EncryptedChatRestoreResult | null> {
  const recoveryKey = input.recoveryKey
    ? normalizeRecoveryKey(input.recoveryKey)
    : await getStoredChatBackupRecoveryKey(input.ownerUid);

  if (!recoveryKey) {
    throw new Error('Enter your encrypted backup recovery key to restore chats.');
  }

  const keyBytes = decodeRecoveryKey(recoveryKey);
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/profile/chat/backups/latest`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${input.idToken}`,
      ...(await getRegisteredDeviceHeaders(input.idToken))
    },
    method: 'GET'
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  const body = await response.json() as {
    backup: {
      backupCreatedAt: string;
      backupVersion: 1;
      ciphertext: string;
      keyFingerprint: string;
      nonce: string;
      uploadedAt: string;
    } | null;
  };

  if (!body.backup) {
    return null;
  }

  if (body.backup.keyFingerprint !== getRecoveryKeyFingerprint(keyBytes)) {
    throw new Error('This recovery key does not match the encrypted backup.');
  }

  const backup = decryptJson<ChatBackupPlaintext>({
    ciphertext: body.backup.ciphertext,
    nonce: body.backup.nonce,
    version: 1
  }, keyBytes);

  if (
    !backup ||
    backup.version !== 1 ||
    backup.ownerUid !== input.ownerUid ||
    backup.tenantId !== input.tenantId ||
    !Array.isArray(backup.conversations)
  ) {
    throw new Error('This encrypted backup could not be restored.');
  }

  const restored = await restoreCachedChatConversations({
    conversations: backup.conversations,
    ownerUid: input.ownerUid,
    tenantId: input.tenantId
  });

  await storeChatBackupRecoveryKey(input.ownerUid, recoveryKey);

  return {
    backupCreatedAt: backup.backupCreatedAt,
    conversationCount: restored.conversationCount,
    messageCount: restored.messageCount,
    uploadedAt: body.backup.uploadedAt
  };
}

const recoveryKeyStore: RecoveryKeyStore = {
  read: (storageKey) => SecureStore.getItemAsync(storageKey, chatBackupSecureStoreOptions),
  remove: async (storageKey) => {
    await SecureStore.deleteItemAsync(storageKey, chatBackupSecureStoreOptions)
      .catch(() => undefined);
  },
  write: (storageKey, value) =>
    SecureStore.setItemAsync(storageKey, value, chatBackupSecureStoreOptions)
};

export async function getStoredChatBackupRecoveryKey(ownerUid: string): Promise<string | null> {
  const secureStoreAvailable = await SecureStore.isAvailableAsync();

  if (!secureStoreAvailable) {
    throw new Error('Secure device storage is not available.');
  }

  return readScopedRecoveryKey(recoveryKeyStore, ownerUid);
}

export async function storeChatBackupRecoveryKey(
  ownerUid: string,
  recoveryKey: string
): Promise<void> {
  const normalizedRecoveryKey = normalizeRecoveryKey(recoveryKey);
  decodeRecoveryKey(normalizedRecoveryKey);

  await recoveryKeyStore.write(
    getChatBackupRecoveryKeyStorageKey(ownerUid),
    normalizedRecoveryKey
  );
}

export async function clearStoredChatBackupRecoveryKey(ownerUid: string): Promise<void> {
  const secureStoreAvailable = await SecureStore.isAvailableAsync();

  if (!secureStoreAvailable) {
    return;
  }

  await clearScopedRecoveryKey(recoveryKeyStore, ownerUid);
}

async function getOrCreateChatBackupRecoveryKey(ownerUid: string): Promise<{
  created: boolean;
  keyBytes: Uint8Array;
  recoveryKey: string;
}> {
  const existingRecoveryKey = await getStoredChatBackupRecoveryKey(ownerUid);

  if (existingRecoveryKey) {
    return {
      created: false,
      keyBytes: decodeRecoveryKey(existingRecoveryKey),
      recoveryKey: existingRecoveryKey
    };
  }

  const keyBytes = Crypto.getRandomBytes(nacl.secretbox.keyLength);
  const recoveryKey = fromByteArray(keyBytes);

  await storeChatBackupRecoveryKey(ownerUid, recoveryKey);

  return {
    created: true,
    keyBytes,
    recoveryKey
  };
}

function encryptJson(value: unknown, keyBytes: Uint8Array): EncryptedPayload {
  const nonce = Crypto.getRandomBytes(nacl.secretbox.nonceLength);
  const plaintext = utf8ToBytes(JSON.stringify(value));
  const ciphertext = nacl.secretbox(plaintext, nonce, keyBytes);

  return {
    ciphertext: fromByteArray(ciphertext),
    nonce: fromByteArray(nonce),
    version: 1
  };
}

function decryptJson<T>(payload: EncryptedPayload, keyBytes: Uint8Array): T | null {
  try {
    if (payload.version !== 1 || !payload.ciphertext || !payload.nonce) {
      return null;
    }

    const plaintext = nacl.secretbox.open(
      toByteArray(payload.ciphertext),
      toByteArray(payload.nonce),
      keyBytes
    );

    if (!plaintext) {
      return null;
    }

    return JSON.parse(bytesToUtf8(plaintext)) as T;
  } catch {
    return null;
  }
}

function normalizeRecoveryKey(recoveryKey: string): string {
  return recoveryKey.replace(/\s+/g, '').trim();
}

function decodeRecoveryKey(recoveryKey: string): Uint8Array {
  try {
    const keyBytes = toByteArray(normalizeRecoveryKey(recoveryKey));

    if (keyBytes.length !== nacl.secretbox.keyLength) {
      throw new Error('Invalid recovery key.');
    }

    return keyBytes;
  } catch {
    throw new Error('Invalid recovery key.');
  }
}

function getRecoveryKeyFingerprint(keyBytes: Uint8Array): string {
  return fromByteArray(nacl.hash(keyBytes)).slice(0, 32);
}

function utf8ToBytes(value: string): Uint8Array {
  const encodedValue = encodeURIComponent(value);
  const bytes: number[] = [];

  for (let index = 0; index < encodedValue.length; index += 1) {
    if (encodedValue[index] === '%') {
      bytes.push(Number.parseInt(encodedValue.slice(index + 1, index + 3), 16));
      index += 2;
      continue;
    }

    bytes.push(encodedValue.charCodeAt(index));
  }

  return new Uint8Array(bytes);
}

function bytesToUtf8(bytes: Uint8Array): string {
  const encodedValue = Array.from(bytes)
    .map((byte) => `%${byte.toString(16).padStart(2, '0')}`)
    .join('');

  return decodeURIComponent(encodedValue);
}

/**
 * What actually went wrong, said out loud.
 *
 * This used to answer "Unable to sync encrypted chat backup" to everything,
 * including a rejection that arrived with a perfectly good explanation
 * attached. Three separate size limits sit on this upload — the body parser's,
 * the schema's, and whatever a proxy in front of them thinks — and a generic
 * message makes it impossible to tell which one was hit, so the failure was
 * guessed at rather than read.
 */
async function getResponseErrorMessage(response: Response): Promise<string> {
  const raw = await response.text().catch(() => '');

  try {
    const body = JSON.parse(raw);

    if (typeof body?.error === 'string') {
      console.log(`[SynzappBackup] rejected status=${response.status} reason=${body.error}`);

      return body.error;
    }
  } catch {
    // Not JSON at all, which is itself the clue: something in front of the
    // application refused it before any of our own handlers saw it.
  }

  console.log(
    `[SynzappBackup] rejected status=${response.status} nonJsonBody=${raw.slice(0, 180)}`
  );

  return response.status === 413
    ? 'This chat history is too large to back up.'
    : `The backup was refused (${response.status}).`;
}


/**
 * Strips device-specific media paths out of a backup.
 *
 * A backup is meant to be restorable - onto a reinstalled app, or a different
 * device. An absolute media path is meaningless in both cases: it names a
 * container that no longer exists, or never existed. Recording the portable
 * reference instead means a restore points at wherever media lives on the
 * device doing the restoring.
 */
function toPortableConversationRecord<T extends { messages: ChatMessage[] }>(conversation: T): T {
  return {
    ...conversation,
    messages: conversation.messages.map(toPortableMessageMedia)
  };
}

function toPortableMessageMedia(message: ChatMessage): ChatMessage {
  const media = message.media ? toPortableMediaAttachment(message.media) : message.media;
  const mediaItems = Array.isArray(message.mediaItems)
    ? message.mediaItems.map(toPortableMediaAttachment)
    : message.mediaItems;
  const image = message.image ? toPortableMediaAttachment(message.image) : message.image;

  return {
    ...message,
    image,
    media,
    mediaItems
  } as ChatMessage;
}

/**
 * One attachment as it goes into a backup: a reference, not a picture.
 *
 * The thumbnail is dropped. It is tens of kilobytes of base64 per attachment,
 * it is carried inside the message, and the server refuses a backup whose
 * ciphertext passes 4.5 MB — so a chat that accumulated video quietly grew a
 * backup it could no longer upload. Worse, the automatic backups fail silently,
 * so the first anybody hears of it is when they press the button by hand.
 *
 * What is kept is everything needed to find the media again: its id, its name,
 * its size, and where it sits locally. A restored bubble shows a placeholder
 * until its still is fetched, which is a far smaller loss than a backup that
 * stopped working weeks ago and said nothing.
 */
function toPortableMediaAttachment<T extends { localUri?: string; thumbnailDataUrl?: string }>(
  media: T
): T {
  if (!media) {
    return media;
  }

  const { thumbnailDataUrl, ...withoutThumbnail } = media;

  return {
    ...withoutThumbnail,
    ...(media.localUri ? { localUri: toPortableChatMediaUri(media.localUri) } : {})
  } as T;
}

export type ChatBackupRestoreStatus = 'approved' | 'claimed' | 'denied' | 'pending';

export interface ChatBackupRestoreRequest {
  approvedAtMs: number | null;
  approvedByName: string | null;
  claimedAtMs: number | null;
  deviceId: string;
  deviceName: string | null;
  requestedAtMs: number;
  requestedByName: string;
  requestId: string;
  status: ChatBackupRestoreStatus;
  uid: string;
}

async function backupFetch(path: string, idToken: string, init: RequestInit = {}) {
  const response = await fetch(`${getSynzappApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      ...(await getRegisteredDeviceHeaders(idToken)),
      ...(init.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return response.json();
}

/**
 * Puts this device's backup key into the organization's escrow.
 *
 * Called straight after a backup. Without it the key exists only on this
 * device, so reinstalling the app makes every backup it ever made permanently
 * unreadable — which is what used to happen.
 *
 * A failure here is reported by the caller rather than swallowed: a backup
 * whose key was not escrowed is one nobody will be able to restore, and finding
 * that out at restore time is far too late.
 */
export async function escrowChatBackupKey(input: {
  deviceId: string;
  idToken: string;
  recoveryKey: string;
}): Promise<void> {
  await backupFetch('/api/profile/chat/backups/escrow', input.idToken, {
    body: JSON.stringify({ deviceId: input.deviceId, recoveryKey: input.recoveryKey }),
    method: 'POST'
  });
}

/** Asks an administrator to release this person's backup to this device. */
export async function requestChatBackupRestore(input: {
  deviceId: string;
  deviceName?: string | null;
  idToken: string;
}): Promise<ChatBackupRestoreRequest> {
  const body = await backupFetch('/api/profile/chat/backups/restore-requests', input.idToken, {
    body: JSON.stringify({ deviceId: input.deviceId, deviceName: input.deviceName || null }),
    method: 'POST'
  }) as { request: ChatBackupRestoreRequest };

  return body.request;
}

/**
 * Collects the key once an administrator has approved.
 *
 * Null while nothing has been approved, which is the ordinary case between
 * asking and being answered. The approval is spent by this call, so a second
 * restore needs a second approval.
 */
export async function claimChatBackupRestore(input: {
  deviceId: string;
  idToken: string;
}): Promise<string | null> {
  const body = await backupFetch('/api/profile/chat/backups/restore-requests/claim', input.idToken, {
    body: JSON.stringify({ deviceId: input.deviceId }),
    method: 'POST'
  }) as { recoveryKey: string | null };

  return body.recoveryKey || null;
}
