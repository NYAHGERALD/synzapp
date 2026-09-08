import { fieldValue, firestore } from '../config/firebaseAdmin.js';

/**
 * Privacy and terms, stored as versions rather than compiled into the website.
 *
 * A policy in source code fails three things an enterprise buyer checks. There
 * is no history to compare against last year's before they renew. There is no
 * record of who changed a sentence or when, so "when did you begin sending
 * meeting audio to a third party, and who approved that wording?" has no
 * answer. And a solicitor cannot edit source, so their wording is retyped by an
 * engineer — which is how a policy drifts from what the software actually does.
 *
 * **A published version is never modified again.** Publishing writes a new
 * version and moves a pointer. A policy that can be edited after publication is
 * not evidence of anything, and the whole reason to keep versions is to be able
 * to prove what was in force on a given day.
 *
 * Scope note: Synzapp's own published documents. Nothing here reads customer
 * data.
 */

export type PolicySlug = 'privacy' | 'terms';

export interface PolicyVersion {
  body: string;
  effectiveFromMs: number;
  publishedAtMs: number | null;
  publishedByEmail: string | null;
  slug: PolicySlug;
  state: 'DRAFT' | 'PUBLISHED';
  summary: string;
  title: string;
  version: number;
}

function versionsRef(slug: PolicySlug) {
  return firestore.collection('synzappPolicies').doc(slug).collection('versions');
}

function pointerRef(slug: PolicySlug) {
  return firestore.collection('synzappPolicies').doc(slug);
}

export function isPolicySlug(value: string): value is PolicySlug {
  return value === 'privacy' || value === 'terms';
}

/**
 * The version the public site shows.
 *
 * Read at request time, so a wording change is a save rather than a deploy.
 * Returns null when nothing has been published yet, and the caller decides what
 * to show — inventing a placeholder policy would be worse than showing none.
 */
export async function getPublishedPolicy(slug: PolicySlug): Promise<PolicyVersion | null> {
  const pointer = await pointerRef(slug).get();

  if (!pointer.exists) {
    return null;
  }

  const publishedVersion = (pointer.data() as { publishedVersion?: number }).publishedVersion;

  if (!publishedVersion) {
    return null;
  }

  const snapshot = await versionsRef(slug).doc(String(publishedVersion)).get();

  return snapshot.exists ? (snapshot.data() as PolicyVersion) : null;
}

/** Every version, newest first. What a buyer asks to see. */
export async function listPolicyVersions(slug: PolicySlug): Promise<PolicyVersion[]> {
  const snapshot = await versionsRef(slug).orderBy('version', 'desc').limit(100).get();

  return snapshot.docs.map((doc) => doc.data() as PolicyVersion);
}

export async function getPolicyVersion(
  slug: PolicySlug,
  version: number
): Promise<PolicyVersion | null> {
  const snapshot = await versionsRef(slug).doc(String(version)).get();

  return snapshot.exists ? (snapshot.data() as PolicyVersion) : null;
}

/**
 * The draft being worked on, if there is one. Only one exists at a time.
 *
 * Filtered here rather than in the query. Combining a filter with a sort needs
 * a composite index built ahead of time, which is a separate deployment step
 * that can be forgotten — and when it is, this fails at runtime in whatever
 * environment nobody remembered. A policy has a handful of versions, so
 * reading them and picking the draft costs nothing and always works.
 */
export async function getPolicyDraft(slug: PolicySlug): Promise<PolicyVersion | null> {
  const versions = await listPolicyVersions(slug);

  return versions.find((version) => version.state === 'DRAFT') || null;
}

export function validatePolicyInput(input: {
  body: string;
  summary: string;
  title: string;
}): string | null {
  if (!input.title.trim()) {
    return 'Give this policy a title.';
  }

  if (input.body.trim().length < 50) {
    return 'A policy needs more than a sentence.';
  }

  // The summary is what appears in the version list months later. Without it,
  // a history of twenty versions is unusable.
  if (!input.summary.trim()) {
    return 'Say what changed in this version.';
  }

  return null;
}

/**
 * Saves the draft, creating one if there is none.
 *
 * A draft is edited in place; only publishing creates a permanent record. That
 * keeps the history free of every intermediate save while somebody works.
 */
export async function savePolicyDraft(input: {
  body: string;
  slug: PolicySlug;
  summary: string;
  title: string;
}): Promise<PolicyVersion> {
  const existingDraft = await getPolicyDraft(input.slug);
  const version = existingDraft?.version ?? (await nextVersionNumber(input.slug));

  const draft: PolicyVersion = {
    body: input.body,
    effectiveFromMs: 0,
    publishedAtMs: null,
    publishedByEmail: null,
    slug: input.slug,
    state: 'DRAFT',
    summary: input.summary.trim().slice(0, 500),
    title: input.title.trim().slice(0, 200),
    version
  };

  await versionsRef(input.slug).doc(String(version)).set({
    ...draft,
    updatedAt: fieldValue.serverTimestamp()
  });

  return draft;
}

/**
 * Publishes the current draft.
 *
 * Done in a transaction so that the version being marked published and the
 * pointer that the public site reads cannot disagree — a half-applied publish
 * would either show the old policy while claiming the new one, or the reverse.
 */
export async function publishPolicyDraft(input: {
  publishedByEmail: string;
  slug: PolicySlug;
}): Promise<PolicyVersion> {
  const draft = await getPolicyDraft(input.slug);

  if (!draft) {
    throw new Error('There is no draft to publish.');
  }

  const publishedAtMs = Date.now();
  const published: PolicyVersion = {
    ...draft,
    effectiveFromMs: publishedAtMs,
    publishedAtMs,
    publishedByEmail: input.publishedByEmail,
    state: 'PUBLISHED'
  };

  await firestore.runTransaction(async (transaction) => {
    transaction.set(versionsRef(input.slug).doc(String(draft.version)), {
      ...published,
      updatedAt: fieldValue.serverTimestamp()
    });

    transaction.set(pointerRef(input.slug), {
      publishedVersion: draft.version,
      slug: input.slug,
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });
  });

  return published;
}

async function nextVersionNumber(slug: PolicySlug): Promise<number> {
  const snapshot = await versionsRef(slug).orderBy('version', 'desc').limit(1).get();

  if (snapshot.empty) {
    return 1;
  }

  return ((snapshot.docs[0].data() as PolicyVersion).version || 0) + 1;
}
