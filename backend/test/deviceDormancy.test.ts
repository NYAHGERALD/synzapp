import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_DORMANT_DEVICE_RETIREMENT_DAYS,
  isDormantDevice,
  normalizeDormantDeviceRetirementDays,
  partitionDormantDevices,
  readDeviceActivityMs
} from '../src/services/deviceDormancy.ts';

/**
 * Retiring a device registration nobody is carrying any more.
 *
 * Worth testing carefully because the two failure directions are so unequal.
 * Retiring too little wastes a sealed copy per message. Retiring too much means
 * a message somebody was sent never reaches the phone in their hand, and no
 * amount of later correction gets it there.
 */

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-09-07T12:00:00.000Z');
const window = { nowMs: NOW, retirementDays: 45 };
const daysAgo = (days: number) => ({ toMillis: () => NOW - (days * DAY) });

describe('reading when a device was last known to exist', () => {
  it('prefers the last time it made a request', () => {
    assert.equal(
      readDeviceActivityMs({ createdAt: daysAgo(300), lastSeenAt: daysAgo(2) }),
      NOW - (2 * DAY)
    );
  });

  it('falls back to registration day for one never heard from again', () => {
    assert.equal(readDeviceActivityMs({ createdAt: daysAgo(90) }), NOW - (90 * DAY));
  });

  it('reads the seconds form Firestore also returns', () => {
    assert.equal(readDeviceActivityMs({ lastSeenAt: { seconds: 1_700_000_000 } }), 1_700_000_000_000);
  });

  it('is null when there is nothing to judge by', () => {
    assert.equal(readDeviceActivityMs({}), null);
    assert.equal(readDeviceActivityMs({ lastSeenAt: null, createdAt: null }), null);
    assert.equal(readDeviceActivityMs({ lastSeenAt: { seconds: 0 } }), null);
  });
});

describe('judging one registration', () => {
  it('retires one quiet for longer than the window', () => {
    assert.equal(isDormantDevice({ lastSeenAt: daysAgo(46), uid: 'a' }, window), true);
  });

  it('keeps one inside the window', () => {
    assert.equal(isDormantDevice({ lastSeenAt: daysAgo(44), uid: 'a' }, window), false);
  });

  it('keeps one on the boundary day', () => {
    // Exactly at the window is still inside it. A device is retired for being
    // past the line, not for reaching it.
    assert.equal(isDormantDevice({ lastSeenAt: daysAgo(45), uid: 'a' }, window), false);
  });

  it('never retires one with no history, however old the account', () => {
    // A missing timestamp is a gap in what we know, not evidence of a dead
    // handset, and guessing here costs somebody their messages.
    assert.equal(isDormantDevice({ uid: 'a' }, window), false);
  });

  it('leaves a revoked device alone', () => {
    // Already out of the fan-out, and for a reason a person chose. Retiring it
    // would overwrite that decision with a lifecycle one.
    assert.equal(isDormantDevice({ lastSeenAt: daysAgo(400), status: 'REVOKED', uid: 'a' }, window), false);
  });

  it('does not retire an already retired device twice', () => {
    assert.equal(isDormantDevice({ lastSeenAt: daysAgo(400), status: 'RETIRED', uid: 'a' }, window), false);
  });

  it('treats a missing status as active, which is what old records have', () => {
    assert.equal(isDormantDevice({ lastSeenAt: daysAgo(400), uid: 'a' }, window), true);
  });
});

describe('choosing which registrations still get a copy', () => {
  it('retires the reinstalled handset and keeps the one in use', () => {
    // Exactly the shape this was built for: one phone, three registrations,
    // two of them left behind by reinstalls before the identity could survive.
    const current = { deviceId: 'device_current', lastSeenAt: daysAgo(0), uid: 'gerald' };
    const first = { deviceId: 'device_first', lastSeenAt: daysAgo(120), uid: 'gerald' };
    const second = { deviceId: 'device_second', lastSeenAt: daysAgo(60), uid: 'gerald' };
    const { dormant, live } = partitionDormantDevices([current, first, second], window);

    assert.deepEqual(live, [current]);
    assert.deepEqual(dormant.map((device) => device.deviceId), ['device_first', 'device_second']);
  });

  it('never leaves somebody with no device at all', () => {
    // Away since spring. Every registration is past the window, so none of them
    // goes: a message sent to this person must still have somewhere to land.
    const onlyPhone = { deviceId: 'device_only', lastSeenAt: daysAgo(200), uid: 'away' };
    const oldTablet = { deviceId: 'device_tablet', lastSeenAt: daysAgo(300), uid: 'away' };
    const { dormant, live } = partitionDormantDevices([onlyPhone, oldTablet], window);

    assert.deepEqual(dormant, []);
    assert.equal(live.length, 2);
  });

  it('judges each person separately in a group', () => {
    // The bug this guards: a colleague who opened the app this morning
    // satisfying the last-device rule on behalf of one who has not.
    const activeColleague = { deviceId: 'device_a', lastSeenAt: daysAgo(1), uid: 'anna' };
    const absentColleague = { deviceId: 'device_b', lastSeenAt: daysAgo(200), uid: 'ben' };
    const { dormant, live } = partitionDormantDevices([activeColleague, absentColleague], window);

    assert.deepEqual(dormant, []);
    assert.equal(live.length, 2);
  });

  it('retires one colleague of two devices without touching another of one', () => {
    const anna = { deviceId: 'device_a1', lastSeenAt: daysAgo(1), uid: 'anna' };
    const annaOld = { deviceId: 'device_a2', lastSeenAt: daysAgo(200), uid: 'anna' };
    const ben = { deviceId: 'device_b1', lastSeenAt: daysAgo(300), uid: 'ben' };
    const { dormant, live } = partitionDormantDevices([anna, annaOld, ben], window);

    assert.deepEqual(dormant.map((device) => device.deviceId), ['device_a2']);
    assert.deepEqual(live.map((device) => device.deviceId).sort(), ['device_a1', 'device_b1']);
  });

  it('judges an unattributable record on its own, never sparing it by association', () => {
    const owned = { deviceId: 'device_owned', lastSeenAt: daysAgo(1), uid: 'anna' };
    const orphan = { deviceId: 'device_orphan', lastSeenAt: daysAgo(400) };
    const { dormant } = partitionDormantDevices([owned, orphan], window);

    // Alone in its own group every device is its own last device, so it stays.
    // The point of the assertion is that it was not judged alongside Anna's.
    assert.deepEqual(dormant, []);
  });

  it('copes with nobody having any devices', () => {
    assert.deepEqual(partitionDormantDevices([], window), { dormant: [], live: [] });
  });
});

describe('the window an operator may set', () => {
  it('takes a sensible number', () => {
    assert.equal(normalizeDormantDeviceRetirementDays(90), 90);
  });

  it('falls back rather than throwing on anything unusable', () => {
    // Read while sending a message. A bad settings value must not be able to
    // stop a company talking to itself.
    for (const bad of [undefined, null, 'ninety', Number.NaN, Infinity, 0, -5, 6, 366, {}]) {
      assert.equal(normalizeDormantDeviceRetirementDays(bad), DEFAULT_DORMANT_DEVICE_RETIREMENT_DAYS);
    }
  });

  it('accepts the bounds themselves', () => {
    assert.equal(normalizeDormantDeviceRetirementDays(7), 7);
    assert.equal(normalizeDormantDeviceRetirementDays(365), 365);
  });

  it('rounds a fractional day down', () => {
    assert.equal(normalizeDormantDeviceRetirementDays(45.9), 45);
  });
});
