import AsyncStorage from '@react-native-async-storage/async-storage';
import { fromByteArray, toByteArray } from 'base64-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import {
  buildThumbnailKey,
  restoreThumbnails,
  stripThumbnailsForPayload
} from './localChatThumbnailSplit';
import { planLocalChatRowWrites } from './localChatRowSignatures';
import * as SQLite from 'expo-sqlite';
import nacl from 'tweetnacl';
import type { ChatContact, ChatMediaAttachment, ChatMessage } from './chatApi';
import {
  resolveLocalChatMediaUri,
  toPortableChatMediaUri
} from './chatMediaPaths';
import {
  LOCAL_CACHED_CHAT_CONTACT_LIMIT,
  LOCAL_CACHED_MESSAGE_LIMIT,
  LOCAL_SQLITE_DATABASE_NAME,
  LocalCachedChatMediaRecord,
  LocalChatMediaPreparationQueueItem,
  LocalChatMediaTransferQueueItem,
  LocalChatScope,
  LocalConversationPageRecord,
  LocalConversationRecord,
  PendingChatMessage,
  buildQueuedMediaAttachmentFromRow,
  decryptJson,
  encryptJson,
  ensureLocalConversationColumns,
  ensureLocalMediaTransferQueueColumns,
  ensureLocalMessageColumns,
  filterHiddenMessagesInRecord,
  getContactLastMessageAtMs,
  getLocalChatPreview,
  getMessageSentAtMs,
  getOutboxStorageKey,
  listPendingChatMessagesFromAsyncStorage,
  loadCachedHiddenMessageIds,
  loadStoredMessageSignatures,
  normalizeCachedChatContacts,
  normalizeCachedConversationRecord,
  normalizeCachedMediaAttachment,
  normalizeHiddenMessageIds,
  normalizeLocalChatScope,
  normalizeMediaKind,
  normalizeMediaPreparationStatus,
  normalizeMediaTransferStatus,
  normalizeMediaTransferType,
  normalizeMediaUploadRecoveryState,
  normalizeMessagePageLimit,
  normalizeNativeAssetIdentifier,
  normalizeNativeTransferId,
  normalizeNullableTimestampMs,
  normalizePendingMessageStatus,
  normalizeTransferProgress,
  removePendingChatMessageFromAsyncStorage,
  replaceCachedMessageMediaRows,
  uniqueMessages,
} from './localChatStore';

/**
 * The SQLite layer behind the local chat store.
 *
 * Table creation, migrations, and the read and write paths for conversations,
 * messages, media and the transfer queues. Separated from the store's public
 * surface so the two can be read independently.
 */


/** The single open database, shared by every read and write below. */
let sqliteDatabasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export interface SqliteConversationRow {
  contact_id: string;
  contact_payload: string | null;
  hidden_payload: string | null;
  updated_at: string;
}

export interface SqliteMessageRow {
  message_id?: string;
  payload: string;
  sent_at_ms?: number;
}

export interface SqliteSyncStateRow {
  has_more_before: number | null;
  latest_server_sent_at_ms: number | null;
  oldest_local_sent_at_ms: number | null;
  updated_at: string;
}

export interface SqliteMediaRow {
  content_type: string | null;
  duration_ms: number | null;
  file_name: string | null;
  height: number | null;
  kind: string | null;
  media_id: string | null;
  media_index: number;
  message_id: string;
  payload: string;
  plain_local_uri: string | null;
  size_bytes: number | null;
  thumbnail_data_url: string | null;
  thumbnail_local_uri: string | null;
  transfer_progress: number | null;
  transfer_status: string | null;
  updated_at: string;
  width: number | null;
}

export interface SqlitePendingOutboxRow {
  attempts: number;
  chat_type: string | null;
  contact_id: string;
  created_at: string;
  last_error: string | null;
  payload: string;
  queue_id: string;
  status: string;
  text_preview: string | null;
  updated_at: string;
}

export interface SqliteMediaTransferQueueRow {
  attempts: number;
  contact_id: string;
  last_error: string | null;
  media_id: string | null;
  media_index: number;
  message_id: string;
  native_transfer_id: string | null;
  next_retry_at_ms: number | null;
  payload: string;
  progress: number | null;
  queue_id: string;
  status: string;
  transfer_type: string;
  updated_at: string;
}

