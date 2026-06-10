import { DecodedIdToken } from 'firebase-admin/auth';
import {
  adminAuth,
  fieldValue,
  firestore
} from '../config/firebaseAdmin.js';
import { SynzappRole, SynzappUserStatus } from '../types/auth.js';
import { buildAuthSession } from './authSessionService.js';
import type { ApprovedEmployeeResponse } from './employeeInviteService.js';

export type EmployeeLifecycleAction = 'DEACTIVATE' | 'ARCHIVE' | 'ANONYMIZE' | 'REACTIVATE';

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

interface TenantUserRecord {
  role?: SynzappRole;
  tenantId?: string;
}

interface DeviceKeyRecord {
  deviceId?: string;
  uid?: string;
}

interface LifecycleResult {
  employee: ApprovedEmployeeResponse;
  employeeUid: string | null;
  tenantId: string;
}

const ACTIVE_BLOCKING_STATUS_BY_ACTION: Record<EmployeeLifecycleAction, SynzappUserStatus> = {
  ANONYMIZE: 'DELETED',
  ARCHIVE: 'ARCHIVED',
  DEACTIVATE: 'DEACTIVATED',
  REACTIVATE: 'ACTIVE'
};

export async function updateEmployeeLifecycle(
  decodedToken: DecodedIdToken,
  approvedPhoneId: string,
  action: EmployeeLifecycleAction,
  reason?: string
): Promise<LifecycleResult> {
  const context = await requireUserAdmin(decodedToken);
  const safeApprovedPhoneId = approvedPhoneId.trim();

  if (!safeApprovedPhoneId) {
    throw validationError('Employee was not found.');
  }

  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const approvedPhoneRef = organizationRef.collection('approvedPhones').doc(safeApprovedPhoneId);
  const nextStatus = ACTIVE_BLOCKING_STATUS_BY_ACTION[action];
  const claimsVersion = Date.now();
  let employeeUid: string | null = null;
  let employeeRole: SynzappRole = 'EMPLOYEE';
  let reactivatedPermissions: string[] = [];

  await firestore.runTransaction(async (transaction) => {
    const approvedPhoneSnapshot = await transaction.get(approvedPhoneRef);

    if (!approvedPhoneSnapshot.exists) {
      throw notFoundError('Employee was not found.');
    }

    const approvedPhone = approvedPhoneSnapshot.data() as ApprovedEmployeeRecord;

    if (
      approvedPhone.tenantId !== context.tenantId ||
      !isEmployeeManagedRole(approvedPhone.role)
    ) {
      throw notFoundError('Employee was not found.');
    }

    if (approvedPhone.status === 'DELETED') {
      throw validationError('This employee has already been anonymized.');
    }

    employeeUid = approvedPhone.employeeUid || approvedPhone.claimedByUid || null;
    employeeRole = getManagedEmployeeRole(approvedPhone.role);
    const reactivatedStatus = employeeUid ? 'ACTIVE' : 'INVITED';
    const nextApprovedPhoneStatus = action === 'REACTIVATE' ? reactivatedStatus : nextStatus;
    reactivatedPermissions = approvedPhone.permissions || [];

    if (employeeUid) {
      const userRef = organizationRef.collection('users').doc(employeeUid);
      const identityRef = firestore.collection('identityDirectory').doc(employeeUid);
      const [userSnapshot] = await Promise.all([
        transaction.get(userRef)
      ]);

      if (userSnapshot.exists) {
        const user = userSnapshot.data() as TenantUserRecord;

        if (
          user.tenantId !== context.tenantId ||
          !isEmployeeManagedRole(user.role)
        ) {
          throw notFoundError('Employee was not found.');
        }
      }

      transaction.set(
        userRef,
        buildTenantUserLifecycleFields(action, context.uid, nextStatus, approvedPhone, reason),
        { merge: true }
      );
      transaction.set(
        identityRef,
        buildIdentityLifecycleFields(action, context.uid, nextStatus, claimsVersion, approvedPhone),
        { merge: true }
      );
    }

    const phoneHash = approvedPhone.phoneHash || safeApprovedPhoneId;
    const globalApprovedPhoneRef = firestore.collection('approvedPhoneDirectory').doc(phoneHash);

    transaction.set(
      approvedPhoneRef,
      buildApprovedPhoneLifecycleFields(action, context.uid, nextApprovedPhoneStatus, reason),
      { merge: true }
    );
    transaction.set(
      globalApprovedPhoneRef,
      buildGlobalApprovedPhoneLifecycleFields(
        action,
        context,
        approvedPhone,
        nextApprovedPhoneStatus,
        reason
      ),
      { merge: true }
    );
  });

  if (employeeUid && action === 'REACTIVATE') {
    await adminAuth.setCustomUserClaims(employeeUid, {
      claimsVersion,
      permissions: reactivatedPermissions,
      role: employeeRole,
      status: 'ACTIVE',
      tenantId: context.tenantId
    });
  } else if (employeeUid) {
    await Promise.all([
      revokeEmployeeDevices(context.tenantId, employeeUid, context.uid, action),
      adminAuth.revokeRefreshTokens(employeeUid),
      adminAuth.setCustomUserClaims(employeeUid, {
        claimsVersion,
        permissions: [],
        role: employeeRole,
        status: nextStatus,
        tenantId: context.tenantId
      })
    ]);
  }

  const refreshedSnapshot = await approvedPhoneRef.get();

  if (!refreshedSnapshot.exists) {
    throw notFoundError('Employee was not found.');
  }

  return {
    employee: mapLifecycleEmployee(refreshedSnapshot.data() as ApprovedEmployeeRecord, refreshedSnapshot.id),
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

function buildTenantUserLifecycleFields(
  action: EmployeeLifecycleAction,
  adminUid: string,
  status: SynzappUserStatus,
  approvedPhone: ApprovedEmployeeRecord,
  reason?: string
): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    lifecycleReason: reason?.trim() || getDefaultLifecycleReason(action),
    lifecycleUpdatedAt: fieldValue.serverTimestamp(),
    lifecycleUpdatedBy: adminUid,
    status,
    updatedAt: fieldValue.serverTimestamp()
  };

  if (action === 'REACTIVATE') {
    fields.permissions = approvedPhone.permissions || [];
    fields.profileComplete = true;
    fields.reactivatedAt = fieldValue.serverTimestamp();
    fields.reactivatedBy = adminUid;
    return fields;
  }

  fields.authRevokedAt = fieldValue.serverTimestamp();
  fields.permissions = [];

  if (action === 'DEACTIVATE') {
    fields.deactivatedAt = fieldValue.serverTimestamp();
    fields.deactivatedBy = adminUid;
  }

  if (action === 'ARCHIVE') {
    fields.archivedAt = fieldValue.serverTimestamp();
    fields.archivedBy = adminUid;
  }

  if (action === 'ANONYMIZE') {
    fields.anonymizedAt = fieldValue.serverTimestamp();
    fields.anonymizedBy = adminUid;
    fields.deletedAt = fieldValue.serverTimestamp();
    fields.deletedBy = adminUid;
    fields.displayName = 'Deleted user';
    fields.firstName = null;
    fields.lastName = null;
    fields.phoneHash = null;
    fields.phoneLast4 = null;
    fields.phoneMasked = '*****';
    fields.profilePhotoContentType = null;
    fields.profilePhotoStoragePath = null;
    fields.profilePhotoVersion = Date.now();
  }

  return fields;
}

