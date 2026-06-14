import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isEncryptedGroupHistoryKeyGrantPayload } from '../src/services/groupChatService.ts';

describe('encrypted group history key grants', () => {
  const validGrantPayload = JSON.stringify({
    ciphertext: 'encrypted-message-key-payload',
    nonce: 'encrypted-key-nonce',
    version: 1
  });

  it('accepts v1 encrypted message-key grant payloads', () => {
    assert.equal(isEncryptedGroupHistoryKeyGrantPayload(validGrantPayload), true);
  });

  it('rejects plaintext-like history key grants', () => {
    assert.equal(isEncryptedGroupHistoryKeyGrantPayload('plain text message key'), false);
  });

  it('rejects incomplete history key grants', () => {
    assert.equal(
      isEncryptedGroupHistoryKeyGrantPayload(JSON.stringify({
        ciphertext: '',
        nonce: 'encrypted-key-nonce',
        version: 1
      })),
      false
    );
  });

  it('rejects unsupported history key grant versions', () => {
    assert.equal(
      isEncryptedGroupHistoryKeyGrantPayload(JSON.stringify({
        ciphertext: 'encrypted-message-key-payload',
        nonce: 'encrypted-key-nonce',
        version: 2
      })),
      false
    );
  });
});
