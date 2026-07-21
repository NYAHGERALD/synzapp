import { Router } from 'express';
import { z } from 'zod';
import { verifyAppCheck } from '../middleware/appCheck.js';
import { buildAuthSession, verifyFirebaseSession } from '../services/authSessionService.js';
import { askRcaKnowledgeBase } from '../services/rcaKnowledgeService.js';
import {
  createRcaIncident,
  createRcaNode,
  createRcaSession,
  deleteRcaIncident,
  deleteRcaNode,
  getRcaIncident,
  getRcaEvidenceFile,
  getRcaWorkspaceContext,
  getRcaUserProfilePhoto,
  inviteRcaCollaborators,
  listRcaActivityLogs,
  listRcaCollaboratorCandidates,
  listRcaIncidents,
  listRcaNodes,
  listRcaSessions,
  recordRcaActivityLog,
  removeRcaCollaborator,
  uploadRcaEvidenceFile,
  updateRcaIncident,
  updateRcaNode,
  updateRcaSession
} from '../services/rcaService.js';
import {
  broadcastRcaActivityLogCreated,
  broadcastRcaMembershipChanged,
  broadcastRcaNodeCreated,
  broadcastRcaNodeDeleted,
  broadcastRcaNodeUpdated
} from '../services/rcaRealtimeService.js';

const rcaRouter = Router();

const idParamSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{8,128}$/);
const methodologySchema = z.enum(['5_WHYS', 'ISHIKAWA', 'FAULT_TREE']);
const sessionStatusSchema = z.enum(['ACTIVE', 'FREEZE', 'COMPLETED', 'CLOSED']);
const nodeTypeSchema = z.enum(['WHY', 'ISHIKAWA_CATEGORY', 'CAUSE', 'SUB_CAUSE', 'FAULT_GATE', 'STICKY_NOTE']);
const auditIntentSchema = z.enum(['MULTI_DELETED', 'REDO', 'SPLINE_DELETED', 'UNDO']);
const fiveWhysRoleSchema = z.enum([
  'INCIDENT_DETAILS',
  'CONTAINMENT',
  'EVIDENCE',
  'PROBLEM',
  'FIVE_WHYS',
  'ANSWER',
  'ROOT_CAUSE',
  'CAPA',
  'CORRECTIVE_ACTION',
  'PREVENTIVE_ACTION',
  'RISK_ASSESSMENT',
  'EFFECTIVENESS',
  'LESSONS_LEARNED',
  'APPROVAL_CLOSURE'
]);

const riskFactorsSchema = z.object({
  detection: z.coerce.number().int().min(1).max(10).optional(),
  occurrence: z.coerce.number().int().min(1).max(10).optional(),
  severity: z.coerce.number().int().min(1).max(10).optional()
});

const incidentBodySchema = z.object({
  assetId: z.string().trim().max(120).optional(),
  riskFactors: riskFactorsSchema.optional(),
  title: z.string().trim().max(180).optional()
});

const incidentUpdateBodySchema = z.object({
  title: z.string().trim().max(180).optional()
});

const collaboratorInviteBodySchema = z.object({
  userIds: z.array(idParamSchema).min(1).max(50)
});

const sessionBodySchema = z.object({
  methodology: methodologySchema.optional(),
  status: sessionStatusSchema.optional()
});

const knowledgeAskBodySchema = z.object({
  incidentId: idParamSchema.optional(),
  question: z.string().trim().min(3).max(1200),
  sessionId: idParamSchema.optional()
});

const evidenceUploadBodySchema = z.object({
  contentType: z.string().trim().max(120),
  dataUrl: z.string().trim().max(5_700_000),
  fileHash: z.string().trim().max(128).optional(),
  fileName: z.string().trim().max(180)
});

const evidenceBodySchema = z.object({
  fileHash: z.string().trim().max(128),
  fileName: z.string().trim().max(180),
  fileUrl: z.string().trim().max(320),
  uploadedAtIso: z.string().trim().max(40).optional()
});

