/**
 * When people are reminded about work they still owe.
 *
 * The hard part of a reminder is not sending it. It is that a person who is
 * reminded too often turns reminders off, and then never sees the one that
 * mattered — the overdue escalation. So every rule here is written against that
 * outcome rather than against "did we remind them".
 *
 * Nothing here reads or writes anything. Whether a slot is due, in a company's
 * own time zone, across a daylight-saving change, on a run that fired twice —
 * these are the questions that are answered wrongly in a scheduler and noticed
 * six weeks later.
 *
 * See `SYNZAPP_ACTION_AWARENESS_PLAN.md`.
 */

export type ActionReminderFrequency = 'OFF' | 'ONCE' | 'TWICE';

export interface ActionReminderPolicy {
  /** Hours an action may be overdue before a department admin is told. Null never escalates. */
  escalateOverdueAfterHours: number | null;
  firstReminderHour: number;
  frequency: ActionReminderFrequency;
  secondReminderHour: number;
  /** IANA zone the hours above are read in. */
  timeZone: string;
  workingHoursEndHour: number;
  workingHoursStartHour: number;
}

/**
 * What a company gets before anybody changes anything.
 *
 * Once a day, in the morning, because one reminder a day is the most that can
 * be sent indefinitely without being tuned out. Escalation at a day, because an
 * action nobody has touched since yesterday is the first point at which
 * somebody else needs to know.
 */
export const DEFAULT_ACTION_REMINDER_POLICY: ActionReminderPolicy = {
  escalateOverdueAfterHours: 24,
  firstReminderHour: 8,
  frequency: 'ONCE',
  secondReminderHour: 15,
  timeZone: 'UTC',
  workingHoursEndHour: 19,
  workingHoursStartHour: 7
};

export const ESCALATION_HOUR_CHOICES = [4, 8, 24, 48];

export function normalizeActionReminderPolicy(record: unknown): ActionReminderPolicy {
  const source = (record && typeof record === 'object' ? record : {}) as Record<string, unknown>;

  return {
    escalateOverdueAfterHours: normalizeEscalationHours(source.escalateOverdueAfterHours),
    firstReminderHour: normalizeHour(source.firstReminderHour, DEFAULT_ACTION_REMINDER_POLICY.firstReminderHour),
    frequency: normalizeFrequency(source.frequency),
    secondReminderHour: normalizeHour(source.secondReminderHour, DEFAULT_ACTION_REMINDER_POLICY.secondReminderHour),
    timeZone: normalizeTimeZone(source.timeZone),
    workingHoursEndHour: normalizeHour(source.workingHoursEndHour, DEFAULT_ACTION_REMINDER_POLICY.workingHoursEndHour),
    workingHoursStartHour: normalizeHour(source.workingHoursStartHour, DEFAULT_ACTION_REMINDER_POLICY.workingHoursStartHour)
  };
}

/**
 * What an administrator is allowed to save.
 *
 * Out-of-bounds is refused rather than quietly corrected. Somebody typed it,
 * and storing a different number is how a setting comes to mean the opposite of
 * what the person who set it believes.
 */
export function validateActionReminderPolicyInput(input: {
  escalateOverdueAfterHours: number | null;
  firstReminderHour: number;
  frequency: string;
  secondReminderHour: number;
  timeZone: string;
  workingHoursEndHour: number;
  workingHoursStartHour: number;
}): { ok: boolean; reason: string | null } {
  if (!['OFF', 'ONCE', 'TWICE'].includes(input.frequency)) {
    return { ok: false, reason: 'Choose how often reminders are sent.' };
  }

  for (const hour of [
    input.firstReminderHour,
    input.secondReminderHour,
    input.workingHoursStartHour,
    input.workingHoursEndHour
  ]) {
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      return { ok: false, reason: 'Times must be a whole hour of the day.' };
    }
  }

  if (input.workingHoursStartHour >= input.workingHoursEndHour) {
    return { ok: false, reason: 'Working hours must start before they end.' };
  }

  if (
    input.escalateOverdueAfterHours !== null &&
    !ESCALATION_HOUR_CHOICES.includes(input.escalateOverdueAfterHours)
  ) {
    return { ok: false, reason: 'Choose when an overdue action reaches a department admin.' };
  }

  if (input.frequency === 'TWICE' && input.firstReminderHour === input.secondReminderHour) {
    return { ok: false, reason: 'Two reminders at the same hour is one reminder.' };
  }

  if (!isUsableTimeZone(input.timeZone)) {
    return { ok: false, reason: 'That time zone was not recognised.' };
  }

  return { ok: true, reason: null };
}

