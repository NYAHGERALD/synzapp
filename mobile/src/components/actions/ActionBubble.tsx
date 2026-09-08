import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useAppTheme } from '../../theme/AppThemeProvider';
import type { AppColors } from '../../theme/colors';
import type { ActionRecord } from '../../services/actionApi';
import {
  describeActionLine,
  describePriority,
  describeStatus,
  priorityColor,
  statusColor
} from '../../services/actionDisplay';

/**
 * An action, sitting in the conversation among the messages.
 *
 * Deliberately not a message bubble. It carries a priority stripe, a status
 * pill and an owner, so somebody scrolling a busy group chat can tell at a
 * glance that this is work rather than talk.
 *
 * Photos and video are collapsed to one thumbnail and a count. A fault report
 * with eight photos must not push the rest of the conversation off the screen.
 */
export function ActionBubble({
  action,
  onOpen,
  thumbnailUri
}: {
  action: ActionRecord;
  onOpen: () => void;
  /** First image, when one has been downloaded. Absent is normal. */
  thumbnailUri?: string | null;
}) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const stripe = priorityColor(action.priority, appTheme.isDark);
  const pill = statusColor(action.status, appTheme.isDark);

  return (
    <Pressable
      accessibilityHint="Opens the action so you can see it and change its status"
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.bubble, pressed && styles.pressed]}
    >
      <View style={[styles.stripe, { backgroundColor: stripe }]} />

      <View style={styles.body}>
        <View style={styles.head}>
          <Feather color={stripe} name="clipboard" size={13} />
          <Text style={[styles.kicker, { color: stripe }]}>
            Action · {describePriority(action.priority)}
          </Text>
          <View style={styles.headSpacer} />
          <View style={[styles.pill, { backgroundColor: pill }]}>
            <Text style={styles.pillText}>{describeStatus(action.status)}</Text>
          </View>
        </View>

        <Text numberOfLines={3} style={styles.title}>
          {action.bodyRemovedAtMs
            ? 'This action was removed under your organization’s retention rule.'
            : action.title}
        </Text>

        <Text numberOfLines={1} style={styles.line}>
          {describeActionLine(action)}
        </Text>

        {action.attachmentCount ? (
          <View style={styles.media}>
            {thumbnailUri ? (
              <Image source={{ uri: thumbnailUri }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbEmpty]}>
                <Feather color={appTheme.colors.muted} name="image" size={14} />
              </View>
            )}
            <Text style={styles.mediaText}>
              {action.attachmentCount === 1
                ? '1 photo or video'
                : `${action.attachmentCount} photos and videos`}
            </Text>
          </View>
        ) : null}

        <Text numberOfLines={1} style={styles.byline}>
          Raised by {action.createdByName} from {action.sourceChatName || 'a chat'}
        </Text>
      </View>

      <Feather color={appTheme.colors.muted} name="chevron-right" size={18} />
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    // Flat, like the sheets it opens. A drop shadow on a card inside a chat
    // was the only thing on this screen pretending to float.
    bubble: {
      alignItems: 'center',
      backgroundColor: colors.groupedCard,
      borderColor: colors.separator,
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: 10,
      marginHorizontal: 12,
      marginVertical: 6,
      overflow: 'hidden',
      paddingRight: 10
    },
    // Full height, doing the work a border cannot do inside rounded corners.
    stripe: {
      alignSelf: 'stretch',
      width: 5
    },
    body: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 11
    },
    head: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 5
    },
    kicker: {
      fontSize: 11,
      letterSpacing: 0.5,
      textTransform: 'uppercase'
    },
    headSpacer: {
      flex: 1
    },
    pill: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3
    },
    pillText: {
      color: '#FFFFFF',
      fontSize: 10.5,
      letterSpacing: 0.3
    },
    title: {
      color: colors.ink,
      fontSize: 15,
      lineHeight: 20,
      marginTop: 5
    },
    line: {
      color: colors.mutedStrong,
      fontSize: 13,
      marginTop: 4
    },
    media: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      marginTop: 8
    },
    thumb: {
      borderRadius: 6,
      height: 34,
      width: 34
    },
    thumbEmpty: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      justifyContent: 'center'
    },
    mediaText: {
      color: colors.muted,
      fontSize: 12.5
    },
    byline: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 6
    },
    pressed: {
      opacity: 0.9
    }
  });
}
