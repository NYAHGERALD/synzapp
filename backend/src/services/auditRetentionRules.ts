import { isPastRetentionPeriod } from './retentionAge.js';

/**
 * How long an audit event is kept.
 *
 * **No period is written here.** An earlier draft of the governance plan put a
 * seven year floor in the product, and that was wrong: FDA 21 CFR 117.315 wants
 * two years, OSHA five, HIPAA six, SOX seven, and GDPR Article 5(1)(e) pulls the
 * other way entirely by asking that nothing be kept longer than necessary. A
 * constant cannot be right for all of them, and the person accountable for it
 * cannot change it.
 *
 * So periods are **published**: Synzapp staff set the allowed range on
 * `admin.synzapp.com`, a tenant chooses inside it, and this module holds only
 * the arithmetic and the one invariant that is true everywhere.
 *
 * See section 6 of SYNZAPP_ACTIONS_GOVERNANCE_PLAN.md.
 */

/**
 * Used only when nothing has been published yet.
 *
 * Deliberately long. A tenant whose policy has not been set up must not start
 * quietly deleting evidence, and keeping too much is a problem that can be
 * corrected afterwards while deleting too early cannot.
 */
export const UNCONFIGURED_AUDIT_RETENTION_DAYS = 365 * 7;

export interface PublishedRetentionBounds {
  /** The longest a tenant may choose. Null means no ceiling. */
  maximumDays: number | null;
  /** The shortest a tenant may choose. */
  minimumDays: number;
}

export interface ResolvedAuditRetention {
  days: number;
  /** Why it is this and not what was asked for, when the two differ. */
  reason: string | null;
}

/**
 * The period that actually applies, and why.
 *
 * Three things are settled here, in this order, because each can override the
 * one before:
 *
 * 1. Nothing published, so the safe fallback applies.
 * 2. The tenant's choice is pulled inside the published bounds.
 * 3. **Audit is never kept for less time than the records it describes.**
 *
 * That last one is the invariant worth stating plainly. If the audit log ages
 * out first, an organization is left holding actions that ended with no account
 * of how or by whom, which is worse than having neither.
 */
export function resolveAuditRetentionDays(input: {
  bounds: PublishedRetentionBounds | null;
  recordRetentionDays: number | null;
  requestedDays: number | null;
}): ResolvedAuditRetention {
  const { bounds, recordRetentionDays, requestedDays } = input;

  if (!bounds) {
    return {
      days: UNCONFIGURED_AUDIT_RETENTION_DAYS,
      reason: 'No retention policy has been published for this organization yet.'
    };
  }

  let days = Number.isFinite(requestedDays) && (requestedDays as number) > 0
    ? Math.round(requestedDays as number)
    : bounds.minimumDays;
  let reason: string | null = null;

  if (days < bounds.minimumDays) {
    days = bounds.minimumDays;
    reason = `Raised to the ${bounds.minimumDays} day minimum set for your organization.`;
  }

  if (bounds.maximumDays !== null && days > bounds.maximumDays) {
    days = bounds.maximumDays;
    reason = `Lowered to the ${bounds.maximumDays} day maximum set for your organization.`;
  }

  // Applied last, so it wins even over a published maximum. A ceiling that
  // would leave records outliving their own audit trail is a misconfiguration,
  // not an instruction.
  if (Number.isFinite(recordRetentionDays) && (recordRetentionDays as number) > days) {
    days = Math.round(recordRetentionDays as number);
    reason = 'Extended so the audit log outlives the records it describes.';
  }

  return { days, reason };
}

/**
 * Whether an audit event is old enough to dispose of.
 *
 * Delegates to the shared age rule so audit and record bodies cannot drift
 * apart on what "past its period" means.
 */
export function isAuditEventDisposable(input: {
  createdAtMs: number;
  nowMs: number;
  retentionDays: number;
}): boolean {
  return isPastRetentionPeriod(input);
}
