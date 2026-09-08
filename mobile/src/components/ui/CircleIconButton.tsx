import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useAppTheme } from '../../theme/AppThemeProvider';
import type { AppColors } from '../../theme/colors';

/**
 * Close, Back and Next, as a round icon rather than a word.
 *
 * One shape for all three across the app. A word has to be read and translated;
 * a chevron or a cross is understood at a glance, which matters when the person
 * holding the phone is wearing gloves in a noisy room.
 *
 * Deliberately large. The circle is 44 points, the size a thumb can hit without
 * looking, and the icon inside is heavy enough to see against a photo.
 *
 * **This is the only thing in the app that casts a shadow.** It floats above
 * whatever it sits on, which is the point: it has to be findable over a photo,
 * a list or a card without changing colour to suit each one. Everything else
 * gets its depth from a card being lighter than the ground behind it.
 */

export type CircleIconAction = 'back' | 'close' | 'next';

const ICONS: Record<CircleIconAction, 'chevron-left' | 'x' | 'chevron-right'> = {
  back: 'chevron-left',
  close: 'x',
  next: 'chevron-right'
};

const LABELS: Record<CircleIconAction, string> = {
  back: 'Back',
  close: 'Close',
  next: 'Next'
};

export function CircleIconButton({
  action,
  disabled = false,
  label,
  onPress,
  tone = 'plain'
}: {
  action: CircleIconAction;
  disabled?: boolean;
  /** Overrides the spoken label when "Back" is not what it does. */
  label?: string;
  onPress: () => void;
  /** `accent` fills the circle, for the one button that moves a flow forward. */
  tone?: 'accent' | 'plain';
}) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const isAccent = tone === 'accent';

  return (
    <Pressable
      accessibilityLabel={label || LABELS[action]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      // The tap area reaches past the circle, so a near miss still counts.
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.circle,
        isAccent && styles.accent,
        pressed && styles.pressed,
        disabled && styles.disabled
      ]}
    >
      <Feather
        color={isAccent ? '#FFFFFF' : appTheme.colors.ink}
        name={ICONS[action]}
        size={23}
      />
    </Pressable>
  );
}

/** Keeps a title centred when only one side has a button. */
export function CircleIconSpacer() {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);

  return <View style={styles.spacer} />;
}

export const CIRCLE_ICON_SIZE = 44;

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    circle: {
      alignItems: 'center',
      backgroundColor: colors.groupedCard,
      borderRadius: CIRCLE_ICON_SIZE / 2,
      elevation: 4,
      height: CIRCLE_ICON_SIZE,
      justifyContent: 'center',
      shadowColor: '#000000',
      shadowOffset: { height: 2, width: 0 },
      shadowOpacity: 0.16,
      shadowRadius: 6,
      width: CIRCLE_ICON_SIZE
    },
    accent: {
      backgroundColor: colors.link
    },
    spacer: {
      height: CIRCLE_ICON_SIZE,
      width: CIRCLE_ICON_SIZE
    },
    pressed: {
      opacity: 0.6
    },
    disabled: {
      opacity: 0.35
    }
  });
}