function buildIdentityLifecycleFields(
  action: EmployeeLifecycleAction,
  adminUid: string,
  status: SynzappUserStatus,
  claimsVersion: number,
  approvedPhone: ApprovedEmployeeRecord
): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    claimsVersion,
    lifecycleUpdatedAt: fieldValue.serverTimestamp(),
    lifecycleUpdatedBy: adminUid,
    status,
    updatedAt: fieldValue.serverTimestamp()
  };

  if (action === 'REACTIVATE') {
    fields.permissions = approvedPhone.permissions || [];
    fields.profileComplete = true;
    fields.reactivatedAt = fieldValue.serverTimestamp();
    fields.reactivatedBy = adminUid;
    return fields;
  }

  fields.authRevokedAt = fieldValue.serverTimestamp();
  fields.permissions = [];
  fields.profileComplete = false;

  if (action === 'ANONYMIZE') {
    fields.displayName = 'Deleted user';
    fields.phoneLast4 = null;
    fields.profilePhotoVersion = Date.now();
  }

  return fields;
}

function buildApprovedPhoneLifecycleFields(
  action: EmployeeLifecycleAction,
  adminUid: string,
  status: SynzappUserStatus | 'INVITED',
  reason?: string
): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    lifecycleReason: reason?.trim() || getDefaultLifecycleReason(action),
    lifecycleUpdatedAt: fieldValue.serverTimestamp(),
    lifecycleUpdatedBy: adminUid,
    status,
    updatedAt: fieldValue.serverTimestamp()
  };

  if (action === 'REACTIVATE') {
    fields.reactivatedAt = fieldValue.serverTimestamp();
    fields.reactivatedBy = adminUid;
    return fields;
  }

  if (action === 'DEACTIVATE') {
    fields.deactivatedAt = fieldValue.serverTimestamp();
    fields.deactivatedBy = adminUid;
  }

  if (action === 'ARCHIVE') {
    fields.archivedAt = fieldValue.serverTimestamp();
    fields.archivedBy = adminUid;
  }

  if (action === 'ANONYMIZE') {
    fields.anonymizedAt = fieldValue.serverTimestamp();
    fields.anonymizedBy = adminUid;
    fields.deletedAt = fieldValue.serverTimestamp();
    fields.deletedBy = adminUid;
    fields.displayName = 'Deleted user';
    fields.encryptedPhone = null;
    fields.firstName = null;
    fields.lastName = null;
    fields.phoneLast4 = '';
    fields.phoneMasked = '*****';
    fields.profilePhotoContentType = null;
    fields.profilePhotoStoragePath = null;
    fields.profilePhotoVersion = Date.now();
  }

  return fields;
}

