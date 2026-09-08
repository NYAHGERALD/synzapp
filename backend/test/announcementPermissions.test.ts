import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canSendAnnouncement } from '../src/services/authorizationPolicy.ts';

/**
 * Who may send an announcement.
 *
 * Every row of section 4 of the plan is a test here. These run the real policy
 * function, so removing a rule fails a test rather than passing quietly.
 */

const TENANT = 'tenant_a';

const orgAdmin = {
  access: 'ACTIVE',
  permissions: ['groups.manage'],
  role: 'ORG_ADMIN',
  status: 'ACTIVE',
  tenantId: TENANT
};

const productionAdmin = {
  access: 'ACTIVE',
  permissions: ['announcements.send', 'groups.create'],
  role: 'DEPT_ADMIN',
  status: 'ACTIVE',
  tenantId: TENANT,
  userDepartmentId: 'dept_production'
};

const teamLead = {
  access: 'ACTIVE',
  permissions: ['groups.create'],
  requesterUid: 'user_lead',
  role: 'EMPLOYEE',
  status: 'ACTIVE',
  tenantId: TENANT,
  userDepartmentId: 'dept_production'
};

const ordinaryEmployee = {
  access: 'ACTIVE',
  permissions: [],
  requesterUid: 'user_worker',
  role: 'EMPLOYEE',
  status: 'ACTIVE',
  tenantId: TENANT,
  userDepartmentId: 'dept_production'
};

describe('who may send an announcement', () => {
  it('lets an Org Admin address the whole organization', () => {
    assert.equal(
      canSendAnnouncement({ ...orgAdmin, audienceKind: 'ORGANIZATION' }),
      true
    );
  });

  it('refuses everybody else the whole organization', () => {
    for (const sender of [productionAdmin, teamLead, ordinaryEmployee]) {
      assert.equal(
        canSendAnnouncement({ ...sender, audienceKind: 'ORGANIZATION' }),
        false,
        `${sender.role} must not be able to address the whole company`
      );
    }
  });

  it('lets a department admin address their own department', () => {
    assert.equal(
      canSendAnnouncement({
        ...productionAdmin,
        audienceDepartmentId: 'dept_production',
        audienceKind: 'DEPARTMENT'
      }),
      true
    );
  });

  it('refuses a department admin another department', () => {
    // The case that would otherwise be caught only by a customer.
    assert.equal(
      canSendAnnouncement({
        ...productionAdmin,
        audienceDepartmentId: 'dept_warehouse',
        audienceKind: 'DEPARTMENT'
      }),
      false
    );
  });

  it('lets someone who can create groups address a group they are in', () => {
    assert.equal(
      canSendAnnouncement({
        ...teamLead,
        audienceDepartmentId: 'dept_production',
        audienceKind: 'GROUP',
        groupMemberIds: ['user_lead', 'user_worker']
      }),
      true
    );
  });

  it('refuses them a group they are not in', () => {
    assert.equal(
      canSendAnnouncement({
        ...teamLead,
        audienceDepartmentId: 'dept_production',
        audienceKind: 'GROUP',
        groupMemberIds: ['someone_else']
      }),
      false
    );
  });

  it('refuses them the department, however many groups they run', () => {
    // Trusting somebody to form a team is not trusting them to address the
    // department it sits in.
    assert.equal(
      canSendAnnouncement({
        ...teamLead,
        audienceDepartmentId: 'dept_production',
        audienceKind: 'DEPARTMENT'
      }),
      false
    );
  });

  it('refuses an employee with no grant, even in their own group', () => {
    assert.equal(
      canSendAnnouncement({
        ...ordinaryEmployee,
        audienceKind: 'GROUP',
        groupMemberIds: ['user_worker']
      }),
      false
    );
  });

  it('refuses anybody whose session is not active', () => {
    for (const broken of [
      { ...orgAdmin, access: 'BLOCKED' },
      { ...orgAdmin, status: 'DEACTIVATED' },
      { ...orgAdmin, tenantId: null }
    ]) {
      assert.equal(
        canSendAnnouncement({ ...broken, audienceKind: 'ORGANIZATION' }),
        false
      );
    }
  });

  it('refuses a sender from another company', () => {
    assert.equal(
      canSendAnnouncement({
        ...orgAdmin,
        audienceKind: 'ORGANIZATION',
        resourceTenantId: 'tenant_b'
      }),
      false
    );
  });
});
