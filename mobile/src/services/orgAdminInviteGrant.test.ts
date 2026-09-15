import { describe, expect, it } from 'vitest';
import {
  ORG_ADMIN_DEPARTMENT_ID,
  ORG_ADMIN_GRANT_PERMISSION,
  canOfferOrgAdminInvite,
  describeOrgAdminInviteConfirmation,
  describeOrgAdminInviteHint
} from './orgAdminInviteGrant';

describe('who is offered the organization admin switch', () => {
  it('offers it to an organization admin who can manage users', () => {
    expect(canOfferOrgAdminInvite({
      departmentId: ORG_ADMIN_DEPARTMENT_ID,
      permissions: ['users.invite', ORG_ADMIN_GRANT_PERMISSION],
      role: 'ORG_ADMIN'
    })).toBe(true);
  });

  it('does not offer it to a department admin', () => {
    // The original escalation: a department admin of HR could mint unlimited
    // organization admins. The backend refuses them, so the switch would only
    // produce an error they cannot act on.
    expect(canOfferOrgAdminInvite({
      departmentId: ORG_ADMIN_DEPARTMENT_ID,
      permissions: ['users.invite'],
      role: 'DEPT_ADMIN'
    })).toBe(false);
  });

  it('does not offer it to a department admin who somehow holds users.manage', () => {
    expect(canOfferOrgAdminInvite({
      departmentId: ORG_ADMIN_DEPARTMENT_ID,
      permissions: [ORG_ADMIN_GRANT_PERMISSION],
      role: 'DEPT_ADMIN'
    })).toBe(false);
  });

  it('does not offer it to an organization admin without users.manage', () => {
    expect(canOfferOrgAdminInvite({
      departmentId: ORG_ADMIN_DEPARTMENT_ID,
      permissions: ['users.invite'],
      role: 'ORG_ADMIN'
    })).toBe(false);
  });

  it('does not offer it when the profile has not loaded', () => {
    expect(canOfferOrgAdminInvite({})).toBe(false);
    expect(canOfferOrgAdminInvite({ permissions: null, role: null })).toBe(false);
  });

  it('does not offer it outside the Human Resources department', () => {
    // The server refuses it there, because an organization admin invited into
    // any other department never settles: it is moved into Human Resources on
    // every profile request and put back by the approved-phone record.
    expect(canOfferOrgAdminInvite({
      departmentId: 'dept_operations',
      permissions: [ORG_ADMIN_GRANT_PERMISSION],
      role: 'ORG_ADMIN'
    })).toBe(false);
  });

  it('matches the department by id, never by name', () => {
    expect(canOfferOrgAdminInvite({
      departmentId: 'dept_human-resources-2',
      permissions: [ORG_ADMIN_GRANT_PERMISSION],
      role: 'ORG_ADMIN'
    })).toBe(false);
  });

  it('does not offer it before a department is chosen', () => {
    expect(canOfferOrgAdminInvite({
      departmentId: null,
      permissions: [ORG_ADMIN_GRANT_PERMISSION],
      role: 'ORG_ADMIN'
    })).toBe(false);
  });
});

describe('confirming an organization admin invite', () => {
  it('describes one person in the singular', () => {
    const confirmation = describeOrgAdminInviteConfirmation({
      contactCount: 1,
      departmentName: 'Human Resources'
    });

    expect(confirmation.title).toBe('Give this person admin access?');
    expect(confirmation.confirmLabel).toBe('Invite as admin');
    expect(confirmation.body).toContain('the same access you do');
    expect(confirmation.body).toContain('Human Resources');
  });

  it('describes several people in the plural and counts them', () => {
    const confirmation = describeOrgAdminInviteConfirmation({
      contactCount: 3,
      departmentName: 'Operations'
    });

    expect(confirmation.title).toBe('Give these people admin access?');
    expect(confirmation.confirmLabel).toBe('Invite as admins');
    expect(confirmation.body).toContain('These 3 people');
  });

  it('says what they will be able to do, not just the role name', () => {
    // "Organization admin" means nothing to somebody who has not read the
    // permission catalogue, so the consequences are spelled out instead.
    const confirmation = describeOrgAdminInviteConfirmation({ contactCount: 1 });

    expect(confirmation.body).toContain('removing people');
    expect(confirmation.body).toContain('audit log');
    // The two nobody expects from the words "organization admin".
    expect(confirmation.body).toContain('deleting the whole organization');
    expect(confirmation.body).toContain('legal holds');
  });

  it('says plainly that the grant cannot be taken back yet', () => {
    // There is no demotion path: every lifecycle action on an ORG_ADMIN record
    // is refused. Saying so is the difference between a considered decision and
    // a trap.
    const confirmation = describeOrgAdminInviteConfirmation({ contactCount: 1 });

    expect(confirmation.body).toContain('cannot be undone');
  });

  it('leaves out the department when there is not one to name', () => {
    const confirmation = describeOrgAdminInviteConfirmation({
      contactCount: 1,
      departmentName: '   '
    });

    expect(confirmation.body).not.toContain('being added to');
  });

  it('explains the switch before it is used', () => {
    expect(describeOrgAdminInviteHint()).toContain('audit log');
  });
});
