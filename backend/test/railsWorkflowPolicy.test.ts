import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkRailsWorkflowPolicy } from '../src/services/railsService.js';

const baseLoop = {
  actions: [
    {
      actionId: 'act_001',
      containmentNote: 'Stopped the affected oven area and isolated the line until inspection was complete.',
      dueDate: '2026-07-21',
      evidenceIds: ['ev_problem'],
      ownerUid: 'owner-1',
      progressPercent: 0,
      riskControlled: 'Open flame and dust exposure were controlled before restart.',
      status: 'Open' as const,
      title: 'Contain the immediate risk',
      verificationNote: 'Supervisor and maintenance verified the area after cleanout and inspection.'
    },
    {
      actionId: 'act_002',
      dueDate: '2026-07-21',
      evidenceIds: ['ev_verification'],
      implementationNote: 'Installed the corrective guard and updated the inspection point.',
      ownerUid: 'owner-1',
      progressPercent: 0,
      riskControlled: 'Corrected the failure mode identified by RCA.',
      status: 'Open' as const,
      title: 'Complete corrective action',
      verificationNote: 'Owner confirmed the corrective action was implemented.'
    },
    {
      actionId: 'act_003',
      dueDate: '2026-07-21',
      effectivenessCriteria: 'No repeat finding during the next supervisor verification.',
      effectivenessResult: 'Supervisor verification passed with no repeat issue.',
      evidenceIds: ['ev_standardization'],
      ownerUid: 'owner-1',
      progressPercent: 0,
      standardizationNote: 'Checklist and supervisor verification method were standardized.',
      status: 'Open' as const,
      title: 'Verify effectiveness and standardize',
      verificationNote: 'Approver confirmed effectiveness and standardization.'
    }
  ],
  approverUid: 'approver-1',
  category: 'Process' as const,
  dueDate: '2026-07-21',
  evidence: [
    {
      evidenceId: 'ev_problem',
      fileName: 'problem.png',
      fileUrl: '/api/rails/items/item-1/evidence/ev_problem',
      label: 'Problem photo or file',
      status: 'Attached' as const
    },
    {
      evidenceId: 'ev_verification',
      fileName: 'verification.png',
      fileUrl: '/api/rails/items/item-1/evidence/ev_verification',
      label: 'Verification result',
      status: 'Attached' as const
    },
    {
      evidenceId: 'ev_standardization',
      fileName: 'sop.pdf',
      fileUrl: '/api/rails/items/item-1/evidence/ev_standardization',
      label: 'Standardization document',
      purpose: 'standardization' as const,
      status: 'Attached' as const
    }
  ],
  linkedRca: 'RCA not required',
  ownerUid: 'owner-1',
  priority: 'Medium' as const,
  standardization: 'Update the oven pre-op checklist.',
  standardizationDueDate: '2026-07-28',
  standardizationOwnerUid: 'std-owner-1',
  standardizationStatus: 'Verified' as const,
  standardizationType: 'Checklist' as const,
  standardizationVerification: 'Supervisor observes the revised checklist in use.',
  status: 'New' as const,
  title: 'Fire under the oven',
  verification: 'Supervisor review before closure'
};