export interface SqliteMediaPreparationQueueRow {
  asset_identifier: string;
  attempts: number;
  contact_id: string;
  last_error: string | null;
  media_index: number;
  message_id: string;
  payload: string;
  progress: number | null;
  queue_id: string;
  status: string;
  updated_at: string;
}

export async function listPendingChatMessagesFromSqlite(input: {
  contactId?: string;
  ownerUid: string;
  tenantId: string;
}): Promise<PendingChatMessage[]> {
  const scope = normalizeLocalChatScope(input);

  if (!scope) {
    return [];
  }

  const db = await getLocalChatSqliteDatabase();
  const rows = input.contactId
    ? await db.getAllAsync<SqlitePendingOutboxRow>(
        `SELECT queue_id, contact_id, chat_type, status, attempts, last_error,
                text_preview, payload, created_at, updated_at
         FROM local_chat_outbox
         WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?
         ORDER BY created_at ASC, queue_id ASC`,
        [scope.ownerUid, scope.tenantId, input.contactId]
      )
    : await db.getAllAsync<SqlitePendingOutboxRow>(
        `SELECT queue_id, contact_id, chat_type, status, attempts, last_error,
                text_preview, payload, created_at, updated_at
         FROM local_chat_outbox
         WHERE owner_uid = ? AND tenant_id = ?
         ORDER BY created_at ASC, queue_id ASC`,
        [scope.ownerUid, scope.tenantId]
      );
  const messages = await Promise.all(rows.map((row) =>
    mapSqlitePendingOutboxRow(scope, row)
  ));

  return messages.filter((message): message is PendingChatMessage => Boolean(message));
}

