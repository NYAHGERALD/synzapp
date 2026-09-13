import { DecodedIdToken } from 'firebase-admin/auth';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import {
  type EvidenceSizePolicy,
  normalizeEvidenceSizePolicy,
  validateEvidenceMaxAllowedInput,
  validateEvidenceSizePolicyInput
} from './evidenceSizePolicy.js';
import {
  canOrgAdminUsePermission,
  isActiveTenantSession
} from './authorizationPolicy.js';
import { buildAuthSession } from './authSessionService.js';

/**
 * How large an evidence file may be, stored on the organization.
 *
 * Two writers, deliberately. Synzapp staff set `maxAllowedFileBytes`, because
 * the storage it commits is Synzapp's; the company's own admin sets
 * `maxFileBytes` within that, because which files are worth keeping is theirs
 * to judge. The two are written by different functions with different gates and
 * never by the same request.
 *
 * Read by both evidence paths — RCA's and RAILS' — which share one library.
 */

export interface EvidenceSizePolicyResponse extends EvidenceSizePolicy {
  maxAllowedUpdatedAt: string | null;
  updatedAt: string | null;
  updatedByUid: string | null;
}

interface OrganizationRecord {
  evidenceSizePolicy?: Record<string, unknown> & {
    maxAllowedUpdatedAt?: FirebaseDateLike;
    updatedAt?: FirebaseDateLike;
    updatedByUid?: string | null;
  };
}

interface FirebaseDateLike {
  seconds?: number;
  toMillis?: () => number;
}

export async function getEvidenceSizePolicyForCurrentUser(
  decodedToken: DecodedIdToken
): Promise<EvidenceSizePolicyResponse> {
  const { tenantId } = await requireActiveTenantUser(decodedToken);

  return readEvidenceSizePolicy(tenantId);
}

/**
 * Read without a session, for the upload paths that have already established one.
 *
 * The evidence services check a file against this on every upload, and they have
 * their own actor context by then. Going back through `buildAuthSession` would
 * be a second full session read per file.
 */
export async function getEvidenceSizePolicyForTenant(
  tenantId: string
): Promise<EvidenceSizePolicyResponse> {
  return readEvidenceSizePolicy(tenantId);
}

export async function updateEvidenceSizePolicy(
  decodedToken: DecodedIdToken,
  input: { maxFileBytes: number }
): Promise<EvidenceSizePolicyResponse> {
  const { tenantId } = await requireSecurityAdmin(decodedToken);
  // Judged against the ceiling as stored, never against one sent by the caller.
  const current = await readEvidenceSizePolicy(tenantId);
  const validation = validateEvidenceSizePolicyInput(input, current.maxAllowedFileBytes);

  if (!validation.ok) {
    throw validationError(validation.reason || 'That limit is not allowed.');
  }

  await firestore.collection('organizations').doc(tenantId).set({
    evidenceSizePolicy: {
      maxFileBytes: input.maxFileBytes,
      updatedAt: fieldValue.serverTimestamp(),
      updatedByUid: decodedToken.uid
    },
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });

  return readEvidenceSizePolicy(tenantId);
}

/**
 * Sets what one organization is allowed to reach. Synzapp staff only.
 *
 * Takes the tenant as an argument rather than from a session, because the caller
 * is not a member of it. Whether they may do this at all is the staff gate's
 * decision and is made before this is called.
 */
export async function updateEvidenceMaxAllowedForTenant(input: {
  maxAllowedFileBytes: number;
  staffUid: string;
  tenantId: string;
}): Promise<EvidenceSizePolicyResponse> {
  const validation = validateEvidenceMaxAllowedInput(input);

  if (!validation.ok) {
    throw validationError(validation.reason || 'That maximum is not allowed.');
  }

  const organizationRef = firestore.collection('organizations').doc(input.tenantId);
  const snapshot = await organizationRef.get();

  if (!snapshot.exists) {
    throw notFoundError('That organization was not found.');
  }

  await organizationRef.set({
    evidenceSizePolicy: {
      maxAllowedFileBytes: input.maxAllowedFileBytes,
      maxAllowedUpdatedAt: fieldValue.serverTimestamp(),
      maxAllowedUpdatedByUid: input.staffUid
    },
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });

  return readEvidenceSizePolicy(input.tenantId);
}

export interface TenantEvidenceSizeRow extends EvidenceSizePolicyResponse {
  companyName: string;
  tenantId: string;
}

/**
 * Every organization and what each is allowed, for the staff console.
 *
 * Staff only. There is no tenant listing anywhere else in the product — the
 * other cross-tenant staff routes each take an id the caller must already know,
 * which is why none of them has a usable screen. A ceiling nobody can find the
 * organization for is a ceiling nobody will set.
 */
export async function listTenantEvidenceSizePolicies(): Promise<TenantEvidenceSizeRow[]> {
  const snapshot = await firestore.collection('organizations').get();
  const rows = snapshot.docs.map((doc) => {
    const organization = doc.data() as OrganizationRecord & { companyName?: string };
    const stored = organization?.evidenceSizePolicy;

    return {
      ...normalizeEvidenceSizePolicy(stored),
      companyName: organization?.companyName || 'Unnamed organization',
      maxAllowedUpdatedAt: dateLikeToIso(stored?.maxAllowedUpdatedAt),
      tenantId: doc.id,
      updatedAt: dateLikeToIso(stored?.updatedAt),
      updatedByUid: stored?.updatedByUid || null
    };
  });

  return rows.sort((first, second) => first.companyName.localeCompare(second.companyName));
}

async function readEvidenceSizePolicy(tenantId: string): Promise<EvidenceSizePolicyResponse> {
  const snapshot = await firestore.collection('organizations').doc(tenantId).get();
  const organization = snapshot.data() as OrganizationRecord | undefined;
  const stored = organization?.evidenceSizePolicy;

  return {
    ...normalizeEvidenceSizePolicy(stored),
    maxAllowedUpdatedAt: dateLikeToIso(stored?.maxAllowedUpdatedAt),
    updatedAt: dateLikeToIso(stored?.updatedAt),
    updatedByUid: stored?.updatedByUid || null
  };
}

async function requireActiveTenantUser(decodedToken: DecodedIdToken): Promise<{ tenantId: string }> {
  const session = await buildAuthSession(decodedToken);
  const { status, tenantId } = session.user;

  if (session.access !== 'ACTIVE' || status !== 'ACTIVE' || !tenantId) {
    throw authorizationError('Your profile is not active.');
  }

  return { tenantId };
}

async function requireSecurityAdmin(decodedToken: DecodedIdToken): Promise<{ tenantId: string }> {
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

  if (!canOrgAdminUsePermission(policyInput, 'security.manage')) {
    throw authorizationError('You do not have permission to manage this setting.');
  }

  return { tenantId: tenantId as string };
}

function dateLikeToIso(dateLike?: FirebaseDateLike): string | null {
  const milliseconds = dateLike?.toMillis?.() || ((dateLike?.seconds || 0) * 1000);

  if (!milliseconds) {
    return null;
  }

  return new Date(milliseconds).toISOString();
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
