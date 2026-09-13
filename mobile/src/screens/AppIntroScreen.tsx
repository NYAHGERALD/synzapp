import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import {
  APP_INTRO_FADE_IN_MS,
  APP_INTRO_FADE_OUT_MS,
  APP_INTRO_HOLD_MS,
  APP_INTRO_LOGO_WIDTH,
  APP_INTRO_SPRING_FRICTION,
  APP_INTRO_SPRING_TENSION,
  APP_INTRO_START_SCALE,
  getAppIntroLogoSize,
  getAppIntroTotalDurationMs
} from '../services/appIntroAnimation';
import { lightColors } from '../theme/colors';

const LOGO_SOURCE = require('../../assets/Synzapp-Nav.png');

/**
 * The first thing drawn on a cold start, before anything else is ready.
 *
 * Deliberately fixed in both themes. It is the brand's own ground rather than
 * the app's, the way an opening screen is fixed everywhere else, so it does not
 * read as two different products depending on a phone setting. That is why the
 * colours come from `lightColors` directly instead of the active theme.
 *
 * It keeps a pale corner at the top left and deepens to full red, which is what
 * gives the flat colour its light source. The status bar switches to white text
 * while this is up, because dark text on this ground cannot be read.
 *
 * `red` rather than `destructive` — this is a background, not a warning.
 *
 * It covers the screen rather than replacing it, so everything behind mounts
 * and loads while the logo is still animating.
 */
export function AppIntroScreen({ onFinished }: { onFinished: () => void }) {
  const logoSize = useMemo(() => getAppIntroLogoSize(APP_INTRO_LOGO_WIDTH), []);
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(APP_INTRO_START_SCALE)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          duration: APP_INTRO_FADE_IN_MS,
          toValue: 1,
          useNativeDriver: true
        }),
        // The bounce. A spring rather than a curve, so it overshoots once.
        Animated.spring(logoScale, {
          friction: APP_INTRO_SPRING_FRICTION,
          tension: APP_INTRO_SPRING_TENSION,
          toValue: 1,
          useNativeDriver: true
        })
      ]),
      Animated.delay(APP_INTRO_HOLD_MS),
      Animated.timing(screenOpacity, {
        duration: APP_INTRO_FADE_OUT_MS,
        toValue: 0,
        useNativeDriver: true
      })
    ]);

    /**
     * Leaves even if the animation never reports finishing.
     *
     * `start` calls back with finished false when something interrupts it —
     * backgrounding the app mid-launch is enough. Without this the intro would
     * stay up over a working app with no way past it.
     */
    const safetyTimer = setTimeout(onFinished, getAppIntroTotalDurationMs() + 400);

    animation.start(({ finished }) => {
      if (finished) {
        onFinished();
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      animation.stop();
    };
  }, [logoOpacity, logoScale, onFinished, screenOpacity]);

  return (
    <Animated.View style={[styles.screen, { opacity: screenOpacity }]}>
      <Svg height="100%" style={StyleSheet.absoluteFill} width="100%">
        <Defs>
          <LinearGradient id="synzappIntroWash" x1="0" x2="0.35" y1="0" y2="1">
            <Stop offset="0" stopColor={lightColors.redSoft} stopOpacity="1" />
            <Stop offset="0.35" stopColor={lightColors.red} stopOpacity="0.8" />
            <Stop offset="1" stopColor={lightColors.red} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect fill="url(#synzappIntroWash)" height="100%" width="100%" x="0" y="0" />
      </Svg>

      <View style={styles.logoWrap}>
        <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={LOGO_SOURCE}
            style={logoSize}
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: lightColors.redSoft
  },
  logoWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  }
});
