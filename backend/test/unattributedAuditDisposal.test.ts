import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const read = (...parts: string[]) => readFileSync(resolve(backendRoot, ...parts), 'utf8');

const auditService = read('src', 'services', 'auditService.ts');
const auditDisposal = read('src', 'services', 'auditDisposalService.ts');
const schedule = read('src', 'services', 'retentionScheduleService.ts');
const envConfig = read('src', 'config', 'env.ts');

describe('the root audit collection is no longer a permanent cross-tenant store', () => {
  it('writes there only when the event belongs to no tenant', () => {
    /**
     * Every event used to be written there as well as to its tenant, which made
     * it a permanent cross-tenant store of uids, masked phone numbers, IP
     * addresses and metadata — with no reader, no disposal, and no removal when
     * a customer was offboarded.
     */
    assert.match(
      auditService,
      /\} else \{[\s\S]{0,1600}batch\.create\(firestore\.collection\('auditLogs'\)\.doc\(\), baseEvent\);/,
      'The root copy must be the else branch, written only when there is no tenant.'
    );
  });

  it('does not duplicate an event that already has a tenant', () => {
    /**
     * Both writes share one batch, so they land together or not at all. The
     * second copy could never have survived the first, so duplicating personal
     * data bought nothing.
     */
    const rootWrites = auditService.match(/collection\('auditLogs'\)\.doc\(\), baseEvent/g) || [];

    assert.equal(rootWrites.length, 1);
  });

  it('ages those events out', () => {
    assert.match(auditDisposal, /export async function disposeUnattributedAuditEvents/);
    assert.match(schedule, /disposeUnattributedAuditEvents\(\)/);
  });

  it('runs the sweep once per run, not once per tenant', () => {
    // They belong to no tenant, which is the whole reason they are in a root
    // collection.
    const perTenant = schedule.indexOf('for (const organization of organizations)');
    const sweep = schedule.indexOf('disposeUnattributedAuditEvents()');

    assert.ok(sweep > perTenant, 'The sweep must run after the per-tenant loop, not inside it.');
  });

  it('takes its period from configuration rather than a number in code', () => {
    assert.match(envConfig, /SYNZAPP_UNATTRIBUTED_AUDIT_RETENTION_DAYS/);
    assert.match(auditDisposal, /env\.unattributedAuditRetentionDays/);
  });

  it('reports what it removed, so the sweep is not silent', () => {
    assert.match(schedule, /unattributedAuditEventsDisposed/);
  });
});
