import React, { useMemo } from 'react';
import {
  KeyboardTypeOptions,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View
} from 'react-native';
import { useAppTheme } from '../theme/AppThemeProvider';
import type { AppColors } from '../theme/colors';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: KeyboardTypeOptions;
}

export function TextField({ label, value, onChangeText, keyboardType, ...props }: TextFieldProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);

  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholderTextColor={theme.colors.muted}
        autoCorrect={false}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  root: {
    gap: 7
  },
  label: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '800'
  },
  input: {
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 18,
    minHeight: 50,
    paddingHorizontal: 14
  }
  });
}
