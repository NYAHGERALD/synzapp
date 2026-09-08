/**
 * Deciding which cached rows actually need rewriting.
 *
 * Saving a conversation used to re-encrypt and re-insert every message it held —
 * up to a thousand — because the whole thread is passed to the save on every
 * change. Receiving one message therefore rewrote the entire thread: a pure-JS
 * secretbox plus several native calls per message, all on the JS thread. On a
 * low-end Android phone that is seconds of freeze on every incoming message, on
 * every chat open, and while typing.
 *
 * A signature is stored beside each row so the next save can tell, without
 * decrypting anything, which messages are unchanged and can be skipped.
 */

/**
 * A short, stable fingerprint of a value's serialised form.
 *
 * Length is included alongside the hash because it is free and makes an
 * accidental collision require two messages that serialise to the same length
 * *and* the same 32-bit hash. This decides whether to skip a write, so the cost
 * of a collision would be a stale cached row rather than anything unsafe — but
 * it is cheap to make that effectively impossible.
 */
export function buildLocalChatRowSignature(value: unknown): string {
  const serialized = JSON.stringify(value) ?? '';
  // FNV-1a. Chosen for being a few instructions per character: this runs over
  // every message in a thread, so a slow hash would recreate the problem it
  // exists to solve.
  let hash = 0x811c9dc5;

  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return `${serialized.length.toString(36)}.${hash.toString(36)}`;
}

export interface LocalChatRowWritePlan<T> {
  changed: T[];
  signatures: Map<string, string>;
  unchangedCount: number;
}

/**
 * Splits rows into those that need writing and those already stored as-is.
 *
 * `stored` maps a row's id to the signature last written for it. Anything absent
 * from it is treated as changed, so an empty map writes everything — which is
 * what should happen the first time a conversation is saved.
 */
export function planLocalChatRowWrites<T>(
  rows: T[],
  getRowId: (row: T) => string,
  stored: Map<string, string>
): LocalChatRowWritePlan<T> {
  const signatures = new Map<string, string>();
  const changed: T[] = [];
  let unchangedCount = 0;

  rows.forEach((row) => {
    const rowId = getRowId(row);

    if (!rowId) {
      return;
    }

    const signature = buildLocalChatRowSignature(row);

    signatures.set(rowId, signature);

    if (stored.get(rowId) === signature) {
      unchangedCount += 1;
      return;
    }

    changed.push(row);
  });

  return { changed, signatures, unchangedCount };
}
