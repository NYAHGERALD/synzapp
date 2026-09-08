import { DecodedIdToken } from 'firebase-admin/auth';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import { listActiveLegalHolds } from './legalHoldService.js';

/**
 * The queue between "this may now be deleted" and "the bytes are gone".
 *
 * Nothing in Synzapp is destroyed on a request path. When an obligation expires
 * the item lands here, stays fully readable and exportable, and is destroyed
 * only after a named person approves it.
 *
 * **The published timeline.** Microsoft's pipeline takes roughly sixteen days to
 * fully honour a one-day delete policy and states that nowhere, so administrators
 * discover it by observation. Synzapp uses the same sixteen days — the work is
 * genuinely the same — but shows the number in the console next to the retention
 * field. A promise of "within 16 days" that holds is worth more than "immediate"
 * that does not.
 */

export const DISPOSITION_SLA_DAYS = 16;
export const DISPOSITION_SLA_MS = DISPOSITION_SLA_DAYS * 24 * 60 * 60 * 1000;

/** How fresh a phone verification must be to approve a destruction. */
export const DISPOSITION_APPROVAL_AUTH_WINDOW_MS = 10 * 60 * 1000;

export type DispositionState = 'APPROVED' | 'EXTENDED' | 'PENDING' | 'PURGED' | 'WITHHELD';

export interface DispositionItemRecord {
  approvedByUid?: string | null;
  decidedAtMs?: number | null;
  /** When the obligation expired and the item entered the queue. */
  eligibleAtMs: number;
  id: string;
  /** What this covers, in words an administrator can act on. */
  label: string;
  /** The hold blocking it, when one is. */
  withheldByHoldId?: string | null;
  itemCount: number;
  /** The published date by which destruction will have completed. */
  purgeByMs: number;
  state: DispositionState;
  subjectRef: string;
  tenantId: string;
}

function dispositionRef(tenantId: string) {
  return firestore.collection('tenants').doc(tenantId).collection('dispositionItems');
}

/**
 * Refuses unless the approver verified their phone in the last few minutes.
 *
 * Approving a destruction is irreversible, so it re-uses the same phone
 * verification as signing in: `auth_time` only moves when the user actually
 * completes that flow again. A long-lived session on an unlocked laptop is not
 * enough on its own to destroy a company's records.
 */
export function assertDispositionApprovalAuthentication(decodedToken: DecodedIdToken): void {
  const authTimeMs = (decodedToken.auth_time || 0) * 1000;

  if (!authTimeMs || Date.now() - authTimeMs > DISPOSITION_APPROVAL_AUTH_WINDOW_MS) {
    throw Object.assign(
      new Error('Verify your phone number again before approving a deletion.'),
      { statusCode: 401 }
    );
  }
}

/** Everything waiting on a decision, newest obligations first. */
export async function listDispositionQueue(tenantId: string): Promise<DispositionItemRecord[]> {
  const snapshot = await dispositionRef(tenantId).get();

  return snapshot.docs
    .map((doc) => doc.data() as DispositionItemRecord)
    .sort((first, second) => first.eligibleAtMs - second.eligibleAtMs);
}

/**
 * Puts an expired obligation into the queue.
 *
 * An item under an active hold is recorded as withheld rather than skipped
 * silently. An administrator looking at an empty queue cannot tell the
 * difference between "nothing expired" and "everything is frozen", and the plan
 * requires the withheld count to be stated.
 */
export async function enqueueDispositionItem(input: {
  eligibleAtMs: number;
  itemCount: number;
  label: string;
  subjectRef: string;
  tenantId: string;
}): Promise<DispositionItemRecord> {
  const activeHolds = await listActiveLegalHolds(input.tenantId);
  const itemRef = dispositionRef(input.tenantId).doc();
  const record: DispositionItemRecord = {
    approvedByUid: null,
    decidedAtMs: null,
    eligibleAtMs: input.eligibleAtMs,
    id: itemRef.id,
    itemCount: input.itemCount,
    label: input.label,
    purgeByMs: input.eligibleAtMs + DISPOSITION_SLA_MS,
    state: activeHolds.length ? 'WITHHELD' : 'PENDING',
    subjectRef: input.subjectRef,
    tenantId: input.tenantId,
    withheldByHoldId: activeHolds[0]?.id || null
  };

  await itemRef.set({ ...record, createdAt: fieldValue.serverTimestamp() });

  return record;
}

/**
 * Approves a batch for destruction.
 *
 * Re-checks holds at approval time rather than trusting the state written when
 * the item was queued: a hold applied in between must win, and the queue may
 * have been sitting for days.
 */
export async function approveDispositionItem(input: {
  actorUid: string;
  itemId: string;
  tenantId: string;
}): Promise<DispositionItemRecord> {
  const itemRef = dispositionRef(input.tenantId).doc(input.itemId);
  const snapshot = await itemRef.get();

  if (!snapshot.exists) {
    throw Object.assign(new Error('That disposition batch no longer exists.'), { statusCode: 404 });
  }

  const record = snapshot.data() as DispositionItemRecord;

  if (record.state === 'PURGED') {
    throw Object.assign(new Error('That batch has already been destroyed.'), { statusCode: 409 });
  }

  const activeHolds = await listActiveLegalHolds(input.tenantId);

  if (activeHolds.length) {
    await itemRef.set({
      state: 'WITHHELD',
      updatedAt: fieldValue.serverTimestamp(),
      withheldByHoldId: activeHolds[0].id
    }, { merge: true });

    throw Object.assign(
      new Error(`A legal hold (${activeHolds[0].caseId}) prevents this deletion.`),
      { statusCode: 409 }
    );
  }

  const decidedAtMs = Date.now();

  await itemRef.set({
    approvedByUid: input.actorUid,
    decidedAtMs,
    state: 'APPROVED',
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });

  return { ...record, approvedByUid: input.actorUid, decidedAtMs, state: 'APPROVED' };
}

/** Keeps a batch for longer. Always available, and never requires a reason to refuse. */
export async function extendDispositionItem(input: {
  actorUid: string;
  extraDays: number;
  itemId: string;
  tenantId: string;
}): Promise<void> {
  const extraMs = Math.max(1, Math.round(input.extraDays)) * 24 * 60 * 60 * 1000;
  const itemRef = dispositionRef(input.tenantId).doc(input.itemId);
  const snapshot = await itemRef.get();

  if (!snapshot.exists) {
    throw Object.assign(new Error('That disposition batch no longer exists.'), { statusCode: 404 });
  }

  const record = snapshot.data() as DispositionItemRecord;

  await itemRef.set({
    decidedAtMs: Date.now(),
    eligibleAtMs: record.eligibleAtMs + extraMs,
    purgeByMs: record.purgeByMs + extraMs,
    state: 'EXTENDED',
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });
}
