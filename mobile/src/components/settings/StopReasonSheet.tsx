import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { PressableScale, SheetPresentation } from '../messages/SheetPresentation';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * Asking an administrator why, on Android.
 *
 * iOS has `Alert.prompt`, which is the system's own text prompt; Android has no
 * equivalent and React Native does not provide one. Rather than let one
 * platform stop a message without explaining itself, Android gets this — the
 * same question, in the app's own sheet.
 *
 * The reason is not paperwork. The person who wrote the message reads it, and
 * that is what the field says, so nobody types one believing it is private.
 */

const MIN_REASON_LENGTH = 8;

export function StopReasonSheet({
  onCancel,
  onChangeReason,
  onConfirm,
  reason,
  recipientName,
  senderName,
  visible
}: {
  onCancel: () => void;
  onChangeReason: (reason: string) => void;
  onConfirm: () => void;
  reason: string;
  recipientName: string;
  senderName: string;
  visible: boolean;
}) {
  const appTheme = useAppTheme();
  const canConfirm = reason.trim().length >= MIN_REASON_LENGTH;

  return (
    <SheetPresentation
      closeLabel="Leave the message alone"
      maxHeightPoints={420}
      maxHeightRatio={0.55}
      onClose={onCancel}
      visible={visible}
    >
      <View style={styles.messageReactionPickerHeader}>
        <View style={styles.messageReactionPickerHeaderText}>
          <Text style={[styles.messageReactionPickerEyebrow, { color: appTheme.colors.primary }]}>
            Stopping a message
          </Text>
          <Text style={[styles.messageReactionPickerTitle, { color: appTheme.colors.ink }]}>
            Why are you stopping this?
          </Text>
        </View>
      </View>

      <View style={styles.stopReasonBody}>
        <Text style={[styles.stopReasonNote, { color: appTheme.colors.mutedStrong }]}>
          {senderName} will not send this to {recipientName}, and will see the reason you give.
        </Text>
        <TextInput
          autoFocus
          multiline
          onChangeText={onChangeReason}
          placeholder="Give a reason"
          placeholderTextColor={appTheme.colors.muted}
          style={[
            styles.stopReasonInput,
            {
              backgroundColor: appTheme.colors.input,
              borderColor: appTheme.colors.border,
              color: appTheme.colors.ink
            }
          ]}
          value={reason}
        />

        <PressableScale
          accessibilityLabel="Stop this message"
          disabled={!canConfirm}
          onPress={onConfirm}
          style={[
            styles.stopReasonConfirm,
            {
              backgroundColor: canConfirm ? appTheme.colors.destructive : appTheme.colors.surface,
              borderColor: canConfirm ? appTheme.colors.destructive : appTheme.colors.border
            }
          ]}
        >
          <Text style={[
            styles.stopReasonConfirmText,
            { color: canConfirm ? '#FFFFFF' : appTheme.colors.muted }
          ]}>
            Stop this message
          </Text>
        </PressableScale>

        <PressableScale
          accessibilityLabel="Leave the message alone"
          onPress={onCancel}
          style={styles.stopReasonCancel}
        >
          <Text style={[styles.stopReasonCancelText, { color: appTheme.colors.mutedStrong }]}>
            Leave it
          </Text>
        </PressableScale>
      </View>
    </SheetPresentation>
  );
}
