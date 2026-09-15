import { Server } from 'node:http';
import { REALTIME_MAX_PAYLOAD_BYTES } from './realtimeLimits.js';
import { WebSocket, WebSocketServer } from 'ws';
import { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth, firestore } from '../config/firebaseAdmin.js';
import {
  type ChatContact,
  DirectChatRecord,
  getCurrentUserProfile,
  getDirectChatContact,
  getDirectChatMessageReactions,
  getDirectChatRealtimeContext,
  listCurrentUserChatContacts,
  mapDirectChatMessageReactions,
  markDirectChatRead,
  shouldIncludeDirectChatContactInChatList
} from './userProfileService.js';
import { verifyActiveRegisteredDevice } from './deviceIdentityService.js';
import {
  listEncryptedDirectEnvelopesForDevice,
  markEncryptedDirectEnvelopesDeliveredForDevice
} from './encryptedMessageEnvelopeService.js';
import {
  type GroupChatContact,
  getGroupChatContact,
  getGroupChatMessageReactions,
  getGroupChatRealtimeContext,
  listCurrentUserGroupChatContacts,
  listEncryptedGroupEnvelopesForDevice
} from './groupChatService.js';
import {
  markChatUserOffline,
  markChatUserOnline,
  subscribeChatPresenceUpdates,
  touchChatUserPresence
} from './chatPresenceService.js';
import {
  canSeeTypingUpdate,
  clearAllChatTypingForUser,
  clearChatUserTyping,
  markChatUserTyping,
  subscribeChatTypingUpdates
} from './chatTypingService.js';

type FirestoreUnsubscribe = () => void;

interface AuthenticateMessage {
  deviceId?: string;
  idToken?: string;
  type: 'authenticate';
}

interface SubscribeConversationMessage {
  contactId?: string;
  type: 'subscribeConversation';
}

/**
 * Somebody is typing, or has stopped.
 *
 * `contactId` is the conversation from the sender's point of view: the person
 * they are writing to, or the group. The server turns that into who may be told
 * — the client never decides its own audience.
 */
interface TypingMessage {
  chatType?: 'DIRECT' | 'GROUP';
  contactId?: string;
  isTyping?: boolean;
  type: 'typing';
}

interface UnsubscribeConversationMessage {
  type: 'unsubscribeConversation';
}

interface PresenceHeartbeatMessage {
  type: 'presenceHeartbeat';
}

type RealtimeErrorCode = 'SESSION_UNVERIFIED';

type RealtimeClientMessage =
  | AuthenticateMessage
  | PresenceHeartbeatMessage
  | SubscribeConversationMessage
  | TypingMessage
  | UnsubscribeConversationMessage;

export function attachChatRealtimeServer(server: Server): void {
  const realtimeServer = new WebSocketServer({
    // Bounded. The ws default is 100 MiB per frame, against an 8 MB limit on
    // the HTTP side, and this socket bypasses the Express middleware chain
    // entirely. See realtimeLimits.ts for what each socket actually carries.
    maxPayload: REALTIME_MAX_PAYLOAD_BYTES,
    noServer: true
  });

  server.on('upgrade', (request, socket, head) => {
    if ((request as { __synzappRealtimeHandled?: boolean }).__synzappRealtimeHandled) {
      return;
    }

    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    if (url.pathname !== '/realtime/chat') {
      return;
    }

    (request as { __synzappRealtimeHandled?: boolean }).__synzappRealtimeHandled = true;

    realtimeServer.handleUpgrade(request, socket, head, (webSocket) => {
      realtimeServer.emit('connection', webSocket);
    });
  });

  realtimeServer.on('connection', (webSocket) => {
    const connection = new ChatRealtimeConnection(webSocket);
    connection.start();
  });
}

