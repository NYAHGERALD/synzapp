import Feather from '@expo/vector-icons/Feather';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ChatMessage, ChatReplyReference } from '../../services/chatApi';
import { getChatMessagePreview } from '../../services/chatMessagePreview';
import { describeReplyCount } from '../../services/replyThreads';
import { useAppTheme } from '../../theme/AppThemeProvider';
import type { AppColors } from '../../theme/colors';

/**
 * A run of replies in the conversation, and the message they answer.
 *
 * The message being answered **never moves**. It keeps its place in the history
 * and gains a count beneath it; the replies land at the bottom where they were
 * sent, like any other message. What ties the two together across that distance
 * is this group: a wireframe copy of the original at the head of it, and a
 * bracket rail down the left holding the replies inside.
 *
 * The copy is drawn as an outline rather than a bubble because it is context,
 * not a message. Somebody scrolling past should be able to tell at a glance
 * that it is a quotation of something further up, not another thing that was
 * said here.
 *
 * See SYNZAPP_REPLY_THREADS_PLAN.md.
 */

export function ReplyGroupFrame({
  children,
  isGroupEnd,
  isGroupStart,
  isMine,
  isReplyToMine,
  onOpenParent,
  replyCount,
  replyTo,
  senderName
}: {
  children: React.ReactNode;
  isGroupEnd: boolean;
  isGroupStart: boolean;
  /** Whose replies these are. The bracket takes that side's colour. */
  isMine: boolean;
  /**
   * Who wrote the message being answered — which is not the same question.
   *
   * The bracket is coloured by whoever replied, so on its own it says nothing
   * about the quotation at the head of the group. Somebody answering their own
   * message and somebody answering yours drew the same shape, and the copy read
   * as though it belonged to whoever was replying.
   */
  isReplyToMine: boolean;
  /** Jumps to the message being answered, where it still sits. */
  onOpenParent?: (messageId: string) => void;
  replyCount: number;
  replyTo: ChatReplyReference;
  senderName: string;
}) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  // Green for what you said, blue for what they said — the same division the
  // bubbles already make, carried onto the mark that groups them.
  const bracketColor = isMine ? appTheme.colors.primary : appTheme.colors.link;
  // The same green and blue, asking the other question: not who replied, but
  // whose message is being quoted.
  const authorColor = isReplyToMine ? appTheme.colors.primary : appTheme.colors.link;

  return (
    <View style={[
      styles.groupRow,
      // A little more air than the 6 between ordinary messages, so a group
      // reads as one thing rather than as more of the same run. Only at its
      // ends: inside it the rows stay tight and the bracket stays unbroken.
      isGroupStart && styles.groupRowFirst,
      isGroupEnd && styles.groupRowLast
    ]}>
      {/*
        * One bracket drawn in three parts, because each reply is its own row in
        * the list and no single view can span them. The first row draws the top
        * arm, the last draws the bottom, and every row draws the spine — so the
        * bracket reads as one shape enclosing the copy and every answer under
        * it.
        */}
      <View style={[
        styles.bracket,
        // Reaches past the bottom of its row to bridge the gap the list puts
        // between messages. Without this the bracket arrives as one dash per
        // reply instead of a single unbroken line.
        !isGroupEnd && styles.bracketBridging
      ]}>
        {isGroupStart ? (
          <View style={[styles.bracketArmTop, { backgroundColor: bracketColor }]} />
        ) : null}
        <View style={[styles.bracketSpine, { backgroundColor: bracketColor }]} />
        {isGroupEnd ? (
          <View style={[styles.bracketArmBottom, { backgroundColor: bracketColor }]} />
        ) : null}
      </View>

      <View style={styles.groupContent}>
        {isGroupStart ? (
          <Pressable
            accessibilityHint="Goes to the message being answered"
            accessibilityLabel={`Replying to: ${replyTo.text}`}
            accessibilityRole="button"
            disabled={!onOpenParent}
            onPress={() => onOpenParent?.(replyTo.messageId)}
            style={({ pressed }) => [
              styles.wireframe,
              { borderColor: bracketColor },
              pressed && onOpenParent && styles.pressed
            ]}
          >
            {/*
              * Who said it, always — a one-to-one included.
              *
              * This used to be shown only in groups, on the reasoning that with
              * two people it says nothing. It does: the quotation carries the
              * replier's colour, not the author's, so in a one-to-one there was
              * no signal at all for whether you were reading your own words or
              * theirs. Taking its colour from the author rather than the bracket
              * makes the two facts independent — the bracket says who answered,
              * this says who was answered.
              *
              * Just the name, the way every chat app quotes: the outline already
              * says "this is a quotation", so a "From" in front of it only
              * repeats the shape and eats room a name needs on a phone.
              */}
            {senderName ? (
              <Text numberOfLines={1} style={[styles.wireframeSender, { color: authorColor }]}>
                {senderName}
              </Text>
            ) : null}
            <Text numberOfLines={2} style={styles.wireframeText}>
              {replyTo.text}
            </Text>
          </Pressable>
        ) : null}

        {/* The badge hangs under the copy, so the head of the group says how
            many answers it holds without anybody counting bubbles. */}
        {isGroupStart ? (
          <ReplyCountBadge alignEnd={false} replyCount={replyCount} />
        ) : null}

        {children}
      </View>
    </View>
  );
}

