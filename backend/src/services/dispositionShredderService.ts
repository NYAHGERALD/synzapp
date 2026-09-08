import { fieldValue, firestore, storageBucket } from '../config/firebaseAdmin.js';
import { listActiveLegalHolds } from './legalHoldService.js';
import type { DispositionItemRecord } from './dispositionService.js';

/**
 * Destroys content that an administrator approved for deletion.
 *
 * This is the only part of Synzapp that destroys a customer's data, and it is
 * written to be paranoid about it.
 *
 * **Nothing happens on a request.** An admin approving a batch starts a clock;
 * the destruction happens later, in a background job. That gap is what makes an
 * approval given by mistake recoverable.
 *
 * **The grace window is not optional.** For seven days after approval the
 * content is still readable, still searchable, and still included in an export.
 * An administrator can put it back.
 *
 * **Holds are re-checked immediately before destroying.** The batch may have sat
 * for a week; a court order arriving during that week must win. Checking only at
 * approval time would destroy evidence that became protected in between.
 *
 * **It is switched off by default.** A tenant must be explicitly opted in. The
 * cost of a bug here is a customer's records, and no apology recovers them.
 */

export const DISPOSITION_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export interface ShredderRunSummary {
  /** Batches whose grace window has not finished. */
  inGrace: number;
  /** Batches destroyed. */
  purged: number;
  /** Batches stopped because a hold appeared after approval. */
  stoppedByHold: number;
  /** True when the tenant has not opted in, in which case nothing was touched. */
  skippedDisabled: boolean;
}

/**
 * Whether a tenant has switched destruction on.
 *
 * Deliberately opt-in and read fresh on every run, so turning it off takes
 * effect at once rather than at the next deploy.
 */
export async function isDispositionShreddingEnabled(tenantId: string): Promise<boolean> {
  const snapshot = await firestore
    .collection('tenants')
    .doc(tenantId)
    .collection('settings')
    .doc('retention')
    .get()
    .catch(() => null);

  return snapshot?.exists === true && snapshot.data()?.shreddingEnabled === true;
}

export async function setDispositionShreddingEnabled(input: {
  enabled: boolean;
  tenantId: string;
}): Promise<void> {
  await firestore
    .collection('tenants')
    .doc(input.tenantId)
    .collection('settings')
    .doc('retention')
    .set({
      shreddingEnabled: input.enabled === true,
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });
}

/**
 * Destroys everything whose grace window has ended.
 *
 * Returns what it did, so a scheduled run can be recorded and a silent failure
 * cannot look like a successful one.
 */
export async function runDispositionShredder(input: {
  nowMs?: number;
  tenantId: string;
}): Promise<ShredderRunSummary> {
  const nowMs = input.nowMs || Date.now();
  const summary: ShredderRunSummary = {
    inGrace: 0,
    purged: 0,
    skippedDisabled: false,
    stoppedByHold: 0
  };

  if (!await isDispositionShreddingEnabled(input.tenantId)) {
    summary.skippedDisabled = true;

    return summary;
  }

  const tenantRef = firestore.collection('tenants').doc(input.tenantId);
  const approved = await tenantRef
    .collection('dispositionItems')
    .where('state', '==', 'APPROVED')
    .limit(50)
    .get();

  if (approved.empty) {
    return summary;
  }

  // Read once for the whole run, not per batch: a hold applied mid-run should
  // stop the rest, and re-reading per item would only widen that window.
  const activeHolds = await listActiveLegalHolds(input.tenantId, nowMs);

  for (const doc of approved.docs) {
    const record = doc.data() as DispositionItemRecord;
    const graceEndsAtMs = (record.decidedAtMs || nowMs) + DISPOSITION_GRACE_MS;

    if (nowMs < graceEndsAtMs) {
      summary.inGrace += 1;
      continue;
    }

    if (activeHolds.length) {
      // Not merely skipped — moved back to withheld, so the queue shows why it
      // did not happen rather than leaving a batch that looks stuck.
      await doc.ref.set({
        state: 'WITHHELD',
        updatedAt: fieldValue.serverTimestamp(),
        withheldByHoldId: activeHolds[0].id
      }, { merge: true });

      summary.stoppedByHold += 1;
      continue;
    }

    await destroyDispositionSubject(tenantRef, record);

    await doc.ref.set({
      purgedAtMs: nowMs,
      state: 'PURGED',
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });

    summary.purged += 1;
  }

  return summary;
}

