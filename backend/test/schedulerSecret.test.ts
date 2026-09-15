import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkSchedulerSecret,
  readSchedulerSecrets
} from '../src/middleware/schedulerSecret.ts';

const CURRENT = 'current-secret-value-long-enough';
const PREVIOUS = 'previous-secret-value-long-enough';

describe('reading a secret that may be mid-rotation', () => {
  it('reads one secret', () => {
    assert.deepEqual(readSchedulerSecrets(CURRENT), [CURRENT]);
  });

  it('reads a rotation in progress, newest first', () => {
    /**
     * A single value means changing it is a flag day: the moment the new secret
     * is set, anything still sending the old one fails. So it never gets
     * rotated, which is how a static secret becomes a permanent one.
     */
    assert.deepEqual(
      readSchedulerSecrets(`${CURRENT}, ${PREVIOUS}`),
      [CURRENT, PREVIOUS]
    );
  });

  it('drops blanks and duplicates', () => {
    // The same value twice would report as a previous secret and make a
    // finished rotation look unfinished for ever.
    assert.deepEqual(
      readSchedulerSecrets(`${CURRENT},,  ,${CURRENT}`),
      [CURRENT]
    );
  });

  it('reads nothing from nothing', () => {
    assert.deepEqual(readSchedulerSecrets(''), []);
    assert.deepEqual(readSchedulerSecrets(undefined), []);
    assert.deepEqual(readSchedulerSecrets(null), []);
  });
});

describe('checking the secret', () => {
  it('accepts the current one and says so', () => {
    const decision = checkSchedulerSecret(CURRENT, [CURRENT, PREVIOUS]);

    assert.equal(decision.allowed, true);
    assert.equal(decision.matched, 'current');
  });

  it('accepts a previous one and says which, so an unfinished rotation shows', () => {
    /**
     * "Rotation is finished" becomes something somebody can know rather than
     * assume: while anything still sends the old value, this says so on every
     * call.
     */
    const decision = checkSchedulerSecret(PREVIOUS, [CURRENT, PREVIOUS]);

    assert.equal(decision.allowed, true);
    assert.equal(decision.matched, 'previous');
  });

  it('refuses a wrong secret', () => {
    const decision = checkSchedulerSecret('wrong', [CURRENT]);

    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, 'MISMATCH');
  });

  it('refuses an empty one without comparing', () => {
    assert.equal(checkSchedulerSecret('', [CURRENT]).reason, 'MISSING');
    assert.equal(checkSchedulerSecret('   ', [CURRENT]).reason, 'MISSING');
  });

  it('fails closed when nothing is configured', () => {
    /**
     * An unprotected job that packages other people's messages is worse than a
     * job that does not run: the second is noticed and the first is not.
     */
    const decision = checkSchedulerSecret(CURRENT, []);

    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, 'NOT_CONFIGURED');
  });

  it('is not fooled by a prefix or a longer string', () => {
    assert.equal(checkSchedulerSecret(CURRENT.slice(0, 10), [CURRENT]).allowed, false);
    assert.equal(checkSchedulerSecret(`${CURRENT}x`, [CURRENT]).allowed, false);
  });
});