export async function upsertPendingChatMessageToSqlite(
  scope: LocalChatScope,
  message: PendingChatMessage
): Promise<void> {
  const db = await getLocalChatSqliteDatabase();
  const nowIso = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO local_chat_outbox (
      owner_uid, tenant_id, queue_id, contact_id, chat_type,
      status, attempts, last_error, text_preview, payload,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_uid, tenant_id, queue_id)
    DO UPDATE SET
      contact_id = excluded.contact_id,
      chat_type = excluded.chat_type,
      status = excluded.status,
      attempts = excluded.attempts,
      last_error = excluded.last_error,
      text_preview = excluded.text_preview,
      payload = excluded.payload,
      updated_at = excluded.updated_at`,
    [
      scope.ownerUid,
      scope.tenantId,
      message.queueId,
      message.contactId,
      message.chatType || 'DIRECT',
      message.status,
      Math.max(0, Math.round(message.attempts || 0)),
      message.lastError || null,
      message.text.slice(0, 240),
      await encryptJson(message),
      message.createdAt,
      nowIso
    ]
  );
  await removePendingChatMessageFromAsyncStorage(scope, message.queueId).catch(() => undefined);
}

export async function mapSqlitePendingOutboxRow(
  scope: LocalChatScope,
  row: SqlitePendingOutboxRow
): Promise<PendingChatMessage | null> {
  const pendingMessage = await decryptJson<PendingChatMessage>(row.payload).catch(() => null);

  if (
    !pendingMessage ||
    pendingMessage.version !== 1 ||
    pendingMessage.ownerUid !== scope.ownerUid ||
    pendingMessage.tenantId !== scope.tenantId ||
    pendingMessage.queueId !== row.queue_id
  ) {
    return null;
  }

  return {
    ...pendingMessage,
    attempts: Math.max(0, Math.round(row.attempts || pendingMessage.attempts || 0)),
    chatType: row.chat_type === 'GROUP' ? 'GROUP' : 'DIRECT',
    contactId: row.contact_id || pendingMessage.contactId,
    lastError: typeof row.last_error === 'string' ? row.last_error : pendingMessage.lastError,
    status: normalizePendingMessageStatus(row.status) || pendingMessage.status
  };
}

export async function mapSqliteMediaTransferQueueRow(
  scope: LocalChatScope,
  row: SqliteMediaTransferQueueRow
): Promise<LocalChatMediaTransferQueueItem | null> {
  const queueItem = await decryptJson<LocalChatMediaTransferQueueItem>(row.payload).catch(() => null);
  const transferType = normalizeMediaTransferType(row.transfer_type);
  const status = normalizeMediaTransferStatus(row.status);
  const media = normalizeCachedMediaAttachment(queueItem?.media || buildQueuedMediaAttachmentFromRow(row));

  if (
    !queueItem ||
    queueItem.version !== 1 ||
    queueItem.ownerUid !== scope.ownerUid ||
    queueItem.tenantId !== scope.tenantId ||
    queueItem.queueId !== row.queue_id ||
    !transferType ||
    !status ||
    !media
  ) {
    return null;
  }

  return {
    ...queueItem,
    attempts: Math.max(0, Math.round(row.attempts || queueItem.attempts || 0)),
    contactId: row.contact_id || queueItem.contactId,
    lastError: typeof row.last_error === 'string' ? row.last_error : queueItem.lastError,
    media,
    mediaId: row.media_id || media.mediaId || queueItem.mediaId || null,
    mediaIndex: Math.max(0, Math.round(row.media_index || queueItem.mediaIndex || 0)),
    messageId: row.message_id || queueItem.messageId,
    nativeTransferId: normalizeNativeTransferId(row.native_transfer_id) || queueItem.nativeTransferId || null,
    nextRetryAtMs: normalizeNullableTimestampMs(row.next_retry_at_ms ?? queueItem.nextRetryAtMs),
    progress: normalizeTransferProgress(row.progress ?? queueItem.progress),
    status,
    transferType,
    uploadRecovery: normalizeMediaUploadRecoveryState(queueItem.uploadRecovery),
    updatedAt: row.updated_at
  };
}

export async function mapSqliteMediaPreparationQueueRow(
  scope: LocalChatScope,
  row: SqliteMediaPreparationQueueRow
): Promise<LocalChatMediaPreparationQueueItem | null> {
  const queueItem = await decryptJson<LocalChatMediaPreparationQueueItem>(row.payload).catch(() => null);
  const status = normalizeMediaPreparationStatus(row.status);
  const media = normalizeCachedMediaAttachment(queueItem?.media);
  const preparedMedia = queueItem?.preparedMedia
    ? normalizeCachedMediaAttachment(queueItem.preparedMedia)
    : null;
  const assetIdentifier = normalizeNativeAssetIdentifier(row.asset_identifier || queueItem?.assetIdentifier);

  if (
    !queueItem ||
    queueItem.version !== 1 ||
    queueItem.ownerUid !== scope.ownerUid ||
    queueItem.tenantId !== scope.tenantId ||
    queueItem.queueId !== row.queue_id ||
    !status ||
    !media ||
    !assetIdentifier
  ) {
    return null;
  }

  return {
    ...queueItem,
    assetIdentifier,
    attempts: Math.max(0, Math.round(row.attempts || queueItem.attempts || 0)),
    contactId: row.contact_id || queueItem.contactId,
    lastError: typeof row.last_error === 'string' ? row.last_error : queueItem.lastError,
    media,
    mediaIndex: Math.max(0, Math.round(row.media_index || queueItem.mediaIndex || 0)),
    messageId: row.message_id || queueItem.messageId,
    preparedMedia,
    progress: normalizeTransferProgress(row.progress ?? queueItem.progress),
    status,
    updatedAt: row.updated_at
  };
}

export async function hasSqlitePendingOutboxRows(scope: LocalChatScope): Promise<boolean> {
  const db = await getLocalChatSqliteDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM local_chat_outbox
     WHERE owner_uid = ? AND tenant_id = ?`,
    [scope.ownerUid, scope.tenantId]
  );

  return Boolean(row?.count);
}

export async function migratePendingChatMessagesToSqlite(scope: LocalChatScope): Promise<void> {
  const legacyMessages = await listPendingChatMessagesFromAsyncStorage(scope);

  if (!legacyMessages.length) {
    return;
  }

  for (const message of legacyMessages) {
    await upsertPendingChatMessageToSqlite(scope, message);
  }

  await AsyncStorage.removeItem(getOutboxStorageKey(scope)).catch(() => undefined);
}

