import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearCachedEnvelopePayloads,
  isKnownUndecryptableEnvelope,
  markUndecryptableEnvelope,
  getCachedEnvelopePayload,
  getCachedEnvelopePayloadCount,
  setCachedEnvelopePayload
} from './chatEnvelopePayloadCache';

describe('chatEnvelopePayloadCache', () => {
  beforeEach(() => {
    clearCachedEnvelopePayloads();
  });

  it('returns a payload that was stored', () => {
    setCachedEnvelopePayload('env-1', { text: 'Hello', type: 'text' });

    expect(getCachedEnvelopePayload('env-1')).toEqual({ text: 'Hello', type: 'text' });
  });

  it('returns nothing for an envelope it has not seen', () => {
    expect(getCachedEnvelopePayload('env-unknown')).toBeNull();
  });

  it('ignores an empty envelope id', () => {
    setCachedEnvelopePayload('', { text: 'Hello' });

    expect(getCachedEnvelopePayloadCount()).toBe(0);
    expect(getCachedEnvelopePayload('')).toBeNull();
  });

  it('does not cache a failed decryption', () => {
    // A failure can become a success later, once the device has the key.
    setCachedEnvelopePayload('env-1', null);
    setCachedEnvelopePayload('env-2', undefined);

    expect(getCachedEnvelopePayloadCount()).toBe(0);
  });

  it('stays bounded over a long session', () => {
    for (let index = 0; index < 900; index += 1) {
      setCachedEnvelopePayload(`env-${index}`, { text: `m${index}` });
    }

    expect(getCachedEnvelopePayloadCount()).toBeLessThanOrEqual(600);
  });

  it('evicts the least recently used envelope, not the active thread', () => {
    for (let index = 0; index < 600; index += 1) {
      setCachedEnvelopePayload(`env-${index}`, { text: `m${index}` });
    }

    // Touch the oldest so it counts as recently used, then overflow by one.
    getCachedEnvelopePayload('env-0');
    setCachedEnvelopePayload('env-600', { text: 'newest' });

    expect(getCachedEnvelopePayload('env-0')).toEqual({ text: 'm0' });
    expect(getCachedEnvelopePayload('env-1')).toBeNull();
  });

  it('forgets everything when cleared', () => {
    setCachedEnvelopePayload('env-1', { text: 'Hello' });
    clearCachedEnvelopePayloads();

    expect(getCachedEnvelopePayload('env-1')).toBeNull();
  });
});

describe('undecryptable envelopes', () => {
  beforeEach(() => {
    clearCachedEnvelopePayloads();
  });

  it('remembers that an envelope could not be opened', () => {
    markUndecryptableEnvelope('env-1');

    // Without this, every realtime update re-attempts every unreadable
    // envelope — and failure is the most expensive outcome, because it only
    // concludes after trying every candidate key.
    expect(isKnownUndecryptableEnvelope('env-1')).toBe(true);
  });

  it('does not report an unseen envelope as undecryptable', () => {
    expect(isKnownUndecryptableEnvelope('env-unknown')).toBe(false);
  });

  it('never returns a payload for one marked undecryptable', () => {
    markUndecryptableEnvelope('env-1');

    expect(getCachedEnvelopePayload('env-1')).toBeNull();
  });

  it('does not treat a readable envelope as undecryptable', () => {
    setCachedEnvelopePayload('env-1', { text: 'Hello' });

    expect(isKnownUndecryptableEnvelope('env-1')).toBe(false);
  });

  it('forgets failures when cleared, so a restored key is retried', () => {
    markUndecryptableEnvelope('env-1');
    clearCachedEnvelopePayloads();

    // A backup restore can give this device the key it was missing; the message
    // must not stay marked unreadable forever.
    expect(isKnownUndecryptableEnvelope('env-1')).toBe(false);
  });

  it('ignores an empty envelope id', () => {
    markUndecryptableEnvelope('');

    expect(isKnownUndecryptableEnvelope('')).toBe(false);
  });
});
