import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ChatOfflinePolicyScope {
  ownerUid: string;
  tenantId: string;
}

export interface ChatOfflinePolicySettings {
  cacheRetentionDays: number;
  fullMediaCacheBudgetBytes: number;
  mediaLimitBytes: ChatMediaLimitBytes;
  offlineMediaCacheAllowed: boolean;
  purgeOnSignOut: boolean;
  updatedAt: string;
  version: 1;
  wifiOnlyMediaPrefetch: boolean;
}

export interface ChatMediaLimitBytes {
  audio: number;
  file: number;
  image: number;
  video: number;
}

const CHAT_OFFLINE_SETTINGS_KEY_PREFIX = 'synzapp:chat-offline-settings:v1:';
const MIN_MEDIA_CACHE_BUDGET_BYTES = 256 * 1024 * 1024;
const MAX_MEDIA_CACHE_BUDGET_BYTES = 5 * 1024 * 1024 * 1024;
const MIN_CACHE_RETENTION_DAYS = 1;
const MAX_CACHE_RETENTION_DAYS = 365;
const MIN_MEDIA_LIMIT_BYTES = 1024 * 1024;
const MAX_MEDIA_LIMIT_BYTES: ChatMediaLimitBytes = {
  audio: 64 * 1024 * 1024,
  file: 500 * 1024 * 1024,
  image: 250 * 1024 * 1024,
  video: 1024 * 1024 * 1024
};

export const DEFAULT_CHAT_OFFLINE_POLICY_SETTINGS: ChatOfflinePolicySettings = {
  cacheRetentionDays: 30,
  fullMediaCacheBudgetBytes: 2 * 1024 * 1024 * 1024,
  mediaLimitBytes: {
    audio: 16 * 1024 * 1024,
    file: 100 * 1024 * 1024,
    image: 100 * 1024 * 1024,
    video: 250 * 1024 * 1024
  },
  offlineMediaCacheAllowed: true,
  purgeOnSignOut: true,
  updatedAt: '',
  version: 1,
  wifiOnlyMediaPrefetch: false
};

export async function loadChatOfflinePolicySettings(
  scope: ChatOfflinePolicyScope | null | undefined
): Promise<ChatOfflinePolicySettings> {
  if (!isValidScope(scope)) {
    return buildDefaultSettings();
  }

  const storedValue = await AsyncStorage.getItem(getChatOfflineSettingsKey(scope)).catch(() => null);
  if (!storedValue) {
    return buildDefaultSettings();
  }

  try {
    return normalizeChatOfflinePolicySettings(JSON.parse(storedValue));
  } catch {
    return buildDefaultSettings();
  }
}

export async function saveChatOfflinePolicySettings(
  scope: ChatOfflinePolicyScope,
  patch: Partial<Omit<ChatOfflinePolicySettings, 'updatedAt' | 'version'>>
): Promise<ChatOfflinePolicySettings> {
  if (!isValidScope(scope)) {
    throw new Error('Cannot save offline chat settings without a company data scope.');
  }

  const currentSettings = await loadChatOfflinePolicySettings(scope);
  const nextSettings = normalizeChatOfflinePolicySettings({
    ...currentSettings,
    ...patch,
    updatedAt: new Date().toISOString(),
    version: 1
  });

  await AsyncStorage.setItem(getChatOfflineSettingsKey(scope), JSON.stringify(nextSettings));

  return nextSettings;
}

export function normalizeChatOfflinePolicySettings(input: Partial<ChatOfflinePolicySettings> | null | undefined): ChatOfflinePolicySettings {
  const defaultSettings = buildDefaultSettings();
  const rawBudgetBytes = Number(input?.fullMediaCacheBudgetBytes);
  const rawRetentionDays = Number(input?.cacheRetentionDays);

  return {
    cacheRetentionDays: clampInteger(rawRetentionDays, MIN_CACHE_RETENTION_DAYS, MAX_CACHE_RETENTION_DAYS, defaultSettings.cacheRetentionDays),
    fullMediaCacheBudgetBytes: clampInteger(rawBudgetBytes, MIN_MEDIA_CACHE_BUDGET_BYTES, MAX_MEDIA_CACHE_BUDGET_BYTES, defaultSettings.fullMediaCacheBudgetBytes),
    mediaLimitBytes: normalizeMediaLimitBytes(input?.mediaLimitBytes, defaultSettings.mediaLimitBytes),
    offlineMediaCacheAllowed: typeof input?.offlineMediaCacheAllowed === 'boolean'
      ? input.offlineMediaCacheAllowed
      : defaultSettings.offlineMediaCacheAllowed,
    purgeOnSignOut: typeof input?.purgeOnSignOut === 'boolean'
      ? input.purgeOnSignOut
      : defaultSettings.purgeOnSignOut,
    updatedAt: typeof input?.updatedAt === 'string' ? input.updatedAt : defaultSettings.updatedAt,
    version: 1,
    wifiOnlyMediaPrefetch: typeof input?.wifiOnlyMediaPrefetch === 'boolean'
      ? input.wifiOnlyMediaPrefetch
      : defaultSettings.wifiOnlyMediaPrefetch
  };
}

function normalizeMediaLimitBytes(
  input: Partial<ChatMediaLimitBytes> | null | undefined,
  fallback: ChatMediaLimitBytes
): ChatMediaLimitBytes {
  return {
    audio: clampInteger(Number(input?.audio), MIN_MEDIA_LIMIT_BYTES, MAX_MEDIA_LIMIT_BYTES.audio, fallback.audio),
    file: clampInteger(Number(input?.file), MIN_MEDIA_LIMIT_BYTES, MAX_MEDIA_LIMIT_BYTES.file, fallback.file),
    image: clampInteger(Number(input?.image), MIN_MEDIA_LIMIT_BYTES, MAX_MEDIA_LIMIT_BYTES.image, fallback.image),
    video: clampInteger(Number(input?.video), MIN_MEDIA_LIMIT_BYTES, MAX_MEDIA_LIMIT_BYTES.video, fallback.video)
  };
}

function buildDefaultSettings(): ChatOfflinePolicySettings {
  return {
    ...DEFAULT_CHAT_OFFLINE_POLICY_SETTINGS
  };
}

function getChatOfflineSettingsKey(scope: ChatOfflinePolicyScope): string {
  return `${CHAT_OFFLINE_SETTINGS_KEY_PREFIX}${sanitizeScopeSegment(scope.ownerUid)}:${sanitizeScopeSegment(scope.tenantId)}`;
}

function isValidScope(scope: ChatOfflinePolicyScope | null | undefined): scope is ChatOfflinePolicyScope {
  return Boolean(scope?.ownerUid && scope.tenantId);
}

function clampInteger(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.round(value), min), max);
}

function sanitizeScopeSegment(value: string): string {
  return encodeURIComponent(value.trim());
}
