import { getSynzappApiBaseUrl } from './config';
import { getSynzappFirebaseAuth } from './firebase';
import type {
  RcaActivityLog,
  RcaIncident,
  RcaNode,
  RcaNodeInput,
  RcaUserSummary
} from './rcaApi';

export interface RcaRealtimePresenceUser extends RcaUserSummary {
  connectionCount: number;
  lastSeenAtIso: string;
}

type RcaRealtimeStatus = 'connecting' | 'connected' | 'subscribed' | 'disconnected';

type RcaRealtimeEvent =
  | { type: 'status'; status: RcaRealtimeStatus }
  | { type: 'activityLogCreated'; incidentId: string; log: RcaActivityLog; sessionId: string }
  | { type: 'canvasSnapshot'; incidentId: string; nodes: RcaNode[]; participants: RcaRealtimePresenceUser[]; sessionId: string }
  | {
      action: 'DELETED' | 'INVITED' | 'REMOVED' | 'UPDATED';
      actorUid: string;
      deletedAtIso: string | null;
      incident: RcaIncident;
      invitedUsers: RcaUserSummary[];
      removedAtIso: string | null;
      removedUser: RcaUserSummary | null;
      type: 'incidentMembershipChanged';
    }
  | { type: 'presenceUpdated'; participants: RcaRealtimePresenceUser[] }
  | { type: 'nodeActivitiesUpdated'; activities: RcaNodeActivity[] }
  | { type: 'nodeCreated'; actorUid: string; clientMutationId: string | null; incidentId: string; node: RcaNode; sessionId: string }
  | { type: 'nodeUpdated'; actorUid: string; clientMutationId: string | null; incidentId: string; node: RcaNode; sessionId: string }
  | { type: 'nodeDeleted'; actorUid: string; clientMutationId: string | null; incidentId: string; nodeId: string; sessionId: string }
  | { type: 'nodeTextSync'; incidentId: string; nodeId: string; sessionId: string; update: string }
  | { type: 'nodeLiveLabelUpdated'; actorUid: string; incidentId: string; label: string; nodeId: string; sessionId: string }
  | { type: 'nodeTextUpdate'; actorUid: string; incidentId: string; label: string | null; nodeId: string; sessionId: string; update: string }
  | { type: 'error'; error: string };

type RcaRealtimeListener = (event: RcaRealtimeEvent) => void;

export interface RcaNodeActivity {
  activity: 'editing' | 'moving';
  nodeId: string;
  user: RcaRealtimePresenceUser;
}

interface PendingMutation {
  reject: (error: Error) => void;
  resolve: (value: RcaNode | void) => void;
  timeoutId: number;
}

const RCA_REALTIME_MUTATION_TIMEOUT_MS = 15_000;
const RCA_REALTIME_HEARTBEAT_MS = 20_000;
const RCA_REALTIME_RECONNECT_MS = 1_500;

class RcaRealtimeClient {
  private heartbeatTimerId: number | null = null;
  private isAuthenticated = false;
  private listeners = new Set<RcaRealtimeListener>();
  private pendingMutations = new Map<string, PendingMutation>();
  private reconnectTimerId: number | null = null;
  private shouldReconnect = false;
  private shouldSubscribeWorkspace = false;
  private socket: WebSocket | null = null;
  private subscribedCanvas: { incidentId: string; sessionId: string } | null = null;
  private targetCanvas: { incidentId: string; sessionId: string } | null = null;

  connect(): void {
    this.shouldReconnect = true;

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    this.clearReconnectTimer();
    this.emit({ status: 'connecting', type: 'status' });

    const socket = new WebSocket(buildRcaRealtimeUrl());
    this.socket = socket;
    this.isAuthenticated = false;

    socket.addEventListener('open', () => {
      void this.authenticate();
    });

    socket.addEventListener('message', (event) => {
      this.handleMessage(event.data);
    });

    socket.addEventListener('close', () => {
      if (this.socket === socket) {
        this.socket = null;
        this.isAuthenticated = false;
        this.subscribedCanvas = null;
      }

      this.stopHeartbeat();
      this.rejectPendingMutations(new Error('RCA realtime connection was interrupted.'));
      this.emit({ status: 'disconnected', type: 'status' });
      this.scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      this.emit({ error: 'RCA realtime collaboration is temporarily unavailable.', type: 'error' });
    });
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.rejectPendingMutations(new Error('RCA realtime connection was closed.'));
    this.socket?.close();
    this.socket = null;
    this.isAuthenticated = false;
    this.subscribedCanvas = null;
    this.shouldSubscribeWorkspace = false;
    this.targetCanvas = null;
  }

