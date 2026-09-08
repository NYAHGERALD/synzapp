import Feather from '@expo/vector-icons/Feather';
import React, { useMemo } from 'react';
import type { SynzappCallHistoryEntry } from '../../services/localCallStore';
import type { SynzappCallMode } from '../../services/callApi';
import { CallHistoryRow, getCallHistoryStatusLabel } from '../../components/calls/CallHistoryRow';
import { ChatContact } from '../../services/chatApi';
import { ChatSearchBar, getKeyboardDismissMode } from '../../components/chatUiPrimitives';
import { FlatList, Pressable, Text, View } from 'react-native';
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
      <ChatSearchBar
        onChangeText={onSearchChange}
        placeholder="Search"
        value={search}
      />

      <View style={styles.callQuickActions}>
        <CallQuickActionButton icon="phone" label="Call" onPress={onOpenNewCall} />
        <CallQuickActionButton badge={scheduledCount} icon="calendar" label="Schedule" onPress={onOpenSchedule} />
        <CallQuickActionButton icon="grid" label="Keypad" onPress={onOpenKeypad} />
        <CallQuickActionButton badge={favoriteCount} icon="heart" label="Favorites" onPress={onOpenFavorites} />
      </View>

      <Text style={[styles.callsSectionTitle, { color: appTheme.colors.ink }]}>Recent</Text>

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

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.callQuickAction,
        pressed && styles.pressed
      ]}
    >
      <View style={[styles.callQuickActionIcon, { backgroundColor: appTheme.colors.surface }]}>
        <Feather color={appTheme.colors.ink} name={icon} size={21} />
        {badge > 0 ? (
          <View style={styles.callQuickActionBadge}>
            <Text style={styles.callQuickActionBadgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.callQuickActionLabel, { color: appTheme.colors.muted }]}>{label}</Text>
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