function buildGlobalApprovedPhoneLifecycleFields(
  action: EmployeeLifecycleAction,
  context: TenantAdminContext,
  approvedPhone: ApprovedEmployeeRecord,
  status: SynzappUserStatus | 'INVITED',
  reason?: string
): Record<string, unknown> {
  if (action === 'REACTIVATE') {
    return {
      departmentId: approvedPhone.departmentId || null,
      disabledAt: null,
      disabledBy: null,
      disabledReason: null,
      permissions: approvedPhone.permissions || [],
      reactivatedAt: fieldValue.serverTimestamp(),
      reactivatedBy: context.uid,
      role: getManagedEmployeeRole(approvedPhone.role),
      roleId: approvedPhone.roleId || null,
      status,
      tenantId: context.tenantId,
      updatedAt: fieldValue.serverTimestamp()
    };
  }

  return {
    disabledAt: fieldValue.serverTimestamp(),
    disabledBy: context.uid,
    disabledReason: reason?.trim() || getDefaultLifecycleReason(action),
    status: 'DISABLED',
    tenantId: context.tenantId,
    updatedAt: fieldValue.serverTimestamp()
  };
}

async function revokeEmployeeDevices(
  tenantId: string,
  employeeUid: string,
  adminUid: string,
  action: EmployeeLifecycleAction
): Promise<void> {
  const organizationRef = firestore.collection('organizations').doc(tenantId);
  const userDevicesSnapshot = await organizationRef
    .collection('users')
    .doc(employeeUid)
    .collection('devices')
    .get();
  const tenantDevicesSnapshot = await organizationRef
    .collection('deviceKeys')
    .where('uid', '==', employeeUid)
    .get();
  const deviceIds = new Set<string>();

  userDevicesSnapshot.docs.forEach((doc) => deviceIds.add(doc.id));
  tenantDevicesSnapshot.docs.forEach((doc) => {
    const device = doc.data() as DeviceKeyRecord;
    deviceIds.add(device.deviceId || doc.id);
  });

  if (!deviceIds.size) {
    return;
  }

  const revokedFields = {
    revocationReason: getDeviceRevocationReason(action),
    revokedAt: fieldValue.serverTimestamp(),
    revokedByUid: adminUid,
    status: 'REVOKED',
    updatedAt: fieldValue.serverTimestamp()
  };
  const batch = firestore.batch();

  deviceIds.forEach((deviceId) => {
    batch.set(
      organizationRef.collection('users').doc(employeeUid).collection('devices').doc(deviceId),
      revokedFields,
      { merge: true }
    );
    batch.set(
      organizationRef.collection('deviceKeys').doc(deviceId),
      revokedFields,
      { merge: true }
    );
  });

  await batch.commit();
}

function mapLifecycleEmployee(
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

function getDefaultLifecycleReason(action: EmployeeLifecycleAction): string {
  if (action === 'REACTIVATE') {
    return 'Reactivated by organization admin';
  }

  if (action === 'DEACTIVATE') {
    return 'Deactivated by organization admin';
  }

  if (action === 'ARCHIVE') {
    return 'Archived by organization admin';
  }

  return 'Anonymized by organization admin';
}

function isEmployeeManagedRole(role?: SynzappRole): boolean {
  return role === 'EMPLOYEE' || role === 'DEPT_ADMIN' || !role;
}

function getManagedEmployeeRole(role?: SynzappRole): SynzappRole {
  return role === 'DEPT_ADMIN' ? 'DEPT_ADMIN' : 'EMPLOYEE';
}

function getDeviceRevocationReason(action: EmployeeLifecycleAction): string {
  if (action === 'REACTIVATE') {
    return 'Employee reactivated by organization admin';
  }

  if (action === 'DEACTIVATE') {
    return 'Employee deactivated by organization admin';
  }

  if (action === 'ARCHIVE') {
    return 'Employee archived by organization admin';
  }

  return 'Employee anonymized by organization admin';
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
