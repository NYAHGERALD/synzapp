import { DecodedIdToken } from 'firebase-admin/auth';
import type { Request } from 'express';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import { SynzappRole } from '../types/auth.js';
import {
  canOrgAdminUsePermission,
  isActiveTenantSession
} from './authorizationPolicy.js';
import { buildAuthSession } from './authSessionService.js';
import { writeAuditEvent } from './auditService.js';
import {
  type ScheduledMessagePolicy,
  type ScheduledMessageStatus,
  canCancelScheduledMessage,
  canDismissScheduledMessage,
  checkScheduleRequest,
  validateAdminCancellationReason,
  describeScheduleRejection,
  isPendingScheduledMessage,
  isVisibleToSender,
  normalizeScheduledMessagePolicy,
  resolveReleaseFailureStatus,
  selectDeliverableRecipientDevices,
  validateScheduledMessagePolicyInput
} from './scheduledMessageRules.js';
import {
  getEncryptedDirectContext,
  releaseEncryptedDirectEnvelope,
  type SendEncryptedDirectEnvelopeInput
} from './encryptedMessageEnvelopeService.js';
import { sendChatMessagePushNotification } from './notificationService.js';

/**
 * Messages written now and sent later.
 *
 * A scheduled message waits on the server rather than on the phone, because a
 * phone cannot be relied on to be awake at nine on Monday morning — neither
 * platform will wake an app at a wall-clock time, and a scheduled message that
 * does not send is worse than not having the feature.
 *
 * What waits here is the **sealed** message, exactly as the phone produced it.
 * The server stores a blob it cannot read and replays it later through the same
 * send path an ordinary message takes, so releasing one is not a second kind of
 * sending with its own rules to keep correct.
 *
 * See `SYNZAPP_SCHEDULED_MESSAGES_PLAN.md`.
 */

export interface ScheduledMessagePolicyResponse extends ScheduledMessagePolicy {
  updatedAt: string | null;
  updatedByUid: string | null;
}

/** What the author of a message sees. Carries the sealed message, which their own device can open. */
export interface ScheduledMessageResponse {
  chatType: 'DIRECT';
  clientMessageId: string;
  contactId: string;
  conversationId: string;
  createdAt: string | null;
  envelope: StoredScheduledEnvelope;
  /** Why an administrator stopped it. Shown to the author, never invented. */
  cancellationReason: string | null;
  /** Set when somebody other than the author stopped it. */
  cancelledByAdmin: boolean;
  envelopeId: string | null;
  lastError: string | null;
  releaseAt: string;
  releaseAtMs: number;
  scheduledMessageId: string;
  senderUid: string;
  sentAt: string | null;
  status: ScheduledMessageStatus;
  timeZone: string;
}

/**
 * What an Org Admin sees.
 *
 * Deliberately a different shape rather than the same one with fields removed.
 * The sealed message is not in this type at all, so there is no version of this
 * code in which forgetting to strip a field quietly hands an admin something to
 * decrypt — and the archive key is among a message's readers, so that would be
 * a real decryption and not a theoretical one.
 */
export interface TenantScheduledMessageResponse {
  chatType: 'DIRECT';
  conversationId: string;
  createdAt: string | null;
  /** The sender's department, so a large list can be narrowed to one team. */
  departmentId: string;
  departmentName: string;
  recipientName: string;
  recipientUid: string;
  releaseAt: string;
  releaseAtMs: number;
  scheduledMessageId: string;
  senderName: string;
  senderUid: string;
  status: ScheduledMessageStatus;
  timeZone: string;
}

export interface ScheduleDirectMessageInput extends SendEncryptedDirectEnvelopeInput {
  releaseAtMs: number;
  timeZone: string;
}

export interface ScheduledMessageRunSummary {
  cancelledBeforeRelease: number;
  claimed: number;
  failed: number;
  released: number;
  retrying: number;
}

interface StoredScheduledEnvelope {
  algorithm: string;
  ciphertext: string;
  encryptedKeysByDevice: Record<string, string>;
  keyVersion: number;
  nonce: string;
  notificationPreviewByDevice?: Record<string, unknown>;
  recipientDeviceIds: string[];
  senderDeviceId: string;
  /**
   * The public half of the key the message was sealed with.
   *
   * Kept so the author can read back what they wrote. Opening a message means
   * combining your own private key with the sender's public one, and for a
   * message that has not been sent there is no envelope record to take it from.
   * Without this a second phone belonging to the same person could not show the
   * message it is offering to cancel.
   */
  senderKeyAgreementPublicKey: string;
}

