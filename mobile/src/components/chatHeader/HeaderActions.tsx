import Ionicons from '@expo/vector-icons/Ionicons';
import type { LayoutChangeEvent } from 'react-native';
import { FooterTab } from '../../components/guidedSetup/GuidedSetupCoachOverlay';
import { Pressable, View } from 'react-native';
import { androidButtonRipple, androidIconRipple } from '../../components/chatUiPrimitives';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * The header action buttons.
 *
 * Lifted out of the chat screen unchanged.
 */

export function HeaderActions({
  activeTab,
  onMeasureOptions,
  onOpenMainNavigation,
  onOpenOptions,
  onOpenNewCall,
  onOpenNewChat,
  onReturnToChats
}: {
  activeTab: FooterTab;
  onMeasureOptions?: (event: LayoutChangeEvent) => void;
  onOpenMainNavigation?: () => void;
  onOpenOptions?: () => void;
  onOpenNewCall?: () => void;
  onOpenNewChat: () => void;
  onReturnToChats?: () => void;
}) {
  const appTheme = useAppTheme();
  const showOptionsButton = Boolean(onOpenOptions);
  const showMainNavigationButton = activeTab === 'Chats' && Boolean(onOpenMainNavigation);
  // Actions and the Library are both reached from the chat list and both leave
  // the same way. A screen with a back button never also shows the tab bar —
  // one way out, not two.
  const showBackToChatsButton = (activeTab === 'Library' || activeTab === 'Actions')
    && Boolean(onReturnToChats);
  // Circled where the icon sits over a list rather than over the page header,
  // so it stays findable while the content scrolls under it.
  const showCircledOptions = activeTab === 'Actions';
  const showCircledBack = showBackToChatsButton && activeTab === 'Actions';

  return (
    <View style={styles.topActions}>
      {showMainNavigationButton || showBackToChatsButton ? (
        <Pressable
          android_ripple={androidIconRipple}
          accessibilityLabel={showBackToChatsButton ? 'Back to chats' : 'Open main navigation'}
          accessibilityRole="button"
          onPress={showBackToChatsButton ? onReturnToChats : onOpenMainNavigation}
          style={({ pressed }) => [
            styles.mainNavigationButton,
            showCircledBack && styles.mainNavigationButtonCircle,
            pressed && styles.pressed
          ]}
        >
          <Ionicons
            color={appTheme.colors.primary}
            name={showBackToChatsButton ? 'chevron-back' : 'menu-outline'}
            size={showCircledBack ? 26 : showBackToChatsButton ? 34 : 38}
          />
        </Pressable>
      ) : (
        <View style={styles.topActionsLeftSpacer} />
      )}

      {activeTab === 'Chats' || activeTab === 'Calls' || showOptionsButton ? (
        <View style={[
          styles.rightActions,
          activeTab !== 'Chats' && activeTab !== 'Calls' && styles.rightActionsCompact
        ]}>
          {activeTab === 'Chats' ? (
            <Pressable
              android_ripple={androidButtonRipple}
              accessibilityLabel="Start new chat"
              accessibilityRole="button"
              onPress={onOpenNewChat}
              style={({ pressed }) => [
                styles.addButton,
                { backgroundColor: appTheme.colors.primary },
                pressed && styles.pressed
              ]}
            >
              <Ionicons color="#FFFFFF" name="add" size={22} />
            </Pressable>
          ) : null}

          {activeTab === 'Calls' ? (
            <>
              <Pressable
                android_ripple={androidIconRipple}
                accessibilityLabel="Open call options"
                accessibilityRole="button"
                onPress={onOpenOptions}
                style={({ pressed }) => [styles.topMenuButton, pressed && styles.pressed]}
              >
                <Ionicons color={appTheme.colors.primary} name="ellipsis-horizontal-circle-outline" size={32} />
              </Pressable>
              <Pressable
                android_ripple={androidButtonRipple}
                accessibilityLabel="Start new call"
                accessibilityRole="button"
                onPress={onOpenNewCall}
                style={({ pressed }) => [
                  styles.addButton,
                  { backgroundColor: appTheme.colors.primary },
                  pressed && styles.pressed
                ]}
              >
                <Ionicons color="#FFFFFF" name="add" size={22} />
              </Pressable>
            </>
          ) : null}

          {showOptionsButton && activeTab !== 'Calls' ? (
            <Pressable
              android_ripple={androidIconRipple}
              accessibilityLabel="Open options"
              accessibilityRole="button"
              onLayout={onMeasureOptions}
              onPress={onOpenOptions}
              style={({ pressed }) => [
                styles.topMenuButton,
                showCircledOptions && styles.topMenuButtonCircle,
                pressed && styles.pressed
              ]}
            >
              <Ionicons
                color={appTheme.colors.primary}
                name="menu-outline"
                size={showCircledOptions ? 26 : 32}
              />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
