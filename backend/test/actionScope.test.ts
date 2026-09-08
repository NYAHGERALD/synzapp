import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildActionDepartmentIds,
  hasCurrentDepartmentIds,
  resolveActionListScope,
  resolveReadableDepartmentIds,
  TERMINAL_ACTION_STATUSES
} from '../src/services/actionScope.ts';

/**
 * Which departments an action belongs to.
 *
 * Who may cancel one is tested in `actionPermissions.test.ts`, beside the rules
 * for creating, working and verifying, because that is where the policy lives.
 */

const KITCHEN = 'dept_kitchen';
const MAINTENANCE = 'dept_maintenance';

describe('the departments an action belongs to', () => {
  it('holds the department that raised it and the one answerable for it', () => {
    assert.deepEqual(
      buildActionDepartmentIds({ responsibleDepartmentId: MAINTENANCE, sourceDepartmentId: KITCHEN }),
      [KITCHEN, MAINTENANCE]
    );
  });

  it('keeps one entry when a department raised work for itself', () => {
    assert.deepEqual(
      buildActionDepartmentIds({ responsibleDepartmentId: KITCHEN, sourceDepartmentId: KITCHEN }),
      [KITCHEN]
    );
  });

  it('is sorted, so an unchanged action does not look changed on every write', () => {
    assert.deepEqual(
      buildActionDepartmentIds({ responsibleDepartmentId: KITCHEN, sourceDepartmentId: MAINTENANCE }),
      buildActionDepartmentIds({ responsibleDepartmentId: MAINTENANCE, sourceDepartmentId: KITCHEN })
    );
  });

  it('ignores blank and whitespace, which would otherwise match nothing', () => {
    assert.deepEqual(
      buildActionDepartmentIds({ responsibleDepartmentId: '   ', sourceDepartmentId: KITCHEN }),
      [KITCHEN]
    );
  });

  it('is empty rather than malformed when neither department is known', () => {
    assert.deepEqual(
      buildActionDepartmentIds({ responsibleDepartmentId: null, sourceDepartmentId: null }),
      []
    );
  });
});

describe('which departments a person may read', () => {
  it('gives an org admin the whole tenant', () => {
    assert.equal(resolveReadableDepartmentIds({ departmentId: KITCHEN, isOrgAdmin: true }), null);
  });

  it('gives an employee their own department', () => {
    assert.deepEqual(
      resolveReadableDepartmentIds({ departmentId: KITCHEN, isOrgAdmin: false }),
      [KITCHEN]
    );
  });

  it('gives somebody with no department nothing, never everything', () => {
    // The dangerous failure. An empty list must not be read as "no filter".
    const readable = resolveReadableDepartmentIds({ departmentId: null, isOrgAdmin: false });

    assert.deepEqual(readable, []);
    assert.notEqual(readable, null);
  });
});

describe('the states nothing more is expected of', () => {
  it('covers both endings, so a cancelled action leaves the active list', () => {
    assert.deepEqual(TERMINAL_ACTION_STATUSES, ['VERIFIED', 'CANCELLED']);
  });
});

describe('deciding what the backfill has to rewrite', () => {
  it('leaves a record that is already right alone', () => {
    assert.equal(hasCurrentDepartmentIds([KITCHEN, MAINTENANCE], [KITCHEN, MAINTENANCE]), true);
  });

  it('rewrites a record written before the field existed', () => {
    assert.equal(hasCurrentDepartmentIds(undefined, [KITCHEN]), false);
  });

  it('rewrites a record holding the right departments in the wrong order', () => {
    // The stored value is sorted so that any two can be compared. One that is
    // merely a permutation is not comparable and gets rewritten.
    assert.equal(hasCurrentDepartmentIds([MAINTENANCE, KITCHEN], [KITCHEN, MAINTENANCE]), false);
  });

  it('rewrites a record whose department has since changed', () => {
    assert.equal(hasCurrentDepartmentIds([KITCHEN], [KITCHEN, MAINTENANCE]), false);
  });

  it('treats a non-array as needing a rewrite rather than throwing', () => {
    assert.equal(hasCurrentDepartmentIds('dept_kitchen', [KITCHEN]), false);
    assert.equal(hasCurrentDepartmentIds(null, []), false);
  });

  it('agrees that an action with no departments is already correct once empty', () => {
    assert.equal(hasCurrentDepartmentIds([], []), true);
  });
});

describe('how a tenant-wide list is narrowed', () => {
  it('gives an org admin the whole tenant', () => {
    assert.deepEqual(
      resolveActionListScope({ departmentId: KITCHEN, isOrgAdmin: true, uid: 'uid_boss' }),
      { kind: 'all' }
    );
  });

  it('narrows an employee to their own department', () => {
    assert.deepEqual(
      resolveActionListScope({ departmentId: KITCHEN, isOrgAdmin: false, uid: 'uid_cook' }),
      { departmentIds: [KITCHEN], kind: 'departments' }
    );
  });

  it('narrows somebody with no department to what they raised themselves', () => {
    // The failure that matters. An unassigned account must never fall through
    // to the whole tenant, which is what an empty department filter becomes.
    assert.deepEqual(
      resolveActionListScope({ departmentId: null, isOrgAdmin: false, uid: 'uid_nobody' }),
      { kind: 'own', uid: 'uid_nobody' }
    );
  });

  it('never answers "all" for anyone who is not an org admin', () => {
    const cases = [
      { departmentId: KITCHEN, isOrgAdmin: false, uid: 'a' },
      { departmentId: null, isOrgAdmin: false, uid: 'b' },
      { departmentId: '', isOrgAdmin: false, uid: 'c' }
    ];

    for (const actor of cases) {
      assert.notEqual(resolveActionListScope(actor).kind, 'all');
    }
  });

  it('treats a blank department as no department, not as a department named blank', () => {
    assert.deepEqual(
      resolveActionListScope({ departmentId: '', isOrgAdmin: false, uid: 'uid_x' }),
      { kind: 'own', uid: 'uid_x' }
    );
  });
});