interface ScheduledMessageRecord {
  attempts?: number;
  cancellationReason?: string | null;
  cancelledByUid?: string | null;
  chatType?: string;
  dismissedAt?: FirebaseDateLike;
  clientMessageId?: string;
  contactId?: string;
  conversationId?: string;
  createdAt?: FirebaseDateLike;
  envelope?: StoredScheduledEnvelope;
  envelopeId?: string | null;
  lastError?: string | null;
  releaseAtMs?: number;
  scheduledMessageId?: string;
  senderDeviceId?: string;
  senderUid?: string;
  sentAtMs?: number | null;
  status?: string;
  tenantId?: string;
  timeZone?: string;
}

interface OrganizationRecord {
  scheduledMessagePolicy?: Record<string, unknown> & {
    updatedAt?: FirebaseDateLike;
    updatedByUid?: string | null;
  };
  status?: string;
}

interface TenantUserRecord {
  departmentId?: string;
  departmentName?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  role?: SynzappRole;
  status?: string;
}

interface FirebaseDateLike {
  toMillis?: () => number;
  seconds?: number;
}

/**
 * How many are released in one run.
 *
 * The worker runs every minute, so this is a ceiling on a minute's work rather
 * than on a company's use. Anything not reached is simply due again on the next
 * run, a minute later.
 */
const RELEASE_BATCH_LIMIT = 200;

export async function getScheduledMessagePolicyForCurrentUser(
  decodedToken: DecodedIdToken
): Promise<ScheduledMessagePolicyResponse> {
  const { tenantId } = await requireActiveTenantUser(decodedToken);

  return readScheduledMessagePolicy(tenantId);
}

export async function updateScheduledMessagePolicy(
  decodedToken: DecodedIdToken,
  input: {
    adminVisibilityEnabled: boolean;
    enabled: boolean;
    maxDaysAhead: number;
    maxPendingPerUser: number;
  }
): Promise<ScheduledMessagePolicyResponse> {
  const { tenantId } = await requireSecurityAdmin(decodedToken);
  const validation = validateScheduledMessagePolicyInput(input);

  if (!validation.ok) {
    throw validationError(validation.reason || 'That setting is not allowed.');
  }

  const organizationRef = firestore.collection('organizations').doc(tenantId);

  await organizationRef.set({
    scheduledMessagePolicy: {
      adminVisibilityEnabled: input.adminVisibilityEnabled,
      enabled: input.enabled,
      maxDaysAhead: input.maxDaysAhead,
      maxPendingPerUser: input.maxPendingPerUser,
      updatedAt: fieldValue.serverTimestamp(),
      updatedByUid: decodedToken.uid
    },
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });

  return readScheduledMessagePolicy(tenantId);
}

/**
 * Parks a sealed message until the time its author chose.
 *
 * The conversation is checked here exactly as it is on an ordinary send, so a
 * message can never be scheduled into a chat the sender could not write to now.
 * It is checked again at release, because between the two the answer can change.
 */
