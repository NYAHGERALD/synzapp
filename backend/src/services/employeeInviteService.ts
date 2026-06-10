import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { DecodedIdToken } from 'firebase-admin/auth';
import { env } from '../config/env.js';
import { fieldValue, firestore, storageBucket } from '../config/firebaseAdmin.js';
import { SynzappRole } from '../types/auth.js';
import { getPhoneLast4, maskPhoneNumber, normalizeE164Phone } from '../utils/phone.js';
import { hashPhoneNumber } from '../utils/phoneHash.js';
import {
  canDepartmentAdminUseScopedPermission,
  canOrgAdminUsePermission,
  isActiveTenantSession
} from './authorizationPolicy.js';
import { buildAuthSession } from './authSessionService.js';

interface TenantAdminContext {
  permissions: string[];
  role?: SynzappRole;
  scopeDepartmentId?: string | null;
  tenantId: string;
  uid: string;
}

interface InviteEmployeeContactInput {
  displayName?: string;
  phoneNumber: string;
}

interface InviteEmployeesInput {
  contacts: InviteEmployeeContactInput[];
  departmentId: string;
  roleId: string;
}

interface NormalizedInviteContact {
  displayName: string | null;
  phoneHash: string;
  phoneLast4: string;
  phoneMasked: string;
  phoneNumber: string;
}

interface TenantDirectoryRecord {
  name?: string;
  permissions?: string[];
  status?: string;
  tenantId?: string;
}

interface ApprovedEmployeeRecord {
  approvedPhoneId?: string;
  claimedByUid?: string;
  departmentAdminPermissions?: string[];
  departmentId?: string;
  departmentName?: string;
  displayName?: string | null;
  employeeUid?: string;
  phoneHash?: string;
  phoneLast4?: string;
  phoneMasked?: string;
  profilePhotoContentType?: string | null;
  profilePhotoStoragePath?: string | null;
  profilePhotoVersion?: number | null;
  permissions?: string[];
  role?: SynzappRole;
  roleId?: string;
  roleName?: string;
  status?: string;
  tenantId?: string;
}

interface TenantUserRecord {
  departmentId?: string | null;
  role?: SynzappRole;
  status?: string;
  tenantId?: string;
}

interface EncryptedPhoneNumber {
  algorithm: 'aes-256-gcm';
  ciphertext: string;
  iv: string;
  keyVersion: 'v1';
  tag: string;
}

export interface ApprovedEmployeeResponse {
  approvedPhoneId: string;
  departmentAdminPermissions: string[];
  departmentId: string;
  departmentName: string;
  displayName: string | null;
  phoneLast4: string;
  phoneMasked: string;
  profilePhotoCacheKey: string | null;
  profilePhotoUrl: string | null;
  permissions: string[];
  role: SynzappRole;
  roleId: string;
  roleName: string;
  status: string;
  tenantId: string;
}

export interface ApprovedEmployeeProfilePhoto {
  cacheKey: string;
  contentType: string;
  file: ReturnType<typeof storageBucket.file>;
}

export async function listApprovedEmployees(
  decodedToken: DecodedIdToken
): Promise<ApprovedEmployeeResponse[]> {
  const context = await requireOrgAdmin(decodedToken, 'users.manage', 'users.invite');
  const currentPhoneHash = decodedToken.phone_number
    ? hashPhoneNumber(normalizeE164Phone(decodedToken.phone_number))
    : '';
  const snapshot = await firestore
    .collection('organizations')
    .doc(context.tenantId)
    .collection('approvedPhones')
    .orderBy('displayName')
    .get();

  return snapshot.docs
    .map((doc) => {
      const record = doc.data() as ApprovedEmployeeRecord;

      return {
        employee: mapApprovedEmployee(record, doc.id),
        fallbackId: doc.id,
        record
      };
    })
    .filter(({ employee, fallbackId, record }) => isApprovedEmployeeVisibleToRequester(
      context,
      employee,
      record,
      fallbackId,
      currentPhoneHash
    ))
    .map(({ employee }) => employee);
}

