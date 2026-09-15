import { timingSafeEqual } from 'node:crypto';
import { getDecodedTokenFromHeader as getDecodedToken } from '../middleware/requestAuth.js';
import { Router } from 'express';
import { z } from 'zod';
import { verifyAppCheck } from '../middleware/appCheck.js';
import { writeAuditEvent } from '../services/auditService.js';
import { requireComplianceAdmin } from '../services/complianceAccess.js';
import {
  listRetentionPolicies,
  saveRetentionPolicy,
  setRetentionPolicyState
} from '../services/retentionPolicyService.js';
import {
  applyLegalHold,
  listLegalHolds,
  releaseLegalHold
} from '../services/legalHoldService.js';
import { evaluateTenantRetention } from '../services/retentionEvaluatorService.js';
import { simulateRetentionPolicy } from '../services/retentionSimulationService.js';
import { explainConversationRetention } from '../services/retentionExplainService.js';
import { runScheduledRetention } from '../services/retentionScheduleService.js';
import {
  runDispositionShredder,
  setDispositionShreddingEnabled
} from '../services/dispositionShredderService.js';
import {
  approveDispositionItem,
  assertDispositionApprovalAuthentication,
  DISPOSITION_SLA_DAYS,
  extendDispositionItem,
  listDispositionQueue
} from '../services/dispositionService.js';
import { searchArchivedMessages } from '../services/complianceSearchService.js';
import { listCompliancePeople } from '../services/complianceDirectoryService.js';
import { getTenantArchiveKeyStatus } from '../services/tenantArchiveKeyService.js';
import {
  createComplianceExportDownloadUrl,
  listComplianceExports,
  requestComplianceExport,
  runComplianceExport
} from '../services/complianceExportService.js';

/**
 * The compliance console's API.
 *
 * A router of its own rather than part of the profile router, because that one
 * belongs to the mobile app and requires a registered device on every route — a
 * browser has no such device, and weakening that rule to fit the console would
 * remove a control from the mobile surface to serve the web one.
 *
 * Every route here is Org Admin only, and the destructive ones additionally
 * require a phone verification from the last few minutes.
 */
const complianceRouter = Router();

const retentionPolicyBodySchema = z.object({
  action: z.enum(['delete', 'retain', 'retain_then_delete']),
  anchor: z.enum(['created', 'last_modified']).optional(),
  contentTypes: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  durationDays: z.number().int().min(1).max(36500),
  name: z.string().trim().min(1).max(120),
  policyKey: z.string().trim().min(8).max(120).optional(),
  scopeKind: z.enum(['conversation', 'organization', 'user']),
  scopeTargets: z.array(z.string().trim().min(1).max(128)).max(500).optional()
});

const retentionSimulationBodySchema = z.object({
  action: z.enum(['delete', 'retain', 'retain_then_delete']),
  durationDays: z.number().int().min(1).max(36500),
  scopeKind: z.enum(['conversation', 'organization', 'user']),
  scopeTargets: z.array(z.string().trim().min(1).max(128)).max(500).optional()
});

const retentionExplainBodySchema = z.object({
  conversationIds: z.array(z.string().trim().min(1).max(128)).max(50).optional(),
  custodianUid: z.string().trim().min(1).max(128).nullable().optional()
});

const retentionPolicyStateBodySchema = z.object({
  state: z.enum(['ACTIVE', 'DISABLED', 'SIMULATION'])
});

const legalHoldBodySchema = z.object({
  caseId: z.string().trim().min(1).max(120),
  custodianUids: z.array(z.string().trim().min(1).max(128)).max(500).optional(),
  description: z.string().trim().min(1).max(2000)
});

const shreddingBodySchema = z.object({
  enabled: z.boolean()
});

const dispositionExtendBodySchema = z.object({
  extraDays: z.number().int().min(1).max(3650)
});

/**
 * What a search or an export covers.
 *
 * Every field is optional because the useful questions vary: "everything from
 * these five people between these dates" names custodians and dates, while
 * "everything preserved by this case" names only the hold. Naming nothing
 * searches the whole organization, which is a legitimate question to ask of a
 * record system and is limited by the result cap rather than refused.
 */
