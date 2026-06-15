import {
  getSynzappApiBaseUrl,
  getSynzappRealtimeUrl,
  normalizeSynzappApiUrl
} from './apiConfig';
import { getRegisteredDeviceHeaders } from './deviceIdentity';
import {
  buildGroupHistoryKeyGrants,
  decryptChatEnvelopes,
  encryptChatMessage,
  type GroupHistoryKeyGrant
} from './chatEncryption';

export interface ChatContact {
  chatType?: 'DIRECT' | 'GROUP';
  contactId: string;
  conversationId: string;
  displayName: string;
  hasActiveDevice: boolean;
  initials: string;
  isDepartmentDefault?: boolean;
  isOnline: boolean;
  lastMessageAt: string | null;
  lastSeenAt: string | null;
  memberCount?: number;
  members?: ChatGroupMember[];
  memberPolicy?: 'DEPARTMENT_PLUS_EXPLICIT' | 'EXPLICIT';
  messagePermissionMode?: 'ADMINS' | 'ALL_MEMBERS';
  phoneMasked?: string | null;
  preview: string;
  profilePhotoCacheKey: string | null;
  profilePhotoUrl: string | null;
  role: 'ORG_ADMIN' | 'DEPT_ADMIN' | 'EMPLOYEE' | 'SYSTEM_ADMIN';
  roleName: string;
  status: string;
  unreadCount: number;
}

export interface ChatGroupMember {
  displayName: string;
  initials: string;
  profilePhotoCacheKey: string | null;
  profilePhotoUrl: string | null;
  role: 'ORG_ADMIN' | 'DEPT_ADMIN' | 'EMPLOYEE' | 'SYSTEM_ADMIN';
  roleName: string;
  uid: string;
}

export type ChatDeliveryStatus = 'delivered' | 'queued' | 'read' | 'sent';
export type ChatRealtimeErrorCode = 'SESSION_UNVERIFIED';
export type ChatNotificationAlertTone = 'chime' | 'default' | 'pulse' | 'silent';
export type ChatNotificationMuteMode = '1w' | '8h' | 'always' | 'off';
export type ChatTranscriptLanguageCode =
  | 'ar-SA'
  | 'da-DK'
  | 'de-DE'
  | 'en-AU'
  | 'en-CA'
  | 'en-GB'
  | 'en-IN'
  | 'en-US'
  | 'es-ES'
  | 'es-MX'
  | 'fr-CA'
  | 'fr-FR'
  | 'hi-IN'
  | 'it-IT'
  | 'ja-JP'
  | 'ko-KR'
  | 'nl-BE'
  | 'nl-NL'
  | 'pt-BR'
  | 'yue-CN'
  | 'zh-CN'
  | 'zh-HK'
  | 'zh-TW';

export interface ChatNotificationSettings {
  alertTone: ChatNotificationAlertTone;
  contactId: string;
  muteMode: ChatNotificationMuteMode;
  mutedUntil: string | null;
  updatedAt: string | null;
}

export interface ChatTranscriptLanguageSetting {
  contactId: string;
  languageCode: ChatTranscriptLanguageCode;
  updatedAt: string | null;
}

export interface ChatReplyReference {
  messageId: string;
  senderUid: string;
  sentAt: string;
  text: string;
}

export interface ChatMessageReaction {
  emoji: string;
  reactedAt: string;
  uid: string;
}

export type ChatMessageReactionMap = Record<string, ChatMessageReaction[]>;

export type ChatMediaKind = 'audio' | 'file' | 'image' | 'video';
export type ChatMediaTransferStatus = 'available' | 'downloading' | 'failed' | 'queued' | 'uploading';

export interface ChatMediaAttachment {
  contentType: string;
  durationMs?: number;
  encryptedSizeBytes?: number;
  fileName: string;
  height?: number;
  key?: string;
  kind: ChatMediaKind;
  localUri?: string;
  mediaId?: string;
  nonce?: string;
  sizeBytes: number;
  transferProgress?: number;
  transferStatus?: ChatMediaTransferStatus;
  width?: number;
}

export interface ChatImageAttachment extends ChatMediaAttachment {
  contentType: 'image/jpeg';
  dataUrl?: string;
  height: number;
  kind: 'image';
  width: number;
}

export interface ChatMessage {
  deliveryStatus: ChatDeliveryStatus | null;
  forwarded?: boolean;
  image?: ChatImageAttachment | null;
  isMine: boolean;
  media?: ChatMediaAttachment | null;
  mediaItems?: ChatMediaAttachment[];
  messageId: string;
  reactions?: ChatMessageReaction[];
  replyTo?: ChatReplyReference | null;
  senderUid: string;
  sentAt: string;
  text: string;
}

