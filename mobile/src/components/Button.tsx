import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { useAppTheme } from '../theme/AppThemeProvider';
import type { AppColors } from '../theme/colors';

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  style?: ViewStyle;
}

export function Button({ label, onPress, disabled, variant = 'primary', style }: ButtonProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.secondary,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style
      ]}
    >
      <Text style={[styles.label, variant === 'secondary' && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 18
  },
  primary: {
    backgroundColor: colors.primary
  },
  secondary: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1
  },
  label: {
    color: colors.card,
    fontSize: 17,
    fontWeight: '800'
  },
  secondaryLabel: {
    color: colors.ink
  },
  pressed: {
    opacity: 0.8
  },
  disabled: {
    opacity: 0.5
  }
  });
}
