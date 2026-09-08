import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import type { ChatOfflineMetricsSnapshot } from '../../services/chatOfflineMetrics';
import type { ChatOfflinePolicySettings } from '../../services/chatOfflineSettings';
import type { FeatherIconName } from '../../types/featherIcon';
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, Pressable, Switch, Text, View } from 'react-native';
import { ChatMediaKind } from '../../services/chatApi';
import { formatByteCount } from '../../services/chatDisplayFormatting';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { AppSwitch } from '../ui/AppSwitch';

/**
 * Offline chat settings.
 *
 * Lifted out of the chat screen unchanged.
 */

export interface ChatMediaNetworkPolicy {
  cacheRetentionDays: number;
  canAutoDownloadFiles: boolean;
  canAutoDownloadImages: boolean;
  canAutoDownloadVideos: boolean;
  fullMediaCacheBudgetBytes: number;
  isConnectionExpensive: boolean;
  mediaLimitBytes: ChatOfflinePolicySettings['mediaLimitBytes'];
  networkLabel: string;
  offlineMediaCacheAllowed: boolean;
  wifiOnlyMediaPrefetch: boolean;
}

export function OfflineChatSettings({
  isLoading,
  isSaving,
  metrics,
  networkPolicy,
  onRefreshMetrics,
  onResetMetrics,
  onUpdatePolicy,
  settings
}: {
  isLoading: boolean;
  isSaving: boolean;
  metrics: ChatOfflineMetricsSnapshot;
  networkPolicy: ChatMediaNetworkPolicy;
  onRefreshMetrics: () => void;
  onResetMetrics: () => void;
  onUpdatePolicy: (patch: Partial<Omit<ChatOfflinePolicySettings, 'updatedAt' | 'version'>>) => void;
  settings: ChatOfflinePolicySettings;
}) {
  const appTheme = useAppTheme();
  const showChoice = (
    title: string,
    message: string,
    options: Array<{ label: string; value: number }>,
    currentValue: number,
    onSelect: (value: number) => void
  ) => {
    const currentIndex = options.findIndex((option) => option.value === currentValue);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          cancelButtonIndex: options.length,
          disabledButtonIndices: currentIndex >= 0 ? [currentIndex] : [],
          message,
          options: [
            ...options.map((option) => option.value === currentValue ? `${option.label} - Current` : option.label),
            'Cancel'
          ],
          title
        },
        (buttonIndex) => {
          if (buttonIndex >= 0 && buttonIndex < options.length) {
            onSelect(options[buttonIndex].value);
          }
        }
      );
      return;
    }

    Alert.alert(
      title,
      message,
      [
        ...options.map((option) => ({
          onPress: option.value === currentValue ? undefined : () => onSelect(option.value),
          text: option.value === currentValue ? `${option.label} - Current` : option.label
        })),
        { style: 'cancel' as const, text: 'Cancel' }
      ]
    );
  };
  const showByteChoice = (
    title: string,
    kind: ChatMediaKind,
    currentValue: number,
    onSelect: (value: number) => void
  ) => {
    const options = getTenantMediaLimitOptions(kind).map((value) => ({
      label: formatByteCount(value),
      value
    }));

    showChoice(
      title,
      'Choose the maximum size employees can send for this media type. The change applies to this company only.',
      options,
      currentValue,
      onSelect
    );
  };
  const showCacheBudgetChoice = () => {
    const options = getOfflineChatBudgetOptions().map((value) => ({
      label: formatByteCount(value),
      value
    }));

    showChoice(
      'Full-media cache budget',
      'Choose how much local storage Synzapp can use for offline media on each device.',
      options,
      settings.fullMediaCacheBudgetBytes,
      (value) => onUpdatePolicy({ fullMediaCacheBudgetBytes: value })
    );
  };
  const showRetentionChoice = () => {
    const options = getOfflineChatRetentionOptions().map((value) => ({
      label: `${value} days`,
      value
    }));

    showChoice(
      'Cache retention',
      'Choose how long Synzapp keeps cached company media on each device.',
      options,
      settings.cacheRetentionDays,
      (value) => onUpdatePolicy({ cacheRetentionDays: value })
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={appTheme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.securityList}>
      <Text style={[styles.securitySectionTitle, { color: appTheme.colors.muted }]}>Cache policy</Text>
      <SettingsCard>
      <SettingsSwitchRow
        disabled={isSaving}
        onValueChange={(value) => onUpdatePolicy({ offlineMediaCacheAllowed: value })}
        subtitle={settings.offlineMediaCacheAllowed ? 'Media can be cached for instant chat open' : 'Only text and existing local media render offline'}
        title="Offline media cache"
        value={settings.offlineMediaCacheAllowed}
      />
      <SettingsSwitchRow
        disabled={isSaving}
        onValueChange={(value) => onUpdatePolicy({ wifiOnlyMediaPrefetch: value })}
        subtitle={settings.wifiOnlyMediaPrefetch ? 'Prefetch only when this device is on Wi-Fi' : 'Images may prefetch on available networks'}
        title="Wi-Fi-only prefetch"
        value={settings.wifiOnlyMediaPrefetch}
      />
      <SettingsValueRow
        disabled={isSaving}
        onPress={showCacheBudgetChoice}
        subtitle="Maximum local storage used for offline media on this device"
        title="Full-media cache budget"
        valueLabel={formatByteCount(settings.fullMediaCacheBudgetBytes)}
      />
      <SettingsValueRow
        disabled={isSaving}
        onPress={showRetentionChoice}
        subtitle="How long company media stays cached on this device"
        title="Cache retention"
        valueLabel={`${settings.cacheRetentionDays} days`}
      />
      </SettingsCard>
      <Text style={[styles.securitySectionTitle, { color: appTheme.colors.muted }]}>Tenant media limits</Text>
      <SettingsCard>
      <SettingsValueRow
        disabled={isSaving}
        onPress={() => showByteChoice('Photo send limit', 'image', settings.mediaLimitBytes.image, (image) => onUpdatePolicy({
          mediaLimitBytes: {
            ...settings.mediaLimitBytes,
            image
          }
        }))}
        subtitle="Maximum size for each photo employees can send"
        title="Photo send limit"
        valueLabel={formatByteCount(settings.mediaLimitBytes.image)}
      />
      <SettingsValueRow
        disabled={isSaving}
        onPress={() => showByteChoice('Video send limit', 'video', settings.mediaLimitBytes.video, (video) => onUpdatePolicy({
          mediaLimitBytes: {
            ...settings.mediaLimitBytes,
            video
          }
        }))}
        subtitle="Maximum size for each video employees can send"
        title="Video send limit"
        valueLabel={formatByteCount(settings.mediaLimitBytes.video)}
      />
      <SettingsValueRow
        disabled={isSaving}
        onPress={() => showByteChoice('Document send limit', 'file', settings.mediaLimitBytes.file, (file) => onUpdatePolicy({
          mediaLimitBytes: {
            ...settings.mediaLimitBytes,
            file
          }
        }))}
        subtitle="Maximum size for each document employees can send"
        title="Document send limit"
        valueLabel={formatByteCount(settings.mediaLimitBytes.file)}
      />
      <SettingsValueRow
        disabled={isSaving}
        onPress={() => showByteChoice('Audio send limit', 'audio', settings.mediaLimitBytes.audio, (audio) => onUpdatePolicy({
          mediaLimitBytes: {
            ...settings.mediaLimitBytes,
            audio
          }
        }))}
        subtitle="Maximum size for each audio message employees can send"
        title="Audio send limit"
        valueLabel={formatByteCount(settings.mediaLimitBytes.audio)}
      />
      <SettingsSwitchRow
        disabled={isSaving}
        onValueChange={(value) => onUpdatePolicy({ purgeOnSignOut: value })}
        subtitle={settings.purgeOnSignOut ? 'Clear company cache when signing out' : 'Keep local cache for faster re-entry'}
        title="Purge on sign out"
        value={settings.purgeOnSignOut}
      />
      </SettingsCard>

      <Text style={[styles.securitySectionTitle, { color: appTheme.colors.muted }]}>Local metrics</Text>
      <SettingsCard>
        <OfflineChatMetricRow label="Chat list cache" value={formatAverageMs(metrics.chatListCacheLoadMs)} />
        <OfflineChatMetricRow label="Chat open cache" value={formatAverageMs(metrics.chatOpenCacheLoadMs)} />
        <OfflineChatMetricRow label="SQLite query" value={formatAverageMs(metrics.sqliteQueryMs)} />
        <OfflineChatMetricRow label="Media queue depth" value={String(metrics.mediaQueueDepth)} />
        <OfflineChatMetricRow label="Cache size" value={formatByteCount(metrics.cacheSizeBytes)} />
        <OfflineChatMetricRow label="Uploads" value={`${metrics.uploadSuccessCount} ok / ${metrics.uploadFailureCount} failed`} />
        <OfflineChatMetricRow label="Downloads" value={`${metrics.downloadSuccessCount} ok / ${metrics.downloadFailureCount} failed`} />
        <OfflineChatMetricRow label="Upload volume" value={formatByteCount(metrics.uploadBytesTotal)} />
        <OfflineChatMetricRow label="Download volume" value={formatByteCount(metrics.downloadBytesTotal)} />
        <OfflineChatMetricRow label="Large media" value={`${metrics.uploadLargeMediaCount} sent / ${metrics.downloadLargeMediaCount} received`} />
        <OfflineChatMetricRow label="Purges" value={`${metrics.purgeSuccessCount} ok / ${metrics.purgeFailureCount} failed`} />
        <OfflineChatMetricRow label="Network" value={networkPolicy.networkLabel} />
      </SettingsCard>

      <SettingsCard>
        <SettingsListItem
          icon="refresh-cw"
          onPress={onRefreshMetrics}
          subtitle="Update queue depth and cache size"
          title="Refresh metrics"
        />
        <SettingsListItem
          icon="rotate-ccw"
          onPress={onResetMetrics}
          subtitle="Clear local timing and counter samples"
          title="Reset metrics"
        />
      </SettingsCard>
    </View>
  );
}