interface ChatThreadResponse {
  contact: ChatContact;
  messages: ChatMessage[];
  messageReactions: ChatMessageReactionMap;
}

interface SendChatMessageResponse {
  contact: ChatContact;
  message: ChatMessage;
}

export interface EncryptionDevicePublicKey {
  deviceId: string;
  identityPublicKey: string;
  keyAgreementPublicKey: string;
  keyVersion: number;
  platform: string;
  signingPublicKey: string;
  uid: string;
}

export interface ChatEncryptionContext {
  recipientDevices: EncryptionDevicePublicKey[];
  senderDevice: EncryptionDevicePublicKey;
}

export interface EncryptedChatEnvelope {
  algorithm: string;
  ciphertext: string;
  clientMessageId: string;
  deliveryStatus: Exclude<ChatDeliveryStatus, 'queued'> | null;
  encryptedKeyForDevice: string;
  envelopeId: string;
  historyKeyRecipientDevices?: EncryptionDevicePublicKey[];
  keyVersion: number;
  nonce: string;
  senderDeviceId: string;
  senderKeyAgreementPublicKey: string;
  senderUid: string;
  sentAt: string;
}

export type ChatRealtimeEvent =
  | { type: 'ready' }
  | { contact: ChatContact; envelopes: EncryptedChatEnvelope[]; messageReactions: ChatMessageReactionMap; type: 'chatContactUpdated' }
  | { contactId: string; isOnline: boolean; lastSeenAt: string | null; type: 'contactPresenceUpdated' }
  | { contact: ChatContact; contactId: string; messages: ChatMessage[]; type: 'conversationMessages' }
  | { contact: ChatContact; contactId: string; envelopes: EncryptedChatEnvelope[]; messageReactions: ChatMessageReactionMap; type: 'conversationEncryptedEnvelopes' }
  | { code?: ChatRealtimeErrorCode; message: string; type: 'error' };

export async function listChatContacts(idToken: string): Promise<ChatContact[]> {
  const deviceHeaders = await getRegisteredDeviceHeaders(idToken);
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/profile/chat/contacts`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...deviceHeaders
    },
    method: 'GET'
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  const body = await response.json() as { contacts?: ChatContact[] };

  return (body.contacts || []).map(normalizeChatContact);
}

export async function listGroupChatContacts(idToken: string): Promise<ChatContact[]> {
  const deviceHeaders = await getRegisteredDeviceHeaders(idToken);
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/profile/chat/groups`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...deviceHeaders
    },
    method: 'GET'
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  const body = await response.json() as { contacts?: ChatContact[] };

  return (body.contacts || []).map(normalizeChatContact);
}

export async function createGroupChat(input: {
  idToken: string;
  memberIds: string[];
  messagePermissionMode: 'ADMINS' | 'ALL_MEMBERS';
  name: string;
}): Promise<ChatContact> {
  const deviceHeaders = await getRegisteredDeviceHeaders(input.idToken);
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/profile/chat/groups`, {
    body: JSON.stringify({
      memberIds: input.memberIds,
      messagePermissionMode: input.messagePermissionMode,
      name: input.name
    }),
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${input.idToken}`,
      'Content-Type': 'application/json',
      ...deviceHeaders
    },
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  const body = await response.json() as { contact: ChatContact };

  return normalizeChatContact(body.contact);
}

export async function getChatNotificationSettings(input: {
  contactId: string;
  idToken: string;
}): Promise<ChatNotificationSettings> {
  const deviceHeaders = await getRegisteredDeviceHeaders(input.idToken);
  const response = await fetch(
    `${getSynzappApiBaseUrl()}/api/profile/chat/conversations/${encodeURIComponent(input.contactId)}/notification-settings`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.idToken}`,
        ...deviceHeaders
      },
      method: 'GET'
    }
  );

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  const body = await response.json() as { settings?: ChatNotificationSettings };

  return normalizeChatNotificationSettings(body.settings, input.contactId);
}

export async function updateChatNotificationSettings(input: {
  alertTone: ChatNotificationAlertTone;
  contactId: string;
  idToken: string;
  muteMode: ChatNotificationMuteMode;
}): Promise<ChatNotificationSettings> {
  const deviceHeaders = await getRegisteredDeviceHeaders(input.idToken);
  const response = await fetch(
    `${getSynzappApiBaseUrl()}/api/profile/chat/conversations/${encodeURIComponent(input.contactId)}/notification-settings`,
    {
      body: JSON.stringify({
        alertTone: input.alertTone,
        muteMode: input.muteMode
      }),
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.idToken}`,
        'Content-Type': 'application/json',
        ...deviceHeaders
      },
      method: 'PUT'
    }
  );

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  const body = await response.json() as { settings?: ChatNotificationSettings };

  return normalizeChatNotificationSettings(body.settings, input.contactId);
}

