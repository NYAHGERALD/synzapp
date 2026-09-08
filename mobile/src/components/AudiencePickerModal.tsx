import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme/AppThemeProvider';
import type { AppColors } from '../theme/colors';
import type { AnnouncementAudience } from '../services/announcementApi';
import { previewAnnouncementAudience } from '../services/announcementApi';
import {
  describeSelection,
  filterAudienceChoices,
  groupAudienceChoices,
  isAudienceSelected,
  toggleAudience,
  type AudienceChoice
} from '../services/audiencePicker';
import { ANDROID_MAX_NAVIGATION_INSET } from '../services/androidNavigationInset';
import { AppSwitch } from './ui/AppSwitch';
import { ChatSearchBar } from './chatUiPrimitives';
import { CircleIconButton } from './ui/CircleIconButton';
import { getFullScreenModalTopPadding } from './keyResults/KeyResultsSettings';
import { resolveScreenBottomInset } from '../services/rootSafeArea';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Who an announcement is for.
 *
 * A full-height list with search, because a company with twenty departments and
 * fifty groups cannot be shown inline. Departments, groups and individual
 * people sit in one list: somebody thinking "the night shift supervisors"
 * should not have to know whether that is a group or a department.
 *
 * The count at the foot comes from the server as choices are ticked, so an
 * audience that reaches nobody is caught here rather than after a safety notice
 * has been written.
 *
 * The rows are **one card**, not a card each. A company of three hundred makes
 * this list long, and a stack of three hundred separate cards is a page of
 * stripes; a single card with hairlines between its rows stays legible however
 * far it runs. Each section gets its own card, so the corners land where a
 * heading changes.
 */
