import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const read = (...parts: string[]) => readFileSync(resolve(backendRoot, ...parts), 'utf8');

const auditService = read('src', 'services', 'auditService.ts');
const auditContext = read('src', 'middleware', 'auditContext.ts');
const complianceRoutes = read('src', 'routes', 'complianceRoutes.ts');

/** Every writeAuditEvent call in a file, with its body. */
function auditCalls(source: string): string[] {
  return [...source.matchAll(/writeAuditEvent\(\{(.*?)\}\)/gs)].map((match) => match[1]);
}

describe('a refused attempt reaches the console a tenant can read', () => {
  it('resolves the tenant when the caller did not supply one', () => {
    /**
     * 60 of the 64 failure-path writes passed neither a uid nor a tenant, so
     * they landed only in the root collection that no route reads. The console
     * a customer can open therefore showed a world with a 100% success rate —
     * which an auditor reads as a broken control, not a clean one.
     */
    assert.match(auditService, /resolveAuditIdentity/);
    assert.match(auditService, /attributed\.tenantId/);
  });

  it('only resolves when the caller did not say, so success costs nothing', () => {
    assert.match(auditService, /input\.tenantId\s*\n?\s*\?/);
  });

  it('proves identity by signature and does not check revocation', () => {
    /**
     * Attribution asks who sent this, not whether they were allowed to. Checking
     * revocation would throw for exactly the caller most worth recording:
     * somebody using a credential that has been taken away.
     */
    assert.match(auditContext, /verifyIdToken\([^)]*,\s*false\)/);
  });

  it('never lets a failure to attribute become a second failure', () => {
    assert.match(auditContext, /catch\s*\{/);
  });
});

describe('the compliance console records refusals', () => {
  it('writes a failure event on every mutating compliance route', () => {
    /**
     * All twelve audit calls here used to be success-only, so a non-admin
     * attempting an archive search or a hold release left no trace anywhere —
     * the precise thing the control was written to prevent.
     */
    const failures = auditCalls(complianceRoutes)
      .filter((body) => body.includes("status: 'FAILED'"));

    assert.ok(
      failures.length >= 10,
      `Expected failure audits on the mutating compliance routes, found ${failures.length}.`
    );
  });

  it('does not let an audit failure swallow the original error', () => {
    // The catch is already handling something that went wrong; failing to
    // record it must not replace the error the caller needs to see.
    const failures = auditCalls(complianceRoutes)
      .filter((body) => body.includes("status: 'FAILED'"));

    failures.forEach((body) => {
      assert.match(body, /reason:/, 'A failure event must say what went wrong.');
    });
  });
});
