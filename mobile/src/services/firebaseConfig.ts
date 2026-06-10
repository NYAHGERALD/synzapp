import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';

export const missingFirebaseConfig: string[] = [];
export const isFirebaseConfigured = true;

export function getFirebaseAuth() {
  getApp();

  return getAuth();
}
