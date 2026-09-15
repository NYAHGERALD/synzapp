/**
 * The six digit PIN that stands between an unattended phone and the chat on it.
 *
 * What this is actually for, said plainly, because it changes the design:
 *
 * The realistic threat is a handset left unlocked on a shift floor or a bench
 * for a few minutes. It is **not** an attacker who has extracted the keystore.
 * A six digit PIN is a million possibilities, and the app has no slow key
 * derivation available — `expo-crypto` offers SHA-256 and random bytes, not
 * scrypt or Argon2 — so anybody holding the raw keystore could try every PIN
 * faster than they could read this sentence. Claiming the PIN cryptographically
 * protects the chat database against that attacker would be a lie told in code.
 *
 * So the protection is arranged where it actually holds:
 *
 *   - Guessing is **online only**. The chat key stays where it already is, in
 *     the hardware backed keystore behind the device lock. The PIN gates the
 *     running app and the key material it holds in memory.
 *   - Guessing is **slow**. Failures cost an increasing wait, so a person
 *     trying PINs by hand gets nowhere.
 *   - Guessing is **finite**. Past a hard limit the local chat database is
 *     destroyed, which is what makes the limit meaningful rather than a delay
 *     somebody waits out. The messages are on the server and come back after a
 *     real sign-in; what is destroyed is the copy on a phone somebody else is
 *     holding.
 *
 * No native import, so all of this can be tested.
 */

/**
 * Six.
 *
 * Not because Teams asks for six — it does not. Teams inherits its PIN from an
 * Intune app protection policy, where the customer's IT administrator sets the
 * minimum length and the default is four. Six is this product's own choice: a
 * thousand times the search space of four, for one more digit.
 */
export const APP_LOCK_PIN_LENGTH = 6;

/**
 * Failures before the wait starts.
 *
 * Generous on purpose: a mistyped PIN is ordinary, and punishing the first slip
 * teaches people to write the PIN down.
 */
export const APP_LOCK_FREE_ATTEMPTS = 3;

/** Failures before the local chat database is destroyed. */
export const APP_LOCK_MAX_ATTEMPTS = 10;

/**
 * How long the app may sit in the background before it locks again.
 *
 * Long enough to take a photo, answer a call or check a work order and come
 * back; short enough that a phone put down on a bench locks itself.
 *
 * **Deliberately far shorter than Teams.** Intune's equivalent — recheck access
 * after N minutes of inactivity — defaults to around thirty minutes, which suits
 * a laptop bag. It does not suit a tablet shared between shifts, which is the
 * case this product has. A minute is the aggressive end of reasonable and is
 * worth revisiting if people complain; the number to move is this one, and
 * nothing else depends on it.
 */
export const APP_LOCK_BACKGROUND_GRACE_MS = 60_000;

export interface PinValidationResult {
  ok: boolean;
  reason: string | null;
}

/**
 * Whether this is a PIN somebody may set.
 *
 * The weak-pattern rules matter more here than they would for a password: with
 * only a million possibilities, the handful of PINs people actually choose are
 * a real fraction of the attempts anybody would try first.
 */
export function validateAppLockPin(pin: string): PinValidationResult {
  if (!new RegExp(`^[0-9]{${APP_LOCK_PIN_LENGTH}}$`).test(pin)) {
    return { ok: false, reason: `Your PIN is ${APP_LOCK_PIN_LENGTH} numbers.` };
  }

  if (isSameDigitRepeated(pin)) {
    return { ok: false, reason: 'Choose a PIN that is not the same number repeated.' };
  }

  if (isRunOfConsecutiveDigits(pin)) {
    return { ok: false, reason: 'Choose a PIN that is not a run of numbers in order.' };
  }

  return { ok: true, reason: null };
}

function isSameDigitRepeated(pin: string): boolean {
  return pin.split('').every((digit) => digit === pin[0]);
}

function isRunOfConsecutiveDigits(pin: string): boolean {
  const ascending = pin.split('').every((digit, index) =>
    index === 0 || Number(digit) === Number(pin[index - 1]) + 1);
  const descending = pin.split('').every((digit, index) =>
    index === 0 || Number(digit) === Number(pin[index - 1]) - 1);

  return ascending || descending;
}

export interface AppLockAttemptState {
  failedAttempts: number;
  /** When the current wait ends, or null when there is none. */
  lockedUntilMs: number | null;
}

export interface AppLockAttemptDecision {
  /** True once the local chat database must be destroyed. */
  destroyLocalData: boolean;
  /** Attempts left before that happens. */
  remainingAttempts: number;
  state: AppLockAttemptState;
  /** How long the person must wait, in milliseconds. Zero when they need not. */
  waitMs: number;
}

/**
 * The wait after a given number of failures.
 *
 * Doubling from five seconds: nothing for the first few slips, then 5, 10, 20,
 * 40 and so on, capped at five minutes. By the tenth failure somebody guessing
 * by hand has spent minutes to cover a vanishing fraction of a million.
 */
export function getAppLockWaitMs(failedAttempts: number): number {
  if (failedAttempts <= APP_LOCK_FREE_ATTEMPTS) {
    return 0;
  }

  const step = failedAttempts - APP_LOCK_FREE_ATTEMPTS - 1;

  return Math.min(5_000 * Math.pow(2, step), 300_000);
}

/** Records a wrong PIN and says what happens next. */
export function registerFailedPinAttempt(
  state: AppLockAttemptState,
  nowMs: number
): AppLockAttemptDecision {
  const failedAttempts = state.failedAttempts + 1;
  const waitMs = getAppLockWaitMs(failedAttempts);
  const destroyLocalData = failedAttempts >= APP_LOCK_MAX_ATTEMPTS;

  return {
    destroyLocalData,
    remainingAttempts: Math.max(0, APP_LOCK_MAX_ATTEMPTS - failedAttempts),
    state: {
      failedAttempts,
      lockedUntilMs: waitMs ? nowMs + waitMs : null
    },
    waitMs
  };
}

/** A correct PIN clears everything, including a wait already running. */
export function clearAppLockAttempts(): AppLockAttemptState {
  return { failedAttempts: 0, lockedUntilMs: null };
}

/** Milliseconds still to wait, or zero. */
export function getRemainingWaitMs(state: AppLockAttemptState, nowMs: number): number {
  if (!state.lockedUntilMs) {
    return 0;
  }

  return Math.max(0, state.lockedUntilMs - nowMs);
}

export interface AppLockRequirementInput {
  /** When the app last went to the background, or null if it has not. */
  backgroundedAtMs: number | null;
  /** False before anybody has set one up. */
  hasPin: boolean;
  isColdStart: boolean;
  nowMs: number;
}

/**
 * Whether the person has to enter their PIN now.
 *
 * A cold start always asks. Coming back from the background asks only past the
 * grace period, so stepping out to the camera and back does not turn the lock
 * into something people resent and switch off.
 */
export function isAppLockRequired(input: AppLockRequirementInput): boolean {
  if (!input.hasPin) {
    return false;
  }

  if (input.isColdStart) {
    return true;
  }

  if (input.backgroundedAtMs === null) {
    return false;
  }

  return input.nowMs - input.backgroundedAtMs >= APP_LOCK_BACKGROUND_GRACE_MS;
}
