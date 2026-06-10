import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canAccessTenantResource,
  canDepartmentAdminUseScopedPermission,
  canInviteEmployeeToDepartment,
  canManageTenantGroup,
  canOrgAdminUsePermission,
  canViewDepartmentEmployees,
  isActiveTenantSession
} from '../src/services/authorizationPolicy.ts';

describe('authorization policy foundation', () => {
  const activeOrgAdmin = {
    access: 'ACTIVE',
    permissions: ['groups.manage', 'users.manage'],
    role: 'ORG_ADMIN',
    status: 'ACTIVE',
    tenantId: 'tenant_a'
  };

  const activeDeptAdmin = {
    access: 'ACTIVE',
    permissions: ['groups.create', 'users.invite'],
    resourceDepartmentId: 'bakery',
    resourceTenantId: 'tenant_a',
    role: 'DEPT_ADMIN',
    status: 'ACTIVE',
    tenantId: 'tenant_a',
    userDepartmentId: 'bakery'
  };

  it('accepts only active tenant sessions with a known role', () => {
    assert.equal(isActiveTenantSession(activeOrgAdmin), true);
    assert.equal(isActiveTenantSession({ ...activeOrgAdmin, access: 'BLOCKED' }), false);
    assert.equal(isActiveTenantSession({ ...activeOrgAdmin, role: 'CONTRACTOR' }), false);
    assert.equal(isActiveTenantSession({ ...activeOrgAdmin, status: 'DEACTIVATED' }), false);
    assert.equal(isActiveTenantSession({ ...activeOrgAdmin, tenantId: '' }), false);
  });

  it('denies cross-tenant resource access', () => {
    assert.equal(
      canAccessTenantResource({ ...activeOrgAdmin, resourceTenantId: 'tenant_a' }),
      true
    );
    assert.equal(
      canAccessTenantResource({ ...activeOrgAdmin, resourceTenantId: 'tenant_b' }),
      false
    );
  });

  it('allows Org Admins only when they have the required permission', () => {
    assert.equal(canOrgAdminUsePermission(activeOrgAdmin, 'groups.manage'), true);
    assert.equal(canOrgAdminUsePermission(activeOrgAdmin, 'security.manage'), false);
    assert.equal(
      canOrgAdminUsePermission({ ...activeOrgAdmin, status: 'SUSPENDED' }, 'groups.manage'),
      false
    );
  });

  it('allows Department Admin scoped permissions only inside the assigned department', () => {
    assert.equal(
      canDepartmentAdminUseScopedPermission(activeDeptAdmin, 'groups.create'),
      true
    );
    assert.equal(
      canDepartmentAdminUseScopedPermission(
        { ...activeDeptAdmin, resourceDepartmentId: 'warehouse' },
        'groups.create'
      ),
      false
    );
    assert.equal(
      canDepartmentAdminUseScopedPermission(
        { ...activeDeptAdmin, resourceTenantId: 'tenant_b' },
        'groups.create'
      ),
      false
    );
  });

  it('keeps employees from gaining admin power by carrying permission strings', () => {
    const employeeWithPermissions = {
      ...activeDeptAdmin,
      role: 'EMPLOYEE'
    };

    assert.equal(canManageTenantGroup(employeeWithPermissions), false);
    assert.equal(canInviteEmployeeToDepartment(employeeWithPermissions), false);
    assert.equal(canViewDepartmentEmployees(employeeWithPermissions), false);
  });

  it('permits only authorized Org Admin and same-department Department Admin operations', () => {
    assert.equal(canManageTenantGroup(activeOrgAdmin), true);
    assert.equal(canInviteEmployeeToDepartment(activeOrgAdmin), true);
    assert.equal(canManageTenantGroup(activeDeptAdmin), true);
    assert.equal(canInviteEmployeeToDepartment(activeDeptAdmin), true);
    assert.equal(canViewDepartmentEmployees(activeDeptAdmin), true);
    assert.equal(
      canInviteEmployeeToDepartment({ ...activeDeptAdmin, permissions: ['groups.create'] }),
      false
    );
  });
});
