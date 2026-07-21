import { randomUUID } from 'node:crypto';
import { DecodedIdToken } from 'firebase-admin/auth';
import { fieldValue, firestore, storageBucket } from '../config/firebaseAdmin.js';
import { SynzappRole } from '../types/auth.js';
import { buildAuthSession } from './authSessionService.js';
import { sendRailsPushNotification } from './notificationService.js';
import { createRcaIncident } from './rcaService.js';
import {
  HUMAN_RESOURCES_DEPARTMENT_ID,
  HUMAN_RESOURCES_DEPARTMENT_NAME
} from './tenantDefaults.js';

type RailsStatus = 'New' | 'Triaged' | 'In Progress' | 'Verification' | 'Approved' | 'Closed' | 'Reopened' | 'Cancelled' | 'Archived';
type RailsPriority = 'Critical' | 'High' | 'Medium' | 'Low';
type RailsCategory = 'Food Safety' | 'People Safety' | 'Quality' | 'Delivery' | 'Cost' | 'Process';
type RailsStandardizationStatus = 'Not Started' | 'In Progress' | 'Implemented' | 'Verified';
type RailsStandardizationType = 'SOP' | 'Checklist' | 'LSW Audit' | 'Training' | 'PM Task' | 'Visual Control' | 'Work Instruction' | 'Other';
type RailsEvidencePurpose = 'general' | 'standardization';
type RailsEvidenceVisibility = 'public' | 'private';
type RailsLswSourceType = 'todoTask' | 'meetingRail' | 'followUp' | 'rcaTrigger' | 'improvementProject';
type RailsRcaDecisionStatus = 'Linked' | 'Not Required' | 'Triage Requested' | 'Converted' | 'Not Linked';
type RailsRcaTriageStatus = 'Requested' | 'Accepted' | 'Rejected' | 'Converted';
type RailsNotificationType =
  | 'RAILS_APPROVER_REQUESTED'
  | 'RAILS_BULK_ACTION_COMPLETED'
  | 'RAILS_EVIDENCE_REQUIRED'
  | 'RAILS_EXPORT_CREATED'
  | 'RAILS_LOOP_ASSIGNED'
  | 'RAILS_LOOP_CLOSED'
  | 'RAILS_LOOP_REOPENED'
  | 'RAILS_OVERDUE_ESCALATED'
  | 'RAILS_STANDARDIZATION_VERIFICATION_REQUESTED';
type RailsAuditEventType =
  | 'RAILS_ACTION_ADDED'
  | 'RAILS_ACTION_DELETED'
  | 'RAILS_ACTION_REORDERED'
  | 'RAILS_ACTION_UPDATED'
  | 'RAILS_ARCHIVED'
  | 'RAILS_BULK_ACTION_COMPLETED'
  | 'RAILS_CANCELLED'
  | 'RAILS_COLLABORATOR_ADDED'
  | 'RAILS_COLLABORATOR_REMOVED'
  | 'RAILS_COMMENT_ADDED'
  | 'RAILS_CREATED'
  | 'RAILS_EVIDENCE_ADDED'
  | 'RAILS_EVIDENCE_DELETED'
  | 'RAILS_EVIDENCE_LINKED'
  | 'RAILS_EVIDENCE_UNLINKED'
  | 'RAILS_EVIDENCE_UPDATED'
  | 'RAILS_ESCALATED'
  | 'RAILS_EXPORT_CREATED'
  | 'RAILS_LSW_LINKED'
  | 'RAILS_RCA_CONVERTED'
  | 'RAILS_RCA_DECISION_UPDATED'
  | 'RAILS_RCA_TRIAGE_REQUESTED'
  | 'RAILS_REOPENED'
  | 'RAILS_STANDARDIZATION_UPDATED'
  | 'RAILS_STANDARDIZATION_VERIFIED'
  | 'RAILS_STATUS_CHANGED'
  | 'RAILS_UPDATED';

