import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { getFullScreenModalTopPadding } from '../../components/keyResults/KeyResultsSettings';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Bulk contact actions.
 *
 * Lifted out of the chat screen unchanged.
 */

export interface BatchContactCandidate {
  displayName: string;
  id: string;
  phoneMasked: string;
  phoneNumber: string;
  subtitle: string;
}

export function BatchContactModal({
  candidates,
  isLoading,
  onCancel,
  onConfirm,
  onSearchChange,
  onToggleContact,
  search,
  selectedPhoneNumbers,
  visible
}: {
  candidates: BatchContactCandidate[];
  isLoading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onSearchChange: (value: string) => void;
  onToggleContact: (phoneNumber: string) => void;
  search: string;
  selectedPhoneNumbers: string[];
  visible: boolean;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);
  const selectedPhoneNumberSet = new Set(selectedPhoneNumbers);
  const query = search.trim().toLowerCase();
  const visibleCandidates = query
    ? candidates.filter((candidate) => (
        candidate.displayName.toLowerCase().includes(query) ||
        candidate.subtitle.toLowerCase().includes(query)
      ))
    : candidates;

  return (
    <Modal
      animationType="slide"
      onRequestClose={onCancel}
      presentationStyle="fullScreen"
      transparent={false}
      visible={visible}
    >
      <View style={[
        styles.batchModalScreen,
        {
          backgroundColor: appTheme.colors.screen,
          paddingTop: modalTopPadding
        }
      ]}>
        <View style={styles.batchModalHeader}>
          <Pressable
            accessibilityLabel="Close contacts"
            accessibilityRole="button"
            disabled={isLoading}
            onPress={onCancel}
            style={({ pressed }) => [
              styles.backButton,
              pressed && !isLoading && styles.pressed,
              isLoading && styles.disabled
            ]}
          >
            <Text style={[styles.backButtonText, { color: appTheme.colors.primary }]}>‹</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={isLoading || selectedPhoneNumbers.length === 0}
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.batchDoneButton,
              { backgroundColor: appTheme.colors.primary },
              pressed && !isLoading && selectedPhoneNumbers.length > 0 && styles.pressed,
              (isLoading || selectedPhoneNumbers.length === 0) && styles.disabled
            ]}
          >
            <Text style={styles.batchDoneButtonText}>Done</Text>
          </Pressable>
        </View>

        <Text style={[styles.batchModalTitle, { color: appTheme.colors.ink }]}>Select contacts</Text>
        <Text style={[styles.batchSelectedCount, { color: appTheme.colors.muted }]}>
          {selectedPhoneNumbers.length === 1
            ? '1 contact selected'
            : `${selectedPhoneNumbers.length} contacts selected`}
        </Text>

        <View style={[
          styles.batchSearchBox,
          {
            backgroundColor: appTheme.colors.input,
            borderColor: appTheme.colors.border
          }
        ]}>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={onSearchChange}
            placeholder="Search contacts"
            placeholderTextColor={appTheme.colors.muted}
            style={[styles.batchSearchInput, { color: appTheme.colors.ink }]}
            value={search}
          />
        </View>

        {isLoading ? (
          <View style={styles.batchLoading}>
            <ActivityIndicator color={appTheme.colors.primary} />
          </View>
        ) : (
          <FlatList
            contentContainerStyle={styles.batchListContent}
            data={visibleCandidates}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<Text style={[styles.batchEmpty, { color: appTheme.colors.muted }]}>No contacts found</Text>}
            renderItem={({ item }) => (
              <BatchContactRow
                contact={item}
                isSelected={selectedPhoneNumberSet.has(item.phoneNumber)}
                onToggle={() => onToggleContact(item.phoneNumber)}
              />
            )}
            showsVerticalScrollIndicator={false}
            style={styles.batchList}
          />
        )}
      </View>
    </Modal>
  );
}

function BatchContactRow({
  contact,
  isSelected,
  onToggle
}: {
  contact: BatchContactCandidate;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.batchContactRow,
        {
          backgroundColor: appTheme.colors.screen,
          borderBottomColor: appTheme.colors.divider
        },
        pressed && styles.pressed
      ]}
    >
      <View style={[
        styles.batchContactSelector,
        {
          borderColor: isSelected ? appTheme.colors.primary : appTheme.colors.muted
        },
        isSelected && styles.batchContactSelectorActive
      ]}>
        {isSelected ? <View style={[styles.batchContactSelectorInner, { backgroundColor: appTheme.colors.primary }]} /> : null}
      </View>
      <View style={styles.chatText}>
        <Text style={[styles.chatTitle, { color: appTheme.colors.ink }]}>{contact.displayName}</Text>
        <Text style={[styles.chatPreview, { color: appTheme.colors.muted }]}>{contact.subtitle}</Text>
      </View>
    </Pressable>
  );
}
