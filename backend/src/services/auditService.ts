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
    requestId: input.req.header('X-Request-Id') || null,
    status: input.status,
    tenantId: input.tenantId || null,
    uid: input.uid || null,
    userAgent: input.req.header('User-Agent') || null
  };

  await firestore.collection('auditLogs').add(baseEvent);

  if (input.tenantId) {
    await firestore
      .collection('organizations')
      .doc(input.tenantId)
      .collection('auditLogs')
      .add(baseEvent);
  }
}