interface OrganizationRecord {
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
  profilePhotoStoragePath?: string | null;
  profilePhotoVersion?: number | null;
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

interface AuthorizedRailsContext {
  department: RailsWorkspaceContext['department'];
  organization: OrganizationRecord;
  organizationRef: FirebaseFirestore.DocumentReference;
  permissions: string[];
  role: SynzappRole;
  tenantId: string;
  user: TenantUserRecord;
  uid: string;
}

interface RailsItemRecord {
  actions?: RailsActionRecord[];
  actionsComplete?: number;
  actionsProgressPercent?: number;
  actionsTotal?: number;
  approverUid?: string | null;
  archivedAtIso?: string | null;
  archivedByUid?: string | null;
  archiveReason?: string | null;
  cancelledAtIso?: string | null;
  cancelledByUid?: string | null;
  cancelReason?: string | null;
  category?: RailsCategory;
  comments?: RailsComment[];
  companyId?: string;
  contributorUids?: string[];
  createdAt?: FirestoreDateLike;
  createdAtIso?: string;
  createdByUid?: string;
  departmentId?: string | null;
  departmentName?: string | null;
  displayId?: string;
  dueDate?: string;
  evidence?: RailsEvidence[];
  itemId?: string;
  linkedLsw?: string;
  linkedLswSource?: RailsLswSource | null;
  linkedRca?: string;
  linkedRcaDecision?: RailsRcaDecision | null;
  linkedRcaId?: string | null;
  rcaTriageRequest?: RailsRcaTriageRequest | null;
  lastEscalatedAtIso?: string | null;
  lastEscalationLevel?: RailsEscalationSummary['level'] | null;
  ownerUid?: string;
  priority?: RailsPriority;
  problem?: string;
  reopenedAtIso?: string | null;
  reopenedByUid?: string | null;
  reopenReason?: string | null;
  source?: string;
  standardization?: string;
  standardizationDocumentCurrentVersionId?: string | null;
  standardizationDocumentVersions?: RailsStandardizationDocumentVersion[];
  standardizationDueDate?: string;
  standardizationOwnerUid?: string | null;
  standardizationStatus?: RailsStandardizationStatus;
  standardizationType?: RailsStandardizationType | null;
  standardizationVerifiedAtIso?: string | null;
  standardizationVerifiedByUid?: string | null;
  standardizationVerification?: string;
  status?: RailsStatus | 'Deleted';
  tenantId?: string;
  title?: string;
  updatedAt?: FirestoreDateLike;
  updatedAtIso?: string;
  verification?: string;
  watcherUids?: string[];
}

interface RailsLswSource {
  departmentName: string | null;
  linkedAtIso: string;
  linkedByUid: string;
  lswId: string;
  sourceId: string;
  sourceType: RailsLswSourceType;
  sourceTypeLabel: string;
  status: string;
  title: string;
  weekKey: string | null;
}

export interface RailsLswSourceCandidate extends RailsLswSource {
  createdAtIso: string | null;
  dueDate: string | null;
  displayLabel: string;
}

interface RailsRcaDecision {
  decidedAtIso: string;
  decidedByUid: string;
  reason: string;
  status: RailsRcaDecisionStatus;
}

interface RailsRcaTriageRequest {
  assignedToUid: string | null;
  convertedAtIso?: string | null;
  convertedByUid?: string | null;
  convertedRcaDisplayId?: string | null;
  convertedRcaId?: string | null;
  dueDate: string | null;
  reason: string;
  requestedAtIso: string;
  requestedByUid: string;
  reviewNote?: string | null;
  reviewedAtIso?: string | null;
  reviewedByUid?: string | null;
  status: RailsRcaTriageStatus;
}

interface RcaIncidentRecord {
  createdByUid?: string;
  displayId?: string;
  participantUids?: string[];
  status?: string;
  tenantId?: string;
  title?: string;
  updatedAt?: FirestoreDateLike;
  updatedAtIso?: string;
}

type FirestoreDateLike = string | { seconds?: number; toDate?: () => Date } | null | undefined;

export interface RailsWorkspaceContext {
  company: {
    companyName: string;
    tenantId: string;
  };
  department: {
    departmentId: string | null;
    name: string;
    status: string;
  };
  user: {
    displayName: string;
    role: SynzappRole;
    roleName: string;
    uid: string;
  };
}

export interface RailsUserSummary {
  departmentName: string | null;
  displayName: string;
  initials: string;
  profilePhotoCacheKey: string | null;
  profilePhotoUrl: string | null;
  roleName: string;
  uid: string;
}

export interface RailsComment {
  authorUid: string;
  body: string;
  commentId: string;
  createdAtIso: string;
}

export interface RailsAuditActivity {
  actorDisplayName: string;
  actorRole: string;
  actorUid: string;
  after: Record<string, unknown> | null;
  before: Record<string, unknown> | null;
  createdAtIso: string;
  eventId: string;
  itemId: string;
  metadata: Record<string, unknown>;
  reason: string | null;
  summary: string;
  type: RailsAuditEventType;
}

export interface RailsEvidence {
  contentType?: string | null;
  fileSizeBytes?: number | null;
  fileName?: string | null;
  fileUrl?: string | null;
  evidenceId: string;
  label: string;
  note?: string;
  purpose?: RailsEvidencePurpose;
  status: 'Attached' | 'Required' | 'Review';
  sourceEvidenceId?: string | null;
  uploadedAtIso?: string | null;
  uploadedByUid?: string | null;
  visibility?: RailsEvidenceVisibility;
}

export interface RailsEvidenceFile {
  contentType: string;
  fileName: string;
  payload: Buffer;
}

export interface RailsStandardizationDocumentVersion {
  contentType: string | null;
  evidenceId: string;
  fileName: string;
  fileUrl: string;
  storagePath: string;
  uploadedAtIso: string;
  uploadedByUid: string;
  uploaderName?: string | null;
  versionId: string;
  versionNumber: number;
}

export interface RailsActionRecord {
  actionId: string;
  completedAtCorrectionReason?: string;
  completedAtIso?: string | null;
  completedByExternalName?: string;
  completedByUid?: string | null;
  containmentNote?: string;
  dueDate?: string;
  effectivenessCriteria?: string;
  effectivenessResult?: string;
  evidenceIds?: string[];
  implementationNote?: string;
  ownerUid?: string;
  progressPercent?: number;
  riskControlled?: string;
  startedAtCorrectionReason?: string;
  startedAtIso?: string | null;
  startedByUid?: string | null;
  status: 'Open' | 'In Progress' | 'Blocked' | 'Done';
  standardizationNote?: string;
  title: string;
  verificationNote?: string;
  verifiedAtIso?: string | null;
  verifiedByUid?: string | null;
}

export interface RailsAction {
  actionId: string;
  completedAtCorrectionReason: string;
  completedAtIso: string | null;
  completedBy: RailsUserSummary | null;
  completedByExternalName: string;
  completedByUid: string | null;
  containmentNote: string;
  dueDate: string;
  effectivenessCriteria: string;
  effectivenessResult: string;
  evidenceIds: string[];
  implementationNote: string;
  owner: RailsUserSummary | null;
  ownerUid: string;
  progressPercent: number;
  riskControlled: string;
  startedAtCorrectionReason: string;
  startedAtIso: string | null;
  startedBy: RailsUserSummary | null;
  startedByUid: string | null;
  status: 'Open' | 'In Progress' | 'Blocked' | 'Done';
  standardizationNote: string;
  title: string;
  verificationNote: string;
  verifiedAtIso: string | null;
  verifiedBy: RailsUserSummary | null;
  verifiedByUid: string | null;
}

export interface RailsItem {
  actions: RailsAction[];
  actionsComplete: number;
  actionsProgressPercent: number;
  actionsTotal: number;
  approver: RailsUserSummary | null;
  archivedAtIso: string | null;
  archivedBy: RailsUserSummary | null;
  archiveReason: string | null;
  cancelledAtIso: string | null;
  cancelledBy: RailsUserSummary | null;
  cancelReason: string | null;
  category: RailsCategory;
  comments: RailsComment[];
  contributors: RailsUserSummary[];
  createdAtIso: string;
  departmentName: string | null;
  displayId: string;
  dueDate: string;
  evidence: RailsEvidence[];
  escalation: RailsEscalationSummary;
  id: string;
  linkedLsw: string;
  linkedLswSource: RailsLswSource | null;
  linkedRca: string;
  linkedRcaDecision: RailsRcaDecision | null;
  linkedRcaId: string | null;
  owner: RailsUserSummary;
  priority: RailsPriority;
  problem: string;
  reopenedAtIso: string | null;
  reopenedBy: RailsUserSummary | null;
  reopenReason: string | null;
  rcaTriageRequest: RailsRcaTriageRequest | null;
  source: string;
  standardization: string;
  standardizationDocumentCurrentVersionId: string | null;
  standardizationDocumentVersions: RailsStandardizationDocumentVersion[];
  standardizationDueDate: string;
  standardizationOwner: RailsUserSummary | null;
  standardizationOwnerUid: string | null;
  standardizationStatus: RailsStandardizationStatus;
  standardizationType: RailsStandardizationType | null;
  standardizationVerifiedAtIso: string | null;
  standardizationVerifiedBy: RailsUserSummary | null;
  standardizationVerifiedByUid: string | null;
  standardizationVerification: string;
  status: RailsStatus;
  title: string;
  updatedAtIso: string;
  verification: string;
  workflowGate: RailsWorkflowGate;
}

export interface RailsWorkflowGate {
  blockers: string[];
  canAdvance: boolean;
  currentStatus: RailsStatus;
  nextStatus: RailsStatus | null;
}

export interface RailsEscalationSummary {
  level: 'Critical' | 'None' | 'Overdue' | 'Watch';
  overdue: boolean;
  overdueDays: number;
  reasons: string[];
}

export interface RailsItemInput {
  approverUid?: string | null;
  category?: RailsCategory;
  contributorUids?: string[];
  dueDate?: string;
  ownerUid?: string;
  priority?: RailsPriority;
  problem?: string;
  reopenReason?: string;
  source?: string;
  linkedLswSourceId?: string | null;
  linkedLswSourceType?: RailsLswSourceType | null;
  title?: string;
}

export interface RailsItemPatch {
  approverUid?: string | null;
  archiveReason?: string;
  cancelReason?: string;
  category?: RailsCategory;
  dueDate?: string;
  linkedRca?: string;
  linkedRcaDecisionReason?: string;
  linkedRcaId?: string | null;
  linkedLswSourceId?: string | null;
  linkedLswSourceType?: RailsLswSourceType | null;
  ownerUid?: string;
  priority?: RailsPriority;
  problem?: string;
  reopenReason?: string;
  source?: string;
  status?: RailsStatus;
  standardization?: string;
  standardizationDueDate?: string;
  standardizationOwnerUid?: string | null;
  standardizationStatus?: RailsStandardizationStatus;
  standardizationType?: RailsStandardizationType | null;
  standardizationVerification?: string;
  title?: string;
  verification?: string;
}

export interface RailsRcaTriageRequestInput {
  assignedToUid?: string | null;
  dueDate?: string | null;
  reason?: string;
}

export interface RailsRcaTriageReviewInput {
  assignedToUid?: string | null;
  dueDate?: string | null;
  reviewNote?: string;
  status?: RailsRcaTriageStatus;
}

export interface RailsBulkUpdateInput {
  collaboratorUid?: string;
  itemIds: string[];
  patch?: RailsItemPatch;
}

export interface RailsBulkUpdateResult {
  failed: number;
  results: Array<{
    error?: string;
    item?: RailsItem;
    itemId: string;
    status: 'failed' | 'updated';
  }>;
  succeeded: number;
}

export interface RailsActionInput {
  completedAtCorrectionReason?: string;
  completedAtIso?: string | null;
  completedByExternalName?: string;
  completedByUid?: string | null;
  containmentNote?: string;
  dueDate?: string;
  effectivenessCriteria?: string;
  effectivenessResult?: string;
  evidenceIds?: string[];
  implementationNote?: string;
  ownerUid?: string;
  progressPercent?: number;
  riskControlled?: string;
  startedAtCorrectionReason?: string;
  startedAtIso?: string | null;
  startedByUid?: string | null;
  standardizationNote?: string;
  title?: string;
  verificationNote?: string;
  verifiedByUid?: string | null;
}

export interface RailsActionPatch {
  completedAtCorrectionReason?: string;
  completedAtIso?: string | null;
  completedByExternalName?: string;
  completedByUid?: string | null;
  containmentNote?: string;
  dueDate?: string;
  effectivenessCriteria?: string;
  effectivenessResult?: string;
  evidenceIds?: string[];
  implementationNote?: string;
  ownerUid?: string;
  progressPercent?: number;
  riskControlled?: string;
  startedAtCorrectionReason?: string;
  startedAtIso?: string | null;
  startedByUid?: string | null;
  status?: RailsAction['status'];
  standardizationNote?: string;
  title?: string;
  verificationNote?: string;
  verifiedByUid?: string | null;
}

export interface RailsEvidenceInput {
  dataUrl?: string;
  evidenceId?: string;
  fileName?: string;
  label?: string;
  note?: string;
  purpose?: RailsEvidencePurpose;
  sourceEvidenceId?: string | null;
  status?: RailsEvidence['status'];
  visibility?: RailsEvidenceVisibility;
}

export interface RailsRcaLinkCandidate {
  displayId: string;
  id: string;
  status: string;
  title: string;
  updatedAtIso: string | null;
}

export interface RailsHistoryQuery {
  category?: RailsCategory;
  dateFrom?: string;
  dateTo?: string;
  departmentName?: string;
  ownerUid?: string;
  priority?: RailsPriority;
  search?: string;
  status?: RailsStatus | 'All';
}

export interface RailsHistoryResponse {
  items: RailsItem[];
  total: number;
}

export interface RailsActivityResponse {
  activity: RailsAuditActivity[];
}

export interface RailsReportBreakdownEntry {
  label: string;
  value: number;
}

export interface RailsReportResponse {
  agingBuckets: {
    label: string;
    value: number;
  }[];
  averageAgeDays: number;
  byCategory: RailsReportBreakdownEntry[];
  byDepartment: RailsReportBreakdownEntry[];
  byOwner: RailsReportBreakdownEntry[];
  byPriority: RailsReportBreakdownEntry[];
  byStatus: RailsReportBreakdownEntry[];
  metrics: {
    actionProgress: number;
    archivedItems: number;
    cancelledItems: number;
    closedItems: number;
    closureRate: number;
    criticalItems: number;
    escalatedItems: number;
    openItems: number;
    overdueItems: number;
    rcaLinkedItems: number;
    reopenRate: number;
    reopenedItems: number;
    standardizationCompliance: number;
    totalItems: number;
    verificationItems: number;
  };
  generatedAtIso: string;
}

export interface RailsExportResponse {
  content: string;
  contentType: string;
  fileName: string;
}

export interface RailsWorkflowPolicyCheckInput {
  current: Partial<RailsItemRecord>;
  targetStatus: RailsStatus;
  next?: Partial<RailsItemRecord>;
}

export interface RailsWorkflowPolicyCheckResult {
  allowed: boolean;
  blockers: string[];
  message: string | null;
}

const RAILS_ITEMS_COLLECTION = 'railsItems';
const RAILS_AUDIT_EVENTS_COLLECTION = 'railsAuditEvents';
const RAILS_ITEM_ACTIVITY_COLLECTION = 'activity';
const RAILS_NOTIFICATIONS_COLLECTION = 'railsNotificationQueue';
const RCA_INCIDENTS_COLLECTION = 'rcaIncidents';
const LSW_PROFILE_COLLECTION = 'lswProfiles';
const LSW_TODO_TASKS_COLLECTION = 'todoTasks';
const LSW_MEETING_RAILS_COLLECTION = 'meetingRails';
const LSW_FOLLOW_UPS_COLLECTION = 'followUps';
const LSW_RCA_TRIGGERS_COLLECTION = 'rcaTriggers';
const LSW_IMPROVEMENT_PROJECTS_COLLECTION = 'improvementProjects';
const MAX_RAILS_ITEMS = 160;
const MAX_RAILS_EVIDENCE_BYTES = 4 * 1024 * 1024;
const RAILS_STATUSES = new Set<RailsStatus>(['New', 'Triaged', 'In Progress', 'Verification', 'Approved', 'Closed', 'Reopened', 'Cancelled', 'Archived']);
const RAILS_ACTIVE_STATUSES = new Set<RailsStatus>(['New', 'Triaged', 'In Progress', 'Verification', 'Approved', 'Closed', 'Reopened']);
const RAILS_ACTION_STATUSES = new Set<RailsAction['status']>(['Open', 'In Progress', 'Blocked', 'Done']);

export async function listRailsWorkspace(decodedToken: DecodedIdToken): Promise<{
  candidates: RailsUserSummary[];
  context: RailsWorkspaceContext;
  items: RailsItem[];
  lswCandidates: RailsLswSourceCandidate[];
  rcaCandidates: RailsRcaLinkCandidate[];
  summary: {
    criticalItems: number;
    escalatedItems: number;
    openItems: number;
    overdueItems: number;
    verificationItems: number;
  };
}> {
  const context = await getAuthorizedRailsContext(decodedToken);
  const [itemDocs, candidates, rcaCandidates, lswCandidates] = await Promise.all([
    listAccessibleRailsItemDocs(context),
    listRailsUserCandidates(decodedToken),
    listRailsRcaCandidates(decodedToken),
    listRailsLswSourceCandidates(decodedToken)
  ]);
  await recordRailsEscalations(context, itemDocs);
  const userIds = itemDocs.flatMap((doc) => {
    const record = doc.data() as RailsItemRecord;

    return [
      record.ownerUid || '',
      record.approverUid || '',
      record.standardizationOwnerUid || '',
      record.standardizationVerifiedByUid || '',
      record.reopenedByUid || '',
      record.archivedByUid || '',
      record.cancelledByUid || '',
      ...(Array.isArray(record.contributorUids) ? record.contributorUids : []),
      ...getRailsActionUserIds(record.actions),
      ...(Array.isArray(record.standardizationDocumentVersions) ? record.standardizationDocumentVersions.map((version) => version.uploadedByUid || '') : [])
    ];
  });
  const usersByUid = await getRailsUserSummariesByUid(context, userIds);
  const items = itemDocs
    .map((doc) => mapRailsItem(doc.id, doc.data() as RailsItemRecord, context, usersByUid))
    .sort((first, second) => Date.parse(second.updatedAtIso) - Date.parse(first.updatedAtIso));

  return {
    candidates,
    context: mapRailsContext(context),
    items,
    lswCandidates,
    rcaCandidates,
    summary: {
      criticalItems: items.filter((item) => item.priority === 'Critical' && item.status !== 'Closed' && item.status !== 'Cancelled' && item.status !== 'Archived').length,
      escalatedItems: items.filter((item) => item.escalation.level === 'Critical' || item.escalation.level === 'Overdue').length,
      openItems: items.filter((item) => item.status !== 'Closed' && item.status !== 'Cancelled' && item.status !== 'Archived').length,
      overdueItems: items.filter((item) => item.escalation.overdue).length,
      verificationItems: items.filter((item) => item.status === 'Verification' || item.status === 'Approved').length
    }
  };
}

export async function listRailsHistory(
  decodedToken: DecodedIdToken,
  query: RailsHistoryQuery = {}
): Promise<RailsHistoryResponse> {
  const context = await getAuthorizedRailsContext(decodedToken);
  const itemDocs = await listAccessibleRailsItemDocs(context, { includeTerminal: true, limit: 500 });
  const usersByUid = await getRailsUserSummariesByUid(context, collectRailsItemUserIds(itemDocs));
  const items = itemDocs
    .map((doc) => mapRailsItem(doc.id, doc.data() as RailsItemRecord, context, usersByUid))
    .filter((item) => matchesRailsHistoryQuery(item, query))
    .sort((first, second) => Date.parse(second.updatedAtIso) - Date.parse(first.updatedAtIso));

  return {
    items,
    total: items.length
  };
}

export async function getRailsReport(decodedToken: DecodedIdToken): Promise<RailsReportResponse> {
  const context = await getAuthorizedRailsContext(decodedToken);
  const itemDocs = await listAccessibleRailsItemDocs(context, { includeTerminal: true, limit: 750 });
  const usersByUid = await getRailsUserSummariesByUid(context, collectRailsItemUserIds(itemDocs));
  const items = itemDocs.map((doc) => mapRailsItem(doc.id, doc.data() as RailsItemRecord, context, usersByUid));
  const openItems = items.filter((item) => !isTerminalRailsStatus(item.status));
  const closedItems = items.filter((item) => item.status === 'Closed');
  const reopenedItems = items.filter((item) => item.status === 'Reopened' || Boolean(item.reopenedAtIso));
  const totalItems = items.length;

  return {
    agingBuckets: buildRailsAgingBuckets(openItems),
    averageAgeDays: Math.round(openItems.reduce((sum, item) => sum + getAgeDays(item.createdAtIso), 0) / Math.max(1, openItems.length)),
    byCategory: buildRailsBreakdown(items, (item) => item.category),
    byDepartment: buildRailsBreakdown(items, (item) => item.departmentName || 'Unassigned department'),
    byOwner: buildRailsBreakdown(items, (item) => item.owner.displayName),
    byPriority: buildRailsBreakdown(items, (item) => item.priority),
    byStatus: buildRailsBreakdown(items, (item) => item.status),
    generatedAtIso: new Date().toISOString(),
    metrics: {
      actionProgress: Math.round(items.reduce((sum, item) => sum + item.actionsProgressPercent, 0) / Math.max(1, totalItems)),
      archivedItems: items.filter((item) => item.status === 'Archived').length,
      cancelledItems: items.filter((item) => item.status === 'Cancelled').length,
      closedItems: closedItems.length,
      closureRate: Math.round((closedItems.length / Math.max(1, totalItems)) * 100),
      criticalItems: items.filter((item) => item.priority === 'Critical' && !isTerminalRailsStatus(item.status)).length,
      escalatedItems: items.filter((item) => item.escalation.level === 'Critical' || item.escalation.level === 'Overdue').length,
      openItems: openItems.length,
      overdueItems: items.filter((item) => item.escalation.overdue).length,
      rcaLinkedItems: items.filter((item) => Boolean(item.linkedRcaId)).length,
      reopenRate: Math.round((reopenedItems.length / Math.max(1, totalItems)) * 100),
      reopenedItems: reopenedItems.length,
      standardizationCompliance: Math.round((items.filter((item) => item.standardizationStatus === 'Verified').length / Math.max(1, totalItems)) * 100),
      totalItems,
      verificationItems: items.filter((item) => item.status === 'Verification' || item.status === 'Approved').length
    }
  };
}

export async function exportRailsHistoryCsv(
  decodedToken: DecodedIdToken,
  query: RailsHistoryQuery = {}
): Promise<RailsExportResponse> {
  const context = await getAuthorizedRailsContext(decodedToken);
  const history = await listRailsHistory(decodedToken, query);
  const csv = buildRailsCsv(history.items);
  const fileName = `synzapp-rails-export-${new Date().toISOString().slice(0, 10)}.csv`;

  await writeRailsTenantAuditEvent({
    context,
    metadata: {
      exportedItems: history.total,
      filters: stripUndefinedAuditValues(query),
      format: 'csv'
    },
    summary: `Exported ${history.total} RAILS loop${history.total === 1 ? '' : 's'} to CSV.`,
    type: 'RAILS_EXPORT_CREATED'
  });

  return { content: csv, contentType: 'text/csv; charset=utf-8', fileName };
}

export async function exportRailsHistoryJson(
  decodedToken: DecodedIdToken,
  query: RailsHistoryQuery = {}
): Promise<RailsExportResponse> {
  const context = await getAuthorizedRailsContext(decodedToken);
  const history = await listRailsHistory(decodedToken, query);
  const fileName = `synzapp-rails-export-${new Date().toISOString().slice(0, 10)}.json`;
  const content = JSON.stringify({
    exportedAtIso: new Date().toISOString(),
    filters: stripUndefinedAuditValues(query),
    items: history.items,
    total: history.total
  }, null, 2);

  await writeRailsTenantAuditEvent({
    context,
    metadata: {
      exportedItems: history.total,
      filters: stripUndefinedAuditValues(query),
      format: 'json'
    },
    summary: `Exported ${history.total} RAILS loop${history.total === 1 ? '' : 's'} to JSON.`,
    type: 'RAILS_EXPORT_CREATED'
  });

  return { content, contentType: 'application/json; charset=utf-8', fileName };
}

export async function listRailsUserCandidates(decodedToken: DecodedIdToken): Promise<RailsUserSummary[]> {
  const context = await getAuthorizedRailsContext(decodedToken);
  const snapshot = await context.organizationRef
    .collection('users')
    .where('status', '==', 'ACTIVE')
    .get();

  return snapshot.docs
    .filter((doc) => {
      const user = doc.data() as TenantUserRecord;

      return user.tenantId === context.tenantId && user.status === 'ACTIVE';
    })
    .map((doc) => buildRailsUserSummary(doc.id, doc.data() as TenantUserRecord))
    .sort((first, second) => first.displayName.localeCompare(second.displayName));
}

export function checkRailsWorkflowPolicy(input: RailsWorkflowPolicyCheckInput): RailsWorkflowPolicyCheckResult {
  const currentRecord = input.current as RailsItemRecord;
  const nextRecord = {
    ...currentRecord,
    ...(input.next || {}),
    status: input.targetStatus
  } as RailsItemRecord;

  try {
    validateRailsStatusTransition(currentRecord, nextRecord, input.targetStatus);
    return {
      allowed: true,
      blockers: [],
      message: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RAILS gate blocked.';
    return {
      allowed: false,
      blockers: parseRailsGateBlockers(message),
      message
    };
  }
}

export async function createRailsItem(
  decodedToken: DecodedIdToken,
  input: RailsItemInput = {}
): Promise<RailsItem> {
  const context = await getAuthorizedRailsContext(decodedToken);
  const ownerUid = safeUserId(input.ownerUid || context.uid);
  const nowIso = new Date().toISOString();
  const contributorUids = normalizeUserIds(input.contributorUids || []).filter((uid) => uid !== ownerUid);
  const approverUid = input.approverUid ? safeUserId(input.approverUid) : null;
  const usersByUid = await getRailsUserSummariesByUid(context, [ownerUid, approverUid || '', ...contributorUids]);

  if (!usersByUid.has(ownerUid)) {
    throw validationError('Select an active company user as the owner.');
  }

  if (approverUid && !usersByUid.has(approverUid)) {
    throw validationError('Select an active company user as the approver.');
  }

  if (contributorUids.some((uid) => !usersByUid.has(uid))) {
    throw validationError('One selected contributor is not active in this company.');
  }

  const linkedLswSource = input.linkedLswSourceId && input.linkedLswSourceType
    ? await getAccessibleLswSource(context, input.linkedLswSourceType, input.linkedLswSourceId)
    : null;
  const itemRef = context.organizationRef.collection(RAILS_ITEMS_COLLECTION).doc();
  const itemRecord: RailsItemRecord = {
    actionsComplete: 0,
    actionsProgressPercent: 0,
    actionsTotal: 3,
    actions: buildDefaultRailsActions(ownerUid, normalizeDate(input.dueDate, getDefaultDueDate())),
    approverUid,
    category: input.category || 'Process',
    comments: [{
      authorUid: context.uid,
      body: 'Loop created and ready for triage.',
      commentId: `comment_${randomUUID().replace(/-/g, '')}`,
      createdAtIso: nowIso
    }],
    companyId: context.tenantId,
    contributorUids,
    createdAtIso: nowIso,
    createdByUid: context.uid,
    departmentId: context.department.departmentId,
    departmentName: context.department.name,
    displayId: buildRailsDisplayId(itemRef.id, nowIso),
    dueDate: normalizeDate(input.dueDate, getDefaultDueDate()),
    evidence: [
      { contentType: null, evidenceId: `ev_${randomUUID().replace(/-/g, '')}`, fileName: null, fileSizeBytes: null, fileUrl: null, label: 'Problem photo or file', status: 'Required', uploadedAtIso: null, uploadedByUid: null, visibility: 'public' },
      { contentType: null, evidenceId: `ev_${randomUUID().replace(/-/g, '')}`, fileName: null, fileSizeBytes: null, fileUrl: null, label: 'Verification result', status: 'Required', uploadedAtIso: null, uploadedByUid: null, visibility: 'public' }
    ],
    itemId: itemRef.id,
    linkedLsw: getRailsLswDisplay(linkedLswSource),
    linkedLswSource,
    linkedRca: 'Pending triage',
    linkedRcaDecision: {
      decidedAtIso: nowIso,
      decidedByUid: context.uid,
      reason: '',
      status: 'Not Linked'
    },
    linkedRcaId: null,
    rcaTriageRequest: null,
    ownerUid,
    priority: input.priority || 'Medium',
    problem: normalizeText(input.problem, 'New improvement loop created from RAILS intake.', 600),
    source: normalizeText(input.source, 'Manual intake', 80),
    standardization: 'Define during triage.',
    status: 'New',
    tenantId: context.tenantId,
    title: normalizeText(input.title, 'New improvement loop', 180),
    updatedAtIso: nowIso,
    verification: 'Supervisor review before closure',
    watcherUids: []
  };
  itemRecord.actionsComplete = countCompletedActions(itemRecord.actions);
  itemRecord.actionsProgressPercent = getActionsProgressPercent(itemRecord.actions);
  itemRecord.actionsTotal = itemRecord.actions?.length || 0;

  await itemRef.set({
    ...itemRecord,
    createdAt: fieldValue.serverTimestamp(),
    updatedAt: fieldValue.serverTimestamp()
  });
  await writeRailsAuditEvent({
    after: {
      ownerUid: itemRecord.ownerUid,
      priority: itemRecord.priority,
      status: itemRecord.status,
      title: itemRecord.title
    },
    context,
    itemId: itemRef.id,
    itemRef,
    metadata: {
      displayId: itemRecord.displayId,
      source: itemRecord.source
    },
    summary: `Created RAILS loop ${itemRecord.displayId}.`,
    type: 'RAILS_CREATED'
  });
  await queueRailsNotification({
    context,
    itemId: itemRef.id,
    message: `${itemRecord.displayId} was assigned to you.`,
    metadata: { displayId: itemRecord.displayId, status: itemRecord.status },
    recipientUids: [ownerUid, approverUid || '', ...contributorUids],
    type: approverUid ? 'RAILS_APPROVER_REQUESTED' : 'RAILS_LOOP_ASSIGNED'
  });

  return mapRailsItem(itemRef.id, itemRecord, context, usersByUid);
}

export async function updateRailsItem(
  decodedToken: DecodedIdToken,
  itemId: string,
  patch: RailsItemPatch
): Promise<RailsItem> {
  const { context, itemRef, itemRecord } = await getAuthorizedRailsItem(decodedToken, itemId);
  const nowIso = new Date().toISOString();
  const nextRecord: RailsItemRecord = {
    ...itemRecord,
    updatedAtIso: nowIso
  };
  const update: Record<string, unknown> = {
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: nowIso
  };
  const auditComments: RailsComment[] = [];
  const standardizationAuditMessages: string[] = [];

  if (patch.title !== undefined) {
    nextRecord.title = normalizeText(patch.title, itemRecord.title || 'Untitled RAILS loop', 180);
    update.title = nextRecord.title;
  }

  if (patch.problem !== undefined) {
    nextRecord.problem = normalizeText(patch.problem, itemRecord.problem || '', 600);
    update.problem = nextRecord.problem;
  }

  if (patch.priority) {
    nextRecord.priority = patch.priority;
    update.priority = patch.priority;
  }

  if (patch.category) {
    nextRecord.category = patch.category;
    update.category = patch.category;
  }

  if (patch.dueDate) {
    nextRecord.dueDate = normalizeDate(patch.dueDate, itemRecord.dueDate || getDefaultDueDate());
    update.dueDate = nextRecord.dueDate;
  }

  if (patch.ownerUid) {
    const ownerUid = safeUserId(patch.ownerUid);
    const usersByUid = await getRailsUserSummariesByUid(context, [ownerUid]);
    if (!usersByUid.has(ownerUid)) {
      throw validationError('Select an active company user as the owner.');
    }
    nextRecord.ownerUid = ownerUid;
    update.ownerUid = ownerUid;
  }

  if (patch.approverUid !== undefined) {
    const approverUid = patch.approverUid ? safeUserId(patch.approverUid) : null;
    if (approverUid) {
      const usersByUid = await getRailsUserSummariesByUid(context, [approverUid]);
      if (!usersByUid.has(approverUid)) {
        throw validationError('Select an active company user as the approver.');
      }
    }
    nextRecord.approverUid = approverUid;
    update.approverUid = approverUid;
  }

  if (nextRecord.approverUid && isRailsHighRisk(nextRecord)) {
    await assertRailsApproverEligible(context, nextRecord);
  }

  if (patch.status && RAILS_STATUSES.has(patch.status)) {
    if (patch.status === 'Cancelled') {
      nextRecord.cancelReason = normalizeLifecycleReason(patch.cancelReason, 'cancel');
    }

    if (patch.status === 'Archived') {
      nextRecord.archiveReason = normalizeLifecycleReason(patch.archiveReason, 'archive');
    }

    if (patch.status === 'Reopened') {
      nextRecord.reopenReason = normalizeLifecycleReason(patch.reopenReason, 'reopen');
    }

    if (patch.status === 'Approved') {
      await assertRailsApproverEligible(context, nextRecord);
    }

    validateRailsStatusTransition(itemRecord, nextRecord, patch.status);
    const comment = buildRailsComment(context.uid, `Status changed to ${patch.status}.`, nowIso);
    nextRecord.status = patch.status;
    update.status = patch.status;
    auditComments.push(comment);

    if (patch.status === 'Cancelled') {
      nextRecord.cancelledAtIso = nowIso;
      nextRecord.cancelledByUid = context.uid;
      update.cancelReason = nextRecord.cancelReason;
      update.cancelledAtIso = nowIso;
      update.cancelledByUid = context.uid;
    }

    if (patch.status === 'Archived') {
      nextRecord.archivedAtIso = nowIso;
      nextRecord.archivedByUid = context.uid;
      update.archiveReason = nextRecord.archiveReason;
      update.archivedAtIso = nowIso;
      update.archivedByUid = context.uid;
    }

    if (patch.status === 'Reopened') {
      const reopenComment = buildRailsComment(context.uid, `Reopened loop: ${nextRecord.reopenReason}.`, nowIso);
      auditComments.push(reopenComment);
      nextRecord.reopenedAtIso = nowIso;
      nextRecord.reopenedByUid = context.uid;
      nextRecord.standardizationStatus = 'In Progress';
      nextRecord.standardizationVerifiedAtIso = null;
      nextRecord.standardizationVerifiedByUid = null;
      update.reopenReason = nextRecord.reopenReason;
      update.reopenedAtIso = nowIso;
      update.reopenedByUid = context.uid;
      update.standardizationStatus = 'In Progress';
      update.standardizationVerifiedAtIso = null;
      update.standardizationVerifiedByUid = null;
    }
  }

  if (typeof patch.linkedRca === 'string') {
    nextRecord.linkedRca = normalizeText(patch.linkedRca, 'RCA triage requested', 160);
    nextRecord.linkedRcaDecision = buildRailsRcaDecision(nextRecord.linkedRca, context.uid, nowIso, patch.linkedRcaDecisionReason);
    update.linkedRca = nextRecord.linkedRca;
    update.linkedRcaDecision = nextRecord.linkedRcaDecision;
    auditComments.push(buildRailsComment(context.uid, `Updated RCA decision: ${nextRecord.linkedRca}.`, nowIso));
  }

  if (patch.linkedRcaId !== undefined) {
    const linkedRcaId = patch.linkedRcaId ? safeDocumentId(patch.linkedRcaId) : null;
    if (linkedRcaId) {
      const rca = await getAccessibleRcaCandidate(context, linkedRcaId);
      nextRecord.linkedRcaId = rca.id;
      nextRecord.linkedRca = `${rca.displayId}: ${rca.title}`;
      nextRecord.linkedRcaDecision = buildRailsRcaDecision(nextRecord.linkedRca, context.uid, nowIso, patch.linkedRcaDecisionReason, 'Linked');
      nextRecord.rcaTriageRequest = null;
      update.linkedRcaId = rca.id;
      update.linkedRca = nextRecord.linkedRca;
      update.linkedRcaDecision = nextRecord.linkedRcaDecision;
      update.rcaTriageRequest = null;
      auditComments.push(buildRailsComment(context.uid, `Linked RCA project: ${nextRecord.linkedRca}.`, nowIso));
    } else {
      nextRecord.linkedRcaId = null;
      nextRecord.linkedRca = 'Not linked';
      nextRecord.linkedRcaDecision = buildRailsRcaDecision(nextRecord.linkedRca, context.uid, nowIso, patch.linkedRcaDecisionReason, 'Not Linked');
      nextRecord.rcaTriageRequest = null;
      update.linkedRcaId = null;
      update.linkedRca = nextRecord.linkedRca;
      update.linkedRcaDecision = nextRecord.linkedRcaDecision;
      update.rcaTriageRequest = null;
      auditComments.push(buildRailsComment(context.uid, 'Removed RCA link.', nowIso));
    }
  }

  if (patch.linkedLswSourceId !== undefined || patch.linkedLswSourceType !== undefined) {
    if (patch.linkedLswSourceId && patch.linkedLswSourceType) {
      const linkedLswSource = await getAccessibleLswSource(context, patch.linkedLswSourceType, patch.linkedLswSourceId);
      nextRecord.linkedLswSource = linkedLswSource;
      nextRecord.linkedLsw = getRailsLswDisplay(linkedLswSource);
      nextRecord.source = 'LSW';
      update.linkedLswSource = linkedLswSource;
      update.linkedLsw = nextRecord.linkedLsw;
      update.source = nextRecord.source;
      auditComments.push(buildRailsComment(context.uid, `Linked LSW source: ${nextRecord.linkedLsw}.`, nowIso));
    } else {
      nextRecord.linkedLswSource = null;
      nextRecord.linkedLsw = 'Not linked';
      update.linkedLswSource = null;
      update.linkedLsw = nextRecord.linkedLsw;
      auditComments.push(buildRailsComment(context.uid, 'Removed linked LSW source.', nowIso));
    }
  }

  if (patch.source !== undefined) {
    nextRecord.source = normalizeText(patch.source, itemRecord.source || 'Manual intake', 80);
    update.source = nextRecord.source;
  }

  if (patch.standardization !== undefined) {
    nextRecord.standardization = normalizeText(patch.standardization, itemRecord.standardization || 'Define during triage.', 600);
    update.standardization = nextRecord.standardization;
    if (nextRecord.standardization !== itemRecord.standardization) {
      standardizationAuditMessages.push('target');
    }
  }

  if (patch.standardizationType !== undefined) {
    nextRecord.standardizationType = patch.standardizationType || null;
    update.standardizationType = nextRecord.standardizationType;
    if (nextRecord.standardizationType !== (itemRecord.standardizationType || null)) {
      standardizationAuditMessages.push('type');
    }
  }

  if (patch.standardizationOwnerUid !== undefined) {
    const standardizationOwnerUid = patch.standardizationOwnerUid ? safeUserId(patch.standardizationOwnerUid) : null;
    if (standardizationOwnerUid) {
      const usersByUid = await getRailsUserSummariesByUid(context, [standardizationOwnerUid]);
      if (!usersByUid.has(standardizationOwnerUid)) {
        throw validationError('Select an active company user as the standardization owner.');
      }
    }
    nextRecord.standardizationOwnerUid = standardizationOwnerUid;
    update.standardizationOwnerUid = standardizationOwnerUid;
    if (nextRecord.standardizationOwnerUid !== (itemRecord.standardizationOwnerUid || null)) {
      standardizationAuditMessages.push('owner');
    }
  }

  if (patch.standardizationDueDate) {
    nextRecord.standardizationDueDate = normalizeDate(patch.standardizationDueDate, itemRecord.standardizationDueDate || getDefaultDueDate());
    update.standardizationDueDate = nextRecord.standardizationDueDate;
    if (nextRecord.standardizationDueDate !== itemRecord.standardizationDueDate) {
      standardizationAuditMessages.push('due date');
    }
  }

  if (patch.standardizationStatus) {
    nextRecord.standardizationStatus = patch.standardizationStatus;
    if (patch.standardizationStatus === 'Verified') {
      const blockers = getStandardizationVerificationBlockers(nextRecord);
      if (blockers.length) {
        throw validationError(`Standardization verification blocked: ${blockers.join(' ')}`);
      }
      nextRecord.standardizationVerifiedAtIso = nowIso;
      nextRecord.standardizationVerifiedByUid = context.uid;
      update.standardizationVerifiedAtIso = nowIso;
      update.standardizationVerifiedByUid = context.uid;
    } else {
      nextRecord.standardizationVerifiedAtIso = null;
      nextRecord.standardizationVerifiedByUid = null;
      update.standardizationVerifiedAtIso = null;
      update.standardizationVerifiedByUid = null;
    }
    update.standardizationStatus = nextRecord.standardizationStatus;
    if (nextRecord.standardizationStatus !== (itemRecord.standardizationStatus || 'Not Started')) {
      standardizationAuditMessages.push('status');
    }
  }

  if (patch.standardizationVerification !== undefined) {
    nextRecord.standardizationVerification = normalizeText(patch.standardizationVerification, '', 600);
    update.standardizationVerification = nextRecord.standardizationVerification;
    if (nextRecord.standardizationVerification !== (itemRecord.standardizationVerification || '')) {
      standardizationAuditMessages.push('verification method');
    }
  }

  if (patch.verification !== undefined) {
    nextRecord.verification = normalizeText(patch.verification, itemRecord.verification || 'Supervisor review before closure', 360);
    update.verification = nextRecord.verification;
  }

  const changedAfterVerified = standardizationAuditMessages.some((message) => message !== 'status');
  if ((itemRecord.standardizationStatus || 'Not Started') === 'Verified' && changedAfterVerified && patch.standardizationStatus !== 'Verified') {
    nextRecord.standardizationStatus = 'In Progress';
    nextRecord.standardizationVerifiedAtIso = null;
    nextRecord.standardizationVerifiedByUid = null;
    update.standardizationStatus = 'In Progress';
    update.standardizationVerifiedAtIso = null;
    update.standardizationVerifiedByUid = null;
    standardizationAuditMessages.push('verification reset');
  }

  if (standardizationAuditMessages.length) {
    auditComments.push(buildRailsComment(
      context.uid,
      `Standardization plan updated: ${standardizationAuditMessages.join(', ')}.`,
      nowIso
    ));
  }

  if (auditComments.length) {
    update.comments = fieldValue.arrayUnion(...auditComments);
    nextRecord.comments = [
      ...(Array.isArray(itemRecord.comments) ? itemRecord.comments : []),
      ...auditComments
    ];
  }

  await itemRef.set(update, { merge: true });
  const auditChange = buildRailsItemAuditChange(itemRecord, nextRecord, patch);

  if (Object.keys(auditChange.after).length) {
    await writeRailsAuditEvent({
      after: auditChange.after,
      before: auditChange.before,
      context,
      itemId: itemRef.id,
      itemRef,
      metadata: {
        changedFields: Object.keys(auditChange.after)
      },
      reason: patch.archiveReason || patch.cancelReason || patch.reopenReason || null,
      summary: buildRailsItemUpdateSummary(itemRecord, nextRecord, patch),
      type: getRailsItemAuditEventType(patch)
    });
  }
  await queueRailsWorkflowNotifications(context, itemRef.id, itemRecord, nextRecord, patch);

  const usersByUid = await getRailsUserSummariesByUid(context, [
    nextRecord.ownerUid || '',
    nextRecord.approverUid || '',
    nextRecord.standardizationOwnerUid || '',
    nextRecord.standardizationVerifiedByUid || '',
    nextRecord.reopenedByUid || '',
    ...(Array.isArray(nextRecord.contributorUids) ? nextRecord.contributorUids : []),
    ...(Array.isArray(nextRecord.actions) ? nextRecord.actions.map((action) => action.ownerUid || '') : [])
  ]);

  return mapRailsItem(itemRef.id, nextRecord, context, usersByUid);
}

export async function bulkUpdateRailsItems(
  decodedToken: DecodedIdToken,
  input: RailsBulkUpdateInput
): Promise<RailsBulkUpdateResult> {
  const context = await getAuthorizedRailsContext(decodedToken);
  const itemIds = Array.from(new Set(input.itemIds.map((itemId) => safeDocumentId(itemId)))).slice(0, 50);

  if (!itemIds.length) {
    throw validationError('Select at least one RAILS loop for bulk update.');
  }

  const patch = input.patch || {};
  const hasPatch = Object.values(patch).some((value) => value !== undefined);
  const collaboratorUid = input.collaboratorUid ? safeUserId(input.collaboratorUid) : '';

  if (!hasPatch && !collaboratorUid) {
    throw validationError('Choose a bulk update before applying changes.');
  }

  const results: RailsBulkUpdateResult['results'] = [];

  for (const itemId of itemIds) {
    try {
      let item = hasPatch
        ? await updateRailsItem(decodedToken, itemId, patch)
        : null;

      if (collaboratorUid) {
        item = await addRailsCollaborator(decodedToken, itemId, collaboratorUid);
      }

      if (!item) {
        throw validationError('Choose a bulk update before applying changes.');
      }

      results.push({ item, itemId, status: 'updated' });
    } catch (error) {
      results.push({
        error: error instanceof Error ? error.message : 'This loop could not be updated.',
        itemId,
        status: 'failed'
      });
    }
  }

  const succeeded = results.filter((result) => result.status === 'updated').length;
  const failed = results.length - succeeded;

  await writeRailsTenantAuditEvent({
    context,
    metadata: {
      failed,
      itemIds,
      collaboratorUid: collaboratorUid || null,
      patch: stripUndefinedAuditValues(patch),
      succeeded
    },
    summary: `Bulk updated ${succeeded} RAILS loop${succeeded === 1 ? '' : 's'} with ${failed} failure${failed === 1 ? '' : 's'}.`,
    type: 'RAILS_BULK_ACTION_COMPLETED'
  });
  await queueRailsNotification({
    context,
    message: `Bulk RAILS update completed with ${succeeded} succeeded and ${failed} failed.`,
    metadata: { failed, itemIds, succeeded },
    recipientUids: [context.uid],
    type: 'RAILS_BULK_ACTION_COMPLETED'
  });

  return { failed, results, succeeded };
}

export async function addRailsCollaborator(
  decodedToken: DecodedIdToken,
  itemId: string,
  userId: string
): Promise<RailsItem> {
  const { context, itemRef, itemRecord } = await getAuthorizedRailsItem(decodedToken, itemId);
  const collaboratorUid = safeUserId(userId);
  const usersByUid = await getRailsUserSummariesByUid(context, [collaboratorUid]);

  if (!usersByUid.has(collaboratorUid)) {
    throw validationError('Select an active company user as a collaborator.');
  }

  const contributorUids = [...new Set([...(itemRecord.contributorUids || []), collaboratorUid])]
    .filter((uid) => uid !== itemRecord.ownerUid);
  const nowIso = new Date().toISOString();
  const comment = buildRailsComment(context.uid, `Added ${usersByUid.get(collaboratorUid)?.displayName || 'a collaborator'} to the loop.`, nowIso);
  const nextRecord = {
    ...itemRecord,
    comments: [...(itemRecord.comments || []), comment],
    contributorUids,
    updatedAtIso: nowIso
  };

  await itemRef.set({
    comments: fieldValue.arrayUnion(comment),
    contributorUids,
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: nowIso
  }, { merge: true });
  await writeRailsAuditEvent({
    after: { contributorUids },
    before: { contributorUids: itemRecord.contributorUids || [] },
    context,
    itemId: itemRef.id,
    itemRef,
    metadata: { collaboratorUid },
    summary: `Added collaborator ${usersByUid.get(collaboratorUid)?.displayName || collaboratorUid}.`,
    type: 'RAILS_COLLABORATOR_ADDED'
  });

  const allUsersByUid = await getRailsUserSummariesByUid(context, [
    nextRecord.ownerUid || '',
    nextRecord.approverUid || '',
    ...contributorUids,
    ...(nextRecord.actions || []).map((action) => action.ownerUid || '')
  ]);

  return mapRailsItem(itemRef.id, nextRecord, context, allUsersByUid);
}

export async function removeRailsCollaborator(
  decodedToken: DecodedIdToken,
  itemId: string,
  userId: string
): Promise<RailsItem> {
  const { context, itemRef, itemRecord } = await getAuthorizedRailsItem(decodedToken, itemId);
  const collaboratorUid = safeUserId(userId);
  const removedUsersByUid = await getRailsUserSummariesByUid(context, [collaboratorUid]);
  const removedCollaboratorName = removedUsersByUid.get(collaboratorUid)?.displayName || 'a collaborator';
  const contributorUids = (itemRecord.contributorUids || []).filter((uid) => uid !== collaboratorUid);
  const nowIso = new Date().toISOString();
  const comment = buildRailsComment(context.uid, `Removed ${removedCollaboratorName} from the loop.`, nowIso);
  const nextRecord = {
    ...itemRecord,
    comments: [...(itemRecord.comments || []), comment],
    contributorUids,
    updatedAtIso: nowIso
  };

  await itemRef.set({
    comments: fieldValue.arrayUnion(comment),
    contributorUids,
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: nowIso
  }, { merge: true });
  await writeRailsAuditEvent({
    after: { contributorUids },
    before: { contributorUids: itemRecord.contributorUids || [] },
    context,
    itemId: itemRef.id,
    itemRef,
    metadata: { collaboratorDisplayName: removedCollaboratorName, collaboratorUid },
    summary: `Removed collaborator ${removedCollaboratorName}.`,
    type: 'RAILS_COLLABORATOR_REMOVED'
  });

  const usersByUid = await getRailsUserSummariesByUid(context, [
    nextRecord.ownerUid || '',
    nextRecord.approverUid || '',
    ...contributorUids,
    ...(nextRecord.actions || []).map((action) => action.ownerUid || '')
  ]);

  return mapRailsItem(itemRef.id, nextRecord, context, usersByUid);
}

export async function addRailsAction(
  decodedToken: DecodedIdToken,
  itemId: string,
  input: RailsActionInput = {}
): Promise<RailsItem> {
  const { context, itemRef, itemRecord } = await getAuthorizedRailsItem(decodedToken, itemId);
  const ownerUid = safeUserId(input.ownerUid || itemRecord.ownerUid || context.uid);
  const usersByUid = await getRailsUserSummariesByUid(context, [ownerUid]);
  if (!usersByUid.has(ownerUid)) {
    throw validationError('Select an active company user for this action.');
  }

  const nowIso = new Date().toISOString();
  const action: RailsActionRecord = {
    actionId: `act_${randomUUID().replace(/-/g, '')}`,
    completedAtCorrectionReason: normalizeText(input.completedAtCorrectionReason, '', 500),
    completedAtIso: null,
    completedByExternalName: normalizeText(input.completedByExternalName, '', 120),
    completedByUid: input.completedByUid ? safeUserId(input.completedByUid) : null,
    containmentNote: normalizeText(input.containmentNote, '', 900),
    dueDate: normalizeDate(input.dueDate, itemRecord.dueDate || getDefaultDueDate()),
    effectivenessCriteria: normalizeText(input.effectivenessCriteria, '', 900),
    effectivenessResult: normalizeText(input.effectivenessResult, '', 900),
    evidenceIds: normalizeActionEvidenceIds(input.evidenceIds, itemRecord.evidence || [], itemRecord.ownerUid || ''),
    implementationNote: normalizeText(input.implementationNote, '', 900),
    ownerUid,
    progressPercent: clampNumber(input.progressPercent, 0, 100, 0),
    riskControlled: normalizeText(input.riskControlled, '', 600),
    startedAtCorrectionReason: normalizeText(input.startedAtCorrectionReason, '', 500),
    startedAtIso: normalizeIsoDateTime(input.startedAtIso, null),
    startedByUid: input.startedByUid ? safeUserId(input.startedByUid) : null,
    standardizationNote: normalizeText(input.standardizationNote, '', 900),
    status: 'Open',
    title: normalizeText(input.title, 'New action', 180),
    verificationNote: normalizeText(input.verificationNote, '', 900),
    verifiedAtIso: null,
    verifiedByUid: input.verifiedByUid ? safeUserId(input.verifiedByUid) : null
  };
  validateActionExecutionOverrides(action, input);
  applyActionProgressRules(action, input.progressPercent);
  if (action.status === 'Done' || getActionProgressPercent(action) >= 100) {
    validateRailsActionCompletion(action, itemRecord.evidence || []);
  }
  const actions = [...(itemRecord.actions || []), action];
  const comment = buildRailsComment(context.uid, `Added action: ${action.title}.`, nowIso);
  const nextRecord = updateRecordProgress({
    ...itemRecord,
    actions,
    comments: [...(itemRecord.comments || []), comment],
    updatedAtIso: nowIso
  });

  await itemRef.set({
    actions,
    actionsComplete: nextRecord.actionsComplete,
    actionsProgressPercent: nextRecord.actionsProgressPercent,
    actionsTotal: nextRecord.actionsTotal,
    comments: fieldValue.arrayUnion(comment),
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: nowIso
  }, { merge: true });
  await writeRailsAuditEvent({
    after: {
      action,
      actionsComplete: nextRecord.actionsComplete,
      actionsProgressPercent: nextRecord.actionsProgressPercent,
      actionsTotal: nextRecord.actionsTotal
    },
    before: {
      actionsComplete: itemRecord.actionsComplete || 0,
      actionsProgressPercent: itemRecord.actionsProgressPercent || 0,
      actionsTotal: itemRecord.actionsTotal || 0
    },
    context,
    itemId: itemRef.id,
    itemRef,
    metadata: { actionId: action.actionId },
    summary: `Added action: ${action.title}.`,
    type: 'RAILS_ACTION_ADDED'
  });

  const allUsersByUid = await getRailsUserSummariesByUid(context, [
    nextRecord.ownerUid || '',
    nextRecord.approverUid || '',
    nextRecord.standardizationOwnerUid || '',
    nextRecord.archivedByUid || '',
    nextRecord.cancelledByUid || '',
    ...(nextRecord.contributorUids || []),
    ...actions.map((entry) => entry.ownerUid || ''),
    ...actions.map((entry) => entry.startedByUid || ''),
    ...actions.map((entry) => entry.completedByUid || ''),
    ...actions.map((entry) => entry.verifiedByUid || '')
  ]);

  return mapRailsItem(itemRef.id, nextRecord, context, allUsersByUid);
}

export async function updateRailsAction(
  decodedToken: DecodedIdToken,
  itemId: string,
  actionId: string,
  patch: RailsActionPatch
): Promise<RailsItem> {
  const { context, itemRef, itemRecord } = await getAuthorizedRailsItem(decodedToken, itemId);
  const safeActionId = safeUserId(actionId);
  const actions = [...(itemRecord.actions || [])];
  const actionIndex = actions.findIndex((action) => action.actionId === safeActionId);

  if (actionIndex < 0) {
    throw notFoundError('This RAILS action was not found.');
  }

  const currentAction = actions[actionIndex];
  const nextAction: RailsActionRecord = { ...currentAction };

  if (patch.title !== undefined) {
    nextAction.title = normalizeText(patch.title, currentAction.title, 180);
  }

  if (patch.containmentNote !== undefined) {
    nextAction.containmentNote = normalizeText(patch.containmentNote, '', 900);
  }

  if (patch.riskControlled !== undefined) {
    nextAction.riskControlled = normalizeText(patch.riskControlled, '', 600);
  }

  if (patch.implementationNote !== undefined) {
    nextAction.implementationNote = normalizeText(patch.implementationNote, '', 900);
  }

  if (patch.effectivenessCriteria !== undefined) {
    nextAction.effectivenessCriteria = normalizeText(patch.effectivenessCriteria, '', 900);
  }

  if (patch.effectivenessResult !== undefined) {
    nextAction.effectivenessResult = normalizeText(patch.effectivenessResult, '', 900);
  }

  if (patch.standardizationNote !== undefined) {
    nextAction.standardizationNote = normalizeText(patch.standardizationNote, '', 900);
  }

  if (patch.verificationNote !== undefined) {
    nextAction.verificationNote = normalizeText(patch.verificationNote, '', 900);
  }

  if (patch.evidenceIds !== undefined) {
    nextAction.evidenceIds = normalizeActionEvidenceIds(patch.evidenceIds, itemRecord.evidence || [], itemRecord.ownerUid || '');
  }

  applyActionExecutionPatch(nextAction, currentAction, patch);

  if (patch.verifiedByUid !== undefined) {
    nextAction.verifiedByUid = patch.verifiedByUid ? safeUserId(patch.verifiedByUid) : null;
    nextAction.verifiedAtIso = nextAction.verifiedByUid ? new Date().toISOString() : null;
  }

  if (patch.dueDate) {
    nextAction.dueDate = normalizeDate(patch.dueDate, currentAction.dueDate || getDefaultDueDate());
  }

  if (patch.ownerUid) {
    const ownerUid = safeUserId(patch.ownerUid);
    const usersByUid = await getRailsUserSummariesByUid(context, [ownerUid]);
    if (!usersByUid.has(ownerUid)) {
      throw validationError('Select an active company user for this action.');
    }
    nextAction.ownerUid = ownerUid;
  }

  if (patch.status && RAILS_ACTION_STATUSES.has(patch.status)) {
    nextAction.status = patch.status;
    if (patch.status === 'Done') {
      validateRailsActionCompletion(nextAction, itemRecord.evidence || []);
      nextAction.progressPercent = 100;
      nextAction.completedAtIso = currentAction.completedAtIso || new Date().toISOString();
      nextAction.completedByUid = nextAction.completedByUid || context.uid;
      nextAction.completedByExternalName = '';
      nextAction.verifiedAtIso = nextAction.verifiedAtIso || new Date().toISOString();
      nextAction.verifiedByUid = nextAction.verifiedByUid || context.uid;
    } else if (patch.status === 'Open' || patch.status === 'Blocked') {
      nextAction.progressPercent = 0;
      nextAction.completedAtIso = null;
      nextAction.completedByUid = null;
      nextAction.completedByExternalName = '';
    } else {
      nextAction.progressPercent = clampNumber(nextAction.progressPercent, 0, 99, 0);
      nextAction.startedAtIso = nextAction.startedAtIso || new Date().toISOString();
      nextAction.startedByUid = nextAction.startedByUid || context.uid;
      nextAction.completedAtIso = null;
    }
  }

  if (patch.progressPercent !== undefined) {
    nextAction.progressPercent = clampNumber(patch.progressPercent, 0, 100, 0);
    if (nextAction.progressPercent >= 100) {
      validateRailsActionCompletion(nextAction, itemRecord.evidence || []);
    }
    applyActionProgressRules(nextAction, patch.progressPercent);
    if (nextAction.progressPercent > 0) {
      nextAction.startedAtIso = nextAction.startedAtIso || new Date().toISOString();
      nextAction.startedByUid = nextAction.startedByUid || context.uid;
    }
    if (nextAction.status === 'Done') {
      nextAction.completedAtIso = nextAction.completedAtIso || new Date().toISOString();
      nextAction.completedByUid = nextAction.completedByUid || context.uid;
      nextAction.completedByExternalName = '';
      nextAction.verifiedAtIso = nextAction.verifiedAtIso || new Date().toISOString();
      nextAction.verifiedByUid = nextAction.verifiedByUid || context.uid;
    }
  }

  actions[actionIndex] = nextAction;
  const nowIso = new Date().toISOString();
  const evidenceLinkChange = patch.evidenceIds !== undefined
    ? buildRailsActionEvidenceLinkChange(currentAction, nextAction, itemRecord.evidence || [])
    : null;
  const actionChangeSummary = evidenceLinkChange?.summary || buildRailsActionUpdateSummary(currentAction, nextAction, patch);
  const comment = buildRailsComment(context.uid, actionChangeSummary, nowIso);
  const nextRecord = applyRailsStatusAutomation(updateRecordProgress({
    ...itemRecord,
    actions,
    comments: [...(itemRecord.comments || []), comment],
    updatedAtIso: nowIso
  }), itemRecord.status);

  if (nextRecord.status && nextRecord.status !== itemRecord.status && nextRecord.status !== 'Deleted') {
    validateRailsStatusTransition(itemRecord, nextRecord, nextRecord.status);
  }

  await itemRef.set({
    actions,
    actionsComplete: nextRecord.actionsComplete,
    actionsProgressPercent: nextRecord.actionsProgressPercent,
    actionsTotal: nextRecord.actionsTotal,
    comments: fieldValue.arrayUnion(comment),
    status: nextRecord.status,
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: nowIso
  }, { merge: true });
  await writeRailsAuditEvent({
    after: {
      action: nextAction,
      actionsComplete: nextRecord.actionsComplete,
      actionsProgressPercent: nextRecord.actionsProgressPercent,
      status: nextRecord.status || itemRecord.status || 'New'
    },
    before: {
      action: currentAction,
      actionsComplete: itemRecord.actionsComplete || 0,
      actionsProgressPercent: itemRecord.actionsProgressPercent || 0,
      status: itemRecord.status || 'New'
    },
    context,
    itemId: itemRef.id,
    itemRef,
    metadata: {
      actionId: nextAction.actionId,
      automatedStatusChange: nextRecord.status !== itemRecord.status,
      evidenceLinkedIds: evidenceLinkChange?.linked.map((entry) => entry.evidenceId) || [],
      evidenceUnlinkedIds: evidenceLinkChange?.unlinked.map((entry) => entry.evidenceId) || []
    },
    summary: actionChangeSummary,
    type: evidenceLinkChange?.eventType || 'RAILS_ACTION_UPDATED'
  });

  const usersByUid = await getRailsUserSummariesByUid(context, [
    nextRecord.ownerUid || '',
    nextRecord.approverUid || '',
    ...(nextRecord.contributorUids || []),
    ...actions.map((action) => action.ownerUid || ''),
    ...actions.map((action) => action.startedByUid || ''),
    ...actions.map((action) => action.completedByUid || ''),
    ...actions.map((action) => action.verifiedByUid || '')
  ]);

  return mapRailsItem(itemRef.id, nextRecord, context, usersByUid);
}

export async function reorderRailsAction(
  decodedToken: DecodedIdToken,
  itemId: string,
  actionId: string,
  direction: 'up' | 'down'
): Promise<RailsItem> {
  const { context, itemRef, itemRecord } = await getAuthorizedRailsItem(decodedToken, itemId);
  const safeActionId = safeUserId(actionId);
  const actions = [...(itemRecord.actions || [])];
  const actionIndex = actions.findIndex((action) => action.actionId === safeActionId);

  if (actionIndex < 0) {
    throw notFoundError('This RAILS action was not found.');
  }

  const targetIndex = direction === 'up' ? actionIndex - 1 : actionIndex + 1;
  if (targetIndex < 0 || targetIndex >= actions.length) {
    throw validationError(`This action cannot move ${direction}.`);
  }

  const [movedAction] = actions.splice(actionIndex, 1);
  actions.splice(targetIndex, 0, movedAction);
  const nowIso = new Date().toISOString();
  const summary = `Moved action "${movedAction.title}" ${direction}.`;
  const comment = buildRailsComment(context.uid, summary, nowIso);
  const nextRecord = updateRecordProgress({
    ...itemRecord,
    actions,
    comments: [...(itemRecord.comments || []), comment],
    updatedAtIso: nowIso
  });

  await itemRef.set({
    actions,
    actionsComplete: nextRecord.actionsComplete,
    actionsProgressPercent: nextRecord.actionsProgressPercent,
    actionsTotal: nextRecord.actionsTotal,
    comments: fieldValue.arrayUnion(comment),
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: nowIso
  }, { merge: true });
  await writeRailsAuditEvent({
    after: {
      actionId: movedAction.actionId,
      newIndex: targetIndex,
      order: actions.map((action) => action.actionId)
    },
    before: {
      actionId: movedAction.actionId,
      oldIndex: actionIndex,
      order: (itemRecord.actions || []).map((action) => action.actionId)
    },
    context,
    itemId: itemRef.id,
    itemRef,
    metadata: {
      actionId: movedAction.actionId,
      direction,
      movedAtIso: nowIso,
      newIndex: targetIndex,
      oldIndex: actionIndex
    },
    summary,
    type: 'RAILS_ACTION_REORDERED'
  });

  const usersByUid = await getRailsUserSummariesByUid(context, [
    nextRecord.ownerUid || '',
    nextRecord.approverUid || '',
    ...(nextRecord.contributorUids || []),
    ...getRailsActionUserIds(actions)
  ]);

  return mapRailsItem(itemRef.id, nextRecord, context, usersByUid);
}

export async function deleteRailsAction(
  decodedToken: DecodedIdToken,
  itemId: string,
  actionId: string
): Promise<RailsItem> {
  const { context, itemRef, itemRecord } = await getAuthorizedRailsItem(decodedToken, itemId);
  const safeActionId = safeUserId(actionId);
  const actions = [...(itemRecord.actions || [])];
  const actionIndex = actions.findIndex((action) => action.actionId === safeActionId);

  if (actionIndex < 0) {
    throw notFoundError('This RAILS action was not found.');
  }

  const [deletedAction] = actions.splice(actionIndex, 1);
  if (!actions.length) {
    throw validationError('A RAILS loop must keep at least one action step.');
  }

  const linkedEvidenceIds = new Set(normalizeMappedActionEvidenceIds(deletedAction.evidenceIds));
  const existingEvidence = Array.isArray(itemRecord.evidence) ? itemRecord.evidence : [];
  const unlinkedEvidence = existingEvidence.filter((entry) => linkedEvidenceIds.has(safeUserId(entry.evidenceId)));
  const cleanedActions = actions;
  const nowIso = new Date().toISOString();
  const summary = `Deleted action "${deletedAction.title}" and unlinked ${unlinkedEvidence.length} evidence reference${unlinkedEvidence.length === 1 ? '' : 's'}.`;
  const comment = buildRailsComment(context.uid, summary, nowIso);
  const nextRecord = updateRecordProgress({
    ...itemRecord,
    actions: cleanedActions,
    comments: [...(itemRecord.comments || []), comment],
    updatedAtIso: nowIso
  });

  await itemRef.set({
    actions: cleanedActions,
    actionsComplete: nextRecord.actionsComplete,
    actionsProgressPercent: nextRecord.actionsProgressPercent,
    actionsTotal: nextRecord.actionsTotal,
    comments: fieldValue.arrayUnion(comment),
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: nowIso
  }, { merge: true });
  await writeRailsAuditEvent({
    after: {
      actionsComplete: nextRecord.actionsComplete,
      actionsProgressPercent: nextRecord.actionsProgressPercent,
      actionsTotal: nextRecord.actionsTotal,
      deletedAtIso: nowIso,
      deletedByUid: context.uid,
      evidenceUnlinked: unlinkedEvidence.map((entry) => ({
        evidenceId: entry.evidenceId,
        fileName: entry.fileName || null,
        label: entry.label,
        status: entry.status
      }))
    },
    before: {
      action: deletedAction,
      actionIndex,
      evidenceLinks: unlinkedEvidence,
      order: (itemRecord.actions || []).map((action) => action.actionId)
    },
    context,
    itemId: itemRef.id,
    itemRef,
    metadata: {
      actionId: deletedAction.actionId,
      deletedAtIso: nowIso,
      deletedByDisplayName: getDisplayName(context.user),
      deletedByUid: context.uid,
      unlinkedEvidenceIds: unlinkedEvidence.map((entry) => entry.evidenceId)
    },
    summary,
    type: 'RAILS_ACTION_DELETED'
  });

  const usersByUid = await getRailsUserSummariesByUid(context, [
    nextRecord.ownerUid || '',
    nextRecord.approverUid || '',
    nextRecord.standardizationOwnerUid || '',
    ...(nextRecord.contributorUids || []),
    ...getRailsActionUserIds(cleanedActions)
  ]);

  return mapRailsItem(itemRef.id, nextRecord, context, usersByUid);
}

export async function addRailsEvidence(
  decodedToken: DecodedIdToken,
  itemId: string,
  input: RailsEvidenceInput = {}
): Promise<RailsItem> {
  const { context, itemRef, itemRecord } = await getAuthorizedRailsItem(decodedToken, itemId);
  const nowIso = new Date().toISOString();
  const existingEvidence = Array.isArray(itemRecord.evidence) ? itemRecord.evidence : [];
  const targetEvidenceId = input.evidenceId ? safeDocumentId(input.evidenceId) : '';
  const targetEvidenceIndex = targetEvidenceId
    ? existingEvidence.findIndex((entry) => entry.evidenceId === targetEvidenceId)
    : -1;

  if (targetEvidenceId && targetEvidenceIndex < 0) {
    throw validationError('Selected evidence requirement was not found.');
  }

  const currentEvidence = targetEvidenceIndex >= 0 ? existingEvidence[targetEvidenceIndex] : null;
  const evidenceId = currentEvidence?.evidenceId || `ev_${randomUUID().replace(/-/g, '')}`;
  let fileUrl: string | null = currentEvidence?.fileUrl || null;
  let fileName: string | null = currentEvidence?.fileName || null;
  let contentType: string | null = currentEvidence?.contentType || null;
  let fileSizeBytes: number | null = typeof currentEvidence?.fileSizeBytes === 'number' ? currentEvidence.fileSizeBytes : null;
  let storagePath: string | null = null;
  let sourceEvidenceId = currentEvidence?.sourceEvidenceId || null;

  if (input.dataUrl) {
    const parsed = parseEvidenceDataUrl(input.dataUrl);
    contentType = parsed.contentType;
    fileSizeBytes = parsed.payload.length;
    fileName = sanitizeFileName(input.fileName || 'rails-evidence');
    storagePath = getEvidenceStoragePath(context.tenantId, itemRef.id, evidenceId, fileName);
    await storageBucket.file(storagePath).save(parsed.payload, {
      contentType: parsed.contentType,
      metadata: {
        cacheControl: 'private, max-age=3600',
        metadata: {
          evidenceId,
          itemId: itemRef.id,
          tenantId: context.tenantId,
          uploadedAtIso: nowIso,
          uploadedByUid: context.uid
        }
      },
      resumable: false
    });
    fileUrl = `/api/rails/items/${encodeURIComponent(itemRef.id)}/evidence/${encodeURIComponent(evidenceId)}`;
    sourceEvidenceId = null;
  } else if (input.sourceEvidenceId !== undefined) {
    const normalizedSourceEvidenceId = input.sourceEvidenceId ? safeDocumentId(input.sourceEvidenceId) : '';

    if (!currentEvidence || currentEvidence.status !== 'Required') {
      throw validationError('Evidence Library linking is only available for required verification evidence.');
    }

    if (!normalizedSourceEvidenceId) {
      sourceEvidenceId = null;
    } else {
      const sourceEvidence = existingEvidence.find((entry) => safeDocumentId(entry.evidenceId) === normalizedSourceEvidenceId);

      if (!sourceEvidence || sourceEvidence.status !== 'Attached' || !sourceEvidence.fileUrl || !sourceEvidence.fileName) {
        throw validationError('Select an attached Evidence Library item.');
      }

      if ((sourceEvidence.visibility || 'public') === 'private' && sourceEvidence.uploadedByUid !== itemRecord.ownerUid) {
        throw validationError('This private evidence is not visible for this RAILS loop.');
      }

      sourceEvidenceId = sourceEvidence.evidenceId;
    }
  }

  const evidence: RailsEvidence = {
    contentType,
    evidenceId,
    fileSizeBytes,
    fileName,
    fileUrl,
    label: normalizeText(input.label, currentEvidence?.label || fileName || 'Evidence item', 140),
    note: input.note !== undefined ? normalizeText(input.note, '', 360) : currentEvidence?.note || '',
    purpose: input.purpose || currentEvidence?.purpose || 'general',
    sourceEvidenceId,
    status: input.dataUrl ? 'Attached' : input.status || currentEvidence?.status || 'Attached',
    uploadedAtIso: input.dataUrl || !currentEvidence ? nowIso : currentEvidence.uploadedAtIso || nowIso,
    uploadedByUid: input.dataUrl || !currentEvidence ? context.uid : currentEvidence.uploadedByUid || context.uid,
    visibility: input.visibility || currentEvidence?.visibility || 'public'
  };
  const nextEvidence = targetEvidenceIndex >= 0
    ? existingEvidence.map((entry, index) => index === targetEvidenceIndex ? evidence : entry)
    : [...existingEvidence, evidence];
  const existingVersions = Array.isArray(itemRecord.standardizationDocumentVersions) ? itemRecord.standardizationDocumentVersions : [];
  const standardizationVersion = evidence.purpose === 'standardization' && input.dataUrl && fileName && storagePath
    ? buildStandardizationDocumentVersion({
      contentType,
      evidenceId,
      fileName,
      itemId: itemRef.id,
      nowIso,
      storagePath,
      uploadedByUid: context.uid,
      versionNumber: existingVersions.length + 1
    })
    : null;
  const evidenceChangeSummary = buildRailsEvidenceUpdateSummary(currentEvidence, evidence);
  const comment = buildRailsComment(context.uid, evidenceChangeSummary, nowIso);
  const nextRecord = {
    ...itemRecord,
    comments: [...(itemRecord.comments || []), comment],
    evidence: nextEvidence,
    standardizationDocumentCurrentVersionId: standardizationVersion?.versionId || itemRecord.standardizationDocumentCurrentVersionId || null,
    standardizationDocumentVersions: standardizationVersion ? [...existingVersions, standardizationVersion] : existingVersions,
    updatedAtIso: nowIso
  };
  const shouldResetStandardizationVerification = evidence.purpose === 'standardization' && (itemRecord.standardizationStatus || 'Not Started') === 'Verified';

  if (shouldResetStandardizationVerification) {
    nextRecord.standardizationStatus = 'In Progress';
    nextRecord.standardizationVerifiedAtIso = null;
    nextRecord.standardizationVerifiedByUid = null;
    nextRecord.comments = [
      ...nextRecord.comments,
      buildRailsComment(context.uid, 'Standardization verification reset after document update.', nowIso)
    ];
  }

  await itemRef.set({
    comments: shouldResetStandardizationVerification ? nextRecord.comments : fieldValue.arrayUnion(comment),
    evidence: nextRecord.evidence,
    ...(standardizationVersion ? {
      standardizationDocumentCurrentVersionId: standardizationVersion.versionId,
      standardizationDocumentVersions: nextRecord.standardizationDocumentVersions
    } : {}),
    ...(shouldResetStandardizationVerification ? {
      standardizationStatus: 'In Progress',
      standardizationVerifiedAtIso: null,
      standardizationVerifiedByUid: null
    } : {}),
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: nowIso
  }, { merge: true });
  await writeRailsAuditEvent({
    after: {
      evidence,
      standardizationStatus: nextRecord.standardizationStatus || itemRecord.standardizationStatus || 'Not Started'
    },
    before: {
      evidence: currentEvidence || null,
      standardizationStatus: itemRecord.standardizationStatus || 'Not Started'
    },
    context,
    itemId: itemRef.id,
    itemRef,
    metadata: {
      evidenceId,
      changedFields: currentEvidence ? getRailsEvidenceChangedFields(currentEvidence, evidence) : ['created'],
      purpose: evidence.purpose,
      renamed: Boolean(currentEvidence && currentEvidence.label !== evidence.label),
      replacedExisting: targetEvidenceIndex >= 0,
      resetStandardizationVerification: shouldResetStandardizationVerification,
      standardizationDocumentVersionId: standardizationVersion?.versionId || null
    },
    summary: evidenceChangeSummary,
    type: targetEvidenceIndex >= 0 ? 'RAILS_EVIDENCE_UPDATED' : 'RAILS_EVIDENCE_ADDED'
  });
  await queueRailsNotification({
    context,
    itemId: itemRef.id,
    message: evidence.status === 'Required'
      ? `Evidence is required for ${nextRecord.displayId || 'this RAILS loop'}: ${evidence.label}.`
      : `Evidence was attached to ${nextRecord.displayId || 'this RAILS loop'}: ${evidence.label}.`,
    metadata: { evidenceId, purpose: evidence.purpose, status: evidence.status },
    recipientUids: [
      nextRecord.ownerUid || '',
      nextRecord.approverUid || '',
      nextRecord.standardizationOwnerUid || '',
      ...(nextRecord.contributorUids || [])
    ],
    type: evidence.status === 'Required' ? 'RAILS_EVIDENCE_REQUIRED' : 'RAILS_STANDARDIZATION_VERIFICATION_REQUESTED'
  });

  const usersByUid = await getRailsUserSummariesByUid(context, [
    nextRecord.ownerUid || '',
    nextRecord.approverUid || '',
    nextRecord.standardizationOwnerUid || '',
    ...(nextRecord.contributorUids || []),
    ...(nextRecord.actions || []).map((action) => action.ownerUid || ''),
    ...(nextRecord.standardizationDocumentVersions || []).map((version) => version.uploadedByUid || '')
  ]);

  return mapRailsItem(itemRef.id, nextRecord, context, usersByUid);
}

export async function getRailsEvidenceFile(
  decodedToken: DecodedIdToken,
  itemId: string,
  evidenceId: string
): Promise<RailsEvidenceFile> {
  const { itemRecord } = await getAuthorizedRailsItem(decodedToken, itemId);
  const safeEvidenceId = safeUserId(evidenceId);
  const evidence = (itemRecord.evidence || []).find((entry) => entry.evidenceId === safeEvidenceId);

  if (!evidence?.fileName || !evidence.fileUrl) {
    throw notFoundError('This RAILS evidence file was not found.');
  }

  const storagePath = getEvidenceStoragePath(itemRecord.tenantId || '', itemId, safeEvidenceId, evidence.fileName);
  const file = storageBucket.file(storagePath);
  const [exists] = await file.exists();

  if (!exists) {
    throw notFoundError('This RAILS evidence file was not found.');
  }

  const [payload] = await file.download();

  return {
    contentType: evidence.contentType || 'application/octet-stream',
    fileName: evidence.fileName,
    payload
  };
}

export async function deleteRailsEvidence(
  decodedToken: DecodedIdToken,
  itemId: string,
  evidenceId: string
): Promise<RailsItem> {
  const { context, itemRef, itemRecord } = await getAuthorizedRailsItem(decodedToken, itemId);
  const safeEvidenceId = safeUserId(evidenceId);
  const existingEvidence = Array.isArray(itemRecord.evidence) ? itemRecord.evidence : [];
  const targetEvidence = existingEvidence.find((entry) => entry.evidenceId === safeEvidenceId);

  if (!targetEvidence || targetEvidence.status === 'Required') {
    throw notFoundError('This RAILS evidence was not found.');
  }

  if ((targetEvidence.uploadedByUid || '') !== context.uid) {
    throw authorizationError('Only the user who uploaded this evidence can delete it.');
  }

  const nowIso = new Date().toISOString();
  const nextEvidence = existingEvidence
    .filter((entry) => entry.evidenceId !== safeEvidenceId)
    .map((entry) => entry.sourceEvidenceId === safeEvidenceId ? { ...entry, sourceEvidenceId: null } : entry);
  const actionsBefore = Array.isArray(itemRecord.actions) ? itemRecord.actions : [];
  const nextActions = actionsBefore.map((action) => ({
    ...action,
    evidenceIds: normalizeMappedActionEvidenceIds(action.evidenceIds).filter((linkedEvidenceId) => linkedEvidenceId !== safeEvidenceId)
  }));
  const nextStandardizationVersions = (itemRecord.standardizationDocumentVersions || [])
    .filter((version) => version.evidenceId !== safeEvidenceId);
  const comment = buildRailsComment(
    context.uid,
    `Deleted evidence: ${targetEvidence.label}. Linked references were unlinked.`,
    nowIso
  );

  if (targetEvidence.fileName) {
    const storagePath = getEvidenceStoragePath(itemRecord.tenantId || context.tenantId, itemRef.id, safeEvidenceId, targetEvidence.fileName);
    await storageBucket.file(storagePath).delete({ ignoreNotFound: true });
  }

  const nextRecord = {
    ...itemRecord,
    actions: nextActions,
    comments: [...(itemRecord.comments || []), comment],
    evidence: nextEvidence,
    standardizationDocumentCurrentVersionId: nextStandardizationVersions.some((version) => version.versionId === itemRecord.standardizationDocumentCurrentVersionId)
      ? itemRecord.standardizationDocumentCurrentVersionId || null
      : null,
    standardizationDocumentVersions: nextStandardizationVersions,
    updatedAtIso: nowIso
  };

  await itemRef.set({
    actions: nextActions,
    comments: fieldValue.arrayUnion(comment),
    evidence: nextEvidence,
    standardizationDocumentCurrentVersionId: nextRecord.standardizationDocumentCurrentVersionId,
    standardizationDocumentVersions: nextStandardizationVersions,
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: nowIso
  }, { merge: true });
  await writeRailsAuditEvent({
    after: {
      evidenceDeleted: true,
      linkedActionCount: actionsBefore.filter((action) => normalizeMappedActionEvidenceIds(action.evidenceIds).includes(safeEvidenceId)).length
    },
    before: { evidence: targetEvidence },
    context,
    itemId: itemRef.id,
    itemRef,
    metadata: {
      deletedByOwnerUid: context.uid,
      evidenceId: safeEvidenceId,
      fileName: targetEvidence.fileName || null,
      unlinkedActionIds: actionsBefore
        .filter((action) => normalizeMappedActionEvidenceIds(action.evidenceIds).includes(safeEvidenceId))
        .map((action) => action.actionId)
    },
    summary: `Owner deleted evidence "${targetEvidence.label}" and unlinked all references.`,
    type: 'RAILS_EVIDENCE_DELETED'
  });

  const usersByUid = await getRailsUserSummariesByUid(context, [
    nextRecord.ownerUid || '',
    nextRecord.approverUid || '',
    nextRecord.standardizationOwnerUid || '',
    ...(nextRecord.contributorUids || []),
    ...getRailsActionUserIds(nextActions),
    ...(nextRecord.standardizationDocumentVersions || []).map((version) => version.uploadedByUid || '')
  ]);

  return mapRailsItem(itemRef.id, nextRecord, context, usersByUid);
}

export async function getRailsStandardizationDocumentVersionFile(
  decodedToken: DecodedIdToken,
  itemId: string,
  versionId: string
): Promise<RailsEvidenceFile> {
  const { itemRecord } = await getAuthorizedRailsItem(decodedToken, itemId);
  const safeVersionId = safeUserId(versionId);
  const version = (itemRecord.standardizationDocumentVersions || []).find((entry) => entry.versionId === safeVersionId);

  if (!version?.storagePath || !version.fileName) {
    throw notFoundError('This standardization document version was not found.');
  }

  const file = storageBucket.file(version.storagePath);
  const [exists] = await file.exists();

  if (!exists) {
    throw notFoundError('This standardization document version was not found.');
  }

  const [payload] = await file.download();

  return {
    contentType: version.contentType || 'application/octet-stream',
    fileName: version.fileName,
    payload
  };
}

export async function listRailsItemActivity(
  decodedToken: DecodedIdToken,
  itemId: string
): Promise<RailsActivityResponse> {
  const { itemRef } = await getAuthorizedRailsItem(decodedToken, itemId, { requireManage: false });
  const snapshot = await itemRef
    .collection(RAILS_ITEM_ACTIVITY_COLLECTION)
    .get();
  const activity = snapshot.docs
    .map((doc) => mapRailsAuditActivity(doc.id, doc.data()))
    .sort((first, second) => Date.parse(second.createdAtIso) - Date.parse(first.createdAtIso))
    .slice(0, 100);

  return { activity };
}

export async function addRailsComment(
  decodedToken: DecodedIdToken,
  itemId: string,
  body: string
): Promise<RailsItem> {
  const { context, itemRef, itemRecord } = await getAuthorizedRailsItem(decodedToken, itemId);
  const nowIso = new Date().toISOString();
  const comment = buildRailsComment(context.uid, normalizeText(body, '', 800), nowIso);

  if (!comment.body) {
    throw validationError('Enter a comment before posting.');
  }

  const nextRecord = {
    ...itemRecord,
    comments: [...(itemRecord.comments || []), comment],
    updatedAtIso: nowIso
  };

  await itemRef.set({
    comments: fieldValue.arrayUnion(comment),
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: nowIso
  }, { merge: true });
  await writeRailsAuditEvent({
    after: {
      body: comment.body,
      commentId: comment.commentId,
      createdAtIso: comment.createdAtIso
    },
    context,
    itemId: itemRef.id,
    itemRef,
    metadata: {
      commentLength: comment.body.length
    },
    summary: comment.body,
    type: 'RAILS_COMMENT_ADDED'
  });

  const usersByUid = await getRailsUserSummariesByUid(context, [
    nextRecord.ownerUid || '',
    nextRecord.approverUid || '',
    ...(nextRecord.contributorUids || []),
    ...(nextRecord.actions || []).map((action) => action.ownerUid || '')
  ]);

  return mapRailsItem(itemRef.id, nextRecord, context, usersByUid);
}

export async function requestRailsRcaTriage(
  decodedToken: DecodedIdToken,
  itemId: string,
  input: RailsRcaTriageRequestInput = {}
): Promise<RailsItem> {
  const { context, itemRef, itemRecord } = await getAuthorizedRailsItem(decodedToken, itemId);
  const nowIso = new Date().toISOString();
  const assignedToUid = input.assignedToUid ? safeUserId(input.assignedToUid) : itemRecord.approverUid || itemRecord.ownerUid || context.uid;
  const dueDate = input.dueDate ? normalizeDate(input.dueDate, itemRecord.dueDate || getDefaultDueDate()) : itemRecord.dueDate || getDefaultDueDate();
  const reason = normalizeText(input.reason, itemRecord.problem || itemRecord.title || 'RCA triage requested from RAILS loop.', 900);
  const usersByUid = await getRailsUserSummariesByUid(context, [
    assignedToUid || '',
    itemRecord.ownerUid || '',
    itemRecord.approverUid || '',
    ...(itemRecord.contributorUids || [])
  ]);

  if (assignedToUid && !usersByUid.has(assignedToUid)) {
    throw validationError('Select an active company user for RCA triage ownership.');
  }

  const rcaTriageRequest: RailsRcaTriageRequest = {
    assignedToUid,
    convertedAtIso: null,
    convertedByUid: null,
    convertedRcaDisplayId: null,
    convertedRcaId: null,
    dueDate,
    reason,
    requestedAtIso: nowIso,
    requestedByUid: context.uid,
    reviewNote: null,
    reviewedAtIso: null,
    reviewedByUid: null,
    status: 'Requested'
  };
  const linkedRcaDecision = buildRailsRcaDecision('RCA triage requested', context.uid, nowIso, reason, 'Triage Requested');
  const comment = buildRailsComment(context.uid, `Requested RCA triage: ${reason}`, nowIso);
  const nextRecord: RailsItemRecord = {
    ...itemRecord,
    comments: [...(itemRecord.comments || []), comment],
    linkedRca: 'RCA triage requested',
    linkedRcaDecision,
    linkedRcaId: null,
    rcaTriageRequest,
    updatedAtIso: nowIso
  };

  await itemRef.set({
    comments: fieldValue.arrayUnion(comment),
    linkedRca: nextRecord.linkedRca,
    linkedRcaDecision,
    linkedRcaId: null,
    rcaTriageRequest,
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: nowIso
  }, { merge: true });
  await writeRailsAuditEvent({
    after: { linkedRca: nextRecord.linkedRca, linkedRcaDecision, rcaTriageRequest },
    before: { linkedRca: itemRecord.linkedRca || 'Not linked', linkedRcaDecision: itemRecord.linkedRcaDecision || null, rcaTriageRequest: itemRecord.rcaTriageRequest || null },
    context,
    itemId: itemRef.id,
    itemRef,
    metadata: { assignedToUid, dueDate },
    summary: `Requested RCA triage for ${itemRecord.displayId || itemRef.id}.`,
    type: 'RAILS_RCA_TRIAGE_REQUESTED'
  });

  return mapRailsItem(itemRef.id, nextRecord, context, usersByUid);
}

export async function updateRailsRcaTriageRequest(
  decodedToken: DecodedIdToken,
  itemId: string,
  input: RailsRcaTriageReviewInput = {}
): Promise<RailsItem> {
  const { context, itemRef, itemRecord } = await getAuthorizedRailsItem(decodedToken, itemId);

  if (!itemRecord.rcaTriageRequest) {
    throw validationError('Request RCA triage before updating the RCA triage workflow.');
  }

  const nowIso = new Date().toISOString();
  const assignedToUid = input.assignedToUid !== undefined
    ? input.assignedToUid ? safeUserId(input.assignedToUid) : null
    : itemRecord.rcaTriageRequest.assignedToUid || null;
  const status = input.status || itemRecord.rcaTriageRequest.status;
  const usersByUid = await getRailsUserSummariesByUid(context, [
    assignedToUid || '',
    itemRecord.ownerUid || '',
    itemRecord.approverUid || '',
    ...(itemRecord.contributorUids || [])
  ]);

  if (assignedToUid && !usersByUid.has(assignedToUid)) {
    throw validationError('Select an active company user for RCA triage ownership.');
  }

  const rcaTriageRequest: RailsRcaTriageRequest = {
    ...itemRecord.rcaTriageRequest,
    assignedToUid,
    dueDate: input.dueDate ? normalizeDate(input.dueDate, itemRecord.rcaTriageRequest.dueDate || itemRecord.dueDate || getDefaultDueDate()) : itemRecord.rcaTriageRequest.dueDate || null,
    reviewNote: normalizeText(input.reviewNote, itemRecord.rcaTriageRequest.reviewNote || '', 900) || null,
    reviewedAtIso: status !== itemRecord.rcaTriageRequest.status ? nowIso : itemRecord.rcaTriageRequest.reviewedAtIso || null,
    reviewedByUid: status !== itemRecord.rcaTriageRequest.status ? context.uid : itemRecord.rcaTriageRequest.reviewedByUid || null,
    status
  };
  const linkedRcaDecision = status === 'Rejected'
    ? buildRailsRcaDecision('RCA not required', context.uid, nowIso, rcaTriageRequest.reviewNote || 'RCA triage rejected after review.', 'Not Required')
    : buildRailsRcaDecision('RCA triage requested', context.uid, nowIso, rcaTriageRequest.reviewNote || rcaTriageRequest.reason, 'Triage Requested');
  const linkedRca = status === 'Rejected' ? 'RCA not required' : 'RCA triage requested';
  const comment = buildRailsComment(context.uid, `Updated RCA triage: ${status}.`, nowIso);
  const nextRecord: RailsItemRecord = {
    ...itemRecord,
    comments: [...(itemRecord.comments || []), comment],
    linkedRca,
    linkedRcaDecision,
    rcaTriageRequest,
    updatedAtIso: nowIso
  };

  await itemRef.set({
    comments: fieldValue.arrayUnion(comment),
    linkedRca,
    linkedRcaDecision,
    rcaTriageRequest,
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: nowIso
  }, { merge: true });
  await writeRailsAuditEvent({
    after: { linkedRca, linkedRcaDecision, rcaTriageRequest },
    before: { linkedRca: itemRecord.linkedRca || 'Not linked', linkedRcaDecision: itemRecord.linkedRcaDecision || null, rcaTriageRequest: itemRecord.rcaTriageRequest || null },
    context,
    itemId: itemRef.id,
    itemRef,
    metadata: { assignedToUid, status },
    summary: `Updated RCA triage for ${itemRecord.displayId || itemRef.id}.`,
    type: 'RAILS_RCA_DECISION_UPDATED'
  });

  return mapRailsItem(itemRef.id, nextRecord, context, usersByUid);
}

export async function convertRailsRcaTriageToIncident(
  decodedToken: DecodedIdToken,
  itemId: string
): Promise<RailsItem> {
  const { context, itemRef, itemRecord } = await getAuthorizedRailsItem(decodedToken, itemId);

  if (!itemRecord.rcaTriageRequest || itemRecord.rcaTriageRequest.status === 'Rejected') {
    throw validationError('Request RCA triage before creating an RCA project.');
  }

  if (itemRecord.linkedRcaId) {
    throw validationError('This RAILS loop is already linked to an RCA project.');
  }

  const nowIso = new Date().toISOString();
  const result = await createRcaIncident(decodedToken, {
    assetId: itemRecord.departmentName || 'RAILS generated RCA',
    riskFactors: getRcaRiskFactorsForRailsPriority(itemRecord.priority || 'Medium'),
    sourceRailsDisplayId: itemRecord.displayId || itemRef.id,
    sourceRailsItemId: itemRef.id,
    title: `RCA for ${itemRecord.title || itemRecord.displayId || 'RAILS loop'}`
  });
  const linkedRca = `${result.incident.displayId}: ${result.incident.title}`;
  const linkedRcaDecision = buildRailsRcaDecision(linkedRca, context.uid, nowIso, itemRecord.rcaTriageRequest.reason, 'Converted');
  const rcaTriageRequest: RailsRcaTriageRequest = {
    ...itemRecord.rcaTriageRequest,
    convertedAtIso: nowIso,
    convertedByUid: context.uid,
    convertedRcaDisplayId: result.incident.displayId,
    convertedRcaId: result.incident.id,
    status: 'Converted'
  };
  const comment = buildRailsComment(context.uid, `Converted RCA triage to ${linkedRca}.`, nowIso);
  const nextRecord: RailsItemRecord = {
    ...itemRecord,
    comments: [...(itemRecord.comments || []), comment],
    linkedRca,
    linkedRcaDecision,
    linkedRcaId: result.incident.id,
    rcaTriageRequest,
    updatedAtIso: nowIso
  };

  await itemRef.set({
    comments: fieldValue.arrayUnion(comment),
    linkedRca,
    linkedRcaDecision,
    linkedRcaId: result.incident.id,
    rcaTriageRequest,
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: nowIso
  }, { merge: true });
  await writeRailsAuditEvent({
    after: { linkedRca, linkedRcaDecision, linkedRcaId: result.incident.id, rcaTriageRequest },
    before: { linkedRca: itemRecord.linkedRca || 'Not linked', linkedRcaDecision: itemRecord.linkedRcaDecision || null, linkedRcaId: itemRecord.linkedRcaId || null, rcaTriageRequest: itemRecord.rcaTriageRequest || null },
    context,
    itemId: itemRef.id,
    itemRef,
    metadata: { rcaDisplayId: result.incident.displayId, rcaIncidentId: result.incident.id },
    summary: `Converted RCA triage to ${result.incident.displayId}.`,
    type: 'RAILS_RCA_CONVERTED'
  });

  const usersByUid = await getRailsUserSummariesByUid(context, [
    itemRecord.ownerUid || '',
    itemRecord.approverUid || '',
    ...(itemRecord.contributorUids || [])
  ]);

  return mapRailsItem(itemRef.id, nextRecord, context, usersByUid);
}

export async function listRailsRcaCandidates(decodedToken: DecodedIdToken): Promise<RailsRcaLinkCandidate[]> {
  const context = await getAuthorizedRailsContext(decodedToken);
  const snapshot = await context.organizationRef
    .collection(RCA_INCIDENTS_COLLECTION)
    .where('tenantId', '==', context.tenantId)
    .get();

  return snapshot.docs
    .map((doc) => mapRcaCandidate(doc.id, doc.data() as RcaIncidentRecord))
    .filter((candidate): candidate is RailsRcaLinkCandidate => Boolean(candidate))
    .sort((first, second) => Date.parse(second.updatedAtIso || '') - Date.parse(first.updatedAtIso || ''))
    .slice(0, 100);
}

export async function listRailsLswSourceCandidates(decodedToken: DecodedIdToken): Promise<RailsLswSourceCandidate[]> {
  const context = await getAuthorizedRailsContext(decodedToken);
  const lswProfileRef = context.organizationRef.collection(LSW_PROFILE_COLLECTION).doc(context.uid);
  const sourceGroups = await Promise.all([
    getLswSourceDocs(lswProfileRef, LSW_TODO_TASKS_COLLECTION, 'todoTask'),
    getLswSourceDocs(lswProfileRef, LSW_MEETING_RAILS_COLLECTION, 'meetingRail'),
    getLswSourceDocs(lswProfileRef, LSW_FOLLOW_UPS_COLLECTION, 'followUp'),
    getLswSourceDocs(lswProfileRef, LSW_RCA_TRIGGERS_COLLECTION, 'rcaTrigger'),
    getLswSourceDocs(lswProfileRef, LSW_IMPROVEMENT_PROJECTS_COLLECTION, 'improvementProject')
  ]);

  return sourceGroups
    .flat()
    .filter((candidate) => candidate.title && candidate.status !== 'deleted')
    .sort((first, second) => Date.parse(second.createdAtIso || second.linkedAtIso) - Date.parse(first.createdAtIso || first.linkedAtIso))
    .slice(0, 120);
}

async function getLswSourceDocs(
  lswProfileRef: FirebaseFirestore.DocumentReference,
  collectionName: string,
  sourceType: RailsLswSourceType
): Promise<RailsLswSourceCandidate[]> {
  const snapshot = await lswProfileRef.collection(collectionName).limit(75).get();

  return snapshot.docs
    .map((doc) => mapLswSourceCandidate(doc.id, sourceType, doc.data()))
    .filter((candidate): candidate is RailsLswSourceCandidate => Boolean(candidate));
}

async function listAccessibleRailsItemDocs(
  context: AuthorizedRailsContext,
  options: { includeTerminal?: boolean; limit?: number } = {}
): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  const snapshot = await context.organizationRef
    .collection(RAILS_ITEMS_COLLECTION)
    .where('tenantId', '==', context.tenantId)
    .get();
  const limit = options.limit || MAX_RAILS_ITEMS;

  return snapshot.docs
    .filter((doc) => {
      const record = doc.data() as RailsItemRecord;

      return record.status !== 'Deleted' &&
        (options.includeTerminal || (record.status !== 'Cancelled' && record.status !== 'Archived')) &&
        canAccessRailsItem(context, record);
    })
    .sort((first, second) => getUpdatedAtMs(second.data() as RailsItemRecord) - getUpdatedAtMs(first.data() as RailsItemRecord))
    .slice(0, limit);
}

async function recordRailsEscalations(
  context: AuthorizedRailsContext,
  itemDocs: FirebaseFirestore.QueryDocumentSnapshot[]
): Promise<void> {
  await Promise.all(itemDocs.map(async (doc) => {
    const record = doc.data() as RailsItemRecord;
    const escalation = buildRailsEscalationSummary(record);

    if ((escalation.level !== 'Critical' && escalation.level !== 'Overdue') || record.lastEscalationLevel === escalation.level) {
      return;
    }

    const nowIso = new Date().toISOString();
    await doc.ref.set({
      lastEscalatedAtIso: nowIso,
      lastEscalationLevel: escalation.level,
      updatedAt: fieldValue.serverTimestamp(),
      updatedAtIso: nowIso
    }, { merge: true });
    await writeRailsAuditEvent({
      after: {
        escalationLevel: escalation.level,
        overdueDays: escalation.overdueDays,
        reasons: escalation.reasons
      },
      before: {
        escalationLevel: record.lastEscalationLevel || 'None'
      },
      context,
      itemId: doc.id,
      itemRef: doc.ref,
      metadata: {
        dueDate: record.dueDate || '',
        ownerUid: record.ownerUid || ''
      },
      summary: `${record.displayId || 'RAILS loop'} escalated to ${escalation.level}.`,
      type: 'RAILS_ESCALATED'
    });
    await queueRailsNotification({
      context,
      itemId: doc.id,
      message: `${record.displayId || 'A RAILS loop'} escalated to ${escalation.level}: ${escalation.reasons.join(' ')}`,
      metadata: {
        escalationLevel: escalation.level,
        overdueDays: escalation.overdueDays
      },
      recipientUids: [record.ownerUid || '', record.approverUid || '', ...(record.contributorUids || [])],
      type: 'RAILS_OVERDUE_ESCALATED'
    });
  }));
}

async function getAuthorizedRailsItem(
  decodedToken: DecodedIdToken,
  itemId: string,
  options: { requireManage?: boolean } = {}
): Promise<{
  context: AuthorizedRailsContext;
  itemRecord: RailsItemRecord;
  itemRef: FirebaseFirestore.DocumentReference;
}> {
  const context = await getAuthorizedRailsContext(decodedToken);
  const itemRef = context.organizationRef.collection(RAILS_ITEMS_COLLECTION).doc(safeDocumentId(itemId));
  const snapshot = await itemRef.get();

  if (!snapshot.exists) {
    throw notFoundError('This RAILS loop was not found.');
  }

  const itemRecord = snapshot.data() as RailsItemRecord;

  if (itemRecord.tenantId !== context.tenantId || itemRecord.status === 'Deleted' || !canAccessRailsItem(context, itemRecord)) {
    throw notFoundError('This RAILS loop was not found.');
  }

  if (options.requireManage !== false && !canManageRailsItem(context, itemRecord)) {
    throw authorizationError('You do not have permission to update this RAILS loop.');
  }

  return { context, itemRecord, itemRef };
}

function canAccessRailsItem(context: AuthorizedRailsContext, item: RailsItemRecord): boolean {
  if (context.role === 'ORG_ADMIN' || context.role === 'SYSTEM_ADMIN') {
    return true;
  }

  if (context.role === 'DEPT_ADMIN') {
    return Boolean(context.department.departmentId && item.departmentId === context.department.departmentId);
  }

  return [
    item.createdByUid,
    item.ownerUid,
    item.approverUid,
    ...(Array.isArray(item.contributorUids) ? item.contributorUids : []),
    ...(Array.isArray(item.watcherUids) ? item.watcherUids : [])
  ].includes(context.uid);
}

function canManageRailsItem(context: AuthorizedRailsContext, item: RailsItemRecord): boolean {
  return context.role === 'ORG_ADMIN' ||
    context.role === 'SYSTEM_ADMIN' ||
    context.uid === item.createdByUid ||
    context.uid === item.ownerUid ||
    (context.role === 'DEPT_ADMIN' && Boolean(context.department.departmentId && item.departmentId === context.department.departmentId));
}

async function getAuthorizedRailsContext(decodedToken: DecodedIdToken): Promise<AuthorizedRailsContext> {
  const session = await buildAuthSession(decodedToken);
  const { permissions, role, status, tenantId } = session.user;

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

  return {
    department: await resolveUserDepartment(tenantId, user, role),
    organization,
    organizationRef,
    permissions,
    role,
    tenantId,
    user,
    uid: decodedToken.uid
  };
}

async function resolveUserDepartment(
  tenantId: string,
  user: TenantUserRecord,
  role: SynzappRole
): Promise<RailsWorkspaceContext['department']> {
  const fallbackDepartmentId = role === 'ORG_ADMIN' && !user.departmentId
    ? HUMAN_RESOURCES_DEPARTMENT_ID
    : user.departmentId || null;
  const fallbackName = role === 'ORG_ADMIN' && fallbackDepartmentId === HUMAN_RESOURCES_DEPARTMENT_ID
    ? HUMAN_RESOURCES_DEPARTMENT_NAME
    : user.departmentName || 'Unassigned department';

  if (!fallbackDepartmentId) {
    return { departmentId: null, name: fallbackName, status: 'ACTIVE' };
  }

  const departmentSnapshot = await firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('departments')
    .doc(fallbackDepartmentId)
    .get();

  if (!departmentSnapshot.exists) {
    return { departmentId: fallbackDepartmentId, name: fallbackName, status: 'ACTIVE' };
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

function mapRailsContext(context: AuthorizedRailsContext): RailsWorkspaceContext {
  return {
    company: {
      companyName: context.organization.companyName || 'Your organization',
      tenantId: context.tenantId
    },
    department: context.department,
    user: {
      displayName: getDisplayName(context.user),
      role: context.role,
      roleName: formatRoleName(context.user.roleName, context.role),
      uid: context.uid
    }
  };
}

function mapRailsItem(
  id: string,
  record: RailsItemRecord,
  context: AuthorizedRailsContext,
  usersByUid: Map<string, RailsUserSummary>
): RailsItem {
  const owner = usersByUid.get(record.ownerUid || '') || buildRailsUserSummary(context.uid, context.user);
  const actions = mapRailsActions(record.actions || [], usersByUid);

  return {
    actions,
    actionsComplete: actions.filter((action) => action.status === 'Done').length,
    actionsProgressPercent: getActionsProgressPercent(record.actions || []),
    actionsTotal: actions.length || clampNumber(record.actionsTotal, 1, 999, 1),
    approver: record.approverUid ? usersByUid.get(record.approverUid) || null : null,
    archivedAtIso: record.archivedAtIso || null,
    archivedBy: record.archivedByUid ? usersByUid.get(record.archivedByUid) || null : null,
    archiveReason: record.archiveReason || null,
    cancelledAtIso: record.cancelledAtIso || null,
    cancelledBy: record.cancelledByUid ? usersByUid.get(record.cancelledByUid) || null : null,
    cancelReason: record.cancelReason || null,
    category: record.category || 'Process',
    comments: Array.isArray(record.comments) ? record.comments : [],
    contributors: (Array.isArray(record.contributorUids) ? record.contributorUids : [])
      .map((uid) => usersByUid.get(uid) || null)
      .filter((user): user is RailsUserSummary => Boolean(user)),
    createdAtIso: toIso(record.createdAtIso || record.createdAt) || new Date().toISOString(),
    departmentName: record.departmentName || null,
    displayId: record.displayId || buildRailsDisplayId(id, record.createdAtIso || new Date().toISOString()),
    dueDate: record.dueDate || '',
    evidence: mapRailsEvidence(id, Array.isArray(record.evidence) ? record.evidence : []),
    escalation: buildRailsEscalationSummary(record),
    id,
    linkedLsw: record.linkedLsw || 'Not linked',
    linkedLswSource: record.linkedLswSource || null,
    linkedRca: record.linkedRca || 'Not linked',
    linkedRcaDecision: normalizeRailsRcaDecision(record),
    linkedRcaId: record.linkedRcaId || null,
    owner,
    priority: record.priority || 'Medium',
    problem: record.problem || '',
    reopenedAtIso: record.reopenedAtIso || null,
    reopenedBy: record.reopenedByUid ? usersByUid.get(record.reopenedByUid) || null : null,
    reopenReason: record.reopenReason || null,
    rcaTriageRequest: normalizeRailsRcaTriageRequest(record.rcaTriageRequest || null),
    source: record.source || 'Manual intake',
    standardization: record.standardization || 'Define during triage.',
    standardizationDocumentCurrentVersionId: record.standardizationDocumentCurrentVersionId || null,
    standardizationDocumentVersions: mapStandardizationDocumentVersions(id, record.standardizationDocumentVersions || [], usersByUid),
    standardizationDueDate: record.standardizationDueDate || '',
    standardizationOwner: record.standardizationOwnerUid ? usersByUid.get(record.standardizationOwnerUid) || null : null,
    standardizationOwnerUid: record.standardizationOwnerUid || null,
    standardizationStatus: record.standardizationStatus || 'Not Started',
    standardizationType: record.standardizationType || null,
    standardizationVerifiedAtIso: record.standardizationVerifiedAtIso || null,
    standardizationVerifiedBy: record.standardizationVerifiedByUid ? usersByUid.get(record.standardizationVerifiedByUid) || null : null,
    standardizationVerifiedByUid: record.standardizationVerifiedByUid || null,
    standardizationVerification: record.standardizationVerification || '',
    status: record.status && record.status !== 'Deleted' ? record.status : 'New',
    title: record.title || 'Untitled RAILS loop',
    updatedAtIso: toIso(record.updatedAtIso || record.updatedAt) || toIso(record.createdAtIso || record.createdAt) || new Date().toISOString(),
    verification: record.verification || 'Supervisor review before closure',
    workflowGate: buildRailsWorkflowGate(record)
  };
}

function collectRailsItemUserIds(itemDocs: FirebaseFirestore.QueryDocumentSnapshot[]): string[] {
  return itemDocs.flatMap((doc) => {
    const record = doc.data() as RailsItemRecord;

    return [
      record.ownerUid || '',
      record.approverUid || '',
      record.standardizationOwnerUid || '',
      record.standardizationVerifiedByUid || '',
      record.reopenedByUid || '',
      record.archivedByUid || '',
      record.cancelledByUid || '',
      ...(Array.isArray(record.contributorUids) ? record.contributorUids : []),
      ...getRailsActionUserIds(record.actions),
      ...(Array.isArray(record.standardizationDocumentVersions) ? record.standardizationDocumentVersions.map((version) => version.uploadedByUid || '') : [])
    ];
  });
}

function matchesRailsHistoryQuery(item: RailsItem, query: RailsHistoryQuery): boolean {
  if (query.status && query.status !== 'All' && item.status !== query.status) {
    return false;
  }

  if (query.priority && item.priority !== query.priority) {
    return false;
  }

  if (query.category && item.category !== query.category) {
    return false;
  }

  if (query.ownerUid && item.owner.uid !== query.ownerUid) {
    return false;
  }

  if (query.departmentName && (item.departmentName || '').toLowerCase() !== query.departmentName.toLowerCase()) {
    return false;
  }

  if (query.dateFrom && item.createdAtIso.slice(0, 10) < query.dateFrom) {
    return false;
  }

  if (query.dateTo && item.createdAtIso.slice(0, 10) > query.dateTo) {
    return false;
  }

  if (query.search) {
    const haystack = [
      item.displayId,
      item.title,
      item.problem,
      item.owner.displayName,
      item.departmentName || '',
      item.category,
      item.priority,
      item.linkedLsw,
      item.linkedLswSource?.title || '',
      item.linkedRca,
      item.linkedRcaId || '',
      item.linkedRcaDecision?.status || '',
      item.linkedRcaDecision?.reason || '',
      item.rcaTriageRequest?.reason || '',
      item.status
    ].join(' ').toLowerCase();

    return haystack.includes(query.search.toLowerCase());
  }

  return true;
}

function buildRailsBreakdown(items: RailsItem[], getLabel: (item: RailsItem) => string): RailsReportBreakdownEntry[] {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    const label = getLabel(item) || 'Unassigned';
    counts.set(label, (counts.get(label) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label));
}

function buildRailsAgingBuckets(items: RailsItem[]): RailsReportResponse['agingBuckets'] {
  const buckets = [
    { label: '0-7 days', value: 0 },
    { label: '8-14 days', value: 0 },
    { label: '15-30 days', value: 0 },
    { label: '31+ days', value: 0 }
  ];

  items.forEach((item) => {
    const ageDays = getAgeDays(item.createdAtIso);

    if (ageDays <= 7) {
      buckets[0].value += 1;
    } else if (ageDays <= 14) {
      buckets[1].value += 1;
    } else if (ageDays <= 30) {
      buckets[2].value += 1;
    } else {
      buckets[3].value += 1;
    }
  });

  return buckets;
}

function buildRailsCsv(items: RailsItem[]): string {
  const headers = [
    'Display ID',
    'Title',
    'Status',
    'Priority',
    'Category',
    'Owner',
    'Department',
    'Due Date',
    'Created',
    'Updated',
    'Action Progress',
    'Escalation',
    'Overdue Days',
    'Linked RCA',
    'Standardization Status',
    'Closed At',
    'Archive Reason',
    'Cancel Reason',
    'Reopen Reason'
  ];
  const rows = items.map((item) => [
    item.displayId,
    item.title,
    item.status,
    item.priority,
    item.category,
    item.owner.displayName,
    item.departmentName || '',
    item.dueDate,
    item.createdAtIso,
    item.updatedAtIso,
    `${item.actionsProgressPercent}%`,
    item.escalation.level,
    item.escalation.overdueDays.toString(),
    item.linkedRca,
    item.standardizationStatus,
    item.status === 'Closed' ? item.updatedAtIso : '',
    item.archiveReason || '',
    item.cancelReason || '',
    item.reopenReason || ''
  ]);

  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\n');
}

function csvCell(value: string): string {
  const normalized = value.replace(/\r?\n/g, ' ').trim();

  if (/[",]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function mapRailsEvidence(itemId: string, evidence: RailsEvidence[]): RailsEvidence[] {
  return evidence.map((entry) => {
    const evidenceId = entry.evidenceId;
    const fileUrl = entry.fileUrl?.startsWith('rails-evidence://')
      ? `/api/rails/items/${encodeURIComponent(itemId)}/evidence/${encodeURIComponent(evidenceId)}`
      : entry.fileUrl || null;

    return {
      ...entry,
      contentType: entry.contentType || inferContentType(entry.fileName || ''),
      fileSizeBytes: typeof entry.fileSizeBytes === 'number' ? entry.fileSizeBytes : null,
      fileUrl,
      visibility: entry.visibility || 'public'
    };
  });
}

function mapStandardizationDocumentVersions(
  itemId: string,
  versions: RailsStandardizationDocumentVersion[],
  usersByUid: Map<string, RailsUserSummary>
): RailsStandardizationDocumentVersion[] {
  return versions
    .map((version) => ({
      ...version,
      fileUrl: `/api/rails/items/${encodeURIComponent(itemId)}/standardization-documents/${encodeURIComponent(version.versionId)}`,
      uploaderName: usersByUid.get(version.uploadedByUid)?.displayName || version.uploaderName || null
    }))
    .sort((first, second) => second.versionNumber - first.versionNumber);
}

function mapRailsAuditActivity(id: string, record: FirebaseFirestore.DocumentData): RailsAuditActivity {
  return {
    actorDisplayName: typeof record.actorDisplayName === 'string' ? record.actorDisplayName : 'Synzapp user',
    actorRole: typeof record.actorRole === 'string' ? record.actorRole : '',
    actorUid: typeof record.actorUid === 'string' ? record.actorUid : '',
    after: isPlainRecord(record.after) ? record.after : null,
    before: isPlainRecord(record.before) ? record.before : null,
    createdAtIso: toIso(record.createdAtIso || record.createdAt) || new Date().toISOString(),
    eventId: typeof record.eventId === 'string' ? record.eventId : id,
    itemId: typeof record.itemId === 'string' ? record.itemId : '',
    metadata: isPlainRecord(record.metadata) ? record.metadata : {},
    reason: typeof record.reason === 'string' ? record.reason : null,
    summary: typeof record.summary === 'string' ? record.summary : 'RAILS activity updated.',
    type: typeof record.type === 'string' ? record.type as RailsAuditEventType : 'RAILS_UPDATED'
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function inferContentType(fileName: string): string | null {
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith('.png')) {
    return 'image/png';
  }

  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  if (lowerName.endsWith('.webp')) {
    return 'image/webp';
  }

  if (lowerName.endsWith('.gif')) {
    return 'image/gif';
  }

  return null;
}

function mapRailsActions(
  actions: RailsActionRecord[],
  usersByUid: Map<string, RailsUserSummary>
): RailsAction[] {
  return actions.map((action) => ({
    actionId: action.actionId,
    completedAtCorrectionReason: action.completedAtCorrectionReason || '',
    completedAtIso: action.completedAtIso || null,
    completedBy: action.completedByUid ? usersByUid.get(action.completedByUid) || null : null,
    completedByExternalName: action.completedByExternalName || '',
    completedByUid: action.completedByUid || null,
    containmentNote: action.containmentNote || '',
    dueDate: action.dueDate || '',
    effectivenessCriteria: action.effectivenessCriteria || '',
    effectivenessResult: action.effectivenessResult || '',
    evidenceIds: normalizeMappedActionEvidenceIds(action.evidenceIds),
    implementationNote: action.implementationNote || '',
    owner: action.ownerUid ? usersByUid.get(action.ownerUid) || null : null,
    ownerUid: action.ownerUid || '',
    progressPercent: getActionProgressPercent(action),
    riskControlled: action.riskControlled || '',
    startedAtCorrectionReason: action.startedAtCorrectionReason || '',
    startedAtIso: action.startedAtIso || null,
    startedBy: action.startedByUid ? usersByUid.get(action.startedByUid) || null : null,
    startedByUid: action.startedByUid || null,
    status: action.status || 'Open',
    standardizationNote: action.standardizationNote || '',
    title: action.title || 'Untitled action',
    verificationNote: action.verificationNote || '',
    verifiedAtIso: action.verifiedAtIso || null,
    verifiedBy: action.verifiedByUid ? usersByUid.get(action.verifiedByUid) || null : null,
    verifiedByUid: action.verifiedByUid || null
  }));
}

function getRailsActionUserIds(actions?: RailsActionRecord[]): string[] {
  return (Array.isArray(actions) ? actions : []).flatMap((action) => [
    action.ownerUid || '',
    action.startedByUid || '',
    action.completedByUid || '',
    action.verifiedByUid || ''
  ]);
}

function normalizeMappedActionEvidenceIds(evidenceIds?: string[]): string[] {
  return Array.from(new Set((Array.isArray(evidenceIds) ? evidenceIds : [])
    .map((evidenceId) => safeUserId(evidenceId))
    .filter(Boolean)));
}

function normalizeActionEvidenceIds(evidenceIds: string[] | undefined, evidence: RailsEvidence[], itemOwnerUid = ''): string[] {
  const attachedEvidenceIds = new Set((evidence || [])
    .filter((entry) => entry.status === 'Attached' && Boolean(entry.fileUrl && entry.fileName))
    .filter((entry) => (entry.visibility || 'public') === 'public' || Boolean(itemOwnerUid && entry.uploadedByUid === itemOwnerUid))
    .map((entry) => safeUserId(entry.evidenceId)));

  return Array.from(new Set((Array.isArray(evidenceIds) ? evidenceIds : [])
    .map((evidenceId) => safeUserId(evidenceId))
    .filter((evidenceId) => attachedEvidenceIds.has(evidenceId))));
}

function isRequiredRailsEvidenceSatisfied(requiredEvidence: RailsEvidence, evidence: RailsEvidence[], itemOwnerUid = ''): boolean {
  const linkedEvidenceId = requiredEvidence.sourceEvidenceId ? safeDocumentId(requiredEvidence.sourceEvidenceId) : '';
  if (!linkedEvidenceId) {
    return false;
  }

  return evidence.some((entry) => (
    safeDocumentId(entry.evidenceId) === linkedEvidenceId
    && entry.status === 'Attached'
    && Boolean(entry.fileUrl && entry.fileName)
    && ((entry.visibility || 'public') === 'public' || Boolean(itemOwnerUid && entry.uploadedByUid === itemOwnerUid))
  ));
}

function applyActionExecutionPatch(
  nextAction: RailsActionRecord,
  currentAction: RailsActionRecord,
  patch: RailsActionPatch
): void {
  const startedAtChanged = patch.startedAtIso !== undefined && normalizeIsoDateTime(patch.startedAtIso, null) !== (currentAction.startedAtIso || null);
  const completedAtChanged = patch.completedAtIso !== undefined && normalizeIsoDateTime(patch.completedAtIso, null) !== (currentAction.completedAtIso || null);
  const completedByUidChanged = patch.completedByUid !== undefined &&
    (patch.completedByUid ? safeUserId(patch.completedByUid) : null) !== (currentAction.completedByUid || null);
  const externalCompletedByChanged = patch.completedByExternalName !== undefined &&
    normalizeText(patch.completedByExternalName, '', 120) !== (currentAction.completedByExternalName || '');

  if (patch.startedAtCorrectionReason !== undefined) {
    nextAction.startedAtCorrectionReason = normalizeText(patch.startedAtCorrectionReason, '', 500);
  }

  if (patch.completedAtCorrectionReason !== undefined) {
    nextAction.completedAtCorrectionReason = normalizeText(patch.completedAtCorrectionReason, '', 500);
  }

  if (patch.startedAtIso !== undefined) {
    nextAction.startedAtIso = normalizeIsoDateTime(patch.startedAtIso, null);
  }

  if (patch.completedAtIso !== undefined) {
    nextAction.completedAtIso = normalizeIsoDateTime(patch.completedAtIso, null);
  }

  if (patch.startedByUid !== undefined) {
    nextAction.startedByUid = patch.startedByUid ? safeUserId(patch.startedByUid) : null;
  }

  if (patch.completedByUid !== undefined) {
    nextAction.completedByUid = patch.completedByUid ? safeUserId(patch.completedByUid) : null;
    if (nextAction.completedByUid) {
      nextAction.completedByExternalName = '';
    }
  }

  if (patch.completedByExternalName !== undefined) {
    nextAction.completedByExternalName = normalizeText(patch.completedByExternalName, '', 120);
    if (nextAction.completedByExternalName) {
      nextAction.completedByUid = null;
    }
  }

  if (startedAtChanged && !normalizeText(nextAction.startedAtCorrectionReason, '', 500)) {
    throw validationError('Enter a correction reason before changing the started date or time.');
  }

  if ((completedAtChanged || completedByUidChanged || externalCompletedByChanged) && !normalizeText(nextAction.completedAtCorrectionReason, '', 500)) {
    throw validationError('Enter a correction reason before changing the completed date/time or manually typing the completed-by name.');
  }
}

function validateActionExecutionOverrides(action: RailsActionRecord, input: RailsActionInput): void {
  if (input.startedAtIso !== undefined && !normalizeText(action.startedAtCorrectionReason, '', 500)) {
    throw validationError('Enter a correction reason before setting a manual started date or time.');
  }

  if ((input.completedAtIso !== undefined || action.completedByExternalName) && !normalizeText(action.completedAtCorrectionReason, '', 500)) {
    throw validationError('Enter a correction reason before setting manual completion details.');
  }
}

function normalizeIsoDateTime(value: string | null | undefined, fallback: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalized = normalizeText(value, '', 80);
  if (!normalized) {
    return fallback;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw validationError('Enter a valid date and time.');
  }

  return date.toISOString();
}

function getRailsActionKind(action: RailsActionRecord): 'containment' | 'corrective' | 'effectiveness' | 'general' {
  const title = action.title || '';
  if (/\bcontain\b|\bimmediate risk\b/i.test(title)) {
    return 'containment';
  }
  if (/\bcorrective\b|\bcomplete corrective\b/i.test(title)) {
    return 'corrective';
  }
  if (/\beffectiveness\b|\bstandardize\b|\bstandardise\b/i.test(title)) {
    return 'effectiveness';
  }

  return 'general';
}

function isGovernedAction(action: RailsActionRecord): boolean {
  return Boolean(action.title);
}

function getRailsActionCompletionBlockers(action: RailsActionRecord, evidence: RailsEvidence[]): string[] {
  const blockers: string[] = [];
  const actionKind = getRailsActionKind(action);
  const linkedAttachedEvidenceIds = new Set(normalizeActionEvidenceIds(action.evidenceIds, evidence));

  if (actionKind === 'containment') {
    if (!normalizeText(action.containmentNote, '', 900)) {
      blockers.push('document the containment action taken');
    }

    if (!normalizeText(action.riskControlled, '', 600)) {
      blockers.push('document the risk that was controlled');
    }

    if (!normalizeText(action.verificationNote, '', 900)) {
      blockers.push('document how containment was verified');
    }

    if (!linkedAttachedEvidenceIds.size) {
      blockers.push('link attached evidence to the containment action');
    }
  }

  if (actionKind === 'corrective') {
    if (!normalizeText(action.implementationNote, '', 900)) {
      blockers.push('document the corrective action implemented');
    }

    if (!normalizeText(action.riskControlled, '', 600)) {
      blockers.push('document the root cause or failure mode addressed');
    }

    if (!normalizeText(action.verificationNote, '', 900)) {
      blockers.push('document owner completion confirmation');
    }

    if (!linkedAttachedEvidenceIds.size) {
      blockers.push('link implementation evidence to the corrective action');
    }
  }

  if (actionKind === 'effectiveness') {
    if (!normalizeText(action.effectivenessCriteria, '', 900)) {
      blockers.push('document the effectiveness acceptance criteria');
    }

    if (!normalizeText(action.effectivenessResult, '', 900)) {
      blockers.push('document the actual effectiveness result');
    }

    if (!normalizeText(action.verificationNote, '', 900)) {
      blockers.push('document effectiveness verification approval');
    }

    if (!linkedAttachedEvidenceIds.size) {
      blockers.push('link effectiveness evidence to the action');
    }
  }

  if (actionKind === 'general') {
    if (!normalizeText(action.containmentNote, '', 900)) {
      blockers.push('document the action taken');
    }

    if (!normalizeText(action.riskControlled, '', 600)) {
      blockers.push('document what risk, failure, or process gap was controlled');
    }

    if (!normalizeText(action.verificationNote, '', 900)) {
      blockers.push('document how this action was verified');
    }

    if (!linkedAttachedEvidenceIds.size) {
      blockers.push('link evidence to this action');
    }
  }

  return blockers;
}

function validateRailsActionCompletion(action: RailsActionRecord, evidence: RailsEvidence[]): void {
  const blockers = getRailsActionCompletionBlockers(action, evidence);

  if (blockers.length) {
    throw validationError(`Complete action requirements first: ${blockers.join(', ')}.`);
  }
}

function buildRailsEscalationSummary(record: RailsItemRecord): RailsEscalationSummary {
  const status = normalizeRailsStatus(record.status);
  const terminal = status === 'Closed' || status === 'Cancelled' || status === 'Archived';
  const reasons: string[] = [];
  let overdueDays = 0;

  if (terminal) {
    return {
      level: 'None',
      overdue: false,
      overdueDays: 0,
      reasons
    };
  }

  const loopOverdueDays = getDateOverdueDays(record.dueDate);
  if (loopOverdueDays > 0) {
    overdueDays = Math.max(overdueDays, loopOverdueDays);
    reasons.push(`Loop due date is ${loopOverdueDays} day${loopOverdueDays === 1 ? '' : 's'} overdue.`);
  }

  (record.actions || []).forEach((action) => {
    if (action.status === 'Done') {
      return;
    }

    const actionOverdueDays = getDateOverdueDays(action.dueDate);
    if (actionOverdueDays > 0) {
      overdueDays = Math.max(overdueDays, actionOverdueDays);
      reasons.push(`Action "${action.title}" is ${actionOverdueDays} day${actionOverdueDays === 1 ? '' : 's'} overdue.`);
    }
  });

  if (record.standardizationStatus !== 'Verified') {
    const standardizationOverdueDays = getDateOverdueDays(record.standardizationDueDate);
    if (standardizationOverdueDays > 0) {
      overdueDays = Math.max(overdueDays, standardizationOverdueDays);
      reasons.push(`Standardization plan is ${standardizationOverdueDays} day${standardizationOverdueDays === 1 ? '' : 's'} overdue.`);
    }
  }

  if (!reasons.length) {
    return {
      level: 'None',
      overdue: false,
      overdueDays: 0,
      reasons
    };
  }

  const critical = record.priority === 'Critical' || overdueDays >= 7;

  return {
    level: critical ? 'Critical' : 'Overdue',
    overdue: true,
    overdueDays,
    reasons
  };
}

function buildDefaultRailsActions(ownerUid: string, dueDate: string): RailsActionRecord[] {
  return [
    'Contain the immediate risk',
    'Complete corrective action',
    'Verify effectiveness'
  ].map((title) => ({
    actionId: `act_${randomUUID().replace(/-/g, '')}`,
    completedAtCorrectionReason: '',
    completedAtIso: null,
    completedByExternalName: '',
    completedByUid: null,
    containmentNote: '',
    dueDate,
    effectivenessCriteria: '',
    effectivenessResult: '',
    evidenceIds: [],
    implementationNote: '',
    ownerUid,
    progressPercent: 0,
    riskControlled: '',
    startedAtCorrectionReason: '',
    startedAtIso: null,
    startedByUid: null,
    standardizationNote: '',
    status: 'Open',
    title,
    verificationNote: '',
    verifiedAtIso: null,
    verifiedByUid: null
  }));
}

function updateRecordProgress(record: RailsItemRecord): RailsItemRecord {
  const actions = record.actions || [];

  return {
    ...record,
    actionsComplete: countCompletedActions(actions),
    actionsProgressPercent: getActionsProgressPercent(actions),
    actionsTotal: actions.length
  };
}

function applyRailsStatusAutomation(record: RailsItemRecord, previousStatus: RailsItemRecord['status']): RailsItemRecord {
  const safeStatus = previousStatus && previousStatus !== 'Deleted' ? previousStatus : record.status;
  const actions = record.actions || [];
  const hasStartedAction = actions.some((action) => getActionProgressPercent(action) > 0 && action.status !== 'Blocked');

  if ((safeStatus === 'New' || safeStatus === 'Triaged' || safeStatus === 'Reopened') && hasStartedAction) {
    return {
      ...record,
      status: 'In Progress'
    };
  }

  if (safeStatus === 'In Progress' && !hasStartedAction) {
    return {
      ...record,
      status: 'Triaged'
    };
  }

  return record;
}

function buildRailsWorkflowGate(record: RailsItemRecord): RailsWorkflowGate {
  const currentStatus = normalizeRailsStatus(record.status);
  const nextStatus = getNextRailsStatus(currentStatus);
  const blockers = nextStatus ? getRailsTransitionBlockers(record, nextStatus) : [];

  return {
    blockers,
    canAdvance: Boolean(nextStatus) && blockers.length === 0,
    currentStatus,
    nextStatus
  };
}

function validateRailsStatusTransition(
  currentRecord: RailsItemRecord,
  nextRecord: RailsItemRecord,
  targetStatus: RailsStatus
): void {
  const currentStatus = normalizeRailsStatus(currentRecord.status);

  if (targetStatus === currentStatus) {
    return;
  }

  if (targetStatus === 'Cancelled') {
    const blockers = getCancelReadinessBlockers(nextRecord);
    if (blockers.length) {
      throw validationError(`RAILS cancel blocked: ${blockers.join(' ')}`);
    }
    return;
  }

  if (targetStatus === 'Archived') {
    const blockers = getArchiveReadinessBlockers(currentRecord, nextRecord);
    if (blockers.length) {
      throw validationError(`RAILS archive blocked: ${blockers.join(' ')}`);
    }
    return;
  }

  if (targetStatus === 'Reopened') {
    const blockers = getReopenReadinessBlockers(currentRecord, nextRecord);
    if (blockers.length) {
      throw validationError(`RAILS reopen blocked: ${blockers.join(' ')}`);
    }
    return;
  }

  if (currentStatus === 'Cancelled' || currentStatus === 'Archived') {
    throw validationError(`RAILS gate blocked: ${currentStatus} loops cannot return to the active board from this workflow.`);
  }

  if (isBackwardRailsTransition(currentStatus, targetStatus)) {
    const blockers = getRailsBackwardTransitionBlockers(nextRecord, targetStatus);
    if (blockers.length) {
      throw validationError(`RAILS gate blocked: ${blockers.join(' ')}`);
    }
    return;
  }

  const nextStatus = getNextRailsStatus(currentStatus);

  if (targetStatus !== nextStatus) {
    throw validationError(`RAILS gate blocked: move from ${currentStatus} to ${nextStatus || 'the next stage'} before selecting ${targetStatus}.`);
  }

  const blockers = getRailsTransitionBlockers(nextRecord, targetStatus);

  if (blockers.length) {
    throw validationError(`RAILS gate blocked: ${blockers.join(' ')}`);
  }
}

function getRailsTransitionBlockers(record: RailsItemRecord, targetStatus: RailsStatus): string[] {
  if (targetStatus === 'Triaged') {
    return getTriagedBlockers(record);
  }

  if (targetStatus === 'In Progress') {
    return [
      ...getTriagedBlockers(record),
      ...getExecutionReadinessBlockers(record)
    ];
  }

  if (targetStatus === 'Verification') {
    return [
      ...getExecutionReadinessBlockers(record),
      ...getVerificationReadinessBlockers(record)
    ];
  }

  if (targetStatus === 'Approved') {
    return [
      ...getVerificationReadinessBlockers(record),
      ...getApprovalReadinessBlockers(record)
    ];
  }

  if (targetStatus === 'Closed') {
    return [
      ...getApprovalReadinessBlockers(record),
      ...getClosureReadinessBlockers(record)
    ];
  }

  if (targetStatus === 'Cancelled' || targetStatus === 'Archived') {
    return [];
  }

  return [];
}

function getRailsBackwardTransitionBlockers(record: RailsItemRecord, targetStatus: RailsStatus): string[] {
  if (targetStatus === 'Triaged' && (record.actions || []).some((action) => getActionProgressPercent(action) > 0)) {
    return ['Reset action progress to 0% before moving the loop back to Triaged.'];
  }

  if (targetStatus === 'New' && normalizeRailsStatus(record.status) !== 'Triaged') {
    return ['Only Triaged loops can be returned to New.'];
  }

  return [];
}

function getCancelReadinessBlockers(record: RailsItemRecord): string[] {
  const status = normalizeRailsStatus(record.status);
  const blockers: string[] = [];

  if (status === 'Verification' || status === 'Approved' || status === 'Closed' || status === 'Archived') {
    blockers.push('Archive verified, approved, or closed loops instead of cancelling them.');
  }

  const cancelReason = normalizeText(record.cancelReason || undefined, '', 500);
  if (!cancelReason || cancelReason.length < 5) {
    blockers.push('Enter a cancellation reason with at least 5 characters.');
  }

  return blockers;
}

function getArchiveReadinessBlockers(currentRecord: RailsItemRecord, nextRecord: RailsItemRecord): string[] {
  const currentStatus = normalizeRailsStatus(currentRecord.status);
  const blockers: string[] = [];

  if (currentStatus !== 'Closed' && currentStatus !== 'Approved') {
    blockers.push('Only Approved or Closed loops can be archived.');
  }

  const archiveReason = normalizeText(nextRecord.archiveReason || undefined, '', 500);
  if (!archiveReason || archiveReason.length < 5) {
    blockers.push('Enter an archive reason with at least 5 characters.');
  }

  return blockers;
}

function getReopenReadinessBlockers(currentRecord: RailsItemRecord, nextRecord: RailsItemRecord): string[] {
  const blockers: string[] = [];

  if (normalizeRailsStatus(currentRecord.status) !== 'Closed') {
    blockers.push('Only closed loops can be reopened through this controlled workflow.');
  }

  const reopenReason = normalizeText(nextRecord.reopenReason || undefined, '', 500);
  if (!reopenReason || reopenReason.length < 5) {
    blockers.push('Enter a reopen reason with at least 5 characters.');
  }

  return blockers;
}

function getTriagedBlockers(record: RailsItemRecord): string[] {
  const blockers: string[] = [];
  const actions = record.actions || [];

  if (!record.ownerUid) {
    blockers.push('Assign an accountable owner.');
  }

  if (!record.departmentName && !record.departmentId) {
    blockers.push('Assign the loop to a department.');
  }

  if (!record.dueDate) {
    blockers.push('Set the loop due date.');
  }

  if (!record.priority) {
    blockers.push('Set the priority.');
  }

  if (!normalizeText(record.title, '', 180)) {
    blockers.push('Enter a loop title.');
  }

  if (!normalizeText(record.problem, '', 600)) {
    blockers.push('Enter the problem statement.');
  }

  if (!actions.length) {
    blockers.push('Add at least one action plan item.');
  }

  if (!hasRcaDecision(record)) {
    blockers.push('Make an RCA decision: link RCA, request RCA triage, or mark RCA not required.');
  }

  if (!hasEnterpriseOriginDecision(record)) {
    blockers.push('Link an LSW source, link an RCA project, or document a manual enterprise intake source before triage.');
  }

  if (!Array.isArray(record.evidence) || record.evidence.length === 0) {
    blockers.push('Define required evidence placeholders.');
  }

  return blockers;
}

function getExecutionReadinessBlockers(record: RailsItemRecord): string[] {
  const blockers: string[] = [];
  const actions = record.actions || [];

  if (!actions.length) {
    blockers.push('Add at least one action before work can start.');
    return blockers;
  }

  if (actions.some((action) => !normalizeText(action.title, '', 180))) {
    blockers.push('Name every action item.');
  }

  if (actions.some((action) => !action.ownerUid)) {
    blockers.push('Assign an owner to every action.');
  }

  if (actions.some((action) => !action.dueDate)) {
    blockers.push('Set a due date for every action.');
  }

  if (!actions.some((action) => action.status === 'Open' || action.status === 'In Progress' || getActionProgressPercent(action) > 0)) {
    blockers.push('Keep at least one action open or in progress.');
  }

  return blockers;
}

function getVerificationReadinessBlockers(record: RailsItemRecord): string[] {
  const blockers: string[] = [];
  const actions = record.actions || [];
  const evidence = record.evidence || [];

  if (!actions.length || actions.some((action) => getActionProgressPercent(action) < 100 || action.status !== 'Done')) {
    blockers.push('Complete every action to 100%.');
  }

  actions
    .filter(isGovernedAction)
    .forEach((action) => {
      const actionBlockers = getRailsActionCompletionBlockers(action, evidence);
      if (actionBlockers.length) {
        blockers.push(`Complete governed action documentation for "${action.title}": ${actionBlockers.join(', ')}.`);
      }
    });

  if (evidence.some((entry) => entry.status === 'Required' && !isRequiredRailsEvidenceSatisfied(entry, evidence, record.ownerUid || ''))) {
    blockers.push('Link all required verification evidence from the Evidence Library before verification.');
  }

  if (!normalizeText(record.verification, '', 360)) {
    blockers.push('Define the verification method.');
  }

  return blockers;
}

function getApprovalReadinessBlockers(record: RailsItemRecord): string[] {
  const blockers = getVerificationReadinessBlockers(record);

  if (!record.approverUid) {
    blockers.push('Assign an approver before approval.');
  }

  return blockers;
}

function getClosureReadinessBlockers(record: RailsItemRecord): string[] {
  const blockers = getStandardizationVerificationBlockers(record);

  if (record.standardizationStatus !== 'Verified') {
    blockers.push('Verify the standardization plan before closure.');
  }

  return blockers;
}

function getStandardizationVerificationBlockers(record: RailsItemRecord): string[] {
  const blockers: string[] = [];

  if (!normalizeText(record.standardization, '', 600) || record.standardization === 'Define during triage.') {
    blockers.push('Document the standardization target before closure.');
  }

  if (!record.standardizationType) {
    blockers.push('Select the standardization type.');
  }

  if (!record.standardizationOwnerUid) {
    blockers.push('Assign a standardization owner.');
  }

  if (!record.standardizationDueDate) {
    blockers.push('Set the standardization due date.');
  }

  if (!normalizeText(record.standardizationVerification, '', 600)) {
    blockers.push('Document the standardization verification method.');
  }

  if (!hasStandardizationDocument(record)) {
    blockers.push('Attach the standardization document before verification.');
  }

  return blockers;
}

function hasStandardizationDocument(record: RailsItemRecord): boolean {
  return (record.evidence || []).some((entry) => entry.purpose === 'standardization' && entry.status === 'Attached' && Boolean(entry.fileName && entry.fileUrl));
}

function hasRcaDecision(record: RailsItemRecord): boolean {
  const structuredStatus = record.linkedRcaDecision?.status;

  if (structuredStatus === 'Linked' || structuredStatus === 'Converted' || structuredStatus === 'Not Required' || structuredStatus === 'Triage Requested') {
    return true;
  }

  if (record.rcaTriageRequest?.status === 'Requested' || record.rcaTriageRequest?.status === 'Accepted' || record.rcaTriageRequest?.status === 'Converted') {
    return true;
  }

  const linkedRca = normalizeText(record.linkedRca, '', 160).toLowerCase();

  return Boolean(record.linkedRcaId) ||
    linkedRca === 'rca triage requested' ||
    linkedRca === 'not required' ||
    linkedRca.includes('not required') ||
    (Boolean(linkedRca) && linkedRca !== 'not linked' && linkedRca !== 'pending triage');
}

function buildRailsRcaDecision(
  linkedRca: string,
  decidedByUid: string,
  decidedAtIso: string,
  reason = '',
  forcedStatus?: RailsRcaDecisionStatus
): RailsRcaDecision {
  const normalized = normalizeText(linkedRca, 'Not linked', 160).toLowerCase();
  let status: RailsRcaDecisionStatus = forcedStatus || 'Not Linked';

  if (!forcedStatus) {
    if (normalized.includes('triage requested')) {
      status = 'Triage Requested';
    } else if (normalized.includes('not required')) {
      status = 'Not Required';
    } else if (normalized !== 'not linked' && normalized !== 'pending triage') {
      status = 'Linked';
    }
  }

  return {
    decidedAtIso,
    decidedByUid,
    reason: normalizeText(reason, '', 900),
    status
  };
}

function normalizeRailsRcaDecision(record: RailsItemRecord): RailsRcaDecision | null {
  if (record.linkedRcaDecision?.status) {
    return {
      decidedAtIso: record.linkedRcaDecision.decidedAtIso || toIso(record.updatedAtIso || record.updatedAt) || new Date().toISOString(),
      decidedByUid: record.linkedRcaDecision.decidedByUid || record.createdByUid || '',
      reason: normalizeText(record.linkedRcaDecision.reason, '', 900),
      status: normalizeRailsRcaDecisionStatus(record.linkedRcaDecision.status)
    };
  }

  if (!record.linkedRca && !record.linkedRcaId) {
    return null;
  }

  return buildRailsRcaDecision(record.linkedRca || 'Not linked', record.createdByUid || '', toIso(record.updatedAtIso || record.updatedAt) || new Date().toISOString());
}

function normalizeRailsRcaTriageRequest(request: RailsRcaTriageRequest | null): RailsRcaTriageRequest | null {
  if (!request) {
    return null;
  }

  return {
    assignedToUid: request.assignedToUid || null,
    convertedAtIso: request.convertedAtIso || null,
    convertedByUid: request.convertedByUid || null,
    convertedRcaDisplayId: request.convertedRcaDisplayId || null,
    convertedRcaId: request.convertedRcaId || null,
    dueDate: request.dueDate || null,
    reason: normalizeText(request.reason, '', 900),
    requestedAtIso: request.requestedAtIso || new Date().toISOString(),
    requestedByUid: request.requestedByUid || '',
    reviewNote: request.reviewNote || null,
    reviewedAtIso: request.reviewedAtIso || null,
    reviewedByUid: request.reviewedByUid || null,
    status: normalizeRailsRcaTriageStatus(request.status)
  };
}

function normalizeRailsRcaDecisionStatus(status: unknown): RailsRcaDecisionStatus {
  return status === 'Linked' ||
    status === 'Not Required' ||
    status === 'Triage Requested' ||
    status === 'Converted' ||
    status === 'Not Linked'
    ? status
    : 'Not Linked';
}

function normalizeRailsRcaTriageStatus(status: unknown): RailsRcaTriageStatus {
  return status === 'Accepted' || status === 'Rejected' || status === 'Converted' ? status : 'Requested';
}

function getRcaRiskFactorsForRailsPriority(priority: RailsPriority): { detection: number; occurrence: number; severity: number } {
  if (priority === 'Critical') {
    return { detection: 4, occurrence: 4, severity: 5 };
  }

  if (priority === 'High') {
    return { detection: 3, occurrence: 4, severity: 4 };
  }

  if (priority === 'Low') {
    return { detection: 2, occurrence: 2, severity: 2 };
  }

  return { detection: 3, occurrence: 3, severity: 3 };
}

function hasEnterpriseOriginDecision(record: RailsItemRecord): boolean {
  if (record.linkedLswSource?.sourceId && record.linkedLswSource?.sourceType) {
    return true;
  }

  if (record.linkedRcaId) {
    return true;
  }

  const source = normalizeText(record.source, '', 120).toLowerCase();

  return source.length >= 8 && source !== 'manual intake' && source !== 'lsw';
}

function normalizeRailsStatus(status: RailsItemRecord['status']): RailsStatus {
  return status && status !== 'Deleted' && RAILS_STATUSES.has(status) ? status : 'New';
}

function getNextRailsStatus(status: RailsStatus): RailsStatus | null {
  if (status === 'New') {
    return 'Triaged';
  }

  if (status === 'Triaged' || status === 'Reopened') {
    return 'In Progress';
  }

  if (status === 'In Progress') {
    return 'Verification';
  }

  if (status === 'Verification') {
    return 'Approved';
  }

  if (status === 'Approved') {
    return 'Closed';
  }

  if (status === 'Cancelled' || status === 'Archived') {
    return null;
  }

  return null;
}

function isBackwardRailsTransition(currentStatus: RailsStatus, targetStatus: RailsStatus): boolean {
  const order: RailsStatus[] = ['New', 'Triaged', 'In Progress', 'Verification', 'Approved', 'Closed', 'Reopened', 'Cancelled', 'Archived'];

  return order.indexOf(targetStatus) < order.indexOf(currentStatus);
}

function normalizeLifecycleReason(value: string | undefined, action: 'archive' | 'cancel' | 'reopen'): string {
  const reason = normalizeText(value, '', 500);

  if (reason.length < 5) {
    const label = action === 'archive' ? 'archive' : action === 'reopen' ? 'reopen' : 'cancellation';
    throw validationError(`Enter a ${label} reason with at least 5 characters.`);
  }

  return reason;
}

function countCompletedActions(actions: RailsActionRecord[] | undefined): number {
  return (actions || []).filter((action) => action.status === 'Done').length;
}

function getActionsProgressPercent(actions: RailsActionRecord[] | undefined): number {
  const safeActions = actions || [];

  if (!safeActions.length) {
    return 0;
  }

  const totalProgress = safeActions.reduce((total, action) => total + getActionProgressPercent(action), 0);

  return Math.round(totalProgress / safeActions.length);
}

function getActionProgressPercent(action: RailsActionRecord): number {
  if (action.status === 'Done') {
    return 100;
  }

  return clampNumber(action.progressPercent, 0, 99, 0);
}

function applyActionProgressRules(action: RailsActionRecord, progressValue: number | undefined): void {
  if (progressValue === undefined) {
    return;
  }

  const progressPercent = clampNumber(progressValue, 0, 100, 0);
  action.progressPercent = progressPercent;

  if (progressPercent >= 100) {
    action.status = 'Done';
    action.completedAtIso = action.completedAtIso || new Date().toISOString();
    return;
  }

  action.completedAtIso = null;

  if (progressPercent > 0) {
    action.status = 'In Progress';
  } else if (action.status === 'Done' || action.status === 'In Progress') {
    action.status = 'Open';
  }
}

function buildRailsComment(authorUid: string, body: string, createdAtIso: string): RailsComment {
  return {
    authorUid,
    body,
    commentId: `comment_${randomUUID().replace(/-/g, '')}`,
    createdAtIso
  };
}

async function getAccessibleRcaCandidate(
  context: AuthorizedRailsContext,
  incidentId: string
): Promise<RailsRcaLinkCandidate> {
  const snapshot = await context.organizationRef.collection(RCA_INCIDENTS_COLLECTION).doc(incidentId).get();

  if (!snapshot.exists) {
    throw notFoundError('This RCA project was not found.');
  }

  const candidate = mapRcaCandidate(snapshot.id, snapshot.data() as RcaIncidentRecord);

  if (!candidate) {
    throw notFoundError('This RCA project was not found.');
  }

  return candidate;
}

async function getAccessibleLswSource(
  context: AuthorizedRailsContext,
  sourceType: RailsLswSourceType,
  sourceId: string
): Promise<RailsLswSource> {
  const collectionName = getLswSourceCollectionName(sourceType);
  const safeSourceId = safeDocumentId(sourceId);
  const snapshot = await context.organizationRef
    .collection(LSW_PROFILE_COLLECTION)
    .doc(context.uid)
    .collection(collectionName)
    .doc(safeSourceId)
    .get();

  if (!snapshot.exists) {
    throw notFoundError('This LSW source record was not found.');
  }

  const candidate = mapLswSourceCandidate(snapshot.id, sourceType, snapshot.data() || {});

  if (!candidate || candidate.lswId !== context.uid) {
    throw authorizationError('This LSW source is not available in your workspace.');
  }

  return {
    departmentName: candidate.departmentName || context.department.name || null,
    linkedAtIso: new Date().toISOString(),
    linkedByUid: context.uid,
    lswId: context.uid,
    sourceId: candidate.sourceId,
    sourceType: candidate.sourceType,
    sourceTypeLabel: candidate.sourceTypeLabel,
    status: candidate.status,
    title: candidate.title,
    weekKey: candidate.weekKey
  };
}

function getLswSourceCollectionName(sourceType: RailsLswSourceType): string {
  if (sourceType === 'meetingRail') {
    return LSW_MEETING_RAILS_COLLECTION;
  }

  if (sourceType === 'followUp') {
    return LSW_FOLLOW_UPS_COLLECTION;
  }

  if (sourceType === 'rcaTrigger') {
    return LSW_RCA_TRIGGERS_COLLECTION;
  }

  if (sourceType === 'improvementProject') {
    return LSW_IMPROVEMENT_PROJECTS_COLLECTION;
  }

  return LSW_TODO_TASKS_COLLECTION;
}

function getRailsLswDisplay(source: RailsLswSource | null | undefined): string {
  return source ? `${source.sourceTypeLabel}: ${source.title}` : 'Not linked';
}

function mapRcaCandidate(id: string, record: RcaIncidentRecord): RailsRcaLinkCandidate | null {
  if (!record || record.status === 'DELETED') {
    return null;
  }

  return {
    displayId: record.displayId || `RCA-${id.slice(0, 6).toUpperCase()}`,
    id,
    status: record.status || 'OPEN',
    title: record.title || 'Untitled RCA project',
    updatedAtIso: toIso(record.updatedAtIso || record.updatedAt)
  };
}

function mapLswSourceCandidate(
  sourceId: string,
  sourceType: RailsLswSourceType,
  record: FirebaseFirestore.DocumentData
): RailsLswSourceCandidate | null {
  const title = getLswSourceTitle(sourceType, record);

  if (!title) {
    return null;
  }

  const sourceTypeLabel = getLswSourceTypeLabel(sourceType);
  const createdAtIso = toIso(record.createdAtIso || record.createdAt) || null;
  const dueDate = getLswSourceDueDate(sourceType, record);

  return {
    createdAtIso,
    departmentName: typeof record.departmentName === 'string' ? record.departmentName : null,
    displayLabel: `${sourceTypeLabel}: ${title}`,
    dueDate,
    linkedAtIso: new Date().toISOString(),
    linkedByUid: '',
    lswId: typeof record.lswId === 'string' ? record.lswId : '',
    sourceId,
    sourceType,
    sourceTypeLabel,
    status: normalizeText(record.status, 'Open', 40),
    title,
    weekKey: typeof record.weekKey === 'string' ? record.weekKey : null
  };
}

function getLswSourceTitle(sourceType: RailsLswSourceType, record: FirebaseFirestore.DocumentData): string {
  if (sourceType === 'meetingRail') {
    return normalizeText(record.rail, '', 240);
  }

  if (sourceType === 'followUp') {
    return normalizeText(record.followUp, '', 240);
  }

  if (sourceType === 'rcaTrigger') {
    return normalizeText(record.trigger, '', 360);
  }

  if (sourceType === 'improvementProject') {
    return normalizeText(record.project, '', 360);
  }

  return normalizeText(record.task, '', 240);
}

function getLswSourceDueDate(sourceType: RailsLswSourceType, record: FirebaseFirestore.DocumentData): string | null {
  if (sourceType === 'rcaTrigger') {
    return typeof record.eventDate === 'string' ? record.eventDate : null;
  }

  return typeof record.dueDate === 'string' ? record.dueDate : null;
}

function getLswSourceTypeLabel(sourceType: RailsLswSourceType): string {
  if (sourceType === 'meetingRail') {
    return 'Meeting rail';
  }

  if (sourceType === 'followUp') {
    return 'Follow-up';
  }

  if (sourceType === 'rcaTrigger') {
    return 'RCA trigger';
  }

  if (sourceType === 'improvementProject') {
    return 'Improvement project';
  }

  return 'To-do task';
}

async function getRailsUserSummariesByUid(
  context: AuthorizedRailsContext,
  userIds: string[]
): Promise<Map<string, RailsUserSummary>> {
  const usersByUid = new Map<string, RailsUserSummary>();
  const safeUserIds = normalizeUserIds(userIds);

  await Promise.all(safeUserIds.map(async (uid) => {
    const snapshot = await context.organizationRef.collection('users').doc(uid).get();

    if (!snapshot.exists) {
      return;
    }

    const user = snapshot.data() as TenantUserRecord;

    if (user.tenantId !== context.tenantId || user.status !== 'ACTIVE') {
      return;
    }

    usersByUid.set(uid, buildRailsUserSummary(uid, user));
  }));

  return usersByUid;
}

async function getActiveRailsTenantUser(
  context: AuthorizedRailsContext,
  uid: string
): Promise<TenantUserRecord | null> {
  const snapshot = await context.organizationRef.collection('users').doc(safeUserId(uid)).get();

  if (!snapshot.exists) {
    return null;
  }

  const user = snapshot.data() as TenantUserRecord;

  if (user.tenantId !== context.tenantId || user.status !== 'ACTIVE') {
    return null;
  }

  return user;
}

async function assertRailsApproverEligible(context: AuthorizedRailsContext, record: RailsItemRecord): Promise<void> {
  const approverUid = record.approverUid ? safeUserId(record.approverUid) : '';

  if (!approverUid) {
    throw validationError('Assign an approver before approval.');
  }

  if (approverUid === record.ownerUid) {
    throw validationError('The accountable owner cannot approve their own RAILS loop.');
  }

  const approver = await getActiveRailsTenantUser(context, approverUid);

  if (!approver) {
    throw validationError('Select an active company user as the approver.');
  }

  if (!isRailsHighRisk(record)) {
    return;
  }

  const approverRole = normalizeRailsTenantRole(approver.role, approver.roleName);

  if (approverRole !== 'ORG_ADMIN' && approverRole !== 'DEPT_ADMIN' && approverRole !== 'SYSTEM_ADMIN') {
    throw validationError('High-risk RAILS loops require an Org Admin, Department Admin, or System Admin approver.');
  }

  if (
    approverRole === 'DEPT_ADMIN' &&
    record.departmentId &&
    approver.departmentId &&
    approver.departmentId !== record.departmentId
  ) {
    throw validationError('Department Admin approvers can only approve high-risk loops in their own department.');
  }
}

function isRailsHighRisk(record: RailsItemRecord): boolean {
  return (
    record.priority === 'Critical' ||
    record.priority === 'High' ||
    record.category === 'Food Safety' ||
    record.category === 'People Safety' ||
    record.category === 'Quality'
  );
}

function buildRailsUserSummary(uid: string, user: TenantUserRecord): RailsUserSummary {
  const displayName = getDisplayName(user);

  return {
    departmentName: user.departmentName || null,
    displayName,
    initials: getInitials(displayName),
    profilePhotoCacheKey: user.profilePhotoStoragePath ? `rails-profile-photo-${uid}-${user.profilePhotoVersion || 1}` : null,
    profilePhotoUrl: user.profilePhotoStoragePath
      ? `/api/rca/users/${encodeURIComponent(uid)}/photo?v=${encodeURIComponent(String(user.profilePhotoVersion || 1))}`
      : null,
    roleName: formatRoleName(user.roleName, user.role || 'EMPLOYEE'),
    uid
  };
}

function normalizeUserIds(userIds: string[]): string[] {
  return [...new Set(userIds.map(safeUserId).filter(Boolean))];
}

function safeUserId(value: string): string {
  return value.trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128);
}

function safeDocumentId(value: string): string {
  const safeValue = safeUserId(value);

  if (!/^[A-Za-z0-9_-]{8,128}$/.test(safeValue)) {
    throw notFoundError('This RAILS loop was not found.');
  }

  return safeValue;
}

function buildRailsDisplayId(id: string, dateIso: string | FirestoreDateLike): string {
  const year = (toIso(dateIso) || new Date().toISOString()).slice(2, 4);
  const suffix = safeUserId(id).replace(/[^A-Z0-9]/gi, '').slice(0, 5).toUpperCase() || randomUUID().replace(/-/g, '').slice(0, 5).toUpperCase();

  return `RAILS-${year}-${suffix}`;
}

function getDefaultDueDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function getDateOverdueDays(dateIso: string | undefined): number {
  if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return 0;
  }

  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const dueUtc = Date.parse(`${dateIso}T00:00:00.000Z`);
  const diffMs = todayUtc - dueUtc;

  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return 0;
  }

  return Math.floor(diffMs / 86_400_000);
}

function getAgeDays(dateIso: string): number {
  const createdDate = new Date(dateIso);

  if (Number.isNaN(createdDate.getTime())) {
    return 0;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  createdDate.setHours(0, 0, 0, 0);

  return Math.max(0, Math.floor((today.getTime() - createdDate.getTime()) / 86_400_000));
}

function isTerminalRailsStatus(status: RailsStatus): boolean {
  return status === 'Closed' || status === 'Cancelled' || status === 'Archived';
}

function parseRailsGateBlockers(message: string): string[] {
  const [, blockerText = message] = message.split(/:\s+/, 2);

  return blockerText
    .split(/\.\s+/)
    .map((blocker) => blocker.trim())
    .filter(Boolean)
    .map((blocker) => blocker.endsWith('.') ? blocker : `${blocker}.`);
}

function normalizeDate(value: string | undefined, fallback: string): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return fallback;
}

function normalizeText(value: string | undefined, fallback: string, maxLength: number): string {
  const trimmedValue = value?.trim() || fallback;
  return trimmedValue.slice(0, maxLength);
}

function parseEvidenceDataUrl(dataUrl: string): { contentType: string; payload: Buffer } {
  const match = /^data:([A-Za-z0-9.+/-]+);base64,(.+)$/.exec(dataUrl);

  if (!match) {
    throw validationError('Evidence upload must be a base64 data URL.');
  }

  const payload = Buffer.from(match[2], 'base64');

  if (!payload.length) {
    throw validationError('Evidence upload is empty.');
  }

  if (payload.length > MAX_RAILS_EVIDENCE_BYTES) {
    throw validationError('Evidence file is too large. Please choose a file under 4 MB.');
  }

  return {
    contentType: match[1],
    payload
  };
}

function sanitizeFileName(fileName: string): string {
  const safeName = fileName
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 140);

  return safeName || 'rails-evidence';
}

function getEvidenceStoragePath(tenantId: string, itemId: string, evidenceId: string, fileName: string): string {
  return `organizations/${tenantId}/railsItems/${itemId}/evidence/${evidenceId}-${fileName}`;
}

function buildStandardizationDocumentVersion({
  contentType,
  evidenceId,
  fileName,
  itemId,
  nowIso,
  storagePath,
  uploadedByUid,
  versionNumber
}: {
  contentType: string | null;
  evidenceId: string;
  fileName: string;
  itemId: string;
  nowIso: string;
  storagePath: string;
  uploadedByUid: string;
  versionNumber: number;
}): RailsStandardizationDocumentVersion {
  const versionId = `stdv_${randomUUID().replace(/-/g, '')}`;

  return {
    contentType,
    evidenceId,
    fileName,
    fileUrl: `/api/rails/items/${encodeURIComponent(itemId)}/standardization-documents/${encodeURIComponent(versionId)}`,
    storagePath,
    uploadedAtIso: nowIso,
    uploadedByUid,
    versionId,
    versionNumber
  };
}

function buildRailsItemAuditChange(
  beforeRecord: RailsItemRecord,
  afterRecord: RailsItemRecord,
  patch: RailsItemPatch
): { after: Record<string, unknown>; before: Record<string, unknown> } {
  const fields = [
    'approverUid',
    'archiveReason',
    'archivedAtIso',
    'archivedByUid',
    'cancelReason',
    'cancelledAtIso',
    'cancelledByUid',
    'category',
    'dueDate',
    'linkedLsw',
    'linkedLswSource',
    'linkedRca',
    'linkedRcaDecision',
    'linkedRcaId',
    'rcaTriageRequest',
    'ownerUid',
    'priority',
    'problem',
    'reopenReason',
    'reopenedAtIso',
    'reopenedByUid',
    'source',
    'standardization',
    'standardizationDueDate',
    'standardizationOwnerUid',
    'standardizationStatus',
    'standardizationType',
    'standardizationVerifiedAtIso',
    'standardizationVerifiedByUid',
    'standardizationVerification',
    'status',
    'title',
    'verification'
  ] as const;
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  const patchKeys = new Set(Object.keys(patch));

  fields.forEach((field) => {
    const beforeValue = beforeRecord[field];
    const afterValue = afterRecord[field];
    const changed = JSON.stringify(beforeValue ?? null) !== JSON.stringify(afterValue ?? null);

    if (changed || patchKeys.has(field)) {
      before[field] = beforeValue ?? null;
      after[field] = afterValue ?? null;
    }
  });

  return { after, before };
}

function getRailsItemAuditEventType(patch: RailsItemPatch): RailsAuditEventType {
  if (patch.linkedLswSourceId !== undefined || patch.linkedLswSourceType !== undefined) {
    return 'RAILS_LSW_LINKED';
  }

  if (patch.linkedRca !== undefined || patch.linkedRcaId !== undefined || patch.linkedRcaDecisionReason !== undefined) {
    return 'RAILS_RCA_DECISION_UPDATED';
  }

  if (patch.status === 'Archived') {
    return 'RAILS_ARCHIVED';
  }

  if (patch.status === 'Cancelled') {
    return 'RAILS_CANCELLED';
  }

  if (patch.status === 'Reopened') {
    return 'RAILS_REOPENED';
  }

  if (patch.status) {
    return 'RAILS_STATUS_CHANGED';
  }

  if (patch.standardizationStatus === 'Verified') {
    return 'RAILS_STANDARDIZATION_VERIFIED';
  }

  if (
    patch.standardization !== undefined ||
    patch.standardizationDueDate !== undefined ||
    patch.standardizationOwnerUid !== undefined ||
    patch.standardizationStatus !== undefined ||
    patch.standardizationType !== undefined ||
    patch.standardizationVerification !== undefined
  ) {
    return 'RAILS_STANDARDIZATION_UPDATED';
  }

  return 'RAILS_UPDATED';
}

function buildRailsItemUpdateSummary(
  beforeRecord: RailsItemRecord,
  afterRecord: RailsItemRecord,
  patch: RailsItemPatch
): string {
  const displayId = afterRecord.displayId || beforeRecord.displayId || 'RAILS loop';

  if (patch.status) {
    return `Changed ${displayId} status from ${beforeRecord.status || 'New'} to ${afterRecord.status || patch.status}.`;
  }

  if (patch.linkedLswSourceId !== undefined || patch.linkedLswSourceType !== undefined) {
    return afterRecord.linkedLswSource
      ? `Linked ${displayId} to LSW source ${afterRecord.linkedLsw}.`
      : `Removed LSW source link from ${displayId}.`;
  }

  if (patch.standardizationStatus === 'Verified') {
    return `Verified standardization plan for ${displayId}.`;
  }

  if (
    patch.standardization !== undefined ||
    patch.standardizationDueDate !== undefined ||
    patch.standardizationOwnerUid !== undefined ||
    patch.standardizationStatus !== undefined ||
    patch.standardizationType !== undefined ||
    patch.standardizationVerification !== undefined
  ) {
    const changedFields = buildRailsItemAuditChange(beforeRecord, afterRecord, patch);
    const fieldNames = Object.keys(changedFields.after)
      .map(formatRailsAuditFieldName)
      .slice(0, 4)
      .join(', ');

    return fieldNames
      ? `Updated standardization plan for ${displayId}: ${fieldNames}.`
      : `Updated standardization plan for ${displayId}.`;
  }

  const changedFields = buildRailsItemAuditChange(beforeRecord, afterRecord, patch);
  const fieldNames = Object.keys(changedFields.after)
    .map(formatRailsAuditFieldName)
    .slice(0, 4)
    .join(', ');

  return fieldNames ? `Updated ${displayId}: ${fieldNames}.` : `Updated ${displayId}.`;
}

function buildRailsActionUpdateSummary(
  beforeAction: RailsActionRecord,
  afterAction: RailsActionRecord,
  patch: RailsActionPatch
): string {
  if (patch.progressPercent !== undefined && beforeAction.progressPercent !== afterAction.progressPercent) {
    return `Updated action "${afterAction.title}" progress from ${getActionProgressPercent(beforeAction)}% to ${getActionProgressPercent(afterAction)}%.`;
  }

  const changedFields = buildRailsActionAuditChange(beforeAction, afterAction, patch);
  const fieldNames = Object.keys(changedFields.after)
    .map(formatRailsAuditFieldName)
    .slice(0, 4)
    .join(', ');

  return fieldNames
    ? `Updated action "${afterAction.title}": ${fieldNames}.`
    : `Updated action "${afterAction.title}".`;
}

function buildRailsActionEvidenceLinkChange(
  beforeAction: RailsActionRecord,
  afterAction: RailsActionRecord,
  evidence: RailsEvidence[]
): {
  eventType: Extract<RailsAuditEventType, 'RAILS_EVIDENCE_LINKED' | 'RAILS_EVIDENCE_UNLINKED' | 'RAILS_ACTION_UPDATED'>;
  linked: RailsEvidence[];
  summary: string;
  unlinked: RailsEvidence[];
} | null {
  const beforeIds = new Set(normalizeMappedActionEvidenceIds(beforeAction.evidenceIds));
  const afterIds = new Set(normalizeMappedActionEvidenceIds(afterAction.evidenceIds));
  const linkedIds = Array.from(afterIds).filter((evidenceId) => !beforeIds.has(evidenceId));
  const unlinkedIds = Array.from(beforeIds).filter((evidenceId) => !afterIds.has(evidenceId));

  if (!linkedIds.length && !unlinkedIds.length) {
    return null;
  }

  const evidenceById = new Map(evidence.map((entry) => [safeUserId(entry.evidenceId), entry]));
  const linked = linkedIds.map((evidenceId) => evidenceById.get(evidenceId)).filter(Boolean) as RailsEvidence[];
  const unlinked = unlinkedIds.map((evidenceId) => evidenceById.get(evidenceId)).filter(Boolean) as RailsEvidence[];
  const linkedText = linked.map((entry) => `"${entry.label}"`).join(', ');
  const unlinkedText = unlinked.map((entry) => `"${entry.label}"`).join(', ');
  const actionTitle = afterAction.title || beforeAction.title || 'Untitled action';

  if (linked.length && !unlinked.length) {
    return {
      eventType: 'RAILS_EVIDENCE_LINKED',
      linked,
      summary: `Linked evidence ${linkedText} to action "${actionTitle}".`,
      unlinked
    };
  }

  if (unlinked.length && !linked.length) {
    return {
      eventType: 'RAILS_EVIDENCE_UNLINKED',
      linked,
      summary: `Unlinked evidence ${unlinkedText} from action "${actionTitle}".`,
      unlinked
    };
  }

  return {
    eventType: 'RAILS_ACTION_UPDATED',
    linked,
    summary: `Updated evidence links for action "${actionTitle}": linked ${linkedText || 'none'}, unlinked ${unlinkedText || 'none'}.`,
    unlinked
  };
}

function buildRailsEvidenceUpdateSummary(beforeEvidence: RailsEvidence | null, afterEvidence: RailsEvidence): string {
  if (!beforeEvidence) {
    return `Added evidence: ${afterEvidence.label}.`;
  }

  const changedFields = getRailsEvidenceChangedFields(beforeEvidence, afterEvidence);
  if (changedFields.includes('sourceEvidenceId')) {
    return afterEvidence.sourceEvidenceId
      ? `Linked Evidence Library item to required verification evidence "${afterEvidence.label}".`
      : `Unlinked Evidence Library item from required verification evidence "${afterEvidence.label}".`;
  }

  if (changedFields.includes('label')) {
    return `Renamed evidence from "${beforeEvidence.label}" to "${afterEvidence.label}".`;
  }

  if (changedFields.includes('visibility')) {
    return `Changed evidence visibility for "${afterEvidence.label}" from ${beforeEvidence.visibility || 'public'} to ${afterEvidence.visibility || 'public'}.`;
  }

  if (changedFields.includes('fileName') || changedFields.includes('contentType') || changedFields.includes('fileSizeBytes')) {
    return `Replaced evidence file for "${afterEvidence.label}".`;
  }

  const fieldNames = changedFields.map(formatRailsAuditFieldName).slice(0, 4).join(', ');
  return fieldNames ? `Updated evidence "${afterEvidence.label}": ${fieldNames}.` : `Updated evidence "${afterEvidence.label}".`;
}

function getRailsEvidenceChangedFields(beforeEvidence: RailsEvidence, afterEvidence: RailsEvidence): string[] {
  return ([
    'contentType',
    'fileName',
    'fileSizeBytes',
    'label',
    'note',
    'purpose',
    'sourceEvidenceId',
    'status',
    'visibility'
  ] as const).filter((field) => beforeEvidence[field] !== afterEvidence[field]);
}

function buildRailsActionAuditChange(
  beforeAction: RailsActionRecord,
  afterAction: RailsActionRecord,
  patch: RailsActionPatch
): { after: Record<string, unknown>; before: Record<string, unknown> } {
  const fields = [
    'completedAtCorrectionReason',
    'completedAtIso',
    'completedByExternalName',
    'completedByUid',
    'containmentNote',
    'dueDate',
    'effectivenessCriteria',
    'effectivenessResult',
    'evidenceIds',
    'implementationNote',
    'ownerUid',
    'progressPercent',
    'riskControlled',
    'startedAtCorrectionReason',
    'startedAtIso',
    'startedByUid',
    'status',
    'standardizationNote',
    'title',
    'verificationNote',
    'verifiedAtIso',
    'verifiedByUid'
  ] as const;
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  const patchKeys = new Set(Object.keys(patch));

  fields.forEach((field) => {
    const beforeValue = beforeAction[field];
    const afterValue = afterAction[field];
    const changed = JSON.stringify(beforeValue ?? null) !== JSON.stringify(afterValue ?? null);

    if (changed || patchKeys.has(field)) {
      before[field] = beforeValue ?? null;
      after[field] = afterValue ?? null;
    }
  });

  return { after, before };
}

function formatRailsAuditFieldName(field: string): string {
  const labels: Record<string, string> = {
    approverUid: 'approver',
    category: 'category',
    completedAtIso: 'completion timestamp',
    completedByExternalName: 'external completed by',
    completedByUid: 'completed by',
    containmentNote: 'containment documentation',
    dueDate: 'due date',
    effectivenessCriteria: 'acceptance criteria',
    effectivenessResult: 'effectiveness result',
    evidenceIds: 'linked evidence',
    implementationNote: 'implementation note',
    linkedLsw: 'linked LSW',
    linkedLswSource: 'linked LSW source',
    linkedRca: 'linked RCA',
    linkedRcaDecision: 'RCA decision',
    linkedRcaId: 'RCA project',
    ownerUid: 'owner',
    priority: 'priority',
    problem: 'problem',
    progressPercent: 'progress',
    rcaTriageRequest: 'RCA triage request',
    riskControlled: 'risk control',
    source: 'source',
    standardization: 'standardization target',
    standardizationDueDate: 'standardization due date',
    standardizationOwnerUid: 'standardization owner',
    standardizationStatus: 'standardization status',
    standardizationType: 'standardization type',
    standardizationVerification: 'standardization verification',
    startedAtIso: 'started timestamp',
    startedByUid: 'started by',
    status: 'status',
    title: 'title',
    verification: 'verification',
    verificationNote: 'verification note',
    verifiedAtIso: 'verified timestamp',
    verifiedByUid: 'verified by'
  };

  return labels[field] || field.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

async function writeRailsAuditEvent({
  after,
  before,
  context,
  itemId,
  itemRef,
  metadata,
  reason,
  summary,
  type
}: {
  after?: Record<string, unknown> | null;
  before?: Record<string, unknown> | null;
  context: AuthorizedRailsContext;
  itemId: string;
  itemRef: FirebaseFirestore.DocumentReference;
  metadata?: Record<string, unknown>;
  reason?: string | null;
  summary: string;
  type: RailsAuditEventType;
}): Promise<void> {
  const eventId = `rails_evt_${randomUUID().replace(/-/g, '')}`;
  const nowIso = new Date().toISOString();
  const event = stripUndefinedAuditValues({
    actorDisplayName: getDisplayName(context.user),
    actorRole: context.role,
    actorUid: context.uid,
    after: after || null,
    before: before || null,
    createdAt: fieldValue.serverTimestamp(),
    createdAtIso: nowIso,
    eventId,
    itemId,
    metadata: metadata || {},
    reason: reason || null,
    summary,
    tenantId: context.tenantId,
    type
  });

  await Promise.all([
    context.organizationRef.collection(RAILS_AUDIT_EVENTS_COLLECTION).doc(eventId).set(event),
    itemRef.collection(RAILS_ITEM_ACTIVITY_COLLECTION).doc(eventId).set(event)
  ]);
}

async function writeRailsTenantAuditEvent({
  context,
  metadata,
  reason,
  summary,
  type
}: {
  context: AuthorizedRailsContext;
  metadata?: Record<string, unknown>;
  reason?: string | null;
  summary: string;
  type: RailsAuditEventType;
}): Promise<void> {
  const eventId = `rails_evt_${randomUUID().replace(/-/g, '')}`;
  const nowIso = new Date().toISOString();
  const event = stripUndefinedAuditValues({
    actorDisplayName: getDisplayName(context.user),
    actorRole: context.role,
    actorUid: context.uid,
    createdAt: fieldValue.serverTimestamp(),
    createdAtIso: nowIso,
    eventId,
    itemId: null,
    metadata: metadata || {},
    reason: reason || null,
    summary,
    tenantId: context.tenantId,
    type
  });

  await context.organizationRef.collection(RAILS_AUDIT_EVENTS_COLLECTION).doc(eventId).set(event);
}

async function queueRailsWorkflowNotifications(
  context: AuthorizedRailsContext,
  itemId: string,
  beforeRecord: RailsItemRecord,
  afterRecord: RailsItemRecord,
  patch: RailsItemPatch
): Promise<void> {
  const displayId = afterRecord.displayId || beforeRecord.displayId || 'RAILS loop';

  if (patch.ownerUid && afterRecord.ownerUid && afterRecord.ownerUid !== beforeRecord.ownerUid) {
    await queueRailsNotification({
      context,
      itemId,
      message: `${displayId} was assigned to you.`,
      metadata: { ownerUid: afterRecord.ownerUid },
      recipientUids: [afterRecord.ownerUid],
      type: 'RAILS_LOOP_ASSIGNED'
    });
  }

  if (patch.approverUid !== undefined && afterRecord.approverUid && afterRecord.approverUid !== beforeRecord.approverUid) {
    await queueRailsNotification({
      context,
      itemId,
      message: `${displayId} needs your approval.`,
      metadata: { approverUid: afterRecord.approverUid },
      recipientUids: [afterRecord.approverUid],
      type: 'RAILS_APPROVER_REQUESTED'
    });
  }

  if (patch.standardizationOwnerUid !== undefined && afterRecord.standardizationOwnerUid && afterRecord.standardizationOwnerUid !== beforeRecord.standardizationOwnerUid) {
    await queueRailsNotification({
      context,
      itemId,
      message: `${displayId} has a standardization plan assigned to you.`,
      metadata: { standardizationOwnerUid: afterRecord.standardizationOwnerUid },
      recipientUids: [afterRecord.standardizationOwnerUid],
      type: 'RAILS_STANDARDIZATION_VERIFICATION_REQUESTED'
    });
  }

  if (patch.status === 'Closed') {
    await queueRailsNotification({
      context,
      itemId,
      message: `${displayId} was closed.`,
      metadata: { status: 'Closed' },
      recipientUids: [afterRecord.ownerUid || '', afterRecord.approverUid || '', ...(afterRecord.contributorUids || [])],
      type: 'RAILS_LOOP_CLOSED'
    });
  }

  if (patch.status === 'Reopened') {
    await queueRailsNotification({
      context,
      itemId,
      message: `${displayId} was reopened.`,
      metadata: { reason: afterRecord.reopenReason || '' },
      recipientUids: [afterRecord.ownerUid || '', afterRecord.approverUid || '', ...(afterRecord.contributorUids || [])],
      type: 'RAILS_LOOP_REOPENED'
    });
  }
}

async function queueRailsNotification({
  context,
  itemId,
  message,
  metadata,
  recipientUids,
  type
}: {
  context: AuthorizedRailsContext;
  itemId?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
  recipientUids: string[];
  type: RailsNotificationType;
}): Promise<void> {
  const recipients = normalizeUserIds(recipientUids).filter((uid) => uid !== context.uid);

  if (!recipients.length) {
    return;
  }

  const notificationId = `rails_note_${randomUUID().replace(/-/g, '')}`;
  const nowIso = new Date().toISOString();
  const notificationRef = context.organizationRef.collection(RAILS_NOTIFICATIONS_COLLECTION).doc(notificationId);

  await notificationRef.set(stripUndefinedAuditValues({
    actorDisplayName: getDisplayName(context.user),
    actorUid: context.uid,
    createdAt: fieldValue.serverTimestamp(),
    createdAtIso: nowIso,
    itemId: itemId || null,
    message,
    metadata: metadata || {},
    notificationId,
    recipientUids: recipients,
    status: 'Queued',
    tenantId: context.tenantId,
    type
  }));

  try {
    await sendRailsPushNotification({
      actorUid: context.uid,
      body: message,
      itemId: itemId || null,
      metadata: {
        notificationId,
        railsNotificationType: type
      },
      notificationId,
      recipientUids: recipients,
      tenantId: context.tenantId,
      title: 'RAILS update',
      type
    });
    await notificationRef.set({
      deliveredAtIso: new Date().toISOString(),
      deliveryStatus: 'Submitted',
      status: 'Submitted',
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });
  } catch (error) {
    await notificationRef.set({
      deliveryError: error instanceof Error ? error.message : 'RAILS notification delivery failed.',
      deliveryStatus: 'Failed',
      status: 'Delivery Failed',
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });
  }
}

function stripUndefinedAuditValues<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefinedAuditValues(entry)) as T;
  }

