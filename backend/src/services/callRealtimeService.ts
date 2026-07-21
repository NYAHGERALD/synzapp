import { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../config/firebaseAdmin.js';
import { verifyActiveRegisteredDevice } from './deviceIdentityService.js';
import { getGroupChatContact } from './groupChatService.js';
import {
  sendCallEndedPushNotifications,
  sendCallInvitePushNotifications
} from './notificationService.js';
import { getDirectChatContact, getCurrentUserProfile } from './userProfileService.js';

type CallChatType = 'DIRECT' | 'GROUP';
type CallMode = 'voice' | 'video';
type CallSignalKind = 'answer' | 'iceCandidate' | 'offer';
type CallEndReason = 'busy' | 'declined' | 'ended' | 'failed' | 'missed';
type CallSessionStatus = 'answered' | 'busy' | 'declined' | 'ended' | 'failed' | 'missed' | 'ringing';

interface AuthenticateCallMessage {
  deviceId?: string;
  idToken?: string;
  type: 'authenticate';
}

interface StartCallMessage {
  callId?: string;
  chatType?: CallChatType;
  contactId?: string;
  mode?: CallMode;
  targetUids?: string[];
  title?: string;
  type: 'startCall';
}

interface CallSignalMessage {
  callId?: string;
  kind?: CallSignalKind;
  payload?: unknown;
  targetUid?: string;
  type: 'callSignal';
}

interface CallAnswerActionMessage {
  callId?: string;
  type: 'answerCall';
}

interface CallEndMessage {
  callId?: string;
  reason?: CallEndReason;
  type: 'endCall';
}

type CallRealtimeClientMessage =
  | AuthenticateCallMessage
  | CallAnswerActionMessage
  | CallEndMessage
  | CallSignalMessage
  | StartCallMessage;

interface ActiveCallRecord {
  answeredAt?: string;
  answeredByUid?: string;
  callId: string;
  callerName: string;
  callerUid: string;
  chatType: CallChatType;
  contactId: string;
  createdAt: string;
  endedAt?: string;
  endedByUid?: string;
  mode: CallMode;
  participantUids: string[];
  status: CallSessionStatus;
  tenantId: string;
  title: string;
}

const CALL_RING_TIMEOUT_MS = 45_000;
const activeCalls = new Map<string, ActiveCallRecord>();
const callTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const connectionsByUid = new Map<string, Set<CallRealtimeConnection>>();

export function attachCallRealtimeServer(server: Server): void {
  const realtimeServer = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    if ((request as { __synzappRealtimeHandled?: boolean }).__synzappRealtimeHandled) {
      return;
    }

    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    if (url.pathname !== '/realtime/calls') {
      return;
    }

    (request as { __synzappRealtimeHandled?: boolean }).__synzappRealtimeHandled = true;

    realtimeServer.handleUpgrade(request, socket, head, (webSocket) => {
      realtimeServer.emit('connection', webSocket);
    });
  });

  realtimeServer.on('connection', (webSocket) => {
    const connection = new CallRealtimeConnection(webSocket);
    connection.start();
  });
}

class CallRealtimeConnection {
  private authTimeout: ReturnType<typeof setTimeout> | null = null;
  private decodedToken: DecodedIdToken | null = null;
  private deviceId: string | null = null;
  private tenantId: string | null = null;
  private uid: string | null = null;

  constructor(private readonly webSocket: WebSocket) {}

  start(): void {
    this.authTimeout = setTimeout(() => {
      this.closeWithError('Your call session could not be verified.');
    }, 10_000);

    this.webSocket.on('message', (payload) => {
      void this.handleMessage(payload.toString());
    });

    this.webSocket.on('close', () => {
      this.cleanup();
    });

    this.webSocket.on('error', () => {
      this.cleanup();
    });
  }

