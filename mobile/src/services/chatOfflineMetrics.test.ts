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
  incrementChatOfflineCounterMetric,
  loadChatOfflineMetrics,
  recordChatOfflineMediaTransferMetric,
  recordChatOfflineTimingMetric,
  resetChatOfflineMetrics,
  updateChatOfflineGaugeMetrics
} from './chatOfflineMetrics';

const scope = {
  ownerUid: 'owner-1',
  tenantId: 'tenant-1'
};

describe('chatOfflineMetrics', () => {
  beforeEach(() => {
    asyncStorageMock.values.clear();
  });

  it('records timing samples, counters, and gauges for a company scope', async () => {
    await recordChatOfflineTimingMetric(scope, 'chatOpenCacheLoadMs', 22.7);
    await incrementChatOfflineCounterMetric(scope, 'uploadFailureCount');
    await recordChatOfflineMediaTransferMetric(scope, {
      sizeBytes: 32 * 1024 * 1024,
      transferType: 'upload'
    });
    await recordChatOfflineMediaTransferMetric(scope, {
      sizeBytes: 512 * 1024,
      transferType: 'download'
    });
    await updateChatOfflineGaugeMetrics(scope, {
      cacheSizeBytes: 1234,
      mediaQueueDepth: 3
    });

    await expect(loadChatOfflineMetrics(scope)).resolves.toMatchObject({
      cacheSizeBytes: 1234,
      chatOpenCacheLoadMs: [23],
      downloadBytesTotal: 512 * 1024,
      mediaQueueDepth: 3,
      uploadBytesTotal: 32 * 1024 * 1024,
      uploadFailureCount: 1
    });
    await expect(loadChatOfflineMetrics(scope)).resolves.toMatchObject({
      downloadLargeMediaCount: 0,
      uploadLargeMediaCount: 1
    });
  });

  it('keeps timing samples bounded', async () => {
    for (let index = 0; index < 55; index += 1) {
      await recordChatOfflineTimingMetric(scope, 'sqliteQueryMs', index);
    }

    const metrics = await loadChatOfflineMetrics(scope);

    expect(metrics.sqliteQueryMs).toHaveLength(50);
    expect(metrics.sqliteQueryMs[0]).toBe(5);
    expect(metrics.sqliteQueryMs[49]).toBe(54);
  });

  it('resets local metrics', async () => {
    await incrementChatOfflineCounterMetric(scope, 'purgeFailureCount');
    const metrics = await resetChatOfflineMetrics(scope);

    expect(metrics.purgeFailureCount).toBe(0);
    await expect(loadChatOfflineMetrics(scope)).resolves.toMatchObject({
      purgeFailureCount: 0,
      version: 1
    });
  });
});
