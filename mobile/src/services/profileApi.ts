import { BackendAuthSession, EmployeeDraft, OrgAdminDraft } from '../types/auth';
import { getSynzappApiBaseUrl, normalizeSynzappApiUrl } from './apiConfig';
import { getRegisteredDeviceHeaders } from './deviceIdentity';

interface CreateOrgAdminProfileInput extends OrgAdminDraft {
  idToken: string;
  profilePhotoDataUrl?: string;
}

interface CreateOrgAdminProfileResponse {
  session: BackendAuthSession;
  warnings?: string[];
}

export interface EmployeeOnboardingContext {
  companyName: string;
  departmentId: string;
  departmentName: string;
  orgAdminName: string;
  orgAdminPhoneMasked: string;
  phoneMasked: string;
  roleId: string;
  roleName: string;
  tenantId: string;
}

export interface CurrentUserProfile {
  companyName: string;
  departmentId: string | null;
  departmentName: string | null;
  displayName: string;
  isTenantOwner: boolean;
  phoneFormatted: string;
  phoneMasked: string;
  permissions: string[];
  profilePhotoCacheKey: string | null;
  profilePhotoUrl: string | null;
  role: 'ORG_ADMIN' | 'DEPT_ADMIN' | 'EMPLOYEE' | 'SYSTEM_ADMIN';
  roleName: string;
  status: string;
  tenantId: string;
  uid: string;
}

export interface CurrentUserDevice {
  createdAt: string | null;
  cryptoProvider: string;
  deviceId: string;
  displayName: string;
  isCurrentDevice: boolean;
  keyVersion: number;
  lastSeenAt: string | null;
  platform: string;
  protocolVersion: string;
  revokedAt: string | null;
  revokedByUid: string | null;
  revocationReason: string | null;
  roleName: string;
  status: string;
  tenantId: string;
  uid: string;
}

interface CreateEmployeeProfileInput extends EmployeeDraft {
  idToken: string;
  profilePhotoDataUrl?: string;
}

interface CreateEmployeeProfileResponse {
  session: BackendAuthSession;
  warnings?: string[];
}

export async function createOrgAdminProfile(
  input: CreateOrgAdminProfileInput
): Promise<CreateOrgAdminProfileResponse> {
  if (!input.calendarYearStartDate) {
    throw new Error('Select the date your company calendar year starts.');
  }

  const response = await fetch(`${getSynzappApiBaseUrl()}/api/profile/org-admin`, {
    body: JSON.stringify({
      adminFirstName: input.adminFirstName,
      adminLastName: input.adminLastName,
      calendarYearStartDate: input.calendarYearStartDate,
      companyAddress: input.companyAddress,
      companyName: input.companyName,
      profilePhotoDataUrl: input.profilePhotoDataUrl
    }),
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${input.idToken}`,
      'Content-Type': 'application/json'
    },
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return response.json() as Promise<CreateOrgAdminProfileResponse>;
}

export async function getCurrentUserProfile(idToken: string): Promise<CurrentUserProfile> {
  const deviceHeaders = await getRegisteredDeviceHeaders(idToken);
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/profile/me`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...deviceHeaders
    },
    method: 'GET'
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  const body = await response.json() as { profile: CurrentUserProfile };

  return normalizeCurrentUserProfile(body.profile);
}

export async function updateCurrentUserProfilePhoto(input: {
  idToken: string;
  profilePhotoDataUrl: string;
}): Promise<CurrentUserProfile> {
  const deviceHeaders = await getRegisteredDeviceHeaders(input.idToken);
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/profile/me/photo`, {
    body: JSON.stringify({
      profilePhotoDataUrl: input.profilePhotoDataUrl
    }),
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${input.idToken}`,
      'Content-Type': 'application/json',
      ...deviceHeaders
    },
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  const body = await response.json() as { profile: CurrentUserProfile };

  return normalizeCurrentUserProfile(body.profile);
}

export async function listCurrentUserDevices(idToken: string): Promise<CurrentUserDevice[]> {
  const deviceHeaders = await getRegisteredDeviceHeaders(idToken);
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/profile/me/devices`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...deviceHeaders
    },
    method: 'GET'
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  const body = await response.json() as { devices?: CurrentUserDevice[] };

  return body.devices || [];
}

export async function revokeCurrentUserDevice(input: {
  deviceId: string;
  idToken: string;
  reason?: string;
}): Promise<CurrentUserDevice> {
  const deviceHeaders = await getRegisteredDeviceHeaders(input.idToken);
  const response = await fetch(
    `${getSynzappApiBaseUrl()}/api/profile/me/devices/${encodeURIComponent(input.deviceId)}/revoke`,
    {
      body: JSON.stringify({
        reason: input.reason
      }),
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.idToken}`,
        'Content-Type': 'application/json',
        ...deviceHeaders
      },
      method: 'POST'
    }
  );

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  const body = await response.json() as { device: CurrentUserDevice };

  return body.device;
}

export async function getEmployeeOnboardingContext(idToken: string): Promise<EmployeeOnboardingContext> {
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/profile/employee/context`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`
    },
    method: 'GET'
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  const body = await response.json() as { context: EmployeeOnboardingContext };

  return body.context;
}

export async function createEmployeeProfile(
  input: CreateEmployeeProfileInput
): Promise<CreateEmployeeProfileResponse> {
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/profile/employee`, {
    body: JSON.stringify({
      employeeFirstName: input.employeeFirstName,
      employeeLastName: input.employeeLastName,
      profilePhotoDataUrl: input.profilePhotoDataUrl
    }),
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${input.idToken}`,
      'Content-Type': 'application/json'
    },
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return response.json() as Promise<CreateEmployeeProfileResponse>;
}

async function getResponseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();

    if (typeof body?.error === 'string') {
      return body.error;
    }
  } catch {
    return 'Unable to create profile. Please try again.';
  }

  return 'Unable to create profile. Please try again.';
}

function normalizeCurrentUserProfile(profile: CurrentUserProfile): CurrentUserProfile {
  return {
    ...profile,
    departmentId: profile.departmentId ?? null,
    isTenantOwner: profile.isTenantOwner === true,
    permissions: profile.permissions || [],
    profilePhotoUrl: normalizeSynzappApiUrl(profile.profilePhotoUrl)
  };
}
