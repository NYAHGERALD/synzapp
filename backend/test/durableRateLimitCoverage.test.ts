import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const read = (...parts: string[]) => readFileSync(resolve(backendRoot, ...parts), 'utf8');

const rateLimit = read('src', 'middleware', 'rateLimit.ts');
const authSessionService = read('src', 'services', 'authSessionService.ts');
const authRoutes = read('src', 'routes', 'authRoutes.ts');

describe('the limits that guard signing in are counted across instances', () => {
  it('counts a session attempt in the shared store', () => {
    /**
     * Held in a module-level Map, the effective limit is whatever was
     * configured multiplied by however many instances happen to be running —
     * and that number rises under load, which is when a limit matters. A caller
     * can also simply be routed to a fresh instance and start again.
     */
    assert.match(authSessionService, /assertDurableRateLimit\(\s*`session:uid:/);
    assert.match(authSessionService, /assertDurableRateLimit\(\s*`session:phone:/);
  });

  it('counts a code request per phone number in the shared store', () => {
    /**
     * The route's own limiter is keyed on the caller's address, so it does not
     * stop one number being targeted from many of them. This is the limit that
     * does.
     */
    assert.match(authSessionService, /assertDurableRateLimit\(\s*`otp:phone:/);
  });

  it('still asks the free local count first', () => {
    // Somebody already over the limit on this instance is refused without a
    // Firestore round trip; the shared count is only asked when the local one
    // would have let them through.
    assert.match(rateLimit, /local\.allowed\s*\n?\s*\?\s*await consumeDurableRateLimit/);
  });

  it('keeps every route limiter durable', () => {
    const limiters = authRoutes.match(/createRateLimiter\(\{/g) || [];
    const durable = authRoutes.match(/durable: true/g) || [];

    assert.ok(limiters.length > 0, 'Expected auth route limiters to be present.');
    assert.equal(durable.length, limiters.length, 'Every auth route limiter must be durable.');
  });

  it('leaves the synchronous assertion alone for the modules that cannot change', () => {
    /**
     * `assertRateLimit` is called from the interpreter in a dozen places.
     * Turning it async would mean editing a shipped module this work does not
     * touch, so the durable version is a sibling rather than a replacement —
     * and those interpreter limits stay per-instance, recorded as such.
     */
    assert.match(rateLimit, /export function assertRateLimit/);
    assert.match(rateLimit, /export async function assertDurableRateLimit/);
  });
});
