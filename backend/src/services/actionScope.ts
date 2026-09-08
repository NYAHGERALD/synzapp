/**
 * Which departments an action belongs to.
 *
 * Kept apart from `actionService` so the rules can be tested without Firestore
 * standing behind them.
 *
 * **Who may cancel an action lives in `authorizationPolicy.ts`**, beside the
 * matching rules for creating, working and verifying one. There is one home for
 * authorization, so a rule cannot be tightened in one file and left loose in
 * another. This module answers only what an action belongs to, not who may act
 * on it.
 *
 * See section 3 of SYNZAPP_ACTIONS_GOVERNANCE_PLAN.md.
 */

export type ActionLifecycleStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'DONE'
  | 'VERIFIED'
  | 'CANCELLED';

/**
 * The departments an action is associated with.
 *
 * Stored on the record as a flat array so one `array-contains` query can find
 * everything a department may see. Firestore cannot apply `OR` across two
 * fields, and running two queries and merging them breaks the ordering, so a
 * page boundary would drop or repeat rows.
 *
 * **Derived, never authored.** It is rebuilt from the two department fields on
 * every write, and a client may never set it: a writable membership field is a
 * way to put an action into somebody else's department.
 */
export function buildActionDepartmentIds(input: {
  responsibleDepartmentId?: string | null;
  sourceDepartmentId?: string | null;
}): string[] {
  const departmentIds = new Set<string>();

  for (const departmentId of [input.sourceDepartmentId, input.responsibleDepartmentId]) {
    const trimmed = typeof departmentId === 'string' ? departmentId.trim() : '';

    if (trimmed) {
      departmentIds.add(trimmed);
    }
  }

  // Sorted so the stored value is stable: an unordered array would look like a
  // change on every write and defeat any comparison of before and after.
  return [...departmentIds].sort();
}

/**
 * Whether a stored `departmentIds` already says exactly what it should.
 *
 * Used by the backfill to skip records that are already right, so a second run
 * costs reads and no writes and a run that dies halfway can be started over.
 *
 * Order matters as well as membership, because the stored value is sorted. A
 * record holding the right departments in the wrong order is rewritten, so that
 * every stored value is comparable with every other.
 */
export function hasCurrentDepartmentIds(stored: unknown, expected: string[]): boolean {
  if (!Array.isArray(stored) || stored.length !== expected.length) {
    return false;
  }

  return expected.every((departmentId, index) => stored[index] === departmentId);
}

/** Nothing more is expected of an action in one of these. */
export const TERMINAL_ACTION_STATUSES: ActionLifecycleStatus[] = [
  'VERIFIED',
  'CANCELLED'
];

/**
 * The departments whose actions this person may read, or `null` for all of them.
 *
 * `null` means an org admin, who sees the whole tenant. An empty array is not
 * the same thing and must never be treated as one: somebody with no department
 * sees only what they raised themselves, so an unassigned account cannot
 * quietly gain a view over an organization's work.
 */
export function resolveReadableDepartmentIds(actor: {
  departmentId: string | null;
  isOrgAdmin: boolean;
}): string[] | null {
  if (actor.isOrgAdmin) {
    return null;
  }

  return actor.departmentId ? [actor.departmentId] : [];
}

/**
 * How a tenant-wide list of actions must be narrowed for this person.
 *
 * Returned as a description rather than applied directly so the shape can be
 * asserted in a test. A scoping bug is not visible by reading a Firestore
 * builder: the query still runs, still returns rows, and quietly returns the
 * wrong ones.
 *
 * - `all` — an org admin, who sees the whole tenant
 * - `departments` — everything their department raised or is answerable for
 * - `own` — somebody with no department, who sees only what they raised
 *
 * There is deliberately no fourth answer. **An unknown or unassigned person
 * must never fall through to `all`**, which is what an empty department filter
 * would silently become.
 */
export type ActionListScope =
  | { kind: 'all' }
  | { departmentIds: string[]; kind: 'departments' }
  | { kind: 'own'; uid: string };

export function resolveActionListScope(actor: {
  departmentId: string | null;
  isOrgAdmin: boolean;
  uid: string;
}): ActionListScope {
  if (actor.isOrgAdmin) {
    return { kind: 'all' };
  }

  const departmentIds = resolveReadableDepartmentIds(actor);

  if (departmentIds && departmentIds.length > 0) {
    return { departmentIds, kind: 'departments' };
  }

  return { kind: 'own', uid: actor.uid };
}
