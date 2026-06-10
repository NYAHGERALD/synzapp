import * as FileSystem from 'expo-file-system/legacy';
import { getRegisteredDeviceHeaders } from './deviceIdentity';

interface CachedProfilePhotoInput {
  cacheKey?: string | null;
  idToken: string;
  profilePhotoUrl?: string | null;
}

const profilePhotoCacheDirectory = FileSystem.cacheDirectory
  ? `${FileSystem.cacheDirectory}synzapp-profile-photos/`
  : null;

export async function getCachedProfilePhotoUri({
  cacheKey,
  idToken,
  profilePhotoUrl
}: CachedProfilePhotoInput): Promise<string | null> {
  if (!profilePhotoUrl) {
    return null;
  }

  if (profilePhotoUrl.startsWith('file:') || profilePhotoUrl.startsWith('data:')) {
    return profilePhotoUrl;
  }

  if (!profilePhotoCacheDirectory || !cacheKey || !idToken || !/^https?:\/\//i.test(profilePhotoUrl)) {
    return null;
  }

  const fileUri = `${profilePhotoCacheDirectory}${sanitizeCacheKey(cacheKey)}.jpg`;
  const existingFile = await FileSystem.getInfoAsync(fileUri);

  if (existingFile.exists) {
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

    return fileUri;
  } catch {
    await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);
    return null;
  }
}

function sanitizeCacheKey(cacheKey: string): string {
  return cacheKey.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160);
}
