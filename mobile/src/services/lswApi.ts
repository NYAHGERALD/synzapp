import { getSynzappApiBaseUrl } from './apiConfig';
import { getRegisteredDeviceHeaders } from './deviceIdentity';

export type LswDayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type LswDayStatusValue = 'completed_early' | 'completed_late' | 'completed_on_time' | 'not_completed';
export type LswScheduledTaskFrequency = 'ANNUALLY' | 'BI_WEEKLY' | 'MONTHLY' | 'QUARTERLY';

export interface LswContextOptions {
  observeUserId?: string;
  timeZone?: string;
  week?: number;
  year?: number;
}

export interface LswWeekContext {
  isCurrentWeek?: boolean;
  selectedWeek: number;
  selectedYear?: number;
  todayIso?: string;
  weekBeginning: string;
  weekEnding: string;
  weekKey: string;
  year?: number;
}

export interface LswSettingsSummary {
  workDaysPerWeek: 5 | 6 | 7;
}

export interface LswWorkspaceContext {
  isObservation: boolean;
  isReadOnly: boolean;
  settings: LswSettingsSummary;
  week: LswWeekContext;
}

export interface LswDailyTaskDayStatus {
  completedAtIso?: string | null;
  dueAtIso?: string | null;
  status: LswDayStatusValue;
  timeZone?: string;
}

export type LswDaySelection = Partial<Record<LswDayKey, boolean>>;
export type LswDayStatusDetails = Partial<Record<LswDayKey, LswDailyTaskDayStatus>>;

export interface LswDailyTask {
  dayStatuses: LswDayStatusDetails;
  days: LswDaySelection;
  minutes: number;
  sortOrder: number;
  status: string;
  task: string;
  taskId: string;
  time: string;
  weekKey?: string;
}

export interface LswDailyTaskPatch {
  dayStatusUpdates?: LswDayStatusDetails;
  days?: LswDaySelection;
  minutes?: number;
  sortOrder?: number;
  task?: string;
  time?: string;
}

export interface LswDailyTasksResponse {
  tasks: LswDailyTask[];
}

export interface CreateLswTodoTaskInput {
  completed?: boolean;
  completedAtIso?: string;
  dueDate: string;
  dueTime: string;
  sortOrder?: number;
  task: string;
  timeZone?: string;
}

export interface LswTodoTaskSummary {
  completed: boolean;
  completedAtIso?: string | null;
  dueDate: string;
  dueTime: string;
  sortOrder: number;
  status: string;
  task: string;
  taskId: string;
  timeZone: string;
  weekKey?: string;
}

export type LswTodoTaskPatch = Partial<CreateLswTodoTaskInput>;

export interface LswTodoTasksResponse {
  tasks: LswTodoTaskSummary[];
}

export interface CreateLswFollowUpInput {
  comments?: string;
  dueDate: string;
  followUp: string;
  responsible: string;
  sortOrder?: number;
  timeZone?: string;
}

export interface LswFollowUpSummary {
  comments: string;
  dueDate: string;
  followUp: string;
  followUpId: string;
  responsible: string;
  sortOrder: number;
  status: string;
  timeZone: string;
}

export type LswFollowUpPatch = Partial<CreateLswFollowUpInput>;

