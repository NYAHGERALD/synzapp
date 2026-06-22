import AsyncStorage from '@react-native-async-storage/async-storage';

export type SynzappCallHistoryDirection = 'incoming' | 'outgoing';
export type SynzappCallHistoryMode = 'video' | 'voice';
export type SynzappCallHistoryStatus = 'answered' | 'busy' | 'canceled' | 'declined' | 'ended' | 'failed' | 'missed' | 'ringing';
export type SynzappCallHistoryChatType = 'DIRECT' | 'GROUP';

export interface SynzappCallStoreScope {
  ownerUid: string;
  tenantId: string;
}

export interface SynzappCallHistoryEntry {
  callId: string;
  callerName: string;
  chatType: SynzappCallHistoryChatType;
  contactId: string;
  createdAt: string;
  direction: SynzappCallHistoryDirection;
  endedAt?: string | null;
  id: string;
  mode: SynzappCallHistoryMode;
  participantUids: string[];
  profilePhotoUrl?: string | null;
  status: SynzappCallHistoryStatus;
  title: string;
  unseen: boolean;
  updatedAt: string;
}

export interface SynzappScheduledCall {
  callType: SynzappCallHistoryMode;
  contactIds: string[];
  createdAt: string;
  description: string;
  endsAt: string | null;
  id: string;
  includeEndTime: boolean;
  reminderMinutes: number;
  requireApproval: boolean;
  startsAt: string;
  title: string;
}

export interface SynzappCallStoreData {
  favoriteContactIds: string[];
  history: SynzappCallHistoryEntry[];
  scheduledCalls: SynzappScheduledCall[];
}

const CALL_STORE_VERSION = 'v1';
const CALL_HISTORY_LIMIT = 120;

const emptyCallStoreData: SynzappCallStoreData = {
  favoriteContactIds: [],
  history: [],
  scheduledCalls: []
};

export async function loadSynzappCallStore(scope: SynzappCallStoreScope): Promise<SynzappCallStoreData> {
  if (!scope.ownerUid || !scope.tenantId) {
    return emptyCallStoreData;
  }

  const storedValue = await AsyncStorage.getItem(getSynzappCallStoreKey(scope));

  if (!storedValue) {
    return emptyCallStoreData;
  }

  try {
    const parsedValue = JSON.parse(storedValue) as Partial<SynzappCallStoreData>;

    return {
      favoriteContactIds: Array.isArray(parsedValue.favoriteContactIds) ? parsedValue.favoriteContactIds.filter(Boolean) : [],
      history: Array.isArray(parsedValue.history) ? parsedValue.history.filter(isSynzappCallHistoryEntry) : [],
      scheduledCalls: Array.isArray(parsedValue.scheduledCalls) ? parsedValue.scheduledCalls.filter(isSynzappScheduledCall) : []
    };
  } catch {
    return emptyCallStoreData;
  }
}

export async function saveSynzappCallStore(
  scope: SynzappCallStoreScope,
  data: SynzappCallStoreData
): Promise<void> {
  if (!scope.ownerUid || !scope.tenantId) {
    return;
  }

  await AsyncStorage.setItem(
    getSynzappCallStoreKey(scope),
    JSON.stringify({
      favoriteContactIds: dedupeStrings(data.favoriteContactIds),
      history: data.history.slice(0, CALL_HISTORY_LIMIT),
      scheduledCalls: data.scheduledCalls
    })
  );
}

export function upsertSynzappCallHistoryEntry(
  history: SynzappCallHistoryEntry[],
  entry: SynzappCallHistoryEntry
): SynzappCallHistoryEntry[] {
  const existingEntry = history.find((currentEntry) => currentEntry.callId === entry.callId);
  const nextEntry = existingEntry
    ? {
        ...existingEntry,
        ...entry,
        createdAt: existingEntry.createdAt || entry.createdAt,
        unseen: entry.unseen || existingEntry.unseen
      }
    : entry;

  return [
    nextEntry,
    ...history.filter((currentEntry) => currentEntry.callId !== entry.callId)
  ]
    .sort((firstEntry, secondEntry) =>
      new Date(secondEntry.updatedAt || secondEntry.createdAt).getTime() -
      new Date(firstEntry.updatedAt || firstEntry.createdAt).getTime())
    .slice(0, CALL_HISTORY_LIMIT);
}

export function markSynzappCallsSeen(history: SynzappCallHistoryEntry[]): SynzappCallHistoryEntry[] {
  return history.map((entry) => entry.unseen ? { ...entry, unseen: false } : entry);
}

function getSynzappCallStoreKey(scope: SynzappCallStoreScope): string {
  return `synzapp.callStore.${CALL_STORE_VERSION}.${scope.tenantId}.${scope.ownerUid}`;
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function isSynzappCallHistoryEntry(value: unknown): value is SynzappCallHistoryEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const entry = value as Partial<SynzappCallHistoryEntry>;
  return Boolean(entry.callId && entry.contactId && entry.id && entry.title);
}

function isSynzappScheduledCall(value: unknown): value is SynzappScheduledCall {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const entry = value as Partial<SynzappScheduledCall>;
  return Boolean(entry.id && entry.title && entry.startsAt);
}
