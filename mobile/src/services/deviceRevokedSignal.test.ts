import { describe, expect, it, vi } from 'vitest';

vi.mock('./companyDataManifest', () => ({
  blockCompanyDataScope: vi.fn(async () => {}),
  isCompanyDataScopeBlocked: vi.fn(async () => false)
}));

vi.mock('./companyDataGovernance', () => ({
  purgeTenantCompanyData: vi.fn(async () => ({ errors: [] }))
}));

vi.mock('./backendAuth', () => ({
  ACCESS_DENIED_MESSAGE: 'Access denied.'
}));

import {
  DEVICE_REVOKED_CODE,
  isCompanyAccessDeniedError,
  isCompanyAccessDeniedMessage,
  isDeviceRevokedError
} from './companyDataAccessGuard';

/** The exact wording the backend sends when a handset is signed out of chat. */
const REVOKED_MESSAGE = 'This device was signed out of chat.';
const OLD_REVOKED_MESSAGE = 'This device is not authorized.';

describe('recognising a handset that has been signed out of chat', () => {
  it('recognises it by code', () => {
    const error = Object.assign(new Error(REVOKED_MESSAGE), { code: DEVICE_REVOKED_CODE });

    expect(isDeviceRevokedError(error)).toBe(true);
    expect(isCompanyAccessDeniedError(error)).toBe(true);
  });

  it('pins why the wording check could never have caught it', () => {
    // The shipped bug: the app decided a session was dead by matching words, and
    // the backend's message contained none of them. So a revoked handset failed
    // every request, showed a generic error, and never wiped — while the console
    // reported the wipe as done.
    expect(isCompanyAccessDeniedMessage(OLD_REVOKED_MESSAGE)).toBe(false);
  });

  it('does not treat an ordinary failure as a revocation', () => {
    expect(isDeviceRevokedError(new Error('Network request failed'))).toBe(false);
    expect(isCompanyAccessDeniedError(new Error('Network request failed'))).toBe(false);
  });

  it('does not mistake another code for this one', () => {
    const heldSeat = Object.assign(new Error('Chat is signed in on another phone.'), {
      code: 'MOBILE_SEAT_HELD'
    });

    // Being asked to confirm a move is not the same as having been signed out,
    // and must never trigger a wipe.
    expect(isDeviceRevokedError(heldSeat)).toBe(false);
  });

  it('still recognises the older wordings it always did', () => {
    expect(isCompanyAccessDeniedError(new Error('Your access was revoked.'))).toBe(true);
    expect(isCompanyAccessDeniedError(new Error('This account is suspended.'))).toBe(true);
  });
});
