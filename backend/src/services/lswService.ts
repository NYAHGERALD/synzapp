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
  profilePhotoCacheKey?: string | null;
  profilePhotoStoragePath?: string | null;
  profilePhotoUrl?: string | null;
  profilePhotoVersion?: number | string | null;
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

interface RcaAdminIncidentRecord {
  companyId?: string;
  createdByUid?: string;
  departmentId?: string | null;
  departmentName?: string | null;
  participantUids?: string[];
  status?: 'OPEN' | 'INVESTIGATING' | 'CLOSED' | 'DELETED';
  tenantId?: string;
}

interface RailsAdminItemRecord {
  departmentId?: string | null;
  departmentName?: string | null;
  dueDate?: string;
  ownerDisplayName?: string;
  ownerUid?: string;
  status?: string;
  tenantId?: string;
}

interface LswProfileRecord {
  companyId?: string;
  departmentId?: string | null;
  departmentName?: string | null;
  lswId?: string;
  observationAvailability?: LswObservationAvailability;
  observationAvailabilityEndDate?: string;
  observationAvailabilityNote?: string;
  observationAvailabilityStartDate?: string;
  ownerUid?: string;
  status?: string;
  tenantId?: string;
  workDaysPerWeek?: number;
}

interface LswObservationAvailabilityLogRecord {
  availability?: LswObservationAvailability;
  availabilityLabel?: string;
  changedAt?: FirebaseFirestore.Timestamp;
  changedAtIso?: string;
  changedByDepartmentName?: string | null;
  changedByDisplayName?: string;
  changedByRoleName?: string;
  changedByUid?: string;
  endDate?: string | null;
  note?: string;
  startDate?: string | null;
  status?: string;
  tenantId?: string;
  weekKeys?: string[];
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
  observeUserId?: string;
  timeZone?: string;
  week?: number;
  year?: number;
}

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type LswDayStatus = 'not_completed' | 'completed_on_time' | 'completed_late' | 'completed_early';
export type LswDayCompletionTiming = 'not_completed' | 'within_window' | 'late' | 'early';
export type LswScheduledTaskFrequency = 'BI_WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
export type LswObservationAvailability = 'ACTIVE' | 'ON_LEAVE' | 'TEMPORARILY_UNAVAILABLE';

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
  observation: {
    canObserve: boolean;
    isObserving: boolean;
    observedUser: {
      availability: LswObservationAvailability;
      availabilityLabel: string;
      departmentId: string | null;
      departmentName: string;
      displayName: string;
      profilePhotoCacheKey: string | null;
      profilePhotoUrl: string | null;
      role: SynzappRole;
      roleName: string;
      uid: string;
    } | null;
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
  role: SynzappRole;
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
        dueState: LswVerificationDayMetric['dueState'];
        expectedCount: number;
        isoDate: string;
        lateCount: number;
        missingCount: number;
        onTimeCount: number;
      }>;
      expectedCount: number;
      lateCount: number;
      completedLateCount: number;
      missedCount: number;
      missingCount: number;
      onTimeCount: number;
      onTimeRate: number;
      openTodayCount: number;
      userMetrics: Array<{
        completedCount: number;
        completedLateCount: number;
        completionRate: number;
        departmentName: string;
        displayName: string;
        expectedCount: number;
        lateCount: number;
        lastCheckoffIso: string | null;
        missedCount: number;
        missingCount: number;
        onTimeCount: number;
        onTimeRate: number;
        openTodayCount: number;
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
    role: SynzappRole;
    scopeType: 'DEPARTMENT' | 'ORGANIZATION';
    tenantId: string;
  };
  sections: LswVerificationSectionSummary[];
  totals: LswVerificationTotalsSummary;
  trends: LswVerificationTrendPoint[];
  users: LswVerificationUserSummary[];
  week: LswContextResponse['week'] & {
    weekKey: string;
  };
}

export interface LswObservationCandidate {
  availability: LswObservationAvailability;
  availabilityLabel: string;
  departmentId: string | null;
  departmentName: string;
  displayName: string;
  profilePhotoCacheKey: string | null;
  profilePhotoUrl: string | null;
  role: SynzappRole;
  roleName: string;
  uid: string;
}

export interface LswObservationStatusResponse {
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

export interface LswObservationNoteInput {
  body: string;
  observeUserId?: string;
  sectionKey: LswVerificationSectionKey;
  timeZone?: string;
  week?: number;
  year?: number;
}

export interface LswObservationAvailabilityInput {
  availability: LswObservationAvailability;
  endDate?: string;
  note?: string;
  startDate?: string;
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
  actorRole: SynzappRole;
  actorUid: string;
  department: LswContextResponse['department'];
  isObservation: boolean;
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
const LSW_OBSERVATION_AVAILABILITY_HISTORY_COLLECTION = 'observationAvailabilityHistory';
const LSW_OBSERVATION_NOTES_COLLECTION = 'observationNotes';
const LSW_OBSERVATION_VIEWS_COLLECTION = 'observationViews';
const RCA_INCIDENTS_COLLECTION = 'rcaIncidents';
const RAILS_ITEMS_COLLECTION = 'railsItems';
const DAILY_TASK_SECTION_KEY = 'daily_weekly_standard_tasks';
const TODO_TASK_SECTION_KEY = 'to_do_today_this_week';
const MEETING_RAIL_SECTION_KEY = 'level_1_2_3_meeting_rails';
const PERSONAL_GOAL_SECTION_KEY = 'personal_objectives_goals';
const FOLLOW_UP_SECTION_KEY = 'follow_ups';
const RCA_TRIGGER_SECTION_KEY = 'plant_specific_cause_rca_triggers';
const IMPROVEMENT_PROJECT_SECTION_KEY = 'improvement_projects_updates';
const SCHEDULED_TASK_SECTION_KEY = 'scheduled_tasks_meetings';
const LSW_OBSERVATION_AVAILABILITY_LABELS: Record<LswObservationAvailability, string> = {
  ACTIVE: 'Active',
  ON_LEAVE: 'On leave',
  TEMPORARILY_UNAVAILABLE: 'Temporarily unavailable'
};
const LSW_VERIFICATION_SECTION_TITLES: Record<LswVerificationSectionKey, string> = {
  daily_weekly_standard_tasks: 'Daily & Weekly Standard Tasks/Meetings',
  follow_ups: 'Follow Ups',
  improvement_projects_updates: 'Improvement Projects and Updates',
  level_1_2_3_meeting_rails: 'Level 1, 2 & 3 Meeting Rails',
  personal_objectives_goals: 'Personal Objectives/Goals',
  plant_specific_cause_rca_triggers: 'Plant Specific Cause RCA Triggers',
  scheduled_tasks_meetings: 'Scheduled Tasks/Meetings',
  to_do_today_this_week: 'To Do Today & This Week'
};
const LSW_VERIFICATION_SECTION_TARGETS: Record<LswVerificationSectionKey, number> = {
  daily_weekly_standard_tasks: 95,
  follow_ups: 95,
  improvement_projects_updates: 95,
  level_1_2_3_meeting_rails: 95,
  personal_objectives_goals: 95,
  plant_specific_cause_rca_triggers: 90,
  scheduled_tasks_meetings: 95,
  to_do_today_this_week: 95
};
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
  const context = await getAuthorizedLswContext(decodedToken, input);
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
    observation: {
      canObserve: canObserveLswProfiles(context.actorRole),
      isObserving: context.isObservation,
      observedUser: context.isObservation
        ? buildLswObservationCandidate(context.uid, context.user, context.department, context.lswProfile)
        : null
    },
    user: {
      displayName: getDisplayName(context.user),
      role: context.role,
      roleName: formatRoleName(context.user.roleName, context.role),
      uid: context.uid
    },
    week
  };
}

