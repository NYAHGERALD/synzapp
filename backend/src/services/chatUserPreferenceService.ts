import type { Transaction } from 'firebase-admin/firestore';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';

export type ChatPreferenceChatType = 'DIRECT' | 'GROUP';

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
  uid: string;
}

export interface UpdateChatUserPreferenceInput {
  clear?: boolean;
  isArchived?: boolean;
  isFavorite?: boolean;
  isSpam?: boolean;
  permanentDelete?: boolean;
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
    update.isSpam = input.isSpam;
    update.spammedAt = input.isSpam ? fieldValue.serverTimestamp() : null;
    update.spammedAtMs = input.isSpam ? Date.now() : null;

    if (input.isSpam) {
      update.archivedAt = null;
      update.archivedAtMs = null;
      update.isArchived = false;
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
  transaction.set(getChatUserPreferenceRef(tenantId, uid, chatType, contactId), {
    archivedAt: null,
    archivedAtMs: null,
    chatType,
    contactId,
    isArchived: false,
    isSpam: false,
    permanentlyDeletedAt: null,
    permanentlyDeletedAtMs: null,
    spammedAt: null,
    spammedAtMs: null,
    tenantId,
    uid,
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });
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

  return {
    archivedAtMs,
    chatType,
    clearedAtMs,
    contactId,
    isArchived: record?.isArchived === true,
    isFavorite: record?.isFavorite === true,
    isSpam: record?.isSpam === true,
    spammedAtMs,
    tenantId,
    uid
  };
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
