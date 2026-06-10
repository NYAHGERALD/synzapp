import { env } from '../config/env.js';

export interface HealthStatusResponse {
  checks: {
    appCheckConfigured: boolean;
    appCheckRequired: boolean;
    firebaseProjectConfigured: boolean;
    storageBucketConfigured: boolean;
  };
  ok: boolean;
  service: 'synzapp-backend';
  status: 'degraded' | 'ok';
}

export function getHealthStatus(): HealthStatusResponse {
  const checks = {
    appCheckConfigured: env.requireAppCheck,
    appCheckRequired: env.requireAppCheck,
    firebaseProjectConfigured: Boolean(env.firebaseProjectId),
    storageBucketConfigured: Boolean(env.firebaseStorageBucket)
  };
  const ok = checks.firebaseProjectConfigured && checks.storageBucketConfigured;

  return {
    checks,
    ok,
    service: 'synzapp-backend',
    status: ok ? 'ok' : 'degraded'
  };
}
