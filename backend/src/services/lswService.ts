import { randomUUID } from 'node:crypto';
import { DecodedIdToken } from 'firebase-admin/auth';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import { SynzappRole } from '../types/auth.js';
import { buildAuthSession } from './authSessionService.js';
import {
  HUMAN_RESOURCES_DEPARTMENT_ID,
  HUMAN_RESOURCES_DEPARTMENT_NAME
} from './tenantDefaults.js';

interface OrganizationRecord {
  calendarYear?: {
    startDate?: string;
    startDay?: number;
    startMonth?: number;
    startYear?: number;
    weekOneStartsOn?: string;
  };
  companyName?: string;
  status?: string;
  tenantId?: string;
}

interface TenantUserRecord {
  departmentId?: string | null;
  departmentName?: string | null;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  role?: SynzappRole;
  roleName?: string;
  status?: string;
  tenantId?: string;
}

interface TenantDepartmentRecord {
  departmentId?: string;
  name?: string;
  status?: string;
  tenantId?: string;
}

interface LswProfileRecord {
  companyId?: string;
  departmentId?: string | null;
  departmentName?: string | null;
  lswId?: string;
  ownerUid?: string;
  status?: string;
  tenantId?: string;
  workDaysPerWeek?: number;
}

interface LswDailyTaskRecord {
  companyId?: string;
  days?: Partial<Record<DayKey, boolean>>;
  departmentId?: string | null;
  departmentName?: string | null;
  lswId?: string;
  minutes?: number;
  ownerUid?: string;
  sectionKey?: string;
  sortOrder?: number;
  status?: string;
  task?: string;
  taskId?: string;
  tenantId?: string;
  time?: string;
}

interface LswTodoTaskRecord {
  companyId?: string;
  completed?: boolean;
  completedAtIso?: string;
  completedDateLabel?: string;
  completedTimeLabel?: string;
  departmentId?: string | null;
  departmentName?: string | null;
  dueDate?: string;
  dueTime?: string;
  lswId?: string;
  ownerUid?: string;
  sectionKey?: string;
  sortOrder?: number;
  status?: string;
  task?: string;
  taskId?: string;
  tenantId?: string;
  timeZone?: string;
  weekKey?: string;
}

interface LswMeetingRailRecord {
  companyId?: string;
  completed?: boolean;
  departmentId?: string | null;
  departmentName?: string | null;
  dueDate?: string;
  dueTime?: string;
  lswId?: string;
  ownerUid?: string;
  rail?: string;
  railId?: string;
  sectionKey?: string;
  sortOrder?: number;
  status?: string;
  tenantId?: string;
  timeZone?: string;
  weekKey?: string;
}

interface LswPersonalGoalRecord {
  companyId?: string;
  departmentId?: string | null;
  departmentName?: string | null;
  dueDate?: string;
  goalId?: string;
  lswId?: string;
  objective?: string;
  ownerUid?: string;
  progress?: number;
  sectionKey?: string;
  sortOrder?: number;
  startedAtIso?: string;
  startedDateLabel?: string;
  status?: string;
  tenantId?: string;
  timeZone?: string;
}

interface LswFollowUpRecord {
  comments?: string;
  companyId?: string;
  departmentId?: string | null;
  departmentName?: string | null;
  dueDate?: string;
  followUp?: string;
  followUpId?: string;
  lswId?: string;
  ownerUid?: string;
  responsible?: string;
  sectionKey?: string;
  sortOrder?: number;
  status?: string;
  tenantId?: string;
  timeZone?: string;
}

interface LswRcaTriggerRecord {
  comments?: string;
  companyId?: string;
  departmentId?: string | null;
  departmentName?: string | null;
  eventDate?: string;
  lswId?: string;
  ownerUid?: string;
  sectionKey?: string;
  sortOrder?: number;
  status?: string;
  tenantId?: string;
  timeZone?: string;
  trigger?: string;
  triggerId?: string;
}

interface LswImprovementProjectUpdateRecord {
  sortOrder?: number;
  status?: string;
  text?: string;
  updateId?: string;
}

interface LswImprovementProjectRecord {
  companyId?: string;
  departmentId?: string | null;
  departmentName?: string | null;
  lswId?: string;
  ownerUid?: string;
  project?: string;
  projectId?: string;
  sectionKey?: string;
  sortOrder?: number;
  status?: string;
  tenantId?: string;
  updates?: LswImprovementProjectUpdateRecord[];
}

interface LswScheduledTaskRecord {
  companyId?: string;
  departmentId?: string | null;
  departmentName?: string | null;
  dueDate?: string;
  frequency?: string;
  lswId?: string;
  minutes?: number;
  ownerUid?: string;
  sectionKey?: string;
  sortOrder?: number;
  status?: string;
  task?: string;
  taskId?: string;
  tenantId?: string;
  timeZone?: string;
}

interface LswDailyTaskWeekStatusRecord {
  companyId?: string;
  days?: Partial<Record<DayKey, boolean>>;
  dayStatuses?: Partial<Record<DayKey, Partial<LswDayStatusDetail>>>;
  departmentId?: string | null;
  departmentName?: string | null;
  lswId?: string;
  ownerUid?: string;
  sectionKey?: string;
  status?: string;
  taskId?: string;
  tenantId?: string;
  weekKey?: string;
}

interface CalendarYearSettings {
  startDate: string;
  startDay: number;
  startMonth: number;
  startYear: number;
  weekOneStartsOn: string;
}

interface LswContextInput {
  timeZone?: string;
  week?: number;
  year?: number;
}

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type LswDayStatus = 'not_completed' | 'completed_on_time' | 'completed_late' | 'completed_early';
export type LswDayCompletionTiming = 'not_completed' | 'within_window' | 'late' | 'early';
export type LswScheduledTaskFrequency = 'BI_WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';

export interface LswContextResponse {
  calendar: {
    startDate: string;
    startDateLabel: string;
    startDay: number;
    startMonth: number;
    startYear: number;
    weekOneStartsOn: string;
  };
  company: {
    companyName: string;
    tenantId: string;
  };
  department: {
    departmentId: string | null;
    name: string;
    status: string;
  };
  storageScope: {
    departmentId: string | null;
    tenantId: string;
    weekKey: string;
  };
  settings: {
    workDaysPerWeek: number;
  };
  user: {
    displayName: string;
    role: SynzappRole;
    roleName: string;
    uid: string;
  };
  week: {
    currentWeek: number;
    currentYear: number;
    isCurrentWeek: boolean;
    previewRows: LswWeekPreviewRow[];
    selectedWeek: number;
    selectedYear: number;
    todayIso: string;
    todayLabel: string;
    totalWeeksInYear: number;
    weekBeginning: string;
    weekBeginningLabel: string;
    weekEnding: string;
    weekEndingLabel: string;
  };
}

export interface LswWeekPreviewRow {
  endDate: string;
  endDateLabel: string;
  startDate: string;
  startDateLabel: string;
  week: number;
}

export interface LswDailyTask {
  days: Record<DayKey, boolean>;
  dayStatusDetails: Record<DayKey, LswDayStatusDetail>;
  dayStatuses: Record<DayKey, LswDayStatus>;
  minutes: number;
  sortOrder: number;
  status: string;
  task: string;
  taskId: string;
  time: string;
  weekKey: string;
}

export interface LswDailyTasksResponse {
  tasks: LswDailyTask[];
  weekKey: string;
  workDaysPerWeek: number;
}

export interface LswDailyTaskInput {
  days?: Partial<Record<DayKey, boolean>>;
  dayStatusUpdates?: Partial<Record<DayKey, LswDayStatusUpdateInput>>;
  minutes?: number;
  sortOrder?: number;
  task?: string;
  time?: string;
}

export interface LswTodoTask {
  completed: boolean;
  completedAtIso?: string;
  completedDateLabel?: string;
  completedTimeLabel?: string;
  dueDate: string;
  dueTime: string;
  sortOrder: number;
  status: string;
  task: string;
  taskId: string;
  timeZone: string;
  weekKey: string;
}

export interface LswTodoTasksResponse {
  tasks: LswTodoTask[];
  weekKey: string;
}

export interface LswTodoTaskInput {
  completed?: boolean;
  completedAtIso?: string;
  dueDate?: string;
  dueTime?: string;
  sortOrder?: number;
  task?: string;
  timeZone?: string;
}

export interface LswMeetingRail {
  completed: boolean;
  dueDate: string;
  dueTime: string;
  rail: string;
  railId: string;
  sortOrder: number;
  status: string;
  timeZone: string;
  weekKey: string;
}

export interface LswMeetingRailsResponse {
  rails: LswMeetingRail[];
  weekKey: string;
}

export interface LswMeetingRailInput {
  completed?: boolean;
  dueDate?: string;
  dueTime?: string;
  rail?: string;
  sortOrder?: number;
  timeZone?: string;
}

export interface LswPersonalGoal {
  dueDate: string;
  goalId: string;
  objective: string;
  progress: number;
  sortOrder: number;
  startedAtIso?: string;
  startedDateLabel?: string;
  status: string;
  timeZone: string;
}

export interface LswPersonalGoalsResponse {
  goals: LswPersonalGoal[];
}

export interface LswPersonalGoalInput {
  dueDate?: string;
  objective?: string;
  progress?: number;
  sortOrder?: number;
  timeZone?: string;
}

export interface LswFollowUp {
  comments: string;
  dueDate: string;
  followUp: string;
  followUpId: string;
  responsible: string;
  sortOrder: number;
  status: string;
  timeZone: string;
}

export interface LswFollowUpsResponse {
  followUps: LswFollowUp[];
}

export interface LswFollowUpInput {
  comments?: string;
  dueDate?: string;
  followUp?: string;
  responsible?: string;
  sortOrder?: number;
  timeZone?: string;
}

export interface LswRcaTrigger {
  comments: string;
  eventDate: string;
  sortOrder: number;
  status: string;
  timeZone: string;
  trigger: string;
  triggerId: string;
}

export interface LswRcaTriggersResponse {
  triggers: LswRcaTrigger[];
}

export interface LswRcaTriggerInput {
  comments?: string;
  eventDate?: string;
  sortOrder?: number;
  timeZone?: string;
  trigger?: string;
}

export interface LswImprovementProjectUpdate {
  sortOrder: number;
  status: string;
  text: string;
  updateId: string;
}

export interface LswImprovementProject {
  project: string;
  projectId: string;
  sortOrder: number;
  status: string;
  updates: LswImprovementProjectUpdate[];
}

export interface LswImprovementProjectsResponse {
  projects: LswImprovementProject[];
}

export interface LswImprovementProjectUpdateInput {
  sortOrder?: number;
  status?: string;
  text?: string;
  updateId?: string;
}

export interface LswImprovementProjectInput {
  project?: string;
  sortOrder?: number;
  updates?: LswImprovementProjectUpdateInput[];
}

export interface LswScheduledTask {
  dueDate: string;
  frequency: LswScheduledTaskFrequency;
  minutes: number;
  sortOrder: number;
  status: string;
  task: string;
  taskId: string;
  timeZone: string;
}

export interface LswScheduledTasksResponse {
  tasks: LswScheduledTask[];
}

export interface LswScheduledTaskInput {
  dueDate?: string;
  frequency?: LswScheduledTaskFrequency;
  minutes?: number;
  sortOrder?: number;
  task?: string;
  timeZone?: string;
}

export interface LswDayStatusDetail {
  completedAtIso?: string;
  completedAtDayLabel?: string;
  completedAtTimeLabel?: string;
  completedWeekKey?: string;
  completedWeekLabel?: string;
  completionOffsetMinutes?: number;
  completionTiming: LswDayCompletionTiming;
  completionWindowHours: number;
  dueAtIso?: string;
  firstCompletedAtIso?: string;
  firstCompletedOnTime: boolean;
  lastChangedAtIso?: string;
  status: LswDayStatus;
  timeZone?: string;
  uncheckedAtIso?: string;
}

export interface LswDayStatusUpdateInput {
  completedAtIso?: string;
  dueAtIso?: string;
  status: LswDayStatus;
  timeZone?: string;
}

export interface LswSettingsInput {
  workDaysPerWeek: number;
}

interface AuthorizedLswContext {
  department: LswContextResponse['department'];
  lswProfile: LswProfileRecord & {
    lswId: string;
    ownerUid: string;
    status: string;
    tenantId: string;
    workDaysPerWeek: number;
  };
  lswProfileRef: FirebaseFirestore.DocumentReference;
  organization: OrganizationRecord;
  organizationRef: FirebaseFirestore.DocumentReference;
  role: SynzappRole;
  tenantId: string;
  user: TenantUserRecord;
  uid: string;
}

