import Feather from '@expo/vector-icons/Feather';
import { ChatContact } from '../../services/chatApi';
import { ChatMemberSelectRow, filterChatContacts } from '../../components/groups/GroupAddMembersModal';
import { ChatSearchBar } from '../../components/chatUiPrimitives';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Member selection.
 *
 * Lifted out of the chat screen unchanged.
 */

export function AddMembersModal({
  contacts,
  isOpen,
  onBack,
  onNext,
  onRemoveMember,
  onSearchChange,
  onToggleMember,
  profilePhotoHeaders,
  search,
  selectedCount,
  selectedMemberIds,
  selectedMembers
}: {
  contacts: ChatContact[];
  isOpen: boolean;
  onBack: () => void;
  onNext: () => void;
  onRemoveMember: (contactId: string) => void;
  onSearchChange: (value: string) => void;
  onToggleMember: (contactId: string) => void;
  profilePhotoHeaders?: Record<string, string>;
  search: string;
  selectedCount: number;
  selectedMemberIds: Record<string, boolean>;
  selectedMembers: ChatContact[];
}) {
  const appTheme = useAppTheme();
  const filteredContacts = filterChatContacts(contacts, search);
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);

  return (
    <Modal
      allowSwipeDismissal={Platform.OS === 'ios'}
      animationType="slide"
      onRequestClose={onBack}
      presentationStyle={getNativeFullHeightModalPresentationStyle()}
      transparent={false}
      visible={isOpen}
    >
      <View style={[
        styles.newChatModalScreen,
        {
          backgroundColor: appTheme.colors.screen,
          paddingTop: modalTopPadding
        }
      ]}>
        <View style={styles.newChatHeader}>
          <Pressable
            accessibilityLabel="Close add members"
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [styles.newChatHeaderIconButton, pressed && styles.pressed]}
          >
            <Feather color={appTheme.colors.ink} name="x" size={24} />
          </Pressable>
          <View style={styles.newChatCenteredTitleWrap}>
            <Text style={[styles.newChatHeaderTitle, { color: appTheme.colors.ink }]}>Add members</Text>
            {selectedCount > 0 ? (
              <Text style={[styles.newChatHeaderSubtitle, { color: appTheme.colors.muted }]}>{selectedCount} selected</Text>
            ) : null}
          </View>
          <Pressable
            accessibilityLabel="Next"
            accessibilityRole="button"
            disabled={!selectedCount}
            onPress={onNext}
            style={({ pressed }) => [
              styles.newChatNextButton,
              pressed && selectedCount > 0 && styles.pressed,
              !selectedCount && styles.disabled
            ]}
          >
            <Text style={styles.newChatNextText}>Next</Text>
          </Pressable>
        </View>

        <ChatSearchBar
          onChangeText={onSearchChange}
          placeholder="Search name or number"
          value={search}
        />

        {selectedMembers.length ? (
          <View style={[
            styles.addMembersSelectedPanel,
            { backgroundColor: appTheme.colors.surface }
          ]}>
            <ScrollView
              contentContainerStyle={styles.addMembersSelectedContent}
              horizontal
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator={false}
            >
              {selectedMembers.map((member) => (
                <View key={member.contactId} style={styles.addMembersSelectedChip}>
                  <View style={styles.groupMemberAvatarWrap}>
                    <ProfileAvatar
                      headers={profilePhotoHeaders}
                      name={member.displayName}
                      size={48}
                      uri={member.profilePhotoUrl}
                    />
                    <Pressable
                      accessibilityLabel={`Remove ${member.displayName}`}
                      accessibilityRole="button"
                      onPress={() => onRemoveMember(member.contactId)}
                      style={({ pressed }) => [styles.groupMemberRemoveButton, pressed && styles.pressed]}
                    >
                      <Feather color="#FFFFFF" name="x" size={13} />
                    </Pressable>
                  </View>
                  <Text numberOfLines={2} style={[styles.addMembersSelectedName, { color: appTheme.colors.ink }]}>{member.displayName}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.newChatContactList}
        >
          <Text style={[styles.addMembersSectionTitle, { color: appTheme.colors.muted }]}>Frequently contacted</Text>
          {filteredContacts.map((contact) => (
            <ChatMemberSelectRow
              contact={contact}
              isSelected={Boolean(selectedMemberIds[contact.contactId])}
              key={contact.contactId}
              onToggle={() => onToggleMember(contact.contactId)}
              profilePhotoHeaders={profilePhotoHeaders}
            />
          ))}

          {!filteredContacts.length ? (
            <Text style={[styles.batchEmpty, { color: appTheme.colors.muted }]}>
              {search.trim() ? 'No members found' : 'No organization members yet'}
            </Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