export async function listLswDailyTasks(
  decodedToken: DecodedIdToken,
  input: LswContextInput = {}
): Promise<LswDailyTasksResponse> {
  const context = await getAuthorizedLswContext(decodedToken, input);
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
  const context = await getAuthorizedLswContext(decodedToken, weekInput);
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
  const context = await getAuthorizedLswContext(decodedToken, weekInput);
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

export async function listLswPersonalGoals(decodedToken: DecodedIdToken, input: LswContextInput = {}): Promise<LswPersonalGoalsResponse> {
  const context = await getAuthorizedLswContext(decodedToken, input);
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

export async function listLswFollowUps(decodedToken: DecodedIdToken, input: LswContextInput = {}): Promise<LswFollowUpsResponse> {
  const context = await getAuthorizedLswContext(decodedToken, input);
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

export async function listLswRcaTriggers(decodedToken: DecodedIdToken, input: LswContextInput = {}): Promise<LswRcaTriggersResponse> {
  const context = await getAuthorizedLswContext(decodedToken, input);
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

export async function listLswImprovementProjects(decodedToken: DecodedIdToken, input: LswContextInput = {}): Promise<LswImprovementProjectsResponse> {
  const context = await getAuthorizedLswContext(decodedToken, input);
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

export async function listLswScheduledTasks(decodedToken: DecodedIdToken, input: LswContextInput = {}): Promise<LswScheduledTasksResponse> {
  const context = await getAuthorizedLswContext(decodedToken, input);
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

export async function getLswWeeklyVerificationSummary(
  decodedToken: DecodedIdToken,
  input: LswContextInput = {}
): Promise<LswVerificationSummaryResponse> {
  const context = await getAuthorizedLswContext(decodedToken);

  if (context.role !== 'ORG_ADMIN' && context.role !== 'DEPT_ADMIN' && context.role !== 'SYSTEM_ADMIN') {
    throw authorizationError('You do not have permission to verify LSW completion.');
  }

  const usersSnapshot = await context.organizationRef
    .collection('users')
    .where('status', '==', 'ACTIVE')
    .get();
  const usersInScope = usersSnapshot.docs
    .map((doc) => ({
      uid: doc.id,
      user: doc.data() as TenantUserRecord
    }))
    .filter(({ user }) => user.tenantId === context.tenantId || !user.tenantId)
    .filter(({ user }) => isLswVerificationRoleVisible(context, user))
    .sort((left, right) => getDisplayName(left.user).localeCompare(getDisplayName(right.user)));

  const calendar = mapCalendarYearSettings(context.organization);
  const selectedWeek = calculateCalendarWeekContext(calendar, input);
  const selectedSummary = await buildLswVerificationWeekSummary(context, usersInScope, calendar, {
    week: selectedWeek.selectedWeek,
    year: selectedWeek.selectedYear
  });
  const trends = await buildLswVerificationTrends(context, usersInScope, calendar, selectedWeek.selectedYear, selectedWeek.selectedWeek);
  const totals = buildLswVerificationTotals(selectedSummary.sections, selectedSummary.users, selectedSummary.departments);
  const people = buildLswVerificationPeopleSummary(selectedSummary.users, selectedSummary.departments);
  const sidebar = buildLswVerificationSidebarSummary(context, selectedSummary.week, selectedSummary.sections);
  const dashboard = await buildLswAdminDashboardOverview(context, selectedSummary.weekRange, selectedSummary.users);

  return {
    dashboard,
    departments: selectedSummary.departments,
    generatedAtIso: new Date().toISOString(),
    people,
    sidebar,
    scope: {
      departmentId: context.role === 'ORG_ADMIN' || context.role === 'SYSTEM_ADMIN'
        ? null
        : context.department.departmentId,
      departmentName: context.role === 'ORG_ADMIN' || context.role === 'SYSTEM_ADMIN'
        ? context.organization.companyName || 'Organization'
        : context.department.name,
      role: context.role,
      scopeType: context.role === 'ORG_ADMIN' || context.role === 'SYSTEM_ADMIN' ? 'ORGANIZATION' : 'DEPARTMENT',
      tenantId: context.tenantId
    },
    sections: selectedSummary.sections,
    totals,
    trends,
    users: selectedSummary.users,
    week: {
      ...selectedSummary.week,
      weekKey: selectedSummary.weekKey
    }
  };
}

export async function listLswObservationCandidates(decodedToken: DecodedIdToken): Promise<LswObservationCandidate[]> {
  const context = await getAuthorizedLswContext(decodedToken);

  if (!canObserveLswProfiles(context.actorRole)) {
    throw authorizationError('You do not have permission to observe Standard Work.');
  }

  const usersSnapshot = await context.organizationRef
    .collection('users')
    .where('status', '==', 'ACTIVE')
    .get();

  const candidateUsers = usersSnapshot.docs
    .map((doc) => ({
      uid: doc.id,
      user: doc.data() as TenantUserRecord
    }))
    .filter(({ uid, user }) => uid !== context.actorUid && (user.tenantId === context.tenantId || !user.tenantId))
    .filter(({ user }) => canActorObserveLswUser(context, user));

  const candidates = await Promise.all(candidateUsers.map(async ({ uid, user }) => {
    const profileSnapshot = await context.organizationRef.collection(LSW_PROFILE_COLLECTION).doc(uid).get();
    const profile = profileSnapshot.exists ? (profileSnapshot.data() as LswProfileRecord) : undefined;

    return buildLswObservationCandidate(uid, user, undefined, profile);
  }));

  return candidates.sort((left, right) => left.displayName.localeCompare(right.displayName));
}

export async function getLswObservationStatus(
  decodedToken: DecodedIdToken,
  input: LswContextInput = {}
): Promise<LswObservationStatusResponse> {
  const context = await getAuthorizedLswContext(decodedToken, input);
  const calendar = mapCalendarYearSettings(context.organization);
  const week = calculateCalendarWeekContext(calendar, input);
  const weekKey = formatWeekKey(week.selectedYear, week.selectedWeek);
  const [viewedBy, noteCount, availabilityHistory] = await Promise.all([
    listObservationVisitors(context, weekKey),
    countActiveObservationNotes(context, weekKey),
    listObservationAvailabilityHistory(context, weekKey)
  ]);
  const recentVisitors = viewedBy
    .slice()
    .sort((left, right) => timestampSortValue(right.lastViewedAtIso) - timestampSortValue(left.lastViewedAtIso))
    .slice(0, 6);
  const effectiveAvailability = await resolveEffectiveObservationAvailability(context, input);

  return {
    availability: effectiveAvailability.availability,
    availabilityEndDate: effectiveAvailability.endDate,
    availabilityHistory,
    availabilityLabel: formatObservationAvailability(effectiveAvailability.availability),
    availabilityNote: normalizeObservationAvailabilityNote(context.lswProfile.observationAvailabilityNote),
    availabilityStartDate: effectiveAvailability.startDate,
    lastObservedAtIso: recentVisitors[0]?.lastViewedAtIso || null,
    noteCount,
    recentVisitors,
    viewedBy,
    weekKey
  };
}

export async function updateLswObservationAvailability(
  decodedToken: DecodedIdToken,
  input: LswObservationAvailabilityInput
): Promise<LswObservationStatusResponse> {
  const context = await getAuthorizedLswContext(decodedToken);
  const calendar = mapCalendarYearSettings(context.organization);
  const availability = normalizeObservationAvailability(input.availability);
  const availabilityNote = normalizeObservationAvailabilityNote(input.note);
  const availabilityWindow = normalizeObservationAvailabilityWindow(availability, input);
  const weekKeys = buildObservationAvailabilityWeekKeys(
    calendar,
    availabilityWindow.startDate,
    availabilityWindow.endDate
  );

  await context.lswProfileRef.set({
    observationAvailability: availability,
    observationAvailabilityEndDate: availabilityWindow.endDate,
    observationAvailabilityNote: availabilityNote,
    observationAvailabilityStartDate: availabilityWindow.startDate,
    observationAvailabilityUpdatedAt: fieldValue.serverTimestamp(),
    observationAvailabilityUpdatedByUid: decodedToken.uid,
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });

  if (availability !== 'ACTIVE') {
    const changedAt = new Date();
    const logRef = context.lswProfileRef
      .collection(LSW_OBSERVATION_AVAILABILITY_HISTORY_COLLECTION)
      .doc(randomUUID());

    await logRef.set({
      availability,
      availabilityLabel: formatObservationAvailability(availability),
      changedAt: fieldValue.serverTimestamp(),
      changedAtIso: changedAt.toISOString(),
      changedByDepartmentName: context.user.departmentName || context.department.name,
      changedByDisplayName: getDisplayName(context.user),
      changedByRoleName: formatRoleName(context.user.roleName, context.role),
      changedByUid: decodedToken.uid,
      endDate: availabilityWindow.endDate,
      note: availabilityNote,
      startDate: availabilityWindow.startDate,
      status: 'ACTIVE',
      tenantId: context.tenantId,
      weekKeys
    });
  }

  context.lswProfile.observationAvailability = availability;
  context.lswProfile.observationAvailabilityEndDate = availabilityWindow.endDate || undefined;
  context.lswProfile.observationAvailabilityNote = availabilityNote;
  context.lswProfile.observationAvailabilityStartDate = availabilityWindow.startDate || undefined;

  return getLswObservationStatus(decodedToken);
}

export async function recordLswObservationView(
  decodedToken: DecodedIdToken,
  input: LswContextInput = {}
): Promise<LswObservationStatusResponse> {
  const context = await getAuthorizedLswContext(decodedToken, input);

  if (!context.isObservation) {
    throw authorizationError('Select an employee before recording an observation.');
  }

  const calendar = mapCalendarYearSettings(context.organization);
  const week = calculateCalendarWeekContext(calendar, input);
  const weekKey = formatWeekKey(week.selectedYear, week.selectedWeek);
  const viewRef = context.lswProfileRef
    .collection(LSW_OBSERVATION_VIEWS_COLLECTION)
    .doc(`${weekKey}_${context.actorUid}`);
  const nowIso = new Date().toISOString();
  const actorSnapshot = await context.organizationRef.collection('users').doc(context.actorUid).get();
  const actorUser = actorSnapshot.exists ? (actorSnapshot.data() as TenantUserRecord) : context.user;
  const actorDepartment = await resolveUserDepartment(context.tenantId, actorUser, context.actorRole);
  const actorPhoto = buildLswUserProfilePhotoSummary(context.actorUid, actorUser);
  const observedDateKey = formatLocalDateOnly(new Date());

  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(viewRef);
    const existingRecord = snapshot.exists ? (snapshot.data() as Record<string, unknown>) : {};
    const existingDateKeys = Array.isArray(existingRecord.viewDateKeys)
      ? existingRecord.viewDateKeys.filter((value): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))
      : [];
    const nextDateKeys = Array.from(new Set([...existingDateKeys, observedDateKey])).sort();

    transaction.set(viewRef, {
      actorDepartmentId: actorDepartment.departmentId,
      actorDepartmentName: actorDepartment.name,
      actorDisplayName: getDisplayName(actorUser),
      actorProfilePhotoCacheKey: actorPhoto.profilePhotoCacheKey,
      actorProfilePhotoUrl: actorPhoto.profilePhotoUrl,
      actorRole: context.actorRole,
      actorRoleName: formatRoleName(actorUser.roleName, context.actorRole),
      actorUid: context.actorUid,
      companyId: context.tenantId,
      firstViewedAtIso: snapshot.exists ? safeNullableString(existingRecord.firstViewedAtIso) || nowIso : nowIso,
      lastViewedAtIso: nowIso,
      lastViewedAt: fieldValue.serverTimestamp(),
      lswId: context.lswProfile.lswId,
      ownerUid: context.uid,
      tenantId: context.tenantId,
      updatedAt: fieldValue.serverTimestamp(),
      viewCount: nextDateKeys.length,
      viewDateKeys: nextDateKeys,
      weekKey
    }, { merge: true });
  });

  return getLswObservationStatus(decodedToken, input);
}

export async function listLswObservationNotes(
  decodedToken: DecodedIdToken,
  input: LswContextInput = {}
): Promise<LswObservationNote[]> {
  const context = await getAuthorizedLswContext(decodedToken, input);
  const calendar = mapCalendarYearSettings(context.organization);
  const week = calculateCalendarWeekContext(calendar, input);
  const weekKey = formatWeekKey(week.selectedYear, week.selectedWeek);
  const snapshot = await context.lswProfileRef
    .collection(LSW_OBSERVATION_NOTES_COLLECTION)
    .where('weekKey', '==', weekKey)
    .where('status', '==', 'ACTIVE')
    .get();

  return snapshot.docs
    .map((doc) => mapObservationNote(doc.id, doc.data(), context.actorUid, context.actorRole))
    .sort((left, right) => timestampSortValue(right.createdAtIso) - timestampSortValue(left.createdAtIso));
}

export async function createLswObservationNote(
  decodedToken: DecodedIdToken,
  input: LswObservationNoteInput
): Promise<LswObservationNote> {
  const context = await getAuthorizedLswContext(decodedToken, input);

  if (!context.isObservation) {
    throw authorizationError('Select an employee before adding an observation note.');
  }

  const body = normalizeObservationNoteBody(input.body);
  const sectionKey = normalizeObservationSectionKey(input.sectionKey);
  const calendar = mapCalendarYearSettings(context.organization);
  const week = calculateCalendarWeekContext(calendar, input);
  const weekKey = formatWeekKey(week.selectedYear, week.selectedWeek);
  const actorSnapshot = await context.organizationRef.collection('users').doc(context.actorUid).get();
  const actorUser = actorSnapshot.exists ? (actorSnapshot.data() as TenantUserRecord) : context.user;
  const actorDepartment = await resolveUserDepartment(context.tenantId, actorUser, context.actorRole);
  const actorPhoto = buildLswUserProfilePhotoSummary(context.actorUid, actorUser);
  const noteRef = context.lswProfileRef.collection(LSW_OBSERVATION_NOTES_COLLECTION).doc();
  const nowIso = new Date().toISOString();
  const noteRecord = {
    actorDepartmentId: actorDepartment.departmentId,
    actorDepartmentName: actorDepartment.name,
    actorDisplayName: getDisplayName(actorUser),
    actorProfilePhotoCacheKey: actorPhoto.profilePhotoCacheKey,
    actorProfilePhotoUrl: actorPhoto.profilePhotoUrl,
    actorRole: context.actorRole,
    actorRoleName: formatRoleName(actorUser.roleName, context.actorRole),
    actorUid: context.actorUid,
    body,
    companyId: context.tenantId,
    createdAt: fieldValue.serverTimestamp(),
    createdAtIso: nowIso,
    lswId: context.lswProfile.lswId,
    ownerUid: context.uid,
    sectionKey,
    status: 'ACTIVE',
    tenantId: context.tenantId,
    updatedAt: fieldValue.serverTimestamp(),
    weekKey
  };

  await noteRef.set(noteRecord);

  return mapObservationNote(noteRef.id, noteRecord, context.actorUid, context.actorRole);
}

export async function withdrawLswObservationNote(
  decodedToken: DecodedIdToken,
  noteId: string,
  input: LswContextInput = {}
): Promise<void> {
  const context = await getAuthorizedLswContext(decodedToken, input);
  const safeNoteId = normalizeDocumentId(noteId);
  const noteRef = context.lswProfileRef.collection(LSW_OBSERVATION_NOTES_COLLECTION).doc(safeNoteId);
  const snapshot = await noteRef.get();

  if (!snapshot.exists) {
    throw notFoundError('The observation note was not found.');
  }

  const note = snapshot.data() as Record<string, unknown>;

  assertObservationNoteBelongsToContext(note, context);

  const actorUid = typeof note.actorUid === 'string' ? note.actorUid : '';
  const canWithdraw = actorUid === context.actorUid || context.actorRole === 'ORG_ADMIN' || context.actorRole === 'SYSTEM_ADMIN';

  if (!canWithdraw) {
    throw authorizationError('You do not have permission to withdraw this observation note.');
  }

  await noteRef.set({
    status: 'WITHDRAWN',
    updatedAt: fieldValue.serverTimestamp(),
    withdrawnAt: fieldValue.serverTimestamp(),
    withdrawnByUid: context.actorUid
  }, { merge: true });
}

async function buildLswVerificationWeekSummary(
  context: AuthorizedLswContext,
  usersInScope: Array<{ uid: string; user: TenantUserRecord }>,
  calendar: CalendarYearSettings,
  input: LswContextInput
): Promise<{
  departments: LswVerificationDepartmentSummary[];
  sections: LswVerificationSectionSummary[];
  users: LswVerificationUserSummary[];
  week: LswContextResponse['week'];
  weekKey: string;
  weekRange: { end: Date; start: Date };
}> {
  const week = calculateCalendarWeekContext(calendar, input);
  const weekKey = formatWeekKey(week.selectedYear, week.selectedWeek);
  const weekRange = getWeekRange(calendar, week.selectedYear, week.selectedWeek);
  const users = await Promise.all(usersInScope.map(({ uid, user }) => (
    buildLswVerificationUserSummary(context, uid, user, weekKey, weekRange)
  )));
  const sections = aggregateVerificationSections(users.flatMap((user) => user.sections));
  const departments = aggregateVerificationDepartments(users);

  return {
    departments,
    sections,
    users,
    week,
    weekKey,
    weekRange
  };
}

async function buildLswVerificationTrends(
  context: AuthorizedLswContext,
  usersInScope: Array<{ uid: string; user: TenantUserRecord }>,
  calendar: CalendarYearSettings,
  selectedYear: number,
  selectedWeek: number
): Promise<LswVerificationTrendPoint[]> {
  const weekOffsets = [-5, -4, -3, -2, -1, 0];
  const summaries = await Promise.all(weekOffsets.map((offset) => (
    buildLswVerificationWeekSummary(context, usersInScope, calendar, {
      week: selectedWeek + offset,
      year: selectedYear
    })
  )));

  return summaries.map((summary) => {
    const totals = aggregateVerificationTotals(summary.sections);

    return {
      attentionCount: totals.missingCount + totals.needsReviewCount + totals.lateCount,
      completedCount: totals.completedCount,
      completionRate: totals.expectedCount > 0
        ? Math.round((totals.completedCount / totals.expectedCount) * 100)
        : 0,
      departments: summary.departments,
      expectedCount: totals.expectedCount,
      sections: summary.sections,
      weekBeginningLabel: summary.week.weekBeginningLabel,
      weekEndingLabel: summary.week.weekEndingLabel,
      weekKey: summary.weekKey
    };
  });
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

function isLswVerificationRoleVisible(context: AuthorizedLswContext, user: TenantUserRecord): boolean {
  if (user.status && user.status !== 'ACTIVE') {
    return false;
  }

  if (context.role === 'ORG_ADMIN' || context.role === 'SYSTEM_ADMIN') {
    return user.role === 'ORG_ADMIN' || user.role === 'DEPT_ADMIN' || user.role === 'EMPLOYEE';
  }

  return (
    context.role === 'DEPT_ADMIN' &&
    user.departmentId === context.department.departmentId &&
    (user.role === 'DEPT_ADMIN' || user.role === 'EMPLOYEE')
  );
}

async function buildLswVerificationUserSummary(
  context: AuthorizedLswContext,
  uid: string,
  user: TenantUserRecord,
  weekKey: string,
  weekRange: { end: Date; start: Date }
): Promise<LswVerificationUserSummary> {
  const lswProfileRef = context.organizationRef.collection(LSW_PROFILE_COLLECTION).doc(uid);
  const profileSnapshot = await lswProfileRef.get();
  const profile = profileSnapshot.exists
    ? profileSnapshot.data() as LswProfileRecord
    : null;
  const userDepartment = {
    departmentId: user.departmentId || profile?.departmentId || null,
    name: user.departmentName || profile?.departmentName || 'Unassigned department',
    status: 'ACTIVE'
  };
  const lswId = profile?.lswId || uid;
  const profileContext: AuthorizedLswContext = {
    ...context,
    department: userDepartment,
    lswProfile: {
      ...profile,
      lswId,
      ownerUid: uid,
      status: 'ACTIVE',
      tenantId: context.tenantId,
      workDaysPerWeek: normalizeWorkDaysPerWeek(profile?.workDaysPerWeek || DEFAULT_WORK_DAYS_PER_WEEK)
    },
    lswProfileRef,
    uid,
    user
  };
  const sections = profileSnapshot.exists
    ? await buildLswVerificationSections(profileContext, weekKey, weekRange)
    : getEmptyVerificationSections();
  const dailyMetrics = profileSnapshot.exists
    ? await buildLswVerificationDailyMetrics(profileContext, weekKey, weekRange)
    : {};
  const totals = aggregateVerificationTotals(sections);

  return {
    ...totals,
    completionRate: calculateCompletionRate(totals.completedCount, totals.expectedCount),
    dailyMetrics,
    departmentId: userDepartment.departmentId,
    departmentName: userDepartment.name,
    displayName: getDisplayName(user),
    role: user.role || 'EMPLOYEE',
    roleName: formatRoleName(user.roleName, user.role || 'EMPLOYEE'),
    sections,
    status: totals.expectedCount === 0 || totals.completedCount === 0
      ? 'NOT_STARTED'
      : totals.missingCount === 0 && totals.needsReviewCount === 0
        ? 'COMPLETE'
        : 'IN_PROGRESS',
    uid
  };
}

async function buildLswVerificationDailyMetrics(
  context: AuthorizedLswContext,
  weekKey: string,
  weekRange: { end: Date; start: Date }
): Promise<LswVerificationDailyMetrics> {
  const currentWeekKey = resolveWeekKey(context);
  const [dailyStandardWork, meetingRails, todos] = await Promise.all([
    buildDailyStandardWorkMetrics(context, weekKey, weekRange),
    buildDueDateCompletionMetrics(context, LSW_MEETING_RAILS_COLLECTION, weekKey, currentWeekKey, weekRange, (record) => (record as LswMeetingRailRecord).completed === true),
    buildDueDateCompletionMetrics(context, LSW_TODO_TASKS_COLLECTION, weekKey, currentWeekKey, weekRange, (record) => {
      const todo = record as LswTodoTaskRecord;

      return todo.completed === true || Boolean(getNonEmptyString(todo.completedAtIso));
    })
  ]);

  return {
    daily_weekly_standard_tasks: dailyStandardWork,
    level_1_2_3_meeting_rails: meetingRails,
    to_do_today_this_week: todos
  };
}

async function buildLswVerificationSections(
  context: AuthorizedLswContext,
  weekKey: string,
  weekRange: { end: Date; start: Date }
): Promise<LswVerificationSectionSummary[]> {
  const [
    daily,
    todo,
    meetingRails,
    rcaTriggers,
    improvements,
    followUps,
    scheduled,
    goals
  ] = await Promise.all([
    summarizeDailyWeeklyTasks(context, weekKey),
    summarizeTodoTasks(context, weekKey, weekRange),
    summarizeMeetingRails(context, weekKey, weekRange),
    summarizeRcaTriggers(context, weekRange),
    summarizeImprovementProjects(context),
    summarizeFollowUps(context, weekRange),
    summarizeScheduledTasks(context, weekRange),
    summarizePersonalGoals(context, weekRange)
  ]);

  return [
    daily,
    rcaTriggers,
    todo,
    meetingRails,
    improvements,
    followUps,
    scheduled,
    goals
  ];
}

async function summarizeDailyWeeklyTasks(context: AuthorizedLswContext, weekKey: string): Promise<LswVerificationSectionSummary> {
  const snapshot = await context.lswProfileRef
    .collection(LSW_DAILY_TASKS_COLLECTION)
    .orderBy('sortOrder', 'asc')
    .get();
  const activeTaskDocs = snapshot.docs
    .map((doc) => ({ record: doc.data() as LswDailyTaskRecord, ref: doc.ref, taskId: doc.id }))
    .filter(({ record }) => isActiveTenantLswRecord(record, context));
  const weeklyStatuses = await getDailyTaskWeekStatuses(context, activeTaskDocs, weekKey);
  const workDays = ALL_DAY_KEYS.slice(0, normalizeWorkDaysPerWeek(context.lswProfile.workDaysPerWeek));
  let completedCount = 0;
  let lateCount = 0;
  let missingCount = 0;

  activeTaskDocs.forEach(({ taskId }) => {
    const details = normalizeDayStatusDetails(weeklyStatuses.get(taskId)?.dayStatuses, weeklyStatuses.get(taskId)?.days);

    workDays.forEach((dayKey) => {
      const status = details[dayKey].status;

      if (status === 'not_completed') {
        missingCount += 1;
        return;
      }

      completedCount += 1;

      if (status === 'completed_late') {
        lateCount += 1;
      }
    });
  });

  return buildVerificationSectionSummary('daily_weekly_standard_tasks', {
    completedCount,
    expectedCount: activeTaskDocs.length * workDays.length,
    lateCount,
    missingCount
  });
}

async function buildDailyStandardWorkMetrics(
  context: AuthorizedLswContext,
  weekKey: string,
  weekRange: { end: Date; start: Date }
): Promise<LswVerificationDayMetric[]> {
  const snapshot = await context.lswProfileRef
    .collection(LSW_DAILY_TASKS_COLLECTION)
    .orderBy('sortOrder', 'asc')
    .get();
  const activeTaskDocs = snapshot.docs
    .map((doc) => ({ record: doc.data() as LswDailyTaskRecord, ref: doc.ref, taskId: doc.id }))
    .filter(({ record }) => isActiveTenantLswRecord(record, context));
  const weeklyStatuses = await getDailyTaskWeekStatuses(context, activeTaskDocs, weekKey);
  const workDayCount = normalizeWorkDaysPerWeek(context.lswProfile.workDaysPerWeek);
  const today = dateOnlyFromDateInTimeZone(new Date());

  return buildWeekDayMetricShell(weekRange, workDayCount).map((metric) => {
    let completedCount = 0;
    let lateCount = 0;
    let lastCheckoffIso: string | null = null;
    let missingCount = 0;
    let onTimeCount = 0;
    const metricDate = parseDateOnly(metric.isoDate);
    const isNotDueYet = metricDate.getTime() > today.getTime();

    if (isNotDueYet) {
      return buildVerificationDayMetric(metric, {
        dueState: 'not_due'
      });
    }

    activeTaskDocs.forEach(({ taskId }) => {
      const details = normalizeDayStatusDetails(weeklyStatuses.get(taskId)?.dayStatuses, weeklyStatuses.get(taskId)?.days);
      const detail = details[metric.dayKey];
      const status = detail.status;

      if (status === 'not_completed') {
        missingCount += 1;
        return;
      }

      completedCount += 1;

      if (status === 'completed_late') {
        lateCount += 1;
      } else {
        onTimeCount += 1;
      }

      if (detail.completedAtIso && (!lastCheckoffIso || detail.completedAtIso > lastCheckoffIso)) {
        lastCheckoffIso = detail.completedAtIso;
      }
    });

    return buildVerificationDayMetric(metric, {
      completedCount,
      expectedCount: activeTaskDocs.length,
      lateCount,
      lastCheckoffIso,
      missingCount,
      onTimeCount
    });
  });
}

async function buildDueDateCompletionMetrics<T extends {
  companyId?: string;
  dueDate?: string;
  dueTime?: string;
  lswId?: string;
  ownerUid?: string;
  status?: string;
  tenantId?: string;
  timeZone?: string;
  weekKey?: string;
}>(
  context: AuthorizedLswContext,
  collectionName: string,
  weekKey: string,
  currentWeekKey: string,
  weekRange: { end: Date; start: Date },
  isComplete: (record: T) => boolean
): Promise<LswVerificationDayMetric[]> {
  const snapshot = await context.lswProfileRef.collection(collectionName).get();
  const records = snapshot.docs
    .map((doc) => doc.data() as T)
    .filter((record) => isActiveTenantLswRecord(record, context) && isWeekScopedRecordVisible(record.weekKey, weekKey, currentWeekKey));
  const workDayCount = normalizeWorkDaysPerWeek(context.lswProfile.workDaysPerWeek);
  const now = new Date();
  const today = dateOnlyFromDateInTimeZone(now);

  return buildWeekDayMetricShell(weekRange, workDayCount).map((metric) => {
    const metricDate = parseDateOnly(metric.isoDate);
    const isNotDueYet = metricDate.getTime() > today.getTime();
    const dueRecords = records.filter((record) => getVerificationMetricIsoDate(record, weekRange) === metric.isoDate);

    if (isNotDueYet) {
      return buildVerificationDayMetric(metric, {
        dueState: dueRecords.length > 0 ? 'not_due' : 'no_work'
      });
    }

    const completedCount = dueRecords.filter(isComplete).length;
    const lateCount = dueRecords.filter((record) => !isComplete(record) && isDueDateRecordPastDue(record, now)).length;
    const expectedCount = dueRecords.length;
    const weightedCompletedCount = completedCount + (lateCount * 0.5);
    const missingCount = Math.max(0, expectedCount - completedCount);

    return buildVerificationDayMetric(metric, {
      completedCount,
      completionRate: expectedCount > 0
        ? Math.round((weightedCompletedCount / expectedCount) * 100)
        : 0,
      dueState: inferLswVerificationDayState({
        completedCount,
        expectedCount,
        lateCount,
        missingCount
      }),
      expectedCount,
      lateCount,
      missingCount
    });
  });
}

function getVerificationMetricIsoDate(
  record: { dueDate?: string },
  weekRange: { end: Date; start: Date }
): string | null {
  const dueDate = record.dueDate ? tryParseDateOnly(record.dueDate) : null;

  if (!dueDate || dueDate.getTime() < weekRange.start.getTime() || dueDate.getTime() > weekRange.end.getTime()) {
    return null;
  }

  return formatIsoDate(dueDate);
}

async function summarizeTodoTasks(
  context: AuthorizedLswContext,
  weekKey: string,
  weekRange: { end: Date; start: Date }
): Promise<LswVerificationSectionSummary> {
  const currentWeekKey = resolveWeekKey(context);
  const snapshot = await context.lswProfileRef.collection(LSW_TODO_TASKS_COLLECTION).get();
  const records = snapshot.docs
    .map((doc) => doc.data() as LswTodoTaskRecord)
    .filter((record) => (
      isActiveTenantLswRecord(record, context) &&
      isWeekScopedRecordVisible(record.weekKey, weekKey, currentWeekKey) &&
      Boolean(getVerificationMetricIsoDate(record, weekRange))
    ));

  return buildVerificationSectionSummary('to_do_today_this_week', summarizeBooleanCompletion(records, (record) => record.completed === true));
}

async function summarizeMeetingRails(
  context: AuthorizedLswContext,
  weekKey: string,
  weekRange: { end: Date; start: Date }
): Promise<LswVerificationSectionSummary> {
  const currentWeekKey = resolveWeekKey(context);
  const snapshot = await context.lswProfileRef.collection(LSW_MEETING_RAILS_COLLECTION).get();
  const records = snapshot.docs
    .map((doc) => doc.data() as LswMeetingRailRecord)
    .filter((record) => (
      isActiveTenantLswRecord(record, context) &&
      isWeekScopedRecordVisible(record.weekKey, weekKey, currentWeekKey) &&
      Boolean(getVerificationMetricIsoDate(record, weekRange))
    ));

  return buildVerificationSectionSummary('level_1_2_3_meeting_rails', summarizeBooleanCompletion(records, (record) => record.completed === true));
}

async function summarizeRcaTriggers(context: AuthorizedLswContext, weekRange: { end: Date; start: Date }): Promise<LswVerificationSectionSummary> {
  const snapshot = await context.lswProfileRef.collection(LSW_RCA_TRIGGERS_COLLECTION).get();
  const records = snapshot.docs
    .map((doc) => doc.data() as LswRcaTriggerRecord)
    .filter((record) => isActiveTenantLswRecord(record, context) && isDateOnlyInRange(record.eventDate, weekRange));

  return buildVerificationSectionSummary('plant_specific_cause_rca_triggers', summarizeDataReadiness(records, (record) => (
    Boolean(getNonEmptyString(record.trigger)) && Boolean(getNonEmptyString(record.comments))
  )));
}

async function summarizeImprovementProjects(context: AuthorizedLswContext): Promise<LswVerificationSectionSummary> {
  const snapshot = await context.lswProfileRef.collection(LSW_IMPROVEMENT_PROJECTS_COLLECTION).get();
  const records = snapshot.docs
    .map((doc) => doc.data() as LswImprovementProjectRecord)
    .filter((record) => isActiveTenantLswRecord(record, context));

  return buildVerificationSectionSummary('improvement_projects_updates', summarizeDataReadiness(records, (record) => (
    Boolean(getNonEmptyString(record.project)) &&
    normalizeImprovementProjectUpdates(record.updates).some((update) => Boolean(getNonEmptyString(update.text)))
  )));
}

async function summarizeFollowUps(context: AuthorizedLswContext, weekRange: { end: Date; start: Date }): Promise<LswVerificationSectionSummary> {
  const snapshot = await context.lswProfileRef.collection(LSW_FOLLOW_UPS_COLLECTION).get();
  const records = snapshot.docs
    .map((doc) => doc.data() as LswFollowUpRecord)
    .filter((record) => isActiveTenantLswRecord(record, context) && isDateOnlyDueByRangeEnd(record.dueDate, weekRange));

  return buildVerificationSectionSummary('follow_ups', summarizeDataReadiness(records, (record) => (
    Boolean(getNonEmptyString(record.followUp)) &&
    Boolean(getNonEmptyString(record.responsible)) &&
    Boolean(getNonEmptyString(record.comments))
  )));
}

async function summarizeScheduledTasks(context: AuthorizedLswContext, weekRange: { end: Date; start: Date }): Promise<LswVerificationSectionSummary> {
  const snapshot = await context.lswProfileRef.collection(LSW_SCHEDULED_TASKS_COLLECTION).get();
  const records = snapshot.docs
    .map((doc) => doc.data() as LswScheduledTaskRecord)
    .filter((record) => isActiveTenantLswRecord(record, context) && isScheduledTaskInWeek(record, weekRange));

  return buildVerificationSectionSummary('scheduled_tasks_meetings', summarizeDataReadiness(records, (record) => (
    Boolean(getNonEmptyString(record.task)) &&
    Boolean(getNonEmptyString(record.dueDate)) &&
    Boolean(getNonEmptyString(record.frequency)) &&
    normalizeMinutes(record.minutes ?? 0) > 0
  )));
}

async function summarizePersonalGoals(context: AuthorizedLswContext, weekRange: { end: Date; start: Date }): Promise<LswVerificationSectionSummary> {
  const snapshot = await context.lswProfileRef.collection(LSW_PERSONAL_GOALS_COLLECTION).get();
  const records = snapshot.docs
    .map((doc) => doc.data() as LswPersonalGoalRecord)
    .filter((record) => isActiveTenantLswRecord(record, context) && isDateOnlyDueByRangeEnd(record.dueDate, weekRange));

  return buildVerificationSectionSummary('personal_objectives_goals', summarizeDataReadiness(records, (record) => (
    Boolean(getNonEmptyString(record.objective)) && normalizeProgress(record.progress ?? 0) > 0
  )));
}

function summarizeBooleanCompletion<T>(records: T[], isComplete: (record: T) => boolean): Pick<LswVerificationSectionSummary, 'completedCount' | 'expectedCount' | 'missingCount' | 'needsReviewCount'> {
  const completedCount = records.filter(isComplete).length;
  const expectedCount = records.length;

  return {
    completedCount,
    expectedCount,
    missingCount: expectedCount - completedCount,
    needsReviewCount: 0
  };
}

function summarizeDataReadiness<T>(records: T[], isReady: (record: T) => boolean): Pick<LswVerificationSectionSummary, 'completedCount' | 'expectedCount' | 'missingCount' | 'needsReviewCount'> {
  const completedCount = records.filter(isReady).length;
  const expectedCount = records.length;
  const needsReviewCount = expectedCount - completedCount;

  return {
    completedCount,
    expectedCount,
    missingCount: 0,
    needsReviewCount
  };
}

function buildVerificationSectionSummary(
  sectionKey: LswVerificationSectionKey,
  input: Partial<Pick<LswVerificationSectionSummary, 'completedCount' | 'expectedCount' | 'lateCount' | 'missingCount' | 'needsReviewCount'>>
): LswVerificationSectionSummary {
  const expectedCount = Math.max(0, Math.round(input.expectedCount || 0));
  const completedCount = Math.max(0, Math.min(expectedCount, Math.round(input.completedCount || 0)));

  return {
    completedCount,
    completionRate: calculateCompletionRate(completedCount, expectedCount),
    expectedCount,
    lateCount: Math.max(0, Math.round(input.lateCount || 0)),
    missingCount: Math.max(0, Math.round(input.missingCount || 0)),
    needsReviewCount: Math.max(0, Math.round(input.needsReviewCount || 0)),
    sectionKey,
    targetCompletionRate: LSW_VERIFICATION_SECTION_TARGETS[sectionKey],
    title: LSW_VERIFICATION_SECTION_TITLES[sectionKey]
  };
}

function getEmptyVerificationSections(): LswVerificationSectionSummary[] {
  return (Object.keys(LSW_VERIFICATION_SECTION_TITLES) as LswVerificationSectionKey[]).map((sectionKey) => (
    buildVerificationSectionSummary(sectionKey, {})
  ));
}

function aggregateVerificationSections(sections: LswVerificationSectionSummary[]): LswVerificationSectionSummary[] {
  return (Object.keys(LSW_VERIFICATION_SECTION_TITLES) as LswVerificationSectionKey[]).map((sectionKey) => {
    const matchingSections = sections.filter((section) => section.sectionKey === sectionKey);

    return buildVerificationSectionSummary(sectionKey, aggregateVerificationTotals(matchingSections));
  });
}

function buildWeekDayMetricShell(
  weekRange: { start: Date },
  workDayCount: number
): Array<Pick<LswVerificationDayMetric, 'dayKey' | 'dayLabel' | 'dateLabel' | 'isoDate'>> {
  const normalizedWorkDayCount = Math.min(ALL_DAY_KEYS.length, Math.max(1, workDayCount));

  return ALL_DAY_KEYS.slice(0, normalizedWorkDayCount).map((dayKey, index) => {
    const date = new Date(weekRange.start);
    date.setUTCDate(date.getUTCDate() + index);

    return {
      dayKey,
      dayLabel: formatDayKeyLabel(dayKey),
      dateLabel: formatShortDate(date),
      isoDate: formatIsoDate(date)
    };
  });
}

function buildVerificationDayMetric(
  metric: Pick<LswVerificationDayMetric, 'dayKey' | 'dayLabel' | 'dateLabel' | 'isoDate'>,
  totals: Partial<Pick<LswVerificationDayMetric, 'completedCount' | 'completionRate' | 'dueState' | 'expectedCount' | 'lateCount' | 'lastCheckoffIso' | 'missingCount' | 'onTimeCount'>>
): LswVerificationDayMetric {
  const completedCount = totals.completedCount || 0;
  const expectedCount = totals.expectedCount || 0;
  const lateCount = totals.lateCount || 0;
  const missingCount = totals.missingCount || 0;

  return {
    ...metric,
    completedCount,
    completionRate: typeof totals.completionRate === 'number'
      ? Math.max(0, Math.min(100, Math.round(totals.completionRate)))
      : calculateCompletionRate(completedCount, expectedCount),
    dueState: totals.dueState || inferLswVerificationDayState({
      completedCount,
      expectedCount,
      lateCount,
      missingCount
    }),
    expectedCount,
    lateCount,
    lastCheckoffIso: totals.lastCheckoffIso || null,
    missingCount,
    onTimeCount: totals.onTimeCount ?? Math.max(0, completedCount - lateCount)
  };
}

function inferLswVerificationDayState(input: {
  completedCount: number;
  expectedCount: number;
  lateCount: number;
  missingCount: number;
}): LswVerificationDayMetric['dueState'] {
  if (input.expectedCount <= 0) {
    return 'no_work';
  }

  if (input.missingCount > 0 && input.completedCount === 0) {
    return 'overdue';
  }

  if (input.lateCount > 0) {
    return 'late';
  }

  if (input.completedCount >= input.expectedCount) {
    return 'complete';
  }

  return 'partial';
}

function formatDayKeyLabel(dayKey: DayKey): string {
  const labels: Record<DayKey, string> = {
    fri: 'Fri',
    mon: 'Mon',
    sat: 'Sat',
    sun: 'Sun',
    thu: 'Thu',
    tue: 'Tue',
    wed: 'Wed'
  };

  return labels[dayKey];
}

function isDueDateRecordPastDue(
  record: { dueDate?: string; dueTime?: string; timeZone?: string },
  now: Date
): boolean {
  if (!record.dueDate || !isValidDateOnly(record.dueDate)) {
    return false;
  }

  const dueTime = isValidTaskTime(record.dueTime) ? record.dueTime || '23:59' : '23:59';
  const timeZone = normalizeTimeZone(record.timeZone);
  const todayIso = formatIsoDate(dateOnlyFromDateInTimeZone(now, timeZone));

  if (record.dueDate < todayIso) {
    return true;
  }

  if (record.dueDate > todayIso) {
    return false;
  }

  return dueTime < formatTimeInTimeZone(now, timeZone);
}

function formatTimeInTimeZone(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      hour12: false,
      minute: '2-digit',
      timeZone
    }).formatToParts(date);
    const values = new Map(parts.map((part) => [part.type, part.value]));
    const hour = values.get('hour') || '00';
    const minute = values.get('minute') || '00';

    return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  } catch {
    return formatTimeInTimeZone(date, 'UTC');
  }
}

function aggregateVerificationDepartments(users: LswVerificationUserSummary[]): LswVerificationDepartmentSummary[] {
  const departments = new Map<string, LswVerificationDepartmentSummary>();

  users.forEach((user) => {
    const departmentKey = user.departmentId || 'unassigned';
    const existingDepartment = departments.get(departmentKey) || {
      completedCount: 0,
      completionRate: 0,
      departmentId: user.departmentId,
      departmentName: user.departmentName,
      expectedCount: 0,
      lateCount: 0,
      missingCount: 0,
      needsReviewCount: 0,
      userCount: 0
    };

    existingDepartment.completedCount += user.completedCount;
    existingDepartment.expectedCount += user.expectedCount;
    existingDepartment.lateCount += user.lateCount;
    existingDepartment.missingCount += user.missingCount;
    existingDepartment.needsReviewCount += user.needsReviewCount;
    existingDepartment.userCount += 1;
    existingDepartment.completionRate = calculateCompletionRate(existingDepartment.completedCount, existingDepartment.expectedCount);
    departments.set(departmentKey, existingDepartment);
  });

  return [...departments.values()].sort((left, right) => right.completionRate - left.completionRate || left.departmentName.localeCompare(right.departmentName));
}

function buildLswVerificationTotals(
  sections: LswVerificationSectionSummary[],
  users: LswVerificationUserSummary[],
  departments: LswVerificationDepartmentSummary[]
): LswVerificationTotalsSummary {
  const totals = aggregateVerificationTotals(sections);
  const completedUsers = users.filter((user) => user.status === 'COMPLETE').length;
  const inProgressUsers = users.filter((user) => user.status === 'IN_PROGRESS').length;
  const notStartedUsers = users.filter((user) => user.status === 'NOT_STARTED').length;

  return {
    attentionCount: totals.missingCount + totals.needsReviewCount + totals.lateCount,
    averageDepartmentCompletion: departments.length
      ? Math.round(departments.reduce((total, department) => total + department.completionRate, 0) / departments.length)
      : calculateCompletionRate(totals.completedCount, totals.expectedCount),
    completedCount: totals.completedCount,
    completedUsers,
    completionRate: calculateCompletionRate(totals.completedCount, totals.expectedCount),
    expectedCount: totals.expectedCount,
    inProgressUsers,
    lateCount: totals.lateCount,
    missingCount: totals.missingCount,
    needsReviewCount: totals.needsReviewCount,
    notStartedUsers,
    userCount: users.length
  };
}

function buildLswVerificationPeopleSummary(
  users: LswVerificationUserSummary[],
  departments: LswVerificationDepartmentSummary[]
): LswVerificationPeopleSummary {
  const attentionUsers = users
    .slice()
    .sort((left, right) => {
      const rightRisk = right.missingCount + right.needsReviewCount + right.lateCount;
      const leftRisk = left.missingCount + left.needsReviewCount + left.lateCount;

      return rightRisk - leftRisk || left.completionRate - right.completionRate || left.displayName.localeCompare(right.displayName);
    });
  const verificationUsers = users
    .slice()
    .sort((left, right) => {
      const attentionDifference = (right.missingCount + right.needsReviewCount + right.lateCount) - (left.missingCount + left.needsReviewCount + left.lateCount);

      return attentionDifference || left.completionRate - right.completionRate || left.displayName.localeCompare(right.displayName);
    });

  return {
    attentionUsers,
    departments,
    statusMix: {
      complete: users.filter((user) => user.status === 'COMPLETE').length,
      inProgress: users.filter((user) => user.status === 'IN_PROGRESS').length,
      notStarted: users.filter((user) => user.status === 'NOT_STARTED').length
    },
    verificationUsers
  };
}

async function buildLswAdminDashboardOverview(
  context: AuthorizedLswContext,
  weekRange: { end: Date; start: Date },
  users: LswVerificationUserSummary[]
): Promise<LswAdminDashboardOverview> {
  const [rca, rails, lsw] = await Promise.all([
    buildLswAdminRcaOverview(context),
    buildLswAdminRailsOverview(context),
    buildLswAdminPersonalLswOverview(context, weekRange, users)
  ]);

  return { lsw, rails, rca };
}

async function buildLswAdminRcaOverview(context: AuthorizedLswContext): Promise<LswAdminDashboardOverview['rca']> {
  const snapshot = await context.organizationRef
    .collection(RCA_INCIDENTS_COLLECTION)
    .where('tenantId', '==', context.tenantId)
    .get();
  const incidents = snapshot.docs
    .map((doc) => doc.data() as RcaAdminIncidentRecord)
    .filter((record) => (
      record.status !== 'DELETED' &&
      (record.companyId === context.tenantId || !record.companyId) &&
      isAdminRecordInScope(context, record.departmentId)
    ));
  const openCount = incidents.filter((incident) => incident.status !== 'CLOSED').length;
  const closedCount = incidents.filter((incident) => incident.status === 'CLOSED').length;
  const createdByMeCount = incidents.filter((incident) => incident.createdByUid === context.uid).length;
  const sharedCount = incidents.filter((incident) => Array.isArray(incident.participantUids) && incident.participantUids.length > 0).length;

  return {
    closedCount,
    createdByMeCount,
    createdByTeamCount: Math.max(0, incidents.length - createdByMeCount),
    openCount,
    sharedCount,
    totalCount: incidents.length
  };
}

async function buildLswAdminRailsOverview(context: AuthorizedLswContext): Promise<LswAdminDashboardOverview['rails']> {
  const snapshot = await context.organizationRef
    .collection(RAILS_ITEMS_COLLECTION)
    .where('tenantId', '==', context.tenantId)
    .get();
  const records = snapshot.docs
    .map((doc) => doc.data() as RailsAdminItemRecord)
    .filter((record) => (
      record.status !== 'Deleted' &&
      record.status !== 'Cancelled' &&
      record.status !== 'Archived' &&
      isAdminRecordInScope(context, record.departmentId)
    ));
  const userNamesByUid = await getLswAdminUserNamesByUid(context, records.map((record) => record.ownerUid || '').filter(Boolean));
  const today = parseDateOnly(formatLocalDateOnly(new Date()));

  return {
    byDepartment: buildLswAdminBreakdown(records, (record) => record.departmentName || 'Unassigned department'),
    byResponsibleParty: buildLswAdminBreakdown(records, (record) => (
      record.ownerDisplayName ||
      userNamesByUid.get(record.ownerUid || '') ||
      'Unassigned owner'
    )),
    closedCount: records.filter((record) => record.status === 'Closed').length,
    inProgressCount: records.filter((record) => record.status === 'In Progress' || record.status === 'Verification' || record.status === 'Approved').length,
    openCount: records.filter((record) => record.status !== 'Closed').length,
    pastDueCount: records.filter((record) => {
      const dueDate = record.dueDate ? tryParseDateOnly(record.dueDate) : null;

      return Boolean(dueDate && dueDate.getTime() < today.getTime() && record.status !== 'Closed');
    }).length,
    totalCount: records.length
  };
}

async function buildLswAdminPersonalLswOverview(
  context: AuthorizedLswContext,
  weekRange: { end: Date; start: Date },
  users: LswVerificationUserSummary[]
): Promise<LswAdminDashboardOverview['lsw']> {
  const [todoSnapshot, railSnapshot, followUpSnapshot, scheduledSnapshot] = await Promise.all([
    context.lswProfileRef.collection(LSW_TODO_TASKS_COLLECTION).get(),
    context.lswProfileRef.collection(LSW_MEETING_RAILS_COLLECTION).get(),
    context.lswProfileRef.collection(LSW_FOLLOW_UPS_COLLECTION).get(),
    context.lswProfileRef.collection(LSW_SCHEDULED_TASKS_COLLECTION).get()
  ]);
  const tasks = [
    ...todoSnapshot.docs.map((doc) => {
      const record = doc.data() as LswTodoTaskRecord;

      return buildPersonalLswUpcomingTask(context, record, record.task || 'To do task', 'To Do', record.dueDate, record.completed === true, weekRange);
    }),
    ...railSnapshot.docs.map((doc) => {
      const record = doc.data() as LswMeetingRailRecord;

      return buildPersonalLswUpcomingTask(context, record, record.rail || 'Meeting rail', 'RAILS', record.dueDate, record.completed === true, weekRange);
    }),
    ...followUpSnapshot.docs.map((doc) => {
      const record = doc.data() as LswFollowUpRecord;

      return buildPersonalLswUpcomingTask(context, record, record.followUp || 'Follow up', 'Follow Up', record.dueDate, false, weekRange);
    }),
    ...scheduledSnapshot.docs.map((doc) => {
      const record = doc.data() as LswScheduledTaskRecord;

      return buildPersonalLswUpcomingTask(context, record, record.task || 'Scheduled task', 'Scheduled', record.dueDate, false, weekRange);
    })
  ]
    .filter((task): task is NonNullable<typeof task> => Boolean(task))
    .sort((left, right) => {
      const leftDate = tryParseDateOnly(left.dateLabel) || new Date(0);
      const rightDate = tryParseDateOnly(right.dateLabel) || new Date(0);

      return leftDate.getTime() - rightDate.getTime() || left.title.localeCompare(right.title);
    })
    .slice(0, 6)
    .map((task) => ({
      ...task,
      dateLabel: formatShortDate(parseDateOnly(task.dateLabel))
    }));

  return {
    standardWork: buildLswAdminStandardWorkOverview(users, weekRange),
    upcomingPersonalTasks: tasks
  };
}

function buildLswAdminStandardWorkOverview(
  users: LswVerificationUserSummary[],
  weekRange: { end: Date; start: Date }
): LswAdminDashboardOverview['lsw']['standardWork'] {
  const today = dateOnlyFromDateInTimeZone(new Date());
  const effectiveEnd = new Date(Math.min(today.getTime(), weekRange.end.getTime()));
  const elapsedUsers = users.map((user) => {
    const elapsedMetrics = (user.dailyMetrics.daily_weekly_standard_tasks || [])
      .filter((metric) => {
        const metricDate = tryParseDateOnly(metric.isoDate);

        return Boolean(metricDate && metricDate.getTime() >= weekRange.start.getTime() && metricDate.getTime() <= effectiveEnd.getTime());
      });
    const completedCount = elapsedMetrics.reduce((total, metric) => total + metric.completedCount, 0);
    const expectedCount = elapsedMetrics.reduce((total, metric) => total + metric.expectedCount, 0);
    const lateCount = elapsedMetrics.reduce((total, metric) => total + metric.lateCount, 0);
    const missingCount = elapsedMetrics.reduce((total, metric) => total + metric.missingCount, 0);
    const missedCount = elapsedMetrics.reduce((total, metric) => {
      const metricDate = tryParseDateOnly(metric.isoDate);

      return total + (metricDate && metricDate.getTime() < today.getTime() ? metric.missingCount : 0);
    }, 0);
    const openTodayCount = elapsedMetrics.reduce((total, metric) => {
      const metricDate = tryParseDateOnly(metric.isoDate);

      return total + (metricDate && metricDate.getTime() === today.getTime() ? metric.missingCount : 0);
    }, 0);
    const onTimeCount = elapsedMetrics.reduce((total, metric) => total + (metric.onTimeCount ?? Math.max(0, metric.completedCount - metric.lateCount)), 0);
    const lastCheckoffIso = elapsedMetrics
      .map((metric) => metric.lastCheckoffIso || '')
      .filter(Boolean)
      .sort()
      .at(-1) || null;

    return {
      completedCount,
      completedLateCount: lateCount,
      completionRate: calculateCompletionRate(completedCount, expectedCount),
      departmentName: user.departmentName,
      displayName: user.displayName,
      expectedCount,
      lateCount,
      lastCheckoffIso,
      missedCount,
      missingCount,
      onTimeCount,
      onTimeRate: calculateCompletionRate(onTimeCount, completedCount),
      openTodayCount,
      uid: user.uid
    };
  });
  const dayMetricsByDate = new Map<string, LswAdminDashboardOverview['lsw']['standardWork']['dayMetrics'][number]>();

  users.forEach((user) => {
    (user.dailyMetrics.daily_weekly_standard_tasks || []).forEach((metric) => {
      const metricDate = tryParseDateOnly(metric.isoDate);

      if (!metricDate || metricDate.getTime() < weekRange.start.getTime() || metricDate.getTime() > effectiveEnd.getTime()) {
        return;
      }

      const existing = dayMetricsByDate.get(metric.isoDate) || {
        completedCount: 0,
        completionRate: 0,
        dateLabel: metric.dateLabel,
        dayLabel: metric.dayLabel,
        dueState: 'no_work' as LswVerificationDayMetric['dueState'],
        expectedCount: 0,
        isoDate: metric.isoDate,
        lateCount: 0,
        missingCount: 0,
        onTimeCount: 0
      };

      existing.completedCount += metric.completedCount;
      existing.expectedCount += metric.expectedCount;
      existing.lateCount += metric.lateCount;
      existing.missingCount += metric.missingCount;
      existing.onTimeCount += metric.onTimeCount ?? Math.max(0, metric.completedCount - metric.lateCount);
      existing.completionRate = calculateCompletionRate(existing.completedCount, existing.expectedCount);
      existing.dueState = inferLswVerificationDayState({
        completedCount: existing.completedCount,
        expectedCount: existing.expectedCount,
        lateCount: existing.lateCount,
        missingCount: existing.missingCount
      });
      dayMetricsByDate.set(metric.isoDate, existing);
    });
  });

  const completedCount = elapsedUsers.reduce((total, user) => total + user.completedCount, 0);
  const expectedCount = elapsedUsers.reduce((total, user) => total + user.expectedCount, 0);
  const lateCount = elapsedUsers.reduce((total, user) => total + user.lateCount, 0);
  const missedCount = elapsedUsers.reduce((total, user) => total + user.missedCount, 0);
  const missingCount = elapsedUsers.reduce((total, user) => total + user.missingCount, 0);
  const onTimeCount = elapsedUsers.reduce((total, user) => total + user.onTimeCount, 0);
  const openTodayCount = elapsedUsers.reduce((total, user) => total + user.openTodayCount, 0);

  return {
    activeUserCount: users.length,
    completedCount,
    completedLateCount: lateCount,
    completionRate: calculateCompletionRate(completedCount, expectedCount),
    dayMetrics: [...dayMetricsByDate.values()].sort((left, right) => left.isoDate.localeCompare(right.isoDate)),
    expectedCount,
    lateCount,
    missedCount,
    missingCount,
    onTimeCount,
    onTimeRate: calculateCompletionRate(onTimeCount, completedCount),
    openTodayCount,
    userMetrics: elapsedUsers.sort((left, right) => (
      left.completionRate - right.completionRate ||
      right.missingCount - left.missingCount ||
      left.displayName.localeCompare(right.displayName)
    )),
    usersWithActivityCount: elapsedUsers.filter((user) => user.completedCount > 0).length,
    weekToDateDayCount: dayMetricsByDate.size
  };
}

function buildPersonalLswUpcomingTask(
  context: AuthorizedLswContext,
  record: { companyId?: string; lswId?: string; ownerUid?: string; status?: string; tenantId?: string },
  title: string,
  section: string,
  dateOnly: string | undefined,
  completed: boolean,
  weekRange: { end: Date; start: Date }
): LswAdminDashboardOverview['lsw']['upcomingPersonalTasks'][number] | null {
  const dueDate = dateOnly ? tryParseDateOnly(dateOnly) : null;

  if (
    !dueDate ||
    completed ||
    !isActiveTenantLswRecord(record, context) ||
    dueDate.getTime() > weekRange.end.getTime()
  ) {
    return null;
  }

  return {
    dateLabel: dateOnly || formatIsoDate(dueDate),
    section,
    status: dueDate.getTime() < weekRange.start.getTime() ? 'Past due' : 'Due this week',
    title: title.trim() || section
  };
}

async function getLswAdminUserNamesByUid(context: AuthorizedLswContext, uids: string[]): Promise<Map<string, string>> {
  const uniqueUids = [...new Set(uids)].filter(Boolean);
  const entries = await Promise.all(uniqueUids.map(async (uid) => {
    const snapshot = await context.organizationRef.collection('users').doc(uid).get();

    if (!snapshot.exists) {
      return null;
    }

    const user = snapshot.data() as TenantUserRecord;

    return [uid, getDisplayName(user)] as const;
  }));

  return new Map(entries.filter((entry): entry is readonly [string, string] => Boolean(entry)));
}

function buildLswAdminBreakdown<T>(records: T[], getLabel: (record: T) => string): Array<{ label: string; value: number }> {
  const counts = new Map<string, number>();

  records.forEach((record) => {
    const label = getLabel(record).trim() || 'Unassigned';

    counts.set(label, (counts.get(label) || 0) + 1);
  });

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label))
    .slice(0, 6);
}