const activityLogBodySchema = z.object({
  action: z.enum([
    'MULTI_DELETED',
    'NODE_CREATED',
    'NODE_DELETED',
    'NODE_TEXT_UPDATED',
    'NODE_UPDATED',
    'REDO',
    'SPLINE_CONNECTED',
    'SPLINE_DELETED',
    'SPLINE_DISCONNECTED',
    'UNDO'
  ]),
  nextValue: z.string().trim().max(8000).optional(),
  previousValue: z.string().trim().max(8000).optional(),
  summary: z.string().trim().max(1200).optional()
});

const visualStyleBodySchema = z.object({
  backgroundColor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  borderColor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  fontFamily: z.string().trim().max(40).nullable().optional(),
  fontSize: z.number().int().min(10).max(18).nullable().optional(),
  isBold: z.boolean().nullable().optional(),
  isItalic: z.boolean().nullable().optional(),
  isUnderline: z.boolean().nullable().optional(),
  textColor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional()
});

const edgeStyleBodySchema = z.object({
  arrowHead: z.enum(['OPEN', 'CLOSED', 'CLOSED_FILLED']).nullable().optional(),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  lineType: z.enum(['CONTINUOUS', 'DASHED', 'DOTTED']).nullable().optional(),
  weight: z.number().min(1.5).max(5).nullable().optional()
});

const nodeBodySchema = z.object({
  auditIntent: auditIntentSchema.optional(),
  attachedEvidence: z.array(evidenceBodySchema).max(24).optional(),
  dimensions: z.object({
    height: z.number().finite().min(96).max(720).nullable().optional(),
    width: z.number().finite().min(160).max(720).nullable().optional()
  }).optional(),
  edgeStyle: edgeStyleBodySchema.optional(),
  fiveWhysRole: fiveWhysRoleSchema.nullable().optional(),
  isRootCause: z.boolean().optional(),
  isSuspectedCause: z.boolean().optional(),
  label: z.string().trim().max(240).optional(),
  lockForEditing: z.boolean().optional(),
  nodeType: nodeTypeSchema.optional(),
  parentNodeId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,128}$/).nullable().optional(),
  releaseLock: z.boolean().optional(),
  status: z.literal('ACTIVE').optional(),
  uiCoordinates: z.object({
    layoutMethodology: methodologySchema.optional(),
    x: z.number().finite().min(-100_000).max(100_000).optional(),
    y: z.number().finite().min(-100_000).max(100_000).optional()
  }).optional(),
  visualStyle: visualStyleBodySchema.optional(),
  whyChain: z.array(z.string().trim().max(260)).max(5).optional()
});

rcaRouter.get('/context', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const context = await getRcaWorkspaceContext(decodedToken);

    res.json({ context });
  } catch (error) {
    next(error);
  }
});

rcaRouter.post('/knowledge/ask', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = knowledgeAskBodySchema.parse(req.body);
    const result = await askRcaKnowledgeBase(decodedToken, body);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

rcaRouter.get('/incidents', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const workspace = await listRcaIncidents(decodedToken);

    res.json(workspace);
  } catch (error) {
    next(error);
  }
});

rcaRouter.post('/incidents', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = incidentBodySchema.parse(req.body);
    const result = await createRcaIncident(decodedToken, body);

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

rcaRouter.patch('/incidents/:incidentId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const incidentId = idParamSchema.parse(req.params.incidentId);
    const body = incidentUpdateBodySchema.parse(req.body);
    const incident = await updateRcaIncident(decodedToken, incidentId, body);

    res.json({ incident });
  } catch (error) {
    next(error);
  }
});

