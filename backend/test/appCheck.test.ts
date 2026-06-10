import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { verifyAppCheckToken } from '../src/middleware/appCheck.ts';

describe('App Check enforcement', () => {
  it('allows missing token while enforcement is disabled', async () => {
    const result = await verifyAppCheckToken({
      requireAppCheck: false,
      verifyToken: async () => undefined
    });

    assert.deepEqual(result, { ok: true });
  });

  it('rejects missing token while enforcement is enabled', async () => {
    const result = await verifyAppCheckToken({
      requireAppCheck: true,
      verifyToken: async () => undefined
    });

    assert.deepEqual(result, {
      error: 'App verification is required.',
      ok: false
    });
  });

  it('rejects invalid App Check tokens', async () => {
    const result = await verifyAppCheckToken({
      requireAppCheck: true,
      token: 'invalid-token',
      verifyToken: async () => {
        throw new Error('invalid app check token');
      }
    });

    assert.deepEqual(result, {
      error: 'App verification failed.',
      ok: false
    });
  });

  it('allows valid App Check tokens', async () => {
    const result = await verifyAppCheckToken({
      requireAppCheck: true,
      token: 'valid-token',
      verifyToken: async () => ({ appId: 'test-app' })
    });

    assert.deepEqual(result, { ok: true });
  });
});
