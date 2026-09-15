import { FieldPath } from 'firebase-admin/firestore';
import { firestore } from '../config/firebaseAdmin.js';
import {
  didCompleteFullScan,
  nextScanCursor,
  readScanCursor,
  type RetentionScanCursor
} from './retentionScanCursor.js';
import { listEnforceableRetentionPolicies } from './retentionPolicyService.js';
import { listActiveLegalHolds } from './legalHoldService.js';
import { enqueueDispositionItem, listDispositionQueue } from './dispositionService.js';
import { policiesCoveringSubject } from './retentionScope.js';
import { resolveRetentionOutcome, type RetentionPolicy } from './retentionEvaluation.js';

/**
 * Works out what has reached the end of its retention, and queues it for review.
 *
 * This is the piece that connects a policy to an actual consequence. Without it
 * a policy is a row in a table: the console shows it, the rules resolve
 * correctly, and nothing ever appears for anyone to approve.
 *
 * Nothing here deletes. It computes obligations, finds conversations whose
 * obligations have expired, and puts them in the queue — where a named
 * administrator decides, having verified their phone. Destruction stays a
 * separate step behind a human.
 *
 * Only activated policies are considered. A policy in simulation must be able to
 * be modelled without producing something an administrator can approve.
 */

export interface RetentionEvaluationSummary {
  /** Conversations already queued, so a re-run does not duplicate them. */
  alreadyQueued: number;
  /**
   * Whether this pass reached the end of the tenant rather than a page of it.
   *
   * The only honest way to say a retention policy has been applied to all of a
   * tenant, and the question an auditor asks.
   */
  completedFullScan?: boolean;
  /** Conversations examined. */
  examined: number;
  /** Conversations with no expired obligation. */
  retained: number;
  /** Conversations newly added to the review queue. */
  queued: number;
  /** Conversations that would have expired but are under a hold. */
  withheld: number;
}

interface ConversationRecord {
  participantIds?: string[];
  contactId?: string;
  lastMessageAtMs?: number | null;
  messageCount?: number | null;
  title?: string | null;
  updatedAtMs?: number | null;
}

const MAX_CONVERSATIONS_PER_RUN = 500;

/**
 * Runs one evaluation pass over a tenant.
 *
 * Bounded per run rather than walking everything: this is called from a
 * scheduled job and from the console, and an unbounded scan of a large tenant
 * would time out and leave the queue half-built with no record of where it
 * stopped.
 */
