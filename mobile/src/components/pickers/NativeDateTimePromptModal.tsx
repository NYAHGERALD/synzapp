import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * The date and time prompt.
 *
 * Lifted out of the chat screen unchanged.
 */

export interface NativeDateTimePromptState {
  mode: 'date' | 'time';
  onSelect: (value: Date | null) => void;
  title: string;
  value: Date;
}

export function NativeDateTimePromptModal({
  onClose,
  prompt
}: {
  onClose: () => void;
  prompt: NativeDateTimePromptState | null;
}) {
  const appTheme = useAppTheme();

  if (Platform.OS !== 'ios' || !prompt) {
    return null;
  }

  function handleCancel() {
    prompt?.onSelect(null);
    onClose();
  }

  return (
    <Modal
      animationType="fade"
      hardwareAccelerated
      onRequestClose={handleCancel}
      statusBarTranslucent
      transparent
      visible
    >
      <View style={styles.nativeDateTimePromptRoot}>
        <Pressable
          accessibilityLabel="Cancel date and time selection"
          accessibilityRole="button"
          onPress={handleCancel}
          style={[
            styles.nativeDateTimePromptBackdrop,
            { backgroundColor: appTheme.colors.overlay }
          ]}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.nativeDateTimePromptPanel,
            {
              backgroundColor: appTheme.colors.surfaceElevated,
              borderColor: appTheme.colors.border
            }
          ]}
        >
          <Text style={[styles.nativeDateTimePromptTitle, { color: appTheme.colors.ink }]}>
            {prompt.title}
          </Text>
          <Text style={[styles.nativeDateTimePromptHint, { color: appTheme.colors.muted }]}>
            Tap the native {prompt.mode === 'date' ? 'date' : 'time'} field to choose a value.
          </Text>
          <DateTimePicker
            display="compact"
            mode={prompt.mode}
            minimumDate={prompt.mode === 'date' ? new Date() : undefined}
            onChange={(event: DateTimePickerEvent, value?: Date) => {
              if (event.type === 'dismissed') {
                return;
              }

              if (!value) {
                return;
              }

              prompt.onSelect(prompt.mode === 'date' ? normalizeChatRailsDueDate(value) : value);
              onClose();
            }}
            style={styles.nativeDateTimePromptPicker}
            value={prompt.value}
          />
        </View>
      </View>
    </Modal>
  );
}

export function normalizeChatRailsDueDate(date: Date): Date {
  const nextDate = new Date(date);
  nextDate.setHours(12, 0, 0, 0);

  return nextDate;
}
