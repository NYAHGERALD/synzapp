import {
  stripMediaThumbnail,
  stripThumbnailsForPayload
} from './localChatThumbnailSplit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SqliteMediaPreparationQueueRow,
  SqliteMediaRow,
  SqliteMediaTransferQueueRow,
  SqliteMessageRow,
  SqliteSyncStateRow,
  clearSqliteChatDataForOwner,
  getLocalChatSqliteDatabase,
  hasSqlitePendingOutboxRows,
  listCachedChatConversationsFromSqlite,
  listPendingChatMessagesFromSqlite,
  loadCachedChatContactsFromSqlite,
  loadCachedChatConversationPageFromSqlite,
  loadRawCachedChatConversationFromSqlite,
  mapSqliteMediaPreparationQueueRow,
  mapSqliteMediaRow,
  mapSqliteMediaTransferQueueRow,
  migratePendingChatMessagesToSqlite,
  saveCachedChatContactsToSqlite,
  saveCachedChatConversationToSqlite,
  upsertPendingChatMessageToSqlite,
} from './localChatSqlite';
import { fromByteArray, toByteArray } from 'base64-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { planLocalChatRowWrites } from './localChatRowSignatures';
import * as SQLite from 'expo-sqlite';
import nacl from 'tweetnacl';
import type { ChatContact, ChatMediaAttachment, ChatMessage } from './chatApi';
import {
  resolveLocalChatMediaUri,
  toPortableChatMediaUri
} from './chatMediaPaths';

interface EncryptedPayload {
  ciphertext: string;
  nonce: string;
  version: 1;
}

export interface LocalChatScope {
  ownerUid: string;
  tenantId: string;
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

export interface LocalConversationPageRecord extends LocalConversationRecord {
  hasMoreBefore: boolean;
  oldestMessageSentAtMs: number | null;
}

export interface LocalChatSyncState {
  contactId: string;
  hasMoreBefore: boolean;
  latestServerSentAtMs: number | null;
  oldestLocalSentAtMs: number | null;
  ownerUid: string;
  tenantId: string;
  updatedAt: string;
  version: 1;
}

export interface LocalCachedChatMediaRecord {
  contactId: string;
  media: ChatMediaAttachment;
  mediaId: string | null;
  mediaIndex: number;
  messageId: string;
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

export type LocalChatMediaTransferType = 'download' | 'upload';

export interface LocalChatMediaUploadRecoveryState {
  chatType?: 'DIRECT' | 'GROUP';
  expiresAt: string;
  media: ChatMediaAttachment;
  mediaId: string;
  partNativeTransferIds?: string[];
  uploadedPartIndexes?: number[];
  uploadMode?: 'chunked' | 'single';
}

export interface LocalChatMediaTransferQueueItem {
  attempts: number;
  contactId: string;
  lastError: string | null;
  media: ChatMediaAttachment;
  mediaId: string | null;
  mediaIndex: number;
  messageId: string;
  nativeTransferId: string | null;
  nextRetryAtMs: number | null;
  ownerUid: string;
  progress: number;
  queueId: string;
  status: NonNullable<ChatMediaAttachment['transferStatus']>;
  tenantId: string;
  transferType: LocalChatMediaTransferType;
  uploadRecovery: LocalChatMediaUploadRecoveryState | null;
  updatedAt: string;
  version: 1;
}

export interface UpsertLocalChatMediaTransferQueueInput {
  attempts?: number;
  contactId: string;
  lastError?: string | null;
  media: ChatMediaAttachment;
  mediaIndex?: number;
  messageId: string;
  nativeTransferId?: string | null;
  nextRetryAtMs?: number | null;
  ownerUid: string;
  progress?: number;
  queueId?: string;
  status: ChatMediaAttachment['transferStatus'];
  tenantId: string;
  transferType: LocalChatMediaTransferType;
  uploadRecovery?: LocalChatMediaUploadRecoveryState | null;
}

export type LocalChatMediaPreparationStatus = 'cancelled' | 'failed' | 'preparing' | 'queued' | 'ready';

export interface LocalChatMediaPreparationQueueItem {
  assetIdentifier: string;
  attempts: number;
  chatType?: 'DIRECT' | 'GROUP';
  contactId: string;
  lastError: string | null;
  media: ChatMediaAttachment;
  mediaIndex: number;
  messageId: string;
  ownerUid: string;
  preparedMedia: ChatMediaAttachment | null;
  progress: number;
  queueId: string;
  status: LocalChatMediaPreparationStatus;
  tenantId: string;
  updatedAt: string;
  version: 1;
}

export interface UpsertLocalChatMediaPreparationQueueInput {
  assetIdentifier: string;
  attempts?: number;
  chatType?: 'DIRECT' | 'GROUP';
  contactId: string;
  lastError?: string | null;
  media: ChatMediaAttachment;
  mediaIndex?: number;
  messageId: string;
  ownerUid: string;
  preparedMedia?: ChatMediaAttachment | null;
  progress?: number;
  queueId?: string;
  status: LocalChatMediaPreparationStatus;
  tenantId: string;
}

const LOCAL_CHAT_KEY_STORAGE_KEY = 'synzapp.localChatKey.v1';
export const LOCAL_CACHED_CHAT_CONTACT_LIMIT = 500;
export const LOCAL_CACHED_MESSAGE_LIMIT = 1000;
export const LOCAL_CHAT_MESSAGE_PAGE_LIMIT = 60;
const LOCAL_HIDDEN_MESSAGE_LIMIT = 5000;
export const LOCAL_SQLITE_DATABASE_NAME = 'synzapp-local-chat-v1.db';
const localChatSecureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: 'synzapp.local.chat.v1'
};

export async function loadCachedChatContacts(input: {
  ownerUid: string;
  tenantId: string;
}): Promise<ChatContact[]> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return [];
  }

  const sqliteContacts = await loadCachedChatContactsFromSqlite(scope).catch(() => []);

  if (sqliteContacts.length) {
    return sqliteContacts;
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

  await Promise.all([
    saveCachedChatContactsToSqlite(scope, contacts).catch(() => undefined),
    AsyncStorage.setItem(
      getChatContactsStorageKey(scope),
      await encryptJson(record)
    )
  ]);
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

export async function loadCachedChatConversationPage(input: {
  beforeSentAtMs?: number | null;
  contactId: string;
  limit?: number;
  ownerUid: string;
  tenantId: string;
}): Promise<LocalConversationPageRecord | null> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return null;
  }

  const page = await loadCachedChatConversationPageFromSqlite({
    beforeSentAtMs: input.beforeSentAtMs,
    contactId: input.contactId,
    limit: input.limit,
    ownerUid: scope.ownerUid,
    tenantId: scope.tenantId
  }).catch(() => null);

  if (page) {
    return filterHiddenMessagesInPageRecord(page);
  }

  const fallback = await loadCachedChatConversation({
    contactId: input.contactId,
    ownerUid: scope.ownerUid,
    tenantId: scope.tenantId
  });

  if (!fallback) {
    return null;
  }

  const limit = normalizeMessagePageLimit(input.limit);
  const beforeSentAtMs = typeof input.beforeSentAtMs === 'number' && Number.isFinite(input.beforeSentAtMs)
    ? input.beforeSentAtMs
    : null;
  const eligibleMessages = beforeSentAtMs === null
    ? fallback.messages
    : fallback.messages.filter((message) => getMessageSentAtMs(message) < beforeSentAtMs);
  const messages = eligibleMessages.slice(-limit);

  return {
    ...fallback,
    hasMoreBefore: eligibleMessages.length > messages.length,
    messages,
    oldestMessageSentAtMs: messages.length ? getMessageSentAtMs(messages[0]) : null
  };
}

