import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { styles } from '../../screens/adminChatStyles';

/**
 * The backup recovery key.
 *
 * Lifted out of the chat screen unchanged.
 */

export function RecoveryKeyModal({
  isRestoring,
  onCancel,
  onChangeRecoveryKey,
  onRestore,
  recoveryKey,
  visible
}: {
  isRestoring: boolean;
  onCancel: () => void;
  onChangeRecoveryKey: (value: string) => void;
  onRestore: () => void;
  recoveryKey: string;
  visible: boolean;
}) {
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
            disabled={isRestoring}
            onPress={onCancel}
            style={({ pressed }) => [styles.backButton, pressed && !isRestoring && styles.pressed]}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isRestoring || recoveryKey.trim().length < 32}
            onPress={onRestore}
            style={({ pressed }) => [
              styles.androidSaveButton,
              pressed && !isRestoring && recoveryKey.trim().length >= 32 && styles.pressed,
              (isRestoring || recoveryKey.trim().length < 32) && styles.disabled
            ]}
          >
            <Text style={styles.androidSaveButtonText}>{isRestoring ? 'Restoring...' : 'Restore'}</Text>
          </Pressable>
        </View>
        <Text style={styles.modalTitle}>Recovery key</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          onChangeText={onChangeRecoveryKey}
          placeholder="Paste recovery key"
          placeholderTextColor="#8B95A5"
          style={styles.recoveryKeyInput}
          value={recoveryKey}
        />
      </View>
    </Modal>
  );
}
