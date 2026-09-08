import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canAddMemberToGroup } from '../src/services/groupChatService.ts';

/**
 * Who may be put into a group by hand.
 *
 * A department's group is not editable by anybody: its members are the people
 * in that department, decided when somebody is invited and given a role there.
 *
 * This is tested because the hole it closes was not a subtle one. The rule used
 * to begin by asking whether the caller was a member, and a member could add
 * anyone to anything — so an employee added an organization admin from another
 * department into their department's chat, and every department check below sat
 * unreached.
 */

const employee = (departmentId: string) => ({
  role: 'EMPLOYEE',
  uid: 'employee-1',
  user: { departmentId }
}) as unknown as Parameters<typeof canAddMemberToGroup>[0];

const orgAdmin = (departmentId: string) => ({
  role: 'ORG_ADMIN',
  uid: 'admin-1',
  user: { departmentId }
}) as unknown as Parameters<typeof canAddMemberToGroup>[0];

const departmentGroup = {
  autoMembershipDepartmentId: 'dept_bakery',
  createdBy: 'admin-1',
  isDepartmentDefault: true,
  memberPolicy: 'DEPARTMENT_PLUS_EXPLICIT'
} as unknown as Parameters<typeof canAddMemberToGroup>[1];

const ordinaryGroup = {
  createdBy: 'admin-1',
  isDepartmentDefault: false,
  memberPolicy: 'EXPLICIT'
} as unknown as Parameters<typeof canAddMemberToGroup>[1];

describe('adding somebody to a department group', () => {
  it('refuses an employee who is a member of it', () => {
    // Exactly what happened: a Bakery employee added an org admin to Bakery.
    assert.equal(canAddMemberToGroup(employee('dept_bakery'), departmentGroup, ['employee-1']), false);
  });

  it('refuses an organization admin of that same department', () => {
    assert.equal(canAddMemberToGroup(orgAdmin('dept_bakery'), departmentGroup, ['admin-1']), false);
  });

  it('refuses the person who created the group', () => {
    // Nobody is exempt. The roster decides, not a person.
    assert.equal(canAddMemberToGroup(orgAdmin('dept_hr'), departmentGroup, []), false);
  });

  it('refuses any group whose membership follows a department', () => {
    const followsDepartment = {
      autoMembershipDepartmentId: 'dept_bakery',
      isDepartmentDefault: false,
      memberPolicy: 'DEPARTMENT_PLUS_EXPLICIT'
    } as unknown as Parameters<typeof canAddMemberToGroup>[1];

    assert.equal(canAddMemberToGroup(employee('dept_bakery'), followsDepartment, ['employee-1']), false);
  });
});

describe('adding somebody to an ordinary group', () => {
  it('still lets a member add someone', () => {
    assert.equal(canAddMemberToGroup(employee('dept_bakery'), ordinaryGroup, ['employee-1']), true);
  });

  it('still lets the admin who created it add someone', () => {
    assert.equal(canAddMemberToGroup(orgAdmin('dept_hr'), ordinaryGroup, []), true);
  });

  it('refuses an employee who is not in it', () => {
    assert.equal(canAddMemberToGroup(employee('dept_hr'), ordinaryGroup, ['someone-else']), false);
  });

  it('refuses an organization admin who neither made it nor is in it', () => {
    const madeBySomebodyElse = {
      createdBy: 'another-admin',
      isDepartmentDefault: false,
      memberPolicy: 'EXPLICIT'
    } as unknown as Parameters<typeof canAddMemberToGroup>[1];

    assert.equal(canAddMemberToGroup(orgAdmin('dept_hr'), madeBySomebodyElse, []), false);
  });
});
