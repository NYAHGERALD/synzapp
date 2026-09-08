import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent
} from '@react-native-community/datetimepicker';
import { DismissibleError } from '../components/DismissibleError';
import { getUserAuthMessage } from '../services/authErrors';
import { createOrgAdminProfile } from '../services/profileApi';
import { pickNativeProfilePhoto } from '../services/profilePhotoPicker';
import { signOutOrgAdmin } from '../services/phoneAuth';
import { BackendAuthSession, OrgAdminDraft, VerifiedOrgAdmin } from '../types/auth';
import { useAppTheme } from '../theme/AppThemeProvider';
import { formatPostalCode, getCountryFormat } from '../services/addressFormats';
import { ALL_COUNTRIES } from '../services/countries';
import {
  EMPTY_ORG_ONBOARDING_DRAFT,
  ORG_ONBOARDING_STEPS,
  composeCompanyAddress,
  validateOrgOnboardingStep
} from '../services/orgOnboardingSteps';
import type { AppColors } from '../theme/colors';
import {
  calendarYearMaximumDate,
  calendarYearMinimumDate,
  formatCalendarYearStartDateInput,
  getCalendarYearStartDateLabel,
  getDefaultCalendarYearStartDate,
  isValidCalendarYearStartDate,
  parseCalendarYearStartDate
} from '../utils/calendarYear';

interface OrgAdminOnboardingScreenProps {
  verifiedAdmin: VerifiedOrgAdmin;
  onBack: () => void;
  onProfileCreated: (session: BackendAuthSession) => void;
  onSignOut: () => void;
}

const initialDraft = EMPTY_ORG_ONBOARDING_DRAFT;

