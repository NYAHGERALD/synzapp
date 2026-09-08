import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const read = (...parts: string[]) => readFileSync(resolve(backendRoot, 'src', ...parts), 'utf8');
const notifications = read('services', 'notificationService.ts');
const actions = read('services', 'actionService.ts');
const rails = read('services', 'railsService.ts');
const announcements = read('services', 'announcementService.ts');

/**
 * Actions share their push sender with RAILS and announcements.
 *
 * RAILS is a finished section that is not to be touched, and the cheapest way
 * to break it is to add something to a function three features call. These
 * assertions exist so that "actions now carry a photo and their own channel"
 * cannot quietly become "RAILS notifications changed".
 */

describe('the shared push sender stays shared', () => {
  it('keeps rails-updates as the channel when nobody asks for another', () => {
    assert.match(notifications, /channelId: input\.androidChannelId \|\| 'rails-updates'/);
  });

  it('keeps the notification block for everyone who is not asking to draw it', () => {
    // The block is what Android draws from while the app is backgrounded. RAILS
    // and announcements keep it, so their notifications are unchanged.
    assert.match(notifications, /const drawnByApp = Boolean\(input\.androidChannelId\)/);
    assert.match(
      notifications,
      /\.\.\.\(drawnByApp \? \{\} : \{\s*notification: \{\s*body: input\.body,\s*title: input\.title\s*\}\s*\}\)/
    );
  });

  it('gives the app a plain fallback to draw when it declines the rich one', () => {
    // A fault in the richer path must cost the photo, never the notification.
    assert.match(notifications, /message: input\.body/);
    assert.match(notifications, /channelId: input\.androidChannelId as string/);
  });

  it('leaves RAILS and announcements asking for nothing new', () => {
    // If either ever passes a channel or a photo, this test should be the thing
    // that makes somebody think about it first.
    assert.doesNotMatch(rails, /androidChannelId/);
    assert.doesNotMatch(announcements, /androidChannelId/);
    assert.doesNotMatch(rails, /notificationSenderProfilePhotoCacheKey/);
    assert.doesNotMatch(announcements, /notificationSenderProfilePhotoCacheKey/);
  });
});

describe('what an action notification carries', () => {
  it('asks for its own Android channel', () => {
    // So action reminders can be silenced without silencing the app that also
    // carries the overdue escalation.
    assert.match(actions, /androidChannelId: ACTION_NOTIFICATION_CHANNEL_ID/);
    assert.match(actions, /ACTION_NOTIFICATION_CHANNEL_ID = 'action-updates'/);
  });

  it('carries a photo key rather than a photo', () => {
    assert.match(actions, /readActorProfilePhotoCacheKey\(/);
    assert.match(actions, /notificationSenderProfilePhotoCacheKey: actorProfilePhotoCacheKey/);
    assert.doesNotMatch(actions, /profilePhotoUrl:/);
  });

  it('sends nothing at all rather than failing when somebody has no photo', () => {
    assert.match(notifications, /export async function readActorProfilePhotoCacheKey[\s\S]{0,900}return null;/);
  });
});

describe('the statuses somebody else is waiting on', () => {
  it('notifies when work is started', () => {
    assert.match(actions, /kind === 'STARTED'/);
    assert.match(actions, /'IN_PROGRESS'\s*\?\s*'STARTED'/);
  });

  it('notifies when work is blocked, and says what it is waiting on', () => {
    // "Blocked" on its own tells nobody what to do.
    assert.match(actions, /waiting on \$\{action\.blockedReason/);
  });

  it('tells the person who raised it and the admins who own it', () => {
    assert.match(actions, /loadDepartmentAdminUids\(input\.tenantId, action\.responsibleDepartmentId\)/);
  });

  it('finds only active department admins', () => {
    assert.match(actions, /where\('role', '==', 'DEPT_ADMIN'\)/);
    assert.match(actions, /status === 'ACTIVE'/);
  });
});
