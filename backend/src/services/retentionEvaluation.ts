/**
 * Deciding how long a thing must be kept, and when it may be destroyed.
 *
 * Follows SYNZAPP_TENANT_RETENTION_AND_LEGAL_HOLD_PLAN.md. Everything here is
 * pure: no database, no clock of its own, no I/O. That matters more here than
 * anywhere else in the system, because these rules decide whether a company's
 * evidence survives, and "we think it works" is not an answer to give a
 * regulator.
 *
 * The two ideas the plan is built on:
 *
 * Media retention is **derived, never configured**. A blob's lifetime is the
 * longest lifetime of any message that references it. Synzapp currently gives
 * every blob a fixed TTL, so media expires on a timer while the messages that
 * point at it remain — a restore then returns a conversation of empty frames.
 * That is the hollow restore this replaces.
 *
 * Deletion and destruction are **different operations**. Nothing here destroys
 * anything; it computes dates and eligibility. Destruction is a separate
 * background job that must re-check a hold immediately before shredding.
 */

/** What a policy does when it matches. */
export type RetentionAction = 'delete' | 'retain' | 'retain_then_delete';

/** How specific a policy's scope is. Narrower beats broader in precedence. */
export type RetentionScopeKind = 'conversation' | 'organization' | 'user';

export interface RetentionPolicy {
  action: RetentionAction;
  /** Days from the anchor date. Ignored for a bare `delete`. */
  durationDays: number;
  id: string;
  scopeKind: RetentionScopeKind;
}

export interface LegalHold {
  /**
   * When a released hold stops protecting the item.
   *
   * A release is not instant: the grace window exists so a hold lifted in error
   * does not immediately expose evidence to the disposer.
   */
  delayUntilMs?: number | null;
  id: string;
  releasedAtMs?: number | null;
}

export interface RetentionSubject {
  /** The anchor date every duration is measured from. */
  createdAtMs: number;
  lastModifiedAtMs?: number | null;
}

