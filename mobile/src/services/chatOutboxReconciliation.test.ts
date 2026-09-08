import { describe, expect, it, vi } from 'vitest';

const paths = vi.hoisted(() => ({
  cacheDirectory: 'file:///var/mobile/Containers/Data/Application/NEW/Library/Caches/'
}));

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: paths.cacheDirectory,
  documentDirectory: 'file:///var/mobile/Containers/Data/Application/NEW/Documents/'
}));

import type { ChatMediaAttachment, ChatMessage } from './chatApi';
import {
  applySyncedPendingMessageToVisible,
  buildMissingLocalMediaState,
  buildUploadedMediaState,
  reconcileSyncedPendingMessage,
  resolveMissingLocalMediaAction
} from './chatOutboxReconciliation';

const LOCAL_URI = `${paths.cacheDirectory}Synzapp/Media/clip.mp4`;

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    deliveryStatus: 'sent',
    isMine: true,
    messageId: 'envelope-1',
    senderUid: 'me',
    sentAt: '2026-08-29T10:00:00.000Z',
    text: '',
    ...overrides
  };
}

function video(overrides: Partial<ChatMediaAttachment> = {}): ChatMediaAttachment {
  return {
    contentType: 'video/mp4',
    fileName: 'clip.mp4',
    kind: 'video',
    sizeBytes: 2048,
    ...overrides
  } as ChatMediaAttachment;
}

/**
 * R3 — the outbox record was dropped before the accepted message reached the
 * cache, so a refresh landing in that gap rebuilt the thread from two places
 * that both lacked it. The bubble vanished and came back.
 */
describe('R3: an accepted message is never in neither place', () => {
  it('carries the client identity onto the server copy', () => {
    const { sentMessage } = reconcileSyncedPendingMessage({
      cachedMessages: [],
      pendingQueueId: 'queued_1',
      sentMessage: message({ messageId: 'envelope-abc' }),
      visibleMessages: [message({
        clientMessageId: 'queued_1',
        deliveryStatus: 'queued',
        messageId: 'queued_1'
      })]
    });

    expect(sentMessage.clientMessageId).toBe('queued_1');
  });

  it('replaces the queued copy rather than adding a second row', () => {
    const queued = message({
      clientMessageId: 'queued_1',
      deliveryStatus: 'queued',
      messageId: 'queued_1'
    });

    const { nextCachedMessages } = reconcileSyncedPendingMessage({
      cachedMessages: [queued],
      pendingQueueId: 'queued_1',
      sentMessage: message({ messageId: 'envelope-abc' }),
      visibleMessages: [queued]
    });

    expect(nextCachedMessages).toHaveLength(1);
    expect(nextCachedMessages[0].deliveryStatus).toBe('sent');
  });

  it('persists the accepted message, so it survives a refresh', () => {
    const { messagesToPersist } = reconcileSyncedPendingMessage({
      cachedMessages: [],
      pendingQueueId: 'queued_1',
      sentMessage: message({ messageId: 'envelope-abc' }),
      visibleMessages: []
    });

    expect(messagesToPersist).toHaveLength(1);
    expect(messagesToPersist[0].messageId).toBe('envelope-abc');
  });

  it('never writes a still-queued message into the conversation cache', () => {
    const otherQueued = message({
      clientMessageId: 'queued_2',
      deliveryStatus: 'queued',
      messageId: 'queued_2',
      sentAt: '2026-08-29T10:05:00.000Z'
    });

    const { messagesToPersist, nextCachedMessages } = reconcileSyncedPendingMessage({
      cachedMessages: [otherQueued],
      pendingQueueId: 'queued_1',
      sentMessage: message({ messageId: 'envelope-abc' }),
      visibleMessages: []
    });

    expect(nextCachedMessages).toHaveLength(2);
    expect(messagesToPersist.map((item) => item.messageId)).toEqual(['envelope-abc']);
  });

  it('keeps the local file the server copy knows nothing about', () => {
    const queued = message({
      clientMessageId: 'queued_1',
      deliveryStatus: 'queued',
      media: video({ localUri: LOCAL_URI }),
      messageId: 'queued_1'
    });

    const { sentMessage } = reconcileSyncedPendingMessage({
      cachedMessages: [],
      pendingQueueId: 'queued_1',
      sentMessage: message({ media: video({ mediaId: 'm1' }), messageId: 'envelope-abc' }),
      visibleMessages: [queued]
    });

    expect(sentMessage.media?.localUri).toBe(LOCAL_URI);
    expect(sentMessage.media?.transferStatus).toBe('available');
  });

  it('does not attach a local file belonging to different media', () => {
    const queued = message({
      clientMessageId: 'queued_1',
      media: video({ fileName: 'other.mp4', localUri: LOCAL_URI, sizeBytes: 999 }),
      messageId: 'queued_1'
    });

    const { sentMessage } = reconcileSyncedPendingMessage({
      cachedMessages: [],
      pendingQueueId: 'queued_1',
      sentMessage: message({ media: video({ mediaId: 'm1' }), messageId: 'envelope-abc' }),
      visibleMessages: [queued]
    });

    expect(sentMessage.media?.localUri).toBeUndefined();
  });

  it('swaps the visible row without leaving a duplicate', () => {
    const visible = [message({
      clientMessageId: 'queued_1',
      deliveryStatus: 'queued',
      messageId: 'queued_1'
    })];

    const result = applySyncedPendingMessageToVisible(
      visible,
      'queued_1',
      message({ clientMessageId: 'queued_1', messageId: 'envelope-abc' })
    );

    expect(result).toHaveLength(1);
    expect(result[0].deliveryStatus).toBe('sent');
  });
});