export function OrgAdminOnboardingScreen({
  verifiedAdmin,
  onBack,
  onProfileCreated,
  onSignOut
}: OrgAdminOnboardingScreenProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const [draft, setDraft] = useState(initialDraft);
  const [step, setStep] = useState(0);
  const [isCountryPickerOpen, setIsCountryPickerOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const stepShift = useRef(new Animated.Value(0)).current;
  const stepFade = useRef(new Animated.Value(1)).current;
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [profilePhotoDataUrl, setProfilePhotoDataUrl] = useState<string | undefined>();
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [isProfileCreated, setIsProfileCreated] = useState(false);
  const [isCalendarPickerOpen, setIsCalendarPickerOpen] = useState(false);
  const [calendarPickerDate, setCalendarPickerDate] = useState<Date>(() =>
    parseCalendarYearStartDate(initialDraft.calendarYearStartDate) || new Date()
  );
  const [error, setError] = useState<string | null>(null);
  const maskedPhoneNumber = verifiedAdmin.session.user.phoneMasked || maskPhoneNumber(verifiedAdmin.phoneNumber);

  const currentStep = ORG_ONBOARDING_STEPS[step];
  const isLastStep = step === ORG_ONBOARDING_STEPS.length - 1;
  const country = getCountryFormat(draft.countryCode);
  const canContinue = validateOrgOnboardingStep(step, draft) === null &&
    (!isLastStep || isValidCalendarYearStartDate(draft.calendarYearStartDate));

  // Each step slides in from the right and settles. It is the same movement a
  // person expects from a form that is going somewhere, and it makes the change
  // of question obvious without a banner announcing it.
  useEffect(() => {
    stepShift.setValue(18);
    stepFade.setValue(0);

    Animated.parallel([
      Animated.timing(stepShift, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: true
      }),
      Animated.timing(stepFade, {
        duration: 220,
        easing: Easing.out(Easing.quad),
        toValue: 1,
        useNativeDriver: true
      })
    ]).start();
  }, [step, stepFade, stepShift]);

  function handleNext() {
    const stepError = validateOrgOnboardingStep(step, draft);

    if (stepError) {
      setError(stepError);

      return;
    }

    setError(null);

    if (isLastStep) {
      void handleCreateProfile();

      return;
    }

    setStep(step + 1);
  }

  function handleStepBack() {
    setError(null);

    if (step === 0) {
      onBack();

      return;
    }

    setStep(step - 1);
  }

  /**
   * Clears the state and postal code when the country changes.
   *
   * A Texas left behind after switching to Canada would be saved as a Canadian
   * province, and a ZIP code would fail a postcode check for no visible reason.
   */
  const visibleCountries = countrySearch.trim()
    ? ALL_COUNTRIES.filter((option) =>
        option.label.toLowerCase().includes(countrySearch.trim().toLowerCase())
      )
    : ALL_COUNTRIES;

  function handleCountryChange(nextCode: string) {
    setDraft({ ...draft, countryCode: nextCode, postalCode: '', region: '' });
  }

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
        adminFirstName: draft.adminFirstName,
        adminLastName: draft.adminLastName,
        calendarYearStartDate: draft.calendarYearStartDate,
        // The written-out line for everything that already reads it, and the
        // parts for anything that needs to act on the address later.
        companyAddress: composeCompanyAddress(draft),
        companyAddressParts: {
          city: draft.city,
          countryCode: draft.countryCode,
          line1: draft.addressLine1,
          line2: draft.addressLine2,
          postalCode: formatPostalCode(draft.countryCode, draft.postalCode),
          region: draft.region
        },
        companyEmail: draft.companyEmail,
        companyName: draft.companyName,
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

  function handleOpenCalendarPicker() {
    setError(null);
    const selectedDate = parseCalendarYearStartDate(draft.calendarYearStartDate) ||
      parseCalendarYearStartDate(getDefaultCalendarYearStartDate()) ||
      new Date();

    setCalendarPickerDate(selectedDate);

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        display: 'calendar',
        maximumDate: calendarYearMaximumDate,
        minimumDate: calendarYearMinimumDate,
        mode: 'date',
        onChange: handleAndroidCalendarDateChange,
        value: selectedDate
      });
      return;
    }

    setIsCalendarPickerOpen(true);
  }

  function handleAndroidCalendarDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (event.type !== 'set' || !selectedDate) {
      return;
    }

    setDraft((currentDraft) => ({
      ...currentDraft,
      calendarYearStartDate: formatCalendarYearStartDateInput(selectedDate)
    }));
  }

  function handleConfirmIosCalendarDate() {
    setDraft((currentDraft) => ({
      ...currentDraft,
      calendarYearStartDate: formatCalendarYearStartDateInput(calendarPickerDate)
    }));
    setIsCalendarPickerOpen(false);
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <Image
            source={require('../../assets/Synzapp-Splash-screen.png')}
            style={styles.splashLogo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.header}>
          <Text style={styles.status}>Phone verified {maskedPhoneNumber}</Text>
          <Text style={styles.stepCount}>
            Step {step + 1} of {ORG_ONBOARDING_STEPS.length}
          </Text>
          <Text style={styles.title}>{currentStep.title}</Text>
          <Text style={styles.stepSubtitle}>{currentStep.subtitle}</Text>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${((step + 1) / ORG_ONBOARDING_STEPS.length) * 100}%` }
            ]}
          />
        </View>

        <Animated.View
          style={{ opacity: stepFade, transform: [{ translateX: stepShift }] }}
        >
          {currentStep.key === 'you' ? (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={handlePickProfilePhoto}
                style={({ pressed }) => [styles.photoPicker, pressed && styles.pressed]}
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
                    {profilePhotoUri ? 'Change your photo' : 'Add your photo'}
                  </Text>
                  <Text style={styles.photoSubtitle}>You can skip this</Text>
                </View>
              </Pressable>

              <View style={styles.form}>
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
            </>
          ) : null}

          {currentStep.key === 'company' ? (
            <View style={styles.form}>
              <ProfileInput
                value={draft.companyName}
                onChangeText={(companyName) => setDraft({ ...draft, companyName })}
                placeholder="Company name"
              />
              <ProfileInput
                value={draft.companyEmail}
                onChangeText={(companyEmail) => setDraft({ ...draft, companyEmail })}
                placeholder="Company email address"
              />
            </View>
          ) : null}

          {currentStep.key === 'address' ? (
            <View style={styles.form}>
              <Text style={styles.fieldLabel}>Country</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setCountrySearch('');
                  setIsCountryPickerOpen(true);
                }}
                style={({ pressed }) => [styles.countryButton, pressed && styles.pressed]}
              >
                <Text style={styles.countryButtonText}>{country.label}</Text>
                <Text style={styles.countryButtonHint}>Tap to change</Text>
              </Pressable>

              <ProfileInput
                value={draft.addressLine1}
                onChangeText={(addressLine1) => setDraft({ ...draft, addressLine1 })}
                placeholder="Street address"
              />
              <ProfileInput
                value={draft.addressLine2}
                onChangeText={(addressLine2) => setDraft({ ...draft, addressLine2 })}
                placeholder="Suite, floor or building (you can skip this)"
              />
              <ProfileInput
                value={draft.city}
                onChangeText={(city) => setDraft({ ...draft, city })}
                placeholder="City"
              />
              <ProfileInput
                value={draft.region}
                onChangeText={(region) => setDraft({ ...draft, region })}
                placeholder={country.regionLabel}
              />
              <ProfileInput
                value={draft.postalCode}
                onChangeText={(postalCode) => setDraft({ ...draft, postalCode })}
                placeholder={`${country.postalLabel}, for example ${country.postalPlaceholder}`}
              />
            </View>
          ) : null}

          {currentStep.key === 'year' ? (
            <View style={styles.form}>
              <Pressable
                accessibilityRole="button"
                onPress={handleOpenCalendarPicker}
                style={({ pressed }) => [styles.calendarDateButton, pressed && styles.pressed]}
              >
                <Text style={styles.calendarDateButtonText}>
                  {getCalendarYearStartDateLabel(draft.calendarYearStartDate)}
                </Text>
                <Text style={styles.calendarDateButtonHint}>Tap to choose the date</Text>
              </Pressable>
            </View>
          ) : null}
        </Animated.View>

        {error ? (
          <DismissibleError message={error} onDismiss={() => setError(null)} />
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={!canContinue || isCreatingProfile || isProfileCreated}
          onPress={handleNext}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && canContinue && !isCreatingProfile && styles.pressed,
            (!canContinue || isCreatingProfile || isProfileCreated) && styles.disabled
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {isLastStep
              ? getPrimaryButtonLabel(isCreatingProfile, isProfileCreated)
              : 'Next'}
          </Text>
        </Pressable>

        {isCreatingProfile ? (
          <View style={styles.loading}>
            <ActivityIndicator color={appTheme.colors.primary} />
          </View>
        ) : null}

        <View style={styles.secondaryActions}>
          <Pressable accessibilityRole="button" onPress={handleStepBack} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>{step === 0 ? 'Change role' : 'Back'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={handleSignOut} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setIsCountryPickerOpen(false)}
        transparent
        visible={isCountryPickerOpen}
      >
        <View style={styles.calendarModalOverlay}>
          <Pressable
            accessibilityLabel="Close country list"
            accessibilityRole="button"
            onPress={() => setIsCountryPickerOpen(false)}
            style={styles.calendarModalBackdrop}
          />
          <View style={styles.countryModalCard}>
            <Text style={styles.calendarModalTitle}>Choose your country</Text>
            {/* 251 countries is too many to scroll past. Typing narrows it. */}
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setCountrySearch}
              placeholder="Type to find your country"
              placeholderTextColor={appTheme.colors.muted}
              style={styles.countrySearchInput}
              value={countrySearch}
            />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.countryList}
            >
              {visibleCountries.length ? (
                visibleCountries.map((option) => (
                  <Pressable
                    accessibilityRole="button"
                    key={option.code}
                    onPress={() => {
                      handleCountryChange(option.code);
                      setIsCountryPickerOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.countryListRow,
                      draft.countryCode === option.code && styles.countryListRowActive,
                      pressed && styles.pressed
                    ]}
                  >
                    <Text style={styles.countryListText}>{option.label}</Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.countryListEmpty}>
                  No country matches “{countrySearch}”.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {Platform.OS === 'ios' ? (
        <Modal
          animationType="slide"
          onRequestClose={() => setIsCalendarPickerOpen(false)}
          transparent
          visible={isCalendarPickerOpen}
        >
          <View style={styles.calendarModalOverlay}>
            <Pressable
              accessibilityLabel="Close calendar picker"
              accessibilityRole="button"
              onPress={() => setIsCalendarPickerOpen(false)}
              style={styles.calendarModalBackdrop}
            />
            <View style={styles.calendarModalSheet}>
              <View style={styles.calendarModalHeader}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setIsCalendarPickerOpen(false)}
                  style={styles.calendarModalAction}
                >
                  <Text style={styles.calendarModalCancelText}>Cancel</Text>
                </Pressable>
                <Text style={styles.calendarModalTitle}>Calendar year starts</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleConfirmIosCalendarDate}
                  style={styles.calendarModalAction}
                >
                  <Text style={styles.calendarModalDoneText}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                display="inline"
                maximumDate={calendarYearMaximumDate}
                minimumDate={calendarYearMinimumDate}
                mode="date"
                onChange={(_, selectedDate) => {
                  if (selectedDate) {
                    setCalendarPickerDate(selectedDate);
                  }
                }}
                value={calendarPickerDate}
              />
            </View>
          </View>
        </Modal>
      ) : null}
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
    flexGrow: 1,
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
    height: 58,
    width: 178
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
  stepCount: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginTop: 6,
    textTransform: 'uppercase'
  },
  stepSubtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8
  },
  progressTrack: {
    backgroundColor: colors.divider,
    borderRadius: 999,
    height: 4,
    marginTop: 18,
    overflow: 'hidden'
  },
  progressFill: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 4
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: -4
  },
  countryButton: {
    backgroundColor: colors.surface,
    borderColor: colors.divider,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  countryButtonText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '500'
  },
  countryButtonHint: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2
  },
  countryModalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '78%',
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 20
  },
  countrySearchInput: {
    backgroundColor: colors.surface,
    borderColor: colors.divider,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  countryList: {
    marginTop: 12
  },
  countryListRow: {
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 14
  },
  countryListRowActive: {
    backgroundColor: colors.primarySoft
  },
  countryListText: {
    color: colors.ink,
    fontSize: 16
  },
  countryListEmpty: {
    color: colors.muted,
    fontSize: 15,
    paddingVertical: 24,
    textAlign: 'center'
  },
  form: {
    gap: 14,
    marginTop: 6
  },
  calendarYearSection: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 10,
    paddingBottom: 12,
    paddingTop: 2
  },
  calendarYearTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22
  },
  calendarYearSubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18
  },
  calendarDateButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 56,
    minWidth: 190,
    paddingHorizontal: 16
  },
  calendarDateButtonText: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22
  },
  calendarDateButtonHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    marginTop: 2
  },
  calendarModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  calendarModalBackdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    ...StyleSheet.absoluteFillObject
  },
  calendarModalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 18,
    paddingHorizontal: 12,
    paddingTop: 8
  },
  calendarModalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 50
  },
  calendarModalAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 72
  },
  calendarModalTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 22,
    textAlign: 'center'
  },
  calendarModalCancelText: {
    color: colors.mutedStrong,
    fontSize: 16,
    fontWeight: '400'
  },
  calendarModalDoneText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '500'
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
    color: colors.muted,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  inputBox: {
    borderBottomColor: colors.border,
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
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 24
  }
});
}
