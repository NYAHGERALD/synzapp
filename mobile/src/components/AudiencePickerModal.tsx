import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';
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
import { AppSwitch } from './ui/AppSwitch';
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

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
      <View style={styles.sheet}>
        <View style={[styles.head, { paddingTop: insets.top + 12 }]}>
          <Pressable accessibilityRole="button" onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={!selected.length}
            onPress={() => onConfirm(selected)}
          >
            <Text style={[styles.done, !selected.length && styles.doneDisabled]}>Done</Text>
          </Pressable>
        </View>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder={searchPlaceholder}
          placeholderTextColor={appTheme.colors.muted}
          style={styles.search}
          value={query}
        />

        <SectionList
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
          renderItem={({ item }) => {
            const covered = coverageFor ? coverageFor(item) : null;
            const isOn = isAudienceSelected(selected, item);

            return (
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
            );
          }}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          sections={sections}
          stickySectionHeadersEnabled={false}
          style={styles.list}
        />

        <View style={styles.foot}>
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
    cancel: {
      color: colors.primary,
      fontSize: 16
    },
    done: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '500'
    },
    doneDisabled: {
      color: colors.muted
    },
    search: {
      backgroundColor: colors.surface,
      borderColor: colors.divider,
      borderRadius: 12,
      borderWidth: 1,
      color: colors.ink,
      fontSize: 16,
      margin: 16,
      paddingHorizontal: 14,
      paddingVertical: 12
    },
    list: {
      flex: 1,
      paddingHorizontal: 16
    },
    sectionHeader: {
      color: colors.muted,
      fontSize: 13,
      letterSpacing: 0.4,
      paddingBottom: 6,
      paddingTop: 18,
      textTransform: 'uppercase'
    },
    row: {
      alignItems: 'center',
      borderBottomColor: colors.divider,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 12,
      paddingVertical: 14
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
      fontWeight: '500'
    },
    rowDescription: {
      color: colors.muted,
      fontSize: 13,
      marginTop: 2
    },
    empty: {
      color: colors.muted,
      fontSize: 15,
      paddingVertical: 32,
      textAlign: 'center'
    },
    foot: {
      borderTopColor: colors.divider,
      borderTopWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 14
    },
    count: {
      color: colors.ink,
      fontSize: 15,
      fontWeight: '500'
    },
    pressed: {
      opacity: 0.85
    }
  });
}
