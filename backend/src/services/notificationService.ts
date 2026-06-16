import { DecodedIdToken } from 'firebase-admin/auth';
import { getMessaging, type Message } from 'firebase-admin/messaging';
import { createHash } from 'crypto';
import { adminApp, fieldValue, firestore } from '../config/firebaseAdmin.js';
import { DevicePlatform, verifyActiveRegisteredDevice } from './deviceIdentityService.js';
import type { EncryptedNotificationPreviewRecord } from './encryptedMessageEnvelopeService.js';
import { getChatUserPreference } from './chatUserPreferenceService.js';
import {
  getChatArchiveSettings,
  shouldTreatChatAsArchived
} from './chatArchiveSettingsService.js';

type PushProvider = 'expo' | 'fcm';
type PushTokenStatus = 'ACTIVE' | 'INACTIVE';
export type ChatNotificationAlertTone = 'chime' | 'default' | 'pulse' | 'silent';
export type ChatNotificationMuteMode = '1w' | '8h' | 'always' | 'off';

interface RegisterPushTokenInput {
  deviceId: string;
  platform: DevicePlatform;
  provider: PushProvider;
  token: string;
}

interface PushTokenRecord {
  createdAt?: FirebaseFirestore.FieldValue;
  deviceId?: string;
  platform?: DevicePlatform;
  provider?: PushProvider;
  status?: PushTokenStatus;
  token?: string;
  tenantId?: string;
  uid?: string;
}

interface RegisteredPushTokenResponse {
  deviceId: string;
  platform: DevicePlatform;
  provider: PushProvider;
  status: PushTokenStatus;
}

export interface ChatNotificationSettingsResponse {
  alertTone: ChatNotificationAlertTone;
  contactId: string;
  muteMode: ChatNotificationMuteMode;
  mutedUntil: string | null;
  updatedAt: string | null;
}

interface ChatNotificationSettingsRecord {
  alertTone?: ChatNotificationAlertTone;
  contactId?: string;
  muteMode?: ChatNotificationMuteMode;
  mutedUntil?: string | null;
  tenantId?: string;
  uid?: string;
}

interface UpdateChatNotificationSettingsInput {
  alertTone: ChatNotificationAlertTone;
  muteMode: ChatNotificationMuteMode;
}

interface SendChatMessagePushNotificationInput {
  chatType?: 'DIRECT' | 'GROUP';
  conversationId: string;
  envelopeId: string;
  notificationPreviewByDevice?: Record<string, EncryptedNotificationPreviewRecord>;
  notificationContactId?: string;
  recipientBadgeCount?: number;
  recipientUid: string;
  senderUid: string;
  senderKeyAgreementPublicKey?: string;
  sentAt: string;
  tenantId: string;
}

interface SendGroupChatMessagePushNotificationsInput {
  conversationId: string;
  envelopeId: string;
  groupId: string;
  notificationPreviewByDevice?: Record<string, EncryptedNotificationPreviewRecord>;
  recipientUids: string[];
  senderKeyAgreementPublicKey?: string;
  senderUid: string;
  sentAt: string;
  tenantId: string;
}

interface ExpoPushMessage {
  badge?: number;
  body?: string;
  channelId?: string;
  data: Record<string, string>;
  mutableContent?: boolean;
  priority: 'default' | 'high' | 'normal';
  sound?: 'default';
  title?: string;
  to: string;
}

interface ExpoPushTicket {
  details?: {
    error?: string;
  };
  id?: string;
  message?: string;
  status?: 'error' | 'ok';
}

interface PushDeliveryTicket extends ExpoPushTicket {
  deviceId: string;
  platform?: DevicePlatform;
  provider?: PushProvider;
}

interface ExpoPushResponse {
  data?: ExpoPushTicket[];
  errors?: unknown[];
}

const EXPO_PUSH_SEND_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_TOKEN_PATTERN = /^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/;
const EXPO_PUSH_BATCH_SIZE = 100;
const FCM_PUSH_BATCH_SIZE = 500;
const MAX_PUSH_BADGE_COUNT = 9999;
const MUTE_DURATION_MS: Record<Exclude<ChatNotificationMuteMode, 'always' | 'off'>, number> = {
  '1w': 7 * 24 * 60 * 60 * 1000,
  '8h': 8 * 60 * 60 * 1000
};

