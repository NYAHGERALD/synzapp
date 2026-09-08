import type { LswDailyTask, LswDayKey, LswFollowUpSummary, LswTodoTaskSummary, LswWorkspaceContext } from '../services/lswApi';
import { Alert, Platform, Switch } from 'react-native';
import { ChatArchiveSettings, ChatContact, ChatMessage, ChatMessageReaction, ChatMessageReactionMap, ChatNotificationMuteMode, ChatReplyReference } from '../services/chatApi';
import { ChatBackupPolicy } from '../services/chatBackup';
import { ChatItem } from '../components/groups/GroupInfoModal';
import { isDepartmentChat, mustAlwaysAppearInChatList } from './departmentChatVisibility';
import { ChatListFilter } from '../components/chatList/ChatsTab';
import { ClearChatSummary } from '../components/chatList/ClearChatModal';
import { CompanyKeyResultsConfig, TenantDepartment, TenantGroup, TenantRole } from '../services/adminApi';
import { CurrentUserDialIdentity } from '../components/calls/CallKeypadModal';
import { CurrentUserProfile } from '../services/profileApi';
import { DirectoryFilter } from '../components/settings/DirectorySettings';
import { FooterTab, GuidedSetupTargetKind, GuidedSetupTargetRect, OrgAdminSetupCoachStep } from '../components/guidedSetup/GuidedSetupCoachOverlay';
import { LSW_DAY_KEYS, LswWorkspaceTab } from '../components/lsw/LswWorkspaceScreen';
import { LSW_WORKSPACE_TABS } from '../components/lsw/LswWorkspaceTabMenu';
import { TranscriptLanguageOption } from '../components/contacts/ContactInfoModal';
import { WebRtcRuntime } from '../components/calls/SynzappCallOverlay';
import { formatPhoneNumberForInviteDisplay } from '../components/invites/InviteDraftPanel';
import { formatReplyPreviewText, normalizeSearchQuery } from '../components/messages/MessageThread';
import { getActiveTrashSegments } from '../components/chatList/SpamChatRow';
import { getChatMessagePreview, getChatMessageTextPreview } from '../services/chatMessagePreview';
import { getMediaItemsSize, hasClearableLocalMedia } from '../services/chatMediaSupport';
import { getMessageMedia, getMessageMediaItems, toChatImageAttachment, uniqueChatMessages } from '../services/chatMessageReconciliation';

/**
 * What is left of the chat screen that is not the screen.
 *
 * Reactions, backup policy, RAILS eligibility, the setup coach, archive
 * defaults, and the small formatters around them. Grouped by having survived
 * every other extraction rather than by belonging together — they are here so
 * the screen file holds a screen, and each is now reachable from a test.
 */

export type ChatMoreActionTarget = ChatItem | null;

export type SettingsScreen = 'list' | 'directory' | 'security' | 'chat-backup' | 'offline-chat' | 'my-devices' | 'company-profile' | 'key-results' | 'dept-admin-permissions' | 'groups' | 'role-permissions' | 'ai-usage' | 'scheduled-messages' | 'action-reminders' | 'admin-contact';

export type UserPermission =
  | 'announcements.send'
  | 'tenant.update'
  | 'users.invite'
  | 'users.manage'
  | 'departments.manage'
  | 'groups.create'
  | 'groups.manage'
  | 'roles.manage'
  | 'security.manage';

export const DEFAULT_CHAT_BACKUP_POLICY: ChatBackupPolicy = {
  adminApprovalRequired: true,
  encryptedBackupsEnabled: false,
  recoveryKeyRequired: true,
  selfRestoreEnabled: false,
  updatedAt: null,
  updatedByUid: null
};

export const defaultKeyResultsConfig: CompanyKeyResultsConfig = {
  groups: [],
  units: [
    { icon: 'hash', label: 'Number', sortOrder: 1000, status: 'ACTIVE', suffix: '', unitId: 'unit_number' },
    { icon: 'bar-chart-2', label: 'Million', sortOrder: 2000, status: 'ACTIVE', suffix: 'Million', unitId: 'unit_million' },
    { icon: 'calendar', label: 'Per Month', sortOrder: 3000, status: 'ACTIVE', suffix: '/Month', unitId: 'unit_per_month' },
    { icon: 'clock', label: 'Per Day', sortOrder: 4000, status: 'ACTIVE', suffix: '/Day', unitId: 'unit_per_day' },
    { icon: 'calendar', label: 'Per Year', sortOrder: 5000, status: 'ACTIVE', suffix: '/Year', unitId: 'unit_per_year' }
  ],
  updatedAt: null,
  updatedByUid: null
};

