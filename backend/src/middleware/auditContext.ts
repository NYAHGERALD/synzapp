import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../config/firebaseAdmin.js';

/**
 * One server-generated id per request, so the events of a single request can be
 * read together.
 *
 * `requestId` on an audit event is generated per **call**, not per request, so
 * two events written while handling one request carry two unrelated ids. That
 * matters most in exactly the case somebody would be investigating: a route that
 * records SUCCESS and then, because the audit write itself failed, records
 * FAILED for the same change. Those two rows describe one moment and nothing
 * ties them together.
 *
 * Deliberately not the caller's `X-Request-Id`. That is what the correlation
 * field used to be, and it was forgeable and collidable — the same mistake this
 * file exists to avoid repeating. What the caller sent is still kept, as
 * `clientRequestId`, clearly labelled as theirs.
 *
 * Stored on a symbol property so it cannot collide with anything Express or a
 * library puts on the request, and cannot be enumerated into a log by accident.
 */
const AUDIT_CORRELATION_ID = Symbol('synzappAuditCorrelationId');

type RequestWithCorrelation = Request & { [AUDIT_CORRELATION_ID]?: string };

export function attachAuditCorrelationId(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  (req as RequestWithCorrelation)[AUDIT_CORRELATION_ID] = randomUUID();
  next();
}

/**
 * The id for this request.
 *
 * Generates one when the middleware has not run, rather than returning null.
 * A missing correlation id would otherwise be a silent hole in exactly the
 * records somebody reads when something has gone wrong, and the fallback costs
 * nothing.
 */
export function getAuditCorrelationId(req: Request): string {
  const request = req as RequestWithCorrelation;

  if (!request[AUDIT_CORRELATION_ID]) {
    request[AUDIT_CORRELATION_ID] = randomUUID();
  }

  return request[AUDIT_CORRELATION_ID] as string;
}


/**
 * Who a request is from, for the purpose of writing it down.
 *
 * 60 of the 64 failure-path audit writes passed neither a uid nor a tenant, so
 * they landed only in the root `auditLogs` collection — which no route reads.
 * The console a customer can actually open therefore showed a world with a 100%
 * success rate, and an auditor sampling it reads that as a broken control rather
 * than a clean one. SOC 2 CC7.2 and ISO 27001 A.8.15 both require failed
 * attempts to be reviewable.
 *
 * Resolved here instead of at those 60 call sites, and only when an event
 * arrives without a tenant — which is the failure path. A request that succeeds
 * already carries one, so nothing is added to the traffic that matters.
 *
 * **Signature only, deliberately.** `verifyIdToken(token, false)` proves who
 * sent this, which is the question attribution asks. Checking revocation would
 * answer a different one — may they do it — and would throw for exactly the
 * caller most worth recording: somebody using a credential that has been taken
 * away.
 */
const AUDIT_IDENTITY = Symbol('synzappAuditIdentity');

interface AuditIdentity {
  tenantId: string | null;
  uid: string | null;
}

type RequestWithIdentity = Request & { [AUDIT_IDENTITY]?: AuditIdentity };

export async function resolveAuditIdentity(req: Request): Promise<AuditIdentity> {
  const request = req as RequestWithIdentity;

  if (request[AUDIT_IDENTITY]) {
    return request[AUDIT_IDENTITY] as AuditIdentity;
  }

  const identity = await readIdentityFromHeader(req);

  // Cached even when empty, so several audit writes in one failed request do
  // not each pay for a verification that already failed.
  request[AUDIT_IDENTITY] = identity;

  return identity;
}

async function readIdentityFromHeader(req: Request): Promise<AuditIdentity> {
  const header = req.header('Authorization') || '';

  if (!header.startsWith('Bearer ')) {
    return { tenantId: null, uid: null };
  }

  try {
    const decoded: DecodedIdToken = await adminAuth.verifyIdToken(header.slice('Bearer '.length).trim(), false);

    return {
      tenantId: typeof decoded.tenantId === 'string' ? decoded.tenantId : null,
      uid: decoded.uid || null
    };
  } catch {
    /**
     * An unreadable token is not an error here. The audit write is already
     * recording something that went wrong, and failing to attribute it must
     * never turn into a second failure on top of the first.
     */
    return { tenantId: null, uid: null };
  }
}