export async function loadRawCachedChatConversationFromSqlite(input: {
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

export async function loadCachedChatConversationPageFromSqlite(input: {
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

  const limit = normalizeMessagePageLimit(input.limit);
  const beforeSentAtMs = typeof input.beforeSentAtMs === 'number' && Number.isFinite(input.beforeSentAtMs)
    ? input.beforeSentAtMs
    : null;
  const rowLimit = limit + 1;
  const rows = beforeSentAtMs === null
    ? await db.getAllAsync<SqliteMessageRow>(
        `SELECT message_id, sent_at_ms, payload
         FROM local_messages
         WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?
         ORDER BY sent_at_ms DESC, message_id DESC
         LIMIT ?`,
        [scope.ownerUid, scope.tenantId, input.contactId, rowLimit]
      )
    : await db.getAllAsync<SqliteMessageRow>(
        `SELECT message_id, sent_at_ms, payload
         FROM local_messages
         WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ? AND sent_at_ms < ?
         ORDER BY sent_at_ms DESC, message_id DESC
         LIMIT ?`,
        [scope.ownerUid, scope.tenantId, input.contactId, beforeSentAtMs, rowLimit]
      );
  const hasMoreBefore = rows.length > limit;
  const pageRows = rows.slice(0, limit).reverse();
  const [contact, hiddenMessageIds, messages] = await Promise.all([
    conversation.contact_payload
      ? decryptJson<ChatContact>(conversation.contact_payload).catch(() => null)
      : null,
    conversation.hidden_payload
      ? decryptJson<string[]>(conversation.hidden_payload).catch(() => [])
      : [],
    Promise.all(pageRows.map((row) => decryptJson<ChatMessage>(row.payload).catch(() => null)))
  ]);
  const decryptedMessages = messages.filter((message): message is ChatMessage => Boolean(message));
  // Thumbnails come from their own column rather than out of the payload. One
  // query for the page, against an index the table already has, instead of a
  // JavaScript decrypt of tens of kilobytes per message. See
  // localChatThumbnailSplit.
  const thumbnailsByKey = await loadThumbnailsForMessages(
    db,
    scope,
    input.contactId,
    pageRows.map((row) => row.message_id).filter((messageId): messageId is string => Boolean(messageId))
  );
  const normalizedMessages = uniqueMessages(
    decryptedMessages.map((message) => restoreThumbnails(message, thumbnailsByKey))
  );

  return {
    contact,
    contactId: conversation.contact_id,
    hasMoreBefore,
    hiddenMessageIds: Array.isArray(hiddenMessageIds) ? hiddenMessageIds : [],
    messages: normalizedMessages,
    oldestMessageSentAtMs: normalizedMessages.length ? getMessageSentAtMs(normalizedMessages[0]) : null,
    ownerUid: scope.ownerUid,
    tenantId: scope.tenantId,
    updatedAt: conversation.updated_at,
    version: 1
  };
}

/**
 * The thumbnails belonging to one page of messages.
 *
 * Read in a single statement so a page costs one query however many pictures it
 * holds, and returns an empty map rather than failing: a bubble with no still
 * is a small loss, a chat that will not open is not.
 */
async function loadThumbnailsForMessages(
  db: SQLite.SQLiteDatabase,
  scope: LocalChatScope,
  contactId: string,
  messageIds: string[]
): Promise<Map<string, string>> {
  const thumbnails = new Map<string, string>();

  if (!messageIds.length) {
    return thumbnails;
  }

  const placeholders = messageIds.map(() => '?').join(', ');
  const rows = await db.getAllAsync<{
    media_index: number;
    message_id: string;
    thumbnail_data_url: string | null;
  }>(
    `SELECT message_id, media_index, thumbnail_data_url
     FROM local_chat_media
     WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?
       AND message_id IN (${placeholders})
       AND thumbnail_data_url IS NOT NULL`,
    [scope.ownerUid, scope.tenantId, contactId, ...messageIds]
  ).catch(() => []);

  rows.forEach((row) => {
    if (row.thumbnail_data_url) {
      thumbnails.set(
        buildThumbnailKey(row.message_id, Math.max(0, Math.round(row.media_index || 0))),
        row.thumbnail_data_url
      );
    }
  });

  return thumbnails;
}

export async function saveCachedChatConversationToSqlite(input: {
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

  // Only the hidden ids are needed here. Reading the full record instead meant
  // decrypting every cached message — up to a thousand — on every save, which is
  // the same read-everything cost the write skip was added to avoid.
  const existingHiddenMessageIds = await loadCachedHiddenMessageIds(scope, input.contactId);
  const hiddenMessageIds = normalizeHiddenMessageIds([
    ...existingHiddenMessageIds,
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
  const latestMessage = messages[messages.length - 1] || null;
  // The whole thread is handed to every save, but almost none of it has changed.
  // Rewriting it all meant one JS secretbox and several native calls per message
  // on every incoming message and every chat open — seconds of blocked JS thread
  // on a low-end device. Signatures are read straight from the table, so nothing
  // has to be decrypted to work out what to skip.
  const storedSignatures = await loadStoredMessageSignatures(db, scope, input.contactId);
  const writePlan = planLocalChatRowWrites(messages, (message) => message.messageId, storedSignatures);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO local_conversations (
        owner_uid, tenant_id, contact_id, contact_payload, hidden_payload,
        last_message_at_ms, preview, unread_count, is_archived, is_pinned,
        is_favorite, is_spam, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner_uid, tenant_id, contact_id)
      DO UPDATE SET
        contact_payload = excluded.contact_payload,
        hidden_payload = excluded.hidden_payload,
        last_message_at_ms = excluded.last_message_at_ms,
        preview = excluded.preview,
        unread_count = excluded.unread_count,
        is_archived = excluded.is_archived,
        is_pinned = excluded.is_pinned,
        is_favorite = excluded.is_favorite,
        is_spam = excluded.is_spam,
        updated_at = excluded.updated_at`,
      [
        scope.ownerUid,
        scope.tenantId,
        input.contactId,
        contactPayload,
        hiddenPayload,
        latestMessage ? getMessageSentAtMs(latestMessage) : getContactLastMessageAtMs(input.contact as ChatContact),
        getLocalChatPreview(input.contact, latestMessage),
        Math.max(0, Math.round(input.contact?.unreadCount || 0)),
        input.contact?.isArchived === true ? 1 : 0,
        input.contact?.isPinned === true ? 1 : 0,
        input.contact?.isFavorite === true ? 1 : 0,
        input.contact?.isSpam === true ? 1 : 0,
        nowIso
      ]
    );

    if (messageIds.length) {
      const placeholders = messageIds.map(() => '?').join(', ');

      await db.runAsync(
        `DELETE FROM local_messages
         WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?
           AND message_id NOT IN (${placeholders})`,
        [scope.ownerUid, scope.tenantId, input.contactId, ...messageIds]
      );
      await db.runAsync(
        `DELETE FROM local_chat_media
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
      await db.runAsync(
        `DELETE FROM local_chat_media
         WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?`,
        [scope.ownerUid, scope.tenantId, input.contactId]
      );
    }

    for (const message of writePlan.changed) {
      // Sealed without its thumbnails. They go to their own column below, in
      // `replaceCachedMessageMediaRows`, and are put back on the way out. See
      // localChatThumbnailSplit: sealing them here as well is what made a
      // thread holding three videos take a second and a half to persist.
      const payload = await encryptJson(stripThumbnailsForPayload(message));

      await db.runAsync(
        `INSERT INTO local_messages (
          owner_uid, tenant_id, contact_id, message_id, sent_at_ms,
          sender_uid, is_mine, delivery_status, payload, updated_at, content_signature,
          reply_to_message_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(owner_uid, tenant_id, contact_id, message_id)
        DO UPDATE SET
          sent_at_ms = excluded.sent_at_ms,
          sender_uid = excluded.sender_uid,
          is_mine = excluded.is_mine,
          delivery_status = excluded.delivery_status,
          payload = excluded.payload,
          updated_at = excluded.updated_at,
          content_signature = excluded.content_signature,
          reply_to_message_id = excluded.reply_to_message_id`,
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
          nowIso,
          writePlan.signatures.get(message.messageId) || null,
          message.replyTo?.messageId || null
        ]
      );

      await replaceCachedMessageMediaRows(db, scope, input.contactId, message, nowIso);
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
    await db.runAsync(
      `DELETE FROM local_chat_media
       WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?
         AND message_id NOT IN (
           SELECT message_id FROM local_messages
           WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?
         )`,
      [
        scope.ownerUid,
        scope.tenantId,
        input.contactId,
        scope.ownerUid,
        scope.tenantId,
        input.contactId
      ]
    );
  });

  return true;
}

export async function loadCachedChatContactsFromSqlite(scope: LocalChatScope): Promise<ChatContact[]> {
  const db = await getLocalChatSqliteDatabase();
  const rows = await db.getAllAsync<{
    contact_payload: string | null;
  }>(
    `SELECT contact_payload
     FROM local_conversations
     WHERE owner_uid = ? AND tenant_id = ? AND contact_payload IS NOT NULL
     ORDER BY
       COALESCE(last_message_at_ms, 0) DESC,
       updated_at DESC,
       contact_id ASC
     LIMIT ?`,
    [scope.ownerUid, scope.tenantId, LOCAL_CACHED_CHAT_CONTACT_LIMIT]
  );
  const contacts = await Promise.all(rows.map((row) =>
    row.contact_payload ? decryptJson<ChatContact>(row.contact_payload).catch(() => null) : null
  ));

  return normalizeCachedChatContacts(
    contacts.filter((contact): contact is ChatContact => Boolean(contact?.contactId))
  ).filter((contact) => (contact.chatType || 'DIRECT') !== 'GROUP' || contact.conversationId);
}

export async function saveCachedChatContactsToSqlite(
  scope: LocalChatScope,
  contacts: ChatContact[]
): Promise<void> {
  const db = await getLocalChatSqliteDatabase();
  const nowIso = new Date().toISOString();
  const contactIds = contacts.map((contact) => contact.contactId).filter(Boolean);

  await db.withTransactionAsync(async () => {
    if (contactIds.length) {
      const placeholders = contactIds.map(() => '?').join(', ');

      await db.runAsync(
        `UPDATE local_conversations
         SET contact_payload = NULL,
             last_message_at_ms = NULL,
             preview = '',
             unread_count = 0,
             is_archived = 0,
             is_pinned = 0,
             is_favorite = 0,
             is_spam = 0,
             updated_at = ?
         WHERE owner_uid = ? AND tenant_id = ? AND contact_payload IS NOT NULL
           AND contact_id NOT IN (${placeholders})`,
        [nowIso, scope.ownerUid, scope.tenantId, ...contactIds]
      );
    } else {
      await db.runAsync(
        `UPDATE local_conversations
         SET contact_payload = NULL,
             last_message_at_ms = NULL,
             preview = '',
             unread_count = 0,
             is_archived = 0,
             is_pinned = 0,
             is_favorite = 0,
             is_spam = 0,
             updated_at = ?
         WHERE owner_uid = ? AND tenant_id = ? AND contact_payload IS NOT NULL`,
        [nowIso, scope.ownerUid, scope.tenantId]
      );
    }

    for (const contact of contacts) {
      const contactPayload = await encryptJson(contact);

      await db.runAsync(
        `INSERT INTO local_conversations (
          owner_uid, tenant_id, contact_id, contact_payload, hidden_payload,
          last_message_at_ms, preview, unread_count, is_archived, is_pinned,
          is_favorite, is_spam, updated_at
        ) VALUES (?, ?, ?, ?, COALESCE(
          (SELECT hidden_payload FROM local_conversations
           WHERE owner_uid = ? AND tenant_id = ? AND contact_id = ?),
          ?
        ), ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(owner_uid, tenant_id, contact_id)
        DO UPDATE SET
          contact_payload = excluded.contact_payload,
          last_message_at_ms = excluded.last_message_at_ms,
          preview = excluded.preview,
          unread_count = excluded.unread_count,
          is_archived = excluded.is_archived,
          is_pinned = excluded.is_pinned,
          is_favorite = excluded.is_favorite,
          is_spam = excluded.is_spam,
          updated_at = excluded.updated_at`,
        [
          scope.ownerUid,
          scope.tenantId,
          contact.contactId,
          contactPayload,
          scope.ownerUid,
          scope.tenantId,
          contact.contactId,
          await encryptJson([]),
          getContactLastMessageAtMs(contact),
          contact.preview || '',
          Math.max(0, Math.round(contact.unreadCount || 0)),
          contact.isArchived === true ? 1 : 0,
          contact.isPinned === true ? 1 : 0,
          contact.isFavorite === true ? 1 : 0,
          contact.isSpam === true ? 1 : 0,
          nowIso
        ]
      );
    }
  });
}

export async function listCachedChatConversationsFromSqlite(
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

export async function clearSqliteChatDataForOwner(input: {
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
      ),
      db.runAsync(
        'DELETE FROM local_chat_media WHERE owner_uid = ? AND tenant_id = ?',
        [ownerUid, tenantId]
      ),
      db.runAsync(
        'DELETE FROM local_chat_outbox WHERE owner_uid = ? AND tenant_id = ?',
        [ownerUid, tenantId]
      ),
      db.runAsync(
        'DELETE FROM local_chat_media_transfer_queue WHERE owner_uid = ? AND tenant_id = ?',
        [ownerUid, tenantId]
      ),
      db.runAsync(
        'DELETE FROM local_chat_media_preparation_queue WHERE owner_uid = ? AND tenant_id = ?',
        [ownerUid, tenantId]
      ),
      db.runAsync(
        'DELETE FROM local_chat_sync_state WHERE owner_uid = ? AND tenant_id = ?',
        [ownerUid, tenantId]
      )
    ]);
    return;
  }

  await Promise.all([
    db.runAsync('DELETE FROM local_messages WHERE owner_uid = ?', [ownerUid]),
    db.runAsync('DELETE FROM local_conversations WHERE owner_uid = ?', [ownerUid]),
    db.runAsync('DELETE FROM local_chat_media WHERE owner_uid = ?', [ownerUid]),
    db.runAsync('DELETE FROM local_chat_outbox WHERE owner_uid = ?', [ownerUid]),
    db.runAsync('DELETE FROM local_chat_media_transfer_queue WHERE owner_uid = ?', [ownerUid]),
    db.runAsync('DELETE FROM local_chat_media_preparation_queue WHERE owner_uid = ?', [ownerUid]),
    db.runAsync('DELETE FROM local_chat_sync_state WHERE owner_uid = ?', [ownerUid])
  ]);
}

export async function getLocalChatSqliteDatabase(): Promise<SQLite.SQLiteDatabase> {
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
        last_message_at_ms INTEGER,
        preview TEXT,
        unread_count INTEGER NOT NULL DEFAULT 0,
        is_archived INTEGER NOT NULL DEFAULT 0,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        is_spam INTEGER NOT NULL DEFAULT 0,
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
        reply_to_message_id TEXT,
        PRIMARY KEY (owner_uid, tenant_id, contact_id, message_id)
      );
      CREATE TABLE IF NOT EXISTS local_chat_media (
        owner_uid TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        contact_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        media_index INTEGER NOT NULL,
        media_id TEXT,
        kind TEXT NOT NULL,
        content_type TEXT NOT NULL,
        file_name TEXT NOT NULL,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        duration_ms INTEGER,
        width INTEGER,
        height INTEGER,
        thumbnail_local_uri TEXT,
        thumbnail_data_url TEXT,
        plain_local_uri TEXT,
        transfer_status TEXT,
        transfer_progress REAL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (owner_uid, tenant_id, contact_id, message_id, media_index)
      );
      CREATE TABLE IF NOT EXISTS local_chat_outbox (
        owner_uid TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        queue_id TEXT NOT NULL,
        contact_id TEXT NOT NULL,
        chat_type TEXT NOT NULL,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        text_preview TEXT,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (owner_uid, tenant_id, queue_id)
      );
      CREATE TABLE IF NOT EXISTS local_chat_media_transfer_queue (
        owner_uid TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        queue_id TEXT NOT NULL,
        contact_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        media_index INTEGER NOT NULL DEFAULT 0,
        media_id TEXT,
        native_transfer_id TEXT,
        transfer_type TEXT NOT NULL,
        status TEXT NOT NULL,
        progress REAL NOT NULL DEFAULT 0,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        next_retry_at_ms INTEGER,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (owner_uid, tenant_id, queue_id)
      );
      CREATE TABLE IF NOT EXISTS local_chat_media_preparation_queue (
        owner_uid TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        queue_id TEXT NOT NULL,
        contact_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        media_index INTEGER NOT NULL DEFAULT 0,
        asset_identifier TEXT NOT NULL,
        status TEXT NOT NULL,
        progress REAL NOT NULL DEFAULT 0,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (owner_uid, tenant_id, queue_id)
      );
      CREATE TABLE IF NOT EXISTS local_chat_sync_state (
        owner_uid TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        contact_id TEXT NOT NULL,
        latest_server_sent_at_ms INTEGER,
        oldest_local_sent_at_ms INTEGER,
        has_more_before INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (owner_uid, tenant_id, contact_id)
      );
      CREATE INDEX IF NOT EXISTS idx_local_messages_thread_time
        ON local_messages(owner_uid, tenant_id, contact_id, sent_at_ms DESC, message_id DESC);
      CREATE INDEX IF NOT EXISTS idx_local_chat_media_message
        ON local_chat_media(owner_uid, tenant_id, contact_id, message_id, media_index);
      CREATE INDEX IF NOT EXISTS idx_local_chat_media_transfer
        ON local_chat_media(owner_uid, tenant_id, transfer_status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_local_chat_media_contact
        ON local_chat_media(owner_uid, tenant_id, contact_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_local_chat_outbox_status
        ON local_chat_outbox(owner_uid, tenant_id, status, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_local_chat_outbox_contact
        ON local_chat_outbox(owner_uid, tenant_id, contact_id, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_local_chat_media_transfer_queue_status
        ON local_chat_media_transfer_queue(owner_uid, tenant_id, status, next_retry_at_ms, updated_at ASC);
      CREATE INDEX IF NOT EXISTS idx_local_chat_media_transfer_queue_contact
        ON local_chat_media_transfer_queue(owner_uid, tenant_id, contact_id, updated_at ASC);
      CREATE INDEX IF NOT EXISTS idx_local_chat_media_preparation_queue_status
        ON local_chat_media_preparation_queue(owner_uid, tenant_id, status, updated_at ASC);
      CREATE INDEX IF NOT EXISTS idx_local_chat_media_preparation_queue_contact
        ON local_chat_media_preparation_queue(owner_uid, tenant_id, contact_id, updated_at ASC);
    `);
    await ensureLocalConversationColumns(db);
    await ensureLocalMessageColumns(db);
    await ensureLocalMediaTransferQueueColumns(db);
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_local_conversations_owner_time
        ON local_conversations(owner_uid, tenant_id, last_message_at_ms DESC, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_local_conversations_owner_flags
        ON local_conversations(owner_uid, tenant_id, is_spam, is_archived, is_pinned);
      CREATE INDEX IF NOT EXISTS idx_local_chat_sync_state_owner
        ON local_chat_sync_state(owner_uid, tenant_id, updated_at DESC);
    `);

    return db;
  })();

  return sqliteDatabasePromise;
}

/**
 * Adds the content-signature column to cached messages.
 *
 * Without it the skip logic would only work within a single app run, and the
 * first save of every conversation after launch — which is what a chat open
 * triggers — would still rewrite the whole thread.
 */
/**
 * The signature stored against each cached message.
 *
 * Read as plain columns rather than by decrypting payloads — the point is to
 * avoid that work, so paying it here would defeat the exercise.
 */

export async function mapSqliteMediaRow(
  scope: LocalChatScope,
  contactId: string,
  row: SqliteMediaRow
): Promise<LocalCachedChatMediaRecord | null> {
  const decryptedMedia = await decryptJson<ChatMediaAttachment>(row.payload).catch(() => null);
  const storedMedia = decryptedMedia || buildMediaAttachmentFromSqliteRow(row);
  // The payload no longer carries the thumbnail, so it comes from its own
  // column. A row written before the split still has it inside, and that copy
  // wins, so nothing already stored has to be rewritten.
  const media = normalizeCachedMediaAttachment(
    storedMedia && !storedMedia.thumbnailDataUrl && row.thumbnail_data_url
      ? { ...storedMedia, thumbnailDataUrl: row.thumbnail_data_url }
      : storedMedia
  );

  if (!media || !row.message_id) {
    return null;
  }

  return {
    contactId,
    media,
    mediaId: row.media_id || media.mediaId || null,
    mediaIndex: Math.max(0, Math.round(row.media_index || 0)),
    messageId: row.message_id,
    ownerUid: scope.ownerUid,
    tenantId: scope.tenantId,
    updatedAt: row.updated_at,
    version: 1
  };
}

export function buildMediaAttachmentFromSqliteRow(row: SqliteMediaRow): ChatMediaAttachment | null {
  const kind = normalizeMediaKind(row.kind);
  const contentType = typeof row.content_type === 'string' && row.content_type.trim()
    ? row.content_type.trim()
    : null;
  const fileName = typeof row.file_name === 'string' && row.file_name.trim()
    ? row.file_name.trim()
    : null;

  if (!kind || !contentType || !fileName) {
    return null;
  }

  return {
    contentType,
    durationMs: typeof row.duration_ms === 'number' ? row.duration_ms : undefined,
    fileName,
    height: typeof row.height === 'number' ? row.height : undefined,
    kind,
    localUri: resolveLocalChatMediaUri(row.plain_local_uri || '') || undefined,
    mediaId: row.media_id || undefined,
    sizeBytes: typeof row.size_bytes === 'number' ? row.size_bytes : 0,
    thumbnailDataUrl: row.thumbnail_data_url || undefined,
    transferProgress: typeof row.transfer_progress === 'number' ? row.transfer_progress : undefined,
    transferStatus: normalizeMediaTransferStatus(row.transfer_status) || undefined,
    width: typeof row.width === 'number' ? row.width : undefined
  };
}