export const emptyClearChatSummary: ClearChatSummary = {
  mediaFileCount: 0,
  mediaSizeBytes: 0,
  messageCount: 0,
  textSizeBytes: 0,
  totalSizeBytes: 0
};

export interface ChatBackupPolicyConfirmation {
  confirmText: string;
  message: string;
  style?: 'default' | 'destructive';
  title: string;
}

export function getChatBackupPolicyConfirmation(
  currentPolicy: ChatBackupPolicy,
  nextPolicy: Pick<ChatBackupPolicy, 'encryptedBackupsEnabled' | 'selfRestoreEnabled'>
): ChatBackupPolicyConfirmation | null {
  const encryptedBackupChanged = currentPolicy.encryptedBackupsEnabled !== nextPolicy.encryptedBackupsEnabled;
  const selfRestoreChanged = currentPolicy.selfRestoreEnabled !== nextPolicy.selfRestoreEnabled;

  if (!encryptedBackupChanged && !selfRestoreChanged) {
    return null;
  }

  if (encryptedBackupChanged && !nextPolicy.encryptedBackupsEnabled) {
    return {
      confirmText: 'Disable',
      message: 'Users will not be able to upload new encrypted chat backups. Self-service restore will also be turned off.',
      style: 'destructive',
      title: 'Disable encrypted backup?'
    };
  }

  if (encryptedBackupChanged && nextPolicy.encryptedBackupsEnabled) {
    return {
      confirmText: 'Enable',
      message: 'Encrypted chat backups will store ciphertext only. Users still need their recovery key to restore.',
      title: 'Enable encrypted backup?'
    };
  }

  if (selfRestoreChanged && nextPolicy.selfRestoreEnabled) {
    return {
      confirmText: 'Enable',
      message: 'Active users with the correct recovery key can restore their encrypted chat backup on a registered device.',
      title: 'Enable self-service restore?'
    };
  }

  return {
    confirmText: 'Require approval',
    message: 'Users will need organization approval before restoring encrypted chat backups on a registered device.',
    title: 'Require restore approval?'
  };
}

export type NewGroupFlowOrigin = 'contactInfo' | 'groupSwitcher' | 'newChat';

export const chatNotificationMuteOptions: Array<{
  label: string;
  value: ChatNotificationMuteMode;
}> = [
  { label: 'No', value: 'off' },
  { label: '8 hours', value: '8h' },
  { label: '1 week', value: '1w' },
  { label: 'Always', value: 'always' }
];

export const defaultChatArchiveSettings: ChatArchiveSettings = {
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
  unreadDisplayMode: 'TOTAL_UNREAD',
  unarchiveBehavior: 'NEW_MESSAGE',
  updatedAt: null
};

export function getCurrentUserDialIdentity(
  profile: CurrentUserProfile | null,
  fallbackPhoneNumber: string
): CurrentUserDialIdentity {
  const formattedFallbackPhone = formatPhoneNumberForInviteDisplay(fallbackPhoneNumber);

  return {
    phoneFormatted: profile?.phoneFormatted || formattedFallbackPhone,
    profilePhotoUrl: profile?.profilePhotoUrl || null,
    roleName: profile?.roleName || 'Current user'
  };
}

export function normalizeKeyResultsForDraft(config: CompanyKeyResultsConfig): CompanyKeyResultsConfig {
  const units = Array.isArray(config.units) ? config.units : defaultKeyResultsConfig.units;

  return {
    groups: (config.groups || []).map((group, groupIndex) => ({
      ...group,
      metrics: (group.metrics || []).map((metric, metricIndex) => ({
        ...metric,
        sortOrder: metric.sortOrder || ((metricIndex + 1) * 1000),
        status: metric.status || 'ACTIVE',
        unitId: units.some((unit) => unit.unitId === metric.unitId) ? metric.unitId : units[0]?.unitId || 'unit_number'
      })),
      sortOrder: group.sortOrder || ((groupIndex + 1) * 1000),
      status: group.status || 'ACTIVE'
    })),
    units: units.map((unit, index) => ({
      ...unit,
      icon: unit.icon || 'hash',
      sortOrder: unit.sortOrder || ((index + 1) * 1000),
      status: unit.status || 'ACTIVE',
      suffix: unit.suffix || ''
    })),
    updatedAt: config.updatedAt || null,
    updatedByUid: config.updatedByUid || null
  };
}