const archiveSearchBodySchema = z.object({
  /** Exports only. A text-only export is far smaller and quicker to produce. */
  includeAttachments: z.boolean().optional(),
  conversationIds: z.array(z.string().trim().min(1).max(128)).max(200).optional(),
  custodianUids: z.array(z.string().trim().min(1).max(128)).max(500).optional(),
  fromMs: z.number().int().nonnegative().nullable().optional(),
  holdId: z.string().trim().min(1).max(128).nullable().optional(),
  limit: z.number().int().min(1).max(5000).optional(),
  text: z.string().trim().max(200).nullable().optional(),
  toMs: z.number().int().nonnegative().nullable().optional()
});
/**
 * Compliance: retention policies, legal holds and the disposition queue.
 *
 * Every route is Org Admin only. Approving a destruction additionally requires a
 * fresh phone verification — the same flow used to sign in — because approval is
 * irreversible and a long-lived session on an unlocked laptop should not be
 * enough to destroy a company's records.
 */
complianceRouter.get('/retention', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const context = await requireComplianceAdmin(decodedToken);
    const [policies, holds, dispositionQueue] = await Promise.all([
      listRetentionPolicies(context.tenantId),
      listLegalHolds(context.tenantId),
      listDispositionQueue(context.tenantId)
    ]);

    res.json({
      dispositionQueue,
      holds,
      policies,
      // Surfaced so the console can state it beside the retention field rather
      // than leaving administrators to discover the real timeline by observation.
      slaDays: DISPOSITION_SLA_DAYS
    });
  } catch (error) {
    next(error);
  }
});

