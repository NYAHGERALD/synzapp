import { Platform } from 'react-native';
import SynzappVoipCallsNative, {
  SynzappVoipCallEvent,
  SynzappVoipCallRecord
} from '../../modules/synzapp-voip-calls/src';

export type { SynzappVoipCallEvent, SynzappVoipCallRecord };

export async function getSynzappVoipToken(): Promise<string | null> {
  if (Platform.OS !== 'ios' || !SynzappVoipCallsNative?.getVoipToken) {
    return null;
  }

  const token = await SynzappVoipCallsNative.getVoipToken();

  return typeof token === 'string' && token.trim() ? token.trim() : null;
}

export async function getPendingSynzappVoipCallEvents(): Promise<SynzappVoipCallEvent[]> {
  if (Platform.OS !== 'ios' || !SynzappVoipCallsNative?.getPendingEvents) {
    return [];
  }

  const events = await SynzappVoipCallsNative.getPendingEvents();

  return Array.isArray(events)
    ? events.map(normalizeVoipCallEvent).filter((event): event is SynzappVoipCallEvent => Boolean(event))
    : [];
}

export function addSynzappVoipCallEventListener(
  listener: (event: SynzappVoipCallEvent) => void
): { remove: () => void } {
  if (Platform.OS !== 'ios' || !SynzappVoipCallsNative?.addListener) {
    return { remove: () => undefined };
  }

  return SynzappVoipCallsNative.addListener('onSynzappVoipCallEvent', (event) => {
    const normalizedEvent = normalizeVoipCallEvent(event);

    if (normalizedEvent) {
      listener(normalizedEvent);
    }
  });
}

export function addSynzappVoipTokenListener(
  listener: (token: string) => void
): { remove: () => void } {
  if (Platform.OS !== 'ios' || !SynzappVoipCallsNative?.addListener) {
    return { remove: () => undefined };
  }

  return SynzappVoipCallsNative.addListener('onSynzappVoipToken', (event) => {
    const tokenEvent = event as { token?: unknown } | null | undefined;
    const token = typeof tokenEvent?.token === 'string' ? tokenEvent.token.trim() : '';

    if (token) {
      listener(token);
    }
  });
}

export async function endSynzappNativeVoipCall(callId: string, reason?: string): Promise<void> {
  if (Platform.OS !== 'ios' || !callId || !SynzappVoipCallsNative?.endCall) {
    return;
  }

  await SynzappVoipCallsNative.endCall(callId, reason);
}

function normalizeVoipCallEvent(event: unknown): SynzappVoipCallEvent | null {
  if (!event || typeof event !== 'object') {
    return null;
  }

  const payload = event as Partial<SynzappVoipCallEvent>;

  if (payload.type !== 'incoming' && payload.type !== 'answer' && payload.type !== 'end' && payload.type !== 'failed') {
    return null;
  }

  return {
    call: normalizeVoipCallRecord(payload.call),
    callId: typeof payload.callId === 'string' ? payload.callId : payload.call?.callId,
    errorMessage: typeof payload.errorMessage === 'string' ? payload.errorMessage : undefined,
    nativeDisplayed: payload.nativeDisplayed === true,
    type: payload.type
  };
}

function normalizeVoipCallRecord(call: unknown): SynzappVoipCallRecord | undefined {
  if (!call || typeof call !== 'object') {
    return undefined;
  }

  const payload = call as Partial<SynzappVoipCallRecord>;

  if (
    typeof payload.callId !== 'string' ||
    typeof payload.callerUid !== 'string' ||
    typeof payload.contactId !== 'string'
  ) {
    return undefined;
  }

  return {
    callId: payload.callId,
    callerName: typeof payload.callerName === 'string' && payload.callerName.trim()
      ? payload.callerName
      : 'Synzapp user',
    callerUid: payload.callerUid,
    chatType: payload.chatType === 'GROUP' ? 'GROUP' : 'DIRECT',
    contactId: payload.contactId,
    createdAt: typeof payload.createdAt === 'string' && payload.createdAt.trim()
      ? payload.createdAt
      : new Date().toISOString(),
    mode: payload.mode === 'video' ? 'video' : 'voice',
    participantUids: Array.isArray(payload.participantUids)
      ? payload.participantUids.filter((uid): uid is string => typeof uid === 'string' && Boolean(uid.trim()))
      : [],
    tenantId: typeof payload.tenantId === 'string' ? payload.tenantId : '',
    title: typeof payload.title === 'string' && payload.title.trim() ? payload.title : 'Synzapp call'
  };
}
