import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { ANDROID_MAX_NAVIGATION_INSET } from '../../services/androidNavigationInset';
import { ChatItem, getChatNotificationMuteLabel } from '../../components/groups/GroupInfoModal';
import { ChatNotificationAlertTone, ChatNotificationSettings } from '../../services/chatApi';
import { CircleIconButton, CircleIconSpacer } from '../../components/ui/CircleIconButton';
import { ListSection } from '../../components/ui/GroupedList';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { resolveScreenBottomInset } from '../../services/rootSafeArea';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Per-chat notification settings.
 *
 * The app's grouped list: a tinted page, one rounded card, a hairline between
 * its two rows, and a quiet label above it. Two settings do not need more.
 *
 * Full screen on Android, so the navigation bar is this screen's own problem;
 * see `resolveScreenBottomInset`.
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
  // No keyboard opens here, so the reported safe area is the whole answer.
  // Clamped all the same: anything taller than a navigation bar is not one.
  const screenBottomInset = resolveScreenBottomInset({
    androidNavigationInset: Math.min(insets.bottom, ANDROID_MAX_NAVIGATION_INSET),
    platform: Platform.OS
  });

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
        notificationStyles.screen,
        {
          backgroundColor: appTheme.colors.groupedBackground,
          paddingTop: modalTopPadding
        }
      ]}>
        <View style={notificationStyles.header}>
          <CircleIconButton
            action="back"
            label={chat.chatType === 'GROUP' ? 'Back to group info' : 'Back to contact info'}
            onPress={onClose}
          />
          <View style={notificationStyles.headerText}>
            <Text numberOfLines={1} style={[notificationStyles.headerTitle, { color: appTheme.colors.ink }]}>
              Notifications
            </Text>
            <Text numberOfLines={1} style={[notificationStyles.headerSubtitle, { color: appTheme.colors.muted }]}>
              {chat.title}
            </Text>
          </View>
          <CircleIconSpacer />
        </View>

        <ScrollView
          contentContainerStyle={[
            notificationStyles.content,
            { paddingBottom: Math.max(28, screenBottomInset + 24) }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ListSection title="Messages">
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
          </ListSection>

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
      accessibilityState={{ disabled }}
      accessibilityValue={{ text: value }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        notificationStyles.row,
        pressed && !disabled && { backgroundColor: appTheme.colors.groupedBackground },
        disabled && notificationStyles.disabled
      ]}
    >
      <Text numberOfLines={1} style={[notificationStyles.rowLabel, { color: appTheme.colors.ink }]}>
        {label}
      </Text>
      <View style={notificationStyles.rowValueWrap}>
        <Text numberOfLines={1} style={[notificationStyles.rowValue, { color: appTheme.colors.muted }]}>
          {value}
        </Text>
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

const notificationStyles = StyleSheet.create({
  screen: {
    flex: 1
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10
  },
  headerTitle: {
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'center'
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 1,
    textAlign: 'center'
  },
  content: {
    paddingTop: 2
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 11
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    minWidth: 0
  },
  rowValueWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 6,
    minWidth: 0
  },
  rowValue: {
    fontSize: 15.5,
    lineHeight: 20
  },
  disabled: {
    opacity: 0.4
  }
});
