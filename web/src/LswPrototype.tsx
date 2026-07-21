import React from 'react';
import { createPortal } from 'react-dom';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  TouchSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { useAppLoading } from './appLoading';
import {
  createLswDailyTask,
  createLswFollowUp,
  createLswImprovementProject,
  createLswMeetingRail,
  createLswPersonalGoal,
  createLswRcaTrigger,
  createLswScheduledTask,
  createLswTodoTask,
  deleteLswDailyTask,
  deleteLswFollowUp,
  deleteLswImprovementProject,
  deleteLswMeetingRail,
  deleteLswPersonalGoal,
  deleteLswRcaTrigger,
  deleteLswScheduledTask,
  deleteLswTodoTask,
  getLswContext,
  listLswDailyTasks,
  listLswFollowUps,
  listLswImprovementProjects,
  listLswKeyResults,
  listLswMeetingRails,
  listLswPersonalGoals,
  listLswRcaTriggers,
  listLswScheduledTasks,
  listLswTodoTasks,
  updateLswDailyTask,
  updateLswFollowUp,
  updateLswImprovementProject,
  updateLswMeetingRail,
  updateLswPersonalGoal,
  updateLswRcaTrigger,
  updateLswScheduledTask,
  updateLswTodoTask,
  updateLswSettings,
  type DayKey,
  type LswContext,
  type LswDailyTask,
  type LswDailyTaskPatch,
  type LswDayStatus,
  type LswFollowUp,
  type LswFollowUpPatch,
  type CompanyKeyResultsConfig,
  type KeyResultMetric,
  type KeyResultUnit,
  type LswImprovementProject,
  type LswImprovementProjectPatch,
  type LswImprovementProjectUpdate,
  type LswMeetingRail,
  type LswMeetingRailPatch,
  type LswPersonalGoal,
  type LswPersonalGoalPatch,
  type LswRcaTrigger,
  type LswRcaTriggerPatch,
  type LswScheduledTask,
  type LswScheduledTaskFrequency,
  type LswScheduledTaskPatch,
  type LswTodoTask,
  type LswTodoTaskPatch,
  type WorkDaysPerWeek
} from './lswApi';

const allDays: Array<{ key: DayKey; label: string }> = [
  { key: 'mon', label: 'M' },
  { key: 'tue', label: 'T' },
  { key: 'wed', label: 'W' },
  { key: 'thu', label: 'T' },
  { key: 'fri', label: 'F' },
  { key: 'sat', label: 'Sa' },
  { key: 'sun', label: 'Su' }
];

const LSW_HINT_DELAY_MS = 2000;
const scheduledTaskFrequencyGroups: Array<{ frequency: LswScheduledTaskFrequency; label: string }> = [
  { frequency: 'BI_WEEKLY', label: 'Bi-Weekly' },
  { frequency: 'MONTHLY', label: 'Monthly' },
  { frequency: 'QUARTERLY', label: 'Quarterly' },
  { frequency: 'ANNUALLY', label: 'Annually' }
];
const emptyKeyResultsConfig: CompanyKeyResultsConfig = {
  groups: [],
  units: [],
  updatedAt: null,
  updatedByUid: null
};

