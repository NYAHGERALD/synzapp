import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isEncryptedChatBackupPayload } from '../src/services/chatBackupService.ts';

describe('encrypted chat backup restore procedure', () => {
  const validBackup = {
    algorithm: 'nacl-secretbox+synzapp-chat-backup-v1',
    backupCreatedAt: '2026-06-08T00:00:00.000Z',
    backupVersion: 1,
    ciphertext: 'encrypted-ciphertext',
    conversationCount: 2,
    keyFingerprint: 'fingerprint',
    messageCount: 12,
    nonce: 'nonce',
    uploadedAt: '2026-06-08T00:01:00.000Z'
  };

  it('accepts only v1 encrypted chat backup payloads', () => {
    assert.equal(isEncryptedChatBackupPayload(validBackup), true);
  });

  it('rejects plaintext-like backup payloads', () => {
    assert.equal(
      isEncryptedChatBackupPayload({
        ...validBackup,
        algorithm: 'plaintext-json'
      }),
      false
    );
  });

  it('rejects incomplete encrypted backup payloads', () => {
    assert.equal(
      isEncryptedChatBackupPayload({
        ...validBackup,
        ciphertext: ''
      }),
      false
    );
  });

  it('rejects unsupported backup versions', () => {
    assert.equal(
      isEncryptedChatBackupPayload({
        ...validBackup,
        backupVersion: 2
      }),
      false
    );
  });
});
