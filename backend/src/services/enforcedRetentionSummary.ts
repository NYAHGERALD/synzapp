/**
 * What the company profile should say about retention.
 *
 * Every organization was stamped with `retentionPolicy: '3_YEARS'` when it was
 * created, and the company profile screen showed it as "Retention: 3 Years". No
 * part of the retention engine has ever read that field — it works from the
 * `retentionPolicies` subcollection and from `recordRetentionDays`. So the
 * product stated a three year commitment to every customer while enforcing
 * whatever, if anything, had actually been configured.
 *
 * A screen that states a retention period the system does not enforce is worse
 * than a screen with no such row: somebody plans around it, and an auditor is
 * told something untrue in writing.
 *
 * So the value is derived from the policies that actually run. Pure, so the
 * wording can be tested.
 */

export interface EnforcedRetentionPolicy {
  durationDays: number;
  state: string;
  supersededAtMs?: number | null;
}

/** Only a live policy counts. A superseded or simulated one enforces nothing. */
export function isEnforcedRetentionPolicy(policy: EnforcedRetentionPolicy): boolean {
  return policy.state === 'ACTIVE' && !policy.supersededAtMs;
}

/**
 * The retention line for the company profile.
 *
 * Says "Not configured" when nothing is enforced, rather than a period. That is
 * the honest answer, and it is also the one that prompts somebody to go and set
 * one up — which the old fiction actively prevented, because it looked done.
 */
export function describeEnforcedRetention(policies: EnforcedRetentionPolicy[]): string {
  const enforced = policies.filter(isEnforcedRetentionPolicy);

  if (!enforced.length) {
    return 'Not configured';
  }

  if (enforced.length === 1) {
    return describeDuration(enforced[0].durationDays);
  }

  /**
   * Several policies cannot honestly be reduced to one period: they cover
   * different people, conversations and content types. The count is true and
   * sends somebody to the console, where the detail actually lives.
   */
  return `${enforced.length} policies`;
}

function describeDuration(durationDays: number): string {
  if (!Number.isFinite(durationDays) || durationDays <= 0) {
    return 'Not configured';
  }

  if (durationDays % 365 === 0) {
    const years = durationDays / 365;

    return years === 1 ? '1 year' : `${years} years`;
  }

  if (durationDays % 30 === 0) {
    const months = durationDays / 30;

    return months === 1 ? '1 month' : `${months} months`;
  }

  return durationDays === 1 ? '1 day' : `${durationDays} days`;
}
