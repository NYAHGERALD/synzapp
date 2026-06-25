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
  minutes: number;
  sortOrder: number;
  status: string;
  task: string;
  taskId: string;
  time: string;
}

export interface LswDailyTasksResponse {
  tasks: LswDailyTask[];
  workDaysPerWeek: WorkDaysPerWeek;
}

export interface LswDailyTaskPatch {
  days?: Partial<Record<DayKey, boolean>>;
  minutes?: number;
  sortOrder?: number;
  task?: string;
  time?: string;
}

interface LswContextOptions {
  week?: number;
  year?: number;
}

export async function getLswContext(options: LswContextOptions = {}): Promise<LswContext> {
  const params = new URLSearchParams();

  if (typeof options.week === 'number') {
    params.set('week', String(options.week));
  }

  if (typeof options.year === 'number') {
    params.set('year', String(options.year));
  }

  const queryString = params.toString();
  const body = await requestLswJson<{ context?: LswContext }>(`/api/lsw/context${queryString ? `?${queryString}` : ''}`);

  if (!body.context) {
    throw new Error('The LSW workspace could not be loaded.');
  }

  return body.context;
}

export async function listLswDailyTasks(): Promise<LswDailyTasksResponse> {
  const body = await requestLswJson<{ dailyTasks?: LswDailyTasksResponse }>('/api/lsw/daily-tasks');

  if (!body.dailyTasks) {
    throw new Error('Daily tasks could not be loaded.');
  }

  return body.dailyTasks;
}

export async function createLswDailyTask(input: LswDailyTaskPatch = {}): Promise<LswDailyTask> {
  const body = await requestLswJson<{ task?: LswDailyTask }>('/api/lsw/daily-tasks', {
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

export async function updateLswDailyTask(taskId: string, input: LswDailyTaskPatch): Promise<LswDailyTask> {
  const body = await requestLswJson<{ task?: LswDailyTask }>(`/api/lsw/daily-tasks/${encodeURIComponent(taskId)}`, {
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
