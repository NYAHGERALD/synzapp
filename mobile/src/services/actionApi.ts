import { getSynzappApiBaseUrl } from './apiConfig';

/**
 * Actions, from the phone's side.
 *
 * The phone asks and displays. It decides nothing: who may raise an action,
 * who may work it and who may verify it are all settled on the server, because
 * a phone is a thing a person can modify.
 */

/** `CANCELLED` is terminal and is not a deletion. See the governance plan. */
export type ActionStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'DONE'
  | 'VERIFIED'
  | 'CANCELLED';
export type ActionPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ActionAttachment {
  attachmentId: string;
  durationMs: number | null;
  kind: 'image' | 'video';
  sizeBytes: number;
  storagePath: string;
  uploadedAtMs: number;
  uploadedByUid: string;
}

export interface ActionEvent {
  actorName: string;
  actorUid: string;
  atMs: number;
  eventId: string;
  fromStatus: ActionStatus | null;
  kind: 'CREATED' | 'STATUS_CHANGED' | 'VERIFIED';
  note: string | null;
  toStatus: ActionStatus | null;
}

export interface ActionRecord {
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
  /** A group id, or for a direct chat the other person's uid. */
  sourceChatId: string;
  sourceChatType?: 'DIRECT' | 'GROUP';
  sourceChatName: string;
  sourceDepartmentId: string | null;
  sourceMessageId: string;
  startedAtMs: number | null;
  status: ActionStatus;
  cancellationReason: string | null;
  cancelledAtMs: number | null;
  cancelledByName: string | null;
  cancelledByUid: string | null;
  /** Derived on the server from the source and responsible departments. */
  departmentIds: string[];
  tenantId: string;
  title: string;
  updatedAtMs: number;
  verifiedAtMs: number | null;
  verifiedByName: string | null;
  verifiedByUid: string | null;
}

async function request<T>(input: {
  body?: unknown;
  idToken: string;
  method: 'GET' | 'POST';
  path: string;
}): Promise<T> {
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/actions${input.path}`, {
    body: input.body ? JSON.stringify(input.body) : undefined,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${input.idToken}`,
      'Content-Type': 'application/json'
    },
    method: input.method
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      (payload as { error?: string }).error || 'That could not be done right now.'
    );
  }

  return payload as T;
}

export interface CreateActionInput {
  /** Ids from reserveActionUpload. The phone never sends a storage path. */
  attachmentIds?: string[];
  dueAtMs?: number | null;
  priority: ActionPriority;
  responsibleGroupId: string;
  responsiblePersonUid?: string | null;
  /** A group id, or for a direct chat the other person's uid. */
  sourceChatId: string;
  sourceChatName: string;
  /** The server names a direct conversation from both people, so it must know. */
  sourceChatType?: 'DIRECT' | 'GROUP';
  sourceMessageId: string;
  title: string;
}

export async function createAction(input: {
  action: CreateActionInput;
  idToken: string;
}): Promise<ActionRecord> {
  const payload = await request<{ action: ActionRecord }>({
    body: input.action,
    idToken: input.idToken,
    method: 'POST',
    path: '/'
  });

  return payload.action;
}

export async function listActions(input: {
  /** A group id, or for a direct chat the other person's uid. */
  chatId?: string;
  chatType?: 'DIRECT' | 'GROUP';
  groupId?: string;
  idToken: string;
  startAfterId?: string;
  status?: ActionStatus;
}): Promise<{ actions: ActionRecord[]; nextCursor: string | null }> {
  const query = new URLSearchParams();

  if (input.chatId) query.set('chatId', input.chatId);
  // The server names a direct conversation from both people, so it has to know
  // which kind this is. Without it a group id would be hashed as if it were a
  // counterparty uid and match nothing.
  if (input.chatType) query.set('chatType', input.chatType);
  if (input.groupId) query.set('groupId', input.groupId);
  if (input.startAfterId) query.set('startAfterId', input.startAfterId);
  if (input.status) query.set('status', input.status);

  return request({
    idToken: input.idToken,
    method: 'GET',
    path: `/?${query.toString()}`
  });
}

export async function getActionDetail(input: {
  actionId: string;
  idToken: string;
}): Promise<{ action: ActionRecord; attachments: ActionAttachment[]; events: ActionEvent[] }> {
  return request({
    idToken: input.idToken,
    method: 'GET',
    path: `/${input.actionId}`
  });
}