export async function getApprovedEmployeeProfilePhoto(
  decodedToken: DecodedIdToken,
  approvedPhoneId: string
): Promise<ApprovedEmployeeProfilePhoto> {
  const context = await requireOrgAdmin(decodedToken, 'users.manage', 'users.invite');
  const safeApprovedPhoneId = approvedPhoneId.trim();

  if (!safeApprovedPhoneId) {
    throw validationError('Employee profile photo was not found.');
  }

  const snapshot = await firestore
    .collection('organizations')
    .doc(context.tenantId)
    .collection('approvedPhones')
    .doc(safeApprovedPhoneId)
    .get();

  if (!snapshot.exists) {
    throw notFoundError('Employee profile photo was not found.');
  }

  const record = snapshot.data() as ApprovedEmployeeRecord;

  if (
    record.tenantId !== context.tenantId ||
    (context.scopeDepartmentId && record.departmentId !== context.scopeDepartmentId) ||
    !record.profilePhotoStoragePath
  ) {
    throw notFoundError('Employee profile photo was not found.');
  }

  const file = storageBucket.file(record.profilePhotoStoragePath);

  try {
    const [exists] = await file.exists();

    if (!exists) {
      throw notFoundError('Employee profile photo was not found.');
    }
  } catch (error) {
    if (isMissingStorageBucketError(error)) {
      throw notFoundError('Profile photo storage is not ready yet.');
    }

    throw error;
  }

  return {
    cacheKey: buildApprovedEmployeePhotoCacheKey(safeApprovedPhoneId, record.profilePhotoVersion),
    contentType: record.profilePhotoContentType || 'image/jpeg',
    file
  };
}

export async function inviteEmployeeContacts(
  decodedToken: DecodedIdToken,
  input: InviteEmployeesInput
): Promise<ApprovedEmployeeResponse[]> {
  const context = await requireOrgAdmin(decodedToken, 'users.invite');
  const contacts = normalizeInviteContacts(input.contacts);

  if (!contacts.length) {
    throw validationError('Select at least one contact to invite.');
  }

  if (context.scopeDepartmentId && input.departmentId !== context.scopeDepartmentId) {
    throw authorizationError('Department admins can invite employees only to their department.');
  }

  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const departmentRef = organizationRef.collection('departments').doc(input.departmentId);
  const roleRef = organizationRef.collection('roles').doc(input.roleId);
  let departmentName = '';
  let roleName = '';
  let rolePermissions: string[] = [];

  await firestore.runTransaction(async (transaction) => {
    const [departmentSnapshot, roleSnapshot] = await Promise.all([
      transaction.get(departmentRef),
      transaction.get(roleRef)
    ]);

    if (!departmentSnapshot.exists) {
      throw validationError('Select an active department before inviting employees.');
    }

    if (!roleSnapshot.exists) {
      throw validationError('Select an active role before inviting employees.');
    }

    const department = departmentSnapshot.data() as TenantDirectoryRecord;
    const tenantRole = roleSnapshot.data() as TenantDirectoryRecord;

    if (department.tenantId !== context.tenantId || department.status !== 'ACTIVE') {
      throw validationError('Select an active department before inviting employees.');
    }

    if (tenantRole.tenantId !== context.tenantId || tenantRole.status !== 'ACTIVE') {
      throw validationError('Select an active role before inviting employees.');
    }

    departmentName = department.name || 'Department';
    roleName = tenantRole.name || 'Role';
    rolePermissions = tenantRole.permissions || [];

    const globalDirectoryRefs = contacts.map((contact) =>
      firestore.collection('approvedPhoneDirectory').doc(contact.phoneHash)
    );
    const globalDirectorySnapshots = await Promise.all(
      globalDirectoryRefs.map((ref) => transaction.get(ref))
    );

    globalDirectorySnapshots.forEach((snapshot) => {
      if (!snapshot.exists) {
        return;
      }

      const existingRecord = snapshot.data() as ApprovedEmployeeRecord;

      if (existingRecord.tenantId && existingRecord.tenantId !== context.tenantId) {
        throw conflictError('One selected phone number is already approved for another organization.');
      }

      if (existingRecord.status === 'ACTIVE') {
        throw conflictError('One selected employee is already active in this organization.');
      }

      if (existingRecord.status === 'DISABLED') {
        throw conflictError('One selected employee is disabled and must be reactivated first.');
      }
    });

    contacts.forEach((contact, index) => {
      const approvedPhoneRef = organizationRef.collection('approvedPhones').doc(contact.phoneHash);
      const globalDirectoryRef = globalDirectoryRefs[index];
      const displayName = contact.displayName || contact.phoneMasked;
      const approvedEmployee = {
        approvedPhoneId: contact.phoneHash,
        departmentId: input.departmentId,
        departmentName,
        displayName,
        encryptedPhone: encryptPhoneNumber(contact.phoneNumber),
        invitedBy: context.uid,
        jobTitle: null,
        phoneHash: contact.phoneHash,
        phoneLast4: contact.phoneLast4,
        phoneMasked: contact.phoneMasked,
        permissions: rolePermissions,
        role: 'EMPLOYEE',
        roleId: input.roleId,
        roleName,
        status: 'INVITED',
        tenantId: context.tenantId,
        updatedAt: fieldValue.serverTimestamp()
      };

      transaction.set(
        approvedPhoneRef,
        {
          ...approvedEmployee,
          createdAt: fieldValue.serverTimestamp()
        },
        { merge: true }
      );

      transaction.set(
        globalDirectoryRef,
        {
          approvedPhoneId: contact.phoneHash,
          departmentId: input.departmentId,
          invitedBy: context.uid,
          phoneHash: contact.phoneHash,
          phoneLast4: contact.phoneLast4,
          permissions: rolePermissions,
          role: 'EMPLOYEE',
          roleId: input.roleId,
          status: 'INVITED',
          tenantId: context.tenantId,
          createdAt: fieldValue.serverTimestamp(),
          updatedAt: fieldValue.serverTimestamp()
        },
        { merge: true }
      );
    });
  });

  return contacts.map((contact) => ({
    approvedPhoneId: contact.phoneHash,
    departmentAdminPermissions: [],
    departmentId: input.departmentId,
    departmentName,
    displayName: contact.displayName || contact.phoneMasked,
    phoneLast4: contact.phoneLast4,
    phoneMasked: contact.phoneMasked,
    profilePhotoCacheKey: null,
    profilePhotoUrl: null,
    permissions: rolePermissions,
    role: 'EMPLOYEE',
    roleId: input.roleId,
    roleName,
    status: 'INVITED',
    tenantId: context.tenantId
  }));
}

