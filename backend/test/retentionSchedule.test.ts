import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const schedule = readFileSync(
  resolve(backendRoot, 'src', 'services', 'retentionScheduleService.ts'),
  'utf8'
);
const complianceRoutes = readFileSync(
  resolve(backendRoot, 'src', 'routes', 'complianceRoutes.ts'),
  'utf8'
);

describe('one tenant failing does not stop the rest', () => {
  it('catches a failure per tenant instead of throwing', () => {
    // A single bad tenant must not silently halt retention for everybody else.
    assert.match(schedule, /export async function runTenantRetention/);
    assert.match(schedule, /result\.error = error instanceof Error/);
  });

  it('counts the failures in the summary', () => {
    assert.match(schedule, /tenantsFailed: results\.filter\(\(result\) => result\.error\)\.length/);
  });
});

describe('every run is recorded', () => {
  it('writes a record even when tenants failed', () => {
    // "Did retention run last night?" needs an answer, and silence is not one.
    assert.match(schedule, /await recordRetentionRun\(summary\)/);
    assert.doesNotMatch(schedule, /if \(!summary\.tenantsFailed\)[\s\S]{0,80}recordRetentionRun/);
  });

  it('stores which tenants failed and why', () => {
    assert.match(schedule, /failures: summary\.results/);
    assert.match(schedule, /error: result\.error, tenantId: result\.tenantId/);
  });
});

describe('the scheduled endpoint is protected', () => {
  const handler = complianceRoutes.slice(
    complianceRoutes.indexOf("'/retention/scheduled-run'"),
    complianceRoutes.indexOf('async function getDecodedToken')
  );

  it('requires a shared secret', () => {
    // Anyone finding this URL could otherwise trigger destruction everywhere.
    assert.match(handler, /X-Synzapp-Scheduler-Secret/);
    assert.match(handler, /checkSchedulerSecret/);
  });

  it('refuses to run when the secret is not configured', () => {
    // A missing secret must fail closed, not run unprotected. The decision now
    // says which it was, so the route can answer 503 for unconfigured and 401
    // for wrong rather than conflating them.
    assert.match(handler, /NOT_CONFIGURED/);
    assert.match(handler, /503/);
  });

  it('records the invocation, refused or not', () => {
    /**
     * This authorises destruction across every tenant and nothing said it had
     * run, or who asked. Somebody guessing at the header left no trace either.
     */
    assert.match(handler, /SCHEDULER_JOB_INVOKED/);
    assert.match(handler, /status: 'DENIED'/);
  });

  it('reports which secret was used, so a rotation can be finished', () => {
    // While anything still sends the previous value, every call says so.
    assert.match(handler, /secretUsed: decision\.matched/);
  });
});

describe('tenants are processed one at a time', () => {
  it('does not fan out in parallel', () => {
    // This competes with live traffic; finishing later beats slowing the app.
    assert.match(schedule, /for \(const organization of organizations\)/);
    assert.doesNotMatch(schedule, /Promise\.all\(organizations/);
  });
});

describe('the job looks where the data actually is', () => {
  const evaluator = readFileSync(
    resolve(backendRoot, 'src', 'services', 'retentionEvaluatorService.ts'),
    'utf8'
  );
  const shredder = readFileSync(
    resolve(backendRoot, 'src', 'services', 'dispositionShredderService.ts'),
    'utf8'
  );

  it('lists organizations, not the tenants collection', () => {
    // tenants/ holds only retention records, and its documents are implicit
    // parents of subcollections. A normal query returns none of them, so the
    // job found zero companies every night and reported success.
    assert.match(schedule, /collection\('organizations'\)\.listDocuments\(\)/);
    assert.doesNotMatch(schedule, /collection\('tenants'\)\.select\(\)/);
  });

  it('reads conversations from directChats', () => {
    assert.match(evaluator, /collection\('organizations'\)/);
    assert.match(evaluator, /collection\('directChats'\)/);
  });

  it('destroys from the same place it reads', () => {
    // Reading one path and deleting another means either nothing is destroyed,
    // or the wrong thing is.
    assert.match(shredder, /collection\('organizations'\)/);
    assert.match(shredder, /collection\('directChats'\)/);
  });

  it('uses one subject reference format across both', () => {
    // The evaluator writes the reference and the shredder parses it. If the two
    // disagree, items queue up and are marked purged while nothing is deleted.
    assert.match(evaluator, /\$\{subjectPrefix\}\/\$\{doc\.id\}/);
    assert.match(evaluator, /subjectPrefix: 'directChat'/);
    assert.match(evaluator, /subjectPrefix: 'group'/);
    assert.match(shredder, /startsWith\('directChat\/'\)/);
    assert.match(shredder, /startsWith\('group\/'\)/);
  });

  it('examines group conversations too', () => {
    // Only direct chats were examined, so an organization's group chats were
    // never queued, never expired and never deleted, whatever its policy said.
    assert.match(evaluator, /collection\('groups'\)/);
  });
});

describe('exports survive an interrupted container', () => {
  const schedule = readFileSync(
    new URL('../src/services/retentionScheduleService.ts', import.meta.url),
    'utf8'
  );
  const exportService = readFileSync(
    new URL('../src/services/complianceExportService.ts', import.meta.url),
    'utf8'
  );

  it('the nightly run restarts exports left unfinished', () => {
    // Without this a job sits at "Packaging" for ever, which on screen is
    // indistinguishable from slow progress.
    assert.match(schedule, /resumeStalledComplianceExports/);
    assert.match(exportService, /where\('state', 'in', \['PENDING', 'RUNNING'\]\)/);
  });

  it('only restarts a job that has actually gone quiet', () => {
    // Restarting a healthy job would package the same export twice.
    assert.match(exportService, /EXPORT_STALE_MS/);
    assert.match(exportService, /nowMs - startedAtMs < EXPORT_STALE_MS/);
  });

  it('records a failure instead of leaving the job looking busy', () => {
    assert.match(exportService, /state: 'FAILED'/);
    assert.match(exportService, /stage: 'Failed'/);
  });

  it('refuses to package an export that is already running', () => {
    // The trigger and the sweep can both reach the same job.
    assert.match(exportService, /state === 'READY' \|\| stored\.state === 'RUNNING'/);
  });
});