/**
 * R9 — upload completion updated the screen but never the cached message, which
 * kept saying "preparing". Reopening the app showed a progress ring over an
 * already-sent video.
 */
describe('R9: a finished upload records that it finished', () => {
  it('reports available at full progress', () => {
    const state = buildUploadedMediaState(video({ transferProgress: 0.4, transferStatus: 'uploading' }));

    expect(state.transferStatus).toBe('available');
    expect(state.transferProgress).toBe(1);
  });

  it('keeps the identifiers needed to fetch the media again later', () => {
    const state = buildUploadedMediaState(video({ key: 'k', mediaId: 'm1' }));

    expect(state.mediaId).toBe('m1');
    expect(state.key).toBe('k');
  });
});

/**
 * R7 — a stored path that no longer resolved blocked re-download forever, so a
 * purged or relocated file left a permanently blank tile.
 */
describe('R7: media that is gone is fetched again', () => {
  it('leaves a resolving path alone', () => {
    expect(resolveMissingLocalMediaAction({
      canRedownload: true,
      resolvedUri: LOCAL_URI,
      storedUri: LOCAL_URI
    })).toBe('keep');
  });

  it('records the corrected path when the file only moved', () => {
    expect(resolveMissingLocalMediaAction({
      canRedownload: true,
      resolvedUri: LOCAL_URI,
      storedUri: 'file:///var/mobile/Containers/Data/Application/OLD/Library/Caches/Synzapp/Media/clip.mp4'
    })).toBe('rebase');
  });

  it('re-downloads when the file is genuinely gone', () => {
    expect(resolveMissingLocalMediaAction({
      canRedownload: true,
      resolvedUri: null,
      storedUri: LOCAL_URI
    })).toBe('redownload');
  });

  it('does nothing when the media cannot be fetched again', () => {
    expect(resolveMissingLocalMediaAction({
      canRedownload: false,
      resolvedUri: null,
      storedUri: LOCAL_URI
    })).toBe('ignore');
  });

  it('clears the dead path so normal hydration can take over', () => {
    const state = buildMissingLocalMediaState(video({
      localUri: LOCAL_URI,
      transferProgress: 1,
      transferStatus: 'available'
    }));

    expect(state.localUri).toBeUndefined();
    expect(state.transferStatus).toBeUndefined();
    expect(state.mediaId).toBe(video().mediaId);
  });
});
