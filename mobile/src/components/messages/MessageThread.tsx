import * as FileSystem from 'expo-file-system/legacy';
import {
  MessageBubble,
  areMessageBubblePropsEqual,
} from './MessageBubble';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent
} from '@react-native-community/datetimepicker';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AudioMode } from 'expo-audio';
import type { ActionRecord } from '../../services/actionApi';
import { ActionBubble } from '../actions/ActionBubble';
import type { FeatherIconName } from '../../types/featherIcon';
import type { ImageSourcePropType } from 'react-native';
import { ActivityIndicator, Alert, Animated, FlatList, Image, ImageStyle, Keyboard, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView as KeyboardAwareThread } from 'react-native-keyboard-controller';
import { resolveComposerBottomPadding } from '../../services/rootSafeArea';
import { BlurView } from 'expo-blur';
import { CHAT_AUDIO_PLAYBACK_MODE, safePauseAudioPlayer, safePlayAudioPlayer, safeReplaceAudioPlayerSource } from '../../services/chatAudioPlayback';
import { ChatDeliveryStatus, ChatGroupMember, ChatMediaAttachment, ChatMediaKind, ChatMessage, ChatMessageReaction, ChatMessageReactionMap, ChatReplyReference } from '../../services/chatApi';
import type { ScheduledChatMessage } from '../../services/chatApi';
import { LocalChatMediaInput } from '../../services/chatMediaApi';
import { MESSAGE_INPUT_MAX_HEIGHT, MESSAGE_INPUT_MIN_HEIGHT, styles } from '../../screens/adminChatStyles';
import { MediaTransferRing } from '../../components/MediaTransferRing';
import {
  createScrollToLatestCoalescer,
  type ScrollToLatestCoalescer
} from './scrollToLatestCoalescer';
import { reportMissingChatMedia } from '../../services/chatMediaRepairQueue';
import { ComposerEmojiPicker } from './ComposerEmojiPicker';
import { GroupTypingRow } from './GroupTypingRow';
import { TYPING_HEARTBEAT_MS, type TypingParticipant } from '../../services/typingIndicator';
import { ScheduleMessageSheet } from './ScheduleMessageSheet';
import { ScheduledMessagesSheet } from './ScheduledMessagesSheet';
import { describeScheduledCounts } from '../../services/scheduledMessageDisplay';
import { removeLastCharacter } from '../../services/emojiCatalogue';
import { MessageReactionPickerModal } from '../../components/messageReactions/MessageReactionPickerModal';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { buildVoiceNoteWaveform, formatMediaDuration, formatMessageTime, getAudioSeekSeconds, getChatMessagePreview, getReadableFileExtension, isMediaTransferActive } from '../../services/chatMessagePreview';
import { colors } from '../../theme/colors';
import { companyLibraryDocumentThumbnailSources } from '../../services/companyLibraryDisplay';
import { formatAudioSeconds, formatByteCount, getErrorMessage, getMediaPreviewUri, getMediaTransferLabel } from '../../services/chatDisplayFormatting';
import { getChatMessageRowKey, getMediaLocalUri, getMessageMediaItems, uniqueChatMessages } from '../../services/chatMessageReconciliation';
import { getKeyboardDismissMode } from '../../components/chatUiPrimitives';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * The message list and everything drawn inside a bubble.
 *
 * The largest component cluster in the chat screen — the thread, the bubble, its
 * media previews, the audio attachment, the action overlay and the date jump.
 * Lifted out unchanged.
 */

type MessageThreadItem =
  | { id: string; label: string; type: 'date' }
  | { id: string; message: ChatMessage; type: 'message' }
  | { action: ActionRecord; id: string; type: 'action' };

export const EMPTY_CHAT_REACTIONS: ChatMessageReaction[] = [];

/** Shared so an absent list is the same array every render. */
const EMPTY_SCHEDULED_MESSAGES: ScheduledChatMessage[] = [];

/** Shared so an absent list is the same array every render. */
const EMPTY_TYPING_PARTICIPANTS: TypingParticipant[] = [];

const MESSAGE_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏'];

const MESSAGE_INPUT_LINE_HEIGHT = 20;

const MESSAGE_INPUT_VERTICAL_PADDING = 16;

const MESSAGE_INPUT_BOX_EXTRA_HEIGHT = 4;

const VOICE_NOTE_MIN_DURATION_MS = 700;

const VOICE_NOTE_RECORDING_OPTIONS = RecordingPresets.LOW_QUALITY;

const CHAT_AUDIO_RECORDING_MODE: AudioMode = {
  ...CHAT_AUDIO_PLAYBACK_MODE,
  allowsRecording: true,
  interruptionMode: 'doNotMix' as const
};

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

interface ChatSearchMatch {
  messageId: string;
  preview: string;
  senderUid: string;
  sentAt: string;
}

