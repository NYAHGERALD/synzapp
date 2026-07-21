import { DecodedIdToken } from 'firebase-admin/auth';
import { getMessaging, type Message } from 'firebase-admin/messaging';
import http2 from 'node:http2';
import { createHash, createPrivateKey, createSign, type KeyObject } from 'crypto';
import { adminApp, fieldValue, firestore } from '../config/firebaseAdmin.js';
import { DevicePlatform, verifyActiveRegisteredDevice } from './deviceIdentityService.js';
import type { EncryptedNotificationPreviewRecord } from './encryptedMessageEnvelopeService.js';
import { getChatUserPreference } from './chatUserPreferenceService.js';
import {
  getChatArchiveSettings,
  shouldTreatChatAsArchived
} from './chatArchiveSettingsService.js';

type PushProvider = 'apnsVoip' | 'expo' | 'fcm';
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

interface RecipientEnvelopeDeviceIdInput {
  notificationPreviewByDevice?: Record<string, unknown>;
  recipientDeviceIds?: string[];
}

interface SendChatMessagePushNotificationInput {
  chatType?: 'DIRECT' | 'GROUP';
  conversationId: string;
  envelopeId: string;
  notificationPreviewByDevice?: Record<string, EncryptedNotificationPreviewRecord>;
  notificationContactId?: string;
  recipientBadgeCount?: number;
  recipientDeviceIds?: string[];
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
  recipientDeviceIds?: string[];
  recipientUids: string[];
  senderKeyAgreementPublicKey?: string;
  senderUid: string;
  sentAt: string;
  tenantId: string;
}

interface SendCallInvitePushNotificationsInput {
  callId: string;
  callerName: string;
  callerUid: string;
  chatType: 'DIRECT' | 'GROUP';
  contactId: string;
  createdAt: string;
  mode: 'video' | 'voice';
  participantUids: string[];
  recipientUids: string[];
  tenantId: string;
  title: string;
}

interface SendCallEndedPushNotificationsInput {
  callId: string;
  endedByUid: string;
  reason: string;
  recipientUids: string[];
  tenantId: string;
}

interface SendRailsPushNotificationInput {
  actorUid: string;
  body: string;
  itemId?: string | null;
  metadata?: Record<string, string>;
  notificationId: string;
  recipientUids: string[];
  tenantId: string;
  title: string;
  type: string;
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

interface ApnsVoipConfig {
  bundleId: string;
  environment: 'production' | 'sandbox';
  keyId: string;
  privateKey: KeyObject;
  teamId: string;
}

interface ApnsVoipPushMessage {
  payload: Record<string, unknown>;
  token: string;
}

const EXPO_PUSH_SEND_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_TOKEN_PATTERN = /^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/;
const EXPO_PUSH_BATCH_SIZE = 100;
const FCM_PUSH_BATCH_SIZE = 500;
const APNS_VOIP_BATCH_SIZE = 100;
const MAX_PUSH_BADGE_COUNT = 9999;
const CALLS_CHANNEL_ID = 'synzapp-calls';
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
    (input.provider === 'apnsVoip' && !isValidApnsVoipToken(safeToken)) ||
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
  const userPushTokenRef = getUserPushTokenRef(
    activeDevice.tenantId,
    decodedToken.uid,
    activeDevice.deviceId,
    input.provider
  );
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
  const duplicatePushTokenCleanup = deactivateDuplicatePushTokensForUser(
    activeDevice.tenantId,
    decodedToken.uid,
    activeDevice.deviceId,
    input.provider,
    safeToken
  );