export function createKeyResultLocalId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function sortLswDailyTasks(tasks: LswDailyTask[]): LswDailyTask[] {
  return [...tasks].sort((first, second) => first.sortOrder - second.sortOrder || first.task.localeCompare(second.task));
}

export function sortLswTodoTasks(tasks: LswTodoTaskSummary[]): LswTodoTaskSummary[] {
  return [...tasks].sort((first, second) =>
    Number(first.completed) - Number(second.completed) ||
    first.dueDate.localeCompare(second.dueDate) ||
    first.dueTime.localeCompare(second.dueTime) ||
    first.sortOrder - second.sortOrder
  );
}

export function sortLswFollowUps(followUps: LswFollowUpSummary[]): LswFollowUpSummary[] {
  return [...followUps].sort((first, second) =>
    first.dueDate.localeCompare(second.dueDate) ||
    first.sortOrder - second.sortOrder ||
    first.followUp.localeCompare(second.followUp)
  );
}

export function replaceLswRecord<T, K extends keyof T>(records: T[], nextRecord: T, key: K): T[] {
  return records.map((record) => record[key] === nextRecord[key] ? nextRecord : record);
}

export function getAllLswTaskDays(): Partial<Record<LswDayKey, boolean>> {
  return LSW_DAY_KEYS.reduce<Partial<Record<LswDayKey, boolean>>>((days, dayKey) => {
    days[dayKey] = true;
    return days;
  }, {});
}

export function getLswWorkspaceTabLabel(tab: LswWorkspaceTab): string {
  return LSW_WORKSPACE_TABS.find(([value]) => value === tab)?.[1] || 'Today';
}

export function formatLocalTimeOnly(date: Date): string {
  return `${date.getHours()}`.padStart(2, '0') + ':' + `${date.getMinutes()}`.padStart(2, '0');
}

export function getLswSelectedYear(context: LswWorkspaceContext | null): number | undefined {
  return context?.week.selectedYear ?? context?.week.year;
}

export function normalizeLswTimeInput(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const hours = Number.parseInt(match[1] || '', 10);
  const minutes = Number.parseInt(match[2] || '', 10);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return `${hours}`.padStart(2, '0') + ':' + `${minutes}`.padStart(2, '0');
}

export function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function promptForRequiredText(title: string, message: string, defaultValue = '', confirmText = 'Save'): Promise<string | null> {
  return new Promise((resolve) => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        title,
        message,
        [
          { style: 'cancel', text: 'Cancel', onPress: () => resolve(null) },
          {
            text: confirmText,
            onPress: (value?: string) => {
              const trimmedValue = (value || '').trim();
              resolve(trimmedValue.length ? trimmedValue : null);
            }
          }
        ],
        'plain-text',
        defaultValue
      );
      return;
    }

    Alert.alert(title, `${message}\n\nText entry is available on iOS in this build.`);
    resolve(null);
  });
}

export function confirmDestructiveAction(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { style: 'cancel', text: 'Cancel', onPress: () => resolve(false) },
      { style: 'destructive', text: 'Delete', onPress: () => resolve(true) }
    ], { onDismiss: () => resolve(false) });
  });
}

export function sortByName<T extends { name: string }>(records: T[]): T[] {
  return [...records].sort((first, second) => first.name.localeCompare(second.name));
}

export function hasPermission(permissions: string[], permission: UserPermission): boolean {
  return permissions.includes(permission);
}

export function getCompactLanguageLabel(option: TranscriptLanguageOption): string {
  return option.label.replace(/\s*\([^)]*\)/g, '').trim() || option.label;
}

export function getSynzappWebRtcRuntime(): WebRtcRuntime {
  try {
    const runtime = require('react-native-webrtc') as WebRtcRuntime;

    if (!runtime?.RTCPeerConnection || !runtime.mediaDevices?.getUserMedia) {
      throw new Error('Calling is not available in this installed build.');
    }

    return runtime;
  } catch {
    throw new Error('Please install the latest Synzapp development build to use secure calls.');
  }
}

