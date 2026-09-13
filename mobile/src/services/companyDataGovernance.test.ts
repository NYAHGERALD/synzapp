import { beforeEach, describe, expect, it, vi } from 'vitest';

const purgeMock = vi.hoisted(() => ({
  calls: [] as string[]
}));

vi.mock('./chatBackup', () => ({
  clearStoredChatBackupRecoveryKey: vi.fn(async () => {
    purgeMock.calls.push('chat-backup-recovery-key');
  })
}));

vi.mock('./chatMediaApi', () => ({
  clearChatMediaStorage: vi.fn(async () => {
    purgeMock.calls.push('chat-media');
  })
}));

vi.mock('./deviceIdentity', () => ({
  clearRegisteredDeviceIdentity: vi.fn(async () => {
    purgeMock.calls.push('device-identity');
  })
}));

vi.mock('./companyDataManifest', () => ({
  blockCompanyDataScope: vi.fn(async () => {
    purgeMock.calls.push('company-data-manifest-block');
  }),
  markCompanyDataScopePurged: vi.fn(async () => {
    purgeMock.calls.push('company-data-manifest-purged');
  })
}));

vi.mock('./localCallStore', () => ({
  clearSynzappCallStore: vi.fn(async () => {
    purgeMock.calls.push('call-store');
  })
}));

vi.mock('./localChatStore', () => ({
  clearLocalChatDataForOwner: vi.fn(async () => {
    purgeMock.calls.push('local-chat');
  }),
  destroyLocalChatKey: vi.fn(async () => {
    purgeMock.calls.push('local-chat-key');
  })
}));

vi.mock('./profilePhotoCache', () => ({
  clearProfilePhotoCache: vi.fn(async () => {
    purgeMock.calls.push('profile-photo-cache');
  })
}));

import { purgeTenantCompanyData } from './companyDataGovernance';

describe('purgeTenantCompanyData', () => {
  beforeEach(() => {
    purgeMock.calls = [];
  });

  it('blocks the scope before deleting local company stores', async () => {
    const result = await purgeTenantCompanyData({
      ownerUid: 'owner-1',
      reason: 'remote-wipe',
      tenantId: 'tenant-1'
    });

    expect(result.errors).toEqual([]);
    expect(purgeMock.calls[0]).toBe('company-data-manifest-block');
    expect(purgeMock.calls).toContain('local-chat');
    expect(purgeMock.calls).toContain('chat-media');
    expect(purgeMock.calls).toContain('call-store');
    expect(purgeMock.calls).toContain('profile-photo-cache');
    expect(purgeMock.calls.at(-1)).toBe('company-data-manifest-purged');
  });

  it('clears optional recovery key and device identity only when requested', async () => {
    await purgeTenantCompanyData({
      clearBackupRecoveryKey: true,
      clearDeviceIdentity: true,
      ownerUid: 'owner-1',
      reason: 'access-denied',
      tenantId: 'tenant-1'
    });

    expect(purgeMock.calls).toContain('chat-backup-recovery-key');
    expect(purgeMock.calls).toContain('device-identity');
  });
});

describe('purgeTenantCompanyData key destruction', () => {
  it('destroys the account chat key, after clearing the rows it seals', async () => {
    // Deleting rows leaves the ciphertext recoverable; the key's absence is what
    // makes the cache unreadable, and it was never removed at all.
    purgeMock.calls.length = 0;

    await purgeTenantCompanyData({
      ownerUid: 'owner-1',
      reason: 'device-revoked',
      tenantId: 'tenant-1'
    });

    expect(purgeMock.calls).toContain('local-chat-key');
    expect(purgeMock.calls.indexOf('local-chat-key'))
      .toBeGreaterThan(purgeMock.calls.indexOf('local-chat'));
  });
});
