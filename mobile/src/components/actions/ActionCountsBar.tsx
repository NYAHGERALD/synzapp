import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useAppTheme } from '../../theme/AppThemeProvider';
import type { AppColors } from '../../theme/colors';
import { describeCounts } from '../../services/actionDisplay';

/**
 * How much work this group is carrying, above the messages.
 *
 * Both numbers come from counters stored on the group, never from counting
 * rows, so a group with ten thousand actions opens as fast as one with ten.
 *
 * Hidden entirely when there is nothing outstanding. A bar that always shows
 * two zeroes is a bar people stop seeing.
 */
export function ActionCountsBar({
  onPress,
  pending,
  unverified
}: {
  onPress?: () => void;
  pending: number;
  unverified: number;
}) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);

  if (!pending && !unverified) {
    return null;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
    >
      <Feather color={appTheme.colors.mutedStrong} name="clipboard" size={14} />
      <Text style={styles.text}>
        {describeCounts(pending, unverified)}
      </Text>
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    bar: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.divider,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 7,
      marginHorizontal: 12,
      marginTop: 8,
      paddingHorizontal: 13,
      paddingVertical: 7
    },
    text: {
      color: colors.mutedStrong,
      fontSize: 13
    },
    pressed: {
      opacity: 0.85
    }
  });
}
