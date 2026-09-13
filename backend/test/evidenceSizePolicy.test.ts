import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_EVIDENCE_SIZE_POLICY,
  MAX_EVIDENCE_MAX_FILE_BYTES,
  MIN_EVIDENCE_MAX_FILE_BYTES,
  describeBytes,
  normalizeEvidenceSizePolicy,
  validateEvidenceMaxAllowedInput,
  validateEvidenceSizePolicyInput
} from '../src/services/evidenceSizePolicy.ts';

const MB = 1024 * 1024;

describe('what an organization starts with', () => {
  it('matches the limit both evidence services enforced before it was a setting', () => {
    // An organization that never opens the setting must see no change at all.
    assert.equal(DEFAULT_EVIDENCE_SIZE_POLICY.maxFileBytes, 4 * MB);
  });

  it('reads nothing stored as the default', () => {
    assert.deepEqual(normalizeEvidenceSizePolicy(null), DEFAULT_EVIDENCE_SIZE_POLICY);
    assert.deepEqual(normalizeEvidenceSizePolicy({}), DEFAULT_EVIDENCE_SIZE_POLICY);
  });

  it('never lets a company sit above its own ceiling', () => {
    // Synzapp lowering the ceiling has to bite immediately, without waiting for
    // the company to notice and adjust their own number down to match.
    const policy = normalizeEvidenceSizePolicy({
      maxAllowedFileBytes: 10 * MB,
      maxFileBytes: 50 * MB
    });

    assert.equal(policy.maxFileBytes, 10 * MB);
  });

  it('ignores a stored value that is not a whole count of bytes', () => {
    for (const bad of [0, -5, 4.5, '8mb', null, {}]) {
      const policy = normalizeEvidenceSizePolicy({ maxFileBytes: bad });

      assert.equal(policy.maxFileBytes, DEFAULT_EVIDENCE_SIZE_POLICY.maxFileBytes);
    }
  });

  it('refuses to read back anything above the hard stop, however it got stored', () => {
    const policy = normalizeEvidenceSizePolicy({
      maxAllowedFileBytes: 900 * MB,
      maxFileBytes: 900 * MB
    });

    assert.equal(policy.maxAllowedFileBytes, MAX_EVIDENCE_MAX_FILE_BYTES);
    assert.equal(policy.maxFileBytes, MAX_EVIDENCE_MAX_FILE_BYTES);
  });
});

describe('what a company may choose for itself', () => {
  it('accepts a value inside the ceiling it was given', () => {
    assert.deepEqual(validateEvidenceSizePolicyInput({ maxFileBytes: 20 * MB }, 25 * MB), { ok: true });
  });

  it('refuses to go above the ceiling, and says who can raise it', () => {
    const result = validateEvidenceSizePolicyInput({ maxFileBytes: 40 * MB }, 25 * MB);

    assert.equal(result.ok, false);
    assert.match(result.reason || '', /25 MB/);
    assert.match(result.reason || '', /Synzapp/);
  });

  it('refuses a limit too small to hold a photograph', () => {
    assert.equal(validateEvidenceSizePolicyInput({ maxFileBytes: 1000 }, 25 * MB).ok, false);
  });

  it('refuses anything that is not a whole count of bytes', () => {
    for (const bad of [undefined, null, '4mb', 4.5, -1, 0]) {
      assert.equal(validateEvidenceSizePolicyInput({ maxFileBytes: bad }, 25 * MB).ok, false);
    }
  });
});

describe('what Synzapp staff may allow a company', () => {
  it('accepts the whole range up to the hard stop', () => {
    assert.deepEqual(validateEvidenceMaxAllowedInput({ maxAllowedFileBytes: 100 * MB }), { ok: true });
    assert.deepEqual(validateEvidenceMaxAllowedInput({ maxAllowedFileBytes: MIN_EVIDENCE_MAX_FILE_BYTES }), { ok: true });
  });

  it('refuses to go above the hard stop', () => {
    const result = validateEvidenceMaxAllowedInput({ maxAllowedFileBytes: 101 * MB });

    assert.equal(result.ok, false);
    assert.match(result.reason || '', /100 MB/);
  });
});

describe('saying a size the way a person would', () => {
  it('drops the decimal when there is nothing after it', () => {
    assert.equal(describeBytes(4 * MB), '4 MB');
    assert.equal(describeBytes(100 * MB), '100 MB');
  });

  it('keeps one decimal when the number is not whole', () => {
    assert.equal(describeBytes(4.5 * MB), '4.5 MB');
  });
});