export async function loadLocalChatSyncState(input: {
  contactId: string;
  ownerUid: string;
  tenantId: string;
}): Promise<LocalChatSyncState | null> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return null;
  }

  const db = await getLocalChatSqliteDatabase();
  const row = await db.getFirstAsync<SqliteSyncStateRow>(
    `SELECT latest_server_sent_at_ms, oldest_local_sent_at_ms, has_more_before, updated_at
     FROM local_chat_sync_state
     WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?
     LIMIT 1`,
    [scope.ownerUid, scope.tenantId, input.contactId]
  );

  if (!row) {
    return null;
  }

  return {
    contactId: input.contactId,
    hasMoreBefore: row.has_more_before === 1,
    latestServerSentAtMs: typeof row.latest_server_sent_at_ms === 'number' ? row.latest_server_sent_at_ms : null,
    oldestLocalSentAtMs: typeof row.oldest_local_sent_at_ms === 'number' ? row.oldest_local_sent_at_ms : null,
    ownerUid: scope.ownerUid,
    tenantId: scope.tenantId,
    updatedAt: row.updated_at,
    version: 1
  };
}

export async function saveLocalChatSyncState(input: {
  contactId: string;
  hasMoreBefore?: boolean;
  latestServerSentAtMs?: number | null;
  oldestLocalSentAtMs?: number | null;
  ownerUid: string;
  tenantId: string;
}): Promise<void> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return;
  }

  const db = await getLocalChatSqliteDatabase();
  const existing = await loadLocalChatSyncState({
    contactId: input.contactId,
    ownerUid: scope.ownerUid,
    tenantId: scope.tenantId
  }).catch(() => null);
  const nowIso = new Date().toISOString();
  const latestServerSentAtMs = mergeNullableMax(
    existing?.latestServerSentAtMs ?? null,
    normalizeNullableTimestampMs(input.latestServerSentAtMs)
  );
  const oldestLocalSentAtMs = mergeNullableMin(
    existing?.oldestLocalSentAtMs ?? null,
    normalizeNullableTimestampMs(input.oldestLocalSentAtMs)
  );

  await db.runAsync(
    `INSERT INTO local_chat_sync_state (
      owner_uid, tenant_id, contact_id, latest_server_sent_at_ms,
      oldest_local_sent_at_ms, has_more_before, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_uid, tenant_id, contact_id)
    DO UPDATE SET
      latest_server_sent_at_ms = excluded.latest_server_sent_at_ms,
      oldest_local_sent_at_ms = excluded.oldest_local_sent_at_ms,
      has_more_before = excluded.has_more_before,
      updated_at = excluded.updated_at`,
    [
      scope.ownerUid,
      scope.tenantId,
      input.contactId,
      latestServerSentAtMs,
      oldestLocalSentAtMs,
      input.hasMoreBefore === undefined
        ? existing?.hasMoreBefore === true ? 1 : 0
        : input.hasMoreBefore ? 1 : 0,
      nowIso
    ]
  );
}

export async function listCachedChatMediaForMessages(input: {
  contactId: string;
  messageIds: string[];
  ownerUid: string;
  tenantId: string;
}): Promise<Record<string, LocalCachedChatMediaRecord[]>> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return {};
  }

  const messageIds = normalizeMediaMessageIds(input.messageIds);

  if (!messageIds.length) {
    return {};
  }

  const db = await getLocalChatSqliteDatabase();
  const placeholders = messageIds.map(() => '?').join(', ');
  const rows = await db.getAllAsync<SqliteMediaRow>(
    `SELECT message_id, media_index, media_id, kind, content_type, file_name,
            size_bytes, duration_ms, width, height, thumbnail_local_uri,
            thumbnail_data_url, plain_local_uri, transfer_status,
            transfer_progress, payload, updated_at
     FROM local_chat_media
     WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?
       AND message_id IN (${placeholders})
     ORDER BY message_id ASC, media_index ASC`,
    [scope.ownerUid, scope.tenantId, input.contactId, ...messageIds]
  );
  const records = await Promise.all(rows.map((row) =>
    mapSqliteMediaRow(scope, input.contactId, row)
  ));

  return records
    .filter((record): record is LocalCachedChatMediaRecord => Boolean(record))
    .reduce<Record<string, LocalCachedChatMediaRecord[]>>((recordsByMessageId, record) => {
      recordsByMessageId[record.messageId] = [
        ...(recordsByMessageId[record.messageId] || []),
        record
      ];

      return recordsByMessageId;
    }, {});
}

