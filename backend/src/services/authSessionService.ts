import { DecodedIdToken } from 'firebase-admin/auth';
import { env } from '../config/env.js';
import { adminAuth, firestore } from '../config/firebaseAdmin.js';
import { assertDurableRateLimit } from '../middleware/rateLimit.js';
import {
  ApprovedPhoneRecord,
  AuthSessionResponse,
  IdentityDirectoryRecord,
  SynzappUserStatus
} from '../types/auth.js';
import { getPhoneLast4, maskPhoneNumber, normalizeE164Phone } from '../utils/phone.js';
import { hashPhoneNumber } from '../utils/phoneHash.js';

export async function verifyFirebaseSession(idToken: string): Promise<DecodedIdToken> {
  return adminAuth.verifyIdToken(idToken, true);
}

interface BuildAuthSessionOptions {
  consumeRateLimit?: boolean;
}

export async function buildAuthSession(
  decodedToken: DecodedIdToken,
  options: BuildAuthSessionOptions = {}
): Promise<AuthSessionResponse> {
  const phoneNumber = decodedToken.phone_number;

  if (!phoneNumber) {
    return {
      access: 'BLOCKED',
      claimsRefreshed: false,
      nextStep: 'SIGN_IN_AGAIN',
      user: {
        uid: decodedToken.uid,
        phoneMasked: '*****',
        permissions: [],
        profileComplete: false,
        status: 'SUSPENDED'
      }
    };
  }

  const normalizedPhone = normalizeE164Phone(phoneNumber);
  const phoneHash = hashPhoneNumber(normalizedPhone);

  if (options.consumeRateLimit) {
    /**
     * Counted across instances, not per instance.
     *
     * These guard how often one account or one phone number may establish a
     * session. Held in a module-level Map they were multiplied by however many
     * instances happened to be running — and that number rises under load,
     * which is when the limit matters. Somebody could also simply be routed to
     * a fresh instance and start again.
     *
     * Only this one caller asks for the count to be consumed, so the Firestore
     * round trip lands on the session route alone rather than on every request
     * that builds a session.
     */
    await assertDurableRateLimit(
      `session:uid:${decodedToken.uid}`,
      env.authRateLimitWindowMs,
      env.authRateLimitMax
    );
    await assertDurableRateLimit(
      `session:phone:${phoneHash}`,
      env.authRateLimitWindowMs,
      env.authRateLimitMax
    );
  }

  const identitySnapshot = await firestore.collection('identityDirectory').doc(decodedToken.uid).get();
  const identity = identitySnapshot.exists
    ? (identitySnapshot.data() as IdentityDirectoryRecord)
    : null;

  if (identity?.authRevokedAt && isTokenOlderThan(decodedToken, identity.authRevokedAt)) {
    return blockedSession(decodedToken.uid, normalizedPhone, 'DEACTIVATED');
  }

  if (identity?.status && isBlockedUserStatus(identity.status)) {
    return blockedSession(decodedToken.uid, normalizedPhone, identity.status);
  }

  if (identity?.tenantId && identity.role && identity.status) {
    const claimsRefreshed = await refreshClaimsIfNeeded(decodedToken, identity);

    return {
      access: identity.profileComplete === false ? 'PROFILE_REQUIRED' : 'ACTIVE',
      claimsRefreshed,
      nextStep: identity.profileComplete === false ? 'CREATE_PROFILE' : 'OPEN_APP',
      user: {
        departmentId: identity.departmentId,
        uid: decodedToken.uid,
        phoneMasked: maskPhoneNumber(normalizedPhone),
        tenantId: identity.tenantId,
        role: identity.role,
        status: identity.status,
        permissions: identity.permissions || [],
        profileComplete: identity.profileComplete !== false
      }
    };
  }

  const approvedPhoneSnapshot = await firestore
    .collection('approvedPhoneDirectory')
    .doc(phoneHash)
    .get();
  const approvedPhone = approvedPhoneSnapshot.exists
    ? (approvedPhoneSnapshot.data() as ApprovedPhoneRecord)
    : null;

  if (approvedPhone?.status && approvedPhone.status !== 'INVITED' && approvedPhone.status !== 'ACTIVE') {
    return blockedSession(decodedToken.uid, normalizedPhone, 'SUSPENDED');
  }

  if (approvedPhone?.tenantId && approvedPhone.role) {
    return {
      access: 'PROFILE_REQUIRED',
      claimsRefreshed: false,
      nextStep: 'CREATE_PROFILE',
      user: {
        departmentId: approvedPhone.departmentId,
        uid: decodedToken.uid,
        phoneMasked: maskPhoneNumber(normalizedPhone),
        tenantId: approvedPhone.tenantId,
        role: approvedPhone.role,
        status: 'INVITED',
        permissions: approvedPhone.permissions || [],
        profileComplete: false
      }
    };
  }

  return {
    access: 'PROFILE_REQUIRED',
    claimsRefreshed: false,
    nextStep: 'CREATE_PROFILE',
    user: {
      uid: decodedToken.uid,
      phoneMasked: maskPhoneNumber(normalizedPhone),
      permissions: [],
      profileComplete: false,
      status: 'PENDING_PROFILE'
    }
  };
}