  sendJson(payload: Record<string, unknown>): void {
    if (this.webSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.webSocket.send(JSON.stringify(payload));
  }

  private async handleMessage(payload: string): Promise<void> {
    const message = this.parseMessage(payload);

    if (!message) {
      this.sendError('Call message was not understood.');
      return;
    }

    if (message.type === 'authenticate') {
      await this.authenticate(message.idToken || '', message.deviceId || '');
      return;
    }

    if (!this.decodedToken || !this.uid || !this.tenantId) {
      this.sendError('Call session is not authenticated.');
      return;
    }

    if (message.type === 'startCall') {
      await this.startCall(message);
      return;
    }

    if (message.type === 'callSignal') {
      this.relaySignal(message);
      return;
    }

    if (message.type === 'answerCall') {
      this.answerCall(message);
      return;
    }

    if (message.type === 'endCall') {
      this.endCall(message);
    }
  }

  private parseMessage(payload: string): CallRealtimeClientMessage | null {
    try {
      const message = JSON.parse(payload) as Partial<CallRealtimeClientMessage>;

      if (
        message.type === 'authenticate' ||
        message.type === 'answerCall' ||
        message.type === 'callSignal' ||
        message.type === 'endCall' ||
        message.type === 'startCall'
      ) {
        return message as CallRealtimeClientMessage;
      }
    } catch {
      return null;
    }

    return null;
  }

  private async authenticate(idToken: string, deviceId: string): Promise<void> {
    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken, true);
      const activeDevice = await verifyActiveRegisteredDevice(decodedToken, deviceId);

      this.decodedToken = decodedToken;
      this.deviceId = activeDevice.deviceId;
      this.tenantId = activeDevice.tenantId;
      this.uid = decodedToken.uid;

      if (this.authTimeout) {
        clearTimeout(this.authTimeout);
        this.authTimeout = null;
      }

      const connections = connectionsByUid.get(decodedToken.uid) || new Set<CallRealtimeConnection>();
      connections.add(this);
      connectionsByUid.set(decodedToken.uid, connections);
      this.sendJson({ type: 'ready' });
    } catch {
      this.closeWithError('Your call session could not be verified.');
    }
  }

  private async startCall(message: StartCallMessage): Promise<void> {
    if (!this.decodedToken || !this.tenantId || !this.uid) {
      return;
    }

    const callId = normalizeCallId(message.callId);
    const contactId = typeof message.contactId === 'string' ? message.contactId.trim() : '';
    const mode = message.mode === 'video' ? 'video' : 'voice';
    const chatType = message.chatType === 'GROUP' ? 'GROUP' : 'DIRECT';

    if (!callId || !contactId) {
      this.sendError('Call could not be started.');
      return;
    }

    const profile = await getCurrentUserProfile(this.decodedToken);
    const callerName = profile.displayName || 'Synzapp user';
    const callContext = chatType === 'GROUP'
      ? await this.buildGroupCallContext(contactId, message.targetUids || [])
      : await this.buildDirectCallContext(contactId);

    if (!callContext.targetUids.length) {
      this.sendError('No active call recipients were found.');
      return;
    }

    const call: ActiveCallRecord = {
      callId,
      callerName,
      callerUid: this.uid,
      chatType,
      contactId,
      createdAt: new Date().toISOString(),
      mode,
      participantUids: [this.uid, ...callContext.targetUids],
      status: 'ringing',
      tenantId: this.tenantId,
      title: message.title?.trim() || callContext.title
    };

    activeCalls.set(callId, call);
    scheduleMissedCallTimeout(call);
    this.sendJson({
      call,
      type: 'callStarted'
    });
    callContext.targetUids.forEach((targetUid) => {
      sendToUser(targetUid, {
        call,
        type: 'incomingCall'
      });
    });
    void sendCallInvitePushNotifications({
      callId: call.callId,
      callerName: call.callerName,
      callerUid: call.callerUid,
      chatType: call.chatType,
      contactId: call.contactId,
      createdAt: call.createdAt,
      mode: call.mode,
      participantUids: call.participantUids,
      recipientUids: callContext.targetUids,
      tenantId: call.tenantId,
      title: call.title
    }).catch((error) => {
      console.warn('Unable to send Synzapp call invite push notifications', error);
    });
  }

  private async buildDirectCallContext(contactId: string): Promise<{ targetUids: string[]; title: string }> {
    if (!this.decodedToken || !this.uid) {
      return { targetUids: [], title: 'Synzapp call' };
    }

    const contact = await getDirectChatContact(this.decodedToken, contactId);

    return {
      targetUids: contact.contactId === this.uid ? [] : [contact.contactId],
      title: contact.displayName || 'Synzapp call'
    };
  }

  private async buildGroupCallContext(contactId: string, requestedTargetUids: string[]): Promise<{ targetUids: string[]; title: string }> {
    if (!this.decodedToken || !this.uid) {
      return { targetUids: [], title: 'Synzapp group call' };
    }

    const group = await getGroupChatContact(this.decodedToken, contactId);
    const allowedMemberUids = new Set(group.members.map((member) => member.uid).filter((uid) => uid !== this.uid));
    const requestedUids = requestedTargetUids
      .map((uid) => uid.trim())
      .filter((uid) => allowedMemberUids.has(uid));
    const targetUids = Array.from(new Set((requestedUids.length ? requestedUids : Array.from(allowedMemberUids)).slice(0, 15)));

    return {
      targetUids,
      title: group.displayName || 'Synzapp group call'
    };
  }

  private relaySignal(message: CallSignalMessage): void {
    if (!this.uid) {
      return;
    }

    const call = activeCalls.get(normalizeCallId(message.callId));
    const targetUid = typeof message.targetUid === 'string' ? message.targetUid.trim() : '';

    if (
      !call ||
      !targetUid ||
      isFinalCallStatus(call.status) ||
      !call.participantUids.includes(this.uid) ||
      !call.participantUids.includes(targetUid)
    ) {
      return;
    }

    sendToUser(targetUid, {
      callId: call.callId,
      fromUid: this.uid,
      kind: message.kind,
      payload: message.payload || null,
      type: 'callSignal'
    });
  }

  private answerCall(message: CallAnswerActionMessage): void {
    if (!this.uid) {
      return;
    }

    const call = activeCalls.get(normalizeCallId(message.callId));

    if (!call || !call.participantUids.includes(this.uid)) {
      return;
    }

    if (call.status !== 'ringing') {
      this.sendJson({
        callId: call.callId,
        participantUid: call.answeredByUid || this.uid,
        type: 'callAnswered'
      });
      return;
    }

    call.status = 'answered';
    call.answeredAt = new Date().toISOString();
    call.answeredByUid = this.uid;
    clearCallTimeout(call.callId);

    broadcastToCall(call, {
      callId: call.callId,
      participantUid: this.uid,
      type: 'callAnswered'
    });
  }

  private endCall(message: CallEndMessage): void {
    if (!this.uid) {
      return;
    }

    const call = activeCalls.get(normalizeCallId(message.callId));

    if (!call || !call.participantUids.includes(this.uid)) {
      return;
    }

    finalizeCall(call, normalizeCallEndReason(message.reason), this.uid);
  }

  private sendError(message: string): void {
    this.sendJson({
      message,
      type: 'error'
    });
  }

  private closeWithError(message: string): void {
    this.sendError(message);
    this.webSocket.close();
    this.cleanup();
  }

  private cleanup(): void {
    if (this.authTimeout) {
      clearTimeout(this.authTimeout);
      this.authTimeout = null;
    }

    if (!this.uid) {
      return;
    }

    const connections = connectionsByUid.get(this.uid);
    connections?.delete(this);

    if (connections && connections.size === 0) {
      connectionsByUid.delete(this.uid);
    }
  }
}

