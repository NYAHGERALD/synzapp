import { Router } from 'express';
import { z } from 'zod';
import { createRateLimiter, getClientIp } from '../middleware/rateLimit.js';
import { verifyFirebaseSession } from '../services/authSessionService.js';
import { buildAuthSession } from '../services/authSessionService.js';
import { writeAuditEvent } from '../services/auditService.js';
import { getPublishedPolicy, isPolicySlug } from '../services/policyDocumentService.js';
import {
  listSupportRequestsForTenant,
  recordContactSubmission,
  validateContactInput
} from '../services/contactIntakeService.js';

/**
 * How people reach Synzapp.
 *
 * Two doors, deliberately different:
 *
 * The public one takes an enquiry from anybody and is rate limited by address,
 * because a form on an open page is a form that will be abused. It returns
 * nothing but an acknowledgement — no ids, no counts, no way to learn whether
 * an address is already known to us.
 *
 * The support one is only reachable from inside a signed-in console. The
 * organization and the person are read from their session, never from the
 * form, so nobody can raise a request in another company's name.
 */
const contactRouter = Router();

/**
 * Five an hour from one address. Generous for a person with a question, and
 * low enough that the form is not worth using as a mail relay.
 */
const publicContactLimiter = createRateLimiter({
  keyGenerator: (req) => getClientIp(req),
  keyPrefix: 'contact-enquiry',
  max: 5,
  message: 'Too many messages from this connection. Please try again later.',
  windowMs: 60 * 60 * 1000
});

/**
 * The address block, sent alongside the message.
 *
 * Every part optional. A person with an urgent question should not be stopped
 * because they did not want to give a street address, and an enquiry that never
 * arrives is worth less than one missing a postcode.
 */
const contactAddressSchema = z.object({
  city: z.string().trim().max(120).optional(),
  countryCode: z.enum(['US', 'CA', 'MX', 'GB']).optional(),
  line1: z.string().trim().max(200).optional(),
  line2: z.string().trim().max(200).optional(),
  postalCode: z.string().trim().max(20).optional(),
  region: z.string().trim().max(120).optional()
});

const contactBodySchema = z.object({
  address: contactAddressSchema.optional(),
  email: z.string().trim().min(3).max(320),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(1).max(5000),
  name: z.string().trim().min(1).max(200),
  organizationName: z.string().trim().max(200).optional(),
  subject: z.string().trim().min(1).max(200)
});

contactRouter.post('/enquiries', publicContactLimiter, async (req, res, next) => {
  try {
    const body = contactBodySchema.parse(req.body);
    const validationError = validateContactInput(body);

    if (validationError) {
      res.status(400).json({ message: validationError });

      return;
    }

    await recordContactSubmission({
      address: body.address || null,
      email: body.email,
      kind: 'PUBLIC_ENQUIRY',
      message: body.message,
      name: body.name,
      organizationName: body.organizationName || null,
      phone: body.phone || null,
      subject: body.subject
    });

    // Nothing identifying is returned. An acknowledgement that varied by
    // outcome would let somebody probe what we already hold.
    res.status(202).json({ received: true });
  } catch (error) {
    next(error);
  }
});

contactRouter.post('/support', async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const session = await buildAuthSession(decodedToken);

    if (session.access !== 'ACTIVE' || !session.user.tenantId) {
      const error = new Error('Your session is not active.');

      error.name = 'AuthorizationError';

      throw error;
    }

    const body = contactBodySchema.parse(req.body);
    const validationError = validateContactInput(body);

    if (validationError) {
      res.status(400).json({ message: validationError });

      return;
    }

    const { id } = await recordContactSubmission({
      address: body.address || null,
      phone: body.phone || null,
      email: body.email,
      kind: 'SUPPORT_REQUEST',
      message: body.message,
      name: body.name,
      organizationName: body.organizationName || null,
      subject: body.subject,
      submittedByUid: session.user.uid,
      // From the session, never the form: a customer cannot raise a request in
      // another organization's name.
      tenantId: session.user.tenantId
    });

    await writeAuditEvent({
      action: 'SUPPORT_REQUEST_RAISED',
      metadata: { requestId: id },
      req,
      status: 'SUCCESS',
      tenantId: session.user.tenantId,
      uid: session.user.uid
    });

    res.status(201).json({ id, received: true });
  } catch (error) {
    next(error);
  }
});

/** What this organization has already asked. Never anybody else's. */
contactRouter.get('/support', async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const session = await buildAuthSession(decodedToken);

    if (session.access !== 'ACTIVE' || !session.user.tenantId) {
      const error = new Error('Your session is not active.');

      error.name = 'AuthorizationError';

      throw error;
    }

    res.json({ requests: await listSupportRequestsForTenant(session.user.tenantId) });
  } catch (error) {
    next(error);
  }
});

/**
 * The policy the public site shows.
 *
 * Read at request time from the published version, so a wording change is a
 * save in the console rather than a deployment. Returns 404 when nothing has
 * been published — the site then shows what is compiled in, rather than an
 * empty page pretending to be a policy.
 */
contactRouter.get('/policies/:slug', async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '');

    if (!isPolicySlug(slug)) {
      res.status(404).json({ message: 'No such policy.' });

      return;
    }

    const published = await getPublishedPolicy(slug);

    if (!published) {
      res.status(404).json({ message: 'This policy has not been published yet.' });

      return;
    }

    res.json({ policy: published });
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

export { contactRouter };
