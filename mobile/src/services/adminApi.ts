import { getSynzappApiBaseUrl, normalizeSynzappApiUrl } from './apiConfig';
import { getRegisteredDeviceHeaders } from './deviceIdentity';
import type { ChatBackupPolicy } from './chatBackup';

export interface TenantDepartment {
  departmentId: string;
  description: string | null;
  name: string;
  status: string;
}

export interface TenantRole {
  description: string | null;
  name: string;
  permissions: string[];
  roleId: string;
  status: string;
}

export interface DepartmentAdminPermission {
  description: string;
  permission: string;
  title: string;
}

export type RolePermission = DepartmentAdminPermission;

export interface TenantGroup {
  autoMembershipDepartmentId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  description: string | null;
  groupId: string;
  isDepartmentDefault: boolean;
  memberCount: number;
  memberPolicy: 'DEPARTMENT_PLUS_EXPLICIT' | 'EXPLICIT';
  name: string;
  scope: 'COMPANY' | 'DEPARTMENT';
  status: string;
  systemManaged: boolean;
  tenantId: string;
}

export interface ApprovedEmployee {
  approvedPhoneId: string;
  departmentAdminPermissions: string[];
  departmentId: string;
  departmentName: string;
  displayName: string | null;
  phoneFormatted?: string | null;
  phoneLast4: string;
  phoneMasked: string;
  profilePhotoCacheKey: string | null;
  profilePhotoUrl: string | null;
  permissions: string[];
  role: string;
  roleId: string;
  roleName: string;
  status: string;
}

export type EmployeeLifecycleAction =
  | 'DEACTIVATE'
  | 'ARCHIVE'
  | 'DELETE'
  | 'ANONYMIZE'
  | 'PERMANENT_DELETE'
  | 'REMOVE_INVITE'
  | 'REACTIVATE';

