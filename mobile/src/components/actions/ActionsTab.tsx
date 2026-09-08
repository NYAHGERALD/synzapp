import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { listActions, type ActionRecord } from '../../services/actionApi';
// describeStatus still comes along: the status is gone from the row, but the
// dot's colour is the only thing carrying it and a screen reader cannot see a
// colour, so the spoken label says it in words.
import { describeStatus, statusDotColor } from '../../services/actionDisplay';
import {
  buildActionFilterCounts,
  filterActionsByTab,
  type ActionsTabFilter
} from '../../services/actionsTabFilters';
import { ActionsOptionsMenu } from './ActionsOptionsMenu';
import { useAppTheme } from '../../theme/AppThemeProvider';
import type { AppColors } from '../../theme/colors';

/**
 * Every action this person is allowed to see, in one place.
 *
 * Until now an action could only be found inside the chat it was raised from,
 * which is fine for the person who raised it and useless for the department
 * that has to do the work.
 *
 * **What appears here is decided by the server, not filtered here.** An
 * employee is sent their own department's actions; an org admin is sent the
 * tenant's. Filtering a wider list on the phone would mean the wider list had
 * already been handed over, which is the same leak with an extra step. See
 * section 3 of SYNZAPP_ACTIONS_GOVERNANCE_PLAN.md.
 */
export function ActionsTab({
  getIdToken,
  isOptionsOpen,
  onCloseOptions,
  onOpenAction
}: {
  getIdToken: () => Promise<string>;
  /** Opened from the header, so the filter costs the list no room. */
  isOptionsOpen: boolean;
  onCloseOptions: () => void;
  onOpenAction: (action: ActionRecord) => void;
}) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme.colors), [appTheme.colors]);
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [filter, setFilter] = useState<ActionsTabFilter>('outstanding');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    }

    try {
      const page = await listActions({ idToken: await getIdToken() });

      setActions(page.actions);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Actions could not be loaded.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => buildActionFilterCounts(actions), [actions]);
  const visible = useMemo(() => filterActionsByTab(actions, filter), [actions, filter]);

  if (isLoading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={appTheme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ActionsOptionsMenu
        counts={counts}
        isOpen={isOptionsOpen}
        onClose={onCloseOptions}
        onSelect={(nextFilter) => {
          setFilter(nextFilter);
          onCloseOptions();
        }}
        selected={filter}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        contentContainerStyle={styles.listContent}
        data={visible}
        keyExtractor={(item) => item.actionId}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {filter === 'outstanding'
              ? 'Nothing outstanding for your department.'
              : filter === 'done'
                ? 'Nothing has been completed yet.'
                : 'No actions to show yet.'}
          </Text>
        }
        refreshControl={
          <RefreshControl
            onRefresh={() => void load(true)}
            refreshing={isRefreshing}
            tintColor={appTheme.colors.primary}
          />
        }
        renderItem={({ index, item }) => (
          <Pressable
            accessibilityLabel={`${item.title}, ${describeStatus(item.status)}`}
            accessibilityRole="button"
            onPress={() => onOpenAction(item)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={[
              styles.statusDot,
              { backgroundColor: statusDotColor(item.status, appTheme.isDark) }
            ]} />
            <Text numberOfLines={2} style={styles.rowTitle}>{item.title}</Text>
            <Feather color={appTheme.colors.muted} name="chevron-right" size={20} />
            {/* Drawn as its own element rather than as a border, which would
                span the whole row and could not start where the text does.
                Not under the last row, where it would be a line to nowhere. */}
            {index < visible.length - 1 ? <View style={styles.divider} /> : null}
          </Pressable>
        )}
      />
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    screen: {
      backgroundColor: colors.groupedBackground,
      flex: 1
    },
    listContent: {
      // Not the tab bar's 98. This screen has a back button instead of the tab
      // bar, so reserving room for one would leave a band of dead space under
      // the last action.
      paddingBottom: 24,
      paddingTop: 4
    },
    // One continuous list, not a stack of cards. The rows share the page
    // colour and a hairline separates them, the same as the chat list and the
    // departments list. Only a rounded card is ever white.
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      // The standard 15 from the screen edge, as everywhere else.
      paddingHorizontal: 15,
      paddingVertical: 14
    },
    statusDot: {
      borderRadius: 5,
      height: 10,
      width: 10
    },
    rowTitle: {
      color: colors.ink,
      flex: 1,
      fontSize: 16,
      fontWeight: '500',
      minWidth: 0
    },
    divider: {
      backgroundColor: colors.separator,
      bottom: 0,
      height: 1,
      // Where the title starts: 15 of page padding, the 10 dot, the 12 gap.
      left: 37,
      position: 'absolute',
      right: 0
    },
    centre: {
      alignItems: 'center',
      backgroundColor: colors.groupedBackground,
      flex: 1,
      justifyContent: 'center'
    },
    empty: {
      color: colors.muted,
      fontSize: 15,
      paddingVertical: 40,
      textAlign: 'center'
    },
    error: {
      color: colors.destructive,
      fontSize: 14,
      paddingHorizontal: 15,
      paddingVertical: 8
    },
    pressed: {
      opacity: 0.85
    }
  });
}
