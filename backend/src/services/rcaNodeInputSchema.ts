/**
 * The shape of a node on an RCA canvas.
 *
 * Lifted out of the route file because there are two doors into
 * `createRcaNode` and `updateRcaNode` — the HTTP route and the realtime
 * socket — and only one of them validated anything. The socket is also the one
 * the web client prefers whenever the canvas connection is up.
 *
 * It lives here rather than being imported from the route because a service
 * importing from a route is a cycle: `rcaRoutes` already imports the realtime
 * service. One module both sides depend on, and neither depends on the other.
 */

import { z } from 'zod';

export const idParamSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{8,128}$/);

export const methodologySchema = z.enum(['5_WHYS', 'ISHIKAWA', 'FAULT_TREE']);

export const nodeTypeSchema = z.enum(['WHY', 'ISHIKAWA_CATEGORY', 'CAUSE', 'SUB_CAUSE', 'FAULT_GATE', 'STICKY_NOTE', 'COMMENT']);

export const auditIntentSchema = z.enum(['MULTI_DELETED', 'REDO', 'SPLINE_DELETED', 'UNDO']);

export const fiveWhysRoleSchema = z.enum([
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

export const evidenceBodySchema = z.object({
  fileHash: z.string().trim().max(128),
  fileName: z.string().trim().max(180),
  fileUrl: z.string().trim().max(320),
  uploadedAtIso: z.string().trim().max(40).optional()
});

export const visualStyleBodySchema = z.object({
  backgroundColor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  borderColor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  fontFamily: z.string().trim().max(40).nullable().optional(),
  fontSize: z.number().int().min(10).max(18).nullable().optional(),
  isBold: z.boolean().nullable().optional(),
  isItalic: z.boolean().nullable().optional(),
  isUnderline: z.boolean().nullable().optional(),
  textColor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional()
});

export const edgeStyleBodySchema = z.object({
  arrowHead: z.enum(['OPEN', 'CLOSED', 'CLOSED_FILLED']).nullable().optional(),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  lineType: z.enum(['CONTINUOUS', 'DASHED', 'DOTTED']).nullable().optional(),
  weight: z.number().min(1.5).max(5).nullable().optional()
});

export const connectionHandlesBodySchema = z.object({
  sourceHandle: z.string().trim().max(80).nullable().optional(),
  targetHandle: z.string().trim().max(80).nullable().optional()
});

/**
 * Exported so the realtime socket validates the same payload this route does.
 *
 * The canvas has two doors into `createRcaNode` and `updateRcaNode`: this one,
 * and the WebSocket — which validated nothing at all and is the one the web
 * client actually prefers whenever the socket is up. One bounded door and one
 * open one is not a schema, it is a suggestion.
 */
export const nodeBodySchema = z.object({
  auditIntent: auditIntentSchema.optional(),
  attachedEvidence: z.array(evidenceBodySchema).max(24).optional(),
  connectionHandles: connectionHandlesBodySchema.optional(),
  /**
   * Missing entirely until now, which had a quiet consequence: zod strips
   * unknown keys, so every detail-field save through this route was discarded
   * and answered 200. They only ever worked because the client prefers the
   * socket. Bounded here to what `normalizeNodeDetailFields` already enforces,
   * so both doors agree.
   */
  detailFields: z.record(z.string().max(80), z.string().max(1200))
    .refine((fields) => Object.keys(fields).length <= 80, {
      message: 'A node can carry at most 80 detail fields.'
    })
    .optional(),
  dimensions: z.object({
    height: z.number().finite().min(96).max(720).nullable().optional(),
    width: z.number().finite().min(160).max(720).nullable().optional()
  }).optional(),
  edgeStyle: edgeStyleBodySchema.optional(),
  fiveWhysRole: fiveWhysRoleSchema.nullable().optional(),
  isRootCause: z.boolean().optional(),
  isSuspectedCause: z.boolean().optional(),
  label: z.string().trim().max(240).optional(),
  linkedNodeIds: z.array(idParamSchema).max(40).optional(),
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
  whyChain: z.array(z.string().trim().max(260)).max(10).optional()
});
