import { env } from '../config/env.js';
import { firestore } from '../config/firebaseAdmin.js';
import { listActiveLegalHolds } from './legalHoldService.js';
import {
  isAuditEventDisposable,
  resolveAuditRetentionDays,
  type PublishedRetentionBounds
} from './auditRetentionRules.js';

/**
 * Ageing the audit log out, and nothing else ageing it.
 *
 * This is the **only** way an audit event leaves the system. There is no route,
 * no console control and no admin action that removes one, because an audit log
 * an administrator can erase is a diary rather than a record.
 *
 * How long is not decided here. The period comes from what has been published
 * for the tenant, held to the invariant that audit outlives the records it
 * describes. See `auditRetentionRules` and section 6 of the governance plan.
 */

/** Small on purpose: this runs beside live traffic and must never dominate it. */
const DISPOSAL_BATCH_SIZE = 200;

/**
 * How long one tenant's disposal may take.
 *
 * This runs beside live traffic. A tenant with a large backlog gets as much of
 * it as this allows and the rest tomorrow, rather than holding the nightly pass
 * open while every other tenant waits behind it.
 */
const DISPOSAL_TIME_BUDGET_MS = 20_000;

export interface AuditDisposalResult {
  disposed: number;
  /** True when the budget ended the pass with disposable events still waiting. */
  ranOutOfTime?: boolean;
  /** True when a preservation obligation stopped this pass entirely. */
  heldBack?: boolean;
  retentionDays: number;
  scanned: number;
}

/**
 * Reads what an organization has published for its own audit retention.
 *
 * Absent is not the same as zero: a tenant that has published nothing gets the
 * safe fallback rather than immediate disposal, which is the difference between
 * a policy not yet set up and a policy of deleting everything.
 */
async function readTenantAuditRetention(tenantId: string): Promise<{
  bounds: PublishedRetentionBounds | null;
  recordRetentionDays: number | null;
  requestedDays: number | null;
}> {
  const snapshot = await firestore
    .collection('organizations').doc(tenantId)
    .get()
    .catch(() => null);
  const data = snapshot?.data() as Record<string, unknown> | undefined;
  const published = data?.auditRetentionBounds as
    { maximumDays?: number | null; minimumDays?: number } | undefined;

  return {
    bounds: published && Number.isFinite(published.minimumDays)
      ? {
          maximumDays: Number.isFinite(published.maximumDays)
            ? (published.maximumDays as number)
            : null,
          minimumDays: published.minimumDays as number
        }
      : null,
    recordRetentionDays: Number.isFinite(data?.recordRetentionDays)
      ? (data?.recordRetentionDays as number)
      : null,
    requestedDays: Number.isFinite(data?.auditRetentionDays)
      ? (data?.auditRetentionDays as number)
      : null
  };
}

