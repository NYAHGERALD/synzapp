import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/AppThemeProvider';
import type { AppColors } from '../../theme/colors';

/**
 * The bar that appears while picking key results to delete.
 *
 * Rendered by the screen rather than inside the list, because anything inside
 * a scroll view scrolls away with the content. It is absolutely positioned
 * against the screen, so it stays put.
 *
 * It sits **directly on the keyboard** when one is open, with no gap: a fixed
 * offset above the keyboard leaves a strip of dead space that makes the screen
 * look broken.
 *
 * Cancel sits hard left and Delete hard right. Two actions at opposite ends
 * cannot be hit by accident, and one of them cannot be undone.
 */
export function KeyResultsSelectionBar({
  keyboardHeight,
  onCancel,
  onDelete,
  selectedCount
}: {
  keyboardHeight: number;
  onCancel: () => void;
  onDelete: () => void;
  selectedCount: number;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  // Rises with a small overshoot, so it reads as arriving rather than
  // appearing.
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(lift, {
      damping: 13,
      mass: 0.7,
      stiffness: 200,
      toValue: 1,
      useNativeDriver: true
    }).start();
  }, [lift]);

  const bottom = keyboardHeight > 0
    ? keyboardHeight + 10
    : Math.max(insets.bottom, 12) + 12;

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          bottom,
          opacity: lift,
          transform: [{
            translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [120, 0] })
          }]
        }
      ]}
    >
      <Pressable accessibilityRole="button" hitSlop={10} onPress={onCancel}>
        <Text style={styles.cancel}>Cancel</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={selectedCount === 0}
        hitSlop={10}
        onPress={onDelete}
      >
        <Text style={[styles.delete, selectedCount === 0 && styles.deleteOff]}>Delete</Text>
      </Pressable>
    </Animated.View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    bar: {
      alignItems: 'center',
      backgroundColor: colors.groupedCard,
      borderRadius: 22,
      elevation: 8,
      flexDirection: 'row',
      // Hard left and hard right, with the card's own 16 keeping them off
      // the edges.
      justifyContent: 'space-between',
      left: 15,
      paddingHorizontal: 16,
      paddingVertical: 16,
      position: 'absolute',
      right: 15,
      shadowColor: '#000000',
      shadowOffset: { height: 4, width: 0 },
      shadowOpacity: Platform.OS === 'ios' ? 0.18 : 0.3,
      shadowRadius: 12,
      zIndex: 60
    },
    cancel: {
      color: colors.link,
      fontSize: 16
    },
    delete: {
      color: colors.destructive,
      fontSize: 16
    },
    deleteOff: {
      color: colors.muted
    }
  });
}
