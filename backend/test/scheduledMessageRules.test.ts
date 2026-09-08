import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_SCHEDULED_MESSAGE_POLICY,
  MAX_RELEASE_ATTEMPTS,
  MIN_SCHEDULE_LEAD_MS,
  canCancelScheduledMessage,
  canDismissScheduledMessage,
  checkScheduleRequest,
  describeScheduleRejection,
  isPendingScheduledMessage,
  isPermanentReleaseFailure,
  isVisibleToSender,
  validateAdminCancellationReason,
  normalizeScheduledMessagePolicy,
  resolveReleaseFailureStatus,
  selectDeliverableRecipientDevices,
  validateScheduledMessagePolicyInput
} from '../src/services/scheduledMessageRules.ts';

/**
 * A message written now and sent later.
 *
 * These rules decide whether somebody may schedule at all, who may stop one,
 * and what happens when the moment arrives and something has changed. All three
 * are things that only go wrong hours or days after the code ran, which is
 * exactly why none of them is left to be discovered in production.
 */

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-09-07T09:00:00.000Z');
const policy = DEFAULT_SCHEDULED_MESSAGE_POLICY;

const named = (name: string) => {
  const error = new Error('refused');
  error.name = name;

  return error;
};

describe('reading a company\'s settings', () => {
  it('gives the defaults when nothing has been set', () => {
    assert.deepEqual(normalizeScheduledMessagePolicy(undefined), DEFAULT_SCHEDULED_MESSAGE_POLICY);
    assert.deepEqual(normalizeScheduledMessagePolicy({}), DEFAULT_SCHEDULED_MESSAGE_POLICY);
  });

  it('has scheduling and admin visibility on out of the box', () => {
    assert.equal(DEFAULT_SCHEDULED_MESSAGE_POLICY.enabled, true);
    assert.equal(DEFAULT_SCHEDULED_MESSAGE_POLICY.adminVisibilityEnabled, true);
  });

  it('takes only an explicit false as off', () => {
    // The difference between "not set yet" and "deliberately switched off".
    assert.equal(normalizeScheduledMessagePolicy({ enabled: false }).enabled, false);
    assert.equal(normalizeScheduledMessagePolicy({ enabled: undefined }).enabled, true);
    assert.equal(normalizeScheduledMessagePolicy({ adminVisibilityEnabled: false }).adminVisibilityEnabled, false);
  });

  it('keeps numbers an administrator set', () => {
    const stored = normalizeScheduledMessagePolicy({ maxDaysAhead: 90, maxPendingPerUser: 5 });

    assert.equal(stored.maxDaysAhead, 90);
    assert.equal(stored.maxPendingPerUser, 5);
  });

  it('falls back on anything unusable rather than throwing', () => {
    // Read while somebody is scheduling a message. A bad settings document must
    // not be able to stop them.
    for (const bad of [null, 'thirty', Number.NaN, Infinity, 0, -1, 400, {}]) {
      assert.equal(
        normalizeScheduledMessagePolicy({ maxDaysAhead: bad }).maxDaysAhead,
        DEFAULT_SCHEDULED_MESSAGE_POLICY.maxDaysAhead
      );
    }
  });

  it('falls back field by field, keeping what was set deliberately', () => {
    const mixed = normalizeScheduledMessagePolicy({ maxDaysAhead: 9999, maxPendingPerUser: 3 });

    assert.equal(mixed.maxDaysAhead, DEFAULT_SCHEDULED_MESSAGE_POLICY.maxDaysAhead);
    assert.equal(mixed.maxPendingPerUser, 3);
  });

  it('survives a document that is not an object at all', () => {
    for (const bad of [null, 'policy', 42, [], true]) {
      assert.deepEqual(normalizeScheduledMessagePolicy(bad), DEFAULT_SCHEDULED_MESSAGE_POLICY);
    }
  });
});

