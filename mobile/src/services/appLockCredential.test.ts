import { describe, expect, it } from 'vitest';
import {
  APP_LOCK_HASH_ROUNDS,
  buildAppLockCredential,
  shouldUpgradeAppLockCredential,
  verifyAppLockPin
} from './appLockCredential';

// A fixed salt and a small round count, so the suite stays fast. The rounds are
// a cost paid on a phone once per unlock, not something to pay per assertion.
const SALT = new Uint8Array(32).fill(7);
const ROUNDS = 64;

describe('storing a PIN', () => {
  it('never stores the PIN itself', () => {
    const record = buildAppLockCredential({ pin: '428371', rounds: ROUNDS, salt: SALT });

    expect(JSON.stringify(record)).not.toContain('428371');
  });

  it('accepts the right PIN', () => {
    const record = buildAppLockCredential({ pin: '428371', rounds: ROUNDS, salt: SALT });

    expect(verifyAppLockPin({ pin: '428371', record })).toBe(true);
  });

  it('refuses a wrong PIN, including one digit out', () => {
    const record = buildAppLockCredential({ pin: '428371', rounds: ROUNDS, salt: SALT });

    expect(verifyAppLockPin({ pin: '428372', record })).toBe(false);
    expect(verifyAppLockPin({ pin: '000000', record })).toBe(false);
    expect(verifyAppLockPin({ pin: '', record })).toBe(false);
  });

  it('gives two people with the same PIN different records', () => {
    // Otherwise one piece of precomputed work covers everybody who chose the
    // same six digits, which is a great many people.
    const first = buildAppLockCredential({ pin: '428371', rounds: ROUNDS, salt: SALT });
    const second = buildAppLockCredential({
      pin: '428371',
      rounds: ROUNDS,
      salt: new Uint8Array(32).fill(9)
    });

    expect(first.verifierBase64).not.toBe(second.verifierBase64);
  });

  it('carries the round count, so it can be raised without locking anybody out', () => {
    const record = buildAppLockCredential({ pin: '428371', rounds: ROUNDS, salt: SALT });

    expect(record.rounds).toBe(ROUNDS);
    expect(verifyAppLockPin({ pin: '428371', record })).toBe(true);
  });

  it('defaults to a round count that costs real time without being felt', () => {
    /**
     * Measured: 20,000 rounds is 48ms on the development machine and 120,000 is
     * 248ms. A phone is several times slower, so the larger figure would have
     * put one to two seconds in front of every cold start — and a lock people
     * turn off protects nothing.
     */
    expect(APP_LOCK_HASH_ROUNDS).toBeGreaterThanOrEqual(20_000);
    expect(APP_LOCK_HASH_ROUNDS).toBeLessThanOrEqual(30_000);
  });
});

describe('refusing a damaged record rather than trusting it', () => {
  it('refuses when the stored values cannot be read', () => {
    const record = buildAppLockCredential({ pin: '428371', rounds: ROUNDS, salt: SALT });

    expect(verifyAppLockPin({ pin: '428371', record: { ...record, saltBase64: '!!!' } })).toBe(false);
    expect(verifyAppLockPin({ pin: '428371', record: { ...record, rounds: 0 } })).toBe(false);
  });
});

describe('raising the cost later', () => {
  it('rebuilds a record made with fewer rounds', () => {
    const record = buildAppLockCredential({ pin: '428371', rounds: ROUNDS, salt: SALT });

    expect(shouldUpgradeAppLockCredential(record)).toBe(true);
  });

  it('never rebuilds one downwards', () => {
    // Rebuilding at a lower count because an old phone found the work slow
    // would quietly weaken every record it touched.
    const record = buildAppLockCredential({
      pin: '428371',
      rounds: APP_LOCK_HASH_ROUNDS + 1,
      salt: SALT
    });

    expect(shouldUpgradeAppLockCredential(record)).toBe(false);
  });
});