export async function listCachedChatMediaForContact(input: {
  contactId: string;
  limit?: number;
  ownerUid: string;
  tenantId: string;
  transferStatus?: ChatMediaAttachment['transferStatus'];
}): Promise<LocalCachedChatMediaRecord[]> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return [];
  }

  const db = await getLocalChatSqliteDatabase();
  const limit = Math.max(1, Math.min(Math.round(input.limit || 200), 1000));
  const transferStatus = normalizeMediaTransferStatus(input.transferStatus);
  const rows = transferStatus
    ? await db.getAllAsync<SqliteMediaRow>(
        `SELECT message_id, media_index, media_id, kind, content_type, file_name,
                size_bytes, duration_ms, width, height, thumbnail_local_uri,
                thumbnail_data_url, plain_local_uri, transfer_status,
                transfer_progress, payload, updated_at
         FROM local_chat_media
         WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ? AND transfer_status = ?
         ORDER BY updated_at DESC
         LIMIT ?`,
        [scope.ownerUid, scope.tenantId, input.contactId, transferStatus, limit]
      )
    : await db.getAllAsync<SqliteMediaRow>(
        `SELECT message_id, media_index, media_id, kind, content_type, file_name,
                size_bytes, duration_ms, width, height, thumbnail_local_uri,
                thumbnail_data_url, plain_local_uri, transfer_status,
                transfer_progress, payload, updated_at
         FROM local_chat_media
         WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?
         ORDER BY updated_at DESC
         LIMIT ?`,
        [scope.ownerUid, scope.tenantId, input.contactId, limit]
      );
  const records = await Promise.all(rows.map((row) =>
    mapSqliteMediaRow(scope, input.contactId, row)
  ));

  return records.filter((record): record is LocalCachedChatMediaRecord => Boolean(record));
}

export async function listLocalChatMediaTransferQueue(input: {
  contactId?: string;
  limit?: number;
  ownerUid: string;
  tenantId: string;
  transferType?: LocalChatMediaTransferType;
}): Promise<LocalChatMediaTransferQueueItem[]> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return [];
  }

  const db = await getLocalChatSqliteDatabase();
  const limit = Math.max(1, Math.min(Math.round(input.limit || 200), 1000));
  const transferType = normalizeMediaTransferType(input.transferType);
  const params: Array<string | number> = [scope.ownerUid, scope.tenantId];
  const whereClauses = ['owner_uid = ?', 'tenant_id = ?'];

  if (input.contactId) {
    whereClauses.push('contact_id = ?');
    params.push(input.contactId);
  }

  if (transferType) {
    whereClauses.push('transfer_type = ?');
    params.push(transferType);
  }

  params.push(limit);

  const rows = await db.getAllAsync<SqliteMediaTransferQueueRow>(
    `SELECT queue_id, contact_id, message_id, media_index, media_id,
            native_transfer_id, transfer_type, status, progress, attempts, last_error,
            next_retry_at_ms, payload, updated_at
     FROM local_chat_media_transfer_queue
     WHERE ${whereClauses.join(' AND ')}
     ORDER BY updated_at ASC, queue_id ASC
     LIMIT ?`,
    params
  );
  const items = await Promise.all(rows.map((row) => mapSqliteMediaTransferQueueRow(scope, row)));

  return items.filter((item): item is LocalChatMediaTransferQueueItem => Boolean(item));
}

export async function upsertLocalChatMediaTransferQueueItem(
  input: UpsertLocalChatMediaTransferQueueInput
): Promise<LocalChatMediaTransferQueueItem> {
  const scope = normalizeLocalChatScope(input);
  const transferType = normalizeMediaTransferType(input.transferType);
  const status = normalizeMediaTransferStatus(input.status);

  if (!scope || !transferType || !status) {
    throw new Error('A valid local media transfer queue item is required.');
  }

  const db = await getLocalChatSqliteDatabase();
  const media = normalizeCachedMediaAttachment(input.media);

  if (!media) {
    throw new Error('A valid media attachment is required.');
  }

  const mediaIndex = Math.max(0, Math.round(input.mediaIndex || 0));
  const nowIso = new Date().toISOString();
  const item: LocalChatMediaTransferQueueItem = {
    attempts: Math.max(0, Math.round(input.attempts || 0)),
    contactId: input.contactId,
    lastError: input.lastError || null,
    media,
    mediaId: media.mediaId || null,
    mediaIndex,
    messageId: input.messageId,
    nativeTransferId: normalizeNativeTransferId(input.nativeTransferId),
    nextRetryAtMs: normalizeNullableTimestampMs(input.nextRetryAtMs),
    ownerUid: scope.ownerUid,
    progress: normalizeTransferProgress(input.progress),
    queueId: input.queueId || buildMediaTransferQueueId(transferType, input.contactId, input.messageId, mediaIndex),
    status,
    tenantId: scope.tenantId,
    transferType,
    uploadRecovery: normalizeMediaUploadRecoveryState(input.uploadRecovery),
    updatedAt: nowIso,
    version: 1
  };

  await db.runAsync(
    `INSERT INTO local_chat_media_transfer_queue (
      owner_uid, tenant_id, queue_id, contact_id, message_id,
      media_index, media_id, native_transfer_id, transfer_type, status, progress,
      attempts, last_error, next_retry_at_ms, payload, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_uid, tenant_id, queue_id)
    DO UPDATE SET
      contact_id = excluded.contact_id,
      message_id = excluded.message_id,
      media_index = excluded.media_index,
      media_id = excluded.media_id,
      native_transfer_id = excluded.native_transfer_id,
      transfer_type = excluded.transfer_type,
      status = excluded.status,
      progress = excluded.progress,
      attempts = excluded.attempts,
      last_error = excluded.last_error,
      next_retry_at_ms = excluded.next_retry_at_ms,
      payload = excluded.payload,
      updated_at = excluded.updated_at`,
    [
      scope.ownerUid,
      scope.tenantId,
      item.queueId,
      item.contactId,
      item.messageId,
      item.mediaIndex,
      item.mediaId,
      item.nativeTransferId,
      item.transferType,
      item.status,
      item.progress,
      item.attempts,
      item.lastError,
      item.nextRetryAtMs,
      await encryptJson(item),
      nowIso
    ]
  );

  return item;
}

