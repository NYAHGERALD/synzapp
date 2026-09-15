import { DecodedIdToken } from 'firebase-admin/auth';
import { fieldValue, firestore, storageBucket } from '../config/firebaseAdmin.js';
import {
  canReassignAction,
  describeReassignmentReason,
  validateReassignmentReason
} from './actionReassignment.js';
import {
  canCancelAction,
  canChangeActionStatus,
  canCreateAction,
  canVerifyAction
} from './authorizationPolicy.js';
import {
  buildDirectChatId,
  isCanonicalDirectChatId
} from './conversationIdentity.js';
import {
  buildActionDepartmentIds,
  resolveActionListScope,
  type ActionListScope
} from './actionScope.js';
import { listActiveLegalHolds, type LegalHoldRecord } from './legalHoldService.js';
import { countActionsForDigest, type ActionDigestCounts } from './actionDigest.js';
import { readActorProfilePhotoCacheKey, sendRailsPushNotification } from './notificationService.js';

/**
 * Actions: a problem reported in a chat, handed to the people who can fix it,
 * and answered back where it was raised.
 *
 * Not a task manager. The value is the closed loop. Somebody on a line types
 * "issue with tortillas on line 5", that message becomes an action owned by a
 * department, and when it is done the answer returns to the chat that raised
 * it, time stamped, and is verified by somebody other than the person who did
 * the work.
 *
 * Four properties are load-bearing, and each is tested:
 *
 *  - **An action is a company record, not a chat message.** Chat is sealed per
 *    device; an action is stored here so it can be counted, listed, held and
 *    produced in an audit. The person creating one is told this before they
 *    send it. See section 8 of the Create Action plan.
 *  - **The responsible group is required, the person is optional.** An action
 *    owned by one name dies when that person is off sick or leaves.
 *  - **The doer never verifies their own work.** Enforced in the policy, before
 *    any role or grant is considered.
 *  - **Counts come from stored counters, never from counting rows.** A group
 *    with ten thousand actions must open as fast as one with ten.
 */

/**
 * `CANCELLED` is terminal, and is not a deletion.
 *
 * An action is the record that somebody reported a fault, somebody was made
 * answerable, and somebody said it was finished. That record is what an auditor
 * asks for, so it is never removed — a cancelled action leaves the active list
 * and stays in the history with who ended it and why.
 *
 * See section 4 of SYNZAPP_ACTIONS_GOVERNANCE_PLAN.md.
 */
export type ActionStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'DONE'
  | 'VERIFIED'
  | 'CANCELLED';
export type ActionPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/** One page of actions. The phone never holds a whole group's history. */
export const ACTION_PAGE_SIZE = 30;

/** Statuses that still need somebody to do something. */
const PENDING_STATUSES: ActionStatus[] = ['OPEN', 'IN_PROGRESS', 'BLOCKED'];

/** A cancelled action is not pending and not outstanding. It is finished. */
const ACTIVE_STATUSES: ActionStatus[] = ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE'];

/**
 * The most one photo or clip may weigh.
 *
 * Matched to the RCA evidence limit already in the storage rules, so there is
 * one number to explain rather than two.
 */
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

/** An upload link is short lived. A link that never expires is a back door. */
const UPLOAD_URL_TTL_MS = 15 * 60 * 1000;

/** Long enough to watch a clip, short enough not to be worth passing around. */
const DOWNLOAD_URL_TTL_MS = 60 * 60 * 1000;

/** Reserved for an upload that has not been attached to an action yet. */
const PENDING_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;

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
  /**
   * What the action says, taken from the message it was raised from.
   *
   * Held as a company record rather than sealed like the chat it came from:
   * an action whose purpose is to be produced in an audit is worthless if it
   * cannot be produced. Retention may remove it, and when it does the event
   * history and the verification survive.
   */
  title: string;
  completedAtMs: number | null;
  completedByName: string | null;
  completedByUid: string | null;
  createdAtMs: number;
  createdByName: string;
  createdByUid: string;
  completionNote: string | null;
  dueAtMs: number | null;
  priority: ActionPriority;
  responsibleDepartmentId: string | null;
  responsibleGroupId: string;
  responsibleGroupName: string;
  responsiblePersonName: string | null;
  responsiblePersonUid: string | null;
  sourceChatId: string;
  sourceChatName: string;
  sourceDepartmentId: string | null;
  sourceMessageId: string;
  startedAtMs: number | null;
  status: ActionStatus;
  cancellationReason: string | null;
  cancelledAtMs: number | null;
  cancelledByName: string | null;
  cancelledByUid: string | null;
  /**
   * The departments this action belongs to, for the scoped list.
   *
   * Derived from the two department fields on every write and never authored
   * by a client: a writable membership field is a way to put an action into
   * somebody else's department. See `buildActionDepartmentIds`.
   */
  departmentIds: string[];
  bodyRemovedAtMs: number | null;
  tenantId: string;
  updatedAtMs: number;
  verifiedAtMs: number | null;
  verifiedByName: string | null;
  verifiedByUid: string | null;
}

interface ActorContext {
  departmentId: string | null;
  /** As stored on the person, not as claimed by the caller. */
  employmentStatus: string;
  displayName: string;
  permissions: string[];
  role: string;
  tenantId: string;
  uid: string;
}

function actionsRef(tenantId: string) {
  return firestore.collection('organizations').doc(tenantId).collection('actions');
}

function eventsRef(tenantId: string, actionId: string) {
  return actionsRef(tenantId).doc(actionId).collection('events');
}

function attachmentsRef(tenantId: string, actionId: string) {
  return actionsRef(tenantId).doc(actionId).collection('attachments');
}

function groupRef(tenantId: string, groupId: string) {
  return firestore.collection('organizations').doc(tenantId).collection('groups').doc(groupId);
}

/**
 * Reads who the caller is from their own record, never from the request.
 *
 * A permission check that trusts what the client sent is decoration.
 */
async function loadActorContext(decodedToken: DecodedIdToken): Promise<ActorContext> {
  const snapshot = await firestore.collection('identityDirectory').doc(decodedToken.uid).get();
  const identity = snapshot.exists ? (snapshot.data() as Record<string, unknown>) : null;

  if (!identity || !identity.tenantId) {
    throw forbiddenError('You do not have access to this organization.');
  }

  const tenantId = String(identity.tenantId);
  const member = await firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('users')
    .doc(decodedToken.uid)
    .get();
  const profile = member.exists ? (member.data() as Record<string, unknown>) : {};

  return {
    departmentId: (identity.departmentId as string) || null,
    employmentStatus: String(identity.status || 'ACTIVE'),
    displayName: String(profile.displayName || profile.fullName || 'Unknown'),
    permissions: Array.isArray(identity.permissions) ? (identity.permissions as string[]) : [],
    role: String(identity.role || 'EMPLOYEE'),
    tenantId,
    uid: decodedToken.uid
  };
}

