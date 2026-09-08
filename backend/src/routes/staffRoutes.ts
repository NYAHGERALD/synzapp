import {
  listRetentionBoundsHistory,
  publishRetentionBounds,
  RETENTION_TEMPLATES
} from '../services/retentionBoundsService.js';
import { Router } from 'express';
import { z } from 'zod';
import { verifyFirebaseSession } from '../services/authSessionService.js';
import { writeAuditEvent } from '../services/auditService.js';
import { requireStaff, requireStaffAdmin, listStaff } from '../services/staffAccessService.js';
import {
  addContactReply,
  listContactReplies,
  listContactSubmissionsForStaff,
  setContactState
} from '../services/contactIntakeService.js';
import {
  getPolicyDraft,
  getPublishedPolicy,
  isPolicySlug,
  listPolicyVersions,
  publishPolicyDraft,
  savePolicyDraft,
  validatePolicyInput
} from '../services/policyDocumentService.js';

/**
 * Synzapp's own console.
 *
 * Every route requires a Google Workspace account on the company domain **and**
 * an active record on the staff list. Neither alone is sufficient, and the
 * customer sign-in cannot reach any of this.
 *
 * **No route here reads customer content.** Support is answered about an
 * organization — that they asked, when, and what they typed — never from inside
 * their conversations. That is enforced by which routes exist rather than by a
 * filter somebody could forget to apply.
 */
const staffRouter = Router();

const retentionBoundsSchema = z.object({
  maximumDays: z.number().int().positive().max(36_500).nullish(),
  minimumDays: z.number().int().positive().max(36_500),
  templateId: z.string().trim().min(1).max(80)
});

const policyBodySchema = z.object({
  body: z.string().trim().min(1).max(120000),
  summary: z.string().trim().min(1).max(500),
  title: z.string().trim().min(1).max(200)
});

const replyBodySchema = z.object({
  body: z.string().trim().min(1).max(5000)
});

const stateBodySchema = z.object({
  state: z.enum(['NEW', 'ACKNOWLEDGED', 'CLOSED'])
});

/** Who is signed in, and what they may do. The console asks this first. */
staffRouter.get('/me', async (req, res, next) => {
  try {
    const context = await requireStaff(await getDecodedToken(req.header('Authorization') || ''));

    res.json({ staff: context });
  } catch (error) {
    next(error);
  }
});

staffRouter.get('/team', async (req, res, next) => {
  try {
    await requireStaff(await getDecodedToken(req.header('Authorization') || ''));

    res.json({ team: await listStaff() });
  } catch (error) {
    next(error);
  }
});

/**
 * The support inbox.
 *
 * Reading it is audited. Support access nobody can account for later is
 * indistinguishable from browsing customers' business.
 */
staffRouter.get('/inbox', async (req, res, next) => {
  try {
    const context = await requireStaff(await getDecodedToken(req.header('Authorization') || ''));
    const kind = req.query.kind === 'PUBLIC_ENQUIRY' || req.query.kind === 'SUPPORT_REQUEST'
      ? req.query.kind
      : undefined;
    const state = req.query.state === 'NEW' || req.query.state === 'ACKNOWLEDGED' || req.query.state === 'CLOSED'
      ? req.query.state
      : undefined;

    const submissions = await listContactSubmissionsForStaff({ kind, state });

    await writeAuditEvent({
      action: 'STAFF_INBOX_VIEWED',
      metadata: { count: submissions.length, kind: kind || null, state: state || null },
      req,
      status: 'SUCCESS',
      tenantId: 'synzapp-internal',
      uid: context.uid
    });

    res.json({ submissions });
  } catch (error) {
    next(error);
  }
});

staffRouter.get('/inbox/:submissionId/replies', async (req, res, next) => {
  try {
    await requireStaff(await getDecodedToken(req.header('Authorization') || ''));

    res.json({ replies: await listContactReplies(String(req.params.submissionId || '')) });
  } catch (error) {
    next(error);
  }
});

staffRouter.post('/inbox/:submissionId/replies', async (req, res, next) => {
  try {
    const context = await requireStaff(await getDecodedToken(req.header('Authorization') || ''));
    const body = replyBodySchema.parse(req.body);
    const submissionId = String(req.params.submissionId || '');

    await addContactReply({ authorEmail: context.email, body: body.body, submissionId });

    await writeAuditEvent({
      action: 'STAFF_SUPPORT_REPLIED',
      metadata: { submissionId },
      req,
      status: 'SUCCESS',
      tenantId: 'synzapp-internal',
      uid: context.uid
    });

    res.status(201).json({ replied: true });
  } catch (error) {
    next(error);
  }
});

staffRouter.post('/inbox/:submissionId/state', async (req, res, next) => {
  try {
    const context = await requireStaff(await getDecodedToken(req.header('Authorization') || ''));
    const body = stateBodySchema.parse(req.body);
    const submissionId = String(req.params.submissionId || '');

    await setContactState({ state: body.state, submissionId });

    await writeAuditEvent({
      action: 'STAFF_SUPPORT_STATE_CHANGED',
      metadata: { state: body.state, submissionId },
      req,
      status: 'SUCCESS',
      tenantId: 'synzapp-internal',
      uid: context.uid
    });

    res.json({ state: body.state });
  } catch (error) {
    next(error);
  }
});

/* ---- Policies ----------------------------------------------------------- */

