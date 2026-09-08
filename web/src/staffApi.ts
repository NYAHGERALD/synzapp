import { getSynzappApiBaseUrl } from './config';
import { getSynzappFirebaseAuth } from './firebase';

/**
 * The staff console's data.
 *
 * A separate client from the customer app's on purpose: it signs in with a
 * Google work account rather than a phone code, and it must never share a code
 * path that could be given a customer's token by mistake.
 */

export type StaffRole = 'SUPPORT' | 'ADMIN';
export type ContactKind = 'PUBLIC_ENQUIRY' | 'SUPPORT_REQUEST';
export type ContactState = 'NEW' | 'ACKNOWLEDGED' | 'CLOSED';

export interface StaffContext {
  displayName: string;
  email: string;
  role: StaffRole;
  uid: string;
}

export interface ContactAddress {
  city: string;
  countryCode: string;
  line1: string;
  line2: string;
  postalCode: string;
  region: string;
}

export interface ContactSubmission {
  /** Null when the sender left the address blank, and on rows saved before it was asked for. */
  address: ContactAddress | null;
  phone: string | null;
  createdAtMs: number;
  email: string;
  id: string;
  kind: ContactKind;
  message: string;
  name: string;
  organizationName: string | null;
  state: ContactState;
  subject: string;
  tenantId: string | null;
}

export interface ContactReply {
  authorEmail: string;
  body: string;
  createdAtMs: number;
}

export interface PolicyVersion {
  body: string;
  publishedAtMs: number | null;
  publishedByEmail: string | null;
  slug: 'privacy' | 'terms';
  state: 'DRAFT' | 'PUBLISHED';
  summary: string;
  title: string;
  version: number;
}

export class StaffAccessError extends Error {}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const user = getSynzappFirebaseAuth().currentUser;

  if (!user) {
    throw new StaffAccessError('Sign in with your Synzapp work account.');
  }

  const response = await fetch(`${getSynzappApiBaseUrl()}/api/staff${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await user.getIdToken()}`,
      ...(init.headers || {})
    }
  });

  if (response.status === 401 || response.status === 403) {
    // Told apart from a network failure so the console can explain that the
    // account is not on the staff list, rather than showing a generic error.
    throw new StaffAccessError(await getErrorMessage(response));
  }

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

async function getErrorMessage(response: Response): Promise<string> {
  const payload = await response.json().catch(() => ({}));
  const message = (payload as { message?: string }).message;

  if (message) {
    return message;
  }

  // The status, at least, rather than a phrase that says nothing. A generic
  // message here hid a database error that named its own fix.
  return `The server refused that request (${response.status}). Check the logs for the reason.`;
}

export function loadStaffContext(): Promise<{ staff: StaffContext }> {
  return request<{ staff: StaffContext }>('/me');
}

export function loadInbox(filters: { kind?: ContactKind; state?: ContactState } = {}) {
  const query = new URLSearchParams();

  if (filters.kind) {
    query.set('kind', filters.kind);
  }

  if (filters.state) {
    query.set('state', filters.state);
  }

  const suffix = query.toString() ? `?${query}` : '';

  return request<{ submissions: ContactSubmission[] }>(`/inbox${suffix}`);
}

export function loadReplies(submissionId: string) {
  return request<{ replies: ContactReply[] }>(`/inbox/${encodeURIComponent(submissionId)}/replies`);
}

export function sendReply(submissionId: string, body: string) {
  return request<{ replied: boolean }>(`/inbox/${encodeURIComponent(submissionId)}/replies`, {
    body: JSON.stringify({ body }),
    method: 'POST'
  });
}

export function setSubmissionState(submissionId: string, state: ContactState) {
  return request<{ state: ContactState }>(`/inbox/${encodeURIComponent(submissionId)}/state`, {
    body: JSON.stringify({ state }),
    method: 'POST'
  });
}

export function loadPolicy(slug: 'privacy' | 'terms') {
  return request<{
    draft: PolicyVersion | null;
    published: PolicyVersion | null;
    versions: PolicyVersion[];
  }>(`/policies/${slug}`);
}

export function savePolicyDraft(slug: 'privacy' | 'terms', input: {
  body: string;
  summary: string;
  title: string;
}) {
  return request<{ draft: PolicyVersion }>(`/policies/${slug}/draft`, {
    body: JSON.stringify(input),
    method: 'POST'
  });
}

export function publishPolicy(slug: 'privacy' | 'terms') {
  return request<{ published: PolicyVersion }>(`/policies/${slug}/publish`, { method: 'POST' });
}