  await Promise.all([
    duplicatePushTokenCleanup,
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

async function deactivateDuplicatePushTokensForUser(
  tenantId: string,
  uid: string,
  currentDeviceId: string,
  currentProvider: PushProvider,
  token: string
): Promise<void> {
  const userRef = firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('users')
    .doc(uid);
  const snapshot = await userRef
    .collection('pushTokens')
    .where('token', '==', token)
    .where('status', '==', 'ACTIVE')
    .get();
  const currentTokenDocumentId = getPushTokenDocumentId(currentDeviceId, currentProvider);
  const staleTokenDocs = snapshot.docs.filter((doc) => doc.id !== currentTokenDocumentId);

  if (!staleTokenDocs.length) {
    return;
  }

  const update = {
    deactivatedAt: fieldValue.serverTimestamp(),
    replacedByDeviceId: currentDeviceId,
    replacedByPushTokenDocumentId: currentTokenDocumentId,
    status: 'INACTIVE',
    updatedAt: fieldValue.serverTimestamp()
  };

  await Promise.all(staleTokenDocs.flatMap((doc) => {
    const staleDeviceId = doc.id;

    return [
      doc.ref.set(update, { merge: true }),
      firestore
        .collection('organizations')
        .doc(tenantId)
        .collection('deviceKeys')
        .doc(staleDeviceId)
        .set({
          pushNotifications: {
            replacedByDeviceId: currentDeviceId,
            status: 'INACTIVE',
            updatedAt: fieldValue.serverTimestamp()
          },
          updatedAt: fieldValue.serverTimestamp()
        }, { merge: true }),
      userRef
        .collection('devices')
        .doc(staleDeviceId)
        .set({
          pushNotifications: {
            replacedByDeviceId: currentDeviceId,
            status: 'INACTIVE',
            updatedAt: fieldValue.serverTimestamp()
          },
          updatedAt: fieldValue.serverTimestamp()
        }, { merge: true })
    ];
  }));
}

export async function deactivateCurrentUserPushToken(
  decodedToken: DecodedIdToken,
  deviceId: string
): Promise<void> {
  const activeDevice = await verifyActiveRegisteredDevice(decodedToken, deviceId);
  const userRef = firestore
    .collection('organizations')
    .doc(activeDevice.tenantId)
    .collection('users')
    .doc(decodedToken.uid);
  const pushTokenSnapshot = await userRef
    .collection('pushTokens')
    .where('deviceId', '==', activeDevice.deviceId)
    .where('status', '==', 'ACTIVE')
    .get();
  const update = {
    deactivatedAt: fieldValue.serverTimestamp(),
    status: 'INACTIVE',
    updatedAt: fieldValue.serverTimestamp()
  };

  await Promise.all([
    ...pushTokenSnapshot.docs.map((doc) => doc.ref.set(update, { merge: true })),
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
  const recipientEnvelopeDeviceIds = getRecipientEnvelopeDeviceIds(input);
  const deliverablePushTokens = pushTokensSnapshot.docs
    .map((doc) => ({
      ...(doc.data() as PushTokenRecord),
      deviceId: getPushTokenRecordDeviceId(doc)
    }))
    .filter((record) => isDeliverablePushToken(record));
  const pushTokens = filterPushTokensForEncryptedEnvelope(deliverablePushTokens, input);
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
    recipientEnvelopeDeviceCount: recipientEnvelopeDeviceIds.size,
    recipientUid: input.recipientUid,
    recipientBadgeCount: unreadBadgeCount,
    status: isArchivedNotificationSuppressed
      ? 'ARCHIVED_SUPPRESSED'
      : isMuted
        ? 'MUTED'
        : pushTokens.length
          ? 'QUEUED'
          : recipientEnvelopeDeviceIds.size
            ? 'NO_ENVELOPE_DEVICE_TOKENS'
            : 'NO_ACTIVE_TOKENS',
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
    } else if (record.provider === 'expo') {
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

export async function sendRailsPushNotification(input: SendRailsPushNotificationInput): Promise<void> {
  const organizationRef = firestore.collection('organizations').doc(input.tenantId);
  const eventRef = organizationRef.collection('notificationEvents').doc(input.notificationId);
  const recipientUids = Array.from(new Set(input.recipientUids
    .map((recipientUid) => recipientUid.trim())
    .filter((recipientUid) => recipientUid && recipientUid !== input.actorUid)));

  await eventRef.set({
    actorUid: input.actorUid,
    channel: 'rails',
    createdAt: fieldValue.serverTimestamp(),
    itemId: input.itemId || null,
    notificationId: input.notificationId,
    recipientUids,
    status: recipientUids.length ? 'QUEUED' : 'NO_RECIPIENTS',
    tenantId: input.tenantId,
    title: input.title,
    type: input.type
  }, { merge: true });

  if (!recipientUids.length) {
    return;
  }

  const allTicketResults: PushDeliveryTicket[] = [];
  let totalTokenCount = 0;

  await Promise.all(recipientUids.map(async (recipientUid) => {
    const pushTokensSnapshot = await organizationRef
      .collection('users')
      .doc(recipientUid)
      .collection('pushTokens')
      .where('status', '==', 'ACTIVE')
      .get();
    const pushTokens = pushTokensSnapshot.docs
      .map((doc) => ({
        ...(doc.data() as PushTokenRecord),
        deviceId: getPushTokenRecordDeviceId(doc)
      }))
      .filter((record) => isDeliverablePushToken(record))
      .filter((record) => record.provider !== 'apnsVoip');
    const expoTargets: Array<{ message: ExpoPushMessage; record: PushTokenRecord & { deviceId: string } }> = [];
    const fcmTargets: Array<{ message: Message; record: PushTokenRecord & { deviceId: string } }> = [];

    totalTokenCount += pushTokens.length;

    for (const record of pushTokens) {
      const data = stripUndefinedStringValues({
        itemId: input.itemId || '',
        notificationId: input.notificationId,
        recipientUid,
        title: input.title,
        type: input.type,
        ...(input.metadata || {})
      });

      if (record.provider === 'fcm') {
        fcmTargets.push({
          message: {
            android: { priority: 'high' },
            data,
            notification: {
              body: input.body,
              title: input.title
            },
            token: record.token || ''
          },
          record
        });
      } else if (record.provider === 'expo') {
        expoTargets.push({
          message: {
            body: input.body,
            channelId: 'rails-updates',
            data,
            priority: 'high',
            sound: 'default',
            title: input.title,
            to: record.token || ''
          },
          record
        });
      }
    }

    for (let index = 0; index < expoTargets.length; index += EXPO_PUSH_BATCH_SIZE) {
      const targetBatch = expoTargets.slice(index, index + EXPO_PUSH_BATCH_SIZE);
      const tickets = await sendExpoPushBatch(targetBatch.map((target) => target.message));
      const annotatedTickets = annotatePushTickets(tickets, targetBatch.map((target) => target.record));

      allTicketResults.push(...annotatedTickets);
      await deactivateInvalidPushTokens(input.tenantId, recipientUid, annotatedTickets);
    }

    for (let index = 0; index < fcmTargets.length; index += FCM_PUSH_BATCH_SIZE) {
      const targetBatch = fcmTargets.slice(index, index + FCM_PUSH_BATCH_SIZE);
      const tickets = await sendFcmPushBatch(targetBatch.map((target) => target.message));
      const annotatedTickets = annotatePushTickets(tickets, targetBatch.map((target) => target.record));

      allTicketResults.push(...annotatedTickets);
      await deactivateInvalidPushTokens(input.tenantId, recipientUid, annotatedTickets);
    }
  }));

  const errorCount = allTicketResults.filter((ticket) => ticket.status === 'error').length;
  const sentCount = allTicketResults.filter((ticket) => ticket.status === 'ok').length;

  await eventRef.set({
    completedAt: fieldValue.serverTimestamp(),
    errorCount,
    sentCount,
    status: totalTokenCount
      ? errorCount && sentCount ? 'PARTIAL' : errorCount ? 'FAILED' : 'SENT'
      : 'NO_ACTIVE_TOKENS',
    tickets: allTicketResults.map((ticket) => ({
      details: ticket.details || null,
      deviceId: ticket.deviceId,
      id: ticket.id || null,
      message: ticket.message || null,
      platform: ticket.platform || null,
      provider: ticket.provider || null,
      status: ticket.status || 'error'
    })),
    tokenCount: totalTokenCount,
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
      recipientDeviceIds: input.recipientDeviceIds,
      recipientUid,
      senderKeyAgreementPublicKey: input.senderKeyAgreementPublicKey,
      senderUid: input.senderUid,
      sentAt: input.sentAt,
      tenantId: input.tenantId
    })
  ));
}

export async function sendCallInvitePushNotifications(
  input: SendCallInvitePushNotificationsInput
): Promise<void> {
  const recipientUids = Array.from(new Set(input.recipientUids
    .map((recipientUid) => recipientUid.trim())
    .filter((recipientUid) => recipientUid && recipientUid !== input.callerUid)));

  await Promise.all(recipientUids.map((recipientUid) =>
    sendCallInvitePushNotificationToRecipient(input, recipientUid)
  ));
}

async function sendCallInvitePushNotificationToRecipient(
  input: SendCallInvitePushNotificationsInput,
  recipientUid: string
): Promise<void> {
  const organizationRef = firestore.collection('organizations').doc(input.tenantId);
  const eventRef = organizationRef.collection('notificationEvents').doc();
  const pushTokensSnapshot = await organizationRef
    .collection('users')
    .doc(recipientUid)
    .collection('pushTokens')
    .where('status', '==', 'ACTIVE')
    .get();
  const pushTokens = pushTokensSnapshot.docs
    .map((doc) => ({
      ...(doc.data() as PushTokenRecord),
      deviceId: getPushTokenRecordDeviceId(doc)
    }))
    .filter((record) => isDeliverablePushToken(record));

  await eventRef.set({
    actorUid: input.callerUid,
    callId: input.callId,
    channel: 'call',
    contactId: input.contactId,
    createdAt: fieldValue.serverTimestamp(),
    mode: input.mode,
    recipientUid,
    status: pushTokens.length ? 'QUEUED' : 'NO_ACTIVE_TOKENS',
    tenantId: input.tenantId,
    tokenCount: pushTokens.length,
    type: 'call.incoming'
  });

  if (!pushTokens.length) {
    return;
  }

  const expoTargets: Array<{ message: ExpoPushMessage; record: PushTokenRecord & { deviceId: string } }> = [];
  const fcmTargets: Array<{ message: Message; record: PushTokenRecord & { deviceId: string } }> = [];
  const apnsTargets: Array<{ message: ApnsVoipPushMessage; record: PushTokenRecord & { deviceId: string } }> = [];
  const notificationTitle = input.callerName || input.title || 'Synzapp';
  const notificationBody = `Incoming ${input.mode === 'video' ? 'video' : 'voice'} call`;
  const baseData: Record<string, string> = {
    callId: input.callId,
    callerName: notificationTitle,
    callerUid: input.callerUid,
    chatType: input.chatType,
    contactId: input.contactId,
    createdAt: input.createdAt,
    mode: input.mode,
    participantUids: JSON.stringify(input.participantUids),
    tenantId: input.tenantId,
    title: input.title || notificationTitle,
    type: 'call.incoming'
  };

  for (const record of pushTokens) {
    if (record.provider === 'fcm') {
      fcmTargets.push({
        message: {
          android: {
            priority: 'high'
          },
          data: baseData,
          token: record.token || ''
        },
        record
      });
    } else {
      if (record.provider === 'apnsVoip') {
        apnsTargets.push({
          message: {
            payload: {
              ...baseData,
              aps: {}
            },
            token: record.token || ''
          },
          record
        });
        continue;
      }

      expoTargets.push({
        message: {
          body: notificationBody,
          channelId: CALLS_CHANNEL_ID,
          data: baseData,
          mutableContent: record.platform === 'ios',
          priority: 'high',
          sound: 'default',
          title: notificationTitle,
          to: record.token || ''
        },
        record
      });
    }
  }

  const ticketResults: PushDeliveryTicket[] = [];

  for (let index = 0; index < apnsTargets.length; index += APNS_VOIP_BATCH_SIZE) {
    const targetBatch = apnsTargets.slice(index, index + APNS_VOIP_BATCH_SIZE);
    const tickets = await sendApnsVoipPushBatch(targetBatch.map((target) => target.message));
    const annotatedTickets = annotatePushTickets(tickets, targetBatch.map((target) => target.record));

    logApnsVoipPushTickets('call.incoming', input.tenantId, recipientUid, annotatedTickets);
    ticketResults.push(...annotatedTickets);
    await deactivateInvalidPushTokens(input.tenantId, recipientUid, annotatedTickets);
  }

  for (let index = 0; index < expoTargets.length; index += EXPO_PUSH_BATCH_SIZE) {
    const targetBatch = expoTargets.slice(index, index + EXPO_PUSH_BATCH_SIZE);
    const tickets = await sendExpoPushBatch(targetBatch.map((target) => target.message));
    const annotatedTickets = annotatePushTickets(tickets, targetBatch.map((target) => target.record));

    ticketResults.push(...annotatedTickets);
    await deactivateInvalidPushTokens(input.tenantId, recipientUid, annotatedTickets);
  }

  for (let index = 0; index < fcmTargets.length; index += FCM_PUSH_BATCH_SIZE) {
    const targetBatch = fcmTargets.slice(index, index + FCM_PUSH_BATCH_SIZE);
    const tickets = await sendFcmPushBatch(targetBatch.map((target) => target.message));
    const annotatedTickets = annotatePushTickets(tickets, targetBatch.map((target) => target.record));

    ticketResults.push(...annotatedTickets);
    await deactivateInvalidPushTokens(input.tenantId, recipientUid, annotatedTickets);
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

export async function sendCallEndedPushNotifications(
  input: SendCallEndedPushNotificationsInput
): Promise<void> {
  const recipientUids = Array.from(new Set(input.recipientUids
    .map((recipientUid) => recipientUid.trim())
    .filter((recipientUid) => recipientUid && recipientUid !== input.endedByUid)));

  await Promise.all(recipientUids.map((recipientUid) =>
    sendCallEndedPushNotificationToRecipient(input, recipientUid)
  ));
}

async function sendCallEndedPushNotificationToRecipient(
  input: SendCallEndedPushNotificationsInput,
  recipientUid: string
): Promise<void> {
  const organizationRef = firestore.collection('organizations').doc(input.tenantId);
  const eventRef = organizationRef.collection('notificationEvents').doc();
  const pushTokensSnapshot = await organizationRef
    .collection('users')
    .doc(recipientUid)
    .collection('pushTokens')
    .where('status', '==', 'ACTIVE')
    .get();
  const pushTokens = pushTokensSnapshot.docs
    .map((doc) => ({
      ...(doc.data() as PushTokenRecord),
      deviceId: getPushTokenRecordDeviceId(doc)
    }))
    .filter((record) => isDeliverablePushToken(record));

  await eventRef.set({
    actorUid: input.endedByUid,
    callId: input.callId,
    channel: 'call',
    createdAt: fieldValue.serverTimestamp(),
    reason: input.reason,
    recipientUid,
    status: pushTokens.length ? 'QUEUED' : 'NO_ACTIVE_TOKENS',
    tenantId: input.tenantId,
    tokenCount: pushTokens.length,
    type: 'call.ended'
  });

  if (!pushTokens.length) {
    return;
  }

  const baseData: Record<string, string> = {
    callId: input.callId,
    endedByUid: input.endedByUid,
    reason: input.reason,
    tenantId: input.tenantId,
    type: 'call.ended'
  };
  const expoTargets: Array<{ message: ExpoPushMessage; record: PushTokenRecord & { deviceId: string } }> = [];
  const fcmTargets: Array<{ message: Message; record: PushTokenRecord & { deviceId: string } }> = [];
  const apnsTargets: Array<{ message: ApnsVoipPushMessage; record: PushTokenRecord & { deviceId: string } }> = [];

  for (const record of pushTokens) {
    if (record.provider === 'fcm') {
      fcmTargets.push({
        message: {
          android: {
            priority: 'high'
          },
          data: baseData,
          token: record.token || ''
        },
        record
      });
    } else if (record.provider === 'apnsVoip') {
      apnsTargets.push({
        message: {
          payload: {
            ...baseData,
            aps: {}
          },
          token: record.token || ''
        },
        record
      });
    } else {
      expoTargets.push({
        message: {
          data: baseData,
          priority: 'high',
          to: record.token || ''
        },
        record
      });
    }
  }

  const ticketResults: PushDeliveryTicket[] = [];

  for (let index = 0; index < apnsTargets.length; index += APNS_VOIP_BATCH_SIZE) {
    const targetBatch = apnsTargets.slice(index, index + APNS_VOIP_BATCH_SIZE);
    const tickets = await sendApnsVoipPushBatch(targetBatch.map((target) => target.message));
    const annotatedTickets = annotatePushTickets(tickets, targetBatch.map((target) => target.record));

    logApnsVoipPushTickets('call.ended', input.tenantId, recipientUid, annotatedTickets);
    ticketResults.push(...annotatedTickets);
    await deactivateInvalidPushTokens(input.tenantId, recipientUid, annotatedTickets);
  }

  for (let index = 0; index < expoTargets.length; index += EXPO_PUSH_BATCH_SIZE) {
    const targetBatch = expoTargets.slice(index, index + EXPO_PUSH_BATCH_SIZE);
    const tickets = await sendExpoPushBatch(targetBatch.map((target) => target.message));
    const annotatedTickets = annotatePushTickets(tickets, targetBatch.map((target) => target.record));

    ticketResults.push(...annotatedTickets);
    await deactivateInvalidPushTokens(input.tenantId, recipientUid, annotatedTickets);
  }

  for (let index = 0; index < fcmTargets.length; index += FCM_PUSH_BATCH_SIZE) {
    const targetBatch = fcmTargets.slice(index, index + FCM_PUSH_BATCH_SIZE);
    const tickets = await sendFcmPushBatch(targetBatch.map((target) => target.message));
    const annotatedTickets = annotatePushTickets(tickets, targetBatch.map((target) => target.record));

    ticketResults.push(...annotatedTickets);
    await deactivateInvalidPushTokens(input.tenantId, recipientUid, annotatedTickets);
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

export function filterPushTokensForEncryptedEnvelope<T extends { deviceId?: string }>(
  pushTokens: T[],
  input: RecipientEnvelopeDeviceIdInput
): T[] {
  const recipientEnvelopeDeviceIds = getRecipientEnvelopeDeviceIds(input);

  if (!recipientEnvelopeDeviceIds.size) {
    return pushTokens;
  }

  return pushTokens.filter((record) => recipientEnvelopeDeviceIds.has(record.deviceId || ''));
}

function getRecipientEnvelopeDeviceIds(input: RecipientEnvelopeDeviceIdInput): Set<string> {
  const recipientDeviceIds = (input.recipientDeviceIds || [])
    .filter((deviceId) => Boolean(deviceId));

  if (recipientDeviceIds.length) {
    return new Set(recipientDeviceIds);
  }

  const deviceIds = new Set<string>();

  Object.keys(input.notificationPreviewByDevice || {}).forEach((deviceId) => {
    if (deviceId) {
      deviceIds.add(deviceId);
    }
  });

  return deviceIds;
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

async function sendApnsVoipPushBatch(messages: ApnsVoipPushMessage[]): Promise<ExpoPushTicket[]> {
  const config = getApnsVoipConfig();

  if (!config) {
    if (messages.length) {
      console.warn('APNs VoIP push skipped because credentials are not configured.', {
        count: messages.length
      });
    }

    return messages.map(() => ({
      details: {
        error: 'MissingApnsVoipCredentials'
      },
      message: 'APNs VoIP credentials are not configured.',
      status: 'error'
    }));
  }

  const client = http2.connect(getApnsVoipOrigin(config.environment));

  try {
    return await Promise.all(messages.map((message) => sendApnsVoipPush(client, config, message)));
  } finally {
    client.close();
  }
}

function sendApnsVoipPush(
  client: http2.ClientHttp2Session,
  config: ApnsVoipConfig,
  message: ApnsVoipPushMessage
): Promise<ExpoPushTicket> {
  return new Promise((resolve) => {
    const apnsId = createHash('sha256')
      .update(`${message.token}:${Date.now()}:${Math.random()}`)
      .digest('hex')
      .slice(0, 32);
    const request = client.request({
      ':method': 'POST',
      ':path': `/3/device/${message.token}`,
      authorization: `bearer ${createApnsProviderToken(config)}`,
      'apns-expiration': '0',
      'apns-id': apnsId,
      'apns-priority': '10',
      'apns-push-type': 'voip',
      'apns-topic': `${config.bundleId}.voip`,
      'content-type': 'application/json'
    });
    let status = 0;
    let responseBody = '';

    request.setEncoding('utf8');
    request.on('response', (headers) => {
      const rawStatus = headers[':status'];
      status = typeof rawStatus === 'number' ? rawStatus : Number(rawStatus || 0);
    });
    request.on('data', (chunk) => {
      responseBody += String(chunk);
    });
    request.on('end', () => {
      if (status >= 200 && status < 300) {
        resolve({
          id: apnsId,
          status: 'ok'
        });
        return;
      }

      const reason = getApnsErrorReason(responseBody);

      resolve({
        details: {
          error: getApnsTicketError(status, reason)
        },
        message: reason || `APNs VoIP push failed with ${status}.`,
        status: 'error'
      });
    });
    request.on('error', (error) => {
      resolve({
        details: {
          error: 'ApnsVoipRequestFailed'
        },
        message: error.message,
        status: 'error'
      });
    });
    request.end(JSON.stringify(message.payload));
  });
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

function logApnsVoipPushTickets(
  type: 'call.ended' | 'call.incoming',
  tenantId: string,
  uid: string,
  tickets: PushDeliveryTicket[]
): void {
  const apnsTickets = tickets.filter((ticket) => ticket.provider === 'apnsVoip');

  if (!apnsTickets.length) {
    return;
  }

  const failedTickets = apnsTickets.filter((ticket) => ticket.status === 'error');

  if (!failedTickets.length) {
    console.info('APNs VoIP push accepted.', {
      count: apnsTickets.length,
      tenantId,
      type,
      uid
    });
    return;
  }

  console.warn('APNs VoIP push failed.', {
    errors: failedTickets.map((ticket) => ({
      deviceId: ticket.deviceId,
      error: ticket.details?.error,
      message: ticket.message
    })),
    failedCount: failedTickets.length,
    sentCount: apnsTickets.length - failedTickets.length,
    tenantId,
    type,
    uid
  });
}

async function deactivateInvalidPushTokens(
  tenantId: string,
  uid: string,
  tickets: PushDeliveryTicket[]
): Promise<void> {
  const invalidTargets = tickets
    .filter((ticket) => ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered')
    .map((ticket) => ({
      deviceId: ticket.deviceId || '',
      provider: ticket.provider
    }))
    .filter((target): target is { deviceId: string; provider: PushProvider } => (
      Boolean(target.deviceId) &&
      (target.provider === 'apnsVoip' || target.provider === 'expo' || target.provider === 'fcm')
    ));

  if (!invalidTargets.length) {
    return;
  }

  await Promise.all(invalidTargets.map((target) =>
    getUserPushTokenRef(tenantId, uid, target.deviceId, target.provider).set({
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

  if (record.provider === 'apnsVoip') {
    return isValidApnsVoipToken(record.token);
  }

  if (record.provider === 'expo') {
    return EXPO_PUSH_TOKEN_PATTERN.test(record.token);
  }

  return record.provider === 'fcm' && isValidFcmToken(record.token);
}

function stripUndefinedStringValues(value: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, String(entryValue)])
  );
}

function isValidApnsVoipToken(token: string): boolean {
  return token.length >= 32 && token.length <= 512 && /^[A-Fa-f0-9]+$/.test(token);
}

function isValidFcmToken(token: string): boolean {
  return token.length >= 20 && token.length <= 4096 && /^[A-Za-z0-9:_-]+$/.test(token);
}

function getApnsVoipConfig(): ApnsVoipConfig | null {
  const teamId = getEnvValue('APNS_TEAM_ID');
  const keyId = getEnvValue('APNS_KEY_ID');
  const rawPrivateKey = getEnvValue('APNS_AUTH_KEY');
  const bundleId = getEnvValue('APNS_BUNDLE_ID') || 'com.synzapp.mobile';

  if (!teamId || !keyId || !rawPrivateKey || !bundleId) {
    return null;
  }

  try {
    return {
      bundleId,
      environment: getApnsVoipEnvironment(),
      keyId,
      privateKey: createPrivateKey(rawPrivateKey.replace(/\\n/g, '\n')),
      teamId
    };
  } catch {
    return null;
  }
}

function getApnsVoipEnvironment(): 'production' | 'sandbox' {
  const environment = getEnvValue('APNS_ENVIRONMENT')?.toLowerCase();

  return environment === 'production' ? 'production' : 'sandbox';
}

function getApnsVoipOrigin(environment: 'production' | 'sandbox'): string {
  return environment === 'production'
    ? 'https://api.push.apple.com'
    : 'https://api.sandbox.push.apple.com';
}

function createApnsProviderToken(config: ApnsVoipConfig): string {
  const header = encodeBase64Url(JSON.stringify({
    alg: 'ES256',
    kid: config.keyId
  }));
  const claims = encodeBase64Url(JSON.stringify({
    iat: Math.floor(Date.now() / 1000),
    iss: config.teamId
  }));
  const signingInput = `${header}.${claims}`;
  const signature = createSign('SHA256')
    .update(signingInput)
    .end()
    .sign(config.privateKey)
    .toString('base64url');

  return `${signingInput}.${signature}`;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function getApnsErrorReason(responseBody: string): string {
  if (!responseBody) {
    return '';
  }

  try {
    const body = JSON.parse(responseBody) as { reason?: unknown };

    return typeof body.reason === 'string' ? body.reason : '';
  } catch {
    return '';
  }
}

function getApnsTicketError(status: number, reason: string): string {
  if (
    status === 410 ||
    reason === 'BadDeviceToken' ||
    reason === 'DeviceTokenNotForTopic' ||
    reason === 'Unregistered'
  ) {
    return 'DeviceNotRegistered';
  }

  return reason || `ApnsVoip${status || 'Error'}`;
}

function getEnvValue(name: string): string | null {
  const value = process.env[name];

  return typeof value === 'string' && value.trim() ? value.trim() : null;
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

function getUserPushTokenRef(tenantId: string, uid: string, deviceId: string, provider: PushProvider) {
  return firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('users')
    .doc(uid)
    .collection('pushTokens')
    .doc(getPushTokenDocumentId(deviceId, provider));
}

function getPushTokenDocumentId(deviceId: string, provider: PushProvider): string {
  return `${deviceId}:${provider}`;
}

function getPushTokenRecordDeviceId(doc: FirebaseFirestore.QueryDocumentSnapshot): string {
  const data = doc.data() as PushTokenRecord;

  return typeof data.deviceId === 'string' && data.deviceId.trim()
    ? data.deviceId.trim()
    : doc.id;
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
