import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Feather from '@expo/vector-icons/Feather';
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ScheduleCallDraft } from '../../components/calls/ScheduleCallModal';
import { formatScheduleDate, formatScheduleTime } from '../../components/chat/chatActionControls';
import { getFullScreenModalTopPadding, getNativeFullHeightModalPresentationStyle } from '../../components/keyResults/KeyResultsSettings';
import { getKeyboardDismissMode } from '../../components/chatUiPrimitives';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Choosing when to schedule a call.
 *
 * Lifted out of the chat screen unchanged.
 */

export function ScheduleCallModal({
  draft,
  isOpen,
  onClose,
  onNext,
  onUpdateDraft
}: {
  draft: ScheduleCallDraft;
  isOpen: boolean;
  onClose: () => void;
  onNext: () => void;
  onUpdateDraft: (patch: Partial<ScheduleCallDraft>) => void;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const modalTopPadding = getFullScreenModalTopPadding(insets.top);

  return (
    <Modal
      allowSwipeDismissal={Platform.OS === 'ios'}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle={getNativeFullHeightModalPresentationStyle()}
      transparent={false}
      visible={isOpen}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scheduleCallContent,
          {
            backgroundColor: appTheme.colors.screen,
            paddingBottom: Math.max(insets.bottom + 28, 42),
            paddingTop: modalTopPadding
          }
        ]}
        keyboardDismissMode={getKeyboardDismissMode()}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.callModalHeader}>
          <Pressable
            accessibilityLabel="Close schedule call"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.newChatHeaderIconButton, pressed && styles.pressed]}
          >
            <Feather color={appTheme.colors.ink} name="x" size={24} />
          </Pressable>
          <Text numberOfLines={1} style={[styles.callModalHeaderTitle, { color: appTheme.colors.ink }]}>Schedule call</Text>
          <Pressable
            accessibilityLabel="Continue scheduled call"
            accessibilityRole="button"
            onPress={onNext}
            style={({ pressed }) => [
              styles.callModalNextButton,
              { backgroundColor: appTheme.colors.surfaceElevated },
              pressed && styles.pressed
            ]}
          >
            <Text style={[styles.callModalNextText, { color: appTheme.colors.ink }]}>Next</Text>
          </Pressable>
        </View>

        <View style={[styles.scheduleCallCard, { backgroundColor: appTheme.colors.surfaceElevated }]}>
          <TextInput
            onChangeText={(title) => onUpdateDraft({ title })}
            placeholder="Call title"
            placeholderTextColor={appTheme.colors.muted}
            style={[styles.scheduleCallTitleInput, { borderBottomColor: appTheme.colors.divider, color: appTheme.colors.ink }]}
            value={draft.title}
          />
          <TextInput
            multiline
            onChangeText={(description) => onUpdateDraft({ description })}
            placeholder="Add description (optional)"
            placeholderTextColor={appTheme.colors.muted}
            style={[styles.scheduleCallDescriptionInput, { color: appTheme.colors.ink }]}
            value={draft.description}
          />
          <Text style={[styles.scheduleCallCounter, { color: appTheme.colors.muted }]}>{2048 - draft.description.length}</Text>
        </View>

        <View style={[styles.scheduleCallCard, { backgroundColor: appTheme.colors.surfaceElevated }]}>
          <ScheduleDateTimeRow
            date={draft.startsAt}
            label="Starts"
            onChange={(startsAt) => onUpdateDraft({ startsAt })}
          />
          {draft.includeEndTime ? (
            <ScheduleDateTimeRow
              date={draft.endsAt}
              label="Ends"
              onChange={(endsAt) => onUpdateDraft({ endsAt })}
            />
          ) : null}
          <ScheduleSwitchRow
            label="Include end time"
            onValueChange={(includeEndTime) => onUpdateDraft({ includeEndTime })}
            value={draft.includeEndTime}
          />
        </View>

        <Text style={[styles.scheduleCallFootnote, { color: appTheme.colors.muted }]}>
          Events with call links can be scheduled up to one year in advance.
        </Text>

        <View style={[styles.scheduleCallCard, { backgroundColor: appTheme.colors.surfaceElevated }]}>
          <ScheduleOptionRow
            label="Call type"
            onPress={() => onUpdateDraft({ callType: draft.callType === 'video' ? 'voice' : 'video' })}
            value={draft.callType === 'video' ? 'Video' : 'Voice'}
          />
          <ScheduleSwitchRow
            label="Require approval to join"
            onValueChange={(requireApproval) => onUpdateDraft({ requireApproval })}
            value={draft.requireApproval}
          />
        </View>

        <View style={[styles.scheduleCallCard, { backgroundColor: appTheme.colors.surfaceElevated }]}>
          <ScheduleOptionRow
            label="Reminder"
            onPress={() => onUpdateDraft({ reminderMinutes: getNextReminderMinutes(draft.reminderMinutes) })}
            value={formatReminderMinutes(draft.reminderMinutes)}
          />
        </View>
      </ScrollView>
    </Modal>
  );
}