  subscribe(listener: RcaRealtimeListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeWorkspace(): void {
    this.shouldSubscribeWorkspace = true;

    if (!this.isAuthenticated) {
      this.connect();
      return;
    }

    this.sendJson({ type: 'subscribeWorkspace' });
  }

  subscribeCanvas(incidentId: string, sessionId: string): void {
    this.targetCanvas = { incidentId, sessionId };

    if (!this.isAuthenticated) {
      this.connect();
      return;
    }

    this.sendJson({
      incidentId,
      sessionId,
      type: 'subscribeCanvas'
    });
  }

  unsubscribeCanvas(): void {
    this.targetCanvas = null;
    this.subscribedCanvas = null;
    this.sendJson({ type: 'unsubscribeCanvas' });
  }

  isReadyForCanvas(incidentId: string, sessionId: string): boolean {
    return Boolean(
      this.socket?.readyState === WebSocket.OPEN &&
      this.isAuthenticated &&
      this.subscribedCanvas?.incidentId === incidentId &&
      this.subscribedCanvas.sessionId === sessionId
    );
  }

  createNode(incidentId: string, sessionId: string, input: RcaNodeInput): Promise<RcaNode> {
    return this.sendMutation<RcaNode>({
      incidentId,
      input,
      sessionId,
      type: 'createNode'
    });
  }

  updateNode(incidentId: string, sessionId: string, nodeId: string, input: RcaNodeInput): Promise<RcaNode> {
    return this.sendMutation<RcaNode>({
      incidentId,
      input,
      nodeId,
      sessionId,
      type: 'updateNode'
    });
  }

  deleteNode(incidentId: string, sessionId: string, nodeId: string): Promise<void> {
    return this.sendMutation<void>({
      incidentId,
      nodeId,
      sessionId,
      type: 'deleteNode'
    });
  }

  subscribeNodeText(incidentId: string, sessionId: string, nodeId: string): void {
    this.sendJson({
      incidentId,
      nodeId,
      sessionId,
      type: 'subscribeNodeText'
    });
  }

  sendNodeTextUpdate(incidentId: string, sessionId: string, nodeId: string, update: Uint8Array, label: string): void {
    this.sendJson({
      incidentId,
      label,
      nodeId,
      sessionId,
      type: 'nodeTextUpdate',
      update: encodeBinaryUpdate(update)
    });
  }

  sendNodeLiveLabel(incidentId: string, sessionId: string, nodeId: string, label: string): void {
    this.sendJson({
      incidentId,
      label,
      nodeId,
      sessionId,
      type: 'nodeLiveLabelUpdate'
    });
  }

  sendNodeActivity(
    incidentId: string,
    sessionId: string,
    nodeId: string,
    activity: 'editing' | 'idle' | 'moving'
  ): void {
    this.sendJson({
      activity,
      incidentId,
      nodeId,
      sessionId,
      type: 'nodeActivity'
    });
  }

  private async authenticate(): Promise<void> {
    try {
      const user = getSynzappFirebaseAuth().currentUser;

      if (!user) {
        throw new Error('You are not signed in.');
      }

      const idToken = await user.getIdToken();
      this.sendJson({
        idToken,
        type: 'authenticate'
      });
    } catch (error) {
      this.emit({ error: getErrorMessage(error), type: 'error' });
      this.socket?.close();
    }
  }

  private handleMessage(payload: unknown): void {
    const message = parseRealtimeMessage(payload);

    if (!message) {
      return;
    }

    if (message.type === 'ready') {
      this.isAuthenticated = true;
      this.emit({ status: 'connected', type: 'status' });
      this.startHeartbeat();

      if (this.targetCanvas) {
        this.subscribeCanvas(this.targetCanvas.incidentId, this.targetCanvas.sessionId);
      }
      if (this.shouldSubscribeWorkspace) {
        this.subscribeWorkspace();
      }
      return;
    }

    if (message.type === 'canvasSubscribed') {
      this.subscribedCanvas = {
        incidentId: String(message.incidentId || ''),
        sessionId: String(message.sessionId || '')
      };
      this.emit({ status: 'subscribed', type: 'status' });
      this.emit({
        incidentId: this.subscribedCanvas.incidentId,
        nodes: Array.isArray(message.nodes) ? message.nodes as RcaNode[] : [],
        participants: Array.isArray(message.participants) ? message.participants as RcaRealtimePresenceUser[] : [],
        sessionId: this.subscribedCanvas.sessionId,
        type: 'canvasSnapshot'
      });
      return;
    }

    if (message.type === 'workspaceSubscribed') {
      return;
    }

    if (message.type === 'incidentMembershipChanged' && isRecord(message.incident)) {
      this.emit({
        action: message.action === 'DELETED'
          ? 'DELETED'
          : message.action === 'REMOVED'
            ? 'REMOVED'
            : message.action === 'UPDATED'
              ? 'UPDATED'
              : 'INVITED',
        actorUid: String(message.actorUid || ''),
        deletedAtIso: typeof message.deletedAtIso === 'string' ? message.deletedAtIso : null,
        incident: message.incident as unknown as RcaIncident,
        invitedUsers: Array.isArray(message.invitedUsers) ? message.invitedUsers as RcaUserSummary[] : [],
        removedAtIso: typeof message.removedAtIso === 'string' ? message.removedAtIso : null,
        removedUser: isRecord(message.removedUser) ? message.removedUser as unknown as RcaUserSummary : null,
        type: 'incidentMembershipChanged'
      });
      return;
    }

    if (message.type === 'presenceUpdated') {
      this.emit({
        participants: Array.isArray(message.participants) ? message.participants as RcaRealtimePresenceUser[] : [],
        type: 'presenceUpdated'
      });
      return;
    }

    if (message.type === 'activityLogCreated' && isRecord(message.log)) {
      this.emit({
        incidentId: String(message.incidentId || ''),
        log: message.log as unknown as RcaActivityLog,
        sessionId: String(message.sessionId || ''),
        type: 'activityLogCreated'
      });
      return;
    }

    if (message.type === 'nodeActivitiesUpdated') {
      this.emit({
        activities: Array.isArray(message.activities) ? message.activities as RcaNodeActivity[] : [],
        type: 'nodeActivitiesUpdated'
      });
      return;
    }

    if (message.type === 'nodeTextSync') {
      this.emit({
        incidentId: String(message.incidentId || ''),
        nodeId: String(message.nodeId || ''),
        sessionId: String(message.sessionId || ''),
        type: 'nodeTextSync',
        update: String(message.update || '')
      });
      return;
    }

    if (message.type === 'nodeTextUpdate') {
      this.emit({
        actorUid: String(message.actorUid || ''),
        incidentId: String(message.incidentId || ''),
        label: typeof message.label === 'string' ? message.label : null,
        nodeId: String(message.nodeId || ''),
        sessionId: String(message.sessionId || ''),
        type: 'nodeTextUpdate',
        update: String(message.update || '')
      });
      return;
    }

    if (message.type === 'nodeLiveLabelUpdated') {
      this.emit({
        actorUid: String(message.actorUid || ''),
        incidentId: String(message.incidentId || ''),
        label: String(message.label || ''),
        nodeId: String(message.nodeId || ''),
        sessionId: String(message.sessionId || ''),
        type: 'nodeLiveLabelUpdated'
      });
      return;
    }

    if (message.type === 'nodeCreated' && isRecord(message.node)) {
      const node = message.node as unknown as RcaNode;

      this.resolvePendingMutation(message.clientMutationId, node);
      this.emit({
        actorUid: String(message.actorUid || ''),
        clientMutationId: normalizeMutationId(message.clientMutationId),
        incidentId: String(message.incidentId || ''),
        node,
        sessionId: String(message.sessionId || ''),
        type: 'nodeCreated'
      });
      return;
    }

    if (message.type === 'nodeUpdated' && isRecord(message.node)) {
      const node = message.node as unknown as RcaNode;

      this.resolvePendingMutation(message.clientMutationId, node);
      this.emit({
        actorUid: String(message.actorUid || ''),
        clientMutationId: normalizeMutationId(message.clientMutationId),
        incidentId: String(message.incidentId || ''),
        node,
        sessionId: String(message.sessionId || ''),
        type: 'nodeUpdated'
      });
      return;
    }

    if (message.type === 'nodeDeleted') {
      this.resolvePendingMutation(message.clientMutationId, undefined);
      this.emit({
        actorUid: String(message.actorUid || ''),
        clientMutationId: normalizeMutationId(message.clientMutationId),
        incidentId: String(message.incidentId || ''),
        nodeId: String(message.nodeId || ''),
        sessionId: String(message.sessionId || ''),
        type: 'nodeDeleted'
      });
      return;
    }

    if (message.type === 'mutationRejected') {
      this.rejectPendingMutation(
        message.clientMutationId,
        new Error(String(message.error || 'The realtime RCA change was rejected.'))
      );
      return;
    }

    if (message.type === 'error') {
      this.emit({ error: String(message.error || 'RCA realtime collaboration is temporarily unavailable.'), type: 'error' });
    }
  }

  private sendMutation<T extends RcaNode | void>(payload: Record<string, unknown>): Promise<T> {
    const incidentId = String(payload.incidentId || '');
    const sessionId = String(payload.sessionId || '');

    if (!this.isReadyForCanvas(incidentId, sessionId)) {
      return Promise.reject(new Error('RCA realtime collaboration is not ready.'));
    }

    const clientMutationId = createRcaClientMutationId();

    return new Promise<T>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.pendingMutations.delete(clientMutationId);
        reject(new Error('The RCA realtime change took too long to save.'));
      }, RCA_REALTIME_MUTATION_TIMEOUT_MS);

