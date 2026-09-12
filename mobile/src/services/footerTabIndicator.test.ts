import { describe, expect, it } from 'vitest';
import { resolveFooterIndicatorFrame } from './footerTabIndicator';

const bar = { barWidth: 350, horizontalPadding: 7, tabCount: 5 };

describe('resolveFooterIndicatorFrame', () => {
  it('splits the track between the tabs', () => {
    // 350 less 7 of padding on each side is 336, so each tab is 67.2 wide.
    expect(resolveFooterIndicatorFrame({ ...bar, activeIndex: 0 }))
      .toEqual({ left: 7, width: 67.2 });
  });

  it('steps one tab width along for each tab', () => {
    expect(resolveFooterIndicatorFrame({ ...bar, activeIndex: 2 }))
      .toEqual({ left: 7 + (67.2 * 2), width: 67.2 });
  });

  it('ends flush with the far edge of the track', () => {
    const frame = resolveFooterIndicatorFrame({ ...bar, activeIndex: 4 });

    expect(frame).not.toBeNull();
    expect((frame?.left ?? 0) + (frame?.width ?? 0)).toBeCloseTo(350 - 7);
  });

  it('draws nothing before the bar has been measured', () => {
    // A frame built from a width of 0 puts the highlight at the far left and
    // then slides it across the bar as soon as the real width lands.
    expect(resolveFooterIndicatorFrame({ ...bar, activeIndex: 0, barWidth: 0 })).toBeNull();
    expect(resolveFooterIndicatorFrame({ ...bar, activeIndex: 0, barWidth: Number.NaN })).toBeNull();
  });

  it('draws nothing when the tab is not one of the tabs shown', () => {
    // The footer hides tabs by role, so an index can outlive the tab it named.
    expect(resolveFooterIndicatorFrame({ ...bar, activeIndex: 5 })).toBeNull();
    expect(resolveFooterIndicatorFrame({ ...bar, activeIndex: -1 })).toBeNull();
  });

  it('draws nothing when there are no tabs, or no room for them', () => {
    expect(resolveFooterIndicatorFrame({ ...bar, activeIndex: 0, tabCount: 0 })).toBeNull();
    expect(resolveFooterIndicatorFrame({ ...bar, activeIndex: 0, barWidth: 10 })).toBeNull();
  });
});
