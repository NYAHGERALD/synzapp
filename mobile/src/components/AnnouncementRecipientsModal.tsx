import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useAppTheme } from '../theme/AppThemeProvider';
import type { AppColors } from '../theme/colors';
import {
  listAnnouncementRecipients,
  type Announcement,
  type AnnouncementRecipient,
  type AnnouncementRecipientStatus
} from '../services/announcementApi';
import { describeAcknowledgement } from '../services/announcementDisplay';
import { ANDROID_MAX_NAVIGATION_INSET } from '../services/androidNavigationInset';
import { CircleIconButton, CircleIconSpacer } from './ui/CircleIconButton';
import { getFullScreenModalTopPadding } from './keyResults/KeyResultsSettings';
import { resolveScreenBottomInset } from '../services/rootSafeArea';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Who has confirmed, and who has not.
 *
 * The list is paged, fifty at a time, because an announcement to five thousand
 * people is the ordinary case rather than the exception and the phone must
 * never hold all of them.
 *
 * The counts at the top come from stored counters on the announcement, not from
 * counting these rows: counting five thousand rows to show one number, every
 * time somebody opens this, is how a screen like this dies.
 *
 * The rows are **one card**, built a row at a time. Five thousand separate
 * cards is a page of stripes; a single card with hairlines between its rows
 * stays legible however far it runs.
 */
export function AnnouncementRecipientsModal({
  announcement,
  getIdToken,
  onClose,
  visible
}: {
  announcement: Announcement;
  getIdToken: () => Promise<string>;
  onClose: () => void;
  visible: boolean;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const [filter, setFilter] = useState<AnnouncementRecipientStatus | 'ALL'>('ALL');
  const [recipients, setRecipients] = useState<AnnouncementRecipient[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Held in a ref so fetching does not depend on the identity of a function
  // the caller may recreate on every render.
  const getIdTokenRef = useRef(getIdToken);

  getIdTokenRef.current = getIdToken;

  const screenBottomInset = resolveScreenBottomInset({
    androidNavigationInset: Math.min(insets.bottom, ANDROID_MAX_NAVIGATION_INSET),
    platform: Platform.OS
  });

  const load = useCallback(
    async (startAfterUid?: string) => {
      try {
        const idToken = await getIdTokenRef.current();
        const page = await listAnnouncementRecipients({
          announcementId: announcement.announcementId,
          idToken,
          startAfterUid,
          status: filter === 'ALL' ? undefined : filter
        });

        setRecipients((current) =>
          startAfterUid ? [...current, ...page.recipients] : page.recipients
        );
        setCursor(page.nextCursor);
        setError(null);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'That list could not be loaded.');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [announcement.announcementId, filter]
  );

  useEffect(() => {
    if (!visible) {
      return;
    }

    setIsLoading(true);
    setRecipients([]);
    setCursor(null);
    void load();
  }, [filter, load, visible]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
      <View style={[styles.sheet, { paddingTop: getFullScreenModalTopPadding(insets.top) }]}>
        <View style={styles.head}>
          <CircleIconButton action="close" label="Close" onPress={onClose} />
          <Text numberOfLines={1} style={styles.title}>Who has confirmed</Text>
          <CircleIconSpacer />
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.subject}>{announcement.subject}</Text>
          <Text style={styles.counts}>{describeAcknowledgement(announcement)}</Text>
          {announcement.body ? (
            <Text numberOfLines={3} style={styles.bodyPreview}>
              {announcement.body}
            </Text>
          ) : null}
        </View>

        {/* One card, four text links. The one in force is the app's link blue
            with a rule under it; outlined pills read as buttons that do
            something, and these choose what the list below shows. */}
        <View style={styles.filterCard}>
          {([
            ['ALL', 'Everyone'],
            ['ACKNOWLEDGED', 'Confirmed'],
            ['READ', 'Read only'],
            ['DELIVERED', 'Not opened']
          ] as const).map(([value, label]) => (
            <Pressable
              accessibilityLabel={label}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === value }}
              key={value}
              onPress={() => setFilter(value)}
              style={({ pressed }) => [styles.filter, pressed && styles.pressed]}
            >
              <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>
                {label}
              </Text>
              <View style={[
                styles.filterUnderline,
                filter === value && styles.filterUnderlineActive
              ]} />
            </Pressable>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {isLoading ? (
          <View style={styles.centre}>
            <ActivityIndicator color={appTheme.colors.primary} />
          </View>
        ) : (
          <FlatList
            data={recipients}
            initialNumToRender={20}
            keyExtractor={(item) => item.uid}
            ListEmptyComponent={<Text style={styles.empty}>Nobody in this group.</Text>}
            ListFooterComponent={
              isLoadingMore ? (
                <View style={styles.footer}>
                  <ActivityIndicator color={appTheme.colors.primary} />
                </View>
              ) : null
            }
            maxToRenderPerBatch={20}
            // The next fifty are fetched as the list is scrolled, so opening it
            // costs one page however many thousand people were told.
            onEndReached={() => {
              if (cursor && !isLoadingMore) {
                setIsLoadingMore(true);
                void load(cursor);
              }
            }}
            onEndReachedThreshold={0.4}
            removeClippedSubviews
            renderItem={({ index, item }) => (
              <View style={[
                styles.card,
                index === 0 && styles.cardFirst,
                index === recipients.length - 1 && styles.cardLast
              ]}>
                {index === 0 ? null : <View style={styles.divider} />}
                <View style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.rowName}>{item.displayName}</Text>
                    <Text style={styles.rowStatus}>{describeRecipient(item)}</Text>
                  </View>
                  <View
                    style={[
                      styles.dot,
                      item.status === 'ACKNOWLEDGED' && styles.dotConfirmed,
                      item.status === 'READ' && styles.dotRead
                    ]}
                  />
                </View>
              </View>
            )}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: Math.max(24, screenBottomInset + 20) }
            ]}
            style={styles.list}
          />
        )}
      </View>
    </Modal>
  );
}

