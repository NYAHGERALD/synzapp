import Svg, { Circle, Path } from 'react-native-svg';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * The guided setup coach overlay.
 *
 * Lifted out of the chat screen unchanged.
 */

export type FooterTab = 'Actions' | 'Announcements' | 'Chats' | 'Calls' | 'Groups' | 'Employees' | 'Interpreter' | 'Library' | 'LSW' | 'Settings' | 'You';

type OrgAdminSetupCoachStepId = 'department' | 'role' | 'employee' | 'group' | 'chat-ready';

export type GuidedSetupTargetKind = 'floating-add' | 'header-options' | 'settings-tab' | 'employees-tab' | 'groups-tab' | 'chats-tab' | 'screen-center';

export interface GuidedSetupTargetRect {
  height: number;
  radius: number;
  width: number;
  x: number;
  y: number;
}

interface GuidedSetupHintLayout {
  height: number;
  placement: 'above' | 'below';
  width: number;
  x: number;
  y: number;
}

export interface OrgAdminSetupCoachStep {
  body: string;
  id: OrgAdminSetupCoachStepId;
  primaryLabel: string;
  progressLabel: string;
  targetKind: GuidedSetupTargetKind;
  title: string;
}

export function GuidedSetupCoachOverlay({
  bottomInset,
  footerTabs,
  isReduceMotionEnabled,
  onDismiss,
  onPrimaryAction,
  screenHeight,
  screenWidth,
  step,
  targetRect
}: {
  bottomInset: number;
  footerTabs: FooterTab[];
  isReduceMotionEnabled: boolean;
  onDismiss: () => void;
  onPrimaryAction: () => void;
  screenHeight: number;
  screenWidth: number;
  step: OrgAdminSetupCoachStep;
  targetRect: GuidedSetupTargetRect | null;
}) {
  const appTheme = useAppTheme();
  const pulse = useRef(new Animated.Value(0)).current;
  const activeTargetRect = targetRect || getGuidedSetupTargetRect(step.targetKind, {
    bottomInset,
    footerTabs,
    screenHeight,
    screenWidth
  });
  const spotlightRect = expandGuidedSetupTargetRect(activeTargetRect, {
    maxHeight: screenHeight,
    maxWidth: screenWidth,
    padding: 8
  });
  const hintLayout = getGuidedSetupHintLayout(spotlightRect, {
    bottomInset,
    screenHeight,
    screenWidth
  });
  const spotlightPath = getGuidedSetupSpotlightPath(spotlightRect, {
    screenHeight,
    screenWidth
  });
  const connectorPath = getGuidedSetupConnectorPath(hintLayout, spotlightRect);
  const connectorEnd = getGuidedSetupConnectorEnd(spotlightRect);
  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1.08]
  });
  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.46, 0.08]
  });
  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.02]
  });
  const dimColor = appTheme.isDark ? 'rgba(2, 6, 23, 0.36)' : 'rgba(15, 23, 42, 0.22)';
  const glassBackground = appTheme.isDark ? 'rgba(17, 24, 39, 0.64)' : 'rgba(255, 255, 255, 0.66)';
  const blurTint = appTheme.isDark ? 'dark' : 'light';

  useEffect(() => {
    if (isReduceMotionEnabled) {
      pulse.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 920,
          easing: Easing.out(Easing.cubic),
          isInteraction: false,
          toValue: 1,
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          duration: 180,
          easing: Easing.linear,
          isInteraction: false,
          toValue: 0,
          useNativeDriver: true
        })
      ])
    );

    loop.start();

    return () => loop.stop();
  }, [isReduceMotionEnabled, pulse]);

  return (
    <View pointerEvents="box-none" style={styles.guidedSetupOverlay}>
      <Svg
        height={screenHeight}
        pointerEvents="none"
        style={styles.guidedSetupScrimSvg}
        width={screenWidth}
      >
        <Path d={spotlightPath} fill={dimColor} fillRule="evenodd" />
      </Svg>
      <View
        pointerEvents="none"
        style={[
          styles.guidedSetupTarget,
          {
            borderColor: appTheme.colors.primary,
            borderRadius: spotlightRect.radius,
            height: spotlightRect.height,
            left: spotlightRect.x,
            shadowColor: appTheme.colors.primary,
            top: spotlightRect.y,
            width: spotlightRect.width
          }
        ]}
      >
        <Animated.View
          style={[
            styles.guidedSetupGlow,
            {
              backgroundColor: appTheme.colors.primary,
              borderRadius: spotlightRect.radius,
              opacity: isReduceMotionEnabled ? 0.14 : glowOpacity,
              transform: [{ scale }]
            }
          ]}
        />
        <Animated.View
          style={[
            styles.guidedSetupPulse,
            {
              borderColor: appTheme.colors.primary,
              borderRadius: spotlightRect.radius,
              opacity: isReduceMotionEnabled ? 0.34 : opacity,
              transform: [{ scale }]
            }
          ]}
        />
      </View>

      <Svg
        height={screenHeight}
        pointerEvents="none"
        style={styles.guidedSetupConnectorSvg}
        width={screenWidth}
      >
        <Path
          d={connectorPath}
          fill="none"
          stroke={appTheme.colors.primary}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={0.78}
          strokeWidth={2.2}
        />
        <Circle
          cx={connectorEnd.x}
          cy={connectorEnd.y}
          fill={appTheme.colors.primary}
          opacity={0.72}
          r={3.2}
        />
      </Svg>

      <BlurView
        intensity={appTheme.isDark ? 34 : 46}
        tint={blurTint}
        style={[
          styles.guidedSetupHint,
          {
            backgroundColor: glassBackground,
            borderColor: appTheme.isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.72)',
            left: hintLayout.x,
            top: hintLayout.y,
            width: hintLayout.width
          }
        ]}
      >
        <View style={styles.guidedSetupHintHeader}>
          <Text style={[styles.guidedSetupProgress, { color: appTheme.colors.primary }]}>{step.progressLabel}</Text>
          <Pressable accessibilityRole="button" onPress={onDismiss} style={({ pressed }) => [styles.guidedSetupSkipButton, pressed && styles.pressed]}>
            <Text style={[styles.guidedSetupSkipText, { color: appTheme.colors.mutedStrong }]}>Skip</Text>
          </Pressable>
        </View>
        <Text style={[styles.guidedSetupTitle, { color: appTheme.colors.ink }]}>{step.title}</Text>
        <Text style={[styles.guidedSetupBody, { color: appTheme.colors.mutedStrong }]}>{step.body}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onPrimaryAction}
          style={({ pressed }) => [
            styles.guidedSetupPrimaryButton,
            { backgroundColor: appTheme.colors.primary },
            pressed && styles.pressed
          ]}
        >
          <Text style={styles.guidedSetupPrimaryText}>{step.primaryLabel}</Text>
        </Pressable>
      </BlurView>
    </View>
  );
}

