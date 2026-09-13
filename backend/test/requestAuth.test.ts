import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const routesDir = resolve(testDir, '..', 'src', 'routes');

/**
 * One way to read the caller out of a request.
 *
 * There were eleven private copies, one per route file, and they had drifted:
 * four accepted a bare token with no Bearer scheme, and five answered a missing
 * token with 403 where the rest said 401 — for the identical case. None of that
 * was decided; it accumulated. This keeps it from happening again.
 */
describe('reading the caller from a request', () => {
  it('is defined once, and nowhere else', () => {
    const offenders = readdirSync(routesDir)
      .filter((name) => name.endsWith('.ts'))
      .filter((name) => /^(async )?function getDecodedToken\(/m.test(
        readFileSync(resolve(routesDir, name), 'utf8')
      ));

    assert.deepEqual(
      offenders,
      [],
      `These route files define their own getDecodedToken instead of importing the shared one: ${offenders.join(', ')}`
    );
  });

  it('requires the Bearer scheme and answers a missing token with 401', async () => {
    const { getDecodedTokenFromHeader } = await import('../src/middleware/requestAuth.ts');

    await assert.rejects(
      () => getDecodedTokenFromHeader(''),
      (error: Error) => {
        assert.equal(error.name, 'AuthenticationError');

        return true;
      }
    );

    // A bare token used to be accepted by four of the eleven copies. Nobody
    // sends one — every caller in the app and the web console uses Bearer.
    await assert.rejects(
      () => getDecodedTokenFromHeader('some-raw-token-without-a-scheme'),
      (error: Error) => {
        assert.equal(error.name, 'AuthenticationError');

        return true;
      }
    );
  });

  it('refuses a Bearer header with nothing after it', async () => {
    const { getDecodedTokenFromHeader } = await import('../src/middleware/requestAuth.ts');

    await assert.rejects(() => getDecodedTokenFromHeader('Bearer    '), /Missing Firebase ID token/);
  });
});
