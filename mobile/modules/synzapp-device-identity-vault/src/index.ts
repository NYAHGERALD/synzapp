import { Platform, requireOptionalNativeModule } from 'expo-modules-core';

/**
 * This device's chat identity, kept somewhere an uninstall cannot reach.
 *
 * Everything a person can read is sealed to their device's key. On Android an
 * uninstall deletes that key with the rest of the app's data, so a reinstall
 * came back as a different device and the whole conversation was unreadable —
 * on the same handset, for the same person. iOS never had the problem: its
 * keychain outlives the app.
 *
 * This closes the gap using Google's Block Store, which is the platform's own
 * answer to it. Every call is best effort and returns null or false rather than
 * throwing: Block Store keeps data across a reinstall only where the person has
 * backup switched on, and is missing entirely on a phone without Play services.
 * Where it cannot help, the escrowed-key restore still can.
 */

interface DeviceIdentityVaultModule {
  clear: (key: string) => Promise<boolean>;
  read: (key: string) => Promise<string | null>;
  write: (key: string, value: string) => Promise<boolean>;
}

const nativeModule = requireOptionalNativeModule<DeviceIdentityVaultModule>('SynzappDeviceIdentityVault');

/** Whether anything can be kept here at all on this phone. */
export function isDeviceIdentityVaultAvailable(): boolean {
  return Platform.OS === 'android' && Boolean(nativeModule);
}

export async function readVaultedDeviceIdentity(key: string): Promise<string | null> {
  if (!nativeModule) {
    return null;
  }

  return nativeModule.read(key).catch(() => null);
}

export async function writeVaultedDeviceIdentity(key: string, value: string): Promise<boolean> {
  if (!nativeModule) {
    return false;
  }

  return nativeModule.write(key, value).catch(() => false);
}

export async function clearVaultedDeviceIdentity(key: string): Promise<boolean> {
  if (!nativeModule) {
    return false;
  }

  return nativeModule.clear(key).catch(() => false);
}
