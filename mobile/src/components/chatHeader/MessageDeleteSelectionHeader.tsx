import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
import { styles } from '../../screens/adminChatStyles';

/**
 * The delete selection header.
 *
 * Lifted out of the chat screen unchanged.
 */

export function MessageDeleteSelectionHeader({
  onCancel,
  selectedCount,
  title
}: {
  onCancel: () => void;
  selectedCount: number;
  title: string;
}) {
  return (
    <View style={styles.forwardSelectionHeader}>
      <View style={styles.forwardSelectionTitleRow}>
        <View style={styles.forwardSelectionTitleText}>
          <Text numberOfLines={1} style={styles.forwardSelectionTitle}>{title}</Text>
          <Text numberOfLines={1} style={styles.forwardSelectionSubtitle}>
            {selectedCount === 1 ? '1 message selected' : `${selectedCount} messages selected`}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityLabel="Cancel deleting messages"
        accessibilityRole="button"
        onPress={onCancel}
        style={({ pressed }) => [styles.forwardSelectionCloseButton, pressed && styles.pressed]}
      >
        <Feather color="#334155" name="x" size={24} />
      </Pressable>
    </View>
  );
}