export function MessageThread({
  actions,
  bannerAboveMessages,
  hasBannerAboveMessages = false,
  topInset = 0,
  bottomInset,
  keyboardVerticalOffset,
  keyboardHeight = 0,
  canChat,
  contactName,
  contactProfilePhotoUrl,
  currentUid,
  draft,
  groupMembers,
  hasKnownMessages,
  isGroupChat,
  isCompactAndroid,
  isDeleteMode,
  isForwardMode,
  isDeletingSelectedMessages,
  isLoading,
  isLoadingOlderMessages,
  isSearchOpen,
  isSending,
  messageReactions,
  messages,
  onCancelReply,
  onCopyMessage,
  onCreateAction,
  onOpenAction,
  onDeleteMessage,
  onDeleteSelectedMessages,
  onCloseSearch,
  onCancelScheduledMessage,
  onDismissScheduledMessage,
  onDraftChange,
  onScheduleMessage,
  onTypingChange,
  typingParticipants = EMPTY_TYPING_PARTICIPANTS,
  onSendScheduledMessageNow,
  scheduledMessages = EMPTY_SCHEDULED_MESSAGES,
  onInfoMessage,
  onLoadOlderMessages,
  onForwardActionMessage,
  onForwardMessage,
  onOpenMedia,
  onPrepareAttachment,
  preparingVideoKey,
  onReactMessage,
  onMessageReply,
  onStarMessage,
  onPickFile,
  onPickMedia,
  onPickMediaLibrary,
  onToggleForwardMessage,
  onToggleDeleteMessage,
  onSend,
  onSendVoiceNote,
  profilePhotoHeaders,
  readOnlyReason,
  replyTarget,
  selectedForwardMessageIds,
  selectedDeleteMessageCount,
  selectedDeleteMessageIds,
  starredMessageIds
}: {
  /** Pinned above the messages. Used for an announcement awaiting confirmation. */
  /** Actions raised in this conversation, shown among the messages. */
  actions?: ActionRecord[];
  bannerAboveMessages?: React.ReactNode;
  /**
   * Whether that banner actually draws anything. Both of its children return
   * null when there is nothing to say, and a wrapper padded for a banner that
   * is not there is a gap under the header nobody asked for.
   */
  hasBannerAboveMessages?: boolean;
  /** Room at the top of the thread for the header floating over it. */
  topInset?: number;
  onCreateAction: (message: ChatMessage) => void;
  onOpenAction?: (action: ActionRecord) => void;
  bottomInset: number;
  /** Puts back the top inset the app root applied above this view. */
  keyboardVerticalOffset: number;
  /** Measured height of the keyboard, from the Keyboard events. Android only. */
  keyboardHeight?: number;
  canChat: boolean;
  contactName: string;
  contactProfilePhotoUrl: string | null;
  currentUid: string;
  draft: string;
  groupMembers: ChatGroupMember[];
  hasKnownMessages: boolean;
  isGroupChat: boolean;
  isCompactAndroid: boolean;
  isDeleteMode: boolean;
  isForwardMode: boolean;
  isDeletingSelectedMessages: boolean;
  isLoading: boolean;
  isLoadingOlderMessages: boolean;
  isSearchOpen: boolean;
  isSending: boolean;
  messageReactions: ChatMessageReactionMap;
  messages: ChatMessage[];
  onCancelReply: () => void;
  onCopyMessage: (message: ChatMessage) => void;
  onDeleteMessage: (message: ChatMessage) => void;
  onDeleteSelectedMessages: () => void;
  onCloseSearch: () => void;
  /** Stops one before it goes. Absent where the screen offers no scheduling. */
  onCancelScheduledMessage?: (scheduledMessage: ScheduledChatMessage) => Promise<void>;
  /** Clears one that could not be sent, once its author has seen why. */
  onDismissScheduledMessage?: (scheduledMessage: ScheduledChatMessage) => Promise<void>;
  onDraftChange: (value: string) => void;
  /**
   * Told when this person starts or stops typing, on a heartbeat rather than
   * per keystroke. Absent where the screen has no realtime socket.
   */
  onTypingChange?: (isTyping: boolean) => void;
  /** Who is currently typing in this conversation. Groups only. */
  typingParticipants?: TypingParticipant[];
  /**
   * Sends what is written at a chosen time.
   *
   * Absent for a chat that cannot take a scheduled message, and the send button
   * then does nothing on a long press rather than offering a sheet that fails.
   */
  onScheduleMessage?: (at: Date) => Promise<void>;
  onSendScheduledMessageNow?: (scheduledMessage: ScheduledChatMessage) => Promise<void>;
  scheduledMessages?: ScheduledChatMessage[];
  onInfoMessage: (message: ChatMessage) => void;
  onLoadOlderMessages: () => void;
  onForwardActionMessage: (message: ChatMessage) => void;
  onForwardMessage: (message: ChatMessage) => void;
  onOpenMedia: (message: ChatMessage, activeIndex: number) => void;
  onPrepareAttachment: (message: ChatMessage, activeIndex: number) => Promise<string | null>;
  preparingVideoKey: string | null;
  onReactMessage: (message: ChatMessage, reaction: string) => void;
  onMessageReply: (message: ChatMessage) => void;
  onStarMessage: (message: ChatMessage) => void;
  onPickFile: () => void;
  onPickMedia: () => void;
  onPickMediaLibrary: () => void;
  onToggleForwardMessage: (message: ChatMessage) => void;
  onToggleDeleteMessage: (message: ChatMessage) => void;
  onSend: () => void;
  onSendVoiceNote: (media: LocalChatMediaInput) => void;
  profilePhotoHeaders?: Record<string, string>;
  readOnlyReason?: string;
  replyTarget: ChatMessage | null;
  selectedDeleteMessageCount: number;
  selectedDeleteMessageIds: Record<string, boolean>;
  selectedForwardMessageIds: Record<string, boolean>;
  starredMessageIds: Record<string, boolean>;
}) {
  const appTheme = useAppTheme();
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSenderUid, setSearchSenderUid] = useState<string | null>(null);
  const [searchDateKey, setSearchDateKey] = useState<string | null>(null);
  const [activeSearchMatchIndex, setActiveSearchMatchIndex] = useState(0);
  const [isSearchDateModalOpen, setIsSearchDateModalOpen] = useState(false);
  const [isSearchPersonModalOpen, setIsSearchPersonModalOpen] = useState(false);
  const [isPrivacyInfoModalOpen, setIsPrivacyInfoModalOpen] = useState(false);
  const [messageActionTarget, setMessageActionTarget] = useState<ChatMessage | null>(null);
  const [reactionPickerTarget, setReactionPickerTarget] = useState<ChatMessage | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isScheduleSheetOpen, setIsScheduleSheetOpen] = useState(false);
  const [isScheduledListOpen, setIsScheduledListOpen] = useState(false);
  const [busyScheduledMessageId, setBusyScheduledMessageId] = useState<string | null>(null);
  const [isSchedulingMessage, setIsSchedulingMessage] = useState(false);
  const [activeAudioPlaybackId, setActiveAudioPlaybackId] = useState<string | null>(null);
  const canSend = canChat && draft.trim().length > 0 && !isSending && !isVoiceRecording;
  // A failure has to change the banner, not hide behind a count that reads
  // the same as a message quietly waiting its turn.
  const scheduledFailureCount = scheduledMessages.filter((message) => message.status === 'FAILED').length;
  const threadMessages = useMemo(() => uniqueChatMessages(messages), [messages]);
  const threadItems = useMemo(
    () => buildMessageThreadItems(threadMessages, actions),
    [actions, threadMessages]
  );
  const groupMemberByUid = useMemo(() => new Map(groupMembers.map((member) => [member.uid, member])), [groupMembers]);
  const searchMatches = useMemo(() => getChatSearchMatches({
    dateKey: searchDateKey,
    messages: threadMessages,
    query: searchQuery,
    senderUid: isGroupChat ? searchSenderUid : null
  }), [isGroupChat, searchDateKey, searchQuery, searchSenderUid, threadMessages]);
  const safeSearchMatchIndex = searchMatches.length
    ? Math.min(activeSearchMatchIndex, searchMatches.length - 1)
    : -1;
  const activeSearchMatch = safeSearchMatchIndex >= 0 ? searchMatches[safeSearchMatchIndex] : null;
  const hasSearchFilters = Boolean(searchQuery.trim() || searchDateKey || (isGroupChat && searchSenderUid));
  const searchSenderLabel = searchSenderUid
    ? getChatSearchSenderLabel(searchSenderUid, currentUid, groupMemberByUid)
    : 'Person';
  const inputRef = useRef<TextInput | null>(null);
  const searchInputRef = useRef<TextInput | null>(null);
  const activeVoiceRecordingUriRef = useRef<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAtLatestRef = useRef(true);
  const lastReplyJumpRef = useRef<{ messageId: string; timestamp: number } | null>(null);
  const messageOffsetsRef = useRef<Record<string, number>>({});
  const previousMessageCountRef = useRef(0);
  // `bottomInset` is 0 on iOS by design: the app root has already cleared the
  // home indicator, and the composer adding it again is what left a band under
  // it. With a keyboard up there is no system bar to clear on either platform,
  // only the keyboard, which the thread has already lifted the composer onto.
  const composerBottomPadding = resolveComposerBottomPadding({
    isCompactAndroid,
    isKeyboardVisible,
    screenBottomInset: bottomInset
  });
  const messageInputBoxHeight = Math.max(42, messageInputHeight + MESSAGE_INPUT_BOX_EXTRA_HEIGHT);
  const composerControlHeight = isVoiceRecording ? 42 : messageInputBoxHeight;
  const scrollToLatestButtonBottom = composerBottomPadding + composerControlHeight + (replyTarget ? 70 : 22);
  const messageListRef = useRef<FlatList<MessageThreadItem> | null>(null);

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
    messageListRef.current?.scrollToEnd({ animated });
    isAtLatestRef.current = true;
    setShowScrollToLatest(false);
    setScrollToLatestUnreadCount(0);
  }

  /**
   * Asks for the thread to end up at the bottom, smoothly.
   *
   * Every caller goes through here rather than scrolling directly. Opening a
   * chat triggers a burst of requests — the messages arriving, then one per
   * content size change as rows are measured — and running each one produced a
   * flash of the top followed by a series of snaps.
   */
  // Held in a ref because the coalescer is created once: calling the first
  // render's closure later would scroll using stale state.
  const scrollToLatestRef = useRef(scrollToLatest);

  scrollToLatestRef.current = scrollToLatest;

  const requestScrollToLatestRef = useRef<ScrollToLatestCoalescer | null>(null);

  if (!requestScrollToLatestRef.current) {
    requestScrollToLatestRef.current = createScrollToLatestCoalescer({
      scroll: (animated) => scrollToLatestRef.current(animated)
    });
  }

  function requestScrollToLatest(animated: boolean) {
    requestScrollToLatestRef.current?.request(animated);
  }

  useEffect(() => () => requestScrollToLatestRef.current?.cancel(), []);

  function handleMessageLayout(messageId: string, y: number) {
    messageOffsetsRef.current[messageId] = y;
  }

  const handleDeactivateAudioPlayback = useCallback((audioPlaybackId: string) => {
    setActiveAudioPlaybackId((currentAudioPlaybackId) =>
      currentAudioPlaybackId === audioPlaybackId ? null : currentAudioPlaybackId
    );
  }, []);

  const handleOpenThreadMessageActions = useCallback((message: ChatMessage) => {
    Keyboard.dismiss();
    setMessageActionTarget(message);
  }, []);

  const handleDismissThreadMessageActions = useCallback(() => {
    setMessageActionTarget(null);
  }, []);

  const handleOpenThreadReactionPicker = useCallback((message: ChatMessage) => {
    setMessageActionTarget(null);
    setReactionPickerTarget(message);
  }, []);

  const handleCreateActionFromThreadMessage = useCallback((message: ChatMessage) => {
    setMessageActionTarget(null);
    onCreateAction(message);
  }, [onCreateAction]);

  const handleCloseThreadReactionPicker = useCallback(() => {
    setReactionPickerTarget(null);
  }, []);

  const handleSelectThreadReaction = useCallback((message: ChatMessage, reaction: string) => {
    setReactionPickerTarget(null);
    onReactMessage(message, reaction);
  }, [onReactMessage]);

  const handleThreadAction = useCallback((callback: (message: ChatMessage) => void, message: ChatMessage) => {
    setMessageActionTarget(null);
    callback(message);
  }, []);

  function scrollToMessage(messageId: string, animated = true) {
    const targetY = messageOffsetsRef.current[messageId];

    if (typeof targetY !== 'number') {
      return false;
    }

    messageListRef.current?.scrollToOffset({
      animated,
      offset: Math.max(targetY - (isSearchOpen ? 84 : 18), 0)
    });

    return true;
  }

  function handleReplyPreviewPress(messageId: string) {
    if (typeof messageOffsetsRef.current[messageId] !== 'number') {
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

    scrollToMessage(messageId, true);
    setHighlightedMessageId(messageId);

    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }

    highlightTimerRef.current = setTimeout(() => {
      setHighlightedMessageId(null);
      highlightTimerRef.current = null;
    }, 1500);
  }

  function handleCloseThreadSearch() {
    setSearchQuery('');
    setSearchSenderUid(null);
    setSearchDateKey(null);
    setActiveSearchMatchIndex(0);
    setHighlightedMessageId(null);
    setIsSearchDateModalOpen(false);
    setIsSearchPersonModalOpen(false);
    Keyboard.dismiss();
    onCloseSearch();
  }

  function handleSearchNavigation(direction: 'next' | 'previous') {
    if (!searchMatches.length) {
      return;
    }

    setActiveSearchMatchIndex((currentIndex) => {
      if (direction === 'next') {
        return currentIndex >= searchMatches.length - 1 ? 0 : currentIndex + 1;
      }

      return currentIndex <= 0 ? searchMatches.length - 1 : currentIndex - 1;
    });
  }

  function handleSearchQueryChange(value: string) {
    setSearchQuery(value);
    setActiveSearchMatchIndex(0);
  }

  function handleSelectSearchDate(dateKey: string | null, targetMessageId?: string, shouldClose = true) {
    setSearchDateKey(dateKey);

    if (shouldClose) {
      setIsSearchDateModalOpen(false);
    }

    if (targetMessageId) {
      const nextIndex = getChatSearchMatches({
        dateKey,
        messages: threadMessages,
        query: searchQuery,
        senderUid: isGroupChat ? searchSenderUid : null
      }).findIndex((match) => match.messageId === targetMessageId);

      setActiveSearchMatchIndex(nextIndex >= 0 ? nextIndex : 0);
    } else {
      setActiveSearchMatchIndex(0);
    }
  }

  function handleSelectSearchPerson(senderUid: string | null) {
    setSearchSenderUid(senderUid);
    setIsSearchPersonModalOpen(false);
    setActiveSearchMatchIndex(0);
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
    if (!isSearchOpen) {
      setSearchQuery('');
      setSearchSenderUid(null);
      setSearchDateKey(null);
      setActiveSearchMatchIndex(0);
      setIsSearchDateModalOpen(false);
      setIsSearchPersonModalOpen(false);
      return;
    }

    setTimeout(() => searchInputRef.current?.focus(), 140);
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen || activeSearchMatchIndex < searchMatches.length) {
      return;
    }

    setActiveSearchMatchIndex(Math.max(searchMatches.length - 1, 0));
  }, [activeSearchMatchIndex, isSearchOpen, searchMatches.length]);

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    if (!activeSearchMatch) {
      setHighlightedMessageId(null);
      return;
    }

    setHighlightedMessageId(activeSearchMatch.messageId);
    setTimeout(() => {
      scrollToMessage(activeSearchMatch.messageId, true);
    }, 80);
  }, [activeSearchMatch?.messageId, isSearchOpen]);

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
    if (isSearchOpen) {
      return;
    }

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

    requestScrollToLatest(true);
  }, [isSearchOpen, messages.length]);

  useEffect(() => {
    if (!isKeyboardVisible || isSearchOpen) {
      return;
    }

    requestScrollToLatest(true);
  }, [isKeyboardVisible, isSearchOpen]);

  useEffect(() => {
    if (!replyTarget || !canChat || isSearchOpen) {
      return;
    }

    setTimeout(() => inputRef.current?.focus(), 90);
    requestScrollToLatest(true);
  }, [canChat, isSearchOpen, replyTarget?.messageId]);

  useEffect(() => {
    if (draft.length === 0) {
      setMessageInputHeight(MESSAGE_INPUT_MIN_HEIGHT);
    }
  }, [draft.length]);

  /**
   * Says "still typing" every few seconds while there is something in the box.
   *
   * On a heartbeat, not per keystroke: two hundred characters would otherwise
   * be two hundred broadcasts. It stops the moment the box is empty, and the
   * cleanup stops it when the thread closes — a person who navigates away
   * mid-word must not be left typing forever on somebody else's screen.
   */
  useEffect(() => {
    if (!onTypingChange) {
      return;
    }

    if (!draft.trim()) {
      onTypingChange(false);
      return;
    }

    onTypingChange(true);

    const timer = setInterval(() => onTypingChange(true), TYPING_HEARTBEAT_MS);

    return () => {
      clearInterval(timer);
      onTypingChange(false);
    };
  }, [draft.trim().length > 0, onTypingChange]);

  const updateMessageInputHeight = (nextHeight: number) => {
    setMessageInputHeight((currentHeight) => (
      Math.abs(currentHeight - nextHeight) > 1 ? nextHeight : currentHeight
    ));
  };

  function handleOpenEmojiPicker() {
    // The keyboard and the emoji panel want the same half of the screen. On a
    // small phone leaving the keyboard up would push the grid to a strip two
    // rows deep, so the keyboard goes down first, exactly as it does when a
    // phone's own emoji key is pressed.
    Keyboard.dismiss();
    setIsEmojiPickerOpen(true);
  }

  function handleAppendEmojiToDraft(emoji: string) {
    const nextDraft = `${draft}${emoji}`;

    onDraftChange(nextDraft);
    updateMessageInputHeight(estimateMessageInputHeight(nextDraft, messageInputWidth));
  }

  /**
   * Holding send offers to send it later.
   *
   * Only with something written and only where the screen was given a way to
   * schedule — a chat that cannot take one shows nothing rather than a sheet
   * that fails on the last tap.
   */
  function handleComposerActionLongPress() {
    if (!canSend) {
      return;
    }

    if (!onScheduleMessage) {
      // Holding a button and getting nothing reads as a broken button. Groups
      // cannot take a scheduled message yet, and saying so once is better than
      // leaving somebody to press harder.
      Alert.alert(
        'Not for group chats yet',
        'Messages can be scheduled in one-to-one chats. Send this one now, or write to the person directly.'
      );

      return;
    }

    Keyboard.dismiss();
    setIsScheduleSheetOpen(true);
  }

  async function handleScheduleMessage(at: Date) {
    if (!onScheduleMessage) {
      return;
    }

    setIsSchedulingMessage(true);

    try {
      await onScheduleMessage(at);
      setIsScheduleSheetOpen(false);
    } finally {
      setIsSchedulingMessage(false);
    }
  }

  async function handleScheduledMessageAction(
    scheduledMessage: ScheduledChatMessage,
    act?: (scheduledMessage: ScheduledChatMessage) => Promise<void>
  ) {
    if (!act) {
      return;
    }

    setBusyScheduledMessageId(scheduledMessage.scheduledMessageId);

    try {
      await act(scheduledMessage);
    } finally {
      setBusyScheduledMessageId(null);
      // Closing on the last one keeps the sheet from sitting there empty,
      // which reads as a list that failed to load rather than one that emptied.
      if (scheduledMessages.length <= 1) {
        setIsScheduledListOpen(false);
      }
    }
  }

  function handleBackspaceDraft() {
    const nextDraft = removeLastCharacter(draft);

    onDraftChange(nextDraft);
    updateMessageInputHeight(estimateMessageInputHeight(nextDraft, messageInputWidth));
  }

  const renderThreadItem = useCallback(({ item }: { item: MessageThreadItem }) => {
    if (item.type === 'action') {
      return (
        <ActionBubble
          action={item.action}
          onOpen={() => onOpenAction?.(item.action)}
        />
      );
    }

    if (item.type === 'date') {
      return (
        <View style={styles.messageDateRow}>
          <Text style={styles.messageDateText}>{item.label}</Text>
        </View>
      );
    }

    return (
      <MemoizedMessageBubble
        contactName={contactName}
        contactProfilePhotoUrl={contactProfilePhotoUrl}
        currentUid={currentUid}
        highlighted={highlightedMessageId === item.message.messageId}
        isGroupChat={isGroupChat}
        isSelectable={isForwardMode || isDeleteMode}
        isSelected={Boolean((isDeleteMode ? selectedDeleteMessageIds : selectedForwardMessageIds)[item.message.messageId])}
        message={item.message}
        onActivateAudioPlayback={setActiveAudioPlaybackId}
        onDeactivateAudioPlayback={handleDeactivateAudioPlayback}
        onForwardMessage={isForwardMode || isDeleteMode ? undefined : onForwardMessage}
        onLayout={handleMessageLayout}
        onLongPress={isForwardMode || isDeleteMode ? undefined : handleOpenThreadMessageActions}
        onOpenMedia={isForwardMode || isDeleteMode ? undefined : onOpenMedia}
        onPrepareAttachment={isForwardMode || isDeleteMode ? undefined : onPrepareAttachment}
        onReply={isForwardMode || isDeleteMode ? undefined : onMessageReply}
        onReplyPreviewPress={isForwardMode || isDeleteMode ? undefined : handleReplyPreviewPress}
        onToggleSelect={isDeleteMode ? onToggleDeleteMessage : onToggleForwardMessage}
        preparingVideoKey={preparingVideoKey}
        activeAudioPlaybackId={activeAudioPlaybackId}
        profilePhotoHeaders={profilePhotoHeaders}
        reactions={messageReactions[item.message.messageId] || item.message.reactions || EMPTY_CHAT_REACTIONS}
        searchQuery={isSearchOpen ? searchQuery : ''}
        senderMember={isGroupChat ? groupMemberByUid.get(item.message.senderUid) || null : null}
        starred={Boolean(starredMessageIds[item.message.messageId])}
      />
    );
  }, [
    activeAudioPlaybackId,
    contactName,
    contactProfilePhotoUrl,
    currentUid,
    groupMemberByUid,
    handleDeactivateAudioPlayback,
    highlightedMessageId,
    isForwardMode,
    isGroupChat,
    isSearchOpen,
    messageReactions,
    onForwardMessage,
    handleOpenThreadMessageActions,
    isDeleteMode,
    onMessageReply,
    onOpenMedia,
    onPrepareAttachment,
    onToggleDeleteMessage,
    onToggleForwardMessage,
    preparingVideoKey,
    profilePhotoHeaders,
    searchQuery,
    selectedDeleteMessageIds,
    selectedForwardMessageIds,
    starredMessageIds
  ]);

  const renderEmptyThread = useCallback(() => (
    !isSearchOpen && !hasKnownMessages ? (
      <EmptyChatSecurityNotice
        isGroupChat={isGroupChat}
        onLearnMore={() => setIsPrivacyInfoModalOpen(true)}
      />
    ) : null
  ), [hasKnownMessages, isGroupChat, isSearchOpen]);

  const renderOlderMessageLoader = useCallback(() => (
    isLoadingOlderMessages ? (
      <View style={styles.olderMessageLoader}>
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    ) : null
  ), [isLoadingOlderMessages]);

  return (
    <KeyboardAwareThread
      // The real IME inset, read from the platform. Android 16 enforces edge
      // to edge, which disables `adjustResize`, so the window is never padded
      // for the keyboard and React Native's own KeyboardAvoidingView has
      // nothing to measure. This one asks the platform directly.
      behavior="padding"
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={[
        styles.messageScreen,
        { backgroundColor: appTheme.colors.chatBackground }
      ]}
      accessibilityState={{ busy: isLoading }}
    >
      {isSearchOpen ? (
        <ChatThreadSearchHeader
          inputRef={searchInputRef}
          matchCount={searchMatches.length}
          onChangeQuery={handleSearchQueryChange}
          onClearQuery={() => setSearchQuery('')}
          onClose={handleCloseThreadSearch}
          query={searchQuery}
        />
      ) : null}

      {/* A banner cannot hide beneath the floating header, so when there is one
          it takes the inset and the messages run under it instead. */}
      {hasBannerAboveMessages ? (
        <View style={{ paddingTop: topInset }}>{bannerAboveMessages}</View>
      ) : null}

      <FlatList
        contentContainerStyle={[
          styles.messageListContent,
          isDeleteMode && styles.messageListContentDeleting,
          isSearchOpen && styles.messageListContentSearching,
          !hasBannerAboveMessages && { paddingTop: topInset + 12 }
        ]}
        data={threadItems}
        initialNumToRender={18}
        keyExtractor={(item) => item.id}
        keyboardDismissMode={getKeyboardDismissMode()}
        keyboardShouldPersistTaps="always"
        ListEmptyComponent={renderEmptyThread}
        ListHeaderComponent={renderOlderMessageLoader}
        maxToRenderPerBatch={10}
        onContentSizeChange={() => {
          if (isSearchOpen) {
            if (activeSearchMatch) {
              setTimeout(() => scrollToMessage(activeSearchMatch.messageId, false), 20);
            }
          } else if (isAtLatestRef.current) {
            requestScrollToLatest(false);
          } else {
            setShowScrollToLatest(true);
          }
        }}
        onScroll={(event) => {
          if (
            !isSearchOpen &&
            !isLoadingOlderMessages &&
            event.nativeEvent.contentOffset.y <= 96
          ) {
            onLoadOlderMessages();
          }

          updateLatestVisibility(
            event.nativeEvent.contentOffset.y,
            event.nativeEvent.layoutMeasurement.height,
            event.nativeEvent.contentSize.height
          );
        }}
        onScrollBeginDrag={() => Keyboard.dismiss()}
        ref={messageListRef}
        removeClippedSubviews={Platform.OS === 'android'}
        renderItem={renderThreadItem}
        scrollEventThrottle={80}
        showsVerticalScrollIndicator={false}
        style={styles.messageList}
        updateCellsBatchingPeriod={50}
        windowSize={9}
      />

      {showScrollToLatest && !isForwardMode && !isDeleteMode && !isSearchOpen ? (
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

      {isSearchOpen ? (
        <KeyboardAvoidingView
          // iOS only. On Android this view measures from a window frame that
          // never changes, and leaves a band behind. The composer lifts itself
          // by the measured keyboard height instead, below.
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
          pointerEvents="box-none"
          style={styles.chatSearchFooterWrap}
        >
          <View style={[
            styles.chatSearchFooter,
            {
              backgroundColor: appTheme.colors.surfaceElevated,
              borderTopColor: appTheme.colors.divider
            }
          ]}>
            <View style={[
              styles.chatSearchNavigationPill,
              { backgroundColor: appTheme.colors.surface }
            ]}>
              <Pressable
                accessibilityLabel="Previous search result"
                accessibilityRole="button"
                disabled={!searchMatches.length}
                onPress={() => handleSearchNavigation('previous')}
                style={({ pressed }) => [
                  styles.chatSearchNavButton,
                  pressed && searchMatches.length > 0 && styles.pressed,
                  !searchMatches.length && styles.disabled
                ]}
              >
                <Feather color={appTheme.colors.ink} name="chevron-up" size={22} />
              </Pressable>
              <View style={[styles.chatSearchNavDivider, { backgroundColor: appTheme.colors.divider }]} />
              <Pressable
                accessibilityLabel="Next search result"
                accessibilityRole="button"
                disabled={!searchMatches.length}
                onPress={() => handleSearchNavigation('next')}
                style={({ pressed }) => [
                  styles.chatSearchNavButton,
                  pressed && searchMatches.length > 0 && styles.pressed,
                  !searchMatches.length && styles.disabled
                ]}
              >
                <Feather color={appTheme.colors.ink} name="chevron-down" size={22} />
              </Pressable>
            </View>

            <Text numberOfLines={1} style={[styles.chatSearchResultText, { color: appTheme.colors.muted }]}>
              {getChatSearchResultLabel({
                hasFilters: hasSearchFilters,
                matchCount: searchMatches.length,
                matchIndex: safeSearchMatchIndex
              })}
            </Text>

            {isGroupChat ? (
              <Pressable
                accessibilityLabel="Filter search by person"
                accessibilityRole="button"
                onPress={() => setIsSearchPersonModalOpen(true)}
                style={({ pressed }) => [
                  styles.chatSearchFilterButton,
                  { backgroundColor: appTheme.colors.surface },
                  searchSenderUid && styles.chatSearchFilterButtonActive,
                  searchSenderUid && { backgroundColor: appTheme.colors.primary },
                  pressed && styles.pressed
                ]}
              >
                <Feather color={searchSenderUid ? '#FFFFFF' : appTheme.colors.primary} name="user" size={18} />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.chatSearchFilterText,
                    { color: appTheme.colors.primary },
                    searchSenderUid && styles.chatSearchFilterTextActive
                  ]}
                >
                  {searchSenderLabel}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityLabel="Search by date or time"
              accessibilityRole="button"
              onPress={() => setIsSearchDateModalOpen(true)}
              style={({ pressed }) => [
                styles.chatSearchDateButton,
                { backgroundColor: appTheme.colors.surface },
                searchDateKey && styles.chatSearchDateButtonActive,
                searchDateKey && { backgroundColor: appTheme.colors.primary },
                pressed && styles.pressed
              ]}
            >
              <Feather color={searchDateKey ? '#FFFFFF' : appTheme.colors.primary} name="calendar" size={20} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      ) : null}

      {isDeleteMode && !isSearchOpen ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.messageDeleteFloatingWrap,
            { bottom: Math.max(bottomInset + 14, 22) }
          ]}
        >
          <Pressable
            accessibilityLabel={`Delete ${selectedDeleteMessageCount} selected messages`}
            accessibilityRole="button"
            disabled={!selectedDeleteMessageCount || isDeletingSelectedMessages}
            onPress={onDeleteSelectedMessages}
            style={({ pressed }) => [
              styles.messageDeleteFloatingCard,
              (!selectedDeleteMessageCount || isDeletingSelectedMessages) && styles.disabled,
              pressed && selectedDeleteMessageCount > 0 && !isDeletingSelectedMessages && styles.pressed
            ]}
          >
            {isDeletingSelectedMessages ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Feather color="#FFFFFF" name="trash-2" size={21} />
            )}
            <Text style={styles.messageDeleteFloatingCount}>
              {selectedDeleteMessageCount}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {isGroupChat && !isForwardMode && !isDeleteMode && !isSearchOpen ? (
        <GroupTypingRow
          members={groupMembers}
          participants={typingParticipants}
          profilePhotoHeaders={profilePhotoHeaders}
        />
      ) : null}

      {scheduledMessages.length > 0 && !isForwardMode && !isDeleteMode && !isSearchOpen ? (
        <Pressable
          accessibilityLabel={`${scheduledMessages.length} scheduled messages. Open to send now or cancel.`}
          accessibilityRole="button"
          onPress={() => setIsScheduledListOpen(true)}
          style={({ pressed }) => [
            styles.scheduledBanner,
            {
              backgroundColor: appTheme.colors.chatBackground,
              borderTopColor: appTheme.colors.border
            },
            pressed && styles.pressed
          ]}
        >
          <Feather
            color={scheduledFailureCount ? appTheme.colors.destructive : appTheme.colors.primary}
            name={scheduledFailureCount ? 'alert-circle' : 'clock'}
            size={16}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.scheduledBannerText,
              { color: scheduledFailureCount ? appTheme.colors.destructive : appTheme.colors.mutedStrong }
            ]}
          >
            {describeScheduledCounts(
              scheduledMessages.length - scheduledFailureCount,
              scheduledFailureCount
            )}
          </Text>
          <Feather color={appTheme.colors.muted} name="chevron-right" size={16} />
        </Pressable>
      ) : null}

      {!isForwardMode && !isDeleteMode && !isSearchOpen ? (
      <View style={[
        styles.messageComposer,
        {
          backgroundColor: appTheme.colors.chatBackground,
          paddingBottom: composerBottomPadding
        }
      ]}>
        <Pressable
          accessibilityLabel="Open photo and video library"
          accessibilityRole="button"
          disabled={!canChat || isSending}
          onPress={onPickMediaLibrary}
          style={({ pressed }) => [
            styles.messageComposerLibraryButton,
            pressed && styles.pressed,
            (!canChat || isSending) && styles.disabled
          ]}
        >
          <Feather color="#64748B" name="plus" size={22} />
        </Pressable>

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
              { backgroundColor: appTheme.colors.composer },
              { height: messageInputBoxHeight },
              replyTarget && styles.messageInputBoxWithReply
            ]}>
              <Pressable
                accessibilityLabel={isKeyboardVisible ? 'Close keyboard' : 'Open emoji'}
                accessibilityRole="button"
                disabled={!canChat}
                onPress={isKeyboardVisible ? () => Keyboard.dismiss() : handleOpenEmojiPicker}
                style={({ pressed }) => [styles.messageComposerIconButton, pressed && styles.pressed]}
              >
                <Ionicons
                  color="#8B95A5"
                  name={isKeyboardVisible ? 'chevron-down' : 'happy-outline'}
                  size={isKeyboardVisible ? 22 : 23}
                />
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
                placeholder={canChat ? 'Type a message' : readOnlyReason || 'Waiting for secure device'}
                placeholderTextColor={appTheme.colors.muted}
                ref={inputRef}
                scrollEnabled={messageInputHeight >= MESSAGE_INPUT_MAX_HEIGHT}
                style={[
                  styles.messageInput,
                  {
                    color: appTheme.colors.ink,
                    height: messageInputHeight
                  }
                ]}
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
          onLongPress={handleComposerActionLongPress}
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

      <MessageActionOverlay
        contactName={contactName}
        currentUserReactions={messageActionTarget
          ? getCurrentUserReactionEmojis(
              messageReactions[messageActionTarget.messageId] || messageActionTarget.reactions,
              currentUid
            )
          : []}
        message={messageActionTarget}
        onCopy={(message) => handleThreadAction(onCopyMessage, message)}
        onCreateAction={handleCreateActionFromThreadMessage}
        onDelete={(message) => handleThreadAction(onDeleteMessage, message)}
        onDismiss={handleDismissThreadMessageActions}
        onForward={(message) => handleThreadAction(onForwardActionMessage, message)}
        onInfo={(message) => handleThreadAction(onInfoMessage, message)}
        onOpenReactionPicker={handleOpenThreadReactionPicker}
        onReact={(message, reaction) => {
          setMessageActionTarget(null);
          onReactMessage(message, reaction);
        }}
        onReply={(message) => handleThreadAction(onMessageReply, message)}
        onStar={(message) => handleThreadAction(onStarMessage, message)}
        starred={messageActionTarget ? Boolean(starredMessageIds[messageActionTarget.messageId]) : false}
      />

      <MessageReactionPickerModal
        message={reactionPickerTarget}
        onClose={handleCloseThreadReactionPicker}
        onSelect={handleSelectThreadReaction}
      />

      <ComposerEmojiPicker
        onBackspace={handleBackspaceDraft}
        onClose={() => setIsEmojiPickerOpen(false)}
        onSelect={handleAppendEmojiToDraft}
        visible={isEmojiPickerOpen}
      />

      <ScheduleMessageSheet
        isScheduling={isSchedulingMessage}
        onClose={() => setIsScheduleSheetOpen(false)}
        onSchedule={(at) => { void handleScheduleMessage(at); }}
        visible={isScheduleSheetOpen}
      />

      <ScheduledMessagesSheet
        busyScheduledMessageId={busyScheduledMessageId}
        onCancel={(scheduledMessage) => {
          void handleScheduledMessageAction(scheduledMessage, onCancelScheduledMessage);
        }}
        onClose={() => setIsScheduledListOpen(false)}
        onDismiss={(scheduledMessage) => {
          void handleScheduledMessageAction(scheduledMessage, onDismissScheduledMessage);
        }}
        onSendNow={(scheduledMessage) => {
          void handleScheduledMessageAction(scheduledMessage, onSendScheduledMessageNow);
        }}
        scheduledMessages={scheduledMessages}
        visible={isScheduledListOpen}
      />

      <ChatSearchDateModal
        currentDateKey={searchDateKey}
        isOpen={isSearchDateModalOpen}
        messages={messages}
        onClose={() => setIsSearchDateModalOpen(false)}
        onSelectDate={handleSelectSearchDate}
      />

      <ChatSearchPersonModal
        currentUid={currentUid}
        groupMembers={groupMembers}
        isOpen={isSearchPersonModalOpen}
        onClose={() => setIsSearchPersonModalOpen(false)}
        onSelectPerson={handleSelectSearchPerson}
        profilePhotoHeaders={profilePhotoHeaders}
        selectedSenderUid={searchSenderUid}
      />

      <ChatPrivacyInfoModal
        isGroupChat={isGroupChat}
        onClose={() => setIsPrivacyInfoModalOpen(false)}
        visible={isPrivacyInfoModalOpen}
      />
    </KeyboardAwareThread>
  );
}

