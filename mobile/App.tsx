import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AdminChatScreen } from './src/screens/AdminChatScreen';
import { EmployeeOnboardingScreen } from './src/screens/EmployeeOnboardingScreen';
import { OrgAdminCodeScreen } from './src/screens/OrgAdminCodeScreen';
import { OrgAdminOnboardingScreen } from './src/screens/OrgAdminOnboardingScreen';
import { OrgAdminPhoneScreen } from './src/screens/OrgAdminPhoneScreen';
import { ProfileRoleSelectionScreen } from './src/screens/ProfileRoleSelectionScreen';
import { firebaseConfig, isFirebaseConfigured } from './src/services/firebaseConfig';
import { getUserAuthMessage } from './src/services/authErrors';
import {
  ACCESS_DENIED_MESSAGE,
  isAccessDeniedError
} from './src/services/backendAuth';
import { clearRegisteredDeviceIdentityCache } from './src/services/deviceIdentity';
import { signOutOrgAdmin, subscribeToOrgAdminAuthState } from './src/services/phoneAuth';
import {
  AuthStep,
  BackendAuthSession,
  FirebasePhoneSession,
  ProfileRoleSelection,
  VerifiedOrgAdmin
} from './src/types/auth';
import { colors } from './src/theme/colors';

const CENTER_RECAPTCHA_SCRIPT = `
  (function() {
    var style = document.createElement('style');
    style.innerHTML = [
      'html, body { height: 100%; margin: 0; padding: 0; }',
      'body { align-items: center; background: #fff; display: flex; justify-content: center; min-height: 100vh; }',
      '#recaptcha-cont { align-items: center; display: flex; justify-content: center; width: 100%; }'
    ].join(' ');
    document.head.appendChild(style);
  })();
  true;
`;

