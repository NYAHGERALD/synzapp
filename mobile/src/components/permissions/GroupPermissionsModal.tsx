import React from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { ANDROID_MAX_NAVIGATION_INSET } from '../../services/androidNavigationInset';
import { CircleIconButton, CircleIconSpacer } from '../../components/ui/CircleIconButton';
import { ListSection, ListSwitchRow } from '../../components/ui/GroupedList';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { resolveScreenBottomInset } from '../../services/rootSafeArea';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Who may do what in a group.
 *
 * Two switches, not two radio buttons: this app settles a setting with an
 * `AppSwitch` and never with a tick box or a circle.
 *
 * They are strictly opposite, because the choice is one thing with two names.
 * Turning either one off is the same as turning the other on, so every gesture
 * lands somewhere valid and nothing can leave the group with no rule at all.
 * Both descriptions stay on screen, which is the reason for keeping two rows
 * rather than collapsing to one switch: what "admins only" actually means is
 * worth reading before it is chosen.
 */

export function GroupPermissionsModal({
  isOpen,
  onBack,
  onSelectPermission,
  permissionMode
}: {
  isOpen: boolean;
  onBack: () => void;
  onSelectPermission: (value: 'ADMINS' | 'ALL_MEMBERS') => void;
  permissionMode: 'ADMINS' | 'ALL_MEMBERS';
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);
  const screenBottomInset = resolveScreenBottomInset({
    androidNavigationInset: Math.min(insets.bottom, ANDROID_MAX_NAVIGATION_INSET),
    platform: Platform.OS
  });
  const isAllMembers = permissionMode === 'ALL_MEMBERS';

  return (
    <Modal
      allowSwipeDismissal={Platform.OS === 'ios'}
      animationType="slide"
      onRequestClose={onBack}
      presentationStyle={getNativeFullHeightModalPresentationStyle()}
      transparent={false}
      visible={isOpen}
    >
      <View style={[
        permissionStyles.screen,
        {
          backgroundColor: appTheme.colors.groupedBackground,
          paddingBottom: Math.max(16, screenBottomInset + 12),
          paddingTop: modalTopPadding
        }
      ]}>
        <View style={permissionStyles.header}>
          <CircleIconButton action="back" label="Back to group details" onPress={onBack} />
          <Text numberOfLines={1} style={[permissionStyles.headerTitle, { color: appTheme.colors.ink }]}>
            Group permissions
          </Text>
          <CircleIconSpacer />
        </View>

        <ListSection footer="One or the other. Turning either off turns the other on.">
          <ListSwitchRow
            onValueChange={() => onSelectPermission('ALL_MEMBERS')}
            subtitle="Members can send messages and participate normally."
            title="All members"
            value={isAllMembers}
          />
          <ListSwitchRow
            onValueChange={() => onSelectPermission('ADMINS')}
            subtitle="Admins control key group actions. Member messaging rules can be expanded later."
            title="Admins only"
            value={!isAllMembers}
          />
        </ListSection>
      </View>
    </Modal>
  );
}

const permissionStyles = StyleSheet.create({
  screen: {
    flex: 1
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    paddingHorizontal: 10,
    textAlign: 'center'
  }
});
