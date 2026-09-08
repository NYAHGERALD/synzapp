import Feather from '@expo/vector-icons/Feather';
import React, { useMemo } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { ChatContact, ChatGroupMember, ChatNotificationSettings, ChatTrashSegment } from '../../services/chatApi';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Group information and membership editing.
 *
 * Lifted out of the chat screen unchanged.
 */

export interface ChatItem {
  chatType: 'DIRECT' | 'GROUP';
  clearedAt?: string | null;
  contactId: string;
  conversationId: string;
  hasActiveDevice: boolean;
  id: string;
  initials: string;
  isArchived?: boolean;
  isDepartmentDefault?: boolean;
  isFavorite?: boolean;
  isPinned?: boolean;
  isSpam?: boolean;
  isOnline: boolean;
  lastMessageAt: string | null;
  lastSeenAt: string | null;
  memberCount?: number;
  members?: ChatGroupMember[];
  memberPolicy?: 'DEPARTMENT_PLUS_EXPLICIT' | 'EXPLICIT';
  phoneMasked?: string | null;
  profilePhotoCacheKey?: string | null;
  profilePhotoUrl?: string | null;
  preview: string;
  role?: ChatContact['role'];
  roleName?: string;
  spammedAt?: string | null;
  status?: string;
  title: string;
  trashSegments?: ChatTrashSegment[];
  unreadCount: number;
}

