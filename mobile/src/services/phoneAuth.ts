import type { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import {
  getIdToken,
  onAuthStateChanged,
  PhoneAuthProvider,
  signInWithCredential,
  signOut,
  User
} from 'firebase/auth';
import { getFirebaseAuth } from './firebaseConfig';
import { auditBackendLogout, verifyBackendAuthSession } from './backendAuth';
import { FirebasePhoneSession, VerifiedOrgAdmin } from '../types/auth';

type RecaptchaVerifierRef = FirebaseRecaptchaVerifierModal | null;
type VerifiedOrgAdminHandler = (verifiedAdmin: VerifiedOrgAdmin | null) => void;
type AuthErrorHandler = (error: Error) => void;

export async function sendOrgAdminPhoneCode(
  phoneNumber: string,
  recaptchaVerifier: RecaptchaVerifierRef
): Promise<FirebasePhoneSession> {
  if (!recaptchaVerifier) {
    throw new Error('reCAPTCHA verifier is not ready yet.');
  }

  const auth = getFirebaseAuth();
  auth.useDeviceLanguage();

  const provider = new PhoneAuthProvider(auth);
  const verificationId = await provider.verifyPhoneNumber(
    phoneNumber.trim(),
    recaptchaVerifier
  );

  return {
    verificationId,
    phoneNumber: phoneNumber.trim()
  };
}

export async function verifyOrgAdminPhoneCode(
  phoneSession: FirebasePhoneSession,
  code: string
): Promise<VerifiedOrgAdmin> {
  const auth = getFirebaseAuth();
  const credential = PhoneAuthProvider.credential(phoneSession.verificationId, code.trim());
  const credentialResult = await signInWithCredential(auth, credential);

  return getVerifiedOrgAdminFromUser(
    credentialResult.user,
    credentialResult.user.phoneNumber || phoneSession.phoneNumber,
    true,
    'login'
  );
}

export function subscribeToOrgAdminAuthState(
  onChange: VerifiedOrgAdminHandler,
  onError: AuthErrorHandler
) {
  return onAuthStateChanged(
    getFirebaseAuth(),
    (user) => {
      if (!user) {
        onChange(null);
        return;
      }

      void getVerifiedOrgAdminFromUser(user, undefined, false, 'restore').then(onChange).catch(onError);
    },
    onError
  );
}

async function getVerifiedOrgAdminFromUser(
  firebaseUser: User,
  fallbackPhoneNumber?: string,
  forceRefresh = false,
  event: 'login' | 'restore' = 'login'
): Promise<VerifiedOrgAdmin> {
  let idToken = await getIdToken(firebaseUser, forceRefresh);
  const session = await verifyBackendAuthSession(idToken, event);

  if (session.claimsRefreshed) {
    idToken = await getIdToken(firebaseUser, true);
  }

  return {
    firebaseUser,
    idToken,
    phoneNumber: firebaseUser.phoneNumber || fallbackPhoneNumber || '',
    session
  };
}

export async function signOutOrgAdmin(): Promise<void> {
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  if (currentUser) {
    try {
      const idToken = await getIdToken(currentUser);
      await auditBackendLogout(idToken);
    } catch {
      // Local sign-out must still succeed when the audit call cannot reach the backend.
    }
  }

  await signOut(auth);
}
