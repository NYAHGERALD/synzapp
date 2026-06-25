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
  minutes: number;
  sortOrder: number;
  status: string;
  task: string;
  taskId: string;
  time: string;
}

export interface LswDailyTasksResponse {
  tasks: LswDailyTask[];
  workDaysPerWeek: number;
}

export interface LswDailyTaskInput {
  days?: Partial<Record<DayKey, boolean>>;
  minutes?: number;
  sortOrder?: number;
  task?: string;
  time?: string;
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
const DAILY_TASK_SECTION_KEY = 'daily_weekly_standard_tasks';
const DEFAULT_WORK_DAYS_PER_WEEK = 5;
const ALL_DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DEFAULT_DAILY_TASKS: LswDailyTaskInput[] = [
  {
    days: { fri: false, mon: true, thu: true, tue: true, wed: true },
    minutes: 15,
    sortOrder: 1000,
    task: 'Review line readiness, staffing, and handoff notes',
    time: '07:30'
  },
  {
    days: { fri: false, mon: true, thu: true, tue: true, wed: true },
    minutes: 30,
    sortOrder: 2000,
    task: 'Gemba walk: safety, quality, people, delivery, and cost checks',
    time: '08:15'
  },
  {
    days: { fri: false, mon: true, thu: false, tue: true, wed: true },
    minutes: 20,
    sortOrder: 3000,
    task: 'Daily production review with supervisors',
    time: '09:00'
  },
  {
    days: { fri: false, mon: false, thu: true, tue: false, wed: true },
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
      weekKey: `${week.selectedYear}-W${String(week.selectedWeek).padStart(2, '0')}`
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

export async function listLswDailyTasks(decodedToken: DecodedIdToken): Promise<LswDailyTasksResponse> {
  const context = await getAuthorizedLswContext(decodedToken);

  await seedDefaultDailyTasksIfEmpty(context);

  const snapshot = await context.lswProfileRef
    .collection(LSW_DAILY_TASKS_COLLECTION)
    .orderBy('sortOrder', 'asc')
    .get();
  const tasks = snapshot.docs
    .map((doc) => mapDailyTask(doc.id, doc.data() as LswDailyTaskRecord))
    .filter((task) => task.status === 'ACTIVE');

  return {
    tasks,
    workDaysPerWeek: context.lswProfile.workDaysPerWeek
  };
}

export async function createLswDailyTask(
  decodedToken: DecodedIdToken,
  input: LswDailyTaskInput = {}
): Promise<LswDailyTask> {
  const context = await getAuthorizedLswContext(decodedToken);
  const taskRef = context.lswProfileRef.collection(LSW_DAILY_TASKS_COLLECTION).doc();
  const sortOrder = input.sortOrder ?? await getNextDailyTaskSortOrder(context);
  const record = buildDailyTaskRecord(context, taskRef.id, {
    days: input.days || getDefaultDaysForWorkDays(context.lswProfile.workDaysPerWeek),
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

  return mapDailyTask(taskRef.id, record);
}

export async function updateLswDailyTask(
  decodedToken: DecodedIdToken,
  taskId: string,
  input: LswDailyTaskInput
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

  const update: Record<string, unknown> = {
    departmentId: context.department.departmentId,
    departmentName: context.department.name,
    updatedAt: fieldValue.serverTimestamp()
  };

  if (input.days) {
    update.days = normalizeDays(input.days, normalizeDays(existingRecord.days));
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

  if (input.time !== undefined) {
    update.time = normalizeTaskTime(input.time);
  }

  await taskRef.set(update, { merge: true });
  const refreshedSnapshot = await taskRef.get();

  return mapDailyTask(taskId, refreshedSnapshot.data() as LswDailyTaskRecord);
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

function buildDailyTaskRecord(
  context: AuthorizedLswContext,
  taskId: string,
  input: LswDailyTaskInput
): LswDailyTaskRecord {
  return {
    companyId: context.tenantId,
    days: normalizeDays(input.days),
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

function mapDailyTask(taskId: string, record: LswDailyTaskRecord): LswDailyTask {
  return {
    days: normalizeDays(record.days),
    minutes: normalizeMinutes(record.minutes ?? 0),
    sortOrder: normalizeSortOrder(record.sortOrder ?? 0),
    status: record.status || 'ACTIVE',
    task: record.task || '',
    taskId: record.taskId || taskId,
    time: isValidTaskTime(record.time) ? record.time || '08:00' : '08:00'
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

function getDefaultDaysForWorkDays(workDaysPerWeek: number): Record<DayKey, boolean> {
  const normalized = getEmptyDays();
  const visibleDayCount = normalizeWorkDaysPerWeek(workDaysPerWeek);

  ALL_DAY_KEYS.slice(0, visibleDayCount).forEach((dayKey) => {
    normalized[dayKey] = true;
  });

  return normalized;
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
