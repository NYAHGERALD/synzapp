import { Router } from 'express';
import { z } from 'zod';
import { verifyAppCheck } from '../middleware/appCheck.js';
import { verifyFirebaseSession } from '../services/authSessionService.js';
import { getLswContext } from '../services/lswService.js';

const lswRouter = Router();

const lswContextQuerySchema = z.object({
  week: z.coerce.number().int().min(-60).max(120).optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional()
});

lswRouter.get('/context', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const query = lswContextQuerySchema.parse(req.query);
    const context = await getLswContext(decodedToken, query);

    res.json({ context });
  } catch (error) {
    next(error);
  }
});

async function getDecodedToken(authorizationHeader: string) {
  const idToken = authorizationHeader.startsWith('Bearer ')
    ? authorizationHeader.slice('Bearer '.length)
    : '';

  if (!idToken) {
    const error = new Error('Missing Firebase ID token.');
    error.name = 'AuthenticationError';
    throw error;
  }

  return verifyFirebaseSession(idToken);
}

export { lswRouter };
