/**
 * Deciding whether a retention rule covers a particular conversation.
 *
 * This exists because it was missing. A policy's chosen people and chats were
 * saved with it and then never consulted: every policy was judged as though it
 * covered the whole organization. A rule written to delete three colleagues'
 * chats after ninety days would have deleted **everyone's**.
 *
 * Nothing had caught it because the wizard, the stored record and the console
 * all showed the narrow scope correctly. Only the code that decides what to
 * delete ignored it.
 *
 * Scope note: chat compliance only. This does not touch the interpreter or any
 * other part of Synzapp.
 */

export interface RetentionScopeSubject {
  conversationId: string;
  /** Everyone in the conversation, whether or not they have posted. */
  participantIds: string[];
}

export interface RetentionScopeDefinition {
  scopeKind: 'conversation' | 'organization' | 'user';
  scopeTargets: string[];
}

export function policyCoversSubject(
  policy: RetentionScopeDefinition,
  subject: RetentionScopeSubject
): boolean {
  if (policy.scopeKind === 'organization') {
    return true;
  }

  const targets = policy.scopeTargets.filter(Boolean);

  // A narrow policy with nothing named covers nothing. Treating it as covering
  // everything would turn an unfinished rule into an organization-wide
  // deletion, which is the worst possible reading of an empty list.
  if (!targets.length) {
    return false;
  }

  if (policy.scopeKind === 'conversation') {
    return targets.includes(subject.conversationId);
  }

  // A conversation belongs to each of its participants, so naming one person
  // covers the conversations they are part of — including what others sent in
  // them, which is what "this person's records" means.
  return subject.participantIds.some((participantId) => targets.includes(participantId));
}

/** Only the policies that actually reach this conversation. */
export function policiesCoveringSubject<T extends RetentionScopeDefinition>(
  policies: T[],
  subject: RetentionScopeSubject
): T[] {
  return policies.filter((policy) => policyCoversSubject(policy, subject));
}
