import { describe, expect, it } from 'vitest';
import {
  buildChatMediaPosterKey,
  resolvePosterRotationDegrees,
  settleWithinTimeLimit,
  shouldAttachChatMediaPoster
} from './chatMediaPosterRules';

describe('shouldAttachChatMediaPoster', () => {
  it('makes a poster for a recorded video that has none', () => {
    // The camera path is the one that arrives without a poster, which is why
    // videos recorded on the phone showed an empty bubble.
    expect(shouldAttachChatMediaPoster({
      kind: 'video',
      localUri: 'file:///clip.mp4'
    })).toBe(true);
  });

  it('leaves a video that already has one alone', () => {
    expect(shouldAttachChatMediaPoster({
      kind: 'video',
      localUri: 'file:///clip.mp4',
      thumbnailDataUrl: 'data:image/jpeg;base64,abc'
    })).toBe(false);
  });

  it('never touches a photo, so sending one is not slowed', () => {
    expect(shouldAttachChatMediaPoster({
      kind: 'image',
      localUri: 'file:///photo.jpg'
    })).toBe(false);
  });

  it('never touches a document', () => {
    expect(shouldAttachChatMediaPoster({
      kind: 'file',
      localUri: 'file:///report.pdf'
    })).toBe(false);
  });

  it('does nothing without a file to read a frame from', () => {
    expect(shouldAttachChatMediaPoster({ kind: 'video', localUri: null })).toBe(false);
  });
});

describe('buildChatMediaPosterKey', () => {
  it('gives one key for the same video', () => {
    const media = { fileName: 'clip.mp4', localUri: 'file:///clip.mp4', sizeBytes: 42 };

    expect(buildChatMediaPosterKey(media)).toBe(buildChatMediaPosterKey({ ...media }));
  });

  it('tells two videos apart even when their names run together', () => {
    expect(buildChatMediaPosterKey({ localUri: 'ab', fileName: 'c', sizeBytes: 1 })).not.toBe(
      buildChatMediaPosterKey({ localUri: 'a', fileName: 'bc', sizeBytes: 1 })
    );
  });

  it('tells apart two videos of the same name and different size', () => {
    expect(buildChatMediaPosterKey({ localUri: 'file:///a.mp4', fileName: 'a.mp4', sizeBytes: 1 })).not.toBe(
      buildChatMediaPosterKey({ localUri: 'file:///a.mp4', fileName: 'a.mp4', sizeBytes: 2 })
    );
  });

  it('prefers the media id once the video has one', () => {
    expect(buildChatMediaPosterKey({ localUri: 'file:///a.mp4', mediaId: 'm1' })).not.toBe(
      buildChatMediaPosterKey({ localUri: 'file:///a.mp4', mediaId: 'm2' })
    );
  });

  it('copes with an attachment carrying nothing to identify it', () => {
    expect(buildChatMediaPosterKey({})).toBe('0::0::0');
  });
});

describe('settleWithinTimeLimit', () => {
  it('gives back the real answer when it arrives in time', async () => {
    await expect(
      settleWithinTimeLimit(Promise.resolve('poster'), 'none', 50)
    ).resolves.toBe('poster');
  });

  it('gives up rather than holding the bubble back', async () => {
    const slow = new Promise<string>((resolve) => setTimeout(() => resolve('poster'), 200));

    await expect(settleWithinTimeLimit(slow, 'none', 20)).resolves.toBe('none');
  });

  it('falls back rather than rejecting when the work fails', async () => {
    await expect(
      settleWithinTimeLimit(Promise.reject(new Error('no frame')), 'none', 50)
    ).resolves.toBe('none');
  });

  it('a late answer cannot overwrite the one already given', async () => {
    const slow = new Promise<string>((resolve) => setTimeout(() => resolve('poster'), 40));
    const first = await settleWithinTimeLimit(slow, 'none', 10);

    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(first).toBe('none');
  });
});

describe('resolvePosterRotationDegrees', () => {
  const portraitVideo = { videoHeight: 1920, videoWidth: 1080 };

  it('turns an Android poster by the rotation the file declares', () => {
    // getFrameAtTime hands back the stored landscape frame and never reads the
    // flag, so a portrait recording arrives lying on its side.
    expect(resolvePosterRotationDegrees({
      ...portraitVideo,
      platform: 'android',
      posterHeight: 1080,
      posterWidth: 1920,
      videoRotationDegrees: 90
    })).toBe(90);
  });

  it('handles a video recorded the other way up', () => {
    expect(resolvePosterRotationDegrees({
      ...portraitVideo,
      platform: 'android',
      posterHeight: 1080,
      posterWidth: 1920,
      videoRotationDegrees: 270
    })).toBe(270);
  });

  it('leaves iOS alone, where the generator already turned it', () => {
    expect(resolvePosterRotationDegrees({
      ...portraitVideo,
      platform: 'ios',
      posterHeight: 1080,
      posterWidth: 1920,
      videoRotationDegrees: 90
    })).toBe(0);
  });

  it('leaves a poster the generator already turned upright alone', () => {
    // getFrameAtTime applies the rotation on some devices. Turning it again
    // because the file declares 90 is what put the poster back on its side.
    expect(resolvePosterRotationDegrees({
      ...portraitVideo,
      platform: 'android',
      posterHeight: 1920,
      posterWidth: 1080,
      videoRotationDegrees: 90
    })).toBe(0);
  });

  it('leaves a genuinely landscape Android recording alone', () => {
    expect(resolvePosterRotationDegrees({
      platform: 'android',
      posterHeight: 1080,
      posterWidth: 1920,
      videoHeight: 1080,
      videoRotationDegrees: 0,
      videoWidth: 1920
    })).toBe(0);
  });

  it('falls back to the shapes disagreeing when no flag is reported', () => {
    expect(resolvePosterRotationDegrees({
      ...portraitVideo,
      platform: 'android',
      posterHeight: 1080,
      posterWidth: 1920,
      videoRotationDegrees: null
    })).toBe(90);
  });

  it('does not turn a poster that already agrees with the video', () => {
    expect(resolvePosterRotationDegrees({
      ...portraitVideo,
      platform: 'android',
      posterHeight: 1920,
      posterWidth: 1080,
      videoRotationDegrees: null
    })).toBe(0);
  });

  it('does nothing when a dimension is missing', () => {
    expect(resolvePosterRotationDegrees({
      platform: 'android',
      posterHeight: 0,
      posterWidth: 0,
      videoHeight: 1920,
      videoWidth: 1080
    })).toBe(0);
  });

  it('normalises an angle reported outside one turn', () => {
    expect(resolvePosterRotationDegrees({
      ...portraitVideo,
      platform: 'android',
      posterHeight: 1080,
      posterWidth: 1920,
      videoRotationDegrees: -90
    })).toBe(270);
  });
});
