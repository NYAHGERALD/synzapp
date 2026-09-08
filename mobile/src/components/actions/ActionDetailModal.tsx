import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActionPersonChoice } from './CreateActionModal';
import { ReassignActionModal } from './ReassignActionModal';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/AppThemeProvider';
import type { AppColors } from '../../theme/colors';
import {
  cancelAction,
  changeActionStatus,
  getActionDetail,
  listActionAttachments,
  reassignAction,
  type ActionEvent,
  type ActionRecord,
  type ActionStatus,
  verifyAction
} from '../../services/actionApi';
import {
  describeOwner,
  describePriority,
  describeStatus,
  priorityColor,
  statusColor
} from '../../services/actionDisplay';
import { ListActionRow, ListRow, ListSection, ListTextRow } from '../ui/GroupedList';
import { ActionMediaViewer } from './ActionMediaViewer';
import { CircleIconButton, CircleIconSpacer } from '../ui/CircleIconButton';

// Android needs this switched on before any layout animation will run.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Short and soft. Anything longer reads as the screen being slow. */
function animateNext() {
  LayoutAnimation.configureNext(
    LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
  );
}

/**
 * One action, opened from the conversation.
 *
 * Laid out as the phone's own settings screens are: cards on a tinted ground,
 * hairline dividers, and actions as tinted text. No filled slabs and no
 * shadows, because three big buttons on one screen shout at somebody who only
 * wanted to read what happened.
 *
 * Marking it done asks for a note and then posts back on its own. There is no
 * separate send step: an extra tap after "done" is exactly where the loop
 * breaks, and some completions would never reach the chat that raised them.
 */
