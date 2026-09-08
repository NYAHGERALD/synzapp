/**
 * The rules for a message that has been written but not yet sent.
 *
 * Every decision here is made without touching Firestore, because each one is a
 * judgement that has to be right rather than merely plausible: whether somebody
 * may schedule at all, whether a release should be tried again or given up on,
 * and which of the devices a message was sealed to are still there to receive
 * it. A rule that can only be exercised by scheduling a real message and
 * waiting is a rule nobody checks.
 *
 * The service beside this does the reading and writing and holds no judgement
 * of its own.
 */

export interface ScheduledMessagePolicy {
  /** Whether an Org Admin may see, and stop, a message somebody has waiting. */
  adminVisibilityEnabled: boolean;
  enabled: boolean;
  maxDaysAhead: number;
  maxPendingPerUser: number;
}

/**
 * What a company gets before anybody changes anything.
 *
 * Scheduling is on, because a company that installed a messaging product wants
 * its messaging features. Admin visibility is on, because the decision taken
 * for this product is that an admin can see a message is waiting and stop it —
 * and never read it. A company that considers even that too much of a look into
 * a private conversation turns it off, which is why it is a setting and not a
 * constant.
 */
export const DEFAULT_SCHEDULED_MESSAGE_POLICY: ScheduledMessagePolicy = {
  adminVisibilityEnabled: true,
  enabled: true,
  maxDaysAhead: 30,
  maxPendingPerUser: 20
};

export const MIN_MAX_DAYS_AHEAD = 1;
export const MAX_MAX_DAYS_AHEAD = 365;
export const MIN_MAX_PENDING_PER_USER = 1;
export const MAX_MAX_PENDING_PER_USER = 200;

/**
 * How far ahead a message must be before it is worth scheduling at all.
 *
 * The release worker runs every minute. A message due inside the current minute
 * is racing the run that would deliver it, and would arrive either immediately
 * or a minute late for no reason anybody could explain. Below this, sending is
 * the honest answer, and the sheet says so.
 */
export const MIN_SCHEDULE_LEAD_MS = 60 * 1000;

/**
 * How many times a release is retried before it is left alone.
 *
 * Retrying is for a network that was briefly down or a write that lost a race.
 * Five minutes of that is generous; past it the failure is not the sort that
 * goes away, and a message retried forever is one nobody is ever told about.
 */
export const MAX_RELEASE_ATTEMPTS = 5;

export type ScheduledMessageStatus = 'CANCELLED' | 'FAILED' | 'SCHEDULED' | 'SENDING' | 'SENT';

export type ScheduleRejectionReason =
  | 'DISABLED'
  | 'MEDIA_NOT_SUPPORTED'
  | 'TOO_FAR'
  | 'TOO_MANY'
  | 'TOO_SOON';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The company's settings, with anything unusable replaced by the default.
 *
 * Read on the path that schedules a message, so a malformed settings document
 * must not be able to throw. Every field falls back on its own, because half a
 * policy that was set deliberately is better than none of it.
 */
export function normalizeScheduledMessagePolicy(record: unknown): ScheduledMessagePolicy {
  const source = (record && typeof record === 'object' ? record : {}) as Partial<Record<keyof ScheduledMessagePolicy, unknown>>;

  return {
    adminVisibilityEnabled: source.adminVisibilityEnabled !== false,
    enabled: source.enabled !== false,
    maxDaysAhead: normalizeBoundedInteger(
      source.maxDaysAhead,
      DEFAULT_SCHEDULED_MESSAGE_POLICY.maxDaysAhead,
      MIN_MAX_DAYS_AHEAD,
      MAX_MAX_DAYS_AHEAD
    ),
    maxPendingPerUser: normalizeBoundedInteger(
      source.maxPendingPerUser,
      DEFAULT_SCHEDULED_MESSAGE_POLICY.maxPendingPerUser,
      MIN_MAX_PENDING_PER_USER,
      MAX_MAX_PENDING_PER_USER
    )
  };
}

/**
 * What an administrator is allowed to save.
 *
 * Unlike reading, a value out of bounds here is a mistake worth reporting
 * rather than quietly correcting: somebody typed it, and silently storing
 * something else is how a setting comes to mean the opposite of what the person
 * who set it believes.
 */
