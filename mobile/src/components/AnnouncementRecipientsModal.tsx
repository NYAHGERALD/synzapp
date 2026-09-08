import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
      <View style={styles.sheet}>
        <View style={[styles.head, { paddingTop: insets.top + 12 }]}>
          <Pressable accessibilityRole="button" onPress={onClose}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
          <Text style={styles.title}>Who has confirmed</Text>
          <View style={styles.headSpacer} />
        </View>

        <View style={styles.summary}>
          <Text style={styles.subject}>{announcement.subject}</Text>
          <Text style={styles.counts}>{describeAcknowledgement(announcement)}</Text>
          {announcement.body ? (
            <Text numberOfLines={3} style={styles.bodyPreview}>
              {announcement.body}
            </Text>
          ) : null}
        </View>

        <View style={styles.filters}>
          {([
            ['ALL', 'Everyone'],
            ['ACKNOWLEDGED', 'Confirmed'],
            ['READ', 'Read only'],
            ['DELIVERED', 'Not opened']
          ] as const).map(([value, label]) => (
            <Pressable
              accessibilityRole="button"
              key={value}
              onPress={() => setFilter(value)}
              style={({ pressed }) => [
                styles.filter,
                filter === value && styles.filterActive,
                pressed && styles.pressed
              ]}
            >
              <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>
                {label}
              </Text>
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
            renderItem={({ item }) => (
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
            )}
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
      backgroundColor: colors.screen,
      flex: 1
    },
    head: {
      alignItems: 'center',
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14
    },
    title: {
      color: colors.ink,
      fontSize: 17,
      fontWeight: '500'
    },
    close: {
      color: colors.primary,
      fontSize: 16
    },
    headSpacer: {
      width: 48
    },
    summary: {
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 14
    },
    subject: {
      color: colors.ink,
      fontSize: 16,
      fontWeight: '500'
    },
    counts: {
      color: colors.muted,
      fontSize: 14,
      marginTop: 4
    },
    bodyPreview: {
      color: colors.ink,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 8
    },
    filters: {
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10
    },
    filter: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7
    },
    filterActive: {
      backgroundColor: colors.primarySoft
    },
    filterText: {
      color: colors.muted,
      fontSize: 13.5
    },
    filterTextActive: {
      color: colors.primary,
      fontWeight: '500'
    },
    list: {
      flex: 1
    },
    row: {
      alignItems: 'center',
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14
    },
    rowText: {
      flex: 1,
      minWidth: 0
    },
    rowName: {
      color: colors.ink,
      fontSize: 16,
      fontWeight: '500'
    },
    rowStatus: {
      color: colors.muted,
      fontSize: 13,
      marginTop: 2
    },
    dot: {
      backgroundColor: colors.divider,
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
