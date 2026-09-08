import { describe, expect, it } from 'vitest';
import {
  buildCapturedChatMedia,
  describeRecordingLength,
  shouldUnmirrorCapture
} from './chatCameraCapture';

const capturedAtMs = new Date(2026, 8, 6, 5, 13, 34).getTime();

describe('buildCapturedChatMedia', () => {
  it('keeps the frame the camera was showing as the poster', () => {
    // The whole reason the camera runs in the app: nothing is dug back out of
    // the finished file.
    const media = buildCapturedChatMedia({
      capturedAtMs,
      facing: 'back',
      kind: 'video',
      posterDataUrl: 'data:image/jpeg;base64,frame',
      uri: 'file:///clip.mp4'
    });

    expect(media.posterDataUrl).toBe('data:image/jpeg;base64,frame');
    expect(media.fileName).toBe('Synzapp-Video-20260906-051334.mp4');
  });

  it('names a photo and reports it as jpeg', () => {
    const media = buildCapturedChatMedia({
      capturedAtMs,
      facing: 'front',
      height: 1920,
      kind: 'image',
      uri: 'file:///photo.jpg',
      width: 1080
    });

    expect(media.fileName).toBe('Synzapp-Photo-20260906-051334.jpg');
    expect(media.contentType).toBe('image/jpeg');
    expect(media.height).toBe(1920);
    expect(media.width).toBe(1080);
  });

  it('carries no poster rather than an empty one', () => {
    const media = buildCapturedChatMedia({
      capturedAtMs,
      facing: 'back',
      kind: 'video',
      posterDataUrl: '',
      uri: 'file:///clip.mp4'
    });

    expect(media.posterDataUrl).toBeNull();
  });
});

describe('shouldUnmirrorCapture', () => {
  it('flips a selfie back, now that the lens is known', () => {
    expect(shouldUnmirrorCapture({ facing: 'front', kind: 'image' })).toBe(true);
  });

  it('leaves a photo from the back camera alone', () => {
    expect(shouldUnmirrorCapture({ facing: 'back', kind: 'image' })).toBe(false);
  });

  it('never re-encodes a video just to flip it', () => {
    expect(shouldUnmirrorCapture({ facing: 'front', kind: 'video' })).toBe(false);
  });
});

describe('describeRecordingLength', () => {
  it('pads the seconds so the counter does not jump about', () => {
    expect(describeRecordingLength(9)).toBe('0:09');
  });

  it('counts past a minute', () => {
    expect(describeRecordingLength(75)).toBe('1:15');
  });

  it('starts at zero', () => {
    expect(describeRecordingLength(0)).toBe('0:00');
  });

  it('never shows a negative or fractional count', () => {
    expect(describeRecordingLength(-4)).toBe('0:00');
    expect(describeRecordingLength(12.7)).toBe('0:12');
  });
});
