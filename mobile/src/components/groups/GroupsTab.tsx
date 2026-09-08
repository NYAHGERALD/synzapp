import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { TenantGroup } from '../../services/adminApi';
import { getGroupSubtitle } from '../../components/groups/GroupSwitcherModal';
import { getKeyboardDismissMode } from '../../components/chatUiPrimitives';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * The groups tab.
 *
 * Lifted out of the chat screen unchanged.
 */

export function GroupsTab({
  groups,
  isLoading,
  onOpenGroup
}: {
  groups: TenantGroup[];
  isLoading: boolean;
  onOpenGroup: (group: TenantGroup) => void;
}) {
  const appTheme = useAppTheme();

  return (
    <View style={[styles.groupList, styles.fixedListTab]}>
      <FlatList
        alwaysBounceVertical={false}
        bounces={false}
        contentContainerStyle={[
          styles.fixedListContent,
          !groups.length && styles.fixedListEmptyContent
        ]}
        data={groups}
        keyExtractor={(group) => group.groupId}
        keyboardDismissMode={getKeyboardDismissMode()}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={appTheme.colors.primary} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: appTheme.colors.muted }]}>No groups yet</Text>
            </View>
          )
        }
        overScrollMode="never"
        renderItem={({ item: group }) => (
        <Pressable
          accessibilityLabel={`Open ${group.name} group chat`}
          accessibilityRole="button"
          onPress={() => onOpenGroup(group)}
          style={({ pressed }) => [
            styles.groupRow,
            {
              backgroundColor: appTheme.colors.screen,
              borderBottomColor: appTheme.colors.divider
            },
            pressed && styles.pressed
          ]}
        >
          <View style={[styles.groupIcon, { backgroundColor: appTheme.colors.primarySoft }]}>
            <Ionicons color={appTheme.colors.primary} name="people" size={20} />
          </View>
          <View style={styles.chatText}>
            <Text style={[styles.chatTitle, { color: appTheme.colors.ink }]}>{group.name}</Text>
            <Text numberOfLines={1} style={[styles.chatPreview, { color: appTheme.colors.muted }]}>
              {getGroupSubtitle(group)}
            </Text>
          </View>
          <Text numberOfLines={1} style={[styles.groupMeta, { color: appTheme.colors.muted }]}>
            {group.memberCount === 1 ? '1 member' : `${group.memberCount} members`}
          </Text>
        </Pressable>
        )}
        showsVerticalScrollIndicator={false}
        style={styles.fixedList}
      />
    </View>
  );
}