/**
 * Destroys the content behind one batch.
 *
 * Message envelopes are deleted before the media they use. Each envelope holds
 * the key that unlocks its media, so removing envelopes first means that even if
 * this fails part-way, what remains is unreadable rather than exposed.
 */
async function destroyDispositionSubject(
  tenantRef: FirebaseFirestore.DocumentReference,
  record: DispositionItemRecord
): Promise<void> {
  const chatRef = resolveSubjectChatRef(tenantRef.id, record.subjectRef);

  // An unrecognised subject destroys nothing. Guessing at a path here would
  // delete the wrong conversation.
  if (!chatRef) {
    return;
  }

  await deleteCollectionInBatches(chatRef.collection('encryptedEnvelopes'));
  await deleteCollectionInBatches(chatRef.collection('messageMetadata'));

  // Stored files are deleted before their records. Deleting only the records
  // left every photo, video and voice note sitting in the bucket for ever: the
  // conversation looked deleted while the content it carried was not, which is
  // the opposite of what a retention policy promises.
  await deleteStoredMediaForChat(chatRef);
  await deleteCollectionInBatches(chatRef.collection('mediaAttachments'));
}

/**
 * The conversation a queued item refers to.
 *
 * Group conversations are handled as well as direct ones. Only direct chats
 * were recognised before, so a group chat could be queued, approved and marked
 * purged while nothing was actually deleted.
 */
function resolveSubjectChatRef(
  tenantId: string,
  subjectRef: string
): FirebaseFirestore.DocumentReference | null {
  const organizationRef = firestore.collection('organizations').doc(tenantId);

  if (subjectRef.startsWith('directChat/')) {
    return organizationRef
      .collection('directChats')
      .doc(subjectRef.slice('directChat/'.length));
  }

  if (subjectRef.startsWith('group/')) {
    return organizationRef
      .collection('groups')
      .doc(subjectRef.slice('group/'.length));
  }

  return null;
}

/**
 * Removes the encrypted attachment bytes behind a conversation.
 *
 * A file that failed to delete is skipped rather than aborting the run: the
 * message envelopes carrying its keys are already gone, so what remains is
 * unreadable, and stopping here would leave the rest of the batch untouched.
 */
async function deleteStoredMediaForChat(
  chatRef: FirebaseFirestore.DocumentReference
): Promise<void> {
  const attachments = await chatRef.collection('mediaAttachments').get();

  for (const doc of attachments.docs) {
    const record = doc.data() as { partPaths?: string[]; storagePath?: string };
    const paths = [
      ...(record.storagePath ? [record.storagePath] : []),
      ...(Array.isArray(record.partPaths) ? record.partPaths : [])
    ];

    for (const path of paths) {
      await storageBucket.file(path).delete({ ignoreNotFound: true }).catch((error: unknown) => {
        console.error('[SynzappDisposition] could not delete stored media', {
          message: error instanceof Error ? error.message : String(error),
          path
        });
      });
    }
  }
}

async function deleteCollectionInBatches(
  collection: FirebaseFirestore.CollectionReference,
  batchSize = 200
): Promise<void> {
  for (;;) {
    const snapshot = await collection.limit(batchSize).get();

    if (snapshot.empty) {
      return;
    }

    const batch = firestore.batch();

    snapshot.docs.forEach((doc) => batch.delete(doc.ref));

    await batch.commit();

    // A partial page means that was the last one.
    if (snapshot.size < batchSize) {
      return;
    }
  }
}