export async function removeLocalChatMediaTransferQueueItem(input: {
  ownerUid: string;
  queueId: string;
  tenantId: string;
}): Promise<void> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return;
  }

  const db = await getLocalChatSqliteDatabase();

  await db.runAsync(
    'DELETE FROM local_chat_media_transfer_queue WHERE owner_uid = ? AND tenant_id = ? AND queue_id = ?',
    [scope.ownerUid, scope.tenantId, input.queueId]
  );
}

export async function listLocalChatMediaPreparationQueue(input: {
  contactId?: string;
  limit?: number;
  ownerUid: string;
  status?: LocalChatMediaPreparationStatus;
  tenantId: string;
}): Promise<LocalChatMediaPreparationQueueItem[]> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return [];
  }

  const db = await getLocalChatSqliteDatabase();
  const limit = Math.max(1, Math.min(Math.round(input.limit || 200), 1000));
  const status = normalizeMediaPreparationStatus(input.status);
  const params: Array<string | number> = [scope.ownerUid, scope.tenantId];
  const whereClauses = ['owner_uid = ?', 'tenant_id = ?'];

  if (input.contactId) {
    whereClauses.push('contact_id = ?');
    params.push(input.contactId);
  }

  if (status) {
    whereClauses.push('status = ?');
    params.push(status);
  }

  params.push(limit);

  const rows = await db.getAllAsync<SqliteMediaPreparationQueueRow>(
    `SELECT queue_id, contact_id, message_id, media_index, asset_identifier,
            status, progress, attempts, last_error, payload, updated_at
     FROM local_chat_media_preparation_queue
     WHERE ${whereClauses.join(' AND ')}
     ORDER BY updated_at ASC, queue_id ASC
     LIMIT ?`,
    params
  );
  const items = await Promise.all(rows.map((row) => mapSqliteMediaPreparationQueueRow(scope, row)));

  return items.filter((item): item is LocalChatMediaPreparationQueueItem => Boolean(item));
}

export async function upsertLocalChatMediaPreparationQueueItem(
  input: UpsertLocalChatMediaPreparationQueueInput
): Promise<LocalChatMediaPreparationQueueItem> {
  const scope = normalizeLocalChatScope(input);
  const status = normalizeMediaPreparationStatus(input.status);
  const media = normalizeCachedMediaAttachment(input.media);
  const assetIdentifier = normalizeNativeAssetIdentifier(input.assetIdentifier);

  if (!scope || !status || !media || !assetIdentifier) {
    throw new Error('A valid local media preparation queue item is required.');
  }

  const preparedMedia = input.preparedMedia ? normalizeCachedMediaAttachment(input.preparedMedia) : null;
  const mediaIndex = Math.max(0, Math.round(input.mediaIndex || 0));
  const nowIso = new Date().toISOString();
  const item: LocalChatMediaPreparationQueueItem = {
    assetIdentifier,
    attempts: Math.max(0, Math.round(input.attempts || 0)),
    chatType: input.chatType === 'GROUP' ? 'GROUP' : input.chatType === 'DIRECT' ? 'DIRECT' : undefined,
    contactId: input.contactId,
    lastError: input.lastError || null,
    media,
    mediaIndex,
    messageId: input.messageId,
    ownerUid: scope.ownerUid,
    preparedMedia,
    progress: normalizeTransferProgress(input.progress),
    queueId: input.queueId || buildMediaPreparationQueueId(input.contactId, input.messageId, mediaIndex, assetIdentifier),
    status,
    tenantId: scope.tenantId,
    updatedAt: nowIso,
    version: 1
  };
  const db = await getLocalChatSqliteDatabase();

  await db.runAsync(
    `INSERT INTO local_chat_media_preparation_queue (
      owner_uid, tenant_id, queue_id, contact_id, message_id,
      media_index, asset_identifier, status, progress, attempts,
      last_error, payload, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_uid, tenant_id, queue_id)
    DO UPDATE SET
      contact_id = excluded.contact_id,
      message_id = excluded.message_id,
      media_index = excluded.media_index,
      asset_identifier = excluded.asset_identifier,
      status = excluded.status,
      progress = excluded.progress,
      attempts = excluded.attempts,
      last_error = excluded.last_error,
      payload = excluded.payload,
      updated_at = excluded.updated_at`,
    [
      scope.ownerUid,
      scope.tenantId,
      item.queueId,
      item.contactId,
      item.messageId,
      item.mediaIndex,
      item.assetIdentifier,
      item.status,
      item.progress,
      item.attempts,
      item.lastError,
      await encryptJson(item),
      nowIso
    ]
  );

  return item;
}

export async function removeLocalChatMediaPreparationQueueItem(input: {
  ownerUid: string;
  queueId: string;
  tenantId: string;
}): Promise<void> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return;
  }

  const db = await getLocalChatSqliteDatabase();

  await db.runAsync(
    'DELETE FROM local_chat_media_preparation_queue WHERE owner_uid = ? AND tenant_id = ? AND queue_id = ?',
    [scope.ownerUid, scope.tenantId, input.queueId]
  );
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

