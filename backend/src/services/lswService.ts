import { DecodedIdToken } from 'firebase-admin/auth';
import { firestore } from '../config/firebaseAdmin.js';
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

export async function getLswContext(
  decodedToken: DecodedIdToken,
  input: LswContextInput = {}
): Promise<LswContextResponse> {
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

  const calendar = mapCalendarYearSettings(organization);
  const department = await resolveUserDepartment(tenantId, user, role);
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
      companyName: organization.companyName || 'Your organization',
      tenantId
    },
    department,
    storageScope: {
      departmentId: department.departmentId,
      tenantId,
      weekKey: `${week.selectedYear}-W${String(week.selectedWeek).padStart(2, '0')}`
    },
    user: {
      displayName: getDisplayName(user),
      role,
      roleName: formatRoleName(user.roleName, role),
      uid: decodedToken.uid
    },
    week
  };
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