  if (value && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, stripUndefinedAuditValues(entry)])
    ) as T;
  }

  return value;
}

function getUpdatedAtMs(record: RailsItemRecord): number {
  const updatedAtIso = toIso(record.updatedAtIso || record.updatedAt);
  const updatedAtMs = updatedAtIso ? Date.parse(updatedAtIso) : 0;

  return Number.isFinite(updatedAtMs) ? updatedAtMs : 0;
}

function toIso(value: FirestoreDateLike): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }

  if (typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000).toISOString();
  }

  return null;
}

function clampNumber(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

function getDisplayName(user: TenantUserRecord): string {
  if (user.displayName?.trim()) {
    return user.displayName.trim();
  }

  const name = [user.firstName, user.lastName]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(' ')
    .trim();

  return name || 'Synzapp user';
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'SU';
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

function normalizeRailsTenantRole(role: SynzappRole | undefined, roleName?: string): SynzappRole {
  if (role === 'ORG_ADMIN' || role === 'DEPT_ADMIN' || role === 'SYSTEM_ADMIN' || role === 'EMPLOYEE') {
    return role;
  }

  const normalizedRoleName = (roleName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');

  if (
    normalizedRoleName === 'organization admin' ||
    normalizedRoleName === 'org admin' ||
    normalizedRoleName === 'tenant admin'
  ) {
    return 'ORG_ADMIN';
  }

  if (normalizedRoleName === 'department admin' || normalizedRoleName === 'dept admin') {
    return 'DEPT_ADMIN';
  }

  if (normalizedRoleName === 'system admin') {
    return 'SYSTEM_ADMIN';
  }

  return 'EMPLOYEE';
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
