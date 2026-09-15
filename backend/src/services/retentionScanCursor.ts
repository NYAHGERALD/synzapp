/**
 * Where the next retention pass should start reading.
 *
 * The scan took the first five hundred conversations with no ordering and no
 * cursor. Firestore's default order is by document name, so every nightly run
 * read the identical five hundred documents — and any tenant with more than that
 * had a permanent tail that was never examined, never queued and never deleted,
 * however clear its retention policy was. Nobody would see it: the run reported
 * five hundred examined every night and looked healthy.
 *
 * So the pass remembers where it stopped and resumes from there, wrapping to the
 * beginning once it reaches the end. A big tenant is covered over several nights
 * rather than never.
 *
 * Pure, so the wrap-around can be tested without a database.
 */

/** Kept per collection: direct chats and groups are scanned independently. */
export interface RetentionScanCursor {
  directChats?: string | null;
  groups?: string | null;
}

/**
 * The cursor to store after a page.
 *
 * A full page means there is probably more, so the next run continues after the
 * last document seen. A short page means the end was reached, so the next run
 * starts from the beginning again — which is what makes the scan a loop rather
 * than a line that stops.
 */
export function nextScanCursor(input: {
  lastDocumentName?: string | null;
  pageSize: number;
  returned: number;
}): string | null {
  if (input.returned < input.pageSize) {
    return null;
  }

  return input.lastDocumentName || null;
}

/** Reads a stored cursor, ignoring anything that is not a usable document name. */
export function readScanCursor(
  stored: unknown,
  collection: keyof RetentionScanCursor
): string | null {
  if (!stored || typeof stored !== 'object') {
    return null;
  }

  const value = (stored as Record<string, unknown>)[collection];

  return typeof value === 'string' && value.trim() ? value : null;
}

/**
 * Whether a pass covered everything there is.
 *
 * Worth recording rather than inferring: "we reached the end of this tenant" is
 * the only honest way to say the policy has actually been applied to all of it,
 * and it is the question an auditor asks.
 */
export function didCompleteFullScan(cursor: RetentionScanCursor): boolean {
  return !cursor.directChats && !cursor.groups;
}
