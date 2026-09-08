import Feather from '@expo/vector-icons/Feather';
import React, { useMemo } from 'react';
import { ChatItem } from '../../components/groups/GroupInfoModal';
import { ChatMessage } from '../../services/chatApi';
import { ChatSearchBar, getKeyboardDismissMode } from '../../components/chatUiPrimitives';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { formatMessageTime } from '../../services/chatMessagePreview';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { getMessageListPreview, normalizeSearchQuery } from '../../components/messages/MessageThread';
import { styles } from '../../screens/adminChatStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The message list picker.
 *
 * Lifted out of the chat screen unchanged.
 */

export type MessageListModalMode = 'search' | 'starred';

export function MessageListModal({
  chat,
  currentUid,
  isOpen,
  messages,
  mode,
  onChangeSearch,
  onClose,
  search,
  starredMessageIds
}: {
  chat: ChatItem | null;
  currentUid: string;
  isOpen: boolean;
  messages: ChatMessage[];
  mode: MessageListModalMode;
  onChangeSearch: (value: string) => void;
  onClose: () => void;
  search: string;
  starredMessageIds: Record<string, boolean>;
}) {
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);
  const senderNameByUid = useMemo(() => new Map(
    (chat?.members || []).map((member) => [member.uid, member.displayName])
  ), [chat?.members]);

  if (!chat || chat.chatType !== 'GROUP') {
    return null;
  }

  const visibleMessages = filterMessageListModalMessages(messages, mode, search, starredMessageIds);
  const title = mode === 'starred' ? 'Starred messages' : 'Search messages';

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
          <Pressable
            accessibilityLabel="Close messages"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.newChatHeaderIconButton, pressed && styles.pressed]}
          >
            <Feather color={colors.ink} name="x" size={24} />
          </Pressable>
          <View style={styles.newChatCenteredTitleWrap}>
            <Text numberOfLines={1} style={styles.newChatHeaderTitle}>{title}</Text>
            <Text numberOfLines={1} style={styles.newChatHeaderSubtitle}>{chat.title}</Text>
          </View>
          <View style={styles.newChatHeaderSpacer} />
        </View>

        {mode === 'search' ? (
          <ChatSearchBar
            onChangeText={onChangeSearch}
            placeholder="Search messages"
            value={search}
          />
        ) : null}

        <ScrollView
          keyboardDismissMode={getKeyboardDismissMode()}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.newChatContactList}
        >
          {visibleMessages.map((message) => (
            <View key={message.messageId} style={styles.messageListRow}>
              <View style={styles.messageListIcon}>
                <Feather
                  color={message.senderUid === currentUid ? colors.primary : '#64748B'}
                  name={mode === 'starred' ? 'star' : 'message-circle'}
                  size={18}
                />
              </View>
              <View style={styles.chatText}>
                <View style={styles.messageListMetaRow}>
                  <Text numberOfLines={1} style={styles.messageListSender}>
                    {getGroupMessageSenderName(message, currentUid, senderNameByUid)}
                  </Text>
                  <Text numberOfLines={1} style={styles.messageListTime}>{formatMessageTime(message.sentAt)}</Text>
                </View>
                <Text numberOfLines={2} style={styles.messageListPreview}>
                  {getMessageListPreview(message)}
                </Text>
              </View>
            </View>
          ))}

          {!visibleMessages.length ? (
            <Text style={styles.batchEmpty}>
              {mode === 'starred'
                ? 'No starred messages yet'
                : search.trim()
                  ? 'No messages found'
                  : 'Type to search messages'}
            </Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function filterMessageListModalMessages(
  messages: ChatMessage[],
  mode: MessageListModalMode,
  search: string,
  starredMessageIds: Record<string, boolean>
): ChatMessage[] {
  const baseMessages = mode === 'starred'
    ? messages.filter((message) => Boolean(starredMessageIds[message.messageId]))
    : messages;
  const query = normalizeSearchQuery(search);

  if (mode === 'starred' || !query) {
    return [...baseMessages].reverse();
  }

  return baseMessages
    .filter((message) => normalizeSearchQuery(getMessageListPreview(message)).includes(query))
    .reverse();
}

function getGroupMessageSenderName(
  message: ChatMessage,
  currentUid: string,
  senderNameByUid: Map<string, string>
): string {
  if (message.senderUid === currentUid) {
    return 'You';
  }

  return senderNameByUid.get(message.senderUid) || 'Member';
}
