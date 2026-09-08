import { BackendAuthSession } from '../types/auth';
import { getSynzappApiBaseUrl } from './apiConfig';

export const ACCESS_DENIED_MESSAGE = 'Access denied. Please contact your organization administrator.';

export class AccessDeniedError extends Error {
  constructor() {
    super(ACCESS_DENIED_MESSAGE);
    this.name = 'AccessDeniedError';
  }
}

export class AuthRateLimitError extends Error {
  retryAfterSeconds: number | null;

  constructor(retryAfterSeconds?: number | null) {
    super(getAuthRateLimitMessage(retryAfterSeconds));
    this.name = 'AuthRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds && retryAfterSeconds > 0
      ? Math.ceil(retryAfterSeconds)
      : null;
  }
}

interface OtpPreflightResponse {
  ok: boolean;
  phoneMasked: string;
  retryAfterSeconds: number;
}

interface BackendErrorResponse {
  error?: unknown;
  retryAfterSeconds?: unknown;
}

export async function requestOtpPreflight(phoneNumber: string): Promise<OtpPreflightResponse> {
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/auth/otp/preflight`, {
    body: JSON.stringify({ phoneNumber }),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    method: 'POST'
  });

  if (!response.ok) {
    throw await getBackendAuthError(response, 'We could not send a code right now.');
  }

  return response.json() as Promise<OtpPreflightResponse>;
}

export async function verifyBackendAuthSession(
  idToken: string,
  event: 'login' | 'restore'
): Promise<BackendAuthSession> {
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/auth/session`, {
    body: JSON.stringify({ event }),
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    },
    method: 'POST'
  });

  if (!response.ok) {
    if (response.status === 403) {
      const body = await readJsonSafely(response) as (Partial<BackendAuthSession> & { error?: string }) | null;

      if (
        body?.access === 'BLOCKED' ||
        body?.nextStep === 'CONTACT_ADMIN' ||
        body?.error === ACCESS_DENIED_MESSAGE
      ) {
        throw new AccessDeniedError();
      }
    }

    throw await getBackendAuthError(response, 'Your secure session could not be verified.');
  }

  return response.json() as Promise<BackendAuthSession>;
}

export async function auditBackendLogout(idToken: string): Promise<void> {
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/auth/logout`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`
    },
    method: 'POST'
  });

  if (!response.ok) {
    throw await getBackendAuthError(response, 'Logout audit could not be recorded.');
  }
}

export function isAccessDeniedError(error: unknown): boolean {
  return error instanceof AccessDeniedError ||
    (error instanceof Error && error.name === 'AccessDeniedError');
}

export function isAuthRateLimitError(error: unknown): boolean {
  return error instanceof AuthRateLimitError ||
    (error instanceof Error && error.name === 'AuthRateLimitError');
}

async function readJsonSafely(response: Response): Promise<unknown | null> {
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
}

async function getBackendAuthError(response: Response, fallback: string): Promise<Error> {
  const body = await readJsonSafely(response) as BackendErrorResponse | null;
  const retryAfterSeconds = getRetryAfterSeconds(response, body);

  if (response.status === 429 || retryAfterSeconds) {
    return new AuthRateLimitError(retryAfterSeconds);
  }

  const message = typeof body?.error === 'string' && body.error.trim()
    ? body.error.trim()
    : fallback;

  return new Error(message);
}

function getRetryAfterSeconds(response: Response, body: BackendErrorResponse | null): number | null {
  const bodyRetryAfterSeconds = Number(body?.retryAfterSeconds);

  if (Number.isFinite(bodyRetryAfterSeconds) && bodyRetryAfterSeconds > 0) {
    return Math.ceil(bodyRetryAfterSeconds);
  }

  const headerRetryAfterSeconds = Number(response.headers.get('Retry-After'));

  if (Number.isFinite(headerRetryAfterSeconds) && headerRetryAfterSeconds > 0) {
    return Math.ceil(headerRetryAfterSeconds);
  }

  return null;
}

function getAuthRateLimitMessage(retryAfterSeconds?: number | null): string {
  const waitTime = formatRetryAfter(retryAfterSeconds);

  return waitTime
    ? `Sorry, phone sign-in is temporarily paused after too many attempts. Please wait ${waitTime} and try again.`
    : 'Sorry, phone sign-in is temporarily paused after too many attempts. Please wait a few minutes and try again.';
}

function formatRetryAfter(retryAfterSeconds?: number | null): string | null {
  if (!retryAfterSeconds || retryAfterSeconds <= 0) {
    return null;
  }

  if (retryAfterSeconds < 60) {
    return `${Math.ceil(retryAfterSeconds)} seconds`;
  }

  const minutes = Math.ceil(retryAfterSeconds / 60);

  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}