export function LswPrototype() {
  const appLoading = useAppLoading();
  const [lswContext, setLswContext] = React.useState<LswContext | null>(null);
  const [isLoadingContext, setIsLoadingContext] = React.useState(false);
  const [contextError, setContextError] = React.useState('');
  const [isContextErrorModalDismissed, setIsContextErrorModalDismissed] = React.useState(false);
  const [dailyTasks, setDailyTasks] = React.useState<LswDailyTask[]>([]);
  const [isLoadingDailyTasks, setIsLoadingDailyTasks] = React.useState(false);
  const [dailyTasksError, setDailyTasksError] = React.useState('');
  const [followUps, setFollowUps] = React.useState<LswFollowUp[]>([]);
  const [isLoadingFollowUps, setIsLoadingFollowUps] = React.useState(false);
  const [followUpsError, setFollowUpsError] = React.useState('');
  const [rcaTriggers, setRcaTriggers] = React.useState<LswRcaTrigger[]>([]);
  const [isLoadingRcaTriggers, setIsLoadingRcaTriggers] = React.useState(false);
  const [rcaTriggersError, setRcaTriggersError] = React.useState('');
  const [showPastDueRcaTriggersOnly, setShowPastDueRcaTriggersOnly] = React.useState(false);
  const [todoTasks, setTodoTasks] = React.useState<LswTodoTask[]>([]);
  const [isLoadingTodoTasks, setIsLoadingTodoTasks] = React.useState(false);
  const [todoTasksError, setTodoTasksError] = React.useState('');
  const [showPastDueTodoTasksOnly, setShowPastDueTodoTasksOnly] = React.useState(false);
  const [meetingRails, setMeetingRails] = React.useState<LswMeetingRail[]>([]);
  const [isLoadingMeetingRails, setIsLoadingMeetingRails] = React.useState(false);
  const [meetingRailsError, setMeetingRailsError] = React.useState('');
  const [showPastDueMeetingRailsOnly, setShowPastDueMeetingRailsOnly] = React.useState(false);
  const [personalGoals, setPersonalGoals] = React.useState<LswPersonalGoal[]>([]);
  const [isLoadingPersonalGoals, setIsLoadingPersonalGoals] = React.useState(false);
  const [personalGoalsError, setPersonalGoalsError] = React.useState('');
  const [improvementProjects, setImprovementProjects] = React.useState<LswImprovementProject[]>([]);
  const [isLoadingImprovementProjects, setIsLoadingImprovementProjects] = React.useState(false);
  const [improvementProjectsError, setImprovementProjectsError] = React.useState('');
  const [scheduledTasks, setScheduledTasks] = React.useState<LswScheduledTask[]>([]);
  const [isLoadingScheduledTasks, setIsLoadingScheduledTasks] = React.useState(false);
  const [scheduledTasksError, setScheduledTasksError] = React.useState('');
  const [showPastDueScheduledTasksOnly, setShowPastDueScheduledTasksOnly] = React.useState(false);
  const [keyResults, setKeyResults] = React.useState<CompanyKeyResultsConfig>(emptyKeyResultsConfig);
  const [isLoadingKeyResults, setIsLoadingKeyResults] = React.useState(false);
  const [keyResultsError, setKeyResultsError] = React.useState('');
  const [workDaysPerWeek, setWorkDaysPerWeek] = React.useState<WorkDaysPerWeek>(5);
  const now = useNow();
  const requestIdRef = React.useRef(0);
  const dailyTasksRequestIdRef = React.useRef(0);
  const followUpsRequestIdRef = React.useRef(0);
  const rcaTriggersRequestIdRef = React.useRef(0);
  const todoTasksRequestIdRef = React.useRef(0);
  const meetingRailsRequestIdRef = React.useRef(0);
  const personalGoalsRequestIdRef = React.useRef(0);
  const improvementProjectsRequestIdRef = React.useRef(0);
  const scheduledTasksRequestIdRef = React.useRef(0);
  const keyResultsRequestIdRef = React.useRef(0);
  const dailyTaskSaveTimersRef = React.useRef<Record<string, number>>({});
  const followUpSaveTimersRef = React.useRef<Record<string, number>>({});
  const rcaTriggerSaveTimersRef = React.useRef<Record<string, number>>({});
  const todoTaskSaveTimersRef = React.useRef<Record<string, number>>({});
  const meetingRailSaveTimersRef = React.useRef<Record<string, number>>({});
  const personalGoalSaveTimersRef = React.useRef<Record<string, number>>({});
  const improvementProjectSaveTimersRef = React.useRef<Record<string, number>>({});
  const improvementProjectPendingPatchRef = React.useRef<Record<string, LswImprovementProjectPatch>>({});
  const scheduledTaskSaveTimersRef = React.useRef<Record<string, number>>({});
  const selectedWeekScopeRef = React.useRef('');

  React.useEffect(() => {
    void loadContext();
    void loadFollowUps();
    void loadRcaTriggers();
    void loadPersonalGoals();
    void loadImprovementProjects();
    void loadScheduledTasks();
    void loadKeyResults();

    return () => {
      Object.values(dailyTaskSaveTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
      Object.values(followUpSaveTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
      Object.values(rcaTriggerSaveTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
      Object.values(todoTaskSaveTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
      Object.values(meetingRailSaveTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
      Object.values(personalGoalSaveTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
      Object.values(improvementProjectSaveTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
      Object.values(scheduledTaskSaveTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
    };
  }, []);

  async function loadContext(options: { week?: number; year?: number } = {}) {
    const requestId = requestIdRef.current + 1;
    const endLoading = appLoading.beginLoading({
      detail: 'Loading week settings, schedule scope, and accountable work streams',
      message: 'Preparing leaders standard work',
      scope: 'lsw',
      title: 'Loading LSW workspace'
    });
    requestIdRef.current = requestId;
    dailyTasksRequestIdRef.current += 1;
    todoTasksRequestIdRef.current += 1;
    meetingRailsRequestIdRef.current += 1;

    setIsLoadingContext(true);
    setIsLoadingDailyTasks(true);
    setIsLoadingTodoTasks(true);
    setIsLoadingMeetingRails(true);
    setContextError('');
    setIsContextErrorModalDismissed(false);

    try {
      const nextContext = await getLswContext(options);

      if (requestIdRef.current === requestId) {
        const nextWeekOptions = {
          week: nextContext.week.selectedWeek,
          year: nextContext.week.selectedYear
        };

        selectedWeekScopeRef.current = getWeekScopeKey(nextWeekOptions);
        setLswContext(nextContext);
        setWorkDaysPerWeek(nextContext.settings.workDaysPerWeek);
        setDailyTasks((currentTasks) => currentTasks.map((task) => ({
          ...task,
          days: getEmptyTaskDays(),
          dayStatusDetails: getEmptyTaskDayStatusDetails(),
          dayStatuses: getEmptyTaskDayStatuses()
        })));
        setTodoTasks([]);
        setMeetingRails([]);
        void loadDailyTasks(nextWeekOptions);
        void loadTodoTasks(nextWeekOptions);
        void loadMeetingRails(nextWeekOptions);
      }
    } catch (error) {
      if (requestIdRef.current === requestId) {
        setContextError(getErrorMessage(error));
        setIsContextErrorModalDismissed(false);
        setIsLoadingTodoTasks(false);
        setIsLoadingMeetingRails(false);
      }
    } finally {
      endLoading();
      if (requestIdRef.current === requestId) {
        setIsLoadingContext(false);
      }
    }
  }

  function handleWeekOffset(offset: number) {
    if (!lswContext || isLoadingContext) {
      return;
    }

    void loadContext({
      week: lswContext.week.selectedWeek + offset,
      year: lswContext.week.selectedYear
    });
  }

  function handleCurrentWeek() {
    if (isLoadingContext) {
      return;
    }

    void loadContext();
  }

  async function loadDailyTasks(options: { week?: number; year?: number } = {}) {
    const requestId = dailyTasksRequestIdRef.current + 1;
    const endLoading = appLoading.beginLoading({
      detail: 'Refreshing daily and weekly standard tasks',
      message: 'Syncing LSW routines',
      scope: 'lsw',
      title: 'Loading standard work'
    });
    const weekScopeKey = getWeekScopeKey(options);

    dailyTasksRequestIdRef.current = requestId;
    setIsLoadingDailyTasks(true);
    setDailyTasksError('');

    try {
      const response = await listLswDailyTasks(options);

      if (
        dailyTasksRequestIdRef.current === requestId &&
        (!weekScopeKey || selectedWeekScopeRef.current === weekScopeKey) &&
        (!weekScopeKey || response.weekKey === weekScopeKey)
      ) {
        setDailyTasks(response.tasks);
        setWorkDaysPerWeek(response.workDaysPerWeek);
      }
    } catch (error) {
      if (dailyTasksRequestIdRef.current === requestId) {
        setDailyTasksError(getErrorMessage(error));
      }
    } finally {
      endLoading();
      if (dailyTasksRequestIdRef.current === requestId) {
        setIsLoadingDailyTasks(false);
      }
    }
  }

  async function loadFollowUps() {
    const requestId = followUpsRequestIdRef.current + 1;
    const endLoading = appLoading.beginLoading({
      detail: 'Refreshing open commitments and escalation follow-ups',
      message: 'Syncing LSW follow-ups',
      scope: 'lsw',
      title: 'Loading follow-ups'
    });

    followUpsRequestIdRef.current = requestId;
    setIsLoadingFollowUps(true);
    setFollowUpsError('');

    try {
      const response = await listLswFollowUps();

      if (followUpsRequestIdRef.current === requestId) {
        setFollowUps(response.followUps.sort(sortFollowUps));
      }
    } catch (error) {
      if (followUpsRequestIdRef.current === requestId) {
        setFollowUpsError(getErrorMessage(error));
      }
    } finally {
      endLoading();
      if (followUpsRequestIdRef.current === requestId) {
        setIsLoadingFollowUps(false);
      }
    }
  }

  async function loadRcaTriggers() {
    const requestId = rcaTriggersRequestIdRef.current + 1;
    const endLoading = appLoading.beginLoading({
      detail: 'Refreshing RCA trigger events and due dates',
      message: 'Syncing RCA triggers',
      scope: 'lsw',
      title: 'Loading RCA triggers'
    });

    rcaTriggersRequestIdRef.current = requestId;
    setIsLoadingRcaTriggers(true);
    setRcaTriggersError('');

    try {
      const response = await listLswRcaTriggers();

      if (rcaTriggersRequestIdRef.current === requestId) {
        setRcaTriggers(response.triggers.sort(sortRcaTriggers));
      }
    } catch (error) {
      if (rcaTriggersRequestIdRef.current === requestId) {
        setRcaTriggersError(getErrorMessage(error));
      }
    } finally {
      endLoading();
      if (rcaTriggersRequestIdRef.current === requestId) {
        setIsLoadingRcaTriggers(false);
      }
    }
  }

  async function loadTodoTasks(options: { week?: number; year?: number } = {}) {
    const requestId = todoTasksRequestIdRef.current + 1;
    const endLoading = appLoading.beginLoading({
      detail: 'Refreshing weekly to-do items and completion status',
      message: 'Syncing LSW action list',
      scope: 'lsw',
      title: 'Loading to-do work'
    });
    const weekScopeKey = getWeekScopeKey(options);

    todoTasksRequestIdRef.current = requestId;
    setIsLoadingTodoTasks(true);
    setTodoTasksError('');

    try {
      const response = await listLswTodoTasks(options);

      if (
        todoTasksRequestIdRef.current === requestId &&
        (!weekScopeKey || selectedWeekScopeRef.current === weekScopeKey) &&
        (!weekScopeKey || response.weekKey === weekScopeKey)
      ) {
        setTodoTasks(response.tasks);
      }
    } catch (error) {
      if (todoTasksRequestIdRef.current === requestId) {
        setTodoTasksError(getErrorMessage(error));
      }
    } finally {
      endLoading();
      if (todoTasksRequestIdRef.current === requestId) {
        setIsLoadingTodoTasks(false);
      }
    }
  }

  async function loadMeetingRails(options: { week?: number; year?: number } = {}) {
    const requestId = meetingRailsRequestIdRef.current + 1;
    const endLoading = appLoading.beginLoading({
      detail: 'Refreshing meeting rails and daily operating cadence',
      message: 'Syncing meeting rails',
      scope: 'lsw',
      title: 'Loading meeting rails'
    });
    const weekScopeKey = getWeekScopeKey(options);

    meetingRailsRequestIdRef.current = requestId;
    setIsLoadingMeetingRails(true);
    setMeetingRailsError('');

    try {
      const response = await listLswMeetingRails(options);

      if (
        meetingRailsRequestIdRef.current === requestId &&
        (!weekScopeKey || selectedWeekScopeRef.current === weekScopeKey) &&
        (!weekScopeKey || response.weekKey === weekScopeKey)
      ) {
        setMeetingRails(response.rails);
      }
    } catch (error) {
      if (meetingRailsRequestIdRef.current === requestId) {
        setMeetingRailsError(getErrorMessage(error));
      }
    } finally {
      endLoading();
      if (meetingRailsRequestIdRef.current === requestId) {
        setIsLoadingMeetingRails(false);
      }
    }
  }

  async function loadPersonalGoals() {
    const requestId = personalGoalsRequestIdRef.current + 1;
    const endLoading = appLoading.beginLoading({
      detail: 'Refreshing objectives, owners, and due dates',
      message: 'Syncing LSW objectives',
      scope: 'lsw',
      title: 'Loading objectives'
    });

    personalGoalsRequestIdRef.current = requestId;
    setIsLoadingPersonalGoals(true);
    setPersonalGoalsError('');

    try {
      const response = await listLswPersonalGoals();

      if (personalGoalsRequestIdRef.current === requestId) {
        setPersonalGoals(response.goals.sort(sortPersonalGoals));
      }
    } catch (error) {
      if (personalGoalsRequestIdRef.current === requestId) {
        setPersonalGoalsError(getErrorMessage(error));
      }
    } finally {
      endLoading();
      if (personalGoalsRequestIdRef.current === requestId) {
        setIsLoadingPersonalGoals(false);
      }
    }
  }

  async function loadImprovementProjects() {
    const requestId = improvementProjectsRequestIdRef.current + 1;
    const endLoading = appLoading.beginLoading({
      detail: 'Refreshing improvement projects and operational priorities',
      message: 'Syncing improvement projects',
      scope: 'lsw',
      title: 'Loading projects'
    });

    improvementProjectsRequestIdRef.current = requestId;
    setIsLoadingImprovementProjects(true);
    setImprovementProjectsError('');

    try {
      const response = await listLswImprovementProjects();

      if (improvementProjectsRequestIdRef.current === requestId) {
        setImprovementProjects(response.projects.sort(sortImprovementProjects));
      }
    } catch (error) {
      if (improvementProjectsRequestIdRef.current === requestId) {
        setImprovementProjectsError(getErrorMessage(error));
      }
    } finally {
      endLoading();
      if (improvementProjectsRequestIdRef.current === requestId) {
        setIsLoadingImprovementProjects(false);
      }
    }
  }

  async function loadScheduledTasks() {
    const requestId = scheduledTasksRequestIdRef.current + 1;
    const endLoading = appLoading.beginLoading({
      detail: 'Refreshing recurring tasks and scheduled checks',
      message: 'Syncing scheduled work',
      scope: 'lsw',
      title: 'Loading scheduled tasks'
    });

    scheduledTasksRequestIdRef.current = requestId;
    setIsLoadingScheduledTasks(true);
    setScheduledTasksError('');

    try {
      const response = await listLswScheduledTasks();

      if (scheduledTasksRequestIdRef.current === requestId) {
        setScheduledTasks(response.tasks.sort(sortScheduledTasks));
      }
    } catch (error) {
      if (scheduledTasksRequestIdRef.current === requestId) {
        setScheduledTasksError(getErrorMessage(error));
      }
    } finally {
      endLoading();
      if (scheduledTasksRequestIdRef.current === requestId) {
        setIsLoadingScheduledTasks(false);
      }
    }
  }

  async function loadKeyResults() {
    const requestId = keyResultsRequestIdRef.current + 1;
    const endLoading = appLoading.beginLoading({
      detail: 'Refreshing performance measures and key-result groups',
      message: 'Syncing key results',
      scope: 'lsw',
      title: 'Loading key results'
    });

    keyResultsRequestIdRef.current = requestId;
    setIsLoadingKeyResults(true);
    setKeyResultsError('');

    try {
      const response = await listLswKeyResults();

      if (keyResultsRequestIdRef.current === requestId) {
        setKeyResults(response);
      }
    } catch (error) {
      if (keyResultsRequestIdRef.current === requestId) {
        setKeyResultsError(getErrorMessage(error));
      }
    } finally {
      endLoading();
      if (keyResultsRequestIdRef.current === requestId) {
        setIsLoadingKeyResults(false);
      }
    }
  }

  async function handleWorkDaysChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextWorkDays = Number(event.target.value) as WorkDaysPerWeek;

    setWorkDaysPerWeek(nextWorkDays);
    setDailyTasksError('');

    try {
      const settings = await updateLswSettings(nextWorkDays);

      setWorkDaysPerWeek(settings.workDaysPerWeek);
    } catch (error) {
      setDailyTasksError(getErrorMessage(error));
    }
  }

  async function handleAddDailyTask() {
    setDailyTasksError('');

    try {
      const currentLocalTime = getCurrentLocalTime();
      const weekOptions = getSelectedWeekOptions();
      const weekScopeKey = getWeekScopeKey(weekOptions);
      const task = await createLswDailyTask({
        days: getEmptyTaskDays(),
        time: currentLocalTime
      }, weekOptions);

      if (weekScopeKey && (selectedWeekScopeRef.current !== weekScopeKey || task.weekKey !== weekScopeKey)) {
        return;
      }

      const taskWithEmptyWeekStatus = {
        ...task,
        days: getEmptyTaskDays(),
        dayStatusDetails: getEmptyTaskDayStatusDetails(),
        dayStatuses: getEmptyTaskDayStatuses(),
        time: currentLocalTime,
        weekKey: weekScopeKey || task.weekKey
      };

      setDailyTasks((currentTasks) => [...currentTasks, taskWithEmptyWeekStatus].sort(sortDailyTasks));
    } catch (error) {
      setDailyTasksError(getErrorMessage(error));
    }
  }

  async function handleAddFollowUp() {
    setFollowUpsError('');

    try {
      const nowDate = new Date();
      const followUp = await createLswFollowUp({
        dueDate: formatLocalDateOnly(nowDate),
        timeZone: getBrowserTimeZone()
      });

      setFollowUps((currentFollowUps) => [...currentFollowUps, followUp].sort(sortFollowUps));
    } catch (error) {
      setFollowUpsError(getErrorMessage(error));
    }
  }

  async function handleAddRcaTrigger() {
    setRcaTriggersError('');

    try {
      const nowDate = new Date();
      const trigger = await createLswRcaTrigger({
        eventDate: formatLocalDateOnly(nowDate),
        timeZone: getBrowserTimeZone()
      });

      setRcaTriggers((currentTriggers) => [...currentTriggers, trigger].sort(sortRcaTriggers));
    } catch (error) {
      setRcaTriggersError(getErrorMessage(error));
    }
  }

  async function handleAddTodoTask() {
    setTodoTasksError('');

    try {
      const nowDate = new Date();
      const weekOptions = getSelectedWeekOptions();
      const task = await createLswTodoTask({
        dueDate: formatLocalDateOnly(nowDate),
        dueTime: getCurrentLocalTime(),
        timeZone: getBrowserTimeZone()
      }, weekOptions);

      setTodoTasks((currentTasks) => [...currentTasks, task].sort(sortTodoTasks));
    } catch (error) {
      setTodoTasksError(getErrorMessage(error));
    }
  }

  async function handleAddMeetingRail() {
    setMeetingRailsError('');

    try {
      const nowDate = new Date();
      const weekOptions = getSelectedWeekOptions();
      const rail = await createLswMeetingRail({
        dueDate: formatLocalDateOnly(nowDate),
        dueTime: getCurrentLocalTime(),
        timeZone: getBrowserTimeZone()
      }, weekOptions);

      setMeetingRails((currentRails) => [...currentRails, rail].sort(sortMeetingRails));
    } catch (error) {
      setMeetingRailsError(getErrorMessage(error));
    }
  }

  async function handleAddPersonalGoal() {
    setPersonalGoalsError('');

    try {
      const nowDate = new Date();
      const goal = await createLswPersonalGoal({
        dueDate: formatLocalDateOnly(nowDate),
        progress: 0,
        timeZone: getBrowserTimeZone()
      });

      setPersonalGoals((currentGoals) => [...currentGoals, goal].sort(sortPersonalGoals));
    } catch (error) {
      setPersonalGoalsError(getErrorMessage(error));
    }
  }

  async function handleAddImprovementProject() {
    setImprovementProjectsError('');

    try {
      const project = await createLswImprovementProject({
        updates: [createBlankProjectUpdate(1000)]
      });

      setImprovementProjects((currentProjects) => [...currentProjects, project].sort(sortImprovementProjects));
    } catch (error) {
      setImprovementProjectsError(getErrorMessage(error));
    }
  }

  async function handleAddScheduledTask(frequency: LswScheduledTaskFrequency) {
    setScheduledTasksError('');

    try {
      const nowDate = new Date();
      const task = await createLswScheduledTask({
        dueDate: formatLocalDateOnly(nowDate),
        frequency,
        minutes: 60,
        timeZone: getBrowserTimeZone()
      });

      setScheduledTasks((currentTasks) => [...currentTasks, task].sort(sortScheduledTasks));
    } catch (error) {
      setScheduledTasksError(getErrorMessage(error));
    }
  }

  async function handleDeleteDailyTask(taskId: string) {
    const previousTasks = dailyTasks;

    window.clearTimeout(dailyTaskSaveTimersRef.current[taskId]);
    delete dailyTaskSaveTimersRef.current[taskId];
    setDailyTasks((currentTasks) => currentTasks.filter((task) => task.taskId !== taskId));
    setDailyTasksError('');

    try {
      await deleteLswDailyTask(taskId);
    } catch (error) {
      setDailyTasks(previousTasks);
      setDailyTasksError(getErrorMessage(error));
    }
  }

  async function handleDeleteFollowUp(followUpId: string) {
    const previousFollowUps = followUps;

    window.clearTimeout(followUpSaveTimersRef.current[followUpId]);
    delete followUpSaveTimersRef.current[followUpId];
    setFollowUps((currentFollowUps) => currentFollowUps.filter((followUp) => followUp.followUpId !== followUpId));
    setFollowUpsError('');

    try {
      await deleteLswFollowUp(followUpId);
    } catch (error) {
      setFollowUps(previousFollowUps);
      setFollowUpsError(getErrorMessage(error));
    }
  }

  async function handleDeleteRcaTrigger(triggerId: string) {
    const previousTriggers = rcaTriggers;

    window.clearTimeout(rcaTriggerSaveTimersRef.current[triggerId]);
    delete rcaTriggerSaveTimersRef.current[triggerId];
    setRcaTriggers((currentTriggers) => currentTriggers.filter((trigger) => trigger.triggerId !== triggerId));
    setRcaTriggersError('');

    try {
      await deleteLswRcaTrigger(triggerId);
    } catch (error) {
      setRcaTriggers(previousTriggers);
      setRcaTriggersError(getErrorMessage(error));
    }
  }

  async function handleDeleteTodoTask(taskId: string) {
    const previousTasks = todoTasks;

    window.clearTimeout(todoTaskSaveTimersRef.current[taskId]);
    delete todoTaskSaveTimersRef.current[taskId];
    setTodoTasks((currentTasks) => currentTasks.filter((task) => task.taskId !== taskId));
    setTodoTasksError('');

    try {
      await deleteLswTodoTask(taskId);
    } catch (error) {
      setTodoTasks(previousTasks);
      setTodoTasksError(getErrorMessage(error));
    }
  }

  async function handleDeleteMeetingRail(railId: string) {
    const previousRails = meetingRails;

    window.clearTimeout(meetingRailSaveTimersRef.current[railId]);
    delete meetingRailSaveTimersRef.current[railId];
    setMeetingRails((currentRails) => currentRails.filter((rail) => rail.railId !== railId));
    setMeetingRailsError('');

    try {
      await deleteLswMeetingRail(railId);
    } catch (error) {
      setMeetingRails(previousRails);
      setMeetingRailsError(getErrorMessage(error));
    }
  }

  async function handleDeletePersonalGoal(goalId: string) {
    const previousGoals = personalGoals;

    window.clearTimeout(personalGoalSaveTimersRef.current[goalId]);
    delete personalGoalSaveTimersRef.current[goalId];
    setPersonalGoals((currentGoals) => currentGoals.filter((goal) => goal.goalId !== goalId));
    setPersonalGoalsError('');

    try {
      await deleteLswPersonalGoal(goalId);
    } catch (error) {
      setPersonalGoals(previousGoals);
      setPersonalGoalsError(getErrorMessage(error));
    }
  }

  async function handleDeleteImprovementProject(projectId: string) {
    const previousProjects = improvementProjects;

    window.clearTimeout(improvementProjectSaveTimersRef.current[projectId]);
    delete improvementProjectSaveTimersRef.current[projectId];
    delete improvementProjectPendingPatchRef.current[projectId];
    setImprovementProjects((currentProjects) => currentProjects.filter((project) => project.projectId !== projectId));
    setImprovementProjectsError('');

    try {
      await deleteLswImprovementProject(projectId);
    } catch (error) {
      setImprovementProjects(previousProjects);
      setImprovementProjectsError(getErrorMessage(error));
    }
  }

  async function handleDeleteScheduledTask(taskId: string) {
    const previousTasks = scheduledTasks;

    window.clearTimeout(scheduledTaskSaveTimersRef.current[taskId]);
    delete scheduledTaskSaveTimersRef.current[taskId];
    setScheduledTasks((currentTasks) => currentTasks.filter((task) => task.taskId !== taskId));
    setScheduledTasksError('');

    try {
      await deleteLswScheduledTask(taskId);
    } catch (error) {
      setScheduledTasks(previousTasks);
      setScheduledTasksError(getErrorMessage(error));
    }
  }

  async function handleReorderDailyTasks(activeTaskId: string, overTaskId: string) {
    const previousTasks = dailyTasks;
    const oldIndex = dailyTasks.findIndex((task) => task.taskId === activeTaskId);
    const newIndex = dailyTasks.findIndex((task) => task.taskId === overTaskId);

    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
      return;
    }

    const reorderedTasks = arrayMove(dailyTasks, oldIndex, newIndex).map((task, index) => ({
      ...task,
      sortOrder: (index + 1) * 1000
    }));
    const changedTasks = reorderedTasks.filter((task) => (
      previousTasks.find((previousTask) => previousTask.taskId === task.taskId)?.sortOrder !== task.sortOrder
    ));

    setDailyTasks(reorderedTasks);
    setDailyTasksError('');

    try {
      await Promise.all(changedTasks.map((task) => (
        updateLswDailyTask(task.taskId, { sortOrder: task.sortOrder })
      )));
    } catch (error) {
      setDailyTasks(previousTasks);
      setDailyTasksError(getErrorMessage(error));
    }
  }

  function handleDailyTaskChange(
    taskId: string,
    patch: LswDailyTaskPatch,
    options: { immediate?: boolean; skipSave?: boolean } = {}
  ) {
    setDailyTasks((currentTasks) => currentTasks.map((task) => (
      task.taskId === taskId ? applyDailyTaskPatch(task, patch) : task
    )));

    if (options.skipSave) {
      return;
    }

    queueDailyTaskSave(
      taskId,
      patch,
      options.immediate,
      patch.days || patch.dayStatusUpdates ? getSelectedWeekOptions() : undefined
    );
  }

  function handleFollowUpChange(
    followUpId: string,
    patch: LswFollowUpPatch,
    options: { immediate?: boolean; skipSave?: boolean } = {}
  ) {
    setFollowUps((currentFollowUps) => currentFollowUps.map((followUp) => (
      followUp.followUpId === followUpId ? applyFollowUpPatch(followUp, patch) : followUp
    )));

    if (options.skipSave) {
      return;
    }

    queueFollowUpSave(followUpId, patch, options.immediate);
  }

  function handleRcaTriggerChange(
    triggerId: string,
    patch: LswRcaTriggerPatch,
    options: { immediate?: boolean; skipSave?: boolean } = {}
  ) {
    setRcaTriggers((currentTriggers) => currentTriggers.map((trigger) => (
      trigger.triggerId === triggerId ? applyRcaTriggerPatch(trigger, patch) : trigger
    )));

    if (options.skipSave) {
      return;
    }

    queueRcaTriggerSave(triggerId, patch, options.immediate);
  }

  function handleTodoTaskChange(
    taskId: string,
    patch: LswTodoTaskPatch,
    options: { immediate?: boolean; skipSave?: boolean } = {}
  ) {
    setTodoTasks((currentTasks) => currentTasks.map((task) => (
      task.taskId === taskId ? applyTodoTaskPatch(task, patch) : task
    )));

    if (options.skipSave) {
      return;
    }

    queueTodoTaskSave(taskId, patch, options.immediate);
  }

  function handleMeetingRailChange(
    railId: string,
    patch: LswMeetingRailPatch,
    options: { immediate?: boolean; skipSave?: boolean } = {}
  ) {
    setMeetingRails((currentRails) => currentRails.map((rail) => (
      rail.railId === railId ? applyMeetingRailPatch(rail, patch) : rail
    )));

    if (options.skipSave) {
      return;
    }

    queueMeetingRailSave(railId, patch, options.immediate);
  }

  function handlePersonalGoalChange(
    goalId: string,
    patch: LswPersonalGoalPatch,
    options: { immediate?: boolean; skipSave?: boolean } = {}
  ) {
    setPersonalGoals((currentGoals) => currentGoals.map((goal) => (
      goal.goalId === goalId ? applyPersonalGoalPatch(goal, patch) : goal
    )));

    if (options.skipSave) {
      return;
    }

    queuePersonalGoalSave(goalId, patch, options.immediate);
  }

  function handleImprovementProjectChange(
    projectId: string,
    patch: LswImprovementProjectPatch,
    options: { immediate?: boolean; skipSave?: boolean } = {}
  ) {
    setImprovementProjects((currentProjects) => currentProjects.map((project) => (
      project.projectId === projectId ? applyImprovementProjectPatch(project, patch) : project
    )).sort(sortImprovementProjects));

    if (options.skipSave) {
      return;
    }

    queueImprovementProjectSave(projectId, patch, options.immediate);
  }

  function handleAddProjectUpdate(projectId: string, afterUpdateId?: string) {
    const project = improvementProjects.find((currentProject) => currentProject.projectId === projectId);

    if (!project) {
      return;
    }

    const nextUpdates = insertImprovementProjectUpdate(project.updates, afterUpdateId);

    handleImprovementProjectChange(projectId, { updates: nextUpdates }, { immediate: true });
  }

  function handleDeleteProjectUpdate(projectId: string, updateId: string) {
    const project = improvementProjects.find((currentProject) => currentProject.projectId === projectId);

    if (!project) {
      return;
    }

    const nextUpdates = rebalanceProjectUpdates(
      normalizeProjectUpdates(project.updates).filter((update) => update.updateId !== updateId)
    );

    handleImprovementProjectChange(projectId, { updates: nextUpdates }, { immediate: true });
  }

  function handleProjectUpdateTextChange(projectId: string, updateId: string, text: string) {
    const project = improvementProjects.find((currentProject) => currentProject.projectId === projectId);

    if (!project) {
      return;
    }

    const nextUpdates = normalizeProjectUpdates(project.updates).map((update) => (
      update.updateId === updateId ? { ...update, text } : update
    ));

    handleImprovementProjectChange(projectId, { updates: nextUpdates });
  }

  function handleScheduledTaskChange(
    taskId: string,
    patch: LswScheduledTaskPatch,
    options: { immediate?: boolean; skipSave?: boolean } = {}
  ) {
    setScheduledTasks((currentTasks) => currentTasks.map((task) => (
      task.taskId === taskId ? applyScheduledTaskPatch(task, patch) : task
    )).sort(sortScheduledTasks));

    if (options.skipSave) {
      return;
    }

    queueScheduledTaskSave(taskId, patch, options.immediate);
  }

  function queueDailyTaskSave(
    taskId: string,
    patch: LswDailyTaskPatch,
    immediate = false,
    weekOptions?: { week?: number; year?: number }
  ) {
    const saveWeekScopeKey = weekOptions ? getWeekScopeKey(weekOptions) : '';

    const save = async () => {
      try {
        const savedTask = await updateLswDailyTask(taskId, patch, weekOptions);
        const savedPatch = getSavedPatch(savedTask, patch);
        const isWeekScopedSave = Boolean(patch.days || patch.dayStatusUpdates);

        if (isWeekScopedSave && saveWeekScopeKey && selectedWeekScopeRef.current !== saveWeekScopeKey) {
          return;
        }

        if (isWeekScopedSave && saveWeekScopeKey && savedTask.weekKey !== saveWeekScopeKey) {
          return;
        }

        setDailyTasks((currentTasks) => currentTasks.map((task) => (
          task.taskId === taskId ? applyDailyTaskPatch(task, savedPatch) : task
        )));
        setDailyTasksError('');
      } catch (error) {
        setDailyTasksError(getErrorMessage(error));
      }
    };

    window.clearTimeout(dailyTaskSaveTimersRef.current[taskId]);

    if (immediate) {
      void save();
      return;
    }

    dailyTaskSaveTimersRef.current[taskId] = window.setTimeout(() => {
      delete dailyTaskSaveTimersRef.current[taskId];
      void save();
    }, 700);
  }

  function queueFollowUpSave(followUpId: string, patch: LswFollowUpPatch, immediate = false) {
    const save = async () => {
      try {
        const savedFollowUp = await updateLswFollowUp(followUpId, patch);

        setFollowUps((currentFollowUps) => currentFollowUps.map((followUp) => (
          followUp.followUpId === followUpId ? savedFollowUp : followUp
        )).sort(sortFollowUps));
        setFollowUpsError('');
      } catch (error) {
        setFollowUpsError(getErrorMessage(error));
      }
    };

    window.clearTimeout(followUpSaveTimersRef.current[followUpId]);

    if (immediate) {
      void save();
      return;
    }

    followUpSaveTimersRef.current[followUpId] = window.setTimeout(() => {
      delete followUpSaveTimersRef.current[followUpId];
      void save();
    }, 700);
  }

  function queueRcaTriggerSave(triggerId: string, patch: LswRcaTriggerPatch, immediate = false) {
    const save = async () => {
      try {
        const savedTrigger = await updateLswRcaTrigger(triggerId, patch);

        setRcaTriggers((currentTriggers) => currentTriggers.map((trigger) => (
          trigger.triggerId === triggerId ? savedTrigger : trigger
        )).sort(sortRcaTriggers));
        setRcaTriggersError('');
      } catch (error) {
        setRcaTriggersError(getErrorMessage(error));
      }
    };

    window.clearTimeout(rcaTriggerSaveTimersRef.current[triggerId]);

    if (immediate) {
      void save();
      return;
    }

    rcaTriggerSaveTimersRef.current[triggerId] = window.setTimeout(() => {
      delete rcaTriggerSaveTimersRef.current[triggerId];
      void save();
    }, 700);
  }

  function queueTodoTaskSave(taskId: string, patch: LswTodoTaskPatch, immediate = false) {
    const save = async () => {
      try {
        const savedTask = await updateLswTodoTask(taskId, patch);

        setTodoTasks((currentTasks) => currentTasks.map((task) => (
          task.taskId === taskId ? savedTask : task
        )));
        setTodoTasksError('');
      } catch (error) {
        setTodoTasksError(getErrorMessage(error));
      }
    };

    window.clearTimeout(todoTaskSaveTimersRef.current[taskId]);

    if (immediate) {
      void save();
      return;
    }

    todoTaskSaveTimersRef.current[taskId] = window.setTimeout(() => {
      delete todoTaskSaveTimersRef.current[taskId];
      void save();
    }, 700);
  }

  function queueMeetingRailSave(railId: string, patch: LswMeetingRailPatch, immediate = false) {
    const save = async () => {
      try {
        const savedRail = await updateLswMeetingRail(railId, patch);

        setMeetingRails((currentRails) => currentRails.map((rail) => (
          rail.railId === railId ? savedRail : rail
        )));
        setMeetingRailsError('');
      } catch (error) {
        setMeetingRailsError(getErrorMessage(error));
      }
    };

    window.clearTimeout(meetingRailSaveTimersRef.current[railId]);

    if (immediate) {
      void save();
      return;
    }

    meetingRailSaveTimersRef.current[railId] = window.setTimeout(() => {
      delete meetingRailSaveTimersRef.current[railId];
      void save();
    }, 700);
  }

  function queuePersonalGoalSave(goalId: string, patch: LswPersonalGoalPatch, immediate = false) {
    const save = async () => {
      try {
        const savedGoal = await updateLswPersonalGoal(goalId, patch);

        setPersonalGoals((currentGoals) => currentGoals.map((goal) => (
          goal.goalId === goalId ? savedGoal : goal
        )).sort(sortPersonalGoals));
        setPersonalGoalsError('');
      } catch (error) {
        setPersonalGoalsError(getErrorMessage(error));
      }
    };

    window.clearTimeout(personalGoalSaveTimersRef.current[goalId]);

    if (immediate) {
      void save();
      return;
    }

    personalGoalSaveTimersRef.current[goalId] = window.setTimeout(() => {
      delete personalGoalSaveTimersRef.current[goalId];
      void save();
    }, 700);
  }

  function queueImprovementProjectSave(projectId: string, patch: LswImprovementProjectPatch, immediate = false) {
    improvementProjectPendingPatchRef.current[projectId] = {
      ...improvementProjectPendingPatchRef.current[projectId],
      ...patch
    };

    const save = async () => {
      const pendingPatch = improvementProjectPendingPatchRef.current[projectId] || patch;

      delete improvementProjectPendingPatchRef.current[projectId];

      try {
        const savedProject = await updateLswImprovementProject(projectId, pendingPatch);
        const unappliedPatch = improvementProjectPendingPatchRef.current[projectId];
        const nextProject = unappliedPatch
          ? applyImprovementProjectPatch(savedProject, unappliedPatch)
          : savedProject;

        setImprovementProjects((currentProjects) => currentProjects.map((project) => (
          project.projectId === projectId ? nextProject : project
        )).sort(sortImprovementProjects));
        setImprovementProjectsError('');
      } catch (error) {
        improvementProjectPendingPatchRef.current[projectId] = {
          ...pendingPatch,
          ...improvementProjectPendingPatchRef.current[projectId]
        };
        setImprovementProjectsError(getErrorMessage(error));
      }
    };

    window.clearTimeout(improvementProjectSaveTimersRef.current[projectId]);

    if (immediate) {
      void save();
      return;
    }

    improvementProjectSaveTimersRef.current[projectId] = window.setTimeout(() => {
      delete improvementProjectSaveTimersRef.current[projectId];
      void save();
    }, 700);
  }

  function queueScheduledTaskSave(taskId: string, patch: LswScheduledTaskPatch, immediate = false) {
    const save = async () => {
      try {
        const savedTask = await updateLswScheduledTask(taskId, patch);

        setScheduledTasks((currentTasks) => currentTasks.map((task) => (
          task.taskId === taskId ? savedTask : task
        )).sort(sortScheduledTasks));
        setScheduledTasksError('');
      } catch (error) {
        setScheduledTasksError(getErrorMessage(error));
      }
    };

    window.clearTimeout(scheduledTaskSaveTimersRef.current[taskId]);

    if (immediate) {
      void save();
      return;
    }

    scheduledTaskSaveTimersRef.current[taskId] = window.setTimeout(() => {
      delete scheduledTaskSaveTimersRef.current[taskId];
      void save();
    }, 700);
  }

  function getSelectedWeekOptions(): { week?: number; year?: number } {
    if (!lswContext) {
      return {};
    }

    return {
      week: lswContext.week.selectedWeek,
      year: lswContext.week.selectedYear
    };
  }

  function getWeekScopeKey(options: { week?: number; year?: number }): string {
    return typeof options.week === 'number' && typeof options.year === 'number'
      ? `${options.year}-W${String(options.week).padStart(2, '0')}`
      : '';
  }

  const hasBlockingContextError = Boolean(contextError && !lswContext);
  const shouldShowContextErrorModal = Boolean(contextError && !isContextErrorModalDismissed);
  const departmentId = lswContext?.department.departmentId || 'unassigned';
  const departmentName = lswContext?.department.name || (hasBlockingContextError ? 'Unavailable' : 'Loading department');
  const selectedWeek = lswContext?.week.selectedWeek;
  const weekNumberLabel = selectedWeek
    ? `Week ${selectedWeek}`
    : hasBlockingContextError
      ? 'Week unavailable'
      : 'Week --';
  const pendingDateLabel = hasBlockingContextError ? 'Unavailable' : 'Loading';
  const visibleDays = allDays.slice(0, workDaysPerWeek);
  const todayDayKey = lswContext?.week.isCurrentWeek
    ? getDayKeyFromIso(lswContext.week.todayIso)
    : null;
  const visibleRcaTriggers = showPastDueRcaTriggersOnly
    ? rcaTriggers.filter(isRcaTriggerPastDue)
    : rcaTriggers;
  const pastDueTodoTaskCount = todoTasks.filter(isTodoPastDue).length;
  const visibleTodoTasks = showPastDueTodoTasksOnly
    ? todoTasks.filter(isTodoPastDue)
    : todoTasks;
  const pastDueMeetingRailCount = meetingRails.filter(isMeetingRailPastDue).length;
  const visibleMeetingRails = showPastDueMeetingRailsOnly
    ? meetingRails.filter(isMeetingRailPastDue)
    : meetingRails;
  const pastDueScheduledTaskCount = scheduledTasks.filter(isScheduledTaskPastDue).length;
  const visibleScheduledTasks = showPastDueScheduledTasksOnly
    ? scheduledTasks.filter(isScheduledTaskPastDue)
    : scheduledTasks;

  return (
    <div className="lsw-prototype" aria-busy={isLoadingContext} aria-label="Leaders Standard Work board preview">
      <header className="lsw-toolbar">
        <div className="lsw-toolbar-inner">
          <div className="lsw-toolbar-left">
            <label className="lsw-select-group">
              <span>Department:</span>
              <select aria-label="Department" disabled value={departmentId}>
                <option value={departmentId}>{departmentName}</option>
              </select>
            </label>

            <button className="lsw-icon-button lsw-print-button" type="button" title="Print Report" aria-label="Print Report">
              <PrinterIcon />
            </button>

          </div>

          <div className="lsw-week-controls">
            <div className="lsw-week-stepper" aria-label="Week selector">
              <button
                aria-label="Previous week"
                disabled={!lswContext || isLoadingContext}
                onClick={() => handleWeekOffset(-1)}
                type="button"
              >
                <ChevronLeftIcon />
              </button>
              <button className="lsw-week-number" disabled={!lswContext || isLoadingContext} type="button">
                {weekNumberLabel}
              </button>
              <button
                aria-label="Next week"
                disabled={!lswContext || isLoadingContext}
                onClick={() => handleWeekOffset(1)}
                type="button"
              >
                <ChevronRightIcon />
              </button>
            </div>

            <DateRangeLabel label="Week Beginning" value={lswContext?.week.weekBeginningLabel || pendingDateLabel} />
            <span className="lsw-range-dash">-</span>
            <DateRangeLabel label="Week Ending" value={lswContext?.week.weekEndingLabel || pendingDateLabel} />
            {hasBlockingContextError ? (
              <button className="lsw-current-badge" disabled={isLoadingContext} onClick={() => void loadContext()} type="button">
                Retry
              </button>
            ) : lswContext?.week.isCurrentWeek ? (
              <span className="lsw-current-badge">Current week</span>
            ) : (
              <button className="lsw-current-badge" disabled={isLoadingContext} onClick={handleCurrentWeek} type="button">
                Current week
              </button>
            )}
            {isLoadingContext && lswContext ? <span className="lsw-syncing-label">Syncing...</span> : null}
            {hasBlockingContextError ? <span className="lsw-syncing-label is-error">Context not loaded</span> : null}
          </div>
        </div>
      </header>

      <main className="lsw-main">
        <div className="lsw-board-grid">
          <div className="lsw-left-column">
            <SectionPanel
              accent="emerald"
              action={
                <HeaderActions>
                  <label className="lsw-workdays">
                    <span>Days/week:</span>
                    <select
                      aria-label="Work days per week"
                      onChange={(event) => void handleWorkDaysChange(event)}
                      value={workDaysPerWeek}
                    >
                      <option value={5}>5 (Mon-Fri)</option>
                      <option value={6}>6 (Mon-Sat)</option>
                      <option value={7}>7 (All days)</option>
                    </select>
                  </label>
                  <HeaderAddButton
                    disabled={isLoadingDailyTasks}
                    label="Add Task"
                    onClick={() => void handleAddDailyTask()}
                    tone="emerald"
                  />
                </HeaderActions>
              }
              icon="📅"
              title="Daily & Weekly Standard Tasks/Meetings"
            >
              <DailyTasksTable
                errorMessage={dailyTasksError}
                isLoading={isLoadingDailyTasks}
                onDeleteTask={(taskId) => void handleDeleteDailyTask(taskId)}
                onReorderTasks={(activeTaskId, overTaskId) => void handleReorderDailyTasks(activeTaskId, overTaskId)}
                onTaskChange={handleDailyTaskChange}
                selectedWeekBeginning={lswContext?.week.weekBeginning}
                tasks={dailyTasks}
                todayDayKey={todayDayKey}
                visibleDays={visibleDays}
              />
            </SectionPanel>

            <BlackDivider />

            <SectionPanel
              accent="blue"
              action={
                <HeaderAddButton
                  disabled={isLoadingImprovementProjects}
                  label="Add Project"
                  onClick={() => void handleAddImprovementProject()}
                  tone="blue"
                />
              }
              icon="🚀"
              title="Improvement Projects and Updates"
            >
              <ProjectsTable
                errorMessage={improvementProjectsError}
                isLoading={isLoadingImprovementProjects}
                onAddProjectUpdate={handleAddProjectUpdate}
                onDeleteProject={(projectId) => void handleDeleteImprovementProject(projectId)}
                onDeleteProjectUpdate={handleDeleteProjectUpdate}
                onProjectChange={handleImprovementProjectChange}
                onProjectUpdateChange={handleProjectUpdateTextChange}
                projects={improvementProjects}
              />
            </SectionPanel>

            <BlackDivider />

            <SectionPanel
              accent="amber"
              action={
                <HeaderActions>
                  <PastDueToggle count={followUps.filter(isFollowUpPastDue).length} />
                  <HeaderAddButton
                    disabled={isLoadingFollowUps}
                    label="Add Follow Up"
                    onClick={() => void handleAddFollowUp()}
                    tone="amber"
                  />
                </HeaderActions>
              }
              icon="📌"
              title="Follow Ups"
            >
              <FollowUpsTable
                errorMessage={followUpsError}
                followUps={followUps}
                isLoading={isLoadingFollowUps}
                onDeleteFollowUp={(followUpId) => void handleDeleteFollowUp(followUpId)}
                onFollowUpChange={handleFollowUpChange}
              />
            </SectionPanel>

            <BlackDivider />

            <SectionPanel
              accent="red"
              action={
                <HeaderActions>
                  <PastDueCheckbox
                    checked={showPastDueRcaTriggersOnly}
                    onChange={setShowPastDueRcaTriggersOnly}
                  />
                  <HeaderAddButton
                    disabled={isLoadingRcaTriggers}
                    label="Add Trigger"
                    onClick={() => void handleAddRcaTrigger()}
                    tone="red"
                  />
                </HeaderActions>
              }
              icon="⚠️"
              title="Plant Specific Cause RCA Triggers"
            >
              <TriggersTable
                emptyMessage={showPastDueRcaTriggersOnly ? 'No past due triggers.' : 'No RCA triggers yet.'}
                errorMessage={rcaTriggersError}
                isLoading={isLoadingRcaTriggers}
                onDeleteTrigger={(triggerId) => void handleDeleteRcaTrigger(triggerId)}
                onTriggerChange={handleRcaTriggerChange}
                triggers={visibleRcaTriggers}
              />
            </SectionPanel>

            <BlackDivider />

            <SectionPanel
              accent="violet"
              action={
                <PastDueCheckbox
                  checked={showPastDueScheduledTasksOnly}
                  count={pastDueScheduledTaskCount}
                  onChange={setShowPastDueScheduledTasksOnly}
                />
              }
              icon="📆"
              title="Scheduled Tasks/Meetings"
            >
              <FrequencyTasks
                errorMessage={scheduledTasksError}
                isLoading={isLoadingScheduledTasks}
                onAddTask={(frequency) => void handleAddScheduledTask(frequency)}
                onDeleteTask={(taskId) => void handleDeleteScheduledTask(taskId)}
                onTaskChange={handleScheduledTaskChange}
                tasks={visibleScheduledTasks}
              />
            </SectionPanel>
          </div>

          <aside className="lsw-right-column">
            <div className="lsw-glass-stage">
              <SectionPanel
                accent="cyan"
                action={
                  <HeaderActions>
                    <div className="lsw-clock">
                      <span>{formatClockDate(now)}</span>
                      <strong>{formatClockTime(now)}</strong>
                    </div>
                    <PastDueCheckbox
                      checked={showPastDueTodoTasksOnly}
                      count={pastDueTodoTaskCount}
                      onChange={setShowPastDueTodoTasksOnly}
                    />
                    <HeaderAddButton
                      disabled={isLoadingTodoTasks}
                      label="Add Item"
                      onClick={() => void handleAddTodoTask()}
                      tone="blue"
                    />
                  </HeaderActions>
                }
                icon="✅"
                title="To Do Today & This Week"
                variant="glass"
              >
                <TodoList
                  emptyMessage={showPastDueTodoTasksOnly ? 'No past due to-do items.' : 'No to-do items yet.'}
                  errorMessage={todoTasksError}
                  isLoading={isLoadingTodoTasks}
                  onDeleteTask={(taskId) => void handleDeleteTodoTask(taskId)}
                  onTaskChange={handleTodoTaskChange}
                  tasks={visibleTodoTasks}
                />
              </SectionPanel>
            </div>

            <BlackDivider />

            <SectionPanel
              accent="purple"
              action={
                <HeaderActions>
                  <PastDueCheckbox
                    checked={showPastDueMeetingRailsOnly}
                    count={pastDueMeetingRailCount}
                    onChange={setShowPastDueMeetingRailsOnly}
                  />
                  <HeaderAddButton
                    disabled={isLoadingMeetingRails}
                    label="Add Meeting Rail"
                    onClick={() => void handleAddMeetingRail()}
                    tone="purple"
                  />
                </HeaderActions>
              }
              icon="🚂"
              title="Level 1, 2 & 3 Meeting Rails"
            >
              <RailsList
                emptyMessage={showPastDueMeetingRailsOnly ? 'No past due meeting rails.' : 'No meeting rails yet.'}
                errorMessage={meetingRailsError}
                isLoading={isLoadingMeetingRails}
                onDeleteRail={(railId) => void handleDeleteMeetingRail(railId)}
                onRailChange={handleMeetingRailChange}
                rails={visibleMeetingRails}
              />
            </SectionPanel>

            <BlackDivider />

            <SectionPanel accent="teal" icon="📊" title="Key Results Metrics">
              <KeyResults
                config={keyResults}
                errorMessage={keyResultsError}
                isLoading={isLoadingKeyResults}
              />
            </SectionPanel>

            <BlackDivider />

            <SectionPanel
              accent="pink"
              action={
                <HeaderActions>
                  <PastDueToggle count={personalGoals.filter(isPersonalGoalPastDue).length} />
                  <HeaderAddButton
                    disabled={isLoadingPersonalGoals}
                    label="Add Objective"
                    onClick={() => void handleAddPersonalGoal()}
                    tone="pink"
                  />
                </HeaderActions>
              }
              icon="🎯"
              title="Personal Objectives/Goals"
            >
              <GoalsList
                errorMessage={personalGoalsError}
                goals={personalGoals}
                isLoading={isLoadingPersonalGoals}
                onDeleteGoal={(goalId) => void handleDeletePersonalGoal(goalId)}
                onGoalChange={handlePersonalGoalChange}
              />
            </SectionPanel>
          </aside>
        </div>
      </main>
      {shouldShowContextErrorModal ? createPortal((
        <div
          aria-labelledby="lsw-error-modal-title"
          aria-modal="true"
          className="app-error-modal"
          onClick={() => setIsContextErrorModalDismissed(true)}
          role="dialog"
        >
          <div className="app-error-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="app-error-modal-icon">
              <AlertTriangleIcon />
            </div>
            <div>
              <span>Error</span>
              <h2 id="lsw-error-modal-title">LSW workspace needs attention</h2>
              <p>{contextError}</p>
            </div>
            <footer>
              <button onClick={() => setIsContextErrorModalDismissed(true)} type="button">
                Close
              </button>
              <button disabled={isLoadingContext} onClick={() => void loadContext()} type="button">
                Retry
              </button>
            </footer>
          </div>
        </div>
      ), document.body) : null}
    </div>
  );
}

function SectionPanel({
  accent,
  action,
  children,
  variant,
  title
}: {
  accent: 'amber' | 'blue' | 'cyan' | 'emerald' | 'pink' | 'purple' | 'red' | 'teal' | 'violet';
  action?: React.ReactNode;
  children: React.ReactNode;
  icon?: string;
  title: string;
  variant?: 'glass' | 'solid';
}) {
  const panelClassName = variant === 'solid' ? 'lsw-panel' : 'lsw-panel lsw-panel-glass';

  return (
    <section className={panelClassName}>
      <div className={`lsw-panel-header lsw-panel-header-${accent}`}>
        <h2>{title}</h2>
        {action ? <div className="lsw-panel-action">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function HeaderActions({ children }: { children: React.ReactNode }) {
  return <div className="lsw-header-actions">{children}</div>;
}

function HeaderAddButton({
  disabled = false,
  label,
  onClick,
  tone
}: {
  disabled?: boolean;
  label: string;
  onClick?: () => void;
  tone: string;
}) {
  return (
    <button
      className={`lsw-header-add-button lsw-add-row-${tone}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <PlusMiniIcon />
      {label}
    </button>
  );
}

function RowDeleteMenu({
  ariaLabel,
  label = 'Delete row',
  onDelete,
  triggerClassName = 'lsw-row-menu-trigger'
}: {
  ariaLabel: string;
  label?: string;
  onDelete: () => void;
  triggerClassName?: string;
}) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <button aria-label={ariaLabel} className={triggerClassName} type="button">
          <DragHandle />
        </button>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="lsw-row-action-menu" collisionPadding={12}>
          <ContextMenu.Item
            className="lsw-row-action-menu-item is-danger"
            onSelect={onDelete}
          >
            <XIcon />
            <span>{label}</span>
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

function DateRangeLabel({ label, value }: { label: string; value: string }) {
  return (
    <div className="lsw-date-label">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DailyTasksTable({
  errorMessage,
  isLoading,
  onDeleteTask,
  onReorderTasks,
  onTaskChange,
  selectedWeekBeginning,
  tasks,
  todayDayKey,
  visibleDays
}: {
  errorMessage: string;
  isLoading: boolean;
  onDeleteTask: (taskId: string) => void;
  onReorderTasks: (activeTaskId: string, overTaskId: string) => void;
  onTaskChange: (taskId: string, patch: LswDailyTaskPatch, options?: { immediate?: boolean; skipSave?: boolean }) => void;
  selectedWeekBeginning?: string;
  tasks: LswDailyTask[];
  todayDayKey: DayKey | null;
  visibleDays: Array<{ key: DayKey; label: string }>;
}) {
  const columnCount = visibleDays.length + 4;
  const [activeTaskId, setActiveTaskId] = React.useState<string | null>(null);
  const [dropIndicatorTop, setDropIndicatorTop] = React.useState<number | null>(null);
  const [droppedTaskId, setDroppedTaskId] = React.useState<string | null>(null);
  const tableScrollRef = React.useRef<HTMLDivElement | null>(null);
  const rowElementsRef = React.useRef<Record<string, HTMLTableRowElement | null>>({});
  const taskIds = React.useMemo(() => tasks.map((task) => task.taskId), [tasks]);
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 6
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 130,
        tolerance: 6
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  function setRowElement(taskId: string, rowElement: HTMLTableRowElement | null) {
    rowElementsRef.current[taskId] = rowElement;
  }

  function updateDropIndicator(nextOverTaskId: string | null, placement: 'after' | 'before' | null) {
    const containerElement = tableScrollRef.current;
    const overRowElement = nextOverTaskId ? rowElementsRef.current[nextOverTaskId] : null;

    if (!containerElement || !overRowElement || !placement) {
      setDropIndicatorTop(null);
      return;
    }

    const containerRect = containerElement.getBoundingClientRect();
    const rowRect = overRowElement.getBoundingClientRect();
    const nextTop = (placement === 'after' ? rowRect.bottom : rowRect.top) - containerRect.top + containerElement.scrollTop;

    setDropIndicatorTop(nextTop);
  }

  function handleDragStart(event: DragStartEvent) {
    const nextActiveTaskId = String(event.active.id);

    setActiveTaskId(nextActiveTaskId);
    setDroppedTaskId(null);
  }

  function handleDragOver(event: DragOverEvent) {
    const activeId = String(event.active.id);
    const nextOverTaskId = event.over ? String(event.over.id) : null;

    if (!nextOverTaskId || nextOverTaskId === activeId) {
      setDropIndicatorTop(null);
      return;
    }

    const activeIndex = taskIds.indexOf(activeId);
    const overIndex = taskIds.indexOf(nextOverTaskId);
    const nextDropPlacement = activeIndex < overIndex ? 'after' : 'before';

    updateDropIndicator(nextOverTaskId, nextDropPlacement);
  }

  function resetDragState() {
    setActiveTaskId(null);
    setDropIndicatorTop(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const finalOverTaskId = event.over ? String(event.over.id) : null;

    resetDragState();

    if (!finalOverTaskId || finalOverTaskId === activeId) {
      return;
    }

    setDroppedTaskId(activeId);
    window.setTimeout(() => setDroppedTaskId((currentTaskId) => (
      currentTaskId === activeId ? null : currentTaskId
    )), 460);
    onReorderTasks(activeId, finalOverTaskId);
  }

  function handleDragCancel() {
    resetDragState();
  }

  return (
    <DndContext
      autoScroll={false}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <div className="lsw-table-scroll" ref={tableScrollRef}>
        {activeTaskId && dropIndicatorTop !== null ? (
          <div
            aria-hidden="true"
            className="lsw-row-drop-indicator"
            style={{ top: `${dropIndicatorTop}px` }}
          />
        ) : null}
        <table className="lsw-table lsw-daily-table">
          <colgroup>
            <col className="lsw-drag-col" />
            <col className="lsw-min-col" />
            <col className="lsw-task-col" />
            <col className="lsw-time-col" />
            {visibleDays.map((day) => (
              <col className="lsw-day-col" key={day.key} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="lsw-drag-column" />
              <th>Min</th>
              <th>Task/Meeting</th>
              <th className="lsw-center">Time</th>
              {visibleDays.map((day) => (
                <th className={`lsw-day-heading ${day.key === todayDayKey ? 'lsw-day-today' : ''}`} key={day.key}>
                  {day.label}
                </th>
              ))}
            </tr>
          </thead>
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            <tbody>
              {isLoading && tasks.length === 0 ? (
                <tr>
                  <td className="lsw-empty-row" colSpan={columnCount}>Loading daily tasks...</td>
                </tr>
              ) : null}

              {errorMessage ? (
                <tr>
                  <td className="lsw-error-row" colSpan={columnCount}>{errorMessage}</td>
                </tr>
              ) : null}

              {!isLoading && tasks.length === 0 && !errorMessage ? (
                <tr>
                  <td className="lsw-empty-row" colSpan={columnCount}>No daily or weekly tasks yet.</td>
                </tr>
              ) : null}

              {tasks.map((task) => (
                <DailyTaskRow
                  activeTaskId={activeTaskId}
                  isDropped={droppedTaskId === task.taskId}
                  key={task.taskId}
                  onDeleteTask={onDeleteTask}
                  onRowElement={setRowElement}
                  onTaskChange={onTaskChange}
                  selectedWeekBeginning={selectedWeekBeginning}
                  task={task}
                  visibleDays={visibleDays}
                />
              ))}
            </tbody>
          </SortableContext>
        </table>
      </div>
    </DndContext>
  );
}

function DailyTaskRow({
  activeTaskId,
  isDropped,
  onDeleteTask,
  onRowElement,
  onTaskChange,
  selectedWeekBeginning,
  task,
  visibleDays
}: {
  activeTaskId: string | null;
  isDropped: boolean;
  onDeleteTask: (taskId: string) => void;
  onRowElement: (taskId: string, rowElement: HTMLTableRowElement | null) => void;
  onTaskChange: (taskId: string, patch: LswDailyTaskPatch, options?: { immediate?: boolean; skipSave?: boolean }) => void;
  selectedWeekBeginning?: string;
  task: LswDailyTask;
  visibleDays: Array<{ key: DayKey; label: string }>;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition
  } = useSortable({
    id: task.taskId
  });
  const translateY = transform ? Math.round(transform.y) : 0;
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(0, ${translateY}px, 0)` : undefined,
    transition
  };
  const rowClassName = [
    'lsw-sortable-row',
    isDragging ? 'is-dragging' : '',
    activeTaskId && activeTaskId !== task.taskId ? 'is-sorting-peer' : '',
    isDropped ? 'is-dropped' : ''
  ].filter(Boolean).join(' ');
  const setSortableRowRef = React.useCallback((rowElement: HTMLTableRowElement | null) => {
    setNodeRef(rowElement);
    onRowElement(task.taskId, rowElement);
  }, [onRowElement, setNodeRef, task.taskId]);

  return (
    <tr className={rowClassName} data-task-row-id={task.taskId} ref={setSortableRowRef} style={style}>
      <td className="lsw-drag-column">
        <ContextMenu.Root>
          <ContextMenu.Trigger asChild>
            <button
              aria-label={`Drag ${task.task || 'task'} to reorder. Right click for row actions.`}
              className="lsw-drag-button"
              ref={setActivatorNodeRef}
              type="button"
              {...attributes}
              {...listeners}
            >
              <DragHandle />
            </button>
          </ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Content className="lsw-row-action-menu" collisionPadding={12}>
              <ContextMenu.Item
                className="lsw-row-action-menu-item is-danger"
                onSelect={() => onDeleteTask(task.taskId)}
              >
                <XIcon />
                <span>Delete row</span>
              </ContextMenu.Item>
            </ContextMenu.Content>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      </td>
      <td className="lsw-minutes-cell">
        <div className="lsw-cell-fill">
          <input
            aria-label="Task minutes"
            className="lsw-inline-input lsw-minutes-input"
            inputMode="numeric"
            maxLength={4}
            onChange={(event) => {
              const digitsOnly = event.target.value.replace(/\D/g, '');
              const nextMinutes = Math.min(Number(digitsOnly || 0), 1440);

              onTaskChange(task.taskId, { minutes: nextMinutes });
            }}
            pattern="[0-9]*"
            type="text"
            value={String(task.minutes)}
          />
        </div>
      </td>
      <td className="lsw-task-cell">
        <TaskMeetingTextarea
          aria-label="Task or meeting"
          onChange={(nextTask) => onTaskChange(task.taskId, { task: nextTask })}
          placeholder="Type task or meeting"
          value={task.task}
        />
      </td>
      <td className="lsw-center lsw-time-cell">
        <div className="lsw-cell-fill">
          <TimePicker
            aria-label="Task time"
            onChange={(nextTime) => onTaskChange(task.taskId, { time: nextTime }, { immediate: true })}
            value={task.time}
          />
        </div>
      </td>
      {visibleDays.map((day, dayIndex) => {
        const status = getTaskDayStatus(task, day.key);

        return (
          <td className="lsw-check-cell" key={day.key}>
            <div className="lsw-cell-fill">
              <DayStatusPicker
                dayLabel={day.label}
                hintPlacement={dayIndex >= visibleDays.length - 2 ? 'left' : 'center'}
                hintText={getDayStatusHint(task, day.key, selectedWeekBeginning)}
                nextStatus={getNextDayStatus(task, day.key, selectedWeekBeginning)}
                onChange={(nextStatus) => {
                  const dueDate = getTaskDueDate(selectedWeekBeginning, day.key, task.time);

                  onTaskChange(task.taskId, {
                    days: { [day.key]: nextStatus !== 'not_completed' },
                    dayStatusUpdates: {
                      [day.key]: {
                        ...(nextStatus !== 'not_completed' ? { completedAtIso: new Date().toISOString() } : {}),
                        ...(dueDate ? { dueAtIso: dueDate.toISOString() } : {}),
                        status: nextStatus,
                        timeZone: getBrowserTimeZone()
                      }
                    }
                  }, { immediate: true });
                }}
                value={status}
              />
            </div>
          </td>
        );
      })}
    </tr>
  );
}

function TaskMeetingTextarea({
  'aria-label': ariaLabel,
  onChange,
  placeholder,
  value
}: {
  'aria-label': string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useLayoutEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = '0px';

    const rowHeight = textarea.closest('tr')?.getBoundingClientRect().height ?? 0;
    const cellHeight = textarea.parentElement?.getBoundingClientRect().height ?? 0;
    const nextHeight = Math.max(textarea.scrollHeight, Math.ceil(rowHeight), Math.ceil(cellHeight));

    textarea.style.height = `${nextHeight}px`;
  }, [value]);

  return (
    <textarea
      aria-label={ariaLabel}
      className="lsw-inline-input lsw-task-input"
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      ref={textareaRef}
      rows={1}
      value={value}
    />
  );
}

function TimePicker({
  'aria-label': ariaLabel,
  displayValue,
  onChange,
  value
}: {
  'aria-label': string;
  displayValue?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const time = parseTimeParts(value);
  const minuteOptions = React.useMemo(() => {
    const baseOptions = Array.from({ length: 12 }, (_, index) => index * 5);
    return baseOptions.includes(time.minute)
      ? baseOptions
      : [...baseOptions, time.minute].sort((first, second) => first - second);
  }, [time.minute]);

  function updateTime(nextHour: number, nextMinute: number) {
    onChange(`${padTwo(nextHour)}:${padTwo(nextMinute)}`);
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button aria-label={ariaLabel} className="lsw-time-picker-trigger" type="button">
          <span>{displayValue || value}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="center" className="lsw-time-picker-popover" sideOffset={8}>
          <div className="lsw-time-picker-title">24-hour time</div>
          <div className="lsw-time-picker-grid">
            <section className="lsw-time-picker-section">
              <span>Hour</span>
              <div className="lsw-time-picker-options lsw-time-picker-hours">
                {Array.from({ length: 24 }, (_, hour) => (
                  <button
                    className="lsw-time-option"
                    data-selected={hour === time.hour}
                    key={hour}
                    onClick={() => updateTime(hour, time.minute)}
                    type="button"
                  >
                    {padTwo(hour)}
                  </button>
                ))}
              </div>
            </section>
            <section className="lsw-time-picker-section">
              <span>Minute</span>
              <div className="lsw-time-picker-options">
                {minuteOptions.map((minute) => (
                  <button
                    className="lsw-time-option"
                    data-selected={minute === time.minute}
                    key={minute}
                    onClick={() => updateTime(time.hour, minute)}
                    type="button"
                  >
                    {padTwo(minute)}
                  </button>
                ))}
              </div>
            </section>
          </div>
          <Popover.Arrow className="lsw-time-picker-arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function DayStatusPicker({
  dayLabel,
  hintPlacement,
  hintText,
  nextStatus,
  onChange,
  value
}: {
  dayLabel: string;
  hintPlacement: 'center' | 'left';
  hintText: string;
  nextStatus: LswDayStatus;
  onChange: (value: LswDayStatus) => void;
  value: LswDayStatus;
}) {
  const [open, setOpen] = React.useState(false);
  const [showHint, setShowHint] = React.useState(false);
  const [hintPosition, setHintPosition] = React.useState<DayStatusHintPosition | null>(null);
  const [isAnimatingChange, setIsAnimatingChange] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const animationTimerRef = React.useRef<number | null>(null);
  const hintTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => () => {
    if (animationTimerRef.current !== null) {
      window.clearTimeout(animationTimerRef.current);
    }

    if (hintTimerRef.current !== null) {
      window.clearTimeout(hintTimerRef.current);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      clearDayStatusHint();
    }
  }, [open]);

  React.useEffect(() => {
    if (!showHint) {
      return undefined;
    }

    function handleViewportChange() {
      updateHintPosition();
    }

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [showHint]);

  function updateHintPosition() {
    const trigger = triggerRef.current;

    if (!trigger) {
      setHintPosition(null);
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(230, Math.max(188, viewportWidth - 24));
    const centerX = rect.left + (rect.width / 2);
    const left = clamp(centerX - (width / 2), 12, viewportWidth - width - 12);
    const belowTop = rect.bottom + 10;
    const estimatedHeight = 66;
    const showAbove = belowTop + estimatedHeight > viewportHeight - 12 && rect.top > estimatedHeight + 18;
    const top = showAbove
      ? Math.max(12, rect.top - estimatedHeight - 10)
      : belowTop;

    setHintPosition({
      arrowLeft: clamp(centerX - left, 14, width - 14),
      left,
      side: showAbove ? 'above' : 'below',
      top,
      width
    });
  }

  function clearDayStatusHint() {
    if (hintTimerRef.current !== null) {
      window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }

    setShowHint(false);
    setHintPosition(null);
  }

  function scheduleDayStatusHint() {
    clearDayStatusHint();

    hintTimerRef.current = window.setTimeout(() => {
      updateHintPosition();
      setShowHint(true);
      hintTimerRef.current = null;
    }, LSW_HINT_DELAY_MS);
  }

  function selectStatus(selectedStatus: LswDayStatus) {
    onChange(selectedStatus);
    setOpen(false);
    clearDayStatusHint();

    if (animationTimerRef.current !== null) {
      window.clearTimeout(animationTimerRef.current);
    }

    setIsAnimatingChange(false);
    window.requestAnimationFrame(() => {
      setIsAnimatingChange(true);
      animationTimerRef.current = window.setTimeout(() => {
        setIsAnimatingChange(false);
        animationTimerRef.current = null;
      }, 540);
    });
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          aria-label={`${dayLabel} status ${getDayStatusLabel(value)}`}
          className={`lsw-day-status-trigger ${getDayStatusClassName(value)} ${isAnimatingChange ? 'is-changing' : ''}`}
          onBlur={clearDayStatusHint}
          onMouseEnter={scheduleDayStatusHint}
          onMouseLeave={clearDayStatusHint}
          onPointerDown={clearDayStatusHint}
          ref={triggerRef}
          type="button"
        >
          {value === 'not_completed' ? <XIcon /> : <CheckIcon />}
        </button>
      </Popover.Trigger>
      {showHint && !open && hintPosition ? (
        <DayStatusHint
          hintPlacement={hintPlacement}
          position={hintPosition}
          text={hintText}
        />
      ) : null}
      <Popover.Portal>
        <Popover.Content align="center" className="lsw-day-status-popover" collisionPadding={12} side="bottom" sideOffset={2}>
          <button
            aria-label={`Set ${dayLabel} status to ${getDayStatusLabel(nextStatus)}`}
            className={`lsw-day-status-option ${getDayStatusClassName(nextStatus)}`}
            onClick={() => selectStatus(nextStatus)}
            type="button"
          >
            {nextStatus === 'not_completed' ? <XIcon /> : <CheckIcon />}
          </button>
          <Popover.Arrow className="lsw-day-status-arrow" height={7} width={14} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

interface DayStatusHintPosition {
  arrowLeft: number;
  left: number;
  side: 'above' | 'below';
  top: number;
  width: number;
}

function DayStatusHint({
  hintPlacement,
  position,
  text
}: {
  hintPlacement: 'center' | 'left';
  position: DayStatusHintPosition;
  text: string;
}) {
  const hintRef = React.useRef<HTMLSpanElement | null>(null);
  const [adjustedTop, setAdjustedTop] = React.useState(position.top);

  React.useLayoutEffect(() => {
    setAdjustedTop(position.top);

    window.requestAnimationFrame(() => {
      const hint = hintRef.current;

      if (!hint) {
        return;
      }

      const rect = hint.getBoundingClientRect();
      const nextTop = clamp(position.top, 12, window.innerHeight - rect.height - 12);

      setAdjustedTop(nextTop);
    });
  }, [position.top, text]);

  return createPortal(
    <span
      className={`lsw-day-status-hint is-portal is-${position.side} is-${hintPlacement}`}
      ref={hintRef}
      role="tooltip"
      style={{
        '--lsw-hint-arrow-left': `${position.arrowLeft}px`,
        left: `${position.left}px`,
        top: `${adjustedTop}px`,
        width: `${position.width}px`
      } as React.CSSProperties}
    >
      {text}
    </span>,
    document.body
  );
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function ProjectsTable({
  errorMessage,
  isLoading,
  onAddProjectUpdate,
  onDeleteProject,
  onDeleteProjectUpdate,
  onProjectChange,
  onProjectUpdateChange,
  projects
}: {
  errorMessage: string;
  isLoading: boolean;
  onAddProjectUpdate: (projectId: string, afterUpdateId?: string) => void;
  onDeleteProject: (projectId: string) => void;
  onDeleteProjectUpdate: (projectId: string, updateId: string) => void;
  onProjectChange: (projectId: string, patch: LswImprovementProjectPatch, options?: { immediate?: boolean; skipSave?: boolean }) => void;
  onProjectUpdateChange: (projectId: string, updateId: string, text: string) => void;
  projects: LswImprovementProject[];
}) {
  return (
    <div className="lsw-table-scroll">
      <table className="lsw-table lsw-project-table">
        <thead>
          <tr>
            <th className="lsw-action-column" />
            <th className="lsw-number-column">#</th>
            <th>Project</th>
            <th>Update</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && projects.length === 0 ? (
            <tr>
              <td className="lsw-table-state" colSpan={4}>Loading improvement projects...</td>
            </tr>
          ) : null}

          {errorMessage ? (
            <tr>
              <td className="lsw-table-state is-error" colSpan={4}>{errorMessage}</td>
            </tr>
          ) : null}

          {!isLoading && projects.length === 0 && !errorMessage ? (
            <tr>
              <td className="lsw-table-state" colSpan={4}>No improvement projects yet.</td>
            </tr>
          ) : null}

          {projects.map((project, index) => {
            const updates = normalizeProjectUpdates(project.updates);

            return updates.map((update, updateIndex) => (
              <tr key={`${project.projectId}-${update.updateId}`}>
                {updateIndex === 0 ? (
                  <>
                    <td className="lsw-project-action-cell" rowSpan={updates.length}>
                      <div className="lsw-project-action-stack">
                        <RowDeleteMenu
                          ariaLabel={`Open actions for project ${project.project || index + 1}`}
                          label="Delete project"
                          onDelete={() => onDeleteProject(project.projectId)}
                        />
                        <StyleIcon />
                      </div>
                    </td>
                    <td className="lsw-project-number-cell" rowSpan={updates.length}>
                      <span className="lsw-number-pill">{index + 1}</span>
                    </td>
                    <td className="lsw-project-name" rowSpan={updates.length}>
                      <ProjectTextarea
                        ariaLabel="Improvement project"
                        className="lsw-project-input"
                        onChange={(value) => onProjectChange(project.projectId, { project: value })}
                        placeholder="Enter project..."
                        value={project.project}
                      />
                    </td>
                  </>
                ) : null}
                <td className="lsw-project-update-cell">
                  <div className="lsw-project-update-wrap">
                    <ProjectTextarea
                      ariaLabel="Improvement project update"
                      className="lsw-project-update-input"
                      onChange={(value) => onProjectUpdateChange(project.projectId, update.updateId, value)}
                      placeholder="Enter update..."
                      value={update.text}
                    />
                    <div className="lsw-project-update-actions">
                      <button
                        aria-label="Add update row"
                        className="lsw-project-update-action"
                        onClick={() => onAddProjectUpdate(project.projectId, update.updateId)}
                        type="button"
                      >
                        <PlusMiniIcon />
                      </button>
                      {updates.length > 1 || update.text.trim() ? (
                        <RowDeleteMenu
                          ariaLabel="Open actions for update row"
                          label="Delete update row"
                          onDelete={() => onDeleteProjectUpdate(project.projectId, update.updateId)}
                        />
                      ) : null}
                    </div>
                  </div>
                </td>
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProjectTextarea({
  ariaLabel,
  className,
  onChange,
  placeholder,
  value
}: {
  ariaLabel: string;
  className: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useLayoutEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = '0px';
    textarea.style.height = `${Math.max(textarea.scrollHeight, 24)}px`;
  }, [value]);

  return (
    <textarea
      aria-label={ariaLabel}
      className={className}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      ref={textareaRef}
      rows={1}
      value={value}
    />
  );
}

function FollowUpsTable({
  errorMessage,
  followUps,
  isLoading,
  onDeleteFollowUp,
  onFollowUpChange
}: {
  errorMessage: string;
  followUps: LswFollowUp[];
  isLoading: boolean;
  onDeleteFollowUp: (followUpId: string) => void;
  onFollowUpChange: (followUpId: string, patch: LswFollowUpPatch, options?: { immediate?: boolean; skipSave?: boolean }) => void;
}) {
  return (
    <div className="lsw-table-scroll">
      <table className="lsw-table lsw-follow-up-table">
        <thead>
          <tr>
            <th className="lsw-action-column" />
            <th>Follow Up</th>
            <th>Due Date</th>
            <th>Responsible</th>
            <th>Comments/Notes</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && followUps.length === 0 ? (
            <tr>
              <td className="lsw-table-state" colSpan={5}>Loading follow ups...</td>
            </tr>
          ) : null}

          {errorMessage ? (
            <tr>
              <td className="lsw-table-state is-error" colSpan={5}>{errorMessage}</td>
            </tr>
          ) : null}

          {!isLoading && followUps.length === 0 && !errorMessage ? (
            <tr>
              <td className="lsw-table-state" colSpan={5}>No follow ups yet.</td>
            </tr>
          ) : null}

          {followUps.map((followUp) => (
            <FollowUpRow
              followUp={followUp}
              key={followUp.followUpId}
              onDeleteFollowUp={onDeleteFollowUp}
              onFollowUpChange={onFollowUpChange}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FollowUpRow({
  followUp,
  onDeleteFollowUp,
  onFollowUpChange
}: {
  followUp: LswFollowUp;
  onDeleteFollowUp: (followUpId: string) => void;
  onFollowUpChange: (followUpId: string, patch: LswFollowUpPatch, options?: { immediate?: boolean; skipSave?: boolean }) => void;
}) {
  const isPastDue = isFollowUpPastDue(followUp);

  return (
    <tr className={isPastDue ? 'is-past-due' : ''}>
      <td className="lsw-row-actions">
        <RowDeleteMenu
          ariaLabel={`Open actions for follow up ${followUp.followUp || 'row'}`}
          onDelete={() => onDeleteFollowUp(followUp.followUpId)}
        />
      </td>
      <td className="lsw-task-cell">
        <FollowUpTextarea
          ariaLabel="Follow up"
          onChange={(value) => onFollowUpChange(followUp.followUpId, { followUp: value })}
          placeholder="Type follow up"
          value={followUp.followUp}
        />
      </td>
      <td>
        <TodoDatePicker
          ariaLabel="Follow up due date"
          className={`lsw-follow-up-date ${isPastDue ? 'is-past-due' : 'is-on-track'}`}
          onChange={(dueDate) => onFollowUpChange(followUp.followUpId, {
            dueDate,
            timeZone: getBrowserTimeZone()
          }, { immediate: true })}
          value={followUp.dueDate}
        />
      </td>
      <td>
        <FollowUpTextarea
          ariaLabel="Responsible"
          onChange={(value) => onFollowUpChange(followUp.followUpId, { responsible: value })}
          placeholder="Responsible"
          value={followUp.responsible}
        />
      </td>
      <td>
        <FollowUpTextarea
          ariaLabel="Comments or notes"
          onChange={(value) => onFollowUpChange(followUp.followUpId, { comments: value })}
          placeholder="Comments/Notes"
          value={followUp.comments}
        />
      </td>
    </tr>
  );
}

function FollowUpTextarea({
  ariaLabel,
  onChange,
  placeholder,
  value
}: {
  ariaLabel: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useLayoutEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = '0px';
    textarea.style.height = `${Math.max(textarea.scrollHeight, 24)}px`;
  }, [value]);

  return (
    <textarea
      aria-label={ariaLabel}
      className="lsw-follow-up-input"
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      ref={textareaRef}
      rows={1}
      value={value}
    />
  );
}

function TriggersTable({
  emptyMessage,
  errorMessage,
  isLoading,
  onDeleteTrigger,
  onTriggerChange,
  triggers
}: {
  emptyMessage: string;
  errorMessage: string;
  isLoading: boolean;
  onDeleteTrigger: (triggerId: string) => void;
  onTriggerChange: (triggerId: string, patch: LswRcaTriggerPatch, options?: { immediate?: boolean; skipSave?: boolean }) => void;
  triggers: LswRcaTrigger[];
}) {
  return (
    <div className="lsw-table-scroll">
      <table className="lsw-table lsw-rca-trigger-table">
        <thead>
          <tr>
            <th className="lsw-action-column" />
            <th>RCA Event Trigger</th>
            <th>Event Date</th>
            <th>Comments/Notes</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && triggers.length === 0 ? (
            <tr>
              <td className="lsw-table-state" colSpan={4}>Loading RCA triggers...</td>
            </tr>
          ) : null}

          {errorMessage ? (
            <tr>
              <td className="lsw-table-state is-error" colSpan={4}>{errorMessage}</td>
            </tr>
          ) : null}

          {!isLoading && triggers.length === 0 && !errorMessage ? (
            <tr>
              <td className="lsw-table-state" colSpan={4}>{emptyMessage}</td>
            </tr>
          ) : null}

          {triggers.map((trigger) => (
            <RcaTriggerRow
              key={trigger.triggerId}
              onDeleteTrigger={onDeleteTrigger}
              onTriggerChange={onTriggerChange}
              trigger={trigger}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RcaTriggerRow({
  onDeleteTrigger,
  onTriggerChange,
  trigger
}: {
  onDeleteTrigger: (triggerId: string) => void;
  onTriggerChange: (triggerId: string, patch: LswRcaTriggerPatch, options?: { immediate?: boolean; skipSave?: boolean }) => void;
  trigger: LswRcaTrigger;
}) {
  const isPastDue = isRcaTriggerPastDue(trigger);

  return (
    <tr className={isPastDue ? 'is-past-due' : ''}>
      <td className="lsw-row-actions">
        <RowDeleteMenu
          ariaLabel={`Open actions for RCA trigger ${trigger.trigger || 'row'}`}
          onDelete={() => onDeleteTrigger(trigger.triggerId)}
        />
      </td>
      <td className="lsw-task-cell">
        <RcaTriggerTextarea
          ariaLabel="RCA event trigger"
          onChange={(value) => onTriggerChange(trigger.triggerId, { trigger: value })}
          placeholder="Type RCA event trigger"
          value={trigger.trigger}
        />
      </td>
      <td>
        <TodoDatePicker
          ariaLabel="RCA trigger event date"
          className={`lsw-rca-trigger-date ${isPastDue ? 'is-past-due' : 'is-on-track'}`}
          formatValue={formatMonthDayYearFromDateOnly}
          onChange={(eventDate) => onTriggerChange(trigger.triggerId, {
            eventDate,
            timeZone: getBrowserTimeZone()
          }, { immediate: true })}
          value={trigger.eventDate}
        />
      </td>
      <td>
        <RcaTriggerTextarea
          ariaLabel="RCA comments or notes"
          onChange={(value) => onTriggerChange(trigger.triggerId, { comments: value })}
          placeholder="Add comment..."
          value={trigger.comments}
        />
      </td>
    </tr>
  );
}

function RcaTriggerTextarea({
  ariaLabel,
  onChange,
  placeholder,
  value
}: {
  ariaLabel: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useLayoutEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = '0px';
    textarea.style.height = `${Math.max(textarea.scrollHeight, 24)}px`;
  }, [value]);

  return (
    <textarea
      aria-label={ariaLabel}
      className="lsw-rca-trigger-input"
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      ref={textareaRef}
      rows={1}
      value={value}
    />
  );
}

function FrequencyTasks({
  errorMessage,
  isLoading,
  onAddTask,
  onDeleteTask,
  onTaskChange,
  tasks
}: {
  errorMessage: string;
  isLoading: boolean;
  onAddTask: (frequency: LswScheduledTaskFrequency) => void;
  onDeleteTask: (taskId: string) => void;
  onTaskChange: (taskId: string, patch: LswScheduledTaskPatch, options?: { immediate?: boolean; skipSave?: boolean }) => void;
  tasks: LswScheduledTask[];
}) {
  return (
    <div className="lsw-frequency-list">
      {isLoading && tasks.length === 0 ? (
        <div className="lsw-todo-state">Loading scheduled tasks...</div>
      ) : null}

      {errorMessage ? (
        <div className="lsw-todo-state is-error">{errorMessage}</div>
      ) : null}

      {scheduledTaskFrequencyGroups.map(({ frequency, label }) => {
        const frequencyTasks = tasks
          .filter((task) => task.frequency === frequency)
          .sort(sortScheduledTasks);

        return (
          <div className="lsw-frequency-group" key={frequency}>
            <div className="lsw-frequency-title">
              <h3>{label} (Standard Tasks/Meetings)</h3>
              <button
                aria-label={`Add ${label} scheduled task`}
                className="lsw-frequency-add"
                onClick={() => onAddTask(frequency)}
                type="button"
              >
                <PlusMiniIcon />
              </button>
            </div>
            <table className="lsw-table lsw-frequency-table">
              <thead>
                <tr>
                  <th>Min</th>
                  <th>Task/Meeting</th>
                  <th>Due Date</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {frequencyTasks.length === 0 ? (
                  <tr>
                    <td className="lsw-frequency-empty-row" colSpan={4} />
                  </tr>
                ) : null}

                {frequencyTasks.map((task) => (
                  <ScheduledTaskRow
                    key={task.taskId}
                    onDeleteTask={onDeleteTask}
                    onTaskChange={onTaskChange}
                    task={task}
                  />
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function ScheduledTaskRow({
  onDeleteTask,
  onTaskChange,
  task
}: {
  onDeleteTask: (taskId: string) => void;
  onTaskChange: (taskId: string, patch: LswScheduledTaskPatch, options?: { immediate?: boolean; skipSave?: boolean }) => void;
  task: LswScheduledTask;
}) {
  const isPastDue = isScheduledTaskPastDue(task);

  return (
    <tr className={isPastDue ? 'is-past-due' : ''}>
      <td className="lsw-frequency-min-cell">
        <input
          aria-label="Scheduled task minutes"
          className="lsw-frequency-min-input"
          inputMode="numeric"
          maxLength={4}
          onChange={(event) => {
            const digitsOnly = event.target.value.replace(/\D/g, '');
            const minutes = Math.min(Number(digitsOnly || 0), 1440);

            onTaskChange(task.taskId, { minutes });
          }}
          pattern="[0-9]*"
          type="text"
          value={String(task.minutes)}
        />
      </td>
      <td className="lsw-task-cell">
        <ScheduledTaskTextarea
          onChange={(value) => onTaskChange(task.taskId, { task: value })}
          placeholder="Type task/meeting"
          value={task.task}
        />
      </td>
      <td>
        <TodoDatePicker
          ariaLabel="Scheduled task due date"
          className={`lsw-scheduled-date ${isPastDue ? 'is-past-due' : 'is-on-track'}`}
          formatValue={formatMonthDayYearFromDateOnly}
          onChange={(dueDate) => onTaskChange(task.taskId, {
            dueDate,
            timeZone: getBrowserTimeZone()
          }, { immediate: true })}
          value={task.dueDate}
        />
      </td>
      <td className="lsw-row-actions lsw-frequency-row-actions">
        <RowDeleteMenu
          ariaLabel={`Open actions for scheduled task ${task.task || 'row'}`}
          onDelete={() => onDeleteTask(task.taskId)}
        />
      </td>
    </tr>
  );
}

function ScheduledTaskTextarea({
  onChange,
  placeholder,
  value
}: {
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useLayoutEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = '0px';
    textarea.style.height = `${Math.max(textarea.scrollHeight, 24)}px`;
  }, [value]);

  return (
    <textarea
      aria-label="Scheduled task or meeting"
      className="lsw-frequency-task-input"
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      ref={textareaRef}
      rows={1}
      value={value}
    />
  );
}

function TodoList({
  emptyMessage,
  errorMessage,
  isLoading,
  onDeleteTask,
  onTaskChange,
  tasks
}: {
  emptyMessage: string;
  errorMessage: string;
  isLoading: boolean;
  onDeleteTask: (taskId: string) => void;
  onTaskChange: (taskId: string, patch: LswTodoTaskPatch, options?: { immediate?: boolean; skipSave?: boolean }) => void;
  tasks: LswTodoTask[];
}) {
  return (
    <div className="lsw-list lsw-todo-list">
      {isLoading && tasks.length === 0 ? (
        <div className="lsw-todo-state">Loading to-do items...</div>
      ) : null}

      {errorMessage ? (
        <div className="lsw-todo-state is-error">{errorMessage}</div>
      ) : null}

      {!isLoading && tasks.length === 0 && !errorMessage ? (
        <div className="lsw-todo-state">{emptyMessage}</div>
      ) : null}

      {tasks.map((task) => (
        <TodoTaskRow
          key={task.taskId}
          onDeleteTask={onDeleteTask}
          onTaskChange={onTaskChange}
          task={task}
        />
      ))}
    </div>
  );
}

function TodoTaskRow({
  onDeleteTask,
  onTaskChange,
  task
}: {
  onDeleteTask: (taskId: string) => void;
  onTaskChange: (taskId: string, patch: LswTodoTaskPatch, options?: { immediate?: boolean; skipSave?: boolean }) => void;
  task: LswTodoTask;
}) {
  const isPastDue = isTodoPastDue(task);
  const rowClassName = [
    'lsw-todo-item',
    task.completed ? 'is-complete' : '',
    isPastDue ? 'is-past-due' : ''
  ].filter(Boolean).join(' ');

  function toggleCompleted() {
    const nextCompleted = !task.completed;

    onTaskChange(task.taskId, {
      completed: nextCompleted,
      ...(nextCompleted ? { completedAtIso: new Date().toISOString() } : {}),
      timeZone: getBrowserTimeZone()
    }, { immediate: true });
  }

  return (
    <div className={rowClassName}>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <button
            aria-label={`Open actions for ${task.task || 'to-do item'}`}
            className="lsw-todo-drag-button"
            type="button"
          >
            <DragHandle />
          </button>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content className="lsw-row-action-menu" collisionPadding={12}>
            <ContextMenu.Item
              className="lsw-row-action-menu-item is-danger"
              onSelect={() => onDeleteTask(task.taskId)}
            >
              <XIcon />
              <span>Delete row</span>
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      <button
        aria-label={task.completed ? 'Mark to-do item incomplete' : 'Mark to-do item complete'}
        aria-pressed={task.completed}
        className={`lsw-round-check lsw-todo-check ${task.completed ? 'is-checked' : ''}`}
        onClick={toggleCompleted}
        type="button"
      >
        {task.completed ? <CheckIcon /> : null}
      </button>

      <div className="lsw-todo-copy">
        <TodoTaskTextarea
          onChange={(nextTask) => onTaskChange(task.taskId, { task: nextTask })}
          placeholder="Type to-do item"
          value={task.task}
        />
        {task.completed ? (
          <strong>
            Great, Item is completed at {getTodoCompletionDateLabel(task)}, {getTodoCompletionTimeLabel(task)}
          </strong>
        ) : null}
      </div>

      {isPastDue ? <em>Past Due</em> : null}

      <div className="lsw-todo-schedule">
        <TodoDatePicker
          ariaLabel="To-do due date"
          onChange={(dueDate) => onTaskChange(task.taskId, {
            dueDate,
            timeZone: getBrowserTimeZone()
          }, { immediate: true })}
          value={task.dueDate}
        />
        <TimePicker
          aria-label="To-do due time"
          displayValue={formatTimeFromTaskTime(task.dueTime)}
          onChange={(dueTime) => onTaskChange(task.taskId, {
            dueTime,
            timeZone: getBrowserTimeZone()
          }, { immediate: true })}
          value={task.dueTime}
        />
      </div>
    </div>
  );
}

function TodoTaskTextarea({
  onChange,
  placeholder,
  value
}: {
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useLayoutEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = '0px';
    textarea.style.height = `${Math.max(textarea.scrollHeight, 24)}px`;
  }, [value]);

  return (
    <textarea
      aria-label="To-do item"
      className="lsw-todo-task-input"
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      ref={textareaRef}
      rows={1}
      value={value}
    />
  );
}

function TodoDatePicker({
  ariaLabel = 'Due date',
  className = '',
  formatValue = formatMonthDayFromDateOnly,
  onChange,
  value
}: {
  ariaLabel?: string;
  className?: string;
  formatValue?: (value: string) => string;
  onChange: (value: string) => void;
  value: string;
}) {
  const selectedDate = parseLocalDateOnly(value) || new Date();

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button aria-label={ariaLabel} className={`lsw-todo-date-trigger ${className}`.trim()} type="button">
          {formatValue(value)}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" className="lsw-date-picker-popover" collisionPadding={12} sideOffset={8}>
          <DayPicker
            defaultMonth={selectedDate}
            fixedWeeks
            mode="single"
            onSelect={(date) => {
              if (date) {
                onChange(formatLocalDateOnly(date));
              }
            }}
            selected={selectedDate}
            showOutsideDays
          />
          <Popover.Arrow className="lsw-time-picker-arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function RailsList({
  emptyMessage,
  errorMessage,
  isLoading,
  onDeleteRail,
  onRailChange,
  rails
}: {
  emptyMessage: string;
  errorMessage: string;
  isLoading: boolean;
  onDeleteRail: (railId: string) => void;
  onRailChange: (railId: string, patch: LswMeetingRailPatch, options?: { immediate?: boolean; skipSave?: boolean }) => void;
  rails: LswMeetingRail[];
}) {
  return (
    <div className="lsw-list lsw-rail-list">
      {isLoading && rails.length === 0 ? (
        <div className="lsw-todo-state">Loading meeting rails...</div>
      ) : null}

      {errorMessage ? (
        <div className="lsw-todo-state is-error">{errorMessage}</div>
      ) : null}

      {!isLoading && rails.length === 0 && !errorMessage ? (
        <div className="lsw-todo-state">{emptyMessage}</div>
      ) : null}

      {rails.map((rail) => (
        <MeetingRailRow
          key={rail.railId}
          onDeleteRail={onDeleteRail}
          onRailChange={onRailChange}
          rail={rail}
        />
      ))}
    </div>
  );
}

function MeetingRailRow({
  onDeleteRail,
  onRailChange,
  rail
}: {
  onDeleteRail: (railId: string) => void;
  onRailChange: (railId: string, patch: LswMeetingRailPatch, options?: { immediate?: boolean; skipSave?: boolean }) => void;
  rail: LswMeetingRail;
}) {
  const isPastDue = isMeetingRailPastDue(rail);
  const rowClassName = [
    'lsw-rail-item',
    rail.completed ? 'is-complete' : '',
    isPastDue ? 'is-past-due' : ''
  ].filter(Boolean).join(' ');

  function toggleCompleted() {
    onRailChange(rail.railId, {
      completed: !rail.completed,
      timeZone: getBrowserTimeZone()
    }, { immediate: true });
  }

  return (
    <div className={rowClassName}>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <button
            aria-label={`Open actions for ${rail.rail || 'meeting rail'}`}
            className="lsw-todo-drag-button"
            type="button"
          >
            <DragHandle />
          </button>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content className="lsw-row-action-menu" collisionPadding={12}>
            <ContextMenu.Item
              className="lsw-row-action-menu-item is-danger"
              onSelect={() => onDeleteRail(rail.railId)}
            >
              <XIcon />
              <span>Delete row</span>
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      <button
        aria-label={rail.completed ? 'Mark meeting rail incomplete' : 'Mark meeting rail complete'}
        aria-pressed={rail.completed}
        className={`lsw-square-check lsw-meeting-rail-check ${rail.completed ? 'is-checked green' : ''}`}
        onClick={toggleCompleted}
        type="button"
      >
        {rail.completed ? <CheckIcon /> : null}
      </button>

      <div className="lsw-rail-copy">
        <MeetingRailTextarea
          isComplete={rail.completed}
          onChange={(nextRail) => onRailChange(rail.railId, { rail: nextRail })}
          placeholder="Type meeting rail"
          value={rail.rail}
        />
      </div>

      {isPastDue ? <em>Past Due</em> : null}

      <div className="lsw-todo-schedule">
        <TodoDatePicker
          ariaLabel="Meeting rail due date"
          onChange={(dueDate) => onRailChange(rail.railId, {
            dueDate,
            timeZone: getBrowserTimeZone()
          }, { immediate: true })}
          value={rail.dueDate}
        />
        <TimePicker
          aria-label="Meeting rail due time"
          displayValue={formatTimeFromTaskTime(rail.dueTime)}
          onChange={(dueTime) => onRailChange(rail.railId, {
            dueTime,
            timeZone: getBrowserTimeZone()
          }, { immediate: true })}
          value={rail.dueTime}
        />
      </div>
    </div>
  );
}

function MeetingRailTextarea({
  isComplete,
  onChange,
  placeholder,
  value
}: {
  isComplete: boolean;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useLayoutEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = '0px';
    textarea.style.height = `${Math.max(textarea.scrollHeight, 24)}px`;
  }, [value]);

  return (
    <textarea
      aria-label="Meeting rail"
      className={`lsw-rail-input ${isComplete ? 'is-struck' : ''}`}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      ref={textareaRef}
      rows={1}
      value={value}
    />
  );
}

function KeyResults({
  config,
  errorMessage,
  isLoading
}: {
  config: CompanyKeyResultsConfig;
  errorMessage: string;
  isLoading: boolean;
}) {
  return (
    <div className="lsw-key-results">
      {isLoading && config.groups.length === 0 ? (
        <div className="lsw-key-results-state">Loading key results...</div>
      ) : null}

      {errorMessage ? (
        <div className="lsw-key-results-state is-error">{errorMessage}</div>
      ) : null}

      {!isLoading && config.groups.length === 0 && !errorMessage ? (
        <div className="lsw-key-results-state">No company key results have been set up yet.</div>
      ) : null}

      {config.groups.map((group) => (
        <div className="lsw-key-result-group" key={group.groupId}>
          <h3>{group.name}</h3>
          {group.metrics.map((metric) => (
            <div className="lsw-metric-row" key={metric.metricId}>
              <span>{metric.key}</span>
              <strong>{formatKeyResultMetricValue(metric, config.units)}</strong>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function GoalsList({
  errorMessage,
  goals,
  isLoading,
  onDeleteGoal,
  onGoalChange
}: {
  errorMessage: string;
  goals: LswPersonalGoal[];
  isLoading: boolean;
  onDeleteGoal: (goalId: string) => void;
  onGoalChange: (goalId: string, patch: LswPersonalGoalPatch, options?: { immediate?: boolean; skipSave?: boolean }) => void;
}) {
  return (
    <div className="lsw-list lsw-goals-list">
      {isLoading && goals.length === 0 ? (
        <div className="lsw-todo-state">Loading objectives...</div>
      ) : null}

      {errorMessage ? (
        <div className="lsw-todo-state is-error">{errorMessage}</div>
      ) : null}

      {!isLoading && goals.length === 0 && !errorMessage ? (
        <div className="lsw-todo-state">No objectives yet.</div>
      ) : null}

      {goals.map((goal) => (
        <PersonalGoalRow
          goal={goal}
          key={goal.goalId}
          onDeleteGoal={onDeleteGoal}
          onGoalChange={onGoalChange}
        />
      ))}
    </div>
  );
}

function PersonalGoalRow({
  goal,
  onDeleteGoal,
  onGoalChange
}: {
  goal: LswPersonalGoal;
  onDeleteGoal: (goalId: string) => void;
  onGoalChange: (goalId: string, patch: LswPersonalGoalPatch, options?: { immediate?: boolean; skipSave?: boolean }) => void;
}) {
  const rowRef = React.useRef<HTMLDivElement | null>(null);
  const objectiveRef = React.useRef<HTMLTextAreaElement | null>(null);
  const latestHintPointRef = React.useRef<GoalHintPoint | null>(null);
  const hintTimerRef = React.useRef<number | null>(null);
  const [isHintVisible, setIsHintVisible] = React.useState(false);
  const [hintPosition, setHintPosition] = React.useState<GoalHintPosition | null>(null);
  const progress = clampProgress(goal.progress);
  const progressSegments = getGoalProgressSegments(progress);
  const isStarted = isGoalStarted(goal);
  const isDateLocked = isGoalDateLocked(goal);
  const isPastDue = isPersonalGoalPastDue(goal);
  const tooltipId = `${goal.goalId}-goal-tooltip`;
  const rowClassName = [
    'lsw-goal-item',
    isStarted ? 'is-started' : 'is-not-started',
    isPastDue ? 'is-past-due' : ''
  ].filter(Boolean).join(' ');

  React.useEffect(() => {
    if (!isHintVisible) {
      return undefined;
    }

    function handleViewportChange() {
      updateHintPosition();
    }

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isHintVisible]);

  React.useEffect(() => {
    if (!isStarted) {
      clearGoalHint();
    }
  }, [isStarted]);

  React.useEffect(() => () => {
    if (hintTimerRef.current !== null) {
      window.clearTimeout(hintTimerRef.current);
    }
  }, []);

  function updateHintPosition(point = latestHintPointRef.current) {
    const nextPoint = point || getGoalHintFallbackPoint(rowRef.current);

    if (!nextPoint) {
      setHintPosition(null);
      return;
    }

    const width = Math.min(280, Math.max(210, window.innerWidth - 24));
    const gap = 14;
    const left = clamp(nextPoint.x + gap, 12, window.innerWidth - width - 12);
    const top = nextPoint.y + gap;

    latestHintPointRef.current = nextPoint;
    setHintPosition({ anchorY: nextPoint.y, left, top, width });
  }

  function scheduleHint(event?: React.MouseEvent<HTMLDivElement>) {
    if (!isStarted) {
      return;
    }

    updateHintPosition(event ? getGoalHintPoint(event) : undefined);

    if (hintTimerRef.current !== null || isHintVisible) {
      return;
    }

    hintTimerRef.current = window.setTimeout(() => {
      updateHintPosition();
      setIsHintVisible(true);
      hintTimerRef.current = null;
    }, LSW_HINT_DELAY_MS);
  }

  function moveHint(event: React.MouseEvent<HTMLDivElement>) {
    if (!isStarted) {
      return;
    }

    const point = getGoalHintPoint(event);

    latestHintPointRef.current = point;

    if (isHintVisible) {
      updateHintPosition(point);
    }
  }

  function clearGoalHint() {
    if (hintTimerRef.current !== null) {
      window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }

    setIsHintVisible(false);
    setHintPosition(null);
  }

  function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      clearGoalHint();
    }
  }

  function focusObjective() {
    window.setTimeout(() => {
      objectiveRef.current?.focus();
      objectiveRef.current?.select();
    }, 0);
  }

  function updateProgress(value: string) {
    onGoalChange(goal.goalId, {
      progress: clampProgress(Number(value)),
      timeZone: getBrowserTimeZone()
    });
  }

  return (
    <div
      aria-describedby={isStarted ? tooltipId : undefined}
      className={rowClassName}
      onBlur={handleBlur}
      onFocus={() => scheduleHint()}
      onMouseEnter={(event) => scheduleHint(event)}
      onMouseLeave={clearGoalHint}
      onMouseMove={moveHint}
      ref={rowRef}
    >
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <button
            aria-label={`Open actions for ${goal.objective || 'objective'}`}
            className="lsw-todo-drag-button lsw-goal-drag-button"
            type="button"
          >
            <DragHandle />
          </button>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content className="lsw-row-action-menu" collisionPadding={12}>
            <ContextMenu.Item
              className="lsw-row-action-menu-item"
              onSelect={focusObjective}
            >
              <StyleIcon />
              <span>Edit goal text</span>
            </ContextMenu.Item>
            <ContextMenu.Item
              className="lsw-row-action-menu-item is-danger"
              onSelect={() => onDeleteGoal(goal.goalId)}
            >
              <XIcon />
              <span>Delete row</span>
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      <div className="lsw-goal-content">
        <div className="lsw-goal-topline">
          <PersonalGoalTextarea
            onChange={(objective) => onGoalChange(goal.goalId, { objective })}
            placeholder="Type objective"
            textareaRef={objectiveRef}
            value={goal.objective}
          />
          <div className="lsw-goal-meta">
            <span className={`lsw-goal-status-badge ${isStarted ? 'is-started' : 'is-not-started'}`}>
              {isStarted ? 'STARTED' : 'NOT STARTED'}
            </span>
            {isDateLocked ? (
              <span className={`lsw-goal-date is-locked ${getGoalDateStateClassName(isPastDue)}`} aria-label="Goal due date locked">
                {formatMonthDayFromDateOnly(goal.dueDate)}
              </span>
            ) : (
              <TodoDatePicker
                ariaLabel="Objective due date"
                className={`lsw-goal-date ${getGoalDateStateClassName(isPastDue)}`}
                onChange={(dueDate) => onGoalChange(goal.goalId, {
                  dueDate,
                  timeZone: getBrowserTimeZone()
                }, { immediate: true })}
                value={goal.dueDate}
              />
            )}
          </div>
        </div>

        <div className="lsw-progress-row lsw-goal-progress-row">
          <div
            aria-label={`Objective progress ${progress}%`}
            className="lsw-goal-progress-track"
            role="meter"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progress}
          >
            <span className="is-red" style={{ width: `${progressSegments.red}%` }} />
            <span className="is-yellow" style={{ width: `${progressSegments.yellow}%` }} />
            <span className="is-green" style={{ width: `${progressSegments.green}%` }} />
            <span className="is-blue" style={{ width: `${progressSegments.blue}%` }} />
          </div>
          <label className="lsw-goal-progress-control">
            <input
              aria-label="Objective progress percent"
              max={100}
              min={0}
              onChange={(event) => updateProgress(event.target.value)}
              step={1}
              type="number"
              value={progress}
            />
            <span>%</span>
          </label>
        </div>

        {isPastDue ? (
          <div className="lsw-goal-past-due-row">
            <em className="lsw-goal-past-due-badge">Past Due</em>
          </div>
        ) : null}

        {isStarted && isHintVisible && hintPosition ? (
          <GoalHoverHint
            daysLeftLabel={getGoalDaysLeftLabel(goal)}
            id={tooltipId}
            position={hintPosition}
            progress={progress}
            startedDateLabel={getGoalStartedDateLabel(goal)}
          />
        ) : null}
      </div>
    </div>
  );
}

interface GoalHintPosition {
  anchorY: number;
  left: number;
  top: number;
  width: number;
}

interface GoalHintPoint {
  x: number;
  y: number;
}

function GoalHoverHint({
  daysLeftLabel,
  id,
  position,
  progress,
  startedDateLabel
}: {
  daysLeftLabel: string;
  id: string;
  position: GoalHintPosition;
  progress: number;
  startedDateLabel: string;
}) {
  const hintRef = React.useRef<HTMLDivElement | null>(null);
  const [top, setTop] = React.useState(position.top);

  React.useLayoutEffect(() => {
    setTop(position.top);

    window.requestAnimationFrame(() => {
      const hint = hintRef.current;

      if (!hint) {
        return;
      }

      const rect = hint.getBoundingClientRect();
      const gap = 14;
      const belowTop = position.anchorY + gap;
      const aboveTop = position.anchorY - rect.height - gap;
      const nextTop = belowTop + rect.height > window.innerHeight - 12 && aboveTop >= 12
        ? aboveTop
        : belowTop;

      setTop(clamp(nextTop, 12, window.innerHeight - rect.height - 12));
    });
  }, [position.anchorY, position.top, daysLeftLabel, progress, startedDateLabel]);

  return createPortal(
    <div
      className="lsw-goal-hover-card is-portal"
      id={id}
      ref={hintRef}
      role="tooltip"
      style={{
        left: `${position.left}px`,
        maxWidth: `${position.width}px`,
        top: `${top}px`
      }}
    >
      <span>Started: {startedDateLabel}</span>
      <span>{daysLeftLabel}</span>
      <span>Progress: {progress}%</span>
    </div>,
    document.body
  );
}

function getGoalHintPoint(event: React.MouseEvent<HTMLElement>): GoalHintPoint {
  return {
    x: event.clientX,
    y: event.clientY
  };
}

function getGoalHintFallbackPoint(row: HTMLElement | null): GoalHintPoint | null {
  if (!row) {
    return null;
  }

  const rect = row.getBoundingClientRect();

  return {
    x: rect.left + Math.min(rect.width * 0.64, rect.width - 18),
    y: rect.top + Math.min(rect.height * 0.5, rect.height - 18)
  };
}

function PersonalGoalTextarea({
  onChange,
  placeholder,
  textareaRef,
  value
}: {
  onChange: (value: string) => void;
  placeholder: string;
  textareaRef: React.MutableRefObject<HTMLTextAreaElement | null>;
  value: string;
}) {
  React.useLayoutEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = '0px';
    textarea.style.height = `${Math.max(textarea.scrollHeight, 26)}px`;
  }, [textareaRef, value]);

  return (
    <textarea
      aria-label="Personal objective"
      className="lsw-goal-input"
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      ref={textareaRef}
      rows={1}
      value={value}
    />
  );
}

function PastDueCheckbox({
  checked,
  count,
  onChange
}: {
  checked: boolean;
  count?: number;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="lsw-past-due-checkbox">
      <input
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span>Show past due</span>
      {typeof count === 'number' ? <strong>{count}</strong> : null}
    </label>
  );
}

function PastDueToggle({ count }: { count: number }) {
  return (
    <button className="lsw-past-due-toggle" type="button">
      <span>Show past due</span>
      <strong>{count}</strong>
    </button>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'The LSW workspace could not be loaded.';
}

function useNow(): Date {
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const timerId = window.setInterval(() => setNow(new Date()), 1000);

    return () => window.clearInterval(timerId);
  }, []);

  return now;
}

function applyTodoTaskPatch(task: LswTodoTask, patch: LswTodoTaskPatch): LswTodoTask {
  const nextTask: LswTodoTask = {
    ...task,
    dueDate: patch.dueDate ?? task.dueDate,
    dueTime: patch.dueTime ?? task.dueTime,
    sortOrder: patch.sortOrder ?? task.sortOrder,
    task: patch.task ?? task.task,
    timeZone: patch.timeZone ?? task.timeZone
  };

  if (patch.completed !== undefined) {
    nextTask.completed = patch.completed;

    if (patch.completed) {
      const completedAtIso = patch.completedAtIso || task.completedAtIso || new Date().toISOString();
      const completedAt = new Date(completedAtIso);

      nextTask.completedAtIso = completedAtIso;
      nextTask.completedDateLabel = formatMonthDay(completedAt);
      nextTask.completedTimeLabel = formatDisplayTime(completedAt);
    } else {
      delete nextTask.completedAtIso;
      delete nextTask.completedDateLabel;
      delete nextTask.completedTimeLabel;
    }
  }

  return nextTask;
}

function isTodoPastDue(task: LswTodoTask): boolean {
  if (task.completed) {
    return false;
  }

  const dueDateTime = getTodoDueDateTime(task);

  return Boolean(dueDateTime && dueDateTime.getTime() < Date.now());
}

function getTodoDueDateTime(task: Pick<LswTodoTask, 'dueDate' | 'dueTime'>): Date | null {
  const date = parseLocalDateOnly(task.dueDate);
  const time = parseTimeParts(task.dueTime);

  if (!date) {
    return null;
  }

  date.setHours(time.hour, time.minute, 0, 0);

  return date;
}

function getTodoCompletionDateLabel(task: LswTodoTask): string {
  if (task.completedDateLabel) {
    return task.completedDateLabel;
  }

  const completedAt = task.completedAtIso ? new Date(task.completedAtIso) : null;

  return completedAt && !Number.isNaN(completedAt.getTime())
    ? formatMonthDay(completedAt)
    : formatMonthDay(new Date());
}

function getTodoCompletionTimeLabel(task: LswTodoTask): string {
  if (task.completedTimeLabel) {
    return task.completedTimeLabel;
  }

  const completedAt = task.completedAtIso ? new Date(task.completedAtIso) : null;

  return completedAt && !Number.isNaN(completedAt.getTime())
    ? formatDisplayTime(completedAt)
    : formatDisplayTime(new Date());
}

function sortTodoTasks(first: LswTodoTask, second: LswTodoTask): number {
  return first.sortOrder - second.sortOrder || first.task.localeCompare(second.task);
}

function applyFollowUpPatch(followUp: LswFollowUp, patch: LswFollowUpPatch): LswFollowUp {
  return {
    ...followUp,
    comments: patch.comments ?? followUp.comments,
    dueDate: patch.dueDate ?? followUp.dueDate,
    followUp: patch.followUp ?? followUp.followUp,
    responsible: patch.responsible ?? followUp.responsible,
    sortOrder: patch.sortOrder ?? followUp.sortOrder,
    timeZone: patch.timeZone ?? followUp.timeZone
  };
}

function isFollowUpPastDue(followUp: Pick<LswFollowUp, 'dueDate'>): boolean {
  const dueDate = parseLocalDateOnly(followUp.dueDate);

  if (!dueDate) {
    return false;
  }

  const today = new Date();

  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  return dueDate.getTime() < today.getTime();
}

function sortFollowUps(first: LswFollowUp, second: LswFollowUp): number {
  return first.sortOrder - second.sortOrder || first.followUp.localeCompare(second.followUp);
}

function applyRcaTriggerPatch(trigger: LswRcaTrigger, patch: LswRcaTriggerPatch): LswRcaTrigger {
  return {
    ...trigger,
    comments: patch.comments ?? trigger.comments,
    eventDate: patch.eventDate ?? trigger.eventDate,
    sortOrder: patch.sortOrder ?? trigger.sortOrder,
    timeZone: patch.timeZone ?? trigger.timeZone,
    trigger: patch.trigger ?? trigger.trigger
  };
}

function isRcaTriggerPastDue(trigger: Pick<LswRcaTrigger, 'eventDate'>): boolean {
  const eventDate = parseLocalDateOnly(trigger.eventDate);

  if (!eventDate) {
    return false;
  }

  const today = new Date();

  today.setHours(0, 0, 0, 0);
  eventDate.setHours(0, 0, 0, 0);

  return eventDate.getTime() < today.getTime();
}

function sortRcaTriggers(first: LswRcaTrigger, second: LswRcaTrigger): number {
  return first.sortOrder - second.sortOrder || first.trigger.localeCompare(second.trigger);
}

function applyMeetingRailPatch(rail: LswMeetingRail, patch: LswMeetingRailPatch): LswMeetingRail {
  return {
    ...rail,
    completed: patch.completed ?? rail.completed,
    dueDate: patch.dueDate ?? rail.dueDate,
    dueTime: patch.dueTime ?? rail.dueTime,
    rail: patch.rail ?? rail.rail,
    sortOrder: patch.sortOrder ?? rail.sortOrder,
    timeZone: patch.timeZone ?? rail.timeZone
  };
}

function isMeetingRailPastDue(rail: LswMeetingRail): boolean {
  if (rail.completed) {
    return false;
  }

  const dueDateTime = getMeetingRailDueDateTime(rail);

  return Boolean(dueDateTime && dueDateTime.getTime() < Date.now());
}

function getMeetingRailDueDateTime(rail: Pick<LswMeetingRail, 'dueDate' | 'dueTime'>): Date | null {
  const date = parseLocalDateOnly(rail.dueDate);
  const time = parseTimeParts(rail.dueTime);

  if (!date) {
    return null;
  }

  date.setHours(time.hour, time.minute, 0, 0);

  return date;
}

function sortMeetingRails(first: LswMeetingRail, second: LswMeetingRail): number {
  return first.sortOrder - second.sortOrder || first.rail.localeCompare(second.rail);
}

function applyPersonalGoalPatch(goal: LswPersonalGoal, patch: LswPersonalGoalPatch): LswPersonalGoal {
  const nextProgress = patch.progress === undefined ? clampProgress(goal.progress) : clampProgress(patch.progress);
  const wasStarted = clampProgress(goal.progress) > 0;
  const isStarting = !wasStarted && nextProgress > 0;
  const startedAtIso = isStarting
    ? new Date().toISOString()
    : nextProgress > 0
      ? goal.startedAtIso
      : undefined;
  const startedAt = startedAtIso ? new Date(startedAtIso) : null;
  const startedDateLabel = isStarting && startedAt && !Number.isNaN(startedAt.getTime())
    ? formatMonthDay(startedAt)
    : nextProgress > 0
      ? goal.startedDateLabel
      : undefined;
  const nextGoal: LswPersonalGoal = {
    ...goal,
    dueDate: patch.dueDate ?? goal.dueDate,
    objective: patch.objective ?? goal.objective,
    progress: nextProgress,
    sortOrder: patch.sortOrder ?? goal.sortOrder,
    timeZone: patch.timeZone ?? goal.timeZone
  };

  if (startedAtIso) {
    nextGoal.startedAtIso = startedAtIso;
  } else {
    delete nextGoal.startedAtIso;
  }

  if (startedDateLabel) {
    nextGoal.startedDateLabel = startedDateLabel;
  } else {
    delete nextGoal.startedDateLabel;
  }

  return nextGoal;
}

function isGoalStarted(goal: Pick<LswPersonalGoal, 'progress'>): boolean {
  return clampProgress(goal.progress) > 0;
}

function isGoalDateLocked(goal: Pick<LswPersonalGoal, 'progress'>): boolean {
  return isGoalStarted(goal);
}

function isPersonalGoalPastDue(goal: LswPersonalGoal): boolean {
  if (clampProgress(goal.progress) >= 100) {
    return false;
  }

  const dueDate = parseLocalDateOnly(goal.dueDate);

  if (!dueDate) {
    return false;
  }

  const today = new Date();

  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  return dueDate.getTime() < today.getTime();
}

function getGoalDateStateClassName(isPastDue: boolean): string {
  return isPastDue ? 'is-past-due' : 'is-on-track';
}

function sortPersonalGoals(first: LswPersonalGoal, second: LswPersonalGoal): number {
  return first.sortOrder - second.sortOrder || first.objective.localeCompare(second.objective);
}

function applyImprovementProjectPatch(
  project: LswImprovementProject,
  patch: LswImprovementProjectPatch
): LswImprovementProject {
  return {
    ...project,
    project: patch.project ?? project.project,
    sortOrder: patch.sortOrder ?? project.sortOrder,
    updates: patch.updates ? normalizeProjectUpdates(patch.updates) : normalizeProjectUpdates(project.updates)
  };
}

function sortImprovementProjects(first: LswImprovementProject, second: LswImprovementProject): number {
  return first.sortOrder - second.sortOrder || first.project.localeCompare(second.project);
}

function applyScheduledTaskPatch(task: LswScheduledTask, patch: LswScheduledTaskPatch): LswScheduledTask {
  return {
    ...task,
    dueDate: patch.dueDate ?? task.dueDate,
    frequency: patch.frequency ?? task.frequency,
    minutes: patch.minutes === undefined ? task.minutes : clampScheduledMinutes(patch.minutes),
    sortOrder: patch.sortOrder ?? task.sortOrder,
    task: patch.task ?? task.task,
    timeZone: patch.timeZone ?? task.timeZone
  };
}

function isScheduledTaskPastDue(task: Pick<LswScheduledTask, 'dueDate'>): boolean {
  const dueDate = parseLocalDateOnly(task.dueDate);

  if (!dueDate) {
    return false;
  }

  const today = new Date();

  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  return dueDate.getTime() < today.getTime();
}

function sortScheduledTasks(first: LswScheduledTask, second: LswScheduledTask): number {
  return getScheduledFrequencyIndex(first.frequency) - getScheduledFrequencyIndex(second.frequency) ||
    first.sortOrder - second.sortOrder ||
    first.task.localeCompare(second.task);
}

function getScheduledFrequencyIndex(frequency: LswScheduledTaskFrequency): number {
  const index = scheduledTaskFrequencyGroups.findIndex((group) => group.frequency === frequency);

  return index >= 0 ? index : scheduledTaskFrequencyGroups.length;
}

function clampScheduledMinutes(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(clamp(value, 0, 1440));
}

function formatKeyResultMetricValue(metric: KeyResultMetric, units: KeyResultUnit[]): string {
  const unit = units.find((currentUnit) => currentUnit.unitId === metric.unitId);
  const suffix = unit?.suffix?.trim() || '';

  if (!suffix) {
    return metric.value;
  }

  return suffix.startsWith('/') ? `${metric.value}${suffix}` : `${metric.value} ${suffix}`;
}

function normalizeProjectUpdates(updates: LswImprovementProjectUpdate[] = []): LswImprovementProjectUpdate[] {
  const activeUpdates = updates
    .filter((update) => (update.status || 'ACTIVE') === 'ACTIVE')
    .map((update, index) => ({
      sortOrder: Number.isFinite(update.sortOrder) ? update.sortOrder : ((index + 1) * 1000),
      status: update.status || 'ACTIVE',
      text: update.text || '',
      updateId: update.updateId || createLocalId('upd')
    }))
    .sort((first, second) => first.sortOrder - second.sortOrder || first.updateId.localeCompare(second.updateId));

  return activeUpdates.length > 0 ? activeUpdates : [createBlankProjectUpdate(1000)];
}

function insertImprovementProjectUpdate(
  updates: LswImprovementProjectUpdate[],
  afterUpdateId?: string
): LswImprovementProjectUpdate[] {
  const normalizedUpdates = normalizeProjectUpdates(updates);
  const afterIndex = afterUpdateId
    ? normalizedUpdates.findIndex((update) => update.updateId === afterUpdateId)
    : -1;
  const insertIndex = afterIndex >= 0 ? afterIndex + 1 : normalizedUpdates.length;
  const nextUpdates = [...normalizedUpdates];

  nextUpdates.splice(insertIndex, 0, createBlankProjectUpdate((insertIndex + 1) * 1000));

  return rebalanceProjectUpdates(nextUpdates);
}

function rebalanceProjectUpdates(updates: LswImprovementProjectUpdate[]): LswImprovementProjectUpdate[] {
  const normalizedUpdates = normalizeProjectUpdates(updates);

  return normalizedUpdates.map((update, index) => ({
    ...update,
    sortOrder: (index + 1) * 1000,
    status: 'ACTIVE'
  }));
}

function createBlankProjectUpdate(sortOrder = 1000): LswImprovementProjectUpdate {
  return {
    sortOrder,
    status: 'ACTIVE',
    text: '',
    updateId: createLocalId('upd')
  };
}

function createLocalId(prefix: string): string {
  const randomValue = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

  return `${prefix}_${randomValue.replace(/[^a-zA-Z0-9]/g, '').slice(0, 18)}`;
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(clamp(value, 0, 100));
}

function getGoalProgressSegments(progressValue: number): { blue: number; green: number; red: number; yellow: number } {
  const progress = clampProgress(progressValue);

  return {
    red: Math.min(progress, 20),
    yellow: clamp(progress - 20, 0, 30),
    green: clamp(progress - 50, 0, 30),
    blue: clamp(progress - 80, 0, 20)
  };
}

function getGoalStartedDateLabel(goal: LswPersonalGoal): string {
  if (goal.startedDateLabel) {
    return goal.startedDateLabel;
  }

  const startedAt = goal.startedAtIso ? new Date(goal.startedAtIso) : null;

  return startedAt && !Number.isNaN(startedAt.getTime())
    ? formatMonthDay(startedAt)
    : formatMonthDay(new Date());
}

function getGoalDaysLeftLabel(goal: LswPersonalGoal): string {
  const dueDate = parseLocalDateOnly(goal.dueDate);

  if (!dueDate) {
    return 'Days left unavailable';
  }

  const today = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  const days = Math.ceil((dueDate.getTime() - today.getTime()) / dayMs);

  if (days < 0) {
    const pastDueDays = Math.abs(days);

    return `Past due by ${pastDueDays} ${pastDueDays === 1 ? 'day' : 'days'}`;
  }

  if (days === 0) {
    return 'Due today';
  }

  return `${days} ${days === 1 ? 'day' : 'days'} left`;
}

function getEmptyTaskDays(): Record<DayKey, boolean> {
  return {
    fri: false,
    mon: false,
    sat: false,
    sun: false,
    thu: false,
    tue: false,
    wed: false
  };
}

function getEmptyTaskDayStatuses(): Record<DayKey, LswDayStatus> {
  return {
    fri: 'not_completed',
    mon: 'not_completed',
    sat: 'not_completed',
    sun: 'not_completed',
    thu: 'not_completed',
    tue: 'not_completed',
    wed: 'not_completed'
  };
}

function getEmptyTaskDayStatusDetails(): LswDailyTask['dayStatusDetails'] {
  const details = {} as LswDailyTask['dayStatusDetails'];

  allDays.forEach((day) => {
    details[day.key] = {
      completionTiming: 'not_completed',
      completionWindowHours: COMPLETION_WINDOW_HOURS,
      firstCompletedOnTime: false,
      status: 'not_completed'
    };
  });

  return details;
}

function applyDailyTaskPatch(task: LswDailyTask, patch: LswDailyTaskPatch): LswDailyTask {
  const dayStatusDetails = applyDayStatusPatch(task, patch);
  const dayStatuses = {
    ...task.dayStatuses,
    ...patch.dayStatuses
  };
  const days = patch.days ? { ...task.days, ...patch.days } : task.days;

  return {
    ...task,
    ...patch,
    days,
    dayStatusDetails,
    dayStatuses: getMergedDayStatuses(dayStatusDetails, dayStatuses),
    minutes: patch.minutes ?? task.minutes,
    sortOrder: patch.sortOrder ?? task.sortOrder,
    task: patch.task ?? task.task,
    time: patch.time ?? task.time
  };
}

function getSavedPatch(savedTask: LswDailyTask, requestedPatch: LswDailyTaskPatch): LswDailyTaskPatch {
  const savedPatch: LswDailyTaskPatch = {};

  if (requestedPatch.days || requestedPatch.dayStatusUpdates) {
    savedPatch.days = savedTask.days;
    savedPatch.dayStatusDetails = savedTask.dayStatusDetails;
    savedPatch.dayStatuses = savedTask.dayStatuses;
  }

  if (requestedPatch.minutes !== undefined) {
    savedPatch.minutes = savedTask.minutes;
  }

  if (requestedPatch.sortOrder !== undefined) {
    savedPatch.sortOrder = savedTask.sortOrder;
  }

  if (requestedPatch.task !== undefined) {
    savedPatch.task = savedTask.task;
  }

  if (requestedPatch.time !== undefined) {
    savedPatch.time = savedTask.time;
  }

  return savedPatch;
}

function applyDayStatusPatch(task: LswDailyTask, patch: LswDailyTaskPatch): LswDailyTask['dayStatusDetails'] {
  const nextDetails = {
    ...task.dayStatusDetails,
    ...patch.dayStatusDetails
  };

  if (!patch.dayStatusUpdates) {
    return nextDetails;
  }

  allDays.forEach((day) => {
    const update = patch.dayStatusUpdates?.[day.key];

    if (!update) {
      return;
    }

    const currentDetail = nextDetails[day.key] || {
      completionTiming: 'not_completed',
      completionWindowHours: COMPLETION_WINDOW_HOURS,
      firstCompletedOnTime: false,
      status: 'not_completed' as LswDayStatus
    };
    const dueAtIso = update.dueAtIso || currentDetail.dueAtIso;
    const timeZone = update.timeZone || currentDetail.timeZone || getBrowserTimeZone();
    const completedAtIso = update.completedAtIso || new Date().toISOString();
    const status = getLocalCompletionStatus({
      completedAtIso,
      dueAtIso,
      firstCompletedOnTimeAlready: currentDetail.firstCompletedOnTime === true,
      requestedStatus: update.status
    });
    const firstCompletedAtIso = currentDetail.firstCompletedAtIso || completedAtIso;
    const completedAtForLabels = currentDetail.firstCompletedOnTime ? firstCompletedAtIso : completedAtIso;
    const firstCompletedOnTime = currentDetail.firstCompletedOnTime || status === 'completed_on_time';
    const nextDetail = {
      ...currentDetail,
      dueAtIso,
      firstCompletedOnTime,
      lastChangedAtIso: new Date().toISOString(),
      status,
      timeZone
    };

    if (update.status === 'not_completed') {
      nextDetails[day.key] = {
        dueAtIso: nextDetail.dueAtIso,
        completionTiming: 'not_completed',
        completionWindowHours: COMPLETION_WINDOW_HOURS,
        firstCompletedAtIso: currentDetail.firstCompletedAtIso,
        firstCompletedOnTime: currentDetail.firstCompletedOnTime,
        lastChangedAtIso: nextDetail.lastChangedAtIso,
        status: 'not_completed',
        timeZone: nextDetail.timeZone,
        uncheckedAtIso: nextDetail.lastChangedAtIso
      };
      return;
    }

    nextDetails[day.key] = {
      ...nextDetail,
      completedAtIso: completedAtForLabels,
      ...getLocalCompletionMetadata(status, completedAtForLabels, dueAtIso, task.weekKey, timeZone),
      firstCompletedAtIso
    };
  });

  return nextDetails;
}

function getMergedDayStatuses(
  details: LswDailyTask['dayStatusDetails'],
  fallback: Partial<Record<DayKey, LswDayStatus>>
): Record<DayKey, LswDayStatus> {
  const statuses = {} as Record<DayKey, LswDayStatus>;

  allDays.forEach((day) => {
    statuses[day.key] = details[day.key]?.status || fallback[day.key] || 'not_completed';
  });

  return statuses;
}

function getTaskDayStatus(task: LswDailyTask, dayKey: DayKey): LswDayStatus {
  return task.dayStatuses?.[dayKey] || task.dayStatusDetails?.[dayKey]?.status || (task.days[dayKey] ? 'completed_on_time' : 'not_completed');
}

function getNextDayStatus(task: LswDailyTask, dayKey: DayKey, selectedWeekBeginning?: string): LswDayStatus {
  const currentStatus = getTaskDayStatus(task, dayKey);

  if (currentStatus !== 'not_completed') {
    return 'not_completed';
  }

  if (task.dayStatusDetails?.[dayKey]?.firstCompletedOnTime) {
    return 'completed_on_time';
  }

  const dueDate = getTaskDueDate(selectedWeekBeginning, dayKey, task.time);
  const nowMs = new Date().getTime();

  if (dueDate && nowMs < dueDate.getTime() - COMPLETION_WINDOW_MS) {
    return 'completed_early';
  }

  if (dueDate && nowMs > dueDate.getTime() + COMPLETION_WINDOW_MS) {
    return 'completed_late';
  }

  return 'completed_on_time';
}

const dayOffsets: Record<DayKey, number> = {
  fri: 4,
  mon: 0,
  sat: 5,
  sun: 6,
  thu: 3,
  tue: 1,
  wed: 2
};
const COMPLETION_WINDOW_HOURS = 24;
const COMPLETION_WINDOW_MS = COMPLETION_WINDOW_HOURS * 60 * 60 * 1000;

function getTaskDueDate(selectedWeekBeginning: string | undefined, dayKey: DayKey, time: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(selectedWeekBeginning || '');
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);

  if (!dateMatch || !timeMatch) {
    return null;
  }

  const dueDate = new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    0,
    0
  );

  dueDate.setDate(dueDate.getDate() + dayOffsets[dayKey]);

  return dueDate;
}

function getLocalCompletionStatus(input: {
  completedAtIso: string;
  dueAtIso?: string;
  firstCompletedOnTimeAlready: boolean;
  requestedStatus: LswDayStatus;
}): LswDayStatus {
  if (input.firstCompletedOnTimeAlready) {
    return 'completed_on_time';
  }

  const completedAtMs = Date.parse(input.completedAtIso);
  const dueAtMs = input.dueAtIso ? Date.parse(input.dueAtIso) : Number.NaN;

  if (Number.isFinite(completedAtMs) && Number.isFinite(dueAtMs)) {
    const offsetMs = completedAtMs - dueAtMs;

    if (offsetMs < -COMPLETION_WINDOW_MS) {
      return 'completed_early';
    }

    if (offsetMs > COMPLETION_WINDOW_MS) {
      return 'completed_late';
    }

    return 'completed_on_time';
  }

  if (input.requestedStatus === 'completed_early' || input.requestedStatus === 'completed_late') {
    return input.requestedStatus;
  }

  return 'completed_on_time';
}

function getLocalCompletionMetadata(
  status: LswDayStatus,
  completedAtIso: string,
  dueAtIso: string | undefined,
  weekKey: string,
  timeZone: string
): Pick<
  LswDailyTask['dayStatusDetails'][DayKey],
  | 'completedAtDayLabel'
  | 'completedAtTimeLabel'
  | 'completedWeekKey'
  | 'completedWeekLabel'
  | 'completionOffsetMinutes'
  | 'completionTiming'
  | 'completionWindowHours'
> {
  const completedAt = new Date(completedAtIso);
  const metadata: Pick<
    LswDailyTask['dayStatusDetails'][DayKey],
    | 'completedAtDayLabel'
    | 'completedAtTimeLabel'
    | 'completedWeekKey'
    | 'completedWeekLabel'
    | 'completionOffsetMinutes'
    | 'completionTiming'
    | 'completionWindowHours'
  > = {
    completedWeekKey: weekKey,
    completedWeekLabel: formatCompletionWeekLabel(weekKey, dueAtIso || completedAtIso),
    completionTiming: getCompletionTimingForStatus(status),
    completionWindowHours: COMPLETION_WINDOW_HOURS
  };

  if (!Number.isNaN(completedAt.getTime())) {
    metadata.completedAtDayLabel = formatCompletionDatePart(completedAt, timeZone, {
      day: 'numeric',
      month: 'short',
      weekday: 'long',
      year: 'numeric'
    });
    metadata.completedAtTimeLabel = formatCompletionDatePart(completedAt, timeZone, {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  const completedAtMs = Date.parse(completedAtIso);
  const dueAtMs = dueAtIso ? Date.parse(dueAtIso) : Number.NaN;

  if (Number.isFinite(completedAtMs) && Number.isFinite(dueAtMs)) {
    metadata.completionOffsetMinutes = Math.round((completedAtMs - dueAtMs) / 60000);
  }

  return metadata;
}

function getCompletionTimingForStatus(status: LswDayStatus): LswDailyTask['dayStatusDetails'][DayKey]['completionTiming'] {
  if (status === 'completed_on_time') {
    return 'within_window';
  }

  if (status === 'completed_late') {
    return 'late';
  }

  if (status === 'completed_early') {
    return 'early';
  }

  return 'not_completed';
}

function getCompletionHintPrefix(
  detail: LswDailyTask['dayStatusDetails'][DayKey] | undefined,
  fallbackWeekKey: string,
  selectedWeekBeginning?: string
): string {
  const completedAtIso = detail?.completedAtIso || detail?.firstCompletedAtIso || '';
  const timeZone = detail?.timeZone || getBrowserTimeZone();
  const completedAt = new Date(completedAtIso);
  const timeLabel = detail?.completedAtTimeLabel || (
    Number.isNaN(completedAt.getTime())
      ? 'the recorded time'
      : formatCompletionDatePart(completedAt, timeZone, { hour: 'numeric', minute: '2-digit' })
  );
  const dayLabel = detail?.completedAtDayLabel || (
    Number.isNaN(completedAt.getTime())
      ? 'the recorded day'
      : formatCompletionDatePart(completedAt, timeZone, {
        day: 'numeric',
        month: 'short',
        weekday: 'long',
        year: 'numeric'
      })
  );
  const weekLabel = formatCompletionWeekLabel(
    detail?.completedWeekKey || fallbackWeekKey,
    selectedWeekBeginning || detail?.dueAtIso || detail?.completedAtIso
  ) || detail?.completedWeekLabel || 'Selected week';

  return `Completed at ${timeLabel} on ${dayLabel}. ${weekLabel}.`;
}

function formatCompletionWeekLabel(weekKey: string, displayDateIso?: string): string {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(weekKey);

  if (!match) {
    return weekKey || 'Selected week';
  }

  return `Week ${Number(match[2])}, ${getIsoYear(displayDateIso) || match[1]}`;
}

function getIsoYear(value?: string): string | null {
  const match = /^(\d{4})-/.exec(value || '');

  return match?.[1] || null;
}

function formatCompletionDatePart(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      ...options,
      timeZone
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      ...options,
      timeZone: 'UTC'
    }).format(date);
  }
}

function getBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function getDayStatusClassName(status: LswDayStatus): string {
  if (status === 'completed_on_time') {
    return 'is-yes';
  }

  if (status === 'completed_late') {
    return 'is-late';
  }

  if (status === 'completed_early') {
    return 'is-early';
  }

  return 'is-no';
}

function getDayStatusLabel(status: LswDayStatus): string {
  if (status === 'completed_on_time') {
    return 'completed on time';
  }

  if (status === 'completed_late') {
    return 'completed late';
  }

  if (status === 'completed_early') {
    return 'completed early';
  }

  return 'not completed';
}

function getDayStatusHint(task: LswDailyTask, dayKey: DayKey, selectedWeekBeginning?: string): string {
  const status = getTaskDayStatus(task, dayKey);
  const detail = task.dayStatusDetails?.[dayKey];

  if (status === 'completed_on_time') {
    return `${getCompletionHintPrefix(detail, task.weekKey, selectedWeekBeginning)} Finished within the 24-hour schedule window.`;
  }

  if (status === 'completed_late') {
    return `${getCompletionHintPrefix(detail, task.weekKey, selectedWeekBeginning)} Marked more than 24 hours after the scheduled time.`;
  }

  if (status === 'completed_early') {
    return `${getCompletionHintPrefix(detail, task.weekKey, selectedWeekBeginning)} Marked more than 24 hours before the scheduled time.`;
  }

  return 'This task still needs to be completed.';
}

function sortDailyTasks(first: LswDailyTask, second: LswDailyTask): number {
  return first.sortOrder - second.sortOrder || first.task.localeCompare(second.task);
}

function getDayKeyFromIso(isoDate?: string): DayKey | null {
  if (!isoDate) {
    return null;
  }

  const date = new Date(`${isoDate}T00:00:00Z`);
  const dayIndex = date.getUTCDay();
  const dayKeysByIndex: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  return dayKeysByIndex[dayIndex] || null;
}

function parseTimeParts(value: string): { hour: number; minute: number } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);

  if (!match) {
    return { hour: 8, minute: 0 };
  }

  return {
    hour: Number(match[1]),
    minute: Number(match[2])
  };
}

function padTwo(value: number): string {
  return value.toString().padStart(2, '0');
}

function parseLocalDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatLocalDateOnly(date: Date): string {
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`;
}

function getCurrentLocalTime(): string {
  const now = new Date();

  return `${padTwo(now.getHours())}:${padTwo(now.getMinutes())}`;
}

function formatMonthDayFromDateOnly(value: string): string {
  return formatMonthDay(parseLocalDateOnly(value) || new Date());
}

function formatMonthDayYearFromDateOnly(value: string): string {
  return formatMonthDayYear(parseLocalDateOnly(value) || new Date());
}

function formatMonthDay(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short'
  }).format(date);
}

function formatMonthDayYear(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

function formatTimeFromTaskTime(value: string): string {
  const time = parseTimeParts(value);
  const date = new Date();

  date.setHours(time.hour, time.minute, 0, 0);

  return formatDisplayTime(date);
}

function formatClockDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    weekday: 'long'
  }).format(date);
}

function formatClockTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
}

function formatDisplayTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function BlackDivider() {
  return <div aria-hidden="true" className="lsw-section-gap" />;
}

function DragHandle() {
  return (
    <svg aria-hidden="true" className="lsw-drag-handle" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

function PrinterIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2m2 4h6a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2Zm8-12V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4h10Z" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m15 19-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 5 7 7-7 7" />
    </svg>
  );
}

function PlusMiniIcon() {
  return (
    <svg aria-hidden="true" className="lsw-mini-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg aria-hidden="true" className="lsw-mini-icon lsw-x-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="m5 13 4 4L19 7" />
    </svg>
  );
}

function StyleIcon() {
  return (
    <svg aria-hidden="true" className="lsw-mini-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 0 1-4-4V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v12a4 4 0 0 1-4 4Zm0 0h12a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-2.3M11 7.3l1.7-1.6a2 2 0 0 1 2.8 0l2.8 2.8a2 2 0 0 1 0 2.8l-8.5 8.5M7 17h.01" />
    </svg>
  );
}

function AlertTriangleIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.3 4.3 2.8 17.4A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.6L13.7 4.3a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}
