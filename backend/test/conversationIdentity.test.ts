import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDirectChatId,
  isCanonicalDirectChatId
} from '../src/services/conversationIdentity.ts';

/**
 * The property the whole fix rests on: a caller can only produce ids for
 * conversations they are part of.
 */

describe('naming a direct conversation', () => {
  it('is the same conversation whichever person is asking', () => {
    assert.equal(buildDirectChatId('uid_a', 'uid_b'), buildDirectChatId('uid_b', 'uid_a'));
  });

  it('differs for a different pair', () => {
    assert.notEqual(buildDirectChatId('uid_a', 'uid_b'), buildDirectChatId('uid_a', 'uid_c'));
  });

  it('cannot be produced without being in it', () => {
    // Alice cannot name the conversation between Bob and Carol, because every
    // id she can build has her own uid in it.
    const bobAndCarol = buildDirectChatId('uid_bob', 'uid_carol');
    const everythingAliceCanName = ['uid_bob', 'uid_carol', 'uid_alice']
      .map((other) => buildDirectChatId('uid_alice', other));

    assert.equal(everythingAliceCanName.includes(bobAndCarol), false);
  });

  it('does not leak either uid into the id', () => {
    const chatId = buildDirectChatId('uid_alice', 'uid_bob');

    assert.equal(chatId.includes('uid_alice'), false);
    assert.equal(chatId.includes('uid_bob'), false);
  });

  it('is stable, so a stored id keeps matching', () => {
    assert.equal(buildDirectChatId('uid_a', 'uid_b'), buildDirectChatId('uid_a', 'uid_b'));
  });

  it('tells a canonical id from a bare uid', () => {
    assert.equal(isCanonicalDirectChatId(buildDirectChatId('uid_a', 'uid_b')), true);
    assert.equal(isCanonicalDirectChatId('uid_b'), false);
    assert.equal(isCanonicalDirectChatId('direct_short'), false);
  });
});