export async function registerCurrentUserPushToken(
  decodedToken: DecodedIdToken,
  input: RegisterPushTokenInput
): Promise<RegisteredPushTokenResponse> {
  const activeDevice = await verifyActiveRegisteredDevice(decodedToken, input.deviceId);
  const safeToken = input.token.trim();

  if (
    (input.provider === 'expo' && !EXPO_PUSH_TOKEN_PATTERN.test(safeToken)) ||
    (input.provider === 'fcm' && !isValidFcmToken(safeToken))
  ) {
    throw validationError('Push token is not valid.');
  }

  const tokenRecord: PushTokenRecord = {
    deviceId: activeDevice.deviceId,
    platform: input.platform,
    provider: input.provider,
    status: 'ACTIVE',
    token: safeToken,
    tenantId: activeDevice.tenantId,
    uid: decodedToken.uid
  };
  const userPushTokenRef = getUserPushTokenRef(activeDevice.tenantId, decodedToken.uid, activeDevice.deviceId);
  const tenantDeviceRef = firestore
    .collection('organizations')
    .doc(activeDevice.tenantId)
    .collection('deviceKeys')
    .doc(activeDevice.deviceId);
  const userDeviceRef = firestore
    .collection('organizations')
    .doc(activeDevice.tenantId)
    .collection('users')
    .doc(decodedToken.uid)
    .collection('devices')
    .doc(activeDevice.deviceId);

  await Promise.all([
    userPushTokenRef.set({
      ...tokenRecord,
      createdAt: fieldValue.serverTimestamp(),
      lastRegisteredAt: fieldValue.serverTimestamp(),
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true }),
    tenantDeviceRef.set({
      pushNotifications: {
        lastRegisteredAt: fieldValue.serverTimestamp(),
        platform: input.platform,
        provider: input.provider,
        status: 'ACTIVE'
      },
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true }),
    userDeviceRef.set({
      pushNotifications: {
        lastRegisteredAt: fieldValue.serverTimestamp(),
        platform: input.platform,
        provider: input.provider,
        status: 'ACTIVE'
      },
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true })
  ]);

  return {
    deviceId: activeDevice.deviceId,
    platform: input.platform,
    provider: input.provider,
    status: 'ACTIVE'
  };
}

export async function deactivateCurrentUserPushToken(
  decodedToken: DecodedIdToken,
  deviceId: string
): Promise<void> {
  const activeDevice = await verifyActiveRegisteredDevice(decodedToken, deviceId);
  const update = {
    deactivatedAt: fieldValue.serverTimestamp(),
    status: 'INACTIVE',
    updatedAt: fieldValue.serverTimestamp()
  };

  await Promise.all([
    getUserPushTokenRef(activeDevice.tenantId, decodedToken.uid, activeDevice.deviceId)
      .set(update, { merge: true }),
    firestore
      .collection('organizations')
      .doc(activeDevice.tenantId)
      .collection('deviceKeys')
      .doc(activeDevice.deviceId)
      .set({
        pushNotifications: {
          status: 'INACTIVE',
          updatedAt: fieldValue.serverTimestamp()
        },
        updatedAt: fieldValue.serverTimestamp()
      }, { merge: true })
  ]);
}

export async function getChatNotificationSettings(
  tenantId: string,
  uid: string,
  contactId: string
): Promise<ChatNotificationSettingsResponse> {
  const snapshot = await getChatNotificationSettingsRef(tenantId, uid, contactId).get();

  return normalizeChatNotificationSettings(contactId, snapshot.exists
    ? snapshot.data() as ChatNotificationSettingsRecord
    : null);
}

export async function updateChatNotificationSettings(
  tenantId: string,
  uid: string,
  contactId: string,
  input: UpdateChatNotificationSettingsInput
): Promise<ChatNotificationSettingsResponse> {
  const now = new Date();
  const mutedUntil = getMutedUntilForMode(input.muteMode, now);
  const record: ChatNotificationSettingsRecord = {
    alertTone: input.alertTone,
    contactId,
    muteMode: input.muteMode,
    mutedUntil,
    tenantId,
    uid
  };

  await getChatNotificationSettingsRef(tenantId, uid, contactId).set({
    ...record,
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });

  return {
    ...normalizeChatNotificationSettings(contactId, record),
    updatedAt: now.toISOString()
  };
}