function OfflineChatMetricRow({ label, value }: { label: string; value: string }) {
  const appTheme = useAppTheme();

  return (
    <View style={styles.profileDetailRow}>
      <Text style={[styles.profileDetailLabel, { color: appTheme.colors.muted }]}>{label}</Text>
      <Text numberOfLines={1} style={[styles.profileDetailValue, { color: appTheme.colors.ink }]}>{value}</Text>
    </View>
  );
}

export function SettingsListItem({
  icon,
  isLast = false,
  onPress,
  subtitle,
  title
}: {
  icon?: FeatherIconName;
  isLast?: boolean;
  onPress?: () => void;
  subtitle: string;
  title: string;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsListItem,
        {
          backgroundColor: appTheme.colors.groupedCard,
          borderBottomColor: 'transparent'
        },
        pressed && onPress && styles.pressed
      ]}
    >
      {icon ? (
        <View style={styles.settingsListIcon}>
          <Feather color={appTheme.colors.ink} name={icon} size={20} />
        </View>
      ) : null}
      <View style={styles.chatText}>
        <Text style={[styles.chatTitle, { color: appTheme.colors.ink }]}>{title}</Text>
        <Text numberOfLines={1} style={[styles.chatPreview, { color: appTheme.colors.muted }]}>{subtitle}</Text>
      </View>
      {onPress ? (
        <Feather color={appTheme.colors.muted} name="chevron-right" size={19} />
      ) : null}
    </Pressable>
  );
}

