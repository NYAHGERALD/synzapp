import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ORG_ADMIN_DEPARTMENT_ID,
  isReservedTenantRoleName,
  ORG_ADMIN_GRANT_PERMISSION,
  ORG_ADMIN_ROLE_NAME,
  canGrantOrgAdminOnInvite,
  resolveInviteRoleGrant
} from '../src/services/orgAdminInvitePolicy.ts';
import { ORG_ADMIN_PERMISSIONS } from '../src/services/permissionCatalog.ts';

const ORG_ADMIN_CALLER = {
  callerPermissions: ORG_ADMIN_PERMISSIONS,
  callerRole: 'ORG_ADMIN' as const,
  callerScopeDepartmentId: null,
  departmentId: ORG_ADMIN_DEPARTMENT_ID
};

describe('who may grant organization admin on an invite', () => {
  it('allows a genuine organization admin', () => {
    const decision = canGrantOrgAdminOnInvite(ORG_ADMIN_CALLER);

    assert.equal(decision.allowed, true);
    assert.equal(decision.reason, null);
  });

  it('refuses a department admin of any department', () => {
    /**
     * The original escalation. The invite endpoint admits department admins and
     * only checks the target department is their own, so a department admin of
     * HR could mint unlimited organization admins.
     */
    const decision = canGrantOrgAdminOnInvite({
      callerPermissions: ['users.invite', 'groups.create'],
      callerRole: 'DEPT_ADMIN',
      callerScopeDepartmentId: ORG_ADMIN_DEPARTMENT_ID,
      departmentId: ORG_ADMIN_DEPARTMENT_ID
    });

    assert.equal(decision.allowed, false);
    assert.match(decision.reason || '', /department admin/i);
  });

  it('refuses a scoped caller even when their permissions look complete', () => {
    /**
     * A scope is what makes somebody a department admin, whatever else they
     * hold. Checking permissions alone would reopen the hole the moment anybody
     * granted users.manage to a scoped account.
     */
    const decision = canGrantOrgAdminOnInvite({
      callerPermissions: ORG_ADMIN_PERMISSIONS,
      callerRole: 'DEPT_ADMIN',
      callerScopeDepartmentId: 'dept_operations',
      departmentId: ORG_ADMIN_DEPARTMENT_ID
    });

    assert.equal(decision.allowed, false);
  });

  it('refuses an organization admin who does not hold users.manage', () => {
    const decision = canGrantOrgAdminOnInvite({
      callerPermissions: ORG_ADMIN_PERMISSIONS.filter(
        (permission) => permission !== ORG_ADMIN_GRANT_PERMISSION
      ),
      callerRole: 'ORG_ADMIN',
      callerScopeDepartmentId: null,
      departmentId: ORG_ADMIN_DEPARTMENT_ID
    });

    assert.equal(decision.allowed, false);
    assert.match(decision.reason || '', /permission/i);
  });

  it('refuses an employee', () => {
    const decision = canGrantOrgAdminOnInvite({
      callerPermissions: [],
      callerRole: 'EMPLOYEE',
      callerScopeDepartmentId: null,
      departmentId: ORG_ADMIN_DEPARTMENT_ID
    });

    assert.equal(decision.allowed, false);
  });

  it('refuses when the role is missing rather than defaulting to allowed', () => {
    const decision = canGrantOrgAdminOnInvite({
      callerPermissions: ORG_ADMIN_PERMISSIONS,
      callerRole: null,
      callerScopeDepartmentId: null,
      departmentId: ORG_ADMIN_DEPARTMENT_ID
    });

    assert.equal(decision.allowed, false);
  });
});

describe('where an organization admin may be placed', () => {
  it('refuses a department that is not Human Resources', () => {
    /**
     * Not decoration. `userProfileService` moves every organization admin into
     * Human Resources on each profile request while the approved-phone record
     * puts them back where the invite said, so an admin invited anywhere else
     * never settles: a Firestore write and a fresh set of custom claims on
     * every single request, forever.
     */
    const decision = canGrantOrgAdminOnInvite({
      ...ORG_ADMIN_CALLER,
      departmentId: 'dept_operations'
    });

    assert.equal(decision.allowed, false);
    assert.match(decision.reason || '', /Human Resources/);
  });

  it('matches the department by id, never by name', () => {
    /**
     * The direction that mattered. A department merely *called* "Human
     * Resources" is not the Human Resources department, which is exactly the
     * confusion the original defect was built on.
     */
    const decision = canGrantOrgAdminOnInvite({
      ...ORG_ADMIN_CALLER,
      departmentId: 'dept_human-resources-2'
    });

    assert.equal(decision.allowed, false);
  });

  it('refuses when no department was given at all', () => {
    const decision = canGrantOrgAdminOnInvite({
      ...ORG_ADMIN_CALLER,
      departmentId: null
    });

    assert.equal(decision.allowed, false);
  });
});

