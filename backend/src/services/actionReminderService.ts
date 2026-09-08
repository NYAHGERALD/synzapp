import { DecodedIdToken } from 'firebase-admin/auth';
import type { Request } from 'express';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import {
  canOrgAdminUsePermission,
  isActiveTenantSession
} from './authorizationPolicy.js';
import { buildAuthSession } from './authSessionService.js';
import { ACTION_NOTIFICATION_CHANNEL_ID } from './actionService.js';
import {
  buildActionDigest,
  countActionsForDigest,
  hasAnythingOutstanding,
  type DigestableAction
} from './actionDigest.js';
import {
  canSendNow,
  findDueReminderSlot,
  normalizeActionReminderPolicy,
  shouldEscalateOverdue,
  validateActionReminderPolicyInput,
  type ActionReminderPolicy
} from './actionReminderPolicy.js';
import { sendRailsPushNotification } from './notificationService.js';
import { writeAuditEvent } from './auditService.js';

/**
 * Reminding people about work they still owe, and telling somebody when it has
 * been owed too long.
 *
 * The reminder is a digest: one notification per person per slot, whatever they
 * are carrying. Ten notifications at eight in the morning are nought — the
 * person has been told nothing and has learned to clear the group unread.
 *
 * The escalation is the part that actually stops work being missed. A reminder
 * somebody has ignored twice will be ignored a third time; a message to their
 * department admin will not.
 *
 * See `SYNZAPP_ACTION_AWARENESS_PLAN.md`.
 */

export interface ActionReminderPolicyResponse extends ActionReminderPolicy {
  updatedAt: string | null;
  updatedByUid: string | null;
}

export async function getActionReminderPolicyForCurrentUser(
  decodedToken: DecodedIdToken
): Promise<ActionReminderPolicyResponse> {
  const session = await buildAuthSession(decodedToken);
  const { status, tenantId } = session.user;

  if (session.access !== 'ACTIVE' || status !== 'ACTIVE' || !tenantId) {
    throw authorizationError('Your profile is not active.');
  }

  return readActionReminderPolicy(tenantId);
}

export async function updateActionReminderPolicy(
  decodedToken: DecodedIdToken,
  input: {
    escalateOverdueAfterHours: number | null;
    firstReminderHour: number;
    frequency: string;
    secondReminderHour: number;
    timeZone: string;
    workingHoursEndHour: number;
    workingHoursStartHour: number;
  }
): Promise<ActionReminderPolicyResponse> {
  const session = await buildAuthSession(decodedToken);
  const { permissions, role, status, tenantId } = session.user;
  const policyInput = { access: session.access, permissions, role, status, tenantId };

  if (!isActiveTenantSession(policyInput)) {
    throw authorizationError('Your admin session is not active.');
  }

  if (!canOrgAdminUsePermission(policyInput, 'security.manage')) {
    throw authorizationError('You do not have permission to manage reminders.');
  }

  const validation = validateActionReminderPolicyInput(input);

  if (!validation.ok) {
    throw validationError(validation.reason || 'That setting is not allowed.');
  }

  await firestore.collection('organizations').doc(tenantId as string).set({
    actionReminderPolicy: {
      ...input,
      updatedAt: fieldValue.serverTimestamp(),
      updatedByUid: decodedToken.uid
    },
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });

  return readActionReminderPolicy(tenantId as string);
}

