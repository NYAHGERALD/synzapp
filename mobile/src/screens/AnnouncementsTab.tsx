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
  Text,
  TextInput,
  View
} from 'react-native';
import { useAppTheme } from '../theme/AppThemeProvider';
import type { AppColors } from '../theme/colors';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { ChatSearchBar } from '../components/chatUiPrimitives';
import { filterAnnouncements } from '../services/announcementSearch';
import type { NoticesView } from '../components/NoticesOptionsMenu';
import { AnnouncementRow } from '../components/AnnouncementRow';
import { CircleIconButton, CircleIconSpacer } from '../components/ui/CircleIconButton';
import { ListNavRow, ListSection, ListSwitchRow } from '../components/ui/GroupedList';
import { getFullScreenModalTopPadding } from '../components/keyResults/KeyResultsSettings';
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
  isComposeOpen,
  onChangeComposeOpen,
  peopleDepartments,
  view
}: {
  audienceOptions: AnnouncementAudienceOption[];
  canSend: boolean;
  currentUid: string;
  /** Groups that hold a whole department, as { groupId: departmentId }. */
  departmentBackedGroups: Record<string, string>;
  getIdToken: () => Promise<string>;
  /**
   * Owned by the screen, because the buttons that drive them now live in the
   * header: the options menu chooses the view and the header's Add opens the
   * composer.
   */
  isComposeOpen: boolean;
  onChangeComposeOpen: (isOpen: boolean) => void;
  /** Which department each employee is in, as { uid: departmentId }. */
  peopleDepartments: Record<string, string>;
  view: NoticesView;
}) {

  const [showingRecipients, setShowingRecipients] = useState<Announcement | null>(null);
  const [search, setSearch] = useState('');
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

      onChangeComposeOpen(false);
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

  const visibleAnnouncements = useMemo(
    () => filterAnnouncements(
      view === 'SENT'
        ? announcements.filter((entry) => entry.createdByUid === currentUid)
        : announcements.filter((entry) => entry.createdByUid !== currentUid),
      search
    ),
    [announcements, currentUid, search, view]
  );

  /**
   * One card, built a row at a time.
   *
   * Notices only ever accumulate, so this list has no natural end. A card each
   * would be a page of stripes; the rows carry the card's colour and margins
   * and only the ends round their corners, so a year of them still reads as one
   * continuous card.
   */
  const renderItem = useCallback(
    ({ index, item }: { index: number; item: Announcement }) => (
      <View style={[
        styles.card,
        index === 0 && styles.cardFirst,
        index === visibleAnnouncements.length - 1 && styles.cardLast
      ]}>
        {index === 0 ? null : <View style={styles.divider} />}
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
      </View>
    ),
    [currentUid, handleAcknowledge, styles, visibleAnnouncements.length]
  );

  const everyoneOption = useMemo(
    () => audienceOptions.find((option) => option.kind === 'ORGANIZATION') || null,
    [audienceOptions]
  );
  const isEveryoneChosen = audiences.some((entry) => entry.kind === 'ORGANIZATION');

  if (isLoading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={appTheme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* A notice is remembered by who it went to, who sent it, or a phrase in
          it. All three are searched; see `filterAnnouncements`. */}
      <View style={styles.searchWrap}>
        <ChatSearchBar
          onChangeText={setSearch}
          placeholder="Search department, name or words"
          value={search}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        contentContainerStyle={styles.listContent}
        data={visibleAnnouncements}
        // Tuned so a long history costs the same to open as a short one.
        initialNumToRender={6}
        keyExtractor={(item) => item.announcementId}
        ListEmptyComponent={
          <View style={styles.centre}>
            {/* "Nothing matches" and "there is nothing" are different problems,
                and saying the second when it is the first sends somebody
                looking for a notice that is there. */}
            <Text style={styles.emptyTitle}>
              {search.trim()
                ? 'Nothing matches that'
                : view === 'SENT' ? 'Nothing sent yet' : 'Nothing to confirm'}
            </Text>
            <Text style={styles.emptyBody}>
              {search.trim()
                ? 'Try a department, somebody’s name, or a word from the notice.'
                : view === 'SENT'
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
        onRequestClose={() => onChangeComposeOpen(false)}
        presentationStyle="pageSheet"
        visible={isComposeOpen}
      >
        <View style={[styles.composeSheet, { paddingTop: getFullScreenModalTopPadding(insets.top) }]}>
          {/* The one action lives here, as a word, beside the round close
              button. A filled slab at the foot of a form is something people
              scroll past to reach; the header is where it can always be seen. */}
          <View style={styles.composeHead}>
            <CircleIconButton
              action="close"
              disabled={isSending}
              label="Cancel this announcement"
              onPress={() => onChangeComposeOpen(false)}
            />
            <Text numberOfLines={1} style={styles.composeTitle}>New announcement</Text>
            <Pressable
              accessibilityLabel="Send announcement"
              accessibilityRole="button"
              accessibilityState={{ disabled: isSending }}
              disabled={isSending}
              hitSlop={8}
              onPress={confirmThenSend}
              style={({ pressed }) => [
                styles.composeSendAction,
                pressed && styles.pressed,
                isSending && styles.disabled
              ]}
            >
              {isSending ? (
                <ActivityIndicator color={appTheme.colors.link} size="small" />
              ) : (
                <Text style={styles.composeSendText}>Send</Text>
              )}
            </Pressable>
          </View>

          {/*
            * Lifts whatever is being typed into clear at the keyboard.
            *
            * React Native's own keyboard avoidance cannot do this: the app
            * targets SDK 36, Android 16 enforces edge to edge, and that
            * disables `adjustResize` — so the window height never changes and
            * there is nothing for it to measure. This reads the real IME inset
            * from the platform, the same as the chat composer. See the keyboard
            * section of mobile/CLAUDE.md.
            *
            * `bottomOffset` keeps a gap between the caret and the top of the
            * keyboard, so the line being typed is not flush against it.
            */}
          <KeyboardAwareScrollView
            bottomOffset={24}
            contentContainerStyle={styles.composeBody}
            keyboardShouldPersistTaps="handled"
          >
            {/* The running count sits under the card as its footer, where a
                grouped list puts the sentence that explains the rows above. */}
            <ListSection footer={summariseSelectionByKind(audiences)} title="Who is this for?">
              {everyoneOption ? (
                <ListSwitchRow
                  onValueChange={() =>
                    setAudiences((current) =>
                      isEveryoneChosen
                        ? current.filter((entry) => entry.kind !== 'ORGANIZATION')
                        : [...current, everyoneOption]
                    )
                  }
                  subtitle={isEveryoneChosen ? 'Chosen' : 'Every active member of staff'}
                  title="Everyone at the company"
                  value={isEveryoneChosen}
                />
              ) : null}

              {(['GROUPS', 'PEOPLE'] as const).map((kind) => {
                const chosen = audiences.filter((entry) =>
                  kind === 'GROUPS' ? entry.kind === 'GROUP' : entry.kind === 'PERSON'
                );

                return (
                  <ListNavRow
                    icon={kind === 'GROUPS' ? 'users' : 'user'}
                    key={kind}
                    onPress={() => setOpenPicker(kind)}
                    subtitle={chosen.length
                      ? chosen.map((entry) => entry.targetName).join(', ')
                      : 'None chosen'}
                    title={kind === 'GROUPS' ? 'Groups' : 'Employees'}
                  />
                );
              })}
            </ListSection>

            <ListSection title="Subject">
              <TextInput
                onChangeText={setSubject}
                placeholder="Allergen change on line 3"
                placeholderTextColor={appTheme.colors.muted}
                style={styles.input}
                value={subject}
              />
            </ListSection>

            <ListSection title="What do people need to know?">
              <TextInput
                multiline
                onChangeText={setBody}
                placeholder="Say it plainly. This is what everyone will read."
                placeholderTextColor={appTheme.colors.muted}
                style={[styles.input, styles.inputMultiline]}
                value={body}
              />
            </ListSection>

            <ListSection>
              <ListSwitchRow
                onValueChange={setRequiresAcknowledgement}
                subtitle="Records who has read and confirmed it. Use this for anything that matters."
                title="Ask people to confirm"
                value={requiresAcknowledgement}
              />
            </ListSection>

            {composeError ? <Text style={styles.error}>{composeError}</Text> : null}
          </KeyboardAwareScrollView>
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
      backgroundColor: colors.groupedBackground,
      flex: 1
    },
    // The tab surface already pays 10, and a card sits 15 from the screen edge.
    searchWrap: {
      paddingBottom: 2,
      paddingHorizontal: 5,
      paddingTop: 8
    },
    listContent: {
      paddingBottom: 24,
      paddingTop: 8
    },
    card: {
      backgroundColor: colors.groupedCard,
      marginHorizontal: 5,
      overflow: 'hidden'
    },
    cardFirst: {
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22
    },
    cardLast: {
      borderBottomLeftRadius: 22,
      borderBottomRightRadius: 22
    },
    divider: {
      backgroundColor: colors.separator,
      height: 1,
      marginHorizontal: 15
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
      lineHeight: 22
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
      paddingHorizontal: 21,
      paddingVertical: 10
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
      // The whole page is the tinted ground; only the cards on it are white.
      backgroundColor: colors.groupedBackground,
      flex: 1
    },
    // No rule under it. The header is part of the page, not a bar laid on it.
    composeHead: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
      paddingHorizontal: 15
    },
    composeSendAction: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      minHeight: 44,
      minWidth: 44
    },
    composeSendText: {
      color: colors.link,
      fontSize: 16,
      lineHeight: 21
    },
    composeTitle: {
      color: colors.ink,
      flex: 1,
      fontSize: 17,
      lineHeight: 22,
      textAlign: 'center'
    },
    composeCancel: {
      color: colors.primary,
      fontSize: 16
    },
    composeHeadSpacer: {
      width: 56
    },
    composeBody: {
      paddingBottom: 48,
      paddingTop: 2
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
    // Inside a card, so it draws no box of its own: the card is the box, and a
    // bordered field within a bordered card is two frames around one thing.
    input: {
      color: colors.ink,
      fontSize: 16,
      minHeight: 52,
      paddingHorizontal: 16,
      paddingVertical: 14
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
