import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * Key results header options.
 *
 * Lifted out of the chat screen unchanged.
 */

export function KeyResultsHeaderOptions({
  isKeyboardVisible,
  isOpen,
  onDismissKeyboard,
  onStartSelecting,
  onToggle
}: {
  isKeyboardVisible: boolean;
  isOpen: boolean;
  onDismissKeyboard: () => void;
  onStartSelecting: () => void;
  onToggle: () => void;
}) {
  const appTheme = useAppTheme();

  return (
    <View style={styles.keyResultsHeaderOptionsWrap}>
      {isKeyboardVisible ? (
        <Pressable
          accessibilityLabel="Hide keyboard"
          accessibilityRole="button"
          onPress={onDismissKeyboard}
          style={({ pressed }) => [
            styles.keyResultsHeaderOptionButton,
            {
              backgroundColor: appTheme.colors.surface,
              borderColor: appTheme.colors.divider
            },
            pressed && styles.pressed
          ]}
        >
          <Feather name="chevron-down" color={appTheme.colors.primary} size={20} />
        </Pressable>
      ) : null}
      <Pressable
        accessibilityLabel="Open key result options"
        accessibilityRole="button"
        onPress={onToggle}
        style={({ pressed }) => [
          styles.keyResultsHeaderOptionButton,
          {
            backgroundColor: appTheme.colors.surface,
            borderColor: appTheme.colors.divider
          },
          pressed && styles.pressed
        ]}
      >
        <Feather name="more-horizontal" color={appTheme.colors.primary} size={20} />
      </Pressable>

      {isOpen ? (
        <View style={[
          styles.keyResultsOptionsMenu,
          {
            backgroundColor: appTheme.colors.surfaceElevated,
            borderColor: appTheme.colors.divider
          }
        ]}>
          <Pressable
            accessibilityLabel="Select key results to delete"
            accessibilityRole="button"
            onPress={onStartSelecting}
            style={({ pressed }) => [
              styles.keyResultsOptionsMenuItem,
              pressed && styles.pressed
            ]}
          >
            <Text style={[styles.keyResultsOptionsMenuText, { color: appTheme.colors.link }]}>
              Select to delete
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
