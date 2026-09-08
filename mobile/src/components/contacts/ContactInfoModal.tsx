import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { ChatContact, ChatNotificationSettings, ChatTranscriptLanguageCode, ChatTranscriptLanguageSetting, DirectChatContactDetails } from '../../services/chatApi';
import { ChatItem, getChatNotificationSummary } from '../../components/groups/GroupInfoModal';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ANDROID_MAX_NAVIGATION_INSET } from '../../services/androidNavigationInset';
import { CircleIconButton, CircleIconSpacer } from '../../components/ui/CircleIconButton';
import { ListNavRow, ListSection } from '../../components/ui/GroupedList';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { resolveScreenBottomInset } from '../../services/rootSafeArea';
import type { FeatherIconName } from '../../types/featherIcon';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Contact details and per-contact settings.
 *
 * Built from the app's grouped list: a tinted page with rounded cards on it,
 * hairline dividers inside them, and no white anywhere that is not a card. The
 * identity card follows the same arrangement as the profile card in Settings —
 * name, number and presence on the left, the face on the right — because the
 * words are what identify somebody and the photograph only confirms it.
 *
 * The three call actions share one card rather than sitting as separate slabs,
 * divided the way rows in a card are divided. They are tinted text, not filled
 * buttons.
 *
 * This is a full-screen modal on Android, which means the app root's
 * `SafeAreaView` is not above it and the navigation bar is this screen's own
 * problem. The scroll content pays for it; see `resolveScreenBottomInset`.
 */

export interface TranscriptLanguageOption {
  code: ChatTranscriptLanguageCode;
  label: string;
  status: 'available' | 'onDevice';
}

export const chatTranscriptLanguageOptions: TranscriptLanguageOption[] = [
  { code: 'en-US', label: 'English (United States)', status: 'onDevice' },
  { code: 'ar-SA', label: 'Arabic (Saudi Arabia)', status: 'available' },
  { code: 'yue-CN', label: 'Cantonese (China mainland)', status: 'available' },
  { code: 'zh-CN', label: 'Chinese (China mainland)', status: 'available' },
  { code: 'zh-HK', label: 'Chinese (Hong Kong)', status: 'available' },
  { code: 'zh-TW', label: 'Chinese (Taiwan)', status: 'available' },
  { code: 'da-DK', label: 'Danish (Denmark)', status: 'available' },
  { code: 'nl-BE', label: 'Dutch (Belgium)', status: 'available' },
  { code: 'nl-NL', label: 'Dutch (Netherlands)', status: 'available' },
  { code: 'en-AU', label: 'English (Australia)', status: 'available' },
  { code: 'en-CA', label: 'English (Canada)', status: 'available' },
  { code: 'en-GB', label: 'English (United Kingdom)', status: 'available' },
  { code: 'en-IN', label: 'English (India)', status: 'available' },
  { code: 'fr-CA', label: 'French (Canada)', status: 'available' },
  { code: 'fr-FR', label: 'French (France)', status: 'available' },
  { code: 'de-DE', label: 'German (Germany)', status: 'available' },
  { code: 'hi-IN', label: 'Hindi (India)', status: 'available' },
  { code: 'it-IT', label: 'Italian (Italy)', status: 'available' },
  { code: 'ja-JP', label: 'Japanese (Japan)', status: 'available' },
  { code: 'ko-KR', label: 'Korean (South Korea)', status: 'available' },
  { code: 'pt-BR', label: 'Portuguese (Brazil)', status: 'available' },
  { code: 'es-MX', label: 'Spanish (Mexico)', status: 'available' },
  { code: 'es-ES', label: 'Spanish (Spain)', status: 'available' }
];

