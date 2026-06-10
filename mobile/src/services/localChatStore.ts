import AsyncStorage from '@react-native-async-storage/async-storage';
import { fromByteArray, toByteArray } from 'base64-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';
import type { ChatContact, ChatMessage } from './chatApi';

interface EncryptedPayload {
  ciphertext: string;
  nonce: string;
  version: 1;
}

export interface LocalConversationRecord {
  contact: ChatContact | null;
  contactId: string;
  messages: ChatMessage[];
  ownerUid: string;
  updatedAt: string;
  version: 1;
}

export interface PendingChatMessage {
  attempts: number;
  contactId: string;
  createdAt: string;
  lastError: string | null;
  message: ChatMessage;
  ownerUid: string;
  queueId: string;
  status: 'failed' | 'pending' | 'sending';
  text: string;
  version: 1;
}

const LOCAL_CHAT_KEY_STORAGE_KEY = 'synzapp.localChatKey.v1';
const localChatSecureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: 'synzapp.local.chat.v1'
};

export async function loadCachedChatConversation(input: {
  contactId: string;
  ownerUid: string;
}): Promise<LocalConversationRecord | null> {
  const encryptedValue = await AsyncStorage.getItem(getConversationStorageKey(input.ownerUid, input.contactId));

  if (!encryptedValue) {
    return null;
  }

  const record = await decryptJson<LocalConversationRecord>(encryptedValue);

  if (!record || record.version !== 1 || record.ownerUid !== input.ownerUid || record.contactId !== input.contactId) {
    return null;
  }

  return {
    ...record,
    messages: uniqueMessages(record.messages || [])
  };
}

export async function saveCachedChatConversation(input: {
  contact: ChatContact | null;
  contactId: string;
  messages: ChatMessage[];
  ownerUid: string;
}): Promise<void> {
  const record: LocalConversationRecord = {
    contact: input.contact,
    contactId: input.contactId,
    messages: uniqueMessages(input.messages).slice(-200),
    ownerUid: input.ownerUid,
    updatedAt: new Date().toISOString(),
    version: 1
  };

  await AsyncStorage.setItem(
    getConversationStorageKey(input.ownerUid, input.contactId),
    await encryptJson(record)
  );
}

export async function listCachedChatConversations(input: {
  ownerUid: string;
}): Promise<LocalConversationRecord[]> {
  const keys = await AsyncStorage.getAllKeys();
  const conversationKeyPrefix = getConversationStorageKeyPrefix(input.ownerUid);
  const conversationRecords = await Promise.all(
    keys
      .filter((key) => key.startsWith(conversationKeyPrefix))
      .map(async (key) => {
        const encryptedValue = await AsyncStorage.getItem(key);

        if (!encryptedValue) {
          return null;
        }

        const record = await decryptJson<LocalConversationRecord>(encryptedValue);

        if (!record || record.version !== 1 || record.ownerUid !== input.ownerUid || !record.contactId) {
          return null;
        }

        return {
          ...record,
          messages: uniqueMessages(record.messages || [])
        };
      })
  );

  return conversationRecords
    .filter((record): record is LocalConversationRecord => Boolean(record))
    .sort((first, second) => first.contactId.localeCompare(second.contactId));
}

export async function restoreCachedChatConversations(input: {
  conversations: LocalConversationRecord[];
  ownerUid: string;
}): Promise<{ conversationCount: number; messageCount: number }> {
  const safeConversations = input.conversations.filter((conversation) =>
    conversation.version === 1 &&
    conversation.ownerUid === input.ownerUid &&
    Boolean(conversation.contactId)
  );
  let messageCount = 0;

  await Promise.all(safeConversations.map(async (conversation) => {
    const messages = uniqueMessages(conversation.messages || []).slice(-200);

    messageCount += messages.length;
    await saveCachedChatConversation({
      contact: conversation.contact,
      contactId: conversation.contactId,
      messages,
      ownerUid: input.ownerUid
    });
  }));

  return {
    conversationCount: safeConversations.length,
    messageCount
  };
}

export async function listPendingChatMessages(input: {
  contactId?: string;
  ownerUid: string;
}): Promise<PendingChatMessage[]> {
  const encryptedValue = await AsyncStorage.getItem(getOutboxStorageKey(input.ownerUid));

  if (!encryptedValue) {
    return [];
  }

  const messages = await decryptJson<PendingChatMessage[]>(encryptedValue);

  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((message) =>
      message.version === 1 &&
      message.ownerUid === input.ownerUid &&
      (!input.contactId || message.contactId === input.contactId)
    )
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt));
}

export async function enqueuePendingChatMessage(input: {
  contactId: string;
  image?: ChatMessage['image'];
  media?: ChatMessage['media'];
  mediaItems?: ChatMessage['mediaItems'];
  ownerUid: string;
  replyTo?: ChatMessage['replyTo'];
  senderUid: string;
  text?: string;
}): Promise<PendingChatMessage> {
  const createdAt = new Date().toISOString();
  const queueId = `queued_${Date.now()}_${randomHex(6)}`;
  const text = input.text || '';
  const mediaItems = Array.isArray(input.mediaItems) ? input.mediaItems.slice(0, 10) : [];
  const media = input.media || input.image || null;
  const pendingMessage: PendingChatMessage = {
    attempts: 0,
    contactId: input.contactId,
    createdAt,
    lastError: null,
    message: {
      deliveryStatus: 'queued',
      image: media?.kind === 'image' ? media as ChatMessage['image'] : input.image || null,
      isMine: true,
      media: media || mediaItems[0] || null,
      mediaItems,
      messageId: queueId,
      replyTo: input.replyTo || null,
      senderUid: input.senderUid,
      sentAt: createdAt,
      text
    },
    ownerUid: input.ownerUid,
    queueId,
    status: 'pending',
    text,
    version: 1
  };
  const currentMessages = await listPendingChatMessages({ ownerUid: input.ownerUid });

  await savePendingChatMessages(input.ownerUid, [...currentMessages, pendingMessage]);

  return pendingMessage;
}