describe('what an invite grants', () => {
  it('grants the full organization admin set when it was asked for and allowed', () => {
    const grant = resolveInviteRoleGrant({
      grantOrgAdmin: true,
      tenantRoleName: 'Forklift Operator',
      tenantRolePermissions: ['groups.create']
    });

    assert.equal(grant.role, 'ORG_ADMIN');
    assert.equal(grant.roleName, ORG_ADMIN_ROLE_NAME);
    assert.deepEqual(grant.permissions, ORG_ADMIN_PERMISSIONS);
  });

  it('grants the selected role and nothing more by default', () => {
    const grant = resolveInviteRoleGrant({
      grantOrgAdmin: false,
      tenantRoleName: 'Forklift Operator',
      tenantRolePermissions: ['groups.create']
    });

    assert.equal(grant.role, 'EMPLOYEE');
    assert.equal(grant.roleName, 'Forklift Operator');
    assert.deepEqual(grant.permissions, ['groups.create']);
  });

  it('drops an admin permission that somehow reached a role document', () => {
    /**
     * Role permissions are checked against the catalogue when they are saved,
     * so users.manage on a role document arrived some other way. An invite is
     * the wrong place for it to spread.
     */
    const grant = resolveInviteRoleGrant({
      grantOrgAdmin: false,
      tenantRoleName: 'Shift Lead',
      tenantRolePermissions: ['groups.create', 'users.manage', 'security.manage']
    });

    assert.equal(grant.role, 'EMPLOYEE');
    assert.deepEqual(grant.permissions, ['groups.create']);
  });

  it('falls back to a usable name when the role has none', () => {
    const grant = resolveInviteRoleGrant({
      grantOrgAdmin: false,
      tenantRoleName: '   ',
      tenantRolePermissions: []
    });

    assert.equal(grant.roleName, 'Role');
  });

  it('cannot be influenced by a department, by name or by id', () => {
    /**
     * The whole defect in one assertion: the grant takes no department at all,
     * so renaming a department to "Human Resources" can no longer change what
     * an invite hands out.
     */
    assert.equal(resolveInviteRoleGrant.length, 1);

    const grant = resolveInviteRoleGrant({
      grantOrgAdmin: false,
      tenantRoleName: 'Recruiter',
      tenantRolePermissions: []
    } as Parameters<typeof resolveInviteRoleGrant>[0] & { departmentName: string });

    assert.equal(grant.role, 'EMPLOYEE');
  });
});

describe('role names that would be read as authority', () => {
  it('refuses the three names RAILS turns into an organization admin', () => {
    /**
     * `normalizeRailsTenantRole` maps a role *name* to a real role when the
     * stored role is missing, so a tenant role called "Org Admin" decides who
     * may approve a high-risk RAILS loop. Same defect, one level down. RAILS is
     * shipped and untouched, so the name is refused where it is chosen.
     */
    assert.equal(isReservedTenantRoleName('Organization Admin'), true);
    assert.equal(isReservedTenantRoleName('Org Admin'), true);
    assert.equal(isReservedTenantRoleName('Tenant Admin'), true);
  });

  it('refuses the department admin names too', () => {
    assert.equal(isReservedTenantRoleName('Department Admin'), true);
    assert.equal(isReservedTenantRoleName('Dept Admin'), true);
  });

  it('refuses system admin, the one nothing in the product assigns', () => {
    /**
     * `normalizeRailsTenantRole` maps it to SYSTEM_ADMIN, which passes the same
     * RAILS checks an organization admin passes. A list that stopped at the
     * org-admin names would leave the highest of them open.
     */
    assert.equal(isReservedTenantRoleName('System Admin'), true);
  });

  it('normalises punctuation, spacing and case the way RAILS does', () => {
    assert.equal(isReservedTenantRoleName('  ORG-ADMIN  '), true);
    assert.equal(isReservedTenantRoleName('org_admin'), true);
    assert.equal(isReservedTenantRoleName('Org   Admin'), true);
  });

  it('allows ordinary job titles', () => {
    assert.equal(isReservedTenantRoleName('Forklift Operator'), false);
    assert.equal(isReservedTenantRoleName('Shift Lead'), false);
    assert.equal(isReservedTenantRoleName('HR Administrator'), false);
  });
});
