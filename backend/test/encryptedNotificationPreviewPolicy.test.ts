import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pickNotificationPreviewsForRecipientDevices } from '../src/services/encryptedNotificationPreviewPolicy.ts';

describe('encrypted notification preview policy', () => {
  it('keeps only previews for envelope recipient devices', () => {
    assert.deepEqual(
      pickNotificationPreviewsForRecipientDevices(
        {
          recipient_device: { ciphertext: 'recipient-preview' },
          stale_device: { ciphertext: 'stale-preview' },
          sender_device: { ciphertext: 'sender-preview' }
        },
        ['recipient_device']
      ),
      {
        recipient_device: { ciphertext: 'recipient-preview' }
      }
    );
  });

  it('treats missing previews as best-effort instead of blocking the envelope', () => {
    assert.deepEqual(
      pickNotificationPreviewsForRecipientDevices(undefined, ['recipient_device']),
      {}
    );
  });
});