function getGuidedSetupTargetRect(
  targetKind: GuidedSetupTargetKind,
  input: {
    bottomInset: number;
    footerTabs: FooterTab[];
    screenHeight: number;
    screenWidth: number;
  }
): GuidedSetupTargetRect {
  if (targetKind === 'floating-add') {
    return {
      height: 74,
      radius: 37,
      width: 74,
      x: Math.max(input.screenWidth - 96, 20),
      y: Math.max(input.screenHeight - input.bottomInset - 188, 120)
    };
  }

  if (targetKind === 'header-options') {
    return {
      height: 58,
      radius: 29,
      width: 58,
      x: Math.max(input.screenWidth - 74, 16),
      y: 92
    };
  }

  const footerTop = input.screenHeight - input.bottomInset - 94;
  const tabWidth = Math.max(input.screenWidth - 32, 320) / Math.max(input.footerTabs.length, 1);
  const tabTargets: Partial<Record<GuidedSetupTargetKind, FooterTab>> = {
    'chats-tab': 'Chats',
    'employees-tab': 'Employees',
    'groups-tab': 'Groups',
    'settings-tab': 'Settings'
  };
  const targetTab = tabTargets[targetKind];
  const tabIndex = targetTab ? input.footerTabs.indexOf(targetTab) : -1;

  if (tabIndex >= 0) {
    return {
      height: 76,
      radius: 30,
      width: Math.min(tabWidth, 96),
      x: 16 + tabIndex * tabWidth + Math.max((tabWidth - Math.min(tabWidth, 96)) / 2, 0),
      y: footerTop
    };
  }

  return {
    height: 96,
    radius: 48,
    width: 196,
    x: Math.max((input.screenWidth - 196) / 2, 20),
    y: Math.max((input.screenHeight - 96) / 2, 160)
  };
}

