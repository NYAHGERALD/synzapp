import React, { useState } from 'react';
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
import { createOrgAdminProfile } from '../services/profileApi';
import { pickNativeProfilePhoto } from '../services/profilePhotoPicker';
import { signOutOrgAdmin } from '../services/phoneAuth';
import { BackendAuthSession, OrgAdminDraft, VerifiedOrgAdmin } from '../types/auth';
import { colors } from '../theme/colors';

interface OrgAdminOnboardingScreenProps {
  verifiedAdmin: VerifiedOrgAdmin;
  onBack: () => void;
  onProfileCreated: (session: BackendAuthSession) => void;
  onSignOut: () => void;
}

const initialDraft: OrgAdminDraft = {
  companyName: '',
  companyAddress: '',
  adminFirstName: '',
  adminLastName: ''
};

export function OrgAdminOnboardingScreen({
  verifiedAdmin,
  onBack,
  onProfileCreated,
  onSignOut
}: OrgAdminOnboardingScreenProps) {
  const [draft, setDraft] = useState(initialDraft);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [profilePhotoDataUrl, setProfilePhotoDataUrl] = useState<string | undefined>();
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [isProfileCreated, setIsProfileCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const maskedPhoneNumber = verifiedAdmin.session.user.phoneMasked || maskPhoneNumber(verifiedAdmin.phoneNumber);

  const canContinue =
    draft.companyName.trim().length > 1 &&
    draft.companyAddress.trim().length > 4 &&
    draft.adminFirstName.trim().length > 1 &&
    draft.adminLastName.trim().length > 1;

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
    setError(null);
    setIsCreatingProfile(true);

    try {
      const result = await createOrgAdminProfile({
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
        'Company profile created',
        warning || 'Your company profile is ready.',
        [
          {
            text: 'Start Chatting',
            onPress: () => onProfileCreated(result.session)
          }
        ],
        { cancelable: false }
      );
    } catch (nextError) {
      setError(getUserAuthMessage(nextError, 'Unable to create profile. Please try again.'));
    } finally {
      setIsCreatingProfile(false);
    }
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
          <Text style={styles.title}>Create your company profile</Text>
        </View>

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

        <View style={styles.form}>
          <ProfileInput
            value={draft.companyName}
            onChangeText={(companyName) => setDraft({ ...draft, companyName })}
            placeholder="Company name"
          />
          <ProfileInput
            value={draft.companyAddress}
            onChangeText={(companyAddress) => setDraft({ ...draft, companyAddress })}
            placeholder="Company address"
          />
          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <ProfileInput
                value={draft.adminFirstName}
                onChangeText={(adminFirstName) => setDraft({ ...draft, adminFirstName })}
                placeholder="First name"
              />
            </View>
            <View style={styles.nameField}>
              <ProfileInput
                value={draft.adminLastName}
                onChangeText={(adminLastName) => setDraft({ ...draft, adminLastName })}
                placeholder="Last name"
              />
            </View>
          </View>
        </View>

        {error ? (
          <DismissibleError message={error} onDismiss={() => setError(null)} />
        ) : null}

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

        {isCreatingProfile ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        <View style={styles.secondaryActions}>
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Change role</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={handleSignOut} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Sign out</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

interface ProfileInputProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}

function ProfileInput({ value, onChangeText, placeholder }: ProfileInputProps) {
  return (
    <View style={styles.inputBox}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#64748B"
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

function getPrimaryButtonLabel(isCreatingProfile: boolean, isProfileCreated: boolean): string {
  if (isCreatingProfile) {
    return 'Creating...';
  }

  if (isProfileCreated) {
    return 'Profile created';
  }

  return 'Continue';
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
    minHeight: 720,
    overflow: 'hidden'
  },
  content: {
    flex: 1,
    gap: 22,
    justifyContent: 'center',
    paddingBottom: 34,
    paddingHorizontal: 34,
    paddingTop: 52
  },
  brand: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 34
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
    fontSize: 25,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 32
  },
  form: {
    gap: 14,
    marginTop: 6
  },
  photoPicker: {
    alignItems: 'center',
    borderBottomColor: 'rgba(15, 118, 110, 0.35)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 70,
    paddingHorizontal: 2,
    paddingVertical: 8
  },
  photoPreview: {
    alignItems: 'center',
    backgroundColor: '#E0ECFF',
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
    color: '#4F6FEA',
    fontSize: 25,
    fontWeight: '400',
    lineHeight: 29
  },
  photoText: {
    flex: 1,
    gap: 3
  },
  photoTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22
  },
  photoSubtitle: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  inputBox: {
    borderBottomColor: 'rgba(15, 118, 110, 0.35)',
    borderBottomWidth: 1,
    minHeight: 54,
    justifyContent: 'center'
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
    backgroundColor: '#4F6FEA',
    borderRadius: 8,
    elevation: 8,
    justifyContent: 'center',
    minHeight: 54,
    minWidth: 180,
    paddingHorizontal: 26,
    shadowColor: '#304ECF',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 18
  },
  primaryButtonText: {
    color: colors.card,
    fontSize: 17,
    fontWeight: '400'
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
    color: '#253244',
    fontSize: 16,
    fontWeight: '400'
  },
  pressed: {
    opacity: 0.84
  },
  disabled: {
    opacity: 0.52
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 24
  }
});
