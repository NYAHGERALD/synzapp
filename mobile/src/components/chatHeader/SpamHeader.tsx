import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { androidIconRipple } from '../../components/chatUiPrimitives';
import { colors } from '../../theme/colors';
import { styles } from '../../screens/adminChatStyles';

/**
 * The spam header.
 *
 * Lifted out of the chat screen unchanged.
 */

export function SpamHeader({
  isDeleting,
  onBack,
  onDelete,
  spamCount
}: {
  isDeleting: boolean;
  onBack: () => void;
  onDelete: () => void;
  spamCount: number;
}) {
  return (
    <View style={styles.spamHeader}>
      <Pressable
        android_ripple={androidIconRipple}
        accessibilityLabel="Back to chats"
        accessibilityRole="button"
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <Text style={styles.backButtonText}>‹</Text>
      </Pressable>

      <Text numberOfLines={1} style={styles.spamHeaderTitle}>Trash</Text>

      <Pressable
        accessibilityLabel="Delete Trash chats"
        accessibilityRole="button"
        disabled={isDeleting || spamCount === 0}
        onPress={onDelete}
        style={({ pressed }) => [
          styles.spamHeaderDeleteButton,
          pressed && spamCount > 0 && !isDeleting && styles.pressed,
          (isDeleting || spamCount === 0) && styles.disabled
        ]}
      >
        {isDeleting ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <Text style={styles.spamHeaderDeleteText}>Delete</Text>
        )}
      </Pressable>
    </View>
  );
}