/** What happened to this person, in words rather than a status code. */
function describeRecipient(recipient: AnnouncementRecipient): string {
  if (recipient.acknowledgedAtMs) {
    return `Confirmed ${new Date(recipient.acknowledgedAtMs).toLocaleString()}`;
  }

  if (recipient.readAtMs) {
    return `Opened ${new Date(recipient.readAtMs).toLocaleString()}, not yet confirmed`;
  }

  return 'Not opened yet';
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    sheet: {
      backgroundColor: colors.groupedBackground,
      flex: 1
    },
    // Same colour as the page and no rule under it.
    head: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
      paddingHorizontal: 15
    },
    title: {
      color: colors.ink,
      flex: 1,
      fontSize: 17,
      lineHeight: 22,
      textAlign: 'center'
    },
    summaryCard: {
      backgroundColor: colors.groupedCard,
      borderRadius: 22,
      marginHorizontal: 15,
      marginTop: 10,
      paddingHorizontal: 16,
      paddingVertical: 14
    },
    subject: {
      color: colors.ink,
      fontSize: 16,
      lineHeight: 21
    },
    counts: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 19,
      marginTop: 4
    },
    bodyPreview: {
      color: colors.ink,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 8
    },
    filterCard: {
      backgroundColor: colors.groupedCard,
      borderRadius: 22,
      flexDirection: 'row',
      marginHorizontal: 15,
      marginTop: 12,
      overflow: 'hidden'
    },
    filter: {
      alignItems: 'center',
      flex: 1,
      minWidth: 0,
      paddingHorizontal: 6,
      paddingVertical: 11
    },
    filterText: {
      color: colors.muted,
      fontSize: 13.5,
      lineHeight: 18,
      textAlign: 'center'
    },
    filterTextActive: {
      color: colors.link
    },
    filterUnderline: {
      alignSelf: 'stretch',
      backgroundColor: 'transparent',
      borderRadius: 1,
      height: 2,
      marginTop: 6
    },
    filterUnderlineActive: {
      backgroundColor: colors.link
    },
    list: {
      flex: 1
    },
    listContent: {
      paddingTop: 14
    },
    /**
     * One card, built a row at a time.
     *
     * The list is paged fifty at a time and an announcement can reach thousands,
     * so it has no natural end. Each row carries the card's colour and margins
     * and only the ends round their corners.
     */
    card: {
      backgroundColor: colors.groupedCard,
      marginHorizontal: 15,
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
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      minHeight: 62,
      paddingHorizontal: 16,
      paddingVertical: 12
    },
    rowText: {
      flex: 1,
      minWidth: 0
    },
    rowName: {
      color: colors.ink,
      fontSize: 16,
      lineHeight: 21
    },
    rowStatus: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 2
    },
    dot: {
      backgroundColor: colors.separator,
      borderRadius: 5,
      height: 10,
      width: 10
    },
    dotConfirmed: {
      backgroundColor: colors.success
    },
    dotRead: {
      backgroundColor: colors.amber
    },
    centre: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center'
    },
    empty: {
      color: colors.muted,
      fontSize: 15,
      paddingVertical: 40,
      textAlign: 'center'
    },
    footer: {
      paddingVertical: 20
    },
    error: {
      color: colors.destructive,
      fontSize: 14,
      paddingHorizontal: 16,
      paddingVertical: 10
    },
    pressed: {
      opacity: 0.85
    }
  });
}
