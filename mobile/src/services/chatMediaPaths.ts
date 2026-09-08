import * as FileSystem from 'expo-file-system/legacy';

/**
 * Where chat media lives, and how its location is written down.
 *
 * Absolute paths are not durable. iOS gives every app container a fresh id on
 * install and update, and the folder the app stores media in can change between
 * releases. A path recorded today can therefore point nowhere tomorrow even
 * though the file is still on disk - which reads to the user as "my media
 * vanished".
 *
 * So an absolute path is only ever a runtime detail. What gets persisted, and
 * what travels in a backup, is a portable reference: the scheme below plus a
 * file name. The absolute path is rebuilt at read time from wherever media
 * lives on this device, this launch.
 */

export const PORTABLE_CHAT_MEDIA_SCHEME = 'synzapp-media://';

const cacheMediaDirectory = FileSystem.cacheDirectory
  ? `${FileSystem.cacheDirectory}Synzapp/Media/`
  : null;
const legacyDocumentMediaDirectory = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}Synzapp/Media/`
  : null;
const nativeMediaCacheDirectory = FileSystem.cacheDirectory
  ? `${FileSystem.cacheDirectory}SynzappNativeMedia/`
  : null;

/**
 * Set once storage is initialised. Null until then, in which case media falls
 * back to the cache directory.
 */
let persistentMediaDirectory: string | null = null;

export function setPersistentChatMediaDirectory(directory: string | null): void {
  persistentMediaDirectory = directory;
}

export function getPersistentChatMediaDirectory(): string | null {
  return persistentMediaDirectory;
}

export function getActiveChatMediaDirectory(): string | null {
  return persistentMediaDirectory || cacheMediaDirectory;
}

export function getCacheChatMediaDirectory(): string | null {
  return cacheMediaDirectory;
}

export function getLegacyDocumentChatMediaDirectory(): string | null {
  return legacyDocumentMediaDirectory;
}

export function getNativeChatMediaCacheDirectory(): string | null {
  return nativeMediaCacheDirectory;
}

export function getManagedChatMediaDirectories(): string[] {
  return [
    persistentMediaDirectory,
    cacheMediaDirectory,
    nativeMediaCacheDirectory,
    legacyDocumentMediaDirectory
  ].filter((directory): directory is string => Boolean(directory));
}

export function isManagedChatMediaUri(uri: string): boolean {
  const safeUri = (uri || '').trim();

  if (!safeUri) {
    return false;
  }

  return getManagedChatMediaDirectories().some((directory) => safeUri.startsWith(directory));
}

export function isPortableChatMediaUri(uri: string): boolean {
  return (uri || '').trim().startsWith(PORTABLE_CHAT_MEDIA_SCHEME);
}

/**
 * The form that gets written to the database and into backups.
 *
 * Media the app manages becomes `synzapp-media://<file name>`. Anything else -
 * a data URI, or a path outside our directories - is left exactly as it is.
 */
export function toPortableChatMediaUri(uri: string): string {
  const safeUri = (uri || '').trim();

  if (!safeUri || isPortableChatMediaUri(safeUri) || safeUri.startsWith('data:')) {
    return safeUri;
  }

  const fileName = extractManagedMediaFileName(safeUri);

  return fileName ? `${PORTABLE_CHAT_MEDIA_SCHEME}${fileName}` : safeUri;
}

/**
 * Rebuilds a usable absolute path for this device and this launch.
 *
 * Handles the portable form, and also re-roots absolute paths written by older
 * versions of the app so existing installs repair themselves without a
 * migration step.
 */
export function resolveLocalChatMediaUri(uri: string): string {
  const safeUri = (uri || '').trim();

  if (!safeUri || safeUri.startsWith('data:')) {
    return safeUri;
  }

  if (isPortableChatMediaUri(safeUri)) {
    const fileName = safeUri.slice(PORTABLE_CHAT_MEDIA_SCHEME.length);
    const directory = getActiveChatMediaDirectory();

    return directory && fileName ? `${directory}${fileName}` : safeUri;
  }

  if (!safeUri.startsWith('file://')) {
    return safeUri;
  }

  const managedPath = parseManagedMediaPath(safeUri);

  if (!managedPath) {
    return safeUri;
  }

  // Decide the root from the folder the path names, not from a prefix match -
  // a path written under an old app container matches no current prefix, and
  // that is exactly the case this exists to repair.
  const directory = managedPath.marker === '/SynzappNativeMedia/'
    ? nativeMediaCacheDirectory
    : getActiveChatMediaDirectory();

  return directory ? `${directory}${managedPath.fileName}` : safeUri;
}

/**
 * The file name, if this path sits directly inside a directory the app manages.
 *
 * Matching is done on the folder name rather than the full prefix, so a path
 * written under a previous app container is still recognised as ours.
 */
function extractManagedMediaFileName(uri: string): string | null {
  return parseManagedMediaPath(uri)?.fileName || null;
}

function parseManagedMediaPath(uri: string): { fileName: string; marker: string } | null {
  const markers = ['/SynzappNativeMedia/', '/Synzapp/Media/', '/SynzappMedia/'];

  for (const marker of markers) {
    const markerIndex = uri.lastIndexOf(marker);

    if (markerIndex === -1) {
      continue;
    }

    const fileName = uri.slice(markerIndex + marker.length);

    // Only direct children. A nested path is not something we wrote.
    if (fileName && !fileName.includes('/')) {
      return { fileName, marker };
    }
  }

  return null;
}