export async function getChatTranscriptLanguage(input: {
  contactId: string;
  idToken: string;
}): Promise<ChatTranscriptLanguageSetting> {
  const deviceHeaders = await getRegisteredDeviceHeaders(input.idToken);
  const response = await fetch(
    `${getSynzappApiBaseUrl()}/api/profile/chat/conversations/${encodeURIComponent(input.contactId)}/transcript-language`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.idToken}`,
        ...deviceHeaders
      },
      method: 'GET'
    }
  );

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  const body = await response.json() as { transcriptLanguage?: ChatTranscriptLanguageSetting };

  return normalizeChatTranscriptLanguage(body.transcriptLanguage, input.contactId);
}

export async function updateChatTranscriptLanguage(input: {
  contactId: string;
  idToken: string;
  languageCode: ChatTranscriptLanguageCode;
}): Promise<ChatTranscriptLanguageSetting> {
  const deviceHeaders = await getRegisteredDeviceHeaders(input.idToken);
  const response = await fetch(
    `${getSynzappApiBaseUrl()}/api/profile/chat/conversations/${encodeURIComponent(input.contactId)}/transcript-language`,
    {
      body: JSON.stringify({ languageCode: input.languageCode }),
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.idToken}`,
        'Content-Type': 'application/json',
        ...deviceHeaders
      },
      method: 'PUT'
    }
  );

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  const body = await response.json() as { transcriptLanguage?: ChatTranscriptLanguageSetting };

  return normalizeChatTranscriptLanguage(body.transcriptLanguage, input.contactId);
}

export async function getChatMessages(input: {
  chatType?: 'DIRECT' | 'GROUP';
  contactId: string;
  currentUid: string;
  idToken: string;
}): Promise<ChatThreadResponse> {
  const deviceHeaders = await getRegisteredDeviceHeaders(input.idToken);
  const path = input.chatType === 'GROUP'
    ? `/api/profile/chat/groups/${encodeURIComponent(input.contactId)}/encrypted-messages`
    : `/api/profile/chat/conversations/${encodeURIComponent(input.contactId)}/encrypted-messages`;
  const response = await fetch(
    `${getSynzappApiBaseUrl()}${path}`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.idToken}`,
        ...deviceHeaders
      },
      method: 'GET'
    }
  );

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  const body = await response.json() as {
    contact: ChatContact;
    envelopes?: EncryptedChatEnvelope[];
    messageReactions?: ChatMessageReactionMap;
  };
  const envelopes = (body.envelopes || []).map(normalizeEncryptedEnvelope);
  const messageReactions = normalizeMessageReactionMap(body.messageReactions);
  const messages = await decryptChatEnvelopes({
    currentUid: input.currentUid,
    envelopes,
    idToken: input.idToken
  });

  if (input.chatType === 'GROUP') {
    await grantGroupChatHistoryKeys({
      contactId: input.contactId,
      envelopes,
      idToken: input.idToken
    }).catch(() => undefined);
  }

  return {
    contact: normalizeChatContact(body.contact),
    messageReactions,
    messages: applyMessageReactionMap(messages.map(normalizeChatMessage), messageReactions)
  };
}

export async function updateChatMessageReaction(input: {
  chatType?: 'DIRECT' | 'GROUP';
  contactId: string;
  emoji: string;
  idToken: string;
  messageId: string;
}): Promise<{
  contact: ChatContact;
  messageReactions: ChatMessageReactionMap;
}> {
  const deviceHeaders = await getRegisteredDeviceHeaders(input.idToken);
  const path = input.chatType === 'GROUP'
    ? `/api/profile/chat/groups/${encodeURIComponent(input.contactId)}/messages/${encodeURIComponent(input.messageId)}/reaction`
    : `/api/profile/chat/conversations/${encodeURIComponent(input.contactId)}/messages/${encodeURIComponent(input.messageId)}/reaction`;
  const response = await fetch(
    `${getSynzappApiBaseUrl()}${path}`,
    {
      body: JSON.stringify({ emoji: input.emoji }),
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.idToken}`,
        'Content-Type': 'application/json',
        ...deviceHeaders
      },
      method: 'PUT'
    }
  );

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  const body = await response.json() as {
    contact: ChatContact;
    messageReactions?: ChatMessageReactionMap;
  };

  return {
    contact: normalizeChatContact(body.contact),
    messageReactions: normalizeMessageReactionMap(body.messageReactions)
  };
}

