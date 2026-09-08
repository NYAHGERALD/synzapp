import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canSeeTypingUpdate, type ChatTypingUpdate } from '../src/services/chatTypingService.ts';

/**
 * Who may be told that somebody is typing.
 *
 * Presence can be told to anybody — being online is not about a conversation.
 * Typing is. Every clause below is a way a person could otherwise learn who a
 * colleague is talking to, which is a thing the product must never leak
 * sideways just because a keystroke is cheap to broadcast.
 */

const direct: ChatTypingUpdate = {
  chatType: 'DIRECT',
  conversationKey: 'anna',
  isTyping: true,
  recipientUids: ['ben'],
  tenantId: 'tenant-1',
  typingName: 'Anna',
  typingUid: 'anna'
};

const group: ChatTypingUpdate = {
  chatType: 'GROUP',
  conversationKey: 'group_bakery',
  isTyping: true,
  recipientUids: null,
  tenantId: 'tenant-1',
  typingName: 'Anna',
  typingUid: 'anna'
};

const ask = (update: ChatTypingUpdate, readerUid: string, visible: string[], tenantId = 'tenant-1') =>
  canSeeTypingUpdate({
    readerTenantId: tenantId,
    readerUid,
    update,
    visibleConversationKeys: new Set(visible)
  });

describe('a direct chat', () => {
  it('tells the person being written to', () => {
    assert.equal(ask(direct, 'ben', ['anna']), true);
  });

  it('tells nobody else, however well they know the typist', () => {
    // The leak this prevents: everybody with Anna in their contacts learning
    // that Anna is talking to somebody, right now.
    assert.equal(ask(direct, 'chris', ['anna']), false);
  });

  it('does not tell the typist about themselves', () => {
    // Otherwise a person's own header lights up as they type.
    assert.equal(ask(direct, 'anna', ['anna']), false);
  });

  it('says nothing to somebody who cannot see that chat at all', () => {
    assert.equal(ask(direct, 'ben', []), false);
  });
});

describe('a group chat', () => {
  it('tells anybody who can see the group', () => {
    // Being able to see it is the same question as being in it.
    assert.equal(ask(group, 'ben', ['group_bakery']), true);
    assert.equal(ask(group, 'chris', ['group_bakery']), true);
  });

  it('says nothing to somebody outside the group', () => {
    assert.equal(ask(group, 'chris', ['group_safety']), false);
  });

  it('still does not echo to the typist', () => {
    assert.equal(ask(group, 'anna', ['group_bakery']), false);
  });
});

describe('across companies', () => {
  it('never crosses a tenant, whatever else matches', () => {
    // Two organizations can hold the same group id. Nothing about one may ever
    // reach the other.
    assert.equal(ask(group, 'ben', ['group_bakery'], 'tenant-2'), false);
    assert.equal(ask(direct, 'ben', ['anna'], 'tenant-2'), false);
  });
});

describe('a notice that somebody stopped', () => {
  it('reaches exactly the same people as the one that started it', () => {
    // Otherwise "typing..." is shown to somebody who is never told it ended.
    const stopped = { ...direct, isTyping: false };

    assert.equal(ask(stopped, 'ben', ['anna']), true);
    assert.equal(ask(stopped, 'chris', ['anna']), false);
  });
});