/**
 * Everybody in a group, the way groups are actually stored.
 *
 * Members live in a subcollection, and a group whose policy is
 * DEPARTMENT_PLUS_EXPLICIT also contains everybody in its department. Reading
 * a `memberIds` array here would find nothing and quietly report that a busy
 * group is empty.
 */
/**
 * The department admins answerable for this work.
 *
 * Used where something has happened that a supervisor needs to know about
 * rather than act on. Returns nothing rather than throwing: a notification that
 * cannot find its audience must not fail the status change that caused it.
 */
/**
 * The Android channel action notifications arrive on.
 *
 * Separate from RAILS and announcements on purpose. Somebody who wants fewer
 * action reminders must be able to turn down exactly those, because the
 * alternative is muting Synzapp — and that silences the overdue escalation,
 * which is the one thing this must never lose.
 */
export const ACTION_NOTIFICATION_CHANNEL_ID = 'action-updates';

async function loadDepartmentAdminUids(
  tenantId: string,
  departmentId: string | null
): Promise<string[]> {
  if (!departmentId) {
    return [];
  }

  try {
    const snapshot = await firestore
      .collection('organizations')
      .doc(tenantId)
      .collection('users')
      .where('departmentId', '==', departmentId)
      .where('role', '==', 'DEPT_ADMIN')
      .get();

    return snapshot.docs
      .filter((doc) => (doc.data() as { status?: string }).status === 'ACTIVE')
      .map((doc) => doc.id);
  } catch {
    return [];
  }
}

async function loadGroupMemberIds(tenantId: string, groupId: string): Promise<string[]> {
  const ref = groupRef(tenantId, groupId);
  const group = await ref.get();

  if (!group.exists) {
    throw notFoundError('That group was not found.');
  }

  const data = group.data() as Record<string, unknown>;
  const uids = new Set<string>();
  const members = await ref.collection('members').get();

  for (const member of members.docs) {
    if (String((member.data() as Record<string, unknown>).status || 'ACTIVE') === 'ACTIVE') {
      uids.add(member.id);
    }
  }

  if (data.memberPolicy === 'DEPARTMENT_PLUS_EXPLICIT' && data.autoMembershipDepartmentId) {
    const departmentMembers = await firestore
      .collection('organizations')
      .doc(tenantId)
      .collection('users')
      .where('departmentId', '==', data.autoMembershipDepartmentId)
      .get();

    for (const person of departmentMembers.docs) {
      uids.add(person.id);
    }
  }

  return [...uids];
}

function normalizeAction(raw: Record<string, unknown>): ActionRecord {
  return {
    actionId: String(raw.actionId || ''),
    cancellationReason: (raw.cancellationReason as string) || null,
    cancelledAtMs: (raw.cancelledAtMs as number) || null,
    cancelledByName: (raw.cancelledByName as string) || null,
    cancelledByUid: (raw.cancelledByUid as string) || null,
    // Rebuilt on read rather than trusted, so an action written before this
    // field existed still reports the departments it belongs to. The stored
    // copy is what queries match on; this is what callers see.
    departmentIds: buildActionDepartmentIds({
      responsibleDepartmentId: (raw.responsibleDepartmentId as string) || null,
      sourceDepartmentId: (raw.sourceDepartmentId as string) || null
    }),
    attachmentCount: Number(raw.attachmentCount || 0),
    blockedReason: (raw.blockedReason as string) || null,
    bodyRemovedAtMs: (raw.bodyRemovedAtMs as number) || null,
    completedAtMs: (raw.completedAtMs as number) || null,
    completedByName: (raw.completedByName as string) || null,
    completedByUid: (raw.completedByUid as string) || null,
    completionNote: (raw.completionNote as string) || null,
    createdAtMs: Number(raw.createdAtMs || 0),
    createdByName: String(raw.createdByName || 'Unknown'),
    createdByUid: String(raw.createdByUid || ''),
    dueAtMs: (raw.dueAtMs as number) || null,
    priority: (raw.priority as ActionPriority) || 'MEDIUM',
    responsibleDepartmentId: (raw.responsibleDepartmentId as string) || null,
    responsibleGroupId: String(raw.responsibleGroupId || ''),
    responsibleGroupName: String(raw.responsibleGroupName || 'Unknown group'),
    responsiblePersonName: (raw.responsiblePersonName as string) || null,
    responsiblePersonUid: (raw.responsiblePersonUid as string) || null,
    sourceChatId: String(raw.sourceChatId || ''),
    sourceChatName: String(raw.sourceChatName || ''),
    sourceDepartmentId: (raw.sourceDepartmentId as string) || null,
    sourceMessageId: String(raw.sourceMessageId || ''),
    startedAtMs: (raw.startedAtMs as number) || null,
    status: (raw.status as ActionStatus) || 'OPEN',
    tenantId: String(raw.tenantId || ''),
    title: String(raw.title || ''),
    updatedAtMs: Number(raw.updatedAtMs || 0),
    verifiedAtMs: (raw.verifiedAtMs as number) || null,
    verifiedByName: (raw.verifiedByName as string) || null,
    verifiedByUid: (raw.verifiedByUid as string) || null
  };
}

export interface CreateActionInput {
  /** Ids from createActionUpload. Never a storage path: see attachPendingUploads. */
  attachmentIds?: string[];
  dueAtMs?: number | null;
  priority: ActionPriority;
  responsibleGroupId: string;
  responsiblePersonUid?: string | null;
  /**
   * For a group, its id. For a direct chat, **the other person's uid**.
   *
   * Never stored as given for a direct chat. The server names the conversation
   * from both people, so a caller cannot record an action against a
   * conversation they are not in. See `resolveSourceChatId`.
   */
  sourceChatId: string;
  sourceChatName: string;
  sourceChatType?: 'DIRECT' | 'GROUP';
  sourceMessageId: string;
  title: string;
}

/**
 * The id an action is filed under.
 *
 * A group keeps its own id. A direct chat is named from **both** people, so the
 * same conversation gets the same id whoever raises the action, and nobody can
 * file one against a conversation they are not part of.
 *
 * A caller-supplied value was stored directly until this existed, and it was
 * one participant's uid. Passing somebody else's uid then read the actions of
 * their conversations with other people. That is Broken Object Level
 * Authorization, first on the OWASP API Security Top 10.
 */