export async function deleteCachedChatConversation(input: {
  contactId: string;
  ownerUid: string;
  tenantId: string;
}): Promise<void> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return;
  }

  await AsyncStorage.removeItem(getConversationStorageKey(scope, input.contactId)).catch(() => undefined);

  const db = await getLocalChatSqliteDatabase().catch(() => null);

  if (!db) {
    return;
  }

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'DELETE FROM local_messages WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?',
      [scope.ownerUid, scope.tenantId, input.contactId]
    );
    await db.runAsync(
      'DELETE FROM local_chat_media WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?',
      [scope.ownerUid, scope.tenantId, input.contactId]
    );
    await db.runAsync(
      'DELETE FROM local_chat_media_transfer_queue WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?',
      [scope.ownerUid, scope.tenantId, input.contactId]
    );
    await db.runAsync(
      'DELETE FROM local_chat_sync_state WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?',
      [scope.ownerUid, scope.tenantId, input.contactId]
    );
    await db.runAsync(
      'DELETE FROM local_conversations WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?',
      [scope.ownerUid, scope.tenantId, input.contactId]
    );
  });
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
    // Sealed without its thumbnails, like the full save. This runs on every
    // media update, so it fires more often than any other write, and it was
    // re-encrypting 40KB of base64 while the user was tapping.
    const payload = await encryptJson(stripThumbnailsForPayload(nextMessage));

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

    await replaceCachedMessageMediaRows(db, scope, input.contactId, nextMessage, nowIso);
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
  // Drop the cached database key with the data it protects, so a later sign-in
  // reads secure storage again rather than reusing a key held from before.
  clearLocalChatKeyCache();

  const keys = await AsyncStorage.getAllKeys();
  const safeOwnerUid = sanitizeStorageKey(input.ownerUid);
  const safeTenantId = input.tenantId ? sanitizeStorageKey(input.tenantId) : '';
  const ownerPrefixes = safeTenantId
    ? [
        // Legacy v1 keys did not carry a reliable tenant partition, so they are removed during
        // tenant cleanup to avoid retaining older company chat data on the device.
        `synzapp.localChat.v1.${safeOwnerUid}.`,
        `synzapp.localChatContacts.v1.${safeOwnerUid}`,
        `synzapp.localOutbox.v1.${safeOwnerUid}`,
        `synzapp.localChat.v2.${safeOwnerUid}.${safeTenantId}.`,
        `synzapp.localChatContacts.v2.${safeOwnerUid}.${safeTenantId}`,
        `synzapp.localOutbox.v2.${safeOwnerUid}.${safeTenantId}`
      ]
    : [
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
  const nextMessages = uniqueMessages(existingRecord?.messages || [])
    .filter((message) => !hiddenMessageIdSet.has(message.messageId))
    .slice(-LOCAL_CACHED_MESSAGE_LIMIT);
  const nextContact = existingRecord?.contact && nextMessages.length === 0
    ? {
        ...existingRecord.contact,
        lastMessageAt: null,
        preview: '',
        unreadCount: 0
      }
    : existingRecord?.contact || null;
  const nextRecord: LocalConversationRecord = {
    contact: nextContact,
    contactId: input.contactId,
    hiddenMessageIds,
    messages: nextMessages,
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

  await migratePendingChatMessagesToSqlite(scope).catch(() => undefined);

  const sqliteMessages = await listPendingChatMessagesFromSqlite({
    contactId: input.contactId,
    ownerUid: scope.ownerUid,
    tenantId: scope.tenantId
  }).catch(() => []);

  if (sqliteMessages.length || await hasSqlitePendingOutboxRows(scope).catch(() => false)) {
    return sqliteMessages;
  }

  return listPendingChatMessagesFromAsyncStorage(scope, input.contactId).catch(() => []);
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
      // The queue id is this message's permanent client identity. It is sent to
      // the backend as `clientMessageId` and comes back on the server envelope,
      // which is what lets the queued bubble and its echo reconcile into one row.
      clientMessageId: queueId,
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
  await upsertPendingChatMessageToSqlite(scope, pendingMessage);

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

  const db = await getLocalChatSqliteDatabase();

  await db.runAsync(
    'DELETE FROM local_chat_outbox WHERE owner_uid = ? AND tenant_id = ? AND queue_id = ?',
    [scope.ownerUid, scope.tenantId, input.queueId]
  );
  await removePendingChatMessageFromAsyncStorage(scope, input.queueId).catch(() => undefined);
}

export async function removePendingChatMessagesForContact(input: {
  contactId: string;
  ownerUid: string;
  tenantId: string;
}): Promise<string[]> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return [];
  }

  const currentMessages = await listPendingChatMessages({
    contactId: input.contactId,
    ownerUid: scope.ownerUid,
    tenantId: scope.tenantId
  });
  const removedQueueIds = currentMessages.map((message) => message.queueId);

  if (!removedQueueIds.length) {
    return [];
  }

  const db = await getLocalChatSqliteDatabase();

  await db.runAsync(
    'DELETE FROM local_chat_outbox WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?',
    [scope.ownerUid, scope.tenantId, input.contactId]
  );
  await savePendingChatMessagesToAsyncStorage(
    scope,
    (await listPendingChatMessagesFromAsyncStorage(scope).catch(() => []))
      .filter((message) => message.contactId !== input.contactId)
  ).catch(() => undefined);

  return removedQueueIds;
}

export async function updatePendingChatMessage(input: {
  lastError?: string | null;
  message?: ChatMessage;
  ownerUid: string;
  queueId: string;
  status: PendingChatMessage['status'];
  tenantId: string;
}): Promise<PendingChatMessage | null> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return null;
  }

  const currentMessage = (await listPendingChatMessages(scope))
    .find((message) => message.queueId === input.queueId) || null;

  if (!currentMessage) {
    return null;
  }

  const updatedMessage: PendingChatMessage = {
    ...currentMessage,
    attempts: input.status === 'sending' ? currentMessage.attempts + 1 : currentMessage.attempts,
    lastError: input.lastError === undefined ? currentMessage.lastError : input.lastError,
    message: input.message || currentMessage.message,
    status: input.status
  };

  await upsertPendingChatMessageToSqlite(scope, updatedMessage);

  return updatedMessage;
}

async function savePendingChatMessagesToAsyncStorage(scope: LocalChatScope, messages: PendingChatMessage[]): Promise<void> {
  const safeMessages = messages
    .filter((message) => message.ownerUid === scope.ownerUid && message.tenantId === scope.tenantId)
    .slice(-200);

  await AsyncStorage.setItem(
    getOutboxStorageKey(scope),
    await encryptJson(safeMessages)
  );
}

export function buildQueuedMediaAttachmentFromRow(row: SqliteMediaTransferQueueRow): ChatMediaAttachment | null {
  const mediaId = typeof row.media_id === 'string' && row.media_id.trim() ? row.media_id.trim() : undefined;

  if (!mediaId) {
    return null;
  }

  return {
    contentType: 'application/octet-stream',
    fileName: mediaId,
    kind: 'file',
    mediaId,
    sizeBytes: 0,
    transferProgress: normalizeTransferProgress(row.progress),
    transferStatus: normalizeMediaTransferStatus(row.status) || undefined
  };
}

