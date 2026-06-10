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

export const adminApp = app;
export const adminAuth = admin.auth(app);
export const adminAppCheck = admin.appCheck(app);
export const firestore = admin.firestore(app);
export const fieldValue = admin.firestore.FieldValue;
export const storageBucket = admin.storage(app).bucket();
export type FirestoreTimestamp = admin.firestore.Timestamp;
