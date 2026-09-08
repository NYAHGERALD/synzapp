import { disposeExpiredAuditEvents } from './auditDisposalService.js';
import { disposeExpiredRecordBodies } from './recordBodyDisposalService.js';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import { evaluateTenantRetention } from './retentionEvaluatorService.js';
import {
  purgeExpiredComplianceExports,
  resumeStalledComplianceExports
} from './complianceExportService.js';
import { runDispositionShredder } from './dispositionShredderService.js';

/**
 * The nightly retention run.
 *
 * Retention that only happens when somebody remembers to open a screen is not
 * retention. This walks every tenant, works out what has expired, and destroys
 * what was already approved and has finished its grace window.
 *
 * **Every run is recorded, including the ones that fail.** A retention job that
 * dies quietly looks exactly like one that found nothing to do, and the
 * difference is a company keeping records it should have deleted, or deleting
 * records it should have kept. The record is what makes the difference visible.
 *
 * One tenant failing does not stop the others. A single bad tenant should not
 * silently halt retention for everybody else.
 */

export interface TenantRunResult {
  /** Action bodies emptied once past the tenant's period. */
  actionBodiesDisposed: number;
  /** Announcement bodies emptied once past the tenant's period. */
  announcementBodiesDisposed: number;
  /** Audit events aged out. The only way one ever leaves the system. */
  auditEventsDisposed: number;
  /** Disposals a legal hold refused. The system working, not failing. */
  bodiesHeldBack: number;
  error: string | null;
  evaluated: number;
  /** Expired eDiscovery bundles cleared, so readable copies do not accumulate. */
  expiredExportsPurged: number;
  purged: number;
  /** Exports left unfinished by an interrupted container, restarted. */
  stalledExportsResumed: number;
  queued: number;
  tenantId: string;
  withheld: number;
}

export interface RetentionRunSummary {
  finishedAtMs: number;
  results: TenantRunResult[];
  startedAtMs: number;
  tenantsFailed: number;
  tenantsRun: number;
}

/** Runs retention for one tenant. Never throws; failures are reported. */
export async function runTenantRetention(tenantId: string): Promise<TenantRunResult> {
  const result: TenantRunResult = {
    actionBodiesDisposed: 0,
    announcementBodiesDisposed: 0,
    auditEventsDisposed: 0,
    bodiesHeldBack: 0,
    error: null,
    evaluated: 0,
    expiredExportsPurged: 0,
    purged: 0,
    stalledExportsResumed: 0,
    queued: 0,
    tenantId,
    withheld: 0
  };

  try {
    const evaluation = await evaluateTenantRetention({ tenantId });

    result.evaluated = evaluation.examined;
    result.queued = evaluation.queued;
    result.withheld = evaluation.withheld;

    // Destruction only touches batches an administrator already approved, and
    // only for tenants that have switched it on.
    const shred = await runDispositionShredder({ tenantId });

    result.purged = shred.purged;

    // Export bundles hold an organization's messages in readable form. Left
    // alone they build a second, unencrypted archive beside the real one, so
    // expired ones are cleared on the same schedule that expires everything
    // else. Deliberately outside the shredder's per-tenant switch: this removes
    // copies Synzapp made, not the organization's own records.
    result.expiredExportsPurged = (await purgeExpiredComplianceExports({ tenantId })).purged;

    // A container can be replaced while an export is being packaged. Without
    // this the job sits unfinished for ever, which on screen is
    // indistinguishable from slow progress.
    result.stalledExportsResumed = (await resumeStalledComplianceExports({ tenantId })).resumed;

    // The audit log ages out here and nowhere else. Deliberately outside the
    // shredder's per-tenant switch: an organization that has not turned on
    // destruction of its own records still does not get to keep an audit trail
    // for ever, and this is the only thing that removes one.
    result.auditEventsDisposed = (await disposeExpiredAuditEvents({ tenantId })).disposed;

    // Actions and announcements finally age out too. Both removal functions
    // have existed for a while with nothing calling them, so a tenant's
    // retention policy applied to everything except the two record types most
    // likely to hold what somebody asked to have removed.
    const bodies = await disposeExpiredRecordBodies({ tenantId });

    result.actionBodiesDisposed = bodies.actionsDisposed;
    result.announcementBodiesDisposed = bodies.announcementsDisposed;
    result.bodiesHeldBack = bodies.heldBack;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Retention run failed.';
  }

  return result;
}

/**
 * Runs retention for every tenant and writes down what happened.
 *
 * Tenants are handled one at a time rather than in parallel: this job competes
 * with live traffic, and finishing an hour later is preferable to slowing the
 * app for everyone while it runs.
 */
export async function runScheduledRetention(): Promise<RetentionRunSummary> {
  const startedAtMs = Date.now();
  // Organizations are the real tenant list. The tenants/ collection holds only
  // retention records, and its documents are implicit parents of subcollections
  // — a normal query returns none of them, so this job found zero companies and
  // reported success.
  const organizations = await firestore.collection('organizations').listDocuments();
  const results: TenantRunResult[] = [];

  for (const organization of organizations) {
    results.push(await runTenantRetention(organization.id));
  }

  const summary: RetentionRunSummary = {
    finishedAtMs: Date.now(),
    results,
    startedAtMs,
    tenantsFailed: results.filter((result) => result.error).length,
    tenantsRun: results.length
  };

  await recordRetentionRun(summary);

  return summary;
}

/**
 * Keeps a record of the run.
 *
 * Written even when tenants failed. An operator asking "did retention run last
 * night?" needs an answer, and silence is not one.
 */
async function recordRetentionRun(summary: RetentionRunSummary): Promise<void> {
  await firestore
    .collection('retentionRuns')
    .doc(new Date(summary.startedAtMs).toISOString())
    .set({
      createdAt: fieldValue.serverTimestamp(),
      durationMs: summary.finishedAtMs - summary.startedAtMs,
      // Only the tenants that failed are stored in full. Storing every result
      // would grow without limit and bury the one thing worth reading.
      failures: summary.results
        .filter((result) => result.error)
        .map((result) => ({ error: result.error, tenantId: result.tenantId })),
      finishedAtMs: summary.finishedAtMs,
      purged: summary.results.reduce((total, result) => total + result.purged, 0),
      queued: summary.results.reduce((total, result) => total + result.queued, 0),
      startedAtMs: summary.startedAtMs,
      tenantsFailed: summary.tenantsFailed,
      tenantsRun: summary.tenantsRun
    })
    .catch(() => undefined);
}
