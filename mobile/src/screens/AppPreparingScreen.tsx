import React, { useEffect, useMemo } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';

import {
  BRAND_GRADIENT_BASE_COLOR,
  BrandGradientBackground
} from '../components/BrandGradientBackground';
import { SpinningRing } from '../components/SpinningRing';
import {
  APP_PREPARING_DOT_COUNT,
  APP_PREPARING_DOT_DIM_OPACITY,
  APP_PREPARING_DOT_FADE_MS,
  APP_PREPARING_PHRASE,
  getPreparingDotLeadInMs,
  getPreparingDotTrailMs
} from '../services/appPreparingCopy';
import {
  APP_INTRO_LOGO_WIDTH,
  getAppIntroLogoSize
} from '../services/appIntroAnimation';
import { lightColors } from '../theme/colors';

const LOGO_SOURCE = require('../../assets/Synzapp-Nav.png');

/**
 * What is shown while the app gets itself ready.
 *
 * Same ground as the opening logo, so the launch reads as one screen settling
 * rather than two screens swapping. The logo does not re-animate: it has just
 * arrived, and replaying the bounce would draw the eye back to something that
 * has not changed.
 *
 * It covers the chat screen rather than delaying it, so the list underneath is
 * loading the whole time this is up. By the time it lifts, opening a
 * conversation reads from the local store and needs no network.
 */
export function AppPreparingScreen() {
  const logoSize = useMemo(() => getAppIntroLogoSize(APP_INTRO_LOGO_WIDTH), []);
  const dotOpacities = useMemo(
    () => Array.from(
      { length: APP_PREPARING_DOT_COUNT },
      () => new Animated.Value(APP_PREPARING_DOT_DIM_OPACITY)
    ),
    []
  );

  useEffect(() => {
    /**
     * A wave, not a blink.
     *
     * Each dot brightens in turn and waits out the others, so every loop is the
     * same length. Loops of different lengths drift apart and the wave decays
     * into three dots flickering independently.
     */
    const loops = dotOpacities.map((dot, index) => Animated.loop(
      Animated.sequence([
        Animated.delay(getPreparingDotLeadInMs(index)),
        Animated.timing(dot, {
          duration: APP_PREPARING_DOT_FADE_MS,
          isInteraction: false,
          toValue: 1,
          useNativeDriver: true
        }),
        Animated.timing(dot, {
          duration: APP_PREPARING_DOT_FADE_MS,
          isInteraction: false,
          toValue: APP_PREPARING_DOT_DIM_OPACITY,
          useNativeDriver: true
        }),
        Animated.delay(getPreparingDotTrailMs(index))
      ])
    ));

    loops.forEach((loop) => loop.start());

    return () => loops.forEach((loop) => loop.stop());
  }, [dotOpacities]);

  return (
    <View style={styles.screen}>
      <BrandGradientBackground />

      <View style={styles.body}>
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={LOGO_SOURCE}
          style={logoSize}
        />

        <View style={styles.ringWrap}>
          <SpinningRing />
        </View>

        <View
          accessibilityLabel={`${APP_PREPARING_PHRASE}…`}
          accessibilityRole="text"
          style={styles.phraseRow}
        >
          <Text style={styles.phrase}>{APP_PREPARING_PHRASE}</Text>
          {/* Drawn rather than typed, so the row's width never changes. */}
          {dotOpacities.map((dot, index) => (
            <Animated.Text key={index} style={[styles.phrase, styles.dot, { opacity: dot }]}>
              .
            </Animated.Text>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: BRAND_GRADIENT_BASE_COLOR,
    flex: 1
  },
  body: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  ringWrap: {
    marginTop: 36
  },
  phraseRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 22
  },
  phrase: {
    color: lightColors.mutedStrong,
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 0.2
  },
  dot: {
    // A dot is narrower than the space a letter leaves around it.
    marginLeft: 1
  }
});