const LSW_PROFILE_COLLECTION = 'lswProfiles';
const LSW_DAILY_TASKS_COLLECTION = 'dailyWeeklyTasks';
const LSW_DAILY_TASK_WEEK_STATUSES_COLLECTION = 'weekStatuses';
const LSW_TODO_TASKS_COLLECTION = 'todoTasks';
const LSW_MEETING_RAILS_COLLECTION = 'meetingRails';
const LSW_PERSONAL_GOALS_COLLECTION = 'personalGoals';
const LSW_FOLLOW_UPS_COLLECTION = 'followUps';
const LSW_RCA_TRIGGERS_COLLECTION = 'rcaTriggers';
const LSW_IMPROVEMENT_PROJECTS_COLLECTION = 'improvementProjects';
const LSW_SCHEDULED_TASKS_COLLECTION = 'scheduledTasksMeetings';
const DAILY_TASK_SECTION_KEY = 'daily_weekly_standard_tasks';
const TODO_TASK_SECTION_KEY = 'to_do_today_this_week';
const MEETING_RAIL_SECTION_KEY = 'level_1_2_3_meeting_rails';
const PERSONAL_GOAL_SECTION_KEY = 'personal_objectives_goals';
const FOLLOW_UP_SECTION_KEY = 'follow_ups';
const RCA_TRIGGER_SECTION_KEY = 'plant_specific_cause_rca_triggers';
const IMPROVEMENT_PROJECT_SECTION_KEY = 'improvement_projects_updates';
const SCHEDULED_TASK_SECTION_KEY = 'scheduled_tasks_meetings';
const DEFAULT_WORK_DAYS_PER_WEEK = 5;
const COMPLETION_WINDOW_HOURS = 24;
const COMPLETION_WINDOW_MS = COMPLETION_WINDOW_HOURS * 60 * 60 * 1000;
const ALL_DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const SCHEDULED_TASK_FREQUENCIES: LswScheduledTaskFrequency[] = ['BI_WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY'];
const DEFAULT_DAILY_TASKS: LswDailyTaskInput[] = [
  {
    minutes: 15,
    sortOrder: 1000,
    task: 'Review line readiness, staffing, and handoff notes',
    time: '07:30'
  },
  {
    minutes: 30,
    sortOrder: 2000,
    task: 'Gemba walk: safety, quality, people, delivery, and cost checks',
    time: '08:15'
  },
  {
    minutes: 20,
    sortOrder: 3000,
    task: 'Daily production review with supervisors',
    time: '09:00'
  },
  {
    minutes: 10,
    sortOrder: 4000,
    task: 'Verify open corrective actions and overdue follow-ups',
    time: '13:30'
  }
];

export async function getLswContext(
  decodedToken: DecodedIdToken,
  input: LswContextInput = {}
): Promise<LswContextResponse> {
  const context = await getAuthorizedLswContext(decodedToken);
  const calendar = mapCalendarYearSettings(context.organization);
  const week = calculateCalendarWeekContext(calendar, input);

  return {
    calendar: {
      startDate: calendar.startDate,
      startDateLabel: formatLongDate(parseDateOnly(calendar.startDate)),
      startDay: calendar.startDay,
      startMonth: calendar.startMonth,
      startYear: calendar.startYear,
      weekOneStartsOn: calendar.weekOneStartsOn
    },
    company: {
      companyName: context.organization.companyName || 'Your organization',
      tenantId: context.tenantId
    },
    department: context.department,
    storageScope: {
      departmentId: context.department.departmentId,
      tenantId: context.tenantId,
      weekKey: formatWeekKey(week.selectedYear, week.selectedWeek)
    },
    settings: {
      workDaysPerWeek: context.lswProfile.workDaysPerWeek
    },
    user: {
      displayName: getDisplayName(context.user),
      role: context.role,
      roleName: formatRoleName(context.user.roleName, context.role),
      uid: decodedToken.uid
    },
    week
  };
}

export async function listLswDailyTasks(
  decodedToken: DecodedIdToken,
  input: LswContextInput = {}
): Promise<LswDailyTasksResponse> {
  const context = await getAuthorizedLswContext(decodedToken);
  const calendar = mapCalendarYearSettings(context.organization);
  const week = calculateCalendarWeekContext(calendar, input);
  const weekKey = formatWeekKey(week.selectedYear, week.selectedWeek);

  await seedDefaultDailyTasksIfEmpty(context);

  const snapshot = await context.lswProfileRef
    .collection(LSW_DAILY_TASKS_COLLECTION)
    .orderBy('sortOrder', 'asc')
    .get();
  const activeTaskDocs = snapshot.docs
    .map((doc) => ({
      record: doc.data() as LswDailyTaskRecord,
      ref: doc.ref,
      taskId: doc.id
    }))
    .filter(({ record }) => (record.status || 'ACTIVE') === 'ACTIVE');
  const weeklyStatuses = await getDailyTaskWeekStatuses(context, activeTaskDocs, weekKey);
  const tasks = activeTaskDocs.map(({ record, taskId }) => (
    mapDailyTask(taskId, record, weeklyStatuses.get(taskId), weekKey)
  ));

  return {
    tasks,
    weekKey,
    workDaysPerWeek: context.lswProfile.workDaysPerWeek
  };
}

export async function createLswDailyTask(
  decodedToken: DecodedIdToken,
  input: LswDailyTaskInput = {},
  weekInput: LswContextInput = {}
): Promise<LswDailyTask> {
  const context = await getAuthorizedLswContext(decodedToken);
  const taskRef = context.lswProfileRef.collection(LSW_DAILY_TASKS_COLLECTION).doc();
  const sortOrder = input.sortOrder ?? await getNextDailyTaskSortOrder(context);
  const record = buildDailyTaskRecord(context, taskRef.id, {
    minutes: input.minutes ?? 0,
    sortOrder,
    task: input.task ?? '',
    time: input.time || '08:00'
  });

  await taskRef.set({
    ...record,
    createdAt: fieldValue.serverTimestamp(),
    updatedAt: fieldValue.serverTimestamp()
  });

  if (input.days || input.dayStatusUpdates) {
    const weekKey = resolveWeekKey(context, weekInput);
    const weeklyStatusDetails = await setDailyTaskWeekStatusDetails(
      context,
      taskRef,
      taskRef.id,
      weekKey,
      getEmptyDayStatusDetails(),
      input
    );

    return mapDailyTask(taskRef.id, record, {
      dayStatuses: weeklyStatusDetails,
      days: getDaysFromDayStatusDetails(weeklyStatusDetails)
    }, weekKey);
  }

  return mapDailyTask(taskRef.id, record);
}

export async function updateLswDailyTask(
  decodedToken: DecodedIdToken,
  taskId: string,
  input: LswDailyTaskInput,
  weekInput: LswContextInput = {}
): Promise<LswDailyTask> {
  const context = await getAuthorizedLswContext(decodedToken);
  const taskRef = context.lswProfileRef.collection(LSW_DAILY_TASKS_COLLECTION).doc(taskId);
  const snapshot = await taskRef.get();

  if (!snapshot.exists) {
    throw notFoundError('This LSW task was not found.');
  }

  const existingRecord = snapshot.data() as LswDailyTaskRecord;

  assertTaskBelongsToContext(existingRecord, context);

  if (existingRecord.status && existingRecord.status !== 'ACTIVE') {
    throw notFoundError('This LSW task was not found.');
  }

  let taskNeedsUpdate = false;
  let weeklyStatusDetails = getEmptyDayStatusDetails();
  const weekKey = resolveWeekKey(context, weekInput);
  const existingWeeklyStatusDetails = await getDailyTaskWeekStatusDetails(context, taskRef, taskId, weekKey);
  const update: Record<string, unknown> = {};

  if (input.minutes !== undefined) {
    update.minutes = normalizeMinutes(input.minutes);
    taskNeedsUpdate = true;
  }

  if (input.sortOrder !== undefined) {
    update.sortOrder = normalizeSortOrder(input.sortOrder);
    taskNeedsUpdate = true;
  }

  if (input.task !== undefined) {
    update.task = input.task.trim();
    taskNeedsUpdate = true;
  }

  if (input.time !== undefined) {
    update.time = normalizeTaskTime(input.time);
    taskNeedsUpdate = true;
  }

  if (input.days || input.dayStatusUpdates) {
    weeklyStatusDetails = await setDailyTaskWeekStatusDetails(
      context,
      taskRef,
      taskId,
      weekKey,
      existingWeeklyStatusDetails,
      input
    );
  } else {
    weeklyStatusDetails = existingWeeklyStatusDetails;
  }

  if (taskNeedsUpdate) {
    await taskRef.set({
      ...update,
      departmentId: context.department.departmentId,
      departmentName: context.department.name,
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });
  }

  const refreshedSnapshot = taskNeedsUpdate ? await taskRef.get() : snapshot;

  return mapDailyTask(taskId, refreshedSnapshot.data() as LswDailyTaskRecord, {
    dayStatuses: weeklyStatusDetails,
    days: getDaysFromDayStatusDetails(weeklyStatusDetails)
  }, weekKey);
}

export async function deleteLswDailyTask(
  decodedToken: DecodedIdToken,
  taskId: string
): Promise<void> {
  const context = await getAuthorizedLswContext(decodedToken);
  const taskRef = context.lswProfileRef.collection(LSW_DAILY_TASKS_COLLECTION).doc(taskId);
  const snapshot = await taskRef.get();

  if (!snapshot.exists) {
    throw notFoundError('This LSW task was not found.');
  }

  const record = snapshot.data() as LswDailyTaskRecord;

  assertTaskBelongsToContext(record, context);

  await taskRef.set({
    deletedAt: fieldValue.serverTimestamp(),
    deletedByUid: decodedToken.uid,
    status: 'DELETED',
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });
}

export async function listLswTodoTasks(
  decodedToken: DecodedIdToken,
  weekInput: LswContextInput = {}
): Promise<LswTodoTasksResponse> {
  const context = await getAuthorizedLswContext(decodedToken);
  const weekKey = resolveWeekKey(context, weekInput);
  const currentWeekKey = resolveWeekKey(context);
  const snapshot = await context.lswProfileRef
    .collection(LSW_TODO_TASKS_COLLECTION)
    .orderBy('sortOrder', 'asc')
    .get();
  const tasks = snapshot.docs
    .map((doc) => ({ id: doc.id, record: doc.data() as LswTodoTaskRecord }))
    .filter(({ record }) => isWeekScopedRecordVisible(record.weekKey, weekKey, currentWeekKey))
    .map(({ id, record }) => mapTodoTask(id, record, weekKey))
    .filter((task) => task.status === 'ACTIVE');

  return { tasks, weekKey };
}

export async function createLswTodoTask(
  decodedToken: DecodedIdToken,
  input: LswTodoTaskInput = {},
  weekInput: LswContextInput = {}
): Promise<LswTodoTask> {
  const context = await getAuthorizedLswContext(decodedToken);
  const weekKey = resolveWeekKey(context, weekInput);
  const taskRef = context.lswProfileRef.collection(LSW_TODO_TASKS_COLLECTION).doc();
  const sortOrder = input.sortOrder ?? await getNextTodoTaskSortOrder(context, weekKey);
  const now = new Date();
  const record = buildTodoTaskRecord(context, taskRef.id, {
    dueDate: input.dueDate || formatLocalDateOnly(now),
    dueTime: input.dueTime || formatLocalTime(now),
    sortOrder,
    task: input.task ?? '',
    timeZone: input.timeZone
  }, weekKey);

  await taskRef.set({
    ...record,
    createdAt: fieldValue.serverTimestamp(),
    updatedAt: fieldValue.serverTimestamp()
  });

  return mapTodoTask(taskRef.id, record, weekKey);
}

export async function updateLswTodoTask(
  decodedToken: DecodedIdToken,
  taskId: string,
  input: LswTodoTaskInput
): Promise<LswTodoTask> {
  const context = await getAuthorizedLswContext(decodedToken);
  const taskRef = context.lswProfileRef.collection(LSW_TODO_TASKS_COLLECTION).doc(taskId);
  const snapshot = await taskRef.get();

  if (!snapshot.exists) {
    throw notFoundError('This LSW to-do item was not found.');
  }

  const existingRecord = snapshot.data() as LswTodoTaskRecord;

  assertTodoTaskBelongsToContext(existingRecord, context);

  if (existingRecord.status && existingRecord.status !== 'ACTIVE') {
    throw notFoundError('This LSW to-do item was not found.');
  }

  const update: Record<string, unknown> = {
    departmentId: context.department.departmentId,
    departmentName: context.department.name,
    updatedAt: fieldValue.serverTimestamp()
  };

  if (input.dueDate !== undefined) {
    update.dueDate = normalizeTodoDueDate(input.dueDate);
  }

  if (input.dueTime !== undefined) {
    update.dueTime = normalizeTaskTime(input.dueTime);
  }

  if (input.sortOrder !== undefined) {
    update.sortOrder = normalizeSortOrder(input.sortOrder);
  }

  if (input.task !== undefined) {
    update.task = input.task.trim();
  }

  if (input.timeZone !== undefined) {
    update.timeZone = normalizeTimeZone(input.timeZone);
  }

  if (input.completed !== undefined) {
    if (input.completed) {
      const completedAtIso = normalizeCompletedAtIso(input.completedAtIso) || new Date().toISOString();
      const timeZone = normalizeTimeZone(input.timeZone || existingRecord.timeZone);
      const completedAt = new Date(completedAtIso);

      update.completed = true;
      update.completedAtIso = completedAtIso;
      update.completedDateLabel = formatMonthDayLabel(completedAt, timeZone);
      update.completedTimeLabel = formatTimeLabel(completedAt, timeZone);
      update.timeZone = timeZone;
    } else {
      update.completed = false;
      update.completedAtIso = fieldValue.delete();
      update.completedDateLabel = fieldValue.delete();
      update.completedTimeLabel = fieldValue.delete();
    }
  }

  await taskRef.set(update, { merge: true });

  const refreshedSnapshot = await taskRef.get();

  return mapTodoTask(taskId, refreshedSnapshot.data() as LswTodoTaskRecord);
}

export async function deleteLswTodoTask(
  decodedToken: DecodedIdToken,
  taskId: string
): Promise<void> {
  const context = await getAuthorizedLswContext(decodedToken);
  const taskRef = context.lswProfileRef.collection(LSW_TODO_TASKS_COLLECTION).doc(taskId);
  const snapshot = await taskRef.get();

  if (!snapshot.exists) {
    throw notFoundError('This LSW to-do item was not found.');
  }

  const record = snapshot.data() as LswTodoTaskRecord;

  assertTodoTaskBelongsToContext(record, context);

  await taskRef.set({
    deletedAt: fieldValue.serverTimestamp(),
    deletedByUid: decodedToken.uid,
    status: 'DELETED',
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });
}

