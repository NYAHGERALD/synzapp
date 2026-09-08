import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { ChatItem, getChatNotificationMuteLabel } from '../../components/groups/GroupInfoModal';
import { ChatNotificationAlertTone, ChatNotificationSettings } from '../../services/chatApi';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Per-chat notification settings.
 *
 * Lifted out of the chat screen unchanged.
 */

export const chatNotificationAlertToneOptions: Array<{
  label: string;
  value: ChatNotificationAlertTone;
}> = [
  { label: 'Default (Note)', value: 'default' },
  { label: 'Chime', value: 'chime' },
  { label: 'Pulse', value: 'pulse' },
  { label: 'Silent', value: 'silent' }
];

export function ChatNotificationSettingsModal({
  chat,
  isLoading,
  isOpen,
  isSaving,
  onClose,
  onSelectAlertTone,
  onSelectMuteMode,
  settings
}: {
  chat: ChatItem | null;
  isLoading: boolean;
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSelectAlertTone: () => void;
  onSelectMuteMode: () => void;
  settings: ChatNotificationSettings | null;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);

  if (!chat) {
    return null;
  }

  const effectiveSettings = settings || getDefaultChatNotificationSettings(chat.contactId);

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
        styles.notificationSettingsScreen,
        {
          backgroundColor: appTheme.colors.screen,
          paddingTop: modalTopPadding
        }
      ]}>
        <View style={styles.notificationSettingsTopBar}>
          <Pressable
            accessibilityLabel={chat.chatType === 'GROUP' ? 'Back to group info' : 'Back to contact info'}
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.groupInfoTopButton,
              { backgroundColor: appTheme.colors.surface },
              pressed && styles.pressed
            ]}
          >
            <Text style={[styles.backButtonText, { color: appTheme.colors.primary }]}>‹</Text>
          </Pressable>
          <View style={styles.notificationSettingsHeaderText}>
            <Text numberOfLines={1} style={[styles.notificationSettingsTitle, { color: appTheme.colors.ink }]}>Notifications</Text>
            <Text numberOfLines={1} style={[styles.notificationSettingsSubtitle, { color: appTheme.colors.muted }]}>{chat.title}</Text>
          </View>
          <View style={styles.groupInfoTopButtonSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.notificationSettingsContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.notificationSettingsSectionLabel, { color: appTheme.colors.muted }]}>Messages</Text>

          <View style={[styles.notificationSettingsSection, { backgroundColor: appTheme.colors.surfaceElevated }]}>
            <ChatNotificationSettingsRow
              disabled={isSaving}
              label="Mute notifications"
              onPress={onSelectMuteMode}
              value={getChatNotificationMuteLabel(effectiveSettings)}
            />
            <ChatNotificationSettingsRow
              disabled={isSaving}
              label="Alert tone"
              onPress={onSelectAlertTone}
              value={getChatNotificationAlertToneLabel(effectiveSettings.alertTone)}
            />
          </View>

          {isLoading || isSaving ? (
            <View style={styles.notificationSettingsLoadingRow}>
              <ActivityIndicator color={appTheme.colors.primary} />
              <Text style={[styles.notificationSettingsLoadingText, { color: appTheme.colors.muted }]}>
                {isSaving ? 'Saving settings...' : 'Loading settings...'}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function ChatNotificationSettingsRow({
  disabled,
  label,
  onPress,
  value
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
  value: string;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.notificationSettingsRow,
        {
          backgroundColor: appTheme.colors.surfaceElevated,
          borderBottomColor: appTheme.colors.divider
        },
        pressed && styles.pressed,
        disabled && styles.disabled
      ]}
    >
      <Text numberOfLines={1} style={[styles.notificationSettingsRowLabel, { color: appTheme.colors.ink }]}>{label}</Text>
      <View style={styles.notificationSettingsRowValueWrap}>
        <Text numberOfLines={1} style={[styles.notificationSettingsRowValue, { color: appTheme.colors.muted }]}>{value}</Text>
        <Feather color={appTheme.colors.muted} name="chevron-right" size={19} />
      </View>
    </Pressable>
  );
}

export function getDefaultChatNotificationSettings(contactId: string): ChatNotificationSettings {
  return {
    alertTone: 'default',
    contactId,
    muteMode: 'off',
    mutedUntil: null,
    updatedAt: null
  };
}

function getChatNotificationAlertToneLabel(alertTone: ChatNotificationAlertTone): string {
  return chatNotificationAlertToneOptions.find((option) => option.value === alertTone)?.label || 'Default (Note)';
}