export default function App() {
  const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);
  const [step, setStep] = useState<AuthStep>('phone');
  const [phoneSession, setPhoneSession] = useState<FirebasePhoneSession | null>(null);
  const [verifiedAdmin, setVerifiedAdmin] = useState<VerifiedOrgAdmin | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(isFirebaseConfigured);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setIsRestoringSession(false);
      return undefined;
    }

    return subscribeToOrgAdminAuthState(
      (nextVerifiedAdmin) => {
        setIsRestoringSession(false);
        setRestoreError(null);

        if (nextVerifiedAdmin) {
          setPhoneSession(null);
          setVerifiedAdmin(nextVerifiedAdmin);
          setStep(getProfileStepFromBackendRole(nextVerifiedAdmin));
          return;
        }

        setPhoneSession(null);
        setVerifiedAdmin(null);
        clearRegisteredDeviceIdentityCache();
        setStep('phone');
      },
      (error) => {
        setIsRestoringSession(false);
        if (isAccessDeniedError(error)) {
          setRestoreError(null);
          Alert.alert('Access denied', ACCESS_DENIED_MESSAGE);
          void signOutOrgAdmin().catch(() => undefined);
        } else {
          setRestoreError(getUserAuthMessage(error, 'Unable to restore your secure session. Please sign in again.'));
        }
        setPhoneSession(null);
        setVerifiedAdmin(null);
        clearRegisteredDeviceIdentityCache();
        setStep('phone');
      }
    );
  }, []);

  function handleCodeSent(nextPhoneSession: FirebasePhoneSession) {
    setPhoneSession(nextPhoneSession);
    setStep('code');
  }

  function handleVerified(nextVerifiedAdmin: VerifiedOrgAdmin) {
    setVerifiedAdmin(nextVerifiedAdmin);
    setStep(getProfileStepFromBackendRole(nextVerifiedAdmin));
  }

  function handleSelectProfileRole(role: ProfileRoleSelection) {
    setStep(role === 'ORG_ADMIN' ? 'org-admin' : 'employee');
  }

  function handleOrgAdminProfileCreated(session: BackendAuthSession) {
    setVerifiedAdmin((currentVerifiedAdmin) => currentVerifiedAdmin
      ? {
          ...currentVerifiedAdmin,
          session
        }
      : currentVerifiedAdmin);
    setPhoneSession(null);
    setStep('chat');
  }

  function handleEmployeeProfileCreated(session: BackendAuthSession) {
    setVerifiedAdmin((currentVerifiedAdmin) => currentVerifiedAdmin
      ? {
          ...currentVerifiedAdmin,
          session
        }
      : currentVerifiedAdmin);
    setPhoneSession(null);
    setStep('chat');
  }

  function handleReset() {
    setPhoneSession(null);
    setVerifiedAdmin(null);
    clearRegisteredDeviceIdentityCache();
    setStep('phone');
  }

  const handleSessionInvalid = useCallback((message?: string) => {
    if (message === ACCESS_DENIED_MESSAGE) {
      setRestoreError(null);
      Alert.alert('Access denied', ACCESS_DENIED_MESSAGE);
    } else {
      setRestoreError(message || 'Your secure session could not be verified. Please sign in again.');
    }
    setPhoneSession(null);
    setVerifiedAdmin(null);
    clearRegisteredDeviceIdentityCache();
    setStep('phone');

    void signOutOrgAdmin().catch(() => undefined);
  }, []);

  return (
    <SafeAreaProvider style={styles.safeAreaProvider}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        {isFirebaseConfigured ? (
          <FirebaseRecaptchaVerifierModal
            ref={recaptchaVerifier}
            firebaseConfig={firebaseConfig}
            title="Synzapp verification"
            cancelLabel="Cancel"
            attemptInvisibleVerification={false}
            injectedJavaScript={CENTER_RECAPTCHA_SCRIPT}
          />
        ) : null}

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {!isRestoringSession && step === 'chat' && verifiedAdmin ? (
            <AdminChatScreen
              verifiedAdmin={verifiedAdmin}
              onSessionInvalid={handleSessionInvalid}
            />
          ) : (
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              {isRestoringSession ? (
                <View style={styles.restoring}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.restoringText}>Opening Synzapp...</Text>
                </View>
              ) : null}

              {!isRestoringSession && restoreError ? (
                <View style={styles.restoreErrorBox}>
                  <Text style={styles.restoreErrorText}>{restoreError}</Text>
                </View>
              ) : null}

              {!isRestoringSession && step === 'phone' ? (
                <OrgAdminPhoneScreen
                  recaptchaVerifier={recaptchaVerifier}
                  onCodeSent={handleCodeSent}
                />
              ) : null}

              {!isRestoringSession && step === 'code' && phoneSession ? (
                <OrgAdminCodeScreen
                  phoneSession={phoneSession}
                  onBack={() => setStep('phone')}
                  onVerified={handleVerified}
                />
              ) : null}

              {!isRestoringSession && step === 'role-select' && verifiedAdmin ? (
                <ProfileRoleSelectionScreen
                  verifiedAdmin={verifiedAdmin}
                  onSelectRole={handleSelectProfileRole}
                  onSignOut={handleReset}
                />
              ) : null}

              {!isRestoringSession && step === 'org-admin' && verifiedAdmin ? (
                <OrgAdminOnboardingScreen
                  verifiedAdmin={verifiedAdmin}
                  onBack={() => setStep('role-select')}
                  onProfileCreated={handleOrgAdminProfileCreated}
                  onSignOut={handleReset}
                />
              ) : null}

              {!isRestoringSession && step === 'employee' && verifiedAdmin ? (
                <EmployeeOnboardingScreen
                  verifiedAdmin={verifiedAdmin}
                  onBack={() => setStep('role-select')}
                  onProfileCreated={handleEmployeeProfileCreated}
                  onSignOut={handleReset}
                />
              ) : null}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function getProfileStepFromBackendRole(verifiedAdmin: VerifiedOrgAdmin): AuthStep {
  const { profileComplete, role, status } = verifiedAdmin.session.user;

  if (role && status === 'ACTIVE' && profileComplete) {
    return 'chat';
  }

  if (role === 'ORG_ADMIN') {
    return 'org-admin';
  }

  if (role === 'EMPLOYEE') {
    return 'employee';
  }

  return 'role-select';
}

const styles = StyleSheet.create({
  safeAreaProvider: {
    flex: 1
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1
  },
  keyboardView: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  restoring: {
    alignItems: 'center',
    gap: 14,
    justifyContent: 'center',
    minHeight: 520
  },
  restoringText: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: '400'
  },
  restoreErrorBox: {
    alignSelf: 'center',
    backgroundColor: colors.redSoft,
    borderColor: 'rgba(185, 28, 28, 0.18)',
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 26,
    marginBottom: 18,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  restoreErrorText: {
    color: colors.red,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    textAlign: 'center'
  }
});
