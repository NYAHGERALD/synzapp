import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getRegisteredDeviceHeaders } from './deviceIdentity';

interface CachedProfilePhotoInput {
  cacheKey?: string | null;
  idToken: string;
  profilePhotoUrl?: string | null;
}

const profilePhotoCacheDirectory = FileSystem.cacheDirectory
  ? `${FileSystem.cacheDirectory}synzapp-profile-photos/`
  : null;
const IOS_SHARED_KEYCHAIN_ACCESS_GROUP = 'F9M458TK87.com.synzapp.mobile.shared';
const NOTIFICATION_AVATAR_KEYCHAIN_SERVICE = 'synzapp.notification.avatar.v1';
const NOTIFICATION_AVATAR_STORAGE_PREFIX = 'synzapp.notificationAvatar.v1:';
const NOTIFICATION_AVATAR_SIZE = 96;
const NOTIFICATION_AVATAR_QUALITY = 0.68;
const NOTIFICATION_AVATAR_MAX_BASE64_LENGTH = 85000;
const notificationAvatarSecureStoreOptions: SecureStore.SecureStoreOptions = {
  ...(Platform.OS === 'ios' ? { accessGroup: IOS_SHARED_KEYCHAIN_ACCESS_GROUP } : {}),
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  keychainService: NOTIFICATION_AVATAR_KEYCHAIN_SERVICE
};

export async function getCachedProfilePhotoUri({
  cacheKey,
  idToken,
  profilePhotoUrl
}: CachedProfilePhotoInput): Promise<string | null> {
  if (!profilePhotoUrl) {
    return null;
  }

  if (profilePhotoUrl.startsWith('file:') || profilePhotoUrl.startsWith('data:')) {
    await cacheNotificationAvatarThumbnail(cacheKey, profilePhotoUrl);

    return profilePhotoUrl;
  }

  if (!profilePhotoCacheDirectory || !cacheKey || !idToken || !/^https?:\/\//i.test(profilePhotoUrl)) {
    return null;
  }

  const fileUri = `${profilePhotoCacheDirectory}${sanitizeCacheKey(cacheKey)}.jpg`;
  const existingFile = await FileSystem.getInfoAsync(fileUri);

  if (existingFile.exists) {
    await cacheNotificationAvatarThumbnail(cacheKey, fileUri);

    return fileUri;
  }

  await FileSystem.makeDirectoryAsync(profilePhotoCacheDirectory, { intermediates: true }).catch(() => undefined);

  const temporaryUri = `${fileUri}.download`;

  try {
    await FileSystem.deleteAsync(temporaryUri, { idempotent: true });
    const deviceHeaders = await getRegisteredDeviceHeaders(idToken);

    const result = await FileSystem.downloadAsync(profilePhotoUrl, temporaryUri, {
      headers: {
        Accept: 'image/*',
        Authorization: `Bearer ${idToken}`,
        ...deviceHeaders
      }
    });

    if (result.status < 200 || result.status >= 300) {
      await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);
      return null;
    }

    await FileSystem.moveAsync({
      from: temporaryUri,
      to: fileUri
    });
    await cacheNotificationAvatarThumbnail(cacheKey, fileUri);

    return fileUri;
  } catch {
    await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);
    return null;
  }
}

function sanitizeCacheKey(cacheKey: string): string {
  return cacheKey.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160);
}

async function cacheNotificationAvatarThumbnail(
  cacheKey?: string | null,
  profilePhotoUri?: string | null
): Promise<void> {
  if (Platform.OS !== 'ios' || !cacheKey || !profilePhotoUri) {
    return;
  }

  const storageKey = getNotificationAvatarStorageKey(cacheKey);
  const existingAvatar = await SecureStore.getItemAsync(
    storageKey,
    notificationAvatarSecureStoreOptions
  ).catch(() => null);

  if (existingAvatar) {
    return;
  }

  try {
    const thumbnail = await ImageManipulator.manipulateAsync(
      profilePhotoUri,
      [{ resize: { height: NOTIFICATION_AVATAR_SIZE, width: NOTIFICATION_AVATAR_SIZE } }],
      {
        base64: true,
        compress: NOTIFICATION_AVATAR_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG
      }
    );

    if (!thumbnail.base64 || thumbnail.base64.length > NOTIFICATION_AVATAR_MAX_BASE64_LENGTH) {
      return;
    }

    await SecureStore.setItemAsync(
      storageKey,
      JSON.stringify({
        base64: thumbnail.base64,
        mimeType: 'image/jpeg',
        version: 1
      }),
      notificationAvatarSecureStoreOptions
    );
  } catch {
    // Avatar previews are best-effort; chat image rendering should never fail because of them.
  }
}

function getNotificationAvatarStorageKey(cacheKey: string): string {
  return `${NOTIFICATION_AVATAR_STORAGE_PREFIX}${cacheKey}`;
}
