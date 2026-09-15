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

const nodeEnv = process.env.NODE_ENV || 'development';

export const env = {
  nodeEnv,
  port: numberFromEnv('PORT', 4100),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
  /**
   * The fallback is a development convenience and nothing more.
   *
   * `findProductionEnvProblems` refuses to start the server when either of
   * these is missing, too short, or still this value, so the placeholder can no
   * longer reach production quietly the way it could before. Local work keeps
   * running without any configuration at all.
   */
  phoneHashSecret: process.env.PHONE_HASH_SECRET || 'change-this-before-production',
  phoneEncryptionSecret: process.env.PHONE_ENCRYPTION_SECRET || process.env.PHONE_HASH_SECRET || 'change-this-before-production',
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL || 'gpt-5.6-terra',
  openAiInterpreterAgentRealtimeModel: process.env.OPENAI_INTERPRETER_AGENT_REALTIME_MODEL || process.env.OPENAI_INTERPRETER_AGENT_MODEL || 'gpt-realtime-2.1',
  openAiInterpreterRealtimeModel: process.env.OPENAI_INTERPRETER_REALTIME_MODEL || 'gpt-realtime-translate',
  openAiInterpreterTranscriptionModel: process.env.OPENAI_INTERPRETER_TRANSCRIPTION_MODEL || 'gpt-live-transcribe',
  openAiInterpreterSegmentModel: process.env.OPENAI_INTERPRETER_SEGMENT_MODEL || process.env.OPENAI_INTERPRETER_SUMMARY_MODEL || process.env.OPENAI_MODEL || 'gpt-5.6-terra',
  /**
   * The model that turns a saved transcript into another language for reading.
   *
   * Separate from the live interpreter's model on purpose. Live interpretation
   * is a hard task under time pressure and is worth a reasoning model; reading a
   * saved transcript aloud is a plain translation, and paying reasoning latency
   * per passage is what made Play take a long time to say anything.
   *
   * Defaults to the live model, so nothing changes until this is set.
   */
  openAiInterpreterReadAloudModel: process.env.OPENAI_INTERPRETER_READ_ALOUD_MODEL || process.env.OPENAI_INTERPRETER_SEGMENT_MODEL || 'gpt-5.6-terra',
  openAiInterpreterSegmentTtsModel: process.env.OPENAI_INTERPRETER_SEGMENT_TTS_MODEL || process.env.OPENAI_INTERPRETER_SUMMARY_TTS_MODEL || 'gpt-4o-mini-tts',
  openAiInterpreterSegmentTtsVoice: process.env.OPENAI_INTERPRETER_SEGMENT_TTS_VOICE || process.env.OPENAI_INTERPRETER_SUMMARY_TTS_VOICE || 'cedar',
  openAiInterpreterSummaryModel: process.env.OPENAI_INTERPRETER_SUMMARY_MODEL || process.env.OPENAI_MODEL || 'gpt-5.6-terra',
  openAiInterpreterSummaryTtsModel: process.env.OPENAI_INTERPRETER_SUMMARY_TTS_MODEL || 'gpt-4o-mini-tts',
  openAiInterpreterSummaryTtsVoice: process.env.OPENAI_INTERPRETER_SUMMARY_TTS_VOICE || 'cedar',
  openAiRequestTimeoutMs: numberFromEnv('OPENAI_REQUEST_TIMEOUT_MS', 25_000),
  interpreterMaxTargetLanguages: numberFromEnv('INTERPRETER_MAX_TARGET_LANGUAGES', 4),
  interpreterRetentionDays: numberFromEnv('INTERPRETER_RETENTION_DAYS', 90),
  interpreterAudioRetention: booleanFromEnv('INTERPRETER_AUDIO_RETENTION', false),
  interpreterSegmentAudioEnabled: booleanFromEnv('INTERPRETER_SEGMENT_AUDIO_ENABLED', true),
  interpreterSummaryEnabled: booleanFromEnv('INTERPRETER_SUMMARY_ENABLED', true),
  interpreterSummaryAudioEnabled: booleanFromEnv('INTERPRETER_SUMMARY_AUDIO_ENABLED', true),
  interpreterReminderWorkerEnabled: booleanFromEnv('INTERPRETER_REMINDER_WORKER_ENABLED', true),
  interpreterReminderWorkerIntervalMs: numberFromEnv('INTERPRETER_REMINDER_WORKER_INTERVAL_MS', 60_000),
  interpreterReminderWorkerBatchSize: numberFromEnv('INTERPRETER_REMINDER_WORKER_BATCH_SIZE', 50),
  interpreterReminderWorkerTenantBatchSize: numberFromEnv('INTERPRETER_REMINDER_WORKER_TENANT_BATCH_SIZE', 100),
  interpreterApprovedCurrentFacts: process.env.INTERPRETER_APPROVED_CURRENT_FACTS || '',
  interpreterCurrentUsPresident: process.env.INTERPRETER_CURRENT_US_PRESIDENT || '',
  /**
   * Still defaults to off, and that is not an endorsement.
   *
   * The middleware lets a request with no App Check token straight through when
   * this is false, so every route decorated with it is unprotected. It cannot be
   * flipped on yet: only the web app attaches a token, and the mobile app sends
   * none at all, so enforcing it would reject every request from the phone.
   * `findProductionEnvWarnings` says so at boot rather than leaving it quiet.
   */
  /**
   * What happens when an audit event cannot be written.
   *
   * `throw` is today's behaviour everywhere and stays the default. The trouble
   * with it is that the mutation has already committed by then, so the throw
   * reaches the route's catch, which records a second event saying the change
   * FAILED — and returns a 500 for work that was done. The log ends up
   * confidently wrong.
   *
   * `continue` stops that: the failure is reported to Cloud Logging and the
   * request succeeds, as it in fact did. Only flip it once something is
   * alerting on the AUDIT_WRITE_FAILED marker, or a silent gap replaces a loud
   * lie and nobody notices either.
   */
  /**
   * How long an audit event with no tenant is kept.
   *
   * These are the events that belong to nobody — a probe against an endpoint
   * with no credential, or a caller whose token cannot be read at all. They live
   * in the root collection, which nothing reads, so the period is short and
   * separate from a tenant's own retention: the point is that somebody can look
   * at a probe while it is still relevant, not that a record of it is kept for
   * years.
   *
   * Configuration rather than a number in code, and it belongs in the Synzapp
   * staff console once there is a surface for it.
   */
  unattributedAuditRetentionDays: numberFromEnv('SYNZAPP_UNATTRIBUTED_AUDIT_RETENTION_DAYS', 90),
  auditWriteFailureMode: process.env.SYNZAPP_AUDIT_WRITE_FAILURE_MODE === 'continue'
    ? 'continue' as const
    : 'throw' as const,
  requireAppCheck: booleanFromEnv('SYNZAPP_REQUIRE_APP_CHECK'),
  authRateLimitWindowMs: numberFromEnv('AUTH_RATE_LIMIT_WINDOW_MS', 60_000),
  authRateLimitMax: numberFromEnv('AUTH_RATE_LIMIT_MAX', 20),
  otpRateLimitWindowMs: numberFromEnv('OTP_RATE_LIMIT_WINDOW_MS', 15 * 60_000),
  otpRateLimitMax: numberFromEnv('OTP_RATE_LIMIT_MAX', 5)
};
