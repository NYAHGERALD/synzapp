import {
  FirebaseAuthTypes,
  onAuthStateChanged,
  reauthenticateWithPhoneNumber,
  signInWithPhoneNumber,
  signOut
} from '@react-native-firebase/auth';
import { getFirebaseAuth } from './firebaseConfig';
import { auditBackendLogout, verifyBackendAuthSession } from './backendAuth';
import { FirebasePhoneSession, VerifiedOrgAdmin } from '../types/auth';

type VerifiedOrgAdminHandler = (verifiedAdmin: VerifiedOrgAdmin | null) => void;
type AuthErrorHandler = (error: Error) => void;

export async function sendOrgAdminPhoneCode(phoneNumber: string): Promise<FirebasePhoneSession> {
  const auth = getFirebaseAuth();
  const confirmation = await signInWithPhoneNumber(auth, phoneNumber.trim());

  return {
    confirmation,
    phoneNumber: phoneNumber.trim()
  };
}

export async function verifyOrgAdminPhoneCode(
  phoneSession: FirebasePhoneSession,
  code: string
): Promise<VerifiedOrgAdmin> {
  const auth = getFirebaseAuth();
  const credentialResult = await phoneSession.confirmation.confirm(code.trim());
  const user = credentialResult?.user || auth.currentUser;

  if (!user) {
    throw new Error('Unable to verify this phone session.');
  }

  return getVerifiedOrgAdminFromUser(
    user,
    user.phoneNumber || phoneSession.phoneNumber,
    true,
    'login'
  );
}

export async function sendReauthenticationPhoneCode(
  user: FirebaseAuthTypes.User,
  phoneNumber: string
): Promise<FirebaseAuthTypes.ConfirmationResult> {
  const safePhoneNumber = (user.phoneNumber || phoneNumber).trim();

  if (!safePhoneNumber) {
    throw new Error('A verified phone number is required.');
  }

  return reauthenticateWithPhoneNumber(user, safePhoneNumber);
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
    }
  );
}

async function getVerifiedOrgAdminFromUser(
  firebaseUser: FirebaseAuthTypes.User,
  fallbackPhoneNumber?: string,
  forceRefresh = false,
  event: 'login' | 'restore' = 'login'
): Promise<VerifiedOrgAdmin> {
  let idToken = await firebaseUser.getIdToken(forceRefresh);
  const session = await verifyBackendAuthSession(idToken, event);

  if (session.claimsRefreshed) {
    idToken = await firebaseUser.getIdToken(true);
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
      const idToken = await currentUser.getIdToken();
      await auditBackendLogout(idToken);
    } catch {
      // Local sign-out must still succeed when the audit call cannot reach the backend.
    }
  }

  await signOut(auth);
}
