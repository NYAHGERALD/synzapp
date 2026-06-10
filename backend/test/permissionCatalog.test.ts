import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertDepartmentAdminPermissions,
  assertRolePermissions,
  mergePermissions
} from '../src/services/permissionCatalog.ts';

describe('permission catalog validation', () => {
  it('accepts and normalizes supported role permissions', () => {
    assert.deepEqual(
      assertRolePermissions([
        'work_orders.create',
        'groups.create',
        'groups.create'
      ]),
      [
        'groups.create',
        'work_orders.create'
      ]
    );
  });

  it('rejects admin-only permissions for company roles', () => {
    assert.throws(
      () => assertRolePermissions([
        'groups.create',
        'users.manage',
        'security.manage'
      ]),
      /not supported/
    );
  });

  it('accepts supported Department Admin overlay permissions', () => {
    assert.deepEqual(
      assertDepartmentAdminPermissions([
        'users.invite',
        'groups.create',
        'users.invite'
      ]),
      [
        'groups.create',
        'users.invite'
      ]
    );
  });

  it('rejects broad user-management permissions for Department Admin overlays', () => {
    assert.throws(
      () => assertDepartmentAdminPermissions([
        'users.invite',
        'users.manage'
      ]),
      /not supported/
    );
  });

  it('deduplicates merged effective permissions', () => {
    assert.deepEqual(
      mergePermissions(
        ['groups.create', 'work_orders.create'],
        ['groups.create', 'users.invite']
      ),
      [
        'groups.create',
        'users.invite',
        'work_orders.create'
      ]
    );
  });
});
