import Feather from '@expo/vector-icons/Feather';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { FeatherIconName } from '../../types/featherIcon';
import type { LayoutChangeEvent } from 'react-native';
import type { LswDailyTask, LswDayKey, LswDayStatusValue, LswFollowUpSummary, LswTodoTaskSummary, LswWorkspaceContext } from '../../services/lswApi';
import { ActivityIndicator, Animated, PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import { CHAT_ROW_SWIPE_TRIGGER, LSW_DAILY_ROW_ACTION_WIDTH, styles } from '../../screens/adminChatStyles';
import { useAppTheme } from '../../theme/AppThemeProvider';

/**
 * The LSW workspace.
 *
 * Not chat code, and never was — it only lived in the chat screen because that
 * file grew into the whole admin app. Lifted out unchanged.
 */

export type LswWorkspaceTab = 'follow-ups' | 'today' | 'week';

export type LswTodoFilter = 'done' | 'open' | 'this-week' | 'today';

export type LswFollowUpFilter = 'all' | 'open' | 'past-due' | 'this-week';

type LswWeekdayTabKey = LswDayKey;

export const LSW_DAY_KEYS: LswDayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const LSW_WEEKDAY_TABS: Array<[LswWeekdayTabKey, string]> = [
  ['mon', 'Mon'],
  ['tue', 'Tue'],
  ['wed', 'Wed'],
  ['thu', 'Thu'],
  ['fri', 'Fri'],
  ['sat', 'Sat'],
  ['sun', 'Sun']
];

export function LswWorkspaceScreen({
  activeTab,
  context,
  dailyTasks,
  errorMessage,
  followUpFilter,
  followUps,
  isLoading,
  isRefreshing,
  onAddDailyTask,
  onAddFollowUp,
  onAddTodo,
  onCurrentWeek,
  onDeleteDailyTask,
  onEditDailyTask,
  onEditFollowUp,
  onEditTodo,
  onRefreshSection,
  onSelectTab,
  onWeekOffset,
  onToggleDailyTaskDay,
  onToggleTodo,
  onUpdateFollowUpFilter,
  onUpdateTodoFilter,
  savingRecordId,
  todoFilter,
  todoTasks
}: {
  activeTab: LswWorkspaceTab;
  context: LswWorkspaceContext | null;
  dailyTasks: LswDailyTask[];
  errorMessage: string | null;
  followUpFilter: LswFollowUpFilter;
  followUps: LswFollowUpSummary[];
  isLoading: boolean;
  isRefreshing: boolean;
  onAddDailyTask: () => void;
  onAddFollowUp: () => void;
  onAddTodo: () => void;
  onCurrentWeek: () => void;
  onDeleteDailyTask: (task: LswDailyTask) => void;
  onEditDailyTask: (task: LswDailyTask) => void;
  onEditFollowUp: (followUp: LswFollowUpSummary) => void;
  onEditTodo: (task: LswTodoTaskSummary) => void;
  onRefreshSection: () => Promise<void>;
  onSelectTab: (tab: LswWorkspaceTab) => void;
  onWeekOffset: (offset: number) => void;
  onToggleDailyTaskDay: (task: LswDailyTask, dayKey: LswDayKey) => void;
  onToggleTodo: (task: LswTodoTaskSummary) => void;
  onUpdateFollowUpFilter: (filter: LswFollowUpFilter) => void;
  onUpdateTodoFilter: (filter: LswTodoFilter) => void;
  savingRecordId: string | null;
  todoFilter: LswTodoFilter;
  todoTasks: LswTodoTaskSummary[];
}) {
  const appTheme = useAppTheme();
  const visibleTodos = useMemo(() => filterLswTodoTasks(todoTasks, todoFilter), [todoFilter, todoTasks]);
  const visibleFollowUps = useMemo(() => filterLswFollowUps(followUps, followUpFilter), [followUpFilter, followUps]);
  const isReadOnly = context?.isReadOnly === true;
  const isWeekNavigationDisabled = isLoading || isRefreshing || !context;
  const [selectedDailyTaskDay, setSelectedDailyTaskDay] = useState<LswWeekdayTabKey>(getDefaultLswWeekdayTab(context));
  const [bodyContentHeight, setBodyContentHeight] = useState(0);
  const [bodyViewportHeight, setBodyViewportHeight] = useState(0);
  const [isFloatingMenuOpen, setIsFloatingMenuOpen] = useState(false);
  const isBodyScrollable = bodyContentHeight > bodyViewportHeight + 1;
  const isCurrentWeekDisabled = isLoading || isRefreshing || context?.week.isCurrentWeek === true;

  useEffect(() => {
    if (activeTab === 'week') {
      setSelectedDailyTaskDay(getDefaultLswWeekdayTab(context));
    } else {
      setIsFloatingMenuOpen(false);
    }
  }, [activeTab, context?.week.weekKey]);

  return (
    <View style={[styles.lswScreen, { backgroundColor: appTheme.colors.screen }]}>
      <View style={[styles.lswFixedHeader, { backgroundColor: appTheme.colors.screen }]}>
        <View style={styles.lswHeroRow}>
          <Pressable
            accessibilityLabel="Previous week"
            accessibilityRole="button"
            disabled={isWeekNavigationDisabled}
            onPress={() => onWeekOffset(-1)}
            style={({ pressed }) => [styles.lswWeekNavButton, { borderColor: appTheme.colors.border, backgroundColor: appTheme.colors.surfaceElevated }, pressed && !isWeekNavigationDisabled && styles.pressed, isWeekNavigationDisabled && styles.disabled]}
          >
            <Feather color={appTheme.colors.primary} name="chevron-left" size={20} />
          </Pressable>
          <Text numberOfLines={1} style={[styles.lswWeekNavLabel, { color: appTheme.colors.mutedStrong }]}>
            {formatLswWeekNavigationLabel(context)}
          </Text>
          <Pressable
            accessibilityLabel="Next week"
            accessibilityRole="button"
            disabled={isWeekNavigationDisabled}
            onPress={() => onWeekOffset(1)}
            style={({ pressed }) => [styles.lswWeekNavButton, { borderColor: appTheme.colors.border, backgroundColor: appTheme.colors.surfaceElevated }, pressed && !isWeekNavigationDisabled && styles.pressed, isWeekNavigationDisabled && styles.disabled]}
          >
            <Feather color={appTheme.colors.primary} name="chevron-right" size={20} />
          </Pressable>
        </View>

        {activeTab === 'week' ? (
          <LswWeekdayTabRow
            activeDay={selectedDailyTaskDay}
            onSelectDay={setSelectedDailyTaskDay}
          />
        ) : null}
      </View>

      <ScrollView
        alwaysBounceVertical={false}
        bounces={false}
        contentContainerStyle={styles.lswScreenContent}
        onContentSizeChange={(_width, height) => setBodyContentHeight(height)}
        onLayout={(event: LayoutChangeEvent) => setBodyViewportHeight(event.nativeEvent.layout.height)}
        overScrollMode="never"
        scrollEnabled={isBodyScrollable}
        showsVerticalScrollIndicator={false}
        style={styles.lswScrollBody}
      >

      {errorMessage ? (
        <View style={styles.lswErrorBanner}>
          <Text style={styles.lswErrorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {isReadOnly ? (
        <View style={[styles.lswReadOnlyBanner, { borderColor: appTheme.colors.border }]}>
          <Feather color={appTheme.colors.mutedStrong} name="eye" size={16} />
          <Text style={[styles.lswReadOnlyText, { color: appTheme.colors.mutedStrong }]}>View only</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={appTheme.colors.primary} />
        </View>
      ) : null}

      {activeTab === 'today' ? (
        <View style={styles.lswSection}>
          <LswSectionHeader disabled={isReadOnly} onAdd={onAddTodo} title="To Do Today & This Week" />
          <LswFilterRow
            active={todoFilter}
            options={[
              ['open', 'Open'],
              ['today', 'Today'],
              ['this-week', 'This Week'],
              ['done', 'Done']
            ]}
            onChange={onUpdateTodoFilter}
          />
          {visibleTodos.length ? visibleTodos.map((task) => (
            <LswTodoRow
              disabled={isReadOnly || savingRecordId === `todo:${task.taskId}`}
              key={task.taskId}
              onEdit={() => onEditTodo(task)}
              onToggle={() => onToggleTodo(task)}
              task={task}
            />
          )) : <LswEmptyState label="No To Do items in this view." />}
        </View>
      ) : null}

      {activeTab === 'week' ? (
        <View style={styles.lswSection}>
          {dailyTasks.length ? dailyTasks.map((task) => (
            <LswDailyTaskRow
              dayKey={selectedDailyTaskDay}
              disabled={isReadOnly || savingRecordId === `daily:${task.taskId}:delete`}
              isCheckboxSaving={savingRecordId === `daily:${task.taskId}:${selectedDailyTaskDay}`}
              key={task.taskId}
              onDelete={() => onDeleteDailyTask(task)}
              onEdit={() => onEditDailyTask(task)}
              onToggleDay={() => onToggleDailyTaskDay(task, selectedDailyTaskDay)}
              task={task}
            />
          )) : <LswEmptyState label="No daily or weekly standard tasks yet." />}
        </View>
      ) : null}

      {activeTab === 'follow-ups' ? (
        <View style={styles.lswSection}>
          <LswSectionHeader disabled={isReadOnly} onAdd={onAddFollowUp} title="Follow Ups" />
          <LswFilterRow
            active={followUpFilter}
            options={[
              ['open', 'Open'],
              ['past-due', 'Past Due'],
              ['this-week', 'This Week'],
              ['all', 'All']
            ]}
            onChange={onUpdateFollowUpFilter}
          />
          {visibleFollowUps.length ? visibleFollowUps.map((followUp) => (
            <LswFollowUpRow
              disabled={isReadOnly || savingRecordId === `follow-up:${followUp.followUpId}`}
              followUp={followUp}
              key={followUp.followUpId}
              onEdit={() => onEditFollowUp(followUp)}
            />
          )) : <LswEmptyState label="No Follow Ups in this view." />}
        </View>
      ) : null}
      </ScrollView>
      {activeTab === 'week' && !isReadOnly ? (
        <View style={styles.lswFloatingActionWrap}>
          {isFloatingMenuOpen ? (
            <View style={[styles.lswFloatingMenu, { backgroundColor: appTheme.colors.surfaceElevated, borderColor: appTheme.colors.border }]}>
              <View style={[styles.lswFloatingMenuTail, { backgroundColor: appTheme.colors.surfaceElevated, borderColor: appTheme.colors.border }]} />
              <LswFloatingMenuItem
                icon="refresh-cw"
                label="Refresh"
                onPress={() => {
                  setIsFloatingMenuOpen(false);
                  void onRefreshSection();
                }}
              />
              <LswFloatingMenuItem
                disabled={isCurrentWeekDisabled}
                icon="calendar"
                label="Current Week"
                onPress={() => {
                  setIsFloatingMenuOpen(false);
                  onCurrentWeek();
                }}
              />
              <LswFloatingMenuItem
                icon="plus"
                label="Add Task"
                onPress={() => {
                  setIsFloatingMenuOpen(false);
                  onAddDailyTask();
                }}
              />
            </View>
          ) : null}
          <Pressable
            accessibilityLabel="Open standard task actions"
            accessibilityRole="button"
            accessibilityState={{ expanded: isFloatingMenuOpen }}
            onPress={() => setIsFloatingMenuOpen((isOpen) => !isOpen)}
            style={({ pressed }) => [styles.lswFloatingAddButton, { backgroundColor: appTheme.colors.primary }, pressed && styles.pressed]}
          >
            <Feather color="#FFFFFF" name={isFloatingMenuOpen ? 'x' : 'plus'} size={26} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function LswSectionHeader({ disabled, onAdd, title }: { disabled: boolean; onAdd: () => void; title: string }) {
  const appTheme = useAppTheme();

  return (
    <View style={styles.lswSectionHeader}>
      <Text style={[styles.lswSectionTitle, { color: appTheme.colors.ink }]}>{title}</Text>
      <Pressable
        accessibilityLabel={`Add ${title}`}
        accessibilityRole="button"
        disabled={disabled}
        onPress={onAdd}
        style={({ pressed }) => [styles.lswAddButton, { backgroundColor: appTheme.colors.primary }, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
      >
        <Feather color="#FFFFFF" name="plus" size={16} />
        <Text style={styles.lswAddButtonText}>Add</Text>
      </Pressable>
    </View>
  );
}

function LswFloatingMenuItem({ disabled = false, icon, label, onPress }: {
  disabled?: boolean;
  icon: FeatherIconName;
  label: string;
  onPress: () => void;
}) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.lswFloatingMenuItem, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
    >
      <Feather color={disabled ? appTheme.colors.muted : appTheme.colors.primary} name={icon} size={17} />
      <Text style={[styles.lswFloatingMenuText, { color: disabled ? appTheme.colors.muted : appTheme.colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

function LswFilterRow<T extends string>({ active, onChange, options }: { active: T; onChange: (value: T) => void; options: Array<[T, string]> }) {
  const appTheme = useAppTheme();

  return (
    <ScrollView contentContainerStyle={styles.lswFilterRow} horizontal showsHorizontalScrollIndicator={false}>
      {options.map(([value, label]) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: active === value }}
          key={value}
          onPress={() => onChange(value)}
          style={[styles.lswFilterChip, { borderColor: active === value ? appTheme.colors.primary : appTheme.colors.border, backgroundColor: active === value ? appTheme.colors.primarySoft : appTheme.colors.surface }]}
        >
          <Text style={[styles.lswFilterChipText, { color: active === value ? appTheme.colors.primary : appTheme.colors.mutedStrong }]}>{label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function LswTodoRow({ disabled, onEdit, onToggle, task }: {
  disabled: boolean;
  onEdit: () => void;
  onToggle: () => void;
  task: LswTodoTaskSummary;
}) {
  const appTheme = useAppTheme();

  return (
    <View style={[styles.lswRowCard, { backgroundColor: appTheme.colors.surfaceElevated, borderColor: appTheme.colors.border }]}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: task.completed }} disabled={disabled} onPress={onToggle} style={styles.lswCheckWrap}>
        <View style={[styles.lswCheckbox, { borderColor: task.completed ? appTheme.colors.primary : appTheme.colors.border, backgroundColor: task.completed ? appTheme.colors.primary : 'transparent' }]}>
          {task.completed ? <Feather color="#FFFFFF" name="check" size={14} /> : null}
        </View>
      </Pressable>
      <View style={styles.lswRowText}>
        <Text style={[styles.lswRowTitle, task.completed && styles.lswCompletedText, { color: appTheme.colors.ink }]}>{task.task || 'Untitled To Do'}</Text>
        <Text style={[styles.lswRowMeta, { color: appTheme.colors.muted }]}>{formatLswDueDateTime(task.dueDate, task.dueTime)}</Text>
      </View>
      <LswRowActions disabled={disabled} onEdit={onEdit} />
    </View>
  );
}

function LswFollowUpRow({ disabled, followUp, onEdit }: {
  disabled: boolean;
  followUp: LswFollowUpSummary;
  onEdit: () => void;
}) {
  const appTheme = useAppTheme();

  return (
    <View style={[styles.lswRowCard, { backgroundColor: appTheme.colors.surfaceElevated, borderColor: appTheme.colors.border }]}>
      <View style={styles.lswRowText}>
        <Text style={[styles.lswRowTitle, { color: appTheme.colors.ink }]}>{followUp.followUp || 'Untitled Follow Up'}</Text>
        <Text style={[styles.lswRowMeta, { color: appTheme.colors.muted }]}>{followUp.responsible || 'Responsible required'} - {formatLswDisplayDate(followUp.dueDate)}</Text>
        {followUp.comments ? <Text numberOfLines={2} style={[styles.lswRowNote, { color: appTheme.colors.mutedStrong }]}>{followUp.comments}</Text> : null}
      </View>
      <LswRowActions disabled={disabled} onEdit={onEdit} />
    </View>
  );
}

function LswWeekdayTabRow({ activeDay, onSelectDay }: { activeDay: LswWeekdayTabKey; onSelectDay: (dayKey: LswWeekdayTabKey) => void }) {
  const appTheme = useAppTheme();

  return (
    <View style={styles.lswWeekdayTabs}>
      {LSW_WEEKDAY_TABS.map(([dayKey, label]) => {
        const isActive = activeDay === dayKey;

        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            key={dayKey}
            onPress={() => onSelectDay(dayKey)}
            style={[styles.lswWeekdayTab, { borderColor: isActive ? appTheme.colors.primary : appTheme.colors.border, backgroundColor: isActive ? appTheme.colors.primarySoft : appTheme.colors.surface }]}
          >
            <Text style={[styles.lswWeekdayTabText, { color: isActive ? appTheme.colors.primary : appTheme.colors.mutedStrong }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function LswDailyTaskRow({ dayKey, disabled, isCheckboxSaving, onDelete, onEdit, onToggleDay, task }: {
  dayKey: LswWeekdayTabKey;
  disabled: boolean;
  isCheckboxSaving: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onToggleDay: () => void;
  task: LswDailyTask;
}) {
  const appTheme = useAppTheme();
  const status = getLswDailyTaskDayStatus(task, dayKey);
  const isComplete = status !== 'not_completed';
  const translateX = useRef(new Animated.Value(0)).current;
  const offsetRef = useRef(0);

  const closeSwipe = () => {
    offsetRef.current = 0;
    Animated.spring(translateX, {
      damping: 20,
      mass: 0.75,
      stiffness: 170,
      toValue: 0,
      useNativeDriver: true
    }).start();
  };

  const snapSwipe = () => {
    offsetRef.current = -LSW_DAILY_ROW_ACTION_WIDTH;
    Animated.spring(translateX, {
      damping: 20,
      mass: 0.75,
      stiffness: 170,
      toValue: -LSW_DAILY_ROW_ACTION_WIDTH,
      useNativeDriver: true
    }).start();
  };

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gestureState) =>
      !disabled &&
      Math.abs(gestureState.dx) > 4 &&
      Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.08,
    onMoveShouldSetPanResponderCapture: (_event, gestureState) =>
      !disabled &&
      Math.abs(gestureState.dx) > 6 &&
      Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.08,
    onPanResponderGrant: () => {
      translateX.stopAnimation((value) => {
        offsetRef.current = value;
      });
    },
    onPanResponderMove: (_event, gestureState) => {
      const nextValue = Math.max(
        -LSW_DAILY_ROW_ACTION_WIDTH,
        Math.min(0, offsetRef.current + gestureState.dx)
      );

      translateX.setValue(nextValue);
    },
    onPanResponderRelease: (_event, gestureState) => {
      if (gestureState.dx <= -CHAT_ROW_SWIPE_TRIGGER || gestureState.vx <= -0.18) {
        snapSwipe();
        return;
      }

      closeSwipe();
    },
    onPanResponderTerminate: closeSwipe,
    onPanResponderTerminationRequest: () => false,
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => !disabled && offsetRef.current !== 0
  }), [disabled, translateX]);

  useEffect(() => {
    closeSwipe();
  }, [dayKey, disabled, task.taskId]);

  return (
    <View style={[styles.lswDailySwipeShell, { backgroundColor: appTheme.colors.screen }]}>
      <View style={styles.lswDailySwipeRightActions}>
        <Pressable
          accessibilityLabel={`Delete ${task.task || 'standard task'}`}
          accessibilityRole="button"
          disabled={disabled || isCheckboxSaving}
          onPress={() => {
            closeSwipe();
            onDelete();
          }}
          style={({ pressed }) => [styles.lswDailySwipeDeleteAction, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
        >
          <Feather color="#FFFFFF" name="trash-2" size={18} />
          <Text style={styles.chatSwipeActionText}>Delete</Text>
        </Pressable>
      </View>

      <Animated.View
        style={[
          styles.lswDailySwipeContent,
          { backgroundColor: appTheme.colors.screen },
          { transform: [{ translateX }] }
        ]}
        {...panResponder.panHandlers}
      >
        <View style={[styles.lswDailyRow, { borderBottomColor: appTheme.colors.border }, disabled && styles.disabled]}>
          <Pressable
            accessibilityLabel={`Edit ${task.task || 'standard task'}`}
            accessibilityRole="button"
            disabled={disabled || isCheckboxSaving}
            onPress={onEdit}
            style={({ pressed }) => [styles.lswDailyTextButton, pressed && !disabled && styles.pressed]}
          >
            <Text style={[styles.lswRowTitle, { color: appTheme.colors.ink }]}>{task.task || 'Untitled Standard Task'}</Text>
            <Text style={[styles.lswRowMeta, { color: appTheme.colors.muted }]}>{task.minutes || 0} min - {formatLswTime(task.time)}</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={`Toggle ${getLswDayLabel(dayKey)} completion`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isComplete }}
            disabled={disabled}
            hitSlop={10}
            onPress={onToggleDay}
            style={styles.lswDailyCheckboxWrap}
          >
            <View style={[styles.lswNativeCheckbox, { borderColor: isComplete ? appTheme.colors.primary : appTheme.colors.border, backgroundColor: isComplete ? appTheme.colors.primary : appTheme.colors.surface }, isCheckboxSaving && styles.lswNativeCheckboxSaving]}>
              {isComplete ? <Feather color="#FFFFFF" name="check" size={15} /> : null}
            </View>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

function LswRowActions({ disabled, onEdit }: { disabled: boolean; onEdit: () => void }) {
  const appTheme = useAppTheme();

  return (
    <View style={styles.lswRowActions}>
      <Pressable accessibilityLabel="Edit" accessibilityRole="button" disabled={disabled} onPress={onEdit} style={({ pressed }) => [styles.lswIconAction, pressed && !disabled && styles.pressed, disabled && styles.disabled]}>
        <Feather color={appTheme.colors.primary} name="edit-3" size={17} />
      </Pressable>
    </View>
  );
}

function LswEmptyState({ label }: { label: string }) {
  const appTheme = useAppTheme();

  return (
    <View style={[styles.lswEmptyState, { borderColor: appTheme.colors.border }]}>
      <Text style={[styles.lswEmptyText, { color: appTheme.colors.muted }]}>{label}</Text>
    </View>
  );
}

function filterLswTodoTasks(tasks: LswTodoTaskSummary[], filter: LswTodoFilter): LswTodoTaskSummary[] {
  const today = formatLocalDateOnly(new Date());
  const weekEnd = addDaysToDateString(today, 6);

  return tasks.filter((task) => {
    if (filter === 'done') {
      return task.completed;
    }

    if (filter === 'today') {
      return !task.completed && task.dueDate <= today;
    }

    if (filter === 'this-week') {
      return !task.completed && task.dueDate >= today && task.dueDate <= weekEnd;
    }

    return !task.completed;
  });
}

function filterLswFollowUps(followUps: LswFollowUpSummary[], filter: LswFollowUpFilter): LswFollowUpSummary[] {
  const today = formatLocalDateOnly(new Date());
  const weekEnd = addDaysToDateString(today, 6);

  return followUps.filter((followUp) => {
    if (filter === 'all') {
      return true;
    }

    if (filter === 'past-due') {
      return followUp.dueDate < today;
    }

    if (filter === 'this-week') {
      return followUp.dueDate >= today && followUp.dueDate <= weekEnd;
    }

    return followUp.status !== 'DELETED';
  });
}

function getLswDayLabel(dayKey: LswDayKey): string {
  return dayKey.charAt(0).toUpperCase() + dayKey.slice(1);
}

function getLswDailyTaskDayStatus(task: LswDailyTask, dayKey: LswDayKey): LswDayStatusValue {
  return task.dayStatuses?.[dayKey]?.status || (task.days?.[dayKey] ? 'completed_on_time' : 'not_completed');
}

function getDefaultLswWeekdayTab(context: LswWorkspaceContext | null): LswWeekdayTabKey {
  const dayKey = getLswDayKeyFromDateOnly(context?.week.todayIso) || LSW_DAY_KEYS[(new Date().getDay() + 6) % 7];

  return LSW_WEEKDAY_TABS.some(([tabKey]) => tabKey === dayKey)
    ? dayKey as LswWeekdayTabKey
    : 'mon';
}

function getLswDayKeyFromDateOnly(value?: string): LswDayKey | null {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  return LSW_DAY_KEYS[(new Date(year, month - 1, day).getDay() + 6) % 7];
}

export function formatLocalDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatLswDisplayDate(value: string): string {
  if (!value) {
    return 'No date';
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year || 1970, (month || 1) - 1, day || 1);

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatLswDueDateTime(dueDate: string, dueTime: string): string {
  return `${formatLswDisplayDate(dueDate)} at ${formatLswTime(dueTime)}`;
}

function formatLswWeekNavigationLabel(context: LswWorkspaceContext | null): string {
  if (!context?.week.weekBeginning || !context.week.weekEnding) {
    return 'Week --';
  }

  return `Week ${context.week.selectedWeek}  ${formatLswDisplayDate(context.week.weekBeginning)} - ${formatLswDisplayDate(context.week.weekEnding)}`;
}

function formatLswTime(value: string): string {
  const [hoursRaw, minutesRaw] = value.split(':').map(Number);
  const hours = Number.isFinite(hoursRaw) ? hoursRaw : 0;
  const minutes = Number.isFinite(minutesRaw) ? minutesRaw : 0;
  const date = new Date();

  date.setHours(hours, minutes, 0, 0);

  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function addDaysToDateString(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year || 1970, (month || 1) - 1, day || 1);
  date.setDate(date.getDate() + days);

  return formatLocalDateOnly(date);
}
