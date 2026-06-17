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
      /envelopesQuery = envelopesQuery\.where\('sentAtMs', '>', preference\.clearedAtMs\)/,
      'Direct chat reads must not load the oldest deleted envelopes before filtering cleared history.'
    );
    assert.match(directEnvelopeService, /envelopesQuery = envelopesQuery\.orderBy\('sentAtMs', 'asc'\)/);
  });

  it('queries group envelopes after the user clear timestamp before applying the read limit', () => {
    assert.match(
      groupChatService,
      /envelopesQuery = envelopesQuery\.where\('sentAtMs', '>', preference\.clearedAtMs\)/,
      'Group chat reads must not load the oldest deleted envelopes before filtering cleared history.'
    );
    assert.match(groupChatService, /envelopesQuery = envelopesQuery\.orderBy\('sentAtMs', 'asc'\)/);
  });

  it('revives stale spam and permanent-delete markers without forcing archive policy', () => {
    assert.match(directEnvelopeService, /reviveChatUserPreferenceInTransaction/);
    assert.match(preferenceService, /permanentlyDeletedAt: null/);
    assert.match(preferenceService, /permanentlyDeletedAtMs: null/);
    assert.match(preferenceService, /if \(options\.unarchive\) \{/);
  });

  it('keeps read-only Trash history in explicit 30-day segments', () => {
    assert.match(preferenceService, /TRASH_RETENTION_MS = 30 \* 24 \* 60 \* 60 \* 1000/);
    assert.match(preferenceService, /update\.trashSegments = fieldValue\.arrayUnion/);
    assert.match(directEnvelopeService, /trashSegmentId\?: string \| null/);
    assert.match(directEnvelopeService, /trashSegment\.startAtMs/);
    assert.match(directEnvelopeService, /trashSegment\.endAtMs/);
    assert.match(groupChatService, /trashSegmentId\?: string \| null/);
    assert.match(groupChatService, /trashSegment\.startAtMs/);
    assert.match(groupChatService, /trashSegment\.endAtMs/);
  });
});
