import { describe, expect, it } from 'vitest';
import {
  buildOrgAdminRoleOption,
  isOrgAdminEmployee,
  shouldOfferEmployeeLifecycleActions
} from './orgAdminRoleActions';

describe('recognising an organization admin', () => {
  it('reads the role whatever case it arrives in', () => {
    expect(isOrgAdminEmployee('ORG_ADMIN')).toBe(true);
    expect(isOrgAdminEmployee('org_admin')).toBe(true);
    expect(isOrgAdminEmployee('EMPLOYEE')).toBe(false);
    expect(isOrgAdminEmployee(null)).toBe(false);
  });
});

describe('what the employee sheet offers', () => {
  it('offers an organization admin only the way down', () => {
    /**
     * The sheet used to offer Deactivate, Archive, Delete and Change role for an
     * admin, and every one came back "Employee was not found."
     */
    const option = buildOrgAdminRoleOption({ baseRole: 'ORG_ADMIN', status: 'ACTIVE' });

    expect(option?.action).toBe('REMOVE_ORG_ADMIN');
    expect(shouldOfferEmployeeLifecycleActions('ORG_ADMIN')).toBe(false);
  });

  it('offers the way down even for an admin whose invite is still pending', () => {
    const option = buildOrgAdminRoleOption({ baseRole: 'ORG_ADMIN', status: 'INVITED' });

    expect(option?.action).toBe('REMOVE_ORG_ADMIN');
  });

  it('offers promotion to an active employee', () => {
    const option = buildOrgAdminRoleOption({ baseRole: 'EMPLOYEE', status: 'ACTIVE' });

    expect(option?.action).toBe('ASSIGN_ORG_ADMIN');
    expect(shouldOfferEmployeeLifecycleActions('EMPLOYEE')).toBe(true);
  });

  it('offers promotion to a department admin', () => {
    const option = buildOrgAdminRoleOption({ baseRole: 'DEPT_ADMIN', status: 'ACTIVE' });

    expect(option?.action).toBe('ASSIGN_ORG_ADMIN');
  });

  it('offers promotion to somebody invited but not yet signed in', () => {
    const option = buildOrgAdminRoleOption({ baseRole: 'EMPLOYEE', status: 'INVITED' });

    expect(option?.action).toBe('ASSIGN_ORG_ADMIN');
  });

  it('does not offer promotion to somebody on their way out', () => {
    ['DEACTIVATED', 'ARCHIVED', 'DELETED', 'SUSPENDED'].forEach((status) => {
      expect(buildOrgAdminRoleOption({ baseRole: 'EMPLOYEE', status })).toBeNull();
    });
  });
});

describe('your own row', () => {
  it('offers nothing on the row belonging to the person looking at it', () => {
    /**
     * The server refuses a self change — an admin who can demote themselves
     * strands a company by accident — so offering it would walk somebody
     * through a role picker and a destructive confirmation to reach an error.
     */
    expect(buildOrgAdminRoleOption({
      baseRole: 'ORG_ADMIN',
      status: 'ACTIVE',
      targetUid: 'user_1',
      viewerUid: 'user_1'
    })).toBeNull();
  });

  it('still offers it on somebody else', () => {
    expect(buildOrgAdminRoleOption({
      baseRole: 'ORG_ADMIN',
      status: 'ACTIVE',
      targetUid: 'user_2',
      viewerUid: 'user_1'
    })?.action).toBe('REMOVE_ORG_ADMIN');
  });

  it('does not treat two missing uids as the same person', () => {
    // An unclaimed invite has no uid at all, and neither does a viewer whose
    // profile has not loaded. Matching those would hide a real action.
    expect(buildOrgAdminRoleOption({
      baseRole: 'EMPLOYEE',
      status: 'INVITED',
      targetUid: null,
      viewerUid: null
    })?.action).toBe('ASSIGN_ORG_ADMIN');
  });
});

describe('the wording of the two actions', () => {
  it('says what stepping down leaves untouched', () => {
    // Removing admin is not removing the person, and somebody hesitating over
    // the button needs to know that before they tap it.
    const option = buildOrgAdminRoleOption({ baseRole: 'ORG_ADMIN', status: 'ACTIVE' });

    expect(option?.confirmMessage('Ada')).toContain('keep their account');
  });

  it('names what admin access actually reaches', () => {
    const option = buildOrgAdminRoleOption({ baseRole: 'EMPLOYEE', status: 'ACTIVE' });

    expect(option?.confirmMessage('Ada')).toContain('legal holds');
    expect(option?.confirmMessage('Ada')).toContain('audit log');
  });

  it('does not claim they can delete the organization, because they cannot', () => {
    const option = buildOrgAdminRoleOption({ baseRole: 'EMPLOYEE', status: 'ACTIVE' });

    expect(option?.confirmMessage('Ada')).not.toContain('delet');
  });
});
