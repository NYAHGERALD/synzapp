/**
 * Reading the server's answer when another phone already holds chat.
 *
 * Registration is refused with a 409 that names the phone in the way. The app has
 * to tell those apart from any other failure, because one leads to a question
 * somebody can answer and the rest do not.
 *
 * Matched on a **code**, never on the wording. Deciding what an error means by
 * regex-matching its prose is how a revoked device ended up not recognising
 * itself and never wiping — the backend's message simply did not contain any of
 * the words the app was looking for.
 *
 * No native imports, so this can be tested.
 */

export const MOBILE_SEAT_HELD_CODE = 'MOBILE_SEAT_HELD';

export interface MobileSeatHolder {
  claimedAt: string | null;
  deviceId: string | null;
  platform: string | null;
}

export type MobileSeatHeldError = Error & {
  code: typeof MOBILE_SEAT_HELD_CODE;
  seat: MobileSeatHolder;
};

/** Whether a failed registration is the one a person can answer. */
export function isMobileSeatHeldError(error: unknown): error is MobileSeatHeldError {
  return Boolean(error) &&
    typeof error === 'object' &&
    (error as { code?: unknown }).code === MOBILE_SEAT_HELD_CODE;
}

/**
 * Builds that error from a response body, or returns null if it is anything else.
 *
 * Only a 409 carrying the code counts. A 409 without one is some other conflict
 * and must not be turned into a question about signing a phone out.
 */
export function readMobileSeatHeldError(input: {
  body: unknown;
  status: number;
}): MobileSeatHeldError | null {
  if (input.status !== 409) {
    return null;
  }

  const body = (input.body || {}) as {
    code?: unknown;
    details?: Record<string, unknown>;
    error?: unknown;
  };

  if (body.code !== MOBILE_SEAT_HELD_CODE) {
    return null;
  }

  const details = body.details || {};
  const message = typeof body.error === 'string' && body.error.trim()
    ? body.error
    : 'Chat is signed in on another phone.';

  return Object.assign(new Error(message), {
    code: MOBILE_SEAT_HELD_CODE as typeof MOBILE_SEAT_HELD_CODE,
    seat: {
      claimedAt: readText(details.claimedAt),
      deviceId: readText(details.deviceId),
      platform: readText(details.platform)
    }
  });
}

/**
 * How the other phone is described before somebody signs it out.
 *
 * Names the platform and when it was last claimed, and nothing more. There is no
 * honest way to say "this is the same handset you reinstalled" — the identifier
 * that would prove it is destroyed by the very reinstall — so the person is given
 * the facts and left to judge.
 */
export function describeMobileSeatHolder(seat: MobileSeatHolder, nowMs: number): string {
  const platform = describePlatform(seat.platform);
  const since = describeClaimedAt(seat.claimedAt, nowMs);

  return since ? `${platform}, signed in ${since}` : platform;
}

function describePlatform(platform: string | null): string {
  if (platform === 'ios') {
    return 'An iPhone';
  }

  if (platform === 'android') {
    return 'An Android phone';
  }

  return 'Another phone';
}

function describeClaimedAt(claimedAt: string | null, nowMs: number): string | null {
  if (!claimedAt) {
    return null;
  }

  const claimedAtMs = Date.parse(claimedAt);

  if (!Number.isFinite(claimedAtMs)) {
    return null;
  }

  const minutes = Math.floor((nowMs - claimedAtMs) / 60000);

  if (minutes < 1) {
    return 'just now';
  }

  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.floor(hours / 24);

  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function readText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
