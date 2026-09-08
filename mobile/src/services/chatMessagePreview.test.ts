import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///var/mobile/Containers/Data/Application/NEW/Library/Caches/',
  documentDirectory: 'file:///var/mobile/Containers/Data/Application/NEW/Documents/'
}));

import type { ChatMediaAttachment, ChatMessage } from './chatApi';
import {
  buildVoiceNoteWaveform,
  formatMediaDuration,
  formatMessageTime,
  getAudioSeekSeconds,
  getChatMessagePreview,
  getChatMessageTextPreview,
  getReadableFileExtension,
  isMediaTransferActive
} from './chatMessagePreview';

function media(overrides: Partial<ChatMediaAttachment> = {}): ChatMediaAttachment {
  return { contentType: 'image/jpeg', fileName: 'photo.jpg', kind: 'image', ...overrides } as ChatMediaAttachment;
}

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    direction: 'out',
    messageId: 'm1',
    sentAt: '2026-08-29T10:00:00.000Z',
    text: '',
    ...overrides
  } as ChatMessage;
}

describe('formatMediaDuration', () => {
  it('renders milliseconds as minutes and padded seconds', () => {
    expect(formatMediaDuration(0)).toBe('0:00');
    expect(formatMediaDuration(9_000)).toBe('0:09');
    expect(formatMediaDuration(75_000)).toBe('1:15');
  });

  it('treats missing and negative durations as zero', () => {
    expect(formatMediaDuration(undefined)).toBe('0:00');
    expect(formatMediaDuration(-1000)).toBe('0:00');
  });
});

describe('formatMessageTime', () => {
  it('returns nothing for an unparseable timestamp', () => {
    expect(formatMessageTime('nonsense')).toBe('');
  });

  it('renders a real timestamp', () => {
    expect(formatMessageTime('2026-08-29T10:00:00.000Z')).not.toBe('');
  });
});

describe('getChatMessageTextPreview', () => {
  it('collapses whitespace to one line', () => {
    expect(getChatMessageTextPreview(message({ text: '  hello\n\n  there  ' }))).toBe('hello there');
  });

  it('returns nothing for a message with no text', () => {
    expect(getChatMessageTextPreview(message())).toBe('');
  });
});

describe('getChatMessagePreview', () => {
  it('prefers the text when there is any', () => {
    expect(getChatMessagePreview(message({
      media: media(),
      text: 'Look at this'
    }))).toBe('Look at this');
  });

  it('counts an album rather than naming one file in it', () => {
    expect(getChatMessagePreview(message({
      mediaItems: [media(), media(), media(), media()]
    }))).toBe('4 items');
  });

  it('names each kind of single attachment', () => {
    expect(getChatMessagePreview(message({ media: media() }))).toBe('Photo');
    expect(getChatMessagePreview(message({ media: media({ kind: 'video' }) }))).toBe('Video');
    expect(getChatMessagePreview(message({ media: media({ kind: 'audio' }) }))).toBe('Voice message');
  });

  it('falls back to a document filename', () => {
    expect(getChatMessagePreview(message({
      media: media({ fileName: 'Q3 budget.pdf', kind: 'file' })
    }))).toBe('Q3 budget.pdf');
  });

  it('names an unnamed document rather than showing nothing', () => {
    expect(getChatMessagePreview(message({
      media: media({ fileName: '', kind: 'file' })
    }))).toBe('File');
  });

  it('returns nothing for an empty message', () => {
    expect(getChatMessagePreview(message())).toBe('');
  });
});

describe('isMediaTransferActive', () => {
  it('is true while a transfer is still running', () => {
    (['queued', 'preparing', 'uploading', 'downloading'] as const).forEach((status) => {
      expect(isMediaTransferActive(media({ transferStatus: status }))).toBe(true);
    });
  });

  it('is false once the transfer has settled', () => {
    expect(isMediaTransferActive(media({ transferStatus: 'available' }))).toBe(false);
    expect(isMediaTransferActive(media({ transferStatus: 'failed' }))).toBe(false);
    expect(isMediaTransferActive(media())).toBe(false);
  });
});

describe('getReadableFileExtension', () => {
  it('reads the extension in capitals', () => {
    expect(getReadableFileExtension('budget.pdf')).toBe('PDF');
    expect(getReadableFileExtension('archive.tar.gz')).toBe('GZ');
  });

  it('shows nothing for a file with no extension', () => {
    // "README".split('.').pop() is "README" — the whole name, not an extension.
    expect(getReadableFileExtension('README')).toBe('');
  });

  it('handles a missing filename', () => {
    expect(getReadableFileExtension(undefined)).toBe('');
    expect(getReadableFileExtension(null)).toBe('');
    expect(getReadableFileExtension('')).toBe('');
  });
});

describe('getAudioSeekSeconds', () => {
  it('maps a tap position to a position in the clip', () => {
    expect(getAudioSeekSeconds(50, 100, 60)).toBe(30);
    expect(getAudioSeekSeconds(0, 100, 60)).toBe(0);
    expect(getAudioSeekSeconds(100, 100, 60)).toBe(60);
  });

  it('keeps a tap outside the bar inside the clip', () => {
    expect(getAudioSeekSeconds(-40, 100, 60)).toBe(0);
    expect(getAudioSeekSeconds(400, 100, 60)).toBe(60);
  });

  it('returns zero before the bar has been measured', () => {
    expect(getAudioSeekSeconds(50, 0, 60)).toBe(0);
    expect(getAudioSeekSeconds(50, 100, 0)).toBe(0);
  });
});

describe('buildVoiceNoteWaveform', () => {
  it('draws the same shape for the same note every time', () => {
    const attachment = media({ kind: 'audio', mediaId: 'voice-1', sizeBytes: 4096 });

    // Seeded, not random: the bars must survive a re-render and a restart.
    expect(buildVoiceNoteWaveform(attachment)).toEqual(buildVoiceNoteWaveform(attachment));
  });

  it('draws different shapes for different notes', () => {
    const first = buildVoiceNoteWaveform(media({ kind: 'audio', mediaId: 'voice-1', sizeBytes: 4096 }));
    const second = buildVoiceNoteWaveform(media({ kind: 'audio', mediaId: 'voice-2', sizeBytes: 8192 }));

    expect(first).not.toEqual(second);
  });

  it('keeps every bar visible and bounded', () => {
    buildVoiceNoteWaveform(media({ kind: 'audio', mediaId: 'voice-1' })).forEach((bar) => {
      expect(bar).toBeGreaterThanOrEqual(6);
      expect(bar).toBeLessThanOrEqual(28);
    });
  });

  it('always draws a full bar set, even with nothing to seed from', () => {
    expect(buildVoiceNoteWaveform(media({ kind: 'audio' }))).toHaveLength(36);
  });
});

describe('undecryptable messages', () => {
  it('says the message is unavailable rather than showing nothing', () => {
    // Returning '' here would leave the chat list showing the previous message
    // while the unread badge counts one the user cannot find.
    expect(getChatMessagePreview(message({ decryptionFailed: true }))).toBe('Message unavailable');
  });

  it('ignores any text carried alongside the failure', () => {
    expect(getChatMessagePreview(message({ decryptionFailed: true, text: 'stale' })))
      .toBe('Message unavailable');
  });

  it('leaves a readable message alone', () => {
    expect(getChatMessagePreview(message({ decryptionFailed: false, text: 'Hello' }))).toBe('Hello');
  });
});
