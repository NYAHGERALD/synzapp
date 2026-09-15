import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { canWriteTranscriptSegment } from '../src/services/transcriptSegmentOwnership.ts';

describe('writing over a stored transcript segment', () => {
  it('lets the first writer create it', () => {
    const decision = canWriteTranscriptSegment({ callerUid: 'user_a', existingOwnerUid: null });

    assert.equal(decision.allowed, true);
  });

  it('lets somebody correct their own segment', () => {
    const decision = canWriteTranscriptSegment({
      callerUid: 'user_a',
      existingOwnerUid: 'user_a'
    });

    assert.equal(decision.allowed, true);
  });

  it('refuses a write over somebody else\'s segment', () => {
    /**
     * The document id comes from a versionId the caller sends, and the write
     * merges — so this replaced another participant's text and overwrote
     * createdByUid with the new caller's, leaving nothing to say the record had
     * ever belonged to anybody else. The mobile app pins a well-known literal as
     * one of its version ids, so the id does not even have to be guessed.
     */
    const decision = canWriteTranscriptSegment({
      callerUid: 'user_b',
      existingOwnerUid: 'user_a'
    });

    assert.equal(decision.allowed, false);
    assert.match(decision.reason || '', /another participant/);
  });

  it('refuses an anonymous caller against an owned segment', () => {
    assert.equal(
      canWriteTranscriptSegment({ callerUid: '', existingOwnerUid: 'user_a' }).allowed,
      false
    );
  });

  it('treats a blank owner as no owner rather than a match', () => {
    // Two empty strings are not the same person.
    assert.equal(
      canWriteTranscriptSegment({ callerUid: '', existingOwnerUid: '   ' }).allowed,
      true
    );
  });
});

describe('the rule is wired, not merely defined', () => {
  const service = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'services', 'interpreterService.ts'),
    'utf8'
  );

  it('checks ownership before writing a segment', () => {
    assert.match(service, /canWriteTranscriptSegment/);
  });

  it('does the check inside a transaction', () => {
    // The check is only worth anything if nothing can land between reading the
    // owner and writing.
    assert.match(
      service,
      /runTransaction\([\s\S]{0,400}canWriteTranscriptSegment[\s\S]{0,400}transaction\.set\(segmentRef/
    );
  });

  it('no longer writes the segment outside that transaction', () => {
    assert.doesNotMatch(
      service,
      /\.collection\(TRANSCRIPT_COLLECTION\)\.doc\(segmentId\)\.set\(segment, \{ merge: true \}\)/
    );
  });
});
