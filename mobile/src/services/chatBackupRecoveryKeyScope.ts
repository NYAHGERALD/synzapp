/**
 * Where a chat-backup recovery key lives, per account.
 *
 * The recovery key opens somebody's chat backup. It is a credential, not a
 * cache, and it was stored under one device-wide name — so the second person to
 * sign in on a shared handset held the key to the first person's backup.
 *
 * The scoping itself is in `scopedDeviceSecret.ts`, shared with the local chat
 * key so one tested implementation covers both.
 */
import {
  clearScopedSecret,
  getScopedSecretStorageKey,
  readScopedSecret,
  type ScopedSecretNames,
  type ScopedSecretStore
} from './scopedDeviceSecret';

export type RecoveryKeyStore = ScopedSecretStore;

export const LEGACY_CHAT_BACKUP_RECOVERY_KEY_STORAGE_KEY = 'synzapp.chatBackupRecoveryKey.v1';

const CHAT_BACKUP_RECOVERY_KEY_NAMES: ScopedSecretNames = {
  legacyKey: LEGACY_CHAT_BACKUP_RECOVERY_KEY_STORAGE_KEY,
  prefix: 'synzapp.chatBackupRecoveryKey.v1.user.'
};

export function getChatBackupRecoveryKeyStorageKey(ownerUid: string): string {
  return getScopedSecretStorageKey(CHAT_BACKUP_RECOVERY_KEY_NAMES, ownerUid);
}

export function readScopedRecoveryKey(
  store: RecoveryKeyStore,
  ownerUid: string
): Promise<string | null> {
  return readScopedSecret(store, CHAT_BACKUP_RECOVERY_KEY_NAMES, ownerUid);
}

export function clearScopedRecoveryKey(
  store: RecoveryKeyStore,
  ownerUid: string
): Promise<void> {
  return clearScopedSecret(store, CHAT_BACKUP_RECOVERY_KEY_NAMES, ownerUid);
}