function EmptyChatSecurityNotice({
  isGroupChat,
  onLearnMore
}: {
  isGroupChat: boolean;
  onLearnMore: () => void;
}) {
  const appTheme = useAppTheme();

  return (
    <View style={styles.emptyChatSecurityWrap}>
      <View style={styles.emptyChatSecurityCard}>
        <View style={styles.emptyChatSecurityIcon}>
          <Feather color={appTheme.colors.muted} name="lock" size={14} />
        </View>
        <Text style={[styles.emptyChatSecurityText, { color: appTheme.colors.muted }]}>
          {isGroupChat
            ? 'This group is protected with Synzapp secure messaging. Only approved members on registered devices can open the conversation content.'
            : 'This chat is protected with Synzapp secure messaging. Only you and this contact can open the conversation content on registered devices.'}
        </Text>
        <Text
          accessibilityRole="link"
          onPress={onLearnMore}
          style={[styles.emptyChatSecurityLink, { color: appTheme.colors.link }]}
        >
          Learn more
        </Text>
      </View>
    </View>
  );
}

function ChatPrivacyInfoModal({
  isGroupChat,
  onClose,
  visible
}: {
  isGroupChat: boolean;
  onClose: () => void;
  visible: boolean;
}) {
  const appTheme = useAppTheme();

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.chatMoreRoot}>
        <Pressable
          accessibilityLabel="Close privacy details"
          accessibilityRole="button"
          onPress={onClose}
          style={[
            styles.chatMoreBackdrop,
            { backgroundColor: appTheme.colors.overlay }
          ]}
        />
        <View style={[
          styles.chatPrivacySheet,
          {
            backgroundColor: appTheme.colors.surfaceElevated,
            borderColor: appTheme.colors.border
          }
        ]}>
          <Pressable
            accessibilityLabel="Close privacy details"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.chatPrivacyCloseButton,
              { backgroundColor: appTheme.colors.surface },
              pressed && styles.pressed
            ]}
          >
            <Feather color={appTheme.colors.ink} name="x" size={24} />
          </Pressable>

          <View style={styles.chatPrivacyHero}>
            <View style={[
              styles.chatPrivacyDevice,
              {
                backgroundColor: appTheme.colors.primarySoft,
                borderColor: appTheme.colors.border
              }
            ]}>
              <Feather color={appTheme.colors.primary} name="shield" size={42} />
            </View>
            <View style={[
              styles.chatPrivacyBadge,
              {
                backgroundColor: appTheme.colors.primary,
                borderColor: appTheme.colors.surfaceElevated
              }
            ]}>
              <Feather color="#FFFFFF" name="lock" size={18} />
            </View>
          </View>

          <Text style={[styles.chatPrivacyTitle, { color: appTheme.colors.ink }]}>Synzapp keeps this conversation private</Text>
          <Text style={[styles.chatPrivacyBody, { color: appTheme.colors.mutedStrong }]}>
            Message text, voice notes, media, and files are encrypted before sync. Synzapp stores encrypted records for delivery and history, while readable content stays limited to approved devices in this {isGroupChat ? 'group' : 'chat'}.
          </Text>

          <View style={styles.chatPrivacyPointList}>
            <ChatPrivacyPoint icon="message-square" label="Messages and replies" />
            <ChatPrivacyPoint icon="mic" label="Voice notes and audio attachments" />
            <ChatPrivacyPoint icon="image" label="Photos, videos, and documents" />
            <ChatPrivacyPoint icon={isGroupChat ? 'users' : 'user-check'} label={isGroupChat ? 'Group membership controls' : 'Verified one-to-one access'} />
            <ChatPrivacyPoint icon="database" label="Encrypted server sync and device cache" />
          </View>

          <Text style={[styles.chatPrivacyFooter, { color: appTheme.colors.muted }]}>
            Delivery status, membership, and audit metadata help the workplace run safely, but message content is opened only inside Synzapp on trusted devices.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function ChatPrivacyPoint({
  icon,
  label
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
}) {
  const appTheme = useAppTheme();

  return (
    <View style={styles.chatPrivacyPointRow}>
      <View style={[
        styles.chatPrivacyPointIcon,
        { backgroundColor: appTheme.colors.primarySoft }
      ]}>
        <Feather color={appTheme.colors.primary} name={icon} size={17} />
      </View>
      <Text style={[styles.chatPrivacyPointText, { color: appTheme.colors.ink }]}>{label}</Text>
    </View>
  );
}

