import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { androidButtonRipple, androidIconRipple } from '../../components/chatUiPrimitives';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The main navigation menu.
 *
 * Lifted out of the chat screen unchanged.
 */

export const mainNavigationLinks = [
  'ACTIONS',
  'RECORD MEETING',
  'LEADERS STANDARD WORK',
  'INTERPRETER',
  'LIBRARY'
] as const;

export function MainNavigationModal({
  isOpen,
  links,
  onClose,
  onSelect
}: {
  isOpen: boolean;
  links: readonly (typeof mainNavigationLinks[number])[];
  onClose: () => void;
  onSelect: (label: typeof mainNavigationLinks[number]) => void;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);
  const navigationTopOffset = Math.max(76, Math.min(148, Math.round(height * 0.14)));

  return (
    <Modal
      allowSwipeDismissal={Platform.OS === 'ios'}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle={getNativeFullHeightModalPresentationStyle()}
      transparent={false}
      visible={isOpen}
    >
      <View style={[
        styles.mainNavigationScreen,
        {
          backgroundColor: appTheme.colors.screen,
          paddingBottom: Math.max(insets.bottom, 18),
          paddingTop: modalTopPadding
        }
      ]}>
        <View style={styles.mainNavigationHeader}>
          <Pressable
            accessibilityLabel="Close main navigation"
            accessibilityRole="button"
            android_ripple={androidIconRipple}
            onPress={onClose}
            style={({ pressed }) => [
              styles.mainNavigationHeaderButton,
              { backgroundColor: appTheme.colors.surface },
              pressed && styles.pressed
            ]}
          >
            <Ionicons color={appTheme.colors.ink} name="close" size={25} />
          </Pressable>
          <Text numberOfLines={1} style={[styles.mainNavigationTitle, { color: appTheme.colors.ink }]}>
            Synzapp
          </Text>
          <View style={styles.mainNavigationHeaderSpacer} />
        </View>

        <View style={[styles.mainNavigationContent, { paddingTop: navigationTopOffset }]}>
          {links.map((link, index) => (
            <Pressable
              accessibilityLabel={`Open ${link}`}
              accessibilityRole="button"
              android_ripple={androidButtonRipple}
              key={link}
              onPress={() => onSelect(link)}
              style={({ pressed }) => [
                styles.mainNavigationLink,
                {
                  borderBottomColor: appTheme.isDark ? '#3A3A3A' : '#D6DCE5',
                  borderBottomWidth: index === links.length - 1 ? 0 : 1
                },
                pressed && styles.pressed
              ]}
            >
              <Text numberOfLines={1} style={[styles.mainNavigationLinkText, { color: appTheme.colors.ink }]}>
                {link}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}
