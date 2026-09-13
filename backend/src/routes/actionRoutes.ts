import { Router } from 'express';
import { getDecodedTokenFromHeader as getDecodedToken } from '../middleware/requestAuth.js';
import { z } from 'zod';
import { verifyAppCheck } from '../middleware/appCheck.js';
import { describeReassignmentReason } from '../services/actionReassignment.js';
import { writeAuditEvent } from '../services/auditService.js';
import {
  cancelAction,
  getPersonalActionCounts,
  reassignAction,
  changeActionStatus,
  createAction,
  createActionUpload,
  listActionAttachmentUrls,
  getAction,
  getActionCounts,
  listActions,
  verifyAction
} from '../services/actionService.js';

/**
 * Actions raised from chat messages.
 *
 * Every route reads who the caller is from their verified session. Nothing here
 * accepts an identity, a department or a role from the request body: those are
 * exactly the fields an attacker would send.
 */
export const actionRouter = Router();

/** A reason is required. See section 4.1 of the governance plan. */
const reassignActionSchema = z.object({
  detail: z.string().trim().max(400).optional(),
  /** Absent or null hands the action back to the whole team. */
  nextPersonUid: z.string().trim().min(1).max(128).nullable().optional(),
  reasonId: z.string().trim().min(1).max(40)
});

const cancelActionSchema = z.object({
  reason: z.string().trim().min(3).max(500)
});

const uploadBodySchema = z.object({
  contentType: z.string().trim().min(3).max(120),
  kind: z.enum(['image', 'video']),
  sizeBytes: z.number().int().positive()
});

const createBodySchema = z.object({
  // Ids only. A storage path from the client would be a path somebody could
  // choose, so the server rebuilds it instead.
  attachmentIds: z.array(z.string().trim().min(1).max(200)).max(10).optional(),
  dueAtMs: z.number().int().positive().nullable().optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  responsibleGroupId: z.string().trim().min(1).max(200),
  responsiblePersonUid: z.string().trim().max(200).nullable().optional(),
  sourceChatId: z.string().trim().min(1).max(200),
  sourceChatType: z.enum(['DIRECT', 'GROUP']).optional(),
  sourceChatName: z.string().trim().max(200),
  sourceMessageId: z.string().trim().min(1).max(200),
  title: z.string().trim().min(2).max(500)
});

const statusBodySchema = z.object({
  blockedReason: z.string().trim().max(500).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'VERIFIED'])
});

const listQuerySchema = z.object({
  chatId: z.string().trim().max(200).optional(),
  chatType: z.enum(['DIRECT', 'GROUP']).optional(),
  groupId: z.string().trim().max(200).optional(),
  startAfterId: z.string().trim().max(200).optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'VERIFIED']).optional()
});


actionRouter.post('/', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = createBodySchema.parse(req.body);
    const action = await createAction(decodedToken, body);

    await writeAuditEvent({
      action: 'ACTION_CREATED',
      metadata: {
        actionId: action.actionId,
        priority: action.priority,
        responsibleGroup: action.responsibleGroupName,
        responsiblePersonUid: action.responsiblePersonUid || 'unassigned',
        sourceChatId: action.sourceChatId
      },
      phoneMasked: undefined,
      req,
      status: 'SUCCESS',
      tenantId: action.tenantId,
      uid: decodedToken.uid
    });

    res.status(201).json({ action });
  } catch (error) {
    next(error);
  }
});

actionRouter.get('/', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const query = listQuerySchema.parse(req.query);

    res.json(await listActions(decodedToken, query));
  } catch (error) {
    next(error);
  }
});

/** The two numbers above a group's messages. One document read. */
actionRouter.get('/counts', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const groupId = String(req.query.groupId || '').trim();

    if (!groupId) {
      const error = new Error('A group is needed to count actions.');
      error.name = 'ValidationError';

      throw error;
    }

    res.json(await getActionCounts(decodedToken, groupId));
  } catch (error) {
    next(error);
  }
});

/**
 * Reserves a place to upload one photo or clip.
 *
 * Returns an opaque id and a short lived link. The client uploads straight to
 * storage and later names the id when creating the action. It never sees or
 * chooses a storage path.
 */
/**
 * How much the person asking is carrying.
 *
 * Declared above `/:actionId`, and it has to stay there: Express matches in
 * order, so a fixed path below a parameter is a path that is never reached —
 * this one was, briefly, and answered "that action was not found".
 */
actionRouter.get('/my-counts', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const counts = await getPersonalActionCounts(decodedToken);

    res.json({ counts });
  } catch (error) {
    next(error);
  }
});

actionRouter.post('/uploads', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = uploadBodySchema.parse(req.body);

    res.status(201).json(await createActionUpload(decodedToken, body));
  } catch (error) {
    next(error);
  }
});

