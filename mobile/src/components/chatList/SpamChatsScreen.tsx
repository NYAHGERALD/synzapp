import { ActivityIndicator, Text, View } from 'react-native';
import { ChatItem } from '../../components/groups/GroupInfoModal';
import { ChatSearchBar } from '../../components/chatUiPrimitives';
import { SpamChatRow } from '../../components/chatList/SpamChatRow';
import { colors } from '../../theme/colors';
import { styles } from '../../screens/adminChatStyles';

/**
 * The spam chats screen.
 *
 * Lifted out of the chat screen unchanged.
 */

export function SpamChatsScreen({
  chats,
  isDeleting,
  isLoading,
  onDelete,
  onOpenChat,
  onSearchChange,
  profilePhotoHeaders,
  search
}: {
  chats: ChatItem[];
  isDeleting: boolean;
  isLoading: boolean;
  onDelete: (chat: ChatItem) => void;
  onOpenChat: (chat: ChatItem) => void;
  onSearchChange: (value: string) => void;
  profilePhotoHeaders?: Record<string, string>;
  search: string;
}) {
  return (
    <View style={styles.spamScreen}>
      <ChatSearchBar
        onChangeText={onSearchChange}
        placeholder="Search Trash"
        value={search}
      />

      <Text style={styles.spamDescription}>
        Deleted chats and normal groups are kept here as read-only history for 30 days.
      </Text>

      {isLoading && !chats.length ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {!isLoading && !chats.length ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{search.trim() ? 'No Trash chats found' : 'No Trash chats'}</Text>
        </View>
      ) : null}

      {chats.map((chat) => (
        <SpamChatRow
          chat={chat}
          isDeleting={isDeleting}
          key={chat.id}
          onDelete={() => onDelete(chat)}
          onOpen={() => onOpenChat(chat)}
          profilePhotoHeaders={profilePhotoHeaders}
        />
      ))}
    </View>
  );
}
