import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  consumeRateLimitWindow,
  getRateLimitDocumentId,
  getRetryAfterSeconds
} from '../src/middleware/rateLimitWindow.ts';

const NOW = 1_000_000;

describe('deciding a fixed window', () => {
  it('opens a window for a first request', () => {
    const decision = consumeRateLimitWindow(null, NOW, 60_000, 5);

    assert.equal(decision.allowed, true);
    assert.equal(decision.remaining, 4);
    assert.equal(decision.window.count, 1);
    assert.equal(decision.resetAt, NOW + 60_000);
  });

  it('allows up to the limit and refuses the one after', () => {
    const decision = consumeRateLimitWindow({ count: 5, resetAt: NOW + 1000 }, NOW, 60_000, 5);

    assert.equal(decision.allowed, false);
    assert.equal(decision.remaining, 0);
  });

  it('counts a refused request', () => {
    /**
     * Otherwise somebody held at the limit keeps trying for free, which is the
     * shape of attack the limit exists to slow.
     */
    const decision = consumeRateLimitWindow({ count: 9, resetAt: NOW + 1000 }, NOW, 60_000, 5);

    assert.equal(decision.window.count, 10);
  });

  it('replaces an expired window rather than extending it', () => {
    // The caller waited it out; carrying the count forward would punish that.
    const decision = consumeRateLimitWindow({ count: 99, resetAt: NOW - 1 }, NOW, 60_000, 5);

    assert.equal(decision.allowed, true);
    assert.equal(decision.window.count, 1);
    assert.equal(decision.resetAt, NOW + 60_000);
  });

  it('refuses everything when the limit is zero', () => {
    assert.equal(consumeRateLimitWindow(null, NOW, 60_000, 0).allowed, false);
  });

  it('never reports a retry of less than a second', () => {
    assert.equal(getRetryAfterSeconds(NOW + 10, NOW), 1);
    assert.equal(getRetryAfterSeconds(NOW + 4200, NOW), 5);
  });

  it('stores a hash of the key, never the key', () => {
    /**
     * Keys carry phone numbers and IP addresses. A counter is not a reason to
     * write one down somewhere new, so what is stored must not contain it.
     */
    const key = 'otp-preflight-ip:+15125550147';
    const id = getRateLimitDocumentId(key, (value) => createHash('sha256').update(value).digest('hex'));

    assert.equal(id.length, 64);
    assert.ok(!id.includes('5125550147'));
    assert.ok(!id.includes('otp'));
    // Same key, same document — or the count would never accumulate.
    assert.equal(id, getRateLimitDocumentId(key, (value) => createHash('sha256').update(value).digest('hex')));
  });
});