export async function removePendingChatMessage(input: {
  ownerUid: string;
  queueId: string;
}): Promise<void> {
  const currentMessages = await listPendingChatMessages({ ownerUid: input.ownerUid });

  await savePendingChatMessages(
    input.ownerUid,
    currentMessages.filter((message) => message.queueId !== input.queueId)
  );
}

export async function updatePendingChatMessage(input: {
  lastError?: string | null;
  ownerUid: string;
  queueId: string;
  status: PendingChatMessage['status'];
}): Promise<PendingChatMessage | null> {
  const currentMessages = await listPendingChatMessages({ ownerUid: input.ownerUid });
  let updatedMessage: PendingChatMessage | null = null;
  const nextMessages = currentMessages.map((message) => {
    if (message.queueId !== input.queueId) {
      return message;
    }

    updatedMessage = {
      ...message,
      attempts: input.status === 'sending' ? message.attempts + 1 : message.attempts,
      lastError: input.lastError === undefined ? message.lastError : input.lastError,
      status: input.status
    };

    return updatedMessage;
  });

  await savePendingChatMessages(input.ownerUid, nextMessages);

  return updatedMessage;
}

async function savePendingChatMessages(ownerUid: string, messages: PendingChatMessage[]): Promise<void> {
  const safeMessages = messages
    .filter((message) => message.ownerUid === ownerUid)
    .slice(-200);

  await AsyncStorage.setItem(
    getOutboxStorageKey(ownerUid),
    await encryptJson(safeMessages)
  );
}

async function encryptJson(value: unknown): Promise<string> {
  const key = await getOrCreateLocalChatKey();
  const nonce = Crypto.getRandomBytes(nacl.secretbox.nonceLength);
  const plaintext = utf8ToBytes(JSON.stringify(value));
  const ciphertext = nacl.secretbox(plaintext, nonce, key);
  const payload: EncryptedPayload = {
    ciphertext: fromByteArray(ciphertext),
    nonce: fromByteArray(nonce),
    version: 1
  };

  return JSON.stringify(payload);
}

async function decryptJson<T>(encryptedValue: string): Promise<T | null> {
  try {
    const payload = JSON.parse(encryptedValue) as Partial<EncryptedPayload>;

    if (payload.version !== 1 || !payload.ciphertext || !payload.nonce) {
      return null;
    }

    const key = await getOrCreateLocalChatKey();
    const plaintext = nacl.secretbox.open(
      toByteArray(payload.ciphertext),
      toByteArray(payload.nonce),
      key
    );

    if (!plaintext) {
      return null;
    }

    return JSON.parse(bytesToUtf8(plaintext)) as T;
  } catch {
    return null;
  }
}

async function getOrCreateLocalChatKey(): Promise<Uint8Array> {
  const secureStoreAvailable = await SecureStore.isAvailableAsync();

  if (!secureStoreAvailable) {
    throw new Error('Secure device storage is not available.');
  }

  const existingKey = await SecureStore.getItemAsync(
    LOCAL_CHAT_KEY_STORAGE_KEY,
    localChatSecureStoreOptions
  );

  if (existingKey) {
    return toByteArray(existingKey);
  }

  const key = Crypto.getRandomBytes(nacl.secretbox.keyLength);

  await SecureStore.setItemAsync(
    LOCAL_CHAT_KEY_STORAGE_KEY,
    fromByteArray(key),
    localChatSecureStoreOptions
  );

  return key;
}

function getConversationStorageKey(ownerUid: string, contactId: string): string {
  return `${getConversationStorageKeyPrefix(ownerUid)}${sanitizeStorageKey(contactId)}`;
}

function getConversationStorageKeyPrefix(ownerUid: string): string {
  return `synzapp.localChat.v1.${sanitizeStorageKey(ownerUid)}.`;
}

function getOutboxStorageKey(ownerUid: string): string {
  return `synzapp.localOutbox.v1.${sanitizeStorageKey(ownerUid)}`;
}

function sanitizeStorageKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

function uniqueMessages(messages: ChatMessage[]): ChatMessage[] {
  const messageById = new Map<string, ChatMessage>();

  messages.forEach((message) => {
    if (message.messageId) {
      const existingMessage = messageById.get(message.messageId);

      messageById.set(message.messageId, {
        ...(existingMessage || {}),
        ...message,
        reactions: Array.isArray(message.reactions)
          ? message.reactions
          : existingMessage?.reactions || message.reactions || []
      });
    }
  });

  return [...messageById.values()].sort((first, second) =>
    first.sentAt.localeCompare(second.sentAt)
  );
}

function randomHex(byteCount: number): string {
  return Array.from(Crypto.getRandomBytes(byteCount))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
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
