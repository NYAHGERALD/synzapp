import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isDeviceBindingExempt,
  readPresentedDeviceId
} from '../src/middleware/deviceBindingRules.ts';

const AUTHORIZED = {
  authorizationHeader: 'Bearer some-token',
  method: 'GET',
  path: '/api/rails/items'
};

describe('deciding when a presented device must be real', () => {
  it('checks a device id on a router that never checked one before', () => {
    /**
     * railsRoutes, lswRoutes, rcaRoutes, interpreterRoutes, complianceRoutes,
     * actionRoutes and announcementRoutes asked only for a valid token, so a
     * revoked phone kept working across most of the product.
     */
    assert.equal(
      readPresentedDeviceId({ ...AUTHORIZED, deviceIdHeader: 'device-abc12345' }),
      'device-abc12345'
    );
  });

  it('leaves a browser alone, because the web app registers no device', () => {
    /**
     * Requiring a device everywhere would have taken the web app down: it calls
     * lsw 44 times, rails 31 and rca 21, and sends no device header at all.
     */
    assert.equal(readPresentedDeviceId({ ...AUTHORIZED, deviceIdHeader: '' }), null);
    assert.equal(readPresentedDeviceId(AUTHORIZED), null);
  });

  it('refuses a malformed device id rather than ignoring it', () => {
    // Ignoring it would let a caller skip the check by sending rubbish.
    assert.equal(readPresentedDeviceId({ ...AUTHORIZED, deviceIdHeader: 'short' }), '');
    assert.equal(readPresentedDeviceId({ ...AUTHORIZED, deviceIdHeader: 'has spaces' }), '');
  });

  it('ignores a device id on an unauthenticated request', () => {
    // Refusing there would turn a public endpoint into an authenticated one.
    assert.equal(readPresentedDeviceId({
      deviceIdHeader: 'device-abc12345',
      method: 'GET',
      path: '/api/contact/support'
    }), null);
  });
});

describe('the paths where a device does not exist yet', () => {
  it('exempts sign-in, because a device is registered after it', () => {
    assert.equal(isDeviceBindingExempt('POST', '/api/auth/session'), true);
    assert.equal(isDeviceBindingExempt('POST', '/api/auth/otp/preflight'), true);
  });

  it('exempts the request that registers this very device', () => {
    /**
     * Onboarding sends a locally generated id before anything is registered.
     * Without this nobody could ever sign in on a new phone.
     */
    assert.equal(isDeviceBindingExempt('POST', '/api/profile/me/devices'), true);
  });

  it('does not exempt listing or revoking devices', () => {
    assert.equal(isDeviceBindingExempt('GET', '/api/profile/me/devices'), false);
    assert.equal(isDeviceBindingExempt('POST', '/api/profile/me/devices/abc/revoke'), false);
  });

  it('ignores a query string when matching', () => {
    assert.equal(isDeviceBindingExempt('POST', '/api/profile/me/devices?retry=1'), true);
  });

  it('does not exempt anything else', () => {
    ['/api/rails/items', '/api/lsw/boards', '/api/rca/incidents', '/api/admin/employees']
      .forEach((path) => {
        assert.equal(isDeviceBindingExempt('POST', path), false);
      });
  });
});