export async function deleteChatMessageForMe(input: {
  chatType?: 'DIRECT' | 'GROUP';
  contactId: string;
  idToken: string;
  messageId: string;
}): Promise<{
  contact: ChatContact | null;
  hiddenMessageIds: string[];
}> {
  if (input.chatType !== 'GROUP') {
    return {
      contact: null,
      hiddenMessageIds: [input.messageId]
    };
  }

  const deviceHeaders = await getRegisteredDeviceHeaders(input.idToken);
  const response = await fetch(
    `${getSynzappApiBaseUrl()}/api/profile/chat/groups/${encodeURIComponent(input.contactId)}/messages/${encodeURIComponent(input.messageId)}`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.idToken}`,
        ...deviceHeaders
      },
      method: 'DELETE'
    }
  );

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  const body = await response.json() as {
    contact?: ChatContact;
    hiddenMessageIds?: string[];
  };

  return {
    contact: body.contact ? normalizeChatContact(body.contact) : null,
    hiddenMessageIds: Array.isArray(body.hiddenMessageIds)
      ? body.hiddenMessageIds.filter((messageId) => typeof messageId === 'string' && messageId)
      : [input.messageId]
  };
}

export async function sendChatMessage(input: {
  chatType?: 'DIRECT' | 'GROUP';
  contactId: string;
  currentUid: string;
  forwarded?: boolean;
  image?: ChatImageAttachment | null;
  idToken: string;
  media?: ChatMediaAttachment | null;
  mediaItems?: ChatMediaAttachment[] | null;
  replyTo?: ChatReplyReference | null;
  text?: string;
}): Promise<SendChatMessageResponse> {
  const text = (input.text || '').trim();
  const mediaItems = normalizeChatMediaAttachments(input.mediaItems);
  const media = normalizeChatMediaAttachment(input.media || input.image || null) ||
    (mediaItems.length === 1 ? mediaItems[0] : null);
  const primaryMedia = media || mediaItems[0] || null;

  if (!text && !primaryMedia && !mediaItems.length) {
    throw new Error('Enter a message or choose media.');
  }

  const deviceHeaders = await getRegisteredDeviceHeaders(input.idToken);
  const context = await getChatEncryptionContext({
    chatType: input.chatType,
    contactId: input.contactId,
    idToken: input.idToken
  });
  const encryptedBody = await encryptChatMessage({
    forwarded: input.forwarded,
    idToken: input.idToken,
    media,
    mediaItems,
    recipientDevices: context.recipientDevices,
    replyTo: input.replyTo,
    senderDevice: context.senderDevice,
    text
  });
  const path = input.chatType === 'GROUP'
    ? `/api/profile/chat/groups/${encodeURIComponent(input.contactId)}/encrypted-messages`
    : `/api/profile/chat/conversations/${encodeURIComponent(input.contactId)}/encrypted-messages`;
  const response = await fetch(
    `${getSynzappApiBaseUrl()}${path}`,
    {
      body: JSON.stringify(encryptedBody),
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.idToken}`,
        'Content-Type': 'application/json',
        ...deviceHeaders
      },
      method: 'POST'
    }
  );

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  const body = await response.json() as {
    contact: ChatContact;
    envelope: {
      envelopeId: string;
      sentAt: string;
    };
  };

  return {
    contact: normalizeChatContact(body.contact),
    message: normalizeChatMessage({
        deliveryStatus: 'sent',
        forwarded: Boolean(input.forwarded),
        image: primaryMedia?.kind === 'image' ? primaryMedia as ChatImageAttachment : null,
        isMine: true,
        media: primaryMedia,
        mediaItems,
        messageId: body.envelope.envelopeId,
        replyTo: input.replyTo || null,
        senderUid: input.currentUid,
        sentAt: body.envelope.sentAt,
        text
    })
  };
}

export async function decryptRealtimeEncryptedEnvelopes(input: {
  currentUid: string;
  envelopes: EncryptedChatEnvelope[];
  idToken: string;
}): Promise<ChatMessage[]> {
  const messages = await decryptChatEnvelopes({
    currentUid: input.currentUid,
    envelopes: input.envelopes.map(normalizeEncryptedEnvelope),
    idToken: input.idToken
  });

  return messages.map(normalizeChatMessage);
}

export function openChatRealtimeSocket(idToken: string, deviceId: string): WebSocket {
  const socket = new WebSocket(getSynzappRealtimeUrl('/realtime/chat'));

  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({
      deviceId,
      idToken,
      type: 'authenticate'
    }));
  });

  return socket;
}

export function subscribeRealtimeConversation(socket: WebSocket, contactId: string): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify({
    contactId,
    type: 'subscribeConversation'
  }));
}

export function unsubscribeRealtimeConversation(socket: WebSocket): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify({
    type: 'unsubscribeConversation'
  }));
}