describe('saving a company\'s settings', () => {
  it('accepts sensible numbers', () => {
    assert.deepEqual(
      validateScheduledMessagePolicyInput({
        adminVisibilityEnabled: true,
        enabled: true,
        maxDaysAhead: 90,
        maxPendingPerUser: 50
      }),
      { ok: true, reason: null }
    );
  });

  it('refuses out-of-bounds rather than quietly storing something else', () => {
    // Reading falls back silently; saving must not. Somebody typed this, and
    // storing a different number is how a setting comes to mean the opposite of
    // what the person who set it believes.
    const tooFar = validateScheduledMessagePolicyInput({
      adminVisibilityEnabled: true,
      enabled: true,
      maxDaysAhead: 400,
      maxPendingPerUser: 20
    });

    assert.equal(tooFar.ok, false);
    assert.match(tooFar.reason || '', /365/);
  });

  it('refuses a fractional limit', () => {
    assert.equal(validateScheduledMessagePolicyInput({
      adminVisibilityEnabled: true,
      enabled: true,
      maxDaysAhead: 30.5,
      maxPendingPerUser: 20
    }).ok, false);
  });

  it('names the field that was wrong', () => {
    const tooMany = validateScheduledMessagePolicyInput({
      adminVisibilityEnabled: true,
      enabled: true,
      maxDaysAhead: 30,
      maxPendingPerUser: 5000
    });

    assert.match(tooMany.reason || '', /waiting/);
  });
});

describe('whether a message may be scheduled', () => {
  const request = (overrides: Partial<Parameters<typeof checkScheduleRequest>[0]> = {}) =>
    checkScheduleRequest({
      mediaCount: 0,
      nowMs: NOW,
      pendingCount: 0,
      policy,
      releaseAtMs: NOW + (2 * 60 * 60 * 1000),
      ...overrides
    });

  it('allows an ordinary one', () => {
    assert.deepEqual(request(), { ok: true, reason: null });
  });

  it('refuses when the company has switched scheduling off', () => {
    assert.equal(request({ policy: { ...policy, enabled: false } }).reason, 'DISABLED');
  });

  it('says scheduling is off before it says anything else is wrong', () => {
    // Being told the time is wrong, when the feature is off, sends somebody
    // back to the picker to fix something that was never the problem.
    const off = request({
      mediaCount: 2,
      policy: { ...policy, enabled: false },
      releaseAtMs: NOW
    });

    assert.equal(off.reason, 'DISABLED');
  });

  it('refuses photos and files for now', () => {
    assert.equal(request({ mediaCount: 1 }).reason, 'MEDIA_NOT_SUPPORTED');
  });

  it('refuses a time inside the next minute', () => {
    // The release worker runs every minute; this would race it.
    assert.equal(request({ releaseAtMs: NOW + MIN_SCHEDULE_LEAD_MS - 1 }).reason, 'TOO_SOON');
    assert.equal(request({ releaseAtMs: NOW }).reason, 'TOO_SOON');
    assert.equal(request({ releaseAtMs: NOW - DAY }).reason, 'TOO_SOON');
  });

  it('accepts a time exactly a minute out', () => {
    assert.equal(request({ releaseAtMs: NOW + MIN_SCHEDULE_LEAD_MS }).ok, true);
  });

  it('refuses a nonsense time rather than storing it', () => {
    for (const bad of [Number.NaN, Infinity, -Infinity]) {
      assert.equal(request({ releaseAtMs: bad }).reason, 'TOO_SOON');
    }
  });

  it('refuses further ahead than the company allows', () => {
    assert.equal(request({ releaseAtMs: NOW + (31 * DAY) }).reason, 'TOO_FAR');
    assert.equal(request({ releaseAtMs: NOW + (30 * DAY) }).ok, true);
  });

  it('respects a company that allows a longer horizon', () => {
    assert.equal(request({
      policy: { ...policy, maxDaysAhead: 90 },
      releaseAtMs: NOW + (60 * DAY)
    }).ok, true);
  });

  it('refuses once somebody has their limit waiting', () => {
    assert.equal(request({ pendingCount: 20 }).reason, 'TOO_MANY');
    assert.equal(request({ pendingCount: 19 }).ok, true);
  });

  it('explains every refusal in words somebody can act on', () => {
    for (const reason of ['DISABLED', 'MEDIA_NOT_SUPPORTED', 'TOO_FAR', 'TOO_MANY', 'TOO_SOON'] as const) {
      const message = describeScheduleRejection(reason, policy);

      assert.ok(message.length > 10, `${reason} needs a real explanation.`);
      assert.match(message, /[a-z]\.$/, `${reason} should read as a sentence.`);
    }
  });
});

