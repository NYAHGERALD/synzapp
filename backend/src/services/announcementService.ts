import { DecodedIdToken } from 'firebase-admin/auth';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import {
  canSendAnnouncement,
  type AnnouncementAudienceKind
} from './authorizationPolicy.js';
import { listActiveLegalHolds, type LegalHoldRecord } from './legalHoldService.js';
import { sendRailsPushNotification } from './notificationService.js';

/**
 * Announcements: a notice that records who has seen and confirmed it.
 *
 * Not a second messaging system. The words travel as an ordinary encrypted
 * message; what lives here is the receipt, which is metadata the organization
 * is entitled to hold about its own staff.
 *
 * Three properties are load-bearing, and each is tested:
 *
 *  - The recipient list is frozen when the announcement is sent. Somebody who
 *    joins tomorrow was not told today.
 *  - Removing a person does not remove their receipt. Deleting it would destroy
 *    the proof that they were informed.
 *  - Retention removes the words, never the receipt. A company that deleted a
 *    safety notice under its own rule must still be able to show it was issued
 *    and confirmed.
 */

export type AnnouncementState = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';
export type RecipientStatus = 'DELIVERED' | 'READ' | 'ACKNOWLEDGED';

/** Written per batch so an interrupted send resumes instead of starting again. */
const FAN_OUT_BATCH_SIZE = 200;

/** One page of recipients. The phone never holds five thousand rows. */
export const RECIPIENT_PAGE_SIZE = 50;

/** A reminder may be sent once a day. Enforced here, not in the interface. */
const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface AnnouncementAudience {
  kind: AnnouncementAudienceKind;
  targetId: string | null;
  targetName: string;
}

export interface AnnouncementRecord {
  acknowledgedCount: number;
  announcementId: string;
  /**
   * What the announcement actually says.
   *
   * Kept as a company record rather than sealed like private correspondence:
   * a notice whose whole purpose is to be produced in an audit is worthless if
   * it cannot be produced. Retention may remove it, and when it does the
   * receipts survive. See rule 5.4.
   */
  body: string;
  /** Every audience chosen. Somebody in two of them still counts once. */
  audiences: AnnouncementAudience[];
  /** The audiences in words, for a reader: "Production department and Line A". */
  audienceSummary: string;
  bodyRemovedAtMs: number | null;
  createdAtMs: number;
  createdByName: string;
  createdByUid: string;
  deliveredCount: number;
  expectedRecipientCount: number;
  lastReminderAtMs: number | null;
  readCount: number;
  requiresAcknowledgement: boolean;
  state: AnnouncementState;
  subject: string;
  tenantId: string;
}

export interface AnnouncementRecipient {
  acknowledgedAtMs: number | null;
  deliveredAtMs: number | null;
  departmentId: string | null;
  displayName: string;
  readAtMs: number | null;
  status: RecipientStatus;
  uid: string;
}

interface SenderContext {
  departmentId: string | null;
  displayName: string;
  permissions: string[];
  role: string;
  tenantId: string;
  uid: string;
}

/**
 * Gives an announcement the shape today's code expects.
 *
 * Ones sent before an announcement could have several audiences carry a single
 * `audience` and no summary, so a reader showed "Nobody" — which is not merely
 * ugly, it is a false statement about who was told. Nothing on the server could
 * have fixed that after the fact, so it is fixed on the way out.
 */
function normalizeAnnouncement(raw: Record<string, unknown>): AnnouncementRecord {
  const legacyAudience = raw.audience as AnnouncementAudience | undefined;
  const audiences = Array.isArray(raw.audiences)
    ? (raw.audiences as AnnouncementAudience[])
    : legacyAudience
      ? [legacyAudience]
      : [];

  return {
    ...(raw as unknown as AnnouncementRecord),
    audienceSummary: String(raw.audienceSummary || '') || describeAudiences(audiences),
    audiences,
    body: String(raw.body || '')
  };
}

function announcementsRef(tenantId: string) {
  return firestore.collection('organizations').doc(tenantId).collection('announcements');
}

function recipientsRef(tenantId: string, announcementId: string) {
  return announcementsRef(tenantId).doc(announcementId).collection('recipients');
}

