import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { SettingsInput } from '../../components/organization/OrganizationDeletionModal';
import { TenantDepartment } from '../../services/adminApi';
import { getFullScreenModalTopPadding } from '../../components/keyResults/KeyResultsSettings';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Creating a group.
 *
 * Lifted out of the chat screen unchanged.
 */

export function AddGroupModal({
  department,
  description,
  isSaving,
  name,
  onCancel,
  onDescriptionChange,
  onNameChange,
  onSave,
  visible
}: {
  department: TenantDepartment | null;
  description: string;
  isSaving: boolean;
  name: string;
  onCancel: () => void;
  onDescriptionChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onSave: () => void;
  visible: boolean;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);

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
        <Text style={styles.modalTitle}>New group</Text>
        <Text style={styles.groupScopeLabel}>
          {department ? department.name : 'Company-wide'}
        </Text>
        <SettingsInput
          onChangeText={onNameChange}
          placeholder="Group name"
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
