import * as Clipboard from 'expo-clipboard';
import Feather from '@expo/vector-icons/Feather';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { ANDROID_MAX_NAVIGATION_INSET } from '../../services/androidNavigationInset';
import { ChatItem } from '../../components/groups/GroupInfoModal';
import { CircleIconButton, CircleIconSpacer } from '../../components/ui/CircleIconButton';
import { DirectChatContactDetails } from '../../services/chatApi';
import { ListActionRow, ListSection } from '../../components/ui/GroupedList';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { ProfileDetailRow } from '../../components/settings/CompanyProfileSettings';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { resolveScreenBottomInset } from '../../services/rootSafeArea';
import type { FeatherIconName } from '../../types/featherIcon';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Direct contact details.
 *
 * The same grouped list as the rest of the app: a tinted page, rounded cards,
 * hairline dividers, and nothing white that is not a card. It reads top to
 * bottom as who the person is, what you can do about it, and what the company
 * records say.
 *
 * The number used to appear twice — once in a green banner and again in the
 * details — so it now appears once, in the row that carries it, where it can
 * be copied.
 *
 * Full screen on Android, which puts the navigation bar in this screen's care;
 * see `resolveScreenBottomInset`.
 */

/** How long the copy confirmation stays up before fading. */
const COPIED_FEEDBACK_MS = 1500;

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
  // No keyboard opens here, so the reported safe area is the whole answer.
  // Clamped all the same: anything taller than a navigation bar is not one.
  const screenBottomInset = resolveScreenBottomInset({
    androidNavigationInset: Math.min(insets.bottom, ANDROID_MAX_NAVIGATION_INSET),
    platform: Platform.OS
  });

  if (!chat || chat.chatType === 'GROUP') {
    return null;
  }

  const displayName = details?.displayName || chat.title;
  const profilePhotoUrl = details?.profilePhotoUrl || chat.profilePhotoUrl;
  const phoneNumber = details?.phoneFormatted || chat.phoneMasked || '*****';
  const roleName = details?.roleName || chat.roleName || 'Synzapp contact';

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
        detailStyles.screen,
        {
          backgroundColor: appTheme.colors.groupedBackground,
          paddingTop: modalTopPadding
        }
      ]}>
        <View style={detailStyles.header}>
          <CircleIconButton action="close" label="Close contact details" onPress={onClose} />
          <Text numberOfLines={1} style={[detailStyles.headerTitle, { color: appTheme.colors.ink }]}>
            Contact details
          </Text>
          <CircleIconSpacer />
        </View>

        <ScrollView
          contentContainerStyle={[
            detailStyles.content,
            { paddingBottom: Math.max(28, screenBottomInset + 24) }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ListSection>
            <View style={detailStyles.identityRow}>
              <View style={detailStyles.identityText}>
                <Text numberOfLines={2} style={[detailStyles.identityName, { color: appTheme.colors.ink }]}>
                  {displayName}
                </Text>
                <Text numberOfLines={1} style={[detailStyles.identityMeta, { color: appTheme.colors.muted }]}>
                  {roleName}
                </Text>
              </View>

              <ProfileAvatar
                headers={profilePhotoHeaders}
                name={displayName}
                size={72}
                uri={profilePhotoUrl}
              />
            </View>
          </ListSection>

          {/* One family, one stroke weight, one colour. A filled bubble beside
              two outlines was the odd one out. */}
          <ListSection>
            <View style={detailStyles.actionRow}>
              <ContactDetailAction icon="message-square" label="Message" onPress={onClose} />
              <View style={[detailStyles.actionDivider, { backgroundColor: appTheme.colors.separator }]} />
              <ContactDetailAction icon="video" label="Video call" onPress={onStartVideoCall} />
              <View style={[detailStyles.actionDivider, { backgroundColor: appTheme.colors.separator }]} />
              <ContactDetailAction icon="phone" label="Audio call" onPress={onStartVoiceCall} />
            </View>
          </ListSection>

          <ListSection title="Details">
            <CopyableDetailRow label="Phone" value={phoneNumber} />
            <ProfileDetailRow label="Company" value={details?.companyName || 'Your organization'} />
            <ProfileDetailRow label="Department" value={details?.departmentName || 'Not assigned'} />
            <ProfileDetailRow label="Org Admin" value={details?.organizationAdminName || 'Not assigned'} />
            <ProfileDetailRow label="Dept Admin" value={details?.departmentAdminName || 'Not assigned'} />
            <ProfileDetailRow label="Role" value={roleName} />
          </ListSection>

          <ListSection>
            <ListActionRow
              icon="users"
              label="Add to group"
              onPress={onAddToGroup}
            />
          </ListSection>

          {isLoading ? (
            <View style={styles.notificationSettingsLoadingRow}>
              <ActivityIndicator color={appTheme.colors.primary} />
              <Text style={[styles.notificationSettingsLoadingText, { color: appTheme.colors.muted }]}>
                Loading contact details...
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** One of the three things you can do about this person. */
function ContactDetailAction({
  icon,
  label,
  onPress
}: {
  icon: FeatherIconName;
  label: string;
  onPress: () => void;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        detailStyles.action,
        pressed && { backgroundColor: appTheme.colors.groupedBackground }
      ]}
    >
      <Feather color={appTheme.colors.link} name={icon} size={21} />
      <Text numberOfLines={1} style={[detailStyles.actionText, { color: appTheme.colors.link }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * A detail row whose value can be taken away.
 *
 * A long press copies it, and so does a tap: a gesture with nothing on screen
 * to suggest it is a feature nobody finds, so the row carries a copy icon that
 * both hints at the gesture and works on its own.
 *
 * It says so afterwards. A silent copy leaves somebody pressing again to check,
 * and pasting is the only way they can find out.
 */
function CopyableDetailRow({ label, value }: { label: string; value: string }) {
  const appTheme = useAppTheme();
  const [didCopy, setDidCopy] = useState(false);
  const feedback = useRef(new Animated.Value(0)).current;
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
    }
  }, []);

  function copyValue() {
    void Clipboard.setStringAsync(value);
    setDidCopy(true);
    feedback.setValue(0);
    Animated.timing(feedback, {
      duration: 160,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true
    }).start();

    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
    }

    resetTimer.current = setTimeout(() => {
      Animated.timing(feedback, {
        duration: 220,
        easing: Easing.in(Easing.cubic),
        toValue: 0,
        useNativeDriver: true
      }).start(({ finished }) => {
        if (finished) {
          setDidCopy(false);
        }
      });
    }, COPIED_FEEDBACK_MS);
  }

  return (
    <Pressable
      accessibilityHint="Copies it to the clipboard"
      accessibilityLabel={`${label}, ${value}`}
      accessibilityRole="button"
      onLongPress={copyValue}
      onPress={copyValue}
      style={({ pressed }) => [
        styles.profileDetailRow,
        detailStyles.copyRow,
        pressed && { backgroundColor: appTheme.colors.groupedBackground }
      ]}
    >
      <Text style={[styles.profileDetailLabel, { color: appTheme.colors.muted }]}>{label}</Text>
      <Text numberOfLines={2} style={[styles.profileDetailValue, { color: appTheme.colors.ink }]}>
        {value}
      </Text>

      {didCopy ? (
        <Animated.Text
          style={[
            detailStyles.copiedText,
            {
              color: appTheme.colors.link,
              opacity: feedback,
              transform: [{
                translateY: feedback.interpolate({ inputRange: [0, 1], outputRange: [4, 0] })
              }]
            }
          ]}
        >
          Copied
        </Animated.Text>
      ) : (
        <Feather color={appTheme.colors.muted} name="copy" size={17} />
      )}
    </Pressable>
  );
}

const detailStyles = StyleSheet.create({
  screen: {
    flex: 1
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    paddingHorizontal: 10,
    textAlign: 'center'
  },
  content: {
    paddingTop: 2
  },
  identityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16
  },
  identityText: {
    flex: 1,
    gap: 3,
    minWidth: 0
  },
  identityName: {
    fontSize: 22,
    lineHeight: 28
  },
  identityMeta: {
    fontSize: 14.5,
    lineHeight: 20
  },
  actionRow: {
    alignItems: 'stretch',
    flexDirection: 'row'
  },
  action: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 6,
    paddingVertical: 14
  },
  actionText: {
    fontSize: 13.5,
    lineHeight: 18,
    textAlign: 'center'
  },
  actionDivider: {
    marginVertical: 12,
    width: 1
  },
  copyRow: {
    alignItems: 'center',
    gap: 12
  },
  copiedText: {
    fontSize: 13,
    lineHeight: 18
  }
});
