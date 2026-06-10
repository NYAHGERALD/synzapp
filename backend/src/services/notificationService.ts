import { DecodedIdToken } from 'firebase-admin/auth';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import { DevicePlatform, verifyActiveRegisteredDevice } from './deviceIdentityService.js';

type PushProvider = 'expo';
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
  recipientUid: string;
  senderUid: string;
  sentAt: string;
  tenantId: string;
}

interface ExpoPushMessage {
  body: string;
  channelId: string;
  data: Record<string, string>;
  priority: 'default' | 'high' | 'normal';
  sound: 'default';
  title: string;
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

interface ExpoPushResponse {
  data?: ExpoPushTicket[];
  errors?: unknown[];
}

const EXPO_PUSH_SEND_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_TOKEN_PATTERN = /^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/;
const EXPO_PUSH_BATCH_SIZE = 100;

export async function registerCurrentUserPushToken(
  decodedToken: DecodedIdToken,
  input: RegisterPushTokenInput
): Promise<RegisteredPushTokenResponse> {
  const activeDevice = await verifyActiveRegisteredDevice(decodedToken, input.deviceId);
  const safeToken = input.token.trim();

  if (input.provider !== 'expo' || !EXPO_PUSH_TOKEN_PATTERN.test(safeToken)) {
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
    .filter((record) => record.provider === 'expo' && record.token && EXPO_PUSH_TOKEN_PATTERN.test(record.token));

  await eventRef.set({
    actorUid: input.senderUid,
    channel: 'chat',
    conversationId: input.conversationId,
    createdAt: fieldValue.serverTimestamp(),
    envelopeId: input.envelopeId,
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
  const messages = pushTokens.map((record) => ({
    body: 'New message',
    channelId: 'chat-messages',
    data: {
      contactId: input.senderUid,
      conversationId: input.conversationId,
      envelopeId: input.envelopeId,
      sentAt: input.sentAt,
      type: 'chat.message'
    },
    priority: 'high',
    sound: 'default',
    title: senderName || 'Synzapp',
    to: record.token || ''
  } satisfies ExpoPushMessage));
  const ticketResults: ExpoPushTicket[] = [];

  for (let index = 0; index < messages.length; index += EXPO_PUSH_BATCH_SIZE) {
    const messageBatch = messages.slice(index, index + EXPO_PUSH_BATCH_SIZE);
    const tokenBatch = pushTokens.slice(index, index + EXPO_PUSH_BATCH_SIZE);
    const tickets = await sendExpoPushBatch(messageBatch);

    ticketResults.push(...tickets);
    await deactivateInvalidExpoPushTokens(input.tenantId, input.recipientUid, tokenBatch, tickets);
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
      id: ticket.id || null,
      message: ticket.message || null,
      status: ticket.status || 'error'
    })),
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });
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

async function deactivateInvalidExpoPushTokens(
  tenantId: string,
  uid: string,
  pushTokens: Array<PushTokenRecord & { deviceId: string }>,
  tickets: ExpoPushTicket[]
): Promise<void> {
  const invalidDeviceIds = tickets
    .map((ticket, index) => (
      ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
        ? pushTokens[index]?.deviceId || ''
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
