import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { ActionsTabFilter } from '../../services/actionsTabFilters';
import { useAppTheme } from '../../theme/AppThemeProvider';
import type { AppColors } from '../../theme/colors';

/**
 * Which actions to show, chosen from the header rather than from a row of tabs.
 *
 * The three filters used to sit across the top of the list as chips. They cost
 * a band of the screen permanently to hold a choice that is made rarely and
 * then left alone, and they pushed the list itself down on a screen whose whole
 * job is the list.
 *
 * Anchored under the options button it opens from, the same shape as the call
 * options menu, so the two behave alike.
 *
 * It **grows out of that button** rather than appearing. The panel scales from
 * its top right corner, which is where the button is, so the menu visibly comes
 * from the thing that was tapped instead of materialising over the screen.
 *
 * Closing is animated too, which is why the modal is kept mounted for a beat
 * after `isOpen` goes false. Unmounting on the spot is what made it vanish, and
 * a menu that opens smoothly and then disappears reads as a glitch rather than
 * as fast.
 */
export function ActionsOptionsMenu({
  counts,
  isOpen,
  onClose,
  onSelect,
  selected
}: {
  counts: Record<ActionsTabFilter, number>;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (filter: ActionsTabFilter) => void;
  selected: ActionsTabFilter;
}) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const progress = useRef(new Animated.Value(0)).current;
  // Kept mounted while it animates shut, then dropped.
  const [isMounted, setIsMounted] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      // A spring on the way in: it settles with a little weight, the way the
      // footer tabs do, so the app moves in one manner throughout.
      Animated.spring(progress, {
        damping: 20,
        mass: 0.7,
        stiffness: 260,
        toValue: 1,
        useNativeDriver: true
      }).start();

      return;
    }

    // Quicker and flatter on the way out. Somebody who has chosen is finished
    // with the menu, and making them watch it bounce closed is making them
    // wait.
    Animated.timing(progress, {
      duration: 130,
      easing: Easing.out(Easing.quad),
      toValue: 0,
      useNativeDriver: true
    }).start((result: { finished: boolean }) => {
      const { finished } = result;

      if (finished) {
        setIsMounted(false);
      }
    });
  }, [isOpen, progress]);

  if (!isMounted) {
    return null;
  }

  return (
    <Modal animationType="none" onRequestClose={onClose} transparent visible>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
          <Pressable
            accessibilityLabel="Close options"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.backdropFill}
          />
        </Animated.View>
        <Animated.View style={[
          styles.panel,
          {
            opacity: progress,
            transform: [{
              scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] })
            }]
          }
        ]}>
          {OPTIONS.map(([filter, label], index) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: filter === selected }}
              key={filter}
              onPress={() => onSelect(filter)}
              style={({ pressed }) => [
                styles.row,
                index === OPTIONS.length - 1 && styles.lastRow,
                pressed && styles.pressed
              ]}
            >
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.count}>{counts[filter]}</Text>
              {/* The slot keeps its width whether or not a tick is in it, so
                  the counts stay in a column instead of shifting by row. */}
              <View style={styles.tick}>
                {filter === selected ? (
                  <Feather color={appTheme.colors.link} name="check" size={18} />
                ) : null}
              </View>
            </Pressable>
          ))}
        </Animated.View>
      </View>
    </Modal>
  );
}

const OPTIONS: [ActionsTabFilter, string][] = [
  ['outstanding', 'Outstanding'],
  ['done', 'Done'],
  ['all', 'All']
];

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 100
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject
    },
    backdropFill: {
      ...StyleSheet.absoluteFillObject
    },
    panel: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      minWidth: 210,
      overflow: 'hidden',
      position: 'absolute',
      right: 14,
      shadowColor: '#000000',
      shadowOffset: { height: 10, width: 0 },
      shadowOpacity: 0.18,
      shadowRadius: 18,
      top: 56,
      // The button is up and to the right, so that is where the panel comes
      // from. Scaling about the centre would have it grow out of thin air in
      // the middle of the screen.
      transformOrigin: 'top right'
    },
    row: {
      alignItems: 'center',
      borderBottomColor: colors.divider,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: 12,
      minHeight: 48,
      paddingHorizontal: 14
    },
    lastRow: {
      borderBottomWidth: 0
    },
    label: {
      color: colors.ink,
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      lineHeight: 20
    },
    count: {
      color: colors.muted,
      fontSize: 15,
      fontVariant: ['tabular-nums'],
      lineHeight: 20
    },
    tick: {
      alignItems: 'center',
      width: 18
    },
    pressed: {
      opacity: 0.7
    }
  });
}
