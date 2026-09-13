import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import {
  APP_PREPARING_RING_COUNTER_SPIN_MS,
  APP_PREPARING_RING_SPIN_MS
} from '../services/appPreparingCopy';
import { lightColors } from '../theme/colors';

const SIZE = 54;
const OUTER_STROKE = 3.5;
const INNER_STROKE = 2.5;
const OUTER_RADIUS = (SIZE - OUTER_STROKE) / 2;
const INNER_RADIUS = OUTER_RADIUS - 9;
const OUTER_CIRCUMFERENCE = 2 * Math.PI * OUTER_RADIUS;
const INNER_CIRCUMFERENCE = 2 * Math.PI * INNER_RADIUS;

/** A gap in the circle is what reads as motion. A full ring spinning looks still. */
const OUTER_ARC = 0.3;
const INNER_ARC = 0.18;

/**
 * Two arcs turning against each other.
 *
 * The whole `Svg` is rotated rather than the path inside it, so both arcs run
 * on the native driver and keep turning while JavaScript is busy — which, on
 * this screen, it always is. An indicator that stutters exactly when the app is
 * working hardest is worse than none, because it reads as a freeze.
 *
 * Opposing directions and periods that do not divide evenly mean the two arcs
 * never settle into a pattern; it does not visibly repeat.
 */
export function SpinningRing() {
  const spin = useRef(new Animated.Value(0)).current;
  const counterSpin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loops = [
      Animated.loop(Animated.timing(spin, {
        duration: APP_PREPARING_RING_SPIN_MS,
        easing: Easing.linear,
        isInteraction: false,
        toValue: 1,
        useNativeDriver: true
      })),
      Animated.loop(Animated.timing(counterSpin, {
        duration: APP_PREPARING_RING_COUNTER_SPIN_MS,
        easing: Easing.linear,
        isInteraction: false,
        toValue: 1,
        useNativeDriver: true
      }))
    ];

    loops.forEach((loop) => loop.start());

    return () => loops.forEach((loop) => loop.stop());
  }, [counterSpin, spin]);

  const outerStyle = useMemo(() => ({
    transform: [{
      rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
    }]
  }), [spin]);
  const innerStyle = useMemo(() => ({
    transform: [{
      rotate: counterSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] })
    }]
  }), [counterSpin]);

  return (
    <View accessibilityRole="progressbar" style={styles.ring}>
      {/* The track stays still; only the arcs above it turn. */}
      <Svg height={SIZE} style={StyleSheet.absoluteFill} width={SIZE}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          fill="none"
          r={OUTER_RADIUS}
          stroke={lightColors.blueSoft}
          strokeWidth={OUTER_STROKE}
        />
      </Svg>

      <Animated.View style={[StyleSheet.absoluteFill, outerStyle]}>
        <Svg height={SIZE} width={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            fill="none"
            r={OUTER_RADIUS}
            stroke={lightColors.link}
            strokeDasharray={`${OUTER_CIRCUMFERENCE * OUTER_ARC} ${OUTER_CIRCUMFERENCE * (1 - OUTER_ARC)}`}
            strokeLinecap="round"
            strokeWidth={OUTER_STROKE}
          />
        </Svg>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, innerStyle]}>
        <Svg height={SIZE} width={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            fill="none"
            opacity={0.45}
            r={INNER_RADIUS}
            stroke={lightColors.link}
            strokeDasharray={`${INNER_CIRCUMFERENCE * INNER_ARC} ${INNER_CIRCUMFERENCE * (1 - INNER_ARC)}`}
            strokeLinecap="round"
            strokeWidth={INNER_STROKE}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    height: SIZE,
    width: SIZE
  }
});
