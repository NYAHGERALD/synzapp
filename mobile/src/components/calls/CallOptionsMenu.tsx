import Feather from '@expo/vector-icons/Feather';
import { Modal, Pressable, Text, View } from 'react-native';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * The call options menu.
 *
 * Lifted out of the chat screen unchanged.
 */

export function CallOptionsMenu({
  isOpen,
  onClose,
  onEdit,
  onOpenScheduled
}: {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onOpenScheduled: () => void;
}) {
  const appTheme = useAppTheme();

  if (!isOpen) {
    return null;
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <View style={styles.callOptionsRoot}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.callOptionsBackdrop} />
        <View style={[
          styles.callOptionsPanel,
          {
            backgroundColor: appTheme.colors.surfaceElevated,
            borderColor: appTheme.colors.border
          }
        ]}>
          <CallOptionsRow icon="edit-2" label="Edit" onPress={onEdit} />
          <CallOptionsRow icon="calendar" label="Scheduled calls" onPress={onOpenScheduled} />
        </View>
      </View>
    </Modal>
  );
}

function CallOptionsRow({
  icon,
  label,
  onPress
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.callOptionsRow,
        { borderBottomColor: appTheme.colors.divider },
        pressed && styles.pressed
      ]}
    >
      <Feather color={appTheme.colors.ink} name={icon} size={17} />
      <Text style={[styles.callOptionsRowText, { color: appTheme.colors.ink }]}>{label}</Text>
    </Pressable>
  );
}