export function createRtcSessionDescription(runtime: WebRtcRuntime, payload: unknown): unknown {
  return runtime.RTCSessionDescription ? new runtime.RTCSessionDescription(payload) : payload;
}

export function createRtcIceCandidate(runtime: WebRtcRuntime, payload: unknown): unknown {
  return runtime.RTCIceCandidate ? new runtime.RTCIceCandidate(payload) : payload;
}

export function omitRecordKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const nextRecord = { ...record };
  delete nextRecord[key];
  return nextRecord;
}

export function isRecipientDeviceNotReadyError(error: unknown): boolean {
  return error instanceof Error &&
    /recipient.*active device|does not have an active device|group members need to open synzapp/i.test(error.message);
}

export function isNetworkUnavailableError(error: unknown): boolean {
  return error instanceof Error &&
    /network request failed|failed to fetch|networkerror|internet connection|offline|timed out|connection/i.test(error.message);
}

export function isChatUnavailableForCurrentUserError(error: unknown): boolean {
  return error instanceof Error &&
    /chat.*not found|not available for your account|no longer have access|not a member|access.*group/i.test(error.message);
}

export function getRecipientDeviceNotReadyMessage(name: string): string {
  return `${name} needs to open Synzapp once before encrypted chat is available.`;
}

export function getChatDeviceNotReadyMessage(chat: ChatItem): string {
  if (chat.chatType === 'GROUP') {
    return `Group members need to open Synzapp once before encrypted chat is available in ${chat.title}.`;
  }

  return getRecipientDeviceNotReadyMessage(chat.title);
}

export function isRealtimeSessionVerificationError(message: string): boolean {
  return /realtime session could not be verified|secure session could not be verified/i.test(message);
}

export function extractReactionMapFromMessages(messages: ChatMessage[]): ChatMessageReactionMap {
  const reactionMap: ChatMessageReactionMap = {};

  messages.forEach((message) => {
    if (message.reactions?.length) {
      reactionMap[message.messageId] = sortMessageReactions(message.reactions);
    }
  });

  return reactionMap;
}

export function applyReactionMapToMessages(
  messages: ChatMessage[],
  reactionMap: ChatMessageReactionMap
): ChatMessage[] {
  return messages.map((message) => ({
    ...message,
    reactions: reactionMap[message.messageId] || []
  }));
}

export function upsertMessageReaction(
  reactionMap: ChatMessageReactionMap,
  messageId: string,
  uid: string,
  emoji: string
): ChatMessageReactionMap {
  const safeEmoji = emoji.trim();
  const nextReactionMap: ChatMessageReactionMap = { ...reactionMap };
  const currentMessageReactions = nextReactionMap[messageId] || [];
  const hasCurrentEmoji = currentMessageReactions.some((reaction) =>
    reaction.uid === uid && reaction.emoji === safeEmoji
  );
  const reactionsWithoutCurrentEmoji = currentMessageReactions.filter((reaction) =>
    !(reaction.uid === uid && reaction.emoji === safeEmoji)
  );

  if (!safeEmoji) {
    const reactionsWithoutCurrentUser = currentMessageReactions.filter((reaction) => reaction.uid !== uid);

    if (reactionsWithoutCurrentUser.length) {
      nextReactionMap[messageId] = reactionsWithoutCurrentUser;
    } else {
      delete nextReactionMap[messageId];
    }

    return nextReactionMap;
  }

  if (hasCurrentEmoji) {
    if (reactionsWithoutCurrentEmoji.length) {
      nextReactionMap[messageId] = sortMessageReactions(reactionsWithoutCurrentEmoji);
    } else {
      delete nextReactionMap[messageId];
    }

    return nextReactionMap;
  }

  const currentUserReactions = reactionsWithoutCurrentEmoji.filter((reaction) => reaction.uid === uid);
  const otherUserReactions = reactionsWithoutCurrentEmoji.filter((reaction) => reaction.uid !== uid);
  const nextCurrentUserReactions = [
    ...currentUserReactions,
    {
      emoji: safeEmoji,
      reactedAt: new Date().toISOString(),
      uid
    }
  ].slice(-12);

  nextReactionMap[messageId] = sortMessageReactions([
    ...otherUserReactions,
    ...nextCurrentUserReactions
  ]);

  return nextReactionMap;
}

