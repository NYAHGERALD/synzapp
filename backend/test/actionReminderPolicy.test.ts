import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_ACTION_REMINDER_POLICY,
  canSendNow,
  findDueReminderSlot,
  isUsableTimeZone,
  normalizeActionReminderPolicy,
  reminderHoursFor,
  shouldEscalateOverdue,
  validateActionReminderPolicyInput
} from '../src/services/actionReminderPolicy.ts';

/**
 * When people are reminded about work they still owe.
 *
 * Every one of these is a question a scheduler gets wrong quietly. A slot that
 * fires twice sends two reminders; a zone applied as a fixed offset moves
 * breakfast to seven for half the year; an escalation with no memory tells a
 * supervisor the same thing every fifteen minutes until they mute it.
 */

const policy = DEFAULT_ACTION_REMINDER_POLICY;
const london = (iso: string) => Date.parse(iso);

describe('reading a company\'s settings', () => {
  it('gives the defaults when nothing is set', () => {
    assert.deepEqual(normalizeActionReminderPolicy(undefined), DEFAULT_ACTION_REMINDER_POLICY);
    assert.deepEqual(normalizeActionReminderPolicy({}), DEFAULT_ACTION_REMINDER_POLICY);
  });

  it('defaults to one reminder a day, not none and not two', () => {
    // One a day is the most that can be sent indefinitely without being tuned
    // out, and a feature that defaults to off protects nobody.
    assert.equal(DEFAULT_ACTION_REMINDER_POLICY.frequency, 'ONCE');
  });

  it('keeps what an administrator set', () => {
    const stored = normalizeActionReminderPolicy({
      escalateOverdueAfterHours: 8,
      firstReminderHour: 6,
      frequency: 'TWICE',
      secondReminderHour: 14,
      timeZone: 'Europe/London'
    });

    assert.equal(stored.frequency, 'TWICE');
    assert.equal(stored.firstReminderHour, 6);
    assert.equal(stored.secondReminderHour, 14);
    assert.equal(stored.escalateOverdueAfterHours, 8);
    assert.equal(stored.timeZone, 'Europe/London');
  });

  it('keeps an explicit "never escalate"', () => {
    assert.equal(normalizeActionReminderPolicy({ escalateOverdueAfterHours: null }).escalateOverdueAfterHours, null);
  });

  it('falls back on anything unusable rather than throwing', () => {
    for (const bad of [null, 'eight', 24, -1, 1.5, {}]) {
      assert.equal(
        normalizeActionReminderPolicy({ firstReminderHour: bad }).firstReminderHour,
        DEFAULT_ACTION_REMINDER_POLICY.firstReminderHour
      );
    }
  });

  it('falls back on a time zone this machine cannot read', () => {
    assert.equal(normalizeActionReminderPolicy({ timeZone: 'Mars/Olympus' }).timeZone, 'UTC');
  });
});

describe('saving a company\'s settings', () => {
  const input = {
    escalateOverdueAfterHours: 24 as number | null,
    firstReminderHour: 8,
    frequency: 'ONCE',
    secondReminderHour: 15,
    timeZone: 'Europe/London',
    workingHoursEndHour: 19,
    workingHoursStartHour: 7
  };

  it('accepts a sensible set', () => {
    assert.deepEqual(validateActionReminderPolicyInput(input), { ok: true, reason: null });
  });

  it('refuses working hours that end before they start', () => {
    assert.equal(validateActionReminderPolicyInput({
      ...input,
      workingHoursEndHour: 6
    }).ok, false);
  });

  it('refuses two reminders at the same hour', () => {
    // Two reminders at the same hour is one reminder, and a setting that lies
    // about what it does is worse than one that refuses.
    const twice = validateActionReminderPolicyInput({
      ...input,
      frequency: 'TWICE',
      secondReminderHour: 8
    });

    assert.equal(twice.ok, false);
    assert.match(twice.reason || '', /one reminder/);
  });

  it('allows the same hour when only one reminder is sent', () => {
    assert.equal(validateActionReminderPolicyInput({ ...input, secondReminderHour: 8 }).ok, true);
  });

  it('refuses an escalation period nobody offered', () => {
    assert.equal(validateActionReminderPolicyInput({ ...input, escalateOverdueAfterHours: 3 }).ok, false);
  });

  it('accepts never escalating', () => {
    assert.equal(validateActionReminderPolicyInput({ ...input, escalateOverdueAfterHours: null }).ok, true);
  });

  it('refuses a time zone that cannot be read', () => {
    assert.equal(validateActionReminderPolicyInput({ ...input, timeZone: 'Nowhere' }).ok, false);
  });
});

describe('which hours a digest is sent at', () => {
  it('sends none when reminders are off', () => {
    assert.deepEqual(reminderHoursFor({ ...policy, frequency: 'OFF' }), []);
  });

  it('sends one', () => {
    assert.deepEqual(reminderHoursFor({ ...policy, frequency: 'ONCE' }), [8]);
  });

  it('sends two, in order', () => {
    assert.deepEqual(reminderHoursFor({ ...policy, firstReminderHour: 15, frequency: 'TWICE', secondReminderHour: 8 }), [8, 15]);
  });

  it('never lists the same hour twice', () => {
    assert.deepEqual(reminderHoursFor({ ...policy, frequency: 'TWICE', secondReminderHour: 8 }), [8]);
  });
});

