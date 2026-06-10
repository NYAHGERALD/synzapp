import { DecodedIdToken } from 'firebase-admin/auth';
import {
  adminAuth,
  fieldValue,
  firestore
} from '../config/firebaseAdmin.js';
import { SynzappRole } from '../types/auth.js';
import { buildAuthSession } from './authSessionService.js';
import type { ApprovedEmployeeResponse } from './employeeInviteService.js';
import { mergePermissions } from './permissionCatalog.js';

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
  name?: string;
  permissions?: string[];
  roleId?: string;
  status?: string;
  tenantId?: string;
}

interface TenantUserRecord {
  role?: SynzappRole;
  status?: string;
  tenantId?: string;
}

export interface EmployeeRoleAssignmentResult {
  employee: ApprovedEmployeeResponse;
  employeeUid: string | null;
  tenantId: string;
}

export async function updateEmployeeCompanyRole(
  decodedToken: DecodedIdToken,
  approvedPhoneId: string,
  roleId: string
): Promise<EmployeeRoleAssignmentResult> {
  const context = await requireUserAdmin(decodedToken);
  const safeApprovedPhoneId = approvedPhoneId.trim();
  const safeRoleId = roleId.trim();

  if (!safeApprovedPhoneId) {
    throw validationError('Employee was not found.');
  }

  if (!safeRoleId) {
    throw validationError('Select an active role before updating this employee.');
  }

  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const approvedPhoneRef = organizationRef.collection('approvedPhones').doc(safeApprovedPhoneId);
  const roleRef = organizationRef.collection('roles').doc(safeRoleId);
  const claimsVersion = Date.now();
  let employeeUid: string | null = null;
  let employeeRole: SynzappRole = 'EMPLOYEE';
  let effectivePermissions: string[] = [];

  await firestore.runTransaction(async (transaction) => {
    const [approvedPhoneSnapshot, roleSnapshot] = await Promise.all([
      transaction.get(approvedPhoneRef),
      transaction.get(roleRef)
    ]);

    if (!approvedPhoneSnapshot.exists) {
      throw notFoundError('Employee was not found.');
    }

    if (!roleSnapshot.exists) {
      throw validationError('Select an active role before updating this employee.');
    }

    const approvedPhone = approvedPhoneSnapshot.data() as ApprovedEmployeeRecord;
    const tenantRole = roleSnapshot.data() as TenantRoleRecord;
    const currentRole = approvedPhone.role || 'EMPLOYEE';
    const phoneHash = approvedPhone.phoneHash || safeApprovedPhoneId;
    const globalApprovedPhoneRef = firestore.collection('approvedPhoneDirectory').doc(phoneHash);

    if (
      approvedPhone.tenantId !== context.tenantId ||
      (currentRole !== 'EMPLOYEE' && currentRole !== 'DEPT_ADMIN')
    ) {
      throw notFoundError('Employee was not found.');
    }

    if (approvedPhone.status !== 'ACTIVE' && approvedPhone.status !== 'INVITED') {
      throw validationError('Only active or invited employees can receive role changes.');
    }

    if (tenantRole.tenantId !== context.tenantId || tenantRole.status !== 'ACTIVE') {
      throw validationError('Select an active role before updating this employee.');
    }

    employeeUid = approvedPhone.employeeUid || approvedPhone.claimedByUid || null;
    employeeRole = currentRole;
    const rolePermissions = tenantRole.permissions || [];
    const departmentAdminPermissions = currentRole === 'DEPT_ADMIN'
      ? approvedPhone.departmentAdminPermissions || []
      : [];

    effectivePermissions = mergePermissions(rolePermissions, departmentAdminPermissions);
    const roleName = tenantRole.name || 'Role';
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
        (user.role !== 'EMPLOYEE' && user.role !== 'DEPT_ADMIN')
      )
    ) {
      throw notFoundError('Employee profile was not found.');
    }

    transaction.set(
      approvedPhoneRef,
      {
        permissions: effectivePermissions,
        roleId: safeRoleId,
        roleName,
        roleUpdatedAt: fieldValue.serverTimestamp(),
        roleUpdatedBy: context.uid,
        updatedAt: fieldValue.serverTimestamp()
      },
      { merge: true }
    );
    transaction.set(
      globalApprovedPhoneRef,
      {
        permissions: effectivePermissions,
        role: currentRole,
        roleId: safeRoleId,
        roleUpdatedAt: fieldValue.serverTimestamp(),
        roleUpdatedBy: context.uid,
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
        permissions: effectivePermissions,
        roleId: safeRoleId,
        roleName,
        roleUpdatedAt: fieldValue.serverTimestamp(),
        roleUpdatedBy: context.uid,
        updatedAt: fieldValue.serverTimestamp()
      },
      { merge: true }
    );
    transaction.set(
      identityRef,
      {
        claimsVersion,
        permissions: effectivePermissions,
        roleUpdatedAt: fieldValue.serverTimestamp(),
        roleUpdatedBy: context.uid,
        updatedAt: fieldValue.serverTimestamp()
      },
      { merge: true }
    );
  });

  if (employeeUid) {
    await adminAuth.setCustomUserClaims(employeeUid, {
      claimsVersion,
      permissions: effectivePermissions,
      role: employeeRole,
      status: 'ACTIVE',
      tenantId: context.tenantId
    });
  }

  const refreshedSnapshot = await approvedPhoneRef.get();

  if (!refreshedSnapshot.exists) {
    throw notFoundError('Employee was not found.');
  }

  return {
    employee: mapRoleAssignedEmployee(refreshedSnapshot.data() as ApprovedEmployeeRecord, refreshedSnapshot.id),
    employeeUid,
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
    throw authorizationError('You do not have permission to manage employee roles.');
  }

  return {
    permissions,
    tenantId,
    uid: decodedToken.uid
  };
}

function mapRoleAssignedEmployee(
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
