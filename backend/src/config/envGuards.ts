/**
 * The settings that must not be wrong in production, checked before the server
 * accepts its first request.
 *
 * Three of them shipped defaulting to the unsafe value, which is the wrong way
 * round for anything security bearing:
 *
 *   - `PHONE_HASH_SECRET` and `PHONE_ENCRYPTION_SECRET` fell back to the literal
 *     `change-this-before-production`, published in this repository. That value
 *     is the HMAC key for the phone lookup index and, hashed, the AES key for
 *     stored phone numbers — protecting the only authentication factor the
 *     product has. The live service binds both to Secret Manager, so the
 *     placeholder is not in use; the defect is that nothing would have said so.
 *     `cloudrun.env.example.yaml` did not list either variable, so a deployment
 *     from the template would have booted on the published key in silence.
 *   - `CORS_ORIGIN` defaulted to `*`, and is `*` on the live service.
 *   - App Check defaulted to off, and the middleware lets a request with no App
 *     Check token straight through when it is off, so every route decorated with
 *     it was unprotected.
 *
 * A boot that fails loudly costs one deploy. A boot that succeeds with the
 * published key costs everything it protects.
 *
 * Pure, so the rules can be tested without starting a server or setting
 * environment variables.
 */

/** The value published in the repository. Never acceptable in production. */
export const PLACEHOLDER_SECRET = 'change-this-before-production';

/** Short enough to brute force is not a secret. */
export const MINIMUM_SECRET_LENGTH = 32;

export interface EnvGuardProblem {
  name: string;
  reason: string;
}

export interface ProductionEnvInput {
  corsOrigin?: string;
  nodeEnv?: string;
  phoneEncryptionSecret?: string;
  phoneHashSecret?: string;
  requireAppCheck?: boolean;
}

export function isProductionEnv(nodeEnv?: string): boolean {
  return nodeEnv === 'production';
}

/**
 * Everything wrong with this configuration, rather than the first thing wrong.
 *
 * Reporting one problem at a time turns a misconfigured deploy into four
 * deploys, each ending in the same surprise.
 */
export function findProductionEnvProblems(input: ProductionEnvInput): EnvGuardProblem[] {
  if (!isProductionEnv(input.nodeEnv)) {
    return [];
  }

  const problems: EnvGuardProblem[] = [];

  problems.push(...describeSecretProblems('PHONE_HASH_SECRET', input.phoneHashSecret));
  problems.push(...describeSecretProblems('PHONE_ENCRYPTION_SECRET', input.phoneEncryptionSecret));

  if (!input.corsOrigin || input.corsOrigin.trim() === '*') {
    problems.push({
      name: 'CORS_ORIGIN',
      reason: 'must name the real origins in production, never *.'
    });
  }

  return problems;
}

/**
 * Wrong, but not something to refuse a boot over.
 *
 * App Check is off in production and fails open, so every route decorated with
 * `verifyAppCheck` is unprotected. It cannot simply be turned on: **the mobile
 * app does not attach an App Check token at all.** Only `web/src/firebase.ts`
 * initialises App Check and sends `X-Firebase-AppCheck`; nothing in `mobile/src`
 * does. Enforcing it today would reject every request the phone app makes.
 *
 * So this is a warning rather than a refusal. Making it fatal would leave only
 * two options on the next deploy — a server that will not start, or an app that
 * cannot talk to it — and the honest answer is that the work is not done yet.
 */
export function findProductionEnvWarnings(input: ProductionEnvInput): EnvGuardProblem[] {
  if (!isProductionEnv(input.nodeEnv)) {
    return [];
  }

  if (input.requireAppCheck) {
    return [];
  }

  return [{
    name: 'SYNZAPP_REQUIRE_APP_CHECK',
    reason: 'is off, and App Check fails open when it is off, so every route ' +
      'that asks for it is unprotected. It cannot be turned on until the mobile ' +
      'app attaches an App Check token; today only the web app does.'
  }];
}

function describeSecretProblems(name: string, value?: string): EnvGuardProblem[] {
  if (!value || !value.trim()) {
    return [{ name, reason: 'is not set.' }];
  }

  if (value === PLACEHOLDER_SECRET) {
    return [{ name, reason: 'is still the placeholder published in the repository.' }];
  }

  if (value.length < MINIMUM_SECRET_LENGTH) {
    return [{
      name,
      reason: `is shorter than ${MINIMUM_SECRET_LENGTH} characters.`
    }];
  }

  return [];
}

/** One line per problem, so a failed boot says everything at once. */
export function describeProductionEnvProblems(problems: EnvGuardProblem[]): string {
  const lines = problems.map((problem) => `  - ${problem.name} ${problem.reason}`);

  return ['Refusing to start. This production configuration is not safe:', ...lines].join('\n');
}

export function describeProductionEnvWarnings(warnings: EnvGuardProblem[]): string {
  const lines = warnings.map((warning) => `  - ${warning.name} ${warning.reason}`);

  return ['This production configuration is weaker than it should be:', ...lines].join('\n');
}

/**
 * What the CORS middleware should be given.
 *
 * `cors` takes a string, a list or `true`, and a comma separated string is read
 * as one long origin that matches nothing — so a service configured with two
 * origins would silently refuse both. Returns `true` only for `*`, which the
 * guard above already refuses in production.
 */
export function parseCorsOrigins(value?: string): true | string[] {
  const trimmed = (value || '').trim();

  if (!trimmed || trimmed === '*') {
    return true;
  }

  const origins = trimmed
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length ? origins : true;
}