function resolveSourceChatId(input: {
  chatId: string;
  chatType?: 'DIRECT' | 'GROUP';
  requesterUid: string;
}): string {
  if (input.chatType === 'GROUP') {
    return input.chatId;
  }

  // Already canonical, so it is somebody re-sending a derived id rather than a
  // counterparty uid. Deriving again would name a different conversation.
  if (isCanonicalDirectChatId(input.chatId)) {
    return input.chatId;
  }

  return buildDirectChatId(input.requesterUid, input.chatId);
}

/**
 * Turns a message into an action.
 *
 * The group is resolved and named here rather than trusted from the request,
 * so a renamed group does not rewrite history and a forged group name cannot
 * be planted in an audit record.
 */
export async function createAction(
  decodedToken: DecodedIdToken,
  input: CreateActionInput
): Promise<ActionRecord> {
  const actor = await loadActorContext(decodedToken);

  if (!canCreateAction({
    permissions: actor.permissions,
    requesterUid: actor.uid,
    role: actor.role,
    access: 'ACTIVE',
    status: actor.employmentStatus,
    tenantId: actor.tenantId
  })) {
    throw forbiddenError('You cannot create actions in this organization.');
  }

  const group = await groupRef(actor.tenantId, input.responsibleGroupId).get();

  if (!group.exists) {
    throw notFoundError('That group was not found.');
  }

  const groupData = group.data() as Record<string, unknown>;
  const responsiblePerson = input.responsiblePersonUid
    ? await loadPerson(actor.tenantId, input.responsiblePersonUid)
    : null;

  if (input.responsiblePersonUid && !responsiblePerson) {
    throw validationError('That person was not found in this organization.');
  }

  const now = Date.now();
  const ref = actionsRef(actor.tenantId).doc();
  // Attached before the action is written, so a file that never finished
  // uploading fails here rather than leaving a bubble with a broken photo.
  const attachmentCount = await attachPendingUploads({
    actionId: ref.id,
    attachmentIds: input.attachmentIds || [],
    tenantId: actor.tenantId,
    uid: actor.uid
  });
  const record: ActionRecord = {
    actionId: ref.id,
    attachmentCount,
    blockedReason: null,
    bodyRemovedAtMs: null,
    cancellationReason: null,
    cancelledAtMs: null,
    cancelledByName: null,
    cancelledByUid: null,
    departmentIds: buildActionDepartmentIds({
      responsibleDepartmentId: (groupData.departmentId as string) || null,
      sourceDepartmentId: actor.departmentId
    }),
    completedAtMs: null,
    completedByName: null,
    completedByUid: null,
    completionNote: null,
    createdAtMs: now,
    createdByName: actor.displayName,
    createdByUid: actor.uid,
    dueAtMs: input.dueAtMs || null,
    priority: input.priority,
    responsibleDepartmentId: (groupData.departmentId as string) || null,
    responsibleGroupId: input.responsibleGroupId,
    responsibleGroupName: String(groupData.name || 'Unknown group'),
    responsiblePersonName: responsiblePerson?.displayName || null,
    responsiblePersonUid: input.responsiblePersonUid || null,
    sourceChatId: resolveSourceChatId({
      chatId: input.sourceChatId,
      chatType: input.sourceChatType,
      requesterUid: actor.uid
    }),
    sourceChatName: input.sourceChatName,
    sourceDepartmentId: actor.departmentId,
    sourceMessageId: input.sourceMessageId,
    startedAtMs: null,
    status: 'OPEN',
    tenantId: actor.tenantId,
    title: input.title,
    updatedAtMs: now,
    verifiedAtMs: null,
    verifiedByName: null,
    verifiedByUid: null
  };

  // The action, its first event and the group counters move together. A count
  // that disagrees with the list is worse than a create that failed outright.
  await firestore.runTransaction(async (transaction) => {
    transaction.set(ref, record);
    transaction.set(eventsRef(actor.tenantId, ref.id).doc(), {
      actorName: actor.displayName,
      actorUid: actor.uid,
      atMs: now,
      fromStatus: null,
      kind: 'CREATED',
      note: null,
      toStatus: 'OPEN'
    });
    transaction.set(groupRef(actor.tenantId, input.responsibleGroupId), {
      openActionCount: fieldValue.increment(1)
    }, { merge: true });
  });

  await notifyAboutAction({
    action: record,
    actorUid: actor.uid,
    kind: 'ASSIGNED',
    tenantId: actor.tenantId
  });

  return record;
}

async function loadPerson(
  tenantId: string,
  uid: string
): Promise<{ departmentId: string | null; displayName: string } | null> {
  const person = await firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('users')
    .doc(uid)
    .get();

  if (!person.exists) {
    return null;
  }

  const data = person.data() as Record<string, unknown>;

  return {
    departmentId: (data.departmentId as string) || null,
    displayName: String(data.displayName || data.fullName || 'Unknown')
  };
}

export interface ChangeActionStatusInput {
  actionId: string;
  blockedReason?: string | null;
  note?: string | null;
  status: ActionStatus;
}

/**
 * Moves an action along.
 *
 * `VERIFIED` is not reachable here. Verification is a separate act with a
 * separate rule about who may perform it, and folding it into an ordinary
 * status change would let the person who did the work close the loop on
 * themselves.
 */
