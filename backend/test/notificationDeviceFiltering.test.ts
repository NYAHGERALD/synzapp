import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filterPushTokensForEncryptedEnvelope } from '../src/services/notificationService.ts';

describe('chat notification device filtering', () => {
  const pushTokens = [
    { deviceId: 'device_in_envelope', token: 'push-token-1' },
    { deviceId: 'stale_device', token: 'push-token-2' },
    { deviceId: '', token: 'push-token-3' }
  ];

  it('sends chat pushes only to devices that can decrypt the envelope', () => {
    const filteredTokens = filterPushTokensForEncryptedEnvelope(pushTokens, {
      notificationPreviewByDevice: {
        device_in_envelope: {
          algorithm: 'synzapp-notification-preview-v1'
        },
        stale_device: {
          algorithm: 'synzapp-notification-preview-v1'
        }
      },
      recipientDeviceIds: ['device_in_envelope']
    });

    assert.deepEqual(filteredTokens, [
      { deviceId: 'device_in_envelope', token: 'push-token-1' }
    ]);
  });

  it('keeps legacy push behavior when no envelope device list is available', () => {
    assert.deepEqual(filterPushTokensForEncryptedEnvelope(pushTokens, {}), pushTokens);
  });
});