export function ActionDetailModal({
  action: initialAction,
  getIdToken,
  onChanged,
  onClose,
  people,
  visible
}: {
  action: ActionRecord;
  getIdToken: () => Promise<string>;
  onChanged: (action: ActionRecord) => void;
  onClose: () => void;
  /** Who this action could be moved to. Empty hides the option. */
  people: ActionPersonChoice[];
  visible: boolean;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const [action, setAction] = useState(initialAction);
  const [events, setEvents] = useState<ActionEvent[]>([]);
  const [attachments, setAttachments] = useState<Array<{
    attachmentId: string;
    kind: 'image' | 'video';
    sizeBytes: number;
    url: string;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [blockedReason, setBlockedReason] = useState('');
  const [asking, setAsking] = useState<'DONE' | 'BLOCKED' | 'CANCELLED' | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  // The content fades in once it has loaded, so the screen settles rather than
  // snapping from a spinner to a full page.
  const fade = useRef(new Animated.Value(0)).current;
  // Held in a ref so loading does not depend on the identity of a function the
  // caller may recreate on every render.
  const getIdTokenRef = useRef(getIdToken);

  getIdTokenRef.current = getIdToken;

  const load = useCallback(async () => {
    try {
      const detail = await getActionDetail({
        actionId: initialAction.actionId,
        idToken: await getIdTokenRef.current()
      });

      setAction(detail.action);
      setEvents(detail.events);
      setError(null);

      // Fetched separately because the links are signed and short lived, so
      // they cannot be cached with the rest of the record.
      if (detail.action.attachmentCount) {
        const media = await listActionAttachments({
          actionId: initialAction.actionId,
          idToken: await getIdTokenRef.current()
        });

        setAttachments(media.attachments);
      } else {
        setAttachments([]);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'That could not be loaded.');
    } finally {
      setIsLoading(false);
      Animated.timing(fade, {
        duration: 260,
        toValue: 1,
        useNativeDriver: true
      }).start();
    }
  }, [fade, initialAction.actionId]);

  useEffect(() => {
    if (visible) {
      fade.setValue(0);
      setIsLoading(true);
      setAsking(null);
      setCompletionNote('');
      setBlockedReason('');
      setViewingIndex(null);
      void load();
    }
  }, [fade, load, visible]);

  const apply = useCallback(async (input: {
    blockedReason?: string;
    note?: string;
    status: ActionStatus;
  }) => {
    setIsSaving(true);

    try {
      const updated = await changeActionStatus({
        actionId: action.actionId,
        blockedReason: input.blockedReason || null,
        idToken: await getIdTokenRef.current(),
        note: input.note || null,
        status: input.status
      });

      animateNext();
      setAction(updated);
      setAsking(null);
      setCompletionNote('');
      setBlockedReason('');
      onChanged(updated);
      await load();
    } catch (nextError) {
      Alert.alert(
        'Not saved',
        nextError instanceof Error ? nextError.message : 'That could not be saved.'
      );
    } finally {
      setIsSaving(false);
    }
  }, [action.actionId, load, onChanged]);

  /**
   * Confirming somebody else's work.
   *
   * The server refuses the person who marked it done, whatever they hold. The
   * row is shown rather than hidden, because a hidden control teaches nobody:
   * the refusal explains why.
   */
  const confirm = useCallback(async () => {
    setIsSaving(true);

    try {
      const updated = await verifyAction({
        actionId: action.actionId,
        idToken: await getIdTokenRef.current()
      });

      animateNext();
      setAction(updated);
      onChanged(updated);
      await load();
    } catch (nextError) {
      Alert.alert(
        'Not verified',
        nextError instanceof Error ? nextError.message : 'That could not be verified.'
      );
    } finally {
      setIsSaving(false);
    }
  }, [action.actionId, load, onChanged]);

  /**
   * Moving the action to somebody else, or back to the team.
   *
   * Offered to everybody and refused by the server where it should be, the same
   * way cancelling and verifying are. A control hidden from the person holding
   * the action teaches them nothing; a refusal that names the reason tells them
   * who to ask.
   */
  const reassign = useCallback(async (input: {
    detail: string;
    nextPersonUid: string | null;
    reasonId: string;
  }) => {
    setIsSaving(true);

    try {
      const updated = await reassignAction({
        actionId: action.actionId,
        detail: input.detail,
        idToken: await getIdTokenRef.current(),
        nextPersonUid: input.nextPersonUid,
        reasonId: input.reasonId
      });

      animateNext();
      setIsReassignOpen(false);
      setAction(updated);
      onChanged(updated);
      await load();
    } catch (nextError) {
      Alert.alert(
        'Not moved',
        nextError instanceof Error ? nextError.message : 'That could not be moved.'
      );
    } finally {
      setIsSaving(false);
    }
  }, [action.actionId, load, onChanged]);

  /**
   * Ending an action that will not be done.
   *
   * The row is offered to everybody and the server decides, the same way
   * verifying does. A control hidden from the person answerable for the action
   * teaches them nothing; a refusal that names the reason tells them who to ask.
   */
  const cancel = useCallback(async (reason: string) => {
    setIsSaving(true);

    try {
      const updated = await cancelAction({
        actionId: action.actionId,
        idToken: await getIdTokenRef.current(),
        reason
      });

      animateNext();
      setAsking(null);
      setCancellationReason('');
      setAction(updated);
      onChanged(updated);
      await load();
    } catch (nextError) {
      Alert.alert(
        'Not cancelled',
        nextError instanceof Error ? nextError.message : 'That could not be cancelled.'
      );
    } finally {
      setIsSaving(false);
    }
  }, [action.actionId, load, onChanged]);

  const openAsk = useCallback((next: 'DONE' | 'BLOCKED' | 'CANCELLED') => {
    animateNext();
    setAsking(next);
  }, []);

  const closeAsk = useCallback(() => {
    animateNext();
    setAsking(null);
  }, []);

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
      <View style={styles.sheet}>
        <View style={[styles.head, { paddingTop: insets.top + 12 }]}>
          <CircleIconButton action="close" disabled={isSaving} onPress={onClose} />
          <Text style={styles.headTitle}>Action</Text>
          <CircleIconSpacer />
        </View>

        {isLoading ? (
          <View style={styles.centre}>
            <ActivityIndicator color={appTheme.colors.primary} />
          </View>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            // The header is fixed, so only the scrolling part moves when the
            // keyboard opens.
            keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
            style={styles.grow}
          >
            <Animated.ScrollView
              contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 48 }]}
              keyboardShouldPersistTaps="handled"
              style={{ opacity: fade }}
            >
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.titleBlock}>
                <Text style={styles.title}>
                  {action.bodyRemovedAtMs
                    ? 'This action was removed under your organization’s retention rule. The record of what happened is kept below.'
                    : action.title}
                </Text>
                <View style={styles.tags}>
                  <View style={[styles.dot, { backgroundColor: statusColor(action.status, appTheme.isDark) }]} />
                  <Text style={styles.tagText}>{describeStatus(action.status)}</Text>
                  <View style={[styles.dot, { backgroundColor: priorityColor(action.priority, appTheme.isDark) }]} />
                  <Text style={styles.tagText}>{describePriority(action.priority)} priority</Text>
                </View>
              </View>

              <ListSection title="Details">
                <ListRow label="Responsible" value={describeOwner(action)} />
                <ListRow label="Team" value={action.responsibleGroupName} />
                <ListRow label="Raised by" value={action.createdByName} />
                <ListRow label="Raised in" value={action.sourceChatName || 'A chat'} />
                <ListRow label="Raised at" value={new Date(action.createdAtMs).toLocaleString()} />
                {action.dueAtMs ? (
                  <ListRow label="Due" value={new Date(action.dueAtMs).toLocaleDateString()} />
                ) : null}
                {action.blockedReason ? (
                  <ListRow label="Waiting on" value={action.blockedReason} />
                ) : null}
                {action.completionNote ? (
                  <ListRow label="What was done" value={action.completionNote} />
                ) : null}
              </ListSection>

              {/* Offered while the work is still live. Verified and cancelled
                  actions are records rather than jobs, and moving one would be
                  editing the record. */}
              {action.status !== 'VERIFIED' && action.status !== 'CANCELLED' ? (
                <ListSection footer="Both the person it leaves and the person it reaches see why.">
                  <Pressable
                    accessibilityRole="button"
                    disabled={isSaving}
                    onPress={() => setIsReassignOpen(true)}
                    style={({ pressed }) => [styles.moveRow, pressed && styles.pressed]}
                  >
                    <Feather color={appTheme.colors.link} name="user-check" size={19} />
                    <Text style={styles.moveRowText}>Move this to someone else</Text>
                    <Feather color={appTheme.colors.muted} name="chevron-right" size={19} />
                  </Pressable>
                </ListSection>
              ) : null}

              {attachments.length ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Photos and video</Text>
                  <View style={styles.galleryCard}>
                  <View style={styles.gallery}>
                    {attachments.map((item, position) => (
                      <Pressable
                        accessibilityLabel={item.kind === 'video' ? 'Open video' : 'Open photo'}
                        accessibilityRole="button"
                        key={item.attachmentId}
                        onPress={() => setViewingIndex(position)}
                        style={({ pressed }) => [styles.galleryItem, pressed && styles.pressedMedia]}
                      >
                        <Image source={{ uri: item.url }} style={styles.galleryImage} />
                        {item.kind === 'video' ? (
                          <View style={styles.playBadge}>
                            <Feather color="#FFFFFF" name="play" size={13} />
                          </View>
                        ) : null}
                      </Pressable>
                    ))}
                  </View>
                  </View>
                </View>
              ) : null}

              {asking === 'BLOCKED' ? (
                <ListSection footer="Say what it is waiting on, so the next person does not start over." title="What is it waiting on?">
                  <ListTextRow>
                    <TextInput
                      autoFocus
                      editable={!isSaving}
                      multiline
                      onChangeText={setBlockedReason}
                      placeholder="A part, an engineer, a line stop"
                      placeholderTextColor={appTheme.colors.muted}
                      style={styles.input}
                      textAlignVertical="top"
                      value={blockedReason}
                    />
                  </ListTextRow>
                  <ListActionRow
                    disabled={isSaving || !blockedReason.trim()}
                    label="Save"
                    onPress={() => void apply({ blockedReason: blockedReason.trim(), status: 'BLOCKED' })}
                  />
                  <ListActionRow disabled={isSaving} label="Cancel" onPress={closeAsk} />
                </ListSection>
              ) : null}

              {asking === 'DONE' ? (
                <ListSection
                  footer={`This goes back to ${action.sourceChatName || 'the chat that raised it'} so they know it is finished.`}
                  title="What did you do?"
                >
                  <ListTextRow>
                    <TextInput
                      autoFocus
                      editable={!isSaving}
                      multiline
                      onChangeText={setCompletionNote}
                      placeholder="Belt replaced and line restarted"
                      placeholderTextColor={appTheme.colors.muted}
                      style={styles.input}
                      textAlignVertical="top"
                      value={completionNote}
                    />
                  </ListTextRow>
                  <ListActionRow
                    disabled={isSaving}
                    label={isSaving ? 'Saving' : 'Mark done'}
                    onPress={() => void apply({ note: completionNote.trim(), status: 'DONE' })}
                  />
                  <ListActionRow disabled={isSaving} label="Cancel" onPress={closeAsk} />
                </ListSection>
              ) : null}

              {asking === 'CANCELLED' ? (
                <ListSection
                  footer="This does not delete the action. It stays in the record with your name and this reason, and whoever raised it is told."
                  title="Why is this being cancelled?"
                >
                  <ListTextRow>
                    <TextInput
                      autoFocus
                      editable={!isSaving}
                      multiline
                      onChangeText={setCancellationReason}
                      placeholder="Duplicate, raised in error, no longer needed"
                      placeholderTextColor={appTheme.colors.muted}
                      style={styles.input}
                      textAlignVertical="top"
                      value={cancellationReason}
                    />
                  </ListTextRow>
                  <ListActionRow
                    disabled={isSaving || cancellationReason.trim().length < 3}
                    label="Cancel this action"
                    onPress={() => void cancel(cancellationReason.trim())}
                  />
                  <ListActionRow disabled={isSaving} label="Back" onPress={closeAsk} />
                </ListSection>
              ) : null}

              {!asking && action.status === 'DONE' ? (
                <ListSection footer="Whoever did the work cannot verify it themselves.">
                  <ListActionRow
                    disabled={isSaving}
                    icon="check-circle"
                    label="Verify"
                    onPress={() => void confirm()}
                  />
                </ListSection>
              ) : null}

              {!asking && action.status !== 'VERIFIED' && action.status !== 'CANCELLED' ? (
                <ListSection>
                  {action.status === 'OPEN' || action.status === 'BLOCKED' ? (
                    <ListActionRow
                      disabled={isSaving}
                      label="Start work"
                      onPress={() => void apply({ status: 'IN_PROGRESS' })}
                    />
                  ) : null}
                  {action.status !== 'DONE' && action.status !== 'BLOCKED' ? (
                    <ListActionRow
                      disabled={isSaving}
                      label="Waiting on something"
                      onPress={() => openAsk('BLOCKED')}
                    />
                  ) : null}
                  {action.status !== 'DONE' ? (
                    <ListActionRow
                      disabled={isSaving}
                      label="Mark done"
                      onPress={() => openAsk('DONE')}
                    />
                  ) : null}
                </ListSection>
              ) : null}

              {/* Offered to everybody, decided by the server. Hiding it from the
                  person answerable for the action would teach them nothing; the
                  refusal names who to ask instead. A verified action cannot be
                  cancelled at all, so the row is genuinely absent there. */}
              {!asking && action.status !== 'VERIFIED' && action.status !== 'CANCELLED' ? (
                <ListSection footer="Cancelling keeps the record. It does not delete it.">
                  <ListActionRow
                    destructive
                    disabled={isSaving}
                    label="Cancel this action"
                    onPress={() => openAsk('CANCELLED')}
                  />
                </ListSection>
              ) : null}

              <ListSection title="What has happened">
                {events.map((event) => (
                  <ListTextRow key={event.eventId}>
                    <Text style={styles.eventText}>{describeEvent(event)}</Text>
                    <Text style={styles.eventMeta}>
                      {event.actorName} · {new Date(event.atMs).toLocaleString()}
                    </Text>
                    {event.note ? <Text style={styles.eventNote}>{event.note}</Text> : null}
                  </ListTextRow>
                ))}
              </ListSection>
            </Animated.ScrollView>
          </KeyboardAvoidingView>
        )}
      </View>

      {viewingIndex !== null ? (
        <ActionMediaViewer
          items={attachments}
          onClose={() => setViewingIndex(null)}
          startIndex={viewingIndex}
          visible
        />
      ) : null}
      <ReassignActionModal
        currentPersonName={action.responsiblePersonName}
        currentPersonUid={action.responsiblePersonUid}
        isSaving={isSaving}
        onClose={() => setIsReassignOpen(false)}
        onReassign={(input) => void reassign(input)}
        people={people}
        visible={isReassignOpen}
      />

    </Modal>
  );
}

