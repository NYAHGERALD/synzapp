import { clearCachedEnvelopePayloads } from './chatEnvelopePayloadCache';
import {
  readVaultedDeviceIdentity,
  writeVaultedDeviceIdentity
} from 'synzapp-device-identity-vault';
import { fromByteArray, toByteArray } from 'base64-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import nacl from 'tweetnacl';
import { getSynzappApiBaseUrl } from './apiConfig';

type DevicePlatform = 'android' | 'ios' | 'unknown' | 'web';

interface StoredDeviceIdentity {
  appInstallationId: string;
  cryptoProvider: 'tweetnacl';
  deviceId: string;
  identityPrivateKey: string;
  identityPublicKey: string;
  keyAgreementPrivateKey: string;
  keyAgreementPublicKey: string;
  keyVersion: number;
  protocolVersion: 'synzapp-device-identity-v1';
  signingPrivateKey: string;
  signingPublicKey: string;
  version: 1;
}

interface PublicDeviceIdentity {
  appInstallationId: string;
  cryptoProvider: StoredDeviceIdentity['cryptoProvider'];
  deviceId: string;
  /** Reported so an organization can learn its own clock. See below. */
  deviceTimeZone?: string;
  identityPublicKey: string;
  keyAgreementPublicKey: string;
  keyVersion: number;
  platform: DevicePlatform;
  protocolVersion: StoredDeviceIdentity['protocolVersion'];
  signingPublicKey: string;
}

export interface RegisteredDeviceIdentity {
  cryptoProvider: string;
  deviceId: string;
  keyVersion: number;
  platform: DevicePlatform;
  protocolVersion: string;
  status: 'ACTIVE';
  tenantId: string;
  uid: string;
}

export interface LocalDeviceKeyMaterial {
  deviceId: string;
  keyAgreementPrivateKey: Uint8Array;
  keyAgreementPublicKey: Uint8Array;
}

const LEGACY_DEVICE_IDENTITY_STORAGE_KEY = 'synzapp.deviceIdentity.v1';
const DEVICE_IDENTITY_STORAGE_KEY_PREFIX = 'synzapp.deviceIdentity.v1.user.';
const DEVICE_IDENTITY_KEYCHAIN_SERVICE = 'synzapp.device.identity.v1';
const DEVICE_IDENTITY_PROTOCOL_VERSION = 'synzapp-device-identity-v1';
const IOS_SHARED_KEYCHAIN_ACCESS_GROUP = 'F9M458TK87.com.synzapp.mobile.shared';
const secureStoreOptions: SecureStore.SecureStoreOptions = {
  ...(Platform.OS === 'ios' ? { accessGroup: IOS_SHARED_KEYCHAIN_ACCESS_GROUP } : {}),
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  keychainService: DEVICE_IDENTITY_KEYCHAIN_SERVICE
};
const legacySecureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: DEVICE_IDENTITY_KEYCHAIN_SERVICE
};

let isNaclPrngConfigured = false;
const registeredDeviceIdentityPromises = new Map<string, Promise<RegisteredDeviceIdentity>>();

export async function ensureRegisteredDeviceIdentity(idToken: string): Promise<RegisteredDeviceIdentity> {
  const storageKey = getDeviceIdentityStorageKeyForToken(idToken);
  const existingPromise = registeredDeviceIdentityPromises.get(storageKey);

  if (existingPromise) {
    return existingPromise;
  }

  const nextPromise = registerDeviceIdentity(idToken, storageKey).catch((error) => {
    registeredDeviceIdentityPromises.delete(storageKey);
    throw error;
  });
  registeredDeviceIdentityPromises.set(storageKey, nextPromise);

  return nextPromise;
}

export async function getRegisteredDeviceHeaders(idToken: string): Promise<Record<string, string>> {
  const device = await ensureRegisteredDeviceIdentity(idToken);

  return {
    'X-Synzapp-Device-Id': device.deviceId
  };
}

export async function getLocalDeviceHeaders(idToken?: string): Promise<Record<string, string>> {
  const device = await ensureLocalDeviceIdentity(
    idToken ? getDeviceIdentityStorageKeyForToken(idToken) : LEGACY_DEVICE_IDENTITY_STORAGE_KEY
  );

  return {
    'X-Synzapp-Device-Id': device.deviceId
  };
}

export async function getRegisteredDeviceId(idToken: string): Promise<string> {
  const device = await ensureRegisteredDeviceIdentity(idToken);

  return device.deviceId;
}

