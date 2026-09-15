import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import { isHoldActive, type LegalHold } from './retentionEvaluation.js';

/**
 * Legal holds, following Microsoft Purview's eDiscovery hold model.
 *
 * A hold overrides every retention policy and suspends destruction
 * indefinitely. It is the backstop that makes a retention dial safe to hand an
 * administrator: without it, a mistyped policy destroys evidence that is under
 * a preservation obligation, and no apology recovers it.
 *
 * The plan's hard rule follows from that — **the retention console does not ship
 * before hold override works.** A retention control with no backstop underneath
 * is a documented method for destroying discoverable evidence.
 *
 * Two properties matter more than anything else here:
 *
 * **Release is never instant.** Lifting a hold starts a delay before the
 * disposer may act. A hold released by mistake is recoverable; evidence shredded
 * the same second is not.
 *
 * **A hold blocks tenant deletion.** Offboarding an organization with an active
 * hold is refused, not warned about.
 */

export const HOLD_RELEASE_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

export interface LegalHoldRecord extends LegalHold {
  appliedAtMs: number;
  appliedByUid: string;
  caseId: string;
  /** Empty means every custodian in the tenant. */
  custodianUids: string[];
  description: string;
  releasedByUid?: string | null;
  tenantId: string;
}

function holdsRef(tenantId: string) {
  return firestore.collection('tenants').doc(tenantId).collection('legalHolds');
}

export function validateLegalHoldInput(input: { caseId: string; description: string }): string | null {
  if (!input.caseId.trim()) {
    return 'A legal hold needs a case reference.';
  }

  if (!input.description.trim()) {
    // A hold that outlives the person who applied it is the normal case, so the
    // reason for it has to be recorded with it.
    return 'A legal hold needs a description of what it preserves.';
  }

  return null;
}

export async function applyLegalHold(input: {
  actorUid: string;
  caseId: string;
  custodianUids?: string[];
  description: string;
  tenantId: string;
}): Promise<LegalHoldRecord> {
  const validationError = validateLegalHoldInput(input);

  if (validationError) {
    throw new Error(validationError);
  }

  const collection = holdsRef(input.tenantId);
  const holdRef = collection.doc();
  const record: LegalHoldRecord = {
    appliedAtMs: Date.now(),
    appliedByUid: input.actorUid,
    caseId: input.caseId.trim(),
    custodianUids: input.custodianUids || [],
    delayUntilMs: null,
    description: input.description.trim(),
    id: holdRef.id,
    releasedAtMs: null,
    releasedByUid: null,
    tenantId: input.tenantId
  };

  await holdRef.set({ ...record, updatedAt: fieldValue.serverTimestamp() });

  return record;
}

/**
 * Releases a hold, with a delay before it stops protecting anything.
 *
 * The delay is the difference between a mistake and an incident. A hold lifted
 * in error can be re-applied within the window; without it, the disposer may
 * shred in the interval between the wrong click and noticing.
 */
export async function releaseLegalHold(input: {
  actorUid: string;
  holdId: string;
  tenantId: string;
}): Promise<{ delayUntilMs: number }> {
  const nowMs = Date.now();
  const delayUntilMs = nowMs + HOLD_RELEASE_DELAY_MS;
  const holdRef = holdsRef(input.tenantId).doc(input.holdId);
  const existing = await holdRef.get();

  /**
   * The hold has to exist before it can be released.
   *
   * A merge write created one out of nothing, so a mistyped id produced a
   * phantom document that `isHoldActive` then read as released-with-delay — and
   * the route audited it as a successful release. Somebody could believe they
   * had lifted a hold that was still in force, or that a hold existed where none
   * ever had. `approveDispositionItem` already reads first for the same reason.
   */
  if (!existing.exists) {
    const error = new Error('That legal hold was not found.');

    error.name = 'NotFoundError';

    throw error;
  }

  await holdRef.set({
    delayUntilMs,
    releasedAtMs: nowMs,
    releasedByUid: input.actorUid,
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });

  return { delayUntilMs };
}

export async function listLegalHolds(tenantId: string): Promise<LegalHoldRecord[]> {
  const snapshot = await holdsRef(tenantId).get();

  return snapshot.docs
    .map((doc) => doc.data() as LegalHoldRecord)
    .sort((first, second) => second.appliedAtMs - first.appliedAtMs);
}

/** The holds still suspending destruction, including those inside a release delay. */
export async function listActiveLegalHolds(
  tenantId: string,
  nowMs = Date.now()
): Promise<LegalHoldRecord[]> {
  const holds = await listLegalHolds(tenantId);

  return holds.filter((hold) => isHoldActive(hold, nowMs));
}

/**
 * Whether an organization may be deleted.
 *
 * Refused outright while a hold is active. Offboarding is the one operation
 * that would destroy everything a hold exists to preserve, and a warning is not
 * a control — someone in a hurry clicks through it.
 */
export async function assertTenantDeletableUnderHolds(
  tenantId: string,
  nowMs = Date.now()
): Promise<void> {
  const activeHolds = await listActiveLegalHolds(tenantId, nowMs);

  if (!activeHolds.length) {
    return;
  }

  const cases = activeHolds.map((hold) => hold.caseId).join(', ');

  throw new Error(
    `This organization cannot be deleted while ${activeHolds.length} legal hold(s) are active (${cases}). Release the holds first.`
  );
}
