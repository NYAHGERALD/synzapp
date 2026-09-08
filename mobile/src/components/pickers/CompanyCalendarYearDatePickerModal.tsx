import * as Calendar from 'expo-calendar';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { calendarYearMaximumDate, calendarYearMinimumDate } from '../../utils/calendarYear';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * The calendar year date picker.
 *
 * Lifted out of the chat screen unchanged.
 */

export function CompanyCalendarYearDatePickerModal({
  date,
  isOpen,
  onCancel,
  onChange,
  onConfirm
}: {
  date: Date;
  isOpen: boolean;
  onCancel: () => void;
  onChange: (date: Date) => void;
  onConfirm: () => void;
}) {
  const appTheme = useAppTheme();

  if (Platform.OS !== 'ios' || !isOpen) {
    return null;
  }

  return (
    <Modal animationType="slide" transparent visible onRequestClose={onCancel}>
      <View style={styles.companyCalendarPickerOverlay}>
        <Pressable
          accessibilityLabel="Close calendar picker"
          accessibilityRole="button"
          onPress={onCancel}
          style={styles.companyCalendarPickerBackdrop}
        />
        <View style={[styles.companyCalendarPickerSheet, { backgroundColor: appTheme.colors.background }]}>
          <View style={styles.companyCalendarPickerHeader}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={styles.companyCalendarPickerAction}>
              <Text style={[styles.companyCalendarPickerCancelText, { color: appTheme.colors.mutedStrong }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.companyCalendarPickerTitle, { color: appTheme.colors.ink }]}>Calendar year starts</Text>
            <Pressable accessibilityRole="button" onPress={onConfirm} style={styles.companyCalendarPickerAction}>
              <Text style={[styles.companyCalendarPickerDoneText, { color: appTheme.colors.primary }]}>Done</Text>
            </Pressable>
          </View>
          <DateTimePicker
            display="inline"
            maximumDate={calendarYearMaximumDate}
            minimumDate={calendarYearMinimumDate}
            mode="date"
            onChange={(_, selectedDate) => {
              if (selectedDate) {
                onChange(selectedDate);
              }
            }}
            value={date}
          />
        </View>
      </View>
    </Modal>
  );
}
