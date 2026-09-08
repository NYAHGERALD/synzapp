import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { CurrentUserDevice } from '../../services/profileApi';
import { TenantDevice } from '../../services/adminApi';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { ListSection } from '../ui/GroupedList';

/**
 * Device management.
 *
 * Lifted out of the chat screen unchanged.
 */

type DeviceListItem = TenantDevice | CurrentUserDevice;

export function MyDevicesSettings({
  devices,
  isLoading,
  isRevoking,
  onRevokeDevice
}: {
  devices: CurrentUserDevice[];
  isLoading: boolean;
  isRevoking: boolean;
  onRevokeDevice: (device: CurrentUserDevice) => void;
}) {
  const appTheme = useAppTheme();

  if (isLoading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={appTheme.colors.primary} />
      </View>
    );
  }

  if (!devices.length) {
    return <Text style={[styles.emptySmall, { color: appTheme.colors.muted }]}>No registered devices yet</Text>;
  }

  return (
    <View style={styles.securityList}>
      <ListSection title="Your registered devices">
        {devices.map((device) => (
          <DeviceRow
            device={device}
            isRevoking={isRevoking}
            key={device.deviceId}
            onRevoke={device.isCurrentDevice ? undefined : () => onRevokeDevice(device)}
          />
        ))}
      </ListSection>
    </View>
  );
}

export function DeviceRow({
  device,
  isRevoking,
  onRevoke
}: {
  device: DeviceListItem;
  isRevoking: boolean;
  onRevoke?: () => void;
}) {
  const appTheme = useAppTheme();
  const isRevoked = device.status === 'REVOKED';
  // A device nobody has opened for long enough stops being sent messages, and
  // saying "Active" about it would be the row telling a lie. It is not revoked
  // and nothing was decided about it: opening the app on it brings it back.
  const isInactive = device.status === 'RETIRED';
  const isCurrentDevice = 'isCurrentDevice' in device && device.isCurrentDevice;
  const meta = [
    formatDevicePlatform(device.platform),
    device.roleName,
    device.lastSeenAt ? `Last seen ${formatSecurityDate(device.lastSeenAt)}` : null
  ].filter(Boolean).join(' - ');

  return (
    <View style={[styles.deviceRow, { backgroundColor: appTheme.colors.groupedCard, borderBottomColor: 'transparent' }]}>
      <View style={[styles.deviceIcon, { backgroundColor: appTheme.colors.primarySoft }]}>
        <Feather color={appTheme.colors.primary} name={getDeviceIconName(device.platform)} size={20} />
      </View>
      <View style={styles.chatText}>
        <Text style={[styles.chatTitle, { color: appTheme.colors.ink }]}>{device.displayName}</Text>
        <Text numberOfLines={2} style={[styles.chatPreview, { color: appTheme.colors.muted }]}>{meta}</Text>
        <Text
          numberOfLines={1}
          style={[
            isRevoked || isInactive ? styles.deviceStatusRevoked : styles.deviceStatusActive,
            {
              color: isRevoked
                ? appTheme.colors.destructive
                : isInactive
                  ? appTheme.colors.muted
                  : appTheme.colors.primary
            }
          ]}
        >
          {isRevoked ? 'Revoked' : isInactive ? 'Inactive' : isCurrentDevice ? 'Current' : 'Active'}
        </Text>
      </View>
      {!isRevoked && onRevoke ? (
        <Pressable
          accessibilityLabel={`Revoke ${device.displayName} device`}
          accessibilityRole="button"
          disabled={isRevoking}
          onPress={onRevoke}
          hitSlop={8}
          style={({ pressed }) => [
            pressed && !isRevoking && styles.pressed,
            isRevoking && styles.disabled
          ]}
        >
          <Text style={{ color: appTheme.colors.destructive, fontSize: 15.5 }}>Revoke</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function getDeviceIconName(platform: string): React.ComponentProps<typeof Feather>['name'] {
  if (platform === 'ios' || platform === 'android') {
    return 'smartphone';
  }

  if (platform === 'web') {
    return 'monitor';
  }

  return 'hard-drive';
}

function formatDevicePlatform(platform: string): string {
  if (platform === 'ios') {
    return 'iOS';
  }

  if (platform === 'android') {
    return 'Android';
  }

  if (platform === 'web') {
    return 'Web';
  }

  return 'Unknown device';
}

function formatSecurityDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}
