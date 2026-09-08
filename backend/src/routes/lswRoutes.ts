import { Router } from 'express';
import { z } from 'zod';
import { verifyAppCheck } from '../middleware/appCheck.js';
import { verifyFirebaseSession } from '../services/authSessionService.js';
import { getCompanyKeyResultsForCurrentUser } from '../services/keyResultsService.js';
import { writeAuditEvent } from '../services/auditService.js';
import { generateLswExcelExport } from '../services/lswExcelExportService.js';
import {
  createLswDailyTask,
  createLswFollowUp,
  createLswImprovementProject,
  createLswMeetingRail,
  createLswPersonalGoal,
  createLswRcaTrigger,
  createLswScheduledTask,
  createLswTodoTask,
  deleteLswDailyTask,
  deleteLswFollowUp,
  deleteLswImprovementProject,
  deleteLswMeetingRail,
  deleteLswPersonalGoal,
  deleteLswRcaTrigger,
  deleteLswScheduledTask,
  deleteLswTodoTask,
  getLswContext,
  getLswObservationStatus,
  getLswWeeklyVerificationSummary,
  createLswObservationNote,
  listLswObservationCandidates,
  listLswObservationNotes,
  listLswDailyTasks,
  listLswFollowUps,
  listLswImprovementProjects,
  listLswMeetingRails,
  listLswPersonalGoals,
  listLswRcaTriggers,
  listLswScheduledTasks,
  listLswTodoTasks,
  updateLswDailyTask,
  recordLswObservationView,
  updateLswObservationAvailability,
  updateLswFollowUp,
  updateLswImprovementProject,
  updateLswMeetingRail,
  updateLswPersonalGoal,
  updateLswRcaTrigger,
  updateLswScheduledTask,
  updateLswTodoTask,
  updateLswSettings,
  withdrawLswObservationNote
} from '../services/lswService.js';

const lswRouter = Router();

const lswContextQuerySchema = z.object({
  observeUserId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,128}$/).optional(),
  timeZone: z.string().trim().max(80).optional(),
  week: z.coerce.number().int().min(-60).max(120).optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional()
});

const lswExportQuerySchema = lswContextQuerySchema.extend({
  includePastDueFollowUps: z.coerce.boolean().optional(),
  includePastDueGoals: z.coerce.boolean().optional(),
  includePastDueRails: z.coerce.boolean().optional(),
  includePastDueScheduledTasks: z.coerce.boolean().optional(),
  includePastDueTriggers: z.coerce.boolean().optional()
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

const dayStatusValueSchema = z.enum(['not_completed', 'completed_on_time', 'completed_late', 'completed_early']);

const dayStatusUpdateSchema = z.object({
  completedAtIso: z.string().datetime().optional(),
  dueAtIso: z.string().datetime().optional(),
  status: dayStatusValueSchema,
  timeZone: z.string().trim().max(80).optional()
});

const dayStatusUpdatesSchema = z.object({
  fri: dayStatusUpdateSchema.optional(),
  mon: dayStatusUpdateSchema.optional(),
  sat: dayStatusUpdateSchema.optional(),
  sun: dayStatusUpdateSchema.optional(),
  thu: dayStatusUpdateSchema.optional(),
  tue: dayStatusUpdateSchema.optional(),
  wed: dayStatusUpdateSchema.optional()
});

const dailyTaskBodySchema = z.object({
  dayStatusUpdates: dayStatusUpdatesSchema.optional(),
  days: daySelectionSchema.optional(),
  minutes: z.number().int().min(0).max(1440).optional(),
  sortOrder: z.number().int().min(0).max(1_000_000_000).optional(),
  task: z.string().trim().max(240).optional(),
  time: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional()
});

const todoTaskBodySchema = z.object({
  completed: z.boolean().optional(),
  completedAtIso: z.string().datetime().optional(),
  dueDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueTime: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  sortOrder: z.number().int().min(0).max(1_000_000_000).optional(),
  task: z.string().trim().max(240).optional(),
  timeZone: z.string().trim().max(80).optional()
});

const meetingRailBodySchema = z.object({
  completed: z.boolean().optional(),
  dueDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueTime: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  rail: z.string().trim().max(240).optional(),
  sortOrder: z.number().int().min(0).max(1_000_000_000).optional(),
  timeZone: z.string().trim().max(80).optional()
});

const personalGoalBodySchema = z.object({
  dueDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  objective: z.string().trim().max(360).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  sortOrder: z.number().int().min(0).max(1_000_000_000).optional(),
  timeZone: z.string().trim().max(80).optional()
});

const followUpBodySchema = z.object({
  comments: z.string().trim().max(480).optional(),
  dueDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  followUp: z.string().trim().max(240).optional(),
  responsible: z.string().trim().max(160).optional(),
  sortOrder: z.number().int().min(0).max(1_000_000_000).optional(),
  timeZone: z.string().trim().max(80).optional()
});

const rcaTriggerBodySchema = z.object({
  comments: z.string().trim().max(480).optional(),
  eventDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sortOrder: z.number().int().min(0).max(1_000_000_000).optional(),
  timeZone: z.string().trim().max(80).optional(),
  trigger: z.string().trim().max(360).optional()
});

const improvementProjectUpdateSchema = z.object({
  sortOrder: z.number().int().min(0).max(1_000_000_000).optional(),
  status: z.string().trim().max(24).optional(),
  text: z.string().trim().max(480).optional(),
  updateId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,128}$/).optional()
});