rcaRouter.get('/incidents/:incidentId/collaborators/candidates', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const incidentId = idParamSchema.parse(req.params.incidentId);
    const result = await listRcaCollaboratorCandidates(decodedToken, incidentId);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

rcaRouter.post('/incidents/:incidentId/collaborators/invite', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const incidentId = idParamSchema.parse(req.params.incidentId);
    const body = collaboratorInviteBodySchema.parse(req.body);
    const result = await inviteRcaCollaborators(decodedToken, incidentId, body.userIds);

    broadcastRcaMembershipChanged({
      action: 'INVITED',
      actorUid: decodedToken.uid,
      incident: result.incident,
      invitedUsers: result.invitedUsers
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

rcaRouter.delete('/incidents/:incidentId/collaborators/:userId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const incidentId = idParamSchema.parse(req.params.incidentId);
    const userId = idParamSchema.parse(req.params.userId);
    const result = await removeRcaCollaborator(decodedToken, incidentId, userId);

    broadcastRcaMembershipChanged({
      action: 'REMOVED',
      actorUid: decodedToken.uid,
      incident: result.incident,
      removedAtIso: result.removedAtIso,
      removedUser: result.removedUser
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

rcaRouter.delete('/incidents/:incidentId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const incidentId = idParamSchema.parse(req.params.incidentId);

    const result = await deleteRcaIncident(decodedToken, incidentId);

    broadcastRcaMembershipChanged({
      action: 'DELETED',
      actorUid: decodedToken.uid,
      deletedAtIso: result.deletedAtIso,
      incident: result.incident
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

rcaRouter.get('/incidents/:incidentId/sessions', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const incidentId = idParamSchema.parse(req.params.incidentId);
    const result = await listRcaSessions(decodedToken, incidentId);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

rcaRouter.post('/incidents/:incidentId/sessions', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const incidentId = idParamSchema.parse(req.params.incidentId);
    const body = sessionBodySchema.parse(req.body);
    const session = await createRcaSession(decodedToken, incidentId, body);
    const incident = await getRcaIncident(decodedToken, incidentId);

    broadcastRcaMembershipChanged({
      action: 'UPDATED',
      actorUid: decodedToken.uid,
      incident
    });

    res.status(201).json({ session });
  } catch (error) {
    next(error);
  }
});

rcaRouter.post('/incidents/:incidentId/sessions/:sessionId/evidence', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const incidentId = idParamSchema.parse(req.params.incidentId);
    const sessionId = idParamSchema.parse(req.params.sessionId);
    const body = evidenceUploadBodySchema.parse(req.body);
    const evidence = await uploadRcaEvidenceFile(decodedToken, incidentId, sessionId, body);

    res.status(201).json({ evidence });
  } catch (error) {
    next(error);
  }
});

rcaRouter.get('/incidents/:incidentId/sessions/:sessionId/evidence/:evidenceId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const incidentId = idParamSchema.parse(req.params.incidentId);
    const sessionId = idParamSchema.parse(req.params.sessionId);
    const evidenceId = z.string().trim().max(80).parse(req.params.evidenceId);
    const evidenceFile = await getRcaEvidenceFile(decodedToken, incidentId, sessionId, evidenceId);

    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(evidenceFile.fileName)}"`);
    res.type(evidenceFile.contentType).send(evidenceFile.payload);
  } catch (error) {
    next(error);
  }
});

rcaRouter.patch('/incidents/:incidentId/sessions/:sessionId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const incidentId = idParamSchema.parse(req.params.incidentId);
    const sessionId = idParamSchema.parse(req.params.sessionId);
    const body = sessionBodySchema.parse(req.body);
    const session = await updateRcaSession(decodedToken, incidentId, sessionId, body);

    res.json({ session });
  } catch (error) {
    next(error);
  }
});

rcaRouter.get('/incidents/:incidentId/sessions/:sessionId/nodes', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const incidentId = idParamSchema.parse(req.params.incidentId);
    const sessionId = idParamSchema.parse(req.params.sessionId);
    const result = await listRcaNodes(decodedToken, incidentId, sessionId);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

rcaRouter.get('/incidents/:incidentId/sessions/:sessionId/activity-logs', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const incidentId = idParamSchema.parse(req.params.incidentId);
    const sessionId = idParamSchema.parse(req.params.sessionId);
    const result = await listRcaActivityLogs(decodedToken, incidentId, sessionId);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

rcaRouter.post('/incidents/:incidentId/sessions/:sessionId/activity-logs', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const incidentId = idParamSchema.parse(req.params.incidentId);
    const sessionId = idParamSchema.parse(req.params.sessionId);
    const body = activityLogBodySchema.parse(req.body);
    const log = await recordRcaActivityLog(decodedToken, incidentId, sessionId, body);
    const session = await buildAuthSession(decodedToken);
    const tenantId = session.user.tenantId;

    if (session.access === 'ACTIVE' && tenantId) {
      await broadcastRcaActivityLogCreated({
        actorUid: decodedToken.uid,
        incidentId,
        sessionId,
        tenantId
      });
    }

    res.status(201).json({ log });
  } catch (error) {
    next(error);
  }
});

rcaRouter.post('/incidents/:incidentId/sessions/:sessionId/nodes', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const incidentId = idParamSchema.parse(req.params.incidentId);
    const sessionId = idParamSchema.parse(req.params.sessionId);
    const body = nodeBodySchema.parse(req.body);
    const node = await createRcaNode(decodedToken, incidentId, sessionId, body);
    const session = await buildAuthSession(decodedToken);
    const tenantId = session.user.tenantId;

    if (session.access === 'ACTIVE' && tenantId) {
      await broadcastRcaNodeCreated({
        actorUid: decodedToken.uid,
        incidentId,
        node,
        sessionId,
        tenantId
      });
    }

    res.status(201).json({ node });
  } catch (error) {
    next(error);
  }
});

