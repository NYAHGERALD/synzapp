/**
 * When a presented device has to be a real, active one.
 *
 * Device binding was enforced on two routers out of thirteen. `railsRoutes`,
 * `lswRoutes`, `rcaRoutes`, `interpreterRoutes`, `complianceRoutes`,
 * `actionRoutes` and `announcementRoutes` asked only for a valid ID token, so a
 * phone an administrator had revoked kept working across most of the product.
 *
 * The obvious fix — require a registered device everywhere — is wrong here, and
 * would have taken the web app down completely. The browser registers no device
 * and sends no device header, and web is not a minor surface: it calls `lsw` 44
 * times, `rails` 31 and `rca` 21, plus compliance, staff and admin.
 *
 * So the rule is the other way round. **A device id that is presented must be
 * real.** A request carrying `X-Synzapp-Device-Id` is claiming to be a
 * registered phone, and that claim is now checked on every router rather than
 * two — a revoked device is refused the moment its app asks for anything.
 * Requests with no device id are browser sessions and are left to the route's
 * own authorisation, exactly as before.
 *
 * What this does not do, said plainly: somebody who steals a phone and crafts
 * requests without the header still gets through on the token. That is what
 * revoking refresh tokens in `revokeTenantDevice` is for — it bounds the window
 * to the life of the token rather than to whether the app cooperates. The two
 * work together and neither is sufficient alone.
 *
 * Pure, so the rules can be tested without a server.
 */

/** Device ids are opaque identifiers, not free text. */
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export interface PresentedDeviceInput {
  authorizationHeader?: string | null;
  deviceIdHeader?: string | null;
  method?: string | null;
  path?: string | null;
}

/**
 * Paths where a device id may legitimately name a device that does not exist
 * yet, because the request is what creates it.
 *
 * Onboarding sends a locally generated id before anything is registered —
 * `getLocalDeviceHeaders` in the mobile app returns one for exactly that. A
 * check with no exemption here would refuse the request that registers the
 * device, and nobody could ever sign in on a new phone.
 */
export function isDeviceBindingExempt(method?: string | null, path?: string | null): boolean {
  const safePath = (path || '').split('?')[0];

  // Sign-in, one-time codes and session checks all happen before a device
  // exists.
  if (safePath.startsWith('/api/auth')) {
    return true;
  }

  // The request that registers this very device.
  if ((method || '').toUpperCase() === 'POST' && safePath === '/api/profile/me/devices') {
    return true;
  }

  return false;
}

/**
 * The device id this request is claiming, or null when there is nothing to
 * check.
 *
 * Returns null without an Authorization header too: an unauthenticated route
 * has no session to bind a device to, and refusing there would turn a public
 * endpoint into an authenticated one by accident.
 */
export function readPresentedDeviceId(input: PresentedDeviceInput): string | null {
  if (isDeviceBindingExempt(input.method, input.path)) {
    return null;
  }

  const authorization = (input.authorizationHeader || '').trim();

  if (!authorization.startsWith('Bearer ')) {
    return null;
  }

  const deviceId = (input.deviceIdHeader || '').trim();

  if (!deviceId) {
    return null;
  }

  /**
   * A malformed id is refused rather than ignored. Ignoring it would let a
   * caller skip the check by sending rubbish, which is the opposite of what a
   * check is for.
   */
  return DEVICE_ID_PATTERN.test(deviceId) ? deviceId : '';
}
