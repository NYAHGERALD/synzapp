/**
 * When a video needs a poster frame, and how one job is told from another.
 *
 * The poster is the still frame shown in the bubble before a video is played.
 * It travels **inside the message**, next to the encrypted file rather than in
 * it, which is what lets a recipient see something before downloading tens of
 * megabytes, and lets both sides see it offline.
 *
 * That is also why the timing matters: a poster produced after the message has
 * been encrypted and sent is a poster only the sender will ever have. Videos
 * from the library arrive with one already attached; a video recorded with the
 * camera does not, and its poster has to be attached during preparation, before
 * the message goes.
 *
 * Kept apart from the module that does the work, which imports expo.
 */

/** The parts of an attachment this decision rests on. */
export interface ChatMediaPosterCandidate {
  fileName?: string | null;
  kind?: string | null;
  localUri?: string | null;
  mediaId?: string | null;
  sizeBytes?: number | null;
  thumbnailDataUrl?: string | null;
}

/**
 * Whether this attachment should have a poster made for it.
 *
 * Photos already carry their own thumbnail, and a video that came out of the
 * library already has one. Saying no to those is what keeps this off the path
 * of everything that is not a freshly recorded video.
 */
export function shouldAttachChatMediaPoster(media: ChatMediaPosterCandidate): boolean {
  if (media.kind !== 'video') {
    return false;
  }

  if (!media.localUri) {
    return false;
  }

  return !media.thumbnailDataUrl;
}

/**
 * Identifies one poster job, so the same video asked for twice at once is only
 * decoded once.
 *
 * The lengths of the variable parts are written in so two different videos
 * cannot produce one key and be handed each other's frame.
 */
export function buildChatMediaPosterKey(media: ChatMediaPosterCandidate): string {
  const identity = media.mediaId || media.localUri || '';
  const fileName = media.fileName || '';

  return `${identity.length}:${identity}:${fileName.length}:${fileName}:${media.sizeBytes || 0}`;
}

/**
 * How long the picker will wait for a poster before showing the bubble anyway.
 *
 * Reading one frame is normally quick, and having the poster before the bubble
 * exists is the nicest result: it is there instantly, and it is there offline.
 * But it is a decode on a file that may be large, on a phone that may be busy,
 * and a send that does not appear the moment it is tapped feels broken however
 * good the reason.
 */
export const VIDEO_POSTER_PICK_TIME_LIMIT_MS = 1500;

/**
 * Gives a promise a deadline, falling back rather than failing.
 *
 * Nothing is cancelled when the deadline passes; the work carries on and its
 * result is simply not waited for. That is safe here because the same poster is
 * attached again on the upload path, before the message is encrypted, so a
 * frame that arrives late is still not lost.
 */
export function settleWithinTimeLimit<T>(
  work: Promise<T>,
  fallback: T,
  limitMs: number
): Promise<T> {
  return new Promise<T>((resolve) => {
    let hasSettled = false;
    const timer = setTimeout(() => {
      if (!hasSettled) {
        hasSettled = true;
        resolve(fallback);
      }
    }, limitMs);

    void work
      .then((value) => {
        if (!hasSettled) {
          hasSettled = true;
          clearTimeout(timer);
          resolve(value);
        }
      })
      .catch(() => {
        if (!hasSettled) {
          hasSettled = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      });
  });
}

/**
 * How far a freshly extracted poster has to be turned to stand upright.
 *
 * A phone records "portrait" video as a landscape raster plus a rotation flag,
 * and the two platforms disagree about who applies that flag.
 *
 * - **iOS** sets `appliesPreferredTrackTransform` on its frame generator, so
 *   the poster arrives already upright. Turning it again would break it.
 * - **Android** uses `MediaMetadataRetriever.getFrameAtTime`, which hands back
 *   the frame exactly as stored and never reads the rotation. A portrait
 *   recording therefore produces a landscape poster lying on its side.
 *
 * That poster is not a minor detail: it is what fills the bubble, and it is
 * what covers the player whenever the video is paused, including before it has
 * ever been played. A video that plays perfectly still looks broken through it.
 *
 * `expo-image-picker` reports the flag as `rotation`, and reports width and
 * height already swapped for display, so both the exact angle and a cross-check
 * are available without asking the platform again.
 */
export function resolvePosterRotationDegrees(input: {
  platform: string;
  posterHeight?: number | null;
  posterWidth?: number | null;
  videoHeight?: number | null;
  videoRotationDegrees?: number | null;
  videoWidth?: number | null;
}): number {
  if (input.platform !== 'android') {
    return 0;
  }

  const posterWidth = Math.max(0, input.posterWidth || 0);
  const posterHeight = Math.max(0, input.posterHeight || 0);
  const videoWidth = Math.max(0, input.videoWidth || 0);
  const videoHeight = Math.max(0, input.videoHeight || 0);

  // Nothing to compare, so leave it be rather than turn it on a guess.
  if (!posterWidth || !posterHeight || !videoWidth || !videoHeight) {
    return 0;
  }

  const isPosterUpright = posterHeight > posterWidth;
  const isVideoUpright = videoHeight > videoWidth;

  // The shapes agree, so the frame is already the right way up and turning it
  // would be the thing that breaks it.
  //
  // This is measured rather than assumed on purpose. `getFrameAtTime` applies
  // the rotation on some devices and hands back the stored frame on others,
  // the same split that `KEY_ROTATION` causes one layer down in the decoder.
  // Trusting the flag alone fixes the phones that ignore it and breaks the
  // phones that honour it.
  if (isPosterUpright === isVideoUpright) {
    return 0;
  }

  const reported = Math.round(input.videoRotationDegrees || 0);
  const normalized = ((reported % 360) + 360) % 360;

  // The shapes disagree, so the frame did come back unturned. The file's own
  // flag says how far; a quarter turn is right for all but the rarer 270 when
  // nothing was reported.
  return normalized === 90 || normalized === 270 ? normalized : 90;
}
