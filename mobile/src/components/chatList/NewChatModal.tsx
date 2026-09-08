import Feather from '@expo/vector-icons/Feather';
import { ChatContact } from '../../services/chatApi';
import { ChatSearchBar } from '../../components/chatUiPrimitives';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { filterChatContacts } from '../../components/groups/GroupAddMembersModal';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Starting a new chat.
 *
 * Lifted out of the chat screen unchanged.
 */

export function NewChatModal({
  contacts,
  isOpen,
  onCancel,
  onOpenAddMembers,
  onOpenContact,
  onSearchChange,
  profilePhotoHeaders,
  search
}: {
  contacts: ChatContact[];
  isOpen: boolean;
  onCancel: () => void;
  onOpenAddMembers: () => void;
  onOpenContact: (contact: ChatContact) => void;
  onSearchChange: (value: string) => void;
  profilePhotoHeaders?: Record<string, string>;
  search: string;
}) {
  const appTheme = useAppTheme();
  const filteredContacts = filterChatContacts(contacts, search);
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);

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
            accessibilityLabel="Close new chat"
            accessibilityRole="button"
            onPress={onCancel}
            style={({ pressed }) => [styles.newChatHeaderIconButton, pressed && styles.pressed]}
          >
            <Feather color={appTheme.colors.ink} name="x" size={24} />
          </Pressable>
          <Text style={[styles.newChatHeaderTitle, { color: appTheme.colors.ink }]}>New Chat</Text>
          <View style={styles.newChatHeaderSpacer} />
        </View>

        <ChatSearchBar
          onChangeText={onSearchChange}
          placeholder="Search name"
          value={search}
        />

        <Pressable
          accessibilityLabel="Create new group"
          accessibilityRole="button"
          onPress={onOpenAddMembers}
          style={({ pressed }) => [
            styles.newGroupEntry,
            { borderBottomColor: appTheme.colors.divider },
            pressed && styles.pressed
          ]}
        >
          <View style={[styles.newGroupIcon, { backgroundColor: appTheme.colors.primary }]}>
            <Feather color="#FFFFFF" name="users" size={20} />
          </View>
          <Text style={[styles.newGroupText, { color: appTheme.colors.ink }]}>New Group</Text>
        </Pressable>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.newChatContactList}
        >
          {filteredContacts.map((contact) => (
            <ChatContactPickRow
              contact={contact}
              key={contact.contactId}
              onPress={() => onOpenContact(contact)}
              profilePhotoHeaders={profilePhotoHeaders}
            />
          ))}

          {!filteredContacts.length ? (
            <Text style={[styles.batchEmpty, { color: appTheme.colors.muted }]}>
              {search.trim() ? 'No contacts found' : 'No organization contacts yet'}
            </Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function ChatContactPickRow({
  contact,
  onPress,
  profilePhotoHeaders
}: {
  contact: ChatContact;
  onPress: () => void;
  profilePhotoHeaders?: Record<string, string>;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
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
    </Pressable>
  );
}
