import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { DISPOSITION_GRACE_MS } from '../src/services/dispositionShredderService.ts';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const shredder = readFileSync(
  resolve(backendRoot, 'src', 'services', 'dispositionShredderService.ts'),
  'utf8'
);

describe('destruction is off unless a tenant turns it on', () => {
  it('does nothing when the tenant has not opted in', () => {
    // The cost of a bug here is a customer's records. Nothing recovers them.
    assert.match(shredder, /if \(!await isDispositionShreddingEnabled\(input\.tenantId\)\) \{/);
    assert.match(shredder, /summary\.skippedDisabled = true;/);
  });

  it('requires the flag to be exactly true, not merely present', () => {
    assert.match(shredder, /shreddingEnabled === true/);
  });

  it('reads the setting on every run', () => {
    // So switching it off takes effect at once rather than at the next deploy.
    assert.match(shredder, /export async function isDispositionShreddingEnabled/);
    assert.doesNotMatch(shredder, /const shreddingEnabledCache/);
  });
});

describe('the grace window', () => {
  it('is seven days', () => {
    assert.equal(DISPOSITION_GRACE_MS, 7 * 24 * 60 * 60 * 1000);
  });

  it('is measured from when the admin approved', () => {
    assert.match(shredder, /\(record\.decidedAtMs \|\| nowMs\) \+ DISPOSITION_GRACE_MS/);
  });

  it('leaves a batch alone until the window ends', () => {
    // During the window the content is still readable, searchable and
    // exportable, so an approval given by mistake can be undone.
    assert.match(shredder, /if \(nowMs < graceEndsAtMs\) \{\s*\n\s*summary\.inGrace \+= 1;/);
  });
});

describe('holds are re-checked immediately before destroying', () => {
  it('checks holds inside the run, not only at approval', () => {
    // A batch may have sat for a week. A court order arriving in that week has
    // to win.
    assert.match(shredder, /const activeHolds = await listActiveLegalHolds\(input\.tenantId, nowMs\)/);
  });

  it('returns a held batch to the queue rather than skipping it quietly', () => {
    // A silently skipped batch looks stuck; a withheld one explains itself.
    assert.match(shredder, /state: 'WITHHELD'/);
    assert.match(shredder, /withheldByHoldId: activeHolds\[0\]\.id/);
  });
});

describe('the order things are destroyed in', () => {
  it('removes message envelopes before the media they unlock', () => {
    // Each envelope holds the key for its media, so if this fails part-way what
    // remains is unreadable rather than exposed.
    const envelopes = shredder.indexOf("collection('encryptedEnvelopes')");
    const media = shredder.indexOf("collection('mediaAttachments')");

    assert.ok(envelopes > 0 && media > envelopes, 'envelopes must be deleted before media');
  });

  it('only destroys a subject it can identify', () => {
    // An unrecognised subject reference must destroy nothing at all.
    assert.match(shredder, /if \(!chatRef\) \{\s*\n\s*return;/);
    assert.match(shredder, /return null;/);
  });

  it('deletes the stored attachment bytes, not only their records', () => {
    // Deleting the records alone left every photo, video and voice note in the
    // bucket for ever, so a conversation looked deleted while its content was
    // still there - the opposite of what a retention policy promises.
    assert.match(shredder, /storageBucket\.file\(path\)\.delete\(/);
    assert.match(shredder, /partPaths/);
  });

  it('deletes the files before the records that point at them', () => {
    // The other order loses the paths and orphans the bytes permanently.
    const files = shredder.indexOf('deleteStoredMediaForChat(chatRef)');
    const records = shredder.indexOf("deleteCollectionInBatches(chatRef.collection('mediaAttachments'))");

    assert.ok(files > 0 && records > files, 'stored files must be deleted before their records');
  });

  it('destroys group conversations as well as direct ones', () => {
    // Groups could be queued, approved and marked purged while nothing was
    // actually deleted.
    assert.match(shredder, /startsWith\('group\/'\)/);
    assert.match(shredder, /collection\('groups'\)/);
  });
});

describe('a run reports what it did', () => {
  it('returns counts rather than nothing', () => {
    // A scheduled run that fails silently looks the same as one that worked.
    ['inGrace', 'purged', 'stoppedByHold', 'skippedDisabled'].forEach((field) => {
      assert.match(shredder, new RegExp(`${field}:`));
    });
  });
});
