import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readForwardedClientIp } from '../src/middleware/clientIp.ts';

describe('reading the client address from a header a caller can write', () => {
  it('takes the entry the platform appended, not the one the caller chose', () => {
    /**
     * Google's front end appends rather than replacing, so the first entry is
     * whatever the caller put there. Reading it made the audit log's IP column
     * attacker controlled, and let anybody walk past the per-IP rate limits by
     * sending a different fabrication each request.
     */
    assert.equal(
      readForwardedClientIp('10.0.0.1, 203.0.113.7, 35.191.0.1'),
      '203.0.113.7'
    );
  });

  it('ignores a whole fabricated list in front of the real address', () => {
    assert.equal(
      readForwardedClientIp('1.1.1.1, 2.2.2.2, 3.3.3.3, 203.0.113.7, 35.191.0.1'),
      '203.0.113.7'
    );
  });

  it('reads a header written entirely by infrastructure', () => {
    assert.equal(readForwardedClientIp('203.0.113.7, 35.191.0.1'), '203.0.113.7');
  });

  it('falls back to the first entry when the list is shorter than expected', () => {
    // Better the one address present than nothing at all.
    assert.equal(readForwardedClientIp('203.0.113.7'), '203.0.113.7');
  });

  it('says nothing rather than guessing when the header is empty', () => {
    // A wrong address recorded confidently is worse than an absent one,
    // because somebody will rely on it.
    assert.equal(readForwardedClientIp(''), null);
    assert.equal(readForwardedClientIp(undefined), null);
    assert.equal(readForwardedClientIp('  ,  ,  '), null);
  });

  it('handles the header arriving more than once', () => {
    assert.equal(
      readForwardedClientIp(['10.0.0.1', '203.0.113.7, 35.191.0.1']),
      '203.0.113.7'
    );
  });

  it('counts back further when more infrastructure sits in front', () => {
    // A load balancer in front of Cloud Run adds a hop, which is why the count
    // is a named constant rather than a -2 buried in an expression.
    assert.equal(
      readForwardedClientIp('10.0.0.1, 203.0.113.7, 130.211.0.1, 35.191.0.1', 2),
      '203.0.113.7'
    );
  });
});
