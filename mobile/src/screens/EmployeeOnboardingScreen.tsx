import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { DismissibleError } from '../components/DismissibleError';
import { getUserAuthMessage } from '../services/authErrors';
import {
  createEmployeeProfile,
  EmployeeOnboardingContext,
  getEmployeeOnboardingContext
} from '../services/profileApi';
import { pickNativeProfilePhoto } from '../services/profilePhotoPicker';
import { signOutOrgAdmin } from '../services/phoneAuth';
import { BackendAuthSession, EmployeeDraft, VerifiedOrgAdmin } from '../types/auth';
import { useAppTheme } from '../theme/AppThemeProvider';
import type { AppColors } from '../theme/colors';

const EMPLOYEE_ACCESS_DENIED_MESSAGE = 'This phone number is not approved for employee access. Please contact your company administrator.';

interface EmployeeOnboardingScreenProps {
  verifiedAdmin: VerifiedOrgAdmin;
  onBack: () => void;
  onProfileCreated: (session: BackendAuthSession) => void;
  onSignOut: () => void;
}

const initialDraft: EmployeeDraft = {
  employeeFirstName: '',
  employeeLastName: ''
};

export function EmployeeOnboardingScreen({
  verifiedAdmin,
  onBack,
  onProfileCreated,
  onSignOut
}: EmployeeOnboardingScreenProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const [draft, setDraft] = useState(initialDraft);
  const [context, setContext] = useState<EmployeeOnboardingContext | null>(null);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [profilePhotoDataUrl, setProfilePhotoDataUrl] = useState<string | undefined>();
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [isProfileCreated, setIsProfileCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasShownAccessDeniedAlertRef = useRef(false);
  const maskedPhoneNumber = verifiedAdmin.session.user.phoneMasked || maskPhoneNumber(verifiedAdmin.phoneNumber);

  const canContinue =
    Boolean(context) &&
    draft.employeeFirstName.trim().length > 1 &&
    draft.employeeLastName.trim().length > 1;

  useEffect(() => {
    let isMounted = true;

    async function loadContext() {
      setError(null);
      setIsLoadingContext(true);

      try {
        const nextContext = await getEmployeeOnboardingContext(verifiedAdmin.idToken);

        if (isMounted) {
          setContext(nextContext);
        }
      } catch (nextError) {
        if (isMounted) {
          showEmployeeAccessDeniedAlert(getUserAuthMessage(nextError, EMPLOYEE_ACCESS_DENIED_MESSAGE));
        }
      } finally {
        if (isMounted) {
          setIsLoadingContext(false);
        }
      }
    }

    void loadContext();

    return () => {
      isMounted = false;
    };
  }, [verifiedAdmin.idToken]);

  async function handleSignOut() {
    await signOutOrgAdmin();
    onSignOut();
  }

  async function handlePickProfilePhoto() {
    setError(null);

    try {
      const photo = await pickNativeProfilePhoto();

      if (!photo) {
        return;
      }

      setProfilePhotoUri(photo.uri);
      setProfilePhotoDataUrl(photo.dataUrl);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to add profile photo.');
    }
  }

  async function handleCreateProfile() {
    if (!context) {
      showEmployeeAccessDeniedAlert();
      return;
    }

    setError(null);
    setIsCreatingProfile(true);

    try {
      const result = await createEmployeeProfile({
        ...draft,
        idToken: verifiedAdmin.idToken,
        profilePhotoDataUrl
      });
      const warning = result.warnings?.[0];

      await verifiedAdmin.firebaseUser.getIdToken(true);

      if (warning) {
        setProfilePhotoUri(null);
        setProfilePhotoDataUrl(undefined);
      }

      setIsProfileCreated(true);
      Alert.alert(
        'Employee profile created',
        warning || 'Your employee profile is ready.',
        [
          {
            text: 'Start Chatting',
            onPress: () => onProfileCreated(result.session)
          }
        ],
        { cancelable: false }
      );
    } catch (nextError) {
      const nextMessage = getUserAuthMessage(nextError, 'Unable to create employee profile. Please try again.');

      if (isEmployeeAccessDeniedMessage(nextMessage)) {
        showEmployeeAccessDeniedAlert(nextMessage);
        return;
      }

      setError(nextMessage);
    } finally {
      setIsCreatingProfile(false);
    }
  }

  function showEmployeeAccessDeniedAlert(message = EMPLOYEE_ACCESS_DENIED_MESSAGE) {
    setError(null);

    if (hasShownAccessDeniedAlertRef.current) {
      return;
    }

    hasShownAccessDeniedAlertRef.current = true;
    Alert.alert(
      'Access denied',
      message,
      [
        {
          text: 'OK',
          onPress: () => {
            hasShownAccessDeniedAlertRef.current = false;
          }
        }
      ]
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.brand}>
          <Image
            source={require('../../assets/Synzapp-Splash-screen.png')}
            style={styles.splashLogo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.header}>
          <Text style={styles.status}>Phone verified {maskedPhoneNumber}</Text>
          <Text style={styles.title}>Create your employee profile</Text>
        </View>

        {isLoadingContext ? (
          <View style={styles.loadingContext}>
            <ActivityIndicator color={appTheme.colors.primary} />
            <Text style={styles.loadingText}>Checking company access...</Text>
          </View>
        ) : null}

        {context ? (
          <View style={styles.confirmation}>
            <ConfirmationRow label="Company" value={context.companyName} />
            <ConfirmationRow label="Admin" value={context.orgAdminName} />
            <ConfirmationRow label="Admin phone" value={context.orgAdminPhoneMasked} />
            <ConfirmationRow label="Department" value={context.departmentName} />
            <ConfirmationRow label="Role" value={context.roleName} />
          </View>
        ) : null}

        {context ? (
          <Pressable
            accessibilityRole="button"
            onPress={handlePickProfilePhoto}
            style={({ pressed }) => [
              styles.photoPicker,
              pressed && styles.pressed
            ]}
          >
            <View style={styles.photoPreview}>
              {profilePhotoUri ? (
                <Image source={{ uri: profilePhotoUri }} style={styles.photoImage} />
              ) : (
                <Text style={styles.photoInitials}>+</Text>
              )}
            </View>
            <View style={styles.photoText}>
              <Text style={styles.photoTitle}>
                {profilePhotoUri ? 'Change profile photo' : 'Add profile photo'}
              </Text>
              <Text style={styles.photoSubtitle}>Optional</Text>
            </View>
          </Pressable>
        ) : null}

        {context ? (
          <View style={styles.form}>
            <View style={styles.nameRow}>
              <View style={styles.nameField}>
                <ProfileInput
                  value={draft.employeeFirstName}
                  onChangeText={(employeeFirstName) => setDraft({ ...draft, employeeFirstName })}
                  placeholder="First name"
                />
              </View>
              <View style={styles.nameField}>
                <ProfileInput
                  value={draft.employeeLastName}
                  onChangeText={(employeeLastName) => setDraft({ ...draft, employeeLastName })}
                  placeholder="Last name"
                />
              </View>
            </View>
          </View>
        ) : null}

        {error ? (
          <DismissibleError message={error} onDismiss={() => setError(null)} />
        ) : null}

        {context ? (
          <Pressable
            accessibilityRole="button"
            disabled={!canContinue || isCreatingProfile || isProfileCreated}
            onPress={handleCreateProfile}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && canContinue && !isCreatingProfile && styles.pressed,
              (!canContinue || isCreatingProfile || isProfileCreated) && styles.disabled
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {getPrimaryButtonLabel(isCreatingProfile, isProfileCreated)}
            </Text>
          </Pressable>
        ) : null}

        {isCreatingProfile ? (
          <View style={styles.loading}>
            <ActivityIndicator color={appTheme.colors.primary} />
          </View>
        ) : null}

        <View style={styles.secondaryActions}>
          {!context ? (
            <Pressable accessibilityRole="button" onPress={onBack} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Change role</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={handleSignOut} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Sign out</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

interface ConfirmationRowProps {
  label: string;
  value: string;
}

function ConfirmationRow({ label, value }: ConfirmationRowProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);

  return (
    <View style={styles.confirmationRow}>
      <Text style={styles.confirmationLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.confirmationValue}>{value}</Text>
    </View>
  );
}

interface ProfileInputProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}

function ProfileInput({ value, onChangeText, placeholder }: ProfileInputProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);

  return (
    <View style={styles.inputBox}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={appTheme.colors.muted}
        autoCapitalize="words"
        autoCorrect={false}
        style={styles.input}
      />
    </View>
  );
}

function maskPhoneNumber(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, '');
  const lastFourDigits = digits.slice(-4);

  return lastFourDigits ? `*****${lastFourDigits}` : '*****';
}

function isEmployeeAccessDeniedMessage(message: string): boolean {
  return /not approved for employee access|access denied|contact your company administrator/i.test(message);
}

function getPrimaryButtonLabel(isCreatingProfile: boolean, isProfileCreated: boolean): string {
  if (isCreatingProfile) {
    return 'Creating...';
  }

  if (isProfileCreated) {
    return 'Profile created';
  }

  return 'Continue';
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
    minHeight: 720,
    overflow: 'hidden'
  },
  content: {
    flex: 1,
    gap: 18,
    justifyContent: 'center',
    paddingBottom: 34,
    paddingHorizontal: 34,
    paddingTop: 52
  },
  brand: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18
  },
  splashLogo: {
    height: 76,
    width: 230
  },
  header: {
    gap: 8
  },
  status: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 31
  },
  loadingContext: {
    alignItems: 'center',
    gap: 8,
    minHeight: 80,
    justifyContent: 'center'
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  confirmation: {
    gap: 2
  },
  confirmationRow: {
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 38,
    paddingVertical: 8
  },
  confirmationLabel: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    width: 92
  },
  confirmationValue: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20
  },
  form: {
    gap: 14,
    marginTop: 2
  },
  photoPicker: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 70,
    paddingHorizontal: 2,
    paddingVertical: 8
  },
  photoPreview: {
    alignItems: 'center',
    backgroundColor: colors.blueSoft,
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 52
  },
  photoImage: {
    height: 52,
    width: 52
  },
  photoInitials: {
    color: colors.blue,
    fontSize: 25,
    fontWeight: '400',
    lineHeight: 29
  },
  photoText: {
    gap: 3
  },
  photoTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 21
  },
  photoSubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18
  },
  inputBox: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    justifyContent: 'center',
    minHeight: 54
  },
  input: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '400',
    minHeight: 54,
    paddingHorizontal: 2
  },
  nameRow: {
    flexDirection: 'row',
    gap: 14
  },
  nameField: {
    flex: 1
  },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.blue,
    borderRadius: 8,
    elevation: 8,
    justifyContent: 'center',
    minHeight: 54,
    minWidth: 180,
    paddingHorizontal: 26,
    shadowColor: colors.blue,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 18
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '400'
  },
  loading: {
    alignItems: 'center',
    minHeight: 30
  },
  secondaryActions: {
    alignItems: 'center',
    gap: 2
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 18
  },
  secondaryButtonText: {
    color: colors.mutedStrong,
    fontSize: 16,
    fontWeight: '400'
  },
  pressed: {
    opacity: 0.84
  },
  disabled: {
    opacity: 0.52
  }
});
}