export async function scheduleDirectMessage(
  decodedToken: DecodedIdToken,
  contactId: string,
  input: ScheduleDirectMessageInput
): Promise<ScheduledMessageResponse> {
  const context = await getEncryptedDirectContext(decodedToken, contactId);
  const policy = await readScheduledMessagePolicy(context.tenantId);
  const scheduledMessagesRef = firestore
    .collection('organizations')
    .doc(context.tenantId)
    .collection('scheduledMessages');
  const pendingSnapshot = await scheduledMessagesRef
    .where('senderUid', '==', decodedToken.uid)
    .where('status', '==', 'SCHEDULED')
    .get();
  const decision = checkScheduleRequest({
    mediaCount: input.mediaIds?.length || 0,
    nowMs: Date.now(),
    pendingCount: pendingSnapshot.size,
    policy,
    releaseAtMs: input.releaseAtMs
  });

  if (!decision.ok && decision.reason) {
    throw validationError(describeScheduleRejection(decision.reason, policy));
  }

  const uniqueRecipientDeviceIds = Array.from(new Set(input.recipientDeviceIds));

  uniqueRecipientDeviceIds.forEach((deviceId) => {
    if (!input.encryptedKeysByDevice[deviceId]) {
      throw validationError('Encrypted key material is missing for a recipient device.');
    }
  });

  const senderKeyAgreementPublicKey = await readActiveDeviceKeyAgreementPublicKey(
    context.tenantId,
    decodedToken.uid,
    input.senderDeviceId
  );

  if (!senderKeyAgreementPublicKey) {
    throw authorizationError('This device is not authorized.');
  }

  const scheduledMessageRef = scheduledMessagesRef.doc();
  const envelope: StoredScheduledEnvelope = {
    algorithm: input.algorithm,
    ciphertext: input.ciphertext,
    encryptedKeysByDevice: input.encryptedKeysByDevice,
    keyVersion: input.keyVersion,
    nonce: input.nonce,
    ...(input.notificationPreviewByDevice
      ? { notificationPreviewByDevice: input.notificationPreviewByDevice }
      : {}),
    recipientDeviceIds: uniqueRecipientDeviceIds,
    senderDeviceId: input.senderDeviceId,
    senderKeyAgreementPublicKey
  };

  await scheduledMessageRef.set({
    attempts: 0,
    chatType: 'DIRECT',
    clientMessageId: input.clientMessageId,
    contactId: context.contactId,
    conversationId: context.chatId,
    createdAt: fieldValue.serverTimestamp(),
    envelope,
    envelopeId: null,
    lastError: null,
    // The queue field. Present only while a message is still waiting, so a run
    // never has to look past thousands of finished ones to find the due few.
    //
    // It is indexed for collection-group queries by an explicit entry in
    // `firestore.indexes.json`. Firestore's automatic single-field indexes have
    // collection scope only — a fact this feature learned the hard way, from a
    // FAILED_PRECONDITION on its first real request.
    pendingReleaseAtMs: input.releaseAtMs,
    releaseAtMs: input.releaseAtMs,
    scheduledMessageId: scheduledMessageRef.id,
    senderDeviceId: input.senderDeviceId,
    senderUid: decodedToken.uid,
    sentAtMs: null,
    status: 'SCHEDULED',
    tenantId: context.tenantId,
    timeZone: normalizeTimeZone(input.timeZone),
    updatedAt: fieldValue.serverTimestamp()
  });

  const snapshot = await scheduledMessageRef.get();

  return mapScheduledMessage(snapshot.data() as ScheduledMessageRecord, scheduledMessageRef.id);
}

/**
 * What this person still has outstanding: waiting, and failed.
 *
 * Every one of their messages is fetched and filtered here rather than asked
 * for by status, because two statuses would need either two queries or a
 * composite index, and the number a person has outstanding is small by policy —
 * twenty by default.
 */
export async function listMyScheduledMessages(
  decodedToken: DecodedIdToken,
  options: { contactId?: string } = {}
): Promise<ScheduledMessageResponse[]> {
  const { tenantId } = await requireActiveTenantUser(decodedToken);
  const snapshot = await firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('scheduledMessages')
    .where('senderUid', '==', decodedToken.uid)
    .get();
  const safeContactId = options.contactId?.trim();

  return snapshot.docs
    .filter((doc) => isVisibleToSender(doc.data() as ScheduledMessageRecord))
    .map((doc) => mapScheduledMessage(doc.data() as ScheduledMessageRecord, doc.id))
    .filter((message) => !safeContactId || message.contactId === safeContactId)
    .sort((first, second) => first.releaseAtMs - second.releaseAtMs);
}

/**
 * Clears a failure off the author's list.
 *
 * The record stays, with its status and its reason. Only a flag is set, so what
 * the organization actually attempted to send remains answerable later — a list
 * somebody can edit by tapping is not an audit trail.
 */
