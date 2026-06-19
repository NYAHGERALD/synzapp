import { DecodedIdToken } from 'firebase-admin/auth';
import {
  adminAuth,
  fieldValue,
  firestore,
  storageBucket
} from '../config/firebaseAdmin.js';
import { AuthSessionResponse, SynzappRole } from '../types/auth.js';
import { getPhoneLast4, maskPhoneNumber, normalizeE164Phone } from '../utils/phone.js';
import { hashPhoneNumber } from '../utils/phoneHash.js';

interface ApprovedPhoneDirectoryRecord {
  approvedPhoneId?: string;
  departmentId?: string;
  permissions?: string[];
  phoneHash?: string;
  phoneLast4?: string;
  role?: SynzappRole;
  roleId?: string;
  status?: string;
  tenantId?: string;
}

interface TenantApprovedPhoneRecord extends ApprovedPhoneDirectoryRecord {
  departmentName?: string;
  displayName?: string | null;
  roleName?: string;
}

interface OrganizationRecord {
  companyName?: string;
  orgAdminName?: string;
  orgAdminPhoneLast4?: string;
  status?: string;
}

interface CreateEmployeeProfileInput {
  employeeFirstName: string;
  employeeLastName: string;
  profilePhotoDataUrl?: string;
}

interface UploadedProfilePhoto {
  contentType: string;
  storagePath: string;
}

export interface EmployeeOnboardingContext {
  companyName: string;
  departmentId: string;
  departmentName: string;
  orgAdminName: string;
  orgAdminPhoneMasked: string;
  phoneMasked: string;
  role: SynzappRole;
  roleId: string;
  roleName: string;
  tenantId: string;
}

export interface CreateEmployeeProfileResult {
  session: AuthSessionResponse;
  warnings: string[];
}

export async function getEmployeeOnboardingContext(
  decodedToken: DecodedIdToken
): Promise<EmployeeOnboardingContext> {
  const approvedContext = await getApprovedEmployeeContext(decodedToken);

  return approvedContext.context;
}

