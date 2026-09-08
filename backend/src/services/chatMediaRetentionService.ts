import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import { deriveBlobRetention, isBlobPurgeable, type BlobReference } from './retentionEvaluation.js';

/**
 * Keeps chat media alive for as long as a message still points at it.
 *
 * Synzapp gave every direct-chat blob a flat 30-day TTL and refused the download
 * once it passed, while the message referencing it stayed in the conversation
 * forever. After thirty days a thread became a wall of empty frames, and a
 * backup restored from it returned the same. That is the hollow restore
 * SYNZAPP_TENANT_RETENTION_AND_LEGAL_HOLD_PLAN.md exists to eliminate, and this
 * is its decision 1: media retention is derived from the messages that
 * reference it, never configured as a timer.
 *
 * **On what the server learns.** Maintaining a reference count requires the
 * server to know which envelopes reference which blobs, and that association
 * cannot be read out of an end-to-end encrypted payload. Envelopes therefore
 * carry their media ids as plaintext metadata.
 *
 * This is a deliberate, bounded disclosure. The server already stores the blob,
 * its size, its content type, its uploader and the conversation it belongs to;
 * it already stores the envelope and its participants. Learning that this
 * envelope references that blob — two things it already holds — tells it
 * nothing about the content of either. The ciphertext, the media key and the
 * bytes remain unreadable. The alternative is no server-side retention at all,
 * which means no legal hold, no defensible disposal and no complete export.
 */

/** Retention state stored on a media blob. */
export interface ChatMediaRetentionRecord {
  derivedRetainUntilMs?: number | null;
  liveRefCount?: number | null;
  /** Null means the blob must be kept indefinitely. */
  purgeAfterMs?: number | null;
}

export interface RegisterMediaReferencesInput {
  chatRef: FirebaseFirestore.DocumentReference;
  envelopeId: string;
  mediaIds: string[];
  /** The referencing message's obligations, from the retention evaluator. */
  purgeAfterMs: number | null;
  retainUntilMs: number;
}

/**
 * Records that an envelope references these blobs, and extends their lifetime.
 *
 * Runs in a transaction per blob because the reference count is the invariant
 * that stops bytes being destroyed under a live message. A lost increment here
 * is a photo that vanishes from a conversation that still shows it.
 */
export async function registerChatMediaReferences(
  input: RegisterMediaReferencesInput
): Promise<void> {
  const mediaIds = [...new Set(input.mediaIds.filter(Boolean))].slice(0, 20);

  if (!mediaIds.length) {
    return;
  }

  await Promise.all(mediaIds.map(async (mediaId) => {
    const mediaRef = input.chatRef.collection('mediaAttachments').doc(mediaId);
    const referenceRef = mediaRef.collection('references').doc(input.envelopeId);

    await firestore.runTransaction(async (transaction) => {
      const [mediaSnapshot, referenceSnapshot] = await Promise.all([
        transaction.get(mediaRef),
        transaction.get(referenceRef)
      ]);

      if (!mediaSnapshot.exists) {
        return;
      }

      // A resend of the same envelope must not count twice. Delivery is retried,
      // and an inflated count would keep bytes alive that nothing references.
      if (referenceSnapshot.exists) {
        return;
      }

      const record = mediaSnapshot.data() as ChatMediaRetentionRecord;
      const currentRetainUntilMs = typeof record.derivedRetainUntilMs === 'number'
        ? record.derivedRetainUntilMs
        : 0;
      const currentPurgeAfterMs = record.purgeAfterMs === null
        ? null
        : typeof record.purgeAfterMs === 'number' ? record.purgeAfterMs : 0;

      transaction.set(referenceRef, {
        createdAt: fieldValue.serverTimestamp(),
        envelopeId: input.envelopeId,
        purgeAfterMs: input.purgeAfterMs,
        retainUntilMs: input.retainUntilMs
      });

      transaction.set(mediaRef, {
        derivedRetainUntilMs: Math.max(currentRetainUntilMs, input.retainUntilMs),
        liveRefCount: fieldValue.increment(1),
        // Once any reference is indefinite the blob is indefinite; it can never
        // return to having a purge date while that reference is live.
        purgeAfterMs: input.purgeAfterMs === null || currentPurgeAfterMs === null
          ? null
          : Math.max(currentPurgeAfterMs, input.purgeAfterMs),
        updatedAt: fieldValue.serverTimestamp()
      }, { merge: true });
    });
  }));
}

/**
 * Drops an envelope's references when it leaves the live plane.
 *
 * Deleting a message does not destroy media — it releases a claim on it. The
 * bytes go only when nothing references them and their derived retention has
 * expired, which is checked separately by the disposer.
 */
export async function releaseChatMediaReferences(input: {
  chatRef: FirebaseFirestore.DocumentReference;
  envelopeId: string;
  mediaIds: string[];
}): Promise<void> {
  const mediaIds = [...new Set(input.mediaIds.filter(Boolean))].slice(0, 20);

  await Promise.all(mediaIds.map(async (mediaId) => {
    const mediaRef = input.chatRef.collection('mediaAttachments').doc(mediaId);
    const referenceRef = mediaRef.collection('references').doc(input.envelopeId);

    await firestore.runTransaction(async (transaction) => {
      const referenceSnapshot = await transaction.get(referenceRef);

      // Releasing a reference that was never counted would drive the count
      // negative and make a still-referenced blob look purgeable.
      if (!referenceSnapshot.exists) {
        return;
      }

      transaction.delete(referenceRef);
      transaction.set(mediaRef, {
        liveRefCount: fieldValue.increment(-1),
        updatedAt: fieldValue.serverTimestamp()
      }, { merge: true });
    });
  }));
}

/**
 * Whether a blob may still be served.
 *
 * A blob with any live reference is always served, whatever its original TTL
 * said. That single rule is what ends the hollow restore: a message that exists
 * can always show its media.
 */
export function isChatMediaRetrievable(
  record: ChatMediaRetentionRecord & { expiresAtMs?: number | null },
  nowMs: number
): boolean {
  if ((record.liveRefCount || 0) > 0) {
    return true;
  }

  // Blobs uploaded before retention existed have no reference rows, so they
  // fall back to the legacy TTL rather than disappearing on deploy.
  if (typeof record.derivedRetainUntilMs === 'number' && record.derivedRetainUntilMs > nowMs) {
    return true;
  }

  const expiresAtMs = typeof record.expiresAtMs === 'number' ? record.expiresAtMs : null;

  return expiresAtMs === null || expiresAtMs > nowMs;
}

/** Whether the disposer may destroy a blob's bytes. */
export function isChatMediaPurgeable(
  record: ChatMediaRetentionRecord,
  nowMs: number
): boolean {
  return isBlobPurgeable({
    derivedRetainUntilMs: typeof record.derivedRetainUntilMs === 'number'
      ? record.derivedRetainUntilMs
      : 0,
    liveRefCount: record.liveRefCount || 0,
    purgeAfterMs: record.purgeAfterMs === undefined ? 0 : record.purgeAfterMs
  }, nowMs);
}

/** Recomputes a blob's retention from its reference rows. */
export function computeChatMediaRetention(references: BlobReference[]) {
  return deriveBlobRetention(references);
}