export async function changeActionStatus(
  decodedToken: DecodedIdToken,
  input: ChangeActionStatusInput
): Promise<ActionRecord> {
  const actor = await loadActorContext(decodedToken);
  const ref = actionsRef(actor.tenantId).doc(input.actionId);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    throw notFoundError('That action was not found.');
  }

  const current = normalizeAction(snapshot.data() as Record<string, unknown>);

  if (input.status === 'VERIFIED') {
    throw validationError('Use verify to confirm an action is done.');
  }

  if (current.status === 'VERIFIED') {
    throw validationError('That action has been verified and cannot be changed.');
  }

  if (input.status === 'BLOCKED' && !input.blockedReason?.trim()) {
    throw validationError('Say what the action is waiting on.');
  }

  const memberIds = await loadGroupMemberIds(actor.tenantId, current.responsibleGroupId);

  if (!canChangeActionStatus({
    permissions: actor.permissions,
    requesterUid: actor.uid,
    responsibleDepartmentId: current.responsibleDepartmentId,
    responsibleGroupMemberIds: memberIds,
    role: actor.role,
    access: 'ACTIVE',
    status: actor.employmentStatus,
    tenantId: actor.tenantId,
    userDepartmentId: actor.departmentId
  })) {
    throw forbiddenError('You cannot change this action.');
  }

  const now = Date.now();
  const wasPending = PENDING_STATUSES.includes(current.status);
  const isPending = PENDING_STATUSES.includes(input.status);
  const update: Record<string, unknown> = {
    blockedReason: input.status === 'BLOCKED' ? input.blockedReason?.trim() || null : null,
    status: input.status,
    updatedAtMs: now
  };

  if (input.status === 'IN_PROGRESS' && !current.startedAtMs) {
    update.startedAtMs = now;
  }

  if (input.status === 'DONE') {
    update.completedAtMs = now;
    update.completedByName = actor.displayName;
    update.completedByUid = actor.uid;
    update.completionNote = input.note?.trim() || null;
  }

  await firestore.runTransaction(async (transaction) => {
    transaction.update(ref, update);
    transaction.set(eventsRef(actor.tenantId, input.actionId).doc(), {
      actorName: actor.displayName,
      actorUid: actor.uid,
      atMs: now,
      fromStatus: current.status,
      kind: 'STATUS_CHANGED',
      note: input.note?.trim() || input.blockedReason?.trim() || null,
      toStatus: input.status
    });

    if (wasPending !== isPending) {
      transaction.set(groupRef(actor.tenantId, current.responsibleGroupId), {
        openActionCount: fieldValue.increment(isPending ? 1 : -1),
        unverifiedActionCount: fieldValue.increment(input.status === 'DONE' ? 1 : 0)
      }, { merge: true });
    }
  });

  const updated = { ...current, ...normalizeAction({ ...snapshot.data() as Record<string, unknown>, ...update }) };

  // Every status somebody else is waiting on. Started and blocked were silent:
  // a supervisor never learned a job had been picked up, and never learned one
  // was stuck, which is the same as not having a status at all.
  const notifiableKind = input.status === 'DONE'
    ? 'DONE' as const
    : input.status === 'IN_PROGRESS'
      ? 'STARTED' as const
      : input.status === 'BLOCKED'
        ? 'BLOCKED' as const
        : null;

  if (notifiableKind) {
    await notifyAboutAction({
      action: updated,
      actorUid: actor.uid,
      kind: notifiableKind,
      tenantId: actor.tenantId
    });
  }

  return updated;
}

/**
 * Confirms a completed action is genuinely done.
 *
 * The rule that matters is in `canVerifyAction`: the person who marked it done
 * can never be the person who verifies it.
 */
export async function verifyAction(
  decodedToken: DecodedIdToken,
  actionId: string
): Promise<ActionRecord> {
  const actor = await loadActorContext(decodedToken);
  const ref = actionsRef(actor.tenantId).doc(actionId);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    throw notFoundError('That action was not found.');
  }

  const current = normalizeAction(snapshot.data() as Record<string, unknown>);

  if (current.status !== 'DONE') {
    throw validationError('Only a completed action can be verified.');
  }

  if (!canVerifyAction({
    completedByUid: current.completedByUid,
    createdByUid: current.createdByUid,
    permissions: actor.permissions,
    requesterUid: actor.uid,
    role: actor.role,
    sourceDepartmentId: current.sourceDepartmentId,
    access: 'ACTIVE',
    status: actor.employmentStatus,
    tenantId: actor.tenantId,
    userDepartmentId: actor.departmentId
  })) {
    throw forbiddenError('You cannot verify this action.');
  }

  const now = Date.now();
  const update = {
    status: 'VERIFIED' as ActionStatus,
    updatedAtMs: now,
    verifiedAtMs: now,
    verifiedByName: actor.displayName,
    verifiedByUid: actor.uid
  };

  await firestore.runTransaction(async (transaction) => {
    transaction.update(ref, update);
    transaction.set(eventsRef(actor.tenantId, actionId).doc(), {
      actorName: actor.displayName,
      actorUid: actor.uid,
      atMs: now,
      fromStatus: current.status,
      kind: 'VERIFIED',
      note: null,
      toStatus: 'VERIFIED'
    });
    transaction.set(groupRef(actor.tenantId, current.responsibleGroupId), {
      unverifiedActionCount: fieldValue.increment(-1)
    }, { merge: true });
  });

  const verified = { ...current, ...update };

  await notifyAboutAction({
    action: verified,
    actorUid: actor.uid,
    kind: 'VERIFIED',
    tenantId: actor.tenantId
  });

  return verified;
}

/**
 * Ends an action without it having been done.
 *
 * **Not a deletion.** The record stays, and gains who ended it and why. An
 * action is the evidence that somebody reported a fault and somebody was made
 * answerable; a system where that evidence can be removed is worse than none,
 * because it looks like a record and is not.
 *
 * The reason is required and is kept. A cancellation with no reason cannot be
 * told apart from a cover-up, and being able to tell them apart is the point.
 *
 * Who may do it is decided by `canCancelAction`, which refuses the person
 * answerable for the action before it considers any role. See section 4 of
 * SYNZAPP_ACTIONS_GOVERNANCE_PLAN.md.
 */
export async function cancelAction(
  decodedToken: DecodedIdToken,
  input: { actionId: string; reason: string }
): Promise<ActionRecord> {
  const actor = await loadActorContext(decodedToken);
  const ref = actionsRef(actor.tenantId).doc(input.actionId);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    throw notFoundError('That action was not found.');
  }

  const reason = input.reason.trim();

  if (!reason) {
    throw validationError('Give a reason for cancelling this action.');
  }

  const current = normalizeAction(snapshot.data() as Record<string, unknown>);
  const decision = canCancelAction({
    access: 'ACTIVE',
    actionStatus: current.status,
    createdByUid: current.createdByUid,
    permissions: actor.permissions,
    requesterUid: actor.uid,
    responsibleDepartmentId: current.responsibleDepartmentId,
    responsiblePersonUid: current.responsiblePersonUid,
    role: actor.role,
    sourceDepartmentId: current.sourceDepartmentId,
    status: actor.employmentStatus,
    tenantId: actor.tenantId,
    userDepartmentId: actor.departmentId
  });

  if (!decision.allowed) {
    throw forbiddenError(decision.reason || 'You cannot cancel this action.');
  }

  const now = Date.now();
  const update = {
    cancellationReason: reason,
    cancelledAtMs: now,
    cancelledByName: actor.displayName,
    cancelledByUid: actor.uid,
    status: 'CANCELLED' as ActionStatus,
    updatedAtMs: now
  };
  const wasPending = PENDING_STATUSES.includes(current.status);

  await firestore.runTransaction(async (transaction) => {
    transaction.update(ref, update);
    transaction.set(eventsRef(actor.tenantId, input.actionId).doc(), {
      actorName: actor.displayName,
      actorUid: actor.uid,
      atMs: now,
      fromStatus: current.status,
      kind: 'CANCELLED',
      note: reason,
      toStatus: 'CANCELLED'
    });

    // The group's counters must let go of it. Work that was open is no longer
    // open, and work that was done is no longer waiting to be verified, so a
    // badge does not stay lit over something nobody will pick up.
    transaction.set(groupRef(actor.tenantId, current.responsibleGroupId), {
      openActionCount: fieldValue.increment(wasPending ? -1 : 0),
      unverifiedActionCount: fieldValue.increment(current.status === 'DONE' ? -1 : 0)
    }, { merge: true });
  });

  const cancelled = { ...current, ...update };

  // Closed loop. Somebody who reports a fault and hears nothing stops
  // reporting faults, and a cancellation is the outcome most likely to be
  // disputed. See section 9.2 of the governance plan.
  await notifyAboutAction({
    action: cancelled,
    actorUid: actor.uid,
    kind: 'CANCELLED',
    tenantId: actor.tenantId
  });

  return cancelled;
}

