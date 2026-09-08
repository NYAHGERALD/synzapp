import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ACTION_REASSIGNMENT_REASONS,
  canReassignAction,
  describeReassignmentReason,
  validateReassignmentReason
} from '../src/services/actionReassignment.ts';

/**
 * Moving an action to somebody else.
 *
 * Worth testing carefully because it is the safety valve on a harder rule. An
 * action now has to have a name on it; that is only reasonable while the name
 * can be changed. Every refusal here is a shift that ends with work pointing at
 * somebody who has gone home.
 */

const base = {
  actionStatus: 'OPEN',
  currentPersonUid: 'anna',
  nextPersonUid: 'ben',
  requesterDepartmentId: 'dept_bakery',
  requesterRole: 'EMPLOYEE' as const,
  requesterUid: 'someone-else',
  responsibleDepartmentId: 'dept_bakery',
  sourceDepartmentId: 'dept_bakery'
};

describe('who may move an action', () => {
  it('lets an organization admin', () => {
    assert.equal(canReassignAction({ ...base, requesterRole: 'ORG_ADMIN' }).allowed, true);
  });

  it('lets the department admin who owns the work', () => {
    assert.equal(canReassignAction({ ...base, requesterRole: 'DEPT_ADMIN' }).allowed, true);
  });

  it('lets a department admin whose department raised it, not only the one who owes it', () => {
    assert.equal(canReassignAction({
      ...base,
      requesterDepartmentId: 'dept_safety',
      requesterRole: 'DEPT_ADMIN',
      responsibleDepartmentId: 'dept_bakery',
      sourceDepartmentId: 'dept_safety'
    }).allowed, true);
  });

  it('refuses a department admin from an unrelated department', () => {
    assert.equal(canReassignAction({
      ...base,
      requesterDepartmentId: 'dept_elsewhere',
      requesterRole: 'DEPT_ADMIN'
    }).allowed, false);
  });

  it('lets the person it is assigned to hand it on', () => {
    // The rule that makes required assignment workable. Somebody going off
    // shift must not have to find an administrator to hand over.
    assert.equal(canReassignAction({ ...base, requesterUid: 'anna' }).allowed, true);
  });

  it('refuses a colleague who is neither', () => {
    const decision = canReassignAction(base);

    assert.equal(decision.allowed, false);
    assert.match(decision.reason || '', /department administrator/);
  });
});

describe('what cannot be moved', () => {
  it('refuses verified work', () => {
    // Checked by a second person. Moving it edits the record, not the work.
    assert.equal(canReassignAction({ ...base, actionStatus: 'VERIFIED', requesterRole: 'ORG_ADMIN' }).allowed, false);
  });

  it('refuses a cancelled action', () => {
    assert.equal(canReassignAction({ ...base, actionStatus: 'CANCELLED', requesterRole: 'ORG_ADMIN' }).allowed, false);
  });

  it('refuses moving somebody to themselves', () => {
    const decision = canReassignAction({
      ...base,
      nextPersonUid: 'anna',
      requesterRole: 'ORG_ADMIN'
    });

    assert.equal(decision.allowed, false);
    assert.match(decision.reason || '', /already who/);
  });

  it('refuses handing an unassigned action back to the team it already sits with', () => {
    assert.equal(canReassignAction({
      ...base,
      currentPersonUid: null,
      nextPersonUid: null,
      requesterRole: 'ORG_ADMIN'
    }).allowed, false);
  });

  it('allows giving an unassigned action a name', () => {
    assert.equal(canReassignAction({
      ...base,
      currentPersonUid: null,
      requesterRole: 'ORG_ADMIN'
    }).allowed, true);
  });

  it('allows handing a named action back to the whole team', () => {
    // The 2am case: the person cannot do it and does not know who is on shift.
    assert.equal(canReassignAction({
      ...base,
      nextPersonUid: null,
      requesterUid: 'anna'
    }).allowed, true);
  });

  it('works through every status that is still live', () => {
    for (const actionStatus of ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE']) {
      assert.equal(
        canReassignAction({ ...base, actionStatus, requesterRole: 'ORG_ADMIN' }).allowed,
        true,
        `${actionStatus} should still be movable`
      );
    }
  });
});

describe('the reason given', () => {
  it('accepts a preset on its own', () => {
    assert.deepEqual(
      validateReassignmentReason({ reasonId: 'UNAVAILABLE' }),
      { ok: true, reason: null }
    );
  });

  it('refuses no reason at all', () => {
    // A required free-text box gets "n/a" typed into it. Presets are what make
    // the answer worth reading.
    assert.equal(validateReassignmentReason({}).ok, false);
    assert.equal(validateReassignmentReason({ reasonId: 'MADE_UP' }).ok, false);
  });

  it('requires the text when the preset says nothing', () => {
    assert.equal(validateReassignmentReason({ reasonId: 'OTHER' }).ok, false);
    assert.equal(validateReassignmentReason({ detail: 'no', reasonId: 'OTHER' }).ok, false);
    assert.equal(
      validateReassignmentReason({ detail: 'Covering the oven line today', reasonId: 'OTHER' }).ok,
      true
    );
  });

  it('says the other person will read it, so nobody writes one thinking it is private', () => {
    assert.match(validateReassignmentReason({ reasonId: 'OTHER' }).reason || '', /Both people will see/);
  });

  it('refuses an explanation nobody will read to the end', () => {
    assert.equal(
      validateReassignmentReason({ detail: 'x'.repeat(401), reasonId: 'UNAVAILABLE' }).ok,
      false
    );
  });

  it('offers a preset for every reason work actually moves', () => {
    assert.equal(ACTION_REASSIGNMENT_REASONS.length, 5);
    assert.ok(ACTION_REASSIGNMENT_REASONS.every((option) => option.label.trim().length > 3));
  });
});

describe('writing the reason out', () => {
  it('uses the preset when there is nothing else', () => {
    assert.equal(describeReassignmentReason('UNAVAILABLE'), 'Not available');
  });

  it('joins the preset and the detail into one sentence', () => {
    assert.equal(
      describeReassignmentReason('UNAVAILABLE', 'On leave until Monday'),
      'Not available — On leave until Monday'
    );
  });

  it('uses the text alone for "Other", where the preset says nothing', () => {
    assert.equal(
      describeReassignmentReason('OTHER', 'Covering the oven line today'),
      'Covering the oven line today'
    );
  });

  it('never produces an empty line, whatever it is given', () => {
    for (const reasonId of ['UNAVAILABLE', 'OTHER', 'NONSENSE', '']) {
      assert.ok(describeReassignmentReason(reasonId, '   ').trim().length > 0);
    }
  });
});
