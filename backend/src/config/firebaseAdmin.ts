import admin from 'firebase-admin';
import { env } from './env.js';

function getCredential() {
  if (env.firebaseServiceAccountJson) {
    const serviceAccount = JSON.parse(env.firebaseServiceAccountJson) as admin.ServiceAccount;
    return admin.credential.cert(serviceAccount);
  }

  return admin.credential.applicationDefault();
}

const app = admin.apps.length
  ? admin.app()
  : admin.initializeApp({
      credential: getCredential(),
      projectId: env.firebaseProjectId,
      storageBucket: env.firebaseStorageBucket
    });

const bucket = admin.storage(app).bucket();
enableSelfSignedJwtForStorage(bucket);

export const adminApp = app;
export const adminAuth = admin.auth(app);
export const adminAppCheck = admin.appCheck(app);
export const firestore = admin.firestore(app);
export const fieldValue = admin.firestore.FieldValue;
export const storageBucket = bucket;
export type FirestoreTimestamp = admin.firestore.Timestamp;

type StorageBucketWithAuth = {
  storage?: {
    authClient?: {
      useJWTAccessWithScope?: boolean;
    };
  };
};

function enableSelfSignedJwtForStorage(storageBucket: unknown): void {
  const authClient = (storageBucket as StorageBucketWithAuth).storage?.authClient;

  if (!authClient) {
    return;
  }

  // Avoid an OAuth token exchange on every fresh Storage credential in hosted
  // runtimes. Service-account JWT access is signed locally with the same key.
  authClient.useJWTAccessWithScope = true;
}