export async function dismissScheduledMessage(
  decodedToken: DecodedIdToken,
  scheduledMessageId: string
): Promise<void> {
  const { tenantId } = await requireActiveTenantUser(decodedToken);
  const scheduledMessageRef = firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('scheduledMessages')
    .doc(scheduledMessageId.trim());

  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(scheduledMessageRef);

    if (!snapshot.exists) {
      throw notFoundError('That scheduled message was not found.');
    }

    const record = snapshot.data() as ScheduledMessageRecord;

    if (record.tenantId !== tenantId) {
      throw notFoundError('That scheduled message was not found.');
    }

    if (record.dismissedAt) {
      return;
    }

    if (!canDismissScheduledMessage({
      callerUid: decodedToken.uid,
      senderUid: record.senderUid || '',
      status: record.status
    })) {
      throw validationError('Only a message that could not be sent can be cleared.');
    }

    transaction.set(scheduledMessageRef, {
      dismissedAt: fieldValue.serverTimestamp(),
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });
  });
}

/**
 * What an Org Admin can see: that a message is waiting, from whom, to whom, and
 * when. Never what it says.
 */
export async function listTenantScheduledMessages(
  decodedToken: DecodedIdToken
): Promise<TenantScheduledMessageResponse[]> {
  const { tenantId } = await requireSecurityAdmin(decodedToken);
  const policy = await readScheduledMessagePolicy(tenantId);

  if (!policy.adminVisibilityEnabled) {
    throw authorizationError('Your organization has turned off admin visibility of scheduled messages.');
  }

  const snapshot = await firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('scheduledMessages')
    .where('status', '==', 'SCHEDULED')
    .get();
  const records = snapshot.docs.map((doc) => ({
    id: doc.id,
    record: doc.data() as ScheduledMessageRecord
  }));
  const userIds = Array.from(new Set(records.flatMap(({ record }) => [
    record.senderUid || '',
    record.contactId || ''
  ]).filter(Boolean)));
  const users = await getTenantUsersById(tenantId, userIds);

  return records
    .map(({ id, record }) => mapTenantScheduledMessage(record, id, users))
    .sort((first, second) => first.releaseAtMs - second.releaseAtMs);
}

export async function cancelScheduledMessage(
  decodedToken: DecodedIdToken,
  scheduledMessageId: string,
  options: { asOrgAdmin?: boolean; reason?: string } = {}
): Promise<ScheduledMessageResponse> {
  if (options.asOrgAdmin) {
    // Checked before the admin session is even resolved, so a stop without a
    // reason fails in the same way every time and never half-happens.
    const reasonCheck = validateAdminCancellationReason(options.reason);

    if (!reasonCheck.ok) {
      throw validationError(reasonCheck.reason || 'A reason is required.');
    }
  }

  const caller = options.asOrgAdmin
    ? await requireSecurityAdmin(decodedToken)
    : await requireActiveTenantUser(decodedToken);
  const policy = await readScheduledMessagePolicy(caller.tenantId);
  const scheduledMessageRef = firestore
    .collection('organizations')
    .doc(caller.tenantId)
    .collection('scheduledMessages')
    .doc(scheduledMessageId.trim());

  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(scheduledMessageRef);

    if (!snapshot.exists) {
      throw notFoundError('That scheduled message was not found.');
    }

    const record = snapshot.data() as ScheduledMessageRecord;

    if (record.tenantId !== caller.tenantId) {
      throw notFoundError('That scheduled message was not found.');
    }

    if (!canCancelScheduledMessage({
      callerIsOrgAdminWithSecurityPermission: Boolean(options.asOrgAdmin),
      callerUid: decodedToken.uid,
      policy,
      senderUid: record.senderUid || ''
    })) {
      throw authorizationError('You cannot cancel that scheduled message.');
    }

    if (record.status === 'CANCELLED') {
      // Already stopped. Saying so again is not an error — two taps on a slow
      // connection must not produce a failure the person has to make sense of.
      return;
    }

    if (!isPendingScheduledMessage(record.status)) {
      throw validationError('That message can no longer be cancelled.');
    }

    transaction.set(scheduledMessageRef, {
      cancelledAt: fieldValue.serverTimestamp(),
      cancelledByUid: decodedToken.uid,
      cancellationReason: options.reason?.trim() || (options.asOrgAdmin
        ? 'Cancelled by organization admin'
        : 'Cancelled by the sender'),
      // Out of the queue entirely. A field that is absent matches no query on
      // it, which is why this is removed rather than blanked.
      pendingReleaseAtMs: fieldValue.delete(),
      status: 'CANCELLED',
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });
  });

  const snapshot = await scheduledMessageRef.get();

  return mapScheduledMessage(snapshot.data() as ScheduledMessageRecord, scheduledMessageRef.id);
}

