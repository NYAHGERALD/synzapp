import { createHash } from 'node:crypto';
import { firestore } from '../config/firebaseAdmin.js';
import {
  consumeRateLimitWindow,
  getRateLimitDocumentId,
  type RateLimitDecision,
  type RateLimitWindow
} from './rateLimitWindow.js';

/**
 * A rate limit the whole service shares.
 *
 * The in-process limiter counts per instance. With three of them a stated
 * twelve a minute is really up to thirty-six, and the count resets whenever an
 * instance recycles — which is a brake on accidents, not a control anybody
 * could hold a customer to or show a security review.
 *
 * This one keeps the count in Firestore, so it holds across instances and
 * across restarts. It costs a transaction per request, which is why it is used
 * on the public unauthenticated surface — OTP preflight, session exchange, the
 * contact form — and not on authenticated reads that run hundreds a minute.
 *
 * Keys carry phone numbers and IP addresses, so what is stored is a hash of the
 * key rather than the key. A counter is not a reason to write an identifier
 * down somewhere new.
 */

const RATE_LIMIT_COLLECTION = 'apiRateLimits';

interface StoredWindow {
  count?: number;
  expiresAt?: FirebaseFirestore.Timestamp;
  resetAtMs?: number;
}

export async function consumeDurableRateLimit(
  key: string,
  windowMs: number,
  max: number
): Promise<RateLimitDecision> {
  const documentId = getRateLimitDocumentId(key, (value) =>
    createHash('sha256').update(value).digest('hex'));
  const reference = firestore.collection(RATE_LIMIT_COLLECTION).doc(documentId);
  const nowMs = Date.now();

  try {
    return await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const stored = snapshot.exists ? snapshot.data() as StoredWindow : null;
      const current: RateLimitWindow | null = stored && typeof stored.count === 'number' && typeof stored.resetAtMs === 'number'
        ? { count: stored.count, resetAt: stored.resetAtMs }
        : null;
      const decision = consumeRateLimitWindow(current, nowMs, windowMs, max);

      transaction.set(reference, {
        count: decision.window.count,
        /**
         * A TTL field, so Firestore removes these rather than the collection
         * growing one document per caller for ever. An hour past the window is
         * enough to survive clock skew between instances.
         */
        expiresAt: new Date(decision.window.resetAt + 60 * 60 * 1000),
        resetAtMs: decision.window.resetAt
      });

      return decision;
    });
  } catch (error) {
    /**
     * Allowed if the store cannot be reached.
     *
     * The in-process limiter in front of this has already had its say, so a
     * Firestore outage degrades to the old behaviour rather than locking every
     * customer out of signing in. Said out loud, because a rate limit that is
     * quietly not running is worth knowing about.
     */
    console.warn('Durable rate limit unavailable, falling back to in-process only:', error);

    return {
      allowed: true,
      remaining: max,
      resetAt: nowMs + windowMs,
      window: { count: 0, resetAt: nowMs + windowMs }
    };
  }
}
