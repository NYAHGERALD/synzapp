import { describe, expect, it } from 'vitest';
import {
  buildRecordedChatMediaFileName,
  formatChatMediaTimestamp
} from './chatMediaNaming';

/** 6 September 2026, 05:13:34 local time. */
const capturedAtMs = new Date(2026, 8, 6, 5, 13, 34).getTime();

describe('formatChatMediaTimestamp', () => {
  it('puts the most significant part first, so sorting by name sorts by date', () => {
    expect(formatChatMediaTimestamp(capturedAtMs)).toBe('20260906-051334');
  });

  it('pads every part to a fixed width, so names line up and compare', () => {
    expect(formatChatMediaTimestamp(new Date(2026, 0, 2, 3, 4, 5).getTime()))
      .toBe('20260102-030405');
  });
});

describe('buildRecordedChatMediaFileName', () => {
  it('names a recording rather than handing over a row of hex', () => {
    expect(buildRecordedChatMediaFileName({
      capturedAtMs,
      contentType: 'video/mp4',
      kind: 'video'
    })).toBe('Synzapp-Video-20260906-051334.mp4');
  });

  it('names a photo', () => {
    expect(buildRecordedChatMediaFileName({
      capturedAtMs,
      contentType: 'image/jpeg',
      kind: 'image'
    })).toBe('Synzapp-Photo-20260906-051334.jpg');
  });

  it('keeps a quicktime recording honest about what it is', () => {
    expect(buildRecordedChatMediaFileName({
      capturedAtMs,
      contentType: 'video/quicktime',
      kind: 'video'
    })).toBe('Synzapp-Video-20260906-051334.mov');
  });

  it('falls back to mp4 when the camera reports no type', () => {
    expect(buildRecordedChatMediaFileName({
      capturedAtMs,
      contentType: null,
      kind: 'video'
    })).toBe('Synzapp-Video-20260906-051334.mp4');
  });

  it('falls back to jpg for a photo of unknown type', () => {
    expect(buildRecordedChatMediaFileName({
      capturedAtMs,
      contentType: 'image/tiff',
      kind: 'image'
    })).toBe('Synzapp-Photo-20260906-051334.jpg');
  });

  it('never lets an odd content type into the name', () => {
    const name = buildRecordedChatMediaFileName({
      capturedAtMs,
      contentType: 'video/x-matroska; codecs="../../etc"',
      kind: 'video'
    });

    expect(name).toBe('Synzapp-Video-20260906-051334.mp4');
  });
});
