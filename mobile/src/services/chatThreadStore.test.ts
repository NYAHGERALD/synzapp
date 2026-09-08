import { beforeEach, describe, expect, it, vi } from 'vitest';

const paths = vi.hoisted(() => ({
  cacheDirectory: 'file:///var/mobile/Containers/Data/Application/NEW/Library/Caches/'
}));

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: paths.cacheDirectory,
  documentDirectory: 'file:///var/mobile/Containers/Data/Application/NEW/Documents/'
}));

import type { ChatMediaAttachment, ChatMessage } from './chatApi';
import {
  applyChatMessageMedia,
  reconcileChatThread,
  clearAllChatThreads,
  clearChatThread,
  getChatThread,
  removeChatMessage,
  replaceChatThread,
  setChatThread,
  subscribeChatThread,
  updateChatMessage,
  upsertChatMessages
} from './chatThreadStore';

const CONTACT = 'contact-1';
const LOCAL_URI = `${paths.cacheDirectory}Synzapp/Media/clip.mp4`;

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    deliveryStatus: 'sent',
    isMine: true,
    messageId: 'envelope-1',
    senderUid: 'me',
    sentAt: '2026-08-29T10:00:00.000Z',
    text: 'hello',
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

describe('chat thread store', () => {
  beforeEach(() => {
    clearAllChatThreads();
  });

  it('starts empty and returns a stable empty thread', () => {
    expect(getChatThread(CONTACT)).toEqual([]);
    expect(getChatThread(CONTACT)).toBe(getChatThread('another-contact'));
  });

  it('notifies subscribers when the thread changes', () => {
    const listener = vi.fn();

    subscribeChatThread(CONTACT, listener);
    upsertChatMessages(CONTACT, [message()]);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toHaveLength(1);
  });

  it('notifies only the conversation that changed', () => {
    const watched = vi.fn();
    const other = vi.fn();

    subscribeChatThread(CONTACT, watched);
    subscribeChatThread('contact-2', other);
    upsertChatMessages(CONTACT, [message()]);

    expect(watched).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeChatThread(CONTACT, listener);

    unsubscribe();
    upsertChatMessages(CONTACT, [message()]);

    expect(listener).not.toHaveBeenCalled();
  });

  // Memoized rows compare by identity, so an unchanged write must not notify.
  it('does not notify when a write changes nothing', () => {
    upsertChatMessages(CONTACT, [message()]);

    const listener = vi.fn();
    subscribeChatThread(CONTACT, listener);
    upsertChatMessages(CONTACT, [message()]);

    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps unchanged messages referentially identical', () => {
    upsertChatMessages(CONTACT, [message({ messageId: 'a' })]);
    const before = getChatThread(CONTACT)[0];

    upsertChatMessages(CONTACT, [message({ messageId: 'b', sentAt: '2026-08-29T11:00:00.000Z' })]);
    const after = getChatThread(CONTACT).find((item) => item.messageId === 'a');

    expect(after).toBe(before);
  });

  // The defects that motivated this store, asserted against it directly.
  describe('invariants that used to break', () => {
    it('collapses a queued message and its server echo into one row', () => {
      upsertChatMessages(CONTACT, [message({
        clientMessageId: 'queued_1',
        deliveryStatus: 'queued',
        messageId: 'queued_1'
      })]);
      upsertChatMessages(CONTACT, [message({
        clientMessageId: 'queued_1',
        deliveryStatus: 'sent',
        messageId: 'envelope-abc'
      })]);

      const thread = getChatThread(CONTACT);

      expect(thread).toHaveLength(1);
      expect(thread[0].deliveryStatus).toBe('sent');
    });

    it('never lets a stale copy un-send an accepted message', () => {
      upsertChatMessages(CONTACT, [message({
        clientMessageId: 'queued_1',
        deliveryStatus: 'sent',
        messageId: 'envelope-abc'
      })]);
      upsertChatMessages(CONTACT, [message({
        clientMessageId: 'queued_1',
        deliveryStatus: 'queued',
        messageId: 'queued_1'
      })]);

      expect(getChatThread(CONTACT)[0].deliveryStatus).toBe('sent');
    });

    it('keeps an in-flight message when a loaded thread does not include it', () => {
      upsertChatMessages(CONTACT, [message({
        clientMessageId: 'queued_1',
        deliveryStatus: 'queued',
        messageId: 'queued_1',
        sentAt: '2026-08-29T10:05:00.000Z'
      })]);

      // A load carrying only what the server knows about.
      setChatThread(CONTACT, [message({ messageId: 'envelope-old', sentAt: '2026-08-29T09:00:00.000Z' })]);

      expect(getChatThread(CONTACT).some((item) => item.messageId === 'queued_1')).toBe(true);
    });

    it('keeps a local file the server copy knows nothing about', () => {
      upsertChatMessages(CONTACT, [message({
        clientMessageId: 'c1',
        media: video({ localUri: LOCAL_URI }),
        messageId: 'queued_1'
      })]);
      upsertChatMessages(CONTACT, [message({
        clientMessageId: 'c1',
        media: video({ mediaId: 'm1' }),
        messageId: 'envelope-abc'
      })]);

      expect(getChatThread(CONTACT)[0].media?.localUri).toBe(LOCAL_URI);
    });

    it('re-roots a media path written under a previous app container', () => {
      upsertChatMessages(CONTACT, [message({
        media: video({
          localUri: 'file:///var/mobile/Containers/Data/Application/OLD/Library/Caches/Synzapp/Media/clip.mp4'
        })
      })]);

      expect(getChatThread(CONTACT)[0].media?.localUri).toBe(LOCAL_URI);
    });

    it('orders the thread by sent time', () => {
      upsertChatMessages(CONTACT, [
        message({ messageId: 'b', sentAt: '2026-08-29T11:00:00.000Z' }),
        message({ messageId: 'a', sentAt: '2026-08-29T09:00:00.000Z' })
      ]);

      expect(getChatThread(CONTACT).map((item) => item.messageId)).toEqual(['a', 'b']);
    });
  });

  /**
   * The screen used to filter the queued copy out by hand before adding the
   * accepted one. The store's own rules make that unnecessary — these assert the
   * converted call sites behave the same way the hand-written versions did.
   */
  /**
   * An already-sent photo downloaded itself again when opened. The bubble looked
   * right because the thumbnail travels with the message; the path to the
   * full-size file had been dropped, so opening it fetched a file the device was
   * already storing.
   */
  describe('rebuilding a thread keeps what the device already has', () => {
    it('keeps the local file when the server echo has none', () => {
      upsertChatMessages(CONTACT, [message({
        clientMessageId: 'c1',
        media: video({ localUri: LOCAL_URI, mediaId: 'm1' }),
        messageId: 'envelope-abc'
      })]);

      // The same message as the server describes it: no local file, because the
      // server has no idea this device already holds one.
      reconcileChatThread(CONTACT, [message({
        clientMessageId: 'c1',
        media: video({ mediaId: 'm1' }),
        messageId: 'envelope-abc'
      })]);

      expect(getChatThread(CONTACT)[0].media?.localUri).toBe(LOCAL_URI);
    });

    it('keeps local files across every item of an album', () => {
      upsertChatMessages(CONTACT, [message({
        clientMessageId: 'c1',
        mediaItems: [
          video({ fileName: 'a.mp4', localUri: `${paths.cacheDirectory}Synzapp/Media/a.mp4`, mediaId: 'm1' }),
          video({ fileName: 'b.mp4', localUri: `${paths.cacheDirectory}Synzapp/Media/b.mp4`, mediaId: 'm2' })
        ],
        messageId: 'envelope-abc'
      })]);

      reconcileChatThread(CONTACT, [message({
        clientMessageId: 'c1',
        mediaItems: [
          video({ fileName: 'a.mp4', mediaId: 'm1' }),
          video({ fileName: 'b.mp4', mediaId: 'm2' })
        ],
        messageId: 'envelope-abc'
      })]);

      const items = getChatThread(CONTACT)[0].mediaItems || [];

      expect(items[0].localUri).toContain('a.mp4');
      expect(items[1].localUri).toContain('b.mp4');
    });

    it('still removes a message the caller left out', () => {
      upsertChatMessages(CONTACT, [
        message({ clientMessageId: 'c1', messageId: 'a' }),
        message({ clientMessageId: 'c2', messageId: 'b', sentAt: '2026-08-29T11:00:00.000Z' })
      ]);

      reconcileChatThread(CONTACT, [message({ clientMessageId: 'c1', messageId: 'a' })]);

      expect(getChatThread(CONTACT).map((item) => item.messageId)).toEqual(['a']);
    });

    it('still accepts genuinely newer content', () => {
      upsertChatMessages(CONTACT, [message({ clientMessageId: 'c1', deliveryStatus: 'sent' })]);
      reconcileChatThread(CONTACT, [message({ clientMessageId: 'c1', deliveryStatus: 'read' })]);

      expect(getChatThread(CONTACT)[0].deliveryStatus).toBe('read');
    });
  });

  describe('converted call sites', () => {
    it('upserting an accepted message replaces its queued copy', () => {
      upsertChatMessages(CONTACT, [message({
        clientMessageId: 'queued_1',
        deliveryStatus: 'queued',
        messageId: 'queued_1'
      })]);

      upsertChatMessages(CONTACT, [message({
        clientMessageId: 'queued_1',
        deliveryStatus: 'sent',
        messageId: 'envelope-abc'
      })]);

      const thread = getChatThread(CONTACT);

      expect(thread).toHaveLength(1);
      expect(thread[0].messageId).toBe('envelope-abc');
      expect(thread[0].deliveryStatus).toBe('sent');
    });

    it('upserting an accepted message keeps the media it was sent with', () => {
      upsertChatMessages(CONTACT, [message({
        clientMessageId: 'queued_1',
        deliveryStatus: 'queued',
        media: video({ localUri: LOCAL_URI }),
        messageId: 'queued_1'
      })]);

      upsertChatMessages(CONTACT, [message({
        clientMessageId: 'queued_1',
        deliveryStatus: 'sent',
        media: video({ mediaId: 'm1' }),
        messageId: 'envelope-abc'
      })]);

      expect(getChatThread(CONTACT)[0].media?.localUri).toBe(LOCAL_URI);
    });

    it('replacing a message leaves the rest of the thread untouched', () => {
      upsertChatMessages(CONTACT, [
        message({ clientMessageId: 'c1', messageId: 'a', text: 'first' }),
        message({ clientMessageId: 'c2', messageId: 'b', sentAt: '2026-08-29T11:00:00.000Z', text: 'second' })
      ]);

      const untouchedBefore = getChatThread(CONTACT)[1];

      updateChatMessage(CONTACT, 'c1', (current) => ({ ...current, text: 'replaced' }));

      const thread = getChatThread(CONTACT);

      expect(thread[0].text).toBe('replaced');
      expect(thread[1]).toBe(untouchedBefore);
    });

    it('a media update touches only its own message', () => {
      upsertChatMessages(CONTACT, [
        message({ clientMessageId: 'c1', media: video(), messageId: 'a' }),
        message({ clientMessageId: 'c2', media: video(), messageId: 'b', sentAt: '2026-08-29T11:00:00.000Z' })
      ]);

      const untouchedBefore = getChatThread(CONTACT)[1];

      applyChatMessageMedia(CONTACT, 'c1', video({ localUri: LOCAL_URI }));

      expect(getChatThread(CONTACT)[0].media?.localUri).toBe(LOCAL_URI);
      expect(getChatThread(CONTACT)[1]).toBe(untouchedBefore);
    });

    it('removing a locally deleted message leaves the rest in place', () => {
      upsertChatMessages(CONTACT, [
        message({ clientMessageId: 'c1', messageId: 'a' }),
        message({ clientMessageId: 'c2', messageId: 'b', sentAt: '2026-08-29T11:00:00.000Z' })
      ]);

      removeChatMessage(CONTACT, 'c1');

      expect(getChatThread(CONTACT).map((item) => item.messageId)).toEqual(['b']);
    });
  });

  describe('targeted updates', () => {
    it('updates one message in place', () => {
      upsertChatMessages(CONTACT, [message({ clientMessageId: 'c1', text: 'before' })]);
      updateChatMessage(CONTACT, 'c1', (current) => ({ ...current, text: 'after' }));

      expect(getChatThread(CONTACT)[0].text).toBe('after');
    });

    it('finds a message by its server id as well as its client id', () => {
      upsertChatMessages(CONTACT, [message({ clientMessageId: 'c1', messageId: 'envelope-abc' })]);
      updateChatMessage(CONTACT, 'envelope-abc', (current) => ({ ...current, text: 'found' }));

      expect(getChatThread(CONTACT)[0].text).toBe('found');
    });

    it('applies media to the right album item', () => {
      upsertChatMessages(CONTACT, [message({
        clientMessageId: 'c1',
        mediaItems: [video({ fileName: 'a.mp4' }), video({ fileName: 'b.mp4' })]
      })]);

      applyChatMessageMedia(CONTACT, 'c1', video({ fileName: 'b.mp4', localUri: LOCAL_URI }), 1);

      const items = getChatThread(CONTACT)[0].mediaItems || [];

      expect(items[1].localUri).toBe(LOCAL_URI);
      expect(items[0].localUri).toBeUndefined();
    });

    it('removes a message', () => {
      upsertChatMessages(CONTACT, [message({ clientMessageId: 'c1' })]);
      removeChatMessage(CONTACT, 'c1');

      expect(getChatThread(CONTACT)).toHaveLength(0);
    });

    it('replaces a thread without resurrecting removed messages', () => {
      upsertChatMessages(CONTACT, [
        message({ messageId: 'a' }),
        message({ messageId: 'b', sentAt: '2026-08-29T11:00:00.000Z' })
      ]);

      replaceChatThread(CONTACT, [message({ messageId: 'a' })]);

      expect(getChatThread(CONTACT).map((item) => item.messageId)).toEqual(['a']);
    });

    it('clears a single conversation', () => {
      upsertChatMessages(CONTACT, [message()]);
      clearChatThread(CONTACT);

      expect(getChatThread(CONTACT)).toHaveLength(0);
    });

    it('clears every conversation and tells subscribers', () => {
      const listener = vi.fn();

      upsertChatMessages(CONTACT, [message()]);
      subscribeChatThread(CONTACT, listener);
      clearAllChatThreads();

      expect(getChatThread(CONTACT)).toHaveLength(0);
      expect(listener).toHaveBeenCalledWith([]);
    });
  });
});

