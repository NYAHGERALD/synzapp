import { NextFunction, Request, Response } from 'express';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message: string;
  keyPrefix: string;
  keyGenerator?: (req: Request) => string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function createRateLimiter(options: RateLimitOptions) {
  return function rateLimiter(req: Request, res: Response, next: NextFunction) {
    const key = `${options.keyPrefix}:${options.keyGenerator?.(req) || getClientIp(req)}`;
    const result = consumeRateLimit(key, options.windowMs, options.max);

    res.setHeader('RateLimit-Limit', String(options.max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, result.remaining)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

    if (!result.allowed) {
      res.status(429).json({
        error: options.message,
        retryAfterSeconds: Math.ceil((result.resetAt - Date.now()) / 1000)
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
    throw error;
  }

  return result;
}

export function getClientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
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
