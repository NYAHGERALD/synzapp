/**
 * How much room the Android navigation bar needs at the bottom of the screen.
 *
 * Kept here, away from the screen, so it can be tested. The rule it enforces
 * is small but the bug it prevents was not: an unclamped estimate measured the
 * keyboard instead of the navigation bar and pushed the tab bar and the
 * message composer hundreds of points up the screen.
 */

/**
 * The tallest an Android navigation bar ever is. Gesture navigation reports
 * about 24, three-button navigation about 48. Anything larger is not a
 * navigation bar.
 */
export const ANDROID_MAX_NAVIGATION_INSET = 64;

export function resolveAndroidNavigationInset(input: {
  /** What the safe area reports. Trusted first, and often 0 on Android. */
  safeAreaBottom: number;
  /** Full screen height, including system bars. */
  screenHeight: number;
  /**
   * The tallest the app's window has been seen, measured while no keyboard was
   * up. The live window height is useless here: it shrinks with the keyboard
   * and does not reliably grow back, which is what left a permanent band above
   * the navigation bar until the app was restarted.
   */
  tallestWindowHeight: number;
  statusBarHeight: number;
  isKeyboardVisible: boolean;
}): number {
  // Clamped whatever the source. A value larger than a navigation bar is not
  // a navigation bar, it is a keyboard that has been mistaken for one.
  const safeArea = Math.min(ANDROID_MAX_NAVIGATION_INSET, Math.max(0, input.safeAreaBottom));

  // The safe area is the real answer when it has one. The estimate below is
  // only a fallback for devices that report nothing.
  if (safeArea > 0) {
    return safeArea;
  }

  if (input.isKeyboardVisible || input.tallestWindowHeight <= 0) {
    return 0;
  }

  const difference = Math.round(
    input.screenHeight - input.tallestWindowHeight - input.statusBarHeight
  );

  return Math.min(ANDROID_MAX_NAVIGATION_INSET, Math.max(0, difference));
}
