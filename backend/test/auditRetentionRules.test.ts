import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isAuditEventDisposable,
  resolveAuditRetentionDays,
  UNCONFIGURED_AUDIT_RETENTION_DAYS
} from '../src/services/auditRetentionRules.ts';

/**
 * No period is decided here. What is decided is the arithmetic and the one
 * invariant that holds everywhere: audit outlives the records it describes.
 */

const bounds = { maximumDays: 3650, minimumDays: 365 };

describe('the audit period that actually applies', () => {
  it('falls back safely when nothing has been published', () => {
    // A tenant with no policy must not start quietly deleting evidence.
    const resolved = resolveAuditRetentionDays({
      bounds: null,
      recordRetentionDays: 90,
      requestedDays: 30
    });

    assert.equal(resolved.days, UNCONFIGURED_AUDIT_RETENTION_DAYS);
  });

  it('honours a choice inside the published range', () => {
    const resolved = resolveAuditRetentionDays({
      bounds,
      recordRetentionDays: 90,
      requestedDays: 730
    });

    assert.equal(resolved.days, 730);
    assert.equal(resolved.reason, null);
  });

  it('raises a choice below the minimum, and says so', () => {
    const resolved = resolveAuditRetentionDays({
      bounds,
      recordRetentionDays: 30,
      requestedDays: 10
    });

    assert.equal(resolved.days, 365);
    assert.match(resolved.reason || '', /minimum/i);
  });

  it('lowers a choice above the maximum, and says so', () => {
    const resolved = resolveAuditRetentionDays({
      bounds,
      recordRetentionDays: 30,
      requestedDays: 99_999
    });

    assert.equal(resolved.days, 3650);
    assert.match(resolved.reason || '', /maximum/i);
  });

  it('never keeps audit for less time than the records it describes', () => {
    // The invariant. Otherwise an organization holds actions that ended with no
    // account of how or by whom.
    const resolved = resolveAuditRetentionDays({
      bounds,
      recordRetentionDays: 2000,
      requestedDays: 365
    });

    assert.equal(resolved.days, 2000);
    assert.match(resolved.reason || '', /outlives/i);
  });

  it('applies that invariant even over a published maximum', () => {
    // A ceiling that would leave records outliving their audit trail is a
    // misconfiguration, not an instruction.
    const resolved = resolveAuditRetentionDays({
      bounds: { maximumDays: 400, minimumDays: 30 },
      recordRetentionDays: 3000,
      requestedDays: 400
    });

    assert.equal(resolved.days, 3000);
  });

  it('uses the minimum when nothing was chosen', () => {
    const resolved = resolveAuditRetentionDays({
      bounds,
      recordRetentionDays: null,
      requestedDays: null
    });

    assert.equal(resolved.days, 365);
  });

  it('treats a nonsense choice as no choice rather than as zero', () => {
    const resolved = resolveAuditRetentionDays({
      bounds,
      recordRetentionDays: null,
      requestedDays: -5
    });

    assert.equal(resolved.days, 365);
  });

  it('accepts no ceiling at all', () => {
    const resolved = resolveAuditRetentionDays({
      bounds: { maximumDays: null, minimumDays: 365 },
      recordRetentionDays: null,
      requestedDays: 50_000
    });

    assert.equal(resolved.days, 50_000);
  });
});

describe('whether one event may be disposed of', () => {
  const NOW = 1_800_000_000_000;
  const DAY = 24 * 60 * 60 * 1000;

  it('disposes of an event past its period', () => {
    assert.equal(
      isAuditEventDisposable({ createdAtMs: NOW - 400 * DAY, nowMs: NOW, retentionDays: 365 }),
      true
    );
  });

  it('keeps an event still inside its period', () => {
    assert.equal(
      isAuditEventDisposable({ createdAtMs: NOW - 300 * DAY, nowMs: NOW, retentionDays: 365 }),
      false
    );
  });

  it('keeps an event exactly on the boundary', () => {
    // A record disposed of one millisecond early was not kept for the period
    // the organization promised its auditor.
    assert.equal(
      isAuditEventDisposable({ createdAtMs: NOW - 365 * DAY, nowMs: NOW, retentionDays: 365 }),
      false
    );
  });

  it('keeps an event with no usable date rather than guessing', () => {
    assert.equal(isAuditEventDisposable({ createdAtMs: 0, nowMs: NOW, retentionDays: 1 }), false);
    assert.equal(
      isAuditEventDisposable({ createdAtMs: Number.NaN, nowMs: NOW, retentionDays: 1 }),
      false
    );
  });

  it('keeps an event dated in the future rather than treating it as ancient', () => {
    assert.equal(
      isAuditEventDisposable({ createdAtMs: NOW + DAY, nowMs: NOW, retentionDays: 365 }),
      false
    );
  });
});
