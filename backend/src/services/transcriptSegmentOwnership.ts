/**
 * Who may write over a stored transcript segment.
 *
 * The document id is built from a `versionId` the caller sends —
 * `itr_${versionId}` — and written with `merge: true`. Nothing checked who owned
 * the document already, so any invited participant could address another
 * participant's segment and replace its text. Because the write merges, it also
 * overwrote `createdByUid`: the record changed hands silently, and afterwards
 * nothing said it had ever belonged to anybody else.
 *
 * The mobile app pins a well-known literal, `saved-transcripts`, as one of its
 * version ids, so the id does not even have to be guessed.
 *
 * The translation path a few lines further down generates its id on the server
 * and has none of this. The pattern was understood; it just was not applied
 * here.
 *
 * Pure, so the rule can be tested without a meeting.
 */

export interface TranscriptSegmentWriteInput {
  callerUid: string;
  /** Null when no segment exists at this id yet. */
  existingOwnerUid?: string | null;
}

export interface TranscriptSegmentWriteDecision {
  allowed: boolean;
  reason: string | null;
}

export function canWriteTranscriptSegment(
  input: TranscriptSegmentWriteInput
): TranscriptSegmentWriteDecision {
  const existingOwnerUid = (input.existingOwnerUid || '').trim();

  // Nothing there yet: the first writer owns it.
  if (!existingOwnerUid) {
    return { allowed: true, reason: null };
  }

  if (!input.callerUid || existingOwnerUid !== input.callerUid) {
    return {
      allowed: false,
      reason: 'That transcript segment belongs to another participant.'
    };
  }

  return { allowed: true, reason: null };
}
