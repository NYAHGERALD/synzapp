import { getSynzappApiBaseUrl } from './config';
import {
  getAppCheckHeader,
  getSynzappFirebaseAuth
} from './firebase';

export type RailsStatus = 'New' | 'Triaged' | 'In Progress' | 'Verification' | 'Approved' | 'Closed' | 'Reopened' | 'Cancelled' | 'Archived';
export type RailsPriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type RailsCategory = 'Food Safety' | 'People Safety' | 'Quality' | 'Delivery' | 'Cost' | 'Process';
export type RailsStandardizationStatus = 'Not Started' | 'In Progress' | 'Implemented' | 'Verified';
export type RailsStandardizationType = 'SOP' | 'Checklist' | 'LSW Audit' | 'Training' | 'PM Task' | 'Visual Control' | 'Work Instruction' | 'Other';
export type RailsLswSourceType = 'todoTask' | 'meetingRail' | 'followUp' | 'rcaTrigger' | 'improvementProject';
export type RailsRcaDecisionStatus = 'Linked' | 'Not Required' | 'Triage Requested' | 'Converted' | 'Not Linked';
export type RailsRcaTriageStatus = 'Requested' | 'Accepted' | 'Rejected' | 'Converted';

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
    role: string;
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
  type: string;
}

export interface RailsEvidence {
  contentType?: string | null;
  fileSizeBytes?: number | null;
  fileName?: string | null;
  fileUrl?: string | null;
  evidenceId: string;
  label: string;
  note?: string;
  purpose?: 'general' | 'standardization';
  status: 'Attached' | 'Required' | 'Review';
  sourceEvidenceId?: string | null;
  uploadedAtIso?: string | null;
  uploadedByUid?: string | null;
  visibility?: 'public' | 'private';
}

export interface RailsLswSource {
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
  displayLabel: string;
  dueDate: string | null;
}

export interface RailsRcaDecision {
  decidedAtIso: string;
  decidedByUid: string;
  reason: string;
  status: RailsRcaDecisionStatus;
}

