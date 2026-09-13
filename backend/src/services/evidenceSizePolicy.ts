/**
 * How large a single evidence file may be, and who decided.
 *
 * Two numbers, because two people have a say. Synzapp sets what a company is
 * *allowed* to reach, since the storage bill is Synzapp's; the company then
 * chooses anything up to that, since which files matter is theirs to judge.
 * Neither can be inferred from the other, so both are stored.
 *
 * Kept away from Firestore so it can be tested: the rules below are the whole
 * of the decision, and the service around them only fetches and stores.
 */

export interface EvidenceSizePolicy {
  /**
   * The company's own limit, in bytes.
   *
   * Never above `maxAllowedFileBytes`. A stored value that exceeds it is read
   * back clamped rather than honoured — a ceiling lowered by Synzapp has to
   * take effect without waiting for the company to notice and adjust.
   */
  maxFileBytes: number;
  /** The ceiling Synzapp allows this company. Only staff may change it. */
  maxAllowedFileBytes: number;
}

/**
 * Where a company starts.
 *
 * 4 MB is what both evidence services enforced before this was configurable,
 * so an organization that never opens the setting sees no change at all.
 */
export const DEFAULT_EVIDENCE_MAX_FILE_BYTES = 4 * 1024 * 1024;

/** What Synzapp allows a new company before anyone raises it. */
export const DEFAULT_EVIDENCE_MAX_ALLOWED_FILE_BYTES = 25 * 1024 * 1024;

/** Below this nothing useful can be filed; a photograph is routinely larger. */
export const MIN_EVIDENCE_MAX_FILE_BYTES = 1024 * 1024;

/**
 * The hard stop, above which no ceiling may be set.
 *
 * Not a storage limit but a delivery one. Evidence goes straight to Cloud
 * Storage from the browser, so the API never holds it, but somebody on a plant
 * floor still has to push the bytes up a weak connection before the signed URL
 * expires.
 */
export const MAX_EVIDENCE_MAX_FILE_BYTES = 100 * 1024 * 1024;

export const DEFAULT_EVIDENCE_SIZE_POLICY: EvidenceSizePolicy = {
  maxFileBytes: DEFAULT_EVIDENCE_MAX_FILE_BYTES,
  maxAllowedFileBytes: DEFAULT_EVIDENCE_MAX_ALLOWED_FILE_BYTES
};

export function normalizeEvidenceSizePolicy(
  stored?: Record<string, unknown> | null
): EvidenceSizePolicy {
  if (!stored || typeof stored !== 'object') {
    return { ...DEFAULT_EVIDENCE_SIZE_POLICY };
  }

  const maxAllowedFileBytes = clampBytes(
    stored.maxAllowedFileBytes,
    DEFAULT_EVIDENCE_SIZE_POLICY.maxAllowedFileBytes
  );

  return {
    // Clamped on read, so lowering the ceiling takes effect at once.
    maxFileBytes: Math.min(
      clampBytes(stored.maxFileBytes, DEFAULT_EVIDENCE_SIZE_POLICY.maxFileBytes),
      maxAllowedFileBytes
    ),
    maxAllowedFileBytes
  };
}

/** What a company may set for itself, judged against the ceiling it was given. */
export function validateEvidenceSizePolicyInput(
  input: { maxFileBytes?: unknown },
  maxAllowedFileBytes: number
): { ok: boolean; reason?: string } {
  if (!isWholeByteCount(input.maxFileBytes)) {
    return { ok: false, reason: 'Choose a file size limit.' };
  }

  if (input.maxFileBytes < MIN_EVIDENCE_MAX_FILE_BYTES) {
    return { ok: false, reason: `The limit cannot be below ${describeBytes(MIN_EVIDENCE_MAX_FILE_BYTES)}.` };
  }

  if (input.maxFileBytes > maxAllowedFileBytes) {
    return {
      ok: false,
      reason: `Your organization is allowed up to ${describeBytes(maxAllowedFileBytes)}. Ask Synzapp to raise it.`
    };
  }

  return { ok: true };
}

/** What Synzapp staff may set as a company's ceiling. */
export function validateEvidenceMaxAllowedInput(
  input: { maxAllowedFileBytes?: unknown }
): { ok: boolean; reason?: string } {
  if (!isWholeByteCount(input.maxAllowedFileBytes)) {
    return { ok: false, reason: 'Choose a maximum for this organization.' };
  }

  if (input.maxAllowedFileBytes < MIN_EVIDENCE_MAX_FILE_BYTES) {
    return { ok: false, reason: `The maximum cannot be below ${describeBytes(MIN_EVIDENCE_MAX_FILE_BYTES)}.` };
  }

  if (input.maxAllowedFileBytes > MAX_EVIDENCE_MAX_FILE_BYTES) {
    return { ok: false, reason: `The maximum cannot be above ${describeBytes(MAX_EVIDENCE_MAX_FILE_BYTES)}.` };
  }

  return { ok: true };
}

/** Said the way a person would say it, for a message somebody has to act on. */
export function describeBytes(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);

  return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`;
}

function isWholeByteCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function clampBytes(value: unknown, fallback: number): number {
  if (!isWholeByteCount(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, MIN_EVIDENCE_MAX_FILE_BYTES), MAX_EVIDENCE_MAX_FILE_BYTES);
}
