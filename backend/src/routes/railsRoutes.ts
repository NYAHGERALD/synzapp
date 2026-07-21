import { Router } from 'express';
import { z } from 'zod';
import { verifyAppCheck } from '../middleware/appCheck.js';
import { verifyFirebaseSession } from '../services/authSessionService.js';
import {
  addRailsAction,
  addRailsCollaborator,
  addRailsComment,
  addRailsEvidence,
  bulkUpdateRailsItems,
  createRailsItem,
  exportRailsHistoryCsv,
  exportRailsHistoryJson,
  getRailsEvidenceFile,
  getRailsReport,
  getRailsStandardizationDocumentVersionFile,
  listRailsItemActivity,
  listRailsHistory,
  listRailsLswSourceCandidates,
  listRailsRcaCandidates,
  listRailsUserCandidates,
  listRailsWorkspace,
  removeRailsCollaborator,
  requestRailsRcaTriage,
  updateRailsRcaTriageRequest,
  convertRailsRcaTriageToIncident,
  deleteRailsAction,
  deleteRailsEvidence,
  updateRailsAction,
  updateRailsItem,
  reorderRailsAction
} from '../services/railsService.js';
import { askRailsKnowledgeBase } from '../services/railsKnowledgeService.js';

const railsRouter = Router();

const railsStatusSchema = z.enum(['New', 'Triaged', 'In Progress', 'Verification', 'Approved', 'Closed', 'Reopened', 'Cancelled', 'Archived']);
const railsPrioritySchema = z.enum(['Critical', 'High', 'Medium', 'Low']);
const railsCategorySchema = z.enum(['Food Safety', 'People Safety', 'Quality', 'Delivery', 'Cost', 'Process']);
const railsStandardizationStatusSchema = z.enum(['Not Started', 'In Progress', 'Implemented', 'Verified']);
const railsStandardizationTypeSchema = z.enum(['SOP', 'Checklist', 'LSW Audit', 'Training', 'PM Task', 'Visual Control', 'Work Instruction', 'Other']);
const railsLswSourceTypeSchema = z.enum(['todoTask', 'meetingRail', 'followUp', 'rcaTrigger', 'improvementProject']);
const railsRcaTriageStatusSchema = z.enum(['Requested', 'Accepted', 'Rejected', 'Converted']);
const railsItemIdParamSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{8,128}$/);

const railsItemBodySchema = z.object({
  approverUid: z.string().trim().max(128).nullable().optional(),
  category: railsCategorySchema.optional(),
  contributorUids: z.array(z.string().trim().max(128)).max(20).optional(),
  dueDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ownerUid: z.string().trim().max(128).optional(),
  priority: railsPrioritySchema.optional(),
  problem: z.string().trim().max(600).optional(),
  linkedLswSourceId: z.string().trim().max(128).nullable().optional(),
  linkedLswSourceType: railsLswSourceTypeSchema.nullable().optional(),
  reopenReason: z.string().trim().max(500).optional(),
  source: z.string().trim().max(80).optional(),
  title: z.string().trim().min(1).max(180).optional()
});

const railsItemPatchSchema = z.object({
  approverUid: z.string().trim().max(128).nullable().optional(),
  archiveReason: z.string().trim().max(500).optional(),
  cancelReason: z.string().trim().max(500).optional(),
  category: railsCategorySchema.optional(),
  dueDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  linkedRca: z.string().trim().max(160).optional(),
  linkedRcaDecisionReason: z.string().trim().max(900).optional(),
  linkedRcaId: z.string().trim().max(128).nullable().optional(),
  linkedLswSourceId: z.string().trim().max(128).nullable().optional(),
  linkedLswSourceType: railsLswSourceTypeSchema.nullable().optional(),
  ownerUid: z.string().trim().max(128).optional(),
  priority: railsPrioritySchema.optional(),
  problem: z.string().trim().max(600).optional(),
  reopenReason: z.string().trim().max(500).optional(),
  source: z.string().trim().max(80).optional(),
  standardization: z.string().trim().max(600).optional(),
  standardizationDueDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  standardizationOwnerUid: z.string().trim().max(128).nullable().optional(),
  standardizationStatus: railsStandardizationStatusSchema.optional(),
  standardizationType: railsStandardizationTypeSchema.nullable().optional(),
  standardizationVerification: z.string().trim().max(600).optional(),
  status: railsStatusSchema.optional(),
  title: z.string().trim().min(1).max(180).optional(),
  verification: z.string().trim().max(360).optional()
});

