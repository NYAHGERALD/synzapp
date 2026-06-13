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

const DEVICE_IDENTITY_STORAGE_KEY = 'synzapp.deviceIdentity.v1';
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
let registeredDeviceIdentityPromise: Promise<RegisteredDeviceIdentity> | null = null;

export async function ensureRegisteredDeviceIdentity(idToken: string): Promise<RegisteredDeviceIdentity> {
  if (registeredDeviceIdentityPromise) {
    return registeredDeviceIdentityPromise;
  }

  registeredDeviceIdentityPromise = registerDeviceIdentity(idToken).catch((error) => {
    registeredDeviceIdentityPromise = null;
    throw error;
  });

  return registeredDeviceIdentityPromise;
}

export async function getRegisteredDeviceHeaders(idToken: string): Promise<Record<string, string>> {
  const device = await ensureRegisteredDeviceIdentity(idToken);

  return {
    'X-Synzapp-Device-Id': device.deviceId
  };
}

export async function getRegisteredDeviceId(idToken: string): Promise<string> {
  const device = await ensureRegisteredDeviceIdentity(idToken);

  return device.deviceId;
}

export async function getLocalDeviceKeyMaterial(idToken: string): Promise<LocalDeviceKeyMaterial> {
  const [registeredDevice, localIdentity] = await Promise.all([
    ensureRegisteredDeviceIdentity(idToken),
    ensureLocalDeviceIdentity()
  ]);

  return {
    deviceId: registeredDevice.deviceId,
    keyAgreementPrivateKey: toByteArray(localIdentity.keyAgreementPrivateKey),
    keyAgreementPublicKey: toByteArray(localIdentity.keyAgreementPublicKey)
  };
}

export function clearRegisteredDeviceIdentityCache(): void {
  registeredDeviceIdentityPromise = null;
}

async function registerDeviceIdentity(idToken: string): Promise<RegisteredDeviceIdentity> {
  const identity = await ensureLocalDeviceIdentity();
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

async function ensureLocalDeviceIdentity(): Promise<StoredDeviceIdentity> {
  const secureStoreAvailable = await SecureStore.isAvailableAsync();

  if (!secureStoreAvailable) {
    throw new Error('Secure device storage is not available.');
  }

  const existingIdentity = await readStoredDeviceIdentity();

  if (existingIdentity) {
    return existingIdentity;
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

  await SecureStore.setItemAsync(
    DEVICE_IDENTITY_STORAGE_KEY,
    JSON.stringify(nextIdentity),
    secureStoreOptions
  );

  return nextIdentity;
}

async function readStoredDeviceIdentity(): Promise<StoredDeviceIdentity | null> {
  const storedValue = await SecureStore.getItemAsync(DEVICE_IDENTITY_STORAGE_KEY, secureStoreOptions);
  const parsedIdentity = parseStoredDeviceIdentity(storedValue);

  if (parsedIdentity) {
    return parsedIdentity;
  }

  const legacyStoredValue = await SecureStore.getItemAsync(DEVICE_IDENTITY_STORAGE_KEY, legacySecureStoreOptions);
  const legacyIdentity = parseStoredDeviceIdentity(legacyStoredValue);

  if (legacyIdentity) {
    await SecureStore.setItemAsync(
      DEVICE_IDENTITY_STORAGE_KEY,
      JSON.stringify(legacyIdentity),
      secureStoreOptions
    );

    return legacyIdentity;
  }

  return null;
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

function getDevicePlatform(): DevicePlatform {
  if (Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web') {
    return Platform.OS;
  }

  return 'unknown';
}

function encodeBytes(bytes: Uint8Array): string {
  return fromByteArray(bytes);
}

function randomHex(byteCount: number): string {
  return Array.from(Crypto.getRandomBytes(byteCount))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
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
