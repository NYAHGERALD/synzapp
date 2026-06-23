import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';
import { getSynzappApiBaseUrl } from './config';
import {
  getAppCheckHeader,
  getSynzappFirebaseAuth
} from './firebase';

export interface BackendAuthSession {
  access: 'ACTIVE' | 'BLOCKED' | 'PROFILE_REQUIRED' | 'PENDING_PROFILE';
  claimsRefreshed: boolean;
  nextStep:
    | 'CHAT'
    | 'CONTACT_ADMIN'
    | 'CREATE_PROFILE'
    | 'EMPLOYEE_PROFILE'
    | 'OPEN_APP'
    | 'ORG_ADMIN_PROFILE'
    | 'ROLE_SELECTION'
    | 'SIGN_IN_AGAIN';
  user: {
    departmentId?: string;
    displayName?: string;
    permissions?: string[];
    phoneMasked: string;
    profileComplete?: boolean;
    profilePhotoCacheKey?: string | null;
    profilePhotoUrl?: string | null;
    role?: string;
    status: string;
    tenantId?: string;
    uid: string;
  };
}

export interface WebCurrentUserProfile {
  companyName?: string;
  departmentName?: string | null;
  displayName: string;
  phoneFormatted?: string;
  phoneMasked: string;
  profilePhotoCacheKey: string | null;
  profilePhotoUrl: string | null;
  role?: string;
  roleName?: string;
  status: string;
  tenantId?: string;
  uid: string;
}

export interface PhoneLoginSession {
  confirmation: ConfirmationResult;
  phoneNumber: string;
}

let recaptchaVerifier: RecaptchaVerifier | null = null;

export async function sendPhoneLoginCode(phoneNumber: string): Promise<PhoneLoginSession> {
  const auth = getSynzappFirebaseAuth();
  const safePhoneNumber = phoneNumber.trim();

  await requestOtpPreflight(safePhoneNumber);
  const verifier = getRecaptchaVerifier();
  const confirmation = await signInWithPhoneNumber(auth, safePhoneNumber, verifier);

  return {
    confirmation,
    phoneNumber: safePhoneNumber
  };
}

export async function verifyPhoneLoginCode(
  phoneSession: PhoneLoginSession,
  code: string
): Promise<BackendAuthSession> {
  const credentialResult = await phoneSession.confirmation.confirm(code.trim());
  const user = credentialResult?.user || getSynzappFirebaseAuth().currentUser;

  if (!user) {
    throw new Error('Unable to verify this phone session.');
  }

  const idToken = await user.getIdToken(true);

  return verifyBackendAuthSession(idToken, 'login');
}

export async function getCurrentWebUserProfile(): Promise<WebCurrentUserProfile> {
  const user = getSynzappFirebaseAuth().currentUser;

  if (!user) {
    throw new Error('You are not signed in.');
  }

  const idToken = await user.getIdToken();
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/auth/web-profile`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...await getAppCheckHeader()
    },
    method: 'GET'
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'Your profile could not be loaded.'));
  }

  const body = await response.json() as { profile?: WebCurrentUserProfile };

  if (!body.profile) {
    throw new Error('Your profile could not be loaded.');
  }

  return {
    ...body.profile,
    profilePhotoUrl: normalizeApiUrl(body.profile.profilePhotoUrl)
  };
}

export async function getCurrentWebProfilePhotoObjectUrl(): Promise<string | null> {
  const user = getSynzappFirebaseAuth().currentUser;

  if (!user) {
    throw new Error('You are not signed in.');
  }

  const idToken = await user.getIdToken();
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/auth/web-profile/photo`, {
    headers: {
      Accept: 'image/*',
      Authorization: `Bearer ${idToken}`,
      ...await getAppCheckHeader()
    },
    method: 'GET'
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'Your profile photo could not be loaded.'));
  }

  return URL.createObjectURL(await response.blob());
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
      'Content-Type': 'application/json',
      ...await getAppCheckHeader()
    },
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'Your secure session could not be verified.'));
  }

  return response.json() as Promise<BackendAuthSession>;
}

function normalizeApiUrl(url?: string | null): string | null {
  if (!url) {
    return null;
  }

  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) {
    return url;
  }

  return `${getSynzappApiBaseUrl()}${url.startsWith('/') ? '' : '/'}${url}`;
}

async function requestOtpPreflight(phoneNumber: string): Promise<void> {
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/auth/otp/preflight`, {
    body: JSON.stringify({ phoneNumber }),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...await getAppCheckHeader()
    },
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'We could not send a code right now.'));
  }
}

function getRecaptchaVerifier(): RecaptchaVerifier {
  if (recaptchaVerifier) {
    return recaptchaVerifier;
  }

  recaptchaVerifier = new RecaptchaVerifier(
    getSynzappFirebaseAuth(),
    'synzapp-recaptcha',
    {
      size: 'invisible'
    }
  );

  return recaptchaVerifier;
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
