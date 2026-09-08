import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  isChatMediaPurgeable,
  isChatMediaRetrievable
} from '../src/services/chatMediaRetentionService.ts';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const retentionService = readFileSync(
  resolve(backendRoot, 'src', 'services', 'chatMediaRetentionService.ts'),
  'utf8'
);

const NOW = Date.UTC(2026, 5, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

describe('the hollow restore', () => {
  it('serves media whose TTL expired while a message still references it', () => {
    // Direct-chat media carried a flat 30-day TTL and the download was refused
    // once it passed, leaving the message in place with nothing to show. This
    // is the exact case the retention plan exists to eliminate.
    const retrievable = isChatMediaRetrievable(
      { expiresAtMs: NOW - 30 * DAY_MS, liveRefCount: 1 },
      NOW
    );

    assert.equal(retrievable, true);
  });

  it('still refuses an expired blob that nothing references', () => {
    const retrievable = isChatMediaRetrievable(
      { expiresAtMs: NOW - DAY_MS, liveRefCount: 0 },
      NOW
    );

    assert.equal(retrievable, false);
  });

  it('serves a blob whose derived retention has not expired', () => {
    const retrievable = isChatMediaRetrievable(
      { derivedRetainUntilMs: NOW + DAY_MS, expiresAtMs: NOW - DAY_MS, liveRefCount: 0 },
      NOW
    );

    assert.equal(retrievable, true);
  });

  it('falls back to the legacy TTL for blobs uploaded before retention existed', () => {
    // These have no reference rows. Without the fallback every historical blob
    // would become unreachable the moment this deployed.
    assert.equal(isChatMediaRetrievable({ expiresAtMs: NOW + DAY_MS }, NOW), true);
    assert.equal(isChatMediaRetrievable({ expiresAtMs: null }, NOW), true);
  });
});

describe('isChatMediaPurgeable', () => {
  it('refuses while any message references the blob', () => {
    const purgeable = isChatMediaPurgeable(
      { derivedRetainUntilMs: NOW - DAY_MS, liveRefCount: 1, purgeAfterMs: NOW - DAY_MS },
      NOW
    );

    assert.equal(purgeable, false);
  });

  it('refuses a blob that must be kept indefinitely', () => {
    const purgeable = isChatMediaPurgeable(
      { derivedRetainUntilMs: NOW - DAY_MS, liveRefCount: 0, purgeAfterMs: null },
      NOW
    );

    assert.equal(purgeable, false);
  });

  it('allows once nothing references it and retention has passed', () => {
    const purgeable = isChatMediaPurgeable(
      { derivedRetainUntilMs: NOW - DAY_MS, liveRefCount: 0, purgeAfterMs: NOW - DAY_MS },
      NOW
    );

    assert.equal(purgeable, true);
  });
});

describe('reference counting invariants', () => {
  it('refuses to count the same envelope twice', () => {
    // Delivery is retried. A double increment keeps bytes alive that nothing
    // references, which is a storage leak rather than a data loss — but it also
    // makes the count untrustworthy, and the count is the whole invariant.
    assert.match(retentionService, /if \(referenceSnapshot\.exists\) \{\s*\n\s*return;/);
  });

  it('refuses to release a reference that was never counted', () => {
    // The dangerous direction: a negative count makes a still-referenced blob
    // look purgeable.
    assert.match(retentionService, /if \(!referenceSnapshot\.exists\) \{\s*\n\s*return;/);
  });

  it('maintains the count inside a transaction', () => {
    assert.match(retentionService, /firestore\.runTransaction/);
  });

  it('never lets an indefinite blob regain a purge date', () => {
    assert.match(retentionService, /input\.purgeAfterMs === null \|\| currentPurgeAfterMs === null/);
  });
});

describe('what the server is told', () => {
  it('documents why media ids travel as plaintext metadata', () => {
    // A reference count cannot be derived from an end-to-end encrypted payload.
    // The disclosure is deliberate and bounded, and the reasoning has to survive
    // in the code rather than only in a plan document.
    assert.match(retentionService, /plaintext metadata/);
    assert.match(retentionService, /deliberate, bounded disclosure/);
  });
});

describe('the fix is actually connected', () => {
  const envelopeService = readFileSync(
    resolve(backendRoot, 'src', 'services', 'encryptedMessageEnvelopeService.ts'),
    'utf8'
  );
  const mediaService = readFileSync(
    resolve(backendRoot, 'src', 'services', 'chatMediaService.ts'),
    'utf8'
  );
  const profileRoutes = readFileSync(
    resolve(backendRoot, 'src', 'routes', 'profileRoutes.ts'),
    'utf8'
  );

  it('accepts the media ids a message uses', () => {
    // They cannot be read from the encrypted payload, so the sender supplies them.
    assert.match(profileRoutes, /mediaIds: z\.array/);
  });

  it('claims that media when a message is sent', () => {
    // This service existed and was never called, so photos kept expiring under
    // live messages while the code to prevent it sat unused.
    assert.match(envelopeService, /await registerChatMediaReferences\(/);
  });

  it('claims media outside the transaction that stores the message', () => {
    // A failure to claim must not lose the message itself.
    const transactionEnd = envelopeService.indexOf('if (transactionDuplicateEnvelope)');
    const claim = envelopeService.indexOf('await registerChatMediaReferences(');

    assert.ok(claim > transactionEnd, 'the claim must run after the message is stored');
  });

  it('serves media that a message still uses', () => {
    assert.match(mediaService, /isChatMediaRetrievable\(record, Date\.now\(\)\)/);
  });

  it('no longer refuses direct media purely for having no expiry', () => {
    // The old rule refused any direct-chat media without an expiry date, which
    // is what made a 31-day-old photo unopenable.
    assert.doesNotMatch(mediaService, /chatType === 'DIRECT' && expiresAtMs === null/);
  });
});