export async function sendChatMessagePushNotification(
  input: SendChatMessagePushNotificationInput
): Promise<void> {
  const organizationRef = firestore.collection('organizations').doc(input.tenantId);
  const eventRef = organizationRef.collection('notificationEvents').doc();
  const notificationContactId = input.notificationContactId || input.senderUid;
  const chatType = input.chatType === 'GROUP' ? 'GROUP' : 'DIRECT';
  const [
    senderSnapshot,
    pushTokensSnapshot,
    unreadBadgeCount,
    notificationSettings,
    archiveSettings,
    chatPreference
  ] = await Promise.all([
    organizationRef.collection('users').doc(input.senderUid).get(),
    organizationRef
      .collection('users')
      .doc(input.recipientUid)
      .collection('pushTokens')
      .where('status', '==', 'ACTIVE')
      .get(),
    input.recipientBadgeCount === undefined
      ? getUnreadChatBadgeCount(input.tenantId, input.recipientUid)
      : Promise.resolve(normalizeBadgeCount(input.recipientBadgeCount)),
    getChatNotificationSettings(input.tenantId, input.recipientUid, notificationContactId),
    getChatArchiveSettings(input.tenantId, input.recipientUid),
    getChatUserPreference(input.tenantId, input.recipientUid, chatType, notificationContactId)
  ]);
  const pushTokens = pushTokensSnapshot.docs
    .map((doc) => ({
      ...(doc.data() as PushTokenRecord),
      deviceId: doc.id
    }))
    .filter((record) => isDeliverablePushToken(record));
  const sentAtMs = Date.parse(input.sentAt);
  const isArchivedForRecipient = shouldTreatChatAsArchived(
    chatPreference,
    Number.isFinite(sentAtMs) ? sentAtMs : null,
    archiveSettings
  );
  const isArchivedNotificationSuppressed = isArchivedForRecipient &&
    archiveSettings.archivedNotificationMode === 'NONE';
  const isMuted = isArchivedNotificationSuppressed || isChatNotificationMuted(notificationSettings);

  await eventRef.set({
    actorUid: input.senderUid,
    channel: 'chat',
    conversationId: input.conversationId,
    createdAt: fieldValue.serverTimestamp(),
    envelopeId: input.envelopeId,
    encryptedPreviewCount: input.notificationPreviewByDevice
      ? Object.keys(input.notificationPreviewByDevice).length
      : 0,
    notificationAlertTone: notificationSettings.alertTone,
    notificationContactId,
    notificationArchivedMode: archiveSettings.archivedNotificationMode,
    notificationMuteMode: notificationSettings.muteMode,
    notificationMutedUntil: notificationSettings.mutedUntil,
    recipientUid: input.recipientUid,
    recipientBadgeCount: unreadBadgeCount,
    status: isArchivedNotificationSuppressed ? 'ARCHIVED_SUPPRESSED' : isMuted ? 'MUTED' : pushTokens.length ? 'QUEUED' : 'NO_ACTIVE_TOKENS',
    tenantId: input.tenantId,
    tokenCount: isMuted ? 0 : pushTokens.length,
    type: 'chat.message'
  });

  if (isMuted) {
    return;
  }

  if (!pushTokens.length) {
    return;
  }

  const senderName = getDisplayName(senderSnapshot.exists ? senderSnapshot.data() : null);
  const senderProfilePhotoCacheKeys = getNotificationSenderProfilePhotoCacheKeys(
    input,
    senderSnapshot.exists ? senderSnapshot.data() : null
  );
  const expoTargets: Array<{ message: ExpoPushMessage; record: PushTokenRecord & { deviceId: string } }> = [];
  const fcmTargets: Array<{ message: Message; record: PushTokenRecord & { deviceId: string } }> = [];

  for (const record of pushTokens) {
    const notificationPreview = getNotificationPreviewForDevice(input, record.deviceId || '');
    const title = senderName || 'Synzapp';
    const baseData: Record<string, string> = {
      chatType: input.chatType || 'DIRECT',
      contactId: notificationContactId,
      conversationId: input.conversationId,
      envelopeId: input.envelopeId,
      badgeCount: String(unreadBadgeCount),
      notificationAlertTone: notificationSettings.alertTone,
      notificationFallbackBody: notificationPreview ? 'New encrypted message' : 'New message',
      notificationSenderDisplayName: title,
      ...(senderProfilePhotoCacheKeys.primary
        ? { notificationSenderProfilePhotoCacheKey: senderProfilePhotoCacheKeys.primary }
        : {}),
      ...(senderProfilePhotoCacheKeys.fallback
        ? { notificationSenderFallbackProfilePhotoCacheKey: senderProfilePhotoCacheKeys.fallback }
        : {}),
      notificationSenderUid: input.senderUid,
      notificationTitle: title,
      senderUid: input.senderUid,
      sentAt: input.sentAt,
      type: 'chat.message'
    };
    const data = {
      ...baseData,
      ...(notificationPreview || {})
    };

    if (record.provider === 'fcm') {
      fcmTargets.push({
        message: {
          android: {
            priority: 'high'
          },
          data,
          token: record.token || ''
        },
        record
      });
    } else {
      expoTargets.push({
        message: {
          badge: unreadBadgeCount,
          body: notificationPreview ? 'New encrypted message' : 'New message',
          channelId: 'chat-messages',
          data,
          mutableContent: record.platform === 'ios',
          priority: 'high',
          title,
          to: record.token || '',
          ...(notificationSettings.alertTone === 'silent' ? {} : { sound: 'default' as const })
        },
        record
      });
    }
  }

  const ticketResults: PushDeliveryTicket[] = [];

  for (let index = 0; index < expoTargets.length; index += EXPO_PUSH_BATCH_SIZE) {
    const targetBatch = expoTargets.slice(index, index + EXPO_PUSH_BATCH_SIZE);
    const tickets = await sendExpoPushBatch(targetBatch.map((target) => target.message));
    const annotatedTickets = annotatePushTickets(tickets, targetBatch.map((target) => target.record));

    ticketResults.push(...annotatedTickets);
    await deactivateInvalidPushTokens(input.tenantId, input.recipientUid, annotatedTickets);
  }

  for (let index = 0; index < fcmTargets.length; index += FCM_PUSH_BATCH_SIZE) {
    const targetBatch = fcmTargets.slice(index, index + FCM_PUSH_BATCH_SIZE);
    const tickets = await sendFcmPushBatch(targetBatch.map((target) => target.message));
    const annotatedTickets = annotatePushTickets(tickets, targetBatch.map((target) => target.record));

    ticketResults.push(...annotatedTickets);
    await deactivateInvalidPushTokens(input.tenantId, input.recipientUid, annotatedTickets);
  }

  const errorCount = ticketResults.filter((ticket) => ticket.status === 'error').length;
  const sentCount = ticketResults.filter((ticket) => ticket.status === 'ok').length;

  await eventRef.set({
    completedAt: fieldValue.serverTimestamp(),
    errorCount,
    sentCount,
    status: errorCount && sentCount ? 'PARTIAL' : errorCount ? 'FAILED' : 'SENT',
    tickets: ticketResults.map((ticket) => ({
      details: ticket.details || null,
      deviceId: ticket.deviceId,
      id: ticket.id || null,
      message: ticket.message || null,
      platform: ticket.platform || null,
      provider: ticket.provider || null,
      status: ticket.status || 'error'
    })),
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });
}

