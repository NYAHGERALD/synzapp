import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canCancelAction,
  canChangeActionStatus,
  canCreateAction,
  canVerifyAction
} from '../src/services/authorizationPolicy.ts';

/**
 * Who may raise, work and verify an action.
 *
 * Every rule in section 6 of the Create Action plan is a test here. These run
 * the real policy functions, so deleting a rule fails a test rather than
 * passing quietly.
 */

const TENANT = 'tenant_a';

const orgAdmin = {
  access: 'ACTIVE',
  permissions: [],
  requesterUid: 'user_admin',
  role: 'ORG_ADMIN',
  status: 'ACTIVE',
  tenantId: TENANT
};

const maintenanceAdmin = {
  access: 'ACTIVE',
  permissions: [],
  requesterUid: 'user_maint_admin',
  role: 'DEPT_ADMIN',
  status: 'ACTIVE',
  tenantId: TENANT,
  userDepartmentId: 'dept_maintenance'
};

const operator = {
  access: 'ACTIVE',
  permissions: [],
  requesterUid: 'user_operator',
  role: 'EMPLOYEE',
  status: 'ACTIVE',
  tenantId: TENANT,
  userDepartmentId: 'dept_production'
};

const fitter = {
  access: 'ACTIVE',
  permissions: [],
  requesterUid: 'user_fitter',
  role: 'EMPLOYEE',
  status: 'ACTIVE',
  tenantId: TENANT,
  userDepartmentId: 'dept_maintenance'
};

describe('who may raise an action', () => {
  it('lets an ordinary employee raise one, because they are who spots the fault', () => {
    assert.equal(canCreateAction(operator), true);
  });

  it('refuses somebody whose access has been revoked', () => {
    assert.equal(canCreateAction({ ...operator, access: 'REVOKED' }), false);
  });

  it('refuses a removed employee', () => {
    assert.equal(canCreateAction({ ...operator, status: 'REMOVED' }), false);
  });

  it('refuses somebody reaching into another organization', () => {
    assert.equal(canCreateAction({ ...operator, resourceTenantId: 'tenant_b' }), false);
  });
});

describe('who may move an action along', () => {
  const inMaintenanceGroup = { responsibleGroupMemberIds: ['user_fitter'] };
  const maintenanceOwned = {
    responsibleDepartmentId: 'dept_maintenance',
    responsibleGroupMemberIds: ['user_fitter']
  };

  it('lets a member of the responsible group work it', () => {
    assert.equal(canChangeActionStatus({ ...fitter, ...inMaintenanceGroup }), true);
  });

  it('refuses somebody outside the responsible group', () => {
    assert.equal(canChangeActionStatus({ ...operator, ...inMaintenanceGroup }), false);
  });

  it('lets the department admin of the responsible group work it', () => {
    assert.equal(canChangeActionStatus({ ...maintenanceAdmin, ...maintenanceOwned }), true);
  });

  it('refuses a department admin from a different department', () => {
    assert.equal(canChangeActionStatus({
      ...maintenanceAdmin,
      ...maintenanceOwned,
      userDepartmentId: 'dept_hygiene'
    }), false);
  });

  it('lets an org admin work anything', () => {
    assert.equal(canChangeActionStatus({ ...orgAdmin, ...maintenanceOwned }), true);
  });
});

describe('who may verify a completed action', () => {
  const completedByFitter = {
    completedByUid: 'user_fitter',
    createdByUid: 'user_operator',
    sourceDepartmentId: 'dept_production'
  };

  it('lets the person who raised it verify it', () => {
    assert.equal(canVerifyAction({ ...operator, ...completedByFitter }), true);
  });

  it('never lets the person who did the work verify their own work', () => {
    assert.equal(canVerifyAction({ ...fitter, ...completedByFitter }), false);
  });

  it('refuses the doer even when they are an org admin', () => {
    assert.equal(canVerifyAction({
      ...orgAdmin,
      ...completedByFitter,
      requesterUid: 'user_fitter',
      completedByUid: 'user_fitter'
    }), false);
  });

  it('refuses the doer even when they hold the verify grant', () => {
    assert.equal(canVerifyAction({
      ...fitter,
      ...completedByFitter,
      permissions: ['actions.verify']
    }), false);
  });

  it('refuses the doer even when they raised it themselves', () => {
    assert.equal(canVerifyAction({
      ...fitter,
      completedByUid: 'user_fitter',
      createdByUid: 'user_fitter',
      sourceDepartmentId: 'dept_maintenance'
    }), false);
  });

  it('lets an org admin who did not do the work verify it', () => {
    assert.equal(canVerifyAction({ ...orgAdmin, ...completedByFitter }), true);
  });

  it('lets the department admin of the raising department verify it', () => {
    assert.equal(canVerifyAction({
      ...maintenanceAdmin,
      ...completedByFitter,
      userDepartmentId: 'dept_production'
    }), true);
  });

  it('refuses a department admin from an unrelated department', () => {
    assert.equal(canVerifyAction({ ...maintenanceAdmin, ...completedByFitter }), false);
  });

  it('lets a holder of the verify grant verify it', () => {
    assert.equal(canVerifyAction({
      ...fitter,
      ...completedByFitter,
      completedByUid: 'user_someone_else',
      permissions: ['actions.verify']
    }), true);
  });

  it('refuses an ordinary employee who neither raised it nor holds the grant', () => {
    assert.equal(canVerifyAction({
      ...fitter,
      ...completedByFitter,
      completedByUid: 'user_someone_else'
    }), false);
  });

  it('refuses a removed employee holding the grant', () => {
    assert.equal(canVerifyAction({
      ...fitter,
      ...completedByFitter,
      completedByUid: 'user_someone_else',
      permissions: ['actions.verify'],
      status: 'REMOVED'
    }), false);
  });
});

