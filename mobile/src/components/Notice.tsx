import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme/AppThemeProvider';
import type { AppColors } from '../theme/colors';

interface NoticeProps {
  title: string;
  body: string;
  tone?: 'info' | 'error' | 'success';
}

export function Notice({ title, body, tone = 'info' }: NoticeProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const toneStyle = tone === 'error'
    ? styles.error
    : tone === 'success'
      ? styles.success
      : styles.info;

  return (
    <View style={[styles.root, toneStyle]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  root: {
    borderRadius: 8,
    gap: 5,
    padding: 13
  },
  info: {
    backgroundColor: colors.blueSoft
  },
  error: {
    backgroundColor: colors.amberSoft
  },
  success: {
    backgroundColor: colors.successSoft
  },
  title: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900'
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21
  }
  });
}