export async function disposeExpiredAuditEvents(input: {
  nowMs?: number;
  tenantId: string;
}): Promise<AuditDisposalResult> {
  const nowMs = input.nowMs ?? Date.now();
  const settings = await readTenantAuditRetention(input.tenantId);
  const { days: retentionDays } = resolveAuditRetentionDays(settings);
  const result: AuditDisposalResult = { disposed: 0, retentionDays, scanned: 0 };

  /**
   * Nothing ages out while the tenant is under a preservation obligation.
   *
   * This was the one destruction path that did not ask. Every other one
   * re-checks holds before it removes anything, but the nightly audit pass went
   * on deleting through a legal hold — destroying the record of who accessed and
   * altered the very material being preserved.
   *
   * Audit events are the one class that should never age out under a hold. They
   * are the evidence about the evidence, and a hold that does not cover them
   * leaves exactly the gap a spoliation argument is made of.
   */
  const activeHolds = await listActiveLegalHolds(input.tenantId, nowMs);

  if (activeHolds.length) {
    return { ...result, heldBack: true };
  }

  const auditLogsRef = firestore
    .collection('organizations').doc(input.tenantId)
    .collection('auditLogs');

  /**
   * Pages until the tenant is caught up, or until the budget runs out.
   *
   * One page of two hundred per tenant per night meant a tenant generating more
   * expired events than that each day never caught up — the backlog grew for
   * ever and the retention period the product states was simply not enforced.
   * Nothing showed it: the run reported two hundred disposed every night and
   * looked like it was working.
   *
   * The budget is what keeps this from becoming the opposite problem. This runs
   * beside live traffic, so a tenant with an enormous backlog gets as much of it
   * as the budget allows and the rest tomorrow, rather than holding the nightly
   * pass open while every other tenant waits.
   */
  const deadlineMs = nowMs + DISPOSAL_TIME_BUDGET_MS;
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;


  while (Date.now() < deadlineMs) {
    const ordered = auditLogsRef.orderBy('createdAt', 'asc').limit(DISPOSAL_BATCH_SIZE);
    const query: FirebaseFirestore.Query = cursor ? ordered.startAfter(cursor) : ordered;
    const page: FirebaseFirestore.QuerySnapshot | null = await query.get().catch(() => null);

    if (!page || page.empty) {
      return result;
    }

    const batch = firestore.batch();
    let pending = 0;
    let reachedLiveEvents = false;

    for (const doc of page.docs) {
      const createdAt = doc.data().createdAt as { toMillis?: () => number } | undefined;

      result.scanned += 1;

      if (!isAuditEventDisposable({
        createdAtMs: typeof createdAt?.toMillis === 'function' ? createdAt.toMillis() : 0,
        nowMs,
        retentionDays
      })) {
        // Sorted oldest first, so nothing after this is old enough either.
        reachedLiveEvents = true;
        break;
      }

      batch.delete(doc.ref);
      pending += 1;
      result.disposed += 1;
    }

    if (pending > 0) {
      await batch.commit();
    }

    if (reachedLiveEvents || page.docs.length < DISPOSAL_BATCH_SIZE) {
      return result;
    }

    cursor = page.docs[page.docs.length - 1];
  }

  /**
   * Out of time with work still to do. Said out loud rather than returned as a
   * number that looks like completion, because "disposed two hundred" and
   * "disposed two hundred and there are thousands left" are different facts.
   */
  result.ranOutOfTime = true;

  return result;
}


/**
 * Ages out the events that belong to no tenant.
 *
 * The root collection had no disposal at all, so every unattributed event ever
 * written was still there — and before the write was narrowed, that was *every*
 * event, from every customer, including ones long offboarded.
 *
 * Nothing reads this collection, which is why the period is short and its own.
 * It exists so that a probe against an endpoint with no credential leaves a
 * trace somebody can look at while it is still relevant, not so that a record of
 * it is kept for years.
 *
 * No legal hold check, and that is correct rather than an omission: a hold
 * belongs to a tenant and these events have none. An event that can be
 * attributed is written to its tenant instead, where the hold does apply.
 */
export async function disposeUnattributedAuditEvents(input: {
  nowMs?: number;
} = {}): Promise<{ disposed: number; ranOutOfTime: boolean; retentionDays: number }> {
  const nowMs = input.nowMs ?? Date.now();
  const retentionDays = env.unattributedAuditRetentionDays;
  const result = { disposed: 0, ranOutOfTime: false, retentionDays };
  const deadlineMs = nowMs + DISPOSAL_TIME_BUDGET_MS;
  const auditLogsRef = firestore.collection('auditLogs');

  while (Date.now() < deadlineMs) {
    const page: FirebaseFirestore.QuerySnapshot | null = await auditLogsRef
      .orderBy('createdAt', 'asc')
      .limit(DISPOSAL_BATCH_SIZE)
      .get()
      .catch(() => null);

    if (!page || page.empty) {
      return result;
    }

    const batch = firestore.batch();
    let pending = 0;
    let reachedLiveEvents = false;

    for (const doc of page.docs) {
      const createdAt = doc.data().createdAt as { toMillis?: () => number } | undefined;

      if (!isAuditEventDisposable({
        createdAtMs: typeof createdAt?.toMillis === 'function' ? createdAt.toMillis() : 0,
        nowMs,
        retentionDays
      })) {
        // Oldest first, so nothing after this is old enough either.
        reachedLiveEvents = true;
        break;
      }

      batch.delete(doc.ref);
      pending += 1;
      result.disposed += 1;
    }

    if (pending > 0) {
      await batch.commit();
    }

    /**
     * No cursor, deliberately. Each pass deletes from the oldest end, so the
     * next page is genuinely new work — paging past what was just removed would
     * skip records rather than revisit them.
     */
    if (reachedLiveEvents || pending === 0) {
      return result;
    }
  }

  result.ranOutOfTime = true;

  return result;
}
