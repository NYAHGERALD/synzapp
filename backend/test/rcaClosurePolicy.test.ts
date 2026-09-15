import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  RCA_APPROVAL_CLOSURE_REQUIRED_FIELDS,
  describeClosureRefusal,
  getMissingClosureFields,
  isReadyToClose
} from '../src/services/rcaClosurePolicy.ts';

function completeReview(): Record<string, string> {
  const fields: Record<string, string> = {};

  RCA_APPROVAL_CLOSURE_REQUIRED_FIELDS.forEach((requirement) => {
    fields[requirement.key] = requirement.validValues ? requirement.validValues[0] : 'recorded';
  });

  return fields;
}

describe('closing a root cause analysis', () => {
  it('refuses a closure with nothing filled in', () => {
    /**
     * PATCH with {"status":"CLOSED"} closed an investigation outright: the whole
     * twenty-field review lived in the browser and the service only coerced the
     * string. A fabricated closure is also permanent, because the post-closure
     * freeze is real.
     */
    assert.equal(isReadyToClose({}), false);
    assert.equal(isReadyToClose(undefined), false);
    assert.equal(getMissingClosureFields({}).length, RCA_APPROVAL_CLOSURE_REQUIRED_FIELDS.length);
  });

  it('allows a closure once the review is complete', () => {
    assert.equal(isReadyToClose(completeReview()), true);
  });

  it('refuses a value outside the choices the review offers', () => {
    // A free-text answer where the form offers a fixed set is somebody working
    // around the form, not completing it.
    const fields = { ...completeReview(), closureReadiness: 'Looks fine to me' };

    assert.deepEqual(getMissingClosureFields(fields), ['closure readiness']);
  });

  it('refuses whitespace as an answer', () => {
    const fields = { ...completeReview(), investigationSummary: '   ' };

    assert.deepEqual(getMissingClosureFields(fields), ['final investigation summary']);
  });

  it('reports every missing field, not the first', () => {
    // Somebody told one missing field at a time fills the form in twenty round
    // trips.
    const fields = completeReview();

    delete fields.finalApprover;
    delete fields.closureDate;

    assert.deepEqual(getMissingClosureFields(fields), ['final approver', 'closure date']);
  });

  it('says what to do rather than only that it was refused', () => {
    const message = describeClosureRefusal(['final approver', 'closure date']);

    assert.match(message, /Approval and Closure/);
    assert.match(message, /final approver, closure date/);
  });
});

describe('the server list still matches the one the interface states', () => {
  it('requires exactly the fields the web workspace requires', () => {
    /**
     * The danger with a mirrored list is that it quietly stops being one. This
     * reads the web source and compares, so the two cannot drift without a
     * failing test.
     */
    const testDir = dirname(fileURLToPath(import.meta.url));
    const webSource = readFileSync(
      resolve(testDir, '..', '..', 'web', 'src', 'RcaWorkspace.tsx'),
      'utf8'
    );
    const block = webSource.match(
      /const RCA_APPROVAL_CLOSURE_REQUIRED_FIELDS[\s\S]*?\n\];/
    );

    assert.ok(block, 'Expected the web workspace to declare its required fields.');

    const webKeys = [...block[0].matchAll(/key: '([a-zA-Z]+)'/g)].map((match) => match[1]);

    assert.deepEqual(
      RCA_APPROVAL_CLOSURE_REQUIRED_FIELDS.map((requirement) => requirement.key),
      webKeys
    );
  });
});

describe('the closure gate is actually wired, not merely defined', () => {
  const service = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'services', 'rcaService.ts'),
    'utf8'
  );

  it('checks the review before writing a CLOSED status', () => {
    assert.match(service, /nextStatus === 'CLOSED'[\s\S]{0,120}assertIncidentReadyToClose/);
  });

  it('refuses a closure on an RCA that never had the review', () => {
    // Closing an RCA with no Approval and Closure node is the case this exists
    // to stop, not an exemption from it.
    assert.match(service, /Add the Approval and Closure review to this RCA before closing it/);
  });

  it('keeps a closed session closed', () => {
    /**
     * updateRcaSession checked neither editability guard, while every other
     * session mutation does — and normalizeSessionStatus maps anything
     * unrecognised to ACTIVE, so a closed session could be reopened by sending
     * a status at all.
     */
    assert.match(
      service,
      /getAuthorizedSession\(decodedToken, incidentId, sessionId\);[\s\S]{0,600}assertSessionIsEditable\(sessionRecord\)/
    );
  });
});
