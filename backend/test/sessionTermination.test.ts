import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Guards, not unit tests. These paths reach Firebase, so the only way to assert
 * them without an emulator is to read what they do.
 */

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const authRoutes = readFileSync(resolve(backendRoot, 'src', 'routes', 'authRoutes.ts'), 'utf8');
const adminDeviceService = readFileSync(
  resolve(backendRoot, 'src', 'services', 'adminDeviceService.ts'),
  'utf8'
);
const authSessionService = readFileSync(
  resolve(backendRoot, 'src', 'services', 'authSessionService.ts'),
  'utf8'
);

describe('a session that is ended actually ends', () => {
  it('signs the account out on the server when somebody signs out', () => {
    /**
     * Logout used to verify the token, write an audit line and return ok,
     * leaving the credential live until it expired. On a shared plant-floor
     * tablet the worker who signed out was still signed in.
     */
    assert.match(
      authRoutes,
      /revokeRefreshTokens/,
      'POST /auth/logout must end the session on the server, not only in the app.'
    );
  });

  it('revokes the credential when an administrator revokes a device', () => {
    /**
     * Marking the record REVOKED and asking the device to wipe stopped nothing
     * on its own: the wipe is a request the app has to fetch and obey.
     */
    assert.match(
      adminDeviceService,
      /adminAuth\.revokeRefreshTokens/,
      'Revoking a device must revoke the credential, not just mark the record.'
    );
  });

  it('checks revocation on every request, so it takes effect at once', () => {
    /**
     * The second argument is what makes the two above worth anything. Without
     * it, a revoked token keeps working until it expires on its own and
     * revocation only stops new ones being minted.
     */
    assert.match(
      authSessionService,
      /verifyIdToken\(idToken,\s*true\)/,
      'Sessions must be verified with checkRevoked, or revoking changes nothing today.'
    );
  });
});