export interface TenantDevice {
  createdAt: string | null;
  cryptoProvider: string;
  deviceId: string;
  displayName: string;
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

export interface CompanyProfile {
  calendarYearStartDate: string;
  calendarYearStartDay: number;
  calendarYearStartMonth: number;
  calendarYearStartYear: number;
  calendarYearWeekOneStartsOn: string;
  companyAddress: string;
  companyLogoCacheKey: string | null;
  companyLogoUrl: string | null;
  companyName: string;
  companySlug: string;
  createdAt: string | null;
  retentionPolicy: string;
  securityMode: string;
  status: string;
  tenantId: string;
  updatedAt: string | null;
}

export interface KeyResultUnit {
  icon: string;
  label: string;
  sortOrder: number;
  status: string;
  suffix: string;
  unitId: string;
}

export interface KeyResultMetric {
  key: string;
  metricId: string;
  sortOrder: number;
  status: string;
  unitId: string;
  value: string;
}

export interface KeyResultGroup {
  groupId: string;
  metrics: KeyResultMetric[];
  name: string;
  sortOrder: number;
  status: string;
}

export interface CompanyKeyResultsConfig {
  groups: KeyResultGroup[];
  units: KeyResultUnit[];
  updatedAt: string | null;
  updatedByUid: string | null;
}

export interface OrganizationDeletionChallenge {
  challengeId: string;
  companyName: string;
  expiresAt: string;
  requiredConfirmation: string;
  tenantId: string;
}

export interface OrganizationDeletionResult {
  deleted: boolean;
  revokedUserCount: number;
  tenantId: string;
}

interface CreateTenantRecordInput {
  description?: string;
  idToken: string;
  name: string;
}

interface InviteEmployeeContactsInput {
  contacts: Array<{
    displayName?: string;
    phoneNumber: string;
  }>;
  departmentId: string;
  idToken: string;
  roleId: string;
}

interface CreateTenantGroupInput {
  departmentId?: string | null;
  description?: string;
  idToken: string;
  name: string;
}

export async function listDepartments(idToken: string): Promise<TenantDepartment[]> {
  const response = await adminFetch('/api/admin/departments', idToken);
  const body = await response.json() as { departments?: TenantDepartment[] };

  return body.departments || [];
}

export async function createDepartment(input: CreateTenantRecordInput): Promise<TenantDepartment> {
  const response = await adminFetch('/api/admin/departments', input.idToken, {
    body: JSON.stringify({
      description: input.description,
      name: input.name
    }),
    method: 'POST'
  });
  const body = await response.json() as { department: TenantDepartment };

  return body.department;
}

export async function listRoles(idToken: string): Promise<TenantRole[]> {
  const response = await adminFetch('/api/admin/roles', idToken);
  const body = await response.json() as { roles?: TenantRole[] };

  return body.roles || [];
}

export async function listRolePermissionCatalog(idToken: string): Promise<RolePermission[]> {
  const response = await adminFetch('/api/admin/role-permissions', idToken);
  const body = await response.json() as { permissions?: RolePermission[] };

  return body.permissions || [];
}

export async function listDepartmentAdminPermissionCatalog(idToken: string): Promise<DepartmentAdminPermission[]> {
  const response = await adminFetch('/api/admin/department-admin-permissions', idToken);
  const body = await response.json() as { permissions?: DepartmentAdminPermission[] };

  return body.permissions || [];
}

export async function createRole(input: CreateTenantRecordInput): Promise<TenantRole> {
  const response = await adminFetch('/api/admin/roles', input.idToken, {
    body: JSON.stringify({
      description: input.description,
      name: input.name
    }),
    method: 'POST'
  });
  const body = await response.json() as { role: TenantRole };

  return body.role;
}

export async function updateRolePermissions(input: {
  idToken: string;
  permissions: string[];
  roleId: string;
}): Promise<TenantRole> {
  const response = await adminFetch(
    `/api/admin/roles/${encodeURIComponent(input.roleId)}/permissions`,
    input.idToken,
    {
      body: JSON.stringify({
        permissions: input.permissions
      }),
      method: 'PATCH'
    }
  );
  const body = await response.json() as { role: TenantRole };

  return body.role;
}

export async function listApprovedEmployees(idToken: string): Promise<ApprovedEmployee[]> {
  const response = await adminFetch('/api/admin/employees', idToken);
  const body = await response.json() as { employees?: ApprovedEmployee[] };

  return (body.employees || []).map(normalizeApprovedEmployee);
}

export async function listTenantGroups(idToken: string): Promise<TenantGroup[]> {
  const response = await adminFetch('/api/admin/groups', idToken);
  const body = await response.json() as { groups?: TenantGroup[] };

  return (body.groups || []).map(normalizeTenantGroup);
}

export async function listCurrentUserGroups(idToken: string): Promise<TenantGroup[]> {
  const response = await adminFetch('/api/profile/groups', idToken);
  const body = await response.json() as { groups?: TenantGroup[] };

  return (body.groups || []).map(normalizeTenantGroup);
}

export async function createTenantGroup(input: CreateTenantGroupInput): Promise<TenantGroup> {
  const response = await adminFetch('/api/admin/groups', input.idToken, {
    body: JSON.stringify({
      departmentId: input.departmentId || null,
      description: input.description,
      name: input.name
    }),
    method: 'POST'
  });
  const body = await response.json() as { group: TenantGroup };

  return normalizeTenantGroup(body.group);
}

export async function getCompanyProfile(idToken: string): Promise<CompanyProfile> {
  const response = await adminFetch('/api/admin/company-profile', idToken);
  const body = await response.json() as { companyProfile: CompanyProfile };

  return normalizeCompanyProfile(body.companyProfile);
}

export async function updateCompanyProfile(input: {
  calendarYearStartDate: string;
  companyAddress: string;
  companyName: string;
  idToken: string;
}): Promise<CompanyProfile> {
  const response = await adminFetch('/api/admin/company-profile', input.idToken, {
    body: JSON.stringify({
      calendarYearStartDate: input.calendarYearStartDate,
      companyAddress: input.companyAddress,
      companyName: input.companyName
    }),
    method: 'PATCH'
  });
  const body = await response.json() as { companyProfile: CompanyProfile };

  return normalizeCompanyProfile(body.companyProfile);
}

export async function updateCompanyLogo(input: {
  companyLogoDataUrl: string;
  idToken: string;
}): Promise<CompanyProfile> {
  const response = await adminFetch('/api/admin/company-profile/logo', input.idToken, {
    body: JSON.stringify({
      companyLogoDataUrl: input.companyLogoDataUrl
    }),
    method: 'POST'
  });
  const body = await response.json() as { companyProfile: CompanyProfile };

  return normalizeCompanyProfile(body.companyProfile);
}

export async function getCompanyKeyResults(idToken: string): Promise<CompanyKeyResultsConfig> {
  const response = await adminFetch('/api/admin/key-results', idToken);
  const body = await response.json() as { keyResults: CompanyKeyResultsConfig };

  return normalizeCompanyKeyResults(body.keyResults);
}

export async function updateCompanyKeyResults(input: {
  idToken: string;
  keyResults: Pick<CompanyKeyResultsConfig, 'groups' | 'units'>;
}): Promise<CompanyKeyResultsConfig> {
  const response = await adminFetch('/api/admin/key-results', input.idToken, {
    body: JSON.stringify(input.keyResults),
    method: 'PATCH'
  });
  const body = await response.json() as { keyResults: CompanyKeyResultsConfig };

  return normalizeCompanyKeyResults(body.keyResults);
}

export async function requestOrganizationDeletionChallenge(
  idToken: string
): Promise<OrganizationDeletionChallenge> {
  const response = await adminFetch('/api/admin/organization-deletion/challenge', idToken, {
    body: JSON.stringify({}),
    method: 'POST'
  });
  const body = await response.json() as { challenge: OrganizationDeletionChallenge };

  return body.challenge;
}

export async function confirmOrganizationDeletion(input: {
  challengeId: string;
  confirmationText: string;
  idToken: string;
}): Promise<OrganizationDeletionResult> {
  const response = await adminFetch('/api/admin/organization-deletion/confirm', input.idToken, {
    body: JSON.stringify({
      challengeId: input.challengeId,
      confirmationText: input.confirmationText
    }),
    method: 'POST'
  });
  const body = await response.json() as { result: OrganizationDeletionResult };

  return body.result;
}

export async function inviteEmployeeContacts(
  input: InviteEmployeeContactsInput
): Promise<ApprovedEmployee[]> {
  const response = await adminFetch('/api/admin/employees/invite', input.idToken, {
    body: JSON.stringify({
      contacts: input.contacts,
      departmentId: input.departmentId,
      roleId: input.roleId
    }),
    method: 'POST'
  });
  const body = await response.json() as { employees?: ApprovedEmployee[] };

  return (body.employees || []).map(normalizeApprovedEmployee);
}

export async function updateEmployeeLifecycle(input: {
  action: EmployeeLifecycleAction;
  approvedPhoneId: string;
  idToken: string;
  reason?: string;
}): Promise<ApprovedEmployee> {
  const response = await adminFetch(
    `/api/admin/employees/${encodeURIComponent(input.approvedPhoneId)}/lifecycle`,
    input.idToken,
    {
      body: JSON.stringify({
        action: input.action,
        reason: input.reason
      }),
      method: 'PATCH'
    }
  );
  const body = await response.json() as { employee: ApprovedEmployee };

  return normalizeApprovedEmployee(body.employee);
}

export async function updateEmployeeRole(input: {
  approvedPhoneId: string;
  idToken: string;
  roleId: string;
}): Promise<ApprovedEmployee> {
  const response = await adminFetch(
    `/api/admin/employees/${encodeURIComponent(input.approvedPhoneId)}/role`,
    input.idToken,
    {
      body: JSON.stringify({
        roleId: input.roleId
      }),
      method: 'PATCH'
    }
  );
  const body = await response.json() as { employee: ApprovedEmployee };

  return normalizeApprovedEmployee(body.employee);
}

export async function updateEmployeeDepartmentAdminAssignment(input: {
  approvedPhoneId: string;
  enabled: boolean;
  idToken: string;
}): Promise<ApprovedEmployee> {
  const response = await adminFetch(
    `/api/admin/employees/${encodeURIComponent(input.approvedPhoneId)}/department-admin`,
    input.idToken,
    {
      body: JSON.stringify({
        enabled: input.enabled
      }),
      method: 'PATCH'
    }
  );
  const body = await response.json() as { employee: ApprovedEmployee };

  return normalizeApprovedEmployee(body.employee);
}

export async function updateEmployeeDepartmentAdminPermissions(input: {
  approvedPhoneId: string;
  idToken: string;
  permissions: string[];
}): Promise<ApprovedEmployee> {
  const response = await adminFetch(
    `/api/admin/employees/${encodeURIComponent(input.approvedPhoneId)}/department-admin-permissions`,
    input.idToken,
    {
      body: JSON.stringify({
        permissions: input.permissions
      }),
      method: 'PATCH'
    }
  );
  const body = await response.json() as { employee: ApprovedEmployee };

  return normalizeApprovedEmployee(body.employee);
}

export async function listTenantDevices(idToken: string): Promise<TenantDevice[]> {
  const response = await adminFetch('/api/admin/devices', idToken);
  const body = await response.json() as { devices?: TenantDevice[] };

  return body.devices || [];
}

export async function revokeTenantDevice(input: {
  deviceId: string;
  idToken: string;
  reason?: string;
}): Promise<TenantDevice> {
  const response = await adminFetch(
    `/api/admin/devices/${encodeURIComponent(input.deviceId)}/revoke`,
    input.idToken,
    {
      body: JSON.stringify({
        reason: input.reason
      }),
      method: 'POST'
    }
  );
  const body = await response.json() as { device: TenantDevice };

  return body.device;
}

export async function updateTenantChatBackupPolicy(input: {
  encryptedBackupsEnabled: boolean;
  idToken: string;
  selfRestoreEnabled: boolean;
}): Promise<ChatBackupPolicy> {
  const response = await adminFetch('/api/admin/chat-backup-policy', input.idToken, {
    body: JSON.stringify({
      encryptedBackupsEnabled: input.encryptedBackupsEnabled,
      selfRestoreEnabled: input.selfRestoreEnabled
    }),
    method: 'PATCH'
  });
  const body = await response.json() as { policy: ChatBackupPolicy };

  return body.policy;
}

async function adminFetch(path: string, idToken: string, init: RequestInit = {}): Promise<Response> {
  const deviceHeaders = await getRegisteredDeviceHeaders(idToken);
  const response = await fetch(`${getSynzappApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      ...deviceHeaders,
      ...init.headers
    }
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return response;
}

async function getResponseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();

    if (typeof body?.error === 'string') {
      return body.error;
    }
  } catch {
    return `Unable to complete request (${response.status}). Please try again.`;
  }

  return `Unable to complete request (${response.status}). Please try again.`;
}

function normalizeApprovedEmployee(employee: ApprovedEmployee): ApprovedEmployee {
  return {
    ...employee,
    departmentAdminPermissions: employee.departmentAdminPermissions || [],
    permissions: employee.permissions || [],
    profilePhotoUrl: normalizeSynzappApiUrl(employee.profilePhotoUrl)
  };
}

function normalizeCompanyProfile(profile: CompanyProfile): CompanyProfile {
  return {
    ...profile,
    calendarYearStartDate: profile.calendarYearStartDate || '',
    calendarYearStartDay: Number.isInteger(profile.calendarYearStartDay) ? profile.calendarYearStartDay : 1,
    calendarYearStartMonth: Number.isInteger(profile.calendarYearStartMonth) ? profile.calendarYearStartMonth : 1,
    calendarYearStartYear: Number.isInteger(profile.calendarYearStartYear) ? profile.calendarYearStartYear : new Date().getFullYear(),
    calendarYearWeekOneStartsOn: profile.calendarYearWeekOneStartsOn || 'CALENDAR_YEAR_START',
    companyLogoUrl: normalizeSynzappApiUrl(profile.companyLogoUrl)
  };
}

function normalizeCompanyKeyResults(config: CompanyKeyResultsConfig): CompanyKeyResultsConfig {
  return {
    groups: (config.groups || []).map((group) => ({
      ...group,
      metrics: group.metrics || [],
      status: group.status || 'ACTIVE'
    })),
    units: config.units || [],
    updatedAt: config.updatedAt || null,
    updatedByUid: config.updatedByUid || null
  };
}

function normalizeTenantGroup(group: TenantGroup): TenantGroup {
  return {
    ...group,
    autoMembershipDepartmentId: group.autoMembershipDepartmentId || null,
    departmentId: group.departmentId || null,
    departmentName: group.departmentName || null,
    isDepartmentDefault: group.isDepartmentDefault === true,
    memberCount: group.memberCount || 0,
    memberPolicy: group.memberPolicy === 'DEPARTMENT_PLUS_EXPLICIT'
      ? 'DEPARTMENT_PLUS_EXPLICIT'
      : 'EXPLICIT',
    systemManaged: group.systemManaged === true
  };
}