export function sendRealtimePresenceHeartbeat(socket: WebSocket): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify({
    type: 'presenceHeartbeat'
  }));
}

export function parseChatRealtimeEvent(payload: string): ChatRealtimeEvent | null {
  try {
    const event = JSON.parse(payload) as Partial<ChatRealtimeEvent>;

    if (event.type === 'ready') {
      return { type: 'ready' };
    }

    if (event.type === 'chatContactUpdated' && event.contact) {
      const messageReactions = normalizeMessageReactionMap(event.messageReactions);

      return {
        contact: normalizeChatContact(event.contact),
        envelopes: (event.envelopes || []).map(normalizeEncryptedEnvelope),
        messageReactions,
        type: 'chatContactUpdated'
      };
    }

    if (event.type === 'contactPresenceUpdated' && typeof event.contactId === 'string') {
      return {
        contactId: event.contactId,
        isOnline: event.isOnline === true,
        lastSeenAt: typeof event.lastSeenAt === 'string' ? event.lastSeenAt : null,
        type: 'contactPresenceUpdated'
      };
    }

    if (event.type === 'conversationMessages' && event.contact && event.contactId) {
      return {
        contact: normalizeChatContact(event.contact),
        contactId: event.contactId,
        messages: (event.messages || []).map(normalizeChatMessage),
        type: 'conversationMessages'
      };
    }

    if (event.type === 'conversationEncryptedEnvelopes' && event.contact && event.contactId) {
      const messageReactions = normalizeMessageReactionMap(event.messageReactions);

      return {
        contact: normalizeChatContact(event.contact),
        contactId: event.contactId,
        envelopes: (event.envelopes || []).map(normalizeEncryptedEnvelope),
        messageReactions,
        type: 'conversationEncryptedEnvelopes'
      };
    }

    if (event.type === 'error') {
      return {
        code: event.code === 'SESSION_UNVERIFIED' ? event.code : undefined,
        message: typeof event.message === 'string' ? event.message : 'Realtime chat is unavailable.',
        type: 'error'
      };
    }
  } catch {
    return null;
  }

  return null;
}

async function getChatEncryptionContext(input: {
  chatType?: 'DIRECT' | 'GROUP';
  contactId: string;
  idToken: string;
}): Promise<ChatEncryptionContext> {
  const deviceHeaders = await getRegisteredDeviceHeaders(input.idToken);
  const path = input.chatType === 'GROUP'
    ? `/api/profile/chat/groups/${encodeURIComponent(input.contactId)}/encryption-context`
    : `/api/profile/chat/conversations/${encodeURIComponent(input.contactId)}/encryption-context`;
  const response = await fetch(
    `${getSynzappApiBaseUrl()}${path}`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.idToken}`,
        ...deviceHeaders
      },
      method: 'GET'
    }
  );

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  const body = await response.json() as { context: ChatEncryptionContext };

  return body.context;
}

export async function grantGroupChatHistoryKeys(input: {
  contactId: string;
  envelopes: EncryptedChatEnvelope[];
  idToken: string;
}): Promise<void> {
  const grants = await buildGroupHistoryKeyGrants({
    envelopes: input.envelopes,
    idToken: input.idToken
  });

  if (!grants.length) {
    return;
  }

  const deviceHeaders = await getRegisteredDeviceHeaders(input.idToken);
  const response = await fetch(
    `${getSynzappApiBaseUrl()}/api/profile/chat/groups/${encodeURIComponent(input.contactId)}/history-key-grants`,
    {
      body: JSON.stringify({
        grants: grants.slice(0, 100).map(normalizeGroupHistoryKeyGrant)
      }),
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.idToken}`,
        'Content-Type': 'application/json',
        ...deviceHeaders
      },
      method: 'POST'
    }
  );

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }
}

function normalizeGroupHistoryKeyGrant(grant: GroupHistoryKeyGrant): GroupHistoryKeyGrant {
  return {
    encryptedKeysByDevice: Object.fromEntries(
      Object.entries(grant.encryptedKeysByDevice || {})
        .filter(([deviceId, encryptedKey]) => deviceId && encryptedKey)
        .slice(0, 100)
    ),
    envelopeId: grant.envelopeId
  };
}

