import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { FooterTab } from '../../components/guidedSetup/GuidedSetupCoachOverlay';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { androidIconRipple } from '../../components/chatUiPrimitives';
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
  onOpenNewNotice,
  onReturnToChats,
  rightAccessory
}: {
  activeTab: FooterTab;
  onMeasureOptions?: (event: LayoutChangeEvent) => void;
  onOpenMainNavigation?: () => void;
  onOpenOptions?: () => void;
  onOpenNewCall?: () => void;
  onOpenNewChat: () => void;
  onOpenNewNotice?: () => void;
  onReturnToChats?: () => void;
  /** A screen's own controls, for the corner opposite its back button. */
  rightAccessory?: React.ReactNode;
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
  // The chat list scrolls under this one too, so it takes the same floated
  // circle: white, and the one shadow this app allows an icon button.
  const showCircledNavigation = showCircledBack || showMainNavigationButton;
  // Calls keeps its options on the left, opposite its one action. Two buttons
  // crowded into the same corner read as one control with a spare part.
  // Calls and Notices both keep their options on the left, opposite the one
  // action. Two buttons crowded into the same corner read as one control with
  // a spare part.
  const showOptionsOnLeft = (activeTab === 'Calls' || activeTab === 'Announcements')
    && showOptionsButton;
  const showLeftButton = showMainNavigationButton || showBackToChatsButton || showOptionsOnLeft;

  return (
    <View style={styles.topActions}>
      {showLeftButton ? (
        <Pressable
          android_ripple={androidIconRipple}
          accessibilityLabel={
            showBackToChatsButton
              ? 'Back to chats'
              : showOptionsOnLeft
                ? 'Open call options'
                : 'Open main navigation'
          }
          accessibilityRole="button"
          onPress={
            showBackToChatsButton
              ? onReturnToChats
              : showOptionsOnLeft
                ? onOpenOptions
                : onOpenMainNavigation
          }
          style={({ pressed }) => [
            styles.mainNavigationButton,
            (showCircledNavigation || showOptionsOnLeft) && styles.mainNavigationButtonCircle,
            pressed && styles.pressed
          ]}
        >
          <Ionicons
            color={appTheme.colors.primary}
            name={
              showBackToChatsButton
                ? 'chevron-back'
                : showOptionsOnLeft
                  ? 'ellipsis-horizontal'
                  : 'menu-outline'
            }
            size={showCircledNavigation || showOptionsOnLeft ? 26 : showBackToChatsButton ? 34 : 38}
          />
        </Pressable>
      ) : (
        <View style={styles.topActionsLeftSpacer} />
      )}

      {activeTab === 'Chats' || activeTab === 'Calls' || activeTab === 'Announcements'
        || showOptionsButton || rightAccessory ? (
        <View style={[
          styles.rightActions,
          activeTab !== 'Chats' && activeTab !== 'Calls' && styles.rightActionsCompact
        ]}>
          {/* A word, in the app's link blue. The brand green is not a button
              colour, and a filled disc in the corner of a list competes with
              the list. */}
          {activeTab === 'Chats' ? (
            <Pressable
              accessibilityLabel="Start new chat"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onOpenNewChat}
              style={({ pressed }) => [headerStyles.textAction, pressed && styles.pressed]}
            >
              <Text style={[headerStyles.textActionLabel, { color: appTheme.colors.link }]}>Add</Text>
            </Pressable>
          ) : null}

          {/* The options button has gone to the other side, so this corner
              carries the screen's one action, as a word in the app's link
              blue rather than a filled brand-green disc. */}
          {rightAccessory}

          {activeTab === 'Calls' ? (
            <Pressable
              accessibilityLabel="Start new call"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onOpenNewCall}
              style={({ pressed }) => [headerStyles.textAction, pressed && styles.pressed]}
            >
              <Text style={[headerStyles.textActionLabel, { color: appTheme.colors.link }]}>New call</Text>
            </Pressable>
          ) : null}

          {activeTab === 'Announcements' && onOpenNewNotice ? (
            <Pressable
              accessibilityLabel="Write a new announcement"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onOpenNewNotice}
              style={({ pressed }) => [headerStyles.textAction, pressed && styles.pressed]}
            >
              <Text style={[headerStyles.textActionLabel, { color: appTheme.colors.link }]}>Add</Text>
            </Pressable>
          ) : null}

          {/* Only when it is not already on the left. Announcements and Calls
              put it there, and drawing it in both corners is how the same
              control ended up on screen twice. */}
          {showOptionsButton && !showOptionsOnLeft ? (
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

const headerStyles = StyleSheet.create({
  textAction: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44
  },
  textActionLabel: {
    fontSize: 16,
    lineHeight: 21
  }
});
