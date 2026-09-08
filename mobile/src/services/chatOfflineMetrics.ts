import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ChatOfflineMetricsScope {
  ownerUid: string;
  tenantId: string;
}

export interface ChatOfflineMetricsSnapshot {
  cacheSizeBytes: number;
  chatListCacheLoadMs: number[];
  chatOpenCacheLoadMs: number[];
  downloadBytesTotal: number;
  downloadFailureCount: number;
  downloadLargeMediaCount: number;
  downloadSuccessCount: number;
  mediaQueueDepth: number;
  purgeFailureCount: number;
  purgeSuccessCount: number;
  sqliteQueryMs: number[];
  updatedAt: string;
  uploadBytesTotal: number;
  uploadFailureCount: number;
  uploadLargeMediaCount: number;
  uploadSuccessCount: number;
  version: 1;
}

export type ChatOfflineTimingMetric =
  | 'chatListCacheLoadMs'
  | 'chatOpenCacheLoadMs'
  | 'sqliteQueryMs';

export type ChatOfflineCounterMetric =
  | 'downloadFailureCount'
  | 'downloadSuccessCount'
  | 'purgeFailureCount'
  | 'purgeSuccessCount'
  | 'uploadFailureCount'
  | 'uploadSuccessCount';

const CHAT_OFFLINE_METRICS_KEY_PREFIX = 'synzapp:chat-offline-metrics:v1:';
const MAX_TIMING_SAMPLES = 50;

export function createEmptyChatOfflineMetricsSnapshot(): ChatOfflineMetricsSnapshot {
  return {
    cacheSizeBytes: 0,
    chatListCacheLoadMs: [],
    chatOpenCacheLoadMs: [],
    downloadBytesTotal: 0,
    downloadFailureCount: 0,
    downloadLargeMediaCount: 0,
    downloadSuccessCount: 0,
    mediaQueueDepth: 0,
    purgeFailureCount: 0,
    purgeSuccessCount: 0,
    sqliteQueryMs: [],
    updatedAt: '',
    uploadBytesTotal: 0,
    uploadFailureCount: 0,
    uploadLargeMediaCount: 0,
    uploadSuccessCount: 0,
    version: 1
  };
}

export async function loadChatOfflineMetrics(
  scope: ChatOfflineMetricsScope | null | undefined
): Promise<ChatOfflineMetricsSnapshot> {
  if (!isValidScope(scope)) {
    return createEmptyChatOfflineMetricsSnapshot();
  }

  const storedValue = await AsyncStorage.getItem(getChatOfflineMetricsKey(scope)).catch(() => null);
  if (!storedValue) {
    return createEmptyChatOfflineMetricsSnapshot();
  }

  try {
    return normalizeChatOfflineMetricsSnapshot(JSON.parse(storedValue));
  } catch {
    return createEmptyChatOfflineMetricsSnapshot();
  }
}

export async function recordChatOfflineTimingMetric(
  scope: ChatOfflineMetricsScope | null | undefined,
  metric: ChatOfflineTimingMetric,
  durationMs: number
): Promise<ChatOfflineMetricsSnapshot> {
  if (!isValidScope(scope) || !Number.isFinite(durationMs)) {
    return loadChatOfflineMetrics(scope);
  }

  return updateChatOfflineMetrics(scope, (snapshot) => ({
    ...snapshot,
    [metric]: [...snapshot[metric], Math.max(0, Math.round(durationMs))].slice(-MAX_TIMING_SAMPLES)
  }));
}

export async function incrementChatOfflineCounterMetric(
  scope: ChatOfflineMetricsScope | null | undefined,
  metric: ChatOfflineCounterMetric
): Promise<ChatOfflineMetricsSnapshot> {
  if (!isValidScope(scope)) {
    return loadChatOfflineMetrics(scope);
  }

  return updateChatOfflineMetrics(scope, (snapshot) => ({
    ...snapshot,
    [metric]: Math.max(0, snapshot[metric] + 1)
  }));
}

export async function updateChatOfflineGaugeMetrics(
  scope: ChatOfflineMetricsScope | null | undefined,
  gauges: Partial<Pick<ChatOfflineMetricsSnapshot, 'cacheSizeBytes' | 'mediaQueueDepth'>>
): Promise<ChatOfflineMetricsSnapshot> {
  if (!isValidScope(scope)) {
    return loadChatOfflineMetrics(scope);
  }

  return updateChatOfflineMetrics(scope, (snapshot) => ({
    ...snapshot,
    cacheSizeBytes: clampGauge(gauges.cacheSizeBytes, snapshot.cacheSizeBytes),
    mediaQueueDepth: clampGauge(gauges.mediaQueueDepth, snapshot.mediaQueueDepth)
  }));
}

