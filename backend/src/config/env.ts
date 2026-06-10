import 'dotenv/config';

function numberFromEnv(name: string, fallback: number): number {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function booleanFromEnv(name: string, fallback = false): boolean {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export const env = {
  port: numberFromEnv('PORT', 4100),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
  phoneHashSecret: process.env.PHONE_HASH_SECRET || 'change-this-before-production',
  phoneEncryptionSecret: process.env.PHONE_ENCRYPTION_SECRET || process.env.PHONE_HASH_SECRET || 'change-this-before-production',
  requireAppCheck: booleanFromEnv('SYNZAPP_REQUIRE_APP_CHECK'),
  authRateLimitWindowMs: numberFromEnv('AUTH_RATE_LIMIT_WINDOW_MS', 60_000),
  authRateLimitMax: numberFromEnv('AUTH_RATE_LIMIT_MAX', 20),
  otpRateLimitWindowMs: numberFromEnv('OTP_RATE_LIMIT_WINDOW_MS', 15 * 60_000),
  otpRateLimitMax: numberFromEnv('OTP_RATE_LIMIT_MAX', 5)
};
