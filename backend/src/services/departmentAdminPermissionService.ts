import { DecodedIdToken } from 'firebase-admin/auth';
import {
  adminAuth,
  fieldValue,
  firestore
} from '../config/firebaseAdmin.js';
import { SynzappRole } from '../types/auth.js';
import { buildAuthSession } from './authSessionService.js';
import type { ApprovedEmployeeResponse } from './employeeInviteService.js';
import {
  assertDepartmentAdminPermissions,
  DEPARTMENT_ADMIN_PERMISSION_CATALOG,
  mergePermissions,
  PermissionCatalogItem
} from './permissionCatalog.js';

interface TenantAdminContext {
  permissions: string[];
  tenantId: string;
  uid: string;
}

interface ApprovedEmployeeRecord {
  approvedPhoneId?: string;
  claimedByUid?: string;
  departmentAdminPermissions?: string[];
  departmentId?: string;
  departmentName?: string;
  displayName?: string | null;
  employeeUid?: string;
  permissions?: string[];
  phoneHash?: string;
  phoneLast4?: string;
  phoneMasked?: string;
  profilePhotoStoragePath?: string | null;
  profilePhotoVersion?: number | null;
  role?: SynzappRole;
  roleId?: string;
  roleName?: string;
  status?: string;
  tenantId?: string;
}

interface TenantRoleRecord {
  permissions?: string[];
  status?: string;
  tenantId?: string;
}

interface TenantUserRecord {
  role?: SynzappRole;
  status?: string;
  tenantId?: string;
}

export interface DepartmentAdminPermissionUpdateResult {
  employee: ApprovedEmployeeResponse;
  employeeUid: string | null;
  permissions: string[];
  tenantId: string;
}

export async function listDepartmentAdminPermissionCatalog(
  decodedToken: DecodedIdToken
): Promise<PermissionCatalogItem[]> {
  await requireUserAdmin(decodedToken);

  return DEPARTMENT_ADMIN_PERMISSION_CATALOG;
}

export async function updateEmployeeDepartmentAdminPermissions(
  decodedToken: DecodedIdToken,
  approvedPhoneId: string,
  permissions: string[]
): Promise<DepartmentAdminPermissionUpdateResult> {
  const context = await requireUserAdmin(decodedToken);
  const safeApprovedPhoneId = approvedPhoneId.trim();
  const departmentAdminPermissions = assertDepartmentAdminPermissions(permissions);

  if (!safeApprovedPhoneId) {
    throw validationError('Employee was not found.');
  }

  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const approvedPhoneRef = organizationRef.collection('approvedPhones').doc(safeApprovedPhoneId);
  const claimsVersion = Date.now();
  let employeeUid: string | null = null;
  let effectivePermissions: string[] = [];

  await firestore.runTransaction(async (transaction) => {
    const approvedPhoneSnapshot = await transaction.get(approvedPhoneRef);

    if (!approvedPhoneSnapshot.exists) {
      throw notFoundError('Employee was not found.');
    }

    const approvedPhone = approvedPhoneSnapshot.data() as ApprovedEmployeeRecord;
    const phoneHash = approvedPhone.phoneHash || safeApprovedPhoneId;
    const globalApprovedPhoneRef = firestore.collection('approvedPhoneDirectory').doc(phoneHash);
    const roleRef = approvedPhone.roleId
      ? organizationRef.collection('roles').doc(approvedPhone.roleId)
      : null;
    const roleSnapshot = roleRef ? await transaction.get(roleRef) : null;

    if (
      approvedPhone.tenantId !== context.tenantId ||
      approvedPhone.role !== 'DEPT_ADMIN'
    ) {
      throw validationError('Only Department Admin employees can receive Department Admin permissions.');
    }

    if (approvedPhone.status !== 'ACTIVE' && approvedPhone.status !== 'INVITED') {
      throw validationError('Only active or invited Department Admins can be updated.');
    }

    employeeUid = approvedPhone.employeeUid || approvedPhone.claimedByUid || null;
    const userRef = employeeUid
      ? organizationRef.collection('users').doc(employeeUid)
      : null;
    const identityRef = employeeUid
      ? firestore.collection('identityDirectory').doc(employeeUid)
      : null;
    const userSnapshot = userRef ? await transaction.get(userRef) : null;

    if (userRef && (!userSnapshot || !userSnapshot.exists)) {
      throw notFoundError('Employee profile was not found.');
    }

    const user = userSnapshot?.data() as TenantUserRecord | undefined;

    if (
      user &&
      (
        user.tenantId !== context.tenantId ||
        user.status !== 'ACTIVE' ||
        user.role !== 'DEPT_ADMIN'
      )
    ) {
      throw notFoundError('Employee profile was not found.');
    }

    const companyRolePermissions = getCompanyRolePermissions(
      roleSnapshot?.data() as TenantRoleRecord | undefined,
      context.tenantId
    );

    effectivePermissions = mergePermissions(companyRolePermissions, departmentAdminPermissions);

    transaction.set(
      approvedPhoneRef,
      {
        departmentAdminPermissions,
        permissions: effectivePermissions,
        permissionsUpdatedAt: fieldValue.serverTimestamp(),
        permissionsUpdatedBy: context.uid,
        updatedAt: fieldValue.serverTimestamp()
      },
      { merge: true }
    );
    transaction.set(
      globalApprovedPhoneRef,
      {
        departmentAdminPermissions,
        permissions: effectivePermissions,
        permissionsUpdatedAt: fieldValue.serverTimestamp(),
        permissionsUpdatedBy: context.uid,
        updatedAt: fieldValue.serverTimestamp()
      },
      { merge: true }
    );

    if (!userRef || !identityRef) {
      return;
    }

    transaction.set(
      userRef,
      {
        departmentAdminPermissions,
        permissions: effectivePermissions,
        permissionsUpdatedAt: fieldValue.serverTimestamp(),
        permissionsUpdatedBy: context.uid,
        updatedAt: fieldValue.serverTimestamp()
      },
      { merge: true }
    );
    transaction.set(
      identityRef,
      {
        claimsVersion,
        departmentAdminPermissions,
        permissions: effectivePermissions,
        permissionsUpdatedAt: fieldValue.serverTimestamp(),
        permissionsUpdatedBy: context.uid,
        updatedAt: fieldValue.serverTimestamp()
      },
      { merge: true }
    );
  });

  if (employeeUid) {
    await adminAuth.setCustomUserClaims(employeeUid, {
      claimsVersion,
      permissions: effectivePermissions,
      role: 'DEPT_ADMIN',
      status: 'ACTIVE',
      tenantId: context.tenantId
    });
  }

  const refreshedSnapshot = await approvedPhoneRef.get();

  if (!refreshedSnapshot.exists) {
    throw notFoundError('Employee was not found.');
  }

  return {
    employee: mapApprovedEmployee(refreshedSnapshot.data() as ApprovedEmployeeRecord, refreshedSnapshot.id),
    employeeUid,
    permissions: departmentAdminPermissions,
    tenantId: context.tenantId
  };
}

