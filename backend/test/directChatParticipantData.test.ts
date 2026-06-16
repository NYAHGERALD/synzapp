import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildDirectChatParticipantData } from '../src/services/encryptedMessageEnvelopeService.ts';

describe('direct chat participant metadata', () => {
  it('builds stable participant fields for direct-chat membership queries', () => {
    assert.deepEqual(buildDirectChatParticipantData('user_b', 'user_a'), {
      participantIds: ['user_a', 'user_b'],
      participants: {
        user_a: true,
        user_b: true
      }
    });
  });
});
