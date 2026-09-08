import Feather from '@expo/vector-icons/Feather';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View
} from 'react-native';
import type { TenantScheduledMessage } from '../../services/adminApi';
import {
  EMPTY_SCHEDULED_MESSAGE_FILTERS,
  type ScheduledMessageDateFilter,
  filterTenantScheduledMessages,
  listScheduledMessageDepartments
} from '../../services/scheduledMessageFilters';
import { PressableScale } from '../messages/SheetPresentation';
import { formatScheduledTime } from '../../services/scheduleMessageTimes';
import { styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Everything waiting to be sent across the company, at full height.
 *
 * It began as a short list inside a settings page, which was right for a
 * company of thirty and wrong for one of three hundred. A queue people have to
 * scroll is a queue nobody reads, so this takes the whole screen and comes with
 * the three ways somebody actually looks for something: a name, a team, and a
 * day.
 *
 * **No message text appears here, and none can.** The records it renders have
 * no field for one. That is the point of the screen: an administrator can see
 * that a message is waiting and stop it, and cannot read what a colleague
 * wrote.
 */

const DATE_FILTERS: { id: ScheduledMessageDateFilter; label: string }[] = [
  { id: 'ALL', label: 'Any time' },
  { id: 'TODAY', label: 'Today' },
  { id: 'TOMORROW', label: 'Tomorrow' },
  { id: 'WEEK', label: 'Next 7 days' },
  { id: 'LATER', label: 'Later' }
];

export function WaitingMessagesModal({
  busyScheduledMessageId,
  isLoading,
  onClose,
  onStop,
  scheduledMessages,
  visible
}: {
  busyScheduledMessageId: string | null;
  isLoading: boolean;
  onClose: () => void;
  onStop: (scheduledMessage: TenantScheduledMessage) => void;
  scheduledMessages: TenantScheduledMessage[];
  visible: boolean;
}) {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [filters, setFilters] = useState(EMPTY_SCHEDULED_MESSAGE_FILTERS);
  const [isMounted, setIsMounted] = useState(visible);
  const progress = React.useRef(new Animated.Value(0)).current;
  const now = useMemo(() => new Date(), [scheduledMessages]);
  const departments = useMemo(
    () => listScheduledMessageDepartments(scheduledMessages),
    [scheduledMessages]
  );
  const visibleMessages = useMemo(
    () => filterTenantScheduledMessages(scheduledMessages, filters, now),
    [filters, now, scheduledMessages]
  );

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      setFilters(EMPTY_SCHEDULED_MESSAGE_FILTERS);
      Animated.spring(progress, {
        friction: 11,
        tension: 62,
        toValue: 1,
        useNativeDriver: true
      }).start();

      return;
    }

    Animated.timing(progress, {
      duration: 190,
      easing: Easing.in(Easing.cubic),
      toValue: 0,
      useNativeDriver: true
    }).start(({ finished }) => {
      if (finished) {
        setIsMounted(false);
      }
    });
  }, [progress, visible]);

  if (!isMounted) {
    return null;
  }

  return (
    <Modal hardwareAccelerated onRequestClose={onClose} statusBarTranslucent transparent visible>
      <Animated.View
        style={[
          styles.waitingMessagesRoot,
          {
            backgroundColor: appTheme.colors.screen,
            opacity: progress,
            paddingTop: insets.top,
            transform: [{
              translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [40, 0] })
            }]
          }
        ]}
      >
        <View style={[styles.waitingMessagesHeader, { borderBottomColor: appTheme.colors.border }]}>
          <View style={styles.waitingMessagesHeaderText}>
            <Text style={[styles.waitingMessagesTitle, { color: appTheme.colors.ink }]}>
              Waiting messages
            </Text>
            <Text style={[styles.waitingMessagesSubtitle, { color: appTheme.colors.muted }]}>
              {describeWaitingCount(visibleMessages.length, scheduledMessages.length)}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Close waiting messages"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.messageReactionPickerClose,
              { backgroundColor: appTheme.colors.surface, borderColor: appTheme.colors.border },
              pressed && styles.pressed
            ]}
          >
            <Feather color={appTheme.colors.mutedStrong} name="x" size={20} />
          </Pressable>
        </View>

        <View style={[
          styles.messageReactionPickerSearch,
          {
            backgroundColor: appTheme.colors.input,
            borderColor: appTheme.colors.border,
            marginHorizontal: 15
          }
        ]}>
          <Feather color={appTheme.colors.muted} name="search" size={18} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            onChangeText={(search) => setFilters((current) => ({ ...current, search }))}
            placeholder="Search a person or a team"
            placeholderTextColor={appTheme.colors.muted}
            returnKeyType="search"
            style={[styles.messageReactionPickerSearchInput, { color: appTheme.colors.ink }]}
            value={filters.search}
          />
        </View>

        <FilterChipRow
          chips={DATE_FILTERS.map((option) => ({ id: option.id, label: option.label }))}
          onSelect={(id) => setFilters((current) => ({
            ...current,
            date: id as ScheduledMessageDateFilter
          }))}
          selectedId={filters.date}
        />

        {departments.length > 1 ? (
          <FilterChipRow
            chips={[{ id: '', label: 'All teams' }, ...departments.map((department) => ({
              id: department.id,
              label: department.name
            }))]}
            onSelect={(departmentId) => setFilters((current) => ({ ...current, departmentId }))}
            selectedId={filters.departmentId}
          />
        ) : null}

        {isLoading ? (
          <View style={styles.waitingMessagesState}>
            <ActivityIndicator color={appTheme.colors.primary} />
          </View>
        ) : (
          <FlatList
            contentContainerStyle={[
              styles.waitingMessagesList,
              { paddingBottom: Math.max(insets.bottom, 18) + 12 }
            ]}
            data={visibleMessages}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item.scheduledMessageId}
            ListEmptyComponent={(
              <View style={styles.waitingMessagesState}>
                <Feather color={appTheme.colors.muted} name="clock" size={20} />
                <Text style={[styles.waitingMessagesEmpty, { color: appTheme.colors.mutedStrong }]}>
                  {scheduledMessages.length
                    ? 'Nothing matches what you are looking for.'
                    : 'Nobody has a message waiting to be sent.'}
                </Text>
              </View>
            )}
            renderItem={({ item }) => (
              <View style={[styles.waitingMessageRow, { borderBottomColor: appTheme.colors.border }]}>
                <View style={styles.waitingMessageText}>
                  <Text numberOfLines={1} style={[styles.waitingMessageTitle, { color: appTheme.colors.ink }]}>
                    {item.senderName} to {item.recipientName}
                  </Text>
                  <Text numberOfLines={1} style={[styles.waitingMessageMeta, { color: appTheme.colors.muted }]}>
                    {item.departmentName} · {formatScheduledTime(new Date(item.releaseAtMs), now)}
                  </Text>
                </View>
                {busyScheduledMessageId === item.scheduledMessageId ? (
                  <ActivityIndicator color={appTheme.colors.primary} size="small" />
                ) : (
                  <PressableScale
                    accessibilityLabel={`Stop the message from ${item.senderName}`}
                    onPress={() => onStop(item)}
                  >
                    <Text style={[styles.waitingMessageAction, { color: appTheme.colors.destructive }]}>
                      Stop
                    </Text>
                  </PressableScale>
                )}
              </View>
            )}
          />
        )}
      </Animated.View>
    </Modal>
  );
}

