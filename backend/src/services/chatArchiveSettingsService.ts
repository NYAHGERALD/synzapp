import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import type { ChatUserPreference } from './chatUserPreferenceService.js';

export type ArchivedNotificationMode = 'ALL_MESSAGES' | 'DIRECT_REPLIES_ONLY' | 'MENTIONS_ONLY' | 'NONE';
export type ArchiveBadgeMode = 'HIDE' | 'MENTIONS_ONLY' | 'UNREAD_COUNT';
export type ArchiveInactiveDuration = 'AFTER_30_DAYS' | 'AFTER_7_DAYS' | 'AFTER_90_DAYS' | 'CUSTOM' | 'NEVER';
export type ArchiveUnreadDisplayMode = 'HIDE' | 'MENTIONS_ONLY' | 'TOTAL_UNREAD';
export type ArchiveUnarchiveBehavior = 'DIRECT_REPLY' | 'MANUAL_ONLY' | 'MENTION' | 'NEW_MESSAGE';

export interface ChatArchiveSettings {
  adminControls: {
    configureRetentionRequirements: boolean;
    preventArchivedChatDeletion: boolean;
    setCompanyWideArchivePolicies: boolean;
    viewArchivedCompanyChats: boolean;
  };
  archiveBadgeMode: ArchiveBadgeMode;
  autoArchiveInactive: ArchiveInactiveDuration;
  archivedNotificationMode: ArchivedNotificationMode;
  customAutoArchiveDays: number | null;
  keepArchivedWhenNewMessagesArrive: boolean;
  smartRules: {
    archiveClosedProjectGroups: boolean;
    archiveDepartedEmployeeChats: boolean;
    archiveInactiveChats: boolean;
    archiveMutedGroupsAfterTime: boolean;
  };
  tenantId: string;
  uid: string;
  unreadDisplayMode: ArchiveUnreadDisplayMode;
  unarchiveBehavior: ArchiveUnarchiveBehavior;
  updatedAt: string | null;
}

export interface UpdateChatArchiveSettingsInput {
  adminControls?: Partial<ChatArchiveSettings['adminControls']>;
  archiveBadgeMode?: ArchiveBadgeMode;
  autoArchiveInactive?: ArchiveInactiveDuration;
  archivedNotificationMode?: ArchivedNotificationMode;
  customAutoArchiveDays?: number | null;
  keepArchivedWhenNewMessagesArrive?: boolean;
  smartRules?: Partial<ChatArchiveSettings['smartRules']>;
  unreadDisplayMode?: ArchiveUnreadDisplayMode;
  unarchiveBehavior?: ArchiveUnarchiveBehavior;
}

interface ChatArchiveSettingsRecord {
  adminControls?: Partial<ChatArchiveSettings['adminControls']>;
  archiveBadgeMode?: ArchiveBadgeMode;
  autoArchiveInactive?: ArchiveInactiveDuration;
  archivedNotificationMode?: ArchivedNotificationMode;
  customAutoArchiveDays?: number | null;
  keepArchivedWhenNewMessagesArrive?: boolean;
  smartRules?: Partial<ChatArchiveSettings['smartRules']>;
  tenantId?: string;
  uid?: string;
  unreadDisplayMode?: ArchiveUnreadDisplayMode;
  unarchiveBehavior?: ArchiveUnarchiveBehavior;
  updatedAtMs?: number | null;
}

export async function getChatArchiveSettings(tenantId: string, uid: string): Promise<ChatArchiveSettings> {
  const snapshot = await getChatArchiveSettingsRef(tenantId, uid).get();

  return normalizeChatArchiveSettings(tenantId, uid, snapshot.exists
    ? snapshot.data() as ChatArchiveSettingsRecord
    : null);
}

export async function updateChatArchiveSettings(
  tenantId: string,
  uid: string,
  input: UpdateChatArchiveSettingsInput
): Promise<ChatArchiveSettings> {
  const current = await getChatArchiveSettings(tenantId, uid);
  const nextKeepArchived = typeof input.keepArchivedWhenNewMessagesArrive === 'boolean'
    ? input.keepArchivedWhenNewMessagesArrive
    : current.keepArchivedWhenNewMessagesArrive;
  const nextUnarchiveBehavior = input.unarchiveBehavior || (
    typeof input.keepArchivedWhenNewMessagesArrive === 'boolean'
      ? input.keepArchivedWhenNewMessagesArrive ? 'MANUAL_ONLY' : 'NEW_MESSAGE'
      : current.unarchiveBehavior
  );
  const update: Record<string, unknown> = {
    tenantId,
    uid,
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtMs: Date.now()
  };

  if (typeof input.keepArchivedWhenNewMessagesArrive === 'boolean' || input.unarchiveBehavior) {
    update.keepArchivedWhenNewMessagesArrive = nextKeepArchived || nextUnarchiveBehavior !== 'NEW_MESSAGE';
    update.unarchiveBehavior = nextUnarchiveBehavior;
  }

  if (input.archivedNotificationMode) {
    update.archivedNotificationMode = input.archivedNotificationMode;
  }

  if (input.unreadDisplayMode) {
    update.unreadDisplayMode = input.unreadDisplayMode;
  }

  if (input.autoArchiveInactive) {
    update.autoArchiveInactive = input.autoArchiveInactive;
  }

  if (input.customAutoArchiveDays !== undefined) {
    update.customAutoArchiveDays = input.customAutoArchiveDays;
  }

  if (input.archiveBadgeMode) {
    update.archiveBadgeMode = input.archiveBadgeMode;
  }

  if (input.smartRules) {
    update.smartRules = {
      ...current.smartRules,
      ...input.smartRules
    };
  }

  if (input.adminControls) {
    update.adminControls = {
      ...current.adminControls,
      ...input.adminControls
    };
  }

  await getChatArchiveSettingsRef(tenantId, uid).set(update, { merge: true });

  return getChatArchiveSettings(tenantId, uid);
}

