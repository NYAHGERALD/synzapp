import { NextFunction, Request, Response } from 'express';
import { readForwardedClientIp } from './clientIp.js';
import { consumeDurableRateLimit } from './durableRateLimit.js';
import { getRetryAfterSeconds } from './rateLimitWindow.js';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message: string;
  keyPrefix: string;
  keyGenerator?: (req: Request) => string;
  /**
   * Count this limit across every instance, not just this one.
   *
   * For the public unauthenticated routes, where a per-instance counter is
   * least defensible and the volume is low enough that a transaction per
   * request costs nothing worth saving.
   */
  durable?: boolean;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function createRateLimiter(options: RateLimitOptions) {
  return async function rateLimiter(req: Request, res: Response, next: NextFunction) {
    const key = `${options.keyPrefix}:${options.keyGenerator?.(req) || getClientIp(req)}`;
    /**
     * The local count first, always.
     *
     * It is free, and a caller already over the limit on this instance is
     * refused without a Firestore round trip. The shared count is only asked
     * when the local one would have let the request through.
     */
    let result = consumeRateLimit(key, options.windowMs, options.max);

    if (result.allowed && options.durable) {
      result = await consumeDurableRateLimit(key, options.windowMs, options.max);
    }

    res.setHeader('RateLimit-Limit', String(options.max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, result.remaining)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

    if (!result.allowed) {
      const retryAfterSeconds = getRetryAfterSeconds(result.resetAt, Date.now());

      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        error: options.message,
        retryAfterSeconds
      });
      return;
    }

    next();
  };
}

export function assertRateLimit(key: string, windowMs: number, max: number) {
  const result = consumeRateLimit(key, windowMs, max);

  if (!result.allowed) {
    const retryAfterSeconds = Math.ceil((result.resetAt - Date.now()) / 1000);
    const error = new Error(`Too many attempts. Try again in ${retryAfterSeconds} seconds.`);
    error.name = 'RateLimitError';
    (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds = retryAfterSeconds;
    throw error;
  }

  return result;
}

/**
 * The same assertion, counted across every instance.
 *
 * `assertRateLimit` holds its counts in a module-level Map, so on Cloud Run the
 * effective limit is whatever was configured multiplied by however many
 * instances happen to be running — and it rises exactly when a service is under
 * load, which is when a limit matters. A caller can also simply be routed to a
 * fresh instance and start again.
 *
 * Kept separate rather than making `assertRateLimit` durable, because that
 * function is synchronous and is called from the interpreter in a dozen places;
 * turning it async would mean editing a shipped module this work does not touch.
 *
 * The local count is still consulted first. It is free, and somebody already
 * over the limit on this instance is refused without a Firestore round trip —
 * the shared count is only asked when the local one would have let them through.
 */
export async function assertDurableRateLimit(key: string, windowMs: number, max: number) {
  const local = consumeRateLimit(key, windowMs, max);
  const result = local.allowed
    ? await consumeDurableRateLimit(key, windowMs, max)
    : local;

  if (!result.allowed) {
    const retryAfterSeconds = Math.ceil((result.resetAt - Date.now()) / 1000);
    const error = new Error(`Too many attempts. Try again in ${retryAfterSeconds} seconds.`);

    error.name = 'RateLimitError';
    (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds = retryAfterSeconds;

    throw error;
  }

  return result;
}

export function getClientIp(req: Request): string {
  // From the end of the list, where the platform writes, not the beginning,
  // where the caller does. See clientIp.ts for what that was costing.
  const forwarded = readForwardedClientIp(req.headers['x-forwarded-for']);

  return forwarded || req.ip || req.socket.remoteAddress || 'unknown';
}

function consumeRateLimit(key: string, windowMs: number, max: number) {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });

    return {
      allowed: true,
      remaining: max - 1,
      resetAt
    };
  }

  existing.count += 1;

  return {
    allowed: existing.count <= max,
    remaining: max - existing.count,
    resetAt: existing.resetAt
  };
}