function SettingsSwitchRow({
  disabled = false,
  subtitle,
  title,
  value,
  onValueChange
}: {
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
  subtitle: string;
  title: string;
  value: boolean;
}) {
  const appTheme = useAppTheme();

  return (
    <View
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      style={[
        styles.policyControlRow,
        {
          backgroundColor: appTheme.colors.groupedCard,
          borderBottomColor: 'transparent',
          opacity: disabled ? 0.62 : 1
        }
      ]}
    >
      <View style={styles.policyControlText}>
        <Text style={[styles.policyControlTitle, { color: appTheme.colors.ink }]}>{title}</Text>
        <Text style={[styles.policyControlSubtitle, { color: appTheme.colors.muted }]}>{subtitle}</Text>
      </View>
      <AppSwitch
        disabled={disabled}
        onValueChange={onValueChange}
        value={value}
      />
    </View>
  );
}

function SettingsValueRow({
  disabled = false,
  onPress,
  subtitle,
  title,
  valueLabel
}: {
  disabled?: boolean;
  onPress: () => void;
  subtitle: string;
  title: string;
  valueLabel: string;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityHint="Opens options for this company policy."
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.policyControlRow,
        {
          backgroundColor: appTheme.colors.groupedCard,
          borderBottomColor: 'transparent',
          opacity: disabled ? 0.62 : 1
        },
        pressed && !disabled && styles.pressed
      ]}
    >
      <View style={styles.policyControlText}>
        <Text style={[styles.policyControlTitle, { color: appTheme.colors.ink }]}>{title}</Text>
        <Text style={[styles.policyControlSubtitle, { color: appTheme.colors.muted }]}>{subtitle}</Text>
      </View>
      <View style={styles.policyValueAccessory}>
        <View style={[
          styles.policyValuePill,
          {
            backgroundColor: appTheme.colors.primarySoft,
            borderColor: appTheme.colors.border
          }
        ]}>
          <Text style={[styles.policyValueText, { color: appTheme.colors.primary }]}>{valueLabel}</Text>
        </View>
        <Text style={[styles.chevronText, { color: appTheme.colors.muted }]}>›</Text>
      </View>
    </Pressable>
  );
}

