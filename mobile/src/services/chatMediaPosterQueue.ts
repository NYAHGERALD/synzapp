import * as ImageManipulator from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';
import type { ChatMediaAttachment } from './chatApi';
import { Platform } from 'react-native';
import {
  buildChatMediaPosterKey,
  resolvePosterRotationDegrees,
  shouldAttachChatMediaPoster
} from './chatMediaPosterRules';

interface ChatMediaPosterResult {
  media: ChatMediaAttachment;
  thumbnailDataUrl: string;
}

const CHAT_MEDIA_POSTER_WIDTHS = [360, 280, 220];
/** Tried on the already-shrunken picture, never on the camera frame. */
const CHAT_MEDIA_POSTER_FALLBACK_QUALITIES = [0.42, 0.32, 0.24];
/**
 * Bounded so a long thread cannot be sunk by its own thumbnails.
 *
 * The thumbnail travels inside the message and is therefore held in memory for
 * every message the thread has loaded, and the local cache holds a thousand of
 * them. At the old ceiling of 120 KB that is 120 MB of base64 strings in the
 * worst case, before a single one is decoded, which is how a chat full of
 * photos turns into a freeze on a mid-range Android.
 *
 * A bubble draws this at roughly 200pt wide, so the ladder of widths below
 * still starts at 360 and only steps down for the images that will not fit.
 * Only the heaviest few are affected, and the tail is bounded at a third of
 * what it was.
 */
const CHAT_MEDIA_POSTER_MAX_BASE64_BYTES = 40 * 1024;
const activePosterPromises = new Map<string, Promise<ChatMediaPosterResult | null>>();

/**
 * Attaches a poster frame and waits for it.
 *
 * Preparation has to hand the finished attachment to encryption, so this is the
 * one place a poster cannot be left to finish on its own. The thumbnail travels
 * inside the message,
 * so a poster that arrives after the message has gone is one only the sender
 * will ever see, which is why videos recorded on the phone reached the other
 * side with an empty bubble.
 *
 * It never throws and never blocks indefinitely. The generator gives up after a
 * bounded number of attempts and returns nothing, and this then hands back the
 * attachment exactly as it came in, so a video whose frame cannot be read is
 * still sent.
 */
export async function attachChatMediaPoster(
  media: ChatMediaAttachment
): Promise<ChatMediaAttachment> {
  if (!shouldAttachChatMediaPoster(media)) {
    return media;
  }

  const posterKey = buildChatMediaPosterKey(media);
  const activePromise = activePosterPromises.get(posterKey) || generateChatMediaPoster(media);

  activePosterPromises.set(posterKey, activePromise);

  try {
    return (await activePromise)?.media || media;
  } catch {
    return media;
  } finally {
    activePosterPromises.delete(posterKey);
  }
}

async function generateChatMediaPoster(media: ChatMediaAttachment): Promise<ChatMediaPosterResult | null> {
  for (const time of [500, 900, 1500, 0]) {
    try {
      const poster = await VideoThumbnails.getThumbnailAsync(media.localUri || '', {
        quality: 0.68,
        time
      });
      // Android hands the frame back exactly as stored. No rotation flag is
      // carried this far, so the shapes disagreeing is the signal. See
      // resolvePosterRotationDegrees.
      const thumbnail = await generateImageThumbnail(poster.uri, resolvePosterRotationDegrees({
        platform: Platform.OS,
        posterHeight: poster.height,
        posterWidth: poster.width,
        videoHeight: media.height,
        videoWidth: media.width
      }));

      if (thumbnail) {
        return {
          media: {
            ...media,
            thumbnailContentType: 'image/jpeg',
            thumbnailDataUrl: thumbnail.dataUrl,
            thumbnailHeight: thumbnail.height,
            thumbnailWidth: thumbnail.width
          },
          thumbnailDataUrl: thumbnail.dataUrl
        };
      }
    } catch {
      await waitForMediaPosterRecovery();
    }
  }

  return null;
}

async function generateImageThumbnail(sourceUri: string, rotateDegrees = 0): Promise<{
  dataUrl: string;
  height: number;
  width: number;
} | null> {
  // One decode of the camera frame, then cheap re-encodes of the small result.
  // Walking a ladder of widths re-read the full frame at every step, which cost
  // more than the platform spends reading it in the first place. Turning is
  // done after shrinking for the same reason, and a quarter turn swaps the
  // sides, so the target goes on the height when one is coming.
  const isQuarterTurn = rotateDegrees === 90 || rotateDegrees === 270;
  const width = CHAT_MEDIA_POSTER_WIDTHS[0];

  try {
    const shrunk = await ImageManipulator.manipulateAsync(
      sourceUri,
      [
        { resize: isQuarterTurn ? { height: width } : { width } },
        ...(rotateDegrees ? [{ rotate: rotateDegrees }] : [])
      ],
      {
        base64: true,
        compress: 0.54,
        format: ImageManipulator.SaveFormat.JPEG
      }
    );

    if (shrunk.base64 && getUtf8ByteCount(shrunk.base64) <= CHAT_MEDIA_POSTER_MAX_BASE64_BYTES) {
      return {
        dataUrl: `data:image/jpeg;base64,${shrunk.base64}`,
        height: shrunk.height,
        width: shrunk.width
      };
    }

    for (const compress of CHAT_MEDIA_POSTER_FALLBACK_QUALITIES) {
      const squeezed = await ImageManipulator.manipulateAsync(
        shrunk.uri,
        [],
        {
          base64: true,
          compress,
          format: ImageManipulator.SaveFormat.JPEG
        }
      ).catch(() => null);

      if (squeezed?.base64 && getUtf8ByteCount(squeezed.base64) <= CHAT_MEDIA_POSTER_MAX_BASE64_BYTES) {
        return {
          dataUrl: `data:image/jpeg;base64,${squeezed.base64}`,
          height: squeezed.height,
          width: squeezed.width
        };
      }
    }
  } catch {
    await waitForMediaPosterRecovery();
  }

  return null;
}

function waitForMediaPosterRecovery(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 80);
  });
}

function getUtf8ByteCount(value: string): number {
  let bytes = 0;

  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.charCodeAt(index);

    if (codePoint <= 0x7F) {
      bytes += 1;
    } else if (codePoint <= 0x7FF) {
      bytes += 2;
    } else if (codePoint >= 0xD800 && codePoint <= 0xDBFF) {
      bytes += 4;
      index += 1;
    } else {
      bytes += 3;
    }
  }

  return bytes;
}
