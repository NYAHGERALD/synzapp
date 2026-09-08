/**
 * The reasons offered when an action moves to somebody else.
 *
 * Mirrors the list the server validates against. Kept here rather than fetched
 * because a picker that has to wait for the network before it can offer its
 * first option is a picker people abandon — and because these five change about
 * as often as the product's name.
 *
 * If the two ever drift, the server refuses and says so; the check that matters
 * is the one on the server.
 */

export type ActionReassignmentReasonId =
  | 'NEEDS_OTHER_SKILLS'
  | 'OTHER'
  | 'UNAVAILABLE'
  | 'WORKLOAD'
  | 'WRONG_PERSON';

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

export const MIN_OTHER_REASON_DETAIL_LENGTH = 8;

/**
 * Whether the form can be submitted yet.
 *
 * The button is disabled rather than the request refused, so nobody types an
 * explanation, taps send, and is told only then that it was too short.
 */
export function canSubmitReassignment(input: {
  detail: string;
  nextPersonUid: string | null;
  reasonId: ActionReassignmentReasonId | null;
  isChangingPerson: boolean;
}): boolean {
  if (!input.isChangingPerson) {
    return false;
  }

  if (!input.reasonId) {
    return false;
  }

  return input.reasonId !== 'OTHER' ||
    input.detail.trim().length >= MIN_OTHER_REASON_DETAIL_LENGTH;
}
