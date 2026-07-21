import Constants from 'expo-constants';
import { Platform } from 'react-native';

const SYNZAPP_HOSTED_API_URL = 'https://synzapp-backend.onrender.com';
const LOCAL_API_FLAG_VALUES = new Set(['1', 'true', 'yes', 'local']);

interface ExpoHostConfig {
  debuggerHost?: string;
  expoConfig?: {
    hostUri?: string;
  };
  manifest?: {
    debuggerHost?: string;
    hostUri?: string;
  };
  manifest2?: {
    extra?: {
      expoClient?: {
        hostUri?: string;
      };
    };
  };
}

export function getSynzappApiBaseUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_SYNZAPP_API_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  if (!shouldUseLocalDevelopmentApi()) {
    return SYNZAPP_HOSTED_API_URL;
  }

  const constants = Constants as ExpoHostConfig;
  const hostUri = constants.expoConfig?.hostUri ||
    constants.manifest2?.extra?.expoClient?.hostUri ||
    constants.manifest?.hostUri ||
    constants.manifest?.debuggerHost ||
    constants.debuggerHost;
  const host = getHostFromExpoUri(hostUri);

  if (host) {
    return `http://${host}:4100`;
  }

  if (__DEV__) {
    return Platform.OS === 'android'
      ? 'http://10.0.2.2:4100'
      : 'http://localhost:4100';
  }

  return SYNZAPP_HOSTED_API_URL;
}

function shouldUseLocalDevelopmentApi(): boolean {
  if (!__DEV__) {
    return false;
  }

  const flag = process.env.EXPO_PUBLIC_SYNZAPP_USE_LOCAL_API?.trim().toLowerCase();

  return Boolean(flag && LOCAL_API_FLAG_VALUES.has(flag));
}

function getHostFromExpoUri(hostUri: string | undefined): string {
  if (!hostUri) {
    return '';
  }

  const normalizedHostUri = hostUri.includes('://') ? hostUri : `http://${hostUri}`;

  try {
    return new URL(normalizedHostUri).hostname;
  } catch {
    return hostUri.split(':')[0] || '';
  }
}

export function normalizeSynzappApiUrl(pathOrUrl: string | null): string | null {
  if (!pathOrUrl) {
    return null;
  }

  if (/^https?:\/\//i.test(pathOrUrl) || pathOrUrl.startsWith('file:')) {
    return pathOrUrl;
  }

  const normalizedPath = pathOrUrl.startsWith('/')
    ? pathOrUrl
    : `/${pathOrUrl}`;

  return `${getSynzappApiBaseUrl()}${normalizedPath}`;
}

export function getSynzappRealtimeUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const apiBaseUrl = getSynzappApiBaseUrl();
  const realtimeBaseUrl = apiBaseUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');

  return `${realtimeBaseUrl}${normalizedPath}`;
}
