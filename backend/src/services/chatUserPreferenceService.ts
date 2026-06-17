import type { Transaction } from 'firebase-admin/firestore';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';

export type ChatPreferenceChatType = 'DIRECT' | 'GROUP';

const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export interface ChatTrashSegment {
  deletedAtMs: number;
  endAtMs: number | null;
  expiresAtMs: number;
  segmentId: string;
  startAtMs: number | null;
}

export interface ChatUserPreference {
  archivedAtMs: number | null;
  chatType: ChatPreferenceChatType;
  clearedAtMs: number | null;
  contactId: string;
  isArchived: boolean;
  isFavorite: boolean;
  isSpam: boolean;
  spammedAtMs: number | null;
  tenantId: string;
  trashSegments: ChatTrashSegment[];
  uid: string;
}

export interface UpdateChatUserPreferenceInput {
  clear?: boolean;
  isArchived?: boolean;
  isFavorite?: boolean;
  isSpam?: boolean;
  permanentDelete?: boolean;
  trashSegmentEndAtMs?: number | null;
}

interface ChatUserPreferenceRecord {
  archivedAtMs?: number | null;
  chatType?: ChatPreferenceChatType;
  clearedAtMs?: number | null;
  contactId?: string;
  isArchived?: boolean;
  isFavorite?: boolean;
  isSpam?: boolean;
  spammedAtMs?: number | null;
  tenantId?: string;
  trashSegments?: unknown;
  uid?: string;
}

export function buildChatPreferenceKey(
  chatType: ChatPreferenceChatType,
  contactId: string
): string {
  return `${chatType}:${contactId}`;
}

export function getDefaultChatUserPreference(
  tenantId: string,
  uid: string,
  chatType: ChatPreferenceChatType,
  contactId: string
): ChatUserPreference {
  return {
    archivedAtMs: null,
    chatType,
    clearedAtMs: null,
    contactId,
    isArchived: false,
    isFavorite: false,
    isSpam: false,
    spammedAtMs: null,
    tenantId,
    trashSegments: [],
    uid
  };
}

export async function getChatUserPreference(
  tenantId: string,
  uid: string,
  chatType: ChatPreferenceChatType,
  contactId: string
): Promise<ChatUserPreference> {
  const snapshot = await getChatUserPreferenceRef(tenantId, uid, chatType, contactId).get();

  return normalizeChatUserPreference(
    tenantId,
    uid,
    chatType,
    contactId,
    snapshot.exists ? snapshot.data() as ChatUserPreferenceRecord : null
  );
}

export async function listChatUserPreferences(
  tenantId: string,
  uid: string
): Promise<Map<string, ChatUserPreference>> {
  const snapshot = await firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('users')
    .doc(uid)
    .collection('chatPreferences')
    .get();
  const preferences = new Map<string, ChatUserPreference>();

  snapshot.docs.forEach((doc) => {
    const record = doc.data() as ChatUserPreferenceRecord;
    const chatType = record.chatType === 'GROUP' ? 'GROUP' : record.chatType === 'DIRECT' ? 'DIRECT' : null;
    const contactId = typeof record.contactId === 'string' && record.contactId.trim()
      ? record.contactId.trim()
      : '';

    if (!chatType || !contactId || record.tenantId !== tenantId || record.uid !== uid) {
      return;
    }

    preferences.set(
      buildChatPreferenceKey(chatType, contactId),
      normalizeChatUserPreference(tenantId, uid, chatType, contactId, record)
    );
  });

  return preferences;
}

export async function updateChatUserPreference(
  tenantId: string,
  uid: string,
  chatType: ChatPreferenceChatType,
  contactId: string,
  input: UpdateChatUserPreferenceInput
): Promise<ChatUserPreference> {
  const ref = getChatUserPreferenceRef(tenantId, uid, chatType, contactId);
  const existingRecord = input.isSpam === true
    ? (await ref.get()).data() as ChatUserPreferenceRecord | undefined
    : undefined;
  const existingPreference = existingRecord
    ? normalizeChatUserPreference(tenantId, uid, chatType, contactId, existingRecord)
    : null;
  const update: Record<string, unknown> = {
    chatType,
    contactId,
    tenantId,
    uid,
    updatedAt: fieldValue.serverTimestamp()
  };

  if (typeof input.isArchived === 'boolean') {
    const archivedAtMs = input.isArchived ? Date.now() : null;

    update.archivedAt = input.isArchived ? fieldValue.serverTimestamp() : null;
    update.archivedAtMs = archivedAtMs;
    update.isArchived = input.isArchived;
  }

  if (typeof input.isFavorite === 'boolean') {
    update.isFavorite = input.isFavorite;
  }

  if (typeof input.isSpam === 'boolean') {
    const trashedAtMs = Date.now();

    update.isSpam = input.isSpam;
    update.spammedAt = input.isSpam ? fieldValue.serverTimestamp() : null;
    update.spammedAtMs = input.isSpam ? trashedAtMs : null;

    if (input.isSpam) {
      const segmentEndAtMs = normalizeOptionalTimestamp(input.trashSegmentEndAtMs) || trashedAtMs;

      update.archivedAt = null;
      update.archivedAtMs = null;
      update.clearedAt = fieldValue.serverTimestamp();
      update.clearedAtMs = trashedAtMs;
      update.isArchived = false;
      update.permanentlyDeletedAt = null;
      update.permanentlyDeletedAtMs = null;
      update.trashSegments = fieldValue.arrayUnion({
        deletedAtMs: trashedAtMs,
        endAtMs: segmentEndAtMs,
        expiresAtMs: trashedAtMs + TRASH_RETENTION_MS,
        segmentId: buildTrashSegmentId(trashedAtMs),
        startAtMs: existingPreference?.clearedAtMs || null
      });
    } else {
      update.permanentlyDeletedAt = null;
      update.permanentlyDeletedAtMs = null;
    }
  }

  if (input.clear) {
    update.archivedAt = null;
    update.archivedAtMs = null;
    update.clearedAt = fieldValue.serverTimestamp();
    update.clearedAtMs = Date.now();
    update.isArchived = false;
  }

  if (input.permanentDelete) {
    const deletedAtMs = Date.now();

    update.clearedAt = fieldValue.serverTimestamp();
    update.clearedAtMs = deletedAtMs;
    update.archivedAt = null;
    update.archivedAtMs = null;
    update.isArchived = false;
    update.isFavorite = false;
    update.isSpam = false;
    update.permanentlyDeletedAt = fieldValue.serverTimestamp();
    update.permanentlyDeletedAtMs = deletedAtMs;
    update.spammedAt = null;
    update.spammedAtMs = null;
    update.trashSegments = [];
  }

  await ref.set(update, { merge: true });

  return getChatUserPreference(tenantId, uid, chatType, contactId);
}

