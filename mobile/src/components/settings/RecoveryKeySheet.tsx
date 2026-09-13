import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { PressableScale, SheetPresentation } from '../messages/SheetPresentation';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * Asking for a backup recovery key, on Android.
 *
 * iOS has `Alert.prompt`; Android has no equivalent and React Native provides
 * none. Without this, an organization that allows self-service restore would
 * still send Android users away to wait for an administrator — which is the
 * opposite of what the policy says.
 *
 * Only shown where the organization has switched self-service restore on. Where
 * it has not, the key was never given to the person and asking for one would be
 * an invitation to fail.
 */

export function RecoveryKeySheet({
  onCancel,
  onChangeRecoveryKey,
  onConfirm,
  recoveryKey,
  visible
}: {
  onCancel: () => void;
  onChangeRecoveryKey: (recoveryKey: string) => void;
  onConfirm: () => void;
  recoveryKey: string;
  visible: boolean;
}) {
  const appTheme = useAppTheme();
  const canConfirm = recoveryKey.trim().length > 0;

  return (
    <SheetPresentation
      closeLabel="Cancel restoring chats"
      maxHeightPoints={420}
      maxHeightRatio={0.55}
      onClose={onCancel}
      visible={visible}
    >
      <View style={styles.messageReactionPickerHeader}>
        <View style={styles.messageReactionPickerHeaderText}>
          <Text style={[styles.messageReactionPickerEyebrow, { color: appTheme.colors.primary }]}>
            Restoring your chats
          </Text>
          <Text style={[styles.messageReactionPickerTitle, { color: appTheme.colors.ink }]}>
            Enter your recovery key
          </Text>
        </View>
      </View>

      <View style={styles.stopReasonBody}>
        <Text style={[styles.stopReasonNote, { color: appTheme.colors.mutedStrong }]}>
          Your organization allows restoring without waiting for an administrator.
          This is the key you were shown when encrypted backup was first set up.
        </Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          multiline
          onChangeText={onChangeRecoveryKey}
          placeholder="Paste or type your recovery key"
          placeholderTextColor={appTheme.colors.muted}
          style={[
            styles.stopReasonInput,
            {
              backgroundColor: appTheme.colors.input,
              borderColor: appTheme.colors.border,
              color: appTheme.colors.ink
            }
          ]}
          value={recoveryKey}
        />

        <PressableScale
          accessibilityLabel="Restore my chats"
          disabled={!canConfirm}
          onPress={onConfirm}
          style={[
            styles.stopReasonConfirm,
            {
              backgroundColor: canConfirm ? appTheme.colors.primary : appTheme.colors.surface,
              borderColor: canConfirm ? appTheme.colors.primary : appTheme.colors.border
            }
          ]}
        >
          <Text style={[
            styles.stopReasonConfirmText,
            { color: canConfirm ? '#FFFFFF' : appTheme.colors.muted }
          ]}>
            Restore my chats
          </Text>
        </PressableScale>

        <PressableScale
          accessibilityLabel="Ask an administrator instead"
          onPress={onCancel}
          style={styles.stopReasonCancel}
        >
          <Text style={[styles.stopReasonCancelText, { color: appTheme.colors.mutedStrong }]}>
            I do not have it
          </Text>
        </PressableScale>
      </View>
    </SheetPresentation>
  );
}
