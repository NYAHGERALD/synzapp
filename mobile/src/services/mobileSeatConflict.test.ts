import { describe, expect, it } from 'vitest';

import {
  describeHeldMobileSeatNotice,
  describeMobileSeatHolder,
  isMobileSeatHeldError,
  readMobileSeatHeldError
} from './mobileSeatConflict';

const NOW = Date.parse('2026-09-13T12:00:00.000Z');

describe('reading the seat conflict', () => {
  it('recognises the refusal a person can answer', () => {
    const error = readMobileSeatHeldError({
      body: {
        code: 'MOBILE_SEAT_HELD',
        details: { claimedAt: '2026-09-13T11:30:00.000Z', deviceId: 'device_a', platform: 'ios' },
        error: 'Chat is signed in on another phone.'
      },
      status: 409
    });

    expect(error).not.toBeNull();
    expect(isMobileSeatHeldError(error)).toBe(true);
    expect(error?.seat.deviceId).toBe('device_a');
  });

  it('ignores a conflict that is about something else', () => {
    // A 409 without the code must never become a question about signing a phone
    // out — that is how the wrong prompt gets shown for an unrelated failure.
    expect(readMobileSeatHeldError({
      body: { error: 'This device identity is already registered.' },
      status: 409
    })).toBeNull();
  });

  it('ignores every other status', () => {
    expect(readMobileSeatHeldError({
      body: { code: 'MOBILE_SEAT_HELD' },
      status: 403
    })).toBeNull();
  });

  it('copes with a body that carries no details', () => {
    const error = readMobileSeatHeldError({ body: { code: 'MOBILE_SEAT_HELD' }, status: 409 });

    expect(error?.seat).toEqual({ claimedAt: null, deviceId: null, platform: null });
    expect(error?.message).toBe('Chat is signed in on another phone.');
  });

  it('does not mistake an ordinary error for this one', () => {
    expect(isMobileSeatHeldError(new Error('Network request failed'))).toBe(false);
    expect(isMobileSeatHeldError(null)).toBe(false);
  });
});

describe('describing the phone that holds chat', () => {
  it('names the platform and how long ago', () => {
    expect(describeMobileSeatHolder(
      { claimedAt: '2026-09-13T11:30:00.000Z', deviceId: 'd', platform: 'ios' },
      NOW
    )).toBe('An iPhone, signed in 30 minutes ago');
  });

  it('reads in hours and days once it is older', () => {
    expect(describeMobileSeatHolder(
      { claimedAt: '2026-09-13T09:00:00.000Z', deviceId: 'd', platform: 'android' },
      NOW
    )).toBe('An Android phone, signed in 3 hours ago');
    expect(describeMobileSeatHolder(
      { claimedAt: '2026-09-10T12:00:00.000Z', deviceId: 'd', platform: 'android' },
      NOW
    )).toBe('An Android phone, signed in 3 days ago');
  });

  it('says just now rather than zero minutes', () => {
    expect(describeMobileSeatHolder(
      { claimedAt: '2026-09-13T11:59:40.000Z', deviceId: 'd', platform: 'ios' },
      NOW
    )).toBe('An iPhone, signed in just now');
  });

  it('claims nothing it cannot support', () => {
    // No platform and no date: say the least that is still true, rather than
    // guessing at a handset the person might recognise.
    expect(describeMobileSeatHolder(
      { claimedAt: null, deviceId: null, platform: null },
      NOW
    )).toBe('Another phone');
  });

  it('ignores a date it cannot read', () => {
    expect(describeMobileSeatHolder(
      { claimedAt: 'not a date', deviceId: 'd', platform: 'ios' },
      NOW
    )).toBe('An iPhone');
  });
});

describe('the notice left behind after saying not now', () => {
  it('names the phone that has chat and offers the way back', () => {
    const notice = describeHeldMobileSeatNotice(
      { claimedAt: '2026-09-13T11:00:00.000Z', deviceId: 'd', platform: 'android' },
      NOW
    );

    expect(notice.title).toBe('Chat is on your other phone');
    expect(notice.body).toBe(
      'An Android phone, signed in 1 hour ago has it. Everything else on your account still works.'
    );
    expect(notice.action).toBe('Move chat here');
  });

  it('says the rest of the account still works, whatever it knows about the phone', () => {
    // The reassurance is the point of the notice: somebody who declines is
    // signed in and staying signed in. It cannot depend on details the server
    // may not have sent.
    const notice = describeHeldMobileSeatNotice(
      { claimedAt: null, deviceId: null, platform: null },
      NOW
    );

    expect(notice.body).toBe('Another phone has it. Everything else on your account still works.');
    expect(notice.action).toBe('Move chat here');
  });
});