function ScheduleDateTimeRow({
  date,
  label,
  onChange
}: {
  date: Date;
  label: string;
  onChange: (date: Date) => void;
}) {
  const appTheme = useAppTheme();

  function openAndroidPicker(mode: 'date' | 'time') {
    DateTimePickerAndroid.open({
      display: mode === 'date' ? 'calendar' : 'clock',
      mode,
      onChange: (event, selectedDate) => {
        if (event.type === 'set' && selectedDate) {
          onChange(mergeDateTimeValue(date, selectedDate, mode));
        }
      },
      value: date
    });
  }

  return (
    <View style={[styles.scheduleDateTimeRow, { borderBottomColor: appTheme.colors.divider }]}>
      <Text style={[styles.scheduleRowLabel, { color: appTheme.colors.ink }]}>{label}</Text>
      <View style={styles.scheduleDateControls}>
        {Platform.OS === 'ios' ? (
          <>
            <DateTimePicker
              display="compact"
              mode="date"
              onChange={(_, selectedDate) => selectedDate ? onChange(mergeDateTimeValue(date, selectedDate, 'date')) : undefined}
              themeVariant={appTheme.isDark ? 'dark' : 'light'}
              value={date}
            />
            <DateTimePicker
              display="compact"
              mode="time"
              onChange={(_, selectedDate) => selectedDate ? onChange(mergeDateTimeValue(date, selectedDate, 'time')) : undefined}
              themeVariant={appTheme.isDark ? 'dark' : 'light'}
              value={date}
            />
          </>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => openAndroidPicker('date')}
              style={[styles.scheduleAndroidDateButton, { backgroundColor: appTheme.colors.surface }]}
            >
              <Text style={[styles.scheduleAndroidDateText, { color: appTheme.colors.ink }]}>{formatScheduleDate(date)}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => openAndroidPicker('time')}
              style={[styles.scheduleAndroidDateButton, { backgroundColor: appTheme.colors.surface }]}
            >
              <Text style={[styles.scheduleAndroidDateText, { color: appTheme.colors.ink }]}>{formatScheduleTime(date)}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function ScheduleSwitchRow({
  label,
  onValueChange,
  value
}: {
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={[styles.scheduleSwitchRow, { borderBottomColor: appTheme.colors.divider }]}
    >
      <Text style={[styles.scheduleRowLabel, { color: appTheme.colors.ink }]}>{label}</Text>
      <View style={[
        styles.scheduleSwitchTrack,
        { backgroundColor: value ? appTheme.colors.success : appTheme.colors.border }
      ]}>
        <View style={[
          styles.scheduleSwitchThumb,
          { transform: [{ translateX: value ? 22 : 0 }] }
        ]} />
      </View>
    </Pressable>
  );
}

function ScheduleOptionRow({
  label,
  onPress,
  value
}: {
  label: string;
  onPress: () => void;
  value: string;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.scheduleOptionRow,
        { borderBottomColor: appTheme.colors.divider },
        pressed && styles.pressed
      ]}
    >
      <Text style={[styles.scheduleRowLabel, { color: appTheme.colors.ink }]}>{label}</Text>
      <View style={styles.scheduleOptionValue}>
        <Text style={[styles.scheduleRowValue, { color: appTheme.colors.muted }]}>{value}</Text>
        <Feather color={appTheme.colors.muted} name="chevron-right" size={18} />
      </View>
    </Pressable>
  );
}

function mergeDateTimeValue(currentDate: Date, nextDate: Date, mode: 'date' | 'time'): Date {
  const mergedDate = new Date(currentDate);

  if (mode === 'date') {
    mergedDate.setFullYear(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
  } else {
    mergedDate.setHours(nextDate.getHours(), nextDate.getMinutes(), 0, 0);
  }

  return mergedDate;
}

function getNextReminderMinutes(currentReminder: number): number {
  const reminderOptions = [0, 5, 15, 30, 60];
  const currentIndex = reminderOptions.indexOf(currentReminder);
  return reminderOptions[(currentIndex + 1) % reminderOptions.length] || 15;
}

function formatReminderMinutes(minutes: number): string {
  if (minutes <= 0) {
    return 'At time of call';
  }

  if (minutes === 60) {
    return '1 hour before';
  }

  return `${minutes} minutes before`;
}
