import AsyncStorage from '@react-native-async-storage/async-storage';
import { fromByteArray, toByteArray } from 'base64-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import nacl from 'tweetnacl';
import type { ChatContact, ChatMediaAttachment, ChatMessage } from './chatApi';

interface EncryptedPayload {
  ciphertext: string;
  nonce: string;
  version: 1;
}

interface LocalChatScope {
  ownerUid: string;
  tenantId: string;
}

interface SqliteConversationRow {
  contact_id: string;
  contact_payload: string | null;
  hidden_payload: string | null;
  updated_at: string;
}

interface SqliteMessageRow {
  payload: string;
}

export interface LocalConversationRecord {
  contact: ChatContact | null;
  contactId: string;
  hiddenMessageIds?: string[];
  messages: ChatMessage[];
  ownerUid: string;
  tenantId: string;
  updatedAt: string;
  version: 1;
}

export interface LocalChatContactListRecord {
  confirmedAt?: string;
  contacts: ChatContact[];
  ownerUid: string;
  tenantId: string;
  updatedAt: string;
  version: 1;
}

export interface PendingChatMessage {
  attempts: number;
  chatType?: 'DIRECT' | 'GROUP';
  contactId: string;
  createdAt: string;
  lastError: string | null;
  message: ChatMessage;
  ownerUid: string;
  queueId: string;
  status: 'failed' | 'pending' | 'sending';
  tenantId: string;
  text: string;
  version: 1;
}

const LOCAL_CHAT_KEY_STORAGE_KEY = 'synzapp.localChatKey.v1';
const LOCAL_CACHED_CHAT_CONTACT_LIMIT = 500;
const LOCAL_CACHED_MESSAGE_LIMIT = 1000;
const LOCAL_HIDDEN_MESSAGE_LIMIT = 5000;
const LOCAL_SQLITE_DATABASE_NAME = 'synzapp-local-chat-v1.db';
const localChatSecureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: 'synzapp.local.chat.v1'
};
let sqliteDatabasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function loadCachedChatContacts(input: {
  ownerUid: string;
  tenantId: string;
}): Promise<ChatContact[]> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return [];
  }

  const encryptedValue = await AsyncStorage.getItem(getChatContactsStorageKey(scope));

  if (!encryptedValue) {
    return [];
  }

  const record = await decryptJson<LocalChatContactListRecord>(encryptedValue);

  if (!isMatchingLocalChatRecord(record, scope)) {
    return [];
  }

  return normalizeCachedChatContacts(record.contacts).filter((contact) =>
    record.confirmedAt || (contact.chatType || 'DIRECT') !== 'GROUP'
  );
}

export async function saveCachedChatContacts(input: {
  contacts: ChatContact[];
  ownerUid: string;
  tenantId: string;
}): Promise<void> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return;
  }

  const contacts = normalizeCachedChatContacts(input.contacts);

  const record: LocalChatContactListRecord = {
    confirmedAt: new Date().toISOString(),
    contacts: contacts.slice(0, LOCAL_CACHED_CHAT_CONTACT_LIMIT),
    ownerUid: scope.ownerUid,
    tenantId: scope.tenantId,
    updatedAt: new Date().toISOString(),
    version: 1
  };

  await AsyncStorage.setItem(
    getChatContactsStorageKey(scope),
    await encryptJson(record)
  );
}

export async function loadCachedChatConversation(input: {
  contactId: string;
  ownerUid: string;
  tenantId: string;
}): Promise<LocalConversationRecord | null> {
  const sqliteRecord = await loadRawCachedChatConversationFromSqlite(input).catch(() => null);
  const record = sqliteRecord || await loadRawCachedChatConversation(input);

  return record ? filterHiddenMessagesInRecord(record) : null;
}

