import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RETENTION_TEMPLATES } from '../src/services/retentionBoundsService.ts';
import { resolveAuditRetentionDays } from '../src/services/auditRetentionRules.ts';

/**
 * The starting sets staff choose between, and that they hold together with the
 * rule that resolves an actual period.
 */

describe('the retention templates offered to staff', () => {
  it('names the regime each number came from, so it can be argued with', () => {
    for (const template of RETENTION_TEMPLATES) {
      assert.ok(template.rationale.length > 20, `${template.id} has no rationale`);
    }
  });

  it('never offers a maximum shorter than its own minimum', () => {
    for (const template of RETENTION_TEMPLATES) {
      if (template.maximumDays !== null) {
        assert.ok(
          template.maximumDays >= template.minimumDays,
          `${template.id} cannot be satisfied`
        );
      }
    }
  });

  it('has a distinct id for each, so publishing records which was used', () => {
    const ids = RETENTION_TEMPLATES.map((template) => template.id);

    assert.equal(new Set(ids).size, ids.length);
  });

  it('covers the regimes the plan names', () => {
    const ids = RETENTION_TEMPLATES.map((template) => template.id);

    for (const expected of ['food-safety', 'workplace-safety', 'healthcare', 'financial']) {
      assert.ok(ids.includes(expected), `missing ${expected}`);
    }
  });

  it('offers one that keeps less rather than more', () => {
    // GDPR pulls the opposite way from the rest. An organization whose works
    // council expects a short horizon must have something to choose.
    const minimising = RETENTION_TEMPLATES.find((template) => template.id === 'data-minimising');

    assert.ok(minimising);
    assert.ok(minimising.maximumDays !== null);
  });

  it('produces a usable period for every template', () => {
    for (const template of RETENTION_TEMPLATES) {
      const resolved = resolveAuditRetentionDays({
        bounds: { maximumDays: template.maximumDays, minimumDays: template.minimumDays },
        recordRetentionDays: null,
        requestedDays: null
      });

      assert.equal(resolved.days, template.minimumDays);
    }
  });
});