export async function listLswMeetingRails(
  decodedToken: DecodedIdToken,
  weekInput: LswContextInput = {}
): Promise<LswMeetingRailsResponse> {
  const context = await getAuthorizedLswContext(decodedToken);
  const weekKey = resolveWeekKey(context, weekInput);
  const currentWeekKey = resolveWeekKey(context);
  const snapshot = await context.lswProfileRef
    .collection(LSW_MEETING_RAILS_COLLECTION)
    .orderBy('sortOrder', 'asc')
    .get();
  const rails = snapshot.docs
    .map((doc) => ({ id: doc.id, record: doc.data() as LswMeetingRailRecord }))
    .filter(({ record }) => isWeekScopedRecordVisible(record.weekKey, weekKey, currentWeekKey))
    .map(({ id, record }) => mapMeetingRail(id, record, weekKey))
    .filter((rail) => rail.status === 'ACTIVE');

  return { rails, weekKey };
}

export async function createLswMeetingRail(
  decodedToken: DecodedIdToken,
  input: LswMeetingRailInput = {},
  weekInput: LswContextInput = {}
): Promise<LswMeetingRail> {
  const context = await getAuthorizedLswContext(decodedToken);
  const weekKey = resolveWeekKey(context, weekInput);
  const railRef = context.lswProfileRef.collection(LSW_MEETING_RAILS_COLLECTION).doc();
  const sortOrder = input.sortOrder ?? await getNextMeetingRailSortOrder(context, weekKey);
  const now = new Date();
  const record = buildMeetingRailRecord(context, railRef.id, {
    dueDate: input.dueDate || formatLocalDateOnly(now),
    dueTime: input.dueTime || formatLocalTime(now),
    rail: input.rail ?? '',
    sortOrder,
    timeZone: input.timeZone
  }, weekKey);

  await railRef.set({
    ...record,
    createdAt: fieldValue.serverTimestamp(),
    updatedAt: fieldValue.serverTimestamp()
  });

  return mapMeetingRail(railRef.id, record, weekKey);
}

export async function updateLswMeetingRail(
  decodedToken: DecodedIdToken,
  railId: string,
  input: LswMeetingRailInput
): Promise<LswMeetingRail> {
  const context = await getAuthorizedLswContext(decodedToken);
  const railRef = context.lswProfileRef.collection(LSW_MEETING_RAILS_COLLECTION).doc(railId);
  const snapshot = await railRef.get();

  if (!snapshot.exists) {
    throw notFoundError('This LSW meeting rail was not found.');
  }

  const existingRecord = snapshot.data() as LswMeetingRailRecord;

  assertMeetingRailBelongsToContext(existingRecord, context);

  if (existingRecord.status && existingRecord.status !== 'ACTIVE') {
    throw notFoundError('This LSW meeting rail was not found.');
  }

  const update: Record<string, unknown> = {
    departmentId: context.department.departmentId,
    departmentName: context.department.name,
    updatedAt: fieldValue.serverTimestamp()
  };

  if (input.completed !== undefined) {
    update.completed = input.completed;
  }

  if (input.dueDate !== undefined) {
    update.dueDate = normalizeTodoDueDate(input.dueDate);
  }

  if (input.dueTime !== undefined) {
    update.dueTime = normalizeTaskTime(input.dueTime);
  }

  if (input.rail !== undefined) {
    update.rail = input.rail.trim();
  }

  if (input.sortOrder !== undefined) {
    update.sortOrder = normalizeSortOrder(input.sortOrder);
  }

  if (input.timeZone !== undefined) {
    update.timeZone = normalizeTimeZone(input.timeZone);
  }

  await railRef.set(update, { merge: true });

  const refreshedSnapshot = await railRef.get();

  return mapMeetingRail(railId, refreshedSnapshot.data() as LswMeetingRailRecord);
}

export async function deleteLswMeetingRail(
  decodedToken: DecodedIdToken,
  railId: string
): Promise<void> {
  const context = await getAuthorizedLswContext(decodedToken);
  const railRef = context.lswProfileRef.collection(LSW_MEETING_RAILS_COLLECTION).doc(railId);
  const snapshot = await railRef.get();

  if (!snapshot.exists) {
    throw notFoundError('This LSW meeting rail was not found.');
  }

  const record = snapshot.data() as LswMeetingRailRecord;

  assertMeetingRailBelongsToContext(record, context);

  await railRef.set({
    deletedAt: fieldValue.serverTimestamp(),
    deletedByUid: decodedToken.uid,
    status: 'DELETED',
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });
}

export async function listLswPersonalGoals(decodedToken: DecodedIdToken): Promise<LswPersonalGoalsResponse> {
  const context = await getAuthorizedLswContext(decodedToken);
  const snapshot = await context.lswProfileRef
    .collection(LSW_PERSONAL_GOALS_COLLECTION)
    .orderBy('sortOrder', 'asc')
    .get();
  const goals = snapshot.docs
    .map((doc) => mapPersonalGoal(doc.id, doc.data() as LswPersonalGoalRecord))
    .filter((goal) => goal.status === 'ACTIVE');

  return { goals };
}

export async function createLswPersonalGoal(
  decodedToken: DecodedIdToken,
  input: LswPersonalGoalInput = {}
): Promise<LswPersonalGoal> {
  const context = await getAuthorizedLswContext(decodedToken);
  const goalRef = context.lswProfileRef.collection(LSW_PERSONAL_GOALS_COLLECTION).doc();
  const sortOrder = input.sortOrder ?? await getNextPersonalGoalSortOrder(context);
  const now = new Date();
  const record = buildPersonalGoalRecord(context, goalRef.id, {
    dueDate: input.dueDate || formatLocalDateOnly(now),
    objective: input.objective ?? '',
    progress: input.progress ?? 0,
    sortOrder,
    timeZone: input.timeZone
  });

  await goalRef.set({
    ...record,
    createdAt: fieldValue.serverTimestamp(),
    updatedAt: fieldValue.serverTimestamp()
  });

  return mapPersonalGoal(goalRef.id, record);
}

export async function updateLswPersonalGoal(
  decodedToken: DecodedIdToken,
  goalId: string,
  input: LswPersonalGoalInput
): Promise<LswPersonalGoal> {
  const context = await getAuthorizedLswContext(decodedToken);
  const goalRef = context.lswProfileRef.collection(LSW_PERSONAL_GOALS_COLLECTION).doc(goalId);
  const snapshot = await goalRef.get();

  if (!snapshot.exists) {
    throw notFoundError('This LSW goal was not found.');
  }

  const existingRecord = snapshot.data() as LswPersonalGoalRecord;

  assertPersonalGoalBelongsToContext(existingRecord, context);

  if (existingRecord.status && existingRecord.status !== 'ACTIVE') {
    throw notFoundError('This LSW goal was not found.');
  }

  const existingProgress = normalizeProgress(existingRecord.progress ?? 0);
  const requestedProgress = input.progress === undefined
    ? existingProgress
    : normalizeProgress(input.progress);
  const update: Record<string, unknown> = {
    departmentId: context.department.departmentId,
    departmentName: context.department.name,
    updatedAt: fieldValue.serverTimestamp()
  };

  if (input.dueDate !== undefined) {
    if (requestedProgress > 0) {
      throw validationError('Goal due date is locked while progress is greater than zero.');
    }

    update.dueDate = normalizeTodoDueDate(input.dueDate);
  }

  if (input.objective !== undefined) {
    update.objective = input.objective.trim();
  }

  if (input.sortOrder !== undefined) {
    update.sortOrder = normalizeSortOrder(input.sortOrder);
  }

  if (input.timeZone !== undefined) {
    update.timeZone = normalizeTimeZone(input.timeZone);
  }

  if (input.progress !== undefined) {
    const nextProgress = requestedProgress;

    update.progress = nextProgress;

    if (nextProgress === 0) {
      update.startedAtIso = fieldValue.delete();
      update.startedDateLabel = fieldValue.delete();
    } else if (existingProgress === 0 || !isNonEmptyString(existingRecord.startedAtIso)) {
      const startedAtIso = new Date().toISOString();
      const timeZone = normalizeTimeZone(input.timeZone || existingRecord.timeZone);

      update.startedAtIso = startedAtIso;
      update.startedDateLabel = formatMonthDayLabel(new Date(startedAtIso), timeZone);
      update.timeZone = timeZone;
    }
  }

  await goalRef.set(update, { merge: true });

  const refreshedSnapshot = await goalRef.get();

  return mapPersonalGoal(goalId, refreshedSnapshot.data() as LswPersonalGoalRecord);
}

export async function deleteLswPersonalGoal(
  decodedToken: DecodedIdToken,
  goalId: string
): Promise<void> {
  const context = await getAuthorizedLswContext(decodedToken);
  const goalRef = context.lswProfileRef.collection(LSW_PERSONAL_GOALS_COLLECTION).doc(goalId);
  const snapshot = await goalRef.get();

  if (!snapshot.exists) {
    throw notFoundError('This LSW goal was not found.');
  }

  const record = snapshot.data() as LswPersonalGoalRecord;

  assertPersonalGoalBelongsToContext(record, context);

  await goalRef.set({
    deletedAt: fieldValue.serverTimestamp(),
    deletedByUid: decodedToken.uid,
    status: 'DELETED',
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });
}

export async function listLswFollowUps(decodedToken: DecodedIdToken): Promise<LswFollowUpsResponse> {
  const context = await getAuthorizedLswContext(decodedToken);
  const snapshot = await context.lswProfileRef
    .collection(LSW_FOLLOW_UPS_COLLECTION)
    .orderBy('sortOrder', 'asc')
    .get();
  const followUps = snapshot.docs
    .map((doc) => mapFollowUp(doc.id, doc.data() as LswFollowUpRecord))
    .filter((followUp) => followUp.status === 'ACTIVE');

  return { followUps };
}

export async function createLswFollowUp(
  decodedToken: DecodedIdToken,
  input: LswFollowUpInput = {}
): Promise<LswFollowUp> {
  const context = await getAuthorizedLswContext(decodedToken);
  const followUpRef = context.lswProfileRef.collection(LSW_FOLLOW_UPS_COLLECTION).doc();
  const sortOrder = input.sortOrder ?? await getNextFollowUpSortOrder(context);
  const now = new Date();
  const record = buildFollowUpRecord(context, followUpRef.id, {
    comments: input.comments ?? '',
    dueDate: input.dueDate || formatLocalDateOnly(now),
    followUp: input.followUp ?? '',
    responsible: input.responsible ?? '',
    sortOrder,
    timeZone: input.timeZone
  });

  await followUpRef.set({
    ...record,
    createdAt: fieldValue.serverTimestamp(),
    updatedAt: fieldValue.serverTimestamp()
  });

  return mapFollowUp(followUpRef.id, record);
}

export async function updateLswFollowUp(
  decodedToken: DecodedIdToken,
  followUpId: string,
  input: LswFollowUpInput
): Promise<LswFollowUp> {
  const context = await getAuthorizedLswContext(decodedToken);
  const followUpRef = context.lswProfileRef.collection(LSW_FOLLOW_UPS_COLLECTION).doc(followUpId);
  const snapshot = await followUpRef.get();

  if (!snapshot.exists) {
    throw notFoundError('This LSW follow up was not found.');
  }

  const existingRecord = snapshot.data() as LswFollowUpRecord;

  assertFollowUpBelongsToContext(existingRecord, context);

  if (existingRecord.status && existingRecord.status !== 'ACTIVE') {
    throw notFoundError('This LSW follow up was not found.');
  }

  const update: Record<string, unknown> = {
    departmentId: context.department.departmentId,
    departmentName: context.department.name,
    updatedAt: fieldValue.serverTimestamp()
  };

  if (input.comments !== undefined) {
    update.comments = input.comments.trim();
  }

  if (input.dueDate !== undefined) {
    update.dueDate = normalizeTodoDueDate(input.dueDate);
  }

  if (input.followUp !== undefined) {
    update.followUp = input.followUp.trim();
  }

  if (input.responsible !== undefined) {
    update.responsible = input.responsible.trim();
  }

  if (input.sortOrder !== undefined) {
    update.sortOrder = normalizeSortOrder(input.sortOrder);
  }

  if (input.timeZone !== undefined) {
    update.timeZone = normalizeTimeZone(input.timeZone);
  }

  await followUpRef.set(update, { merge: true });

  const refreshedSnapshot = await followUpRef.get();

  return mapFollowUp(followUpId, refreshedSnapshot.data() as LswFollowUpRecord);
}

export async function deleteLswFollowUp(
  decodedToken: DecodedIdToken,
  followUpId: string
): Promise<void> {
  const context = await getAuthorizedLswContext(decodedToken);
  const followUpRef = context.lswProfileRef.collection(LSW_FOLLOW_UPS_COLLECTION).doc(followUpId);
  const snapshot = await followUpRef.get();

  if (!snapshot.exists) {
    throw notFoundError('This LSW follow up was not found.');
  }

  const record = snapshot.data() as LswFollowUpRecord;

  assertFollowUpBelongsToContext(record, context);

  await followUpRef.set({
    deletedAt: fieldValue.serverTimestamp(),
    deletedByUid: decodedToken.uid,
    status: 'DELETED',
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });
}

export async function listLswRcaTriggers(decodedToken: DecodedIdToken): Promise<LswRcaTriggersResponse> {
  const context = await getAuthorizedLswContext(decodedToken);
  const snapshot = await context.lswProfileRef
    .collection(LSW_RCA_TRIGGERS_COLLECTION)
    .orderBy('sortOrder', 'asc')
    .get();
  const triggers = snapshot.docs
    .map((doc) => mapRcaTrigger(doc.id, doc.data() as LswRcaTriggerRecord))
    .filter((trigger) => trigger.status === 'ACTIVE');

  return { triggers };
}

