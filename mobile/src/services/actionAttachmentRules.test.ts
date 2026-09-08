import { describe, expect, it } from 'vitest';
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  describeTooLarge,
  isTooLarge,
  toPickedMedia
} from './actionAttachmentRules';

describe('the size limit', () => {
  it('matches the one the server enforces', () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(50 * 1024 * 1024);
  });

  it('lets a normal photo through', () => {
    expect(isTooLarge({ sizeBytes: 3 * 1024 * 1024 })).toBe(false);
  });

  it('stops a file over the limit before it is uploaded', () => {
    expect(isTooLarge({ sizeBytes: 60 * 1024 * 1024 })).toBe(true);
  });

  it('says which file and how big, not just that something failed', () => {
    const message = describeTooLarge({
      contentType: 'video/mp4',
      fileName: 'line5.mp4',
      kind: 'video',
      sizeBytes: 62 * 1024 * 1024,
      uri: 'file:///line5.mp4'
    });

    expect(message).toContain('line5.mp4');
    expect(message).toContain('62 MB');
    expect(message).toContain('50 MB');
  });

  it('caps how many can be attached at once', () => {
    expect(MAX_ATTACHMENTS).toBe(10);
  });
});

describe('reading what the picker returns', () => {
  it('keeps the real type when the picker gives one', () => {
    const media = toPickedMedia({
      fileName: 'fault.png',
      fileSize: 2048,
      mimeType: 'image/png',
      type: 'image',
      uri: 'file:///fault.png'
    } as never);

    expect(media.contentType).toBe('image/png');
    expect(media.kind).toBe('image');
  });

  it('falls back to a sensible type rather than sending an empty one', () => {
    const media = toPickedMedia({ type: 'video', uri: 'file:///clip.mov' } as never);

    expect(media.contentType).toBe('video/mp4');
    expect(media.kind).toBe('video');
  });

  it('always has a name to show, even when the picker gives none', () => {
    const media = toPickedMedia({ type: 'image', uri: 'file:///x.jpg' } as never);

    expect(media.fileName).toBe('photo');
  });

  it('treats an unknown size as zero rather than undefined', () => {
    const media = toPickedMedia({ type: 'image', uri: 'file:///x.jpg' } as never);

    expect(media.sizeBytes).toBe(0);
  });
});
