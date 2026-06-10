import { fromByteArray, toByteArray } from 'base64-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';
import { getSynzappApiBaseUrl } from './apiConfig';
import { getRegisteredDeviceHeaders } from './deviceIdentity';
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

const CHAT_BACKUP_RECOVERY_KEY_STORAGE_KEY = 'synzapp.chatBackupRecoveryKey.v1';
const chatBackupSecureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: 'synzapp.chat.backup.v1'
};

export async function createEncryptedChatBackup(input: {
  idToken: string;
  ownerUid: string;
  tenantId: string;
}): Promise<EncryptedChatBackupResult> {
  const recoveryKeyResult = await getOrCreateChatBackupRecoveryKey();
  const conversations = await listCachedChatConversations({ ownerUid: input.ownerUid });
  const backupCreatedAt = new Date().toISOString();
  const plaintext: ChatBackupPlaintext = {
    backupCreatedAt,
    conversations,
    ownerUid: input.ownerUid,
    tenantId: input.tenantId,
    version: 1
  };
  const encryptedPayload = encryptJson(plaintext, recoveryKeyResult.keyBytes);
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
    : await getStoredChatBackupRecoveryKey();

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
    ownerUid: input.ownerUid
  });

  await storeChatBackupRecoveryKey(recoveryKey);

  return {
    backupCreatedAt: backup.backupCreatedAt,
    conversationCount: restored.conversationCount,
    messageCount: restored.messageCount,
    uploadedAt: body.backup.uploadedAt
  };
}

export async function getStoredChatBackupRecoveryKey(): Promise<string | null> {
  const secureStoreAvailable = await SecureStore.isAvailableAsync();

  if (!secureStoreAvailable) {
    throw new Error('Secure device storage is not available.');
  }

  return SecureStore.getItemAsync(
    CHAT_BACKUP_RECOVERY_KEY_STORAGE_KEY,
    chatBackupSecureStoreOptions
  );
}

export async function storeChatBackupRecoveryKey(recoveryKey: string): Promise<void> {
  const normalizedRecoveryKey = normalizeRecoveryKey(recoveryKey);
  decodeRecoveryKey(normalizedRecoveryKey);

  await SecureStore.setItemAsync(
    CHAT_BACKUP_RECOVERY_KEY_STORAGE_KEY,
    normalizedRecoveryKey,
    chatBackupSecureStoreOptions
  );
}

async function getOrCreateChatBackupRecoveryKey(): Promise<{
  created: boolean;
  keyBytes: Uint8Array;
  recoveryKey: string;
}> {
  const existingRecoveryKey = await getStoredChatBackupRecoveryKey();

  if (existingRecoveryKey) {
    return {
      created: false,
      keyBytes: decodeRecoveryKey(existingRecoveryKey),
      recoveryKey: existingRecoveryKey
    };
  }

  const keyBytes = Crypto.getRandomBytes(nacl.secretbox.keyLength);
  const recoveryKey = fromByteArray(keyBytes);

  await storeChatBackupRecoveryKey(recoveryKey);

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

async function getResponseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();

    if (typeof body?.error === 'string') {
      return body.error;
    }
  } catch {
    return 'Unable to sync encrypted chat backup.';
  }

  return 'Unable to sync encrypted chat backup.';
}
