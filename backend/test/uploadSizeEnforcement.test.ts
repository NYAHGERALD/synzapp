import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const read = (...parts: string[]) => readFileSync(resolve(backendRoot, ...parts), 'utf8');

const chatMedia = read('src', 'services', 'chatMediaService.ts');
const railsService = read('src', 'services', 'railsService.ts');

describe('an upload is measured, not declared', () => {
  it('reads the stored object size when the upload completes', () => {
    /**
     * The limit was checked once, at request time, against a number the client
     * sent — and the signed write URL carries no size range, so nothing ever
     * compared it to the object that actually arrived. A caller could declare a
     * megabyte and upload as much as they liked.
     */
    assert.match(chatMedia, /getMetadata\(\)/);
    assert.match(chatMedia, /uploadedSizeBytes > allowedEncryptedBytes/);
  });

  it('removes a file that is over the limit rather than keeping it', () => {
    // Already in the bucket means it is paid for by a company that never agreed
    // to hold it.
    assert.match(chatMedia, /uploadedSizeBytes > allowedEncryptedBytes[\s\S]{0,200}delete\(\)/);
  });

  it('still checks an upload that predates the stored limit', () => {
    // A pending record written before this change has no stored limit, and must
    // not therefore skip the check.
    assert.match(chatMedia, /CHAT_MEDIA_LIMITS\[record\.kind as ChatMediaKind\]/);
  });

  it('matches the check RAILS evidence already does', () => {
    // The pattern was understood and simply not applied to chat media.
    assert.match(railsService, /getMetadata\(\)[\s\S]{0,400}sizeBytes > policy\.maxFileBytes/);
  });
});