async function readActionReminderPolicy(tenantId: string): Promise<ActionReminderPolicyResponse> {
  const snapshot = await firestore.collection('organizations').doc(tenantId).get();
  const organization = snapshot.data() as { actionReminderPolicy?: Record<string, unknown> } | undefined;
  const stored = organization?.actionReminderPolicy;
  const updatedAt = stored?.updatedAt as { toMillis?: () => number } | undefined;

  return {
    ...normalizeActionReminderPolicy(stored),
    updatedAt: updatedAt?.toMillis ? new Date(updatedAt.toMillis()).toISOString() : null,
    updatedByUid: (stored?.updatedByUid as string) || null
  };
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

export interface ActionReminderRunSummary {
  digestsSent: number;
  escalationsSent: number;
  tenantsFailed: number;
  tenantsRun: number;
}

/** Statuses that mean somebody still owes the work. */
const OUTSTANDING_STATUSES = ['OPEN', 'IN_PROGRESS', 'BLOCKED'];

/**
 * How many outstanding actions one run reads per company.
 *
 * A ceiling on a run rather than on a company. Anything past it is picked up by
 * the next run fifteen minutes later, and a company carrying more than this at
 * once has a problem no reminder is going to solve.
 */
const OUTSTANDING_SCAN_LIMIT = 1000;

export async function runDueActionReminders(req: Request): Promise<ActionReminderRunSummary> {
  const organizations = await firestore.collection('organizations').listDocuments();
  const summary: ActionReminderRunSummary = {
    digestsSent: 0,
    escalationsSent: 0,
    tenantsFailed: 0,
    tenantsRun: 0
  };

  // One company at a time. This competes with live traffic, and finishing later
  // beats slowing the app down — the same reasoning the retention run uses.
  for (const organization of organizations) {
    try {
      const tenantSummary = await runTenantActionReminders(organization.id, req);

      summary.digestsSent += tenantSummary.digestsSent;
      summary.escalationsSent += tenantSummary.escalationsSent;
      summary.tenantsRun += 1;
    } catch {
      // One company's broken settings must not stop every other company's
      // escalations.
      summary.tenantsFailed += 1;
    }
  }

  return summary;
}

async function runTenantActionReminders(
  tenantId: string,
  req: Request
): Promise<{ digestsSent: number; escalationsSent: number }> {
  const organizationSnapshot = await firestore.collection('organizations').doc(tenantId).get();
  const organization = organizationSnapshot.data() as { actionReminderPolicy?: unknown; status?: string } | undefined;

  if (!organizationSnapshot.exists || organization?.status !== 'ACTIVE') {
    return { digestsSent: 0, escalationsSent: 0 };
  }

  const policy = normalizeActionReminderPolicy(organization?.actionReminderPolicy);
  const nowMs = Date.now();
  const slot = findDueReminderSlot({ nowMs, policy });
  const outstanding = await readOutstandingActions(tenantId);
  // Escalation runs on every pass; a digest only in its own hour. An action
  // that has been overdue since yesterday should not wait for breakfast.
  const escalationsSent = await escalateOverdueActions({
    actions: outstanding,
    nowMs,
    policy,
    req,
    tenantId
  });

  if (!slot) {
    return { digestsSent: 0, escalationsSent };
  }

  const digestsSent = await sendTenantDigests({
    actions: outstanding,
    nowMs,
    policy,
    req,
    slot,
    tenantId
  });

  return { digestsSent, escalationsSent };
}

interface OutstandingAction extends DigestableAction {
  actionId: string;
  escalatedAtMs: number | null;
  priority: string;
  responsibleDepartmentId: string | null;
  responsiblePersonName: string | null;
  title: string;
}

async function readOutstandingActions(tenantId: string): Promise<OutstandingAction[]> {
  const snapshot = await firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('actions')
    .where('status', 'in', OUTSTANDING_STATUSES)
    .limit(OUTSTANDING_SCAN_LIMIT)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;

    return {
      actionId: doc.id,
      dueAtMs: typeof data.dueAtMs === 'number' ? data.dueAtMs : null,
      escalatedAtMs: typeof data.escalatedAtMs === 'number' ? data.escalatedAtMs : null,
      priority: String(data.priority || 'MEDIUM'),
      responsibleDepartmentId: (data.responsibleDepartmentId as string) || null,
      responsiblePersonName: (data.responsiblePersonName as string) || null,
      responsiblePersonUid: (data.responsiblePersonUid as string) || null,
      status: String(data.status || ''),
      title: String(data.title || 'An action')
    };
  });
}

/**
 * One digest per person who is carrying something.
 *
 * The slot is written down before anything is sent, so a run that repeats
 * inside the same hour finds it already recorded and sends nothing. Recording
 * first rather than after means a crash halfway costs a reminder rather than
 * sending a second one — the safer way round, because a person who is reminded
 * twice trusts the next one less.
 */
