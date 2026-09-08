import Feather from '@expo/vector-icons/Feather';
import { ChatContact, ChatNotificationSettings, ChatTranscriptLanguageCode, ChatTranscriptLanguageSetting, DirectChatContactDetails } from '../../services/chatApi';
import { ChatItem, GroupInfoActionButton, GroupInfoSettingRow, getChatNotificationSummary } from '../../components/groups/GroupInfoModal';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Contact details and per-contact settings.
 *
 * Lifted out of the chat screen unchanged.
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
        styles.groupInfoScreen,
        {
          backgroundColor: appTheme.colors.screen,
          paddingTop: modalTopPadding
        }
      ]}>
        <View style={styles.contactInfoTopBar}>
          <Pressable
            accessibilityLabel="Close contact info"
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
          <Text numberOfLines={1} style={[styles.contactInfoHeaderTitle, { color: appTheme.colors.ink }]}>Contact info</Text>
          <View style={styles.groupInfoTopButtonSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.groupInfoContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contactInfoHero}>
            <ProfileAvatar
              headers={profilePhotoHeaders}
              name={chat.title}
              size={104}
              uri={chat.profilePhotoUrl}
            />
            <Text numberOfLines={2} style={[styles.contactInfoName, { color: appTheme.colors.ink }]}>{chat.title}</Text>
            {phoneNumber ? (
              <Text numberOfLines={1} style={[styles.contactInfoMeta, { color: appTheme.colors.muted }]}>{phoneNumber}</Text>
            ) : null}
            <Text numberOfLines={1} style={[styles.contactInfoPresence, { color: appTheme.colors.muted }]}>
              {getContactInfoPresenceText(chat)}
            </Text>
          </View>

          <View style={styles.contactInfoActionGrid}>
            <GroupInfoActionButton icon="phone" label="Audio" onPress={onStartVoiceCall} />
            <GroupInfoActionButton icon="video" label="Video" onPress={onStartVideoCall} />
            <GroupInfoActionButton icon="search" label="Search" onPress={onOpenSearch} />
          </View>

          <View style={[styles.groupInfoSection, { backgroundColor: appTheme.colors.surfaceElevated }]}>
            <GroupInfoSettingRow
              icon="bell"
              label="Notifications"
              onPress={onOpenNotifications}
              value={getChatNotificationSummary(notificationSettings)}
            />
          </View>

          <View style={[styles.groupInfoSection, { backgroundColor: appTheme.colors.surfaceElevated }]}>
            <GroupInfoSettingRow
              icon="file-text"
              label="Transcript language"
              onPress={onOpenTranscriptLanguage}
              value={getChatTranscriptLanguageLabel(transcriptLanguage?.languageCode || 'en-US')}
            />
          </View>

          <View style={[styles.groupInfoSection, { backgroundColor: appTheme.colors.surfaceElevated }]}>
            <GroupInfoSettingRow
              icon="user"
              label="Contact details"
              onPress={onOpenContactDetails}
            />
          </View>

          <View style={[styles.groupInfoSection, { backgroundColor: appTheme.colors.surfaceElevated }]}>
            <View style={[
              styles.contactInfoCommonHeader,
              { borderBottomColor: appTheme.colors.divider }
            ]}>
              <Text style={[styles.groupInfoMembersTitle, { color: appTheme.colors.ink }]}>
                {formatCommonGroupCount(commonGroups.length)}
              </Text>
            </View>
            <GroupInfoSettingRow
              icon="plus"
              label={`Create group with ${chat.title}`}
              onPress={onCreateGroup}
            />
            <GroupInfoSettingRow
              icon="users"
              label="Add to group"
              onPress={onAddToGroup}
            />
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
              <GroupInfoSettingRow
                icon="chevron-down"
                label="See all"
                onPress={onOpenSearch}
              />
            ) : null}
          </View>
        </ScrollView>
      </View>
    </Modal>
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
        styles.contactInfoCommonGroupRow,
        {
          backgroundColor: appTheme.colors.surfaceElevated,
          borderBottomColor: appTheme.colors.divider
        },
        pressed && styles.pressed
      ]}
    >
      <ProfileAvatar
        headers={profilePhotoHeaders}
        name={group.displayName}
        size={42}
        uri={group.profilePhotoUrl}
      />
      <View style={styles.chatText}>
        <Text numberOfLines={1} style={[styles.groupInfoMemberName, { color: appTheme.colors.ink }]}>{group.displayName}</Text>
        <Text numberOfLines={1} style={[styles.contactInfoCommonGroupSubtitle, { color: appTheme.colors.muted }]}>
          {getCommonGroupPreview(group, contactName)}
        </Text>
      </View>
      <Feather color={appTheme.colors.muted} name="chevron-right" size={18} />
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