export async function listPendingChatMessagesFromAsyncStorage(
  scope: LocalChatScope,
  contactId?: string
): Promise<PendingChatMessage[]> {
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
      (!contactId || message.contactId === contactId)
    )
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt));
}

export async function removePendingChatMessageFromAsyncStorage(
  scope: LocalChatScope,
  queueId: string
): Promise<void> {
  const legacyMessages = await listPendingChatMessagesFromAsyncStorage(scope);

  if (!legacyMessages.length) {
    return;
  }

  await savePendingChatMessagesToAsyncStorage(
    scope,
    legacyMessages.filter((message) => message.queueId !== queueId)
  );
}

export function normalizePendingMessageStatus(status: unknown): PendingChatMessage['status'] | null {
  return status === 'failed' || status === 'pending' || status === 'sending'
    ? status
    : null;
}

export async function replaceCachedMessageMediaRows(
  db: SQLite.SQLiteDatabase,
  scope: LocalChatScope,
  contactId: string,
  message: ChatMessage,
  updatedAt: string
): Promise<void> {
  const mediaItems = getCachedMessageMediaItems(message);

  if (!mediaItems.length) {
    await db.runAsync(
      `DELETE FROM local_chat_media
       WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ? AND message_id = ?`,
      [scope.ownerUid, scope.tenantId, contactId, message.messageId]
    );
    return;
  }

  const mediaIndexes = mediaItems.map((_, index) => index);
  const placeholders = mediaIndexes.map(() => '?').join(', ');

  await db.runAsync(
    `DELETE FROM local_chat_media
     WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ? AND message_id = ?
       AND media_index NOT IN (${placeholders})`,
    [scope.ownerUid, scope.tenantId, contactId, message.messageId, ...mediaIndexes]
  );

  for (let mediaIndex = 0; mediaIndex < mediaItems.length; mediaIndex += 1) {
    const media = normalizeCachedMediaAttachment(mediaItems[mediaIndex]);

    if (!media) {
      continue;
    }

    await db.runAsync(
      `INSERT INTO local_chat_media (
        owner_uid, tenant_id, contact_id, message_id, media_index,
        media_id, kind, content_type, file_name, size_bytes,
        duration_ms, width, height, thumbnail_local_uri, thumbnail_data_url,
        plain_local_uri, transfer_status, transfer_progress, payload, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner_uid, tenant_id, contact_id, message_id, media_index)
      DO UPDATE SET
        media_id = excluded.media_id,
        kind = excluded.kind,
        content_type = excluded.content_type,
        file_name = excluded.file_name,
        size_bytes = excluded.size_bytes,
        duration_ms = excluded.duration_ms,
        width = excluded.width,
        height = excluded.height,
        thumbnail_local_uri = excluded.thumbnail_local_uri,
        thumbnail_data_url = excluded.thumbnail_data_url,
        plain_local_uri = excluded.plain_local_uri,
        transfer_status = excluded.transfer_status,
        transfer_progress = excluded.transfer_progress,
        payload = excluded.payload,
        updated_at = excluded.updated_at`,
      [
        scope.ownerUid,
        scope.tenantId,
        contactId,
        message.messageId,
        mediaIndex,
        media.mediaId || null,
        media.kind,
        media.contentType,
        media.fileName,
        Math.max(0, Math.round(media.sizeBytes || 0)),
        Number.isFinite(media.durationMs) ? Math.max(0, Math.round(media.durationMs || 0)) : null,
        Number.isFinite(media.width) ? Math.max(1, Math.round(media.width || 1)) : null,
        Number.isFinite(media.height) ? Math.max(1, Math.round(media.height || 1)) : null,
        null,
        media.thumbnailDataUrl || null,
        toPortableChatMediaUri(media.localUri || '') || null,
        normalizeMediaTransferStatus(media.transferStatus) || null,
        Number.isFinite(media.transferProgress)
          ? Math.min(Math.max(media.transferProgress || 0, 0), 1)
          : null,
          // Without the thumbnail: it goes to its own column in this same row,
          // in the clear. Sealing a second copy here was the same mistake as in
          // the message payload, in a second place.
          await encryptJson(stripMediaThumbnail(media)),
        updatedAt
      ]
    );
  }
}

/**
 * The hidden-message ids for a conversation, without touching its messages.
 *
 * One small decrypt instead of one per cached message.
 */
export async function loadCachedHiddenMessageIds(
  scope: LocalChatScope,
  contactId: string
): Promise<string[]> {
  const db = await getLocalChatSqliteDatabase();
  const row = await db.getFirstAsync<{ hidden_payload: string | null }>(
    `SELECT hidden_payload
     FROM local_conversations
     WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?
     LIMIT 1`,
    [scope.ownerUid, scope.tenantId, contactId]
  ).catch(() => null);

  if (!row?.hidden_payload) {
    return [];
  }

  const hiddenMessageIds = await decryptJson<string[]>(row.hidden_payload).catch(() => []);

  return Array.isArray(hiddenMessageIds) ? hiddenMessageIds : [];
}

export async function loadStoredMessageSignatures(
  db: SQLite.SQLiteDatabase,
  scope: LocalChatScope,
  contactId: string
): Promise<Map<string, string>> {
  const rows = await db.getAllAsync<{ content_signature: string | null; message_id: string }>(
    `SELECT message_id, content_signature
     FROM local_messages
     WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?`,
    [scope.ownerUid, scope.tenantId, contactId]
  ).catch(() => []);
  const signatures = new Map<string, string>();

  rows.forEach((row) => {
    if (row.content_signature) {
      signatures.set(row.message_id, row.content_signature);
    }
  });

  return signatures;
}

export async function ensureLocalMessageColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<{ name: string }>('PRAGMA table_info(local_messages)');

  if (!rows.some((row) => row.name === 'content_signature')) {
    await db.execAsync('ALTER TABLE local_messages ADD COLUMN content_signature TEXT');
  }
}

