import { fieldValue, firestore } from '../config/firebaseAdmin.js';

/**
 * Messages sent to Synzapp from the public site and from inside a customer's
 * console.
 *
 * **Write-only from the outside.** Nothing here can be read back by whoever
 * sent it, and no route returns a list. A public form that can also read its
 * own collection becomes a way to harvest everyone else's enquiries, and that
 * mistake is only obvious after it has happened.
 *
 * Two sources, kept apart on purpose:
 *
 * - A public enquiry is from a stranger. It carries whatever they typed and
 *   nothing else, because nothing else can be trusted.
 * - A support request comes from inside a signed-in console, so the
 *   organization and the person are taken from their session rather than from
 *   the form. Somebody cannot raise a request as another company.
 *
 * Scope note: this is Synzapp's own operations surface. It does not read or
 * touch any customer's chat, interpreter or compliance data.
 */

export type ContactKind = 'PUBLIC_ENQUIRY' | 'SUPPORT_REQUEST';

export interface ContactAddress {
  city: string;
  countryCode: string;
  line1: string;
  line2: string;
  postalCode: string;
  region: string;
}

export interface ContactSubmission {
  /** Null when the sender chose not to give one. */
  address: ContactAddress | null;
  phone: string | null;
  createdAtMs: number;
  email: string;
  id: string;
  kind: ContactKind;
  message: string;
  name: string;
  organizationName: string | null;
  /** Only set for a support request, and taken from the session, never the form. */
  tenantId: string | null;
  /** Only set for a support request. */
  submittedByUid: string | null;
  state: 'NEW' | 'ACKNOWLEDGED' | 'CLOSED';
  subject: string;
}

/**
 * Give every row the shape the rest of the code expects.
 *
 * Submissions saved before the address fields existed have no `address` or
 * `phone` key at all. Casting the raw document to the type would promise `null`
 * and hand back `undefined`, which then breaks whatever reads it — quietly, and
 * far away from here.
 */
function normalizeSubmission(raw: Record<string, unknown>): ContactSubmission {
  const address = raw.address as Partial<ContactAddress> | null | undefined;

  return {
    ...(raw as unknown as ContactSubmission),
    address: address
      ? {
          city: address.city || '',
          countryCode: address.countryCode || '',
          line1: address.line1 || '',
          line2: address.line2 || '',
          postalCode: address.postalCode || '',
          region: address.region || ''
        }
      : null,
    phone: (raw.phone as string | null | undefined) || null
  };
}

function contactRef() {
  return firestore.collection('synzappContactSubmissions');
}

export function validateContactInput(input: {
  email: string;
  message: string;
  name: string;
  subject: string;
}): string | null {
  if (!input.name.trim()) {
    return 'Please tell us your name.';
  }

  // Deliberately loose. A stricter pattern rejects real addresses, and the cost
  // of a wrong rejection here is an enquiry that never reaches anybody.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return 'Please enter an email address we can reply to.';
  }

  if (input.subject.trim().length < 3) {
    return 'Please give your message a subject.';
  }

  // No minimum length beyond "not empty". A ten-character rule rejected
  // "how far" — a real question from a real person — and only said so after
  // they pressed send. Somebody with a short question is still a customer, and
  // a form that argues with them is worse than one that occasionally receives
  // something brief.
  if (!input.message.trim()) {
    return 'Please write your message.';
  }

  return null;
}

