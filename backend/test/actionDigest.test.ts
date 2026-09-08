import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildActionDigest,
  countActionsForDigest,
  hasAnythingOutstanding
} from '../src/services/actionDigest.ts';

const NOW = Date.parse('2026-01-15T12:00:00Z');
const HOUR = 60 * 60 * 1000;

const action = (overrides: Record<string, unknown> = {}) => ({
  dueAtMs: null,
  responsiblePersonUid: 'anna',
  status: 'OPEN',
  ...overrides
}) as Parameters<typeof countActionsForDigest>[0]['actions'][number];

const count = (actions: ReturnType<typeof action>[], verifiableCount = 0) =>
  countActionsForDigest({ actions, nowMs: NOW, uid: 'anna', verifiableCount });

describe('what one person is carrying', () => {
  it('counts their open work', () => {
    assert.deepEqual(count([action(), action()]), {
      awaitingVerification: 0,
      open: 2,
      overdue: 0
    });
  });

  it('counts work in progress and work that is blocked as still open', () => {
    // All three mean somebody still owes it.
    assert.equal(count([
      action({ status: 'IN_PROGRESS' }),
      action({ status: 'BLOCKED' })
    ]).open, 2);
  });

  it('never counts somebody else\'s work', () => {
    // A reminder about work that is not yours teaches you to ignore the ones
    // that were.
    assert.equal(count([action({ responsiblePersonUid: 'ben' })]).open, 0);
  });

  it('does not count an action nobody was named on', () => {
    assert.equal(count([action({ responsiblePersonUid: null })]).open, 0);
  });

  it('counts an overdue action once, as overdue', () => {
    // "3 open and 1 overdue" reads as four things, and it is three.
    const counts = count([action({ dueAtMs: NOW - HOUR })]);

    assert.equal(counts.overdue, 1);
    assert.equal(counts.open, 0);
  });

  it('leaves an action due later in the open column', () => {
    assert.equal(count([action({ dueAtMs: NOW + HOUR })]).open, 1);
  });

  it('ignores finished work', () => {
    for (const status of ['DONE', 'VERIFIED', 'CANCELLED']) {
      assert.equal(count([action({ status })]).open, 0, status);
    }
  });

  it('takes what they can verify as given, since it is never their own work', () => {
    assert.equal(count([], 3).awaitingVerification, 3);
  });

  it('never reports a negative', () => {
    assert.equal(count([], -5).awaitingVerification, 0);
  });
});

describe('the reminder itself', () => {
  it('says nothing when there is nothing', () => {
    // A digest that says "0 open" is what teaches somebody to swipe a reminder
    // away without reading it — and then the escalation goes unread too.
    assert.equal(buildActionDigest({ awaitingVerification: 0, open: 0, overdue: 0 }), null);
  });

  it('leads with overdue, which is the part that needs today', () => {
    const digest = buildActionDigest({ awaitingVerification: 2, open: 3, overdue: 1 });

    assert.equal(digest?.title, 'Actions overdue');
    assert.equal(digest?.body, '1 action is overdue, 3 are open and 2 are waiting to be verified.');
  });

  it('reads as a sentence rather than a list', () => {
    assert.equal(
      buildActionDigest({ awaitingVerification: 1, open: 2, overdue: 0 })?.body,
      '2 are open and 1 is waiting to be verified.'
    );
  });

  it('gets the singular right', () => {
    assert.equal(buildActionDigest({ awaitingVerification: 0, open: 1, overdue: 0 })?.body, '1 is open.');
    assert.equal(buildActionDigest({ awaitingVerification: 0, open: 0, overdue: 1 })?.body, '1 action is overdue.');
  });

  it('says nothing is overdue in the title when nothing is', () => {
    assert.equal(buildActionDigest({ awaitingVerification: 0, open: 4, overdue: 0 })?.title, 'Your actions');
  });

  it('starts with a capital, whichever part comes first', () => {
    for (const counts of [
      { awaitingVerification: 0, open: 1, overdue: 0 },
      { awaitingVerification: 1, open: 0, overdue: 0 },
      { awaitingVerification: 0, open: 0, overdue: 2 }
    ]) {
      assert.match(buildActionDigest(counts)?.body || '', /^[A-Z0-9]/);
    }
  });

  it('ends as a sentence', () => {
    assert.match(buildActionDigest({ awaitingVerification: 1, open: 1, overdue: 1 })?.body || '', /\.$/);
  });
});

describe('whether anything is outstanding at all', () => {
  it('is false for nothing', () => {
    assert.equal(hasAnythingOutstanding({ awaitingVerification: 0, open: 0, overdue: 0 }), false);
  });

  it('is true for any one of the three', () => {
    assert.equal(hasAnythingOutstanding({ awaitingVerification: 1, open: 0, overdue: 0 }), true);
    assert.equal(hasAnythingOutstanding({ awaitingVerification: 0, open: 1, overdue: 0 }), true);
    assert.equal(hasAnythingOutstanding({ awaitingVerification: 0, open: 0, overdue: 1 }), true);
  });

  it('agrees with the digest, always', () => {
    // Two answers to the same question is how one of them comes to be wrong.
    for (const counts of [
      { awaitingVerification: 0, open: 0, overdue: 0 },
      { awaitingVerification: 2, open: 0, overdue: 0 },
      { awaitingVerification: 0, open: 3, overdue: 1 }
    ]) {
      assert.equal(hasAnythingOutstanding(counts), buildActionDigest(counts) !== null);
    }
  });
});
