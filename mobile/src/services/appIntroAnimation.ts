/**
 * The shape of the opening animation, kept away from the component.
 *
 * The logo starts small, springs up to full size with one quick bounce, holds
 * for a beat and fades out. These are the numbers behind that, separated so
 * they can be tested and so the timing can be reasoned about without reading
 * the view — a component that imports `react-native` cannot be tested.
 *
 * No native imports.
 */

/** How small the logo starts, as a fraction of its full size. */
export const APP_INTRO_START_SCALE = 0.62;

export const APP_INTRO_FADE_IN_MS = 240;

/**
 * Low friction is what makes the bounce.
 *
 * A spring settling straight onto its target reads as a fade, not an arrival.
 * These two overshoot once and come back, which is the whole effect.
 */
export const APP_INTRO_SPRING_FRICTION = 4.2;
export const APP_INTRO_SPRING_TENSION = 92;

/** Long enough to read the logo, short enough not to feel like a wait. */
export const APP_INTRO_HOLD_MS = 380;

export const APP_INTRO_FADE_OUT_MS = 240;

/**
 * The logo file is 150x132. Whatever width is chosen, keep that shape.
 *
 * Drawn below the file's own 150 so it is downscaled rather than stretched —
 * an opening screen is the one place a soft edge on the mark is obvious.
 */
export const APP_INTRO_LOGO_WIDTH = 110;
const LOGO_SOURCE_WIDTH = 150;
const LOGO_SOURCE_HEIGHT = 132;

export function getAppIntroLogoSize(width: number): { height: number; width: number } {
  const safeWidth = Math.max(1, Math.round(width));

  return {
    height: Math.round(safeWidth * (LOGO_SOURCE_HEIGHT / LOGO_SOURCE_WIDTH)),
    width: safeWidth
  };
}

/**
 * How long the whole thing takes, spring included.
 *
 * The spring has no duration of its own, so it is estimated rather than known.
 * This exists for the safety timer that dismisses the intro even if the
 * animation never reports finishing — an opening screen that stays up is worse
 * than one that leaves a moment early.
 */
export const APP_INTRO_SPRING_ESTIMATE_MS = 620;

export function getAppIntroTotalDurationMs(): number {
  return Math.max(APP_INTRO_FADE_IN_MS, APP_INTRO_SPRING_ESTIMATE_MS) +
    APP_INTRO_HOLD_MS +
    APP_INTRO_FADE_OUT_MS;
}
