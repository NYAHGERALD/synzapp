import { describe, expect, it } from 'vitest';
import { formatPermissionLabel } from './permissionLabel';

describe('formatPermissionLabel', () => {
  it('says Organization where the code says tenant', () => {
    expect(formatPermissionLabel('tenant.read')).toBe('Organization Read');
    expect(formatPermissionLabel('tenant.update')).toBe('Organization Update');
  });

  it('leaves every other permission alone', () => {
    expect(formatPermissionLabel('users.invite')).toBe('Users Invite');
    expect(formatPermissionLabel('audit.read')).toBe('Audit Read');
    expect(formatPermissionLabel('security.manage')).toBe('Security Manage');
  });

  it('does not rewrite a word that merely contains the letters', () => {
    // "attendant" should not become "atOrganization".
    expect(formatPermissionLabel('attendant.manage')).toBe('Attendant Manage');
  });

  it('handles underscores the same as dots', () => {
    expect(formatPermissionLabel('tenant_devices.manage')).toBe('Organization Devices Manage');
  });
});
