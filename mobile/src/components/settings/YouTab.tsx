import Feather from '@expo/vector-icons/Feather';
import { StyleSheet } from 'react-native';
import { ListSection } from '../ui/GroupedList';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { CurrentUserProfile } from '../../services/profileApi';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { ProfileDetailRow, formatEmployeeStatus } from '../../components/settings/CompanyProfileSettings';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * The You tab.
 *
 * Lifted out of the chat screen unchanged.
 */

export function YouTab({
  isLoading,
  isSavingPhoto,
  isSigningOut,
  onChangePhoto,
  onSignOut,
  profile,
  profilePhotoHeaders
}: {
  isLoading: boolean;
  isSavingPhoto: boolean;
  isSigningOut: boolean;
  onChangePhoto: () => void;
  onSignOut: () => void;
  profile: CurrentUserProfile | null;
  profilePhotoHeaders?: Record<string, string>;
}) {
  const appTheme = useAppTheme();

  if (isLoading && !profile) {
    return (
      <View style={styles.youLoading}>
        <ActivityIndicator color={appTheme.colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.emptyState}>
        <Text style={[styles.emptyTitle, { color: appTheme.colors.muted }]}>Profile unavailable</Text>
      </View>
    );
  }

  return (
    <View style={styles.youContent}>
      {/* Name on the left, photo on the right. The name is what identifies
          the person; the photo confirms it. */}
      <ListSection>
        <View style={youStyles.identityRow}>
          <View style={youStyles.identityText}>
            <Text numberOfLines={2} style={[youStyles.identityName, { color: appTheme.colors.ink }]}>
              {profile.displayName}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={isSavingPhoto}
              hitSlop={8}
              onPress={onChangePhoto}
              style={({ pressed }) => [pressed && !isSavingPhoto && styles.pressed]}
            >
              <Text style={[youStyles.identityAction, { color: appTheme.colors.link }]}>
                {isSavingPhoto
                  ? 'Updating photo'
                  : profile.profilePhotoUrl
                    ? 'Change profile photo'
                    : 'Add profile photo'}
              </Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityLabel={profile.profilePhotoUrl ? 'Change profile photo' : 'Add profile photo'}
            accessibilityRole="button"
            disabled={isSavingPhoto}
            onPress={onChangePhoto}
            style={({ pressed }) => [
              pressed && !isSavingPhoto && styles.pressed,
              isSavingPhoto && styles.disabled
            ]}
          >
            <ProfileAvatar
              headers={profilePhotoHeaders}
              name={profile.displayName}
              size={72}
              uri={profile.profilePhotoUrl}
            />
          </Pressable>
        </View>
      </ListSection>

      <ListSection title="Details">
        <ProfileDetailRow label="Phone" value={profile.phoneFormatted} />
        {profile.departmentName ? (
          <ProfileDetailRow label="Department" value={profile.departmentName} />
        ) : null}
        <ProfileDetailRow label="Role" value={profile.roleName} />
        <ProfileDetailRow label="Company" value={profile.companyName} />
        <ProfileDetailRow label="Status" value={formatEmployeeStatus(profile.status)} />
      </ListSection>

      <ListSection title="Session">
        <Pressable
          accessibilityLabel="Sign out of Synzapp"
          accessibilityRole="button"
          disabled={isSigningOut}
          onPress={onSignOut}
          style={({ pressed }) => [
            styles.youSignOutRow,
            pressed && !isSigningOut && styles.pressed,
            isSigningOut && styles.disabled
          ]}
        >
          <View style={styles.youSignOutIcon}>
            {isSigningOut ? (
              <ActivityIndicator color="#DC2626" size="small" />
            ) : (
              <Feather color="#DC2626" name="log-out" size={18} />
            )}
          </View>
          <View style={styles.youSignOutCopy}>
            <Text style={styles.youSignOutTitle}>{isSigningOut ? 'Signing out...' : 'Sign out'}</Text>
            <Text style={[styles.youSignOutText, { color: appTheme.colors.muted }]}>
              End this verified session on this device.
            </Text>
          </View>
          <Feather color={appTheme.colors.muted} name="chevron-right" size={18} />
        </Pressable>
      </ListSection>
    </View>
  );
}

const youStyles = StyleSheet.create({
  identityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16
  },
  identityText: {
    flex: 1,
    gap: 4,
    minWidth: 0
  },
  identityName: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28
  },
  identityAction: {
    fontSize: 15
  }
});