function expandGuidedSetupTargetRect(
  rect: GuidedSetupTargetRect,
  input: { maxHeight: number; maxWidth: number; padding: number }
): GuidedSetupTargetRect {
  const x = Math.max(rect.x - input.padding, 0);
  const y = Math.max(rect.y - input.padding, 0);
  const right = Math.min(rect.x + rect.width + input.padding, input.maxWidth);
  const bottom = Math.min(rect.y + rect.height + input.padding, input.maxHeight);
  const width = Math.max(right - x, rect.width);
  const height = Math.max(bottom - y, rect.height);

  return {
    height,
    radius: Math.min(width, height) / 2,
    width,
    x,
    y
  };
}

function getGuidedSetupSpotlightPath(
  rect: GuidedSetupTargetRect,
  input: { screenHeight: number; screenWidth: number }
): string {
  const radius = Math.min(rect.radius, rect.width / 2, rect.height / 2);
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;

  return [
    `M0 0H${input.screenWidth}V${input.screenHeight}H0Z`,
    `M${rect.x + radius} ${rect.y}`,
    `H${right - radius}`,
    `Q${right} ${rect.y} ${right} ${rect.y + radius}`,
    `V${bottom - radius}`,
    `Q${right} ${bottom} ${right - radius} ${bottom}`,
    `H${rect.x + radius}`,
    `Q${rect.x} ${bottom} ${rect.x} ${bottom - radius}`,
    `V${rect.y + radius}`,
    `Q${rect.x} ${rect.y} ${rect.x + radius} ${rect.y}`,
    'Z'
  ].join(' ');
}

function getGuidedSetupHintLayout(
  targetRect: GuidedSetupTargetRect,
  input: {
    bottomInset: number;
    screenHeight: number;
    screenWidth: number;
  }
): GuidedSetupHintLayout {
  const horizontalMargin = 18;
  const verticalGap = 62;
  const estimatedHeight = 158;
  const width = Math.min(292, input.screenWidth - horizontalMargin * 2);
  const footerClearanceY = input.screenHeight - input.bottomInset - 116;
  const centeredX = targetRect.x + targetRect.width / 2 - width / 2;
  const x = Math.max(horizontalMargin, Math.min(centeredX, input.screenWidth - width - horizontalMargin));
  const spaceBelow = input.screenHeight - input.bottomInset - (targetRect.y + targetRect.height);
  const belowY = targetRect.y + targetRect.height + verticalGap;
  const aboveY = targetRect.y - estimatedHeight - verticalGap;

  if (spaceBelow >= estimatedHeight + verticalGap + 20 && belowY + estimatedHeight <= footerClearanceY) {
    return {
      height: estimatedHeight,
      placement: 'below',
      width,
      x,
      y: Math.max(72, belowY)
    };
  }

  return {
    height: estimatedHeight,
    placement: 'above',
    width,
    x,
    y: Math.max(72, Math.min(aboveY, footerClearanceY - estimatedHeight))
  };
}

function getGuidedSetupConnectorEnd(targetRect: GuidedSetupTargetRect): { x: number; y: number } {
  return {
    x: targetRect.x + targetRect.width / 2,
    y: targetRect.y + targetRect.height / 2
  };
}

function getGuidedSetupConnectorPath(
  hintLayout: GuidedSetupHintLayout,
  targetRect: GuidedSetupTargetRect
): string {
  const target = getGuidedSetupConnectorEnd(targetRect);
  const hintCenterX = hintLayout.x + hintLayout.width / 2;
  const isTargetRightOfHint = target.x >= hintCenterX;
  const startX = Math.max(
    hintLayout.x + 28,
    Math.min(target.x, hintLayout.x + hintLayout.width - 28)
  );
  const startY = hintLayout.placement === 'above'
    ? hintLayout.y + hintLayout.height
    : hintLayout.y;
  const endY = hintLayout.placement === 'above'
    ? targetRect.y + Math.max(targetRect.height * 0.28, 12)
    : targetRect.y + targetRect.height - Math.max(targetRect.height * 0.28, 12);
  const endX = target.x + (isTargetRightOfHint ? -targetRect.width * 0.22 : targetRect.width * 0.22);
  const verticalDirection = hintLayout.placement === 'above' ? 1 : -1;
  const controlY = startY + verticalDirection * Math.max(28, Math.abs(endY - startY) * 0.42);
  const controlXOffset = isTargetRightOfHint ? 36 : -36;

  return [
    `M${startX} ${startY}`,
    `C${startX} ${controlY} ${endX - controlXOffset} ${controlY} ${endX} ${endY}`
  ].join(' ');
}
