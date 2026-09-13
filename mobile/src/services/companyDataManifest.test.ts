import { beforeEach, describe, expect, it, vi } from 'vitest';

const secureStoreMock = vi.hoisted(() => ({
  values: new Map<string, string>()
}));

vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  deleteItemAsync: vi.fn(async (key: string) => {
    secureStoreMock.values.delete(key);
  }),
  getItemAsync: vi.fn(async (key: string) => secureStoreMock.values.get(key) || null),
  isAvailableAsync: vi.fn(async () => true),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    secureStoreMock.values.set(key, value);
  })
}));

import {
  blockCompanyDataScope,
  getCompanyDataManifest,
  isCompanyDataScopeBlocked,
  markCompanyDataScopeActive,
  markCompanyDataScopePurged
} from './companyDataManifest';

const scope = {
  ownerUid: 'owner-1',
  tenantId: 'tenant-1'
};

describe('companyDataManifest', () => {
  beforeEach(() => {
    secureStoreMock.values.clear();
  });

  it('marks a scope active and renderable', async () => {
    await markCompanyDataScopeActive(scope);

    await expect(isCompanyDataScopeBlocked(scope)).resolves.toBe(false);
    await expect(getCompanyDataManifest(scope)).resolves.toMatchObject({
      ownerUid: scope.ownerUid,
      status: 'active',
      tenantId: scope.tenantId,
      version: 1
    });
  });

  it('blocks a scope before company data can render', async () => {
    await blockCompanyDataScope({
      ...scope,
      reason: 'access-denied'
    });

    await expect(isCompanyDataScopeBlocked(scope)).resolves.toBe(true);
    await expect(getCompanyDataManifest(scope)).resolves.toMatchObject({
      reason: 'access-denied',
      status: 'blocked'
    });
  });

  it('keeps the device locked out after a wipe the company ordered', async () => {
    await markCompanyDataScopePurged({
      ...scope,
      purgedAt: '2026-08-26T12:00:00.000Z',
      reason: 'remote-wipe'
    });

    await expect(isCompanyDataScopeBlocked(scope)).resolves.toBe(true);
  });

  it('lets the person back in after an ordinary sign-out', async () => {
    // Wiping local data at sign-out is on by default. Treating that wipe as a
    // lockout refused every later sign-in on this device, whatever the server
    // said, and nothing on the server could clear it.
    await markCompanyDataScopePurged({
      ...scope,
      purgedAt: '2026-08-26T12:00:00.000Z',
      reason: 'sign-out'
    });

    await expect(isCompanyDataScopeBlocked(scope)).resolves.toBe(false);
  });

  it('lets a confirmed session clear a block the device set on itself', async () => {
    // Once a device refused someone, it wrote a block and then kept refusing
    // them, and nothing on the server could undo it. The server decides who has
    // access, so a session it confirms has to be able to clear this.
    await blockCompanyDataScope({ ...scope, reason: 'access-denied' });
    await expect(isCompanyDataScopeBlocked(scope)).resolves.toBe(true);

    await markCompanyDataScopeActive(scope);

    await expect(isCompanyDataScopeBlocked(scope)).resolves.toBe(false);
  });

  it('clears a block left by a wipe once the person signs in again', async () => {
    await markCompanyDataScopePurged({
      ...scope,
      purgedAt: '2026-08-26T12:00:00.000Z',
      reason: 'remote-wipe'
    });
    await expect(isCompanyDataScopeBlocked(scope)).resolves.toBe(true);

    await markCompanyDataScopeActive(scope);

    await expect(isCompanyDataScopeBlocked(scope)).resolves.toBe(false);
  });

  it('keeps one person\'s block off another person on the same phone', async () => {
    await blockCompanyDataScope({ ...scope, reason: 'employee-removed' });

    await expect(
      isCompanyDataScopeBlocked({ ownerUid: 'owner-2', tenantId: scope.tenantId })
    ).resolves.toBe(false);
  });

  it('records purge completion and step errors', async () => {
    await markCompanyDataScopePurged({
      ...scope,
      errors: [{ message: 'cleanup failed', step: 'chat-media' }],
      purgedAt: '2026-08-26T12:00:00.000Z',
      reason: 'remote-wipe'
    });

    await expect(getCompanyDataManifest(scope)).resolves.toMatchObject({
      lastPurgeAt: '2026-08-26T12:00:00.000Z',
      lastPurgeErrors: [{ message: 'cleanup failed', step: 'chat-media' }],
      reason: 'remote-wipe',
      status: 'purged'
    });
  });
});

describe('a phone that had chat moved away, signing in again', () => {
  it('is blocked while the revocation purge stands', async () => {
    // This is what a returning phone carries: chat moved away, it purged itself
    // with reason device-revoked, and that counts as a standing block.
    await markCompanyDataScopePurged({
      ...scope,
      purgedAt: new Date().toISOString(),
      reason: 'device-revoked'
    });

    expect(await isCompanyDataScopeBlocked(scope)).toBe(true);
  });

  it('is let back in once the scope is marked active again', async () => {
    // The server authorising the device is what clears it. Marking active has to
    // use the same scope the check reads, or the mark lands under one key and
    // the check reads another — which is how the session ended seconds after
    // the chats were restored.
    await markCompanyDataScopePurged({
      ...scope,
      purgedAt: new Date().toISOString(),
      reason: 'device-revoked'
    });
    await markCompanyDataScopeActive(scope);

    expect(await isCompanyDataScopeBlocked(scope)).toBe(false);
  });

  it('does not clear a block recorded for a different tenant', async () => {
    // The mismatch that caused this, pinned: clearing one scope must not be
    // mistaken for clearing another.
    await markCompanyDataScopePurged({
      ...scope,
      purgedAt: new Date().toISOString(),
      reason: 'device-revoked'
    });
    await markCompanyDataScopeActive({ ownerUid: scope.ownerUid, tenantId: 'tenant-elsewhere' });

    expect(await isCompanyDataScopeBlocked(scope)).toBe(true);
  });

  it('leaves an ordinary sign-out unblocked', async () => {
    await markCompanyDataScopePurged({
      ...scope,
      purgedAt: new Date().toISOString(),
      reason: 'sign-out'
    });

    expect(await isCompanyDataScopeBlocked(scope)).toBe(false);
  });
});
