import {
  FirebaseAuthTypes,
  onAuthStateChanged,
  signInWithPhoneNumber,
  signOut
} from '@react-native-firebase/auth';
import { getFirebaseAuth } from './firebaseConfig';
import { auditBackendLogout, verifyBackendAuthSession } from './backendAuth';
import { markCompanyDataScopeActive } from './companyDataManifest';
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
  const auth = getFirebaseAuth();
  const safePhoneNumber = (user.phoneNumber || phoneNumber).trim();

  if (!safePhoneNumber) {
    throw new Error('A verified phone number is required.');
  }

  return signInWithPhoneNumber(auth, safePhoneNumber);
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

  // The server decides who has access, so a confirmed ACTIVE session clears any
  // stale local block for that same person and organization.
  //
  // Without this the phone could refuse a person the server had just admitted,
  // and nothing on the server could undo it. It happens here rather than in a
  // screen effect because React runs a child's effects before its parent's: the
  // chat screen was asking "is this scope blocked?" before anything had had the
  // chance to record that the session was good.
  if (session.access === 'ACTIVE' && session.user.uid && session.user.tenantId) {
    await markCompanyDataScopeActive({
      ownerUid: session.user.uid,
      tenantId: session.user.tenantId
    }).catch(() => undefined);
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
