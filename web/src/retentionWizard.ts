import type { RetentionAction, RetentionScopeKind } from './complianceApi';

/**
 * The state behind the new-policy wizard.
 *
 * Kept out of the component because this is where a policy that deletes the
 * wrong thing gets created. A wizard that lets an administrator reach the last
 * step with an empty scope, or a duration of zero, produces a live rule against
 * a company's records — so each step is gated on its own, and the rules are
 * testable without rendering anything.
 */

export type WizardStep = 0 | 1 | 2 | 3 | 4;

export const WIZARD_STEP_LABELS = ['Name', 'Scope', 'Content', 'Retention', 'Review'] as const;

/** The message kinds a policy can be limited to. Empty means everything. */
export const RETENTION_CONTENT_TYPES = [
  { id: 'messages', label: 'Messages' },
  { id: 'attachments', label: 'Attachments' },
  { id: 'calls', label: 'Call records' }
] as const;

export interface RetentionPolicyDraft {
  action: RetentionAction;
  anchor: 'created' | 'last_modified';
  contentTypes: string[];
  durationDays: string;
  name: string;
  scopeKind: RetentionScopeKind;
  /** Free text: one target per line, as an admin would paste them. */
  scopeTargetsText: string;
}

export function createRetentionPolicyDraft(): RetentionPolicyDraft {
  return {
    action: 'retain_then_delete',
    anchor: 'created',
    contentTypes: [],
    durationDays: '90',
    name: '',
    scopeKind: 'organization',
    scopeTargetsText: ''
  };
}

/** Splits pasted targets on lines or commas, ignoring blanks and duplicates. */
export function parseScopeTargets(text: string): string[] {
  const targets = text
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set(targets)];
}

export function parseDurationDays(value: string): number | null {
  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const days = Number(trimmed);

  return days >= 1 ? days : null;
}

/**
 * What stops the admin moving on from a step, in words they can act on.
 *
 * Returns null when the step is complete.
 */
export function getStepError(draft: RetentionPolicyDraft, step: WizardStep): string | null {
  if (step === 0) {
    return draft.name.trim() ? null : 'Give this policy a name your colleagues will recognise.';
  }

  if (step === 1) {
    if (draft.scopeKind === 'organization') {
      return null;
    }

    // An empty target list on a narrow scope would silently behave as org-wide,
    // which is the widest possible reach arrived at by accident.
    return parseScopeTargets(draft.scopeTargetsText).length
      ? null
      : 'Add at least one person or conversation, or change the scope to the whole organization.';
  }

  if (step === 3) {
    // A bare delete is the destructive action; retention still needs a duration
    // to know when it ends, unless it never does.
    if (draft.action === 'retain') {
      return null;
    }

    return parseDurationDays(draft.durationDays)
      ? null
      : 'Enter a whole number of days, at least 1.';
  }

  return null;
}

export function canAdvance(draft: RetentionPolicyDraft, step: WizardStep): boolean {
  return getStepError(draft, step) === null;
}

/**
 * Whether the policy can be created at all.
 *
 * Checks every step, not just the current one: an admin can go back and empty a
 * field after passing it, and the review step must not offer a Create button
 * that will fail.
 */
export function getDraftBlockingError(draft: RetentionPolicyDraft): string | null {
  for (const step of [0, 1, 2, 3] as WizardStep[]) {
    const error = getStepError(draft, step);

    if (error) {
      return error;
    }
  }

  return null;
}

export interface RetentionPolicyCreateInput {
  action: RetentionAction;
  anchor: 'created' | 'last_modified';
  contentTypes: string[];
  durationDays: number;
  name: string;
  scopeKind: RetentionScopeKind;
  scopeTargets: string[];
}

/** Converts a completed draft into what the API expects. */
export function toCreateInput(draft: RetentionPolicyDraft): RetentionPolicyCreateInput {
  return {
    action: draft.action,
    anchor: draft.anchor,
    contentTypes: draft.contentTypes,
    // A retain-only policy has no end, but the API still requires a number; the
    // backend ignores it for this action.
    durationDays: parseDurationDays(draft.durationDays) || 1,
    name: draft.name.trim(),
    scopeKind: draft.scopeKind,
    scopeTargets: draft.scopeKind === 'organization' ? [] : parseScopeTargets(draft.scopeTargetsText)
  };
}

/** A one-line summary of what the policy will do, for the review step. */
export function describeDraft(draft: RetentionPolicyDraft): string {
  const scope = draft.scopeKind === 'organization'
    ? 'every conversation in the organization'
    : `${parseScopeTargets(draft.scopeTargetsText).length} ${draft.scopeKind === 'user' ? 'people' : 'conversations'}`;

  if (draft.action === 'retain') {
    return `Keep ${scope} indefinitely. Nothing is ever deleted by this policy.`;
  }

  const days = parseDurationDays(draft.durationDays) || 0;
  const anchor = draft.anchor === 'created' ? 'created' : 'last changed';

  if (draft.action === 'delete') {
    return `Delete ${scope} ${days} days after being ${anchor}.`;
  }

  return `Keep ${scope} for ${days} days after being ${anchor}, then delete.`;
}