export interface LswFollowUpsResponse {
  followUps: LswFollowUpSummary[];
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

export interface LswScheduledTaskPatch {
  dueDate?: string;
  frequency?: LswScheduledTaskFrequency;
  minutes?: number;
  sortOrder?: number;
  task?: string;
  timeZone?: string;
}

export interface LswScheduledTasksResponse {
  tasks: LswScheduledTask[];
}

interface LswContextResponse {
  context?: LswWorkspaceContext;
}

interface ListDailyTasksResponse {
  dailyTasks?: LswDailyTasksResponse;
}

interface CreateTodoTaskResponse {
  task?: LswTodoTaskSummary;
}

interface ListTodoTasksResponse {
  todoTasks?: LswTodoTasksResponse;
}

interface CreateFollowUpResponse {
  followUp?: LswFollowUpSummary;
}

interface ListFollowUpsResponse {
  followUps?: LswFollowUpsResponse;
}

interface CreateDailyTaskResponse {
  task?: LswDailyTask;
}

interface CreateScheduledTaskResponse {
  task?: LswScheduledTask;
}

interface ListScheduledTasksResponse {
  scheduledTasks?: LswScheduledTasksResponse;
}

export async function getLswContext(
  idToken: string,
  options: LswContextOptions = {}
): Promise<LswWorkspaceContext> {
  const body = await requestLswJson<LswContextResponse>(idToken, `/api/lsw/context${getLswQuerySuffix(options)}`);

  if (!body.context) {
    throw new Error('The LSW workspace could not be loaded.');
  }

  return body.context;
}

export async function listLswDailyTasks(
  idToken: string,
  options: LswContextOptions = {}
): Promise<LswDailyTasksResponse> {
  const body = await requestLswJson<ListDailyTasksResponse>(idToken, `/api/lsw/daily-tasks${getLswQuerySuffix(options)}`);

  if (!body.dailyTasks) {
    throw new Error('Daily and weekly standard tasks could not be loaded.');
  }

  return body.dailyTasks;
}

export async function createLswDailyTask(
  idToken: string,
  input: LswDailyTaskPatch,
  options: LswContextOptions = {}
): Promise<LswDailyTask> {
  const body = await requestLswJson<CreateDailyTaskResponse>(idToken, `/api/lsw/daily-tasks${getLswQuerySuffix(options)}`, {
    body: JSON.stringify(input),
    method: 'POST'
  });

  if (!body.task) {
    throw new Error('Daily and weekly standard task could not be created.');
  }

  return body.task;
}

export async function updateLswDailyTask(
  idToken: string,
  taskId: string,
  input: LswDailyTaskPatch,
  options: LswContextOptions = {}
): Promise<LswDailyTask> {
  const body = await requestLswJson<CreateDailyTaskResponse>(
    idToken,
    `/api/lsw/daily-tasks/${encodeURIComponent(taskId)}${getLswQuerySuffix(options)}`,
    {
      body: JSON.stringify(input),
      method: 'PATCH'
    }
  );

  if (!body.task) {
    throw new Error('Daily and weekly standard task could not be updated.');
  }

  return body.task;
}

export async function deleteLswDailyTask(idToken: string, taskId: string): Promise<void> {
  await requestLswJson<void>(idToken, `/api/lsw/daily-tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE'
  });
}

export async function listLswTodoTasks(
  idToken: string,
  options: LswContextOptions = {}
): Promise<LswTodoTasksResponse> {
  const body = await requestLswJson<ListTodoTasksResponse>(idToken, `/api/lsw/todo-tasks${getLswQuerySuffix(options)}`);

  if (!body.todoTasks) {
    throw new Error('To Do items could not be loaded.');
  }

  return body.todoTasks;
}

export async function createLswTodoTask(
  idToken: string,
  input: CreateLswTodoTaskInput
): Promise<LswTodoTaskSummary> {
  const body = await requestLswJson<CreateTodoTaskResponse>(idToken, '/api/lsw/todo-tasks', {
    body: JSON.stringify(input),
    method: 'POST'
  });

  if (!body.task) {
    throw new Error('To Do item could not be created.');
  }

  return body.task;
}

export async function updateLswTodoTask(
  idToken: string,
  taskId: string,
  input: LswTodoTaskPatch
): Promise<LswTodoTaskSummary> {
  const body = await requestLswJson<CreateTodoTaskResponse>(idToken, `/api/lsw/todo-tasks/${encodeURIComponent(taskId)}`, {
    body: JSON.stringify(input),
    method: 'PATCH'
  });

  if (!body.task) {
    throw new Error('To Do item could not be updated.');
  }

  return body.task;
}

export async function deleteLswTodoTask(idToken: string, taskId: string): Promise<void> {
  await requestLswJson<void>(idToken, `/api/lsw/todo-tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE'
  });
}