describe('which devices still receive it when the moment comes', () => {
  it('delivers to the devices that are still there', () => {
    assert.deepEqual(
      selectDeliverableRecipientDevices(['device_a', 'device_b'], ['device_a', 'device_b']),
      ['device_a', 'device_b']
    );
  });

  it('drops one that was retired or revoked in the meantime', () => {
    // A device leaving is not a reason to withhold the message from the rest.
    assert.deepEqual(
      selectDeliverableRecipientDevices(['device_a', 'device_gone'], ['device_a']),
      ['device_a']
    );
  });

  it('returns nothing when every device it was sealed to has gone', () => {
    // The caller must notice this and tell the sender, not send to nobody.
    assert.deepEqual(selectDeliverableRecipientDevices(['device_gone'], ['device_new']), []);
  });

  it('never invents a device it holds no key for', () => {
    // A device registered after the message was sealed has no key in it, so
    // adding it here would produce a message it cannot open.
    assert.deepEqual(
      selectDeliverableRecipientDevices(['device_a'], ['device_a', 'device_registered_later']),
      ['device_a']
    );
  });

  it('keeps the order it was sealed in', () => {
    assert.deepEqual(
      selectDeliverableRecipientDevices(['device_c', 'device_a', 'device_b'], ['device_a', 'device_b', 'device_c']),
      ['device_c', 'device_a', 'device_b']
    );
  });
});

describe('what happens when a release fails', () => {
  it('gives up on a refusal, which will only be refused again', () => {
    for (const name of ['AuthorizationError', 'ConflictError', 'NotFoundError', 'ValidationError']) {
      assert.equal(isPermanentReleaseFailure(named(name)), true);
    }
  });

  it('tries again after something that might pass next time', () => {
    assert.equal(isPermanentReleaseFailure(new Error('socket hang up')), false);
    assert.equal(isPermanentReleaseFailure('a string'), false);
    assert.equal(isPermanentReleaseFailure(undefined), false);
  });

  it('stops retrying a deactivated sender immediately', () => {
    // Somebody offboarded at three o'clock must not have a message go at five,
    // and the refusal will be identical on every run.
    assert.deepEqual(
      resolveReleaseFailureStatus({ attempts: 1, error: named('AuthorizationError') }),
      { nextStatus: 'FAILED', willRetry: false }
    );
  });

  it('retries a transient failure', () => {
    assert.deepEqual(
      resolveReleaseFailureStatus({ attempts: 1, error: new Error('network') }),
      { nextStatus: 'SCHEDULED', willRetry: true }
    );
  });

  it('gives up once it has tried enough', () => {
    assert.equal(
      resolveReleaseFailureStatus({ attempts: MAX_RELEASE_ATTEMPTS, error: new Error('network') }).willRetry,
      false
    );
    assert.equal(
      resolveReleaseFailureStatus({ attempts: MAX_RELEASE_ATTEMPTS - 1, error: new Error('network') }).willRetry,
      true
    );
  });
});

describe('who may stop a message before it goes', () => {
  const base = {
    callerIsOrgAdminWithSecurityPermission: false,
    callerUid: 'someone-else',
    policy,
    senderUid: 'author'
  };

  it('lets the person who wrote it stop it', () => {
    assert.equal(canCancelScheduledMessage({ ...base, callerUid: 'author' }), true);
  });

  it('lets an org admin stop it where the company allows it', () => {
    assert.equal(canCancelScheduledMessage({
      ...base,
      callerIsOrgAdminWithSecurityPermission: true
    }), true);
  });

  it('refuses an admin where the company has turned visibility off', () => {
    // An admin who cannot see a message waiting must not be able to cancel it,
    // or the setting would only be half a setting.
    assert.equal(canCancelScheduledMessage({
      ...base,
      callerIsOrgAdminWithSecurityPermission: true,
      policy: { ...policy, adminVisibilityEnabled: false }
    }), false);
  });

  it('still lets the author stop their own with visibility off', () => {
    assert.equal(canCancelScheduledMessage({
      ...base,
      callerUid: 'author',
      policy: { ...policy, adminVisibilityEnabled: false }
    }), true);
  });

  it('refuses a colleague', () => {
    assert.equal(canCancelScheduledMessage(base), false);
  });
});