function ChatThreadSearchHeader({
  inputRef,
  matchCount,
  onChangeQuery,
  onClearQuery,
  onClose,
  query
}: {
  inputRef: React.RefObject<TextInput | null>;
  matchCount: number;
  onChangeQuery: (value: string) => void;
  onClearQuery: () => void;
  onClose: () => void;
  query: string;
}) {
  const appTheme = useAppTheme();

  return (
    <View style={styles.chatSearchHeader}>
      <View style={[
        styles.threadSearchBox,
        {
          backgroundColor: appTheme.colors.input,
          borderColor: appTheme.colors.border,
          borderWidth: StyleSheet.hairlineWidth
        }
      ]}>
        <Feather color={appTheme.colors.muted} name="search" size={18} />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={onChangeQuery}
          placeholder="Search"
          placeholderTextColor={appTheme.colors.muted}
          ref={inputRef}
          returnKeyType="search"
          style={[styles.threadSearchInput, { color: appTheme.colors.ink }]}
          value={query}
        />
        {query.trim() ? (
          <Pressable
            accessibilityLabel="Clear search"
            accessibilityRole="button"
            onPress={onClearQuery}
            style={({ pressed }) => [
              styles.chatSearchClearButton,
              { backgroundColor: appTheme.colors.mutedStrong },
              pressed && styles.pressed
            ]}
          >
            <Feather color={appTheme.colors.screen} name="x" size={12} />
          </Pressable>
        ) : null}
      </View>
      {query.trim() && matchCount > 0 ? (
        <Text numberOfLines={1} style={[styles.chatSearchHeaderCount, { color: appTheme.colors.muted }]}>{matchCount}</Text>
      ) : null}
      <Pressable
        accessibilityLabel="Close search"
        accessibilityRole="button"
        onPress={onClose}
        style={({ pressed }) => [
          styles.chatSearchCloseButton,
          { backgroundColor: appTheme.colors.surface },
          pressed && styles.pressed
        ]}
      >
        <Feather color={appTheme.colors.ink} name="x" size={24} />
      </Pressable>
    </View>
  );
}