/** What happened, in words rather than a pair of status codes. */
function describeEvent(event: ActionEvent): string {
  if (event.kind === 'CREATED') {
    return 'Raised from a message';
  }

  if (event.kind === 'VERIFIED') {
    return 'Verified';
  }

  if (event.toStatus === 'IN_PROGRESS') return 'Work started';
  if (event.toStatus === 'BLOCKED') return 'Waiting on something';
  if (event.toStatus === 'DONE') return 'Marked done';

  return 'Reopened';
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    moveRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14
    },
    moveRowText: {
      color: colors.link,
      flex: 1,
      fontSize: 16
    },
    pressed: {
      opacity: 0.6
    },
    // The tinted ground the cards sit on. This is what replaces shadows.
    sheet: {
      backgroundColor: colors.groupedBackground,
      flex: 1
    },
    grow: {
      flex: 1
    },
    // No card of its own and no line under it. A separator there makes the
    // header read as a bar bolted onto the page rather than the top of it,
    // which is the same reason the Create Action header lost its own.
    head: {
      alignItems: 'center',
      backgroundColor: colors.groupedBackground,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14
    },
    headTitle: {
      color: colors.ink,
      fontSize: 17,
      fontWeight: '500'
    },
    link: {
      color: colors.link,
      fontSize: 16
    },
    linkDisabled: {
      color: colors.muted
    },
    headSpacer: {
      width: 48
    },
    centre: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center'
    },
    body: {
      paddingTop: 4
    },
    titleBlock: {
      paddingHorizontal: 15,
      paddingTop: 18
    },
    title: {
      color: colors.ink,
      fontSize: 22,
      fontWeight: '600',
      lineHeight: 29
    },
    tags: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 9
    },
    dot: {
      borderRadius: 4,
      height: 8,
      width: 8
    },
    tagText: {
      color: colors.muted,
      fontSize: 13.5,
      marginRight: 6
    },
    section: {
      marginTop: 22
    },
    sectionTitle: {
      color: colors.muted,
      fontSize: 13,
      marginBottom: 7,
      marginLeft: 15
    },
    galleryCard: {
      backgroundColor: colors.groupedCard,
      borderRadius: 22,
      marginHorizontal: 15,
      padding: 12
    },
    gallery: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8
    },
    galleryItem: {
      height: 92,
      width: 92
    },
    galleryImage: {
      backgroundColor: colors.groupedBackground,
      borderRadius: 14,
      height: 92,
      width: 92
    },
    playBadge: {
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderRadius: 15,
      bottom: 31,
      height: 30,
      justifyContent: 'center',
      left: 31,
      position: 'absolute',
      width: 30
    },
    pressedMedia: {
      opacity: 0.75
    },
    input: {
      color: colors.ink,
      fontSize: 15.5,
      lineHeight: 21,
      minHeight: 66,
      padding: 0
    },
    eventText: {
      color: colors.ink,
      fontSize: 15.5
    },
    eventMeta: {
      color: colors.muted,
      fontSize: 12.5,
      marginTop: 2
    },
    eventNote: {
      color: colors.mutedStrong,
      fontSize: 13.5,
      lineHeight: 19,
      marginTop: 5
    },
    error: {
      color: colors.destructive,
      fontSize: 14,
      paddingHorizontal: 15,
      paddingTop: 12
    }
  });
}