export interface ListActionsInput {
  /** A group id, or for a direct chat the other person's uid. */
  chatId?: string;
  chatType?: 'DIRECT' | 'GROUP';
  groupId?: string;
  startAfterId?: string;
  status?: ActionStatus;
}

export interface ActionPage {
  actions: ActionRecord[];
  nextCursor: string | null;
}

/**
 * One page of actions, newest first.
 *
 * Ordered in the query rather than in memory. Sorting the thirty rows that
 * happened to come back and calling them the newest is a bug that hides until
 * the thirty-first action exists.
 */
/**
 * The tenant-wide query, narrowed to what this person may read.
 *
 * Each branch is one Firestore query with its own composite index, committed
 * in `firestore.indexes.json`. Two queries merged in memory would break the
 * ordering, so a page boundary would drop or repeat rows.
 */
function buildScopedActionQuery(tenantId: string, scope: ActionListScope) {
  const collection = actionsRef(tenantId);

  if (scope.kind === 'departments') {
    return collection
      .where('departmentIds', 'array-contains-any', scope.departmentIds)
      .orderBy('createdAtMs', 'desc')
      .limit(ACTION_PAGE_SIZE + 1);
  }

  if (scope.kind === 'own') {
    return collection
      .where('createdByUid', '==', scope.uid)
      .orderBy('createdAtMs', 'desc')
      .limit(ACTION_PAGE_SIZE + 1);
  }

  return collection.orderBy('createdAtMs', 'desc').limit(ACTION_PAGE_SIZE + 1);
}

export interface ReassignActionInput {
  actionId: string;
  detail?: string;
  /** Null hands it back to the whole team. */
  nextPersonUid: string | null;
  reasonId: string;
}

/**
 * Moves an action to somebody else, or back to the team.
 *
 * The counterpart to requiring a name on every action. Both people are told and
 * both see the reason, and the move is written into the action's own history —
 * "who was this with last week" is a question an audit asks, and a field that
 * only ever holds the current answer cannot answer it.
 *
 * The group is not changed. Moving work between teams is a different decision
 * with different owners; this is about who inside the team is holding it.
 */
export async function reassignAction(
  decodedToken: DecodedIdToken,
  input: ReassignActionInput
): Promise<ActionRecord> {
  const actor = await loadActorContext(decodedToken);
  const ref = actionsRef(actor.tenantId).doc(input.actionId);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    throw notFoundError('That action was not found.');
  }

  const current = normalizeAction(snapshot.data() as Record<string, unknown>);
  const reasonCheck = validateReassignmentReason({
    detail: input.detail,
    reasonId: input.reasonId
  });

  if (!reasonCheck.ok) {
    throw validationError(reasonCheck.reason || 'Give a reason for moving this action.');
  }

  const decision = canReassignAction({
    actionStatus: current.status,
    currentPersonUid: current.responsiblePersonUid,
    nextPersonUid: input.nextPersonUid,
    requesterDepartmentId: actor.departmentId,
    requesterRole: actor.role,
    requesterUid: actor.uid,
    responsibleDepartmentId: current.responsibleDepartmentId,
    sourceDepartmentId: current.sourceDepartmentId
  });

  if (!decision.allowed) {
    throw forbiddenError(decision.reason || 'You cannot move this action.');
  }

  const nextPerson = input.nextPersonUid
    ? await loadPerson(actor.tenantId, input.nextPersonUid)
    : null;

  if (input.nextPersonUid && !nextPerson) {
    throw validationError('That person is no longer in this organization.');
  }

  const reason = describeReassignmentReason(input.reasonId, input.detail);
  const now = Date.now();
  const update = {
    responsiblePersonName: nextPerson?.displayName || null,
    responsiblePersonUid: input.nextPersonUid,
    updatedAtMs: now
  };

  await firestore.runTransaction(async (transaction) => {
    transaction.update(ref, update);
    transaction.set(eventsRef(actor.tenantId, input.actionId).doc(), {
      actorName: actor.displayName,
      actorUid: actor.uid,
      atMs: now,
      fromStatus: current.status,
      kind: 'REASSIGNED',
      // Who it left and who it reached, in the note itself. An event that says
      // only "reassigned" leaves the history unreadable a month later.
      note: `${current.responsiblePersonName || 'the team'} to ${nextPerson?.displayName || 'the team'}: ${reason}`,
      toStatus: current.status
    });
  });

  const reassigned = { ...current, ...update };

  await notifyAboutAction({
    action: reassigned,
    actorUid: actor.uid,
    kind: 'REASSIGNED',
    reassignment: {
      previousPersonUid: current.responsiblePersonUid,
      reason
    },
    tenantId: actor.tenantId
  });

  return reassigned;
}

