import { getSynzappApiBaseUrl } from './config';
import { getAppCheckHeader, getSynzappFirebaseAuth } from './firebase';

/**
 * The compliance console's data.
 *
 * Talks to `/api/compliance`, which is its own backend router rather than part
 * of the mobile app's — that one requires a registered device on every route,
 * and a browser has none.
 *
 * Several actions here can fail with a 401 that does not mean "signed out". It
 * means "verify your phone again": approving a deletion, releasing a hold and
 * activating a policy all require a phone verification from the last few
 * minutes, because each of them can destroy records irreversibly. The console
 * has to tell those two cases apart, so this module surfaces it as a typed flag
 * rather than a generic failure.
 */

export type RetentionAction = 'delete' | 'retain' | 'retain_then_delete';
export type RetentionScopeKind = 'conversation' | 'organization' | 'user';
export type RetentionPolicyState = 'ACTIVE' | 'DISABLED' | 'SIMULATION';
export type DispositionState = 'APPROVED' | 'EXTENDED' | 'PENDING' | 'PURGED' | 'WITHHELD';

export interface RetentionPolicy {
  action: RetentionAction;
  anchor: 'created' | 'last_modified';
  contentTypes: string[];
  createdAtMs: number;
  durationDays: number;
  id: string;
  name: string;
  policyKey: string;
  scopeKind: RetentionScopeKind;
  scopeTargets: string[];
  state: RetentionPolicyState;
  version: number;
}

export interface LegalHoldSummary {
  appliedAtMs: number;
  caseId: string;
  custodianUids: string[];
  delayUntilMs?: number | null;
  description: string;
  id: string;
  releasedAtMs?: number | null;
}

export interface DispositionItem {
  approvedByUid?: string | null;
  eligibleAtMs: number;
  id: string;
  itemCount: number;
  label: string;
  purgeByMs: number;
  state: DispositionState;
  subjectRef: string;
  withheldByHoldId?: string | null;
}

export interface ComplianceOverview {
  dispositionQueue: DispositionItem[];
  holds: LegalHoldSummary[];
  policies: RetentionPolicy[];
  /** The published number of days from expiry to destruction. */
  slaDays: number;
}

/** A failure that needs the admin to verify their phone again, not to sign in. */
export class PhoneVerificationRequiredError extends Error {
  readonly needsPhoneVerification = true;