export async function recordContactSubmission(input: {
  address?: Partial<ContactAddress> | null;
  phone?: string | null;
  email: string;
  kind: ContactKind;
  message: string;
  name: string;
  organizationName?: string | null;
  submittedByUid?: string | null;
  subject: string;
  tenantId?: string | null;
}): Promise<{ id: string }> {
  const ref = contactRef().doc();

  await ref.set({
    // Stored as given, bounded. Normalising an address here would risk
    // "correcting" one that was right in a country we did not anticipate.
    address: input.address
      ? {
          city: (input.address.city || '').trim().slice(0, 120),
          countryCode: (input.address.countryCode || '').trim().slice(0, 2),
          line1: (input.address.line1 || '').trim().slice(0, 200),
          line2: (input.address.line2 || '').trim().slice(0, 200),
          postalCode: (input.address.postalCode || '').trim().slice(0, 20),
          region: (input.address.region || '').trim().slice(0, 120)
        }
      : null,
    phone: (input.phone || '').trim().slice(0, 40) || null,
    createdAt: fieldValue.serverTimestamp(),
    createdAtMs: Date.now(),
    email: input.email.trim().slice(0, 320),
    id: ref.id,
    kind: input.kind,
    // Bounded before storage. An unbounded field on a public form is a way to
    // run up someone else's storage bill.
    message: input.message.trim().slice(0, 5000),
    name: input.name.trim().slice(0, 200),
    organizationName: (input.organizationName || '').trim().slice(0, 200) || null,
    state: 'NEW',
    subject: input.subject.trim().slice(0, 200),
    submittedByUid: input.submittedByUid || null,
    tenantId: input.tenantId || null
  });

  return { id: ref.id };
}

/**
 * The support requests one organization has raised.
 *
 * Scoped to the caller's own organization. This is the only read in this file,
 * and it exists so a customer can see what they have already asked — never to
 * see anyone else's.
 */
export async function listSupportRequestsForTenant(
  tenantId: string
): Promise<ContactSubmission[]> {
  // Equality filters only, sorted after reading — same reason as above.
  const snapshot = await contactRef()
    .where('tenantId', '==', tenantId)
    .limit(200)
    .get();

  return snapshot.docs
    .map((doc) => normalizeSubmission(doc.data()))
    .filter((row) => row.kind === 'SUPPORT_REQUEST')
    .sort((left, right) => right.createdAtMs - left.createdAtMs)
    .slice(0, 50);
}

/**
 * The support inbox, for Synzapp staff.
 *
 * Shows that an organization asked something and what they typed. It does not
 * reach a single message, attachment or meeting — support is answered about a
 * customer, never from inside one.
 */
export async function listContactSubmissionsForStaff(input: {
  kind?: ContactKind;
  state?: ContactSubmission['state'];
}): Promise<ContactSubmission[]> {
  // Sorted in the query, filtered here. Combining a filter with a sort needs a
  // composite index built ahead of time — a separate deployment step that,
  // when forgotten, fails at runtime in whatever environment nobody prepared.
  const snapshot = await contactRef().orderBy('createdAtMs', 'desc').limit(200).get();

  return snapshot.docs
    .map((doc) => normalizeSubmission(doc.data()))
    .filter((row) => (input.kind ? row.kind === input.kind : true))
    .filter((row) => (input.state ? row.state === input.state : true));
}

export interface ContactReply {
  authorEmail: string;
  body: string;
  createdAtMs: number;
}

/** What has already been said back, so two people do not answer twice. */
export async function listContactReplies(submissionId: string): Promise<ContactReply[]> {
  const snapshot = await contactRef()
    .doc(submissionId)
    .collection('replies')
    .orderBy('createdAtMs', 'asc')
    .limit(100)
    .get();

  return snapshot.docs.map((doc) => doc.data() as ContactReply);
}

export async function addContactReply(input: {
  authorEmail: string;
  body: string;
  submissionId: string;
}): Promise<void> {
  const submission = contactRef().doc(input.submissionId);

  await submission.collection('replies').add({
    authorEmail: input.authorEmail,
    body: input.body.trim().slice(0, 5000),
    createdAt: fieldValue.serverTimestamp(),
    createdAtMs: Date.now()
  });

  // Answering moves it out of the new queue. Leaving the state to be set
  // separately means a queue that never empties because somebody forgot.
  await submission.set({
    state: 'ACKNOWLEDGED',
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });
}

export async function setContactState(input: {
  state: ContactSubmission['state'];
  submissionId: string;
}): Promise<void> {
  await contactRef().doc(input.submissionId).set({
    state: input.state,
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });
}
