import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken, type AppCheck } from 'firebase/app-check';
import { browserLocalPersistence, getAuth, setPersistence, type Auth } from 'firebase/auth';
import {
  getFirebaseAppCheckSiteKey,
  getFirebaseWebConfig
} from './config';

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseAuthPersistencePromise: Promise<void> | null = null;
let firebaseAppCheck: AppCheck | null = null;

export function isFirebaseConfigured(): boolean {
  return Boolean(getFirebaseWebConfig());
}

export function getSynzappFirebaseAuth(): Auth {
  if (firebaseAuth) {
    return firebaseAuth;
  }

  const app = getSynzappFirebaseApp();
  firebaseAuth = getAuth(app);
  firebaseAuthPersistencePromise = setPersistence(firebaseAuth, browserLocalPersistence);

  return firebaseAuth;
}

export async function ensureSynzappAuthPersistence(): Promise<void> {
  getSynzappFirebaseAuth();
  await firebaseAuthPersistencePromise;
}

export async function getAppCheckHeader(): Promise<Record<string, string>> {
  const appCheck = getSynzappFirebaseAppCheck();

  if (!appCheck) {
    return {};
  }

  const token = await getToken(appCheck, false);

  return token.token ? { 'X-Firebase-AppCheck': token.token } : {};
}

function getSynzappFirebaseApp(): FirebaseApp {
  if (firebaseApp) {
    return firebaseApp;
  }

  const config = getFirebaseWebConfig();

  if (!config) {
    throw new Error('Firebase web configuration is missing.');
  }

  firebaseApp = initializeApp(config);

  return firebaseApp;
}

function getSynzappFirebaseAppCheck(): AppCheck | null {
  if (firebaseAppCheck) {
    return firebaseAppCheck;
  }

  const siteKey = getFirebaseAppCheckSiteKey();

  if (!siteKey) {
    return null;
  }

  firebaseAppCheck = initializeAppCheck(getSynzappFirebaseApp(), {
    isTokenAutoRefreshEnabled: true,
    provider: new ReCaptchaEnterpriseProvider(siteKey)
  });

  return firebaseAppCheck;
}
