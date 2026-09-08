import Feather from '@expo/vector-icons/Feather';
import React, { useMemo } from 'react';
import type { SynzappCallHistoryEntry } from '../../services/localCallStore';
import type { SynzappCallMode } from '../../services/callApi';
import { CallHistoryRow, getCallHistoryStatusLabel } from '../../components/calls/CallHistoryRow';
import { ChatContact } from '../../services/chatApi';
import { ChatSearchBar, getKeyboardDismissMode } from '../../components/chatUiPrimitives';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * The calls tab.
 *
 * Lifted out of the chat screen unchanged.
 */

export function CallsTab({
  contacts,
  favorites,
  history,
  isEditMode,
  onDeleteCall,
  onOpenFavorites,
  onOpenKeypad,
  onOpenNewCall,
  onOpenSchedule,
  onSearchChange,
  onStartCall,
  profilePhotoHeaders,
  scheduledCount,
  search
}: {
  contacts: ChatContact[];
  favorites: string[];
  history: SynzappCallHistoryEntry[];
  isEditMode: boolean;
  onDeleteCall: (entry: SynzappCallHistoryEntry) => void;
  onOpenFavorites: () => void;
  onOpenKeypad: () => void;
  onOpenNewCall: () => void;
  onOpenSchedule: () => void;
  onSearchChange: (value: string) => void;
  onStartCall: (contact: ChatContact, mode?: SynzappCallMode) => void;
  profilePhotoHeaders?: Record<string, string>;
  scheduledCount: number;
  search: string;
}) {
  const appTheme = useAppTheme();
  const visibleHistory = filterCallHistory(history, search);
  const favoriteCount = favorites.length;
  const contactById = useMemo(() => new Map(
    contacts.map((contact) => [contact.contactId, contact])
  ), [contacts]);

  return (
    <View style={[styles.callsTab, styles.fixedListTab]}>
      <View style={callsStyles.searchWrap}>
        <ChatSearchBar
          onChangeText={onSearchChange}
          placeholder="Search"
          value={search}
        />
      </View>

      {/* One card, four tinted actions, hairlines between them — the same shape
          the call and contact screens use. Tinted discs were four filled
          buttons in a row competing with the list under them. */}
      <View style={[callsStyles.actionCard, { backgroundColor: appTheme.colors.groupedCard }]}>
        <CallQuickActionButton icon="phone" label="Call" onPress={onOpenNewCall} />
        <View style={[callsStyles.actionDivider, { backgroundColor: appTheme.colors.separator }]} />
        <CallQuickActionButton badge={scheduledCount} icon="calendar" label="Schedule" onPress={onOpenSchedule} />
        <View style={[callsStyles.actionDivider, { backgroundColor: appTheme.colors.separator }]} />
        <CallQuickActionButton icon="grid" label="Keypad" onPress={onOpenKeypad} />
        <View style={[callsStyles.actionDivider, { backgroundColor: appTheme.colors.separator }]} />
        <CallQuickActionButton badge={favoriteCount} icon="heart" label="Favorites" onPress={onOpenFavorites} />
      </View>

      <Text style={[callsStyles.sectionTitle, { color: appTheme.colors.muted }]}>Recent</Text>

      <FlatList
        alwaysBounceVertical={false}
        bounces={false}
        contentContainerStyle={[
          styles.fixedListContent,
          !visibleHistory.length && styles.fixedListEmptyContent
        ]}
        data={visibleHistory}
        keyExtractor={(entry) => entry.id}
        keyboardDismissMode={getKeyboardDismissMode()}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: appTheme.colors.muted }]}>
              {search.trim() ? 'No calls found' : 'No recent calls'}
            </Text>
          </View>
        }
        overScrollMode="never"
        renderItem={({ item: entry }) => (
          <CallHistoryRow
            contact={contactById.get(entry.contactId)}
            entry={entry}
            isEditMode={isEditMode}
            onDelete={() => onDeleteCall(entry)}
            onStartCall={(contact) => onStartCall(contact, entry.mode)}
            profilePhotoHeaders={profilePhotoHeaders}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={styles.fixedList}
      />
    </View>
  );
}

/**
 * One of the four shortcuts.
 *
 * Tinted text under a tinted icon, sharing a card with the other three. The
 * count rides beside the label rather than on a coloured pip: "Favorites 3"
 * can be read, and a small green dot on a grey disc cannot.
 */
function CallQuickActionButton({
  badge = 0,
  icon,
  label,
  onPress
}: {
  badge?: number;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const appTheme = useAppTheme();
  const labelText = badge > 0 ? `${label} ${badge > 99 ? '99+' : badge}` : label;

  return (
    <Pressable
      accessibilityLabel={labelText}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        callsStyles.action,
        pressed && { backgroundColor: appTheme.colors.groupedBackground }
      ]}
    >
      <Feather color={appTheme.colors.link} name={icon} size={21} />
      <Text numberOfLines={1} style={[callsStyles.actionText, { color: appTheme.colors.link }]}>
        {labelText}
      </Text>
    </Pressable>
  );
}

function filterCallHistory(history: SynzappCallHistoryEntry[], search: string): SynzappCallHistoryEntry[] {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return history;
  }

  return history.filter((entry) =>
    entry.title.toLowerCase().includes(normalizedSearch) ||
    entry.callerName.toLowerCase().includes(normalizedSearch) ||
    getCallHistoryStatusLabel(entry).toLowerCase().includes(normalizedSearch)
  );
}

const callsStyles = StyleSheet.create({
  // The tab surface already pays 10, and a card sits 15 from the screen edge.
  searchWrap: {
    marginHorizontal: 5
  },
  actionCard: {
    alignItems: 'stretch',
    borderRadius: 22,
    flexDirection: 'row',
    marginHorizontal: 5,
    overflow: 'hidden'
  },
  action: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 14
  },
  actionText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center'
  },
  // The card's own hairline, stood on its end and kept off the card edges.
  actionDivider: {
    marginVertical: 12,
    width: 1
  },
  sectionTitle: {
    fontSize: 13,
    marginLeft: 15,
    marginTop: 14
  }
});
