import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

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