describe('which messages can still be acted on', () => {
  it('only one still waiting', () => {
    assert.equal(isPendingScheduledMessage('SCHEDULED'), true);
  });

  it('not one a worker has already claimed', () => {
    // Cancelling underneath a release in progress leaves the two disagreeing
    // about whether it was sent.
    assert.equal(isPendingScheduledMessage('SENDING'), false);
  });

  it('not one that is finished, one way or the other', () => {
    for (const status of ['SENT', 'CANCELLED', 'FAILED', undefined, '']) {
      assert.equal(isPendingScheduledMessage(status), false);
    }
  });
});

describe('what the author is still shown', () => {
  it('shows one still waiting', () => {
    assert.equal(isVisibleToSender({ status: 'SCHEDULED' }), true);
  });

  it('shows one that was given up on', () => {
    // The failure this closes: a message that could not be sent vanished from
    // the list, so the person believed it had gone and nothing said otherwise.
    assert.equal(isVisibleToSender({ status: 'FAILED' }), true);
  });

  it('stops showing one the author has cleared', () => {
    assert.equal(isVisibleToSender({ dismissedAt: 'anything', status: 'FAILED' }), false);
  });

  it('does not show one that went', () => {
    assert.equal(isVisibleToSender({ status: 'SENT' }), false);
  });

  it('does not show one the author cancelled themselves', () => {
    // They were there. Telling them about their own decision is noise.
    assert.equal(isVisibleToSender({
      cancelledByUid: 'author',
      senderUid: 'author',
      status: 'CANCELLED'
    }), false);
  });

  it('shows one an administrator stopped', () => {
    // A message they wrote did not go, and somebody else decided that. Not
    // being told would leave them believing it was sent.
    assert.equal(isVisibleToSender({
      cancelledByUid: 'admin',
      senderUid: 'author',
      status: 'CANCELLED'
    }), true);
  });

  it('stops showing an administrator\'s stop once the author has cleared it', () => {
    assert.equal(isVisibleToSender({
      cancelledByUid: 'admin',
      dismissedAt: 'anything',
      senderUid: 'author',
      status: 'CANCELLED'
    }), false);
  });

  it('does not show one a worker is partway through', () => {
    assert.equal(isVisibleToSender({ status: 'SENDING' }), false);
  });
});

describe('clearing a failure off the list', () => {
  const base = { callerUid: 'author', senderUid: 'author', status: 'FAILED' };

  it('lets the author clear their own failure', () => {
    assert.equal(canDismissScheduledMessage(base), true);
  });

  it('refuses a colleague', () => {
    assert.equal(canDismissScheduledMessage({ ...base, callerUid: 'someone-else' }), false);
  });

  it('lets the author clear a stop an administrator made', () => {
    assert.equal(canDismissScheduledMessage({ ...base, status: 'CANCELLED' }), true);
  });

  it('refuses one that is still waiting to be sent', () => {
    // Dismissing and cancelling are different things. A tap meant to tidy away
    // a failure must never quietly stop a message that is about to go.
    assert.equal(canDismissScheduledMessage({ ...base, status: 'SCHEDULED' }), false);
  });

  it('refuses one that was already sent', () => {
    assert.equal(canDismissScheduledMessage({ ...base, status: 'SENT' }), false);
  });
});

describe('the reason an administrator must give', () => {
  it('accepts a real sentence', () => {
    assert.deepEqual(
      validateAdminCancellationReason('Wrong recipient for the shift handover'),
      { ok: true, reason: null }
    );
  });

  it('refuses nothing at all', () => {
    // The box is not paperwork. The author reads what it says, and an admin who
    // must explain themselves to the person affected acts differently from one
    // who can act invisibly.
    for (const bad of [undefined, '', '   ', '.', 'no', 'spam']) {
      assert.equal(validateAdminCancellationReason(bad).ok, false);
    }
  });

  it('says the reason will be seen, so nobody writes one thinking it is private', () => {
    assert.match(validateAdminCancellationReason('no').reason || '', /will see it/);
  });

  it('does not count surrounding spaces towards the length', () => {
    assert.equal(validateAdminCancellationReason('   ok    ').ok, false);
  });
});
