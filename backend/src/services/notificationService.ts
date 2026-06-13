import { DecodedIdToken } from 'firebase-admin/auth';
import { getMessaging, type Message } from 'firebase-admin/messaging';
import { adminApp, fieldValue, firestore } from '../config/firebaseAdmin.js';
import { DevicePlatform, verifyActiveRegisteredDevice } from './deviceIdentityService.js';
import type { EncryptedNotificationPreviewRecord } from './encryptedMessageEnvelopeService.js';

type PushProvider = 'expo' | 'fcm';
type PushTokenStatus = 'ACTIVE' | 'INACTIVE';

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

interface SendChatMessagePushNotificationInput {
  conversationId: string;
  envelopeId: string;
  notificationPreviewByDevice?: Record<string, EncryptedNotificationPreviewRecord>;
  recipientUid: string;
  senderUid: string;
  senderKeyAgreementPublicKey?: string;
  sentAt: string;
  tenantId: string;
}

interface ExpoPushMessage {
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

export async function sendChatMessagePushNotification(
  input: SendChatMessagePushNotificationInput
): Promise<void> {
  const organizationRef = firestore.collection('organizations').doc(input.tenantId);
  const eventRef = organizationRef.collection('notificationEvents').doc();
  const [senderSnapshot, pushTokensSnapshot] = await Promise.all([
    organizationRef.collection('users').doc(input.senderUid).get(),
    organizationRef
      .collection('users')
      .doc(input.recipientUid)
      .collection('pushTokens')
      .where('status', '==', 'ACTIVE')
      .get()
  ]);
  const pushTokens = pushTokensSnapshot.docs
    .map((doc) => ({
      ...(doc.data() as PushTokenRecord),
      deviceId: doc.id
    }))
    .filter((record) => isDeliverablePushToken(record));

  await eventRef.set({
    actorUid: input.senderUid,
    channel: 'chat',
    conversationId: input.conversationId,
    createdAt: fieldValue.serverTimestamp(),
    envelopeId: input.envelopeId,
    encryptedPreviewCount: input.notificationPreviewByDevice
      ? Object.keys(input.notificationPreviewByDevice).length
      : 0,
    recipientUid: input.recipientUid,
    status: pushTokens.length ? 'QUEUED' : 'NO_ACTIVE_TOKENS',
    tenantId: input.tenantId,
    tokenCount: pushTokens.length,
    type: 'chat.message'
  });

  if (!pushTokens.length) {
    return;
  }

  const senderName = getDisplayName(senderSnapshot.exists ? senderSnapshot.data() : null);
  const expoTargets: Array<{ message: ExpoPushMessage; record: PushTokenRecord & { deviceId: string } }> = [];
  const fcmTargets: Array<{ message: Message; record: PushTokenRecord & { deviceId: string } }> = [];

  for (const record of pushTokens) {
    const notificationPreview = getNotificationPreviewForDevice(input, record.deviceId || '');
    const title = senderName || 'Synzapp';
    const baseData: Record<string, string> = {
      contactId: input.senderUid,
      conversationId: input.conversationId,
      envelopeId: input.envelopeId,
      notificationFallbackBody: notificationPreview ? 'New encrypted message' : 'New message',
      notificationTitle: title,
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
          body: notificationPreview ? 'New encrypted message' : 'New message',
          channelId: 'chat-messages',
          data,
          mutableContent: record.platform === 'ios' && Boolean(notificationPreview),
          priority: 'high',
          sound: 'default',
          title,
          to: record.token || ''
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

function getDisplayName(user: FirebaseFirestore.DocumentData | null | undefined): string {
  const displayName = typeof user?.displayName === 'string' ? user.displayName.trim() : '';
  const firstName = typeof user?.firstName === 'string' ? user.firstName.trim() : '';
  const lastName = typeof user?.lastName === 'string' ? user.lastName.trim() : '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  return displayName || fullName;
}

function validationError(message: string): Error {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
}