export async function saveCachedChatConversation(input: {
  contact: ChatContact | null;
  contactId: string;
  hiddenMessageIds?: string[];
  messages: ChatMessage[];
  ownerUid: string;
  tenantId: string;
}): Promise<void> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return;
  }

  const didSaveToSqlite = await saveCachedChatConversationToSqlite({
    ...input,
    ownerUid: scope.ownerUid,
    tenantId: scope.tenantId
  }).catch(() => false);

  if (didSaveToSqlite) {
    return;
  }

  const existingRecord = await loadRawCachedChatConversation({
    contactId: input.contactId,
    ownerUid: scope.ownerUid,
    tenantId: scope.tenantId
  });
  const hiddenMessageIds = normalizeHiddenMessageIds([
    ...(existingRecord?.hiddenMessageIds || []),
    ...(input.hiddenMessageIds || [])
  ]);
  const hiddenMessageIdSet = new Set(hiddenMessageIds);
  const record: LocalConversationRecord = {
    contact: input.contact,
    contactId: input.contactId,
    hiddenMessageIds,
    messages: uniqueMessages(input.messages)
      .filter((message) => !hiddenMessageIdSet.has(message.messageId))
      .slice(-LOCAL_CACHED_MESSAGE_LIMIT),
    ownerUid: scope.ownerUid,
    tenantId: scope.tenantId,
    updatedAt: new Date().toISOString(),
    version: 1
  };

  await AsyncStorage.setItem(
    getConversationStorageKey(scope, input.contactId),
    await encryptJson(record)
  );
}

