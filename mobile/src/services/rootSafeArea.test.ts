import { describe, expect, it } from 'vitest';
import {
  resolveComposerBottomPadding,
  resolveKeyboardVerticalOffset,
  resolveScreenBottomInset
} from './rootSafeArea';

describe('resolveScreenBottomInset', () => {
  it('adds nothing on iOS, because the root SafeAreaView already did', () => {
    expect(
      resolveScreenBottomInset({ androidNavigationInset: 0, platform: 'ios' })
    ).toBe(0);
  });

  it('still adds nothing on iOS when a navigation inset is somehow supplied', () => {
    expect(
      resolveScreenBottomInset({ androidNavigationInset: 34, platform: 'ios' })
    ).toBe(0);
  });

  it('adds the navigation bar on Android, where nothing above has', () => {
    expect(
      resolveScreenBottomInset({ androidNavigationInset: 24, platform: 'android' })
    ).toBe(24);
  });

  it('never returns a negative inset', () => {
    expect(
      resolveScreenBottomInset({ androidNavigationInset: -8, platform: 'android' })
    ).toBe(0);
  });
});

describe('resolveComposerBottomPadding', () => {
  it('leaves an iPhone composer clear of the home indicator without doubling it', () => {
    // The root has already lifted the screen by 34. Adding it again is the
    // band this rule exists to prevent.
    expect(
      resolveComposerBottomPadding({
        isCompactAndroid: false,
        isKeyboardVisible: false,
        screenBottomInset: 0
      })
    ).toBe(12);
  });

  it('clears the Android gesture bar', () => {
    expect(
      resolveComposerBottomPadding({
        isCompactAndroid: false,
        isKeyboardVisible: false,
        screenBottomInset: 24
      })
    ).toBe(30);
  });

  it('clears a three button Android navigation bar', () => {
    expect(
      resolveComposerBottomPadding({
        isCompactAndroid: false,
        isKeyboardVisible: false,
        screenBottomInset: 48
      })
    ).toBe(54);
  });

  it('keeps a floor on a short Android screen that reports no inset', () => {
    expect(
      resolveComposerBottomPadding({
        isCompactAndroid: true,
        isKeyboardVisible: false,
        screenBottomInset: 0
      })
    ).toBe(10);
  });

  it('sits on the keyboard rather than above a system bar that is covered', () => {
    for (const screenBottomInset of [0, 24, 48]) {
      expect(
        resolveComposerBottomPadding({
          isCompactAndroid: false,
          isKeyboardVisible: true,
          screenBottomInset
        })
      ).toBe(6);
    }
  });
});

describe('resolveKeyboardVerticalOffset', () => {
  it('gives back the top inset the root consumed on iOS', () => {
    // Without this the thread thinks it ends 59 points higher than it does,
    // lifts the composer 59 short, and the keyboard covers it.
    expect(resolveKeyboardVerticalOffset({ platform: 'ios', safeAreaTop: 59 })).toBe(59);
  });

  it('needs nothing on Android, where the root pads nothing', () => {
    expect(resolveKeyboardVerticalOffset({ platform: 'android', safeAreaTop: 40 })).toBe(0);
  });

  it('is zero on an iPhone with no notch', () => {
    expect(resolveKeyboardVerticalOffset({ platform: 'ios', safeAreaTop: 0 })).toBe(0);
  });

  it('never returns a negative offset', () => {
    expect(resolveKeyboardVerticalOffset({ platform: 'ios', safeAreaTop: -10 })).toBe(0);
  });
});
