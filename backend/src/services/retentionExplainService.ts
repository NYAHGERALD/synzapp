import { firestore } from '../config/firebaseAdmin.js';
import { resolveRetentionOutcome } from './retentionEvaluation.js';
import { listActiveLegalHolds, listLegalHolds } from './legalHoldService.js';
import { listRetentionPolicies } from './retentionPolicyService.js';
import { policyCoversSubject } from './retentionScope.js';
import { listCompliancePeople } from './complianceDirectoryService.js';

/**
 * Why a particular conversation is being kept or deleted.
 *
 * The screen this feeds used to list the precedence rules in the abstract and
 * say that looking up one conversation was "still being built". It was not: the
 * engine has always returned a step-by-step explanation and the id of the rule
 * that decided the outcome, and nothing read them.
 *
 * This is the answer an administrator has to give when somebody asks why a
 * message survived, or why it did not — and the one an auditor asks for. Being
 * able to show the reasoning for a specific conversation is what separates a
 * retention setting from a defensible record system.
 *
 * Scope note: chat compliance only. This does not touch the interpreter or any
 * other part of Synzapp.
 */

const MAX_CONVERSATIONS_EXPLAINED = 50;

export interface ConversationRetentionExplanation {
  conversationId: string;
  conversationKind: 'DIRECT' | 'GROUP';
  /** The hold suspending deletion, when one is. */
  blockingHoldCaseId: string | null;
  /** The rule that decided the outcome, by name. */
  governingPolicyName: string | null;
  isOnHold: boolean;
  lastMessageAtMs: number;
  participantNames: string[];
  /** When it may be deleted; null means it is kept with no end date. */
  purgeAfterMs: number | null;
  /** Every rule considered, and whether it reached this conversation. */
  rulesConsidered: {
    applies: boolean;
    name: string;
    reason: string;
    state: string;
  }[];
  /** The engine's own reasoning, in the order it was applied. */
  steps: string[];
}

export async function explainConversationRetention(input: {
  conversationIds?: string[];
  custodianUid?: string | null;
  nowMs?: number;
  tenantId: string;
}): Promise<ConversationRetentionExplanation[]> {
  const nowMs = input.nowMs ?? Date.now();
  const [allPolicies, activeHolds, everyHold, people] = await Promise.all([
    listRetentionPolicies(input.tenantId),
    listActiveLegalHolds(input.tenantId, nowMs),
    listLegalHolds(input.tenantId),
    listCompliancePeople(input.tenantId).catch(() => [])
  ]);

  const nameByUid = new Map(people.map((person) => [person.uid, person.displayName]));
  const caseIdByHoldId = new Map(everyHold.map((hold) => [hold.id, hold.caseId]));
  const activePolicies = allPolicies.filter((policy) => policy.state === 'ACTIVE');

  const organizationRef = firestore.collection('organizations').doc(input.tenantId);
  const [directChats, groups] = await Promise.all([
    organizationRef.collection('directChats').limit(MAX_CONVERSATIONS_EXPLAINED).get(),
    organizationRef.collection('groups').limit(MAX_CONVERSATIONS_EXPLAINED).get()
  ]);

  const conversations = [
    ...directChats.docs.map((doc) => ({ doc, kind: 'DIRECT' as const })),
    ...groups.docs.map((doc) => ({ doc, kind: 'GROUP' as const }))
  ];

  const wanted = new Set((input.conversationIds || []).filter(Boolean));
  const explanations: ConversationRetentionExplanation[] = [];

  for (const { doc, kind } of conversations) {
    const record = doc.data() as { lastMessageAtMs?: number; participantIds?: string[] };
    const participantIds = Array.isArray(record.participantIds) ? record.participantIds : [];

    if (wanted.size && !wanted.has(doc.id)) {
      continue;
    }

    if (input.custodianUid && !participantIds.includes(input.custodianUid)) {
      continue;
    }

    const createdAtMs = record.lastMessageAtMs || nowMs;
    const subject = { conversationId: doc.id, participantIds };
    const covering = activePolicies.filter((policy) => policyCoversSubject(policy, subject));

    const outcome = resolveRetentionOutcome({
      holds: activeHolds,
      nowMs,
      policies: covering.map((policy) => ({
        action: policy.action,
        durationDays: policy.durationDays,
        id: policy.id,
        scopeKind: policy.scopeKind
      })),
      subject: { createdAtMs }
    });

    explanations.push({
      blockingHoldCaseId: outcome.blockingHoldId
        ? caseIdByHoldId.get(outcome.blockingHoldId) || outcome.blockingHoldId
        : null,
      conversationId: doc.id,
      conversationKind: kind,
      governingPolicyName: outcome.governingPolicyId
        ? allPolicies.find((policy) => policy.id === outcome.governingPolicyId)?.name || null
        : null,
      isOnHold: outcome.isOnHold,
      lastMessageAtMs: createdAtMs,
      participantNames: participantIds.map((uid) => nameByUid.get(uid) || uid),
      purgeAfterMs: outcome.purgeAfterMs,
      // Every rule, not only the ones that applied. "Why did this rule not
      // affect it?" is asked as often as "why did it?", and a list showing only
      // matches cannot answer the first.
      rulesConsidered: allPolicies.map((policy) => ({
        applies: policy.state === 'ACTIVE' && policyCoversSubject(policy, subject),
        name: policy.name,
        reason: describeWhy(policy, subject),
        state: policy.state
      })),
      steps: outcome.explanation
    });
  }

  return explanations;
}

function describeWhy(
  policy: { scopeKind: string; scopeTargets: string[]; state: string },
  subject: { conversationId: string; participantIds: string[] }
): string {
  if (policy.state !== 'ACTIVE') {
    return policy.state === 'SIMULATION'
      ? 'Not switched on, so it changes nothing.'
      : 'Switched off.';
  }

  if (policy.scopeKind === 'organization') {
    return 'Covers every chat in the company.';
  }

  const targets = policy.scopeTargets.filter(Boolean);

  if (!targets.length) {
    return 'Names nobody, so it covers nothing.';
  }

  if (policy.scopeKind === 'conversation') {
    return targets.includes(subject.conversationId)
      ? 'This chat is named in the rule.'
      : 'This chat is not named in the rule.';
  }

  return subject.participantIds.some((uid) => targets.includes(uid))
    ? 'Someone in this chat is named in the rule.'
    : 'Nobody in this chat is named in the rule.';
}
