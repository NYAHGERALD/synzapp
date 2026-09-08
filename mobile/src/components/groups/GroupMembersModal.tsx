import Feather from '@expo/vector-icons/Feather';
import React, { useMemo } from 'react';
import { ChatContact, ChatGroupMember } from '../../services/chatApi';
import { ChatItem, GroupInfoMemberRow, GroupInfoSettingRow, formatGroupMemberCount } from '../../components/groups/GroupInfoModal';
import { ChatSearchBar, getKeyboardDismissMode } from '../../components/chatUiPrimitives';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { normalizeSearchQuery } from '../../components/messages/MessageThread';
import { styles } from '../../screens/adminChatStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The group member list.
 *
 * Lifted out of the chat screen unchanged.
 */

export function GroupMembersModal({
  chat,
  currentUid,
  directContacts,
  isOpen,
  onAddMembers,
  onChangeSearch,
  onClose,
  profilePhotoHeaders,
  search
}: {
  chat: ChatItem | null;
  currentUid: string;
  directContacts: ChatContact[];
  isOpen: boolean;
  onAddMembers: () => void;
  onChangeSearch: (value: string) => void;
  onClose: () => void;
  profilePhotoHeaders?: Record<string, string>;
  search: string;
}) {
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);
  const directContactById = useMemo(() => new Map(
    directContacts.map((contact) => [contact.contactId, contact])
  ), [directContacts]);

  if (!chat || chat.chatType !== 'GROUP') {
    return null;
  }

  const members = chat.members || [];
  const visibleMembers = filterGroupInfoMembers(members, directContactById, currentUid, search);
  const memberCount = chat.memberCount ?? members.length;

  return (
    <Modal
      allowSwipeDismissal={Platform.OS === 'ios'}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle={getNativeFullHeightModalPresentationStyle()}
      transparent={false}
      visible={isOpen}
    >
      <View style={[styles.newChatModalScreen, { paddingTop: modalTopPadding }]}>
        <View style={styles.newChatHeader}>
          <Pressable
            accessibilityLabel="Close members"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.newChatHeaderIconButton, pressed && styles.pressed]}
          >
            <Feather color={colors.ink} name="x" size={24} />
          </Pressable>
          <View style={styles.newChatCenteredTitleWrap}>
            <Text numberOfLines={1} style={styles.newChatHeaderTitle}>Members</Text>
            <Text numberOfLines={1} style={styles.newChatHeaderSubtitle}>{formatGroupMemberCount(memberCount)}</Text>
          </View>
          <View style={styles.newChatHeaderSpacer} />
        </View>

        <ChatSearchBar
          onChangeText={onChangeSearch}
          placeholder="Search members"
          value={search}
        />

        <ScrollView
          keyboardDismissMode={getKeyboardDismissMode()}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.newChatContactList}
        >
          <View style={styles.groupInfoSection}>
            <GroupInfoSettingRow
              icon="plus"
              label="Add members"
              onPress={onAddMembers}
            />

            {visibleMembers.map((member) => (
              <GroupInfoMemberRow
                directContact={directContactById.get(member.uid)}
                isCurrentUser={member.uid === currentUid}
                key={member.uid || member.displayName}
                member={member}
                profilePhotoHeaders={profilePhotoHeaders}
              />
            ))}
          </View>

          {!visibleMembers.length ? (
            <Text style={styles.batchEmpty}>{search.trim() ? 'No members found' : 'No members yet'}</Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function filterGroupInfoMembers(
  members: ChatGroupMember[],
  directContactById: Map<string, ChatContact>,
  currentUid: string,
  search: string
): ChatGroupMember[] {
  const query = normalizeSearchQuery(search);

  if (!query) {
    return members;
  }

  return members.filter((member) => {
    const directContact = directContactById.get(member.uid);
    const displayName = member.uid === currentUid ? 'You' : member.displayName;

    return normalizeSearchQuery([
      displayName,
      member.roleName,
      directContact?.phoneMasked || ''
    ].join(' ')).includes(query);
  });
}
