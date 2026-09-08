import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { normalizeManualInvitePhoneNumber } from '../../components/calls/CallKeypadModal';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Inviting someone by hand.
 *
 * Lifted out of the chat screen unchanged.
 */

export function ManualInviteModal({
  onCancel,
  onChangePhone,
  onConfirm,
  phone,
  visible
}: {
  onCancel: () => void;
  onChangePhone: (value: string) => void;
  onConfirm: () => void;
  phone: string;
  visible: boolean;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const canConfirm = Boolean(normalizeManualInvitePhoneNumber(phone));

  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          styles.manualInviteOverlay,
          {
            backgroundColor: appTheme.colors.overlay,
            paddingBottom: Math.max(insets.bottom, 18),
            paddingTop: Math.max(insets.top, 18)
          }
        ]}>
        <Pressable
          accessibilityLabel="Close add employee"
          accessibilityRole="button"
          onPress={onCancel}
          style={StyleSheet.absoluteFill}
        />

        <View style={[
          styles.manualInviteDialog,
          {
            backgroundColor: appTheme.colors.surfaceElevated,
            borderColor: appTheme.colors.border
          }
        ]}>
          <Text style={[styles.manualInviteTitle, { color: appTheme.colors.ink }]}>Add employee</Text>
          <Text style={[styles.manualInviteHelp, { color: appTheme.colors.mutedStrong }]}>
            Enter the phone number with country code, for example +1 (469) 555 4444.
          </Text>

          <View style={[
            styles.manualInviteInputBox,
            {
              backgroundColor: appTheme.colors.input,
              borderColor: appTheme.colors.border
            }
          ]}>
            <TextInput
              autoComplete="tel"
              autoCorrect={false}
              autoFocus
              keyboardType="phone-pad"
              onChangeText={onChangePhone}
              placeholder="+1 (469) 555 4444"
              placeholderTextColor={appTheme.colors.muted}
              style={[styles.manualInviteInput, { color: appTheme.colors.ink }]}
              textContentType="telephoneNumber"
              value={phone}
            />
          </View>

          <View style={styles.manualInviteActionRow}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [
                styles.manualInviteActionButton,
                { backgroundColor: appTheme.colors.surface },
                pressed && styles.pressed
              ]}
            >
              <Text style={[styles.manualInviteSecondaryText, { color: appTheme.colors.ink }]}>Cancel</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={!canConfirm}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.manualInviteActionButton,
                { backgroundColor: canConfirm ? appTheme.colors.primary : appTheme.colors.surface },
                pressed && canConfirm && styles.pressed,
                !canConfirm && styles.disabled
              ]}
            >
              <Text style={[
                styles.manualInvitePrimaryText,
                { color: canConfirm ? '#FFFFFF' : appTheme.colors.muted }
              ]}>
                Add
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