async function requireUserAdmin(decodedToken: DecodedIdToken): Promise<TenantAdminContext> {
  const session = await buildAuthSession(decodedToken);
  const { permissions, role, status, tenantId } = session.user;

  if (session.access !== 'ACTIVE' || !tenantId || status !== 'ACTIVE') {
    throw authorizationError('Your admin session is not active.');
  }

  if (role !== 'ORG_ADMIN' || !permissions.includes('users.manage')) {
    throw authorizationError('You do not have permission to manage Department Admin permissions.');
  }

  return {
    permissions,
    tenantId,
    uid: decodedToken.uid
  };
}

function getCompanyRolePermissions(role: TenantRoleRecord | undefined, tenantId: string): string[] {
  if (!role || role.tenantId !== tenantId || role.status !== 'ACTIVE') {
    return [];
  }

  return role.permissions || [];
}

function mapApprovedEmployee(
  record: ApprovedEmployeeRecord,
  fallbackId: string
): ApprovedEmployeeResponse {
  const approvedPhoneId = record.approvedPhoneId || fallbackId;

  return {
    approvedPhoneId,
    departmentAdminPermissions: record.departmentAdminPermissions || [],
    departmentId: record.departmentId || '',
    departmentName: record.departmentName || 'Department',
    displayName: record.displayName || null,
    phoneLast4: record.phoneLast4 || '',
    phoneMasked: record.phoneMasked || '*****',
    profilePhotoCacheKey: record.profilePhotoStoragePath
      ? `approved-employee-photo-${approvedPhoneId}-${record.profilePhotoVersion || 1}`
      : null,
    profilePhotoUrl: record.profilePhotoStoragePath
      ? `/api/admin/employees/${encodeURIComponent(approvedPhoneId)}/photo?v=${encodeURIComponent(String(record.profilePhotoVersion || 1))}`
      : null,
    permissions: record.permissions || [],
    role: record.role || 'EMPLOYEE',
    roleId: record.roleId || '',
    roleName: record.roleName || 'Role',
    status: record.status || 'INVITED',
    tenantId: record.tenantId || ''
  };
}

function authorizationError(message: string): Error {
  const error = new Error(message);
  error.name = 'AuthorizationError';
  return error;
}

function notFoundError(message: string): Error {
  const error = new Error(message);
  error.name = 'NotFoundError';
  return error;
}

function validationError(message: string): Error {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
}
