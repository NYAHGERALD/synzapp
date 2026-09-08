import React from 'react';
import { Text, View } from 'react-native';
import { CircleIconButton } from '../ui/CircleIconButton';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * The back header.
 *
 * The back control is a round icon, not the word "Back" or a typed chevron.
 * One shape everywhere, big enough to hit without looking.
 */

export function BackHeader({
  onBack,
  rightAccessory,
  title
}: {
  onBack: () => void;
  rightAccessory?: React.ReactNode;
  title?: string;
}) {
  const appTheme = useAppTheme();

  return (
    <View style={styles.topActions}>
      <CircleIconButton action="back" label="Back to settings" onPress={onBack} />
      {title ? (
        <Text numberOfLines={1} style={[styles.headerCenterTitle, { color: appTheme.colors.ink }]}>
          {title}
        </Text>
      ) : null}
      {rightAccessory || <View style={styles.topActionsLeftSpacer} />}
    </View>
  );
}
