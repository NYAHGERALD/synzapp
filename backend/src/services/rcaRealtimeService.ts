import { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { DecodedIdToken } from 'firebase-admin/auth';
import { verifyFirebaseSession } from './authSessionService.js';
import {
  createRcaNode,
  deleteRcaNode,
  getRcaWorkspaceContext,
  listRcaActivityLogs,
  listRcaNodes,
  type RcaIncident,
  type RcaNode,
  type RcaNodeInput,
  type RcaUserSummary,
  updateRcaNode
} from './rcaService.js';

interface AuthenticateMessage {
  idToken?: string;
  type: 'authenticate';
}

interface SubscribeCanvasMessage {
  incidentId?: string;
  sessionId?: string;
  type: 'subscribeCanvas';
}

interface UnsubscribeCanvasMessage {
  type: 'unsubscribeCanvas';
}

interface SubscribeWorkspaceMessage {
  type: 'subscribeWorkspace';
}

interface PresenceHeartbeatMessage {
  type: 'presenceHeartbeat';
}

interface SubscribeNodeTextMessage {
  incidentId?: string;
  nodeId?: string;
  sessionId?: string;
  type: 'subscribeNodeText';
}

interface NodeTextUpdateMessage {
  incidentId?: string;
  label?: string;
  nodeId?: string;
  sessionId?: string;
  type: 'nodeTextUpdate';
  update?: string;
}

interface NodeLiveLabelUpdateMessage {
  incidentId?: string;
  label?: string;
  nodeId?: string;
  sessionId?: string;
  type: 'nodeLiveLabelUpdate';
}

interface NodeActivityMessage {
  activity?: 'editing' | 'idle' | 'moving';
  incidentId?: string;
  nodeId?: string;
  sessionId?: string;
  type: 'nodeActivity';
}

interface CreateNodeMessage {
  clientMutationId?: string;
  incidentId?: string;
  input?: RcaNodeInput;
  sessionId?: string;
  type: 'createNode';
}

interface UpdateNodeMessage {
  clientMutationId?: string;
  incidentId?: string;
  input?: RcaNodeInput;
  nodeId?: string;
  sessionId?: string;
  type: 'updateNode';
}

interface DeleteNodeMessage {
  clientMutationId?: string;
  incidentId?: string;
  nodeId?: string;
  sessionId?: string;
  type: 'deleteNode';
}

type RcaRealtimeClientMessage =
  | AuthenticateMessage
  | CreateNodeMessage
  | DeleteNodeMessage
  | NodeActivityMessage
  | NodeLiveLabelUpdateMessage
  | NodeTextUpdateMessage
  | PresenceHeartbeatMessage
  | SubscribeNodeTextMessage
  | SubscribeCanvasMessage
  | SubscribeWorkspaceMessage
  | UnsubscribeCanvasMessage
  | UpdateNodeMessage;

interface RcaRealtimePresenceUser extends RcaUserSummary {
  connectionCount: number;
  lastSeenAtIso: string;
}

const AUTHENTICATION_TIMEOUT_MS = 10_000;
const HEARTBEAT_STALE_MS = 45_000;
const NODE_TEXT_PERSIST_DEBOUNCE_MS = 650;
const rcaCanvasRooms = new Map<string, Set<RcaRealtimeConnection>>();
const rcaWorkspaceRooms = new Map<string, Set<RcaRealtimeConnection>>();
const nodeTextDocs = new Map<string, Y.Doc>();
const nodeTextPersistTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function attachRcaRealtimeServer(server: Server): void {
  const realtimeServer = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    if ((request as { __synzappRealtimeHandled?: boolean }).__synzappRealtimeHandled) {
      return;
    }

    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    if (url.pathname !== '/realtime/rca') {
      return;
    }

    (request as { __synzappRealtimeHandled?: boolean }).__synzappRealtimeHandled = true;

    realtimeServer.handleUpgrade(request, socket, head, (webSocket) => {
      realtimeServer.emit('connection', webSocket);
    });
  });

  realtimeServer.on('connection', (webSocket) => {
    const connection = new RcaRealtimeConnection(webSocket);
    connection.start();
  });
}