export function sortMessageReactions(reactions: ChatMessageReaction[]): ChatMessageReaction[] {
  return [...reactions].sort((first, second) => first.reactedAt.localeCompare(second.reactedAt));
}

export function buildReplyReference(message: ChatMessage): ChatReplyReference {
  return {
    messageId: message.messageId,
    senderUid: message.senderUid,
    sentAt: message.sentAt,
    text: formatReplyPreviewText(getChatMessagePreview(message)).slice(0, 500)
  };
}

export function isOrgAdminSetupCoachEligible(input: {
  canInviteEmployees: boolean;
  canManageDirectory: boolean;
  ownerUid: string;
  tenantId: string;
}): boolean {
  return Boolean(input.ownerUid && input.tenantId && input.canManageDirectory && input.canInviteEmployees);
}

export function isGuidedSetupAssignableDepartment(department: TenantDepartment): boolean {
  if (department.status === 'DELETED') {
    return false;
  }

  const normalizedName = normalizeGuidedSetupRecordName(department.name);

  return normalizedName !== 'human resource' && normalizedName !== 'human resources';
}

export function isGuidedSetupAssignableRole(role: TenantRole): boolean {
  if (role.status !== 'ACTIVE') {
    return false;
  }

  const normalizedName = normalizeGuidedSetupRecordName(role.name);

  return normalizedName !== 'org admin' &&
    normalizedName !== 'organization admin' &&
    normalizedName !== 'organization administrator';
}

export function normalizeGuidedSetupRecordName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function getOrgAdminSetupCoachStep(input: {
  activeTab: FooterTab;
  canInviteEmployees: boolean;
  canManageDirectory: boolean;
  canManageGroups: boolean;
  chatCount: number;
  departments: TenantDepartment[];
  directoryFilter: DirectoryFilter;
  employeeCount: number;
  groups: TenantGroup[];
  roles: TenantRole[];
  settingsScreen: SettingsScreen;
}): OrgAdminSetupCoachStep | null {
  if (!input.canManageDirectory || !input.canInviteEmployees || input.chatCount > 0) {
    return null;
  }

  const hasDepartment = input.departments.some(isGuidedSetupAssignableDepartment);
  const hasRole = input.roles.some(isGuidedSetupAssignableRole);
  const hasEmployee = input.employeeCount > 0;

  if (!hasDepartment) {
    const isOnTarget = input.activeTab === 'Settings' &&
      input.settingsScreen === 'directory' &&
      input.directoryFilter === 'Departments';

    return {
      body: isOnTarget
        ? 'Tap the plus button to create a department such as Operations, Maintenance, Quality, or Leadership.'
        : 'Start by creating a department. Employees need a department before they can be invited into the company workspace.',
      id: 'department',
      primaryLabel: isOnTarget ? 'Add department' : 'Open departments',
      progressLabel: 'Step 1 of 4',
      targetKind: isOnTarget ? 'floating-add' : 'settings-tab',
      title: 'Create your first department'
    };
  }

  if (!hasRole) {
    const isOnTarget = input.activeTab === 'Settings' &&
      input.settingsScreen === 'directory' &&
      input.directoryFilter === 'Roles';

    return {
      body: isOnTarget
        ? 'Switch to Roles if needed, then tap the plus button to create the first role employees can be assigned to.'
        : 'Create a role so Synzapp can assign the right access when you invite employees.',
      id: 'role',
      primaryLabel: isOnTarget ? 'Add role' : 'Open roles',
      progressLabel: 'Step 2 of 4',
      targetKind: isOnTarget ? 'floating-add' : 'settings-tab',
      title: 'Create your first role'
    };
  }

  if (!hasEmployee) {
    const isOnTarget = input.activeTab === 'Employees';

    return {
      body: isOnTarget
        ? 'Add the first employee by phone number, then Synzapp will assign the department and role you created.'
        : 'Now invite your first employee. They will appear in the company and can start secure chats after joining.',
      id: 'employee',
      primaryLabel: isOnTarget ? 'Add employee' : 'Open employees',
      progressLabel: 'Step 3 of 4',
      targetKind: isOnTarget ? 'header-options' : 'employees-tab',
      title: 'Invite your first employee'
    };
  }

  return {
    body: 'Your company structure is ready. Return to Chats and start communicating as employees join.',
    id: 'chat-ready',
    primaryLabel: 'Go to chats',
    progressLabel: 'Step 4 of 4',
    targetKind: input.activeTab === 'Chats' ? 'screen-center' : 'chats-tab',
    title: 'Synzapp is ready to chat'
  };
}

