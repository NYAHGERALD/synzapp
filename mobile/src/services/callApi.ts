import { getSynzappRealtimeUrl } from './apiConfig';

export type SynzappCallMode = 'voice' | 'video';
export type SynzappCallChatType = 'DIRECT' | 'GROUP';
export type SynzappCallEndReason = 'busy' | 'declined' | 'ended' | 'failed' | 'missed';
export type SynzappCallSignalKind = 'answer' | 'iceCandidate' | 'offer';
export type SynzappCallSessionStatus = 'answered' | 'busy' | 'declined' | 'ended' | 'failed' | 'missed' | 'ringing';

export interface SynzappCallRecord {
  answeredAt?: string;
  answeredByUid?: string;
  callId: string;
  callerName: string;
  callerUid: string;
  chatType: SynzappCallChatType;
  contactId: string;
  createdAt: string;
  endedAt?: string;
  endedByUid?: string;
  mode: SynzappCallMode;
  participantUids: string[];
  status?: SynzappCallSessionStatus;
  tenantId: string;
  title: string;
}

export type SynzappCallRealtimeEvent =
  | { type: 'ready' }
  | { call: SynzappCallRecord; type: 'callStarted' }
  | { call: SynzappCallRecord; type: 'incomingCall' }
  | { callId: string; participantUid: string; type: 'callAnswered' }
  | { callId: string; endedByUid: string; reason: SynzappCallEndReason; type: 'callEnded' }
  | { callId: string; fromUid: string; kind: SynzappCallSignalKind; payload: unknown; type: 'callSignal' }
  | { message: string; type: 'error' };

export function openCallRealtimeSocket(idToken: string, deviceId: string): WebSocket {
  const socket = new WebSocket(getSynzappRealtimeUrl('/realtime/calls'));

  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({
      deviceId,
      idToken,
      type: 'authenticate'
    }));
  });

  return socket;
}

export function parseCallRealtimeEvent(payload: string): SynzappCallRealtimeEvent | null {
  try {
    const event = JSON.parse(payload) as Partial<SynzappCallRealtimeEvent>;

    if (event.type === 'ready') {
      return { type: 'ready' };
    }

    if ((event.type === 'callStarted' || event.type === 'incomingCall') && event.call) {
      return {
        call: normalizeCallRecord(event.call as SynzappCallRecord),
        type: event.type
      };
    }

    if (event.type === 'callAnswered' && typeof event.callId === 'string' && typeof event.participantUid === 'string') {
      return {
        callId: event.callId,
        participantUid: event.participantUid,
        type: 'callAnswered'
      };
    }

    if (event.type === 'callEnded' && typeof event.callId === 'string') {
      return {
        callId: event.callId,
        endedByUid: typeof event.endedByUid === 'string' ? event.endedByUid : '',
        reason: isCallEndReason(event.reason) ? event.reason : 'ended',
        type: 'callEnded'
      };
    }

    if (
      event.type === 'callSignal' &&
      typeof event.callId === 'string' &&
      typeof event.fromUid === 'string' &&
      isCallSignalKind(event.kind)
    ) {
      return {
        callId: event.callId,
        fromUid: event.fromUid,
        kind: event.kind,
        payload: event.payload ?? null,
        type: 'callSignal'
      };
    }

    if (event.type === 'error') {
      return {
        message: typeof event.message === 'string' ? event.message : 'Calling is unavailable.',
        type: 'error'
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function sendStartCall(socket: WebSocket, input: {
  callId: string;
  chatType: SynzappCallChatType;
  contactId: string;
  mode: SynzappCallMode;
  targetUids?: string[];
  title?: string;
}): void {
  sendCallSocketMessage(socket, {
    ...input,
    type: 'startCall'
  });
}

export function sendCallSignal(socket: WebSocket, input: {
  callId: string;
  kind: SynzappCallSignalKind;
  payload: unknown;
  targetUid: string;
}): void {
  sendCallSocketMessage(socket, {
    ...input,
    type: 'callSignal'
  });
}

export function sendAnswerCall(socket: WebSocket, callId: string): void {
  sendCallSocketMessage(socket, {
    callId,
    type: 'answerCall'
  });
}

export function sendEndCall(socket: WebSocket, callId: string, reason: SynzappCallEndReason = 'ended'): void {
  sendCallSocketMessage(socket, {
    callId,
    reason,
    type: 'endCall'
  });
}

function sendCallSocketMessage(socket: WebSocket, message: Record<string, unknown>): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(message));
}

function normalizeCallRecord(call: SynzappCallRecord): SynzappCallRecord {
  return {
    answeredAt: typeof call.answeredAt === 'string' ? call.answeredAt : undefined,
    answeredByUid: typeof call.answeredByUid === 'string' ? call.answeredByUid : undefined,
    callId: typeof call.callId === 'string' ? call.callId : '',
    callerName: typeof call.callerName === 'string' ? call.callerName : 'Synzapp user',
    callerUid: typeof call.callerUid === 'string' ? call.callerUid : '',
    chatType: call.chatType === 'GROUP' ? 'GROUP' : 'DIRECT',
    contactId: typeof call.contactId === 'string' ? call.contactId : '',
    createdAt: typeof call.createdAt === 'string' ? call.createdAt : new Date().toISOString(),
    endedAt: typeof call.endedAt === 'string' ? call.endedAt : undefined,
    endedByUid: typeof call.endedByUid === 'string' ? call.endedByUid : undefined,
    mode: call.mode === 'video' ? 'video' : 'voice',
    participantUids: Array.isArray(call.participantUids)
      ? call.participantUids.filter((uid): uid is string => typeof uid === 'string' && Boolean(uid.trim()))
      : [],
    status: isCallSessionStatus(call.status) ? call.status : undefined,
    tenantId: typeof call.tenantId === 'string' ? call.tenantId : '',
    title: typeof call.title === 'string' ? call.title : 'Synzapp call'
  };
}

function isCallSignalKind(value: unknown): value is SynzappCallSignalKind {
  return value === 'answer' || value === 'iceCandidate' || value === 'offer';
}

function isCallEndReason(value: unknown): value is SynzappCallEndReason {
  return value === 'busy' ||
    value === 'declined' ||
    value === 'ended' ||
    value === 'failed' ||
    value === 'missed';
}

function isCallSessionStatus(value: unknown): value is SynzappCallSessionStatus {
  return value === 'answered' ||
    value === 'busy' ||
    value === 'declined' ||
    value === 'ended' ||
    value === 'failed' ||
    value === 'missed' ||
    value === 'ringing';
}