export async function createLswRcaTrigger(
  decodedToken: DecodedIdToken,
  input: LswRcaTriggerInput = {}
): Promise<LswRcaTrigger> {
  const context = await getAuthorizedLswContext(decodedToken);
  const triggerRef = context.lswProfileRef.collection(LSW_RCA_TRIGGERS_COLLECTION).doc();
  const sortOrder = input.sortOrder ?? await getNextRcaTriggerSortOrder(context);
  const now = new Date();
  const record = buildRcaTriggerRecord(context, triggerRef.id, {
    comments: input.comments ?? '',
    eventDate: input.eventDate || formatLocalDateOnly(now),
    sortOrder,
    timeZone: input.timeZone,
    trigger: input.trigger ?? ''
  });

  await triggerRef.set({
    ...record,
    createdAt: fieldValue.serverTimestamp(),
    updatedAt: fieldValue.serverTimestamp()
  });

  return mapRcaTrigger(triggerRef.id, record);
}

export async function updateLswRcaTrigger(
  decodedToken: DecodedIdToken,
  triggerId: string,
  input: LswRcaTriggerInput
): Promise<LswRcaTrigger> {
  const context = await getAuthorizedLswContext(decodedToken);
  const triggerRef = context.lswProfileRef.collection(LSW_RCA_TRIGGERS_COLLECTION).doc(triggerId);
  const snapshot = await triggerRef.get();

  if (!snapshot.exists) {
    throw notFoundError('This LSW RCA trigger was not found.');
  }

  const existingRecord = snapshot.data() as LswRcaTriggerRecord;

  assertRcaTriggerBelongsToContext(existingRecord, context);

  if (existingRecord.status && existingRecord.status !== 'ACTIVE') {
    throw notFoundError('This LSW RCA trigger was not found.');
  }

  const update: Record<string, unknown> = {
    departmentId: context.department.departmentId,
    departmentName: context.department.name,
    updatedAt: fieldValue.serverTimestamp()
  };

  if (input.comments !== undefined) {
    update.comments = input.comments.trim();
  }

  if (input.eventDate !== undefined) {
    update.eventDate = normalizeTodoDueDate(input.eventDate);
  }

  if (input.sortOrder !== undefined) {
    update.sortOrder = normalizeSortOrder(input.sortOrder);
  }

  if (input.timeZone !== undefined) {
    update.timeZone = normalizeTimeZone(input.timeZone);
  }

  if (input.trigger !== undefined) {
    update.trigger = input.trigger.trim();
  }

  await triggerRef.set(update, { merge: true });

  const refreshedSnapshot = await triggerRef.get();

  return mapRcaTrigger(triggerId, refreshedSnapshot.data() as LswRcaTriggerRecord);
}

export async function deleteLswRcaTrigger(
  decodedToken: DecodedIdToken,
  triggerId: string
): Promise<void> {
  const context = await getAuthorizedLswContext(decodedToken);
  const triggerRef = context.lswProfileRef.collection(LSW_RCA_TRIGGERS_COLLECTION).doc(triggerId);
  const snapshot = await triggerRef.get();

  if (!snapshot.exists) {
    throw notFoundError('This LSW RCA trigger was not found.');
  }

  const record = snapshot.data() as LswRcaTriggerRecord;

  assertRcaTriggerBelongsToContext(record, context);

  await triggerRef.set({
    deletedAt: fieldValue.serverTimestamp(),
    deletedByUid: decodedToken.uid,
    status: 'DELETED',
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });
}

export async function listLswImprovementProjects(decodedToken: DecodedIdToken): Promise<LswImprovementProjectsResponse> {
  const context = await getAuthorizedLswContext(decodedToken);
  const snapshot = await context.lswProfileRef
    .collection(LSW_IMPROVEMENT_PROJECTS_COLLECTION)
    .orderBy('sortOrder', 'asc')
    .get();
  const projects = snapshot.docs
    .map((doc) => mapImprovementProject(doc.id, doc.data() as LswImprovementProjectRecord))
    .filter((project) => project.status === 'ACTIVE');

  return { projects };
}

export async function createLswImprovementProject(
  decodedToken: DecodedIdToken,
  input: LswImprovementProjectInput = {}
): Promise<LswImprovementProject> {
  const context = await getAuthorizedLswContext(decodedToken);
  const projectRef = context.lswProfileRef.collection(LSW_IMPROVEMENT_PROJECTS_COLLECTION).doc();
  const sortOrder = input.sortOrder ?? await getNextImprovementProjectSortOrder(context);
  const record = buildImprovementProjectRecord(context, projectRef.id, {
    project: input.project ?? '',
    sortOrder,
    updates: input.updates
  });

  await projectRef.set({
    ...record,
    createdAt: fieldValue.serverTimestamp(),
    updatedAt: fieldValue.serverTimestamp()
  });

  return mapImprovementProject(projectRef.id, record);
}

export async function updateLswImprovementProject(
  decodedToken: DecodedIdToken,
  projectId: string,
  input: LswImprovementProjectInput
): Promise<LswImprovementProject> {
  const context = await getAuthorizedLswContext(decodedToken);
  const projectRef = context.lswProfileRef.collection(LSW_IMPROVEMENT_PROJECTS_COLLECTION).doc(projectId);
  const snapshot = await projectRef.get();

  if (!snapshot.exists) {
    throw notFoundError('This LSW improvement project was not found.');
  }

  const existingRecord = snapshot.data() as LswImprovementProjectRecord;

  assertImprovementProjectBelongsToContext(existingRecord, context);

  if (existingRecord.status && existingRecord.status !== 'ACTIVE') {
    throw notFoundError('This LSW improvement project was not found.');
  }

  const update: Record<string, unknown> = {
    departmentId: context.department.departmentId,
    departmentName: context.department.name,
    updatedAt: fieldValue.serverTimestamp()
  };

  if (input.project !== undefined) {
    update.project = input.project.trim();
  }

  if (input.sortOrder !== undefined) {
    update.sortOrder = normalizeSortOrder(input.sortOrder);
  }

  if (input.updates !== undefined) {
    update.updates = normalizeImprovementProjectUpdates(input.updates);
  }

  await projectRef.set(update, { merge: true });

  const refreshedSnapshot = await projectRef.get();

  return mapImprovementProject(projectId, refreshedSnapshot.data() as LswImprovementProjectRecord);
}

export async function deleteLswImprovementProject(
  decodedToken: DecodedIdToken,
  projectId: string
): Promise<void> {
  const context = await getAuthorizedLswContext(decodedToken);
  const projectRef = context.lswProfileRef.collection(LSW_IMPROVEMENT_PROJECTS_COLLECTION).doc(projectId);
  const snapshot = await projectRef.get();

  if (!snapshot.exists) {
    throw notFoundError('This LSW improvement project was not found.');
  }

  const record = snapshot.data() as LswImprovementProjectRecord;

  assertImprovementProjectBelongsToContext(record, context);

  await projectRef.set({
    deletedAt: fieldValue.serverTimestamp(),
    deletedByUid: decodedToken.uid,
    status: 'DELETED',
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });
}

export async function listLswScheduledTasks(decodedToken: DecodedIdToken): Promise<LswScheduledTasksResponse> {
  const context = await getAuthorizedLswContext(decodedToken);
  const snapshot = await context.lswProfileRef
    .collection(LSW_SCHEDULED_TASKS_COLLECTION)
    .orderBy('sortOrder', 'asc')
    .get();
  const tasks = snapshot.docs
    .map((doc) => mapScheduledTask(doc.id, doc.data() as LswScheduledTaskRecord))
    .filter((task) => task.status === 'ACTIVE');

  return { tasks };
}

export async function createLswScheduledTask(
  decodedToken: DecodedIdToken,
  input: LswScheduledTaskInput = {}
): Promise<LswScheduledTask> {
  const context = await getAuthorizedLswContext(decodedToken);
  const taskRef = context.lswProfileRef.collection(LSW_SCHEDULED_TASKS_COLLECTION).doc();
  const sortOrder = input.sortOrder ?? await getNextScheduledTaskSortOrder(context);
  const record = buildScheduledTaskRecord(context, taskRef.id, {
    dueDate: input.dueDate,
    frequency: input.frequency,
    minutes: input.minutes ?? 60,
    sortOrder,
    task: input.task ?? '',
    timeZone: input.timeZone
  });

  await taskRef.set({
    ...record,
    createdAt: fieldValue.serverTimestamp(),
    updatedAt: fieldValue.serverTimestamp()
  });

  return mapScheduledTask(taskRef.id, record);
}

export async function updateLswScheduledTask(
  decodedToken: DecodedIdToken,
  taskId: string,
  input: LswScheduledTaskInput
): Promise<LswScheduledTask> {
  const context = await getAuthorizedLswContext(decodedToken);
  const taskRef = context.lswProfileRef.collection(LSW_SCHEDULED_TASKS_COLLECTION).doc(taskId);
  const snapshot = await taskRef.get();

  if (!snapshot.exists) {
    throw notFoundError('This LSW scheduled task was not found.');
  }

  const existingRecord = snapshot.data() as LswScheduledTaskRecord;

  assertScheduledTaskBelongsToContext(existingRecord, context);

  if (existingRecord.status && existingRecord.status !== 'ACTIVE') {
    throw notFoundError('This LSW scheduled task was not found.');
  }

  const update: Record<string, unknown> = {
    departmentId: context.department.departmentId,
    departmentName: context.department.name,
    updatedAt: fieldValue.serverTimestamp()
  };

  if (input.dueDate !== undefined) {
    update.dueDate = normalizeTodoDueDate(input.dueDate);
  }

  if (input.frequency !== undefined) {
    update.frequency = normalizeScheduledTaskFrequency(input.frequency);
  }

  if (input.minutes !== undefined) {
    update.minutes = normalizeMinutes(input.minutes);
  }

  if (input.sortOrder !== undefined) {
    update.sortOrder = normalizeSortOrder(input.sortOrder);
  }

  if (input.task !== undefined) {
    update.task = input.task.trim();
  }

  if (input.timeZone !== undefined) {
    update.timeZone = normalizeTimeZone(input.timeZone);
  }

  await taskRef.set(update, { merge: true });

  const refreshedSnapshot = await taskRef.get();

  return mapScheduledTask(taskId, refreshedSnapshot.data() as LswScheduledTaskRecord);
}

export async function deleteLswScheduledTask(
  decodedToken: DecodedIdToken,
  taskId: string
): Promise<void> {
  const context = await getAuthorizedLswContext(decodedToken);
  const taskRef = context.lswProfileRef.collection(LSW_SCHEDULED_TASKS_COLLECTION).doc(taskId);
  const snapshot = await taskRef.get();

  if (!snapshot.exists) {
    throw notFoundError('This LSW scheduled task was not found.');
  }

  const record = snapshot.data() as LswScheduledTaskRecord;

  assertScheduledTaskBelongsToContext(record, context);

  await taskRef.set({
    deletedAt: fieldValue.serverTimestamp(),
    deletedByUid: decodedToken.uid,
    status: 'DELETED',
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });
}

export async function updateLswSettings(
  decodedToken: DecodedIdToken,
  input: LswSettingsInput
): Promise<{ workDaysPerWeek: number }> {
  const context = await getAuthorizedLswContext(decodedToken);
  const workDaysPerWeek = normalizeWorkDaysPerWeek(input.workDaysPerWeek);

  await context.lswProfileRef.set({
    workDaysPerWeek,
    updatedAt: fieldValue.serverTimestamp(),
    updatedByUid: decodedToken.uid
  }, { merge: true });

  return { workDaysPerWeek };
}

export function calculateCalendarWeekContext(
  calendar: CalendarYearSettings,
  input: LswContextInput = {},
  now: Date = new Date()
): LswContextResponse['week'] {
  const today = dateOnlyFromDateInTimeZone(now, input.timeZone);
  const currentSelection = getWeekSelectionForDate(calendar, today);
  const requestedSelection = normalizeRequestedWeekSelection(calendar, input, currentSelection);
  const weekRange = getWeekRange(calendar, requestedSelection.year, requestedSelection.week);
  const totalWeeksInYear = getTotalWeeksInYear(calendar, requestedSelection.year);

  return {
    currentWeek: currentSelection.week,
    currentYear: currentSelection.year,
    isCurrentWeek: requestedSelection.week === currentSelection.week &&
      requestedSelection.year === currentSelection.year,
    previewRows: buildPreviewRows(calendar, requestedSelection.year),
    selectedWeek: requestedSelection.week,
    selectedYear: requestedSelection.year,
    todayIso: formatIsoDate(today),
    todayLabel: formatTodayLabel(today),
    totalWeeksInYear,
    weekBeginning: formatIsoDate(weekRange.start),
    weekBeginningLabel: formatShortDate(weekRange.start),
    weekEnding: formatIsoDate(weekRange.end),
    weekEndingLabel: formatShortDate(weekRange.end)
  };
}

export function applyLswDayStatusInputForTest(
  existingDetails: Record<DayKey, LswDayStatusDetail>,
  input: Pick<LswDailyTaskInput, 'days' | 'dayStatusUpdates'>,
  weekKey = '2026-W01'
): Record<DayKey, LswDayStatusDetail> {
  return applyDayStatusInput(existingDetails, input, weekKey);
}

export function getEmptyLswDayStatusDetailsForTest(): Record<DayKey, LswDayStatusDetail> {
  return getEmptyDayStatusDetails();
}

function resolveWeekKey(context: AuthorizedLswContext, input: LswContextInput = {}): string {
  const calendar = mapCalendarYearSettings(context.organization);
  const week = calculateCalendarWeekContext(calendar, input);

  return formatWeekKey(week.selectedYear, week.selectedWeek);
}

