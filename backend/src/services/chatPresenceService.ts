export interface ChatPresence {
  isOnline: boolean;
  lastSeenAt: string | null;
}

export interface ChatPresenceUpdate {
  contactId: string;
  isOnline: boolean;
  lastSeenAt: string | null;
  tenantId: string;
}

type PresenceListener = (update: ChatPresenceUpdate) => void;

interface PresenceRecord {
  connectionCount: number;
  lastSeenAtMs: number;
  offlineTimer: ReturnType<typeof setTimeout> | null;
  tenantId: string;
}

const OFFLINE_GRACE_MS = 8000;
const presenceByUid = new Map<string, PresenceRecord>();
const listeners = new Set<PresenceListener>();

export function getChatPresenceForUser(uid: string): ChatPresence {
  const record = presenceByUid.get(uid);

  if (!record) {
    return {
      isOnline: false,
      lastSeenAt: null
    };
  }

  return {
    isOnline: record.connectionCount > 0,
    lastSeenAt: new Date(record.lastSeenAtMs).toISOString()
  };
}

export function markChatUserOnline(uid: string, tenantId: string): void {
  const now = Date.now();
  const existingRecord = presenceByUid.get(uid);
  const wasOnline = Boolean(existingRecord && existingRecord.connectionCount > 0);
  const record: PresenceRecord = existingRecord || {
    connectionCount: 0,
    lastSeenAtMs: now,
    offlineTimer: null,
    tenantId
  };

  if (record.offlineTimer) {
    clearTimeout(record.offlineTimer);
    record.offlineTimer = null;
  }

  record.connectionCount += 1;
  record.lastSeenAtMs = now;
  record.tenantId = tenantId;
  presenceByUid.set(uid, record);

  if (!wasOnline) {
    emitPresenceUpdate(uid, record);
  }
}

export function touchChatUserPresence(uid: string, tenantId: string): void {
  const now = Date.now();
  const record = presenceByUid.get(uid) || {
    connectionCount: 0,
    lastSeenAtMs: now,
    offlineTimer: null,
    tenantId
  };

  record.lastSeenAtMs = now;
  record.tenantId = tenantId;
  presenceByUid.set(uid, record);
}

export function markChatUserOffline(uid: string): void {
  const record = presenceByUid.get(uid);

  if (!record) {
    return;
  }

  record.connectionCount = Math.max(0, record.connectionCount - 1);
  record.lastSeenAtMs = Date.now();

  if (record.connectionCount > 0) {
    return;
  }

  if (record.offlineTimer) {
    clearTimeout(record.offlineTimer);
  }

  record.offlineTimer = setTimeout(() => {
    const latestRecord = presenceByUid.get(uid);

    if (!latestRecord || latestRecord.connectionCount > 0) {
      return;
    }

    latestRecord.offlineTimer = null;
    latestRecord.lastSeenAtMs = Date.now();
    emitPresenceUpdate(uid, latestRecord);
  }, OFFLINE_GRACE_MS);
}

export function subscribeChatPresenceUpdates(listener: PresenceListener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function emitPresenceUpdate(uid: string, record: PresenceRecord): void {
  const update: ChatPresenceUpdate = {
    contactId: uid,
    isOnline: record.connectionCount > 0,
    lastSeenAt: new Date(record.lastSeenAtMs).toISOString(),
    tenantId: record.tenantId
  };

  listeners.forEach((listener) => {
    listener(update);
  });
}