export function validateScheduledMessagePolicyInput(input: {
  adminVisibilityEnabled: boolean;
  enabled: boolean;
  maxDaysAhead: number;
  maxPendingPerUser: number;
}): { ok: boolean; reason: string | null } {
  if (!isWholeNumberWithin(input.maxDaysAhead, MIN_MAX_DAYS_AHEAD, MAX_MAX_DAYS_AHEAD)) {
    return {
      ok: false,
      reason: `Messages may be scheduled between ${MIN_MAX_DAYS_AHEAD} and ${MAX_MAX_DAYS_AHEAD} days ahead.`
    };
  }

  if (!isWholeNumberWithin(input.maxPendingPerUser, MIN_MAX_PENDING_PER_USER, MAX_MAX_PENDING_PER_USER)) {
    return {
      ok: false,
      reason: `Each person may have between ${MIN_MAX_PENDING_PER_USER} and ${MAX_MAX_PENDING_PER_USER} messages waiting.`
    };
  }

  return { ok: true, reason: null };
}

/**
 * Whether this message may be scheduled, and if not, what to tell the sender.
 *
 * The order matters: a company with scheduling switched off is told that, and
 * not told its time is wrong.
 */
export function checkScheduleRequest(input: {
  mediaCount: number;
  nowMs: number;
  pendingCount: number;
  policy: ScheduledMessagePolicy;
  releaseAtMs: number;
}): { ok: boolean; reason: ScheduleRejectionReason | null } {
  if (!input.policy.enabled) {
    return { ok: false, reason: 'DISABLED' };
  }

  if (input.mediaCount > 0) {
    return { ok: false, reason: 'MEDIA_NOT_SUPPORTED' };
  }

  if (!Number.isFinite(input.releaseAtMs) || input.releaseAtMs - input.nowMs < MIN_SCHEDULE_LEAD_MS) {
    return { ok: false, reason: 'TOO_SOON' };
  }

  if (input.releaseAtMs - input.nowMs > input.policy.maxDaysAhead * MILLISECONDS_PER_DAY) {
    return { ok: false, reason: 'TOO_FAR' };
  }

  if (input.pendingCount >= input.policy.maxPendingPerUser) {
    return { ok: false, reason: 'TOO_MANY' };
  }

  return { ok: true, reason: null };
}

/** Something a person can act on, rather than a code. */
export function describeScheduleRejection(
  reason: ScheduleRejectionReason,
  policy: ScheduledMessagePolicy
): string {
  if (reason === 'DISABLED') {
    return 'Scheduled messages are switched off for your organization.';
  }

  if (reason === 'MEDIA_NOT_SUPPORTED') {
    return 'Photos and files cannot be scheduled yet. Send them, or schedule a text message.';
  }

  if (reason === 'TOO_SOON') {
    return 'Choose a time at least a minute from now, or send the message instead.';
  }

  if (reason === 'TOO_FAR') {
    return `Messages can be scheduled up to ${policy.maxDaysAhead} days ahead.`;
  }

  return `You already have ${policy.maxPendingPerUser} messages waiting to send.`;
}

/**
 * The recipient devices that are still there to receive this.
 *
 * A message is sealed to the devices the recipient had when it was written. By
 * the time it goes, one of them may have been revoked, or retired for going
 * quiet. Those are dropped and the rest are delivered to — a device leaving is
 * not a reason to withhold a message from the ones that remain.
 *
 * Order is preserved so that what is stored and what is sent read the same way
 * in a log.
 */
export function selectDeliverableRecipientDevices(
  sealedDeviceIds: string[],
  activeDeviceIds: string[]
): string[] {
  const active = new Set(activeDeviceIds);

  return sealedDeviceIds.filter((deviceId) => active.has(deviceId));
}

/**
 * Whether a failed release is worth trying again.
 *
 * A refusal is a decision the system has made and will keep making: the sender
 * was deactivated, the conversation is gone, the request was malformed. Retrying
 * those wastes a run and delays the moment somebody is told. Everything else —
 * a dropped connection, a contended write — is assumed transient, because
 * treating an unknown failure as permanent throws away a message that might
 * have gone perfectly well a minute later.
 */
export function isPermanentReleaseFailure(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return [
    'AuthorizationError',
    'ConflictError',
    'NotFoundError',
    'ValidationError'
  ].includes(error.name);
}

/**
 * What a failed release becomes: tried again, or given up on.
 */