export async function updateCachedChatMessageMedia(input: {
  contactId: string;
  media: ChatMediaAttachment;
  mediaIndex?: number;
  messageId: string;
  ownerUid: string;
  tenantId: string;
}): Promise<boolean> {
  const scope = normalizeLocalChatScope(input);

  if (!scope || !input.messageId) {
    return false;
  }

  const db = await getLocalChatSqliteDatabase();
  const row = await db.getFirstAsync<SqliteMessageRow>(
    `SELECT payload
     FROM local_messages
     WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ? AND message_id = ?
     LIMIT 1`,
    [scope.ownerUid, scope.tenantId, input.contactId, input.messageId]
  );

  if (!row?.payload) {
    return false;
  }

  const existingMessage = await decryptJson<ChatMessage>(row.payload).catch(() => null);

  if (!existingMessage?.messageId) {
    return false;
  }

  const nextMessage = applyCachedMediaUpdateToMessage(existingMessage, input.media, input.mediaIndex);
  const nowIso = new Date().toISOString();
  const payload = await encryptJson(nextMessage);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE local_messages
       SET sent_at_ms = ?, sender_uid = ?, is_mine = ?, delivery_status = ?, payload = ?, updated_at = ?
       WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ? AND message_id = ?`,
      [
        getMessageSentAtMs(nextMessage),
        nextMessage.senderUid,
        nextMessage.isMine ? 1 : 0,
        nextMessage.deliveryStatus || null,
        payload,
        nowIso,
        scope.ownerUid,
        scope.tenantId,
        input.contactId,
        input.messageId
      ]
    );

    await db.runAsync(
      `UPDATE local_conversations
       SET updated_at = ?
       WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?`,
      [nowIso, scope.ownerUid, scope.tenantId, input.contactId]
    );
  });

  return true;
}

export async function listCachedChatConversations(input: {
  ownerUid: string;
  tenantId: string;
}): Promise<LocalConversationRecord[]> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return [];
  }

  const sqliteRecords = await listCachedChatConversationsFromSqlite(scope).catch(() => []);

  if (sqliteRecords.length) {
    return sqliteRecords;
  }

  const keys = await AsyncStorage.getAllKeys();
  const conversationKeyPrefix = getConversationStorageKeyPrefix(scope);
  const conversationRecords = await Promise.all(
    keys
      .filter((key) => key.startsWith(conversationKeyPrefix))
      .map(async (key) => {
        const encryptedValue = await AsyncStorage.getItem(key);

        if (!encryptedValue) {
          return null;
        }

        const record = await decryptJson<LocalConversationRecord>(encryptedValue);

        if (!isMatchingLocalChatRecord(record, scope) || !record.contactId) {
          return null;
        }

        return filterHiddenMessagesInRecord(normalizeCachedConversationRecord(record));
      })
  );

  return conversationRecords
    .filter((record): record is LocalConversationRecord => Boolean(record))
    .sort((first, second) => first.contactId.localeCompare(second.contactId));
}

export async function restoreCachedChatConversations(input: {
  conversations: LocalConversationRecord[];
  ownerUid: string;
  tenantId: string;
}): Promise<{ conversationCount: number; messageCount: number }> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return {
      conversationCount: 0,
      messageCount: 0
    };
  }

  const safeConversations = input.conversations.filter((conversation) =>
    conversation.version === 1 &&
    isMatchingLocalChatRecord(conversation, scope) &&
    Boolean(conversation.contactId)
  );
  let messageCount = 0;

  await Promise.all(safeConversations.map(async (conversation) => {
    const messages = uniqueMessages(conversation.messages || []).slice(-LOCAL_CACHED_MESSAGE_LIMIT);

    messageCount += messages.length;
    await saveCachedChatConversation({
      contact: conversation.contact,
      contactId: conversation.contactId,
      hiddenMessageIds: conversation.hiddenMessageIds,
      messages,
      ownerUid: scope.ownerUid,
      tenantId: scope.tenantId
    });
  }));

  return {
    conversationCount: safeConversations.length,
    messageCount
  };
}

export async function clearLocalChatDataForOwner(input: {
  ownerUid: string;
  tenantId?: string;
}): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const safeOwnerUid = sanitizeStorageKey(input.ownerUid);
  const ownerPrefixes = [
    `synzapp.localChat.v1.${safeOwnerUid}.`,
    `synzapp.localChat.v2.${safeOwnerUid}.`,
    `synzapp.localChatContacts.v1.${safeOwnerUid}`,
    `synzapp.localChatContacts.v2.${safeOwnerUid}.`,
    `synzapp.localOutbox.v1.${safeOwnerUid}`,
    `synzapp.localOutbox.v2.${safeOwnerUid}.`
  ];
  const matchingKeys = keys.filter((key) =>
    ownerPrefixes.some((prefix) => key === prefix || key.startsWith(prefix))
  );

  if (matchingKeys.length) {
    await AsyncStorage.multiRemove(matchingKeys);
  }

  await clearSqliteChatDataForOwner(input).catch(() => undefined);
}

export async function loadHiddenChatMessageIds(input: {
  contactId: string;
  ownerUid: string;
  tenantId: string;
}): Promise<string[]> {
  const record = await loadRawCachedChatConversationFromSqlite(input).catch(() => null) ||
    await loadRawCachedChatConversation(input);

  return record?.hiddenMessageIds || [];
}

export async function hideCachedChatMessagesForMe(input: {
  contactId: string;
  messageIds: string[];
  ownerUid: string;
  tenantId: string;
}): Promise<LocalConversationRecord | null> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return null;
  }

  const existingRecord = await loadRawCachedChatConversationFromSqlite({
    contactId: input.contactId,
    ownerUid: scope.ownerUid,
    tenantId: scope.tenantId
  }).catch(() => null) || await loadRawCachedChatConversation({
    contactId: input.contactId,
    ownerUid: scope.ownerUid,
    tenantId: scope.tenantId
  });
  const hiddenMessageIds = normalizeHiddenMessageIds([
    ...(existingRecord?.hiddenMessageIds || []),
    ...input.messageIds
  ]);
  const hiddenMessageIdSet = new Set(hiddenMessageIds);
  const nextRecord: LocalConversationRecord = {
    contact: existingRecord?.contact || null,
    contactId: input.contactId,
    hiddenMessageIds,
    messages: uniqueMessages(existingRecord?.messages || [])
      .filter((message) => !hiddenMessageIdSet.has(message.messageId))
      .slice(-LOCAL_CACHED_MESSAGE_LIMIT),
    ownerUid: scope.ownerUid,
    tenantId: scope.tenantId,
    updatedAt: new Date().toISOString(),
    version: 1
  };

  const didSaveToSqlite = await saveCachedChatConversationToSqlite(nextRecord).catch(() => false);

  if (!didSaveToSqlite) {
    await AsyncStorage.setItem(
      getConversationStorageKey(scope, input.contactId),
      await encryptJson(nextRecord)
    );
  }

  return filterHiddenMessagesInRecord(nextRecord);
}

export async function listPendingChatMessages(input: {
  contactId?: string;
  ownerUid: string;
  tenantId: string;
}): Promise<PendingChatMessage[]> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return [];
  }

  const encryptedValue = await AsyncStorage.getItem(getOutboxStorageKey(scope));

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
      message.ownerUid === scope.ownerUid &&
      message.tenantId === scope.tenantId &&
      (!input.contactId || message.contactId === input.contactId)
    )
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt));
}

export async function enqueuePendingChatMessage(input: {
  chatType?: 'DIRECT' | 'GROUP';
  contactId: string;
  image?: ChatMessage['image'];
  media?: ChatMessage['media'];
  mediaItems?: ChatMessage['mediaItems'];
  ownerUid: string;
  tenantId: string;
  replyTo?: ChatMessage['replyTo'];
  senderUid: string;
  text?: string;
}): Promise<PendingChatMessage> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    throw new Error('A company session is required before sending messages.');
  }

  const createdAt = new Date().toISOString();
  const queueId = `queued_${Date.now()}_${randomHex(6)}`;
  const text = input.text || '';
  const mediaItems = Array.isArray(input.mediaItems) ? input.mediaItems.slice(0, 10) : [];
  const media = input.media || input.image || null;
  const pendingMessage: PendingChatMessage = {
    attempts: 0,
    chatType: input.chatType === 'GROUP' ? 'GROUP' : 'DIRECT',
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
    ownerUid: scope.ownerUid,
    queueId,
    status: 'pending',
    tenantId: scope.tenantId,
    text,
    version: 1
  };
  const currentMessages = await listPendingChatMessages(scope);

  await savePendingChatMessages(scope, [...currentMessages, pendingMessage]);

  return pendingMessage;
}

export async function removePendingChatMessage(input: {
  ownerUid: string;
  tenantId: string;
  queueId: string;
}): Promise<void> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return;
  }

  const currentMessages = await listPendingChatMessages(scope);

  await savePendingChatMessages(
    scope,
    currentMessages.filter((message) => message.queueId !== input.queueId)
  );
}

export async function updatePendingChatMessage(input: {
  lastError?: string | null;
  ownerUid: string;
  queueId: string;
  status: PendingChatMessage['status'];
  tenantId: string;
}): Promise<PendingChatMessage | null> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return null;
  }

  const currentMessages = await listPendingChatMessages(scope);
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

  await savePendingChatMessages(scope, nextMessages);

  return updatedMessage;
}

async function savePendingChatMessages(scope: LocalChatScope, messages: PendingChatMessage[]): Promise<void> {
  const safeMessages = messages
    .filter((message) => message.ownerUid === scope.ownerUid && message.tenantId === scope.tenantId)
    .slice(-200);

  await AsyncStorage.setItem(
    getOutboxStorageKey(scope),
    await encryptJson(safeMessages)
  );
}

async function loadRawCachedChatConversationFromSqlite(input: {
  contactId: string;
  ownerUid: string;
  tenantId: string;
}): Promise<LocalConversationRecord | null> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return null;
  }

  const db = await getLocalChatSqliteDatabase();
  const conversation = await db.getFirstAsync<SqliteConversationRow>(
    `SELECT contact_id, contact_payload, hidden_payload, updated_at
     FROM local_conversations
     WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?
     LIMIT 1`,
    [scope.ownerUid, scope.tenantId, input.contactId]
  );

  if (!conversation) {
    return null;
  }

  const rows = await db.getAllAsync<SqliteMessageRow>(
    `SELECT payload
     FROM local_messages
     WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?
     ORDER BY sent_at_ms ASC, message_id ASC
     LIMIT ?`,
    [scope.ownerUid, scope.tenantId, input.contactId, LOCAL_CACHED_MESSAGE_LIMIT]
  );
  const [contact, hiddenMessageIds, messages] = await Promise.all([
    conversation.contact_payload
      ? decryptJson<ChatContact>(conversation.contact_payload).catch(() => null)
      : null,
    conversation.hidden_payload
      ? decryptJson<string[]>(conversation.hidden_payload).catch(() => [])
      : [],
    Promise.all(rows.map((row) => decryptJson<ChatMessage>(row.payload).catch(() => null)))
  ]);

  return normalizeCachedConversationRecord({
    contact,
    contactId: conversation.contact_id,
    hiddenMessageIds: Array.isArray(hiddenMessageIds) ? hiddenMessageIds : [],
    messages: messages.filter((message): message is ChatMessage => Boolean(message)),
    ownerUid: scope.ownerUid,
    tenantId: scope.tenantId,
    updatedAt: conversation.updated_at,
    version: 1
  });
}

async function saveCachedChatConversationToSqlite(input: {
  contact: ChatContact | null;
  contactId: string;
  hiddenMessageIds?: string[];
  messages: ChatMessage[];
  ownerUid: string;
  tenantId: string;
}): Promise<boolean> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return false;
  }

  const existingRecord = await loadRawCachedChatConversationFromSqlite({
    contactId: input.contactId,
    ownerUid: scope.ownerUid,
    tenantId: scope.tenantId
  }).catch(() => null);
  const hiddenMessageIds = normalizeHiddenMessageIds([
    ...(existingRecord?.hiddenMessageIds || []),
    ...(input.hiddenMessageIds || [])
  ]);
  const hiddenMessageIdSet = new Set(hiddenMessageIds);
  const messages = uniqueMessages(input.messages)
    .filter((message) => !hiddenMessageIdSet.has(message.messageId))
    .slice(-LOCAL_CACHED_MESSAGE_LIMIT);
  const db = await getLocalChatSqliteDatabase();
  const nowIso = new Date().toISOString();
  const contactPayload = input.contact ? await encryptJson(input.contact) : null;
  const hiddenPayload = await encryptJson(hiddenMessageIds);
  const messageIds = messages.map((message) => message.messageId).filter(Boolean);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO local_conversations (
        owner_uid, tenant_id, contact_id, contact_payload, hidden_payload, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner_uid, tenant_id, contact_id)
      DO UPDATE SET
        contact_payload = excluded.contact_payload,
        hidden_payload = excluded.hidden_payload,
        updated_at = excluded.updated_at`,
      [scope.ownerUid, scope.tenantId, input.contactId, contactPayload, hiddenPayload, nowIso]
    );

    if (messageIds.length) {
      const placeholders = messageIds.map(() => '?').join(', ');

      await db.runAsync(
        `DELETE FROM local_messages
         WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?
           AND message_id NOT IN (${placeholders})`,
        [scope.ownerUid, scope.tenantId, input.contactId, ...messageIds]
      );
    } else {
      await db.runAsync(
        `DELETE FROM local_messages
         WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?`,
        [scope.ownerUid, scope.tenantId, input.contactId]
      );
    }

    for (const message of messages) {
      const payload = await encryptJson(message);

      await db.runAsync(
        `INSERT INTO local_messages (
          owner_uid, tenant_id, contact_id, message_id, sent_at_ms,
          sender_uid, is_mine, delivery_status, payload, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(owner_uid, tenant_id, contact_id, message_id)
        DO UPDATE SET
          sent_at_ms = excluded.sent_at_ms,
          sender_uid = excluded.sender_uid,
          is_mine = excluded.is_mine,
          delivery_status = excluded.delivery_status,
          payload = excluded.payload,
          updated_at = excluded.updated_at`,
        [
          scope.ownerUid,
          scope.tenantId,
          input.contactId,
          message.messageId,
          getMessageSentAtMs(message),
          message.senderUid,
          message.isMine ? 1 : 0,
          message.deliveryStatus || null,
          payload,
          nowIso
        ]
      );
    }

    await db.runAsync(
      `DELETE FROM local_messages
       WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?
         AND message_id NOT IN (
           SELECT message_id FROM local_messages
           WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?
           ORDER BY sent_at_ms DESC, message_id DESC
           LIMIT ?
         )`,
      [
        scope.ownerUid,
        scope.tenantId,
        input.contactId,
        scope.ownerUid,
        scope.tenantId,
        input.contactId,
        LOCAL_CACHED_MESSAGE_LIMIT
      ]
    );
  });

  return true;
}