function normalizeChatContact(contact: ChatContact): ChatContact {
  return {
    ...contact,
    chatType: contact.chatType === 'GROUP' ? 'GROUP' : 'DIRECT',
    hasActiveDevice: contact.hasActiveDevice !== false,
    isDepartmentDefault: contact.isDepartmentDefault === true,
    isOnline: contact.isOnline === true,
    lastSeenAt: typeof contact.lastSeenAt === 'string' ? contact.lastSeenAt : null,
    memberCount: Number.isFinite(contact.memberCount) ? Math.max(Math.round(contact.memberCount || 0), 0) : undefined,
    members: Array.isArray(contact.members) ? contact.members.map(normalizeChatGroupMember) : undefined,
    memberPolicy: contact.memberPolicy === 'DEPARTMENT_PLUS_EXPLICIT' ? 'DEPARTMENT_PLUS_EXPLICIT' : contact.memberPolicy === 'EXPLICIT' ? 'EXPLICIT' : undefined,
    messagePermissionMode: contact.messagePermissionMode === 'ADMINS' ? 'ADMINS' : contact.messagePermissionMode === 'ALL_MEMBERS' ? 'ALL_MEMBERS' : undefined,
    phoneMasked: typeof contact.phoneMasked === 'string' && contact.phoneMasked.trim() ? contact.phoneMasked.trim() : null,
    profilePhotoUrl: normalizeSynzappApiUrl(contact.profilePhotoUrl)
  };
}

function normalizeChatNotificationSettings(
  settings: ChatNotificationSettings | undefined,
  contactId: string
): ChatNotificationSettings {
  const alertTone = isChatNotificationAlertTone(settings?.alertTone) ? settings.alertTone : 'default';
  const muteMode = isChatNotificationMuteMode(settings?.muteMode) ? settings.muteMode : 'off';
  const mutedUntil = typeof settings?.mutedUntil === 'string' && settings.mutedUntil.trim()
    ? settings.mutedUntil.trim()
    : null;
  const normalizedMuteMode = isMuteModeCurrentlyActive(muteMode, mutedUntil) ? muteMode : 'off';

  return {
    alertTone,
    contactId: typeof settings?.contactId === 'string' && settings.contactId.trim()
      ? settings.contactId.trim()
      : contactId,
    muteMode: normalizedMuteMode,
    mutedUntil: normalizedMuteMode === 'off' ? null : mutedUntil,
    updatedAt: typeof settings?.updatedAt === 'string' && settings.updatedAt.trim()
      ? settings.updatedAt.trim()
      : null
  };
}

function isMuteModeCurrentlyActive(muteMode: ChatNotificationMuteMode, mutedUntil: string | null): boolean {
  if (muteMode === 'always') {
    return true;
  }

  if (muteMode === 'off') {
    return false;
  }

  if (!mutedUntil) {
    return false;
  }

  const mutedUntilMs = Date.parse(mutedUntil);

  return Number.isFinite(mutedUntilMs) && mutedUntilMs > Date.now();
}

function isChatNotificationAlertTone(value: unknown): value is ChatNotificationAlertTone {
  return value === 'chime' || value === 'default' || value === 'pulse' || value === 'silent';
}

function isChatNotificationMuteMode(value: unknown): value is ChatNotificationMuteMode {
  return value === '1w' || value === '8h' || value === 'always' || value === 'off';
}

function normalizeChatTranscriptLanguage(
  transcriptLanguage: ChatTranscriptLanguageSetting | undefined,
  contactId: string
): ChatTranscriptLanguageSetting {
  return {
    contactId: typeof transcriptLanguage?.contactId === 'string' && transcriptLanguage.contactId.trim()
      ? transcriptLanguage.contactId.trim()
      : contactId,
    languageCode: isChatTranscriptLanguageCode(transcriptLanguage?.languageCode)
      ? transcriptLanguage.languageCode
      : 'en-US',
    updatedAt: typeof transcriptLanguage?.updatedAt === 'string' && transcriptLanguage.updatedAt.trim()
      ? transcriptLanguage.updatedAt.trim()
      : null
  };
}

function isChatTranscriptLanguageCode(value: unknown): value is ChatTranscriptLanguageCode {
  return (
    value === 'ar-SA' ||
    value === 'da-DK' ||
    value === 'de-DE' ||
    value === 'en-AU' ||
    value === 'en-CA' ||
    value === 'en-GB' ||
    value === 'en-IN' ||
    value === 'en-US' ||
    value === 'es-ES' ||
    value === 'es-MX' ||
    value === 'fr-CA' ||
    value === 'fr-FR' ||
    value === 'hi-IN' ||
    value === 'it-IT' ||
    value === 'ja-JP' ||
    value === 'ko-KR' ||
    value === 'nl-BE' ||
    value === 'nl-NL' ||
    value === 'pt-BR' ||
    value === 'yue-CN' ||
    value === 'zh-CN' ||
    value === 'zh-HK' ||
    value === 'zh-TW'
  );
}