export function unarchiveChatUserPreferenceInTransaction(
  transaction: Transaction,
  tenantId: string,
  uid: string,
  chatType: ChatPreferenceChatType,
  contactId: string
): void {
  reviveChatUserPreferenceInTransaction(transaction, tenantId, uid, chatType, contactId, {
    unarchive: true
  });
}

export function reviveChatUserPreferenceInTransaction(
  transaction: Transaction,
  tenantId: string,
  uid: string,
  chatType: ChatPreferenceChatType,
  contactId: string,
  options: {
    unarchive?: boolean;
  } = {}
): void {
  const update: Record<string, unknown> = {
    chatType,
    contactId,
    isSpam: false,
    permanentlyDeletedAt: null,
    permanentlyDeletedAtMs: null,
    spammedAt: null,
    spammedAtMs: null,
    tenantId,
    uid,
    updatedAt: fieldValue.serverTimestamp()
  };

  if (options.unarchive) {
    update.archivedAt = null;
    update.archivedAtMs = null;
    update.isArchived = false;
  }

  transaction.set(getChatUserPreferenceRef(tenantId, uid, chatType, contactId), update, { merge: true });
}

function normalizeChatUserPreference(
  tenantId: string,
  uid: string,
  chatType: ChatPreferenceChatType,
  contactId: string,
  record: ChatUserPreferenceRecord | null
): ChatUserPreference {
  const archivedAtMs = Number.isFinite(record?.archivedAtMs)
    ? Math.max(Math.round(record?.archivedAtMs || 0), 0)
    : null;
  const clearedAtMs = Number.isFinite(record?.clearedAtMs)
    ? Math.max(Math.round(record?.clearedAtMs || 0), 0)
    : null;
  const spammedAtMs = Number.isFinite(record?.spammedAtMs)
    ? Math.max(Math.round(record?.spammedAtMs || 0), 0)
    : null;
  const trashSegments = normalizeTrashSegments(record?.trashSegments);
  const isLegacyTrashActive = record?.isSpam === true &&
    (!spammedAtMs || spammedAtMs + TRASH_RETENTION_MS > Date.now());

  return {
    archivedAtMs,
    chatType,
    clearedAtMs,
    contactId,
    isArchived: record?.isArchived === true,
    isFavorite: record?.isFavorite === true,
    isSpam: isLegacyTrashActive,
    spammedAtMs,
    tenantId,
    trashSegments,
    uid
  };
}

function normalizeOptionalTimestamp(value: unknown): number | null {
  return Number.isFinite(value)
    ? Math.max(Math.round(Number(value)), 0)
    : null;
}

function normalizeTrashSegments(value: unknown): ChatTrashSegment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const nowMs = Date.now();

  return value
    .map((segment): ChatTrashSegment | null => {
      if (!segment || typeof segment !== 'object') {
        return null;
      }

      const record = segment as Record<string, unknown>;
      const deletedAtMs = normalizeOptionalTimestamp(record.deletedAtMs);
      const expiresAtMs = normalizeOptionalTimestamp(record.expiresAtMs);
      const segmentId = typeof record.segmentId === 'string' && record.segmentId.trim()
        ? record.segmentId.trim()
        : '';

      if (!deletedAtMs || !expiresAtMs || expiresAtMs <= nowMs || !segmentId) {
        return null;
      }

      return {
        deletedAtMs,
        endAtMs: normalizeOptionalTimestamp(record.endAtMs),
        expiresAtMs,
        segmentId,
        startAtMs: normalizeOptionalTimestamp(record.startAtMs)
      };
    })
    .filter((segment): segment is ChatTrashSegment => Boolean(segment))
    .sort((first, second) => second.deletedAtMs - first.deletedAtMs);
}

function buildTrashSegmentId(deletedAtMs: number): string {
  return `trash_${deletedAtMs}_${Math.random().toString(36).slice(2, 10)}`;
}

function getChatUserPreferenceRef(
  tenantId: string,
  uid: string,
  chatType: ChatPreferenceChatType,
  contactId: string
) {
  return firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('users')
    .doc(uid)
    .collection('chatPreferences')
    .doc(`${chatType}_${sanitizePreferenceId(contactId)}`);
}

function sanitizePreferenceId(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160);
}