async function sendTenantDigests(input: {
  actions: OutstandingAction[];
  nowMs: number;
  policy: ActionReminderPolicy;
  req: Request;
  slot: string;
  tenantId: string;
}): Promise<number> {
  const owners = Array.from(new Set(input.actions
    .map((action) => action.responsiblePersonUid)
    .filter((uid): uid is string => Boolean(uid))));
  const verifiableByRaiser = await countVerifiableByRaiser(input.tenantId);

  for (const uid of Object.keys(verifiableByRaiser)) {
    if (!owners.includes(uid)) {
      owners.push(uid);
    }
  }

  let sent = 0;

  for (const uid of owners) {
    const counts = countActionsForDigest({
      actions: input.actions,
      nowMs: input.nowMs,
      uid,
      verifiableCount: verifiableByRaiser[uid] || 0
    });

    if (!hasAnythingOutstanding(counts)) {
      continue;
    }

    const hasCriticalOverdue = input.actions.some((action) => (
      action.responsiblePersonUid === uid &&
      action.priority === 'CRITICAL' &&
      action.dueAtMs !== null &&
      action.dueAtMs < input.nowMs
    ));

    if (!canSendNow({ hasCriticalOverdue, nowMs: input.nowMs, policy: input.policy })) {
      continue;
    }

    const userRef = firestore
      .collection('organizations')
      .doc(input.tenantId)
      .collection('users')
      .doc(uid);
    const claimed = await claimReminderSlot(userRef, input.slot);

    if (!claimed) {
      continue;
    }

    const digest = buildActionDigest(counts);

    if (!digest) {
      continue;
    }

    await sendRailsPushNotification({
      actorUid: '',
      androidChannelId: ACTION_NOTIFICATION_CHANNEL_ID,
      body: digest.body,
      channel: 'actions',
      metadata: { reminderSlot: input.slot },
      notificationId: `action-digest:${uid}:${input.slot}`,
      recipientUids: [uid],
      tenantId: input.tenantId,
      title: digest.title,
      type: 'ACTION_REMINDER'
    });

    // The counts, not the actions. An audit that answers "were people actually
    // being reminded" without listing what each person owed.
    await writeAuditEvent({
      action: 'ACTION_REMINDER_SENT',
      metadata: {
        awaitingVerification: counts.awaitingVerification,
        open: counts.open,
        overdue: counts.overdue,
        slot: input.slot
      },
      req: input.req,
      status: 'SUCCESS',
      tenantId: input.tenantId,
      uid
    }).catch(() => undefined);

    sent += 1;
  }

  return sent;
}

/**
 * Work somebody finished that the person who raised it can now confirm.
 *
 * Counted per raiser, because that is who verification falls to. Their own work
 * is excluded — nobody signs off what they did themselves, and counting it here
 * would promise something the server would then refuse.
 */
async function countVerifiableByRaiser(tenantId: string): Promise<Record<string, number>> {
  const snapshot = await firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('actions')
    .where('status', '==', 'DONE')
    .limit(OUTSTANDING_SCAN_LIMIT)
    .get();
  const counts: Record<string, number> = {};

  for (const doc of snapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    const raiser = (data.createdByUid as string) || '';

    if (!raiser || data.completedByUid === raiser) {
      continue;
    }

    counts[raiser] = (counts[raiser] || 0) + 1;
  }

  return counts;
}

/**
 * Takes this slot for this person, or reports that somebody already had it.
 *
 * A transaction because the worker can overlap itself: a run that takes longer
 * than fifteen minutes is still going when the next one starts, and two
 * reminders for the same hour is exactly the thing that teaches somebody to
 * turn reminders off.
 */
async function claimReminderSlot(
  userRef: FirebaseFirestore.DocumentReference,
  slot: string
): Promise<boolean> {
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);

    if (!snapshot.exists) {
      return false;
    }

    const user = snapshot.data() as { actionReminderState?: { lastDigestSlot?: string }; status?: string };

    if (user.status !== 'ACTIVE' || user.actionReminderState?.lastDigestSlot === slot) {
      return false;
    }

    transaction.set(userRef, {
      actionReminderState: {
        lastDigestSlot: slot,
        lastDigestSentAtMs: Date.now()
      }
    }, { merge: true });

    return true;
  });
}