export function getGuidedSetupFooterTargetKind(tab: FooterTab): GuidedSetupTargetKind | null {
  if (tab === 'Chats') {
    return 'chats-tab';
  }

  if (tab === 'Employees') {
    return 'employees-tab';
  }

  if (tab === 'Groups') {
    return 'groups-tab';
  }

  if (tab === 'Settings') {
    return 'settings-tab';
  }

  return null;
}

export function normalizeGuidedSetupMeasuredRect(rect: GuidedSetupTargetRect): GuidedSetupTargetRect {
  const minSize = 54;
  const width = Math.max(rect.width, minSize);
  const height = Math.max(rect.height, minSize);
  const x = rect.x - Math.max((width - rect.width) / 2, 0);
  const y = rect.y - Math.max((height - rect.height) / 2, 0);

  return {
    height,
    radius: Math.min(width, height) / 2,
    width,
    x,
    y
  };
}

export function markChatMessageSendFailed(message: ChatMessage): ChatMessage {
  const mediaItems = getMessageMediaItems(message);
  const media = getMessageMedia(message);
  const failedMediaItems = mediaItems.map((mediaItem) => ({
    ...mediaItem,
    transferProgress: mediaItem.transferProgress || 0,
    transferStatus: 'failed' as const
  }));
  const failedMedia = media
    ? {
        ...media,
        transferProgress: media.transferProgress || 0,
        transferStatus: 'failed' as const
      }
    : failedMediaItems[0] || null;

  return {
    ...message,
    deliveryStatus: 'queued',
    image: failedMedia?.kind === 'image'
      ? toChatImageAttachment(failedMedia)
      : null,
    media: failedMedia,
    mediaItems: failedMediaItems.length ? failedMediaItems : []
  };
}

export function buildClearChatSummary(messages: ChatMessage[]): ClearChatSummary {
  const uniqueMessagesForSummary = uniqueChatMessages(messages);
  let mediaFileCount = 0;
  let mediaSizeBytes = 0;
  let allMediaSizeBytes = 0;
  let textSizeBytes = 0;

  uniqueMessagesForSummary.forEach((message) => {
    const mediaItems = getMessageMediaItems(message);
    const localMediaItems = mediaItems.filter(hasClearableLocalMedia);

    mediaFileCount += localMediaItems.length;
    mediaSizeBytes += getMediaItemsSize(localMediaItems);
    allMediaSizeBytes += getMediaItemsSize(mediaItems);
    textSizeBytes += getChatMessageStorageByteEstimate(message);
  });

  return {
    mediaFileCount,
    mediaSizeBytes,
    messageCount: uniqueMessagesForSummary.length,
    textSizeBytes,
    totalSizeBytes: allMediaSizeBytes + textSizeBytes
  };
}

export function getChatMessageStorageByteEstimate(message: ChatMessage): number {
  const textBytes = getUtf8ByteLength(message.text || '');
  const replyBytes = message.replyTo ? getUtf8ByteLength(message.replyTo.text || '') : 0;

  return textBytes + replyBytes + 180;
}

export function getUtf8ByteLength(value: string): number {
  let bytes = 0;

  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.charCodeAt(index);

    if (codePoint <= 0x7F) {
      bytes += 1;
    } else if (codePoint <= 0x7FF) {
      bytes += 2;
    } else if (codePoint >= 0xD800 && codePoint <= 0xDBFF) {
      bytes += 4;
      index += 1;
    } else {
      bytes += 3;
    }
  }

  return bytes;
}

export function containsEmoji(value: string): boolean {
  return /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(value);
}

export function getOnlineGroupMemberCount(
  chat: ChatItem,
  directContacts: ChatContact[],
  currentUid: string
): number {
  if (chat.chatType !== 'GROUP') {
    return chat.isOnline ? 1 : 0;
  }

  const directContactById = new Map(directContacts.map((contact) => [contact.contactId, contact]));

  return (chat.members || []).filter((member) =>
    member.uid !== currentUid &&
    directContactById.get(member.uid)?.isOnline === true
  ).length;
}