export async function assertOtpPreflight(
  phoneNumber: string
): Promise<{ phoneMasked: string; retryAfterSeconds: number }> {
  const normalizedPhone = normalizeE164Phone(phoneNumber);
  const phoneHash = hashPhoneNumber(normalizedPhone);
  /**
   * How often one phone number may be sent a code, counted across instances.
   *
   * The route's own limiter is keyed on the caller's address, so it does not
   * stop the same number being targeted from many of them. This is the limit
   * that does — and held per instance it rose with the instance count, which is
   * to say it loosened precisely when somebody was hammering it.
   */
  const result = await assertDurableRateLimit(
    `otp:phone:${phoneHash}`,
    env.otpRateLimitWindowMs,
    env.otpRateLimitMax
  );

  return {
    phoneMasked: maskPhoneNumber(normalizedPhone),
    retryAfterSeconds: Math.ceil((result.resetAt - Date.now()) / 1000)
  };
}

async function refreshClaimsIfNeeded(
  decodedToken: DecodedIdToken,
  identity: IdentityDirectoryRecord
): Promise<boolean> {
  const expectedClaims = {
    claimsVersion: identity.claimsVersion || 1,
    permissions: identity.permissions || [],
    role: identity.role,
    status: identity.status,
    tenantId: identity.tenantId
  };

  const existingClaims = decodedToken as Record<string, unknown>;
  const claimsMatch =
    existingClaims.tenantId === expectedClaims.tenantId &&
    existingClaims.role === expectedClaims.role &&
    existingClaims.status === expectedClaims.status &&
    existingClaims.claimsVersion === expectedClaims.claimsVersion &&
    areStringArraysEqual(
      Array.isArray(existingClaims.permissions) ? existingClaims.permissions.filter((permission): permission is string => typeof permission === 'string') : [],
      expectedClaims.permissions
    );

  if (claimsMatch) {
    return false;
  }

  await adminAuth.setCustomUserClaims(decodedToken.uid, expectedClaims);
  return true;
}

function areStringArraysEqual(first: string[], second: string[]): boolean {
  const normalizedFirst = [...first].sort();
  const normalizedSecond = [...second].sort();

  return normalizedFirst.length === normalizedSecond.length &&
    normalizedFirst.every((value, index) => value === normalizedSecond[index]);
}

function blockedSession(
  uid: string,
  phoneNumber: string,
  status: SynzappUserStatus
): AuthSessionResponse {
  return {
    access: 'BLOCKED',
    claimsRefreshed: false,
    nextStep: isBlockedUserStatus(status) ? 'CONTACT_ADMIN' : 'SIGN_IN_AGAIN',
    user: {
      uid,
      phoneMasked: maskPhoneNumber(phoneNumber),
      permissions: [],
      profileComplete: false,
      status
    }
  };
}

function isBlockedUserStatus(status: SynzappUserStatus): boolean {
  return status === 'DEACTIVATED' ||
    status === 'SUSPENDED' ||
    status === 'ARCHIVED' ||
    status === 'DELETED';
}

function isTokenOlderThan(decodedToken: DecodedIdToken, dateLike: NonNullable<IdentityDirectoryRecord['authRevokedAt']>): boolean {
  const tokenAuthTimeMs = decodedToken.auth_time * 1000;
  const revokedAtMs = dateLike.toMillis?.() || ((dateLike.seconds || 0) * 1000);

  return revokedAtMs > 0 && tokenAuthTimeMs < revokedAtMs;
}
