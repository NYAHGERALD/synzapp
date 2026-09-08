import { beforeEach, describe, expect, it, vi } from 'vitest';

const asyncStorageMock = vi.hoisted(() => ({
  values: new Map<string, string>()
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => asyncStorageMock.values.get(key) || null),
    setItem: vi.fn(async (key: string, value: string) => {
      asyncStorageMock.values.set(key, value);
    })
  }
}));

import {
  DEFAULT_CHAT_OFFLINE_POLICY_SETTINGS,
  loadChatOfflinePolicySettings,
  normalizeChatOfflinePolicySettings,
  saveChatOfflinePolicySettings
} from './chatOfflineSettings';

const scope = {
  ownerUid: 'owner-1',
  tenantId: 'tenant-1'
};

describe('chatOfflineSettings', () => {
  beforeEach(() => {
    asyncStorageMock.values.clear();
  });

  it('returns defaults for a new company scope', async () => {
    await expect(loadChatOfflinePolicySettings(scope)).resolves.toMatchObject({
      offlineMediaCacheAllowed: true,
      purgeOnSignOut: true,
      version: 1
    });
  });

  it('saves scoped policy updates without changing other defaults', async () => {
    const settings = await saveChatOfflinePolicySettings(scope, {
      cacheRetentionDays: 90,
      offlineMediaCacheAllowed: false,
      wifiOnlyMediaPrefetch: true
    });

    expect(settings).toMatchObject({
      cacheRetentionDays: 90,
      fullMediaCacheBudgetBytes: DEFAULT_CHAT_OFFLINE_POLICY_SETTINGS.fullMediaCacheBudgetBytes,
      mediaLimitBytes: DEFAULT_CHAT_OFFLINE_POLICY_SETTINGS.mediaLimitBytes,
      offlineMediaCacheAllowed: false,
      wifiOnlyMediaPrefetch: true
    });
    await expect(loadChatOfflinePolicySettings(scope)).resolves.toMatchObject(settings);
  });

  it('clamps budget and retention values to enterprise-safe bounds', () => {
    expect(normalizeChatOfflinePolicySettings({
      cacheRetentionDays: 999,
      fullMediaCacheBudgetBytes: 12 * 1024 * 1024 * 1024,
      mediaLimitBytes: {
        audio: 512,
        file: 900 * 1024 * 1024,
        image: 400 * 1024 * 1024,
        video: 2 * 1024 * 1024 * 1024
      }
    })).toMatchObject({
      cacheRetentionDays: 365,
      fullMediaCacheBudgetBytes: 5 * 1024 * 1024 * 1024,
      mediaLimitBytes: {
        audio: 1024 * 1024,
        file: 500 * 1024 * 1024,
        image: 250 * 1024 * 1024,
        video: 1024 * 1024 * 1024
      }
    });
  });
});