complianceRouter.post('/retention/policies', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const context = await requireComplianceAdmin(decodedToken);
    const body = retentionPolicyBodySchema.parse(req.body);
    const policy = await saveRetentionPolicy({
      actorUid: context.uid,
      policy: body,
      tenantId: context.tenantId
    });

    await writeAuditEvent({
      action: 'RETENTION_POLICY_SAVED',
      metadata: { policyId: policy.id, state: policy.state, version: policy.version },
      req,
      status: 'SUCCESS',
      tenantId: context.tenantId,
      uid: context.uid
    });

    res.status(201).json({ policy });
  } catch (error) {
    await writeAuditEvent({
      action: 'RETENTION_POLICY_SAVED',
      reason: error instanceof Error ? error.message : 'Request failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

complianceRouter.post('/retention/policies/:policyId/state', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const context = await requireComplianceAdmin(decodedToken);
    const body = retentionPolicyStateBodySchema.parse(req.body);
    const policyId = String(req.params.policyId || '');

    // Activating a policy is what makes it able to delete, so it is verified
    // like a destructive action rather than an edit.
    if (body.state === 'ACTIVE') {
      assertDispositionApprovalAuthentication(decodedToken);
    }

    await setRetentionPolicyState({ policyId, state: body.state, tenantId: context.tenantId });

    await writeAuditEvent({
      action: 'RETENTION_POLICY_STATE_CHANGED',
      metadata: { policyId, state: body.state },
      req,
      status: 'SUCCESS',
      tenantId: context.tenantId,
      uid: context.uid
    });

    res.json({ ok: true });
  } catch (error) {
    await writeAuditEvent({
      action: 'RETENTION_POLICY_STATE_CHANGED',
      reason: error instanceof Error ? error.message : 'Request failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

complianceRouter.post('/holds', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const context = await requireComplianceAdmin(decodedToken);
    const body = legalHoldBodySchema.parse(req.body);
    const hold = await applyLegalHold({
      actorUid: context.uid,
      caseId: body.caseId,
      custodianUids: body.custodianUids,
      description: body.description,
      tenantId: context.tenantId
    });

    await writeAuditEvent({
      action: 'LEGAL_HOLD_APPLIED',
      metadata: { caseId: hold.caseId, holdId: hold.id },
      req,
      status: 'SUCCESS',
      tenantId: context.tenantId,
      uid: context.uid
    });

    res.status(201).json({ hold });
  } catch (error) {
    await writeAuditEvent({
      action: 'LEGAL_HOLD_APPLIED',
      reason: error instanceof Error ? error.message : 'Request failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

complianceRouter.post('/holds/:holdId/release', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const context = await requireComplianceAdmin(decodedToken);

    // Releasing a hold exposes preserved evidence to the disposer, so it is
    // verified as strongly as approving a deletion.
    assertDispositionApprovalAuthentication(decodedToken);

    const holdId = String(req.params.holdId || '');
    const { delayUntilMs } = await releaseLegalHold({
      actorUid: context.uid,
      holdId,
      tenantId: context.tenantId
    });

    await writeAuditEvent({
      action: 'LEGAL_HOLD_RELEASED',
      metadata: { delayUntilMs, holdId },
      req,
      status: 'SUCCESS',
      tenantId: context.tenantId,
      uid: context.uid
    });

    res.json({ delayUntil: new Date(delayUntilMs).toISOString() });
  } catch (error) {
    await writeAuditEvent({
      action: 'LEGAL_HOLD_RELEASED',
      reason: error instanceof Error ? error.message : 'Request failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

complianceRouter.post('/disposition/:itemId/approve', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const context = await requireComplianceAdmin(decodedToken);

    assertDispositionApprovalAuthentication(decodedToken);

    const itemId = String(req.params.itemId || '');
    const item = await approveDispositionItem({
      actorUid: context.uid,
      itemId,
      tenantId: context.tenantId
    });

    await writeAuditEvent({
      action: 'DISPOSITION_APPROVED',
      metadata: { itemCount: item.itemCount, itemId, subjectRef: item.subjectRef },
      req,
      status: 'SUCCESS',
      tenantId: context.tenantId,
      uid: context.uid
    });

    res.json({ item });
  } catch (error) {
    await writeAuditEvent({
      action: 'DISPOSITION_APPROVED',
      reason: error instanceof Error ? error.message : 'Request failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

complianceRouter.post('/disposition/:itemId/extend', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const context = await requireComplianceAdmin(decodedToken);
    const body = dispositionExtendBodySchema.parse(req.body);
    const itemId = String(req.params.itemId || '');

    // Keeping data longer is always allowed and never needs step-up: the safe
    // direction should never be the harder one.
    await extendDispositionItem({
      actorUid: context.uid,
      extraDays: body.extraDays,
      itemId,
      tenantId: context.tenantId
    });

    await writeAuditEvent({
      action: 'DISPOSITION_EXTENDED',
      metadata: { extraDays: body.extraDays, itemId },
      req,
      status: 'SUCCESS',
      tenantId: context.tenantId,
      uid: context.uid
    });

    res.json({ ok: true });
  } catch (error) {
    await writeAuditEvent({
      action: 'DISPOSITION_EXTENDED',
      reason: error instanceof Error ? error.message : 'Request failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

/**
 * Runs an evaluation pass now.
 *
 * Exposed to the console so an administrator can see the effect of a policy
 * without waiting for the scheduled run — which is also what makes the feature
 * testable at all before a scheduler exists.
 *
 * Queuing is not destruction: everything this produces still needs a person to
 * approve it, with their phone verified.
 */
complianceRouter.post('/retention/evaluate', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const context = await requireComplianceAdmin(decodedToken);
    const summary = await evaluateTenantRetention({ tenantId: context.tenantId });

    await writeAuditEvent({
      action: 'RETENTION_EVALUATED',
      metadata: { ...summary },
      req,
      status: 'SUCCESS',
      tenantId: context.tenantId,
      uid: context.uid
    });

    res.json({ summary });
  } catch (error) {
    await writeAuditEvent({
      action: 'RETENTION_EVALUATED',
      reason: error instanceof Error ? error.message : 'Request failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

/**
 * Turns destruction on or off for this tenant.
 *
 * Off until switched on deliberately. Turning it on is verified like any other
 * destructive action, because from that moment approved batches start being
 * destroyed for real.
 */
complianceRouter.post('/retention/shredding', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const context = await requireComplianceAdmin(decodedToken);
    const body = shreddingBodySchema.parse(req.body);

    if (body.enabled) {
      assertDispositionApprovalAuthentication(decodedToken);
    }

    await setDispositionShreddingEnabled({ enabled: body.enabled, tenantId: context.tenantId });

    await writeAuditEvent({
      action: body.enabled ? 'RETENTION_SHREDDING_ENABLED' : 'RETENTION_SHREDDING_DISABLED',
      req,
      status: 'SUCCESS',
      tenantId: context.tenantId,
      uid: context.uid
    });

    res.json({ enabled: body.enabled });
  } catch (error) {
    next(error);
  }
});

/**
 * Runs the destruction pass now.
 *
 * Destroys only batches an administrator already approved whose grace window has
 * ended, and only if this tenant has destruction switched on.
 */
complianceRouter.post('/retention/shred', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const context = await requireComplianceAdmin(decodedToken);

    assertDispositionApprovalAuthentication(decodedToken);

    const summary = await runDispositionShredder({ tenantId: context.tenantId });

    await writeAuditEvent({
      action: 'RETENTION_SHREDDER_RUN',
      metadata: { ...summary },
      req,
      status: 'SUCCESS',
      tenantId: context.tenantId,
      uid: context.uid
    });

    res.json({ summary });
  } catch (error) {
    await writeAuditEvent({
      action: 'RETENTION_SHREDDER_RUN',
      reason: error instanceof Error ? error.message : 'Request failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

/**
 * The nightly retention run, for Cloud Scheduler to call.
 *
 * Not an admin route: it is called by the scheduler, not a person, so it is
 * authorised by a shared secret rather than a signed-in session. Without that
 * check anyone who found the URL could trigger destruction across every tenant.
 *
 * If the secret is not configured the route refuses rather than running
 * unprotected — a missing secret must fail closed.
 */
complianceRouter.post('/retention/scheduled-run', async (req, res, next) => {
  try {
    const expectedSecret = (process.env.SYNZAPP_RETENTION_SCHEDULER_SECRET || '').trim();

    if (!expectedSecret) {
      res.status(503).json({ error: 'The retention scheduler is not configured.' });

      return;
    }

    const providedSecret = (req.header('X-Synzapp-Scheduler-Secret') || '').trim();

    if (!matchesSchedulerSecret(providedSecret, expectedSecret)) {
      res.status(401).json({ error: 'Not authorised.' });

      return;
    }

    const summary = await runScheduledRetention();

    res.json({ summary: {
      purged: summary.results.reduce((total, result) => total + result.purged, 0),
      queued: summary.results.reduce((total, result) => total + result.queued, 0),
      tenantsFailed: summary.tenantsFailed,
      tenantsRun: summary.tenantsRun
    } });
  } catch (error) {
    next(error);
  }
});

/**
 * Search preserved conversations.
 *
 * Reading an organization's archive is the most sensitive thing this API does,
 * so every search is written to the audit log with the question that was asked,
 * whether or not it returned anything. A search nobody can account for later is
 * indistinguishable from a fishing expedition through colleagues' messages.
 */
complianceRouter.post('/search', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const context = await requireComplianceAdmin(decodedToken);
    const body = archiveSearchBodySchema.parse(req.body);

    const result = await searchArchivedMessages({
      conversationIds: body.conversationIds,
      custodianUids: body.custodianUids,
      fromMs: body.fromMs ?? null,
      holdId: body.holdId ?? null,
      limit: body.limit,
      tenantId: context.tenantId,
      text: body.text ?? null,
      toMs: body.toMs ?? null
    });

    await writeAuditEvent({
      action: 'COMPLIANCE_ARCHIVE_SEARCHED',
      metadata: {
        custodianCount: body.custodianUids?.length || 0,
        fromMs: body.fromMs ?? null,
        holdId: body.holdId ?? null,
        hits: result.hits.length,
        toMs: body.toMs ?? null
      },
      req,
      status: 'SUCCESS',
      tenantId: context.tenantId,
      uid: context.uid
    });

    res.json({
      // Forwarded so the console can warn that a conversation was only partly
      // examined. Leaving it out of the response made the field undefined in
      // the browser, which threw while results were already on screen.
      cappedConversationIds: result.cappedConversationIds,
      hits: result.hits,
      scannedConversations: result.scannedConversations,
      truncated: result.truncated
    });
  } catch (error) {
    await writeAuditEvent({
      action: 'COMPLIANCE_ARCHIVE_SEARCHED',
      reason: error instanceof Error ? error.message : 'Request failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

complianceRouter.get('/exports', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const context = await requireComplianceAdmin(decodedToken);

    res.json({ exports: await listComplianceExports(context.tenantId) });
  } catch (error) {
    next(error);
  }
});

/**
 * Start an export.
 *
 * Returns as soon as the request is recorded, then packages it in the
 * background. An export across a busy organization's year of conversations
 * takes longer than a browser will wait, and running it inside the request
 * meant a large search timed out and lost everything it had done.
 */
complianceRouter.post('/exports', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const context = await requireComplianceAdmin(decodedToken);
    const body = archiveSearchBodySchema.parse(req.body);

    const record = await requestComplianceExport({
      actorUid: context.uid,
      conversationIds: body.conversationIds,
      custodianUids: body.custodianUids,
      fromMs: body.fromMs ?? null,
      holdId: body.holdId ?? null,
      includeAttachments: body.includeAttachments !== false,
      tenantId: context.tenantId,
      text: body.text ?? null,
      toMs: body.toMs ?? null
    });

    await writeAuditEvent({
      action: 'COMPLIANCE_EXPORT_REQUESTED',
      metadata: {
        custodianCount: body.custodianUids?.length || 0,
        exportId: record.id,
        holdId: body.holdId ?? null
      },
      req,
      status: 'SUCCESS',
      tenantId: context.tenantId,
      uid: context.uid
    });

    res.status(202).json({ export: record });

    // Started after the response so the browser is not held open. The work runs
    // as its own request with the full timeout, and anything left unfinished is
    // picked up by the nightly sweep.
    void triggerExportWorker({ exportId: record.id, tenantId: context.tenantId });
  } catch (error) {
    await writeAuditEvent({
      action: 'COMPLIANCE_EXPORT_REQUESTED',
      reason: error instanceof Error ? error.message : 'Request failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

/** One export's progress, for the console to poll while it runs. */
complianceRouter.get('/exports/:exportId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const context = await requireComplianceAdmin(decodedToken);
    const exportId = String(req.params.exportId || '');
    const record = (await listComplianceExports(context.tenantId))
      .find((candidate) => candidate.id === exportId);

    if (!record) {
      res.status(404).json({ message: 'That export no longer exists.' });

      return;
    }

    res.json({ export: record });
  } catch (error) {
    next(error);
  }
});

/**
 * The worker that actually packages an export.
 *
 * Protected by the same shared secret as the nightly job rather than a user
 * session, because it is called by the service itself, not by a browser.
 */
complianceRouter.post('/exports/:exportId/run', async (req, res, next) => {
  try {
    const expectedSecret = (process.env.SYNZAPP_RETENTION_SCHEDULER_SECRET || '').trim();

    if (!expectedSecret) {
      res.status(503).json({ error: 'The export worker is not configured.' });

      return;
    }

    const providedSecret = (req.header('X-Synzapp-Scheduler-Secret') || '').trim();

    if (!matchesSchedulerSecret(providedSecret, expectedSecret)) {
      res.status(401).json({ error: 'Not authorised.' });

      return;
    }

    const tenantId = String((req.body || {}).tenantId || '');
    const exportId = String(req.params.exportId || '');

    if (!tenantId || !exportId) {
      res.status(400).json({ error: 'tenantId and exportId are required.' });

      return;
    }

    const record = await runComplianceExport({ exportId, tenantId });

    res.json({ state: record?.state || 'FAILED' });
  } catch (error) {
    next(error);
  }
});

complianceRouter.get('/exports/:exportId/download', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const context = await requireComplianceAdmin(decodedToken);
    const exportId = String(req.params.exportId || '');
    const link = await createComplianceExportDownloadUrl({ exportId, tenantId: context.tenantId });

    if (!link) {
      res.status(404).json({ message: 'That export no longer exists.' });

      return;
    }

    await writeAuditEvent({
      action: 'COMPLIANCE_EXPORT_DOWNLOADED',
      metadata: { exportId },
      req,
      status: 'SUCCESS',
      tenantId: context.tenantId,
      uid: context.uid
    });

    res.json({
      // Handed over with the link, so whoever takes delivery can check the file
      // they hold is the file that was produced.
      archiveSha256: link.archiveSha256,
      downloadUrl: link.downloadUrl,
      expiresAt: new Date(link.expiresAtMs).toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * The people a search can be narrowed to.
 *
 * Names, so an administrator picks a colleague from a list instead of typing an
 * identifier they have no way of knowing.
 */
complianceRouter.get('/people', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const context = await requireComplianceAdmin(decodedToken);

    res.json({ people: await listCompliancePeople(context.tenantId) });
  } catch (error) {
    next(error);
  }
});

/**
 * The compliance archive key: whether this organization has one.
 *
 * Reported, never created here. The key creates itself when the first message
 * is encrypted — before that message is sealed, so nothing is ever missed — and
 * a status screen that quietly created the thing it reports on would make the
 * misconfiguration it exists to reveal impossible to see.
 *
 * It is worth reporting because an administrator answering a legal request has
 * to know the date from which records can actually be produced. Without a key
 * the server holds only scrambled text it can never read, and that state used
 * to be invisible until somebody ran a search months later and found nothing.
 */
complianceRouter.get('/archive-key', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const context = await requireComplianceAdmin(decodedToken);

    res.json({ status: await getTenantArchiveKeyStatus(context.tenantId) });
  } catch (error) {
    next(error);
  }
});

/**
 * Asks this service to package an export, as a separate request.
 *
 * A fresh request gets its own full timeout, which is the point: the work is no
 * longer bounded by how long the administrator's browser will wait. Failure to
 * start is only logged — the nightly sweep restarts anything left unfinished,
 * so a missed trigger delays an export rather than losing it.
 */
async function triggerExportWorker(input: { exportId: string; tenantId: string }): Promise<void> {
  const secret = (process.env.SYNZAPP_RETENTION_SCHEDULER_SECRET || '').trim();
  const baseUrl = (process.env.SYNZAPP_PUBLIC_BASE_URL || '').trim();

  if (!secret || !baseUrl) {
    console.error('[SynzappComplianceExport] export worker is not configured', {
      hasBaseUrl: Boolean(baseUrl),
      hasSecret: Boolean(secret)
    });

    return;
  }

  try {
    await fetch(`${baseUrl}/api/compliance/exports/${encodeURIComponent(input.exportId)}/run`, {
      body: JSON.stringify({ tenantId: input.tenantId }),
      headers: {
        'Content-Type': 'application/json',
        'X-Synzapp-Scheduler-Secret': secret
      },
      method: 'POST'
    });
  } catch (error) {
    console.error('[SynzappComplianceExport] could not start the export worker', {
      exportId: input.exportId,
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Compares the scheduler secret without leaking its length or content through
 * how long the comparison takes.
 */
function matchesSchedulerSecret(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');

  if (providedBytes.length !== expectedBytes.length) {
    return false;
  }

  return timingSafeEqual(providedBytes, expectedBytes);
}

/**
 * What a rule would do, before it is allowed to do anything.
 *
 * Read-only: it writes no policy, queues no deletion and changes no state. An
 * administrator about to delete an organization's records should not have to
 * guess, and this is the last point at which guessing is still avoidable.
 */
complianceRouter.post('/retention/simulate', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const context = await requireComplianceAdmin(decodedToken);
    const body = retentionSimulationBodySchema.parse(req.body);

    res.json({
      simulation: await simulateRetentionPolicy({
        action: body.action,
        durationDays: body.durationDays,
        scopeKind: body.scopeKind,
        scopeTargets: body.scopeTargets,
        tenantId: context.tenantId
      })
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Why a particular chat is being kept or deleted.
 *
 * Read-only. This is the question an auditor asks, and the one an administrator
 * has to answer when somebody wants to know why a message survived — or why it
 * did not.
 */
complianceRouter.post('/retention/explain', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const context = await requireComplianceAdmin(decodedToken);
    const body = retentionExplainBodySchema.parse(req.body);

    res.json({
      conversations: await explainConversationRetention({
        conversationIds: body.conversationIds,
        custodianUid: body.custodianUid ?? null,
        tenantId: context.tenantId
      })
    });
  } catch (error) {
    next(error);
  }
});


export { complianceRouter };
