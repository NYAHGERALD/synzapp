import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import type { StaffContext } from './staffAccessService.js';

/**
 * The retention periods a tenant is allowed to choose between.
 *
 * Set by Synzapp staff on `admin.synzapp.com`, not compiled into the product.
 * No single period is right across the industries Synzapp sells into — FDA
 * wants two years, OSHA five, HIPAA six, SOX seven, and GDPR pulls the other
 * way — and the person accountable for the answer is a compliance officer or an
 * account manager, not somebody who can cut a release.
 *
 * Published the same way policy text is, and for the same reasons: a buyer
 * compares this year's bounds with last year's, and "who widened that, and
 * when" needs an answer with a name against it.
 *
 * **A published version is never modified.** Publishing writes a new version and
 * moves the pointer, so every past setting stays readable at its own address.
 *
 * See section 6 of SYNZAPP_ACTIONS_GOVERNANCE_PLAN.md.
 */

export interface RetentionBoundsRecord {
  /** Null means no ceiling: a tenant may keep records indefinitely. */
  maximumDays: number | null;
  minimumDays: number;
  publishedAtMs: number;
  publishedByEmail: string;
  publishedByUid: string;
  /** Which starting set this came from, for support to reason about later. */
  templateId: string;
  version: number;
}

/**
 * Starting points, not limits.
 *
 * Each names the regime it came from so that a number can be argued with rather
 * than merely obeyed. Staff pick one and adjust; nothing here is applied
 * automatically to any tenant.
 */
export const RETENTION_TEMPLATES: {
  id: string;
  label: string;
  maximumDays: number | null;
  minimumDays: number;
  rationale: string;
}[] = [
  {
    id: 'food-safety',
    label: 'Food safety',
    maximumDays: 3650,
    minimumDays: 730,
    rationale: 'FDA 21 CFR 117.315 requires two years for preventive control records.'
  },
  {
    id: 'workplace-safety',
    label: 'Workplace safety',
    maximumDays: 3650,
    minimumDays: 1825,
    rationale: 'OSHA 29 CFR 1904.33 requires five years for injury and illness records.'
  },
  {
    id: 'healthcare',
    label: 'Healthcare',
    maximumDays: 3650,
    minimumDays: 2190,
    rationale: 'HIPAA §164.316(b)(2) requires six years.'
  },
  {
    id: 'financial',
    label: 'Financial',
    maximumDays: null,
    minimumDays: 2555,
    rationale: 'Sarbanes-Oxley §802 requires seven years.'
  },
  {
    id: 'data-minimising',
    label: 'Data minimising',
    maximumDays: 1095,
    minimumDays: 365,
    rationale:
      'GDPR Article 5(1)(e) asks that nothing be kept longer than necessary. For an ' +
      'organization whose works council or DPA expects a short horizon.'
  }
];

function boundsVersionsRef(tenantId: string) {
  return firestore
    .collection('organizations').doc(tenantId)
    .collection('retentionBoundsVersions');
}

/**
 * Publishes a new set of bounds for one tenant.
 *
 * Refuses a range that cannot be satisfied rather than storing it and failing
 * later, when the failure would look like a disposal bug.
 */
export async function publishRetentionBounds(input: {
  maximumDays: number | null;
  minimumDays: number;
  staff: StaffContext;
  templateId: string;
  tenantId: string;
}): Promise<RetentionBoundsRecord> {
  if (!Number.isFinite(input.minimumDays) || input.minimumDays < 1) {
    throw new Error('A minimum retention of at least one day is required.');
  }

  if (input.maximumDays !== null && input.maximumDays < input.minimumDays) {
    throw new Error('The maximum cannot be shorter than the minimum.');
  }

  const latest = await boundsVersionsRef(input.tenantId)
    .orderBy('version', 'desc')
    .limit(1)
    .get()
    .catch(() => null);
  const version = latest && !latest.empty
    ? Number((latest.docs[0].data() as RetentionBoundsRecord).version || 0) + 1
    : 1;
  const record: RetentionBoundsRecord = {
    maximumDays: input.maximumDays,
    minimumDays: Math.round(input.minimumDays),
    publishedAtMs: Date.now(),
    publishedByEmail: input.staff.email,
    publishedByUid: input.staff.uid,
    templateId: input.templateId,
    version
  };

  await firestore.runTransaction(async (transaction) => {
    // The version is written first and never touched again. The pointer on the
    // organization is what the disposer reads, so moving it is what makes a
    // change take effect — and every earlier version stays where it was.
    transaction.set(boundsVersionsRef(input.tenantId).doc(String(version)), record);
    transaction.set(
      firestore.collection('organizations').doc(input.tenantId),
      {
        auditRetentionBounds: {
          maximumDays: record.maximumDays,
          minimumDays: record.minimumDays
        },
        retentionBoundsVersion: version,
        updatedAt: fieldValue.serverTimestamp()
      },
      { merge: true }
    );
  });

  return record;
}

/** Every version ever published, newest first. Nothing here is editable. */
export async function listRetentionBoundsHistory(
  tenantId: string
): Promise<RetentionBoundsRecord[]> {
  const snapshot = await boundsVersionsRef(tenantId)
    .orderBy('version', 'desc')
    .limit(50)
    .get()
    .catch(() => null);

  return snapshot ? snapshot.docs.map((doc) => doc.data() as RetentionBoundsRecord) : [];
}
