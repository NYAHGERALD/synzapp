/**
 * Deciding a fixed-window rate limit.
 *
 * Separated from where the count is kept so the rules can be tested. The store
 * behind it is either a Map in one instance or a Firestore document shared by
 * all of them; neither changes what counts as over the limit.
 *
 * No Firestore import.
 */

export interface RateLimitWindow {
  count: number;
  resetAt: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  window: RateLimitWindow;
}

/**
 * The window after this request, and whether it was allowed.
 *
 * An expired window is replaced rather than extended: the caller waited out the
 * last one, and carrying its count forward would punish them for it.
 */
export function consumeRateLimitWindow(
  current: RateLimitWindow | null | undefined,
  nowMs: number,
  windowMs: number,
  max: number
): RateLimitDecision {
  if (!current || current.resetAt <= nowMs) {
    const resetAt = nowMs + windowMs;

    return {
      allowed: max > 0,
      remaining: Math.max(0, max - 1),
      resetAt,
      window: { count: 1, resetAt }
    };
  }

  const count = current.count + 1;

  /**
   * A refused request still counts.
   *
   * Otherwise somebody held at the limit can keep trying at no cost for the
   * rest of the window, which is the shape of attack the limit exists to slow.
   */
  return {
    allowed: count <= max,
    remaining: Math.max(0, max - count),
    resetAt: current.resetAt,
    window: { count, resetAt: current.resetAt }
  };
}

/** Seconds to report in Retry-After, never below one. */
export function getRetryAfterSeconds(resetAt: number, nowMs: number): number {
  return Math.max(1, Math.ceil((resetAt - nowMs) / 1000));
}

/**
 * A document id for a limit key.
 *
 * Keys carry phone numbers and IP addresses. Those are identifiers, and a
 * counter is not a reason to write one down in a new place — so the key is
 * hashed and the hash is what is stored.
 */
export function getRateLimitDocumentId(key: string, hash: (value: string) => string): string {
  return hash(key);
}
