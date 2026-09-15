import type { DecodedIdToken } from 'firebase-admin/auth';
import { listCompliancePeople } from './complianceDirectoryService.js';
import { firestore } from '../config/firebaseAdmin.js';
import { buildAuditQueryWindow, type AuditQueryFilters } from './auditQueryFilters.js';
import { buildAuthSession } from './authSessionService.js';

/**
 * Reading the audit log.
 *
 * Written from everywhere, read from one place, and **erasable from nowhere**.
 * There is no delete here and no update: an audit log an administrator can edit
 * is a diary. It ages out by retention policy and by nothing else.
 *
 * Scoped by collection path rather than by a `where` clause. Events live under
 * `organizations/{tenantId}/auditLogs`, so a query cannot reach another
 * tenant's even if a filter were wrong — the strongest form of isolation
 * available here, because it does not depend on remembering a condition.
 *
 * Read on the web rather than the phone. This is wide tabular data for somebody
 * at a desk with filters and an export, not a supervisor on a floor. See
 * section 5.2 of SYNZAPP_ACTIONS_GOVERNANCE_PLAN.md.
 */

const AUDIT_PAGE_SIZE = 100;

export interface AuditEventRecord {
  action: string;
  /**
   * The name the actor is known by, when the directory has one.
   *
   * The console and the auditor's CSV showed a raw Firebase uid, so an auditor
   * received a file of 28-character identifiers and no way to turn them into
   * people. The same problem was already found and fixed once for archive
   * search, where somebody's messages "appeared in search results under a raw
   * identifier".
   *
   * The uid stays alongside it. A name is what a person reads; the uid is what
   * makes two people with the same name distinguishable.
   */
  actorName: string | null;
  actorUid: string | null;
  createdAtMs: number;
  eventId: string;
  ipAddress: string | null;
  metadata: Record<string, unknown>;
  reason: string | null;
  status: string;
}

export interface AuditEventPage {
  events: AuditEventRecord[];
  nextCursor: string | null;
}

function authorizationError(message: string): Error {
  const error = new Error(message);

  error.name = 'AuthorizationError';

  return error;
}

/**
 * Only a security admin reads it.
 *
 * The same bar as changing the backup policy or approving a restore: an audit
 * log names who did what, and handing that to everybody is its own privacy
 * problem.
 */
async function requireAuditReader(decodedToken: DecodedIdToken): Promise<string> {
  const session = await buildAuthSession(decodedToken);
  const { permissions, role, status, tenantId } = session.user;

  if (session.access !== 'ACTIVE' || !tenantId || status !== 'ACTIVE') {
    throw authorizationError('Your admin session is not active.');
  }

  if (role !== 'ORG_ADMIN' || !permissions.includes('security.manage')) {
    throw authorizationError('You do not have permission to read the audit log.');
  }

  return tenantId;
}

export async function listAuditEvents(
  decodedToken: DecodedIdToken,
  filters: AuditQueryFilters
): Promise<AuditEventPage> {
  const tenantId = await requireAuditReader(decodedToken);
  const window = buildAuditQueryWindow(filters);

  let query = firestore
    .collection('organizations').doc(tenantId)
    .collection('auditLogs')
    .orderBy('createdAt', 'desc')
    .limit(AUDIT_PAGE_SIZE + 1);

  if (window.actions.length > 0) {
    query = query.where('action', 'in', window.actions);
  }

  if (window.fromMs !== null) {
    query = query.where('createdAt', '>=', new Date(window.fromMs));
  }

  if (window.toMs !== null) {
    query = query.where('createdAt', '<=', new Date(window.toMs));
  }

  if (filters.startAfterId) {
    const cursor = await firestore
      .collection('organizations').doc(tenantId)
      .collection('auditLogs').doc(filters.startAfterId)
      .get()
      .catch(() => null);

    if (cursor?.exists) {
      query = query.startAfter(cursor);
    }
  }

  const snapshot = await query.get();
  const rows = snapshot.docs.map((doc) => toAuditEventRecord(doc.id, doc.data()));
  const events = rows.slice(0, AUDIT_PAGE_SIZE);

  /**
   * Names resolved once for the page, not once per row.
   *
   * Read tolerantly: an audit page must still open if the directory read fails.
   * A row with no name falls back to its uid, which is what every row showed
   * before this.
   */
  const namesByUid = await readActorNames(tenantId, events);

  return {
    events: events.map((event) => ({
      ...event,
      actorName: event.actorUid ? namesByUid.get(event.actorUid) || null : null
    })),
    nextCursor: rows.length > AUDIT_PAGE_SIZE ? events[events.length - 1].eventId : null
  };
}

async function readActorNames(
  tenantId: string,
  events: AuditEventRecord[]
): Promise<Map<string, string>> {
  const wanted = new Set(events.map((event) => event.actorUid).filter(Boolean) as string[]);

  if (!wanted.size) {
    return new Map();
  }

  const people = await listCompliancePeople(tenantId).catch(() => []);

  return new Map(
    people
      .filter((person) => wanted.has(person.uid) && person.displayName)
      .map((person) => [person.uid, person.displayName])
  );
}

function toAuditEventRecord(eventId: string, raw: Record<string, unknown>): AuditEventRecord {
  const createdAt = raw.createdAt as { toMillis?: () => number } | undefined;

  return {
    action: String(raw.action || ''),
    actorName: null,
    actorUid: (raw.uid as string) || null,
    // A serverTimestamp is still null for the instant between the write landing
    // and the server stamping it. Zero rather than a crash, and it sorts last.
    createdAtMs: typeof createdAt?.toMillis === 'function' ? createdAt.toMillis() : 0,
    eventId,
    ipAddress: (raw.ipAddress as string) || null,
    metadata: (raw.metadata as Record<string, unknown>) || {},
    reason: (raw.reason as string) || null,
    status: String(raw.status || '')
  };
}
