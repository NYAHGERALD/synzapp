import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import * as Contacts from 'expo-contacts';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioMode,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar as RNStatusBar,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import EmojiPicker, { type EmojiType } from 'rn-emoji-keyboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DismissibleError } from '../components/DismissibleError';
import {
  ApprovedEmployee,
  CompanyProfile,
  createDepartment,
  createRole,
  createTenantGroup,
  DepartmentAdminPermission,
  EmployeeLifecycleAction,
  getCompanyProfile,
  inviteEmployeeContacts,
  listCurrentUserGroups,
  listDepartmentAdminPermissionCatalog,
  listApprovedEmployees,
  listDepartments,
  listRolePermissionCatalog,
  listTenantGroups,
  listTenantDevices,
  listRoles,
  revokeTenantDevice,
  updateCompanyLogo,
  updateCompanyProfile,
  updateEmployeeDepartmentAdminAssignment,
  updateEmployeeDepartmentAdminPermissions,
  updateEmployeeLifecycle,
  updateEmployeeRole,
  updateRolePermissions,
  updateTenantChatBackupPolicy,
  RolePermission,
  TenantDepartment,
  TenantDevice,
  TenantGroup,
  TenantRole
	} from '../services/adminApi';
import {
  ChatContact,
  ChatDeliveryStatus,
  ChatGroupMember,
  ChatImageAttachment,
  ChatMediaAttachment,
  ChatMessage,
  ChatMessageReaction,
  ChatMessageReactionMap,
  ChatReplyReference,
  createGroupChat,
  decryptRealtimeEncryptedEnvelopes,
  deleteChatMessageForMe,
  getChatMessages,
  listChatContacts,
  listGroupChatContacts,
  openChatRealtimeSocket,
  parseChatRealtimeEvent,
  sendRealtimePresenceHeartbeat,
  subscribeRealtimeConversation,
  unsubscribeRealtimeConversation,
  sendChatMessage,
  updateChatMessageReaction
} from '../services/chatApi';
import {
  ChatBackupPolicy,
  createEncryptedChatBackup,
  getChatBackupPolicy,
  getStoredChatBackupRecoveryKey,
  restoreLatestEncryptedChatBackup
} from '../services/chatBackup';
import { ACCESS_DENIED_MESSAGE } from '../services/backendAuth';
import {
  ensureRegisteredDeviceIdentity,
  getRegisteredDeviceId
} from '../services/deviceIdentity';
import {
  CurrentUserDevice,
  CurrentUserProfile,
  getCurrentUserProfile,
  listCurrentUserDevices,
  revokeCurrentUserDevice,
  updateCurrentUserProfilePhoto
} from '../services/profileApi';
import {
  enqueuePendingChatMessage,
  hideCachedChatMessagesForMe,
  listCachedChatConversations,
  listPendingChatMessages,
  loadCachedChatConversation,
  loadHiddenChatMessageIds,
  removePendingChatMessage,
  saveCachedChatConversation,
  updatePendingChatMessage
} from '../services/localChatStore';
import type {
  LocalConversationRecord,
  PendingChatMessage
} from '../services/localChatStore';
import { getCachedProfilePhotoUri } from '../services/profilePhotoCache';
import { openChatAttachmentFile } from '../services/chatAttachmentOpener';
import {
  pickNativeChatCameraMedia,
  pickNativeChatFile
} from '../services/chatAttachmentPicker';
import {
  downloadAndDecryptChatMedia,
  LocalChatMediaInput,
  uploadEncryptedChatMedia
} from '../services/chatMediaApi';
import { pickNativeProfilePhoto } from '../services/profilePhotoPicker';
import {
  addChatPushNotificationListeners,
  ChatPushNotificationData,
  configureSynzappNotificationHandling,
  registerDevicePushNotifications,
  syncSynzappUnreadBadgeCount
} from '../services/pushNotifications';
import { VerifiedOrgAdmin } from '../types/auth';
import { colors } from '../theme/colors';

interface AdminChatScreenProps {
  onSessionInvalid: (message?: string) => void;
  verifiedAdmin: VerifiedOrgAdmin;
}

interface ChatItem {
  chatType: 'DIRECT' | 'GROUP';
  contactId: string;
  hasActiveDevice: boolean;
  id: string;
  isDepartmentDefault?: boolean;
  isOnline: boolean;
  lastMessageAt: string | null;
  lastSeenAt: string | null;
  memberCount?: number;
  members?: ChatGroupMember[];
  memberPolicy?: 'DEPARTMENT_PLUS_EXPLICIT' | 'EXPLICIT';
  profilePhotoUrl?: string | null;
  preview: string;
  title: string;
  unreadCount: number;
}

type MessageThreadItem =
  | { id: string; label: string; type: 'date' }
  | { id: string; message: ChatMessage; type: 'message' };

interface EmployeeListItem {
  baseRole: string;
  department: string;
  id: string;
  initials: string;
  name: string;
  profilePhotoUrl: string | null;
  role: string;
  roleId: string;
  status: string;
  statusValue: string;
}

interface MediaReviewItem {
  id: string;
  media: LocalChatMediaInput;
}

interface MediaViewerState {
  activeIndex: number;
  items: ChatMediaAttachment[];
  title: string;
}

interface AudioAttachmentPreviewState {
  contentType: string;
  fileName: string;
  localUri: string;
  sizeBytes: number;
}

type DirectoryFilter = 'Departments' | 'Roles';
type FooterTab = 'Chats' | 'Groups' | 'Employees' | 'Settings' | 'You';
type GroupCallMode = 'select' | 'voice' | 'video';
type GroupCallOption = 'schedule' | 'selectPeople' | 'sendLink' | 'video' | 'voice';
type InviteMode = 'single' | 'batch' | 'manual';
type SettingsScreen = 'list' | 'directory' | 'security' | 'chat-backup' | 'my-devices' | 'company-profile' | 'dept-admin-permissions' | 'groups' | 'role-permissions';
type UserPermission =
  | 'tenant.update'
  | 'users.invite'
  | 'users.manage'
  | 'departments.manage'
  | 'groups.create'
  | 'groups.manage'
  | 'roles.manage'
  | 'security.manage';

const MESSAGE_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏'];
const MESSAGE_INPUT_MIN_HEIGHT = 38;
const MESSAGE_INPUT_MAX_HEIGHT = 140;
const MESSAGE_INPUT_LINE_HEIGHT = 20;
const MESSAGE_INPUT_VERTICAL_PADDING = 16;
const MESSAGE_INPUT_BOX_EXTRA_HEIGHT = 4;
const VOICE_NOTE_MIN_DURATION_MS = 700;
const VOICE_NOTE_RECORDING_OPTIONS = RecordingPresets.LOW_QUALITY;
const CHAT_AUDIO_PLAYBACK_MODE: AudioMode = {
  allowsBackgroundRecording: false,
  allowsRecording: false,
  interruptionMode: 'duckOthers' as const,
  playsInSilentMode: true,
  shouldPlayInBackground: false,
  shouldRouteThroughEarpiece: false
};
const CHAT_AUDIO_RECORDING_MODE: AudioMode = {
  ...CHAT_AUDIO_PLAYBACK_MODE,
  allowsRecording: true,
  interruptionMode: 'doNotMix' as const
};
const DEFAULT_CHAT_BACKUP_POLICY: ChatBackupPolicy = {
  adminApprovalRequired: true,
  encryptedBackupsEnabled: false,
  recoveryKeyRequired: true,
  selfRestoreEnabled: false,
  updatedAt: null,
  updatedByUid: null
};

interface ChatBackupPolicyConfirmation {
  confirmText: string;
  message: string;
  style?: 'default' | 'destructive';
  title: string;
}

function getChatBackupPolicyConfirmation(
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

function clampMessageInputHeight(height: number) {
  return Math.min(
    Math.max(MESSAGE_INPUT_MIN_HEIGHT, height),
    MESSAGE_INPUT_MAX_HEIGHT
  );
}

function estimateMessageInputHeight(text: string, inputWidth: number) {
  if (text.length === 0) {
    return MESSAGE_INPUT_MIN_HEIGHT;
  }

  const averageCharacterWidth = 8.2;
  const charactersPerLine = inputWidth > 0
    ? Math.max(8, Math.floor(inputWidth / averageCharacterWidth))
    : 28;
  const estimatedLines = text.split('\n').reduce((lineCount, line) => (
    lineCount + Math.max(1, Math.ceil(line.length / charactersPerLine))
  ), 0);

  return clampMessageInputHeight(
    (estimatedLines * MESSAGE_INPUT_LINE_HEIGHT) + MESSAGE_INPUT_VERTICAL_PADDING
  );
}

type DeviceListItem = TenantDevice | CurrentUserDevice;

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

interface InviteContactDraft {
  displayName?: string;
  phoneNumber: string;
}

interface BatchContactCandidate {
  displayName: string;
  id: string;
  phoneMasked: string;
  phoneNumber: string;
  subtitle: string;
}

interface InviteDraft {
  contacts: InviteContactDraft[];
  department: TenantDepartment;
  mode: InviteMode;
  role: TenantRole;
}

type EmployeeAction = EmployeeLifecycleAction | 'ASSIGN_DEPT_ADMIN' | 'REMOVE_DEPT_ADMIN' | 'CHANGE_ROLE';

interface EmployeeActionOption {
  action: EmployeeAction;
  confirmButton: string;
  confirmMessage: (employeeName: string) => string;
  confirmTitle: string;
  label: string;
  reason?: string;
  successMessage: (employeeName: string) => string;
  successTitle: string;
}

interface NativeOptionPickerOption {
  id: string;
  label: string;
}

interface NativeOptionPickerState {
  onSelect: (index: number | null) => void;
  options: NativeOptionPickerOption[];
  title: string;
}

const footerTabs: FooterTab[] = ['Chats', 'Groups', 'Employees', 'Settings', 'You'];
const androidButtonRipple = { borderless: false, color: 'rgba(15, 118, 110, 0.14)' } as const;
const androidIconRipple = { borderless: true, color: 'rgba(15, 118, 110, 0.14)' } as const;

export function AdminChatScreen({ onSessionInvalid, verifiedAdmin }: AdminChatScreenProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<FooterTab>('Chats');
  const [settingsScreen, setSettingsScreen] = useState<SettingsScreen>('list');
  const [directoryFilter, setDirectoryFilter] = useState<DirectoryFilter>('Departments');
  const [approvedEmployees, setApprovedEmployees] = useState<ApprovedEmployee[]>([]);
  const [departments, setDepartments] = useState<TenantDepartment[]>([]);
  const [departmentAdminPermissionCatalog, setDepartmentAdminPermissionCatalog] = useState<DepartmentAdminPermission[]>([]);
  const [groups, setGroups] = useState<TenantGroup[]>([]);
  const [rolePermissionCatalog, setRolePermissionCatalog] = useState<RolePermission[]>([]);
  const [roles, setRoles] = useState<TenantRole[]>([]);
  const [tenantDevices, setTenantDevices] = useState<TenantDevice[]>([]);
  const [currentUserDevices, setCurrentUserDevices] = useState<CurrentUserDevice[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [registeredDeviceId, setRegisteredDeviceId] = useState<string | null>(null);
  const [inviteDraft, setInviteDraft] = useState<InviteDraft | null>(null);
  const [batchContactCandidates, setBatchContactCandidates] = useState<BatchContactCandidate[]>([]);
  const [batchContactSearch, setBatchContactSearch] = useState('');
  const [batchDraftTarget, setBatchDraftTarget] = useState<InviteDraft | null>(null);
  const [manualInviteDraftTarget, setManualInviteDraftTarget] = useState<InviteDraft | null>(null);
  const [manualPhoneDraft, setManualPhoneDraft] = useState('');
  const [isBatchContactModalOpen, setIsBatchContactModalOpen] = useState(false);
  const [isManualInviteModalOpen, setIsManualInviteModalOpen] = useState(false);
  const [isInvitingEmployees, setIsInvitingEmployees] = useState(false);
  const [isUpdatingEmployeeLifecycle, setIsUpdatingEmployeeLifecycle] = useState(false);
  const [chatContacts, setChatContacts] = useState<ChatContact[]>([]);
  const [chatSearch, setChatSearch] = useState('');
  const [newChatSearch, setNewChatSearch] = useState('');
  const [addMembersSearch, setAddMembersSearch] = useState('');
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isAddMembersModalOpen, setIsAddMembersModalOpen] = useState(false);
  const [isGroupDetailsModalOpen, setIsGroupDetailsModalOpen] = useState(false);
  const [isGroupPermissionsModalOpen, setIsGroupPermissionsModalOpen] = useState(false);
  const [isGroupCallOptionsOpen, setIsGroupCallOptionsOpen] = useState(false);
  const [isGroupCallPeopleModalOpen, setIsGroupCallPeopleModalOpen] = useState(false);
  const [isGroupSwitcherModalOpen, setIsGroupSwitcherModalOpen] = useState(false);
  const [groupCallMode, setGroupCallMode] = useState<GroupCallMode>('select');
  const [groupCallPeopleSearch, setGroupCallPeopleSearch] = useState('');
  const [newGroupNameDraft, setNewGroupNameDraft] = useState('');
  const [newGroupPhotoUri, setNewGroupPhotoUri] = useState<string | null>(null);
  const [newGroupPermissionMode, setNewGroupPermissionMode] = useState<'ADMINS' | 'ALL_MEMBERS'>('ALL_MEMBERS');
  const [selectedGroupCallMemberIds, setSelectedGroupCallMemberIds] = useState<Record<string, boolean>>({});
  const [selectedNewGroupMemberIds, setSelectedNewGroupMemberIds] = useState<Record<string, boolean>>({});
  const [messageDraft, setMessageDraft] = useState('');
  const [mediaReviewItems, setMediaReviewItems] = useState<MediaReviewItem[]>([]);
  const [mediaReviewActiveIndex, setMediaReviewActiveIndex] = useState(0);
  const [mediaReviewCaption, setMediaReviewCaption] = useState('');
  const [isSendingMediaReview, setIsSendingMediaReview] = useState(false);
  const [audioAttachmentPreview, setAudioAttachmentPreview] = useState<AudioAttachmentPreviewState | null>(null);
  const [mediaViewer, setMediaViewer] = useState<MediaViewerState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageActionTarget, setMessageActionTarget] = useState<ChatMessage | null>(null);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [isForwardMode, setIsForwardMode] = useState(false);
  const [forwardSelectedMessageIds, setForwardSelectedMessageIds] = useState<Record<string, boolean>>({});
  const [forwardRecipientIds, setForwardRecipientIds] = useState<Record<string, boolean>>({});
  const [isForwardRecipientModalOpen, setIsForwardRecipientModalOpen] = useState(false);
  const [isForwardingMessages, setIsForwardingMessages] = useState(false);
  const [nativeOptionPicker, setNativeOptionPicker] = useState<NativeOptionPickerState | null>(null);
  const [messageReactions, setMessageReactions] = useState<ChatMessageReactionMap>({});
  const [starredMessageIds, setStarredMessageIds] = useState<Record<string, boolean>>({});
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isLoadingBatchContacts, setIsLoadingBatchContacts] = useState(false);
  const [isPickingInviteContact, setIsPickingInviteContact] = useState(false);
  const [selectedBatchPhoneNumbers, setSelectedBatchPhoneNumbers] = useState<string[]>([]);
  const [chatBackupPolicy, setChatBackupPolicy] = useState<ChatBackupPolicy | null>(null);
  const [userProfile, setUserProfile] = useState<CurrentUserProfile | null>(null);
  const [profilePhotoAuthToken, setProfilePhotoAuthToken] = useState<string | null>(null);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isLoadingSecurity, setIsLoadingSecurity] = useState(false);
  const [isLoadingMyDevices, setIsLoadingMyDevices] = useState(false);
  const [isLoadingCompanyProfile, setIsLoadingCompanyProfile] = useState(false);
  const [isLoadingChatBackupPolicy, setIsLoadingChatBackupPolicy] = useState(false);
  const [isSavingChatBackupPolicy, setIsSavingChatBackupPolicy] = useState(false);
  const [isSavingCompanyProfile, setIsSavingCompanyProfile] = useState(false);
  const [isSavingCompanyLogo, setIsSavingCompanyLogo] = useState(false);
  const [isSavingDepartmentAdminPermissions, setIsSavingDepartmentAdminPermissions] = useState(false);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [isSavingRolePermissions, setIsSavingRolePermissions] = useState(false);
  const [isLoadingUserProfile, setIsLoadingUserProfile] = useState(false);
  const [isSyncingChatBackup, setIsSyncingChatBackup] = useState(false);
  const [isSavingUserPhoto, setIsSavingUserPhoto] = useState(false);
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [isRevokingDevice, setIsRevokingDevice] = useState(false);
  const [isRevokingMyDevice, setIsRevokingMyDevice] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);
  const [isRecoveryKeyModalOpen, setIsRecoveryKeyModalOpen] = useState(false);
  const [newRecordDescription, setNewRecordDescription] = useState('');
  const [newRecordName, setNewRecordName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDepartment, setNewGroupDepartment] = useState<TenantDepartment | null>(null);
  const [companyAddressDraft, setCompanyAddressDraft] = useState('');
  const [companyNameDraft, setCompanyNameDraft] = useState('');
  const [recoveryKeyDraft, setRecoveryKeyDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const backupSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isBackupSyncingRef = useRef(false);
  const pushNotificationRegistrationStartedRef = useRef(false);
  const realtimePresenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deviceIdentityRegistrationStartedRef = useRef(false);
  const activeLocalSendQueueIdsRef = useRef<Set<string>>(new Set());
  const pendingSyncContactIdsRef = useRef<Set<string>>(new Set());
  const activeMediaDownloadPromisesRef = useRef<Map<string, Promise<string | null>>>(new Map());
  const chatContactsRef = useRef<ChatContact[]>([]);
  const chatOpenRequestIdRef = useRef(0);
  const realtimeReadyRef = useRef(false);
  const realtimeSocketRef = useRef<WebSocket | null>(null);
  const selectedChatRef = useRef<ChatItem | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const permissions = userProfile?.permissions ?? verifiedAdmin.session.user.permissions ?? [];
  const currentUid = verifiedAdmin.session.user.uid;
  const canInviteEmployees = hasPermission(permissions, 'users.invite');
  const canManageUsers = hasPermission(permissions, 'users.manage');
  const canManageDirectory = hasPermission(permissions, 'departments.manage') && hasPermission(permissions, 'roles.manage');
  const canManageCompanyProfile = hasPermission(permissions, 'tenant.update');
  const canManageGroups = hasPermission(permissions, 'groups.manage') || hasPermission(permissions, 'groups.create');
  const canManageSecurity = hasPermission(permissions, 'security.manage');
  const canViewEmployees = canInviteEmployees || canManageUsers;
  const visibleFooterTabs: FooterTab[] = canViewEmployees
    ? ['Chats', 'Groups', 'Employees', 'Settings', 'You']
    : ['Chats', 'Groups', 'Settings', 'You'];
  const chatItems = chatContacts.map(mapChatContactToChatItem);
  const directChatContacts = chatContacts.filter((contact) => (contact.chatType || 'DIRECT') !== 'GROUP');
  const selectedForwardMessageCount = Object.values(forwardSelectedMessageIds).filter(Boolean).length;
  const selectedForwardRecipientCount = Object.values(forwardRecipientIds).filter(Boolean).length;
  const employeeItems = approvedEmployees.map(mapApprovedEmployeeToListItem);
  const isCompactAndroid = Platform.OS === 'android' && height < 720;
  const footerHeight = isCompactAndroid ? 56 : 60;
  const footerBottom = Platform.OS === 'android'
    ? Math.max(insets.bottom + 2, isCompactAndroid ? 14 : 18)
    : Math.max(insets.bottom, 10);
  const footerTabHeight = isCompactAndroid ? 46 : 50;
  const androidStatusBarHeight = Platform.OS === 'android' ? RNStatusBar.currentHeight || 0 : 0;
  const deviceTopInset = Math.max(insets.top, androidStatusBarHeight);
  const headerTopPadding = Platform.OS === 'android' ? Math.max(deviceTopInset + 10, 38) : 8;
  const messageTopPadding = Platform.OS === 'android' ? Math.max(deviceTopInset + 6, 34) : 0;
  const contentBottomPadding = footerBottom + footerHeight + 18;
  const floatingAddBottom = footerBottom + footerHeight + 14;
  const profilePhotoHeaders = profilePhotoAuthToken
    ? {
        Authorization: `Bearer ${profilePhotoAuthToken}`,
        ...(registeredDeviceId ? { 'X-Synzapp-Device-Id': registeredDeviceId } : {})
      }
    : undefined;
  const filteredChatItems = filterChatItems(chatItems, chatSearch);
  const selectedNewGroupMembers = directChatContacts.filter((contact) => selectedNewGroupMemberIds[contact.contactId]);
  const activeGroupMemberContacts = selectedChat?.chatType === 'GROUP'
    ? mapGroupMembersToSelectableContacts(selectedChat.members || [], directChatContacts, currentUid)
    : [];
  const activeGroupOnlineCount = selectedChat?.chatType === 'GROUP'
    ? getOnlineGroupMemberCount(selectedChat, directChatContacts, currentUid)
    : 0;
  const selectedGroupCallMemberCount = Object.values(selectedGroupCallMemberIds).filter(Boolean).length;
  const companyDisplayName = userProfile?.companyName || companyProfile?.companyName || 'Synzapp';

  useEffect(() => {
    void configureSynzappNotificationHandling();
    void loadUserProfile(false);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void loadUserProfile(false);
        if (realtimeSocketRef.current) {
          sendRealtimePresenceHeartbeat(realtimeSocketRef.current);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    function clearRealtimeReconnectTimer() {
      if (realtimeReconnectTimerRef.current) {
        clearTimeout(realtimeReconnectTimerRef.current);
        realtimeReconnectTimerRef.current = null;
      }
    }

    function clearRealtimePresenceTimer() {
      if (realtimePresenceTimerRef.current) {
        clearInterval(realtimePresenceTimerRef.current);
        realtimePresenceTimerRef.current = null;
      }
    }

    function startRealtimePresenceHeartbeat(socket: WebSocket) {
      clearRealtimePresenceTimer();
      socket.addEventListener('open', () => {
        sendRealtimePresenceHeartbeat(socket);
      });
      realtimePresenceTimerRef.current = setInterval(() => {
        sendRealtimePresenceHeartbeat(socket);
      }, 20_000);
    }

    function scheduleRealtimeReconnect() {
      clearRealtimeReconnectTimer();

      if (!isActive) {
        return;
      }

      realtimeReconnectTimerRef.current = setTimeout(() => {
        void connectRealtime();
      }, 2500);
    }

    async function connectRealtime() {
      clearRealtimeReconnectTimer();

      try {
        const idToken = await getIdToken(true);
        const deviceId = await getRegisteredDeviceId(idToken);

        if (!isActive) {
          return;
        }

        setRegisteredDeviceId(deviceId);

        const socket = openChatRealtimeSocket(idToken, deviceId);

        realtimeSocketRef.current = socket;
        realtimeReadyRef.current = false;
        startRealtimePresenceHeartbeat(socket);

        socket.onmessage = (event) => {
          if (typeof event.data === 'string') {
            void handleChatRealtimePayload(event.data);
          }
        };

        socket.onclose = () => {
          if (realtimeSocketRef.current === socket) {
            realtimeSocketRef.current = null;
            realtimeReadyRef.current = false;
            clearRealtimePresenceTimer();
          }

          scheduleRealtimeReconnect();
        };

        socket.onerror = () => {
          socket.close();
        };
      } catch {
        scheduleRealtimeReconnect();
      }
    }

    void connectRealtime();

    return () => {
      isActive = false;
      clearRealtimeReconnectTimer();
      clearRealtimePresenceTimer();
      realtimeReadyRef.current = false;
      realtimeSocketRef.current?.close();
      realtimeSocketRef.current = null;
    };
  }, [onSessionInvalid, verifiedAdmin.firebaseUser]);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    sendActiveRealtimeConversationSubscription();
  }, [selectedChat?.contactId]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    chatContactsRef.current = chatContacts;
    void syncSynzappUnreadBadgeCount(chatContacts).catch(() => undefined);
  }, [chatContacts]);

  useEffect(() => {
    if (!selectedChat) {
      return;
    }

    queueMediaDownloadsForMessages(selectedChat.contactId, messages, selectedChat.chatType);
  }, [messages, selectedChat?.chatType, selectedChat?.contactId]);

  useEffect(() => () => {
    if (backupSyncTimerRef.current) {
      clearTimeout(backupSyncTimerRef.current);
      backupSyncTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return addChatPushNotificationListeners({
      onReceived: () => {
        void loadChatContacts(false);
      },
      onResponse: (data) => {
        void openChatFromPushNotification(data);
      }
    });
  }, []);

  useEffect(() => {
    if (activeTab !== 'Settings' || settingsScreen !== 'directory' || !canManageDirectory) {
      return;
    }

    void loadSettings();
  }, [activeTab, canManageDirectory, settingsScreen]);

  useEffect(() => {
    if (activeTab !== 'Settings' || settingsScreen !== 'role-permissions' || !canManageDirectory) {
      return;
    }

    void loadRolePermissionSettings();
  }, [activeTab, canManageDirectory, settingsScreen]);

  useEffect(() => {
    if (activeTab !== 'Settings' || settingsScreen !== 'company-profile' || !canManageCompanyProfile) {
      return;
    }

    void loadCompanyProfile();
  }, [activeTab, canManageCompanyProfile, settingsScreen]);

  useEffect(() => {
    if (activeTab !== 'Settings' || settingsScreen !== 'dept-admin-permissions' || !canManageUsers) {
      return;
    }

    void loadDepartmentAdminPermissionSettings();
  }, [activeTab, canManageUsers, settingsScreen]);

  useEffect(() => {
    if (activeTab !== 'Settings' || settingsScreen !== 'groups' || !canManageGroups) {
      return;
    }

    void loadGroupSettings();
  }, [activeTab, canManageGroups, settingsScreen]);

  useEffect(() => {
    if (activeTab !== 'Groups') {
      return;
    }

    void loadGroupSettings();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'Settings' || settingsScreen !== 'security' || !canManageSecurity) {
      return;
    }

    void loadSecurityDevices();
  }, [activeTab, canManageSecurity, settingsScreen]);

  useEffect(() => {
    if (activeTab !== 'Settings' || settingsScreen !== 'my-devices') {
      return;
    }

    void loadMyDevices();
  }, [activeTab, settingsScreen]);

  useEffect(() => {
    if (activeTab !== 'Settings' || settingsScreen !== 'chat-backup') {
      return;
    }

    void loadChatBackupPolicy();
  }, [activeTab, settingsScreen]);

  useEffect(() => {
    if (activeTab !== 'Chats') {
      return;
    }

    void loadChatContacts();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'You') {
      return;
    }

    void loadUserProfile(false);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'Employees' || !canViewEmployees) {
      return;
    }

    void loadEmployees();
  }, [activeTab, canViewEmployees]);

  useEffect(() => {
    if (activeTab === 'Employees' && !canViewEmployees) {
      setActiveTab('Chats');
    }

    if (settingsScreen === 'directory' && !canManageDirectory) {
      setSettingsScreen('list');
    }

    if (settingsScreen === 'role-permissions' && !canManageDirectory) {
      setSettingsScreen('list');
    }

    if (settingsScreen === 'company-profile' && !canManageCompanyProfile) {
      setSettingsScreen('list');
    }

    if (settingsScreen === 'dept-admin-permissions' && !canManageUsers) {
      setSettingsScreen('list');
    }

    if (settingsScreen === 'groups' && !canManageGroups) {
      setSettingsScreen('list');
    }

    if (settingsScreen === 'security' && !canManageSecurity) {
      setSettingsScreen('list');
    }
  }, [activeTab, canManageCompanyProfile, canManageDirectory, canManageGroups, canManageSecurity, canManageUsers, canViewEmployees, settingsScreen]);

  async function getIdToken(forceRefresh = false): Promise<string> {
    return verifiedAdmin.firebaseUser.getIdToken(forceRefresh);
  }

  function getActiveTenantId(): string {
    return userProfile?.tenantId || verifiedAdmin.session.user.tenantId || '';
  }

  function queueEncryptedChatBackup() {
    if (backupSyncTimerRef.current) {
      clearTimeout(backupSyncTimerRef.current);
    }

    backupSyncTimerRef.current = setTimeout(() => {
      backupSyncTimerRef.current = null;
      void syncEncryptedChatBackup(false);
    }, 1800);
  }

  async function syncEncryptedChatBackup(showResult: boolean) {
    const tenantId = getActiveTenantId();

    if (!tenantId || isBackupSyncingRef.current) {
      return;
    }

    isBackupSyncingRef.current = true;
    setIsSyncingChatBackup(true);

    try {
      const idToken = await getIdToken();
      const policy = chatBackupPolicy || await getChatBackupPolicy(idToken);

      setChatBackupPolicy(policy);

      if (!policy.encryptedBackupsEnabled) {
        if (showResult) {
          Alert.alert('Encrypted backup disabled', 'Your organization has not enabled encrypted chat backup.');
        }

        return;
      }

      const result = await createEncryptedChatBackup({
        idToken,
        ownerUid: currentUid,
        tenantId
      });

      if (showResult) {
        showChatBackupResultAlert(result);
      }
    } catch (nextError) {
      if (showResult) {
        setError(getErrorMessage(nextError, 'Unable to sync encrypted chat backup.'));
      }
    } finally {
      isBackupSyncingRef.current = false;
      setIsSyncingChatBackup(false);
    }
  }

  function showChatBackupResultAlert(result: Awaited<ReturnType<typeof createEncryptedChatBackup>>) {
    const message = result.createdRecoveryKey
      ? [
          `${result.metadata.messageCount} messages backed up.`,
          'A new recovery key was created. Keep it somewhere safe so you can restore chats after reinstalling the app.',
          result.recoveryKey
        ].join('\n\n')
      : `${result.metadata.messageCount} messages backed up.`;

    Alert.alert(
      'Encrypted backup updated',
      message,
      result.createdRecoveryKey
        ? [
            {
              onPress: () => {
                void Clipboard.setStringAsync(result.recoveryKey);
              },
              text: 'Copy key'
            },
            {
              style: 'cancel',
              text: 'Done'
            }
          ]
        : undefined
    );
  }

  async function handleBackupNow() {
    setError(null);
    await syncEncryptedChatBackup(true);
  }

  async function handleShowBackupRecoveryKey() {
    setError(null);

    try {
      const recoveryKey = await getStoredChatBackupRecoveryKey();

      if (!recoveryKey) {
        Alert.alert('No recovery key yet', 'Run an encrypted backup first.');
        return;
      }

      Alert.alert(
        'Recovery key',
        recoveryKey,
        [
          {
            onPress: () => {
              void Clipboard.setStringAsync(recoveryKey);
            },
            text: 'Copy key'
          },
          {
            style: 'cancel',
            text: 'Done'
          }
        ]
      );
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to load recovery key.'));
    }
  }

  async function handleRestoreChatBackup() {
    setError(null);

    try {
      const idToken = await getIdToken();
      const policy = chatBackupPolicy || await getChatBackupPolicy(idToken);

      setChatBackupPolicy(policy);

      if (!policy.encryptedBackupsEnabled) {
        Alert.alert('Encrypted backup disabled', 'Your organization has not enabled encrypted chat backup.');
        return;
      }

      if (!policy.selfRestoreEnabled) {
        Alert.alert('Restore requires approval', 'Your organization has not enabled self-service restore.');
        return;
      }

      const storedRecoveryKey = await getStoredChatBackupRecoveryKey();

      if (!storedRecoveryKey) {
        setRecoveryKeyDraft('');
        setIsRecoveryKeyModalOpen(true);
        return;
      }

      Alert.alert(
        'Restore encrypted backup?',
        'This will merge your latest encrypted backup into this device.',
        [
          {
            style: 'cancel',
            text: 'Cancel'
          },
          {
            onPress: () => {
              void restoreChatBackupWithKey(storedRecoveryKey);
            },
            text: 'Restore'
          }
        ]
      );
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to restore encrypted chat backup.'));
    }
  }

  async function loadChatBackupPolicy(showError = true): Promise<ChatBackupPolicy | null> {
    setIsLoadingChatBackupPolicy(true);

    try {
      const idToken = await getIdToken();
      const policy = await getChatBackupPolicy(idToken);

      setChatBackupPolicy(policy);
      return policy;
    } catch (nextError) {
      if (showError) {
        setError(getErrorMessage(nextError, 'Unable to load encrypted backup policy.'));
      }

      return null;
    } finally {
      setIsLoadingChatBackupPolicy(false);
    }
  }

  async function handleUpdateChatBackupPolicy(nextPolicy: Pick<ChatBackupPolicy, 'encryptedBackupsEnabled' | 'selfRestoreEnabled'>) {
    if (!canManageSecurity || isSavingChatBackupPolicy) {
      return;
    }

    const currentPolicy = chatBackupPolicy || DEFAULT_CHAT_BACKUP_POLICY;
    const confirmation = getChatBackupPolicyConfirmation(currentPolicy, nextPolicy);

    if (!confirmation) {
      return;
    }

    Alert.alert(
      confirmation.title,
      confirmation.message,
      [
        {
          style: 'cancel',
          text: 'Cancel'
        },
        {
          onPress: () => {
            void saveChatBackupPolicy(nextPolicy);
          },
          style: confirmation.style,
          text: confirmation.confirmText
        }
      ]
    );
  }

  async function saveChatBackupPolicy(nextPolicy: Pick<ChatBackupPolicy, 'encryptedBackupsEnabled' | 'selfRestoreEnabled'>) {
    setError(null);
    setIsSavingChatBackupPolicy(true);

    try {
      const idToken = await getIdToken();
      const policy = await updateTenantChatBackupPolicy({
        encryptedBackupsEnabled: nextPolicy.encryptedBackupsEnabled,
        idToken,
        selfRestoreEnabled: nextPolicy.selfRestoreEnabled
      });

      setChatBackupPolicy(policy);
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to update encrypted backup policy.'));
    } finally {
      setIsSavingChatBackupPolicy(false);
    }
  }

  async function restoreChatBackupWithKey(recoveryKey: string) {
    const tenantId = getActiveTenantId();

    if (!tenantId || isBackupSyncingRef.current) {
      return;
    }

    isBackupSyncingRef.current = true;
    setIsSyncingChatBackup(true);

    try {
      const idToken = await getIdToken();
      const result = await restoreLatestEncryptedChatBackup({
        idToken,
        ownerUid: currentUid,
        recoveryKey,
        tenantId
      });

      setIsRecoveryKeyModalOpen(false);
      setRecoveryKeyDraft('');

      if (!result) {
        Alert.alert('No backup found', 'There is no encrypted chat backup for this account yet.');
        return;
      }

      Alert.alert('Backup restored', `${result.messageCount} messages restored.`);
      void loadChatContacts(false);
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to restore encrypted chat backup.'));
    } finally {
      isBackupSyncingRef.current = false;
      setIsSyncingChatBackup(false);
    }
  }

  async function registerCurrentDeviceIdentity(idToken?: string) {
    if (deviceIdentityRegistrationStartedRef.current) {
      return;
    }

    deviceIdentityRegistrationStartedRef.current = true;

    try {
      const registrationToken = idToken || await getIdToken();
      const device = await ensureRegisteredDeviceIdentity(registrationToken);

      setRegisteredDeviceId(device.deviceId);
      void registerCurrentDevicePushToken(registrationToken);
    } catch (nextError) {
      deviceIdentityRegistrationStartedRef.current = false;
      console.warn(
        'Device identity registration failed:',
        getErrorMessage(nextError, 'Unable to register this device.')
      );
    }
  }

  async function registerCurrentDevicePushToken(idToken: string) {
    if (pushNotificationRegistrationStartedRef.current) {
      return;
    }

    pushNotificationRegistrationStartedRef.current = true;

    try {
      await registerDevicePushNotifications(idToken);
    } catch (nextError) {
      pushNotificationRegistrationStartedRef.current = false;
      console.warn(
        'Push notification registration failed:',
        getErrorMessage(nextError, 'Unable to register push notifications.')
      );
    }
  }

  async function loadSettings() {
    if (!canManageDirectory) {
      return;
    }

    setError(null);
    setIsLoadingSettings(true);

    try {
      await loadDirectoryRecords();
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to load settings.'));
    } finally {
      setIsLoadingSettings(false);
    }
  }

  async function loadDirectoryRecords() {
    const idToken = await getIdToken();
    const [nextDepartments, nextRoles] = await Promise.all([
      listDepartments(idToken),
      listRoles(idToken)
    ]);

    setDepartments(nextDepartments);
    setRoles(nextRoles);

    return {
      departments: nextDepartments,
      roles: nextRoles
    };
  }

  function selectScreenOption<T>(
    title: string,
    options: T[],
    getLabel: (option: T) => string
  ): Promise<T | null> {
    return new Promise((resolve) => {
      let hasResolved = false;
      const resolveOnce = (value: T | null) => {
        if (hasResolved) {
          return;
        }

        hasResolved = true;
        setNativeOptionPicker(null);
        resolve(value);
      };

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            cancelButtonIndex: options.length,
            options: [...options.map(getLabel), 'Cancel'],
            title
          },
          (buttonIndex) => {
            if (buttonIndex === options.length) {
              resolveOnce(null);
              return;
            }

            resolveOnce(options[buttonIndex] || null);
          }
        );
        return;
      }

      setNativeOptionPicker({
        onSelect: (index) => {
          resolveOnce(index === null ? null : options[index] || null);
        },
        options: options.map((option, index) => ({
          id: `${index}-${getLabel(option)}`,
          label: getLabel(option)
        })),
        title
      });
    });
  }

  async function loadRolePermissionSettings(showError = true) {
    if (!canManageDirectory) {
      return;
    }

    setIsLoadingSettings(true);

    try {
      const idToken = await getIdToken();
      const [catalog, nextRoles] = await Promise.all([
        listRolePermissionCatalog(idToken),
        listRoles(idToken)
      ]);

      setRolePermissionCatalog(catalog);
      setRoles(nextRoles);
    } catch (nextError) {
      if (showError) {
        setError(getErrorMessage(nextError, 'Unable to load role permissions.'));
      }
    } finally {
      setIsLoadingSettings(false);
    }
  }

  async function loadDepartmentAdminPermissionSettings(showError = true) {
    if (!canManageUsers) {
      return;
    }

    setIsLoadingSettings(true);

    try {
      const idToken = await getIdToken();
      const [catalog, employees] = await Promise.all([
        listDepartmentAdminPermissionCatalog(idToken),
        listApprovedEmployees(idToken)
      ]);
      const employeesWithCachedPhotos = await cacheApprovedEmployeePhotos(employees, idToken);

      setProfilePhotoAuthToken(idToken);
      setDepartmentAdminPermissionCatalog(catalog);
      setApprovedEmployees(sortApprovedEmployees(employeesWithCachedPhotos));
    } catch (nextError) {
      if (showError) {
        setError(getErrorMessage(nextError, 'Unable to load Department Admin permissions.'));
      }
    } finally {
      setIsLoadingSettings(false);
    }
  }

  async function loadGroupSettings(showError = true) {
    setIsLoadingGroups(true);

    try {
      const idToken = await getIdToken();
      const nextGroups = canManageGroups && activeTab === 'Settings'
        ? await listTenantGroups(idToken)
        : await listCurrentUserGroups(idToken);

      setGroups(sortByName(nextGroups));
    } catch (nextError) {
      if (showError) {
        setError(getErrorMessage(nextError, 'Unable to load groups.'));
      }
    } finally {
      setIsLoadingGroups(false);
    }
  }

  async function loadCompanyProfile(showError = true) {
    if (!canManageCompanyProfile) {
      return;
    }

    setIsLoadingCompanyProfile(true);

    try {
      const idToken = await getIdToken();
      const profile = await getCompanyProfile(idToken);

      setProfilePhotoAuthToken(idToken);
      setCompanyProfile(profile);
      setCompanyNameDraft(profile.companyName);
      setCompanyAddressDraft(profile.companyAddress);
    } catch (nextError) {
      if (showError) {
        setError(getErrorMessage(nextError, 'Unable to load company profile.'));
      }
    } finally {
      setIsLoadingCompanyProfile(false);
    }
  }

  async function loadSecurityDevices(showError = true) {
    if (!canManageSecurity) {
      return;
    }

    setIsLoadingSecurity(true);

    try {
      const idToken = await getIdToken();
      const devices = await listTenantDevices(idToken);

      setTenantDevices(devices);
    } catch (nextError) {
      if (showError) {
        setError(getErrorMessage(nextError, 'Unable to load security settings.'));
      }
    } finally {
      setIsLoadingSecurity(false);
    }
  }

  async function loadMyDevices(showError = true) {
    setIsLoadingMyDevices(true);

    try {
      const idToken = await getIdToken();
      const devices = await listCurrentUserDevices(idToken);

      setCurrentUserDevices(devices);
    } catch (nextError) {
      if (showError) {
        setError(getErrorMessage(nextError, 'Unable to load your devices.'));
      }
    } finally {
      setIsLoadingMyDevices(false);
    }
  }

  async function loadEmployees() {
    setError(null);
    setIsLoadingEmployees(true);

    try {
      const idToken = await getIdToken();
      const [nextEmployees, nextDepartments, nextRoles] = await Promise.all([
        listApprovedEmployees(idToken),
        listDepartments(idToken),
        listRoles(idToken)
      ]);
      const employeesWithCachedPhotos = await cacheApprovedEmployeePhotos(nextEmployees, idToken);

      setProfilePhotoAuthToken(idToken);
      setApprovedEmployees(sortApprovedEmployees(employeesWithCachedPhotos));
      setDepartments(nextDepartments);
      setRoles(nextRoles);
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to load employees.'));
    } finally {
      setIsLoadingEmployees(false);
    }
  }

  async function loadChatContacts(showError = true): Promise<ChatContact[]> {
    const hadVisibleContacts = chatContactsRef.current.length > 0;
    let fallbackContacts = chatContactsRef.current;

    if (!hadVisibleContacts) {
      setIsLoadingChats(true);
    }

    try {
      const [cachedConversations, pendingMessages] = await Promise.all([
        listCachedChatConversations({ ownerUid: currentUid }).catch(() => []),
        listPendingChatMessages({ ownerUid: currentUid }).catch(() => [])
      ]);
      const cachedContacts = buildLocalChatContactsFromCachedConversations(
        cachedConversations,
        pendingMessages
      );

      if (cachedContacts.length) {
        fallbackContacts = mergeLoadedChatContactsWithVisibleState(chatContactsRef.current, cachedContacts);
        setChatContacts(fallbackContacts);
        setIsLoadingChats(false);
      }

      const idToken = await getIdToken();
      const [directContacts, groupContacts] = await Promise.all([
        listChatContacts(idToken),
        listGroupChatContacts(idToken)
      ]);
      const contacts = [...directContacts, ...groupContacts];
      const contactsWithLocalPreviews = applyLocalChatPreviewsToContacts(
        contacts,
        cachedConversations,
        pendingMessages
      );

      setProfilePhotoAuthToken(idToken);
      setChatContacts((currentContacts) =>
        mergeLoadedChatContactsWithVisibleState(currentContacts, contactsWithLocalPreviews)
      );

      const contactsWithCachedPhotos = await cacheChatContactPhotos(contactsWithLocalPreviews, idToken);

      setChatContacts((currentContacts) =>
        mergeLoadedChatContactsWithVisibleState(currentContacts, contactsWithCachedPhotos)
      );

      return contactsWithCachedPhotos;
    } catch (nextError) {
      if (showError && !isNetworkUnavailableError(nextError)) {
        setError(getErrorMessage(nextError, 'Unable to load chats.'));
      }

      return fallbackContacts;
    } finally {
      setIsLoadingChats(false);
    }
  }

  function applyVisibleChatContactUpdate(nextContact: ChatContact, shouldSelect: boolean) {
    if (shouldSelect && selectedChatRef.current?.contactId === nextContact.contactId) {
      setSelectedChat(mapChatContactToChatItem(nextContact));
    }

    setChatContacts((currentContacts) => {
      const existingContact = currentContacts.find((contact) => contact.contactId === nextContact.contactId);

      return upsertChatContact(currentContacts, mergeChatContactVisibleState(existingContact, nextContact));
    });
  }

  function applyVisibleChatPresenceUpdate(contactId: string, isOnline: boolean, lastSeenAt: string | null) {
    setSelectedChat((currentChat) => currentChat?.contactId === contactId
      ? {
          ...currentChat,
          isOnline,
          lastSeenAt
        }
      : currentChat);
    setChatContacts((currentContacts) => currentContacts.map((contact) =>
      contact.contactId === contactId
        ? {
            ...contact,
            isOnline,
            lastSeenAt
          }
        : contact
    ));
  }

  async function handleChatRealtimePayload(payload: string) {
    const event = parseChatRealtimeEvent(payload);

    if (!event) {
      return;
    }

    if (event.type === 'ready') {
      realtimeReadyRef.current = true;
      sendActiveRealtimeConversationSubscription();
      void syncAllPendingMessages();
      return;
    }

    if (event.type === 'error') {
      if (event.code === 'SESSION_UNVERIFIED' || isRealtimeSessionVerificationError(event.message)) {
        onSessionInvalid(ACCESS_DENIED_MESSAGE);
        return;
      }

      console.warn('Realtime chat event ignored:', event.message);
      return;
    }

    if (event.type === 'contactPresenceUpdated') {
      applyVisibleChatPresenceUpdate(event.contactId, event.isOnline, event.lastSeenAt);
      return;
    }

    if (event.type === 'chatContactUpdated') {
      const shouldMarkRead = selectedChatRef.current?.contactId === event.contact.contactId;
      const baseContact = shouldMarkRead
        ? { ...event.contact, unreadCount: 0 }
        : event.contact;
      const deliveredMessages = event.envelopes.length
        ? await decryptRealtimeEncryptedEnvelopes({
            currentUid,
            envelopes: event.envelopes,
            idToken: await getIdToken()
          })
        : [];
      const deliveredMessagesWithReactions = applyReactionMapToMessages(deliveredMessages, event.messageReactions);
      let nextContact = deliveredMessages.length
        ? applyLocalChatPreview(baseContact, deliveredMessagesWithReactions)
        : baseContact;

      applyVisibleChatContactUpdate(nextContact, shouldMarkRead);

      const cachedContact = await cacheRealtimeChatContact(nextContact);

      nextContact = cachedContact;

      if (deliveredMessagesWithReactions.length) {
        const cachedConversation = await loadCachedChatConversation({
          contactId: nextContact.contactId,
          ownerUid: currentUid
        }).catch(() => null);
        const mergedMessages = uniqueChatMessages([
          ...(cachedConversation?.messages || []),
          ...deliveredMessagesWithReactions
        ]);
        const visibleMergedMessages = await filterHiddenMessagesForChat(nextContact.contactId, mergedMessages);

        nextContact = applyLocalChatPreview(nextContact, visibleMergedMessages);

        if (shouldMarkRead && selectedChatRef.current?.contactId === nextContact.contactId) {
          setMessageReactions(event.messageReactions);
          setMessages(visibleMergedMessages);
        }

        await saveCachedChatConversation({
          contact: nextContact,
          contactId: nextContact.contactId,
          messages: visibleMergedMessages,
          ownerUid: currentUid
        });
        queueEncryptedChatBackup();
        queueMediaDownloadsForMessages(nextContact.contactId, visibleMergedMessages, nextContact.chatType || 'DIRECT');
      } else if (shouldMarkRead) {
        const cachedConversation = await loadCachedChatConversation({
          contactId: nextContact.contactId,
          ownerUid: currentUid
        }).catch(() => null);
        const reactedMessages = await filterHiddenMessagesForChat(nextContact.contactId, applyReactionMapToMessages(
          cachedConversation?.messages || messagesRef.current,
          event.messageReactions
        ));

        if (selectedChatRef.current?.contactId === nextContact.contactId) {
          setMessageReactions(event.messageReactions);
          setMessages(reactedMessages);
        }

        if (reactedMessages.length) {
          await saveCachedChatConversation({
            contact: nextContact,
            contactId: nextContact.contactId,
            messages: reactedMessages,
            ownerUid: currentUid
          });
          queueEncryptedChatBackup();
        }
      }

      applyVisibleChatContactUpdate(nextContact, shouldMarkRead);
      return;
    }

    if (event.type === 'conversationMessages' || event.type === 'conversationEncryptedEnvelopes') {
      if (selectedChatRef.current?.contactId !== event.contactId) {
        return;
      }

      const cachedContact = await cacheRealtimeChatContact({
        ...event.contact,
        unreadCount: 0
      });
      const [cachedConversation, pendingMessages] = await Promise.all([
        loadCachedChatConversation({
          contactId: event.contactId,
          ownerUid: currentUid
        }).catch(() => null),
        listPendingChatMessages({
          contactId: event.contactId,
          ownerUid: currentUid
        })
      ]);
      const serverMessages = uniqueChatMessages(event.type === 'conversationEncryptedEnvelopes'
        ? await decryptRealtimeEncryptedEnvelopes({
            currentUid,
            envelopes: event.envelopes,
            idToken: await getIdToken()
          })
        : event.messages);
      const eventReactionMap = event.type === 'conversationEncryptedEnvelopes'
        ? event.messageReactions
        : {};
      const persistedMessages = uniqueChatMessages([
        ...(cachedConversation?.messages || []),
        ...serverMessages
      ]);
      const persistedMessagesWithReactions = event.type === 'conversationEncryptedEnvelopes'
        ? applyReactionMapToMessages(persistedMessages, eventReactionMap)
        : persistedMessages;
      const visiblePersistedMessages = await filterHiddenMessagesForChat(event.contactId, persistedMessagesWithReactions);
      const nextMessages = uniqueChatMessages([
        ...visiblePersistedMessages,
        ...pendingMessages.map((pendingMessage) => pendingMessage.message)
      ]);
      const contactWithLocalPreview = applyLocalChatPreview(cachedContact, nextMessages);
      const isConversationStillOpen = selectedChatRef.current?.contactId === event.contactId;

      if (event.type === 'conversationEncryptedEnvelopes' && isConversationStillOpen) {
        setMessageReactions(eventReactionMap);
      }
      if (isConversationStillOpen) {
        setMessages(nextMessages);
        setSelectedChat(mapChatContactToChatItem(contactWithLocalPreview));
      }
      setChatContacts((currentContacts) => upsertChatContact(currentContacts, contactWithLocalPreview));
      await saveCachedChatConversation({
        contact: contactWithLocalPreview,
        contactId: event.contactId,
        messages: visiblePersistedMessages,
        ownerUid: currentUid
      });
      queueEncryptedChatBackup();
      queueMediaDownloadsForMessages(event.contactId, nextMessages, event.contact.chatType || 'DIRECT');
      void syncPendingMessagesForChat(event.contactId);
    }
  }

  async function cacheRealtimeChatContact(contact: ChatContact): Promise<ChatContact> {
    const idToken = await getIdToken();

    setProfilePhotoAuthToken(idToken);

    return cacheChatContactPhoto(contact, idToken);
  }

  function sendActiveRealtimeConversationSubscription() {
    const socket = realtimeSocketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN || !realtimeReadyRef.current) {
      return;
    }

    if (selectedChatRef.current) {
      subscribeRealtimeConversation(socket, selectedChatRef.current.contactId);
      return;
    }

    unsubscribeRealtimeConversation(socket);
  }

  async function handleOpenChat(chat: ChatItem) {
    const openRequestId = chatOpenRequestIdRef.current + 1;

    chatOpenRequestIdRef.current = openRequestId;
    selectedChatRef.current = chat;
    setSelectedChat(chat);
    setChatContacts((currentContacts) => currentContacts.map((contact) =>
      contact.contactId === chat.contactId
        ? { ...contact, unreadCount: 0 }
        : contact
    ));
    setMessageDraft('');
    setReplyTarget(null);
    resetForwardMode();
    setMessages([]);
    setMessageReactions({});
    setError(null);
    await loadCachedMessagesForChat(chat, openRequestId);

    if (!isActiveChatOpenRequest(openRequestId, chat.contactId)) {
      return;
    }

    await loadMessagesForChat(chat, true, openRequestId);
  }

  async function handleOpenGroupFromGroupsTab(group: TenantGroup) {
    setError(null);
    setActiveTab('Chats');
    setSettingsScreen('list');

    const existingContact = chatContactsRef.current.find((contact) =>
      contact.chatType === 'GROUP' &&
      contact.contactId === group.groupId
    );

    if (existingContact) {
      await handleOpenChat(mapChatContactToChatItem(existingContact));
      return;
    }

    try {
      const idToken = await getIdToken();
      const groupContacts = await listGroupChatContacts(idToken);
      const groupContact = groupContacts.find((contact) => contact.contactId === group.groupId);

      if (!groupContact) {
        throw new Error('This group chat is not available for your account yet.');
      }

      const cachedContact = await cacheChatContactPhoto(groupContact, idToken);

      setProfilePhotoAuthToken(idToken);
      setChatContacts((currentContacts) => upsertChatContact(currentContacts, cachedContact));
      await handleOpenChat(mapChatContactToChatItem(cachedContact));
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to open group chat.'));
    }
  }

  function handleOpenNewChatModal() {
    setNewChatSearch('');
    setIsNewChatModalOpen(true);
  }

  function handleCloseNewChatModal() {
    setIsNewChatModalOpen(false);
    setIsAddMembersModalOpen(false);
    setIsGroupDetailsModalOpen(false);
    setIsGroupPermissionsModalOpen(false);
    setNewChatSearch('');
    setAddMembersSearch('');
    setNewGroupNameDraft('');
    setNewGroupPhotoUri(null);
    setNewGroupPermissionMode('ALL_MEMBERS');
    setSelectedNewGroupMemberIds({});
  }

  async function handleOpenContactFromNewChat(contact: ChatContact) {
    handleCloseNewChatModal();
    await handleOpenChat(mapChatContactToChatItem(contact));
  }

  function handleOpenAddMembersModal() {
    setAddMembersSearch('');
    setIsNewChatModalOpen(false);
    setIsAddMembersModalOpen(true);
  }

  function handleOpenGroupCallOptions() {
    const chat = selectedChatRef.current;

    if (!isUserCreatedGroupChat(chat)) {
      return;
    }

    setIsGroupCallPeopleModalOpen(false);
    setIsGroupCallOptionsOpen(true);
  }

  function handleOpenGroupSwitcher() {
    const chat = selectedChatRef.current;

    if (!isUserCreatedGroupChat(chat)) {
      return;
    }

    setIsGroupCallOptionsOpen(false);
    setIsGroupCallPeopleModalOpen(false);
    setIsGroupSwitcherModalOpen(true);
    void loadGroupSettings(false);
  }

  function handleStartGroupCreateFromSwitcher() {
    setIsGroupSwitcherModalOpen(false);
    setNewChatSearch('');
    setAddMembersSearch('');
    setNewGroupNameDraft('');
    setNewGroupPhotoUri(null);
    setNewGroupPermissionMode('ALL_MEMBERS');
    setSelectedNewGroupMemberIds({});
    setIsNewChatModalOpen(false);
    setIsAddMembersModalOpen(true);
  }

  function handleOpenGroupFromSwitcher(group: TenantGroup) {
    setIsGroupSwitcherModalOpen(false);
    void handleOpenGroupFromGroupsTab(group);
  }

  function handleOpenGroupCallPeopleModal(mode: GroupCallMode = 'select') {
    const chat = selectedChatRef.current;

    if (!isUserCreatedGroupChat(chat)) {
      return;
    }

    setGroupCallMode(mode);
    setGroupCallPeopleSearch('');
    setSelectedGroupCallMemberIds({});
    setIsGroupCallOptionsOpen(false);
    setIsGroupCallPeopleModalOpen(true);
  }

  function handleCloseGroupCallPeopleModal() {
    setIsGroupCallPeopleModalOpen(false);
    setGroupCallPeopleSearch('');
    setSelectedGroupCallMemberIds({});
  }

  function handleSelectGroupCallOption(option: GroupCallOption) {
    if (option === 'selectPeople') {
      handleOpenGroupCallPeopleModal('select');
      return;
    }

    if (option === 'voice' || option === 'video') {
      handleOpenGroupCallPeopleModal(option);
      return;
    }

    setIsGroupCallOptionsOpen(false);
    Alert.alert(
      option === 'sendLink' ? 'Send call link' : 'Schedule call',
      'This group call action is ready in the menu and will connect to the call service when calling is enabled.'
    );
  }

  function handleToggleGroupCallMember(contactId: string) {
    setSelectedGroupCallMemberIds((currentMemberIds) => {
      const nextMemberIds = { ...currentMemberIds };

      if (nextMemberIds[contactId]) {
        delete nextMemberIds[contactId];
      } else {
        nextMemberIds[contactId] = true;
      }

      return nextMemberIds;
    });
  }

  function handleConfirmGroupCallPeople() {
    if (!selectedGroupCallMemberCount) {
      return;
    }

    const modeLabel = groupCallMode === 'voice'
      ? 'Voice call'
      : groupCallMode === 'video'
        ? 'Video call'
        : 'Selected people';

    setIsGroupCallPeopleModalOpen(false);
    Alert.alert(modeLabel, `${selectedGroupCallMemberCount} ${selectedGroupCallMemberCount === 1 ? 'person' : 'people'} selected.`);
    setGroupCallPeopleSearch('');
    setSelectedGroupCallMemberIds({});
  }

  function handleReturnToNewChatModal() {
    setIsAddMembersModalOpen(false);
    setIsNewChatModalOpen(true);
  }

  function handleToggleNewGroupMember(contactId: string) {
    setSelectedNewGroupMemberIds((currentMemberIds) => {
      const nextMemberIds = { ...currentMemberIds };

      if (nextMemberIds[contactId]) {
        delete nextMemberIds[contactId];
      } else {
        nextMemberIds[contactId] = true;
      }

      return nextMemberIds;
    });
  }

  function handleRemoveNewGroupMember(contactId: string) {
    setSelectedNewGroupMemberIds((currentMemberIds) => {
      const nextMemberIds = { ...currentMemberIds };

      delete nextMemberIds[contactId];
      return nextMemberIds;
    });
  }

  function handleOpenGroupDetailsModal() {
    if (!selectedNewGroupMembers.length) {
      Alert.alert('Add members', 'Select at least one member before continuing.');
      return;
    }

    setIsAddMembersModalOpen(false);
    setIsGroupDetailsModalOpen(true);
  }

  function handleReturnToAddMembersModal() {
    setIsGroupDetailsModalOpen(false);
    setIsAddMembersModalOpen(true);
  }

  function handleOpenGroupPermissionsModal() {
    setIsGroupDetailsModalOpen(false);
    setIsGroupPermissionsModalOpen(true);
  }

  function handleReturnToGroupDetailsModal() {
    setIsGroupPermissionsModalOpen(false);
    setIsGroupDetailsModalOpen(true);
  }

  async function handlePickNewGroupPhoto() {
    try {
      const pickedPhoto = await pickNativeProfilePhoto({
        message: 'Add a group photo using your camera or photo library.',
        title: 'Group photo'
      });

      if (pickedPhoto?.uri) {
        setNewGroupPhotoUri(pickedPhoto.uri);
      }
    } catch (nextError) {
      Alert.alert('Group photo unavailable', getErrorMessage(nextError, 'Unable to add this group photo.'));
    }
  }

  async function handleCreateGroupChatDraft() {
    if (isSavingGroup) {
      return;
    }

    const groupName = newGroupNameDraft.trim();

    if (!groupName) {
      Alert.alert('Group name required', 'Enter a group name before creating the group chat.');
      return;
    }

    if (!selectedNewGroupMembers.length) {
      Alert.alert('Add members', 'Select at least one member before creating the group chat.');
      return;
    }

    const unavailableMember = selectedNewGroupMembers.find((member) => !member.hasActiveDevice);

    if (unavailableMember) {
      Alert.alert(
        'Secure device needed',
        getRecipientDeviceNotReadyMessage(unavailableMember.displayName)
      );
      return;
    }

    setIsSavingGroup(true);
    setError(null);

    try {
      const idToken = await getIdToken();
      const groupContact = await createGroupChat({
        idToken,
        memberIds: selectedNewGroupMembers.map((member) => member.contactId),
        messagePermissionMode: newGroupPermissionMode,
        name: groupName
      });
      const cachedContact = await cacheChatContactPhoto(groupContact, idToken);

      setProfilePhotoAuthToken(idToken);
      setChatContacts((currentContacts) => upsertChatContact(currentContacts, cachedContact));
      setActiveTab('Chats');
      handleCloseNewChatModal();
      await handleOpenChat(mapChatContactToChatItem(cachedContact));
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to create group chat.'));
    } finally {
      setIsSavingGroup(false);
    }
  }

  async function openChatFromPushNotification(data: ChatPushNotificationData) {
    setActiveTab('Chats');
    setSettingsScreen('list');
    const existingContact = chatContactsRef.current.find((contact) => contact.contactId === data.contactId);

    if (existingContact) {
      await handleOpenChat(mapChatContactToChatItem(existingContact));
      return;
    }

    const refreshedContacts = await loadChatContacts(false);
    const refreshedContact = refreshedContacts.find((contact) => contact.contactId === data.contactId);

    if (refreshedContact) {
      await handleOpenChat(mapChatContactToChatItem(refreshedContact));
    }
  }

  function isActiveChatOpenRequest(openRequestId: number | undefined, contactId: string): boolean {
    return openRequestId === undefined ||
      (chatOpenRequestIdRef.current === openRequestId && selectedChatRef.current?.contactId === contactId);
  }

  function getChatTypeForContactId(contactId: string): 'DIRECT' | 'GROUP' {
    if (selectedChatRef.current?.contactId === contactId) {
      return selectedChatRef.current.chatType;
    }

    return chatContactsRef.current.find((contact) => contact.contactId === contactId)?.chatType || 'DIRECT';
  }

  async function filterHiddenMessagesForChat(contactId: string, messages: ChatMessage[]): Promise<ChatMessage[]> {
    const hiddenMessageIds = await loadHiddenChatMessageIds({
      contactId,
      ownerUid: currentUid
    }).catch(() => []);

    if (!hiddenMessageIds.length) {
      return messages;
    }

    const hiddenMessageIdSet = new Set(hiddenMessageIds);

    return messages.filter((message) => !hiddenMessageIdSet.has(message.messageId));
  }

  async function loadCachedMessagesForChat(chat: ChatItem, openRequestId?: number) {
    try {
      const [cachedConversation, pendingMessages] = await Promise.all([
        loadCachedChatConversation({
          contactId: chat.contactId,
          ownerUid: currentUid
        }),
        listPendingChatMessages({
          contactId: chat.contactId,
          ownerUid: currentUid
        })
      ]);
      const nextMessages = uniqueChatMessages([
        ...(cachedConversation?.messages || []),
        ...pendingMessages.map((pendingMessage) => pendingMessage.message)
      ]);

      if (!isActiveChatOpenRequest(openRequestId, chat.contactId)) {
        return;
      }

      if (cachedConversation?.contact) {
        setSelectedChat(mapChatContactToChatItem({
          ...cachedConversation.contact,
          unreadCount: 0
        }));
      }

      if (nextMessages.length) {
        setMessageReactions(extractReactionMapFromMessages(nextMessages));
        setMessages(nextMessages);
      }
    } catch {
      // Local cache should never block opening a live chat.
    }
  }

  async function loadMessagesForChat(chat: ChatItem, showError = true, openRequestId?: number) {
    setIsLoadingMessages(true);

    try {
      const idToken = await getIdToken();
      const result = await getChatMessages({
        chatType: chat.chatType,
        contactId: chat.contactId,
        currentUid,
        idToken
      });
      const cachedContact = await cacheChatContactPhoto(result.contact, idToken);
      const [cachedConversation, pendingMessages] = await Promise.all([
        loadCachedChatConversation({
          contactId: chat.contactId,
          ownerUid: currentUid
        }).catch(() => null),
        listPendingChatMessages({
          contactId: chat.contactId,
          ownerUid: currentUid
        })
      ]);
      const serverMessages = applyReactionMapToMessages(uniqueChatMessages(result.messages), result.messageReactions);
      const persistedMessages = applyReactionMapToMessages(uniqueChatMessages([
        ...(cachedConversation?.messages || []),
        ...serverMessages
      ]), result.messageReactions);
      const visiblePersistedMessages = await filterHiddenMessagesForChat(chat.contactId, persistedMessages);
      const nextMessages = uniqueChatMessages([
        ...visiblePersistedMessages,
        ...pendingMessages.map((pendingMessage) => pendingMessage.message)
      ]);
      const contactWithLocalPreview = applyLocalChatPreview(cachedContact, nextMessages);

      if (!isActiveChatOpenRequest(openRequestId, chat.contactId)) {
        return;
      }

      setProfilePhotoAuthToken(idToken);
      setMessageReactions(result.messageReactions);
      setSelectedChat(mapChatContactToChatItem(contactWithLocalPreview));
      setMessages(nextMessages);
      setChatContacts((currentContacts) => upsertChatContact(currentContacts, {
        ...contactWithLocalPreview,
        unreadCount: 0
      }));
      await saveCachedChatConversation({
        contact: contactWithLocalPreview,
        contactId: chat.contactId,
        messages: visiblePersistedMessages,
        ownerUid: currentUid
      });
      queueEncryptedChatBackup();
      void syncPendingMessagesForChat(chat.contactId);
    } catch (nextError) {
      if (showError && isActiveChatOpenRequest(openRequestId, chat.contactId) && !isNetworkUnavailableError(nextError)) {
        setError(getErrorMessage(nextError, 'Unable to open chat.'));
      }
    } finally {
      if (isActiveChatOpenRequest(openRequestId, chat.contactId)) {
        setIsLoadingMessages(false);
      }
    }
  }

  async function syncPendingMessagesForChat(contactId: string) {
    if (pendingSyncContactIdsRef.current.has(contactId)) {
      return;
    }

    pendingSyncContactIdsRef.current.add(contactId);

    try {
      const pendingMessages = await listPendingChatMessages({
        contactId,
        ownerUid: currentUid
      });
      const syncablePendingMessages = pendingMessages.filter((pendingMessage) =>
        !activeLocalSendQueueIdsRef.current.has(pendingMessage.queueId)
      );

      if (!syncablePendingMessages.length) {
        return;
      }

      const idToken = await getIdToken();

      for (const pendingMessage of syncablePendingMessages) {
        await updatePendingChatMessage({
          lastError: null,
          ownerUid: currentUid,
          queueId: pendingMessage.queueId,
          status: 'sending'
        });

        try {
          const pendingMedia = getMessageMedia(pendingMessage.message);
          const pendingMediaItems = getMessageMediaItems(pendingMessage.message);
          const sendMediaItems = pendingMediaItems.length > 1
            ? await Promise.all(pendingMediaItems.map((mediaItem, index) => uploadMediaForMessage({
                chatType: pendingMessage.chatType || 'DIRECT',
                contactId,
                idToken,
                media: mediaItem,
                mediaIndex: index,
                messageId: pendingMessage.queueId
              })))
            : [];
          const sendMedia = pendingMedia && !sendMediaItems.length
            ? await uploadMediaForMessage({
                chatType: pendingMessage.chatType || 'DIRECT',
                contactId,
                idToken,
                media: pendingMedia,
                messageId: pendingMessage.queueId
              })
            : null;
          const result = await sendChatMessage({
            chatType: pendingMessage.chatType || 'DIRECT',
            contactId,
            currentUid,
            idToken,
            media: sendMedia,
            mediaItems: sendMediaItems,
            replyTo: pendingMessage.message.replyTo || null,
            text: pendingMessage.text
          });
          const cachedContact = await cacheChatContactPhoto(result.contact, idToken);

          await removePendingChatMessage({
            ownerUid: currentUid,
            queueId: pendingMessage.queueId
          });

          setProfilePhotoAuthToken(idToken);
          void updateSyncedPendingMessage({
            contact: cachedContact,
            contactId,
            pendingQueueId: pendingMessage.queueId,
            sentMessage: result.message
          });
        } catch (syncError) {
          await updatePendingChatMessage({
            lastError: getErrorMessage(syncError, 'Unable to sync queued message.'),
            ownerUid: currentUid,
            queueId: pendingMessage.queueId,
            status: 'failed'
          });
        }
      }
    } finally {
      pendingSyncContactIdsRef.current.delete(contactId);
    }
  }

  async function syncAllPendingMessages() {
    const pendingMessages = await listPendingChatMessages({
      ownerUid: currentUid
    }).catch(() => []);
    const contactIds = Array.from(new Set(pendingMessages.map((pendingMessage) => pendingMessage.contactId)));

    contactIds.forEach((contactId) => {
      void syncPendingMessagesForChat(contactId);
    });
  }

  async function updateSyncedPendingMessage(input: {
    contact: ChatContact;
    contactId: string;
    pendingQueueId: string;
    sentMessage: ChatMessage;
  }) {
    const cachedConversation = await loadCachedChatConversation({
      contactId: input.contactId,
      ownerUid: currentUid
    }).catch(() => null);
    const pendingLocalMessage = [
      ...(cachedConversation?.messages || []),
      ...messagesRef.current
    ].find((message) => message.messageId === input.pendingQueueId) || null;
    const sentMessage = mergeSyncedMessageWithPendingLocalMedia(input.sentMessage, pendingLocalMessage);
    const nextCachedMessages = uniqueChatMessages([
      ...(cachedConversation?.messages || []).filter((message) => message.messageId !== input.pendingQueueId),
      sentMessage
    ]);
    const contactWithLocalPreview = applyLocalChatPreview(input.contact, nextCachedMessages);

    await saveCachedChatConversation({
      contact: contactWithLocalPreview,
      contactId: input.contactId,
      messages: nextCachedMessages.filter((message) => message.deliveryStatus !== 'queued'),
      ownerUid: currentUid
    });
    queueEncryptedChatBackup();

    if (selectedChatRef.current?.contactId === input.contactId) {
      setMessages((currentMessages) => uniqueChatMessages([
        ...currentMessages.filter((message) => message.messageId !== input.pendingQueueId),
        sentMessage
      ]));
      setSelectedChat(mapChatContactToChatItem(contactWithLocalPreview));
    }

    setChatContacts((currentContacts) => upsertChatContact(currentContacts, contactWithLocalPreview));
  }

  function addVisibleLocalMessage(contactId: string, message: ChatMessage) {
    if (selectedChatRef.current?.contactId === contactId) {
      setMessages((currentMessages) => uniqueChatMessages([...currentMessages, message]));
      setSelectedChat((currentChat) => currentChat?.contactId === contactId
        ? {
            ...currentChat,
            lastMessageAt: message.sentAt,
            preview: getChatMessagePreview(message)
          }
        : currentChat);
    }

    setChatContacts((currentContacts) => {
      const contact = currentContacts.find((currentContact) => currentContact.contactId === contactId);

      return contact
        ? upsertChatContact(currentContacts, applyLocalChatPreview(contact, [message]))
        : currentContacts;
    });
  }

  function replaceVisibleLocalMessage(contactId: string, messageId: string, replacement: ChatMessage) {
    if (selectedChatRef.current?.contactId === contactId) {
      setMessages((currentMessages) => uniqueChatMessages(currentMessages.map((message) =>
        message.messageId === messageId ? replacement : message
      )));
      setSelectedChat((currentChat) => currentChat?.contactId === contactId
        ? {
            ...currentChat,
            lastMessageAt: replacement.sentAt,
            preview: getChatMessagePreview(replacement)
          }
        : currentChat);
    }

    setChatContacts((currentContacts) => {
      const contact = currentContacts.find((currentContact) => currentContact.contactId === contactId);

      return contact
        ? upsertChatContact(currentContacts, applyLocalChatPreview(contact, [replacement]))
        : currentContacts;
    });
  }

  function removeVisibleLocalMessage(contactId: string, messageId: string) {
    if (selectedChatRef.current?.contactId === contactId) {
      setMessages((currentMessages) => currentMessages.filter((message) => message.messageId !== messageId));
    }
  }

  function updateVisibleMessageMedia(
    contactId: string,
    messageId: string,
    media: ChatMediaAttachment,
    mediaIndex?: number
  ) {
    if (selectedChatRef.current?.contactId === contactId) {
      setMessages((currentMessages) => uniqueChatMessages(currentMessages.map((message) =>
        message.messageId === messageId
          ? applyMediaUpdateToMessage(message, media, mediaIndex)
          : message
      )));
    }
  }

  async function uploadMediaForMessage(input: {
    chatType: 'DIRECT' | 'GROUP';
    contactId: string;
    idToken: string;
    media: ChatMediaAttachment;
    mediaIndex?: number;
    messageId: string;
  }): Promise<ChatMediaAttachment> {
    if (input.media.mediaId && input.media.key && input.media.nonce) {
      return {
        ...input.media,
        transferProgress: 1,
        transferStatus: 'available'
      };
    }

    const localMedia = toLocalChatMediaInput(input.media);
    const uploadedMedia = await uploadEncryptedChatMedia({
      chatType: input.chatType,
      contactId: input.contactId,
      idToken: input.idToken,
      media: localMedia,
      onProgress: (progress) => {
        updateVisibleMessageMedia(input.contactId, input.messageId, {
          ...input.media,
          transferProgress: progress,
          transferStatus: 'uploading'
        }, input.mediaIndex);
      }
    });

    const availableMedia: ChatMediaAttachment = {
      ...uploadedMedia,
      transferProgress: 1,
      transferStatus: 'available'
    };

    updateVisibleMessageMedia(input.contactId, input.messageId, availableMedia, input.mediaIndex);

    return availableMedia;
  }

  async function downloadMediaForMessage(
    contactId: string,
    chatType: 'DIRECT' | 'GROUP',
    messageId: string,
    media: ChatMediaAttachment,
    mediaIndex?: number
  ): Promise<string | null> {
    const mediaDownloadKey = `${contactId}:${messageId}:${media.mediaId}`;
    const activeDownload = activeMediaDownloadPromisesRef.current.get(mediaDownloadKey);

    if (activeDownload) {
      return activeDownload;
    }

    const downloadPromise = (async () => {
      let lastProgressUpdate = 0;

      updateVisibleMessageMedia(contactId, messageId, {
        ...media,
        transferProgress: 0,
        transferStatus: 'downloading'
      }, mediaIndex);

      try {
        const idToken = await getIdToken();
        const localUri = await downloadAndDecryptChatMedia({
          chatType,
          contactId,
          idToken,
          media,
          onProgress: (progress) => {
            if (progress < 1 && progress - lastProgressUpdate < 0.04) {
              return;
            }

            lastProgressUpdate = progress;
            updateVisibleMessageMedia(contactId, messageId, {
              ...media,
              transferProgress: progress,
              transferStatus: 'downloading'
            }, mediaIndex);
          }
        });
        const availableMedia: ChatMediaAttachment = {
          ...media,
          localUri,
          transferProgress: 1,
          transferStatus: 'available'
        };

        updateVisibleMessageMedia(contactId, messageId, availableMedia, mediaIndex);
        await persistMessageMediaUpdate(contactId, messageId, availableMedia, mediaIndex);

        return localUri;
      } catch {
        updateVisibleMessageMedia(contactId, messageId, {
          ...media,
          transferProgress: 0,
          transferStatus: 'failed'
        }, mediaIndex);

        return null;
      } finally {
        activeMediaDownloadPromisesRef.current.delete(mediaDownloadKey);
      }
    })();

    activeMediaDownloadPromisesRef.current.set(mediaDownloadKey, downloadPromise);

    return downloadPromise;
  }

  function queueMediaDownloadsForMessages(
    contactId: string,
    nextMessages: ChatMessage[],
    chatType = getChatTypeForContactId(contactId)
  ) {
    nextMessages.forEach((message) => {
      const mediaItems = getMessageMediaItems(message);

      mediaItems.forEach((media, index) => {
        if (
          !media ||
          !media.mediaId ||
          !media.key ||
          !media.nonce ||
          media.kind === 'file' ||
          media.localUri ||
          media.transferStatus === 'downloading' ||
          media.transferStatus === 'failed'
        ) {
          return;
        }

        void downloadMediaForMessage(contactId, chatType, message.messageId, media, index);
      });
    });
  }

  async function persistMessageMediaUpdate(
    contactId: string,
    messageId: string,
    media: ChatMediaAttachment,
    mediaIndex?: number
  ) {
    const cachedConversation = await loadCachedChatConversation({
      contactId,
      ownerUid: currentUid
    }).catch(() => null);

    if (!cachedConversation) {
      return;
    }

    await saveCachedChatConversation({
      contact: cachedConversation.contact,
      contactId,
      messages: cachedConversation.messages.map((message) =>
        message.messageId === messageId
          ? applyMediaUpdateToMessage(message, media, mediaIndex)
          : message
      ),
      ownerUid: currentUid
    });
  }

  async function handleSendMessage() {
    if (!selectedChat) {
      return;
    }

    const activeChat = selectedChat;
    const text = messageDraft.trim();

    if (!text) {
      return;
    }

    if (!activeChat.hasActiveDevice) {
      setError(getChatDeviceNotReadyMessage(activeChat));
      return;
    }

    setError(null);
    const replyReference = replyTarget ? buildReplyReference(replyTarget) : null;

    await queueAndSendChatPayload({
      activeChat,
      clearDraft: true,
      media: null,
      replyReference,
      text
    });
  }

  async function handlePickChatMedia() {
    if (!selectedChat) {
      return;
    }

    const activeChat = selectedChat;

    if (!activeChat.hasActiveDevice) {
      setError(getChatDeviceNotReadyMessage(activeChat));
      return;
    }

    try {
      const localMediaItems = await pickNativeChatCameraMedia();

      if (!localMediaItems?.length) {
        return;
      }

      setError(null);
      setMediaReviewItems(localMediaItems.map((localMedia, index) => ({
        id: `media_review_${Date.now()}_${index}_${localMedia.fileName}`,
        media: localMedia
      })));
      setMediaReviewActiveIndex(0);
      setMediaReviewCaption('');
    } catch (nextError) {
      Alert.alert('Media not sent', getErrorMessage(nextError, 'Unable to prepare this media.'));
    }
  }

  function handleCancelMediaReview() {
    if (isSendingMediaReview) {
      return;
    }

    setMediaReviewItems([]);
    setMediaReviewActiveIndex(0);
    setMediaReviewCaption('');
  }

  function handleSelectMediaReviewIndex(index: number) {
    setMediaReviewActiveIndex(Math.max(0, Math.min(index, mediaReviewItems.length - 1)));
  }

  function handleUpdateMediaReviewCaption(value: string) {
    setMediaReviewCaption(value);
  }

  function handleRemoveMediaReviewItem(index: number) {
    if (isSendingMediaReview) {
      return;
    }

    setMediaReviewItems((currentItems) => {
      const nextItems = currentItems.filter((_item, itemIndex) => itemIndex !== index);

      setMediaReviewActiveIndex((currentIndex) => Math.max(0, Math.min(currentIndex, nextItems.length - 1)));

      return nextItems;
    });
  }

  function handleSendMediaReview() {
    if (!selectedChat || !mediaReviewItems.length || isSendingMediaReview) {
      return;
    }

    const activeChat = selectedChat;
    const caption = mediaReviewCaption.trim();

    if (!activeChat.hasActiveDevice) {
      setError(getChatDeviceNotReadyMessage(activeChat));
      return;
    }

    const itemsToSend = mediaReviewItems;
    const replyReference = replyTarget ? buildReplyReference(replyTarget) : null;

    setIsSendingMediaReview(true);
    setMediaReviewItems([]);
    setMediaReviewActiveIndex(0);
    setMediaReviewCaption('');
    setIsSendingMediaReview(false);
    setError(null);

    if (itemsToSend.length > 1) {
      void queueAndSendChatPayload({
        activeChat,
        clearDraft: false,
        media: null,
        mediaItems: itemsToSend.map((item) => buildLocalChatMediaAttachment(item.media)),
        replyReference,
        text: caption
      });
      return;
    }

    const item = itemsToSend[0];

    if (item) {
      void queueAndSendChatPayload({
        activeChat,
        clearDraft: false,
        media: buildLocalChatMediaAttachment(item.media),
        mediaItems: [],
        replyReference,
        text: caption
      });
    }
  }

  async function handlePickChatFile() {
    if (!selectedChat) {
      return;
    }

    const activeChat = selectedChat;

    if (!activeChat.hasActiveDevice) {
      setError(getChatDeviceNotReadyMessage(activeChat));
      return;
    }

    try {
      const localMedia = await pickNativeChatFile();

      if (!localMedia) {
        return;
      }

      const replyReference = replyTarget ? buildReplyReference(replyTarget) : null;

      setError(null);
      await queueAndSendChatPayload({
        activeChat,
        clearDraft: false,
        media: buildLocalChatMediaAttachment(localMedia),
        replyReference,
        text: ''
      });
    } catch (nextError) {
      Alert.alert('File not sent', getErrorMessage(nextError, 'Unable to prepare this file.'));
    }
  }

  async function handleSendVoiceNote(localMedia: LocalChatMediaInput) {
    if (!selectedChat) {
      return;
    }

    const activeChat = selectedChat;

    if (!activeChat.hasActiveDevice) {
      setError(getChatDeviceNotReadyMessage(activeChat));
      return;
    }

    try {
      const replyReference = replyTarget ? buildReplyReference(replyTarget) : null;

      setError(null);
      await queueAndSendChatPayload({
        activeChat,
        clearDraft: false,
        media: buildLocalChatMediaAttachment(localMedia),
        replyReference,
        text: ''
      });
    } catch (nextError) {
      Alert.alert('Voice note not sent', getErrorMessage(nextError, 'Unable to prepare this voice note.'));
    }
  }

  async function queueAndSendChatPayload(input: {
    activeChat: ChatItem;
    clearDraft: boolean;
    media: ChatMediaAttachment | null;
    mediaItems?: ChatMediaAttachment[];
    replyReference: ChatReplyReference | null;
    text: string;
  }) {
    const { activeChat, clearDraft, media, replyReference, text } = input;
    const mediaItems = input.mediaItems || [];
    const primaryMedia = media || mediaItems[0] || null;

    let pendingMessage: Awaited<ReturnType<typeof enqueuePendingChatMessage>>;

    try {
      pendingMessage = await enqueuePendingChatMessage({
        contactId: activeChat.contactId,
        chatType: activeChat.chatType,
        media: media
          ? {
              ...media,
              transferProgress: 0,
              transferStatus: 'queued'
            }
          : null,
        mediaItems: mediaItems.map((mediaItem) => ({
          ...mediaItem,
          transferProgress: 0,
          transferStatus: 'queued'
        })),
        ownerUid: currentUid,
        replyTo: replyReference,
        senderUid: currentUid,
        text
      });
    } catch (queueError) {
      setError(getErrorMessage(queueError, 'Unable to prepare this message.'));
      return;
    }

    const optimisticMessage: ChatMessage = {
      ...pendingMessage.message,
      deliveryStatus: 'sent',
      media: primaryMedia
        ? {
            ...primaryMedia,
            transferProgress: 0,
            transferStatus: 'uploading'
          }
        : null,
      image: primaryMedia?.kind === 'image'
        ? {
            ...primaryMedia,
            contentType: 'image/jpeg',
            height: primaryMedia.height || 1,
            kind: 'image',
            width: primaryMedia.width || 1
          } as ChatImageAttachment
        : null,
      mediaItems: mediaItems.map((mediaItem) => ({
        ...mediaItem,
        transferProgress: 0,
        transferStatus: 'uploading'
      }))
    };

    if (clearDraft) {
      setMessageDraft('');
    }
    setReplyTarget(null);
    addVisibleLocalMessage(activeChat.contactId, optimisticMessage);
    activeLocalSendQueueIdsRef.current.add(pendingMessage.queueId);

    try {
      const idToken = await getIdToken();
      const sendMediaItems = mediaItems.length > 1
        ? await Promise.all(mediaItems.map((mediaItem, index) => uploadMediaForMessage({
            chatType: activeChat.chatType,
            contactId: activeChat.contactId,
            idToken,
            media: mediaItem,
            mediaIndex: index,
            messageId: pendingMessage.queueId
          })))
        : [];
      const sendMedia = media && !sendMediaItems.length
        ? await uploadMediaForMessage({
            chatType: activeChat.chatType,
            contactId: activeChat.contactId,
            idToken,
            media,
            messageId: pendingMessage.queueId
          })
        : null;
      const result = await sendChatMessage({
        chatType: activeChat.chatType,
        contactId: activeChat.contactId,
        currentUid,
        idToken,
        media: sendMedia,
        mediaItems: sendMediaItems,
        replyTo: replyReference,
        text
      });
      const cachedContact = await cacheChatContactPhoto(result.contact, idToken);

      await removePendingChatMessage({
        ownerUid: currentUid,
        queueId: pendingMessage.queueId
      });

      setProfilePhotoAuthToken(idToken);
      void updateSyncedPendingMessage({
        contact: cachedContact,
        contactId: activeChat.contactId,
        pendingQueueId: pendingMessage.queueId,
        sentMessage: result.message
      });
    } catch (nextError) {
      if (isRecipientDeviceNotReadyError(nextError)) {
        await removePendingChatMessage({
          ownerUid: currentUid,
          queueId: pendingMessage.queueId
        }).catch(() => undefined);
        removeVisibleLocalMessage(activeChat.contactId, pendingMessage.queueId);
        setSelectedChat((currentChat) => currentChat
          ? { ...currentChat, hasActiveDevice: false }
          : currentChat);
        setChatContacts((currentContacts) => currentContacts.map((contact) =>
          contact.contactId === activeChat.contactId
            ? { ...contact, hasActiveDevice: false }
            : contact
        ));
        setError(getChatDeviceNotReadyMessage(activeChat));
        return;
      }

      if (isNetworkUnavailableError(nextError)) {
        await updatePendingChatMessage({
          lastError: getErrorMessage(nextError, 'Network unavailable.'),
          ownerUid: currentUid,
          queueId: pendingMessage.queueId,
          status: 'failed'
        });
        replaceVisibleLocalMessage(activeChat.contactId, pendingMessage.queueId, pendingMessage.message);
        return;
      }

      await removePendingChatMessage({
        ownerUid: currentUid,
        queueId: pendingMessage.queueId
      }).catch(() => undefined);
      removeVisibleLocalMessage(activeChat.contactId, pendingMessage.queueId);
      setError(getErrorMessage(nextError, 'Unable to send message.'));
    } finally {
      activeLocalSendQueueIdsRef.current.delete(pendingMessage.queueId);
    }
  }

  async function loadUserProfile(showError = true) {
    setIsLoadingUserProfile(true);

    try {
      const idToken = await getIdToken(true);
      const profile = await getCurrentUserProfile(idToken);
      const profileWithCachedPhoto = await cacheCurrentUserProfilePhoto(profile, idToken);

      setProfilePhotoAuthToken(idToken);
      setUserProfile(profileWithCachedPhoto);
      void registerCurrentDeviceIdentity(idToken);
    } catch (nextError) {
      if (showError) {
        setError(getErrorMessage(nextError, 'Unable to load your profile.'));
      }
    } finally {
      setIsLoadingUserProfile(false);
    }
  }

  async function handleUpdateUserProfilePhoto() {
    if (isSavingUserPhoto) {
      return;
    }

    setError(null);

    try {
      const photo = await pickNativeProfilePhoto();

      if (!photo) {
        return;
      }

      if (!photo.dataUrl) {
        setError('Unable to prepare this photo. Please choose another photo.');
        return;
      }

      setIsSavingUserPhoto(true);

      const idToken = await getIdToken();
      const profile = await updateCurrentUserProfilePhoto({
        idToken,
        profilePhotoDataUrl: photo.dataUrl
      });
      const cachedPhotoUri = await getCachedProfilePhotoUri({
        cacheKey: profile.profilePhotoCacheKey,
        idToken,
        profilePhotoUrl: profile.profilePhotoUrl
      });

      setProfilePhotoAuthToken(idToken);
      setUserProfile({
        ...profile,
        profilePhotoUrl: cachedPhotoUri || photo.uri
      });
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to update your profile photo.'));
    } finally {
      setIsSavingUserPhoto(false);
    }
  }

  function handleOpenMessageActions(message: ChatMessage) {
    Keyboard.dismiss();
    setMessageActionTarget(message);
  }

  async function handleReactToMessage(message: ChatMessage, reaction: string) {
    if (!selectedChat) {
      return;
    }

    if (message.messageId.startsWith('queued_')) {
      Alert.alert('Reaction not sent', 'This message has not been sent yet.');
      setMessageActionTarget(null);
      return;
    }

    const activeChat = selectedChat;
    const previousReactions = messageReactions;
    const optimisticReactions = upsertMessageReaction(
      previousReactions,
      message.messageId,
      currentUid,
      reaction
    );

    setMessageReactions(optimisticReactions);
    setMessages((currentMessages) => applyReactionMapToMessages(currentMessages, optimisticReactions));
    setMessageActionTarget(null);

    try {
      const idToken = await getIdToken();
      const result = await updateChatMessageReaction({
        chatType: activeChat.chatType,
        contactId: activeChat.contactId,
        emoji: reaction,
        idToken,
        messageId: message.messageId
      });
      const cachedContact = await cacheChatContactPhoto(result.contact, idToken);
      const nextReactions = result.messageReactions;
      const nextMessages = applyReactionMapToMessages(messagesRef.current, nextReactions);

      setProfilePhotoAuthToken(idToken);
      if (selectedChatRef.current?.contactId === activeChat.contactId) {
        setMessageReactions(nextReactions);
        setMessages(nextMessages);
        setSelectedChat(mapChatContactToChatItem(cachedContact));
      }
      setChatContacts((currentContacts) => upsertChatContact(currentContacts, cachedContact));
      await saveCachedChatConversation({
        contact: cachedContact,
        contactId: activeChat.contactId,
        messages: nextMessages,
        ownerUid: currentUid
      });
      queueEncryptedChatBackup();
    } catch {
      setMessageReactions(previousReactions);
      setMessages((currentMessages) => applyReactionMapToMessages(currentMessages, previousReactions));
      Alert.alert('Reaction not sent', 'Please try again.');
    }
  }

  async function handleCopyMessage(message: ChatMessage) {
    if (!message.text.trim()) {
      Alert.alert('Nothing to copy', 'This photo message does not have text.');
      setMessageActionTarget(null);
      return;
    }

    await Clipboard.setStringAsync(message.text);
    setMessageActionTarget(null);
  }

  function handleReplyToMessage(message: ChatMessage) {
    setReplyTarget(message);
    setMessageActionTarget(null);
  }

  function handleOpenMessageAttachment(message: ChatMessage, activeIndex: number) {
    const mediaItems = getMessageMediaItems(message);
    const media = mediaItems[activeIndex] || mediaItems[0] || getMessageMedia(message);

    if (!media) {
      return;
    }

    if (media.kind === 'image' || media.kind === 'video') {
      handleOpenMediaViewer(message, activeIndex);
      return;
    }

    if (media.kind === 'audio') {
      return;
    }

    void handleOpenFileAttachment(message, activeIndex);
  }

  function handleOpenMediaViewer(message: ChatMessage, activeIndex: number) {
    const allMediaItems = getMessageMediaItems(message);
    const selectedMedia = allMediaItems[activeIndex] || allMediaItems[0] || getMessageMedia(message);
    const mediaItems = allMediaItems.filter((media) =>
      media.kind === 'image' || media.kind === 'video'
    );

    if (!mediaItems.length) {
      return;
    }

    const viewerIndex = Math.max(0, mediaItems.findIndex((media) =>
      media === selectedMedia ||
      Boolean(media.mediaId && media.mediaId === selectedMedia?.mediaId) ||
      Boolean(media.localUri && media.localUri === selectedMedia?.localUri)
    ));

    setMediaViewer({
      activeIndex: Math.max(0, Math.min(viewerIndex, mediaItems.length - 1)),
      items: mediaItems,
      title: selectedChatRef.current?.title || 'Media'
    });
  }

  async function handlePrepareAttachment(message: ChatMessage, activeIndex: number): Promise<string | null> {
    const activeChat = selectedChatRef.current;
    const mediaItems = getMessageMediaItems(message);
    const media = mediaItems[activeIndex] || mediaItems[0] || getMessageMedia(message);
    const localUri = getMediaLocalUri(media);

    if (localUri) {
      return localUri;
    }

    if (!activeChat || !media || !media.mediaId || !media.key || !media.nonce) {
      return null;
    }

    return downloadMediaForMessage(activeChat.contactId, activeChat.chatType, message.messageId, media, activeIndex);
  }

  async function handleOpenFileAttachment(message: ChatMessage, activeIndex: number) {
    const mediaItems = getMessageMediaItems(message);
    const media = mediaItems[activeIndex] || mediaItems[0] || getMessageMedia(message);

    if (!media) {
      return;
    }

    try {
      const localUri = await handlePrepareAttachment(message, activeIndex);

      if (!localUri) {
        throw new Error('This file could not be downloaded.');
      }

      if (isAudioAttachment(media)) {
        setAudioAttachmentPreview({
          contentType: media.contentType,
          fileName: media.fileName || 'Audio attachment',
          localUri,
          sizeBytes: media.sizeBytes
        });
        return;
      }

      await openChatAttachmentFile({
        contentType: media.contentType,
        fileName: media.fileName,
        localUri
      });
    } catch (nextError) {
      Alert.alert('File not opened', getErrorMessage(nextError, 'Unable to open this file.'));
    }
  }

  function handleForwardMessage(message: ChatMessage) {
    setIsForwardMode(true);
    setForwardSelectedMessageIds({ [message.messageId]: true });
    setForwardRecipientIds({});
    setIsForwardRecipientModalOpen(false);
    setReplyTarget(null);
    setMessageActionTarget(null);
  }

  function resetForwardMode() {
    setIsForwardMode(false);
    setForwardSelectedMessageIds({});
    setForwardRecipientIds({});
    setIsForwardRecipientModalOpen(false);
  }

  function handleToggleForwardMessage(message: ChatMessage) {
    setForwardSelectedMessageIds((currentSelection) => ({
      ...currentSelection,
      [message.messageId]: !currentSelection[message.messageId]
    }));
  }

  function handleOpenForwardRecipients() {
    const selectedMessages = getSelectedForwardMessages();

    if (!selectedMessages.length) {
      return;
    }

    setForwardRecipientIds({});
    setIsForwardRecipientModalOpen(true);
  }

  function handleToggleForwardRecipient(contactId: string) {
    setForwardRecipientIds((currentRecipients) => {
      const nextValue = !currentRecipients[contactId];
      const selectedCount = Object.values(currentRecipients).filter(Boolean).length;

      if (nextValue && selectedCount >= 5) {
        Alert.alert('Forward limit', 'You can forward to up to 5 chats at a time.');
        return currentRecipients;
      }

      return {
        ...currentRecipients,
        [contactId]: nextValue
      };
    });
  }

  function getSelectedForwardMessages(): ChatMessage[] {
    return uniqueChatMessages(messages).filter((message) => forwardSelectedMessageIds[message.messageId]);
  }

  function getSelectedForwardRecipients(): ChatContact[] {
    return chatContacts.filter((contact) => forwardRecipientIds[contact.contactId]);
  }

  async function handleConfirmForwardMessages() {
    const selectedMessages = getSelectedForwardMessages();
    const selectedRecipients = getSelectedForwardRecipients();

    if (!selectedMessages.length || !selectedRecipients.length) {
      return;
    }

    setIsForwardingMessages(true);
    setError(null);

    try {
      const idToken = await getIdToken();

      setProfilePhotoAuthToken(idToken);

      for (const recipient of selectedRecipients) {
        if (!recipient.hasActiveDevice) {
          throw new Error(getRecipientDeviceNotReadyMessage(recipient.displayName));
        }

        const sentMessages: ChatMessage[] = [];
        let latestContact: ChatContact | null = null;

        for (const message of selectedMessages) {
          const sourceMediaItems = getMessageMediaItems(message);
          const forwardMediaItems = sourceMediaItems.length > 1
            ? await Promise.all(sourceMediaItems.map((sourceMedia) => uploadEncryptedChatMedia({
                chatType: recipient.chatType,
                contactId: recipient.contactId,
                idToken,
                media: toLocalChatMediaInput(sourceMedia)
              })))
            : [];
          const sourceMedia = sourceMediaItems[0] || getMessageMedia(message);
          const forwardMedia = sourceMedia && !forwardMediaItems.length
            ? await uploadEncryptedChatMedia({
                chatType: recipient.chatType,
                contactId: recipient.contactId,
                idToken,
                media: toLocalChatMediaInput(sourceMedia)
              })
            : null;
          const result = await sendChatMessage({
            chatType: recipient.chatType,
            contactId: recipient.contactId,
            currentUid,
            forwarded: true,
            idToken,
            media: forwardMedia
              ? {
                  ...forwardMedia,
                  transferProgress: 1,
                  transferStatus: 'available'
                }
              : null,
            mediaItems: forwardMediaItems.map((media) => ({
              ...media,
              transferProgress: 1,
              transferStatus: 'available'
            })),
            text: message.text || ''
          });

          latestContact = await cacheChatContactPhoto(result.contact, idToken);
          sentMessages.push(result.message);
        }

        if (latestContact) {
          await saveForwardedMessagesForContact({
            contact: latestContact,
            contactId: recipient.contactId,
            messages: sentMessages
          });
        }
      }

      resetForwardMode();
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to forward message.'));
    } finally {
      setIsForwardingMessages(false);
    }
  }

  async function saveForwardedMessagesForContact(input: {
    contact: ChatContact;
    contactId: string;
    messages: ChatMessage[];
  }) {
    const cachedConversation = await loadCachedChatConversation({
      contactId: input.contactId,
      ownerUid: currentUid
    }).catch(() => null);
    const nextMessages = uniqueChatMessages([
      ...(cachedConversation?.messages || []),
      ...input.messages
    ]);
    const contactWithLocalPreview = applyLocalChatPreview(input.contact, nextMessages);

    await saveCachedChatConversation({
      contact: contactWithLocalPreview,
      contactId: input.contactId,
      messages: nextMessages,
      ownerUid: currentUid
    });
    queueEncryptedChatBackup();

    if (selectedChatRef.current?.contactId === input.contactId) {
      setMessages((currentMessages) => uniqueChatMessages([
        ...currentMessages,
        ...input.messages
      ]));
      setSelectedChat(mapChatContactToChatItem(contactWithLocalPreview));
    }

    setChatContacts((currentContacts) => upsertChatContact(currentContacts, contactWithLocalPreview));
  }

  function handleShowMessageInfo(message: ChatMessage) {
    Alert.alert(
      'Message info',
      [
        `Status: ${formatMessageDeliveryStatus(message.deliveryStatus) || 'Received'}`,
        `Time: ${formatMessageTime(message.sentAt)}`,
        `Date: ${formatMessageDate(message.sentAt)}`
      ].join('\n')
    );
    setMessageActionTarget(null);
  }

  function handleToggleMessageStar(message: ChatMessage) {
    setStarredMessageIds((currentStarredMessageIds) => ({
      ...currentStarredMessageIds,
      [message.messageId]: !currentStarredMessageIds[message.messageId]
    }));
    setMessageActionTarget(null);
  }

  function handleDeleteMessageForMe(message: ChatMessage) {
    const chat = selectedChatRef.current;

    if (!chat) {
      setMessageActionTarget(null);
      return;
    }

    Alert.alert(
      'Delete message?',
      'This removes the message from this device.',
      [
        {
          style: 'cancel',
          text: 'Cancel'
        },
        {
          onPress: () => {
            void deleteMessageForMe(chat, message);
          },
          style: 'destructive',
          text: 'Delete'
        }
      ]
    );
    setMessageActionTarget(null);
  }

  async function deleteMessageForMe(chat: ChatItem, message: ChatMessage) {
    const nextMessages = messagesRef.current.filter((currentMessage) => currentMessage.messageId !== message.messageId);
    const contact = chatContactsRef.current.find((currentContact) => currentContact.contactId === chat.contactId) || null;
    let hiddenMessageIds = [message.messageId];
    let refreshedContact = contact
      ? applyLocalChatPreview({
          ...contact,
          lastMessageAt: null,
          preview: ''
        }, nextMessages)
      : null;

    setMessages(nextMessages);
    setMessageReactions((currentReactions) => omitRecordKey(currentReactions, message.messageId));
    setStarredMessageIds((currentStarredMessageIds) => omitRecordKey(currentStarredMessageIds, message.messageId));

    if (message.deliveryStatus === 'queued') {
      await removePendingChatMessage({
        ownerUid: currentUid,
        queueId: message.messageId
      }).catch(() => undefined);
    }

    await hideCachedChatMessagesForMe({
      contactId: chat.contactId,
      messageIds: hiddenMessageIds,
      ownerUid: currentUid
    }).catch(() => undefined);

    if (chat.chatType === 'GROUP' && message.deliveryStatus !== 'queued') {
      try {
        const idToken = await getIdToken();
        const result = await deleteChatMessageForMe({
          chatType: chat.chatType,
          contactId: chat.contactId,
          idToken,
          messageId: message.messageId
        });

        hiddenMessageIds = result.hiddenMessageIds.length ? result.hiddenMessageIds : hiddenMessageIds;

        if (result.contact) {
          setProfilePhotoAuthToken(idToken);
          refreshedContact = applyLocalChatPreview(
            await cacheChatContactPhoto(result.contact, idToken),
            nextMessages
          );
        }

        await hideCachedChatMessagesForMe({
          contactId: chat.contactId,
          messageIds: hiddenMessageIds,
          ownerUid: currentUid
        }).catch(() => undefined);
      } catch (nextError) {
        setError(getErrorMessage(
          nextError,
          'Message was removed locally, but Synzapp could not sync that delete to the server.'
        ));
      }
    }

    await saveCachedChatConversation({
      contact: refreshedContact,
      contactId: chat.contactId,
      hiddenMessageIds,
      messages: nextMessages.filter((currentMessage) => currentMessage.deliveryStatus !== 'queued'),
      ownerUid: currentUid
    }).then(() => {
      queueEncryptedChatBackup();
    }).catch(() => undefined);

    if (refreshedContact && selectedChatRef.current?.contactId === chat.contactId) {
      setSelectedChat(mapChatContactToChatItem(refreshedContact));
      setChatContacts((currentContacts) => upsertChatContact(currentContacts, refreshedContact));
    }
  }

  function handleSelectFooterTab(tab: FooterTab) {
    chatOpenRequestIdRef.current += 1;
    selectedChatRef.current = null;
    setActiveTab(tab);
    setError(null);
    setSelectedChat(null);
    setIsLoadingMessages(false);
    setIsGroupCallOptionsOpen(false);
    setIsGroupCallPeopleModalOpen(false);
    setIsGroupSwitcherModalOpen(false);
    setGroupCallPeopleSearch('');
    setSelectedGroupCallMemberIds({});
    setMessageDraft('');
    setReplyTarget(null);
    resetForwardMode();
    setMessages([]);

    if (tab === 'Settings') {
      setSettingsScreen('list');
    }

    if (tab === 'You') {
      void loadUserProfile();
    }
  }

  function handleCloseChat() {
    chatOpenRequestIdRef.current += 1;
    selectedChatRef.current = null;
    setSelectedChat(null);
    setIsLoadingMessages(false);
    setIsGroupCallOptionsOpen(false);
    setIsGroupCallPeopleModalOpen(false);
    setIsGroupSwitcherModalOpen(false);
    setGroupCallPeopleSearch('');
    setSelectedGroupCallMemberIds({});
    setMessageDraft('');
    setReplyTarget(null);
    resetForwardMode();
    setMessages([]);
    void loadChatContacts(false);
  }

  function handleOpenDirectorySettings() {
    if (!canManageDirectory) {
      return;
    }

    setDirectoryFilter('Departments');
    setSettingsScreen('directory');
    void loadSettings();
  }

  function handleOpenRolePermissions() {
    if (!canManageDirectory) {
      return;
    }

    setError(null);
    setSettingsScreen('role-permissions');
    void loadRolePermissionSettings();
  }

  function handleOpenDepartmentAdminPermissions() {
    if (!canManageUsers) {
      return;
    }

    setError(null);
    setSettingsScreen('dept-admin-permissions');
    void loadDepartmentAdminPermissionSettings();
  }

  function handleOpenGroupsSettings() {
    if (!canManageGroups) {
      return;
    }

    setError(null);
    setSettingsScreen('groups');
    void loadGroupSettings();
  }

  function handleOpenCompanyProfileSettings() {
    if (!canManageCompanyProfile) {
      return;
    }

    setError(null);
    setSettingsScreen('company-profile');
    void loadCompanyProfile();
  }

  function handleOpenSecuritySettings() {
    if (!canManageSecurity) {
      return;
    }

    setError(null);
    setSettingsScreen('security');
    void loadSecurityDevices();
  }

  async function handleSaveCompanyProfile() {
    if (isSavingCompanyProfile || !canManageCompanyProfile) {
      return;
    }

    const companyName = companyNameDraft.trim();
    const companyAddress = companyAddressDraft.trim();

    if (!companyName || !companyAddress) {
      setError('Enter the company name and address.');
      return;
    }

    setError(null);
    setIsSavingCompanyProfile(true);

    try {
      const idToken = await getIdToken();
      const profile = await updateCompanyProfile({
        companyAddress,
        companyName,
        idToken
      });

      setCompanyProfile(profile);
      setCompanyNameDraft(profile.companyName);
      setCompanyAddressDraft(profile.companyAddress);
      Alert.alert('Company profile updated', 'Your company profile has been saved.');
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to update company profile.'));
    } finally {
      setIsSavingCompanyProfile(false);
    }
  }

  async function handleUpdateCompanyLogo() {
    if (isSavingCompanyLogo || !canManageCompanyProfile) {
      return;
    }

    setError(null);

    try {
      const photo = await pickNativeProfilePhoto({
        message: 'Add a logo using your camera or photo library.',
        title: 'Company logo'
      });

      if (!photo) {
        return;
      }

      if (!photo.dataUrl) {
        setError('Unable to prepare this logo. Please choose another image.');
        return;
      }

      setIsSavingCompanyLogo(true);

      const idToken = await getIdToken();
      const profile = await updateCompanyLogo({
        companyLogoDataUrl: photo.dataUrl,
        idToken
      });

      setProfilePhotoAuthToken(idToken);
      setCompanyProfile(profile);
      Alert.alert('Company logo updated', 'Your company logo has been saved.');
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to update company logo.'));
    } finally {
      setIsSavingCompanyLogo(false);
    }
  }

  function handleOpenMyDevicesSettings() {
    setError(null);
    setSettingsScreen('my-devices');
    void loadMyDevices();
  }

  function handleOpenChatBackupSettings() {
    setError(null);
    setSettingsScreen('chat-backup');
  }

  function handleRevokeDevice(device: TenantDevice) {
    if (device.status === 'REVOKED' || isRevokingDevice) {
      return;
    }

    Alert.alert(
      'Revoke device?',
      `${device.displayName} will stop receiving future encrypted messages on this device.`,
      [
        {
          style: 'cancel',
          text: 'Cancel'
        },
        {
          onPress: () => {
            void revokeDevice(device.deviceId);
          },
          style: 'destructive',
          text: 'Revoke'
        }
      ]
    );
  }

  async function revokeDevice(deviceId: string) {
    setError(null);
    setIsRevokingDevice(true);

    try {
      const idToken = await getIdToken();
      const revokedDevice = await revokeTenantDevice({
        deviceId,
        idToken,
        reason: 'Revoked by organization admin'
      });

      setTenantDevices((currentDevices) =>
        currentDevices.map((device) =>
          device.deviceId === revokedDevice.deviceId ? revokedDevice : device
        )
      );
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to revoke this device.'));
    } finally {
      setIsRevokingDevice(false);
    }
  }

  function handleRevokeMyDevice(device: CurrentUserDevice) {
    if (device.status === 'REVOKED' || device.isCurrentDevice || isRevokingMyDevice) {
      return;
    }

    Alert.alert(
      'Revoke device?',
      `${device.displayName} will stop receiving future encrypted messages for your account.`,
      [
        {
          style: 'cancel',
          text: 'Cancel'
        },
        {
          onPress: () => {
            void revokeMyDevice(device.deviceId);
          },
          style: 'destructive',
          text: 'Revoke'
        }
      ]
    );
  }

  async function revokeMyDevice(deviceId: string) {
    setError(null);
    setIsRevokingMyDevice(true);

    try {
      const idToken = await getIdToken();
      const revokedDevice = await revokeCurrentUserDevice({
        deviceId,
        idToken,
        reason: 'Revoked by device owner'
      });

      setCurrentUserDevices((currentDevices) =>
        currentDevices.map((device) =>
          device.deviceId === revokedDevice.deviceId ? revokedDevice : device
        )
      );
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to revoke this device.'));
    } finally {
      setIsRevokingMyDevice(false);
    }
  }

  function handleSelectEmployeeLifecycle(employee: EmployeeListItem) {
    if (!canManageUsers || isUpdatingEmployeeLifecycle) {
      return;
    }

    const options = getEmployeeActionOptions(employee);

    if (!options.length) {
      Alert.alert('Employee actions', 'No lifecycle actions are available for this employee.');
      return;
    }

    if (Platform.OS === 'ios') {
      const destructiveButtonIndex = options.findIndex((option) => option.action === 'ANONYMIZE');

      ActionSheetIOS.showActionSheetWithOptions(
        {
          cancelButtonIndex: options.length,
          destructiveButtonIndex: destructiveButtonIndex >= 0 ? destructiveButtonIndex : undefined,
          options: [...options.map((option) => option.label), 'Cancel'],
          title: employee.name
        },
        (buttonIndex) => {
          const option = options[buttonIndex];

          if (option) {
            confirmEmployeeLifecycleAction(employee, option);
          }
        }
      );
      return;
    }

    Alert.alert(
      employee.name,
      undefined,
      [
        ...options.map((option) => ({
          onPress: () => confirmEmployeeLifecycleAction(employee, option),
          style: option.action === 'ANONYMIZE' ? 'destructive' as const : 'default' as const,
          text: option.label
        })),
        {
          style: 'cancel' as const,
          text: 'Cancel'
        }
      ]
    );
  }

  function confirmEmployeeLifecycleAction(
    employee: EmployeeListItem,
    option: EmployeeActionOption
  ) {
    if (option.action === 'CHANGE_ROLE') {
      void handleChangeEmployeeRole(employee);
      return;
    }

    Alert.alert(
      option.confirmTitle,
      option.confirmMessage(employee.name),
      [
        {
          style: 'cancel',
          text: 'Cancel'
        },
        {
          onPress: () => {
            void handleUpdateEmployeeAction(employee, option);
          },
          style: option.action === 'ANONYMIZE' ? 'destructive' : 'default',
          text: option.confirmButton
        }
      ]
    );
  }

  async function handleUpdateEmployeeAction(
    employee: EmployeeListItem,
    option: EmployeeActionOption
  ) {
    setError(null);
    setIsUpdatingEmployeeLifecycle(true);

    try {
      const idToken = await getIdToken();
      const updatedEmployee = isEmployeeLifecycleAction(option.action)
        ? await updateEmployeeLifecycle({
            action: option.action,
            approvedPhoneId: employee.id,
            idToken,
            reason: option.reason
          })
        : await updateEmployeeDepartmentAdminAssignment({
            approvedPhoneId: employee.id,
            enabled: option.action === 'ASSIGN_DEPT_ADMIN',
            idToken
          });

      setApprovedEmployees((currentEmployees) =>
        sortApprovedEmployees(upsertApprovedEmployees(currentEmployees, [updatedEmployee]))
      );
      void loadChatContacts(false);
      Alert.alert(option.successTitle, option.successMessage(employee.name));
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to update employee access.'));
    } finally {
      setIsUpdatingEmployeeLifecycle(false);
    }
  }

  async function handleChangeEmployeeRole(employee: EmployeeListItem) {
    if (isUpdatingEmployeeLifecycle) {
      return;
    }

    setError(null);

    try {
      const directoryRecords = roles.length
        ? { departments, roles }
        : await loadDirectoryRecords();
      const activeRoles = directoryRecords.roles.filter((role) => role.status === 'ACTIVE');

      if (!activeRoles.length) {
        Alert.alert('Roles', 'Create at least one role before changing employee roles.');
        return;
      }

      const selectedRole = await selectScreenOption(
        'Select role',
        activeRoles,
        (role) => role.name
      );

      if (!selectedRole || selectedRole.roleId === employee.roleId) {
        return;
      }

      Alert.alert(
        'Change role?',
        `${employee.name} will be assigned to ${selectedRole.name}. Their company-role permissions will update immediately.`,
        [
          {
            style: 'cancel',
            text: 'Cancel'
          },
          {
            onPress: () => {
              void saveEmployeeRole(employee, selectedRole);
            },
            text: 'Change'
          }
        ]
      );
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to load roles.'));
    }
  }

  async function saveEmployeeRole(employee: EmployeeListItem, role: TenantRole) {
    setError(null);
    setIsUpdatingEmployeeLifecycle(true);

    try {
      const idToken = await getIdToken();
      const updatedEmployee = await updateEmployeeRole({
        approvedPhoneId: employee.id,
        idToken,
        roleId: role.roleId
      });

      setApprovedEmployees((currentEmployees) =>
        sortApprovedEmployees(upsertApprovedEmployees(currentEmployees, [updatedEmployee]))
      );
      void loadChatContacts(false);
      Alert.alert('Role updated', `${employee.name} is now assigned to ${role.name}.`);
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to update employee role.'));
    } finally {
      setIsUpdatingEmployeeLifecycle(false);
    }
  }

  function handleToggleRolePermission(role: TenantRole, permission: RolePermission) {
    if (!canManageDirectory || isSavingRolePermissions) {
      return;
    }

    const currentPermissions = role.permissions || [];
    const hasPermissionEnabled = currentPermissions.includes(permission.permission);
    const nextPermissions = hasPermissionEnabled
      ? currentPermissions.filter((currentPermission) => currentPermission !== permission.permission)
      : [...currentPermissions, permission.permission].sort();

    Alert.alert(
      hasPermissionEnabled ? 'Remove permission?' : 'Add permission?',
      hasPermissionEnabled
        ? `${role.name} users will no longer have ${permission.title.toLowerCase()} through this role.`
        : `${role.name} users will receive ${permission.title.toLowerCase()} through this role.`,
      [
        {
          style: 'cancel',
          text: 'Cancel'
        },
        {
          onPress: () => {
            void saveRolePermissions(role, nextPermissions);
          },
          text: hasPermissionEnabled ? 'Remove' : 'Add'
        }
      ]
    );
  }

  async function saveRolePermissions(role: TenantRole, permissions: string[]) {
    setError(null);
    setIsSavingRolePermissions(true);

    try {
      const idToken = await getIdToken();
      const updatedRole = await updateRolePermissions({
        idToken,
        permissions,
        roleId: role.roleId
      });

      setRoles((currentRoles) =>
        sortByName(currentRoles.map((currentRole) =>
          currentRole.roleId === updatedRole.roleId ? updatedRole : currentRole
        ))
      );
      await loadEmployees();
      Alert.alert('Permissions updated', `${updatedRole.name} permissions were updated.`);
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to update role permissions.'));
    } finally {
      setIsSavingRolePermissions(false);
    }
  }

  function handleToggleDepartmentAdminPermission(
    employee: ApprovedEmployee,
    permission: DepartmentAdminPermission
  ) {
    if (!canManageUsers || isSavingDepartmentAdminPermissions) {
      return;
    }

    const currentPermissions = employee.departmentAdminPermissions || [];
    const hasPermissionEnabled = currentPermissions.includes(permission.permission);
    const nextPermissions = hasPermissionEnabled
      ? currentPermissions.filter((currentPermission) => currentPermission !== permission.permission)
      : [...currentPermissions, permission.permission].sort();
    const employeeName = employee.displayName || employee.phoneMasked;

    Alert.alert(
      hasPermissionEnabled ? 'Remove permission?' : 'Add permission?',
      hasPermissionEnabled
        ? `${employeeName} will no longer be able to ${permission.title.toLowerCase()}.`
        : `${employeeName} will be able to ${permission.title.toLowerCase()} for their assigned department.`,
      [
        {
          style: 'cancel',
          text: 'Cancel'
        },
        {
          onPress: () => {
            void saveDepartmentAdminPermissions(employee, nextPermissions);
          },
          text: hasPermissionEnabled ? 'Remove' : 'Add'
        }
      ]
    );
  }

  async function saveDepartmentAdminPermissions(
    employee: ApprovedEmployee,
    permissions: string[]
  ) {
    setError(null);
    setIsSavingDepartmentAdminPermissions(true);

    try {
      const idToken = await getIdToken();
      const updatedEmployee = await updateEmployeeDepartmentAdminPermissions({
        approvedPhoneId: employee.approvedPhoneId,
        idToken,
        permissions
      });

      setApprovedEmployees((currentEmployees) =>
        sortApprovedEmployees(upsertApprovedEmployees(currentEmployees, [updatedEmployee]))
      );
      void loadChatContacts(false);
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to update Department Admin permissions.'));
    } finally {
      setIsSavingDepartmentAdminPermissions(false);
    }
  }

  function handleOpenFilter() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          cancelButtonIndex: 2,
          options: ['Departments', 'Roles', 'Cancel'],
          title: 'Show'
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            setDirectoryFilter('Departments');
          }

          if (buttonIndex === 1) {
            setDirectoryFilter('Roles');
          }
        }
      );
      return;
    }

    Alert.alert('Show', undefined, [
      { text: 'Departments', onPress: () => setDirectoryFilter('Departments') },
      { text: 'Roles', onPress: () => setDirectoryFilter('Roles') },
      { style: 'cancel', text: 'Cancel' }
    ]);
  }

  function handleOpenAddModal() {
    setError(null);
    setNewRecordDescription('');
    setNewRecordName('');

    if (Platform.OS === 'ios') {
      const recordLabel = directoryFilter === 'Departments' ? 'department' : 'role';

      Alert.prompt(
        `New ${recordLabel}`,
        `Enter the ${recordLabel} name.`,
        [
          {
            style: 'cancel',
            text: 'Cancel'
          },
          {
            onPress: (name?: string) => {
              const nextName = (name || '').trim();

              if (nextName.length < 2) {
                setError(`Enter a ${recordLabel} name.`);
                return;
              }

              handlePromptForRecordDescription(nextName);
            },
            text: 'Next'
          }
        ],
        'plain-text'
      );
      return;
    }

    setIsAddModalOpen(true);
  }

  async function handleSaveRecord() {
    await saveRecord(newRecordName, newRecordDescription, () => {
      setIsAddModalOpen(false);
      setNewRecordDescription('');
      setNewRecordName('');
    });
  }

  function handlePromptForRecordDescription(name: string) {
    const recordLabel = directoryFilter === 'Departments' ? 'department' : 'role';

    Alert.prompt(
      `New ${recordLabel}`,
      'Add a description or leave it blank.',
      [
        {
          style: 'cancel',
          text: 'Cancel'
        },
        {
          onPress: (description?: string) => {
            void saveRecord(name, description || '');
          },
          text: 'Create'
        }
      ],
      'plain-text'
    );
  }

  async function saveRecord(name: string, description: string, onSaved?: () => void) {
    const nextName = name.trim();
    const nextDescription = description.trim();

    if (nextName.length < 2) {
      setError(`Enter a ${directoryFilter === 'Departments' ? 'department' : 'role'} name.`);
      return;
    }

    setError(null);
    setIsSavingRecord(true);

    try {
      const idToken = await getIdToken();

      if (directoryFilter === 'Departments') {
        const department = await createDepartment({
          description: nextDescription,
          idToken,
          name: nextName
        });

        setDepartments((currentDepartments) => sortByName([...currentDepartments, department]));
        Alert.alert('Department created', `${department.name} is ready.`);
      } else {
        const role = await createRole({
          description: nextDescription,
          idToken,
          name: nextName
        });

        setRoles((currentRoles) => sortByName([...currentRoles, role]));
        Alert.alert('Role created', `${role.name} is ready.`);
      }

      onSaved?.();
    } catch (nextError) {
      setError(getErrorMessage(nextError, `Unable to create ${directoryFilter === 'Departments' ? 'department' : 'role'}.`));
    } finally {
      setIsSavingRecord(false);
    }
  }

  async function handleOpenAddGroupModal() {
    if (!canManageGroups || isSavingGroup) {
      return;
    }

    setError(null);
    setNewGroupDescription('');
    setNewGroupName('');

    const department = await selectGroupDepartmentForCreate();

    if (department === undefined) {
      return;
    }

    setNewGroupDepartment(department);

    if (Platform.OS === 'ios') {
      Alert.prompt(
        'New group',
        'Enter the group name.',
        [
          {
            style: 'cancel',
            text: 'Cancel'
          },
          {
            onPress: (name?: string) => {
              const nextName = (name || '').trim();

              if (nextName.length < 2) {
                setError('Enter a group name.');
                return;
              }

              handlePromptForGroupDescription(nextName, department);
            },
            text: 'Next'
          }
        ],
        'plain-text'
      );
      return;
    }

    setIsAddGroupModalOpen(true);
  }

  function handlePromptForGroupDescription(name: string, department: TenantDepartment | null) {
    Alert.prompt(
      'New group',
      'Add a description or leave it blank.',
      [
        {
          style: 'cancel',
          text: 'Cancel'
        },
        {
          onPress: (description?: string) => {
            void saveGroup(name, description || '', department);
          },
          text: 'Create'
        }
      ],
      'plain-text'
    );
  }

  async function selectGroupDepartmentForCreate(): Promise<TenantDepartment | null | undefined> {
    if (!canManageDirectory) {
      return null;
    }

    const directoryRecords = departments.length
      ? { departments, roles }
      : await loadDirectoryRecords();
    const companyWideOption: TenantDepartment = {
      departmentId: '',
      description: null,
      name: 'Company-wide',
      status: 'ACTIVE'
    };

    return selectScreenOption(
      'Select group scope',
      [companyWideOption, ...directoryRecords.departments],
      (record) => record.name
    ).then((department) => {
      if (!department) {
        return undefined;
      }

      return department.departmentId ? department : null;
    });
  }

  async function handleSaveGroup() {
    await saveGroup(newGroupName, newGroupDescription, newGroupDepartment, () => {
      setIsAddGroupModalOpen(false);
      setNewGroupDescription('');
      setNewGroupName('');
      setNewGroupDepartment(null);
    });
  }

  async function saveGroup(
    name: string,
    description: string,
    department: TenantDepartment | null,
    onSaved?: () => void
  ) {
    const nextName = name.trim();
    const nextDescription = description.trim();

    if (nextName.length < 2) {
      setError('Enter a group name.');
      return;
    }

    setError(null);
    setIsSavingGroup(true);

    try {
      const idToken = await getIdToken();
      const group = await createTenantGroup({
        departmentId: department?.departmentId || null,
        description: nextDescription,
        idToken,
        name: nextName
      });

      setGroups((currentGroups) => sortByName([...currentGroups, group]));
      Alert.alert('Group created', `${group.name} is ready.`);
      onSaved?.();
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to create group.'));
    } finally {
      setIsSavingGroup(false);
    }
  }

  async function handleInviteEmployee(mode: InviteMode) {
    if (!canInviteEmployees || isInvitingEmployees || isPickingInviteContact) {
      return;
    }

    setError(null);

    try {
      if (inviteDraft) {
        await addContactToInviteDraft(inviteDraft);
        return;
      }

      const directoryRecords = await loadDirectoryRecords();

      if (!directoryRecords.departments.length || !directoryRecords.roles.length) {
        Alert.alert(
          'Setup required',
          'Create at least one department and one role before inviting employees.'
        );
        return;
      }

      const department = await selectScreenOption(
        'Select department',
        directoryRecords.departments,
        (record) => record.name
      );

      if (!department) {
        return;
      }

      const role = await selectScreenOption(
        'Select role',
        directoryRecords.roles,
        (record) => record.name
      );

      if (!role) {
        return;
      }

      const nextDraft = {
        contacts: [],
        department,
        mode,
        role
      };

      setActiveTab('Employees');
      setSettingsScreen('list');

      if (mode === 'manual') {
        openManualInvitePrompt(nextDraft);
        return;
      }

      setInviteDraft(nextDraft);

      if (mode === 'batch') {
        await openBatchContactSelector(nextDraft);
        return;
      }

      await addContactToInviteDraft(nextDraft);
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to invite employees.'));
    }
  }

  async function handleAddContactToDraft() {
    if (!inviteDraft) {
      return;
    }

    if (inviteDraft.mode === 'batch') {
      await openBatchContactSelector(inviteDraft);
      return;
    }

    await addContactToInviteDraft(inviteDraft);
  }

  async function addContactToInviteDraft(draft: InviteDraft) {
    setError(null);
    setActiveTab('Employees');
    setSettingsScreen('list');
    setIsPickingInviteContact(true);

    try {
      await waitForNativeTransition();
      const selectedContact = await pickContactForInvite();

      if (!selectedContact) {
        setInviteDraft((currentDraft) => {
          const draftToKeep = currentDraft || draft;
          return draftToKeep.contacts.length ? draftToKeep : null;
        });
        return;
      }

      setInviteDraft((currentDraft) => {
        const draftToUpdate = currentDraft || draft;
        const contactExists = draftToUpdate.contacts.some(
          (contact) => contact.phoneNumber === selectedContact.phoneNumber
        );

        if (contactExists) {
          return draftToUpdate;
        }

        return {
          ...draftToUpdate,
          contacts: [...draftToUpdate.contacts, selectedContact]
        };
      });
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to select contact.'));
    } finally {
      setIsPickingInviteContact(false);
    }
  }

  function openManualInvitePrompt(draft: InviteDraft) {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Add employee',
        'Enter the phone number with country code, for example +14695554444.',
        [
          {
            style: 'cancel',
            text: 'Cancel'
          },
          {
            onPress: (value?: string) => {
              addManualPhoneToInviteDraft(value || '', draft);
            },
            text: 'Add'
          }
        ],
        'plain-text',
        '',
        'phone-pad'
      );
      return;
    }

    setManualInviteDraftTarget(draft);
    setManualPhoneDraft('');
    setIsManualInviteModalOpen(true);
  }

  function closeManualInviteModal() {
    setIsManualInviteModalOpen(false);
    setManualInviteDraftTarget(null);
    setManualPhoneDraft('');
  }

  function handleConfirmManualInvite() {
    if (!manualInviteDraftTarget) {
      closeManualInviteModal();
      return;
    }

    addManualPhoneToInviteDraft(manualPhoneDraft, manualInviteDraftTarget);
  }

  function addManualPhoneToInviteDraft(rawPhoneNumber: string, draft: InviteDraft) {
    const phoneNumber = normalizeManualInvitePhoneNumber(rawPhoneNumber);

    if (!phoneNumber) {
      Alert.alert(
        'Phone number needed',
        'Enter a full phone number with country code, for example +14695554444.'
      );
      return;
    }

    setActiveTab('Employees');
    setSettingsScreen('list');
    setInviteDraft({
      ...draft,
      contacts: [{ phoneNumber }]
    });
    closeManualInviteModal();
  }

  async function openBatchContactSelector(draft: InviteDraft) {
    setError(null);
    setActiveTab('Employees');
    setSettingsScreen('list');
    setBatchDraftTarget(draft);
    setBatchContactSearch('');
    setSelectedBatchPhoneNumbers(draft.contacts.map((contact) => contact.phoneNumber));
    setIsBatchContactModalOpen(true);

    if (batchContactCandidates.length) {
      return;
    }

    setIsLoadingBatchContacts(true);

    try {
      await waitForNativeTransition();
      const contacts = await loadBatchContactCandidates();

      if (!contacts.length) {
        throw new Error('No contacts with supported phone numbers were found.');
      }

      setBatchContactCandidates(contacts);
    } catch (nextError) {
      console.warn('Batch contact list could not be loaded:', getErrorMessage(nextError, 'Unknown contacts error'));
      setIsBatchContactModalOpen(false);
      setBatchDraftTarget(null);
      setBatchContactSearch('');
      setSelectedBatchPhoneNumbers([]);
      setInviteDraft(draft);

      Alert.alert(
        'Contact list unavailable',
        'Synzapp could not open the multi-select contact list on this device. You can still add contacts one at a time to this batch.',
        [
          {
            style: 'cancel',
            text: 'Cancel'
          },
          {
            onPress: () => {
              void addContactToInviteDraft(draft);
            },
            text: 'Select contact'
          }
        ]
      );
    } finally {
      setIsLoadingBatchContacts(false);
    }
  }

  function closeBatchContactSelector() {
    setIsBatchContactModalOpen(false);
    setBatchDraftTarget(null);
    setBatchContactSearch('');
    setSelectedBatchPhoneNumbers([]);

    setInviteDraft((currentDraft) => {
      if (!currentDraft || currentDraft.contacts.length) {
        return currentDraft;
      }

      return null;
    });
  }

  function handleToggleBatchContact(phoneNumber: string) {
    setSelectedBatchPhoneNumbers((currentPhoneNumbers) => {
      if (currentPhoneNumbers.includes(phoneNumber)) {
        return currentPhoneNumbers.filter((currentPhoneNumber) => currentPhoneNumber !== phoneNumber);
      }

      return [...currentPhoneNumbers, phoneNumber];
    });
  }

  function handleConfirmBatchContacts() {
    if (!batchDraftTarget) {
      closeBatchContactSelector();
      return;
    }

    const selectedPhoneNumberSet = new Set(selectedBatchPhoneNumbers);
    const selectedContacts = batchContactCandidates
      .filter((candidate) => selectedPhoneNumberSet.has(candidate.phoneNumber))
      .map((candidate) => ({
        displayName: candidate.displayName,
        phoneNumber: candidate.phoneNumber
      }));

    setInviteDraft((currentDraft) => ({
      ...(currentDraft || batchDraftTarget),
      contacts: selectedContacts
    }));
    setIsBatchContactModalOpen(false);
    setBatchDraftTarget(null);
    setBatchContactSearch('');
    setSelectedBatchPhoneNumbers([]);
  }

  async function handleSendInviteDraft() {
    if (!inviteDraft || isInvitingEmployees || isPickingInviteContact) {
      return;
    }

    if (!inviteDraft.contacts.length) {
      Alert.alert('Add employee', 'Select at least one contact before sending invites.');
      return;
    }

    setError(null);
    setIsInvitingEmployees(true);

    try {
      const idToken = await getIdToken();
      const invitedEmployees = await inviteEmployeeContacts({
        contacts: inviteDraft.contacts,
        departmentId: inviteDraft.department.departmentId,
        idToken,
        roleId: inviteDraft.role.roleId
      });

      setApprovedEmployees((currentEmployees) =>
        sortApprovedEmployees(upsertApprovedEmployees(currentEmployees, invitedEmployees))
      );
      setInviteDraft(null);

      Alert.alert(
        invitedEmployees.length === 1 ? 'Employee invited' : 'Employees invited',
        invitedEmployees.length === 1
          ? `${invitedEmployees[0].displayName || invitedEmployees[0].phoneMasked} is approved for ${inviteDraft.department.name}.`
          : `${invitedEmployees.length} employees are approved for ${inviteDraft.department.name}.`
      );
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to send employee invites.'));
    } finally {
      setIsInvitingEmployees(false);
    }
  }

  async function pickContactForInvite(): Promise<InviteContactDraft | null> {
    const contactsAvailable = await Contacts.isAvailableAsync();

    if (!contactsAvailable) {
      throw new Error('Contacts are not available on this device.');
    }

    if (Platform.OS === 'android') {
      const permission = await Contacts.requestPermissionsAsync();

      if (permission.status !== 'granted') {
        throw new Error('Contact permission is required to invite employees.');
      }
    }

    const pickedContact = await Contacts.presentContactPickerAsync();

    if (!pickedContact) {
      return null;
    }

    const contact = await getContactWithPhoneNumbers(pickedContact);
    const phoneNumbers = (contact.phoneNumbers || []).filter(
      (phoneNumber) => phoneNumber.number || phoneNumber.digits
    );

    if (!phoneNumbers.length) {
      throw new Error('The selected contact does not have a phone number.');
    }

    const selectedPhoneNumber = phoneNumbers.length === 1
      ? phoneNumbers[0]
      : await selectPhoneNumber(contact.name || 'Contact', phoneNumbers);

    if (!selectedPhoneNumber) {
      return null;
    }

    const normalizedPhoneNumber = normalizeContactPhoneNumber(selectedPhoneNumber);

    if (!normalizedPhoneNumber) {
      throw new Error('The selected contact phone number needs a supported country code.');
    }

    return {
      displayName: getContactDisplayName(contact),
      phoneNumber: normalizedPhoneNumber
    };
  }

  return (
    <View style={[
      styles.screen,
      {
        paddingBottom: selectedChat ? 0 : 98,
        paddingTop: selectedChat ? messageTopPadding : headerTopPadding
      }
    ]}>
      {selectedChat && isForwardMode ? (
        <ForwardSelectionHeader
          isForwarding={isForwardingMessages}
          onCancel={resetForwardMode}
          onForward={handleOpenForwardRecipients}
          selectedCount={selectedForwardMessageCount}
          title={selectedChat.title}
        />
      ) : selectedChat ? (
        <MessageHeader
          chat={selectedChat}
          onlineCount={activeGroupOnlineCount}
          onBack={handleCloseChat}
          onOpenGroupCallOptions={handleOpenGroupCallOptions}
          onOpenGroupPeoplePicker={() => handleOpenGroupCallPeopleModal('select')}
          onOpenGroupSwitcher={handleOpenGroupSwitcher}
          profilePhotoHeaders={profilePhotoHeaders}
        />
      ) : activeTab === 'Settings' && settingsScreen === 'directory' ? (
        <DirectoryHeader
          filter={directoryFilter}
          onBack={() => setSettingsScreen('list')}
          onFilter={handleOpenFilter}
        />
      ) : activeTab === 'Settings' && settingsScreen === 'role-permissions' ? (
        <BackHeader onBack={() => setSettingsScreen('list')} />
      ) : activeTab === 'Settings' && settingsScreen === 'company-profile' ? (
        <BackHeader onBack={() => setSettingsScreen('list')} />
      ) : activeTab === 'Settings' && settingsScreen === 'dept-admin-permissions' ? (
        <BackHeader onBack={() => setSettingsScreen('list')} />
      ) : activeTab === 'Settings' && settingsScreen === 'groups' ? (
        <BackHeader onBack={() => setSettingsScreen('list')} />
      ) : activeTab === 'Settings' && settingsScreen === 'security' ? (
        <BackHeader onBack={() => setSettingsScreen('list')} />
      ) : activeTab === 'Settings' && settingsScreen === 'my-devices' ? (
        <BackHeader onBack={() => setSettingsScreen('list')} />
      ) : activeTab === 'Settings' && settingsScreen === 'chat-backup' ? (
        <BackHeader onBack={() => setSettingsScreen('list')} />
      ) : activeTab === 'You' ? (
        <YouHeaderActions />
      ) : (
        <HeaderActions
          activeTab={activeTab}
          canInviteEmployees={canInviteEmployees}
          hasInviteDraft={Boolean(inviteDraft)}
          isInvitingEmployees={isInvitingEmployees || isPickingInviteContact}
          onOpenNewChat={handleOpenNewChatModal}
          onBatchImportEmployees={() => {
            void handleInviteEmployee('batch');
          }}
          onInviteEmployee={() => {
            void handleInviteEmployee('single');
          }}
          onManualAddEmployee={() => {
            void handleInviteEmployee('manual');
          }}
        />
      )}

      {!selectedChat && activeTab !== 'You' ? (
        <Text style={styles.title}>
          {activeTab === 'Settings' && settingsScreen === 'directory'
            ? 'Departments and roles'
            : activeTab === 'Settings' && settingsScreen === 'role-permissions'
              ? 'Role permissions'
            : activeTab === 'Settings' && settingsScreen === 'company-profile'
              ? 'Company profile'
              : activeTab === 'Settings' && settingsScreen === 'dept-admin-permissions'
                ? 'Department admin permissions'
                : activeTab === 'Settings' && settingsScreen === 'groups'
                  ? 'Groups'
                  : activeTab === 'Settings' && settingsScreen === 'security'
                    ? 'Organization security'
                    : activeTab === 'Settings' && settingsScreen === 'my-devices'
                      ? 'My devices'
                      : activeTab === 'Settings' && settingsScreen === 'chat-backup'
                        ? 'Encrypted backup'
                        : activeTab}
        </Text>
      ) : null}

      {activeTab === 'Settings' && settingsScreen === 'directory' ? (
        <Text style={styles.directoryTitle}>{directoryFilter}</Text>
      ) : null}

      {error ? (
        <View style={styles.noticeWrap}>
          <DismissibleError message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      {selectedChat ? (
        <MessageThread
          bottomInset={insets.bottom}
          canChat={selectedChat.hasActiveDevice}
          contactName={selectedChat.title}
          contactProfilePhotoUrl={selectedChat.profilePhotoUrl || null}
          currentUid={currentUid}
          draft={messageDraft}
          groupMembers={selectedChat.members || []}
          isGroupChat={selectedChat.chatType === 'GROUP'}
          isCompactAndroid={isCompactAndroid}
          isForwardMode={isForwardMode}
          isLoading={isLoadingMessages}
          isSending={isSendingMessage}
          messageReactions={messageReactions}
          messages={messages}
          profilePhotoHeaders={profilePhotoHeaders}
          onCancelReply={() => setReplyTarget(null)}
          onDraftChange={setMessageDraft}
          onMessageLongPress={handleOpenMessageActions}
          onOpenMedia={handleOpenMessageAttachment}
          onPrepareAttachment={handlePrepareAttachment}
          onMessageReply={handleReplyToMessage}
          onPickFile={() => {
            void handlePickChatFile();
          }}
          onPickMedia={() => {
            void handlePickChatMedia();
          }}
          onToggleForwardMessage={handleToggleForwardMessage}
          onSend={() => {
            void handleSendMessage();
          }}
          onSendVoiceNote={(media) => {
            void handleSendVoiceNote(media);
          }}
          replyTarget={replyTarget}
          selectedForwardMessageIds={forwardSelectedMessageIds}
          starredMessageIds={starredMessageIds}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.tabContent, { paddingBottom: contentBottomPadding }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.tabScroll}
        >
          {activeTab === 'Chats' ? (
            <ChatsTab
              chats={filteredChatItems}
              isLoading={isLoadingChats}
              onOpenChat={(chat) => {
                void handleOpenChat(chat);
              }}
              onSearchChange={setChatSearch}
              profilePhotoHeaders={profilePhotoHeaders}
              search={chatSearch}
            />
          ) : null}

          {activeTab === 'Groups' ? (
            <GroupsTab
              groups={groups}
              isLoading={isLoadingGroups}
              onOpenGroup={(group) => {
                void handleOpenGroupFromGroupsTab(group);
              }}
            />
          ) : null}

          {activeTab === 'Employees' ? (
            <EmployeesTab
              canManageUsers={canManageUsers}
              employees={employeeItems}
              inviteDraft={inviteDraft}
              isLoading={isLoadingEmployees}
              isUpdatingLifecycle={isUpdatingEmployeeLifecycle}
              isPickingContact={isPickingInviteContact}
              isSavingInvite={isInvitingEmployees}
              onAddContact={() => {
                void handleAddContactToDraft();
              }}
              onCancelDraft={() => setInviteDraft(null)}
              onSendDraft={() => {
                void handleSendInviteDraft();
              }}
              onSelectEmployee={handleSelectEmployeeLifecycle}
              profilePhotoHeaders={profilePhotoHeaders}
            />
          ) : null}

          {activeTab === 'Settings' && settingsScreen === 'list' ? (
            <SettingsList
              canManageCompanyProfile={canManageCompanyProfile}
              canManageDirectory={canManageDirectory}
              canManageGroups={canManageGroups}
              canManageSecurity={canManageSecurity}
              canManageUsers={canManageUsers}
              onOpenChatBackup={handleOpenChatBackupSettings}
              onOpenCompanyProfile={handleOpenCompanyProfileSettings}
              onOpenDepartmentAdminPermissions={handleOpenDepartmentAdminPermissions}
              onOpenDepartmentsAndRoles={handleOpenDirectorySettings}
              onOpenGroups={handleOpenGroupsSettings}
              onOpenMyDevices={handleOpenMyDevicesSettings}
              onOpenRolePermissions={handleOpenRolePermissions}
              onOpenSecurity={handleOpenSecuritySettings}
            />
          ) : null}

          {activeTab === 'Settings' && settingsScreen === 'directory' ? (
            <DirectorySettings
              departments={departments}
              filter={directoryFilter}
              isLoading={isLoadingSettings}
              roles={roles}
            />
          ) : null}

          {activeTab === 'Settings' && settingsScreen === 'role-permissions' ? (
            <RolePermissionSettings
              isLoading={isLoadingSettings}
              isSaving={isSavingRolePermissions}
              onTogglePermission={handleToggleRolePermission}
              permissions={rolePermissionCatalog}
              roles={roles}
            />
          ) : null}

          {activeTab === 'Settings' && settingsScreen === 'company-profile' ? (
            <CompanyProfileSettings
              companyAddress={companyAddressDraft}
              companyName={companyNameDraft}
              isLoading={isLoadingCompanyProfile}
              isSavingLogo={isSavingCompanyLogo}
              isSaving={isSavingCompanyProfile}
              onAddressChange={setCompanyAddressDraft}
              onChangeLogo={() => {
                void handleUpdateCompanyLogo();
              }}
              onNameChange={setCompanyNameDraft}
              onSave={() => {
                void handleSaveCompanyProfile();
              }}
              profile={companyProfile}
              profilePhotoHeaders={profilePhotoHeaders}
            />
          ) : null}

          {activeTab === 'Settings' && settingsScreen === 'dept-admin-permissions' ? (
            <DepartmentAdminPermissionSettings
              employees={approvedEmployees}
              isLoading={isLoadingSettings}
              isSaving={isSavingDepartmentAdminPermissions}
              onTogglePermission={handleToggleDepartmentAdminPermission}
              permissions={departmentAdminPermissionCatalog}
              profilePhotoHeaders={profilePhotoHeaders}
            />
          ) : null}

          {activeTab === 'Settings' && settingsScreen === 'groups' ? (
            <GroupsSettings
              groups={groups}
              isLoading={isLoadingGroups}
            />
          ) : null}

          {activeTab === 'Settings' && settingsScreen === 'security' ? (
            <SecuritySettings
              devices={tenantDevices}
              isLoading={isLoadingSecurity}
              isRevoking={isRevokingDevice}
              onRevokeDevice={handleRevokeDevice}
            />
          ) : null}

          {activeTab === 'Settings' && settingsScreen === 'my-devices' ? (
            <MyDevicesSettings
              devices={currentUserDevices}
              isLoading={isLoadingMyDevices}
              isRevoking={isRevokingMyDevice}
              onRevokeDevice={handleRevokeMyDevice}
            />
          ) : null}

          {activeTab === 'Settings' && settingsScreen === 'chat-backup' ? (
            <ChatBackupSettings
              canManagePolicy={canManageSecurity}
              isLoadingPolicy={isLoadingChatBackupPolicy}
              isSavingPolicy={isSavingChatBackupPolicy}
              isSyncing={isSyncingChatBackup}
              onBackupNow={() => {
                void handleBackupNow();
              }}
              onUpdatePolicy={(nextPolicy) => {
                void handleUpdateChatBackupPolicy(nextPolicy);
              }}
              onRestore={() => {
                void handleRestoreChatBackup();
              }}
              onShowRecoveryKey={() => {
                void handleShowBackupRecoveryKey();
              }}
              policy={chatBackupPolicy || DEFAULT_CHAT_BACKUP_POLICY}
            />
          ) : null}

          {activeTab === 'You' ? (
            <YouTab
              isLoading={isLoadingUserProfile}
              isSavingPhoto={isSavingUserPhoto}
              onChangePhoto={() => {
                void handleUpdateUserProfilePhoto();
              }}
              profile={userProfile}
              profilePhotoHeaders={profilePhotoHeaders}
            />
          ) : null}
        </ScrollView>
      )}

      {activeTab === 'Settings' && (settingsScreen === 'directory' || settingsScreen === 'groups') ? (
        <Pressable
          accessibilityLabel={
            settingsScreen === 'groups'
              ? 'Add group'
              : `Add ${directoryFilter === 'Departments' ? 'department' : 'role'}`
          }
          accessibilityRole="button"
          onPress={settingsScreen === 'groups' ? handleOpenAddGroupModal : handleOpenAddModal}
          style={({ pressed }) => [
            styles.floatingAddButton,
            { bottom: floatingAddBottom },
            pressed && styles.pressed
          ]}
        >
          <Text style={styles.floatingAddText}>+</Text>
        </Pressable>
      ) : null}

      {!selectedChat ? (
        <View style={[
        styles.footer,
        {
          borderRadius: isCompactAndroid ? 24 : 28,
          bottom: footerBottom,
          minHeight: footerHeight
        }
      ]}>
        {visibleFooterTabs.map((tab) => (
          <FooterTabButton
            active={activeTab === tab}
            key={tab}
            minHeight={footerTabHeight}
            onPress={() => handleSelectFooterTab(tab)}
            profile={userProfile}
            profilePhotoHeaders={profilePhotoHeaders}
            tab={tab}
          />
        ))}
        </View>
      ) : null}

      <MessageActionOverlay
        contactName={selectedChat?.title || ''}
        currentUid={currentUid}
        groupMembers={selectedChat?.members || []}
        isGroupChat={selectedChat?.chatType === 'GROUP'}
        message={messageActionTarget}
        onCopy={(message) => {
          void handleCopyMessage(message);
        }}
        onDelete={handleDeleteMessageForMe}
        onDismiss={() => setMessageActionTarget(null)}
        onForward={handleForwardMessage}
        onInfo={handleShowMessageInfo}
        onReact={handleReactToMessage}
        onReply={handleReplyToMessage}
        onStar={handleToggleMessageStar}
        profilePhotoHeaders={profilePhotoHeaders}
        currentUserReactions={messageActionTarget
          ? getCurrentUserReactionEmojis(
              messageReactions[messageActionTarget.messageId] || messageActionTarget.reactions,
              currentUid
            )
          : []}
        reactions={messageActionTarget
          ? messageReactions[messageActionTarget.messageId] || messageActionTarget.reactions || []
          : []}
        starred={messageActionTarget ? Boolean(starredMessageIds[messageActionTarget.messageId]) : false}
      />

      <MediaReviewModal
        activeIndex={mediaReviewActiveIndex}
        caption={mediaReviewCaption}
        contactName={selectedChat?.title || ''}
        isSending={isSendingMediaReview}
        items={mediaReviewItems}
        onCancel={handleCancelMediaReview}
        onCaptionChange={handleUpdateMediaReviewCaption}
        onRemoveItem={handleRemoveMediaReviewItem}
        onSelectIndex={handleSelectMediaReviewIndex}
        onSend={handleSendMediaReview}
      />

      <MediaViewerModal
        state={mediaViewer}
        onClose={() => setMediaViewer(null)}
      />

      <AudioAttachmentPreviewModal
        state={audioAttachmentPreview}
        onClose={() => setAudioAttachmentPreview(null)}
      />

      <ForwardRecipientModal
        contacts={chatContacts}
        isForwarding={isForwardingMessages}
        isOpen={isForwardRecipientModalOpen}
        onCancel={() => setIsForwardRecipientModalOpen(false)}
        onConfirm={() => {
          void handleConfirmForwardMessages();
        }}
        onToggleRecipient={handleToggleForwardRecipient}
        profilePhotoHeaders={profilePhotoHeaders}
        selectedCount={selectedForwardRecipientCount}
        selectedRecipientIds={forwardRecipientIds}
      />

      <NewChatModal
        contacts={directChatContacts}
        isOpen={isNewChatModalOpen}
        onCancel={handleCloseNewChatModal}
        onOpenAddMembers={handleOpenAddMembersModal}
        onOpenContact={(contact) => {
          void handleOpenContactFromNewChat(contact);
        }}
        onSearchChange={setNewChatSearch}
        profilePhotoHeaders={profilePhotoHeaders}
        search={newChatSearch}
      />

      <AddMembersModal
        contacts={directChatContacts}
        isOpen={isAddMembersModalOpen}
        onBack={handleReturnToNewChatModal}
        onNext={handleOpenGroupDetailsModal}
        onSearchChange={setAddMembersSearch}
        onToggleMember={handleToggleNewGroupMember}
        profilePhotoHeaders={profilePhotoHeaders}
        search={addMembersSearch}
        selectedMemberIds={selectedNewGroupMemberIds}
        selectedCount={selectedNewGroupMembers.length}
      />

      <GroupDetailsModal
        groupName={newGroupNameDraft}
        groupPhotoUri={newGroupPhotoUri}
        isOpen={isGroupDetailsModalOpen}
        members={selectedNewGroupMembers}
        onBack={handleReturnToAddMembersModal}
        onChangeGroupName={setNewGroupNameDraft}
        onCreate={() => {
          void handleCreateGroupChatDraft();
        }}
        onOpenPermissions={handleOpenGroupPermissionsModal}
        onPickPhoto={() => {
          void handlePickNewGroupPhoto();
        }}
        onRemoveMember={handleRemoveNewGroupMember}
        permissionMode={newGroupPermissionMode}
        profilePhotoHeaders={profilePhotoHeaders}
      />

      <GroupPermissionsModal
        isOpen={isGroupPermissionsModalOpen}
        onBack={handleReturnToGroupDetailsModal}
        onSelectPermission={setNewGroupPermissionMode}
        permissionMode={newGroupPermissionMode}
      />

      <GroupCallOptionsModal
        groupName={selectedChat?.title || 'Group'}
        isOpen={isGroupCallOptionsOpen}
        onClose={() => setIsGroupCallOptionsOpen(false)}
        onSelect={handleSelectGroupCallOption}
        onlineCount={activeGroupOnlineCount}
      />

      <GroupCallPeopleModal
        contacts={activeGroupMemberContacts}
        isOpen={isGroupCallPeopleModalOpen}
        mode={groupCallMode}
        onCancel={handleCloseGroupCallPeopleModal}
        onConfirm={handleConfirmGroupCallPeople}
        onSearchChange={setGroupCallPeopleSearch}
        onToggleMember={handleToggleGroupCallMember}
        onlineCount={activeGroupOnlineCount}
        profilePhotoHeaders={profilePhotoHeaders}
        search={groupCallPeopleSearch}
        selectedCount={selectedGroupCallMemberCount}
        selectedMemberIds={selectedGroupCallMemberIds}
      />

      <GroupSwitcherModal
        companyName={companyDisplayName}
        groups={groups}
        isLoading={isLoadingGroups}
        isOpen={isGroupSwitcherModalOpen}
        onAddGroup={handleStartGroupCreateFromSwitcher}
        onClose={() => setIsGroupSwitcherModalOpen(false)}
        onOpenGroup={handleOpenGroupFromSwitcher}
        selectedGroupId={selectedChat?.contactId || null}
      />

      <NativeOptionPickerModal picker={nativeOptionPicker} />

      <AddRecordModal
        description={newRecordDescription}
        filter={directoryFilter}
        isSaving={isSavingRecord}
        name={newRecordName}
        onCancel={() => setIsAddModalOpen(false)}
        onDescriptionChange={setNewRecordDescription}
        onNameChange={setNewRecordName}
        onSave={handleSaveRecord}
        visible={isAddModalOpen}
      />

      <AddGroupModal
        description={newGroupDescription}
        department={newGroupDepartment}
        isSaving={isSavingGroup}
        name={newGroupName}
        onCancel={() => {
          setIsAddGroupModalOpen(false);
          setNewGroupDescription('');
          setNewGroupName('');
          setNewGroupDepartment(null);
        }}
        onDescriptionChange={setNewGroupDescription}
        onNameChange={setNewGroupName}
        onSave={() => {
          void handleSaveGroup();
        }}
        visible={isAddGroupModalOpen}
      />

      <BatchContactModal
        candidates={batchContactCandidates}
        isLoading={isLoadingBatchContacts}
        onCancel={closeBatchContactSelector}
        onConfirm={handleConfirmBatchContacts}
        onSearchChange={setBatchContactSearch}
        onToggleContact={handleToggleBatchContact}
        search={batchContactSearch}
        selectedPhoneNumbers={selectedBatchPhoneNumbers}
        visible={isBatchContactModalOpen}
      />

      <ManualInviteModal
        onCancel={closeManualInviteModal}
        onChangePhone={setManualPhoneDraft}
        onConfirm={handleConfirmManualInvite}
        phone={manualPhoneDraft}
        visible={isManualInviteModalOpen}
      />

      <RecoveryKeyModal
        isRestoring={isSyncingChatBackup}
        onCancel={() => setIsRecoveryKeyModalOpen(false)}
        onChangeRecoveryKey={setRecoveryKeyDraft}
        onRestore={() => {
          void restoreChatBackupWithKey(recoveryKeyDraft);
        }}
        recoveryKey={recoveryKeyDraft}
        visible={isRecoveryKeyModalOpen}
      />
    </View>
  );
}

function HeaderActions({
  activeTab,
  canInviteEmployees,
  hasInviteDraft,
  isInvitingEmployees,
  onBatchImportEmployees,
  onInviteEmployee,
  onManualAddEmployee,
  onOpenNewChat
}: {
  activeTab: FooterTab;
  canInviteEmployees: boolean;
  hasInviteDraft: boolean;
  isInvitingEmployees: boolean;
  onBatchImportEmployees: () => void;
  onInviteEmployee: () => void;
  onManualAddEmployee: () => void;
  onOpenNewChat: () => void;
}) {
  const employeeActionDisabled = isInvitingEmployees || hasInviteDraft;

  return (
    <View style={styles.topActions}>
      <Pressable
        android_ripple={androidIconRipple}
        accessibilityLabel="Open options"
        accessibilityRole="button"
        style={({ pressed }) => [styles.roundIconButton, pressed && styles.pressed]}
      >
        <Ionicons color={colors.primary} name="ellipsis-horizontal-circle-outline" size={23} />
      </Pressable>

      {activeTab === 'Employees' && canInviteEmployees ? (
        <View style={styles.employeeTopActions}>
          <Pressable
            android_ripple={androidButtonRipple}
            accessibilityRole="button"
            disabled={employeeActionDisabled}
            onPress={onManualAddEmployee}
            style={({ pressed }) => [
              styles.inviteButtonSecondary,
              pressed && !employeeActionDisabled && styles.pressed,
              employeeActionDisabled && styles.disabled
            ]}
          >
            <Text style={styles.inviteButtonSecondaryText}>Phone</Text>
          </Pressable>

          <Pressable
            android_ripple={androidButtonRipple}
            accessibilityRole="button"
            disabled={employeeActionDisabled}
            onPress={onInviteEmployee}
            style={({ pressed }) => [
              styles.inviteButtonSecondary,
              pressed && !employeeActionDisabled && styles.pressed,
              employeeActionDisabled && styles.disabled
            ]}
          >
            <Text style={styles.inviteButtonSecondaryText}>Contact</Text>
          </Pressable>

          <Pressable
            android_ripple={androidButtonRipple}
            accessibilityRole="button"
            disabled={employeeActionDisabled}
            onPress={onBatchImportEmployees}
            style={({ pressed }) => [
              styles.inviteButton,
              pressed && !employeeActionDisabled && styles.pressed,
              employeeActionDisabled && styles.disabled
            ]}
          >
            <Text style={styles.inviteButtonText}>
              {isInvitingEmployees ? 'Importing' : 'Batch'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {activeTab === 'Chats' ? (
        <View style={styles.rightActions}>
          <Pressable
            android_ripple={androidIconRipple}
            accessibilityLabel="Open camera"
            accessibilityRole="button"
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Ionicons color={colors.primary} name="camera-outline" size={23} />
          </Pressable>
          <Pressable
            android_ripple={androidButtonRipple}
            accessibilityLabel="Start new chat"
            accessibilityRole="button"
            onPress={onOpenNewChat}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Ionicons color="#FFFFFF" name="add" size={22} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function MessageHeader({
  chat,
  onlineCount,
  onBack,
  onOpenGroupCallOptions,
  onOpenGroupPeoplePicker,
  onOpenGroupSwitcher,
  profilePhotoHeaders
}: {
  chat: ChatItem;
  onlineCount: number;
  onBack: () => void;
  onOpenGroupCallOptions: () => void;
  onOpenGroupPeoplePicker: () => void;
  onOpenGroupSwitcher: () => void;
  profilePhotoHeaders?: Record<string, string>;
}) {
  const isUserCreatedGroup = isUserCreatedGroupChat(chat);
  const presenceText = chat.chatType === 'GROUP'
    ? formatGroupOnlineCount(onlineCount)
    : chat.isOnline
      ? 'online'
      : '';

  return (
    <View style={styles.messageHeader}>
      <Pressable
        android_ripple={androidIconRipple}
        accessibilityLabel="Back to chats"
        accessibilityRole="button"
        onPress={onBack}
        style={({ pressed }) => [styles.messageBackButton, pressed && styles.pressed]}
      >
        <Text style={styles.messageBackText}>‹</Text>
      </Pressable>

      <Pressable
        accessibilityLabel={isUserCreatedGroup ? 'Open group list' : undefined}
        accessibilityRole={isUserCreatedGroup ? 'button' : undefined}
        disabled={!isUserCreatedGroup}
        onPress={onOpenGroupSwitcher}
        style={({ pressed }) => [
          styles.messageHeaderIdentity,
          pressed && isUserCreatedGroup && styles.pressed
        ]}
      >
        <ProfileAvatar
          headers={profilePhotoHeaders}
          name={chat.title}
          size={46}
          uri={chat.profilePhotoUrl}
        />

        <View style={styles.messageHeaderText}>
          <Text numberOfLines={1} style={styles.messageHeaderTitle}>{chat.title}</Text>
          {presenceText ? (
            <Text numberOfLines={1} style={styles.messageHeaderPresence}>{presenceText}</Text>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.messageHeaderActions}>
        {isUserCreatedGroup ? (
          <Pressable
            android_ripple={androidIconRipple}
            accessibilityLabel="Select people"
            accessibilityRole="button"
            onPress={onOpenGroupPeoplePicker}
            style={({ pressed }) => [styles.messageHeaderIcon, pressed && styles.pressed]}
          >
            <Ionicons color="#FFFFFF" name="person-add" size={24} />
          </Pressable>
        ) : null}
        <Pressable
          android_ripple={androidIconRipple}
          accessibilityLabel={isUserCreatedGroup ? 'Open group call options' : 'Video call'}
          accessibilityRole="button"
          onPress={isUserCreatedGroup ? onOpenGroupCallOptions : undefined}
          style={({ pressed }) => [styles.messageHeaderIcon, pressed && styles.pressed]}
        >
          <View style={styles.messageHeaderVideoIcon}>
            <Ionicons color="#FFFFFF" name="videocam" size={26} />
            {isUserCreatedGroup ? <Feather color="#FFFFFF" name="chevron-down" size={14} /> : null}
          </View>
        </Pressable>
        {!isUserCreatedGroup ? (
          <Pressable
            android_ripple={androidIconRipple}
            accessibilityLabel="Call"
            accessibilityRole="button"
            style={({ pressed }) => [styles.messageHeaderIcon, pressed && styles.pressed]}
          >
            <Ionicons color="#FFFFFF" name="call" size={25} />
          </Pressable>
        ) : null}
        <Pressable
          android_ripple={androidIconRipple}
          accessibilityLabel="More"
          accessibilityRole="button"
          onPress={isUserCreatedGroup ? onOpenGroupCallOptions : undefined}
          style={({ pressed }) => [styles.messageHeaderIcon, pressed && styles.pressed]}
        >
          <Ionicons color="#FFFFFF" name="ellipsis-vertical" size={27} />
        </Pressable>
      </View>
    </View>
  );
}

function ForwardSelectionHeader({
  isForwarding,
  onCancel,
  onForward,
  selectedCount,
  title
}: {
  isForwarding: boolean;
  onCancel: () => void;
  onForward: () => void;
  selectedCount: number;
  title: string;
}) {
  return (
    <View style={styles.forwardSelectionHeader}>
      <View style={styles.forwardSelectionTitleRow}>
        <ProfileAvatar name={title} size={34} uri={null} />
        <View style={styles.forwardSelectionTitleText}>
          <Text numberOfLines={1} style={styles.forwardSelectionTitle}>{title}</Text>
          <Text numberOfLines={1} style={styles.forwardSelectionSubtitle}>
            {selectedCount ? `${selectedCount} selected` : 'Select messages'}
          </Text>
        </View>
      </View>

      <View style={styles.forwardSelectionActions}>
        <Pressable
          accessibilityLabel="Forward selected messages"
          accessibilityRole="button"
          disabled={!selectedCount || isForwarding}
          onPress={onForward}
          style={({ pressed }) => [
            styles.forwardSelectionActionButton,
            (!selectedCount || isForwarding) && styles.disabled,
            pressed && Boolean(selectedCount) && !isForwarding && styles.pressed
          ]}
        >
          {isForwarding ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Feather color={selectedCount ? colors.primary : '#94A3B8'} name="corner-up-right" size={21} />
          )}
        </Pressable>

        <Pressable
          accessibilityLabel="Cancel forwarding"
          accessibilityRole="button"
          onPress={onCancel}
          style={({ pressed }) => [styles.forwardSelectionCloseButton, pressed && styles.pressed]}
        >
          <Feather color="#334155" name="x" size={24} />
        </Pressable>
      </View>
    </View>
  );
}

function MediaReviewModal({
  activeIndex,
  caption,
  contactName,
  isSending,
  items,
  onCancel,
  onCaptionChange,
  onRemoveItem,
  onSelectIndex,
  onSend
}: {
  activeIndex: number;
  caption: string;
  contactName: string;
  isSending: boolean;
  items: MediaReviewItem[];
  onCancel: () => void;
  onCaptionChange: (value: string) => void;
  onRemoveItem: (index: number) => void;
  onSelectIndex: (index: number) => void;
  onSend: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const activeItem = items[activeIndex] || null;
  const captionInputRef = useRef<TextInput | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const previewHeight = Math.max(280, height - insets.top - insets.bottom - 236);
  const activeMediaLabel = activeItem?.media.kind === 'video'
    ? 'Video'
    : activeItem?.media.kind === 'image'
      ? 'Photo'
      : 'Media';

  useEffect(() => {
    if (!items.length) {
      return;
    }

    scrollViewRef.current?.scrollTo({ animated: true, x: activeIndex * width, y: 0 });
  }, [activeIndex, items.length, width]);

  if (!items.length || !activeItem) {
    return null;
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onCancel}
      presentationStyle="fullScreen"
      transparent={false}
      visible
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.mediaReviewRoot}
      >
        <View style={[
          styles.mediaReviewTopBar,
          { paddingTop: Math.max(insets.top + 8, 20) }
        ]}>
          <Pressable
            accessibilityLabel="Close media preview"
            accessibilityRole="button"
            disabled={isSending}
            onPress={onCancel}
            style={({ pressed }) => [styles.mediaReviewIconButton, pressed && !isSending && styles.pressed]}
          >
            <Ionicons color="#FFFFFF" name="close" size={24} />
          </Pressable>

          <View style={styles.mediaReviewTitleWrap}>
            <Text numberOfLines={1} style={styles.mediaReviewTitle}>Preview</Text>
            <Text numberOfLines={1} style={styles.mediaReviewSubtitle}>
              {items.length > 1 ? `${items.length} selected` : activeMediaLabel}
            </Text>
          </View>

          <View style={styles.mediaReviewTools}>
            <Pressable
              accessibilityLabel="Add caption text"
              accessibilityRole="button"
              onPress={() => captionInputRef.current?.focus()}
              style={({ pressed }) => [styles.mediaReviewToolPill, pressed && styles.pressed]}
            >
              <Text style={styles.mediaReviewToolText}>Aa</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Remove selected media"
              accessibilityRole="button"
              disabled={isSending}
              onPress={() => onRemoveItem(activeIndex)}
              style={({ pressed }) => [
                styles.mediaReviewToolPill,
                pressed && !isSending && styles.pressed,
                isSending && styles.disabled
              ]}
            >
              <Feather color="#FFFFFF" name="trash-2" size={18} />
            </Pressable>
          </View>
        </View>

        <View style={styles.mediaReviewThumbnailBand}>
          <ScrollView
            contentContainerStyle={styles.mediaReviewThumbnailContent}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {items.map((item, index) => (
              <Pressable
                accessibilityLabel={`Preview item ${index + 1}`}
                accessibilityRole="button"
                key={item.id}
                onPress={() => onSelectIndex(index)}
                style={[
                  styles.mediaReviewThumbnail,
                  index === activeIndex && styles.mediaReviewThumbnailActive
                ]}
              >
                {item.media.kind === 'image' ? (
                  <Image
                    resizeMode="cover"
                    source={{ uri: item.media.uri }}
                    style={styles.mediaReviewThumbnailImage}
                  />
                ) : (
                  <View style={styles.mediaReviewThumbnailVideo}>
                    <Feather color="#FFFFFF" name="play" size={14} />
                  </View>
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <ScrollView
          horizontal
          keyboardShouldPersistTaps="handled"
          onMomentumScrollEnd={(event) => {
            const nextIndex = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1));
            onSelectIndex(nextIndex);
          }}
          pagingEnabled
          ref={scrollViewRef}
          showsHorizontalScrollIndicator={false}
          style={styles.mediaReviewPager}
        >
          {items.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.mediaReviewSlide,
                {
                  height: previewHeight,
                  width
                }
              ]}
            >
              {item.media.kind === 'image' ? (
                <Image
                  resizeMode="contain"
                  source={{ uri: item.media.uri }}
                  style={styles.mediaReviewPreviewImage}
                />
              ) : (
                <View style={styles.mediaReviewVideoPreview}>
                  <Ionicons color="#FFFFFF" name="play-circle" size={78} />
                  <Text style={styles.mediaReviewVideoMeta}>
                    {formatMediaDuration(item.media.durationMs)} • {formatByteCount(item.media.sizeBytes)}
                  </Text>
                </View>
              )}

              {items.length > 1 ? (
                <Pressable
                  accessibilityLabel="Remove selected media"
                  accessibilityRole="button"
                  disabled={isSending}
                  onPress={() => onRemoveItem(index)}
                  style={({ pressed }) => [
                    styles.mediaReviewRemoveButton,
                    pressed && !isSending && styles.pressed
                  ]}
                >
                  <Feather color="#FFFFFF" name="trash-2" size={20} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </ScrollView>

        <View style={[
          styles.mediaReviewFooter,
          { paddingBottom: Math.max(insets.bottom + 10, 18) }
        ]}>
          <View style={styles.mediaReviewCaptionRow}>
            <Feather color="#94A3B8" name="plus-square" size={18} />
            <TextInput
              autoCorrect
              multiline
              onChangeText={onCaptionChange}
              placeholder="Add a caption..."
              placeholderTextColor="#9CA3AF"
              ref={captionInputRef}
              style={styles.mediaReviewCaptionInput}
              value={caption}
            />
            <Text style={styles.mediaReviewInfoText}>{activeIndex + 1}/{items.length}</Text>
          </View>

          <View style={styles.mediaReviewSendRow}>
            <Text numberOfLines={1} style={styles.mediaReviewRecipient}>
              {contactName || 'Chat'}
            </Text>
            <Pressable
              accessibilityLabel="Send selected media"
              accessibilityRole="button"
              disabled={isSending}
              onPress={onSend}
              style={({ pressed }) => [
                styles.mediaReviewSendButton,
                pressed && !isSending && styles.pressed,
                isSending && styles.disabled
              ]}
            >
              {isSending ? (
                <ActivityIndicator color="#001F1D" size="small" />
              ) : (
                <>
                  {items.length > 1 ? (
                    <View style={styles.mediaReviewSendCount}>
                      <Text style={styles.mediaReviewSendCountText}>{items.length}</Text>
                    </View>
                  ) : null}
                  <Ionicons color="#001F1D" name="send" size={22} />
                </>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MediaViewerModal({
  onClose,
  state
}: {
  onClose: () => void;
  state: MediaViewerState | null;
}) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [activeIndex, setActiveIndex] = useState(state?.activeIndex || 0);

  useEffect(() => {
    if (!state) {
      return;
    }

    setActiveIndex(state.activeIndex);
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        animated: false,
        x: state.activeIndex * width,
        y: 0
      });
    }, 40);
  }, [state?.activeIndex, state?.items.length, width]);

  if (!state) {
    return null;
  }

  const activeMedia = state.items[activeIndex] || state.items[0];
  const viewerHeight = Math.max(260, height - insets.top - insets.bottom - 128);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      transparent={false}
      visible
    >
      <View style={styles.mediaViewerRoot}>
        <View style={[
          styles.mediaViewerTopBar,
          { paddingTop: Math.max(insets.top + 8, 20) }
        ]}>
          <Pressable
            accessibilityLabel="Close media viewer"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.mediaViewerCloseButton, pressed && styles.pressed]}
          >
            <Ionicons color="#FFFFFF" name="close" size={24} />
          </Pressable>
          <View style={styles.mediaViewerTitleWrap}>
            <Text numberOfLines={1} style={styles.mediaViewerTitle}>{state.title}</Text>
            <Text numberOfLines={1} style={styles.mediaViewerSubtitle}>
              {activeIndex + 1} of {state.items.length}
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          onMomentumScrollEnd={(event) => {
            const nextIndex = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1));

            setActiveIndex(Math.max(0, Math.min(nextIndex, state.items.length - 1)));
          }}
          pagingEnabled
          ref={scrollViewRef}
          showsHorizontalScrollIndicator={false}
          style={styles.mediaViewerPager}
        >
          {state.items.map((media, index) => {
            const localUri = getMediaLocalUri(media);

            return (
              <View
                key={`${media.mediaId || media.localUri || media.fileName}_${index}`}
                style={[
                  styles.mediaViewerSlide,
                  {
                    height: viewerHeight,
                    width
                  }
                ]}
              >
                {media.kind === 'image' && localUri ? (
                  <Image
                    resizeMode="contain"
                    source={{ uri: localUri }}
                    style={styles.mediaViewerImage}
                  />
                ) : (
                  <View style={styles.mediaViewerUnavailable}>
                    <Ionicons
                      color="#FFFFFF"
                      name={media.kind === 'video' ? 'play-circle' : 'image-outline'}
                      size={78}
                    />
                    <Text style={styles.mediaViewerUnavailableTitle}>
                      {media.kind === 'video' ? 'Video preview' : 'Media not available'}
                    </Text>
                    <Text style={styles.mediaViewerUnavailableText}>
                      {getMediaTransferLabel(media) || formatByteCount(media.sizeBytes)}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        <View style={[
          styles.mediaViewerFooter,
          { paddingBottom: Math.max(insets.bottom + 8, 14) }
        ]}>
          <ScrollView
            contentContainerStyle={styles.mediaViewerThumbnailContent}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {state.items.map((media, index) => {
              const localUri = getMediaLocalUri(media);

              return (
                <Pressable
                  accessibilityLabel={`View media item ${index + 1}`}
                  accessibilityRole="button"
                  key={`${media.mediaId || media.localUri || media.fileName}_thumb_${index}`}
                  onPress={() => {
                    setActiveIndex(index);
                    scrollViewRef.current?.scrollTo({
                      animated: true,
                      x: index * width,
                      y: 0
                    });
                  }}
                  style={[
                    styles.mediaViewerThumbnail,
                    index === activeIndex && styles.mediaViewerThumbnailActive
                  ]}
                >
                  {media.kind === 'image' && localUri ? (
                    <Image
                      resizeMode="cover"
                      source={{ uri: localUri }}
                      style={styles.mediaViewerThumbnailImage}
                    />
                  ) : (
                    <View style={styles.mediaViewerThumbnailPlaceholder}>
                      <Feather color="#FFFFFF" name={media.kind === 'video' ? 'play' : 'image'} size={15} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
          {activeMedia ? (
            <Text numberOfLines={1} style={styles.mediaViewerMeta}>
              {activeMedia.kind === 'video' ? `${formatMediaDuration(activeMedia.durationMs)} • ` : ''}
              {formatByteCount(activeMedia.sizeBytes)}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function AudioAttachmentPreviewModal({
  onClose,
  state
}: {
  onClose: () => void;
  state: AudioAttachmentPreviewState | null;
}) {
  const insets = useSafeAreaInsets();
  const [sourceUri, setSourceUri] = useState(state?.localUri || '');
  const [timelineWidth, setTimelineWidth] = useState(0);
  const player = useAudioPlayer(state?.localUri ? { uri: state.localUri } : null, {
    updateInterval: 250
  });
  const status = useAudioPlayerStatus(player);
  const playbackProgress = status.duration > 0
    ? Math.max(0, Math.min(status.currentTime / status.duration, 1))
    : 0;
  const currentLabel = status.currentTime > 0 ? formatAudioSeconds(status.currentTime) : '0:00';
  const durationLabel = status.duration > 0 ? formatAudioSeconds(status.duration) : '--:--';

  useEffect(() => {
    const nextUri = state?.localUri || '';

    setSourceUri(nextUri);

    if (!nextUri) {
      safePauseAudioPlayer(player);
      return;
    }

    try {
      safeReplaceAudioPlayerSource(player, nextUri);
    } catch {
      return;
    }

    const timer = setTimeout(() => {
      try {
        void setAudioModeAsync(CHAT_AUDIO_PLAYBACK_MODE).catch(() => undefined);
        safePlayAudioPlayer(player);
      } catch {
        // The user can still press play if the native player needs another moment to load.
      }
    }, 180);

    return () => {
      clearTimeout(timer);
    };
  }, [player, state?.localUri]);

  useEffect(() => () => {
    safePauseAudioPlayer(player);
  }, [player]);

  if (!state) {
    return null;
  }

  function handleTogglePlayback() {
    if (!sourceUri) {
      return;
    }

    try {
      if (status.playing) {
        safePauseAudioPlayer(player);
        return;
      }

      if (status.didJustFinish) {
        void player.seekTo(0).catch(() => undefined);
      } else if (status.duration > 0 && status.currentTime >= status.duration - 0.08) {
        void player.seekTo(0).catch(() => undefined);
      }

      void setAudioModeAsync(CHAT_AUDIO_PLAYBACK_MODE).catch(() => undefined);
      safePlayAudioPlayer(player);
    } catch (error) {
      Alert.alert('Audio unavailable', getErrorMessage(error, 'Unable to play this audio.'));
    }
  }

  function handleSeekPreviewAudio(locationX: number) {
    if (!status.duration || timelineWidth <= 0) {
      return;
    }

    void player.seekTo(getAudioSeekSeconds(locationX, timelineWidth, status.duration)).catch(() => undefined);
  }

  function handleSkipPreviewAudio(seconds: number) {
    if (!status.duration) {
      return;
    }

    const nextSeconds = clampAudioSeconds(status.currentTime + seconds, status.duration);

    void player.seekTo(nextSeconds).catch(() => undefined);
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      transparent={false}
      visible
    >
      <View style={[
        styles.audioPreviewRoot,
        {
          paddingBottom: Math.max(insets.bottom + 20, 34),
          paddingTop: Math.max(insets.top + 14, 28)
        }
      ]}>
        <View style={styles.audioPreviewHeader}>
          <Pressable
            accessibilityLabel="Close audio player"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.audioPreviewCloseButton, pressed && styles.pressed]}
          >
            <Ionicons color={colors.ink} name="close" size={24} />
          </Pressable>
          <Text numberOfLines={1} style={styles.audioPreviewHeaderTitle}>Audio</Text>
          <View style={styles.audioPreviewHeaderSpacer} />
        </View>

        <View style={styles.audioPreviewContent}>
          <View style={styles.audioPreviewFileIcon}>
            <Feather color="#FFFFFF" name="music" size={32} />
          </View>
          <Text numberOfLines={2} style={styles.audioPreviewFileName}>
            {state.fileName || 'Audio attachment'}
          </Text>
          <Text numberOfLines={1} style={styles.audioPreviewFileMeta}>
            {getReadableFileExtension(state.fileName) || 'Audio'} • {formatByteCount(state.sizeBytes)}
          </Text>

          <View style={styles.audioPreviewPlayer}>
            <Pressable
              accessibilityLabel="Go back 10 seconds"
              accessibilityRole="button"
              onPress={() => handleSkipPreviewAudio(-10)}
              style={({ pressed }) => [styles.audioPreviewSkipButton, pressed && styles.pressed]}
            >
              <Ionicons color={colors.primary} name="play-back" size={24} />
              <Text style={styles.audioPreviewSkipText}>10</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={status.playing ? 'Pause audio' : 'Play audio'}
              accessibilityRole="button"
              onPress={handleTogglePlayback}
              style={({ pressed }) => [styles.audioPreviewPlayButton, pressed && styles.pressed]}
            >
              <Ionicons color="#FFFFFF" name={status.playing ? 'pause' : 'play'} size={30} />
            </Pressable>
            <Pressable
              accessibilityLabel="Go forward 10 seconds"
              accessibilityRole="button"
              onPress={() => handleSkipPreviewAudio(10)}
              style={({ pressed }) => [styles.audioPreviewSkipButton, pressed && styles.pressed]}
            >
              <Ionicons color={colors.primary} name="play-forward" size={24} />
              <Text style={styles.audioPreviewSkipText}>10</Text>
            </Pressable>
          </View>
          <View style={styles.audioPreviewTimelineWrap}>
            <View
              onLayout={(event) => setTimelineWidth(event.nativeEvent.layout.width)}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={(event) => {
                event.stopPropagation();
                handleSeekPreviewAudio(event.nativeEvent.locationX);
              }}
              onResponderMove={(event) => {
                event.stopPropagation();
                handleSeekPreviewAudio(event.nativeEvent.locationX);
              }}
              onStartShouldSetResponder={() => true}
              style={styles.audioPreviewTrackHitArea}
            >
              <View style={styles.audioPreviewTrack}>
                <View
                  style={[
                    styles.audioPreviewTrackFill,
                    { width: `${Math.round(playbackProgress * 100)}%` }
                  ]}
                />
                <View
                  style={[
                    styles.audioPreviewTrackThumb,
                    { left: `${Math.round(playbackProgress * 100)}%` }
                  ]}
                />
              </View>
            </View>
            <View style={styles.audioPreviewTimeRow}>
              <Text style={styles.audioPreviewTimeText}>{currentLabel}</Text>
              <Text style={styles.audioPreviewTimeText}>{durationLabel}</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MessageThread({
  bottomInset,
  canChat,
  contactName,
  contactProfilePhotoUrl,
  currentUid,
  draft,
  groupMembers,
  isGroupChat,
  isCompactAndroid,
  isForwardMode,
  isLoading,
  isSending,
  messageReactions,
  messages,
  onCancelReply,
  onDraftChange,
  onMessageLongPress,
  onOpenMedia,
  onPrepareAttachment,
  onMessageReply,
  onPickFile,
  onPickMedia,
  onToggleForwardMessage,
  onSend,
  onSendVoiceNote,
  profilePhotoHeaders,
  replyTarget,
  selectedForwardMessageIds,
  starredMessageIds
}: {
  bottomInset: number;
  canChat: boolean;
  contactName: string;
  contactProfilePhotoUrl: string | null;
  currentUid: string;
  draft: string;
  groupMembers: ChatGroupMember[];
  isGroupChat: boolean;
  isCompactAndroid: boolean;
  isForwardMode: boolean;
  isLoading: boolean;
  isSending: boolean;
  messageReactions: ChatMessageReactionMap;
  messages: ChatMessage[];
  onCancelReply: () => void;
  onDraftChange: (value: string) => void;
  onMessageLongPress: (message: ChatMessage) => void;
  onOpenMedia: (message: ChatMessage, activeIndex: number) => void;
  onPrepareAttachment: (message: ChatMessage, activeIndex: number) => Promise<string | null>;
  onMessageReply: (message: ChatMessage) => void;
  onPickFile: () => void;
  onPickMedia: () => void;
  onToggleForwardMessage: (message: ChatMessage) => void;
  onSend: () => void;
  onSendVoiceNote: (media: LocalChatMediaInput) => void;
  profilePhotoHeaders?: Record<string, string>;
  replyTarget: ChatMessage | null;
  selectedForwardMessageIds: Record<string, boolean>;
  starredMessageIds: Record<string, boolean>;
}) {
  const recorder = useAudioRecorder(VOICE_NOTE_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isVoiceRecorderBusy, setIsVoiceRecorderBusy] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [messageInputHeight, setMessageInputHeight] = useState(MESSAGE_INPUT_MIN_HEIGHT);
  const [messageInputWidth, setMessageInputWidth] = useState(0);
  const [showScrollToLatest, setShowScrollToLatest] = useState(false);
  const [scrollToLatestUnreadCount, setScrollToLatestUnreadCount] = useState(0);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [activeAudioPlaybackId, setActiveAudioPlaybackId] = useState<string | null>(null);
  const canSend = canChat && draft.trim().length > 0 && !isSending && !isVoiceRecording;
  const threadItems = buildMessageThreadItems(uniqueChatMessages(messages));
  const groupMemberByUid = useMemo(() => new Map(groupMembers.map((member) => [member.uid, member])), [groupMembers]);
  const inputRef = useRef<TextInput | null>(null);
  const activeVoiceRecordingUriRef = useRef<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAtLatestRef = useRef(true);
  const lastReplyJumpRef = useRef<{ messageId: string; timestamp: number } | null>(null);
  const messageOffsetsRef = useRef<Record<string, number>>({});
  const previousMessageCountRef = useRef(0);
  const androidClosedComposerBottomPadding = Math.max(
    8,
    Math.min(bottomInset + 4, isCompactAndroid ? 12 : 14)
  );
  const iosClosedComposerBottomPadding = Math.max(
    8,
    Math.min(bottomInset + 2, 14)
  );
  const composerBottomPadding = Platform.OS === 'android'
    ? isKeyboardVisible
      ? 6
      : androidClosedComposerBottomPadding
    : isKeyboardVisible
      ? 6
      : iosClosedComposerBottomPadding;
  const messageInputBoxHeight = Math.max(42, messageInputHeight + MESSAGE_INPUT_BOX_EXTRA_HEIGHT);
  const composerControlHeight = isVoiceRecording ? 42 : messageInputBoxHeight;
  const scrollToLatestButtonBottom = composerBottomPadding + composerControlHeight + (replyTarget ? 70 : 22);
  const scrollViewRef = useRef<ScrollView | null>(null);

  function updateLatestVisibility(offsetY: number, viewportHeight: number, contentHeight: number) {
    const distanceFromBottom = contentHeight - (offsetY + viewportHeight);
    const isAtLatest = distanceFromBottom <= 72 || contentHeight <= viewportHeight + 8;

    isAtLatestRef.current = isAtLatest;
    setShowScrollToLatest(!isAtLatest);

    if (isAtLatest) {
      setScrollToLatestUnreadCount(0);
    }
  }

  function scrollToLatest(animated = true) {
    scrollViewRef.current?.scrollToEnd({ animated });
    isAtLatestRef.current = true;
    setShowScrollToLatest(false);
    setScrollToLatestUnreadCount(0);
  }

  function handleMessageLayout(messageId: string, y: number) {
    messageOffsetsRef.current[messageId] = y;
  }

  function handleReplyPreviewPress(messageId: string) {
    const targetY = messageOffsetsRef.current[messageId];

    if (typeof targetY !== 'number') {
      return;
    }

    const now = Date.now();

    if (
      lastReplyJumpRef.current?.messageId === messageId &&
      now - lastReplyJumpRef.current.timestamp < 450
    ) {
      return;
    }

    lastReplyJumpRef.current = { messageId, timestamp: now };

    scrollViewRef.current?.scrollTo({
      animated: true,
      y: Math.max(targetY - 18, 0)
    });
    setHighlightedMessageId(messageId);

    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }

    highlightTimerRef.current = setTimeout(() => {
      setHighlightedMessageId(null);
      highlightTimerRef.current = null;
    }, 1500);
  }

  async function handleStartVoiceRecording() {
    if (!canChat || isVoiceRecorderBusy || isSending) {
      return;
    }

    try {
      setIsVoiceRecorderBusy(true);
      const permission = await requestRecordingPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Microphone access needed', 'Please allow microphone access to record a voice note.');
        return;
      }

      await setAudioModeAsync(CHAT_AUDIO_RECORDING_MODE);
      await recorder.prepareToRecordAsync(VOICE_NOTE_RECORDING_OPTIONS);
      recorder.record();
      activeVoiceRecordingUriRef.current = recorder.uri || recorderState.url || null;
      setIsVoiceRecording(true);
      Keyboard.dismiss();
    } catch (error) {
      await setAudioModeAsync(CHAT_AUDIO_PLAYBACK_MODE).catch(() => undefined);
      Alert.alert('Voice note unavailable', getErrorMessage(error, 'Unable to start recording.'));
    } finally {
      setIsVoiceRecorderBusy(false);
    }
  }

  async function handleCancelVoiceRecording() {
    if (!isVoiceRecording || isVoiceRecorderBusy) {
      return;
    }

    try {
      setIsVoiceRecorderBusy(true);

      if (safeIsAudioRecorderRecording(recorder)) {
        await safeStopAudioRecorder(recorder);
      }

      const recordedUri = recorder.uri || recorderState.url || activeVoiceRecordingUriRef.current;

      if (recordedUri) {
        await FileSystem.deleteAsync(recordedUri, { idempotent: true }).catch(() => undefined);
      }
    } catch {
      // Cancel should stay quiet; the user is leaving the recording flow.
    } finally {
      activeVoiceRecordingUriRef.current = null;
      setIsVoiceRecording(false);
      setIsVoiceRecorderBusy(false);
      await setAudioModeAsync(CHAT_AUDIO_PLAYBACK_MODE).catch(() => undefined);
    }
  }

  async function handleStopAndSendVoiceRecording() {
    if (!isVoiceRecording || isVoiceRecorderBusy) {
      return;
    }

    try {
      setIsVoiceRecorderBusy(true);
      const durationMs = Math.max(
        recorderState.durationMillis || 0,
        Math.round((recorder.currentTime || 0) * 1000)
      );

      if (safeIsAudioRecorderRecording(recorder)) {
        await safeStopAudioRecorder(recorder);
      }

      await setAudioModeAsync(CHAT_AUDIO_PLAYBACK_MODE).catch(() => undefined);

      const recordedUri = recorder.uri || recorderState.url || activeVoiceRecordingUriRef.current;
      activeVoiceRecordingUriRef.current = null;
      setIsVoiceRecording(false);

      if (!recordedUri) {
        throw new Error('Recording could not be saved.');
      }

      if (durationMs < VOICE_NOTE_MIN_DURATION_MS) {
        await FileSystem.deleteAsync(recordedUri, { idempotent: true }).catch(() => undefined);
        Alert.alert('Voice note too short', 'Please record a longer voice note.');
        return;
      }

      onSendVoiceNote({
        contentType: getVoiceNoteContentType(recordedUri),
        durationMs,
        fileName: buildVoiceNoteFileName(recordedUri),
        kind: 'audio',
        sizeBytes: await getLocalFileSize(recordedUri),
        uri: recordedUri
      });
    } catch (error) {
      activeVoiceRecordingUriRef.current = null;
      setIsVoiceRecording(false);
      await setAudioModeAsync(CHAT_AUDIO_PLAYBACK_MODE).catch(() => undefined);
      Alert.alert('Voice note not sent', getErrorMessage(error, 'Unable to send this voice note.'));
    } finally {
      setIsVoiceRecorderBusy(false);
    }
  }

  function handleComposerActionPress() {
    if (canSend) {
      onSend();
      return;
    }

    if (isVoiceRecording) {
      void handleStopAndSendVoiceRecording();
      return;
    }

    void handleStartVoiceRecording();
  }

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => () => {
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (recorder.uri || recorderState.url) {
      activeVoiceRecordingUriRef.current = recorder.uri || recorderState.url;
    }
  }, [recorder.uri, recorderState.url]);

  useEffect(() => () => {
    if (safeIsAudioRecorderRecording(recorder)) {
      void safeStopAudioRecorder(recorder);
    }

    void setAudioModeAsync(CHAT_AUDIO_PLAYBACK_MODE).catch(() => undefined);
  }, [recorder]);

  useEffect(() => {
    if (!messages.length) {
      previousMessageCountRef.current = 0;
      setScrollToLatestUnreadCount(0);
      return;
    }

    const previousMessageCount = previousMessageCountRef.current;
    const latestMessage = messages[messages.length - 1];

    previousMessageCountRef.current = messages.length;

    if (previousMessageCount > 0 && !isAtLatestRef.current && !latestMessage?.isMine) {
      const newIncomingCount = messages
        .slice(previousMessageCount)
        .filter((message) => !message.isMine).length;

      if (newIncomingCount > 0) {
        setScrollToLatestUnreadCount((currentCount) => currentCount + newIncomingCount);
      }
      setShowScrollToLatest(true);
      return;
    }

    setTimeout(() => {
      scrollToLatest(previousMessageCount > 0);
    }, 50);
  }, [messages.length]);

  useEffect(() => {
    if (!isKeyboardVisible) {
      return;
    }

    setTimeout(() => {
      scrollToLatest(true);
    }, 80);
  }, [isKeyboardVisible]);

  useEffect(() => {
    if (!replyTarget || !canChat) {
      return;
    }

    setTimeout(() => {
      inputRef.current?.focus();
      scrollToLatest(true);
    }, 90);
  }, [canChat, replyTarget?.messageId]);

  useEffect(() => {
    if (draft.length === 0) {
      setMessageInputHeight(MESSAGE_INPUT_MIN_HEIGHT);
    }
  }, [draft.length]);

  const updateMessageInputHeight = (nextHeight: number) => {
    setMessageInputHeight((currentHeight) => (
      Math.abs(currentHeight - nextHeight) > 1 ? nextHeight : currentHeight
    ));
  };

  return (
    <View style={styles.messageScreen}>
      <ScrollView
        contentContainerStyle={styles.messageListContent}
        keyboardShouldPersistTaps="always"
        onContentSizeChange={() => {
          if (isAtLatestRef.current) {
            setTimeout(() => scrollToLatest(false), 20);
          } else {
            setShowScrollToLatest(true);
          }
        }}
        onScroll={(event) => {
          updateLatestVisibility(
            event.nativeEvent.contentOffset.y,
            event.nativeEvent.layoutMeasurement.height,
            event.nativeEvent.contentSize.height
          );
        }}
        scrollEventThrottle={80}
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        style={styles.messageList}
      >
        {isLoading ? (
          <View style={styles.messageLoadingRow}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {threadItems.map((item) => (
          item.type === 'date' ? (
            <View key={item.id} style={styles.messageDateRow}>
              <Text style={styles.messageDateText}>{item.label}</Text>
            </View>
          ) : (
            <MessageBubble
              contactName={contactName}
              contactProfilePhotoUrl={contactProfilePhotoUrl}
              currentUid={currentUid}
              isSelectable={isForwardMode}
              isSelected={Boolean(selectedForwardMessageIds[item.message.messageId])}
              key={item.id}
              highlighted={highlightedMessageId === item.message.messageId}
              message={item.message}
              isGroupChat={isGroupChat}
              onLayout={handleMessageLayout}
              onLongPress={isForwardMode ? undefined : onMessageLongPress}
              onOpenMedia={isForwardMode ? undefined : onOpenMedia}
              onPrepareAttachment={isForwardMode ? undefined : onPrepareAttachment}
              onReplyPreviewPress={isForwardMode ? undefined : handleReplyPreviewPress}
              onReply={isForwardMode ? undefined : onMessageReply}
              onToggleSelect={onToggleForwardMessage}
              activeAudioPlaybackId={activeAudioPlaybackId}
              onActivateAudioPlayback={setActiveAudioPlaybackId}
              onDeactivateAudioPlayback={(audioPlaybackId) => {
                setActiveAudioPlaybackId((currentAudioPlaybackId) =>
                  currentAudioPlaybackId === audioPlaybackId ? null : currentAudioPlaybackId
                );
              }}
              profilePhotoHeaders={profilePhotoHeaders}
              reactions={messageReactions[item.message.messageId] || item.message.reactions || []}
              senderMember={isGroupChat ? groupMemberByUid.get(item.message.senderUid) || null : null}
              starred={Boolean(starredMessageIds[item.message.messageId])}
            />
          )
        ))}
      </ScrollView>

      {showScrollToLatest && !isForwardMode ? (
        <Pressable
          accessibilityLabel="Scroll to latest message"
          accessibilityRole="button"
          onPress={() => scrollToLatest(true)}
          style={({ pressed }) => [
            styles.scrollToLatestButton,
            { bottom: scrollToLatestButtonBottom },
            pressed && styles.pressed
          ]}
        >
          {scrollToLatestUnreadCount > 0 ? (
            <View style={styles.scrollToLatestBadge}>
              <Text style={styles.scrollToLatestBadgeText}>
                {scrollToLatestUnreadCount > 99 ? '99+' : scrollToLatestUnreadCount}
              </Text>
            </View>
          ) : null}
          <Ionicons color={colors.primary} name="chevron-down" size={24} />
        </Pressable>
      ) : null}

      {!isForwardMode ? (
      <View style={[styles.messageComposer, { paddingBottom: composerBottomPadding }]}>
        <View style={styles.messageComposerMain}>
          {replyTarget ? (
            <ComposerReplyPreview
              contactName={contactName}
              currentUid={currentUid}
              message={replyTarget}
              onCancel={onCancelReply}
            />
          ) : null}

          {isVoiceRecording ? (
            <View style={[
              styles.voiceRecordingBox,
              replyTarget && styles.messageInputBoxWithReply
            ]}>
              <Pressable
                accessibilityLabel="Cancel voice note"
                accessibilityRole="button"
                disabled={isVoiceRecorderBusy}
                onPress={() => {
                  void handleCancelVoiceRecording();
                }}
                style={({ pressed }) => [
                  styles.voiceRecordingCancelButton,
                  pressed && styles.pressed,
                  isVoiceRecorderBusy && styles.disabled
                ]}
              >
                <Feather color="#EF4444" name="trash-2" size={19} />
              </Pressable>
              <View style={styles.voiceRecordingDot} />
              <Text numberOfLines={1} style={styles.voiceRecordingText}>
                {formatMediaDuration(recorderState.durationMillis)}
              </Text>
              <Text numberOfLines={1} style={styles.voiceRecordingHint}>
                Recording
              </Text>
            </View>
          ) : (
            <View style={[
              styles.messageInputBox,
              { height: messageInputBoxHeight },
              replyTarget && styles.messageInputBoxWithReply
            ]}>
              <Pressable
                accessibilityLabel="Open emoji"
                accessibilityRole="button"
                style={({ pressed }) => [styles.messageComposerIconButton, pressed && styles.pressed]}
              >
                <Ionicons color="#8B95A5" name="happy-outline" size={23} />
              </Pressable>
              <TextInput
                editable={canChat}
                multiline
                onChangeText={(value) => {
                  onDraftChange(value);
                  updateMessageInputHeight(estimateMessageInputHeight(value, messageInputWidth));
                }}
                onContentSizeChange={(event) => {
                  const contentHeight = Math.ceil(event.nativeEvent.contentSize.height);
                  const estimatedHeight = estimateMessageInputHeight(draft, messageInputWidth);
                  const nextHeight = clampMessageInputHeight(
                    Math.max(contentHeight, estimatedHeight)
                  );

                  updateMessageInputHeight(nextHeight);
                }}
                onLayout={(event) => {
                  const nextWidth = Math.ceil(event.nativeEvent.layout.width);
                  setMessageInputWidth((currentWidth) => (
                    Math.abs(currentWidth - nextWidth) > 1 ? nextWidth : currentWidth
                  ));
                  if (draft.length > 0) {
                    updateMessageInputHeight(estimateMessageInputHeight(draft, nextWidth));
                  }
                }}
                placeholder={canChat ? 'Type a message' : 'Waiting for secure device'}
                placeholderTextColor="#8B95A5"
                ref={inputRef}
                scrollEnabled={messageInputHeight >= MESSAGE_INPUT_MAX_HEIGHT}
                style={[styles.messageInput, { height: messageInputHeight }]}
                value={draft}
              />
              <Pressable
                accessibilityLabel="Attach file"
                accessibilityRole="button"
                disabled={!canChat || isSending}
                onPress={onPickFile}
                style={({ pressed }) => [styles.messageComposerIconButton, pressed && styles.pressed]}
              >
                <Feather color="#8B95A5" name="paperclip" size={19} />
              </Pressable>
              <Pressable
                accessibilityLabel="Open camera"
                accessibilityRole="button"
                disabled={!canChat || isSending}
                onPress={onPickMedia}
                style={({ pressed }) => [styles.messageComposerIconButton, pressed && styles.pressed]}
              >
                <Ionicons color="#8B95A5" name="camera" size={20} />
              </Pressable>
            </View>
          )}
        </View>

        <Pressable
          accessibilityLabel={!canChat ? 'Secure chat not ready' : canSend ? 'Send message' : isVoiceRecording ? 'Send voice note' : 'Record voice message'}
          accessibilityRole="button"
          disabled={!canChat || isSending || isVoiceRecorderBusy}
          onPress={handleComposerActionPress}
          style={({ pressed }) => [
            styles.messageSendButton,
            isVoiceRecording && styles.voiceRecordingSendButton,
            pressed && (canSend || isVoiceRecording || !draft.trim()) && styles.pressed,
            (isSending || !canChat || isVoiceRecorderBusy) && styles.disabled
          ]}
        >
          {isSending || isVoiceRecorderBusy ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Ionicons
              color="#FFFFFF"
              name={canSend || isVoiceRecording ? 'send' : 'mic'}
              size={canSend || isVoiceRecording ? 20 : 22}
            />
          )}
        </Pressable>
      </View>
      ) : null}
    </View>
  );
}

function ComposerReplyPreview({
  contactName,
  currentUid,
  message,
  onCancel
}: {
  contactName: string;
  currentUid: string;
  message: ChatMessage;
  onCancel: () => void;
}) {
  const authorLabel = getReplyAuthorLabel(message.senderUid, currentUid, contactName);

  return (
    <View style={styles.composerReplyPreview}>
      <View style={styles.composerReplyAccent} />
      <View style={styles.composerReplyTextWrap}>
        <Text numberOfLines={1} style={[
          styles.composerReplyAuthor,
          message.senderUid === currentUid ? styles.replyAuthorMine : styles.replyAuthorTheirs
        ]}>
          {authorLabel}
        </Text>
        <Text numberOfLines={1} style={styles.composerReplyText}>
          {formatReplyPreviewText(getChatMessagePreview(message))}
        </Text>
      </View>
      <Pressable
        accessibilityLabel="Cancel reply"
        accessibilityRole="button"
        onPress={onCancel}
        style={({ pressed }) => [styles.composerReplyCloseButton, pressed && styles.pressed]}
      >
        <Feather color="#64748B" name="x-circle" size={20} />
      </Pressable>
    </View>
  );
}

function BubbleReplyPreview({
  contactName,
  currentUid,
  isMine,
  onPress,
  replyTo
}: {
  contactName: string;
  currentUid: string;
  isMine: boolean;
  onPress?: () => void;
  replyTo: ChatReplyReference;
}) {
  return (
    <Pressable
      accessibilityLabel="Open original message"
      accessibilityRole="button"
      disabled={!onPress}
      hitSlop={4}
      onPressIn={onPress}
      pressRetentionOffset={8}
      style={[
      styles.bubbleReplyPreview,
      isMine ? styles.bubbleReplyPreviewMine : styles.bubbleReplyPreviewTheirs
    ]}>
      <View style={[
        styles.bubbleReplyAccent,
        isMine ? styles.bubbleReplyAccentMine : styles.bubbleReplyAccentTheirs
      ]} />
      <View style={styles.bubbleReplyTextWrap}>
        <Text numberOfLines={1} style={[
          styles.bubbleReplyAuthor,
          replyTo.senderUid === currentUid ? styles.replyAuthorMine : styles.replyAuthorTheirs
        ]}>
          {getReplyAuthorLabel(replyTo.senderUid, currentUid, contactName)}
        </Text>
        <Text numberOfLines={2} style={styles.bubbleReplyText}>
          {formatReplyPreviewText(replyTo.text)}
        </Text>
      </View>
    </Pressable>
  );
}

function AudioMessageAttachment({
  activeAudioPlaybackId,
  audioPlaybackId,
  isMine,
  media,
  onActivateAudioPlayback,
  onDeactivateAudioPlayback,
  onLongPress,
  onPrepareAudio,
  profilePhotoHeaders,
  senderName,
  senderProfilePhotoUrl
}: {
  activeAudioPlaybackId?: string | null;
  audioPlaybackId: string;
  isMine: boolean;
  media: ChatMediaAttachment;
  onActivateAudioPlayback?: (audioPlaybackId: string) => void;
  onDeactivateAudioPlayback?: (audioPlaybackId: string) => void;
  onLongPress?: () => void;
  onPrepareAudio?: () => Promise<string | null>;
  profilePhotoHeaders?: Record<string, string>;
  senderName: string;
  senderProfilePhotoUrl: string | null;
}) {
  const initialLocalUri = getMediaLocalUri(media);
  const [sourceUri, setSourceUri] = useState(initialLocalUri);
  const [isPreparingAudio, setIsPreparingAudio] = useState(false);
  const [waveformWidth, setWaveformWidth] = useState(0);
  const player = useAudioPlayer(sourceUri ? { uri: sourceUri } : null, {
    updateInterval: 250
  });
  const status = useAudioPlayerStatus(player);
  const transferLabel = getMediaTransferLabel(media);
  const transferProgress = Math.max(0, Math.min(media.transferProgress || 0, 1));
  const playbackProgress = status.duration > 0
    ? Math.max(0, Math.min(status.currentTime / status.duration, 1))
    : 0;
  const isPreparing = isPreparingAudio || (!sourceUri && isMediaTransferActive(media));
  const durationLabel = status.duration > 0
    ? formatAudioSeconds(status.duration)
    : media.durationMs
      ? formatMediaDuration(media.durationMs)
      : formatByteCount(media.sizeBytes);
  const positionLabel = status.currentTime > 0 ? formatAudioSeconds(status.currentTime) : '0:00';
  const waveformBars = useMemo(() => buildVoiceNoteWaveform(media), [media.fileName, media.mediaId, media.sizeBytes]);
  const activeWaveformBars = Math.round((isPreparing ? transferProgress : playbackProgress) * waveformBars.length);

  useEffect(() => {
    const nextLocalUri = getMediaLocalUri(media);

    if (nextLocalUri && nextLocalUri !== sourceUri) {
      setSourceUri(nextLocalUri);
      try {
        safeReplaceAudioPlayerSource(player, nextLocalUri);
      } catch {
        // Source replacement can race with native player disposal during fast scroll/navigation.
      }
    }
  }, [media.localUri, media.mediaId, player, sourceUri]);

  useEffect(() => () => {
    safePauseAudioPlayer(player);
  }, [player]);

  useEffect(() => {
    if (status.playing && activeAudioPlaybackId && activeAudioPlaybackId !== audioPlaybackId) {
      safePauseAudioPlayer(player);
    }
  }, [activeAudioPlaybackId, audioPlaybackId, player, status.playing]);

  useEffect(() => {
    if (status.didJustFinish && activeAudioPlaybackId === audioPlaybackId) {
      onDeactivateAudioPlayback?.(audioPlaybackId);
    }
  }, [
    activeAudioPlaybackId,
    audioPlaybackId,
    onDeactivateAudioPlayback,
    status.didJustFinish
  ]);

  async function handleSeekVoiceNote(locationX: number) {
    if (!status.duration || waveformWidth <= 0) {
      return;
    }

    await player.seekTo(getAudioSeekSeconds(locationX, waveformWidth, status.duration));
  }

  async function handleTogglePlayback() {
    try {
      let playableUri: string | null = sourceUri || getMediaLocalUri(media) || null;

      if (!playableUri && onPrepareAudio) {
        setIsPreparingAudio(true);
        playableUri = await onPrepareAudio();
      }

      if (!playableUri) {
        throw new Error('This audio could not be downloaded.');
      }

      if (playableUri !== sourceUri) {
        setSourceUri(playableUri);
        safeReplaceAudioPlayerSource(player, playableUri);
      }

      if (status.playing) {
        safePauseAudioPlayer(player);
        onDeactivateAudioPlayback?.(audioPlaybackId);
        return;
      }

      if (status.didJustFinish) {
        await player.seekTo(0).catch(() => undefined);
      } else if (status.duration > 0 && status.currentTime >= status.duration - 0.08) {
        await player.seekTo(0).catch(() => undefined);
      }

      await setAudioModeAsync(CHAT_AUDIO_PLAYBACK_MODE).catch(() => undefined);
      onActivateAudioPlayback?.(audioPlaybackId);
      safePlayAudioPlayer(player);
    } finally {
      setIsPreparingAudio(false);
    }
  }

  return (
    <Pressable
      accessibilityLabel={status.playing ? 'Pause audio' : 'Play audio'}
      accessibilityRole="button"
      delayLongPress={320}
      onLongPress={(event) => {
        event.stopPropagation();
        onLongPress?.();
      }}
      onPress={(event) => {
        event.stopPropagation();
        void handleTogglePlayback().catch((error) => {
          Alert.alert('Audio unavailable', getErrorMessage(error, 'Unable to play this audio.'));
        });
      }}
      style={({ pressed }) => [
        styles.messageVoiceNoteCard,
        isMine ? styles.messageAttachmentCardMine : styles.messageAttachmentCardTheirs,
        pressed && styles.pressed
      ]}
    >
      <View style={[
        styles.messageVoiceNotePlayButton,
        isMine ? styles.messageVoiceNotePlayButtonMine : styles.messageVoiceNotePlayButtonTheirs
      ]}>
        {isPreparing ? (
          <ActivityIndicator color={isMine ? colors.primary : '#64748B'} size="small" />
        ) : (
          <Ionicons
            color={isMine ? colors.primary : '#64748B'}
            name={status.playing ? 'pause' : 'play'}
            size={22}
          />
        )}
      </View>
      <View style={styles.messageVoiceNoteBody}>
        <View
          onLayout={(event) => setWaveformWidth(event.nativeEvent.layout.width)}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(event) => {
            event.stopPropagation();
            void handleSeekVoiceNote(event.nativeEvent.locationX);
          }}
          onResponderMove={(event) => {
            event.stopPropagation();
            void handleSeekVoiceNote(event.nativeEvent.locationX);
          }}
          onStartShouldSetResponder={() => true}
          style={styles.messageVoiceWaveformRow}
        >
          {waveformBars.map((heightValue, index) => (
            <View
              key={`${media.mediaId || media.fileName}_${index}`}
              style={[
                styles.messageVoiceWaveformBar,
                {
                  backgroundColor: index < activeWaveformBars
                    ? colors.primary
                    : isMine
                      ? 'rgba(22, 101, 52, 0.28)'
                      : 'rgba(100, 116, 139, 0.34)',
                  height: heightValue
                }
              ]}
            />
          ))}
        </View>
        <View style={styles.messageVoiceNoteMetaRow}>
          <Text numberOfLines={1} style={styles.messageAttachmentMeta}>
            {transferLabel || (status.playing || status.currentTime > 0 ? positionLabel : durationLabel)}
          </Text>
          {media.transferStatus === 'uploading' || media.transferStatus === 'queued' ? (
            <Text numberOfLines={1} style={styles.messageVoiceNoteMetaDot}>
              {formatByteCount(media.sizeBytes)}
            </Text>
          ) : null}
        </View>
      </View>
      {!isMine ? (
        <ProfileAvatar
          headers={profilePhotoHeaders}
          name={senderName}
          size={34}
          uri={senderProfilePhotoUrl}
        />
      ) : null}
    </Pressable>
  );
}

function MessageMediaPreview({
  activeAudioPlaybackId,
  height,
  isMine,
  media,
  messageId,
  onActivateAudioPlayback,
  onDeactivateAudioPlayback,
  onLongPress,
  onPress,
  onPrepareFile,
  profilePhotoHeaders,
  senderName,
  senderProfilePhotoUrl,
  sourceUri,
  width
}: {
  activeAudioPlaybackId?: string | null;
  height: number;
  isMine: boolean;
  media: ChatMediaAttachment;
  messageId: string;
  onActivateAudioPlayback?: (audioPlaybackId: string) => void;
  onDeactivateAudioPlayback?: (audioPlaybackId: string) => void;
  onLongPress?: () => void;
  onPress?: () => void;
  onPrepareFile?: () => Promise<string | null>;
  profilePhotoHeaders?: Record<string, string>;
  senderName: string;
  senderProfilePhotoUrl: string | null;
  sourceUri: string;
  width: number;
}) {
  const transferLabel = getMediaTransferLabel(media);
  const isTransferActive = isMediaTransferActive(media);
  const transferProgress = Math.max(0, Math.min(media.transferProgress || 0, 1));

  if (media.kind === 'image') {
    return (
      <Pressable
        accessibilityLabel="Open media"
        accessibilityRole="imagebutton"
        disabled={!onPress}
        onPress={(event) => {
          event.stopPropagation();
          onPress?.();
        }}
        style={[
        styles.messageBubbleMediaFrame,
        {
          height,
          width
        }
      ]}>
        {sourceUri ? (
          <Image
            resizeMode="cover"
            source={{ uri: sourceUri }}
            style={styles.messageBubbleImage}
          />
        ) : (
          <View style={styles.messageBubbleMediaPlaceholder}>
            <Ionicons color="#94A3B8" name="image-outline" size={34} />
          </View>
        )}
        {transferLabel ? (
          <View style={styles.messageMediaProgressOverlay}>
            <View style={styles.messageMediaProgressCircle}>
              {isTransferActive ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Feather color="#FFFFFF" name={media.transferStatus === 'failed' ? 'alert-circle' : 'check'} size={17} />
              )}
              {isTransferActive && transferProgress > 0 ? (
                <Text style={styles.messageMediaProgressPercent}>
                  {Math.round(transferProgress * 100)}
                </Text>
              ) : null}
            </View>
            <Text style={styles.messageMediaProgressLabel}>{transferLabel}</Text>
          </View>
        ) : null}
      </Pressable>
      );
    }

  if (media.kind === 'audio') {
    const audioPlaybackId = `${messageId}:${media.mediaId || media.key || media.fileName}`;

    return (
      <AudioMessageAttachment
        activeAudioPlaybackId={activeAudioPlaybackId}
        audioPlaybackId={audioPlaybackId}
        isMine={isMine}
        media={media}
        onActivateAudioPlayback={onActivateAudioPlayback}
        onDeactivateAudioPlayback={onDeactivateAudioPlayback}
        onLongPress={onLongPress}
        onPrepareAudio={onPrepareFile}
        profilePhotoHeaders={profilePhotoHeaders}
        senderName={senderName}
        senderProfilePhotoUrl={senderProfilePhotoUrl}
      />
    );
  }

  return (
    <Pressable
      accessibilityLabel="Open media"
      accessibilityRole="button"
      delayLongPress={320}
      disabled={!onPress}
      onLongPress={(event) => {
        event.stopPropagation();
        onLongPress?.();
      }}
      onPress={(event) => {
        event.stopPropagation();
        onPress?.();
      }}
      style={[
      styles.messageAttachmentCard,
      isMine ? styles.messageAttachmentCardMine : styles.messageAttachmentCardTheirs
    ]}>
      <View style={styles.messageAttachmentIcon}>
        {isTransferActive ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <Feather
            color={colors.primary}
            name={media.kind === 'video' ? 'play-circle' : isAudioAttachment(media) ? 'music' : 'file-text'}
            size={22}
          />
        )}
      </View>
      <View style={styles.messageAttachmentText}>
        <Text numberOfLines={1} style={styles.messageAttachmentName}>
          {media.fileName || (media.kind === 'video' ? 'Video' : 'File')}
        </Text>
        <Text numberOfLines={1} style={styles.messageAttachmentMeta}>
          {transferLabel || formatAttachmentMeta(media)}
        </Text>
      </View>
    </Pressable>
  );
}

function MessageMediaAlbumPreview({
  activeAudioPlaybackId,
  isMine,
  mediaItems,
  messageId,
  onActivateAudioPlayback,
  onDeactivateAudioPlayback,
  onLongPress,
  onOpenMedia,
  onPrepareMedia,
  profilePhotoHeaders,
  senderName,
  senderProfilePhotoUrl,
  width
}: {
  activeAudioPlaybackId?: string | null;
  isMine: boolean;
  mediaItems: ChatMediaAttachment[];
  messageId: string;
  onActivateAudioPlayback?: (audioPlaybackId: string) => void;
  onDeactivateAudioPlayback?: (audioPlaybackId: string) => void;
  onLongPress?: () => void;
  onOpenMedia?: (index: number) => void;
  onPrepareMedia?: (index: number) => Promise<string | null>;
  profilePhotoHeaders?: Record<string, string>;
  senderName: string;
  senderProfilePhotoUrl: string | null;
  width: number;
}) {
  if (mediaItems.length <= 1) {
    const media = mediaItems[0];
    const imageAspectRatio = media?.width && media?.height
      ? media.width / media.height
      : 1;
    const height = Math.min(288, Math.max(148, width / Math.max(imageAspectRatio, 0.3)));

    return media ? (
      <MessageMediaPreview
        activeAudioPlaybackId={activeAudioPlaybackId}
        height={height}
        isMine={isMine}
        media={media}
        messageId={messageId}
        onActivateAudioPlayback={onActivateAudioPlayback}
        onDeactivateAudioPlayback={onDeactivateAudioPlayback}
        onLongPress={onLongPress}
        onPress={() => onOpenMedia?.(0)}
        onPrepareFile={() => onPrepareMedia?.(0) || Promise.resolve(getMediaLocalUri(media) || null)}
        profilePhotoHeaders={profilePhotoHeaders}
        senderName={senderName}
        senderProfilePhotoUrl={senderProfilePhotoUrl}
        sourceUri={media.kind === 'image' ? getMediaLocalUri(media) : ''}
        width={width}
      />
    ) : null;
  }

  const visibleMediaItems = mediaItems.slice(0, 4);
  const hiddenCount = Math.max(mediaItems.length - visibleMediaItems.length, 0);
  const gap = 3;
  const tileSize = Math.floor((width - gap) / 2);
  const albumHeight = tileSize * 2 + gap;
  const transferLabel = getMediaItemsTransferLabel(mediaItems);
  const transferProgress = getMediaItemsTransferProgress(mediaItems);
  const isTransferActive = transferLabel === 'Sending' || transferLabel === 'Downloading' || transferLabel === 'Queued';

  return (
    <View style={[
      styles.messageAlbumFrame,
      {
        height: albumHeight,
        width
      }
    ]}>
      {visibleMediaItems.map((media, index) => {
        const sourceUri = media.kind === 'image' ? getMediaLocalUri(media) : '';
        const isLastVisibleTile = index === visibleMediaItems.length - 1 && hiddenCount > 0;

        return (
          <Pressable
            accessibilityLabel={`Open media item ${index + 1}`}
            accessibilityRole="imagebutton"
            key={`${media.mediaId || media.localUri || media.fileName}_${index}`}
            onPress={(event) => {
              event.stopPropagation();
              onOpenMedia?.(index);
            }}
            style={[
              styles.messageAlbumTile,
              {
                height: tileSize,
                left: (index % 2) * (tileSize + gap),
                top: Math.floor(index / 2) * (tileSize + gap),
                width: tileSize
              }
            ]}
          >
            {sourceUri ? (
              <Image
                resizeMode="cover"
                source={{ uri: sourceUri }}
                style={styles.messageBubbleImage}
              />
            ) : (
              <View style={styles.messageBubbleMediaPlaceholder}>
                <Ionicons
                  color="#94A3B8"
                  name={media.kind === 'video' ? 'play-circle-outline' : 'image-outline'}
                  size={32}
                />
              </View>
            )}
            {media.kind === 'video' ? (
              <View style={styles.messageAlbumVideoBadge}>
                <Feather color="#FFFFFF" name="video" size={12} />
                <Text style={styles.messageAlbumVideoText}>{formatMediaDuration(media.durationMs)}</Text>
              </View>
            ) : null}
            {isLastVisibleTile ? (
              <View style={styles.messageAlbumMoreOverlay}>
                <Text style={styles.messageAlbumMoreText}>+{hiddenCount}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}

      {transferLabel ? (
        <View style={styles.messageMediaProgressOverlay}>
          <View style={styles.messageAlbumProgressPill}>
            {isTransferActive ? (
              <ActivityIndicator color="#475569" size="small" />
            ) : (
              <Feather color="#475569" name="download" size={17} />
            )}
            <View>
              <Text style={styles.messageAlbumProgressTitle}>{formatByteCount(getMediaItemsSize(mediaItems))}</Text>
              <Text style={styles.messageAlbumProgressSubtitle}>
                {transferLabel}{isTransferActive && transferProgress > 0 ? ` ${Math.round(transferProgress * 100)}%` : ''}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function MessageBubble({
  activeAudioPlaybackId,
  contactName,
  contactProfilePhotoUrl,
  currentUid,
  highlighted = false,
  isGroupChat = false,
  isSelectable = false,
  isSelected = false,
  message,
  onLayout,
  onLongPress,
  onOpenMedia,
  onPrepareAttachment,
  onActivateAudioPlayback,
  onDeactivateAudioPlayback,
  onReplyPreviewPress,
  onReply,
  onToggleSelect,
  profilePhotoHeaders,
  reactions = [],
  senderMember,
  starred
}: {
  activeAudioPlaybackId?: string | null;
  contactName?: string;
  contactProfilePhotoUrl?: string | null;
  currentUid?: string;
  highlighted?: boolean;
  isGroupChat?: boolean;
  isSelectable?: boolean;
  isSelected?: boolean;
  message: ChatMessage;
  onLayout?: (messageId: string, y: number) => void;
  onLongPress?: (message: ChatMessage) => void;
  onOpenMedia?: (message: ChatMessage, activeIndex: number) => void;
  onPrepareAttachment?: (message: ChatMessage, activeIndex: number) => Promise<string | null>;
  onActivateAudioPlayback?: (audioPlaybackId: string) => void;
  onDeactivateAudioPlayback?: (audioPlaybackId: string) => void;
  onReplyPreviewPress?: (messageId: string) => void;
  onReply?: (message: ChatMessage) => void;
  onToggleSelect?: (message: ChatMessage) => void;
  profilePhotoHeaders?: Record<string, string>;
  reactions?: ChatMessageReaction[];
  senderMember?: ChatGroupMember | null;
  starred?: boolean;
}) {
  const deliveryStatusLabel = message.isMine
    ? formatMessageDeliveryStatus(message.deliveryStatus)
    : '';
  const mediaItems = getMessageMediaItems(message);
  const hasMedia = mediaItems.length > 0;
  const imageWidth = 222;
  const hasRichBubbleContent = Boolean(message.replyTo || message.forwarded || hasMedia);
  const replyTargetMessageId = message.replyTo?.messageId || '';
  const reactionBadgeLabel = formatMessageReactionBadge(reactions);
  const reactionBadgeOpacity = useRef(new Animated.Value(reactionBadgeLabel ? 1 : 0)).current;
  const reactionBadgeScale = useRef(new Animated.Value(reactionBadgeLabel ? 1 : 0.82)).current;
  const swipeTranslateX = useRef(new Animated.Value(0)).current;
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gestureState) =>
      !isSelectable &&
      Boolean(onReply) &&
      gestureState.dx > 6 &&
      Math.abs(gestureState.dy) < 22,
    onMoveShouldSetPanResponderCapture: (_event, gestureState) =>
      !isSelectable &&
      Boolean(onReply) &&
      gestureState.dx > 6 &&
      Math.abs(gestureState.dy) < 22,
    onPanResponderGrant: () => {
      swipeTranslateX.stopAnimation();
    },
    onPanResponderMove: (_event, gestureState) => {
      const nextTranslate = Math.min(Math.max(gestureState.dx, 0), 72);

      swipeTranslateX.setValue(nextTranslate);
    },
    onPanResponderRelease: (_event, gestureState) => {
      const didSwipeToReply = gestureState.dx >= 48 && Math.abs(gestureState.dy) <= 42;

      Animated.spring(swipeTranslateX, {
        speed: 20,
        toValue: 0,
        useNativeDriver: true
      }).start();

      if (didSwipeToReply && onReply) {
        onReply(message);
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(swipeTranslateX, {
        speed: 20,
        toValue: 0,
        useNativeDriver: true
      }).start();
    },
    onPanResponderTerminationRequest: () => false,
    onStartShouldSetPanResponder: () => false
  }), [isSelectable, message, onReply, swipeTranslateX]);

  useEffect(() => {
    if (!reactionBadgeLabel) {
      reactionBadgeOpacity.setValue(0);
      reactionBadgeScale.setValue(0.82);
      return;
    }

    reactionBadgeOpacity.setValue(0);
    reactionBadgeScale.setValue(0.72);
    Animated.parallel([
      Animated.timing(reactionBadgeOpacity, {
        duration: 120,
        toValue: 1,
        useNativeDriver: true
      }),
      Animated.spring(reactionBadgeScale, {
        damping: 10,
        mass: 0.6,
        stiffness: 260,
        toValue: 1,
        useNativeDriver: true
      })
    ]).start();
  }, [reactionBadgeLabel, reactionBadgeOpacity, reactionBadgeScale]);

  return (
    <View style={[
      styles.messageBubbleSelectableRow,
      isSelectable && styles.messageBubbleSelectableRowActive,
      reactionBadgeLabel && styles.messageBubbleRowWithReaction
    ]}
    onLayout={(event) => onLayout?.(message.messageId, event.nativeEvent.layout.y)}>
      {isSelectable ? (
        <Pressable
          accessibilityLabel={isSelected ? 'Deselect message' : 'Select message'}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isSelected }}
          onPress={() => onToggleSelect?.(message)}
          style={({ pressed }) => [styles.forwardSelectCircleButton, pressed && styles.pressed]}
        >
          <View style={[
            styles.forwardSelectCircle,
            isSelected && styles.forwardSelectCircleSelected
          ]}>
            {isSelected ? (
              <Feather color="#FFFFFF" name="check" size={14} />
            ) : null}
          </View>
        </Pressable>
      ) : null}

      <View
        {...(!isSelectable ? panResponder.panHandlers : {})}
        style={[
          styles.messageBubbleRow,
          styles.messageBubbleSelectableContent,
          message.isMine ? styles.messageBubbleRowMine : styles.messageBubbleRowTheirs
        ]}>
        {!isSelectable ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.messageSwipeReplyCue,
              message.isMine ? styles.messageSwipeReplyCueMine : styles.messageSwipeReplyCueTheirs,
              {
                opacity: swipeTranslateX.interpolate({
                  inputRange: [0, 32, 56],
                  outputRange: [0, 0.4, 1]
                }),
                transform: [{
                  scale: swipeTranslateX.interpolate({
                    inputRange: [0, 56],
                    outputRange: [0.85, 1]
                  })
                }]
              }
            ]}
          >
            <Feather color={colors.primary} name="corner-up-left" size={18} />
          </Animated.View>
        ) : null}

        {isGroupChat && !message.isMine ? (
          <GroupMessageSenderAvatar
            member={senderMember || null}
            placement="left"
            profilePhotoHeaders={profilePhotoHeaders}
          />
        ) : null}
        <Animated.View
          style={[
            styles.messageBubbleMotionWrap,
            isGroupChat && styles.messageBubbleMotionWrapWithGroupAvatar,
            hasRichBubbleContent && styles.messageBubbleMotionWrapRich,
            { transform: [{ translateX: swipeTranslateX }] }
          ]}
        >
          <Pressable
            accessibilityRole="button"
            delayLongPress={320}
            onLongPress={!isSelectable && onLongPress ? () => onLongPress(message) : undefined}
            onPress={isSelectable
              ? () => onToggleSelect?.(message)
              : replyTargetMessageId && onReplyPreviewPress
                ? () => onReplyPreviewPress(replyTargetMessageId)
                : undefined}
            style={({ pressed }) => [
              styles.messageBubble,
              message.isMine ? styles.messageBubbleMine : styles.messageBubbleTheirs,
              hasMedia && styles.messageBubbleWithImage,
              highlighted && styles.messageBubbleHighlighted,
              pressed && (onLongPress || isSelectable || replyTargetMessageId) && styles.messageBubblePressed
            ]}
          >
            <View style={[
              styles.messageBubbleTail,
              message.isMine ? styles.messageBubbleTailMine : styles.messageBubbleTailTheirs
            ]} />
            {message.forwarded ? (
              <View style={styles.forwardedMessageLabelRow}>
                <Feather color="#64748B" name="corner-up-right" size={12} />
                <Text style={styles.forwardedMessageLabel}>Forwarded</Text>
              </View>
            ) : null}
            {message.replyTo ? (
              <BubbleReplyPreview
                contactName={contactName || ''}
                currentUid={currentUid || ''}
                isMine={message.isMine}
                onPress={() => onReplyPreviewPress?.(message.replyTo?.messageId || '')}
                replyTo={message.replyTo}
              />
            ) : null}
            {hasMedia ? (
              <MessageMediaAlbumPreview
                activeAudioPlaybackId={activeAudioPlaybackId}
                isMine={message.isMine}
                mediaItems={mediaItems}
                messageId={message.messageId}
                onActivateAudioPlayback={onActivateAudioPlayback}
                onDeactivateAudioPlayback={onDeactivateAudioPlayback}
                onLongPress={!isSelectable && onLongPress ? () => onLongPress(message) : undefined}
                onOpenMedia={(activeIndex) => onOpenMedia?.(message, activeIndex)}
                onPrepareMedia={(activeIndex) => onPrepareAttachment?.(message, activeIndex) || Promise.resolve(null)}
                profilePhotoHeaders={profilePhotoHeaders}
                senderName={message.isMine ? 'You' : contactName || 'Contact'}
                senderProfilePhotoUrl={message.isMine ? null : contactProfilePhotoUrl || null}
                width={imageWidth}
              />
            ) : null}
            {message.text.trim() ? (
              <Text style={[styles.messageBubbleText, hasMedia && styles.messageBubbleCaptionText]}>
                {message.text}
              </Text>
            ) : null}
            <View style={styles.messageBubbleMetaRow}>
              <Text style={styles.messageBubbleTime}>{formatMessageTime(message.sentAt)}</Text>
              {starred ? (
                <Feather color="#B45309" name="star" size={11} />
              ) : null}
              {deliveryStatusLabel ? (
                <Text style={[
                  styles.messageBubbleStatus,
                  message.deliveryStatus === 'queued' && styles.messageBubbleStatusQueued,
                  message.deliveryStatus === 'delivered' && styles.messageBubbleStatusDelivered,
                  message.deliveryStatus === 'read' && styles.messageBubbleStatusRead
                ]}>{deliveryStatusLabel}</Text>
              ) : null}
            </View>
            {reactionBadgeLabel ? (
              <Animated.View style={[
                styles.messageReactionBadge,
                message.isMine ? styles.messageReactionBadgeMine : styles.messageReactionBadgeTheirs,
                {
                  opacity: reactionBadgeOpacity,
                  transform: [{ scale: reactionBadgeScale }]
                }
              ]}>
                <Text style={styles.messageReactionText}>{reactionBadgeLabel}</Text>
              </Animated.View>
            ) : null}
          </Pressable>
        </Animated.View>
        {isGroupChat && message.isMine ? (
          <GroupMessageSenderAvatar
            member={senderMember || null}
            placement="right"
            profilePhotoHeaders={profilePhotoHeaders}
          />
        ) : null}
      </View>
    </View>
  );
}

function GroupMessageSenderAvatar({
  member,
  placement,
  profilePhotoHeaders
}: {
  member: ChatGroupMember | null;
  placement: 'left' | 'right';
  profilePhotoHeaders?: Record<string, string>;
}) {
  const initials = member?.initials || getInitials(member?.displayName || 'Member');
  const placementStyle = placement === 'left'
    ? styles.groupMessageAvatarLeft
    : styles.groupMessageAvatarRight;

  if (member?.profilePhotoUrl) {
    return (
      <Image
        accessibilityLabel={`${member.displayName} profile photo`}
        source={{
          headers: profilePhotoHeaders,
          uri: member.profilePhotoUrl
        }}
        style={[styles.groupMessageAvatarImage, placementStyle]}
      />
    );
  }

  return (
    <View style={[styles.groupMessageAvatarFallback, placementStyle]}>
      <Text numberOfLines={1} style={styles.groupMessageAvatarText}>{initials}</Text>
    </View>
  );
}

function MessageActionOverlay({
  contactName,
  currentUid,
  currentUserReactions,
  groupMembers,
  isGroupChat,
  message,
  onCopy,
  onDelete,
  onDismiss,
  onForward,
  onInfo,
  onReact,
  onReply,
  onStar,
  profilePhotoHeaders,
  reactions = [],
  starred
}: {
  contactName: string;
  currentUid: string;
  currentUserReactions: string[];
  groupMembers: ChatGroupMember[];
  isGroupChat: boolean;
  message: ChatMessage | null;
  onCopy: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onDismiss: () => void;
  onForward: (message: ChatMessage) => void;
  onInfo: (message: ChatMessage) => void;
  onReact: (message: ChatMessage, reaction: string) => void;
  onReply: (message: ChatMessage) => void;
  onStar: (message: ChatMessage) => void;
  profilePhotoHeaders?: Record<string, string>;
  reactions?: ChatMessageReaction[];
  starred: boolean;
}) {
  const overlayProgress = useRef(new Animated.Value(0)).current;
  const reactionButtonAnimations = useRef(
    [...MESSAGE_REACTIONS, 'more'].map(() => new Animated.Value(0))
  ).current;
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const groupMemberByUid = useMemo(() => new Map(groupMembers.map((member) => [member.uid, member])), [groupMembers]);

  useEffect(() => {
    if (!message) {
      return;
    }

    overlayProgress.setValue(0);
    reactionButtonAnimations.forEach((animation) => animation.setValue(0));

    Animated.parallel([
      Animated.timing(overlayProgress, {
        duration: 140,
        toValue: 1,
        useNativeDriver: true
      }),
      Animated.stagger(24, reactionButtonAnimations.map((animation) =>
        Animated.spring(animation, {
          damping: 11,
          mass: 0.55,
          stiffness: 320,
          toValue: 1,
          useNativeDriver: true
        })
      ))
    ]).start();
    setIsEmojiPickerOpen(false);
  }, [message?.messageId, overlayProgress, reactionButtonAnimations]);

  if (!message) {
    return null;
  }

  const contentScale = overlayProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1]
  });
  const contentTranslateY = overlayProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0]
  });
  const openEmojiPicker = () => {
    Keyboard.dismiss();
    setIsEmojiPickerOpen(true);
  };

  return (
    <Modal animationType="fade" transparent visible onRequestClose={onDismiss}>
      <View style={styles.messageActionOverlay}>
        <BlurView intensity={55} style={StyleSheet.absoluteFill} tint="light" />
        <Pressable
          accessibilityLabel="Close message actions"
          accessibilityRole="button"
          onPress={onDismiss}
          style={styles.messageActionDismiss}
        />

        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.messageActionContent,
            {
              opacity: overlayProgress,
              transform: [
                { translateY: contentTranslateY },
                { scale: contentScale }
              ]
            }
          ]}
        >
          <View style={[
            styles.messageActionStack,
            message.isMine ? styles.messageActionStackMine : styles.messageActionStackTheirs
          ]}>
            <View style={styles.messageReactionStrip}>
              <ScrollView
                bounces={false}
                contentContainerStyle={styles.messageReactionStripContent}
                horizontal
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}
                style={styles.messageReactionStripScroll}
              >
                {MESSAGE_REACTIONS.map((emoji, index) => {
                  const buttonProgress = reactionButtonAnimations[index];
                  const isActive = currentUserReactions.includes(emoji);

                  return (
                    <Animated.View
                      key={emoji}
                      style={{
                        opacity: buttonProgress,
                        transform: [
                          {
                            translateY: buttonProgress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [8, 0]
                            })
                          },
                          {
                            scale: buttonProgress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.45, isActive ? 1.14 : 1]
                            })
                          }
                        ]
                      }}
                    >
                      <Pressable
                        accessibilityLabel={`React ${emoji}`}
                        accessibilityRole="button"
                        onPress={() => onReact(message, emoji)}
                        style={({ pressed }) => [
                          styles.messageReactionButton,
                          isActive && styles.messageReactionButtonActive,
                          pressed && styles.messageReactionButtonPressed
                        ]}
                      >
                        <Text style={styles.messageReactionButtonText}>{emoji}</Text>
                      </Pressable>
                    </Animated.View>
                  );
                })}

                <Animated.View
                  style={{
                    opacity: reactionButtonAnimations[MESSAGE_REACTIONS.length],
                    transform: [
                      {
                        translateY: reactionButtonAnimations[MESSAGE_REACTIONS.length].interpolate({
                          inputRange: [0, 1],
                          outputRange: [8, 0]
                        })
                      },
                      {
                        scale: reactionButtonAnimations[MESSAGE_REACTIONS.length].interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.45, 1]
                        })
                      }
                    ]
                  }}
                >
                  <Pressable
                    accessibilityLabel="Open all reactions"
                    accessibilityRole="button"
                    onPress={openEmojiPicker}
                    style={({ pressed }) => [styles.messageReactionMoreButton, pressed && styles.pressed]}
                  >
                    <Feather color="#64748B" name="plus" size={20} />
                  </Pressable>
                </Animated.View>
              </ScrollView>
            </View>

            <View style={styles.messageActionBubbleWrap}>
              <MessageBubble
                contactName={contactName}
                currentUid={currentUid}
                isGroupChat={isGroupChat}
                message={message}
                profilePhotoHeaders={profilePhotoHeaders}
                reactions={reactions}
                senderMember={isGroupChat ? groupMemberByUid.get(message.senderUid) || null : null}
                starred={starred}
              />
            </View>

            <View style={styles.messageActionMenu}>
              <MessageActionRow icon="corner-up-left" label="Reply" onPress={() => onReply(message)} />
              <MessageActionRow icon="corner-up-right" label="Forward" onPress={() => onForward(message)} />
              <MessageActionRow icon="copy" label="Copy" onPress={() => onCopy(message)} />
              <MessageActionRow icon="info" label="Info" onPress={() => onInfo(message)} />
              <MessageActionRow icon="star" label={starred ? 'Unstar' : 'Star'} onPress={() => onStar(message)} />
              <MessageActionRow destructive icon="trash-2" label="Delete" onPress={() => onDelete(message)} />
              <View style={styles.messageActionSeparator} />
              <MessageActionRow icon="smile" label="More..." onPress={openEmojiPicker} />
            </View>
          </View>
        </Animated.View>

        {isEmojiPickerOpen ? (
          <EmojiPicker
            allowMultipleSelections={false}
            categoryPosition="bottom"
            defaultHeight="55%"
            emojiSize={28}
            enableRecentlyUsed
            enableSearchBar
            expandable
            onClose={() => setIsEmojiPickerOpen(false)}
            onEmojiSelected={(emoji: EmojiType) => {
              setIsEmojiPickerOpen(false);
              onReact(message, emoji.emoji);
            }}
            open={isEmojiPickerOpen}
            selectedEmojis={currentUserReactions}
            styles={{
              category: {
                container: styles.emojiKeyboardCategoryContainer,
                icon: styles.emojiKeyboardCategoryIcon
              },
              container: styles.emojiKeyboardContainer,
              emoji: {
                selected: styles.emojiKeyboardSelectedEmoji
              },
              header: styles.emojiKeyboardHeader,
              knob: styles.emojiKeyboardKnob,
              searchBar: {
                container: styles.emojiKeyboardSearchContainer,
                text: styles.emojiKeyboardSearchText
              }
            }}
            theme={{
              backdrop: 'rgba(15, 23, 42, 0.18)',
              category: {
                container: '#F1F5F9',
                containerActive: '#E2E8F0',
                icon: '#64748B',
                iconActive: colors.primary
              },
              container: '#FFFFFF',
              customButton: {
                background: '#F1F5F9',
                backgroundPressed: '#E2E8F0',
                icon: '#64748B',
                iconPressed: colors.primary
              },
              emoji: {
                selected: '#DDF6EF'
              },
              header: '#64748B',
              knob: '#A8B0BC',
              search: {
                background: '#F8FAFC',
                icon: '#64748B',
                placeholder: '#64748B',
                text: colors.ink
              },
              skinTonesContainer: '#F1F5F9'
            }}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function MessageActionRow({
  destructive = false,
  icon,
  label,
  onPress
}: {
  destructive?: boolean;
  icon: FeatherIconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.messageActionRow, pressed && styles.messageActionRowPressed]}
    >
      <Feather color={destructive ? '#E11D48' : '#475569'} name={icon} size={18} />
      <Text style={[
        styles.messageActionLabel,
        destructive && styles.messageActionLabelDestructive
      ]}>{label}</Text>
    </Pressable>
  );
}

function NativeOptionPickerModal({ picker }: { picker: NativeOptionPickerState | null }) {
  if (Platform.OS === 'ios' || !picker) {
    return null;
  }

  const handleCancel = () => picker.onSelect(null);

  return (
    <Modal
      animationType="fade"
      hardwareAccelerated
      onRequestClose={handleCancel}
      statusBarTranslucent
      transparent
      visible
    >
      <View style={styles.nativeOptionModalRoot}>
        <Pressable
          accessibilityLabel="Close options"
          accessibilityRole="button"
          onPress={handleCancel}
          style={styles.nativeOptionModalBackdrop}
        />
        <View accessibilityViewIsModal style={styles.nativeOptionModalPanel}>
          <View style={styles.nativeOptionModalHeader}>
            <Text style={styles.nativeOptionModalTitle}>{picker.title}</Text>
          </View>
          <FlatList
            data={picker.options}
            ItemSeparatorComponent={() => <View style={styles.nativeOptionSeparator} />}
            keyExtractor={(option) => option.id}
            renderItem={({ index, item }) => (
              <Pressable
                accessibilityRole="button"
                android_ripple={androidButtonRipple}
                onPress={() => picker.onSelect(index)}
                style={({ pressed }) => [
                  styles.nativeOptionRow,
                  pressed && styles.pressed
                ]}
              >
                <Text numberOfLines={2} style={styles.nativeOptionRowText}>{item.label}</Text>
              </Pressable>
            )}
            showsVerticalScrollIndicator
            style={styles.nativeOptionList}
          />
          <Pressable
            accessibilityRole="button"
            android_ripple={androidButtonRipple}
            onPress={handleCancel}
            style={({ pressed }) => [
              styles.nativeOptionCancelButton,
              pressed && styles.pressed
            ]}
          >
            <Text style={styles.nativeOptionCancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function ForwardRecipientModal({
  contacts,
  isForwarding,
  isOpen,
  onCancel,
  onConfirm,
  onToggleRecipient,
  profilePhotoHeaders,
  selectedCount,
  selectedRecipientIds
}: {
  contacts: ChatContact[];
  isForwarding: boolean;
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onToggleRecipient: (contactId: string) => void;
  profilePhotoHeaders?: Record<string, string>;
  selectedCount: number;
  selectedRecipientIds: Record<string, boolean>;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <Modal animationType="slide" transparent visible onRequestClose={onCancel}>
      <View style={styles.forwardRecipientOverlay}>
        <Pressable
          accessibilityLabel="Close forward picker"
          accessibilityRole="button"
          onPress={onCancel}
          style={styles.forwardRecipientBackdrop}
        />

        <View style={styles.forwardRecipientSheet}>
          <View style={styles.forwardRecipientHeader}>
            <Text style={styles.forwardRecipientTitle}>Forward to...</Text>
            <Pressable
              accessibilityLabel="Close"
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [styles.forwardRecipientCloseButton, pressed && styles.pressed]}
            >
              <Feather color="#334155" name="x" size={24} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.forwardRecipientList}
          >
            {contacts.map((contact) => {
              const isSelected = Boolean(selectedRecipientIds[contact.contactId]);

              return (
                <Pressable
                  accessibilityLabel={`Forward to ${contact.displayName}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected, disabled: !contact.hasActiveDevice }}
                  disabled={!contact.hasActiveDevice || isForwarding}
                  key={contact.contactId}
                  onPress={() => onToggleRecipient(contact.contactId)}
                  style={({ pressed }) => [
                    styles.forwardRecipientRow,
                    !contact.hasActiveDevice && styles.forwardRecipientRowDisabled,
                    pressed && contact.hasActiveDevice && styles.pressed
                  ]}
                >
                  <ProfileAvatar
                    headers={profilePhotoHeaders}
                    name={contact.displayName}
                    size={42}
                    uri={contact.profilePhotoUrl}
                  />

                  <View style={styles.forwardRecipientText}>
                    <Text numberOfLines={1} style={styles.forwardRecipientName}>{contact.displayName}</Text>
                    <Text numberOfLines={1} style={styles.forwardRecipientSubtitle}>
                      {contact.hasActiveDevice ? contact.preview || 'Available' : 'Secure device not ready'}
                    </Text>
                  </View>

                  <View style={[
                    styles.forwardRecipientCheck,
                    isSelected && styles.forwardRecipientCheckSelected
                  ]}>
                    {isSelected ? (
                      <Feather color="#FFFFFF" name="check" size={15} />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.forwardRecipientFooter}>
            <Text style={styles.forwardRecipientCount}>
              {selectedCount ? `${selectedCount} selected` : 'Select up to 5 chats'}
            </Text>
            <Pressable
              accessibilityLabel="Forward messages"
              accessibilityRole="button"
              disabled={!selectedCount || isForwarding}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.forwardRecipientSendButton,
                (!selectedCount || isForwarding) && styles.disabled,
                pressed && Boolean(selectedCount) && !isForwarding && styles.pressed
              ]}
            >
              {isForwarding ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Feather color="#FFFFFF" name="corner-up-right" size={17} />
                  <Text style={styles.forwardRecipientSendText}>Forward</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function YouHeaderActions() {
  return (
    <View style={styles.topActions}>
      <Pressable
        android_ripple={androidIconRipple}
        accessibilityLabel="Search profile"
        accessibilityRole="button"
        style={({ pressed }) => [styles.youHeaderButton, pressed && styles.pressed]}
      >
        <SearchIcon />
      </Pressable>

      <Pressable
        android_ripple={androidIconRipple}
        accessibilityLabel="Open profile code"
        accessibilityRole="button"
        style={({ pressed }) => [styles.youHeaderButton, pressed && styles.pressed]}
      >
        <QrIcon />
      </Pressable>
    </View>
  );
}

function DirectoryHeader({
  filter,
  onBack,
  onFilter
}: {
  filter: DirectoryFilter;
  onBack: () => void;
  onFilter: () => void;
}) {
  return (
    <View style={styles.topActions}>
      <Pressable
        android_ripple={androidIconRipple}
        accessibilityLabel="Back to settings"
        accessibilityRole="button"
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <Text style={styles.backButtonText}>‹</Text>
      </Pressable>

      <Pressable
        android_ripple={androidIconRipple}
        accessibilityLabel={`Show ${filter === 'Departments' ? 'roles' : 'departments'}`}
        accessibilityRole="button"
        onPress={onFilter}
        style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
      >
        <FilterIcon />
      </Pressable>
    </View>
  );
}

function BackHeader({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.topActions}>
      <Pressable
        android_ripple={androidIconRipple}
        accessibilityLabel="Back to settings"
        accessibilityRole="button"
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <Text style={styles.backButtonText}>‹</Text>
      </Pressable>
    </View>
  );
}

function ChatSearchBar({
  onChangeText,
  placeholder,
  value
}: {
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.chatSearchBox}>
      <Feather color="#8B95A5" name="search" size={18} />
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8B95A5"
        style={styles.chatSearchInput}
        value={value}
      />
    </View>
  );
}

function ChatsTab({
  chats,
  isLoading,
  onOpenChat,
  onSearchChange,
  profilePhotoHeaders,
  search
}: {
  chats: ChatItem[];
  isLoading: boolean;
  onOpenChat: (chat: ChatItem) => void;
  onSearchChange: (value: string) => void;
  profilePhotoHeaders?: Record<string, string>;
  search: string;
}) {
  return (
    <View>
      <ChatSearchBar
        onChangeText={onSearchChange}
        placeholder="Search"
        value={search}
      />

      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {!isLoading && !chats.length ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{search.trim() ? 'No chats found' : 'No chats yet'}</Text>
        </View>
      ) : null}

      {chats.map((chat) => (
        <ChatRow
          chat={chat}
          key={chat.id}
          onOpen={() => onOpenChat(chat)}
          profilePhotoHeaders={profilePhotoHeaders}
        />
      ))}
    </View>
  );
}

function NewChatModal({
  contacts,
  isOpen,
  onCancel,
  onOpenAddMembers,
  onOpenContact,
  onSearchChange,
  profilePhotoHeaders,
  search
}: {
  contacts: ChatContact[];
  isOpen: boolean;
  onCancel: () => void;
  onOpenAddMembers: () => void;
  onOpenContact: (contact: ChatContact) => void;
  onSearchChange: (value: string) => void;
  profilePhotoHeaders?: Record<string, string>;
  search: string;
}) {
  const filteredContacts = filterChatContacts(contacts, search);
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);

  return (
    <Modal
      allowSwipeDismissal={Platform.OS === 'ios'}
      animationType="slide"
      onRequestClose={onCancel}
      presentationStyle={getNativeFullHeightModalPresentationStyle()}
      transparent={false}
      visible={isOpen}
    >
      <View style={[styles.newChatModalScreen, { paddingTop: modalTopPadding }]}>
        <View style={styles.newChatHeader}>
          <Pressable
            accessibilityLabel="Close new chat"
            accessibilityRole="button"
            onPress={onCancel}
            style={({ pressed }) => [styles.newChatHeaderIconButton, pressed && styles.pressed]}
          >
            <Feather color={colors.ink} name="x" size={24} />
          </Pressable>
          <Text style={styles.newChatHeaderTitle}>New Chat</Text>
          <View style={styles.newChatHeaderSpacer} />
        </View>

        <ChatSearchBar
          onChangeText={onSearchChange}
          placeholder="Search name"
          value={search}
        />

        <Pressable
          accessibilityLabel="Create new group"
          accessibilityRole="button"
          onPress={onOpenAddMembers}
          style={({ pressed }) => [styles.newGroupEntry, pressed && styles.pressed]}
        >
          <View style={styles.newGroupIcon}>
            <Feather color="#FFFFFF" name="users" size={20} />
          </View>
          <Text style={styles.newGroupText}>New Group</Text>
        </Pressable>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.newChatContactList}
        >
          {filteredContacts.map((contact) => (
            <ChatContactPickRow
              contact={contact}
              key={contact.contactId}
              onPress={() => onOpenContact(contact)}
              profilePhotoHeaders={profilePhotoHeaders}
            />
          ))}

          {!filteredContacts.length ? (
            <Text style={styles.batchEmpty}>{search.trim() ? 'No contacts found' : 'No organization contacts yet'}</Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function AddMembersModal({
  contacts,
  isOpen,
  onBack,
  onNext,
  onSearchChange,
  onToggleMember,
  profilePhotoHeaders,
  search,
  selectedCount,
  selectedMemberIds
}: {
  contacts: ChatContact[];
  isOpen: boolean;
  onBack: () => void;
  onNext: () => void;
  onSearchChange: (value: string) => void;
  onToggleMember: (contactId: string) => void;
  profilePhotoHeaders?: Record<string, string>;
  search: string;
  selectedCount: number;
  selectedMemberIds: Record<string, boolean>;
}) {
  const filteredContacts = filterChatContacts(contacts, search);
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);

  return (
    <Modal
      allowSwipeDismissal={Platform.OS === 'ios'}
      animationType="slide"
      onRequestClose={onBack}
      presentationStyle={getNativeFullHeightModalPresentationStyle()}
      transparent={false}
      visible={isOpen}
    >
      <View style={[styles.newChatModalScreen, { paddingTop: modalTopPadding }]}>
        <View style={styles.newChatHeader}>
          <Pressable
            accessibilityLabel="Back to new chat"
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [styles.newChatHeaderIconButton, pressed && styles.pressed]}
          >
            <Feather color={colors.ink} name="x" size={24} />
          </Pressable>
          <View style={styles.newChatCenteredTitleWrap}>
            <Text style={styles.newChatHeaderTitle}>Add members</Text>
            {selectedCount > 0 ? (
              <Text style={styles.newChatHeaderSubtitle}>{selectedCount} selected</Text>
            ) : null}
          </View>
          <Pressable
            accessibilityLabel="Next"
            accessibilityRole="button"
            disabled={!selectedCount}
            onPress={onNext}
            style={({ pressed }) => [
              styles.newChatNextButton,
              pressed && selectedCount > 0 && styles.pressed,
              !selectedCount && styles.disabled
            ]}
          >
            <Text style={styles.newChatNextText}>Next</Text>
          </Pressable>
        </View>

        <ChatSearchBar
          onChangeText={onSearchChange}
          placeholder="Search members"
          value={search}
        />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.newChatContactList}
        >
          {filteredContacts.map((contact) => (
            <ChatMemberSelectRow
              contact={contact}
              isSelected={Boolean(selectedMemberIds[contact.contactId])}
              key={contact.contactId}
              onToggle={() => onToggleMember(contact.contactId)}
              profilePhotoHeaders={profilePhotoHeaders}
            />
          ))}

          {!filteredContacts.length ? (
            <Text style={styles.batchEmpty}>{search.trim() ? 'No members found' : 'No organization members yet'}</Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function GroupDetailsModal({
  groupName,
  groupPhotoUri,
  isOpen,
  members,
  onBack,
  onChangeGroupName,
  onCreate,
  onOpenPermissions,
  onPickPhoto,
  onRemoveMember,
  permissionMode,
  profilePhotoHeaders
}: {
  groupName: string;
  groupPhotoUri: string | null;
  isOpen: boolean;
  members: ChatContact[];
  onBack: () => void;
  onChangeGroupName: (value: string) => void;
  onCreate: () => void;
  onOpenPermissions: () => void;
  onPickPhoto: () => void;
  onRemoveMember: (contactId: string) => void;
  permissionMode: 'ADMINS' | 'ALL_MEMBERS';
  profilePhotoHeaders?: Record<string, string>;
}) {
  const canCreate = groupName.trim().length > 0 && members.length > 0;
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);

  return (
    <Modal
      allowSwipeDismissal={Platform.OS === 'ios'}
      animationType="slide"
      onRequestClose={onBack}
      presentationStyle={getNativeFullHeightModalPresentationStyle()}
      transparent={false}
      visible={isOpen}
    >
      <View style={[styles.newChatModalScreen, { paddingTop: modalTopPadding }]}>
        <View style={styles.newChatHeader}>
          <Pressable
            accessibilityLabel="Back to add members"
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [styles.newChatHeaderIconButton, pressed && styles.pressed]}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
          <Text style={styles.newChatHeaderTitle}>New Group</Text>
          <Pressable
            accessibilityLabel="Create group"
            accessibilityRole="button"
            disabled={!canCreate}
            onPress={onCreate}
            style={({ pressed }) => [
              styles.newChatNextButton,
              pressed && canCreate && styles.pressed,
              !canCreate && styles.disabled
            ]}
          >
            <Text style={styles.newChatNextText}>Create</Text>
          </Pressable>
        </View>

        <View style={styles.groupNameRow}>
          <Pressable
            accessibilityLabel="Add group photo"
            accessibilityRole="button"
            onPress={onPickPhoto}
            style={({ pressed }) => [styles.groupPhotoButton, pressed && styles.pressed]}
          >
            {groupPhotoUri ? (
              <Image resizeMode="cover" source={{ uri: groupPhotoUri }} style={styles.groupPhotoImage} />
            ) : (
              <Ionicons color={colors.primary} name="camera" size={23} />
            )}
          </Pressable>
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            onChangeText={onChangeGroupName}
            placeholder="Group name"
            placeholderTextColor="#8B95A5"
            style={styles.groupNameInput}
            value={groupName}
          />
        </View>

        <Pressable
          accessibilityLabel="Open group permissions"
          accessibilityRole="button"
          onPress={onOpenPermissions}
          style={({ pressed }) => [styles.groupPermissionRow, pressed && styles.pressed]}
        >
          <View>
            <Text style={styles.groupPermissionTitle}>Group permission</Text>
            <Text style={styles.groupPermissionSubtitle}>
              {permissionMode === 'ALL_MEMBERS'
                ? 'All members can participate'
                : 'Only admins can manage key actions'}
            </Text>
          </View>
          <Feather color="#64748B" name="chevron-right" size={20} />
        </Pressable>

        <Text style={styles.groupMembersTitle}>Members</Text>
        <ScrollView
          contentContainerStyle={styles.groupMembersContent}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {members.map((member) => (
            <View key={member.contactId} style={styles.groupMemberChip}>
              <View style={styles.groupMemberAvatarWrap}>
                <ProfileAvatar
                  headers={profilePhotoHeaders}
                  name={member.displayName}
                  size={54}
                  uri={member.profilePhotoUrl}
                />
                <Pressable
                  accessibilityLabel={`Remove ${member.displayName}`}
                  accessibilityRole="button"
                  onPress={() => onRemoveMember(member.contactId)}
                  style={({ pressed }) => [styles.groupMemberRemoveButton, pressed && styles.pressed]}
                >
                  <Feather color="#FFFFFF" name="x" size={13} />
                </Pressable>
              </View>
              <Text numberOfLines={2} style={styles.groupMemberName}>{member.displayName}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

function GroupPermissionsModal({
  isOpen,
  onBack,
  onSelectPermission,
  permissionMode
}: {
  isOpen: boolean;
  onBack: () => void;
  onSelectPermission: (value: 'ADMINS' | 'ALL_MEMBERS') => void;
  permissionMode: 'ADMINS' | 'ALL_MEMBERS';
}) {
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);

  return (
    <Modal
      allowSwipeDismissal={Platform.OS === 'ios'}
      animationType="slide"
      onRequestClose={onBack}
      presentationStyle={getNativeFullHeightModalPresentationStyle()}
      transparent={false}
      visible={isOpen}
    >
      <View style={[styles.newChatModalScreen, { paddingTop: modalTopPadding }]}>
        <View style={styles.newChatHeader}>
          <Pressable
            accessibilityLabel="Back to group details"
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [styles.newChatHeaderIconButton, pressed && styles.pressed]}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
          <Text style={styles.newChatHeaderTitle}>Group permissions</Text>
          <View style={styles.newChatHeaderSpacer} />
        </View>

        <GroupPermissionOption
          description="Members can send messages and participate normally."
          isSelected={permissionMode === 'ALL_MEMBERS'}
          onPress={() => onSelectPermission('ALL_MEMBERS')}
          title="All members"
        />
        <GroupPermissionOption
          description="Admins control key group actions. Member messaging rules can be expanded later."
          isSelected={permissionMode === 'ADMINS'}
          onPress={() => onSelectPermission('ADMINS')}
          title="Admins only"
        />
      </View>
    </Modal>
  );
}

function GroupCallOptionsModal({
  groupName,
  isOpen,
  onClose,
  onSelect,
  onlineCount
}: {
  groupName: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (option: GroupCallOption) => void;
  onlineCount: number;
}) {
  const options: Array<{ icon: keyof typeof Feather.glyphMap; id: GroupCallOption; label: string }> = [
    { icon: 'phone', id: 'voice', label: 'Voice call' },
    { icon: 'video', id: 'video', label: 'Video call' },
    { icon: 'check-circle', id: 'selectPeople', label: 'Select people' },
    { icon: 'link', id: 'sendLink', label: 'Send call link' },
    { icon: 'calendar', id: 'schedule', label: 'Schedule call' }
  ];

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={isOpen}
    >
      <View style={styles.groupCallOptionsRoot}>
        <Pressable
          accessibilityLabel="Close group call options"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.groupCallOptionsBackdrop}
        />
        <View accessibilityViewIsModal style={styles.groupCallOptionsPanel}>
          <View style={styles.groupCallOptionsHeader}>
            <Text numberOfLines={1} style={styles.groupCallOptionsTitle}>{groupName}</Text>
            <Text style={styles.groupCallOptionsSubtitle}>{formatGroupOnlineCount(onlineCount)}</Text>
          </View>
          {options.map((option) => (
            <Pressable
              accessibilityRole="button"
              android_ripple={androidButtonRipple}
              key={option.id}
              onPress={() => onSelect(option.id)}
              style={({ pressed }) => [styles.groupCallOptionRow, pressed && styles.pressed]}
            >
              <Feather color="#334155" name={option.icon} size={20} />
              <Text style={styles.groupCallOptionText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

function GroupCallPeopleModal({
  contacts,
  isOpen,
  mode,
  onCancel,
  onConfirm,
  onSearchChange,
  onToggleMember,
  onlineCount,
  profilePhotoHeaders,
  search,
  selectedCount,
  selectedMemberIds
}: {
  contacts: ChatContact[];
  isOpen: boolean;
  mode: GroupCallMode;
  onCancel: () => void;
  onConfirm: () => void;
  onSearchChange: (value: string) => void;
  onToggleMember: (contactId: string) => void;
  onlineCount: number;
  profilePhotoHeaders?: Record<string, string>;
  search: string;
  selectedCount: number;
  selectedMemberIds: Record<string, boolean>;
}) {
  const filteredContacts = filterChatContacts(contacts, search);
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);
  const actionLabel = mode === 'select' ? 'Done' : 'Call';

  return (
    <Modal
      allowSwipeDismissal={Platform.OS === 'ios'}
      animationType="slide"
      onRequestClose={onCancel}
      presentationStyle={getNativeFullHeightModalPresentationStyle()}
      transparent={false}
      visible={isOpen}
    >
      <View style={[styles.newChatModalScreen, { paddingTop: modalTopPadding }]}>
        <View style={styles.newChatHeader}>
          <Pressable
            accessibilityLabel="Close select people"
            accessibilityRole="button"
            onPress={onCancel}
            style={({ pressed }) => [styles.newChatHeaderIconButton, pressed && styles.pressed]}
          >
            <Feather color={colors.ink} name="x" size={24} />
          </Pressable>
          <View style={styles.newChatCenteredTitleWrap}>
            <Text style={styles.newChatHeaderTitle}>{getGroupCallPeopleTitle(mode)}</Text>
            <Text style={styles.newChatHeaderSubtitle}>
              {selectedCount > 0 ? `${selectedCount} selected` : formatGroupOnlineCount(onlineCount)}
            </Text>
          </View>
          <Pressable
            accessibilityLabel={actionLabel}
            accessibilityRole="button"
            disabled={!selectedCount}
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.newChatNextButton,
              pressed && selectedCount > 0 && styles.pressed,
              !selectedCount && styles.disabled
            ]}
          >
            <Text style={styles.newChatNextText}>{actionLabel}</Text>
          </Pressable>
        </View>

        <ChatSearchBar
          onChangeText={onSearchChange}
          placeholder="Search people"
          value={search}
        />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.newChatContactList}
        >
          {filteredContacts.map((contact) => (
            <ChatMemberSelectRow
              contact={contact}
              isSelected={Boolean(selectedMemberIds[contact.contactId])}
              key={contact.contactId}
              onToggle={() => onToggleMember(contact.contactId)}
              profilePhotoHeaders={profilePhotoHeaders}
            />
          ))}

          {!filteredContacts.length ? (
            <Text style={styles.batchEmpty}>{search.trim() ? 'No people found' : 'No group members available'}</Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function GroupSwitcherModal({
  companyName,
  groups,
  isLoading,
  isOpen,
  onAddGroup,
  onClose,
  onOpenGroup,
  selectedGroupId
}: {
  companyName: string;
  groups: TenantGroup[];
  isLoading: boolean;
  isOpen: boolean;
  onAddGroup: () => void;
  onClose: () => void;
  onOpenGroup: (group: TenantGroup) => void;
  selectedGroupId: string | null;
}) {
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);
  const visibleGroups = groups.filter((group) => !group.systemManaged || !group.isDepartmentDefault);

  return (
    <Modal
      allowSwipeDismissal={Platform.OS === 'ios'}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle={getNativeFullHeightModalPresentationStyle()}
      transparent={false}
      visible={isOpen}
    >
      <View style={[styles.newChatModalScreen, { paddingTop: modalTopPadding }]}>
        <View style={styles.newChatHeader}>
          <View style={styles.newChatHeaderSpacer} />
          <Text numberOfLines={1} style={styles.newChatHeaderTitle}>{companyName}</Text>
          <Pressable
            accessibilityLabel="Close groups"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.newChatHeaderIconButton, pressed && styles.pressed]}
          >
            <Feather color={colors.ink} name="x" size={24} />
          </Pressable>
        </View>

        <Text style={styles.groupSwitcherSectionTitle}>Groups you're in</Text>

        {isLoading && !visibleGroups.length ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.groupSwitcherList}
          >
            {visibleGroups.map((group) => (
              <Pressable
                accessibilityLabel={`Open ${group.name}`}
                accessibilityRole="button"
                key={group.groupId}
                onPress={() => onOpenGroup(group)}
                style={({ pressed }) => [
                  styles.groupSwitcherRow,
                  selectedGroupId === group.groupId && styles.groupSwitcherRowActive,
                  pressed && styles.pressed
                ]}
              >
                <View style={styles.groupIcon}>
                  <Ionicons color={colors.primary} name="people" size={21} />
                </View>
                <View style={styles.chatText}>
                  <Text numberOfLines={1} style={styles.chatTitle}>{group.name}</Text>
                  <Text numberOfLines={1} style={styles.chatPreview}>{getGroupSubtitle(group)}</Text>
                </View>
                <Text numberOfLines={1} style={styles.groupMeta}>
                  {group.memberCount === 1 ? '1 member' : `${group.memberCount} members`}
                </Text>
              </Pressable>
            ))}

            {!visibleGroups.length ? (
              <Text style={styles.batchEmpty}>No groups yet</Text>
            ) : null}
          </ScrollView>
        )}

        <Pressable
          accessibilityLabel="Add group"
          accessibilityRole="button"
          android_ripple={androidButtonRipple}
          onPress={onAddGroup}
          style={({ pressed }) => [styles.groupSwitcherAddButton, pressed && styles.pressed]}
        >
          <Feather color="#FFFFFF" name="plus" size={19} />
          <Text style={styles.groupSwitcherAddText}>Add group</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function GroupPermissionOption({
  description,
  isSelected,
  onPress,
  title
}: {
  description: string;
  isSelected: boolean;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      onPress={onPress}
      style={({ pressed }) => [styles.groupPermissionOption, pressed && styles.pressed]}
    >
      <View style={[styles.memberSelectCheck, isSelected && styles.memberSelectCheckActive]}>
        {isSelected ? <Feather color="#FFFFFF" name="check" size={14} /> : null}
      </View>
      <View style={styles.chatText}>
        <Text style={styles.groupPermissionTitle}>{title}</Text>
        <Text style={styles.groupPermissionSubtitle}>{description}</Text>
      </View>
    </Pressable>
  );
}

function ChatContactPickRow({
  contact,
  onPress,
  profilePhotoHeaders
}: {
  contact: ChatContact;
  onPress: () => void;
  profilePhotoHeaders?: Record<string, string>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.newChatContactRow, pressed && styles.pressed]}
    >
      <ProfileAvatar
        headers={profilePhotoHeaders}
        name={contact.displayName}
        size={48}
        uri={contact.profilePhotoUrl}
      />
      <View style={styles.chatText}>
        <Text numberOfLines={1} style={styles.chatTitle}>{contact.displayName}</Text>
        <Text numberOfLines={1} style={styles.chatPreview}>{contact.roleName}</Text>
      </View>
    </Pressable>
  );
}

function ChatMemberSelectRow({
  contact,
  isSelected,
  onToggle,
  profilePhotoHeaders
}: {
  contact: ChatContact;
  isSelected: boolean;
  onToggle: () => void;
  profilePhotoHeaders?: Record<string, string>;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      onPress={onToggle}
      style={({ pressed }) => [styles.newChatContactRow, pressed && styles.pressed]}
    >
      <ProfileAvatar
        headers={profilePhotoHeaders}
        name={contact.displayName}
        size={48}
        uri={contact.profilePhotoUrl}
      />
      <View style={styles.chatText}>
        <Text numberOfLines={1} style={styles.chatTitle}>{contact.displayName}</Text>
        <Text numberOfLines={1} style={styles.chatPreview}>{contact.roleName}</Text>
      </View>
      <View style={[styles.memberSelectCheck, isSelected && styles.memberSelectCheckActive]}>
        {isSelected ? <Feather color="#FFFFFF" name="check" size={14} /> : null}
      </View>
    </Pressable>
  );
}

function EmployeesTab({
  canManageUsers,
  employees,
  inviteDraft,
  isLoading,
  isUpdatingLifecycle,
  isPickingContact,
  isSavingInvite,
  onAddContact,
  onCancelDraft,
  onSelectEmployee,
  onSendDraft,
  profilePhotoHeaders
}: {
  canManageUsers: boolean;
  employees: EmployeeListItem[];
  inviteDraft: InviteDraft | null;
  isLoading: boolean;
  isUpdatingLifecycle: boolean;
  isPickingContact: boolean;
  isSavingInvite: boolean;
  onAddContact: () => void;
  onCancelDraft: () => void;
  onSelectEmployee: (employee: EmployeeListItem) => void;
  onSendDraft: () => void;
  profilePhotoHeaders?: Record<string, string>;
}) {
  return (
    <View>
      {inviteDraft ? (
        <InviteDraftPanel
          draft={inviteDraft}
          isPickingContact={isPickingContact}
          isSavingInvite={isSavingInvite}
          onAddContact={onAddContact}
          onCancel={onCancelDraft}
          onSend={onSendDraft}
        />
      ) : null}

      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {!isLoading && !employees.length ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No employees yet</Text>
        </View>
      ) : null}

      {employees.map((employee) => (
        <EmployeeRow
          canManageUsers={canManageUsers}
          employee={employee}
          isUpdatingLifecycle={isUpdatingLifecycle}
          key={employee.id}
          onSelect={() => onSelectEmployee(employee)}
          profilePhotoHeaders={profilePhotoHeaders}
        />
      ))}
    </View>
  );
}

function InviteDraftPanel({
  draft,
  isPickingContact,
  isSavingInvite,
  onAddContact,
  onCancel,
  onSend
}: {
  draft: InviteDraft;
  isPickingContact: boolean;
  isSavingInvite: boolean;
  onAddContact: () => void;
  onCancel: () => void;
  onSend: () => void;
}) {
  const contactCount = draft.contacts.length;
  const actionDisabled = isPickingContact || isSavingInvite;
  const isBatchMode = draft.mode === 'batch';

  return (
    <View style={styles.inviteDraft}>
      <View style={styles.inviteDraftHeader}>
        <View style={styles.chatText}>
          <Text style={styles.chatTitle}>
            {isBatchMode
              ? contactCount === 1
                ? 'Batch import - 1 selected'
                : `Batch import - ${contactCount} selected`
              : 'Ready to invite'}
          </Text>
          <Text style={styles.chatPreview}>
            {draft.department.name} - {draft.role.name}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={actionDisabled}
          onPress={onCancel}
          style={({ pressed }) => [
            styles.textOnlyButton,
            pressed && !actionDisabled && styles.pressed,
            actionDisabled && styles.disabled
          ]}
        >
          <Text style={styles.textOnlyButtonText}>Cancel</Text>
        </Pressable>
      </View>

      {draft.contacts.map((contact) => (
        <InviteDraftContactRow contact={contact} key={contact.phoneNumber} />
      ))}

      <View style={styles.inviteDraftActions}>
        {isBatchMode ? (
          <Pressable
            accessibilityRole="button"
            disabled={actionDisabled}
            onPress={onAddContact}
            style={({ pressed }) => [
              styles.secondaryActionButton,
              pressed && !actionDisabled && styles.pressed,
              actionDisabled && styles.disabled
            ]}
          >
            <Text style={styles.secondaryActionButtonText}>
              {isPickingContact ? 'Opening contacts' : 'Add another contact'}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={actionDisabled || contactCount === 0}
          onPress={onSend}
          style={({ pressed }) => [
            styles.primaryActionButton,
            !isBatchMode && styles.singleInviteActionButton,
            pressed && !actionDisabled && contactCount > 0 && styles.pressed,
            (actionDisabled || contactCount === 0) && styles.disabled
          ]}
        >
          <Text style={styles.primaryActionButtonText}>
            {isSavingInvite ? 'Sending' : contactCount === 1 ? 'Send invite' : 'Send invites'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function InviteDraftContactRow({ contact }: { contact: InviteContactDraft }) {
  const name = contact.displayName || maskLocalPhoneNumber(contact.phoneNumber);

  return (
    <View style={styles.inviteDraftContactRow}>
      <View style={[styles.avatar, styles.inviteDraftAvatar]}>
        <Text style={styles.avatarText}>{getInitials(name)}</Text>
      </View>
      <View style={styles.chatText}>
        <Text style={styles.chatTitle}>{name}</Text>
        <Text style={styles.chatPreview}>{maskLocalPhoneNumber(contact.phoneNumber)}</Text>
      </View>
    </View>
  );
}

function BatchContactModal({
  candidates,
  isLoading,
  onCancel,
  onConfirm,
  onSearchChange,
  onToggleContact,
  search,
  selectedPhoneNumbers,
  visible
}: {
  candidates: BatchContactCandidate[];
  isLoading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onSearchChange: (value: string) => void;
  onToggleContact: (phoneNumber: string) => void;
  search: string;
  selectedPhoneNumbers: string[];
  visible: boolean;
}) {
  const selectedPhoneNumberSet = new Set(selectedPhoneNumbers);
  const query = search.trim().toLowerCase();
  const visibleCandidates = query
    ? candidates.filter((candidate) => (
        candidate.displayName.toLowerCase().includes(query) ||
        candidate.subtitle.toLowerCase().includes(query)
      ))
    : candidates;

  return (
    <Modal
      animationType="slide"
      onRequestClose={onCancel}
      presentationStyle="fullScreen"
      transparent={false}
      visible={visible}
    >
      <View style={styles.batchModalScreen}>
        <View style={styles.batchModalHeader}>
          <Pressable
            accessibilityLabel="Close contacts"
            accessibilityRole="button"
            disabled={isLoading}
            onPress={onCancel}
            style={({ pressed }) => [
              styles.backButton,
              pressed && !isLoading && styles.pressed,
              isLoading && styles.disabled
            ]}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={isLoading || selectedPhoneNumbers.length === 0}
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.batchDoneButton,
              pressed && !isLoading && selectedPhoneNumbers.length > 0 && styles.pressed,
              (isLoading || selectedPhoneNumbers.length === 0) && styles.disabled
            ]}
          >
            <Text style={styles.batchDoneButtonText}>Done</Text>
          </Pressable>
        </View>

        <Text style={styles.batchModalTitle}>Select contacts</Text>
        <Text style={styles.batchSelectedCount}>
          {selectedPhoneNumbers.length === 1
            ? '1 contact selected'
            : `${selectedPhoneNumbers.length} contacts selected`}
        </Text>

        <View style={styles.batchSearchBox}>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={onSearchChange}
            placeholder="Search contacts"
            placeholderTextColor="#8B95A5"
            style={styles.batchSearchInput}
            value={search}
          />
        </View>

        {isLoading ? (
          <View style={styles.batchLoading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            contentContainerStyle={styles.batchListContent}
            data={visibleCandidates}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<Text style={styles.batchEmpty}>No contacts found</Text>}
            renderItem={({ item }) => (
              <BatchContactRow
                contact={item}
                isSelected={selectedPhoneNumberSet.has(item.phoneNumber)}
                onToggle={() => onToggleContact(item.phoneNumber)}
              />
            )}
            showsVerticalScrollIndicator={false}
            style={styles.batchList}
          />
        )}
      </View>
    </Modal>
  );
}

function BatchContactRow({
  contact,
  isSelected,
  onToggle
}: {
  contact: BatchContactCandidate;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.batchContactRow,
        pressed && styles.pressed
      ]}
    >
      <View style={[
        styles.batchContactSelector,
        isSelected && styles.batchContactSelectorActive
      ]}>
        {isSelected ? <View style={styles.batchContactSelectorInner} /> : null}
      </View>
      <View style={styles.chatText}>
        <Text style={styles.chatTitle}>{contact.displayName}</Text>
        <Text style={styles.chatPreview}>{contact.subtitle}</Text>
      </View>
    </Pressable>
  );
}

function YouTab({
  isLoading,
  isSavingPhoto,
  onChangePhoto,
  profile,
  profilePhotoHeaders
}: {
  isLoading: boolean;
  isSavingPhoto: boolean;
  onChangePhoto: () => void;
  profile: CurrentUserProfile | null;
  profilePhotoHeaders?: Record<string, string>;
}) {
  if (isLoading && !profile) {
    return (
      <View style={styles.youLoading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Profile unavailable</Text>
      </View>
    );
  }

  return (
    <View style={styles.youContent}>
      <View style={styles.youHero}>
        <Pressable
          accessibilityLabel={profile.profilePhotoUrl ? 'Change profile photo' : 'Add profile photo'}
          accessibilityRole="button"
          disabled={isSavingPhoto}
          onPress={onChangePhoto}
          style={({ pressed }) => [
            styles.youAvatarButton,
            pressed && !isSavingPhoto && styles.pressed,
            isSavingPhoto && styles.disabled
          ]}
        >
          <ProfileAvatar
            headers={profilePhotoHeaders}
            name={profile.displayName}
            size={96}
            uri={profile.profilePhotoUrl}
          />
          <View style={styles.youAvatarAddBadge}>
            <Text style={styles.youAvatarAddText}>+</Text>
          </View>
        </Pressable>

        <Text numberOfLines={1} style={styles.youName}>{profile.displayName}</Text>
        <Pressable
          accessibilityRole="button"
          disabled={isSavingPhoto}
          onPress={onChangePhoto}
          style={({ pressed }) => [
            styles.youPhotoAction,
            pressed && !isSavingPhoto && styles.pressed,
            isSavingPhoto && styles.disabled
          ]}
        >
          <Text style={styles.youPhotoActionText}>
            {isSavingPhoto
              ? 'Updating photo...'
              : profile.profilePhotoUrl
                ? 'Change profile photo'
                : 'Add profile photo'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.youDetails}>
        <ProfileDetailRow label="Phone" value={profile.phoneFormatted} />
        {profile.departmentName ? (
          <ProfileDetailRow label="Department" value={profile.departmentName} />
        ) : null}
        <ProfileDetailRow label="Role" value={profile.roleName} />
        <ProfileDetailRow label="Company" value={profile.companyName} />
        <ProfileDetailRow label="Status" value={formatEmployeeStatus(profile.status)} />
      </View>
    </View>
  );
}

function ProfileDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileDetailRow}>
      <Text style={styles.profileDetailLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.profileDetailValue}>{value}</Text>
    </View>
  );
}

function SettingsList({
  canManageCompanyProfile,
  canManageDirectory,
  canManageGroups,
  canManageUsers,
  canManageSecurity,
  onOpenChatBackup,
  onOpenCompanyProfile,
  onOpenDepartmentAdminPermissions,
  onOpenDepartmentsAndRoles,
  onOpenGroups,
  onOpenMyDevices,
  onOpenRolePermissions,
  onOpenSecurity
}: {
  canManageCompanyProfile: boolean;
  canManageDirectory: boolean;
  canManageGroups: boolean;
  canManageUsers: boolean;
  canManageSecurity: boolean;
  onOpenChatBackup: () => void;
  onOpenCompanyProfile: () => void;
  onOpenDepartmentAdminPermissions: () => void;
  onOpenDepartmentsAndRoles: () => void;
  onOpenGroups: () => void;
  onOpenMyDevices: () => void;
  onOpenRolePermissions: () => void;
  onOpenSecurity: () => void;
}) {
  const hasVisibleSettings = canManageDirectory ||
    canManageCompanyProfile ||
    canManageGroups ||
    canManageUsers ||
    canManageSecurity ||
    onOpenChatBackup ||
    onOpenMyDevices;

  if (!hasVisibleSettings) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No settings available yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.settingsList}>
      {canManageDirectory ? (
        <SettingsListItem
          onPress={onOpenDepartmentsAndRoles}
          subtitle="Departments, roles"
          title="Departments and roles"
        />
      ) : null}
      {canManageDirectory ? (
        <SettingsListItem
          onPress={onOpenRolePermissions}
          subtitle="Role-based access"
          title="Role permissions"
        />
      ) : null}
      {canManageCompanyProfile ? (
        <SettingsListItem
          onPress={onOpenCompanyProfile}
          subtitle="Company details"
          title="Company profile"
        />
      ) : null}
      {canManageUsers ? (
        <SettingsListItem
          onPress={onOpenDepartmentAdminPermissions}
          subtitle="Scoped Department Admin access"
          title="Department admin permissions"
        />
      ) : null}
      {canManageGroups ? (
        <SettingsListItem
          onPress={onOpenGroups}
          subtitle="Company and department groups"
          title="Groups"
        />
      ) : null}
      {canManageSecurity ? (
        <SettingsListItem
          onPress={onOpenSecurity}
          subtitle="Tenant devices and access controls"
          title="Organization security"
        />
      ) : null}
      <SettingsListItem
        onPress={onOpenMyDevices}
        subtitle="Registered devices for your account"
        title="My devices"
      />
      <SettingsListItem
        onPress={onOpenChatBackup}
        subtitle="Encrypted chat history"
        title="Chat backup"
      />
    </View>
  );
}

function ChatBackupSettings({
  canManagePolicy,
  isLoadingPolicy,
  isSavingPolicy,
  isSyncing,
  onBackupNow,
  onUpdatePolicy,
  onRestore,
  onShowRecoveryKey,
  policy
}: {
  canManagePolicy: boolean;
  isLoadingPolicy: boolean;
  isSavingPolicy: boolean;
  isSyncing: boolean;
  onBackupNow: () => void;
  onUpdatePolicy: (policy: Pick<ChatBackupPolicy, 'encryptedBackupsEnabled' | 'selfRestoreEnabled'>) => void;
  onRestore: () => void;
  onShowRecoveryKey: () => void;
  policy: ChatBackupPolicy;
}) {
  if (isLoadingPolicy) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const backupStatus = policy.encryptedBackupsEnabled ? 'Enabled by organization' : 'Disabled by organization';
  const restoreStatus = policy.selfRestoreEnabled
    ? 'Recovery-key restore allowed'
    : 'Restore requires organization approval';

  return (
    <View style={styles.backupSettings}>
      <Text style={styles.securitySectionTitle}>Organization policy</Text>
      <SettingsListItem
        subtitle={backupStatus}
        title="Encrypted chat backup"
      />
      <SettingsListItem
        subtitle={restoreStatus}
        title="Self-service restore"
      />

      {canManagePolicy ? (
        <>
          <SettingsListItem
            onPress={isSavingPolicy
              ? undefined
              : () => onUpdatePolicy({
                  encryptedBackupsEnabled: !policy.encryptedBackupsEnabled,
                  selfRestoreEnabled: policy.encryptedBackupsEnabled ? false : policy.selfRestoreEnabled
                })}
            subtitle={policy.encryptedBackupsEnabled ? 'Turn off encrypted backups' : 'Allow encrypted backups'}
            title={policy.encryptedBackupsEnabled ? 'Disable backup' : 'Enable backup'}
          />
          <SettingsListItem
            onPress={isSavingPolicy || !policy.encryptedBackupsEnabled
              ? undefined
              : () => onUpdatePolicy({
                  encryptedBackupsEnabled: true,
                  selfRestoreEnabled: !policy.selfRestoreEnabled
                })}
            subtitle={policy.selfRestoreEnabled ? 'Require organization approval' : 'Allow recovery-key restore'}
            title={policy.selfRestoreEnabled ? 'Disable self restore' : 'Enable self restore'}
          />
        </>
      ) : null}

      <Text style={styles.securitySectionTitle}>This device</Text>
      <SettingsListItem
        onPress={policy.encryptedBackupsEnabled ? onBackupNow : undefined}
        subtitle={
          !policy.encryptedBackupsEnabled
            ? 'Disabled by organization'
            : isSyncing
              ? 'Syncing now'
              : 'Upload encrypted backup'
        }
        title="Back up now"
      />
      <SettingsListItem
        onPress={policy.encryptedBackupsEnabled && policy.selfRestoreEnabled ? onRestore : undefined}
        subtitle={
          !policy.encryptedBackupsEnabled
            ? 'Disabled by organization'
            : policy.selfRestoreEnabled
              ? 'Restore latest backup'
              : 'Requires organization approval'
        }
        title="Restore chats"
      />
      <SettingsListItem
        onPress={policy.encryptedBackupsEnabled && policy.selfRestoreEnabled ? onShowRecoveryKey : undefined}
        subtitle={
          policy.encryptedBackupsEnabled && policy.selfRestoreEnabled
            ? 'Copy recovery key'
            : 'Hidden by organization policy'
        }
        title="Recovery key"
      />
    </View>
  );
}

function SecuritySettings({
  devices,
  isLoading,
  isRevoking,
  onRevokeDevice
}: {
  devices: TenantDevice[];
  isLoading: boolean;
  isRevoking: boolean;
  onRevokeDevice: (device: TenantDevice) => void;
}) {
  if (isLoading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!devices.length) {
    return <Text style={styles.emptySmall}>No registered devices yet</Text>;
  }

  return (
    <View style={styles.securityList}>
      <Text style={styles.securitySectionTitle}>Tenant registered devices</Text>
      {devices.map((device) => (
        <DeviceRow
          device={device}
          isRevoking={isRevoking}
          key={device.deviceId}
          onRevoke={() => onRevokeDevice(device)}
        />
      ))}
    </View>
  );
}

function MyDevicesSettings({
  devices,
  isLoading,
  isRevoking,
  onRevokeDevice
}: {
  devices: CurrentUserDevice[];
  isLoading: boolean;
  isRevoking: boolean;
  onRevokeDevice: (device: CurrentUserDevice) => void;
}) {
  if (isLoading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!devices.length) {
    return <Text style={styles.emptySmall}>No registered devices yet</Text>;
  }

  return (
    <View style={styles.securityList}>
      <Text style={styles.securitySectionTitle}>Your registered devices</Text>
      {devices.map((device) => (
        <DeviceRow
          device={device}
          isRevoking={isRevoking}
          key={device.deviceId}
          onRevoke={device.isCurrentDevice ? undefined : () => onRevokeDevice(device)}
        />
      ))}
    </View>
  );
}

function DeviceRow({
  device,
  isRevoking,
  onRevoke
}: {
  device: DeviceListItem;
  isRevoking: boolean;
  onRevoke?: () => void;
}) {
  const isRevoked = device.status === 'REVOKED';
  const isCurrentDevice = 'isCurrentDevice' in device && device.isCurrentDevice;
  const meta = [
    formatDevicePlatform(device.platform),
    device.roleName,
    device.lastSeenAt ? `Last seen ${formatSecurityDate(device.lastSeenAt)}` : null
  ].filter(Boolean).join(' - ');

  return (
    <View style={styles.deviceRow}>
      <View style={styles.deviceIcon}>
        <Feather color={colors.primary} name={getDeviceIconName(device.platform)} size={20} />
      </View>
      <View style={styles.chatText}>
        <Text style={styles.chatTitle}>{device.displayName}</Text>
        <Text numberOfLines={2} style={styles.chatPreview}>{meta}</Text>
        <Text numberOfLines={1} style={isRevoked ? styles.deviceStatusRevoked : styles.deviceStatusActive}>
          {isRevoked ? 'Revoked' : isCurrentDevice ? 'Current' : 'Active'}
        </Text>
      </View>
      {!isRevoked && onRevoke ? (
        <Pressable
          accessibilityLabel={`Revoke ${device.displayName} device`}
          accessibilityRole="button"
          disabled={isRevoking}
          onPress={onRevoke}
          style={({ pressed }) => [
            styles.revokeDeviceButton,
            pressed && !isRevoking && styles.pressed,
            isRevoking && styles.disabled
          ]}
        >
          <Text style={styles.revokeDeviceText}>Revoke</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SettingsListItem({
  onPress,
  subtitle,
  title
}: {
  onPress?: () => void;
  subtitle: string;
  title: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsListItem,
        pressed && onPress && styles.pressed
      ]}
    >
      <View style={styles.settingsListIcon}>
        <Text style={styles.settingsListIconText}>{title.slice(0, 1)}</Text>
      </View>
      <View style={styles.chatText}>
        <Text style={styles.chatTitle}>{title}</Text>
        <Text style={styles.chatPreview}>{subtitle}</Text>
      </View>
      {onPress ? (
        <Text style={styles.chevronText}>›</Text>
      ) : null}
    </Pressable>
  );
}

function DepartmentAdminPermissionSettings({
  employees,
  isLoading,
  isSaving,
  onTogglePermission,
  permissions,
  profilePhotoHeaders
}: {
  employees: ApprovedEmployee[];
  isLoading: boolean;
  isSaving: boolean;
  onTogglePermission: (employee: ApprovedEmployee, permission: DepartmentAdminPermission) => void;
  permissions: DepartmentAdminPermission[];
  profilePhotoHeaders?: Record<string, string>;
}) {
  const departmentAdmins = employees.filter((employee) => employee.role === 'DEPT_ADMIN');

  if (isLoading && !departmentAdmins.length) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!departmentAdmins.length) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No Department Admins yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.permissionSettingsList}>
      {departmentAdmins.map((employee) => (
        <DepartmentAdminPermissionEmployee
          employee={employee}
          isSaving={isSaving}
          key={employee.approvedPhoneId}
          onTogglePermission={onTogglePermission}
          permissions={permissions}
          profilePhotoHeaders={profilePhotoHeaders}
        />
      ))}
    </View>
  );
}

function RolePermissionSettings({
  isLoading,
  isSaving,
  onTogglePermission,
  permissions,
  roles
}: {
  isLoading: boolean;
  isSaving: boolean;
  onTogglePermission: (role: TenantRole, permission: RolePermission) => void;
  permissions: RolePermission[];
  roles: TenantRole[];
}) {
  if (isLoading && !roles.length) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!roles.length) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No roles yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.permissionSettingsList}>
      {roles.map((role) => (
        <RolePermissionSection
          isSaving={isSaving}
          key={role.roleId}
          onTogglePermission={onTogglePermission}
          permissions={permissions}
          role={role}
        />
      ))}
    </View>
  );
}

function RolePermissionSection({
  isSaving,
  onTogglePermission,
  permissions,
  role
}: {
  isSaving: boolean;
  onTogglePermission: (role: TenantRole, permission: RolePermission) => void;
  permissions: RolePermission[];
  role: TenantRole;
}) {
  const enabledPermissionSet = new Set(role.permissions || []);

  return (
    <View style={styles.permissionEmployeeSection}>
      <View style={styles.permissionEmployeeHeader}>
        <View style={styles.settingsListIcon}>
          <Text style={styles.settingsListIconText}>{role.name.slice(0, 1)}</Text>
        </View>
        <View style={styles.chatText}>
          <Text style={styles.chatTitle}>{role.name}</Text>
          <Text numberOfLines={1} style={styles.chatPreview}>
            {role.description || role.status}
          </Text>
        </View>
      </View>

      {permissions.map((permission) => {
        const isEnabled = enabledPermissionSet.has(permission.permission);

        return (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isEnabled, disabled: isSaving }}
            disabled={isSaving}
            key={permission.permission}
            onPress={() => onTogglePermission(role, permission)}
            style={({ pressed }) => [
              styles.permissionRow,
              pressed && !isSaving && styles.pressed,
              isSaving && styles.disabled
            ]}
          >
            <View style={[
              styles.permissionCheck,
              isEnabled && styles.permissionCheckActive
            ]}>
              {isEnabled ? <Feather color="#FFFFFF" name="check" size={13} /> : null}
            </View>
            <View style={styles.chatText}>
              <Text style={styles.permissionTitle}>{permission.title}</Text>
              <Text numberOfLines={2} style={styles.permissionDescription}>
                {permission.description}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function DepartmentAdminPermissionEmployee({
  employee,
  isSaving,
  onTogglePermission,
  permissions,
  profilePhotoHeaders
}: {
  employee: ApprovedEmployee;
  isSaving: boolean;
  onTogglePermission: (employee: ApprovedEmployee, permission: DepartmentAdminPermission) => void;
  permissions: DepartmentAdminPermission[];
  profilePhotoHeaders?: Record<string, string>;
}) {
  const enabledPermissionSet = new Set(employee.departmentAdminPermissions || []);
  const employeeName = employee.displayName || employee.phoneMasked;

  return (
    <View style={styles.permissionEmployeeSection}>
      <View style={styles.permissionEmployeeHeader}>
        <ProfileAvatar
          headers={profilePhotoHeaders}
          name={employeeName}
          size={44}
          uri={employee.profilePhotoUrl}
        />
        <View style={styles.chatText}>
          <Text style={styles.chatTitle}>{employeeName}</Text>
          <Text numberOfLines={1} style={styles.chatPreview}>
            {employee.departmentName} - {employee.roleName}
          </Text>
        </View>
      </View>

      {permissions.map((permission) => {
        const isEnabled = enabledPermissionSet.has(permission.permission);

        return (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isEnabled, disabled: isSaving }}
            disabled={isSaving}
            key={permission.permission}
            onPress={() => onTogglePermission(employee, permission)}
            style={({ pressed }) => [
              styles.permissionRow,
              pressed && !isSaving && styles.pressed,
              isSaving && styles.disabled
            ]}
          >
            <View style={[
              styles.permissionCheck,
              isEnabled && styles.permissionCheckActive
            ]}>
              {isEnabled ? <Feather color="#FFFFFF" name="check" size={13} /> : null}
            </View>
            <View style={styles.chatText}>
              <Text style={styles.permissionTitle}>{permission.title}</Text>
              <Text numberOfLines={2} style={styles.permissionDescription}>
                {permission.description}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function GroupsSettings({
  groups,
  isLoading
}: {
  groups: TenantGroup[];
  isLoading: boolean;
}) {
  if (isLoading && !groups.length) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!groups.length) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No groups yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.groupList}>
      {groups.map((group) => (
        <View style={styles.groupRow} key={group.groupId}>
          <View style={styles.groupIcon}>
            <Feather color={colors.primary} name="users" size={18} />
          </View>
          <View style={styles.chatText}>
            <Text style={styles.chatTitle}>{group.name}</Text>
            <Text numberOfLines={1} style={styles.chatPreview}>
              {getGroupSubtitle(group)}
            </Text>
          </View>
          <Text numberOfLines={1} style={styles.groupMeta}>
            {group.memberCount === 1 ? '1 member' : `${group.memberCount} members`}
          </Text>
        </View>
      ))}
    </View>
  );
}

function GroupsTab({
  groups,
  isLoading,
  onOpenGroup
}: {
  groups: TenantGroup[];
  isLoading: boolean;
  onOpenGroup: (group: TenantGroup) => void;
}) {
  if (isLoading && !groups.length) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!groups.length) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No groups yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.groupList}>
      {groups.map((group) => (
        <Pressable
          accessibilityLabel={`Open ${group.name} group chat`}
          accessibilityRole="button"
          key={group.groupId}
          onPress={() => onOpenGroup(group)}
          style={({ pressed }) => [styles.groupRow, pressed && styles.pressed]}
        >
          <View style={styles.groupIcon}>
            <Ionicons color={colors.primary} name="people" size={20} />
          </View>
          <View style={styles.chatText}>
            <Text style={styles.chatTitle}>{group.name}</Text>
            <Text numberOfLines={1} style={styles.chatPreview}>
              {getGroupSubtitle(group)}
            </Text>
          </View>
          <Text numberOfLines={1} style={styles.groupMeta}>
            {group.memberCount === 1 ? '1 member' : `${group.memberCount} members`}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function CompanyProfileSettings({
  companyAddress,
  companyName,
  isLoading,
  isSavingLogo,
  isSaving,
  onAddressChange,
  onChangeLogo,
  onNameChange,
  onSave,
  profile,
  profilePhotoHeaders
}: {
  companyAddress: string;
  companyName: string;
  isLoading: boolean;
  isSavingLogo: boolean;
  isSaving: boolean;
  onAddressChange: (value: string) => void;
  onChangeLogo: () => void;
  onNameChange: (value: string) => void;
  onSave: () => void;
  profile: CompanyProfile | null;
  profilePhotoHeaders?: Record<string, string>;
}) {
  const [didLogoFail, setDidLogoFail] = useState(false);
  const companyLogoUrl = profile?.companyLogoUrl || null;
  const companyLogoCacheKey = profile?.companyLogoCacheKey || null;

  useEffect(() => {
    setDidLogoFail(false);
  }, [companyLogoCacheKey, companyLogoUrl]);

  if (isLoading && !profile) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const canSave = companyName.trim().length >= 2 &&
    companyAddress.trim().length >= 5 &&
    !isSaving;
  const canLoadLogo = Boolean(companyLogoUrl && !didLogoFail);
  const companyLogoSource = canLoadLogo && companyLogoUrl
    ? profilePhotoHeaders
      ? { headers: profilePhotoHeaders, uri: companyLogoUrl }
      : { uri: companyLogoUrl }
    : null;

  return (
    <View style={styles.companyProfileForm}>
      <Pressable
        accessibilityRole="button"
        disabled={isSavingLogo}
        onPress={onChangeLogo}
        style={({ pressed }) => [
          styles.companyLogoRow,
          pressed && !isSavingLogo && styles.pressed,
          isSavingLogo && styles.disabled
        ]}
      >
        <View style={styles.companyLogoBox}>
          {companyLogoSource ? (
            <Image
              onError={() => setDidLogoFail(true)}
              resizeMode="cover"
              source={companyLogoSource}
              style={styles.companyLogoImage}
            />
          ) : (
            <Feather name="image" color={colors.primary} size={22} />
          )}
        </View>
        <View style={styles.chatText}>
          <Text style={styles.chatTitle}>
            {isSavingLogo
              ? 'Updating company logo...'
              : companyLogoUrl
                ? 'Change company logo'
                : 'Add company logo'}
          </Text>
          <Text style={styles.chatPreview}>Optional</Text>
        </View>
      </Pressable>
      <SettingsInput
        onChangeText={onNameChange}
        placeholder="Company name"
        value={companyName}
      />
      <SettingsInput
        onChangeText={onAddressChange}
        placeholder="Company address"
        value={companyAddress}
      />
      <Pressable
        accessibilityRole="button"
        disabled={!canSave}
        onPress={onSave}
        style={({ pressed }) => [
          styles.settingsSaveButton,
          pressed && canSave && styles.pressed,
          !canSave && styles.disabled
        ]}
      >
        <Text style={styles.settingsSaveButtonText}>{isSaving ? 'Saving...' : 'Save changes'}</Text>
      </Pressable>

      {profile ? (
        <View style={styles.companyProfileMeta}>
          <ProfileDetailRow label="Security" value={formatSettingValue(profile.securityMode)} />
          <ProfileDetailRow label="Retention" value={formatSettingValue(profile.retentionPolicy)} />
          <ProfileDetailRow label="Status" value={formatEmployeeStatus(profile.status)} />
        </View>
      ) : null}
    </View>
  );
}

function DirectorySettings({
  departments,
  filter,
  isLoading,
  roles
}: {
  departments: TenantDepartment[];
  filter: DirectoryFilter;
  isLoading: boolean;
  roles: TenantRole[];
}) {
  const records = filter === 'Departments'
    ? departments.map((department) => ({
        id: department.departmentId,
        meta: department.description || department.status,
        name: department.name
      }))
    : roles.map((role) => ({
        id: role.roleId,
        meta: role.description || role.status,
        name: role.name
      }));

  if (isLoading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <TenantRecordList
      emptyText={filter === 'Departments' ? 'No departments yet' : 'No roles yet'}
      records={records}
    />
  );
}

function AddRecordModal({
  description,
  filter,
  isSaving,
  name,
  onCancel,
  onDescriptionChange,
  onNameChange,
  onSave,
  visible
}: {
  description: string;
  filter: DirectoryFilter;
  isSaving: boolean;
  name: string;
  onCancel: () => void;
  onDescriptionChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onSave: () => void;
  visible: boolean;
}) {
  const recordLabel = filter === 'Departments' ? 'department' : 'role';

  if (Platform.OS === 'ios') {
    return null;
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onCancel}
      presentationStyle="fullScreen"
      transparent={false}
      visible={visible}
    >
      <View style={styles.androidModalScreen}>
        <View style={styles.androidModalHeader}>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={onCancel}
            style={({ pressed }) => [styles.backButton, pressed && !isSaving && styles.pressed]}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={onSave}
            style={({ pressed }) => [
              styles.androidSaveButton,
              pressed && !isSaving && styles.pressed,
              isSaving && styles.disabled
            ]}
          >
            <Text style={styles.androidSaveButtonText}>{isSaving ? 'Creating...' : 'Create'}</Text>
          </Pressable>
        </View>
        <Text style={styles.modalTitle}>New {recordLabel}</Text>
        <SettingsInput
          onChangeText={onNameChange}
          placeholder={`${filter === 'Departments' ? 'Department' : 'Role'} name`}
          value={name}
        />
        <SettingsInput
          onChangeText={onDescriptionChange}
          placeholder="Description"
          value={description}
        />
      </View>
    </Modal>
  );
}

function AddGroupModal({
  department,
  description,
  isSaving,
  name,
  onCancel,
  onDescriptionChange,
  onNameChange,
  onSave,
  visible
}: {
  department: TenantDepartment | null;
  description: string;
  isSaving: boolean;
  name: string;
  onCancel: () => void;
  onDescriptionChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onSave: () => void;
  visible: boolean;
}) {
  if (Platform.OS === 'ios') {
    return null;
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onCancel}
      presentationStyle="fullScreen"
      transparent={false}
      visible={visible}
    >
      <View style={styles.androidModalScreen}>
        <View style={styles.androidModalHeader}>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={onCancel}
            style={({ pressed }) => [styles.backButton, pressed && !isSaving && styles.pressed]}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={onSave}
            style={({ pressed }) => [
              styles.androidSaveButton,
              pressed && !isSaving && styles.pressed,
              isSaving && styles.disabled
            ]}
          >
            <Text style={styles.androidSaveButtonText}>{isSaving ? 'Creating...' : 'Create'}</Text>
          </Pressable>
        </View>
        <Text style={styles.modalTitle}>New group</Text>
        <Text style={styles.groupScopeLabel}>
          {department ? department.name : 'Company-wide'}
        </Text>
        <SettingsInput
          onChangeText={onNameChange}
          placeholder="Group name"
          value={name}
        />
        <SettingsInput
          onChangeText={onDescriptionChange}
          placeholder="Description"
          value={description}
        />
      </View>
    </Modal>
  );
}

function RecoveryKeyModal({
  isRestoring,
  onCancel,
  onChangeRecoveryKey,
  onRestore,
  recoveryKey,
  visible
}: {
  isRestoring: boolean;
  onCancel: () => void;
  onChangeRecoveryKey: (value: string) => void;
  onRestore: () => void;
  recoveryKey: string;
  visible: boolean;
}) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onCancel}
      presentationStyle="fullScreen"
      transparent={false}
      visible={visible}
    >
      <View style={styles.androidModalScreen}>
        <View style={styles.androidModalHeader}>
          <Pressable
            accessibilityRole="button"
            disabled={isRestoring}
            onPress={onCancel}
            style={({ pressed }) => [styles.backButton, pressed && !isRestoring && styles.pressed]}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isRestoring || recoveryKey.trim().length < 32}
            onPress={onRestore}
            style={({ pressed }) => [
              styles.androidSaveButton,
              pressed && !isRestoring && recoveryKey.trim().length >= 32 && styles.pressed,
              (isRestoring || recoveryKey.trim().length < 32) && styles.disabled
            ]}
          >
            <Text style={styles.androidSaveButtonText}>{isRestoring ? 'Restoring...' : 'Restore'}</Text>
          </Pressable>
        </View>
        <Text style={styles.modalTitle}>Recovery key</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          onChangeText={onChangeRecoveryKey}
          placeholder="Paste recovery key"
          placeholderTextColor="#8B95A5"
          style={styles.recoveryKeyInput}
          value={recoveryKey}
        />
      </View>
    </Modal>
  );
}

function ChatRow({
  chat,
  onOpen,
  profilePhotoHeaders
}: {
  chat: ChatItem;
  onOpen: () => void;
  profilePhotoHeaders?: Record<string, string>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [
        styles.chatRow,
        styles.contactChatRow,
        pressed && styles.pressed
      ]}
    >
      <ProfileAvatar
        headers={profilePhotoHeaders}
        name={chat.title}
        size={56}
        uri={chat.profilePhotoUrl}
      />

      <View style={styles.chatText}>
        <Text style={[styles.chatTitle, styles.chatListTitle]}>{chat.title}</Text>
        {chat.preview ? (
          <Text numberOfLines={2} style={styles.chatPreview}>{chat.preview}</Text>
        ) : !chat.hasActiveDevice ? (
          <Text numberOfLines={1} style={styles.chatPreview}>Waiting for secure device</Text>
        ) : null}
      </View>

      <View style={styles.chatMeta}>
        {chat.lastMessageAt ? (
          <Text style={styles.chatTime}>{formatChatListTime(chat.lastMessageAt)}</Text>
        ) : null}
        {chat.unreadCount > 0 ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{chat.unreadCount > 99 ? '99+' : chat.unreadCount}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function EmployeeRow({
  canManageUsers,
  employee,
  isUpdatingLifecycle,
  onSelect,
  profilePhotoHeaders
}: {
  canManageUsers: boolean;
  employee: EmployeeListItem;
  isUpdatingLifecycle: boolean;
  onSelect: () => void;
  profilePhotoHeaders?: Record<string, string>;
}) {
  const hasActions = canManageUsers && getEmployeeActionOptions(employee).length > 0;

  return (
    <Pressable
      accessibilityRole={hasActions ? 'button' : undefined}
      disabled={!hasActions || isUpdatingLifecycle}
      onPress={onSelect}
      style={({ pressed }) => [
      styles.chatRow,
      pressed && hasActions && !isUpdatingLifecycle && styles.pressed,
      isUpdatingLifecycle && styles.disabled
    ]}>
      <ProfileAvatar
        headers={profilePhotoHeaders}
        name={employee.name}
        size={44}
        uri={employee.profilePhotoUrl}
      />
      <View style={styles.chatText}>
        <Text style={styles.chatTitle}>{employee.name}</Text>
        <Text style={styles.chatPreview}>{employee.department}</Text>
      </View>
      <View style={styles.employeeMeta}>
        <Text numberOfLines={1} style={styles.employeeRole}>{employee.role}</Text>
        <Text numberOfLines={1} style={styles.employeeStatus}>{employee.status}</Text>
      </View>
    </Pressable>
  );
}

function ManualInviteModal({
  onCancel,
  onChangePhone,
  onConfirm,
  phone,
  visible
}: {
  onCancel: () => void;
  onChangePhone: (value: string) => void;
  onConfirm: () => void;
  phone: string;
  visible: boolean;
}) {
  if (Platform.OS === 'ios') {
    return null;
  }

  const canConfirm = phone.trim().length >= 8;

  return (
    <Modal
      animationType="slide"
      onRequestClose={onCancel}
      presentationStyle="fullScreen"
      transparent={false}
      visible={visible}
    >
      <View style={styles.manualInviteModalScreen}>
        <View style={styles.batchModalHeader}>
          <Pressable
            accessibilityLabel="Cancel manual employee add"
            accessibilityRole="button"
            onPress={onCancel}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={!canConfirm}
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.batchDoneButton,
              pressed && canConfirm && styles.pressed,
              !canConfirm && styles.disabled
            ]}
          >
            <Text style={styles.batchDoneButtonText}>Add</Text>
          </Pressable>
        </View>

        <Text style={styles.batchModalTitle}>Add employee</Text>
        <Text style={styles.manualInviteHelp}>
          Enter the phone number with country code.
        </Text>

        <View style={styles.batchSearchBox}>
          <TextInput
            autoComplete="tel"
            autoCorrect={false}
            keyboardType="phone-pad"
            onChangeText={onChangePhone}
            placeholder="+14695554444"
            placeholderTextColor="#8B95A5"
            style={styles.batchSearchInput}
            textContentType="telephoneNumber"
            value={phone}
          />
        </View>
      </View>
    </Modal>
  );
}

function SettingsInput({
  onChangeText,
  placeholder,
  value
}: {
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.settingsInputBox}>
      <TextInput
        autoCapitalize="words"
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8B95A5"
        style={styles.settingsInput}
        value={value}
      />
    </View>
  );
}

function ProfileAvatar({
  headers,
  name,
  size,
  uri
}: {
  headers?: Record<string, string>;
  name: string;
  size: number;
  uri?: string | null;
}) {
  const [didImageFail, setDidImageFail] = useState(false);
  const authorizationHeader = headers?.Authorization || '';
  const avatarStyle = {
    borderRadius: size / 2,
    height: size,
    width: size
  };

  useEffect(() => {
    setDidImageFail(false);
  }, [authorizationHeader, uri]);

  const fallback = (
    <View style={[
      styles.profileAvatarFallback,
      StyleSheet.absoluteFillObject
    ]}>
      <Text style={[
        styles.profileAvatarInitials,
        { fontSize: Math.max(12, Math.round(size * 0.32)), lineHeight: Math.max(16, Math.round(size * 0.38)) }
      ]}>
        {getInitials(name)}
      </Text>
    </View>
  );
  const isRemoteUri = Boolean(uri && /^https?:\/\//i.test(uri));
  const canLoadImage = Boolean(uri && !didImageFail && (!isRemoteUri || headers));

  if (canLoadImage && uri) {
    const source = isRemoteUri && headers
      ? { headers, uri }
      : { uri };

    return (
      <View style={[styles.profileAvatarShell, avatarStyle]}>
        {fallback}
        <Image
          onError={() => setDidImageFail(true)}
          resizeMode="cover"
          source={source}
          style={[styles.profileAvatarImage, StyleSheet.absoluteFillObject]}
        />
      </View>
    );
  }

  return (
    <View style={[styles.profileAvatarShell, avatarStyle]}>
      {fallback}
    </View>
  );
}

function TenantRecordList({
  emptyText,
  records
}: {
  emptyText: string;
  records: Array<{ id: string; meta: string; name: string }>;
}) {
  if (!records.length) {
    return <Text style={styles.emptySmall}>{emptyText}</Text>;
  }

  return (
    <View style={styles.recordList}>
      {records.map((record) => (
        <View key={record.id} style={styles.recordRow}>
          <View style={styles.recordInitial}>
            <Text style={styles.recordInitialText}>{record.name.slice(0, 1)}</Text>
          </View>
          <View style={styles.chatText}>
            <Text style={styles.chatTitle}>{record.name}</Text>
            <Text numberOfLines={1} style={styles.chatPreview}>{record.meta}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function SearchIcon() {
  return (
    <View style={styles.searchIcon}>
      <View style={styles.searchLens} />
      <View style={styles.searchHandle} />
    </View>
  );
}

function QrIcon() {
  return (
    <View style={styles.qrIcon}>
      <View style={styles.qrCell} />
      <View style={styles.qrCell} />
      <View style={styles.qrCell} />
      <View style={styles.qrCell} />
    </View>
  );
}

function FilterIcon() {
  return (
    <View style={styles.filterIcon}>
      <View style={styles.filterLineWide} />
      <View style={styles.filterLineMedium} />
      <View style={styles.filterLineSmall} />
    </View>
  );
}

function FooterTabButton({
  active,
  minHeight,
  onPress,
  profile,
  profilePhotoHeaders,
  tab
}: {
  active: boolean;
  minHeight: number;
  onPress: () => void;
  profile: CurrentUserProfile | null;
  profilePhotoHeaders?: Record<string, string>;
  tab: FooterTab;
}) {
  const activeProgress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(activeProgress, {
      damping: 16,
      mass: 0.82,
      stiffness: 190,
      toValue: active ? 1 : 0,
      useNativeDriver: true
    }).start();
  }, [active, activeProgress]);

  const pillScale = activeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1]
  });
  const pillOpacity = activeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1]
  });
  const contentScale = activeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04]
  });

  return (
    <Pressable
      accessibilityLabel={tab}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.footerTab,
        { minHeight },
        pressed && styles.pressed
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.footerTabActivePill,
          {
            opacity: pillOpacity,
            transform: [{ scale: pillScale }]
          }
        ]}
      />
      <Animated.View style={[
        styles.footerTabContent,
        { transform: [{ scale: contentScale }] }
      ]}>
        <FooterIcon
          active={active}
          profile={profile}
          profilePhotoHeaders={profilePhotoHeaders}
          tab={tab}
        />
        <Text style={[
          styles.footerTabText,
          active && styles.footerTabTextActive
        ]}>
          {tab}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function FooterIcon({
  active,
  profile,
  profilePhotoHeaders,
  tab
}: {
  active: boolean;
  profile: CurrentUserProfile | null;
  profilePhotoHeaders?: Record<string, string>;
  tab: FooterTab;
}) {
  const iconColor = active ? '#4F46E5' : '#111827';

  if (tab === 'You') {
    return (
      <View style={[
        styles.footerProfileAvatar,
        active && styles.footerProfileAvatarActive
      ]}>
        <ProfileAvatar
          headers={profilePhotoHeaders}
          name={profile?.displayName || 'You'}
          size={24}
          uri={profile?.profilePhotoUrl}
        />
      </View>
    );
  }

  if (tab === 'Employees') {
    return <Ionicons color={iconColor} name={active ? 'people' : 'people-outline'} size={23} />;
  }

  if (tab === 'Groups') {
    return <Ionicons color={iconColor} name={active ? 'albums' : 'albums-outline'} size={23} />;
  }

  if (tab === 'Settings') {
    return <Ionicons color={iconColor} name={active ? 'settings' : 'settings-outline'} size={23} />;
  }

  return <Ionicons color={iconColor} name={active ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} size={23} />;
}

function sortByName<T extends { name: string }>(records: T[]): T[] {
  return [...records].sort((first, second) => first.name.localeCompare(second.name));
}

function getGroupSubtitle(group: TenantGroup): string {
  if (group.isDepartmentDefault) {
    return group.departmentName ? `${group.departmentName} department` : 'Department group';
  }

  if (group.scope === 'DEPARTMENT') {
    return group.departmentName ? `${group.departmentName} group` : 'Department group';
  }

  return 'Company group';
}

function hasPermission(permissions: string[], permission: UserPermission): boolean {
  return permissions.includes(permission);
}

function getDeviceIconName(platform: string): React.ComponentProps<typeof Feather>['name'] {
  if (platform === 'ios' || platform === 'android') {
    return 'smartphone';
  }

  if (platform === 'web') {
    return 'monitor';
  }

  return 'hard-drive';
}

function formatDevicePlatform(platform: string): string {
  if (platform === 'ios') {
    return 'iOS';
  }

  if (platform === 'android') {
    return 'Android';
  }

  if (platform === 'web') {
    return 'Web';
  }

  return 'Unknown device';
}

function formatSecurityDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function getEmployeeActionOptions(employee: EmployeeListItem): EmployeeActionOption[] {
  const status = employee.statusValue.toUpperCase();
  const changeRoleOption: EmployeeActionOption = {
    action: 'CHANGE_ROLE',
    confirmButton: 'Change',
    confirmMessage: (employeeName) =>
      `${employeeName}'s company role and role permissions will be updated.`,
    confirmTitle: 'Change role?',
    label: 'Change role',
    successMessage: (employeeName) => `${employeeName}'s role has been updated.`,
    successTitle: 'Role updated'
  };
  const departmentAdminOption: EmployeeActionOption = employee.baseRole === 'DEPT_ADMIN'
    ? {
        action: 'REMOVE_DEPT_ADMIN',
        confirmButton: 'Remove',
        confirmMessage: (employeeName) =>
          `${employeeName} will remain an employee, but will no longer be marked as a department admin.`,
        confirmTitle: 'Remove department admin?',
        label: 'Remove Dept Admin',
        successMessage: (employeeName) => `${employeeName} is no longer marked as a department admin.`,
        successTitle: 'Department admin removed'
      }
    : {
        action: 'ASSIGN_DEPT_ADMIN',
        confirmButton: 'Assign',
        confirmMessage: (employeeName) =>
          `${employeeName} will be marked as a department admin for their assigned department.`,
        confirmTitle: 'Assign department admin?',
        label: 'Assign Dept Admin',
        successMessage: (employeeName) => `${employeeName} is now marked as a department admin.`,
        successTitle: 'Department admin assigned'
      };
  const deactivateOption: EmployeeActionOption = {
    action: 'DEACTIVATE',
    confirmButton: 'Deactivate',
    confirmMessage: (employeeName) =>
      `${employeeName} will lose access to this organization and all registered devices will be revoked.`,
    confirmTitle: 'Deactivate employee?',
    label: status === 'INVITED' ? 'Cancel invite' : 'Deactivate',
    reason: status === 'INVITED' ? 'Invite cancelled by organization admin' : 'Deactivated by organization admin',
    successMessage: (employeeName) => `${employeeName} no longer has active access.`,
    successTitle: status === 'INVITED' ? 'Invite cancelled' : 'Employee deactivated'
  };
  const archiveOption: EmployeeActionOption = {
    action: 'ARCHIVE',
    confirmButton: 'Archive',
    confirmMessage: (employeeName) =>
      `${employeeName} will be archived and blocked from future organization access.`,
    confirmTitle: 'Archive employee?',
    label: 'Archive',
    reason: 'Archived by organization admin',
    successMessage: (employeeName) => `${employeeName} has been archived.`,
    successTitle: 'Employee archived'
  };
  const reactivateOption: EmployeeActionOption = {
    action: 'REACTIVATE',
    confirmButton: 'Reactivate',
    confirmMessage: (employeeName) =>
      `${employeeName} will regain organization access after phone verification. Devices manually revoked by an admin remain blocked.`,
    confirmTitle: 'Reactivate employee?',
    label: 'Reactivate',
    reason: 'Reactivated by organization admin',
    successMessage: (employeeName) => `${employeeName} can sign in again after phone verification.`,
    successTitle: 'Employee reactivated'
  };
  const anonymizeOption: EmployeeActionOption = {
    action: 'ANONYMIZE',
    confirmButton: 'Anonymize',
    confirmMessage: (employeeName) =>
      `${employeeName}'s personal profile fields will be anonymized and access will remain blocked.`,
    confirmTitle: 'Anonymize employee?',
    label: 'Delete or anonymize',
    reason: 'Anonymized by organization admin',
    successMessage: () => 'The employee profile has been anonymized.',
    successTitle: 'Employee anonymized'
  };

  if (status === 'ACTIVE') {
    return [changeRoleOption, departmentAdminOption, deactivateOption, archiveOption, anonymizeOption];
  }

  if (status === 'INVITED') {
    return [changeRoleOption, departmentAdminOption, deactivateOption, anonymizeOption];
  }

  if (status === 'DEACTIVATED' || status === 'SUSPENDED') {
    return [reactivateOption, archiveOption, anonymizeOption];
  }

  if (status === 'ARCHIVED') {
    return [reactivateOption, anonymizeOption];
  }

  return [];
}

function isEmployeeLifecycleAction(action: EmployeeAction): action is EmployeeLifecycleAction {
  return action === 'DEACTIVATE' ||
    action === 'ARCHIVE' ||
    action === 'ANONYMIZE' ||
    action === 'REACTIVATE';
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function omitRecordKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const nextRecord = { ...record };
  delete nextRecord[key];
  return nextRecord;
}

function isRecipientDeviceNotReadyError(error: unknown): boolean {
  return error instanceof Error &&
    /recipient.*active device|does not have an active device|group members need to open synzapp/i.test(error.message);
}

function isNetworkUnavailableError(error: unknown): boolean {
  return error instanceof Error &&
    /network request failed|failed to fetch|networkerror|internet connection|offline|timed out|connection/i.test(error.message);
}

function getRecipientDeviceNotReadyMessage(name: string): string {
  return `${name} needs to open Synzapp once before encrypted chat is available.`;
}

function getChatDeviceNotReadyMessage(chat: ChatItem): string {
  if (chat.chatType === 'GROUP') {
    return `Group members need to open Synzapp once before encrypted chat is available in ${chat.title}.`;
  }

  return getRecipientDeviceNotReadyMessage(chat.title);
}

function isRealtimeSessionVerificationError(message: string): boolean {
  return /realtime session could not be verified|secure session could not be verified/i.test(message);
}

function formatChatListTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMessageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;

  if (startOfMessageDay === startOfToday) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  if (startOfToday - startOfMessageDay === oneDayMs) {
    return 'Yesterday';
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatMessageTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatMessageDeliveryStatus(status: ChatDeliveryStatus | null): string {
  if (status === 'read') {
    return 'Seen';
  }

  if (status === 'delivered') {
    return 'Delivered';
  }

  if (status === 'sent') {
    return 'Sent';
  }

  if (status === 'queued') {
    return 'Queued';
  }

  return '';
}

function getCurrentUserReactionEmojis(
  reactions: ChatMessageReaction[] | undefined,
  currentUid: string
): string[] {
  const emojis = new Set<string>();

  reactions?.forEach((reaction) => {
    if (reaction.uid === currentUid && reaction.emoji.trim()) {
      emojis.add(reaction.emoji.trim());
    }
  });

  return [...emojis];
}

function formatMessageReactionBadge(reactions: ChatMessageReaction[] | undefined): string {
  if (!reactions?.length) {
    return '';
  }

  const reactionCounts = new Map<string, number>();

  reactions.forEach((reaction) => {
    const emoji = reaction.emoji.trim();

    if (!emoji) {
      return;
    }

    reactionCounts.set(emoji, (reactionCounts.get(emoji) || 0) + 1);
  });

  return [...reactionCounts.entries()]
    .map(([emoji, count]) => count > 1 ? `${emoji} ${count}` : emoji)
    .join(' ');
}

function extractReactionMapFromMessages(messages: ChatMessage[]): ChatMessageReactionMap {
  const reactionMap: ChatMessageReactionMap = {};

  messages.forEach((message) => {
    if (message.reactions?.length) {
      reactionMap[message.messageId] = sortMessageReactions(message.reactions);
    }
  });

  return reactionMap;
}

function applyReactionMapToMessages(
  messages: ChatMessage[],
  reactionMap: ChatMessageReactionMap
): ChatMessage[] {
  return messages.map((message) => ({
    ...message,
    reactions: reactionMap[message.messageId] || []
  }));
}

function upsertMessageReaction(
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

function sortMessageReactions(reactions: ChatMessageReaction[]): ChatMessageReaction[] {
  return [...reactions].sort((first, second) => first.reactedAt.localeCompare(second.reactedAt));
}

function buildReplyReference(message: ChatMessage): ChatReplyReference {
  return {
    messageId: message.messageId,
    senderUid: message.senderUid,
    sentAt: message.sentAt,
    text: formatReplyPreviewText(getChatMessagePreview(message)).slice(0, 500)
  };
}

function getReplyAuthorLabel(senderUid: string, currentUid: string, contactName: string): string {
  if (senderUid && currentUid && senderUid === currentUid) {
    return 'You';
  }

  return contactName || 'Message';
}

function buildLocalChatMediaAttachment(media: LocalChatMediaInput): ChatMediaAttachment {
  return {
    contentType: media.contentType,
    durationMs: media.durationMs,
    fileName: media.fileName,
    height: media.height,
    kind: media.kind,
    localUri: media.uri,
    sizeBytes: media.sizeBytes,
    transferProgress: 0,
    transferStatus: 'queued',
    width: media.width
  };
}

function getMessageMedia(message: ChatMessage): ChatMediaAttachment | null {
  return message.media || message.mediaItems?.[0] || message.image || null;
}

function getMessageMediaItems(message: ChatMessage): ChatMediaAttachment[] {
  if (Array.isArray(message.mediaItems) && message.mediaItems.length) {
    return message.mediaItems;
  }

  const media = getMessageMedia(message);

  return media ? [media] : [];
}

function mergeSyncedMessageWithPendingLocalMedia(
  syncedMessage: ChatMessage,
  pendingMessage: ChatMessage | null
): ChatMessage {
  if (!pendingMessage) {
    return syncedMessage;
  }

  const pendingMediaItems = getMessageMediaItems(pendingMessage);
  const nextMedia = syncedMessage.media
    ? mergeSyncedMediaWithPendingLocalMedia(syncedMessage.media, pendingMediaItems[0] || getMessageMedia(pendingMessage))
    : null;
  const nextMediaItems = Array.isArray(syncedMessage.mediaItems) && syncedMessage.mediaItems.length
    ? syncedMessage.mediaItems.map((media, index) => mergeSyncedMediaWithPendingLocalMedia(media, pendingMediaItems[index]))
    : [];

  return {
    ...syncedMessage,
    image: nextMedia?.kind === 'image'
      ? {
          ...nextMedia,
          contentType: 'image/jpeg',
          height: nextMedia.height || 1,
          kind: 'image',
          width: nextMedia.width || 1
        } as ChatImageAttachment
      : syncedMessage.image,
    media: nextMedia,
    mediaItems: nextMediaItems
  };
}

function mergeSyncedMediaWithPendingLocalMedia(
  syncedMedia: ChatMediaAttachment,
  pendingMedia?: ChatMediaAttachment | null
): ChatMediaAttachment {
  if (!pendingMedia?.localUri || pendingMedia.localUri.startsWith('data:')) {
    return syncedMedia;
  }

  const isSameMedia = Boolean(
    syncedMedia.mediaId && pendingMedia.mediaId && syncedMedia.mediaId === pendingMedia.mediaId
  ) || (
    syncedMedia.kind === pendingMedia.kind &&
    syncedMedia.fileName === pendingMedia.fileName &&
    syncedMedia.sizeBytes === pendingMedia.sizeBytes
  );

  if (!isSameMedia) {
    return syncedMedia;
  }

  return {
    ...syncedMedia,
    localUri: pendingMedia.localUri,
    transferProgress: 1,
    transferStatus: 'available'
  };
}

function getMediaLocalUri(media: ChatMediaAttachment | null): string {
  if (!media) {
    return '';
  }

  return media.localUri ||
    (typeof (media as ChatImageAttachment).dataUrl === 'string'
      ? (media as ChatImageAttachment).dataUrl || ''
      : '');
}

function isAudioAttachment(media: ChatMediaAttachment): boolean {
  const contentType = (media.contentType || '').trim().toLowerCase();

  if (contentType.startsWith('audio/')) {
    return true;
  }

  const extension = getReadableFileExtension(media.fileName).toLowerCase();

  return Boolean(extension && [
    'aac',
    'aif',
    'aiff',
    'amr',
    'flac',
    'm4a',
    'mp3',
    'oga',
    'ogg',
    'opus',
    'wav',
    'weba',
    'wma'
  ].includes(extension));
}

function isMediaTransferActive(media: ChatMediaAttachment): boolean {
  return media.transferStatus === 'queued' ||
    media.transferStatus === 'uploading' ||
    media.transferStatus === 'downloading';
}

function getMediaTransferLabel(media: ChatMediaAttachment): string {
  if (media.transferStatus === 'queued') {
    return 'Queued';
  }

  if (media.transferStatus === 'uploading') {
    return 'Sending';
  }

  if (media.transferStatus === 'downloading') {
    return 'Downloading';
  }

  if (media.transferStatus === 'failed') {
    return 'Failed';
  }

  return '';
}

function getMediaItemsTransferLabel(mediaItems: ChatMediaAttachment[]): string {
  if (!mediaItems.length) {
    return '';
  }

  if (mediaItems.some((media) => media.transferStatus === 'failed')) {
    return 'Failed';
  }

  if (mediaItems.some((media) => media.transferStatus === 'uploading')) {
    return 'Sending';
  }

  if (mediaItems.some((media) => media.transferStatus === 'downloading')) {
    return 'Downloading';
  }

  if (mediaItems.some((media) => media.transferStatus === 'queued')) {
    return 'Queued';
  }

  return '';
}

function getMediaItemsTransferProgress(mediaItems: ChatMediaAttachment[]): number {
  if (!mediaItems.length) {
    return 0;
  }

  const progressTotal = mediaItems.reduce((total, media) => total + Math.max(0, Math.min(media.transferProgress || 0, 1)), 0);

  return progressTotal / mediaItems.length;
}

function getMediaItemsSize(mediaItems: ChatMediaAttachment[]): number {
  return mediaItems.reduce((total, media) => total + Math.max(media.sizeBytes || 0, 0), 0);
}

function toLocalChatMediaInput(media: ChatMediaAttachment): LocalChatMediaInput {
  if (!media.localUri || media.localUri.startsWith('data:')) {
    throw new Error('This media is not available on this device yet.');
  }

  return {
    contentType: media.contentType,
    durationMs: media.durationMs,
    fileName: media.fileName,
    height: media.height,
    kind: media.kind,
    sizeBytes: media.sizeBytes,
    uri: media.localUri,
    width: media.width
  };
}

async function getLocalFileSize(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri);

  return info.exists && typeof info.size === 'number' ? Math.max(info.size, 0) : 0;
}

function getVoiceNoteContentType(uri: string): string {
  const extension = getUriExtension(uri);

  if (extension === '3gp') {
    return 'audio/3gpp';
  }

  if (extension === 'webm') {
    return 'audio/webm';
  }

  if (extension === 'wav') {
    return 'audio/wav';
  }

  if (extension === 'aac') {
    return 'audio/aac';
  }

  return 'audio/mp4';
}

function buildVoiceNoteFileName(uri: string): string {
  const extension = getUriExtension(uri) || (Platform.OS === 'android' ? '3gp' : 'm4a');
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .replace('Z', '');

  return `VOICE-${timestamp}.${extension}`;
}

function getUriExtension(uri: string): string {
  return (uri.split('?')[0] || '')
    .split('.')
    .pop()
    ?.replace(/[^A-Za-z0-9]/g, '')
    .toLowerCase() || '';
}

function buildVoiceNoteWaveform(media: ChatMediaAttachment): number[] {
  const seedSource = `${media.mediaId || media.fileName || 'voice'}_${media.sizeBytes || 0}`;
  let seed = 0;

  for (let index = 0; index < seedSource.length; index += 1) {
    seed = (seed + seedSource.charCodeAt(index) * (index + 1)) % 9973;
  }

  return Array.from({ length: 36 }, (_item, index) => {
    const value = Math.sin((seed + index * 29) * 0.17) + Math.cos((seed + index * 11) * 0.09);
    const normalized = Math.abs(value) / 2;

    return Math.max(6, Math.round(8 + normalized * 20));
  });
}

function safePauseAudioPlayer(player: { pause: () => void }): void {
  try {
    player.pause();
  } catch {
    // Expo may release the native shared object before React cleanup runs.
  }
}

function safeIsAudioRecorderRecording(recorder: { getStatus: () => { isRecording?: boolean } }): boolean {
  try {
    return recorder.getStatus().isRecording === true;
  } catch {
    return false;
  }
}

async function safeStopAudioRecorder(recorder: { stop: () => Promise<void> }): Promise<void> {
  try {
    await recorder.stop();
  } catch {
    // Expo may release the native recorder before cleanup or route changes finish.
  }
}

function safePlayAudioPlayer(player: { play: () => void }): void {
  try {
    player.play();
  } catch (error) {
    throw error instanceof Error ? error : new Error('Unable to play this audio.');
  }
}

function safeReplaceAudioPlayerSource(
  player: { replace: (source: { uri: string }) => void },
  uri: string
): void {
  try {
    player.replace({ uri });
  } catch (error) {
    throw error instanceof Error ? error : new Error('Unable to load this audio.');
  }
}

function getAudioSeekSeconds(locationX: number, width: number, durationSeconds: number): number {
  if (!width || !durationSeconds) {
    return 0;
  }

  const progress = Math.min(Math.max(locationX / width, 0), 1);

  return clampAudioSeconds(durationSeconds * progress, durationSeconds);
}

function clampAudioSeconds(valueSeconds: number, durationSeconds: number): number {
  return Math.min(Math.max(valueSeconds, 0), Math.max(durationSeconds, 0));
}

function formatMediaDuration(durationMs?: number): string {
  const safeDurationMs = Number.isFinite(durationMs) ? Math.max(durationMs || 0, 0) : 0;
  const totalSeconds = Math.round(safeDurationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatAudioSeconds(valueSeconds?: number): string {
  const safeSeconds = Number.isFinite(valueSeconds) ? Math.max(Math.floor(valueSeconds || 0), 0) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatByteCount(sizeBytes?: number): string {
  const safeSize = Number.isFinite(sizeBytes) ? Math.max(sizeBytes || 0, 0) : 0;

  if (safeSize >= 1024 * 1024) {
    return `${(safeSize / (1024 * 1024)).toFixed(safeSize >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }

  if (safeSize >= 1024) {
    return `${Math.round(safeSize / 1024)} KB`;
  }

  return `${Math.round(safeSize)} B`;
}

function formatAttachmentMeta(media: ChatMediaAttachment): string {
  const typeLabel = media.kind === 'audio'
    ? 'Voice note'
    : media.kind === 'video'
      ? 'Video'
      : getReadableFileExtension(media.fileName) || (isAudioAttachment(media) ? 'Audio' : 'File');

  return `${typeLabel} • ${formatByteCount(media.sizeBytes)}`;
}

function getReadableFileExtension(fileName?: string | null): string {
  const safeFileName = typeof fileName === 'string' ? fileName : '';
  const extension = safeFileName.split('.').pop()?.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  return extension && extension !== safeFileName.toUpperCase() ? extension : '';
}

function getChatMessagePreview(message: ChatMessage): string {
  const text = getChatMessageTextPreview(message);

  if (text) {
    return text;
  }

  const mediaItems = getMessageMediaItems(message);

  if (mediaItems.length > 1) {
    return `${mediaItems.length} items`;
  }

  const media = mediaItems[0] || getMessageMedia(message);

  if (!media) {
    return '';
  }

  if (media.kind === 'image') {
    return 'Photo';
  }

  if (media.kind === 'video') {
    return 'Video';
  }

  if (media.kind === 'audio') {
    return 'Voice message';
  }

  return media.fileName || 'File';
}

function getChatMessageTextPreview(message: ChatMessage): string {
  return (message.text || '').replace(/\s+/g, ' ').trim();
}

function formatReplyPreviewText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim() || 'Message';
}

function buildMessageThreadItems(messages: ChatMessage[]): MessageThreadItem[] {
  const items: MessageThreadItem[] = [];
  let activeDateKey = '';

  messages.forEach((message) => {
    const nextDateKey = getMessageDateKey(message.sentAt);

    if (nextDateKey && nextDateKey !== activeDateKey) {
      activeDateKey = nextDateKey;
      items.push({
        id: `date-${nextDateKey}`,
        label: formatMessageDate(message.sentAt),
        type: 'date'
      });
    }

    items.push({
      id: `message-${message.messageId}`,
      message,
      type: 'message'
    });
  });

  return items;
}

function getMessageDateKey(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatMessageDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
    year: 'numeric'
  });
}

async function cacheCurrentUserProfilePhoto(
  profile: CurrentUserProfile,
  idToken: string
): Promise<CurrentUserProfile> {
  const cachedPhotoUri = await getCachedProfilePhotoUri({
    cacheKey: profile.profilePhotoCacheKey,
    idToken,
    profilePhotoUrl: profile.profilePhotoUrl
  });

  return {
    ...profile,
    profilePhotoUrl: cachedPhotoUri
  };
}

async function cacheApprovedEmployeePhotos(
  employees: ApprovedEmployee[],
  idToken: string
): Promise<ApprovedEmployee[]> {
  return Promise.all(employees.map(async (employee) => ({
    ...employee,
    profilePhotoUrl: await getCachedProfilePhotoUri({
      cacheKey: employee.profilePhotoCacheKey,
      idToken,
      profilePhotoUrl: employee.profilePhotoUrl
    })
  })));
}

async function cacheChatContactPhotos(
  contacts: ChatContact[],
  idToken: string
): Promise<ChatContact[]> {
  return Promise.all(contacts.map((contact) => cacheChatContactPhoto(contact, idToken)));
}

async function cacheChatContactPhoto(
  contact: ChatContact,
  idToken: string
): Promise<ChatContact> {
  const [profilePhotoUrl, members] = await Promise.all([
    getCachedProfilePhotoUri({
      cacheKey: contact.profilePhotoCacheKey,
      idToken,
      profilePhotoUrl: contact.profilePhotoUrl
    }),
    contact.members
      ? cacheChatGroupMemberPhotos(contact.members, idToken)
      : Promise.resolve(contact.members)
  ]);

  return {
    ...contact,
    members,
    profilePhotoUrl
  };
}

async function cacheChatGroupMemberPhotos(
  members: ChatGroupMember[],
  idToken: string
): Promise<ChatGroupMember[]> {
  return Promise.all(members.map(async (member) => ({
    ...member,
    profilePhotoUrl: await getCachedProfilePhotoUri({
      cacheKey: member.profilePhotoCacheKey,
      idToken,
      profilePhotoUrl: member.profilePhotoUrl
    })
  })));
}

function mapApprovedEmployeeToListItem(employee: ApprovedEmployee): EmployeeListItem {
  const name = employee.displayName || employee.phoneMasked;
  const baseRole = employee.role || 'EMPLOYEE';

  return {
    baseRole,
    department: employee.departmentName,
    id: employee.approvedPhoneId,
    initials: getInitials(name),
    name,
    profilePhotoUrl: employee.profilePhotoUrl,
    role: baseRole === 'DEPT_ADMIN' ? `${employee.roleName} · Dept admin` : employee.roleName,
    roleId: employee.roleId,
    status: formatEmployeeStatus(employee.status),
    statusValue: employee.status
  };
}

function mapChatContactToChatItem(contact: ChatContact): ChatItem {
  return {
    chatType: contact.chatType === 'GROUP' ? 'GROUP' : 'DIRECT',
    contactId: contact.contactId,
    hasActiveDevice: contact.hasActiveDevice,
    id: `${contact.chatType === 'GROUP' ? 'group' : 'contact'}-${contact.contactId}`,
    isDepartmentDefault: contact.isDepartmentDefault === true,
    isOnline: contact.isOnline === true,
    lastMessageAt: contact.lastMessageAt,
    lastSeenAt: contact.lastSeenAt,
    memberCount: contact.memberCount,
    members: contact.members,
    memberPolicy: contact.memberPolicy,
    preview: contact.preview,
    profilePhotoUrl: contact.profilePhotoUrl,
    title: contact.displayName,
    unreadCount: contact.unreadCount || 0
  };
}

function isUserCreatedGroupChat(chat?: ChatItem | null): chat is ChatItem {
  return Boolean(chat && chat.chatType === 'GROUP' && chat.isDepartmentDefault !== true);
}

function mapGroupMembersToSelectableContacts(
  members: ChatGroupMember[],
  directContacts: ChatContact[],
  currentUid: string
): ChatContact[] {
  const directContactById = new Map(directContacts.map((contact) => [contact.contactId, contact]));

  return members
    .filter((member) => member.uid && member.uid !== currentUid)
    .map((member) => {
      const directContact = directContactById.get(member.uid);
      const isOnline = directContact?.isOnline === true;

      return {
        chatType: 'DIRECT',
        contactId: member.uid,
        conversationId: directContact?.conversationId || member.uid,
        displayName: member.displayName,
        hasActiveDevice: directContact?.hasActiveDevice !== false,
        initials: member.initials,
        isOnline,
        lastMessageAt: null,
        lastSeenAt: directContact?.lastSeenAt || null,
        preview: '',
        profilePhotoCacheKey: member.profilePhotoCacheKey || directContact?.profilePhotoCacheKey || null,
        profilePhotoUrl: member.profilePhotoUrl || directContact?.profilePhotoUrl || null,
        role: member.role,
        roleName: isOnline ? 'online' : member.roleName,
        status: 'ACTIVE',
        unreadCount: 0
      };
    });
}

function getOnlineGroupMemberCount(
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

function formatGroupOnlineCount(onlineCount: number): string {
  return onlineCount === 1 ? '1 online' : `${Math.max(onlineCount, 0)} online`;
}

function getGroupCallPeopleTitle(mode: GroupCallMode): string {
  if (mode === 'voice') {
    return 'Voice call';
  }

  if (mode === 'video') {
    return 'Video call';
  }

  return 'Select people';
}

function filterChatItems(chats: ChatItem[], search: string): ChatItem[] {
  const query = normalizeSearchQuery(search);

  if (!query) {
    return chats;
  }

  return chats.filter((chat) =>
    normalizeSearchQuery(`${chat.title} ${chat.preview}`).includes(query)
  );
}

function filterChatContacts(contacts: ChatContact[], search: string): ChatContact[] {
  const query = normalizeSearchQuery(search);

  if (!query) {
    return contacts;
  }

  return contacts.filter((contact) =>
    normalizeSearchQuery(`${contact.displayName} ${contact.roleName}`).includes(query)
  );
}

function normalizeSearchQuery(value: string): string {
  return value.trim().toLowerCase();
}

function getFullScreenModalTopPadding(topInset: number): number {
  const androidStatusBarHeight = Platform.OS === 'android' ? RNStatusBar.currentHeight || 0 : 0;
  const deviceTopInset = Math.max(topInset, androidStatusBarHeight);

  return Platform.OS === 'android'
    ? Math.max(deviceTopInset + 10, 38)
    : Math.max(deviceTopInset + 8, 22);
}

function getNativeFullHeightModalPresentationStyle(): 'fullScreen' | 'pageSheet' {
  return Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen';
}

function applyLocalChatPreview(contact: ChatContact, messages: ChatMessage[]): ChatContact {
  const localMessages = uniqueChatMessages(messages);
  const latestMessage = localMessages.at(-1);
  const receivedPreview = getReceivedChatTextPreview(localMessages);

  if (!latestMessage && !receivedPreview) {
    return contact;
  }

  const lastMessageAt = latestMessage &&
    (!contact.lastMessageAt || latestMessage.sentAt > contact.lastMessageAt)
    ? latestMessage.sentAt
    : contact.lastMessageAt;

  return {
    ...contact,
    lastMessageAt,
    preview: receivedPreview || contact.preview
  };
}

function getReceivedChatTextPreview(messages: ChatMessage[]): string {
  return messages
    .filter((message) => !message.isMine)
    .map(getChatMessageTextPreview)
    .filter(Boolean)
    .slice(-2)
    .join('\n');
}

function buildLocalChatContactsFromCachedConversations(
  cachedConversations: LocalConversationRecord[],
  pendingMessages: PendingChatMessage[]
): ChatContact[] {
  const cachedContacts = cachedConversations
    .map((conversation) => conversation.contact)
    .filter((contact): contact is ChatContact => Boolean(contact?.contactId));

  if (!cachedContacts.length) {
    return [];
  }

  return applyLocalChatPreviewsToContacts(cachedContacts, cachedConversations, pendingMessages);
}

function applyLocalChatPreviewsToContacts(
  contacts: ChatContact[],
  cachedConversations: LocalConversationRecord[],
  pendingMessages: PendingChatMessage[]
): ChatContact[] {
  const cachedConversationByContactId = new Map<string, LocalConversationRecord>();
  const pendingMessagesByContactId = new Map<string, ChatMessage[]>();

  cachedConversations.forEach((conversation) => {
    cachedConversationByContactId.set(conversation.contactId, conversation);
  });

  pendingMessages.forEach((pendingMessage) => {
    const currentMessages = pendingMessagesByContactId.get(pendingMessage.contactId) || [];

    pendingMessagesByContactId.set(pendingMessage.contactId, [...currentMessages, pendingMessage.message]);
  });

  return sortChatContacts(contacts.map((contact) => {
    const cachedConversation = cachedConversationByContactId.get(contact.contactId);
    const localMessages = [
      ...(cachedConversation?.messages || []),
      ...(pendingMessagesByContactId.get(contact.contactId) || [])
    ];

    return applyLocalChatPreview(contact, localMessages);
  }));
}

function mergeLoadedChatContactsWithVisibleState(
  currentContacts: ChatContact[],
  loadedContacts: ChatContact[]
): ChatContact[] {
  const currentContactById = new Map(currentContacts.map((contact) => [contact.contactId, contact]));

  return sortChatContacts(loadedContacts.map((loadedContact) => {
    const currentContact = currentContactById.get(loadedContact.contactId);

    return mergeChatContactVisibleState(currentContact, loadedContact);
  }));
}

function mergeChatContactVisibleState(
  currentContact: ChatContact | undefined,
  nextContact: ChatContact
): ChatContact {
  const mergedContact = mergeChatContactCachedPhoto(currentContact, nextContact);

  if (!currentContact) {
    return mergedContact;
  }

  const currentPreview = currentContact.preview?.trim() || '';
  const nextPreview = mergedContact.preview?.trim() || '';

  if (
    currentContact.lastMessageAt &&
    (!mergedContact.lastMessageAt || currentContact.lastMessageAt > mergedContact.lastMessageAt)
  ) {
    return {
      ...mergedContact,
      lastMessageAt: currentContact.lastMessageAt,
      preview: currentContact.preview,
      unreadCount: currentContact.unreadCount
    };
  }

  if (!currentPreview) {
    return mergedContact;
  }

  if (!nextPreview) {
    return {
      ...mergedContact,
      preview: currentContact.preview
    };
  }

  return mergedContact;
}

function mergeChatContactCachedPhoto(
  currentContact: ChatContact | undefined,
  nextContact: ChatContact
): ChatContact {
  if (
    currentContact?.profilePhotoCacheKey &&
    currentContact.profilePhotoCacheKey === nextContact.profilePhotoCacheKey &&
    currentContact.profilePhotoUrl?.startsWith('file:')
  ) {
    return {
      ...nextContact,
      profilePhotoUrl: currentContact.profilePhotoUrl
    };
  }

  return nextContact;
}

function upsertChatContact(currentContacts: ChatContact[], nextContact: ChatContact): ChatContact[] {
  const contactById = new Map<string, ChatContact>();

  currentContacts.forEach((contact) => {
    contactById.set(contact.contactId, contact);
  });
  contactById.set(
    nextContact.contactId,
    mergeChatContactVisibleState(contactById.get(nextContact.contactId), nextContact)
  );

  return sortChatContacts([...contactById.values()]);
}

function sortChatContacts(contacts: ChatContact[]): ChatContact[] {
  return [...contacts].sort(compareChatContacts);
}

function compareChatContacts(first: ChatContact, second: ChatContact): number {
  if (first.lastMessageAt && second.lastMessageAt) {
    return second.lastMessageAt.localeCompare(first.lastMessageAt);
  }

  if (first.lastMessageAt) {
    return -1;
  }

  if (second.lastMessageAt) {
    return 1;
  }

  return first.displayName.localeCompare(second.displayName);
}

function uniqueChatMessages(messages: ChatMessage[]): ChatMessage[] {
  const messageById = new Map<string, ChatMessage>();

  messages.forEach((message) => {
    const existingMessage = messageById.get(message.messageId);

    messageById.set(message.messageId, mergeChatMessageWithLocalState(existingMessage, message));
  });

  return [...messageById.values()].sort((first, second) =>
    first.sentAt.localeCompare(second.sentAt)
  );
}

function mergeChatMessageWithLocalState(
  existingMessage: ChatMessage | undefined,
  nextMessage: ChatMessage
): ChatMessage {
  if (!existingMessage) {
    return nextMessage;
  }

  const mediaItems = mergeChatMessageMediaItems(
    getMessageMediaItems(existingMessage),
    getMessageMediaItems(nextMessage)
  );
  const media = mergeChatMessageMedia(
    getMessageMedia(existingMessage),
    getMessageMedia(nextMessage)
  ) || mediaItems[0] || null;
  const image = media?.kind === 'image'
    ? toChatImageAttachment(media)
    : null;

  return {
    ...existingMessage,
    ...nextMessage,
    image,
    media,
    mediaItems,
    reactions: Array.isArray(nextMessage.reactions)
      ? nextMessage.reactions
      : existingMessage.reactions || nextMessage.reactions || []
  };
}

function mergeChatMessageMediaItems(
  existingMediaItems: ChatMediaAttachment[],
  nextMediaItems: ChatMediaAttachment[]
): ChatMediaAttachment[] {
  if (!existingMediaItems.length && !nextMediaItems.length) {
    return [];
  }

  const longestLength = Math.max(existingMediaItems.length, nextMediaItems.length);
  const mergedItems: ChatMediaAttachment[] = [];

  for (let index = 0; index < longestLength; index += 1) {
    const mergedMedia = mergeChatMessageMedia(existingMediaItems[index] || null, nextMediaItems[index] || null);

    if (mergedMedia) {
      mergedItems.push(mergedMedia);
    }
  }

  return mergedItems;
}

function mergeChatMessageMedia(
  existingMedia: ChatMediaAttachment | null,
  nextMedia: ChatMediaAttachment | null
): ChatMediaAttachment | null {
  if (!existingMedia && !nextMedia) {
    return null;
  }

  const existingLocalUri = getMediaLocalUri(existingMedia);
  const nextLocalUri = getMediaLocalUri(nextMedia);
  const localUri = nextLocalUri || existingLocalUri || undefined;
  const mergedMedia: ChatMediaAttachment = {
    ...(existingMedia || {}),
    ...(nextMedia || {}),
    localUri
  } as ChatMediaAttachment;

  if (existingLocalUri && !nextLocalUri) {
    mergedMedia.transferStatus = existingMedia?.transferStatus === 'failed'
      ? 'failed'
      : existingMedia?.transferStatus === 'uploading' || existingMedia?.transferStatus === 'queued'
        ? existingMedia.transferStatus
        : 'available';
    mergedMedia.transferProgress = mergedMedia.transferStatus === 'available'
      ? 1
      : existingMedia?.transferProgress;
  } else if (localUri && !mergedMedia.transferStatus && mergedMedia.mediaId) {
    mergedMedia.transferStatus = 'available';
    mergedMedia.transferProgress = 1;
  }

  return mergedMedia;
}

function toChatImageAttachment(media: ChatMediaAttachment): ChatImageAttachment {
  return {
    ...media,
    contentType: 'image/jpeg',
    height: media.height || 1,
    kind: 'image',
    width: media.width || 1
  };
}

function applyMediaUpdateToMessage(
  message: ChatMessage,
  media: ChatMediaAttachment,
  mediaIndex?: number
): ChatMessage {
  const currentMediaItems = getMessageMediaItems(message);

  if (typeof mediaIndex === 'number' && currentMediaItems.length > 1) {
    const nextMediaItems = currentMediaItems.map((mediaItem, index) =>
      index === mediaIndex ? media : mediaItem
    );
    const primaryMedia = nextMediaItems[0] || media;

    return {
      ...message,
      image: primaryMedia.kind === 'image' ? toChatImageAttachment(primaryMedia) : null,
      media: primaryMedia,
      mediaItems: nextMediaItems
    };
  }

  return {
    ...message,
    image: media.kind === 'image' ? toChatImageAttachment(media) : null,
    media,
    mediaItems: currentMediaItems.length > 1 ? currentMediaItems : []
  };
}

function sortApprovedEmployees(employees: ApprovedEmployee[]): ApprovedEmployee[] {
  return [...employees].sort((first, second) => {
    const firstName = first.displayName || first.phoneMasked;
    const secondName = second.displayName || second.phoneMasked;

    return firstName.localeCompare(secondName);
  });
}

function upsertApprovedEmployees(
  currentEmployees: ApprovedEmployee[],
  nextEmployees: ApprovedEmployee[]
): ApprovedEmployee[] {
  const employeeById = new Map<string, ApprovedEmployee>();

  currentEmployees.forEach((employee) => {
    employeeById.set(employee.approvedPhoneId, employee);
  });

  nextEmployees.forEach((employee) => {
    employeeById.set(employee.approvedPhoneId, employee);
  });

  return [...employeeById.values()];
}

function getInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      const firstLetter = /[A-Za-z]/.exec(part)?.[0];
      return firstLetter || part[0];
    })
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return initials || '?';
}

function formatEmployeeStatus(status: string): string {
  if (status === 'INVITED') {
    return 'Invited';
  }

  if (status === 'ACTIVE') {
    return 'Active';
  }

  if (status === 'DEACTIVATED') {
    return 'Deactivated';
  }

  if (status === 'SUSPENDED') {
    return 'Suspended';
  }

  if (status === 'ARCHIVED') {
    return 'Archived';
  }

  if (status === 'DELETED') {
    return 'Deleted';
  }

  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function formatSettingValue(value: string): string {
  return value
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ') || 'Not set';
}

function getContactDisplayName(contact: Contacts.ExistingContact): string | undefined {
  const displayName = contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(' ');
  return displayName.trim() || undefined;
}

async function getContactWithPhoneNumbers(
  contact: Contacts.ExistingContact
): Promise<Contacts.ExistingContact> {
  if (contact.phoneNumbers?.length) {
    return contact;
  }

  const contactWithPhoneNumbers = await Contacts.getContactByIdAsync(contact.id, [
    Contacts.Fields.Name,
    Contacts.Fields.FirstName,
    Contacts.Fields.LastName,
    Contacts.Fields.PhoneNumbers
  ]);

  return contactWithPhoneNumbers || contact;
}

async function loadBatchContactCandidates(): Promise<BatchContactCandidate[]> {
  const contactsAvailable = await Contacts.isAvailableAsync();

  if (!contactsAvailable) {
    throw new Error('Contacts are not available on this device.');
  }

  const permission = await Contacts.requestPermissionsAsync();

  if (permission.status !== 'granted') {
    throw new Error('Contact permission is required for batch import.');
  }

  const response = await Contacts.getContactsAsync({
    fields: [
      Contacts.Fields.Name,
      Contacts.Fields.FirstName,
      Contacts.Fields.LastName,
      Contacts.Fields.PhoneNumbers
    ],
    pageSize: 5000
  });
  const candidateByPhoneNumber = new Map<string, BatchContactCandidate>();

  response.data.forEach((contact) => {
    const displayName = getContactDisplayName(contact) || 'Unnamed contact';

    (contact.phoneNumbers || []).forEach((phoneNumber, index) => {
      const normalizedPhoneNumber = normalizeContactPhoneNumber(phoneNumber);

      if (!normalizedPhoneNumber || candidateByPhoneNumber.has(normalizedPhoneNumber)) {
        return;
      }

      const phoneMasked = maskLocalPhoneNumber(normalizedPhoneNumber);
      const label = phoneNumber.label ? `${phoneNumber.label}: ` : '';

      candidateByPhoneNumber.set(normalizedPhoneNumber, {
        displayName,
        id: `${contact.id}-${phoneNumber.id || index}-${normalizedPhoneNumber}`,
        phoneMasked,
        phoneNumber: normalizedPhoneNumber,
        subtitle: `${label}${phoneMasked}`
      });
    });
  });

  return [...candidateByPhoneNumber.values()].sort((first, second) =>
    first.displayName.localeCompare(second.displayName)
  );
}

function normalizeContactPhoneNumber(phoneNumber: Contacts.PhoneNumber): string | null {
  const rawPhoneNumber = (phoneNumber.number || phoneNumber.digits || '').trim();

  if (!rawPhoneNumber) {
    return null;
  }

  const digits = rawPhoneNumber.replace(/\D/g, '');

  if (rawPhoneNumber.startsWith('+')) {
    return validateE164Phone(`+${digits}`);
  }

  const countryCode = phoneNumber.countryCode?.toLowerCase();

  if (countryCode === 'us' || countryCode === 'ca') {
    return normalizeNanpPhone(digits);
  }

  if (countryCode === 'mx') {
    return normalizeCountryPhone(digits, '52', 10);
  }

  if (countryCode === 'gb' || countryCode === 'uk') {
    const ukDigits = digits.startsWith('44')
      ? digits.slice(2)
      : digits.startsWith('0')
        ? digits.slice(1)
        : digits;

    return validateE164Phone(`+44${ukDigits}`);
  }

  if (digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))) {
    return normalizeNanpPhone(digits);
  }

  return null;
}

function normalizeManualInvitePhoneNumber(rawPhoneNumber: string): string | null {
  const trimmedPhoneNumber = rawPhoneNumber.trim();

  if (!trimmedPhoneNumber) {
    return null;
  }

  const digits = trimmedPhoneNumber.replace(/\D/g, '');

  if (!digits) {
    return null;
  }

  if (trimmedPhoneNumber.startsWith('+')) {
    return validateE164Phone(`+${digits}`);
  }

  if (digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))) {
    return normalizeNanpPhone(digits);
  }

  return validateE164Phone(`+${digits}`);
}

function normalizeNanpPhone(digits: string): string | null {
  if (digits.length === 10) {
    return validateE164Phone(`+1${digits}`);
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return validateE164Phone(`+${digits}`);
  }

  return null;
}

function normalizeCountryPhone(digits: string, dialCode: string, nationalLength: number): string | null {
  if (digits.length === nationalLength) {
    return validateE164Phone(`+${dialCode}${digits}`);
  }

  if (digits.startsWith(dialCode)) {
    return validateE164Phone(`+${digits}`);
  }

  return null;
}

function validateE164Phone(phoneNumber: string): string | null {
  return /^\+[1-9]\d{6,14}$/.test(phoneNumber) ? phoneNumber : null;
}

function maskLocalPhoneNumber(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, '');
  const lastFourDigits = digits.slice(-4);

  return lastFourDigits ? `*****${lastFourDigits}` : '*****';
}

function selectPhoneNumber(
  contactName: string,
  phoneNumbers: Contacts.PhoneNumber[]
): Promise<Contacts.PhoneNumber | null> {
  return selectNativeOption(
    `Select number for ${contactName}`,
    phoneNumbers,
    formatPhoneNumberOption
  );
}

function formatPhoneNumberOption(phoneNumber: Contacts.PhoneNumber): string {
  const label = phoneNumber.label ? `${phoneNumber.label}: ` : '';
  return `${label}${phoneNumber.number || phoneNumber.digits || 'Phone'}`;
}

function selectNativeOption<T>(
  title: string,
  options: T[],
  getLabel: (option: T) => string
): Promise<T | null> {
  return new Promise((resolve) => {
    let hasResolved = false;
    const resolveOnce = (value: T | null) => {
      if (hasResolved) {
        return;
      }

      hasResolved = true;
      resolve(value);
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          cancelButtonIndex: options.length,
          options: [...options.map(getLabel), 'Cancel'],
          title
        },
        (buttonIndex) => {
          if (buttonIndex === options.length) {
            resolveOnce(null);
            return;
          }

          resolveOnce(options[buttonIndex] || null);
        }
      );
      return;
    }

    Alert.alert(
      title,
      undefined,
      [
        ...options.map((option) => ({
          onPress: () => resolveOnce(option),
          text: getLabel(option)
        })),
        {
          onPress: () => resolveOnce(null),
          style: 'cancel' as const,
          text: 'Cancel'
        }
      ],
      { onDismiss: () => resolveOnce(null) }
    );
  });
}

function waitForNativeTransition(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 350);
  });
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#FFFFFF',
    flex: 1,
    overflow: 'hidden',
    paddingBottom: 98,
    paddingHorizontal: 10,
    paddingTop: 8,
    position: 'relative'
  },
  topActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 38
  },
  rightActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18
  },
  chatSearchBox: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    marginBottom: 8,
    paddingHorizontal: 12
  },
  chatSearchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    minHeight: 40,
    paddingVertical: 7
  },
  messageHeader: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 0,
    flexDirection: 'row',
    gap: 9,
    marginHorizontal: -10,
    minHeight: 66,
    paddingHorizontal: 8
  },
  forwardSelectionHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: -10,
    minHeight: 54,
    paddingHorizontal: 12
  },
  forwardSelectionTitleRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minWidth: 0
  },
  forwardSelectionTitleText: {
    flex: 1,
    minWidth: 0
  },
  forwardSelectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  forwardSelectionSubtitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 17
  },
  forwardSelectionActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  forwardSelectionActionButton: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  forwardSelectionCloseButton: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  messageBackButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 34
  },
  messageBackText: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '400',
    lineHeight: 43
  },
  messageHeaderIdentity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 9,
    minHeight: 54,
    minWidth: 0
  },
  messageHeaderText: {
    flex: 1,
    minWidth: 0
  },
  messageHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  messageHeaderPresence: {
    color: 'rgba(255, 255, 255, 0.86)',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 15,
    marginTop: -1
  },
  messageHeaderActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5
  },
  messageHeaderIcon: {
    alignItems: 'center',
    height: 46,
    justifyContent: 'center',
    minWidth: 40
  },
  messageHeaderVideoIcon: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 1,
    justifyContent: 'center',
    minWidth: 34
  },
  roundIconButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34
  },
  iconButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28
  },
  youHeaderButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    elevation: 3,
    height: 40,
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    width: 40
  },
  employeeTopActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  inviteButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 15,
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: 14
  },
  inviteButtonSecondary: {
    alignItems: 'center',
    borderColor: '#D7DEE8',
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: 12
  },
  inviteButtonSecondaryText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  inviteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  youContent: {
    paddingTop: 8
  },
  youLoading: {
    alignItems: 'center',
    minHeight: 240,
    justifyContent: 'center'
  },
  youHero: {
    alignItems: 'center',
    minHeight: 190,
    justifyContent: 'center',
    paddingBottom: 20,
    paddingTop: 12
  },
  youAvatarButton: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  youAvatarAddBadge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    bottom: 4,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 2,
    width: 24
  },
  youAvatarAddText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '400',
    lineHeight: 21
  },
  youName: {
    color: '#111827',
    fontSize: 25,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 32,
    marginTop: 14,
    maxWidth: '88%',
    textAlign: 'center'
  },
  youPhotoAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 14
  },
  youPhotoActionText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  youDetails: {
    paddingTop: 8
  },
  profileDetailRow: {
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 54,
    paddingVertical: 10
  },
  profileDetailLabel: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    width: 96
  },
  profileDetailValue: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  backButton: {
    alignItems: 'flex-start',
    height: 34,
    justifyContent: 'center',
    width: 44
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 32,
    fontWeight: '400',
    lineHeight: 35
  },
  filterButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 44
  },
  title: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 33,
    marginBottom: 3
  },
  directoryTitle: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21,
    marginBottom: 2
  },
  noticeWrap: {
    marginBottom: 8
  },
  tabScroll: {
    flex: 1,
    marginTop: 4
  },
  tabContent: {
    paddingBottom: 92
  },
  messageScreen: {
    backgroundColor: '#ECE5DD',
    flex: 1,
    marginHorizontal: -10,
    marginTop: 0,
    position: 'relative'
  },
  messageList: {
    flex: 1
  },
  messageListContent: {
    gap: 6,
    paddingBottom: 12,
    paddingHorizontal: 10,
    paddingTop: 12
  },
  messageLoadingRow: {
    alignItems: 'center',
    minHeight: 42,
    justifyContent: 'center'
  },
  scrollToLatestButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 21,
    elevation: 5,
    height: 42,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    shadowColor: '#0F172A',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    width: 42,
    zIndex: 8
  },
  scrollToLatestBadge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: '#FFFFFF',
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 22,
    minWidth: 22,
    paddingHorizontal: 5,
    position: 'absolute',
    right: -4,
    top: -8
  },
  scrollToLatestBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 14
  },
  messageDateRow: {
    alignItems: 'center',
    marginVertical: 7
  },
  messageDateText: {
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    borderRadius: 8,
    color: '#475569',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  messageBubbleSelectableRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 30,
    overflow: 'visible'
  },
  messageBubbleSelectableRowActive: {
    paddingLeft: 2
  },
  messageBubbleSelectableContent: {
    flex: 1,
    minWidth: 0,
    overflow: 'visible',
    position: 'relative'
  },
  forwardSelectCircleButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 28
  },
  forwardSelectCircle: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderColor: '#CBD5E1',
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    width: 20
  },
  forwardSelectCircleSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  messageBubbleRow: {
    alignItems: 'flex-end',
    flexDirection: 'row'
  },
  messageBubbleRowMine: {
    justifyContent: 'flex-end'
  },
  messageBubbleRowTheirs: {
    justifyContent: 'flex-start'
  },
  messageBubbleRowWithReaction: {
    marginBottom: 14
  },
  messageBubbleMotionWrap: {
    maxWidth: '82%',
    minWidth: 104
  },
  messageBubbleMotionWrapWithGroupAvatar: {
    maxWidth: '74%'
  },
  groupMessageAvatarFallback: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 14,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28
  },
  groupMessageAvatarImage: {
    alignSelf: 'flex-end',
    backgroundColor: '#D7DEE8',
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 14,
    borderWidth: 1,
    height: 28,
    width: 28
  },
  groupMessageAvatarLeft: {
    marginRight: 6
  },
  groupMessageAvatarRight: {
    marginLeft: 6
  },
  groupMessageAvatarText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 13
  },
  messageBubbleMotionWrapRich: {
    minWidth: 148
  },
  messageBubble: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    position: 'relative'
  },
  messageBubbleWithImage: {
    paddingHorizontal: 3,
    paddingTop: 3
  },
  messageSwipeReplyCue: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    top: 6,
    width: 32
  },
  messageSwipeReplyCueMine: {
    right: 10
  },
  messageSwipeReplyCueTheirs: {
    left: 10
  },
  forwardedMessageLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    marginBottom: 3
  },
  forwardedMessageLabel: {
    color: '#64748B',
    fontSize: 13,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 17
  },
  bubbleReplyPreview: {
    alignSelf: 'flex-start',
    borderRadius: 7,
    flexDirection: 'row',
    marginBottom: 5,
    minHeight: 44,
    minWidth: 132,
    overflow: 'hidden'
  },
  bubbleReplyPreviewMine: {
    backgroundColor: 'rgba(173, 238, 164, 0.72)'
  },
  bubbleReplyPreviewTheirs: {
    backgroundColor: '#F1F5F9'
  },
  bubbleReplyAccent: {
    width: 4
  },
  bubbleReplyAccentMine: {
    backgroundColor: '#F43F5E'
  },
  bubbleReplyAccentTheirs: {
    backgroundColor: colors.primary
  },
  bubbleReplyTextWrap: {
    flexShrink: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  bubbleReplyAuthor: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18
  },
  bubbleReplyText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18
  },
  replyAuthorMine: {
    color: '#C026D3'
  },
  replyAuthorTheirs: {
    color: colors.primary
  },
  messageBubblePressed: {
    opacity: 0.88
  },
  messageBubbleHighlighted: {
    borderColor: '#25D366',
    borderWidth: 1.5,
    shadowColor: '#25D366',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 7
  },
  messageBubbleMine: {
    backgroundColor: '#D9FDD3'
  },
  messageBubbleTheirs: {
    backgroundColor: '#FFFFFF'
  },
  messageBubbleTail: {
    bottom: 0,
    height: 0,
    position: 'absolute',
    width: 0
  },
  messageBubbleTailMine: {
    borderRightColor: 'transparent',
    borderRightWidth: 12,
    borderTopColor: '#D9FDD3',
    borderTopWidth: 15,
    right: -9
  },
  messageBubbleTailTheirs: {
    borderLeftColor: 'transparent',
    borderLeftWidth: 12,
    borderTopColor: '#FFFFFF',
    borderTopWidth: 15,
    left: -9
  },
  messageBubbleText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20
  },
  messageBubbleCaptionText: {
    paddingHorizontal: 6,
    paddingTop: 5
  },
  messageBubbleImage: {
    backgroundColor: '#E2E8F0',
    borderRadius: 7,
    height: '100%',
    width: '100%'
  },
  messageBubbleMediaFrame: {
    backgroundColor: '#E2E8F0',
    borderRadius: 7,
    overflow: 'hidden',
    position: 'relative'
  },
  messageAlbumFrame: {
    backgroundColor: '#E2E8F0',
    borderRadius: 7,
    overflow: 'hidden',
    position: 'relative'
  },
  messageAlbumTile: {
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    position: 'absolute'
  },
  messageAlbumVideoBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.68)',
    borderRadius: 10,
    bottom: 6,
    flexDirection: 'row',
    gap: 4,
    left: 6,
    minHeight: 20,
    paddingHorizontal: 6,
    position: 'absolute'
  },
  messageAlbumVideoText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 14
  },
  messageAlbumMoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.52)',
    justifyContent: 'center'
  },
  messageAlbumMoreText: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '400',
    lineHeight: 32
  },
  messageBubbleMediaPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
    flex: 1,
    justifyContent: 'center'
  },
  messageMediaProgressOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    justifyContent: 'center'
  },
  messageMediaProgressCircle: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    borderColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 25,
    borderWidth: 1.4,
    height: 50,
    justifyContent: 'center',
    width: 50
  },
  messageMediaProgressPercent: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '400',
    lineHeight: 13,
    marginTop: 1
  },
  messageMediaProgressLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    marginTop: 6
  },
  messageAlbumProgressPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 24,
    elevation: 3,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    minWidth: 132,
    paddingHorizontal: 14,
    shadowColor: '#0F172A',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 5
  },
  messageAlbumProgressTitle: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 16
  },
  messageAlbumProgressSubtitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 14
  },
  messageAttachmentCard: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 9,
    minWidth: 206,
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  messageAttachmentCardMine: {
    backgroundColor: 'rgba(173, 238, 164, 0.64)'
  },
  messageAttachmentCardTheirs: {
    backgroundColor: '#F1F5F9'
  },
  messageAttachmentIcon: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  messageAttachmentText: {
    flex: 1,
    minWidth: 0
  },
  messageAttachmentName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18
  },
  messageAttachmentMeta: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    marginTop: 1
  },
  messageVoiceNoteCard: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 9,
    minWidth: 282,
    paddingHorizontal: 8,
    paddingVertical: 7
  },
  messageVoiceNotePlayButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  messageVoiceNotePlayButtonMine: {
    backgroundColor: 'rgba(255, 255, 255, 0.86)'
  },
  messageVoiceNotePlayButtonTheirs: {
    backgroundColor: '#FFFFFF'
  },
  messageVoiceNoteBody: {
    flex: 1,
    minWidth: 0
  },
  messageVoiceWaveformRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    height: 28,
    minWidth: 0,
    width: '100%'
  },
  messageVoiceWaveformBar: {
    borderRadius: 2,
    width: 3
  },
  messageVoiceNoteMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 1
  },
  messageVoiceNoteMetaDot: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 15
  },
  messageBubbleMetaRow: {
    alignSelf: 'flex-end',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 2
  },
  messageBubbleTime: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 15
  },
  messageBubbleStatus: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 15
  },
  messageBubbleStatusDelivered: {
    color: '#F97316'
  },
  messageBubbleStatusQueued: {
    color: '#DC2626'
  },
  messageBubbleStatusRead: {
    color: '#2563EB'
  },
  messageReactionBadge: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    bottom: -16,
    elevation: 2,
    minWidth: 28,
    paddingHorizontal: 7,
    paddingVertical: 2,
    position: 'absolute',
    shadowColor: '#0F172A',
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 3
  },
  messageReactionBadgeMine: {
    right: 8
  },
  messageReactionBadgeTheirs: {
    left: 8
  },
  messageReactionText: {
    fontSize: 15,
    lineHeight: 19
  },
  messageActionOverlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.12)',
    flex: 1
  },
  messageActionDismiss: {
    ...StyleSheet.absoluteFillObject
  },
  messageActionContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18
  },
  messageActionStack: {
    gap: 10,
    maxWidth: 292
  },
  messageActionStackMine: {
    alignItems: 'flex-end',
    alignSelf: 'flex-end'
  },
  messageActionStackTheirs: {
    alignItems: 'flex-start',
    alignSelf: 'flex-start'
  },
  messageReactionStrip: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    elevation: 8,
    height: 42,
    maxWidth: '100%',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: '#0F172A',
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16
  },
  messageReactionStripScroll: {
    flexGrow: 0,
    height: 30,
    maxHeight: 30
  },
  messageReactionStripContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    height: 30
  },
  messageReactionButton: {
    alignItems: 'center',
    borderRadius: 16,
    height: 30,
    justifyContent: 'center',
    width: 30
  },
  messageReactionButtonActive: {
    backgroundColor: '#E0F2FE'
  },
  messageReactionButtonPressed: {
    backgroundColor: '#DDF6EF'
  },
  messageReactionButtonText: {
    fontSize: 23,
    lineHeight: 29
  },
  messageReactionMoreButton: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30
  },
  messageActionBubbleWrap: {
    alignSelf: 'stretch'
  },
  messageActionMenu: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 22,
    elevation: 10,
    minWidth: 190,
    overflow: 'hidden',
    paddingVertical: 8,
    shadowColor: '#0F172A',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 20
  },
  emojiKeyboardContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24
  },
  emojiKeyboardHeader: {
    color: '#7A8494',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18
  },
  emojiKeyboardSelectedEmoji: {
    backgroundColor: '#DDF6EF'
  },
  emojiKeyboardKnob: {
    backgroundColor: '#A8B0BC'
  },
  emojiKeyboardSearchContainer: {
    backgroundColor: '#F8FAFC',
    borderColor: 'transparent',
    minHeight: 38
  },
  emojiKeyboardSearchText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '400'
  },
  emojiKeyboardCategoryContainer: {
    borderRadius: 18
  },
  emojiKeyboardCategoryIcon: {
    fontWeight: '400'
  },
  messageActionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
    minHeight: 44,
    paddingHorizontal: 18
  },
  messageActionRowPressed: {
    backgroundColor: '#F8FAFC'
  },
  messageActionLabel: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  messageActionLabelDestructive: {
    color: '#E11D48'
  },
  messageActionSeparator: {
    backgroundColor: '#E5E7EB',
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 18,
    marginVertical: 5
  },
  forwardRecipientOverlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.22)',
    flex: 1,
    justifyContent: 'flex-end'
  },
  forwardRecipientBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  forwardRecipientSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '76%',
    minHeight: 360,
    paddingBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { height: -6, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18
  },
  forwardRecipientHeader: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingLeft: 18,
    paddingRight: 10
  },
  forwardRecipientTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '400',
    lineHeight: 25
  },
  forwardRecipientCloseButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  forwardRecipientList: {
    flexGrow: 0
  },
  forwardRecipientRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 66,
    paddingHorizontal: 18,
    paddingVertical: 8
  },
  forwardRecipientRowDisabled: {
    opacity: 0.56
  },
  forwardRecipientText: {
    flex: 1,
    minWidth: 0
  },
  forwardRecipientName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  forwardRecipientSubtitle: {
    color: '#8B95A5',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18
  },
  forwardRecipientCheck: {
    alignItems: 'center',
    borderColor: '#CBD5E1',
    borderRadius: 11,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22
  },
  forwardRecipientCheckSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  forwardRecipientFooter: {
    alignItems: 'center',
    borderTopColor: '#E5E7EB',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12
  },
  forwardRecipientCount: {
    color: '#64748B',
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  forwardRecipientSendButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 112,
    paddingHorizontal: 16
  },
  forwardRecipientSendText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20
  },
  mediaReviewRoot: {
    backgroundColor: '#050505',
    flex: 1
  },
  mediaReviewTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 10,
    paddingHorizontal: 14
  },
  mediaReviewIconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  mediaReviewTitleWrap: {
    flex: 1,
    minWidth: 0
  },
  mediaReviewTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22
  },
  mediaReviewSubtitle: {
    color: 'rgba(255, 255, 255, 0.68)',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16
  },
  mediaReviewTools: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  mediaReviewToolPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    minWidth: 36,
    paddingHorizontal: 10
  },
  mediaReviewToolText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 20
  },
  mediaReviewThumbnailBand: {
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 58
  },
  mediaReviewThumbnailContent: {
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 7
  },
  mediaReviewThumbnail: {
    borderColor: 'transparent',
    borderRadius: 8,
    borderWidth: 2,
    height: 44,
    overflow: 'hidden',
    width: 44
  },
  mediaReviewThumbnailActive: {
    borderColor: '#25D366'
  },
  mediaReviewThumbnailImage: {
    height: '100%',
    width: '100%'
  },
  mediaReviewThumbnailVideo: {
    alignItems: 'center',
    backgroundColor: '#1F2937',
    flex: 1,
    justifyContent: 'center'
  },
  mediaReviewPager: {
    flex: 1
  },
  mediaReviewSlide: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  mediaReviewPreviewImage: {
    height: '100%',
    width: '100%'
  },
  mediaReviewVideoPreview: {
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 8,
    height: '92%',
    justifyContent: 'center',
    width: '92%'
  },
  mediaReviewVideoMeta: {
    backgroundColor: 'rgba(0, 0, 0, 0.56)',
    borderRadius: 13,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 12,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  mediaReviewRemoveButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    borderRadius: 19,
    bottom: 14,
    height: 38,
    justifyContent: 'center',
    left: 18,
    position: 'absolute',
    width: 38
  },
  mediaReviewFooter: {
    backgroundColor: '#050505',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10
  },
  mediaReviewCaptionRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 19,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 11,
    paddingVertical: 4
  },
  mediaReviewCaptionInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21,
    maxHeight: 92,
    minHeight: 34,
    paddingHorizontal: 0,
    paddingVertical: 6,
    textAlignVertical: 'top'
  },
  mediaReviewInfoText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18
  },
  mediaReviewSendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between'
  },
  mediaReviewRecipient: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    color: '#FFFFFF',
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  mediaReviewSendButton: {
    alignItems: 'center',
    backgroundColor: '#25D366',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    position: 'relative',
    width: 44
  },
  mediaReviewSendCount: {
    alignItems: 'center',
    backgroundColor: '#0F766E',
    borderColor: '#050505',
    borderRadius: 9,
    borderWidth: 1.5,
    height: 18,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    top: -4,
    minWidth: 18,
    paddingHorizontal: 3
  },
  mediaReviewSendCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 13
  },
  mediaViewerRoot: {
    backgroundColor: '#020617',
    flex: 1
  },
  mediaViewerTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 8,
    paddingHorizontal: 12
  },
  mediaViewerCloseButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  mediaViewerTitleWrap: {
    flex: 1,
    minWidth: 0
  },
  mediaViewerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  mediaViewerSubtitle: {
    color: 'rgba(255, 255, 255, 0.68)',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 17
  },
  mediaViewerPager: {
    flex: 1
  },
  mediaViewerSlide: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  mediaViewerImage: {
    height: '100%',
    width: '100%'
  },
  mediaViewerUnavailable: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28
  },
  mediaViewerUnavailableTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22,
    marginTop: 10,
    textAlign: 'center'
  },
  mediaViewerUnavailableText: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    marginTop: 4,
    textAlign: 'center'
  },
  mediaViewerFooter: {
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 7,
    paddingHorizontal: 10,
    paddingTop: 8
  },
  mediaViewerThumbnailContent: {
    alignItems: 'center',
    gap: 7
  },
  mediaViewerThumbnail: {
    borderColor: 'transparent',
    borderRadius: 8,
    borderWidth: 2,
    height: 48,
    overflow: 'hidden',
    width: 48
  },
  mediaViewerThumbnailActive: {
    borderColor: '#25D366'
  },
  mediaViewerThumbnailImage: {
    height: '100%',
    width: '100%'
  },
  mediaViewerThumbnailPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#1F2937',
    flex: 1,
    justifyContent: 'center'
  },
  mediaViewerMeta: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    textAlign: 'center'
  },
  audioPreviewRoot: {
    backgroundColor: '#F8FAFC',
    flex: 1,
    paddingHorizontal: 18
  },
  audioPreviewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 44
  },
  audioPreviewCloseButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  audioPreviewHeaderTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22,
    textAlign: 'center'
  },
  audioPreviewHeaderSpacer: {
    height: 36,
    width: 36
  },
  audioPreviewContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 54
  },
  audioPreviewFileIcon: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 34,
    height: 68,
    justifyContent: 'center',
    marginBottom: 18,
    width: 68
  },
  audioPreviewFileName: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: '400',
    lineHeight: 27,
    marginBottom: 7,
    maxWidth: 310,
    textAlign: 'center'
  },
  audioPreviewFileMeta: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    marginBottom: 34,
    textAlign: 'center'
  },
  audioPreviewPlayer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'center',
    maxWidth: 390,
    width: '100%'
  },
  audioPreviewSkipButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48
  },
  audioPreviewSkipText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '400',
    lineHeight: 10,
    marginTop: -3
  },
  audioPreviewPlayButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 30,
    height: 60,
    justifyContent: 'center',
    width: 60
  },
  audioPreviewTimelineWrap: {
    marginTop: 24,
    maxWidth: 390,
    width: '100%'
  },
  audioPreviewTrackHitArea: {
    justifyContent: 'center',
    minHeight: 28,
    width: '100%'
  },
  audioPreviewTrack: {
    backgroundColor: '#CBD5E1',
    borderRadius: 4,
    height: 6,
    overflow: 'hidden'
  },
  audioPreviewTrackFill: {
    backgroundColor: colors.primary,
    borderRadius: 4,
    height: '100%'
  },
  audioPreviewTrackThumb: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.primary,
    borderRadius: 8,
    borderWidth: 2,
    height: 16,
    marginLeft: -8,
    marginTop: -5,
    position: 'absolute',
    top: '50%',
    width: 16
  },
  audioPreviewTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8
  },
  audioPreviewTimeText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18
  },
  messageComposer: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 7,
    paddingBottom: 8,
    paddingHorizontal: 8,
    paddingTop: 6
  },
  messageComposerMain: {
    flex: 1,
    gap: 0
  },
  composerReplyPreview: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    flexDirection: 'row',
    minHeight: 48,
    paddingLeft: 10,
    paddingRight: 5,
    paddingVertical: 7
  },
  composerReplyAccent: {
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: 2,
    marginRight: 9,
    width: 4
  },
  composerReplyTextWrap: {
    flex: 1,
    minWidth: 0
  },
  composerReplyAuthor: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  composerReplyText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  composerReplyCloseButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    marginLeft: 5,
    width: 34
  },
  messageInputBox: {
    alignItems: 'flex-end',
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 5,
    minHeight: 42,
    paddingHorizontal: 6
  },
  messageInputBoxWithReply: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0
  },
  voiceRecordingBox: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 9,
    minHeight: 42,
    paddingHorizontal: 8
  },
  voiceRecordingCancelButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 32
  },
  voiceRecordingDot: {
    backgroundColor: '#EF4444',
    borderRadius: 5,
    height: 10,
    width: 10
  },
  voiceRecordingText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 20,
    minWidth: 44
  },
  voiceRecordingHint: {
    color: '#64748B',
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18
  },
  messageInput: {
    color: colors.ink,
    flexGrow: 1,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '400',
    maxHeight: MESSAGE_INPUT_MAX_HEIGHT,
    minHeight: MESSAGE_INPUT_MIN_HEIGHT,
    minWidth: 0,
    paddingVertical: 8,
    textAlignVertical: 'top'
  },
  messageComposerIconButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 28
  },
  messageSendButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    width: 42
  },
  voiceRecordingSendButton: {
    backgroundColor: '#0F766E'
  },
  chatRow: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 58,
    paddingVertical: 7
  },
  contactChatRow: {
    minHeight: 72,
    paddingVertical: 8
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  chatAvatar: {
    borderRadius: 24,
    height: 48,
    width: 48
  },
  employeeAvatar: {
    backgroundColor: '#3F67EA'
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 23
  },
  chatText: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  chatTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22
  },
  chatListTitle: {
    color: '#0B141A',
    fontWeight: '600'
  },
  chatPreview: {
    color: '#8B95A5',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  chatMeta: {
    alignItems: 'flex-end',
    gap: 5,
    justifyContent: 'center',
    minWidth: 58
  },
  chatTime: {
    color: '#8B95A5',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 17,
    textAlign: 'right'
  },
  unreadBadge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 16,
    minWidth: 21,
    paddingHorizontal: 5
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 14
  },
  employeeRole: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    textAlign: 'right'
  },
  employeeMeta: {
    alignItems: 'flex-end',
    gap: 1,
    justifyContent: 'center',
    maxWidth: 96
  },
  employeeStatus: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    textAlign: 'right'
  },
  inviteDraft: {
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    gap: 8,
    paddingBottom: 12,
    paddingTop: 4
  },
  inviteDraftHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 42
  },
  inviteDraftContactRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingVertical: 3
  },
  inviteDraftAvatar: {
    backgroundColor: '#0F766E',
    height: 38,
    width: 38
  },
  inviteDraftActions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 2
  },
  textOnlyButton: {
    alignItems: 'center',
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 4
  },
  textOnlyButtonText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  secondaryActionButton: {
    alignItems: 'center',
    borderColor: '#D7DEE8',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 10
  },
  secondaryActionButtonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 19
  },
  primaryActionButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 10
  },
  singleInviteActionButton: {
    flex: 0,
    minWidth: 132
  },
  primaryActionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 19
  },
  batchModalScreen: {
    backgroundColor: '#FFFFFF',
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 18
  },
  manualInviteModalScreen: {
    backgroundColor: '#FFFFFF',
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 18
  },
  batchModalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 38
  },
  batchModalTitle: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: '400',
    lineHeight: 32,
    marginTop: 4
  },
  batchSelectedCount: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    marginBottom: 8
  },
  manualInviteHelp: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    marginBottom: 8
  },
  batchDoneButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 16
  },
  batchDoneButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 19
  },
  batchSearchBox: {
    borderBottomColor: 'rgba(15, 118, 110, 0.28)',
    borderBottomWidth: 1,
    minHeight: 46,
    justifyContent: 'center',
    marginBottom: 6
  },
  batchSearchInput: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '400',
    minHeight: 46,
    paddingHorizontal: 2
  },
  batchLoading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  batchList: {
    flex: 1
  },
  batchListContent: {
    paddingBottom: 24
  },
  batchContactRow: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 58,
    paddingVertical: 8
  },
  batchContactSelector: {
    alignItems: 'center',
    borderColor: '#A7B3C3',
    borderRadius: 11,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22
  },
  batchContactSelectorActive: {
    borderColor: colors.primary
  },
  batchContactSelectorInner: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    height: 12,
    width: 12
  },
  newChatModalScreen: {
    backgroundColor: '#FFFFFF',
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 22 : 18
  },
  newChatHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 46,
    marginBottom: 8
  },
  newChatHeaderIconButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  newChatHeaderTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 24,
    textAlign: 'center'
  },
  newChatHeaderSubtitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    textAlign: 'center'
  },
  newChatCenteredTitleWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  newChatHeaderSpacer: {
    width: 40
  },
  newChatNextButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 64,
    paddingHorizontal: 14
  },
  newChatNextText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20
  },
  newGroupEntry: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 62,
    paddingVertical: 8
  },
  newGroupIcon: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  newGroupText: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22
  },
  newChatContactList: {
    flex: 1
  },
  newChatContactRow: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingVertical: 8
  },
  memberSelectCheck: {
    alignItems: 'center',
    borderColor: '#A7B3C3',
    borderRadius: 12,
    borderWidth: 1.5,
    height: 24,
    justifyContent: 'center',
    width: 24
  },
  memberSelectCheckActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  groupCallOptionsRoot: {
    alignItems: 'flex-end',
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'android' ? 56 : 78
  },
  groupCallOptionsBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.16)'
  },
  groupCallOptionsPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    elevation: 18,
    minWidth: 238,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 20
  },
  groupCallOptionsHeader: {
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  groupCallOptionsTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21,
    maxWidth: 220
  },
  groupCallOptionsSubtitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    marginTop: 1
  },
  groupCallOptionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 9
  },
  groupCallOptionText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  groupSwitcherSectionTitle: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    marginBottom: 4,
    marginTop: 10
  },
  groupSwitcherList: {
    flex: 1
  },
  groupSwitcherRow: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 11,
    minHeight: 64,
    paddingVertical: 8
  },
  groupSwitcherRowActive: {
    backgroundColor: '#F0FDFA'
  },
  groupSwitcherAddButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 22,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 46,
    marginBottom: Platform.OS === 'android' ? 18 : 10,
    marginTop: 12
  },
  groupSwitcherAddText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  groupNameRow: {
    alignItems: 'center',
    borderBottomColor: 'rgba(15, 118, 110, 0.28)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 70,
    marginTop: 8,
    paddingBottom: 8
  },
  groupPhotoButton: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 52
  },
  groupPhotoImage: {
    height: '100%',
    width: '100%'
  },
  groupNameInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 17,
    fontWeight: '400',
    minHeight: 48,
    paddingVertical: 8
  },
  groupPermissionRow: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingVertical: 10
  },
  groupPermissionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  groupPermissionSubtitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    maxWidth: 275
  },
  groupPermissionOption: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 72,
    paddingVertical: 10
  },
  groupMembersTitle: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    marginTop: 16
  },
  groupMembersContent: {
    gap: 12,
    paddingTop: 12,
    paddingBottom: 16
  },
  groupMemberChip: {
    alignItems: 'center',
    width: 72
  },
  groupMemberAvatarWrap: {
    position: 'relative'
  },
  groupMemberRemoveButton: {
    alignItems: 'center',
    backgroundColor: '#64748B',
    borderColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    top: -2,
    width: 20
  },
  groupMemberName: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    marginTop: 6,
    textAlign: 'center'
  },
  batchEmpty: {
    color: '#8B95A5',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    paddingVertical: 18
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220
  },
  emptyTitle: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  settingsList: {
    paddingTop: 4
  },
  permissionSettingsList: {
    paddingTop: 4
  },
  permissionEmployeeSection: {
    borderBottomColor: '#D7DEE8',
    borderBottomWidth: 1,
    paddingBottom: 12,
    paddingTop: 4
  },
  permissionEmployeeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
    minHeight: 60,
    paddingVertical: 8
  },
  permissionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
    minHeight: 58,
    paddingVertical: 7
  },
  permissionCheck: {
    alignItems: 'center',
    borderColor: '#A7B3C3',
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    width: 20
  },
  permissionCheckActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  permissionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20
  },
  permissionDescription: {
    color: '#8B95A5',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 17
  },
  groupList: {
    paddingTop: 4
  },
  groupRow: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 11,
    minHeight: 62,
    paddingVertical: 8
  },
  groupIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  groupMeta: {
    color: '#8B95A5',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17,
    maxWidth: 78,
    textAlign: 'right'
  },
  groupScopeLabel: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    marginBottom: 8
  },
  backupSettings: {
    paddingTop: 4
  },
  companyProfileForm: {
    gap: 12,
    paddingTop: 4
  },
  companyLogoRow: {
    alignItems: 'center',
    borderBottomColor: 'rgba(15, 118, 110, 0.22)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 68,
    paddingBottom: 12
  },
  companyLogoBox: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    height: 56,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 56
  },
  companyLogoImage: {
    height: '100%',
    width: '100%'
  },
  companyProfileMeta: {
    borderTopColor: '#E5E7EB',
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 6
  },
  settingsSaveButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 148,
    paddingHorizontal: 16
  },
  settingsSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 19
  },
  settingsListItem: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 11,
    minHeight: 62,
    paddingVertical: 8
  },
  settingsListIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  settingsListIconText: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22
  },
  securityList: {
    paddingTop: 4
  },
  securitySectionTitle: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    marginBottom: 4
  },
  deviceRow: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 74,
    paddingVertical: 9
  },
  deviceIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  deviceStatusActive: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 17
  },
  deviceStatusRevoked: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 17
  },
  revokeDeviceButton: {
    alignItems: 'center',
    borderColor: '#FCA5A5',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  revokeDeviceText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18
  },
  chevronText: {
    color: '#8B95A5',
    fontSize: 26,
    fontWeight: '400',
    lineHeight: 30
  },
  loadingRow: {
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center'
  },
  recordList: {
    marginTop: 4
  },
  recordRow: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 56,
    paddingVertical: 7
  },
  recordInitial: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  recordInitialText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  profileAvatarShell: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    overflow: 'hidden'
  },
  profileAvatarImage: {
    backgroundColor: '#E5E7EB'
  },
  profileAvatarFallback: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    overflow: 'hidden'
  },
  profileAvatarInitials: {
    color: colors.primary,
    fontWeight: '400',
    textAlign: 'center'
  },
  emptySmall: {
    color: '#8B95A5',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    paddingVertical: 8
  },
  floatingAddButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 26,
    bottom: 96,
    elevation: 9,
    height: 52,
    justifyContent: 'center',
    position: 'absolute',
    right: 18,
    shadowColor: '#0F172A',
    shadowOffset: { height: 7, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    width: 52
  },
  floatingAddText: {
    color: '#FFFFFF',
    fontSize: 31,
    fontWeight: '400',
    lineHeight: 35
  },
  settingsInputBox: {
    borderBottomColor: 'rgba(15, 118, 110, 0.28)',
    borderBottomWidth: 1,
    minHeight: 48,
    justifyContent: 'center'
  },
  settingsInput: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '400',
    minHeight: 48,
    paddingHorizontal: 2
  },
  recoveryKeyInput: {
    borderBottomColor: 'rgba(15, 118, 110, 0.28)',
    borderBottomWidth: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
    minHeight: 120,
    paddingHorizontal: 2,
    paddingVertical: 10,
    textAlignVertical: 'top'
  },
  nativeOptionModalRoot: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  nativeOptionModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.36)'
  },
  nativeOptionModalPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    elevation: 24,
    maxHeight: '78%',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    width: '100%'
  },
  nativeOptionModalHeader: {
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 22,
    paddingTop: 4
  },
  nativeOptionModalTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '400',
    lineHeight: 26
  },
  nativeOptionList: {
    flexGrow: 0,
    maxHeight: 420
  },
  nativeOptionRow: {
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 22,
    paddingVertical: 10
  },
  nativeOptionRowText: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22
  },
  nativeOptionSeparator: {
    backgroundColor: '#E5E7EB',
    height: StyleSheet.hairlineWidth,
    marginLeft: 22
  },
  nativeOptionCancelButton: {
    alignItems: 'flex-end',
    borderTopColor: '#E5E7EB',
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 22
  },
  nativeOptionCancelText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  androidModalScreen: {
    backgroundColor: '#FFFFFF',
    flex: 1,
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 18
  },
  androidModalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 38
  },
  androidSaveButton: {
    alignItems: 'center',
    backgroundColor: '#4F6FEA',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 16
  },
  androidSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 19
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '400',
    lineHeight: 26
  },
  searchIcon: {
    height: 21,
    position: 'relative',
    width: 21
  },
  searchLens: {
    borderColor: colors.ink,
    borderRadius: 7,
    borderWidth: 2,
    height: 14,
    left: 1,
    position: 'absolute',
    top: 1,
    width: 14
  },
  searchHandle: {
    backgroundColor: colors.ink,
    borderRadius: 1,
    height: 8,
    position: 'absolute',
    right: 2,
    top: 14,
    transform: [{ rotate: '-45deg' }],
    width: 2
  },
  qrIcon: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    height: 21,
    width: 21
  },
  qrCell: {
    borderColor: '#64748B',
    borderRadius: 2,
    borderWidth: 1.5,
    height: 9,
    width: 9
  },
  filterIcon: {
    gap: 4,
    width: 22
  },
  filterLineWide: {
    backgroundColor: colors.primary,
    borderRadius: 1,
    height: 2,
    width: 22
  },
  filterLineMedium: {
    alignSelf: 'center',
    backgroundColor: colors.primary,
    borderRadius: 1,
    height: 2,
    width: 16
  },
  filterLineSmall: {
    alignSelf: 'center',
    backgroundColor: colors.primary,
    borderRadius: 1,
    height: 2,
    width: 9
  },
  footer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderColor: '#E7EAF0',
    borderRadius: 28,
    borderWidth: 1,
    bottom: 16,
    elevation: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 12,
    minHeight: 60,
    paddingHorizontal: 6,
    paddingVertical: 5,
    position: 'absolute',
    right: 12,
    shadowColor: '#0F172A',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 22
  },
  footerTab: {
    alignItems: 'center',
    borderRadius: 24,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    minWidth: 0,
    overflow: 'hidden',
    position: 'relative'
  },
  footerTabActivePill: {
    backgroundColor: '#EEF0F5',
    borderRadius: 24,
    bottom: 4,
    left: 4,
    position: 'absolute',
    right: 4,
    top: 4
  },
  footerTabContent: {
    alignItems: 'center',
    gap: 1,
    justifyContent: 'center',
    minWidth: 0
  },
  footerTabText: {
    color: '#111827',
    fontSize: 10,
    fontWeight: '400',
    lineHeight: 13
  },
  footerTabTextActive: {
    color: '#4F46E5'
  },
  footerProfileAvatar: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 15,
    borderWidth: 2,
    height: 30,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 30
  },
  footerProfileAvatarActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5'
  },
  pressed: {
    opacity: 0.72
  },
  disabled: {
    opacity: 0.52
  }
});
