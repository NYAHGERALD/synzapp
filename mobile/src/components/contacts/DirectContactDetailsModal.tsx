import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { ChatItem } from '../../components/groups/GroupInfoModal';
import { DirectChatContactDetails } from '../../services/chatApi';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { ProfileDetailRow } from '../../components/settings/CompanyProfileSettings';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Direct contact details.
 *
 * Lifted out of the chat screen unchanged.
 */

export function DirectContactDetailsModal({
  chat,
  details,
  isLoading,
  isOpen,
  onAddToGroup,
  onClose,
  onStartVideoCall,
  onStartVoiceCall,
  profilePhotoHeaders
}: {
  chat: ChatItem | null;
  details: DirectChatContactDetails | null;
  isLoading: boolean;
  isOpen: boolean;
  onAddToGroup: () => void;
  onClose: () => void;
  onStartVideoCall: () => void;
  onStartVoiceCall: () => void;
  profilePhotoHeaders?: Record<string, string>;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);

  if (!chat || chat.chatType === 'GROUP') {
    return null;
  }

  const displayName = details?.displayName || chat.title;
  const profilePhotoUrl = details?.profilePhotoUrl || chat.profilePhotoUrl;
  const phoneNumber = details?.phoneFormatted || chat.phoneMasked || '*****';

  return (
    <Modal
      allowSwipeDismissal={Platform.OS === 'ios'}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle={getNativeFullHeightModalPresentationStyle()}
      transparent={false}
      visible={isOpen}
    >
      <View style={[
        styles.directContactDetailsScreen,
        {
          backgroundColor: appTheme.colors.screen,
          paddingTop: modalTopPadding
        }
      ]}>
        <View style={styles.directContactDetailsTopBar}>
          <Pressable
            accessibilityLabel="Close contact details"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.groupInfoTopButton,
              { backgroundColor: appTheme.colors.surface },
              pressed && styles.pressed
            ]}
          >
            <Feather color={appTheme.colors.ink} name="x" size={22} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.directContactDetailsContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.directContactDetailsHero}>
            <ProfileAvatar
              headers={profilePhotoHeaders}
              name={displayName}
              size={104}
              uri={profilePhotoUrl}
            />
            <Text numberOfLines={2} style={[styles.directContactDetailsName, { color: appTheme.colors.ink }]}>{displayName}</Text>
            <Text numberOfLines={1} style={[styles.directContactDetailsRole, { color: appTheme.colors.muted }]}>
              {details?.roleName || chat.roleName || 'Synzapp contact'}
            </Text>
          </View>

          <View style={[styles.directContactPhoneCard, { backgroundColor: appTheme.colors.surfaceElevated }]}>
            <View style={styles.directContactPhoneText}>
              <Text style={[styles.directContactPhoneLabel, { color: appTheme.colors.muted }]}>mobile</Text>
              <Text numberOfLines={1} style={[styles.directContactPhoneNumber, { color: appTheme.colors.success }]}>{phoneNumber}</Text>
            </View>
            <View style={styles.directContactPhoneActions}>
              <Pressable
                accessibilityLabel="Message contact"
                accessibilityRole="button"
                onPress={onClose}
                style={({ pressed }) => [
                  styles.directContactActionButton,
                  { backgroundColor: appTheme.colors.primarySoft },
                  pressed && styles.pressed
                ]}
              >
                <Ionicons color={appTheme.colors.primary} name="chatbubble" size={18} />
              </Pressable>
              <Pressable
                accessibilityLabel="Video call contact"
                accessibilityRole="button"
                onPress={onStartVideoCall}
                style={({ pressed }) => [
                  styles.directContactActionButton,
                  { backgroundColor: appTheme.colors.primarySoft },
                  pressed && styles.pressed
                ]}
              >
                <Feather color={appTheme.colors.primary} name="video" size={18} />
              </Pressable>
              <Pressable
                accessibilityLabel="Call contact"
                accessibilityRole="button"
                onPress={onStartVoiceCall}
                style={({ pressed }) => [
                  styles.directContactActionButton,
                  { backgroundColor: appTheme.colors.primarySoft },
                  pressed && styles.pressed
                ]}
              >
                <Feather color={appTheme.colors.primary} name="phone" size={18} />
              </Pressable>
            </View>
          </View>

          <View style={[styles.directContactDetailsCard, { backgroundColor: appTheme.colors.surfaceElevated }]}>
            <ProfileDetailRow label="Phone" value={phoneNumber} />
            <ProfileDetailRow label="Company" value={details?.companyName || 'Your organization'} />
            <ProfileDetailRow label="Department" value={details?.departmentName || 'Not assigned'} />
            <ProfileDetailRow label="Org Admin" value={details?.organizationAdminName || 'Not assigned'} />
            <ProfileDetailRow label="Dept Admin" value={details?.departmentAdminName || 'Not assigned'} />
            <ProfileDetailRow label="Role" value={details?.roleName || chat.roleName || 'Employee'} />
          </View>

          <Pressable
            accessibilityLabel={`Add ${displayName} to group`}
            accessibilityRole="button"
            onPress={onAddToGroup}
            style={({ pressed }) => [
              styles.directContactAddGroupRow,
              { backgroundColor: appTheme.colors.surfaceElevated },
              pressed && styles.pressed
            ]}
          >
            <Text style={[styles.directContactAddGroupText, { color: appTheme.colors.success }]}>Add to group</Text>
          </Pressable>

          {isLoading ? (
            <View style={styles.notificationSettingsLoadingRow}>
              <ActivityIndicator color={appTheme.colors.primary} />
              <Text style={[styles.notificationSettingsLoadingText, { color: appTheme.colors.muted }]}>Loading contact details...</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
