import { DirectoryFilter } from '../../components/settings/DirectorySettings';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { SettingsInput } from '../../components/organization/OrganizationDeletionModal';
import { styles } from '../../screens/adminChatStyles';

/**
 * Adding a RAILS record.
 *
 * Lifted out of the chat screen unchanged.
 */

export function AddRecordModal({
  description,
  filter,
  isSaving,
  name,
  onCancel,
  onDescriptionChange,
  onNameChange,
  onSave,
  visible
}: {
  description: string;
  filter: DirectoryFilter;
  isSaving: boolean;
  name: string;
  onCancel: () => void;
  onDescriptionChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onSave: () => void;
  visible: boolean;
}) {
  const recordLabel = filter === 'Departments' ? 'department' : 'role';

  if (Platform.OS === 'ios') {
    return null;
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onCancel}
      presentationStyle="fullScreen"
      transparent={false}
      visible={visible}
    >
      <View style={styles.androidModalScreen}>
        <View style={styles.androidModalHeader}>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={onCancel}
            style={({ pressed }) => [styles.backButton, pressed && !isSaving && styles.pressed]}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={onSave}
            style={({ pressed }) => [
              styles.androidSaveButton,
              pressed && !isSaving && styles.pressed,
              isSaving && styles.disabled
            ]}
          >
            <Text style={styles.androidSaveButtonText}>{isSaving ? 'Creating...' : 'Create'}</Text>
          </Pressable>
        </View>
        <Text style={styles.modalTitle}>New {recordLabel}</Text>
        <SettingsInput
          onChangeText={onNameChange}
          placeholder={`${filter === 'Departments' ? 'Department' : 'Role'} name`}
          value={name}
        />
        <SettingsInput
          onChangeText={onDescriptionChange}
          placeholder="Description"
          value={description}
        />
      </View>
    </Modal>
  );
}