async function requireOrgAdmin(
  decodedToken: DecodedIdToken,
  permission: 'users.invite' | 'users.manage',
  fallbackPermission?: 'users.invite' | 'users.manage'
): Promise<TenantAdminContext> {
  const session = await buildAuthSession(decodedToken);
  const { permissions, role, status, tenantId } = session.user;
  const policyInput = {
    access: session.access,
    permissions,
    role,
    status,
    tenantId
  };

  if (!isActiveTenantSession(policyInput)) {
    throw authorizationError('Your admin session is not active.');
  }

  const activeTenantId = tenantId as string;
  const canOrgAdminUseRequestedPermission = canOrgAdminUsePermission(policyInput, permission) ||
    Boolean(fallbackPermission && canOrgAdminUsePermission(policyInput, fallbackPermission));

  if (canOrgAdminUseRequestedPermission) {
    return {
      permissions,
      role: 'ORG_ADMIN',
      scopeDepartmentId: null,
      tenantId: activeTenantId,
      uid: decodedToken.uid
    };
  }

  if (role === 'DEPT_ADMIN') {
    const userSnapshot = await firestore
      .collection('organizations')
      .doc(activeTenantId)
      .collection('users')
      .doc(decodedToken.uid)
      .get();

    if (!userSnapshot.exists) {
      throw authorizationError('Your department admin profile is not active.');
    }

    const user = userSnapshot.data() as TenantUserRecord;

    if (
      user.tenantId !== activeTenantId ||
      user.status !== 'ACTIVE' ||
      user.role !== 'DEPT_ADMIN' ||
      !user.departmentId
    ) {
      throw authorizationError('Your department admin profile is not active.');
    }

    const canUseScopedPermission = canDepartmentAdminUseScopedPermission(
      {
        ...policyInput,
        resourceDepartmentId: user.departmentId,
        userDepartmentId: user.departmentId
      },
      permission
    ) || Boolean(
      fallbackPermission &&
      canDepartmentAdminUseScopedPermission(
        {
          ...policyInput,
          resourceDepartmentId: user.departmentId,
          userDepartmentId: user.departmentId
        },
        fallbackPermission
      )
    );

    if (!canUseScopedPermission) {
      throw authorizationError('You do not have permission to manage employees.');
    }

    return {
      permissions,
      role,
      scopeDepartmentId: user.departmentId,
      tenantId: activeTenantId,
      uid: decodedToken.uid
    };
  }

  throw authorizationError('You do not have permission to manage employees.');
}