const improvementProjectBodySchema = z.object({
  project: z.string().trim().max(360).optional(),
  sortOrder: z.number().int().min(0).max(1_000_000_000).optional(),
  updates: z.array(improvementProjectUpdateSchema).max(24).optional()
});

const scheduledTaskFrequencySchema = z.enum(['BI_WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY']);
const lswObservationAvailabilitySchema = z.enum(['ACTIVE', 'ON_LEAVE', 'TEMPORARILY_UNAVAILABLE']);
const lswObservationSectionKeySchema = z.enum([
  'daily_weekly_standard_tasks',
  'plant_specific_cause_rca_triggers',
  'to_do_today_this_week',
  'level_1_2_3_meeting_rails',
  'improvement_projects_updates',
  'follow_ups',
  'scheduled_tasks_meetings',
  'personal_objectives_goals'
]);

const scheduledTaskBodySchema = z.object({
  dueDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  frequency: scheduledTaskFrequencySchema.optional(),
  minutes: z.number().int().min(0).max(1440).optional(),
  sortOrder: z.number().int().min(0).max(1_000_000_000).optional(),
  task: z.string().trim().max(240).optional(),
  timeZone: z.string().trim().max(80).optional()
});

const lswSettingsBodySchema = z.object({
  workDaysPerWeek: z.union([z.literal(5), z.literal(6), z.literal(7)])
});

const observationAvailabilityBodySchema = z.object({
  availability: lswObservationAvailabilitySchema,
  endDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().trim().max(240).optional()
});

const observationNoteBodySchema = z.object({
  body: z.string().trim().min(1).max(800),
  sectionKey: lswObservationSectionKeySchema
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

lswRouter.get('/key-results', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const keyResults = await getCompanyKeyResultsForCurrentUser(decodedToken);

    res.json({ keyResults });
  } catch (error) {
    next(error);
  }
});

lswRouter.get('/verification-summary', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const query = lswContextQuerySchema.parse(req.query);
    const verificationSummary = await getLswWeeklyVerificationSummary(decodedToken, query);

    res.json({ verificationSummary });
  } catch (error) {
    next(error);
  }
});

lswRouter.get('/export', verifyAppCheck, async (req, res, next) => {
  let decodedToken: Awaited<ReturnType<typeof getDecodedToken>> | null = null;

  try {
    decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const query = lswExportQuerySchema.parse(req.query);
    const exportResult = await generateLswExcelExport(decodedToken, query);

    await writeAuditEvent({
      action: 'LSW_EXCEL_EXPORT',
      metadata: {
        departmentName: exportResult.metadata.departmentName,
        fileName: exportResult.fileName,
        isObservation: exportResult.metadata.isObservation,
        ownerUid: exportResult.metadata.ownerUid,
        week: exportResult.metadata.week,
        year: exportResult.metadata.year
      },
      req,
      status: 'SUCCESS',
      tenantId: exportResult.metadata.tenantId,
      uid: decodedToken.uid
    }).catch((error) => {
      console.warn('Unable to write LSW export audit event:', error);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.fileName}"`);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.send(exportResult.buffer);
  } catch (error) {
    if (decodedToken) {
      await writeAuditEvent({
        action: 'LSW_EXCEL_EXPORT',
        metadata: {
          query: req.query
        },
        reason: error instanceof Error ? error.message : 'Unknown export failure',
        req,
        status: 'FAILED',
        uid: decodedToken.uid
      }).catch((auditError) => {
        console.warn('Unable to write failed LSW export audit event:', auditError);
      });
    }

    next(error);
  }
});

lswRouter.get('/observation-candidates', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const candidates = await listLswObservationCandidates(decodedToken);

    res.json({ candidates });
  } catch (error) {
    next(error);
  }
});

