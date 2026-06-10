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
  DEPARTMENT_ADMIN_DEFAULT_PERMISSIONS,
  mergePermissions
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

export interface DepartmentAdminAssignmentResult {
  employee: ApprovedEmployeeResponse;
  employeeUid: string | null;
  tenantId: string;
}

export async function updateEmployeeDepartmentAdminAssignment(
  decodedToken: DecodedIdToken,
  approvedPhoneId: string,
  enabled: boolean
): Promise<DepartmentAdminAssignmentResult> {
  const context = await requireUserAdmin(decodedToken);
  const safeApprovedPhoneId = approvedPhoneId.trim();

  if (!safeApprovedPhoneId) {
    throw validationError('Employee was not found.');
  }

  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const approvedPhoneRef = organizationRef.collection('approvedPhones').doc(safeApprovedPhoneId);
  const nextRole: SynzappRole = enabled ? 'DEPT_ADMIN' : 'EMPLOYEE';
  const claimsVersion = Date.now();
  let employeeUid: string | null = null;
  let effectivePermissions: string[] = [];

  await firestore.runTransaction(async (transaction) => {
    const approvedPhoneSnapshot = await transaction.get(approvedPhoneRef);

    if (!approvedPhoneSnapshot.exists) {
      throw notFoundError('Employee was not found.');
    }

    const approvedPhone = approvedPhoneSnapshot.data() as ApprovedEmployeeRecord;
    const currentRole = approvedPhone.role || 'EMPLOYEE';
    const phoneHash = approvedPhone.phoneHash || safeApprovedPhoneId;
    const globalApprovedPhoneRef = firestore.collection('approvedPhoneDirectory').doc(phoneHash);
    const roleRef = approvedPhone.roleId
      ? organizationRef.collection('roles').doc(approvedPhone.roleId)
      : null;
    const roleSnapshot = roleRef ? await transaction.get(roleRef) : null;

    if (
      approvedPhone.tenantId !== context.tenantId ||
      (currentRole !== 'EMPLOYEE' && currentRole !== 'DEPT_ADMIN')
    ) {
      throw notFoundError('Employee was not found.');
    }

    if (approvedPhone.status !== 'ACTIVE' && approvedPhone.status !== 'INVITED') {
      throw validationError('Only active or invited employees can be assigned as department admins.');
    }

    employeeUid = approvedPhone.employeeUid || approvedPhone.claimedByUid || null;

    if (!employeeUid && phoneHash) {
      const userQuerySnapshot = await transaction.get(
        organizationRef
          .collection('users')
          .where('phoneHash', '==', phoneHash)
          .limit(1)
      );
      employeeUid = userQuerySnapshot.docs[0]?.id || null;
    }

    const companyRolePermissions = getCompanyRolePermissions(roleSnapshot?.data() as TenantRoleRecord | undefined);

    const departmentAdminPermissions = enabled ? DEPARTMENT_ADMIN_DEFAULT_PERMISSIONS : [];

    effectivePermissions = enabled
      ? mergePermissions(companyRolePermissions, departmentAdminPermissions)
      : companyRolePermissions;
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
        ...buildAssignmentFields(
          nextRole,
          context.uid,
          effectivePermissions,
          departmentAdminPermissions,
          enabled
        ),
        ...(employeeUid
          ? {
              claimedByUid: employeeUid,
              employeeUid
            }
          : {})
      },
      { merge: true }
    );
    transaction.set(
      globalApprovedPhoneRef,
      {
        permissions: effectivePermissions,
        departmentAdminPermissions,
        role: nextRole,
        roleId: approvedPhone.roleId || null,
        updatedAt: fieldValue.serverTimestamp(),
        ...(employeeUid
          ? {
              claimedByUid: employeeUid,
              employeeUid
            }
          : {}),
        ...(enabled
          ? {
              departmentAdminAssignedAt: fieldValue.serverTimestamp(),
              departmentAdminAssignedBy: context.uid
            }
          : {
              departmentAdminRemovedAt: fieldValue.serverTimestamp(),
              departmentAdminRemovedBy: context.uid
            })
      },
      { merge: true }
    );

    if (!userRef || !identityRef) {
      return;
    }

    transaction.set(
      userRef,
      {
        ...buildAssignmentFields(
          nextRole,
          context.uid,
          effectivePermissions,
          departmentAdminPermissions,
          enabled
        ),
        roleUpdatedAt: fieldValue.serverTimestamp(),
        roleUpdatedBy: context.uid
      },
      { merge: true }
    );
    transaction.set(
      identityRef,
      {
        claimsVersion,
        departmentId: approvedPhone.departmentId || null,
        departmentAdminPermissions,
        permissions: effectivePermissions,
        role: nextRole,
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
      role: nextRole,
      status: 'ACTIVE',
      tenantId: context.tenantId
    });
  }

  const refreshedSnapshot = await approvedPhoneRef.get();

  if (!refreshedSnapshot.exists) {
    throw notFoundError('Employee was not found.');
  }

  return {
    employee: mapAssignedEmployee(refreshedSnapshot.data() as ApprovedEmployeeRecord, refreshedSnapshot.id),
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
    throw authorizationError('You do not have permission to manage employees.');
  }

  return {
    permissions,
    tenantId,
    uid: decodedToken.uid
  };
}

function buildAssignmentFields(
  role: SynzappRole,
  adminUid: string,
  permissions: string[],
  departmentAdminPermissions: string[],
  enabled: boolean
): Record<string, unknown> {
  return {
    departmentAdmin: enabled,
    departmentAdminPermissions,
    permissions,
    role,
    updatedAt: fieldValue.serverTimestamp(),
    ...(enabled
      ? {
          departmentAdminAssignedAt: fieldValue.serverTimestamp(),
          departmentAdminAssignedBy: adminUid
        }
      : {
          departmentAdminRemovedAt: fieldValue.serverTimestamp(),
          departmentAdminRemovedBy: adminUid
        })
  };
}

function getCompanyRolePermissions(role?: TenantRoleRecord): string[] {
  if (!role || role.status !== 'ACTIVE') {
    return [];
  }

  return role.permissions || [];
}

function mapAssignedEmployee(
  record: ApprovedEmployeeRecord,
  fallbackId: string
): ApprovedEmployeeResponse {
  const approvedPhoneId = record.approvedPhoneId || fallbackId;

  return {
    approvedPhoneId,
    departmentId: record.departmentId || '',
    departmentName: record.departmentName || 'Department',
    displayName: record.displayName || null,
    departmentAdminPermissions: record.departmentAdminPermissions || [],
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
