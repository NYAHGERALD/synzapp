import type { ChatMediaAttachment } from './chatApi';
import { getMediaLocalUri } from './chatMessageReconciliation';

/**
 * The small display helpers the chat UI shares.
 *
 * Each of these was defined inside the Admin chat screen and called from all
 * over it — `getErrorMessage` alone from a hundred places. They are pure, they
 * decide what the user actually reads, and none of them had a test, because
 * nothing inside a 47,000-line component is reachable from one.
 */

/** The message from a thrown value, or the fallback when it has nothing useful. */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

/**
 * A file size a person can read.
 *
 * Sizes at or above 10 MB drop the decimal — "146 MB" rather than "146.3 MB",
 * because at that scale the tenth is noise.
 */
export function formatByteCount(sizeBytes?: number): string {
  const safeSize = Number.isFinite(sizeBytes) ? Math.max(sizeBytes || 0, 0) : 0;

  if (safeSize >= 1024 * 1024) {
    return `${(safeSize / (1024 * 1024)).toFixed(safeSize >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }

  if (safeSize >= 1024) {
    return `${Math.round(safeSize / 1024)} KB`;
  }

  return `${Math.round(safeSize)} B`;
}

export function clampAudioSeconds(valueSeconds: number, durationSeconds: number): number {
  return Math.min(Math.max(valueSeconds, 0), Math.max(durationSeconds, 0));
}

export function formatAudioSeconds(valueSeconds?: number): string {
  const safeSeconds = Number.isFinite(valueSeconds) ? Math.max(Math.floor(valueSeconds || 0), 0) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatMessageDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return `${date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: '2-digit'
  })}, ${date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  })}`;
}

/** What the transfer ring is captioned with, or nothing once the media is ready. */
export function getMediaTransferLabel(media: ChatMediaAttachment): string {
  if (media.transferStatus === 'queued') {
    return 'Queued';
  }

  if (media.transferStatus === 'preparing') {
    return 'Preparing';
  }

  if (media.transferStatus === 'uploading') {
    return 'Sending';
  }

  if (media.transferStatus === 'downloading') {
    return 'Downloading';
  }

  if (media.transferStatus === 'failed') {
    return 'Failed';
  }

  return '';
}

/**
 * What to draw as the still image for an attachment.
 *
 * A video always uses its poster, never its own file — pointing an `Image` at a
 * video renders a broken tile, which is how a Library full of videos ended up
 * showing crosses instead of thumbnails.
 */
export function getMediaPreviewUri(media: ChatMediaAttachment | null): string {
  if (!media) {
    return '';
  }

  if (media.kind === 'video') {
    return media.thumbnailDataUrl || '';
  }

  return getMediaLocalUri(media) || media.thumbnailDataUrl || '';
}

/**
 * Which uri a bubble's still image should point at.
 *
 * A video has no image of its own. An `Image` pointed at an mp4 draws nothing,
 * and on iOS it often fails without reporting an error at all, so there is no
 * failure to react to and the tile stays empty for good. Its poster is
 * therefore the only candidate, never a fallback tried after the file itself.
 * Every video bubble in the app was empty for exactly that reason.
 *
 * A photo is the other way round: its own file is the real thing, and the
 * thumbnail carried inside the message is the stand-in for when that file is
 * not on this device.
 */
export function resolveBubbleMediaUri(input: {
  fallbackUri: string;
  failedUris: readonly string[];
  kind: string;
  sourceUri: string;
}): string {
  const candidates = input.kind === 'video'
    ? [input.fallbackUri]
    : [input.sourceUri, input.fallbackUri];

  return candidates.find((uri) => Boolean(uri) && !input.failedUris.includes(uri)) || '';
}
