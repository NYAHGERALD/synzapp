import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ProfileAvatar } from '../../components/messages/MessageThread';
import { colors } from '../../theme/colors';
import { styles } from '../../screens/adminChatStyles';

/**
 * The forward selection header.
 *
 * Lifted out of the chat screen unchanged.
 */

export function ForwardSelectionHeader({
  isForwarding,
  onCancel,
  onForward,
  selectedCount,
  title
}: {
  isForwarding: boolean;
  onCancel: () => void;
  onForward: () => void;
  selectedCount: number;
  title: string;
}) {
  return (
    <View style={styles.forwardSelectionHeader}>
      <View style={styles.forwardSelectionTitleRow}>
        <ProfileAvatar name={title} size={34} uri={null} />
        <View style={styles.forwardSelectionTitleText}>
          <Text numberOfLines={1} style={styles.forwardSelectionTitle}>{title}</Text>
          <Text numberOfLines={1} style={styles.forwardSelectionSubtitle}>
            {selectedCount ? `${selectedCount} selected` : 'Select messages'}
          </Text>
        </View>
      </View>

      <View style={styles.forwardSelectionActions}>
        <Pressable
          accessibilityLabel="Forward selected messages"
          accessibilityRole="button"
          disabled={!selectedCount || isForwarding}
          onPress={onForward}
          style={({ pressed }) => [
            styles.forwardSelectionActionButton,
            (!selectedCount || isForwarding) && styles.disabled,
            pressed && Boolean(selectedCount) && !isForwarding && styles.pressed
          ]}
        >
          {isForwarding ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Feather color={selectedCount ? colors.primary : '#94A3B8'} name="corner-up-right" size={21} />
          )}
        </Pressable>

        <Pressable
          accessibilityLabel="Cancel forwarding"
          accessibilityRole="button"
          onPress={onCancel}
          style={({ pressed }) => [styles.forwardSelectionCloseButton, pressed && styles.pressed]}
        >
          <Feather color="#334155" name="x" size={24} />
        </Pressable>
      </View>
    </View>
  );
}
