import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import type { ScheduledChatMessage } from '../../services/chatApi';
import { PressableScale, SheetPresentation } from './SheetPresentation';
import { describeScheduledCounts } from '../../services/scheduledMessageDisplay';
import { formatScheduledTime } from '../../services/scheduleMessageTimes';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * The messages waiting to be sent in this conversation, and the ones that could
 * not be.
 *
 * They are deliberately not drawn in the thread. A bubble means a message that
 * was sent, and one sitting among the others saying "tomorrow" invites the
 * reader to believe the other person has it.
 *
 * **A failure is shown here until it is cleared**, and that is the point of
 * including them. A scheduled message that could not be sent used to disappear
 * from this list entirely: the person believed it had gone, and nothing ever
 * told them otherwise. Clearing one hides it without deleting the record.
 *
 * A message this phone cannot open still appears, without its text. It was
 * sealed on the person's other device or before this one was reinstalled — and
 * hiding it would leave them unable to stop something they cannot see.
 */

export function ScheduledMessagesSheet({
  busyScheduledMessageId,
  onCancel,
  onClose,
  onDismiss,
  onSendNow,
  scheduledMessages,
  visible
}: {
  busyScheduledMessageId: string | null;
  onCancel: (scheduledMessage: ScheduledChatMessage) => void;
  onClose: () => void;
  onDismiss: (scheduledMessage: ScheduledChatMessage) => void;
  onSendNow: (scheduledMessage: ScheduledChatMessage) => void;
  scheduledMessages: ScheduledChatMessage[];
  visible: boolean;
}) {
  const appTheme = useAppTheme();
  const now = new Date();
  const waitingCount = scheduledMessages.filter((message) => message.status === 'SCHEDULED').length;
  const stoppedCount = scheduledMessages.filter((message) => message.status === 'CANCELLED').length;
  const failedCount = scheduledMessages.length - waitingCount;

  return (
    <SheetPresentation closeLabel="Close scheduled messages" onClose={onClose} visible={visible}>
      <View style={styles.messageReactionPickerHeader}>
        <View style={styles.messageReactionPickerHeaderText}>
          <Text style={[styles.messageReactionPickerEyebrow, { color: appTheme.colors.primary }]}>
            {stoppedCount && !waitingCount ? 'Stopped' : failedCount && !waitingCount ? 'Could not send' : 'Waiting to send'}
          </Text>
          <Text numberOfLines={1} style={[styles.messageReactionPickerTitle, { color: appTheme.colors.ink }]}>
            {describeScheduledCounts(waitingCount, failedCount)}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Close scheduled messages"
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [
            styles.messageReactionPickerClose,
            {
              backgroundColor: appTheme.colors.surface,
              borderColor: appTheme.colors.border
            },
            pressed && styles.pressed
          ]}
        >
          <Feather color={appTheme.colors.mutedStrong} name="x" size={20} />
        </Pressable>
      </View>

      <ScrollView
        bounces={false}
        contentContainerStyle={styles.messageReactionPickerContent}
        showsVerticalScrollIndicator={false}
      >
        {scheduledMessages.map((scheduledMessage) => {
          const isBusy = busyScheduledMessageId === scheduledMessage.scheduledMessageId;
          const hasFailed = scheduledMessage.status === 'FAILED';
          // Stopped by somebody else. Its author is owed both facts: that it
          // did not go, and why an administrator decided that.
          const wasStopped = scheduledMessage.status === 'CANCELLED' && scheduledMessage.cancelledByAdmin;
          const needsClearing = hasFailed || wasStopped;

          return (
            <View
              key={scheduledMessage.scheduledMessageId}
              style={[styles.scheduledMessageRow, { borderBottomColor: appTheme.colors.border }]}
            >
              <Text
                numberOfLines={3}
                style={[
                  styles.scheduledMessagePreview,
                  { color: scheduledMessage.text ? appTheme.colors.ink : appTheme.colors.muted }
                ]}
              >
                {scheduledMessage.text || 'Written on another device'}
              </Text>

              {wasStopped ? (
                <View style={styles.scheduledMessageFailure}>
                  <Feather color={appTheme.colors.destructive} name="slash" size={14} />
                  <Text style={[styles.scheduledMessageWhen, { color: appTheme.colors.destructive }]}>
                    Stopped by your admin: {scheduledMessage.cancellationReason || 'no reason given'}
                  </Text>
                </View>
              ) : hasFailed ? (
                <View style={styles.scheduledMessageFailure}>
                  <Feather color={appTheme.colors.destructive} name="alert-circle" size={14} />
                  <Text style={[styles.scheduledMessageWhen, { color: appTheme.colors.destructive }]}>
                    {scheduledMessage.lastError || 'This message could not be sent.'}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.scheduledMessageWhen, { color: appTheme.colors.muted }]}>
                  {formatScheduledTime(new Date(scheduledMessage.releaseAtMs), now)}
                </Text>
              )}

              {isBusy ? (
                <ActivityIndicator color={appTheme.colors.primary} size="small" />
              ) : (
                <View style={styles.scheduledMessageActions}>
                  {needsClearing ? (
                    <PressableScale
                      accessibilityLabel="Clear this message from the list"
                      onPress={() => onDismiss(scheduledMessage)}
                    >
                      <Text style={[styles.scheduledMessageAction, { color: appTheme.colors.mutedStrong }]}>
                        Clear
                      </Text>
                    </PressableScale>
                  ) : (
                    <>
                      <PressableScale
                        accessibilityLabel="Send this message now"
                        onPress={() => onSendNow(scheduledMessage)}
                      >
                        <Text style={[styles.scheduledMessageAction, { color: appTheme.colors.primary }]}>
                          Send now
                        </Text>
                      </PressableScale>
                      <PressableScale
                        accessibilityLabel="Cancel this scheduled message"
                        onPress={() => onCancel(scheduledMessage)}
                      >
                        <Text style={[styles.scheduledMessageAction, { color: appTheme.colors.destructive }]}>
                          Cancel
                        </Text>
                      </PressableScale>
                    </>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SheetPresentation>
  );
}
