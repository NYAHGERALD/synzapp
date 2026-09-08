import DateTimePicker from '@react-native-community/datetimepicker';
import Feather from '@expo/vector-icons/Feather';
import React, { useRef, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * Small controls shared by the screens that turn a chat message into something
 * trackable, and by the call scheduling screens.
 *
 * These used to live inside AddChatMessageToRailsModal, which made four
 * unrelated features depend on a RAILS file. Moved here unchanged so that file
 * can be removed without taking LSW To Do, LSW Follow Ups, the scheduled call
 * picker and the call history row down with it.
 *
 * Moved, not rewritten. Any behaviour change here is a bug.
 */

export function EditableChatActionText({
  isDisabled = false,
  label,
  maxLength,
  onChangeText,
  text
}: {
  isDisabled?: boolean;
  label: string;
  maxLength?: number;
  onChangeText: (text: string) => void;
  text: string;
}) {
  const appTheme = useAppTheme();
  const inputRef = useRef<TextInput>(null);
  const [isEditing, setIsEditing] = useState(false);

  const beginEditing = () => {
    if (isDisabled) {
      return;
    }

    setIsEditing(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  return (
    <View style={[
      styles.chatActionEditablePreview,
      {
        backgroundColor: appTheme.colors.primarySoft,
        borderColor: appTheme.colors.border
      }
    ]}>
      <View style={styles.chatActionEditableHeader}>
        <Text style={[styles.chatActionEditableLabel, { color: appTheme.colors.primary }]}>
          {label}
        </Text>
        <Pressable
          accessibilityLabel={`Edit ${label.toLowerCase()}`}
          accessibilityRole="button"
          disabled={isDisabled}
          onPress={beginEditing}
          style={({ pressed }) => [
            styles.chatActionEditableEditButton,
            {
              backgroundColor: appTheme.colors.surface,
              borderColor: appTheme.colors.border
            },
            pressed && !isDisabled && styles.pressed,
            isDisabled && styles.disabled
          ]}
        >
          <Feather color={appTheme.colors.primary} name="edit-3" size={14} />
        </Pressable>
      </View>
      {isEditing ? (
        <TextInput
          autoFocus
          editable={!isDisabled}
          maxLength={maxLength}
          multiline
          onBlur={() => setIsEditing(false)}
          onChangeText={onChangeText}
          placeholder="Type text"
          placeholderTextColor={appTheme.colors.muted}
          ref={inputRef}
          style={[
            styles.chatActionEditableInput,
            {
              backgroundColor: appTheme.colors.surface,
              borderColor: appTheme.colors.border,
              color: appTheme.colors.ink
            }
          ]}
          textAlignVertical="top"
          value={text}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={isDisabled}
          onPress={beginEditing}
          style={({ pressed }) => [
            pressed && !isDisabled && styles.pressed
          ]}
        >
          <Text numberOfLines={5} style={[styles.chatActionEditableText, { color: appTheme.colors.ink }]}>
            {text || 'Type text'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export function ChatLswDateControl({
  isDisabled = false,
  label,
  mode,
  onChange,
  onPick,
  value
}: {
  isDisabled?: boolean;
  label: string;
  mode: 'date' | 'time';
  onChange: (date: Date) => void;
  onPick: () => void;
  value: Date;
}) {
  const appTheme = useAppTheme();
  const displayValue = mode === 'date' ? formatScheduleDate(value) : formatScheduleTime(value);

  return (
    <View style={styles.chatLswDateControl}>
      {label ? (
        <Text style={[styles.chatLswFieldLabel, { color: appTheme.colors.mutedStrong }]}>
          {label}
        </Text>
      ) : null}
      {Platform.OS === 'ios' ? (
        <View style={[
          styles.chatLswNativeDateWrap,
          {
            backgroundColor: appTheme.colors.surface,
            borderColor: appTheme.colors.border
          }
        ]}>
          <DateTimePicker
            display="compact"
            disabled={isDisabled}
            minimumDate={mode === 'date' ? new Date() : undefined}
            mode={mode}
            onChange={(_, selectedDate) => {
              if (selectedDate) {
                onChange(selectedDate);
              }
            }}
            themeVariant={appTheme.isDark ? 'dark' : 'light'}
            value={value}
          />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={isDisabled}
          onPress={onPick}
          style={({ pressed }) => [
            styles.chatLswPickerButton,
            {
              backgroundColor: appTheme.colors.surface,
              borderColor: appTheme.colors.border
            },
            pressed && !isDisabled && styles.pressed,
            isDisabled && styles.disabled
          ]}
        >
          <Text numberOfLines={1} style={[styles.chatLswPickerText, { color: appTheme.colors.ink }]}>
            {displayValue}
          </Text>
          <Feather
            color={appTheme.colors.mutedStrong}
            name={mode === 'date' ? 'calendar' : 'clock'}
            size={17}
          />
        </Pressable>
      )}
    </View>
  );
}

export function formatScheduleDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export function formatScheduleTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });
}
