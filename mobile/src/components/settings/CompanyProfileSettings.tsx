import * as Calendar from 'expo-calendar';
import Feather from '@expo/vector-icons/Feather';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { CompanyProfile } from '../../services/adminApi';
import { SettingsInput } from '../../components/organization/OrganizationDeletionModal';
import { getCalendarYearStartDateLabel, isValidCalendarYearStartDate } from '../../utils/calendarYear';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { ListActionRow, ListSection } from '../ui/GroupedList';

/**
 * Company profile settings.
 *
 * Lifted out of the chat screen unchanged.
 */

export function ProfileDetailRow({ label, value }: { label: string; value: string }) {
  const appTheme = useAppTheme();

  return (
    <View style={styles.profileDetailRow}>
      <Text style={[styles.profileDetailLabel, { color: appTheme.colors.muted }]}>{label}</Text>
      <Text numberOfLines={2} style={[styles.profileDetailValue, { color: appTheme.colors.ink }]}>{value}</Text>
    </View>
  );
}

export function CompanyProfileSettings({
  companyAddress,
  calendarYearStartDate,
  companyName,
  isLoading,
  isSavingLogo,
  isSaving,
  onAddressChange,
  onCalendarYearStartDatePress,
  onChangeLogo,
  onNameChange,
  onSave,
  profile,
  profilePhotoHeaders
}: {
  companyAddress: string;
  calendarYearStartDate: string | null;
  companyName: string;
  isLoading: boolean;
  isSavingLogo: boolean;
  isSaving: boolean;
  onAddressChange: (value: string) => void;
  onCalendarYearStartDatePress: () => void;
  onChangeLogo: () => void;
  onNameChange: (value: string) => void;
  onSave: () => void;
  profile: CompanyProfile | null;
  profilePhotoHeaders?: Record<string, string>;
}) {
  const appTheme = useAppTheme();
  const [didLogoFail, setDidLogoFail] = useState(false);
  const companyLogoUrl = profile?.companyLogoUrl || null;
  const companyLogoCacheKey = profile?.companyLogoCacheKey || null;

  useEffect(() => {
    setDidLogoFail(false);
  }, [companyLogoCacheKey, companyLogoUrl]);

  if (isLoading && !profile) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={appTheme.colors.primary} />
      </View>
    );
  }

  const canSave = companyName.trim().length >= 2 &&
    companyAddress.trim().length >= 5 &&
    isValidCalendarYearStartDate(calendarYearStartDate) &&
    !isSaving;
  const canLoadLogo = Boolean(companyLogoUrl && !didLogoFail);
  // Same reason as the avatars: a fresh source object each render makes
  // Android fetch the logo again and flash the placeholder behind it.
  const companyLogoSource = useMemo(() => {
    if (!canLoadLogo || !companyLogoUrl) {
      return null;
    }

    return profilePhotoHeaders
      ? { headers: profilePhotoHeaders, uri: companyLogoUrl }
      : { uri: companyLogoUrl };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoadLogo, companyLogoUrl, profilePhotoHeaders?.Authorization]);

  return (
    <View style={styles.companyProfileForm}>
      <ListSection title="Company">
      <Pressable
        accessibilityRole="button"
        disabled={isSavingLogo}
        onPress={onChangeLogo}
        style={({ pressed }) => [
          styles.companyLogoRow,
          { borderBottomColor: 'transparent' },
          pressed && !isSavingLogo && styles.pressed,
          isSavingLogo && styles.disabled
        ]}
      >
        <View style={[styles.companyLogoBox, { backgroundColor: appTheme.colors.primarySoft }]}>
          {companyLogoSource ? (
            <Image
              onError={() => setDidLogoFail(true)}
              resizeMode="cover"
              source={companyLogoSource}
              style={styles.companyLogoImage}
            />
          ) : (
            <Feather name="image" color={appTheme.colors.primary} size={22} />
          )}
        </View>
        <View style={styles.chatText}>
          <Text style={[styles.chatTitle, { color: appTheme.colors.ink }]}>
            {isSavingLogo
              ? 'Updating company logo...'
              : companyLogoUrl
                ? 'Change company logo'
                : 'Add company logo'}
          </Text>
          <Text style={[styles.chatPreview, { color: appTheme.colors.muted }]}>Optional</Text>
        </View>
      </Pressable>
      <SettingsInput
        onChangeText={onNameChange}
        placeholder="Company name"
        value={companyName}
      />
      <SettingsInput
        onChangeText={onAddressChange}
        placeholder="Company address"
        value={companyAddress}
      />
      <Pressable
        accessibilityRole="button"
        onPress={onCalendarYearStartDatePress}
        style={({ pressed }) => [
          styles.companyCalendarYearRow,
          { borderBottomColor: 'transparent' },
          pressed && styles.pressed
        ]}
      >
        <View style={styles.chatText}>
          <Text style={[styles.chatTitle, { color: appTheme.colors.ink }]}>Calendar year</Text>
          <Text style={[styles.chatPreview, { color: appTheme.colors.muted }]}>
            LSW Week 1 starts on this date for your company.
          </Text>
        </View>
        <Text style={[styles.companyCalendarYearValue, { color: appTheme.colors.primary }]}>
          {getCalendarYearStartDateLabel(calendarYearStartDate)}
        </Text>
        <Feather name="chevron-right" color={appTheme.colors.muted} size={18} />
      </Pressable>
      </ListSection>

      <ListSection>
        <ListActionRow
          disabled={!canSave}
          label={isSaving ? 'Saving' : 'Save changes'}
          onPress={onSave}
        />
      </ListSection>

      {profile ? (
        <ListSection title="Organization">
          <ProfileDetailRow label="Security" value={formatSettingValue(profile.securityMode)} />
          <ProfileDetailRow label="Retention" value={formatSettingValue(profile.retentionPolicy)} />
          <ProfileDetailRow label="Calendar year" value={getCalendarYearStartDateLabel(profile.calendarYearStartDate)} />
          <ProfileDetailRow label="Status" value={formatEmployeeStatus(profile.status)} />
        </ListSection>
      ) : null}
    </View>
  );
}

export function formatEmployeeStatus(status: string): string {
  if (status === 'INVITED') {
    return 'Invited';
  }

  if (status === 'ACTIVE') {
    return 'Active';
  }

  if (status === 'DEACTIVATED') {
    return 'Deactivated';
  }

  if (status === 'SUSPENDED') {
    return 'Suspended';
  }

  if (status === 'ARCHIVED') {
    return 'Archived';
  }

  if (status === 'DELETED') {
    return 'Deleted';
  }

  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function formatSettingValue(value: string): string {
  return value
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ') || 'Not set';
}