function formatWeekKey(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function isWeekScopedRecordVisible(
  recordWeekKey: string | undefined,
  requestedWeekKey: string,
  currentWeekKey: string
): boolean {
  const normalizedRecordWeekKey = getNonEmptyString(recordWeekKey);

  return normalizedRecordWeekKey
    ? normalizedRecordWeekKey === requestedWeekKey
    : requestedWeekKey === currentWeekKey;
}

async function getAuthorizedLswContext(decodedToken: DecodedIdToken): Promise<AuthorizedLswContext> {
  const session = await buildAuthSession(decodedToken);
  const { role, status, tenantId } = session.user;

  if (session.access !== 'ACTIVE' || status !== 'ACTIVE' || !tenantId || !role) {
    throw authorizationError('Your profile is not active.');
  }

  const organizationRef = firestore.collection('organizations').doc(tenantId);
  const userRef = organizationRef.collection('users').doc(decodedToken.uid);
  const [organizationSnapshot, userSnapshot] = await Promise.all([
    organizationRef.get(),
    userRef.get()
  ]);

  if (!organizationSnapshot.exists || !userSnapshot.exists) {
    throw authorizationError('Your profile is not active.');
  }

  const organization = organizationSnapshot.data() as OrganizationRecord;
  const user = userSnapshot.data() as TenantUserRecord;

  if (
    organization.status !== 'ACTIVE' ||
    user.status !== 'ACTIVE' ||
    (organization.tenantId && organization.tenantId !== tenantId) ||
    (user.tenantId && user.tenantId !== tenantId)
  ) {
    throw authorizationError('Your profile is not active.');
  }

  const department = await resolveUserDepartment(tenantId, user, role);
  const { lswProfile, lswProfileRef } = await getOrCreateLswProfile({
    department,
    organizationRef,
    tenantId,
    uid: decodedToken.uid
  });

  return {
    department,
    lswProfile,
    lswProfileRef,
    organization,
    organizationRef,
    role,
    tenantId,
    user,
    uid: decodedToken.uid
  };
}

async function getOrCreateLswProfile(input: {
  department: LswContextResponse['department'];
  organizationRef: FirebaseFirestore.DocumentReference;
  tenantId: string;
  uid: string;
}): Promise<{
  lswProfile: AuthorizedLswContext['lswProfile'];
  lswProfileRef: FirebaseFirestore.DocumentReference;
}> {
  const lswId = input.uid;
  const lswProfileRef = input.organizationRef.collection(LSW_PROFILE_COLLECTION).doc(lswId);
  const snapshot = await lswProfileRef.get();
  const existing = snapshot.exists
    ? (snapshot.data() as LswProfileRecord)
    : null;
  const workDaysPerWeek = normalizeWorkDaysPerWeek(existing?.workDaysPerWeek || DEFAULT_WORK_DAYS_PER_WEEK);
  const nextProfile: AuthorizedLswContext['lswProfile'] = {
    ...existing,
    companyId: input.tenantId,
    departmentId: input.department.departmentId,
    departmentName: input.department.name,
    lswId,
    ownerUid: input.uid,
    status: 'ACTIVE',
    tenantId: input.tenantId,
    workDaysPerWeek
  };
  const needsSync = !existing ||
    existing.companyId !== input.tenantId ||
    existing.departmentId !== input.department.departmentId ||
    existing.departmentName !== input.department.name ||
    existing.lswId !== lswId ||
    existing.ownerUid !== input.uid ||
    existing.status !== 'ACTIVE' ||
    existing.tenantId !== input.tenantId ||
    existing.workDaysPerWeek !== workDaysPerWeek;

  if (needsSync) {
    const profileUpdate: Record<string, unknown> = {
      companyId: input.tenantId,
      departmentId: input.department.departmentId,
      departmentName: input.department.name,
      lswId,
      ownerUid: input.uid,
      status: 'ACTIVE',
      tenantId: input.tenantId,
      updatedAt: fieldValue.serverTimestamp(),
      workDaysPerWeek
    };

    if (!existing) {
      profileUpdate.createdAt = fieldValue.serverTimestamp();
    }

    await lswProfileRef.set(profileUpdate, { merge: true });
  }

  return {
    lswProfile: nextProfile,
    lswProfileRef
  };
}

async function seedDefaultDailyTasksIfEmpty(context: AuthorizedLswContext): Promise<void> {
  const snapshot = await context.lswProfileRef
    .collection(LSW_DAILY_TASKS_COLLECTION)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    return;
  }

  const batch = firestore.batch();

  for (const defaultTask of DEFAULT_DAILY_TASKS) {
    const taskRef = context.lswProfileRef.collection(LSW_DAILY_TASKS_COLLECTION).doc();
    const record = buildDailyTaskRecord(context, taskRef.id, defaultTask);

    batch.set(taskRef, {
      ...record,
      createdAt: fieldValue.serverTimestamp(),
      updatedAt: fieldValue.serverTimestamp()
    });
  }

  await batch.commit();
}

async function getNextDailyTaskSortOrder(context: AuthorizedLswContext): Promise<number> {
  const snapshot = await context.lswProfileRef
    .collection(LSW_DAILY_TASKS_COLLECTION)
    .orderBy('sortOrder', 'desc')
    .limit(1)
    .get();
  const latestRecord = snapshot.docs[0]?.data() as LswDailyTaskRecord | undefined;
  const latestSortOrder = typeof latestRecord?.sortOrder === 'number'
    ? latestRecord.sortOrder
    : 0;

  return latestSortOrder + 1000;
}

async function getNextTodoTaskSortOrder(context: AuthorizedLswContext, weekKey: string): Promise<number> {
  const currentWeekKey = resolveWeekKey(context);
  const snapshot = await context.lswProfileRef
    .collection(LSW_TODO_TASKS_COLLECTION)
    .orderBy('sortOrder', 'desc')
    .get();
  const latestRecord = snapshot.docs
    .map((doc) => doc.data() as LswTodoTaskRecord)
    .find((record) => isWeekScopedRecordVisible(record.weekKey, weekKey, currentWeekKey));
  const latestSortOrder = typeof latestRecord?.sortOrder === 'number'
    ? latestRecord.sortOrder
    : 0;

  return latestSortOrder + 1000;
}

async function getNextMeetingRailSortOrder(context: AuthorizedLswContext, weekKey: string): Promise<number> {
  const currentWeekKey = resolveWeekKey(context);
  const snapshot = await context.lswProfileRef
    .collection(LSW_MEETING_RAILS_COLLECTION)
    .orderBy('sortOrder', 'desc')
    .get();
  const latestRecord = snapshot.docs
    .map((doc) => doc.data() as LswMeetingRailRecord)
    .find((record) => isWeekScopedRecordVisible(record.weekKey, weekKey, currentWeekKey));
  const latestSortOrder = typeof latestRecord?.sortOrder === 'number'
    ? latestRecord.sortOrder
    : 0;

  return latestSortOrder + 1000;
}

async function getNextPersonalGoalSortOrder(context: AuthorizedLswContext): Promise<number> {
  const snapshot = await context.lswProfileRef
    .collection(LSW_PERSONAL_GOALS_COLLECTION)
    .orderBy('sortOrder', 'desc')
    .limit(1)
    .get();
  const latestRecord = snapshot.docs[0]?.data() as LswPersonalGoalRecord | undefined;
  const latestSortOrder = typeof latestRecord?.sortOrder === 'number'
    ? latestRecord.sortOrder
    : 0;

  return latestSortOrder + 1000;
}

async function getNextFollowUpSortOrder(context: AuthorizedLswContext): Promise<number> {
  const snapshot = await context.lswProfileRef
    .collection(LSW_FOLLOW_UPS_COLLECTION)
    .orderBy('sortOrder', 'desc')
    .limit(1)
    .get();
  const latestRecord = snapshot.docs[0]?.data() as LswFollowUpRecord | undefined;
  const latestSortOrder = typeof latestRecord?.sortOrder === 'number'
    ? latestRecord.sortOrder
    : 0;

  return latestSortOrder + 1000;
}

async function getNextRcaTriggerSortOrder(context: AuthorizedLswContext): Promise<number> {
  const snapshot = await context.lswProfileRef
    .collection(LSW_RCA_TRIGGERS_COLLECTION)
    .orderBy('sortOrder', 'desc')
    .limit(1)
    .get();
  const latestRecord = snapshot.docs[0]?.data() as LswRcaTriggerRecord | undefined;
  const latestSortOrder = typeof latestRecord?.sortOrder === 'number'
    ? latestRecord.sortOrder
    : 0;

  return latestSortOrder + 1000;
}

async function getNextImprovementProjectSortOrder(context: AuthorizedLswContext): Promise<number> {
  const snapshot = await context.lswProfileRef
    .collection(LSW_IMPROVEMENT_PROJECTS_COLLECTION)
    .orderBy('sortOrder', 'desc')
    .limit(1)
    .get();
  const latestRecord = snapshot.docs[0]?.data() as LswImprovementProjectRecord | undefined;
  const latestSortOrder = typeof latestRecord?.sortOrder === 'number'
    ? latestRecord.sortOrder
    : 0;

  return latestSortOrder + 1000;
}

async function getNextScheduledTaskSortOrder(context: AuthorizedLswContext): Promise<number> {
  const snapshot = await context.lswProfileRef
    .collection(LSW_SCHEDULED_TASKS_COLLECTION)
    .orderBy('sortOrder', 'desc')
    .limit(1)
    .get();
  const latestRecord = snapshot.docs[0]?.data() as LswScheduledTaskRecord | undefined;
  const latestSortOrder = typeof latestRecord?.sortOrder === 'number'
    ? latestRecord.sortOrder
    : 0;

  return latestSortOrder + 1000;
}

async function getDailyTaskWeekStatuses(
  context: AuthorizedLswContext,
  taskDocs: Array<{
    ref: FirebaseFirestore.DocumentReference;
    taskId: string;
  }>,
  weekKey: string
): Promise<Map<string, LswDailyTaskWeekStatusRecord>> {
  const entries = await Promise.all(taskDocs.map(async ({ ref, taskId }) => {
    const snapshot = await ref
      .collection(LSW_DAILY_TASK_WEEK_STATUSES_COLLECTION)
      .doc(weekKey)
      .get();

    if (!snapshot.exists) {
      return [taskId, null] as const;
    }

    const record = snapshot.data() as LswDailyTaskWeekStatusRecord;

    assertWeekStatusBelongsToContext(record, context, taskId, weekKey);

    return [taskId, record] as const;
  }));
  const statuses = new Map<string, LswDailyTaskWeekStatusRecord>();

  entries.forEach(([taskId, record]) => {
    if (record && (record.status || 'ACTIVE') === 'ACTIVE') {
      statuses.set(taskId, record);
    }
  });

  return statuses;
}

async function getDailyTaskWeekStatusDetails(
  context: AuthorizedLswContext,
  taskRef: FirebaseFirestore.DocumentReference,
  taskId: string,
  weekKey: string
): Promise<Record<DayKey, LswDayStatusDetail>> {
  const snapshot = await taskRef
    .collection(LSW_DAILY_TASK_WEEK_STATUSES_COLLECTION)
    .doc(weekKey)
    .get();

  if (!snapshot.exists) {
    return getEmptyDayStatusDetails();
  }

  const record = snapshot.data() as LswDailyTaskWeekStatusRecord;

  assertWeekStatusBelongsToContext(record, context, taskId, weekKey);

  if (record.status && record.status !== 'ACTIVE') {
    return getEmptyDayStatusDetails();
  }

  return normalizeDayStatusDetails(record.dayStatuses, record.days);
}

async function setDailyTaskWeekStatusDetails(
  context: AuthorizedLswContext,
  taskRef: FirebaseFirestore.DocumentReference,
  taskId: string,
  weekKey: string,
  existingDetails: Record<DayKey, LswDayStatusDetail>,
  input: Pick<LswDailyTaskInput, 'days' | 'dayStatusUpdates'>
): Promise<Record<DayKey, LswDayStatusDetail>> {
  const statusRef = taskRef
    .collection(LSW_DAILY_TASK_WEEK_STATUSES_COLLECTION)
    .doc(weekKey);
  const snapshot = await statusRef.get();
  const nextDetails = applyDayStatusInput(existingDetails, input, weekKey);
  const days = getDaysFromDayStatusDetails(nextDetails);

  if (snapshot.exists) {
    assertWeekStatusBelongsToContext(
      snapshot.data() as LswDailyTaskWeekStatusRecord,
      context,
      taskId,
      weekKey
    );
  }

  await statusRef.set({
    companyId: context.tenantId,
    days,
    dayStatuses: nextDetails,
    departmentId: context.department.departmentId,
    departmentName: context.department.name,
    lswId: context.lswProfile.lswId,
    ownerUid: context.uid,
    sectionKey: DAILY_TASK_SECTION_KEY,
    status: 'ACTIVE',
    taskId,
    tenantId: context.tenantId,
    updatedAt: fieldValue.serverTimestamp(),
    weekKey,
    ...(snapshot.exists ? {} : { createdAt: fieldValue.serverTimestamp() })
  }, { merge: true });

  return nextDetails;
}

function buildDailyTaskRecord(
  context: AuthorizedLswContext,
  taskId: string,
  input: LswDailyTaskInput
): LswDailyTaskRecord {
  return {
    companyId: context.tenantId,
    departmentId: context.department.departmentId,
    departmentName: context.department.name,
    lswId: context.lswProfile.lswId,
    minutes: normalizeMinutes(input.minutes ?? 0),
    ownerUid: context.uid,
    sectionKey: DAILY_TASK_SECTION_KEY,
    sortOrder: normalizeSortOrder(input.sortOrder ?? 0),
    status: 'ACTIVE',
    task: input.task?.trim() || '',
    taskId,
    tenantId: context.tenantId,
    time: normalizeTaskTime(input.time || '08:00')
  };
}

