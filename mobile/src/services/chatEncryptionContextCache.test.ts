import { describe, expect, it, vi } from 'vitest';

/**
 * Every send needed recipient device keys before it could encrypt, and fetching
 * them was a network round trip *before* the one that delivers the message.
 * Caching removes it — but a stale entry means a newly registered device cannot
 * decrypt, so the rules around the cache matter more than the cache.
 */
describe('encryption context cache rules', () => {
  const TTL_MS = 30_000;

  function makeCache() {
    const entries = new Map<string, { context: string; expiresAtMs: number }>();
    let fetches = 0;

    return {
      clear(key?: string) {
        if (key) {
          entries.delete(key);
        } else {
          entries.clear();
        }
      },
      fetchCount: () => fetches,
      async get(key: string, now: number) {
        const cached = entries.get(key);

        if (cached && cached.expiresAtMs > now) {
          return cached.context;
        }

        fetches += 1;
        const context = `context-for-${key}`;
        entries.set(key, { context, expiresAtMs: now + TTL_MS });

        return context;
      }
    };
  }

  it('fetches once for messages sent back to back', async () => {
    const cache = makeCache();

    await cache.get('DIRECT:contact-1', 0);
    await cache.get('DIRECT:contact-1', 1_000);
    await cache.get('DIRECT:contact-1', 2_000);

    expect(cache.fetchCount()).toBe(1);
  });

  it('refetches once the entry expires, so new devices are picked up', async () => {
    const cache = makeCache();

    await cache.get('DIRECT:contact-1', 0);
    await cache.get('DIRECT:contact-1', TTL_MS + 1);

    expect(cache.fetchCount()).toBe(2);
  });

  it('keeps conversations separate', async () => {
    const cache = makeCache();

    await cache.get('DIRECT:contact-1', 0);
    await cache.get('DIRECT:contact-2', 0);

    expect(cache.fetchCount()).toBe(2);
  });

  it('separates a direct chat from a group with the same id', async () => {
    const cache = makeCache();

    await cache.get('DIRECT:id-1', 0);
    await cache.get('GROUP:id-1', 0);

    expect(cache.fetchCount()).toBe(2);
  });

  it('refetches after a failure clears the entry', async () => {
    const cache = makeCache();

    await cache.get('DIRECT:contact-1', 0);
    cache.clear('DIRECT:contact-1');
    await cache.get('DIRECT:contact-1', 1_000);

    expect(cache.fetchCount()).toBe(2);
  });
});
