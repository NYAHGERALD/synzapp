import { timingSafeEqual } from 'node:crypto';

/**
 * The shared secret that lets the service call its own scheduled jobs.
 *
 * What it authorises is worth stating plainly: running retention across **every
 * tenant**, and packaging a compliance export — a readable archive of a
 * company's chat history — for any tenant id supplied in the request body. One
 * string, held by whatever calls the job.
 *
 * Two things were missing rather than wrong. The comparison was already
 * constant-time and already failed closed when unset, which is the part most
 * people get wrong.
 *
 *   - **No way to rotate it.** A single value read from one variable means
 *     changing it is a flag day: the moment the new secret is set, anything
 *     still sending the old one fails. So it never gets rotated, which is how a
 *     static secret becomes a permanent one.
 *   - **No record of its use.** Nothing was written when the secret was
 *     accepted, and nothing when it was refused — so cross-tenant destruction
 *     ran with no trace of who asked, and somebody guessing at the header left
 *     none either.
 *
 * Rotation is why this takes a list. The newest value is the one to move to; the
 * rest are accepted while callers catch up, and which one matched is reported so
 * "rotation is finished" is a thing somebody can actually know rather than
 * assume.
 *
 * Pure, so the rules can be tested without a server or a real secret.
 */

export type SchedulerSecretMatch = 'current' | 'previous';

export interface SchedulerSecretDecision {
  allowed: boolean;
  /** Which configured value matched, so an unfinished rotation is visible. */
  matched: SchedulerSecretMatch | null;
  reason: string | null;
}

/**
 * The configured secrets, newest first.
 *
 * Comma separated so one variable can hold a rotation in progress. Duplicates
 * are dropped, because the same value appearing twice would report as a
 * previous secret and make a finished rotation look unfinished for ever.
 */
export function readSchedulerSecrets(raw?: string | null): string[] {
  const seen = new Set<string>();

  return (raw || '')
    .split(',')
    .map((secret) => secret.trim())
    .filter((secret) => {
      if (!secret || seen.has(secret)) {
        return false;
      }

      seen.add(secret);

      return true;
    });
}

export function checkSchedulerSecret(
  provided: string,
  configured: string[]
): SchedulerSecretDecision {
  if (!configured.length) {
    /**
     * Fails closed. An unprotected job that packages other people's messages is
     * worse than a job that does not run, because the second is noticed and the
     * first is not.
     */
    return { allowed: false, matched: null, reason: 'NOT_CONFIGURED' };
  }

  const candidate = (provided || '').trim();

  if (!candidate) {
    return { allowed: false, matched: null, reason: 'MISSING' };
  }

  for (let index = 0; index < configured.length; index += 1) {
    if (equalInConstantTime(candidate, configured[index])) {
      return {
        allowed: true,
        matched: index === 0 ? 'current' : 'previous',
        reason: null
      };
    }
  }

  return { allowed: false, matched: null, reason: 'MISMATCH' };
}

function equalInConstantTime(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');

  /**
   * A length check first is unavoidable — `timingSafeEqual` throws on a
   * mismatch — and it leaks only the length, which a caller choosing the input
   * already knows.
   */
  if (providedBytes.length !== expectedBytes.length) {
    return false;
  }

  return timingSafeEqual(providedBytes, expectedBytes);
}