describe('RAILS workflow policy behavior', () => {
  it('blocks triage until owner, due date, RCA decision, and problem evidence exist', () => {
    const result = checkRailsWorkflowPolicy({
      current: {
        ...baseLoop,
        dueDate: '',
        evidence: [],
        linkedRca: 'Pending triage',
        ownerUid: '',
        status: 'New'
      },
      targetStatus: 'Triaged'
    });

    assert.equal(result.allowed, false);
    assert.match(result.message || '', /Assign an accountable owner/);
    assert.match(result.message || '', /Set the loop due date/);
    assert.match(result.message || '', /Make an RCA decision/);
    assert.match(result.message || '', /Define required evidence placeholders/);
  });

  it('allows closure only after approval, actions, verification evidence, and standardization proof are complete', () => {
    const result = checkRailsWorkflowPolicy({
      current: {
        ...baseLoop,
        actions: baseLoop.actions.map((action) => ({
          ...action,
          completedAtIso: '2026-07-20T12:00:00.000Z',
          progressPercent: 100,
          status: 'Done' as const
        })),
        status: 'Approved'
      },
      targetStatus: 'Closed'
    });

    assert.equal(result.allowed, true);
    assert.deepEqual(result.blockers, []);
  });

  it('blocks closure when standardization is not verified', () => {
    const result = checkRailsWorkflowPolicy({
      current: {
        ...baseLoop,
        actions: baseLoop.actions.map((action) => ({
          ...action,
          completedAtIso: '2026-07-20T12:00:00.000Z',
          progressPercent: 100,
          status: 'Done' as const
        })),
        standardizationStatus: 'Implemented',
        status: 'Approved'
      },
      targetStatus: 'Closed'
    });

    assert.equal(result.allowed, false);
    assert.match(result.message || '', /Verify the standardization plan before closure/);
  });

  it('blocks verification when containment documentation is missing', () => {
    const result = checkRailsWorkflowPolicy({
      current: {
        ...baseLoop,
        actions: baseLoop.actions.map((action) => action.actionId === 'act_001'
          ? {
              ...action,
              containmentNote: '',
              evidenceIds: [],
              progressPercent: 100,
              status: 'Done' as const,
              verificationNote: ''
            }
          : {
              ...action,
              progressPercent: 100,
              status: 'Done' as const
            }),
        status: 'In Progress'
      },
      targetStatus: 'Verification'
    });

    assert.equal(result.allowed, false);
    assert.match(result.message || '', /Complete governed action documentation/);
    assert.match(result.message || '', /document the containment action taken/);
    assert.match(result.message || '', /link attached evidence/);
  });

  it('blocks verification when corrective action documentation is missing', () => {
    const result = checkRailsWorkflowPolicy({
      current: {
        ...baseLoop,
        actions: baseLoop.actions.map((action) => action.actionId === 'act_002'
          ? {
              ...action,
              implementationNote: '',
              evidenceIds: [],
              progressPercent: 100,
              status: 'Done' as const,
              verificationNote: ''
            }
          : {
              ...action,
              progressPercent: 100,
              status: 'Done' as const
            }),
        status: 'In Progress'
      },
      targetStatus: 'Verification'
    });

    assert.equal(result.allowed, false);
    assert.match(result.message || '', /Complete governed action documentation/);
    assert.match(result.message || '', /document the corrective action implemented/);
    assert.match(result.message || '', /link implementation evidence/);
  });

  it('blocks verification when effectiveness and standardization documentation is missing', () => {
    const result = checkRailsWorkflowPolicy({
      current: {
        ...baseLoop,
        actions: baseLoop.actions.map((action) => action.actionId === 'act_003'
          ? {
              ...action,
              effectivenessCriteria: '',
              effectivenessResult: '',
              evidenceIds: [],
              progressPercent: 100,
              standardizationNote: '',
              status: 'Done' as const,
              verificationNote: ''
            }
          : {
              ...action,
              progressPercent: 100,
              status: 'Done' as const
            }),
        status: 'In Progress'
      },
      targetStatus: 'Verification'
    });

    assert.equal(result.allowed, false);
    assert.match(result.message || '', /Complete governed action documentation/);
    assert.match(result.message || '', /document the effectiveness acceptance criteria/);
    assert.match(result.message || '', /link effectiveness or standardization evidence/);
  });

  it('requires a reason to reopen a closed loop', () => {
    const blocked = checkRailsWorkflowPolicy({
      current: {
        ...baseLoop,
        status: 'Closed'
      },
      targetStatus: 'Reopened'
    });
    const allowed = checkRailsWorkflowPolicy({
      current: {
        ...baseLoop,
        status: 'Closed'
      },
      next: {
        reopenReason: 'Issue repeated during the next pre-op check.'
      },
      targetStatus: 'Reopened'
    });

    assert.equal(blocked.allowed, false);
    assert.match(blocked.message || '', /Enter a reopen reason/);
    assert.equal(allowed.allowed, true);
  });

  it('prevents returning an in-progress loop to triaged until action progress is reset', () => {
    const result = checkRailsWorkflowPolicy({
      current: {
        ...baseLoop,
        actions: baseLoop.actions.map((action) => ({
          ...action,
          progressPercent: 20,
          status: 'In Progress' as const
        })),
        status: 'In Progress'
      },
      targetStatus: 'Triaged'
    });

    assert.equal(result.allowed, false);
    assert.match(result.message || '', /Reset action progress to 0%/);
  });

  it('blocks action-start automation from skipping New directly to In Progress', () => {
    const result = checkRailsWorkflowPolicy({
      current: {
        ...baseLoop,
        actions: baseLoop.actions.map((action) => ({
          ...action,
          progressPercent: 0,
          status: 'Open' as const
        })),
        status: 'New'
      },
      next: {
        actions: baseLoop.actions.map((action) => ({
          ...action,
          progressPercent: 10,
          status: 'In Progress' as const
        })),
        status: 'In Progress'
      },
      targetStatus: 'In Progress'
    });

    assert.equal(result.allowed, false);
    assert.match(result.message || '', /move from New to Triaged before selecting In Progress/);
  });
});
