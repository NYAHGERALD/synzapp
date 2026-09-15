import { fromByteArray, toByteArray } from 'base64-js';
import nacl from 'tweetnacl';

/**
 * Turning a six digit PIN into something worth storing.
 *
 * The PIN itself is never written anywhere. What is stored is a salted digest,
 * and checking a PIN means repeating the work and comparing.
 *
 * **Why the work is repeated so many times.** A six digit PIN is a million
 * possibilities. A single hash of one is checked in microseconds, so a stored
 * digest with a single round protects nothing from anybody who reaches it. The
 * cost per guess is the whole defence, so it is paid deliberately: one unlock
 * costs a fraction of a second, and a million guesses cost days.
 *
 * `expo-crypto` is not used for this. Its digest is a native call, and a native
 * call per round would spend the entire budget on crossing the bridge rather
 * than on the hashing that makes guessing expensive. `nacl.hash` runs in
 * process, over sixty-four bytes — nowhere near the media-sized payloads the
 * house rule about JavaScript crypto is about.
 *
 * No native import, so the whole thing is testable.
 */

/**
 * Rounds of hashing per check.
 *
 * Measured rather than guessed: 120,000 rounds took 248ms on the development
 * machine and 20,000 took 48ms. A phone running Hermes is several times slower
 * than that, so 120,000 would have meant one to two and a half seconds on every
 * cold start and every return from the background — long enough that people turn
 * the lock off, and a lock nobody has on protects nothing.
 *
 * 20,000 lands near half a second on a mid-range handset while still costing an
 * attacker roughly half a day of continuous work per million guesses on the same
 * hardware. That is not the main defence and is not pretended to be: the lockout
 * and the wipe in `appLockPolicy` are. This only raises the floor for somebody
 * who has extracted the stored record.
 *
 * Raising it later is safe. Every record carries the count it was made with, so
 * old PINs keep working and `shouldUpgradeAppLockCredential` rebuilds them on
 * the next successful unlock.
 */
export const APP_LOCK_HASH_ROUNDS = 20_000;

/** Bytes of salt. Enough that no two records share precomputed work. */
export const APP_LOCK_SALT_BYTES = 32;

export interface AppLockCredentialRecord {
  /** Carried on the record so the count can be raised later without locking anybody out. */
  rounds: number;
  saltBase64: string;
  verifierBase64: string;
  version: 1;
}

/**
 * Builds the record to store for a PIN.
 *
 * The salt has to come from the caller, because randomness belongs to the
 * platform and a module that reaches for it cannot be tested.
 */
export function buildAppLockCredential(input: {
  pin: string;
  rounds?: number;
  salt: Uint8Array;
}): AppLockCredentialRecord {
  const rounds = input.rounds ?? APP_LOCK_HASH_ROUNDS;

  return {
    rounds,
    saltBase64: fromByteArray(input.salt),
    verifierBase64: fromByteArray(deriveVerifier(input.pin, input.salt, rounds)),
    version: 1
  };
}

/**
 * Whether this PIN matches the stored record.
 *
 * The comparison is constant time. A byte-at-a-time comparison that stops at
 * the first difference leaks how much of a guess was right, and with only a
 * million candidates that is enough to walk to the answer.
 */
export function verifyAppLockPin(input: {
  pin: string;
  record: AppLockCredentialRecord;
}): boolean {
  const salt = safeDecode(input.record.saltBase64);
  const expected = safeDecode(input.record.verifierBase64);

  if (!salt || !expected || !Number.isFinite(input.record.rounds) || input.record.rounds < 1) {
    return false;
  }

  return equalInConstantTime(deriveVerifier(input.pin, salt, input.record.rounds), expected);
}

/**
 * Whether a stored record should be rebuilt next time the PIN is entered.
 *
 * Only ever on the way up. Rebuilding at a lower count because an old phone
 * found the work slow would quietly weaken every record it touched.
 */
export function shouldUpgradeAppLockCredential(record: AppLockCredentialRecord): boolean {
  return record.rounds < APP_LOCK_HASH_ROUNDS;
}

function deriveVerifier(pin: string, salt: Uint8Array, rounds: number): Uint8Array {
  const pinBytes = new TextEncoder().encode(pin);
  let digest = nacl.hash(concat(salt, pinBytes));

  for (let round = 1; round < rounds; round += 1) {
    digest = nacl.hash(digest);
  }

  return digest.slice(0, 32);
}

function concat(first: Uint8Array, second: Uint8Array): Uint8Array {
  const combined = new Uint8Array(first.length + second.length);

  combined.set(first, 0);
  combined.set(second, first.length);

  return combined;
}

function equalInConstantTime(first: Uint8Array, second: Uint8Array): boolean {
  if (first.length !== second.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < first.length; index += 1) {
    difference |= first[index] ^ second[index];
  }

  return difference === 0;
}

function safeDecode(value: string): Uint8Array | null {
  try {
    return toByteArray(value);
  } catch {
    return null;
  }
}
