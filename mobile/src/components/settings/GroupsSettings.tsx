import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, Text, View } from 'react-native';
import { TenantGroup } from '../../services/adminApi';
import { getGroupSubtitle } from '../../components/groups/GroupSwitcherModal';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * Group settings.
 *
 * Lifted out of the chat screen unchanged.
 */

export function GroupsSettings({
  groups,
  isLoading
}: {
  groups: TenantGroup[];
  isLoading: boolean;
}) {
  const appTheme = useAppTheme();

  if (isLoading && !groups.length) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={appTheme.colors.primary} />
      </View>
    );
  }

  if (!groups.length) {
    return (
      <View style={styles.emptyState}>
        <Text style={[styles.emptyTitle, { color: appTheme.colors.muted }]}>No groups yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.groupList}>
      {groups.map((group, index) => (
        <View key={group.groupId}>
          {index > 0 ? (
            <View style={[styles.listRowDivider, { backgroundColor: appTheme.colors.separator }]} />
          ) : null}
        <View style={styles.groupRow}>
          <View style={[styles.groupIcon, { backgroundColor: appTheme.colors.primarySoft }]}>
            <Feather color={appTheme.colors.primary} name="users" size={18} />
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
        </View>
        </View>
      ))}
    </View>
  );
}
