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
  getChatMessageRowKey,
  getMediaLocalUri,
  mergeChatMessageMedia,
  mergeChatMessageWithLocalState,
  uniqueChatMessages,
  withPendingChatMessages
} from './chatMessageReconciliation';

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    deliveryStatus: 'sent',
    isMine: true,
    messageId: 'server-1',
    senderUid: 'me',
    sentAt: '2026-08-29T10:00:00.000Z',
    text: 'hello',
    ...overrides
  };
}

function media(overrides: Partial<ChatMediaAttachment> = {}): ChatMediaAttachment {
  return {
    contentType: 'image/jpeg',
    fileName: 'photo.jpg',
    kind: 'image',
    sizeBytes: 1024,
    ...overrides
  } as ChatMediaAttachment;
}

/**
 * The defects these cover all reached a real device before anyone noticed.
 * Each test is named for the behaviour a user saw, not the function under test.
 */
describe('chat message reconciliation', () => {
  // R2 — the same outgoing media rendered twice, then one copy vanished.
  it('R2: collapses a queued message and its server echo into one row', () => {
    const queued = message({
      clientMessageId: 'queued_1',
      deliveryStatus: 'queued',
      messageId: 'queued_1'
    });
    const echo = message({
      clientMessageId: 'queued_1',
      deliveryStatus: 'sent',
      messageId: 'envelope-abc'
    });

    const result = uniqueChatMessages([queued, echo]);

    expect(result).toHaveLength(1);
    expect(result[0].deliveryStatus).toBe('sent');
  });

  // R2 — a changing key remounts the row, which is what made bubbles blink.
  it('R2: keeps the list-row key stable across the queued to sent transition', () => {
    const queued = message({ clientMessageId: 'queued_1', messageId: 'queued_1' });
    const sent = message({ clientMessageId: 'queued_1', messageId: 'envelope-abc' });

    expect(getChatMessageRowKey(queued)).toBe(getChatMessageRowKey(sent));
  });

  // R4 — history cached before clientMessageId existed must not duplicate
  // against a freshly fetched copy that carries one.
  it('R4: collapses rows that agree on either identifier', () => {
    const cachedBeforeClientIds = message({ messageId: 'envelope-abc' });
    const fetchedWithClientId = message({
      clientMessageId: 'queued_1',
      messageId: 'envelope-abc'
    });

    expect(uniqueChatMessages([cachedBeforeClientIds, fetchedWithClientId])).toHaveLength(1);
  });

  // R1 — a contact event rebuilt the thread from cache and erased in-flight sends.
  it('R1: keeps an in-flight message when a cache-derived list is rebuilt', () => {
    const cached = [message({ messageId: 'envelope-old', sentAt: '2026-08-29T09:00:00.000Z' })];
    const outbox = [message({
      clientMessageId: 'queued_1',
      deliveryStatus: 'queued',
      messageId: 'queued_1',
      sentAt: '2026-08-29T10:00:00.000Z'
    })];

    const result = withPendingChatMessages(cached, outbox);

    expect(result).toHaveLength(2);
    expect(result.some((item) => item.messageId === 'queued_1')).toBe(true);
  });

  it('R1: leaves the list untouched when the outbox is empty', () => {
    const cached = [message()];

    expect(withPendingChatMessages(cached, [])).toBe(cached);
  });

  // R14 — every merge allocated fresh objects, so memoized rows re-rendered
  // for messages that had not changed at all.
  it('R14: returns the existing object when a merge changes nothing', () => {
    const existing = message();
    const identical = message();

    expect(mergeChatMessageWithLocalState(existing, identical)).toBe(existing);
  });

  it('R14: returns the new object when something actually changed', () => {
    const existing = message({ deliveryStatus: 'sent' });
    const updated = message({ deliveryStatus: 'read' });

    expect(mergeChatMessageWithLocalState(existing, updated)).not.toBe(existing);
  });

  // The server has no idea the recipient already downloaded the media, so a
  // naive overwrite blanks a photo the user is looking at.
  it('keeps a downloaded local file when the server copy has none', () => {
    const local = media({ localUri: `${paths.cacheDirectory}Synzapp/Media/photo.jpg` });
    const fromServer = media({ mediaId: 'm1' });

    const merged = mergeChatMessageMedia(local, fromServer);

    expect(merged?.localUri).toContain('photo.jpg');
    expect(merged?.transferStatus).toBe('available');
  });

  it('does not mark media available while it is still uploading', () => {
    const uploading = media({
      localUri: `${paths.cacheDirectory}Synzapp/Media/photo.jpg`,
      transferStatus: 'uploading'
    });

    expect(mergeChatMessageMedia(uploading, media({ mediaId: 'm1' }))?.transferStatus)
      .toBe('uploading');
  });

  // R6 — thumbnails went black after reinstall because the stored absolute path
  // named a container that no longer existed.
  it('R6: re-roots a media path written under a previous app container', () => {
    const stale = media({
      localUri: 'file:///var/mobile/Containers/Data/Application/OLD/Library/Caches/Synzapp/Media/photo.jpg'
    });

    expect(getMediaLocalUri(stale)).toBe(`${paths.cacheDirectory}Synzapp/Media/photo.jpg`);
  });

  it('R6: resolves a portable media reference', () => {
    const portable = media({ localUri: 'synzapp-media://photo.jpg' });

    expect(getMediaLocalUri(portable)).toBe(`${paths.cacheDirectory}Synzapp/Media/photo.jpg`);
  });

  // R15 — the bubble showed Queued, Sent, Queued, Sent. An accepted message
  // keeps an outbox copy until the replacing write lands, and that copy still
  // reads "queued". Merging it in last overwrote the accepted status.
  it('R15: does not let a stale outbox copy un-send an accepted message', () => {
    const accepted = message({
      clientMessageId: 'queued_1',
      deliveryStatus: 'sent',
      messageId: 'envelope-abc'
    });
    const staleOutboxCopy = message({
      clientMessageId: 'queued_1',
      deliveryStatus: 'queued',
      messageId: 'queued_1'
    });

    const result = withPendingChatMessages([accepted], [staleOutboxCopy]);

    expect(result).toHaveLength(1);
    expect(result[0].deliveryStatus).toBe('sent');
  });

  it('R15: still lets delivery advance past sent', () => {
    const sent = message({ clientMessageId: 'c1', deliveryStatus: 'sent' });
    const read = message({ clientMessageId: 'c1', deliveryStatus: 'read' });

    expect(mergeChatMessageWithLocalState(sent, read).deliveryStatus).toBe('read');
  });

  it('R15: does not regress read back to delivered', () => {
    const read = message({ clientMessageId: 'c1', deliveryStatus: 'read' });
    const delivered = message({ clientMessageId: 'c1', deliveryStatus: 'delivered' });

    expect(mergeChatMessageWithLocalState(read, delivered).deliveryStatus).toBe('read');
  });

  it('R15: a message that never sent still shows as queued', () => {
    const queued = message({ clientMessageId: 'c1', deliveryStatus: 'queued' });
    const stillQueued = message({ clientMessageId: 'c1', deliveryStatus: 'queued' });

    expect(mergeChatMessageWithLocalState(queued, stillQueued).deliveryStatus).toBe('queued');
  });

  it('orders a thread by sent time regardless of input order', () => {
    const later = message({ messageId: 'b', sentAt: '2026-08-29T11:00:00.000Z' });
    const earlier = message({ messageId: 'a', sentAt: '2026-08-29T09:00:00.000Z' });

    expect(uniqueChatMessages([later, earlier]).map((item) => item.messageId))
      .toEqual(['a', 'b']);
  });
});