  constructor(message: string) {
    super(message);
    this.name = 'PhoneVerificationRequiredError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const user = getSynzappFirebaseAuth().currentUser;

  if (!user) {
    throw new Error('You are not signed in.');
  }

  const idToken = await user.getIdToken();
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/compliance${path}`, {
    cache: 'no-store',
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      ...await getAppCheckHeader(),
      ...(init.headers || {})
    }
  });

  if (response.ok) {
    return response.status === 204 ? (undefined as T) : await response.json() as T;
  }

  const message = await getResponseErrorMessage(response);

  // The backend uses 401 for both "no session" and "your phone verification is
  // stale". Only the second is recoverable without signing out, so the console
  // needs to know which it got.
  if (response.status === 401 && /verify your phone/i.test(message)) {
    throw new PhoneVerificationRequiredError(message);
  }

  throw new Error(message);
}

async function getResponseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: string; message?: string };

    return body.error || body.message || `Request failed (${response.status}).`;
  } catch {
    return `Request failed (${response.status}).`;
  }
}

export function loadComplianceOverview(): Promise<ComplianceOverview> {
  return request<ComplianceOverview>('/retention');
}

export function saveRetentionPolicy(input: {
  action: RetentionAction;
  anchor?: 'created' | 'last_modified';
  contentTypes?: string[];
  durationDays: number;
  name: string;
  policyKey?: string;
  scopeKind: RetentionScopeKind;
  scopeTargets?: string[];
}): Promise<{ policy: RetentionPolicy }> {
  return request<{ policy: RetentionPolicy }>('/retention/policies', {
    body: JSON.stringify(input),
    method: 'POST'
  });
}

/** Activating is what makes a policy able to delete, so it needs a fresh phone check. */
export function setRetentionPolicyState(
  policyId: string,
  state: RetentionPolicyState
): Promise<void> {
  return request<void>(`/retention/policies/${encodeURIComponent(policyId)}/state`, {
    body: JSON.stringify({ state }),
    method: 'POST'
  });
}

export function applyLegalHold(input: {
  caseId: string;
  custodianUids?: string[];
  description: string;
}): Promise<{ hold: LegalHoldSummary }> {
  return request<{ hold: LegalHoldSummary }>('/holds', {
    body: JSON.stringify(input),
    method: 'POST'
  });
}

export function releaseLegalHold(holdId: string): Promise<{ delayUntil: string }> {
  return request<{ delayUntil: string }>(`/holds/${encodeURIComponent(holdId)}/release`, {
    method: 'POST'
  });
}

export function approveDisposition(itemId: string): Promise<{ item: DispositionItem }> {
  return request<{ item: DispositionItem }>(
    `/disposition/${encodeURIComponent(itemId)}/approve`,
    { method: 'POST' }
  );
}

/** Keeping data longer never needs a phone check — the safe direction stays easy. */
export function extendDisposition(itemId: string, extraDays: number): Promise<void> {
  return request<void>(`/disposition/${encodeURIComponent(itemId)}/extend`, {
    body: JSON.stringify({ extraDays }),
    method: 'POST'
  });
}

export interface RetentionEvaluationSummary {
  alreadyQueued: number;
  examined: number;
  queued: number;
  retained: number;
  withheld: number;
}

/**
 * Runs an evaluation pass now rather than waiting for the scheduled one.
 *
 * Queuing is not destruction — everything it finds still needs a person to
 * approve it — so this needs no phone re-verification.
 */
export function runRetentionEvaluation(): Promise<{ summary: RetentionEvaluationSummary }> {
  return request<{ summary: RetentionEvaluationSummary }>('/retention/evaluate', { method: 'POST' });
}

/**
 * eDiscovery: searching preserved conversations and exporting them.
 *
 * A legal hold preserves content; these are what get it back out. The two share
 * one set of criteria on purpose — an administrator previews with a search and
 * exports the same question, so what they saw is what they receive.
 */

export type ArchiveUnreadableReason = 'NOT_ARCHIVED' | 'NO_ARCHIVE_KEY' | 'DECRYPT_FAILED';

export interface ArchiveSearchCriteria {
  conversationIds?: string[];
  /** Exports only. Defaults to true; false produces a text-only bundle. */
  includeAttachments?: boolean;
  custodianUids?: string[];
  fromMs?: number | null;
  holdId?: string | null;
  limit?: number;
  text?: string | null;
  toMs?: number | null;
}

export interface ArchivedMessageHit {
  conversationId: string;
  conversationKind: 'DIRECT' | 'GROUP';
  envelopeId: string;
  media: { fileName: string; kind: string; mediaId: string; sizeBytes: number }[];
  recipientUid: string | null;
  senderUid: string;
  sentAtMs: number;
  /** Null when the message could not be read; `unreadableReason` says why. */
  text: string | null;
  unreadableReason: ArchiveUnreadableReason | null;
}

export interface ArchiveSearchResponse {
  /** Conversations only partly examined because they hold more than one search reads. */
  cappedConversationIds: string[];
  hits: ArchivedMessageHit[];
  scannedConversations: number;
  truncated: boolean;
}

export type ComplianceExportState = 'PENDING' | 'RUNNING' | 'READY' | 'FAILED';

export interface ComplianceExportSummary {
  completeness: 'COMPLETE' | 'PARTIAL';
  createdAtMs: number;
  createdByUid: string;
  /** Set when the job failed, so the console can say why rather than wait. */
  error?: string | null;
  /** Messages packaged so far, against totalMessages. */
  processedMessages: number;
  /** What the job is doing, in words. */
  stage: string;
  state: ComplianceExportState;
  totalMessages: number;
  /** Bundles are cleared after this, so readable copies do not pile up. */
  expiresAtMs: number;
  excludedMediaFiles: number;
  excludedMessages: number;
  id: string;
  includedMediaFiles: number;
  includedMessages: number;
  matchedMessages: number;
  sizeBytes: number;
}

export function searchArchive(criteria: ArchiveSearchCriteria): Promise<ArchiveSearchResponse> {
  return request<ArchiveSearchResponse>('/search', {
    body: JSON.stringify(criteria),
    method: 'POST'
  });
}

export function listComplianceExports(): Promise<{ exports: ComplianceExportSummary[] }> {
  return request<{ exports: ComplianceExportSummary[] }>('/exports');
}

export function createComplianceExport(
  criteria: ArchiveSearchCriteria
): Promise<{ export: ComplianceExportSummary }> {
  return request<{ export: ComplianceExportSummary }>('/exports', {
    body: JSON.stringify(criteria),
    method: 'POST'
  });
}

export function getComplianceExportDownloadUrl(
  exportId: string
): Promise<{ downloadUrl: string; expiresAt: string }> {
  return request<{ downloadUrl: string; expiresAt: string }>(
    `/exports/${encodeURIComponent(exportId)}/download`
  );
}

export interface CompliancePerson {
  departmentName: string;
  displayName: string;
  role: string;
  uid: string;
}

/**
 * The colleagues a search can be narrowed to.
 *
 * Names rather than identifiers. An Org Admin answering a legal request has no
 * way of knowing a user ID, and a mistyped one returns an empty result that
 * looks exactly like "this person sent nothing".
 */
export function listCompliancePeople(): Promise<{ people: CompliancePerson[] }> {
  return request<{ people: CompliancePerson[] }>('/people');
}

export interface ArchiveKeyStatus {
  createdAtMs: number | null;
  exists: boolean;
  keyId: string | null;
  /** Set when a key cannot be created at all, e.g. the key store is misconfigured. */
  problem: string | null;
}

/**
 * Whether this organization has a compliance archive key.
 *
 * Read-only on purpose. The key creates itself when the first message is
 * encrypted, so there is nothing for an administrator to set up — only
 * something they need to be able to confirm, because it decides the date from
 * which records can be produced.
 */
export function loadArchiveKeyStatus(): Promise<{ status: ArchiveKeyStatus }> {
  return request<{ status: ArchiveKeyStatus }>('/archive-key');
}

export interface RetentionSimulation {
  examined: number;
  heldByLegalHold: number;
  keptIndefinitely: number;
  messagesAffectedNow: number;
  newlyDueFromThisPolicy: number;
  oldestAffectedAtMs: number | null;
  scanLimited: boolean;
  wouldDeleteLater: number;
  wouldDeleteNow: number;
}

/**
 * What a rule would do, before it is switched on.
 *
 * Read-only: nothing is saved, queued or deleted. It exists so an administrator
 * never has to guess before deleting an organization's records.
 */
export function simulateRetentionPolicy(input: {
  action: RetentionAction;
  durationDays: number;
  scopeKind: RetentionScopeKind;
}): Promise<{ simulation: RetentionSimulation }> {
  return request<{ simulation: RetentionSimulation }>('/retention/simulate', {
    body: JSON.stringify(input),
    method: 'POST'
  });
}

export interface ConversationRetentionExplanation {
  blockingHoldCaseId: string | null;
  conversationId: string;
  conversationKind: 'DIRECT' | 'GROUP';
  governingPolicyName: string | null;
  isOnHold: boolean;
  lastMessageAtMs: number;
  participantNames: string[];
  purgeAfterMs: number | null;
  rulesConsidered: { applies: boolean; name: string; reason: string; state: string }[];
  steps: string[];
}

/**
 * Why a particular chat is kept or deleted.
 *
 * The question an auditor asks, and the one an administrator has to answer when
 * somebody wants to know why a message survived — or why it did not.
 */
export function explainRetention(input: {
  conversationIds?: string[];
  custodianUid?: string | null;
}): Promise<{ conversations: ConversationRetentionExplanation[] }> {
  return request<{ conversations: ConversationRetentionExplanation[] }>('/retention/explain', {
    body: JSON.stringify(input),
    method: 'POST'
  });
}

export type SupportRequestState = 'NEW' | 'ACKNOWLEDGED' | 'CLOSED';

export interface SupportRequest {
  createdAtMs: number;
  email: string;
  id: string;
  message: string;
  name: string;
  state: SupportRequestState;
  subject: string;
}

/**
 * Support, raised from inside the organization's own console.
 *
 * The organization is taken from the signed-in session on the server, never
 * from this form, so a request cannot be raised in another company's name.
 */
export function raiseSupportRequest(input: {
  email: string;
  message: string;
  name: string;
  organizationName?: string;
  subject: string;
}): Promise<{ id: string }> {
  return requestAbsolute<{ id: string }>('/api/contact/support', {
    body: JSON.stringify(input),
    method: 'POST'
  });
}

export function listSupportRequests(): Promise<{ requests: SupportRequest[] }> {
  return requestAbsolute<{ requests: SupportRequest[] }>('/api/contact/support');
}

/**
 * Support lives outside /api/compliance, so it cannot use the compliance
 * request helper — that one prefixes every path and would send these to the
 * wrong place.
 */
async function requestAbsolute<T>(path: string, init: RequestInit = {}): Promise<T> {
  const user = getSynzappFirebaseAuth().currentUser;

  if (!user) {
    throw new Error('You are not signed in.');
  }

  const response = await fetch(`${getSynzappApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await user.getIdToken()}`,
      ...(await getAppCheckHeader()),
      ...(init.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

export type AnnouncementAudienceKind = 'ORGANIZATION' | 'DEPARTMENT' | 'GROUP' | 'PERSON';
export type AnnouncementRecipientStatus = 'DELIVERED' | 'READ' | 'ACKNOWLEDGED';

export interface ConsoleAnnouncement {
  acknowledgedCount: number;
  announcementId: string;
  audienceSummary: string;
  audiences: { kind: AnnouncementAudienceKind; targetId: string | null; targetName: string }[];
  body: string;
  bodyRemovedAtMs: number | null;
  createdAtMs: number;
  createdByName: string;
  createdByUid: string;
  expectedRecipientCount: number;
  readCount: number;
  requiresAcknowledgement: boolean;
  subject: string;
}

export interface ConsoleAnnouncementRecipient {
  acknowledgedAtMs: number | null;
  departmentId: string | null;
  displayName: string;
  readAtMs: number | null;
  status: AnnouncementRecipientStatus;
  uid: string;
}

export function listConsoleAnnouncements(): Promise<{ announcements: ConsoleAnnouncement[] }> {
  return requestAbsolute<{ announcements: ConsoleAnnouncement[] }>('/api/announcements');
}

export function listConsoleAnnouncementRecipients(input: {
  announcementId: string;
  startAfterUid?: string;
}): Promise<{ nextCursor: string | null; recipients: ConsoleAnnouncementRecipient[] }> {
  const query = input.startAfterUid
    ? `?startAfterUid=${encodeURIComponent(input.startAfterUid)}`
    : '';

  return requestAbsolute<{
    nextCursor: string | null;
    recipients: ConsoleAnnouncementRecipient[];
  }>(`/api/announcements/${encodeURIComponent(input.announcementId)}/recipients${query}`);
}

export type ActionStatus = 'OPEN' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'VERIFIED';
export type ActionPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ConsoleAction {
  actionId: string;
  attachmentCount: number;
  blockedReason: string | null;
  bodyRemovedAtMs: number | null;
  completedAtMs: number | null;
  completedByName: string | null;
  completedByUid: string | null;
  completionNote: string | null;
  createdAtMs: number;
  createdByName: string;
  createdByUid: string;
  dueAtMs: number | null;
  priority: ActionPriority;
  responsibleDepartmentId: string | null;
  responsibleGroupId: string;
  responsibleGroupName: string;
  responsiblePersonName: string | null;
  responsiblePersonUid: string | null;
  sourceChatId: string;
  sourceChatName: string;
  sourceMessageId: string;
  startedAtMs: number | null;
  status: ActionStatus;
  title: string;
  verifiedAtMs: number | null;
  verifiedByName: string | null;
  verifiedByUid: string | null;
}

export interface ConsoleActionEvent {
  actorName: string;
  actorUid: string;
  atMs: number;
  eventId: string;
  fromStatus: ActionStatus | null;
  kind: 'CREATED' | 'STATUS_CHANGED' | 'VERIFIED';
  note: string | null;
  toStatus: ActionStatus | null;
}

/** Every action in the organization, newest first, one page at a time. */
export function listConsoleActions(input: { startAfterId?: string } = {}): Promise<{
  actions: ConsoleAction[];
  nextCursor: string | null;
}> {
  const query = input.startAfterId
    ? `?startAfterId=${encodeURIComponent(input.startAfterId)}`
    : '';

  return requestAbsolute<{ actions: ConsoleAction[]; nextCursor: string | null }>(
    `/api/actions${query}`
  );
}

/** One action with the history that proves what happened to it. */
export function getConsoleAction(actionId: string): Promise<{
  action: ConsoleAction;
  events: ConsoleActionEvent[];
}> {
  return requestAbsolute<{ action: ConsoleAction; events: ConsoleActionEvent[] }>(
    `/api/actions/${encodeURIComponent(actionId)}`
  );
}

export interface ConsoleAuditEvent {
  action: string;
  /** The person's name when the directory has one; the uid stays beside it. */
  actorName: string | null;
  actorUid: string | null;
  createdAtMs: number;
  eventId: string;
  ipAddress: string | null;
  metadata: Record<string, unknown>;
  reason: string | null;
  status: string;
}

/**
 * One page of the audit log.
 *
 * Read only. There is no companion call that deletes or edits one of these,
 * and there must never be: an audit log an administrator can erase is a diary.
 */
export async function listConsoleAuditEvents(input: {
  actions?: string[];
  fromMs?: number | null;
  startAfterId?: string | null;
  toMs?: number | null;
}): Promise<{ events: ConsoleAuditEvent[]; nextCursor: string | null }> {
  const query = new URLSearchParams();

  if (input.actions?.length) query.set('actions', input.actions.join(','));
  if (input.fromMs) query.set('fromMs', String(input.fromMs));
  if (input.toMs) query.set('toMs', String(input.toMs));
  if (input.startAfterId) query.set('startAfterId', input.startAfterId);

  return requestAbsolute(`/api/admin/audit-events?${query.toString()}`);
}
