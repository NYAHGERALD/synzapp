import { BackendAuthSession } from '../types/auth';
import { getSynzappApiBaseUrl } from './apiConfig';

export const ACCESS_DENIED_MESSAGE = 'Access denied. Please contact your organization administrator.';

export class AccessDeniedError extends Error {
  constructor() {
    super(ACCESS_DENIED_MESSAGE);
    this.name = 'AccessDeniedError';
  }
}

interface OtpPreflightResponse {
  ok: boolean;
  phoneMasked: string;
  retryAfterSeconds: number;
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
    throw new Error(await getResponseErrorMessage(response, 'We could not send a code right now.'));
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

    throw new Error(await getResponseErrorMessage(response, 'Your secure session could not be verified.'));
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
    throw new Error(await getResponseErrorMessage(response, 'Logout audit could not be recorded.'));
  }
}

export function isAccessDeniedError(error: unknown): boolean {
  return error instanceof AccessDeniedError ||
    (error instanceof Error && error.name === 'AccessDeniedError');
}

async function readJsonSafely(response: Response): Promise<unknown | null> {
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
}

async function getResponseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();

    if (typeof body?.error === 'string') {
      return body.error;
    }
  } catch {
    return fallback;
  }

  return fallback;
}