function ChatSearchDateModal({
  currentDateKey,
  isOpen,
  messages,
  onClose,
  onSelectDate
}: {
  currentDateKey: string | null;
  isOpen: boolean;
  messages: ChatMessage[];
  onClose: () => void;
  onSelectDate: (dateKey: string | null, targetMessageId?: string, shouldClose?: boolean) => void;
}) {
  const appTheme = useAppTheme();
  const defaultDateKey = currentDateKey || getLatestMessageDateKey(messages) || getMessageDateKeyFromDate(new Date());
  const [selectedDate, setSelectedDate] = useState(() => getDateFromDateKey(defaultDateKey));
  const didOpenRef = useRef(false);
  const selectedDateKey = getMessageDateKeyFromDate(selectedDate);
  const visibleMessages = getChatSearchMessagesForDate(messages, selectedDateKey);
  const hasMessagesOnSelectedDate = visibleMessages.length > 0;

  useEffect(() => {
    if (!isOpen) {
      didOpenRef.current = false;
      if (Platform.OS === 'android') {
        void DateTimePickerAndroid.dismiss('date').catch(() => undefined);
      }
      return;
    }

    if (didOpenRef.current) {
      return;
    }

    didOpenRef.current = true;
    const nextDate = getDateFromDateKey(currentDateKey || getLatestMessageDateKey(messages) || getMessageDateKeyFromDate(new Date()));
    let androidOpenTimer: ReturnType<typeof setTimeout> | null = null;

    setSelectedDate(nextDate);

    if (Platform.OS === 'android') {
      androidOpenTimer = setTimeout(() => openAndroidDatePicker(nextDate), 160);
    }

    return () => {
      if (androidOpenTimer) {
        clearTimeout(androidOpenTimer);
      }
    };
  }, [currentDateKey, isOpen, messages]);

  if (!isOpen) {
    return null;
  }

  function handleNativeDateChange(event: DateTimePickerEvent, nextDate?: Date) {
    if (event.type === 'set' && nextDate) {
      setSelectedDate(normalizeChatSearchPickerDate(nextDate));
    }
  }

  function openAndroidDatePicker(dateValue = selectedDate) {
    DateTimePickerAndroid.open({
      display: 'calendar',
      mode: 'date',
      onChange: handleNativeDateChange,
      value: dateValue
    });
  }

  const jumpToSelectedDate = () => {
    const targetMessage = visibleMessages[0];

    if (!targetMessage) {
      return;
    }

    onSelectDate(selectedDateKey, targetMessage.messageId);
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible
    >
      <View style={[
        styles.chatSearchModalRoot,
        { backgroundColor: appTheme.colors.overlay }
      ]}>
        <Pressable
          accessibilityLabel="Close date search"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.chatSearchModalBackdrop}
        />
        <View style={[
          styles.chatSearchModalSheet,
          { backgroundColor: appTheme.colors.surfaceElevated }
        ]}>
          <View style={[styles.chatSearchModalHandle, { backgroundColor: appTheme.colors.divider }]} />
          <View style={styles.chatSearchModalHeader}>
            <Text style={[styles.chatSearchModalTitle, { color: appTheme.colors.ink }]}>Search by date and time</Text>
            <Pressable
              accessibilityLabel="Close date search"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [
                styles.chatSearchModalCloseButton,
                { backgroundColor: appTheme.colors.surface },
                pressed && styles.pressed
              ]}
            >
              <Feather color={appTheme.colors.ink} name="x" size={22} />
            </Pressable>
          </View>

          {Platform.OS === 'android' ? (
            <Pressable
              accessibilityLabel="Choose date"
              accessibilityRole="button"
              onPress={() => openAndroidDatePicker()}
              style={({ pressed }) => [
                styles.chatSearchAndroidDateButton,
                { backgroundColor: appTheme.colors.surface },
                pressed && styles.pressed
              ]}
            >
              <View style={[styles.chatSearchAndroidDateButtonIcon, { backgroundColor: appTheme.colors.primarySoft }]}>
                <Feather color={appTheme.colors.primary} name="calendar" size={20} />
              </View>
              <Text numberOfLines={1} style={[styles.chatSearchAndroidDateButtonText, { color: appTheme.colors.ink }]}>
                {formatChatSearchPickerDate(selectedDate)}
              </Text>
              <Feather color={appTheme.colors.muted} name="chevron-right" size={22} />
            </Pressable>
          ) : (
            <View style={[
              styles.chatSearchNativeDatePickerWrap,
              { backgroundColor: appTheme.colors.surfaceElevated }
            ]}>
              <DateTimePicker
                display="spinner"
                mode="date"
                onChange={handleNativeDateChange}
                style={styles.chatSearchNativeDatePicker}
                textColor={appTheme.colors.ink}
                themeVariant={appTheme.isDark ? 'dark' : 'light'}
                value={selectedDate}
              />
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            disabled={!hasMessagesOnSelectedDate}
            onPress={jumpToSelectedDate}
            style={({ pressed }) => [
              styles.chatSearchJumpDateButton,
              { backgroundColor: appTheme.colors.success },
              pressed && hasMessagesOnSelectedDate && styles.pressed,
              !hasMessagesOnSelectedDate && styles.disabled
            ]}
          >
            <Text style={styles.chatSearchJumpDateText}>Jump to date</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function ChatSearchPersonModal({
  currentUid,
  groupMembers,
  isOpen,
  onClose,
  onSelectPerson,
  profilePhotoHeaders,
  selectedSenderUid
}: {
  currentUid: string;
  groupMembers: ChatGroupMember[];
  isOpen: boolean;
  onClose: () => void;
  onSelectPerson: (senderUid: string | null) => void;
  profilePhotoHeaders?: Record<string, string>;
  selectedSenderUid: string | null;
}) {
  const appTheme = useAppTheme();

  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible
    >
      <View style={[
        styles.chatSearchModalRoot,
        { backgroundColor: appTheme.colors.overlay }
      ]}>
        <Pressable
          accessibilityLabel="Close person search"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.chatSearchModalBackdrop}
        />
        <View style={[
          styles.chatSearchModalSheet,
          { backgroundColor: appTheme.colors.surfaceElevated }
        ]}>
          <View style={[styles.chatSearchModalHandle, { backgroundColor: appTheme.colors.divider }]} />
          <View style={styles.chatSearchModalHeader}>
            <Text style={[styles.chatSearchModalTitle, { color: appTheme.colors.ink }]}>Search by person</Text>
            <Pressable
              accessibilityLabel="Close person search"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [
                styles.chatSearchModalCloseButton,
                { backgroundColor: appTheme.colors.surface },
                pressed && styles.pressed
              ]}
            >
              <Feather color={appTheme.colors.ink} name="x" size={22} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onSelectPerson(null)}
              style={({ pressed }) => [
                styles.chatSearchPersonRow,
                {
                  backgroundColor: appTheme.colors.surfaceElevated,
                  borderBottomColor: appTheme.colors.divider
                },
                pressed && styles.pressed
              ]}
            >
              <View style={[styles.chatSearchPersonAvatar, { backgroundColor: appTheme.colors.primarySoft }]}>
                <Feather color={appTheme.colors.primary} name="users" size={18} />
              </View>
              <Text style={[styles.chatSearchPersonName, { color: appTheme.colors.ink }]}>All people</Text>
              {!selectedSenderUid ? <Feather color={appTheme.colors.primary} name="check" size={18} /> : null}
            </Pressable>

            {groupMembers.map((member) => (
              <Pressable
                accessibilityRole="button"
                key={member.uid}
                onPress={() => onSelectPerson(member.uid)}
                style={({ pressed }) => [
                  styles.chatSearchPersonRow,
                  {
                    backgroundColor: appTheme.colors.surfaceElevated,
                    borderBottomColor: appTheme.colors.divider
                  },
                  pressed && styles.pressed
                ]}
              >
                <ProfileAvatar
                  headers={profilePhotoHeaders}
                  name={member.uid === currentUid ? 'You' : member.displayName}
                  size={38}
                  uri={member.profilePhotoUrl}
                />
                <View style={styles.chatText}>
                  <Text numberOfLines={1} style={[styles.chatSearchPersonName, { color: appTheme.colors.ink }]}>
                    {member.uid === currentUid ? 'You' : member.displayName}
                  </Text>
                  <Text numberOfLines={1} style={[styles.chatSearchPersonRole, { color: appTheme.colors.muted }]}>{member.roleName}</Text>
                </View>
                {selectedSenderUid === member.uid ? <Feather color={appTheme.colors.primary} name="check" size={18} /> : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
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

const MemoizedMessageBubble = React.memo(MessageBubble, areMessageBubblePropsEqual);

/**
 * Media image that degrades instead of going black.
 *
 * A cached file can disappear underneath a stored path - iOS purges the Caches
 * directory under storage pressure, and an app update can move the container.
 * When the file will not load, the embedded thumbnail is used instead. That
 * thumbnail travels inside the message itself, so it is available offline and
 * survives anything that happens to the cache.
 */

export function areChatReactionsEqual(
  previousReactions: ChatMessageReaction[],
  nextReactions: ChatMessageReaction[]
): boolean {
  if (previousReactions === nextReactions) {
    return true;
  }

  if (previousReactions.length !== nextReactions.length) {
    return false;
  }

  return previousReactions.every((reaction, index) => {
    const nextReaction = nextReactions[index];

    return reaction.uid === nextReaction.uid &&
      reaction.emoji === nextReaction.emoji &&
      reaction.reactedAt === nextReaction.reactedAt;
  });
}

export function areChatGroupMembersEqual(
  previousMember: ChatGroupMember | null,
  nextMember: ChatGroupMember | null
): boolean {
  if (previousMember === nextMember) {
    return true;
  }

  if (!previousMember || !nextMember) {
    return false;
  }

  return previousMember.uid === nextMember.uid &&
    previousMember.displayName === nextMember.displayName &&
    previousMember.initials === nextMember.initials &&
    previousMember.profilePhotoUrl === nextMember.profilePhotoUrl;
}

export const GroupMessageSenderAvatar = React.memo(function GroupMessageSenderAvatar({
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
  const photoUrl = member?.profilePhotoUrl || '';
  const authorizationHeader = profilePhotoHeaders?.Authorization || '';
  // Keyed on the values, so scrolling the thread hands Image the same source
  // it already has instead of asking Android to fetch the face again.
  const avatarSource = useMemo(
    () => (photoUrl ? { headers: profilePhotoHeaders, uri: photoUrl } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [authorizationHeader, photoUrl]
  );

  if (member?.profilePhotoUrl && avatarSource) {
    return (
      <Image
        accessibilityLabel={`${member.displayName} profile photo`}
        source={avatarSource}
        style={[styles.groupMessageAvatarImage, placementStyle]}
      />
    );
  }

  return (
    <View style={[styles.groupMessageAvatarFallback, placementStyle]}>
      <Text numberOfLines={1} style={styles.groupMessageAvatarText}>{initials}</Text>
    </View>
  );
});

export function MediaQuickForwardButton({
  isMine,
  onPress
}: {
  isMine: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel="Forward media"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.messageMediaForwardButton,
        isMine ? styles.messageMediaForwardButtonMine : styles.messageMediaForwardButtonTheirs,
        pressed && styles.pressed
      ]}
    >
      <Feather color="#FFFFFF" name="corner-up-right" size={18} />
    </Pressable>
  );
}

function MessageActionOverlay({
  contactName,
  currentUserReactions,
  message,
  onCopy,
  onCreateAction,
  onDelete,
  onDismiss,
  onForward,
  onInfo,
  onOpenReactionPicker,
  onReact,
  onReply,
  onStar,
  starred
}: {
  contactName: string;
  currentUserReactions: string[];
  message: ChatMessage | null;
  onCopy: (message: ChatMessage) => void;
  onCreateAction: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onDismiss: () => void;
  onForward: (message: ChatMessage) => void;
  onInfo: (message: ChatMessage) => void;
  onOpenReactionPicker: (message: ChatMessage) => void;
  onReact: (message: ChatMessage, reaction: string) => void;
  onReply: (message: ChatMessage) => void;
  onStar: (message: ChatMessage) => void;
  starred: boolean;
}) {
  if (!message) {
    return null;
  }

  const messagePreview = getChatMessagePreview(message) || 'Message';
  const messageAuthor = message.isMine ? 'You' : contactName || 'Contact';
  const previewBubbleColor = message.isMine ? '#DCFCE7' : '#FFFFFF';
  const previewTextColor = '#0F172A';
  const visualMedia = getMessageMediaItems(message).find((media) =>
    media.kind === 'image' || media.kind === 'video'
  ) || null;
  const visualMediaPreviewUri = getMediaPreviewUri(visualMedia);
  const visualMediaLabel = visualMedia?.kind === 'video' ? 'Video' : visualMedia?.kind === 'image' ? 'Photo' : '';
  const captionText = message.text.trim();

  return (
    <Modal
      animationType="none"
      hardwareAccelerated
      onRequestClose={onDismiss}
      statusBarTranslucent
      transparent
      visible
    >
      <View style={styles.messageActionOverlay}>
        <BlurView intensity={34} style={styles.messageActionBlurBackdrop} tint="light" />
        <View style={styles.messageActionFastBackdrop} />
        <Pressable
          accessibilityLabel="Close message actions"
          accessibilityRole="button"
          onPress={onDismiss}
          style={styles.messageActionDismiss}
        />

        <View
          pointerEvents="box-none"
          style={styles.messageActionContent}
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
                  const isActive = currentUserReactions.includes(emoji);

                  return (
                    <Pressable
                      accessibilityLabel={`React ${emoji}`}
                      accessibilityRole="button"
                      key={emoji}
                      onPress={() => onReact(message, emoji)}
                      style={({ pressed }) => [
                        styles.messageReactionButton,
                        isActive && styles.messageReactionButtonActive,
                        pressed && styles.messageReactionButtonPressed
                      ]}
                    >
                      <Text style={styles.messageReactionButtonText}>{emoji}</Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  accessibilityLabel="More reactions"
                  accessibilityRole="button"
                  onPress={() => onOpenReactionPicker(message)}
                  style={({ pressed }) => [
                    styles.messageReactionMoreButton,
                    pressed && styles.messageReactionButtonPressed
                  ]}
                >
                  <Feather color="#64748B" name="plus" size={20} />
                </Pressable>
              </ScrollView>
            </View>

            <View
              style={[
                styles.messageActionPreviewCard,
                message.isMine ? styles.messageActionPreviewCardMine : styles.messageActionPreviewCardTheirs,
                { backgroundColor: previewBubbleColor }
              ]}
            >
              {!message.isMine ? (
                <Text numberOfLines={1} style={styles.messageActionPreviewAuthor}>{messageAuthor}</Text>
              ) : null}
              {visualMedia ? (
                <View style={styles.messageActionMediaPreviewFrame}>
                  {visualMediaPreviewUri ? (
                    <Image
                      resizeMode="cover"
                      source={{ uri: visualMediaPreviewUri }}
                      style={styles.messageActionMediaPreviewImage}
                    />
                  ) : (
                    <View style={styles.messageActionMediaPreviewPlaceholder}>
                      <Ionicons
                        color="#94A3B8"
                        name={visualMedia.kind === 'video' ? 'play-circle-outline' : 'image-outline'}
                        size={32}
                      />
                    </View>
                  )}
                  {visualMedia.kind === 'video' ? (
                    <View style={styles.messageActionMediaPreviewPlay}>
                      <Ionicons color="#FFFFFF" name="play" size={22} />
                    </View>
                  ) : null}
                  <View style={styles.messageActionMediaPreviewBadge}>
                    <Feather
                      color="#FFFFFF"
                      name={visualMedia.kind === 'video' ? 'video' : 'image'}
                      size={11}
                    />
                    <Text style={styles.messageActionMediaPreviewBadgeText}>
                      {visualMedia.kind === 'video' ? formatMediaDuration(visualMedia.durationMs) : visualMediaLabel}
                    </Text>
                  </View>
                </View>
              ) : null}
              <Text numberOfLines={visualMedia ? 2 : 3} style={[styles.messageActionPreviewText, { color: previewTextColor }]}>
                {visualMedia ? captionText || visualMediaLabel : messagePreview}
              </Text>
              <Text numberOfLines={1} style={styles.messageActionPreviewMeta}>{formatMessageTime(message.sentAt)}</Text>
            </View>

            <View style={styles.messageActionMenu}>
              <MessageActionRow icon="corner-up-left" label="Reply" onPress={() => onReply(message)} />
              <MessageActionRow icon="corner-up-right" label="Forward" onPress={() => onForward(message)} />
              <MessageActionRow icon="copy" label="Copy" onPress={() => onCopy(message)} />
              <MessageActionRow icon="info" label="Info" onPress={() => onInfo(message)} />
              <MessageActionRow icon="star" label={starred ? 'Unstar' : 'Star'} onPress={() => onStar(message)} />
              <MessageActionRow destructive icon="trash-2" label="Delete" onPress={() => onDelete(message)} />
              <View style={styles.messageActionDivider} />
              {/* One row rather than a "More..." page holding a single item.
                  This menu gets used with gloves on. */}
              <MessageActionRow
                icon="clipboard"
                label="Create Action"
                onPress={() => onCreateAction(message)}
              />

            </View>
          </View>
        </View>
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

/**
 * Somebody's face, or their initials.
 *
 * Memoised, and its image source is memoised inside, because a new `source`
 * object makes Android fetch the image again and flash the initials
 * underneath while it does. The identity of the source has to be as stable as
 * the picture it points at.
 */
export const ProfileAvatar = React.memo(function ProfileAvatar({
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
  const deviceHeader = headers?.['X-Synzapp-Device-Id'] || '';
  const avatarStyle = {
    borderRadius: size / 2,
    height: size,
    width: size
  };

  useEffect(() => {
    setDidImageFail(false);
  }, [authorizationHeader, uri]);

  const isRemote = Boolean(uri && /^https?:\/\//i.test(uri));
  // Keyed on the values, not the object, so a re-render with the same token
  // and the same photo hands Image the very same source it already has.
  const source = useMemo(() => {
    if (!uri) {
      return null;
    }

    return isRemote && headers ? { headers, uri } : { uri };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorizationHeader, deviceHeader, isRemote, uri]);

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
  const canLoadImage = Boolean(uri && !didImageFail && source && (!isRemote || headers));

  if (canLoadImage && source) {
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
});

export function formatMessageDeliveryStatus(status: ChatDeliveryStatus | null): string {
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

export function formatMessageReactionBadge(reactions: ChatMessageReaction[] | undefined): string {
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

export function getReplyAuthorLabel(senderUid: string, currentUid: string, contactName: string): string {
  if (senderUid && currentUid && senderUid === currentUid) {
    return 'You';
  }

  return contactName || 'Message';
}

export function getMediaPreparationKey(messageId: string, media: ChatMediaAttachment, index: number): string {
  return `${messageId}:${media.mediaId || media.localUri || media.fileName}:${index}`;
}

export function isAudioAttachment(media: ChatMediaAttachment): boolean {
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

export function formatAttachmentMeta(media: ChatMediaAttachment): string {
  const typeLabel = media.kind === 'audio'
    ? 'Voice note'
    : media.kind === 'video'
      ? 'Video'
      : getReadableFileExtension(media.fileName) || (isAudioAttachment(media) ? 'Audio' : 'File');

  return `${typeLabel} • ${formatByteCount(media.sizeBytes)}`;
}

export function getChatDocumentThumbnailSource(media: ChatMediaAttachment): ImageSourcePropType {
  const extension = getReadableFileExtension(media.fileName).toLowerCase();

  return companyLibraryDocumentThumbnailSources[extension] ||
    companyLibraryDocumentThumbnailSources.document;
}

export function formatReplyPreviewText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim() || 'Message';
}

function buildMessageThreadItems(
  messages: ChatMessage[],
  actions: ActionRecord[] = []
): MessageThreadItem[] {
  const items: MessageThreadItem[] = [];
  let activeDateKey = '';
  // Sorted once, then drained as the messages are walked, so merging stays
  // linear rather than scanning every action for every message.
  const pending = [...actions].sort((left, right) => left.createdAtMs - right.createdAtMs);
  let nextAction = 0;

  const drainActionsBefore = (untilMs: number) => {
    while (nextAction < pending.length && pending[nextAction].createdAtMs <= untilMs) {
      const action = pending[nextAction];

      items.push({ action, id: `action-${action.actionId}`, type: 'action' });
      nextAction += 1;
    }
  };

  messages.forEach((message) => {
    drainActionsBefore(new Date(message.sentAt).getTime());

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
      // Keyed on the stable client identity so the row is not unmounted and
      // remounted when a queued message is replaced by its server echo. A
      // remount is what makes an in-flight media bubble visibly blink.
      id: getChatMessageRowKey(message),
      message,
      type: 'message'
    });
  });

  drainActionsBefore(Number.MAX_SAFE_INTEGER);

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

export function formatMessageDate(value: string): string {
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

function getChatSearchMatches({
  dateKey,
  messages,
  query,
  senderUid
}: {
  dateKey: string | null;
  messages: ChatMessage[];
  query: string;
  senderUid: string | null;
}): ChatSearchMatch[] {
  const normalizedQuery = normalizeSearchQuery(query);

  if (!normalizedQuery && !dateKey && !senderUid) {
    return [];
  }

  return uniqueChatMessages(messages)
    .filter((message) => {
      if (senderUid && message.senderUid !== senderUid) {
        return false;
      }

      if (dateKey && getMessageDateKey(message.sentAt) !== dateKey) {
        return false;
      }

      if (normalizedQuery && !normalizeSearchQuery(message.text).includes(normalizedQuery)) {
        return false;
      }

      return true;
    })
    .map((message) => ({
      messageId: message.messageId,
      preview: getMessageListPreview(message),
      senderUid: message.senderUid,
      sentAt: message.sentAt
    }));
}

function getChatSearchMessagesForDate(messages: ChatMessage[], dateKey: string): ChatMessage[] {
  return uniqueChatMessages(messages).filter((message) => getMessageDateKey(message.sentAt) === dateKey);
}

function getLatestMessageDateKey(messages: ChatMessage[]): string {
  const latestMessage = uniqueChatMessages(messages).at(-1);

  return latestMessage ? getMessageDateKey(latestMessage.sentAt) : '';
}

function getDateFromDateKey(dateKey: string): Date {
  const [rawYear, rawMonth, rawDay] = dateKey.split('-').map((part) => Number.parseInt(part, 10));
  const fallbackDate = new Date();
  const year = Number.isFinite(rawYear) && rawYear > 0 ? rawYear : fallbackDate.getFullYear();
  const month = Number.isFinite(rawMonth) && rawMonth >= 1 && rawMonth <= 12
    ? rawMonth - 1
    : fallbackDate.getMonth();
  const day = Number.isFinite(rawDay) && rawDay >= 1
    ? Math.min(rawDay, new Date(year, month + 1, 0).getDate())
    : fallbackDate.getDate();

  return new Date(year, month, day, 12);
}

function normalizeChatSearchPickerDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

function getMessageDateKeyFromDate(date: Date): string {
  return buildDateKey(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatChatSearchPickerDate(date: Date): string {
  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function buildDateKey(year: number, month: number, day: number): string {
  return [
    String(year).padStart(4, '0'),
    String(month + 1).padStart(2, '0'),
    String(day).padStart(2, '0')
  ].join('-');
}

export function getMessageListPreview(message: ChatMessage): string {
  if (message.text?.trim()) {
    return message.text.trim();
  }

  const firstMedia = message.mediaItems?.[0] || message.media || message.image || null;

  if (firstMedia) {
    if (firstMedia.kind === 'image') {
      return 'Photo';
    }

    if (firstMedia.kind === 'video') {
      return 'Video';
    }

    if (firstMedia.kind === 'audio') {
      return 'Voice message';
    }

    return firstMedia.fileName || 'File';
  }

  return 'Message';
}

function getChatSearchResultLabel({
  hasFilters,
  matchCount,
  matchIndex
}: {
  hasFilters: boolean;
  matchCount: number;
  matchIndex: number;
}): string {
  if (!hasFilters) {
    return 'Type, choose a date, or pick a person';
  }

  if (!matchCount) {
    return 'No results';
  }

  return `${matchIndex + 1} of ${matchCount}`;
}

function getChatSearchSenderLabel(
  senderUid: string,
  currentUid: string,
  senderNameByUid: Map<string, ChatGroupMember>
): string {
  if (senderUid === currentUid) {
    return 'You';
  }

  return senderNameByUid.get(senderUid)?.displayName || 'Member';
}

export function renderHighlightedMessageText(text: string, query: string): React.ReactNode {
  const safeQuery = query.trim();

  if (!safeQuery) {
    return text;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = safeQuery.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let partIndex = 0;

  while (cursor < text.length) {
    const matchIndex = lowerText.indexOf(lowerQuery, cursor);

    if (matchIndex < 0) {
      parts.push(text.slice(cursor));
      break;
    }

    if (matchIndex > cursor) {
      parts.push(text.slice(cursor, matchIndex));
    }

    parts.push(
      <Text key={`highlight-${partIndex}`} style={styles.messageSearchHighlight}>
        {text.slice(matchIndex, matchIndex + safeQuery.length)}
      </Text>
    );

    cursor = matchIndex + safeQuery.length;
    partIndex += 1;
  }

  return parts;
}

export function normalizeSearchQuery(value: string): string {
  return value.trim().toLowerCase();
}

export function getInitials(name: string): string {
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