export async function listLswFollowUps(
  idToken: string,
  options: LswContextOptions = {}
): Promise<LswFollowUpsResponse> {
  const body = await requestLswJson<ListFollowUpsResponse>(idToken, `/api/lsw/follow-ups${getLswQuerySuffix(options)}`);

  if (!body.followUps) {
    throw new Error('Follow Ups could not be loaded.');
  }

  return body.followUps;
}

export async function createLswFollowUp(
  idToken: string,
  input: CreateLswFollowUpInput
): Promise<LswFollowUpSummary> {
  const body = await requestLswJson<CreateFollowUpResponse>(idToken, '/api/lsw/follow-ups', {
    body: JSON.stringify(input),
    method: 'POST'
  });

  if (!body.followUp) {
    throw new Error('Follow Up could not be created.');
  }

  return body.followUp;
}

export async function updateLswFollowUp(
  idToken: string,
  followUpId: string,
  input: LswFollowUpPatch
): Promise<LswFollowUpSummary> {
  const body = await requestLswJson<CreateFollowUpResponse>(idToken, `/api/lsw/follow-ups/${encodeURIComponent(followUpId)}`, {
    body: JSON.stringify(input),
    method: 'PATCH'
  });

  if (!body.followUp) {
    throw new Error('Follow Up could not be updated.');
  }

  return body.followUp;
}

export async function deleteLswFollowUp(idToken: string, followUpId: string): Promise<void> {
  await requestLswJson<void>(idToken, `/api/lsw/follow-ups/${encodeURIComponent(followUpId)}`, {
    method: 'DELETE'
  });
}

export async function listLswScheduledTasks(
  idToken: string,
  options: LswContextOptions = {}
): Promise<LswScheduledTasksResponse> {
  const body = await requestLswJson<ListScheduledTasksResponse>(idToken, `/api/lsw/scheduled-tasks${getLswQuerySuffix(options)}`);

  if (!body.scheduledTasks) {
    throw new Error('Scheduled tasks and meetings could not be loaded.');
  }

  return body.scheduledTasks;
}

export async function createLswScheduledTask(
  idToken: string,
  input: LswScheduledTaskPatch
): Promise<LswScheduledTask> {
  const body = await requestLswJson<CreateScheduledTaskResponse>(idToken, '/api/lsw/scheduled-tasks', {
    body: JSON.stringify(input),
    method: 'POST'
  });

  if (!body.task) {
    throw new Error('Scheduled task or meeting could not be created.');
  }

  return body.task;
}

export async function updateLswScheduledTask(
  idToken: string,
  taskId: string,
  input: LswScheduledTaskPatch
): Promise<LswScheduledTask> {
  const body = await requestLswJson<CreateScheduledTaskResponse>(idToken, `/api/lsw/scheduled-tasks/${encodeURIComponent(taskId)}`, {
    body: JSON.stringify(input),
    method: 'PATCH'
  });

  if (!body.task) {
    throw new Error('Scheduled task or meeting could not be updated.');
  }

  return body.task;
}

export async function deleteLswScheduledTask(idToken: string, taskId: string): Promise<void> {
  await requestLswJson<void>(idToken, `/api/lsw/scheduled-tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE'
  });
}

async function requestLswJson<T>(
  idToken: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const deviceHeaders = await getRegisteredDeviceHeaders(idToken);
  const response = await fetch(`${getSynzappApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...deviceHeaders,
      ...(init.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(await getLswResponseErrorMessage(response, 'The LSW request could not be completed.'));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function getLswQuerySuffix(options: LswContextOptions): string {
  const params = new URLSearchParams();

  if (options.observeUserId) {
    params.set('observeUserId', options.observeUserId);
  }

  if (options.timeZone) {
    params.set('timeZone', options.timeZone);
  }

  if (typeof options.week === 'number') {
    params.set('week', String(options.week));
  }

  if (typeof options.year === 'number') {
    params.set('year', String(options.year));
  }

  const queryString = params.toString();

  return queryString ? `?${queryString}` : '';
}

async function getLswResponseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json() as { error?: string; message?: string };
    return body.message || body.error || `${fallback} (${response.status})`;
  } catch {
    return `${fallback} (${response.status})`;
  }
}