export async function evaluateTenantRetention(input: {
  nowMs?: number;
  tenantId: string;
}): Promise<RetentionEvaluationSummary> {
  const nowMs = input.nowMs || Date.now();
  const summary: RetentionEvaluationSummary = {
    alreadyQueued: 0,
    examined: 0,
    queued: 0,
    retained: 0,
    withheld: 0
  };

  const [policies, holds, existingQueue] = await Promise.all([
    listEnforceableRetentionPolicies(input.tenantId),
    listActiveLegalHolds(input.tenantId, nowMs),
    listDispositionQueue(input.tenantId)
  ]);

  // With no active policy nothing has an expiry, so there is nothing to queue.
  // Returning early keeps a tenant that has not configured retention from
  // paying for a scan on every scheduled run.
  if (!policies.length) {
    return summary;
  }

  const queuedSubjects = new Set(existingQueue
    .filter((item) => item.state !== 'PURGED')
    .map((item) => item.subjectRef));

  // Direct chats and groups both. Only direct chats were examined before, so
  // an organization's group conversations were never queued, never expired and
  // never deleted — kept for ever no matter what its retention policy said.
  const organizationRef = firestore.collection('organizations').doc(input.tenantId);

  /**
   * Resume where the last pass stopped.
   *
   * These queries had no ordering and no cursor, so Firestore returned the same
   * first five hundred documents by name every night. A tenant with more than
   * that had a permanent tail that was never examined, never queued and never
   * deleted — and nothing showed it, because the run reported five hundred
   * examined and looked healthy.
   */
  const organizationSnapshot = await organizationRef.get();
  const storedCursor = organizationSnapshot.exists
    ? (organizationSnapshot.data() || {}).retentionScanCursor
    : null;
  const directChatsCursor = readScanCursor(storedCursor, 'directChats');
  const groupsCursor = readScanCursor(storedCursor, 'groups');

  const [directChats, groups] = await Promise.all([
    readConversationPage(organizationRef.collection('directChats'), directChatsCursor),
    readConversationPage(organizationRef.collection('groups'), groupsCursor)
  ]);

  const nextCursor: RetentionScanCursor = {
    directChats: nextScanCursor({
      lastDocumentName: directChats.docs[directChats.docs.length - 1]?.id || null,
      pageSize: MAX_CONVERSATIONS_PER_RUN,
      returned: directChats.docs.length
    }),
    groups: nextScanCursor({
      lastDocumentName: groups.docs[groups.docs.length - 1]?.id || null,
      pageSize: MAX_CONVERSATIONS_PER_RUN,
      returned: groups.docs.length
    })
  };

  const conversations = {
    docs: [
      ...directChats.docs.map((doc) => ({ doc, subjectPrefix: 'directChat' })),
      ...groups.docs.map((doc) => ({ doc, subjectPrefix: 'group' }))
    ]
  };

  for (const { doc, subjectPrefix } of conversations.docs) {
    const record = doc.data() as ConversationRecord;
    const subjectRef = `${subjectPrefix}/${doc.id}`;

    summary.examined += 1;

    if (queuedSubjects.has(subjectRef)) {
      summary.alreadyQueued += 1;
      continue;
    }

    const createdAtMs = record.lastMessageAtMs || record.updatedAtMs || nowMs;

    // Only the policies that actually name this conversation or someone in it.
    // Every policy used to be applied to every conversation, so a rule written
    // for a few colleagues would have deleted the whole organization's chats.
    const covering = policiesCoveringSubject(policies, {
      conversationId: doc.id,
      participantIds: Array.isArray(record.participantIds) ? record.participantIds : []
    });

    if (!covering.length) {
      summary.retained += 1;
      continue;
    }

    const outcome = resolveRetentionOutcome({
      holds,
      nowMs,
      policies: covering.map(toEvaluatorPolicy),
      subject: { createdAtMs }
    });

    if (outcome.isOnHold) {
      summary.withheld += 1;
      continue;
    }

    // Null means keep indefinitely; a future date means it has not expired.
    if (outcome.purgeAfterMs === null || outcome.purgeAfterMs > nowMs) {
      summary.retained += 1;
      continue;
    }

    await enqueueDispositionItem({
      eligibleAtMs: outcome.purgeAfterMs,
      itemCount: Math.max(0, Math.round(record.messageCount || 0)),
      label: record.title || doc.id,
      subjectRef,
      tenantId: input.tenantId
    });

    summary.queued += 1;
  }

  /**
   * Written after the pass, not before it.
   *
   * If the run fails part way through, the cursor stays where it was and the
   * same conversations are examined again tomorrow. Re-examining costs a little;
   * skipping past them because the cursor moved on a run that did not finish
   * would leave a gap nobody could see.
   */
  await organizationRef.set({ retentionScanCursor: nextCursor }, { merge: true });

  summary.completedFullScan = didCompleteFullScan(nextCursor);

  return summary;
}

function toEvaluatorPolicy(policy: {
  action: RetentionPolicy['action'];
  durationDays: number;
  id: string;
  scopeKind: RetentionPolicy['scopeKind'];
}): RetentionPolicy {
  return {
    action: policy.action,
    durationDays: policy.durationDays,
    id: policy.id,
    scopeKind: policy.scopeKind
  };
}


/**
 * One page of conversations, ordered by document name so a cursor means
 * something. Firestore's default order is already by name, but relying on a
 * default for correctness is how the cursor was left out in the first place.
 */
async function readConversationPage(
  collection: FirebaseFirestore.CollectionReference,
  cursor: string | null
): Promise<FirebaseFirestore.QuerySnapshot> {
  const ordered = collection.orderBy(FieldPath.documentId()).limit(MAX_CONVERSATIONS_PER_RUN);

  return cursor ? ordered.startAfter(cursor).get() : ordered.get();
}