describe('reconcileChatThread and messages still being sent', () => {
  beforeEach(() => {
    clearAllChatThreads();
  });

  it('keeps a queued message the caller has not heard of yet', () => {
    // A refresh landing mid-send used to drop the bubble, which then came back
    // when the send finished: shown, gone, shown again.
    upsertChatMessages(CONTACT, [message({ clientMessageId: 'sent-1', messageId: 'm1' })]);
    upsertChatMessages(CONTACT, [message({ clientMessageId: 'queued-1', deliveryStatus: 'queued' })]);

    reconcileChatThread(CONTACT, [message({ clientMessageId: 'sent-1', messageId: 'm1' })]);

    const keys = getChatThread(CONTACT).map((item) => item.clientMessageId);

    expect(keys).toContain('queued-1');
    expect(keys).toContain('sent-1');
  });

  it('still removes a message that was genuinely deleted', () => {
    upsertChatMessages(CONTACT, [
      message({ clientMessageId: 'keep', messageId: 'm1' }),
      message({ clientMessageId: 'gone', messageId: 'm2' })
    ]);

    reconcileChatThread(CONTACT, [message({ clientMessageId: 'keep', messageId: 'm1' })]);

    expect(getChatThread(CONTACT).map((item) => item.clientMessageId)).toEqual(['keep']);
  });

  it('does not duplicate a queued message once the caller lists it', () => {
    upsertChatMessages(CONTACT, [message({ clientMessageId: 'q1', deliveryStatus: 'queued' })]);

    reconcileChatThread(CONTACT, [message({ clientMessageId: 'q1', messageId: 'm9' })]);

    expect(getChatThread(CONTACT)).toHaveLength(1);
  });
});
