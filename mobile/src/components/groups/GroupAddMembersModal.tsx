import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { ChatContact } from '../../services/chatApi';
import { ChatSearchBar } from '../../components/chatUiPrimitives';
import { ProfileAvatar, normalizeSearchQuery } from '../../components/messages/MessageThread';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Adding members to a group.
 *
 * Lifted out of the chat screen unchanged.
 */

export function GroupAddMembersModal({
  contacts,
  isOpen,
  isSaving,
  onCancel,
  onConfirm,
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
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
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
  const canAdd = selectedCount > 0 && !isSaving;

  return (
    <Modal
      allowSwipeDismissal={Platform.OS === 'ios'}
      animationType="slide"
      onRequestClose={onCancel}
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
            disabled={isSaving}
            onPress={onCancel}
            style={({ pressed }) => [styles.newChatHeaderIconButton, pressed && !isSaving && styles.pressed]}
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
            accessibilityLabel="Add selected members"
            accessibilityRole="button"
            disabled={!canAdd}
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.newChatNextButton,
              pressed && canAdd && styles.pressed,
              !canAdd && styles.disabled
            ]}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.newChatNextText}>Add</Text>
            )}
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
                      disabled={isSaving}
                      onPress={() => onRemoveMember(member.contactId)}
                      style={({ pressed }) => [styles.groupMemberRemoveButton, pressed && !isSaving && styles.pressed]}
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
          <Text style={[styles.addMembersSectionTitle, { color: appTheme.colors.muted }]}>Available members</Text>
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
              {search.trim() ? 'No members found' : 'Everyone available is already in this group.'}
            </Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function ChatMemberSelectRow({
  contact,
  isSelected,
  onToggle,
  profilePhotoHeaders
}: {
  contact: ChatContact;
  isSelected: boolean;
  onToggle: () => void;
  profilePhotoHeaders?: Record<string, string>;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.newChatContactRow,
        {
          backgroundColor: appTheme.colors.screen,
          borderBottomColor: appTheme.colors.divider
        },
        pressed && styles.pressed
      ]}
    >
      <ProfileAvatar
        headers={profilePhotoHeaders}
        name={contact.displayName}
        size={48}
        uri={contact.profilePhotoUrl}
      />
      <View style={styles.chatText}>
        <Text numberOfLines={1} style={[styles.chatTitle, { color: appTheme.colors.ink }]}>{contact.displayName}</Text>
        <Text numberOfLines={1} style={[styles.chatPreview, { color: appTheme.colors.muted }]}>{contact.roleName}</Text>
      </View>
      <View style={[
        styles.memberSelectCheck,
        {
          borderColor: isSelected ? appTheme.colors.primary : appTheme.colors.muted
        },
        isSelected && styles.memberSelectCheckActive,
        isSelected && { backgroundColor: appTheme.colors.primary }
      ]}>
        {isSelected ? <Feather color="#FFFFFF" name="check" size={14} /> : null}
      </View>
    </Pressable>
  );
}

export function filterChatContacts(contacts: ChatContact[], search: string): ChatContact[] {
  const query = normalizeSearchQuery(search);

  if (!query) {
    return contacts;
  }

  return contacts.filter((contact) =>
    normalizeSearchQuery(`${contact.displayName} ${contact.roleName} ${contact.phoneMasked || ''}`).includes(query)
  );
}
