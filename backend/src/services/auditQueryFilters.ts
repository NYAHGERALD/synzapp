/**
 * Turning what somebody typed into a query the audit log can answer.
 *
 * Kept apart from the Firestore call so the awkward parts can be tested: a
 * reversed date range, a filter naming more actions than Firestore's `in` will
 * take, a range so wide it means "everything".
 *
 * The rule throughout is that a filter which cannot be honoured **narrows or
 * refuses**, never widens. An audit search that quietly returns more than was
 * asked for is how somebody concludes an event does not exist because it was
 * buried in ten thousand others.
 */

/** Firestore refuses an `in` filter longer than this. */
export const MAX_AUDIT_ACTION_FILTERS = 30;

export interface AuditQueryFilters {
  /** Which event kinds. Empty means every kind. */
  actions?: string[];
  fromMs?: number | null;
  startAfterId?: string;
  toMs?: number | null;
}

export interface AuditQueryWindow {
  actions: string[];
  fromMs: number | null;
  toMs: number | null;
}

export function buildAuditQueryWindow(filters: AuditQueryFilters): AuditQueryWindow {
  const actions = normalizeActions(filters.actions);
  const { fromMs, toMs } = normalizeRange(filters.fromMs ?? null, filters.toMs ?? null);

  return { actions, fromMs, toMs };
}

/**
 * The event kinds asked for, deduplicated and capped.
 *
 * Anything past the cap is dropped rather than the whole filter being
 * abandoned, because abandoning it would return every kind — the opposite of
 * what was asked for, and silently.
 */
function normalizeActions(actions?: string[]): string[] {
  if (!Array.isArray(actions)) {
    return [];
  }

  const cleaned = actions
    .map((action) => (typeof action === 'string' ? action.trim() : ''))
    .filter(Boolean);

  return [...new Set(cleaned)].slice(0, MAX_AUDIT_ACTION_FILTERS);
}

/**
 * The window, with the ends the right way round.
 *
 * A reversed range is swapped rather than returned empty. Somebody who picks
 * the dates in the wrong order has still said which fortnight they mean, and
 * showing them nothing looks like the events are missing.
 */
function normalizeRange(fromMs: number | null, toMs: number | null): {
  fromMs: number | null;
  toMs: number | null;
} {
  const from = Number.isFinite(fromMs) ? fromMs : null;
  const to = Number.isFinite(toMs) ? toMs : null;

  if (from !== null && to !== null && from > to) {
    return { fromMs: to, toMs: from };
  }

  return { fromMs: from, toMs: to };
}
