import { getSynzappApiBaseUrl } from './apiConfig';

/**
 * Announcements, from the phone's side.
 *
 * The phone asks and displays. It decides nothing: who may send, who was told
 * and whether an acknowledgement counts are all settled on the server, because
 * a phone is a thing a person can modify.
 */

export type AnnouncementAudienceKind = 'ORGANIZATION' | 'DEPARTMENT' | 'GROUP' | 'PERSON';
export type AnnouncementRecipientStatus = 'DELIVERED' | 'READ' | 'ACKNOWLEDGED';

export interface AnnouncementAudience {
  kind: AnnouncementAudienceKind;
  targetId: string | null;
  targetName: string;
}

export interface Announcement {
  acknowledgedCount: number;
  announcementId: string;
  /** What it says. Empty once retention has removed it. */
  body: string;
  audiences: AnnouncementAudience[];
  audienceSummary: string;
  bodyRemovedAtMs: number | null;
  createdAtMs: number;
  createdByName: string;
  createdByUid: string;
  expectedRecipientCount: number;
  myStatus: AnnouncementRecipientStatus | null;
  readCount: number;
  requiresAcknowledgement: boolean;
  subject: string;
}

export interface AnnouncementRecipient {
  acknowledgedAtMs: number | null;
  displayName: string;
  readAtMs: number | null;
  status: AnnouncementRecipientStatus;
  uid: string;
}

async function request<T>(input: {
  body?: unknown;
  idToken: string;
  method: 'GET' | 'POST';
  path: string;
}): Promise<T> {
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/announcements${input.path}`, {
    body: input.body ? JSON.stringify(input.body) : undefined,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${input.idToken}`,
      'Content-Type': 'application/json'
    },
    method: input.method
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));

    // Show what the server said. A generic "something went wrong" hides the
    // one useful sentence, which is usually a permission being refused.
    throw new Error(
      (payload as { error?: string }).error || 'That could not be done right now.'
    );
  }

  return response.json() as Promise<T>;
}

export async function listAnnouncements(idToken: string): Promise<Announcement[]> {
  const result = await request<{ announcements: Announcement[] }>({
    idToken,
    method: 'GET',
    path: '/'
  });

  return result.announcements || [];
}

export async function sendAnnouncement(input: {
  audiences: AnnouncementAudience[];
  body: string;
  idToken: string;
  requiresAcknowledgement: boolean;
  subject: string;
}): Promise<Announcement> {
  const result = await request<{ announcement: Announcement }>({
    body: {
      audiences: input.audiences,
      body: input.body,
      requiresAcknowledgement: input.requiresAcknowledgement,
      subject: input.subject
    },
    idToken: input.idToken,
    method: 'POST',
    path: '/'
  });

  return result.announcement;
}

export async function acknowledgeAnnouncement(input: {
  announcementId: string;
  idToken: string;
}): Promise<{ acknowledgedAtMs: number }> {
  return request<{ acknowledgedAtMs: number }>({
    idToken: input.idToken,
    method: 'POST',
    path: `/${encodeURIComponent(input.announcementId)}/acknowledge`
  });
}

export async function markAnnouncementRead(input: {
  announcementId: string;
  idToken: string;
}): Promise<void> {
  await request<{ ok: boolean }>({
    idToken: input.idToken,
    method: 'POST',
    path: `/${encodeURIComponent(input.announcementId)}/read`
  });
}

export async function listAnnouncementRecipients(input: {
  announcementId: string;
  idToken: string;
  startAfterUid?: string;
  status?: AnnouncementRecipientStatus;
}): Promise<{ nextCursor: string | null; recipients: AnnouncementRecipient[] }> {
  const query = new URLSearchParams();

  if (input.startAfterUid) {
    query.set('startAfterUid', input.startAfterUid);
  }

  if (input.status) {
    query.set('status', input.status);
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';

  return request<{ nextCursor: string | null; recipients: AnnouncementRecipient[] }>({
    idToken: input.idToken,
    method: 'GET',
    path: `/${encodeURIComponent(input.announcementId)}/recipients${suffix}`
  });
}

/**
 * How many people the chosen audiences reach, before anything is sent.
 *
 * Asked as the sender ticks things, so an empty audience is caught at the
 * moment it is chosen rather than after a safety notice has been written.
 */
export async function previewAnnouncementAudience(input: {
  audiences: AnnouncementAudience[];
  idToken: string;
}): Promise<{ recipientCount: number; summary: string }> {
  return request<{ recipientCount: number; summary: string }>({
    body: { audiences: input.audiences },
    idToken: input.idToken,
    method: 'POST',
    path: '/preview'
  });
}

export interface AnnouncementAudienceGroup {
  departmentId: string | null;
  groupId: string;
  memberCount: number;
  name: string;
}

/**
 * The groups this person may address.
 *
 * Not the same list the chat shows. That one holds only groups you are in,
 * because a group chat you are not in is one you cannot read. An Org Admin may
 * address any group in the company without being a member of it.
 */
export async function listAnnouncementAudienceGroups(
  idToken: string
): Promise<AnnouncementAudienceGroup[]> {
  const result = await request<{ groups: AnnouncementAudienceGroup[] }>({
    idToken,
    method: 'GET',
    path: '/audience-groups'
  });

  return result.groups || [];
}
