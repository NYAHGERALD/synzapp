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
import { ACCESS_DENIED_MESSAGE, isAccessDeniedError } from '../services/backendAuth';
import { signOutOrgAdmin, verifyOrgAdminPhoneCode } from '../services/phoneAuth';
import { FirebasePhoneSession, VerifiedOrgAdmin } from '../types/auth';
import { colors } from '../theme/colors';

interface OrgAdminCodeScreenProps {
  phoneSession: FirebasePhoneSession;
  onBack: () => void;
  onVerified: (verifiedAdmin: VerifiedOrgAdmin) => void;
}

export function OrgAdminCodeScreen({ phoneSession, onBack, onVerified }: OrgAdminCodeScreenProps) {
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const maskedPhoneNumber = maskPhoneNumber(phoneSession.phoneNumber);

  async function handleVerifyCode() {
    setError(null);
    setIsVerifying(true);

    try {
      const verifiedAdmin = await verifyOrgAdminPhoneCode(phoneSession, code);
      onVerified(verifiedAdmin);
    } catch (nextError) {
      if (isAccessDeniedError(nextError)) {
        setError(null);
        Alert.alert(
          'Access denied',
          ACCESS_DENIED_MESSAGE,
          [
            {
              onPress: () => {
                void signOutOrgAdmin().catch(() => undefined);
                onBack();
              },
              text: 'OK'
            }
          ]
        );
      } else {
        setError(getUserAuthMessage(nextError, 'Unable to verify code. Please try again.'));
      }
    } finally {
      setIsVerifying(false);
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
          <Text style={styles.title}>Enter the code sent to your number</Text>
          <Text style={styles.subtitle}>Code sent to {maskedPhoneNumber}</Text>
        </View>

        <View style={styles.formGroup}>
          <View style={styles.codeBox}>
            <TextInput
              value={code}
              onChangeText={setCode}
              autoComplete="sms-otp"
              keyboardType="number-pad"
              maxLength={8}
              placeholder="123456"
              placeholderTextColor="#64748B"
              style={styles.codeInput}
              textContentType="oneTimeCode"
            />
          </View>
        </View>

        {error ? (
          <DismissibleError message={error} onDismiss={() => setError(null)} />
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={isVerifying || code.trim().length < 4}
          onPress={handleVerifyCode}
          style={({ pressed }) => [
            styles.sendButton,
            pressed && !isVerifying && styles.pressed,
            (isVerifying || code.trim().length < 4) && styles.disabled
          ]}
        >
          <Text style={styles.sendButtonText}>{isVerifying ? 'Verifying...' : 'Verify phone'}</Text>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Use a different phone</Text>
        </Pressable>

        {isVerifying ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function maskPhoneNumber(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, '');
  const lastFourDigits = digits.slice(-4);

  return lastFourDigits ? `*****${lastFourDigits}` : '*****';
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
    marginBottom: 48
  },
  splashLogo: {
    height: 76,
    width: 230
  },
  header: {
    gap: 8
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 29
  },
  subtitle: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  formGroup: {
    gap: 8,
    marginTop: 10
  },
  codeBox: {
    alignItems: 'center',
    borderBottomColor: 'rgba(15, 118, 110, 0.35)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 54,
    paddingHorizontal: 2
  },
  codeInput: {
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
    fontWeight: '400',
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
  backButton: {
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 18
  },
  backButtonText: {
    color: '#253244',
    fontSize: 16,
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
