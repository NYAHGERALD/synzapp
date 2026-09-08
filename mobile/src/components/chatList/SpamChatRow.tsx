import Feather from '@expo/vector-icons/Feather';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, Pressable, Text, View } from 'react-native';
import { CHAT_ROW_SWIPE_TRIGGER, SPAM_ROW_ACTION_WIDTH, styles } from '../../screens/adminChatStyles';
import { ChatItem } from '../../components/groups/GroupInfoModal';
import { ChatTrashSegment } from '../../services/chatApi';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { formatChatListTime } from '../../components/contacts/ContactInfoModal';
import { getChatListPreviewText } from '../../components/chatList/ChatRow';

/**
 * Spam chat rows and their status controls.
 *
 * Lifted out of the chat screen unchanged.
 */

export function SpamChatRow({
  chat,
  isDeleting,
  onDelete,
  onOpen,
  profilePhotoHeaders
}: {
  chat: ChatItem;
  isDeleting: boolean;
  onDelete: () => void;
  onOpen: () => void;
  profilePhotoHeaders?: Record<string, string>;
}) {
  const latestTrashSegment = getActiveTrashSegments(chat)[0] || null;
  const spamTime = latestTrashSegment?.deletedAt || chat.spammedAt || chat.lastMessageAt;
  const translateX = useRef(new Animated.Value(0)).current;
  const offsetRef = useRef(0);

  const closeSwipe = () => {
    offsetRef.current = 0;
    Animated.spring(translateX, {
      damping: 20,
      mass: 0.75,
      stiffness: 170,
      toValue: 0,
      useNativeDriver: true
    }).start();
  };

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gestureState) =>
      !isDeleting &&
      Math.abs(gestureState.dx) > 4 &&
      Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.08,
    onMoveShouldSetPanResponderCapture: (_event, gestureState) =>
      !isDeleting &&
      Math.abs(gestureState.dx) > 6 &&
      Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.08,
    onPanResponderGrant: () => {
      translateX.stopAnimation((value) => {
        offsetRef.current = value;
      });
    },
    onPanResponderMove: (_event, gestureState) => {
      const nextValue = Math.max(
        -SPAM_ROW_ACTION_WIDTH,
        Math.min(0, offsetRef.current + gestureState.dx)
      );

      translateX.setValue(nextValue);
    },
    onPanResponderRelease: (_event, gestureState) => {
      const intendedDelete = gestureState.dx <= -CHAT_ROW_SWIPE_TRIGGER || gestureState.vx <= -0.18;
      closeSwipe();

      if (intendedDelete) {
        onDelete();
      }
    },
    onPanResponderTerminate: closeSwipe,
    onPanResponderTerminationRequest: () => false,
    onStartShouldSetPanResponder: () => false
  }), [isDeleting, onDelete, translateX]);

  useEffect(() => {
    closeSwipe();
  }, [chat.contactId, chat.isSpam, isDeleting]);

  return (
    <View style={styles.spamSwipeShell}>
      <View style={styles.spamSwipeRightActions}>
        <View style={[styles.spamSwipeAction, styles.spamSwipeDeleteAction]}>
          <Feather color="#FFFFFF" name="trash-2" size={20} />
          <Text style={styles.chatSwipeActionText}>Delete</Text>
        </View>
      </View>

      <Animated.View
        style={[
          styles.chatSwipeContent,
          { transform: [{ translateX }] }
        ]}
        {...panResponder.panHandlers}
      >
        <Pressable
          accessibilityLabel={`Open Trash history for ${chat.title}`}
          accessibilityRole="button"
          onPress={onOpen}
          style={({ pressed }) => [styles.spamChatRow, pressed && styles.pressed]}
        >
          <ProfileAvatar
            headers={profilePhotoHeaders}
            name={chat.title}
            size={50}
            uri={chat.profilePhotoUrl}
          />

          <View style={styles.spamChatText}>
            <View style={styles.chatTitleRow}>
              <Text numberOfLines={1} style={[styles.chatTitle, styles.chatListTitle]}>{chat.title}</Text>
              {chat.isFavorite ? <Feather color="#F59E0B" name="star" size={13} /> : null}
            </View>
            <View style={styles.spamChatSubtitleRow}>
              <Feather color="#8B95A5" name="slash" size={13} />
              <Text numberOfLines={1} style={styles.spamChatSubtitle}>
                {getTrashRowSubtitle(chat)}
              </Text>
            </View>
            {getChatListPreviewText(chat) ? (
              <Text numberOfLines={1} style={styles.chatPreview}>{getChatListPreviewText(chat)}</Text>
            ) : null}
          </View>

          <View style={styles.spamChatMeta}>
            {spamTime ? (
              <Text style={styles.chatTime}>{formatChatListTime(spamTime)}</Text>
            ) : null}
            {chat.unreadCount > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{chat.unreadCount > 99 ? '99+' : chat.unreadCount}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export function getActiveTrashSegments(chat: Pick<ChatItem, 'spammedAt' | 'trashSegments'>): ChatTrashSegment[] {
  const nowMs = Date.now();
  const activeSegments = (chat.trashSegments || []).filter((segment) => segment.expiresAtMs > nowMs);

  if (activeSegments.length) {
    return activeSegments.sort((first, second) => second.deletedAtMs - first.deletedAtMs);
  }

  if (!chat.spammedAt) {
    return [];
  }

  const deletedAtMs = Date.parse(chat.spammedAt);

  if (!Number.isFinite(deletedAtMs)) {
    return [];
  }

  const expiresAtMs = deletedAtMs + 30 * 24 * 60 * 60 * 1000;

  if (expiresAtMs <= nowMs) {
    return [];
  }

  return [{
    deletedAt: new Date(deletedAtMs).toISOString(),
    deletedAtMs,
    endAtMs: null,
    expiresAt: new Date(expiresAtMs).toISOString(),
    expiresAtMs,
    segmentId: '',
    startAtMs: null
  }];
}

function getTrashRowSubtitle(chat: ChatItem): string {
  const segments = getActiveTrashSegments(chat);
  const segmentCount = Math.max(segments.length, chat.isSpam ? 1 : 0);
  const latestSegment = segments[0] || null;
  const countLabel = segmentCount === 1 ? '1 deleted chat' : `${segmentCount} deleted chats`;
  const expiryLabel = latestSegment ? getTrashExpiryLabel(latestSegment.expiresAtMs) : 'Deletes after 30 days';

  return `${countLabel} · ${expiryLabel}`;
}

export function getTrashExpiryLabel(expiresAtMs: number): string {
  const remainingMs = expiresAtMs - Date.now();

  if (remainingMs <= 0) {
    return 'Deletes soon';
  }

  const remainingDays = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));

  return remainingDays === 1 ? 'Deletes in 1 day' : `Deletes in ${remainingDays} days`;
}