function isAdminRecordInScope(context: AuthorizedLswContext, departmentId: string | null | undefined): boolean {
  if (context.role === 'ORG_ADMIN' || context.role === 'SYSTEM_ADMIN') {
    return true;
  }

  return context.role === 'DEPT_ADMIN' && departmentId === context.department.departmentId;
}

function buildLswVerificationSidebarSummary(
  context: AuthorizedLswContext,
  week: LswContextResponse['week'],
  sections: LswVerificationSectionSummary[]
): LswVerificationSidebarSummary {
  const scopeType = context.role === 'ORG_ADMIN' || context.role === 'SYSTEM_ADMIN'
    ? 'Organization'
    : 'Department';
  const scopeName = context.role === 'ORG_ADMIN' || context.role === 'SYSTEM_ADMIN'
    ? context.organization.companyName || 'Organization'
    : context.department.name;
  const getSectionRate = (sectionKey: LswVerificationSectionKey) => (
    sections.find((section) => section.sectionKey === sectionKey)?.completionRate || 0
  );

  return {
    periodLabel: `${week.weekBeginningLabel} - ${week.weekEndingLabel}`,
    scopeLabel: `${scopeType} scope`,
    scopeName,
    scopeSubtitle: scopeType === 'Organization' ? 'Company-wide verification' : 'Department verification',
    workstreams: [
      {
        completionRate: getSectionRate('daily_weekly_standard_tasks'),
        key: 'LSW',
        label: 'LSW'
      },
      {
        completionRate: getSectionRate('plant_specific_cause_rca_triggers'),
        key: 'RCA',
        label: 'RCA'
      },
      {
        completionRate: getSectionRate('level_1_2_3_meeting_rails'),
        key: 'RAILS',
        label: 'RAILS'
      }
    ]
  };
}

