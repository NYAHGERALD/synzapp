import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canReplaceGroupHistoryKeyGrantPayload,
  isEncryptedGroupHistoryKeyGrantPayload
} from '../src/services/groupChatService.ts';

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

describe('replacing a grant that was sealed wrong', () => {
  it('lets a grant naming its sealer replace one that does not', () => {
    // The broken grants are unopenable AND they hold the slot, so without this
    // every device that already received one stays locked out of that message.
    const broken = JSON.stringify({ ciphertext: 'x'.repeat(24), nonce: 'y'.repeat(16), version: 1 });
    const fixed = JSON.stringify({
      ciphertext: 'x'.repeat(24),
      nonce: 'y'.repeat(16),
      sealedByKeyAgreementPublicKey: 'granter-public-key',
      version: 1
    });

    assert.equal(canReplaceGroupHistoryKeyGrantPayload(broken, fixed), true);
  });

  it('never overwrites a grant that already works', () => {
    const fixed = JSON.stringify({
      ciphertext: 'x'.repeat(24),
      nonce: 'y'.repeat(16),
      sealedByKeyAgreementPublicKey: 'granter-public-key',
      version: 1
    });
    const other = JSON.stringify({
      ciphertext: 'z'.repeat(24),
      nonce: 'w'.repeat(16),
      sealedByKeyAgreementPublicKey: 'someone-else',
      version: 1
    });

    assert.equal(canReplaceGroupHistoryKeyGrantPayload(fixed, other), false);
  });

  it('does not swap one broken grant for another', () => {
    const broken = JSON.stringify({ ciphertext: 'x'.repeat(24), nonce: 'y'.repeat(16), version: 1 });
    const alsoBroken = JSON.stringify({ ciphertext: 'z'.repeat(24), nonce: 'w'.repeat(16), version: 1 });

    assert.equal(canReplaceGroupHistoryKeyGrantPayload(broken, alsoBroken), false);
  });

  it('treats rubbish as not replaceable', () => {
    const fixed = JSON.stringify({
      ciphertext: 'x'.repeat(24),
      nonce: 'y'.repeat(16),
      sealedByKeyAgreementPublicKey: 'granter-public-key',
      version: 1
    });

    assert.equal(canReplaceGroupHistoryKeyGrantPayload('not json', fixed), true);
    assert.equal(canReplaceGroupHistoryKeyGrantPayload(fixed, 'not json'), false);
  });
});