      this.pendingMutations.set(clientMutationId, {
        reject,
        resolve: resolve as (value: RcaNode | void) => void,
        timeoutId
      });
      this.sendJson({
        ...stripUndefinedValues(payload),
        clientMutationId
      });
    });
  }

  private resolvePendingMutation(clientMutationId: unknown, value: RcaNode | void): void {
    const mutationId = normalizeMutationId(clientMutationId);

    if (!mutationId) {
      return;
    }

    const pendingMutation = this.pendingMutations.get(mutationId);

    if (!pendingMutation) {
      return;
    }

    window.clearTimeout(pendingMutation.timeoutId);
    this.pendingMutations.delete(mutationId);
    pendingMutation.resolve(value);
  }

  private rejectPendingMutation(clientMutationId: unknown, error: Error): void {
    const mutationId = normalizeMutationId(clientMutationId);

    if (!mutationId) {
      return;
    }

    const pendingMutation = this.pendingMutations.get(mutationId);

    if (!pendingMutation) {
      return;
    }

    window.clearTimeout(pendingMutation.timeoutId);
    this.pendingMutations.delete(mutationId);
    pendingMutation.reject(error);
  }

  private rejectPendingMutations(error: Error): void {
    this.pendingMutations.forEach((pendingMutation) => {
      window.clearTimeout(pendingMutation.timeoutId);
      pendingMutation.reject(error);
    });
    this.pendingMutations.clear();
  }

  private sendJson(payload: Record<string, unknown>): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(payload));
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimerId = window.setInterval(() => {
      this.sendJson({ type: 'presenceHeartbeat' });
    }, RCA_REALTIME_HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimerId === null) {
      return;
    }

    window.clearInterval(this.heartbeatTimerId);
    this.heartbeatTimerId = null;
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimerId !== null) {
      return;
    }

    this.reconnectTimerId = window.setTimeout(() => {
      this.reconnectTimerId = null;
      this.connect();
    }, RCA_REALTIME_RECONNECT_MS);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimerId === null) {
      return;
    }

    window.clearTimeout(this.reconnectTimerId);
    this.reconnectTimerId = null;
  }

  private emit(event: RcaRealtimeEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}

