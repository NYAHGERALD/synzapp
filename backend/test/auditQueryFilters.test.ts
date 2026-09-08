import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildAuditQueryWindow,
  MAX_AUDIT_ACTION_FILTERS
} from '../src/services/auditQueryFilters.ts';

/**
 * A filter that cannot be honoured must narrow, never widen. An audit search
 * that quietly returns more than was asked for is how somebody concludes an
 * event does not exist because it was buried in ten thousand others.
 */

describe('which event kinds were asked for', () => {
  it('passes through what was named', () => {
    const window = buildAuditQueryWindow({ actions: ['ACTION_CANCELLED'] });

    assert.deepEqual(window.actions, ['ACTION_CANCELLED']);
  });

  it('means every kind when none is named', () => {
    assert.deepEqual(buildAuditQueryWindow({}).actions, []);
  });

  it('drops blanks rather than searching for an empty action', () => {
    const window = buildAuditQueryWindow({ actions: ['ACTION_CANCELLED', '  ', ''] });

    assert.deepEqual(window.actions, ['ACTION_CANCELLED']);
  });

  it('deduplicates, so a repeated tick does not waste the cap', () => {
    const window = buildAuditQueryWindow({
      actions: ['ACTION_CANCELLED', 'ACTION_CANCELLED']
    });

    assert.deepEqual(window.actions, ['ACTION_CANCELLED']);
  });

  it('caps at what Firestore will take, keeping the filter rather than dropping it', () => {
    // Abandoning the filter would return every kind, which is the opposite of
    // what was asked for, and silently.
    const many = Array.from({ length: 50 }, (_, index) => `ACTION_${index}`);
    const window = buildAuditQueryWindow({ actions: many });

    assert.equal(window.actions.length, MAX_AUDIT_ACTION_FILTERS);
    assert.equal(window.actions[0], 'ACTION_0');
  });
});

describe('the window being asked about', () => {
  it('keeps a range that is already the right way round', () => {
    const window = buildAuditQueryWindow({ fromMs: 1000, toMs: 2000 });

    assert.equal(window.fromMs, 1000);
    assert.equal(window.toMs, 2000);
  });

  it('swaps a reversed range rather than returning nothing', () => {
    // Picking the dates backwards still says which fortnight is meant. Showing
    // nothing would look like the events are missing.
    const window = buildAuditQueryWindow({ fromMs: 2000, toMs: 1000 });

    assert.equal(window.fromMs, 1000);
    assert.equal(window.toMs, 2000);
  });

  it('allows an open start', () => {
    const window = buildAuditQueryWindow({ toMs: 2000 });

    assert.equal(window.fromMs, null);
    assert.equal(window.toMs, 2000);
  });

  it('allows an open end', () => {
    const window = buildAuditQueryWindow({ fromMs: 1000 });

    assert.equal(window.fromMs, 1000);
    assert.equal(window.toMs, null);
  });

  it('treats an unusable number as no bound rather than as zero', () => {
    const window = buildAuditQueryWindow({ fromMs: Number.NaN, toMs: undefined });

    assert.equal(window.fromMs, null);
    assert.equal(window.toMs, null);
  });
});
