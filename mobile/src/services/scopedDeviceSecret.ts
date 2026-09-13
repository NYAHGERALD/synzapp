/**
 * Secrets that belong to an account, held on a handset that may serve several.
 *
 * A phone is not a person. Two people share one during a shift handover, and a
 * leaver's handset is passed on — ordinary practice for the people this is built
 * for. A secret stored under one device-wide name is therefore readable by
 * whoever signs in next, which for a chat key means their messages and for a
 * backup recovery key means their backup.
 *
 * Scoped per account the way the device identity already is, in
 * `deviceIdentity.ts`.
 *
 * Deliberately free of native imports: anything that reaches react-native cannot
 * be tested, so the storage handle is passed in.
 */

/** The few operations this needs from secure storage. */
export type ScopedSecretStore = {
  remove: (storageKey: string) => Promise<void>;
  read: (storageKey: string) => Promise<string | null>;
  write: (storageKey: string, value: string) => Promise<void>;
};

export type ScopedSecretNames = {
  /** The single name used before secrets were scoped. */
  legacyKey: string;
  /** Prefix the account is appended to. */
  prefix: string;
};

export function getScopedSecretStorageKey(names: ScopedSecretNames, ownerUid: string): string {
  const scope = (ownerUid || '').trim().replace(/[^A-Za-z0-9._-]/g, '_');

  return scope ? `${names.prefix}${scope}` : names.legacyKey;
}

/**
 * This account's secret, claiming an unscoped one if that is all there is.
 *
 * A secret written before scoping is taken by whoever reads it first, and the
 * shared copy is then removed. Stranding it would lock somebody out of their own
 * data on the handset they are already holding; leaving it would keep the hole
 * open for the next account. Claiming it does neither, and has the property that
 * a single-account handset — nearly all of them — notices nothing at all.
 */
export async function readScopedSecret(
  store: ScopedSecretStore,
  names: ScopedSecretNames,
  ownerUid: string
): Promise<string | null> {
  const storageKey = getScopedSecretStorageKey(names, ownerUid);
  const storedSecret = await store.read(storageKey);

  if (storedSecret || storageKey === names.legacyKey) {
    return storedSecret;
  }

  const legacySecret = await store.read(names.legacyKey);

  if (!legacySecret) {
    return null;
  }

  await store.write(storageKey, legacySecret);
  await store.remove(names.legacyKey);

  return legacySecret;
}

/**
 * Removes this account's secret, and any unscoped one still lying about.
 *
 * A purge must leave nothing readable behind, and there is no way to tell whose
 * the unscoped secret was — so the safe side is to remove it. Transitional: once
 * every secret has been claimed there is no unscoped one left.
 */
export async function clearScopedSecret(
  store: ScopedSecretStore,
  names: ScopedSecretNames,
  ownerUid: string
): Promise<void> {
  const storageKey = getScopedSecretStorageKey(names, ownerUid);

  await store.remove(storageKey);

  if (storageKey === names.legacyKey) {
    return;
  }

  await store.remove(names.legacyKey);
}