export function getOptimisticMutedUntil(muteMode: ChatNotificationMuteMode): string | null {
  if (muteMode === 'off' || muteMode === 'always') {
    return null;
  }

  const durationMs = muteMode === '8h'
    ? 8 * 60 * 60 * 1000
    : 7 * 24 * 60 * 60 * 1000;

  return new Date(Date.now() + durationMs).toISOString();
}

export function applyChatListFilter(chats: ChatItem[], filter: ChatListFilter): ChatItem[] {
  if (filter === 'archived') {
    return chats;
  }

  if (filter === 'unread') {
    return chats.filter((chat) => (chat.unreadCount || 0) > 0);
  }

  if (filter === 'groups') {
    return chats.filter((chat) => chat.chatType === 'GROUP');
  }

  if (filter === 'favorites') {
    return chats.filter((chat) => isFavoriteChat(chat));
  }

  return chats;
}

/**
 * Whether a chat belongs in the list.
 *
 * Every other chat has to have something in it — a message, a preview, an
 * unread count — because an empty conversation with somebody you have never
 * written to is not a chat yet, it is a contact.
 *
 * **A department's group is exempt, and always shows.** It is not started by
 * anybody: it exists because the person is in that department, it cannot be
 * left or deleted, and it is where their department's work is coordinated. A
 * new department used to be invisible until somebody happened to send the first
 * message, which meant the one chat a person can never get rid of was also the
 * one they could not find.
 */
export { isDepartmentChat };

export function shouldShowActiveChatInList(chat: ChatItem): boolean {
  if (mustAlwaysAppearInChatList(chat)) {
    return true;
  }

  return Boolean(
    chat.isSpam !== true && (
      chat.clearedAt ||
      chat.lastMessageAt ||
      chat.preview.trim() ||
      chat.unreadCount > 0
    )
  );
}

export function hasChatKnownMessages(chat: ChatItem): boolean {
  return Boolean(chat.lastMessageAt || chat.preview.trim() || chat.unreadCount > 0);
}

export function shouldShowTrashChatInList(chat: ChatItem): boolean {
  return chat.isSpam === true || getActiveTrashSegments(chat).length > 0;
}

export function isFavoriteChat(chat: ChatItem): boolean {
  return chat.isFavorite === true;
}

export function filterChatItems(chats: ChatItem[], search: string): ChatItem[] {
  const query = normalizeSearchQuery(search);

  if (!query) {
    return chats;
  }

  return chats.filter((chat) =>
    normalizeSearchQuery(`${chat.title} ${chat.preview}`).includes(query)
  );
}

export function formatChatSearchDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map((part) => Number.parseInt(part, 10));
  const date = new Date(year || 0, Math.max((month || 1) - 1, 0), day || 1);

  if (Number.isNaN(date.getTime())) {
    return 'Date';
  }

  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export function getAiPetalColor(index: number): string {
  const colorsByIndex = ['#6754F5', '#7C3AED', '#A855F7', '#2F6BFF', '#20C997', '#4F46E5'];

  return colorsByIndex[index % colorsByIndex.length];
}

export function getChatMessageSentAtMs(message: ChatMessage): number {
  const sentAtMs = Date.parse(message.sentAt);

  return Number.isFinite(sentAtMs) ? sentAtMs : Date.now();
}

export function getOldestMessageSentAtMs(messages: ChatMessage[]): number | null {
  if (!messages.length) {
    return null;
  }

  return messages.reduce<number | null>((oldestSentAtMs, message) => {
    const sentAtMs = getChatMessageSentAtMs(message);

    return oldestSentAtMs === null ? sentAtMs : Math.min(oldestSentAtMs, sentAtMs);
  }, null);
}

export function getLatestMessageSentAtMs(messages: ChatMessage[]): number | null {
  if (!messages.length) {
    return null;
  }

  return messages.reduce<number | null>((latestSentAtMs, message) => {
    const sentAtMs = getChatMessageSentAtMs(message);

    return latestSentAtMs === null ? sentAtMs : Math.max(latestSentAtMs, sentAtMs);
  }, null);
}

export function waitForNativeTransition(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 350);
  });
}