function normalizeChatGroupMember(member: ChatGroupMember): ChatGroupMember {
  return {
    displayName: typeof member.displayName === 'string' && member.displayName.trim()
      ? member.displayName
      : 'Synzapp user',
    initials: typeof member.initials === 'string' && member.initials.trim()
      ? member.initials.trim().slice(0, 3).toUpperCase()
      : '?',
    profilePhotoCacheKey: typeof member.profilePhotoCacheKey === 'string' ? member.profilePhotoCacheKey : null,
    profilePhotoUrl: normalizeSynzappApiUrl(member.profilePhotoUrl),
    role: member.role || 'EMPLOYEE',
    roleName: typeof member.roleName === 'string' && member.roleName.trim() ? member.roleName : 'Member',
    uid: typeof member.uid === 'string' ? member.uid : ''
  };
}

function normalizeChatMessage(message: ChatMessage): ChatMessage {
  const deliveryStatus = (
    message.deliveryStatus === 'delivered' ||
    message.deliveryStatus === 'queued' ||
    message.deliveryStatus === 'read' ||
    message.deliveryStatus === 'sent'
  )
    ? message.deliveryStatus
    : null;

  const mediaItems = normalizeChatMediaAttachments(message.mediaItems);
  const media = normalizeChatMediaAttachment(message.media || message.image) || mediaItems[0] || null;

  return {
    ...message,
    deliveryStatus,
    forwarded: Boolean(message.forwarded),
    image: media?.kind === 'image' ? normalizeChatImageAttachment(media as ChatImageAttachment) : normalizeChatImageAttachment(message.image),
    media,
    mediaItems,
    reactions: normalizeMessageReactions(message.reactions),
    replyTo: normalizeReplyReference(message.replyTo)
  };
}

function applyMessageReactionMap(
  messages: ChatMessage[],
  messageReactions: ChatMessageReactionMap
): ChatMessage[] {
  return messages.map((message) => ({
    ...message,
    reactions: messageReactions[message.messageId] || []
  }));
}

function normalizeMessageReactionMap(
  reactionMap?: ChatMessageReactionMap
): ChatMessageReactionMap {
  const normalizedMap: ChatMessageReactionMap = {};

  Object.entries(reactionMap || {}).forEach(([messageId, reactions]) => {
    const safeReactions = normalizeMessageReactions(reactions);

    if (messageId && safeReactions.length) {
      normalizedMap[messageId] = safeReactions;
    }
  });

  return normalizedMap;
}

function normalizeMessageReactions(
  reactions?: ChatMessageReaction[]
): ChatMessageReaction[] {
  if (!Array.isArray(reactions)) {
    return [];
  }

  return reactions
    .map((reaction) => {
      if (
        !reaction ||
        typeof reaction.uid !== 'string' ||
        typeof reaction.emoji !== 'string' ||
        typeof reaction.reactedAt !== 'string'
      ) {
        return null;
      }

      const uid = reaction.uid.trim();
      const emoji = reaction.emoji.trim();

      if (!uid || !emoji) {
        return null;
      }

      return {
        emoji,
        reactedAt: reaction.reactedAt,
        uid
      };
    })
    .filter((reaction): reaction is ChatMessageReaction => Boolean(reaction));
}

function normalizeChatImageAttachment(
  image: ChatMessage['image']
): ChatImageAttachment | null {
  const media = normalizeChatMediaAttachment(image);

  if (!media || media.kind !== 'image') {
    return null;
  }

  return {
    ...media,
    contentType: 'image/jpeg',
    height: media.height || 1,
    kind: 'image',
    width: media.width || 1
  };
}

