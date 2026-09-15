import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEvent } from 'expo';
import * as Calendar from 'expo-calendar';
import * as Clipboard from 'expo-clipboard';
import * as Contacts from 'expo-contacts';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import * as ImageManipulator from 'expo-image-manipulator';
import * as ExpoSharing from 'expo-sharing';
import { VideoView, useVideoPlayer } from 'expo-video';
import { BlurView } from 'expo-blur';
import {
  ActionSheetIOS,
  ActivityIndicator,
  AccessibilityInfo,
  Alert,
  Animated,
  AppState,
  Dimensions,
  Easing,
  FlatList,
  Image,
  ImageStyle,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleProp,
  StyleSheet,
  StatusBar as RNStatusBar,
  Switch,
  Text,
  TextInput,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  findNodeHandle,
  UIManager,
  useWindowDimensions,
  View
} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent
} from '@react-native-community/datetimepicker';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle, Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DismissibleError } from '../components/DismissibleError';
import { MobileSeatNotice } from '../components/MobileSeatNotice';
import {
  ApprovedEmployee,
  CompanyProfile,
  CompanyKeyResultsConfig,
  confirmOrganizationDeletion,
  createDepartment,
  createRole,
  createTenantGroup,
  DepartmentAdminPermission,
  EmployeeLifecycleAction,
  getTenantAiUsageDashboard,
  getTenantChatOfflinePolicy,
  getCompanyProfile,
  getCompanyKeyResults,
  getTenantAiPolicy,
  inviteEmployeeContacts,
  updateEmployeeOrgAdminRole,
  KeyResultGroup,
  KeyResultMetric,
  KeyResultUnit,
  listCurrentUserGroups,
  listDepartmentAdminPermissionCatalog,
  listApprovedEmployees,
  listDepartments,
  listRolePermissionCatalog,
  listTenantGroups,
  cancelTenantScheduledMessage,
  getActionReminderPolicy,
  type AdminContactPolicy,
  getAdminContactPolicy,
  getScheduledMessagePolicy,
  listTenantDevices,
  listTenantScheduledMessages,
  updateActionReminderPolicy,
  updateAdminContactPolicy,
  updateScheduledMessagePolicy,
  listRoles,
  OrganizationDeletionChallenge,
  requestOrganizationDeletionChallenge,
  revokeTenantDevice,
  updateCompanyLogo,
  updateCompanyProfile,
  updateCompanyKeyResults,
  updateEmployeeDepartmentAdminAssignment,
  updateEmployeeDepartmentAdminPermissions,
  updateEmployeeLifecycle,
  updateEmployeeRole,
  updateRolePermissions,
  updateTenantChatBackupPolicy,
  updateTenantChatOfflinePolicy,
  RolePermission,
  TenantDepartment,
  TenantAiFeatureCatalogItem,
  TenantAiFeaturePolicy,
  TenantAiPolicy,
  TenantAiScopePolicy,
  TenantAiUsageDashboard,
  TenantAiUsageSummary,
  TenantDevice,
  TenantGroup,
  TenantRole,
  updateTenantAiBudgetPolicy,
  updateTenantAiDepartmentPolicy,
  updateTenantAiEmployeePolicy,
  updateTenantAiFeaturePolicy,
  updateTenantCompanyAiPolicy
} from '../services/adminApi';
import type { ActionReminderPolicy, ScheduledMessagePolicy, TenantScheduledMessage } from '../services/adminApi';
import { buildScheduledChatStates, type ScheduledChatState } from '../services/scheduledChatIndicators';
import {
  applyTypingUpdate,
  describeTypingForChatList,
  type TypingParticipant
} from '../services/typingIndicator';
import {
  openCallRealtimeSocket,
  parseCallRealtimeEvent,
  sendAnswerCall,
  sendCallSignal,
  sendEndCall,
  sendStartCall,
  type SynzappCallEndReason,
  type SynzappCallMode,
  type SynzappCallRecord,
  type SynzappCallRealtimeEvent,
  type SynzappCallSignalKind
} from '../services/callApi';
import {
  AddableChatGroup,
  addContactToGroupChat,
  ArchiveBadgeMode,
  ArchivedNotificationMode,
  ArchiveInactiveDuration,
  ArchiveUnarchiveBehavior,
  ArchiveUnreadDisplayMode,
  cancelScheduledChatMessage,
  ChatArchiveSettings,
  ChatContact,
  ChatDeliveryStatus,
  ChatGroupMember,
  ChatImageAttachment,
  ChatMediaAttachment,
  ChatMediaKind,
  ChatMessage,
  ChatMessageReaction,
  ChatMessageReactionMap,
  ChatNotificationAlertTone,
  ChatNotificationMuteMode,
  ChatNotificationSettings,
  ChatReplyReference,
  ChatTranscriptLanguageCode,
  ChatTranscriptLanguageSetting,
  ChatTrashSegment,
  createGroupChat,
  decryptRealtimeEncryptedEnvelopes,
  deleteChatMessageForMe,
  DirectChatContactDetails,
  dismissScheduledChatMessage,
  exitGroupChat,
  getChatArchiveSettings,
  getChatMessageIdentityKey,
  getChatMessages,
  getChatNotificationSettings,
  getChatTranscriptLanguage,
  getDirectChatContactDetails,
  getScheduledChatMessages,
  grantGroupChatHistoryKeys,
  listAddableGroupsForContact,
  listChatContacts,
  listGroupChatContacts,
  openChatRealtimeSocket,
  parseChatRealtimeEvent,
  prefetchChatEncryptionContext,
  scheduleChatMessage,
  sendChatMessage,
  sendRealtimePresenceHeartbeat,
  sendRealtimeTyping,
  sendScheduledChatMessageNow,
  subscribeRealtimeConversation,
  unsubscribeRealtimeConversation,
  updateChatArchiveSettings,
  updateChatMessageReaction,
  updateChatNotificationSettings,
  updateChatPreference,
  updateChatTranscriptLanguage,
  updateGroupChatPhoto
} from '../services/chatApi';
import type { ScheduledChatMessage } from '../services/chatApi';
import {
  ChatBackupPolicy,
  claimChatBackupRestore,
  createEncryptedChatBackup,
  escrowChatBackupKey,
  requestChatBackupRestore,
  type ChatBackupRestoreStatus,
  getChatBackupPolicy,
  getStoredChatBackupRecoveryKey,
  restoreLatestEncryptedChatBackup
} from '../services/chatBackup';
import { markCompanyDataScopeActive } from '../services/companyDataManifest';
import { purgeTenantCompanyData } from '../services/companyDataGovernance';
import { clearCompanyDataSessionScope } from '../services/companyDataSessionScope';
import {
  listCompanyLibrary,
  type CompanyLibraryItem
} from '../services/companyLibraryApi';
import { MediaTransferRing } from '../components/MediaTransferRing';
import {
  shouldIgnoreDeletedChatEvent,
  shouldReviveDeletedChat
} from '../services/chatDeletedContactRevival';
import {
  clearMissingChatMediaReport,
  subscribeMissingChatMedia,
  type MissingChatMediaReport
} from '../services/chatMediaRepairQueue';
import {
  confirmTenantAiToggle,
  finishNativeSynzappCall,
  handleChatsSectionUnavailableAction,
  handleContactInfoUnavailableAction,
  handleGroupInfoUnavailableAction,
  hasPendingMedia,
  isCompleteRecoverableUpload,
  parseIncomingCallDeepLink,
  parseIncomingCallDeepLinkParticipantUids,
  promptNativeTextInput,
  shouldSendSelectedMediaImmediately,
  showNativeIncomingSynzappCall,
  showNativeOutgoingSynzappCall,
  startIncomingCallAudio,
  startOutgoingCallAudio,
  stopIncomingCallAudio,
  stopOutgoingCallAudio
} from '../services/adminChatScreenHelpers';
import { ChatBackupPolicyConfirmation, ChatMoreActionTarget, DEFAULT_CHAT_BACKUP_POLICY, NewGroupFlowOrigin, SettingsScreen, UserPermission, applyChatListFilter, applyReactionMapToMessages, buildClearChatSummary, buildReplyReference, chatNotificationMuteOptions, confirmDestructiveAction, containsEmoji, createKeyResultLocalId, createRtcIceCandidate, createRtcSessionDescription, defaultChatArchiveSettings, defaultKeyResultsConfig, emptyClearChatSummary, extractReactionMapFromMessages, filterChatItems, formatChatSearchDateLabel, formatLocalTimeOnly, getAiPetalColor, getAllLswTaskDays, getChatBackupPolicyConfirmation, getChatDeviceNotReadyMessage, getChatMessageSentAtMs, getChatMessageStorageByteEstimate, getCompactLanguageLabel, getCurrentUserDialIdentity, getGuidedSetupFooterTargetKind, getLatestMessageSentAtMs, getLocalTimeZone, getLswSelectedYear, getLswWorkspaceTabLabel, getOldestMessageSentAtMs, getOnlineGroupMemberCount, getOptimisticMutedUntil, getOrgAdminSetupCoachStep, getRecipientDeviceNotReadyMessage, getSynzappWebRtcRuntime, getUtf8ByteLength, hasChatKnownMessages, hasPermission, isChatUnavailableForCurrentUserError, isDepartmentChat, isFavoriteChat, isGuidedSetupAssignableDepartment, isGuidedSetupAssignableRole, isNetworkUnavailableError, isOrgAdminSetupCoachEligible, isRealtimeSessionVerificationError, isRecipientDeviceNotReadyError, markChatMessageSendFailed, normalizeGuidedSetupMeasuredRect, normalizeGuidedSetupRecordName, normalizeKeyResultsForDraft, normalizeLswTimeInput, omitRecordKey, promptForRequiredText, replaceLswRecord, shouldShowActiveChatInList, shouldShowTrashChatInList, sortByName, sortLswDailyTasks, sortLswFollowUps, sortLswTodoTasks, sortMessageReactions, upsertMessageReaction, waitForNativeTransition } from '../services/adminChatSupport';
import { HIDDEN_DIRECT_CHAT_CONTACTS_KEY_PREFIX, addPersistedHiddenDirectChatContactId, applyLocalChatPreview, applyLocalChatPreviewOrEmpty, applyLocalChatPreviewsToContacts, areChatContactListsEqual, buildInvitedEmployeePhoneDisplayMap, buildLocalChatContactsFromCachedConversations, buildStartableDirectChatContacts, cacheApprovedEmployeePhotos, cacheChatContactPhoto, cacheChatContactPhotos, compareChatContacts, formatPhoneNumberOption, getAddableContactsForGroup, getApprovedEmployeeDisplayLabel, getApprovedEmployeePhoneDisplay, getChatContactListFingerprint, getCommonGroupContactsForDirectChat, getContactDisplayName, getContactWithPhoneNumbers, getFallbackChatContactRoleName, getHiddenDirectChatContactsStorageKey, getPhoneLastFourDigits, isChatContactClearedThroughLastMessage, isDestructiveEmployeeAction, isEmployeeLifecycleAction, isMaskedPhoneLabel, isMessageHiddenByContactClear, isNextContactStillCoveredByClear, isScheduleCallRecipientContact, loadBatchContactCandidates, loadPersistedHiddenDirectChatContactIds, mapApprovedEmployeeToListItem, mapApprovedEmployeeToStartableChatContact, mapChatContactToChatItem, mapChatItemToChatContact, mapGroupMembersToSelectableContacts, maskLocalPhoneNumber, mergeChatContactCachedPhoto, mergeChatContactVisibleState, mergeLoadedChatContactsWithVisibleState, normalizeChatContactRole, normalizeContactPhoneNumber, normalizeCountryPhone, removePersistedHiddenDirectChatContactId, selectPhoneNumber, sortApprovedEmployees, sortChatContacts, upsertApprovedEmployees, upsertChatContact } from '../services/chatContactSupport';
import { CHAT_AUTO_MEDIA_DOWNLOAD_MAX_PER_PASS, CHAT_AUTO_MEDIA_DOWNLOAD_RECENT_WINDOW, ChatMediaHydrationCandidate, SentPhotoEditorState, applyCachedMediaRecordsToMessage, applyMediaReviewQualityMode, applyMediaUpdateToMessage, buildChatMediaNetworkPolicy, buildLocalChatMediaAttachment, cacheChatGroupMemberPhotos, cacheCurrentUserProfilePhoto, canCurrentUserChangeGroupPhoto, canDownloadChatMedia, clearDownloadedMediaFilesFromMessages, clearLocalMediaReference, clearLocalMediaReferencesFromMessage, compareChatMediaHydrationCandidates, createLocalMediaFromEditedPhoto, getChatMediaHydrationPriority, getDeletableLocalMediaUri, getEditedPhotoFileName, getMediaItemsSize, getPhotoEditorDisplayUri, getSafePhotoDimension, hasClearableLocalMedia, isRenderSafePhotoUri, mapWithLimitedConcurrency, shouldSkipAutomaticMediaDownload, toLocalChatMediaInput, yieldToChatUi } from '../services/chatMediaSupport';
import { addPlusToCallKeypadInput, buildScheduleCallCalendarEventData, buildScheduleCallCalendarNotes, createScheduleCallDraft, createSynzappCallId, getDeviceTimeZone, getNativeCallKeepEndReason, getNextCallKeypadInput, getOptionalCallKeepRuntime, getOptionalInCallManagerRuntime, getScheduleCallValidationError, getSynzappCallHistoryStatusFromEndReason, isFinalSynzappCallHistoryStatus, limitCallKeypadInput, normalizeScheduleCallDraft, partitionCallSignals, serializeSynzappCallSignalPayload, shouldRenderSynzappCallOverlay } from '../services/chatCallSupport';
import { buildCompanyLibraryItemFromChatMedia, buildCompanyLibraryItemsFromChatConversations, buildSafeCompanyLibraryAudioPreviewFileName, companyLibraryAudioPreviewDirectory, getCompanyLibraryChatMediaUri, getCompanyLibraryChatSender, getCompanyLibraryGroupSourceArea, prepareCompanyLibraryAudioPreviewUri, sortCompanyLibraryItemsByDate } from '../services/companyLibraryChatSources';
import { CallQuickAction } from '../components/calls/CallQuickAction';
import { PhotoEditorCrashBoundary } from '../components/photoEditor/PhotoEditorCrashBoundary';
import { DirectoryHeader } from '../components/chatHeader/DirectoryHeader';
import { BackHeader } from '../components/chatHeader/BackHeader';
import { CompanyLibraryVideoPreviewModal } from '../components/companyLibrary/CompanyLibraryVideoPreviewModal';
import { CallOptionsMenu } from '../components/calls/CallOptionsMenu';
import { MediaPreparationStatusModal } from '../components/mediaReview/MediaPreparationStatusModal';
import { CompanyCalendarYearDatePickerModal } from '../components/pickers/CompanyCalendarYearDatePickerModal';
import { AddRecordModal } from '../components/rails/AddRecordModal';
import { SpamChatsScreen } from '../components/chatList/SpamChatsScreen';
import { KeyResultsHeaderOptions } from '../components/keyResults/KeyResultsHeaderOptions';
import { DirectoryFilter, DirectorySettings } from '../components/settings/DirectorySettings';
import { GroupsSettings } from '../components/settings/GroupsSettings';
import { ActionAttentionBanner } from '../components/actions/ActionAttentionBanner';
import { ActionRemindersSettings } from '../components/settings/ActionRemindersSettings';
import { AdminContactSettings } from '../components/settings/AdminContactSettings';
import { ScheduledMessagesSettings } from '../components/settings/ScheduledMessagesSettings';
import { RecoveryKeySheet } from '../components/settings/RecoveryKeySheet';
import { StopReasonSheet } from '../components/settings/StopReasonSheet';
import { WaitingMessagesModal } from '../components/settings/WaitingMessagesModal';
import { SecuritySettings } from '../components/settings/SecuritySettings';
import { DeviceRow, MyDevicesSettings } from '../components/settings/MyDevicesSettings';
import { ForwardSelectionHeader } from '../components/chatHeader/ForwardSelectionHeader';
import { MessageDeleteSelectionHeader } from '../components/chatHeader/MessageDeleteSelectionHeader';
import { SpamHeader } from '../components/chatHeader/SpamHeader';
import { RolePermissionSettings } from '../components/permissions/RolePermissionSettings';
import { DepartmentAdminPermissionSettings } from '../components/permissions/DepartmentAdminPermissionSettings';
import { GroupPermissionsModal } from '../components/permissions/GroupPermissionsModal';
import { NativeOptionPickerModal, NativeOptionPickerState } from '../components/pickers/NativeOptionPickerModal';
import { NativeDateTimePromptModal, NativeDateTimePromptState, normalizeChatRailsDueDate } from '../components/pickers/NativeDateTimePromptModal';
import { AddGroupModal } from '../components/groups/AddGroupModal';
import { MainNavigationModal, mainNavigationLinks } from '../components/navigation/MainNavigationModal';
import { ArchiveHeader } from '../components/chatHeader/ArchiveHeader';
import { CompanyLibraryImagePreviewModal } from '../components/companyLibrary/CompanyLibraryImagePreviewModal';
import { ClearChatModal, ClearChatSummary } from '../components/chatList/ClearChatModal';
import { ScheduledCallsModal } from '../components/calls/ScheduledCallsModal';
import { CallsTab } from '../components/calls/CallsTab';
import { GroupCallOption, GroupCallOptionsModal } from '../components/calls/GroupCallOptionsModal';
import { NewCallModal } from '../components/calls/NewCallModal';
import { EmployeesTab } from '../components/directory/EmployeesTab';
import { LSW_WORKSPACE_TABS, LswWorkspaceTabMenu } from '../components/lsw/LswWorkspaceTabMenu';
import { DirectContactDetailsModal } from '../components/contacts/DirectContactDetailsModal';
import { InviteContactDraft, InviteDraft, InviteDraftPanel, InviteMode, formatPhoneNumberForInviteDisplay } from '../components/invites/InviteDraftPanel';
import {
  canOfferOrgAdminInvite,
  describeOrgAdminInviteConfirmation
} from '../services/orgAdminInviteGrant';
import { ManualInviteModal } from '../components/invites/ManualInviteModal';
import { NewChatModal } from '../components/chatList/NewChatModal';
import { MessageListModal, MessageListModalMode } from '../components/chatList/MessageListModal';
import { ArchiveSelectionMap, ArchivedChatsScreen } from '../components/chatList/ArchivedChatsScreen';
import { countAnnouncementsNeedingAttention } from '../services/announcementDisplay';
import { FooterTabButton } from '../components/navigation/FooterTabButton';
import { FooterTabIndicator } from '../components/navigation/FooterTabIndicator';
import { HeaderActions } from '../components/chatHeader/HeaderActions';
import { MESSAGE_HEADER_HEIGHT, MessageHeader } from '../components/chatHeader/MessageHeader';
import { getFooterTabLabel } from '../services/footerTabLabels';
import { collectReplyIdsInMessages, mergeReplyIds } from '../services/replyThreads';
import { NoticesOptionsMenu, type NoticesView } from '../components/NoticesOptionsMenu';
import { SpamChatStatusModal } from '../components/chatList/SpamChatStatusModal';
import { ChatMoreActionsModal } from '../components/chatList/ChatMoreActionsModal';
import { ThemePreferenceModal } from '../components/settings/ThemePreferenceModal';
import { ChatNotificationSettingsModal, chatNotificationAlertToneOptions, getDefaultChatNotificationSettings } from '../components/settings/ChatNotificationSettingsModal';
import { ChatBackupSettings } from '../components/settings/ChatBackupSettings';
import { GroupSwitcherModal, getGroupSubtitle } from '../components/groups/GroupSwitcherModal';
import { GroupCallMode, GroupCallPeopleModal, formatGroupOnlineCount } from '../components/calls/GroupCallPeopleModal';
import { CallHistoryRow, formatScheduledCallDateTime, getCallHistoryStatusLabel } from '../components/calls/CallHistoryRow';
import { CallFavoritesModal } from '../components/calls/CallFavoritesModal';
import { ScheduleCallModal } from '../components/calls/ScheduleCallPickerModal';
import { GroupMembersModal } from '../components/groups/GroupMembersModal';
import { AddToGroupModal } from '../components/groups/AddToGroupModal';
import { AddMembersModal } from '../components/groups/AddMembersModal';
import { ChatMemberSelectRow, GroupAddMembersModal, filterChatContacts } from '../components/groups/GroupAddMembersModal';
import { GroupDetailsModal } from '../components/groups/GroupDetailsModal';
import { CompanyLibraryShareButton, CompanyLibraryVideoPreviewContent, companyLibraryVideoPreviewDirectory } from '../components/companyLibrary/CompanyLibraryPreviews';
import { BatchContactCandidate, BatchContactModal } from '../components/contacts/BatchContactModal';
import { DirectChatTranscriptLanguageModal, getDefaultChatTranscriptLanguage } from '../components/transcripts/DirectChatTranscriptLanguageModal';
import { SpamChatRow, getActiveTrashSegments, getTrashExpiryLabel } from '../components/chatList/SpamChatRow';
import { ChatListFilter, ChatsTab } from '../components/chatList/ChatsTab';
import { YouTab } from '../components/settings/YouTab';
import { CompanyProfileSettings, ProfileDetailRow, formatEmployeeStatus } from '../components/settings/CompanyProfileSettings';
import { SettingsList } from '../components/settings/SettingsList';
import { CallKeypadModal, CurrentUserDialIdentity, detectCallingCode, findCallDialMatch, formatManualInvitePhoneNumberInput, getMaxNationalDigitsForCallingCode, normalizeManualInvitePhoneNumber, normalizeNanpPhone, validateE164Phone } from '../components/calls/CallKeypadModal';
import { ForwardRecipientModal } from '../components/forwarding/ForwardRecipientModal';
import { CallContactRow, ScheduleCallDraft, ScheduleCallSendModal, filterCallContacts, getCallContactSubtitle } from '../components/calls/ScheduleCallModal';
import { EmployeeAction, EmployeeActionOption, EmployeeListItem, EmployeeRow, getEmployeeActionOptions } from '../components/directory/EmployeeRow';
import { OrganizationDeletionModal, OrganizationDeletionModalState, SettingsInput, normalizeOrganizationDeletionConfirmation } from '../components/organization/OrganizationDeletionModal';
import { ChatLswDateControl, EditableChatActionText, formatScheduleDate, formatScheduleTime } from '../components/chat/chatActionControls';
import { ChatRow, canSwipeChatRow, canUseChatListActions, getChatListPreviewText, getTimestampMs, isClearedThroughTimestamp } from '../components/chatList/ChatRow';
import { ContactInfoModal, TranscriptLanguageOption, chatTranscriptLanguageOptions, formatChatListTime } from '../components/contacts/ContactInfoModal';
import { ChatItem, GroupInfoActionButton, GroupInfoMemberRow, GroupInfoModal, GroupInfoSettingRow, canExitGroupChat, formatGroupMemberCount, getChatNotificationMuteLabel, getChatNotificationSummary } from '../components/groups/GroupInfoModal';
import { ActiveSynzappCall, SynzappCallDirection, SynzappCallOverlay, SynzappCallStatus, WebRtcRuntime } from '../components/calls/SynzappCallOverlay';
import { MessageThread, ProfileAvatar, formatMessageDate, formatMessageDeliveryStatus, formatReplyPreviewText, getInitials, getMediaPreparationKey, getMessageListPreview, isAudioAttachment, normalizeSearchQuery } from '../components/messages/MessageThread';
import { AnnouncementsTab, type AnnouncementAudienceOption } from './AnnouncementsTab';
import { ChatAnnouncementBanner } from '../components/ChatAnnouncementBanner';
import { showAnnouncementAlert } from '../services/announcementAlert';
import { CreateActionModal, type ActionGroupChoice, type ActionPersonChoice, type CreateActionDraft } from '../components/actions/CreateActionModal';
import { createAction as createActionRequest, getActionCounts, listActions, type ActionRecord, getMyActionCounts, type PersonalActionCounts } from '../services/actionApi';
import { filterActionsAfterChatCleared } from '../services/actionDisplay';
import { ActionsTab } from '../components/actions/ActionsTab';
import { ChatCameraModal } from '../components/camera/ChatCameraModal';
import {
  buildLocalMediaFromCapture,
  type CapturedChatMedia
} from '../services/chatCameraMedia';
import { ActionDetailModal } from '../components/actions/ActionDetailModal';
import { ActionCountsBar } from '../components/actions/ActionCountsBar';
import { uploadPickedMedia } from '../services/actionAttachments';
import {
  acknowledgeAnnouncement as acknowledgeAnnouncementRequest,
  listAnnouncementAudienceGroups,
  type Announcement,
  type AnnouncementAudienceGroup
} from '../services/announcementApi';
import {
  countOutstandingForReader,
  findAnnouncementToPin,
  findAnnouncementsForChatList
} from '../services/announcementChatMatching';
import {
  markAcknowledgedLocally,
  refreshAnnouncements,
  subscribeToAnnouncements
} from '../services/announcementStore';
import { CompanyLibraryHeaderActions, CompanyLibraryTab, type CompanyLibraryViewMode } from '../components/companyLibrary/CompanyLibraryTab';
import { CompanyLibraryKindFilter, companyLibraryDocumentThumbnailSources, formatCompanyLibraryDate, getCompanyLibraryDisplayName, getCompanyLibraryExtension, getCompanyLibraryKind, getCompanyLibraryKindLabel, getCompanyLibraryPhotoSource, normalizeCompanyLibraryBucketValue } from '../services/companyLibraryDisplay';
import { ChatSearchBar, androidButtonRipple, androidIconRipple, getKeyboardDismissMode } from '../components/chatUiPrimitives';
import { FooterTab, GuidedSetupCoachOverlay, GuidedSetupTargetKind, GuidedSetupTargetRect, OrgAdminSetupCoachStep } from '../components/guidedSetup/GuidedSetupCoachOverlay';
import { ArchiveSettingsModal } from '../components/archiveSettings/ArchiveSettingsModal';
import { ChatMediaNetworkPolicy, OfflineChatSettings, SettingsListItem } from '../components/offlineSettings/OfflineChatSettings';
import { AiUsageCreditsSettings } from '../components/aiCredits/AiUsageCreditsSettings';
import { KeyResultsSettings, getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../components/keyResults/KeyResultsSettings';
import { LSW_DAY_KEYS, LswFollowUpFilter, LswTodoFilter, LswWorkspaceScreen, LswWorkspaceTab, formatLocalDateOnly } from '../components/lsw/LswWorkspaceScreen';
import type { FeatherIconName } from '../types/featherIcon';
import { AudioAttachmentPreviewModal } from '../components/audio/AudioAttachmentPreviewModal';
import {
  CHAT_AUDIO_PLAYBACK_MODE,
  getAudioAttachmentUniformTypeIdentifier,
  getSafeAudioShareExtension,
  prepareChatAudioAttachmentShareUri,
  safePauseAudioPlayer,
  safePlayAudioPlayer,
  safeReplaceAudioPlayerSource,
  type AudioAttachmentPreviewState
} from '../services/chatAudioPlayback';
import { MessageReactionPickerModal } from '../components/messageReactions/MessageReactionPickerModal';
import { MediaReviewItem, MediaReviewModal } from '../components/mediaReview/MediaReviewModal';
import {
  buildVoiceNoteWaveform,
  formatMediaDuration,
  formatMessageTime,
  getAudioSeekSeconds,
  getChatMessagePreview,
  getChatMessageTextPreview,
  getReadableFileExtension,
  isMediaTransferActive
} from '../services/chatMessagePreview';
import {
  MediaViewerModal,
  type MediaViewerState
} from '../components/mediaViewer/MediaViewerModal';
import {
  clampAudioSeconds,
  formatAudioSeconds,
  formatByteCount,
  formatMessageDateTime,
  getErrorMessage,
  getMediaPreviewUri,
  getMediaTransferLabel
} from '../services/chatDisplayFormatting';
import {
  AI_HISTORY_ROW_ACTION_WIDTH,
  CHAT_ROW_SWIPE_TRIGGER,
  CHAT_ROW_LEFT_ACTION_WIDTH,
  CHAT_ROW_RIGHT_ACTION_WIDTH,
  FOOTER_BAR_HORIZONTAL_PADDING,
  KEY_RESULT_ROW_ACTION_WIDTH,
  LSW_DAILY_ROW_ACTION_WIDTH,
  MESSAGE_INPUT_MAX_HEIGHT,
  MESSAGE_INPUT_MIN_HEIGHT,
  SPAM_ROW_ACTION_WIDTH,
  styles
} from './adminChatStyles';
import { SynzappPhotoEditor, type SynzappPhotoEditorResult } from '../components/photoEditor/SynzappPhotoEditor';
import {
  buildMediaTransferProgressKey,
  clearAllMediaTransferProgress,
  clearMediaTransferProgress,
  publishMediaTransferProgress
} from '../services/chatMediaTransferProgress';
import {
  cacheCompanyLibraryVideoThumbnailFromFile,
  getCachedCompanyLibraryVideoThumbnail,
  getCompanyLibraryVideoThumbnail,
  subscribeCompanyLibraryVideoThumbnail
} from '../services/companyLibraryVideoThumbnails';
import { KeyResultsSelectionBar } from '../components/keyResults/KeyResultsSelectionBar';
import {
  getChatMessageRowKey,
  getMediaLocalUri,
  getMessageMedia,
  getMessageMediaItems,
  mergeChatMessageMedia,
  toChatImageAttachment,
  uniqueChatMessages
} from '../services/chatMessageReconciliation';
import { createSerialTaskQueue } from '../services/serialTaskQueue';
import {
  buildMissingLocalMediaState,
  buildUploadedMediaState,
  reconcileSyncedPendingMessage,
  resolveMissingLocalMediaAction,
  mergeSyncedMessageWithPendingLocalMedia
} from '../services/chatOutboxReconciliation';
import {
  applyChatMessageMedia,
  clearAllChatThreads,
  getChatThread,
  reconcileChatThread,
  removeChatMessage,
  subscribeChatThread,
  updateChatMessage,
  upsertChatMessages
} from '../services/chatThreadStore';
import {
  createLswDailyTask,
  createLswFollowUp,
  createLswTodoTask,
  deleteLswDailyTask,
  getLswContext,
  listLswDailyTasks,
  listLswFollowUps,
  listLswTodoTasks,
  type LswDailyTask,
  type LswDayKey,
  type LswDayStatusValue,
  type LswFollowUpSummary,
  type LswTodoTaskSummary,
  type LswWorkspaceContext,
  updateLswDailyTask,
  updateLswFollowUp,
  updateLswTodoTask
} from '../services/lswApi';
import { ACCESS_DENIED_MESSAGE } from '../services/backendAuth';
import {
  assertCompanyDataRenderable,
  isCompanyAccessDeniedError
} from '../services/companyDataAccessGuard';
import {
  clearRegisteredDeviceIdentityCache,
  ensureRegisteredDeviceIdentity,
  getRegisteredDeviceId,
  setMobileSeatConflictHandler
} from '../services/deviceIdentity';
import { processPendingCompanyDataWipeCommands } from '../services/companyDataWipeApi';
import {
  dismissGuidedSetupJourney,
  loadGuidedSetupJourneyState,
  markGuidedSetupJourneyCompleted,
  saveGuidedSetupJourneyStep,
  type GuidedSetupJourneyState
} from '../services/guidedSetupCoach';
import {
  CurrentUserDevice,
  CurrentUserProfile,
  getCurrentUserProfile,
  listCurrentUserDevices,
  revokeCurrentUserDevice,
  updateCurrentUserProfilePhoto
} from '../services/profileApi';
import {
  deleteCachedChatConversation,
  enqueuePendingChatMessage,
  clearLocalChatDataForOwner,
  hideCachedChatMessagesForMe,
  listCachedChatMediaForMessages,
  loadCachedChatContacts,
  listCachedChatConversations,
  listLocalChatMediaTransferQueue,
  listPendingChatMessages,
  loadCachedChatConversation,
  loadCachedReplyIds,
  loadCachedChatConversationPage,
  loadLocalChatSyncState,
  loadHiddenChatMessageIds,
  removeLocalChatMediaTransferQueueItem,
  removePendingChatMessage,
  removePendingChatMessagesForContact,
  saveCachedChatContacts,
  saveCachedChatConversation,
  saveLocalChatSyncState,
  upsertLocalChatMediaTransferQueueItem,
  updateCachedChatMessageMedia,
  updatePendingChatMessage
} from '../services/localChatStore';
import {
  describeMobileSeatHolder,
  isMobileSeatHeldError,
  type MobileSeatHolder
} from '../services/mobileSeatConflict';
import type {
  LocalConversationRecord,
  LocalCachedChatMediaRecord,
  PendingChatMessage
} from '../services/localChatStore';
import {
  loadSynzappCallStore,
  markSynzappCallsSeen,
  saveSynzappCallStore,
  upsertSynzappCallHistoryEntry,
  type SynzappCallHistoryEntry,
  type SynzappCallHistoryStatus,
  type SynzappCallStoreData,
  type SynzappScheduledCall
} from '../services/localCallStore';
import { getCachedProfilePhotoUri } from '../services/profilePhotoCache';
import { openChatAttachmentFile } from '../services/chatAttachmentOpener';
import {
  cancelNativeBackgroundTransfer,
  getNativeBackgroundTransferStatus
} from '../services/chatBackgroundTransferApi';
import {
  IPhonePhotoPreparationProgress,
  isPhotoAccessDeniedError,
  PHOTO_ACCESS_DENIED_MESSAGE,
  flipChatMediaHorizontally,
  pickNativeChatFile,
  pickNativeChatLibraryMedia
} from '../services/chatAttachmentPicker';
import {
  clearChatMediaPreparation,
  prepareChatMediaAttachmentThroughQueue
} from '../services/chatMediaPreparationQueue';
import {
  cacheLocalChatMedia,
  completeUploadedChatMedia,
  resolveLocalChatMediaUri,
  type ChatMediaQualityMode,
  type ChatMediaUploadRecoveryState,
  downloadAndDecryptChatMedia,
  enforceChatMediaCachePolicy,
  getChatMediaCacheSizeBytes,
  getExistingLocalMediaUri,
  LocalChatMediaInput,
  setChatMediaCacheBudgetBytes,
  setChatMediaCacheRetentionDays,
  setChatMediaLimitBytes,
  uploadEncryptedChatMedia
} from '../services/chatMediaApi';
import {
  createEmptyChatOfflineMetricsSnapshot,
  incrementChatOfflineCounterMetric,
  loadChatOfflineMetrics,
  recordChatOfflineMediaTransferMetric,
  recordChatOfflineTimingMetric,
  resetChatOfflineMetrics,
  updateChatOfflineGaugeMetrics,
  type ChatOfflineMetricsSnapshot
} from '../services/chatOfflineMetrics';
import {
  DEFAULT_CHAT_OFFLINE_POLICY_SETTINGS,
  loadChatOfflinePolicySettings,
  saveChatOfflinePolicySettings,
  type ChatOfflinePolicySettings
} from '../services/chatOfflineSettings';
import { pickNativeProfilePhoto } from '../services/profilePhotoPicker';
import {
  addChatPushNotificationListeners,
  CallPushNotificationData,
  ChatPushNotificationData,
  configureSynzappNotificationHandling,
  registerDevicePushNotifications,
  syncSynzappUnreadBadgeCount
} from '../services/pushNotifications';
import {
  addSynzappVoipCallEventListener,
  endSynzappNativeVoipCall,
  getPendingSynzappVoipCallEvents,
  type SynzappVoipCallEvent
} from '../services/voipCalls';
import {
  sendReauthenticationPhoneCode,
  signOutOrgAdmin
} from '../services/phoneAuth';
import { VerifiedOrgAdmin } from '../types/auth';
import { colors } from '../theme/colors';
import { resolveAndroidNavigationInset } from '../services/androidNavigationInset';
import {
  resolveKeyboardVerticalOffset,
  resolveScreenBottomInset
} from '../services/rootSafeArea';
import { attachChatMediaPoster } from '../services/chatMediaPosterQueue';
import {
  AppThemePreference,
  getThemePreferenceLabel,
  useAppTheme
} from '../theme/AppThemeProvider';
import {
  calendarYearMaximumDate,
  calendarYearMinimumDate,
  formatCalendarYearStartDateInput,
  getCalendarYearStartDateLabel,
  isValidCalendarYearStartDate,
  parseCalendarYearStartDate
} from '../utils/calendarYear';
import { InterpreterScreen } from './InterpreterScreen';

interface AdminChatScreenProps {
  onOrganizationDeleted: () => void;
  /**
   * Called once the first contact load has settled.
   *
   * Until then the screen is mounted but still filling in, and typing into it
   * competes with that work — which is what made the keyboard stutter on the
   * first open after installing. The app keeps the preparation screen up until
   * this fires.
   */
  onReady?: () => void;
  onSessionInvalid: (message?: string) => void;
  verifiedAdmin: VerifiedOrgAdmin;
}

/**
 * How long after its time a scheduled message is asked about.
 *
 * The release worker runs on the minute, so a message goes shortly after the
 * moment it was set for rather than on it. Asking sooner only gets the same
 * answer back.
 */
const SCHEDULED_MESSAGE_RELEASE_GRACE_MS = 20 * 1000;

/** Shared so an absent list is the same array every render. */
const EMPTY_TYPING_LIST: TypingParticipant[] = [];

/**
 * The shortest gap between two of those questions.
 *
 * Also the interval used for a message already past due — one the worker has
 * not reached yet, or one whose send is being retried. It keeps the check from
 * becoming a busy loop while still noticing within moments.
 */
const SCHEDULED_MESSAGE_RECHECK_MS = 20 * 1000;

export function AdminChatScreen({ onOrganizationDeleted, onReady, onSessionInvalid, verifiedAdmin }: AdminChatScreenProps) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<FooterTab>('Chats');
  const [isInterpreterRoomOpen, setIsInterpreterRoomOpen] = useState(false);
  const [settingsScreen, setSettingsScreen] = useState<SettingsScreen>('list');
  const [companyLibraryViewMode, setCompanyLibraryViewMode] = useState<CompanyLibraryViewMode>('grid');
  // Sent first. Somebody opening Notices from the header has almost always come
  // to write one or to see who has read the last one.
  const [noticesView, setNoticesView] = useState<NoticesView>('SENT');
  const [isNoticesOptionsOpen, setIsNoticesOptionsOpen] = useState(false);
  const [isNoticeComposeOpen, setIsNoticeComposeOpen] = useState(false);
  const [adminContactPolicy, setAdminContactPolicy] = useState<AdminContactPolicy | null>(null);
  const [isLoadingAdminContactPolicy, setIsLoadingAdminContactPolicy] = useState(false);
  const [isSavingAdminContactPolicy, setIsSavingAdminContactPolicy] = useState(false);
  const [directoryFilter, setDirectoryFilter] = useState<DirectoryFilter>('Departments');
  const [approvedEmployees, setApprovedEmployees] = useState<ApprovedEmployee[]>([]);
  // Colleagues this user has not messaged yet. Kept apart from chatContacts so
  // they populate "New chat" without appearing as empty threads in the chat
  // list. Available to every role, unlike the admin-only employee directory.
  const [directoryChatContacts, setDirectoryChatContacts] = useState<ChatContact[]>([]);
  const [employeePhoneDisplayById, setEmployeePhoneDisplayById] = useState<Record<string, string>>({});
  const [departments, setDepartments] = useState<TenantDepartment[]>([]);
  const [departmentAdminPermissionCatalog, setDepartmentAdminPermissionCatalog] = useState<DepartmentAdminPermission[]>([]);
  const [groups, setGroups] = useState<TenantGroup[]>([]);
  const [rolePermissionCatalog, setRolePermissionCatalog] = useState<RolePermission[]>([]);
  const [roles, setRoles] = useState<TenantRole[]>([]);
  const [tenantDevices, setTenantDevices] = useState<TenantDevice[]>([]);
  const [currentUserDevices, setCurrentUserDevices] = useState<CurrentUserDevice[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [tenantAiDashboard, setTenantAiDashboard] = useState<TenantAiUsageDashboard | null>(null);
  const [tenantAiFeatureCatalog, setTenantAiFeatureCatalog] = useState<TenantAiFeatureCatalogItem[]>([]);
  const [isLoadingTenantAiUsage, setIsLoadingTenantAiUsage] = useState(false);
  const [isSavingTenantAiPolicy, setIsSavingTenantAiPolicy] = useState(false);
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
  const [chatListFilter, setChatListFilter] = useState<ChatListFilter>('all');
  const [chatSearch, setChatSearch] = useState('');
  const [companyLibraryItems, setCompanyLibraryItems] = useState<CompanyLibraryItem[]>([]);
  const [companyLibrarySearch, setCompanyLibrarySearch] = useState('');
  const [companyLibraryFileHeaders, setCompanyLibraryFileHeaders] = useState<Record<string, string> | undefined>(undefined);
  const [companyLibraryPreview, setCompanyLibraryPreview] = useState<CompanyLibraryItem | null>(null);
  const [companyLibraryVideoPreview, setCompanyLibraryVideoPreview] = useState<CompanyLibraryItem | null>(null);
  // Guards against duplicate sends from taps buffered during a busy JS thread.
  const isEnqueueingChatMessageRef = useRef(false);
  const chatRealtimeQueueRef = useRef(createSerialTaskQueue({
    onError: (queueError) => {
      console.warn('Synzapp chat realtime payload failed.', queueError);
    },
    onTimeout: () => {
      // Loud on purpose. A payload overrunning means the conversation was one
      // hung token fetch away from going silent, which is worth seeing in a log.
      console.warn('Synzapp chat realtime payload timed out; letting the queue move on.');
    }
  }));
  const [isLoadingCompanyLibrary, setIsLoadingCompanyLibrary] = useState(false);
  const [lswActiveTab, setLswActiveTab] = useState<LswWorkspaceTab>('today');
  const [lswContext, setLswContext] = useState<LswWorkspaceContext | null>(null);
  const [lswDailyTasks, setLswDailyTasks] = useState<LswDailyTask[]>([]);
  const [lswTodoTasks, setLswTodoTasks] = useState<LswTodoTaskSummary[]>([]);
  const [lswFollowUps, setLswFollowUps] = useState<LswFollowUpSummary[]>([]);
  const [lswTodoFilter, setLswTodoFilter] = useState<LswTodoFilter>('open');
  const [lswFollowUpFilter, setLswFollowUpFilter] = useState<LswFollowUpFilter>('open');
  const [isLoadingLswWorkspace, setIsLoadingLswWorkspace] = useState(false);
  const [isRefreshingLswWorkspace, setIsRefreshingLswWorkspace] = useState(false);
  const [lswWorkspaceError, setLswWorkspaceError] = useState<string | null>(null);
  const [lswSavingRecordId, setLswSavingRecordId] = useState<string | null>(null);
  const [callSearch, setCallSearch] = useState('');
  const [callHistory, setCallHistory] = useState<SynzappCallHistoryEntry[]>([]);
  const [callFavoriteContactIds, setCallFavoriteContactIds] = useState<string[]>([]);
  const [scheduledCalls, setScheduledCalls] = useState<SynzappScheduledCall[]>([]);
  const [isCallOptionsOpen, setIsCallOptionsOpen] = useState(false);
  const [isActionsOptionsOpen, setIsActionsOptionsOpen] = useState(false);
  const [isMainNavigationOpen, setIsMainNavigationOpen] = useState(false);
  const [isNewCallModalOpen, setIsNewCallModalOpen] = useState(false);
  const [isCallKeypadOpen, setIsCallKeypadOpen] = useState(false);
  const [isCallFavoritesModalOpen, setIsCallFavoritesModalOpen] = useState(false);
  const [isScheduleCallModalOpen, setIsScheduleCallModalOpen] = useState(false);
  const [isScheduleCallSendModalOpen, setIsScheduleCallSendModalOpen] = useState(false);
  const [isAddingScheduleToCalendar, setIsAddingScheduleToCalendar] = useState(false);
  const [isScheduledCallsModalOpen, setIsScheduledCallsModalOpen] = useState(false);
  const [isCallEditMode, setIsCallEditMode] = useState(false);
  const [callKeypadDigits, setCallKeypadDigits] = useState('');
  const [newCallSearch, setNewCallSearch] = useState('');
  const [callFavoritesSearch, setCallFavoritesSearch] = useState('');
  const [scheduleCallRecipientSearch, setScheduleCallRecipientSearch] = useState('');
  const [scheduleCallRecipientIds, setScheduleCallRecipientIds] = useState<Record<string, boolean>>({});
  const [scheduleCallDraft, setScheduleCallDraft] = useState<ScheduleCallDraft>(() => createScheduleCallDraft(null));
  const [isSpamScreenOpen, setIsSpamScreenOpen] = useState(false);
  const [spamActionTarget, setSpamActionTarget] = useState<ChatItem | null>(null);
  const [isDeletingSpamChats, setIsDeletingSpamChats] = useState(false);
  const [isArchiveScreenOpen, setIsArchiveScreenOpen] = useState(false);
  const [isArchiveEditMenuOpen, setIsArchiveEditMenuOpen] = useState(false);
  const [isArchiveSelectionMode, setIsArchiveSelectionMode] = useState(false);
  const [selectedArchivedChatIds, setSelectedArchivedChatIds] = useState<ArchiveSelectionMap>({});
  const [isArchiveSettingsOpen, setIsArchiveSettingsOpen] = useState(false);
  const [chatArchiveSettings, setChatArchiveSettings] = useState<ChatArchiveSettings>(defaultChatArchiveSettings);
  const [isLoadingArchiveSettings, setIsLoadingArchiveSettings] = useState(false);
  const [isSavingArchiveSettings, setIsSavingArchiveSettings] = useState(false);
  const [isScreenKeyboardVisible, setIsScreenKeyboardVisible] = useState(false);
  const [screenKeyboardHeight, setScreenKeyboardHeight] = useState(0);
  const [tallestWindowHeight, setTallestWindowHeight] = useState(0);
  const [chatMoreActionTarget, setChatMoreActionTarget] = useState<ChatMoreActionTarget>(null);
  const [clearChatTarget, setClearChatTarget] = useState<ChatItem | null>(null);
  const [clearChatSummary, setClearChatSummary] = useState<ClearChatSummary>(emptyClearChatSummary);
  const [isClearingChat, setIsClearingChat] = useState(false);
  const [isThemePreferenceModalOpen, setIsThemePreferenceModalOpen] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [addMembersSearch, setAddMembersSearch] = useState('');
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isAddMembersModalOpen, setIsAddMembersModalOpen] = useState(false);
  const [isContactInfoModalOpen, setIsContactInfoModalOpen] = useState(false);
  const [isChatNotificationSettingsOpen, setIsChatNotificationSettingsOpen] = useState(false);
  const [isChatTranscriptLanguageOpen, setIsChatTranscriptLanguageOpen] = useState(false);
  const [isDirectContactDetailsOpen, setIsDirectContactDetailsOpen] = useState(false);
  const [isAddToGroupModalOpen, setIsAddToGroupModalOpen] = useState(false);
  const [isGroupDetailsModalOpen, setIsGroupDetailsModalOpen] = useState(false);
  const [isGroupPermissionsModalOpen, setIsGroupPermissionsModalOpen] = useState(false);
  const [isGroupCallOptionsOpen, setIsGroupCallOptionsOpen] = useState(false);
  const [isGroupCallPeopleModalOpen, setIsGroupCallPeopleModalOpen] = useState(false);
  const [isGroupAddMembersModalOpen, setIsGroupAddMembersModalOpen] = useState(false);
  const [isGroupMembersModalOpen, setIsGroupMembersModalOpen] = useState(false);
  const [isGroupInfoModalOpen, setIsGroupInfoModalOpen] = useState(false);
  const [isGroupSwitcherModalOpen, setIsGroupSwitcherModalOpen] = useState(false);
  const [groupCallMode, setGroupCallMode] = useState<GroupCallMode>('select');
  const [groupCallPeopleSearch, setGroupCallPeopleSearch] = useState('');
  const [groupAddMembersSearch, setGroupAddMembersSearch] = useState('');
  const [groupMembersSearch, setGroupMembersSearch] = useState('');
  const [chatTranscriptLanguageSearch, setChatTranscriptLanguageSearch] = useState('');
  const [addToGroupSearch, setAddToGroupSearch] = useState('');
  const [newGroupNameDraft, setNewGroupNameDraft] = useState('');
  const [newGroupPhotoUri, setNewGroupPhotoUri] = useState<string | null>(null);
  const [newGroupPermissionMode, setNewGroupPermissionMode] = useState<'ADMINS' | 'ALL_MEMBERS'>('ALL_MEMBERS');
  const [newGroupFlowOrigin, setNewGroupFlowOrigin] = useState<NewGroupFlowOrigin>('newChat');
  const [selectedGroupCallMemberIds, setSelectedGroupCallMemberIds] = useState<Record<string, boolean>>({});
  const [selectedGroupAddMemberIds, setSelectedGroupAddMemberIds] = useState<Record<string, boolean>>({});
  const [selectedNewGroupMemberIds, setSelectedNewGroupMemberIds] = useState<Record<string, boolean>>({});
  const [selectedAddToGroupIds, setSelectedAddToGroupIds] = useState<Record<string, boolean>>({});
  const [messageDraft, setMessageDraft] = useState('');
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledChatMessage[]>([]);
  const [scheduledChatStates, setScheduledChatStates] = useState<Record<string, ScheduledChatState>>({});
  const [myActionCounts, setMyActionCounts] = useState<PersonalActionCounts | null>(null);
  const refreshMyActionCountsRef = useRef<() => Promise<void>>(async () => undefined);
  const [actionReminderPolicy, setActionReminderPolicy] = useState<ActionReminderPolicy | null>(null);
  const [isLoadingActionReminders, setIsLoadingActionReminders] = useState(false);
  const [isSavingActionReminders, setIsSavingActionReminders] = useState(false);
  const [tenantScheduledMessages, setTenantScheduledMessages] = useState<TenantScheduledMessage[]>([]);
  const [scheduledMessagePolicy, setScheduledMessagePolicy] = useState<ScheduledMessagePolicy | null>(null);
  const [isLoadingTenantScheduledMessages, setIsLoadingTenantScheduledMessages] = useState(false);
  const [isSavingScheduledMessagePolicy, setIsSavingScheduledMessagePolicy] = useState(false);
  const [busyTenantScheduledMessageId, setBusyTenantScheduledMessageId] = useState<string | null>(null);
  const [isWaitingMessagesOpen, setIsWaitingMessagesOpen] = useState(false);
  const [stopReasonTarget, setStopReasonTarget] = useState<TenantScheduledMessage | null>(null);
  const [isRecoveryKeyPromptOpen, setIsRecoveryKeyPromptOpen] = useState(false);
  const [recoveryKeyDraft, setRecoveryKeyDraft] = useState('');
  const [stopReasonDraft, setStopReasonDraft] = useState('');
  const [mediaReviewItems, setMediaReviewItems] = useState<MediaReviewItem[]>([]);
  const [mediaReviewActiveIndex, setMediaReviewActiveIndex] = useState(0);
  const [mediaReviewCaption, setMediaReviewCaption] = useState('');
  const [mediaReviewQualityMode, setMediaReviewQualityMode] = useState<ChatMediaQualityMode>('standard');
  const [isSendingMediaReview, setIsSendingMediaReview] = useState(false);
  const [chatMediaNetworkPolicy, setChatMediaNetworkPolicy] = useState<ChatMediaNetworkPolicy>(() =>
    buildChatMediaNetworkPolicy(null, DEFAULT_CHAT_OFFLINE_POLICY_SETTINGS)
  );
  const [chatOfflinePolicySettings, setChatOfflinePolicySettings] = useState<ChatOfflinePolicySettings>(() =>
    DEFAULT_CHAT_OFFLINE_POLICY_SETTINGS
  );
  const [chatOfflineMetrics, setChatOfflineMetrics] = useState<ChatOfflineMetricsSnapshot>(() =>
    createEmptyChatOfflineMetricsSnapshot()
  );
  const [isLoadingOfflineChatSettings, setIsLoadingOfflineChatSettings] = useState(false);
  const [isSavingOfflineChatSettings, setIsSavingOfflineChatSettings] = useState(false);
  const [guidedSetupJourneyState, setGuidedSetupJourneyState] = useState<GuidedSetupJourneyState | null>(null);
  const [isGuidedSetupReady, setIsGuidedSetupReady] = useState(false);
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(false);
  const [guidedSetupTargetRects, setGuidedSetupTargetRects] = useState<Partial<Record<GuidedSetupTargetKind, GuidedSetupTargetRect>>>({});
  const [audioAttachmentPreview, setAudioAttachmentPreview] = useState<AudioAttachmentPreviewState | null>(null);
  const [mediaViewer, setMediaViewer] = useState<MediaViewerState | null>(null);
  const [sentPhotoEditor, setSentPhotoEditor] = useState<SentPhotoEditorState | null>(null);
  const [isSendingSentPhotoEdit, setIsSendingSentPhotoEdit] = useState(false);
  const [preparingVideoKey, setPreparingVideoKey] = useState<string | null>(null);
  // The thread is owned by chatThreadStore, not by this component.
  //
  // `messages` is a view of that store, and `setMessages` writes through to it.
  // Keeping the familiar signature means the existing call sites did not all
  // have to change at once, while every write — including the ones that used to
  // forget — now passes through the store's invariants: identity de-duplication,
  // delivery status that only moves forward, local media that survives a server
  // copy, and media paths resolved for this install.
  //
  // Migrating individual call sites to the store's semantic operations
  // (upsert / update / remove) is the next slice; this establishes the single
  // source of truth without a risky mass rewrite.
  const [messages, setMessagesState] = useState<ChatMessage[]>([]);
  const setMessages = useCallback((
    next: ChatMessage[] | ((currentMessages: ChatMessage[]) => ChatMessage[])
  ) => {
    const contactId = selectedChatRef.current?.contactId;

    if (!contactId) {
      return;
    }

    const currentMessages = getChatThread(contactId);
    const nextMessages = typeof next === 'function' ? next(currentMessages) : next;

    // Membership from the caller, content merged with what the store holds.
    // A rebuild from cache or a server echo must not strip the local file a
    // message already has.
    reconcileChatThread(contactId, nextMessages);
  }, []);
  const [messageActionTarget, setMessageActionTarget] = useState<ChatMessage | null>(null);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  /**
   * How many replies each message has, from the device's own store.
   *
   * Counted in SQLite over the whole conversation, because a message and its
   * replies are deliberately far apart here and counting what happens to be
   * loaded is wrong exactly when the distance is greatest.
   */
  const [storedReplyIds, setStoredReplyIds] = useState<Record<string, string[]>>({});
  const [isForwardMode, setIsForwardMode] = useState(false);
  const [forwardSelectedMessageIds, setForwardSelectedMessageIds] = useState<Record<string, boolean>>({});
  const [forwardRecipientIds, setForwardRecipientIds] = useState<Record<string, boolean>>({});
  const [isForwardRecipientModalOpen, setIsForwardRecipientModalOpen] = useState(false);
  const [isForwardingMessages, setIsForwardingMessages] = useState(false);
  const [isMessageDeleteMode, setIsMessageDeleteMode] = useState(false);
  const [deleteSelectedMessageIds, setDeleteSelectedMessageIds] = useState<Record<string, boolean>>({});
  const [isDeletingSelectedMessages, setIsDeletingSelectedMessages] = useState(false);
  const [isConversationSearchOpen, setIsConversationSearchOpen] = useState(false);
  const [messageListModalMode, setMessageListModalMode] = useState<MessageListModalMode | null>(null);
  const [messageListSearch, setMessageListSearch] = useState('');
  const [nativeOptionPicker, setNativeOptionPicker] = useState<NativeOptionPickerState | null>(null);
  const [nativeDateTimePrompt, setNativeDateTimePrompt] = useState<NativeDateTimePromptState | null>(null);
  const [messageReactions, setMessageReactions] = useState<ChatMessageReactionMap>({});
  const [chatNotificationSettingsByContactId, setChatNotificationSettingsByContactId] = useState<Record<string, ChatNotificationSettings>>({});
  const [chatTranscriptLanguageByContactId, setChatTranscriptLanguageByContactId] = useState<Record<string, ChatTranscriptLanguageSetting>>({});
  const [directContactDetailsByContactId, setDirectContactDetailsByContactId] = useState<Record<string, DirectChatContactDetails>>({});
  const [addToGroupTargetsByContactId, setAddToGroupTargetsByContactId] = useState<Record<string, AddableChatGroup[]>>({});
  const [starredMessageIds, setStarredMessageIds] = useState<Record<string, boolean>>({});
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const [actionDraftMessage, setActionDraftMessage] = useState<ChatMessage | null>(null);
  const [isCreatingAction, setIsCreatingAction] = useState(false);
  const [chatActions, setChatActions] = useState<ActionRecord[]>([]);
  const [isChatCameraOpen, setIsChatCameraOpen] = useState(false);
  const [lastChatBackupAtMs, setLastChatBackupAtMs] = useState<number | null>(null);
  const [chatBackupError, setChatBackupError] = useState<string | null>(null);
  const [chatBackupRestoreStatus, setChatBackupRestoreStatus] =
    useState<ChatBackupRestoreStatus | null>(null);
  const [openAction, setOpenAction] = useState<ActionRecord | null>(null);
  const [actionCounts, setActionCounts] = useState<{ pending: number; unverified: number }>(
    { pending: 0, unverified: 0 }
  );
  const [activeSynzappCall, setActiveSynzappCall] = useState<ActiveSynzappCall | null>(null);
  const [activeTrashSegmentId, setActiveTrashSegmentId] = useState<string | null>(null);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const hasAnnouncedReadyRef = useRef(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingOlderCachedMessages, setIsLoadingOlderCachedMessages] = useState(false);
  const [isLoadingChatNotificationSettings, setIsLoadingChatNotificationSettings] = useState(false);
  const [isSavingChatNotificationSettings, setIsSavingChatNotificationSettings] = useState(false);
  const [isLoadingChatTranscriptLanguage, setIsLoadingChatTranscriptLanguage] = useState(false);
  const [isSavingChatTranscriptLanguage, setIsSavingChatTranscriptLanguage] = useState(false);
  const [isLoadingDirectContactDetails, setIsLoadingDirectContactDetails] = useState(false);
  const [isLoadingAddToGroups, setIsLoadingAddToGroups] = useState(false);
  const [isSavingAddToGroups, setIsSavingAddToGroups] = useState(false);
  const [isSavingGroupAddMembers, setIsSavingGroupAddMembers] = useState(false);
  const [isExitingGroupChat, setIsExitingGroupChat] = useState(false);
  const [isUpdatingGroupPhoto, setIsUpdatingGroupPhoto] = useState(false);
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
  const [isLoadingKeyResults, setIsLoadingKeyResults] = useState(false);
  const [isLoadingChatBackupPolicy, setIsLoadingChatBackupPolicy] = useState(false);
  const [isSavingChatBackupPolicy, setIsSavingChatBackupPolicy] = useState(false);
  const [isSavingCompanyProfile, setIsSavingCompanyProfile] = useState(false);
  const [isSavingCompanyLogo, setIsSavingCompanyLogo] = useState(false);
  const [isSavingKeyResults, setIsSavingKeyResults] = useState(false);
  const [isSavingDepartmentAdminPermissions, setIsSavingDepartmentAdminPermissions] = useState(false);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [isSavingRolePermissions, setIsSavingRolePermissions] = useState(false);
  const [isLoadingUserProfile, setIsLoadingUserProfile] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSyncingChatBackup, setIsSyncingChatBackup] = useState(false);
  const [isSavingUserPhoto, setIsSavingUserPhoto] = useState(false);
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [isRevokingDevice, setIsRevokingDevice] = useState(false);
  const [isRevokingMyDevice, setIsRevokingMyDevice] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);
  const [newRecordDescription, setNewRecordDescription] = useState('');
  const [newRecordName, setNewRecordName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDepartment, setNewGroupDepartment] = useState<TenantDepartment | null>(null);
  const [companyAddressDraft, setCompanyAddressDraft] = useState('');
  const [companyNameDraft, setCompanyNameDraft] = useState('');
  const [companyCalendarYearStartDateDraft, setCompanyCalendarYearStartDateDraft] = useState<string | null>(null);
  const [companyCalendarYearPickerDate, setCompanyCalendarYearPickerDate] = useState<Date>(new Date());
  const [isCompanyCalendarYearPickerOpen, setIsCompanyCalendarYearPickerOpen] = useState(false);
  const [companyKeyResults, setCompanyKeyResults] = useState<CompanyKeyResultsConfig>(defaultKeyResultsConfig);
  const [keyResultGroupNameDraft, setKeyResultGroupNameDraft] = useState('');
  const [keyResultUnitLabelDraft, setKeyResultUnitLabelDraft] = useState('');
  const [keyResultUnitSuffixDraft, setKeyResultUnitSuffixDraft] = useState('');
  const [keyResultUnitIconDraft, setKeyResultUnitIconDraft] = useState<FeatherIconName>('hash');
  const [keyResultMetricDrafts, setKeyResultMetricDrafts] = useState<Record<string, { key: string; unitId: string; value: string }>>({});
  const [isKeyResultUnitModalOpen, setIsKeyResultUnitModalOpen] = useState(false);
  const [isKeyResultsOptionsMenuOpen, setIsKeyResultsOptionsMenuOpen] = useState(false);
  const [isKeyResultsSelecting, setIsKeyResultsSelecting] = useState(false);
  const [keyResultsSelected, setKeyResultsSelected] = useState<Record<string, { groupId: string; metricId?: string }>>({});
  const [isKeyResultsContentScrollEnabled, setIsKeyResultsContentScrollEnabled] = useState(true);
  const [organizationDeletionModal, setOrganizationDeletionModal] = useState<OrganizationDeletionModalState | null>(null);
  const [organizationDeletionConfirmation, setOrganizationDeletionConfirmation] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [isRequestingOrganizationDeletion, setIsRequestingOrganizationDeletion] = useState(false);
  const [isVerifyingOrganizationDeletionOtp, setIsVerifyingOrganizationDeletionOtp] = useState(false);
  const [isDeletingOrganization, setIsDeletingOrganization] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const isMobileSeatPromptPendingRef = useRef(false);
  /**
   * Chat is on another phone and this one has not taken it.
   *
   * Kept because declining is a state, not a dismissal. Registration stays
   * refused, and fifty-five calls across chat, profile, the interpreter and the
   * company library need the device it would have registered — so without this
   * the person sat behind a popup they could not answer, raised from any of
   * seventy places, with no way back but restarting the app.
   */
  const heldMobileSeatRef = useRef<MobileSeatHolder | null>(null);
  const [heldMobileSeat, setHeldMobileSeatState] = useState<MobileSeatHolder | null>(null);
  const setHeldMobileSeat = useCallback((seat: MobileSeatHolder | null) => {
    // The ref is read by `setError`, which runs outside render and cannot wait
    // for one; the state is what draws the notice. They are set together.
    heldMobileSeatRef.current = seat;
    setHeldMobileSeatState(seat);
  }, []);
  /**
   * While chat is being claimed, the banner stays out of the way.
   *
   * Every API call asks for device headers, so a held seat fails all of them and
   * each failure reached one of the seventy places that raise the banner. The
   * person saw a generic "something needs attention" instead of the question,
   * and it came back the moment they dismissed it. The question is asked by its
   * own prompt; nothing else needs to speak until it is answered.
   */
  const setError = useCallback((message: string | null) => {
    // Everything failing while chat is on another phone has one cause, and it is
    // already being explained. Reporting each failure separately buries that.
    if (message && (isMobileSeatPromptPendingRef.current || heldMobileSeatRef.current)) {
      return;
    }

    setErrorState(message);
  }, []);
  const [mediaPreparationProgress, setMediaPreparationProgress] = useState<IPhonePhotoPreparationProgress | null>(null);
  const backupSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isBackupSyncingRef = useRef(false);
  const chatContactCacheTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushNotificationRegistrationStartedRef = useRef(false);
  const realtimePresenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const companyDataWipeSyncInFlightRef = useRef(false);
  const deviceIdentityRegistrationStartedRef = useRef(false);
  const activeLocalSendQueueIdsRef = useRef<Set<string>>(new Set());
  const pendingSyncContactIdsRef = useRef<Set<string>>(new Set());
  const locallyDeletedChatContactIdsRef = useRef<Set<string>>(new Set());
  const activePushHydrationContactIdsRef = useRef<Set<string>>(new Set());
  const activeMediaDownloadPromisesRef = useRef<Map<string, Promise<string | null>>>(new Map());
  const autoMediaDownloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatMediaNetworkPolicyRef = useRef<ChatMediaNetworkPolicy>(chatMediaNetworkPolicy);
  const chatOfflinePolicySettingsRef = useRef<ChatOfflinePolicySettings>(chatOfflinePolicySettings);
  const latestNetInfoStateRef = useRef<NetInfoState | null>(null);
  const guidedSetupScreenRef = useRef<View | null>(null);
  const guidedSetupBootstrapStartedRef = useRef(false);
  const organizationDeletionProgressAnim = useRef(new Animated.Value(0)).current;
  const chatContactsRef = useRef<ChatContact[]>([]);
  const chatOpenRequestIdRef = useRef(0);
  const clearChatRequestIdRef = useRef(0);
  const hasResolvedChatContactsRef = useRef(false);
  const realtimeReadyRef = useRef(false);
  const realtimeSocketRef = useRef<WebSocket | null>(null);
  // Keyed by the conversation the typing belongs to, so the chat list can mark
  // several rows at once while the open thread reads only its own.
  const [typingByConversation, setTypingByConversation] = useState<Record<string, TypingParticipant[]>>({});
  const callKeepSetupRef = useRef(false);
  const callRealtimeReadyRef = useRef(false);
  const callRealtimeReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callRealtimeSocketRef = useRef<WebSocket | null>(null);
  const activeSynzappCallRef = useRef<ActiveSynzappCall | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const callLocalStreamRef = useRef<any>(null);
  const callPeerConnectionsRef = useRef<Record<string, any>>({});
  const callOfferStartedIdsRef = useRef<Set<string>>(new Set());
  const callKeepEventSubscriptionsRef = useRef<Array<{ remove?: () => void }>>([]);
  const callRingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCallSignalsRef = useRef<Array<Extract<SynzappCallRealtimeEvent, { type: 'callSignal' }>>>([]);
  const callHistoryRef = useRef<SynzappCallHistoryEntry[]>([]);
  const callFavoriteContactIdsRef = useRef<string[]>([]);
  const scheduledCallsRef = useRef<SynzappScheduledCall[]>([]);
  const selectedChatRef = useRef<ChatItem | null>(null);
  const activeTrashSegmentIdRef = useRef<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const oldestCachedMessageSentAtMsRef = useRef<number | null>(null);
  const hasMoreCachedMessagesBeforeRef = useRef(false);
  const isLoadingOlderCachedMessagesRef = useRef(false);
  const permissions = userProfile?.permissions ?? verifiedAdmin.session.user.permissions ?? [];
  const currentUid = verifiedAdmin.session.user.uid;
  const canInviteEmployees = hasPermission(permissions, 'users.invite');
  const canManageUsers = hasPermission(permissions, 'users.manage');
  // Mirrors the backend rule. A department admin holds users.invite and is
  // refused there, and so is any department but Human Resources, so offering
  // the switch in either case would only produce an error nobody can act on.
  const canOfferOrgAdmin = canOfferOrgAdminInvite({
    departmentId: inviteDraft?.department.departmentId || null,
    permissions,
    role: userProfile?.role || null
  });
  const canManageDirectory = hasPermission(permissions, 'departments.manage') && hasPermission(permissions, 'roles.manage');
  const canManageCompanyProfile = hasPermission(permissions, 'tenant.update');
  const canManageGroups = hasPermission(permissions, 'groups.manage') || hasPermission(permissions, 'groups.create');
  const canManageSecurity = hasPermission(permissions, 'security.manage');
  const canManageAiUsage = canManageCompanyProfile || canManageSecurity;
  const canViewEmployees = canInviteEmployees || canManageUsers;
  const canDeleteOrganization = userProfile?.isTenantOwner === true;
  const handleGuidedSetupTargetLayout = useCallback((targetKind: GuidedSetupTargetKind) => (
    event: LayoutChangeEvent
  ) => {
    const reactTag = (event.nativeEvent as { target?: number }).target;
    const rootTag = findNodeHandle(guidedSetupScreenRef.current);

    if (!reactTag || !rootTag) {
      return;
    }

    requestAnimationFrame(() => {
      UIManager.measureLayout(reactTag, rootTag, () => undefined, (x, y, width, height) => {
        if (width <= 0 || height <= 0) {
          return;
        }

        setGuidedSetupTargetRects((currentRects) => {
          const nextRect = normalizeGuidedSetupMeasuredRect({ height, radius: 0, width, x, y });
          const currentRect = currentRects[targetKind];

          if (
            currentRect &&
            Math.abs(currentRect.x - nextRect.x) < 1 &&
            Math.abs(currentRect.y - nextRect.y) < 1 &&
            Math.abs(currentRect.width - nextRect.width) < 1 &&
            Math.abs(currentRect.height - nextRect.height) < 1
          ) {
            return currentRects;
          }

          return {
            ...currentRects,
            [targetKind]: nextRect
          };
        });
      });
    });
  }, []);
  const visibleFooterTabs: FooterTab[] = canViewEmployees
    // No Groups tab. It listed the groups a person belongs to and opened the
    // group chat, which is what the chat list already does — and every group
    // now appears there whether or not anything has been said in it.
    ? ['Chats', 'Calls', 'Announcements', 'Employees', 'Settings', 'You']
    : ['Chats', 'Calls', 'Announcements', 'Settings', 'You'];
  // Sending is a permission. Receiving is not: everybody sees the tab, and
  // only those allowed to send are offered the compose button inside it.
  //
  // The server decides in the end. This only chooses whether to show a button,
  // and a hidden button was never a permission check.
  const [announcementsForMe, setAnnouncementsForMe] = useState<Announcement[]>([]);
  const [addressableGroups, setAddressableGroups] = useState<AnnouncementAudienceGroup[]>([]);
  /**
   * Actions raised in the conversation on screen.
   *
   * Two lists in one: the ones raised here, and the ones handed to this group.
   * A maintenance group needs to see work sent to it; the line that reported a
   * fault needs to see what became of it.
   */
  const refreshChatActions = useCallback(async (chat: ChatItem | null) => {
    if (!chat) {
      setChatActions([]);

      return;
    }

    try {
      const idToken = await getIdToken();
      const [raisedHere, assignedHere] = await Promise.all([
        listActions({ chatId: chat.contactId, chatType: chat.chatType, idToken }),
        chat.chatType === 'GROUP'
          ? listActions({ groupId: chat.contactId, idToken })
          : Promise.resolve({ actions: [], nextCursor: null })
      ]);
      const byId = new Map<string, ActionRecord>();

      for (const action of [...raisedHere.actions, ...assignedHere.actions]) {
        byId.set(action.actionId, action);
      }

      // A chat deleted for this account must open empty. The action records
      // themselves are untouched: the department group, the Actions console and
      // the auditor's export all still see them. See
      // filterActionsAfterChatCleared.
      setChatActions(filterActionsAfterChatCleared([...byId.values()], chat.clearedAt));

      if (chat.chatType === 'GROUP') {
        setActionCounts(await getActionCounts({ groupId: chat.contactId, idToken }));
      } else {
        setActionCounts({ pending: 0, unverified: 0 });
      }
    } catch {
      // A conversation that will not load its actions still has to open. The
      // messages are the point; the actions are extra.
      setChatActions([]);
      setActionCounts({ pending: 0, unverified: 0 });
    }
  }, []);

  useEffect(() => {
    void refreshChatActions(selectedChat);
  }, [refreshChatActions, selectedChat?.contactId]);

  const handleCreateActionFromMessage = useCallback((message: ChatMessage) => {
    setActionDraftMessage(message);
  }, []);

  const handleSubmitAction = useCallback(async (draft: CreateActionDraft) => {
    const chat = selectedChatRef.current;

    if (!actionDraftMessage || !chat || !draft.responsibleGroupId) {
      return;
    }

    setIsCreatingAction(true);

    try {
      const idToken = await getIdToken();
      const attachmentIds = draft.attachments.length
        ? await uploadPickedMedia({ idToken, media: draft.attachments })
        : [];
      const created = await createActionRequest({
        action: {
          attachmentIds,
          dueAtMs: draft.dueAtMs,
          priority: draft.priority,
          responsibleGroupId: draft.responsibleGroupId,
          responsiblePersonUid: draft.responsiblePersonUid,
          sourceChatId: chat.contactId,
          sourceChatType: chat.chatType,
          sourceChatName: chat.title,
          sourceMessageId: actionDraftMessage.messageId,
          title: draft.title
        },
        idToken
      });

      // Shown straight away rather than waiting for a refresh, so raising an
      // action feels like sending a message rather than filing a form.
      setChatActions((current) => [...current.filter((item) => item.actionId !== created.actionId), created]);
      setActionDraftMessage(null);
    } catch (nextError) {
      Alert.alert('Create Action', getErrorMessage(nextError, 'That action could not be created.'));
    } finally {
      setIsCreatingAction(false);
    }
  }, [actionDraftMessage]);

  const handleActionChanged = useCallback((updated: ActionRecord) => {
    setChatActions((current) => current.map(
      (item) => (item.actionId === updated.actionId ? updated : item)
    ));
    setOpenAction(updated);
    void refreshChatActions(selectedChatRef.current);
    // The line above the chat list counts what this person owes, and finishing
    // or moving an action changes it. Without this it kept saying whatever it
    // said when the app started.
    void refreshMyActionCountsRef.current();
  }, [refreshChatActions]);

  const openAnnouncement = useCallback((announcement: Announcement) => {
    showAnnouncementAlert({
      announcement,
      onAcknowledge: async () => {
        await acknowledgeAnnouncementRequest({
          announcementId: announcement.announcementId,
          idToken: await getIdToken()
        });
        markAcknowledgedLocally(announcement.announcementId);
      }
    });
  }, []);

  useEffect(() => subscribeToAnnouncements(setAnnouncementsForMe), []);

  useEffect(() => {
    void refreshAnnouncements(() => getIdToken());

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshAnnouncements(() => getIdToken(), { force: true });
      }
    });

    return () => subscription.remove();
  }, []);

  const announcementSenderRole = userProfile?.role || verifiedAdmin.session.user.role;
  const canSendAnnouncements = announcementSenderRole === 'ORG_ADMIN' ||
    announcementSenderRole === 'DEPT_ADMIN' ||
    hasPermission(permissions, 'announcements.send') ||
    hasPermission(permissions, 'groups.create');
  /**
   * The audiences this person may choose from.
   *
   * Offered no wider than the server will allow, so nobody picks an audience
   * and is then refused. The server still checks: this only decides what to
   * show.
   */
  const pinnedChatAnnouncement = useMemo(() => {
    if (!selectedChat) {
      return null;
    }

    const groupId = selectedChat.chatType === 'GROUP' ? selectedChat.contactId : null;
    const group = groupId ? groups.find((entry) => entry.groupId === groupId) : undefined;

    return findAnnouncementToPin(
      announcementsForMe,
      {
        chatDepartmentId: group?.departmentId || null,
        directContactUid: selectedChat.chatType === 'DIRECT' ? selectedChat.contactId : null,
        groupId,
        isDepartmentDefaultChat: selectedChat.isDepartmentDefault === true
      },
      {
        departmentId: userProfile?.departmentId || null,
        uid: currentUid
      }
    );
  }, [announcementsForMe, currentUid, groups, selectedChat, userProfile?.departmentId]);

  // Stable across renders. Passed to screens that fetch when it changes, and a
  // fresh arrow function each render made "when it changes" mean "always".
  const getAnnouncementIdToken = useCallback(() => getIdToken(), []);

  const outstandingAnnouncementCount = useMemo(
    () => countOutstandingForReader(announcementsForMe),
    [announcementsForMe]
  );

  const personalAnnouncements = useMemo(
    () => findAnnouncementsForChatList(announcementsForMe, {
      departmentId: userProfile?.departmentId || null,
      uid: currentUid
    }),
    [announcementsForMe, currentUid, userProfile?.departmentId]
  );

  /** Teams an action can be handed to. Every group in the company, not only
      the ones this person is in: the operator who spots a fault rarely belongs
      to the team that fixes it. */
  /**
   * Loads the teams and people the action form needs, when it opens.
   *
   * Both lists were being filled as a side effect of visiting other screens —
   * groups by the Settings tab, employees by the Employees tab, addressable
   * groups by Announcements. Open Create Action from a chat without having been
   * to any of them and the form offered nothing to choose from, which is a
   * dead end rather than a delay.
   *
   * Only fetched when a list is actually empty, so the common case of opening
   * this twice costs one round trip rather than two.
   */
  useEffect(() => {
    if (!actionDraftMessage) {
      return;
    }

    if (!groups.length) {
      void loadGroupSettings(false);
    }

    // The directory is the list every role may read, so it is fetched first
    // and unconditionally.
    void loadDirectoryChatContacts();

    if (!approvedEmployees.length) {
      // Adds departments, and anybody with no conversation yet. Admin-only, so
      // it is expected to fail for everybody else and must do so quietly —
      // somebody turning a message into an action does not need a red banner
      // about a list they were never allowed to read.
      void loadEmployees().catch(() => undefined);
    }

    if (!addressableGroups.length && canSendAnnouncements) {
      // The wider list: teams this person may address rather than only the ones
      // they are in. Preferred by `actionGroupChoices`, and its absence is why
      // an admin saw only their own teams.
      void (async () => {
        try {
          setAddressableGroups(await listAnnouncementAudienceGroups(await getIdToken()));
        } catch {
          // The groups loaded for chat are the fallback, and are already there.
        }
      })();
    }
  }, [actionDraftMessage]);

  const actionGroupChoices = useMemo((): ActionGroupChoice[] => (
    addressableGroups.length
      ? addressableGroups.map((group) => ({
        departmentId: group.departmentId,
        groupId: group.groupId,
        memberCount: group.memberCount,
        name: group.name
      }))
      : groups.map((group) => ({
        departmentId: group.departmentId || null,
        groupId: group.groupId,
        memberCount: group.memberCount || 0,
        name: group.name
      }))
  ), [addressableGroups, groups]);


  const peopleDepartments = useMemo(() => {
    const byUid: Record<string, string> = {};

    for (const employee of approvedEmployees) {
      if (employee.employeeUid && employee.departmentId) {
        byUid[employee.employeeUid] = employee.departmentId;
      }
    }

    return byUid;
  }, [approvedEmployees]);

  const departmentBackedGroups = useMemo(() => {
    const byGroup: Record<string, string> = {};

    for (const group of groups) {
      if (group.memberPolicy === 'DEPARTMENT_PLUS_EXPLICIT' && group.autoMembershipDepartmentId) {
        byGroup[group.groupId] = group.autoMembershipDepartmentId;
      }
    }

    return byGroup;
  }, [groups]);

  const announcementAudiences = useMemo((): AnnouncementAudienceOption[] => {
    const options: AnnouncementAudienceOption[] = [];
    const departmentName = userProfile?.departmentName || 'your department';
    const departmentId = userProfile?.departmentId || null;

    if (announcementSenderRole === 'ORG_ADMIN') {
      options.push({
        description: 'everyone at the company',
        kind: 'ORGANIZATION',
        section: 'SCOPE',
        targetId: null,
        targetName: 'Everyone at the company'
      });
    }

    if (
      (announcementSenderRole === 'ORG_ADMIN' || announcementSenderRole === 'DEPT_ADMIN') &&
      departmentId
    ) {
      options.push({
        description: `everyone in ${departmentName}`,
        kind: 'DEPARTMENT',
        section: 'DEPARTMENTS',
        targetId: departmentId,
        targetName: `${departmentName} department`
      });
    }

    const groupsToOffer = addressableGroups.length
      ? addressableGroups
      : groups
          .filter((group) => !group.status || group.status === 'ACTIVE')
          .map((group) => ({
            departmentId: group.departmentId,
            groupId: group.groupId,
            memberCount: group.memberCount,
            name: group.name
          }));

    for (const group of groupsToOffer) {
      options.push({
        description: `the ${group.memberCount} ${
          group.memberCount === 1 ? 'person' : 'people'
        } in ${group.name}`,
        kind: 'GROUP',
        section: 'GROUPS',
        targetId: group.groupId,
        targetName: group.name
      });
    }

    // Individual people, for a notice that concerns one person. Only offered to
    // those the server will actually accept it from, so nobody picks somebody
    // and is then refused.
    const mayNameIndividuals = announcementSenderRole === 'ORG_ADMIN' ||
      announcementSenderRole === 'DEPT_ADMIN';

    if (mayNameIndividuals) {
      for (const employee of approvedEmployees) {
        // Somebody invited but not yet signed in has no account to receive it.
        if (!employee.employeeUid || employee.employeeUid === currentUid) {
          continue;
        }

        if (
          announcementSenderRole === 'DEPT_ADMIN' &&
          employee.departmentId !== departmentId
        ) {
          continue;
        }

        options.push({
          description: employee.departmentName || 'No department',
          kind: 'PERSON',
          section: 'PEOPLE',
          targetId: employee.employeeUid,
          targetName: employee.displayName || 'Unnamed employee'
        });
      }
    }

    return options;
  }, [
    addressableGroups,
    announcementSenderRole,
    approvedEmployees,
    currentUid,
    groups,
    userProfile?.departmentId,
    userProfile?.departmentName
  ]);
  const chatItems = useMemo(() => chatContacts.map(mapChatContactToChatItem), [chatContacts]);
  const directChatContacts = useMemo(
    () => chatContacts.filter((contact) => (contact.chatType || 'DIRECT') !== 'GROUP'),
    [chatContacts]
  );
  // Joined by id, not by size. The store knows replies this session never
  // loaded; the loaded messages know one just sent that has not been written
  // yet. Neither is a superset of the other, so only identity can tell whether
  // a loaded reply is new or already counted.
  const replyCounts = useMemo(
    () => mergeReplyIds(storedReplyIds, collectReplyIdsInMessages(messages)),
    [messages, storedReplyIds]
  );
  const startableDirectChatContacts = useMemo(
    () => buildStartableDirectChatContacts(
      [...directChatContacts, ...directoryChatContacts],
      approvedEmployees,
      currentUid
    ),
    [approvedEmployees, currentUid, directChatContacts, directoryChatContacts]
  );
  /**
   * The people an action can be given to.
   *
   * Built from the chat directory first, because that is the one list every
   * role may read. It used to come only from `approvedEmployees`, which is
   * fetched from an **admin** endpoint — so for a department admin or an
   * employee the picker was permanently empty, and the only person who could
   * name an owner was the one least likely to be on the floor.
   *
   * The admin list is still merged in where it is available: it carries the
   * department each person belongs to, which the directory does not, and it
   * includes anybody who has not started a conversation yet.
   */
  const actionPeopleChoices = useMemo((): ActionPersonChoice[] => {
    const departmentByUid = new Map<string, { id: string | null; name: string }>();

    for (const employee of approvedEmployees) {
      if (employee.employeeUid) {
        departmentByUid.set(employee.employeeUid, {
          id: employee.departmentId || null,
          name: employee.departmentName || ''
        });
      }
    }

    const chosen = new Map<string, ActionPersonChoice>();

    for (const contact of startableDirectChatContacts) {
      const department = departmentByUid.get(contact.contactId);

      chosen.set(contact.contactId, {
        departmentId: department?.id || null,
        // Their team where it is known, otherwise their role — a second line
        // that says something is what tells two people of the same name apart.
        departmentName: department?.name || contact.roleName || 'No department',
        displayName: contact.displayName,
        uid: contact.contactId
      });
    }

    for (const employee of approvedEmployees) {
      if (!employee.employeeUid || chosen.has(employee.employeeUid)) {
        continue;
      }

      chosen.set(employee.employeeUid, {
        departmentId: employee.departmentId || null,
        departmentName: employee.departmentName || 'No department',
        displayName: employee.displayName || 'Unknown',
        uid: employee.employeeUid
      });
    }

    return [...chosen.values()]
      .filter((person) => person.uid !== currentUid)
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  }, [approvedEmployees, currentUid, startableDirectChatContacts]);

  // Which conversations are groups, so a typing line can name somebody there
  // and stay short in a one-to-one.
  const groupChatContactIds = useMemo(
    () => new Set(chatContacts
      .filter((contact) => contact.chatType === 'GROUP')
      .map((contact) => contact.contactId)),
    [chatContacts]
  );
  const groupChatContacts = useMemo(
    () => chatContacts.filter((contact) => contact.chatType === 'GROUP'),
    [chatContacts]
  );
  const registeredCallContacts = useMemo(
    () => directChatContacts.filter((contact) => contact.status !== 'INVITED' && contact.status !== 'DELETED'),
    [directChatContacts]
  );
  const scheduleCallRecipientContacts = useMemo(
    () => chatContacts.filter(isScheduleCallRecipientContact),
    [chatContacts]
  );
  const currentUserDialIdentity = getCurrentUserDialIdentity(userProfile, verifiedAdmin.phoneNumber);
  const activeVisibleConversationChatItems = useMemo(
    () => chatItems.filter(shouldShowActiveChatInList),
    [chatItems]
  );
  const spamConversationChatItems = useMemo(
    () => chatItems.filter(shouldShowTrashChatInList),
    [chatItems]
  );
  const activeConversationChatItems = useMemo(
    () => activeVisibleConversationChatItems.filter((chat) => !chat.isArchived),
    [activeVisibleConversationChatItems]
  );
  const archivedConversationChatItems = useMemo(
    () => activeVisibleConversationChatItems.filter((chat) => chat.isArchived),
    [activeVisibleConversationChatItems]
  );
  const unreadChatFilterCount = useMemo(
    () => activeConversationChatItems.reduce((total, chat) => total + Math.max(chat.unreadCount || 0, 0), 0),
    [activeConversationChatItems]
  );
  const unreadChatBadgeCount = useMemo(
    () => activeConversationChatItems.filter((chat) => Math.max(chat.unreadCount || 0, 0) > 0).length,
    [activeConversationChatItems]
  );
  const unseenCallCount = useMemo(
    () => callHistory.filter((entry) => entry.unseen).length,
    [callHistory]
  );
  const announcementAttentionCount = useMemo(
    () => countAnnouncementsNeedingAttention(announcementsForMe, currentUid),
    [announcementsForMe, currentUid]
  );
  const groupChatFilterCount = useMemo(
    () => activeConversationChatItems.filter((chat) => chat.chatType === 'GROUP').length,
    [activeConversationChatItems]
  );
  const archivedChatFilterCount = archivedConversationChatItems.length;
  const archivedUnreadTotal = useMemo(
    () => archivedConversationChatItems.reduce((total, chat) => total + Math.max(chat.unreadCount || 0, 0), 0),
    [archivedConversationChatItems]
  );
  const archivedBadgeCount = chatArchiveSettings.archiveBadgeMode === 'UNREAD_COUNT' ? archivedUnreadTotal : 0;
  const selectedForwardMessageCount = Object.values(forwardSelectedMessageIds).filter(Boolean).length;
  const selectedDeleteMessageCount = Object.values(deleteSelectedMessageIds).filter(Boolean).length;
  const selectedForwardRecipientCount = Object.values(forwardRecipientIds).filter(Boolean).length;
  const employeeItems = useMemo(
    () => approvedEmployees.map((employee) =>
      mapApprovedEmployeeToListItem(employee, employeePhoneDisplayById[employee.approvedPhoneId])
    ),
    [approvedEmployees, employeePhoneDisplayById]
  );
  const guidedSetupScope = useMemo(() => ({
    ownerUid: currentUid,
    role: userProfile?.role || verifiedAdmin.session.user.role || 'UNKNOWN',
    tenantId: getActiveTenantId()
  }), [currentUid, userProfile?.role, userProfile?.tenantId, verifiedAdmin.session.user.role, verifiedAdmin.session.user.tenantId]);
  const activeOrgAdminSetupCoachStep = useMemo(() => getOrgAdminSetupCoachStep({
    activeTab,
    canManageDirectory,
    canManageGroups,
    canInviteEmployees,
    chatCount: activeConversationChatItems.length,
    departments,
    directoryFilter,
    employeeCount: approvedEmployees.length,
    groups,
    roles,
    settingsScreen
  }), [
    activeConversationChatItems.length,
    activeTab,
    approvedEmployees.length,
    canInviteEmployees,
    canManageDirectory,
    canManageGroups,
    departments,
    directoryFilter,
    groups,
    roles,
    settingsScreen
  ]);
  const shouldShowOrgAdminSetupCoach = Boolean(
    isGuidedSetupReady &&
    guidedSetupJourneyState?.status === 'active' &&
    activeOrgAdminSetupCoachStep &&
    !selectedChat &&
    !isAddModalOpen &&
    !isAddGroupModalOpen &&
    !isManualInviteModalOpen &&
    !isBatchContactModalOpen &&
    !isThemePreferenceModalOpen &&
    !nativeOptionPicker &&
    !nativeDateTimePrompt
  );
  const isConversationSurfaceOpen = Boolean(selectedChat);
  const shouldHideMainShellForInterpreter = activeTab === 'Interpreter' && isInterpreterRoomOpen;
  const shouldHideMainHeaderForInterpreter = activeTab === 'Interpreter';
  // Interpreter leaves by its own back button, like Actions and the Library.
  // A screen with a back button never also shows the tab bar.
  const isInterpreterSurfaceOpen = activeTab === 'Interpreter';
  const isLibrarySurfaceOpen = activeTab === 'Library';
  const isLswSurfaceOpen = activeTab === 'LSW';
  const isBackNavigableSurface = (activeTab === 'Settings' && settingsScreen !== 'list')
    // Actions leaves by its own back button, so it does not also show the tab
    // bar. One way out, not two.
    || activeTab === 'Actions';
  const shouldShowBottomNavigation = !selectedChat &&
    !isScreenKeyboardVisible &&
    !isBackNavigableSurface &&
    !shouldHideMainShellForInterpreter &&
    !isInterpreterSurfaceOpen &&
    !isLibrarySurfaceOpen &&
    !isLswSurfaceOpen;
  const [footerBarWidth, setFooterBarWidth] = useState(0);
  const isCompactAndroid = Platform.OS === 'android' && height < 720;
  const footerHeight = isCompactAndroid ? 68 : 72;
  const footerTabHeight = isCompactAndroid ? 60 : 64;
  const androidStatusBarHeight = Platform.OS === 'android' ? RNStatusBar.currentHeight || 0 : 0;
  const androidBottomInset = Platform.OS === 'android'
    ? resolveAndroidNavigationInset({
        isKeyboardVisible: isScreenKeyboardVisible,
        safeAreaBottom: insets.bottom,
        screenHeight: Dimensions.get('screen').height,
        statusBarHeight: androidStatusBarHeight,
        tallestWindowHeight: tallestWindowHeight
      })
    : 0;
  // iOS gets 0 here on purpose: the app root's SafeAreaView has already
  // cleared the home indicator, and adding it a second time is what put an
  // empty band under the composer on iPhone. See rootSafeArea.ts.
  const conversationBottomInset = resolveScreenBottomInset({
    androidNavigationInset: androidBottomInset,
    platform: Platform.OS
  });
  // The thread's keyboard-avoiding view measures itself against its parent, so
  // it cannot see the top inset the app root's SafeAreaView applied above it.
  // Without this it lifts the composer short and the keyboard covers it.
  const conversationKeyboardVerticalOffset = resolveKeyboardVerticalOffset({
    platform: Platform.OS,
    safeAreaTop: insets.top
  });
  const footerBottom = Platform.OS === 'android'
    ? androidBottomInset > 0
      ? androidBottomInset + 6
      : 4
    : Math.max(Math.min(insets.bottom, 6), 4);
  const deviceTopInset = Math.max(insets.top, androidStatusBarHeight);
  const headerTopPadding = Platform.OS === 'android' ? Math.max(deviceTopInset + 10, 38) : 8;
  const messageTopPadding = Platform.OS === 'android' ? Math.max(deviceTopInset + 6, 34) : 0;
  const contentBottomPadding = footerBottom + footerHeight + 18;
  const tabContentBottomPadding = isScreenKeyboardVisible ? 18 : contentBottomPadding;
  const askButtonBottom = footerBottom + footerHeight + 16;
  /**
   * Rebuilt only when the token or the device actually changes.
   *
   * As a plain object literal this was a new identity on every render, which
   * gave every avatar a new `source` object, which Android treats as a new
   * image to fetch. That is what made faces blink.
   */
  const profilePhotoHeaders = useMemo(() => (
    profilePhotoAuthToken
      ? {
          Authorization: `Bearer ${profilePhotoAuthToken}`,
          ...(registeredDeviceId ? { 'X-Synzapp-Device-Id': registeredDeviceId } : {})
        }
      : undefined
  ), [profilePhotoAuthToken, registeredDeviceId]);
  const handleKeyResultsSwipeActive = useCallback((isActive: boolean) => {
    setIsKeyResultsContentScrollEnabled(!isActive);
  }, []);
  const filteredChatItems = filterChatItems(
    applyChatListFilter(
      activeConversationChatItems,
      chatListFilter
    ),
    chatSearch
  );
  const filteredArchivedChatItems = filterChatItems(archivedConversationChatItems, chatSearch);
  const filteredSpamChatItems = filterChatItems(spamConversationChatItems, chatSearch);
  const selectedArchivedChatCount = archivedConversationChatItems.filter((chat) =>
    selectedArchivedChatIds[chat.contactId]
  ).length;
  const selectedNewGroupMembers = directChatContacts.filter((contact) => selectedNewGroupMemberIds[contact.contactId]);
  const activeGroupMemberContacts = selectedChat?.chatType === 'GROUP'
    ? mapGroupMembersToSelectableContacts(selectedChat.members || [], directChatContacts, currentUid)
    : [];
  const activeGroupAddableContacts = selectedChat?.chatType === 'GROUP'
    ? getAddableContactsForGroup(selectedChat, directChatContacts, currentUid)
    : [];
  const selectedGroupAddMembers = activeGroupAddableContacts.filter((contact) => selectedGroupAddMemberIds[contact.contactId]);
  const activeGroupOnlineCount = selectedChat?.chatType === 'GROUP'
    ? getOnlineGroupMemberCount(selectedChat, directChatContacts, currentUid)
    : 0;
  const activeGroupStarredMessageCount = selectedChat?.chatType === 'GROUP'
    ? messages.filter((message) => Boolean(starredMessageIds[message.messageId])).length
    : 0;
  const activeChatNotificationSettings = selectedChat
    ? chatNotificationSettingsByContactId[selectedChat.contactId] || null
    : null;
  const activeDirectChatTranscriptLanguage = selectedChat && selectedChat.chatType !== 'GROUP'
    ? chatTranscriptLanguageByContactId[selectedChat.contactId] || null
    : null;
  const activeDirectContactDetails = selectedChat && selectedChat.chatType !== 'GROUP'
    ? directContactDetailsByContactId[selectedChat.contactId] || null
    : null;
  const activeAddToGroupTargets = selectedChat && selectedChat.chatType !== 'GROUP'
    ? addToGroupTargetsByContactId[selectedChat.contactId] || []
    : [];
  const selectedAddToGroupCount = Object.values(selectedAddToGroupIds).filter(Boolean).length;
  const selectedGroupCallMemberCount = Object.values(selectedGroupCallMemberIds).filter(Boolean).length;
  const selectedGroupAddMemberCount = Object.values(selectedGroupAddMemberIds).filter(Boolean).length;
  const companyDisplayName = userProfile?.companyName || companyProfile?.companyName || 'Synzapp';
  useEffect(() => {
    if (isLoadingChats || hasAnnouncedReadyRef.current) {
      return;
    }

    hasAnnouncedReadyRef.current = true;
    onReady?.();
    // Marks the chat list once the chats themselves are up. A message that
    // could not be sent, in a thread nobody opens, would otherwise be invisible
    // until somebody happened to go looking.
    void refreshScheduledChatStates();
    void refreshMyActionCounts();
  }, [isLoadingChats, onReady]);

  // A media tile that cannot read its file reports it here rather than leaving a
  // blank bubble that nothing ever fixes.
  useEffect(() => subscribeMissingChatMedia((report) => {
    void repairReportedMissingChatMedia(report);
  }), []);

  useEffect(() => {
    void configureSynzappNotificationHandling();
    void loadUserProfile(false);
    void loadArchiveSettings(false);
    void recoverNativeTransfersThenSyncPendingMessages();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
      if (nextState === 'active') {
        void loadUserProfile(false);
        void recoverNativeTransfersThenSyncPendingMessages();
        if (selectedChatRef.current && !activeTrashSegmentIdRef.current) {
          void loadMessagesForChat(selectedChatRef.current, false);
        }
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
            enqueueChatRealtimePayload(event.data);
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
    let isMounted = true;

    async function syncCompanyDataWipeCommands() {
      const tenantId = getActiveTenantId();

      if (!tenantId || companyDataWipeSyncInFlightRef.current) {
        return;
      }

      companyDataWipeSyncInFlightRef.current = true;

      try {
        const idToken = await getIdToken(true);
        const result = await processPendingCompanyDataWipeCommands({
          idToken,
          ownerUid: currentUid,
          tenantId
        });

        if (isMounted && result.processedCount > 0) {
          onSessionInvalid(ACCESS_DENIED_MESSAGE);
        }
      } catch {
        // Remote wipe polling is intentionally non-blocking; normal access checks still
        // purge local company data when the backend rejects a revoked session.
      } finally {
        companyDataWipeSyncInFlightRef.current = false;
      }
    }

    void syncCompanyDataWipeCommands();

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void syncCompanyDataWipeCommands();
      }
    });

    return () => {
      isMounted = false;
      appStateSubscription.remove();
    };
  }, [currentUid, onSessionInvalid, userProfile?.tenantId, verifiedAdmin.firebaseUser, verifiedAdmin.session.user.tenantId]);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    let isMounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((isEnabled) => {
        if (isMounted) {
          setIsReduceMotionEnabled(isEnabled);
        }
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setIsReduceMotionEnabled);

    return () => {
      isMounted = false;
      subscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadGuidedSetupState() {
      if (!isOrgAdminSetupCoachEligible({
        canInviteEmployees,
        canManageDirectory,
        ownerUid: guidedSetupScope.ownerUid,
        tenantId: guidedSetupScope.tenantId
      })) {
        setGuidedSetupJourneyState(null);
        setIsGuidedSetupReady(false);
        return;
      }

      const state = await loadGuidedSetupJourneyState(guidedSetupScope);

      if (isMounted) {
        setGuidedSetupJourneyState(state);
        setIsGuidedSetupReady(true);
      }
    }

    void loadGuidedSetupState();

    return () => {
      isMounted = false;
    };
  }, [canInviteEmployees, canManageDirectory, guidedSetupScope]);

  useEffect(() => {
    if (!isGuidedSetupReady || !activeOrgAdminSetupCoachStep || guidedSetupJourneyState?.status !== 'active') {
      return;
    }

    if (guidedSetupJourneyState.lastStepId === activeOrgAdminSetupCoachStep.id) {
      return;
    }

    void saveGuidedSetupJourneyStep(guidedSetupScope, activeOrgAdminSetupCoachStep.id)
      .then(setGuidedSetupJourneyState)
      .catch(() => undefined);
  }, [activeOrgAdminSetupCoachStep, guidedSetupJourneyState?.lastStepId, guidedSetupJourneyState?.status, guidedSetupScope, isGuidedSetupReady]);

  useEffect(() => {
    if (
      guidedSetupBootstrapStartedRef.current ||
      !isOrgAdminSetupCoachEligible({
        canInviteEmployees,
        canManageDirectory,
        ownerUid: guidedSetupScope.ownerUid,
        tenantId: guidedSetupScope.tenantId
      })
    ) {
      return;
    }

    guidedSetupBootstrapStartedRef.current = true;
    void loadOrgAdminSetupReadiness();
  }, [canInviteEmployees, canManageDirectory, guidedSetupScope]);

  useEffect(() => {
    callHistoryRef.current = callHistory;
  }, [callHistory]);

  useEffect(() => {
    callFavoriteContactIdsRef.current = callFavoriteContactIds;
  }, [callFavoriteContactIds]);

  useEffect(() => {
    scheduledCallsRef.current = scheduledCalls;
  }, [scheduledCalls]);

  useEffect(() => {
    let isMounted = true;
    const scope = getLocalCallScope();

    if (!scope) {
      updateLocalCallStoreState({
        favoriteContactIds: [],
        history: [],
        scheduledCalls: []
      });
      return () => {
        isMounted = false;
      };
    }

    loadSynzappCallStore(scope)
      .then((storeData) => {
        if (isMounted) {
          updateLocalCallStoreState(storeData);
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [currentUid, userProfile?.tenantId, verifiedAdmin.session.user.tenantId]);

  useEffect(() => {
    if (activeTab !== 'Calls' || unseenCallCount <= 0) {
      return;
    }

    void persistCallStoreData({
      favoriteContactIds: callFavoriteContactIdsRef.current,
      history: markSynzappCallsSeen(callHistoryRef.current),
      scheduledCalls: scheduledCallsRef.current
    });
  }, [activeTab, unseenCallCount]);

  useEffect(() => {
    if (organizationDeletionModal?.step !== 'deleting') {
      organizationDeletionProgressAnim.stopAnimation();
      organizationDeletionProgressAnim.setValue(0);
      return;
    }

    Animated.loop(
      Animated.sequence([
        Animated.timing(organizationDeletionProgressAnim, {
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          isInteraction: false,
          toValue: 0.92,
          useNativeDriver: false
        }),
        Animated.timing(organizationDeletionProgressAnim, {
          duration: 420,
          easing: Easing.out(Easing.ease),
          isInteraction: false,
          toValue: 0.18,
          useNativeDriver: false
        })
      ])
    ).start();
  }, [organizationDeletionModal?.step, organizationDeletionProgressAnim]);

  useEffect(() => {
    activeTrashSegmentIdRef.current = activeTrashSegmentId;
    sendActiveRealtimeConversationSubscription();
  }, [activeTrashSegmentId, selectedChat?.contactId]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // The open conversation's thread comes from the store. Switching chats just
  // points this subscription at a different thread — the component never holds
  // a second copy that could drift from it.
  useEffect(() => {
    const contactId = selectedChat?.contactId;

    if (!contactId) {
      setMessagesState([]);
      return;
    }

    setMessagesState(getChatThread(contactId));

    return subscribeChatThread(contactId, setMessagesState);
  }, [selectedChat?.contactId]);

  useEffect(() => {
    chatMediaNetworkPolicyRef.current = chatMediaNetworkPolicy;
  }, [chatMediaNetworkPolicy]);

  useEffect(() => {
    chatOfflinePolicySettingsRef.current = chatOfflinePolicySettings;
    setChatMediaCacheBudgetBytes(chatOfflinePolicySettings.fullMediaCacheBudgetBytes);
    setChatMediaCacheRetentionDays(chatOfflinePolicySettings.cacheRetentionDays);
    setChatMediaLimitBytes(chatOfflinePolicySettings.mediaLimitBytes);
    setChatMediaNetworkPolicy(buildChatMediaNetworkPolicy(latestNetInfoStateRef.current, chatOfflinePolicySettings));
    void enforceChatMediaCachePolicy()
      .then(refreshOfflineChatMetrics)
      .catch(() => undefined);
  }, [chatOfflinePolicySettings]);

  useEffect(() => {
    let isMounted = true;
    const scope = getLocalChatScope();

    async function loadOfflineChatControls() {
      setIsLoadingOfflineChatSettings(true);

      try {
        const [settings, metrics, cacheSizeBytes, queueItems] = await Promise.all([
          loadChatOfflinePolicySettings(scope),
          loadChatOfflineMetrics(scope),
          getChatMediaCacheSizeBytes(),
          listLocalChatMediaTransferQueue(scope).catch(() => [])
        ]);

        if (!isMounted) {
          return;
        }

        chatOfflinePolicySettingsRef.current = settings;
        setChatOfflinePolicySettings(settings);
        setChatMediaCacheBudgetBytes(settings.fullMediaCacheBudgetBytes);
        setChatMediaCacheRetentionDays(settings.cacheRetentionDays);
        setChatMediaLimitBytes(settings.mediaLimitBytes);
        setChatMediaNetworkPolicy(buildChatMediaNetworkPolicy(latestNetInfoStateRef.current, settings));
        const gaugeMetrics = await updateChatOfflineGaugeMetrics(scope, {
          cacheSizeBytes,
          mediaQueueDepth: queueItems.length
        }).catch(() => metrics);

        if (isMounted) {
          setChatOfflineMetrics(gaugeMetrics);
        }

        getIdToken()
          .then(getTenantChatOfflinePolicy)
          .then(async (remoteSettings) => {
            await saveChatOfflinePolicySettings(scope, remoteSettings).catch(() => undefined);

            if (!isMounted) {
              return;
            }

            chatOfflinePolicySettingsRef.current = remoteSettings;
            setChatOfflinePolicySettings(remoteSettings);
            setChatMediaLimitBytes(remoteSettings.mediaLimitBytes);
          })
          .catch(() => undefined);
      } finally {
        if (isMounted) {
          setIsLoadingOfflineChatSettings(false);
        }
      }
    }

    void loadOfflineChatControls();

    return () => {
      isMounted = false;
    };
  }, [currentUid, userProfile?.tenantId, verifiedAdmin.session.user.tenantId]);

  useEffect(() => {
    activeSynzappCallRef.current = activeSynzappCall;
  }, [activeSynzappCall]);

  useEffect(() => {
    chatContactsRef.current = chatContacts;
    void syncSynzappUnreadBadgeCount(chatContacts.filter((contact) => contact.isSpam !== true)).catch(() => undefined);

    if (!hasResolvedChatContactsRef.current) {
      return;
    }

    if (chatContactCacheTimerRef.current) {
      clearTimeout(chatContactCacheTimerRef.current);
    }

    chatContactCacheTimerRef.current = setTimeout(() => {
      void saveCachedChatContacts({
        contacts: chatContacts,
        ...getLocalChatScope()
      }).catch(() => undefined);
      chatContactCacheTimerRef.current = null;
    }, 350);

    return () => {
      if (chatContactCacheTimerRef.current) {
        clearTimeout(chatContactCacheTimerRef.current);
        chatContactCacheTimerRef.current = null;
      }
    };
  }, [chatContacts, currentUid, userProfile?.tenantId, verifiedAdmin.session.user.tenantId]);

  useEffect(() => {
    if (!selectedChat) {
      return;
    }

    if (autoMediaDownloadTimerRef.current) {
      clearTimeout(autoMediaDownloadTimerRef.current);
    }

    autoMediaDownloadTimerRef.current = setTimeout(() => {
      const activeChat = selectedChatRef.current;

      if (!activeChat) {
        return;
      }

      InteractionManager.runAfterInteractions(() => {
        if (selectedChatRef.current?.contactId !== activeChat.contactId) {
          return;
        }

        queueMediaDownloadsForMessages(activeChat.contactId, messagesRef.current, activeChat.chatType, true);
      });

      autoMediaDownloadTimerRef.current = null;
    }, 700);

    return () => {
      if (autoMediaDownloadTimerRef.current) {
        clearTimeout(autoMediaDownloadTimerRef.current);
        autoMediaDownloadTimerRef.current = null;
      }
    };
  }, [chatMediaNetworkPolicy, messages, selectedChat?.chatType, selectedChat?.contactId]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      latestNetInfoStateRef.current = state;
      setChatMediaNetworkPolicy(buildChatMediaNetworkPolicy(state, chatOfflinePolicySettingsRef.current));
    });

    void NetInfo.fetch()
      .then((state) => {
        latestNetInfoStateRef.current = state;
        setChatMediaNetworkPolicy(buildChatMediaNetworkPolicy(state, chatOfflinePolicySettingsRef.current));
      })
      .catch(() => undefined);

    return unsubscribe;
  }, []);

  useEffect(() => () => {
    if (backupSyncTimerRef.current) {
      clearTimeout(backupSyncTimerRef.current);
      backupSyncTimerRef.current = null;
    }
    if (chatContactCacheTimerRef.current) {
      clearTimeout(chatContactCacheTimerRef.current);
      chatContactCacheTimerRef.current = null;
    }
    if (callRealtimeReconnectTimerRef.current) {
      clearTimeout(callRealtimeReconnectTimerRef.current);
      callRealtimeReconnectTimerRef.current = null;
    }
    if (callRingTimeoutRef.current) {
      clearTimeout(callRingTimeoutRef.current);
      callRingTimeoutRef.current = null;
    }
    const callSocket = callRealtimeSocketRef.current;
    callRealtimeSocketRef.current = null;
    callSocket?.close();
    callKeepEventSubscriptionsRef.current.forEach((subscription) => {
      try {
        subscription.remove?.();
      } catch {
        // Ignore native listener cleanup errors during screen teardown.
      }
    });
    callKeepEventSubscriptionsRef.current = [];
    void cleanupSynzappCallMedia();
  }, []);

  useEffect(() => {
    return addChatPushNotificationListeners({
      // A push means something changed. Announcements carry no payload of
      // their own, so this is what makes one appear without the person having
      // to leave the screen and come back.
      onAnyReceived: () => {
        void refreshAnnouncements(() => getIdToken(), { force: true });
      },
      onCallReceived: (data) => {
        void handleIncomingCallPushNotification(data);
      },
      onCallResponse: (data) => {
        void handleIncomingCallPushNotification(data);
      },
      onReceived: (data) => {
        void hydrateChatFromPushNotification(data);
      },
      onResponse: (data) => {
        void openChatFromPushNotification(data);
      }
    });
  }, []);

  useEffect(() => {
    let isActive = true;
    const handleIncomingCallUrl = (url: string | null) => {
      const data = parseIncomingCallDeepLink(url);

      if (data) {
        void handleIncomingCallPushNotification(data);
      }
    };
    const subscription = Linking.addEventListener('url', (event) => {
      handleIncomingCallUrl(event.url);
    });

    void Linking.getInitialURL()
      .then((url) => {
        if (isActive) {
          handleIncomingCallUrl(url);
        }
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    const subscription = addSynzappVoipCallEventListener((event) => {
      void handleSynzappVoipCallEvent(event);
    });

    void getPendingSynzappVoipCallEvents()
      .then((events) => {
        if (!isActive) {
          return;
        }

        events.forEach((event) => {
          void handleSynzappVoipCallEvent(event);
        });
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!registeredDeviceId) {
      return;
    }

    void connectCallRealtimeSocket();

    return () => {
      callRealtimeReadyRef.current = false;
      if (callRealtimeReconnectTimerRef.current) {
        clearTimeout(callRealtimeReconnectTimerRef.current);
        callRealtimeReconnectTimerRef.current = null;
      }
      const callSocket = callRealtimeSocketRef.current;
      callRealtimeSocketRef.current = null;
      callSocket?.close();
    };
  }, [registeredDeviceId]);

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
    if (activeTab !== 'Settings' || settingsScreen !== 'key-results' || !canManageCompanyProfile) {
      return;
    }

    void loadKeyResults();
  }, [activeTab, canManageCompanyProfile, settingsScreen]);

  useEffect(() => {
    if (activeTab !== 'Settings' || settingsScreen !== 'ai-usage' || !canManageAiUsage) {
      return;
    }

    void loadTenantAiUsage();
  }, [activeTab, canManageAiUsage, settingsScreen]);

  useEffect(() => {
    if (activeTab === 'Settings' && settingsScreen === 'key-results') {
      return;
    }

    setIsKeyResultUnitModalOpen(false);
    setIsKeyResultsOptionsMenuOpen(false);
    setIsKeyResultsContentScrollEnabled(true);
  }, [activeTab, settingsScreen]);

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
    // Warm the directory here too, so the first tap on "New chat" already has
    // the organization loaded rather than showing an empty list.
    void loadDirectoryChatContacts();
  }, [activeTab]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setIsScreenKeyboardVisible(true);
      setScreenKeyboardHeight(event?.endCoordinates?.height || 0);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setIsScreenKeyboardVisible(false);
      setScreenKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (isScreenKeyboardVisible) {
      return;
    }

    setTallestWindowHeight((current) => (height > current ? height : current));
  }, [height, isScreenKeyboardVisible]);

  useEffect(() => {
    if (isScreenKeyboardVisible && isKeyResultsSelecting) {
      setKeyResultsSelected({});
      setIsKeyResultsSelecting(false);
    }
  }, [isKeyResultsSelecting, isScreenKeyboardVisible]);

  useEffect(() => {
    if (activeTab !== 'You') {
      return;
    }

    void loadUserProfile(false);
  }, [activeTab]);

  useEffect(() => {
    // Also loaded for announcements, which lists people to send to. It used to
    // load only for the Employees tab, so the announcement picker showed
    // whichever fragment of the list happened to be in memory — usually one
    // person, and no indication that anybody was missing.
    const needsEmployees = (activeTab === 'Employees' && canViewEmployees) ||
      (activeTab === 'Announcements' && canSendAnnouncements);

    if (!needsEmployees) {
      return;
    }

    void loadEmployees();
  }, [activeTab, canSendAnnouncements, canViewEmployees]);

  // The groups this person may address, which is a wider list than the groups
  // they can read. Fetched when the announcements tab is opened.
  useEffect(() => {
    if (activeTab !== 'Announcements' || !canSendAnnouncements) {
      return;
    }

    void (async () => {
      try {
        setAddressableGroups(await listAnnouncementAudienceGroups(await getIdToken()));
      } catch {
        // The picker falls back to the groups already loaded for chat.
      }
    })();
  }, [activeTab, canSendAnnouncements]);

  useEffect(() => {
    if (activeTab !== 'Library') {
      return;
    }

    void loadCompanyLibrary(false);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'LSW') {
      return;
    }

    void loadLswWorkspace(false);
  }, [activeTab]);

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

    if (settingsScreen === 'key-results' && !canManageCompanyProfile) {
      setSettingsScreen('list');
    }

    if (settingsScreen === 'ai-usage' && !canManageAiUsage) {
      setSettingsScreen('list');
    }

    if (settingsScreen === 'dept-admin-permissions' && !canManageUsers) {
      setSettingsScreen('list');
    }

    if (settingsScreen === 'groups' && !canManageGroups) {
      setSettingsScreen('list');
    }

    if (settingsScreen === 'action-reminders' && !canManageSecurity) {
      setSettingsScreen('list');
    }

    if (settingsScreen === 'scheduled-messages' && !canManageSecurity) {
      setSettingsScreen('list');
    }

    if (settingsScreen === 'admin-contact' && !canManageSecurity) {
      setSettingsScreen('list');
    }

    if (settingsScreen === 'security' && !canManageSecurity) {
      setSettingsScreen('list');
    }
  }, [activeTab, canManageAiUsage, canManageCompanyProfile, canManageDirectory, canManageGroups, canManageSecurity, canManageUsers, canViewEmployees, settingsScreen]);

  async function getIdToken(forceRefresh = false): Promise<string> {
    return verifiedAdmin.firebaseUser.getIdToken(forceRefresh);
  }

  async function loadCompanyLibrary(showError = true): Promise<void> {
    setIsLoadingCompanyLibrary(true);

    try {
      const idToken = await getIdToken();
      const [items, cachedConversations, deviceId] = await Promise.all([
        listCompanyLibrary(idToken),
        listCachedChatConversations({ ...getLocalChatScope() }).catch(() => []),
        getRegisteredDeviceId(idToken).catch(() => registeredDeviceId)
      ]);
      const chatItems = buildCompanyLibraryItemsFromChatConversations({
        conversations: cachedConversations,
        currentUid,
        currentUserDepartmentName: userProfile?.departmentName || '',
        currentUserName: userProfile?.displayName || 'You'
      });

      setCompanyLibraryFileHeaders({
        Authorization: `Bearer ${idToken}`,
        ...(deviceId ? { 'X-Synzapp-Device-Id': deviceId } : {})
      });
      if (deviceId && deviceId !== registeredDeviceId) {
        setRegisteredDeviceId(deviceId);
      }
      setCompanyLibraryItems(sortCompanyLibraryItemsByDate([...chatItems, ...items]));
    } catch (nextError) {
      if (showError) {
        setError(getErrorMessage(nextError, 'Unable to load Library.'));
      }
    } finally {
      setIsLoadingCompanyLibrary(false);
    }
  }

  async function loadLswWorkspace(showError = true, weekOptions: { week?: number; year?: number } = {}): Promise<void> {
    const isInitialLoad = !lswContext;

    setLswWorkspaceError(null);
    setIsLoadingLswWorkspace(isInitialLoad);
    setIsRefreshingLswWorkspace(!isInitialLoad);

    try {
      const idToken = await getIdToken();
      const timeZone = getLocalTimeZone();
      const context = await getLswContext(idToken, { timeZone, ...weekOptions });
      const requestOptions = {
        timeZone,
        week: context.week.selectedWeek,
        year: getLswSelectedYear(context)
      };
      const [dailyTasks, todoTasks, followUps] = await Promise.all([
        listLswDailyTasks(idToken, requestOptions),
        listLswTodoTasks(idToken, requestOptions),
        listLswFollowUps(idToken, requestOptions)
      ]);

      setLswContext(context);
      setLswDailyTasks(sortLswDailyTasks(dailyTasks.tasks));
      setLswTodoTasks(sortLswTodoTasks(todoTasks.tasks));
      setLswFollowUps(sortLswFollowUps(followUps.followUps));
    } catch (nextError) {
      const message = getErrorMessage(nextError, 'Unable to load Leaders Standard Work.');
      setLswWorkspaceError(message);

      if (showError) {
        setError(message);
      }
    } finally {
      setIsLoadingLswWorkspace(false);
      setIsRefreshingLswWorkspace(false);
    }
  }

  async function handleAddLswTodoTask(): Promise<void> {
    const task = await promptForRequiredText('Add To Do', 'Enter the To Do item.');

    if (!task) {
      return;
    }

    await saveLswMutation(`todo:create:${Date.now()}`, async (idToken) => {
      const createdTask = await createLswTodoTask(idToken, {
        dueDate: formatLocalDateOnly(new Date()),
        dueTime: formatLocalTimeOnly(new Date()),
        task,
        timeZone: getLocalTimeZone()
      });

      setLswTodoTasks((currentTasks) => sortLswTodoTasks([...currentTasks, createdTask]));
    });
  }

  async function handleEditLswTodoTask(task: LswTodoTaskSummary): Promise<void> {
    const nextTask = await promptForRequiredText('Edit To Do', 'Update the To Do item.', task.task);

    if (!nextTask || nextTask === task.task) {
      return;
    }

    await saveLswMutation(`todo:${task.taskId}`, async (idToken) => {
      const updatedTask = await updateLswTodoTask(idToken, task.taskId, { task: nextTask });
      setLswTodoTasks((currentTasks) => sortLswTodoTasks(replaceLswRecord(currentTasks, updatedTask, 'taskId')));
    });
  }

  async function handleToggleLswTodoTask(task: LswTodoTaskSummary): Promise<void> {
    await saveLswMutation(`todo:${task.taskId}`, async (idToken) => {
      const completed = !task.completed;
      const updatedTask = await updateLswTodoTask(idToken, task.taskId, {
        completed,
        completedAtIso: completed ? new Date().toISOString() : undefined
      });

      setLswTodoTasks((currentTasks) => sortLswTodoTasks(replaceLswRecord(currentTasks, updatedTask, 'taskId')));
    });
  }

  async function handleAddLswFollowUp(): Promise<void> {
    const followUp = await promptForRequiredText('Add Follow Up', 'Enter the follow up.');

    if (!followUp) {
      return;
    }

    const responsible = await promptForRequiredText('Responsible', 'Enter the responsible person.');

    if (!responsible) {
      return;
    }

    await saveLswMutation(`follow-up:create:${Date.now()}`, async (idToken) => {
      const createdFollowUp = await createLswFollowUp(idToken, {
        dueDate: formatLocalDateOnly(new Date()),
        followUp,
        responsible,
        timeZone: getLocalTimeZone()
      });

      setLswFollowUps((currentFollowUps) => sortLswFollowUps([...currentFollowUps, createdFollowUp]));
    });
  }

  async function handleEditLswFollowUp(followUp: LswFollowUpSummary): Promise<void> {
    const nextFollowUp = await promptForRequiredText('Edit Follow Up', 'Update the follow up.', followUp.followUp);

    if (!nextFollowUp || nextFollowUp === followUp.followUp) {
      return;
    }

    await saveLswMutation(`follow-up:${followUp.followUpId}`, async (idToken) => {
      const updatedFollowUp = await updateLswFollowUp(idToken, followUp.followUpId, { followUp: nextFollowUp });
      setLswFollowUps((currentFollowUps) => sortLswFollowUps(replaceLswRecord(currentFollowUps, updatedFollowUp, 'followUpId')));
    });
  }

  async function handleAddLswDailyTask(): Promise<void> {
    const task = await promptForRequiredText(
      'New Standard Task',
      'Enter the task. Next, you will enter planned minutes.',
      '',
      'Next'
    );

    if (!task) {
      return;
    }

    const minutesInput = await promptForRequiredText(
      'Standard Task Minutes',
      'Enter the planned minutes. Next, you will enter the planned time.',
      '15',
      'Next'
    );

    if (!minutesInput) {
      return;
    }

    const minutes = Number.parseInt(minutesInput, 10);

    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
      Alert.alert('Standard Task Minutes', 'Enter minutes from 1 to 1440.');
      return;
    }

    const timeInput = await promptForRequiredText('Standard Task Time', 'Enter the planned time as HH:MM.', formatLocalTimeOnly(new Date()));

    if (!timeInput) {
      return;
    }

    const time = normalizeLswTimeInput(timeInput);

    if (!time) {
      Alert.alert('Standard Task Time', 'Enter time as HH:MM, for example 08:30 or 17:05.');
      return;
    }

    await saveLswMutation(`daily:create:${Date.now()}`, async (idToken) => {
      const createdTask = await createLswDailyTask(idToken, {
        days: getAllLswTaskDays(),
        minutes,
        task,
        time
      }, getCurrentLswRequestOptions());

      setLswDailyTasks((currentTasks) => sortLswDailyTasks([...currentTasks, createdTask]));
    });
  }

  async function handleToggleLswDailyTaskDay(task: LswDailyTask, dayKey: LswDayKey): Promise<void> {
    const currentStatus = task.dayStatuses?.[dayKey]?.status || 'not_completed';
    const nextStatus: LswDayStatusValue = currentStatus === 'not_completed' ? 'completed_on_time' : 'not_completed';

    const optimisticTask: LswDailyTask = {
      ...task,
      days: {
        ...task.days,
        [dayKey]: nextStatus !== 'not_completed'
      },
      dayStatuses: {
        ...task.dayStatuses,
        [dayKey]: {
          ...task.dayStatuses?.[dayKey],
          completedAtIso: nextStatus === 'not_completed' ? undefined : new Date().toISOString(),
          status: nextStatus,
          timeZone: getLocalTimeZone()
        }
      }
    };

    setLswWorkspaceError(null);
    setLswSavingRecordId(`daily:${task.taskId}:${dayKey}`);
    setLswDailyTasks((currentTasks) => sortLswDailyTasks(replaceLswRecord(currentTasks, optimisticTask, 'taskId')));

    try {
      const idToken = await getIdToken();
      const updatedTask = await updateLswDailyTask(idToken, task.taskId, {
        days: {
          [dayKey]: nextStatus !== 'not_completed'
        },
        dayStatusUpdates: {
          [dayKey]: {
            completedAtIso: nextStatus === 'not_completed' ? undefined : new Date().toISOString(),
            status: nextStatus,
            timeZone: getLocalTimeZone()
          }
        }
      }, getCurrentLswRequestOptions());

      setLswDailyTasks((currentTasks) => sortLswDailyTasks(replaceLswRecord(currentTasks, updatedTask, 'taskId')));
    } catch (nextError) {
      const message = getErrorMessage(nextError, 'Unable to save Leaders Standard Work.');
      setLswWorkspaceError(message);
      setLswDailyTasks((currentTasks) => sortLswDailyTasks(replaceLswRecord(currentTasks, task, 'taskId')));
      Alert.alert('Leaders Standard Work', message);
    } finally {
      setLswSavingRecordId(null);
    }
  }

  async function handleDeleteLswDailyTask(task: LswDailyTask): Promise<void> {
    const shouldDelete = await confirmDestructiveAction('Delete Standard Task?', `Delete "${task.task || 'this standard task'}"?`);

    if (!shouldDelete) {
      return;
    }

    await saveLswMutation(`daily:${task.taskId}:delete`, async (idToken) => {
      await deleteLswDailyTask(idToken, task.taskId);
      setLswDailyTasks((currentTasks) => currentTasks.filter((currentTask) => currentTask.taskId !== task.taskId));
    });
  }

  async function handleEditLswDailyTaskSchedule(task: LswDailyTask): Promise<void> {
    const minutesInput = await promptForRequiredText(
      'Standard Task Minutes',
      'Enter the planned minutes. Next, you will enter the planned time.',
      String(task.minutes || 0),
      'Next'
    );

    if (!minutesInput) {
      return;
    }

    const minutes = Number.parseInt(minutesInput, 10);

    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
      Alert.alert('Standard Task Minutes', 'Enter minutes from 1 to 1440.');
      return;
    }

    const timeInput = await promptForRequiredText('Standard Task Time', 'Enter the planned time as HH:MM.', task.time || formatLocalTimeOnly(new Date()));

    if (!timeInput) {
      return;
    }

    const time = normalizeLswTimeInput(timeInput);

    if (!time) {
      Alert.alert('Standard Task Time', 'Enter time as HH:MM, for example 08:30 or 17:05.');
      return;
    }

    await saveLswMutation(`daily:${task.taskId}:schedule`, async (idToken) => {
      const updatedTask = await updateLswDailyTask(idToken, task.taskId, {
        minutes,
        time
      }, getCurrentLswRequestOptions());

      setLswDailyTasks((currentTasks) => sortLswDailyTasks(replaceLswRecord(currentTasks, updatedTask, 'taskId')));
    });
  }

  function handleLswWeekOffset(offset: number): void {
    if (!lswContext || isLoadingLswWorkspace || isRefreshingLswWorkspace) {
      return;
    }

    void loadLswWorkspace(true, {
      week: lswContext.week.selectedWeek + offset,
      year: getLswSelectedYear(lswContext)
    });
  }

  async function handleRefreshLswCurrentSelection(): Promise<void> {
    await loadLswWorkspace(false, {
      week: lswContext?.week.selectedWeek,
      year: getLswSelectedYear(lswContext)
    });
    Alert.alert('Leaders Standard Work', 'Section refreshed data up to date', [{ text: 'OK' }]);
  }

  function handleOpenCurrentLswWeek(): void {
    if (isLoadingLswWorkspace || isRefreshingLswWorkspace || lswContext?.week.isCurrentWeek) {
      return;
    }

    void loadLswWorkspace(true);
  }

  async function saveLswMutation(recordId: string, mutation: (idToken: string) => Promise<void>): Promise<void> {
    setLswWorkspaceError(null);
    setLswSavingRecordId(recordId);

    try {
      await mutation(await getIdToken());
    } catch (nextError) {
      const message = getErrorMessage(nextError, 'Unable to save Leaders Standard Work.');
      setLswWorkspaceError(message);
      Alert.alert('Leaders Standard Work', message);
    } finally {
      setLswSavingRecordId(null);
    }
  }

  function getCurrentLswRequestOptions() {
    return {
      timeZone: getLocalTimeZone(),
      week: lswContext?.week.selectedWeek,
      year: getLswSelectedYear(lswContext)
    };
  }

  async function handleOpenCompanyLibraryItem(item: CompanyLibraryItem): Promise<void> {
    const kind = getCompanyLibraryKind(item);

    if (kind === 'photos') {
      setCompanyLibraryPreview(item);
      return;
    }

    if (kind === 'videos') {
      if (!item.fileUrl) {
        Alert.alert('Video unavailable', 'This Library video file is not available.');
        return;
      }

      setCompanyLibraryVideoPreview(item);
      return;
    }

    if (kind !== 'audio') {
      return;
    }

    try {
      const localUri = await prepareCompanyLibraryAudioPreviewUri(item, companyLibraryFileHeaders);
      setAudioAttachmentPreview({
        contentType: item.contentType || 'audio/mpeg',
        fileName: item.fileName || item.label || 'Audio attachment',
        localUri,
        sizeBytes: item.fileSizeBytes || 0
      });
    } catch (nextError) {
      Alert.alert('Audio unavailable', getErrorMessage(nextError, 'Unable to play this Library audio.'));
    }
  }

  function getActiveTenantId(): string {
    return userProfile?.tenantId || verifiedAdmin.session.user.tenantId || '';
  }

  /**
   * A device the server has just authorised is not a blocked one.
   *
   * The local block outlives what caused it. A phone chat was moved away from
   * purges with reason `device-revoked`, which counts as a standing block, and
   * it is still set when the person signs back in on that same phone. Signing in
   * does try to clear it — but it records the scope from the session's tenant,
   * while every check here reads `getLocalChatScope()`. Where those two differ
   * the mark lands under one key and the check reads another, so the block
   * survives and the session ends seconds after the chats are restored.
   *
   * Cleared here instead, keyed by the very scope the checks use, at the moment
   * registration succeeds — which is the server saying this device may hold the
   * data. A first-time phone has no manifest entry at all, which is why only
   * returning ones were caught by this.
   */
  async function clearStaleCompanyDataBlock(): Promise<void> {
    const scope = getLocalChatScope();

    if (!scope.ownerUid || !scope.tenantId) {
      return;
    }

    await markCompanyDataScopeActive(scope).catch(() => undefined);
  }

  function getLocalChatScope(): { ownerUid: string; tenantId: string } {
    return {
      ownerUid: currentUid,
      tenantId: getActiveTenantId()
    };
  }

  async function reconcileNativeChatMediaTransfers(): Promise<void> {
    const scope = getLocalChatScope();

    if (!scope.tenantId) {
      return;
    }

    const queuedTransfers = await listLocalChatMediaTransferQueue({
      ...scope,
      limit: 200
    }).catch(() => []);
    const nativeTransfers = queuedTransfers.filter((item) =>
      item.nativeTransferId &&
      (item.status === 'uploading' || item.status === 'downloading' || item.status === 'queued')
    );

    for (const transfer of nativeTransfers) {
      const nativeTransferIds = transfer.uploadRecovery?.uploadMode === 'chunked'
        ? Array.from(new Set([
            ...(transfer.uploadRecovery.partNativeTransferIds || []),
            transfer.nativeTransferId
          ].filter((id): id is string => Boolean(id))))
        : [transfer.nativeTransferId].filter((id): id is string => Boolean(id));
      const nativeStatuses = (await Promise.all(nativeTransferIds.map((transferId) =>
        getNativeBackgroundTransferStatus(transferId)
      ))).filter((status): status is NonNullable<typeof status> =>
        Boolean(status && status.status !== 'not_found')
      );

      if (!nativeStatuses.length) {
        continue;
      }

      const hasFailedNativeTransfer = nativeStatuses.some((status) => status.status === 'failed');
      const hasCompletedNativeTransfer = nativeStatuses.every((status) => status.status === 'completed') &&
        nativeStatuses.length === nativeTransferIds.length;
      const aggregateNativeProgress = nativeStatuses.reduce((total, status) =>
        total + (typeof status.progress === 'number' ? Math.min(Math.max(status.progress, 0), 1) : 0),
      0) / Math.max(nativeTransferIds.length, 1);
      const nativeStatus = nativeStatuses[0];
      const nativeTransferStatus = hasFailedNativeTransfer
        ? 'failed'
        : hasCompletedNativeTransfer
          ? 'completed'
          : 'running';
      const progress = Number.isFinite(aggregateNativeProgress)
        ? Math.min(Math.max(aggregateNativeProgress, 0), 1)
        : transfer.progress;
      const completedRecoverableUpload = nativeTransferStatus === 'completed' &&
        transfer.transferType === 'upload' &&
        isCompleteRecoverableUpload(transfer.uploadRecovery);
      const recoveredUploadMedia = completedRecoverableUpload
        ? transfer.uploadRecovery?.media || transfer.media
        : transfer.media;
      const nextMedia: ChatMediaAttachment = {
        ...recoveredUploadMedia,
        localUri: transfer.transferType === 'download' && nativeStatus.destinationUri
          ? nativeStatus.destinationUri
          : recoveredUploadMedia.localUri,
        transferProgress: nativeTransferStatus === 'completed' ? 1 : progress,
        transferStatus: nativeTransferStatus === 'failed'
          ? 'failed'
          : nativeTransferStatus === 'completed' && transfer.transferType === 'download'
            ? 'available'
            : completedRecoverableUpload
              ? 'available'
            : transfer.transferType === 'upload'
              ? 'uploading'
              : 'downloading'
      };

      if (completedRecoverableUpload && transfer.uploadRecovery?.mediaId) {
        try {
          const idToken = await getIdToken();
          await completeUploadedChatMedia({
            chatType: transfer.uploadRecovery.chatType,
            contactId: transfer.contactId,
            idToken,
            mediaId: transfer.uploadRecovery.mediaId
          });
        } catch (error) {
          const isRetryableCompletion = isNetworkUnavailableError(error);
          const retryableMediaStatus = isRetryableCompletion ? 'uploading' : 'failed';
          await persistLocalMediaTransferState({
            contactId: transfer.contactId,
            lastError: getErrorMessage(error, 'Unable to finish background media upload.'),
            media: {
              ...nextMedia,
              transferStatus: retryableMediaStatus,
              transferProgress: progress
            },
            mediaIndex: transfer.mediaIndex,
            messageId: transfer.messageId,
            nativeTransferId: transfer.nativeTransferId,
            progress,
            status: isRetryableCompletion ? 'queued' : 'failed',
            transferType: transfer.transferType,
            uploadRecovery: transfer.uploadRecovery
          });
          continue;
        }
      }

      updateVisibleMessageMedia(transfer.contactId, transfer.messageId, nextMedia, transfer.mediaIndex);

      if (
        (nativeTransferStatus === 'completed' && transfer.transferType === 'download' && nativeStatus.destinationUri) ||
        completedRecoverableUpload
      ) {
        await persistMessageMediaUpdate(transfer.contactId, transfer.messageId, nextMedia, transfer.mediaIndex);
        if (completedRecoverableUpload) {
          await persistPendingMessageMediaUpdate(
            transfer.contactId,
            transfer.messageId,
            nextMedia,
            transfer.mediaIndex
          );
        }
      }

      await persistLocalMediaTransferState({
        contactId: transfer.contactId,
        lastError: nativeTransferStatus === 'failed'
          ? nativeStatus.errorMessage || transfer.lastError || 'Background media transfer failed.'
          : null,
        media: nextMedia,
        mediaIndex: transfer.mediaIndex,
        messageId: transfer.messageId,
        nativeTransferId: transfer.nativeTransferId,
        progress: nextMedia.transferProgress || 0,
        status: nextMedia.transferStatus || transfer.status,
        transferType: transfer.transferType,
        uploadRecovery: completedRecoverableUpload ? null : transfer.uploadRecovery
      });
    }
  }

  async function recoverNativeTransfersThenSyncPendingMessages(): Promise<void> {
    await reconcileNativeChatMediaTransfers();
    await syncAllPendingMessages();
  }

  async function persistPendingMessageMediaUpdate(
    contactId: string,
    queueId: string,
    media: ChatMediaAttachment,
    mediaIndex?: number
  ): Promise<void> {
    const pendingMessages = await listPendingChatMessages({
      contactId,
      ...getLocalChatScope()
    }).catch(() => []);
    const pendingMessage = pendingMessages.find((message) => message.queueId === queueId);

    if (!pendingMessage) {
      return;
    }

    await updatePendingChatMessage({
      message: applyMediaUpdateToMessage(pendingMessage.message, media, mediaIndex),
      ...getLocalChatScope(),
      queueId,
      status: pendingMessage.status
    }).catch(() => undefined);
  }


  function getLocalCallScope(): { ownerUid: string; tenantId: string } | null {
    const tenantId = getActiveTenantId();

    if (!tenantId) {
      return null;
    }

    return {
      ownerUid: currentUid,
      tenantId
    };
  }

  function updateLocalCallStoreState(storeData: SynzappCallStoreData) {
    callHistoryRef.current = storeData.history;
    callFavoriteContactIdsRef.current = storeData.favoriteContactIds;
    scheduledCallsRef.current = storeData.scheduledCalls;
    setCallHistory(storeData.history);
    setCallFavoriteContactIds(storeData.favoriteContactIds);
    setScheduledCalls(storeData.scheduledCalls);
  }

  async function persistCallStoreData(storeData: SynzappCallStoreData) {
    updateLocalCallStoreState(storeData);

    const scope = getLocalCallScope();

    if (!scope) {
      return;
    }

    await saveSynzappCallStore(scope, storeData).catch(() => undefined);
  }

  async function persistCallHistory(nextHistory: SynzappCallHistoryEntry[]) {
    await persistCallStoreData({
      favoriteContactIds: callFavoriteContactIdsRef.current,
      history: nextHistory,
      scheduledCalls: scheduledCallsRef.current
    });
  }

  async function persistCallFavorites(nextFavoriteContactIds: string[]) {
    await persistCallStoreData({
      favoriteContactIds: Array.from(new Set(nextFavoriteContactIds)),
      history: callHistoryRef.current,
      scheduledCalls: scheduledCallsRef.current
    });
  }

  async function persistScheduledCalls(nextScheduledCalls: SynzappScheduledCall[]) {
    await persistCallStoreData({
      favoriteContactIds: callFavoriteContactIdsRef.current,
      history: callHistoryRef.current,
      scheduledCalls: nextScheduledCalls
    });
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

      setLastChatBackupAtMs(Date.now());
      setChatBackupError(null);

      // The key goes into the organization's escrow straight away, wrapped by
      // Cloud KMS. Without this it exists only on this handset, so reinstalling
      // the app would leave the backup that was just uploaded permanently
      // unreadable — which is exactly what used to happen.
      const storedRecoveryKey = await getStoredChatBackupRecoveryKey(currentUid);

      if (storedRecoveryKey) {
        await escrowChatBackupKey({
          deviceId: await getRegisteredDeviceId(idToken),
          idToken,
          recoveryKey: storedRecoveryKey
        }).catch((escrowError: unknown) => {
          // Said out loud rather than swallowed. A backup whose key was not
          // escrowed is one nobody can restore, and finding that out at restore
          // time is far too late to do anything about it.
          setError(getErrorMessage(
            escrowError,
            'The backup uploaded, but your organization could not store its key. Back up again while online.'
          ));
        });
      }

      if (showResult) {
        showChatBackupResultAlert(result);
      }
    } catch (nextError) {
      const message = getErrorMessage(nextError, 'Unable to sync encrypted chat backup.');

      // Recorded whether or not anybody was watching. Automatic backups run
      // without a screen, so a failure used to be swallowed entirely and the
      // first anybody heard of it was pressing the button by hand weeks later.
      setChatBackupError(message);

      if (showResult) {
        setError(message);
      }
    } finally {
      isBackupSyncingRef.current = false;
      setIsSyncingChatBackup(false);
    }
  }

  function showChatBackupResultAlert(result: Awaited<ReturnType<typeof createEncryptedChatBackup>>) {
    // No key is shown. It is escrowed to the organization and released by an
    // administrator, so there is nothing here for anybody to keep safe or lose.
    const message = result.createdRecoveryKey
      ? [
          `${result.metadata.messageCount} messages backed up.`,
          'Your organization holds the key for this backup. If you reinstall the app, ask an administrator to approve a restore.'
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

      const deviceId = await getRegisteredDeviceId(idToken);
      // This device may still hold its own key, in which case nobody needs to
      // be asked. A reinstalled one holds nothing, and asking is all it can do.
      const storedRecoveryKey = await getStoredChatBackupRecoveryKey(currentUid) ||
        await claimChatBackupRestore({ deviceId, idToken }).catch(() => null);

      /**
       * The organization said people may restore without waiting. Let them.
       *
       * This step was missing, so a tenant with self-service restore switched on
       * still sent everybody away to wait for an administrator — the opposite of
       * what the setting says, and confusing to read beside a screen showing it
       * enabled. Where it is off, the key was never handed to the person and
       * asking for one would only invite failure, so the request path stands.
       */
      if (!storedRecoveryKey && policy.selfRestoreEnabled) {
        askForRecoveryKey();

        return;
      }

      if (!storedRecoveryKey) {
        // No key and nothing approved, so this becomes a request. Typing a key
        // is not offered: the employee never had one to type. It is escrowed to
        // the organization and released by an administrator.
        const request = await requestChatBackupRestore({ deviceId, idToken });

        setChatBackupRestoreStatus(request.status);
        Alert.alert(
          request.status === 'pending' ? 'Restore requested' : 'Restore already requested',
          'Your administrator has to approve this before your chats can be restored. You will be able to restore here once they do.'
        );

        return;
      }

      setChatBackupRestoreStatus(null);

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

  /**
   * Asks for the recovery key, on whichever platform this is.
   *
   * `Alert.prompt` is the system's own text prompt and exists only on iOS.
   * Android gets the same question in a sheet of the app's own, so neither
   * platform quietly loses the option the organization switched on.
   */
  function askForRecoveryKey() {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Enter your recovery key',
        'Your organization allows restoring without waiting for an administrator. This is the key you were shown when encrypted backup was first set up.',
        [
          { style: 'cancel', text: 'I do not have it' },
          {
            onPress: (recoveryKey?: string) => {
              if (recoveryKey?.trim()) {
                void restoreChatBackupWithKey(recoveryKey.trim());
              }
            },
            text: 'Restore'
          }
        ],
        'plain-text'
      );

      return;
    }

    setRecoveryKeyDraft('');
    setIsRecoveryKeyPromptOpen(true);
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

  /**
   * Raised wherever the refusal first surfaces, not only where it was expected.
   *
   * Registration is reached from every API call, so the first request to be
   * turned away is rarely the one the screen made on purpose.
   */
  useEffect(() => {
    setMobileSeatConflictHandler((seatError) => {
      if (!seatError.seat.deviceId) {
        return;
      }

      setHeldMobileSeat(seatError.seat);
      promptToMoveChatToThisPhone(
        seatError.seat.deviceId,
        describeMobileSeatHolder(seatError.seat, Date.now())
      );
    });

    return () => setMobileSeatConflictHandler(null);
  }, []);

  /**
   * Asks again when somebody opens Chats, having said not now.
   *
   * The refusal is cached so registration is not retried, which means nothing
   * would raise the question a second time. Opening the tab that does not work
   * is the moment it is worth asking.
   */
  function promptToMoveChatToThisPhone(displacedDeviceId: string, otherPhone: string) {
    if (isMobileSeatPromptPendingRef.current) {
      return;
    }

    isMobileSeatPromptPendingRef.current = true;
    setErrorState(null);

    Alert.alert(
      'Chat is on another phone',
      `${otherPhone} is signed in to chat for this account. Chat can only be on one phone, so moving it here will sign that one out and remove its copy of your messages.`,
      [
        {
          onPress: () => {
            /**
             * Declining keeps the person signed in and asks again later.
             *
             * Their account is fine; only chat is elsewhere. The offer returns
             * when they next open Chats, so changing their mind does not mean
             * restarting the app — and nothing else nags them in the meantime.
             */
            isMobileSeatPromptPendingRef.current = false;
            setErrorState(null);
          },
          style: 'cancel',
          text: 'Not now'
        },
        {
          onPress: () => {
            void moveChatToThisPhone(displacedDeviceId);
          },
          style: 'destructive',
          text: 'Move chat here'
        }
      ]
    );
  }

  /**
   * Offers to bring the conversations over, once chat has moved here.
   *
   * Messages do not travel with the seat. They are sealed per device, so a
   * handset that has just taken over holds none of them and the backup is the
   * only way they arrive. Left in settings, almost nobody would find it — and
   * binding chat to one phone is precisely what makes swapping phones routine.
   *
   * Only offered when this phone genuinely has nothing: a claim after a
   * reinstall, where the cache survived, should not invite somebody to merge a
   * backup over messages they can already see.
   */
  async function offerToBringChatHistoryOver() {
    const tenantId = getActiveTenantId();

    if (!tenantId) {
      return;
    }

    const cached = await listCachedChatConversations({
      ownerUid: currentUid,
      tenantId
    }).catch(() => []);

    if (cached.length) {
      return;
    }

    Alert.alert(
      'Bring your chats to this phone?',
      'Your messages are on your other phone, not on this one. If your organization keeps encrypted backups, they can be restored here.',
      [
        {
          style: 'cancel',
          text: 'Not now'
        },
        {
          onPress: () => {
            void handleRestoreChatBackup();
          },
          text: 'Restore'
        }
      ]
    );
  }

  async function moveChatToThisPhone(displacedDeviceId: string) {
    try {
      const registrationToken = await getIdToken();
      const device = await ensureRegisteredDeviceIdentity(registrationToken, {
        claimFromMobileDeviceId: displacedDeviceId
      });

      isMobileSeatPromptPendingRef.current = false;
      setHeldMobileSeat(null);
      setRegisteredDeviceId(device.deviceId);
      void clearStaleCompanyDataBlock();
      void registerCurrentDevicePushToken(registrationToken);
      setErrorState(null);
      void offerToBringChatHistoryOver();
    } catch (nextError) {
      isMobileSeatPromptPendingRef.current = false;
      // The claim needs a recent sign-in, so the most likely refusal here is a
      // session that has been open too long. Say what to do about it.
      setErrorState(getErrorMessage(
        nextError,
        'Chat could not be moved to this phone. Sign in again and try once more.'
      ));
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
      void clearStaleCompanyDataBlock();
      void registerCurrentDevicePushToken(registrationToken);
    } catch (nextError) {
      deviceIdentityRegistrationStartedRef.current = false;

      // A held seat is raised by the handler above, wherever it first surfaces.
      // Nothing to add here beyond not reporting it twice.
      if (isMobileSeatHeldError(nextError)) {
        return;
      }

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
      setCompanyCalendarYearStartDateDraft(profile.calendarYearStartDate);
    } catch (nextError) {
      if (showError) {
        setError(getErrorMessage(nextError, 'Unable to load company profile.'));
      }
    } finally {
      setIsLoadingCompanyProfile(false);
    }
  }

  async function loadKeyResults(showError = true) {
    if (!canManageCompanyProfile) {
      return;
    }

    setIsLoadingKeyResults(true);

    try {
      const idToken = await getIdToken();
      const keyResults = await getCompanyKeyResults(idToken);

      setCompanyKeyResults(normalizeKeyResultsForDraft(keyResults));
      setKeyResultMetricDrafts({});
    } catch (nextError) {
      if (showError) {
        setError(getErrorMessage(nextError, 'Unable to load key results.'));
      }
    } finally {
      setIsLoadingKeyResults(false);
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

  /**
   * Loads the people this user can start a chat with.
   *
   * Every role can call this. The admin-only employee directory used to be the
   * only source for "New chat", so an employee with no conversations yet saw an
   * empty list and had no way to message anyone - not even their Org Admin.
   */
  async function loadDirectoryChatContacts(): Promise<void> {
    try {
      const idToken = await getIdToken();
      const contacts = await listChatContacts(idToken, { includeDirectory: true });
      const directoryOnlyContacts = contacts.filter((contact) =>
        (contact.chatType || 'DIRECT') !== 'GROUP' && contact.contactId !== currentUid
      );
      const contactsWithPhotos = await cacheChatContactPhotos(directoryOnlyContacts, idToken)
        .catch(() => directoryOnlyContacts);

      setProfilePhotoAuthToken(idToken);
      setDirectoryChatContacts(contactsWithPhotos);
    } catch (nextError) {
      if (isCompanyAccessDeniedError(nextError)) {
        onSessionInvalid(ACCESS_DENIED_MESSAGE);
        return;
      }

      // A failed directory load must not block chatting with people the user
      // already has threads with, so this stays quiet.
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

  async function loadOrgAdminSetupReadiness() {
    if (!canManageDirectory || !canInviteEmployees) {
      return;
    }

    try {
      const idToken = await getIdToken();
      const [nextDepartments, nextRoles, nextEmployees, nextGroups] = await Promise.all([
        listDepartments(idToken),
        listRoles(idToken),
        listApprovedEmployees(idToken),
        canManageGroups ? listTenantGroups(idToken) : Promise.resolve(groups)
      ]);
      const employeesWithCachedPhotos = await cacheApprovedEmployeePhotos(nextEmployees, idToken);

      setProfilePhotoAuthToken(idToken);
      setDepartments(nextDepartments);
      setRoles(nextRoles);
      setApprovedEmployees(sortApprovedEmployees(employeesWithCachedPhotos));
      if (canManageGroups) {
        setGroups(sortByName(nextGroups));
      }
    } catch (nextError) {
      console.warn('Org Admin guided setup readiness could not be loaded:', getErrorMessage(nextError, 'Unknown setup readiness error'));
    }
  }

  async function loadChatContacts(showError = true): Promise<ChatContact[]> {
    const hadVisibleContacts = chatContactsRef.current.length > 0;
    let fallbackContacts = chatContactsRef.current;

    try {
      await assertCompanyDataRenderable(getLocalChatScope());
      await hydrateLocallyDeletedChatContacts();
      const localCacheLoadStartedAt = Date.now();
      const [cachedChatContacts, cachedConversations, pendingMessages] = await Promise.all([
        loadCachedChatContacts({ ...getLocalChatScope() }).catch(() => []),
        listCachedChatConversations({ ...getLocalChatScope() }).catch(() => []),
        listPendingChatMessages({ ...getLocalChatScope() }).catch(() => [])
      ]);
      void recordChatOfflineTimingMetric(
        getLocalChatScope(),
        'chatListCacheLoadMs',
        Date.now() - localCacheLoadStartedAt
      ).then(setChatOfflineMetrics).catch(() => undefined);
      void recordChatOfflineTimingMetric(
        getLocalChatScope(),
        'sqliteQueryMs',
        Date.now() - localCacheLoadStartedAt
      ).catch(() => undefined);
      const locallyDeletedContactIds = locallyDeletedChatContactIdsRef.current;
      // A department's group survives deletion, because there is nothing to
      // delete: membership is the department, not a conversation somebody
      // started. Clearing it empties the messages, and the chat itself stays.
      const isRemovable = (contact: { chatType?: string | null; contactId: string; isDepartmentDefault?: boolean | null }) =>
        !isDepartmentChat(contact) && locallyDeletedContactIds.has(contact.contactId);
      const visibleCachedChatContacts = cachedChatContacts.filter((contact) => !isRemovable(contact));
      const visibleCachedConversations = cachedConversations.filter((conversation) =>
        !locallyDeletedContactIds.has(conversation.contactId)
      );
      const visiblePendingMessages = pendingMessages.filter((pendingMessage) =>
        !locallyDeletedContactIds.has(pendingMessage.contactId)
      );
      const cachedConversationContacts = buildLocalChatContactsFromCachedConversations(
        visibleCachedConversations,
        visiblePendingMessages,
        new Set(visibleCachedChatContacts
          .filter((contact) => contact.chatType === 'GROUP')
          .map((contact) => contact.contactId))
      );
      const cachedContacts = mergeLoadedChatContactsWithVisibleState(
        visibleCachedChatContacts,
        cachedConversationContacts,
        { preserveMissing: true }
      );

      if (cachedContacts.length && !hadVisibleContacts) {
        fallbackContacts = mergeLoadedChatContactsWithVisibleState(
          chatContactsRef.current,
          cachedContacts,
          { preserveMissing: true }
        );
        setChatContacts(fallbackContacts);
        setIsLoadingChats(false);
      } else if (!hadVisibleContacts) {
        setIsLoadingChats(true);
      }

      const idToken = await getIdToken();
      const [directContacts, groupContacts] = await Promise.all([
        listChatContacts(idToken),
        listGroupChatContacts(idToken)
      ]);
      const contacts = [...directContacts, ...groupContacts];
      const contactsWithLocalPreviews = applyLocalChatPreviewsToContacts(
        contacts.filter((contact) => !isRemovable(contact)),
        visibleCachedConversations,
        visiblePendingMessages
      );

      const contactsWithCachedPhotos = await cacheChatContactPhotos(contactsWithLocalPreviews, idToken);
      const reconciledContacts = mergeLoadedChatContactsWithVisibleState(
        fallbackContacts.length ? fallbackContacts : chatContactsRef.current,
        contactsWithCachedPhotos,
        { preserveMissing: false }
      );

      setProfilePhotoAuthToken(idToken);
      hasResolvedChatContactsRef.current = true;
      applyChatContactsIfChanged(reconciledContacts);

      return reconciledContacts;
    } catch (nextError) {
      if (isCompanyAccessDeniedError(nextError)) {
        onSessionInvalid(ACCESS_DENIED_MESSAGE);
        return [];
      }

      if (showError && !isNetworkUnavailableError(nextError)) {
        setError(getErrorMessage(nextError, 'Unable to load chats.'));
      }

      return fallbackContacts;
    } finally {
      setIsLoadingChats(false);
    }
  }

  async function hydrateLocallyDeletedChatContacts() {
    const hiddenContactIds = await loadPersistedHiddenDirectChatContactIds(getLocalChatScope()).catch(() => []);

    if (!hiddenContactIds.length) {
      return;
    }

    hiddenContactIds.forEach((contactId) => locallyDeletedChatContactIdsRef.current.add(contactId));
  }

  function applyChatContactsIfChanged(nextContacts: ChatContact[]) {
    setChatContacts((currentContacts) =>
      areChatContactListsEqual(currentContacts, nextContacts) ? currentContacts : nextContacts
    );
  }

  /**
   * Keeps the photo already on screen when a contact is refreshed.
   *
   * A realtime contact arrives carrying the server's https photo URL; the
   * cached file:// path is written a moment later, and the same handler applies
   * the contact twice — once raw, once cached. The header was handed the raw
   * one, so its avatar uri flipped https, file, https, file on every event.
   *
   * Android treats each as a different image and fetches it again, and the
   * initials sitting behind the photo show through while it does. Several
   * events arrive per message, which is why a face blinked several times a
   * second while sending and receiving and was still on an idle chat.
   *
   * The list never had this: it merged against what it already held. The helper
   * for it was written and imported and never called.
   */
  function applyVisibleChatContactUpdate(nextContact: ChatContact, shouldSelect: boolean) {
    if (shouldSelect && selectedChatRef.current?.contactId === nextContact.contactId) {
      const openContact = mapChatItemToChatContact(selectedChatRef.current);

      setSelectedChat(mapChatContactToChatItem(mergeChatContactCachedPhoto(openContact, nextContact)));
    }

    setChatContacts((currentContacts) => {
      const existingContact = currentContacts.find((contact) => contact.contactId === nextContact.contactId);

      return upsertChatContact(
        currentContacts,
        mergeChatContactVisibleState(existingContact, mergeChatContactCachedPhoto(existingContact, nextContact))
      );
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

  async function purgeLocalChatThreadState(contactId: string, options: {
    closeIfOpen?: boolean;
    removeFromList?: boolean;
  } = {}) {
    const removedQueueIds = await removePendingChatMessagesForContact({
      contactId,
      ...getLocalChatScope()
    }).catch(() => []);

    removedQueueIds.forEach((queueId) => activeLocalSendQueueIdsRef.current.delete(queueId));

    await deleteCachedChatConversation({
      contactId,
      ...getLocalChatScope()
    }).catch(() => undefined);

    if (options.removeFromList) {
      setChatContacts((currentContacts) => currentContacts.filter((contact) => contact.contactId !== contactId));
    }

    if (options.closeIfOpen && selectedChatRef.current?.contactId === contactId) {
      chatOpenRequestIdRef.current += 1;
      selectedChatRef.current = null;
      activeTrashSegmentIdRef.current = null;
      setSelectedChat(null);
      setActiveTrashSegmentId(null);
      setMessages([]);
      setMessageReactions({});
      setReplyTarget(null);
      setMessageDraft('');
      resetCachedMessagePaging();
      resetForwardMode();
      resetMessageDeleteMode();
    } else if (selectedChatRef.current?.contactId === contactId) {
      setMessages([]);
      setMessageReactions({});
      setReplyTarget(null);
      setMessageDraft('');
      resetCachedMessagePaging();
      resetMessageDeleteMode();
    }
  }

  async function updateChatPreferenceAndApply(
    chat: ChatItem,
    input: {
      clear?: boolean;
      failureMessage?: string;
      isArchived?: boolean;
      isFavorite?: boolean;
      isPinned?: boolean;
      isSpam?: boolean;
      optimisticContact?: Partial<ChatContact>;
      permanentDelete?: boolean;
      removeFromList?: boolean;
    }
  ) {
    const isListPreferenceOnly =
      input.clear !== true &&
      input.permanentDelete !== true &&
      input.isArchived === undefined &&
      input.isSpam === undefined &&
      (
        typeof input.isFavorite === 'boolean' ||
        typeof input.isPinned === 'boolean'
      );

    if (!canUseChatListActions(chat) && !isListPreferenceOnly) {
      return;
    }

    const previousContacts = chatContactsRef.current;
    const existingContact = previousContacts.find((contact) => contact.contactId === chat.contactId);
    const shouldPurgeThread = input.clear === true || input.permanentDelete === true || input.isSpam === true;

    if (existingContact && input.optimisticContact) {
      setChatContacts((currentContacts) => upsertChatContact(currentContacts, {
        ...existingContact,
        ...input.optimisticContact
      }));
    }

    try {
      const idToken = await getIdToken();
      const updatedContact = await updateChatPreference({
        chatType: chat.chatType,
        clear: input.clear,
        contactId: chat.contactId,
        idToken,
        isArchived: input.isArchived,
        isFavorite: input.isFavorite,
        isPinned: input.isPinned,
        isSpam: input.isSpam,
        permanentDelete: input.permanentDelete
      });
      const cachedContact = await cacheChatContactPhoto(updatedContact, idToken);
      const nextCachedContacts = input.removeFromList
        ? previousContacts.filter((contact) => contact.contactId !== chat.contactId)
        : upsertChatContact(previousContacts, cachedContact);

      setProfilePhotoAuthToken(idToken);
      setChatContacts((currentContacts) => input.removeFromList
        ? currentContacts.filter((contact) => contact.contactId !== chat.contactId)
        : upsertChatContact(currentContacts, cachedContact)
      );
      await saveCachedChatContacts({
        contacts: nextCachedContacts,
        ...getLocalChatScope()
      }).catch(() => undefined);

      if (shouldPurgeThread) {
        locallyDeletedChatContactIdsRef.current.add(chat.contactId);
        if (input.permanentDelete === true || input.removeFromList === true) {
          await addPersistedHiddenDirectChatContactId(getLocalChatScope(), chat.contactId).catch(() => undefined);
        }
        await purgeLocalChatThreadState(chat.contactId, {
          closeIfOpen: input.permanentDelete === true || input.removeFromList === true,
          removeFromList: input.removeFromList === true
        });

        if (selectedChatRef.current?.contactId === chat.contactId) {
          const nextSelectedChat = mapChatContactToChatItem(cachedContact);

          selectedChatRef.current = nextSelectedChat;
          setSelectedChat(nextSelectedChat);
        }
      }
    } catch (nextError) {
      locallyDeletedChatContactIdsRef.current.delete(chat.contactId);
      setChatContacts(previousContacts);
      const fallbackMessage = input.failureMessage || 'Unable to update this chat.';
      const nextMessage = getErrorMessage(nextError, fallbackMessage);

      setError(/something went wrong|unable to load chats/i.test(nextMessage)
        ? fallbackMessage
        : nextMessage);
    }
  }

  function handleArchiveChat(chat: ChatItem) {
    if (!canUseChatListActions(chat)) {
      return;
    }

    const nextArchived = !chat.isArchived;

    void updateChatPreferenceAndApply(chat, {
      failureMessage: nextArchived ? 'Unable to archive this chat.' : 'Unable to unarchive this chat.',
      isArchived: nextArchived,
      optimisticContact: {
        isArchived: nextArchived
      }
    });
  }

  function handleToggleFavoriteChat(chat: ChatItem) {
    if (!canSwipeChatRow(chat)) {
      return;
    }

    const nextFavorite = !chat.isFavorite;

    void updateChatPreferenceAndApply(chat, {
      failureMessage: nextFavorite ? 'Unable to add this chat to Favorites.' : 'Unable to remove this chat from Favorites.',
      isFavorite: nextFavorite,
      optimisticContact: {
        isFavorite: nextFavorite
      }
    });
    setChatMoreActionTarget(null);
  }

  function handleTogglePinChat(chat: ChatItem) {
    if (!canSwipeChatRow(chat)) {
      return;
    }

    const nextPinned = !chat.isPinned;

    void updateChatPreferenceAndApply(chat, {
      failureMessage: nextPinned ? 'Unable to pin this chat.' : 'Unable to unpin this chat.',
      isPinned: nextPinned,
      optimisticContact: {
        isPinned: nextPinned
      }
    });
    setChatMoreActionTarget(null);
  }

  function handleClearChat(chat: ChatItem, mode: 'clear' | 'delete' = 'clear') {
    if (!canUseChatListActions(chat)) {
      return;
    }

    if (mode === 'delete') {
      handleMoveChatToSpam(chat);
      return;
    }

    setChatMoreActionTarget(null);
    const requestId = clearChatRequestIdRef.current + 1;
    clearChatRequestIdRef.current = requestId;
    setClearChatTarget(chat);
    setClearChatSummary(buildClearChatSummary(getVisibleMessagesForChat(chat)));

    void loadMessagesForClearChatSummary(chat)
      .then((summary) => {
        if (clearChatRequestIdRef.current === requestId) {
          setClearChatSummary(summary);
        }
      })
      .catch(() => undefined);
  }

  function closeClearChatModal() {
    if (isClearingChat) {
      return;
    }

    setClearChatTarget(null);
    setClearChatSummary(emptyClearChatSummary);
    clearChatRequestIdRef.current += 1;
  }

  async function loadMessagesForClearChatSummary(chat: ChatItem): Promise<ClearChatSummary> {
    const clearMessages = await loadMessagesForClearChat(chat);

    return buildClearChatSummary(clearMessages);
  }

  async function loadMessagesForClearChat(chat: ChatItem): Promise<ChatMessage[]> {
    const cachedConversation = await loadCachedChatConversation({
      contactId: chat.contactId,
      ...getLocalChatScope()
    }).catch(() => null);

    return uniqueChatMessages([
      ...(cachedConversation?.messages || []),
      ...getVisibleMessagesForChat(chat)
    ]);
  }

  function getVisibleMessagesForChat(chat: ChatItem): ChatMessage[] {
    return selectedChatRef.current?.contactId === chat.contactId
      ? messagesRef.current
      : [];
  }

  async function handleClearChatMediaFiles(chat: ChatItem) {
    if (!canUseChatListActions(chat) || isClearingChat) {
      return;
    }

    setIsClearingChat(true);

    try {
      const clearMessages = await loadMessagesForClearChat(chat);
      const cleanedMessages = await clearDownloadedMediaFilesFromMessages(clearMessages);
      const existingContact = chatContactsRef.current.find((contact) => contact.contactId === chat.contactId);

      await saveCachedChatConversation({
        contact: existingContact || mapChatItemToChatContact(chat),
        contactId: chat.contactId,
        messages: cleanedMessages,
        ...getLocalChatScope()
      });

      if (selectedChatRef.current?.contactId === chat.contactId) {
        setMessages(cleanedMessages);
      }

      setClearChatSummary(buildClearChatSummary(cleanedMessages));
      setClearChatTarget(null);
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to clear media files for this chat.'));
    } finally {
      setIsClearingChat(false);
    }
  }

  async function handleClearChatMessages(chat: ChatItem) {
    if (!canUseChatListActions(chat) || isClearingChat) {
      return;
    }

    setIsClearingChat(true);
    const clearedAt = new Date().toISOString();

    try {
      await updateChatPreferenceAndApply(chat, {
        clear: true,
        failureMessage: 'Unable to clear this chat for you.',
        optimisticContact: {
          clearedAt,
          isArchived: false,
          lastMessageAt: null,
          preview: '',
          unreadCount: 0
        }
      });
      setClearChatTarget(null);
      setClearChatSummary(emptyClearChatSummary);
    } finally {
      setIsClearingChat(false);
    }
  }

  function handleOpenSpamScreen() {
    setIsSpamScreenOpen(true);
    setIsArchiveScreenOpen(false);
    setIsArchiveEditMenuOpen(false);
    setIsArchiveSelectionMode(false);
    setSelectedArchivedChatIds({});
    setChatListFilter('all');
    setChatSearch('');
    setError(null);
  }

  function handleCloseSpamScreen() {
    setIsSpamScreenOpen(false);
    setSpamActionTarget(null);
    setChatSearch('');
    setError(null);
  }

  function handleOpenArchivedScreen() {
    setIsArchiveScreenOpen(true);
    setIsSpamScreenOpen(false);
    setIsArchiveSelectionMode(false);
    setIsArchiveEditMenuOpen(false);
    setSelectedArchivedChatIds({});
    setChatListFilter('all');
    setChatSearch('');
    setError(null);
    void loadArchiveSettings(false);
  }

  function handleCloseArchivedScreen() {
    setIsArchiveScreenOpen(false);
    setIsArchiveEditMenuOpen(false);
    setIsArchiveSelectionMode(false);
    setSelectedArchivedChatIds({});
    setChatSearch('');
    setError(null);
  }

  async function loadArchiveSettings(showError = true) {
    setIsLoadingArchiveSettings(true);

    try {
      const idToken = await getIdToken();
      const nextSettings = await getChatArchiveSettings(idToken);

      setChatArchiveSettings(nextSettings);
    } catch (nextError) {
      if (showError) {
        setError(getErrorMessage(nextError, 'Unable to load archive settings.'));
      }
    } finally {
      setIsLoadingArchiveSettings(false);
    }
  }

  async function saveArchiveSettings(nextSettings: ChatArchiveSettings) {
    setIsSavingArchiveSettings(true);
    setError(null);

    try {
      const idToken = await getIdToken();
      const savedSettings = await updateChatArchiveSettings({
        archiveSettings: nextSettings,
        idToken
      });

      setChatArchiveSettings(savedSettings);
      await loadChatContacts(false);
      setIsArchiveSettingsOpen(false);
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to save archive settings.'));
    } finally {
      setIsSavingArchiveSettings(false);
    }
  }

  function handleOpenArchiveSettings() {
    setIsArchiveEditMenuOpen(false);
    setIsArchiveSettingsOpen(true);
    void loadArchiveSettings(false);
  }

  function handleStartArchiveSelection() {
    setIsArchiveEditMenuOpen(false);
    setIsArchiveSelectionMode(true);
    setSelectedArchivedChatIds({});
  }

  function handleDoneArchiveSelection() {
    setIsArchiveSelectionMode(false);
    setSelectedArchivedChatIds({});
  }

  function toggleArchivedChatSelection(chat: ChatItem) {
    setSelectedArchivedChatIds((currentSelection) => ({
      ...currentSelection,
      [chat.contactId]: !currentSelection[chat.contactId]
    }));
  }

  function getSelectedArchivedChats(): ChatItem[] {
    return archivedConversationChatItems.filter((chat) => selectedArchivedChatIds[chat.contactId]);
  }

  async function handleUnarchiveSelectedChats() {
    const selectedChats = getSelectedArchivedChats().filter(canUseChatListActions);

    if (!selectedChats.length) {
      return;
    }

    await Promise.all(selectedChats.map((chat) => updateChatPreferenceAndApply(chat, {
      failureMessage: 'Unable to unarchive selected chats.',
      isArchived: false,
      optimisticContact: {
        isArchived: false
      }
    })));
    handleDoneArchiveSelection();
  }

  async function handleReadSelectedArchivedChats() {
    const selectedUnreadChats = getSelectedArchivedChats().filter((chat) => chat.unreadCount > 0);

    if (!selectedUnreadChats.length) {
      return;
    }

    try {
      const idToken = await getIdToken();

      for (const chat of selectedUnreadChats) {
        const result = await getChatMessages({
          chatType: chat.chatType,
          contactId: chat.contactId,
          currentUid,
          idToken
        });
        const cachedContact = await cacheChatContactPhoto(result.contact, idToken);

        setChatContacts((currentContacts) => upsertChatContact(currentContacts, {
          ...cachedContact,
          unreadCount: 0
        }));
      }

      handleDoneArchiveSelection();
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to mark archived chats as read.'));
    }
  }

  function handleDeleteSelectedArchivedChats() {
    const selectedChats = getSelectedArchivedChats().filter(canUseChatListActions);

    if (!selectedChats.length) {
      return;
    }

    Alert.alert(
      'Delete selected chats?',
      'Selected chats will move to Trash as read-only history and permanently delete after 30 days.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: async () => {
            const spammedAt = new Date().toISOString();

            await Promise.all(selectedChats.map((chat) => updateChatPreferenceAndApply(chat, {
              failureMessage: 'Unable to move selected chats to Trash.',
              isSpam: true,
              optimisticContact: {
                isArchived: false,
                isSpam: true,
                spammedAt,
                unreadCount: 0
              }
            })));
            handleDoneArchiveSelection();
          },
          style: 'destructive',
          text: 'Delete'
        }
      ]
    );
  }

  function handleMoveChatToSpam(chat: ChatItem) {
    if (!canUseChatListActions(chat)) {
      return;
    }

    Alert.alert(
      'Delete chat?',
      `${chat.title} will move to Trash as read-only history. A future message will start a fresh chat.`,
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => {
            const spammedAt = new Date().toISOString();

            void updateChatPreferenceAndApply(chat, {
              failureMessage: 'Unable to move this chat to Trash.',
              isSpam: true,
              optimisticContact: {
                isArchived: false,
                isSpam: true,
                spammedAt,
                unreadCount: 0
              }
            });
            setChatMoreActionTarget(null);
          },
          style: 'destructive',
          text: 'Delete'
        }
      ]
    );
  }

  function handleOpenTrashChat(chat: ChatItem) {
    const trashSegments = getActiveTrashSegments(chat);

    if (trashSegments.length > 1) {
      setSpamActionTarget(chat);
      return;
    }

    handleOpenTrashSegment(chat, trashSegments[0] || null);
  }

  function handleOpenTrashSegment(chat: ChatItem, trashSegment: ChatTrashSegment | null) {
    setSpamActionTarget(null);
    void handleOpenChat(chat, {
      isTrashReadOnly: true,
      trashSegmentId: trashSegment?.segmentId || null
    });
  }

  function handlePermanentDeleteSpamChat(chat: ChatItem) {
    if (!canUseChatListActions(chat) || isDeletingSpamChats) {
      return;
    }

    Alert.alert(
      'Permanently delete?',
      `${chat.title} will be deleted for your account and removed from Trash.`,
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => {
            setIsDeletingSpamChats(true);
            void updateChatPreferenceAndApply(chat, {
              failureMessage: 'Unable to permanently delete this chat.',
              optimisticContact: {
                clearedAt: new Date().toISOString(),
                isArchived: false,
                isFavorite: false,
                isPinned: false,
                isSpam: false,
                lastMessageAt: null,
                preview: '',
                spammedAt: null,
                trashSegments: [],
                unreadCount: 0
              },
              permanentDelete: true,
              removeFromList: true
            }).finally(() => {
              setIsDeletingSpamChats(false);
              setSpamActionTarget(null);
            });
          },
          style: 'destructive',
          text: 'Delete'
        }
      ]
    );
  }

  function handlePermanentDeleteAllSpamChats() {
    const deletableSpamChats = spamConversationChatItems.filter(canUseChatListActions);

    if (!deletableSpamChats.length || isDeletingSpamChats) {
      return;
    }

    Alert.alert(
      'Delete all Trash chats?',
      'All chats in Trash will be permanently deleted for your account.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: async () => {
            setIsDeletingSpamChats(true);

            try {
              await Promise.all(deletableSpamChats.map((chat) =>
                updateChatPreferenceAndApply(chat, {
                  failureMessage: 'Unable to permanently delete all Trash chats.',
                  optimisticContact: {
                    clearedAt: new Date().toISOString(),
                    isArchived: false,
                    isFavorite: false,
                    isPinned: false,
                    isSpam: false,
                    lastMessageAt: null,
                    preview: '',
                    spammedAt: null,
                    trashSegments: [],
                    unreadCount: 0
                  },
                  permanentDelete: true,
                  removeFromList: true
                })
              ));
              setSpamActionTarget(null);
            } finally {
              setIsDeletingSpamChats(false);
            }
          },
          style: 'destructive',
          text: 'Delete'
        }
      ]
    );
  }

  function handleOpenChatInfoFromMore(chat: ChatItem) {
    setChatMoreActionTarget(null);
    selectedChatRef.current = chat;
    setSelectedChat(chat);

    if (chat.chatType === 'GROUP') {
      setIsGroupInfoModalOpen(true);
    } else {
      setIsContactInfoModalOpen(true);
    }
  }

  /**
   * Runs realtime payloads one at a time, in the order they arrived.
   *
   * Each payload used to be started with `void` and left to race. Handling one
   * runs cache reads and writes, a token fetch, group key granting and envelope
   * decryption, so how long it takes depends on the message. A later message
   * whose handler was quick finished first, then an earlier, slower one finished
   * last and wrote its own older snapshot over the newer list — and the message
   * it had never seen disappeared from the thread until the next event repainted
   * it. That is the message that vanishes for a few seconds on Android.
   *
   * Chaining makes arrival order the order they are applied. A payload that
   * throws is caught here so it cannot break the chain for the ones behind it.
   */
  function enqueueChatRealtimePayload(payload: string) {
    chatRealtimeQueueRef.current.push(() => handleChatRealtimePayload(payload));
  }

  /**
   * Defers the id token until something actually asks for it.
   *
   * The token is only ever used to talk to the server about encrypted
   * envelopes. It was being fetched at the top of every conversation event,
   * including plain message events that never touch it and envelope events that
   * carry none — and when the token needs refreshing that is a network round
   * trip standing between a message arriving and it appearing on screen.
   *
   * Fetched at most once per event, and only if that event has envelope work.
   */
  function createDeferredIdToken(): () => Promise<string> {
    let pending: Promise<string> | null = null;

    return () => {
      if (!pending) {
        pending = getIdToken();
      }

      return pending;
    };
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

    if (event.type === 'contactTypingUpdated') {
      setTypingByConversation((current) => {
        const participants = current[event.contactId] || EMPTY_TYPING_LIST;
        const next = applyTypingUpdate(participants, {
          isTyping: event.isTyping,
          name: event.typingName,
          nowMs: Date.now(),
          uid: event.typingUid
        });

        // The server renews every few seconds. Returning the same object when
        // nothing changed keeps the chat list from re-rendering on each one.
        if (next === participants) {
          return current;
        }

        return { ...current, [event.contactId]: next };
      });
      return;
    }

    if (event.type === 'chatContactUpdated') {
      const revivalInput = {
        hasIncomingMessages: event.envelopes.length > 0,
        isLocallyDeleted: locallyDeletedChatContactIdsRef.current.has(event.contact.contactId)
      };

      if (shouldIgnoreDeletedChatEvent(revivalInput)) {
        return;
      }

      if (shouldReviveDeletedChat(revivalInput)) {
        await reviveLocallyDeletedChatContact(event.contact.contactId);
      }

      const shouldMarkRead = selectedChatRef.current?.contactId === event.contact.contactId &&
        !activeTrashSegmentIdRef.current;
      const baseContact = shouldMarkRead
        ? { ...event.contact, unreadCount: 0 }
        : event.contact;
      const getEventIdToken = createDeferredIdToken();
      /**
       * Uploading history keys must not stand in front of the message.
       *
       * This POST grants the other members' devices access to read this stretch
       * of the conversation back later. Nothing below reads its result, failures
       * are already tolerated, and our own decryption uses a private key that is
       * on this device — so it never needed to finish first. Awaited, it put a
       * full network round trip between a group message arriving and it being
       * shown, which is why group chats lagged while direct chats were instant.
       *
       * Started here and left to finish on its own. It still runs, and still
       * runs once per event.
       */
      if (event.contact.chatType === 'GROUP' && event.envelopes.length) {
        void getEventIdToken()
          .then((idToken) => grantGroupChatHistoryKeys({
            contactId: event.contact.contactId,
            envelopes: event.envelopes,
            idToken
          }))
          .catch(() => undefined);
      }
      const decryptStartedAtMs = Date.now();
      const deliveredMessages = event.envelopes.length
        ? await decryptRealtimeEncryptedEnvelopes({
            currentUid,
            envelopes: event.envelopes,
            idToken: await getEventIdToken()
          })
        : [];
      const decryptMs = Date.now() - decryptStartedAtMs;
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
          ...getLocalChatScope()
        }).catch(() => null);
        const mergedMessages = uniqueChatMessages([
          ...(cachedConversation?.messages || []),
          ...deliveredMessagesWithReactions
        ]);
        const visibleMergedMessages = await filterHiddenMessagesForChat(nextContact.contactId, mergedMessages);
        // Queued messages live only in the outbox - they are deliberately kept
        // out of the conversation cache. Rendering a cache-derived list without
        // re-merging the outbox erases every in-flight bubble, which is what
        // made a uploading video blink in and out as contact events arrived.
        const visibleMessagesWithOutbox = await withPendingOutboxMessages(
          nextContact.contactId,
          visibleMergedMessages
        );

        nextContact = applyLocalChatPreview(nextContact, visibleMessagesWithOutbox);

        if (shouldMarkRead && selectedChatRef.current?.contactId === nextContact.contactId) {
          setMessageReactions(event.messageReactions);
          setMessages(visibleMessagesWithOutbox);
        }

        const persistStartedAtMs = Date.now();

        await saveCachedChatConversation({
          contact: nextContact,
          contactId: nextContact.contactId,
          messages: visibleMergedMessages,
          ...getLocalChatScope()
        });
        await persistLocalChatSyncStateForMessages(nextContact.contactId, visibleMergedMessages);

        // Timed because "receiving is slow" is not something that can be fixed
        // by reading code: the cost is either the decrypt, the cache write, or
        // the round trip before either starts, and they need telling apart.
        console.log('[SynzappChatReceive]', JSON.stringify({
          decryptMs,
          envelopes: event.envelopes.length,
          persistMs: Date.now() - persistStartedAtMs,
          threadSize: visibleMergedMessages.length,
          totalMs: Date.now() - decryptStartedAtMs
        }));
        queueEncryptedChatBackup();
        queueMediaDownloadsForMessages(nextContact.contactId, visibleMergedMessages, nextContact.chatType || 'DIRECT', true);
      } else if (shouldMarkRead) {
        const cachedConversation = await loadCachedChatConversation({
          contactId: nextContact.contactId,
          ...getLocalChatScope()
        }).catch(() => null);
        const reactedMessages = await filterHiddenMessagesForChat(nextContact.contactId, applyReactionMapToMessages(
          cachedConversation?.messages || messagesRef.current,
          event.messageReactions
        ));
        // Same as above: this list came from the conversation cache, which never
        // contains queued messages. Re-merge the outbox before it reaches the UI.
        const reactedMessagesWithOutbox = await withPendingOutboxMessages(
          nextContact.contactId,
          reactedMessages
        );

        if (selectedChatRef.current?.contactId === nextContact.contactId) {
          setMessageReactions(event.messageReactions);
          setMessages(reactedMessagesWithOutbox);
        }

        if (reactedMessages.length) {
          await saveCachedChatConversation({
            contact: nextContact,
            contactId: nextContact.contactId,
            messages: reactedMessages,
            ...getLocalChatScope()
          });
          queueEncryptedChatBackup();
        }
      }

      applyVisibleChatContactUpdate(nextContact, shouldMarkRead);
      return;
    }

    if (event.type === 'conversationMessages' || event.type === 'conversationEncryptedEnvelopes') {
      // Messages for a deleted conversation bring it back rather than being
      // dropped; only metadata-only events stay ignored.
      if (locallyDeletedChatContactIdsRef.current.has(event.contactId)) {
        await reviveLocallyDeletedChatContact(event.contactId);
      }

      if (selectedChatRef.current?.contactId !== event.contactId || activeTrashSegmentIdRef.current) {
        return;
      }

      const cachedContact = await cacheRealtimeChatContact({
        ...event.contact,
        unreadCount: 0
      });
      const [cachedConversation, pendingMessages] = await Promise.all([
        loadCachedChatConversation({
          contactId: event.contactId,
          ...getLocalChatScope()
        }).catch(() => null),
        listPendingChatMessages({
          contactId: event.contactId,
          ...getLocalChatScope()
        })
      ]);
      const getEventIdToken = createDeferredIdToken();
      /**
       * Uploading history keys must not stand in front of the message.
       *
       * This POST grants the other members' devices access to read this stretch
       * of the conversation back later. Nothing below reads its result, failures
       * are already tolerated, and our own decryption uses a private key that is
       * on this device — so it never needed to finish first. Awaited, it put a
       * full network round trip between a group message arriving and it being
       * shown, which is why group chats lagged while direct chats were instant.
       *
       * Started here and left to finish on its own. It still runs, and still
       * runs once per event.
       */
      if (event.type === 'conversationEncryptedEnvelopes' && event.contact.chatType === 'GROUP') {
        void getEventIdToken()
          .then((idToken) => grantGroupChatHistoryKeys({
            contactId: event.contactId,
            envelopes: event.envelopes,
            idToken
          }))
          .catch(() => undefined);
      }
      const serverMessages = uniqueChatMessages(event.type === 'conversationEncryptedEnvelopes'
        ? await decryptRealtimeEncryptedEnvelopes({
            currentUid,
            envelopes: event.envelopes,
            idToken: await getEventIdToken()
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
      const persistedMessagesToSave = await keepMessagesCommittedDuringThisPass(
        event.contactId,
        cachedConversation?.messages || [],
        visiblePersistedMessages
      );

      await saveCachedChatConversation({
        contact: contactWithLocalPreview,
        contactId: event.contactId,
        messages: persistedMessagesToSave,
        ...getLocalChatScope()
      });
      await persistLocalChatSyncStateForMessages(event.contactId, persistedMessagesToSave);
      queueEncryptedChatBackup();
      queueMediaDownloadsForMessages(event.contactId, nextMessages, event.contact.chatType || 'DIRECT', true);
      void syncPendingMessagesForChat(event.contactId);
    }
  }

  /**
   * Keeps anything the send path committed while this pass was still working.
   *
   * Both paths read the conversation cache, do work that awaits — decryption, a
   * hidden-message filter — and then write back a list assembled from their own
   * earlier read. A message the send path committed during that gap was simply
   * overwritten, and because the outbox record had already been dropped the
   * bubble had nowhere left to live: it vanished from the sender's own thread
   * while the recipient had it perfectly well.
   *
   * Re-reading immediately before the write closes that gap. Only messages that
   * were absent from **both** the original read and the list being written are
   * carried over — so something deliberately filtered out (hidden, deleted,
   * cleared) stays out, because it was present in the original read. Membership
   * still belongs to the caller; this only restores what arrived behind its
   * back.
   */
  async function keepMessagesCommittedDuringThisPass(
    contactId: string,
    messagesReadAtStart: ChatMessage[],
    messagesToWrite: ChatMessage[]
  ): Promise<ChatMessage[]> {
    const current = await loadCachedChatConversation({
      contactId,
      ...getLocalChatScope()
    }).catch(() => null);

    if (!current?.messages?.length) {
      return messagesToWrite;
    }

    const knownAtStart = new Set(messagesReadAtStart.map((message) => message.messageId));
    const beingWritten = new Set(messagesToWrite.map((message) => message.messageId));
    const arrivedBehindOurBack = current.messages.filter((message) => (
      !knownAtStart.has(message.messageId) && !beingWritten.has(message.messageId)
    ));

    if (!arrivedBehindOurBack.length) {
      return messagesToWrite;
    }

    return uniqueChatMessages([...messagesToWrite, ...arrivedBehindOurBack]);
  }

  /**
   * Re-attaches this conversation's outbox to a cache-derived message list.
   *
   * In-flight messages are deliberately excluded from the conversation cache, so
   * the outbox is the only place a queued or uploading bubble exists. Any code
   * path that rebuilds the visible thread from the cache must pass through here,
   * otherwise it silently erases every send that is still in progress - the bug
   * behind an uploading video blinking in and out of the thread.
   */
  async function withPendingOutboxMessages(
    contactId: string,
    messages: ChatMessage[]
  ): Promise<ChatMessage[]> {
    const pendingMessages = await listPendingChatMessages({
      contactId,
      ...getLocalChatScope()
    }).catch(() => []);

    if (!pendingMessages.length) {
      return messages;
    }

    return uniqueChatMessages([
      ...messages,
      ...pendingMessages.map((pendingMessage) => pendingMessage.message)
    ]);
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

    if (selectedChatRef.current && !activeTrashSegmentIdRef.current) {
      subscribeRealtimeConversation(socket, selectedChatRef.current.contactId);
      return;
    }

    unsubscribeRealtimeConversation(socket);
  }

  function updateActiveSynzappCall(
    updater: (currentCall: ActiveSynzappCall | null) => ActiveSynzappCall | null
  ) {
    setActiveSynzappCall((currentCall) => {
      const nextCall = updater(currentCall);
      activeSynzappCallRef.current = nextCall;

      return nextCall;
    });
  }

  async function connectCallRealtimeSocket() {
    if (!registeredDeviceId) {
      return;
    }

    const existingSocket = callRealtimeSocketRef.current;
    callRealtimeSocketRef.current = null;
    existingSocket?.close();
    callRealtimeReadyRef.current = false;

    try {
      const idToken = await getIdToken();
      const socket = openCallRealtimeSocket(idToken, registeredDeviceId);

      callRealtimeSocketRef.current = socket;
      socket.onmessage = (event) => {
        const payload = typeof event.data === 'string' ? event.data : '';
        void handleCallRealtimePayload(payload);
      };
      socket.onerror = () => {
        console.warn('Synzapp call socket error.');
      };
      socket.onclose = () => {
        callRealtimeReadyRef.current = false;

        if (callRealtimeSocketRef.current !== socket) {
          return;
        }

        callRealtimeSocketRef.current = null;

        if (callRealtimeReconnectTimerRef.current) {
          clearTimeout(callRealtimeReconnectTimerRef.current);
        }

        callRealtimeReconnectTimerRef.current = setTimeout(() => {
          callRealtimeReconnectTimerRef.current = null;
          void connectCallRealtimeSocket();
        }, 2200);
      };
    } catch (nextError) {
      console.warn('Synzapp call socket could not connect:', getErrorMessage(nextError, 'Calling is unavailable.'));
    }
  }

  async function ensureCallRealtimeReadyForAction(timeoutMs = 4000): Promise<WebSocket | null> {
    const currentSocket = callRealtimeSocketRef.current;

    if (currentSocket?.readyState === WebSocket.OPEN && callRealtimeReadyRef.current) {
      return currentSocket;
    }

    if (
      !currentSocket ||
      currentSocket.readyState === WebSocket.CLOSED ||
      currentSocket.readyState === WebSocket.CLOSING
    ) {
      void connectCallRealtimeSocket();
    }

    const startedAt = Date.now();

    return new Promise((resolve) => {
      const pollSocket = () => {
        const socket = callRealtimeSocketRef.current;

        if (socket?.readyState === WebSocket.OPEN && callRealtimeReadyRef.current) {
          resolve(socket);
          return;
        }

        if (Date.now() - startedAt >= timeoutMs) {
          resolve(socket?.readyState === WebSocket.OPEN ? socket : null);
          return;
        }

        setTimeout(pollSocket, 100);
      };

      pollSocket();
    });
  }

  async function handleCallRealtimePayload(payload: string) {
    const event = parseCallRealtimeEvent(payload);

    if (!event) {
      return;
    }

    if (event.type === 'ready') {
      callRealtimeReadyRef.current = true;
      return;
    }

    if (event.type === 'error') {
      console.warn('Synzapp call event ignored:', event.message);
      if (activeSynzappCallRef.current) {
        Alert.alert('Synzapp call', event.message);
      }
      return;
    }

    if (event.type === 'incomingCall') {
      await handleIncomingSynzappCall(event.call, {
        skipNativeIncomingDisplay: true
      });
      return;
    }

    if (event.type === 'callStarted') {
      await handleSynzappCallStarted(event.call);
      return;
    }

    if (event.type === 'callSignal') {
      await handleSynzappCallSignal(event);
      return;
    }

    if (event.type === 'callAnswered') {
      updateActiveSynzappCall((currentCall) => currentCall?.call.callId === event.callId
        ? { ...currentCall, status: currentCall.status === 'calling' ? 'connecting' : currentCall.status }
        : currentCall
      );
      const activeCall = activeSynzappCallRef.current;

      if (activeCall?.call.callId === event.callId) {
        await updateSynzappCallHistoryStatus(activeCall.call, 'answered');
      }
      return;
    }

    if (event.type === 'callEnded') {
      await handleRemoteSynzappCallEnded(event.callId, event.reason);
    }
  }

  async function handleIncomingCallPushNotification(data: CallPushNotificationData) {
    if (!data.callId || data.callerUid === currentUid) {
      return;
    }

    void connectCallRealtimeSocket();
    await handleIncomingSynzappCall({
      callId: data.callId,
      callerName: data.callerName || data.title || 'Synzapp user',
      callerUid: data.callerUid,
      chatType: data.chatType,
      contactId: data.contactId,
      createdAt: data.createdAt || new Date().toISOString(),
      mode: data.mode,
      participantUids: data.participantUids.length
        ? data.participantUids
        : [data.callerUid, currentUid],
      tenantId: data.tenantId || getActiveTenantId(),
      title: data.title || data.callerName || 'Synzapp call'
    }, {
      skipNativeIncomingDisplay: true
    });
  }

  async function handleSynzappVoipCallEvent(event: SynzappVoipCallEvent) {
    if (event.type === 'incoming' && event.call) {
      if (event.call.callerUid === currentUid) {
        return;
      }

      void connectCallRealtimeSocket();
      await handleIncomingSynzappCall(event.call, {
        nativeDisplayed: event.nativeDisplayed === true,
        skipNativeIncomingDisplay: event.nativeDisplayed === true
      });
      return;
    }

    if (event.type === 'failed') {
      console.warn('Synzapp iOS native call presentation failed:', event.errorMessage || event.callId || 'Unknown CallKit error.');
      return;
    }

    const callId = event.callId || event.call?.callId || '';
    const activeCall = activeSynzappCallRef.current;

    if (!callId || !activeCall || activeCall.call.callId !== callId) {
      return;
    }

    if (event.type === 'answer') {
      await handleAnswerIncomingSynzappCall();
      return;
    }

    if (event.type === 'end') {
      await handleEndSynzappCall(activeCall.status === 'ringing' ? 'declined' : 'ended');
    }
  }



  async function recordSynzappCallHistory(
    call: SynzappCallRecord,
    status: SynzappCallHistoryStatus,
    direction: SynzappCallDirection,
    options: { unseen?: boolean } = {}
  ) {
    if (!call.callId || !call.contactId) {
      return;
    }

    const now = new Date().toISOString();
    const contact = chatContactsRef.current.find((currentContact) =>
      currentContact.contactId === call.contactId ||
      (call.chatType === 'DIRECT' && currentContact.contactId === call.callerUid)
    );
    const entry: SynzappCallHistoryEntry = {
      callId: call.callId,
      callerName: call.callerName || contact?.displayName || call.title || 'Synzapp user',
      chatType: call.chatType,
      contactId: call.contactId,
      createdAt: call.createdAt || now,
      direction,
      endedAt: isFinalSynzappCallHistoryStatus(status) ? now : null,
      id: `call-${call.callId}`,
      mode: call.mode,
      participantUids: call.participantUids,
      profilePhotoUrl: contact?.profilePhotoUrl || null,
      status,
      title: contact?.displayName || call.title || call.callerName || 'Synzapp call',
      unseen: options.unseen === true && activeTab !== 'Calls',
      updatedAt: now
    };

    await persistCallHistory(upsertSynzappCallHistoryEntry(callHistoryRef.current, entry));
  }

  async function updateSynzappCallHistoryStatus(
    call: SynzappCallRecord,
    status: SynzappCallHistoryStatus,
    options: { unseen?: boolean } = {}
  ) {
    const existingEntry = callHistoryRef.current.find((entry) => entry.callId === call.callId);
    await recordSynzappCallHistory(
      call,
      status,
      existingEntry?.direction || (call.callerUid === currentUid ? 'outgoing' : 'incoming'),
      options
    );
  }

  async function ensureSynzappCallKeepReady() {
    if (callKeepSetupRef.current) {
      return;
    }

    const RNCallKeep = getOptionalCallKeepRuntime();

    if (!RNCallKeep?.setup) {
      return;
    }

    await RNCallKeep.setup({
      android: {
        alertDescription: 'Allow Synzapp to place and receive secure workplace calls.',
        alertTitle: 'Enable Synzapp calls',
        cancelButton: 'Not now',
        foregroundService: {
          channelId: 'synzapp-calls',
          channelName: 'Synzapp calls',
          notificationIcon: 'notification_icon',
          notificationTitle: 'Synzapp call in progress'
        },
        okButton: 'Enable',
        selfManaged: false
      },
      ios: {
        appName: 'Synzapp',
        handleType: 'generic',
        includesCallsInRecents: true,
        maximumCallGroups: '1',
        maximumCallsPerCallGroup: '8',
        supportsVideo: true
      }
    });

    RNCallKeep.setAvailable?.(true);
    RNCallKeep.canMakeMultipleCalls?.(false);
    callKeepSetupRef.current = true;

    const answerSubscription = RNCallKeep.addEventListener?.('answerCall', ({ callUUID }: { callUUID?: string }) => {
      const activeCall = activeSynzappCallRef.current;

      if (activeCall?.call.callId === callUUID) {
        void handleAnswerIncomingSynzappCall();
      }
    });
    const endSubscription = RNCallKeep.addEventListener?.('endCall', ({ callUUID }: { callUUID?: string }) => {
      const activeCall = activeSynzappCallRef.current;

      if (activeCall && activeCall.call.callId === callUUID) {
        const reason: SynzappCallEndReason = activeCall.status === 'ringing' ? 'declined' : 'ended';
        void handleEndSynzappCall(reason);
      }
    });

    [answerSubscription, endSubscription].forEach((subscription) => {
      if (subscription && typeof subscription === 'object' && 'remove' in subscription) {
        callKeepEventSubscriptionsRef.current.push(subscription as { remove?: () => void });
      }
    });
  }

  async function handleIncomingSynzappCall(
    call: SynzappCallRecord,
    options: { nativeDisplayed?: boolean; skipNativeIncomingDisplay?: boolean } = {}
  ) {
    const existingCall = activeSynzappCallRef.current;

    if (existingCall?.call.callId === call.callId) {
      return;
    }

    if (existingCall && existingCall.call.callId !== call.callId) {
      const socket = callRealtimeSocketRef.current;

      if (socket) {
        sendEndCall(socket, call.callId, 'busy');
      }
      await recordSynzappCallHistory(call, 'busy', 'incoming', { unseen: true });
      return;
    }

    const incomingCall: ActiveSynzappCall = {
      call,
      direction: 'incoming',
      isMuted: false,
      isNativePresented: options.nativeDisplayed === true,
      isSpeakerOn: call.mode === 'video',
      isVideoEnabled: call.mode === 'video',
      localStreamUrl: null,
      remoteStreamUrlsByUid: {},
      status: 'ringing'
    };

    updateActiveSynzappCall(() => incomingCall);
    await recordSynzappCallHistory(call, 'ringing', 'incoming', { unseen: true });
    const isAppActive = appStateRef.current === 'active';

    if (!options.nativeDisplayed && isAppActive) {
      await ensureSynzappCallKeepReady().catch(() => undefined);
      startIncomingCallAudio(call.mode);
      startSynzappIncomingRingTimeout(call.callId);
    }
    if (!options.skipNativeIncomingDisplay && !isAppActive) {
      showNativeIncomingSynzappCall(call);
    }
  }

  async function handleSynzappCallStarted(call: SynzappCallRecord) {
    updateActiveSynzappCall((currentCall) => {
      const nextCall: ActiveSynzappCall = currentCall?.call.callId === call.callId
        ? {
            ...currentCall,
            call,
            status: currentCall.status === 'ringing' ? 'ringing' : 'calling'
          }
        : {
            call,
            direction: call.callerUid === currentUid ? 'outgoing' : 'incoming',
            isMuted: false,
            isNativePresented: false,
            isSpeakerOn: call.mode === 'video',
            isVideoEnabled: call.mode === 'video',
            localStreamUrl: null,
            remoteStreamUrlsByUid: {},
            status: call.callerUid === currentUid ? 'calling' : 'ringing'
          };

      return nextCall;
    });

    await recordSynzappCallHistory(
      call,
      'ringing',
      call.callerUid === currentUid ? 'outgoing' : 'incoming',
      { unseen: call.callerUid !== currentUid }
    );

    if (call.callerUid !== currentUid || callOfferStartedIdsRef.current.has(call.callId)) {
      return;
    }

    callOfferStartedIdsRef.current.add(call.callId);

    try {
      await ensureSynzappCallKeepReady().catch(() => undefined);
      showNativeOutgoingSynzappCall(call);
      await startOutgoingSynzappCallOffers(call);
    } catch (nextError) {
      await handleEndSynzappCall('failed');
      Alert.alert('Synzapp call', getErrorMessage(nextError, 'This build needs the latest Synzapp calling update before calls can start.'));
    }
  }

  async function handleSynzappCallSignal(event: Extract<SynzappCallRealtimeEvent, { type: 'callSignal' }>) {
    const activeCall = activeSynzappCallRef.current;

    if (!activeCall || activeCall.call.callId !== event.callId || activeCall.status === 'ringing') {
      pendingCallSignalsRef.current.push(event);
      return;
    }

    await processSynzappCallSignal(event);
  }

  async function processPendingSynzappCallSignals(callId: string) {
    const [matchingSignals, remainingSignals] = partitionCallSignals(
      pendingCallSignalsRef.current,
      (signal) => signal.callId === callId
    );

    pendingCallSignalsRef.current = remainingSignals;

    for (const signal of matchingSignals) {
      await processSynzappCallSignal(signal);
    }
  }

  async function processSynzappCallSignal(event: Extract<SynzappCallRealtimeEvent, { type: 'callSignal' }>) {
    const activeCall = activeSynzappCallRef.current;

    if (!activeCall || activeCall.call.callId !== event.callId) {
      return;
    }

    const runtime = getSynzappWebRtcRuntime();
    const localStream = await ensureSynzappCallLocalStream(activeCall.call.mode);
    const peerConnection = ensureSynzappPeerConnection(event.fromUid, activeCall.call, localStream, runtime);

    if (event.kind === 'offer') {
      await peerConnection.setRemoteDescription(createRtcSessionDescription(runtime, event.payload));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      sendSynzappCallSignal(activeCall.call.callId, event.fromUid, 'answer', peerConnection.localDescription || answer);
      setSynzappCallConnecting();
      return;
    }

    if (event.kind === 'answer') {
      await peerConnection.setRemoteDescription(createRtcSessionDescription(runtime, event.payload));
      setSynzappCallConnecting();
      return;
    }

    if (event.kind === 'iceCandidate' && event.payload) {
      await peerConnection.addIceCandidate(createRtcIceCandidate(runtime, event.payload));
    }
  }

  async function startOutgoingSynzappCallOffers(call: SynzappCallRecord) {
    const runtime = getSynzappWebRtcRuntime();
    const localStream = await ensureSynzappCallLocalStream(call.mode);
    const targetUids = call.participantUids.filter((uid) => uid && uid !== currentUid);

    startOutgoingCallAudio(call.mode);

    for (const targetUid of targetUids) {
      const peerConnection = ensureSynzappPeerConnection(targetUid, call, localStream, runtime);
      const offer = await peerConnection.createOffer();

      await peerConnection.setLocalDescription(offer);
      sendSynzappCallSignal(call.callId, targetUid, 'offer', peerConnection.localDescription || offer);
    }
  }

  async function ensureSynzappCallLocalStream(mode: SynzappCallMode) {
    if (callLocalStreamRef.current) {
      return callLocalStreamRef.current;
    }

    const runtime = getSynzappWebRtcRuntime();
    const mediaStream = await runtime.mediaDevices?.getUserMedia?.({
      audio: true,
      video: mode === 'video'
        ? {
            facingMode: 'user',
            frameRate: 24,
            height: 720,
            width: 1280
          }
        : false
    });

    if (!mediaStream) {
      throw new Error('Camera or microphone could not be started.');
    }

    callLocalStreamRef.current = mediaStream;

    const localStreamUrl = typeof mediaStream.toURL === 'function' ? mediaStream.toURL() : null;
    updateActiveSynzappCall((currentCall) => currentCall
      ? {
          ...currentCall,
          localStreamUrl
        }
      : currentCall
    );

    return mediaStream;
  }

  function ensureSynzappPeerConnection(
    remoteUid: string,
    call: SynzappCallRecord,
    localStream: any,
    runtime: WebRtcRuntime
  ) {
    if (callPeerConnectionsRef.current[remoteUid]) {
      return callPeerConnectionsRef.current[remoteUid];
    }

    if (!runtime.RTCPeerConnection) {
      throw new Error('Calling is not available in this installed build.');
    }

    const peerConnection = new runtime.RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });

    if (typeof localStream.getTracks === 'function') {
      localStream.getTracks().forEach((track: unknown) => {
        peerConnection.addTrack?.(track, localStream);
      });
    }

    peerConnection.onicecandidate = (event: { candidate?: unknown }) => {
      if (event.candidate) {
        sendSynzappCallSignal(call.callId, remoteUid, 'iceCandidate', event.candidate);
      }
    };
    peerConnection.ontrack = (event: { streams?: any[] }) => {
      const remoteStream = event.streams?.[0];
      const remoteStreamUrl = remoteStream && typeof remoteStream.toURL === 'function'
        ? remoteStream.toURL()
        : null;

      if (!remoteStreamUrl) {
        return;
      }

      updateActiveSynzappCall((currentCall) => currentCall?.call.callId === call.callId
        ? {
            ...currentCall,
            remoteStreamUrlsByUid: {
              ...currentCall.remoteStreamUrlsByUid,
              [remoteUid]: remoteStreamUrl
            },
            status: 'connected'
          }
        : currentCall
      );
    };
    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'connected') {
        updateActiveSynzappCall((currentCall) => currentCall?.call.callId === call.callId
          ? { ...currentCall, status: 'connected' }
          : currentCall
        );
      }
    };

    callPeerConnectionsRef.current[remoteUid] = peerConnection;

    return peerConnection;
  }

  function sendSynzappCallSignal(
    callId: string,
    targetUid: string,
    kind: SynzappCallSignalKind,
    payload: unknown
  ) {
    const socket = callRealtimeSocketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN || !callRealtimeReadyRef.current) {
      return;
    }

    sendCallSignal(socket, {
      callId,
      kind,
      payload: serializeSynzappCallSignalPayload(payload),
      targetUid
    });
  }

  async function handleStartDirectCall(mode: SynzappCallMode) {
    const chat = selectedChatRef.current;

    if (!chat || chat.chatType === 'GROUP') {
      return;
    }

    await startSynzappCall({
      chat,
      mode,
      targetUids: []
    });
  }

  async function handleStartGroupCall(mode: SynzappCallMode, targetUids: string[]) {
    const chat = selectedChatRef.current;

    if (!chat || chat.chatType !== 'GROUP') {
      return;
    }

    await startSynzappCall({
      chat,
      mode,
      targetUids
    });
  }

  async function startSynzappCall({
    chat,
    mode,
    targetUids
  }: {
    chat: ChatItem;
    mode: SynzappCallMode;
    targetUids: string[];
  }) {
    if (activeSynzappCallRef.current) {
      Alert.alert('Synzapp call', 'You already have a call in progress.');
      return;
    }

    if (!chat.hasActiveDevice && chat.chatType !== 'GROUP') {
      Alert.alert('Secure device needed', getRecipientDeviceNotReadyMessage(chat.title));
      return;
    }

    const socket = callRealtimeSocketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN || !callRealtimeReadyRef.current) {
      Alert.alert('Synzapp call', 'Calling is still connecting. Please try again in a moment.');
      void connectCallRealtimeSocket();
      return;
    }

    const callId = createSynzappCallId();
    const optimisticCall: SynzappCallRecord = {
      callId,
      callerName: userProfile?.displayName || 'You',
      callerUid: currentUid,
      chatType: chat.chatType,
      contactId: chat.contactId,
      createdAt: new Date().toISOString(),
      mode,
      participantUids: [currentUid, ...targetUids],
      tenantId: getActiveTenantId(),
      title: chat.title
    };

    updateActiveSynzappCall(() => ({
      call: optimisticCall,
      direction: 'outgoing',
      isMuted: false,
      isNativePresented: false,
      isSpeakerOn: mode === 'video',
      isVideoEnabled: mode === 'video',
      localStreamUrl: null,
      remoteStreamUrlsByUid: {},
      status: 'calling'
    }));
    await recordSynzappCallHistory(optimisticCall, 'ringing', 'outgoing');

    try {
      await ensureSynzappCallKeepReady().catch(() => undefined);
      showNativeOutgoingSynzappCall(optimisticCall);
      sendStartCall(socket, {
        callId,
        chatType: chat.chatType,
        contactId: chat.contactId,
        mode,
        targetUids,
        title: chat.title
      });
    } catch (nextError) {
      await handleEndSynzappCall('failed');
      Alert.alert('Synzapp call', getErrorMessage(nextError, 'Unable to start this call.'));
    }
  }

  async function handleAnswerIncomingSynzappCall() {
    const activeCall = activeSynzappCallRef.current;

    if (!activeCall || activeCall.direction !== 'incoming') {
      return;
    }

    try {
      clearSynzappIncomingRingTimeout();
      stopIncomingCallAudio();
      startOutgoingCallAudio(activeCall.call.mode);
      updateActiveSynzappCall((currentCall) => currentCall?.call.callId === activeCall.call.callId
        ? { ...currentCall, status: 'connecting' }
        : currentCall
      );
      await updateSynzappCallHistoryStatus(activeCall.call, 'answered');
      await ensureSynzappCallLocalStream(activeCall.call.mode);
      const socket = await ensureCallRealtimeReadyForAction();

      if (socket) {
        sendAnswerCall(socket, activeCall.call.callId);
      }

      await processPendingSynzappCallSignals(activeCall.call.callId);
    } catch (nextError) {
      await handleEndSynzappCall('failed');
      Alert.alert('Synzapp call', getErrorMessage(nextError, 'Unable to answer this call.'));
    }
  }

  async function handleEndSynzappCall(reason: SynzappCallEndReason = 'ended') {
    const activeCall = activeSynzappCallRef.current;

    if (!activeCall) {
      return;
    }

    const socket = await ensureCallRealtimeReadyForAction(1800);

    if (socket?.readyState === WebSocket.OPEN) {
      sendEndCall(socket, activeCall.call.callId, reason);
    }

    await updateSynzappCallHistoryStatus(
      activeCall.call,
      getSynzappCallHistoryStatusFromEndReason(reason, activeCall.direction, activeCall.status)
    );

    finishNativeSynzappCall(activeCall.call.callId, reason);
    clearSynzappIncomingRingTimeout();
    await cleanupSynzappCallMedia();
    pendingCallSignalsRef.current = pendingCallSignalsRef.current.filter((signal) => signal.callId !== activeCall.call.callId);
    callOfferStartedIdsRef.current.delete(activeCall.call.callId);
    updateActiveSynzappCall((currentCall) => currentCall?.call.callId === activeCall.call.callId
      ? { ...currentCall, status: 'ended' }
      : currentCall
    );
    setTimeout(() => {
      updateActiveSynzappCall((currentCall) => currentCall?.call.callId === activeCall.call.callId ? null : currentCall);
    }, 260);
  }

  async function handleRemoteSynzappCallEnded(callId: string, reason: SynzappCallEndReason) {
    const activeCall = activeSynzappCallRef.current;

    if (!activeCall || activeCall.call.callId !== callId) {
      return;
    }

    await updateSynzappCallHistoryStatus(
      activeCall.call,
      getSynzappCallHistoryStatusFromEndReason(reason, activeCall.direction, activeCall.status),
      { unseen: activeCall.direction === 'incoming' && activeCall.status === 'ringing' }
    );
    finishNativeSynzappCall(callId, reason);
    clearSynzappIncomingRingTimeout();
    await cleanupSynzappCallMedia();
    pendingCallSignalsRef.current = pendingCallSignalsRef.current.filter((signal) => signal.callId !== callId);
    callOfferStartedIdsRef.current.delete(callId);
    updateActiveSynzappCall(() => null);
  }

  async function cleanupSynzappCallMedia() {
    clearSynzappIncomingRingTimeout();
    stopIncomingCallAudio();
    stopOutgoingCallAudio();

    Object.values(callPeerConnectionsRef.current).forEach((peerConnection) => {
      try {
        peerConnection.close?.();
      } catch {
        // Media cleanup should never block leaving the call screen.
      }
    });
    callPeerConnectionsRef.current = {};

    const localStream = callLocalStreamRef.current;
    callLocalStreamRef.current = null;

    if (localStream && typeof localStream.getTracks === 'function') {
      localStream.getTracks().forEach((track: { stop?: () => void }) => {
        try {
          track.stop?.();
        } catch {
          // Ignore native media teardown failures.
        }
      });
    }
  }

  function setSynzappCallConnecting() {
    updateActiveSynzappCall((currentCall) => currentCall && currentCall.status !== 'connected'
      ? { ...currentCall, status: 'connecting' }
      : currentCall
    );
  }

  function toggleSynzappCallMute() {
    const nextMuted = !activeSynzappCallRef.current?.isMuted;
    const localStream = callLocalStreamRef.current;

    if (localStream && typeof localStream.getAudioTracks === 'function') {
      localStream.getAudioTracks().forEach((track: { enabled?: boolean }) => {
        track.enabled = !nextMuted;
      });
    }

    getOptionalInCallManagerRuntime()?.setMicrophoneMute?.(nextMuted);
    updateActiveSynzappCall((currentCall) => currentCall
      ? { ...currentCall, isMuted: nextMuted }
      : currentCall
    );
  }

  function toggleSynzappCallSpeaker() {
    const nextSpeakerState = !activeSynzappCallRef.current?.isSpeakerOn;

    getOptionalInCallManagerRuntime()?.setSpeakerphoneOn?.(nextSpeakerState);
    updateActiveSynzappCall((currentCall) => currentCall
      ? { ...currentCall, isSpeakerOn: nextSpeakerState }
      : currentCall
    );
  }

  function toggleSynzappCallVideo() {
    const nextVideoState = !activeSynzappCallRef.current?.isVideoEnabled;
    const localStream = callLocalStreamRef.current;

    if (localStream && typeof localStream.getVideoTracks === 'function') {
      localStream.getVideoTracks().forEach((track: { enabled?: boolean }) => {
        track.enabled = nextVideoState;
      });
    }

    updateActiveSynzappCall((currentCall) => currentCall
      ? { ...currentCall, isVideoEnabled: nextVideoState }
      : currentCall
    );
  }








  function startSynzappIncomingRingTimeout(callId: string) {
    clearSynzappIncomingRingTimeout();
    callRingTimeoutRef.current = setTimeout(() => {
      const activeCall = activeSynzappCallRef.current;

      if (!activeCall || activeCall.call.callId !== callId || activeCall.status !== 'ringing') {
        return;
      }

      void handleEndSynzappCall('missed');
    }, 60_000);
  }

  function clearSynzappIncomingRingTimeout() {
    if (!callRingTimeoutRef.current) {
      return;
    }

    clearTimeout(callRingTimeoutRef.current);
    callRingTimeoutRef.current = null;
  }

  /**
   * Un-deletes a conversation the user had cleared from this device.
   *
   * Both the in-memory set and the persisted record have to go. Clearing only
   * the first would let the chat open now and disappear again after a restart,
   * which is worse than the original bug because it looks intermittent.
   */
  async function reviveLocallyDeletedChatContact(contactId: string): Promise<void> {
    if (!locallyDeletedChatContactIdsRef.current.has(contactId)) {
      return;
    }

    locallyDeletedChatContactIdsRef.current.delete(contactId);
    await removePersistedHiddenDirectChatContactId(getLocalChatScope(), contactId).catch(() => undefined);
  }

  function removeUnavailableChatFromList(chat: ChatItem) {
    hasResolvedChatContactsRef.current = true;
    setChatContacts((currentContacts) => currentContacts.filter((contact) => contact.contactId !== chat.contactId));

    if (selectedChatRef.current?.contactId === chat.contactId) {
      selectedChatRef.current = null;
      activeTrashSegmentIdRef.current = null;
      setSelectedChat(null);
      setActiveTrashSegmentId(null);
      setMessages([]);
      setMessageReactions({});
      setReplyTarget(null);
      setMessageDraft('');
      resetCachedMessagePaging();
      resetForwardMode();
      resetMessageDeleteMode();
    }
  }

	  async function handleOpenChat(
	    chat: ChatItem,
	    options: {
	      isTrashReadOnly?: boolean;
	      trashSegmentId?: string | null;
	    } = {}
	  ) {
	    try {
	      await assertCompanyDataRenderable(getLocalChatScope());
	    } catch (nextError) {
	      if (isCompanyAccessDeniedError(nextError)) {
	        onSessionInvalid(ACCESS_DENIED_MESSAGE);
	        return;
	      }

	      throw nextError;
	    }

	    const openRequestId = chatOpenRequestIdRef.current + 1;
    const trashSegmentId = options.trashSegmentId || null;
    const isTrashReadOnly = options.isTrashReadOnly === true;

    // A chat the user can see and tap is a chat they expect to open. Reaching
    // this with a deletion record means the conversation came back with new
    // activity, so the record is stale — dropping the chat instead is what made
    // it vanish on tap.
    if (!isTrashReadOnly) {
      await reviveLocallyDeletedChatContact(chat.contactId);
    }

    chatOpenRequestIdRef.current = openRequestId;
    selectedChatRef.current = chat;
    activeTrashSegmentIdRef.current = isTrashReadOnly ? trashSegmentId || '__legacy_trash__' : null;
    setSelectedChat(chat);
    setActiveTrashSegmentId(activeTrashSegmentIdRef.current);
    setIsChatNotificationSettingsOpen(false);
    setIsChatTranscriptLanguageOpen(false);
    setIsDirectContactDetailsOpen(false);
    setIsAddToGroupModalOpen(false);
    setIsConversationSearchOpen(false);
    setChatContacts((currentContacts) => currentContacts.map((contact) =>
      contact.contactId === chat.contactId
        ? { ...contact, unreadCount: 0 }
        : contact
    ));
    setMessageDraft('');
    setReplyTarget(null);
    resetForwardMode();
    resetMessageDeleteMode();
    resetCachedMessagePaging();
    setIsLoadingMessages(true);
    setMessages([]);
    setMessageReactions({});
    setError(null);
    // Warm the recipient key lookup while the cached thread renders, so the
    // first message typed does not pay for a round trip that could have
    // happened during the time the user spent reading.
    void getIdToken()
      .then((idToken) => prefetchChatEncryptionContext({
        chatType: chat.chatType,
        contactId: chat.contactId,
        idToken
      }))
      .catch(() => undefined);

    if (!isTrashReadOnly) {
      await loadCachedMessagesForChat(chat, openRequestId);
    }

    if (!isActiveChatOpenRequest(openRequestId, chat.contactId)) {
      return;
    }

    await loadMessagesForChat(chat, true, openRequestId, trashSegmentId, isTrashReadOnly);
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
    // Refresh on open so a colleague who joined since launch shows up without
    // the user having to close and reopen the app.
    void loadDirectoryChatContacts();

    if (canViewEmployees && !approvedEmployees.length && !isLoadingEmployees) {
      void loadEmployees();
    }
  }

  /**
   * Reads the reply counts for the open conversation out of the local store.
   *
   * Cheap: a grouped count over an indexed column, with nothing decrypted. It
   * runs when a chat opens and after its messages change, because a reply just
   * sent is in memory before it has been written.
   */
  useEffect(() => {
    const contactId = selectedChat?.contactId;

    if (!contactId) {
      setStoredReplyIds({});
      return;
    }

    let isCurrent = true;

    void loadCachedReplyIds({ contactId, ...getLocalChatScope() })
      .then((idsByParent) => {
        if (isCurrent) {
          setStoredReplyIds(idsByParent);
        }
      })
      .catch(() => undefined);

    return () => {
      isCurrent = false;
    };
  }, [messages.length, selectedChat?.contactId]);

  function handleOpenMainNavigation() {
    setIsMainNavigationOpen(true);
    // Everything on that menu is profile data — the admin named on it, their
    // number, and whether the company still allows the number at all. Held in
    // memory it goes stale silently, so a company switching the number off
    // would not reach a phone until the app was next launched. Refreshed
    // without blocking: what is already known draws now, and is corrected when
    // the answer arrives.
    void loadUserProfile(false).catch(() => undefined);
  }

  function handleCloseLibraryToChats() {
    handleSelectFooterTab('Chats');
    setSettingsScreen('list');
    setCompanyLibraryPreview(null);
  }

  function handleCloseMainNavigation() {
    setIsMainNavigationOpen(false);
  }

  function handleSelectMainNavigationLink(label: typeof mainNavigationLinks[number]) {
    setIsMainNavigationOpen(false);
    if (label === 'INTERPRETER') {
      handleSelectFooterTab('Interpreter');
      return;
    }

    if (label === 'LIBRARY') {
      handleSelectFooterTab('Library');
      return;
    }

    if (label === 'LEADERS STANDARD WORK') {
      handleSelectFooterTab('LSW');
      return;
    }

    if (label === 'ACTIONS') {
      handleSelectFooterTab('Actions');
      return;
    }

    Alert.alert(label, `${label} will be available in Synzapp soon.`);
  }

  function handleOpenNewCallModal() {
    setNewCallSearch('');
    setIsNewCallModalOpen(true);
  }

  function handleCloseNewCallModal() {
    setIsNewCallModalOpen(false);
    setNewCallSearch('');
  }

  function handleOpenActionsOptions() {
    setIsActionsOptionsOpen(true);
  }

  /** Back to the chat list, which is where Actions is reached from. */
  function handleCloseActionsToChats() {
    setIsActionsOptionsOpen(false);
    handleSelectFooterTab('Chats');
  }

  function handleToggleCallOptions() {
    setIsCallOptionsOpen((isOpen) => !isOpen);
  }

  function handleToggleCallEditMode() {
    setIsCallOptionsOpen(false);
    setIsCallEditMode((isEditing) => !isEditing);
  }

  function handleOpenScheduledCalls() {
    setIsCallOptionsOpen(false);
    setIsScheduledCallsModalOpen(true);
  }

  function handleOpenCallFavoritesModal() {
    setCallFavoritesSearch('');
    setIsCallFavoritesModalOpen(true);
  }

  function handleOpenCallKeypad() {
    setCallKeypadDigits('');
    setIsCallKeypadOpen(true);
  }

  function handleOpenScheduleCallModal() {
    setScheduleCallDraft(createScheduleCallDraft(userProfile?.displayName || null));
    setScheduleCallRecipientIds({});
    setScheduleCallRecipientSearch('');
    setIsScheduleCallSendModalOpen(false);
    setIsScheduleCallModalOpen(true);
  }

  async function handleStartCallFromContact(contact: ChatContact, mode: SynzappCallMode = 'voice') {
    if (!contact.hasActiveDevice) {
      Alert.alert('Secure device needed', getRecipientDeviceNotReadyMessage(contact.displayName));
      return;
    }

    setIsNewCallModalOpen(false);
    setIsCallFavoritesModalOpen(false);
    await startSynzappCall({
      chat: mapChatContactToChatItem(contact),
      mode,
      targetUids: []
    });
  }

  function handleAppendCallKeypadDigit(digit: string) {
    setCallKeypadDigits((currentDigits) => getNextCallKeypadInput(currentDigits, digit));
  }

  function handleAppendCallKeypadPlus() {
    setCallKeypadDigits((currentDigits) => addPlusToCallKeypadInput(currentDigits));
  }

  function handleBackspaceCallKeypadDigit() {
    setCallKeypadDigits((currentDigits) => currentDigits.slice(0, -1));
  }

  async function handleStartKeypadCall() {
    const dialMatch = findCallDialMatch(registeredCallContacts, callKeypadDigits, currentUserDialIdentity);

    if (dialMatch?.kind === 'self') {
      Alert.alert('Sorry!', 'You cannot call yourself. Dial another number.');
      return;
    }

    if (!dialMatch) {
      Alert.alert(
        'Registered contact required',
        'Synzapp calls are limited to registered people in this company. Select a company contact or enter a matching company phone number.'
      );
      return;
    }

    setIsCallKeypadOpen(false);
    await handleStartCallFromContact(dialMatch.contact, 'voice');
  }

  function handleToggleCallFavorite(contactId: string) {
    const nextFavoriteContactIds = callFavoriteContactIdsRef.current.includes(contactId)
      ? callFavoriteContactIdsRef.current.filter((favoriteContactId) => favoriteContactId !== contactId)
      : [...callFavoriteContactIdsRef.current, contactId];

    void persistCallFavorites(nextFavoriteContactIds);
  }

  function handleDeleteCallHistoryEntry(entry: SynzappCallHistoryEntry) {
    Alert.alert(
      'Remove call?',
      `${entry.title} will be removed from your call history on this device.`,
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => {
            void persistCallHistory(callHistoryRef.current.filter((currentEntry) => currentEntry.id !== entry.id));
          },
          style: 'destructive',
          text: 'Remove'
        }
      ]
    );
  }

  function handleUpdateScheduleCallDraft(patch: Partial<ScheduleCallDraft>) {
    setScheduleCallDraft((currentDraft) => normalizeScheduleCallDraft({
      ...currentDraft,
      ...patch
    }));
  }

  function handleCloseScheduleCallFlow() {
    setIsScheduleCallModalOpen(false);
    setIsScheduleCallSendModalOpen(false);
    setScheduleCallRecipientIds({});
    setScheduleCallRecipientSearch('');
  }

  function handleNextScheduleCall() {
    const validationError = getScheduleCallValidationError(scheduleCallDraft);

    if (validationError) {
      Alert.alert('Schedule call', validationError);
      return;
    }

    setIsScheduleCallModalOpen(false);
    setIsScheduleCallSendModalOpen(true);
  }

  function handleToggleScheduleCallRecipient(contactId: string) {
    setScheduleCallRecipientIds((currentIds) => ({
      ...currentIds,
      [contactId]: !currentIds[contactId]
    }));
  }

  function handleSaveScheduledCall() {
    const validationError = getScheduleCallValidationError(scheduleCallDraft);
    const selectedContactIds = Object.keys(scheduleCallRecipientIds).filter((contactId) =>
      Boolean(scheduleCallRecipientIds[contactId])
    );
    const title = scheduleCallDraft.title.trim();

    if (validationError) {
      Alert.alert('Schedule call', validationError);
      setIsScheduleCallSendModalOpen(false);
      setIsScheduleCallModalOpen(true);
      return;
    }

    if (!selectedContactIds.length && !scheduleCallDraft.calendarAddedAt) {
      Alert.alert('Choose where to send it', 'Select at least one company contact or add this scheduled call to your calendar.');
      return;
    }

    const now = new Date().toISOString();
    const scheduledCall: SynzappScheduledCall = {
      calendarAddedAt: scheduleCallDraft.calendarAddedAt || null,
      calendarEventId: scheduleCallDraft.calendarEventId || null,
      callType: scheduleCallDraft.callType,
      contactIds: selectedContactIds,
      createdAt: now,
      description: scheduleCallDraft.description.trim(),
      endsAt: scheduleCallDraft.includeEndTime ? scheduleCallDraft.endsAt.toISOString() : null,
      id: scheduleCallDraft.id,
      includeEndTime: scheduleCallDraft.includeEndTime,
      reminderMinutes: scheduleCallDraft.reminderMinutes,
      requireApproval: scheduleCallDraft.requireApproval,
      startsAt: scheduleCallDraft.startsAt.toISOString(),
      title
    };

    void persistScheduledCalls([scheduledCall, ...scheduledCallsRef.current]);
    handleCloseScheduleCallFlow();
    Alert.alert('Scheduled call saved', 'You can find it under Scheduled calls.');
  }

  async function handleAddScheduleCallToCalendar() {
    const validationError = getScheduleCallValidationError(scheduleCallDraft);

    if (validationError) {
      Alert.alert('Schedule call', validationError);
      return;
    }

    if (isAddingScheduleToCalendar) {
      return;
    }

    setIsAddingScheduleToCalendar(true);

    try {
      const isCalendarAvailable = await Calendar.isAvailableAsync();

      if (!isCalendarAvailable) {
        Alert.alert('Calendar unavailable', 'This device does not currently support adding Synzapp calls to a calendar.');
        return;
      }

      const permissions = await Calendar.requestCalendarPermissionsAsync();

      if (permissions.status !== 'granted') {
        Alert.alert('Calendar permission needed', 'Allow calendar access to add this scheduled call to your device calendar.');
        return;
      }

      const selectedRecipients = scheduleCallRecipientContacts.filter((contact) =>
        Boolean(scheduleCallRecipientIds[contact.contactId])
      );
      const result = await Calendar.createEventInCalendarAsync(
        buildScheduleCallCalendarEventData(scheduleCallDraft, selectedRecipients),
        { startNewActivityTask: false }
      );

      if (result.action === 'saved' || result.action === 'done') {
        setScheduleCallDraft((currentDraft) => ({
          ...currentDraft,
          calendarAddedAt: new Date().toISOString(),
          calendarEventId: result.id || currentDraft.calendarEventId || null
        }));
        Alert.alert('Added to calendar', 'The scheduled Synzapp call was handed to your device calendar.');
      }
    } catch (nextError) {
      Alert.alert('Calendar unavailable', getErrorMessage(nextError, 'Unable to add this call to your calendar right now.'));
    } finally {
      setIsAddingScheduleToCalendar(false);
    }
  }

  function handleCloseNewChatModal() {
    setIsNewChatModalOpen(false);
    setIsAddMembersModalOpen(false);
    setIsGroupDetailsModalOpen(false);
    setIsGroupPermissionsModalOpen(false);
    resetNewGroupDraft();
    setNewChatSearch('');
  }

  function resetNewGroupDraft() {
    setAddMembersSearch('');
    setNewGroupNameDraft('');
    setNewGroupPhotoUri(null);
    setNewGroupPermissionMode('ALL_MEMBERS');
    setSelectedNewGroupMemberIds({});
  }

  async function handleOpenContactFromNewChat(contact: ChatContact) {
    locallyDeletedChatContactIdsRef.current.delete(contact.contactId);
    await removePersistedHiddenDirectChatContactId(getLocalChatScope(), contact.contactId).catch(() => undefined);
    setChatContacts((currentContacts) => upsertChatContact(currentContacts, contact));
    handleCloseNewChatModal();
    await handleOpenChat(mapChatContactToChatItem(contact));
  }

  /**
   * Reaching the admin the main menu just named.
   *
   * Goes through the same path the new-chat picker uses, so a chat opened from
   * the menu is the same chat in every respect. Nothing new is written for it.
   */
  function handleOpenAdminChatFromMenu(contactId: string) {
    const contact = startableDirectChatContacts.find((entry) => entry.contactId === contactId);

    if (!contact) {
      return;
    }

    setIsMainNavigationOpen(false);
    void handleOpenContactFromNewChat(contact);
  }

  function handleOpenAddMembersModal() {
    setNewGroupFlowOrigin('newChat');
    setAddMembersSearch('');
    setIsNewChatModalOpen(false);
    setIsAddMembersModalOpen(true);
  }

  function handleOpenGroupCallOptions() {
    const chat = selectedChatRef.current;

    if (chat?.chatType !== 'GROUP') {
      return;
    }

    setIsGroupCallPeopleModalOpen(false);
    setIsGroupAddMembersModalOpen(false);
    setIsGroupMembersModalOpen(false);
    setIsGroupCallOptionsOpen(true);
  }

  function handleOpenGroupInfo() {
    const chat = selectedChatRef.current;

    if (chat?.chatType !== 'GROUP') {
      return;
    }

    setIsGroupCallOptionsOpen(false);
    setIsGroupCallPeopleModalOpen(false);
    setIsGroupAddMembersModalOpen(false);
    setIsGroupMembersModalOpen(false);
    setIsGroupSwitcherModalOpen(false);
    setIsContactInfoModalOpen(false);
    setIsChatNotificationSettingsOpen(false);
    setIsChatTranscriptLanguageOpen(false);
    setIsDirectContactDetailsOpen(false);
    setIsAddToGroupModalOpen(false);
    setIsConversationSearchOpen(false);
    setIsGroupInfoModalOpen(true);
  }

  function handleCloseGroupInfo() {
    setIsGroupInfoModalOpen(false);
  }

  function handleOpenContactInfo() {
    const chat = selectedChatRef.current;

    if (!chat || chat.chatType === 'GROUP') {
      return;
    }

    setIsGroupCallOptionsOpen(false);
    setIsGroupCallPeopleModalOpen(false);
    setIsGroupAddMembersModalOpen(false);
    setIsGroupMembersModalOpen(false);
    setIsGroupSwitcherModalOpen(false);
    setIsGroupInfoModalOpen(false);
    setIsChatNotificationSettingsOpen(false);
    setIsChatTranscriptLanguageOpen(false);
    setIsDirectContactDetailsOpen(false);
    setIsAddToGroupModalOpen(false);
    setIsConversationSearchOpen(false);
    void loadDirectContactDetails(chat, false);
    setIsContactInfoModalOpen(true);
  }

  function handleStartCreateGroupWithContactInfo() {
    const chat = selectedChatRef.current;

    if (!chat || chat.chatType === 'GROUP') {
      return;
    }

    setError(null);
    setNewGroupFlowOrigin('contactInfo');
    setIsContactInfoModalOpen(false);
    setIsChatNotificationSettingsOpen(false);
    setIsChatTranscriptLanguageOpen(false);
    setIsDirectContactDetailsOpen(false);
    setIsAddToGroupModalOpen(false);
    setIsNewChatModalOpen(false);
    setIsAddMembersModalOpen(false);
    setAddMembersSearch('');
    setNewGroupNameDraft('');
    setNewGroupPhotoUri(null);
    setNewGroupPermissionMode('ALL_MEMBERS');
    setSelectedNewGroupMemberIds({ [chat.contactId]: true });

    setTimeout(() => {
      if (selectedChatRef.current?.contactId === chat.contactId) {
        setIsAddMembersModalOpen(true);
      }
    }, Platform.OS === 'ios' ? 320 : 140);
  }

  function handleCloseContactInfo() {
    setIsContactInfoModalOpen(false);
    setIsChatNotificationSettingsOpen(false);
    setIsChatTranscriptLanguageOpen(false);
    setIsDirectContactDetailsOpen(false);
    setIsAddToGroupModalOpen(false);
  }

  function handleCloseChatNotificationSettings() {
    const chat = selectedChatRef.current;

    setIsChatNotificationSettingsOpen(false);

    if (chat) {
      setTimeout(() => {
        if (selectedChatRef.current?.contactId === chat.contactId) {
          if (chat.chatType === 'GROUP') {
            setIsGroupInfoModalOpen(true);
          } else {
            setIsContactInfoModalOpen(true);
          }
        }
      }, Platform.OS === 'ios' ? 260 : 120);
    }
  }

  function handleOpenChatNotificationSettings() {
    const chat = selectedChatRef.current;

    if (!chat) {
      return;
    }

    setError(null);
    setIsContactInfoModalOpen(false);
    setIsGroupInfoModalOpen(false);
    void loadChatNotificationSettings(chat, true);

    setTimeout(() => {
      if (selectedChatRef.current?.contactId === chat.contactId) {
        setIsChatNotificationSettingsOpen(true);
      }
    }, Platform.OS === 'ios' ? 320 : 140);
  }

  async function loadChatNotificationSettings(chat: ChatItem, showError = true) {
    setIsLoadingChatNotificationSettings(true);

    try {
      const idToken = await getIdToken();
      const settings = await getChatNotificationSettings({
        chatType: chat.chatType,
        contactId: chat.contactId,
        idToken
      });

      setChatNotificationSettingsByContactId((currentSettings) => ({
        ...currentSettings,
        [chat.contactId]: settings
      }));
    } catch (nextError) {
      if (showError) {
        setError(getErrorMessage(nextError, 'Unable to load notification settings.'));
      }
    } finally {
      setIsLoadingChatNotificationSettings(false);
    }
  }

  async function handleSelectChatNotificationMuteMode() {
    const chat = selectedChatRef.current;

    if (!chat || isSavingChatNotificationSettings) {
      return;
    }

    const selectedOption = await selectScreenOption(
      'Mute notifications',
      chatNotificationMuteOptions,
      (option) => option.label
    );

    if (!selectedOption) {
      return;
    }

    await saveChatNotificationSettings(chat, {
      muteMode: selectedOption.value
    });
  }

  async function handleSelectChatNotificationAlertTone() {
    const chat = selectedChatRef.current;

    if (!chat || isSavingChatNotificationSettings) {
      return;
    }

    const selectedOption = await selectScreenOption(
      'Alert tone',
      chatNotificationAlertToneOptions,
      (option) => option.label
    );

    if (!selectedOption) {
      return;
    }

    await saveChatNotificationSettings(chat, {
      alertTone: selectedOption.value
    });
  }

  async function saveChatNotificationSettings(
    chat: ChatItem,
    updates: Partial<Pick<ChatNotificationSettings, 'alertTone' | 'muteMode'>>
  ) {
    const previousSettings = chatNotificationSettingsByContactId[chat.contactId] ||
      getDefaultChatNotificationSettings(chat.contactId);
    const optimisticSettings: ChatNotificationSettings = {
      ...previousSettings,
      ...updates,
      mutedUntil: updates.muteMode ? getOptimisticMutedUntil(updates.muteMode) : previousSettings.mutedUntil,
      updatedAt: new Date().toISOString()
    };

    setIsSavingChatNotificationSettings(true);
    setChatNotificationSettingsByContactId((currentSettings) => ({
      ...currentSettings,
      [chat.contactId]: optimisticSettings
    }));

    try {
      const idToken = await getIdToken();
      const settings = await updateChatNotificationSettings({
        alertTone: optimisticSettings.alertTone,
        chatType: chat.chatType,
        contactId: chat.contactId,
        idToken,
        muteMode: optimisticSettings.muteMode
      });

      setChatNotificationSettingsByContactId((currentSettings) => ({
        ...currentSettings,
        [chat.contactId]: settings
      }));
    } catch (nextError) {
      setChatNotificationSettingsByContactId((currentSettings) => ({
        ...currentSettings,
        [chat.contactId]: previousSettings
      }));
      setError(getErrorMessage(nextError, 'Unable to update notification settings.'));
    } finally {
      setIsSavingChatNotificationSettings(false);
    }
  }

  function handleCloseChatTranscriptLanguage() {
    const chat = selectedChatRef.current;

    setIsChatTranscriptLanguageOpen(false);
    setChatTranscriptLanguageSearch('');

    if (chat && chat.chatType !== 'GROUP') {
      setTimeout(() => {
        if (selectedChatRef.current?.contactId === chat.contactId) {
          setIsContactInfoModalOpen(true);
        }
      }, Platform.OS === 'ios' ? 260 : 120);
    }
  }

  function handleOpenChatTranscriptLanguage() {
    const chat = selectedChatRef.current;

    if (!chat || chat.chatType === 'GROUP') {
      return;
    }

    setError(null);
    setChatTranscriptLanguageSearch('');
    setIsContactInfoModalOpen(false);
    void loadChatTranscriptLanguage(chat, true);

    setTimeout(() => {
      if (selectedChatRef.current?.contactId === chat.contactId) {
        setIsChatTranscriptLanguageOpen(true);
      }
    }, Platform.OS === 'ios' ? 320 : 140);
  }

  async function loadChatTranscriptLanguage(chat: ChatItem, showError = true) {
    if (chat.chatType === 'GROUP') {
      return;
    }

    setIsLoadingChatTranscriptLanguage(true);

    try {
      const idToken = await getIdToken();
      const transcriptLanguage = await getChatTranscriptLanguage({
        contactId: chat.contactId,
        idToken
      });

      setChatTranscriptLanguageByContactId((currentLanguages) => ({
        ...currentLanguages,
        [chat.contactId]: transcriptLanguage
      }));
    } catch (nextError) {
      if (showError) {
        setError(getErrorMessage(nextError, 'Unable to load transcript language.'));
      }
    } finally {
      setIsLoadingChatTranscriptLanguage(false);
    }
  }

  async function handleSelectChatTranscriptLanguage(languageCode: ChatTranscriptLanguageCode) {
    const chat = selectedChatRef.current;

    if (!chat || chat.chatType === 'GROUP' || isSavingChatTranscriptLanguage) {
      return;
    }

    const previousLanguage = chatTranscriptLanguageByContactId[chat.contactId] ||
      getDefaultChatTranscriptLanguage(chat.contactId);
    const optimisticLanguage: ChatTranscriptLanguageSetting = {
      contactId: chat.contactId,
      languageCode,
      updatedAt: new Date().toISOString()
    };

    setIsSavingChatTranscriptLanguage(true);
    setChatTranscriptLanguageByContactId((currentLanguages) => ({
      ...currentLanguages,
      [chat.contactId]: optimisticLanguage
    }));

    try {
      const idToken = await getIdToken();
      const transcriptLanguage = await updateChatTranscriptLanguage({
        contactId: chat.contactId,
        idToken,
        languageCode
      });

      setChatTranscriptLanguageByContactId((currentLanguages) => ({
        ...currentLanguages,
        [chat.contactId]: transcriptLanguage
      }));
    } catch (nextError) {
      setChatTranscriptLanguageByContactId((currentLanguages) => ({
        ...currentLanguages,
        [chat.contactId]: previousLanguage
      }));
      setError(getErrorMessage(nextError, 'Unable to update transcript language.'));
    } finally {
      setIsSavingChatTranscriptLanguage(false);
    }
  }

  function handleCloseDirectContactDetails() {
    const chat = selectedChatRef.current;

    setIsDirectContactDetailsOpen(false);

    if (chat && chat.chatType !== 'GROUP') {
      setTimeout(() => {
        if (selectedChatRef.current?.contactId === chat.contactId) {
          setIsContactInfoModalOpen(true);
        }
      }, Platform.OS === 'ios' ? 260 : 120);
    }
  }

  function handleOpenDirectContactDetails() {
    const chat = selectedChatRef.current;

    if (!chat || chat.chatType === 'GROUP') {
      return;
    }

    setError(null);
    setIsContactInfoModalOpen(false);
    void loadDirectContactDetails(chat, true);

    setTimeout(() => {
      if (selectedChatRef.current?.contactId === chat.contactId) {
        setIsDirectContactDetailsOpen(true);
      }
    }, Platform.OS === 'ios' ? 320 : 140);
  }

  async function loadDirectContactDetails(chat: ChatItem, showError = true) {
    if (chat.chatType === 'GROUP') {
      return;
    }

    setIsLoadingDirectContactDetails(true);

    try {
      const idToken = await getIdToken();
      const details = await getDirectChatContactDetails({
        contactId: chat.contactId,
        idToken
      });

      setProfilePhotoAuthToken(idToken);
      setDirectContactDetailsByContactId((currentDetails) => ({
        ...currentDetails,
        [chat.contactId]: details
      }));
    } catch (nextError) {
      if (showError) {
        setError(getErrorMessage(nextError, 'Unable to load contact details.'));
      }
    } finally {
      setIsLoadingDirectContactDetails(false);
    }
  }

  function handleCloseAddToGroupModal() {
    const chat = selectedChatRef.current;

    setIsAddToGroupModalOpen(false);
    setAddToGroupSearch('');
    setSelectedAddToGroupIds({});

    if (chat && chat.chatType !== 'GROUP') {
      setTimeout(() => {
        if (selectedChatRef.current?.contactId === chat.contactId) {
          setIsContactInfoModalOpen(true);
        }
      }, Platform.OS === 'ios' ? 260 : 120);
    }
  }

  function handleOpenAddToGroupModal() {
    const chat = selectedChatRef.current;

    if (!chat || chat.chatType === 'GROUP') {
      return;
    }

    setError(null);
    setAddToGroupSearch('');
    setSelectedAddToGroupIds({});
    setIsContactInfoModalOpen(false);
    setIsDirectContactDetailsOpen(false);
    void loadAddToGroupTargets(chat, true);

    setTimeout(() => {
      if (selectedChatRef.current?.contactId === chat.contactId) {
        setIsAddToGroupModalOpen(true);
      }
    }, Platform.OS === 'ios' ? 320 : 140);
  }

  async function loadAddToGroupTargets(chat: ChatItem, showError = true) {
    if (chat.chatType === 'GROUP') {
      return;
    }

    setIsLoadingAddToGroups(true);

    try {
      const idToken = await getIdToken();
      const targets = await listAddableGroupsForContact({
        contactId: chat.contactId,
        idToken
      });

      setAddToGroupTargetsByContactId((currentTargets) => ({
        ...currentTargets,
        [chat.contactId]: targets
      }));
    } catch (nextError) {
      if (showError) {
        setError(getErrorMessage(nextError, 'Unable to load groups.'));
      }
    } finally {
      setIsLoadingAddToGroups(false);
    }
  }

  function handleToggleAddToGroupTarget(groupId: string) {
    setSelectedAddToGroupIds((currentIds) => {
      const nextIds = { ...currentIds };

      if (nextIds[groupId]) {
        delete nextIds[groupId];
      } else if (Object.keys(nextIds).length < 10) {
        nextIds[groupId] = true;
      }

      return nextIds;
    });
  }

  async function handleConfirmAddToGroups() {
    const chat = selectedChatRef.current;
    const selectedGroupIds = Object.keys(selectedAddToGroupIds).filter((groupId) => selectedAddToGroupIds[groupId]);

    if (!chat || chat.chatType === 'GROUP' || !selectedGroupIds.length || isSavingAddToGroups) {
      return;
    }

    setIsSavingAddToGroups(true);
    setError(null);

    try {
      const idToken = await getIdToken();

      await Promise.all(selectedGroupIds.map((groupId) =>
        addContactToGroupChat({
          contactId: chat.contactId,
          groupId,
          idToken
        })
      ));

      await Promise.all([
        loadChatContacts(false),
        loadGroupSettings(false),
        loadAddToGroupTargets(chat, false)
      ]);

      setSelectedAddToGroupIds({});
      setIsAddToGroupModalOpen(false);

      setTimeout(() => {
        if (selectedChatRef.current?.contactId === chat.contactId) {
          setIsContactInfoModalOpen(true);
        }
      }, Platform.OS === 'ios' ? 260 : 120);

      Alert.alert(
        'Added to group',
        `${chat.title} was added to ${selectedGroupIds.length === 1 ? 'the selected group' : `${selectedGroupIds.length} groups`}.`
      );
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to add this contact to group.'));
    } finally {
      setIsSavingAddToGroups(false);
    }
  }

  function handleOpenGroupSwitcher() {
    const chat = selectedChatRef.current;

    if (chat?.chatType !== 'GROUP') {
      return;
    }

    setIsGroupInfoModalOpen(false);
    setIsGroupCallOptionsOpen(false);
    setIsGroupCallPeopleModalOpen(false);
    setIsGroupAddMembersModalOpen(false);
    setIsGroupMembersModalOpen(false);
    setIsGroupSwitcherModalOpen(true);
    void loadGroupSettings(false);
  }

  function handleStartGroupCreateFromSwitcher() {
    setIsGroupSwitcherModalOpen(false);
    setNewGroupFlowOrigin('groupSwitcher');
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

    if (chat?.chatType !== 'GROUP') {
      return;
    }

    setIsGroupInfoModalOpen(false);
    setGroupCallMode(mode);
    setGroupCallPeopleSearch('');
    setSelectedGroupCallMemberIds({});
    setIsGroupCallOptionsOpen(false);
    setIsGroupAddMembersModalOpen(false);
    setIsGroupMembersModalOpen(false);
    setIsGroupCallPeopleModalOpen(true);
  }

  function handleCloseGroupCallPeopleModal() {
    setIsGroupCallPeopleModalOpen(false);
    setGroupCallPeopleSearch('');
    setSelectedGroupCallMemberIds({});
  }

  function handleOpenGroupAddMembersModal() {
    const chat = selectedChatRef.current;

    if (chat?.chatType !== 'GROUP') {
      return;
    }

    setError(null);
    setIsGroupInfoModalOpen(false);
    setIsGroupCallOptionsOpen(false);
    setIsGroupCallPeopleModalOpen(false);
    setIsGroupMembersModalOpen(false);
    setGroupAddMembersSearch('');
    setSelectedGroupAddMemberIds({});

    setTimeout(() => {
      if (selectedChatRef.current?.contactId === chat.contactId) {
        setIsGroupAddMembersModalOpen(true);
      }
    }, Platform.OS === 'ios' ? 320 : 140);
  }

  function handleCloseGroupAddMembersModal() {
    const chat = selectedChatRef.current;

    setIsGroupAddMembersModalOpen(false);
    setGroupAddMembersSearch('');
    setSelectedGroupAddMemberIds({});

    if (chat?.chatType === 'GROUP') {
      setTimeout(() => {
        if (selectedChatRef.current?.contactId === chat.contactId) {
          setIsGroupInfoModalOpen(true);
        }
      }, Platform.OS === 'ios' ? 260 : 120);
    }
  }

  function handleOpenGroupMembersModal() {
    const chat = selectedChatRef.current;

    if (chat?.chatType !== 'GROUP') {
      return;
    }

    setGroupMembersSearch('');
    setIsGroupInfoModalOpen(false);
    setIsGroupAddMembersModalOpen(false);
    setIsGroupCallOptionsOpen(false);
    setIsGroupCallPeopleModalOpen(false);

    setTimeout(() => {
      if (selectedChatRef.current?.contactId === chat.contactId) {
        setIsGroupMembersModalOpen(true);
      }
    }, Platform.OS === 'ios' ? 320 : 140);
  }

  function handleCloseGroupMembersModal() {
    const chat = selectedChatRef.current;

    setIsGroupMembersModalOpen(false);
    setGroupMembersSearch('');

    if (chat?.chatType === 'GROUP') {
      setTimeout(() => {
        if (selectedChatRef.current?.contactId === chat.contactId) {
          setIsGroupInfoModalOpen(true);
        }
      }, Platform.OS === 'ios' ? 260 : 120);
    }
  }

  function handleToggleGroupAddMember(contactId: string) {
    setSelectedGroupAddMemberIds((currentIds) => {
      const nextIds = { ...currentIds };

      if (nextIds[contactId]) {
        delete nextIds[contactId];
      } else {
        nextIds[contactId] = true;
      }

      return nextIds;
    });
  }

  function handleRemoveGroupAddMember(contactId: string) {
    setSelectedGroupAddMemberIds((currentIds) => omitRecordKey(currentIds, contactId));
  }

  async function handleConfirmGroupAddMembers() {
    const chat = selectedChatRef.current;

    if (!chat || chat.chatType !== 'GROUP' || !selectedGroupAddMembers.length || isSavingGroupAddMembers) {
      return;
    }

    const unavailableMember = selectedGroupAddMembers.find((member) => !member.hasActiveDevice);

    if (unavailableMember) {
      Alert.alert(
        'Secure device needed',
        getRecipientDeviceNotReadyMessage(unavailableMember.displayName)
      );
      return;
    }

    setIsSavingGroupAddMembers(true);
    setError(null);

    try {
      const idToken = await getIdToken();

      await Promise.all(selectedGroupAddMembers.map((member) =>
        addContactToGroupChat({
          contactId: member.contactId,
          groupId: chat.contactId,
          idToken
        })
      ));

      const refreshedContacts = await loadChatContacts(false);
      await loadGroupSettings(false);

      const refreshedGroup = refreshedContacts.find((contact) =>
        contact.chatType === 'GROUP' &&
        contact.contactId === chat.contactId
      );

      if (refreshedGroup) {
        const refreshedChat = mapChatContactToChatItem(refreshedGroup);

        selectedChatRef.current = refreshedChat;
        setSelectedChat(refreshedChat);
      }

      setSelectedGroupAddMemberIds({});
      setIsGroupAddMembersModalOpen(false);

      setTimeout(() => {
        if (selectedChatRef.current?.contactId === chat.contactId) {
          setIsGroupInfoModalOpen(true);
        }
      }, Platform.OS === 'ios' ? 260 : 120);

      Alert.alert(
        'Members added',
        `${selectedGroupAddMembers.length === 1 ? selectedGroupAddMembers[0].displayName : `${selectedGroupAddMembers.length} members`} added to ${chat.title}.`
      );
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to add members to this group.'));
    } finally {
      setIsSavingGroupAddMembers(false);
    }
  }

  function handleOpenGroupMessageList(mode: MessageListModalMode) {
    const chat = selectedChatRef.current;

    if (chat?.chatType !== 'GROUP') {
      return;
    }

    setMessageListModalMode(null);
    setMessageListSearch('');
    setIsGroupInfoModalOpen(false);

    setTimeout(() => {
      if (selectedChatRef.current?.contactId === chat.contactId) {
        setMessageListModalMode(mode);
      }
    }, Platform.OS === 'ios' ? 320 : 140);
  }

  function handleCloseGroupMessageList() {
    const chat = selectedChatRef.current;

    setMessageListModalMode(null);
    setMessageListSearch('');

    if (chat?.chatType === 'GROUP') {
      setTimeout(() => {
        if (selectedChatRef.current?.contactId === chat.contactId) {
          setIsGroupInfoModalOpen(true);
        }
      }, Platform.OS === 'ios' ? 260 : 120);
    }
  }

  function handleOpenConversationSearch() {
    const chat = selectedChatRef.current;

    if (!chat) {
      return;
    }

    setIsContactInfoModalOpen(false);
    setIsGroupInfoModalOpen(false);
    setIsGroupCallOptionsOpen(false);
    setIsGroupCallPeopleModalOpen(false);
    setIsGroupAddMembersModalOpen(false);
    setIsGroupMembersModalOpen(false);
    setMessageListModalMode(null);
    setMessageListSearch('');
    setIsConversationSearchOpen(true);
  }

  function handleCloseConversationSearch() {
    setIsConversationSearchOpen(false);
  }

  function handleExitGroupChat() {
    const chat = selectedChatRef.current;

    if (!chat || chat.chatType !== 'GROUP' || !canExitGroupChat(chat) || isExitingGroupChat) {
      return;
    }

    Alert.alert(
      `Exit group "${chat.title}"?`,
      'You will stop receiving messages from this group. The encrypted group history remains available to the other members.',
      [
        {
          style: 'cancel',
          text: 'Cancel'
        },
        {
          onPress: () => {
            void confirmExitGroupChat(chat);
          },
          style: 'destructive',
          text: 'Exit group'
        }
      ]
    );
  }

  async function confirmExitGroupChat(chat: ChatItem) {
    if (isExitingGroupChat || chat.chatType !== 'GROUP') {
      return;
    }

    setIsExitingGroupChat(true);
    setError(null);

    try {
      const idToken = await getIdToken();
      await exitGroupChat({
        groupId: chat.contactId,
        idToken
      });

      setChatContacts((currentContacts) =>
        currentContacts.filter((contact) => contact.contactId !== chat.contactId)
      );
      setGroups((currentGroups) => currentGroups.filter((group) => group.groupId !== chat.contactId));
      setIsGroupInfoModalOpen(false);
      setIsConversationSearchOpen(false);

      if (selectedChatRef.current?.contactId === chat.contactId) {
        selectedChatRef.current = null;
        setSelectedChat(null);
        setMessages([]);
        setMessageDraft('');
        setReplyTarget(null);
        resetCachedMessagePaging();
      }

      void loadChatContacts(false);
      void loadGroupSettings(false);
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to exit this group.'));
    } finally {
      setIsExitingGroupChat(false);
    }
  }




  function handleOpenCommonGroupFromContactInfo(groupContact: ChatContact) {
    setIsContactInfoModalOpen(false);
    void handleOpenChat(mapChatContactToChatItem(groupContact));
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

    const selectedMemberUids = activeGroupMemberContacts
      .filter((contact) => selectedGroupCallMemberIds[contact.contactId])
      .map((contact) => contact.contactId);

    setIsGroupCallPeopleModalOpen(false);
    setGroupCallPeopleSearch('');
    setSelectedGroupCallMemberIds({});

    if (groupCallMode === 'voice' || groupCallMode === 'video') {
      void handleStartGroupCall(groupCallMode, selectedMemberUids);
      return;
    }

    Alert.alert(
      'People selected',
      `${selectedMemberUids.length} ${selectedMemberUids.length === 1 ? 'person' : 'people'} selected for this group call.`
    );
  }

  function handleReturnToNewChatModal() {
    setIsAddMembersModalOpen(false);
    resetNewGroupDraft();

    if (newGroupFlowOrigin === 'contactInfo') {
      const chat = selectedChatRef.current;

      if (chat && chat.chatType !== 'GROUP') {
        setIsContactInfoModalOpen(true);
      }

      return;
    }

    if (newGroupFlowOrigin === 'groupSwitcher') {
      setIsGroupSwitcherModalOpen(true);
      void loadGroupSettings(false);
      return;
    }

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

  async function handleChangeGroupPhoto() {
    const chat = selectedChatRef.current;

    if (!chat || chat.chatType !== 'GROUP' || isUpdatingGroupPhoto) {
      return;
    }

    if (!canCurrentUserChangeGroupPhoto(chat, userProfile)) {
      Alert.alert(
        'Group photo',
        'Only organization admins and the department admin can change a department group photo.'
      );
      return;
    }

    try {
      const pickedPhoto = await pickNativeProfilePhoto({
        message: 'Change this group photo using your camera or photo library.',
        title: 'Group photo'
      });

      if (!pickedPhoto) {
        return;
      }

      if (!pickedPhoto.dataUrl) {
        throw new Error('Unable to prepare this group photo. Please choose another image.');
      }

      setIsUpdatingGroupPhoto(true);
      const idToken = await getIdToken();
      const updatedContact = await updateGroupChatPhoto({
        groupId: chat.contactId,
        idToken,
        profilePhotoDataUrl: pickedPhoto.dataUrl
      });
      const cachedContact = await cacheChatContactPhoto(updatedContact, idToken);

      setProfilePhotoAuthToken(idToken);
      applyVisibleChatContactUpdate(cachedContact, true);
    } catch (nextError) {
      Alert.alert('Group photo', getErrorMessage(nextError, 'Unable to update this group photo.'));
    } finally {
      setIsUpdatingGroupPhoto(false);
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

  async function hydrateChatFromPushNotification(data: ChatPushNotificationData) {
    if (!data.contactId || activePushHydrationContactIdsRef.current.has(data.contactId)) {
      return;
    }

    activePushHydrationContactIdsRef.current.add(data.contactId);

    try {
      const chatType = data.chatType || getChatTypeForContactId(data.contactId);
      const idToken = await getIdToken();
      const result = await getChatMessages({
        chatType,
        contactId: data.contactId,
        currentUid,
        idToken,
        // This runs when a push arrives, for a chat the user has not opened. It
        // exists to warm the offline cache, so it must not mark the
        // conversation read - that was clearing the unread badge on its own,
        // moments after the message landed.
        markRead: false
      });
      const cachedContact = await cacheChatContactPhoto(result.contact, idToken);
      const [cachedConversation, pendingMessages] = await Promise.all([
        loadCachedChatConversation({
          contactId: data.contactId,
          ...getLocalChatScope()
        }).catch(() => null),
        listPendingChatMessages({
          contactId: data.contactId,
          ...getLocalChatScope()
        }).catch(() => [])
      ]);
      const serverMessages = applyReactionMapToMessages(
        uniqueChatMessages(result.messages),
        result.messageReactions
      );
      const mergedMessages = uniqueChatMessages([
        ...(cachedConversation?.messages || []),
        ...serverMessages
      ]);
      const visiblePersistedMessages = await filterHiddenMessagesForChat(data.contactId, mergedMessages);
      const nextMessages = uniqueChatMessages([
        ...visiblePersistedMessages,
        ...pendingMessages.map((pendingMessage) => pendingMessage.message)
      ]);
      const isActiveChat = selectedChatRef.current?.contactId === data.contactId &&
        !activeTrashSegmentIdRef.current;
      const contactWithLocalPreview = applyLocalChatPreview(
        isActiveChat ? { ...cachedContact, unreadCount: 0 } : cachedContact,
        nextMessages
      );

      setProfilePhotoAuthToken(idToken);
      setChatContacts((currentContacts) => upsertChatContact(currentContacts, contactWithLocalPreview));

      if (isActiveChat) {
        setMessageReactions(result.messageReactions);
        setMessages(nextMessages);
        setSelectedChat(mapChatContactToChatItem(contactWithLocalPreview));
      }

      await saveCachedChatConversation({
        contact: contactWithLocalPreview,
        contactId: data.contactId,
        messages: visiblePersistedMessages,
        ...getLocalChatScope()
      });
      await persistLocalChatSyncStateForMessages(data.contactId, visiblePersistedMessages);
      queueEncryptedChatBackup();
      queueMediaDownloadsForMessages(data.contactId, nextMessages, chatType, true);
      void syncPendingMessagesForChat(data.contactId);
    } catch {
      void loadChatContacts(false);
    } finally {
      activePushHydrationContactIdsRef.current.delete(data.contactId);
    }
  }

  function isActiveChatOpenRequest(openRequestId: number | undefined, contactId: string): boolean {
    return openRequestId === undefined ||
      (chatOpenRequestIdRef.current === openRequestId && selectedChatRef.current?.contactId === contactId);
  }

  function resetCachedMessagePaging() {
    oldestCachedMessageSentAtMsRef.current = null;
    hasMoreCachedMessagesBeforeRef.current = false;
    isLoadingOlderCachedMessagesRef.current = false;
    setIsLoadingOlderCachedMessages(false);
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
      ...getLocalChatScope()
    }).catch(() => []);

    if (!hiddenMessageIds.length) {
      return messages;
    }

    const hiddenMessageIdSet = new Set(hiddenMessageIds);

    return messages.filter((message) => !hiddenMessageIdSet.has(message.messageId));
  }

  async function persistLocalChatSyncStateForMessages(
    contactId: string,
    nextMessages: ChatMessage[],
    options: { hasMoreBefore?: boolean } = {}
  ) {
    if (!nextMessages.length) {
      return;
    }

    await saveLocalChatSyncState({
      contactId,
      hasMoreBefore: options.hasMoreBefore,
      latestServerSentAtMs: getLatestMessageSentAtMs(nextMessages),
      oldestLocalSentAtMs: getOldestMessageSentAtMs(nextMessages),
      ...getLocalChatScope()
    }).catch(() => undefined);
  }

  async function hydrateMessagesWithCachedMediaRows(
    contactId: string,
    nextMessages: ChatMessage[]
  ): Promise<ChatMessage[]> {
    const messageIds = nextMessages
      .map((message) => message.messageId)
      .filter((messageId) => messageId && !messageId.startsWith('queued_'));

    if (!messageIds.length) {
      return nextMessages;
    }

    const mediaRecordsByMessageId = await listCachedChatMediaForMessages({
      contactId,
      messageIds,
      ...getLocalChatScope()
    }).catch(() => ({} as Record<string, LocalCachedChatMediaRecord[]>));

    if (!Object.keys(mediaRecordsByMessageId).length) {
      return nextMessages;
    }

    return nextMessages.map((message) => {
      const mediaRecords = mediaRecordsByMessageId[message.messageId];

      if (!mediaRecords?.length) {
        return message;
      }

      return applyCachedMediaRecordsToMessage(message, mediaRecords);
    });
  }

  async function loadCachedMessagesForChat(chat: ChatItem, openRequestId?: number) {
    try {
      const cacheLoadStartedAt = Date.now();
      const [cachedConversationPage, pendingMessages] = await Promise.all([
        loadCachedChatConversationPage({
          contactId: chat.contactId,
          ...getLocalChatScope()
        }),
        listPendingChatMessages({
          contactId: chat.contactId,
          ...getLocalChatScope()
        })
      ]);
      const cacheLoadDurationMs = Date.now() - cacheLoadStartedAt;
      void recordChatOfflineTimingMetric(
        getLocalChatScope(),
        'chatOpenCacheLoadMs',
        cacheLoadDurationMs
      ).then(setChatOfflineMetrics).catch(() => undefined);
      void recordChatOfflineTimingMetric(
        getLocalChatScope(),
        'sqliteQueryMs',
        cacheLoadDurationMs
      ).catch(() => undefined);
      const nextMessages = await hydrateMessagesWithCachedMediaRows(chat.contactId, uniqueChatMessages([
        ...(cachedConversationPage?.messages || []),
        ...pendingMessages.map((pendingMessage) => pendingMessage.message)
      ]));

      if (!isActiveChatOpenRequest(openRequestId, chat.contactId)) {
        return;
      }

      oldestCachedMessageSentAtMsRef.current = cachedConversationPage?.oldestMessageSentAtMs || null;
      hasMoreCachedMessagesBeforeRef.current = cachedConversationPage?.hasMoreBefore === true;

      if (cachedConversationPage?.contact) {
        setSelectedChat(mapChatContactToChatItem({
          ...cachedConversationPage.contact,
          unreadCount: 0
        }));
      }

      if (nextMessages.length) {
        setMessageReactions(extractReactionMapFromMessages(nextMessages));
        setMessages(nextMessages);
        queueMediaDownloadsForMessages(chat.contactId, nextMessages, chat.chatType, true);
      }
    } catch {
      // Local cache should never block opening a live chat.
    }
  }

  async function loadOlderCachedMessagesForActiveChat(): Promise<void> {
    const activeChat = selectedChatRef.current;
    const beforeSentAtMs = oldestCachedMessageSentAtMsRef.current;

    if (
      !activeChat ||
      activeTrashSegmentIdRef.current ||
      !hasMoreCachedMessagesBeforeRef.current ||
      beforeSentAtMs === null ||
      isLoadingOlderCachedMessagesRef.current
    ) {
      return;
    }

    isLoadingOlderCachedMessagesRef.current = true;
    setIsLoadingOlderCachedMessages(true);

    try {
      const cachedConversationPage = await loadCachedChatConversationPage({
        beforeSentAtMs,
        contactId: activeChat.contactId,
        ...getLocalChatScope()
      });

      if (selectedChatRef.current?.contactId !== activeChat.contactId || activeTrashSegmentIdRef.current) {
        return;
      }

      const olderMessages = await hydrateMessagesWithCachedMediaRows(
        activeChat.contactId,
        cachedConversationPage?.messages || []
      );

      hasMoreCachedMessagesBeforeRef.current = cachedConversationPage?.hasMoreBefore === true;
      oldestCachedMessageSentAtMsRef.current = cachedConversationPage?.oldestMessageSentAtMs || beforeSentAtMs;

      if (!olderMessages.length) {
        return;
      }

      setMessages((currentMessages) => uniqueChatMessages([
        ...olderMessages,
        ...currentMessages
      ]));
    } catch {
      // Older local pages should never interrupt the active chat.
    } finally {
      isLoadingOlderCachedMessagesRef.current = false;
      setIsLoadingOlderCachedMessages(false);
    }
  }

  async function loadMessagesForChat(
    chat: ChatItem,
    showError = true,
    openRequestId?: number,
    trashSegmentId?: string | null,
    isTrashReadOnly = false
  ) {
    const isTrashRead = isTrashReadOnly || Boolean(trashSegmentId);

    setIsLoadingMessages(true);

    try {
      const idToken = await getIdToken();
      const localScope = getLocalChatScope();
      const localSyncState = isTrashRead
        ? null
        : await loadLocalChatSyncState({
            contactId: chat.contactId,
            ...localScope
          }).catch(() => null);
      const result = await getChatMessages({
        afterSentAtMs: isTrashRead ? null : localSyncState?.latestServerSentAtMs || null,
        chatType: chat.chatType,
        contactId: chat.contactId,
        currentUid,
        idToken,
        limit: !isTrashRead && localSyncState?.latestServerSentAtMs ? 100 : undefined,
        trashSegmentId: trashSegmentId || null
      });
      const cachedContact = await cacheChatContactPhoto(result.contact, idToken);
      const [cachedConversation, pendingMessages] = isTrashRead
        ? [null, [] as Awaited<ReturnType<typeof listPendingChatMessages>>]
        : await Promise.all([
            loadCachedChatConversation({
              contactId: chat.contactId,
              ...localScope
            }).catch(() => null),
            listPendingChatMessages({
              contactId: chat.contactId,
              ...localScope
            })
          ]);
      const serverMessages = applyReactionMapToMessages(uniqueChatMessages(result.messages), result.messageReactions);
      const persistedMessages = isTrashRead
        ? serverMessages
        : applyReactionMapToMessages(uniqueChatMessages([
            ...(cachedConversation?.messages || []),
            ...serverMessages
          ]), result.messageReactions);
      const visiblePersistedMessages = isTrashRead
        ? persistedMessages
        : await filterHiddenMessagesForChat(chat.contactId, persistedMessages);
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
      oldestCachedMessageSentAtMsRef.current = nextMessages.length
        ? getChatMessageSentAtMs(nextMessages[0])
        : null;
      hasMoreCachedMessagesBeforeRef.current = false;
      if (!isTrashRead) {
        setChatContacts((currentContacts) => upsertChatContact(currentContacts, {
          ...contactWithLocalPreview,
          unreadCount: 0
        }));
        await saveCachedChatConversation({
          contact: contactWithLocalPreview,
          contactId: chat.contactId,
          messages: visiblePersistedMessages,
          ...localScope
        });
        await persistLocalChatSyncStateForMessages(chat.contactId, visiblePersistedMessages, {
          hasMoreBefore: hasMoreCachedMessagesBeforeRef.current
        }).catch(() => undefined);
        queueEncryptedChatBackup();
        queueMediaDownloadsForMessages(chat.contactId, nextMessages, chat.chatType, true);
        void syncPendingMessagesForChat(chat.contactId);
      }

      // Cleared for every chat and refilled only for a direct one, so opening a
      // group never shows the banner belonging to the conversation before it.
      setScheduledMessages([]);

      if (chat.chatType !== 'GROUP' && !isTrashRead) {
        void refreshScheduledMessages(chat.contactId);
      }
	    } catch (nextError) {
	      const isActiveRequest = isActiveChatOpenRequest(openRequestId, chat.contactId);

	      if (isCompanyAccessDeniedError(nextError)) {
	        onSessionInvalid(ACCESS_DENIED_MESSAGE);
	        return;
	      }

	      if (isActiveRequest && isChatUnavailableForCurrentUserError(nextError)) {
        removeUnavailableChatFromList(chat);
        setIsLoadingMessages(false);
        return;
      }

      if (showError && isActiveRequest && !isNetworkUnavailableError(nextError)) {
        setError(getErrorMessage(nextError, 'Unable to open chat.'));
      }
    } finally {
      if (isActiveChatOpenRequest(openRequestId, chat.contactId)) {
        setIsLoadingMessages(false);
      }
    }
  }

  async function syncPendingMessagesForChat(contactId: string) {
    if (locallyDeletedChatContactIdsRef.current.has(contactId)) {
      return;
    }

    if (pendingSyncContactIdsRef.current.has(contactId)) {
      return;
    }

    pendingSyncContactIdsRef.current.add(contactId);

    try {
      const pendingMessages = await listPendingChatMessages({
        contactId,
        ...getLocalChatScope()
      });
      const syncablePendingMessages = pendingMessages.filter((pendingMessage) =>
        pendingMessage.status !== 'failed' &&
        !activeLocalSendQueueIdsRef.current.has(pendingMessage.queueId)
      );

      if (!syncablePendingMessages.length) {
        return;
      }

      // Text goes first, and a large upload never holds it up.
      //
      // This loop sends strictly in order and awaits each media upload, so a
      // 146 MB video at the head of the queue left every message typed after it
      // sitting on "queued" for minutes. A message with no attachment has
      // nothing to wait for.
      const orderedPendingMessages = [
        ...syncablePendingMessages.filter((pendingMessage) => !hasPendingMedia(pendingMessage)),
        ...syncablePendingMessages.filter(hasPendingMedia)
      ];

      const idToken = await getIdToken();

      for (const pendingMessage of orderedPendingMessages) {
        if (locallyDeletedChatContactIdsRef.current.has(contactId)) {
          return;
        }

        await updatePendingChatMessage({
          lastError: null,
          ...getLocalChatScope(),
          queueId: pendingMessage.queueId,
          status: 'sending'
        });

        try {
          const latestPendingMessage = await getLatestPendingMessageForSend(pendingMessage);
          const pendingMedia = getMessageMedia(latestPendingMessage.message);
          const pendingMediaItems = getMessageMediaItems(latestPendingMessage.message);
          const sendMediaItems = pendingMediaItems.length > 1
            ? await uploadMediaItemsForMessage({
                chatType: latestPendingMessage.chatType || 'DIRECT',
                contactId,
                idToken,
                mediaItems: pendingMediaItems,
                messageId: latestPendingMessage.queueId
              })
            : [];
          const sendMedia = pendingMedia && !sendMediaItems.length
            ? await uploadMediaForMessage({
                chatType: latestPendingMessage.chatType || 'DIRECT',
                contactId,
                idToken,
                media: pendingMedia,
                messageId: latestPendingMessage.queueId
              })
            : null;
          const result = await sendChatMessage({
            chatType: latestPendingMessage.chatType || 'DIRECT',
            clientMessageId: latestPendingMessage.queueId,
            contactId,
            currentUid,
            idToken,
            media: sendMedia,
            mediaItems: sendMediaItems,
            replyTo: latestPendingMessage.message.replyTo || null,
            text: latestPendingMessage.text
          });
          // Flip the bubble first; the durable work follows.
          markVisibleMessageSent(contactId, pendingMessage.queueId, result.message);

          const cachedContact = await cacheChatContactPhoto(result.contact, idToken);

          setProfilePhotoAuthToken(idToken);

          // Commit the sent message into visible state and the conversation
          // cache BEFORE dropping the outbox record. Queued messages are not
          // persisted in the conversation cache, so the outbox is an in-flight
          // bubble's only home. Removing it first opens a window where a
          // concurrent thread refresh rebuilds the list from cache + outbox and
          // finds the message in neither, which blanks the bubble until the
          // commit lands and puts it back.
          if (!locallyDeletedChatContactIdsRef.current.has(contactId)) {
            await updateSyncedPendingMessage({
              contact: cachedContact,
              contactId,
              pendingQueueId: pendingMessage.queueId,
              sentMessage: result.message
            }).catch(() => undefined);
          }

          // Unconditional: a failed commit must never strand the record and
          // cause the message to be sent again.
          await removePendingChatMessage({
            ...getLocalChatScope(),
            queueId: pendingMessage.queueId
          });

          if (locallyDeletedChatContactIdsRef.current.has(contactId)) {
            return;
          }
        } catch (syncError) {
          const isRetryableNetworkFailure = isNetworkUnavailableError(syncError);
          const failedMessage = isRetryableNetworkFailure
            ? pendingMessage.message
            : markChatMessageSendFailed(pendingMessage.message);

          await updatePendingChatMessage({
            lastError: getErrorMessage(syncError, 'Unable to sync queued message.'),
            message: failedMessage,
            ...getLocalChatScope(),
            queueId: pendingMessage.queueId,
            status: isRetryableNetworkFailure ? 'pending' : 'failed'
          });
        }
      }
    } finally {
      pendingSyncContactIdsRef.current.delete(contactId);
    }
  }


  async function syncAllPendingMessages() {
    const pendingMessages = await listPendingChatMessages({
      ...getLocalChatScope()
    }).catch(() => []);
    const contactIds = Array.from(new Set(pendingMessages.map((pendingMessage) => pendingMessage.contactId)));

    contactIds.forEach((contactId) => {
      void syncPendingMessagesForChat(contactId);
    });
  }

  async function getLatestPendingMessageForSend(
    pendingMessage: PendingChatMessage
  ): Promise<PendingChatMessage> {
    const latestPendingMessages = await listPendingChatMessages({
      contactId: pendingMessage.contactId,
      ...getLocalChatScope()
    }).catch(() => []);

    return latestPendingMessages.find((latestMessage) => latestMessage.queueId === pendingMessage.queueId) ||
      pendingMessage;
  }

  /**
   * Shows a message as sent the moment the server accepts it.
   *
   * Everything after the acknowledgement — caching the contact photo, loading
   * the conversation, re-encrypting and rewriting it — used to run before the
   * bubble changed. On a long thread that is seconds of work the user spends
   * staring at "Queued" for a message the server already has.
   *
   * This reconciles from memory only, so it costs nothing. The durable write
   * still happens, just no longer in front of the user.
   */
  function markVisibleMessageSent(
    contactId: string,
    pendingQueueId: string,
    sentMessage: ChatMessage
  ) {
    if (selectedChatRef.current?.contactId !== contactId) {
      return;
    }

    const pendingLocalMessage = messagesRef.current.find(
      (message) => getChatMessageIdentityKey(message) === pendingQueueId
    ) || null;
    const visibleSentMessage: ChatMessage = {
      ...mergeSyncedMessageWithPendingLocalMedia(sentMessage, pendingLocalMessage),
      clientMessageId: sentMessage.clientMessageId || pendingQueueId
    };

    upsertChatMessages(contactId, [visibleSentMessage]);
  }

  async function updateSyncedPendingMessage(input: {
    contact: ChatContact;
    contactId: string;
    pendingQueueId: string;
    sentMessage: ChatMessage;
  }) {
    if (locallyDeletedChatContactIdsRef.current.has(input.contactId)) {
      return;
    }

    const cachedConversation = await loadCachedChatConversation({
      contactId: input.contactId,
      ...getLocalChatScope()
    }).catch(() => null);
    const { messagesToPersist: persistedSentMessages, nextCachedMessages, sentMessage } =
      reconcileSyncedPendingMessage({
        cachedMessages: cachedConversation?.messages || [],
        pendingQueueId: input.pendingQueueId,
        sentMessage: input.sentMessage,
        visibleMessages: messagesRef.current
      });
    const contactWithLocalPreview = applyLocalChatPreview(input.contact, nextCachedMessages);

    await saveCachedChatConversation({
      contact: contactWithLocalPreview,
      contactId: input.contactId,
      messages: persistedSentMessages,
      ...getLocalChatScope()
    });
    await persistLocalChatSyncStateForMessages(input.contactId, persistedSentMessages);
    queueEncryptedChatBackup();

    if (selectedChatRef.current?.contactId === input.contactId) {
      upsertChatMessages(input.contactId, [sentMessage]);
      setSelectedChat(mapChatContactToChatItem(contactWithLocalPreview));
    }

    setChatContacts((currentContacts) => upsertChatContact(currentContacts, contactWithLocalPreview));
  }

  function addVisibleLocalMessage(chat: ChatItem, message: ChatMessage) {
    const contactId = chat.contactId;

    locallyDeletedChatContactIdsRef.current.delete(contactId);

    if (selectedChatRef.current?.contactId === contactId) {
      upsertChatMessages(contactId, [message]);
      setSelectedChat((currentChat) => currentChat?.contactId === contactId
        ? {
            ...currentChat,
            lastMessageAt: message.sentAt,
            preview: getChatMessagePreview(message)
          }
        : currentChat);
    }

    setChatContacts((currentContacts) => {
      const contact = currentContacts.find((currentContact) => currentContact.contactId === contactId) ||
        mapChatItemToChatContact(chat);

      return upsertChatContact(currentContacts, applyLocalChatPreview(contact, [message]));
    });
  }

  function replaceVisibleLocalMessage(chat: ChatItem, messageId: string, replacement: ChatMessage) {
    const contactId = chat.contactId;

    if (selectedChatRef.current?.contactId === contactId) {
      updateChatMessage(contactId, messageId, () => replacement);
      setSelectedChat((currentChat) => currentChat?.contactId === contactId
        ? {
            ...currentChat,
            lastMessageAt: replacement.sentAt,
            preview: getChatMessagePreview(replacement)
          }
        : currentChat);
    }

    setChatContacts((currentContacts) => {
      const contact = currentContacts.find((currentContact) => currentContact.contactId === contactId) ||
        mapChatItemToChatContact(chat);

      return upsertChatContact(currentContacts, applyLocalChatPreview(contact, [replacement]));
    });
  }

  function removeVisibleLocalMessage(contactId: string, messageId: string) {
    if (selectedChatRef.current?.contactId === contactId) {
      removeChatMessage(contactId, messageId);
    }
  }

  function updateVisibleMessageMedia(
    contactId: string,
    messageId: string,
    media: ChatMediaAttachment,
    mediaIndex?: number
  ) {
    if (selectedChatRef.current?.contactId === contactId) {
      // Targets one message instead of rebuilding the list. During a transfer
      // this is the most frequent write in the app.
      applyChatMessageMedia(contactId, messageId, media, mediaIndex);
      setMediaViewer((currentViewer) =>
        currentViewer?.sourceMessage.messageId === messageId
          ? {
              ...currentViewer,
              items: currentViewer.items.map((viewerMedia, index) => {
                const isTargetIndex = typeof mediaIndex === 'number' ? index === mediaIndex : false;
                const isTargetMedia = Boolean(media.mediaId && viewerMedia.mediaId === media.mediaId) ||
                  Boolean(media.localUri && viewerMedia.localUri === media.localUri) ||
                  (!media.mediaId && media.fileName === viewerMedia.fileName && media.kind === viewerMedia.kind);

                return isTargetIndex || isTargetMedia ? mergeChatMessageMedia(viewerMedia, media) || media : viewerMedia;
              }),
              sourceMessage: applyMediaUpdateToMessage(currentViewer.sourceMessage, media, mediaIndex)
            }
          : currentViewer
      );
    }
  }

  async function persistLocalMediaTransferState(input: {
    contactId: string;
    lastError?: string | null;
    media: ChatMediaAttachment;
    mediaIndex?: number;
    messageId: string;
    nativeTransferId?: string | null;
    progress: number;
    status: NonNullable<ChatMediaAttachment['transferStatus']>;
    transferType: 'download' | 'upload';
    uploadRecovery?: ChatMediaUploadRecoveryState | null;
  }): Promise<void> {
    const scope = getLocalChatScope();
    await upsertLocalChatMediaTransferQueueItem({
      attempts: input.status === 'failed' ? 1 : 0,
      contactId: input.contactId,
      lastError: input.lastError || null,
      media: {
        ...input.media,
        transferProgress: input.progress,
        transferStatus: input.status
      },
      mediaIndex: input.mediaIndex,
      messageId: input.messageId,
      nativeTransferId: input.nativeTransferId,
      nextRetryAtMs: input.status === 'failed' ? Date.now() + 30_000 : null,
      progress: input.progress,
      status: input.status,
      transferType: input.transferType,
      uploadRecovery: input.uploadRecovery,
      ...scope
    }).catch(() => undefined);

    if (input.status === 'failed') {
      void incrementChatOfflineCounterMetric(
        scope,
        input.transferType === 'upload' ? 'uploadFailureCount' : 'downloadFailureCount'
      ).then(setChatOfflineMetrics).catch(() => undefined);
    } else if (input.status === 'available') {
      void incrementChatOfflineCounterMetric(
        scope,
        input.transferType === 'upload' ? 'uploadSuccessCount' : 'downloadSuccessCount'
      ).then(setChatOfflineMetrics).catch(() => undefined);
      void recordChatOfflineMediaTransferMetric(scope, {
        sizeBytes: input.media.sizeBytes,
        transferType: input.transferType
      }).then(setChatOfflineMetrics).catch(() => undefined);
    }

    void Promise.all([
      listLocalChatMediaTransferQueue(scope).catch(() => []),
      getChatMediaCacheSizeBytes().catch(() => 0)
    ])
      .then(([queueItems, cacheSizeBytes]) => updateChatOfflineGaugeMetrics(scope, {
        cacheSizeBytes,
        mediaQueueDepth: queueItems.length
      }))
      .then(setChatOfflineMetrics)
      .catch(() => undefined);
  }

  async function cancelLocalMediaTransfersForMessage(input: {
    contactId: string;
    messageId: string;
  }): Promise<void> {
    const scope = getLocalChatScope();
    const transfers = await listLocalChatMediaTransferQueue({
      contactId: input.contactId,
      ...scope,
      limit: 200
    }).catch(() => []);
    const matchingTransfers = transfers.filter((transfer) => transfer.messageId === input.messageId);

    await Promise.all(matchingTransfers.map(async (transfer) => {
      const transferIds = Array.from(new Set([
        transfer.nativeTransferId,
        ...(transfer.uploadRecovery?.partNativeTransferIds || [])
      ].filter((transferId): transferId is string => Boolean(transferId))));

      await Promise.all(transferIds.map((transferId) =>
        cancelNativeBackgroundTransfer(transferId).catch(() => false)
      ));
      await removeLocalChatMediaTransferQueueItem({
        ownerUid: scope.ownerUid,
        queueId: transfer.queueId,
        tenantId: scope.tenantId
      }).catch(() => undefined);
    }));
  }

  async function prepareNativeChatMediaAttachmentForUpload(input: {
    chatType: 'DIRECT' | 'GROUP';
    contactId: string;
    media: ChatMediaAttachment;
    mediaIndex?: number;
    messageId: string;
  }): Promise<ChatMediaAttachment> {
    const media = input.media;
    const preparingMedia: ChatMediaAttachment = {
      ...media,
      transferProgress: media.transferProgress || 0,
      transferStatus: 'preparing'
    };

    // Published for every attachment, camera recordings included. This is what
    // puts the ring on the bubble, and a video sitting there with no ring while
    // it compresses reads as stuck rather than busy. It used to be skipped for
    // exactly the one kind whose preparation is long enough to notice, because
    // the early return below came first.
    publishMediaTransferProgress(
      buildMediaTransferProgressKey(input.messageId, input.mediaIndex),
      { progress: preparingMedia.transferProgress || 0, status: 'preparing' }
    );
    updateVisibleMessageMedia(input.contactId, input.messageId, preparingMedia, input.mediaIndex);
    await persistMessageMediaUpdate(input.contactId, input.messageId, preparingMedia, input.mediaIndex);

    if (!media.nativeAssetIdentifier) {
      // Only the library picker supplies that identifier, so nothing recorded
      // on the camera enters the preparation queue below. Its poster is taken
      // when the attachment is built, but a video queued by an older build, or
      // one whose frame could not be read then, is finished off here: still
      // before encryption and upload, which is the last moment a poster can
      // reach the other side.
      return attachChatMediaPoster(media);
    }

    return prepareChatMediaAttachmentThroughQueue({
      chatType: input.chatType,
      contactId: input.contactId,
      media,
      mediaIndex: input.mediaIndex,
      messageId: input.messageId,
      onPreparedMediaUpdated: (posterMedia) => {
        updateVisibleMessageMedia(input.contactId, input.messageId, posterMedia, input.mediaIndex);
        void persistMessageMediaUpdate(input.contactId, input.messageId, posterMedia, input.mediaIndex);
      },
      // Export and compression report progress many times a second. The ring
      // already receives those through the transfer store, so neither a
      // thread-wide re-render nor a database write belongs on this path —
      // both were running per event and starving the UI during preparation.
      onProgress: () => undefined,
      ...getLocalChatScope()
    });
  }

  async function uploadMediaForMessage(input: {
    chatType: 'DIRECT' | 'GROUP';
    contactId: string;
    idToken: string;
    media: ChatMediaAttachment;
    mediaIndex?: number;
    messageId: string;
  }): Promise<ChatMediaAttachment> {
    const hasUploadedSinglePartMedia = input.media.encryptionMode !== 'chunked-secretbox-v1' &&
      input.media.encryptionMode !== 'native-chacha20poly1305-chunked-v1' &&
      Boolean(input.media.mediaId && input.media.key && input.media.nonce);
    const hasUploadedChunkedMedia = input.media.encryptionMode === 'chunked-secretbox-v1' &&
      Boolean(input.media.mediaId && input.media.key && input.media.chunkSizeBytes && input.media.partCount) &&
      Array.isArray(input.media.partNonces) &&
      input.media.partNonces.length === input.media.partCount;
    const hasUploadedNativeAeadMedia = input.media.encryptionMode === 'native-chacha20poly1305-chunked-v1' &&
      Boolean(input.media.mediaId && input.media.key && input.media.chunkSizeBytes && input.media.partCount) &&
      Array.isArray(input.media.partNonces) &&
      input.media.partNonces.length === input.media.partCount;

    if (hasUploadedSinglePartMedia || hasUploadedChunkedMedia || hasUploadedNativeAeadMedia) {
      return {
        ...input.media,
        transferProgress: 1,
        transferStatus: 'available'
      };
    }

    const preparedMedia = await prepareNativeChatMediaAttachmentForUpload(input);
    const localMedia = toLocalChatMediaInput(preparedMedia);
    let lastProgressUpdateAt = 0;
    let lastProgressValue = -1;
    // Recovery state is for surviving a crash, so once every second and a half
    // is plenty. Writing it per chunk is what starved the UI.
    let lastRecoveryPersistAt = 0;
    let nativeTransferId: string | null = null;
    let nativeTransferIds: string[] = [];
    let uploadRecovery: ChatMediaUploadRecoveryState | null = null;
    let recoverableMedia: ChatMediaAttachment = preparedMedia;

    // A new poster counts as much as a new file here. Without it the sender's
    // own bubble stays empty until the thread is reloaded.
    if (
      preparedMedia.localUri !== input.media.localUri ||
      preparedMedia.thumbnailDataUrl !== input.media.thumbnailDataUrl
    ) {
      updateVisibleMessageMedia(input.contactId, input.messageId, preparedMedia, input.mediaIndex);
      await persistMessageMediaUpdate(input.contactId, input.messageId, preparedMedia, input.mediaIndex);
    }

    await persistLocalMediaTransferState({
      contactId: input.contactId,
      media: preparedMedia,
      mediaIndex: input.mediaIndex,
      messageId: input.messageId,
      progress: 0,
      status: 'uploading',
      transferType: 'upload'
    });

    try {
      const uploadedMedia = await uploadEncryptedChatMedia({
        chatType: input.chatType,
        contactId: input.contactId,
        idToken: input.idToken,
        media: localMedia,
        onNativeTransferStarted: (transferId) => {
          nativeTransferId = transferId;
          nativeTransferIds = nativeTransferIds.includes(transferId)
            ? nativeTransferIds
            : [...nativeTransferIds, transferId];
          void persistLocalMediaTransferState({
            contactId: input.contactId,
            media: recoverableMedia,
            mediaIndex: input.mediaIndex,
            messageId: input.messageId,
            nativeTransferId: transferId,
            progress: Math.max(lastProgressValue, 0),
            status: 'uploading',
            transferType: 'upload',
              uploadRecovery: uploadRecovery
                ? {
                    ...uploadRecovery,
                  partNativeTransferIds: nativeTransferIds,
                  uploadedPartIndexes: uploadRecovery.uploadedPartIndexes
                  }
                : uploadRecovery
          });
        },
        onNativeTransferIdsUpdated: (transferIds) => {
          nativeTransferIds = transferIds;
          nativeTransferId = transferIds[0] || nativeTransferId;
          uploadRecovery = uploadRecovery
            ? {
                ...uploadRecovery,
                partNativeTransferIds: transferIds,
                uploadedPartIndexes: uploadRecovery.uploadedPartIndexes
              }
            : uploadRecovery;

          // Also once per part. Same throttle, same reason.
          const now = Date.now();

          if (now - lastRecoveryPersistAt < 1500) {
            return;
          }

          lastRecoveryPersistAt = now;
          void persistLocalMediaTransferState({
            contactId: input.contactId,
            media: recoverableMedia,
            mediaIndex: input.mediaIndex,
            messageId: input.messageId,
            nativeTransferId,
            progress: Math.max(lastProgressValue, 0),
            status: 'uploading',
            transferType: 'upload',
            uploadRecovery
          });
        },
        onProgress: (progress) => {
          const now = Date.now();

          // The ring reads from the progress store, which re-renders one small
          // component instead of the whole thread. Publishing often is what
          // makes the arc move smoothly, and it is cheap.
          publishMediaTransferProgress(
            buildMediaTransferProgressKey(input.messageId, input.mediaIndex),
            { progress, status: 'uploading' }
          );

          // Persisting and touching the message list are the expensive halves,
          // so they stay throttled. They exist for crash recovery and for the
          // bubble's own state, neither of which needs every percent.
          if (
            progress < 1 &&
            now - lastProgressUpdateAt < 400 &&
            Math.abs(progress - lastProgressValue) < 0.1
          ) {
            return;
          }

          lastProgressUpdateAt = now;
          lastProgressValue = progress;
          const uploadingMedia: ChatMediaAttachment = {
            ...recoverableMedia,
            transferProgress: progress,
            transferStatus: 'uploading'
          };

          updateVisibleMessageMedia(input.contactId, input.messageId, uploadingMedia, input.mediaIndex);
          void persistLocalMediaTransferState({
            contactId: input.contactId,
            media: uploadingMedia,
            mediaIndex: input.mediaIndex,
            messageId: input.messageId,
            nativeTransferId,
            progress,
            status: 'uploading',
            transferType: 'upload',
            uploadRecovery: uploadRecovery
              ? {
                  ...uploadRecovery,
                  partNativeTransferIds: nativeTransferIds.length
                    ? nativeTransferIds
                    : uploadRecovery.partNativeTransferIds,
                  uploadedPartIndexes: uploadRecovery.uploadedPartIndexes
                }
              : uploadRecovery
          });
        },
        onUploadRecoveryState: (state) => {
          uploadRecovery = {
            ...state,
            partNativeTransferIds: nativeTransferIds.length
              ? nativeTransferIds
              : state.partNativeTransferIds,
            uploadedPartIndexes: state.uploadedPartIndexes
          };
          recoverableMedia = state.media;

          // This fires roughly twice per encrypted chunk — around 150 times for
          // a large video. It used to re-render the whole thread and write an
          // encrypted row to SQLite on every one of those, which is what made
          // the app unusable while a big file was going out.
          //
          // The ring reads progress from the transfer store, so no list render
          // is needed here at all, and recovery state only has to be durable
          // enough to survive a crash — not current to the millisecond.
          publishMediaTransferProgress(
            buildMediaTransferProgressKey(input.messageId, input.mediaIndex),
            {
              progress: state.media.transferProgress || Math.max(lastProgressValue, 0),
              status: 'uploading'
            }
          );

          const now = Date.now();

          if (now - lastRecoveryPersistAt < 1500) {
            return;
          }

          lastRecoveryPersistAt = now;
          void persistLocalMediaTransferState({
            contactId: input.contactId,
            media: state.media,
            mediaIndex: input.mediaIndex,
            messageId: input.messageId,
            nativeTransferId,
            progress: state.media.transferProgress || Math.max(lastProgressValue, 0),
            status: 'uploading',
            transferType: 'upload',
            uploadRecovery
          });
        }
      });

      const availableMedia = buildUploadedMediaState(uploadedMedia);

      clearMediaTransferProgress(buildMediaTransferProgressKey(input.messageId, input.mediaIndex));
      updateVisibleMessageMedia(input.contactId, input.messageId, availableMedia, input.mediaIndex);
      // Write the finished state back to the cached message, not just to React
      // state and the transfer queue. Without this the message keeps whatever
      // in-progress status was last persisted, so reopening the app makes an
      // already-sent video look like it is still being worked on.
      await persistMessageMediaUpdate(
        input.contactId,
        input.messageId,
        availableMedia,
        input.mediaIndex
      ).catch(() => undefined);
      await persistLocalMediaTransferState({
        contactId: input.contactId,
        media: availableMedia,
        mediaIndex: input.mediaIndex,
        messageId: input.messageId,
        nativeTransferId,
        progress: 1,
        status: 'available',
        transferType: 'upload',
        uploadRecovery
      });
      if (input.media.nativeAssetIdentifier) {
        await clearChatMediaPreparation({
          assetIdentifier: input.media.nativeAssetIdentifier,
          contactId: input.contactId,
          mediaIndex: input.mediaIndex,
          messageId: input.messageId,
          ...getLocalChatScope()
        }).catch(() => undefined);
      }

      return availableMedia;
    } catch (error) {
      await persistLocalMediaTransferState({
        contactId: input.contactId,
        lastError: getErrorMessage(error, 'Unable to upload media.'),
        media: preparedMedia,
        mediaIndex: input.mediaIndex,
        messageId: input.messageId,
        nativeTransferId,
        progress: Math.max(lastProgressValue, 0),
        status: 'failed',
        transferType: 'upload',
        uploadRecovery
      });
      throw error;
    }
  }

  async function uploadMediaItemsForMessage(input: {
    chatType: 'DIRECT' | 'GROUP';
    contactId: string;
    idToken: string;
    mediaItems: ChatMediaAttachment[];
    messageId: string;
  }): Promise<ChatMediaAttachment[]> {
    const uploadedItems: ChatMediaAttachment[] = [];

    for (let index = 0; index < input.mediaItems.length; index += 1) {
      await yieldToChatUi();
      uploadedItems.push(await uploadMediaForMessage({
        chatType: input.chatType,
        contactId: input.contactId,
        idToken: input.idToken,
        media: input.mediaItems[index],
        mediaIndex: index,
        messageId: input.messageId
      }));
      await yieldToChatUi();
    }

    return uploadedItems;
  }

  async function downloadMediaForMessage(
    contactId: string,
    chatType: 'DIRECT' | 'GROUP',
    messageId: string,
    media: ChatMediaAttachment,
    mediaIndex?: number,
    options: { silent?: boolean } = {}
  ): Promise<string | null> {
    const mediaDownloadKey = `${contactId}:${messageId}:${media.mediaId}`;
    const activeDownload = activeMediaDownloadPromisesRef.current.get(mediaDownloadKey);

    if (activeDownload) {
      return activeDownload;
    }

    const downloadPromise = (async () => {
      let lastProgressUpdate = 0;
      let nativeTransferId: string | null = null;

      if (!options.silent) {
        updateVisibleMessageMedia(contactId, messageId, {
          ...media,
          transferProgress: 0,
          transferStatus: 'downloading'
        }, mediaIndex);
      }

      try {
        await persistLocalMediaTransferState({
          contactId,
          media,
          mediaIndex,
          messageId,
          progress: 0,
          status: 'downloading',
          transferType: 'download'
        });
        const idToken = await getIdToken();
        const localUri = await downloadAndDecryptChatMedia({
          chatType,
          contactId,
          idToken,
          media,
          onNativeTransferStarted: (transferId) => {
            nativeTransferId = transferId;
            void persistLocalMediaTransferState({
              contactId,
              media,
              mediaIndex,
              messageId,
              nativeTransferId: transferId,
              progress: Math.max(lastProgressUpdate, 0),
              status: 'downloading',
              transferType: 'download'
            });
          },
          onProgress: (progress) => {
            // Same split as the upload path: the ring gets every update through
            // the store, while the list and the database stay throttled.
            publishMediaTransferProgress(
              buildMediaTransferProgressKey(messageId, mediaIndex),
              { progress, status: 'downloading' }
            );

            if (progress < 1 && progress - lastProgressUpdate < 0.1) {
              return;
            }

            lastProgressUpdate = progress;
            const downloadingMedia: ChatMediaAttachment = {
              ...media,
              transferProgress: progress,
              transferStatus: 'downloading'
            };

              if (!options.silent) {
                updateVisibleMessageMedia(contactId, messageId, downloadingMedia, mediaIndex);
              }
              void persistLocalMediaTransferState({
                contactId,
                media: downloadingMedia,
                mediaIndex,
                messageId,
                nativeTransferId,
                progress,
                status: 'downloading',
                transferType: 'download'
              });
          }
        });
        const availableMedia: ChatMediaAttachment = {
          ...media,
          localUri,
          transferProgress: 1,
          transferStatus: 'available'
        };

        // The bubble renders from the message once media is available, so the
        // live entry is dropped rather than kept for the life of the session.
        clearMediaTransferProgress(buildMediaTransferProgressKey(messageId, mediaIndex));
        updateVisibleMessageMedia(contactId, messageId, availableMedia, mediaIndex);
        await persistMessageMediaUpdate(contactId, messageId, availableMedia, mediaIndex);
        await persistLocalMediaTransferState({
          contactId,
          media: availableMedia,
          mediaIndex,
          messageId,
          nativeTransferId,
          progress: 1,
          status: 'available',
          transferType: 'download'
        });

        return localUri;
      } catch (error) {
        // Logged as well as recorded. A media download that fails leaves the
        // bubble showing a stalled percentage and nothing else, so without this
        // the only evidence is a progress ring that never finishes.
        console.warn('[SynzappMediaDownload] failed', JSON.stringify({
          encryptionMode: media.encryptionMode || 'none',
          hasKey: Boolean(media.key),
          kind: media.kind,
          message: getErrorMessage(error, 'Unable to download media.'),
          partCount: media.partCount || 0,
          partNonces: media.partNonces?.length || 0,
          sizeBytes: media.sizeBytes || 0
        }));

        await persistLocalMediaTransferState({
          contactId,
          lastError: getErrorMessage(error, 'Unable to download media.'),
          media,
          mediaIndex,
          messageId,
          nativeTransferId,
          progress: 0,
          status: 'failed',
          transferType: 'download'
        });
        if (!options.silent) {
          updateVisibleMessageMedia(contactId, messageId, {
            ...media,
            transferProgress: 0,
            transferStatus: 'failed'
          }, mediaIndex);
        }

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
    chatType = getChatTypeForContactId(contactId),
    silent = false
  ) {
    const recentMessages = nextMessages.slice(-CHAT_AUTO_MEDIA_DOWNLOAD_RECENT_WINDOW);
    const candidates: ChatMediaHydrationCandidate[] = [];
    const storedLocalMedia: ChatMediaHydrationCandidate[] = [];

    recentMessages.forEach((message) => {
      const mediaItems = getMessageMediaItems(message);

      mediaItems.forEach((media, index) => {
        if (
          !canDownloadChatMedia(media) ||
          shouldSkipAutomaticMediaDownload(media, chatMediaNetworkPolicyRef.current) ||
          media.transferStatus === 'downloading' ||
          media.transferStatus === 'failed'
        ) {
          return;
        }

        // Media that claims to be on disk is checked separately below. A stored
        // path can outlive the file it points at, and treating it as present
        // would leave the bubble permanently blank with nothing re-fetching it.
        if (media.localUri) {
          storedLocalMedia.push({
            chatType,
            contactId,
            media,
            mediaIndex: index,
            messageId: message.messageId,
            priority: getChatMediaHydrationPriority(media, chatMediaNetworkPolicyRef.current),
            sentAt: message.sentAt
          });
          return;
        }

        candidates.push({
          chatType,
          contactId,
          media,
          mediaIndex: index,
          messageId: message.messageId,
          priority: getChatMediaHydrationPriority(media, chatMediaNetworkPolicyRef.current),
          sentAt: message.sentAt
        });
      });
    });

    candidates
      .sort(compareChatMediaHydrationCandidates)
      .slice(0, CHAT_AUTO_MEDIA_DOWNLOAD_MAX_PER_PASS)
      .forEach((candidate) => {
        void downloadMediaForMessage(
          candidate.contactId,
          candidate.chatType,
          candidate.messageId,
          candidate.media,
          candidate.mediaIndex,
          { silent }
        );
      });

    void repairMissingLocalChatMedia(storedLocalMedia, silent);
  }

  /**
   * Re-fetches one attachment that failed to draw.
   *
   * The background hydration pass only looks at a recent window and repairs a
   * few per pass, so an album further up the thread is never reached. A tile
   * that could not read its file knows for certain that it is gone, and this
   * repairs exactly that one.
   */
  async function repairReportedMissingChatMedia(report: MissingChatMediaReport): Promise<void> {
    const activeChat = selectedChatRef.current;
    const message = messagesRef.current.find((item) => item.messageId === report.messageId);

    if (!activeChat || !message) {
      return;
    }

    const mediaItems = getMessageMediaItems(message);
    const media = mediaItems[report.mediaIndex] || getMessageMedia(message);

    if (!media || !canDownloadChatMedia(media)) {
      return;
    }

    const existingUri = await getExistingLocalMediaUri(report.sourceUri).catch(() => null);

    if (existingUri) {
      // The file moved rather than vanished; point the message at where it is.
      const rebasedMedia: ChatMediaAttachment = { ...media, localUri: existingUri };

      updateVisibleMessageMedia(activeChat.contactId, message.messageId, rebasedMedia, report.mediaIndex);
      await persistMessageMediaUpdate(
        activeChat.contactId,
        message.messageId,
        rebasedMedia,
        report.mediaIndex
      ).catch(() => undefined);
      clearMissingChatMediaReport(report);
      return;
    }

    const missingMedia = buildMissingLocalMediaState(media);

    updateVisibleMessageMedia(activeChat.contactId, message.messageId, missingMedia, report.mediaIndex);
    await persistMessageMediaUpdate(
      activeChat.contactId,
      message.messageId,
      missingMedia,
      report.mediaIndex
    ).catch(() => undefined);

    await downloadMediaForMessage(
      activeChat.contactId,
      activeChat.chatType,
      message.messageId,
      missingMedia,
      report.mediaIndex,
      { silent: true }
    ).catch(() => null);

    // Allow a later loss of the fresh copy to be reported again.
    clearMissingChatMediaReport(report);
  }

  /**
   * Re-downloads media whose cached file is gone.
   *
   * A stored path can stop resolving without the message changing at all - iOS
   * purges the Caches directory under storage pressure, and reinstalling or
   * updating the app moves its container. The message still claims the media is
   * local, so nothing re-fetches it and the bubble renders black forever.
   *
   * Clearing the dead path is what lets normal hydration take over again.
   */
  async function repairMissingLocalChatMedia(
    storedLocalMedia: ChatMediaHydrationCandidate[],
    silent: boolean
  ): Promise<void> {
    if (!storedLocalMedia.length) {
      return;
    }

    const repairableMedia = storedLocalMedia
      .sort(compareChatMediaHydrationCandidates)
      .slice(0, CHAT_AUTO_MEDIA_DOWNLOAD_MAX_PER_PASS);

    for (const candidate of repairableMedia) {
      const storedUri = candidate.media.localUri || '';
      const existingUri = await getExistingLocalMediaUri(storedUri).catch(() => null);
      const repairAction = resolveMissingLocalMediaAction({
        canRedownload: canDownloadChatMedia(candidate.media),
        resolvedUri: existingUri,
        storedUri
      });

      if (repairAction === 'keep' || repairAction === 'ignore') {
        continue;
      }

      if (repairAction === 'rebase' && existingUri) {
        // Same file, new container path. Record the corrected one and move on -
        // no need to spend bandwidth re-downloading something already on disk.
        const repairedMedia: ChatMediaAttachment = {
          ...candidate.media,
          localUri: existingUri
        };

        updateVisibleMessageMedia(
          candidate.contactId,
          candidate.messageId,
          repairedMedia,
          candidate.mediaIndex
        );
        await persistMessageMediaUpdate(
          candidate.contactId,
          candidate.messageId,
          repairedMedia,
          candidate.mediaIndex
        ).catch(() => undefined);
        continue;
      }

      const missingMedia = buildMissingLocalMediaState(candidate.media);

      updateVisibleMessageMedia(
        candidate.contactId,
        candidate.messageId,
        missingMedia,
        candidate.mediaIndex
      );
      await persistMessageMediaUpdate(
        candidate.contactId,
        candidate.messageId,
        missingMedia,
        candidate.mediaIndex
      ).catch(() => undefined);

      void downloadMediaForMessage(
        candidate.contactId,
        candidate.chatType,
        candidate.messageId,
        missingMedia,
        candidate.mediaIndex,
        { silent }
      );
    }
  }

  async function persistMessageMediaUpdate(
    contactId: string,
    messageId: string,
    media: ChatMediaAttachment,
    mediaIndex?: number
  ) {
    const localScope = getLocalChatScope();
    const didUpdateCachedMessage = await updateCachedChatMessageMedia({
      contactId,
      media,
      mediaIndex,
      messageId,
      ...localScope
    }).catch(() => false);

    if (didUpdateCachedMessage) {
      return;
    }

    const cachedConversation = await loadCachedChatConversation({
      contactId,
      ...localScope
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
      ...getLocalChatScope()
    });
  }

  /**
   * Asks again once a waiting message has come due.
   *
   * A scheduled message is sent by the server, not by this phone, so nothing
   * here hears about it. Without this the banner kept saying "1 message
   * scheduled" while the message itself sat in the thread above it, already
   * delivered — the app was showing what it had been told when the chat was
   * opened and had no reason to ask again.
   *
   * The check re-arms itself: refreshing replaces the list, which runs this
   * again, so a message the release worker has not reached yet is simply asked
   * about once more. It stops on its own when nothing is left waiting.
   */
  useEffect(() => {
    // Only ones still waiting are worth re-checking. A failure sits in the list
    // until its author clears it, and polling on its behalf would be a timer
    // that never stops for a message that is never going to change.
    const waiting = scheduledMessages.filter((message) => message.status === 'SCHEDULED');

    if (!selectedChat || selectedChat.chatType === 'GROUP' || !waiting.length) {
      return;
    }

    const contactId = selectedChat.contactId;
    const earliestReleaseAtMs = Math.min(...waiting.map((message) => message.releaseAtMs));
    // The worker runs on the minute, so a message is sent shortly after its
    // time rather than on it. Asking too eagerly just gets the same answer.
    const waitMs = Math.max(
      (earliestReleaseAtMs + SCHEDULED_MESSAGE_RELEASE_GRACE_MS) - Date.now(),
      SCHEDULED_MESSAGE_RECHECK_MS
    );
    const timer = setTimeout(() => {
      void refreshScheduledMessages(contactId);
    }, waitMs);

    return () => clearTimeout(timer);
  }, [scheduledMessages, selectedChat?.chatType, selectedChat?.contactId]);

  /**
   * Opens the organization-wide view, for an admin.
   *
   * The policy is loaded alongside the list because the list means nothing
   * without it: a company that has turned visibility off has no list to show,
   * and the screen has to say that rather than showing an empty one.
   */
  async function handleOpenActionRemindersSettings() {
    setError(null);
    setSettingsScreen('action-reminders');
    setIsLoadingActionReminders(true);

    try {
      setActionReminderPolicy(await getActionReminderPolicy(await getIdToken()));
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to load reminder settings.'));
    } finally {
      setIsLoadingActionReminders(false);
    }
  }

  /**
   * Saves one changed setting, sending the whole policy.
   *
   * The server validates the set together — two reminders at the same hour,
   * working hours that end before they start — so a partial update would be a
   * set it could not judge.
   */
  async function handleUpdateActionReminderPolicy(next: Partial<ActionReminderPolicy>) {
    if (!actionReminderPolicy) {
      return;
    }

    const merged = { ...actionReminderPolicy, ...next };

    setError(null);
    setIsSavingActionReminders(true);

    try {
      setActionReminderPolicy(await updateActionReminderPolicy({
        idToken: await getIdToken(),
        policy: {
          escalateOverdueAfterHours: merged.escalateOverdueAfterHours,
          firstReminderHour: merged.firstReminderHour,
          frequency: merged.frequency,
          secondReminderHour: merged.secondReminderHour,
          // Set from the admin's own phone the first time, so "08:00" means the
          // clock they are looking at rather than a server's.
          timeZone: merged.timeZone === 'UTC'
            ? (getDeviceTimeZone() || 'UTC')
            : merged.timeZone,
          workingHoursEndHour: merged.workingHoursEndHour,
          workingHoursStartHour: merged.workingHoursStartHour
        }
      }));
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to save this setting.'));
    } finally {
      setIsSavingActionReminders(false);
    }
  }

  async function handleOpenAdminContactSettings() {
    setError(null);
    setSettingsScreen('admin-contact');
    setIsLoadingAdminContactPolicy(true);

    try {
      setAdminContactPolicy(await getAdminContactPolicy(await getIdToken()));
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to load this setting.'));
    } finally {
      setIsLoadingAdminContactPolicy(false);
    }
  }

  async function handleUpdateAdminContactPolicy(showAdminPhoneNumber: boolean) {
    setError(null);
    setIsSavingAdminContactPolicy(true);

    try {
      const policy = await updateAdminContactPolicy({
        idToken: await getIdToken(),
        showAdminPhoneNumber
      });

      setAdminContactPolicy(policy);
      // The menu carries the number, so it is stale the moment this changes.
      await loadUserProfile(false).catch(() => undefined);
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to save this setting.'));
    } finally {
      setIsSavingAdminContactPolicy(false);
    }
  }

  async function handleOpenScheduledMessagesSettings() {
    setError(null);
    setSettingsScreen('scheduled-messages');
    setIsLoadingTenantScheduledMessages(true);

    try {
      const idToken = await getIdToken();
      const policy = await getScheduledMessagePolicy(idToken);

      setScheduledMessagePolicy(policy);
      setTenantScheduledMessages(policy.adminVisibilityEnabled
        ? await listTenantScheduledMessages(idToken)
        : []);
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to load scheduled messages.'));
    } finally {
      setIsLoadingTenantScheduledMessages(false);
    }
  }

  async function handleUpdateScheduledMessagePolicy(next: {
    adminVisibilityEnabled: boolean;
    enabled: boolean;
  }) {
    if (!scheduledMessagePolicy) {
      return;
    }

    setError(null);
    setIsSavingScheduledMessagePolicy(true);

    try {
      const idToken = await getIdToken();
      const policy = await updateScheduledMessagePolicy({
        idToken,
        policy: {
          adminVisibilityEnabled: next.adminVisibilityEnabled,
          enabled: next.enabled,
          // Kept as they are. This screen offers the two decisions a person
          // makes; the limits are numbers nobody changes by tapping.
          maxDaysAhead: scheduledMessagePolicy.maxDaysAhead,
          maxPendingPerUser: scheduledMessagePolicy.maxPendingPerUser
        }
      });

      setScheduledMessagePolicy(policy);
      setTenantScheduledMessages(policy.adminVisibilityEnabled
        ? await listTenantScheduledMessages(idToken)
        : []);
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to save this setting.'));
    } finally {
      setIsSavingScheduledMessagePolicy(false);
    }
  }

  /**
   * Asks why, before stopping somebody's message.
   *
   * The reason is required and the author reads it. That is the safeguard on
   * this power rather than a formality: an administrator who has to explain
   * themselves to the person affected acts differently from one who can act
   * invisibly, and a stop nobody can account for later is exactly what this
   * permission was written to avoid.
   *
   * `Alert.prompt` is the system's own text prompt on iOS. Android has no
   * equivalent, so it gets a small sheet of its own that asks the same thing —
   * neither platform is allowed to skip the question.
   */
  function handleCancelTenantScheduledMessage(scheduledMessage: TenantScheduledMessage) {
    const title = 'Why are you stopping this?';
    const body = `${scheduledMessage.senderName} will not send this to ${scheduledMessage.recipientName}, and will see the reason you give.`;

    if (Platform.OS === 'ios') {
      Alert.prompt(
        title,
        body,
        [
          { style: 'cancel', text: 'Leave it' },
          {
            onPress: (reason?: string) => { void cancelTenantScheduledMessageNow(scheduledMessage, reason || ''); },
            style: 'destructive',
            text: 'Stop it'
          }
        ],
        'plain-text'
      );

      return;
    }

    setStopReasonTarget(scheduledMessage);
    setStopReasonDraft('');
  }

  async function cancelTenantScheduledMessageNow(
    scheduledMessage: TenantScheduledMessage,
    reason: string
  ) {
    if (reason.trim().length < 8) {
      setError('Give a reason for stopping this message. The person who wrote it will see it.');

      return;
    }

    setError(null);
    setStopReasonTarget(null);
    setBusyTenantScheduledMessageId(scheduledMessage.scheduledMessageId);

    try {
      const idToken = await getIdToken();

      await cancelTenantScheduledMessage({
        idToken,
        reason,
        scheduledMessageId: scheduledMessage.scheduledMessageId
      });
      setTenantScheduledMessages(await listTenantScheduledMessages(idToken));
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to stop this message.'));
    } finally {
      setBusyTenantScheduledMessageId(null);
    }
  }

  /**
   * Loads what is waiting to go in this conversation.
   *
   * Quiet on failure. The banner is a convenience, and a chat that will not
   * open because a secondary list could not be fetched is a worse outcome than
   * a banner that is briefly absent.
   */
  async function refreshScheduledMessages(contactId: string) {
    try {
      const idToken = await getIdToken();

      setScheduledMessages(await getScheduledChatMessages({ contactId, idToken }));
    } catch {
      setScheduledMessages([]);
    }

    // The chat list is marked from the same fetch, so opening one conversation
    // corrects the marks on all of them.
    void refreshScheduledChatStates();
  }

  /**
   * Marks the chat list with what is outstanding across every conversation.
   *
   * Without this a scheduled message existed only inside the chat it belonged
   * to — and a failed one, in a thread nobody opened, was invisible.
   */
  /**
   * How much this person still owes, for the line above the chat list.
   *
   * Quiet on failure. The line is a prompt, and a chat list that will not load
   * because a count could not be fetched is a worse outcome than a prompt that
   * is briefly missing.
   */
  /**
   * Tells the server this person is typing in the open conversation.
   *
   * Held in a callback rather than inline so the thread's heartbeat does not
   * restart every time the draft changes — the effect there depends on this
   * identity, and a new function per keystroke would defeat the throttle it
   * exists to provide.
   */
  /**
   * The line each chat list row shows while somebody is writing in it.
   *
   * Rebuilt only when the typing map changes, and re-read against the clock so
   * a notice whose sender went quiet stops being shown rather than sitting
   * there until the next socket event.
   */
  const typingTextByConversation = useMemo(() => {
    const nowMs = Date.now();
    const byConversation: Record<string, string> = {};

    for (const [conversationId, participants] of Object.entries(typingByConversation)) {
      const text = describeTypingForChatList({
        isGroup: groupChatContactIds.has(conversationId),
        nowMs,
        participants
      });

      if (text) {
        byConversation[conversationId] = text;
      }
    }

    return byConversation;
  }, [groupChatContactIds, typingByConversation]);

  const handleTypingChange = useCallback((isTyping: boolean) => {
    const chat = selectedChatRef.current;

    if (!chat) {
      return;
    }

    sendRealtimeTyping(realtimeSocketRef.current, {
      chatType: chat.chatType === 'GROUP' ? 'GROUP' : 'DIRECT',
      contactId: chat.contactId,
      isTyping
    });
  }, []);

  async function refreshMyActionCounts() {
    try {
      setMyActionCounts(await getMyActionCounts({ idToken: await getIdToken() }));
    } catch {
      setMyActionCounts(null);
    }
  }

  // Held in a ref so a memoised callback can reach the current one rather than
  // the one that existed when it was created.
  refreshMyActionCountsRef.current = refreshMyActionCounts;

  async function refreshScheduledChatStates() {
    try {
      const idToken = await getIdToken();

      setScheduledChatStates(buildScheduledChatStates(await getScheduledChatMessages({ idToken })));
    } catch {
      // A mark on a list is a convenience. Failing to fetch it must not be
      // something the person has to read about.
      setScheduledChatStates({});
    }
  }

  /**
   * Holds what is written until the time its author picked.
   *
   * The draft is only cleared once the server has taken it. Clearing first
   * would lose somebody's message to a dropped connection, and a scheduled
   * message is often the more considered one.
   */
  async function handleScheduleMessage(at: Date) {
    if (!selectedChat || selectedChat.chatType === 'GROUP') {
      return;
    }

    const text = messageDraft.trim();

    if (!text) {
      return;
    }

    setError(null);

    try {
      const idToken = await getIdToken();

      await scheduleChatMessage({
        contactId: selectedChat.contactId,
        idToken,
        releaseAtMs: at.getTime(),
        text,
        timeZone: getDeviceTimeZone() || 'UTC'
      });
      setMessageDraft('');
      await refreshScheduledMessages(selectedChat.contactId);
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to schedule this message.'));
      throw nextError;
    }
  }

  async function handleCancelScheduledMessage(scheduledMessage: ScheduledChatMessage) {
    setError(null);

    try {
      const idToken = await getIdToken();

      await cancelScheduledChatMessage({
        idToken,
        scheduledMessageId: scheduledMessage.scheduledMessageId
      });
      await refreshScheduledMessages(scheduledMessage.contactId);
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to cancel this scheduled message.'));
    }
  }

  /**
   * Clears a message that could not be sent off the list.
   *
   * Only the row goes. The record and the reason stay on the server, because
   * what an organization tried to send should not become unanswerable because
   * somebody tidied their screen.
   */
  async function handleDismissScheduledMessage(scheduledMessage: ScheduledChatMessage) {
    setError(null);

    try {
      const idToken = await getIdToken();

      await dismissScheduledChatMessage({
        idToken,
        scheduledMessageId: scheduledMessage.scheduledMessageId
      });
      await refreshScheduledMessages(scheduledMessage.contactId);
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to clear this message.'));
    }
  }

  async function handleSendScheduledMessageNow(scheduledMessage: ScheduledChatMessage) {
    setError(null);

    try {
      const idToken = await getIdToken();

      await sendScheduledChatMessageNow({
        idToken,
        scheduledMessageId: scheduledMessage.scheduledMessageId
      });
      await refreshScheduledMessages(scheduledMessage.contactId);

      if (selectedChat) {
        await loadMessagesForChat(selectedChat, false).catch(() => undefined);
      }
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to send this message now.'));
    }
  }

  async function handleSendMessage() {
    if (!selectedChat || activeTrashSegmentIdRef.current) {
      return;
    }

    const activeChat = selectedChat;
    const text = messageDraft.trim();

    if (!text) {
      return;
    }

    // Every reason to refuse the send is settled before the guard is taken.
    //
    // This check used to sit after it, and returned without releasing it. One
    // tap while the device was not registered left the guard raised for the
    // life of the screen, and every later tap returned at the check below. The
    // button was not slow, it was dead. Nothing may return between raising the
    // guard and the try/finally that lowers it.
    if (!activeChat.hasActiveDevice) {
      setError(getChatDeviceNotReadyMessage(activeChat));
      return;
    }

    // Taps that arrive while the JS thread is busy are delivered together the
    // moment it frees, and each one used to enqueue its own copy of the
    // message. A ref is checked and set synchronously, so the extra taps are
    // already too late by the time they run. State would not work here — the
    // re-render happens after all of them have fired.
    if (isEnqueueingChatMessageRef.current) {
      return;
    }

    isEnqueueingChatMessageRef.current = true;
    setError(null);
    const replyReference = replyTarget ? buildReplyReference(replyTarget) : null;

    try {
      await queueAndSendChatPayload({
        activeChat,
        clearDraft: true,
        media: null,
        replyReference,
        text
      });
    } finally {
      isEnqueueingChatMessageRef.current = false;
    }
  }

  /**
   * The camera button. Opens the app's own camera.
   *
   * It used to ask "photo or video" first, because the system picker opens a
   * different app for each and the choice had to be made before it launched.
   * Running the camera in the app removes the question: tap for a photo, hold
   * to record, which is the gesture people already know from every other chat
   * app, and the frame on screen becomes the poster for free.
   */
  function handleOpenChatCamera() {
    if (!selectedChat || activeTrashSegmentIdRef.current) {
      return;
    }

    if (!selectedChat.hasActiveDevice) {
      setError(getChatDeviceNotReadyMessage(selectedChat));
      return;
    }

    setError(null);
    setIsChatCameraOpen(true);
  }

  /**
   * A photo or clip taken by the app's own camera.
   *
   * It arrives complete: the file is where the camera put it, the poster was
   * kept while the viewfinder was showing it, and a selfie is turned back the
   * right way round without anybody being asked, because which lens took it is
   * known rather than guessed.
   */
  async function handleChatCameraCaptured(captured: CapturedChatMedia) {
    setIsChatCameraOpen(false);

    const activeChat = selectedChat;

    if (!activeChat) {
      return;
    }

    try {
      const media = await buildLocalMediaFromCapture(captured);

      if (shouldSendSelectedMediaImmediately([media])) {
        await sendSelectedMediaImmediately(activeChat, [media]);
        return;
      }

      setMediaReviewItems([{
        id: `media_review_${Date.now()}_0_${media.fileName}`,
        media
      }]);
      setMediaReviewActiveIndex(0);
      setMediaReviewCaption('');
      setMediaReviewQualityMode('standard');
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'That capture could not be prepared.'));
    }
  }

  /** Turns a mirrored selfie the right way round, before it is sent. */
  async function handleFlipMediaReviewItem(index: number) {
    const target = mediaReviewItems[index];

    if (!target || target.media.kind !== 'image') {
      return;
    }

    try {
      const flipped = await flipChatMediaHorizontally(target.media);

      setMediaReviewItems((current) => current.map(
        (item, position) => (position === index ? { ...item, media: flipped } : item)
      ));
    } catch {
      setError('That photo could not be flipped.');
    }
  }

  function showNativeMediaPreparationAlert(error: unknown) {
    const message = getErrorMessage(error, 'Synzapp could not prepare this media. Please try again.');

    // A refused photo permission is only fixable in Settings, so take the user
    // there instead of showing an OK button that leads nowhere.
    if (isPhotoAccessDeniedError(error) || message === PHOTO_ACCESS_DENIED_MESSAGE) {
      Alert.alert(
        'Photos access needed',
        message,
        [
          { style: 'cancel', text: 'Not now' },
          {
            onPress: () => {
              void Linking.openSettings().catch(() => undefined);
            },
            text: 'Open Settings'
          }
        ]
      );
      return;
    }

    const isVideoExportIssue = /video|PHPhotosErrorDomain|PhotosError|iCloud|export/i.test(message);

    Alert.alert(
      isVideoExportIssue ? 'Video not ready' : 'Media not ready',
      message,
      [{ text: 'OK' }]
    );
  }

  async function handlePickChatMediaLibrary() {
    if (!selectedChat || activeTrashSegmentIdRef.current) {
      return;
    }

    const activeChat = selectedChat;

    if (!activeChat.hasActiveDevice) {
      setError(getChatDeviceNotReadyMessage(activeChat));
      return;
    }

    try {
      setMediaPreparationProgress(null);
      const localMediaItems = await pickNativeChatLibraryMedia(setMediaPreparationProgress);

      if (!localMediaItems?.length) {
        return;
      }

      if (shouldSendSelectedMediaImmediately(localMediaItems)) {
        await sendSelectedMediaImmediately(activeChat, localMediaItems);
        return;
      }

      setError(null);
      setMediaReviewItems(localMediaItems.map((localMedia, index) => ({
        id: `media_review_${Date.now()}_${index}_${localMedia.fileName}`,
        media: localMedia
      })));
      setMediaReviewActiveIndex(0);
      setMediaReviewCaption('');
      setMediaReviewQualityMode('standard');
    } catch (nextError) {
      showNativeMediaPreparationAlert(nextError);
    } finally {
      setMediaPreparationProgress(null);
    }
  }

  function handleCancelMediaReview() {
    if (isSendingMediaReview) {
      return;
    }

    setMediaReviewItems([]);
    setMediaReviewActiveIndex(0);
    setMediaReviewCaption('');
    setMediaReviewQualityMode('standard');
  }

  function handleSelectMediaReviewIndex(index: number) {
    setMediaReviewActiveIndex(Math.max(0, Math.min(index, mediaReviewItems.length - 1)));
  }

  function handleUpdateMediaReviewCaption(value: string) {
    setMediaReviewCaption(value);
  }


  async function sendSelectedMediaImmediately(activeChat: ChatItem, mediaItems: LocalChatMediaInput[]) {
    const replyReference = replyTarget ? buildReplyReference(replyTarget) : null;
    const preparedItems = mediaItems.map((media) => applyMediaReviewQualityMode(media, 'standard'));

    setError(null);
    setMediaReviewItems([]);
    setMediaReviewActiveIndex(0);
    setMediaReviewCaption('');
    setMediaReviewQualityMode('standard');

    if (preparedItems.length > 1) {
      await queueAndSendChatPayload({
        activeChat,
        clearDraft: false,
        media: null,
        mediaItems: preparedItems.map(buildLocalChatMediaAttachment),
        replyReference,
        text: ''
      });
      return;
    }

    await queueAndSendChatPayload({
      activeChat,
      clearDraft: false,
      media: buildLocalChatMediaAttachment(preparedItems[0]),
      mediaItems: [],
      replyReference,
      text: ''
    });
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

  async function handleSendMediaReview() {
    if (!selectedChat || !mediaReviewItems.length || isSendingMediaReview || activeTrashSegmentIdRef.current) {
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
    setMediaReviewQualityMode('standard');
    setError(null);

    const preparedItems = itemsToSend.map((item) =>
      applyMediaReviewQualityMode(item.media, mediaReviewQualityMode)
    );

    setMediaPreparationProgress(null);
    setIsSendingMediaReview(false);

    if (preparedItems.length > 1) {
      void queueAndSendChatPayload({
        activeChat,
        clearDraft: false,
        media: null,
        mediaItems: preparedItems.map(buildLocalChatMediaAttachment),
        replyReference,
        text: caption
      });
      return;
    }

    const mediaToSend = preparedItems[0];

    if (mediaToSend) {
      void queueAndSendChatPayload({
        activeChat,
        clearDraft: false,
        media: buildLocalChatMediaAttachment(mediaToSend),
        mediaItems: [],
        replyReference,
        text: caption
      });
    }
  }

  async function handlePickChatFile() {
    if (!selectedChat || activeTrashSegmentIdRef.current) {
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

      const cachedMedia = await cacheLocalChatMedia(localMedia);
      const replyReference = replyTarget ? buildReplyReference(replyTarget) : null;

      setError(null);
      await queueAndSendChatPayload({
        activeChat,
        clearDraft: false,
        media: buildLocalChatMediaAttachment(cachedMedia),
        replyReference,
        text: ''
      });
    } catch (nextError) {
      Alert.alert('File not sent', getErrorMessage(nextError, 'Unable to prepare this file.'));
    }
  }

  async function handleSendVoiceNote(localMedia: LocalChatMediaInput) {
    if (!selectedChat || activeTrashSegmentIdRef.current) {
      return;
    }

    const activeChat = selectedChat;

    if (!activeChat.hasActiveDevice) {
      setError(getChatDeviceNotReadyMessage(activeChat));
      return;
    }

    try {
      const cachedMedia = await cacheLocalChatMedia(localMedia);
      const replyReference = replyTarget ? buildReplyReference(replyTarget) : null;

      setError(null);
      await queueAndSendChatPayload({
        activeChat,
        clearDraft: false,
        media: buildLocalChatMediaAttachment(cachedMedia),
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
    if (activeTrashSegmentIdRef.current) {
      return;
    }

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
        ...getLocalChatScope(),
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
      deliveryStatus: 'queued',
      media: primaryMedia
        ? {
            ...primaryMedia,
            transferProgress: 0,
            transferStatus: 'queued'
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
        transferStatus: 'queued'
      }))
    };

    if (clearDraft) {
      setMessageDraft('');
    }
    // The reply target is kept, not cleared. Answering a message is usually
    // more than one sentence, and clearing it after the first sent somebody
    // back to the message to start again. The focus overlay stays until it is
    // closed, which is the gesture that says "done".
    addVisibleLocalMessage(activeChat, optimisticMessage);

    const dispatchSend = () => {
      void sendQueuedChatPayload({
        activeChat,
        media,
        mediaItems,
        pendingMessage,
        replyReference,
        text
      });
    };

    // A text message is dispatched immediately.
    //
    // Deferring through InteractionManager exists to let the picker and review
    // animations settle before heavy media work starts. But it waits on *any*
    // outstanding interaction handle, and a looping animation holds one for as
    // long as it runs — so while a transfer ring was animating, a typed message
    // could sit unsent until the upload finished. Text has no heavy work to
    // defer, so it should never have been behind that gate.
    if (!primaryMedia) {
      dispatchSend();
      return;
    }

    InteractionManager.runAfterInteractions(() => {
      setTimeout(dispatchSend, 120);
    });
  }

  async function sendQueuedChatPayload(input: {
    activeChat: ChatItem;
    media: ChatMediaAttachment | null;
    mediaItems: ChatMediaAttachment[];
    pendingMessage: Awaited<ReturnType<typeof enqueuePendingChatMessage>>;
    replyReference: ChatReplyReference | null;
    text: string;
  }) {
    const {
      activeChat,
      media,
      mediaItems,
      pendingMessage,
      replyReference,
      text
    } = input;

    if (activeLocalSendQueueIdsRef.current.has(pendingMessage.queueId)) {
      return;
    }

    if (locallyDeletedChatContactIdsRef.current.has(activeChat.contactId)) {
      await removePendingChatMessage({
        ...getLocalChatScope(),
        queueId: pendingMessage.queueId
      }).catch(() => undefined);
      removeVisibleLocalMessage(activeChat.contactId, pendingMessage.queueId);
      return;
    }

    activeLocalSendQueueIdsRef.current.add(pendingMessage.queueId);

    try {
      await updatePendingChatMessage({
        lastError: null,
        ...getLocalChatScope(),
        queueId: pendingMessage.queueId,
        status: 'sending'
      });
      const idToken = await getIdToken();
      const sendMediaItems = mediaItems.length > 1
        ? await uploadMediaItemsForMessage({
            chatType: activeChat.chatType,
            contactId: activeChat.contactId,
            idToken,
            mediaItems,
            messageId: pendingMessage.queueId
          })
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
        clientMessageId: pendingMessage.queueId,
        contactId: activeChat.contactId,
        currentUid,
        idToken,
        media: sendMedia,
        mediaItems: sendMediaItems,
        replyTo: replyReference,
        text
      });
      // Flip the bubble first; the durable work follows.
      markVisibleMessageSent(activeChat.contactId, pendingMessage.queueId, result.message);

      const cachedContact = await cacheChatContactPhoto(result.contact, idToken);

      setProfilePhotoAuthToken(idToken);

      // Commit first, then drop the outbox record. See the matching comment in
      // syncPendingMessagesForChat: reversing this order leaves the in-flight
      // bubble in neither the conversation cache nor the outbox, and any thread
      // refresh landing in that window makes it vanish and then reappear.
      if (!locallyDeletedChatContactIdsRef.current.has(activeChat.contactId)) {
        await updateSyncedPendingMessage({
          contact: cachedContact,
          contactId: activeChat.contactId,
          pendingQueueId: pendingMessage.queueId,
          sentMessage: result.message
        }).catch(() => undefined);
      }

      await removePendingChatMessage({
        ...getLocalChatScope(),
        queueId: pendingMessage.queueId
      });

      if (locallyDeletedChatContactIdsRef.current.has(activeChat.contactId)) {
        removeVisibleLocalMessage(activeChat.contactId, pendingMessage.queueId);
        return;
      }
	    } catch (nextError) {
	      if (isCompanyAccessDeniedError(nextError)) {
	        onSessionInvalid(ACCESS_DENIED_MESSAGE);
	        return;
	      }

	      if (isRecipientDeviceNotReadyError(nextError)) {
        await removePendingChatMessage({
          ...getLocalChatScope(),
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
          ...getLocalChatScope(),
          queueId: pendingMessage.queueId,
          status: 'pending'
        });
        replaceVisibleLocalMessage(activeChat, pendingMessage.queueId, pendingMessage.message);
        return;
      }

      const sendErrorMessage = getErrorMessage(nextError, 'Unable to send message.');
      const failedMessage = markChatMessageSendFailed(pendingMessage.message);

      await updatePendingChatMessage({
        lastError: sendErrorMessage,
        message: failedMessage,
        ...getLocalChatScope(),
        queueId: pendingMessage.queueId,
        status: 'failed'
      }).catch(() => undefined);
      replaceVisibleLocalMessage(activeChat, pendingMessage.queueId, failedMessage);
      setError(sendErrorMessage);
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
	      if (isCompanyAccessDeniedError(nextError)) {
	        onSessionInvalid(ACCESS_DENIED_MESSAGE);
	        return;
	      }

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
        ...getLocalChatScope()
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

    if (media.kind === 'video') {
      void handleOpenVideoAttachment(message, activeIndex);
      return;
    }

    if (media.kind === 'image') {
      handleOpenMediaViewer(message, activeIndex);
      return;
    }

    if (isAudioAttachment(media)) {
      void handleOpenFileAttachment(message, activeIndex);
      return;
    }

    void handleOpenFileAttachment(message, activeIndex);
  }

  function handleOpenVideoAttachment(message: ChatMessage, activeIndex: number) {
    const activeChat = selectedChatRef.current;
    const allMediaItems = getMessageMediaItems(message);
    const selectedMedia = allMediaItems[activeIndex] || allMediaItems[0] || getMessageMedia(message);

    if (!selectedMedia || selectedMedia.kind !== 'video') {
      return;
    }

    handleOpenMediaViewer(message, activeIndex);

    if (getMediaLocalUri(selectedMedia) || !activeChat || !canDownloadChatMedia(selectedMedia)) {
      return;
    }

    const videoPreparationKey = getMediaPreparationKey(message.messageId, selectedMedia, activeIndex);

    setPreparingVideoKey(videoPreparationKey);
    void downloadMediaForMessage(
      activeChat.contactId,
      activeChat.chatType,
      message.messageId,
      selectedMedia,
      activeIndex
    ).finally(() => {
      setPreparingVideoKey((currentKey) => currentKey === videoPreparationKey ? null : currentKey);
    });
  }

  async function handleShareMediaAttachment(media: ChatMediaAttachment, message?: ChatMessage): Promise<void> {
    if (!media) {
      return;
    }

    try {
      let shareUri = getMediaLocalUri(media);

      if (!shareUri && selectedChatRef.current && canDownloadChatMedia(media)) {
        const downloadMessageId = message?.messageId || media.mediaId;

        if (!downloadMessageId) {
          throw new Error('This media is missing its download reference.');
        }

        shareUri = await downloadMediaForMessage(
          selectedChatRef.current.contactId,
          selectedChatRef.current.chatType,
          downloadMessageId,
          media
        ) || '';
      }

      if (!shareUri) {
        throw new Error('This media is not available on this device yet.');
      }

      await Share.share({
        message: media.fileName || 'Synzapp media',
        url: shareUri
      });
    } catch (nextError) {
      Alert.alert('Share unavailable', getErrorMessage(nextError, 'Unable to share this media.'));
    }
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
      sourceMessage: message,
      title: selectedChatRef.current?.title || 'Media'
    });
  }

  function handleOpenSentPhotoEditor(media: ChatMediaAttachment, message: ChatMessage): void {
    if (!selectedChat || isSendingSentPhotoEdit || activeTrashSegmentIdRef.current) {
      return;
    }

    if (media.kind !== 'image') {
      Alert.alert('Editing unavailable', 'Only photos can be edited.');
      return;
    }

    const displayUri = getPhotoEditorDisplayUri(media);

    if (!displayUri) {
      Alert.alert(
        'Photo not ready',
        'This photo is still downloading. Open it once it has finished, then try editing.'
      );
      return;
    }

    if (!selectedChat.hasActiveDevice) {
      Alert.alert('Editing unavailable', getChatDeviceNotReadyMessage(selectedChat));
      return;
    }

    setError(null);
    setSentPhotoEditor({
      displayUri,
      fileName: media.fileName || 'Synzapp photo',
      height: getSafePhotoDimension(media.height),
      message,
      sourceUri: getMediaLocalUri(media) || displayUri,
      width: getSafePhotoDimension(media.width)
    });
  }

  function handleOpenSentPhotoEditorFromViewer(media: ChatMediaAttachment, message: ChatMessage): void {
    setMediaViewer(null);

    // iOS refuses to present a modal over one that is still dismissing, and the
    // editor is a full-screen modal of its own. This delay is the viewer getting
    // out of the way first — not an InteractionManager wait, which used to leave
    // the editor never opening at all because a looping animation held a handle.
    setTimeout(() => {
      void handleOpenSentPhotoEditor(media, message);
    }, 320);
  }

  async function handleSendSentPhotoEdit(result: SynzappPhotoEditorResult): Promise<void> {
    if (!selectedChat || !sentPhotoEditor || isSendingSentPhotoEdit || activeTrashSegmentIdRef.current) {
      return;
    }

    const activeChat = selectedChat;

    if (!activeChat.hasActiveDevice) {
      setError(getChatDeviceNotReadyMessage(activeChat));
      return;
    }

    setIsSendingSentPhotoEdit(true);

    try {
      const editedMedia = await createLocalMediaFromEditedPhoto({
        fileName: sentPhotoEditor.fileName,
        height: result.height || sentPhotoEditor.height,
        uri: result.uri,
        width: result.width || sentPhotoEditor.width
      });
      const replyReference = buildReplyReference(sentPhotoEditor.message);

      setSentPhotoEditor(null);
      setMediaViewer(null);
      setError(null);

      void queueAndSendChatPayload({
        activeChat,
        clearDraft: false,
        media: buildLocalChatMediaAttachment(editedMedia),
        mediaItems: [],
        replyReference,
        text: result.caption.trim()
      });
    } catch (nextError) {
      Alert.alert('Photo not sent', getErrorMessage(nextError, 'Unable to send the edited photo.'));
    } finally {
      setIsSendingSentPhotoEdit(false);
    }
  }

  /**
   * The on-disk file for an attachment, fetching it if it is not there.
   *
   * The stored path is checked rather than trusted. A message can claim its
   * media is local while the file is gone — deleting and reinstalling the app
   * wipes the container, and iOS reclaims the caches directory under storage
   * pressure. Returning the stored path regardless is what made tapping a photo
   * after a reinstall open an empty viewer: the path looked fine, so nothing
   * ever re-fetched it.
   */
  async function handlePrepareAttachment(message: ChatMessage, activeIndex: number): Promise<string | null> {
    const activeChat = selectedChatRef.current;
    const mediaItems = getMessageMediaItems(message);
    const media = mediaItems[activeIndex] || mediaItems[0] || getMessageMedia(message);
    const storedUri = getMediaLocalUri(media);

    if (storedUri) {
      const existingUri = await getExistingLocalMediaUri(storedUri).catch(() => null);

      if (existingUri) {
        // The container id in a stored path changes on install and update, so
        // record the corrected one rather than re-fetching what is already here.
        if (existingUri !== storedUri && media) {
          const rebasedMedia: ChatMediaAttachment = { ...media, localUri: existingUri };

          updateVisibleMessageMedia(
            activeChat?.contactId || '',
            message.messageId,
            rebasedMedia,
            activeIndex
          );
        }

        return existingUri;
      }
    }

    if (!activeChat || !canDownloadChatMedia(media)) {
      return null;
    }

    // The file is genuinely gone. Drop the dead path first, or the download
    // writes a new file that the message never points at.
    if (storedUri) {
      const missingMedia = buildMissingLocalMediaState(media);

      updateVisibleMessageMedia(activeChat.contactId, message.messageId, missingMedia, activeIndex);
      await persistMessageMediaUpdate(
        activeChat.contactId,
        message.messageId,
        missingMedia,
        activeIndex
      ).catch(() => undefined);

      return downloadMediaForMessage(
        activeChat.contactId,
        activeChat.chatType,
        message.messageId,
        missingMedia,
        activeIndex
      );
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

  function handleQuickForwardMessage(message: ChatMessage) {
    setIsForwardMode(false);
    setForwardSelectedMessageIds({ [message.messageId]: true });
    setForwardRecipientIds({});
    setIsForwardRecipientModalOpen(true);
    setReplyTarget(null);
    setMessageActionTarget(null);
  }

  function resetForwardMode() {
    setIsForwardMode(false);
    setForwardSelectedMessageIds({});
    setForwardRecipientIds({});
    setIsForwardRecipientModalOpen(false);
  }

  function resetMessageDeleteMode() {
    setIsMessageDeleteMode(false);
    setDeleteSelectedMessageIds({});
    setIsDeletingSelectedMessages(false);
  }

  function handleCancelForwardRecipients() {
    setIsForwardRecipientModalOpen(false);

    if (!isForwardMode) {
      setForwardSelectedMessageIds({});
      setForwardRecipientIds({});
    }
  }

  function handleToggleForwardMessage(message: ChatMessage) {
    setForwardSelectedMessageIds((currentSelection) => ({
      ...currentSelection,
      [message.messageId]: !currentSelection[message.messageId]
    }));
  }

  function handleStartMessageDeleteMode(message: ChatMessage) {
    setMessageActionTarget(null);
    setIsForwardMode(false);
    setForwardSelectedMessageIds({});
    setForwardRecipientIds({});
    setIsForwardRecipientModalOpen(false);
    setReplyTarget(null);
    setIsMessageDeleteMode(true);
    setDeleteSelectedMessageIds({ [message.messageId]: true });
  }

  function handleToggleDeleteMessage(message: ChatMessage) {
    setDeleteSelectedMessageIds((currentSelection) => ({
      ...currentSelection,
      [message.messageId]: !currentSelection[message.messageId]
    }));
  }

  function getSelectedDeleteMessages(): ChatMessage[] {
    return uniqueChatMessages(messages).filter((message) => deleteSelectedMessageIds[message.messageId]);
  }

  function handleConfirmDeleteSelectedMessages() {
    const chat = selectedChatRef.current;
    const selectedMessages = getSelectedDeleteMessages();

    if (!chat || !selectedMessages.length || isDeletingSelectedMessages) {
      return;
    }

    Alert.alert(
      selectedMessages.length === 1 ? 'Delete message?' : 'Delete messages?',
      selectedMessages.length === 1
        ? 'This removes the selected message from this device.'
        : `This removes ${selectedMessages.length} selected messages from this device.`,
      [
        {
          style: 'cancel',
          text: 'Cancel'
        },
        {
          onPress: () => {
            void deleteSelectedMessagesForMe(chat, selectedMessages);
          },
          style: 'destructive',
          text: 'Delete'
        }
      ]
    );
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
          const forwardMediaItems: ChatMediaAttachment[] = [];

          if (sourceMediaItems.length > 1) {
            for (const sourceMedia of sourceMediaItems) {
              await yieldToChatUi();
              forwardMediaItems.push(await uploadEncryptedChatMedia({
                chatType: recipient.chatType,
                contactId: recipient.contactId,
                idToken,
                media: toLocalChatMediaInput(sourceMedia)
              }));
              await yieldToChatUi();
            }
          }

          const sourceMedia = sourceMediaItems[0] || getMessageMedia(message);
          const forwardMedia = sourceMedia && !forwardMediaItems.length
            ? await (async () => {
                await yieldToChatUi();
                const uploadedMedia = await uploadEncryptedChatMedia({
                  chatType: recipient.chatType,
                  contactId: recipient.contactId,
                  idToken,
                  media: toLocalChatMediaInput(sourceMedia)
                });
                await yieldToChatUi();

                return uploadedMedia;
              })()
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
      ...getLocalChatScope()
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
      ...getLocalChatScope()
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
    handleStartMessageDeleteMode(message);
  }

  async function deleteSelectedMessagesForMe(chat: ChatItem, selectedMessages: ChatMessage[]) {
    if (isDeletingSelectedMessages) {
      return;
    }

    setIsDeletingSelectedMessages(true);

    try {
      await deleteMessagesForMe(chat, selectedMessages);
      resetMessageDeleteMode();
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to delete the selected messages.'));
    } finally {
      setIsDeletingSelectedMessages(false);
    }
  }

  async function deleteMessageForMe(chat: ChatItem, message: ChatMessage) {
    await deleteMessagesForMe(chat, [message]);
  }

  async function deleteMessagesForMe(chat: ChatItem, selectedMessages: ChatMessage[]) {
    const messageIdsToDelete = Array.from(new Set(selectedMessages.map((message) => message.messageId)));
    const messageIdSet = new Set(messageIdsToDelete);
    const nextMessages = messagesRef.current.filter((currentMessage) => !messageIdSet.has(currentMessage.messageId));
    const contact = chatContactsRef.current.find((currentContact) => currentContact.contactId === chat.contactId) || null;
    let hiddenMessageIds = [...messageIdsToDelete];
    let refreshedContact = contact
      ? applyLocalChatPreviewOrEmpty(contact, nextMessages)
      : null;

    setMessages(nextMessages);
    setMessageReactions((currentReactions) =>
      messageIdsToDelete.reduce((nextReactions, messageId) => omitRecordKey(nextReactions, messageId), currentReactions)
    );
    setStarredMessageIds((currentStarredMessageIds) =>
      messageIdsToDelete.reduce((nextStarredIds, messageId) => omitRecordKey(nextStarredIds, messageId), currentStarredMessageIds)
    );

    await Promise.all(selectedMessages
      .filter((message) => message.deliveryStatus === 'queued')
      .map((message) => removePendingChatMessage({
        ...getLocalChatScope(),
        queueId: message.messageId
      }).catch(() => undefined)));

    await Promise.all(selectedMessages
      .filter((message) => message.deliveryStatus === 'queued')
      .map((message) => cancelLocalMediaTransfersForMessage({
        contactId: chat.contactId,
        messageId: message.messageId
      }).catch(() => undefined)));

    await Promise.all(selectedMessages.flatMap((message) =>
      getMessageMediaItems(message).map((media, index) =>
        clearChatMediaPreparation({
          assetIdentifier: media.nativeAssetIdentifier,
          contactId: chat.contactId,
          mediaIndex: index,
          messageId: message.messageId,
          ...getLocalChatScope()
        }).catch(() => undefined)
      )
    ));

    await hideCachedChatMessagesForMe({
      contactId: chat.contactId,
      messageIds: hiddenMessageIds,
      ...getLocalChatScope()
    }).catch(() => undefined);

    if (chat.chatType === 'GROUP') {
      try {
        const idToken = await getIdToken();
        const syncedHiddenMessageIds: string[] = [];
        let latestContact: ChatContact | null = null;

        for (const message of selectedMessages) {
          if (message.deliveryStatus === 'queued') {
            continue;
          }

          const result = await deleteChatMessageForMe({
            chatType: chat.chatType,
            contactId: chat.contactId,
            idToken,
            messageId: message.messageId
          });

          syncedHiddenMessageIds.push(...result.hiddenMessageIds);

          if (result.contact) {
            latestContact = result.contact;
          }
        }

        hiddenMessageIds = syncedHiddenMessageIds.length
          ? Array.from(new Set([...hiddenMessageIds, ...syncedHiddenMessageIds]))
          : hiddenMessageIds;

        if (latestContact) {
          setProfilePhotoAuthToken(idToken);
          refreshedContact = applyLocalChatPreviewOrEmpty(
            await cacheChatContactPhoto(latestContact, idToken),
            nextMessages
          );
        }

        await hideCachedChatMessagesForMe({
          contactId: chat.contactId,
          messageIds: hiddenMessageIds,
          ...getLocalChatScope()
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
      ...getLocalChatScope()
    }).then(() => {
      queueEncryptedChatBackup();
    }).catch(() => undefined);

    if (refreshedContact) {
      if (selectedChatRef.current?.contactId === chat.contactId) {
        setSelectedChat(mapChatContactToChatItem(refreshedContact));
      }
      setChatContacts((currentContacts) => upsertChatContact(currentContacts, refreshedContact));
    }
  }

  function handleSelectFooterTab(tab: FooterTab) {
    if (tab === 'Chats') {
      // Coming back from the Actions screen is exactly when the count is most
      // likely to have changed and most likely to be looked at.
      void refreshMyActionCounts();
    }


    chatOpenRequestIdRef.current += 1;
    selectedChatRef.current = null;
    activeTrashSegmentIdRef.current = null;
    setActiveTab(tab);
    setIsInterpreterRoomOpen(false);
    setError(null);
    setSelectedChat(null);
    setActiveTrashSegmentId(null);
    setIsSpamScreenOpen(false);
    setIsArchiveScreenOpen(false);
    setIsArchiveEditMenuOpen(false);
    setIsArchiveSelectionMode(false);
    setSelectedArchivedChatIds({});
    setSpamActionTarget(null);
    setChatMoreActionTarget(null);
    setIsCallOptionsOpen(false);
    setIsNewCallModalOpen(false);
    setIsCallKeypadOpen(false);
    setIsCallFavoritesModalOpen(false);
    setIsScheduleCallModalOpen(false);
    setIsScheduledCallsModalOpen(false);
    setIsCallEditMode(false);
    setCallSearch('');
    setNewCallSearch('');
    setCallFavoritesSearch('');
    setCallKeypadDigits('');
    setIsLoadingMessages(false);
    resetCachedMessagePaging();
    setIsContactInfoModalOpen(false);
    setIsChatNotificationSettingsOpen(false);
    setIsChatTranscriptLanguageOpen(false);
    setIsDirectContactDetailsOpen(false);
    setIsAddToGroupModalOpen(false);
    setIsGroupCallOptionsOpen(false);
    setIsGroupCallPeopleModalOpen(false);
    setIsGroupAddMembersModalOpen(false);
    setIsGroupMembersModalOpen(false);
    setIsGroupInfoModalOpen(false);
    setIsGroupSwitcherModalOpen(false);
    setIsConversationSearchOpen(false);
    setGroupCallPeopleSearch('');
    setGroupAddMembersSearch('');
    setGroupMembersSearch('');
    setAddToGroupSearch('');
    setMessageListSearch('');
    setMessageListModalMode(null);
    setSelectedGroupCallMemberIds({});
    setSelectedGroupAddMemberIds({});
    setSelectedAddToGroupIds({});
    setMessageDraft('');
    setReplyTarget(null);
    resetForwardMode();
    resetMessageDeleteMode();
    setMessages([]);

    if (tab === 'Settings') {
      setSettingsScreen('list');
    }

    if (tab === 'Calls' && unseenCallCount > 0) {
      void persistCallStoreData({
        favoriteContactIds: callFavoriteContactIdsRef.current,
        history: markSynzappCallsSeen(callHistoryRef.current),
        scheduledCalls: scheduledCallsRef.current
      });
    }

    if (tab === 'You') {
      void loadUserProfile();
    }
  }

  function handleCloseChat() {
    chatOpenRequestIdRef.current += 1;
    selectedChatRef.current = null;
    activeTrashSegmentIdRef.current = null;
    setSelectedChat(null);
    setActiveTrashSegmentId(null);
    setIsLoadingMessages(false);
    setIsContactInfoModalOpen(false);
    setIsChatNotificationSettingsOpen(false);
    setIsChatTranscriptLanguageOpen(false);
    setIsDirectContactDetailsOpen(false);
    setIsAddToGroupModalOpen(false);
    setIsGroupCallOptionsOpen(false);
    setIsGroupCallPeopleModalOpen(false);
    setIsGroupAddMembersModalOpen(false);
    setIsGroupMembersModalOpen(false);
    setIsGroupInfoModalOpen(false);
    setIsGroupSwitcherModalOpen(false);
    setIsConversationSearchOpen(false);
    setGroupCallPeopleSearch('');
    setGroupAddMembersSearch('');
    setGroupMembersSearch('');
    setAddToGroupSearch('');
    setMessageListSearch('');
    setMessageListModalMode(null);
    setSelectedGroupCallMemberIds({});
    setSelectedGroupAddMemberIds({});
    setSelectedAddToGroupIds({});
    setMessageDraft('');
    setReplyTarget(null);
    resetForwardMode();
    resetMessageDeleteMode();
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

  function handleOpenKeyResultsSettings() {
    if (!canManageCompanyProfile) {
      return;
    }

    setError(null);
    setIsKeyResultUnitModalOpen(false);
    setIsKeyResultsOptionsMenuOpen(false);
    setIsKeyResultsContentScrollEnabled(true);
    setSettingsScreen('key-results');
    void loadKeyResults();
  }

  function handleOpenSecuritySettings() {
    if (!canManageSecurity) {
      return;
    }

    setError(null);
    setSettingsScreen('security');
    void loadSecurityDevices();
  }

  function handleOpenOfflineChatSettings() {
    if (!canManageSecurity) {
      return;
    }

    setError(null);
    setSettingsScreen('offline-chat');
    void refreshOfflineChatMetrics();
  }

  function handleOpenAiUsageSettings() {
    if (!canManageAiUsage) {
      return;
    }

    setError(null);
    setSettingsScreen('ai-usage');
    void loadTenantAiUsage();
  }

  async function loadTenantAiUsage() {
    if (!canManageAiUsage) {
      return;
    }

    setIsLoadingTenantAiUsage(true);

    try {
      const idToken = await getIdToken();
      const [dashboard, policyResult] = await Promise.all([
        getTenantAiUsageDashboard(idToken),
        getTenantAiPolicy(idToken)
      ]);

      setTenantAiDashboard({
        ...dashboard,
        policy: policyResult.policy || dashboard.policy
      });
      setTenantAiFeatureCatalog(policyResult.features);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load AI usage.');
    } finally {
      setIsLoadingTenantAiUsage(false);
    }
  }

  async function saveTenantAiPolicy(nextPolicyPromise: (idToken: string) => Promise<TenantAiPolicy>) {
    if (!canManageAiUsage || isSavingTenantAiPolicy) {
      return;
    }

    setIsSavingTenantAiPolicy(true);

    try {
      const idToken = await getIdToken();
      const policy = await nextPolicyPromise(idToken);
      const dashboard = await getTenantAiUsageDashboard(idToken);
      setTenantAiDashboard({
        ...dashboard,
        policy
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to update AI policy.');
    } finally {
      setIsSavingTenantAiPolicy(false);
    }
  }


  function handleToggleTenantCompanyAi(enabled: boolean) {
    confirmTenantAiToggle({
      enabled,
      message: 'This will stop AI features for this company only. Other tenants will not be affected.',
      onConfirm: () => {
        void saveTenantAiPolicy((idToken) =>
          updateTenantCompanyAiPolicy({
            enabled,
            idToken,
            reason: enabled ? undefined : 'Disabled by organization admin'
          })
        );
      },
      title: 'Disable company AI?'
    });
  }

  function handleSaveTenantAiBudget(monthlyBudgetUsd: number | null, hardLimitEnabled: boolean) {
    void saveTenantAiPolicy((idToken) =>
      updateTenantAiBudgetPolicy({
        hardLimitEnabled,
        idToken,
        monthlyBudgetUsd,
        softWarningPercent: tenantAiDashboard?.policy.softWarningPercent || 80
      })
    );
  }

  function handleToggleTenantAiFeature(feature: TenantAiFeatureCatalogItem, enabled: boolean) {
    confirmTenantAiToggle({
      enabled,
      message: `${feature.label} will be disabled for this company only.`,
      onConfirm: () => {
        void saveTenantAiPolicy((idToken) =>
          updateTenantAiFeaturePolicy({
            enabled,
            featureId: feature.featureId,
            idToken
          })
        );
      },
      title: `Disable ${feature.label}?`
    });
  }

  function handleToggleTenantAiDepartment(department: TenantDepartment, enabled: boolean) {
    confirmTenantAiToggle({
      enabled,
      message: `AI will be disabled for ${department.name}. Other departments remain unchanged.`,
      onConfirm: () => {
        void saveTenantAiPolicy((idToken) =>
          updateTenantAiDepartmentPolicy({
            departmentId: department.departmentId,
            enabled,
            idToken
          })
        );
      },
      title: `Disable AI for ${department.name}?`
    });
  }

  function handleToggleTenantAiEmployee(employee: ApprovedEmployee, enabled: boolean) {
    if (!employee.employeeUid) {
      Alert.alert('Employee has not joined yet', 'AI can be controlled after the employee signs in and claims the invite.', [
        { text: 'OK' }
      ]);
      return;
    }

    confirmTenantAiToggle({
      enabled,
      message: `AI will be disabled for ${employee.displayName || employee.phoneMasked}. Other employees remain unchanged.`,
      onConfirm: () => {
        void saveTenantAiPolicy((idToken) =>
          updateTenantAiEmployeePolicy({
            employeeUid: employee.employeeUid as string,
            enabled,
            idToken
          })
        );
      },
      title: `Disable AI for ${employee.displayName || 'employee'}?`
    });
  }

  async function refreshOfflineChatMetrics() {
    const scope = getLocalChatScope();

    try {
      const [cacheSizeBytes, queueItems] = await Promise.all([
        getChatMediaCacheSizeBytes(),
        listLocalChatMediaTransferQueue(scope).catch(() => [])
      ]);
      const metrics = await updateChatOfflineGaugeMetrics(scope, {
        cacheSizeBytes,
        mediaQueueDepth: queueItems.length
      });

      setChatOfflineMetrics(metrics);
    } catch {
      const metrics = await loadChatOfflineMetrics(scope).catch(() => createEmptyChatOfflineMetricsSnapshot());
      setChatOfflineMetrics(metrics);
    }
  }

  async function handleUpdateOfflineChatPolicy(
    patch: Partial<Omit<ChatOfflinePolicySettings, 'updatedAt' | 'version'>>
  ) {
    if (!canManageSecurity || isSavingOfflineChatSettings) {
      return;
    }

    setIsSavingOfflineChatSettings(true);
    setError(null);

    try {
      const scope = getLocalChatScope();
      const nextSettings = {
        ...chatOfflinePolicySettingsRef.current,
        ...patch
      };
      const idToken = await getIdToken();
      const remoteSettings = await updateTenantChatOfflinePolicy({
        cacheRetentionDays: nextSettings.cacheRetentionDays,
        fullMediaCacheBudgetBytes: nextSettings.fullMediaCacheBudgetBytes,
        idToken,
        mediaLimitBytes: nextSettings.mediaLimitBytes,
        offlineMediaCacheAllowed: nextSettings.offlineMediaCacheAllowed,
        purgeOnSignOut: nextSettings.purgeOnSignOut,
        wifiOnlyMediaPrefetch: nextSettings.wifiOnlyMediaPrefetch
      });
      const settings = await saveChatOfflinePolicySettings(scope, remoteSettings);

      setChatOfflinePolicySettings(settings);
      await refreshOfflineChatMetrics();
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to save offline chat settings.'));
    } finally {
      setIsSavingOfflineChatSettings(false);
    }
  }

  async function handleResetOfflineChatMetrics() {
    if (!canManageSecurity) {
      return;
    }

    try {
      const metrics = await resetChatOfflineMetrics(getLocalChatScope());
      setChatOfflineMetrics(metrics);
      await refreshOfflineChatMetrics();
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to reset offline chat metrics.'));
    }
  }

  async function handleDismissOrgAdminSetupCoach() {
    try {
      const state = await dismissGuidedSetupJourney(guidedSetupScope);
      setGuidedSetupJourneyState(state);
    } catch {
      setGuidedSetupJourneyState((currentState) => currentState
        ? { ...currentState, dismissedAt: new Date().toISOString(), status: 'dismissed' }
        : currentState);
    }
  }

  async function handleCompleteOrgAdminSetupCoach() {
    try {
      const state = await markGuidedSetupJourneyCompleted(guidedSetupScope);
      setGuidedSetupJourneyState(state);
    } catch {
      setGuidedSetupJourneyState((currentState) => currentState
        ? { ...currentState, completedAt: new Date().toISOString(), status: 'completed' }
        : currentState);
    }
  }

  function handleOrgAdminSetupCoachPrimaryAction(step: OrgAdminSetupCoachStep) {
    setError(null);

    if (step.id === 'department') {
      if (activeTab === 'Settings' && settingsScreen === 'directory' && directoryFilter === 'Departments') {
        handleOpenAddModal();
        return;
      }

      setActiveTab('Settings');
      setSettingsScreen('directory');
      setDirectoryFilter('Departments');
      void loadSettings();
      return;
    }

    if (step.id === 'role') {
      if (activeTab === 'Settings' && settingsScreen === 'directory' && directoryFilter === 'Roles') {
        handleOpenAddModal();
        return;
      }

      setActiveTab('Settings');
      setSettingsScreen('directory');
      setDirectoryFilter('Roles');
      void loadSettings();
      return;
    }

    if (step.id === 'employee') {
      if (activeTab !== 'Employees') {
        handleSelectFooterTab('Employees');
        void loadEmployees();
        return;
      }

      void handleInviteEmployee('manual');
      return;
    }

    if (step.id === 'group') {
      if (activeTab === 'Settings' && settingsScreen === 'groups') {
        void handleOpenAddGroupModal();
        return;
      }

      setActiveTab('Settings');
      setSettingsScreen('groups');
      void loadGroupSettings();
      return;
    }

    handleSelectFooterTab('Chats');
    void handleCompleteOrgAdminSetupCoach();
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

    if (!isValidCalendarYearStartDate(companyCalendarYearStartDateDraft)) {
      setError('Select the date your company calendar year starts.');
      return;
    }

    setError(null);
    setIsSavingCompanyProfile(true);

    try {
      const idToken = await getIdToken();
      const profile = await updateCompanyProfile({
        calendarYearStartDate: companyCalendarYearStartDateDraft,
        companyAddress,
        companyName,
        idToken
      });

      setCompanyProfile(profile);
      setCompanyNameDraft(profile.companyName);
      setCompanyAddressDraft(profile.companyAddress);
      setCompanyCalendarYearStartDateDraft(profile.calendarYearStartDate);
      Alert.alert('Company profile updated', 'Your company profile has been saved.');
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to update company profile.'));
    } finally {
      setIsSavingCompanyProfile(false);
    }
  }

  async function handleSaveKeyResults() {
    if (isSavingKeyResults || !canManageCompanyProfile) {
      return;
    }

    setError(null);
    setIsSavingKeyResults(true);

    try {
      const idToken = await getIdToken();
      const keyResults = await updateCompanyKeyResults({
        idToken,
        keyResults: normalizeKeyResultsForDraft(companyKeyResults)
      });

      setCompanyKeyResults(normalizeKeyResultsForDraft(keyResults));
      Alert.alert('Key results saved', 'Your company key results setup has been saved.');
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to save key results.'));
    } finally {
      setIsSavingKeyResults(false);
    }
  }

  async function persistKeyResultsDelete(
    nextConfig: CompanyKeyResultsConfig,
    previousConfig: CompanyKeyResultsConfig,
    failureMessage: string,
    previousDrafts?: Record<string, { key: string; unitId: string; value: string }>
  ) {
    setError(null);
    setIsSavingKeyResults(true);

    try {
      const idToken = await getIdToken();
      const keyResults = await updateCompanyKeyResults({
        idToken,
        keyResults: normalizeKeyResultsForDraft(nextConfig)
      });

      setCompanyKeyResults(normalizeKeyResultsForDraft(keyResults));
    } catch (nextError) {
      setCompanyKeyResults(previousConfig);

      if (previousDrafts) {
        setKeyResultMetricDrafts(previousDrafts);
      }

      setError(getErrorMessage(nextError, failureMessage));
    } finally {
      setIsSavingKeyResults(false);
    }
  }

  function handleAddKeyResultUnit() {
    const label = keyResultUnitLabelDraft.trim();

    if (!label) {
      setError('Enter a unit name.');
      return;
    }

    const unit: KeyResultUnit = {
      icon: keyResultUnitIconDraft,
      label,
      sortOrder: (companyKeyResults.units.length + 1) * 1000,
      status: 'ACTIVE',
      suffix: keyResultUnitSuffixDraft.trim(),
      unitId: createKeyResultLocalId('unit')
    };

    setCompanyKeyResults((current) => ({
      ...current,
      units: [...current.units, unit]
    }));
    setKeyResultUnitLabelDraft('');
    setKeyResultUnitSuffixDraft('');
    setKeyResultUnitIconDraft('hash');
    setError(null);
  }

  function handleDeleteKeyResultUnit(unitId: string) {
    if (isSavingKeyResults) {
      return;
    }

    const previousConfig = normalizeKeyResultsForDraft(companyKeyResults);
    const previousDrafts = keyResultMetricDrafts;
    const fallbackUnitId = previousConfig.units.find((unit) => unit.unitId !== unitId)?.unitId || 'unit_number';
    const nextConfig: CompanyKeyResultsConfig = {
      ...previousConfig,
      groups: previousConfig.groups.map((group) => ({
        ...group,
        metrics: group.metrics.map((metric) => (
          metric.unitId === unitId ? { ...metric, unitId: fallbackUnitId } : metric
        ))
      })),
      units: previousConfig.units.filter((unit) => unit.unitId !== unitId)
    };

    setCompanyKeyResults(nextConfig);
    setKeyResultMetricDrafts((current) => Object.fromEntries(
      Object.entries(current).map(([groupId, draft]) => [
        groupId,
        draft.unitId === unitId ? { ...draft, unitId: fallbackUnitId } : draft
      ])
    ));
    void persistKeyResultsDelete(nextConfig, previousConfig, 'Unable to delete this value unit.', previousDrafts);
  }

  function handleAddKeyResultGroup() {
    const name = keyResultGroupNameDraft.trim();

    if (!name) {
      setError('Enter a key result group name.');
      return;
    }

    const groupId = createKeyResultLocalId('group');
    const fallbackUnitId = companyKeyResults.units[0]?.unitId || 'unit_number';

    setCompanyKeyResults((current) => ({
      ...current,
      groups: [
        ...current.groups,
        {
          groupId,
          metrics: [],
          name,
          sortOrder: (current.groups.length + 1) * 1000,
          status: 'ACTIVE'
        }
      ]
    }));
    setKeyResultMetricDrafts((current) => ({
      ...current,
      [groupId]: { key: '', unitId: fallbackUnitId, value: '' }
    }));
    setKeyResultGroupNameDraft('');
    setError(null);
  }

  function handleUpdateKeyResultGroup(groupId: string, patch: Partial<KeyResultGroup>) {
    setCompanyKeyResults((current) => ({
      ...current,
      groups: current.groups.map((group) => (
        group.groupId === groupId ? { ...group, ...patch } : group
      ))
    }));
  }

  function handleDeleteKeyResultGroup(groupId: string) {
    if (isSavingKeyResults) {
      return;
    }

    const previousConfig = normalizeKeyResultsForDraft(companyKeyResults);
    const previousDrafts = keyResultMetricDrafts;
    const nextConfig: CompanyKeyResultsConfig = {
      ...previousConfig,
      groups: previousConfig.groups.filter((group) => group.groupId !== groupId)
    };
    const nextDrafts = { ...previousDrafts };
    delete nextDrafts[groupId];

    setCompanyKeyResults(nextConfig);
    setKeyResultMetricDrafts(nextDrafts);
    void persistKeyResultsDelete(nextConfig, previousConfig, 'Unable to delete this key result name.', previousDrafts);
  }

  function handleAddKeyResultMetric(groupId: string) {
    const draft = keyResultMetricDrafts[groupId] || {
      key: '',
      unitId: companyKeyResults.units[0]?.unitId || 'unit_number',
      value: ''
    };
    const key = draft.key.trim();
    const value = draft.value.trim();

    if (!key || !value) {
      setError('Enter both the key name and value.');
      return;
    }

    setCompanyKeyResults((current) => ({
      ...current,
      groups: current.groups.map((group) => (
        group.groupId === groupId
          ? {
              ...group,
              metrics: [
                ...group.metrics,
                {
                  key,
                  metricId: createKeyResultLocalId('metric'),
                  sortOrder: (group.metrics.length + 1) * 1000,
                  status: 'ACTIVE',
                  unitId: draft.unitId,
                  value
                }
              ]
            }
          : group
      ))
    }));
    setKeyResultMetricDrafts((current) => ({
      ...current,
      [groupId]: {
        key: '',
        unitId: draft.unitId,
        value: ''
      }
    }));
    setError(null);
  }

  function handleUpdateKeyResultMetric(groupId: string, metricId: string, patch: Partial<KeyResultMetric>) {
    setCompanyKeyResults((current) => ({
      ...current,
      groups: current.groups.map((group) => (
        group.groupId === groupId
          ? {
              ...group,
              metrics: group.metrics.map((metric) => (
                metric.metricId === metricId ? { ...metric, ...patch } : metric
              ))
            }
          : group
      ))
    }));
  }

  function handleDeleteKeyResultMetric(groupId: string, metricId: string) {
    if (isSavingKeyResults) {
      return;
    }

    const previousConfig = normalizeKeyResultsForDraft(companyKeyResults);
    const nextConfig: CompanyKeyResultsConfig = {
      ...previousConfig,
      groups: previousConfig.groups.map((group) => (
        group.groupId === groupId
          ? {
              ...group,
              metrics: group.metrics.filter((metric) => metric.metricId !== metricId)
            }
          : group
      ))
    };

    setCompanyKeyResults(nextConfig);
    void persistKeyResultsDelete(nextConfig, previousConfig, 'Unable to delete this key result item.');
  }

  function handleUpdateKeyResultMetricDraft(
    groupId: string,
    patch: Partial<{ key: string; unitId: string; value: string }>
  ) {
    const fallbackDraft = {
      key: '',
      unitId: companyKeyResults.units[0]?.unitId || 'unit_number',
      value: ''
    };

    setKeyResultMetricDrafts((current) => ({
      ...current,
      [groupId]: {
        ...fallbackDraft,
        ...current[groupId],
        ...patch
      }
    }));
  }

  async function handleSelectKeyResultUnitForDraft(groupId: string) {
    const selectedUnit = await selectScreenOption(
      'Select unit',
      companyKeyResults.units,
      (unit) => `${unit.label}${unit.suffix ? ` (${unit.suffix})` : ''}`
    );

    if (selectedUnit) {
      handleUpdateKeyResultMetricDraft(groupId, { unitId: selectedUnit.unitId });
    }
  }

  async function handleSelectKeyResultUnitForMetric(groupId: string, metricId: string) {
    const selectedUnit = await selectScreenOption(
      'Select unit',
      companyKeyResults.units,
      (unit) => `${unit.label}${unit.suffix ? ` (${unit.suffix})` : ''}`
    );

    if (selectedUnit) {
      handleUpdateKeyResultMetric(groupId, metricId, { unitId: selectedUnit.unitId });
    }
  }

  function handleSelectCompanyCalendarYearStartDate() {
    if (!canManageCompanyProfile) {
      return;
    }

    const selectedDate = parseCalendarYearStartDate(companyCalendarYearStartDateDraft) || new Date();
    setCompanyCalendarYearPickerDate(selectedDate);

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        display: 'calendar',
        maximumDate: calendarYearMaximumDate,
        minimumDate: calendarYearMinimumDate,
        mode: 'date',
        onChange: (event, nextDate) => {
          if (event.type === 'set' && nextDate) {
            setCompanyCalendarYearStartDateDraft(formatCalendarYearStartDateInput(nextDate));
          }
        },
        value: selectedDate
      });
      return;
    }

    setIsCompanyCalendarYearPickerOpen(true);
  }

  function handleConfirmCompanyCalendarYearStartDate() {
    setCompanyCalendarYearStartDateDraft(formatCalendarYearStartDateInput(companyCalendarYearPickerDate));
    setIsCompanyCalendarYearPickerOpen(false);
  }

  function handleOpenDeleteOrganization() {
    if (!canDeleteOrganization) {
      Alert.alert('Owner access required', 'Only the organization owner can delete this organization.');
      return;
    }

    setOrganizationDeletionConfirmation(null);
    setOrganizationDeletionModal({
      challenge: null,
      confirmationText: '',
      error: null,
      otpCode: '',
      step: 'warning',
      verifiedIdToken: null
    });
  }

  async function handleOpenSettingsOptions() {
    const options = [
      ...(canDeleteOrganization
        ? [{ id: 'delete-organization', label: 'Delete Organization' }]
        : [])
    ];

    if (!options.length) {
      Alert.alert('Settings options', 'No additional settings actions are available for this account yet.');
      return;
    }

    const selectedOption = await selectScreenOption(
      'Settings options',
      options,
      (option) => option.label
    );

    if (selectedOption?.id === 'delete-organization') {
      handleOpenDeleteOrganization();
    }
  }

  async function handleOpenEmployeeOptions() {
    if (!canInviteEmployees) {
      Alert.alert('Employee options', 'No employee import actions are available for this account.');
      return;
    }

    if (isInvitingEmployees || isPickingInviteContact) {
      return;
    }

    if (inviteDraft) {
      Alert.alert('Employee invite', 'Finish or cancel the current invite before starting another one.');
      return;
    }

    const selectedOption = await selectScreenOption(
      'Employee options',
      [
        { id: 'manual', label: 'Add by phone number' },
        { id: 'contact', label: 'Add from contacts' },
        { id: 'batch', label: 'Batch import contacts' }
      ],
      (option) => option.label
    );

    if (selectedOption?.id === 'manual') {
      void handleInviteEmployee('manual');
      return;
    }

    if (selectedOption?.id === 'contact') {
      void handleInviteEmployee('single');
      return;
    }

    if (selectedOption?.id === 'batch') {
      void handleInviteEmployee('batch');
    }
  }

  function updateOrganizationDeletionModal(patch: Partial<OrganizationDeletionModalState>) {
    setOrganizationDeletionModal((currentState) => (
      currentState ? { ...currentState, ...patch } : currentState
    ));
  }

  async function handleSendOrganizationDeletionOtp() {
    if (!organizationDeletionModal || isRequestingOrganizationDeletion) {
      return;
    }

    try {
      setIsRequestingOrganizationDeletion(true);
      updateOrganizationDeletionModal({ error: null });

      const idToken = await verifiedAdmin.firebaseUser.getIdToken(true);
      const challenge = await requestOrganizationDeletionChallenge(idToken);
      const confirmation = await sendReauthenticationPhoneCode(
        verifiedAdmin.firebaseUser,
        verifiedAdmin.phoneNumber
      );

      setOrganizationDeletionConfirmation(confirmation);
      setOrganizationDeletionModal({
        challenge,
        confirmationText: '',
        error: null,
        otpCode: '',
        step: 'otp',
        verifiedIdToken: null
      });
    } catch (nextError) {
      updateOrganizationDeletionModal({
        error: getErrorMessage(nextError, 'Unable to send the verification code.')
      });
    } finally {
      setIsRequestingOrganizationDeletion(false);
    }
  }

  async function handleVerifyOrganizationDeletionOtp() {
    if (
      !organizationDeletionModal?.challenge ||
      !organizationDeletionConfirmation ||
      isVerifyingOrganizationDeletionOtp
    ) {
      return;
    }

    if (organizationDeletionModal.otpCode.trim().length < 4) {
      updateOrganizationDeletionModal({ error: 'Enter the verification code sent to your phone.' });
      return;
    }

    if (
      normalizeOrganizationDeletionConfirmation(organizationDeletionModal.confirmationText) !==
      normalizeOrganizationDeletionConfirmation(organizationDeletionModal.challenge.requiredConfirmation)
    ) {
      updateOrganizationDeletionModal({
        error: `Type ${organizationDeletionModal.challenge.requiredConfirmation} to confirm.`
      });
      return;
    }

    try {
      setIsVerifyingOrganizationDeletionOtp(true);
      updateOrganizationDeletionModal({ error: null });
      await organizationDeletionConfirmation.confirm(organizationDeletionModal.otpCode.trim());
      const verifiedIdToken = await verifiedAdmin.firebaseUser.getIdToken(true);

      updateOrganizationDeletionModal({
        step: 'verified',
        verifiedIdToken
      });
    } catch (nextError) {
      updateOrganizationDeletionModal({
        error: getErrorMessage(nextError, 'The verification code could not be confirmed.')
      });
    } finally {
      setIsVerifyingOrganizationDeletionOtp(false);
    }
  }

  async function handleProceedOrganizationDeletion() {
    if (
      !organizationDeletionModal?.challenge ||
      !organizationDeletionModal.verifiedIdToken ||
      isDeletingOrganization
    ) {
      return;
    }

    try {
      setIsDeletingOrganization(true);
      updateOrganizationDeletionModal({
        error: null,
        step: 'deleting'
      });

      await confirmOrganizationDeletion({
        challengeId: organizationDeletionModal.challenge.challengeId,
        confirmationText: organizationDeletionModal.confirmationText,
        idToken: organizationDeletionModal.verifiedIdToken
      });
      await purgeTenantCompanyData({
        ...getLocalChatScope(),
        clearBackupRecoveryKey: true,
        clearDeviceIdentity: true,
        reason: 'organization-deleted'
      });
      // In-flight transfer progress is tenant data too, so it goes with the wipe.
      clearAllMediaTransferProgress();
      clearAllChatThreads();
      await clearCompanyDataSessionScope();
      setOrganizationDeletionModal(null);
      setOrganizationDeletionConfirmation(null);

      Alert.alert(
        'Organization deleted',
        'The organization and its tenant data have been deleted. You will be returned to the login screen.',
        [
          {
            text: 'OK',
            onPress: () => {
              void signOutOrgAdmin()
                .catch(() => undefined)
                .finally(onOrganizationDeleted);
            }
          }
        ]
      );
    } catch (nextError) {
      updateOrganizationDeletionModal({
        error: getErrorMessage(nextError, 'Unable to delete this organization.'),
        step: 'verified'
      });
    } finally {
      setIsDeletingOrganization(false);
    }
  }

  function handleRequestSignOut() {
    if (isSigningOut) {
      return;
    }

    Alert.alert(
      'Sign out of Synzapp?',
      'This will end your session on this device. You can sign back in with your verified phone number.',
      [
        {
          style: 'cancel',
          text: 'Cancel'
        },
        {
          onPress: () => {
            void handleConfirmSignOut();
          },
          style: 'destructive',
          text: 'Sign out'
        }
      ]
    );
  }

  async function handleConfirmSignOut() {
    if (isSigningOut) {
      return;
    }

    try {
      setIsSigningOut(true);
      setError(null);

      // Normal sign-out is not company offboarding. Keep the user-scoped device
      // identity so the same employee can sign back in without losing E2EE continuity.
      if (chatOfflinePolicySettingsRef.current.purgeOnSignOut) {
        await purgeTenantCompanyData({
          ...getLocalChatScope(),
          reason: 'sign-out'
        });
      }
      clearAllMediaTransferProgress();
      clearAllChatThreads();
      await clearCompanyDataSessionScope();
      clearRegisteredDeviceIdentityCache();
      await signOutOrgAdmin();
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Synzapp could not sign you out. Please try again.'));
    } finally {
      setIsSigningOut(false);
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

    const options = getEmployeeActionOptions(employee, currentUid);

    if (!options.length) {
      Alert.alert('Employee actions', 'No lifecycle actions are available for this employee.');
      return;
    }

    if (Platform.OS === 'ios') {
      const destructiveButtonIndex = options.findIndex((option) => isDestructiveEmployeeAction(option.action));

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
          style: isDestructiveEmployeeAction(option.action) ? 'destructive' as const : 'default' as const,
          text: option.label
        })),
        {
          style: 'cancel' as const,
          text: 'Cancel'
        }
      ]
    );
  }

  function handleReactivateDeletedEmployee(employee: EmployeeListItem) {
    const option = getEmployeeActionOptions(employee).find((employeeOption) =>
      employeeOption.action === 'REACTIVATE'
    );

    if (option) {
      confirmEmployeeLifecycleAction(employee, option);
    }
  }

  function handlePermanentlyRemoveDeletedEmployee(employee: EmployeeListItem) {
    const targetAction: EmployeeAction = employee.statusValue.toUpperCase() === 'INVITED'
      ? 'REMOVE_INVITE'
      : 'PERMANENT_DELETE';
    const option = getEmployeeActionOptions(employee).find((employeeOption) =>
      employeeOption.action === targetAction
    );

    if (option) {
      confirmEmployeeLifecycleAction(employee, option);
    }
  }

  function confirmEmployeeLifecycleAction(
    employee: EmployeeListItem,
    option: EmployeeActionOption
  ) {
    if (option.action === 'CHANGE_ROLE') {
      void handleChangeEmployeeRole(employee);
      return;
    }

    if (option.action === 'REMOVE_ORG_ADMIN') {
      // Stepping down needs a role to land on, so the picker comes first.
      void handleRemoveOrgAdminAccess(employee, option);
      return;
    }

    if (option.action === 'ASSIGN_ORG_ADMIN') {
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
              void saveOrgAdminRole(employee, option, true);
            },
            style: isDestructiveEmployeeAction(option.action) ? 'destructive' : 'default',
            text: option.confirmButton
          }
        ]
      );
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
          style: isDestructiveEmployeeAction(option.action) ? 'destructive' : 'default',
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
        option.action === 'PERMANENT_DELETE' || option.action === 'REMOVE_INVITE'
          ? currentEmployees.filter((currentEmployee) => currentEmployee.approvedPhoneId !== employee.id)
          : sortApprovedEmployees(upsertApprovedEmployees(currentEmployees, [updatedEmployee]))
      );
      void loadChatContacts(false);
      Alert.alert(option.successTitle, option.successMessage(employee.name));
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to update employee access.'));
    } finally {
      setIsUpdatingEmployeeLifecycle(false);
    }
  }

  async function handleRemoveOrgAdminAccess(
    employee: EmployeeListItem,
    option: EmployeeActionOption
  ) {
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
        Alert.alert('Roles', 'Create at least one role before removing admin access.');
        return;
      }

      const selectedRole = await selectScreenOption(
        'Role after stepping down',
        activeRoles,
        (role) => role.name
      );

      if (!selectedRole) {
        return;
      }

      Alert.alert(
        option.confirmTitle,
        `${option.confirmMessage(employee.name)} They will be a ${selectedRole.name}.`,
        [
          {
            style: 'cancel',
            text: 'Cancel'
          },
          {
            onPress: () => {
              void saveOrgAdminRole(employee, option, false, selectedRole);
            },
            style: 'destructive',
            text: option.confirmButton
          }
        ]
      );
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to load roles.'));
    }
  }

  async function saveOrgAdminRole(
    employee: EmployeeListItem,
    option: EmployeeActionOption,
    grantOrgAdmin: boolean,
    role?: TenantRole
  ) {
    setError(null);
    setIsUpdatingEmployeeLifecycle(true);

    try {
      const idToken = await getIdToken();
      const updatedEmployee = await updateEmployeeOrgAdminRole({
        approvedPhoneId: employee.id,
        grantOrgAdmin,
        idToken,
        roleId: role?.roleId
      });

      setApprovedEmployees((currentEmployees) =>
        sortApprovedEmployees(upsertApprovedEmployees(currentEmployees, [updatedEmployee]))
      );
      void loadChatContacts(false);
      Alert.alert(option.successTitle, option.successMessage(employee.name));
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Unable to change admin access.'));
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
    setManualInviteDraftTarget(draft);
    setManualPhoneDraft('');
    setIsManualInviteModalOpen(true);
  }

  function handleChangeManualPhoneDraft(value: string) {
    setManualPhoneDraft(formatManualInvitePhoneNumberInput(value));
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
        'Enter a full phone number with country code, for example +1 (469) 555 4444.'
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

    if (!inviteDraft.inviteAsOrgAdmin) {
      await sendInviteDraft(inviteDraft);
      return;
    }

    // Handing somebody the access you hold yourself is confirmed before it is
    // sent, in words that say what they will be able to do. It used to happen
    // with no question asked at all, decided by a department's name.
    const confirmation = describeOrgAdminInviteConfirmation({
      contactCount: inviteDraft.contacts.length,
      departmentName: inviteDraft.department.name
    });
    const draftToSend = inviteDraft;

    Alert.alert(confirmation.title, confirmation.body, [
      { style: 'cancel', text: confirmation.cancelLabel },
      {
        onPress: () => {
          void sendInviteDraft(draftToSend);
        },
        style: 'destructive',
        text: confirmation.confirmLabel
      }
    ]);
  }

  async function sendInviteDraft(draft: InviteDraft) {
    setError(null);
    setIsInvitingEmployees(true);

    try {
      const idToken = await getIdToken();
      const invitedEmployees = await inviteEmployeeContacts({
        contacts: draft.contacts,
        departmentId: draft.department.departmentId,
        idToken,
        inviteAsOrgAdmin: Boolean(draft.inviteAsOrgAdmin),
        roleId: draft.role.roleId
      });
      const invitedPhoneDisplayByEmployeeId = buildInvitedEmployeePhoneDisplayMap(
        invitedEmployees,
        draft.contacts
      );

      setApprovedEmployees((currentEmployees) =>
        sortApprovedEmployees(upsertApprovedEmployees(currentEmployees, invitedEmployees))
      );
      if (Object.keys(invitedPhoneDisplayByEmployeeId).length) {
        setEmployeePhoneDisplayById((currentPhoneDisplayById) => ({
          ...currentPhoneDisplayById,
          ...invitedPhoneDisplayByEmployeeId
        }));
      }
      setInviteDraft(null);

      Alert.alert(
        invitedEmployees.length === 1 ? 'Employee invited' : 'Employees invited',
        invitedEmployees.length === 1
          ? `${getApprovedEmployeeDisplayLabel(
              invitedEmployees[0],
              invitedPhoneDisplayByEmployeeId[invitedEmployees[0].approvedPhoneId]
            )} is approved for ${draft.department.name}.`
          : `${invitedEmployees.length} employees are approved for ${draft.department.name}.`
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
    <View ref={guidedSetupScreenRef} style={[
      styles.screen,
      {
        // House rule: the whole page, headers included, is the grouped
        // background. Only rounded cards and the footer bar are white.
        backgroundColor: appTheme.colors.groupedBackground,
        paddingBottom: 0,
        paddingTop: shouldHideMainHeaderForInterpreter
          ? 0
          : isConversationSurfaceOpen
            ? messageTopPadding
            : headerTopPadding
      }
    ]}>
      {selectedChat && isMessageDeleteMode ? (
        <MessageDeleteSelectionHeader
          onCancel={resetMessageDeleteMode}
          selectedCount={selectedDeleteMessageCount}
          title={selectedChat.title}
        />
      ) : selectedChat && isForwardMode ? (
        <ForwardSelectionHeader
          isForwarding={isForwardingMessages}
          onCancel={resetForwardMode}
          onForward={handleOpenForwardRecipients}
          selectedCount={selectedForwardMessageCount}
          title={selectedChat.title}
        />
      ) : selectedChat && !isConversationSearchOpen ? (
        <MessageHeader
          chat={selectedChat}
          // The status bar's room. The card floats out of the layout, so it
          // never inherits the page's top padding and has to be told.
          topOffset={messageTopPadding}
          typingText={typingTextByConversation[selectedChat.contactId] || null}
          onlineCount={activeGroupOnlineCount}
          messageCount={uniqueChatMessages(messages).length}
          onBack={handleCloseChat}
          onOpenContactInfo={handleOpenContactInfo}
          onOpenGroupCallOptions={handleOpenGroupCallOptions}
          onOpenGroupInfo={handleOpenGroupInfo}
          onOpenGroupPeoplePicker={() => handleOpenGroupCallPeopleModal('select')}
          onStartVideoCall={() => {
            void handleStartDirectCall('video');
          }}
          onStartVoiceCall={() => {
            void handleStartDirectCall('voice');
          }}
          profilePhotoHeaders={profilePhotoHeaders}
        />
      ) : activeTab === 'Settings' && settingsScreen === 'directory' ? (
        <DirectoryHeader
          filter={directoryFilter}
          onAdd={handleOpenAddModal}
          onBack={() => setSettingsScreen('list')}
          onFilter={handleOpenFilter}
        />
      ) : activeTab === 'Settings' && settingsScreen === 'role-permissions' ? (
        <BackHeader onBack={() => setSettingsScreen('list')} />
      ) : activeTab === 'Settings' && settingsScreen === 'company-profile' ? (
        <BackHeader onBack={() => setSettingsScreen('list')} />
      ) : activeTab === 'Settings' && settingsScreen === 'key-results' ? (
        <BackHeader
          onBack={() => {
            setIsKeyResultsOptionsMenuOpen(false);
            setSettingsScreen('list');
          }}
          rightAccessory={
            <KeyResultsHeaderOptions
              isKeyboardVisible={isScreenKeyboardVisible}
              isOpen={isKeyResultsOptionsMenuOpen}
              onDismissKeyboard={() => Keyboard.dismiss()}
              onStartSelecting={() => {
                setIsKeyResultsOptionsMenuOpen(false);
                Keyboard.dismiss();
                setKeyResultsSelected({});
                setIsKeyResultsSelecting(true);
              }}
              onToggle={() => setIsKeyResultsOptionsMenuOpen((isOpen) => !isOpen)}
            />
          }
        />
      ) : activeTab === 'Settings' && settingsScreen === 'ai-usage' ? (
        <BackHeader onBack={() => setSettingsScreen('list')} />
      ) : activeTab === 'Settings' && settingsScreen === 'dept-admin-permissions' ? (
        <BackHeader onBack={() => setSettingsScreen('list')} />
      ) : activeTab === 'Settings' && settingsScreen === 'groups' ? (
        <BackHeader
          onBack={() => setSettingsScreen('list')}
          rightAccessory={
            <Pressable accessibilityRole="button" hitSlop={10} onPress={handleOpenAddGroupModal}>
              <Text style={[styles.headerLinkAction, { color: appTheme.colors.link }]}>Add</Text>
            </Pressable>
          }
        />
      ) : activeTab === 'Settings' && settingsScreen === 'security' ? (
        <BackHeader onBack={() => setSettingsScreen('list')} />
      ) : activeTab === 'Settings' && settingsScreen === 'action-reminders' ? (
        <BackHeader onBack={() => setSettingsScreen('list')} />
      ) : activeTab === 'Settings' && settingsScreen === 'scheduled-messages' ? (
        <BackHeader onBack={() => setSettingsScreen('list')} />
      ) : activeTab === 'Settings' && settingsScreen === 'admin-contact' ? (
        <BackHeader onBack={() => setSettingsScreen('list')} />
      ) : activeTab === 'Settings' && settingsScreen === 'my-devices' ? (
        <BackHeader onBack={() => setSettingsScreen('list')} />
      ) : activeTab === 'Settings' && settingsScreen === 'chat-backup' ? (
        <BackHeader onBack={() => setSettingsScreen('list')} />
      ) : activeTab === 'Settings' && settingsScreen === 'offline-chat' ? (
        <BackHeader onBack={() => setSettingsScreen('list')} />
      ) : activeTab === 'LSW' ? (
        <BackHeader
          onBack={() => handleSelectFooterTab('Chats')}
          rightAccessory={(
            <LswWorkspaceTabMenu
              activeTab={lswActiveTab}
              onSelectTab={setLswActiveTab}
            />
          )}
          title="Leaders Standard Work"
        />
      ) : activeTab === 'Chats' && isArchiveScreenOpen ? (
        <ArchiveHeader
          isEditMenuOpen={isArchiveEditMenuOpen}
          isSelectionMode={isArchiveSelectionMode}
          onBack={handleCloseArchivedScreen}
          onCloseEditMenu={() => setIsArchiveEditMenuOpen(false)}
          onDoneSelection={handleDoneArchiveSelection}
          onEditArchive={handleOpenArchiveSettings}
          onSelectChats={handleStartArchiveSelection}
          onToggleEditMenu={() => setIsArchiveEditMenuOpen((isOpen) => !isOpen)}
          selectedCount={selectedArchivedChatCount}
        />
      ) : activeTab === 'Chats' && isSpamScreenOpen ? (
        <SpamHeader
          isDeleting={isDeletingSpamChats}
          onBack={handleCloseSpamScreen}
          onDelete={handlePermanentDeleteAllSpamChats}
          spamCount={spamConversationChatItems.length}
        />
      ) : shouldHideMainHeaderForInterpreter ? null : (
	        <HeaderActions
	          activeTab={activeTab}
            onMeasureOptions={handleGuidedSetupTargetLayout('header-options')}
	          onOpenOptions={activeTab === 'Settings'
	            ? handleOpenSettingsOptions
	            : activeTab === 'Employees'
	              ? handleOpenEmployeeOptions
		              : activeTab === 'Calls'
		                ? handleToggleCallOptions
		                : activeTab === 'Actions'
		                  ? handleOpenActionsOptions
		                  : activeTab === 'Announcements' && canSendAnnouncements
		                    ? () => setIsNoticesOptionsOpen((isOpen) => !isOpen)
		                    : undefined}
			          onOpenMainNavigation={activeTab === 'Chats' ? handleOpenMainNavigation : undefined}
            onReturnToChats={activeTab === 'Library'
              ? handleCloseLibraryToChats
              : activeTab === 'Actions'
                ? handleCloseActionsToChats
                : undefined}
		          onOpenNewCall={handleOpenNewCallModal}
		          onOpenNewChat={handleOpenNewChatModal}
		          onOpenNewNotice={canSendAnnouncements && announcementAudiences.length
		            ? () => setIsNoticeComposeOpen(true)
		            : undefined}
		          rightAccessory={activeTab === 'Library' ? (
		            <CompanyLibraryHeaderActions
		              isLoading={isLoadingCompanyLibrary}
		              mode={companyLibraryViewMode}
		              onChangeMode={setCompanyLibraryViewMode}
		              onRefresh={() => {
		                void loadCompanyLibrary();
		              }}
		            />
		          ) : null}
		        />
      )}

      {!selectedChat &&
      activeTab !== 'You' &&
      activeTab !== 'LSW' &&
      !shouldHideMainHeaderForInterpreter &&
      !(activeTab === 'Chats' && (isSpamScreenOpen || isArchiveScreenOpen)) ? (
        <Text style={[styles.title, { color: appTheme.colors.ink }]}>
          {activeTab === 'Settings' && settingsScreen === 'directory'
            ? 'Departments and roles'
            : activeTab === 'Settings' && settingsScreen === 'role-permissions'
              ? 'Role permissions'
            : activeTab === 'Settings' && settingsScreen === 'company-profile'
              ? 'Company profile'
              : activeTab === 'Settings' && settingsScreen === 'key-results'
                ? 'Key results'
              : activeTab === 'Settings' && settingsScreen === 'ai-usage'
                ? 'AI usage and credits'
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
              : getFooterTabLabel(activeTab)}
        </Text>
      ) : null}

      {activeTab === 'Settings' && settingsScreen === 'directory' ? (
        <Text style={styles.directoryTitle}>{directoryFilter}</Text>
      ) : null}

      {heldMobileSeat && !selectedChat ? (
        <View style={styles.noticeWrap}>
          <MobileSeatNotice
            onMoveChatHere={() => {
              if (!heldMobileSeat.deviceId) {
                return;
              }

              promptToMoveChatToThisPhone(
                heldMobileSeat.deviceId,
                describeMobileSeatHolder(heldMobileSeat, Date.now())
              );
            }}
            seat={heldMobileSeat}
          />
        </View>
      ) : null}

      {error ? (
        <View style={styles.noticeWrap}>
          <DismissibleError message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      {selectedChat ? (
        <MessageThread
          actions={chatActions}
          // The header floats over the thread, so the thread owes it the room
          // back. Nothing is owed while the search header has replaced it.
          topInset={isConversationSearchOpen ? 0 : MESSAGE_HEADER_HEIGHT + 10}
          replyCounts={replyCounts}
          hasBannerAboveMessages={Boolean(pinnedChatAnnouncement)
            || actionCounts.pending > 0
            || actionCounts.unverified > 0}
          bannerAboveMessages={
            <>
              {pinnedChatAnnouncement ? (
                <ChatAnnouncementBanner
                  announcement={pinnedChatAnnouncement}
                  onOpen={() => openAnnouncement(pinnedChatAnnouncement)}
                  outstandingCount={outstandingAnnouncementCount}
                />
              ) : null}
              <ActionCountsBar
                pending={actionCounts.pending}
                unverified={actionCounts.unverified}
              />
            </>
          }
          bottomInset={conversationBottomInset}
          keyboardHeight={screenKeyboardHeight}
          keyboardVerticalOffset={conversationKeyboardVerticalOffset}
          canChat={selectedChat.hasActiveDevice && !activeTrashSegmentId}
          contactName={selectedChat.title}
          contactProfilePhotoUrl={selectedChat.profilePhotoUrl || null}
          currentUid={currentUid}
          draft={messageDraft}
          groupMembers={selectedChat.members || []}
          hasKnownMessages={hasChatKnownMessages(selectedChat)}
          isGroupChat={selectedChat.chatType === 'GROUP'}
          isCompactAndroid={isCompactAndroid}
          isDeleteMode={isMessageDeleteMode}
          isForwardMode={isForwardMode}
          isDeletingSelectedMessages={isDeletingSelectedMessages}
          isLoading={isLoadingMessages}
          isLoadingOlderMessages={isLoadingOlderCachedMessages}
          isSearchOpen={isConversationSearchOpen}
          isSending={isSendingMessage}
          messageReactions={messageReactions}
          messages={messages}
          profilePhotoHeaders={profilePhotoHeaders}
          readOnlyReason={activeTrashSegmentId ? 'This chat is in Trash' : undefined}
          onCancelReply={() => setReplyTarget(null)}
          onCopyMessage={(message) => {
            void handleCopyMessage(message);
          }}
          onDeleteMessage={handleDeleteMessageForMe}
          onDeleteSelectedMessages={handleConfirmDeleteSelectedMessages}
          onCancelScheduledMessage={handleCancelScheduledMessage}
          onDismissScheduledMessage={handleDismissScheduledMessage}
          onDraftChange={setMessageDraft}
          onTypingChange={handleTypingChange}
          onScheduleMessage={selectedChat.chatType === 'GROUP' ? undefined : handleScheduleMessage}
          onSendScheduledMessageNow={handleSendScheduledMessageNow}
          scheduledMessages={scheduledMessages}
          typingParticipants={typingByConversation[selectedChat.contactId] || EMPTY_TYPING_LIST}
          onInfoMessage={handleShowMessageInfo}
          onLoadOlderMessages={() => {
            void loadOlderCachedMessagesForActiveChat();
          }}
          onCloseSearch={handleCloseConversationSearch}
          onCreateAction={handleCreateActionFromMessage}
          onOpenAction={setOpenAction}
          onForwardActionMessage={handleForwardMessage}
          onForwardMessage={handleQuickForwardMessage}
          onOpenMedia={handleOpenMessageAttachment}
          onPrepareAttachment={handlePrepareAttachment}
          preparingVideoKey={preparingVideoKey}
          onReactMessage={handleReactToMessage}
          onMessageReply={handleReplyToMessage}
          onStarMessage={handleToggleMessageStar}
          onPickFile={() => {
            void handlePickChatFile();
          }}
          onPickMedia={handleOpenChatCamera}
          onPickMediaLibrary={() => {
            void handlePickChatMediaLibrary();
          }}
          onToggleForwardMessage={handleToggleForwardMessage}
          onToggleDeleteMessage={handleToggleDeleteMessage}
          onSend={() => {
            void handleSendMessage();
          }}
          onSendVoiceNote={(media) => {
            void handleSendVoiceNote(media);
          }}
          replyTarget={replyTarget}
          selectedForwardMessageIds={forwardSelectedMessageIds}
          selectedDeleteMessageIds={deleteSelectedMessageIds}
          selectedDeleteMessageCount={selectedDeleteMessageCount}
          starredMessageIds={starredMessageIds}
        />
      ) : activeTab === 'Interpreter' ? (
        <InterpreterScreen
          getIdToken={getIdToken}
          onBack={() => handleSelectFooterTab('Chats')}
          onRoomActiveChange={setIsInterpreterRoomOpen}
        />
      ) : activeTab === 'Chats' && !isArchiveScreenOpen && !isSpamScreenOpen ? (
        <View style={styles.fixedTabSurface}>
          <ChatsTab
            aboveChats={(
              <>
                {personalAnnouncements.length ? (
                  <ChatAnnouncementBanner
                    announcement={personalAnnouncements[0]}
                    onOpen={() => openAnnouncement(personalAnnouncements[0])}
                    outstandingCount={outstandingAnnouncementCount}
                  />
                ) : null}
                <ActionAttentionBanner
                  counts={myActionCounts}
                  onOpenActions={() => handleSelectFooterTab('Actions')}
                />
              </>
            )}
            activeFilter={chatListFilter}
            archivedBadgeCount={archivedBadgeCount}
            archivedCount={archivedChatFilterCount}
            chats={filteredChatItems}
            groupCount={groupChatFilterCount}
            isLoading={isLoadingChats}
            onChangeFilter={setChatListFilter}
            onArchiveChat={handleArchiveChat}
            onMoreChat={setChatMoreActionTarget}
            onToggleFavoriteChat={handleToggleFavoriteChat}
            onTogglePinChat={handleTogglePinChat}
            onOpenArchived={handleOpenArchivedScreen}
            onOpenChat={(chat) => {
              void handleOpenChat(chat);
            }}
            onOpenSpam={handleOpenSpamScreen}
            onSearchChange={setChatSearch}
            profilePhotoHeaders={profilePhotoHeaders}
            scheduledChatStates={scheduledChatStates}
            typingTextByConversation={typingTextByConversation}
            search={chatSearch}
            spamCount={spamConversationChatItems.length}
            unreadCount={unreadChatFilterCount}
          />
        </View>
      ) : activeTab === 'Calls' ? (
        <View style={styles.fixedTabSurface}>
          <CallsTab
            contacts={registeredCallContacts}
            favorites={callFavoriteContactIds}
            history={callHistory}
            isEditMode={isCallEditMode}
            onDeleteCall={handleDeleteCallHistoryEntry}
            onOpenFavorites={handleOpenCallFavoritesModal}
            onOpenKeypad={handleOpenCallKeypad}
            onOpenNewCall={handleOpenNewCallModal}
            onOpenSchedule={handleOpenScheduleCallModal}
            onSearchChange={setCallSearch}
            onStartCall={handleStartCallFromContact}
            profilePhotoHeaders={profilePhotoHeaders}
            search={callSearch}
            scheduledCount={scheduledCalls.length}
          />
        </View>
      ) : activeTab === 'Employees' ? (
        <View style={styles.fixedTabSurface}>
          <EmployeesTab
            canInviteEmployees={canInviteEmployees}
            canManageUsers={canManageUsers}
            departmentName={userProfile?.departmentName || null}
            employees={employeeItems}
            // A department admin's list is scoped to their own department and
            // never includes them, which is why an empty one is not the same
            // thing as a company with nobody in it.
            isDepartmentScoped={userProfile?.role === 'DEPT_ADMIN'}
            canOfferOrgAdmin={canOfferOrgAdmin}
            inviteDraft={inviteDraft}
            isLoading={isLoadingEmployees}
            isUpdatingLifecycle={isUpdatingEmployeeLifecycle}
            isPickingContact={isPickingInviteContact}
            isSavingInvite={isInvitingEmployees}
            onAddContact={() => {
              void handleAddContactToDraft();
            }}
            onCancelDraft={() => setInviteDraft(null)}
            onPermanentlyRemoveDeletedEmployee={handlePermanentlyRemoveDeletedEmployee}
            onReactivateDeletedEmployee={handleReactivateDeletedEmployee}
            onSendDraft={() => {
              void handleSendInviteDraft();
            }}
            onSelectEmployee={handleSelectEmployeeLifecycle}
            onToggleInviteOrgAdmin={(value) => {
              setInviteDraft((currentDraft) => (
                currentDraft ? { ...currentDraft, inviteAsOrgAdmin: value } : currentDraft
              ));
            }}
            profilePhotoHeaders={profilePhotoHeaders}
            viewerUid={currentUid}
          />
        </View>
      ) : activeTab === 'Actions' ? (
        <View style={styles.fixedTabSurface}>
          <ActionsTab
            getIdToken={getIdToken}
            isOptionsOpen={isActionsOptionsOpen}
            onCloseOptions={() => setIsActionsOptionsOpen(false)}
            onOpenAction={setOpenAction}
          />
        </View>
      ) : activeTab === 'Announcements' ? (
        <View style={styles.fixedTabSurface}>
          <AnnouncementsTab
            audienceOptions={announcementAudiences}
            canSend={canSendAnnouncements}
            currentUid={currentUid}
            departmentBackedGroups={departmentBackedGroups}
            getIdToken={getAnnouncementIdToken}
            isComposeOpen={isNoticeComposeOpen}
            onChangeComposeOpen={setIsNoticeComposeOpen}
            peopleDepartments={peopleDepartments}
            view={noticesView}
          />
        </View>
      ) : activeTab === 'Library' ? (
        <View style={styles.fixedTabSurface}>
          <CompanyLibraryTab
            currentUid={currentUid}
            departmentName={userProfile?.departmentName || ''}
            fileHeaders={companyLibraryFileHeaders}
            groups={groups}
            isLoading={isLoadingCompanyLibrary}
            items={companyLibraryItems}
            onOpenPreview={(item) => {
              void handleOpenCompanyLibraryItem(item);
            }}
            onRefresh={() => {
              void loadCompanyLibrary();
            }}
            onSearchChange={setCompanyLibrarySearch}
            search={companyLibrarySearch}
            viewMode={companyLibraryViewMode}
          />
        </View>
      ) : activeTab === 'LSW' ? (
        <View style={styles.fixedTabSurface}>
          <LswWorkspaceScreen
            activeTab={lswActiveTab}
            context={lswContext}
            dailyTasks={lswDailyTasks}
            errorMessage={lswWorkspaceError}
            followUpFilter={lswFollowUpFilter}
            followUps={lswFollowUps}
            isLoading={isLoadingLswWorkspace}
            isRefreshing={isRefreshingLswWorkspace}
            onAddDailyTask={() => {
              void handleAddLswDailyTask();
            }}
            onAddFollowUp={() => {
              void handleAddLswFollowUp();
            }}
            onAddTodo={() => {
              void handleAddLswTodoTask();
            }}
            onEditFollowUp={(followUp) => {
              void handleEditLswFollowUp(followUp);
            }}
            onEditTodo={(task) => {
              void handleEditLswTodoTask(task);
            }}
            onEditDailyTask={(task) => {
              void handleEditLswDailyTaskSchedule(task);
            }}
            onDeleteDailyTask={(task) => {
              void handleDeleteLswDailyTask(task);
            }}
            onCurrentWeek={handleOpenCurrentLswWeek}
            onRefreshSection={() => handleRefreshLswCurrentSelection()}
            onSelectTab={setLswActiveTab}
            onWeekOffset={handleLswWeekOffset}
            onToggleDailyTaskDay={(task, dayKey) => {
              void handleToggleLswDailyTaskDay(task, dayKey);
            }}
            onToggleTodo={(task) => {
              void handleToggleLswTodoTask(task);
            }}
            onUpdateTodoFilter={setLswTodoFilter}
            onUpdateFollowUpFilter={setLswFollowUpFilter}
            savingRecordId={lswSavingRecordId}
            todoFilter={lswTodoFilter}
            todoTasks={lswTodoTasks}
          />
        </View>
      ) : (
        <ScrollView
          alwaysBounceVertical={false}
          bounces={false}
          contentContainerStyle={[
            styles.tabContent,
            { paddingBottom: tabContentBottomPadding },
            // Settings is built from cards that carry their own 15, so it opts
            // out of the list padding the other tabs need.
            (activeTab === 'Settings' || activeTab === 'You') && styles.groupedTabContent
          ]}
          keyboardDismissMode={getKeyboardDismissMode()}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => {
            setIsKeyResultsOptionsMenuOpen(false);
          }}
          scrollEnabled={activeTab === 'Settings' && settingsScreen === 'key-results'
            ? isKeyResultsContentScrollEnabled
            : true}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          style={styles.tabScroll}
        >
          {activeTab === 'Chats' ? (
            isArchiveScreenOpen ? (
              <ArchivedChatsScreen
                archiveSettings={chatArchiveSettings}
                chats={filteredArchivedChatItems}
                isLoading={isLoadingChats}
                isLoadingSettings={isLoadingArchiveSettings}
                isSelectionMode={isArchiveSelectionMode}
                onArchiveChat={handleArchiveChat}
                onDeleteSelected={handleDeleteSelectedArchivedChats}
                onMarkSelectedRead={() => {
                  void handleReadSelectedArchivedChats();
                }}
                onMoreChat={setChatMoreActionTarget}
                onOpenChat={(chat) => {
                  void handleOpenChat(chat);
                }}
                onSearchChange={setChatSearch}
                onTogglePinChat={handleTogglePinChat}
                onToggleFavoriteChat={handleToggleFavoriteChat}
                onToggleSelection={toggleArchivedChatSelection}
                onUnarchiveSelected={() => {
                  void handleUnarchiveSelectedChats();
                }}
                profilePhotoHeaders={profilePhotoHeaders}
                search={chatSearch}
                selectedChatIds={selectedArchivedChatIds}
              />
            ) : isSpamScreenOpen ? (
              <SpamChatsScreen
                chats={filteredSpamChatItems}
                isDeleting={isDeletingSpamChats}
                isLoading={isLoadingChats}
                onDelete={handlePermanentDeleteSpamChat}
                onOpenChat={handleOpenTrashChat}
                onSearchChange={setChatSearch}
                profilePhotoHeaders={profilePhotoHeaders}
                search={chatSearch}
              />
            ) : null
          ) : null}

          {activeTab === 'Settings' && settingsScreen === 'list' ? (
            <SettingsList
              canManageCompanyProfile={canManageCompanyProfile}
              canManageDirectory={canManageDirectory}
              canManageGroups={canManageGroups}
              canManageAiUsage={canManageAiUsage}
              canManageSecurity={canManageSecurity}
              canManageUsers={canManageUsers}
              onOpenAppearance={() => setIsThemePreferenceModalOpen(true)}
              onOpenChatBackup={handleOpenChatBackupSettings}
              onOpenCompanyProfile={handleOpenCompanyProfileSettings}
              onOpenDepartmentAdminPermissions={handleOpenDepartmentAdminPermissions}
              onOpenDepartmentsAndRoles={handleOpenDirectorySettings}
              onOpenGroups={handleOpenGroupsSettings}
              onOpenAiUsage={handleOpenAiUsageSettings}
              onOpenKeyResults={handleOpenKeyResultsSettings}
              onOpenMyDevices={handleOpenMyDevicesSettings}
              onOpenOfflineChat={handleOpenOfflineChatSettings}
              onOpenRolePermissions={handleOpenRolePermissions}
              onOpenActionReminders={handleOpenActionRemindersSettings}
          onOpenAdminContact={handleOpenAdminContactSettings}
          onOpenScheduledMessages={handleOpenScheduledMessagesSettings}
          onOpenSecurity={handleOpenSecuritySettings}
              themePreference={appTheme.preference}
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
              calendarYearStartDate={companyCalendarYearStartDateDraft}
              companyName={companyNameDraft}
              isLoading={isLoadingCompanyProfile}
              isSavingLogo={isSavingCompanyLogo}
              isSaving={isSavingCompanyProfile}
              onAddressChange={setCompanyAddressDraft}
              onCalendarYearStartDatePress={handleSelectCompanyCalendarYearStartDate}
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

          {activeTab === 'Settings' && settingsScreen === 'key-results' ? (
            <KeyResultsSettings
              isSelecting={isKeyResultsSelecting}
              onToggleSelected={(key, entry) => setKeyResultsSelected((current) => {
                const next = { ...current };

                if (next[key]) {
                  delete next[key];
                } else {
                  next[key] = entry;
                }

                return next;
              })}
              selected={keyResultsSelected}
              config={companyKeyResults}
              groupNameDraft={keyResultGroupNameDraft}
              isLoading={isLoadingKeyResults}
              isSaving={isSavingKeyResults}
              isKeyboardVisible={isScreenKeyboardVisible}
              isUnitModalOpen={isKeyResultUnitModalOpen}
              metricDrafts={keyResultMetricDrafts}
              onAddGroup={handleAddKeyResultGroup}
              onAddMetric={handleAddKeyResultMetric}
              onAddUnit={handleAddKeyResultUnit}
              onCloseUnitModal={() => setIsKeyResultUnitModalOpen(false)}
              onDeleteGroup={handleDeleteKeyResultGroup}
              onDeleteMetric={handleDeleteKeyResultMetric}
              onDeleteUnit={handleDeleteKeyResultUnit}
              onGroupNameDraftChange={setKeyResultGroupNameDraft}
              onSave={() => {
                void handleSaveKeyResults();
              }}
              onSwipeActive={handleKeyResultsSwipeActive}
              onSelectDraftUnit={(groupId) => {
                void handleSelectKeyResultUnitForDraft(groupId);
              }}
              onSelectMetricUnit={(groupId, metricId) => {
                void handleSelectKeyResultUnitForMetric(groupId, metricId);
              }}
              onUpdateGroup={handleUpdateKeyResultGroup}
              onUpdateMetric={handleUpdateKeyResultMetric}
              onUpdateMetricDraft={handleUpdateKeyResultMetricDraft}
              onUnitIconDraftChange={setKeyResultUnitIconDraft}
              onUnitLabelDraftChange={setKeyResultUnitLabelDraft}
              onUnitSuffixDraftChange={setKeyResultUnitSuffixDraft}
              unitIconDraft={keyResultUnitIconDraft}
              unitLabelDraft={keyResultUnitLabelDraft}
              unitSuffixDraft={keyResultUnitSuffixDraft}
            />
          ) : null}

          {activeTab === 'Settings' && settingsScreen === 'ai-usage' ? (
            <AiUsageCreditsSettings
              departments={departments}
              dashboard={tenantAiDashboard}
              employees={approvedEmployees}
              features={tenantAiFeatureCatalog}
              isLoading={isLoadingTenantAiUsage}
              isSaving={isSavingTenantAiPolicy}
              onRefresh={() => {
                void loadTenantAiUsage();
              }}
              onSaveBudget={handleSaveTenantAiBudget}
              onToggleCompany={handleToggleTenantCompanyAi}
              onToggleDepartment={handleToggleTenantAiDepartment}
              onToggleEmployee={handleToggleTenantAiEmployee}
              onToggleFeature={handleToggleTenantAiFeature}
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

          {activeTab === 'Settings' && settingsScreen === 'action-reminders' ? (
            <ActionRemindersSettings
              isLoading={isLoadingActionReminders}
              isSaving={isSavingActionReminders}
              onUpdate={handleUpdateActionReminderPolicy}
              policy={actionReminderPolicy}
            />
          ) : null}

          {activeTab === 'Settings' && settingsScreen === 'admin-contact' ? (
            <AdminContactSettings
              isLoading={isLoadingAdminContactPolicy}
              isSaving={isSavingAdminContactPolicy}
              onUpdate={handleUpdateAdminContactPolicy}
              policy={adminContactPolicy}
            />
          ) : null}

          {activeTab === 'Settings' && settingsScreen === 'scheduled-messages' ? (
            <ScheduledMessagesSettings
              isLoading={isLoadingTenantScheduledMessages}
              isSavingPolicy={isSavingScheduledMessagePolicy}
              onOpenWaitingMessages={() => setIsWaitingMessagesOpen(true)}
              onUpdatePolicy={handleUpdateScheduledMessagePolicy}
              policy={scheduledMessagePolicy}
              scheduledMessageCount={tenantScheduledMessages.length}
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
              backupError={chatBackupError}
              lastBackupAtMs={lastChatBackupAtMs}
              policy={chatBackupPolicy || DEFAULT_CHAT_BACKUP_POLICY}
              restoreRequestStatus={chatBackupRestoreStatus}
            />
          ) : null}

          {activeTab === 'Settings' && settingsScreen === 'offline-chat' ? (
            <OfflineChatSettings
              isLoading={isLoadingOfflineChatSettings}
              isSaving={isSavingOfflineChatSettings}
              metrics={chatOfflineMetrics}
              networkPolicy={chatMediaNetworkPolicy}
              onRefreshMetrics={() => {
                void refreshOfflineChatMetrics();
              }}
              onResetMetrics={() => {
                void handleResetOfflineChatMetrics();
              }}
              onUpdatePolicy={(patch) => {
                void handleUpdateOfflineChatPolicy(patch);
              }}
              settings={chatOfflinePolicySettings}
            />
          ) : null}

          {activeTab === 'You' ? (
            <YouTab
              isLoading={isLoadingUserProfile}
              isSavingPhoto={isSavingUserPhoto}
              isSigningOut={isSigningOut}
              onChangePhoto={() => {
                void handleUpdateUserProfilePhoto();
              }}
              onSignOut={handleRequestSignOut}
              profile={userProfile}
              profilePhotoHeaders={profilePhotoHeaders}
            />
          ) : null}
        </ScrollView>
      )}

      {activeTab === 'Settings' && settingsScreen === 'key-results' && isKeyResultsSelecting ? (
        <KeyResultsSelectionBar
          keyboardHeight={screenKeyboardHeight}
          onCancel={() => {
            setKeyResultsSelected({});
            setIsKeyResultsSelecting(false);
          }}
          onDelete={() => {
            const entries = Object.values(keyResultsSelected);

            // Metrics first: deleting a group and one of its rows together
            // must not try to remove a row from something already gone.
            for (const entry of entries) {
              if (entry.metricId) {
                handleDeleteKeyResultMetric(entry.groupId, entry.metricId);
              }
            }

            for (const entry of entries) {
              if (!entry.metricId) {
                handleDeleteKeyResultGroup(entry.groupId);
              }
            }

            setKeyResultsSelected({});
            setIsKeyResultsSelecting(false);
          }}
          selectedCount={Object.keys(keyResultsSelected).length}
        />
      ) : null}

      {shouldShowBottomNavigation ? (
        <View
          onLayout={(event) => setFooterBarWidth(event.nativeEvent.layout.width)}
          style={[
          styles.footer,
          {
            backgroundColor: appTheme.colors.footer,
            borderColor: appTheme.colors.border,
            borderRadius: isCompactAndroid ? 32 : 34,
            bottom: footerBottom,
            minHeight: footerHeight
          }
        ]}
      >
          {/* First, so every tab paints over it. */}
          <FooterTabIndicator
            activeIndex={visibleFooterTabs.indexOf(activeTab)}
            barWidth={footerBarWidth}
            horizontalPadding={FOOTER_BAR_HORIZONTAL_PADDING}
            radius={isCompactAndroid ? 29 : 31}
            tabCount={visibleFooterTabs.length}
          />
	        {visibleFooterTabs.map((tab) => (
	          <FooterTabButton
	            active={activeTab === tab}
	            badgeCount={tab === 'Chats'
	              ? unreadChatBadgeCount
	              : tab === 'Calls'
	                ? unseenCallCount
	                : tab === 'Announcements'
	                  ? announcementAttentionCount
	                  : 0}
	            key={tab}
	            minHeight={footerTabHeight}
            onLayout={getGuidedSetupFooterTargetKind(tab)
              ? handleGuidedSetupTargetLayout(getGuidedSetupFooterTargetKind(tab) as GuidedSetupTargetKind)
              : undefined}
            onPress={() => handleSelectFooterTab(tab)}
            profile={userProfile}
            profilePhotoHeaders={profilePhotoHeaders}
            tab={tab}
          />
        ))}
        </View>
      ) : null}

      <WaitingMessagesModal
        busyScheduledMessageId={busyTenantScheduledMessageId}
        isLoading={isLoadingTenantScheduledMessages}
        onClose={() => setIsWaitingMessagesOpen(false)}
        onStop={handleCancelTenantScheduledMessage}
        scheduledMessages={tenantScheduledMessages}
        visible={isWaitingMessagesOpen}
      />

      <RecoveryKeySheet
        onCancel={() => setIsRecoveryKeyPromptOpen(false)}
        onChangeRecoveryKey={setRecoveryKeyDraft}
        onConfirm={() => {
          setIsRecoveryKeyPromptOpen(false);
          void restoreChatBackupWithKey(recoveryKeyDraft.trim());
        }}
        recoveryKey={recoveryKeyDraft}
        visible={isRecoveryKeyPromptOpen}
      />

      <StopReasonSheet
        onCancel={() => setStopReasonTarget(null)}
        onChangeReason={setStopReasonDraft}
        onConfirm={() => {
          if (stopReasonTarget) {
            void cancelTenantScheduledMessageNow(stopReasonTarget, stopReasonDraft);
          }
        }}
        reason={stopReasonDraft}
        recipientName={stopReasonTarget?.recipientName || ''}
        senderName={stopReasonTarget?.senderName || ''}
        visible={Boolean(stopReasonTarget)}
      />

      <ChatCameraModal
        onCancel={() => setIsChatCameraOpen(false)}
        onCaptured={(captured) => void handleChatCameraCaptured(captured)}
        visible={isChatCameraOpen}
      />

      {shouldShowOrgAdminSetupCoach && activeOrgAdminSetupCoachStep ? (
        <GuidedSetupCoachOverlay
          bottomInset={Math.max(conversationBottomInset, 12)}
          footerTabs={visibleFooterTabs}
          isReduceMotionEnabled={isReduceMotionEnabled}
          onDismiss={() => {
            void handleDismissOrgAdminSetupCoach();
          }}
          onPrimaryAction={() => handleOrgAdminSetupCoachPrimaryAction(activeOrgAdminSetupCoachStep)}
          screenHeight={height}
          screenWidth={width}
          step={activeOrgAdminSetupCoachStep}
          targetRect={guidedSetupTargetRects[activeOrgAdminSetupCoachStep.targetKind] || null}
        />
      ) : null}

      <SynzappCallOverlay
        callState={shouldRenderSynzappCallOverlay(activeSynzappCall) ? activeSynzappCall : null}
        onAnswer={() => {
          void handleAnswerIncomingSynzappCall();
        }}
        onDecline={() => {
          void handleEndSynzappCall('declined');
        }}
        onEnd={() => {
          void handleEndSynzappCall('ended');
        }}
        onToggleMute={toggleSynzappCallMute}
        onToggleSpeaker={toggleSynzappCallSpeaker}
        onToggleVideo={toggleSynzappCallVideo}
        profilePhotoHeaders={profilePhotoHeaders}
      />

      <MediaReviewModal
        activeIndex={mediaReviewActiveIndex}
        caption={mediaReviewCaption}
        contactName={selectedChat?.title || ''}
        isSending={isSendingMediaReview}
        items={mediaReviewItems}
        onCancel={handleCancelMediaReview}
        onCaptionChange={handleUpdateMediaReviewCaption}
        onFlipItem={(index) => {
          void handleFlipMediaReviewItem(index);
        }}
        onQualityModeChange={setMediaReviewQualityMode}
        onRemoveItem={handleRemoveMediaReviewItem}
        onSelectIndex={handleSelectMediaReviewIndex}
        onSend={handleSendMediaReview}
        qualityMode={mediaReviewQualityMode}
      />

      <MediaViewerModal
        onClose={() => setMediaViewer(null)}
        onDelete={(message) => {
          setMediaViewer(null);
          handleDeleteMessageForMe(message);
        }}
        onEditPhoto={(media, message) => {
          handleOpenSentPhotoEditorFromViewer(media, message);
        }}
        onForward={(message) => {
          setMediaViewer(null);
          handleQuickForwardMessage(message);
        }}
        onInfo={(message) => {
          setMediaViewer(null);
          handleShowMessageInfo(message);
        }}
        onReply={(message) => {
          setMediaViewer(null);
          handleReplyToMessage(message);
        }}
        onShare={handleShareMediaAttachment}
        onStar={(message) => {
          setMediaViewer(null);
          handleToggleMessageStar(message);
        }}
        starred={mediaViewer ? Boolean(starredMessageIds[mediaViewer.sourceMessage.messageId]) : false}
        state={mediaViewer}
      />

      <PhotoEditorCrashBoundary
        onCrash={(message) => {
          setSentPhotoEditor(null);
          setError(message);
        }}
        resetKey={sentPhotoEditor?.displayUri || 'closed'}
      >
        {sentPhotoEditor ? (
          <SynzappPhotoEditor
            captionPlaceholder="Add a caption"
            fileName={sentPhotoEditor.fileName}
            height={sentPhotoEditor.height}
            isSending={isSendingSentPhotoEdit}
            onCancel={() => {
              if (!isSendingSentPhotoEdit) {
                setSentPhotoEditor(null);
              }
            }}
            onDone={(result) => void handleSendSentPhotoEdit(result)}
            showCaption
            sourceUri={sentPhotoEditor.displayUri}
            width={sentPhotoEditor.width}
          />
        ) : null}
      </PhotoEditorCrashBoundary>

      {openAction ? (
        <ActionDetailModal
          people={actionPeopleChoices}
          action={openAction}
          getIdToken={getAnnouncementIdToken}
          onChanged={handleActionChanged}
          onClose={() => setOpenAction(null)}
          visible
        />
      ) : null}

      {actionDraftMessage && selectedChat ? (
        <CreateActionModal
          groups={actionGroupChoices}
          isLoadingChoices={isLoadingGroups || isLoadingEmployees}
          isSaving={isCreatingAction}
          onClose={() => {
            if (!isCreatingAction) {
              setActionDraftMessage(null);
            }
          }}
          onCreate={(draft) => void handleSubmitAction(draft)}
          people={actionPeopleChoices}
          sourceChatName={selectedChat.title}
          sourceMessageText={getChatMessageTextPreview(actionDraftMessage) || ''}
          visible
        />
      ) : null}

      <AudioAttachmentPreviewModal
        state={audioAttachmentPreview}
        onClose={() => setAudioAttachmentPreview(null)}
      />

      <ForwardRecipientModal
        contacts={chatContacts}
        isForwarding={isForwardingMessages}
        isOpen={isForwardRecipientModalOpen}
        onCancel={handleCancelForwardRecipients}
        onConfirm={() => {
          void handleConfirmForwardMessages();
        }}
        onToggleRecipient={handleToggleForwardRecipient}
        profilePhotoHeaders={profilePhotoHeaders}
        selectedCount={selectedForwardRecipientCount}
        selectedRecipientIds={forwardRecipientIds}
      />

      <NewChatModal
        contacts={startableDirectChatContacts}
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

      <NoticesOptionsMenu
        isOpen={isNoticesOptionsOpen}
        // Just under the options button, which sits below the status bar the
        // page has already paid for.
        topOffset={headerTopPadding + 52}
        onChangeView={(nextView) => {
          setNoticesView(nextView);
          setIsNoticesOptionsOpen(false);
        }}
        onClose={() => setIsNoticesOptionsOpen(false)}
        view={noticesView}
      />

      <MainNavigationModal
        isOpen={isMainNavigationOpen}
        links={mainNavigationLinks}
        onClose={handleCloseMainNavigation}
        // Left off when that person is not somebody this account can start a
        // chat with, which leaves the row readable rather than broken.
        onOpenAdminChat={
          userProfile?.departmentAdmin && startableDirectChatContacts.some(
            (contact) => contact.contactId === userProfile.departmentAdmin?.contactId
          )
            ? handleOpenAdminChatFromMenu
            : undefined
        }
        onSelect={handleSelectMainNavigationLink}
        onSignOut={handleRequestSignOut}
        profile={userProfile}
        profilePhotoHeaders={profilePhotoHeaders}
      />

      <CompanyLibraryImagePreviewModal
        fileHeaders={companyLibraryFileHeaders}
        item={companyLibraryPreview}
        onClose={() => setCompanyLibraryPreview(null)}
      />

      <CompanyLibraryVideoPreviewModal
        fileHeaders={companyLibraryFileHeaders}
        item={companyLibraryVideoPreview}
        onClose={() => setCompanyLibraryVideoPreview(null)}
      />

	      <AddMembersModal
        contacts={startableDirectChatContacts}
        isOpen={isAddMembersModalOpen}
        onBack={handleReturnToNewChatModal}
        onNext={handleOpenGroupDetailsModal}
        onRemoveMember={handleRemoveNewGroupMember}
        onSearchChange={setAddMembersSearch}
        onToggleMember={handleToggleNewGroupMember}
        profilePhotoHeaders={profilePhotoHeaders}
        search={addMembersSearch}
        selectedMemberIds={selectedNewGroupMemberIds}
        selectedMembers={selectedNewGroupMembers}
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

      <GroupAddMembersModal
        contacts={activeGroupAddableContacts}
        isOpen={isGroupAddMembersModalOpen}
        isSaving={isSavingGroupAddMembers}
        onCancel={handleCloseGroupAddMembersModal}
        onConfirm={() => {
          void handleConfirmGroupAddMembers();
        }}
        onRemoveMember={handleRemoveGroupAddMember}
        onSearchChange={setGroupAddMembersSearch}
        onToggleMember={handleToggleGroupAddMember}
        profilePhotoHeaders={profilePhotoHeaders}
        search={groupAddMembersSearch}
        selectedCount={selectedGroupAddMemberCount}
        selectedMemberIds={selectedGroupAddMemberIds}
        selectedMembers={selectedGroupAddMembers}
      />

      <ContactInfoModal
        chat={selectedChat}
        commonGroups={getCommonGroupContactsForDirectChat(selectedChat, groupChatContacts)}
        contactDetails={activeDirectContactDetails}
        isOpen={isContactInfoModalOpen}
        notificationSettings={activeChatNotificationSettings}
        transcriptLanguage={activeDirectChatTranscriptLanguage}
        onAddToGroup={handleOpenAddToGroupModal}
        onClose={handleCloseContactInfo}
        onCreateGroup={handleStartCreateGroupWithContactInfo}
        onOpenContactDetails={handleOpenDirectContactDetails}
        onOpenGroup={handleOpenCommonGroupFromContactInfo}
        onOpenNotifications={handleOpenChatNotificationSettings}
        onOpenSearch={handleOpenConversationSearch}
        onOpenTranscriptLanguage={handleOpenChatTranscriptLanguage}
        onStartVideoCall={() => {
          void handleStartDirectCall('video');
        }}
        onStartVoiceCall={() => {
          void handleStartDirectCall('voice');
        }}
        profilePhotoHeaders={profilePhotoHeaders}
      />

      <ChatNotificationSettingsModal
        chat={selectedChat}
        isLoading={isLoadingChatNotificationSettings}
        isOpen={isChatNotificationSettingsOpen}
        isSaving={isSavingChatNotificationSettings}
        onClose={handleCloseChatNotificationSettings}
        onSelectAlertTone={() => {
          void handleSelectChatNotificationAlertTone();
        }}
        onSelectMuteMode={() => {
          void handleSelectChatNotificationMuteMode();
        }}
        settings={activeChatNotificationSettings}
      />

      <DirectChatTranscriptLanguageModal
        chat={selectedChat}
        isLoading={isLoadingChatTranscriptLanguage}
        isOpen={isChatTranscriptLanguageOpen}
        isSaving={isSavingChatTranscriptLanguage}
        onChangeSearch={setChatTranscriptLanguageSearch}
        onClose={handleCloseChatTranscriptLanguage}
        onSelectLanguage={(languageCode) => {
          void handleSelectChatTranscriptLanguage(languageCode);
        }}
        search={chatTranscriptLanguageSearch}
        transcriptLanguage={activeDirectChatTranscriptLanguage}
      />

      <DirectContactDetailsModal
        chat={selectedChat}
        details={activeDirectContactDetails}
        isLoading={isLoadingDirectContactDetails}
        isOpen={isDirectContactDetailsOpen}
        onAddToGroup={handleOpenAddToGroupModal}
        onClose={handleCloseDirectContactDetails}
        onStartVideoCall={() => {
          void handleStartDirectCall('video');
        }}
        onStartVoiceCall={() => {
          void handleStartDirectCall('voice');
        }}
        profilePhotoHeaders={profilePhotoHeaders}
      />

      <AddToGroupModal
        contactName={selectedChat?.chatType !== 'GROUP' ? selectedChat?.title || 'Contact' : 'Contact'}
        groups={activeAddToGroupTargets}
        isLoading={isLoadingAddToGroups}
        isOpen={isAddToGroupModalOpen}
        isSaving={isSavingAddToGroups}
        onCancel={handleCloseAddToGroupModal}
        onConfirm={() => {
          void handleConfirmAddToGroups();
        }}
        onSearchChange={setAddToGroupSearch}
        onToggleGroup={handleToggleAddToGroupTarget}
        search={addToGroupSearch}
        selectedCount={selectedAddToGroupCount}
        selectedGroupIds={selectedAddToGroupIds}
      />

      <GroupInfoModal
        chat={selectedChat}
        canChangePhoto={canCurrentUserChangeGroupPhoto(selectedChat, userProfile)}
        companyName={companyDisplayName}
        currentUid={currentUid}
        directContacts={directChatContacts}
        groupCount={groups.length}
        isOpen={isGroupInfoModalOpen}
        isUpdatingPhoto={isUpdatingGroupPhoto}
        notificationSettings={activeChatNotificationSettings}
        onChangePhoto={() => {
          void handleChangeGroupPhoto();
        }}
        onClose={handleCloseGroupInfo}
        onExitGroup={handleExitGroupChat}
        onOpenAddMembers={handleOpenGroupAddMembersModal}
        onOpenGroupSwitcher={handleOpenGroupSwitcher}
        onOpenMembers={handleOpenGroupMembersModal}
        onOpenNotifications={handleOpenChatNotificationSettings}
        onOpenSearchMessages={handleOpenConversationSearch}
        onOpenStarred={() => handleOpenGroupMessageList('starred')}
        onStartVideoCall={() => handleOpenGroupCallPeopleModal('video')}
        onStartVoiceCall={() => handleOpenGroupCallPeopleModal('voice')}
        onlineCount={activeGroupOnlineCount}
        profilePhotoHeaders={profilePhotoHeaders}
        starredCount={activeGroupStarredMessageCount}
      />

      <MessageListModal
        chat={selectedChat}
        currentUid={currentUid}
        isOpen={Boolean(messageListModalMode)}
        messages={messages}
        mode={messageListModalMode || 'search'}
        onChangeSearch={setMessageListSearch}
        onClose={handleCloseGroupMessageList}
        search={messageListSearch}
        starredMessageIds={starredMessageIds}
      />

      <GroupMembersModal
        chat={selectedChat}
        currentUid={currentUid}
        directContacts={directChatContacts}
        isOpen={isGroupMembersModalOpen}
        onAddMembers={handleOpenGroupAddMembersModal}
        onChangeSearch={setGroupMembersSearch}
        onClose={handleCloseGroupMembersModal}
        profilePhotoHeaders={profilePhotoHeaders}
        search={groupMembersSearch}
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

      <ArchiveSettingsModal
        isLoading={isLoadingArchiveSettings}
        isOpen={isArchiveSettingsOpen}
        isSaving={isSavingArchiveSettings}
        onClose={() => setIsArchiveSettingsOpen(false)}
        onSave={(settings) => {
          void saveArchiveSettings(settings);
        }}
        settings={chatArchiveSettings}
      />

      <CallOptionsMenu
        isOpen={isCallOptionsOpen}
        onClose={() => setIsCallOptionsOpen(false)}
        onEdit={handleToggleCallEditMode}
        onOpenScheduled={handleOpenScheduledCalls}
      />

      <NewCallModal
        contacts={registeredCallContacts}
        isOpen={isNewCallModalOpen}
        onChangeSearch={setNewCallSearch}
        onClose={handleCloseNewCallModal}
        onStartCall={handleStartCallFromContact}
        profilePhotoHeaders={profilePhotoHeaders}
        search={newCallSearch}
      />

      <CallKeypadModal
        contacts={registeredCallContacts}
        currentUser={currentUserDialIdentity}
        digits={callKeypadDigits}
        isOpen={isCallKeypadOpen}
        onAppendDigit={handleAppendCallKeypadDigit}
        onAppendPlus={handleAppendCallKeypadPlus}
        onBackspace={handleBackspaceCallKeypadDigit}
        onClose={() => setIsCallKeypadOpen(false)}
        onStartCall={() => {
          void handleStartKeypadCall();
        }}
        profilePhotoHeaders={profilePhotoHeaders}
      />

      <CallFavoritesModal
        contacts={registeredCallContacts}
        favoriteContactIds={callFavoriteContactIds}
        isOpen={isCallFavoritesModalOpen}
        onChangeSearch={setCallFavoritesSearch}
        onClose={() => setIsCallFavoritesModalOpen(false)}
        onToggleFavorite={handleToggleCallFavorite}
        profilePhotoHeaders={profilePhotoHeaders}
        search={callFavoritesSearch}
      />

      <ScheduleCallModal
        draft={scheduleCallDraft}
        isOpen={isScheduleCallModalOpen}
        onClose={handleCloseScheduleCallFlow}
        onNext={handleNextScheduleCall}
        onUpdateDraft={handleUpdateScheduleCallDraft}
      />

      <ScheduleCallSendModal
        contacts={scheduleCallRecipientContacts}
        draft={scheduleCallDraft}
        isAddingToCalendar={isAddingScheduleToCalendar}
        isOpen={isScheduleCallSendModalOpen}
        onAddToCalendar={() => {
          void handleAddScheduleCallToCalendar();
        }}
        onBack={() => {
          setIsScheduleCallSendModalOpen(false);
          setIsScheduleCallModalOpen(true);
        }}
        onChangeSearch={setScheduleCallRecipientSearch}
        onClose={handleCloseScheduleCallFlow}
        onSave={handleSaveScheduledCall}
        onToggleRecipient={handleToggleScheduleCallRecipient}
        profilePhotoHeaders={profilePhotoHeaders}
        search={scheduleCallRecipientSearch}
        selectedRecipientIds={scheduleCallRecipientIds}
      />

      <ScheduledCallsModal
        calls={scheduledCalls}
        isOpen={isScheduledCallsModalOpen}
        onClose={() => setIsScheduledCallsModalOpen(false)}
        onDelete={(callId) => {
          void persistScheduledCalls(scheduledCallsRef.current.filter((call) => call.id !== callId));
        }}
      />

      <NativeOptionPickerModal picker={nativeOptionPicker} />
      <NativeDateTimePromptModal
        onClose={() => setNativeDateTimePrompt(null)}
        prompt={nativeDateTimePrompt}
      />
      <MediaPreparationStatusModal
        progress={mediaPreparationProgress}
      />
      <CompanyCalendarYearDatePickerModal
        date={companyCalendarYearPickerDate}
        isOpen={isCompanyCalendarYearPickerOpen}
        onCancel={() => setIsCompanyCalendarYearPickerOpen(false)}
        onChange={setCompanyCalendarYearPickerDate}
        onConfirm={handleConfirmCompanyCalendarYearStartDate}
      />

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
        onChangePhone={handleChangeManualPhoneDraft}
        onConfirm={handleConfirmManualInvite}
        phone={manualPhoneDraft}
        visible={isManualInviteModalOpen}
      />

      <OrganizationDeletionModal
        isDeleting={isDeletingOrganization}
        isRequesting={isRequestingOrganizationDeletion}
        isVerifying={isVerifyingOrganizationDeletionOtp}
        onCancel={() => {
          if (isDeletingOrganization) {
            return;
          }

          setOrganizationDeletionModal(null);
          setOrganizationDeletionConfirmation(null);
        }}
        onChangeConfirmationText={(confirmationText) => updateOrganizationDeletionModal({
          confirmationText,
          error: null
        })}
        onChangeOtpCode={(otpCode) => updateOrganizationDeletionModal({
          error: null,
          otpCode
        })}
        onProceed={() => {
          void handleProceedOrganizationDeletion();
        }}
        onSendOtp={() => {
          void handleSendOrganizationDeletionOtp();
        }}
        onVerifyOtp={() => {
          void handleVerifyOrganizationDeletionOtp();
        }}
        progressAnim={organizationDeletionProgressAnim}
        state={organizationDeletionModal}
      />

      <SpamChatStatusModal
        chat={spamActionTarget}
        isDeleting={isDeletingSpamChats}
        onClose={() => setSpamActionTarget(null)}
        onDelete={handlePermanentDeleteSpamChat}
        onOpenSegment={handleOpenTrashSegment}
        profilePhotoHeaders={profilePhotoHeaders}
      />

      <ClearChatModal
        chat={clearChatTarget}
        isClearing={isClearingChat}
        onClearMediaFiles={handleClearChatMediaFiles}
        onClearMessages={handleClearChatMessages}
        onClose={closeClearChatModal}
        summary={clearChatSummary}
      />

      <ThemePreferenceModal
        currentPreference={appTheme.preference}
        onClose={() => setIsThemePreferenceModalOpen(false)}
        onSelect={(preference) => {
          void appTheme.setPreference(preference);
          setIsThemePreferenceModalOpen(false);
        }}
        visible={isThemePreferenceModalOpen}
      />

      <ChatMoreActionsModal
        chat={chatMoreActionTarget}
        onArchive={handleArchiveChat}
        onClear={(chat) => handleClearChat(chat, 'clear')}
        onClose={() => setChatMoreActionTarget(null)}
        onDelete={(chat) => handleClearChat(chat, 'delete')}
        onOpenInfo={handleOpenChatInfoFromMore}
        onToggleFavorite={handleToggleFavoriteChat}
        onTogglePin={handleTogglePinChat}
      />
    </View>
  );
}
