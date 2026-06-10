import Constants from 'expo-constants';

interface ExpoHostConfig {
  expoConfig?: {
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

  const constants = Constants as ExpoHostConfig;
  const hostUri = constants.expoConfig?.hostUri || constants.manifest2?.extra?.expoClient?.hostUri;
  const host = hostUri?.split(':')[0];

  if (host) {
    return `http://${host}:4100`;
  }

  return 'http://localhost:4100';
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
