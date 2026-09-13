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

describe('API route guard coverage foundation', () => {
  it('requires App Check, Firebase session, and active device on every admin route', () => {
    const blocks = getRouteBlocks(adminRoutes, 'adminRouter', ['get', 'post', 'patch', 'delete']);

    assert.ok(blocks.length > 0, 'Expected admin routes to be present.');

    blocks.forEach((block) => {
      assert.match(block.header, /verifyAppCheck/, `${block.header} must require App Check middleware.`);
      assert.match(block.body, /getDecodedToken/, `${block.header} must verify the Firebase session.`);
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
