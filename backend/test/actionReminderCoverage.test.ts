import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const read = (...parts: string[]) => readFileSync(resolve(backendRoot, 'src', ...parts), 'utf8');
const reminders = read('services', 'actionReminderService.ts');
const devices = read('services', 'deviceIdentityService.ts');

/**
 * The promises the awareness plan makes, pinned against the code.
 *
 * Each of these was found missing after the plan said it was there. They are
 * the sort of gap that only shows up on the day somebody asks "why did nobody
 * hear about this" — which is too late to be the first time anybody checks.
 */

describe('nothing escalates to nobody', () => {
  it('falls back to organization admins when a department has none', () => {
    // An action raised outside a department, or in one with no admin, would
    // otherwise escalate to an empty list and be silently dropped — which is
    // the exact outcome this whole feature exists to prevent.
    assert.match(reminders, /const organizationAdmins = await usersRef\.where\('role', '==', 'ORG_ADMIN'\)/);
    assert.match(reminders, /if \(active\.length\) \{\s*return active;/);
  });

  it('only ever tells active people', () => {
    const matches = reminders.match(/status === 'ACTIVE'/g) || [];

    assert.ok(matches.length >= 2, 'Both the department and the organization lookup must filter on active.');
  });
});

describe('the audit the plan promised', () => {
  it('records that a reminder was sent, with the counts and not the actions', () => {
    assert.match(reminders, /action: 'ACTION_REMINDER_SENT'/);
    assert.match(reminders, /awaitingVerification: counts\.awaitingVerification/);
    assert.doesNotMatch(reminders, /action: 'ACTION_REMINDER_SENT'[\s\S]{0,400}title:/);
  });

  it('records an escalation, because somebody will ask why their supervisor knew', () => {
    assert.match(reminders, /action: 'ACTION_ESCALATED'[\s\S]{0,400}writeAuditEvent|writeAuditEvent\(\{\s*action: 'ACTION_ESCALATED'/);
    assert.match(reminders, /overdueSinceMs: action\.dueAtMs/);
  });

  it('never fails a notification because its audit failed', () => {
    // The reminder is the point; the record of it is not worth losing it for.
    const auditCalls = reminders.match(/writeAuditEvent\(\{[\s\S]*?\}\)\.catch\(\(\) => undefined\)/g) || [];

    assert.ok(auditCalls.length >= 2, 'Every audit write in the worker must be best effort.');
  });
});

describe('an organization learns its own clock', () => {
  it('takes it from an administrator\'s phone when nothing has been set', () => {
    // Otherwise "remind everybody at 08:00" means eight o'clock UTC, which is
    // the middle of the night in half the places this is sold.
    assert.match(devices, /role === 'ORG_ADMIN' &&\s*input\.deviceTimeZone &&\s*!organization\.actionReminderPolicy\?\.timeZone/);
  });

  it('never overrules a zone somebody chose', () => {
    assert.match(devices, /!organization\.actionReminderPolicy\?\.timeZone/);
  });

  it('costs no extra read, being written where the organization was already loaded', () => {
    // Inside the transaction that already fetched the organization, and before
    // the device record it sits beside. Anywhere else would mean a second read
    // on the path every app start takes.
    const transactionIndex = devices.indexOf('await firestore.runTransaction');
    const writeIndex = devices.indexOf('actionReminderPolicy: { timeZone: input.deviceTimeZone }');
    const deviceWriteIndex = devices.indexOf('transaction.set(userDeviceRef');

    assert.ok(transactionIndex > 0, 'Registration should still run in a transaction.');
    assert.ok(writeIndex > transactionIndex, 'The zone must be written inside that transaction.');
    assert.ok(writeIndex < deviceWriteIndex, 'It belongs beside the device write, not after it.');
  });
});

describe('a reminder is sent once', () => {
  it('claims the slot before sending, not after', () => {
    // A crash between the two costs a reminder rather than sending a second.
    // Somebody reminded twice trusts the next one less.
    const claimIndex = reminders.indexOf('const claimed = await claimReminderSlot');
    const sendIndex = reminders.indexOf("type: 'ACTION_REMINDER'");

    assert.ok(claimIndex > 0 && sendIndex > claimIndex, 'The slot must be claimed before the send.');
  });

  it('marks an escalation on the action itself', () => {
    // "Only once" becomes true by construction: the flag is on the thing being
    // escalated, so two runs reading different records cannot both send.
    assert.match(reminders, /escalatedAtMs: nowMs/);
  });
});
