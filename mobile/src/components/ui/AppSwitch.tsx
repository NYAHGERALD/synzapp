import React from 'react';
import { Platform, Switch } from 'react-native';

/**
 * The one switch used everywhere in the app.
 *
 * Fixed colours rather than theme tokens, because a switch is a physical
 * control people recognise by its colour: green means on, grey means off, in
 * both light and dark. Tinting it with the brand colour makes it read as
 * decoration instead of a state.
 *
 * Text and links are blue. Switches are green. They are different things.
 */

export const SWITCH_ON_COLOR = '#36C75A';
export const SWITCH_OFF_COLOR = '#C5C5C7';

export function AppSwitch({
  disabled = false,
  onValueChange,
  value
}: {
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <Switch
      disabled={disabled}
      // iOS paints the off track from its own property, Android from the
      // track colours. Both are set so the two platforms match.
      ios_backgroundColor={SWITCH_OFF_COLOR}
      onValueChange={onValueChange}
      thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
      trackColor={{ false: SWITCH_OFF_COLOR, true: SWITCH_ON_COLOR }}
      value={value}
    />
  );
}
