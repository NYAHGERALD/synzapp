import { randomUUID } from 'node:crypto';
import { DecodedIdToken } from 'firebase-admin/auth';
import {
  adminAuth,
  fieldValue,
  firestore,
  storageBucket
} from '../config/firebaseAdmin.js';
import { AuthSessionResponse } from '../types/auth.js';
import { getPhoneLast4, maskPhoneNumber, normalizeE164Phone } from '../utils/phone.js';
import { hashPhoneNumber } from '../utils/phoneHash.js';
import { buildDepartmentSystemGroupId, buildDepartmentSystemGroupRecord } from './groupService.js';
import { ORG_ADMIN_PERMISSIONS } from './permissionCatalog.js';
import {
  buildHumanResourcesDepartmentRecord,
  HUMAN_RESOURCES_DEPARTMENT_ID,
  HUMAN_RESOURCES_DEPARTMENT_NAME
} from './tenantDefaults.js';

interface CreateOrgAdminProfileInput {
  companyName: string;
  companyAddress: string;
  adminFirstName: string;
  adminLastName: string;
  profilePhotoDataUrl?: string;
}

interface UploadedProfilePhoto {
  contentType: string;
  storagePath: string;
}

interface CreateOrgAdminProfileResult {
  session: AuthSessionResponse;
  warnings: string[];
}

