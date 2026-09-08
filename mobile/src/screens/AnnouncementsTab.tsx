import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';
import { useAppTheme } from '../theme/AppThemeProvider';
import type { AppColors } from '../theme/colors';
import { AnnouncementRow } from '../components/AnnouncementRow';
import {
  acknowledgeAnnouncement,
  markAnnouncementRead,
  previewAnnouncementAudience,
  sendAnnouncement,
  type Announcement,
  type AnnouncementAudience
} from '../services/announcementApi';
import { sortAnnouncementsForReader } from '../services/announcementDisplay';
import {
  markAcknowledgedLocally,
  refreshAnnouncements,
  subscribeToAnnouncements
} from '../services/announcementStore';
import { AudiencePickerModal } from '../components/AudiencePickerModal';
import { showAnnouncementAlert } from '../services/announcementAlert';
import { AnnouncementRecipientsModal } from '../components/AnnouncementRecipientsModal';
import {
  describeAudiences,
  findCoverageReason,
  summariseSelectionByKind,
  type AudienceChoice
} from '../services/audiencePicker';
import { AppSwitch } from '../components/ui/AppSwitch';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The announcements a person has been sent.
 *
 * The list is virtualised and each row is memoised, because a company that has
 * been running for two years has a great many of these and the screen must open
 * at the same speed on the last day as the first.
 */
/** One row in the picker. The section decides where it sits in the list. */
export type AnnouncementAudienceOption = AudienceChoice;