export async function getLocalDeviceKeyMaterial(idToken: string): Promise<LocalDeviceKeyMaterial> {
  const storageKey = getDeviceIdentityStorageKeyForToken(idToken);
  const [registeredDevice, localIdentity] = await Promise.all([
    ensureRegisteredDeviceIdentity(idToken),
    ensureLocalDeviceIdentity(storageKey)
  ]);

  return {
    deviceId: registeredDevice.deviceId,
    keyAgreementPrivateKey: toByteArray(localIdentity.keyAgreementPrivateKey),
    keyAgreementPublicKey: toByteArray(localIdentity.keyAgreementPublicKey)
  };
}

export function clearRegisteredDeviceIdentityCache(): void {
  registeredDeviceIdentityPromises.clear();
  // Decrypted message payloads are plaintext held in memory; they must not
  // survive into another account's session on this device.
  clearCachedEnvelopePayloads();
}

export async function clearRegisteredDeviceIdentity(input?: { ownerUid?: string }): Promise<void> {
  registeredDeviceIdentityPromises.clear();
  const storageKeys = input?.ownerUid
    ? [getDeviceIdentityStorageKeyForUid(input.ownerUid), LEGACY_DEVICE_IDENTITY_STORAGE_KEY]
    : [LEGACY_DEVICE_IDENTITY_STORAGE_KEY];
  await Promise.all([...new Set(storageKeys)].map((storageKey) => clearStoredDeviceIdentity(storageKey)));
}

async function clearStoredDeviceIdentity(storageKey: string): Promise<void> {
  const secureStoreAvailable = await SecureStore.isAvailableAsync();

  if (!secureStoreAvailable) {
    return;
  }

  await Promise.all([
    SecureStore.deleteItemAsync(storageKey, secureStoreOptions).catch(() => undefined),
    SecureStore.deleteItemAsync(storageKey, legacySecureStoreOptions).catch(() => undefined)
  ]);
}

async function registerDeviceIdentity(
  idToken: string,
  storageKey: string
): Promise<RegisteredDeviceIdentity> {
  const identity = await ensureLocalDeviceIdentity(storageKey);
  try {
    return await submitDeviceIdentityRegistration(idToken, identity);
  } catch (error) {
    if (!isDeviceIdentityAlreadyRegisteredError(error)) {
      throw error;
    }

    const nextIdentity = await rotateLocalDeviceIdentity(storageKey);

    return submitDeviceIdentityRegistration(idToken, nextIdentity);
  }
}