function normalizeChatMediaAttachment(
  media: ChatMessage['media'] | ChatMessage['image']
): ChatMediaAttachment | null {
  if (!media || typeof media !== 'object') {
    return null;
  }

  const kind = media.kind === 'audio' || media.kind === 'image' || media.kind === 'video' || media.kind === 'file'
    ? media.kind
    : 'image';
  const dataUrl = typeof (media as ChatImageAttachment).dataUrl === 'string'
    ? (media as ChatImageAttachment).dataUrl?.trim()
    : '';
  const localUri = typeof media.localUri === 'string'
    ? media.localUri.trim()
    : typeof (media as { uri?: string }).uri === 'string'
      ? ((media as { uri?: string }).uri || '').trim()
      : '';
  const mediaId = typeof media.mediaId === 'string' ? media.mediaId.trim() : '';
  const key = typeof media.key === 'string' ? media.key.trim() : '';
  const nonce = typeof media.nonce === 'string' ? media.nonce.trim() : '';
  const contentType = typeof media.contentType === 'string' && media.contentType.trim()
    ? media.contentType.trim().toLowerCase()
    : kind === 'image'
      ? 'image/jpeg'
      : kind === 'video'
        ? 'video/mp4'
        : kind === 'audio'
          ? 'audio/mp4'
          : 'application/octet-stream';
  const fileName = typeof media.fileName === 'string' && media.fileName.trim()
    ? media.fileName.trim()
    : kind === 'image'
      ? 'photo.jpg'
      : kind === 'video'
        ? 'video.mp4'
        : kind === 'audio'
          ? 'voice-note.m4a'
          : 'attachment';

  if (!dataUrl && !localUri && !mediaId) {
    return null;
  }

  return {
    contentType,
    durationMs: Number.isFinite(media.durationMs) ? Math.max(Math.round(media.durationMs || 0), 0) : undefined,
    encryptedSizeBytes: Number.isFinite(media.encryptedSizeBytes) ? Math.max(Math.round(media.encryptedSizeBytes || 0), 0) : undefined,
    fileName,
    height: Number.isFinite(media.height) ? Math.max(Math.round(media.height || 0), 1) : undefined,
    key: key || undefined,
    kind,
    localUri: localUri || (dataUrl || undefined),
    mediaId: mediaId || undefined,
    nonce: nonce || undefined,
    sizeBytes: Number.isFinite(media.sizeBytes) ? Math.max(Math.round(media.sizeBytes || 0), 0) : 0,
    transferProgress: Number.isFinite(media.transferProgress)
      ? Math.min(Math.max(media.transferProgress || 0, 0), 1)
      : undefined,
    transferStatus: media.transferStatus === 'available' ||
      media.transferStatus === 'downloading' ||
      media.transferStatus === 'failed' ||
      media.transferStatus === 'queued' ||
      media.transferStatus === 'uploading'
        ? media.transferStatus
        : undefined,
    width: Number.isFinite(media.width) ? Math.max(Math.round(media.width || 0), 1) : undefined
  };
}

function normalizeChatMediaAttachments(
  mediaItems?: ChatMediaAttachment[] | null
): ChatMediaAttachment[] {
  if (!Array.isArray(mediaItems)) {
    return [];
  }

  return mediaItems
    .map((media) => normalizeChatMediaAttachment(media))
    .filter((media): media is ChatMediaAttachment => Boolean(media))
    .slice(0, 10);
}

function normalizeReplyReference(replyTo: ChatMessage['replyTo']): ChatReplyReference | null {
  if (
    !replyTo ||
    typeof replyTo.messageId !== 'string' ||
    typeof replyTo.senderUid !== 'string' ||
    typeof replyTo.sentAt !== 'string' ||
    typeof replyTo.text !== 'string'
  ) {
    return null;
  }

  const text = replyTo.text.trim();

  if (!replyTo.messageId.trim() || !replyTo.senderUid.trim() || !replyTo.sentAt.trim() || !text) {
    return null;
  }

  return {
    messageId: replyTo.messageId.trim(),
    senderUid: replyTo.senderUid.trim(),
    sentAt: replyTo.sentAt,
    text: text.slice(0, 500)
  };
}

function normalizeEncryptedEnvelope(envelope: EncryptedChatEnvelope): EncryptedChatEnvelope {
  const deliveryStatus = (
    envelope.deliveryStatus === 'delivered' ||
    envelope.deliveryStatus === 'read' ||
    envelope.deliveryStatus === 'sent'
  )
    ? envelope.deliveryStatus
    : null;

  return {
    ...envelope,
    deliveryStatus,
    historyKeyRecipientDevices: Array.isArray(envelope.historyKeyRecipientDevices)
      ? envelope.historyKeyRecipientDevices.map(normalizeEncryptionDevicePublicKey).filter((device) => Boolean(device.deviceId))
      : undefined
  };
}

function normalizeEncryptionDevicePublicKey(device: EncryptionDevicePublicKey): EncryptionDevicePublicKey {
  return {
    deviceId: typeof device.deviceId === 'string' ? device.deviceId.trim() : '',
    identityPublicKey: typeof device.identityPublicKey === 'string' ? device.identityPublicKey.trim() : '',
    keyAgreementPublicKey: typeof device.keyAgreementPublicKey === 'string' ? device.keyAgreementPublicKey.trim() : '',
    keyVersion: Number.isFinite(device.keyVersion) ? Math.max(Math.round(device.keyVersion || 1), 1) : 1,
    platform: typeof device.platform === 'string' && device.platform.trim() ? device.platform.trim() : 'unknown',
    signingPublicKey: typeof device.signingPublicKey === 'string' ? device.signingPublicKey.trim() : '',
    uid: typeof device.uid === 'string' ? device.uid.trim() : ''
  };
}

async function getResponseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();

    if (typeof body?.error === 'string') {
      return body.error;
    }
  } catch {
    return 'Unable to load chats. Please try again.';
  }

  return 'Unable to load chats. Please try again.';
}