export function AnnouncementsTab({
  audienceOptions,
  canSend,
  currentUid,
  departmentBackedGroups,
  getIdToken,
  peopleDepartments
}: {
  audienceOptions: AnnouncementAudienceOption[];
  canSend: boolean;
  currentUid: string;
  /** Groups that hold a whole department, as { groupId: departmentId }. */
  departmentBackedGroups: Record<string, string>;
  getIdToken: () => Promise<string>;
  /** Which department each employee is in, as { uid: departmentId }. */
  peopleDepartments: Record<string, string>;
}) {
  const [view, setView] = useState<'FOR_ME' | 'SENT'>('FOR_ME');

  const [showingRecipients, setShowingRecipients] = useState<Announcement | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [requiresAcknowledgement, setRequiresAcknowledgement] = useState(true);
  const [audiences, setAudiences] = useState<AnnouncementAudience[]>([]);
  const [openPicker, setOpenPicker] = useState<'GROUPS' | 'PEOPLE' | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One shared copy, so a notice that arrives while this screen is open shows
  // up here without anybody leaving and coming back.
  useEffect(() => subscribeToAnnouncements((rows) => {
    setAnnouncements(sortAnnouncementsForReader(rows));
    setIsLoading(false);
    setIsRefreshing(false);
  }), []);

  const getIdTokenRef = useRef(getIdToken);
  /** Announcements already reported as read, so the request is sent once. */
  const markedReadRef = useRef(new Set<string>());

  getIdTokenRef.current = getIdToken;

  const load = useCallback(async () => {
    try {
      await refreshAnnouncements(() => getIdTokenRef.current(), { force: true });
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Announcements could not be loaded.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Marking them read is a background courtesy. It must never block the list
  // from appearing, and a failure here is not worth telling anybody about.
  useEffect(() => {
    if (!announcements.length) {
      return;
    }

    void (async () => {
      try {
        const idToken = await getIdTokenRef.current();
        const unread = announcements.filter(
          (entry) => entry.myStatus === 'DELIVERED' && !markedReadRef.current.has(entry.announcementId)
        );

        for (const entry of unread) {
          // Remembered, so a refreshed list does not send the same request
          // again on every publish.
          markedReadRef.current.add(entry.announcementId);
          await markAnnouncementRead({ announcementId: entry.announcementId, idToken });
        }
      } catch {
        // Left deliberately quiet.
      }
    })();
  }, [announcements]);

  const handleAcknowledge = useCallback(
    async (announcementId: string) => {
      const idToken = await getIdTokenRef.current();

      await acknowledgeAnnouncement({ announcementId, idToken });

      // Marked here so the row changes at once, everywhere it appears, rather
      // than only on this screen.
      markAcknowledgedLocally(announcementId);
    },
    []
  );

  function resetCompose() {
    setSubject('');
    setBody('');
    setAudiences([]);
    setRequiresAcknowledgement(true);
    setComposeError(null);
  }

  async function handleSend() {
    if (!audiences.length) {
      setComposeError('Choose who this is for.');

      return;
    }

    setComposeError(null);
    setIsSending(true);

    try {
      const idToken = await getIdToken();
      const created = await sendAnnouncement({
        audiences,
        body,
        idToken,
        requiresAcknowledgement,
        subject
      });

      setIsComposeOpen(false);
      resetCompose();
      await refreshAnnouncements(() => getIdToken(), { force: true });

      // The count comes from the server, after the fact. Guessing it before
      // sending would be inventing a number.
      Alert.alert(
        'Announcement sent',
        `Sent to ${created.expectedRecipientCount} ${
          created.expectedRecipientCount === 1 ? 'person' : 'people'
        }.`
      );
    } catch (nextError) {
      setComposeError(
        nextError instanceof Error ? nextError.message : 'That could not be sent.'
      );
    } finally {
      setIsSending(false);
    }
  }

  /** Asks before sending, naming the audience. Reaching 5,000 people must be deliberate. */
  async function confirmThenSend() {
    if (!audiences.length) {
      setComposeError('Choose who this is for.');

      return;
    }

    // The real number, from the server, in the question. A confirmation that
    // cannot say how many people it reaches is not much of a confirmation.
    let reach = 'the people you chose';

    try {
      const idToken = await getIdToken();
      const preview = await previewAnnouncementAudience({ audiences, idToken });

      if (preview.recipientCount === 0) {
        setComposeError('That audience reaches nobody. Choose somebody else.');

        return;
      }

      reach = `${preview.recipientCount} ${preview.recipientCount === 1 ? 'person' : 'people'}`;
    } catch {
      // Counting failed. Ask anyway rather than blocking the send, and say
      // plainly that the number is not known.
    }

    Alert.alert(
      'Send this announcement?',
      `It goes to ${reach}: ${describeAudiences(audiences)}.${
        requiresAcknowledgement ? ' Everyone will be asked to confirm they have read it.' : ''
      }`,
      [
        { style: 'cancel', text: 'Not yet' },
        { onPress: () => void handleSend(), text: 'Send' }
      ]
    );
  }

  const renderItem = useCallback(
    ({ item }: { item: Announcement }) => (
      <AnnouncementRow
        announcement={item}
        isSender={item.createdByUid === currentUid}
        onOpen={() =>
          item.createdByUid === currentUid
            ? setShowingRecipients(item)
            : showAnnouncementAlert({
                announcement: item,
                onAcknowledge: () => handleAcknowledge(item.announcementId)
              })
        }
      />
    ),
    [currentUid, handleAcknowledge]
  );

  const everyoneOption = useMemo(
    () => audienceOptions.find((option) => option.kind === 'ORGANIZATION') || null,
    [audienceOptions]
  );
  const isEveryoneChosen = audiences.some((entry) => entry.kind === 'ORGANIZATION');

  const visibleAnnouncements = useMemo(
    () =>
      view === 'SENT'
        ? announcements.filter((entry) => entry.createdByUid === currentUid)
        : announcements.filter((entry) => entry.createdByUid !== currentUid),
    [announcements, currentUid, view]
  );

  if (isLoading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={appTheme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {canSend && audienceOptions.length ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setIsComposeOpen(true)}
          style={({ pressed }) => [styles.composeButton, pressed && styles.pressed]}
        >
          <Text style={styles.composeButtonText}>New announcement</Text>
        </Pressable>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {canSend ? (
        <View style={styles.viewSwitch}>
          {(['FOR_ME', 'SENT'] as const).map((option) => (
            <Pressable
              accessibilityRole="button"
              key={option}
              onPress={() => setView(option)}
              style={({ pressed }) => [
                styles.viewSwitchButton,
                view === option && styles.viewSwitchButtonActive,
                pressed && styles.pressed
              ]}
            >
              <Text
                style={[
                  styles.viewSwitchText,
                  view === option && styles.viewSwitchTextActive
                ]}
              >
                {option === 'FOR_ME' ? 'For me' : 'Sent'}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <FlatList
        data={visibleAnnouncements}
        // Tuned so a long history costs the same to open as a short one.
        initialNumToRender={6}
        keyExtractor={(item) => item.announcementId}
        ListEmptyComponent={
          <View style={styles.centre}>
            <Text style={styles.emptyTitle}>
              {view === 'SENT' ? 'Nothing sent yet' : 'Nothing to confirm'}
            </Text>
            <Text style={styles.emptyBody}>
              {view === 'SENT'
                ? 'Announcements you send will appear here, with who has confirmed them.'
                : 'Announcements your company sends you will appear here.'}
            </Text>
          </View>
        }
        maxToRenderPerBatch={6}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              setIsRefreshing(true);
              void load();
            }}
            refreshing={isRefreshing}
            tintColor={appTheme.colors.primary}
          />
        }
        removeClippedSubviews
        renderItem={renderItem}
        windowSize={7}
      />

      {showingRecipients ? (
        <AnnouncementRecipientsModal
          announcement={showingRecipients}
          getIdToken={getIdToken}
          onClose={() => setShowingRecipients(null)}
          visible
        />
      ) : null}

      <Modal
        animationType="slide"
        onRequestClose={() => setIsComposeOpen(false)}
        presentationStyle="pageSheet"
        visible={isComposeOpen}
      >
        <View style={styles.composeSheet}>
          <View style={[styles.composeHead, { paddingTop: insets.top + 12 }]}>
            <Pressable accessibilityRole="button" onPress={() => setIsComposeOpen(false)}>
              <Text style={styles.composeCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.composeTitle}>New announcement</Text>
            <View style={styles.composeHeadSpacer} />
          </View>

          <ScrollView contentContainerStyle={styles.composeBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Who is this for?</Text>

            {everyoneOption ? (
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: isEveryoneChosen }}
                onPress={() =>
                  setAudiences((current) =>
                    isEveryoneChosen
                      ? current.filter((entry) => entry.kind !== 'ORGANIZATION')
                      : [...current, everyoneOption]
                  )
                }
                style={({ pressed }) => [styles.audienceRow, pressed && styles.pressed]}
              >
                <View style={styles.audienceRowText}>
                  <Text style={styles.audienceName}>Everyone at the company</Text>
                  <Text style={styles.audienceDescription}>
                    {isEveryoneChosen ? 'Chosen' : 'Every active member of staff'}
                  </Text>
                </View>
                <AppSwitch
                  onValueChange={() =>
                    setAudiences((current) =>
                      isEveryoneChosen
                        ? current.filter((entry) => entry.kind !== 'ORGANIZATION')
                        : [...current, everyoneOption]
                    )
                  }
                  value={isEveryoneChosen}
                />
              </Pressable>
            ) : null}

            {(['GROUPS', 'PEOPLE'] as const).map((kind) => {
              const chosen = audiences.filter((entry) =>
                kind === 'GROUPS' ? entry.kind === 'GROUP' : entry.kind === 'PERSON'
              );
              const label = kind === 'GROUPS' ? 'Groups' : 'Employees';

              return (
                <Pressable
                  accessibilityRole="button"
                  key={kind}
                  onPress={() => setOpenPicker(kind)}
                  style={({ pressed }) => [styles.audienceRow, pressed && styles.pressed]}
                >
                  <View style={styles.audienceRowText}>
                    <Text style={styles.audienceName}>{label}</Text>
                    <Text style={styles.audienceDescription}>
                      {chosen.length
                        ? chosen.map((entry) => entry.targetName).join(', ')
                        : 'None chosen'}
                    </Text>
                  </View>
                  <Text style={styles.audienceChevron}>›</Text>
                </Pressable>
              );
            })}

            <Text style={styles.audienceSummary}>{summariseSelectionByKind(audiences)}</Text>

            <Text style={styles.fieldLabel}>Subject</Text>
            <TextInput
              onChangeText={setSubject}
              placeholder="Allergen change on line 3"
              placeholderTextColor={appTheme.colors.muted}
              style={styles.input}
              value={subject}
            />

            <Text style={styles.fieldLabel}>What do people need to know?</Text>
            <TextInput
              multiline
              onChangeText={setBody}
              placeholder="Say it plainly. This is what everyone will read."
              placeholderTextColor={appTheme.colors.muted}
              style={[styles.input, styles.inputMultiline]}
              value={body}
            />

            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={styles.switchTitle}>Ask people to confirm</Text>
                <Text style={styles.switchSubtitle}>
                  Records who has read and confirmed it. Use this for anything that matters.
                </Text>
              </View>
              <AppSwitch onValueChange={setRequiresAcknowledgement} value={requiresAcknowledgement} />
            </View>

            {composeError ? <Text style={styles.error}>{composeError}</Text> : null}

            <Pressable
              accessibilityRole="button"
              disabled={isSending}
              onPress={confirmThenSend}
              style={({ pressed }) => [
                styles.composeButton,
                styles.composeSend,
                pressed && styles.pressed,
                isSending && styles.disabled
              ]}
            >
              {isSending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.composeButtonText}>Send announcement</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>

        {openPicker ? (
        <AudiencePickerModal
          choices={audienceOptions.filter((option) =>
            openPicker === 'GROUPS' ? option.section === 'GROUPS' : option.section === 'PEOPLE'
          )}
          coverageFor={
            openPicker === 'PEOPLE'
              ? (choice) =>
                  findCoverageReason({
                    departmentBackedGroups,
                    personDepartmentId: peopleDepartments[choice.targetId || ''] || null,
                    selected: audiences
                  })
              : undefined
          }
          getIdToken={getIdToken}
          onClose={() => setOpenPicker(null)}
          onConfirm={(chosen) => {
            setAudiences(chosen);
            setOpenPicker(null);
            setComposeError(null);
          }}
          searchPlaceholder={openPicker === 'GROUPS' ? 'Search groups' : 'Search employees'}
          selected={audiences}
          title={openPicker === 'GROUPS' ? 'Groups' : 'Employees'}
          visible
        />
        ) : null}
      </Modal>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    screen: {
      backgroundColor: colors.screen,
      flex: 1
    },
    centre: {
      alignItems: 'center',
      flex: 1,
      gap: 6,
      justifyContent: 'center',
      padding: 32
    },
    emptyTitle: {
      color: colors.ink,
      fontSize: 17,
      fontWeight: '500'
    },
    emptyBody: {
      color: colors.muted,
      fontSize: 14,
      textAlign: 'center'
    },
    composeButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 12,
      justifyContent: 'center',
      margin: 12,
      minHeight: 48
    },
    composeButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '500'
    },
    pressed: {
      opacity: 0.85
    },
    error: {
      color: colors.destructive,
      fontSize: 14,
      paddingHorizontal: 16,
      paddingVertical: 8
    },
    disabled: {
      opacity: 0.6
    },
    viewSwitch: {
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      paddingHorizontal: 12
    },
    viewSwitchButton: {
      borderBottomColor: 'transparent',
      borderBottomWidth: 2,
      paddingHorizontal: 14,
      paddingVertical: 12
    },
    viewSwitchButtonActive: {
      borderBottomColor: colors.primary
    },
    viewSwitchText: {
      color: colors.muted,
      fontSize: 15,
      fontWeight: '500'
    },
    viewSwitchTextActive: {
      color: colors.ink
    },
    composeSheet: {
      backgroundColor: colors.screen,
      flex: 1
    },
    composeHead: {
      alignItems: 'center',
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14
    },
    composeTitle: {
      color: colors.ink,
      fontSize: 17,
      fontWeight: '500'
    },
    composeCancel: {
      color: colors.primary,
      fontSize: 16
    },
    composeHeadSpacer: {
      width: 56
    },
    composeBody: {
      gap: 10,
      padding: 16,
      paddingBottom: 48
    },
    fieldLabel: {
      color: colors.ink,
      fontSize: 15,
      fontWeight: '500',
      marginTop: 10
    },
    audienceRow: {
      alignItems: 'center',
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 2,
      paddingVertical: 14
    },
    audienceRowText: {
      flex: 1,
      minWidth: 0
    },
    audienceChevron: {
      color: colors.muted,
      fontSize: 24
    },
    audienceSummary: {
      color: colors.ink,
      fontSize: 14,
      fontWeight: '500',
      marginTop: 12
    },
    // The chosen one is marked by a line down its edge, not a heavier box.
    audienceRowChosen: {
      borderLeftColor: colors.primary,
      borderLeftWidth: 3,
      paddingLeft: 10
    },
    audienceName: {
      color: colors.ink,
      fontSize: 16,
      fontWeight: '500'
    },
    audienceDescription: {
      color: colors.muted,
      fontSize: 13,
      marginTop: 2
    },
    input: {
      backgroundColor: colors.card,
      borderColor: colors.divider,
      borderRadius: 12,
      borderWidth: 1,
      color: colors.ink,
      fontSize: 16,
      paddingHorizontal: 14,
      paddingVertical: 12
    },
    inputMultiline: {
      minHeight: 120,
      textAlignVertical: 'top'
    },
    switchRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
      marginTop: 12
    },
    switchText: {
      flex: 1
    },
    switchTitle: {
      color: colors.ink,
      fontSize: 15,
      fontWeight: '500'
    },
    switchSubtitle: {
      color: colors.muted,
      fontSize: 13,
      marginTop: 2
    },
    composeSend: {
      marginHorizontal: 0,
      marginTop: 20
    }
  });
}
