import { Router } from 'express';
import { z } from 'zod';
import { verifyAppCheck } from '../middleware/appCheck.js';
import { verifyFirebaseSession } from '../services/authSessionService.js';
import { writeAuditEvent } from '../services/auditService.js';
import {
  acknowledgeAnnouncement,
  createAnnouncement,
  listAnnouncementAudienceGroups,
  listAnnouncementRecipients,
  listAnnouncementsForPerson,
  markAnnouncementRead,
  previewAnnouncementAudience
} from '../services/announcementService.js';

/**
 * Announcements.
 *
 * Every route reads who the caller is from their verified session. Nothing here
 * accepts an identity, a department or a role from the request body: those are
 * exactly the fields an attacker would send.
 */
export const announcementRouter = Router();

const audienceSchema = z.object({
  kind: z.enum(['ORGANIZATION', 'DEPARTMENT', 'GROUP', 'PERSON']),
  targetId: z.string().trim().max(200).nullable(),
  targetName: z.string().trim().min(1).max(200)
});

const createBodySchema = z.object({
  // A cap, because every audience costs a read to resolve and somebody will
  // eventually send one to two hundred groups by accident.
  audiences: z.array(audienceSchema).min(1).max(25),
  body: z.string().trim().min(1).max(5000),
  requiresAcknowledgement: z.boolean(),
  subject: z.string().trim().min(2).max(200)
});

const previewBodySchema = z.object({
  audiences: z.array(audienceSchema).max(25)
});

const recipientQuerySchema = z.object({
  startAfterUid: z.string().trim().max(200).optional(),
  status: z.enum(['DELIVERED', 'READ', 'ACKNOWLEDGED']).optional()
});

async function getDecodedToken(authorizationHeader: string) {
  const idToken = authorizationHeader.startsWith('Bearer ')
    ? authorizationHeader.slice('Bearer '.length)
    : '';

  if (!idToken) {
    const error = new Error('Missing Firebase ID token.');
    error.name = 'AuthorizationError';

    throw error;
  }

  return verifyFirebaseSession(idToken);
}

announcementRouter.post('/', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = createBodySchema.parse(req.body);
    const announcement = await createAnnouncement(decodedToken, body);

    await writeAuditEvent({
      action: 'ANNOUNCEMENT_SENT',
      metadata: {
        announcementId: announcement.announcementId,
        audienceSummary: announcement.audienceSummary,
        audiences: announcement.audiences.map((audience) => `${audience.kind}:${audience.targetName}`),
        recipientCount: announcement.expectedRecipientCount,
        requiresAcknowledgement: announcement.requiresAcknowledgement
      },
      phoneMasked: undefined,
      req,
      status: 'SUCCESS',
      tenantId: announcement.tenantId,
      uid: decodedToken.uid
    });

    res.status(201).json({ announcement });
  } catch (error) {
    next(error);
  }
});

/**
 * How many people a chosen audience reaches, before anything is sent.
 *
 * Resolves and counts, writes nothing. The permission check is the same one
 * the send uses, so an audience refused here is refused there.
 */
announcementRouter.post('/preview', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = previewBodySchema.parse(req.body);

    res.json(await previewAnnouncementAudience(decodedToken, body.audiences));
  } catch (error) {
    next(error);
  }
});

/** The groups this person may address. Not the same as the ones they can read. */
announcementRouter.get('/audience-groups', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');

    res.json({ groups: await listAnnouncementAudienceGroups(decodedToken) });
  } catch (error) {
    next(error);
  }
});

announcementRouter.get('/', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const announcements = await listAnnouncementsForPerson(decodedToken);

    res.json({ announcements });
  } catch (error) {
    next(error);
  }
});

announcementRouter.post('/:announcementId/acknowledge', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const announcementId = String(req.params.announcementId || '');
    const result = await acknowledgeAnnouncement(decodedToken, announcementId);

    // Acknowledgement is the whole point of the feature. It is written down
    // with who, when and from where, because it may be produced in evidence.
    await writeAuditEvent({
      action: 'ANNOUNCEMENT_ACKNOWLEDGED',
      metadata: { acknowledgedAtMs: result.acknowledgedAtMs, announcementId },
      phoneMasked: undefined,
      req,
      status: 'SUCCESS',
      tenantId: undefined,
      uid: decodedToken.uid
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

announcementRouter.post('/:announcementId/read', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');

    await markAnnouncementRead(decodedToken, String(req.params.announcementId || ''));

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

announcementRouter.get('/:announcementId/recipients', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const query = recipientQuerySchema.parse(req.query);
    const page = await listAnnouncementRecipients(decodedToken, {
      announcementId: String(req.params.announcementId || ''),
      startAfterUid: query.startAfterUid,
      status: query.status
    });

    res.json(page);
  } catch (error) {
    next(error);
  }
});
