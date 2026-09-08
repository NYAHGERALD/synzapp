import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { OrganizationDeletionChallenge } from '../../services/adminApi';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * Organization deletion.
 *
 * Lifted out of the chat screen unchanged.
 */

type OrganizationDeletionStep = 'warning' | 'otp' | 'verified' | 'deleting';

export interface OrganizationDeletionModalState {
  challenge: OrganizationDeletionChallenge | null;
  confirmationText: string;
  error: string | null;
  otpCode: string;
  step: OrganizationDeletionStep;
  verifiedIdToken: string | null;
}

export function OrganizationDeletionModal({
  isDeleting,
  isRequesting,
  isVerifying,
  onCancel,
  onChangeConfirmationText,
  onChangeOtpCode,
  onProceed,
  onSendOtp,
  onVerifyOtp,
  progressAnim,
  state
}: {
  isDeleting: boolean;
  isRequesting: boolean;
  isVerifying: boolean;
  onCancel: () => void;
  onChangeConfirmationText: (value: string) => void;
  onChangeOtpCode: (value: string) => void;
  onProceed: () => void;
  onSendOtp: () => void;
  onVerifyOtp: () => void;
  progressAnim: Animated.Value;
  state: OrganizationDeletionModalState | null;
}) {
  const appTheme = useAppTheme();

  if (!state) {
    return null;
  }

  const challenge = state.challenge;
  const requiredConfirmation = challenge?.requiredConfirmation || '';
  const canVerify = Boolean(
    challenge &&
    state.otpCode.trim().length >= 4 &&
    normalizeOrganizationDeletionConfirmation(state.confirmationText) ===
      normalizeOrganizationDeletionConfirmation(requiredConfirmation)
  );
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['14%', '92%']
  });

  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible
    >
      <View style={[
        styles.organizationDeletionOverlay,
        { backgroundColor: appTheme.colors.overlay }
      ]}>
        <View style={[
          styles.organizationDeletionCard,
          {
            backgroundColor: appTheme.colors.surfaceElevated,
            borderColor: appTheme.colors.border,
            borderWidth: StyleSheet.hairlineWidth
          }
        ]}>
          {state.step !== 'deleting' ? (
            <Pressable
              accessibilityLabel="Close delete organization"
              accessibilityRole="button"
              disabled={isRequesting || isVerifying}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.organizationDeletionClose,
                { backgroundColor: appTheme.colors.surface },
                pressed && !(isRequesting || isVerifying) && styles.pressed,
                (isRequesting || isVerifying) && styles.disabled
              ]}
            >
              <Feather color={appTheme.colors.mutedStrong} name="x" size={20} />
            </Pressable>
          ) : null}

          {state.step === 'warning' ? (
            <>
              <View style={styles.organizationDeletionIcon}>
                <Feather color="#FFFFFF" name="alert-triangle" size={25} />
              </View>
              <Text style={[styles.organizationDeletionTitle, { color: appTheme.colors.ink }]}>Delete organization?</Text>
              <Text style={[styles.organizationDeletionBody, { color: appTheme.colors.mutedStrong }]}>
                This permanently deletes organization chats, employees, encrypted files, devices, groups, departments, and tenant settings. This action cannot be reversed.
              </Text>
              <Text style={[styles.organizationDeletionBody, { color: appTheme.colors.mutedStrong }]}>
                We will send a verification code to the organization owner phone number before allowing deletion.
              </Text>
              {state.error ? (
                <Text style={[
                  styles.organizationDeletionError,
                  {
                    backgroundColor: appTheme.colors.amberSoft,
                    color: appTheme.colors.amber
                  }
                ]}>{state.error}</Text>
              ) : null}
              <View style={styles.organizationDeletionActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={isRequesting}
                  onPress={onCancel}
                  style={({ pressed }) => [
                    styles.organizationDeletionSecondaryButton,
                    { backgroundColor: appTheme.colors.surface },
                    pressed && !isRequesting && styles.pressed,
                    isRequesting && styles.disabled
                  ]}
                >
                  <Text style={[styles.organizationDeletionSecondaryText, { color: appTheme.colors.ink }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={isRequesting}
                  onPress={onSendOtp}
                  style={({ pressed }) => [
                    styles.organizationDeletionDangerButton,
                    pressed && !isRequesting && styles.pressed,
                    isRequesting && styles.disabled
                  ]}
                >
                  <Text style={styles.organizationDeletionDangerText}>
                    {isRequesting ? 'Sending...' : 'Send OTP'}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : null}

          {state.step === 'otp' && challenge ? (
            <>
              <Text style={[styles.organizationDeletionTitle, { color: appTheme.colors.ink }]}>Verify deletion</Text>
              <Text style={[styles.organizationDeletionBody, { color: appTheme.colors.mutedStrong }]}>
                Enter the verification code sent to your phone, then type the confirmation phrase below.
              </Text>
              <SettingsInput
                keyboardType="number-pad"
                onChangeText={onChangeOtpCode}
                placeholder="Verification code"
                value={state.otpCode}
              />
              <Text style={[styles.organizationDeletionHint, { color: appTheme.colors.muted }]}>
                Type {challenge.requiredConfirmation}
              </Text>
              <SettingsInput
                autoCapitalize="characters"
                onChangeText={onChangeConfirmationText}
                placeholder={challenge.requiredConfirmation}
                value={state.confirmationText}
              />
              {state.error ? (
                <Text style={[
                  styles.organizationDeletionError,
                  {
                    backgroundColor: appTheme.colors.amberSoft,
                    color: appTheme.colors.amber
                  }
                ]}>{state.error}</Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={!canVerify || isVerifying}
                onPress={onVerifyOtp}
                style={({ pressed }) => [
                  styles.organizationDeletionDangerButton,
                  pressed && canVerify && !isVerifying && styles.pressed,
                  (!canVerify || isVerifying) && styles.disabled
                ]}
              >
                <Text style={styles.organizationDeletionDangerText}>
                  {isVerifying ? 'Verifying...' : 'Verify account'}
                </Text>
              </Pressable>
            </>
          ) : null}

          {state.step === 'verified' && challenge ? (
            <>
              <View style={[styles.organizationDeletionVerifiedIcon, { backgroundColor: appTheme.colors.primary }]}>
                <Feather color="#FFFFFF" name="check" size={25} />
              </View>
              <Text style={[styles.organizationDeletionTitle, { color: appTheme.colors.ink }]}>Account verified</Text>
              <Text style={[styles.organizationDeletionBody, { color: appTheme.colors.mutedStrong }]}>
                Your account was verified. Proceeding will permanently delete {challenge.companyName} and sign out every user in this organization.
              </Text>
              {state.error ? (
                <Text style={[
                  styles.organizationDeletionError,
                  {
                    backgroundColor: appTheme.colors.amberSoft,
                    color: appTheme.colors.amber
                  }
                ]}>{state.error}</Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={isDeleting}
                onPress={onProceed}
                style={({ pressed }) => [
                  styles.organizationDeletionDangerButton,
                  pressed && !isDeleting && styles.pressed,
                  isDeleting && styles.disabled
                ]}
              >
                <Text style={styles.organizationDeletionDangerText}>Proceed</Text>
              </Pressable>
            </>
          ) : null}

          {state.step === 'deleting' ? (
            <>
              <Text style={[styles.organizationDeletionTitle, { color: appTheme.colors.ink }]}>Deleting organization</Text>
              <Text style={[styles.organizationDeletionBody, { color: appTheme.colors.mutedStrong }]}>
                Hang tight while we delete this tenant and its data. Keep the app open until this finishes.
              </Text>
              <View style={[
                styles.organizationDeletionProgressTrack,
                { backgroundColor: appTheme.colors.surface }
              ]}>
                <Animated.View
                  style={[
                    styles.organizationDeletionProgressFill,
                    { backgroundColor: appTheme.colors.primary },
                    { width: progressWidth }
                  ]}
                />
              </View>
              <Text style={[styles.organizationDeletionHint, { color: appTheme.colors.muted }]}>Securely signing users out and purging tenant data...</Text>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

export function SettingsInput({
  autoCapitalize = 'words',
  keyboardType,
  onChangeText,
  placeholder,
  value
}: {
  autoCapitalize?: React.ComponentProps<typeof TextInput>['autoCapitalize'];
  keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType'];
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const appTheme = useAppTheme();

  return (
    <View style={[
      styles.settingsInputBox,
      { borderBottomColor: appTheme.colors.separator, borderBottomWidth: 1 }
    ]}>
      <TextInput
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={appTheme.colors.muted}
        style={[styles.settingsInput, { color: appTheme.colors.ink }]}
        value={value}
      />
    </View>
  );
}

export function normalizeOrganizationDeletionConfirmation(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}
