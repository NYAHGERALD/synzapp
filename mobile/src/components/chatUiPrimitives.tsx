import Feather from '@expo/vector-icons/Feather';
import { Platform, TextInput, View } from 'react-native';
import { styles } from '../screens/adminChatStyles';
import { useAppTheme } from '../theme/AppThemeProvider';

/**
 * The small pieces every admin surface reuses.
 *
 * A search bar, the two Android ripple configs, and the platform's keyboard
 * dismiss behaviour — between them referenced from more than thirty places in
 * the chat screen. They are here because each one was blocking an extraction:
 * a component cannot leave while a primitive it needs is trapped behind it.
 */

export const androidButtonRipple = { borderless: false, color: 'rgba(15, 118, 110, 0.14)' } as const;

export const androidIconRipple = { borderless: true, color: 'rgba(15, 118, 110, 0.14)' } as const;

export function getKeyboardDismissMode(): 'interactive' | 'on-drag' {
  return Platform.OS === 'ios' ? 'interactive' : 'on-drag';
}

export function ChatSearchBar({
  onChangeText,
  placeholder,
  value
}: {
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const appTheme = useAppTheme();

  return (
    <View style={[
      styles.chatSearchBox,
      {
        backgroundColor: appTheme.colors.input,
        borderColor: appTheme.colors.border
      }
    ]}>
      <Feather color={appTheme.colors.muted} name="search" size={18} />
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={appTheme.colors.muted}
        style={[styles.chatSearchInput, { color: appTheme.colors.ink }]}
        value={value}
      />
    </View>
  );
}