function aggregateVerificationTotals(sections: Array<Pick<LswVerificationSectionSummary, 'completedCount' | 'expectedCount' | 'lateCount' | 'missingCount' | 'needsReviewCount'>>): Pick<LswVerificationSectionSummary, 'completedCount' | 'expectedCount' | 'lateCount' | 'missingCount' | 'needsReviewCount'> {
  return sections.reduce((totals, section) => ({
    completedCount: totals.completedCount + section.completedCount,
    expectedCount: totals.expectedCount + section.expectedCount,
    lateCount: totals.lateCount + section.lateCount,
    missingCount: totals.missingCount + section.missingCount,
    needsReviewCount: totals.needsReviewCount + section.needsReviewCount
  }), {
    completedCount: 0,
    expectedCount: 0,
    lateCount: 0,
    missingCount: 0,
    needsReviewCount: 0
  });
}

function calculateCompletionRate(completedCount: number, expectedCount: number): number {
  return expectedCount > 0
    ? Math.round((completedCount / expectedCount) * 100)
    : 0;
}

function isActiveTenantLswRecord(
  record: { companyId?: string; lswId?: string; ownerUid?: string; status?: string; tenantId?: string },
  context: AuthorizedLswContext
): boolean {
  return (
    (record.status || 'ACTIVE') === 'ACTIVE' &&
    record.tenantId === context.tenantId &&
    record.companyId === context.tenantId &&
    record.ownerUid === context.uid &&
    record.lswId === context.lswProfile.lswId
  );
}

