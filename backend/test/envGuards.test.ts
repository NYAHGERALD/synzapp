import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MINIMUM_SECRET_LENGTH,
  PLACEHOLDER_SECRET,
  describeProductionEnvProblems,
  findProductionEnvProblems,
  findProductionEnvWarnings,
  parseCorsOrigins
} from '../src/config/envGuards.ts';

const SAFE = {
  corsOrigin: 'https://synzapp.com',
  nodeEnv: 'production',
  phoneEncryptionSecret: 'b'.repeat(MINIMUM_SECRET_LENGTH),
  phoneHashSecret: 'a'.repeat(MINIMUM_SECRET_LENGTH),
  requireAppCheck: true
};

describe('refusing an unsafe production configuration', () => {
  it('accepts a configuration with nothing wrong', () => {
    assert.deepEqual(findProductionEnvProblems(SAFE), []);
  });

  it('refuses the placeholder secret published in the repository', () => {
    const problems = findProductionEnvProblems({
      ...SAFE,
      phoneHashSecret: PLACEHOLDER_SECRET
    });

    assert.equal(problems.length, 1);
    assert.equal(problems[0].name, 'PHONE_HASH_SECRET');
    assert.match(problems[0].reason, /placeholder/);
  });

  it('refuses a missing or short secret', () => {
    assert.match(
      findProductionEnvProblems({ ...SAFE, phoneHashSecret: '' })[0].reason,
      /not set/
    );
    assert.match(
      findProductionEnvProblems({ ...SAFE, phoneEncryptionSecret: 'short' })[0].reason,
      /shorter than/
    );
  });

  it('refuses a wildcard CORS origin', () => {
    const problems = findProductionEnvProblems({ ...SAFE, corsOrigin: '*' });

    assert.equal(problems[0].name, 'CORS_ORIGIN');
  });

  it('warns about App Check being off, but does not refuse to start', () => {
    /**
     * It fails open, so every route that asks for it is unprotected — but it
     * cannot be turned on yet. Only the web app attaches an App Check token;
     * the mobile app sends none, so enforcing it would reject every request
     * from the phone. Refusing the boot would leave two options on the next
     * deploy: a server that will not start, or an app that cannot reach it.
     */
    assert.deepEqual(findProductionEnvProblems({ ...SAFE, requireAppCheck: false }), []);

    const warnings = findProductionEnvWarnings({ ...SAFE, requireAppCheck: false });

    assert.equal(warnings[0].name, 'SYNZAPP_REQUIRE_APP_CHECK');
    assert.match(warnings[0].reason, /mobile app/);
  });

  it('says nothing when App Check is on', () => {
    assert.deepEqual(findProductionEnvWarnings(SAFE), []);
  });

  it('reports every problem at once, not the first one', () => {
    // Otherwise a misconfigured deploy becomes four deploys, each ending in the
    // same surprise.
    const problems = findProductionEnvProblems({
      corsOrigin: '*',
      nodeEnv: 'production',
      phoneEncryptionSecret: PLACEHOLDER_SECRET,
      phoneHashSecret: PLACEHOLDER_SECRET,
      requireAppCheck: false
    });

    assert.equal(problems.length, 3);
    assert.match(describeProductionEnvProblems(problems), /PHONE_HASH_SECRET/);
    assert.match(describeProductionEnvProblems(problems), /CORS_ORIGIN/);
  });

  it('leaves development alone', () => {
    // Otherwise nobody can run the server locally, and the first thing anybody
    // does about that is turn the check off for everybody.
    assert.deepEqual(findProductionEnvProblems({
      corsOrigin: '*',
      nodeEnv: 'development',
      phoneEncryptionSecret: PLACEHOLDER_SECRET,
      phoneHashSecret: PLACEHOLDER_SECRET,
      requireAppCheck: false
    }), []);
  });
});

describe('reading the allowed origins', () => {
  it('splits a list, because cors reads a comma string as one origin', () => {
    /**
     * A service configured with two origins would otherwise silently refuse
     * both — the string never matches anything.
     */
    assert.deepEqual(
      parseCorsOrigins('https://synzapp.com, https://admin.synzapp.com'),
      ['https://synzapp.com', 'https://admin.synzapp.com']
    );
  });

  it('keeps a single origin as a list of one', () => {
    assert.deepEqual(parseCorsOrigins('https://synzapp.com'), ['https://synzapp.com']);
  });

  it('allows anything only for an explicit wildcard or nothing at all', () => {
    assert.equal(parseCorsOrigins('*'), true);
    assert.equal(parseCorsOrigins(''), true);
    assert.equal(parseCorsOrigins(undefined), true);
  });
});