export const rcaRealtimeClient = new RcaRealtimeClient();

function buildRcaRealtimeUrl(): string {
  const apiBaseUrl = getSynzappApiBaseUrl();
  const url = new URL(apiBaseUrl);

  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/realtime/rca';
  url.search = '';

  return url.toString();
}

function parseRealtimeMessage(payload: unknown): Record<string, unknown> | null {
  if (typeof payload !== 'string') {
    return null;
  }

  try {
    const message = JSON.parse(payload);

    return isRecord(message) ? message : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeMutationId(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function createRcaClientMutationId(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();

  if (randomUuid) {
    return randomUuid;
  }

  const randomBytes = globalThis.crypto?.getRandomValues?.(new Uint8Array(12));
  const randomPart = randomBytes
    ? Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    : Math.random().toString(36).slice(2, 14);

  return `mutation_${Date.now().toString(36)}_${randomPart}`;
}

function stripUndefinedValues<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedValues(item)) as T;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, stripUndefinedValues(entryValue)])
  ) as T;
}

function encodeBinaryUpdate(update: Uint8Array): string {
  let binary = '';

  update.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window.btoa(binary);
}

export function decodeRcaRealtimeUpdate(update: string): Uint8Array {
  const binary = window.atob(update);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'RCA realtime collaboration is temporarily unavailable.';
}
