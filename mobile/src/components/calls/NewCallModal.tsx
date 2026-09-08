import Feather from '@expo/vector-icons/Feather';
import type { SynzappCallMode } from '../../services/callApi';
import { CallContactRow, filterCallContacts } from '../../components/calls/ScheduleCallModal';
import { ChatContact } from '../../services/chatApi';
import { ChatSearchBar, getKeyboardDismissMode } from '../../components/chatUiPrimitives';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Starting a new call.
 *
 * Lifted out of the chat screen unchanged.
 */

export function NewCallModal({
  contacts,
  isOpen,
  onChangeSearch,
  onClose,
  onStartCall,
  profilePhotoHeaders,
  search
}: {
  contacts: ChatContact[];
  isOpen: boolean;
  onChangeSearch: (value: string) => void;
  onClose: () => void;
  onStartCall: (contact: ChatContact, mode?: SynzappCallMode) => void;
  profilePhotoHeaders?: Record<string, string>;
  search: string;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);
  const visibleContacts = filterCallContacts(contacts, search);

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
        styles.callModalScreen,
        {
          backgroundColor: appTheme.colors.screen,
          paddingTop: modalTopPadding
        }
      ]}>
        <View style={styles.callModalHeader}>
          <Pressable
            accessibilityLabel="Close new call"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.newChatHeaderIconButton, pressed && styles.pressed]}
          >
            <Feather color={appTheme.colors.ink} name="x" size={24} />
          </Pressable>
          <View style={styles.newChatCenteredTitleWrap}>
            <Text numberOfLines={1} style={[styles.callModalHeaderTitle, { color: appTheme.colors.ink }]}>New call</Text>
            <Text numberOfLines={1} style={[styles.callModalHeaderSubtitle, { color: appTheme.colors.muted }]}>{contacts.length} company contacts</Text>
          </View>
          <View style={styles.newChatHeaderSpacer} />
        </View>

        <ChatSearchBar
          onChangeText={onChangeSearch}
          placeholder="Search name or number"
          value={search}
        />

        <ScrollView
          keyboardDismissMode={getKeyboardDismissMode()}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.callModalList}
        >
          <Text style={[styles.callModalSectionLabel, { color: appTheme.colors.muted }]}>Frequently contacted</Text>
          {visibleContacts.map((contact) => (
            <CallContactRow
              contact={contact}
              key={contact.contactId}
              onPress={() => onStartCall(contact, 'voice')}
              profilePhotoHeaders={profilePhotoHeaders}
              trailing="radio"
            />
          ))}

          {!visibleContacts.length ? (
            <Text style={[styles.batchEmpty, { color: appTheme.colors.muted }]}>
              {search.trim() ? 'No company contacts found' : 'No registered company contacts yet'}
            </Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