export function shouldTreatChatAsArchived(
  preference: ChatUserPreference,
  lastMessageSentAtMs: number | null,
  archiveSettings?: ChatArchiveSettings
): boolean {
  if (!preference.isArchived) {
    return false;
  }

  const shouldKeepArchived = !archiveSettings ||
    archiveSettings.keepArchivedWhenNewMessagesArrive ||
    archiveSettings.unarchiveBehavior !== 'NEW_MESSAGE';

  if (shouldKeepArchived) {
    return true;
  }

  if (!lastMessageSentAtMs || !preference.archivedAtMs) {
    return true;
  }

  return lastMessageSentAtMs <= preference.archivedAtMs;
}

function getDefaultChatArchiveSettings(tenantId: string, uid: string): ChatArchiveSettings {
  return {
    adminControls: {
      configureRetentionRequirements: false,
      preventArchivedChatDeletion: false,
      setCompanyWideArchivePolicies: false,
      viewArchivedCompanyChats: false
    },
    archiveBadgeMode: 'UNREAD_COUNT',
    autoArchiveInactive: 'NEVER',
    archivedNotificationMode: 'ALL_MESSAGES',
    customAutoArchiveDays: null,
    keepArchivedWhenNewMessagesArrive: false,
    smartRules: {
      archiveClosedProjectGroups: false,
      archiveDepartedEmployeeChats: false,
      archiveInactiveChats: false,
      archiveMutedGroupsAfterTime: false
    },
    tenantId,
    uid,
    unreadDisplayMode: 'TOTAL_UNREAD',
    unarchiveBehavior: 'NEW_MESSAGE',
    updatedAt: null
  };
}

function normalizeChatArchiveSettings(
  tenantId: string,
  uid: string,
  record: ChatArchiveSettingsRecord | null
): ChatArchiveSettings {
  const defaults = getDefaultChatArchiveSettings(tenantId, uid);
  const updatedAtMs = Number.isFinite(record?.updatedAtMs)
    ? Math.max(Math.round(record?.updatedAtMs || 0), 0)
    : null;
  const unarchiveBehavior = isArchiveUnarchiveBehavior(record?.unarchiveBehavior)
    ? record.unarchiveBehavior
    : defaults.unarchiveBehavior;

  return {
    adminControls: {
      ...defaults.adminControls,
      ...(record?.adminControls || {})
    },
    archiveBadgeMode: isArchiveBadgeMode(record?.archiveBadgeMode)
      ? record.archiveBadgeMode
      : defaults.archiveBadgeMode,
    autoArchiveInactive: isArchiveInactiveDuration(record?.autoArchiveInactive)
      ? record.autoArchiveInactive
      : defaults.autoArchiveInactive,
    archivedNotificationMode: isArchivedNotificationMode(record?.archivedNotificationMode)
      ? record.archivedNotificationMode
      : defaults.archivedNotificationMode,
    customAutoArchiveDays: Number.isFinite(record?.customAutoArchiveDays)
      ? Math.max(Math.round(record?.customAutoArchiveDays || 0), 1)
      : null,
    keepArchivedWhenNewMessagesArrive: record?.keepArchivedWhenNewMessagesArrive === true ||
      unarchiveBehavior !== 'NEW_MESSAGE',
    smartRules: {
      ...defaults.smartRules,
      ...(record?.smartRules || {})
    },
    tenantId,
    uid,
    unreadDisplayMode: isArchiveUnreadDisplayMode(record?.unreadDisplayMode)
      ? record.unreadDisplayMode
      : defaults.unreadDisplayMode,
    unarchiveBehavior,
    updatedAt: updatedAtMs ? new Date(updatedAtMs).toISOString() : null
  };
}

function getChatArchiveSettingsRef(tenantId: string, uid: string) {
  return firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('users')
    .doc(uid)
    .collection('chatSettings')
    .doc('archive');
}

function isArchivedNotificationMode(value: unknown): value is ArchivedNotificationMode {
  return value === 'ALL_MESSAGES' ||
    value === 'DIRECT_REPLIES_ONLY' ||
    value === 'MENTIONS_ONLY' ||
    value === 'NONE';
}

function isArchiveBadgeMode(value: unknown): value is ArchiveBadgeMode {
  return value === 'HIDE' || value === 'MENTIONS_ONLY' || value === 'UNREAD_COUNT';
}

function isArchiveInactiveDuration(value: unknown): value is ArchiveInactiveDuration {
  return value === 'AFTER_30_DAYS' ||
    value === 'AFTER_7_DAYS' ||
    value === 'AFTER_90_DAYS' ||
    value === 'CUSTOM' ||
    value === 'NEVER';
}

function isArchiveUnreadDisplayMode(value: unknown): value is ArchiveUnreadDisplayMode {
  return value === 'HIDE' || value === 'MENTIONS_ONLY' || value === 'TOTAL_UNREAD';
}

function isArchiveUnarchiveBehavior(value: unknown): value is ArchiveUnarchiveBehavior {
  return value === 'DIRECT_REPLY' ||
    value === 'MANUAL_ONLY' ||
    value === 'MENTION' ||
    value === 'NEW_MESSAGE';
}