async function listCachedChatConversationsFromSqlite(
  scope: LocalChatScope
): Promise<LocalConversationRecord[]> {
  const db = await getLocalChatSqliteDatabase();
  const rows = await db.getAllAsync<Pick<SqliteConversationRow, 'contact_id'>>(
    `SELECT contact_id
     FROM local_conversations
     WHERE owner_uid = ? AND tenant_id = ?
     ORDER BY updated_at DESC
     LIMIT ?`,
    [scope.ownerUid, scope.tenantId, LOCAL_CACHED_CHAT_CONTACT_LIMIT]
  );
  const records = await Promise.all(rows.map((row) =>
    loadRawCachedChatConversationFromSqlite({
      contactId: row.contact_id,
      ownerUid: scope.ownerUid,
      tenantId: scope.tenantId
    }).catch(() => null)
  ));

  return records
    .filter((record): record is LocalConversationRecord => Boolean(record))
    .map(filterHiddenMessagesInRecord)
    .sort((first, second) => first.contactId.localeCompare(second.contactId));
}

async function clearSqliteChatDataForOwner(input: {
  ownerUid: string;
  tenantId?: string;
}): Promise<void> {
  const ownerUid = typeof input.ownerUid === 'string' ? input.ownerUid.trim() : '';

  if (!ownerUid) {
    return;
  }

  const db = await getLocalChatSqliteDatabase();
  const tenantId = typeof input.tenantId === 'string' ? input.tenantId.trim() : '';

  if (tenantId) {
    await Promise.all([
      db.runAsync(
        'DELETE FROM local_messages WHERE owner_uid = ? AND tenant_id = ?',
        [ownerUid, tenantId]
      ),
      db.runAsync(
        'DELETE FROM local_conversations WHERE owner_uid = ? AND tenant_id = ?',
        [ownerUid, tenantId]
      )
    ]);
    return;
  }

  await Promise.all([
    db.runAsync('DELETE FROM local_messages WHERE owner_uid = ?', [ownerUid]),
    db.runAsync('DELETE FROM local_conversations WHERE owner_uid = ?', [ownerUid])
  ]);
}