export async function sendGroupChatMessagePushNotifications(
  input: SendGroupChatMessagePushNotificationsInput
): Promise<void> {
  await Promise.all(input.recipientUids.map((recipientUid) =>
    sendChatMessagePushNotification({
      chatType: 'GROUP',
      conversationId: input.conversationId,
      envelopeId: input.envelopeId,
      notificationContactId: input.groupId,
      notificationPreviewByDevice: input.notificationPreviewByDevice,
      recipientUid,
      senderKeyAgreementPublicKey: input.senderKeyAgreementPublicKey,
      senderUid: input.senderUid,
      sentAt: input.sentAt,
      tenantId: input.tenantId
    })
  ));
}

async function getUnreadChatBadgeCount(tenantId: string, uid: string): Promise<number> {
  const organizationRef = firestore.collection('organizations').doc(tenantId);
  const [directChatsSnapshot, groupsSnapshot] = await Promise.all([
    organizationRef.collection('directChats')
      .where('participantIds', 'array-contains', uid)
      .get(),
    organizationRef.collection('groups')
      .where('status', '==', 'ACTIVE')
      .get()
  ]);
  const directUnreadCount = directChatsSnapshot.docs.reduce((total, doc) => {
    const unreadCounts = doc.data().unreadCounts as Record<string, unknown> | undefined;
    const count = unreadCounts?.[uid];

    return total + (typeof count === 'number' && Number.isFinite(count) ? Math.max(0, count) : 0);
  }, 0);
  const groupUnreadCount = groupsSnapshot.docs.reduce((total, doc) => {
    const unreadCounts = doc.data().unreadCounts as Record<string, unknown> | undefined;
    const count = unreadCounts?.[uid];

    return total + (typeof count === 'number' && Number.isFinite(count) ? Math.max(0, count) : 0);
  }, 0);

  return normalizeBadgeCount(directUnreadCount + groupUnreadCount);
}

