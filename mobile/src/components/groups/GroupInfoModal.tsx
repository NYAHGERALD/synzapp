import Feather from '@expo/vector-icons/Feather';
import React, { useMemo } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChatContact, ChatGroupMember, ChatNotificationSettings, ChatTrashSegment } from '../../services/chatApi';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { ANDROID_MAX_NAVIGATION_INSET } from '../../services/androidNavigationInset';
import { CircleIconButton, CircleIconSpacer } from '../../components/ui/CircleIconButton';
import { ListNavRow, ListSection } from '../../components/ui/GroupedList';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { resolveScreenBottomInset } from '../../services/rootSafeArea';
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
  const screenBottomInset = resolveScreenBottomInset({
    androidNavigationInset: Math.min(insets.bottom, ANDROID_MAX_NAVIGATION_INSET),
    platform: Platform.OS
  });
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
        groupInfoStyles.screen,
        {
          backgroundColor: appTheme.colors.groupedBackground,
          paddingTop: modalTopPadding
        }
      ]}>
        <View style={groupInfoStyles.header}>
          <CircleIconButton action="back" label="Close group info" onPress={onClose} />
          <Text numberOfLines={1} style={[groupInfoStyles.headerTitle, { color: appTheme.colors.ink }]}>
            Group info
          </Text>
          <CircleIconSpacer />
        </View>

        <ScrollView
          contentContainerStyle={[
            groupInfoStyles.content,
            { paddingBottom: Math.max(28, screenBottomInset + 24) }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Words on the left, the picture on the right — the same identity
              card as a person's, because a group is identified the same way. */}
          <ListSection>
            <View style={groupInfoStyles.identityRow}>
              <View style={groupInfoStyles.identityText}>
                <Text style={[groupInfoStyles.identityName, { color: appTheme.colors.ink }]}>
                  {chat.title}
                </Text>
                <Text style={[groupInfoStyles.identityMeta, { color: appTheme.colors.muted }]}>
                  {`Group in ${companyName} · ${memberCountLabel}`}
                </Text>
                {groupDescription ? (
                  <Text style={[groupInfoStyles.identityMeta, { color: appTheme.colors.muted }]}>
                    {groupDescription}
                  </Text>
                ) : null}
              </View>

              {canChangePhoto ? (
                <Pressable
                  accessibilityLabel="Change group photo"
                  accessibilityRole="button"
                  disabled={isUpdatingPhoto}
                  onPress={onChangePhoto}
                  style={({ pressed }) => [
                    groupInfoStyles.avatarButton,
                    pressed && styles.pressed
                  ]}
                >
                  <ProfileAvatar
                    headers={profilePhotoHeaders}
                    name={chat.title}
                    size={72}
                    uri={chat.profilePhotoUrl}
                  />
                  <View style={[
                    groupInfoStyles.avatarBadge,
                    {
                      backgroundColor: appTheme.colors.primary,
                      borderColor: appTheme.colors.groupedCard
                    }
                  ]}>
                    {isUpdatingPhoto ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Feather color="#FFFFFF" name="camera" size={13} />
                    )}
                  </View>
                </Pressable>
              ) : (
                <ProfileAvatar
                  headers={profilePhotoHeaders}
                  name={chat.title}
                  size={72}
                  uri={chat.profilePhotoUrl}
                />
              )}
            </View>
          </ListSection>

          <ListSection>
            <View style={groupInfoStyles.actionRow}>
              <GroupInfoAction icon="phone" label="Audio" onPress={onStartVoiceCall} />
              <View style={[groupInfoStyles.actionDivider, { backgroundColor: appTheme.colors.separator }]} />
              <GroupInfoAction icon="video" label="Video" onPress={onStartVideoCall} />
              <View style={[groupInfoStyles.actionDivider, { backgroundColor: appTheme.colors.separator }]} />
              <GroupInfoAction icon="user-plus" label="Add" onPress={onOpenAddMembers} />
              <View style={[groupInfoStyles.actionDivider, { backgroundColor: appTheme.colors.separator }]} />
              <GroupInfoAction icon="search" label="Search" onPress={onOpenSearchMessages} />
            </View>
          </ListSection>

          <ListSection>
            <ListNavRow
              icon="users"
              onPress={onOpenGroupSwitcher}
              subtitle={groupCount > 0
                ? `Community · ${groupCount} ${groupCount === 1 ? 'group' : 'groups'}`
                : 'Community'}
              title={companyName}
            />
            <ListNavRow
              icon="star"
              onPress={onOpenStarred}
              subtitle={formatStarredMessageCount(starredCount)}
              title="Starred"
            />
            <ListNavRow
              icon="bell"
              onPress={onOpenNotifications}
              subtitle={getChatNotificationSummary(notificationSettings)}
              title="Notifications"
            />
          </ListSection>

          <ListSection title={memberCountLabel}>
            {/* Not offered on a department's group. Its members are the
                department, decided when somebody is invited and given a role
                there, so there is nobody to add by hand. The server refuses it
                either way; a button that always fails is worse than none. */}
            {canAddMembersToGroup(chat) ? (
              <ListNavRow icon="plus" onPress={onOpenAddMembers} title="Add members" />
            ) : null}

            {visibleMembers.map((member) => (
              <GroupInfoMemberRow
                directContact={directContactById.get(member.uid)}
                insideCard
                isCurrentUser={member.uid === currentUid}
                key={member.uid || member.displayName}
                member={member}
                profilePhotoHeaders={profilePhotoHeaders}
              />
            ))}

            {/* One row, not two. The members screen has its own search, so a
                separate search control here would open the same place. */}
            {members.length > visibleMembers.length ? (
              <ListNavRow icon="search" onPress={onOpenMembers} title="See all members" />
            ) : null}
          </ListSection>

          {showExitGroup ? (
            <ListSection>
              <Pressable
                accessibilityLabel="Exit group"
                accessibilityRole="button"
                onPress={onExitGroup}
                style={({ pressed }) => [
                  groupInfoStyles.exitRow,
                  pressed && { backgroundColor: appTheme.colors.groupedBackground }
                ]}
              >
                <Feather color={appTheme.colors.destructive} name="log-out" size={18} />
                <Text style={[groupInfoStyles.exitText, { color: appTheme.colors.destructive }]}>
                  Exit group
                </Text>
              </Pressable>
            </ListSection>
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
  insideCard = false,
  isCurrentUser,
  member,
  profilePhotoHeaders
}: {
  directContact?: ChatContact;
  /**
   * Draws the row for a rounded card: no colour and no rule of its own, since
   * the card supplies both. Opt in, so the members modal keeps its own look.
   */
  insideCard?: boolean;
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
      insideCard
        ? groupInfoStyles.cardRow
        : {
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

/** One of the four things you can do with a group. */
function GroupInfoAction({
  icon,
  label,
  onPress
}: {
  icon: 'phone' | 'search' | 'user-plus' | 'video';
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
        groupInfoStyles.action,
        pressed && { backgroundColor: appTheme.colors.groupedBackground }
      ]}
    >
      <Feather color={appTheme.colors.link} name={icon} size={21} />
      <Text numberOfLines={1} style={[groupInfoStyles.actionText, { color: appTheme.colors.link }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const groupInfoStyles = StyleSheet.create({
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
  avatarButton: {
    position: 'relative'
  },
  avatarBadge: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 2,
    bottom: -2,
    height: 28,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    width: 28
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
    paddingHorizontal: 4,
    paddingVertical: 14
  },
  actionText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center'
  },
  actionDivider: {
    marginVertical: 12,
    width: 1
  },
  // The card draws the colour and the rules; the row only holds its padding.
  cardRow: {
    borderBottomWidth: 0,
    paddingHorizontal: 16
  },
  exitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 13
  },
  exitText: {
    fontSize: 16,
    lineHeight: 21
  }
});