export function resolveReleaseFailureStatus(input: {
  attempts: number;
  error: unknown;
}): { nextStatus: Extract<ScheduledMessageStatus, 'FAILED' | 'SCHEDULED'>; willRetry: boolean } {
  const willRetry = !isPermanentReleaseFailure(input.error) && input.attempts < MAX_RELEASE_ATTEMPTS;

  return {
    nextStatus: willRetry ? 'SCHEDULED' : 'FAILED',
    willRetry
  };
}

/**
 * Who may stop a message before it goes.
 *
 * The person who wrote it, always. An Org Admin, only where the company has
 * left admin visibility on — an admin who cannot see a message waiting must not
 * be able to cancel it either, or the setting would be half a setting.
 */
export function canCancelScheduledMessage(input: {
  callerIsOrgAdminWithSecurityPermission: boolean;
  callerUid: string;
  policy: ScheduledMessagePolicy;
  senderUid: string;
}): boolean {
  if (input.callerUid === input.senderUid) {
    return true;
  }

  return input.callerIsOrgAdminWithSecurityPermission && input.policy.adminVisibilityEnabled;
}

/**
 * Whether a message in this state can still be stopped or sent early.
 *
 * `SENDING` is excluded deliberately: a release worker has claimed it and is
 * partway through, and cancelling underneath that would leave the two disagreeing
 * about whether it was sent.
 */
export function isPendingScheduledMessage(status: string | undefined): boolean {
  return status === 'SCHEDULED';
}

/**
 * Whether the author should still be shown this message.
 *
 * Two states are worth showing: one still waiting, and one that was given up
 * on. A failure that disappears is the worst outcome available — the person
 * believes their message went, and nothing ever tells them otherwise. So it
 * stays in the list, with its reason, until they have seen it and cleared it.
 *
 * A dismissed failure is hidden but not deleted. The record and the reason
 * remain, because an audit of what an organization sent should not be editable
 * by tapping something away.
 */
export function isVisibleToSender(record: {
  cancelledByUid?: string | null;
  dismissedAt?: unknown;
  senderUid?: string;
  status?: string;
}): boolean {
  if (record.dismissedAt) {
    return false;
  }

  if (record.status === 'SCHEDULED' || record.status === 'FAILED') {
    return true;
  }

  // Stopped by somebody else. The author must be told, and told why: a message
  // they wrote did not go, and an administrator decided that. Their own
  // cancellation needs no such notice — they were there.
  return record.status === 'CANCELLED' &&
    Boolean(record.cancelledByUid) &&
    record.cancelledByUid !== record.senderUid;
}

/**
 * Whether the author may clear a message off their own list.
 *
 * Only their own, and only one that has finished failing. A message still
 * waiting is cancelled rather than dismissed — those are different things, and
 * letting one stand in for the other would mean a tap meant to tidy up a
 * failure could silently stop a message that was about to go.
 */
export function canDismissScheduledMessage(input: {
  callerUid: string;
  senderUid: string;
  status?: string;
}): boolean {
  if (input.callerUid !== input.senderUid) {
    return false;
  }

  // Both are notices the author has now read: one that could not be sent, and
  // one an administrator stopped. Neither is going to change again.
  return input.status === 'FAILED' || input.status === 'CANCELLED';
}

/**
 * The shortest reason an administrator may give for stopping somebody's
 * message.
 *
 * There is a reason box because the author is shown what it says. An
 * administrator who has to explain themselves to the person affected acts
 * differently from one who can act invisibly, and that difference is the whole
 * safeguard — the box is not paperwork, it is the check on the power.
 *
 * Long enough that "no" and "." are refused; short enough that a real sentence
 * always passes.
 */
export const MIN_ADMIN_CANCELLATION_REASON_LENGTH = 8;

export function validateAdminCancellationReason(reason: string | undefined): {
  ok: boolean;
  reason: string | null;
} {
  const trimmed = (reason || '').trim();

  if (trimmed.length < MIN_ADMIN_CANCELLATION_REASON_LENGTH) {
    return {
      ok: false,
      reason: 'Give a reason for stopping this message. The person who wrote it will see it.'
    };
  }

  return { ok: true, reason: null };
}

function normalizeBoundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  const wholeValue = Math.floor(value);

  return wholeValue >= minimum && wholeValue <= maximum ? wholeValue : fallback;
}

function isWholeNumberWithin(value: number, minimum: number, maximum: number): boolean {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}