function normalizeBadgeCount(count: number): number {
  if (!Number.isFinite(count)) {
    return 0;
  }

  return Math.max(0, Math.min(MAX_PUSH_BADGE_COUNT, Math.floor(count)));
}

function normalizeChatNotificationSettings(
  contactId: string,
  record: ChatNotificationSettingsRecord | null
): ChatNotificationSettingsResponse {
  const alertTone = isChatNotificationAlertTone(record?.alertTone) ? record.alertTone : 'default';
  const muteMode = isChatNotificationMuteMode(record?.muteMode) ? record.muteMode : 'off';
  const mutedUntil = typeof record?.mutedUntil === 'string' && record.mutedUntil.trim()
    ? record.mutedUntil.trim()
    : null;
  const normalizedMuteMode = isMuteModeActive(muteMode, mutedUntil) ? muteMode : 'off';

  return {
    alertTone,
    contactId,
    muteMode: normalizedMuteMode,
    mutedUntil: normalizedMuteMode === 'off' ? null : mutedUntil,
    updatedAt: null
  };
}

function getMutedUntilForMode(muteMode: ChatNotificationMuteMode, now: Date): string | null {
  if (muteMode === 'off' || muteMode === 'always') {
    return null;
  }

  return new Date(now.getTime() + MUTE_DURATION_MS[muteMode]).toISOString();
}

function isChatNotificationMuted(settings: ChatNotificationSettingsResponse): boolean {
  return isMuteModeActive(settings.muteMode, settings.mutedUntil);
}