function formatAverageMs(samples: number[]): string {
  if (!samples.length) {
    return 'No samples yet';
  }

  const averageMs = samples.reduce((total, sample) => total + sample, 0) / samples.length;

  return `${Math.round(averageMs)} ms avg`;
}

function getOfflineChatBudgetOptions(): number[] {
  return [
    512 * 1024 * 1024,
    1024 * 1024 * 1024,
    2 * 1024 * 1024 * 1024,
    5 * 1024 * 1024 * 1024
  ];
}

function getOfflineChatRetentionOptions(): number[] {
  return [7, 30, 90, 180, 365];
}

function getTenantMediaLimitOptions(kind: ChatMediaKind): number[] {
  const optionsByKind: Record<ChatMediaKind, number[]> = {
    audio: [8, 16, 32, 64].map((value) => value * 1024 * 1024),
    file: [25, 50, 100, 250, 500].map((value) => value * 1024 * 1024),
    image: [25, 50, 100, 150, 250].map((value) => value * 1024 * 1024),
    video: [50, 100, 250, 500, 1024].map((value) => value * 1024 * 1024)
  };

  return optionsByKind[kind];
}

/**
 * A card holding a group of rows.
 *
 * Rows sitting loose on the page is what makes a settings screen read as
 * clutter. Grouping them says which settings belong together before anybody
 * has read a word.
 */
function SettingsCard({ children }: { children: React.ReactNode }) {
  const appTheme = useAppTheme();
  const rows = React.Children.toArray(children).filter(Boolean);

  return (
    <View style={{
      backgroundColor: appTheme.colors.groupedCard,
      borderRadius: 22,
      marginHorizontal: 15,
      overflow: 'hidden'
    }}>
      {rows.map((row, index) => (
        <View key={index}>
          {index > 0 ? (
            <View style={{
              backgroundColor: appTheme.colors.separator,
              height: 1,
              marginHorizontal: 15
            }} />
          ) : null}
          {row}
        </View>
      ))}
    </View>
  );
}
