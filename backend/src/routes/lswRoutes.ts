import { Router } from 'express';
import { z } from 'zod';
import { verifyAppCheck } from '../middleware/appCheck.js';
import { verifyFirebaseSession } from '../services/authSessionService.js';
import {
  createLswDailyTask,
  deleteLswDailyTask,
  getLswContext,
  listLswDailyTasks,
  updateLswDailyTask,
  updateLswSettings
} from '../services/lswService.js';

const lswRouter = Router();

const lswContextQuerySchema = z.object({
  week: z.coerce.number().int().min(-60).max(120).optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional()
});

const daySelectionSchema = z.object({
  fri: z.boolean().optional(),
  mon: z.boolean().optional(),
  sat: z.boolean().optional(),
  sun: z.boolean().optional(),
  thu: z.boolean().optional(),
  tue: z.boolean().optional(),
  wed: z.boolean().optional()
});

const dailyTaskBodySchema = z.object({
  days: daySelectionSchema.optional(),
  minutes: z.number().int().min(0).max(1440).optional(),
  sortOrder: z.number().int().min(0).max(1_000_000_000).optional(),
  task: z.string().trim().max(240).optional(),
  time: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional()
});

const lswSettingsBodySchema = z.object({
  workDaysPerWeek: z.union([z.literal(5), z.literal(6), z.literal(7)])
});

const taskIdParamSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{8,128}$/);

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

lswRouter.patch('/settings', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = lswSettingsBodySchema.parse(req.body);
    const settings = await updateLswSettings(decodedToken, body);

    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

lswRouter.get('/daily-tasks', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const dailyTasks = await listLswDailyTasks(decodedToken);

    res.json({ dailyTasks });
  } catch (error) {
    next(error);
  }
});

lswRouter.post('/daily-tasks', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = dailyTaskBodySchema.parse(req.body);
    const task = await createLswDailyTask(decodedToken, body);

    res.status(201).json({ task });
  } catch (error) {
    next(error);
  }
});

lswRouter.patch('/daily-tasks/:taskId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const taskId = taskIdParamSchema.parse(req.params.taskId);
    const body = dailyTaskBodySchema.parse(req.body);
    const task = await updateLswDailyTask(decodedToken, taskId, body);

    res.json({ task });
  } catch (error) {
    next(error);
  }
});

lswRouter.delete('/daily-tasks/:taskId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const taskId = taskIdParamSchema.parse(req.params.taskId);

    await deleteLswDailyTask(decodedToken, taskId);

    res.status(204).end();
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
