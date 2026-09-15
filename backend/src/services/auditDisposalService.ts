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

export interface AuditDisposalResult {
  disposed: number;
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

  // Oldest first, and only a batch of them. Anything still inside its period
  // ends the pass, because everything after it is newer still.
  const page = await firestore
    .collection('organizations').doc(input.tenantId)
    .collection('auditLogs')
    .orderBy('createdAt', 'asc')
    .limit(DISPOSAL_BATCH_SIZE)
    .get()
    .catch(() => null);

  if (!page || page.empty) {
    return result;
  }

  const batch = firestore.batch();
  let pending = 0;

  for (const doc of page.docs) {
    const createdAt = doc.data().createdAt as { toMillis?: () => number } | undefined;

    result.scanned += 1;

    if (!isAuditEventDisposable({
      createdAtMs: typeof createdAt?.toMillis === 'function' ? createdAt.toMillis() : 0,
      nowMs,
      retentionDays
    })) {
      // Sorted oldest first, so nothing after this is old enough either.
      break;
    }

    batch.delete(doc.ref);
    pending += 1;
    result.disposed += 1;
  }

  if (pending > 0) {
    await batch.commit();
  }

  return result;
}
