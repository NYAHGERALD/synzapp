import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
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
import { purgeTenantCompanyData } from './src/services/companyDataGovernance';
import { initializeChatMediaStorage } from './src/services/chatMediaApi';
import {
  clearCompanyDataSessionScope,
  getLastCompanyDataSessionScope,
  saveCompanyDataSessionScope
} from './src/services/companyDataSessionScope';
import { markCompanyDataScopeActive } from './src/services/companyDataManifest';
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

/**
 * Making room for the keyboard.
 *
 * Handled by `react-native-keyboard-controller`, wired in at the root as
 * `KeyboardProvider` and used by the message composer.
 *
 * React Native's own `KeyboardAvoidingView` cannot do this here. The app
 * targets SDK 36 and Android 16 enforces edge to edge, which disables
 * `adjustResize`: the window is no longer padded for the keyboard and its
 * height never changes. Measured on a device, it stayed at 832 with the
 * keyboard open. `KeyboardAvoidingView` sizes itself from that frame, so every
 * mode either left a band behind or left the field covered.
 *
 * The platform's answer is to consume the IME inset directly, which is what
 * the keyboard controller does.
 */

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
  /**
   * Whether the chat screen has finished its first load.
   *
   * The screen is mounted while it is still filling in, and interacting with it
   * during that competes with the work — which is what made the chat list and
   * keyboard stutter on the first open after installing. It stays hidden behind
   * the preparation screen until it says it is ready.
   */
  const [isChatReady, setIsChatReady] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    // Point media storage at a directory the OS will not reclaim, and migrate
    // anything already cached, before any chat media is read or written.
    void initializeChatMediaStorage();
  }, []);

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
          void purgeLastKnownCompanyDataScope('access-denied').catch(() => undefined);
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

  useEffect(() => {
    const currentSession = verifiedAdmin?.session.user;

    if (!currentSession?.uid || !currentSession.tenantId) {
      return;
    }

    const scope = {
      ownerUid: currentSession.uid,
      tenantId: currentSession.tenantId
    };

    void saveCompanyDataSessionScope(scope)
      .then(() => markCompanyDataScopeActive(scope))
      .catch(() => undefined);
  }, [verifiedAdmin?.session.user.tenantId, verifiedAdmin?.session.user.uid]);

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
    const currentSession = verifiedAdmin?.session.user;

    setIsChatReady(false);

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

    if (currentSession?.uid && currentSession.tenantId) {
      void purgeTenantCompanyData({
        clearBackupRecoveryKey: true,
        clearDeviceIdentity: true,
        ownerUid: currentSession.uid,
        reason: message === ACCESS_DENIED_MESSAGE ? 'access-denied' : 'session-invalid',
        tenantId: currentSession.tenantId
      })
        .then(() => clearCompanyDataSessionScope())
        .catch(() => undefined);
    } else {
      void purgeLastKnownCompanyDataScope(
        message === ACCESS_DENIED_MESSAGE ? 'access-denied' : 'session-invalid'
      ).catch(() => undefined);
    }

    void signOutOrgAdmin().catch(() => undefined);
  }, [verifiedAdmin]);

  const handleChatReady = useCallback(() => {
    setIsChatReady(true);
  }, []);

  const handleOrganizationDeleted = useCallback(() => {
    setIsChatReady(false);
    setRestoreError(null);
    setPhoneSession(null);
    setVerifiedAdmin(null);
    clearRegisteredDeviceIdentityCache();
    setStep('phone');
  }, []);

  return (
    <SafeAreaProvider style={styles.safeAreaProvider}>
      <KeyboardProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} />

        {isOnboardingComplete === false ? (
          <AppOnboardingScreen onComplete={handleAppOnboardingComplete} />
        ) : isOnboardingComplete === null || isRestoringSession ? (
          <SecureLoginPreparationScreen />
        ) : (
        <View style={styles.keyboardView}>
          {!isRestoringSession && step === 'chat' && verifiedAdmin ? (
            <View style={styles.keyboardView}>
              <AdminChatScreen
                verifiedAdmin={verifiedAdmin}
                onOrganizationDeleted={handleOrganizationDeleted}
                onReady={handleChatReady}
                onSessionInvalid={handleSessionInvalid}
              />
              {!isChatReady ? (
                // Covering the screen rather than delaying its mount: it can
                // only load once it is mounted, and this way the first thing the
                // user touches is a screen that is already populated.
                <View style={styles.readinessOverlay}>
                  <SecureLoginPreparationScreen />
                </View>
              ) : null}
            </View>
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
        </View>
        )}
      </SafeAreaView>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

async function purgeLastKnownCompanyDataScope(reason: 'access-denied' | 'session-invalid'): Promise<void> {
  const scope = await getLastCompanyDataSessionScope();

  if (!scope) {
    return;
  }

  await purgeTenantCompanyData({
    clearBackupRecoveryKey: true,
    clearDeviceIdentity: true,
    ownerUid: scope.ownerUid,
    reason,
    tenantId: scope.tenantId
  });
  await clearCompanyDataSessionScope();
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
  readinessOverlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0
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