export async function createOrgAdminProfile(
  decodedToken: DecodedIdToken,
  input: CreateOrgAdminProfileInput
): Promise<CreateOrgAdminProfileResult> {
  if (!decodedToken.phone_number) {
    throw validationError('A verified phone number is required.');
  }

  const normalizedPhone = normalizeE164Phone(decodedToken.phone_number);
  const phoneHash = hashPhoneNumber(normalizedPhone);
  const phoneLast4 = getPhoneLast4(normalizedPhone);
  const phoneMasked = maskPhoneNumber(normalizedPhone);
  const tenantId = `tenant_${randomUUID().replace(/-/g, '')}`;
  const uid = decodedToken.uid;
  const displayName = `${input.adminFirstName.trim()} ${input.adminLastName.trim()}`.trim();
  const companySlug = slugifyCompanyName(input.companyName);
  const claimsVersion = Date.now();

  const existingIdentity = await firestore.collection('identityDirectory').doc(uid).get();
  if (existingIdentity.exists && existingIdentity.data()?.tenantId) {
    throw conflictError('A company profile already exists for this account.');
  }

  const warnings: string[] = [];
  let profilePhoto: UploadedProfilePhoto | null = null;

  if (input.profilePhotoDataUrl) {
    try {
      profilePhoto = await uploadProfilePhoto(tenantId, uid, input.profilePhotoDataUrl);
    } catch (error) {
      if (!isOptionalPhotoStorageError(error)) {
        throw error;
      }

      console.warn('Org Admin profile photo was not saved:', getErrorMessage(error));
      warnings.push('Company profile created. Profile photo can be added later.');
    }
  }

  const profilePhotoVersion = profilePhoto ? Date.now() : null;

  await firestore.runTransaction(async (transaction) => {
    const identityRef = firestore.collection('identityDirectory').doc(uid);
    const organizationRef = firestore.collection('organizations').doc(tenantId);
    const organizationNameRef = firestore.collection('organizationNameDirectory').doc(companySlug);
    const humanResourcesDepartmentRef = organizationRef
      .collection('departments')
      .doc(HUMAN_RESOURCES_DEPARTMENT_ID);
    const humanResourcesGroupRef = organizationRef
      .collection('groups')
      .doc(buildDepartmentSystemGroupId(HUMAN_RESOURCES_DEPARTMENT_ID));
    const userRef = organizationRef.collection('users').doc(uid);

    const [identitySnapshot, organizationNameSnapshot] = await Promise.all([
      transaction.get(identityRef),
      transaction.get(organizationNameRef)
    ]);

    if (identitySnapshot.exists && identitySnapshot.data()?.tenantId) {
      throw conflictError('A company profile already exists for this account.');
    }

    if (organizationNameSnapshot.exists) {
      throw conflictError('This company name needs review before it can be used.');
    }

    transaction.set(organizationRef, {
      companyAddress: input.companyAddress.trim(),
      chatBackupPolicy: {
        adminApprovalRequired: true,
        encryptedBackupsEnabled: false,
        recoveryKeyRequired: true,
        selfRestoreEnabled: false,
        updatedAt: fieldValue.serverTimestamp(),
        updatedByUid: uid
      },
      companyLogoUrl: null,
      companyName: input.companyName.trim(),
      companySlug,
      createdAt: fieldValue.serverTimestamp(),
      createdBy: uid,
      orgAdminName: displayName,
      orgAdminPhoneLast4: phoneLast4,
      retentionPolicy: '3_YEARS',
      securityMode: 'ENTERPRISE_CONTROLLED',
      status: 'ACTIVE',
      tenantId,
      updatedAt: fieldValue.serverTimestamp()
    });

    transaction.set(humanResourcesDepartmentRef, {
      ...buildHumanResourcesDepartmentRecord({
        createdBy: uid,
        tenantId
      }),
      createdAt: fieldValue.serverTimestamp(),
      updatedAt: fieldValue.serverTimestamp()
    });

    transaction.set(humanResourcesGroupRef, buildDepartmentSystemGroupRecord({
      createdBy: uid,
      departmentId: HUMAN_RESOURCES_DEPARTMENT_ID,
      departmentName: HUMAN_RESOURCES_DEPARTMENT_NAME,
      description: 'Default organization administration department group',
      tenantId
    }));

    transaction.set(userRef, {
      createdAt: fieldValue.serverTimestamp(),
      departmentId: HUMAN_RESOURCES_DEPARTMENT_ID,
      departmentName: HUMAN_RESOURCES_DEPARTMENT_NAME,
      displayName,
      firstName: input.adminFirstName.trim(),
      firebaseUid: uid,
      lastLoginAt: fieldValue.serverTimestamp(),
      lastName: input.adminLastName.trim(),
      permissions: ORG_ADMIN_PERMISSIONS,
      phoneHash,
      phoneLast4,
      phoneMasked,
      profileComplete: true,
      profilePhotoContentType: profilePhoto?.contentType || null,
      profilePhotoStoragePath: profilePhoto?.storagePath || null,
      profilePhotoVersion,
      role: 'ORG_ADMIN',
      roleName: 'Organization Admin',
      status: 'ACTIVE',
      tenantId,
      updatedAt: fieldValue.serverTimestamp()
    });

    transaction.set(identityRef, {
      claimsVersion,
      createdAt: fieldValue.serverTimestamp(),
      departmentId: HUMAN_RESOURCES_DEPARTMENT_ID,
      displayName,
      permissions: ORG_ADMIN_PERMISSIONS,
      phoneLast4,
      profileComplete: true,
      profilePhotoVersion,
      role: 'ORG_ADMIN',
      status: 'ACTIVE',
      tenantId,
      updatedAt: fieldValue.serverTimestamp()
    });

    transaction.set(organizationNameRef, {
      companyName: input.companyName.trim(),
      createdAt: fieldValue.serverTimestamp(),
      status: 'ACTIVE',
      tenantId
    });
  });

  await adminAuth.setCustomUserClaims(uid, {
    claimsVersion,
    permissions: ORG_ADMIN_PERMISSIONS,
    role: 'ORG_ADMIN',
    status: 'ACTIVE',
    tenantId
  });

  return {
    session: {
      access: 'ACTIVE',
      claimsRefreshed: true,
      nextStep: 'OPEN_APP',
      user: {
        departmentId: HUMAN_RESOURCES_DEPARTMENT_ID,
        uid,
        phoneMasked,
        tenantId,
        role: 'ORG_ADMIN',
        status: 'ACTIVE',
        permissions: ORG_ADMIN_PERMISSIONS,
        profileComplete: true
      }
    },
    warnings
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

function slugifyCompanyName(companyName: string): string {
  const slug = companyName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return slug || `company-${randomUUID().slice(0, 8)}`;
}

function validationError(message: string): Error {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
}

function conflictError(message: string): Error {
  const error = new Error(message);
  error.name = 'ConflictError';
  return error;
}