export async function listActions(
  decodedToken: DecodedIdToken,
  input: ListActionsInput
): Promise<ActionPage> {
  const actor = await loadActorContext(decodedToken);
  // With no chat or group named, this is the Actions screen asking for
  // everything the person may see, so it is narrowed by department. Without
  // this the unfiltered branch handed the whole tenant to anybody who asked.
  // See section 3 of SYNZAPP_ACTIONS_GOVERNANCE_PLAN.md.
  const scope = resolveActionListScope({
    departmentId: actor.departmentId,
    isOrgAdmin: actor.role === 'ORG_ADMIN',
    uid: actor.uid
  });
  let query = buildScopedActionQuery(actor.tenantId, scope);

  // An id arriving from the caller is not permission to read what it names.
  // Naming a group you are not in is Broken Object Level Authorization, and it
  // is a defect rather than a product choice. Org admins already see the whole
  // tenant, so this only constrains everybody else.
  if (input.groupId && scope.kind !== 'all') {
    const memberIds = await loadGroupMemberIds(actor.tenantId, input.groupId);

    if (!memberIds.includes(actor.uid)) {
      return { actions: [], nextCursor: null };
    }
  }

  if (input.groupId) {
    query = actionsRef(actor.tenantId)
      .where('responsibleGroupId', '==', input.groupId)
      .orderBy('createdAtMs', 'desc')
      .limit(ACTION_PAGE_SIZE + 1);
  }

  if (input.chatId) {
    // Named from both people, exactly as it was when the action was filed, so
    // this can only ever ask about a conversation the caller is in.
    const sourceChatId = resolveSourceChatId({
      chatId: input.chatId,
      chatType: input.chatType,
      requesterUid: actor.uid
    });

    query = actionsRef(actor.tenantId)
      .where('sourceChatId', '==', sourceChatId)
      .orderBy('createdAtMs', 'desc')
      .limit(ACTION_PAGE_SIZE + 1);
  }

  if (input.startAfterId) {
    const cursor = await actionsRef(actor.tenantId).doc(input.startAfterId).get();

    if (cursor.exists) {
      query = query.startAfter(cursor);
    }
  }

  const snapshot = await query.get();
  const rows = snapshot.docs.map((doc) => normalizeAction(doc.data() as Record<string, unknown>));
  const page = rows.slice(0, ACTION_PAGE_SIZE);
  const filtered = input.status ? page.filter((row) => row.status === input.status) : page;

  return {
    actions: filtered,
    nextCursor: rows.length > ACTION_PAGE_SIZE ? page[page.length - 1].actionId : null
  };
}

export async function getAction(
  decodedToken: DecodedIdToken,
  actionId: string
): Promise<{ action: ActionRecord; attachments: ActionAttachment[]; events: ActionEvent[] }> {
  const actor = await loadActorContext(decodedToken);
  const snapshot = await actionsRef(actor.tenantId).doc(actionId).get();

  if (!snapshot.exists) {
    throw notFoundError('That action was not found.');
  }

  const [eventDocs, attachmentDocs] = await Promise.all([
    eventsRef(actor.tenantId, actionId).orderBy('atMs', 'asc').get(),
    attachmentsRef(actor.tenantId, actionId).orderBy('uploadedAtMs', 'asc').get()
  ]);

  return {
    action: normalizeAction(snapshot.data() as Record<string, unknown>),
    attachments: attachmentDocs.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;

      return {
        attachmentId: doc.id,
        durationMs: (data.durationMs as number) || null,
        kind: (data.kind as 'image' | 'video') || 'image',
        sizeBytes: Number(data.sizeBytes || 0),
        storagePath: String(data.storagePath || ''),
        uploadedAtMs: Number(data.uploadedAtMs || 0),
        uploadedByUid: String(data.uploadedByUid || '')
      };
    }),
    events: eventDocs.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;

      return {
        actorName: String(data.actorName || 'Unknown'),
        actorUid: String(data.actorUid || ''),
        atMs: Number(data.atMs || 0),
        eventId: doc.id,
        fromStatus: (data.fromStatus as ActionStatus) || null,
        kind: (data.kind as ActionEvent['kind']) || 'STATUS_CHANGED',
        note: (data.note as string) || null,
        toStatus: (data.toStatus as ActionStatus) || null
      };
    })
  };
}

export interface ActionCounts {
  pending: number;
  unverified: number;
}

/**
 * The two numbers shown above a group's messages.
 *
 * Read from counters on the group document. Counting rows to show a number,
 * every time somebody opens a chat, is how a screen like this dies.
 */
/**
 * How much this one person is carrying, for the line above the chat list.
 *
 * Counted from their own work, never the company's. A number that is not yours
 * is a number you learn to ignore, and the line stops being read at all.
 *
 * Two queries, each on equality filters only, so no composite index is needed
 * and nothing has to be deployed for this to work. Both are capped: past a
 * couple of hundred the exact figure has stopped meaning anything to a person
 * looking at a chat list, and the cap is what keeps somebody with a long
 * history from paying for it on every load.
 */
export async function getPersonalActionCounts(
  decodedToken: DecodedIdToken
): Promise<ActionDigestCounts> {
  const actor = await loadActorContext(decodedToken);
  const actions = actionsRef(actor.tenantId);
  const [ownedSnapshot, raisedSnapshot] = await Promise.all([
    actions
      .where('responsiblePersonUid', '==', actor.uid)
      .where('status', 'in', ['OPEN', 'IN_PROGRESS', 'BLOCKED'])
      .limit(PERSONAL_COUNT_LIMIT)
      .get(),
    actions
      .where('createdByUid', '==', actor.uid)
      .where('status', '==', 'DONE')
      .limit(PERSONAL_COUNT_LIMIT)
      .get()
  ]);

  return countActionsForDigest({
    actions: ownedSnapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;

      return {
        dueAtMs: typeof data.dueAtMs === 'number' ? data.dueAtMs : null,
        responsiblePersonUid: (data.responsiblePersonUid as string) || null,
        status: String(data.status || '')
      };
    }),
    nowMs: Date.now(),
    uid: actor.uid,
    // Work they raised and somebody else finished. Their own is excluded
    // because the rule that nobody signs off their own work is the point of
    // verification, and counting it here would promise something the server
    // would then refuse.
    verifiableCount: raisedSnapshot.docs.filter((doc) => {
      const data = doc.data() as Record<string, unknown>;

      return data.completedByUid !== actor.uid;
    }).length
  });
}

const PERSONAL_COUNT_LIMIT = 200;

export async function getActionCounts(
  decodedToken: DecodedIdToken,
  groupId: string
): Promise<ActionCounts> {
  const actor = await loadActorContext(decodedToken);
  const group = await groupRef(actor.tenantId, groupId).get();

  if (!group.exists) {
    throw notFoundError('That group was not found.');
  }

  const data = group.data() as Record<string, unknown>;

  return {
    pending: Math.max(Number(data.openActionCount || 0), 0),
    unverified: Math.max(Number(data.unverifiedActionCount || 0), 0)
  };
}

/**
 * Legal holds that cover an action, so retention leaves it alone.
 *
 * A hold on the raiser, the person who completed it, or the verifier is enough:
 * each of them is a custodian of what the record says.
 */
export async function findHoldsCoveringAction(
  tenantId: string,
  action: ActionRecord
): Promise<LegalHoldRecord[]> {
  const holds = await listActiveLegalHolds(tenantId);
  const custodians = [action.createdByUid, action.completedByUid, action.verifiedByUid]
    .filter((uid): uid is string => !!uid);

  return holds.filter((hold) => hold.custodianUids.some((uid) => custodians.includes(uid)));
}

