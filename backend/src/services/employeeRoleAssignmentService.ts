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
  ORG_ADMIN_PERMISSIONS,
  mergePermissions,
  normalizeRolePermissions
} from './permissionCatalog.js';
import {
  ORG_ADMIN_DEPARTMENT_ID,
  ORG_ADMIN_ROLE_NAME,
  canChangeOrgAdminRole
} from './orgAdminInvitePolicy.js';
import { HUMAN_RESOURCES_DEPARTMENT_NAME } from './tenantDefaults.js';

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
    // Filtered the same way the invite path filters it. A role document is
    // catalogue-checked when it is saved, so anything outside the catalogue got
    // there some other way, and this is the other route by which it would reach
    // somebody's custom claims.
    const rolePermissions = normalizeRolePermissions(tenantRole.permissions || []);
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

/**
 * Gives somebody organization admin, or takes it away.
 *
 * Both directions were missing. Every lifecycle service refuses a record whose
 * role is `ORG_ADMIN` — `isEmployeeManagedRole` admits only EMPLOYEE and
 * DEPT_ADMIN — so an admin could not be deactivated, suspended, deleted, or
 * even have an unclaimed invite withdrawn. And the only way in was a fresh
 * invite, which refuses a phone that already has a record, so an existing
 * employee could not be promoted at all.
 *
 * Demoting first is what makes the rest work: once the record is an EMPLOYEE
 * again, every existing lifecycle action applies to it unchanged. That is why
 * nothing in `employeeLifecycleService` is touched here — a working service
 * that already does the job correctly, once the role stops hiding the person
 * from it.
 *
 * The count of remaining admins is read inside the transaction, so two admins
 * demoting each other at the same moment cannot both succeed and leave the
 * company with none.
 */
export async function updateEmployeeOrgAdminRole(
  decodedToken: DecodedIdToken,
  approvedPhoneId: string,
  input: { grantOrgAdmin: boolean; roleId?: string }
): Promise<EmployeeRoleAssignmentResult> {
  const context = await requireUserAdmin(decodedToken);
  const safeApprovedPhoneId = approvedPhoneId.trim();
  const safeRoleId = input.roleId?.trim() || '';

  if (!safeApprovedPhoneId) {
    throw validationError('Employee was not found.');
  }

  if (!input.grantOrgAdmin && !safeRoleId) {
    throw validationError('Choose the role this person will have instead.');
  }

  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const approvedPhoneRef = organizationRef.collection('approvedPhones').doc(safeApprovedPhoneId);
  const roleRef = safeRoleId ? organizationRef.collection('roles').doc(safeRoleId) : null;
  const claimsVersion = Date.now();
  let employeeUid: string | null = null;
  let nextRole: SynzappRole = 'EMPLOYEE';
  let effectivePermissions: string[] = [];

  await firestore.runTransaction(async (transaction) => {
    /**
     * Every read first. A single equality filter on purpose: combining it with
     * a status filter would need a composite index, and an index missing in
     * production is how an admin console ends up failing at the moment somebody
     * needs it. Organization admins are few, so the status is checked here.
     */
    const [approvedPhoneSnapshot, roleSnapshot, orgAdminSnapshot] = await Promise.all([
      transaction.get(approvedPhoneRef),
      roleRef ? transaction.get(roleRef) : Promise.resolve(null),
      transaction.get(
        organizationRef.collection('approvedPhones').where('role', '==', 'ORG_ADMIN')
      )
    ]);

    if (!approvedPhoneSnapshot.exists) {
      throw notFoundError('Employee was not found.');
    }

    const approvedPhone = approvedPhoneSnapshot.data() as ApprovedEmployeeRecord;

    if (approvedPhone.tenantId !== context.tenantId) {
      throw notFoundError('Employee was not found.');
    }

    const currentRole = approvedPhone.role || 'EMPLOYEE';
    const targetUid = approvedPhone.employeeUid || approvedPhone.claimedByUid || null;
    const otherActiveOrgAdmins = orgAdminSnapshot.docs.filter((doc) => {
      const record = doc.data() as ApprovedEmployeeRecord;

      return doc.id !== safeApprovedPhoneId && record.status === 'ACTIVE';
    }).length;

    const decision = canChangeOrgAdminRole(input.grantOrgAdmin ? 'PROMOTE' : 'DEMOTE', {
      actorUid: context.uid,
      currentRole,
      otherActiveOrgAdmins,
      status: approvedPhone.status,
      targetUid
    });

    if (!decision.allowed) {
      throw validationError(decision.reason || 'This access cannot be changed.');
    }

    employeeUid = targetUid;

    const phoneHash = approvedPhone.phoneHash || safeApprovedPhoneId;
    const globalApprovedPhoneRef = firestore.collection('approvedPhoneDirectory').doc(phoneHash);
    let roleName: string;
    let departmentUpdate: Record<string, unknown> = {};

    if (input.grantOrgAdmin) {
      nextRole = 'ORG_ADMIN';
      effectivePermissions = [...ORG_ADMIN_PERMISSIONS];
      roleName = ORG_ADMIN_ROLE_NAME;
      /**
       * The same placement the invite enforces, and for the same reason:
       * `userProfileService` moves every organization admin into Human
       * Resources on each profile request, so an admin left anywhere else is
       * rewritten on every request, forever.
       */
      departmentUpdate = {
        departmentId: ORG_ADMIN_DEPARTMENT_ID,
        departmentName: HUMAN_RESOURCES_DEPARTMENT_NAME
      };
    } else {
      const tenantRole = roleSnapshot?.data() as TenantRoleRecord | undefined;

      if (!roleSnapshot?.exists || !tenantRole ||
        tenantRole.tenantId !== context.tenantId || tenantRole.status !== 'ACTIVE') {
        throw validationError('Choose an active role for this person.');
      }

      nextRole = 'EMPLOYEE';
      effectivePermissions = normalizeRolePermissions(tenantRole.permissions || []);
      roleName = tenantRole.name || 'Role';
    }

    const userRef = employeeUid
      ? organizationRef.collection('users').doc(employeeUid)
      : null;
    const identityRef = employeeUid
      ? firestore.collection('identityDirectory').doc(employeeUid)
      : null;

    const sharedUpdate = {
      ...departmentUpdate,
      // An organization admin holds nothing department-scoped, and somebody
      // stepping down keeps nothing from the job they are leaving.
      departmentAdminPermissions: [],
      permissions: effectivePermissions,
      role: nextRole,
      roleName,
      roleUpdatedAt: fieldValue.serverTimestamp(),
      roleUpdatedBy: context.uid,
      updatedAt: fieldValue.serverTimestamp()
    };

    transaction.set(
      approvedPhoneRef,
      safeRoleId ? { ...sharedUpdate, roleId: safeRoleId } : sharedUpdate,
      { merge: true }
    );
    transaction.set(
      globalApprovedPhoneRef,
      {
        ...departmentUpdate,
        permissions: effectivePermissions,
        role: nextRole,
        ...(safeRoleId ? { roleId: safeRoleId } : {}),
        roleUpdatedAt: fieldValue.serverTimestamp(),
        roleUpdatedBy: context.uid,
        updatedAt: fieldValue.serverTimestamp()
      },
      { merge: true }
    );

    if (!userRef || !identityRef) {
      return;
    }

    transaction.set(userRef, sharedUpdate, { merge: true });
    transaction.set(
      identityRef,
      {
        ...departmentUpdate,
        claimsVersion,
        departmentAdminPermissions: [],
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
    employeeUid: record.employeeUid || record.claimedByUid || null,
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