staffRouter.get('/policies/:slug', async (req, res, next) => {
  try {
    await requireStaff(await getDecodedToken(req.header('Authorization') || ''));

    const slug = String(req.params.slug || '');

    if (!isPolicySlug(slug)) {
      res.status(404).json({ message: 'No such policy.' });

      return;
    }

    const [draft, published, versions] = await Promise.all([
      getPolicyDraft(slug),
      getPublishedPolicy(slug),
      listPolicyVersions(slug)
    ]);

    res.json({ draft, published, versions });
  } catch (error) {
    // Logged with the real reason. A generic failure message on this screen
    // cost an afternoon once already: the underlying error said exactly what
    // was wrong and nobody could see it.
    console.error('[SynzappStaff] could not load policy', {
      message: error instanceof Error ? error.message : String(error),
      slug: String(req.params.slug || '')
    });

    next(error);
  }
});

staffRouter.post('/policies/:slug/draft', async (req, res, next) => {
  try {
    const context = await requireStaff(await getDecodedToken(req.header('Authorization') || ''));
    const slug = String(req.params.slug || '');

    if (!isPolicySlug(slug)) {
      res.status(404).json({ message: 'No such policy.' });

      return;
    }

    const body = policyBodySchema.parse(req.body);
    const validationError = validatePolicyInput(body);

    if (validationError) {
      res.status(400).json({ message: validationError });

      return;
    }

    const draft = await savePolicyDraft({ ...body, slug });

    await writeAuditEvent({
      action: 'STAFF_POLICY_DRAFT_SAVED',
      metadata: { slug, version: draft.version },
      req,
      status: 'SUCCESS',
      tenantId: 'synzapp-internal',
      uid: context.uid
    });

    res.json({ draft });
  } catch (error) {
    next(error);
  }
});

/**
 * Publishing is restricted to a staff administrator.
 *
 * A published version becomes the document the company is held to, and it can
 * never be edited afterwards — so it is not something every support account
 * should be able to do.
 */
/** The starting sets staff choose between. Named regimes, not invented numbers. */
staffRouter.get('/retention-templates', async (req, res, next) => {
  try {
    await requireStaff(await getDecodedToken(req.header('Authorization') || ''));

    res.json({ templates: RETENTION_TEMPLATES });
  } catch (error) {
    next(error);
  }
});

/** Every set of bounds ever published for one tenant. None of them editable. */
staffRouter.get('/tenants/:tenantId/retention-bounds', async (req, res, next) => {
  try {
    await requireStaff(await getDecodedToken(req.header('Authorization') || ''));

    res.json({ versions: await listRetentionBoundsHistory(String(req.params.tenantId)) });
  } catch (error) {
    next(error);
  }
});

/**
 * Publishes the periods a tenant may choose between.
 *
 * A staff admin only, and audited with their name: widening a retention floor
 * is exactly the change a buyer will later ask to see justified.
 */
staffRouter.post('/tenants/:tenantId/retention-bounds', async (req, res, next) => {
  const tenantId = String(req.params.tenantId || '');

  try {
    const context = await requireStaff(await getDecodedToken(req.header('Authorization') || ''));

    requireStaffAdmin(context);

    const body = retentionBoundsSchema.parse(req.body);
    const published = await publishRetentionBounds({
      maximumDays: body.maximumDays ?? null,
      minimumDays: body.minimumDays,
      staff: context,
      templateId: body.templateId,
      tenantId
    });

    await writeAuditEvent({
      action: 'STAFF_RETENTION_BOUNDS_PUBLISHED',
      metadata: {
        maximumDays: published.maximumDays ?? 'none',
        minimumDays: published.minimumDays,
        subjectTenantId: tenantId,
        templateId: published.templateId,
        version: published.version
      },
      req,
      status: 'SUCCESS',
      tenantId: 'synzapp-internal',
      uid: context.uid
    });

    // Written to the tenant's own log as well. An organization is entitled to
    // see a change to its retention rules without asking Synzapp for it.
    await writeAuditEvent({
      action: 'RETENTION_BOUNDS_PUBLISHED',
      metadata: {
        maximumDays: published.maximumDays ?? 'none',
        minimumDays: published.minimumDays,
        version: published.version
      },
      req,
      status: 'SUCCESS',
      tenantId,
      uid: context.uid
    });

    res.json({ bounds: published });
  } catch (error) {
    next(error);
  }
});

staffRouter.post('/policies/:slug/publish', async (req, res, next) => {
  try {
    const context = await requireStaff(await getDecodedToken(req.header('Authorization') || ''));

    requireStaffAdmin(context);

    const slug = String(req.params.slug || '');

    if (!isPolicySlug(slug)) {
      res.status(404).json({ message: 'No such policy.' });

      return;
    }

    const published = await publishPolicyDraft({ publishedByEmail: context.email, slug });

    await writeAuditEvent({
      action: 'STAFF_POLICY_PUBLISHED',
      metadata: { slug, version: published.version },
      req,
      status: 'SUCCESS',
      tenantId: 'synzapp-internal',
      uid: context.uid
    });

    res.json({ published });
  } catch (error) {
    next(error);
  }
});

async function getDecodedToken(authorizationHeader: string) {
  const idToken = authorizationHeader.startsWith('Bearer ')
    ? authorizationHeader.slice('Bearer '.length)
    : authorizationHeader;

  if (!idToken) {
    const error = new Error('Missing authorization token.');

    error.name = 'AuthorizationError';

    throw error;
  }

  return verifyFirebaseSession(idToken);
}

export { staffRouter };
