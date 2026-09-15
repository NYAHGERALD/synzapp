import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Request, Response } from 'express';
import {
  attachAuditCorrelationId,
  getAuditCorrelationId
} from '../src/middleware/auditContext.ts';

function fakeRequest(): Request {
  return {} as Request;
}

describe('tying the events of one request together', () => {
  it('gives every event in a request the same id', () => {
    /**
     * requestId is generated per call, so two events written while handling one
     * request carried two unrelated ids — including the SUCCESS and FAILED pair
     * a route writes when the audit write itself fails, which describe one
     * moment and are the pair somebody would be investigating.
     */
    const req = fakeRequest();

    attachAuditCorrelationId(req, {} as Response, () => undefined);

    assert.equal(getAuditCorrelationId(req), getAuditCorrelationId(req));
  });

  it('gives two requests different ids', () => {
    const first = fakeRequest();
    const second = fakeRequest();

    attachAuditCorrelationId(first, {} as Response, () => undefined);
    attachAuditCorrelationId(second, {} as Response, () => undefined);

    assert.notEqual(getAuditCorrelationId(first), getAuditCorrelationId(second));
  });

  it('calls next, so it cannot stall a request', () => {
    let called = false;

    attachAuditCorrelationId(fakeRequest(), {} as Response, () => {
      called = true;
    });

    assert.equal(called, true);
  });

  it('still answers when the middleware has not run', () => {
    // A missing id would be a silent hole in exactly the records somebody reads
    // when something has gone wrong, and the fallback costs nothing.
    const req = fakeRequest();
    const id = getAuditCorrelationId(req);

    assert.ok(id);
    assert.equal(getAuditCorrelationId(req), id);
  });

  it('does not take the id from anything the caller sent', () => {
    /**
     * The correlation field used to be the caller's X-Request-Id and was
     * forgeable and collidable. What they send is kept separately, as
     * clientRequestId, clearly labelled as theirs.
     */
    const req = { headers: { 'x-request-id': 'forged-by-caller' } } as unknown as Request;

    attachAuditCorrelationId(req, {} as Response, () => undefined);

    assert.notEqual(getAuditCorrelationId(req), 'forged-by-caller');
  });

  it('hides the id from enumeration, so it cannot be logged by accident', () => {
    const req = fakeRequest();

    attachAuditCorrelationId(req, {} as Response, () => undefined);

    assert.deepEqual(Object.keys(req), []);
    assert.equal(JSON.stringify(req), '{}');
  });
});