describe('undecryptable placeholders', () => {
  it('is replaced once the message can be read', () => {
    const placeholder: ChatMessage = {
      decryptionFailed: true,
      deliveryStatus: 'delivered',
      isMine: false,
      messageId: 'envelope-1',
      senderUid: 'them',
      sentAt: '2026-08-29T10:00:00.000Z',
      text: ''
    };
    const readable: ChatMessage = {
      ...placeholder,
      decryptionFailed: false,
      text: 'Good morning'
    };
    const merged = mergeChatMessageWithLocalState(placeholder, readable);

    // The merge spreads the new message over the old, so the flag has to be
    // written explicitly on success — an omitted field would leave the
    // placeholder's `true` in place and the message would still read as broken.
    expect(merged.decryptionFailed).toBe(false);
    expect(merged.text).toBe('Good morning');
  });

  it('does not collapse into a duplicate bubble', () => {
    const placeholder: ChatMessage = {
      decryptionFailed: true,
      deliveryStatus: 'delivered',
      isMine: false,
      messageId: 'envelope-1',
      senderUid: 'them',
      sentAt: '2026-08-29T10:00:00.000Z',
      text: ''
    };
    const readable: ChatMessage = { ...placeholder, decryptionFailed: false, text: 'Good morning' };

    expect(uniqueChatMessages([placeholder, readable])).toHaveLength(1);
  });
});
