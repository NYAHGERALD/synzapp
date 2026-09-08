import React from 'react';
import type { FeatherIconName } from '../../types/featherIcon';
import { AppThemePreference, getThemePreferenceLabel } from '../../theme/AppThemeProvider';
import { StyleSheet, View } from 'react-native';
import { ListNavRow, ListSection } from '../ui/GroupedList';

/**
 * The settings list.
 *
 * Cards on a tinted ground, hairline rules inset from both edges, no shadows.
 * This is the Synzapp grouped style, the same one the action sheets use, so a
 * person moving between them is looking at one app rather than two.
 */

interface SettingsListEntry {
  icon: FeatherIconName;
  onPress?: () => void;
  subtitle: string;
  title: string;
}

export function SettingsList({
  canManageAiUsage,
  canManageCompanyProfile,
  canManageDirectory,
  canManageGroups,
  canManageUsers,
  canManageSecurity,
  onOpenAppearance,
  onOpenAiUsage,
  onOpenChatBackup,
  onOpenCompanyProfile,
  onOpenDepartmentAdminPermissions,
  onOpenDepartmentsAndRoles,
  onOpenGroups,
  onOpenKeyResults,
  onOpenMyDevices,
  onOpenOfflineChat,
  onOpenRolePermissions,
  onOpenActionReminders,
  onOpenScheduledMessages,
  onOpenSecurity,
  themePreference
}: {
  canManageAiUsage: boolean;
  canManageCompanyProfile: boolean;
  canManageDirectory: boolean;
  canManageGroups: boolean;
  canManageUsers: boolean;
  canManageSecurity: boolean;
  onOpenAppearance: () => void;
  onOpenAiUsage: () => void;
  onOpenChatBackup: () => void;
  onOpenCompanyProfile: () => void;
  onOpenDepartmentAdminPermissions: () => void;
  onOpenDepartmentsAndRoles: () => void;
  onOpenGroups: () => void;
  onOpenKeyResults: () => void;
  onOpenMyDevices: () => void;
  onOpenOfflineChat: () => void;
  onOpenRolePermissions: () => void;
  onOpenActionReminders: () => void;
  onOpenScheduledMessages: () => void;
  onOpenSecurity: () => void;
  themePreference: AppThemePreference;
}) {
  const preferenceItems: SettingsListEntry[] = [
    {
      icon: 'sliders',
      onPress: onOpenAppearance,
      subtitle: getThemePreferenceLabel(themePreference),
      title: 'Appearance'
    }
  ];
  const administrationItems: SettingsListEntry[] = [
    ...(canManageDirectory
      ? [
          {
            icon: 'briefcase' as FeatherIconName,
            onPress: onOpenDepartmentsAndRoles,
            subtitle: 'Departments, roles',
            title: 'Departments and roles'
          },
          {
            icon: 'shield' as FeatherIconName,
            onPress: onOpenRolePermissions,
            subtitle: 'Role-based access',
            title: 'Role permissions'
          }
        ]
      : []),
    ...(canManageCompanyProfile
      ? [
          {
            icon: 'home' as FeatherIconName,
            onPress: onOpenCompanyProfile,
            subtitle: 'Company details',
            title: 'Company profile'
          },
          {
            icon: 'bar-chart-2' as FeatherIconName,
            onPress: onOpenKeyResults,
            subtitle: 'Company LSW metrics',
            title: 'Key results'
          }
        ]
      : []),
    ...(canManageAiUsage
      ? [
          {
            icon: 'cpu' as FeatherIconName,
            onPress: onOpenAiUsage,
            subtitle: 'Spend, budgets, and tenant AI controls',
            title: 'AI usage and credits'
          }
        ]
      : []),
    ...(canManageUsers
      ? [
          {
            icon: 'user-check' as FeatherIconName,
            onPress: onOpenDepartmentAdminPermissions,
            subtitle: 'Scoped Department Admin access',
            title: 'Department admin permissions'
          }
        ]
      : []),
    ...(canManageGroups
      ? [
          {
            icon: 'users' as FeatherIconName,
            onPress: onOpenGroups,
            subtitle: 'Company and department groups',
            title: 'Groups'
          }
        ]
      : []),
    ...(canManageSecurity
      ? [
          {
            icon: 'lock' as FeatherIconName,
            onPress: onOpenSecurity,
            subtitle: 'Tenant devices and access controls',
            title: 'Organization security'
          },
          {
            icon: 'hard-drive' as FeatherIconName,
            onPress: onOpenOfflineChat,
            subtitle: 'Cache, prefetch, and offline metrics',
            title: 'Offline chat'
          },
          {
            icon: 'clock' as FeatherIconName,
            onPress: onOpenScheduledMessages,
            subtitle: 'See what is waiting to send, and stop it',
            title: 'Scheduled messages'
          },
          {
            icon: 'bell' as FeatherIconName,
            onPress: onOpenActionReminders,
            subtitle: 'How often people are reminded, and when overdue work escalates',
            title: 'Action reminders'
          }
        ]
      : [])
  ];
  const deviceItems: SettingsListEntry[] = [
    {
      icon: 'smartphone',
      onPress: onOpenMyDevices,
      subtitle: 'Registered devices for your account',
      title: 'My devices'
    },
    {
      icon: 'database',
      onPress: onOpenChatBackup,
      subtitle: 'Encrypted chat history',
      title: 'Chat backup'
    }
  ];

  return (
    <View style={listStyles.page}>
      <ListSection title="Preferences">
        {preferenceItems.map((item) => (
          <ListNavRow
            icon={item.icon}
            key={item.title}
            onPress={item.onPress}
            subtitle={item.subtitle}
            title={item.title}
          />
        ))}
      </ListSection>

      {administrationItems.length ? (
        <ListSection title="Administration">
          {administrationItems.map((item) => (
            <ListNavRow
              icon={item.icon}
              key={item.title}
              onPress={item.onPress}
              subtitle={item.subtitle}
              title={item.title}
            />
          ))}
        </ListSection>
      ) : null}

      <ListSection title="This device">
        {deviceItems.map((item) => (
          <ListNavRow
            icon={item.icon}
            key={item.title}
            onPress={item.onPress}
            subtitle={item.subtitle}
            title={item.title}
          />
        ))}
      </ListSection>
    </View>
  );
}

const listStyles = StyleSheet.create({
  page: {
    // Tall enough that the tinted ground reaches past the last card rather
    // than stopping halfway down the screen.
    minHeight: '100%',
    paddingBottom: 36,
    paddingTop: 2
  }
});
