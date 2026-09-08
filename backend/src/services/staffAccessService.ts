import type { DecodedIdToken } from 'firebase-admin/auth';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';

/**
 * Who is allowed into Synzapp's own console.
 *
 * Separate from the customer identity system on purpose. The product already
 * has a `SYSTEM_ADMIN` role, honoured across the interpreter, group chat,
 * Leaders Standard Work and device identity services — and it is reached by the
 * same phone sign-in customers use. Building staff access on it would mean one
 * compromised account, or one missing check in one service, puts a Synzapp
 * employee inside a customer's data.
 *
 * **Two conditions, both required, neither cached.**
 *
 * 1. A Google account on the company's own domain, with a verified address.
 * 2. A record in the staff list marking that person active.
 *
 * The domain alone is not enough. Domain checks fail the day somebody registers
 * a lookalike account, or a domain is misconfigured, or an old address is
 * recycled — and the failure is silent. The list is the authority; the domain
 * is a second lock on the same door.
 *
 * Removing somebody is one change to their record, and their access ends on the
 * next request.
 *
 * Scope note: this grants access to Synzapp's own operations only. No staff
 * route reads customer chat, interpreter or compliance data, and this file must
 * never be used to reach them.
 */

export type StaffRole = 'SUPPORT' | 'ADMIN';

export interface StaffMember {
  createdAtMs: number;
  displayName: string;
  email: string;
  role: StaffRole;
  status: 'ACTIVE' | 'SUSPENDED';
  uid: string;
}

export interface StaffContext {
  displayName: string;
  email: string;
  role: StaffRole;
  uid: string;
}

/**
 * The domain staff accounts must belong to.
 *
 * Configured rather than hard-coded so it can be corrected without a deploy,
 * but with no default: an unset value denies everyone rather than admitting
 * anyone. Failing closed is the only safe direction for a gate like this.
 */
function getStaffDomain(): string {
  return (process.env.SYNZAPP_STAFF_DOMAIN || '').trim().toLowerCase();
}

function staffRef() {
  return firestore.collection('synzappStaff');
}

function authorizationError(message: string): Error {
  const error = new Error(message);

  error.name = 'AuthorizationError';

  return error;
}

export async function requireStaff(decodedToken: DecodedIdToken): Promise<StaffContext> {
  const domain = getStaffDomain();

  if (!domain) {
    // Unset configuration denies everyone. The alternative — treating it as
    // "no restriction" — would open the console to any Google account.
    throw authorizationError('Staff access is not configured.');
  }

  const email = (decodedToken.email || '').trim().toLowerCase();

  if (!email || decodedToken.email_verified !== true) {
    throw authorizationError('A verified work account is required.');
  }

  if (!email.endsWith(`@${domain}`)) {
    throw authorizationError('This account is not part of Synzapp.');
  }

  // Google sign-in only. A phone or password sign-in reaching this point would
  // mean the console shares an entry route with the customer app.
  if (decodedToken.firebase?.sign_in_provider !== 'google.com') {
    throw authorizationError('Sign in with your Synzapp work account.');
  }

  const snapshot = await staffRef().doc(decodedToken.uid).get();

  if (!snapshot.exists) {
    throw authorizationError('This account is not on the Synzapp staff list.');
  }

  const member = snapshot.data() as StaffMember;

  if (member.status !== 'ACTIVE') {
    throw authorizationError('This staff account is suspended.');
  }

  // The stored address is checked against the token's. A recycled or changed
  // address must not inherit somebody else's access.
  if ((member.email || '').trim().toLowerCase() !== email) {
    throw authorizationError('This staff record does not match the signed-in account.');
  }

  return {
    displayName: member.displayName || email,
    email,
    role: member.role === 'ADMIN' ? 'ADMIN' : 'SUPPORT',
    uid: decodedToken.uid
  };
}

/** Actions only a staff administrator may take, such as publishing a policy. */
export function requireStaffAdmin(context: StaffContext): void {
  if (context.role !== 'ADMIN') {
    throw authorizationError('This action needs a Synzapp administrator.');
  }
}

export async function listStaff(): Promise<StaffMember[]> {
  const snapshot = await staffRef().get();

  return snapshot.docs
    .map((doc) => doc.data() as StaffMember)
    .sort((left, right) => (left.displayName || '').localeCompare(right.displayName || ''));
}

/**
 * Adds or updates a staff member.
 *
 * Keyed by the account's own id rather than by email, so changing somebody's
 * display name or address cannot accidentally create a second entry that
 * outlives the first.
 */
export async function upsertStaffMember(input: {
  displayName: string;
  email: string;
  role: StaffRole;
  status: StaffMember['status'];
  uid: string;
}): Promise<void> {
  await staffRef().doc(input.uid).set({
    createdAtMs: Date.now(),
    displayName: input.displayName.trim().slice(0, 200),
    email: input.email.trim().toLowerCase().slice(0, 320),
    role: input.role,
    status: input.status,
    uid: input.uid,
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });
}
