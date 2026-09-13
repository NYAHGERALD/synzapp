import React, { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { lightColors } from '../theme/colors';

/**
 * The ground every brand screen stands on, defined once.
 *
 * White at the top washing down through a soft blue. Fixed light in both
 * themes: these screens are the brand's own, shown before the app proper, and
 * one that changed with a phone setting would read as a different product.
 *
 * The gradient id is per instance. Two of these can be mounted at once — the
 * opening logo sits over the preparing screen during a launch — and a shared id
 * is the kind of thing that works until the day it does not.
 */
export function BrandGradientBackground() {
  const gradientId = `synzappBrandWash-${useId()}`;

  return (
    <Svg height="100%" style={StyleSheet.absoluteFill} width="100%">
      <Defs>
        <LinearGradient id={gradientId} x1="0" x2="0.35" y1="0" y2="1">
          <Stop offset="0" stopColor={lightColors.groupedCard} stopOpacity="1" />
          <Stop offset="0.52" stopColor={lightColors.blueSoft} stopOpacity="0.55" />
          <Stop offset="1" stopColor={lightColors.link} stopOpacity="0.18" />
        </LinearGradient>
      </Defs>
      <Rect fill={`url(#${gradientId})`} height="100%" width="100%" x="0" y="0" />
    </Svg>
  );
}

/** What sits behind the wash, so a fade never reveals bare black. */
export const BRAND_GRADIENT_BASE_COLOR = lightColors.groupedCard;