const railsCollaboratorBodySchema = z.object({
  userId: z.string().trim().min(1).max(128)
});

const railsActionStatusSchema = z.enum(['Open', 'In Progress', 'Blocked', 'Done']);

const railsActionBodySchema = z.object({
  completedAtCorrectionReason: z.string().trim().max(500).optional(),
  completedAtIso: z.string().trim().datetime().nullable().optional(),
  completedByExternalName: z.string().trim().max(120).optional(),
  completedByUid: z.string().trim().max(128).nullable().optional(),
  containmentNote: z.string().trim().max(900).optional(),
  dueDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  effectivenessCriteria: z.string().trim().max(900).optional(),
  effectivenessResult: z.string().trim().max(900).optional(),
  evidenceIds: z.array(z.string().trim().max(128)).max(20).optional(),
  implementationNote: z.string().trim().max(900).optional(),
  ownerUid: z.string().trim().max(128).optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  riskControlled: z.string().trim().max(600).optional(),
  startedAtCorrectionReason: z.string().trim().max(500).optional(),
  startedAtIso: z.string().trim().datetime().nullable().optional(),
  startedByUid: z.string().trim().max(128).nullable().optional(),
  standardizationNote: z.string().trim().max(900).optional(),
  title: z.string().trim().min(1).max(180).optional(),
  verificationNote: z.string().trim().max(900).optional(),
  verifiedByUid: z.string().trim().max(128).nullable().optional()
});

const railsActionPatchSchema = z.object({
  completedAtCorrectionReason: z.string().trim().max(500).optional(),
  completedAtIso: z.string().trim().datetime().nullable().optional(),
  completedByExternalName: z.string().trim().max(120).optional(),
  completedByUid: z.string().trim().max(128).nullable().optional(),
  containmentNote: z.string().trim().max(900).optional(),
  dueDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  effectivenessCriteria: z.string().trim().max(900).optional(),
  effectivenessResult: z.string().trim().max(900).optional(),
  evidenceIds: z.array(z.string().trim().max(128)).max(20).optional(),
  implementationNote: z.string().trim().max(900).optional(),
  ownerUid: z.string().trim().max(128).optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  riskControlled: z.string().trim().max(600).optional(),
  startedAtCorrectionReason: z.string().trim().max(500).optional(),
  startedAtIso: z.string().trim().datetime().nullable().optional(),
  startedByUid: z.string().trim().max(128).nullable().optional(),
  status: railsActionStatusSchema.optional(),
  standardizationNote: z.string().trim().max(900).optional(),
  title: z.string().trim().min(1).max(180).optional(),
  verificationNote: z.string().trim().max(900).optional(),
  verifiedByUid: z.string().trim().max(128).nullable().optional()
});

const railsActionIdParamSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{8,128}$/);
const railsActionReorderBodySchema = z.object({
  direction: z.enum(['up', 'down'])
});

const railsRcaTriageRequestBodySchema = z.object({
  assignedToUid: z.string().trim().max(128).nullable().optional(),
  dueDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  reason: z.string().trim().max(900).optional()
});

const railsRcaTriageReviewBodySchema = z.object({
  assignedToUid: z.string().trim().max(128).nullable().optional(),
  dueDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  reviewNote: z.string().trim().max(900).optional(),
  status: railsRcaTriageStatusSchema.optional()
});

const railsEvidenceBodySchema = z.object({
  dataUrl: z.string().max(6_000_000).optional(),
  evidenceId: z.string().trim().max(128).optional(),
  fileName: z.string().trim().max(180).optional(),
  label: z.string().trim().min(1).max(140).optional(),
  note: z.string().trim().max(360).optional(),
  purpose: z.enum(['general', 'standardization']).optional(),
  sourceEvidenceId: z.string().trim().max(128).nullable().optional(),
  status: z.enum(['Attached', 'Required', 'Review']).optional(),
  visibility: z.enum(['public', 'private']).optional()
});

const railsCommentBodySchema = z.object({
  body: z.string().trim().min(1).max(800)
});

const railsKnowledgeAskBodySchema = z.object({
  itemId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,128}$/).optional(),
  question: z.string().trim().min(3).max(1_200)
});

const railsBulkPatchSchema = railsItemPatchSchema.pick({
  archiveReason: true,
  category: true,
  dueDate: true,
  ownerUid: true,
  priority: true,
  status: true
});

const railsBulkUpdateBodySchema = z.object({
  collaboratorUid: z.string().trim().max(128).optional(),
  itemIds: z.array(railsItemIdParamSchema).min(1).max(50),
  patch: railsBulkPatchSchema.optional()
});

