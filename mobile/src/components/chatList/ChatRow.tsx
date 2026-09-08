import Feather from '@expo/vector-icons/Feather';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, Pressable, Text, View } from 'react-native';
import { CHAT_ROW_LEFT_ACTION_WIDTH, CHAT_ROW_RIGHT_ACTION_WIDTH, CHAT_ROW_SWIPE_TRIGGER, styles } from '../../screens/adminChatStyles';
import { ChatItem } from '../../components/groups/GroupInfoModal';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { formatChatListTime } from '../../components/contacts/ContactInfoModal';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * A row in the chat list, with its swipe actions.
 *
 * Lifted out of the chat screen unchanged.
 */

export function ChatRow({
  chat,
  onArchive,
  onMore,
  onOpen,
  onToggleFavorite,
  onTogglePin,
  profilePhotoHeaders,
  scheduledState,
  typingText
}: {
  chat: ChatItem;
  onArchive: () => void;
  onMore: () => void;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onTogglePin: () => void;
  profilePhotoHeaders?: Record<string, string>;
  /**
   * Whether this conversation has a message waiting, or one that failed.
   *
   * Shown here because a scheduled message otherwise only exists inside the
   * chat it belongs to: a message that could not be sent, in a thread nobody
   * opens, was invisible.
   */
  scheduledState?: { failed: number; waiting: number };
  /** Replaces the preview while somebody is writing, the way every chat app does. */
  typingText?: string | null;
}) {
  const appTheme = useAppTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const offsetRef = useRef(0);
  const canSwipe = canSwipeChatRow(chat);
  const canUseLifecycleActions = canUseChatListActions(chat);
  const rightSwipeWidth = canUseLifecycleActions
    ? CHAT_ROW_RIGHT_ACTION_WIDTH
    : CHAT_ROW_RIGHT_ACTION_WIDTH / 2;

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

  const snapSwipe = (toValue: number) => {
    offsetRef.current = toValue;
    Animated.spring(translateX, {
      damping: 20,
      mass: 0.75,
      stiffness: 170,
      toValue,
      useNativeDriver: true
    }).start();
  };

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gestureState) =>
      canSwipe &&
      Math.abs(gestureState.dx) > 4 &&
      Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.08,
    onMoveShouldSetPanResponderCapture: (_event, gestureState) =>
      canSwipe &&
      Math.abs(gestureState.dx) > 6 &&
      Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.08,
    onPanResponderGrant: () => {
      translateX.stopAnimation((value) => {
        offsetRef.current = value;
      });
    },
    onPanResponderMove: (_event, gestureState) => {
      const nextValue = Math.max(
        -rightSwipeWidth,
        Math.min(CHAT_ROW_LEFT_ACTION_WIDTH, offsetRef.current + gestureState.dx)
      );

      translateX.setValue(nextValue);
    },
    onPanResponderRelease: (_event, gestureState) => {
      const intendedLeft = gestureState.dx <= -CHAT_ROW_SWIPE_TRIGGER || gestureState.vx <= -0.18;
      const intendedRight = gestureState.dx >= CHAT_ROW_SWIPE_TRIGGER || gestureState.vx >= 0.18;

      if (intendedLeft) {
        snapSwipe(-rightSwipeWidth);
        return;
      }

      if (intendedRight) {
        snapSwipe(CHAT_ROW_LEFT_ACTION_WIDTH);
        return;
      }

      closeSwipe();
    },
    onPanResponderTerminate: closeSwipe,
    onPanResponderTerminationRequest: () => false,
    onStartShouldSetPanResponder: () => false
  }), [canSwipe, rightSwipeWidth, translateX]);

  useEffect(() => {
    closeSwipe();
  }, [chat.contactId, chat.isArchived, chat.isFavorite, chat.isPinned]);

  const runSwipeAction = (action: () => void) => {
    closeSwipe();
    action();
  };

  return (
    <View style={[
      styles.chatSwipeShell,
      { backgroundColor: appTheme.colors.groupedBackground }
    ]}>
      {canSwipe ? (
        <View pointerEvents={offsetRef.current > 0 ? 'auto' : 'box-none'} style={styles.chatSwipeLeftActions}>
          <Pressable
            accessibilityLabel={chat.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            accessibilityRole="button"
            onPress={() => runSwipeAction(onToggleFavorite)}
            style={({ pressed }) => [styles.chatSwipeAction, styles.chatSwipeFavoriteAction, pressed && styles.pressed]}
          >
            <Feather color="#FFFFFF" name="star" size={21} />
            <Text style={styles.chatSwipeActionText}>{chat.isFavorite ? 'Saved' : 'Favorite'}</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={chat.isPinned ? 'Unpin chat' : 'Pin chat'}
            accessibilityRole="button"
            onPress={() => runSwipeAction(onTogglePin)}
            style={({ pressed }) => [styles.chatSwipeAction, styles.chatSwipePinAction, pressed && styles.pressed]}
          >
            <Feather color="#FFFFFF" name="map-pin" size={20} />
            <Text style={styles.chatSwipeActionText}>{chat.isPinned ? 'Pinned' : 'Pin'}</Text>
          </Pressable>
        </View>
      ) : null}

      {canSwipe ? (
        <View style={[styles.chatSwipeRightActions, { width: rightSwipeWidth }]}>
          <Pressable
            accessibilityLabel="More chat actions"
            accessibilityRole="button"
            onPress={() => runSwipeAction(onMore)}
            style={({ pressed }) => [
              styles.chatSwipeAction,
              styles.chatSwipeMoreAction,
              !canUseLifecycleActions && { width: rightSwipeWidth },
              pressed && styles.pressed
            ]}
          >
            <Feather color="#FFFFFF" name="more-horizontal" size={21} />
            <Text style={styles.chatSwipeActionText}>More</Text>
          </Pressable>
          {canUseLifecycleActions ? (
            <Pressable
              accessibilityLabel={chat.isArchived ? 'Unarchive chat' : 'Archive chat'}
              accessibilityRole="button"
              onPress={() => runSwipeAction(onArchive)}
              style={({ pressed }) => [styles.chatSwipeAction, styles.chatSwipeArchiveAction, pressed && styles.pressed]}
            >
              <Feather color="#FFFFFF" name={chat.isArchived ? 'inbox' : 'archive'} size={20} />
              <Text style={styles.chatSwipeActionText}>{chat.isArchived ? 'Unarchive' : 'Archive'}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Animated.View
        style={[
          styles.chatSwipeContent,
          { backgroundColor: appTheme.colors.groupedBackground },
          { transform: [{ translateX }] }
        ]}
        {...(canSwipe ? panResponder.panHandlers : {})}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (offsetRef.current !== 0) {
              closeSwipe();
              return;
            }

            onOpen();
          }}
          style={({ pressed }) => [
            styles.chatRow,
            styles.contactChatRow,
            { backgroundColor: appTheme.colors.groupedBackground },
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
            <View style={styles.chatTitleRow}>
              <Text
                numberOfLines={1}
                style={[
                  styles.chatTitle,
                  styles.chatListTitle,
                  { color: appTheme.colors.ink }
                ]}
              >
                {chat.title}
              </Text>
              {chat.isFavorite ? <Feather color="#F59E0B" name="star" size={13} /> : null}
              {scheduledState?.failed ? (
                <Feather color={appTheme.colors.destructive} name="alert-circle" size={13} />
              ) : scheduledState?.waiting ? (
                <Feather color={appTheme.colors.primary} name="clock" size={13} />
              ) : null}
            </View>
            {typingText ? (
              // Takes the preview's place rather than sitting beside it. The row
              // has one line, and what somebody is about to say matters more
              // than what was last said.
              <Text numberOfLines={1} style={[styles.chatPreview, { color: appTheme.colors.primary }]}>
                {typingText}
              </Text>
            ) : getChatListPreviewText(chat) ? (
              <Text numberOfLines={2} style={[styles.chatPreview, { color: appTheme.colors.muted }]}>
                {getChatListPreviewText(chat)}
              </Text>
            ) : !chat.hasActiveDevice ? (
              <Text numberOfLines={1} style={[styles.chatPreview, { color: appTheme.colors.muted }]}>
                Waiting for secure device
              </Text>
            ) : null}
          </View>

          <View style={styles.chatMeta}>
            {chat.lastMessageAt ? (
              <Text style={[styles.chatTime, { color: appTheme.colors.muted }]}>
                {formatChatListTime(chat.lastMessageAt)}
              </Text>
            ) : null}
            {chat.isPinned ? (
              <Feather color={appTheme.colors.muted} name="map-pin" size={14} />
            ) : null}
            {chat.unreadCount > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{chat.unreadCount > 99 ? '99+' : chat.unreadCount}</Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.chatRowDivider, { backgroundColor: appTheme.colors.separator }]} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

export function getChatListPreviewText(chat: ChatItem): string {
  if (isChatItemClearedThroughLastMessage(chat)) {
    return '';
  }

  const preview = chat.preview.trim();

  if (preview) {
    return preview;
  }

  return chat.lastMessageAt ? 'Message' : '';
}

export function canUseChatListActions(chat: ChatItem): boolean {
  if (chat.chatType !== 'GROUP') {
    return true;
  }

  return chat.isDepartmentDefault !== true &&
    chat.memberPolicy !== 'DEPARTMENT_PLUS_EXPLICIT';
}

export function canSwipeChatRow(chat: ChatItem): boolean {
  return chat.status !== 'DELETED' && chat.isSpam !== true;
}

function isChatItemClearedThroughLastMessage(chat: Pick<ChatItem, 'clearedAt' | 'lastMessageAt'>): boolean {
  return isClearedThroughTimestamp(chat.clearedAt || null, chat.lastMessageAt || null);
}

export function isClearedThroughTimestamp(clearedAt: string | null, lastMessageAt: string | null): boolean {
  const clearedAtMs = getTimestampMs(clearedAt);

  if (clearedAtMs === null) {
    return false;
  }

  const lastMessageAtMs = getTimestampMs(lastMessageAt);

  return lastMessageAtMs === null || lastMessageAtMs <= clearedAtMs;
}

export function getTimestampMs(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const timestampMs = Date.parse(value);

  return Number.isFinite(timestampMs) ? timestampMs : null;
}
