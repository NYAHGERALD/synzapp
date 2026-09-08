import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import type { AdminContactPolicy } from '../../services/adminApi';
import { ListSection, ListSwitchRow } from '../ui/GroupedList';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * Whether a manager's phone number is shown to the people they look after.
 *
 * The main menu names one admin for every person — their department admin, or
 * the organization admin where the department has none — so that nobody has to
 * ask a colleague who to ask. The number is what makes that name useful off the
 * app, and it is also somebody's personal number.
 *
 * That is a company's decision rather than Synzapp's, which is why it lives
 * here and not in code. Turning it off stops the number being **sent** to
 * anybody's phone; it is not hidden after arriving, because a value withheld in
 * the interface is a value already on the device.
 *
 * The name and the face stay either way. Knowing who to ask is the point of the
 * card, and hiding that would leave people worse off than before it existed.
 */

export function AdminContactSettings({
  isLoading,
  isSaving,
  onUpdate,
  policy
}: {
  isLoading: boolean;
  isSaving: boolean;
  onUpdate: (showAdminPhoneNumber: boolean) => void;
  policy: AdminContactPolicy | null;
}) {
  const appTheme = useAppTheme();

  if (isLoading) {
    return (
      <View style={adminContactStyles.state}>
        <ActivityIndicator color={appTheme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={adminContactStyles.page} showsVerticalScrollIndicator={false}>
      <ListSection
        footer="Everybody is shown the admin they should go to, with their name and photograph. This decides whether their phone number goes with it."
        title="Who to ask"
      >
        <ListSwitchRow
          disabled={isSaving || !policy}
          onValueChange={onUpdate}
          subtitle="Their number appears in the main menu for the people they look after."
          title="Show the admin phone number"
          value={policy?.showAdminPhoneNumber ?? true}
        />
      </ListSection>
    </ScrollView>
  );
}

const adminContactStyles = StyleSheet.create({
  page: {
    minHeight: '100%',
    paddingBottom: 36,
    paddingTop: 2
  },
  state: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40
  }
});