export async function ensureLocalConversationColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<{ name: string }>('PRAGMA table_info(local_conversations)');
  const columnNames = new Set(rows.map((row) => row.name));
  const migrations: Array<[string, string]> = [
    ['last_message_at_ms', 'ALTER TABLE local_conversations ADD COLUMN last_message_at_ms INTEGER'],
    ['preview', 'ALTER TABLE local_conversations ADD COLUMN preview TEXT'],
    ['unread_count', 'ALTER TABLE local_conversations ADD COLUMN unread_count INTEGER NOT NULL DEFAULT 0'],
    ['is_archived', 'ALTER TABLE local_conversations ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0'],
    ['is_pinned', 'ALTER TABLE local_conversations ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0'],
    ['is_favorite', 'ALTER TABLE local_conversations ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0'],
    ['is_spam', 'ALTER TABLE local_conversations ADD COLUMN is_spam INTEGER NOT NULL DEFAULT 0']
  ];

  for (const [columnName, sql] of migrations) {
    if (!columnNames.has(columnName)) {
      await db.execAsync(sql);
    }
  }
}

export async function ensureLocalMediaTransferQueueColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<{ name: string }>('PRAGMA table_info(local_chat_media_transfer_queue)');
  const columnNames = new Set(rows.map((row) => row.name));

  if (!columnNames.has('native_transfer_id')) {
    await db.execAsync('ALTER TABLE local_chat_media_transfer_queue ADD COLUMN native_transfer_id TEXT');
  }
}

export function getMessageSentAtMs(message: ChatMessage): number {
  const sentAtMs = Date.parse(message.sentAt);

  return Number.isFinite(sentAtMs) ? sentAtMs : Date.now();
}

export function getContactLastMessageAtMs(contact: ChatContact | null): number | null {
  const lastMessageAtMs = Date.parse(contact?.lastMessageAt || '');

  return Number.isFinite(lastMessageAtMs) ? lastMessageAtMs : null;
}

export function getLocalChatPreview(contact: ChatContact | null, latestMessage: ChatMessage | null): string {
  if (latestMessage) {
    const text = latestMessage.text.trim();

    if (text) {
      return text.slice(0, 160);
    }

    const mediaItems = getCachedMessageMediaItems(latestMessage);
    const media = mediaItems[0] || latestMessage.media || latestMessage.image || null;

    if (media?.kind === 'image') {
      return mediaItems.length > 1 ? `${mediaItems.length} photos` : 'Photo';
    }

    if (media?.kind === 'video') {
      return 'Video';
    }

    if (media?.kind === 'audio') {
      return 'Voice message';
    }

    if (media?.kind === 'file') {
      return media.fileName || 'Document';
    }
  }

  return contact?.preview || '';
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

export function normalizeCachedMediaAttachment(media: ChatMediaAttachment | null | undefined): ChatMediaAttachment | null {
  const kind = normalizeMediaKind(media?.kind);
  const contentType = typeof media?.contentType === 'string' && media.contentType.trim()
    ? media.contentType.trim()
    : '';
  const fileName = typeof media?.fileName === 'string' && media.fileName.trim()
    ? media.fileName.trim()
    : '';

  if (!media || !kind || !contentType || !fileName) {
    return null;
  }

  return {
    ...media,
    contentType,
    durationMs: Number.isFinite(media.durationMs) ? Math.max(0, Math.round(media.durationMs || 0)) : undefined,
    fileName,
    height: Number.isFinite(media.height) ? Math.max(1, Math.round(media.height || 1)) : undefined,
    kind,
    sizeBytes: Number.isFinite(media.sizeBytes) ? Math.max(0, Math.round(media.sizeBytes || 0)) : 0,
    transferProgress: Number.isFinite(media.transferProgress)
      ? Math.min(Math.max(media.transferProgress || 0, 0), 1)
      : undefined,
    transferStatus: normalizeMediaTransferStatus(media.transferStatus) || undefined,
    width: Number.isFinite(media.width) ? Math.max(1, Math.round(media.width || 1)) : undefined
  };
}

export function normalizeMediaKind(kind: unknown): ChatMediaAttachment['kind'] | null {
  return kind === 'audio' || kind === 'file' || kind === 'image' || kind === 'video'
    ? kind
    : null;
}

export function normalizeMediaTransferStatus(status: unknown): ChatMediaAttachment['transferStatus'] | null {
  return status === 'available' ||
    status === 'downloading' ||
    status === 'failed' ||
    status === 'preparing' ||
    status === 'queued' ||
    status === 'uploading'
      ? status
      : null;
}

export function normalizeMediaPreparationStatus(status: unknown): LocalChatMediaPreparationStatus | null {
  return status === 'cancelled' ||
    status === 'failed' ||
    status === 'preparing' ||
    status === 'queued' ||
    status === 'ready'
      ? status
      : null;
}

export function normalizeMediaTransferType(value: unknown): LocalChatMediaTransferType | null {
  return value === 'download' || value === 'upload' ? value : null;
}

export function normalizeTransferProgress(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(value, 0), 1)
    : 0;
}

export function normalizeNativeTransferId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 512) : null;
}

export function normalizeNativeAssetIdentifier(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 1024) : '';
}

export function normalizeMediaUploadRecoveryState(value: unknown): LocalChatMediaUploadRecoveryState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<LocalChatMediaUploadRecoveryState>;
  const mediaId = typeof candidate.mediaId === 'string' && candidate.mediaId.trim()
    ? candidate.mediaId.trim()
    : '';
  const expiresAt = typeof candidate.expiresAt === 'string' && candidate.expiresAt.trim()
    ? candidate.expiresAt.trim()
    : '';
  const media = normalizeCachedMediaAttachment(candidate.media);

  if (!mediaId || !expiresAt || !media || media.mediaId !== mediaId) {
    return null;
  }

  return {
    chatType: candidate.chatType === 'GROUP' ? 'GROUP' : candidate.chatType === 'DIRECT' ? 'DIRECT' : undefined,
    expiresAt,
    media,
    mediaId,
    partNativeTransferIds: Array.isArray(candidate.partNativeTransferIds)
      ? candidate.partNativeTransferIds.map(normalizeNativeTransferId).filter((id): id is string => Boolean(id))
      : undefined,
    uploadedPartIndexes: Array.isArray(candidate.uploadedPartIndexes)
      ? candidate.uploadedPartIndexes
          .filter((index): index is number => typeof index === 'number' && Number.isFinite(index) && index >= 0)
          .map((index) => Math.round(index))
          .slice(0, 500)
      : undefined,
    uploadMode: candidate.uploadMode === 'chunked' ? 'chunked' : 'single'
  };
}

