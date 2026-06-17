import { randomUUID } from 'node:crypto';
import { DecodedIdToken } from 'firebase-admin/auth';
import type { DocumentReference } from 'firebase-admin/firestore';
import {
  adminAuth,
  fieldValue,
  firestore,
  storageBucket
} from '../config/firebaseAdmin.js';
import { buildAuthSession } from './authSessionService.js';

const DELETION_CHALLENGE_TTL_MS = 10 * 60 * 1000;
const RECENT_AUTH_WINDOW_MS = 10 * 60 * 1000;

interface OrganizationRecord {
  companyName?: string;
  companySlug?: string;
  createdBy?: string;
  status?: string;
  tenantId?: string;
}

interface TenantUserRecord {
  firebaseUid?: string;
  tenantId?: string;
}

interface ApprovedPhoneRecord {
  phoneHash?: string;
  tenantId?: string;
}

interface DeletionChallengeRecord {
  challengeId?: string;
  companyName?: string;
  expiresAtMs?: number;
  requestedBy?: string;
  status?: 'PENDING' | 'USED';
  tenantId?: string;
}

interface TenantOwnerContext {
  companyName: string;
  companySlug: string | null;
  organization: OrganizationRecord;
  organizationRef: DocumentReference;
  tenantId: string;
  uid: string;
}

export interface OrganizationDeletionChallenge {
  challengeId: string;
  companyName: string;
  expiresAt: string;
  requiredConfirmation: string;
  tenantId: string;
}

export interface DeleteOrganizationInput {
  challengeId: string;
  confirmationText: string;
}

export interface OrganizationDeletionResult {
  deleted: boolean;
  revokedUserCount: number;
  tenantId: string;
}

export async function requestOrganizationDeletionChallenge(
  decodedToken: DecodedIdToken
): Promise<OrganizationDeletionChallenge> {
  const context = await requireTenantOwner(decodedToken);
  const challengeId = `delete_${randomUUID().replace(/-/g, '')}`;
  const expiresAtMs = Date.now() + DELETION_CHALLENGE_TTL_MS;

  await context.organizationRef
    .collection('deletionChallenges')
    .doc(challengeId)
    .set({
      challengeId,
      companyName: context.companyName,
      createdAt: fieldValue.serverTimestamp(),
      expiresAtMs,
      requestedBy: context.uid,
      status: 'PENDING',
      tenantId: context.tenantId
    });

  return {
    challengeId,
    companyName: context.companyName,
    expiresAt: new Date(expiresAtMs).toISOString(),
    requiredConfirmation: buildRequiredConfirmation(context.companyName),
    tenantId: context.tenantId
  };
}

export async function deleteOrganizationForTenantOwner(
  decodedToken: DecodedIdToken,
  input: DeleteOrganizationInput
): Promise<OrganizationDeletionResult> {
  assertRecentAuthentication(decodedToken);

  const context = await requireTenantOwner(decodedToken);
  const challengeId = input.challengeId.trim();

  if (!challengeId) {
    throw validationError('Deletion verification is missing. Start again from Settings.');
  }

  const challengeRef = context.organizationRef.collection('deletionChallenges').doc(challengeId);
  const challengeSnapshot = await challengeRef.get();

  if (!challengeSnapshot.exists) {
    throw authorizationError('Deletion verification has expired. Start again from Settings.');
  }

  const challenge = challengeSnapshot.data() as DeletionChallengeRecord;

  if (
    challenge.tenantId !== context.tenantId ||
    challenge.requestedBy !== decodedToken.uid ||
    challenge.status !== 'PENDING' ||
    !challenge.expiresAtMs ||
    challenge.expiresAtMs <= Date.now()
  ) {
    throw authorizationError('Deletion verification has expired. Start again from Settings.');
  }

  const requiredConfirmation = buildRequiredConfirmation(context.companyName);

  if (normalizeConfirmation(input.confirmationText) !== normalizeConfirmation(requiredConfirmation)) {
    throw validationError(`Type ${requiredConfirmation} to confirm deleting this organization.`);
  }

  const [usersSnapshot, approvedPhonesSnapshot, nameDirectorySnapshot] = await Promise.all([
    context.organizationRef.collection('users').get(),
    context.organizationRef.collection('approvedPhones').get(),
    context.companySlug
      ? firestore.collection('organizationNameDirectory').doc(context.companySlug).get()
      : Promise.resolve(null)
  ]);
  const userIds = new Set<string>([decodedToken.uid]);
  const approvedPhoneHashes = new Set<string>();

  usersSnapshot.docs.forEach((doc) => {
    const user = doc.data() as TenantUserRecord;

    if (user.tenantId === context.tenantId) {
      userIds.add(user.firebaseUid || doc.id);
    }
  });

  approvedPhonesSnapshot.docs.forEach((doc) => {
    const approvedPhone = doc.data() as ApprovedPhoneRecord;

    if (approvedPhone.tenantId === context.tenantId) {
      approvedPhoneHashes.add(approvedPhone.phoneHash || doc.id);
    }
  });

  await firestore.runTransaction(async (transaction) => {
    const [freshOrganizationSnapshot, freshChallengeSnapshot] = await Promise.all([
      transaction.get(context.organizationRef),
      transaction.get(challengeRef)
    ]);

    if (!freshOrganizationSnapshot.exists || !freshChallengeSnapshot.exists) {
      throw authorizationError('Deletion verification has expired. Start again from Settings.');
    }

    const freshOrganization = freshOrganizationSnapshot.data() as OrganizationRecord;
    const freshChallenge = freshChallengeSnapshot.data() as DeletionChallengeRecord;

    if (
      freshOrganization.tenantId !== context.tenantId ||
      freshOrganization.createdBy !== decodedToken.uid ||
      freshOrganization.status !== 'ACTIVE' ||
      freshChallenge.tenantId !== context.tenantId ||
      freshChallenge.requestedBy !== decodedToken.uid ||
      freshChallenge.status !== 'PENDING' ||
      !freshChallenge.expiresAtMs ||
      freshChallenge.expiresAtMs <= Date.now()
    ) {
      throw authorizationError('This organization cannot be deleted from this account.');
    }

    transaction.set(context.organizationRef, {
      deletionRequestedAt: fieldValue.serverTimestamp(),
      deletionRequestedBy: decodedToken.uid,
      status: 'DELETING',
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });
    transaction.set(challengeRef, {
      usedAt: fieldValue.serverTimestamp(),
      status: 'USED'
    }, { merge: true });
  });

  await Promise.all([
    revokeTenantUsers([...userIds]),
    deleteGlobalDirectoryRecords({
      companySlug: context.companySlug,
      nameDirectoryExists: nameDirectorySnapshot?.exists === true,
      phoneHashes: [...approvedPhoneHashes],
      userIds: [...userIds]
    }),
    deleteTenantStorage(context.tenantId)
  ]);

  await recursiveDelete(context.organizationRef);

  return {
    deleted: true,
    revokedUserCount: userIds.size,
    tenantId: context.tenantId
  };
}

