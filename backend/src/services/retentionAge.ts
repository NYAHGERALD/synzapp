/**
 * Whether something is old enough to dispose of.
 *
 * One definition, used by every disposer, because "past its period" arrived at
 * two different ways in two different files is how one of them ends up
 * deleting a day early.
 *
 * Every judgement here fails toward **keeping**. Disposal is irreversible and
 * the thing being disposed of is usually the evidence somebody will later be
 * asked to produce.
 */
export function isPastRetentionPeriod(input: {
  createdAtMs: number;
  nowMs: number;
  retentionDays: number;
}): boolean {
  if (!Number.isFinite(input.createdAtMs) || input.createdAtMs <= 0) {
    // No usable date, so no way to prove it is old enough.
    return false;
  }

  if (!Number.isFinite(input.retentionDays) || input.retentionDays <= 0) {
    // No period, or a nonsense one. A zero here would mean "delete everything".
    return false;
  }

  // Exclusive. A record disposed of one millisecond early was not kept for the
  // period the organization promised its auditor.
  return input.nowMs - input.createdAtMs > input.retentionDays * 24 * 60 * 60 * 1000;
}
