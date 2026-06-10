import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

interface DismissibleErrorProps {
  message: string;
  onDismiss: () => void;
}

export function DismissibleError({ message, onDismiss }: DismissibleErrorProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.message}>{message}</Text>
      <Pressable
        accessibilityLabel="Dismiss error message"
        accessibilityRole="button"
        onPress={onDismiss}
        hitSlop={8}
        style={({ pressed }) => [
          styles.dismissButton,
          pressed && styles.pressed
        ]}
      >
        <Text style={styles.dismissText}>X</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    backgroundColor: 'rgba(254, 226, 226, 0.9)',
    borderColor: 'rgba(185, 28, 28, 0.18)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 42,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 8
  },
  message: {
    color: colors.red,
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  dismissButton: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28
  },
  dismissText: {
    color: colors.red,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19
  },
  pressed: {
    opacity: 0.64
  }
});