export interface RailsRcaTriageRequest {
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

export interface RailsStandardizationDocumentVersion {
  contentType: string | null;
  evidenceId: string;
  fileName: string;
  fileUrl: string;
  uploadedAtIso: string;
  uploadedByUid: string;
  uploaderName?: string | null;
  versionId: string;
  versionNumber: number;
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

export interface RailsWorkspaceResponse {
  candidates: RailsUserSummary[];
  context: RailsWorkspaceContext;
  items: RailsItem[];
  lswCandidates?: RailsLswSourceCandidate[];
  rcaCandidates?: RailsRcaLinkCandidate[];
  summary: {
    criticalItems: number;
    escalatedItems: number;
    openItems: number;
    overdueItems: number;
    verificationItems: number;
  };
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
  purpose?: RailsEvidence['purpose'];
  sourceEvidenceId?: string | null;
  status?: RailsEvidence['status'];
  visibility?: RailsEvidence['visibility'];
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

export interface RailsReportBreakdownEntry {
  label: string;
  value: number;
}

export interface RailsReportResponse {
  agingBuckets: RailsReportBreakdownEntry[];
  averageAgeDays: number;
  byCategory: RailsReportBreakdownEntry[];
  byDepartment: RailsReportBreakdownEntry[];
  byOwner: RailsReportBreakdownEntry[];
  byPriority: RailsReportBreakdownEntry[];
  byStatus: RailsReportBreakdownEntry[];
  generatedAtIso: string;
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
}

export interface RailsCsvExport {
  blob: Blob;
  fileName: string;
}

export interface RailsKnowledgeAnswer {
  answer: string;
  model: string;
  source: 'AI' | 'SYSTEM_GUIDE';
}

export async function getRailsWorkspace(): Promise<RailsWorkspaceResponse> {
  return requestRailsJson<RailsWorkspaceResponse>('/api/rails/workspace');
}

export async function askRailsKnowledge(question: string, itemId?: string): Promise<RailsKnowledgeAnswer> {
  return requestRailsJson<RailsKnowledgeAnswer>('/api/rails/knowledge/ask', {
    body: JSON.stringify(stripUndefinedValues({ itemId, question })),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST'
  });
}

export async function getRailsReport(): Promise<RailsReportResponse> {
  const body = await requestRailsJson<{ report?: RailsReportResponse }>('/api/rails/report');

  if (!body.report) {
    throw new Error('The RAILS report could not be loaded.');
  }

  return body.report;
}

export async function getRailsHistory(query: RailsHistoryQuery = {}): Promise<RailsHistoryResponse> {
  return requestRailsJson<RailsHistoryResponse>(`/api/rails/history${buildRailsQueryString(query)}`);
}

export async function exportRailsCsv(query: RailsHistoryQuery = {}): Promise<RailsCsvExport> {
  return requestRailsDownload(`/api/rails/export${buildRailsQueryString(query)}`, 'synzapp-rails-export.csv');
}

export async function exportRailsJson(query: RailsHistoryQuery = {}): Promise<RailsCsvExport> {
  return requestRailsDownload(`/api/rails/export/json${buildRailsQueryString(query)}`, 'synzapp-rails-export.json');
}

export async function createRailsItem(input: RailsItemInput): Promise<RailsItem> {
  const body = await requestRailsJson<{ item?: RailsItem }>('/api/rails/items', {
    body: JSON.stringify(stripUndefinedValues(input)),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST'
  });

  if (!body.item) {
    throw new Error('The RAILS loop could not be created.');
  }

  return body.item;
}

export async function updateRailsItem(itemId: string, patch: RailsItemPatch): Promise<RailsItem> {
  const body = await requestRailsJson<{ item?: RailsItem }>(`/api/rails/items/${encodeURIComponent(itemId)}`, {
    body: JSON.stringify(stripUndefinedValues(patch)),
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH'
  });

  if (!body.item) {
    throw new Error('The RAILS loop could not be updated.');
  }

  return body.item;
}

export async function requestRailsRcaTriage(itemId: string, input: RailsRcaTriageRequestInput = {}): Promise<RailsItem> {
  const body = await requestRailsJson<{ item?: RailsItem }>(`/api/rails/items/${encodeURIComponent(itemId)}/rca-triage-request`, {
    body: JSON.stringify(stripUndefinedValues(input)),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST'
  });

  return requireRailsItem(body);
}

export async function updateRailsRcaTriageRequest(itemId: string, input: RailsRcaTriageReviewInput = {}): Promise<RailsItem> {
  const body = await requestRailsJson<{ item?: RailsItem }>(`/api/rails/items/${encodeURIComponent(itemId)}/rca-triage-request`, {
    body: JSON.stringify(stripUndefinedValues(input)),
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH'
  });

  return requireRailsItem(body);
}

export async function convertRailsRcaTriageToIncident(itemId: string): Promise<RailsItem> {
  const body = await requestRailsJson<{ item?: RailsItem }>(`/api/rails/items/${encodeURIComponent(itemId)}/rca-triage-request/convert`, {
    method: 'POST'
  });

  return requireRailsItem(body);
}

export async function bulkUpdateRailsItems(
  itemIds: string[],
  patch: RailsItemPatch,
  collaboratorUid?: string
): Promise<RailsBulkUpdateResult> {
  return requestRailsJson<RailsBulkUpdateResult>('/api/rails/items/bulk-update', {
    body: JSON.stringify(stripUndefinedValues({ collaboratorUid, itemIds, patch: stripUndefinedValues(patch) })),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST'
  });
}

export async function addRailsCollaborator(itemId: string, userId: string): Promise<RailsItem> {
  const body = await requestRailsJson<{ item?: RailsItem }>(`/api/rails/items/${encodeURIComponent(itemId)}/collaborators`, {
    body: JSON.stringify({ userId }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST'
  });

  return requireRailsItem(body);
}

export async function removeRailsCollaborator(itemId: string, userId: string): Promise<RailsItem> {
  const body = await requestRailsJson<{ item?: RailsItem }>(
    `/api/rails/items/${encodeURIComponent(itemId)}/collaborators/${encodeURIComponent(userId)}`,
    { method: 'DELETE' }
  );

  return requireRailsItem(body);
}

export async function addRailsAction(itemId: string, input: RailsActionInput): Promise<RailsItem> {
  const body = await requestRailsJson<{ item?: RailsItem }>(`/api/rails/items/${encodeURIComponent(itemId)}/actions`, {
    body: JSON.stringify(stripUndefinedValues(input)),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST'
  });

  return requireRailsItem(body);
}

export async function updateRailsAction(itemId: string, actionId: string, patch: RailsActionPatch): Promise<RailsItem> {
  const body = await requestRailsJson<{ item?: RailsItem }>(
    `/api/rails/items/${encodeURIComponent(itemId)}/actions/${encodeURIComponent(actionId)}`,
    {
      body: JSON.stringify(stripUndefinedValues(patch)),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH'
    }
  );

  return requireRailsItem(body);
}

export async function reorderRailsAction(itemId: string, actionId: string, direction: 'up' | 'down'): Promise<RailsItem> {
  const body = await requestRailsJson<{ item?: RailsItem }>(
    `/api/rails/items/${encodeURIComponent(itemId)}/actions/${encodeURIComponent(actionId)}/reorder`,
    {
      body: JSON.stringify({ direction }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST'
    }
  );

  return requireRailsItem(body);
}

export async function deleteRailsAction(itemId: string, actionId: string): Promise<RailsItem> {
  const body = await requestRailsJson<{ item?: RailsItem }>(
    `/api/rails/items/${encodeURIComponent(itemId)}/actions/${encodeURIComponent(actionId)}`,
    { method: 'DELETE' }
  );

  return requireRailsItem(body);
}

export async function addRailsEvidence(itemId: string, input: RailsEvidenceInput): Promise<RailsItem> {
  const body = await requestRailsJson<{ item?: RailsItem }>(`/api/rails/items/${encodeURIComponent(itemId)}/evidence`, {
    body: JSON.stringify(stripUndefinedValues(input)),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST'
  });

  return requireRailsItem(body);
}

export async function deleteRailsEvidence(itemId: string, evidenceId: string): Promise<RailsItem> {
  const body = await requestRailsJson<{ item?: RailsItem }>(
    `/api/rails/items/${encodeURIComponent(itemId)}/evidence/${encodeURIComponent(evidenceId)}`,
    { method: 'DELETE' }
  );

  return requireRailsItem(body);
}

export async function addRailsComment(itemId: string, bodyText: string): Promise<RailsItem> {
  const body = await requestRailsJson<{ item?: RailsItem }>(`/api/rails/items/${encodeURIComponent(itemId)}/comments`, {
    body: JSON.stringify({ body: bodyText }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST'
  });

  return requireRailsItem(body);
}

export async function getRailsItemActivity(itemId: string): Promise<RailsAuditActivity[]> {
  const body = await requestRailsJson<{ activity?: RailsAuditActivity[] }>(`/api/rails/items/${encodeURIComponent(itemId)}/activity`);

  return body.activity || [];
}

export async function listRailsRcaCandidates(): Promise<RailsRcaLinkCandidate[]> {
  const body = await requestRailsJson<{ rcaCandidates?: RailsRcaLinkCandidate[] }>('/api/rails/rca-candidates');

  return body.rcaCandidates || [];
}

export async function listRailsLswCandidates(): Promise<RailsLswSourceCandidate[]> {
  const body = await requestRailsJson<{ lswCandidates?: RailsLswSourceCandidate[] }>('/api/rails/lsw-candidates');

  return body.lswCandidates || [];
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Evidence file could not be read.'));
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Evidence file could not be read.'));
    };
    reader.readAsDataURL(file);
  });
}

export async function downloadRailsEvidenceBlob(path: string): Promise<Blob> {
  return requestRailsBlob(normalizeApiPath(path));
}

export async function getRailsAuthenticatedObjectUrl(pathOrUrl: string): Promise<string> {
  const blob = await requestRailsBlob(normalizeApiPath(pathOrUrl));

  return URL.createObjectURL(blob);
}

async function requestRailsJson<T>(
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
      throw new Error('The RAILS workspace took too long to load. Please try again.');
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'The RAILS workspace could not be loaded.'));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function requestRailsBlob(path: string): Promise<Blob> {
  const user = getSynzappFirebaseAuth().currentUser;

  if (!user) {
    throw new Error('You are not signed in.');
  }

  const idToken = await user.getIdToken();
  const response = await fetch(`${getSynzappApiBaseUrl()}${path}`, {
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...await getAppCheckHeader()
    }
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'RAILS evidence could not be loaded.'));
  }