export async function createEmployeeProfile(
  decodedToken: DecodedIdToken,
  input: CreateEmployeeProfileInput
): Promise<CreateEmployeeProfileResult> {
  const approvedContext = await getApprovedEmployeeContext(decodedToken);
  const { approvedPhone, approvedPhoneRef, context, globalApprovedPhoneRef, phoneHash, phoneLast4, phoneMasked } = approvedContext;
  const uid = decodedToken.uid;
  const displayName = `${input.employeeFirstName.trim()} ${input.employeeLastName.trim()}`.trim();
  const claimsVersion = Date.now();
  const warnings: string[] = [];
  let profilePhoto: UploadedProfilePhoto | null = null;

  if (input.profilePhotoDataUrl) {
    try {
      profilePhoto = await uploadProfilePhoto(context.tenantId, uid, input.profilePhotoDataUrl);
    } catch (error) {
      if (!isOptionalPhotoStorageError(error)) {
        throw error;
      }

      console.warn('Employee profile photo was not saved:', getErrorMessage(error));
      warnings.push('Employee profile created. Profile photo can be added later.');
    }
  }

  const profilePhotoVersion = profilePhoto ? Date.now() : null;

  await firestore.runTransaction(async (transaction) => {
    const identityRef = firestore.collection('identityDirectory').doc(uid);
    const userRef = firestore
      .collection('organizations')
      .doc(context.tenantId)
      .collection('users')
      .doc(uid);
    const existingPhoneUserQuery = firestore
      .collection('organizations')
      .doc(context.tenantId)
      .collection('users')
      .where('phoneHash', '==', phoneHash)
      .limit(1);
    const [identitySnapshot, existingPhoneUserSnapshot] = await Promise.all([
      transaction.get(identityRef),
      transaction.get(existingPhoneUserQuery)
    ]);

    if (identitySnapshot.exists && identitySnapshot.data()?.tenantId) {
      throw conflictError('This phone number is already linked to an organization.');
    }

    if (!existingPhoneUserSnapshot.empty && existingPhoneUserSnapshot.docs[0]?.id !== uid) {
      throw conflictError('This phone number is already linked to this organization.');
    }

    transaction.set(userRef, {
      createdAt: fieldValue.serverTimestamp(),
      departmentId: context.departmentId,
      departmentName: context.departmentName,
      displayName,
      firstName: input.employeeFirstName.trim(),
      firebaseUid: uid,
      lastLoginAt: fieldValue.serverTimestamp(),
      lastName: input.employeeLastName.trim(),
      permissions: approvedPhone.permissions || [],
      phoneHash,
      phoneLast4,
      phoneMasked,
      profileComplete: true,
      profilePhotoContentType: profilePhoto?.contentType || null,
      profilePhotoStoragePath: profilePhoto?.storagePath || null,
      profilePhotoVersion,
      role: context.role,
      roleId: context.roleId,
      roleName: context.roleName,
      status: 'ACTIVE',
      tenantId: context.tenantId,
      updatedAt: fieldValue.serverTimestamp()
    });

    transaction.set(identityRef, {
      claimsVersion,
      createdAt: fieldValue.serverTimestamp(),
      departmentId: context.departmentId,
      displayName,
      permissions: approvedPhone.permissions || [],
      phoneLast4,
      profileComplete: true,
      profilePhotoVersion,
      role: context.role,
      status: 'ACTIVE',
      tenantId: context.tenantId,
      updatedAt: fieldValue.serverTimestamp()
    });

    transaction.set(approvedPhoneRef, {
      claimedAt: fieldValue.serverTimestamp(),
      claimedByUid: uid,
      displayName,
      employeeUid: uid,
      firstName: input.employeeFirstName.trim(),
      lastName: input.employeeLastName.trim(),
      profileComplete: true,
      profilePhotoContentType: profilePhoto?.contentType || null,
      profilePhotoStoragePath: profilePhoto?.storagePath || null,
      profilePhotoVersion,
      status: 'ACTIVE',
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });

    transaction.set(globalApprovedPhoneRef, {
      claimedAt: fieldValue.serverTimestamp(),
      claimedByUid: uid,
      status: 'ACTIVE',
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });
  });

  await adminAuth.setCustomUserClaims(uid, {
    claimsVersion,
    permissions: approvedPhone.permissions || [],
    role: context.role,
    status: 'ACTIVE',
    tenantId: context.tenantId
  });

  return {
    session: {
      access: 'ACTIVE',
      claimsRefreshed: true,
      nextStep: 'OPEN_APP',
      user: {
        uid,
        phoneMasked,
        tenantId: context.tenantId,
        role: context.role,
        status: 'ACTIVE',
        permissions: approvedPhone.permissions || [],
        profileComplete: true
      }
    },
    warnings
  };
}