function mapDailyTask(
  taskId: string,
  record: LswDailyTaskRecord,
  weeklyStatus?: Pick<LswDailyTaskWeekStatusRecord, 'dayStatuses' | 'days'>,
  weekKey = ''
): LswDailyTask {
  const dayStatusDetails = normalizeDayStatusDetails(weeklyStatus?.dayStatuses, weeklyStatus?.days);

  return {
    days: getDaysFromDayStatusDetails(dayStatusDetails),
    dayStatusDetails,
    dayStatuses: getDayStatusesFromDayStatusDetails(dayStatusDetails),
    minutes: normalizeMinutes(record.minutes ?? 0),
    sortOrder: normalizeSortOrder(record.sortOrder ?? 0),
    status: record.status || 'ACTIVE',
    task: record.task || '',
    taskId: record.taskId || taskId,
    time: isValidTaskTime(record.time) ? record.time || '08:00' : '08:00',
    weekKey
  };
}

function buildTodoTaskRecord(
  context: AuthorizedLswContext,
  taskId: string,
  input: LswTodoTaskInput,
  weekKey: string
): LswTodoTaskRecord {
  const now = new Date();
  const timeZone = normalizeTimeZone(input.timeZone);
  const completedAtIso = input.completed
    ? normalizeCompletedAtIso(input.completedAtIso) || now.toISOString()
    : null;
  const record: LswTodoTaskRecord = {
    companyId: context.tenantId,
    completed: Boolean(completedAtIso),
    departmentId: context.department.departmentId,
    departmentName: context.department.name,
    dueDate: normalizeTodoDueDate(input.dueDate || formatLocalDateOnly(now)),
    dueTime: normalizeTaskTime(input.dueTime || formatLocalTime(now)),
    lswId: context.lswProfile.lswId,
    ownerUid: context.uid,
    sectionKey: TODO_TASK_SECTION_KEY,
    sortOrder: normalizeSortOrder(input.sortOrder ?? 0),
    status: 'ACTIVE',
    task: input.task?.trim() || '',
    taskId,
    tenantId: context.tenantId,
    timeZone,
    weekKey
  };

  if (completedAtIso) {
    const completedAt = new Date(completedAtIso);

    record.completedAtIso = completedAtIso;
    record.completedDateLabel = formatMonthDayLabel(completedAt, timeZone);
    record.completedTimeLabel = formatTimeLabel(completedAt, timeZone);
  }

  return record;
}

function mapTodoTask(taskId: string, record: LswTodoTaskRecord, fallbackWeekKey = ''): LswTodoTask {
  const dueDate = isValidDateOnly(record.dueDate) ? record.dueDate || formatLocalDateOnly(new Date()) : formatLocalDateOnly(new Date());
  const dueTime = isValidTaskTime(record.dueTime) ? record.dueTime || '08:00' : '08:00';
  const completedAtIso = getNonEmptyString(record.completedAtIso);
  const timeZone = normalizeTimeZone(record.timeZone);
  const completedAt = completedAtIso ? new Date(completedAtIso) : null;
  const completedDateLabel = getNonEmptyString(record.completedDateLabel) || (
    completedAt && !Number.isNaN(completedAt.getTime())
      ? formatMonthDayLabel(completedAt, timeZone)
      : undefined
  );
  const completedTimeLabel = getNonEmptyString(record.completedTimeLabel) || (
    completedAt && !Number.isNaN(completedAt.getTime())
      ? formatTimeLabel(completedAt, timeZone)
      : undefined
  );

  return {
    completed: record.completed === true || Boolean(completedAtIso),
    ...(completedAtIso ? { completedAtIso } : {}),
    ...(completedDateLabel ? { completedDateLabel } : {}),
    ...(completedTimeLabel ? { completedTimeLabel } : {}),
    dueDate,
    dueTime,
    sortOrder: normalizeSortOrder(record.sortOrder ?? 0),
    status: record.status || 'ACTIVE',
    task: record.task || '',
    taskId: record.taskId || taskId,
    timeZone,
    weekKey: getNonEmptyString(record.weekKey) || fallbackWeekKey
  };
}

function buildMeetingRailRecord(
  context: AuthorizedLswContext,
  railId: string,
  input: LswMeetingRailInput,
  weekKey: string
): LswMeetingRailRecord {
  const now = new Date();

  return {
    companyId: context.tenantId,
    completed: input.completed === true,
    departmentId: context.department.departmentId,
    departmentName: context.department.name,
    dueDate: normalizeTodoDueDate(input.dueDate || formatLocalDateOnly(now)),
    dueTime: normalizeTaskTime(input.dueTime || formatLocalTime(now)),
    lswId: context.lswProfile.lswId,
    ownerUid: context.uid,
    rail: input.rail?.trim() || '',
    railId,
    sectionKey: MEETING_RAIL_SECTION_KEY,
    sortOrder: normalizeSortOrder(input.sortOrder ?? 0),
    status: 'ACTIVE',
    tenantId: context.tenantId,
    timeZone: normalizeTimeZone(input.timeZone),
    weekKey
  };
}

function mapMeetingRail(railId: string, record: LswMeetingRailRecord, fallbackWeekKey = ''): LswMeetingRail {
  const dueDate = isValidDateOnly(record.dueDate) ? record.dueDate || formatLocalDateOnly(new Date()) : formatLocalDateOnly(new Date());
  const dueTime = isValidTaskTime(record.dueTime) ? record.dueTime || '08:00' : '08:00';

  return {
    completed: record.completed === true,
    dueDate,
    dueTime,
    rail: record.rail || '',
    railId: record.railId || railId,
    sortOrder: normalizeSortOrder(record.sortOrder ?? 0),
    status: record.status || 'ACTIVE',
    timeZone: normalizeTimeZone(record.timeZone),
    weekKey: getNonEmptyString(record.weekKey) || fallbackWeekKey
  };
}

function buildPersonalGoalRecord(
  context: AuthorizedLswContext,
  goalId: string,
  input: LswPersonalGoalInput
): LswPersonalGoalRecord {
  const now = new Date();
  const progress = normalizeProgress(input.progress ?? 0);
  const timeZone = normalizeTimeZone(input.timeZone);
  const record: LswPersonalGoalRecord = {
    companyId: context.tenantId,
    departmentId: context.department.departmentId,
    departmentName: context.department.name,
    dueDate: normalizeTodoDueDate(input.dueDate || formatLocalDateOnly(now)),
    goalId,
    lswId: context.lswProfile.lswId,
    objective: input.objective?.trim() || '',
    ownerUid: context.uid,
    progress,
    sectionKey: PERSONAL_GOAL_SECTION_KEY,
    sortOrder: normalizeSortOrder(input.sortOrder ?? 0),
    status: 'ACTIVE',
    tenantId: context.tenantId,
    timeZone
  };

  if (progress > 0) {
    const startedAtIso = now.toISOString();

    record.startedAtIso = startedAtIso;
    record.startedDateLabel = formatMonthDayLabel(now, timeZone);
  }

  return record;
}

function mapPersonalGoal(goalId: string, record: LswPersonalGoalRecord): LswPersonalGoal {
  const dueDate = isValidDateOnly(record.dueDate) ? record.dueDate || formatLocalDateOnly(new Date()) : formatLocalDateOnly(new Date());
  const progress = normalizeProgress(record.progress ?? 0);
  const startedAtIso = progress > 0 ? getNonEmptyString(record.startedAtIso) : undefined;
  const timeZone = normalizeTimeZone(record.timeZone);
  const startedAt = startedAtIso ? new Date(startedAtIso) : null;
  const startedDateLabel = getNonEmptyString(record.startedDateLabel) || (
    startedAt && !Number.isNaN(startedAt.getTime())
      ? formatMonthDayLabel(startedAt, timeZone)
      : undefined
  );

  return {
    dueDate,
    goalId: record.goalId || goalId,
    objective: record.objective || '',
    progress,
    sortOrder: normalizeSortOrder(record.sortOrder ?? 0),
    ...(startedAtIso ? { startedAtIso } : {}),
    ...(startedDateLabel ? { startedDateLabel } : {}),
    status: record.status || 'ACTIVE',
    timeZone
  };
}

function buildFollowUpRecord(
  context: AuthorizedLswContext,
  followUpId: string,
  input: LswFollowUpInput
): LswFollowUpRecord {
  const now = new Date();

  return {
    comments: input.comments?.trim() || '',
    companyId: context.tenantId,
    departmentId: context.department.departmentId,
    departmentName: context.department.name,
    dueDate: normalizeTodoDueDate(input.dueDate || formatLocalDateOnly(now)),
    followUp: input.followUp?.trim() || '',
    followUpId,
    lswId: context.lswProfile.lswId,
    ownerUid: context.uid,
    responsible: input.responsible?.trim() || '',
    sectionKey: FOLLOW_UP_SECTION_KEY,
    sortOrder: normalizeSortOrder(input.sortOrder ?? 0),
    status: 'ACTIVE',
    tenantId: context.tenantId,
    timeZone: normalizeTimeZone(input.timeZone)
  };
}

function mapFollowUp(followUpId: string, record: LswFollowUpRecord): LswFollowUp {
  const dueDate = isValidDateOnly(record.dueDate) ? record.dueDate || formatLocalDateOnly(new Date()) : formatLocalDateOnly(new Date());

  return {
    comments: record.comments || '',
    dueDate,
    followUp: record.followUp || '',
    followUpId: record.followUpId || followUpId,
    responsible: record.responsible || '',
    sortOrder: normalizeSortOrder(record.sortOrder ?? 0),
    status: record.status || 'ACTIVE',
    timeZone: normalizeTimeZone(record.timeZone)
  };
}

function buildRcaTriggerRecord(
  context: AuthorizedLswContext,
  triggerId: string,
  input: LswRcaTriggerInput
): LswRcaTriggerRecord {
  const now = new Date();

  return {
    comments: input.comments?.trim() || '',
    companyId: context.tenantId,
    departmentId: context.department.departmentId,
    departmentName: context.department.name,
    eventDate: normalizeTodoDueDate(input.eventDate || formatLocalDateOnly(now)),
    lswId: context.lswProfile.lswId,
    ownerUid: context.uid,
    sectionKey: RCA_TRIGGER_SECTION_KEY,
    sortOrder: normalizeSortOrder(input.sortOrder ?? 0),
    status: 'ACTIVE',
    tenantId: context.tenantId,
    timeZone: normalizeTimeZone(input.timeZone),
    trigger: input.trigger?.trim() || '',
    triggerId
  };
}

function mapRcaTrigger(triggerId: string, record: LswRcaTriggerRecord): LswRcaTrigger {
  const eventDate = isValidDateOnly(record.eventDate) ? record.eventDate || formatLocalDateOnly(new Date()) : formatLocalDateOnly(new Date());

  return {
    comments: record.comments || '',
    eventDate,
    sortOrder: normalizeSortOrder(record.sortOrder ?? 0),
    status: record.status || 'ACTIVE',
    timeZone: normalizeTimeZone(record.timeZone),
    trigger: record.trigger || '',
    triggerId: record.triggerId || triggerId
  };
}

function buildImprovementProjectRecord(
  context: AuthorizedLswContext,
  projectId: string,
  input: LswImprovementProjectInput
): LswImprovementProjectRecord {
  return {
    companyId: context.tenantId,
    departmentId: context.department.departmentId,
    departmentName: context.department.name,
    lswId: context.lswProfile.lswId,
    ownerUid: context.uid,
    project: input.project?.trim() || '',
    projectId,
    sectionKey: IMPROVEMENT_PROJECT_SECTION_KEY,
    sortOrder: normalizeSortOrder(input.sortOrder ?? 0),
    status: 'ACTIVE',
    tenantId: context.tenantId,
    updates: normalizeImprovementProjectUpdates(input.updates)
  };
}

function mapImprovementProject(projectId: string, record: LswImprovementProjectRecord): LswImprovementProject {
  return {
    project: record.project || '',
    projectId: record.projectId || projectId,
    sortOrder: normalizeSortOrder(record.sortOrder ?? 0),
    status: record.status || 'ACTIVE',
    updates: normalizeImprovementProjectUpdates(record.updates)
  };
}

function normalizeImprovementProjectUpdates(
  updates: Array<Partial<LswImprovementProjectUpdateRecord>> | undefined
): LswImprovementProjectUpdate[] {
  const activeUpdates = (updates || [])
    .filter((update) => (update.status || 'ACTIVE') === 'ACTIVE')
    .map((update, index) => ({
      sortOrder: normalizeSortOrder(update.sortOrder ?? ((index + 1) * 1000)),
      status: 'ACTIVE',
      text: String(update.text || '').trim(),
      updateId: getImprovementProjectUpdateId(update.updateId)
    }))
    .sort((first, second) => first.sortOrder - second.sortOrder || first.updateId.localeCompare(second.updateId));

  if (activeUpdates.length > 0) {
    return activeUpdates;
  }

  return [{
    sortOrder: 1000,
    status: 'ACTIVE',
    text: '',
    updateId: getImprovementProjectUpdateId()
  }];
}

function getImprovementProjectUpdateId(updateId?: string): string {
  const normalizedUpdateId = getNonEmptyString(updateId);

  if (normalizedUpdateId && /^[A-Za-z0-9_-]{8,128}$/.test(normalizedUpdateId)) {
    return normalizedUpdateId;
  }

  return `upd_${randomUUID().replace(/-/g, '').slice(0, 18)}`;
}

function buildScheduledTaskRecord(
  context: AuthorizedLswContext,
  taskId: string,
  input: LswScheduledTaskInput
): LswScheduledTaskRecord {
  const now = new Date();

  return {
    companyId: context.tenantId,
    departmentId: context.department.departmentId,
    departmentName: context.department.name,
    dueDate: normalizeTodoDueDate(input.dueDate || formatLocalDateOnly(now)),
    frequency: normalizeScheduledTaskFrequency(input.frequency),
    lswId: context.lswProfile.lswId,
    minutes: normalizeMinutes(input.minutes ?? 60),
    ownerUid: context.uid,
    sectionKey: SCHEDULED_TASK_SECTION_KEY,
    sortOrder: normalizeSortOrder(input.sortOrder ?? 0),
    status: 'ACTIVE',
    task: input.task?.trim() || '',
    taskId,
    tenantId: context.tenantId,
    timeZone: normalizeTimeZone(input.timeZone)
  };
}

