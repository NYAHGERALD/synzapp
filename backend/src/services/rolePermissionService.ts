import { DecodedIdToken } from 'firebase-admin/auth';
import {
  adminAuth,
  fieldValue,
  firestore
} from '../config/firebaseAdmin.js';
import { SynzappRole } from '../types/auth.js';
import { buildAuthSession } from './authSessionService.js';
import {
  assertRolePermissions,
  mergePermissions,
  PermissionCatalogItem,
  ROLE_PERMISSION_CATALOG
} from './permissionCatalog.js';
import type { TenantRoleResponse } from './adminDirectoryService.js';

interface TenantAdminContext {
  permissions: string[];
  tenantId: string;
  uid: string;
}

interface TenantRoleRecord {
  description?: string | null;
  name?: string;
  permissions?: string[];
  roleId?: string;
  status?: string;
  tenantId?: string;
}

interface ApprovedEmployeeRecord {
  approvedPhoneId?: string;
  claimedByUid?: string;
  departmentAdminPermissions?: string[];
  employeeUid?: string;
  permissions?: string[];
  phoneHash?: string;
  role?: SynzappRole;
  roleId?: string;
  status?: string;
  tenantId?: string;
}

export interface RolePermissionUpdateResult {
  role: TenantRoleResponse;
  tenantId: string;
  updatedEmployeeCount: number;
  updatedUserCount: number;
}

interface EmployeePermissionUpdate {
  approvedPhoneId: string;
  claimsVersion: number;
  departmentAdminPermissions: string[];
  effectivePermissions: string[];
  phoneHash: string;
  role: SynzappRole;
  status: string;
  uid: string | null;
}

export async function listRolePermissionCatalog(
  decodedToken: DecodedIdToken
): Promise<PermissionCatalogItem[]> {
  await requireRoleAdmin(decodedToken);

  return ROLE_PERMISSION_CATALOG;
}

export async function updateRolePermissions(
  decodedToken: DecodedIdToken,
  roleId: string,
  permissions: string[]
): Promise<RolePermissionUpdateResult> {
  const context = await requireRoleAdmin(decodedToken);
  const safeRoleId = roleId.trim();
  const nextPermissions = assertRolePermissions(permissions);

  if (!safeRoleId) {
    throw validationError('Role was not found.');
  }

  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const roleRef = organizationRef.collection('roles').doc(safeRoleId);
  const roleSnapshot = await roleRef.get();

  if (!roleSnapshot.exists) {
    throw notFoundError('Role was not found.');
  }

  const role = roleSnapshot.data() as TenantRoleRecord;

  if (role.tenantId !== context.tenantId || role.status !== 'ACTIVE') {
    throw notFoundError('Role was not found.');
  }

  await roleRef.set({
    permissions: nextPermissions,
    permissionsUpdatedAt: fieldValue.serverTimestamp(),
    permissionsUpdatedBy: context.uid,
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });

  const approvedPhonesSnapshot = await organizationRef
    .collection('approvedPhones')
    .where('roleId', '==', safeRoleId)
    .get();
  const updates = approvedPhonesSnapshot.docs
    .map((doc) => buildEmployeePermissionUpdate(
      doc.id,
      doc.data() as ApprovedEmployeeRecord,
      context.tenantId,
      nextPermissions
    ))
    .filter((update): update is EmployeePermissionUpdate => Boolean(update));

  await commitEmployeePermissionUpdates(context, updates);

  const refreshedRoleSnapshot = await roleRef.get();
  const refreshedRole = refreshedRoleSnapshot.data() as TenantRoleRecord;

  return {
    role: mapRole(refreshedRole, safeRoleId),
    tenantId: context.tenantId,
    updatedEmployeeCount: updates.length,
    updatedUserCount: updates.filter((update) => update.uid).length
  };
}

async function requireRoleAdmin(decodedToken: DecodedIdToken): Promise<TenantAdminContext> {
  const session = await buildAuthSession(decodedToken);
  const { permissions, role, status, tenantId } = session.user;

  if (session.access !== 'ACTIVE' || !tenantId || status !== 'ACTIVE') {
    throw authorizationError('Your admin session is not active.');
  }

  if (role !== 'ORG_ADMIN' || !permissions.includes('roles.manage')) {
    throw authorizationError('You do not have permission to manage role permissions.');
  }

  return {
    permissions,
    tenantId,
    uid: decodedToken.uid
  };
}

function buildEmployeePermissionUpdate(
  fallbackId: string,
  record: ApprovedEmployeeRecord,
  tenantId: string,
  rolePermissions: string[]
): EmployeePermissionUpdate | null {
  const status = record.status || 'INVITED';
  const role = record.role || 'EMPLOYEE';

  if (
    record.tenantId !== tenantId ||
    (role !== 'EMPLOYEE' && role !== 'DEPT_ADMIN') ||
    (status !== 'ACTIVE' && status !== 'INVITED')
  ) {
    return null;
  }

  const departmentAdminPermissions = role === 'DEPT_ADMIN'
    ? record.departmentAdminPermissions || []
    : [];
  const phoneHash = record.phoneHash || record.approvedPhoneId || fallbackId;

  return {
    approvedPhoneId: record.approvedPhoneId || fallbackId,
    claimsVersion: Date.now(),
    departmentAdminPermissions,
    effectivePermissions: mergePermissions(rolePermissions, departmentAdminPermissions),
    phoneHash,
    role,
    status,
    uid: record.employeeUid || record.claimedByUid || null
  };
}

async function commitEmployeePermissionUpdates(
  context: TenantAdminContext,
  updates: EmployeePermissionUpdate[]
): Promise<void> {
  if (!updates.length) {
    return;
  }

  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const chunks = chunkArray(updates, 120);

  for (const chunk of chunks) {
    const batch = firestore.batch();

    chunk.forEach((update) => {
      const permissionFields = {
        permissions: update.effectivePermissions,
        permissionsUpdatedAt: fieldValue.serverTimestamp(),
        permissionsUpdatedBy: context.uid,
        updatedAt: fieldValue.serverTimestamp()
      };

      batch.set(
        organizationRef.collection('approvedPhones').doc(update.approvedPhoneId),
        permissionFields,
        { merge: true }
      );
      batch.set(
        firestore.collection('approvedPhoneDirectory').doc(update.phoneHash),
        permissionFields,
        { merge: true }
      );

      if (!update.uid) {
        return;
      }

      batch.set(
        organizationRef.collection('users').doc(update.uid),
        {
          ...permissionFields,
          claimsVersion: update.claimsVersion
        },
        { merge: true }
      );
      batch.set(
        firestore.collection('identityDirectory').doc(update.uid),
        {
          ...permissionFields,
          claimsVersion: update.claimsVersion
        },
        { merge: true }
      );
    });

    await batch.commit();
  }

  for (const update of updates) {
    if (!update.uid || update.status !== 'ACTIVE') {
      continue;
    }

    await adminAuth.setCustomUserClaims(update.uid, {
      claimsVersion: update.claimsVersion,
      permissions: update.effectivePermissions,
      role: update.role,
      status: 'ACTIVE',
      tenantId: context.tenantId
    });
  }
}

function mapRole(record: TenantRoleRecord, fallbackId: string): TenantRoleResponse {
  return {
    description: record.description || null,
    name: record.name || 'Untitled role',
    permissions: record.permissions || [],
    roleId: record.roleId || fallbackId,
    status: record.status || 'ACTIVE',
    tenantId: record.tenantId || ''
  };
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
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
