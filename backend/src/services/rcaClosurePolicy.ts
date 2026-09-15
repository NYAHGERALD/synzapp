/**
 * What must be true before a root cause analysis can be closed.
 *
 * Closure was enforced by the browser alone. `PATCH /api/rca/incidents/:id` with
 * `{"status":"CLOSED"}` closed an investigation with nothing filled in — the
 * whole twenty-field Approval and Closure review lived in `RcaWorkspace.tsx` and
 * the service did no more than coerce the string.
 *
 * And a fabricated closure is permanent: the post-closure freeze in
 * `rcaService` is real, so a record closed this way cannot be corrected through
 * any ordinary route. In food manufacturing that record is regulatory evidence.
 *
 * **These requirements are not invented here.** They are the list the product
 * already states, mirrored from `RCA_APPROVAL_CLOSURE_REQUIRED_FIELDS` in the
 * web workspace, so the server enforces exactly what the interface has always
 * claimed. A test asserts the two lists still match, because the danger with a
 * mirrored list is that it quietly stops being one.
 *
 * Pure, so the rule can be tested without a database.
 */

export interface ClosureRequirement {
  key: string;
  label: string;
  /** When present, the value must be one of these, not merely non-empty. */
  validValues?: string[];
}

export const RCA_APPROVAL_CLOSURE_REQUIRED_FIELDS: ClosureRequirement[] = [
  { key: 'caseClosureScope', label: 'closure scope', validValues: ['Entire RCA Case', 'Case With Open Follow-Up'] },
  { key: 'closureReadiness', label: 'closure readiness', validValues: ['Approved to Close'] },
  { key: 'investigationSummary', label: 'final investigation summary' },
  { key: 'rootCauseVerificationStatus', label: 'root cause verification status', validValues: ['All Verified', 'Not Applicable'] },
  { key: 'capaWorkflowStatus', label: 'CAPA workflow status', validValues: ['All CAPA Work Complete', 'CAPA Not Required'] },
  { key: 'correctiveActionsComplete', label: 'corrective action completion', validValues: ['Yes', 'Not Applicable'] },
  { key: 'preventiveActionsComplete', label: 'preventive action completion', validValues: ['Yes', 'Not Applicable'] },
  { key: 'riskAssessmentComplete', label: 'risk assessment completion', validValues: ['Yes', 'Not Applicable'] },
  { key: 'effectivenessVerified', label: 'effectiveness verification', validValues: ['Yes', 'Not Applicable'] },
  { key: 'lessonsLearnedCompleted', label: 'lessons learned completion', validValues: ['Yes', 'Not Applicable'] },
  { key: 'evidenceReviewStatus', label: 'evidence review status', validValues: ['Complete', 'Not Applicable'] },
  { key: 'residualRiskDecision', label: 'residual risk decision', validValues: ['Accepted', 'Accepted With Controls'] },
  { key: 'finalRiskLevel', label: 'final risk level' },
  { key: 'regulatoryOrCustomerNotification', label: 'regulatory or customer notification status', validValues: ['Not Required', 'Required and Completed'] },
  { key: 'reopenTrigger', label: 'reopen trigger' },
  { key: 'closureRecommendation', label: 'closure recommendation', validValues: ['Close RCA', 'Close With Follow-Up'] },
  { key: 'finalApprover', label: 'final approver' },
  { key: 'approverRole', label: 'approver role' },
  { key: 'closureDate', label: 'closure date' },
  { key: 'closureComments', label: 'closure comments' }
];

/**
 * The requirements this record does not meet, by the name a person would use.
 *
 * Labels rather than keys, and all of them rather than the first: somebody told
 * one missing field at a time fills the form in twenty round trips.
 */
export function getMissingClosureFields(
  fields: Record<string, string> | undefined | null
): string[] {
  const values = fields || {};

  return RCA_APPROVAL_CLOSURE_REQUIRED_FIELDS
    .filter((requirement) => {
      const value = (values[requirement.key] || '').trim();

      if (!value) {
        return true;
      }

      return requirement.validValues ? !requirement.validValues.includes(value) : false;
    })
    .map((requirement) => requirement.label);
}

export function isReadyToClose(fields: Record<string, string> | undefined | null): boolean {
  return getMissingClosureFields(fields).length === 0;
}

/**
 * What to tell somebody whose closure was refused.
 *
 * Names the review that is incomplete and what is missing from it. A refusal
 * that says only "not allowed" sends them to support; this one sends them to the
 * form.
 */
export function describeClosureRefusal(missing: string[]): string {
  if (!missing.length) {
    return 'This RCA cannot be closed yet.';
  }

  return `Complete the Approval and Closure review before closing this RCA. Still missing: ${missing.join(', ')}.`;
}
