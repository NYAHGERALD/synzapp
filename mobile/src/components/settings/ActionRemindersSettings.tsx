import Feather from '@expo/vector-icons/Feather';
import React, { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ActionReminderPolicy } from '../../services/adminApi';
import { PressableScale } from '../messages/SheetPresentation';
import { ListSection } from '../ui/GroupedList';
import { useAppTheme } from '../../theme/AppThemeProvider';
import type { AppColors } from '../../theme/colors';

/**
 * How often people are reminded about work they still owe.
 *
 * Deliberately a short screen. The request behind it was for custom times per
 * day; what it offers is off, once or twice — because the failure this feature
 * has to avoid is not "too few reminders", it is a person who turned them off
 * in week two and therefore never saw the overdue escalation in week nine.
 *
 * The escalation is the setting that actually stops work being missed, and it
 * is the one written in plain words at the bottom.
 */

const FREQUENCIES: { id: ActionReminderPolicy['frequency']; label: string; note: string }[] = [
  { id: 'OFF', label: 'Off', note: 'Nobody is reminded. Overdue work still escalates.' },
  { id: 'ONCE', label: 'Once a day', note: 'One summary each morning.' },
  { id: 'TWICE', label: 'Twice a day', note: 'Morning and afternoon, for shift patterns.' }
];

const ESCALATION_CHOICES: { hours: number | null; label: string }[] = [
  { hours: 4, label: 'After 4 hours' },
  { hours: 8, label: 'After 8 hours' },
  { hours: 24, label: 'After a day' },
  { hours: 48, label: 'After two days' },
  { hours: null, label: 'Never' }
];

export function ActionRemindersSettings({
  isLoading,
  isSaving,
  onUpdate,
  policy
}: {
  isLoading: boolean;
  isSaving: boolean;
  onUpdate: (next: Partial<ActionReminderPolicy>) => void;
  policy: ActionReminderPolicy | null;
}) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);

  if (isLoading || !policy) {
    return (
      <View style={styles.state}>
        <ActivityIndicator color={appTheme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <ListSection
        footer={`Times are in ${policy.timeZone}. A reminder is one summary, not one notification per action, and none is sent when somebody has nothing outstanding.`}
        title="How often"
      >
        {FREQUENCIES.map((option) => (
          <ChoiceRow
            disabled={isSaving}
            isSelected={option.id === policy.frequency}
            key={option.id}
            label={option.label}
            note={option.note}
            onPress={() => onUpdate({ frequency: option.id })}
            styles={styles}
          />
        ))}
      </ListSection>

      {policy.frequency !== 'OFF' ? (
        <ListSection footer="Reminders are held back outside working hours, unless something overdue is critical." title="When">
          <HourRow
            disabled={isSaving}
            hour={policy.firstReminderHour}
            label="First reminder"
            onChange={(firstReminderHour) => onUpdate({ firstReminderHour })}
            styles={styles}
          />
          {policy.frequency === 'TWICE' ? (
            <HourRow
              disabled={isSaving}
              hour={policy.secondReminderHour}
              label="Second reminder"
              onChange={(secondReminderHour) => onUpdate({ secondReminderHour })}
              styles={styles}
            />
          ) : null}
          <HourRow
            disabled={isSaving}
            hour={policy.workingHoursStartHour}
            label="Working hours start"
            onChange={(workingHoursStartHour) => onUpdate({ workingHoursStartHour })}
            styles={styles}
          />
          <HourRow
            disabled={isSaving}
            hour={policy.workingHoursEndHour}
            label="Working hours end"
            onChange={(workingHoursEndHour) => onUpdate({ workingHoursEndHour })}
            styles={styles}
          />
        </ListSection>
      ) : null}

      <ListSection
        footer="This is the setting that stops work being missed. A reminder somebody has ignored twice will be ignored a third time; their department admin being told will not."
        title="Overdue work reaches a department admin"
      >
        {ESCALATION_CHOICES.map((option) => (
          <ChoiceRow
            disabled={isSaving}
            isSelected={option.hours === policy.escalateOverdueAfterHours}
            key={option.label}
            label={option.label}
            onPress={() => onUpdate({ escalateOverdueAfterHours: option.hours })}
            styles={styles}
          />
        ))}
      </ListSection>
    </ScrollView>
  );
}

function ChoiceRow({
  disabled,
  isSelected,
  label,
  note,
  onPress,
  styles
}: {
  disabled: boolean;
  isSelected: boolean;
  label: string;
  note?: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const appTheme = useAppTheme();

  return (
    <PressableScale
      accessibilityLabel={label}
      disabled={disabled || isSelected}
      onPress={onPress}
      style={styles.row}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {note ? <Text style={styles.rowNote}>{note}</Text> : null}
      </View>
      {isSelected ? <Feather color={appTheme.colors.link} name="check" size={19} /> : null}
    </PressableScale>
  );
}

/**
 * An hour of the day, changed a step at a time.
 *
 * A stepper rather than a picker because the choice is one of twenty-four and
 * the value is nearly always a nudge from where it already is — opening a wheel
 * to move eight to nine is three taps to save one.
 */
function HourRow({
  disabled,
  hour,
  label,
  onChange,
  styles
}: {
  disabled: boolean;
  hour: number;
  label: string;
  onChange: (hour: number) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const appTheme = useAppTheme();

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowText} />
      <PressableScale
        accessibilityLabel={`${label} one hour earlier`}
        disabled={disabled}
        onPress={() => onChange((hour + 23) % 24)}
        style={styles.stepper}
      >
        <Feather color={appTheme.colors.link} name="minus" size={18} />
      </PressableScale>
      <Text style={styles.hour}>{String(hour).padStart(2, '0')}:00</Text>
      <PressableScale
        accessibilityLabel={`${label} one hour later`}
        disabled={disabled}
        onPress={() => onChange((hour + 1) % 24)}
        style={styles.stepper}
      >
        <Feather color={appTheme.colors.link} name="plus" size={18} />
      </PressableScale>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    page: {
      gap: 8,
      paddingBottom: 32,
      paddingTop: 8
    },
    state: {
      alignItems: 'center',
      paddingVertical: 40
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 15,
      paddingVertical: 13
    },
    rowText: {
      flex: 1
    },
    rowLabel: {
      color: colors.ink,
      fontSize: 16
    },
    rowNote: {
      color: colors.muted,
      fontSize: 13,
      marginTop: 2
    },
    stepper: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 15,
      height: 30,
      justifyContent: 'center',
      width: 30
    },
    hour: {
      color: colors.ink,
      fontSize: 16,
      minWidth: 58,
      textAlign: 'center'
    }
  });
}
