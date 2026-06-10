import React, { RefObject, useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import type { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { DismissibleError } from '../components/DismissibleError';
import { isFirebaseConfigured } from '../services/firebaseConfig';
import { requestOtpPreflight } from '../services/backendAuth';
import { getUserAuthMessage } from '../services/authErrors';
import { sendOrgAdminPhoneCode } from '../services/phoneAuth';
import { FirebasePhoneSession } from '../types/auth';
import { colors } from '../theme/colors';

type CountryCode = 'US' | 'CA' | 'MX' | 'UK';

interface CountryOption {
  countryCode: CountryCode;
  countryName: string;
  dialCode: string;
  flag: string;
  maxDigits: number;
  placeholder: string;
}

const COUNTRY_OPTIONS: CountryOption[] = [
  {
    countryCode: 'US',
    countryName: 'United States',
    dialCode: '+1',
    flag: '🇺🇸',
    maxDigits: 10,
    placeholder: '201 555 0123'
  },
  {
    countryCode: 'CA',
    countryName: 'Canada',
    dialCode: '+1',
    flag: '🇨🇦',
    maxDigits: 10,
    placeholder: '416 555 0123'
  },
  {
    countryCode: 'MX',
    countryName: 'Mexico',
    dialCode: '+52',
    flag: '🇲🇽',
    maxDigits: 10,
    placeholder: '55 1234 5678'
  },
  {
    countryCode: 'UK',
    countryName: 'United Kingdom',
    dialCode: '+44',
    flag: '🇬🇧',
    maxDigits: 10,
    placeholder: '7123 456789'
  }
];

const RESEND_COOLDOWN_SECONDS = 45;

interface OrgAdminPhoneScreenProps {
  recaptchaVerifier: RefObject<FirebaseRecaptchaVerifierModal | null>;
  onCodeSent: (session: FirebasePhoneSession) => void;
}

export function OrgAdminPhoneScreen({ recaptchaVerifier, onCodeSent }: OrgAdminPhoneScreenProps) {
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(COUNTRY_OPTIONS[0]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isCountryPickerOpen, setIsCountryPickerOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const nationalDigits = getPhoneDigits(phoneNumber);
  const isPhoneNumberComplete = nationalDigits.length === selectedCountry.maxDigits;
  const cooldownSeconds = cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000)) : 0;

  useEffect(() => {
    if (!cooldownUntil) {
      return undefined;
    }

    const interval = setInterval(() => {
      const nextNow = Date.now();
      setNow(nextNow);

      if (nextNow >= cooldownUntil) {
        setCooldownUntil(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownUntil]);

  function openCountryPicker() {
    if (Platform.OS === 'ios') {
      const countryOptions = COUNTRY_OPTIONS.map((country) => (
        `${country.flag} ${country.countryName} ${country.dialCode}`
      ));
      const cancelButtonIndex = countryOptions.length;

      ActionSheetIOS.showActionSheetWithOptions(
        {
          cancelButtonIndex,
          options: [...countryOptions, 'Cancel'],
          title: 'Country code'
        },
        (buttonIndex) => {
          if (buttonIndex !== cancelButtonIndex) {
            handleSelectCountry(COUNTRY_OPTIONS[buttonIndex]);
          }
        }
      );
      return;
    }

    setIsCountryPickerOpen(true);
  }

  function handlePhoneNumberChange(nextPhoneNumber: string) {
    const parsedPhoneNumber = parsePhoneNumberInput(nextPhoneNumber, selectedCountry);

    setSelectedCountry(parsedPhoneNumber.country);
    setPhoneNumber(formatPhoneNumber(parsedPhoneNumber.nationalDigits, parsedPhoneNumber.country));
  }

  function handleSelectCountry(nextCountry: CountryOption) {
    const nextDigits = limitPhoneDigits(phoneNumber, nextCountry);
    setSelectedCountry(nextCountry);
    setPhoneNumber(formatPhoneNumber(nextDigits, nextCountry));
    setIsCountryPickerOpen(false);
  }

  async function handleSendCode() {
    setError(null);

    if (cooldownSeconds > 0) {
      setError(`Please wait ${cooldownSeconds} seconds before requesting another code.`);
      return;
    }

    setIsSending(true);

    try {
      const phoneNumberForAuth = `${selectedCountry.dialCode}${nationalDigits}`;

      await requestOtpPreflight(phoneNumberForAuth);

      const session = await sendOrgAdminPhoneCode(
        phoneNumberForAuth,
        recaptchaVerifier.current
      );
      setCooldownUntil(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
      onCodeSent(session);
    } catch (nextError) {
      const nextMessage = getUserAuthMessage(nextError, 'We could not send a code. Check the number and try again.');

      if (isNetworkConnectionMessage(nextMessage)) {
        Alert.alert('Connection unavailable', nextMessage);
      } else {
        setError(nextMessage);
      }
    } finally {
      setIsSending(false);
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
          <Text style={styles.title}>Get started with your number</Text>
        </View>

        {!isFirebaseConfigured ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Secure sign-in is unavailable right now.</Text>
          </View>
        ) : null}

        <View style={styles.formGroup}>
          <View style={styles.phoneBox}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Select country code, current ${selectedCountry.countryName} ${selectedCountry.dialCode}`}
              onPress={openCountryPicker}
              style={({ pressed }) => [
                styles.countryPicker,
                pressed && styles.countryPickerPressed
              ]}
            >
              <Text style={styles.flagText}>{selectedCountry.flag}</Text>
              <Text style={styles.codeText}>{selectedCountry.dialCode}</Text>
            </Pressable>
            <View style={styles.phoneDivider} />
            <TextInput
              value={phoneNumber}
              onChangeText={handlePhoneNumberChange}
              autoComplete="tel"
              autoCorrect={false}
              importantForAutofill="yes"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              placeholder={selectedCountry.placeholder}
              placeholderTextColor="#64748B"
              style={styles.phoneInput}
            />
          </View>
          <Text style={styles.helperText}>We will text you a one-time code.</Text>
        </View>

        {error ? (
          <DismissibleError message={error} onDismiss={() => setError(null)} />
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={isSending || !isFirebaseConfigured || !isPhoneNumberComplete || cooldownSeconds > 0}
          onPress={handleSendCode}
          style={({ pressed }) => [
            styles.sendButton,
            pressed && !isSending && styles.pressed,
            (isSending || !isFirebaseConfigured || !isPhoneNumberComplete || cooldownSeconds > 0) && styles.disabled
          ]}
        >
          <Text style={styles.sendButtonText}>
            {getSendButtonLabel(isSending, cooldownSeconds)}
          </Text>
        </Pressable>

        {isSending ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={isCountryPickerOpen}
        onRequestClose={() => setIsCountryPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close country code selector"
            onPress={() => setIsCountryPickerOpen(false)}
            style={styles.modalDismissArea}
          />
          <View style={styles.countryMenu}>
            <View style={styles.countryMenuHeader}>
              <Text style={styles.countryMenuTitle}>Country code</Text>
            </View>
            {COUNTRY_OPTIONS.map((country) => (
              <Pressable
                accessibilityRole="button"
                key={country.countryCode}
                onPress={() => handleSelectCountry(country)}
                style={({ pressed }) => [
                  styles.countryOption,
                  country.countryCode === selectedCountry.countryCode && styles.countryOptionSelected,
                  pressed && styles.countryOptionPressed
                ]}
              >
                <View style={styles.countryOptionIdentity}>
                  <Text style={styles.countryOptionFlag}>{country.flag}</Text>
                  <Text style={styles.countryOptionName}>{country.countryName}</Text>
                </View>
                <Text style={styles.countryOptionCode}>
                  {country.countryCode} {country.dialCode}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getPhoneDigits(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, '');
}

function parsePhoneNumberInput(
  phoneNumber: string,
  currentCountry: CountryOption
): { country: CountryOption; nationalDigits: string } {
  const rawPhoneNumber = phoneNumber.trim();
  const phoneDigits = getPhoneDigits(phoneNumber);
  const looksInternational = rawPhoneNumber.startsWith('+') || phoneDigits.length > currentCountry.maxDigits;
  const internationalDigits = looksInternational && phoneDigits.startsWith('00')
    ? phoneDigits.slice(2)
    : phoneDigits;
  const country = looksInternational ? getCountryFromPhoneDigits(internationalDigits, currentCountry) : currentCountry;
  const nationalDigits = looksInternational
    ? stripDialCodeDigits(internationalDigits, country).slice(0, country.maxDigits)
    : phoneDigits.slice(0, country.maxDigits);

  return {
    country,
    nationalDigits
  };
}

function getCountryFromPhoneDigits(digits: string, currentCountry: CountryOption): CountryOption {
  const currentDialCodeDigits = getPhoneDigits(currentCountry.dialCode);

  if (digits.startsWith(currentDialCodeDigits)) {
    return currentCountry;
  }

  return COUNTRY_OPTIONS
    .slice()
    .sort((firstCountry, secondCountry) => (
      getPhoneDigits(secondCountry.dialCode).length - getPhoneDigits(firstCountry.dialCode).length
    ))
    .find((country) => digits.startsWith(getPhoneDigits(country.dialCode))) || currentCountry;
}

function stripDialCodeDigits(digits: string, country: CountryOption): string {
  const dialCodeDigits = getPhoneDigits(country.dialCode);

  if (digits.startsWith(dialCodeDigits)) {
    return digits.slice(dialCodeDigits.length);
  }

  return digits;
}

function limitPhoneDigits(phoneNumber: string, country: CountryOption): string {
  return getPhoneDigits(phoneNumber).slice(0, country.maxDigits);
}

function formatPhoneNumber(digits: string, country: CountryOption): string {
  if (country.countryCode === 'US' || country.countryCode === 'CA') {
    return formatNorthAmericanNumber(digits);
  }

  if (country.countryCode === 'MX') {
    return formatDigitsWithGroups(digits, [2, 4, 4]);
  }

  if (country.countryCode === 'UK') {
    return formatDigitsWithGroups(digits, [4, 6]);
  }

  return formatDigitsWithGroups(digits, [3, 3, 4]);
}

function formatNorthAmericanNumber(digits: string): string {
  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

function formatDigitsWithGroups(digits: string, groups: number[]): string {
  const parts: string[] = [];
  let cursor = 0;

  groups.forEach((groupSize) => {
    const part = digits.slice(cursor, cursor + groupSize);

    if (part) {
      parts.push(part);
    }

    cursor += groupSize;
  });

  return parts.join(' ');
}

function getSendButtonLabel(isSending: boolean, cooldownSeconds: number): string {
  if (isSending) {
    return 'Sending...';
  }

  if (cooldownSeconds > 0) {
    return `Send again in ${cooldownSeconds}s`;
  }

  return 'Send code';
}

function isNetworkConnectionMessage(message: string): boolean {
  return /network|connection/i.test(message);
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
    gap: 24,
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
    gap: 0
  },
  title: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 33
  },
  formGroup: {
    gap: 8,
    marginTop: 10
  },
  phoneBox: {
    alignItems: 'center',
    borderBottomColor: 'rgba(15, 118, 110, 0.35)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 54,
    paddingHorizontal: 2
  },
  helperText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '400',
    paddingLeft: 2
  },
  countryPicker: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    minWidth: 88
  },
  countryPickerPressed: {
    opacity: 0.7
  },
  flagText: {
    fontSize: 21,
    lineHeight: 25
  },
  codeText: {
    color: '#253244',
    fontSize: 17,
    fontWeight: '400'
  },
  phoneDivider: {
    backgroundColor: 'rgba(100, 116, 139, 0.4)',
    height: 28,
    marginHorizontal: 12,
    width: 1
  },
  phoneInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 17,
    fontWeight: '400',
    minHeight: 54
  },
  errorBox: {
    backgroundColor: 'rgba(254, 226, 226, 0.9)',
    borderColor: 'rgba(185, 28, 28, 0.18)',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  errorText: {
    color: colors.red,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19
  },
  sendButton: {
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
  sendButtonText: {
    color: colors.card,
    fontSize: 17,
    fontWeight: '400'
  },
  pressed: {
    opacity: 0.84
  },
  disabled: {
    opacity: 0.55
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 26
  },
  modalBackdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.32)',
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 28,
    paddingHorizontal: 16
  },
  modalDismissArea: {
    ...StyleSheet.absoluteFillObject
  },
  countryMenu: {
    backgroundColor: colors.card,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { height: 14, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 26
  },
  countryMenuHeader: {
    borderBottomColor: 'rgba(226, 232, 240, 0.92)',
    borderBottomWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 14
  },
  countryMenuTitle: {
    color: '#172033',
    fontSize: 16,
    fontWeight: '400'
  },
  countryOption: {
    alignItems: 'center',
    borderBottomColor: 'rgba(226, 232, 240, 0.9)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    minHeight: 66,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  countryOptionSelected: {
    backgroundColor: 'rgba(79, 111, 234, 0.08)'
  },
  countryOptionPressed: {
    backgroundColor: 'rgba(79, 111, 234, 0.16)'
  },
  countryOptionIdentity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12
  },
  countryOptionFlag: {
    fontSize: 23,
    lineHeight: 27
  },
  countryOptionName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '400'
  },
  countryOptionCode: {
    color: '#253244',
    fontSize: 16,
    fontWeight: '400'
  }
});
