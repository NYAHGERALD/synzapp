import { firestore } from '../config/firebaseAdmin.js';

/**
 * The list of people a compliance admin can search by.
 *
 * This exists because the search screen previously asked an Org Admin to type
 * user IDs. Nobody knows their colleagues' user IDs — that field was written for
 * a developer, and on a screen used to answer a legal request it is worse than
 * inconvenient: an admin who mistypes an ID gets an empty result and has no way
 * to tell it apart from "this person sent nothing".
 *
 * **Deliberately narrower than the employee directory.** It returns a name, a
 * department and the id the search needs — no phone numbers. A compliance admin
 * needs to pick a person, not to contact them, and the employee directory route
 * additionally requires user-management permissions a compliance admin has no
 * reason to hold.
 *
 * Scope note: chat compliance only. This does not touch the interpreter or any
 * other part of Synzapp.
 */

export interface CompliancePerson {
  departmentName: string;
  displayName: string;
  role: string;
  uid: string;
}

interface ApprovedPhoneRecord {
  /** Set when someone joined by claiming an invite rather than being assigned. */
  claimedByUid?: string;
  departmentName?: string;
  displayName?: string;
  employeeUid?: string;
  role?: string;
  status?: string;
}

export async function listCompliancePeople(tenantId: string): Promise<CompliancePerson[]> {
  const organizationRef = firestore.collection('organizations').doc(tenantId);

  // Two sources, because neither is complete on its own. `approvedPhones` holds
  // people who were invited, with their department; `users` holds everyone with
  // an account — including whoever created the organization, who was never
  // invited by anyone. Reading only the first left that person out, and their
  // messages appeared in search results under a raw identifier.
  const [approved, users] = await Promise.all([
    organizationRef.collection('approvedPhones').get().catch(() => null),
    organizationRef.collection('users').get().catch(() => null)
  ]);

  const byUid = new Map<string, CompliancePerson>();

  for (const doc of users?.docs || []) {
    const record = doc.data() as UserProfileRecord;
    const displayName = pickName(record.displayName, record.firstName, record.lastName);

    if (displayName) {
      byUid.set(doc.id, { departmentName: '', displayName, role: record.role || '', uid: doc.id });
    }
  }

  for (const doc of approved?.docs || []) {
    const record = doc.data() as ApprovedPhoneRecord;
    // Both fields carry the person's id depending on how they joined, and the
    // rest of the codebase reads them as a pair.
    const uid = record.employeeUid || record.claimedByUid || '';

    if (!uid) {
      continue;
    }

    const existing = byUid.get(uid);

    byUid.set(uid, {
      // The invite record knows the department; the account record does not.
      departmentName: record.departmentName || existing?.departmentName || '',
      displayName: record.displayName || existing?.displayName || 'Unnamed employee',
      role: record.role || existing?.role || '',
      uid
    });
  }

  // Sorted here rather than in the query: ordering by displayName in Firestore
  // drops every document that has no such field, which would silently hide
  // people who never set a name — the ones an admin is least able to spot as
  // missing.
  return Array.from(byUid.values())
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

interface UserProfileRecord {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

function pickName(
  displayName?: string,
  firstName?: string,
  lastName?: string
): string {
  const full = [firstName, lastName].filter(Boolean).join(' ').trim();

  return (displayName || '').trim() || full || '';
}
