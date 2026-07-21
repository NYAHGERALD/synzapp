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
export type LswDayStatus = 'not_completed' | 'completed_on_time' | 'completed_late' | 'completed_early';
export type LswDayCompletionTiming = 'not_completed' | 'within_window' | 'late' | 'early';
export type LswScheduledTaskFrequency = 'BI_WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
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

export interface LswDailyTasksResponse {
  tasks: LswDailyTask[];
  weekKey: string;
  workDaysPerWeek: WorkDaysPerWeek;
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

export interface KeyResultUnit {
  icon: string;
  label: string;
  sortOrder: number;
  status: string;
  suffix: string;
  unitId: string;
}

export interface KeyResultMetric {
  key: string;
  metricId: string;
  sortOrder: number;
  status: string;
  unitId: string;
  value: string;
}

export interface KeyResultGroup {
  groupId: string;
  metrics: KeyResultMetric[];
  name: string;
  sortOrder: number;
  status: string;
}

export interface CompanyKeyResultsConfig {
  groups: KeyResultGroup[];
  units: KeyResultUnit[];
  updatedAt: string | null;
  updatedByUid: string | null;
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

export interface LswTodoTaskPatch {
  completed?: boolean;
  completedAtIso?: string;
  dueDate?: string;
  dueTime?: string;
  sortOrder?: number;
  task?: string;
  timeZone?: string;
}

export interface LswMeetingRailPatch {
  completed?: boolean;
  dueDate?: string;
  dueTime?: string;
  rail?: string;
  sortOrder?: number;
  timeZone?: string;
}

export interface LswPersonalGoalPatch {
  dueDate?: string;
  objective?: string;
  progress?: number;
  sortOrder?: number;
  timeZone?: string;
}

export interface LswImprovementProjectPatch {
  project?: string;
  sortOrder?: number;
  updates?: LswImprovementProjectUpdate[];
}

export interface LswScheduledTaskPatch {
  dueDate?: string;
  frequency?: LswScheduledTaskFrequency;
  minutes?: number;
  sortOrder?: number;
  task?: string;
  timeZone?: string;
}

export interface LswFollowUpPatch {
  comments?: string;
  dueDate?: string;
  followUp?: string;
  responsible?: string;
  sortOrder?: number;
  timeZone?: string;
}

export interface LswRcaTriggerPatch {
  comments?: string;
  eventDate?: string;
  sortOrder?: number;
  timeZone?: string;
  trigger?: string;
}

export interface LswDayStatusUpdate {
  completedAtIso?: string;
  dueAtIso?: string;
  status: LswDayStatus;
  timeZone?: string;
}

interface LswContextOptions {
  timeZone?: string;
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

export async function listLswTodoTasks(options: LswContextOptions = {}): Promise<LswTodoTasksResponse> {
  const queryString = getLswQueryString(options);
  const body = await requestLswJson<{ todoTasks?: LswTodoTasksResponse }>(`/api/lsw/todo-tasks${queryString ? `?${queryString}` : ''}`);

  if (!body.todoTasks) {
    throw new Error('To-do tasks could not be loaded.');
  }

  return body.todoTasks;
}

export async function createLswTodoTask(
  input: LswTodoTaskPatch = {},
  options: LswContextOptions = {}
): Promise<LswTodoTask> {
  const queryString = getLswQueryString(options);
  const body = await requestLswJson<{ task?: LswTodoTask }>(`/api/lsw/todo-tasks${queryString ? `?${queryString}` : ''}`, {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST'
  });

  if (!body.task) {
    throw new Error('To-do task could not be created.');
  }

  return body.task;
}

export async function updateLswTodoTask(taskId: string, input: LswTodoTaskPatch): Promise<LswTodoTask> {
  const body = await requestLswJson<{ task?: LswTodoTask }>(`/api/lsw/todo-tasks/${encodeURIComponent(taskId)}`, {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'PATCH'
  });

  if (!body.task) {
    throw new Error('To-do task could not be updated.');
  }

  return body.task;
}

export async function deleteLswTodoTask(taskId: string): Promise<void> {
  await requestLswJson<void>(`/api/lsw/todo-tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE'
  });
}

export async function listLswMeetingRails(options: LswContextOptions = {}): Promise<LswMeetingRailsResponse> {
  const queryString = getLswQueryString(options);
  const body = await requestLswJson<{ meetingRails?: LswMeetingRailsResponse }>(`/api/lsw/meeting-rails${queryString ? `?${queryString}` : ''}`);

  if (!body.meetingRails) {
    throw new Error('Meeting rails could not be loaded.');
  }

  return body.meetingRails;
}

export async function createLswMeetingRail(
  input: LswMeetingRailPatch = {},
  options: LswContextOptions = {}
): Promise<LswMeetingRail> {
  const queryString = getLswQueryString(options);
  const body = await requestLswJson<{ rail?: LswMeetingRail }>(`/api/lsw/meeting-rails${queryString ? `?${queryString}` : ''}`, {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST'
  });

  if (!body.rail) {
    throw new Error('Meeting rail could not be created.');
  }

  return body.rail;
}

export async function updateLswMeetingRail(railId: string, input: LswMeetingRailPatch): Promise<LswMeetingRail> {
  const body = await requestLswJson<{ rail?: LswMeetingRail }>(`/api/lsw/meeting-rails/${encodeURIComponent(railId)}`, {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'PATCH'
  });

  if (!body.rail) {
    throw new Error('Meeting rail could not be updated.');
  }

  return body.rail;
}

export async function deleteLswMeetingRail(railId: string): Promise<void> {
  await requestLswJson<void>(`/api/lsw/meeting-rails/${encodeURIComponent(railId)}`, {
    method: 'DELETE'
  });
}

export async function listLswPersonalGoals(): Promise<LswPersonalGoalsResponse> {
  const body = await requestLswJson<{ personalGoals?: LswPersonalGoalsResponse }>('/api/lsw/personal-goals');

  if (!body.personalGoals) {
    throw new Error('Personal objectives could not be loaded.');
  }

  return body.personalGoals;
}

export async function createLswPersonalGoal(input: LswPersonalGoalPatch = {}): Promise<LswPersonalGoal> {
  const body = await requestLswJson<{ goal?: LswPersonalGoal }>('/api/lsw/personal-goals', {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST'
  });

  if (!body.goal) {
    throw new Error('Personal objective could not be created.');
  }

  return body.goal;
}

export async function updateLswPersonalGoal(goalId: string, input: LswPersonalGoalPatch): Promise<LswPersonalGoal> {
  const body = await requestLswJson<{ goal?: LswPersonalGoal }>(`/api/lsw/personal-goals/${encodeURIComponent(goalId)}`, {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'PATCH'
  });

  if (!body.goal) {
    throw new Error('Personal objective could not be updated.');
  }

  return body.goal;
}

export async function deleteLswPersonalGoal(goalId: string): Promise<void> {
  await requestLswJson<void>(`/api/lsw/personal-goals/${encodeURIComponent(goalId)}`, {
    method: 'DELETE'
  });
}

export async function listLswImprovementProjects(): Promise<LswImprovementProjectsResponse> {
  const body = await requestLswJson<{ improvementProjects?: LswImprovementProjectsResponse }>('/api/lsw/improvement-projects');

  if (!body.improvementProjects) {
    throw new Error('Improvement projects could not be loaded.');
  }

  return body.improvementProjects;
}

export async function createLswImprovementProject(input: LswImprovementProjectPatch = {}): Promise<LswImprovementProject> {
  const body = await requestLswJson<{ project?: LswImprovementProject }>('/api/lsw/improvement-projects', {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST'
  });

  if (!body.project) {
    throw new Error('Improvement project could not be created.');
  }

  return body.project;
}

export async function updateLswImprovementProject(
  projectId: string,
  input: LswImprovementProjectPatch
): Promise<LswImprovementProject> {
  const body = await requestLswJson<{ project?: LswImprovementProject }>(
    `/api/lsw/improvement-projects/${encodeURIComponent(projectId)}`,
    {
      body: JSON.stringify(input),
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'PATCH'
    }
  );

  if (!body.project) {
    throw new Error('Improvement project could not be updated.');
  }

  return body.project;
}

export async function deleteLswImprovementProject(projectId: string): Promise<void> {
  await requestLswJson<void>(`/api/lsw/improvement-projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE'
  });
}

export async function listLswScheduledTasks(): Promise<LswScheduledTasksResponse> {
  const body = await requestLswJson<{ scheduledTasks?: LswScheduledTasksResponse }>('/api/lsw/scheduled-tasks');

  if (!body.scheduledTasks) {
    throw new Error('Scheduled tasks could not be loaded.');
  }

  return body.scheduledTasks;
}

export async function createLswScheduledTask(input: LswScheduledTaskPatch = {}): Promise<LswScheduledTask> {
  const body = await requestLswJson<{ task?: LswScheduledTask }>('/api/lsw/scheduled-tasks', {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST'
  });

  if (!body.task) {
    throw new Error('Scheduled task could not be created.');
  }

  return body.task;
}

export async function updateLswScheduledTask(taskId: string, input: LswScheduledTaskPatch): Promise<LswScheduledTask> {
  const body = await requestLswJson<{ task?: LswScheduledTask }>(`/api/lsw/scheduled-tasks/${encodeURIComponent(taskId)}`, {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'PATCH'
  });

  if (!body.task) {
    throw new Error('Scheduled task could not be updated.');
  }

  return body.task;
}

export async function deleteLswScheduledTask(taskId: string): Promise<void> {
  await requestLswJson<void>(`/api/lsw/scheduled-tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE'
  });
}

export async function listLswKeyResults(): Promise<CompanyKeyResultsConfig> {
  const body = await requestLswJson<{ keyResults?: CompanyKeyResultsConfig }>('/api/lsw/key-results');

  if (!body.keyResults) {
    throw new Error('Key results could not be loaded.');
  }

  return body.keyResults;
}

export async function listLswFollowUps(): Promise<LswFollowUpsResponse> {
  const body = await requestLswJson<{ followUps?: LswFollowUpsResponse }>('/api/lsw/follow-ups');

  if (!body.followUps) {
    throw new Error('Follow ups could not be loaded.');
  }

  return body.followUps;
}

export async function createLswFollowUp(input: LswFollowUpPatch = {}): Promise<LswFollowUp> {
  const body = await requestLswJson<{ followUp?: LswFollowUp }>('/api/lsw/follow-ups', {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST'
  });

  if (!body.followUp) {
    throw new Error('Follow up could not be created.');
  }

  return body.followUp;
}

export async function updateLswFollowUp(followUpId: string, input: LswFollowUpPatch): Promise<LswFollowUp> {
  const body = await requestLswJson<{ followUp?: LswFollowUp }>(`/api/lsw/follow-ups/${encodeURIComponent(followUpId)}`, {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'PATCH'
  });

  if (!body.followUp) {
    throw new Error('Follow up could not be updated.');
  }

  return body.followUp;
}

export async function deleteLswFollowUp(followUpId: string): Promise<void> {
  await requestLswJson<void>(`/api/lsw/follow-ups/${encodeURIComponent(followUpId)}`, {
    method: 'DELETE'
  });
}

export async function listLswRcaTriggers(): Promise<LswRcaTriggersResponse> {
  const body = await requestLswJson<{ rcaTriggers?: LswRcaTriggersResponse }>('/api/lsw/rca-triggers');

  if (!body.rcaTriggers) {
    throw new Error('RCA triggers could not be loaded.');
  }

  return body.rcaTriggers;
}

export async function createLswRcaTrigger(input: LswRcaTriggerPatch = {}): Promise<LswRcaTrigger> {
  const body = await requestLswJson<{ trigger?: LswRcaTrigger }>('/api/lsw/rca-triggers', {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST'
  });

  if (!body.trigger) {
    throw new Error('RCA trigger could not be created.');
  }

  return body.trigger;
}

export async function updateLswRcaTrigger(triggerId: string, input: LswRcaTriggerPatch): Promise<LswRcaTrigger> {
  const body = await requestLswJson<{ trigger?: LswRcaTrigger }>(`/api/lsw/rca-triggers/${encodeURIComponent(triggerId)}`, {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'PATCH'
  });

  if (!body.trigger) {
    throw new Error('RCA trigger could not be updated.');
  }

  return body.trigger;
}

export async function deleteLswRcaTrigger(triggerId: string): Promise<void> {
  await requestLswJson<void>(`/api/lsw/rca-triggers/${encodeURIComponent(triggerId)}`, {
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
  const timeZone = options.timeZone || getBrowserTimeZone();

  if (timeZone) {
    params.set('timeZone', timeZone);
  }

  if (typeof options.week === 'number') {
    params.set('week', String(options.week));
  }

  if (typeof options.year === 'number') {
    params.set('year', String(options.year));
  }

  return params.toString();
}

function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
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