/**
 * Tells a department admin about work that has been overdue too long.
 *
 * Marked on the action itself rather than in a per-person record, which makes
 * "only once" true by construction: the flag is on the thing being escalated,
 * so it cannot be escalated again by a different run reading different state.
 */
async function escalateOverdueActions(input: {
  actions: OutstandingAction[];
  nowMs: number;
  policy: ActionReminderPolicy;
  req: Request;
  tenantId: string;
}): Promise<number> {
  let sent = 0;

  for (const action of input.actions) {
    if (!shouldEscalateOverdue({
      dueAtMs: action.dueAtMs,
      lastEscalatedAtMs: action.escalatedAtMs,
      nowMs: input.nowMs,
      policy: input.policy
    })) {
      continue;
    }

    const admins = await readEscalationRecipients(input.tenantId, action.responsibleDepartmentId);

    if (!admins.length) {
      continue;
    }

    const claimed = await claimEscalation(input.tenantId, action.actionId, input.nowMs);

    if (!claimed) {
      continue;
    }

    const owner = action.responsiblePersonName || 'the team';
    const overdueDays = Math.floor((input.nowMs - (action.dueAtMs || 0)) / (24 * 60 * 60 * 1000));

    await sendRailsPushNotification({
      actorUid: '',
      androidChannelId: ACTION_NOTIFICATION_CHANNEL_ID,
      body: overdueDays >= 1
        ? `${action.title} — with ${owner}, ${overdueDays === 1 ? '1 day' : `${overdueDays} days`} past its date.`
        : `${action.title} — with ${owner}, past its date.`,
      channel: 'actions',
      itemId: action.actionId,
      metadata: { actionId: action.actionId },
      notificationId: `action-escalation:${action.actionId}`,
      recipientUids: admins,
      tenantId: input.tenantId,
      title: 'Action overdue',
      type: 'ACTION_ESCALATED'
    });

    // Recorded, because "why did my supervisor hear about this" is a question
    // somebody will ask, and an escalation nobody can account for later reads
    // as the system telling tales.
    await writeAuditEvent({
      action: 'ACTION_ESCALATED',
      metadata: {
        actionId: action.actionId,
        overdueSinceMs: action.dueAtMs || 0,
        recipientCount: admins.length,
        responsibleDepartmentId: action.responsibleDepartmentId || 'none'
      },
      req: input.req,
      status: 'SUCCESS',
      tenantId: input.tenantId
    }).catch(() => undefined);

    sent += 1;
  }

  return sent;
}

async function claimEscalation(
  tenantId: string,
  actionId: string,
  nowMs: number
): Promise<boolean> {
  const ref = firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('actions')
    .doc(actionId);

  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);

    if (!snapshot.exists || (snapshot.data() as { escalatedAtMs?: number }).escalatedAtMs) {
      return false;
    }

    transaction.set(ref, {
      escalatedAtMs: nowMs,
      updatedAtMs: fieldValue.serverTimestamp()
    }, { merge: true });

    return true;
  });
}

/**
 * Who hears that work is overdue.
 *
 * The department admins who own it, and **the organization admins when there
 * are none** — an action raised outside any department, or in a department with
 * no admin, would otherwise escalate to nobody at all. Silence is the one
 * outcome this feature exists to prevent, so the fallback is not optional.
 */
async function readEscalationRecipients(
  tenantId: string,
  departmentId: string | null
): Promise<string[]> {
  const usersRef = firestore.collection('organizations').doc(tenantId).collection('users');

  if (departmentId) {
    const departmentAdmins = await usersRef
      .where('departmentId', '==', departmentId)
      .where('role', '==', 'DEPT_ADMIN')
      .get();
    const active = departmentAdmins.docs
      .filter((doc) => (doc.data() as { status?: string }).status === 'ACTIVE')
      .map((doc) => doc.id);

    if (active.length) {
      return active;
    }
  }

  const organizationAdmins = await usersRef.where('role', '==', 'ORG_ADMIN').get();

  return organizationAdmins.docs
    .filter((doc) => (doc.data() as { status?: string }).status === 'ACTIVE')
    .map((doc) => doc.id);
}
