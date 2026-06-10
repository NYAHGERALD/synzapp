import React from 'react';
import {
  KeyboardTypeOptions,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View
} from 'react-native';
import { colors } from '../theme/colors';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: KeyboardTypeOptions;
}

export function TextField({ label, value, onChangeText, keyboardType, ...props }: TextFieldProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholderTextColor="#8B95A5"
        autoCorrect={false}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 7
  },
  label: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '800'
  },
  input: {
    backgroundColor: '#FBFCFE',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 18,
    minHeight: 50,
    paddingHorizontal: 14
  }
});
