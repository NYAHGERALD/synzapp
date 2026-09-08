/**
 * What the app root's SafeAreaView has already paid for, and what each screen
 * therefore still owes.
 *
 * How much bottom inset a screen has to add for itself.
 *
 * The bottom safe area is consumed exactly **once**, at the app root, by React
 * Native's `SafeAreaView`. That component pads on iOS and does nothing at all
 * on Android, so the two platforms need opposite answers here:
 *
 * - **iOS: nothing.** The root has already moved every screen clear of the home
 *   indicator. A screen that adds `insets.bottom` again lays a second copy of
 *   it under the content. That is what left an empty band under the chat
 *   composer on iPhone while Android looked right: 34 from the root, then
 *   another 38 from the composer.
 * - **Android: the navigation bar inset**, because nothing above has allowed
 *   for it. Use the value from `resolveAndroidNavigationInset`, never a raw
 *   screen-minus-window measurement.
 *
 * The footer navigation bar has always obeyed this rule, which is why it sits
 * correctly on both: it clamps its offset to 6 on iOS rather than adding the
 * inset. Anything else that floats against the bottom of the screen should ask
 * this function rather than reading `insets.bottom`.
 */
export function resolveScreenBottomInset(input: {
  /** The resolved navigation bar height. Ignored off Android. */
  androidNavigationInset: number;
  platform: string;
}): number {
  if (input.platform !== 'android') {
    return 0;
  }

  return Math.max(0, input.androidNavigationInset);
}

/** How far the composer stays clear of whatever is below it. */
export const COMPOSER_BOTTOM_GAP = 6;

/**
 * The space under the message composer.
 *
 * With a keyboard up there is no system bar to clear, only the keyboard itself,
 * and the thread's `KeyboardAvoidingView` has already lifted the composer onto
 * it. All that is wanted then is a hair of breathing room.
 */
export function resolveComposerBottomPadding(input: {
  /** Short Android screens, where every point of the thread counts. */
  isCompactAndroid: boolean;
  isKeyboardVisible: boolean;
  /** From `resolveScreenBottomInset`, so it is 0 on iOS by design. */
  screenBottomInset: number;
}): number {
  if (input.isKeyboardVisible) {
    return COMPOSER_BOTTOM_GAP;
  }

  return Math.max(
    input.isCompactAndroid ? 10 : 12,
    input.screenBottomInset + COMPOSER_BOTTOM_GAP
  );
}

/**
 * What to pass a keyboard-avoiding view as `keyboardVerticalOffset`.
 *
 * `react-native-keyboard-controller` measures its own frame with `onLayout`,
 * which reports a position **relative to the parent**, and compares it against
 * an absolute screen height:
 *
 *     keyboardY = screenHeight - keyboardHeight - keyboardVerticalOffset
 *     padding   = max(frame.y + frame.height - keyboardY, 0)
 *
 * That only balances when the parent's own top-left is at the top of the
 * window. React Native's own `KeyboardAvoidingView` shares the limitation,
 * which is why its documentation says to put it at the root.
 *
 * The message thread is not at the root. On iOS the app root's `SafeAreaView`
 * pads the whole tree down by the top inset, and that offset is three levels
 * up, so `onLayout` never sees it. The view therefore believes it ends `top`
 * points higher than it really does, lifts the composer that much too little,
 * and the keyboard covers it. This puts the missing offset back.
 *
 * On Android `SafeAreaView` pads nothing, the top padding that does exist sits
 * on the thread's own parent and so *is* measured, and the answer is 0. That is
 * why Android needed no offset and iOS did.
 */
export function resolveKeyboardVerticalOffset(input: {
  platform: string;
  /** The top safe area the root consumed. Irrelevant off iOS. */
  safeAreaTop: number;
}): number {
  if (input.platform !== 'ios') {
    return 0;
  }

  return Math.max(0, input.safeAreaTop);
}
