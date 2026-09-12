/**
 * Where the moving highlight sits behind the footer tabs.
 *
 * The tabs share the bar equally, so their positions are arithmetic rather
 * than something to measure one by one. Kept here, away from the component, so
 * the sums can be tested — an indicator that lands half a tab off is the kind
 * of thing that only shows up on a device.
 */

export interface FooterIndicatorFrame {
  left: number;
  width: number;
}

export function resolveFooterIndicatorFrame(input: {
  activeIndex: number;
  /** The bar's full measured width, including its own padding. */
  barWidth: number;
  horizontalPadding: number;
  tabCount: number;
}): FooterIndicatorFrame | null {
  const { activeIndex, barWidth, horizontalPadding, tabCount } = input;

  /**
   * Nothing rather than a guess.
   *
   * Before the first layout the width is 0, and a frame built from that would
   * put the highlight at the far left and then slide it across the bar the
   * moment the real width arrived. The pill is simply not drawn until there is
   * something true to draw it from.
   */
  if (!Number.isFinite(barWidth) || barWidth <= 0) {
    return null;
  }

  if (!Number.isInteger(tabCount) || tabCount <= 0) {
    return null;
  }

  if (!Number.isInteger(activeIndex) || activeIndex < 0 || activeIndex >= tabCount) {
    return null;
  }

  const padding = Math.max(0, horizontalPadding);
  const trackWidth = barWidth - (padding * 2);

  if (trackWidth <= 0) {
    return null;
  }

  const width = trackWidth / tabCount;

  return {
    left: padding + (width * activeIndex),
    width
  };
}
