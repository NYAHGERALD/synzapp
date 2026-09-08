import { describe, expect, it } from 'vitest';
import {
  buildThumbnailKey,
  restoreThumbnails,
  stripThumbnailsForPayload
} from './localChatThumbnailSplit';
import type { ChatMessage } from './chatApi';

const POSTER = 'data:image/jpeg;base64,poster';

function videoMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    deliveryStatus: 'sent',
    isMine: true,
    media: {
      contentType: 'video/mp4',
      fileName: 'clip.mp4',
      kind: 'video',
      sizeBytes: 10,
      thumbnailDataUrl: POSTER
    },
    messageId: 'm1',
    senderUid: 'me',
    sentAt: '2026-09-06T05:00:00.000Z',
    text: '',
    ...overrides
  } as ChatMessage;
}

describe('stripThumbnailsForPayload', () => {
  it('takes the thumbnail out, so it is never sealed twice', () => {
    const stripped = stripThumbnailsForPayload(videoMessage());

    expect(stripped.media?.thumbnailDataUrl).toBeUndefined();
  });

  it('keeps everything else about the attachment', () => {
    const stripped = stripThumbnailsForPayload(videoMessage());

    expect(stripped.media?.fileName).toBe('clip.mp4');
    expect(stripped.media?.kind).toBe('video');
    expect(stripped.media?.sizeBytes).toBe(10);
  });

  it('returns the very same object when there is nothing to take out', () => {
    // A text message must not be copied on every save for no reason.
    const plain = videoMessage({ media: null });

    expect(stripThumbnailsForPayload(plain)).toBe(plain);
  });

  it('strips every item of an album', () => {
    const album = videoMessage({
      media: null,
      mediaItems: [
        { fileName: 'a.jpg', kind: 'image', thumbnailDataUrl: POSTER },
        { fileName: 'b.jpg', kind: 'image', thumbnailDataUrl: POSTER }
      ]
    } as Partial<ChatMessage>);

    const stripped = stripThumbnailsForPayload(album);

    expect(stripped.mediaItems?.every((item) => !item.thumbnailDataUrl)).toBe(true);
  });

  it('does not mutate the message it was given', () => {
    const original = videoMessage();

    stripThumbnailsForPayload(original);

    expect(original.media?.thumbnailDataUrl).toBe(POSTER);
  });
});

describe('restoreThumbnails', () => {
  it('puts the thumbnail back from its own column', () => {
    const stripped = stripThumbnailsForPayload(videoMessage());
    const restored = restoreThumbnails(
      stripped,
      new Map([[buildThumbnailKey('m1', 0), POSTER]])
    );

    expect(restored.media?.thumbnailDataUrl).toBe(POSTER);
  });

  it('leaves a payload written before the split alone', () => {
    // Older rows still carry their own copy, and it wins.
    const restored = restoreThumbnails(
      videoMessage(),
      new Map([[buildThumbnailKey('m1', 0), 'data:image/jpeg;base64,other']])
    );

    expect(restored.media?.thumbnailDataUrl).toBe(POSTER);
  });

  it('restores each album item to its own slot', () => {
    const album = stripThumbnailsForPayload(videoMessage({
      media: null,
      mediaItems: [
        { fileName: 'a.jpg', kind: 'image', thumbnailDataUrl: 'data:image/jpeg;base64,a' },
        { fileName: 'b.jpg', kind: 'image', thumbnailDataUrl: 'data:image/jpeg;base64,b' }
      ]
    } as Partial<ChatMessage>));

    const restored = restoreThumbnails(album, new Map([
      [buildThumbnailKey('m1', 0), 'data:image/jpeg;base64,a'],
      [buildThumbnailKey('m1', 1), 'data:image/jpeg;base64,b']
    ]));

    expect(restored.mediaItems?.map((item) => item.thumbnailDataUrl)).toEqual([
      'data:image/jpeg;base64,a',
      'data:image/jpeg;base64,b'
    ]);
  });

  it('copes with a message whose thumbnail was never stored', () => {
    const stripped = stripThumbnailsForPayload(videoMessage());

    expect(restoreThumbnails(stripped, new Map()).media?.thumbnailDataUrl).toBeUndefined();
  });

  it('never takes another message thumbnail', () => {
    const stripped = stripThumbnailsForPayload(videoMessage());
    const restored = restoreThumbnails(
      stripped,
      new Map([[buildThumbnailKey('somebody-else', 0), POSTER]])
    );

    expect(restored.media?.thumbnailDataUrl).toBeUndefined();
  });
});
