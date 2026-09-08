import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';

/**
 * Poster frames for Library video rows.
 *
 * Library videos live on the server behind an authenticated URL, so the poster
 * is pulled with the same file headers the rest of the Library uses. Frames are
 * read straight from the remote URL rather than downloading the whole file - a
 * 30 MB video should not have to land on disk just to draw a 320 px tile.
 *
 * Results are written to a dedicated cache directory keyed by evidence id, so a
 * poster survives app restarts and is generated at most once per video.
 */

const LIBRARY_POSTER_DIRECTORY = FileSystem.cacheDirectory
  ? `${FileSystem.cacheDirectory}Synzapp/LibraryPosters/`
  : null;
const LIBRARY_POSTER_WIDTH = 480;
/** Frame offsets in ms. The very first frame is often black, so it is the last resort. */
const LIBRARY_POSTER_FRAME_TIMES = [1000, 2500, 300, 0];

const posterUriByEvidenceId = new Map<string, string | null>();
const activePosterPromises = new Map<string, Promise<string | null>>();
const posterListeners = new Map<string, Set<(posterUri: string | null) => void>>();

export interface CompanyLibraryVideoThumbnailInput {
  evidenceId: string;
  fileUrl: string | null;
  headers?: Record<string, string>;
}

export function getCachedCompanyLibraryVideoThumbnail(evidenceId: string): string | null {
  return posterUriByEvidenceId.get(evidenceId) || null;
}

export async function getCompanyLibraryVideoThumbnail(
  input: CompanyLibraryVideoThumbnailInput
): Promise<string | null> {
  const evidenceId = (input.evidenceId || '').trim();
  const fileUrl = (input.fileUrl || '').trim();

  if (!evidenceId || !fileUrl || !LIBRARY_POSTER_DIRECTORY) {
    return null;
  }

  if (posterUriByEvidenceId.has(evidenceId)) {
    return posterUriByEvidenceId.get(evidenceId) || null;
  }

  const activePromise = activePosterPromises.get(evidenceId);

  if (activePromise) {
    return activePromise;
  }

  const posterPromise = buildCompanyLibraryVideoThumbnail(evidenceId, fileUrl, input.headers)
    .catch(() => null)
    .then((posterUri) => {
      // Cache the null too. A video whose poster cannot be produced should not be
      // retried on every re-render of the Library list.
      posterUriByEvidenceId.set(evidenceId, posterUri);
      return posterUri;
    })
    .finally(() => {
      activePosterPromises.delete(evidenceId);
    });

  activePosterPromises.set(evidenceId, posterPromise);

  return posterPromise;
}

/**
 * Records a poster for a Library video from a copy already on the device.
 *
 * Generating a poster straight from the Library URL does not work — it needs an
 * Authorization header the native media stack will not send — and downloading
 * every video just to draw a tile would cost hundreds of megabytes. So the
 * poster is captured the first time a video is played, and the list fills in
 * from there.
 */
export async function cacheCompanyLibraryVideoThumbnailFromFile(
  evidenceId: string,
  localUri: string
): Promise<string | null> {
  const safeEvidenceId = (evidenceId || '').trim();

  if (!safeEvidenceId || !localUri || !LIBRARY_POSTER_DIRECTORY) {
    return null;
  }

  if (posterUriByEvidenceId.get(safeEvidenceId)) {
    return posterUriByEvidenceId.get(safeEvidenceId) || null;
  }

  const posterUri = await buildCompanyLibraryVideoThumbnail(safeEvidenceId, localUri)
    .catch(() => null);

  posterUriByEvidenceId.set(safeEvidenceId, posterUri);
  notifyPosterListeners(safeEvidenceId, posterUri);

  return posterUri;
}

/** Lets a visible row pick up a poster captured after it first rendered. */
export function subscribeCompanyLibraryVideoThumbnail(
  evidenceId: string,
  listener: (posterUri: string | null) => void
): () => void {
  const listeners = posterListeners.get(evidenceId) || new Set<(posterUri: string | null) => void>();

  listeners.add(listener);
  posterListeners.set(evidenceId, listeners);

  return () => {
    const current = posterListeners.get(evidenceId);

    if (!current) {
      return;
    }

    current.delete(listener);

    if (!current.size) {
      posterListeners.delete(evidenceId);
    }
  };
}

function notifyPosterListeners(evidenceId: string, posterUri: string | null): void {
  posterListeners.get(evidenceId)?.forEach((listener) => {
    try {
      listener(posterUri);
    } catch {
      // A failing row must not stop the others updating.
    }
  });
}

export async function clearCompanyLibraryVideoThumbnails(): Promise<void> {
  posterUriByEvidenceId.clear();
  activePosterPromises.clear();

  if (LIBRARY_POSTER_DIRECTORY) {
    await FileSystem.deleteAsync(LIBRARY_POSTER_DIRECTORY, { idempotent: true }).catch(() => undefined);
  }
}

async function buildCompanyLibraryVideoThumbnail(
  evidenceId: string,
  fileUrl: string,
  headers?: Record<string, string>
): Promise<string | null> {
  const posterUri = `${LIBRARY_POSTER_DIRECTORY}${sanitizePosterFileName(evidenceId)}.jpg`;
  const existingPoster = await FileSystem.getInfoAsync(posterUri).catch(() => null);

  if (existingPoster?.exists && (existingPoster.size || 0) > 0) {
    return posterUri;
  }

  await FileSystem.makeDirectoryAsync(LIBRARY_POSTER_DIRECTORY || '', { intermediates: true })
    .catch(() => undefined);

  const isRemote = /^https?:\/\//i.test(fileUrl);

  for (const time of LIBRARY_POSTER_FRAME_TIMES) {
    try {
      const frame = await VideoThumbnails.getThumbnailAsync(fileUrl, {
        // Headers only apply to remote sources; passing them for a file:// URI
        // is harmless but pointless.
        ...(isRemote && headers ? { headers } : {}),
        quality: 0.7,
        time
      });
      const resized = await ImageManipulator.manipulateAsync(
        frame.uri,
        [{ resize: { width: LIBRARY_POSTER_WIDTH } }],
        {
          compress: 0.6,
          format: ImageManipulator.SaveFormat.JPEG
        }
      );

      await FileSystem.moveAsync({ from: resized.uri, to: posterUri }).catch(async () => {
        await FileSystem.copyAsync({ from: resized.uri, to: posterUri });
      });

      const writtenPoster = await FileSystem.getInfoAsync(posterUri).catch(() => null);

      return writtenPoster?.exists ? posterUri : null;
    } catch {
      // Try the next offset. A frame request can fail because that exact
      // timestamp has no decodable frame, which a different offset often fixes.
    }
  }

  return null;
}

function sanitizePosterFileName(evidenceId: string): string {
  return evidenceId.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 96) || 'library_video';
}