export async function changeActionStatus(input: {
  actionId: string;
  blockedReason?: string | null;
  idToken: string;
  note?: string | null;
  status: ActionStatus;
}): Promise<ActionRecord> {
  const payload = await request<{ action: ActionRecord }>({
    body: {
      blockedReason: input.blockedReason || null,
      note: input.note || null,
      status: input.status
    },
    idToken: input.idToken,
    method: 'POST',
    path: `/${input.actionId}/status`
  });

  return payload.action;
}

export async function verifyAction(input: {
  actionId: string;
  idToken: string;
}): Promise<ActionRecord> {
  const payload = await request<{ action: ActionRecord }>({
    idToken: input.idToken,
    method: 'POST',
    path: `/${input.actionId}/verify`
  });

  return payload.action;
}

/**
 * Ends an action without it having been done.
 *
 * Not a deletion: the record stays and gains who ended it and why. The reason
 * is required by the server as well as here, so an empty one is refused rather
 * than stored as a blank.
 */
export async function cancelAction(input: {
  actionId: string;
  idToken: string;
  reason: string;
}): Promise<ActionRecord> {
  const payload = await request<{ action: ActionRecord }>({
    body: { reason: input.reason },
    idToken: input.idToken,
    method: 'POST',
    path: `/${input.actionId}/cancel`
  });

  return payload.action;
}

/**
 * Hands an action to somebody else, or back to the whole team.
 *
 * The reason is required and is not paperwork: the person it is taken from and
 * the person it goes to both read it. Requiring a name on every action is only
 * reasonable because moving it is this easy, and moving it invisibly is what
 * would make the requirement unfair.
 */
export async function reassignAction(input: {
  actionId: string;
  detail?: string;
  idToken: string;
  /** Null hands it back to the whole team. */
  nextPersonUid: string | null;
  reasonId: string;
}): Promise<ActionRecord> {
  const payload = await request<{ action: ActionRecord }>({
    body: {
      detail: input.detail,
      nextPersonUid: input.nextPersonUid,
      reasonId: input.reasonId
    },
    idToken: input.idToken,
    method: 'POST',
    path: `/${input.actionId}/reassign`
  });

  return payload.action;
}

export interface PersonalActionCounts {
  awaitingVerification: number;
  open: number;
  overdue: number;
}

/**
 * How much the person asking is carrying, across every team.
 *
 * Their own work only. A count that includes the company's is a count nobody
 * acts on, and a line above the chat list that nobody acts on is a line people
 * stop seeing.
 */
export async function getMyActionCounts(input: {
  idToken: string;
}): Promise<PersonalActionCounts> {
  const payload = await request<{ counts: PersonalActionCounts }>({
    idToken: input.idToken,
    method: 'GET',
    path: '/my-counts'
  });

  return payload.counts;
}

export async function getActionCounts(input: {
  groupId: string;
  idToken: string;
}): Promise<{ pending: number; unverified: number }> {
  return request({
    idToken: input.idToken,
    method: 'GET',
    path: `/counts?groupId=${encodeURIComponent(input.groupId)}`
  });
}

export interface ActionUploadTicket {
  attachmentId: string;
  expiresAtMs: number;
  uploadUrl: string;
}

/** Asks the server for somewhere to put one photo or clip. */
export async function reserveActionUpload(input: {
  contentType: string;
  idToken: string;
  kind: 'image' | 'video';
  sizeBytes: number;
}): Promise<ActionUploadTicket> {
  return request<ActionUploadTicket>({
    body: {
      contentType: input.contentType,
      kind: input.kind,
      sizeBytes: input.sizeBytes
    },
    idToken: input.idToken,
    method: 'POST',
    path: '/uploads'
  });
}

/**
 * Puts the file where the server said to put it.
 *
 * Straight to storage rather than through the API, so a 40 MB clip does not
 * travel through Cloud Run and time out on a weak signal.
 */
export async function uploadActionFile(input: {
  contentType: string;
  fileUri: string;
  uploadUrl: string;
}): Promise<void> {
  const file = await fetch(input.fileUri);
  const blob = await file.blob();
  const response = await fetch(input.uploadUrl, {
    body: blob,
    headers: { 'Content-Type': input.contentType },
    method: 'PUT'
  });

  if (!response.ok) {
    throw new Error('That file could not be uploaded.');
  }
}

export async function listActionAttachments(input: {
  actionId: string;
  idToken: string;
}): Promise<{
  attachments: Array<{
    attachmentId: string;
    kind: 'image' | 'video';
    sizeBytes: number;
    url: string;
  }>;
}> {
  return request({
    idToken: input.idToken,
    method: 'GET',
    path: `/${input.actionId}/attachments`
  });
}
