import { describe, expect, it, vi } from 'vitest';

const paths = vi.hoisted(() => ({
  cacheDirectory: 'file:///var/mobile/Containers/Data/Application/NEW/Library/Caches/'
}));

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: paths.cacheDirectory,
  documentDirectory: 'file:///var/mobile/Containers/Data/Application/NEW/Documents/'
}));

import type { ChatMediaAttachment, ChatMessage } from './chatApi';
import { getMessageMedia, getMessageMediaItems } from './chatMessageReconciliation';

interface PendingLike {
  message: ChatMessage;
  queueId: string;
}

function hasPendingMedia(pending: PendingLike): boolean {
  return Boolean(getMessageMedia(pending.message)) ||
    getMessageMediaItems(pending.message).length > 0;
}

/** Mirrors the ordering applied before the outbox is drained. */
function orderPendingForSend(pending: PendingLike[]): PendingLike[] {
  return [
    ...pending.filter((item) => !hasPendingMedia(item)),
    ...pending.filter(hasPendingMedia)
  ];
}

function pending(queueId: string, media?: ChatMediaAttachment): PendingLike {
  return {
    message: {
      deliveryStatus: 'queued',
      isMine: true,
      media: media || null,
      messageId: queueId,
      senderUid: 'me',
      sentAt: '2026-08-29T10:00:00.000Z',
      text: media ? '' : 'hello'
    },
    queueId
  };
}

const VIDEO: ChatMediaAttachment = {
  contentType: 'video/quicktime',
  fileName: 'clip.mov',
  kind: 'video',
  sizeBytes: 146 * 1024 * 1024
} as ChatMediaAttachment;

/**
 * A 146 MB video at the head of the outbox left every message typed after it
 * sitting on "queued" for minutes, because the drain loop awaits each upload in
 * order. A message with no attachment has nothing to wait for.
 */
describe('outbox drain order', () => {
  it('sends a typed message ahead of a large upload already queued', () => {
    const ordered = orderPendingForSend([
      pending('queued_video', VIDEO),
      pending('queued_text')
    ]);

    expect(ordered.map((item) => item.queueId)).toEqual(['queued_text', 'queued_video']);
  });

  it('keeps text in the order it was typed', () => {
    const ordered = orderPendingForSend([
      pending('queued_text_1'),
      pending('queued_video', VIDEO),
      pending('queued_text_2')
    ]);

    expect(ordered.map((item) => item.queueId))
      .toEqual(['queued_text_1', 'queued_text_2', 'queued_video']);
  });

  it('keeps media in the order it was picked', () => {
    const ordered = orderPendingForSend([
      pending('queued_video_1', VIDEO),
      pending('queued_video_2', VIDEO)
    ]);

    expect(ordered.map((item) => item.queueId))
      .toEqual(['queued_video_1', 'queued_video_2']);
  });

  it('treats an album as media', () => {
    const album: PendingLike = {
      message: {
        deliveryStatus: 'queued',
        isMine: true,
        mediaItems: [VIDEO, VIDEO],
        messageId: 'queued_album',
        senderUid: 'me',
        sentAt: '2026-08-29T10:00:00.000Z',
        text: ''
      },
      queueId: 'queued_album'
    };

    expect(orderPendingForSend([album, pending('queued_text')]).map((item) => item.queueId))
      .toEqual(['queued_text', 'queued_album']);
  });
});

/**
 * Taps buffered while the JS thread is blocked all arrive at once. A ref set
 * synchronously is what stops each of them enqueueing its own copy; state would
 * not, because the re-render happens after every tap has already run.
 */
describe('duplicate send guard', () => {
  function makeGuardedSender(send: () => Promise<void>) {
    const isEnqueueing = { current: false };

    return async () => {
      if (isEnqueueing.current) {
        return;
      }

      isEnqueueing.current = true;

      try {
        await send();
      } finally {
        isEnqueueing.current = false;
      }
    };
  }

  it('enqueues once for a burst of taps', async () => {
    const send = vi.fn(async () => { await Promise.resolve(); });
    const guarded = makeGuardedSender(send);

    await Promise.all([guarded(), guarded(), guarded(), guarded()]);

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('allows the next message once the first is enqueued', async () => {
    const send = vi.fn(async () => { await Promise.resolve(); });
    const guarded = makeGuardedSender(send);

    await guarded();
    await guarded();

    expect(send).toHaveBeenCalledTimes(2);
  });

  it('does not wedge if enqueueing throws', async () => {
    const send = vi.fn(async () => { throw new Error('offline'); });
    const guarded = makeGuardedSender(send);

    await expect(guarded()).rejects.toThrow('offline');
    await expect(guarded()).rejects.toThrow('offline');

    expect(send).toHaveBeenCalledTimes(2);
  });
});