/**
 * Sends a waiting message now, at its author's request.
 *
 * Brings the release time forward rather than sending directly, so the message
 * goes through exactly the path it would have gone through on its own — the
 * same checks, the same claim, the same record. There is only one way a
 * scheduled message is ever sent.
 */
export async function sendScheduledMessageNow(
  decodedToken: DecodedIdToken,
  scheduledMessageId: string,
  req: Request
): Promise<ScheduledMessageResponse> {
  const { tenantId } = await requireActiveTenantUser(decodedToken);
  const scheduledMessageRef = firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('scheduledMessages')
    .doc(scheduledMessageId.trim());
  const snapshot = await scheduledMessageRef.get();

  if (!snapshot.exists) {
    throw notFoundError('That scheduled message was not found.');
  }

  const record = snapshot.data() as ScheduledMessageRecord;

  if (record.tenantId !== tenantId || record.senderUid !== decodedToken.uid) {
    throw notFoundError('That scheduled message was not found.');
  }

  if (!isPendingScheduledMessage(record.status)) {
    throw validationError('That message can no longer be sent.');
  }

  await releaseOneScheduledMessage(scheduledMessageRef, req);

  const releasedSnapshot = await scheduledMessageRef.get();

  return mapScheduledMessage(releasedSnapshot.data() as ScheduledMessageRecord, scheduledMessageRef.id);
}

/**
 * Sends everything that has come due, across every company.
 *
 * Called by Cloud Scheduler once a minute. The query asks only for the queue
 * field, which finished messages no longer carry, so the cost of a run is the
 * number of messages actually due rather than the number ever scheduled.
 */
export async function runDueScheduledMessages(req: Request): Promise<ScheduledMessageRunSummary> {
  const nowMs = Date.now();
  const dueSnapshot = await firestore
    .collectionGroup('scheduledMessages')
    .where('pendingReleaseAtMs', '<=', nowMs)
    .orderBy('pendingReleaseAtMs', 'asc')
    .limit(RELEASE_BATCH_LIMIT)
    .get();
  const summary: ScheduledMessageRunSummary = {
    cancelledBeforeRelease: 0,
    claimed: 0,
    failed: 0,
    released: 0,
    retrying: 0
  };

  for (const doc of dueSnapshot.docs) {
    const outcome = await releaseOneScheduledMessage(doc.ref, req);

    if (outcome === 'SKIPPED') {
      summary.cancelledBeforeRelease += 1;
      continue;
    }

    summary.claimed += 1;

    if (outcome === 'SENT') {
      summary.released += 1;
    } else if (outcome === 'RETRYING') {
      summary.retrying += 1;
    } else {
      summary.failed += 1;
    }
  }

  return summary;
}

type ReleaseOutcome = 'FAILED' | 'RETRYING' | 'SENT' | 'SKIPPED';

/**
 * Claims one message and sends it.
 *
 * The claim is a transaction so that two overlapping runs cannot both take the
 * same message. The send behind it is already idempotent — it is keyed on the
 * client message id, exactly as a retried send from a phone is — so a duplicate
 * could not reach anybody even if the claim were lost; the claim exists so the
 * work, the push and the recorded status are not done twice either.
 */
