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
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  openAiInterpreterRealtimeModel: process.env.OPENAI_INTERPRETER_REALTIME_MODEL || 'gpt-realtime-translate',
  openAiInterpreterSummaryModel: process.env.OPENAI_INTERPRETER_SUMMARY_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  openAiInterpreterSummaryTtsModel: process.env.OPENAI_INTERPRETER_SUMMARY_TTS_MODEL || 'gpt-4o-mini-tts',
  openAiInterpreterSummaryTtsVoice: process.env.OPENAI_INTERPRETER_SUMMARY_TTS_VOICE || 'cedar',
  openAiRequestTimeoutMs: numberFromEnv('OPENAI_REQUEST_TIMEOUT_MS', 25_000),
  interpreterMaxTargetLanguages: numberFromEnv('INTERPRETER_MAX_TARGET_LANGUAGES', 6),
  interpreterRetentionDays: numberFromEnv('INTERPRETER_RETENTION_DAYS', 90),
  interpreterAudioRetention: booleanFromEnv('INTERPRETER_AUDIO_RETENTION', false),
  interpreterSummaryEnabled: booleanFromEnv('INTERPRETER_SUMMARY_ENABLED', true),
  interpreterSummaryAudioEnabled: booleanFromEnv('INTERPRETER_SUMMARY_AUDIO_ENABLED', true),
  interpreterReminderWorkerEnabled: booleanFromEnv('INTERPRETER_REMINDER_WORKER_ENABLED', true),
  interpreterReminderWorkerIntervalMs: numberFromEnv('INTERPRETER_REMINDER_WORKER_INTERVAL_MS', 60_000),
  interpreterReminderWorkerBatchSize: numberFromEnv('INTERPRETER_REMINDER_WORKER_BATCH_SIZE', 50),
  interpreterReminderWorkerTenantBatchSize: numberFromEnv('INTERPRETER_REMINDER_WORKER_TENANT_BATCH_SIZE', 100),
  requireAppCheck: booleanFromEnv('SYNZAPP_REQUIRE_APP_CHECK'),
  authRateLimitWindowMs: numberFromEnv('AUTH_RATE_LIMIT_WINDOW_MS', 60_000),
  authRateLimitMax: numberFromEnv('AUTH_RATE_LIMIT_MAX', 20),
  otpRateLimitWindowMs: numberFromEnv('OTP_RATE_LIMIT_WINDOW_MS', 15 * 60_000),
  otpRateLimitMax: numberFromEnv('OTP_RATE_LIMIT_MAX', 5)
};