rcaRouter.patch('/incidents/:incidentId/sessions/:sessionId/nodes/:nodeId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const incidentId = idParamSchema.parse(req.params.incidentId);
    const sessionId = idParamSchema.parse(req.params.sessionId);
    const nodeId = idParamSchema.parse(req.params.nodeId);
    const body = nodeBodySchema.parse(req.body);
    const node = await updateRcaNode(decodedToken, incidentId, sessionId, nodeId, body);
    const session = await buildAuthSession(decodedToken);
    const tenantId = session.user.tenantId;

    if (session.access === 'ACTIVE' && tenantId) {
      await broadcastRcaNodeUpdated({
        actorUid: decodedToken.uid,
        incidentId,
        node,
        sessionId,
        tenantId
      });
    }

    res.json({ node });
  } catch (error) {
    next(error);
  }
});

rcaRouter.delete('/incidents/:incidentId/sessions/:sessionId/nodes/:nodeId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const incidentId = idParamSchema.parse(req.params.incidentId);
    const sessionId = idParamSchema.parse(req.params.sessionId);
    const nodeId = idParamSchema.parse(req.params.nodeId);
    const session = await buildAuthSession(decodedToken);
    const tenantId = session.user.tenantId;

    await deleteRcaNode(decodedToken, incidentId, sessionId, nodeId);

    if (session.access === 'ACTIVE' && tenantId) {
      await broadcastRcaNodeDeleted({
        actorUid: decodedToken.uid,
        incidentId,
        nodeId,
        sessionId,
        tenantId
      });
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

rcaRouter.get('/users/:uid/photo', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const uid = idParamSchema.parse(req.params.uid);
    const profilePhoto = await getRcaUserProfilePhoto(decodedToken, uid);
    const etag = `"${profilePhoto.cacheKey}"`;

    res.setHeader('Cache-Control', 'private, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('Content-Type', profilePhoto.contentType);
    res.setHeader('ETag', etag);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.header('If-None-Match') === etag) {
      res.status(304).end();
      return;
    }

    profilePhoto.file
      .createReadStream()
      .on('error', next)
      .pipe(res);
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

export { rcaRouter };