async function releaseOneScheduledMessage(
  scheduledMessageRef: FirebaseFirestore.DocumentReference,
  req: Request
): Promise<ReleaseOutcome> {
  let claimed: ScheduledMessageRecord | null = null;

  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(scheduledMessageRef);

    if (!snapshot.exists) {
      return;
    }

    const record = snapshot.data() as ScheduledMessageRecord;

    if (!isPendingScheduledMessage(record.status)) {
      return;
    }

    claimed = { ...record, attempts: (record.attempts || 0) + 1 };

    transaction.set(scheduledMessageRef, {
      attempts: claimed.attempts,
      claimedAt: fieldValue.serverTimestamp(),
      status: 'SENDING',
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });
  });

  // Asserted because TypeScript cannot see the assignment made inside the
  // transaction callback, and narrows the variable to null on the strength of
  // its initialiser alone.
  const record = claimed as ScheduledMessageRecord | null;

  if (!record) {
    return 'SKIPPED';
  }

  try {
    const envelope = await deliverClaimedScheduledMessage(record);

    await scheduledMessageRef.set({
      envelopeId: envelope.envelopeId,
      lastError: null,
      pendingReleaseAtMs: fieldValue.delete(),
      sentAtMs: Date.parse(envelope.sentAt),
      status: 'SENT',
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });

    await writeScheduledMessageAudit({
      action: 'CHAT_MESSAGE_SCHEDULE_RELEASED',
      metadata: {
        attempts: record.attempts,
        envelopeId: envelope.envelopeId,
        recipientDeviceCount: envelope.recipientDeviceIds.length
      },
      record,
      req,
      status: 'SUCCESS'
    });

    if (!envelope.isDuplicate) {
      void sendChatMessagePushNotification({
        conversationId: envelope.conversationId,
        envelopeId: envelope.envelopeId,
        notificationPreviewByDevice: envelope.notificationPreviewByDevice,
        recipientDeviceIds: envelope.recipientDeviceIds,
        recipientUid: record.contactId || '',
        senderKeyAgreementPublicKey: envelope.senderKeyAgreementPublicKey,
        senderUid: record.senderUid || '',
        sentAt: envelope.sentAt,
        tenantId: envelope.tenantId
      }).catch(() => undefined);
    }

    return 'SENT';
  } catch (error) {
    const failure = resolveReleaseFailureStatus({
      attempts: record.attempts || 1,
      error
    });
    const reason = error instanceof Error ? error.message : 'The message could not be sent.';

    await scheduledMessageRef.set({
      lastError: reason,
      status: failure.nextStatus,
      updatedAt: fieldValue.serverTimestamp(),
      // Back into the queue for another attempt, or out of it for good. A
      // message given up on keeps its record and its reason: one that vanished
      // is indistinguishable from one that was never scheduled.
      ...(failure.willRetry ? {} : { pendingReleaseAtMs: fieldValue.delete() })
    }, { merge: true });

    if (!failure.willRetry) {
      await writeScheduledMessageAudit({
        action: 'CHAT_MESSAGE_SCHEDULE_FAILED',
        metadata: { attempts: record.attempts },
        reason,
        record,
        req,
        status: 'FAILED'
      });
    }

    return failure.willRetry ? 'RETRYING' : 'FAILED';
  }
}

/**
 * Sends the message a claim has taken.
 *
 * The sender's role is read now rather than trusted from when the message was
 * written, because a person's role can change while a message waits and the
 * conversation rules are decided by the role they hold at the moment it goes.
 */
async function deliverClaimedScheduledMessage(record: ScheduledMessageRecord) {
  const tenantId = record.tenantId || '';
  const senderUid = record.senderUid || '';
  const contactId = record.contactId || '';
  const envelope = record.envelope;

  if (!tenantId || !senderUid || !contactId || !envelope) {
    throw validationError('That scheduled message is incomplete.');
  }

  const senderSnapshot = await firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('users')
    .doc(senderUid)
    .get();

  if (!senderSnapshot.exists) {
    throw notFoundError('The sender is no longer part of this organization.');
  }

  const sender = senderSnapshot.data() as TenantUserRecord;

  if (!sender.role) {
    throw authorizationError('The sender no longer has a role in this organization.');
  }

  const activeRecipientDeviceIds = await listActiveRecipientDeviceIds(tenantId, contactId);
  const deliverableDeviceIds = selectDeliverableRecipientDevices(
    envelope.recipientDeviceIds || [],
    activeRecipientDeviceIds
  );

  if (!deliverableDeviceIds.length) {
    // Every device this was sealed to has gone. Nothing can open it, and
    // sending it anyway would put an unreadable message in somebody's chat.
    throw validationError('No recipient device could receive this message.');
  }

  return releaseEncryptedDirectEnvelope({
    contactId,
    envelope: {
      algorithm: envelope.algorithm,
      ciphertext: envelope.ciphertext,
      clientMessageId: record.clientMessageId || '',
      encryptedKeysByDevice: envelope.encryptedKeysByDevice,
      keyVersion: envelope.keyVersion,
      mediaIds: [],
      nonce: envelope.nonce,
      notificationPreviewByDevice: envelope.notificationPreviewByDevice as
        SendEncryptedDirectEnvelopeInput['notificationPreviewByDevice'],
      recipientDeviceIds: deliverableDeviceIds,
      senderDeviceId: envelope.senderDeviceId
    },
    role: sender.role,
    senderUid,
    tenantId
  });
}