function isMuteModeActive(muteMode: ChatNotificationMuteMode, mutedUntil: string | null): boolean {
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

function getNotificationPreviewForDevice(
  input: SendChatMessagePushNotificationInput,
  deviceId: string
): Record<string, string> | null {
  const preview = input.notificationPreviewByDevice?.[deviceId];

  if (!preview || !input.senderKeyAgreementPublicKey) {
    return null;
  }

  return {
    notificationPreviewAlgorithm: preview.algorithm,
    notificationPreviewCiphertext: preview.ciphertext,
    notificationPreviewNonce: preview.nonce,
    notificationPreviewSenderKeyAgreementPublicKey: input.senderKeyAgreementPublicKey,
    notificationPreviewVersion: String(preview.version)
  };
}

async function sendExpoPushBatch(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  const response = await fetch(EXPO_PUSH_SEND_URL, {
    body: JSON.stringify(messages),
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json'
    },
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error(`Expo push service returned ${response.status}.`);
  }

  const body = await response.json() as ExpoPushResponse;

  return body.data || [];
}

async function sendFcmPushBatch(messages: Message[]): Promise<ExpoPushTicket[]> {
  const response = await getMessaging(adminApp).sendEach(messages);

  return response.responses.map((result) => (
    result.success
      ? {
          id: result.messageId,
          status: 'ok'
        }
      : {
          details: {
            error: getFcmTicketError(result.error?.code)
          },
          message: result.error?.message,
          status: 'error'
        }
  ));
}

function annotatePushTickets(
  tickets: ExpoPushTicket[],
  records: Array<PushTokenRecord & { deviceId: string }>
): PushDeliveryTicket[] {
  return tickets.map((ticket, index) => {
    const record = records[index];

    return {
      ...ticket,
      deviceId: record?.deviceId || '',
      platform: record?.platform,
      provider: record?.provider
    };
  });
}

async function deactivateInvalidPushTokens(
  tenantId: string,
  uid: string,
  tickets: PushDeliveryTicket[]
): Promise<void> {
  const invalidDeviceIds = tickets
    .map((ticket) => (
      ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
        ? ticket.deviceId || ''
        : ''
    ))
    .filter(Boolean);

  if (!invalidDeviceIds.length) {
    return;
  }

  await Promise.all(invalidDeviceIds.map((deviceId) =>
    getUserPushTokenRef(tenantId, uid, deviceId).set({
      deactivatedAt: fieldValue.serverTimestamp(),
      deactivationReason: 'DeviceNotRegistered',
      status: 'INACTIVE',
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true })
  ));
}

function isDeliverablePushToken(record: PushTokenRecord): boolean {
  if (!record.provider || !record.token) {
    return false;
  }

  if (record.provider === 'expo') {
    return EXPO_PUSH_TOKEN_PATTERN.test(record.token);
  }

  return record.provider === 'fcm' && isValidFcmToken(record.token);
}

function isValidFcmToken(token: string): boolean {
  return token.length >= 20 && token.length <= 4096 && /^[A-Za-z0-9:_-]+$/.test(token);
}

function getFcmTicketError(code: string | undefined): string {
  if (
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-registration-token' ||
    code === 'messaging/invalid-argument'
  ) {
    return 'DeviceNotRegistered';
  }

  return code || 'UnknownError';
}

function getUserPushTokenRef(tenantId: string, uid: string, deviceId: string) {
  return firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('users')
    .doc(uid)
    .collection('pushTokens')
    .doc(deviceId);
}

function getChatNotificationSettingsRef(tenantId: string, uid: string, contactId: string) {
  return firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('users')
    .doc(uid)
    .collection('chatNotificationSettings')
    .doc(getChatNotificationSettingsDocumentId(contactId));
}

function getChatNotificationSettingsDocumentId(contactId: string): string {
  return createHash('sha256').update(contactId).digest('hex');
}

function getDisplayName(user: FirebaseFirestore.DocumentData | null | undefined): string {
  const displayName = typeof user?.displayName === 'string' ? user.displayName.trim() : '';
  const firstName = typeof user?.firstName === 'string' ? user.firstName.trim() : '';
  const lastName = typeof user?.lastName === 'string' ? user.lastName.trim() : '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  return displayName || fullName;
}

function getNotificationSenderProfilePhotoCacheKeys(
  input: SendChatMessagePushNotificationInput,
  user: FirebaseFirestore.DocumentData | null | undefined
): { fallback: string | null; primary: string | null } {
  const storagePath = typeof user?.profilePhotoStoragePath === 'string'
    ? user.profilePhotoStoragePath.trim()
    : '';

  if (!storagePath) {
    return {
      fallback: null,
      primary: null
    };
  }

  const version = getProfilePhotoVersion(user);
  const profilePhotoCacheKey = `profile-photo-${input.senderUid}-${version}`;

  if (input.chatType === 'GROUP' && input.notificationContactId) {
    return {
      fallback: profilePhotoCacheKey,
      primary: `group-member-photo-${input.notificationContactId}-${input.senderUid}-${version}`
    };
  }

  return {
    fallback: null,
    primary: profilePhotoCacheKey
  };
}

function getProfilePhotoVersion(user: FirebaseFirestore.DocumentData | null | undefined): number {
  const version = typeof user?.profilePhotoVersion === 'number' && Number.isFinite(user.profilePhotoVersion)
    ? Math.floor(user.profilePhotoVersion)
    : 1;

  return Math.max(1, version);
}

function validationError(message: string): Error {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
}