  return response.blob();
}

async function requestRailsDownload(path: string, fallbackFileName: string): Promise<RailsCsvExport> {
  const user = getSynzappFirebaseAuth().currentUser;

  if (!user) {
    throw new Error('You are not signed in.');
  }

  const idToken = await user.getIdToken();
  const response = await fetch(`${getSynzappApiBaseUrl()}${path}`, {
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...await getAppCheckHeader()
    }
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'The RAILS export could not be created.'));
  }

  return {
    blob: await response.blob(),
    fileName: getFileNameFromDisposition(response.headers.get('Content-Disposition')) || fallbackFileName
  };
}

function buildRailsQueryString(query: RailsHistoryQuery): string {
  const searchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : '';
}

function getFileNameFromDisposition(disposition: string | null): string | null {
  const match = /filename="?([^";]+)"?/i.exec(disposition || '');
  return match ? decodeURIComponent(match[1]) : null;
}

function normalizeApiPath(pathOrUrl: string): string {
  if (!/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  }

  const apiBaseUrl = getSynzappApiBaseUrl();

  if (!pathOrUrl.startsWith(apiBaseUrl)) {
    throw new Error('RAILS evidence is not available from this workspace.');
  }

  return pathOrUrl.slice(apiBaseUrl.length) || '/';
}

function requireRailsItem(body: { item?: RailsItem }): RailsItem {
  if (!body.item) {
    throw new Error('The RAILS loop could not be updated.');
  }

  return body.item;
}

function stripUndefinedValues<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedValues(item)) as T;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, stripUndefinedValues(entryValue)])
  ) as T;
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