export function GroupInfoModal({
  chat,
  canChangePhoto,
  companyName,
  currentUid,
  directContacts,
  groupCount,
  isOpen,
  isUpdatingPhoto,
  notificationSettings,
  onChangePhoto,
  onClose,
  onExitGroup,
  onOpenAddMembers,
  onOpenGroupSwitcher,
  onOpenMembers,
  onOpenNotifications,
  onOpenSearchMessages,
  onOpenStarred,
  onStartVideoCall,
  onStartVoiceCall,
  onlineCount,
  profilePhotoHeaders,
  starredCount
}: {
  chat: ChatItem | null;
  canChangePhoto: boolean;
  companyName: string;
  currentUid: string;
  directContacts: ChatContact[];
  groupCount: number;
  isOpen: boolean;
  isUpdatingPhoto: boolean;
  notificationSettings: ChatNotificationSettings | null;
  onChangePhoto: () => void;
  onClose: () => void;
  onExitGroup: () => void;
  onOpenAddMembers: () => void;
  onOpenGroupSwitcher: () => void;
  onOpenMembers: () => void;
  onOpenNotifications: () => void;
  onOpenSearchMessages: () => void;
  onOpenStarred: () => void;
  onStartVideoCall: () => void;
  onStartVoiceCall: () => void;
  onlineCount: number;
  profilePhotoHeaders?: Record<string, string>;
  starredCount: number;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);
  const directContactById = useMemo(() => new Map(
    directContacts.map((contact) => [contact.contactId, contact])
  ), [directContacts]);

  if (!chat || chat.chatType !== 'GROUP') {
    return null;
  }

  const members = chat.members || [];
  const visibleMembers = members.slice(0, 9);
  const memberCount = chat.memberCount ?? members.length;
  const memberCountLabel = formatGroupMemberCount(memberCount);
  const groupDescription = getGroupInfoDescription(chat);
  const showExitGroup = canExitGroupChat(chat);

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
        <View style={styles.groupInfoTopBar}>
          <Pressable
            accessibilityLabel="Close group info"
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
          <View style={styles.groupInfoTopButtonSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.groupInfoContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.groupInfoHero}>
            {canChangePhoto ? (
              <Pressable
                accessibilityLabel="Change group photo"
                accessibilityRole="button"
                disabled={isUpdatingPhoto}
                onPress={onChangePhoto}
                style={({ pressed }) => [
                  styles.groupInfoAvatarButton,
                  pressed && styles.pressed
                ]}
              >
                <ProfileAvatar
                  headers={profilePhotoHeaders}
                  name={chat.title}
                  size={92}
                  uri={chat.profilePhotoUrl}
                />
                <View style={[
                  styles.groupInfoAvatarBadge,
                  { backgroundColor: appTheme.colors.primary }
                ]}>
                  {isUpdatingPhoto ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Feather color="#FFFFFF" name="camera" size={16} />
                  )}
                </View>
              </Pressable>
            ) : (
              <ProfileAvatar
                headers={profilePhotoHeaders}
                name={chat.title}
                size={92}
                uri={chat.profilePhotoUrl}
              />
            )}
            <Text numberOfLines={3} style={[styles.groupInfoTitle, { color: appTheme.colors.ink }]}>{chat.title}</Text>
            <Text numberOfLines={1} style={[styles.groupInfoCompany, { color: appTheme.colors.muted }]}>
              Group in "{companyName}"
            </Text>
            <Text style={[styles.groupInfoMemberCount, { color: appTheme.colors.primary }]}>{memberCountLabel}</Text>
            <Text numberOfLines={2} style={[styles.groupInfoDescription, { color: appTheme.colors.muted }]}>{groupDescription}</Text>
          </View>

          <View style={styles.groupInfoActionGrid}>
            <GroupInfoActionButton icon="phone" label="Audio" onPress={onStartVoiceCall} />
            <GroupInfoActionButton icon="video" label="Video" onPress={onStartVideoCall} />
            <GroupInfoActionButton icon="user-plus" label="Add" onPress={onOpenAddMembers} />
            <GroupInfoActionButton icon="search" label="Search" onPress={onOpenSearchMessages} />
          </View>

          <View style={[styles.groupInfoSection, { backgroundColor: appTheme.colors.surfaceElevated }]}>
            <GroupInfoSettingRow
              icon="users"
              label={companyName}
              onPress={onOpenGroupSwitcher}
              value={groupCount > 0 ? `Community - ${groupCount} ${groupCount === 1 ? 'group' : 'groups'}` : 'Community'}
            />
          </View>

          <View style={[styles.groupInfoSection, { backgroundColor: appTheme.colors.surfaceElevated }]}>
            <GroupInfoSettingRow
              icon="star"
              label="Starred"
              onPress={onOpenStarred}
              value={formatStarredMessageCount(starredCount)}
            />
            <GroupInfoSettingRow
              icon="bell"
              label="Notifications"
              onPress={onOpenNotifications}
              value={getChatNotificationSummary(notificationSettings)}
            />
          </View>

          <View style={[styles.groupInfoSection, { backgroundColor: appTheme.colors.surfaceElevated }]}>
            <View style={[
              styles.groupInfoMembersHeader,
              { borderBottomColor: appTheme.colors.divider }
            ]}>
              <Text style={[styles.groupInfoMembersTitle, { color: appTheme.colors.ink }]}>{memberCountLabel}</Text>
              <Pressable
                accessibilityLabel="Search members"
                accessibilityRole="button"
                onPress={onOpenMembers}
                style={({ pressed }) => [styles.groupInfoMemberSearchButton, pressed && styles.pressed]}
              >
                <Feather color={appTheme.colors.ink} name="search" size={18} />
              </Pressable>
            </View>

            {/* Not offered on a department's group. Its members are the
                department, decided when somebody is invited and given a role
                there, so there is nobody to add by hand. The server refuses it
                either way; a button that always fails is worse than none. */}
            {canAddMembersToGroup(chat) ? (
              <GroupInfoSettingRow
                icon="plus"
                label="Add members"
                onPress={onOpenAddMembers}
              />
            ) : null}

            {visibleMembers.map((member) => (
              <GroupInfoMemberRow
                directContact={directContactById.get(member.uid)}
                isCurrentUser={member.uid === currentUid}
                key={member.uid || member.displayName}
                member={member}
                profilePhotoHeaders={profilePhotoHeaders}
              />
            ))}

            {members.length > visibleMembers.length ? (
              <GroupInfoSettingRow
                icon="chevron-down"
                label="See all"
                onPress={onOpenMembers}
              />
            ) : null}
          </View>

          {showExitGroup ? (
            <View style={[styles.groupInfoSection, { backgroundColor: appTheme.colors.surfaceElevated }]}>
              <Pressable
                accessibilityLabel="Exit group"
                accessibilityRole="button"
                onPress={onExitGroup}
                style={({ pressed }) => [
                  styles.groupInfoExitRow,
                  { backgroundColor: appTheme.colors.surfaceElevated },
                  pressed && styles.pressed
                ]}
              >
                <Feather color={appTheme.colors.destructive} name="log-out" size={20} />
                <Text style={[styles.groupInfoExitText, { color: appTheme.colors.destructive }]}>Exit group</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function GroupInfoActionButton({
  icon,
  label,
  onPress
}: {
  icon: keyof typeof Feather.glyphMap;
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
        styles.groupInfoActionButton,
        { backgroundColor: appTheme.colors.surfaceElevated },
        pressed && styles.pressed
      ]}
    >
      <Feather color={appTheme.colors.primary} name={icon} size={22} />
      <Text numberOfLines={1} style={[styles.groupInfoActionText, { color: appTheme.colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

export function GroupInfoSettingRow({
  icon,
  label,
  onPress,
  value
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  value?: string;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.groupInfoSettingRow,
        {
          backgroundColor: appTheme.colors.surfaceElevated,
          borderBottomColor: appTheme.colors.divider
        },
        pressed && styles.pressed
      ]}
    >
      <View style={[styles.groupInfoSettingIcon, { backgroundColor: appTheme.colors.primarySoft }]}>
        <Feather color={appTheme.colors.primary} name={icon} size={19} />
      </View>
      <View style={styles.chatText}>
        <Text numberOfLines={1} style={[styles.groupInfoSettingLabel, { color: appTheme.colors.ink }]}>{label}</Text>
        {value ? (
          <Text numberOfLines={1} style={[styles.groupInfoSettingValue, { color: appTheme.colors.muted }]}>{value}</Text>
        ) : null}
      </View>
      <Feather color={appTheme.colors.muted} name="chevron-right" size={19} />
    </Pressable>
  );
}

export function GroupInfoMemberRow({
  directContact,
  isCurrentUser,
  member,
  profilePhotoHeaders
}: {
  directContact?: ChatContact;
  isCurrentUser: boolean;
  member: ChatGroupMember;
  profilePhotoHeaders?: Record<string, string>;
}) {
  const appTheme = useAppTheme();
  const subtitle = getGroupInfoMemberSubtitle(member, directContact, isCurrentUser);
  const badge = getGroupInfoMemberBadge(member);

  return (
    <View style={[
      styles.groupInfoMemberRow,
      {
        backgroundColor: appTheme.colors.surfaceElevated,
        borderBottomColor: appTheme.colors.divider
      }
    ]}>
      <ProfileAvatar
        headers={profilePhotoHeaders}
        name={member.displayName}
        size={44}
        uri={member.profilePhotoUrl || directContact?.profilePhotoUrl || null}
      />
      <View style={styles.chatText}>
        <Text numberOfLines={1} style={[styles.groupInfoMemberName, { color: appTheme.colors.ink }]}>
          {isCurrentUser ? 'You' : member.displayName}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[styles.groupInfoMemberSubtitle, { color: appTheme.colors.muted }]}>{subtitle}</Text>
        ) : null}
      </View>
      {badge ? (
        <Text numberOfLines={1} style={[styles.groupInfoMemberBadge, { color: appTheme.colors.muted }]}>{badge}</Text>
      ) : null}
      <Feather color={appTheme.colors.muted} name="chevron-right" size={18} />
    </View>
  );
}

