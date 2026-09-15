import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  describeEnforcedRetention,
  isEnforcedRetentionPolicy
} from '../src/services/enforcedRetentionSummary.ts';

describe('saying what retention is actually enforced', () => {
  it('says nothing is configured when nothing is', () => {
    /**
     * Every organization used to be told "Retention: 3 Years" by a field the
     * retention engine has never read. Somebody plans around that, and an
     * auditor is told something untrue in writing.
     */
    assert.equal(describeEnforcedRetention([]), 'Not configured');
  });

  it('reports the period when one policy is live', () => {
    assert.equal(
      describeEnforcedRetention([{ durationDays: 1095, state: 'ACTIVE' }]),
      '3 years'
    );
  });

  it('counts policies rather than inventing a single period', () => {
    /**
     * Several policies cover different people, conversations and content types
     * and cannot honestly be reduced to one number. The count is true and sends
     * somebody to the console, where the detail lives.
     */
    assert.equal(
      describeEnforcedRetention([
        { durationDays: 365, state: 'ACTIVE' },
        { durationDays: 90, state: 'ACTIVE' }
      ]),
      '2 policies'
    );
  });

  it('ignores a policy that enforces nothing', () => {
    const notEnforced = [
      { durationDays: 365, state: 'DISABLED' },
      { durationDays: 365, state: 'SIMULATION' },
      { durationDays: 365, state: 'ACTIVE', supersededAtMs: 1 }
    ];

    notEnforced.forEach((policy) => {
      assert.equal(isEnforcedRetentionPolicy(policy), false);
    });

    assert.equal(describeEnforcedRetention(notEnforced), 'Not configured');
  });

  it('reads a period in the units somebody wrote it in', () => {
    assert.equal(describeEnforcedRetention([{ durationDays: 365, state: 'ACTIVE' }]), '1 year');
    assert.equal(describeEnforcedRetention([{ durationDays: 90, state: 'ACTIVE' }]), '3 months');
    assert.equal(describeEnforcedRetention([{ durationDays: 7, state: 'ACTIVE' }]), '7 days');
    assert.equal(describeEnforcedRetention([{ durationDays: 1, state: 'ACTIVE' }]), '1 day');
  });

  it('treats a nonsense duration as nothing configured', () => {
    assert.equal(describeEnforcedRetention([{ durationDays: 0, state: 'ACTIVE' }]), 'Not configured');
    assert.equal(describeEnforcedRetention([{ durationDays: -5, state: 'ACTIVE' }]), 'Not configured');
  });
});
