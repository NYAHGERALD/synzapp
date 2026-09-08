import type { ChatMessage } from './chatApi';

/**
 * Keeping video and photo thumbnails out of the encrypted message payload.
 *
 * A thumbnail is 40KB of base64 and it travels inside the message, so it ends
 * up inside the row payload too. That payload is sealed with a secretbox
 * written in JavaScript, which means every save re-encrypts every thumbnail in
 * the messages it touches, and every chat open decrypts all of them again, on
 * the same thread that answers taps.
 *
 * Measured on a Galaxy S23 FE, a thread holding three videos took **1566ms** to
 * persist three envelopes. The same three envelopes in a thread with no video
 * took **10 to 55ms**. The whole app went unresponsive for two to three seconds
 * because of three thumbnails, and deleting that one chat restored it.
 *
 * The thumbnail is **already** stored separately, in `local_chat_media`, in its
 * own column and in the clear. Sealing a second copy into the payload buys
 * nothing: it is the same database file, and the cheap copy is the one the
 * cache policy and the transfer queue already read. So the payload carries
 * everything about a message except the picture, and the picture is put back
 * from its own column on the way out.
 *
 * This is what WhatsApp and Signal do. A message row is small and a thumbnail
 * is a blob beside it; the database is encrypted natively, as a file, rather
 * than a JavaScript cipher being run over every row on every read and write.
 */

/** How a stored thumbnail is found again: one media slot of one message. */
export function buildThumbnailKey(messageId: string, mediaIndex: number): string {
  return `${messageId}#${mediaIndex}`;
}

/**
 * A copy of the message with the thumbnails taken out, ready to be sealed.
 *
 * Everything else about the attachment stays, so a payload written this way is
 * still complete on its own apart from the picture.
 */
export function stripThumbnailsForPayload(message: ChatMessage): ChatMessage {
  let didChange = false;

  const strip = <T extends { thumbnailDataUrl?: string } | null | undefined>(media: T): T => {
    if (!media?.thumbnailDataUrl) {
      return media;
    }

    didChange = true;

    const { thumbnailDataUrl, ...rest } = media;

    return rest as T;
  };

  const media = strip(message.media);
  const image = strip(message.image);
  const mediaItems = message.mediaItems?.map(strip);

  if (!didChange) {
    return message;
  }

  return { ...message, image, media, mediaItems } as ChatMessage;
}

/**
 * Puts the thumbnails back, from the column they were written to.
 *
 * A payload written before this split still carries its own thumbnail, so what
 * is already on the message wins and older rows keep working untouched.
 */
export function restoreThumbnails(
  message: ChatMessage,
  thumbnailsByKey: Map<string, string>
): ChatMessage {
  if (!thumbnailsByKey.size || !message.messageId) {
    return message;
  }

  let didChange = false;

  const restore = <T extends { thumbnailDataUrl?: string } | null | undefined>(
    media: T,
    mediaIndex: number
  ): T => {
    if (!media || media.thumbnailDataUrl) {
      return media;
    }

    const thumbnailDataUrl = thumbnailsByKey.get(buildThumbnailKey(message.messageId, mediaIndex));

    if (!thumbnailDataUrl) {
      return media;
    }

    didChange = true;

    return { ...media, thumbnailDataUrl } as T;
  };

  const media = restore(message.media, 0);
  const image = restore(message.image, 0);
  const mediaItems = message.mediaItems?.map((item, index) => restore(item, index));

  if (!didChange) {
    return message;
  }

  return { ...message, image, media, mediaItems } as ChatMessage;
}

/**
 * One attachment without its thumbnail.
 *
 * The media table writes the thumbnail to its own column and *also* sealed a
 * whole copy of the attachment, thumbnail included, into a payload beside it.
 * The same mistake as the message payload, in a second place, and it fires on
 * every media update.
 */
export function stripMediaThumbnail<T extends { thumbnailDataUrl?: string }>(media: T): T {
  if (!media?.thumbnailDataUrl) {
    return media;
  }

  const { thumbnailDataUrl, ...rest } = media;

  return rest as T;
}