/**
 * How many replies a message has, as a badge hanging under it.
 *
 * A small card rather than a line of text: it hangs off the bottom of the
 * bubble it belongs to, which is what makes it read as attached to that message
 * rather than as something said after it.
 *
 * Drawn under the original where it still sits, and under the wireframe copy at
 * the head of the group — the two ends of the same thread, each saying how much
 * is at the other end.
 */
export function ReplyCountBadge({
  alignEnd,
  onPress,
  replyCount
}: {
  alignEnd: boolean;
  onPress?: () => void;
  replyCount: number;
}) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const label = describeReplyCount(replyCount);

  if (!label) {
    return null;
  }

  return (
    <Pressable
      accessibilityHint={onPress ? 'Goes to the replies' : undefined}
      accessibilityLabel={label}
      accessibilityRole={onPress ? 'button' : 'text'}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.badge,
        alignEnd ? styles.badgeEnd : styles.badgeStart,
        {
          backgroundColor: appTheme.colors.groupedCard,
          borderColor: appTheme.colors.separator
        },
        pressed && onPress && styles.pressed
      ]}
    >
      <Feather
        color={onPress ? appTheme.colors.link : appTheme.colors.muted}
        name="corner-down-right"
        size={12}
      />
      <Text style={[
        styles.badgeText,
        { color: onPress ? appTheme.colors.link : appTheme.colors.muted }
      ]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The conversation, dimmed, with one message left in focus.
 *
 * It covers the message list and nothing else — the composer stays live
 * underneath, so a reply sent from here goes through exactly the same path as
 * any other message. There is no second composer to keep correct, which is the
 * whole reason it is drawn this way.
 *
 * Replies already sent in this session appear beneath the message, so somebody
 * answering three times can see the three answers without leaving.
 */
export function ReplyFocusOverlay({
  contactName,
  currentUid,
  onClose,
  parent,
  replies,
  topInset
}: {
  contactName: string;
  currentUid: string;
  onClose: () => void;
  parent: ChatMessage;
  replies: ChatMessage[];
  /**
   * Room for the chat header, which floats over this list.
   *
   * Without it the close button lands underneath the header and cannot be
   * reached — the one control that gets somebody out of focus, hidden behind
   * the one thing that is always on top.
   */
  topInset: number;
}) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const parentSender = parent.senderUid === currentUid ? 'You' : contactName;

  return (
    <View style={styles.focusRoot}>
      {/* Tapping the dimmed conversation leaves, which is how iMessage does it
          and what a thumb reaches for first. The close button is for people
          who look for a control rather than guess at a gesture. */}
      <Pressable
        accessibilityLabel="Leave reply focus"
        accessibilityRole="button"
        onPress={onClose}
        style={[styles.focusScrim, { backgroundColor: appTheme.colors.overlayStrong }]}
      />

      <View pointerEvents="box-none" style={[styles.focusContent, { paddingTop: topInset }]}>
        <Pressable
          accessibilityLabel="Leave reply focus"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onClose}
          style={({ pressed }) => [
            styles.focusClose,
            { backgroundColor: appTheme.colors.groupedCard },
            pressed && styles.pressed
          ]}
        >
          <Feather color={appTheme.colors.ink} name="x" size={20} />
        </Pressable>

        <ScrollView
          contentContainerStyle={styles.focusScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.focusSender}>{parentSender}</Text>
          <View style={[styles.focusParent, { backgroundColor: appTheme.colors.groupedCard }]}>
            <Text style={styles.focusParentText}>{getChatMessagePreview(parent)}</Text>
          </View>

          {replies.map((reply) => (
            <View
              key={reply.messageId}
              style={[
                styles.focusReply,
                reply.isMine ? styles.focusReplyMine : styles.focusReplyTheirs,
                {
                  backgroundColor: reply.isMine
                    ? appTheme.colors.primarySoft
                    : appTheme.colors.groupedCard
                }
              ]}
            >
              <Text style={styles.focusReplyText}>{getChatMessagePreview(reply)}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    groupRow: {
      flexDirection: 'row'
    },
    groupRowFirst: {
      marginTop: 12
    },
    groupRowLast: {
      marginBottom: 12
    },
    /**
     * The bracket, and it is meant to be seen.
     *
     * It carries the same blue as the outline on the copy at its head, so the
     * two read as one mark around the group rather than two decorations that
     * happen to be near each other.
     */
    bracket: {
      paddingLeft: 6,
      width: 22
    },
    // The list puts 6 between rows; the bracket has to cross it.
    bracketBridging: {
      marginBottom: -6
    },
    bracketSpine: {
      flex: 1,
      width: 2.5
    },
    bracketArmTop: {
      borderTopLeftRadius: 8,
      height: 2.5,
      width: 14
    },
    bracketArmBottom: {
      borderBottomLeftRadius: 8,
      height: 2.5,
      width: 14
    },
    groupContent: {
      flex: 1,
      minWidth: 0
    },
    /**
     * An outline and nothing else.
     *
     * No fill, so it cannot be mistaken for something said here. It is a
     * quotation of a message that is still in its own place further up.
     */
    wireframe: {
      alignSelf: 'flex-start',
      borderRadius: 16,
      borderWidth: 1.5,
      marginBottom: 5,
      marginTop: 4,
      maxWidth: '88%',
      paddingHorizontal: 12,
      paddingVertical: 8
    },
    wireframeSender: {
      fontSize: 12.5,
      lineHeight: 17,
      marginBottom: 1
    },
    wireframeText: {
      color: colors.mutedStrong,
      fontSize: 13.5,
      lineHeight: 18
    },
    // A card, not a line of text. It hangs off the bubble it belongs to.
    badge: {
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 5,
      marginTop: 3,
      paddingHorizontal: 9,
      paddingVertical: 4
    },
    badgeStart: {
      alignSelf: 'flex-start'
    },
    badgeEnd: {
      alignSelf: 'flex-end'
    },
    badgeText: {
      fontSize: 12,
      lineHeight: 16
    },
    focusRoot: {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 40
    },
    focusScrim: {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0
    },
    focusContent: {
      flex: 1,
      justifyContent: 'space-between',
      paddingBottom: 12,
      paddingHorizontal: 15
    },
    focusClose: {
      alignItems: 'center',
      alignSelf: 'flex-end',
      borderRadius: 20,
      elevation: 4,
      height: 40,
      justifyContent: 'center',
      marginBottom: 10,
      shadowColor: '#000000',
      shadowOffset: { height: 2, width: 0 },
      shadowOpacity: 0.16,
      shadowRadius: 6,
      width: 40
    },
    focusScroll: {
      flexGrow: 1,
      gap: 6,
      justifyContent: 'flex-end',
      paddingBottom: 4
    },
    focusSender: {
      color: '#FFFFFF',
      fontSize: 12.5,
      lineHeight: 17,
      marginLeft: 4
    },
    focusParent: {
      alignSelf: 'flex-start',
      borderRadius: 16,
      maxWidth: '86%',
      paddingHorizontal: 12,
      paddingVertical: 9
    },
    focusParentText: {
      color: colors.ink,
      fontSize: 15,
      lineHeight: 20
    },
    focusReply: {
      borderRadius: 16,
      maxWidth: '86%',
      paddingHorizontal: 12,
      paddingVertical: 9
    },
    focusReplyMine: {
      alignSelf: 'flex-end'
    },
    focusReplyTheirs: {
      alignSelf: 'flex-start'
    },
    focusReplyText: {
      color: colors.ink,
      fontSize: 15,
      lineHeight: 20
    },
    pressed: {
      opacity: 0.6
    }
  });
}
