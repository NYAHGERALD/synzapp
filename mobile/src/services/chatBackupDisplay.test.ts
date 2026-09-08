import { describe, expect, it } from 'vitest';
import { describeLastBackup, describeRestoreState } from './chatBackupDisplay';

const NOW = new Date(2026, 8, 6, 12, 0, 0).getTime();

describe('describeLastBackup', () => {
  it('says so plainly when nothing has ever been backed up', () => {
    // A blank row reads as "fine". Somebody with no backup at all must not be
    // reassured by a screen that says nothing.
    expect(describeLastBackup(null, NOW)).toBe('Not backed up yet');
  });

  it('treats an unreadable timestamp as never', () => {
    expect(describeLastBackup(Number.NaN, NOW)).toBe('Not backed up yet');
  });

  it('reads naturally seconds after a backup', () => {
    expect(describeLastBackup(NOW - 5_000, NOW)).toBe('Backed up just now');
  });

  it('counts minutes, and gets the singular right', () => {
    expect(describeLastBackup(NOW - 60_000, NOW)).toBe('Backed up 1 minute ago');
    expect(describeLastBackup(NOW - 300_000, NOW)).toBe('Backed up 5 minutes ago');
  });

  it('counts hours and days', () => {
    expect(describeLastBackup(NOW - 3 * 3600_000, NOW)).toBe('Backed up 3 hours ago');
    expect(describeLastBackup(NOW - 2 * 86400_000, NOW)).toBe('Backed up 2 days ago');
  });

  it('never reports a backup from the future as overdue', () => {
    expect(describeLastBackup(NOW + 60_000, NOW)).toBe('Backed up just now');
  });
});

describe('describeRestoreState', () => {
  it('tells somebody their request is with an administrator', () => {
    expect(describeRestoreState('pending', false)).toBe('Waiting for your administrator');
  });

  it('says when it has been approved and what to do', () => {
    expect(describeRestoreState('approved', false)).toBe('Approved. Tap to restore');
  });

  it('does not hide a refusal', () => {
    expect(describeRestoreState('denied', false)).toBe('Your administrator declined this request');
  });

  it('offers a straight restore when the device still holds its own key', () => {
    expect(describeRestoreState(null, true)).toBe('Restore your latest backup');
  });

  it('warns that approval is needed before somebody taps and waits', () => {
    expect(describeRestoreState(null, false)).toBe('Your administrator has to approve this');
  });

  it('shows the request state even where self-service is allowed', () => {
    expect(describeRestoreState('pending', true)).toBe('Waiting for your administrator');
  });
});
