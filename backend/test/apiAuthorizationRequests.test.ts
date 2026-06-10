import assert from 'node:assert/strict';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createSynzappApp } from '../src/app.ts';

let server: Server;
let baseUrl: string;

describe('API authorization request behavior', () => {
  beforeEach(async () => {
    server = createServer(createSynzappApp());
    server.keepAliveTimeout = 1;

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  it('serves health without requiring authentication', async () => {
    const response = await request('/health');
    const body = await response.json() as { ok?: boolean; service?: string };

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.service, 'synzapp-backend');
    assert.equal(response.headers.get('x-powered-by'), null);
  });

  it('serves liveness without requiring authentication', async () => {
    const response = await request('/health/live');
    const body = await response.json() as { ok?: boolean; service?: string };

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.service, 'synzapp-backend');
  });

  it('reports readiness without exposing protected data', async () => {
    const response = await request('/health/ready');
    const body = await response.json() as {
      checks?: Record<string, boolean>;
      ok?: boolean;
      service?: string;
      status?: string;
    };

    assert.ok([200, 503].includes(response.status));
    assert.equal(body.service, 'synzapp-backend');
    assert.equal(typeof body.ok, 'boolean');
    assert.equal(typeof body.status, 'string');
    assert.equal(typeof body.checks?.firebaseProjectConfigured, 'boolean');
    assert.equal(typeof body.checks?.storageBucketConfigured, 'boolean');
  });

  it('rejects protected admin routes without a Firebase bearer token', async () => {
    const response = await request('/api/admin/departments');
    const body = await response.json() as { error?: string };

    assert.equal(response.status, 401);
    assert.equal(body.error, 'Missing Firebase ID token.');
  });

  it('rejects protected profile routes without a Firebase bearer token', async () => {
    const response = await request('/api/profile/me');
    const body = await response.json() as { error?: string };

    assert.equal(response.status, 401);
    assert.equal(body.error, 'Missing Firebase ID token.');
  });

  it('rejects auth session requests without a Firebase bearer token', async () => {
    const response = await request('/api/auth/session', {
      body: JSON.stringify({ event: 'login' }),
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'POST'
    });
    const body = await response.json() as { error?: string };

    assert.equal(response.status, 401);
    assert.equal(body.error, 'Missing Firebase ID token.');
  });
});

function request(path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Connection: 'close'
    }
  });
}
