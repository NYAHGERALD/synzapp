import { describe, expect, it } from 'vitest';
import {
  dedupeDeliveryReceiptTargets,
  readChatDeliveryReceiptTarget,
  readChatPushData
} from './chatDeliveryReceipt';

describe('deciding whether a push deserves a receipt', () => {
  it('reads a direct message', () => {
    expect(readChatDeliveryReceiptTarget({
      contactId: 'sender-uid',
      type: 'chat.message'
    })).toEqual({ chatType: 'DIRECT', contactId: 'sender-uid' });
  });

  it('reads a group message, where the id is the group', () => {
    expect(readChatDeliveryReceiptTarget({
      chatType: 'GROUP',
      contactId: 'group-7',
      type: 'chat.message'
    })).toEqual({ chatType: 'GROUP', contactId: 'group-7' });
  });

  it('ignores a push that is not a chat message', () => {
    expect(readChatDeliveryReceiptTarget({
      contactId: 'sender-uid',
      type: 'call.incoming'
    })).toBeNull();
  });

  it('ignores one with no conversation on it', () => {
    expect(readChatDeliveryReceiptTarget({ type: 'chat.message' })).toBeNull();
    expect(readChatDeliveryReceiptTarget({ contactId: '   ', type: 'chat.message' })).toBeNull();
  });

  it('returns null rather than throwing on rubbish', () => {
    // It runs headless, where a thrown error just kills the task silently.
    for (const bad of [null, undefined, 'string', 42, [], true]) {
      expect(readChatDeliveryReceiptTarget(bad)).toBeNull();
    }
  });

  it('treats an unknown chat type as direct rather than dropping it', () => {
    expect(readChatDeliveryReceiptTarget({
      chatType: 'SOMETHING_NEW',
      contactId: 'sender-uid',
      type: 'chat.message'
    })?.chatType).toBe('DIRECT');
  });
});

describe('finding the data inside a push', () => {
  it('takes it plainly when the task is handed the data itself', () => {
    const data = { contactId: 'a', type: 'chat.message' };

    expect(readChatPushData(data)).toEqual(data);
  });

  it('finds it nested, which is the shape iOS delivers', () => {
    const data = { contactId: 'a', type: 'chat.message' };

    expect(readChatPushData({ data })).toEqual(data);
    expect(readChatPushData({ notification: { request: {} }, body: data })).toEqual(data);
  });

  it('finds it however deeply it is wrapped', () => {
    const data = { contactId: 'a', type: 'chat.message' };

    expect(readChatPushData({ data: { body: data } })).toEqual(data);
  });

  it('is null when there is no chat message in there', () => {
    expect(readChatPushData({ data: { type: 'call.incoming' } })).toBeNull();
    expect(readChatPushData(null)).toBeNull();
    expect(readChatPushData({})).toBeNull();
  });
});

describe('not acknowledging the same conversation twice', () => {
  it('keeps one receipt per conversation', () => {
    expect(dedupeDeliveryReceiptTargets([
      { chatType: 'DIRECT', contactId: 'a' },
      { chatType: 'DIRECT', contactId: 'a' },
      { chatType: 'DIRECT', contactId: 'b' }
    ])).toEqual([
      { chatType: 'DIRECT', contactId: 'a' },
      { chatType: 'DIRECT', contactId: 'b' }
    ]);
  });

  it('does not confuse a group with a person of the same id', () => {
    expect(dedupeDeliveryReceiptTargets([
      { chatType: 'DIRECT', contactId: 'x' },
      { chatType: 'GROUP', contactId: 'x' }
    ])).toHaveLength(2);
  });

  it('copes with nothing', () => {
    expect(dedupeDeliveryReceiptTargets([])).toEqual([]);
  });
});