/**
 * Retention removes the words, never the record.
 *
 * The title, the completion note and the attachments go. Who raised it, who did
 * it, who verified it and when all stay, because that is the part a company
 * needs when somebody asks what happened.
 */
export async function removeActionBody(tenantId: string, actionId: string): Promise<void> {
  const ref = actionsRef(tenantId).doc(actionId);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    return;
  }

  const action = normalizeAction(snapshot.data() as Record<string, unknown>);
  const holds = await findHoldsCoveringAction(tenantId, action);

  if (holds.length) {
    throw legalHoldError('That action is under a legal hold.');
  }

  const attachments = await attachmentsRef(tenantId, actionId).get();

  for (const attachment of attachments.docs) {
    const storagePath = String((attachment.data() as Record<string, unknown>).storagePath || '');

    // The file itself, not only the row pointing at it. Deleting the row alone
    // would leave the photo in storage and make the disposal a lie.
    if (storagePath) {
      await storageBucket.file(storagePath).delete().catch(() => undefined);
    }

    await attachment.ref.delete();
  }

  await ref.update({
    attachmentCount: 0,
    bodyRemovedAtMs: Date.now(),
    completionNote: '',
    title: ''
  });
}

async function notifyAboutAction(input: {
  action: ActionRecord;
  actorUid: string;
  kind: 'ASSIGNED' | 'BLOCKED' | 'CANCELLED' | 'DONE' | 'REASSIGNED' | 'STARTED' | 'VERIFIED';
  /** Who it was taken from, and why. Set only for a reassignment. */
  reassignment?: { previousPersonUid: string | null; reason: string };
  tenantId: string;
}): Promise<void> {
  const { action } = input;
  let recipientUids: string[] = [];
  let body = '';
  let title = '';

  if (input.kind === 'ASSIGNED') {
    // A named person is told directly. With nobody named the group is told, so
    // an unassigned action still reaches somebody instead of waiting quietly.
    recipientUids = action.responsiblePersonUid
      ? [action.responsiblePersonUid]
      : await loadGroupMemberIds(input.tenantId, action.responsibleGroupId);
    title = 'New action';
    body = `${action.title} (${action.priority.toLowerCase()} priority) for ${action.responsibleGroupName}.`;
  }

  if (input.kind === 'STARTED' || input.kind === 'BLOCKED') {
    // The person who raised it, and the department admins who own the work.
    // Whoever reported a fault is owed the knowledge that somebody picked it
    // up — and, more importantly, that somebody could not.
    recipientUids = [
      ...(action.createdByUid ? [action.createdByUid] : []),
      ...await loadDepartmentAdminUids(input.tenantId, action.responsibleDepartmentId)
    ];

    if (input.kind === 'STARTED') {
      title = 'Action started';
      body = `${action.responsiblePersonName || action.responsibleGroupName} has started: ${action.title}`;
    } else {
      // The reason is the notification. "Blocked" on its own tells nobody what
      // to do; an action stuck behind a part nobody ordered looks exactly like
      // one being worked on, and the person who could unstick it is the one
      // being told.
      title = 'Action blocked';
      body = `${action.title} — waiting on ${action.blockedReason || 'something'}`;
    }
  }

  if (input.kind === 'REASSIGNED') {
    // Both of them. The person who had it needs to stop, and the person who now
    // has it needs to start — and telling only one is how work is dropped
    // between two people who each believed the other had it.
    const nextRecipients = action.responsiblePersonUid
      ? [action.responsiblePersonUid]
      : await loadGroupMemberIds(input.tenantId, action.responsibleGroupId);

    recipientUids = [
      ...nextRecipients,
      ...(input.reassignment?.previousPersonUid ? [input.reassignment.previousPersonUid] : [])
    ];
    title = 'Action moved';
    body = `${action.title} is now with ${action.responsiblePersonName || action.responsibleGroupName}. ${input.reassignment?.reason || ''}`.trim();
  }

  if (input.kind === 'CANCELLED') {
    // Both the person who raised it and whoever was going to do it. One of them
    // reported a fault and deserves to know it was dropped; the other may be
    // about to start work that is no longer wanted.
    recipientUids = [action.createdByUid, action.responsiblePersonUid || ''].filter(Boolean);
    title = 'Action cancelled';
    body = action.cancellationReason
      ? `${action.title} — ${action.cancellationReason}`
      : action.title;
  }

  if (input.kind === 'DONE') {
    recipientUids = [action.createdByUid];
    title = 'Action completed';
    body = `${action.completedByName || 'Someone'} marked "${action.title}" done. It needs verifying.`;
  }

  if (input.kind === 'VERIFIED') {
    recipientUids = action.completedByUid ? [action.completedByUid] : [];
    title = 'Action verified';
    body = `${action.verifiedByName || 'Someone'} verified "${action.title}".`;
  }

  if (!recipientUids.length) {
    return;
  }

  // Who did it, so the notification shows their face rather than the app icon.
  // A key, never the image: the phone already has these photos cached for the
  // directory, and a payload carrying one would leave a copy of something
  // private in a push service's logs.
  const actorProfilePhotoCacheKey = await readActorProfilePhotoCacheKey(
    input.tenantId,
    input.actorUid
  );

  await sendRailsPushNotification({
    actorUid: input.actorUid,
    // Its own channel, so action notifications can be silenced without
    // silencing RAILS and announcements, which share this sender.
    androidChannelId: ACTION_NOTIFICATION_CHANNEL_ID,
    body,
    channel: 'actions',
    itemId: action.actionId,
    metadata: {
      ...(actorProfilePhotoCacheKey
        ? { notificationSenderProfilePhotoCacheKey: actorProfilePhotoCacheKey }
        : {}),
      actionId: action.actionId,
      actorUid: input.actorUid
    },
    notificationId: `action:${action.actionId}:${input.kind}:${Date.now()}`,
    recipientUids,
    tenantId: input.tenantId,
    title,
    type: `ACTION_${input.kind}`
  });
}

/** 'AuthorizationError' is the name the error handler already maps to 403. */
function forbiddenError(message: string): Error {
  const error = new Error(message);
  error.name = 'AuthorizationError';

  return error;
}

function notFoundError(message: string): Error {
  const error = new Error(message);
  error.name = 'NotFoundError';

  return error;
}

/** Refused because a court may want it. Reported as a conflict, not a failure. */
export const LEGAL_HOLD_ERROR_CODE = 'LEGAL_HOLD';

function legalHoldError(message: string): Error {
  const error = new Error(message);
  error.name = 'ConflictError';

  /**
   * A code, not a name or a wording.
   *
   * Record body disposal needs to tell a hold doing its job from a genuine
   * failure, and it cannot do that from `ConflictError` alone. Matching the
   * message instead is the mistake this codebase has made before, where a
   * revoked device never recognised itself because the prose had changed.
   */
  return Object.assign(error, { code: LEGAL_HOLD_ERROR_CODE });
}

