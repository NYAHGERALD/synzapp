import type {
  DispositionItem,
  LegalHoldSummary,
  RetentionPolicy
} from './complianceApi';

/**
 * Turning compliance records into the words the console shows.
 *
 * The screens were designed against readable strings — "7 years", "6 days ago",
 * "Releasing" — while the API returns durations in days and instants in
 * milliseconds. Converting between the two is where an off-by-one quietly
 * becomes a wrong retention period on an admin's screen, so it lives here, in
 * one place, with tests.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PolicyRow {
  action: string;
  duration: string;
  id: string;
  name: string;
  scopeDetail: string;
  scopeSummary: string;
  state: 'Active' | 'Draft' | 'Simulation';
}

export interface HoldRow {
  caseId: string;
  detail: string;
  id: string;
  name: string;
  state: 'Active' | 'Releasing' | 'Released';
}

export interface DispositionRow {
  eligible: string;
  id: string;
  items: string;
  policy: string;
  purgeBy: string;
  subject: string;
  subtitle: string;
  withheld: boolean;
}

/**
 * A duration in words.
 *
 * Rounded to whole years or months only when it divides evenly, because an
 * administrator reading "1 year" for a 400-day policy has been told something
 * untrue about how long their records survive.
 */
export function formatRetentionDuration(durationDays: number): string {
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

export function formatRetentionAction(policy: RetentionPolicy): string {
  if (policy.action === 'retain') {
    return 'Retain only';
  }

  return policy.action === 'delete' ? 'Delete' : 'Retain, then delete';
}

/** A plain-language description of what a policy covers. */
export function formatPolicyScope(policy: RetentionPolicy): string {
  if (policy.scopeKind === 'organization') {
    return 'Every chat, message and file in your company';
  }

  const count = policy.scopeTargets.length;
  const noun = policy.scopeKind === 'user' ? 'person' : 'conversation';

  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

export function toPolicyRow(policy: RetentionPolicy): PolicyRow {
  return {
    action: formatRetentionAction(policy),
    // A plain retain has no end, and showing its duration would imply one.
    duration: policy.action === 'retain'
      ? 'Indefinite'
      : formatRetentionDuration(policy.durationDays),
    id: policy.id,
    name: policy.name,
    scopeDetail: policy.scopeKind === 'organization'
      ? 'Org-wide'
      : `${policy.scopeTargets.length} ${policy.scopeKind === 'user' ? 'people' : 'conversations'}`,
    scopeSummary: formatPolicyScope(policy),
    state: policy.state === 'ACTIVE' ? 'Active' : policy.state === 'SIMULATION' ? 'Simulation' : 'Draft'
  };
}

/**
 * How long ago something happened, or how far away it is.
 *
 * Deliberately coarse. The disposition queue is read to decide whether to
 * approve a destruction, and false precision there invites a decision made on a
 * number nobody checked.
 */
export function formatRelativeDay(timestampMs: number, nowMs: number): string {
  const differenceMs = nowMs - timestampMs;
  const days = Math.floor(Math.abs(differenceMs) / DAY_MS);

  if (days === 0) {
    return 'today';
  }

  const label = days === 1 ? '1 day' : `${days} days`;

  return differenceMs >= 0 ? `${label} ago` : `in ${label}`;
}

export function formatHoldState(hold: LegalHoldSummary, nowMs: number): HoldRow['state'] {
  if (!hold.releasedAtMs) {
    return 'Active';
  }

  // A released hold still protects until its delay expires. Calling that
  // "Released" would tell an admin the evidence is already exposed.
  return typeof hold.delayUntilMs === 'number' && nowMs < hold.delayUntilMs
    ? 'Releasing'
    : 'Released';
}

export function toHoldRow(hold: LegalHoldSummary, nowMs: number): HoldRow {
  const state = formatHoldState(hold, nowMs);
  const custodians = hold.custodianUids.length
    ? `${hold.custodianUids.length} custodian${hold.custodianUids.length === 1 ? '' : 's'}`
    : 'All custodians';
  const detail = state === 'Releasing' && hold.delayUntilMs
    ? `Released · protected until ${new Date(hold.delayUntilMs).toLocaleDateString()}`
    : `${custodians} · applied ${new Date(hold.appliedAtMs).toLocaleDateString()}`;

  return { caseId: hold.caseId, detail, id: hold.id, name: hold.description, state };
}

export function toDispositionRow(item: DispositionItem, nowMs: number): DispositionRow {
  return {
    eligible: formatRelativeDay(item.eligibleAtMs, nowMs),
    id: item.id,
    items: item.itemCount.toLocaleString(),
    policy: item.subjectRef,
    purgeBy: new Date(item.purgeByMs).toLocaleDateString(),
    subject: item.label,
    subtitle: item.state === 'WITHHELD'
      ? 'Withheld by a legal hold'
      : `Eligible ${formatRelativeDay(item.eligibleAtMs, nowMs)}`,
    withheld: item.state === 'WITHHELD'
  };
}

/**
 * The queue split into what can be acted on and what is frozen.
 *
 * Held batches are counted rather than hidden: an empty queue otherwise reads
 * the same whether nothing expired or everything is under hold, and those are
 * very different situations for an administrator to be in.
 */
export function splitDispositionQueue(items: DispositionItem[], nowMs: number): {
  reviewable: DispositionRow[];
  withheldCount: number;
} {
  const rows = items
    .filter((item) => item.state !== 'PURGED')
    .map((item) => toDispositionRow(item, nowMs));

  return {
    reviewable: rows.filter((row) => !row.withheld),
    withheldCount: rows.filter((row) => row.withheld).length
  };
}
