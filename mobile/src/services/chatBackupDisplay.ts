import type { ChatBackupRestoreStatus } from './chatBackup';

/**
 * What an employee is told about their own backup.
 *
 * They are not the key custodian here, so there is nothing for them to keep and
 * nothing to copy. What they need is the two facts that actually affect them:
 * whether their history is protected, and where a request to get it back on a
 * new device has got to.
 *
 * The wording avoids the machinery on purpose. "Waiting for your administrator"
 * is something a supervisor on a night shift can act on; "approval pending
 * KMS unwrap" is not.
 */

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * When this device last uploaded.
 *
 * Never backed up is said plainly rather than left blank. A blank row reads as
 * "fine", and somebody whose chats have never been backed up should not be
 * reassured by a screen that says nothing.
 */
export function describeLastBackup(lastBackupAtMs: number | null, nowMs = Date.now()): string {
  if (!lastBackupAtMs || !Number.isFinite(lastBackupAtMs)) {
    return 'Not backed up yet';
  }

  const elapsed = Math.max(0, nowMs - lastBackupAtMs);

  if (elapsed < MINUTE_MS) {
    return 'Backed up just now';
  }

  if (elapsed < HOUR_MS) {
    const minutes = Math.floor(elapsed / MINUTE_MS);

    return `Backed up ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  if (elapsed < DAY_MS) {
    const hours = Math.floor(elapsed / HOUR_MS);

    return `Backed up ${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.floor(elapsed / DAY_MS);

  return `Backed up ${days} day${days === 1 ? '' : 's'} ago`;
}

/**
 * Where a restore has got to.
 *
 * A device that still holds its own key restores on its own and never asks.
 * One that has been reinstalled has nothing, so it asks, and this is the only
 * place the person finds out whether anybody has answered.
 */
export function describeRestoreState(
  status: ChatBackupRestoreStatus | null,
  selfRestoreEnabled: boolean
): string {
  if (status === 'pending') {
    return 'Waiting for your administrator';
  }

  if (status === 'approved') {
    return 'Approved. Tap to restore';
  }

  if (status === 'denied') {
    return 'Your administrator declined this request';
  }

  if (selfRestoreEnabled) {
    return 'Restore your latest backup';
  }

  return 'Your administrator has to approve this';
}