export interface RetentionOutcome {
  /** The hold responsible, when one is suspending disposal. */
  blockingHoldId: string | null;
  /**
   * Why this outcome was reached, in the order the rules were applied.
   *
   * The plan calls the explainer the feature most likely to win a compliance
   * review: computing precedence correctly is table stakes, being able to show
   * an auditor *why* a specific message survived is not.
   */
  explanation: string[];
  /** The policy that set `retainUntilMs`, when one did. */
  governingPolicyId: string | null;
  /** True while a hold suspends destruction, regardless of dates. */
  isOnHold: boolean;
  /** Earliest the item may be destroyed, or null when it must be kept. */
  purgeAfterMs: number | null;
  /** The item must survive until at least this instant. */
  retainUntilMs: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Narrower scopes win precedence rule 4. */
const SCOPE_SPECIFICITY: Record<RetentionScopeKind, number> = {
  conversation: 3,
  organization: 1,
  user: 2
};

/**
 * Whether a hold still protects an item.
 *
 * A hold that was never released always protects. A released one keeps
 * protecting until its delay expires, so lifting a hold by mistake does not
 * hand the item straight to the disposer.
 */
export function isHoldActive(hold: LegalHold, nowMs: number): boolean {
  if (!hold.releasedAtMs) {
    return true;
  }

  return typeof hold.delayUntilMs === 'number' && nowMs < hold.delayUntilMs;
}

function getAnchorMs(policy: RetentionPolicy, subject: RetentionSubject): number {
  return subject.lastModifiedAtMs && policy.action !== 'delete'
    ? Math.max(subject.createdAtMs, subject.lastModifiedAtMs)
    : subject.createdAtMs;
}

/**
 * The single outcome for one item, applying the plan's precedence in order.
 *
 * 1. A hold suspends everything, indefinitely.
 * 2. Retention beats deletion.
 * 3. The longest retention wins.
 * 4. Most specific scope wins, then shortest deletion.
 *
 * These are Microsoft's principles of retention. The plan adopts rather than
 * invents them deliberately — a compliance reviewer recognises them, and any
 * difference would have to be defended.
 */
export function resolveRetentionOutcome(input: {
  holds: LegalHold[];
  nowMs: number;
  policies: RetentionPolicy[];
  subject: RetentionSubject;
}): RetentionOutcome {
  const explanation: string[] = [];
  const activeHold = input.holds.find((hold) => isHoldActive(hold, input.nowMs)) || null;

  const retainPolicies = input.policies.filter((policy) => policy.action !== 'delete');
  const deletePolicies = input.policies.filter((policy) => policy.action === 'delete');

  let retainUntilMs = input.subject.createdAtMs;
  let governingPolicyId: string | null = null;

  // Rules 2 and 3: any retain obligation beats deletion, and the longest wins.
  retainPolicies.forEach((policy) => {
    const candidate = getAnchorMs(policy, input.subject) + policy.durationDays * DAY_MS;

    if (candidate > retainUntilMs) {
      retainUntilMs = candidate;
      governingPolicyId = policy.id;
    }
  });

  if (governingPolicyId) {
    explanation.push(
      `Retained by policy ${governingPolicyId} until ${new Date(retainUntilMs).toISOString()}.`
    );

    if (retainPolicies.length > 1) {
      explanation.push(`Longest of ${retainPolicies.length} retention obligations wins.`);
    }

    if (deletePolicies.length) {
      explanation.push(`Retention beats ${deletePolicies.length} deletion policy(ies).`);
    }
  }

  // Rule 4: among deletion policies, the most specific scope wins; the shortest
  // duration breaks a tie between equally specific ones.
  let purgeAfterMs: number | null = null;

  if (!retainPolicies.length && deletePolicies.length) {
    const winner = [...deletePolicies].sort((first, second) => {
      const specificity = SCOPE_SPECIFICITY[second.scopeKind] - SCOPE_SPECIFICITY[first.scopeKind];

      return specificity !== 0 ? specificity : first.durationDays - second.durationDays;
    })[0];

    purgeAfterMs = getAnchorMs(winner, input.subject) + winner.durationDays * DAY_MS;
    governingPolicyId = winner.id;
    retainUntilMs = purgeAfterMs;
    explanation.push(
      `Deleted by policy ${winner.id} (${winner.scopeKind} scope) after ${new Date(purgeAfterMs).toISOString()}.`
    );
  } else if (governingPolicyId) {
    const governing = retainPolicies.find((policy) => policy.id === governingPolicyId);

    // `retain` keeps forever; only `retain_then_delete` names a purge date.
    purgeAfterMs = governing?.action === 'retain_then_delete' ? retainUntilMs : null;
  }

  if (!input.policies.length) {
    explanation.push('No retention policy applies; the item is kept indefinitely.');
  }

  // Rule 1 is applied last so the explanation shows what the hold is suspending.
  if (activeHold) {
    explanation.unshift(
      `Legal hold ${activeHold.id} suspends destruction indefinitely. Obligations continue to accrue.`
    );

    return {
      blockingHoldId: activeHold.id,
      explanation,
      governingPolicyId,
      isOnHold: true,
      purgeAfterMs: null,
      retainUntilMs
    };
  }

  return {
    blockingHoldId: null,
    explanation,
    governingPolicyId,
    isOnHold: false,
    purgeAfterMs,
    retainUntilMs
  };
}

export interface BlobReference {
  /** Null means the referencing message must be kept indefinitely. */
  purgeAfterMs: number | null;
  retainUntilMs: number;
  /** False once the referencing message leaves the live plane. */
  isLive: boolean;
}

export interface BlobRetention {
  derivedRetainUntilMs: number;
  liveRefCount: number;
  /** Null when at least one reference must be kept indefinitely. */
  purgeAfterMs: number | null;
}

/**
 * A blob's retention, derived from every message that references it.
 *
 * This is the invariant that makes "your data is retained" true rather than
 * aspirational: a blob outlives the longest-lived message pointing at it. There
 * is deliberately no configurable media TTL — the plan's decision 1 — because a
 * timer that expires media out from under live messages is precisely what
 * produces a restore full of empty frames.
 */
export function deriveBlobRetention(references: BlobReference[]): BlobRetention {
  const liveRefCount = references.filter((reference) => reference.isLive).length;

  if (!references.length) {
    return { derivedRetainUntilMs: 0, liveRefCount: 0, purgeAfterMs: 0 };
  }

  const derivedRetainUntilMs = references.reduce(
    (latest, reference) => Math.max(latest, reference.retainUntilMs),
    0
  );

  // One reference with no purge date keeps the blob indefinitely: the blob
  // cannot outlive the shortest obligation, only the longest.
  const hasIndefiniteReference = references.some((reference) => reference.purgeAfterMs === null);
  const purgeAfterMs = hasIndefiniteReference
    ? null
    : references.reduce((latest, reference) => Math.max(latest, reference.purgeAfterMs || 0), 0);

  return { derivedRetainUntilMs, liveRefCount, purgeAfterMs };
}

/**
 * Whether a blob's bytes may be destroyed.
 *
 * Both conditions are required, and the reference count is the one that catches
 * the case a date alone misses: a blob whose retention has expired but which a
 * live message still points at must not be touched.
 */
export function isBlobPurgeable(blob: BlobRetention, nowMs: number): boolean {
  if (blob.liveRefCount > 0) {
    return false;
  }

  if (blob.purgeAfterMs === null) {
    return false;
  }

  return nowMs >= blob.derivedRetainUntilMs && nowMs >= blob.purgeAfterMs;
}
