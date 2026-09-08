import { describe, expect, it, vi } from 'vitest';

// getMediaPreviewUri re-roots stored paths, which reaches the file system layer.
// Nothing here touches disk; the mock only keeps the native module out.
vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///var/mobile/Containers/Data/Application/NEW/Library/Caches/',
  documentDirectory: 'file:///var/mobile/Containers/Data/Application/NEW/Documents/'
}));

import type { ChatMediaAttachment } from './chatApi';
import {
  resolveBubbleMediaUri,
  clampAudioSeconds,
  formatAudioSeconds,
  formatByteCount,
  formatMessageDateTime,
  getErrorMessage,
  getMediaPreviewUri,
  getMediaTransferLabel
} from './chatDisplayFormatting';

function media(overrides: Partial<ChatMediaAttachment> = {}): ChatMediaAttachment {
  return {
    contentType: 'image/jpeg',
    fileName: 'photo.jpg',
    kind: 'image',
    ...overrides
  } as ChatMediaAttachment;
}

describe('getErrorMessage', () => {
  it('uses a real error message', () => {
    expect(getErrorMessage(new Error('Upload failed'), 'fallback')).toBe('Upload failed');
  });

  it('falls back for an Error with no message', () => {
    expect(getErrorMessage(new Error(''), 'Something went wrong')).toBe('Something went wrong');
  });

  it('falls back for anything that is not an Error', () => {
    expect(getErrorMessage('a string', 'fallback')).toBe('fallback');
    expect(getErrorMessage(null, 'fallback')).toBe('fallback');
    expect(getErrorMessage({ message: 'not an Error' }, 'fallback')).toBe('fallback');
  });
});

describe('formatByteCount', () => {
  it('reads bytes, kilobytes and megabytes', () => {
    expect(formatByteCount(512)).toBe('512 B');
    expect(formatByteCount(2048)).toBe('2 KB');
    expect(formatByteCount(1024 * 1024 * 2.5)).toBe('2.5 MB');
  });

  it('drops the decimal once the tenth is noise', () => {
    expect(formatByteCount(1024 * 1024 * 146.3)).toBe('146 MB');
  });

  it('treats missing and negative sizes as zero', () => {
    expect(formatByteCount(undefined)).toBe('0 B');
    expect(formatByteCount(-90)).toBe('0 B');
    expect(formatByteCount(Number.NaN)).toBe('0 B');
  });
});

describe('audio timings', () => {
  it('formats as minutes and padded seconds', () => {
    expect(formatAudioSeconds(0)).toBe('0:00');
    expect(formatAudioSeconds(9)).toBe('0:09');
    expect(formatAudioSeconds(75)).toBe('1:15');
    expect(formatAudioSeconds(3600)).toBe('60:00');
  });

  it('treats missing and negative durations as zero', () => {
    expect(formatAudioSeconds(undefined)).toBe('0:00');
    expect(formatAudioSeconds(-5)).toBe('0:00');
  });

  it('keeps a scrub position inside the clip', () => {
    expect(clampAudioSeconds(-3, 30)).toBe(0);
    expect(clampAudioSeconds(45, 30)).toBe(30);
    expect(clampAudioSeconds(12, 30)).toBe(12);
  });

  it('never returns a position past a zero-length clip', () => {
    expect(clampAudioSeconds(10, 0)).toBe(0);
    expect(clampAudioSeconds(10, -4)).toBe(0);
  });
});

describe('formatMessageDateTime', () => {
  it('returns nothing for an unparseable timestamp', () => {
    expect(formatMessageDateTime('not a date')).toBe('');
    expect(formatMessageDateTime('')).toBe('');
  });

  it('renders a real timestamp as date and time', () => {
    const formatted = formatMessageDateTime('2026-08-29T14:05:00.000Z');

    expect(formatted).not.toBe('');
    expect(formatted).toContain(',');
  });
});

describe('getMediaTransferLabel', () => {
  it('names each stage of a transfer', () => {
    expect(getMediaTransferLabel(media({ transferStatus: 'queued' }))).toBe('Queued');
    expect(getMediaTransferLabel(media({ transferStatus: 'preparing' }))).toBe('Preparing');
    expect(getMediaTransferLabel(media({ transferStatus: 'uploading' }))).toBe('Sending');
    expect(getMediaTransferLabel(media({ transferStatus: 'downloading' }))).toBe('Downloading');
    expect(getMediaTransferLabel(media({ transferStatus: 'failed' }))).toBe('Failed');
  });

  it('says nothing once the media is available', () => {
    expect(getMediaTransferLabel(media({ transferStatus: 'available' }))).toBe('');
    expect(getMediaTransferLabel(media())).toBe('');
  });
});

describe('getMediaPreviewUri', () => {
  it('draws a photo from its local file', () => {
    expect(getMediaPreviewUri(media({ localUri: 'file:///photo.jpg' }))).toBe('file:///photo.jpg');
  });

  it('falls back to a photo thumbnail before it has been downloaded', () => {
    expect(getMediaPreviewUri(media({ thumbnailDataUrl: 'data:image/jpeg;base64,abc' })))
      .toBe('data:image/jpeg;base64,abc');
  });

  it('never points at a video file itself', () => {
    // A video handed to an Image renders a broken tile. This is why the Library
    // showed crosses instead of posters.
    expect(getMediaPreviewUri(media({
      kind: 'video',
      localUri: 'file:///clip.mp4',
      thumbnailDataUrl: 'data:image/jpeg;base64,poster'
    }))).toBe('data:image/jpeg;base64,poster');
  });

  it('returns nothing for a video with no poster', () => {
    expect(getMediaPreviewUri(media({ kind: 'video', localUri: 'file:///clip.mp4' }))).toBe('');
  });

  it('returns nothing when there is no media', () => {
    expect(getMediaPreviewUri(null)).toBe('');
  });
});

describe('resolveBubbleMediaUri', () => {
  const poster = 'data:image/jpeg;base64,poster';

  it('draws a video from its poster, never from the video file', () => {
    // Pointing an Image at an mp4 draws nothing and on iOS reports no error,
    // so trying the file first left every video bubble empty for good.
    expect(resolveBubbleMediaUri({
      fallbackUri: poster,
      failedUris: [],
      kind: 'video',
      sourceUri: 'file:///clip.mp4'
    })).toBe(poster);
  });

  it('shows a video placeholder when there is no poster', () => {
    expect(resolveBubbleMediaUri({
      fallbackUri: '',
      failedUris: [],
      kind: 'video',
      sourceUri: 'file:///clip.mp4'
    })).toBe('');
  });

  it('never falls back to the video file when the poster is corrupt', () => {
    expect(resolveBubbleMediaUri({
      fallbackUri: poster,
      failedUris: [poster],
      kind: 'video',
      sourceUri: 'file:///clip.mp4'
    })).toBe('');
  });

  it('draws a photo from its own file', () => {
    expect(resolveBubbleMediaUri({
      fallbackUri: poster,
      failedUris: [],
      kind: 'image',
      sourceUri: 'file:///photo.jpg'
    })).toBe('file:///photo.jpg');
  });

  it('falls back to a photo thumbnail when the file is not on this device', () => {
    expect(resolveBubbleMediaUri({
      fallbackUri: poster,
      failedUris: ['file:///photo.jpg'],
      kind: 'image',
      sourceUri: 'file:///photo.jpg'
    })).toBe(poster);
  });

  it('uses the photo thumbnail while the file has not arrived yet', () => {
    expect(resolveBubbleMediaUri({
      fallbackUri: poster,
      failedUris: [],
      kind: 'image',
      sourceUri: ''
    })).toBe(poster);
  });
});
