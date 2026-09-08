import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent
} from '@react-native-community/datetimepicker';
import Feather from '@expo/vector-icons/Feather';
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import {
  buildScheduleQuickOptions,
  formatScheduledTime
} from '../../services/scheduleMessageTimes';
import { PressableScale, SheetPresentation } from './SheetPresentation';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * Choosing when a message should go.
 *
 * Opened by holding the send button, which is where somebody's thumb already is
 * once the message is written. It offers the three times people actually pick —
 * later today, tomorrow morning, the start of the week — and then the phone's
 * own picker for everything else.
 *
 * The picker is the platform's, not a copy of it: `DateTimePicker` on iOS and
 * `DateTimePickerAndroid` on Android, the same components this app already uses
 * elsewhere. A lookalike wheel is the sort of thing that is nearly right for
 * years and wrong for anybody using large text or a screen reader.
 *
 * Android takes date and time in two steps because its pickers are two dialogs;
 * iOS takes both at once because its picker does.
 */

export function ScheduleMessageSheet({
  isScheduling,
  onClose,
  onSchedule,
  visible
}: {
  isScheduling: boolean;
  onClose: () => void;
  onSchedule: (at: Date) => void;
  visible: boolean;
}) {
  const appTheme = useAppTheme();
  const [now, setNow] = useState(() => new Date());
  const [customAt, setCustomAt] = useState<Date | null>(null);
  const [isIosPickerOpen, setIsIosPickerOpen] = useState(false);
  const quickOptions = useMemo(() => buildScheduleQuickOptions(now), [now]);

  useEffect(() => {
    if (visible) {
      // Read the clock when the sheet opens, not when the screen was built.
      // A phone left on a thread since this morning would otherwise offer
      // "later today" times that have already gone.
      setNow(new Date());
      setCustomAt(null);
      setIsIosPickerOpen(false);
    }
  }, [visible]);

  const earliest = new Date(now.getTime() + (2 * 60 * 1000));

  function openCustomPicker() {
    const startingPoint = customAt || quickOptions[0]?.at || new Date(now.getTime() + (60 * 60 * 1000));

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        display: 'calendar',
        minimumDate: earliest,
        mode: 'date',
        onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
          if (event.type !== 'set' || !selectedDate) {
            return;
          }

          DateTimePickerAndroid.open({
            display: 'clock',
            mode: 'time',
            onChange: (timeEvent: DateTimePickerEvent, selectedTime?: Date) => {
              if (timeEvent.type !== 'set' || !selectedTime) {
                return;
              }

              const at = new Date(selectedDate.getTime());

              at.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
              setCustomAt(at);
            },
            value: startingPoint
          });
        },
        value: startingPoint
      });

      return;
    }

    setCustomAt(startingPoint);
    setIsIosPickerOpen(true);
  }

  return (
    <SheetPresentation closeLabel="Close scheduling" onClose={onClose} visible={visible}>
      <View style={styles.messageReactionPickerHeader}>
            <View style={styles.messageReactionPickerHeaderText}>
              <Text style={[styles.messageReactionPickerEyebrow, { color: appTheme.colors.primary }]}>
                Send later
              </Text>
              <Text numberOfLines={1} style={[styles.messageReactionPickerTitle, { color: appTheme.colors.ink }]}>
                Choose when this message goes
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close scheduling"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [
                styles.messageReactionPickerClose,
                {
                  backgroundColor: appTheme.colors.surface,
                  borderColor: appTheme.colors.border
                },
                pressed && styles.pressed
              ]}
            >
              <Feather color={appTheme.colors.mutedStrong} name="x" size={20} />
            </Pressable>
          </View>

      <ScrollView
        bounces={false}
        contentContainerStyle={styles.messageReactionPickerContent}
        showsVerticalScrollIndicator={false}
      >
            {quickOptions.map((option) => (
              <ScheduleChoiceRow
                disabled={isScheduling}
                icon="clock"
                key={option.id}
                label={option.label}
                onPress={() => onSchedule(option.at)}
              />
            ))}

            <ScheduleChoiceRow
              disabled={isScheduling}
              icon="calendar"
              label={customAt ? formatScheduledTime(customAt, now) : 'Pick a date and time'}
              onPress={openCustomPicker}
            />

            {isIosPickerOpen && customAt ? (
              <View style={[styles.messageReactionPickerGroup, { alignItems: 'center' }]}>
                <DateTimePicker
                  display="inline"
                  minimumDate={earliest}
                  mode="datetime"
                  onChange={(_event: DateTimePickerEvent, selectedDate?: Date) => {
                    if (selectedDate) {
                      setCustomAt(selectedDate);
                    }
                  }}
                  value={customAt}
                />
              </View>
            ) : null}

            {customAt ? (
              <PressableScale
                accessibilityLabel={`Schedule for ${formatScheduledTime(customAt, now)}`}
                disabled={isScheduling}
                onPress={() => onSchedule(customAt)}
                style={[
                  styles.messageReactionPickerEmpty,
                  {
                    alignItems: 'center',
                    backgroundColor: appTheme.colors.primary,
                    borderColor: appTheme.colors.primary
                  }
                ]}
              >
                <Text style={[styles.messageReactionPickerEmptyText, { color: '#FFFFFF' }]}>
                  {isScheduling ? 'Scheduling…' : `Schedule for ${formatScheduledTime(customAt, now)}`}
                </Text>
              </PressableScale>
            ) : null}
      </ScrollView>
    </SheetPresentation>
  );
}

function ScheduleChoiceRow({
  disabled,
  icon,
  label,
  onPress
}: {
  disabled: boolean;
  icon: 'calendar' | 'clock';
  label: string;
  onPress: () => void;
}) {
  const appTheme = useAppTheme();

  return (
    <PressableScale
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.scheduleChoiceRow, { borderBottomColor: appTheme.colors.border }]}
    >
      <View style={[styles.scheduleChoiceIcon, { backgroundColor: appTheme.colors.primarySoft }]}>
        <Feather color={appTheme.colors.primary} name={icon} size={18} />
      </View>
      <Text numberOfLines={1} style={[styles.scheduleChoiceLabel, { color: appTheme.colors.ink }]}>
        {label}
      </Text>
      <Feather color={appTheme.colors.muted} name="chevron-right" size={18} />
    </PressableScale>
  );
}