function mapScheduledTask(taskId: string, record: LswScheduledTaskRecord): LswScheduledTask {
  const dueDate = isValidDateOnly(record.dueDate) ? record.dueDate || formatLocalDateOnly(new Date()) : formatLocalDateOnly(new Date());

  return {
    dueDate,
    frequency: normalizeScheduledTaskFrequency(record.frequency),
    minutes: normalizeMinutes(record.minutes ?? 60),
    sortOrder: normalizeSortOrder(record.sortOrder ?? 0),
    status: record.status || 'ACTIVE',
    task: record.task || '',
    taskId: record.taskId || taskId,
    timeZone: normalizeTimeZone(record.timeZone)
  };
}

function assertTaskBelongsToContext(record: LswDailyTaskRecord, context: AuthorizedLswContext): void {
  if (
    record.tenantId !== context.tenantId ||
    record.companyId !== context.tenantId ||
    record.ownerUid !== context.uid ||
    record.lswId !== context.lswProfile.lswId
  ) {
    throw authorizationError('This LSW task is not available.');
  }
}

function assertTodoTaskBelongsToContext(record: LswTodoTaskRecord, context: AuthorizedLswContext): void {
  if (
    record.tenantId !== context.tenantId ||
    record.companyId !== context.tenantId ||
    record.ownerUid !== context.uid ||
    record.lswId !== context.lswProfile.lswId
  ) {
    throw authorizationError('This LSW to-do item is not available.');
  }
}

function assertMeetingRailBelongsToContext(record: LswMeetingRailRecord, context: AuthorizedLswContext): void {
  if (
    record.tenantId !== context.tenantId ||
    record.companyId !== context.tenantId ||
    record.ownerUid !== context.uid ||
    record.lswId !== context.lswProfile.lswId
  ) {
    throw authorizationError('This LSW meeting rail is not available.');
  }
}

function assertPersonalGoalBelongsToContext(record: LswPersonalGoalRecord, context: AuthorizedLswContext): void {
  if (
    record.tenantId !== context.tenantId ||
    record.companyId !== context.tenantId ||
    record.ownerUid !== context.uid ||
    record.lswId !== context.lswProfile.lswId
  ) {
    throw authorizationError('This LSW goal is not available.');
  }
}

function assertFollowUpBelongsToContext(record: LswFollowUpRecord, context: AuthorizedLswContext): void {
  if (
    record.tenantId !== context.tenantId ||
    record.companyId !== context.tenantId ||
    record.ownerUid !== context.uid ||
    record.lswId !== context.lswProfile.lswId
  ) {
    throw authorizationError('This LSW follow up is not available.');
  }
}

function assertRcaTriggerBelongsToContext(record: LswRcaTriggerRecord, context: AuthorizedLswContext): void {
  if (
    record.tenantId !== context.tenantId ||
    record.companyId !== context.tenantId ||
    record.ownerUid !== context.uid ||
    record.lswId !== context.lswProfile.lswId
  ) {
    throw authorizationError('This LSW RCA trigger is not available.');
  }
}

function assertImprovementProjectBelongsToContext(record: LswImprovementProjectRecord, context: AuthorizedLswContext): void {
  if (
    record.tenantId !== context.tenantId ||
    record.companyId !== context.tenantId ||
    record.ownerUid !== context.uid ||
    record.lswId !== context.lswProfile.lswId
  ) {
    throw authorizationError('This LSW improvement project is not available.');
  }
}

function assertScheduledTaskBelongsToContext(record: LswScheduledTaskRecord, context: AuthorizedLswContext): void {
  if (
    record.tenantId !== context.tenantId ||
    record.companyId !== context.tenantId ||
    record.ownerUid !== context.uid ||
    record.lswId !== context.lswProfile.lswId
  ) {
    throw authorizationError('This LSW scheduled task is not available.');
  }
}

function assertWeekStatusBelongsToContext(
  record: LswDailyTaskWeekStatusRecord,
  context: AuthorizedLswContext,
  taskId: string,
  weekKey: string
): void {
  if (
    record.tenantId !== context.tenantId ||
    record.companyId !== context.tenantId ||
    record.ownerUid !== context.uid ||
    record.lswId !== context.lswProfile.lswId ||
    record.taskId !== taskId ||
    record.weekKey !== weekKey
  ) {
    throw authorizationError('This LSW task status is not available.');
  }
}

function normalizeDays(
  input?: Partial<Record<DayKey, boolean>>,
  fallback: Record<DayKey, boolean> = getEmptyDays()
): Record<DayKey, boolean> {
  const normalized = { ...fallback };

  for (const dayKey of ALL_DAY_KEYS) {
    if (typeof input?.[dayKey] === 'boolean') {
      normalized[dayKey] = Boolean(input[dayKey]);
    }
  }

  return normalized;
}

function normalizeDayStatusDetails(
  input?: Partial<Record<DayKey, Partial<LswDayStatusDetail>>>,
  fallbackDays: Partial<Record<DayKey, boolean>> = getEmptyDays()
): Record<DayKey, LswDayStatusDetail> {
  const normalized = {} as Record<DayKey, LswDayStatusDetail>;

  for (const dayKey of ALL_DAY_KEYS) {
    const rawDetail = input?.[dayKey];
    const fallbackStatus: LswDayStatus = fallbackDays?.[dayKey]
      ? 'completed_on_time'
      : 'not_completed';
    const status = normalizeDayStatus(rawDetail?.status, fallbackStatus);
    const firstCompletedOnTime = rawDetail?.firstCompletedOnTime === true || status === 'completed_on_time';
    const detail: LswDayStatusDetail = {
      completionTiming: normalizeCompletionTiming(rawDetail?.completionTiming, status),
      completionWindowHours: normalizeCompletionWindowHours(rawDetail?.completionWindowHours),
      firstCompletedOnTime,
      status
    };

    if (isNonEmptyString(rawDetail?.completedAtIso)) {
      detail.completedAtIso = rawDetail.completedAtIso;
    }

    if (isNonEmptyString(rawDetail?.completedAtDayLabel)) {
      detail.completedAtDayLabel = rawDetail.completedAtDayLabel.slice(0, 80);
    }

    if (isNonEmptyString(rawDetail?.completedAtTimeLabel)) {
      detail.completedAtTimeLabel = rawDetail.completedAtTimeLabel.slice(0, 40);
    }

    if (isNonEmptyString(rawDetail?.completedWeekKey)) {
      detail.completedWeekKey = rawDetail.completedWeekKey.slice(0, 24);
    }

    if (isNonEmptyString(rawDetail?.completedWeekLabel)) {
      detail.completedWeekLabel = rawDetail.completedWeekLabel.slice(0, 80);
    }

    if (typeof rawDetail?.completionOffsetMinutes === 'number' && Number.isFinite(rawDetail.completionOffsetMinutes)) {
      detail.completionOffsetMinutes = Math.round(rawDetail.completionOffsetMinutes);
    }

    if (isNonEmptyString(rawDetail?.dueAtIso)) {
      detail.dueAtIso = rawDetail.dueAtIso;
    }

    if (isNonEmptyString(rawDetail?.firstCompletedAtIso)) {
      detail.firstCompletedAtIso = rawDetail.firstCompletedAtIso;
    }

    if (isNonEmptyString(rawDetail?.lastChangedAtIso)) {
      detail.lastChangedAtIso = rawDetail.lastChangedAtIso;
    }

    if (isNonEmptyString(rawDetail?.timeZone)) {
      detail.timeZone = rawDetail.timeZone.slice(0, 80);
    }

    if (isNonEmptyString(rawDetail?.uncheckedAtIso)) {
      detail.uncheckedAtIso = rawDetail.uncheckedAtIso;
    }

    normalized[dayKey] = detail;
  }

  return normalized;
}

function applyDayStatusInput(
  existingDetails: Record<DayKey, LswDayStatusDetail>,
  input: Pick<LswDailyTaskInput, 'days' | 'dayStatusUpdates'>,
  weekKey: string
): Record<DayKey, LswDayStatusDetail> {
  const nextDetails = normalizeDayStatusDetails(existingDetails);
  const daysToUpdate = new Set<DayKey>();

  for (const dayKey of ALL_DAY_KEYS) {
    if (typeof input.days?.[dayKey] === 'boolean' || input.dayStatusUpdates?.[dayKey]) {
      daysToUpdate.add(dayKey);
    }
  }

  daysToUpdate.forEach((dayKey) => {
    const requestedStatus = getRequestedDayStatus(dayKey, input);

    if (!requestedStatus) {
      return;
    }

    nextDetails[dayKey] = applySingleDayStatusUpdate(
      nextDetails[dayKey],
      requestedStatus,
      input.dayStatusUpdates?.[dayKey],
      weekKey
    );
  });

  return nextDetails;
}

function applySingleDayStatusUpdate(
  existingDetail: LswDayStatusDetail,
  requestedStatus: LswDayStatus,
  update: LswDayStatusUpdateInput | undefined,
  weekKey: string
): LswDayStatusDetail {
  const nowIso = new Date().toISOString();
  const firstCompletedOnTimeAlready = existingDetail.firstCompletedOnTime === true;

  if (requestedStatus === 'not_completed') {
    const detail: LswDayStatusDetail = {
      completionTiming: 'not_completed',
      completionWindowHours: COMPLETION_WINDOW_HOURS,
      firstCompletedOnTime: firstCompletedOnTimeAlready,
      lastChangedAtIso: nowIso,
      status: 'not_completed',
      uncheckedAtIso: nowIso
    };

    if (isNonEmptyString(existingDetail.firstCompletedAtIso)) {
      detail.firstCompletedAtIso = existingDetail.firstCompletedAtIso;
    }

    const dueAtIso = getNonEmptyString(update?.dueAtIso) || getNonEmptyString(existingDetail.dueAtIso);
    const timeZone = getNonEmptyString(update?.timeZone) || getNonEmptyString(existingDetail.timeZone);

    if (dueAtIso) {
      detail.dueAtIso = dueAtIso;
    }

    if (timeZone) {
      detail.timeZone = timeZone.slice(0, 80);
    }

    return detail;
  }

  const completedAtIso = getNonEmptyString(update?.completedAtIso) || nowIso;
  const dueAtIso = getNonEmptyString(update?.dueAtIso) || getNonEmptyString(existingDetail.dueAtIso);
  const timeZone = getNonEmptyString(update?.timeZone) || getNonEmptyString(existingDetail.timeZone);
  const finalStatus = classifyCompletionStatus({
    completedAtIso,
    dueAtIso,
    firstCompletedOnTimeAlready,
    requestedStatus
  });
  const firstCompletedAtIso = getNonEmptyString(existingDetail.firstCompletedAtIso) || completedAtIso;
  const completedAtForLabels = firstCompletedOnTimeAlready ? firstCompletedAtIso : completedAtIso;
  const completionMetadata = getCompletionMetadata({
    completedAtIso: completedAtForLabels,
    dueAtIso,
    status: finalStatus,
    timeZone,
    weekKey
  });
  const detail: LswDayStatusDetail = {
    completedAtIso: completedAtForLabels,
    ...completionMetadata,
    firstCompletedAtIso,
    firstCompletedOnTime: firstCompletedOnTimeAlready || finalStatus === 'completed_on_time',
    lastChangedAtIso: nowIso,
    status: finalStatus
  };

  if (dueAtIso) {
    detail.dueAtIso = dueAtIso;
  }

  if (timeZone) {
    detail.timeZone = timeZone.slice(0, 80);
  }

  return detail;
}

function getRequestedDayStatus(
  dayKey: DayKey,
  input: Pick<LswDailyTaskInput, 'days' | 'dayStatusUpdates'>
): LswDayStatus | null {
  const requestedStatus = input.dayStatusUpdates?.[dayKey]?.status;

  if (requestedStatus) {
    return normalizeDayStatus(requestedStatus, 'not_completed');
  }

  if (typeof input.days?.[dayKey] === 'boolean') {
    return input.days[dayKey] ? 'completed_on_time' : 'not_completed';
  }

  return null;
}

function normalizeDayStatus(value: unknown, fallback: LswDayStatus): LswDayStatus {
  return value === 'completed_on_time' || value === 'completed_late' || value === 'completed_early' || value === 'not_completed'
    ? value
    : fallback;
}

