import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { getRegisteredDeviceHeaders } from './deviceIdentity';

interface CachedProfilePhotoInput {
  cacheKey?: string | null;
  idToken: string;
  profilePhotoUrl?: string | null;
}

const profilePhotoCacheDirectory = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}Synzapp/ProfilePhotos/`
  : FileSystem.cacheDirectory
    ? `${FileSystem.cacheDirectory}Synzapp/ProfilePhotos/`
    : null;
const legacyProfilePhotoCacheDirectory = FileSystem.cacheDirectory
  ? `${FileSystem.cacheDirectory}synzapp-profile-photos/`
  : null;
const PROFILE_PHOTO_CACHE_DATABASE_NAME = 'synzapp-profile-photo-cache-v1.db';
const IOS_SHARED_KEYCHAIN_ACCESS_GROUP = 'F9M458TK87.com.synzapp.mobile.shared';
const NOTIFICATION_AVATAR_KEYCHAIN_SERVICE = 'synzapp.notification.avatar.v1';
const NOTIFICATION_AVATAR_STORAGE_PREFIX = 'synzapp.notificationAvatar.v1:';
const PROFILE_PHOTO_SIZE = 256;
const PROFILE_PHOTO_QUALITY = 0.78;
const PROFILE_PHOTO_CACHE_LIMIT = 1000;
const NOTIFICATION_AVATAR_SIZE = 96;
const NOTIFICATION_AVATAR_QUALITY = 0.68;
const NOTIFICATION_AVATAR_MAX_BASE64_LENGTH = 85000;
let profilePhotoDatabasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
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

  const safeCacheKey = sanitizeCacheKey(cacheKey);
  const fileUri = `${profilePhotoCacheDirectory}${safeCacheKey}.jpg`;
  const existingFile = await FileSystem.getInfoAsync(fileUri);

  if (existingFile.exists) {
    await recordProfilePhotoCacheHit({
      cacheKey,
      fileUri,
      profilePhotoUrl,
      sizeBytes: typeof existingFile.size === 'number' ? existingFile.size : null
    });
    await cacheNotificationAvatarThumbnail(cacheKey, fileUri);

    return fileUri;
  }

  await FileSystem.makeDirectoryAsync(profilePhotoCacheDirectory, { intermediates: true }).catch(() => undefined);

  const migratedUri = await migrateLegacyProfilePhotoCache({
    cacheKey,
    fileUri,
    profilePhotoUrl,
    safeCacheKey
  });

  if (migratedUri) {
    await cacheNotificationAvatarThumbnail(cacheKey, migratedUri);

    return migratedUri;
  }

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

    const optimized = await ImageManipulator.manipulateAsync(
      temporaryUri,
      [{ resize: { height: PROFILE_PHOTO_SIZE, width: PROFILE_PHOTO_SIZE } }],
      {
        compress: PROFILE_PHOTO_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG
      }
    );
    await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => undefined);
    await FileSystem.moveAsync({
      from: optimized.uri,
      to: fileUri
    });
    const savedFile = await FileSystem.getInfoAsync(fileUri).catch(() => null);
    await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);
    await recordProfilePhotoCacheHit({
      cacheKey,
      fileUri,
      profilePhotoUrl,
      sizeBytes: savedFile?.exists && typeof savedFile.size === 'number' ? savedFile.size : null
    });
    await cacheNotificationAvatarThumbnail(cacheKey, fileUri);

    return fileUri;
  } catch {
    await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);
    return null;
  }
}

export async function clearProfilePhotoCache(): Promise<void> {
  const db = await getProfilePhotoDatabase().catch(() => null);

  if (profilePhotoCacheDirectory) {
    await FileSystem.deleteAsync(profilePhotoCacheDirectory, { idempotent: true }).catch(() => undefined);
  }

  if (db) {
    await db.runAsync('DELETE FROM profile_photo_cache').catch(() => undefined);
  }
}

async function migrateLegacyProfilePhotoCache(input: {
  cacheKey: string;
  fileUri: string;
  profilePhotoUrl: string;
  safeCacheKey: string;
}): Promise<string | null> {
  if (!legacyProfilePhotoCacheDirectory || legacyProfilePhotoCacheDirectory === profilePhotoCacheDirectory) {
    return null;
  }

  const legacyFileUri = `${legacyProfilePhotoCacheDirectory}${input.safeCacheKey}.jpg`;
  const legacyFile = await FileSystem.getInfoAsync(legacyFileUri).catch(() => null);

  if (!legacyFile?.exists) {
    return null;
  }

  try {
    await FileSystem.copyAsync({
      from: legacyFileUri,
      to: input.fileUri
    });
    await FileSystem.deleteAsync(legacyFileUri, { idempotent: true }).catch(() => undefined);
    await recordProfilePhotoCacheHit({
      cacheKey: input.cacheKey,
      fileUri: input.fileUri,
      profilePhotoUrl: input.profilePhotoUrl,
      sizeBytes: typeof legacyFile.size === 'number' ? legacyFile.size : null
    });

    return input.fileUri;
  } catch {
    await FileSystem.deleteAsync(input.fileUri, { idempotent: true }).catch(() => undefined);
    return null;
  }
}

async function recordProfilePhotoCacheHit(input: {
  cacheKey: string;
  fileUri: string;
  profilePhotoUrl: string;
  sizeBytes: number | null;
}): Promise<void> {
  const db = await getProfilePhotoDatabase().catch(() => null);

  if (!db) {
    return;
  }

  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO profile_photo_cache (
      cache_key,
      remote_url,
      local_uri,
      size_bytes,
      updated_at,
      last_used_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET
      remote_url = excluded.remote_url,
      local_uri = excluded.local_uri,
      size_bytes = excluded.size_bytes,
      updated_at = excluded.updated_at,
      last_used_at = excluded.last_used_at`,
    [
      input.cacheKey,
      input.profilePhotoUrl,
      input.fileUri,
      input.sizeBytes,
      now,
      now
    ]
  );
  await pruneProfilePhotoCache(db).catch(() => undefined);
}

