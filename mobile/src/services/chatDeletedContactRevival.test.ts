import { describe, expect, it } from 'vitest';
import {
  shouldIgnoreDeletedChatEvent,
  shouldReviveDeletedChat
} from './chatDeletedContactRevival';

describe('shouldReviveDeletedChat', () => {
  it('brings a deleted chat back when a message arrives', () => {
    // The reported bug: the badge appeared, then tapping the chat made it vanish
    // because nothing ever cleared the deletion record.
    expect(shouldReviveDeletedChat({ hasIncomingMessages: true, isLocallyDeleted: true })).toBe(true);
  });

  it('leaves a deleted chat deleted for presence and profile updates', () => {
    // These arrive constantly for every contact. Reviving on them would make a
    // deleted chat reappear on its own.
    expect(shouldReviveDeletedChat({ hasIncomingMessages: false, isLocallyDeleted: true })).toBe(false);
  });

  it('does nothing for a chat that was never deleted', () => {
    expect(shouldReviveDeletedChat({ hasIncomingMessages: true, isLocallyDeleted: false })).toBe(false);
    expect(shouldReviveDeletedChat({ hasIncomingMessages: false, isLocallyDeleted: false })).toBe(false);
  });
});

describe('shouldIgnoreDeletedChatEvent', () => {
  it('drops non-message events for a deleted chat', () => {
    expect(shouldIgnoreDeletedChatEvent({ hasIncomingMessages: false, isLocallyDeleted: true })).toBe(true);
  });

  it('never drops an event carrying messages', () => {
    expect(shouldIgnoreDeletedChatEvent({ hasIncomingMessages: true, isLocallyDeleted: true })).toBe(false);
  });

  it('never drops events for a chat that is not deleted', () => {
    expect(shouldIgnoreDeletedChatEvent({ hasIncomingMessages: false, isLocallyDeleted: false })).toBe(false);
  });

  it('is the exact complement of revival for a deleted chat', () => {
    [true, false].forEach((hasIncomingMessages) => {
      const input = { hasIncomingMessages, isLocallyDeleted: true };

      expect(shouldIgnoreDeletedChatEvent(input)).toBe(!shouldReviveDeletedChat(input));
    });
  });
});