class ChatRealtimeConnection {
  private authTimeout: ReturnType<typeof setTimeout> | null = null;
  private cleanedUp = false;
  private contactSummaryUnsubscribes: FirestoreUnsubscribe[] = [];
  private conversationUnsubscribe: FirestoreUnsubscribe | null = null;
  private decodedToken: DecodedIdToken | null = null;
  private deviceId: string | null = null;
  private presenceUnsubscribe: (() => void) | null = null;
  private tenantId: string | null = null;
  private visibleContactIds = new Set<string>();
  private typingUnsubscribe: (() => void) | null = null;
  private displayName = '';

  constructor(private readonly webSocket: WebSocket) {}

  start(): void {
    this.authTimeout = setTimeout(() => {
      this.closeWithError('Your realtime session could not be verified.', 'SESSION_UNVERIFIED');
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

  private async handleMessage(payload: string): Promise<void> {
    const message = this.parseMessage(payload);

    if (!message) {
      this.sendError('Realtime message was not understood.');
      return;
    }

    if (message.type === 'authenticate') {
      await this.authenticate(message.idToken || '', message.deviceId || '');
      return;
    }

    if (!this.decodedToken || !this.deviceId) {
      this.sendError('Realtime session is not authenticated.');
      return;
    }

    if (message.type === 'subscribeConversation') {
      await this.subscribeConversation(message.contactId || '');
      return;
    }

    if (message.type === 'presenceHeartbeat') {
      if (this.tenantId) {
        touchChatUserPresence(this.decodedToken.uid, this.tenantId);
      }
      return;
    }

    if (message.type === 'typing') {
      this.handleTyping(message);
      return;
    }

    if (message.type === 'unsubscribeConversation') {
      this.unsubscribeConversation();
    }
  }

  private parseMessage(payload: string): RealtimeClientMessage | null {
    try {
      const message = JSON.parse(payload) as Partial<RealtimeClientMessage>;

      if (
        message.type === 'authenticate' ||
        message.type === 'presenceHeartbeat' ||
        message.type === 'subscribeConversation' ||
        message.type === 'typing' ||
        message.type === 'unsubscribeConversation'
      ) {
        return message as RealtimeClientMessage;
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
      const profile = await getCurrentUserProfile(decodedToken);

      this.decodedToken = decodedToken;
      this.deviceId = activeDevice.deviceId;
      this.tenantId = profile.tenantId;
      this.displayName = profile.displayName || 'Someone';

      if (this.authTimeout) {
        clearTimeout(this.authTimeout);
        this.authTimeout = null;
      }

      await this.subscribeContactSummaries();
      this.subscribePresenceUpdates();
      this.subscribeTypingUpdates();
      markChatUserOnline(decodedToken.uid, profile.tenantId);
      this.sendJson({ type: 'ready' });
    } catch {
      this.closeWithError('Your realtime session could not be verified.', 'SESSION_UNVERIFIED');
    }
  }

  private async subscribeContactSummaries(): Promise<void> {
    if (!this.decodedToken || !this.tenantId || !this.deviceId) {
      return;
    }

    this.unsubscribeContactSummaries();

    try {
      const [contacts, groupContacts] = await Promise.all([
        listCurrentUserChatContacts(this.decodedToken, { includeDirectoryContacts: true }),
        listCurrentUserGroupChatContacts(this.decodedToken, this.deviceId)
      ]);

      this.visibleContactIds = new Set([
        ...contacts.map((contact) => contact.contactId),
        ...groupContacts.map((contact) => contact.contactId)
      ]);
      this.contactSummaryUnsubscribes = [
        ...contacts.map((contact) =>
          firestore
            .collection('organizations')
            .doc(this.tenantId!)
            .collection('directChats')
            .doc(contact.conversationId)
            .onSnapshot((snapshot) => {
              if (!snapshot.exists) {
                return;
              }

              void this.sendDirectContactSummary(contact.contactId, snapshot.data() as DirectChatRecord);
            }, () => {
              this.sendError('Realtime chat updates are temporarily unavailable.');
            })
        ),
        ...groupContacts.map((contact) =>
          firestore
            .collection('organizations')
            .doc(this.tenantId!)
            .collection('groups')
            .doc(contact.contactId)
            .onSnapshot((snapshot) => {
              if (!snapshot.exists) {
                return;
              }

              void this.sendGroupContactSummary(contact.contactId);
            }, () => {
              this.sendError('Realtime group chat updates are temporarily unavailable.');
            })
        )
      ];
      contacts.forEach((contact) => {
        this.sendJson({
          contactId: contact.contactId,
          isOnline: contact.isOnline,
          lastSeenAt: contact.lastSeenAt,
          type: 'contactPresenceUpdated'
        });
      });
    } catch {
      this.visibleContactIds = new Set();
      this.sendError('Realtime chat updates are temporarily unavailable.');
    }
  }

  private unsubscribeContactSummaries(): void {
    this.contactSummaryUnsubscribes.forEach((unsubscribe) => unsubscribe());
    this.contactSummaryUnsubscribes = [];
    this.visibleContactIds = new Set();
  }

  private subscribePresenceUpdates(): void {
    this.unsubscribePresenceUpdates();

    this.presenceUnsubscribe = subscribeChatPresenceUpdates((update) => {
      if (!this.decodedToken || !this.tenantId) {
        return;
      }

      if (
        update.tenantId !== this.tenantId ||
        update.contactId === this.decodedToken.uid ||
        !this.visibleContactIds.has(update.contactId)
      ) {
        return;
      }

      this.sendJson({
        contactId: update.contactId,
        isOnline: update.isOnline,
        lastSeenAt: update.lastSeenAt,
        type: 'contactPresenceUpdated'
      });
    });
  }

  /**
   * Records that this person is typing, and decides who may be told.
   *
   * The audience is worked out here rather than trusted from the client: a
   * direct chat names its one recipient, and a group is left to the reader's
   * own view of it, which is the same question as membership. A client that
   * asked to broadcast to everybody would be ignored.
   */
  private handleTyping(message: TypingMessage): void {
    if (!this.decodedToken || !this.tenantId) {
      return;
    }

    const contactId = (message.contactId || '').trim();

    // Only for a conversation this person can actually see. Without it, a
    // crafted message could announce typing into somebody else's chat.
    if (!contactId || !this.visibleContactIds.has(contactId)) {
      return;
    }

    const chatType = message.chatType === 'GROUP' ? 'GROUP' : 'DIRECT';

    if (!message.isTyping) {
      clearChatUserTyping(this.decodedToken.uid, chatType === 'GROUP' ? contactId : this.decodedToken.uid);
      return;
    }

    markChatUserTyping({
      chatType,
      // What the reader's own chat list keys it by: in a direct chat that is
      // the typist, not the person being written to.
      conversationKey: chatType === 'GROUP' ? contactId : this.decodedToken.uid,
      recipientUids: chatType === 'GROUP' ? null : [contactId],
      tenantId: this.tenantId,
      typingName: this.displayName || 'Someone',
      typingUid: this.decodedToken.uid
    });
  }

  private subscribeTypingUpdates(): void {
    this.unsubscribeTypingUpdates();

    this.typingUnsubscribe = subscribeChatTypingUpdates((update) => {
      if (!this.decodedToken || !this.tenantId) {
        return;
      }

      if (!canSeeTypingUpdate({
        readerTenantId: this.tenantId,
        readerUid: this.decodedToken.uid,
        update,
        visibleConversationKeys: this.visibleContactIds
      })) {
        return;
      }

      this.sendJson({
        chatType: update.chatType,
        contactId: update.conversationKey,
        isTyping: update.isTyping,
        type: 'contactTypingUpdated',
        typingName: update.typingName,
        typingUid: update.typingUid
      });
    });
  }

  private unsubscribeTypingUpdates(): void {
    this.typingUnsubscribe?.();
    this.typingUnsubscribe = null;
  }

  private unsubscribePresenceUpdates(): void {
    this.presenceUnsubscribe?.();
    this.presenceUnsubscribe = null;
  }

  private async sendDirectContactSummary(contactId: string, directChat: DirectChatRecord): Promise<void> {
    if (!this.decodedToken || !this.deviceId) {
      return;
    }

    try {
      const isSessionActive = await this.ensureRealtimeSessionStillActive();

      if (!isSessionActive) {
        return;
      }

      const envelopes = await markEncryptedDirectEnvelopesDeliveredForDevice(
        this.decodedToken,
        contactId,
        this.deviceId
      );
      const contact = await getDirectChatContact(this.decodedToken, contactId, directChat);
      if (!shouldIncludeDirectChatContactInChatList(contact)) {
        return;
      }

      this.sendJson({
        contact,
        envelopes,
        messageReactions: mapDirectChatMessageReactions(directChat),
        type: 'chatContactUpdated'
      });
    } catch {
      // The contact may have been deactivated or become invisible to this user.
    }
  }

  private async sendGroupContactSummary(groupId: string): Promise<void> {
    if (!this.decodedToken || !this.deviceId) {
      return;
    }

    try {
      const isSessionActive = await this.ensureRealtimeSessionStillActive();

      if (!isSessionActive) {
        return;
      }

      const [envelopes, contact, messageReactions] = await Promise.all([
        listEncryptedGroupEnvelopesForDevice(this.decodedToken, groupId, this.deviceId, {
          limit: 50,
          markAsDelivered: true,
          markAsRead: false
        }),
        getGroupChatContact(this.decodedToken, groupId, this.deviceId),
        getGroupChatMessageReactions(this.decodedToken, groupId)
      ]);

      this.sendJson({
        contact,
        envelopes,
        messageReactions,
        type: 'chatContactUpdated'
      });
    } catch {
      // The group may have been deactivated or become invisible to this user.
    }
  }

  private async subscribeConversation(contactId: string): Promise<void> {
    if (!this.decodedToken) {
      this.sendError('Realtime session is not authenticated.');
      return;
    }

    this.unsubscribeConversation();

    try {
      if (contactId.startsWith('group_')) {
        await this.subscribeGroupConversation(contactId);
        return;
      }

      const isSessionActive = await this.ensureRealtimeSessionStillActive();

      if (!isSessionActive) {
        return;
      }

      const context = await getDirectChatRealtimeContext(this.decodedToken, contactId);
      const conversationContact = await getDirectChatContact(this.decodedToken, context.contactId);
      this.conversationUnsubscribe = context.chatRef
        .collection('encryptedEnvelopes')
        .orderBy('sentAtMs', 'asc')
        .limit(100)
        .onSnapshot((_snapshot) => {
          if (!this.decodedToken || !this.deviceId) {
            return;
          }

          void this.sendEncryptedConversationEnvelopes(context.contactId, conversationContact);
        }, () => {
          this.sendError('Realtime messages are temporarily unavailable.');
        });
    } catch {
      this.sendError('Unable to open realtime messages for this chat.');
    }
  }

  private async subscribeGroupConversation(groupId: string): Promise<void> {
    if (!this.decodedToken || !this.deviceId) {
      this.sendError('Realtime session is not authenticated.');
      return;
    }

    const activeDeviceId = this.deviceId;
    const isSessionActive = await this.ensureRealtimeSessionStillActive();

    if (!isSessionActive) {
      return;
    }

    const context = await getGroupChatRealtimeContext(this.decodedToken, groupId);
    const conversationContact = await getGroupChatContact(this.decodedToken, context.groupId, activeDeviceId);

    this.conversationUnsubscribe = context.chatRef
      .collection('encryptedEnvelopes')
      .orderBy('sentAtMs', 'asc')
      .limit(100)
      .onSnapshot((_snapshot) => {
        if (!this.decodedToken || !this.deviceId) {
          return;
        }

        void this.sendGroupEncryptedConversationEnvelopes(context.groupId, conversationContact);
      }, () => {
        this.sendError('Realtime group messages are temporarily unavailable.');
      });
  }

  private async sendEncryptedConversationEnvelopes(
    contactId: string,
    contact: ChatContact
  ): Promise<void> {
    if (!this.decodedToken || !this.deviceId) {
      return;
    }

    const isSessionActive = await this.ensureRealtimeSessionStillActive();

    if (!isSessionActive) {
      return;
    }

    const envelopes = await listEncryptedDirectEnvelopesForDevice(
      this.decodedToken,
      contactId,
      this.deviceId
    );
    const [refreshedContact, messageReactions] = await Promise.all([
      markDirectChatRead(this.decodedToken, contactId)
        .catch(() => contact),
      getDirectChatMessageReactions(this.decodedToken, contactId)
    ]);

    this.sendJson({
      contact: refreshedContact,
      contactId,
      envelopes,
      messageReactions,
      type: 'conversationEncryptedEnvelopes'
    });
  }

  private async sendGroupEncryptedConversationEnvelopes(
    groupId: string,
    contact: GroupChatContact
  ): Promise<void> {
    if (!this.decodedToken || !this.deviceId) {
      return;
    }

    const isSessionActive = await this.ensureRealtimeSessionStillActive();

    if (!isSessionActive) {
      return;
    }

    const envelopes = await listEncryptedGroupEnvelopesForDevice(
      this.decodedToken,
      groupId,
      this.deviceId
    );
    const [refreshedContact, messageReactions] = await Promise.all([
      getGroupChatContact(this.decodedToken, groupId, this.deviceId)
        .catch(() => contact),
      getGroupChatMessageReactions(this.decodedToken, groupId)
    ]);

    this.sendJson({
      contact: refreshedContact,
      contactId: groupId,
      envelopes,
      messageReactions,
      type: 'conversationEncryptedEnvelopes'
    });
  }

  private async ensureRealtimeSessionStillActive(): Promise<boolean> {
    if (!this.decodedToken || !this.deviceId) {
      return false;
    }

    try {
      await verifyActiveRegisteredDevice(this.decodedToken, this.deviceId);
      return true;
    } catch {
      this.closeWithError('Your realtime session could not be verified.', 'SESSION_UNVERIFIED');
      return false;
    }
  }

  private unsubscribeConversation(): void {
    this.conversationUnsubscribe?.();
    this.conversationUnsubscribe = null;
  }

  private sendError(message: string, code?: RealtimeErrorCode): void {
    this.sendJson({
      code,
      message,
      type: 'error'
    });
  }

  private closeWithError(message: string, code?: RealtimeErrorCode): void {
    this.sendError(message, code);
    this.webSocket.close(1008, message);
    this.cleanup();
  }

  private sendJson(payload: unknown): void {
    if (this.webSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.webSocket.send(JSON.stringify(payload));
  }

  private cleanup(): void {
    if (this.cleanedUp) {
      return;
    }

    this.cleanedUp = true;
    const uid = this.decodedToken?.uid || null;

    if (this.authTimeout) {
      clearTimeout(this.authTimeout);
      this.authTimeout = null;
    }

    this.unsubscribeContactSummaries();
    this.unsubscribeConversation();
    this.unsubscribePresenceUpdates();
    this.unsubscribeTypingUpdates();

    // Somebody whose phone loses signal mid-word never sends the "stopped"
    // that would clear them. Their socket going is that signal, and without
    // this the person they were writing to sees "typing..." until the entry's
    // own deadline runs out.
    if (uid) {
      clearAllChatTypingForUser(uid);
    }

    if (uid) {
      markChatUserOffline(uid);
    }

    this.decodedToken = null;
    this.deviceId = null;
    this.tenantId = null;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error';
}
