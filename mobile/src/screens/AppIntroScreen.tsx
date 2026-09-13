import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';

import {
  BRAND_GRADIENT_BASE_COLOR,
  BrandGradientBackground
} from '../components/BrandGradientBackground';
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

const LOGO_SOURCE = require('../../assets/Synzapp-Nav.png');

/**
 * The first thing drawn on a cold start, before anything else is ready.
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
      <BrandGradientBackground />

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
    backgroundColor: BRAND_GRADIENT_BASE_COLOR
  },
  logoWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  }
});