function normalizeInviteContacts(contacts: InviteEmployeeContactInput[]): NormalizedInviteContact[] {
  const normalizedContactsByHash = new Map<string, NormalizedInviteContact>();

  contacts.forEach((contact) => {
    const phoneNumber = normalizeE164Phone(contact.phoneNumber);
    const phoneHash = hashPhoneNumber(phoneNumber);

    if (normalizedContactsByHash.has(phoneHash)) {
      return;
    }

    normalizedContactsByHash.set(phoneHash, {
      displayName: contact.displayName?.trim().slice(0, 100) || null,
      phoneHash,
      phoneLast4: getPhoneLast4(phoneNumber),
      phoneMasked: maskPhoneNumber(phoneNumber),
      phoneNumber
    });
  });

  return [...normalizedContactsByHash.values()];
}

function mapApprovedEmployee(record: ApprovedEmployeeRecord, fallbackId: string): ApprovedEmployeeResponse {
  return {
    approvedPhoneId: record.approvedPhoneId || fallbackId,
    departmentAdminPermissions: record.departmentAdminPermissions || [],
    departmentId: record.departmentId || '',
    departmentName: record.departmentName || 'Department',
    displayName: record.displayName || null,
    phoneLast4: record.phoneLast4 || '',
    phoneMasked: record.phoneMasked || '*****',
    profilePhotoCacheKey: record.profilePhotoStoragePath
      ? buildApprovedEmployeePhotoCacheKey(record.approvedPhoneId || fallbackId, record.profilePhotoVersion)
      : null,
    profilePhotoUrl: getApprovedEmployeePhotoUrl(
      record.approvedPhoneId || fallbackId,
      record.profilePhotoStoragePath,
      record.profilePhotoVersion
    ),
    permissions: record.permissions || [],
    role: record.role || 'EMPLOYEE',
    roleId: record.roleId || '',
    roleName: record.roleName || 'Role',
    status: record.status || 'INVITED',
    tenantId: record.tenantId || ''
  };
}

function isApprovedEmployeeVisibleToRequester(
  context: TenantAdminContext,
  employee: ApprovedEmployeeResponse,
  record: ApprovedEmployeeRecord,
  fallbackId: string,
  currentPhoneHash: string
): boolean {
  if (!context.scopeDepartmentId) {
    return true;
  }

  if (employee.departmentId !== context.scopeDepartmentId) {
    return false;
  }

  return !isRequesterApprovedEmployee(record, fallbackId, context.uid, currentPhoneHash);
}

function isRequesterApprovedEmployee(
  record: ApprovedEmployeeRecord,
  fallbackId: string,
  requesterUid: string,
  currentPhoneHash: string
): boolean {
  return record.employeeUid === requesterUid ||
    record.claimedByUid === requesterUid ||
    Boolean(currentPhoneHash && (record.phoneHash === currentPhoneHash || fallbackId === currentPhoneHash));
}

function getApprovedEmployeePhotoUrl(
  approvedPhoneId: string,
  storagePath?: string | null,
  version?: number | null
): string | null {
  if (!storagePath) {
    return null;
  }

  return `/api/admin/employees/${encodeURIComponent(approvedPhoneId)}/photo?v=${encodeURIComponent(String(version || 1))}`;
}

function buildApprovedEmployeePhotoCacheKey(approvedPhoneId: string, version?: number | null): string {
  return `approved-employee-photo-${approvedPhoneId}-${version || 1}`;
}

function isMissingStorageBucketError(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? (error as { code?: number | string }).code
    : undefined;
  const message = getErrorMessage(error);

  return (
    code === 404 &&
    /bucket|storage|not found|does not exist/i.test(message)
  ) || /specified bucket does not exist/i.test(message);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error';
}

function encryptPhoneNumber(phoneNumber: string): EncryptedPhoneNumber {
  const key = createHash('sha256').update(env.phoneEncryptionSecret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(phoneNumber, 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return {
    algorithm: 'aes-256-gcm',
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    keyVersion: 'v1',
    tag: tag.toString('base64')
  };
}

function authorizationError(message: string): Error {
  const error = new Error(message);
  error.name = 'AuthorizationError';
  return error;
}

function conflictError(message: string): Error {
  const error = new Error(message);
  error.name = 'ConflictError';
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