async function getProfilePhotoDatabase(): Promise<SQLite.SQLiteDatabase> {
  profilePhotoDatabasePromise ??= (async () => {
    const db = await SQLite.openDatabaseAsync(PROFILE_PHOTO_CACHE_DATABASE_NAME);

    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS profile_photo_cache (
        cache_key TEXT PRIMARY KEY NOT NULL,
        remote_url TEXT NOT NULL,
        local_uri TEXT NOT NULL,
        size_bytes INTEGER,
        updated_at TEXT NOT NULL,
        last_used_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_profile_photo_cache_last_used
        ON profile_photo_cache(last_used_at);
    `);

    return db;
  })();

  return profilePhotoDatabasePromise;
}

async function pruneProfilePhotoCache(db: SQLite.SQLiteDatabase): Promise<void> {
  const staleRows = await db.getAllAsync<{ cache_key: string; local_uri: string }>(
    `SELECT cache_key, local_uri
      FROM profile_photo_cache
      ORDER BY last_used_at DESC
      LIMIT -1 OFFSET ?`,
    [PROFILE_PHOTO_CACHE_LIMIT]
  );

  if (!staleRows.length) {
    return;
  }

  await Promise.all(staleRows.map((row) =>
    FileSystem.deleteAsync(row.local_uri, { idempotent: true }).catch(() => undefined)
  ));
  await db.runAsync(
    `DELETE FROM profile_photo_cache
      WHERE cache_key IN (${staleRows.map(() => '?').join(',')})`,
    staleRows.map((row) => row.cache_key)
  );
}

function sanitizeCacheKey(cacheKey: string): string {
  return cacheKey.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160);
}

async function cacheNotificationAvatarThumbnail(
  cacheKey?: string | null,
  profilePhotoUri?: string | null
): Promise<void> {
  if (
    (Platform.OS !== 'ios' && Platform.OS !== 'android') ||
    !cacheKey ||
    !profilePhotoUri
  ) {
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