function isDateOnlyInRange(value: string | undefined, range: { end: Date; start: Date }): boolean {
  const date = value ? tryParseDateOnly(value) : null;

  return Boolean(date && date.getTime() >= range.start.getTime() && date.getTime() <= range.end.getTime());
}

function isDateOnlyDueByRangeEnd(value: string | undefined, range: { end: Date }): boolean {
  const date = value ? tryParseDateOnly(value) : null;

  return Boolean(date && date.getTime() <= range.end.getTime());
}

function isScheduledTaskInWeek(record: LswScheduledTaskRecord, range: { end: Date; start: Date }): boolean {
  const dueDate = record.dueDate ? tryParseDateOnly(record.dueDate) : null;

  if (!dueDate) {
    return false;
  }

  if (dueDate.getTime() >= range.start.getTime() && dueDate.getTime() <= range.end.getTime()) {
    return true;
  }

  return dueDate.getTime() <= range.end.getTime() && Boolean(record.frequency);
}

async function getAuthorizedLswContext(decodedToken: DecodedIdToken, input: LswContextInput = {}): Promise<AuthorizedLswContext> {
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
  const actorUser = userSnapshot.data() as TenantUserRecord;

  if (
    organization.status !== 'ACTIVE' ||
    actorUser.status !== 'ACTIVE' ||
    (organization.tenantId && organization.tenantId !== tenantId) ||
    (actorUser.tenantId && actorUser.tenantId !== tenantId)
  ) {
    throw authorizationError('Your profile is not active.');
  }

  const actorDepartment = await resolveUserDepartment(tenantId, actorUser, role);
  const observedUid = normalizeObservedUserId(input.observeUserId);
  const isObservation = Boolean(observedUid && observedUid !== decodedToken.uid);
  let targetUid = decodedToken.uid;
  let targetUser = actorUser;

  if (isObservation) {
    if (!canObserveLswProfiles(role)) {
      throw authorizationError('You do not have permission to observe Standard Work.');
    }

    const targetSnapshot = await organizationRef.collection('users').doc(observedUid as string).get();

    if (!targetSnapshot.exists) {
      throw notFoundError('The selected employee was not found.');
    }

    const observedUser = targetSnapshot.data() as TenantUserRecord;

    if (
      observedUser.status !== 'ACTIVE' ||
      (observedUser.tenantId && observedUser.tenantId !== tenantId)
    ) {
      throw authorizationError('The selected employee is not available.');
    }

    const actorContextForScope: Pick<AuthorizedLswContext, 'actorRole' | 'actorUid' | 'department' | 'tenantId'> = {
      actorRole: role,
      actorUid: decodedToken.uid,
      department: actorDepartment,
      tenantId
    };

    if (!canActorObserveLswUser(actorContextForScope, observedUser)) {
      throw authorizationError('The selected employee is outside your observation scope.');
    }

    targetUid = observedUid as string;
    targetUser = observedUser;
  }

  const targetRole = targetUser.role || 'EMPLOYEE';
  const department = await resolveUserDepartment(tenantId, targetUser, targetRole);
  const { lswProfile, lswProfileRef } = await getOrCreateLswProfile({
    department,
    organizationRef,
    tenantId,
    uid: targetUid
  });

  return {
    actorRole: role,
    actorUid: decodedToken.uid,
    department,
    isObservation,
    lswProfile,
    lswProfileRef,
    organization,
    organizationRef,
    role: targetRole,
    tenantId,
    user: targetUser,
    uid: targetUid
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
    observationAvailability: normalizeObservationAvailability(existing?.observationAvailability),
    observationAvailabilityNote: normalizeObservationAvailabilityNote(existing?.observationAvailabilityNote),
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
    !existing.observationAvailability ||
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
      observationAvailability: nextProfile.observationAvailability,
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

function canObserveLswProfiles(role: SynzappRole): boolean {
  return role === 'ORG_ADMIN' || role === 'SYSTEM_ADMIN' || role === 'DEPT_ADMIN';
}

function canActorObserveLswUser(
  context: Pick<AuthorizedLswContext, 'actorRole' | 'actorUid' | 'department' | 'tenantId'>,
  user: TenantUserRecord
): boolean {
  if (user.tenantId && user.tenantId !== context.tenantId) {
    return false;
  }

  if (context.actorRole === 'ORG_ADMIN' || context.actorRole === 'SYSTEM_ADMIN') {
    return true;
  }

  if (context.actorRole !== 'DEPT_ADMIN') {
    return false;
  }

  return Boolean(context.department.departmentId && user.departmentId === context.department.departmentId);
}

function buildLswObservationCandidate(
  uid: string,
  user: TenantUserRecord,
  department?: LswContextResponse['department'],
  lswProfile?: LswProfileRecord
): LswObservationCandidate {
  const availability = normalizeObservationAvailability(lswProfile?.observationAvailability);
  const photo = buildLswUserProfilePhotoSummary(uid, user);

  return {
    availability,
    availabilityLabel: formatObservationAvailability(availability),
    departmentId: department?.departmentId ?? user.departmentId ?? null,
    departmentName: department?.name || user.departmentName || 'Unassigned department',
    displayName: getDisplayName(user),
    profilePhotoCacheKey: photo.profilePhotoCacheKey,
    profilePhotoUrl: photo.profilePhotoUrl,
    role: user.role || 'EMPLOYEE',
    roleName: formatRoleName(user.roleName, user.role || 'EMPLOYEE'),
    uid
  };
}

function buildLswUserProfilePhotoSummary(
  uid: string,
  user: TenantUserRecord
): Pick<LswObservationCandidate, 'profilePhotoCacheKey' | 'profilePhotoUrl'> {
  const profilePhotoUrl = user.profilePhotoUrl || user.profilePhotoStoragePath || null;
  const profilePhotoCacheKey = user.profilePhotoCacheKey
    || (profilePhotoUrl ? `lsw-profile-photo-${uid}-${String(user.profilePhotoVersion || 1)}` : null);

  return {
    profilePhotoCacheKey,
    profilePhotoUrl
  };
}

async function listObservationVisitors(
  context: AuthorizedLswContext,
  weekKey: string
): Promise<LswObservationVisitorSummary[]> {
  const snapshot = await context.lswProfileRef
    .collection(LSW_OBSERVATION_VIEWS_COLLECTION)
    .where('weekKey', '==', weekKey)
    .get();

  return snapshot.docs
    .map((doc) => {
      const record = doc.data() as Record<string, unknown>;
      const viewDateKeys = Array.isArray(record.viewDateKeys)
        ? record.viewDateKeys.filter((value): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))
        : [];
      const viewCount = viewDateKeys.length || Math.min(safeNumber(record.viewCount), 1);

      return {
        departmentName: safeString(record.actorDepartmentName, 'Unassigned department'),
        displayName: safeString(record.actorDisplayName, 'Synzapp user'),
        lastViewedAtIso: safeNullableString(record.lastViewedAtIso),
        profilePhotoCacheKey: safeNullableString(record.actorProfilePhotoCacheKey),
        profilePhotoUrl: safeNullableString(record.actorProfilePhotoUrl),
        roleName: safeString(record.actorRoleName, 'Leader'),
        uid: safeString(record.actorUid, doc.id),
        viewCount
      };
    })
    .sort((left, right) => timestampSortValue(right.lastViewedAtIso) - timestampSortValue(left.lastViewedAtIso));
}

async function countActiveObservationNotes(context: AuthorizedLswContext, weekKey: string): Promise<number> {
  const snapshot = await context.lswProfileRef
    .collection(LSW_OBSERVATION_NOTES_COLLECTION)
    .where('weekKey', '==', weekKey)
    .where('status', '==', 'ACTIVE')
    .get();

  return snapshot.size;
}

async function listObservationAvailabilityHistory(
  context: AuthorizedLswContext,
  weekKey: string
): Promise<LswObservationAvailabilityHistorySummary[]> {
  const snapshot = await context.lswProfileRef
    .collection(LSW_OBSERVATION_AVAILABILITY_HISTORY_COLLECTION)
    .where('weekKeys', 'array-contains', weekKey)
    .where('status', '==', 'ACTIVE')
    .get();

  return snapshot.docs
    .map((doc) => mapObservationAvailabilityHistory(doc.data() as LswObservationAvailabilityLogRecord))
    .sort((left, right) => timestampSortValue(right.changedAtIso) - timestampSortValue(left.changedAtIso));
}

function mapObservationAvailabilityHistory(
  record: LswObservationAvailabilityLogRecord
): LswObservationAvailabilityHistorySummary {
  const availability = normalizeObservationAvailability(record.availability);

  return {
    availability,
    availabilityLabel: formatObservationAvailability(availability),
    changedAtIso: safeNullableString(record.changedAtIso),
    changedBy: {
      departmentName: safeString(record.changedByDepartmentName, 'Unassigned department'),
      displayName: safeString(record.changedByDisplayName, 'Synzapp user'),
      roleName: safeString(record.changedByRoleName, 'Leader'),
      uid: safeString(record.changedByUid, '')
    },
    endDate: safeNullableString(record.endDate),
    note: normalizeObservationAvailabilityNote(record.note),
    startDate: safeNullableString(record.startDate)
  };
}

function buildObservationAvailabilityWeekKeys(
  calendar: CalendarYearSettings,
  startDate: string | null,
  endDate: string | null
): string[] {
  if (!startDate || !endDate) {
    return [];
  }

  const start = tryParseDateOnly(startDate);
  const end = tryParseDateOnly(endDate);

  if (!start || !end) {
    return [];
  }

  const weekKeys = new Set<string>();
  const cursor = new Date(start.getTime());

  while (cursor.getTime() <= end.getTime()) {
    const selection = getWeekSelectionForDate(calendar, cursor);

    weekKeys.add(formatWeekKey(selection.year, selection.week));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return Array.from(weekKeys);
}

function mapObservationNote(
  noteId: string,
  record: Record<string, unknown>,
  actorUid: string,
  actorRole: SynzappRole
): LswObservationNote {
  const sectionKey = normalizeObservationSectionKey(safeString(record.sectionKey, DAILY_TASK_SECTION_KEY) as LswVerificationSectionKey);
  const noteActorUid = safeString(record.actorUid, '');

  return {
    author: {
      departmentName: safeString(record.actorDepartmentName, 'Unassigned department'),
      displayName: safeString(record.actorDisplayName, 'Synzapp user'),
      profilePhotoCacheKey: safeNullableString(record.actorProfilePhotoCacheKey),
      profilePhotoUrl: safeNullableString(record.actorProfilePhotoUrl),
      roleName: safeString(record.actorRoleName, 'Leader'),
      uid: noteActorUid
    },
    body: safeString(record.body, ''),
    canWithdraw: noteActorUid === actorUid || actorRole === 'ORG_ADMIN' || actorRole === 'SYSTEM_ADMIN',
    createdAtIso: safeNullableString(record.createdAtIso),
    noteId,
    sectionKey,
    sectionTitle: LSW_VERIFICATION_SECTION_TITLES[sectionKey],
    weekKey: safeString(record.weekKey, '')
  };
}

function assertObservationNoteBelongsToContext(record: Record<string, unknown>, context: AuthorizedLswContext): void {
  if (
    safeString(record.tenantId, '') !== context.tenantId ||
    safeString(record.ownerUid, '') !== context.uid ||
    safeString(record.lswId, '') !== context.lswProfile.lswId
  ) {
    throw authorizationError('The observation note is outside your observation scope.');
  }
}

function normalizeObservationAvailability(value: unknown): LswObservationAvailability {
  return value === 'ON_LEAVE' || value === 'TEMPORARILY_UNAVAILABLE' || value === 'ACTIVE'
    ? value
    : 'ACTIVE';
}

function normalizeObservationAvailabilityDate(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw validationError(`${fieldName} is required.`);
  }

  const normalizedValue = value.trim();

  if (!tryParseDateOnly(normalizedValue)) {
    throw validationError(`${fieldName} must be a valid date.`);
  }

  return normalizedValue;
}

function normalizeObservationAvailabilityWindow(
  availability: LswObservationAvailability,
  input: LswObservationAvailabilityInput
): { endDate: string | null; startDate: string | null } {
  if (availability === 'ACTIVE') {
    return {
      endDate: null,
      startDate: null
    };
  }

  const startDate = normalizeObservationAvailabilityDate(input.startDate, 'Start date');
  const endDate = normalizeObservationAvailabilityDate(input.endDate, 'End date');

  if (endDate < startDate) {
    throw validationError('End date must be the same as or after the start date.');
  }

  return {
    endDate,
    startDate
  };
}

async function resolveEffectiveObservationAvailability(
  context: AuthorizedLswContext,
  input: LswContextInput
): Promise<{ availability: LswObservationAvailability; endDate: string | null; startDate: string | null }> {
  const availability = normalizeObservationAvailability(context.lswProfile.observationAvailability);
  const startDate = safeNullableString(context.lswProfile.observationAvailabilityStartDate);
  const endDate = safeNullableString(context.lswProfile.observationAvailabilityEndDate);

  if (availability === 'ACTIVE') {
    return {
      availability: 'ACTIVE',
      endDate: null,
      startDate: null
    };
  }

  const todayIso = formatIsoDate(dateOnlyFromDateInTimeZone(new Date(), input.timeZone));

  if (endDate && endDate < todayIso) {
    await context.lswProfileRef.set({
      observationAvailability: 'ACTIVE',
      observationAvailabilityEndDate: null,
      observationAvailabilityNote: '',
      observationAvailabilityResetAt: fieldValue.serverTimestamp(),
      observationAvailabilityStartDate: null,
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });

    context.lswProfile.observationAvailability = 'ACTIVE';
    context.lswProfile.observationAvailabilityEndDate = undefined;
    context.lswProfile.observationAvailabilityNote = '';
    context.lswProfile.observationAvailabilityStartDate = undefined;

    return {
      availability: 'ACTIVE',
      endDate: null,
      startDate: null
    };
  }

  return {
    availability,
    endDate,
    startDate
  };
}

function normalizeObservationAvailabilityNote(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 240) : '';
}

