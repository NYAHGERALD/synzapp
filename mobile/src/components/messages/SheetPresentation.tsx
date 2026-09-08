import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, View, useWindowDimensions } from 'react-native';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The way a sheet arrives and leaves.
 *
 * `Modal`'s own `animationType="slide"` moves the whole screen at one speed and
 * stops dead. Everything here is about the difference between a panel that
 * appears and one that is *placed*: the backdrop fades while the sheet rises on
 * a spring that settles rather than halting, and both reverse on the way out —
 * which the built-in animation cannot do at all, because the modal is unmounted
 * before it could play.
 *
 * Shared by every sheet in the composer so they behave identically. A closing
 * animation that only some panels have is worse than none, because the ones
 * without it read as dropped frames.
 */

/** Slow enough to read as deliberate, quick enough not to be waited on. */
const OPEN_TENSION = 62;
const OPEN_FRICTION = 11;
const CLOSE_MS = 190;

export function SheetPresentation({
  children,
  closeLabel,
  maxHeightRatio = 0.7,
  maxHeightPoints = 620,
  onClose,
  visible
}: {
  children: React.ReactNode;
  closeLabel: string;
  maxHeightPoints?: number;
  maxHeightRatio?: number;
  onClose: () => void;
  visible: boolean;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // Kept mounted through the closing animation. Unmounting on `visible`
  // turning false is what makes a sheet vanish instead of leaving.
  const [isMounted, setIsMounted] = React.useState(visible);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      Animated.spring(progress, {
        friction: OPEN_FRICTION,
        tension: OPEN_TENSION,
        toValue: 1,
        useNativeDriver: true
      }).start();

      return;
    }

    Animated.timing(progress, {
      duration: CLOSE_MS,
      easing: Easing.in(Easing.cubic),
      toValue: 0,
      useNativeDriver: true
    }).start(({ finished }) => {
      if (finished) {
        setIsMounted(false);
      }
    });
  }, [progress, visible]);

  if (!isMounted) {
    return null;
  }

  const sheetMaxHeight = Math.min(height * maxHeightRatio, maxHeightPoints);

  return (
    <Modal
      hardwareAccelerated
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible
    >
      <View style={styles.messageReactionPickerRoot}>
        <Animated.View style={[StyleSheetAbsoluteFill, { opacity: progress }]}>
          <Pressable
            accessibilityLabel={closeLabel}
            accessibilityRole="button"
            onPress={onClose}
            style={[
              styles.messageReactionPickerBackdrop,
              { backgroundColor: appTheme.colors.overlay }
            ]}
          />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.messageReactionPickerSheet,
            {
              backgroundColor: appTheme.colors.screen,
              borderColor: appTheme.colors.border,
              maxHeight: sheetMaxHeight,
              opacity: progress,
              paddingBottom: Math.max(insets.bottom, 18),
              transform: [{
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [sheetMaxHeight, 0]
                })
              }]
            }
          ]}
        >
          <View style={[styles.messageReactionPickerHandle, { backgroundColor: appTheme.colors.border }]} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const StyleSheetAbsoluteFill = {
  bottom: 0,
  left: 0,
  position: 'absolute' as const,
  right: 0,
  top: 0
};

/**
 * A row that answers the finger.
 *
 * Presses shrink it slightly and let it spring back. Without this a list of
 * choices gives no sign it registered anything until the screen changes, which
 * on a slow connection is long enough for somebody to tap again.
 */
export function PressableScale({
  accessibilityLabel,
  children,
  disabled,
  onPress,
  style
}: {
  accessibilityLabel: string;
  children: React.ReactNode;
  disabled?: boolean;
  onPress: () => void;
  style?: React.ComponentProps<typeof Animated.View>['style'];
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const settle = (toValue: number) => {
    Animated.spring(scale, {
      friction: 7,
      tension: 180,
      toValue,
      useNativeDriver: true
    }).start();
  };

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => settle(0.97)}
      onPressOut={() => settle(1)}
    >
      <Animated.View style={[style, { transform: [{ scale }] }, disabled && styles.disabled]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
