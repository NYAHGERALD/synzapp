import type { ScheduledChatState } from '../../services/scheduledChatIndicators';
import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChatItem } from '../../components/groups/GroupInfoModal';
import { ChatRow } from '../../components/chatList/ChatRow';
import { ChatSearchBar, getKeyboardDismissMode } from '../../components/chatUiPrimitives';
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
  onOpenSpam,
  scheduledChatStates,
  typingTextByConversation,
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
  onOpenSpam: () => void;
  onSearchChange: (value: string) => void;
  onToggleFavoriteChat: (chat: ChatItem) => void;
  onTogglePinChat: (chat: ChatItem) => void;
  profilePhotoHeaders?: Record<string, string>;
  /** Which conversations have a message waiting, or one that failed. */
  scheduledChatStates?: Record<string, ScheduledChatState>;
  /** "typing…" per conversation, replacing the preview line. */
  typingTextByConversation?: Record<string, string>;
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
        <View style={chatsTabStyles.searchWrap}>
          <ChatSearchBar
            onChangeText={onSearchChange}
            placeholder="Search chats"
            value={search}
          />
        </View>

        {/* One card, and text rather than four outlined pills. The pills read
            as buttons that do something; these choose what the list shows, and
            the one in force says so with colour and a rule under it. */}
        <View style={[chatsTabStyles.filterCard, { backgroundColor: appTheme.colors.groupedCard }]}>
          <ScrollView
            contentContainerStyle={chatsTabStyles.filterContent}
            horizontal
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
          >
            <ChatFilterLink
              isActive={activeFilter === 'all'}
              label="All"
              onPress={() => onChangeFilter('all')}
            />
            <ChatFilterLink
              count={unreadCount}
              isActive={activeFilter === 'unread'}
              label="Unread"
              onPress={() => onChangeFilter('unread')}
            />
            <ChatFilterLink
              isActive={activeFilter === 'favorites'}
              label="Favorites"
              onPress={() => onChangeFilter('favorites')}
            />
            <ChatFilterLink
              count={groupCount}
              isActive={activeFilter === 'groups'}
              label="Groups"
              onPress={() => onChangeFilter('groups')}
            />
          </ScrollView>
        </View>

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
        /**
         * Windowing, so a long chat list only ever mounts a screenful.
         *
         * Each row carries a PanResponder and an Animated value for its swipe
         * actions, so a mounted row is not cheap. Without these the list uses
         * the defaults, which keep far more rows alive than a phone screen can
         * show and make a hundred conversations feel heavier than ten.
         */
        initialNumToRender={12}
        keyExtractor={(chat) => chat.id}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        windowSize={7}
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
            typingText={typingTextByConversation?.[chat.contactId] || null}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={styles.fixedList}
      />
    </View>
  );
}

/**
 * One filter, as a text link.
 *
 * The one in force is the app's link blue with a rule under it; the rest are
 * quiet. No fill, no outline: a filter is a choice about the list below, not a
 * button that goes somewhere.
 */
function ChatFilterLink({
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
      style={({ pressed }) => [chatsTabStyles.filterLink, pressed && chatsTabStyles.pressed]}
    >
      <Text
        numberOfLines={1}
        style={[
          chatsTabStyles.filterLinkText,
          { color: isActive ? appTheme.colors.link : appTheme.colors.muted }
        ]}
      >
        {labelText}
      </Text>
      <View style={[
        chatsTabStyles.filterUnderline,
        { backgroundColor: isActive ? appTheme.colors.link : 'transparent' }
      ]} />
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

const chatsTabStyles = StyleSheet.create({
  // The tab surface already pays 10, and a card sits 15 from the screen edge.
  searchWrap: {
    marginHorizontal: 5
  },
  filterCard: {
    borderRadius: 22,
    marginHorizontal: 5,
    overflow: 'hidden'
  },
  filterContent: {
    alignItems: 'stretch',
    paddingHorizontal: 2
  },
  filterLink: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  filterLinkText: {
    fontSize: 14.5,
    lineHeight: 19
  },
  // Under the label, not around it. It marks the choice without drawing a
  // second button shape inside the card.
  filterUnderline: {
    alignSelf: 'stretch',
    borderRadius: 1,
    height: 2,
    marginTop: 6
  },
  pressed: {
    opacity: 0.6
  }
});
