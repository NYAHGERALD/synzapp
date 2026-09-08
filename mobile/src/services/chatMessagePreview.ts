import type { ChatMediaAttachment, ChatMessage } from './chatApi';
import { clampAudioSeconds } from './chatDisplayFormatting';
import { getMessageMedia, getMessageMediaItems } from './chatMessageReconciliation';

/**
 * How a message and its attachments are described to the user.
 *
 * The second batch of pure helpers lifted out of the Admin chat screen. They
 * were shared by the message list, the reply chip, the reaction sheet, the media
 * review sheet and the audio player — every one of which had to be extracted
 * around them, and none of which could be, while they lived inside the screen.
 */

export function formatMediaDuration(durationMs?: number): string {
  const safeDurationMs = Number.isFinite(durationMs) ? Math.max(durationMs || 0, 0) : 0;
  const totalSeconds = Math.round(safeDurationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatMessageTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * The one line that stands for a message in a chat list, reply chip or reaction
 * sheet.
 *
 * Text wins when there is any. Otherwise the media speaks for itself, and an
 * album is counted rather than described — "4 items" is more use than the name
 * of whichever file happened to be first.
 */
/** A message's text, collapsed to a single line. */
export function getChatMessageTextPreview(message: ChatMessage): string {
  return (message.text || '').replace(/\s+/g, ' ').trim();
}

export function getChatMessagePreview(message: ChatMessage): string {
  // A message this device cannot open still has to say something in the chat
  // list, or the list shows the previous message while the unread badge counts
  // one that appears not to exist.
  if (message.decryptionFailed) {
    return 'Message unavailable';
  }

  const text = getChatMessageTextPreview(message);

  if (text) {
    return text;
  }

  const mediaItems = getMessageMediaItems(message);

  if (mediaItems.length > 1) {
    return `${mediaItems.length} items`;
  }

  const media = mediaItems[0] || getMessageMedia(message);

  if (!media) {
    return '';
  }

  if (media.kind === 'image') {
    return 'Photo';
  }

  if (media.kind === 'video') {
    return 'Video';
  }

  if (media.kind === 'audio') {
    return 'Voice message';
  }

  return media.fileName || 'File';
}

/** Whether a transfer ring should still be drawn over this attachment. */
export function isMediaTransferActive(media: ChatMediaAttachment): boolean {
  return media.transferStatus === 'queued' ||
    media.transferStatus === 'preparing' ||
    media.transferStatus === 'uploading' ||
    media.transferStatus === 'downloading';
}

/**
 * The extension to show on a document tile.
 *
 * A file with no dot returns nothing rather than its whole name shouted in
 * capitals, which is what `"README".split('.').pop()` would otherwise give.
 */
export function getReadableFileExtension(fileName?: string | null): string {
  const safeFileName = typeof fileName === 'string' ? fileName : '';
  const extension = safeFileName.split('.').pop()?.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  return extension && extension !== safeFileName.toUpperCase() ? extension : '';
}

export function getAudioSeekSeconds(locationX: number, width: number, durationSeconds: number): number {
  if (!width || !durationSeconds) {
    return 0;
  }

  const progress = Math.min(Math.max(locationX / width, 0), 1);

  return clampAudioSeconds(durationSeconds * progress, durationSeconds);
}

/**
 * The bars drawn behind a voice note.
 *
 * Derived from the attachment's own identity, not from its audio: decoding every
 * voice note to draw 36 bars would cost far more than the decoration is worth.
 * Being seeded rather than random is the part that matters — the same note draws
 * the same shape on every device and after every restart.
 */
export function buildVoiceNoteWaveform(media: ChatMediaAttachment): number[] {
  const seedSource = `${media.mediaId || media.fileName || 'voice'}_${media.sizeBytes || 0}`;
  let seed = 0;

  for (let index = 0; index < seedSource.length; index += 1) {
    seed = (seed + seedSource.charCodeAt(index) * (index + 1)) % 9973;
  }

  return Array.from({ length: 36 }, (_item, index) => {
    const value = Math.sin((seed + index * 29) * 0.17) + Math.cos((seed + index * 11) * 0.09);
    const normalized = Math.abs(value) / 2;

    return Math.max(6, Math.round(8 + normalized * 20));
  });
}
