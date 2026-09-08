import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { RolePermission, TenantRole } from '../../services/adminApi';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { ListSection, ListSwitchRow } from '../ui/GroupedList';

/**
 * Role permissions.
 *
 * One card per role, each permission a switch on the right. The tick boxes
 * this used to draw were a custom control that looked like nothing else on the
 * phone; a switch is what people already know, and it says on or off without
 * anyone having to work out what an empty circle means.
 */

export function RolePermissionSettings({
  isLoading,
  isSaving,
  onTogglePermission,
  permissions,
  roles
}: {
  isLoading: boolean;
  isSaving: boolean;
  onTogglePermission: (role: TenantRole, permission: RolePermission) => void;
  permissions: RolePermission[];
  roles: TenantRole[];
}) {
  const appTheme = useAppTheme();

  if (isLoading && !roles.length) {
    return (
      <View style={localStyles.state}>
        <ActivityIndicator color={appTheme.colors.primary} />
      </View>
    );
  }

  if (!roles.length) {
    return (
      <View style={localStyles.state}>
        <Text style={[localStyles.empty, { color: appTheme.colors.muted }]}>No roles yet</Text>
      </View>
    );
  }

  return (
    <View style={localStyles.page}>
      {roles.map((role) => {
        const enabled = new Set(role.permissions || []);

        return (
          <ListSection
            footer={role.description || undefined}
            key={role.roleId}
            title={role.status === 'ACTIVE' ? role.name : `${role.name} · ${role.status}`}
          >
            {permissions.map((permission) => (
              <ListSwitchRow
                disabled={isSaving}
                key={permission.permission}
                onValueChange={() => onTogglePermission(role, permission)}
                subtitle={permission.description}
                title={permission.title}
                value={enabled.has(permission.permission)}
              />
            ))}
          </ListSection>
        );
      })}
    </View>
  );
}

const localStyles = StyleSheet.create({
  page: {
    minHeight: '100%',
    paddingBottom: 36,
    paddingTop: 2
  },
  state: {
    alignItems: 'center',
    minHeight: '100%',
    paddingVertical: 60
  },
  empty: {
    fontSize: 15
  }
});