/**
 * The public key of one active device, or null if it is not active.
 *
 * Doubles as the check that the phone doing the scheduling is a device this
 * person is allowed to send from, at the moment they schedule.
 */
async function readActiveDeviceKeyAgreementPublicKey(
  tenantId: string,
  uid: string,
  deviceId: string
): Promise<string | null> {
  const snapshot = await firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('deviceKeys')
    .doc(deviceId)
    .get();

  if (!snapshot.exists) {
    return null;
  }

  const device = snapshot.data() as {
    keyAgreementPublicKey?: string;
    status?: string;
    tenantId?: string;
    uid?: string;
  };

  if (device.tenantId !== tenantId || device.uid !== uid || device.status !== 'ACTIVE') {
    return null;
  }

  return device.keyAgreementPublicKey || null;
}

async function listActiveRecipientDeviceIds(tenantId: string, uid: string): Promise<string[]> {
  const snapshot = await firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('deviceKeys')
    .where('uid', '==', uid)
    .where('status', '==', 'ACTIVE')
    .get();

  return snapshot.docs
    .map((doc) => (doc.data() as { deviceId?: string }).deviceId || doc.id)
    .filter(Boolean);
}

export async function writeScheduledMessageAudit(input: {
  action: string;
  metadata?: Record<string, unknown>;
  reason?: string;
  record: Pick<ScheduledMessageRecord, 'contactId' | 'conversationId' | 'releaseAtMs' | 'senderUid' | 'tenantId' | 'timeZone'>;
  req: Request;
  status: 'DENIED' | 'FAILED' | 'SUCCESS';
}): Promise<void> {
  await writeAuditEvent({
    action: input.action,
    metadata: {
      ...(input.metadata || {}),
      conversationId: input.record.conversationId,
      recipientUid: input.record.contactId,
      releaseAtMs: input.record.releaseAtMs,
      timeZone: input.record.timeZone
    },
    reason: input.reason,
    req: input.req,
    status: input.status,
    tenantId: input.record.tenantId,
    uid: input.record.senderUid
  }).catch(() => undefined);
}

async function readScheduledMessagePolicy(tenantId: string): Promise<ScheduledMessagePolicyResponse> {
  const snapshot = await firestore.collection('organizations').doc(tenantId).get();
  const organization = snapshot.data() as OrganizationRecord | undefined;
  const stored = organization?.scheduledMessagePolicy;

  return {
    ...normalizeScheduledMessagePolicy(stored),
    updatedAt: dateLikeToIso(stored?.updatedAt),
    updatedByUid: stored?.updatedByUid || null
  };
}

async function requireActiveTenantUser(decodedToken: DecodedIdToken): Promise<{ tenantId: string }> {
  const session = await buildAuthSession(decodedToken);
  const { status, tenantId } = session.user;

  if (session.access !== 'ACTIVE' || status !== 'ACTIVE' || !tenantId) {
    throw authorizationError('Your profile is not active.');
  }

  return { tenantId };
}

async function requireSecurityAdmin(decodedToken: DecodedIdToken): Promise<{ tenantId: string }> {
  const session = await buildAuthSession(decodedToken);
  const { permissions, role, status, tenantId } = session.user;
  const policyInput = {
    access: session.access,
    permissions,
    role,
    status,
    tenantId
  };

  if (!isActiveTenantSession(policyInput)) {
    throw authorizationError('Your admin session is not active.');
  }

  if (!canOrgAdminUsePermission(policyInput, 'security.manage')) {
    throw authorizationError('You do not have permission to manage scheduled messages.');
  }

  return { tenantId: tenantId as string };
}

async function getTenantUsersById(
  tenantId: string,
  userIds: string[]
): Promise<Map<string, TenantUserRecord>> {
  const users = new Map<string, TenantUserRecord>();

  await Promise.all(userIds.map(async (uid) => {
    const snapshot = await firestore
      .collection('organizations')
      .doc(tenantId)
      .collection('users')
      .doc(uid)
      .get();

    if (snapshot.exists) {
      users.set(uid, snapshot.data() as TenantUserRecord);
    }
  }));

  return users;
}