export function ContactInfoModal({
  chat,
  commonGroups,
  contactDetails,
  isOpen,
  notificationSettings,
  transcriptLanguage,
  onAddToGroup,
  onClose,
  onCreateGroup,
  onOpenContactDetails,
  onOpenGroup,
  onOpenNotifications,
  onOpenSearch,
  onOpenTranscriptLanguage,
  onStartVideoCall,
  onStartVoiceCall,
  profilePhotoHeaders
}: {
  chat: ChatItem | null;
  commonGroups: ChatContact[];
  contactDetails: DirectChatContactDetails | null;
  isOpen: boolean;
  notificationSettings: ChatNotificationSettings | null;
  transcriptLanguage: ChatTranscriptLanguageSetting | null;
  onAddToGroup: () => void;
  onClose: () => void;
  onCreateGroup: () => void;
  onOpenContactDetails: () => void;
  onOpenGroup: (group: ChatContact) => void;
  onOpenNotifications: () => void;
  onOpenSearch: () => void;
  onOpenTranscriptLanguage: () => void;
  onStartVideoCall: () => void;
  onStartVoiceCall: () => void;
  profilePhotoHeaders?: Record<string, string>;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);
  // No keyboard ever opens on this screen, so the reported safe area is the
  // whole answer rather than something that might be a keyboard in disguise.
  // It is still clamped: anything taller than a navigation bar is not one.
  const screenBottomInset = resolveScreenBottomInset({
    androidNavigationInset: Math.min(insets.bottom, ANDROID_MAX_NAVIGATION_INSET),
    platform: Platform.OS
  });

  if (!chat || chat.chatType === 'GROUP') {
    return null;
  }

  const visibleCommonGroups = commonGroups.slice(0, 3);
  const phoneNumber = contactDetails?.phoneFormatted || chat.phoneMasked || null;

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
        contactStyles.screen,
        {
          backgroundColor: appTheme.colors.groupedBackground,
          paddingTop: modalTopPadding
        }
      ]}>
        {/* Same colour as the page, and no rule under it. The header is part of
            the page, not a bar sitting on top of it. */}
        <View style={contactStyles.header}>
          <CircleIconButton action="back" label="Close contact info" onPress={onClose} />
          <Text numberOfLines={1} style={[contactStyles.headerTitle, { color: appTheme.colors.ink }]}>
            Contact info
          </Text>
          <CircleIconSpacer />
        </View>

        <ScrollView
          contentContainerStyle={[
            contactStyles.content,
            { paddingBottom: Math.max(28, screenBottomInset + 24) }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ListSection>
            <View style={contactStyles.identityRow}>
              <View style={contactStyles.identityText}>
                <Text numberOfLines={2} style={[contactStyles.identityName, { color: appTheme.colors.ink }]}>
                  {chat.title}
                </Text>
                {phoneNumber ? (
                  <Text numberOfLines={1} style={[contactStyles.identityMeta, { color: appTheme.colors.muted }]}>
                    {phoneNumber}
                  </Text>
                ) : null}
                <Text numberOfLines={1} style={[contactStyles.identityMeta, { color: appTheme.colors.muted }]}>
                  {getContactInfoPresenceText(chat)}
                </Text>
              </View>

              <ProfileAvatar
                headers={profilePhotoHeaders}
                name={chat.title}
                size={72}
                uri={chat.profilePhotoUrl}
              />
            </View>
          </ListSection>

          <ListSection>
            <View style={contactStyles.actionRow}>
              <ContactInfoAction icon="phone" label="Audio" onPress={onStartVoiceCall} />
              <View style={[contactStyles.actionDivider, { backgroundColor: appTheme.colors.separator }]} />
              <ContactInfoAction icon="video" label="Video" onPress={onStartVideoCall} />
              <View style={[contactStyles.actionDivider, { backgroundColor: appTheme.colors.separator }]} />
              <ContactInfoAction icon="search" label="Search" onPress={onOpenSearch} />
            </View>
          </ListSection>

          <ListSection>
            <ListNavRow
              icon="bell"
              onPress={onOpenNotifications}
              subtitle={getChatNotificationSummary(notificationSettings)}
              title="Notifications"
            />
            <ListNavRow
              icon="file-text"
              onPress={onOpenTranscriptLanguage}
              subtitle={getChatTranscriptLanguageLabel(transcriptLanguage?.languageCode || 'en-US')}
              title="Transcript language"
            />
            <ListNavRow
              icon="user"
              onPress={onOpenContactDetails}
              title="Contact details"
            />
          </ListSection>

          <ListSection title="Groups">
            <ListNavRow
              icon="plus"
              onPress={onCreateGroup}
              title={`Create group with ${chat.title}`}
            />
            <ListNavRow icon="users" onPress={onAddToGroup} title="Add to group" />
          </ListSection>

          {/* Only when there is something to list. A card headed "0 groups in
              common" holding nothing is a card with no reason to exist. */}
          {commonGroups.length ? (
            <ListSection title={formatCommonGroupCount(commonGroups.length)}>
              {visibleCommonGroups.map((group) => (
                <ContactCommonGroupRow
                  contactName={chat.title}
                  group={group}
                  key={group.contactId}
                  onOpen={() => onOpenGroup(group)}
                  profilePhotoHeaders={profilePhotoHeaders}
                />
              ))}
              {commonGroups.length > visibleCommonGroups.length ? (
                <ListNavRow icon="chevron-down" onPress={onOpenSearch} title="See all" />
              ) : null}
            </ListSection>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

/**
 * One of the three call actions.
 *
 * Tinted text under a tinted icon, sharing a card with the other two. Not a
 * filled slab, and not the brand green: an action is `colors.link` everywhere
 * in this app.
 */
function ContactInfoAction({
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
        contactStyles.action,
        pressed && { backgroundColor: appTheme.colors.groupedBackground }
      ]}
    >
      <Feather color={appTheme.colors.link} name={icon} size={21} />
      <Text numberOfLines={1} style={[contactStyles.actionText, { color: appTheme.colors.link }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ContactCommonGroupRow({
  contactName,
  group,
  onOpen,
  profilePhotoHeaders
}: {
  contactName: string;
  group: ChatContact;
  onOpen: () => void;
  profilePhotoHeaders?: Record<string, string>;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={`Open ${group.displayName}`}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [
        contactStyles.groupRow,
        pressed && { backgroundColor: appTheme.colors.groupedBackground }
      ]}
    >
      <ProfileAvatar
        headers={profilePhotoHeaders}
        name={group.displayName}
        size={42}
        uri={group.profilePhotoUrl}
      />
      <View style={contactStyles.groupText}>
        <Text numberOfLines={1} style={[contactStyles.groupName, { color: appTheme.colors.ink }]}>
          {group.displayName}
        </Text>
        <Text numberOfLines={1} style={[contactStyles.groupSubtitle, { color: appTheme.colors.muted }]}>
          {getCommonGroupPreview(group, contactName)}
        </Text>
      </View>
      <Feather color={appTheme.colors.muted} name="chevron-right" size={19} />
    </Pressable>
  );
}

export function formatChatListTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMessageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;

  if (startOfMessageDay === startOfToday) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  if (startOfToday - startOfMessageDay === oneDayMs) {
    return 'Yesterday';
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatCommonGroupCount(groupCount: number): string {
  const safeGroupCount = Math.max(Math.round(groupCount || 0), 0);

  return safeGroupCount === 1 ? '1 group in common' : `${safeGroupCount} groups in common`;
}

function getContactInfoPresenceText(chat: ChatItem): string {
  if (chat.isOnline) {
    return 'online';
  }

  if (chat.lastSeenAt) {
    const lastSeen = formatChatListTime(chat.lastSeenAt);

    if (lastSeen) {
      return `last seen ${lastSeen}`;
    }
  }

  return chat.roleName || 'Synzapp contact';
}

function getChatTranscriptLanguageLabel(languageCode: ChatTranscriptLanguageCode): string {
  return chatTranscriptLanguageOptions.find((option) => option.code === languageCode)?.label ||
    'English (United States)';
}

function getCommonGroupPreview(group: ChatContact, contactName: string): string {
  const memberNames = (group.members || [])
    .map((member) => member.displayName)
    .filter((name) => name && name !== contactName)
    .slice(0, 4);

  if (!memberNames.length) {
    return getGroupSubtitleFromContact(group);
  }

  return memberNames.join(', ');
}

function getGroupSubtitleFromContact(group: ChatContact): string {
  if (group.isDepartmentDefault) {
    return 'Department group';
  }

  return group.memberCount === 1 ? '1 member' : `${group.memberCount || 0} members`;
}

const contactStyles = StyleSheet.create({
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
  // Words on the left, face on the right, the same way the profile card in
  // Settings is built.
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
  // The same hairline the card uses between rows, stood on its end and kept
  // clear of the card's top and bottom edges.
  actionDivider: {
    marginVertical: 12,
    width: 1
  },
  groupRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  groupText: {
    flex: 1,
    minWidth: 0
  },
  groupName: {
    fontSize: 16,
    lineHeight: 21
  },
  groupSubtitle: {
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 2
  }
});
