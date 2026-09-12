import * as FileSystem from 'expo-file-system/legacy';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent
} from '@react-native-community/datetimepicker';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AudioMode } from 'expo-audio';
import type { FeatherIconName } from '../../types/featherIcon';
import type { ImageSourcePropType } from 'react-native';
import { ActivityIndicator, Alert, Animated, FlatList, Image, ImageStyle, Keyboard, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { CHAT_AUDIO_PLAYBACK_MODE, safePauseAudioPlayer, safePlayAudioPlayer, safeReplaceAudioPlayerSource } from '../../services/chatAudioPlayback';
import { ChatDeliveryStatus, ChatGroupMember, ChatMediaAttachment, ChatMediaKind, ChatMessage, ChatMessageReaction, ChatMessageReactionMap, ChatReplyReference } from '../../services/chatApi';
import { LocalChatMediaInput } from '../../services/chatMediaApi';
import { MESSAGE_INPUT_MAX_HEIGHT, MESSAGE_INPUT_MIN_HEIGHT, styles } from '../../screens/adminChatStyles';
import { MediaTransferRing } from '../../components/MediaTransferRing';
import {
  createScrollToLatestCoalescer,
  type ScrollToLatestCoalescer
} from './scrollToLatestCoalescer';
import { reportMissingChatMedia } from '../../services/chatMediaRepairQueue';
import { MessageReactionPickerModal } from '../../components/messageReactions/MessageReactionPickerModal';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { buildVoiceNoteWaveform, formatMediaDuration, formatMessageTime, getAudioSeekSeconds, getChatMessagePreview, getReadableFileExtension, isMediaTransferActive } from '../../services/chatMessagePreview';
import { colors } from '../../theme/colors';
import { companyLibraryDocumentThumbnailSources } from '../../services/companyLibraryDisplay';
import {
  formatAudioSeconds,
  formatByteCount,
  getErrorMessage,
  getMediaPreviewUri,
  getMediaTransferLabel,
  resolveBubbleMediaUri
} from '../../services/chatDisplayFormatting';
import { getChatMessageRowKey, getMediaLocalUri, getMessageMediaItems, uniqueChatMessages } from '../../services/chatMessageReconciliation';
import { getKeyboardDismissMode } from '../../components/chatUiPrimitives';
import { useAppTheme } from '../../theme/AppThemeProvider';
import {
  EMPTY_CHAT_REACTIONS,
  GroupMessageSenderAvatar,
  MediaQuickForwardButton,
  ProfileAvatar,
  areChatGroupMembersEqual,
  areChatReactionsEqual,
  formatAttachmentMeta,
  formatMessageDeliveryStatus,
  formatMessageReactionBadge,
  formatReplyPreviewText,
  getChatDocumentThumbnailSource,
  getMediaPreparationKey,
  getReplyAuthorLabel,
  renderHighlightedMessageText,
} from './MessageThread';



export function MessageBubble({
  activeAudioPlaybackId,
  contactName,
  contactProfilePhotoUrl,
  currentUid,
  hideReplyPreview = false,
  highlighted = false,
  isGroupChat = false,
  isSelectable = false,
  isSelected = false,
  message,
  onLayout,
  onForwardMessage,
  onLongPress,
  onOpenMedia,
  onPrepareAttachment,
  preparingVideoKey,
  onActivateAudioPlayback,
  onDeactivateAudioPlayback,
  onReplyPreviewPress,
  onReply,
  onToggleSelect,
  profilePhotoHeaders,
  reactions = [],
  searchQuery = '',
  senderMember,
  starred
}: MessageBubbleProps) {
  const appTheme = useAppTheme();
  const deliveryStatusLabel = message.isMine
    ? formatMessageDeliveryStatus(message.deliveryStatus)
    : '';
  const mediaItems = getMessageMediaItems(message);
  const hasMedia = mediaItems.length > 0;
  const hasForwardableVisualMedia = mediaItems.some((media) =>
    media.kind === 'image' || media.kind === 'video'
  );
  const imageWidth = 222;
  const hasRichBubbleContent = Boolean(message.replyTo || message.forwarded || hasMedia);
  const replyTargetMessageId = message.replyTo?.messageId || '';
  const reactionBadgeLabel = formatMessageReactionBadge(reactions);
  const reactionBadgeOpacity = useRef(new Animated.Value(reactionBadgeLabel ? 1 : 0)).current;
  const reactionBadgeScale = useRef(new Animated.Value(reactionBadgeLabel ? 1 : 0.82)).current;
  const swipeTranslateX = useRef(new Animated.Value(0)).current;
  const isDark = appTheme.isDark;
  const sentBubbleColor = isDark ? '#005C4B' : '#D9FDD3';
  const receivedBubbleColor = isDark ? '#1F1F1F' : appTheme.colors.surfaceElevated;
  /**
   * A reply wears the same colour, dimmed.
   *
   * Not a second shade picked by eye — the ordinary bubble colour with
   * transparency, so the chat background shows through and the bubble reads as
   * a quieter version of itself. A group of answers is then plainly its own
   * run, while staying obviously yours or theirs.
   */
  const sentReplyBubbleColor = isDark ? 'rgba(0, 92, 75, 0.55)' : 'rgba(217, 253, 211, 0.55)';
  const receivedReplyBubbleColor = isDark ? 'rgba(31, 31, 31, 0.72)' : 'rgba(255, 255, 255, 0.72)';
  const bubbleColor = message.isMine
    ? (hideReplyPreview ? sentReplyBubbleColor : sentBubbleColor)
    : (hideReplyPreview ? receivedReplyBubbleColor : receivedBubbleColor);
  const isLightMineBubble = message.isMine && !isDark;
  const bubbleTextColor = isLightMineBubble ? '#111827' : message.isMine || isDark ? '#FFFFFF' : appTheme.colors.ink;
  const bubbleMetaColor = isLightMineBubble ? 'rgba(17, 24, 39, 0.56)' : message.isMine || isDark ? 'rgba(255, 255, 255, 0.68)' : appTheme.colors.muted;
  const bubbleForwardedColor = isLightMineBubble ? 'rgba(17, 24, 39, 0.58)' : message.isMine || isDark ? 'rgba(255, 255, 255, 0.72)' : appTheme.colors.muted;
  const bubbleReadStatusColor = message.isMine ? '#0EA5E9' : '#2563EB';
  const bubbleDeliveredStatusColor = message.isMine ? '#059669' : '#F97316';
  const bubbleQueuedStatusColor = message.isMine ? '#DC2626' : '#DC2626';
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gestureState) =>
      !isSelectable &&
      Boolean(onReply) &&
      gestureState.dx > 14 &&
      Math.abs(gestureState.dy) < 22,
    onMoveShouldSetPanResponderCapture: () => false,
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
    onPanResponderTerminationRequest: () => true,
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
        {message.isMine && hasForwardableVisualMedia && !isSelectable && onForwardMessage ? (
          <MediaQuickForwardButton
            isMine={message.isMine}
            onPress={() => onForwardMessage(message)}
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
            delayLongPress={260}
            onLongPress={!isSelectable && onLongPress ? () => onLongPress(message) : undefined}
            onPress={isSelectable
              ? () => onToggleSelect?.(message)
              : replyTargetMessageId && onReplyPreviewPress
                ? () => onReplyPreviewPress(replyTargetMessageId)
                : undefined}
            style={({ pressed }) => [
              styles.messageBubble,
              message.isMine ? styles.messageBubbleMine : styles.messageBubbleTheirs,
              { backgroundColor: bubbleColor },
              hasMedia && styles.messageBubbleWithImage,
              highlighted && styles.messageBubbleHighlighted,
              pressed && (onLongPress || isSelectable || replyTargetMessageId) && styles.messageBubblePressed
            ]}
          >
            <View style={[
              styles.messageBubbleTail,
              message.isMine ? styles.messageBubbleTailMine : styles.messageBubbleTailTheirs,
              { borderTopColor: bubbleColor }
            ]} />
            {message.forwarded ? (
              <View style={styles.forwardedMessageLabelRow}>
                <Feather color={bubbleForwardedColor} name="corner-up-right" size={12} />
                <Text style={[styles.forwardedMessageLabel, { color: bubbleForwardedColor }]}>Forwarded</Text>
              </View>
            ) : null}
            {message.replyTo && !hideReplyPreview ? (
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
                preparingVideoKey={preparingVideoKey}
                profilePhotoHeaders={profilePhotoHeaders}
                senderName={message.isMine ? 'You' : contactName || 'Contact'}
                senderProfilePhotoUrl={message.isMine ? null : contactProfilePhotoUrl || null}
                width={imageWidth}
              />
            ) : null}
            {message.decryptionFailed ? (
              // Shown rather than hidden. A message this device cannot open is
              // still a message that arrived, and silently dropping it leaves an
              // unread badge pointing at a chat that looks empty.
              <View style={styles.messageBubbleUnreadableRow}>
                <Feather color={bubbleMetaColor} name="lock" size={13} />
                <Text style={[styles.messageBubbleUnreadableText, { color: bubbleMetaColor }]}>
                  This message can't be opened on this device.
                </Text>
              </View>
            ) : message.text.trim() ? (
              <Text style={[
                styles.messageBubbleText,
                { color: bubbleTextColor },
                hasMedia && styles.messageBubbleCaptionText
              ]}>
                {renderHighlightedMessageText(message.text, searchQuery)}
              </Text>
            ) : null}
            <View style={styles.messageBubbleMetaRow}>
              <Text style={[styles.messageBubbleTime, { color: bubbleMetaColor }]}>
                {formatMessageTime(message.sentAt)}
              </Text>
              {starred ? (
                <Feather color={message.isMine || isDark ? '#FBBF24' : '#B45309'} name="star" size={11} />
              ) : null}
              {deliveryStatusLabel ? (
                <Text style={[
                  styles.messageBubbleStatus,
                  { color: bubbleMetaColor },
                  message.deliveryStatus === 'queued' && { color: bubbleQueuedStatusColor },
                  message.deliveryStatus === 'delivered' && { color: bubbleDeliveredStatusColor },
                  message.deliveryStatus === 'read' && { color: bubbleReadStatusColor }
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
        {!message.isMine && hasForwardableVisualMedia && !isSelectable && onForwardMessage ? (
          <MediaQuickForwardButton
            isMine={message.isMine}
            onPress={() => onForwardMessage(message)}
          />
        ) : null}
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

export function MessageMediaPreview({
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
  preparing = false,
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
  preparing?: boolean;
  profilePhotoHeaders?: Record<string, string>;
  senderName: string;
  senderProfilePhotoUrl: string | null;
  sourceUri: string;
  width: number;
}) {
  const appTheme = useAppTheme();
  const isDark = appTheme.isDark;
  const transferLabel = getMediaTransferLabel(media);
  const cardBackgroundColor = isMine
    ? isDark
      ? 'rgba(255, 255, 255, 0.14)'
      : '#EAFDE4'
    : isDark
      ? 'rgba(255, 255, 255, 0.08)'
      : '#F1F5F9';
  const iconBackgroundColor = isDark
    ? 'rgba(255, 255, 255, 0.12)'
    : '#FFFFFF';
  const attachmentTextColor = isDark ? '#FFFFFF' : appTheme.colors.ink;
  const attachmentMetaColor = isDark ? 'rgba(255, 255, 255, 0.72)' : appTheme.colors.muted;
  const attachmentIconColor = isDark ? '#FFFFFF' : appTheme.colors.primary;

  if (media.kind === 'image' || media.kind === 'video') {
    return (
      <Pressable
        accessibilityLabel="Open media"
        accessibilityRole="imagebutton"
        disabled={!onPress}
        delayLongPress={260}
        onLongPress={(event) => {
          event.stopPropagation?.();
          onLongPress?.();
        }}
        onPress={(event) => {
          event.stopPropagation?.();
          onPress?.();
        }}
        style={[
        styles.messageBubbleMediaFrame,
        {
          height,
          width
        }
      ]}>
        <ResilientMediaImage
          fallbackUri={media.thumbnailDataUrl || ''}
          kind={media.kind}
          mediaIndex={0}
          messageId={messageId}
          placeholderSize={34}
          sourceUri={sourceUri}
          style={styles.messageBubbleImage}
        />
        {media.kind === 'video' && !isMediaTransferActive(media) ? (
          <>
            <View style={styles.messageVideoPlayBadge}>
              <Ionicons color="#FFFFFF" name={preparing ? 'hourglass-outline' : 'play'} size={preparing ? 24 : 28} />
            </View>
            <View style={styles.messageVideoDurationBadge}>
              {!preparing ? (
                <Feather color="#FFFFFF" name="video" size={12} />
              ) : null}
              <Text style={styles.messageVideoDurationText}>
                {preparing ? 'Preparing' : formatMediaDuration(media.durationMs)}
              </Text>
            </View>
          </>
        ) : null}
        {/* Replaces the play badge while a transfer runs, so the two never
            fight for the middle of the tile. */}
        <MediaTransferRing media={media} messageId={messageId} />
      </Pressable>
      );
    }

  if (media.kind === 'audio') {
    const audioPlaybackId = `${messageId}:${media.mediaId || media.key || media.localUri || media.fileName}`;

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

  const documentThumbnailSource = getChatDocumentThumbnailSource(media);

  return (
    <Pressable
      accessibilityLabel="Open media"
      accessibilityRole="button"
      delayLongPress={260}
      disabled={!onPress}
      onLongPress={(event) => {
        event.stopPropagation?.();
        onLongPress?.();
      }}
      onPress={(event) => {
        event.stopPropagation?.();
        onPress?.();
      }}
      style={[
      styles.messageAttachmentCard,
      isMine ? styles.messageAttachmentCardMine : styles.messageAttachmentCardTheirs,
      { backgroundColor: cardBackgroundColor }
    ]}>
      <View style={[styles.messageAttachmentIcon, { backgroundColor: iconBackgroundColor }]}>
        <Image
          resizeMode="contain"
          source={documentThumbnailSource}
          style={styles.messageAttachmentThumbnail}
        />
      </View>
      <View style={styles.messageAttachmentText}>
        <Text numberOfLines={1} style={[styles.messageAttachmentName, { color: attachmentTextColor }]}>
          {media.fileName || 'File'}
        </Text>
        <Text numberOfLines={1} style={[styles.messageAttachmentMeta, { color: attachmentMetaColor }]}>
          {transferLabel || formatAttachmentMeta(media)}
        </Text>
      </View>
    </Pressable>
  );
}

export function MessageMediaAlbumPreview({
  activeAudioPlaybackId,
  isMine,
  mediaItems,
  messageId,
  onActivateAudioPlayback,
  onDeactivateAudioPlayback,
  onLongPress,
  onOpenMedia,
  onPrepareMedia,
  preparingVideoKey,
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
  preparingVideoKey?: string | null;
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
        preparing={media.kind === 'video' && preparingVideoKey === getMediaPreparationKey(messageId, media, 0)}
        profilePhotoHeaders={profilePhotoHeaders}
        senderName={senderName}
        senderProfilePhotoUrl={senderProfilePhotoUrl}
        sourceUri={getMediaPreviewUri(media)}
        width={width}
      />
    ) : null;
  }

  const visibleMediaItems = mediaItems.slice(0, 4);
  const hiddenCount = Math.max(mediaItems.length - visibleMediaItems.length, 0);
  const gap = 3;
  const tileSize = Math.floor((width - gap) / 2);
  const albumHeight = tileSize * 2 + gap;
  return (
    <View style={[
      styles.messageAlbumFrame,
      {
        height: albumHeight,
        width
      }
    ]}>
      {visibleMediaItems.map((media, index) => {
        const sourceUri = getMediaPreviewUri(media);
        const isLastVisibleTile = index === visibleMediaItems.length - 1 && hiddenCount > 0;
        const isPreparingVideo = media.kind === 'video' &&
          preparingVideoKey === getMediaPreparationKey(messageId, media, index);

        return (
          <Pressable
            accessibilityLabel={`Open media item ${index + 1}`}
            accessibilityRole="imagebutton"
            key={`${media.mediaId || media.localUri || media.fileName}_${index}`}
            delayLongPress={260}
            onLongPress={(event) => {
              event.stopPropagation?.();
              onLongPress?.();
            }}
            onPress={(event) => {
              event.stopPropagation?.();
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
            <ResilientMediaImage
              fallbackUri={media.thumbnailDataUrl || ''}
              kind={media.kind}
              mediaIndex={index}
              messageId={messageId}
              placeholderSize={32}
              sourceUri={sourceUri}
              style={styles.messageBubbleImage}
            />
            {media.kind === 'video' ? (
              <View style={styles.messageAlbumVideoBadge}>
                {!isPreparingVideo ? (
                  <Feather color="#FFFFFF" name="video" size={12} />
                ) : null}
                <Text style={styles.messageAlbumVideoText}>
                  {isPreparingVideo ? 'Preparing' : formatMediaDuration(media.durationMs)}
                </Text>
              </View>
            ) : null}
            {isLastVisibleTile ? (
              <View style={styles.messageAlbumMoreOverlay}>
                <Text style={styles.messageAlbumMoreText}>+{hiddenCount}</Text>
              </View>
            ) : null}
            <MediaTransferRing
              media={media}
              mediaIndex={index}
              messageId={messageId}
            />
          </Pressable>
        );
      })}

    </View>
  );
}

export function AudioMessageAttachment({
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
  const appTheme = useAppTheme();
  const isDark = appTheme.isDark;
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
  const isLightMineVoice = isMine && !isDark;
  const voiceAccentColor = isLightMineVoice
    ? appTheme.colors.primary
    : isMine || isDark
      ? '#FFFFFF'
      : appTheme.colors.primary;
  const cardBackgroundColor = isMine
    ? isDark
      ? 'rgba(255, 255, 255, 0.15)'
      : '#EAFDE4'
    : isDark
      ? 'rgba(255, 255, 255, 0.08)'
      : '#F1F5F9';
  const iconBackgroundColor = isLightMineVoice
    ? 'rgba(255, 255, 255, 0.94)'
    : isMine || isDark
      ? 'rgba(255, 255, 255, 0.18)'
      : '#FFFFFF';
  const voiceMetaColor = isLightMineVoice
    ? 'rgba(15, 23, 42, 0.62)'
    : isMine || isDark
      ? 'rgba(255, 255, 255, 0.78)'
      : appTheme.colors.muted;
  const voiceInactiveWaveColor = isLightMineVoice
    ? 'rgba(20, 120, 105, 0.28)'
    : isMine || isDark
      ? 'rgba(255, 255, 255, 0.32)'
      : 'rgba(100, 116, 139, 0.34)';

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
      delayLongPress={260}
      onLongPress={(event) => {
        event.stopPropagation?.();
        onLongPress?.();
      }}
      onPress={(event) => {
        event.stopPropagation?.();
        void handleTogglePlayback().catch((error) => {
          Alert.alert('Audio unavailable', getErrorMessage(error, 'Unable to play this audio.'));
        });
      }}
      style={({ pressed }) => [
        styles.messageVoiceNoteCard,
        isMine ? styles.messageAttachmentCardMine : styles.messageAttachmentCardTheirs,
        { backgroundColor: cardBackgroundColor },
        pressed && styles.pressed
      ]}
    >
      <View style={[
        styles.messageVoiceNotePlayButton,
        isMine ? styles.messageVoiceNotePlayButtonMine : styles.messageVoiceNotePlayButtonTheirs,
        { backgroundColor: iconBackgroundColor }
      ]}>
        {isPreparing ? (
          <ActivityIndicator color={voiceAccentColor} size="small" />
        ) : (
          <Ionicons
            color={voiceAccentColor}
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
            event.stopPropagation?.();
            void handleSeekVoiceNote(event.nativeEvent.locationX);
          }}
          onResponderMove={(event) => {
            event.stopPropagation?.();
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
                    ? voiceAccentColor
                    : voiceInactiveWaveColor,
                  height: heightValue
                }
              ]}
            />
          ))}
        </View>
        <View style={styles.messageVoiceNoteMetaRow}>
          <Text numberOfLines={1} style={[styles.messageAttachmentMeta, { color: voiceMetaColor }]}>
            {transferLabel || (status.playing || status.currentTime > 0 ? positionLabel : durationLabel)}
          </Text>
          {media.transferStatus === 'uploading' ||
          media.transferStatus === 'queued' ||
          media.transferStatus === 'preparing' ? (
            <Text numberOfLines={1} style={[styles.messageVoiceNoteMetaDot, { color: voiceMetaColor }]}>
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

export function BubbleReplyPreview({
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
  const appTheme = useAppTheme();
  const isDark = appTheme.isDark;
  const replyPreviewBackground = isMine
    ? 'rgba(255, 255, 255, 0.15)'
    : isDark
      ? 'rgba(255, 255, 255, 0.08)'
      : '#F1F5F9';
  const replyTextColor = isMine || isDark
    ? 'rgba(255, 255, 255, 0.82)'
    : appTheme.colors.mutedStrong;
  const replyAuthorColor = replyTo.senderUid === currentUid
    ? isMine || isDark ? '#F0ABFC' : '#C026D3'
    : isMine || isDark ? '#5EEAD4' : appTheme.colors.primary;

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
      isMine ? styles.bubbleReplyPreviewMine : styles.bubbleReplyPreviewTheirs,
      { backgroundColor: replyPreviewBackground }
    ]}>
      <View style={[
        styles.bubbleReplyAccent,
        isMine ? styles.bubbleReplyAccentMine : styles.bubbleReplyAccentTheirs,
        { backgroundColor: isMine ? '#F472B6' : appTheme.colors.primary }
      ]} />
      <View style={styles.bubbleReplyTextWrap}>
        <Text numberOfLines={1} style={[
          styles.bubbleReplyAuthor,
          replyTo.senderUid === currentUid ? styles.replyAuthorMine : styles.replyAuthorTheirs,
          { color: replyAuthorColor }
        ]}>
          {getReplyAuthorLabel(replyTo.senderUid, currentUid, contactName)}
        </Text>
        <Text numberOfLines={2} style={[styles.bubbleReplyText, { color: replyTextColor }]}>
          {formatReplyPreviewText(replyTo.text)}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Draws media, falling back to its thumbnail when the file will not load.
 *
 * Every URI that fails is remembered, not just the last one. Recording only the
 * most recent failure meant that when the fallback failed too it overwrote the
 * record of the source failing, the source was chosen again, and the component
 * flipped between two broken URIs forever.
 *
 * A source that fails is also reported. The source is the local file, so a
 * failure means the file is gone from disk — deleted with the app, or reclaimed
 * by iOS — and the screen can re-download exactly that attachment instead of
 * leaving a blank tile with nothing to fix it.
 */
export function ResilientMediaImage({
  fallbackUri,
  kind,
  mediaIndex,
  messageId,
  placeholderSize,
  sourceUri,
  style
}: {
  fallbackUri: string;
  kind: ChatMediaKind;
  mediaIndex?: number;
  messageId?: string;
  placeholderSize: number;
  sourceUri: string;
  style: StyleProp<ImageStyle>;
}) {
  const [failedUris, setFailedUris] = useState<string[]>([]);
  // A video is drawn from its poster and never from the video file. See
  // resolveBubbleMediaUri: an Image pointed at an mp4 draws nothing and, on
  // iOS, usually reports no error either, so the tile never recovered.
  const activeUri = resolveBubbleMediaUri({ fallbackUri, failedUris, kind, sourceUri });

  useEffect(() => {
    setFailedUris([]);
  }, [fallbackUri, sourceUri]);

  function handleError() {
    setFailedUris((current) => current.includes(activeUri) ? current : [...current, activeUri]);

    // Only a local file is worth repairing. A data URL thumbnail that fails is
    // simply corrupt, and re-downloading the original would not replace it.
    if (activeUri === sourceUri && messageId && !sourceUri.startsWith('data:')) {
      reportMissingChatMedia({ mediaIndex: mediaIndex || 0, messageId, sourceUri });
    }
  }

  if (!activeUri) {
    return (
      <View style={styles.messageBubbleMediaPlaceholder}>
        <Ionicons
          color="#94A3B8"
          name={kind === 'video' ? 'play-circle-outline' : 'image-outline'}
          size={placeholderSize}
        />
      </View>
    );
  }

  return (
    <Image
      onError={handleError}
      resizeMode="cover"
      source={{ uri: activeUri }}
      style={style}
    />
  );
}

export function areMessageBubblePropsEqual(
  previousProps: MessageBubbleProps,
  nextProps: MessageBubbleProps
): boolean {
  return previousProps.message === nextProps.message &&
    previousProps.activeAudioPlaybackId === nextProps.activeAudioPlaybackId &&
    previousProps.contactName === nextProps.contactName &&
    previousProps.contactProfilePhotoUrl === nextProps.contactProfilePhotoUrl &&
    previousProps.currentUid === nextProps.currentUid &&
    previousProps.hideReplyPreview === nextProps.hideReplyPreview &&
    previousProps.highlighted === nextProps.highlighted &&
    previousProps.isGroupChat === nextProps.isGroupChat &&
    previousProps.isSelectable === nextProps.isSelectable &&
    previousProps.isSelected === nextProps.isSelected &&
    previousProps.preparingVideoKey === nextProps.preparingVideoKey &&
    previousProps.profilePhotoHeaders === nextProps.profilePhotoHeaders &&
    previousProps.searchQuery === nextProps.searchQuery &&
    previousProps.starred === nextProps.starred &&
    areChatGroupMembersEqual(previousProps.senderMember || null, nextProps.senderMember || null) &&
    areChatReactionsEqual(previousProps.reactions || EMPTY_CHAT_REACTIONS, nextProps.reactions || EMPTY_CHAT_REACTIONS);
}

export type MessageBubbleProps = {
  activeAudioPlaybackId?: string | null;
  contactName?: string;
  contactProfilePhotoUrl?: string | null;
  currentUid?: string;
  /**
   * Drops the quoted parent from inside the bubble.
   *
   * Set for every bubble in a reply group: the group already carries one
   * wireframe copy of the message being answered at its head, and repeating it
   * inside each reply made four answers four times as tall and buried the
   * answers themselves.
   */
  hideReplyPreview?: boolean;
  highlighted?: boolean;
  isGroupChat?: boolean;
  isSelectable?: boolean;
  isSelected?: boolean;
  message: ChatMessage;
  onLayout?: (messageId: string, y: number) => void;
  onForwardMessage?: (message: ChatMessage) => void;
  onLongPress?: (message: ChatMessage) => void;
  onOpenMedia?: (message: ChatMessage, activeIndex: number) => void;
  onPrepareAttachment?: (message: ChatMessage, activeIndex: number) => Promise<string | null>;
  preparingVideoKey?: string | null;
  onActivateAudioPlayback?: (audioPlaybackId: string) => void;
  onDeactivateAudioPlayback?: (audioPlaybackId: string) => void;
  onReplyPreviewPress?: (messageId: string) => void;
  onReply?: (message: ChatMessage) => void;
  onToggleSelect?: (message: ChatMessage) => void;
  profilePhotoHeaders?: Record<string, string>;
  reactions?: ChatMessageReaction[];
  searchQuery?: string;
  senderMember?: ChatGroupMember | null;
  starred?: boolean;
};