function mapScheduledMessage(
  record: ScheduledMessageRecord,
  scheduledMessageId: string
): ScheduledMessageResponse {
  const releaseAtMs = record.releaseAtMs || 0;

  return {
    chatType: 'DIRECT',
    clientMessageId: record.clientMessageId || '',
    contactId: record.contactId || '',
    conversationId: record.conversationId || '',
    cancellationReason: record.cancellationReason || null,
    cancelledByAdmin: Boolean(record.cancelledByUid) && record.cancelledByUid !== record.senderUid,
    createdAt: dateLikeToIso(record.createdAt),
    envelope: record.envelope || {
      algorithm: '',
      ciphertext: '',
      encryptedKeysByDevice: {},
      keyVersion: 1,
      nonce: '',
      recipientDeviceIds: [],
      senderDeviceId: '',
      senderKeyAgreementPublicKey: ''
    },
    envelopeId: record.envelopeId || null,
    lastError: record.lastError || null,
    releaseAt: new Date(releaseAtMs).toISOString(),
    releaseAtMs,
    scheduledMessageId: record.scheduledMessageId || scheduledMessageId,
    senderUid: record.senderUid || '',
    sentAt: record.sentAtMs ? new Date(record.sentAtMs).toISOString() : null,
    status: normalizeStatus(record.status),
    timeZone: record.timeZone || 'UTC'
  };
}

/**
 * Builds the admin's view from scratch rather than by removing fields.
 *
 * Every field here is named deliberately. Nothing is spread in from the stored
 * record, so a field added to storage later cannot arrive in an admin's hands
 * because somebody forgot to exclude it.
 */
function mapTenantScheduledMessage(
  record: ScheduledMessageRecord,
  scheduledMessageId: string,
  users: Map<string, TenantUserRecord>
): TenantScheduledMessageResponse {
  const releaseAtMs = record.releaseAtMs || 0;
  const sender = users.get(record.senderUid || '');

  return {
    chatType: 'DIRECT',
    conversationId: record.conversationId || '',
    createdAt: dateLikeToIso(record.createdAt),
    departmentId: sender?.departmentId || '',
    departmentName: sender?.departmentName || sender?.departmentId || 'No department',
    recipientName: formatUserName(users.get(record.contactId || '')),
    recipientUid: record.contactId || '',
    releaseAt: new Date(releaseAtMs).toISOString(),
    releaseAtMs,
    scheduledMessageId: record.scheduledMessageId || scheduledMessageId,
    senderName: formatUserName(users.get(record.senderUid || '')),
    senderUid: record.senderUid || '',
    status: normalizeStatus(record.status),
    timeZone: record.timeZone || 'UTC'
  };
}

function formatUserName(user?: TenantUserRecord): string {
  const name = user?.displayName?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();

  return name || 'Unknown person';
}

function normalizeStatus(status?: string): ScheduledMessageStatus {
  return status === 'CANCELLED' ||
    status === 'FAILED' ||
    status === 'SENDING' ||
    status === 'SENT'
    ? status
    : 'SCHEDULED';
}

/**
 * The zone as a short label, or UTC.
 *
 * Stored for display and for the audit trail — never used to recompute the
 * moment, which is already fixed by `releaseAtMs`.
 */
function normalizeTimeZone(timeZone: string): string {
  const trimmed = (timeZone || '').trim();

  return /^[A-Za-z0-9+_\-/]{1,64}$/.test(trimmed) ? trimmed : 'UTC';
}

function dateLikeToIso(dateLike?: FirebaseDateLike): string | null {
  const milliseconds = dateLike?.toMillis?.() || ((dateLike?.seconds || 0) * 1000);

  return milliseconds ? new Date(milliseconds).toISOString() : null;
}

function authorizationError(message: string): Error {
  const error = new Error(message);
  error.name = 'AuthorizationError';
  return error;
}

function notFoundError(message: string): Error {
  const error = new Error(message);
  error.name = 'NotFoundError';
  return error;
}

function validationError(message: string): Error {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
}