const railsHistoryQuerySchema = z.object({
  category: railsCategorySchema.optional(),
  dateFrom: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  departmentName: z.string().trim().max(120).optional(),
  ownerUid: z.string().trim().max(128).optional(),
  priority: railsPrioritySchema.optional(),
  search: z.string().trim().max(160).optional(),
  status: z.union([railsStatusSchema, z.literal('All')]).optional()
});

railsRouter.get('/workspace', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const workspace = await listRailsWorkspace(decodedToken);

    res.json(workspace);
  } catch (error) {
    next(error);
  }
});

railsRouter.get('/users', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const users = await listRailsUserCandidates(decodedToken);

    res.json({ users });
  } catch (error) {
    next(error);
  }
});

railsRouter.get('/report', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const report = await getRailsReport(decodedToken);

    res.json({ report });
  } catch (error) {
    next(error);
  }
});

railsRouter.get('/history', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const query = railsHistoryQuerySchema.parse(req.query);
    const history = await listRailsHistory(decodedToken, query);

    res.json(history);
  } catch (error) {
    next(error);
  }
});

railsRouter.get('/export', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const query = railsHistoryQuerySchema.parse(req.query);
    const exportResult = await exportRailsHistoryCsv(decodedToken, query);

    res.setHeader('Content-Type', exportResult.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.fileName}"`);
    res.send(exportResult.content);
  } catch (error) {
    next(error);
  }
});

railsRouter.get('/export/json', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const query = railsHistoryQuerySchema.parse(req.query);
    const exportResult = await exportRailsHistoryJson(decodedToken, query);

    res.setHeader('Content-Type', exportResult.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.fileName}"`);
    res.send(exportResult.content);
  } catch (error) {
    next(error);
  }
});

railsRouter.get('/rca-candidates', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const rcaCandidates = await listRailsRcaCandidates(decodedToken);

    res.json({ rcaCandidates });
  } catch (error) {
    next(error);
  }
});

railsRouter.get('/lsw-candidates', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const lswCandidates = await listRailsLswSourceCandidates(decodedToken);

    res.json({ lswCandidates });
  } catch (error) {
    next(error);
  }
});

railsRouter.post('/knowledge/ask', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = railsKnowledgeAskBodySchema.parse(req.body);
    const answer = await askRailsKnowledgeBase(decodedToken, body);

    res.json(answer);
  } catch (error) {
    next(error);
  }
});

railsRouter.post('/items', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = railsItemBodySchema.parse(req.body);
    const item = await createRailsItem(decodedToken, body);

    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
});

railsRouter.patch('/items/:itemId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const itemId = railsItemIdParamSchema.parse(req.params.itemId);
    const body = railsItemPatchSchema.parse(req.body);
    const item = await updateRailsItem(decodedToken, itemId, body);

    res.json({ item });
  } catch (error) {
    next(error);
  }
});

railsRouter.post('/items/:itemId/rca-triage-request', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const itemId = railsItemIdParamSchema.parse(req.params.itemId);
    const body = railsRcaTriageRequestBodySchema.parse(req.body);
    const item = await requestRailsRcaTriage(decodedToken, itemId, body);

    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
});

railsRouter.patch('/items/:itemId/rca-triage-request', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const itemId = railsItemIdParamSchema.parse(req.params.itemId);
    const body = railsRcaTriageReviewBodySchema.parse(req.body);
    const item = await updateRailsRcaTriageRequest(decodedToken, itemId, body);

    res.json({ item });
  } catch (error) {
    next(error);
  }
});

railsRouter.post('/items/:itemId/rca-triage-request/convert', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const itemId = railsItemIdParamSchema.parse(req.params.itemId);
    const item = await convertRailsRcaTriageToIncident(decodedToken, itemId);

    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
});

railsRouter.post('/items/bulk-update', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = railsBulkUpdateBodySchema.parse(req.body);
    const result = await bulkUpdateRailsItems(decodedToken, body);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

railsRouter.post('/items/:itemId/collaborators', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const itemId = railsItemIdParamSchema.parse(req.params.itemId);
    const body = railsCollaboratorBodySchema.parse(req.body);
    const item = await addRailsCollaborator(decodedToken, itemId, body.userId);

    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
});

