import { DecodedIdToken } from 'firebase-admin/auth';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import {
  type AdminContactPolicy,
  normalizeAdminContactPolicy,
  validateAdminContactPolicyInput
} from './adminContactPolicy.js';
import {
  canOrgAdminUsePermission,
  isActiveTenantSession
} from './authorizationPolicy.js';
import { buildAuthSession } from './authSessionService.js';

/**
 * Whether an admin's phone number is shown to the people they look after.
 *
 * Stored on the organization, read by every profile request, and set by that
 * company's own admin — the same arrangement as `scheduledMessagePolicy`. The
 * staff console decides things that cross tenants; who inside one company sees
 * one number is that company's business.
 *
 * See section 4 of `SYNZAPP_MAIN_MENU_PLAN.md`.
 */

export interface AdminContactPolicyResponse extends AdminContactPolicy {
  updatedAt: string | null;
  updatedByUid: string | null;
}

interface OrganizationRecord {
  adminContactPolicy?: Record<string, unknown> & {
    updatedAt?: FirebaseDateLike;
    updatedByUid?: string | null;
  };
}

interface FirebaseDateLike {
  seconds?: number;
  toMillis?: () => number;
}

export async function getAdminContactPolicyForCurrentUser(
  decodedToken: DecodedIdToken
): Promise<AdminContactPolicyResponse> {
  const { tenantId } = await requireActiveTenantUser(decodedToken);

  return readAdminContactPolicy(tenantId);
}

export async function updateAdminContactPolicy(
  decodedToken: DecodedIdToken,
  input: { showAdminPhoneNumber: boolean }
): Promise<AdminContactPolicyResponse> {
  const { tenantId } = await requireSecurityAdmin(decodedToken);
  const validation = validateAdminContactPolicyInput(input);

  if (!validation.ok) {
    throw validationError(validation.reason || 'That setting is not allowed.');
  }

  await firestore.collection('organizations').doc(tenantId).set({
    adminContactPolicy: {
      showAdminPhoneNumber: input.showAdminPhoneNumber,
      updatedAt: fieldValue.serverTimestamp(),
      updatedByUid: decodedToken.uid
    },
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });

  return readAdminContactPolicy(tenantId);
}

async function readAdminContactPolicy(tenantId: string): Promise<AdminContactPolicyResponse> {
  const snapshot = await firestore.collection('organizations').doc(tenantId).get();
  const organization = snapshot.data() as OrganizationRecord | undefined;
  const stored = organization?.adminContactPolicy;

  return {
    ...normalizeAdminContactPolicy(stored),
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

function validationError(message: string): Error {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
}
