import React, { useMemo } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme/AppThemeProvider';
import type { AppColors } from '../theme/colors';
import type { Announcement } from '../services/announcementApi';
import { describeAcknowledgement, describeAudience } from '../services/announcementDisplay';

/**
 * One announcement in a list.
 *
 * A row, not a card. A card grows with whatever it contains, so a long notice
 * pushed everything below it off the screen and a list of five became a list of
 * one. A row is the same height whatever the notice says, and the words are
 * read where there is room for them: the full-height reader.
 *
 * There is no Acknowledge button here either. Confirming from a list means
 * confirming something you have not read, which is the difference between a
 * record that survives a question and one that does not.
 */
export function AnnouncementRow({
  announcement,
  isSender,
  onOpen
}: {
  announcement: Announcement;
  isSender: boolean;
  onOpen: () => void;
}) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);

  const needsReply = announcement.requiresAcknowledgement &&
    announcement.myStatus !== 'ACKNOWLEDGED' &&
    !isSender;

  return (
    <Pressable
      accessibilityHint="Opens the announcement"
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {/* A dot, not a badge. It marks the ones still owed without shouting. */}
      <View style={[styles.dot, needsReply ? styles.dotWaiting : styles.dotDone]} />

      <View style={styles.text}>
        <Text numberOfLines={1} style={styles.subject}>
          {announcement.subject}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          {isSender ? describeAudience(announcement) : `From ${announcement.createdByName}`}
          {' · '}
          {new Date(announcement.createdAtMs).toLocaleDateString()}
        </Text>
        <Text numberOfLines={1} style={[styles.status, needsReply && styles.statusWaiting]}>
          {isSender
            ? describeAcknowledgement(announcement)
            : needsReply
              ? 'Please confirm you have read this'
              : 'You confirmed this'}
        </Text>
      </View>

      <Feather color={appTheme.colors.muted} name="chevron-right" size={19} />
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    // No rule of its own. The card the rows sit in draws the lines between
    // them, so a border here would cut across its rounded corners.
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      minHeight: 74,
      paddingHorizontal: 16,
      paddingVertical: 14
    },
    dot: {
      borderRadius: 4,
      height: 8,
      width: 8
    },
    dotWaiting: {
      backgroundColor: colors.amber
    },
    dotDone: {
      backgroundColor: colors.divider
    },
    text: {
      flex: 1,
      minWidth: 0
    },
    subject: {
      color: colors.ink,
      fontSize: 16,
      lineHeight: 21
    },
    meta: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 2
    },
    status: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 2
    },
    statusWaiting: {
      color: colors.amber
    },
    pressed: {
      backgroundColor: colors.groupedBackground
    }
  });
}
