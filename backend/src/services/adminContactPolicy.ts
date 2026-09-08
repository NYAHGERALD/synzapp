import type { SynzappRole } from '../types/auth.js';

/**
 * Who a person is told to ask, and whether they are given a number to ask on.
 *
 * Kept away from Firestore so it can be tested: the rules below are the whole
 * of the decision, and the service around them only fetches and stores.
 */

export interface AdminContactPolicy {
  /**
   * Whether an admin's phone number travels to their colleagues' phones.
   *
   * A company's decision, not Synzapp's, and per tenant — the same shape as
   * `scheduledMessagePolicy`. When it is off the number is never sent, rather
   * than sent and hidden: a value withheld in the interface is a value already
   * on the device.
   */
  showAdminPhoneNumber: boolean;
}

export const DEFAULT_ADMIN_CONTACT_POLICY: AdminContactPolicy = {
  showAdminPhoneNumber: true
};

export function normalizeAdminContactPolicy(
  stored?: Record<string, unknown> | null
): AdminContactPolicy {
  if (!stored || typeof stored !== 'object') {
    return { ...DEFAULT_ADMIN_CONTACT_POLICY };
  }

  return {
    showAdminPhoneNumber: typeof stored.showAdminPhoneNumber === 'boolean'
      ? stored.showAdminPhoneNumber
      : DEFAULT_ADMIN_CONTACT_POLICY.showAdminPhoneNumber
  };
}

export function validateAdminContactPolicyInput(
  input: { showAdminPhoneNumber?: unknown }
): { ok: boolean; reason?: string } {
  if (typeof input.showAdminPhoneNumber !== 'boolean') {
    return { ok: false, reason: 'Choose whether the admin phone number is shown.' };
  }

  return { ok: true };
}

export interface AdminContactCandidate {
  departmentId?: string | null;
  displayName: string;
  role?: SynzappRole;
  status?: string;
  uid: string;
}

export interface SelectedAdminContact {
  contactId: string;
  displayName: string;
  otherAdminCount: number;
  scope: 'DEPARTMENT' | 'ORGANIZATION';
}

/**
 * The one person to put on the card.
 *
 * A department admin first, because they are the nearer answer. Falling back to
 * an organization admin covers the two cases that exist on the live tenant
 * today: a department with no admin, and a department admin looking at their
 * own menu — where naming themselves as the person to ask is no answer at all.
 *
 * Never the reader. Sorted by name so the same person is shown every time; a
 * card that names a different manager on each open is one nobody trusts.
 */
export function selectProfileAdminContact(input: {
  candidates: AdminContactCandidate[];
  readerDepartmentId: string | null;
  readerUid: string;
}): SelectedAdminContact | null {
  const usable = input.candidates
    .filter((candidate) => candidate.uid && candidate.uid !== input.readerUid)
    .filter((candidate) => (candidate.status || 'ACTIVE') === 'ACTIVE')
    .filter((candidate) => candidate.displayName.trim().length > 0);

  const departmentAdmins = input.readerDepartmentId
    ? sortByName(usable.filter((candidate) => (
      candidate.role === 'DEPT_ADMIN' && candidate.departmentId === input.readerDepartmentId
    )))
    : [];

  if (departmentAdmins.length) {
    return {
      contactId: departmentAdmins[0].uid,
      displayName: departmentAdmins[0].displayName.trim(),
      otherAdminCount: departmentAdmins.length - 1,
      scope: 'DEPARTMENT'
    };
  }

  const organizationAdmins = sortByName(usable.filter((candidate) => candidate.role === 'ORG_ADMIN'));

  if (!organizationAdmins.length) {
    return null;
  }

  return {
    contactId: organizationAdmins[0].uid,
    displayName: organizationAdmins[0].displayName.trim(),
    otherAdminCount: organizationAdmins.length - 1,
    scope: 'ORGANIZATION'
  };
}

function sortByName(candidates: AdminContactCandidate[]): AdminContactCandidate[] {
  return [...candidates].sort((first, second) => (
    first.displayName.localeCompare(second.displayName) || first.uid.localeCompare(second.uid)
  ));
}