export async function recordChatOfflineMediaTransferMetric(
  scope: ChatOfflineMetricsScope | null | undefined,
  input: {
    sizeBytes?: number;
    transferType: 'download' | 'upload';
  }
): Promise<ChatOfflineMetricsSnapshot> {
  if (!isValidScope(scope)) {
    return loadChatOfflineMetrics(scope);
  }

  const safeSizeBytes = typeof input.sizeBytes === 'number' && Number.isFinite(input.sizeBytes)
    ? Math.max(0, Math.round(input.sizeBytes))
    : 0;
  const isLargeMedia = safeSizeBytes >= 20 * 1024 * 1024;

  return updateChatOfflineMetrics(scope, (snapshot) => input.transferType === 'upload'
    ? {
        ...snapshot,
        uploadBytesTotal: snapshot.uploadBytesTotal + safeSizeBytes,
        uploadLargeMediaCount: snapshot.uploadLargeMediaCount + (isLargeMedia ? 1 : 0)
      }
    : {
        ...snapshot,
        downloadBytesTotal: snapshot.downloadBytesTotal + safeSizeBytes,
        downloadLargeMediaCount: snapshot.downloadLargeMediaCount + (isLargeMedia ? 1 : 0)
      });
}

export async function resetChatOfflineMetrics(
  scope: ChatOfflineMetricsScope
): Promise<ChatOfflineMetricsSnapshot> {
  if (!isValidScope(scope)) {
    throw new Error('Cannot reset offline chat metrics without a company data scope.');
  }

  const snapshot = {
    ...createEmptyChatOfflineMetricsSnapshot(),
    updatedAt: new Date().toISOString()
  };

  await AsyncStorage.setItem(getChatOfflineMetricsKey(scope), JSON.stringify(snapshot));

  return snapshot;
}

function normalizeChatOfflineMetricsSnapshot(input: Partial<ChatOfflineMetricsSnapshot> | null | undefined): ChatOfflineMetricsSnapshot {
  const empty = createEmptyChatOfflineMetricsSnapshot();

  return {
    cacheSizeBytes: clampGauge(input?.cacheSizeBytes, empty.cacheSizeBytes),
    chatListCacheLoadMs: normalizeTimingSamples(input?.chatListCacheLoadMs),
    chatOpenCacheLoadMs: normalizeTimingSamples(input?.chatOpenCacheLoadMs),
    downloadBytesTotal: clampGauge(input?.downloadBytesTotal, empty.downloadBytesTotal),
    downloadFailureCount: clampGauge(input?.downloadFailureCount, empty.downloadFailureCount),
    downloadLargeMediaCount: clampGauge(input?.downloadLargeMediaCount, empty.downloadLargeMediaCount),
    downloadSuccessCount: clampGauge(input?.downloadSuccessCount, empty.downloadSuccessCount),
    mediaQueueDepth: clampGauge(input?.mediaQueueDepth, empty.mediaQueueDepth),
    purgeFailureCount: clampGauge(input?.purgeFailureCount, empty.purgeFailureCount),
    purgeSuccessCount: clampGauge(input?.purgeSuccessCount, empty.purgeSuccessCount),
    sqliteQueryMs: normalizeTimingSamples(input?.sqliteQueryMs),
    updatedAt: typeof input?.updatedAt === 'string' ? input.updatedAt : empty.updatedAt,
    uploadBytesTotal: clampGauge(input?.uploadBytesTotal, empty.uploadBytesTotal),
    uploadFailureCount: clampGauge(input?.uploadFailureCount, empty.uploadFailureCount),
    uploadLargeMediaCount: clampGauge(input?.uploadLargeMediaCount, empty.uploadLargeMediaCount),
    uploadSuccessCount: clampGauge(input?.uploadSuccessCount, empty.uploadSuccessCount),
    version: 1
  };
}

async function updateChatOfflineMetrics(
  scope: ChatOfflineMetricsScope,
  update: (snapshot: ChatOfflineMetricsSnapshot) => ChatOfflineMetricsSnapshot
): Promise<ChatOfflineMetricsSnapshot> {
  const currentSnapshot = await loadChatOfflineMetrics(scope);
  const nextSnapshot = normalizeChatOfflineMetricsSnapshot({
    ...update(currentSnapshot),
    updatedAt: new Date().toISOString(),
    version: 1
  });

  await AsyncStorage.setItem(getChatOfflineMetricsKey(scope), JSON.stringify(nextSnapshot));

  return nextSnapshot;
}

function normalizeTimingSamples(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((sample): sample is number => typeof sample === 'number' && Number.isFinite(sample))
    .map((sample) => Math.max(0, Math.round(sample)))
    .slice(-MAX_TIMING_SAMPLES);
}

function clampGauge(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : fallback;
}

function getChatOfflineMetricsKey(scope: ChatOfflineMetricsScope): string {
  return `${CHAT_OFFLINE_METRICS_KEY_PREFIX}${sanitizeScopeSegment(scope.ownerUid)}:${sanitizeScopeSegment(scope.tenantId)}`;
}

function isValidScope(scope: ChatOfflineMetricsScope | null | undefined): scope is ChatOfflineMetricsScope {
  return Boolean(scope?.ownerUid && scope.tenantId);
}

function sanitizeScopeSegment(value: string): string {
  return encodeURIComponent(value.trim());
}
