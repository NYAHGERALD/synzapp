import { firestore } from '../config/firebaseAdmin.js';
import { resolveRetentionOutcome, type RetentionPolicy } from './retentionEvaluation.js';
import { listActiveLegalHolds } from './legalHoldService.js';
import { listEnforceableRetentionPolicies } from './retentionPolicyService.js';
import { policiesCoveringSubject, policyCoversSubject } from './retentionScope.js';

/**
 * Shows what a retention rule would do, before it is allowed to do anything.
 *
 * Deleting an organization's records cannot be undone, so an administrator
 * should never have to guess. This runs the same evaluation the nightly job
 * runs — same precedence, same legal holds — against a rule that has not been
 * switched on, and counts instead of acting.
 *
 * **The draft is judged alongside the rules already running.** A policy is not
 * evaluated alone: an existing longer retention can outrank a new deletion, so
 * a simulation that ignored the others would promise deletions that will never
 * happen. The result reports both the whole picture and what this rule adds on
 * its own, because the second is what the administrator is actually deciding.
 *
 * **Nothing is written.** No queue entry, no policy record, no state change.
 *
 * Scope note: chat compliance only. This does not touch the interpreter or any
 * other part of Synzapp.
 */

/** The same cap the evaluator uses, so a simulation matches what will happen. */
const MAX_CONVERSATIONS_SCANNED = 500;

export interface RetentionSimulationInput {
  action: RetentionPolicy['action'];
  durationDays: number;
  nowMs?: number;
  scopeKind: RetentionPolicy['scopeKind'];
  /** The people or conversations the draft names. Empty for whole-organization. */
  scopeTargets?: string[];
  tenantId: string;
}

export interface RetentionSimulationResult {
  /** Conversations looked at. */
  examined: number;
  /** Protected by a legal hold, whatever any policy says. */
  heldByLegalHold: number;
  /** Kept with no end date under the rules as they would stand. */
  keptIndefinitely: number;
  /** The date of the oldest conversation that would be deleted now. */
  oldestAffectedAtMs: number | null;
  /**
   * True when there are more conversations than one scan reads.
   *
   * Reported rather than hidden: a number presented as complete, when it is
   * not, is the kind of thing an administrator would rely on before deleting
   * records.
   */
  scanLimited: boolean;
  /** Conversations this rule alone brings forward for deletion. */
  newlyDueFromThisPolicy: number;
  /** Messages inside everything that would be deleted now. */
  messagesAffectedNow: number;
  /** Already past their keep-until date: would be queued on the next run. */
  wouldDeleteNow: number;
  /** Will pass their keep-until date at some point in the future. */
  wouldDeleteLater: number;
}

interface ConversationRecord {
  lastMessageAtMs?: number;
  messageCount?: number;
  participantIds?: string[];
  updatedAtMs?: number;
}

export async function simulateRetentionPolicy(
  input: RetentionSimulationInput
): Promise<RetentionSimulationResult> {
  const nowMs = input.nowMs ?? Date.now();
  const draft: RetentionPolicy = {
    action: input.action,
    durationDays: input.durationDays,
    id: 'draft',
    scopeKind: input.scopeKind
  };

  const [activePolicies, holds] = await Promise.all([
    listEnforceableRetentionPolicies(input.tenantId),
    listActiveLegalHolds(input.tenantId, nowMs)
  ]);

  const draftTargets = (input.scopeTargets || []).filter(Boolean);

  const organizationRef = firestore.collection('organizations').doc(input.tenantId);
  const [directChats, groups] = await Promise.all([
    organizationRef.collection('directChats').limit(MAX_CONVERSATIONS_SCANNED).get(),
    organizationRef.collection('groups').limit(MAX_CONVERSATIONS_SCANNED).get()
  ]);

  const conversations = [...directChats.docs, ...groups.docs];
  const result: RetentionSimulationResult = {
    examined: 0,
    heldByLegalHold: 0,
    keptIndefinitely: 0,
    messagesAffectedNow: 0,
    newlyDueFromThisPolicy: 0,
    oldestAffectedAtMs: null,
    scanLimited: directChats.size >= MAX_CONVERSATIONS_SCANNED
      || groups.size >= MAX_CONVERSATIONS_SCANNED,
    wouldDeleteLater: 0,
    wouldDeleteNow: 0
  };

  for (const doc of conversations) {
    const record = doc.data() as ConversationRecord;
    const createdAtMs = record.lastMessageAtMs || record.updatedAtMs || nowMs;

    result.examined += 1;

    const subject = {
      conversationId: doc.id,
      participantIds: Array.isArray(record.participantIds) ? record.participantIds : []
    };

    // Both the draft and the rules already running are filtered to what they
    // actually name, exactly as the nightly job now does.
    const existingCovering = policiesCoveringSubject(activePolicies, subject)
      .map((policy) => ({
        action: policy.action,
        durationDays: policy.durationDays,
        id: policy.id,
        scopeKind: policy.scopeKind
      }));
    const draftCovers = policyCoversSubject(
      { scopeKind: input.scopeKind, scopeTargets: draftTargets },
      subject
    );
    const existing = existingCovering;

    if (!draftCovers && !existing.length) {
      result.keptIndefinitely += 1;
      continue;
    }

    const withDraft = resolveRetentionOutcome({
      holds,
      nowMs,
      policies: draftCovers ? [...existing, draft] : existing,
      subject: { createdAtMs }
    });

    if (withDraft.isOnHold) {
      result.heldByLegalHold += 1;
      continue;
    }

    if (withDraft.purgeAfterMs === null) {
      result.keptIndefinitely += 1;
      continue;
    }

    if (withDraft.purgeAfterMs > nowMs) {
      result.wouldDeleteLater += 1;
      continue;
    }

    result.wouldDeleteNow += 1;
    result.messagesAffectedNow += Math.max(0, Math.round(record.messageCount || 0));

    if (result.oldestAffectedAtMs === null || createdAtMs < result.oldestAffectedAtMs) {
      result.oldestAffectedAtMs = createdAtMs;
    }

    // Whether this conversation is only due because of the draft. Without this
    // an administrator cannot tell what they are adding from what was already
    // going to happen anyway.
    const withoutDraft = existing.length
      ? resolveRetentionOutcome({ holds, nowMs, policies: existing, subject: { createdAtMs } })
      : null;

    const wasAlreadyDue = withoutDraft
      && withoutDraft.purgeAfterMs !== null
      && withoutDraft.purgeAfterMs <= nowMs;

    if (!wasAlreadyDue) {
      result.newlyDueFromThisPolicy += 1;
    }
  }

  return result;
}