lswRouter.get('/observation-status', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const query = lswContextQuerySchema.parse(req.query);
    const status = await getLswObservationStatus(decodedToken, query);

    res.json({ status });
  } catch (error) {
    next(error);
  }
});

lswRouter.patch('/observation-availability', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = observationAvailabilityBodySchema.parse(req.body);
    const status = await updateLswObservationAvailability(decodedToken, body);

    res.json({ status });
  } catch (error) {
    next(error);
  }
});

lswRouter.post('/observation-view', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const query = lswContextQuerySchema.parse(req.query);
    const status = await recordLswObservationView(decodedToken, query);

    res.status(201).json({ status });
  } catch (error) {
    next(error);
  }
});

lswRouter.get('/observation-notes', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const query = lswContextQuerySchema.parse(req.query);
    const notes = await listLswObservationNotes(decodedToken, query);

    res.json({ notes });
  } catch (error) {
    next(error);
  }
});

lswRouter.post('/observation-notes', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const query = lswContextQuerySchema.parse(req.query);
    const body = observationNoteBodySchema.parse(req.body);
    const note = await createLswObservationNote(decodedToken, { ...body, ...query });

    res.status(201).json({ note });
  } catch (error) {
    next(error);
  }
});

lswRouter.delete('/observation-notes/:noteId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const query = lswContextQuerySchema.parse(req.query);
    const noteId = taskIdParamSchema.parse(req.params.noteId);

    await withdrawLswObservationNote(decodedToken, noteId, query);

    res.status(204).end();
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
    const query = lswContextQuerySchema.parse(req.query);
    const dailyTasks = await listLswDailyTasks(decodedToken, query);

    res.json({ dailyTasks });
  } catch (error) {
    next(error);
  }
});

lswRouter.post('/daily-tasks', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = dailyTaskBodySchema.parse(req.body);
    const query = lswContextQuerySchema.parse(req.query);
    const task = await createLswDailyTask(decodedToken, body, query);

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
    const query = lswContextQuerySchema.parse(req.query);
    const task = await updateLswDailyTask(decodedToken, taskId, body, query);

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

lswRouter.get('/todo-tasks', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const query = lswContextQuerySchema.parse(req.query);
    const todoTasks = await listLswTodoTasks(decodedToken, query);

    res.json({ todoTasks });
  } catch (error) {
    next(error);
  }
});

lswRouter.post('/todo-tasks', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = todoTaskBodySchema.parse(req.body);
    const query = lswContextQuerySchema.parse(req.query);
    const task = await createLswTodoTask(decodedToken, body, query);

    res.status(201).json({ task });
  } catch (error) {
    next(error);
  }
});

lswRouter.patch('/todo-tasks/:taskId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const taskId = taskIdParamSchema.parse(req.params.taskId);
    const body = todoTaskBodySchema.parse(req.body);
    const task = await updateLswTodoTask(decodedToken, taskId, body);

    res.json({ task });
  } catch (error) {
    next(error);
  }
});

lswRouter.delete('/todo-tasks/:taskId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const taskId = taskIdParamSchema.parse(req.params.taskId);

    await deleteLswTodoTask(decodedToken, taskId);

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

lswRouter.get('/meeting-rails', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const query = lswContextQuerySchema.parse(req.query);
    const meetingRails = await listLswMeetingRails(decodedToken, query);

    res.json({ meetingRails });
  } catch (error) {
    next(error);
  }
});

lswRouter.post('/meeting-rails', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = meetingRailBodySchema.parse(req.body);
    const query = lswContextQuerySchema.parse(req.query);
    const rail = await createLswMeetingRail(decodedToken, body, query);

    res.status(201).json({ rail });
  } catch (error) {
    next(error);
  }
});

lswRouter.patch('/meeting-rails/:railId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const railId = taskIdParamSchema.parse(req.params.railId);
    const body = meetingRailBodySchema.parse(req.body);
    const rail = await updateLswMeetingRail(decodedToken, railId, body);

    res.json({ rail });
  } catch (error) {
    next(error);
  }
});

lswRouter.delete('/meeting-rails/:railId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const railId = taskIdParamSchema.parse(req.params.railId);

    await deleteLswMeetingRail(decodedToken, railId);

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

lswRouter.get('/personal-goals', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const query = lswContextQuerySchema.parse(req.query);
    const personalGoals = await listLswPersonalGoals(decodedToken, query);

    res.json({ personalGoals });
  } catch (error) {
    next(error);
  }
});

lswRouter.post('/personal-goals', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = personalGoalBodySchema.parse(req.body);
    const goal = await createLswPersonalGoal(decodedToken, body);

    res.status(201).json({ goal });
  } catch (error) {
    next(error);
  }
});

