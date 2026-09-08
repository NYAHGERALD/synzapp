import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ApprovedEmployee, DepartmentAdminPermission } from '../../services/adminApi';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * Department admin permissions.
 *
 * Lifted out of the chat screen unchanged.
 */

export function DepartmentAdminPermissionSettings({
  employees,
  isLoading,
  isSaving,
  onTogglePermission,
  permissions,
  profilePhotoHeaders
}: {
  employees: ApprovedEmployee[];
  isLoading: boolean;
  isSaving: boolean;
  onTogglePermission: (employee: ApprovedEmployee, permission: DepartmentAdminPermission) => void;
  permissions: DepartmentAdminPermission[];
  profilePhotoHeaders?: Record<string, string>;
}) {
  const appTheme = useAppTheme();
  const departmentAdmins = employees.filter((employee) => employee.role === 'DEPT_ADMIN');

  if (isLoading && !departmentAdmins.length) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={appTheme.colors.primary} />
      </View>
    );
  }

  if (!departmentAdmins.length) {
    return (
      <View style={styles.emptyState}>
        <Text style={[styles.emptyTitle, { color: appTheme.colors.muted }]}>No Department Admins yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.permissionSettingsList}>
      {departmentAdmins.map((employee) => (
        <DepartmentAdminPermissionEmployee
          employee={employee}
          isSaving={isSaving}
          key={employee.approvedPhoneId}
          onTogglePermission={onTogglePermission}
          permissions={permissions}
          profilePhotoHeaders={profilePhotoHeaders}
        />
      ))}
    </View>
  );
}

function DepartmentAdminPermissionEmployee({
  employee,
  isSaving,
  onTogglePermission,
  permissions,
  profilePhotoHeaders
}: {
  employee: ApprovedEmployee;
  isSaving: boolean;
  onTogglePermission: (employee: ApprovedEmployee, permission: DepartmentAdminPermission) => void;
  permissions: DepartmentAdminPermission[];
  profilePhotoHeaders?: Record<string, string>;
}) {
  const appTheme = useAppTheme();
  const enabledPermissionSet = new Set(employee.departmentAdminPermissions || []);
  const employeeName = employee.displayName || employee.phoneMasked;

  return (
    <View style={[styles.permissionEmployeeSection, { borderBottomColor: appTheme.colors.divider }]}>
      <View style={styles.permissionEmployeeHeader}>
        <ProfileAvatar
          headers={profilePhotoHeaders}
          name={employeeName}
          size={44}
          uri={employee.profilePhotoUrl}
        />
        <View style={styles.chatText}>
          <Text style={[styles.chatTitle, { color: appTheme.colors.ink }]}>{employeeName}</Text>
          <Text numberOfLines={1} style={[styles.chatPreview, { color: appTheme.colors.muted }]}>
            {employee.departmentName} - {employee.roleName}
          </Text>
        </View>
      </View>

      {permissions.map((permission) => {
        const isEnabled = enabledPermissionSet.has(permission.permission);

        return (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isEnabled, disabled: isSaving }}
            disabled={isSaving}
            key={permission.permission}
            onPress={() => onTogglePermission(employee, permission)}
            style={({ pressed }) => [
              styles.permissionRow,
              { backgroundColor: appTheme.colors.screen },
              pressed && !isSaving && styles.pressed,
              isSaving && styles.disabled
            ]}
          >
            <View style={[
              styles.permissionCheck,
              {
                borderColor: isEnabled ? appTheme.colors.primary : appTheme.colors.muted
              },
              isEnabled && styles.permissionCheckActive,
              isEnabled && { backgroundColor: appTheme.colors.primary }
            ]}>
              {isEnabled ? <Feather color="#FFFFFF" name="check" size={13} /> : null}
            </View>
            <View style={styles.chatText}>
              <Text style={[styles.permissionTitle, { color: appTheme.colors.ink }]}>{permission.title}</Text>
              <Text numberOfLines={2} style={[styles.permissionDescription, { color: appTheme.colors.muted }]}>
                {permission.description}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