/**
 * Reads who the caller is from their own record, never from the request.
 *
 * A permission check that trusts what the client sent is decoration.
 */
async function loadSenderContext(decodedToken: DecodedIdToken): Promise<SenderContext> {
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
    displayName: String(profile.displayName || profile.fullName || 'Unknown'),
    permissions: Array.isArray(identity.permissions) ? (identity.permissions as string[]) : [],
    role: String(identity.role || 'EMPLOYEE'),
    tenantId,
    uid: decodedToken.uid
  };
}

/**
 * Everybody the announcement is for, decided once, at send time.
 *
 * Deactivated people are left out: telling somebody who no longer works here
 * is not a thing to record, and counting them would make every announcement
 * look permanently unacknowledged.
 */
async function resolveAudienceMembers(
  tenantId: string,
  audience: AnnouncementAudience
): Promise<AnnouncementRecipient[]> {
  const usersRef = firestore.collection('organizations').doc(tenantId).collection('users');
  const snapshot = await usersRef.get();

  const members = snapshot.docs
    .map((doc): { uid: string; user: Record<string, unknown> } => ({
      uid: doc.id,
      user: doc.data() as Record<string, unknown>
    }))
    .filter(({ user }) => String(user.status || '') === 'ACTIVE')
    .filter(({ user }) => {
      if (audience.kind === 'ORGANIZATION') {
        return true;
      }

      if (audience.kind === 'DEPARTMENT') {
        return String(user.departmentId || '') === audience.targetId;
      }

      return false;
    });

  if (audience.kind === 'PERSON') {
    const person = snapshot.docs.find((doc) => doc.id === audience.targetId);
    const data = person ? (person.data() as Record<string, unknown>) : null;

    // Somebody who has left is not told, and is not counted as untold either.
    if (!data || String(data.status || '') !== 'ACTIVE') {
      return [];
    }

    return [toRecipient(person!.id, data)];
  }

  if (audience.kind === 'GROUP') {
    const memberUids = await loadGroupMemberIds(tenantId, audience.targetId);
    const byUid = new Map(snapshot.docs.map((doc) => [doc.id, doc.data() as Record<string, unknown>]));

    return memberUids
      .filter((uid) => String(byUid.get(uid)?.status || '') === 'ACTIVE')
      .map((uid) => toRecipient(uid, byUid.get(uid) || {}));
  }

  return members.map(({ uid, user }) => toRecipient(uid, user));
}

/**
 * Everybody across all chosen audiences, each person once.
 *
 * Somebody in the Production department and also in Line A must appear once,
 * count once, and be able to confirm once. Counting them twice would make the
 * total on an audit screen disagree with the names underneath it, which is the
 * same class of error as a double acknowledgement.
 */
async function resolveAllAudienceMembers(
  tenantId: string,
  audiences: AnnouncementAudience[]
): Promise<AnnouncementRecipient[]> {
  const byUid = new Map<string, AnnouncementRecipient>();

  for (const audience of audiences) {
    for (const person of await resolveAudienceMembers(tenantId, audience)) {
      if (!byUid.has(person.uid)) {
        byUid.set(person.uid, person);
      }
    }
  }

  return [...byUid.values()];
}

