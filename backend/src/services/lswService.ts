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
  week?: number;
  year?: number;
}

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type LswDayStatus = 'not_completed' | 'completed_on_time' | 'completed_late';

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

export interface LswDayStatusDetail {
  completedAtIso?: string;
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
const DAILY_TASK_SECTION_KEY = 'daily_weekly_standard_tasks';
const DEFAULT_WORK_DAYS_PER_WEEK = 5;
const ALL_DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
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
  const today = dateOnlyFromDate(now);
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
  input: Pick<LswDailyTaskInput, 'days' | 'dayStatusUpdates'>
): Record<DayKey, LswDayStatusDetail> {
  return applyDayStatusInput(existingDetails, input);
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
  const nextDetails = applyDayStatusInput(existingDetails, input);
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
      firstCompletedOnTime,
      status
    };

    if (isNonEmptyString(rawDetail?.completedAtIso)) {
      detail.completedAtIso = rawDetail.completedAtIso;
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
  input: Pick<LswDailyTaskInput, 'days' | 'dayStatusUpdates'>
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
      input.dayStatusUpdates?.[dayKey]
    );
  });

  return nextDetails;
}

function applySingleDayStatusUpdate(
  existingDetail: LswDayStatusDetail,
  requestedStatus: LswDayStatus,
  update?: LswDayStatusUpdateInput
): LswDayStatusDetail {
  const nowIso = new Date().toISOString();
  const firstCompletedOnTimeAlready = existingDetail.firstCompletedOnTime === true;

  if (requestedStatus === 'not_completed') {
    const detail: LswDayStatusDetail = {
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
  const finalStatus: LswDayStatus = firstCompletedOnTimeAlready || requestedStatus === 'completed_on_time'
    ? 'completed_on_time'
    : 'completed_late';
  const detail: LswDayStatusDetail = {
    completedAtIso,
    firstCompletedAtIso: getNonEmptyString(existingDetail.firstCompletedAtIso) || completedAtIso,
    firstCompletedOnTime: firstCompletedOnTimeAlready || finalStatus === 'completed_on_time',
    lastChangedAtIso: nowIso,
    status: finalStatus
  };
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
  return value === 'completed_on_time' || value === 'completed_late' || value === 'not_completed'
    ? value
    : fallback;
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
