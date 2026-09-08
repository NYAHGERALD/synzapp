/**
 * Handing an action to somebody else.
 *
 * Requiring a named owner is only reasonable if the owner can be changed, and
 * changed easily. An action that must have a name on it, and cannot be passed
 * on when that person goes off shift, is worse than one owned by a team: the
 * name stays, the work stops, and the record says somebody is dealing with it.
 *
 * So reassignment is deliberately easy — and deliberately explained. The reason
 * is required and both people see it, for the same argument that governs
 * stopping a scheduled message: the power itself is fine, exercising it
 * invisibly is not. Somebody who has to say why acts differently from somebody
 * who does not.
 *
 * Nothing here reads or writes anything, so the rules can be argued with in a
 * test rather than in a shift handover.
 */

export type ActionReassignmentReasonId =
  | 'NEEDS_OTHER_SKILLS'
  | 'OTHER'
  | 'UNAVAILABLE'
  | 'WORKLOAD'
  | 'WRONG_PERSON';

/**
 * The reasons offered before the text box.
 *
 * Presets exist because a required free-text field gets "n/a" typed into it.
 * These are the five things that are actually true when work moves, written the
 * way somebody on a shift would say them.
 */
export const ACTION_REASSIGNMENT_REASONS: {
  id: ActionReassignmentReasonId;
  label: string;
}[] = [
  { id: 'UNAVAILABLE', label: 'Not available' },
  { id: 'WRONG_PERSON', label: 'Wrong person' },
  { id: 'NEEDS_OTHER_SKILLS', label: "Needs someone else's skills" },
  { id: 'WORKLOAD', label: 'Balancing workload' },
  { id: 'OTHER', label: 'Other' }
];

/** Free text is always allowed; on "Other" it is the whole reason, so required. */
export const MIN_OTHER_REASON_DETAIL_LENGTH = 8;
export const MAX_REASON_DETAIL_LENGTH = 400;

export interface ActionReassignmentInput {
  actionStatus: string;
  currentPersonUid: string | null;
  nextPersonUid: string | null;
  requesterDepartmentId: string | null;
  /**
   * Taken as a plain string, deliberately.
   *
   * The caller reads it from the stored person record rather than from a claim,
   * and a record written by an older version of the product may hold something
   * this build has never heard of. An unknown role falls through to the refusal
   * at the bottom, which is the safe answer; narrowing the type here would only
   * move that decision to a cast somewhere less careful.
   */
  requesterRole: string;
  requesterUid: string;
  responsibleDepartmentId: string | null;
  sourceDepartmentId: string | null;
}

/**
 * Who may hand an action to somebody else.
 *
 * Three people, and the third is the one that matters. An organization admin
 * and the department admin who owns the work are obvious. **The person it is
 * currently assigned to may also pass it on** — somebody going off shift should
 * not have to find an administrator to hand over, and making them wait is how
 * an action ends up owned by a name that has gone home.
 *
 * Finished work is not reassigned. A verified action has been checked by a
 * second person and a cancelled one is closed; moving either would be editing
 * the record rather than the work.
 */
export function canReassignAction(
  input: ActionReassignmentInput
): { allowed: boolean; reason: string | null } {
  if (input.actionStatus === 'VERIFIED') {
    return {
      allowed: false,
      reason: 'This action has been verified. Raise a new action instead.'
    };
  }

  if (input.actionStatus === 'CANCELLED') {
    return { allowed: false, reason: 'This action was cancelled.' };
  }

  if (
    input.nextPersonUid &&
    input.currentPersonUid &&
    input.nextPersonUid === input.currentPersonUid
  ) {
    return { allowed: false, reason: 'That is already who this is assigned to.' };
  }

  if (!input.nextPersonUid && !input.currentPersonUid) {
    return { allowed: false, reason: 'This action is already open to the whole team.' };
  }

  if (input.requesterRole === 'ORG_ADMIN') {
    return { allowed: true, reason: null };
  }

  if (input.requesterRole === 'DEPT_ADMIN' && ownsTheWork(input)) {
    return { allowed: true, reason: null };
  }

  // Handing on your own work. Not an administrative act, and waiting for one is
  // how a shift ends with the action still pointing at whoever has left.
  if (input.currentPersonUid && input.currentPersonUid === input.requesterUid) {
    return { allowed: true, reason: null };
  }

  return {
    allowed: false,
    reason: 'Only a department administrator or the person it is assigned to can move this.'
  };
}

/**
 * Whether the reason given is one somebody can act on.
 *
 * A preset alone is enough for four of the five. "Other" means the preset said
 * nothing, so the text has to.
 */
export function validateReassignmentReason(input: {
  detail?: string;
  reasonId?: string;
}): { ok: boolean; reason: string | null } {
  const preset = ACTION_REASSIGNMENT_REASONS.find((option) => option.id === input.reasonId);

  if (!preset) {
    return { ok: false, reason: 'Choose a reason for moving this action.' };
  }

  const detail = (input.detail || '').trim();

  if (detail.length > MAX_REASON_DETAIL_LENGTH) {
    return { ok: false, reason: 'That explanation is too long.' };
  }

  if (preset.id === 'OTHER' && detail.length < MIN_OTHER_REASON_DETAIL_LENGTH) {
    return { ok: false, reason: 'Say what the reason is. Both people will see it.' };
  }

  return { ok: true, reason: null };
}

/**
 * The one line stored on the record and shown to both people.
 *
 * Preset and detail are joined rather than kept apart, because everywhere this
 * is read — a notification, an event history, an audit export — wants a
 * sentence, and rebuilding it in each of those places is how three of them come
 * to disagree.
 */
export function describeReassignmentReason(reasonId: string, detail?: string): string {
  const preset = ACTION_REASSIGNMENT_REASONS.find((option) => option.id === reasonId);
  const label = preset ? preset.label : 'Reassigned';
  const trimmed = (detail || '').trim();

  if (!trimmed) {
    return label;
  }

  return preset?.id === 'OTHER' ? trimmed : `${label} — ${trimmed}`;
}

/** A department admin owns both the work their department raised and what it owes. */
function ownsTheWork(input: ActionReassignmentInput): boolean {
  if (!input.requesterDepartmentId) {
    return false;
  }

  return input.requesterDepartmentId === input.sourceDepartmentId ||
    input.requesterDepartmentId === input.responsibleDepartmentId;
}