function buildMediaTransferQueueId(
  transferType: LocalChatMediaTransferType,
  contactId: string,
  messageId: string,
  mediaIndex: number
): string {
  return [
    transferType,
    sanitizeStorageKey(contactId),
    sanitizeStorageKey(messageId),
    Math.max(0, Math.round(mediaIndex))
  ].join(':').slice(0, 360);
}

function buildMediaPreparationQueueId(
  contactId: string,
  messageId: string,
  mediaIndex: number,
  assetIdentifier: string
): string {
  return [
    'prepare',
    sanitizeStorageKey(contactId),
    sanitizeStorageKey(messageId),
    Math.max(0, Math.round(mediaIndex)),
    sanitizeStorageKey(assetIdentifier)
  ].join(':').slice(0, 420);
}

function normalizeMediaMessageIds(messageIds: string[]): string[] {
  const seenMessageIds = new Set<string>();
  const safeMessageIds: string[] = [];

  messageIds.forEach((messageId) => {
    const safeMessageId = typeof messageId === 'string' ? messageId.trim() : '';

    if (safeMessageId && !seenMessageIds.has(safeMessageId)) {
      seenMessageIds.add(safeMessageId);
      safeMessageIds.push(safeMessageId);
    }
  });

  return safeMessageIds.slice(0, 500);
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

export async function encryptJson(value: unknown): Promise<string> {
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

export async function decryptJson<T>(encryptedValue: string): Promise<T | null> {
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

/**
 * The local database key, fetched from secure storage once per app run.
 *
 * Every encrypt and decrypt used to call this, and every call meant a
 * SecureStore round trip — on Android that is an IPC to the keystore daemon plus
 * a hardware-backed AES-GCM unwrap, which costs milliseconds each. Opening a
 * chat decrypts one record per conversation and message batch, so the cost was
 * paid hundreds of times in a row and the app appeared to freeze on tap. It is
 * unnoticeable on iOS, where the Keychain is far faster, which is why this
 * survived until the app ran on a low-end Android phone.
 *
 * Caching the key does not weaken anything: it is already held in memory as a
 * Uint8Array for the duration of every operation, so the security boundary is
 * the process either way. It is dropped when the owner's data is cleared.
 */
let localChatKeyPromise: Promise<Uint8Array> | null = null;

function getOrCreateLocalChatKey(): Promise<Uint8Array> {
  if (!localChatKeyPromise) {
    // A rejection must not be cached, or one failure at startup would leave the
    // store permanently unusable for the rest of the run.
    localChatKeyPromise = loadOrCreateLocalChatKey().catch((error) => {
      localChatKeyPromise = null;

      throw error;
    });
  }

  return localChatKeyPromise;
}

/** Forgets the cached key. Called when the owner's local data is cleared. */
export function clearLocalChatKeyCache(): void {
  localChatKeyPromise = null;
}

async function loadOrCreateLocalChatKey(): Promise<Uint8Array> {
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

export function getOutboxStorageKey(scope: LocalChatScope): string {
  return `synzapp.localOutbox.v2.${sanitizeStorageKey(scope.ownerUid)}.${sanitizeStorageKey(scope.tenantId)}`;
}

function getChatContactsStorageKey(scope: LocalChatScope): string {
  return `synzapp.localChatContacts.v2.${sanitizeStorageKey(scope.ownerUid)}.${sanitizeStorageKey(scope.tenantId)}`;
}

export function normalizeLocalChatScope(input: {
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

export function normalizeCachedChatContacts(contacts: ChatContact[] | undefined): ChatContact[] {
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

export function normalizeCachedConversationRecord(record: LocalConversationRecord): LocalConversationRecord {
  return {
    ...record,
    hiddenMessageIds: normalizeHiddenMessageIds(record.hiddenMessageIds),
    messages: uniqueMessages(record.messages || [])
  };
}

export function filterHiddenMessagesInRecord(record: LocalConversationRecord): LocalConversationRecord {
  const hiddenMessageIds = normalizeHiddenMessageIds(record.hiddenMessageIds);
  const hiddenMessageIdSet = new Set(hiddenMessageIds);

  return {
    ...record,
    hiddenMessageIds,
    messages: uniqueMessages(record.messages || [])
      .filter((message) => !hiddenMessageIdSet.has(message.messageId))
  };
}

function filterHiddenMessagesInPageRecord(record: LocalConversationPageRecord): LocalConversationPageRecord {
  const filteredRecord = filterHiddenMessagesInRecord(record);

  return {
    ...record,
    hiddenMessageIds: filteredRecord.hiddenMessageIds,
    messages: filteredRecord.messages,
    oldestMessageSentAtMs: filteredRecord.messages.length
      ? getMessageSentAtMs(filteredRecord.messages[0])
      : record.oldestMessageSentAtMs
  };
}

export function normalizeMessagePageLimit(limit?: number): number {
  if (!Number.isFinite(limit)) {
    return LOCAL_CHAT_MESSAGE_PAGE_LIMIT;
  }

  return Math.max(20, Math.min(Math.round(limit || LOCAL_CHAT_MESSAGE_PAGE_LIMIT), 120));
}

export function normalizeNullableTimestampMs(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.floor(value));
}

function mergeNullableMax(first: number | null, second: number | null): number | null {
  if (first === null) {
    return second;
  }

  if (second === null) {
    return first;
  }

  return Math.max(first, second);
}

function mergeNullableMin(first: number | null, second: number | null): number | null {
  if (first === null) {
    return second;
  }

  if (second === null) {
    return first;
  }

  return Math.min(first, second);
}

export function normalizeHiddenMessageIds(messageIds?: string[]): string[] {
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

export function uniqueMessages(messages: ChatMessage[]): ChatMessage[] {
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
