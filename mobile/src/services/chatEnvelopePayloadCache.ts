/**
 * Remembers envelopes that have already been decrypted.
 *
 * The server resends the recent envelopes with every realtime update, and a
 * single incoming message produces several updates — delivery receipts, read
 * receipts and presence all carry the same thread. Measured on a mid-range
 * Android phone: 103 receive events for one short conversation, each decrypting
 * all 14 envelopes at roughly 150ms apiece in pure-JS crypto. That is the five
 * seconds between a badge appearing and its message showing up.
 *
 * An envelope's ciphertext never changes, so decrypting it twice can only ever
 * produce the same answer. What *does* change is its delivery status, which is
 * envelope metadata rather than payload — so only the payload is cached, and the
 * message is rebuilt from the live envelope each time. Caching the assembled
 * message instead would freeze "Seen" forever.
 */

/** Bounded so a long-lived session cannot grow the cache without limit. */
const MAX_CACHED_PAYLOADS = 600;

/**
 * Marks an envelope this device has already failed to open.
 *
 * A failure is as repeatable as a success: the same ciphertext and the same
 * private key produce the same answer every time. Without recording it, every
 * realtime update re-attempts every unreadable envelope — and a failure is the
 * *most* expensive outcome, because it only concludes after trying every
 * candidate key. Measured on a freshly signed-in device: 26 unreadable envelopes
 * retried every few seconds, indefinitely.
 *
 * This is not a rare state. Every reinstall produces a device that cannot read
 * anything sent before it existed.
 */
const UNDECRYPTABLE = Symbol('undecryptable');

const payloadsByEnvelopeId = new Map<string, unknown>();

export function getCachedEnvelopePayload<T>(envelopeId: string): T | null {
  if (!envelopeId) {
    return null;
  }

  const payload = payloadsByEnvelopeId.get(envelopeId);

  if (payload === undefined || payload === UNDECRYPTABLE) {
    return null;
  }

  // Re-inserting marks it as recently used, so the eviction below drops the
  // envelopes nobody is looking at rather than the thread currently open.
  payloadsByEnvelopeId.delete(envelopeId);
  payloadsByEnvelopeId.set(envelopeId, payload);

  return payload as T;
}

export function setCachedEnvelopePayload(envelopeId: string, payload: unknown): void {
  if (!envelopeId || payload === null || payload === undefined) {
    return;
  }


  payloadsByEnvelopeId.delete(envelopeId);
  payloadsByEnvelopeId.set(envelopeId, payload);

  while (payloadsByEnvelopeId.size > MAX_CACHED_PAYLOADS) {
    const oldestEnvelopeId = payloadsByEnvelopeId.keys().next().value;

    if (oldestEnvelopeId === undefined) {
      break;
    }

    payloadsByEnvelopeId.delete(oldestEnvelopeId);
  }
}

/**
 * Whether this device has already established it cannot open an envelope.
 *
 * Cleared along with the rest of the cache when device identity changes, so a
 * device that later gains the key — through a backup restore — tries again
 * rather than being stuck reporting the message as unreadable forever.
 */
export function isKnownUndecryptableEnvelope(envelopeId: string): boolean {
  return Boolean(envelopeId) && payloadsByEnvelopeId.get(envelopeId) === UNDECRYPTABLE;
}

export function markUndecryptableEnvelope(envelopeId: string): void {
  if (!envelopeId) {
    return;
  }

  setCachedEnvelopePayload(envelopeId, UNDECRYPTABLE);
}

/** Dropped on sign-out, so one account's plaintext never outlives its session. */
export function clearCachedEnvelopePayloads(): void {
  payloadsByEnvelopeId.clear();
}

export function getCachedEnvelopePayloadCount(): number {
  return payloadsByEnvelopeId.size;
}
