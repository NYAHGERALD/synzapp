import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Guards for the audit trail's own credibility.
 *
 * Every one of these reaches Firestore, so reading what the code does is the
 * only way to assert them without an emulator. Each corresponds to a finding
 * where the trail looked complete and was not.
 */

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const read = (...parts: string[]) => readFileSync(resolve(backendRoot, ...parts), 'utf8');

const auditService = read('src', 'services', 'auditService.ts');
const auditDisposalService = read('src', 'services', 'auditDisposalService.ts');
const recordBodyDisposalService = read('src', 'services', 'recordBodyDisposalService.ts');
const legalHoldService = read('src', 'services', 'legalHoldService.ts');
const indexes = JSON.parse(read('..', 'firestore.indexes.json')) as {
  indexes: Array<{ collectionGroup: string; fields: Array<{ fieldPath: string }> }>;
};

describe('the audit log tells the truth about itself', () => {
  it('stops ageing events out while a legal hold is in force', () => {
    /**
     * This was the one destruction path that never asked. Every other one
     * re-checks holds; the nightly audit pass went on deleting through a hold,
     * destroying the record of who touched the material being preserved.
     */
    assert.match(
      auditDisposalService,
      /listActiveLegalHolds/,
      'Audit disposal must check for a legal hold before removing anything.'
    );
  });

  it('writes both copies of an event together or not at all', () => {
    // Two sequential writes meant the root copy could land while the tenant
    // copy failed, leaving an event the customer cannot see and no sign of it.
    assert.match(auditService, /firestore\.batch\(\)/);
    assert.match(auditService, /batch\.commit\(\)/);
  });

  it('generates the correlation id rather than taking the caller\'s', () => {
    // It was X-Request-Id verbatim, so the one field meant to tie a request
    // together could be forged or deliberately collided.
    assert.match(auditService, /requestId: randomUUID\(\)/);
    assert.match(auditService, /clientRequestId/);
  });

  it('reads the client address from the end of the forwarded list', () => {
    /**
     * The first entry is whatever the caller wrote. Reading it made the audit
     * log's IP column attacker controlled and let anybody walk past the per-IP
     * rate limits with a fresh fabrication each request.
     */
    assert.match(read('src', 'middleware', 'rateLimit.ts'), /readForwardedClientIp/);
  });
});

describe('a control that fails says so', () => {
  it('counts only an actual hold as held back', () => {
    /**
     * A bare catch reported a permissions error, an outage and a plain bug as
     * the counter the design treats as the system working. A disposal failing
     * silently every night looked identical to one correctly blocked.
     */
    assert.match(recordBodyDisposalService, /isLegalHoldError/);
    assert.doesNotMatch(
      recordBodyDisposalService,
      /\}\s*catch\s*\{/,
      'Record body disposal must not swallow every error as a legal hold.'
    );
  });

  it('refuses to release a legal hold that does not exist', () => {
    // A merge write created one out of nothing, and the route audited the
    // phantom as a successful release.
    assert.match(legalHoldService, /existing\.exists/);
  });
});

describe('the audit console can actually run its query', () => {
  it('has the composite index its filtered views need', () => {
    /**
     * The query combines an `action in [...]` filter with an ordered createdAt
     * range. Without this index every filtered view fails at runtime — and it
     * fails for the auditor, in the middle of a review.
     */
    const auditIndex = indexes.indexes.find((index) => index.collectionGroup === 'auditLogs');

    assert.ok(auditIndex, 'Expected a composite index for the audit log query.');
    assert.deepEqual(
      auditIndex?.fields.map((field) => field.fieldPath),
      ['action', 'createdAt']
    );
  });
});
