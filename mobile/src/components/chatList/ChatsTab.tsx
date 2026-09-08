import type { ScheduledChatState } from '../../services/scheduledChatIndicators';
import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { ChatItem } from '../../components/groups/GroupInfoModal';
import { ChatRow } from '../../components/chatList/ChatRow';
import { ChatSearchBar, androidIconRipple, getKeyboardDismissMode } from '../../components/chatUiPrimitives';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * The chats tab.
 *
 * Lifted out of the chat screen unchanged.
 */

export type ChatListFilter = 'all' | 'archived' | 'favorites' | 'groups' | 'unread';

export function ChatsTab({
  aboveChats,
  activeFilter,
  archivedBadgeCount,
  archivedCount,
  chats,
  groupCount,
  isLoading,
  onChangeFilter,
  onArchiveChat,
  onMoreChat,
  onOpenArchived,
  onOpenChat,
  onOpenNewChat,
  onOpenSpam,
  scheduledChatStates,
  onSearchChange,
  onToggleFavoriteChat,
  onTogglePinChat,
  profilePhotoHeaders,
  search,
  spamCount,
  unreadCount
}: {
  /** Pinned above every conversation. Used for personal announcements. */
  aboveChats?: React.ReactNode;
  activeFilter: ChatListFilter;
  archivedBadgeCount: number;
  archivedCount: number;
  chats: ChatItem[];
  groupCount: number;
  isLoading: boolean;
  onChangeFilter: (filter: ChatListFilter) => void;
  onArchiveChat: (chat: ChatItem) => void;
  onMoreChat: (chat: ChatItem) => void;
  onOpenArchived: () => void;
  onOpenChat: (chat: ChatItem) => void;
  onOpenNewChat: () => void;
  onOpenSpam: () => void;
  onSearchChange: (value: string) => void;
  onToggleFavoriteChat: (chat: ChatItem) => void;
  onTogglePinChat: (chat: ChatItem) => void;
  profilePhotoHeaders?: Record<string, string>;
  /** Which conversations have a message waiting, or one that failed. */
  scheduledChatStates?: Record<string, ScheduledChatState>;
  search: string;
  spamCount: number;
  unreadCount: number;
}) {
  const appTheme = useAppTheme();

  return (
    <View style={styles.fixedListTab}>
      <View style={[
        styles.chatsControls,
        { borderBottomColor: appTheme.colors.divider }
      ]}>
        <ChatSearchBar
          onChangeText={onSearchChange}
          placeholder="Search chats"
          value={search}
        />

        <ScrollView
          contentContainerStyle={styles.chatFilterContent}
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          style={styles.chatFilterScroll}
        >
          <ChatFilterChip
            isActive={activeFilter === 'all'}
            label="All"
            onPress={() => onChangeFilter('all')}
          />
          <ChatFilterChip
            count={unreadCount}
            isActive={activeFilter === 'unread'}
            label="Unread"
            onPress={() => onChangeFilter('unread')}
          />
          <ChatFilterChip
            isActive={activeFilter === 'favorites'}
            label="Favorites"
            onPress={() => onChangeFilter('favorites')}
          />
          <ChatFilterChip
            count={groupCount}
            isActive={activeFilter === 'groups'}
            label="Groups"
            onPress={() => onChangeFilter('groups')}
          />
          <Pressable
            accessibilityLabel="Start new chat"
            accessibilityRole="button"
            android_ripple={androidIconRipple}
            onPress={onOpenNewChat}
            style={({ pressed }) => [
              styles.chatFilterAddButton,
              {
                backgroundColor: appTheme.colors.surfaceElevated,
                borderColor: appTheme.colors.border
              },
              pressed && styles.pressed
            ]}
          >
            <Feather color={appTheme.colors.ink} name="plus" size={18} />
          </Pressable>
        </ScrollView>

        {spamCount > 0 ? (
          <ChatsUtilityRow
            icon="message-circle"
            label="Trash"
            onPress={onOpenSpam}
          />
        ) : null}
        {archivedCount > 0 ? (
          <ChatsUtilityRow
            count={archivedBadgeCount}
            icon="archive"
            label="Archived"
            onPress={onOpenArchived}
          />
        ) : null}
      </View>

      <FlatList
        alwaysBounceVertical={false}
        bounces={false}
        contentContainerStyle={[
          styles.fixedListContent,
          !chats.length && styles.fixedListEmptyContent
        ]}
        data={chats}
        keyExtractor={(chat) => chat.id}
        // Pinned above every conversation. A notice sent to one person has no
        // group chat to sit in, and the top of the list is where a person's eye
        // lands when they open the app.
        ListHeaderComponent={aboveChats ? <>{aboveChats}</> : null}
        keyboardDismissMode={getKeyboardDismissMode()}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={appTheme.colors.primary} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: appTheme.colors.muted }]}>
                {search.trim() ? 'No chats found' : 'No chats yet'}
              </Text>
            </View>
          )
        }
        overScrollMode="never"
        renderItem={({ item: chat }) => (
          <ChatRow
            chat={chat}
            onArchive={() => onArchiveChat(chat)}
            onMore={() => onMoreChat(chat)}
            onOpen={() => onOpenChat(chat)}
            onToggleFavorite={() => onToggleFavoriteChat(chat)}
            onTogglePin={() => onTogglePinChat(chat)}
            profilePhotoHeaders={profilePhotoHeaders}
            scheduledState={scheduledChatStates?.[chat.contactId]}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={styles.fixedList}
      />
    </View>
  );
}

function ChatFilterChip({
  count,
  isActive,
  label,
  onPress
}: {
  count?: number;
  isActive: boolean;
  label: string;
  onPress: () => void;
}) {
  const appTheme = useAppTheme();
  const labelText = typeof count === 'number' && count > 0 ? `${label} ${count}` : label;

  return (
    <Pressable
      accessibilityLabel={labelText}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chatFilterChip,
        {
          backgroundColor: isActive ? appTheme.colors.primarySoft : appTheme.colors.surfaceElevated,
          borderColor: isActive ? appTheme.colors.primary : appTheme.colors.border
        },
        pressed && styles.pressed
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.chatFilterChipText,
          { color: isActive ? appTheme.colors.primary : appTheme.colors.mutedStrong }
        ]}
      >
        {labelText}
      </Text>
    </Pressable>
  );
}

function ChatsUtilityRow({
  count,
  icon,
  label,
  onPress
}: {
  count?: number;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.chatsUtilityRow, pressed && styles.pressed]}
    >
      <View style={styles.chatsUtilityIcon}>
        <Feather color={appTheme.colors.muted} name={icon} size={17} />
      </View>
      <Text numberOfLines={1} style={[styles.chatsUtilityText, { color: appTheme.colors.mutedStrong }]}>
        {label}
      </Text>
      {typeof count === 'number' && count > 0 ? (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{count > 99 ? '99+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
