import type { ConversationRetentionExplanation } from './complianceApi';

/**
 * Turning a retention outcome into the sentence an administrator would say.
 *
 * The answer comes first and in full: kept, deleted on a date, or frozen. A
 * page that made somebody assemble the answer from a table of rules would not
 * be usable in the moment it is needed — usually while somebody is waiting for
 * a reply about a specific message.
 */

export function describeOutcome(
  explanation: ConversationRetentionExplanation,
  nowMs: number
): { detail: string; headline: string; tone: 'danger' | 'neutral' | 'safe' } {
  if (explanation.isOnHold) {
    return {
      detail: explanation.blockingHoldCaseId
        ? `Frozen by case ${explanation.blockingHoldCaseId}. Nothing can delete it, including an admin.`
        : 'Frozen by a legal hold. Nothing can delete it, including an admin.',
      headline: 'Kept, frozen for a legal case',
      tone: 'safe'
    };
  }

  if (explanation.purgeAfterMs === null) {
    return {
      detail: explanation.governingPolicyName
        ? `Kept by the rule "${explanation.governingPolicyName}", with no end date.`
        : 'No rule sets an end date for this chat, so it is kept.',
      headline: 'Kept, no deletion date',
      tone: 'neutral'
    };
  }

  const due = new Date(explanation.purgeAfterMs).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  if (explanation.purgeAfterMs <= nowMs) {
    return {
      detail: explanation.governingPolicyName
        ? `Due since ${due} under the rule "${explanation.governingPolicyName}". It goes to Disposition review before anything is deleted.`
        : `Due since ${due}. It goes to Disposition review before anything is deleted.`,
      headline: 'Due for deletion',
      tone: 'danger'
    };
  }

  return {
    detail: explanation.governingPolicyName
      ? `Kept until ${due} by the rule "${explanation.governingPolicyName}".`
      : `Kept until ${due}.`,
    headline: `Kept until ${due}`,
    tone: 'neutral'
  };
}

/** A chat named by who is in it, rather than by its reference. */
export function describeConversation(explanation: ConversationRetentionExplanation): string {
  const names = explanation.participantNames.filter(Boolean);

  if (!names.length) {
    return explanation.conversationKind === 'GROUP' ? 'Group chat' : 'Direct chat';
  }

  if (explanation.conversationKind === 'GROUP') {
    return names.length > 3
      ? `Group: ${names.slice(0, 3).join(', ')} and ${names.length - 3} more`
      : `Group: ${names.join(', ')}`;
  }

  return names.join(' and ');
}

/** Rules split into the ones that reached this chat and the ones that did not. */
export function splitRules(explanation: ConversationRetentionExplanation) {
  return {
    applied: explanation.rulesConsidered.filter((rule) => rule.applies),
    notApplied: explanation.rulesConsidered.filter((rule) => !rule.applies)
  };
}