railsRouter.delete('/items/:itemId/collaborators/:userId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const itemId = railsItemIdParamSchema.parse(req.params.itemId);
    const userId = z.string().trim().min(1).max(128).parse(req.params.userId);
    const item = await removeRailsCollaborator(decodedToken, itemId, userId);

    res.json({ item });
  } catch (error) {
    next(error);
  }
});

railsRouter.post('/items/:itemId/actions', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const itemId = railsItemIdParamSchema.parse(req.params.itemId);
    const body = railsActionBodySchema.parse(req.body);
    const item = await addRailsAction(decodedToken, itemId, body);

    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
});

railsRouter.patch('/items/:itemId/actions/:actionId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const itemId = railsItemIdParamSchema.parse(req.params.itemId);
    const actionId = railsActionIdParamSchema.parse(req.params.actionId);
    const body = railsActionPatchSchema.parse(req.body);
    const item = await updateRailsAction(decodedToken, itemId, actionId, body);

    res.json({ item });
  } catch (error) {
    next(error);
  }
});

railsRouter.post('/items/:itemId/actions/:actionId/reorder', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const itemId = railsItemIdParamSchema.parse(req.params.itemId);
    const actionId = railsActionIdParamSchema.parse(req.params.actionId);
    const body = railsActionReorderBodySchema.parse(req.body);
    const item = await reorderRailsAction(decodedToken, itemId, actionId, body.direction);

    res.json({ item });
  } catch (error) {
    next(error);
  }
});

railsRouter.delete('/items/:itemId/actions/:actionId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const itemId = railsItemIdParamSchema.parse(req.params.itemId);
    const actionId = railsActionIdParamSchema.parse(req.params.actionId);
    const item = await deleteRailsAction(decodedToken, itemId, actionId);

    res.json({ item });
  } catch (error) {
    next(error);
  }
});

railsRouter.get('/items/:itemId/activity', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const itemId = railsItemIdParamSchema.parse(req.params.itemId);
    const activity = await listRailsItemActivity(decodedToken, itemId);

    res.json(activity);
  } catch (error) {
    next(error);
  }
});

railsRouter.post('/items/:itemId/evidence', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const itemId = railsItemIdParamSchema.parse(req.params.itemId);
    const body = railsEvidenceBodySchema.parse(req.body);
    const item = await addRailsEvidence(decodedToken, itemId, body);

    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
});

railsRouter.delete('/items/:itemId/evidence/:evidenceId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const itemId = railsItemIdParamSchema.parse(req.params.itemId);
    const evidenceId = z.string().trim().regex(/^ev_[A-Fa-f0-9]{32}$/).parse(req.params.evidenceId);
    const item = await deleteRailsEvidence(decodedToken, itemId, evidenceId);

    res.json({ item });
  } catch (error) {
    next(error);
  }
});

railsRouter.get('/items/:itemId/evidence/:evidenceId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const itemId = railsItemIdParamSchema.parse(req.params.itemId);
    const evidenceId = z.string().trim().regex(/^ev_[A-Fa-f0-9]{32}$/).parse(req.params.evidenceId);
    const evidenceFile = await getRailsEvidenceFile(decodedToken, itemId, evidenceId);

    res.setHeader('Content-Type', evidenceFile.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(evidenceFile.fileName)}"`);
    res.send(evidenceFile.payload);
  } catch (error) {
    next(error);
  }
});

railsRouter.get('/items/:itemId/standardization-documents/:versionId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const itemId = railsItemIdParamSchema.parse(req.params.itemId);
    const versionId = z.string().trim().regex(/^stdv_[A-Fa-f0-9]{32}$/).parse(req.params.versionId);
    const versionFile = await getRailsStandardizationDocumentVersionFile(decodedToken, itemId, versionId);

    res.setHeader('Content-Type', versionFile.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(versionFile.fileName)}"`);
    res.send(versionFile.payload);
  } catch (error) {
    next(error);
  }
});

railsRouter.post('/items/:itemId/comments', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const itemId = railsItemIdParamSchema.parse(req.params.itemId);
    const body = railsCommentBodySchema.parse(req.body);
    const item = await addRailsComment(decodedToken, itemId, body.body);

    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
});

async function getDecodedToken(authorizationHeader: string) {
  const idToken = authorizationHeader.startsWith('Bearer ')
    ? authorizationHeader.slice('Bearer '.length)
    : authorizationHeader;

  if (!idToken) {
    throw authorizationError('Missing authorization token.');
  }

  return verifyFirebaseSession(idToken);
}

function authorizationError(message: string): Error {
  const error = new Error(message);
  error.name = 'AuthenticationError';
  return error;
}

export { railsRouter };
