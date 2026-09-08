import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { DeviceRow } from '../../components/settings/MyDevicesSettings';
import { TenantDevice } from '../../services/adminApi';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { ListSection } from '../ui/GroupedList';

/**
 * Security settings: every device registered to the organization.
 *
 * One card, one row per device, with Revoke as destructive text rather than an
 * outlined pill. Revoking is the only action here and it cannot be undone, so
 * it is the one red thing on the screen.
 */

export function SecuritySettings({
  devices,
  isLoading,
  isRevoking,
  onRevokeDevice
}: {
  devices: TenantDevice[];
  isLoading: boolean;
  isRevoking: boolean;
  onRevokeDevice: (device: TenantDevice) => void;
}) {
  const appTheme = useAppTheme();

  if (isLoading) {
    return (
      <View style={localStyles.state}>
        <ActivityIndicator color={appTheme.colors.primary} />
      </View>
    );
  }

  if (!devices.length) {
    return (
      <View style={localStyles.state}>
        <Text style={[localStyles.empty, { color: appTheme.colors.muted }]}>
          No registered devices yet
        </Text>
      </View>
    );
  }

  return (
    <View style={localStyles.page}>
      <ListSection
        footer="Revoking signs that device out and stops it reading new messages."
        title="Registered devices"
      >
        {devices.map((device) => (
          <DeviceRow
            device={device}
            isRevoking={isRevoking}
            key={device.deviceId}
            onRevoke={() => onRevokeDevice(device)}
          />
        ))}
      </ListSection>
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