/** The hours a digest is sent at, in the company's own time. */
export function reminderHoursFor(policy: ActionReminderPolicy): number[] {
  if (policy.frequency === 'OFF') {
    return [];
  }

  if (policy.frequency === 'ONCE') {
    return [policy.firstReminderHour];
  }

  return [policy.firstReminderHour, policy.secondReminderHour]
    .filter((hour, index, hours) => hours.indexOf(hour) === index)
    .sort((left, right) => left - right);
}

/**
 * Which reminder slot, if any, this moment falls in.
 *
 * A slot is a date and an hour in the company's own zone, so a run that fires
 * twice inside the same hour produces the same key and the second one is
 * skipped. The zone is applied for the date in question rather than as a fixed
 * offset, which is what keeps eight in the morning at eight through a clock
 * change.
 *
 * Deliberately matches only the hour itself, not "at or after". A worker that
 * was down all morning should not deliver breakfast's reminder at noon; the
 * next one is soon enough, and a reminder that arrives at the wrong time of day
 * is one people stop trusting.
 */
export function findDueReminderSlot(input: {
  nowMs: number;
  policy: ActionReminderPolicy;
}): string | null {
  const hours = reminderHoursFor(input.policy);

  if (!hours.length) {
    return null;
  }

  const local = readLocalParts(input.nowMs, input.policy.timeZone);

  if (!local || !hours.includes(local.hour)) {
    return null;
  }

  return `${local.date}:${String(local.hour).padStart(2, '0')}`;
}

/**
 * Whether something may be sent to this person right now.
 *
 * Outside working hours nothing goes out — except an overdue action that is
 * also critical, which is the one case where waiting until morning is the wrong
 * answer.
 */
export function canSendNow(input: {
  hasCriticalOverdue: boolean;
  nowMs: number;
  policy: ActionReminderPolicy;
}): boolean {
  if (input.hasCriticalOverdue) {
    return true;
  }

  const local = readLocalParts(input.nowMs, input.policy.timeZone);

  if (!local) {
    return true;
  }

  return local.hour >= input.policy.workingHoursStartHour &&
    local.hour < input.policy.workingHoursEndHour;
}

/**
 * Whether an overdue action has waited long enough to reach a department admin.
 *
 * The escalation is the part of this feature that actually stops work being
 * missed. A reminder somebody has ignored twice will be ignored a third time; a
 * message to their supervisor will not.
 */
export function shouldEscalateOverdue(input: {
  dueAtMs: number | null;
  lastEscalatedAtMs: number | null;
  nowMs: number;
  policy: ActionReminderPolicy;
}): boolean {
  const afterHours = input.policy.escalateOverdueAfterHours;

  if (afterHours === null || !input.dueAtMs) {
    return false;
  }

  // Escalated once. Telling a supervisor the same thing every fifteen minutes
  // is how a supervisor learns to ignore supervisors' notifications.
  if (input.lastEscalatedAtMs) {
    return false;
  }

  return input.nowMs - input.dueAtMs >= afterHours * 60 * 60 * 1000;
}

/** Whether an IANA zone is one this runtime can actually read a clock in. */
export function isUsableTimeZone(timeZone: unknown): boolean {
  if (typeof timeZone !== 'string' || !timeZone.trim()) {
    return false;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());

    return true;
  } catch {
    return false;
  }
}

/**
 * The company's local date and hour.
 *
 * Null when the zone cannot be read, which the callers treat as "do not hold
 * anything back" rather than "send nothing" — a broken settings value must not
 * silence a safety escalation.
 */
function readLocalParts(nowMs: number, timeZone: string): { date: string; hour: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
      month: '2-digit',
      timeZone,
      year: 'numeric'
    }).formatToParts(new Date(nowMs));
    const read = (type: string) => parts.find((part) => part.type === type)?.value || '';
    const hour = Number(read('hour'));

    if (!Number.isInteger(hour)) {
      return null;
    }

    return {
      date: `${read('year')}-${read('month')}-${read('day')}`,
      // Some locales render midnight as 24; both mean the same hour of the day.
      hour: hour === 24 ? 0 : hour
    };
  } catch {
    return null;
  }
}

function normalizeFrequency(value: unknown): ActionReminderFrequency {
  return value === 'OFF' || value === 'TWICE' || value === 'ONCE'
    ? value
    : DEFAULT_ACTION_REMINDER_POLICY.frequency;
}

function normalizeHour(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 23
    ? value
    : fallback;
}

function normalizeEscalationHours(value: unknown): number | null {
  if (value === null) {
    return null;
  }

  return typeof value === 'number' && ESCALATION_HOUR_CHOICES.includes(value)
    ? value
    : DEFAULT_ACTION_REMINDER_POLICY.escalateOverdueAfterHours;
}

function normalizeTimeZone(value: unknown): string {
  return isUsableTimeZone(value) ? (value as string).trim() : DEFAULT_ACTION_REMINDER_POLICY.timeZone;
}
