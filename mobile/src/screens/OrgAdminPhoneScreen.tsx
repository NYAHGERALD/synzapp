import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { KeyboardAvoidingView as KeyboardAwareScreen } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveKeyboardVerticalOffset } from '../services/rootSafeArea';
import { CountryPickerModal } from '../components/auth/CountryPickerModal';
import {
  COUNTRY_DIAL_CODES,
  flagForCountry,
  type CountryDialCode
} from '../services/countryDialCodes';
import {
  acceptPhoneNumberInput,
  toE164,
  type PhoneNumberEntry
} from '../services/phoneNumberInput';
import { DismissibleError } from '../components/DismissibleError';
import { AuthRateLimitError, requestOtpPreflight } from '../services/backendAuth';
import { getUserAuthMessage } from '../services/authErrors';
import { sendOrgAdminPhoneCode } from '../services/phoneAuth';
import { FirebasePhoneSession } from '../types/auth';
import { useAppTheme } from '../theme/AppThemeProvider';
import type { AppColors } from '../theme/colors';

/** The country a number is being entered for. Defaults to the United States. */
const DEFAULT_COUNTRY: CountryDialCode =
  COUNTRY_DIAL_CODES.find((country) => country.code === 'US') || COUNTRY_DIAL_CODES[0];

const RESEND_COOLDOWN_SECONDS = 45;

interface OrgAdminPhoneScreenProps {
  onCodeSent: (session: FirebasePhoneSession) => void;
}

