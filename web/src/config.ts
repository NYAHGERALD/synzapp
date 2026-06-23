export const SYNZAPP_HOSTED_API_URL = 'https://synzapp-backend.onrender.com';

export interface FirebaseWebConfig {
  apiKey: string;
  appId: string;
  authDomain: string;
  messagingSenderId: string;
  projectId: string;
  storageBucket: string;
}

export function getSynzappApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_SYNZAPP_API_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  return SYNZAPP_HOSTED_API_URL;
}

export function getFirebaseWebConfig(): FirebaseWebConfig | null {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim() || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim() || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() || ''
  };

  return Object.values(config).every(Boolean) ? config : null;
}

export function getFirebaseAppCheckSiteKey(): string | null {
  return import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY?.trim() || null;
}