function classifyCompletionStatus(input: {
  completedAtIso: string;
  dueAtIso: string | null;
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

function getCompletionMetadata(input: {
  completedAtIso: string;
  dueAtIso: string | null;
  status: LswDayStatus;
  timeZone: string | null;
  weekKey: string;
}): Pick<
  LswDayStatusDetail,
  | 'completedAtDayLabel'
  | 'completedAtTimeLabel'
  | 'completedWeekKey'
  | 'completedWeekLabel'
  | 'completionOffsetMinutes'
  | 'completionTiming'
  | 'completionWindowHours'
> {
  const completedAt = new Date(input.completedAtIso);
  const timeZone = input.timeZone || 'UTC';
  const metadata: Pick<
    LswDayStatusDetail,
    | 'completedAtDayLabel'
    | 'completedAtTimeLabel'
    | 'completedWeekKey'
    | 'completedWeekLabel'
    | 'completionOffsetMinutes'
    | 'completionTiming'
    | 'completionWindowHours'
  > = {
    completedWeekKey: input.weekKey,
    completedWeekLabel: formatCompletionWeekLabel(input.weekKey, input.dueAtIso || input.completedAtIso),
    completionTiming: getCompletionTimingForStatus(input.status),
    completionWindowHours: COMPLETION_WINDOW_HOURS
  };

  if (!Number.isNaN(completedAt.getTime())) {
    metadata.completedAtDayLabel = formatCompletionDayLabel(completedAt, timeZone);
    metadata.completedAtTimeLabel = formatCompletionTimeLabel(completedAt, timeZone);
  }

  const completedAtMs = Date.parse(input.completedAtIso);
  const dueAtMs = input.dueAtIso ? Date.parse(input.dueAtIso) : Number.NaN;

  if (Number.isFinite(completedAtMs) && Number.isFinite(dueAtMs)) {
    metadata.completionOffsetMinutes = Math.round((completedAtMs - dueAtMs) / 60000);
  }

  return metadata;
}

function getCompletionTimingForStatus(status: LswDayStatus): LswDayCompletionTiming {
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

function normalizeCompletionTiming(value: unknown, status: LswDayStatus): LswDayCompletionTiming {
  if (value === 'within_window' || value === 'late' || value === 'early' || value === 'not_completed') {
    return value;
  }

  return getCompletionTimingForStatus(status);
}

function normalizeCompletionWindowHours(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : COMPLETION_WINDOW_HOURS;
}

function formatCompletionWeekLabel(weekKey: string, displayDateIso?: string | null): string {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(weekKey);

  if (!match) {
    return weekKey || 'Selected week';
  }

  return `Week ${Number(match[2])}, ${getIsoYear(displayDateIso) || match[1]}`;
}

function getIsoYear(value?: string | null): string | null {
  const match = /^(\d{4})-/.exec(value || '');

  return match?.[1] || null;
}

function formatCompletionDayLabel(date: Date, timeZone: string): string {
  return formatCompletionDatePart(date, timeZone, {
    day: 'numeric',
    month: 'short',
    weekday: 'long',
    year: 'numeric'
  });
}

function formatCompletionTimeLabel(date: Date, timeZone: string): string {
  return formatCompletionDatePart(date, timeZone, {
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatCompletionDatePart(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): string {
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

function getDaysFromDayStatusDetails(details: Record<DayKey, LswDayStatusDetail>): Record<DayKey, boolean> {
  const days = {} as Record<DayKey, boolean>;

  for (const dayKey of ALL_DAY_KEYS) {
    days[dayKey] = details[dayKey].status !== 'not_completed';
  }

  return days;
}

function getDayStatusesFromDayStatusDetails(details: Record<DayKey, LswDayStatusDetail>): Record<DayKey, LswDayStatus> {
  const statuses = {} as Record<DayKey, LswDayStatus>;

  for (const dayKey of ALL_DAY_KEYS) {
    statuses[dayKey] = details[dayKey].status;
  }

  return statuses;
}

function getEmptyDayStatusDetails(): Record<DayKey, LswDayStatusDetail> {
  const details = {} as Record<DayKey, LswDayStatusDetail>;

  for (const dayKey of ALL_DAY_KEYS) {
    details[dayKey] = {
      completionTiming: 'not_completed',
      completionWindowHours: COMPLETION_WINDOW_HOURS,
      firstCompletedOnTime: false,
      status: 'not_completed'
    };
  }

  return details;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function getNonEmptyString(value: unknown): string | null {
  return isNonEmptyString(value) ? value.trim() : null;
}

function getEmptyDays(): Record<DayKey, boolean> {
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

function normalizeWorkDaysPerWeek(value: number): number {
  if (value === 5 || value === 6 || value === 7) {
    return value;
  }

  return DEFAULT_WORK_DAYS_PER_WEEK;
}

function normalizeScheduledTaskFrequency(value: string | undefined): LswScheduledTaskFrequency {
  return SCHEDULED_TASK_FREQUENCIES.includes(value as LswScheduledTaskFrequency)
    ? value as LswScheduledTaskFrequency
    : 'BI_WEEKLY';
}

function normalizeMinutes(value: number): number {
  if (!Number.isFinite(value)) {
    throw validationError('Enter valid minutes.');
  }

  return Math.max(0, Math.min(1440, Math.round(value)));
}

function normalizeSortOrder(value: number): number {
  if (!Number.isFinite(value)) {
    throw validationError('Invalid task order.');
  }

  return Math.max(0, Math.min(1_000_000_000, Math.round(value)));
}

function normalizeProgress(value: number): number {
  if (!Number.isFinite(value)) {
    throw validationError('Enter valid progress.');
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeTaskTime(value: string): string {
  if (!isValidTaskTime(value)) {
    throw validationError('Enter time using 24-hour HH:mm format.');
  }

  return value;
}

function isValidTaskTime(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const match = /^(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function normalizeTodoDueDate(value: string): string {
  if (!isValidDateOnly(value)) {
    throw validationError('Enter a valid due date.');
  }

  return value;
}

function isValidDateOnly(value: string | undefined): boolean {
  return Boolean(value && tryParseDateOnly(value));
}

function normalizeCompletedAtIso(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw validationError('Enter a valid completion date and time.');
  }

  return date.toISOString();
}

function normalizeTimeZone(value: string | undefined | null): string {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, 80)
    : 'UTC';
}

function formatLocalDateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatLocalTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatMonthDayLabel(date: Date, timeZone: string): string {
  return formatTodoDatePart(date, timeZone, {
    day: 'numeric',
    month: 'short'
  });
}

function formatTimeLabel(date: Date, timeZone: string): string {
  return formatTodoDatePart(date, timeZone, {
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatTodoDatePart(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions): string {
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

async function resolveUserDepartment(
  tenantId: string,
  user: TenantUserRecord,
  role: SynzappRole
): Promise<LswContextResponse['department']> {
  const fallbackDepartmentId = role === 'ORG_ADMIN' && !user.departmentId
    ? HUMAN_RESOURCES_DEPARTMENT_ID
    : user.departmentId || null;
  const fallbackName = role === 'ORG_ADMIN' && fallbackDepartmentId === HUMAN_RESOURCES_DEPARTMENT_ID
    ? HUMAN_RESOURCES_DEPARTMENT_NAME
    : user.departmentName || 'Unassigned department';

  if (!fallbackDepartmentId) {
    return {
      departmentId: null,
      name: fallbackName,
      status: 'ACTIVE'
    };
  }

  const departmentSnapshot = await firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('departments')
    .doc(fallbackDepartmentId)
    .get();

  if (!departmentSnapshot.exists) {
    return {
      departmentId: fallbackDepartmentId,
      name: fallbackName,
      status: 'ACTIVE'
    };
  }

  const department = departmentSnapshot.data() as TenantDepartmentRecord;

  if (department.tenantId && department.tenantId !== tenantId) {
    throw authorizationError('Your department is not available.');
  }

  return {
    departmentId: department.departmentId || fallbackDepartmentId,
    name: department.name || fallbackName,
    status: department.status || 'ACTIVE'
  };
}

function normalizeRequestedWeekSelection(
  calendar: CalendarYearSettings,
  input: LswContextInput,
  currentSelection: { week: number; year: number }
): { week: number; year: number } {
  let selectedYear = Number.isInteger(input.year) ? Number(input.year) : currentSelection.year;
  let selectedWeek = Number.isInteger(input.week) ? Number(input.week) : currentSelection.week;

  if (selectedYear < 1900 || selectedYear > 2100) {
    selectedYear = currentSelection.year;
  }

  while (selectedWeek < 1) {
    selectedYear -= 1;
    selectedWeek += getTotalWeeksInYear(calendar, selectedYear);
  }

  let totalWeeksInYear = getTotalWeeksInYear(calendar, selectedYear);

  while (selectedWeek > totalWeeksInYear) {
    selectedWeek -= totalWeeksInYear;
    selectedYear += 1;
    totalWeeksInYear = getTotalWeeksInYear(calendar, selectedYear);
  }

  return {
    week: selectedWeek,
    year: selectedYear
  };
}

function getWeekSelectionForDate(
  calendar: CalendarYearSettings,
  date: Date
): { week: number; year: number } {
  const yearStart = getCalendarYearStartForDate(calendar, date);
  const dayOffset = Math.max(0, Math.floor((date.getTime() - yearStart.getTime()) / dayMs()));

  return {
    week: Math.floor(dayOffset / 7) + 1,
    year: yearStart.getUTCFullYear()
  };
}

function getCalendarYearStartForDate(calendar: CalendarYearSettings, date: Date): Date {
  const baseStart = parseDateOnly(calendar.startDate);
  const currentYearCandidate = createDateClamped(
    date.getUTCFullYear(),
    calendar.startMonth,
    calendar.startDay
  );
  let yearStart = date.getTime() < currentYearCandidate.getTime()
    ? createDateClamped(date.getUTCFullYear() - 1, calendar.startMonth, calendar.startDay)
    : currentYearCandidate;

  if (yearStart.getTime() < baseStart.getTime()) {
    yearStart = baseStart;
  }

  return yearStart;
}

function getWeekRange(
  calendar: CalendarYearSettings,
  selectedYear: number,
  selectedWeek: number
): { end: Date; start: Date } {
  const start = createDateClamped(selectedYear, calendar.startMonth, calendar.startDay);
  start.setUTCDate(start.getUTCDate() + ((selectedWeek - 1) * 7));
  const end = new Date(start.getTime());
  end.setUTCDate(end.getUTCDate() + 6);

  return { end, start };
}

function getTotalWeeksInYear(calendar: CalendarYearSettings, selectedYear: number): number {
  const start = createDateClamped(selectedYear, calendar.startMonth, calendar.startDay);
  const nextStart = createDateClamped(selectedYear + 1, calendar.startMonth, calendar.startDay);
  const daysInYear = Math.max(1, Math.round((nextStart.getTime() - start.getTime()) / dayMs()));

  return Math.ceil(daysInYear / 7);
}

function buildPreviewRows(calendar: CalendarYearSettings, selectedYear: number): LswWeekPreviewRow[] {
  return Array.from({ length: 4 }, (_value, index) => {
    const range = getWeekRange(calendar, selectedYear, index + 1);

    return {
      endDate: formatIsoDate(range.end),
      endDateLabel: formatNumericDate(range.end),
      startDate: formatIsoDate(range.start),
      startDateLabel: formatNumericDate(range.start),
      week: index + 1
    };
  });
}

function mapCalendarYearSettings(record: OrganizationRecord): CalendarYearSettings {
  const currentYear = new Date().getUTCFullYear();
  const parsedStoredStartDate = record.calendarYear?.startDate
    ? tryParseDateOnly(record.calendarYear.startDate)
    : null;
  const startMonth = parsedStoredStartDate
    ? parsedStoredStartDate.getUTCMonth() + 1
    : getSafeInteger(record.calendarYear?.startMonth, 1, 12, 1);
  const startDay = parsedStoredStartDate
    ? parsedStoredStartDate.getUTCDate()
    : getSafeInteger(record.calendarYear?.startDay, 1, 31, 1);
  const startYear = parsedStoredStartDate
    ? parsedStoredStartDate.getUTCFullYear()
    : getSafeInteger(record.calendarYear?.startYear, 1900, 2100, currentYear);
  const normalizedStartDate = parsedStoredStartDate || createDateClamped(startYear, startMonth, startDay);

  return {
    startDate: formatIsoDate(normalizedStartDate),
    startDay: normalizedStartDate.getUTCDate(),
    startMonth: normalizedStartDate.getUTCMonth() + 1,
    startYear: normalizedStartDate.getUTCFullYear(),
    weekOneStartsOn: record.calendarYear?.weekOneStartsOn || 'CALENDAR_YEAR_START'
  };
}

function createDateClamped(year: number, month: number, day: number): Date {
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return new Date(Date.UTC(year, month - 1, Math.min(day, lastDayOfMonth)));
}

function parseDateOnly(value: string): Date {
  return tryParseDateOnly(value) || new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
}

function tryParseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function dateOnlyFromDate(date: Date): Date {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ));
}

function dateOnlyFromDateInTimeZone(date: Date, timeZone?: string): Date {
  const normalizedTimeZone = normalizeTimeZone(timeZone);

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      month: '2-digit',
      timeZone: normalizedTimeZone,
      year: 'numeric'
    }).formatToParts(date);
    const values = new Map(parts.map((part) => [part.type, part.value]));
    const year = Number(values.get('year'));
    const month = Number(values.get('month'));
    const day = Number(values.get('day'));

    if (
      Number.isInteger(year) &&
      Number.isInteger(month) &&
      Number.isInteger(day) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      return createDateClamped(year, month, day);
    }
  } catch {
    // Fall through to the UTC date-only behavior when the timezone cannot be resolved.
  }

  return dateOnlyFromDate(date);
}

function formatIsoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric'
  }).format(date);
}

function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    weekday: 'long',
    year: 'numeric'
  }).format(date);
}

function formatTodayLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    weekday: 'long'
  }).format(date);
}

function formatNumericDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
    year: 'numeric'
  }).format(date);
}

function getSafeInteger(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  if (!Number.isInteger(value)) {
    return fallback;
  }

  const numericValue = Number(value);

  if (numericValue < min || numericValue > max) {
    return fallback;
  }

  return numericValue;
}

function getDisplayName(user: TenantUserRecord): string {
  const displayName = user.displayName?.trim();

  if (displayName) {
    return displayName;
  }

  const fullName = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');

  return fullName || 'Synzapp user';
}

function formatRoleName(roleName: string | undefined, role: SynzappRole): string {
  if (roleName?.trim()) {
    return roleName.trim();
  }

  return role
    .split('_')
    .map((part) => `${part.slice(0, 1)}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function dayMs(): number {
  return 24 * 60 * 60 * 1000;
}

function authorizationError(message: string): Error {
  const error = new Error(message);
  error.name = 'AuthorizationError';
  return error;
}

function validationError(message: string): Error {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
}

function notFoundError(message: string): Error {
  const error = new Error(message);
  error.name = 'NotFoundError';
  return error;
}
