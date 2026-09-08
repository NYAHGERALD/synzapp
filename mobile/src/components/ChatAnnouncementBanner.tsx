import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme/AppThemeProvider';
import type { AppColors } from '../theme/colors';
import type { Announcement } from '../services/announcementApi';

/**
 * The amber bar at the top of a chat.
 *
 * Pinned above the messages, cannot be scrolled away, stays until confirmed.
 *
 * **It never blocks a message.** The composer, the send button and every other
 * action stay usable while it is showing. A blocking version was considered and
 * rejected: an acknowledgement obtained by locking somebody out of their work
 * chat proves they wanted their chat back, not that they read anything, and
 * putting an administrative task on top of an emergency channel in a warehouse
 * or on a ward is a safety risk. See section 8a of the plan.
 */
export function ChatAnnouncementBanner({
  announcement,
  onOpen,
  outstandingCount = 1
}: {
  announcement: Announcement;
  onOpen: () => void;
  /** How many are waiting on this person altogether, this one included. */
  outstandingCount?: number;
}) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);

  return (
    <Pressable
      accessibilityHint="Opens the announcement so you can read it and confirm"
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
    >
      <View style={styles.accent} />

      <View style={styles.text}>
        <Text style={styles.kicker}>
          {outstandingCount > 1
            ? `Announcement · ${outstandingCount} awaiting`
            : 'Announcement · please confirm'}
        </Text>
        <Text numberOfLines={2} style={styles.subject}>
          {announcement.subject}
        </Text>
        {announcement.body ? (
          <Text numberOfLines={2} style={styles.preview}>
            {announcement.body}
          </Text>
        ) : null}
        <Text numberOfLines={1} style={styles.byline}>
          From {announcement.createdByName}
        </Text>
      </View>

      {/* Says what pressing it leads to. "Read" alone sounds like the end of
          the job; the confirmation is the point. */}
      <View style={styles.button}>
        <Text style={styles.buttonText}>Read &amp;{'\n'}Acknowledge</Text>
      </View>
    </Pressable>
  );
}

function createStyles(_colors: AppColors) {
  return StyleSheet.create({
    // Floating rather than flush: margins, rounded corners and a real shadow,
    // so it reads as something laid on top of the conversation rather than a
    // strip welded to it.
    bar: {
      alignItems: 'center',
      backgroundColor: '#fef6e4',
      borderRadius: 14,
      elevation: 4,
      flexDirection: 'row',
      gap: 12,
      marginHorizontal: 12,
      marginTop: 10,
      marginBottom: 4,
      overflow: 'hidden',
      paddingLeft: 0,
      paddingRight: 14,
      paddingVertical: 12,
      shadowColor: '#3d2c00',
      shadowOffset: { height: 3, width: 0 },
      shadowOpacity: 0.18,
      shadowRadius: 8
    },
    // The amber edge, full height, doing the work a border cannot do inside
    // rounded corners.
    accent: {
      backgroundColor: '#e0a106',
      bottom: 0,
      left: 0,
      position: 'absolute',
      top: 0,
      width: 5
    },
    text: {
      flex: 1,
      minWidth: 0,
      paddingLeft: 17
    },
    kicker: {
      color: '#8a6400',
      fontSize: 11,
      fontWeight: '500',
      letterSpacing: 0.6,
      textTransform: 'uppercase'
    },
    subject: {
      color: '#3d2c00',
      fontSize: 15.5,
      fontWeight: '500',
      marginTop: 3
    },
    preview: {
      color: '#6b5000',
      fontSize: 13.5,
      lineHeight: 19,
      marginTop: 3
    },
    byline: {
      color: '#8a6400',
      fontSize: 12,
      marginTop: 4
    },
    button: {
      alignItems: 'center',
      backgroundColor: '#f0b429',
      borderRadius: 8,
      justifyContent: 'center',
      // Still comfortable for a gloved hand, no longer a slab.
      minHeight: 40,
      paddingHorizontal: 12,
      paddingVertical: 6
    },
    buttonText: {
      color: '#3d2c00',
      fontSize: 12.5,
      fontWeight: '500',
      lineHeight: 15,
      textAlign: 'center'
    },
    pressed: {
      opacity: 0.9
    }
  });
}