/**
 * Who may cancel an action.
 *
 * Cancelling is not deleting: the record stays, with who ended it and why.
 * Section 4 of the Actions governance plan is a test per row here.
 */
describe('cancelling an action', () => {
  const cancelBase = {
    access: 'ACTIVE',
    createdByUid: 'uid_reporter',
    responsibleDepartmentId: 'dept_bakery',
    responsiblePersonUid: 'uid_fixer',
    resourceTenantId: TENANT,
    sourceDepartmentId: 'dept_hr',
    status: 'ACTIVE',
    tenantId: TENANT
  } as const;

  it('lets an org admin cancel work that is still running', () => {
    const decision = canCancelAction({
      ...cancelBase,
      actionStatus: 'IN_PROGRESS',
      requesterUid: 'uid_boss',
      role: 'ORG_ADMIN'
    });

    assert.equal(decision.allowed, true);
  });

  it('lets a department admin cancel what their department is answerable for', () => {
    const decision = canCancelAction({
      ...cancelBase,
      actionStatus: 'IN_PROGRESS',
      requesterUid: 'uid_dept_admin',
      role: 'DEPT_ADMIN',
      userDepartmentId: 'dept_bakery'
    });

    assert.equal(decision.allowed, true);
  });

  it('lets a department admin cancel what their department raised', () => {
    const decision = canCancelAction({
      ...cancelBase,
      actionStatus: 'OPEN',
      requesterUid: 'uid_dept_admin',
      role: 'DEPT_ADMIN',
      userDepartmentId: 'dept_hr'
    });

    assert.equal(decision.allowed, true);
  });

  it('refuses a department admin from an unrelated department', () => {
    const decision = canCancelAction({
      ...cancelBase,
      actionStatus: 'OPEN',
      requesterUid: 'uid_dept_admin',
      role: 'DEPT_ADMIN',
      userDepartmentId: 'dept_other'
    });

    assert.equal(decision.allowed, false);
  });

  it('lets the person who raised it withdraw it before work starts', () => {
    const decision = canCancelAction({
      ...cancelBase,
      actionStatus: 'OPEN',
      requesterUid: 'uid_reporter',
      role: 'EMPLOYEE'
    });

    assert.equal(decision.allowed, true);
  });

  it('stops the person who raised it once work has begun', () => {
    const decision = canCancelAction({
      ...cancelBase,
      actionStatus: 'IN_PROGRESS',
      requesterUid: 'uid_reporter',
      role: 'EMPLOYEE'
    });

    assert.equal(decision.allowed, false);
  });

  it('never lets the responsible person cancel their own action', () => {
    const decision = canCancelAction({
      ...cancelBase,
      actionStatus: 'IN_PROGRESS',
      requesterUid: 'uid_fixer',
      role: 'EMPLOYEE'
    });

    assert.equal(decision.allowed, false);
    assert.match(decision.reason || '', /responsible/i);
  });

  it('refuses the responsible person even when they are an org admin', () => {
    // Checked before any role, the same way the doer may never verify.
    const decision = canCancelAction({
      ...cancelBase,
      actionStatus: 'IN_PROGRESS',
      requesterUid: 'uid_fixer',
      role: 'ORG_ADMIN'
    });

    assert.equal(decision.allowed, false);
  });

  it('refuses everybody once an action is verified', () => {
    const decision = canCancelAction({
      ...cancelBase,
      actionStatus: 'VERIFIED',
      requesterUid: 'uid_boss',
      role: 'ORG_ADMIN'
    });

    assert.equal(decision.allowed, false);
    assert.match(decision.reason || '', /verified/i);
  });

  it('refuses a second cancellation rather than overwriting the first', () => {
    const decision = canCancelAction({
      ...cancelBase,
      actionStatus: 'CANCELLED',
      requesterUid: 'uid_boss',
      role: 'ORG_ADMIN'
    });

    assert.equal(decision.allowed, false);
  });

  it('refuses an org admin of another tenant', () => {
    const decision = canCancelAction({
      ...cancelBase,
      actionStatus: 'OPEN',
      requesterUid: 'uid_boss',
      role: 'ORG_ADMIN',
      tenantId: 'tenant_b'
    });

    assert.equal(decision.allowed, false);
  });

  it('refuses a suspended employee who would otherwise be allowed', () => {
    const decision = canCancelAction({
      ...cancelBase,
      actionStatus: 'OPEN',
      requesterUid: 'uid_reporter',
      role: 'EMPLOYEE',
      status: 'SUSPENDED'
    });

    assert.equal(decision.allowed, false);
  });
});