export function formatGroupMemberCount(memberCount: number): string {
  const safeMemberCount = Math.max(Math.round(memberCount || 0), 0);

  return safeMemberCount === 1 ? '1 member' : `${safeMemberCount} members`;
}

function formatStarredMessageCount(starredCount: number): string {
  const safeStarredCount = Math.max(Math.round(starredCount || 0), 0);

  return safeStarredCount === 0
    ? 'None'
    : `${safeStarredCount} ${safeStarredCount === 1 ? 'message' : 'messages'}`;
}

export function getChatNotificationSummary(settings: ChatNotificationSettings | null): string {
  if (!settings || settings.muteMode === 'off') {
    return 'All';
  }

  return `Muted ${getChatNotificationMuteLabel(settings).toLowerCase()}`;
}

export function getChatNotificationMuteLabel(settings: ChatNotificationSettings): string {
  if (settings.muteMode === 'always') {
    return 'Always';
  }

  if (settings.muteMode === '8h' && settings.mutedUntil) {
    return '8 hours';
  }

  if (settings.muteMode === '1w' && settings.mutedUntil) {
    return '1 week';
  }

  return 'No';
}

function getGroupInfoDescription(chat: ChatItem): string {
  if (chat.isDepartmentDefault) {
    return chat.title;
  }

  if (chat.memberPolicy === 'DEPARTMENT_PLUS_EXPLICIT') {
    return 'Department group';
  }

  return 'Company group';
}

/**
 * Whether people can be added to this group by hand.
 *
 * A department's group is not one of them: membership comes from the department
 * roster, and anybody added directly is somebody that roster does not know
 * about, sitting in a conversation scoped to a department they are not in.
 */
export function canAddMembersToGroup(chat: ChatItem): boolean {
  return chat.chatType === 'GROUP' &&
    chat.isDepartmentDefault !== true &&
    chat.memberPolicy !== 'DEPARTMENT_PLUS_EXPLICIT';
}

export function canExitGroupChat(chat: ChatItem): boolean {
  return chat.chatType === 'GROUP' &&
    chat.isDepartmentDefault !== true &&
    chat.memberPolicy !== 'DEPARTMENT_PLUS_EXPLICIT';
}

function getGroupInfoMemberSubtitle(
  member: ChatGroupMember,
  directContact: ChatContact | undefined,
  isCurrentUser: boolean
): string {
  if (isCurrentUser) {
    return member.roleName || 'Member';
  }

  if (directContact?.isOnline) {
    return 'online';
  }

  return member.roleName || 'Member';
}

function getGroupInfoMemberBadge(member: ChatGroupMember): string {
  if (member.role === 'ORG_ADMIN' || member.role === 'DEPT_ADMIN') {
    return 'Admin';
  }

  return '';
}