async function requireTenantOwner(decodedToken: DecodedIdToken): Promise<TenantOwnerContext> {
  const session = await buildAuthSession(decodedToken);
  const { permissions, role, status, tenantId } = session.user;

  if (
    session.access !== 'ACTIVE' ||
    status !== 'ACTIVE' ||
    role !== 'ORG_ADMIN' ||
    !tenantId ||
    !permissions.includes('tenant.update')
  ) {
    throw authorizationError('Only the organization owner can delete this organization.');
  }

  const organizationRef = firestore.collection('organizations').doc(tenantId);
  const organizationSnapshot = await organizationRef.get();

  if (!organizationSnapshot.exists) {
    throw authorizationError('This organization cannot be deleted from this account.');
  }

  const organization = organizationSnapshot.data() as OrganizationRecord;

  if (
    organization.tenantId !== tenantId ||
    organization.status !== 'ACTIVE' ||
    organization.createdBy !== decodedToken.uid
  ) {
    throw authorizationError('Only the organization owner can delete this organization.');
  }

  return {
    companyName: organization.companyName || 'this organization',
    companySlug: organization.companySlug || null,
    organization,
    organizationRef,
    tenantId,
    uid: decodedToken.uid
  };
}

async function revokeTenantUsers(userIds: string[]): Promise<void> {
  await Promise.all(userIds.map(async (uid) => {
    try {
      await adminAuth.revokeRefreshTokens(uid);
      await adminAuth.setCustomUserClaims(uid, null);
    } catch {
      // Some imported or deleted Firebase users may not exist anymore.
    }
  }));
}

async function deleteGlobalDirectoryRecords(input: {
  companySlug: string | null;
  nameDirectoryExists: boolean;
  phoneHashes: string[];
  userIds: string[];
}): Promise<void> {
  const refs = [
    ...input.userIds.map((uid) => firestore.collection('identityDirectory').doc(uid)),
    ...input.phoneHashes.map((phoneHash) => firestore.collection('approvedPhoneDirectory').doc(phoneHash)),
    ...(input.companySlug && input.nameDirectoryExists
      ? [firestore.collection('organizationNameDirectory').doc(input.companySlug)]
      : [])
  ];

  for (let index = 0; index < refs.length; index += 450) {
    const batch = firestore.batch();

    refs.slice(index, index + 450).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function deleteTenantStorage(tenantId: string): Promise<void> {
  await storageBucket.deleteFiles({
    prefix: `organizations/${tenantId}/`
  }).catch(() => undefined);
}

async function recursiveDelete(ref: DocumentReference): Promise<void> {
  const recursiveDeleteCapableFirestore = firestore as unknown as {
    recursiveDelete: (documentRef: DocumentReference) => Promise<void>;
  };

  await recursiveDeleteCapableFirestore.recursiveDelete(ref);
}

function assertRecentAuthentication(decodedToken: DecodedIdToken): void {
  const authTimeMs = (decodedToken.auth_time || 0) * 1000;

  if (!authTimeMs || Date.now() - authTimeMs > RECENT_AUTH_WINDOW_MS) {
    throw authorizationError('Verify your phone number again before deleting this organization.');
  }
}

function buildRequiredConfirmation(companyName: string): string {
  return `DELETE ${companyName}`;
}

function normalizeConfirmation(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

function authorizationError(message: string): Error {
  const error = new Error(message);
  error.name = 'AuthorizationError';
  return error;
}

function validationError(message: string): Error {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
}