function FilterChipRow({
  chips,
  onSelect,
  selectedId
}: {
  chips: { id: string; label: string }[];
  onSelect: (id: string) => void;
  selectedId: string;
}) {
  const appTheme = useAppTheme();

  return (
    <FlatList
      contentContainerStyle={styles.waitingMessagesChipRow}
      data={chips}
      horizontal
      keyExtractor={(chip) => chip.id || 'all'}
      renderItem={({ item }) => {
        const isSelected = item.id === selectedId;

        return (
          <PressableScale
            accessibilityLabel={item.label}
            onPress={() => onSelect(item.id)}
            style={[
              styles.waitingMessagesChip,
              {
                backgroundColor: isSelected ? appTheme.colors.primarySoft : appTheme.colors.surface,
                borderColor: isSelected ? appTheme.colors.primary : appTheme.colors.border
              }
            ]}
          >
            <Text style={[
              styles.waitingMessagesChipText,
              { color: isSelected ? appTheme.colors.primary : appTheme.colors.mutedStrong }
            ]}>
              {item.label}
            </Text>
          </PressableScale>
        );
      }}
      showsHorizontalScrollIndicator={false}
    />
  );
}

/** Says how many are shown, and how many were filtered away to get there. */
export function describeWaitingCount(shown: number, total: number): string {
  if (shown === total) {
    return total === 1 ? '1 message waiting' : `${total} messages waiting`;
  }

  return `${shown} of ${total} shown`;
}