export function OrgAdminPhoneScreen({ onCodeSent }: OrgAdminPhoneScreenProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const insets = useSafeAreaInsets();
  const [selectedCountry, setSelectedCountry] = useState<CountryDialCode>(DEFAULT_COUNTRY);
  const [phoneEntry, setPhoneEntry] = useState<PhoneNumberEntry>(
    () => acceptPhoneNumberInput({ country: DEFAULT_COUNTRY.code, text: '' })
  );
  const [isCountryPickerOpen, setIsCountryPickerOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  // Complete means the reference recognises it as a real number for that
  // country, not that it reached some length. The length test this replaces
  // demanded exactly fourteen digits from everybody, so a correct ten digit
  // American number left the button greyed out and could never be sent.
  const isPhoneNumberComplete = phoneEntry.isValid;
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

  /**
   * Opens the searchable picker on both platforms.
   *
   * It used to be an iOS action sheet and an Android dialog, each listing four
   * countries inline. Neither can hold two hundred and forty, and an action
   * sheet has no search at all.
   */
  function openCountryPicker() {
    setIsCountryPickerOpen(true);
  }

  /**
   * Everything the field will accept is decided by the country.
   *
   * A digit past that country's longest legal number is simply not taken, so
   * the number in front of somebody is always one that could exist. Pasting a
   * full international number moves the picker to match it.
   */
  function handlePhoneNumberChange(nextPhoneNumber: string) {
    applyPhoneEntry(acceptPhoneNumberInput({
      country: phoneEntry.country,
      text: nextPhoneNumber
    }));
  }

  /**
   * Re-reads the digits already typed against the country just chosen.
   *
   * Switching from Germany, which allows fifteen, to France, which allows nine,
   * has to shorten and regroup what is there. Leaving it would show a number
   * that country cannot have.
   */
  function handleCountrySelected(country: CountryDialCode) {
    setIsCountryPickerOpen(false);
    applyPhoneEntry(acceptPhoneNumberInput({
      country: country.code,
      text: phoneEntry.nationalDigits
    }));
  }

  function applyPhoneEntry(entry: PhoneNumberEntry) {
    setPhoneEntry(entry);
    setSelectedCountry(findCountry(entry.country));
  }


  async function handleSendCode() {
    setError(null);

    if (cooldownSeconds > 0) {
      setError(`Please wait ${cooldownSeconds} seconds before requesting another code.`);
      return;
    }

    setIsSending(true);

    try {
      const phoneNumberForAuth = toE164(phoneEntry);

      if (!phoneNumberForAuth) {
        setError('That number does not look right for the country selected.');
        return;
      }

      await requestOtpPreflight(phoneNumberForAuth);

      const session = await sendOrgAdminPhoneCode(phoneNumberForAuth);
      setCooldownUntil(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
      onCodeSent(session);
    } catch (nextError) {
      const nextMessage = getUserAuthMessage(nextError, 'We could not send a code. Check the number and try again.');
      const retryAfterSeconds = getAuthRetryAfterSeconds(nextError);

      if (retryAfterSeconds) {
        setCooldownUntil(Date.now() + retryAfterSeconds * 1000);
      }

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
    <KeyboardAwareScreen
      // The real IME inset, read from the platform. React Native's own
      // KeyboardAvoidingView cannot work here: Android enforces edge to edge at
      // this SDK, so the window height never changes when the keyboard opens
      // and there is nothing for it to measure. Same reason as the chat
      // composer. See the keyboard section of mobile/CLAUDE.md.
      behavior="padding"
      // Puts back the top inset the app root's SafeAreaView applied above this
      // screen, which onLayout cannot see from in here.
      keyboardVerticalOffset={resolveKeyboardVerticalOffset({
        platform: Platform.OS,
        safeAreaTop: insets.top
      })}
      style={styles.screen}
    >
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

        <View style={styles.formGroup}>
          <View style={styles.phoneBox}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Select country code, current ${selectedCountry.name} ${selectedCountry.dialCode}`}
              onPress={openCountryPicker}
              style={({ pressed }) => [
                styles.countryPicker,
                pressed && styles.countryPickerPressed
              ]}
            >
              <Text style={styles.flagText}>{flagForCountry(selectedCountry.code)}</Text>
              <Text style={styles.codeText}>{selectedCountry.dialCode}</Text>
            </Pressable>
            <View style={styles.phoneDivider} />
            <TextInput
              value={phoneEntry.text}
              onChangeText={handlePhoneNumberChange}
              autoComplete="tel"
              autoCorrect={false}
              importantForAutofill="yes"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              placeholder={'Phone number'}
              placeholderTextColor={appTheme.colors.muted}
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
          disabled={isSending || !isPhoneNumberComplete || cooldownSeconds > 0}
          onPress={handleSendCode}
          style={({ pressed }) => [
            styles.sendButton,
            pressed && !isSending && styles.pressed,
            (isSending || !isPhoneNumberComplete || cooldownSeconds > 0) && styles.disabled
          ]}
        >
          <Text style={styles.sendButtonText}>
            {getSendButtonLabel(isSending, cooldownSeconds)}
          </Text>
        </Pressable>

        {isSending ? (
          <View style={styles.loading}>
            <ActivityIndicator color={appTheme.colors.primary} />
          </View>
        ) : null}
      </View>

      {/* Searchable, because an inline list works for four countries and not
          for two hundred and forty. */}
      <CountryPickerModal
        onClose={() => setIsCountryPickerOpen(false)}
        onSelect={handleCountrySelected}
        selectedCode={selectedCountry.code}
        visible={isCountryPickerOpen}
      />
    </KeyboardAwareScreen>
  );
}

/** The picker row for a country, so the flag and code match the number. */
function findCountry(code: string): CountryDialCode {
  return COUNTRY_DIAL_CODES.find((country) => country.code === code) || DEFAULT_COUNTRY;
}

function getSendButtonLabel(isSending: boolean, cooldownSeconds: number): string {
  if (isSending) {
    return 'Sending...';
  }

  if (cooldownSeconds > 0) {
    return `Try again in ${formatCooldown(cooldownSeconds)}`;
  }

  return 'Send code';
}

function getAuthRetryAfterSeconds(error: unknown): number | null {
  if (error instanceof AuthRateLimitError && error.retryAfterSeconds) {
    return error.retryAfterSeconds;
  }

  const retryAfterSeconds = Number((error as { retryAfterSeconds?: unknown } | null)?.retryAfterSeconds);

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.ceil(retryAfterSeconds);
  }

  return null;
}

function formatCooldown(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function isNetworkConnectionMessage(message: string): boolean {
  return /network|connection/i.test(message);
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
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 54,
    paddingHorizontal: 2
  },
  helperText: {
    color: colors.muted,
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
    color: colors.mutedStrong,
    fontSize: 17,
    fontWeight: '400'
  },
  phoneDivider: {
    backgroundColor: colors.border,
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
  sendButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.blue,
    // Fully rounded, and sized to its label rather than stretched wide. A slab
    // that size reads as part of the page rather than as a control, and the
    // heavy glow under it was doing the same.
    borderRadius: 24,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 148,
    paddingHorizontal: 28
  },
  sendButtonText: {
    color: '#FFFFFF',
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
  }
});
}
