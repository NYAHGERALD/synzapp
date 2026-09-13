/**
 * Which account a stored chat-backup recovery key belongs to.
 *
 * The recovery key opens somebody's chat backup. It is a credential, not a
 * cache, and it used to be stored under one device-wide name — so the second
 * person to sign in on a shared handset held the key to the first person's
 * backup. Shift handover on a shared phone is ordinary working practice for the
 * people this is built for.
 *
 * Scoped per account the way the device identity already is, in
 * `deviceIdentity.ts`. The old name survives only long enough to move an
 * existing key across once.
 *
 * Kept apart from `chatBackup.ts` because that module reaches native code, and
 * anything importing react-native cannot be tested. The storage handle is passed
 * in for the same reason.
 */

export const LEGACY_CHAT_BACKUP_RECOVERY_KEY_STORAGE_KEY = 'synzapp.chatBackupRecoveryKey.v1';

const CHAT_BACKUP_RECOVERY_KEY_STORAGE_KEY_PREFIX = 'synzapp.chatBackupRecoveryKey.v1.user.';

/** The few operations this needs from secure storage, so tests need no native code. */
export type RecoveryKeyStore = {
  remove: (storageKey: string) => Promise<void>;
  read: (storageKey: string) => Promise<string | null>;
  write: (storageKey: string, value: string) => Promise<void>;
};

export function getChatBackupRecoveryKeyStorageKey(ownerUid: string): string {
  const scope = (ownerUid || '').trim().replace(/[^A-Za-z0-9._-]/g, '_');

  return scope
    ? `${CHAT_BACKUP_RECOVERY_KEY_STORAGE_KEY_PREFIX}${scope}`
    : LEGACY_CHAT_BACKUP_RECOVERY_KEY_STORAGE_KEY;
}

/**
 * This account's recovery key, claiming an unscoped one if that is all there is.
 *
 * A key written before scoping is taken by whoever reads it first, and the
 * shared copy is then removed. Stranding it would leave somebody unable to
 * restore a backup they already have; leaving it would keep the hole open for
 * the next account on the handset. Claiming it is the only option that does
 * neither — and a key on its own opens nothing, because the backup it belongs to
 * is fetched per account from the server.
 */
export async function readScopedRecoveryKey(
  store: RecoveryKeyStore,
  ownerUid: string
): Promise<string | null> {
  const storageKey = getChatBackupRecoveryKeyStorageKey(ownerUid);
  const storedRecoveryKey = await store.read(storageKey);

  if (storedRecoveryKey || storageKey === LEGACY_CHAT_BACKUP_RECOVERY_KEY_STORAGE_KEY) {
    return storedRecoveryKey;
  }

  const legacyRecoveryKey = await store.read(LEGACY_CHAT_BACKUP_RECOVERY_KEY_STORAGE_KEY);

  if (!legacyRecoveryKey) {
    return null;
  }

  await store.write(storageKey, legacyRecoveryKey);
  await store.remove(LEGACY_CHAT_BACKUP_RECOVERY_KEY_STORAGE_KEY);

  return legacyRecoveryKey;
}

/**
 * Removes this account's key, and any unscoped one still lying about.
 *
 * A purge must leave nothing readable behind, and there is no way to tell whose
 * the unscoped key was — so the safe side is to remove it. Transitional: once
 * every key has been claimed there is no unscoped one left to remove.
 */
export async function clearScopedRecoveryKey(
  store: RecoveryKeyStore,
  ownerUid: string
): Promise<void> {
  const storageKey = getChatBackupRecoveryKeyStorageKey(ownerUid);

  await store.remove(storageKey);

  if (storageKey === LEGACY_CHAT_BACKUP_RECOVERY_KEY_STORAGE_KEY) {
    return;
  }

  await store.remove(LEGACY_CHAT_BACKUP_RECOVERY_KEY_STORAGE_KEY);
}