function sendToUser(uid: string, payload: Record<string, unknown>): void {
  const connections = connectionsByUid.get(uid);

  connections?.forEach((connection) => connection.sendJson(payload));
}

function broadcastToCall(call: ActiveCallRecord, payload: Record<string, unknown>): void {
  call.participantUids.forEach((participantUid) => {
    sendToUser(participantUid, payload);
  });
}

function scheduleMissedCallTimeout(call: ActiveCallRecord): void {
  clearCallTimeout(call.callId);
  callTimeouts.set(call.callId, setTimeout(() => {
    const currentCall = activeCalls.get(call.callId);

    if (!currentCall || currentCall.status !== 'ringing') {
      return;
    }

    finalizeCall(currentCall, 'missed', 'system');
  }, CALL_RING_TIMEOUT_MS));
}

function clearCallTimeout(callId: string): void {
  const timeout = callTimeouts.get(callId);

  if (!timeout) {
    return;
  }

  clearTimeout(timeout);
  callTimeouts.delete(callId);
}

function finalizeCall(call: ActiveCallRecord, reason: CallEndReason, endedByUid: string): void {
  if (isFinalCallStatus(call.status)) {
    return;
  }

  call.status = reason;
  call.endedAt = new Date().toISOString();
  call.endedByUid = endedByUid;
  clearCallTimeout(call.callId);
  broadcastToCall(call, {
    callId: call.callId,
    endedByUid,
    reason,
    type: 'callEnded'
  });
  void sendCallEndedPushNotifications({
    callId: call.callId,
    endedByUid,
    reason,
    recipientUids: call.participantUids,
    tenantId: call.tenantId
  }).catch((error) => {
    console.warn('Unable to send Synzapp call ended push notifications', error);
  });
  activeCalls.delete(call.callId);
}

function isFinalCallStatus(status: CallSessionStatus): boolean {
  return status === 'busy' ||
    status === 'declined' ||
    status === 'ended' ||
    status === 'failed' ||
    status === 'missed';
}

function normalizeCallId(value?: string): string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,160}$/.test(value.trim())
    ? value.trim()
    : '';
}

function normalizeCallEndReason(value?: string): CallEndReason {
  return value === 'busy' ||
    value === 'declined' ||
    value === 'failed' ||
    value === 'missed'
    ? value
    : 'ended';
}