export function broadcastRcaMembershipChanged(input: {
  action: 'DELETED' | 'INVITED' | 'REMOVED' | 'UPDATED';
  actorUid: string;
  deletedAtIso?: string;
  incident: RcaIncident;
  invitedUsers?: RcaUserSummary[];
  removedAtIso?: string;
  removedUser?: RcaUserSummary;
}): void {
  const tenantId = input.incident.tenantId;
  const message = {
    action: input.action,
    actorUid: input.actorUid,
    deletedAtIso: input.deletedAtIso || null,
    incident: input.incident,
    invitedUsers: input.invitedUsers || [],
    removedAtIso: input.removedAtIso || null,
    removedUser: input.removedUser || null,
    type: 'incidentMembershipChanged'
  };
  const allowedUids = new Set<string>([
    input.incident.createdByUid,
    ...input.incident.collaborators.map((user) => user.uid),
    ...(input.invitedUsers || []).map((user) => user.uid),
    input.removedUser?.uid || ''
  ].filter(Boolean));
  const workspaceRoom = rcaWorkspaceRooms.get(tenantId);

  workspaceRoom?.forEach((connection) => {
    const uid = connection.getUid();

    if (uid && allowedUids.has(uid)) {
      connection.sendJson(message);
    }
  });

  if (input.incident.activeSessionId) {
    broadcastToRoom(getRoomKey(tenantId, input.incident.id, input.incident.activeSessionId), message);
  }
}

export async function broadcastRcaNodeCreated(input: {
  actorUid: string;
  incidentId: string;
  node: RcaNode;
  sessionId: string;
  tenantId: string;
}): Promise<void> {
  const roomKey = getRoomKey(input.tenantId, input.incidentId, input.sessionId);

  broadcastToRoom(roomKey, {
    actorUid: input.actorUid,
    clientMutationId: null,
    incidentId: input.incidentId,
    node: input.node,
    sessionId: input.sessionId,
    type: 'nodeCreated'
  });
  await broadcastLatestActivityLogToRoom(roomKey, input.actorUid, input.incidentId, input.sessionId);
}

export async function broadcastRcaNodeUpdated(input: {
  actorUid: string;
  incidentId: string;
  node: RcaNode;
  sessionId: string;
  tenantId: string;
}): Promise<void> {
  const roomKey = getRoomKey(input.tenantId, input.incidentId, input.sessionId);

  broadcastToRoom(roomKey, {
    actorUid: input.actorUid,
    clientMutationId: null,
    incidentId: input.incidentId,
    node: input.node,
    sessionId: input.sessionId,
    type: 'nodeUpdated'
  });
  await broadcastLatestActivityLogToRoom(roomKey, input.actorUid, input.incidentId, input.sessionId);
}

export async function broadcastRcaNodeDeleted(input: {
  actorUid: string;
  incidentId: string;
  nodeId: string;
  sessionId: string;
  tenantId: string;
}): Promise<void> {
  const roomKey = getRoomKey(input.tenantId, input.incidentId, input.sessionId);

  broadcastToRoom(roomKey, {
    actorUid: input.actorUid,
    clientMutationId: null,
    incidentId: input.incidentId,
    nodeId: input.nodeId,
    sessionId: input.sessionId,
    type: 'nodeDeleted'
  });
  await broadcastLatestActivityLogToRoom(roomKey, input.actorUid, input.incidentId, input.sessionId);
}

export async function broadcastRcaActivityLogCreated(input: {
  actorUid: string;
  incidentId: string;
  sessionId: string;
  tenantId: string;
}): Promise<void> {
  await broadcastLatestActivityLogToRoom(
    getRoomKey(input.tenantId, input.incidentId, input.sessionId),
    input.actorUid,
    input.incidentId,
    input.sessionId
  );
}

class RcaRealtimeConnection {
  private authTimeout: ReturnType<typeof setTimeout> | null = null;
  private cleanedUp = false;
  private decodedToken: DecodedIdToken | null = null;
  private displayUser: RcaUserSummary | null = null;
  private lastSeenAtIso = new Date().toISOString();
  private nodeActivities = new Map<string, 'editing' | 'moving'>();
  private subscribedRoomKey: string | null = null;
  private subscribedWorkspaceKey: string | null = null;
  private tenantId: string | null = null;

  constructor(private readonly webSocket: WebSocket) {}

