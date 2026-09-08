import Feather from '@expo/vector-icons/Feather';
import { ChatContact } from '../../services/chatApi';
import { ChatMemberSelectRow, filterChatContacts } from '../../components/groups/GroupAddMembersModal';
import { ChatSearchBar } from '../../components/chatUiPrimitives';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Choosing who joins a group call.
 *
 * Lifted out of the chat screen unchanged.
 */

export type GroupCallMode = 'select' | 'voice' | 'video';

export function GroupCallPeopleModal({
  contacts,
  isOpen,
  mode,
  onCancel,
  onConfirm,
  onSearchChange,
  onToggleMember,
  onlineCount,
  profilePhotoHeaders,
  search,
  selectedCount,
  selectedMemberIds
}: {
  contacts: ChatContact[];
  isOpen: boolean;
  mode: GroupCallMode;
  onCancel: () => void;
  onConfirm: () => void;
  onSearchChange: (value: string) => void;
  onToggleMember: (contactId: string) => void;
  onlineCount: number;
  profilePhotoHeaders?: Record<string, string>;
  search: string;
  selectedCount: number;
  selectedMemberIds: Record<string, boolean>;
}) {
  const appTheme = useAppTheme();
  const filteredContacts = filterChatContacts(contacts, search);
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);
  const actionLabel = mode === 'select' ? 'Done' : 'Call';

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
            accessibilityLabel="Close select people"
            accessibilityRole="button"
            onPress={onCancel}
            style={({ pressed }) => [styles.newChatHeaderIconButton, pressed && styles.pressed]}
          >
            <Feather color={appTheme.colors.ink} name="x" size={24} />
          </Pressable>
          <View style={styles.newChatCenteredTitleWrap}>
            <Text style={[styles.newChatHeaderTitle, { color: appTheme.colors.ink }]}>
              {getGroupCallPeopleTitle(mode)}
            </Text>
            <Text style={[styles.newChatHeaderSubtitle, { color: appTheme.colors.muted }]}>
              {selectedCount > 0 ? `${selectedCount} selected` : formatGroupOnlineCount(onlineCount)}
            </Text>
          </View>
          <Pressable
            accessibilityLabel={actionLabel}
            accessibilityRole="button"
            disabled={!selectedCount}
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.newChatNextButton,
              pressed && selectedCount > 0 && styles.pressed,
              !selectedCount && styles.disabled
            ]}
          >
            <Text style={styles.newChatNextText}>{actionLabel}</Text>
          </Pressable>
        </View>

        <ChatSearchBar
          onChangeText={onSearchChange}
          placeholder="Search people"
          value={search}
        />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.newChatContactList}
        >
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
              {search.trim() ? 'No people found' : 'No group members available'}
            </Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function formatGroupOnlineCount(onlineCount: number): string {
  return onlineCount === 1 ? '1 online' : `${Math.max(onlineCount, 0)} online`;
}

function getGroupCallPeopleTitle(mode: GroupCallMode): string {
  if (mode === 'voice') {
    return 'Voice call';
  }

  if (mode === 'video') {
    return 'Video call';
  }

  return 'Select people';
}