lswRouter.patch('/personal-goals/:goalId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const goalId = taskIdParamSchema.parse(req.params.goalId);
    const body = personalGoalBodySchema.parse(req.body);
    const goal = await updateLswPersonalGoal(decodedToken, goalId, body);

    res.json({ goal });
  } catch (error) {
    next(error);
  }
});

lswRouter.delete('/personal-goals/:goalId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const goalId = taskIdParamSchema.parse(req.params.goalId);

    await deleteLswPersonalGoal(decodedToken, goalId);

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

lswRouter.get('/improvement-projects', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const query = lswContextQuerySchema.parse(req.query);
    const improvementProjects = await listLswImprovementProjects(decodedToken, query);

    res.json({ improvementProjects });
  } catch (error) {
    next(error);
  }
});

lswRouter.post('/improvement-projects', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = improvementProjectBodySchema.parse(req.body);
    const project = await createLswImprovementProject(decodedToken, body);

    res.status(201).json({ project });
  } catch (error) {
    next(error);
  }
});

lswRouter.patch('/improvement-projects/:projectId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const projectId = taskIdParamSchema.parse(req.params.projectId);
    const body = improvementProjectBodySchema.parse(req.body);
    const project = await updateLswImprovementProject(decodedToken, projectId, body);

    res.json({ project });
  } catch (error) {
    next(error);
  }
});

lswRouter.delete('/improvement-projects/:projectId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const projectId = taskIdParamSchema.parse(req.params.projectId);

    await deleteLswImprovementProject(decodedToken, projectId);

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

lswRouter.get('/scheduled-tasks', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const query = lswContextQuerySchema.parse(req.query);
    const scheduledTasks = await listLswScheduledTasks(decodedToken, query);

    res.json({ scheduledTasks });
  } catch (error) {
    next(error);
  }
});

lswRouter.post('/scheduled-tasks', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = scheduledTaskBodySchema.parse(req.body);
    const task = await createLswScheduledTask(decodedToken, body);

    res.status(201).json({ task });
  } catch (error) {
    next(error);
  }
});

lswRouter.patch('/scheduled-tasks/:taskId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const taskId = taskIdParamSchema.parse(req.params.taskId);
    const body = scheduledTaskBodySchema.parse(req.body);
    const task = await updateLswScheduledTask(decodedToken, taskId, body);

    res.json({ task });
  } catch (error) {
    next(error);
  }
});

lswRouter.delete('/scheduled-tasks/:taskId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const taskId = taskIdParamSchema.parse(req.params.taskId);

    await deleteLswScheduledTask(decodedToken, taskId);

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

lswRouter.get('/follow-ups', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const query = lswContextQuerySchema.parse(req.query);
    const followUps = await listLswFollowUps(decodedToken, query);

    res.json({ followUps });
  } catch (error) {
    next(error);
  }
});

lswRouter.post('/follow-ups', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = followUpBodySchema.parse(req.body);
    const followUp = await createLswFollowUp(decodedToken, body);

    res.status(201).json({ followUp });
  } catch (error) {
    next(error);
  }
});

lswRouter.patch('/follow-ups/:followUpId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const followUpId = taskIdParamSchema.parse(req.params.followUpId);
    const body = followUpBodySchema.parse(req.body);
    const followUp = await updateLswFollowUp(decodedToken, followUpId, body);

    res.json({ followUp });
  } catch (error) {
    next(error);
  }
});

lswRouter.delete('/follow-ups/:followUpId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const followUpId = taskIdParamSchema.parse(req.params.followUpId);

    await deleteLswFollowUp(decodedToken, followUpId);

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

lswRouter.get('/rca-triggers', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const query = lswContextQuerySchema.parse(req.query);
    const rcaTriggers = await listLswRcaTriggers(decodedToken, query);

    res.json({ rcaTriggers });
  } catch (error) {
    next(error);
  }
});

lswRouter.post('/rca-triggers', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = rcaTriggerBodySchema.parse(req.body);
    const trigger = await createLswRcaTrigger(decodedToken, body);

    res.status(201).json({ trigger });
  } catch (error) {
    next(error);
  }
});

lswRouter.patch('/rca-triggers/:triggerId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const triggerId = taskIdParamSchema.parse(req.params.triggerId);
    const body = rcaTriggerBodySchema.parse(req.body);
    const trigger = await updateLswRcaTrigger(decodedToken, triggerId, body);

    res.json({ trigger });
  } catch (error) {
    next(error);
  }
});

lswRouter.delete('/rca-triggers/:triggerId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const triggerId = taskIdParamSchema.parse(req.params.triggerId);

    await deleteLswRcaTrigger(decodedToken, triggerId);

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
