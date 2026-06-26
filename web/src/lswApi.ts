import { getSynzappApiBaseUrl } from './config';
import {
  getAppCheckHeader,
  getSynzappFirebaseAuth
} from './firebase';

export interface LswContext {
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
    workDaysPerWeek: WorkDaysPerWeek;
  };
  user: {
    displayName: string;
    role: string;
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

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type LswDayStatus = 'not_completed' | 'completed_on_time' | 'completed_late';
export type WorkDaysPerWeek = 5 | 6 | 7;

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

export interface LswDailyTasksResponse {
  tasks: LswDailyTask[];
  weekKey: string;
  workDaysPerWeek: WorkDaysPerWeek;
}

export interface LswDailyTaskPatch {
  days?: Partial<Record<DayKey, boolean>>;
  dayStatusDetails?: Partial<Record<DayKey, LswDayStatusDetail>>;
  dayStatuses?: Partial<Record<DayKey, LswDayStatus>>;
  dayStatusUpdates?: Partial<Record<DayKey, LswDayStatusUpdate>>;
  minutes?: number;
  sortOrder?: number;
  task?: string;
  time?: string;
}

export interface LswDayStatusUpdate {
  completedAtIso?: string;
  dueAtIso?: string;
  status: LswDayStatus;
  timeZone?: string;
}

interface LswContextOptions {
  week?: number;
  year?: number;
}

export async function getLswContext(options: LswContextOptions = {}): Promise<LswContext> {
  const queryString = getLswQueryString(options);
  const body = await requestLswJson<{ context?: LswContext }>(`/api/lsw/context${queryString ? `?${queryString}` : ''}`);

  if (!body.context) {
    throw new Error('The LSW workspace could not be loaded.');
  }

  return body.context;
}

export async function listLswDailyTasks(options: LswContextOptions = {}): Promise<LswDailyTasksResponse> {
  const queryString = getLswQueryString(options);
  const body = await requestLswJson<{ dailyTasks?: LswDailyTasksResponse }>(`/api/lsw/daily-tasks${queryString ? `?${queryString}` : ''}`);

  if (!body.dailyTasks) {
    throw new Error('Daily tasks could not be loaded.');
  }

  return body.dailyTasks;
}

export async function createLswDailyTask(
  input: LswDailyTaskPatch = {},
  options: LswContextOptions = {}
): Promise<LswDailyTask> {
  const queryString = getLswQueryString(options);
  const body = await requestLswJson<{ task?: LswDailyTask }>(`/api/lsw/daily-tasks${queryString ? `?${queryString}` : ''}`, {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST'
  });

  if (!body.task) {
    throw new Error('Daily task could not be created.');
  }

  return body.task;
}

export async function updateLswDailyTask(
  taskId: string,
  input: LswDailyTaskPatch,
  options: LswContextOptions = {}
): Promise<LswDailyTask> {
  const queryString = getLswQueryString(options);
  const body = await requestLswJson<{ task?: LswDailyTask }>(`/api/lsw/daily-tasks/${encodeURIComponent(taskId)}${queryString ? `?${queryString}` : ''}`, {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'PATCH'
  });

  if (!body.task) {
    throw new Error('Daily task could not be updated.');
  }

  return body.task;
}

export async function deleteLswDailyTask(taskId: string): Promise<void> {
  await requestLswJson<void>(`/api/lsw/daily-tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE'
  });
}

export async function updateLswSettings(workDaysPerWeek: WorkDaysPerWeek): Promise<{ workDaysPerWeek: WorkDaysPerWeek }> {
  const body = await requestLswJson<{ settings?: { workDaysPerWeek: WorkDaysPerWeek } }>('/api/lsw/settings', {
    body: JSON.stringify({ workDaysPerWeek }),
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'PATCH'
  });

  if (!body.settings) {
    throw new Error('LSW settings could not be updated.');
  }

  return body.settings;
}

function getLswQueryString(options: LswContextOptions): string {
  const params = new URLSearchParams();

  if (typeof options.week === 'number') {
    params.set('week', String(options.week));
  }

  if (typeof options.year === 'number') {
    params.set('year', String(options.year));
  }

  return params.toString();
}

async function requestLswJson<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const user = getSynzappFirebaseAuth().currentUser;

  if (!user) {
    throw new Error('You are not signed in.');
  }

  const idToken = await user.getIdToken();
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 15_000);
  let response: Response;

  try {
    response = await fetch(`${getSynzappApiBaseUrl()}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${idToken}`,
        ...options.headers,
        ...await getAppCheckHeader()
      },
      method: options.method || 'GET',
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The LSW workspace took too long to load. Please try again.');
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'The LSW workspace could not be loaded.'));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function getResponseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();

    if (typeof body?.error === 'string') {
      return body.error;
    }
  } catch {
    return fallback;
  }

  return fallback;
}
