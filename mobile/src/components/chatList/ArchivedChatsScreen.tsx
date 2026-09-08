import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ChatArchiveSettings } from '../../services/chatApi';
import { ChatItem } from '../../components/groups/GroupInfoModal';
import { ChatRow, getChatListPreviewText } from '../../components/chatList/ChatRow';
import { ChatSearchBar } from '../../components/chatUiPrimitives';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { colors } from '../../theme/colors';
import { formatChatListTime } from '../../components/contacts/ContactInfoModal';
import { styles } from '../../screens/adminChatStyles';

/**
 * Archived chats.
 *
 * Lifted out of the chat screen unchanged.
 */

export type ArchiveSelectionMap = Record<string, boolean>;

export function ArchivedChatsScreen({
  archiveSettings,
  chats,
  isLoading,
  isLoadingSettings,
  isSelectionMode,
  onArchiveChat,
  onDeleteSelected,
  onMarkSelectedRead,
  onMoreChat,
  onOpenChat,
  onSearchChange,
  onToggleFavoriteChat,
  onTogglePinChat,
  onToggleSelection,
  onUnarchiveSelected,
  profilePhotoHeaders,
  search,
  selectedChatIds
}: {
  archiveSettings: ChatArchiveSettings;
  chats: ChatItem[];
  isLoading: boolean;
  isLoadingSettings: boolean;
  isSelectionMode: boolean;
  onArchiveChat: (chat: ChatItem) => void;
  onDeleteSelected: () => void;
  onMarkSelectedRead: () => void;
  onMoreChat: (chat: ChatItem) => void;
  onOpenChat: (chat: ChatItem) => void;
  onSearchChange: (value: string) => void;
  onToggleFavoriteChat: (chat: ChatItem) => void;
  onTogglePinChat: (chat: ChatItem) => void;
  onToggleSelection: (chat: ChatItem) => void;
  onUnarchiveSelected: () => void;
  profilePhotoHeaders?: Record<string, string>;
  search: string;
  selectedChatIds: ArchiveSelectionMap;
}) {
  const selectedCount = chats.filter((chat) => selectedChatIds[chat.contactId]).length;
  const selectedUnreadCount = chats.reduce((total, chat) =>
    selectedChatIds[chat.contactId] ? total + Math.max(chat.unreadCount || 0, 0) : total, 0);
  const helperText = archiveSettings.keepArchivedWhenNewMessagesArrive
    ? 'These chats stay archived when new messages are received.'
    : 'New messages move archived chats back to Chats.';

  return (
    <View style={styles.archiveScreen}>
      <ChatSearchBar
        onChangeText={onSearchChange}
        placeholder="Search Archived"
        value={search}
      />

      <Text style={styles.archiveDescription}>
        {isLoadingSettings ? 'Loading archive settings...' : helperText}
      </Text>

      {isLoading && !chats.length ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {!isLoading && !chats.length ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{search.trim() ? 'No archived chats found' : 'No archived chats'}</Text>
        </View>
      ) : null}

      {chats.map((chat) => (
        isSelectionMode ? (
          <ArchiveSelectableChatRow
            chat={chat}
            isSelected={selectedChatIds[chat.contactId] === true}
            key={chat.id}
            onPress={() => onToggleSelection(chat)}
            profilePhotoHeaders={profilePhotoHeaders}
          />
        ) : (
          <ChatRow
            chat={chat}
            key={chat.id}
            onArchive={() => onArchiveChat(chat)}
            onMore={() => onMoreChat(chat)}
            onOpen={() => onOpenChat(chat)}
            onToggleFavorite={() => onToggleFavoriteChat(chat)}
            onTogglePin={() => onTogglePinChat(chat)}
            profilePhotoHeaders={profilePhotoHeaders}
          />
        )
      ))}

      {isSelectionMode ? (
        <View style={styles.archiveSelectionBar}>
          <ArchiveSelectionAction
            disabled={selectedCount === 0}
            label="Unarchive"
            onPress={onUnarchiveSelected}
          />
          <ArchiveSelectionAction
            disabled={selectedUnreadCount === 0}
            label="Read"
            onPress={onMarkSelectedRead}
          />
          <ArchiveSelectionAction
            destructive
            disabled={selectedCount === 0}
            label="Delete"
            onPress={onDeleteSelected}
          />
        </View>
      ) : null}
    </View>
  );
}

function ArchiveSelectableChatRow({
  chat,
  isSelected,
  onPress,
  profilePhotoHeaders
}: {
  chat: ChatItem;
  isSelected: boolean;
  onPress: () => void;
  profilePhotoHeaders?: Record<string, string>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.archiveSelectableRow, pressed && styles.pressed]}
    >
      <View style={[styles.archiveRoundCheck, isSelected && styles.archiveRoundCheckSelected]}>
        {isSelected ? <Feather color="#FFFFFF" name="check" size={14} /> : null}
      </View>
      <ProfileAvatar
        headers={profilePhotoHeaders}
        name={chat.title}
        size={56}
        uri={chat.profilePhotoUrl}
      />

      <View style={styles.chatText}>
        <View style={styles.chatTitleRow}>
          <Text numberOfLines={1} style={[styles.chatTitle, styles.chatListTitle]}>{chat.title}</Text>
          {chat.isFavorite ? <Feather color="#F59E0B" name="star" size={13} /> : null}
        </View>
        {getChatListPreviewText(chat) ? (
          <Text numberOfLines={2} style={styles.chatPreview}>{getChatListPreviewText(chat)}</Text>
        ) : null}
      </View>

      <View style={styles.chatMeta}>
        {chat.lastMessageAt ? (
          <Text style={styles.chatTime}>{formatChatListTime(chat.lastMessageAt)}</Text>
        ) : null}
        {chat.isPinned ? (
          <Feather color={colors.muted} name="map-pin" size={14} />
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

function ArchiveSelectionAction({
  destructive,
  disabled,
  label,
  onPress
}: {
  destructive?: boolean;
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.archiveSelectionAction,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled
      ]}
    >
      <Text style={[
        styles.archiveSelectionActionText,
        destructive && styles.archiveSelectionActionTextDestructive
      ]}>
        {label}
      </Text>
    </Pressable>
  );
}
