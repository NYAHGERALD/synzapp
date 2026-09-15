import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { getAuditCorrelationId } from '../middleware/auditContext.js';
import { Request } from 'express';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import { getClientIp } from '../middleware/rateLimit.js';

interface AuditEventInput {
  action: string;
  uid?: string;
  tenantId?: string;
  status: 'SUCCESS' | 'DENIED' | 'FAILED';
  phoneMasked?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  req: Request;
}

export async function writeAuditEvent(input: AuditEventInput): Promise<void> {
  const baseEvent = {
    action: input.action,
    createdAt: fieldValue.serverTimestamp(),
    ipAddress: getClientIp(input.req),
    metadata: input.metadata || {},
    phoneMasked: input.phoneMasked || null,
    reason: input.reason || null,
    /**
     * Generated here, not taken from the caller.
     *
     * It used to be `X-Request-Id` verbatim, so an actor could forge one or
     * deliberately collide with somebody else's — in the one field meant to tie
     * the events of a single request together. What the caller sent is kept
     * beside it, clearly labelled as theirs.
     */
    clientRequestId: input.req.header('X-Request-Id') || null,
    /** The same for every event written while handling one request. */
    correlationId: getAuditCorrelationId(input.req),
    requestId: randomUUID(),
    status: input.status,
    tenantId: input.tenantId || null,
    uid: input.uid || null,
    userAgent: input.req.header('User-Agent') || null
  };

  /**
   * Both copies in one batch.
   *
   * They were two sequential writes, so the root copy could land while the
   * tenant copy failed — leaving an event the customer's console cannot see and
   * no sign that anything was lost. A batch makes it both or neither.
   */
  const batch = firestore.batch();

  batch.create(firestore.collection('auditLogs').doc(), baseEvent);

  if (input.tenantId) {
    batch.create(
      firestore
        .collection('organizations')
        .doc(input.tenantId)
        .collection('auditLogs')
        .doc(),
      baseEvent
    );
  }

  try {
    await batch.commit();
  } catch (error) {
    /**
     * An audit write that fails must not make the log say the opposite of what
     * happened.
     *
     * 86 of the 93 success-path call sites await this unguarded, and the
     * mutation they describe has already committed by the time they do. So a
     * single Firestore hiccup here throws, lands in the route's catch, and that
     * catch writes a second event marked FAILED — for a change that succeeded —
     * while the caller gets a 500 for work that was done. The log is then
     * confidently wrong, which is worse than a log with a hole in it, and it
     * needs no crash at all.
     *
     * The event goes to Cloud Logging either way. That is append-only, outside
     * every tenant's reach and sinkable to BigQuery, so it is also the closest
     * thing to the external sink 6.4 asks for, at no Firestore cost.
     *
     * What happens next is configuration rather than a decision taken here,
     * because flipping it is only safe once somebody is alerting on this marker.
     * It defaults to rethrowing, which is exactly today's behaviour at every one
     * of those call sites.
     */
    console.error('[SynzappAudit] AUDIT_WRITE_FAILED', {
      ...baseEvent,
      createdAt: undefined,
      error,
      tenantCopyIntended: Boolean(input.tenantId)
    });

    if (env.auditWriteFailureMode === 'throw') {
      throw error;
    }
  }
}
