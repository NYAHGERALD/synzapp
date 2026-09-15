import { describe, expect, it } from 'vitest';
import {
  APP_LOCK_BACKGROUND_GRACE_MS,
  APP_LOCK_MAX_ATTEMPTS,
  clearAppLockAttempts,
  getAppLockWaitMs,
  getRemainingWaitMs,
  isAppLockRequired,
  registerFailedPinAttempt,
  validateAppLockPin
} from './appLockPolicy';

const NOW = 1_700_000_000_000;

describe('choosing a PIN', () => {
  it('accepts six numbers', () => {
    expect(validateAppLockPin('428371').ok).toBe(true);
  });

  it('refuses anything that is not six numbers', () => {
    ['12345', '1234567', '', 'abcdef', '12 345', '12345a'].forEach((pin) => {
      expect(validateAppLockPin(pin).ok).toBe(false);
    });
  });

  it('refuses the same number repeated', () => {
    /**
     * With only a million possibilities, the handful of PINs people actually
     * choose are a real fraction of what anybody would try first.
     */
    expect(validateAppLockPin('000000').ok).toBe(false);
    expect(validateAppLockPin('777777').ok).toBe(false);
  });

  it('refuses a run of numbers in order, either way round', () => {
    expect(validateAppLockPin('123456').ok).toBe(false);
    expect(validateAppLockPin('654321').ok).toBe(false);
  });

  it('allows a PIN that merely contains a run', () => {
    // The rule is about the whole PIN, not a substring; being too strict here
    // just moves people towards writing it down.
    expect(validateAppLockPin('123450').ok).toBe(true);
  });

  it('explains a refusal in words somebody can act on', () => {
    expect(validateAppLockPin('12345').reason).toContain('6 numbers');
    expect(validateAppLockPin('000000').reason).toContain('same number');
  });
});

describe('getting it wrong', () => {
  it('costs nothing for the first few slips', () => {
    // A mistyped PIN is ordinary. Punishing the first one teaches people to
    // write the PIN down, which is worse than the risk.
    expect(getAppLockWaitMs(1)).toBe(0);
    expect(getAppLockWaitMs(3)).toBe(0);
  });

  it('starts a wait that doubles', () => {
    expect(getAppLockWaitMs(4)).toBe(5_000);
    expect(getAppLockWaitMs(5)).toBe(10_000);
    expect(getAppLockWaitMs(6)).toBe(20_000);
  });

  it('caps the wait so the screen never looks broken', () => {
    expect(getAppLockWaitMs(50)).toBe(300_000);
  });

  it('counts down to destroying the local copy', () => {
    /**
     * What makes the limit mean something. A wait alone is one somebody sits
     * out; the messages themselves are on the server and come back after a real
     * sign-in, so what is destroyed is the copy on a phone somebody else is
     * holding.
     */
    let state = { failedAttempts: 0, lockedUntilMs: null as number | null };
    let decision = registerFailedPinAttempt(state, NOW);

    expect(decision.destroyLocalData).toBe(false);
    expect(decision.remainingAttempts).toBe(APP_LOCK_MAX_ATTEMPTS - 1);

    for (let attempt = 1; attempt < APP_LOCK_MAX_ATTEMPTS; attempt += 1) {
      decision = registerFailedPinAttempt(decision.state, NOW);
    }

    expect(decision.destroyLocalData).toBe(true);
    expect(decision.remainingAttempts).toBe(0);
  });

  it('sets the moment the wait ends, rather than a duration to track', () => {
    const decision = registerFailedPinAttempt({ failedAttempts: 3, lockedUntilMs: null }, NOW);

    expect(decision.state.lockedUntilMs).toBe(NOW + 5_000);
    expect(getRemainingWaitMs(decision.state, NOW + 2_000)).toBe(3_000);
    expect(getRemainingWaitMs(decision.state, NOW + 9_000)).toBe(0);
  });

  it('forgets everything once the PIN is right, including a wait in progress', () => {
    const cleared = clearAppLockAttempts();

    expect(cleared.failedAttempts).toBe(0);
    expect(getRemainingWaitMs(cleared, NOW)).toBe(0);
  });
});

describe('when the PIN is asked for', () => {
  it('asks on every cold start', () => {
    expect(isAppLockRequired({
      backgroundedAtMs: null,
      hasPin: true,
      isColdStart: true,
      nowMs: NOW
    })).toBe(true);
  });

  it('does not ask for stepping out to the camera and straight back', () => {
    /**
     * A lock that fires every time somebody takes a photo of a broken guard is
     * one they turn off, and a lock nobody has on protects nothing.
     */
    expect(isAppLockRequired({
      backgroundedAtMs: NOW - 5_000,
      hasPin: true,
      isColdStart: false,
      nowMs: NOW
    })).toBe(false);
  });

  it('asks once the phone has been put down for a while', () => {
    expect(isAppLockRequired({
      backgroundedAtMs: NOW - APP_LOCK_BACKGROUND_GRACE_MS,
      hasPin: true,
      isColdStart: false,
      nowMs: NOW
    })).toBe(true);
  });

  it('asks nothing of somebody who has not set one up', () => {
    expect(isAppLockRequired({
      backgroundedAtMs: null,
      hasPin: false,
      isColdStart: true,
      nowMs: NOW
    })).toBe(false);
  });
});