async function getLocalChatSqliteDatabase(): Promise<SQLite.SQLiteDatabase> {
  sqliteDatabasePromise ??= (async () => {
    const db = await SQLite.openDatabaseAsync(LOCAL_SQLITE_DATABASE_NAME);

    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS local_conversations (
        owner_uid TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        contact_id TEXT NOT NULL,
        contact_payload TEXT,
        hidden_payload TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (owner_uid, tenant_id, contact_id)
      );
      CREATE TABLE IF NOT EXISTS local_messages (
        owner_uid TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        contact_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        sent_at_ms INTEGER NOT NULL,
        sender_uid TEXT NOT NULL,
        is_mine INTEGER NOT NULL,
        delivery_status TEXT,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (owner_uid, tenant_id, contact_id, message_id)
      );
      CREATE INDEX IF NOT EXISTS idx_local_messages_thread_time
        ON local_messages(owner_uid, tenant_id, contact_id, sent_at_ms);
      CREATE INDEX IF NOT EXISTS idx_local_conversations_owner_time
        ON local_conversations(owner_uid, tenant_id, updated_at);
    `);

    return db;
  })();

  return sqliteDatabasePromise;
}

function getMessageSentAtMs(message: ChatMessage): number {
  const sentAtMs = Date.parse(message.sentAt);

  return Number.isFinite(sentAtMs) ? sentAtMs : Date.now();
}

function getCachedMessageMediaItems(message: ChatMessage): ChatMediaAttachment[] {
  if (Array.isArray(message.mediaItems) && message.mediaItems.length > 0) {
    return message.mediaItems.filter((media): media is ChatMediaAttachment => Boolean(media));
  }

  if (message.media) {
    return [message.media];
  }

  if (message.image) {
    return [message.image];
  }

  return [];
}

function toCachedChatImageAttachment(media: ChatMediaAttachment) {
  return {
    ...media,
    contentType: 'image/jpeg' as const,
    height: media.height || 1,
    kind: 'image' as const,
    width: media.width || 1
  };
}

function applyCachedMediaUpdateToMessage(
  message: ChatMessage,
  media: ChatMediaAttachment,
  mediaIndex?: number
): ChatMessage {
  const currentMediaItems = getCachedMessageMediaItems(message);

  if (typeof mediaIndex === 'number' && currentMediaItems.length > 1) {
    const nextMediaItems = currentMediaItems.map((mediaItem, index) =>
      index === mediaIndex ? media : mediaItem
    );
    const primaryMedia = nextMediaItems[0] || media;

    return {
      ...message,
      image: primaryMedia.kind === 'image' ? toCachedChatImageAttachment(primaryMedia) : null,
      media: primaryMedia,
      mediaItems: nextMediaItems
    };
  }

  return {
    ...message,
    image: media.kind === 'image' ? toCachedChatImageAttachment(media) : null,
    media,
    mediaItems: currentMediaItems.length > 1 ? currentMediaItems : []
  };
}

async function loadRawCachedChatConversation(input: {
  contactId: string;
  ownerUid: string;
  tenantId: string;
}): Promise<LocalConversationRecord | null> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return null;
  }

  const encryptedValue = await AsyncStorage.getItem(getConversationStorageKey(scope, input.contactId));

  if (!encryptedValue) {
    return null;
  }

  const record = await decryptJson<LocalConversationRecord>(encryptedValue);

  if (!isMatchingLocalChatRecord(record, scope) || record.contactId !== input.contactId) {
    return null;
  }

  return normalizeCachedConversationRecord(record);
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

function getConversationStorageKey(scope: LocalChatScope, contactId: string): string {
  return `${getConversationStorageKeyPrefix(scope)}${sanitizeStorageKey(contactId)}`;
}

function getConversationStorageKeyPrefix(scope: LocalChatScope): string {
  return `synzapp.localChat.v2.${sanitizeStorageKey(scope.ownerUid)}.${sanitizeStorageKey(scope.tenantId)}.`;
}

function getOutboxStorageKey(scope: LocalChatScope): string {
  return `synzapp.localOutbox.v2.${sanitizeStorageKey(scope.ownerUid)}.${sanitizeStorageKey(scope.tenantId)}`;
}

function getChatContactsStorageKey(scope: LocalChatScope): string {
  return `synzapp.localChatContacts.v2.${sanitizeStorageKey(scope.ownerUid)}.${sanitizeStorageKey(scope.tenantId)}`;
}

function normalizeLocalChatScope(input: {
  ownerUid?: string | null;
  tenantId?: string | null;
}): LocalChatScope | null {
  const ownerUid = typeof input.ownerUid === 'string' ? input.ownerUid.trim() : '';
  const tenantId = typeof input.tenantId === 'string' ? input.tenantId.trim() : '';

  if (!ownerUid || !tenantId) {
    return null;
  }

  return {
    ownerUid,
    tenantId
  };
}

function isMatchingLocalChatRecord(
  record: Partial<LocalConversationRecord | LocalChatContactListRecord> | null | undefined,
  scope: LocalChatScope
): record is LocalConversationRecord & LocalChatContactListRecord {
  return record?.version === 1 &&
    record.ownerUid === scope.ownerUid &&
    record.tenantId === scope.tenantId;
}

function sanitizeStorageKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

function normalizeCachedChatContacts(contacts: ChatContact[] | undefined): ChatContact[] {
  const contactById = new Map<string, ChatContact>();

  (contacts || []).forEach((contact) => {
    if (!contact?.contactId) {
      return;
    }

    const existingContact = contactById.get(contact.contactId);

    contactById.set(contact.contactId, {
      ...(existingContact || {}),
      ...contact
    });
  });

  return [...contactById.values()].slice(0, LOCAL_CACHED_CHAT_CONTACT_LIMIT);
}

function normalizeCachedConversationRecord(record: LocalConversationRecord): LocalConversationRecord {
  return {
    ...record,
    hiddenMessageIds: normalizeHiddenMessageIds(record.hiddenMessageIds),
    messages: uniqueMessages(record.messages || [])
  };
}

function filterHiddenMessagesInRecord(record: LocalConversationRecord): LocalConversationRecord {
  const hiddenMessageIds = normalizeHiddenMessageIds(record.hiddenMessageIds);
  const hiddenMessageIdSet = new Set(hiddenMessageIds);

  return {
    ...record,
    hiddenMessageIds,
    messages: uniqueMessages(record.messages || [])
      .filter((message) => !hiddenMessageIdSet.has(message.messageId))
  };
}

function normalizeHiddenMessageIds(messageIds?: string[]): string[] {
  const seenMessageIds = new Set<string>();
  const hiddenMessageIds: string[] = [];

  (messageIds || []).forEach((messageId) => {
    const safeMessageId = typeof messageId === 'string' ? messageId.trim() : '';

    if (safeMessageId && !seenMessageIds.has(safeMessageId)) {
      seenMessageIds.add(safeMessageId);
      hiddenMessageIds.push(safeMessageId);
    }
  });

  return hiddenMessageIds.slice(-LOCAL_HIDDEN_MESSAGE_LIMIT);
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
