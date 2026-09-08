import { ActivityIndicator, Text, View } from 'react-native';
import { TenantDepartment, TenantRole } from '../../services/adminApi';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * Directory settings.
 *
 * Lifted out of the chat screen unchanged.
 */

export type DirectoryFilter = 'Departments' | 'Roles';

export function DirectorySettings({
  departments,
  filter,
  isLoading,
  roles
}: {
  departments: TenantDepartment[];
  filter: DirectoryFilter;
  isLoading: boolean;
  roles: TenantRole[];
}) {
  const appTheme = useAppTheme();
  const records = filter === 'Departments'
    ? departments.map((department) => ({
        id: department.departmentId,
        meta: department.description || department.status,
        name: department.name
      }))
    : roles.map((role) => ({
        id: role.roleId,
        meta: role.description || role.status,
        name: role.name
      }));

  if (isLoading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={appTheme.colors.primary} />
      </View>
    );
  }

  return (
    <TenantRecordList
      emptyText={filter === 'Departments' ? 'No departments yet' : 'No roles yet'}
      records={records}
    />
  );
}

function TenantRecordList({
  emptyText,
  records
}: {
  emptyText: string;
  records: Array<{ id: string; meta: string; name: string }>;
}) {
  const appTheme = useAppTheme();

  if (!records.length) {
    return <Text style={[styles.emptySmall, { color: appTheme.colors.muted }]}>{emptyText}</Text>;
  }

  return (
    <View style={styles.recordList}>
      {records.map((record, index) => (
        <View key={record.id}>
          {index > 0 ? (
            <View style={[styles.listRowDivider, { backgroundColor: appTheme.colors.separator }]} />
          ) : null}
        <View style={styles.recordRow}>
          <View style={[styles.recordInitial, { backgroundColor: appTheme.colors.primarySoft }]}>
            <Text style={[styles.recordInitialText, { color: appTheme.colors.primary }]}>{record.name.slice(0, 1)}</Text>
          </View>
          <View style={styles.chatText}>
            <Text style={[styles.chatTitle, { color: appTheme.colors.ink }]}>{record.name}</Text>
            <Text numberOfLines={1} style={[styles.chatPreview, { color: appTheme.colors.muted }]}>{record.meta}</Text>
          </View>
        </View>
        </View>
      ))}
    </View>
  );
}
