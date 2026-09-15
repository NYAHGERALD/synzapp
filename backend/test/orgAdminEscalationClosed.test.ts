import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * A guard, not a unit test.
 *
 * The defect was that a **department name** decided a role: inviting anybody
 * into a department that normalised to "human resources" overrode the selected
 * role and granted all ten organization-admin permissions, and a department
 * admin of HR could do it without limit.
 *
 * `orgAdminInvitePolicy.test.ts` proves the replacement behaves. This proves
 * the old path cannot come back — the invite service reaches Firestore, so
 * there is no way to assert it by calling it.
 */

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const inviteService = readFileSync(
  resolve(backendRoot, 'src', 'services', 'employeeInviteService.ts'),
  'utf8'
);
const adminRoutes = readFileSync(
  resolve(backendRoot, 'src', 'routes', 'adminRoutes.ts'),
  'utf8'
);
const invitePolicy = readFileSync(
  resolve(backendRoot, 'src', 'services', 'orgAdminInvitePolicy.ts'),
  'utf8'
);

describe('the Human Resources escalation stays closed', () => {
  it('the invite service never asks whether a department is Human Resources', () => {
    assert.doesNotMatch(
      inviteService,
      /isHumanResourcesDepartment/,
      'Inviting must not branch on the department being Human Resources. That rule granted ' +
      'organization admin from a department NAME, so renaming a department was an escalation.'
    );
  });

  it('the invite service does not reach for the organization admin permission set directly', () => {
    /**
     * Only `resolveInviteRoleGrant` hands those out, and only after
     * `canGrantOrgAdminOnInvite` has allowed it. A second route to the same
     * array is how the first one got there.
     */
    assert.doesNotMatch(inviteService, /ORG_ADMIN_PERMISSIONS/);
  });

  it('granting organization admin goes through the policy, and is asked for explicitly', () => {
    assert.match(inviteService, /canGrantOrgAdminOnInvite/);
    assert.match(inviteService, /resolveInviteRoleGrant/);
    assert.match(inviteService, /inviteAsOrgAdmin/);
  });

  it('the policy matches the admin department by id and never by name', () => {
    assert.match(invitePolicy, /HUMAN_RESOURCES_DEPARTMENT_ID/);
    assert.doesNotMatch(
      invitePolicy,
      /HUMAN_RESOURCES_DEPARTMENT_NAME/,
      'Comparing a department name is the defect itself.'
    );
  });

  it('the invite request carries the flag, so it can never be inferred', () => {
    assert.match(adminRoutes, /inviteAsOrgAdmin: z\.boolean\(\)\.optional\(\)/);
  });

  it('the invite audit records the role that was granted, not only the one requested', () => {
    /**
     * The trail used to actively misstate this: it logged `body.roleId`, which
     * the service had already discarded, so a new organization admin read as
     * "invited as Forklift Operator".
     */
    assert.match(adminRoutes, /grantedRole/);
    assert.match(adminRoutes, /grantedPermissions/);
  });
});