async function getApprovedEmployeeContext(decodedToken: DecodedIdToken) {
  if (!decodedToken.phone_number) {
    throw validationError('A verified phone number is required.');
  }

  const normalizedPhone = normalizeE164Phone(decodedToken.phone_number);
  const phoneHash = hashPhoneNumber(normalizedPhone);
  const phoneLast4 = getPhoneLast4(normalizedPhone);
  const phoneMasked = maskPhoneNumber(normalizedPhone);
  const globalApprovedPhoneRef = firestore.collection('approvedPhoneDirectory').doc(phoneHash);
  const globalApprovedPhoneSnapshot = await globalApprovedPhoneRef.get();
  const globalApprovedPhone = globalApprovedPhoneSnapshot.exists
    ? (globalApprovedPhoneSnapshot.data() as ApprovedPhoneDirectoryRecord)
    : null;

  if (
    !globalApprovedPhone?.tenantId ||
    !isApprovedEmployeeProfileRole(globalApprovedPhone.role)
  ) {
    throw authorizationError('This phone number is not approved for employee access.');
  }

  if (globalApprovedPhone.status === 'DISABLED') {
    throw authorizationError('This employee access is not active.');
  }

  if (globalApprovedPhone.status === 'ACTIVE') {
    throw conflictError('This phone number is already linked to an organization.');
  }

  const organizationRef = firestore.collection('organizations').doc(globalApprovedPhone.tenantId);
  const approvedPhoneRef = organizationRef.collection('approvedPhones').doc(phoneHash);
  const [organizationSnapshot, approvedPhoneSnapshot] = await Promise.all([
    organizationRef.get(),
    approvedPhoneRef.get()
  ]);

  if (!organizationSnapshot.exists) {
    throw authorizationError('This employee access is not active.');
  }

  if (!approvedPhoneSnapshot.exists) {
    throw authorizationError('This phone number is not approved for employee access.');
  }

  const organization = organizationSnapshot.data() as OrganizationRecord;
  const approvedPhone = approvedPhoneSnapshot.data() as TenantApprovedPhoneRecord;
  const approvedRole = approvedPhone.role || globalApprovedPhone.role;

  if (organization.status !== 'ACTIVE' || approvedPhone.status !== 'INVITED') {
    throw authorizationError('This employee access is not active.');
  }

  if (
    approvedPhone.tenantId !== globalApprovedPhone.tenantId ||
    !isApprovedEmployeeProfileRole(approvedRole)
  ) {
    throw authorizationError('This employee access is not active.');
  }

  const context: EmployeeOnboardingContext = {
    companyName: organization.companyName || 'Your organization',
    departmentId: approvedPhone.departmentId || globalApprovedPhone.departmentId || '',
    departmentName: approvedPhone.departmentName || 'Department',
    orgAdminName: organization.orgAdminName || 'Organization admin',
    orgAdminPhoneMasked: organization.orgAdminPhoneLast4 ? `*****${organization.orgAdminPhoneLast4}` : '*****',
    phoneMasked,
    role: approvedRole,
    roleId: approvedPhone.roleId || globalApprovedPhone.roleId || '',
    roleName: approvedPhone.roleName || 'Employee',
    tenantId: globalApprovedPhone.tenantId
  };

  if (!context.departmentId || !context.roleId) {
    throw authorizationError('This employee access is not active.');
  }

  return {
    approvedPhone,
    approvedPhoneRef,
    context,
    globalApprovedPhoneRef,
    phoneHash,
    phoneLast4,
    phoneMasked
  };
}

function isApprovedEmployeeProfileRole(role: SynzappRole | undefined): role is SynzappRole {
  return role === 'EMPLOYEE' || role === 'DEPT_ADMIN' || role === 'ORG_ADMIN';
}

async function uploadProfilePhoto(
  tenantId: string,
  uid: string,
  dataUrl: string
): Promise<UploadedProfilePhoto> {
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);

  if (!match) {
    throw validationError('Profile photo must be a JPEG, PNG, or WebP image.');
  }

  const contentType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  const bytes = Buffer.from(match[2], 'base64');

  if (bytes.length > 1 * 1024 * 1024) {
    throw validationError('Profile photo must be smaller than 1 MB.');
  }

  const extension = contentType === 'image/png'
    ? 'png'
    : contentType === 'image/webp'
      ? 'webp'
      : 'jpg';
  const storagePath = `organizations/${tenantId}/users/${uid}/profile/profile-photo.${extension}`;

  await storageBucket.file(storagePath).save(bytes, {
    contentType,
    metadata: {
      cacheControl: 'private, max-age=3600',
      metadata: {
        tenantId,
        uid
      }
    },
    resumable: false
  });

  return {
    contentType,
    storagePath
  };
}

function isOptionalPhotoStorageError(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? (error as { code?: number | string }).code
    : undefined;
  const message = getErrorMessage(error);

  if (error instanceof Error && error.name === 'ValidationError') {
    return false;
  }

  return (
    code === 404 &&
    /bucket|storage|not found|does not exist/i.test(message)
  ) ||
    /specified bucket does not exist/i.test(message) ||
    /oauth|token|premature close|fetch failed|socket hang up|econnreset|etimedout|timeout|temporarily unavailable/i.test(message);
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

function validationError(message: string): Error {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
}