describe('whether this moment is a reminder slot', () => {
  const inZone = { ...policy, timeZone: 'Europe/London' };

  it('finds the slot on the hour', () => {
    assert.equal(
      findDueReminderSlot({ nowMs: london('2026-01-15T08:05:00Z'), policy: inZone }),
      '2026-01-15:08'
    );
  });

  it('gives the same key twice inside the hour, so a repeat run is skipped', () => {
    // A worker that fires every fifteen minutes must not send four reminders.
    const early = findDueReminderSlot({ nowMs: london('2026-01-15T08:01:00Z'), policy: inZone });
    const late = findDueReminderSlot({ nowMs: london('2026-01-15T08:59:00Z'), policy: inZone });

    assert.equal(early, late);
  });

  it('is nothing outside the hour', () => {
    assert.equal(findDueReminderSlot({ nowMs: london('2026-01-15T09:05:00Z'), policy: inZone }), null);
  });

  it('does not deliver a missed reminder hours later', () => {
    // A reminder arriving at the wrong time of day is one people stop trusting.
    assert.equal(findDueReminderSlot({ nowMs: london('2026-01-15T12:00:00Z'), policy: inZone }), null);
  });

  it('holds eight in the morning at eight through a clock change', () => {
    // London is UTC in January and UTC+1 in July. A fixed offset would move it.
    const winter = findDueReminderSlot({ nowMs: london('2026-01-15T08:30:00Z'), policy: inZone });
    const summer = findDueReminderSlot({ nowMs: london('2026-07-15T07:30:00Z'), policy: inZone });

    assert.equal(winter, '2026-01-15:08');
    assert.equal(summer, '2026-07-15:08');
  });

  it('reads the company\'s clock, not the server\'s', () => {
    const lagos = findDueReminderSlot({
      nowMs: london('2026-01-15T07:30:00Z'),
      policy: { ...policy, timeZone: 'Africa/Lagos' }
    });

    assert.equal(lagos, '2026-01-15:08');
  });

  it('sends nothing at all when reminders are off', () => {
    assert.equal(findDueReminderSlot({
      nowMs: london('2026-01-15T08:05:00Z'),
      policy: { ...inZone, frequency: 'OFF' }
    }), null);
  });
});

describe('whether anything may go out right now', () => {
  const inZone = { ...policy, timeZone: 'Europe/London' };

  it('allows it inside working hours', () => {
    assert.equal(canSendNow({ hasCriticalOverdue: false, nowMs: london('2026-01-15T09:00:00Z'), policy: inZone }), true);
  });

  it('holds it back at night', () => {
    assert.equal(canSendNow({ hasCriticalOverdue: false, nowMs: london('2026-01-15T23:00:00Z'), policy: inZone }), false);
    assert.equal(canSendNow({ hasCriticalOverdue: false, nowMs: london('2026-01-15T05:00:00Z'), policy: inZone }), false);
  });

  it('sends a critical overdue action whatever the hour', () => {
    // The one case where waiting until morning is the wrong answer.
    assert.equal(canSendNow({ hasCriticalOverdue: true, nowMs: london('2026-01-15T03:00:00Z'), policy: inZone }), true);
  });

  it('does not hold anything back when the zone cannot be read', () => {
    // A broken settings value must not silence a safety escalation.
    assert.equal(canSendNow({
      hasCriticalOverdue: false,
      nowMs: london('2026-01-15T03:00:00Z'),
      policy: { ...policy, timeZone: 'Mars/Olympus' }
    }), true);
  });
});

describe('escalating an overdue action', () => {
  const nowMs = london('2026-01-15T12:00:00Z');
  const HOUR = 60 * 60 * 1000;

  it('escalates once the period has passed', () => {
    assert.equal(shouldEscalateOverdue({
      dueAtMs: nowMs - (25 * HOUR),
      lastEscalatedAtMs: null,
      nowMs,
      policy
    }), true);
  });

  it('waits until it has', () => {
    assert.equal(shouldEscalateOverdue({
      dueAtMs: nowMs - (23 * HOUR),
      lastEscalatedAtMs: null,
      nowMs,
      policy
    }), false);
  });

  it('never escalates twice', () => {
    // Telling a supervisor the same thing every fifteen minutes is how a
    // supervisor learns to ignore supervisors' notifications.
    assert.equal(shouldEscalateOverdue({
      dueAtMs: nowMs - (100 * HOUR),
      lastEscalatedAtMs: nowMs - HOUR,
      nowMs,
      policy
    }), false);
  });

  it('does not escalate an action with no date', () => {
    assert.equal(shouldEscalateOverdue({ dueAtMs: null, lastEscalatedAtMs: null, nowMs, policy }), false);
  });

  it('respects a company that turned escalation off', () => {
    assert.equal(shouldEscalateOverdue({
      dueAtMs: nowMs - (100 * HOUR),
      lastEscalatedAtMs: null,
      nowMs,
      policy: { ...policy, escalateOverdueAfterHours: null }
    }), false);
  });
});

describe('time zones this machine can read', () => {
  it('accepts real ones', () => {
    for (const zone of ['UTC', 'Europe/London', 'Africa/Lagos', 'America/New_York']) {
      assert.equal(isUsableTimeZone(zone), true, zone);
    }
  });

  it('refuses anything else', () => {
    for (const bad of ['Mars/Olympus', '', '   ', null, undefined, 42]) {
      assert.equal(isUsableTimeZone(bad), false);
    }
  });
});