/** The audiences in words. "Production department, Line A and 2 others". */
export function describeAudiences(audiences: AnnouncementAudience[]): string {
  const names = audiences.map((audience) => audience.targetName);

  if (names.length <= 2) {
    return names.join(' and ');
  }

  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} others`;
}

function toRecipient(uid: string, user: Record<string, unknown>): AnnouncementRecipient {
  return {
    acknowledgedAtMs: null,
    deliveredAtMs: null,
    departmentId: (user.departmentId as string) || null,
    displayName: String(user.displayName || user.fullName || 'Unknown'),
    readAtMs: null,
    status: 'DELIVERED',
    uid
  };
}

/**
 * Creates the announcement and records who it is for.
 *
 * The audience is resolved and written here rather than at read time, which is
 * what freezes the list. Everything after this point is bookkeeping.
 */
/**
 * Checks the sender may reach every audience they chose.
 *
 * One refusal refuses the whole send, and says which. Silently dropping the
 * audience they were not allowed to use would send something narrower than
 * they believe they sent, which is worse than refusing.
 */
async function assertMaySendToAll(
  sender: SenderContext,
  audiences: AnnouncementAudience[]
): Promise<void> {
  for (const audience of audiences) {
    const groupMemberIds = audience.kind === 'GROUP'
      ? await loadGroupMemberIds(sender.tenantId, audience.targetId)
      : [];
    let audienceDepartmentId = audience.targetId;

    if (audience.kind === 'GROUP') {
      audienceDepartmentId = await loadGroupDepartmentId(sender.tenantId, audience.targetId);
    }

    if (audience.kind === 'PERSON') {
      // The department that decides authority is the one that person is in,
      // not anything the sender's phone claimed.
      audienceDepartmentId = await loadPersonDepartmentId(sender.tenantId, audience.targetId);
    }

    const allowed = canSendAnnouncement({
      access: 'ACTIVE',
      audienceDepartmentId,
      audienceKind: audience.kind,
      groupMemberIds,
      permissions: sender.permissions,
      requesterUid: sender.uid,
      resourceTenantId: sender.tenantId,
      role: sender.role,
      status: 'ACTIVE',
      tenantId: sender.tenantId,
      userDepartmentId: sender.departmentId
    });

    if (!allowed) {
      throw forbiddenError(
        `You are not allowed to send an announcement to ${audience.targetName}.`
      );
    }
  }
}

/**
 * How many people a set of audiences reaches, without sending anything.
 *
 * Answers before the message is written, so an empty audience is caught at the
 * moment it is chosen rather than after somebody has composed a safety notice.
 */
export async function previewAnnouncementAudience(
  decodedToken: DecodedIdToken,
  audiences: AnnouncementAudience[]
): Promise<{ recipientCount: number; summary: string }> {
  const sender = await loadSenderContext(decodedToken);

  if (!audiences.length) {
    return { recipientCount: 0, summary: 'Nobody chosen yet' };
  }

  await assertMaySendToAll(sender, audiences);

  const recipients = await resolveAllAudienceMembers(sender.tenantId, audiences);

  return {
    recipientCount: recipients.length,
    summary: describeAudiences(audiences)
  };
}

export async function createAnnouncement(
  decodedToken: DecodedIdToken,
  input: {
    audiences: AnnouncementAudience[];
    body: string;
    requiresAcknowledgement: boolean;
    subject: string;
  }
): Promise<AnnouncementRecord> {
  const sender = await loadSenderContext(decodedToken);
  const subject = input.subject.trim();

  if (subject.length < 2) {
    throw validationError('Give the announcement a subject.');
  }

  if (!input.body.trim()) {
    throw validationError('An announcement needs something to say.');
  }

  if (!input.audiences.length) {
    throw validationError('Choose who this announcement is for.');
  }

  await assertMaySendToAll(sender, input.audiences);

  const recipients = await resolveAllAudienceMembers(sender.tenantId, input.audiences);

  // An announcement nobody receives is a mistake, not a thing to store.
  if (!recipients.length) {
    throw validationError('There is nobody in that audience to tell.');
  }

  const ref = announcementsRef(sender.tenantId).doc();
  const now = Date.now();

  const record: AnnouncementRecord = {
    acknowledgedCount: 0,
    announcementId: ref.id,
    body: input.body.trim(),
    audiences: input.audiences,
    audienceSummary: describeAudiences(input.audiences),
    bodyRemovedAtMs: null,
    createdAtMs: now,
    createdByName: sender.displayName,
    createdByUid: sender.uid,
    deliveredCount: 0,
    expectedRecipientCount: recipients.length,
    lastReminderAtMs: null,
    readCount: 0,
    requiresAcknowledgement: input.requiresAcknowledgement,
    state: 'PENDING',
    subject,
    tenantId: sender.tenantId
  };

  await ref.set({ ...record, createdAt: fieldValue.serverTimestamp() });
  await fanOutAnnouncement(sender.tenantId, ref.id, recipients);

  // Told, not left to be discovered. A notice nobody knows arrived is a notice
  // nobody reads, and the sender is left chasing people who were never alerted.
  //
  // Failing to notify must not fail the send: the announcement exists, the
  // receipts exist, and the app still shows it. A push is a courtesy on top.
  try {
    await sendRailsPushNotification({
      actorUid: sender.uid,
      body: subject,
      channel: 'announcements',
      itemId: ref.id,
      metadata: { announcementId: ref.id },
      notificationId: `announcement:${ref.id}`,
      recipientUids: recipients.map((person) => person.uid),
      tenantId: sender.tenantId,
      title: input.requiresAcknowledgement
        ? 'Announcement — please confirm'
        : 'Announcement',
      type: 'ANNOUNCEMENT_SENT'
    });
  } catch {
    // Deliberately quiet. See above.
  }

  // And a word back to whoever sent it. The fan-out happens on the server, so
  // they may have closed the app before it finished; without this they have no
  // way of knowing it actually went.
  try {
    await sendRailsPushNotification({
      actorUid: 'system',
      body: `${subject} · sent to ${recipients.length} ${
        recipients.length === 1 ? 'person' : 'people'
      }`,
      channel: 'announcements',
      itemId: ref.id,
      metadata: { announcementId: ref.id },
      notificationId: `announcement-sent:${ref.id}`,
      recipientUids: [sender.uid],
      tenantId: sender.tenantId,
      title: 'Announcement sent',
      type: 'ANNOUNCEMENT_SEND_CONFIRMED'
    });
  } catch {
    // Same again: a courtesy, never a reason to fail a send.
  }

  const saved = await ref.get();

  return saved.data() as AnnouncementRecord;
}

/**
 * Writes the recipient rows in batches, recording progress as it goes.
 *
 * Interrupted halfway, it resumes from where it stopped rather than starting
 * again or, worse, telling half the company and forgetting the rest.
 */
export async function fanOutAnnouncement(
  tenantId: string,
  announcementId: string,
  recipients: AnnouncementRecipient[]
): Promise<void> {
  const ref = announcementsRef(tenantId).doc(announcementId);

  await ref.update({ state: 'SENDING' });

  try {
    const existing = await recipientsRef(tenantId, announcementId).get();
    const alreadyWritten = new Set(existing.docs.map((doc) => doc.id));
    const outstanding = recipients.filter((person) => !alreadyWritten.has(person.uid));
    const now = Date.now();

    for (let index = 0; index < outstanding.length; index += FAN_OUT_BATCH_SIZE) {
      const batch = firestore.batch();
      const slice = outstanding.slice(index, index + FAN_OUT_BATCH_SIZE);

      for (const person of slice) {
        batch.set(recipientsRef(tenantId, announcementId).doc(person.uid), {
          ...person,
          deliveredAtMs: now
        });
      }

      // The count moves with the rows, in the same batch, so a crash between
      // the two cannot leave a number that disagrees with reality.
      batch.update(ref, { deliveredCount: fieldValue.increment(slice.length) });
      await batch.commit();
    }

    await ref.update({ state: 'SENT' });
  } catch (error) {
    await ref.update({ state: 'FAILED' });

    throw error;
  }
}

/**
 * Records that this person has acknowledged it.
 *
 * Only they can. Acknowledging twice counts once, because the count moves only
 * when the row changes, inside a transaction.
 */
export async function acknowledgeAnnouncement(
  decodedToken: DecodedIdToken,
  announcementId: string
): Promise<{ acknowledgedAtMs: number }> {
  const sender = await loadSenderContext(decodedToken);
  const announcementRef = announcementsRef(sender.tenantId).doc(announcementId);
  const recipientRef = recipientsRef(sender.tenantId, announcementId).doc(sender.uid);

  const result = await firestore.runTransaction(async (transaction) => {
    const [announcement, recipient] = await Promise.all([
      transaction.get(announcementRef),
      transaction.get(recipientRef)
    ]);

    if (!announcement.exists) {
      throw notFoundError('That announcement was not found.');
    }

    // Not on the list means not told. Nobody may acknowledge on another
    // person's behalf, and nobody may add themselves afterwards.
    if (!recipient.exists) {
      throw forbiddenError('This announcement was not sent to you.');
    }

    const current = recipient.data() as AnnouncementRecipient;
    const now = Date.now();

    if (current.acknowledgedAtMs) {
      return { acknowledgedAtMs: current.acknowledgedAtMs };
    }

    transaction.update(recipientRef, {
      acknowledgedAtMs: now,
      readAtMs: current.readAtMs || now,
      status: 'ACKNOWLEDGED'
    });
    transaction.update(announcementRef, {
      acknowledgedCount: fieldValue.increment(1),
      readCount: fieldValue.increment(current.readAtMs ? 0 : 1)
    });

    return { acknowledgedAtMs: now };
  });

  await notifySenderIfEveryoneHasConfirmed(sender.tenantId, announcementId);

  return result;
}

/**
 * Tells the sender once the last person has confirmed.
 *
 * Read after the transaction rather than inside it, because the count is only
 * settled once the write has landed. Reading it inside would race with other
 * people confirming at the same moment and could announce completion twice, or
 * miss it entirely.
 */
async function notifySenderIfEveryoneHasConfirmed(
  tenantId: string,
  announcementId: string
): Promise<void> {
  try {
    const snapshot = await announcementsRef(tenantId).doc(announcementId).get();

    if (!snapshot.exists) {
      return;
    }

    const record = snapshot.data() as AnnouncementRecord & { everyoneConfirmedNotifiedAtMs?: number };

    if (
      !record.requiresAcknowledgement ||
      record.everyoneConfirmedNotifiedAtMs ||
      record.acknowledgedCount < record.expectedRecipientCount
    ) {
      return;
    }

    // Written before sending, so two people confirming at the same instant
    // cannot both trigger the message.
    await announcementsRef(tenantId).doc(announcementId).update({
      everyoneConfirmedNotifiedAtMs: Date.now()
    });

    await sendRailsPushNotification({
      actorUid: 'system',
      body: `${record.subject} · all ${record.expectedRecipientCount} ${
        record.expectedRecipientCount === 1 ? 'person has' : 'people have'
      } confirmed`,
      channel: 'announcements',
      itemId: announcementId,
      metadata: { announcementId },
      notificationId: `announcement-complete:${announcementId}`,
      recipientUids: [record.createdByUid],
      tenantId,
      title: 'Everyone has confirmed',
      type: 'ANNOUNCEMENT_FULLY_ACKNOWLEDGED'
    });
  } catch {
    // A courtesy. Never allowed to fail somebody's acknowledgement.
  }
}

/** Marks it seen. Separate from acknowledging: reading is not agreeing. */
export async function markAnnouncementRead(
  decodedToken: DecodedIdToken,
  announcementId: string
): Promise<void> {
  const sender = await loadSenderContext(decodedToken);
  const announcementRef = announcementsRef(sender.tenantId).doc(announcementId);
  const recipientRef = recipientsRef(sender.tenantId, announcementId).doc(sender.uid);

  await firestore.runTransaction(async (transaction) => {
    const recipient = await transaction.get(recipientRef);

    if (!recipient.exists) {
      return;
    }

    const current = recipient.data() as AnnouncementRecipient;

    if (current.readAtMs) {
      return;
    }

    transaction.update(recipientRef, { readAtMs: Date.now(), status: 'READ' });
    transaction.update(announcementRef, { readCount: fieldValue.increment(1) });
  });
}

/**
 * One page of recipients, newest activity first.
 *
 * Paged because an announcement to five thousand people is the ordinary case,
 * not the exception.
 */
export async function listAnnouncementRecipients(
  decodedToken: DecodedIdToken,
  input: { announcementId: string; startAfterUid?: string; status?: RecipientStatus }
): Promise<{ nextCursor: string | null; recipients: AnnouncementRecipient[] }> {
  const sender = await loadSenderContext(decodedToken);
  let query = recipientsRef(sender.tenantId, input.announcementId)
    .orderBy('uid')
    .limit(RECIPIENT_PAGE_SIZE + 1);

  if (input.startAfterUid) {
    query = query.startAfter(input.startAfterUid);
  }

  const snapshot = await query.get();
  const rows = snapshot.docs.map((doc) => doc.data() as AnnouncementRecipient);
  // Filtered here rather than in the query: combining a filter with a sort
  // needs a composite index built ahead of time, and a page is fifty rows.
  const filtered = input.status ? rows.filter((row) => row.status === input.status) : rows;
  const page = filtered.slice(0, RECIPIENT_PAGE_SIZE);

  return {
    nextCursor: rows.length > RECIPIENT_PAGE_SIZE ? page[page.length - 1]?.uid || null : null,
    recipients: page
  };
}

/** The announcements this person was actually sent. */
/**
 * The announcements this person was sent, and the ones they sent themselves.
 *
 * It used to return only ones they had received, so an Org Admin who announced
 * something to a group they are not in never saw it again: their own notice
 * was invisible to them, counts and all.
 */
export async function listAnnouncementsForPerson(
  decodedToken: DecodedIdToken
): Promise<Array<AnnouncementRecord & { myStatus: RecipientStatus | null }>> {
  const sender = await loadSenderContext(decodedToken);
  const snapshot = await announcementsRef(sender.tenantId)
    .orderBy('createdAtMs', 'desc')
    .limit(100)
    .get();

  const results = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const record = normalizeAnnouncement(doc.data());
      const isMine = record.createdByUid === sender.uid;
      const mine = await doc.ref.collection('recipients').doc(sender.uid).get();

      if (!mine.exists && !isMine) {
        return null;
      }

      return {
        ...record,
        myStatus: mine.exists ? (mine.data() as AnnouncementRecipient).status : null
      };
    })
  );

  return results.filter((entry): entry is AnnouncementRecord & { myStatus: RecipientStatus } =>
    entry !== null
  );
}

/**
 * Whether a hold reaches this announcement, without reading every recipient.
 *
 * A hold naming nobody covers the whole organization, so the answer is yes
 * before anything is read. A hold naming particular people is checked by
 * looking those people up directly: a handful of document reads, however many
 * thousand recipients the announcement has. Scanning the list would be the
 * exact mistake this feature was designed to avoid.
 */
export async function findHoldsCoveringAnnouncement(
  tenantId: string,
  announcementId: string,
  nowMs = Date.now()
): Promise<LegalHoldRecord[]> {
  const activeHolds = await listActiveLegalHolds(tenantId, nowMs);

  if (!activeHolds.length) {
    return [];
  }

  const organizationWide = activeHolds.filter((hold) => !hold.custodianUids.length);

  if (organizationWide.length) {
    return activeHolds;
  }

  const announcement = await announcementsRef(tenantId).doc(announcementId).get();

  if (!announcement.exists) {
    return [];
  }

  const createdByUid = (announcement.data() as AnnouncementRecord).createdByUid;
  const covering: LegalHoldRecord[] = [];

  for (const hold of activeHolds) {
    if (hold.custodianUids.includes(createdByUid)) {
      covering.push(hold);

      continue;
    }

    const rows = await Promise.all(
      hold.custodianUids.map((uid) => recipientsRef(tenantId, announcementId).doc(uid).get())
    );

    if (rows.some((row) => row.exists)) {
      covering.push(hold);
    }
  }

  return covering;
}

/**
 * Removes the words, keeps the receipt.
 *
 * Called by retention. The proof that people were told outlives the telling:
 * a company that deleted a safety notice under its own rule must still be able
 * to show it was issued and confirmed.
 *
 * A legal hold refuses it outright. A hold exists precisely to stop a routine
 * rule from destroying something a court may ask for, so this is a refusal and
 * not a warning: a warning is not a control.
 */
export async function removeAnnouncementBody(
  tenantId: string,
  announcementId: string
): Promise<void> {
  const holds = await findHoldsCoveringAnnouncement(tenantId, announcementId);

  if (holds.length) {
    throw legalHoldError(
      `This announcement is under legal hold ${holds
        .map((hold) => hold.caseId)
        .join(', ')} and cannot be removed until the hold is released.`
    );
  }

  await announcementsRef(tenantId).doc(announcementId).update({
    body: '',
    bodyRemovedAtMs: Date.now()
  });
}

/** Whether a reminder may be sent yet. A day between them, decided here. */
export function canSendReminder(record: AnnouncementRecord, nowMs: number): boolean {
  if (record.state !== 'SENT' || !record.requiresAcknowledgement) {
    return false;
  }

  if (record.acknowledgedCount >= record.expectedRecipientCount) {
    return false;
  }

  return !record.lastReminderAtMs || nowMs - record.lastReminderAtMs >= REMINDER_INTERVAL_MS;
}

/**
 * Everybody in a group.
 *
 * Members live in a subcollection, and a group whose policy is
 * DEPARTMENT_PLUS_EXPLICIT also contains everybody in its department without
 * any of them having a row there.
 *
 * An earlier version of this read a `memberIds` array that does not exist, so
 * every group announcement found nobody and was refused. The tests missed it
 * because they seeded the shape the code expected rather than the shape the
 * product writes.
 */
async function loadGroupMemberIds(tenantId: string, groupId: string | null): Promise<string[]> {
  if (!groupId) {
    return [];
  }

  const groupRef = firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('groups')
    .doc(groupId);
  const group = await groupRef.get();

  if (!group.exists) {
    throw notFoundError('That group was not found.');
  }

  const data = group.data() as Record<string, unknown>;
  const uids = new Set<string>();

  const members = await groupRef.collection('members').get();

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

async function loadPersonDepartmentId(
  tenantId: string,
  uid: string | null
): Promise<string | null> {
  if (!uid) {
    return null;
  }

  const person = await firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('users')
    .doc(uid)
    .get();

  return person.exists ? ((person.data() as Record<string, unknown>).departmentId as string) || null : null;
}

async function loadGroupDepartmentId(
  tenantId: string,
  groupId: string | null
): Promise<string | null> {
  if (!groupId) {
    return null;
  }

  const group = await firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('groups')
    .doc(groupId)
    .get();

  return group.exists ? ((group.data() as Record<string, unknown>).departmentId as string) || null : null;
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
function legalHoldError(message: string): Error {
  const error = new Error(message);
  error.name = 'ConflictError';

  return error;
}

function validationError(message: string): Error {
  const error = new Error(message);
  error.name = 'ValidationError';

  return error;
}

export interface AnnouncementAudienceGroup {
  departmentId: string | null;
  groupId: string;
  memberCount: number;
  name: string;
}

/**
 * The groups somebody may address, for the audience picker.
 *
 * Separate from the group list the chat uses, and deliberately so. That one
 * shows only groups you are a member of, because a group chat you are not in is
 * one you cannot read: its messages are sealed for its members. Addressing a
 * group is a different act from reading it, and an Org Admin who runs the
 * company can address any of them.
 *
 * Scope still applies. A department admin reaches groups in their department; a
 * team lead reaches the ones they are actually in.
 */
export async function listAnnouncementAudienceGroups(
  decodedToken: DecodedIdToken
): Promise<AnnouncementAudienceGroup[]> {
  const sender = await loadSenderContext(decodedToken);
  const snapshot = await firestore
    .collection('organizations')
    .doc(sender.tenantId)
    .collection('groups')
    .orderBy('name')
    .get();

  const groups: AnnouncementAudienceGroup[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data() as Record<string, unknown>;

    if (String(data.status || 'ACTIVE') !== 'ACTIVE') {
      continue;
    }

    const departmentId = (data.departmentId as string) || null;
    const isOrgAdmin = sender.role === 'ORG_ADMIN';
    const isTheirDepartment = sender.role === 'DEPT_ADMIN' &&
      !!sender.departmentId &&
      departmentId === sender.departmentId;

    let mayAddress = isOrgAdmin || isTheirDepartment;

    if (!mayAddress) {
      const membership = await doc.ref.collection('members').doc(sender.uid).get();

      mayAddress = membership.exists;
    }

    if (!mayAddress) {
      continue;
    }

    // The real number, counted the same way the send will count it, so the
    // picker cannot promise a size the send does not deliver.
    const memberUids = await loadGroupMemberIds(sender.tenantId, doc.id);

    groups.push({
      departmentId,
      groupId: doc.id,
      memberCount: memberUids.length,
      name: String(data.name || 'Group')
    });
  }

  return groups;
}
