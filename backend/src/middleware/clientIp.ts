/**
 * Working out who a request actually came from.
 *
 * `X-Forwarded-For` is a list a client may start. Google's front end **appends**
 * to it rather than replacing it, so reading the first entry — which is what
 * this did — returns whatever the caller chose to put there.
 *
 * Two things were wrong with that, and the second is worse than the first:
 *
 *   - The audit log's IP column was attacker controlled. The one field that ties
 *     an action to a place was whatever the actor typed, and it is written into
 *     the auditor's CSV as evidence.
 *   - The per-IP rate limits could be walked straight past. A caller sending a
 *     different fabricated first entry each time got a fresh bucket every
 *     request, which is the opposite of a limit.
 *
 * So the address is read from the end of the list, where the platform writes,
 * not the beginning, where the caller does.
 *
 * Pure, so the parsing can be tested without a server or a deploy.
 */

/**
 * Entries appended by infrastructure in front of this service.
 *
 * One, for the Google front end that terminates TLS for Cloud Run. Put a load
 * balancer in front (see the edge security plan) and this becomes two — which is
 * exactly why it is a named constant rather than a `-2` buried in an expression.
 */
export const TRUSTED_PROXY_HOPS = 1;

/**
 * The client address, or null when the header says nothing usable.
 *
 * Returns null rather than guessing. A wrong address recorded confidently is
 * worse than an absent one, because somebody will rely on it.
 */
export function readForwardedClientIp(
  forwardedFor: string | string[] | undefined,
  trustedProxyHops = TRUSTED_PROXY_HOPS
): string | null {
  const header = Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor;
  const entries = (header || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!entries.length) {
    return null;
  }

  /**
   * Counting back from the end. The last entries are the ones the platform
   * appended and the only ones a caller cannot choose.
   *
   * When the list is shorter than the hops expected, the whole thing was
   * written by infrastructure and the first entry is the client.
   */
  const index = entries.length - 1 - trustedProxyHops;

  return entries[Math.max(0, index)] || null;
}
