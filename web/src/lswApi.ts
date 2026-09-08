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
  observation: {
    canObserve: boolean;
    isObserving: boolean;
    observedUser: LswObservationCandidate | null;
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

export interface LswObservationCandidate {
  availability: LswObservationAvailability;
  availabilityLabel: string;
  departmentId: string | null;
  departmentName: string;
  displayName: string;
  profilePhotoCacheKey: string | null;
  profilePhotoUrl: string | null;
  role: string;
  roleName: string;
  uid: string;
}

export type LswObservationAvailability = 'ACTIVE' | 'ON_LEAVE' | 'TEMPORARILY_UNAVAILABLE';

export interface LswObservationVisitorSummary {
  departmentName: string;
  displayName: string;
  lastViewedAtIso: string | null;
  profilePhotoCacheKey: string | null;
  profilePhotoUrl: string | null;
  roleName: string;
  uid: string;
  viewCount: number;
}

export interface LswObservationAvailabilityHistorySummary {
  availability: LswObservationAvailability;
  availabilityLabel: string;
  changedAtIso: string | null;
  changedBy: {
    departmentName: string;
    displayName: string;
    roleName: string;
    uid: string;
  };
  endDate: string | null;
  note: string;
  startDate: string | null;
}

export interface LswObservationStatus {
  availability: LswObservationAvailability;
  availabilityEndDate: string | null;
  availabilityHistory: LswObservationAvailabilityHistorySummary[];
  availabilityLabel: string;
  availabilityNote: string;
  availabilityStartDate: string | null;
  lastObservedAtIso: string | null;
  noteCount: number;
  recentVisitors: LswObservationVisitorSummary[];
  viewedBy: LswObservationVisitorSummary[];
  weekKey: string;
}

export interface LswObservationNote {
  author: {
    departmentName: string;
    displayName: string;
    profilePhotoCacheKey: string | null;
    profilePhotoUrl: string | null;
    roleName: string;
    uid: string;
  };
  body: string;
  canWithdraw: boolean;
  createdAtIso: string | null;
  noteId: string;
  sectionKey: LswVerificationSectionKey;
  sectionTitle: string;
  weekKey: string;
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

export type LswVerificationSectionKey =
  | 'daily_weekly_standard_tasks'
  | 'plant_specific_cause_rca_triggers'
  | 'to_do_today_this_week'
  | 'level_1_2_3_meeting_rails'
  | 'improvement_projects_updates'
  | 'follow_ups'
  | 'scheduled_tasks_meetings'
  | 'personal_objectives_goals';

export interface LswVerificationSectionSummary {
  completedCount: number;
  completionRate: number;
  expectedCount: number;
  lateCount: number;
  missingCount: number;
  needsReviewCount: number;
  sectionKey: LswVerificationSectionKey;
  targetCompletionRate: number;
  title: string;
}

export interface LswVerificationDayMetric {
  completedCount: number;
  completionRate: number;
  dayKey: DayKey;
  dayLabel: string;
  dateLabel: string;
  dueState: 'complete' | 'late' | 'no_work' | 'not_due' | 'overdue' | 'partial';
  expectedCount: number;
  isoDate: string;
  lateCount: number;
  lastCheckoffIso?: string | null;
  missingCount: number;
  onTimeCount?: number;
}

export type LswVerificationDailyMetrics = Partial<Record<
  Extract<
    LswVerificationSectionKey,
    'daily_weekly_standard_tasks' | 'level_1_2_3_meeting_rails' | 'to_do_today_this_week'
  >,
  LswVerificationDayMetric[]
>>;

export interface LswVerificationUserSummary {
  completedCount: number;
  completionRate: number;
  dailyMetrics: LswVerificationDailyMetrics;
  departmentId: string | null;
  departmentName: string;
  displayName: string;
  expectedCount: number;
  lateCount: number;
  missingCount: number;
  needsReviewCount: number;
  role: string;
  roleName: string;
  sections: LswVerificationSectionSummary[];
  status: 'COMPLETE' | 'IN_PROGRESS' | 'NOT_STARTED';
  uid: string;
}

export interface LswVerificationDepartmentSummary {
  completedCount: number;
  completionRate: number;
  departmentId: string | null;
  departmentName: string;
  expectedCount: number;
  lateCount: number;
  missingCount: number;
  needsReviewCount: number;
  userCount: number;
}

export interface LswVerificationTotalsSummary {
  attentionCount: number;
  averageDepartmentCompletion: number;
  completedCount: number;
  completedUsers: number;
  completionRate: number;
  expectedCount: number;
  inProgressUsers: number;
  lateCount: number;
  missingCount: number;
  needsReviewCount: number;
  notStartedUsers: number;
  userCount: number;
}

export interface LswVerificationPeopleSummary {
  attentionUsers: LswVerificationUserSummary[];
  departments: LswVerificationDepartmentSummary[];
  statusMix: {
    complete: number;
    inProgress: number;
    notStarted: number;
  };
  verificationUsers: LswVerificationUserSummary[];
}

export interface LswVerificationSidebarSummary {
  periodLabel: string;
  scopeLabel: string;
  scopeName: string;
  scopeSubtitle: string;
  workstreams: Array<{
    completionRate: number;
    key: 'LSW' | 'RAILS' | 'RCA';
    label: string;
  }>;
}

export interface LswVerificationTrendPoint {
  attentionCount: number;
  completedCount: number;
  completionRate: number;
  departments: LswVerificationDepartmentSummary[];
  expectedCount: number;
  sections: LswVerificationSectionSummary[];
  weekBeginningLabel: string;
  weekEndingLabel: string;
  weekKey: string;
}

export interface LswAdminDashboardOverview {
  lsw: {
    standardWork: {
      activeUserCount: number;
      completedCount: number;
      completionRate: number;
      dayMetrics: Array<{
        completedCount: number;
        completionRate: number;
        dateLabel: string;
        dayLabel: string;
        dueState?: LswVerificationDayMetric['dueState'];
        expectedCount: number;
        isoDate: string;
        lateCount: number;
        missingCount: number;
        onTimeCount: number;
      }>;
      expectedCount: number;
      lateCount: number;
      completedLateCount?: number;
      missedCount?: number;
      missingCount: number;
      onTimeCount: number;
      onTimeRate: number;
      openTodayCount?: number;
      userMetrics: Array<{
        completedCount: number;
        completedLateCount?: number;
        completionRate: number;
        departmentName: string;
        displayName: string;
        expectedCount: number;
        lateCount: number;
        lastCheckoffIso: string | null;
        missedCount?: number;
        missingCount: number;
        onTimeCount: number;
        onTimeRate: number;
        openTodayCount?: number;
        uid: string;
      }>;
      usersWithActivityCount: number;
      weekToDateDayCount: number;
    };
    upcomingPersonalTasks: Array<{
      dateLabel: string;
      section: string;
      status: 'Due this week' | 'Past due';
      title: string;
    }>;
  };
  rails: {
    byDepartment: Array<{ label: string; value: number }>;
    byResponsibleParty: Array<{ label: string; value: number }>;
    closedCount: number;
    inProgressCount: number;
    openCount: number;
    pastDueCount: number;
    totalCount: number;
  };
  rca: {
    closedCount: number;
    createdByMeCount: number;
    createdByTeamCount: number;
    openCount: number;
    sharedCount: number;
    totalCount: number;
  };
}

export interface LswVerificationSummaryResponse {
  dashboard: LswAdminDashboardOverview;
  departments: LswVerificationDepartmentSummary[];
  generatedAtIso: string;
  people: LswVerificationPeopleSummary;
  sidebar: LswVerificationSidebarSummary;
  scope: {
    departmentId: string | null;
    departmentName: string;
    role: string;
    scopeType: 'DEPARTMENT' | 'ORGANIZATION';
    tenantId: string;
  };
  sections: LswVerificationSectionSummary[];
  totals: LswVerificationTotalsSummary;
  trends: LswVerificationTrendPoint[];
  users: LswVerificationUserSummary[];
  week: LswContext['week'] & {
    weekKey: string;
  };
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
  observeUserId?: string;
  timeZone?: string;
  week?: number;
  year?: number;
}

interface LswExcelExportDownloadOptions extends LswContextOptions {
  fallbackFileName?: string;
}

export async function getLswContext(options: LswContextOptions = {}): Promise<LswContext> {
  const queryString = getLswQueryString(options);
  const body = await requestLswJson<{ context?: LswContext }>(`/api/lsw/context${queryString ? `?${queryString}` : ''}`);

  if (!body.context) {
    throw new Error('The LSW workspace could not be loaded.');
  }

  return body.context;
}

export async function listLswObservationCandidates(): Promise<LswObservationCandidate[]> {
  const body = await requestLswJson<{ candidates?: LswObservationCandidate[] }>('/api/lsw/observation-candidates');

  return body.candidates || [];
}

export async function getLswObservationStatus(options: LswContextOptions = {}): Promise<LswObservationStatus> {
  const queryString = getLswQueryString(options);
  const body = await requestLswJson<{ status?: LswObservationStatus }>(`/api/lsw/observation-status${queryString ? `?${queryString}` : ''}`);

  if (!body.status) {
    throw new Error('Observation status could not be loaded.');
  }

  return body.status;
}

export async function updateLswObservationAvailability(input: {
  availability: LswObservationAvailability;
  endDate?: string;
  note?: string;
  startDate?: string;
}): Promise<LswObservationStatus> {
  const body = await requestLswJson<{ status?: LswObservationStatus }>('/api/lsw/observation-availability', {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'PATCH'
  });

  if (!body.status) {
    throw new Error('Observation availability could not be updated.');
  }

  return body.status;
}

export async function recordLswObservationView(options: LswContextOptions = {}): Promise<LswObservationStatus> {
  const queryString = getLswQueryString(options);
  const body = await requestLswJson<{ status?: LswObservationStatus }>(`/api/lsw/observation-view${queryString ? `?${queryString}` : ''}`, {
    method: 'POST'
  });

  if (!body.status) {
    throw new Error('Observation view could not be recorded.');
  }

  return body.status;
}

export async function listLswObservationNotes(options: LswContextOptions = {}): Promise<LswObservationNote[]> {
  const queryString = getLswQueryString(options);
  const body = await requestLswJson<{ notes?: LswObservationNote[] }>(`/api/lsw/observation-notes${queryString ? `?${queryString}` : ''}`);

  return body.notes || [];
}

export async function createLswObservationNote(
  input: {
    body: string;
    sectionKey: LswVerificationSectionKey;
  },
  options: LswContextOptions = {}
): Promise<LswObservationNote> {
  const queryString = getLswQueryString(options);
  const body = await requestLswJson<{ note?: LswObservationNote }>(`/api/lsw/observation-notes${queryString ? `?${queryString}` : ''}`, {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST'
  });

  if (!body.note) {
    throw new Error('Observation note could not be saved.');
  }

  return body.note;
}

export async function withdrawLswObservationNote(noteId: string, options: LswContextOptions = {}): Promise<void> {
  const queryString = getLswQueryString(options);

  await requestLswJson<void>(`/api/lsw/observation-notes/${encodeURIComponent(noteId)}${queryString ? `?${queryString}` : ''}`, {
    method: 'DELETE'
  });
}

export async function getLswProfilePhotoObjectUrl(uid: string): Promise<string | null> {
  const user = getSynzappFirebaseAuth().currentUser;

  if (!user) {
    throw new Error('You are not signed in.');
  }

  const idToken = await user.getIdToken();
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/auth/web-profile/photo?uid=${encodeURIComponent(uid)}`, {
    cache: 'no-store',
    headers: {
      Accept: 'image/*',
      Authorization: `Bearer ${idToken}`,
      ...await getAppCheckHeader()
    },
    method: 'GET'
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'Profile photo could not be loaded.'));
  }

  return URL.createObjectURL(await response.blob());
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

export async function listLswPersonalGoals(options: LswContextOptions = {}): Promise<LswPersonalGoalsResponse> {
  const queryString = getLswQueryString(options);
  const body = await requestLswJson<{ personalGoals?: LswPersonalGoalsResponse }>(`/api/lsw/personal-goals${queryString ? `?${queryString}` : ''}`);

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

export async function listLswImprovementProjects(options: LswContextOptions = {}): Promise<LswImprovementProjectsResponse> {
  const queryString = getLswQueryString(options);
  const body = await requestLswJson<{ improvementProjects?: LswImprovementProjectsResponse }>(`/api/lsw/improvement-projects${queryString ? `?${queryString}` : ''}`);

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

export async function listLswScheduledTasks(options: LswContextOptions = {}): Promise<LswScheduledTasksResponse> {
  const queryString = getLswQueryString(options);
  const body = await requestLswJson<{ scheduledTasks?: LswScheduledTasksResponse }>(`/api/lsw/scheduled-tasks${queryString ? `?${queryString}` : ''}`);

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

export async function getLswVerificationSummary(options: LswContextOptions = {}): Promise<LswVerificationSummaryResponse> {
  const queryString = getLswQueryString(options);
  const body = await requestLswJson<{ verificationSummary?: LswVerificationSummaryResponse }>(`/api/lsw/verification-summary${queryString ? `?${queryString}` : ''}`);

  if (!body.verificationSummary) {
    throw new Error('LSW verification dashboard could not be loaded.');
  }

  return body.verificationSummary;
}

export async function listLswFollowUps(options: LswContextOptions = {}): Promise<LswFollowUpsResponse> {
  const queryString = getLswQueryString(options);
  const body = await requestLswJson<{ followUps?: LswFollowUpsResponse }>(`/api/lsw/follow-ups${queryString ? `?${queryString}` : ''}`);

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

export async function listLswRcaTriggers(options: LswContextOptions = {}): Promise<LswRcaTriggersResponse> {
  const queryString = getLswQueryString(options);
  const body = await requestLswJson<{ rcaTriggers?: LswRcaTriggersResponse }>(`/api/lsw/rca-triggers${queryString ? `?${queryString}` : ''}`);

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

export async function downloadLswExcelExport(options: LswExcelExportDownloadOptions = {}): Promise<void> {
  const queryString = getLswQueryString(options);
  const response = await requestLswResponse(`/api/lsw/export${queryString ? `?${queryString}` : ''}`, {
    headers: {
      Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
  });
  const blob = await response.blob();
  const contentDisposition = response.headers.get('Content-Disposition') || '';
  const fileNameMatch = /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.exec(contentDisposition);
  const fileName = fileNameMatch
    ? decodeURIComponent(fileNameMatch[1] || fileNameMatch[2] || options.fallbackFileName || 'Synzapp_LSW_Export.xlsx')
    : options.fallbackFileName || 'Synzapp_LSW_Export.xlsx';
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
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

  if (options.observeUserId) {
    params.set('observeUserId', options.observeUserId);
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

async function requestLswResponse(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const user = getSynzappFirebaseAuth().currentUser;

  if (!user) {
    throw new Error('You are not signed in.');
  }

  const idToken = await user.getIdToken();
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 60_000);
  let response: Response;

  try {
    response = await fetch(`${getSynzappApiBaseUrl()}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${idToken}`,
        ...options.headers,
        ...await getAppCheckHeader()
      },
      method: options.method || 'GET',
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The LSW export took too long to create. Please try again.');
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'The LSW Excel export could not be created.'));
  }

  return response;
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
