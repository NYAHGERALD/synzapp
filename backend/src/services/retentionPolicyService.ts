import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import type { RetentionAction, RetentionScopeKind } from './retentionEvaluation.js';

/**
 * Tenant retention policies, following the Microsoft Purview model.
 *
 * Two rules from Purview are adopted rather than invented, because an auditor
 * recognises them and any departure would have to be defended:
 *
 * **A policy is never mutated in place.** Editing writes a new version and
 * leaves the old one intact. Reconstructing why an item was deleted eighteen
 * months ago requires the policy as it stood then, and an in-place edit destroys
 * exactly the evidence a disposal has to be defended with.
 *
 * **A policy starts in simulation.** It computes what it would do and deletes
 * nothing. Activation is a separate, deliberate act. A retention policy is the
 * one control in the product that destroys data on a timer, and the cost of
 * getting a scope wrong is unrecoverable.
 */

export type RetentionPolicyState = 'ACTIVE' | 'DISABLED' | 'SIMULATION';
export type RetentionAnchor = 'created' | 'last_modified';

export interface RetentionPolicyRecord {
  action: RetentionAction;
  anchor: RetentionAnchor;
  contentTypes: string[];
  createdAtMs: number;
  createdByUid: string;
  durationDays: number;
  id: string;
  name: string;
  /** Set when a newer version supersedes this one. */
  supersededAtMs: number | null;
  policyKey: string;
  scopeKind: RetentionScopeKind;
  /** Empty for an organization scope; the named users or conversations otherwise. */
  scopeTargets: string[];
  state: RetentionPolicyState;
  tenantId: string;
  version: number;
}

export interface SaveRetentionPolicyInput {
  action: RetentionAction;
  anchor?: RetentionAnchor;
  contentTypes?: string[];
  durationDays: number;
  name: string;
  /** Omitted for a new policy; supplied to write a new version of an existing one. */
  policyKey?: string;
  scopeKind: RetentionScopeKind;
  scopeTargets?: string[];
}

const MAX_DURATION_DAYS = 365 * 100;
const MAX_SCOPE_TARGETS = 500;

function policiesRef(tenantId: string) {
  return firestore.collection('tenants').doc(tenantId).collection('retentionPolicies');
}

export function validateRetentionPolicyInput(input: SaveRetentionPolicyInput): string | null {
  if (!input.name.trim()) {
    return 'A retention policy needs a name.';
  }

  if (!Number.isFinite(input.durationDays) || input.durationDays < 1) {
    return 'Retention duration must be at least one day.';
  }

  if (input.durationDays > MAX_DURATION_DAYS) {
    return 'Retention duration is longer than this product supports.';
  }

  // An org-wide scope is the one that can reach every conversation in the
  // tenant, so it must be chosen explicitly rather than fallen into by leaving
  // the target list empty.
  if (input.scopeKind !== 'organization' && !(input.scopeTargets || []).length) {
    return 'A user or conversation scope needs at least one target.';
  }

  if ((input.scopeTargets || []).length > MAX_SCOPE_TARGETS) {
    return 'Too many scope targets for a single policy.';
  }

  return null;
}

/**
 * Writes a new policy, or a new version of an existing one.
 *
 * Every write lands in simulation. Nothing this function produces can delete
 * anything until it is activated separately.
 */
export async function saveRetentionPolicy(input: {
  actorUid: string;
  policy: SaveRetentionPolicyInput;
  tenantId: string;
}): Promise<RetentionPolicyRecord> {
  const validationError = validateRetentionPolicyInput(input.policy);

  if (validationError) {
    throw new Error(validationError);
  }

  const collection = policiesRef(input.tenantId);
  const policyKey = input.policy.policyKey || collection.doc().id;
  const nowMs = Date.now();

  const previousVersions = await collection
    .where('policyKey', '==', policyKey)
    .where('supersededAtMs', '==', null)
    .get();

  const version = previousVersions.size
    ? Math.max(...previousVersions.docs.map((doc) => (doc.data().version as number) || 0)) + 1
    : 1;

  const record: RetentionPolicyRecord = {
    action: input.policy.action,
    anchor: input.policy.anchor || 'created',
    contentTypes: input.policy.contentTypes || [],
    createdAtMs: nowMs,
    createdByUid: input.actorUid,
    durationDays: Math.round(input.policy.durationDays),
    id: `${policyKey}_v${version}`,
    name: input.policy.name.trim(),
    policyKey,
    scopeKind: input.policy.scopeKind,
    scopeTargets: input.policy.scopeTargets || [],
    // Never active on write. Activation is a separate, deliberate act.
    state: 'SIMULATION',
    supersededAtMs: null,
    tenantId: input.tenantId,
    version
  };

  const batch = firestore.batch();

  // The previous version is superseded rather than deleted, so an audit can
  // reconstruct the rules that applied at any past moment.
  previousVersions.docs.forEach((doc) => {
    batch.set(doc.ref, { supersededAtMs: nowMs, updatedAt: fieldValue.serverTimestamp() }, { merge: true });
  });

  batch.set(collection.doc(record.id), { ...record, updatedAt: fieldValue.serverTimestamp() });

  await batch.commit();

  return record;
}

/**
 * Moves a policy out of simulation.
 *
 * Separated from saving so that activation is auditable on its own, and so the
 * console can require the operator to type the policy's name first.
 */
export async function setRetentionPolicyState(input: {
  policyId: string;
  state: RetentionPolicyState;
  tenantId: string;
}): Promise<void> {
  await policiesRef(input.tenantId).doc(input.policyId).set({
    state: input.state,
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });
}

/** The current version of every policy, superseded ones excluded. */
export async function listRetentionPolicies(tenantId: string): Promise<RetentionPolicyRecord[]> {
  const snapshot = await policiesRef(tenantId).where('supersededAtMs', '==', null).get();

  return snapshot.docs
    .map((doc) => doc.data() as RetentionPolicyRecord)
    .sort((first, second) => second.createdAtMs - first.createdAtMs);
}

/**
 * The policies that actually govern disposal.
 *
 * Simulation and disabled policies are excluded here rather than at the call
 * site: a simulated policy reaching the disposer would delete data the operator
 * was explicitly told was only being modelled.
 */
export async function listEnforceableRetentionPolicies(
  tenantId: string
): Promise<RetentionPolicyRecord[]> {
  const policies = await listRetentionPolicies(tenantId);

  return policies.filter((policy) => policy.state === 'ACTIVE');
}
