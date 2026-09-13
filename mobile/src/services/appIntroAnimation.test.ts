import { describe, expect, it } from 'vitest';

import {
  APP_INTRO_LOGO_WIDTH,
  APP_INTRO_START_SCALE,
  getAppIntroLogoSize,
  getAppIntroTotalDurationMs
} from './appIntroAnimation';

describe('the opening animation', () => {
  it('starts the logo smaller than full size, so there is something to grow from', () => {
    expect(APP_INTRO_START_SCALE).toBeGreaterThan(0);
    expect(APP_INTRO_START_SCALE).toBeLessThan(1);
  });

  it('keeps the logo file shape at the width it is drawn', () => {
    // The file is 150x132. A width that ignored that would stretch the mark.
    expect(getAppIntroLogoSize(150)).toEqual({ height: 132, width: 150 });
    expect(getAppIntroLogoSize(APP_INTRO_LOGO_WIDTH)).toEqual({ height: 97, width: 110 });
  });

  it('never returns a size that would collapse the logo', () => {
    expect(getAppIntroLogoSize(0).width).toBeGreaterThan(0);
    expect(getAppIntroLogoSize(-40).height).toBeGreaterThan(0);
  });

  it('stays short enough to read as an opening rather than a wait', () => {
    // The safety timer is built on this, so it has to cover the real sequence
    // without leaving somebody looking at a logo.
    const total = getAppIntroTotalDurationMs();

    expect(total).toBeGreaterThan(800);
    expect(total).toBeLessThan(2000);
  });
});
