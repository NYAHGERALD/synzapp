import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AdminChatScreen } from './src/screens/AdminChatScreen';
import {
  AppOnboardingScreen,
  SecureLoginPreparationScreen
} from './src/screens/AppOnboardingScreen';
import { EmployeeOnboardingScreen } from './src/screens/EmployeeOnboardingScreen';
import { OrgAdminCodeScreen } from './src/screens/OrgAdminCodeScreen';
import { OrgAdminOnboardingScreen } from './src/screens/OrgAdminOnboardingScreen';
import { OrgAdminPhoneScreen } from './src/screens/OrgAdminPhoneScreen';
import { ProfileRoleSelectionScreen } from './src/screens/ProfileRoleSelectionScreen';
import { DismissibleError } from './src/components/DismissibleError';
import { getUserAuthMessage } from './src/services/authErrors';
import {
  ACCESS_DENIED_MESSAGE,
  isAccessDeniedError
} from './src/services/backendAuth';
import {
  hasCompletedAppOnboarding,
  markAppOnboardingComplete
} from './src/services/appOnboarding';
import { clearRegisteredDeviceIdentityCache } from './src/services/deviceIdentity';
import { signOutOrgAdmin, subscribeToOrgAdminAuthState } from './src/services/phoneAuth';
import {
  AuthStep,
  BackendAuthSession,
  FirebasePhoneSession,
  ProfileRoleSelection,
  VerifiedOrgAdmin
} from './src/types/auth';
import { AppThemeProvider, useAppTheme } from './src/theme/AppThemeProvider';
import type { AppColors } from './src/theme/colors';

export default function App() {
  return (
    <AppThemeProvider>
      <SynzappApp />
    </AppThemeProvider>
  );
}

function SynzappApp() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const [step, setStep] = useState<AuthStep>('phone');
  const [phoneSession, setPhoneSession] = useState<FirebasePhoneSession | null>(null);
  const [verifiedAdmin, setVerifiedAdmin] = useState<VerifiedOrgAdmin | null>(null);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    hasCompletedAppOnboarding()
      .then((hasCompleted) => {
        if (isMounted) {
          setIsOnboardingComplete(hasCompleted);
          setIsRestoringSession(hasCompleted);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsOnboardingComplete(false);
          setIsRestoringSession(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isOnboardingComplete !== true) {
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
  }, [isOnboardingComplete]);

  async function handleAppOnboardingComplete() {
    await markAppOnboardingComplete();
    setIsOnboardingComplete(true);
    setIsRestoringSession(true);
  }

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

  const handleOrganizationDeleted = useCallback(() => {
    setRestoreError(null);
    setPhoneSession(null);
    setVerifiedAdmin(null);
    clearRegisteredDeviceIdentityCache();
    setStep('phone');
  }, []);

  return (
    <SafeAreaProvider style={styles.safeAreaProvider}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} />

        {isOnboardingComplete === false ? (
          <AppOnboardingScreen onComplete={handleAppOnboardingComplete} />
        ) : isOnboardingComplete === null || isRestoringSession ? (
          <SecureLoginPreparationScreen />
        ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {!isRestoringSession && step === 'chat' && verifiedAdmin ? (
            <AdminChatScreen
              verifiedAdmin={verifiedAdmin}
              onOrganizationDeleted={handleOrganizationDeleted}
              onSessionInvalid={handleSessionInvalid}
            />
          ) : (
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              {!isRestoringSession && restoreError ? (
                <DismissibleError
                  message={restoreError}
                  onDismiss={() => setRestoreError(null)}
                />
              ) : null}

              {!isRestoringSession && step === 'phone' ? (
                <OrgAdminPhoneScreen
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
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function getProfileStepFromBackendRole(verifiedAdmin: VerifiedOrgAdmin): AuthStep {
  const { profileComplete, role, status } = verifiedAdmin.session.user;

  if (role && status === 'ACTIVE' && profileComplete) {
    return 'chat';
  }

  if (role === 'ORG_ADMIN' && verifiedAdmin.session.user.tenantId) {
    return 'employee';
  }

  if (role === 'ORG_ADMIN') {
    return 'org-admin';
  }

  if (role === 'EMPLOYEE') {
    return 'employee';
  }

  return 'role-select';
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
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
  });
}
