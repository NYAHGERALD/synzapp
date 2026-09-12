import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { resolveFooterIndicatorFrame } from '../../services/footerTabIndicator';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * The highlight behind the selected footer tab.
 *
 * **One pill for the whole bar, not one per tab.** Each tab used to fade its
 * own circle in and out, so the highlight vanished in one place and appeared in
 * another with nothing joining the two. Here a single pill travels, which is
 * what makes a tap read as moving somewhere rather than switching something on.
 *
 * It encloses the icon and the label together, so the whole tab lights up.
 *
 * The travel is a `translateX` on the native driver, so it keeps its timing
 * while JavaScript is busy doing whatever the new tab asked for — which is
 * exactly when a tab bar is most likely to stutter.
 */

/** Slow enough to read as travel, short enough not to hold anybody up. */
const TRAVEL_DURATION_MS = 420;

export function FooterTabIndicator({
  activeIndex,
  barWidth,
  horizontalPadding,
  radius,
  tabCount
}: {
  activeIndex: number;
  barWidth: number;
  horizontalPadding: number;
  radius: number;
  tabCount: number;
}) {
  const appTheme = useAppTheme();
  const frame = resolveFooterIndicatorFrame({
    activeIndex,
    barWidth,
    horizontalPadding,
    tabCount
  });
  const left = frame?.left ?? null;
  const travel = useRef(new Animated.Value(left ?? 0)).current;
  const hasPlaced = useRef(false);

  // Keyed on the number, not the frame: a fresh object every render would
  // restart the travel on every render and the pill would never settle.
  useEffect(() => {
    if (left === null) {
      return;
    }

    // The first placement is where it belongs, not somewhere to slide from.
    // Animating that one would drag the pill across the bar on every open.
    if (!hasPlaced.current) {
      hasPlaced.current = true;
      travel.setValue(left);
      return;
    }

    Animated.timing(travel, {
      duration: TRAVEL_DURATION_MS,
      // Leaves quickly and settles slowly, the way something with weight stops.
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      toValue: left,
      useNativeDriver: true
    }).start();
  }, [left, travel]);

  if (!frame) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.footerTabIndicator,
        {
          backgroundColor: appTheme.colors.footerActive,
          borderRadius: radius,
          transform: [{ translateX: travel }],
          width: frame.width
        }
      ]}
    />
  );
}
