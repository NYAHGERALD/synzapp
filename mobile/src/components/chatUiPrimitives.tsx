import Feather from '@expo/vector-icons/Feather';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
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

/**
 * The search field, and there is only one of it.
 *
 * Card white, a blue outline and a soft shadow, on every screen that searches.
 * It began as an opt-in tone on two screens and became the house style, which
 * is the right way round: a field that looks like a field everywhere is worth
 * more than a screen keeping its own version.
 */
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
      searchBarStyles.floating,
      {
        backgroundColor: appTheme.colors.groupedCard,
        borderColor: appTheme.colors.link
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

const searchBarStyles = StyleSheet.create({
  // A shadow, which almost nothing in this app is allowed. It is here because
  // the field has to read as sitting above the page rather than drawn on it,
  // and a border alone does not do that. Kept soft: this is a lift, not a slab.
  floating: {
    borderWidth: 1.5,
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8
  }
});
