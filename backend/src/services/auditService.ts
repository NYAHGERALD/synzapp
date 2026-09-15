import { randomUUID } from 'node:crypto';
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

  await batch.commit();
}