async function submitDeviceIdentityRegistration(
  idToken: string,
  identity: StoredDeviceIdentity
): Promise<RegisteredDeviceIdentity> {
  const publicIdentity = getPublicDeviceIdentity(identity);
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/profile/me/devices`, {
    body: JSON.stringify(publicIdentity),
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    },
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  const body = await response.json() as { device: RegisteredDeviceIdentity };

  return body.device;
}

async function rotateLocalDeviceIdentity(storageKey: string): Promise<StoredDeviceIdentity> {
  await clearStoredDeviceIdentity(storageKey);

  return ensureLocalDeviceIdentity(storageKey, { allowLegacyMigration: false });
}

async function ensureLocalDeviceIdentity(
  storageKey: string,
  options: { allowLegacyMigration?: boolean } = {}
): Promise<StoredDeviceIdentity> {
  const secureStoreAvailable = await SecureStore.isAvailableAsync();

  if (!secureStoreAvailable) {
    throw new Error('Secure device storage is not available.');
  }

  const existingIdentity = await readStoredDeviceIdentity(storageKey);

  if (existingIdentity) {
    // Put into the vault if it is not there yet. Identities made before the
    // vault existed live only in secure storage, which an uninstall takes with
    // it — so without this the very install that needs saving is the one that
    // was never saved, and the fix would appear not to work at all.
    void backfillVaultedDeviceIdentity(storageKey, existingIdentity);

    return existingIdentity;
  }

  const shouldTryLegacyMigration = storageKey !== LEGACY_DEVICE_IDENTITY_STORAGE_KEY &&
    options.allowLegacyMigration !== false;
  const legacyIdentity = shouldTryLegacyMigration
    ? await readStoredDeviceIdentity(LEGACY_DEVICE_IDENTITY_STORAGE_KEY)
    : null;

  if (legacyIdentity) {
    await writeStoredDeviceIdentity(storageKey, legacyIdentity);

    return legacyIdentity;
  }

  // Before a new identity is minted, the one this phone had before the app was
  // uninstalled. Everything a person can read is sealed to that key, so coming
  // back with a fresh one means the same person on the same handset cannot open
  // their own conversation — which is what happened, repeatedly, and is not
  // something a backup should have to repair.
  const vaultedIdentity = await readVaultedIdentity(storageKey);

  if (vaultedIdentity) {
    await writeStoredDeviceIdentity(storageKey, vaultedIdentity);

    return vaultedIdentity;
  }

  configureNaclRandomness();

  const identityKeyPair = nacl.box.keyPair();
  const keyAgreementKeyPair = nacl.box.keyPair();
  const signingKeyPair = nacl.sign.keyPair();
  const nextIdentity: StoredDeviceIdentity = {
    appInstallationId: `install_${randomHex(16)}`,
    cryptoProvider: 'tweetnacl',
    deviceId: `device_${randomHex(16)}`,
    identityPrivateKey: encodeBytes(identityKeyPair.secretKey),
    identityPublicKey: encodeBytes(identityKeyPair.publicKey),
    keyAgreementPrivateKey: encodeBytes(keyAgreementKeyPair.secretKey),
    keyAgreementPublicKey: encodeBytes(keyAgreementKeyPair.publicKey),
    keyVersion: 1,
    protocolVersion: DEVICE_IDENTITY_PROTOCOL_VERSION,
    signingPrivateKey: encodeBytes(signingKeyPair.secretKey),
    signingPublicKey: encodeBytes(signingKeyPair.publicKey),
    version: 1
  };

  await writeStoredDeviceIdentity(storageKey, nextIdentity);

  return nextIdentity;
}

async function readStoredDeviceIdentity(storageKey: string): Promise<StoredDeviceIdentity | null> {
  const storedValue = await SecureStore.getItemAsync(storageKey, secureStoreOptions);
  const parsedIdentity = parseStoredDeviceIdentity(storedValue);

  if (parsedIdentity) {
    return parsedIdentity;
  }

  const legacyStoredValue = await SecureStore.getItemAsync(storageKey, legacySecureStoreOptions);
  const legacyIdentity = parseStoredDeviceIdentity(legacyStoredValue);

  if (legacyIdentity) {
    await writeStoredDeviceIdentity(storageKey, legacyIdentity);

    return legacyIdentity;
  }

  return null;
}

async function writeStoredDeviceIdentity(
  storageKey: string,
  identity: StoredDeviceIdentity
): Promise<void> {
  const serialized = JSON.stringify(identity);

  await SecureStore.setItemAsync(storageKey, serialized, secureStoreOptions);

  // Kept where an uninstall cannot reach, so the next install is the same
  // device rather than a stranger. Best effort: it is unavailable on iOS, where
  // the keychain already outlives the app, and on Android phones with backup
  // switched off. Failing to keep it must never fail signing in.
  await writeVaultedDeviceIdentity(vaultKeyFor(storageKey), serialized).catch(() => false);
}

/**
 * Puts an already-stored identity into the vault, once.
 *
 * Deliberately not awaited. Nothing about signing in should wait on it, and a
 * phone that cannot keep it — no Play services, backup switched off — must
 * carry on exactly as before.
 */
async function backfillVaultedDeviceIdentity(
  storageKey: string,
  identity: StoredDeviceIdentity
): Promise<void> {
  try {
    const vaultKey = vaultKeyFor(storageKey);

    if (await readVaultedDeviceIdentity(vaultKey)) {
      return;
    }

    await writeVaultedDeviceIdentity(vaultKey, JSON.stringify(identity));
  } catch {
    // Best effort, always.
  }
}

/**
 * The identity this phone had before the app was removed, if it can be had.
 *
 * Read only when there is nothing in secure storage — that is, on a fresh
 * install — and validated exactly like a stored one, because it comes back from
 * outside the app and being unreadable is an ordinary outcome rather than a
 * fault.
 */
async function readVaultedIdentity(storageKey: string): Promise<StoredDeviceIdentity | null> {
  const vaulted = await readVaultedDeviceIdentity(vaultKeyFor(storageKey)).catch(() => null);

  return parseStoredDeviceIdentity(vaulted);
}

/**
 * Block Store keys allow only letters, digits and a few marks, so the account
 * scoped storage key is flattened rather than passed through.
 */
function vaultKeyFor(storageKey: string): string {
  return storageKey.replace(/[^A-Za-z0-9._-]/g, '_');
}

function parseStoredDeviceIdentity(storedValue: string | null): StoredDeviceIdentity | null {
  if (!storedValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(storedValue) as unknown;

    if (isStoredDeviceIdentity(parsedValue)) {
      return parsedValue;
    }
  } catch {
    return null;
  }

  return null;
}

function getPublicDeviceIdentity(identity: StoredDeviceIdentity): PublicDeviceIdentity {
  return {
    appInstallationId: identity.appInstallationId,
    cryptoProvider: identity.cryptoProvider,
    // Sent so an organization that has never had one takes its time zone from
    // an administrator's phone. Nothing here depends on it, and the server
    // ignores it for everybody else.
    deviceTimeZone: readDeviceTimeZone(),
    deviceId: identity.deviceId,
    identityPublicKey: identity.identityPublicKey,
    keyAgreementPublicKey: identity.keyAgreementPublicKey,
    keyVersion: identity.keyVersion,
    platform: getDevicePlatform(),
    protocolVersion: identity.protocolVersion,
    signingPublicKey: identity.signingPublicKey
  };
}

function configureNaclRandomness() {
  if (isNaclPrngConfigured) {
    return;
  }

  nacl.setPRNG((target, size) => {
    const randomBytes = Crypto.getRandomBytes(size);

    for (let index = 0; index < size; index += 1) {
      target[index] = randomBytes[index] || 0;
    }
  });
  isNaclPrngConfigured = true;
}

function readDeviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

function getDevicePlatform(): DevicePlatform {
  if (Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web') {
    return Platform.OS;
  }

  return 'unknown';
}

function getDeviceIdentityStorageKeyForToken(idToken: string): string {
  const uid = getUidFromIdToken(idToken);

  return uid ? getDeviceIdentityStorageKeyForUid(uid) : LEGACY_DEVICE_IDENTITY_STORAGE_KEY;
}

function getDeviceIdentityStorageKeyForUid(uid: string): string {
  return `${DEVICE_IDENTITY_STORAGE_KEY_PREFIX}${sanitizeSecureStoreKeyScope(uid)}`;
}

function getUidFromIdToken(idToken: string): string | null {
  const payloadSegment = idToken.split('.')[1];

  if (!payloadSegment) {
    return null;
  }

  try {
    const normalizedPayload = payloadSegment
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      Math.ceil(normalizedPayload.length / 4) * 4,
      '='
    );
    const payloadBytes = toByteArray(paddedPayload);
    const payload = JSON.parse(decodeUtf8Bytes(payloadBytes)) as Record<string, unknown>;
    const uid = typeof payload.user_id === 'string'
      ? payload.user_id
      : typeof payload.sub === 'string'
        ? payload.sub
        : null;

    return uid?.trim() || null;
  } catch {
    return null;
  }
}

function decodeUtf8Bytes(bytes: Uint8Array): string {
  let encodedValue = '';

  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index] ?? 0;
    encodedValue += `%${byte.toString(16).padStart(2, '0')}`;
  }

  return decodeURIComponent(encodedValue);
}

function sanitizeSecureStoreKeyScope(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '_');
}

function encodeBytes(bytes: Uint8Array): string {
  return fromByteArray(bytes);
}

function randomHex(byteCount: number): string {
  return Array.from(Crypto.getRandomBytes(byteCount))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function isDeviceIdentityAlreadyRegisteredError(error: unknown): boolean {
  return error instanceof Error &&
    /device identity is already registered/i.test(error.message);
}

function isStoredDeviceIdentity(value: unknown): value is StoredDeviceIdentity {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;

  return record.version === 1 &&
    record.cryptoProvider === 'tweetnacl' &&
    record.protocolVersion === DEVICE_IDENTITY_PROTOCOL_VERSION &&
    typeof record.appInstallationId === 'string' &&
    typeof record.deviceId === 'string' &&
    typeof record.identityPrivateKey === 'string' &&
    typeof record.identityPublicKey === 'string' &&
    typeof record.keyAgreementPrivateKey === 'string' &&
    typeof record.keyAgreementPublicKey === 'string' &&
    typeof record.keyVersion === 'number' &&
    typeof record.signingPrivateKey === 'string' &&
    typeof record.signingPublicKey === 'string';
}

async function getResponseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();

    if (typeof body?.error === 'string') {
      return body.error;
    }
  } catch {
    return 'Unable to register this device.';
  }

  return 'Unable to register this device.';
}
