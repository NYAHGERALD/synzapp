import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const adminRoutes = readFileSync(resolve(backendRoot, 'src', 'routes', 'adminRoutes.ts'), 'utf8');
const profileRoutes = readFileSync(resolve(backendRoot, 'src', 'routes', 'profileRoutes.ts'), 'utf8');
const authRoutes = readFileSync(resolve(backendRoot, 'src', 'routes', 'authRoutes.ts'), 'utf8');
const appSource = readFileSync(resolve(backendRoot, 'src', 'app.ts'), 'utf8');

describe('device binding reaches every router', () => {
  /**
   * It used to reach two of thirteen. railsRoutes, lswRoutes, rcaRoutes,
   * interpreterRoutes, complianceRoutes, actionRoutes and announcementRoutes
   * asked only for a valid token, so a phone an administrator had revoked went
   * on working across most of the product — and this test asserted only the
   * three routers that already passed, so nothing caught it.
   */
  it('mounts the check globally rather than router by router', () => {
    assert.match(
      appSource,
      /app\.use\(enforceDeviceBinding\)/,
      'enforceDeviceBinding must be mounted for every router, not added route by route.'
    );
  });

  it('mounts it before the first router, so nothing is reached without it', () => {
    const guardIndex = appSource.indexOf('app.use(enforceDeviceBinding)');
    const firstRouterIndex = appSource.indexOf("app.use('/api/");

    assert.ok(guardIndex > 0, 'Expected the device binding guard to be mounted.');
    assert.ok(
      guardIndex < firstRouterIndex,
      'The device binding guard must run before any router is mounted.'
    );
  });

  it('keeps the browser working, because the web app registers no device', () => {
    /**
     * Requiring a registered device everywhere would take the web app down: it
     * calls lsw, rails and rca constantly and sends no device header at all.
     * The rule is that a device id which IS presented must be real.
     */
    const rules = readFileSync(
      resolve(backendRoot, 'src', 'middleware', 'deviceBindingRules.ts'),
      'utf8'
    );

    assert.match(rules, /readPresentedDeviceId/);
    assert.match(rules, /isDeviceBindingExempt/);
  });
});

describe('API route guard coverage foundation', () => {
  it('requires App Check, Firebase session, and active device on every admin route', () => {
    const blocks = getRouteBlocks(adminRoutes, 'adminRouter', ['get', 'post', 'patch', 'delete']);

    assert.ok(blocks.length > 0, 'Expected admin routes to be present.');

    blocks.forEach((block) => {
      assert.match(block.header, /verifyAppCheck/, `${block.header} must require App Check middleware.`);
      assert.match(block.body, /getDecodedToken/, `${block.header} must verify the Firebase session.`);

      if (isBrowserReachableAdminRoute(block.header)) {
        // Managing devices is the one job an administrator may have to do
        // because a phone is gone, so it must work from a computer. Asserted so
        // the exemption stays deliberate and cannot spread: authority here comes
        // from requireSecurityAdmin in the service, not from a device header.
        assert.doesNotMatch(
          block.body,
          /requireActiveRegisteredDevice/,
          `${block.header} must not require a registered device — it has to work from a browser.`
        );

        return;
      }

      assert.match(block.body, /requireActiveRegisteredDevice/, `${block.header} must require an active registered device.`);
    });
  });

  it('keeps profile routes behind App Check and expected auth gates', () => {
    const blocks = getRouteBlocks(profileRoutes, 'profileRouter', ['get', 'post', 'patch', 'delete']);

    assert.ok(blocks.length > 0, 'Expected profile routes to be present.');

    blocks.forEach((block) => {
      assert.match(block.header, /verifyAppCheck/, `${block.header} must require App Check middleware.`);
      assert.match(block.body, /getDecodedToken/, `${block.header} must verify the Firebase session.`);

      if (requiresOwnedDevice(block.header)) {
        // A revoked device is precisely the one that must read these, so they
        // check ownership rather than authorisation. Asserted so the weaker gate
        // stays deliberate and cannot spread to any other route.
        assert.match(
          block.body,
          /requireOwnedRegisteredDevice/,
          `${block.header} must require a device owned by the caller.`
        );
        assert.doesNotMatch(
          block.body,
          /requireActiveRegisteredDevice/,
          `${block.header} must not require an ACTIVE device — a revoked device has to collect its own wipe order.`
        );

        return;
      }

      if (requiresRegisteredDevice(block.header)) {
        assert.match(block.body, /requireActiveRegisteredDevice/, `${block.header} must require an active registered device.`);
      }
    });
  });

  it('keeps auth session and logout routes behind App Check and token verification', () => {
    assert.match(authRoutes, /authRouter\.post\(\s*'\/session',\s*verifyAppCheck/);
    assert.match(authRoutes, /authRouter\.post\('\/logout', verifyAppCheck/);
    assert.match(authRoutes, /const decodedToken = await verifyFirebaseSession\(idToken\)/);
  });
});

/**
 * The company-data wipe endpoints, and nothing else.
 *
 * Revocation marks a device REVOKED and then writes its wipe order, so gating
 * these on the device still being ACTIVE addressed the order to a device already
 * blocked from reading it — wiping a lost phone did nothing at all.
 */
/**
 * The tenant device console, and nothing else.
 *
 * An administrator revoking a lost phone cannot be asked to produce a working
 * phone, and a browser registers no device at all.
 */
function isBrowserReachableAdminRoute(header: string): boolean {
  return header.includes("adminRouter.get('/devices'") ||
    header.includes("adminRouter.post('/devices/:deviceId/revoke'");
}

function requiresOwnedDevice(header: string): boolean {
  return header.includes("profileRouter.get('/me/company-data-wipe-commands'") ||
    header.includes("profileRouter.post('/me/company-data-wipe-commands/:commandId/complete'");
}

function requiresRegisteredDevice(header: string): boolean {
  return ![
    "profileRouter.post('/me/devices'",
    "profileRouter.get('/employee/context'",
    "profileRouter.post('/employee'",
    "profileRouter.post('/org-admin'"
  ].some((prefix) => header.includes(prefix));
}

function getRouteBlocks(
  source: string,
  routerName: string,
  methods: Array<'delete' | 'get' | 'patch' | 'post'>
): Array<{ body: string; header: string }> {
  const routePattern = new RegExp(`${routerName}\\.(${methods.join('|')})\\(`, 'g');
  const blocks: Array<{ body: string; header: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = routePattern.exec(source))) {
    const start = match.index;
    const nextRoutePattern = new RegExp(`${routerName}\\.(get|post|patch|delete)\\(`, 'g');

    nextRoutePattern.lastIndex = start + 1;
    const nextRouteMatch = nextRoutePattern.exec(source);
    const end = nextRouteMatch?.index ?? source.length;
    const block = source.slice(start, end);
    const header = block.split('\n')[0] || `${routerName}.${match[1]}`;

    blocks.push({
      body: block,
      header
    });
  }

  return blocks;
}
