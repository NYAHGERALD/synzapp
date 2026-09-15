import { firestore } from '../config/firebaseAdmin.js';
import { LEGAL_HOLD_ERROR_CODE } from './actionService.js';
import { removeActionBody } from './actionService.js';
import { removeAnnouncementBody } from './announcementService.js';
import { isPastRetentionPeriod } from './retentionAge.js';

/**
 * Removing the contents of actions and announcements once their period is up.
 *
 * `removeActionBody` and `removeAnnouncementBody` have existed for some time
 * and **nothing called them**, so an organization's retention policy applied to
 * everything except the two record types most likely to carry what somebody
 * wanted removed. This is the job that finally runs them.
 *
 * What goes is the body — the words, the attachments. What stays is the record
 * that it existed, who raised it, who was answerable and how it ended, along
 * with the audit trail. That is the same bargain the compliance archive makes:
 * an organization can honour an erasure obligation without losing the evidence
 * that it had a process at all.
 *
 * Legal holds are honoured by the two functions themselves, which refuse rather
 * than skip quietly. A hold that stops a disposal is reported, not swallowed.
 */

/** Small on purpose: this runs beside live traffic. */
const DISPOSAL_BATCH_SIZE = 100;

function isLegalHoldError(error: unknown): boolean {
  return Boolean(error) &&
    typeof error === 'object' &&
    (error as { code?: unknown }).code === LEGAL_HOLD_ERROR_CODE;
}

export interface RecordBodyDisposalResult {
  actionsDisposed: number;
  announcementsDisposed: number;
  heldBack: number;
  retentionDays: number;
}

async function readRecordRetentionDays(tenantId: string): Promise<number | null> {
  const snapshot = await firestore
    .collection('organizations').doc(tenantId)
    .get()
    .catch(() => null);
  const days = (snapshot?.data() as Record<string, unknown> | undefined)?.recordRetentionDays;

  return Number.isFinite(days) ? (days as number) : null;
}

export async function disposeExpiredRecordBodies(input: {
  nowMs?: number;
  tenantId: string;
}): Promise<RecordBodyDisposalResult> {
  const nowMs = input.nowMs ?? Date.now();
  const retentionDays = await readRecordRetentionDays(input.tenantId);
  const result: RecordBodyDisposalResult = {
    actionsDisposed: 0,
    announcementsDisposed: 0,
    heldBack: 0,
    retentionDays: retentionDays ?? 0
  };

  // No published period means nothing is overdue. A tenant that has not set one
  // up must not have its records emptied on a default.
  if (!retentionDays || retentionDays <= 0) {
    return result;
  }

  result.actionsDisposed = await disposeCollection({
    collection: 'actions',
    dispose: (id) => removeActionBody(input.tenantId, id),
    isAlreadyEmpty: (raw) => Boolean(raw.bodyRemovedAtMs),
    nowMs,
    result,
    retentionDays,
    tenantId: input.tenantId
  });

  result.announcementsDisposed = await disposeCollection({
    collection: 'announcements',
    dispose: (id) => removeAnnouncementBody(input.tenantId, id),
    isAlreadyEmpty: (raw) => Boolean(raw.bodyRemovedAtMs),
    nowMs,
    result,
    retentionDays,
    tenantId: input.tenantId
  });

  return result;
}

async function disposeCollection(input: {
  collection: string;
  dispose: (id: string) => Promise<void>;
  isAlreadyEmpty: (raw: Record<string, unknown>) => boolean;
  nowMs: number;
  result: RecordBodyDisposalResult;
  retentionDays: number;
  tenantId: string;
}): Promise<number> {
  // Oldest first, so the pass can stop at the first record still inside its
  // period rather than reading a tenant's whole history every night.
  const page = await firestore
    .collection('organizations').doc(input.tenantId)
    .collection(input.collection)
    .orderBy('createdAtMs', 'asc')
    .limit(DISPOSAL_BATCH_SIZE)
    .get()
    .catch(() => null);

  if (!page || page.empty) {
    return 0;
  }

  let disposed = 0;

  for (const doc of page.docs) {
    const raw = doc.data() as Record<string, unknown>;

    if (!isPastRetentionPeriod({
      createdAtMs: Number(raw.createdAtMs || 0),
      nowMs: input.nowMs,
      retentionDays: input.retentionDays
    })) {
      break;
    }

    if (input.isAlreadyEmpty(raw)) {
      continue;
    }

    try {
      await input.dispose(doc.id);
      disposed += 1;
    } catch (error) {
      /**
       * Only an actual hold counts as held back.
       *
       * This used to be a bare catch with the comment "a legal hold, almost
       * always" — so a permissions error, a Firestore outage and a plain bug all
       * reported as the counter the design treats as the system working rather
       * than breaking. A disposal that silently fails every night looked
       * identical to one correctly blocked, which is the opposite of what a
       * record-keeping control is for.
       */
      if (isLegalHoldError(error)) {
        input.result.heldBack += 1;
        continue;
      }

      throw error;
    }
  }

  return disposed;
}