  start(): void {
    this.authTimeout = setTimeout(() => {
      this.closeWithError('Your RCA realtime session could not be verified.', 'SESSION_UNVERIFIED');
    }, AUTHENTICATION_TIMEOUT_MS);

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

  getPresenceUser(): RcaRealtimePresenceUser | null {
    if (!this.displayUser) {
      return null;
    }

    return {
      ...this.displayUser,
      connectionCount: 1,
      lastSeenAtIso: this.lastSeenAtIso
    };
  }

  getNodeActivities(): Map<string, 'editing' | 'moving'> {
    return this.nodeActivities;
  }

  getUid(): string | null {
    return this.displayUser?.uid || null;
  }

  getDecodedToken(): DecodedIdToken | null {
    return this.decodedToken;
  }

  private async handleMessage(payload: string): Promise<void> {
    const message = this.parseMessage(payload);

    if (!message) {
      this.sendError('Realtime message was not understood.');
      return;
    }

    if (message.type === 'authenticate') {
      await this.authenticate(message.idToken || '');
      return;
    }

    if (!this.decodedToken) {
      this.sendError('Realtime session is not authenticated.');
      return;
    }

    this.lastSeenAtIso = new Date().toISOString();

    if (message.type === 'subscribeCanvas') {
      await this.subscribeCanvas(message.incidentId || '', message.sessionId || '');
      return;
    }

    if (message.type === 'unsubscribeCanvas') {
      this.unsubscribeCanvas();
      return;
    }

    if (message.type === 'subscribeWorkspace') {
      this.subscribeWorkspace();
      return;
    }

    if (message.type === 'presenceHeartbeat') {
      this.broadcastPresence();
      return;
    }

    if (message.type === 'subscribeNodeText') {
      await this.subscribeNodeText(message);
      return;
    }

    if (message.type === 'nodeTextUpdate') {
      await this.applyNodeTextUpdate(message);
      return;
    }

    if (message.type === 'nodeLiveLabelUpdate') {
      await this.applyNodeLiveLabelUpdate(message);
      return;
    }

    if (message.type === 'nodeActivity') {
      this.updateNodeActivity(message);
      return;
    }

    if (message.type === 'createNode') {
      await this.createNode(message);
      return;
    }

    if (message.type === 'updateNode') {
      await this.updateNode(message);
      return;
    }

    if (message.type === 'deleteNode') {
      await this.deleteNode(message);
    }
  }

  private parseMessage(payload: string): RcaRealtimeClientMessage | null {
    try {
      const message = JSON.parse(payload) as Partial<RcaRealtimeClientMessage>;

      if (
        message.type === 'authenticate' ||
        message.type === 'createNode' ||
        message.type === 'deleteNode' ||
        message.type === 'nodeActivity' ||
        message.type === 'nodeLiveLabelUpdate' ||
        message.type === 'nodeTextUpdate' ||
        message.type === 'presenceHeartbeat' ||
        message.type === 'subscribeNodeText' ||
        message.type === 'subscribeCanvas' ||
        message.type === 'subscribeWorkspace' ||
        message.type === 'unsubscribeCanvas' ||
        message.type === 'updateNode'
      ) {
        return message as RcaRealtimeClientMessage;
      }
    } catch {
      return null;
    }

    return null;
  }

  private async authenticate(idToken: string): Promise<void> {
    try {
      const decodedToken = await verifyFirebaseSession(idToken);
      const context = await getRcaWorkspaceContext(decodedToken);

      this.decodedToken = decodedToken;
      this.tenantId = context.company.tenantId;
      this.displayUser = {
        departmentName: context.department.name,
        displayName: context.user.displayName,
        profilePhotoCacheKey: null,
        profilePhotoUrl: null,
        roleName: context.user.roleName,
        uid: context.user.uid
      };

      if (this.authTimeout) {
        clearTimeout(this.authTimeout);
        this.authTimeout = null;
      }

      this.sendJson({
        tenantId: this.tenantId,
        type: 'ready',
        user: this.displayUser
      });
    } catch {
      this.closeWithError('Your RCA realtime session could not be verified.', 'SESSION_UNVERIFIED');
    }
  }

  private async subscribeCanvas(incidentId: string, sessionId: string): Promise<void> {
    if (!this.decodedToken || !this.tenantId) {
      this.sendError('Realtime session is not authenticated.');
      return;
    }

    try {
      const { nodes } = await listRcaNodes(this.decodedToken, incidentId, sessionId);
      const roomKey = getRoomKey(this.tenantId, incidentId, sessionId);

      this.unsubscribeCanvas();
      this.subscribedRoomKey = roomKey;
      getRoom(roomKey).add(this);
      this.sendJson({
        incidentId,
        nodes,
        participants: getRoomPresence(roomKey),
        sessionId,
        type: 'canvasSubscribed'
      });
      this.broadcastPresence();
    } catch (error) {
      this.sendMutationRejected(undefined, getErrorMessage(error));
    }
  }

  private subscribeWorkspace(): void {
    if (!this.tenantId) {
      this.sendError('Realtime workspace session is not authenticated.');
      return;
    }

    if (this.subscribedWorkspaceKey === this.tenantId) {
      return;
    }

    this.unsubscribeWorkspace();
    this.subscribedWorkspaceKey = this.tenantId;
    getWorkspaceRoom(this.tenantId).add(this);
    this.sendJson({ type: 'workspaceSubscribed' });
  }

  private async createNode(message: CreateNodeMessage): Promise<void> {
    if (!this.decodedToken) {
      this.sendError('Realtime session is not authenticated.');
      return;
    }

    try {
      this.assertSubscribedToCanvas(message.incidentId || '', message.sessionId || '');
      const node = await createRcaNode(
        this.decodedToken,
        message.incidentId || '',
        message.sessionId || '',
        message.input || {}
      );

      this.broadcastToRoom({
        actorUid: this.decodedToken.uid,
        clientMutationId: message.clientMutationId || null,
        incidentId: message.incidentId,
        node,
        sessionId: message.sessionId,
        type: 'nodeCreated'
      });
      await this.broadcastLatestActivityLog(message.incidentId || '', message.sessionId || '');
    } catch (error) {
      this.sendMutationRejected(message.clientMutationId, getErrorMessage(error));
    }
  }

  private async subscribeNodeText(message: SubscribeNodeTextMessage): Promise<void> {
    if (!this.decodedToken || !message.nodeId) {
      this.sendError('Realtime session is not authenticated.');
      return;
    }

    try {
      this.assertSubscribedToCanvas(message.incidentId || '', message.sessionId || '');
      const doc = await this.getNodeTextDoc(message.incidentId || '', message.sessionId || '', message.nodeId);

      this.sendJson({
        incidentId: message.incidentId,
        nodeId: message.nodeId,
        sessionId: message.sessionId,
        type: 'nodeTextSync',
        update: encodeBinaryUpdate(Y.encodeStateAsUpdate(doc))
      });
    } catch (error) {
      this.sendMutationRejected(undefined, getErrorMessage(error));
    }
  }

  private async applyNodeTextUpdate(message: NodeTextUpdateMessage): Promise<void> {
    if (!this.decodedToken || !message.nodeId || !message.update) {
      this.sendError('Realtime text update was not understood.');
      return;
    }

    try {
      this.assertSubscribedToCanvas(message.incidentId || '', message.sessionId || '');
      const doc = await this.getNodeTextDoc(message.incidentId || '', message.sessionId || '', message.nodeId);
      const update = decodeBinaryUpdate(message.update);

      Y.applyUpdate(doc, update);
      this.broadcastToRoom({
        actorUid: this.decodedToken.uid,
        incidentId: message.incidentId,
        label: typeof message.label === 'string' ? message.label : doc.getText('label').toString(),
        nodeId: message.nodeId,
        sessionId: message.sessionId,
        type: 'nodeTextUpdate',
        update: message.update
      });
      this.scheduleNodeTextPersist(message.incidentId || '', message.sessionId || '', message.nodeId, doc);
    } catch (error) {
      this.sendMutationRejected(undefined, getErrorMessage(error));
    }
  }

  private async applyNodeLiveLabelUpdate(message: NodeLiveLabelUpdateMessage): Promise<void> {
    if (!this.decodedToken || !message.nodeId || typeof message.label !== 'string') {
      this.sendError('Realtime label update was not understood.');
      return;
    }

    try {
      this.assertSubscribedToCanvas(message.incidentId || '', message.sessionId || '');
      this.broadcastToRoom({
        actorUid: this.decodedToken.uid,
        incidentId: message.incidentId,
        label: message.label,
        nodeId: message.nodeId,
        sessionId: message.sessionId,
        type: 'nodeLiveLabelUpdated'
      });
      this.schedulePlainLabelPersist(message.incidentId || '', message.sessionId || '', message.nodeId, message.label);
    } catch (error) {
      this.sendMutationRejected(undefined, getErrorMessage(error));
    }
  }

  private updateNodeActivity(message: NodeActivityMessage): void {
    try {
      this.assertSubscribedToCanvas(message.incidentId || '', message.sessionId || '');
    } catch {
      return;
    }

    const nodeId = message.nodeId || '';

    if (!nodeId) {
      return;
    }

    if (message.activity === 'editing' || message.activity === 'moving') {
      this.nodeActivities.set(nodeId, message.activity);
    } else {
      this.nodeActivities.delete(nodeId);
    }

    this.broadcastNodeActivities();
  }

  private async getNodeTextDoc(incidentId: string, sessionId: string, nodeId: string): Promise<Y.Doc> {
    const docKey = getNodeTextKey(this.tenantId || '', incidentId, sessionId, nodeId);
    const existingDoc = nodeTextDocs.get(docKey);

    if (existingDoc) {
      return existingDoc;
    }

    if (!this.decodedToken) {
      throw validationError('Realtime session is not authenticated.');
    }

    const { nodes } = await listRcaNodes(this.decodedToken, incidentId, sessionId);
    const node = nodes.find((candidateNode) => candidateNode.id === nodeId);

    if (!node) {
      throw validationError('This RCA node was not found.');
    }

    const doc = new Y.Doc();
    const text = doc.getText('label');

    if (node.label) {
      text.insert(0, node.label);
    }

    nodeTextDocs.set(docKey, doc);

    return doc;
  }

  private scheduleNodeTextPersist(incidentId: string, sessionId: string, nodeId: string, doc: Y.Doc): void {
    if (!this.decodedToken || !this.tenantId) {
      return;
    }

    const docKey = getNodeTextKey(this.tenantId, incidentId, sessionId, nodeId);
    const existingTimer = nodeTextPersistTimers.get(docKey);

    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const decodedToken = this.decodedToken;
    const timer = setTimeout(() => {
      nodeTextPersistTimers.delete(docKey);
      void updateRcaNode(decodedToken, incidentId, sessionId, nodeId, {
        label: doc.getText('label').toString()
      }).then((node) => {
        this.broadcastToRoom({
          actorUid: decodedToken.uid,
          clientMutationId: null,
          incidentId,
          node,
          sessionId,
          type: 'nodeUpdated'
        });
        void this.broadcastLatestActivityLog(incidentId, sessionId);
      }).catch(() => {
        this.sendError('Realtime text changes could not be saved.');
      });
    }, NODE_TEXT_PERSIST_DEBOUNCE_MS);

    nodeTextPersistTimers.set(docKey, timer);
  }

  private schedulePlainLabelPersist(incidentId: string, sessionId: string, nodeId: string, label: string): void {
    if (!this.decodedToken || !this.tenantId) {
      return;
    }

    const docKey = getNodeTextKey(this.tenantId, incidentId, sessionId, nodeId);
    const existingTimer = nodeTextPersistTimers.get(docKey);

    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const decodedToken = this.decodedToken;
    const timer = setTimeout(() => {
      nodeTextPersistTimers.delete(docKey);
      void updateRcaNode(decodedToken, incidentId, sessionId, nodeId, { label }).then((node) => {
        this.broadcastToRoom({
          actorUid: decodedToken.uid,
          clientMutationId: null,
          incidentId,
          node,
          sessionId,
          type: 'nodeUpdated'
        });
        void this.broadcastLatestActivityLog(incidentId, sessionId);
      }).catch(() => {
        this.sendError('Realtime label changes could not be saved.');
      });
    }, NODE_TEXT_PERSIST_DEBOUNCE_MS);

    nodeTextPersistTimers.set(docKey, timer);
  }

  private async updateNode(message: UpdateNodeMessage): Promise<void> {
    if (!this.decodedToken) {
      this.sendError('Realtime session is not authenticated.');
      return;
    }

    try {
      this.assertSubscribedToCanvas(message.incidentId || '', message.sessionId || '');
      const node = await updateRcaNode(
        this.decodedToken,
        message.incidentId || '',
        message.sessionId || '',
        message.nodeId || '',
        message.input || {}
      );

      this.broadcastToRoom({
        actorUid: this.decodedToken.uid,
        clientMutationId: message.clientMutationId || null,
        incidentId: message.incidentId,
        node,
        sessionId: message.sessionId,
        type: 'nodeUpdated'
      });
      await this.broadcastLatestActivityLog(message.incidentId || '', message.sessionId || '');
    } catch (error) {
      this.sendMutationRejected(message.clientMutationId, getErrorMessage(error));
    }
  }

  private async deleteNode(message: DeleteNodeMessage): Promise<void> {
    if (!this.decodedToken) {
      this.sendError('Realtime session is not authenticated.');
      return;
    }

    try {
      this.assertSubscribedToCanvas(message.incidentId || '', message.sessionId || '');
      await deleteRcaNode(
        this.decodedToken,
        message.incidentId || '',
        message.sessionId || '',
        message.nodeId || ''
      );

      this.broadcastToRoom({
        actorUid: this.decodedToken.uid,
        clientMutationId: message.clientMutationId || null,
        incidentId: message.incidentId,
        nodeId: message.nodeId,
        sessionId: message.sessionId,
        type: 'nodeDeleted'
      });
      await this.broadcastLatestActivityLog(message.incidentId || '', message.sessionId || '');
    } catch (error) {
      this.sendMutationRejected(message.clientMutationId, getErrorMessage(error));
    }
  }

  private assertSubscribedToCanvas(incidentId: string, sessionId: string): void {
    const expectedRoomKey = this.tenantId ? getRoomKey(this.tenantId, incidentId, sessionId) : '';

    if (!this.subscribedRoomKey || this.subscribedRoomKey !== expectedRoomKey) {
      throw validationError('Open this RCA canvas before editing it in realtime.');
    }
  }

  private unsubscribeCanvas(): void {
    if (!this.subscribedRoomKey) {
      return;
    }

    const roomKey = this.subscribedRoomKey;
    const room = rcaCanvasRooms.get(roomKey);

    room?.delete(this);
    this.nodeActivities.clear();

    if (!room?.size) {
      rcaCanvasRooms.delete(roomKey);
    } else {
      broadcastToRoom(roomKey, {
        participants: getRoomPresence(roomKey),
        type: 'presenceUpdated'
      });
      broadcastNodeActivities(roomKey);
    }

    this.subscribedRoomKey = null;
  }

  private unsubscribeWorkspace(): void {
    if (!this.subscribedWorkspaceKey) {
      return;
    }

    const roomKey = this.subscribedWorkspaceKey;
    const room = rcaWorkspaceRooms.get(roomKey);

    room?.delete(this);

    if (!room?.size) {
      rcaWorkspaceRooms.delete(roomKey);
    }

    this.subscribedWorkspaceKey = null;
  }

  private broadcastPresence(): void {
    if (!this.subscribedRoomKey) {
      return;
    }

    broadcastToRoom(this.subscribedRoomKey, {
      participants: getRoomPresence(this.subscribedRoomKey),
      type: 'presenceUpdated'
    });
  }

  private broadcastNodeActivities(): void {
    if (!this.subscribedRoomKey) {
      return;
    }

    broadcastNodeActivities(this.subscribedRoomKey);
  }

  private broadcastToRoom(message: Record<string, unknown>): void {
    if (!this.subscribedRoomKey) {
      return;
    }

    broadcastToRoom(this.subscribedRoomKey, message);
  }

  private async broadcastLatestActivityLog(incidentId: string, sessionId: string): Promise<void> {
    if (!this.decodedToken) {
      return;
    }

    try {
      const { logs } = await listRcaActivityLogs(this.decodedToken, incidentId, sessionId);
      const latestLog = logs[0];

      if (!latestLog) {
        return;
      }

      this.broadcastToRoom({
        incidentId,
        log: latestLog,
        sessionId,
        type: 'activityLogCreated'
      });
    } catch {
      this.sendError('RCA activity log could not be refreshed.');
    }
  }

  private sendMutationRejected(clientMutationId: string | undefined, error: string): void {
    this.sendJson({
      clientMutationId: clientMutationId || null,
      error,
      type: 'mutationRejected'
    });
  }

  private sendError(error: string): void {
    this.sendJson({ error, type: 'error' });
  }

  private closeWithError(error: string, code: string): void {
    this.sendJson({ code, error, type: 'error' });
    this.webSocket.close();
    this.cleanup();
  }

  sendJson(message: Record<string, unknown>): void {
    if (this.webSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.webSocket.send(JSON.stringify(message));
  }

  private cleanup(): void {
    if (this.cleanedUp) {
      return;
    }

    this.cleanedUp = true;

    if (this.authTimeout) {
      clearTimeout(this.authTimeout);
      this.authTimeout = null;
    }

    this.unsubscribeCanvas();
    this.unsubscribeWorkspace();
  }
}

function getRoom(roomKey: string): Set<RcaRealtimeConnection> {
  const existingRoom = rcaCanvasRooms.get(roomKey);

  if (existingRoom) {
    return existingRoom;
  }

  const room = new Set<RcaRealtimeConnection>();
  rcaCanvasRooms.set(roomKey, room);

  return room;
}

function getWorkspaceRoom(tenantId: string): Set<RcaRealtimeConnection> {
  const existingRoom = rcaWorkspaceRooms.get(tenantId);

  if (existingRoom) {
    return existingRoom;
  }

  const room = new Set<RcaRealtimeConnection>();
  rcaWorkspaceRooms.set(tenantId, room);

  return room;
}

function getRoomPresence(roomKey: string): RcaRealtimePresenceUser[] {
  const now = Date.now();
  const room = rcaCanvasRooms.get(roomKey);
  const usersByUid = new Map<string, RcaRealtimePresenceUser>();

  room?.forEach((connection) => {
    const user = connection.getPresenceUser();

    if (!user) {
      return;
    }

    const lastSeenMs = Date.parse(user.lastSeenAtIso);

    if (Number.isFinite(lastSeenMs) && now - lastSeenMs > HEARTBEAT_STALE_MS) {
      return;
    }

    const existingUser = usersByUid.get(user.uid);

    if (existingUser) {
      existingUser.connectionCount += 1;
      if (user.lastSeenAtIso > existingUser.lastSeenAtIso) {
        existingUser.lastSeenAtIso = user.lastSeenAtIso;
      }
      return;
    }

    usersByUid.set(user.uid, user);
  });

  return [...usersByUid.values()].sort((first, second) => first.displayName.localeCompare(second.displayName));
}

function broadcastToRoom(roomKey: string, message: Record<string, unknown>): void {
  const room = rcaCanvasRooms.get(roomKey);

  room?.forEach((connection) => {
    connection.sendJson(message);
  });
}

function broadcastNodeActivities(roomKey: string): void {
  const room = rcaCanvasRooms.get(roomKey);
  const activities: Array<{
    activity: 'editing' | 'moving';
    nodeId: string;
    user: RcaUserSummary;
  }> = [];

  room?.forEach((connection) => {
    const user = connection.getPresenceUser();

    if (!user) {
      return;
    }

    connection.getNodeActivities().forEach((activity, nodeId) => {
      activities.push({
        activity,
        nodeId,
        user
      });
    });
  });

  broadcastToRoom(roomKey, {
    activities,
    type: 'nodeActivitiesUpdated'
  });
}

async function broadcastLatestActivityLogToRoom(
  roomKey: string,
  actorUid: string,
  incidentId: string,
  sessionId: string
): Promise<void> {
  const room = rcaCanvasRooms.get(roomKey);
  const connection = [...(room || [])].find((candidateConnection) => candidateConnection.getUid() === actorUid) ||
    [...(room || [])][0];

  if (!connection) {
    return;
  }

  try {
    const decodedToken = connection.getDecodedToken();

    if (!decodedToken) {
      return;
    }

    const { logs } = await listRcaActivityLogs(decodedToken, incidentId, sessionId);
    const latestLog = logs[0];

    if (!latestLog) {
      return;
    }

    broadcastToRoom(roomKey, {
      incidentId,
      log: latestLog,
      sessionId,
      type: 'activityLogCreated'
    });
  } catch {
    // Realtime node state is authoritative; log refresh failures should not block canvas updates.
  }
}

function getRoomKey(tenantId: string, incidentId: string, sessionId: string): string {
  return `${tenantId}:${incidentId}:${sessionId}`;
}

function getNodeTextKey(tenantId: string, incidentId: string, sessionId: string, nodeId: string): string {
  return `${getRoomKey(tenantId, incidentId, sessionId)}:${nodeId}:label`;
}

function encodeBinaryUpdate(update: Uint8Array): string {
  return Buffer.from(update).toString('base64');
}

function decodeBinaryUpdate(update: string): Uint8Array {
  return new Uint8Array(Buffer.from(update, 'base64'));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'RCA realtime collaboration is temporarily unavailable.';
}

function validationError(message: string): Error {
  const error = new Error(message);
  error.name = 'ValidationError';

  return error;
}
