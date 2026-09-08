import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import {
  buildMediaTransferProgressKey,
  getMediaTransferProgress,
  resolveMediaTransferState,
  subscribeMediaTransferProgress,
  type MediaTransferProgressState
} from '../services/chatMediaTransferProgress';
import type { ChatMediaAttachment } from '../services/chatApi';

const RING_SIZE = 46;
const RING_THICKNESS = 3;
const RING_RADIUS = (RING_SIZE - RING_THICKNESS) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * Circular transfer indicator drawn over a photo or video bubble.
 *
 * It reflects the real transfer. The arc is set directly from the measured
 * progress rather than tweened toward it, so the ring never runs ahead of what
 * has actually been sent or received, and no animation frame work is spent on
 * the JavaScript thread while several transfers are in flight.
 *
 * Smoothness comes from the transfer reporting often, not from inventing motion
 * between reports.
 */
export function MediaTransferRing({
  media,
  mediaIndex,
  messageId,
  tint = '#FFFFFF'
}: {
  media: Pick<ChatMediaAttachment, 'localUri' | 'transferProgress' | 'transferStatus'>;
  mediaIndex?: number;
  messageId: string;
  tint?: string;
}) {
  const progressKey = buildMediaTransferProgressKey(messageId, mediaIndex);
  const [liveState, setLiveState] = useState<MediaTransferProgressState | null>(
    () => getMediaTransferProgress(progressKey)
  );

  useEffect(() => {
    setLiveState(getMediaTransferProgress(progressKey));

    return subscribeMediaTransferProgress(progressKey, setLiveState);
  }, [progressKey]);

  const transferState = resolveMediaTransferState(media, liveState);

  if (!transferState) {
    return null;
  }

  return (
    <MediaTransferRingContent
      progress={transferState.progress}
      status={transferState.status}
      tint={tint}
    />
  );
}

// Split out so the spinner animation only exists while something is on screen.
function MediaTransferRingContent({
  progress,
  status,
  tint
}: {
  progress: number;
  status: MediaTransferProgressState['status'];
  tint: string;
}) {
  const spin = useRef(new Animated.Value(0)).current;
  const isFailed = status === 'failed';
  // Spin only until there is something real to show. Compressing a large video
  // is the longest part of sending it, and it does report progress - leaving
  // that as an anonymous spinner is what makes a send look stalled.
  const isIndeterminate = !isFailed && progress <= 0;
  const percent = Math.round(progress * 100);

  useEffect(() => {
    if (!isIndeterminate) {
      spin.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(spin, {
        duration: 1000,
        easing: Easing.linear,
        // Decorative: must not hold an interaction handle, or it starves
        // InteractionManager and delays queued work such as sending a message.
        isInteraction: false,
        toValue: 1,
        useNativeDriver: true
      })
    );

    loop.start();

    return () => loop.stop();
  }, [isIndeterminate, spin]);

  const spinRotation = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });
  // A short fixed arc while indeterminate; the measured sweep otherwise.
  const dashLength = isIndeterminate
    ? RING_CIRCUMFERENCE * 0.28
    : RING_CIRCUMFERENCE * Math.min(Math.max(progress, 0), 1);

  return (
    <View pointerEvents="none" style={styles.container}>
      <View style={styles.scrim} />

      <Animated.View
        style={[
          styles.ring,
          isIndeterminate ? { transform: [{ rotate: spinRotation }] } : null
        ]}
      >
        <Svg height={RING_SIZE} width={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            fill="none"
            opacity={0.3}
            r={RING_RADIUS}
            stroke={tint}
            strokeWidth={RING_THICKNESS}
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            fill="none"
            r={RING_RADIUS}
            stroke={isFailed ? '#FCA5A5' : tint}
            strokeDasharray={`${dashLength} ${RING_CIRCUMFERENCE}`}
            strokeLinecap="round"
            strokeWidth={RING_THICKNESS}
            // Start the sweep at twelve o'clock rather than three.
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </Svg>
      </Animated.View>

      {isFailed ? (
        <Text style={[styles.label, { color: '#FCA5A5' }]}>Retry</Text>
      ) : !isIndeterminate ? (
        <Text style={[styles.percent, { color: tint }]}>{percent}%</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    position: 'absolute'
  },
  percent: {
    fontSize: 11,
    // Keeps the number from shifting as digits change width.
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    position: 'absolute'
  },
  ring: {
    height: RING_SIZE,
    width: RING_SIZE
  },
  scrim: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    borderRadius: 999,
    height: RING_SIZE + 16,
    position: 'absolute',
    width: RING_SIZE + 16
  }
});