actionRouter.get('/:actionId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');

    res.json(await getAction(decodedToken, String(req.params.actionId)));
  } catch (error) {
    next(error);
  }
});

actionRouter.post('/:actionId/status', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = statusBodySchema.parse(req.body);
    const action = await changeActionStatus(decodedToken, {
      ...body,
      actionId: String(req.params.actionId)
    });

    await writeAuditEvent({
      action: 'ACTION_STATUS_CHANGED',
      metadata: {
        actionId: action.actionId,
        status: action.status
      },
      phoneMasked: undefined,
      req,
      status: 'SUCCESS',
      tenantId: action.tenantId,
      uid: decodedToken.uid
    });

    res.json({ action });
  } catch (error) {
    next(error);
  }
});

/**
 * Confirms a completed action really is done.
 *
 * Separate from a status change on purpose: verification carries its own rule
 * about who may perform it, and the person who did the work is never allowed
 * to be that person.
 */
actionRouter.post('/:actionId/verify', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const action = await verifyAction(decodedToken, String(req.params.actionId));

    await writeAuditEvent({
      action: 'ACTION_VERIFIED',
      metadata: {
        actionId: action.actionId,
        completedByUid: action.completedByUid || 'unknown',
        verifiedByUid: action.verifiedByUid || 'unknown'
      },
      phoneMasked: undefined,
      req,
      status: 'SUCCESS',
      tenantId: action.tenantId,
      uid: decodedToken.uid
    });

    res.json({ action });
  } catch (error) {
    next(error);
  }
});

/**
 * Ends an action without it having been done.
 *
 * The reason is required by the schema, not merely encouraged: a cancellation
 * with no reason cannot be told apart from a cover-up. Both the outcome and the
 * reason go to the audit log, because a record that can be ended silently is
 * not a record.
 */
actionRouter.post('/:actionId/reassign', verifyAppCheck, async (req, res, next) => {
  const actionId = String(req.params.actionId);

  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = reassignActionSchema.parse(req.body);
    const action = await reassignAction(decodedToken, {
      actionId,
      detail: body.detail,
      nextPersonUid: body.nextPersonUid ?? null,
      reasonId: body.reasonId
    });

    await writeAuditEvent({
      action: 'ACTION_REASSIGNED',
      metadata: {
        actionId: action.actionId,
        departmentIds: action.departmentIds.join(',') || 'none',
        nextPersonUid: action.responsiblePersonUid || 'the team',
        // Kept in the log as well as on the record, so why the work moved
        // survives even if retention later removes the action's body.
        reason: describeReassignmentReason(body.reasonId, body.detail),
        responsibleGroupId: action.responsibleGroupId
      },
      req,
      status: 'SUCCESS',
      tenantId: action.tenantId,
      uid: decodedToken.uid
    });

    res.json({ action });
  } catch (error) {
    // A refused move is written down too. Somebody repeatedly trying to hand
    // away work they do not own is what an audit log is for.
    await writeAuditEvent({
      action: 'ACTION_REASSIGNED',
      metadata: { actionId },
      reason: error instanceof Error ? error.message : 'Reassignment failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

actionRouter.post('/:actionId/cancel', verifyAppCheck, async (req, res, next) => {
  const actionId = String(req.params.actionId);

  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = cancelActionSchema.parse(req.body);
    const action = await cancelAction(decodedToken, { actionId, reason: body.reason });

    await writeAuditEvent({
      action: 'ACTION_CANCELLED',
      metadata: {
        actionId: action.actionId,
        cancelledByUid: action.cancelledByUid || 'unknown',
        departmentIds: action.departmentIds.join(',') || 'none',
        // Kept in the log as well as on the record, so the reason survives even
        // if retention later removes the action's body.
        reason: action.cancellationReason || '',
        responsibleGroupId: action.responsibleGroupId
      },
      phoneMasked: undefined,
      req,
      status: 'SUCCESS',
      tenantId: action.tenantId,
      uid: decodedToken.uid
    });

    res.json({ action });
  } catch (error) {
    // A refused cancellation is written down too. Somebody repeatedly trying to
    // end actions they may not is exactly what an audit log is for.
    await writeAuditEvent({
      action: 'ACTION_CANCELLED',
      metadata: { actionId },
      reason: error instanceof Error ? error.message : 'Cancel refused',
      req,
      status: 'DENIED'
    });
    next(error);
  }
});

/** Short lived links for viewing what is attached. */
actionRouter.get('/:actionId/attachments', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');

    res.json({
      attachments: await listActionAttachmentUrls(decodedToken, String(req.params.actionId))
    });
  } catch (error) {
    next(error);
  }
});