function validationError(message: string): Error {
  const error = new Error(message);
  error.name = 'ValidationError';

  return error;
}

/**
 * Photos and video on an action.
 *
 * The client never chooses where a file lands and never sends a storage path.
 * It asks for an upload, gets back an opaque id and a short lived link, and
 * later names that id when creating the action. The server rebuilds the path
 * from the tenant, the uploader and the id, so a forged path is not a thing
 * that can be sent.
 *
 * These are plain files, not the sealed per-device envelopes chat uses. An
 * action is read by a group the raiser may not belong to, so it cannot be
 * encrypted to one conversation's keys. That is the same decision as the rest
 * of the record, and the person is told before they create it.
 */

function pendingUploadsRef(tenantId: string) {
  return firestore.collection('organizations').doc(tenantId).collection('actionUploads');
}

function attachmentStoragePath(input: {
  attachmentId: string;
  tenantId: string;
  uid: string;
}): string {
  return `organizations/${input.tenantId}/actionAttachments/${input.uid}/${input.attachmentId}`;
}

export interface ActionUploadTicket {
  attachmentId: string;
  expiresAtMs: number;
  uploadUrl: string;
}

export async function createActionUpload(
  decodedToken: DecodedIdToken,
  input: { contentType: string; kind: 'image' | 'video'; sizeBytes: number }
): Promise<ActionUploadTicket> {
  const actor = await loadActorContext(decodedToken);

  if (!canCreateAction({
    permissions: actor.permissions,
    requesterUid: actor.uid,
    role: actor.role,
    access: 'ACTIVE',
    status: actor.employmentStatus,
    tenantId: actor.tenantId
  })) {
    throw forbiddenError('You cannot add attachments in this organization.');
  }

  if (input.sizeBytes > MAX_ATTACHMENT_BYTES) {
    throw validationError('That file is too large. The limit is 50 MB.');
  }

  if (input.kind === 'image' && !input.contentType.startsWith('image/')) {
    throw validationError('That does not look like a photo.');
  }

  if (input.kind === 'video' && !input.contentType.startsWith('video/')) {
    throw validationError('That does not look like a video.');
  }

  const ref = pendingUploadsRef(actor.tenantId).doc();
  const storagePath = attachmentStoragePath({
    attachmentId: ref.id,
    tenantId: actor.tenantId,
    uid: actor.uid
  });
  const expiresAtMs = Date.now() + UPLOAD_URL_TTL_MS;

  await ref.set({
    attachmentId: ref.id,
    contentType: input.contentType,
    createdAtMs: Date.now(),
    kind: input.kind,
    sizeBytes: input.sizeBytes,
    storagePath,
    uploadedByUid: actor.uid
  });

  const [uploadUrl] = await storageBucket.file(storagePath).getSignedUrl({
    action: 'write',
    contentType: input.contentType,
    expires: expiresAtMs,
    version: 'v4'
  });

  return { attachmentId: ref.id, expiresAtMs, uploadUrl };
}

/**
 * Turns reserved uploads into attachments on an action.
 *
 * Each one must belong to this tenant, must have been reserved by this person,
 * and must actually exist in storage. A ticket somebody else reserved, or one
 * whose file was never uploaded, is refused rather than recorded as a photo
 * that will not load.
 */
async function attachPendingUploads(input: {
  actionId: string;
  attachmentIds: string[];
  tenantId: string;
  uid: string;
}): Promise<number> {
  let attached = 0;

  for (const attachmentId of input.attachmentIds) {
    const pending = await pendingUploadsRef(input.tenantId).doc(attachmentId).get();

    if (!pending.exists) {
      throw validationError('One of those attachments was not recognised.');
    }

    const data = pending.data() as Record<string, unknown>;

    if (String(data.uploadedByUid) !== input.uid) {
      throw forbiddenError('One of those attachments belongs to somebody else.');
    }

    const storagePath = String(data.storagePath);
    const [exists] = await storageBucket.file(storagePath).exists();

    if (!exists) {
      throw validationError('One of those files did not finish uploading.');
    }

    await attachmentsRef(input.tenantId, input.actionId).doc(attachmentId).set({
      contentType: String(data.contentType || ''),
      durationMs: (data.durationMs as number) || null,
      kind: (data.kind as 'image' | 'video') || 'image',
      sizeBytes: Number(data.sizeBytes || 0),
      storagePath,
      uploadedAtMs: Date.now(),
      uploadedByUid: input.uid
    });
    await pending.ref.delete();
    attached += 1;
  }

  return attached;
}

/** Short lived links for viewing what is attached to an action. */
export async function listActionAttachmentUrls(
  decodedToken: DecodedIdToken,
  actionId: string
): Promise<Array<{
  attachmentId: string;
  kind: 'image' | 'video';
  sizeBytes: number;
  url: string;
}>> {
  const actor = await loadActorContext(decodedToken);
  const action = await actionsRef(actor.tenantId).doc(actionId).get();

  if (!action.exists) {
    throw notFoundError('That action was not found.');
  }

  const attachments = await attachmentsRef(actor.tenantId, actionId).orderBy('uploadedAtMs', 'asc').get();
  const expiresAtMs = Date.now() + DOWNLOAD_URL_TTL_MS;
  const results = [];

  for (const doc of attachments.docs) {
    const data = doc.data() as Record<string, unknown>;
    const [url] = await storageBucket.file(String(data.storagePath)).getSignedUrl({
      action: 'read',
      expires: expiresAtMs,
      version: 'v4'
    });

    results.push({
      attachmentId: doc.id,
      kind: (data.kind as 'image' | 'video') || 'image',
      sizeBytes: Number(data.sizeBytes || 0),
      url
    });
  }

  return results;
}

/**
 * Clears reservations nobody ever used.
 *
 * Somebody picks three photos, changes their mind and closes the sheet. The
 * files are already in storage and would sit there forever otherwise.
 */
export async function purgeStaleActionUploads(tenantId: string): Promise<number> {
  const cutoff = Date.now() - PENDING_UPLOAD_TTL_MS;
  const stale = await pendingUploadsRef(tenantId).where('createdAtMs', '<', cutoff).get();
  let removed = 0;

  for (const doc of stale.docs) {
    const storagePath = String((doc.data() as Record<string, unknown>).storagePath || '');

    if (storagePath) {
      await storageBucket.file(storagePath).delete().catch(() => undefined);
    }

    await doc.ref.delete();
    removed += 1;
  }

  return removed;
}
