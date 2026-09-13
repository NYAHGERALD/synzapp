import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearScopedRecoveryKey,
  getChatBackupRecoveryKeyStorageKey,
  LEGACY_CHAT_BACKUP_RECOVERY_KEY_STORAGE_KEY,
  readScopedRecoveryKey,
  type RecoveryKeyStore
} from './chatBackupRecoveryKeyScope';

const ALICE = 'uid-alice';
const BOB = 'uid-bob';

let values: Map<string, string>;
let store: RecoveryKeyStore;

beforeEach(() => {
  values = new Map();
  store = {
    read: async (key) => values.get(key) ?? null,
    remove: async (key) => {
      values.delete(key);
    },
    write: async (key, value) => {
      values.set(key, value);
    }
  };
});

describe('chat backup recovery key scope', () => {
  it('gives two accounts different names', () => {
    expect(getChatBackupRecoveryKeyStorageKey(ALICE))
      .not.toBe(getChatBackupRecoveryKeyStorageKey(BOB));
  });

  it('keeps a name safe for secure storage', () => {
    expect(getChatBackupRecoveryKeyStorageKey('uid with spaces/and:punctuation'))
      .toBe('synzapp.chatBackupRecoveryKey.v1.user.uid_with_spaces_and_punctuation');
  });

  it('falls back to the old name when there is no account to scope to', () => {
    expect(getChatBackupRecoveryKeyStorageKey('   '))
      .toBe(LEGACY_CHAT_BACKUP_RECOVERY_KEY_STORAGE_KEY);
  });

  it('keeps two accounts on one handset apart', async () => {
    // The hole this closes: one device-wide name meant the second person to sign
    // in held the key to the first person's backup.
    await store.write(getChatBackupRecoveryKeyStorageKey(ALICE), 'alice-key');
    await store.write(getChatBackupRecoveryKeyStorageKey(BOB), 'bob-key');

    expect(await readScopedRecoveryKey(store, ALICE)).toBe('alice-key');
    expect(await readScopedRecoveryKey(store, BOB)).toBe('bob-key');
  });

  it('claims a key written before scoping, and removes the shared copy', async () => {
    values.set(LEGACY_CHAT_BACKUP_RECOVERY_KEY_STORAGE_KEY, 'older-key');

    expect(await readScopedRecoveryKey(store, ALICE)).toBe('older-key');
    expect(values.has(LEGACY_CHAT_BACKUP_RECOVERY_KEY_STORAGE_KEY)).toBe(false);
    expect(await readScopedRecoveryKey(store, ALICE)).toBe('older-key');
  });

  it('gives the second account nothing once the shared key is claimed', async () => {
    values.set(LEGACY_CHAT_BACKUP_RECOVERY_KEY_STORAGE_KEY, 'older-key');

    await readScopedRecoveryKey(store, ALICE);

    expect(await readScopedRecoveryKey(store, BOB)).toBeNull();
  });

  it('purging one account leaves the other its key', async () => {
    await store.write(getChatBackupRecoveryKeyStorageKey(ALICE), 'alice-key');
    await store.write(getChatBackupRecoveryKeyStorageKey(BOB), 'bob-key');

    await clearScopedRecoveryKey(store, ALICE);

    expect(await readScopedRecoveryKey(store, ALICE)).toBeNull();
    expect(await readScopedRecoveryKey(store, BOB)).toBe('bob-key');
  });

  it('purging also removes a shared key left over from before scoping', async () => {
    // A purge must leave nothing readable behind, and there is no way to tell
    // whose the unscoped key was.
    values.set(LEGACY_CHAT_BACKUP_RECOVERY_KEY_STORAGE_KEY, 'older-key');

    await clearScopedRecoveryKey(store, BOB);

    expect(values.has(LEGACY_CHAT_BACKUP_RECOVERY_KEY_STORAGE_KEY)).toBe(false);
  });
});
