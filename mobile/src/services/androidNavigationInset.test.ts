import { describe, expect, it } from 'vitest';
import {
  ANDROID_MAX_NAVIGATION_INSET,
  resolveAndroidNavigationInset
} from './androidNavigationInset';

/** A phone whose safe area reports nothing, so the fallback has to work. */
const silentPhone = {
  isKeyboardVisible: false,
  safeAreaBottom: 0,
  screenHeight: 2340,
  statusBarHeight: 40,
  tallestWindowHeight: 2252
};

describe('room for the Android navigation bar', () => {
  it('uses the safe area when the phone reports one', () => {
    expect(resolveAndroidNavigationInset({ ...silentPhone, safeAreaBottom: 48 })).toBe(48);
  });

  it('falls back to measuring only when the safe area reports nothing', () => {
    expect(resolveAndroidNavigationInset(silentPhone)).toBe(48);
  });

  it('returns nothing on a phone with no navigation bar', () => {
    expect(resolveAndroidNavigationInset({
      ...silentPhone,
      tallestWindowHeight: 2300
    })).toBe(0);
  });
});

describe('the band that used to appear after using the keyboard', () => {
  it('ignores a window that shrank for the keyboard, rather than measuring it', () => {
    // The live window height would give 1100 here. The tallest ever seen does
    // not move, so the answer stays the real navigation bar.
    expect(resolveAndroidNavigationInset({
      ...silentPhone,
      isKeyboardVisible: true,
      safeAreaBottom: 48
    })).toBe(48);
  });

  it('reports nothing rather than guessing while a keyboard is up', () => {
    expect(resolveAndroidNavigationInset({
      ...silentPhone,
      isKeyboardVisible: true
    })).toBe(0);
  });

  it('never turns a keyboard-sized safe area into a gap', () => {
    expect(resolveAndroidNavigationInset({
      ...silentPhone,
      safeAreaBottom: 900
    })).toBe(ANDROID_MAX_NAVIGATION_INSET);
  });

  it('never turns a keyboard-sized measurement into a gap', () => {
    expect(resolveAndroidNavigationInset({
      ...silentPhone,
      tallestWindowHeight: 1200
    })).toBe(ANDROID_MAX_NAVIGATION_INSET);
  });
});

describe('before anything has been measured', () => {
  it('reports nothing rather than a full screen height', () => {
    expect(resolveAndroidNavigationInset({
      ...silentPhone,
      tallestWindowHeight: 0
    })).toBe(0);
  });

  it('never returns a negative inset', () => {
    expect(resolveAndroidNavigationInset({
      ...silentPhone,
      tallestWindowHeight: 3000
    })).toBe(0);
  });
});
