import Feather from '@expo/vector-icons/Feather';
import { CallContactRow, filterCallContacts } from '../../components/calls/ScheduleCallModal';
import { ChatContact } from '../../services/chatApi';
import { ChatSearchBar, getKeyboardDismissMode } from '../../components/chatUiPrimitives';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Call favourites.
 *
 * Lifted out of the chat screen unchanged.
 */

export function CallFavoritesModal({
  contacts,
  favoriteContactIds,
  isOpen,
  onChangeSearch,
  onClose,
  onToggleFavorite,
  profilePhotoHeaders,
  search
}: {
  contacts: ChatContact[];
  favoriteContactIds: string[];
  isOpen: boolean;
  onChangeSearch: (value: string) => void;
  onClose: () => void;
  onToggleFavorite: (contactId: string) => void;
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
            accessibilityLabel="Close favorites"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.newChatHeaderIconButton, pressed && styles.pressed]}
          >
            <Feather color={appTheme.colors.ink} name="x" size={24} />
          </Pressable>
          <View style={styles.newChatCenteredTitleWrap}>
            <Text numberOfLines={1} style={[styles.callModalHeaderTitle, { color: appTheme.colors.ink }]}>Add favorites</Text>
            <Text numberOfLines={1} style={[styles.callModalHeaderSubtitle, { color: appTheme.colors.muted }]}>{favoriteContactIds.length} selected</Text>
          </View>
          <Pressable
            accessibilityLabel="Done"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.callModalDoneButton,
              { backgroundColor: favoriteContactIds.length ? appTheme.colors.primary : appTheme.colors.surface },
              pressed && styles.pressed
            ]}
          >
            <Feather color={favoriteContactIds.length ? '#FFFFFF' : appTheme.colors.muted} name="check" size={20} />
          </Pressable>
        </View>

        <ChatSearchBar
          onChangeText={onChangeSearch}
          placeholder="Search name or number"
          value={search}
        />

        <Text style={[styles.callFavoritesHelper, { backgroundColor: appTheme.colors.surface, color: appTheme.colors.muted }]}>
          Add as many people as you need. Favorites are private to your Synzapp account on this device.
        </Text>

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
              isSelected={favoriteContactIds.includes(contact.contactId)}
              key={contact.contactId}
              onPress={() => onToggleFavorite(contact.contactId)}
              profilePhotoHeaders={profilePhotoHeaders}
              trailing="radio"
            />
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}
