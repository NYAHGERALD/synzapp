import { SessionAccess, SynzappRole, SynzappUserStatus } from '../types/auth.js';

export interface ActiveSessionPolicyInput {
  access?: SessionAccess | string;
  permissions?: string[];
  role?: SynzappRole | string;
  status?: SynzappUserStatus | string;
  tenantId?: string | null;
}

export interface TenantResourcePolicyInput extends ActiveSessionPolicyInput {
  resourceTenantId?: string | null;
}

export interface DepartmentScopedPolicyInput extends TenantResourcePolicyInput {
  resourceDepartmentId?: string | null;
  userDepartmentId?: string | null;
}

export interface DirectChatPolicyInput extends TenantResourcePolicyInput {
  participantIds?: string[];
  requesterUid?: string | null;
}

export interface DirectEnvelopePolicyInput extends DirectChatPolicyInput {
  recipientUid?: string | null;
  senderUid?: string | null;
}

export interface GroupChatPolicyInput extends TenantResourcePolicyInput {
  memberIds?: string[];
  requesterUid?: string | null;
}

export interface GroupEnvelopePolicyInput extends GroupChatPolicyInput {
  recipientUids?: string[];
  senderUid?: string | null;
}

export interface OwnResourcePolicyInput extends TenantResourcePolicyInput {
  ownerUid?: string | null;
  requesterUid?: string | null;
}

export function isActiveTenantSession(input: ActiveSessionPolicyInput): boolean {
  return (
    input.access === 'ACTIVE' &&
    input.status === 'ACTIVE' &&
    hasText(input.tenantId) &&
    isKnownRole(input.role)
  );
}

export function canAccessTenantResource(input: TenantResourcePolicyInput): boolean {
  return (
    isActiveTenantSession(input) &&
    hasText(input.resourceTenantId) &&
    input.tenantId === input.resourceTenantId
  );
}

export function canOrgAdminUsePermission(
  input: TenantResourcePolicyInput,
  permission: string
): boolean {
  return (
    canAccessTenantResource(defaultResourceTenant(input)) &&
    input.role === 'ORG_ADMIN' &&
    hasPermission(input.permissions, permission)
  );
}

export function canDepartmentAdminUseScopedPermission(
  input: DepartmentScopedPolicyInput,
  permission: string
): boolean {
  return (
    canAccessTenantResource(defaultResourceTenant(input)) &&
    input.role === 'DEPT_ADMIN' &&
    hasPermission(input.permissions, permission) &&
    hasText(input.userDepartmentId) &&
    hasText(input.resourceDepartmentId) &&
    input.userDepartmentId === input.resourceDepartmentId
  );
}

export function canManageTenantGroup(input: DepartmentScopedPolicyInput): boolean {
  return (
    canOrgAdminUsePermission(input, 'groups.manage') ||
    canDepartmentAdminUseScopedPermission(input, 'groups.create')
  );
}

export function canInviteEmployeeToDepartment(input: DepartmentScopedPolicyInput): boolean {
  return (
    canOrgAdminUsePermission(input, 'users.invite') ||
    canOrgAdminUsePermission(input, 'users.manage') ||
    canDepartmentAdminUseScopedPermission(input, 'users.invite')
  );
}

export function canViewDepartmentEmployees(input: DepartmentScopedPolicyInput): boolean {
  return (
    canOrgAdminUsePermission(input, 'users.manage') ||
    canOrgAdminUsePermission(input, 'users.invite') ||
    canDepartmentAdminUseScopedPermission(input, 'users.invite')
  );
}

export function canAccessOwnResource(input: OwnResourcePolicyInput): boolean {
  return (
    canAccessTenantResource(defaultResourceTenant(input)) &&
    hasText(input.requesterUid) &&
    hasText(input.ownerUid) &&
    input.requesterUid === input.ownerUid
  );
}

export function canReadDirectChat(input: DirectChatPolicyInput): boolean {
  return (
    canAccessTenantResource(defaultResourceTenant(input)) &&
    hasText(input.requesterUid) &&
    Array.isArray(input.participantIds) &&
    input.participantIds.includes(input.requesterUid)
  );
}

export function canReadDirectEnvelope(input: DirectEnvelopePolicyInput): boolean {
  return (
    canReadDirectChat(input) &&
    hasText(input.requesterUid) &&
    (
      input.senderUid === input.requesterUid ||
      input.recipientUid === input.requesterUid
    )
  );
}

export function canReadGroupChat(input: GroupChatPolicyInput): boolean {
  return (
    canAccessTenantResource(defaultResourceTenant(input)) &&
    hasText(input.requesterUid) &&
    Array.isArray(input.memberIds) &&
    input.memberIds.includes(input.requesterUid)
  );
}

export function canReadGroupEnvelope(input: GroupEnvelopePolicyInput): boolean {
  return (
    canReadGroupChat(input) &&
    hasText(input.requesterUid) &&
    (
      input.senderUid === input.requesterUid ||
      Boolean(input.recipientUids?.includes(input.requesterUid))
    )
  );
}

function defaultResourceTenant<T extends TenantResourcePolicyInput>(input: T): T {
  if (hasText(input.resourceTenantId)) {
    return input;
  }

  return {
    ...input,
    resourceTenantId: input.tenantId
  };
}

function hasPermission(permissions: string[] | undefined, permission: string): boolean {
  return Boolean(permissions?.includes(permission));
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isKnownRole(role: string | null | undefined): role is SynzappRole {
  return (
    role === 'ORG_ADMIN' ||
    role === 'DEPT_ADMIN' ||
    role === 'EMPLOYEE' ||
    role === 'SYSTEM_ADMIN'
  );
}
