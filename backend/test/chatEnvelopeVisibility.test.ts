import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const directEnvelopeService = readFileSync(
  resolve(backendRoot, 'src', 'services', 'encryptedMessageEnvelopeService.ts'),
  'utf8'
);
const groupChatService = readFileSync(
  resolve(backendRoot, 'src', 'services', 'groupChatService.ts'),
  'utf8'
);
const preferenceService = readFileSync(
  resolve(backendRoot, 'src', 'services', 'chatUserPreferenceService.ts'),
  'utf8'
);

describe('encrypted chat visibility after user clear/delete actions', () => {
  it('queries direct envelopes after the user clear timestamp before applying the read limit', () => {
    assert.match(
      directEnvelopeService,
      /where\('sentAtMs', '>', preference\.clearedAtMs\)\s*\.orderBy\('sentAtMs', 'asc'\)/,
      'Direct chat reads must not load the oldest deleted envelopes before filtering cleared history.'
    );
  });

  it('queries group envelopes after the user clear timestamp before applying the read limit', () => {
    assert.match(
      groupChatService,
      /where\('sentAtMs', '>', preference\.clearedAtMs\)\s*\.orderBy\('sentAtMs', 'asc'\)/,
      'Group chat reads must not load the oldest deleted envelopes before filtering cleared history.'
    );
  });

  it('revives stale spam and permanent-delete markers without forcing archive policy', () => {
    assert.match(directEnvelopeService, /reviveChatUserPreferenceInTransaction/);
    assert.match(preferenceService, /permanentlyDeletedAt: null/);
    assert.match(preferenceService, /permanentlyDeletedAtMs: null/);
    assert.match(preferenceService, /if \(options\.unarchive\) \{/);
  });
});