export function AudiencePickerModal({
  choices,
  coverageFor,
  getIdToken,
  onClose,
  onConfirm,
  searchPlaceholder,
  selected: initialSelected,
  title,
  visible
}: {
  choices: AudienceChoice[];
  /** Why this choice is already reached by something else, if it is. */
  coverageFor?: (choice: AudienceChoice) => string | null;
  getIdToken: () => Promise<string>;
  onClose: () => void;
  onConfirm: (selected: AnnouncementAudience[]) => void;
  searchPlaceholder: string;
  selected: AnnouncementAudience[];
  title: string;
  visible: boolean;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const [selected, setSelected] = useState<AnnouncementAudience[]>(initialSelected);
  const [query, setQuery] = useState('');
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [countError, setCountError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const getIdTokenRef = useRef(getIdToken);

  getIdTokenRef.current = getIdToken;

  useEffect(() => {
    if (visible) {
      setSelected(initialSelected);
      setQuery('');
    }
  }, [initialSelected, visible]);

  // Counted after a short pause, so ticking five things in a row asks once
  // rather than five times. Late answers to old questions are discarded.
  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    if (!selected.length) {
      setRecipientCount(0);
      setCountError(null);

      return undefined;
    }

    setRecipientCount(null);
    setCountError(null);

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const idToken = await getIdTokenRef.current();
          const preview = await previewAnnouncementAudience({ audiences: selected, idToken });

          if (requestIdRef.current === requestId) {
            setRecipientCount(preview.recipientCount);
          }
        } catch (error) {
          if (requestIdRef.current === requestId) {
            setCountError(
              error instanceof Error ? error.message : 'That count could not be worked out.'
            );
          }
        }
      })();
    }, 350);

    return () => clearTimeout(timer);
  }, [selected, visible]);

  const sections = useMemo(
    () => groupAudienceChoices(filterAudienceChoices(choices, query)),
    [choices, query]
  );

  const screenBottomInset = resolveScreenBottomInset({
    androidNavigationInset: Math.min(insets.bottom, ANDROID_MAX_NAVIGATION_INSET),
    platform: Platform.OS
  });

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
      <View style={[styles.sheet, { paddingTop: getFullScreenModalTopPadding(insets.top) }]}>
        <View style={styles.head}>
          <CircleIconButton action="close" label={`Close ${title}`} onPress={onClose} />
          <Text numberOfLines={1} style={styles.title}>{title}</Text>
          <Pressable
            accessibilityLabel="Done"
            accessibilityRole="button"
            accessibilityState={{ disabled: !selected.length }}
            disabled={!selected.length}
            hitSlop={8}
            onPress={() => onConfirm(selected)}
            style={({ pressed }) => [
              styles.doneAction,
              pressed && selected.length > 0 && styles.pressed,
              !selected.length && styles.doneDisabled
            ]}
          >
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <ChatSearchBar
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            value={query}
          />
        </View>

        <SectionList
          contentContainerStyle={styles.listContent}
          initialNumToRender={12}
          keyExtractor={(item) => `${item.kind}:${item.targetId || 'all'}`}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {query.trim()
                ? `Nothing matches “${query}”.`
                : 'Nothing to choose from here yet.'}
            </Text>
          }
          maxToRenderPerBatch={12}
          removeClippedSubviews
          renderItem={({ index, item, section }) => {
            const covered = coverageFor ? coverageFor(item) : null;
            const isOn = isAudienceSelected(selected, item);
            const isFirst = index === 0;
            const isLast = index === section.data.length - 1;

            return (
              <View style={[
                styles.card,
                isFirst && styles.cardFirst,
                isLast && styles.cardLast
              ]}>
                {/* Drawn between rows rather than as a border on one, so it
                    stays inset and never cuts across the card's corners. */}
                {isFirst ? null : <View style={styles.divider} />}
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: isOn, disabled: !!covered }}
                  disabled={!!covered}
                  onPress={() => setSelected((current) => toggleAudience(current, item))}
                  style={({ pressed }) => [
                    styles.row,
                    covered && styles.rowCovered,
                    pressed && !covered && styles.pressed
                  ]}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowName}>{item.targetName}</Text>
                    <Text style={styles.rowDescription}>{covered || item.description}</Text>
                  </View>
                  <AppSwitch
                    disabled={!!covered}
                    onValueChange={() => setSelected((current) => toggleAudience(current, item))}
                    value={isOn || !!covered}
                  />
                </Pressable>
              </View>
            );
          }}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          sections={sections}
          stickySectionHeadersEnabled={false}
          style={styles.list}
        />

        <View style={[styles.foot, { paddingBottom: Math.max(14, screenBottomInset + 12) }]}>
          <Text style={styles.count}>
            {countError || describeSelection(selected, recipientCount)}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    sheet: {
      // The page is the tinted ground; only the cards on it are white.
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
    doneAction: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      minHeight: 44,
      minWidth: 44
    },
    done: {
      color: colors.link,
      fontSize: 16,
      lineHeight: 21
    },
    doneDisabled: {
      opacity: 0.35
    },
    // Room around the field for its shadow to fall into.
    searchWrap: {
      paddingBottom: 2,
      paddingHorizontal: 15,
      paddingTop: 10
    },
    list: {
      flex: 1
    },
    listContent: {
      paddingBottom: 12
    },
    sectionHeader: {
      color: colors.muted,
      fontSize: 13,
      marginLeft: 15,
      marginTop: 18,
      paddingBottom: 7
    },
    /**
     * One card per section, built a row at a time.
     *
     * A long list cannot be a stack of cards — three hundred of them is a page
     * of stripes. Each row carries the card's colour and its side margins, and
     * only the first and last round their corners, so however many rows a
     * company has they read as one continuous card.
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
      minHeight: 58,
      paddingHorizontal: 16,
      paddingVertical: 12
    },
    rowCovered: {
      opacity: 0.55
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
    rowDescription: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 2
    },
    empty: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 20,
      paddingHorizontal: 15,
      paddingVertical: 32,
      textAlign: 'center'
    },
    // Held against the foot of the screen, clear of the navigation bar.
    foot: {
      paddingHorizontal: 15,
      paddingTop: 12
    },
    count: {
      color: colors.ink,
      fontSize: 15,
      lineHeight: 20
    },
    pressed: {
      backgroundColor: colors.groupedBackground
    }
  });
}
