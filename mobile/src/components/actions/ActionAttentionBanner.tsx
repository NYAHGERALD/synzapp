import Feather from '@expo/vector-icons/Feather';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PersonalActionCounts } from '../../services/actionApi';
import { buildActionAttentionBanner } from '../../services/actionAttentionBanner';
import { useAppTheme } from '../../theme/AppThemeProvider';
import type { AppColors } from '../../theme/colors';

/**
 * What this person still owes, above the chat list.
 *
 * Put here because chat is where people already are. An Actions tab that nobody
 * opens tells nobody anything, and the work most likely to be missed is the
 * work nobody is reminded of between shifts.
 *
 * Absent when there is nothing outstanding — a bar showing zeroes is a bar the
 * eye learns to skip, and then it is worthless on the day it matters.
 */
export function ActionAttentionBanner({
  counts,
  onOpenActions
}: {
  counts: PersonalActionCounts | null;
  onOpenActions: () => void;
}) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const banner = buildActionAttentionBanner(counts);

  if (!banner) {
    return null;
  }

  const tone = banner.isUrgent ? appTheme.colors.destructive : appTheme.colors.mutedStrong;

  return (
    <View style={styles.bar}>
      <Feather color={tone} name={banner.isUrgent ? 'alert-circle' : 'clipboard'} size={15} />
      <Text numberOfLines={1} style={[styles.text, { color: tone }]}>
        {banner.text}
      </Text>
      {/* A text link rather than the whole row, so the count can be read
          without the list moving under a thumb that only meant to scroll. */}
      <Pressable
        accessibilityLabel="Open actions"
        accessibilityRole="button"
        onPress={onOpenActions}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        <Text style={[styles.link, { color: appTheme.colors.link }]}>Actions</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    bar: {
      alignItems: 'center',
      backgroundColor: colors.groupedBackground,
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 15,
      paddingVertical: 9
    },
    text: {
      flex: 1,
      fontSize: 13.5
    },
    link: {
      fontSize: 14.5,
      paddingHorizontal: 4,
      paddingVertical: 2
    },
    pressed: {
      opacity: 0.6
    }
  });
}