function formatObservationAvailability(value: unknown): string {
  return LSW_OBSERVATION_AVAILABILITY_LABELS[normalizeObservationAvailability(value)];
}

function normalizeObservationNoteBody(value: unknown): string {
  const body = typeof value === 'string' ? value.trim() : '';

  if (!body) {
    throw validationError('Add a note before saving.');
  }

  return body.slice(0, 800);
}

function normalizeObservationSectionKey(value: LswVerificationSectionKey): LswVerificationSectionKey {
  if (value && Object.prototype.hasOwnProperty.call(LSW_VERIFICATION_SECTION_TITLES, value)) {
    return value;
  }

  throw validationError('Select a valid LSW section.');
}

function normalizeDocumentId(value: string): string {
  const candidate = typeof value === 'string' ? value.trim() : '';

  if (!/^[A-Za-z0-9_-]{8,128}$/.test(candidate)) {
    throw validationError('The record identifier is invalid.');
  }

  return candidate;
}

function safeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function safeNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function safeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function timestampSortValue(value: string | null): number {
  return value ? Date.parse(value) || 0 : 0;
}

function normalizeObservedUserId(value: string | undefined): string | null {
  const candidate = typeof value === 'string' ? value.trim() : '';

  if (!candidate) {
    return null;
  }

  return /^[A-Za-z0-9_-]{8,128}$/.test(candidate) ? candidate : null;
}

async function seedDefaultDailyTasksIfEmpty(context: AuthorizedLswContext): Promise<void> {
  if (context.isObservation) {
    return;
  }

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
