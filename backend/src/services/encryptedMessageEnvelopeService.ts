import { createHash } from 'node:crypto';
import { DecodedIdToken } from 'firebase-admin/auth';
import type { DocumentReference } from 'firebase-admin/firestore';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import { SynzappRole } from '../types/auth.js';
import { buildAuthSession } from './authSessionService.js';

const ENCRYPTED_ENVELOPE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const READ_ENVELOPE_RECEIPT_GRACE_MS = 5 * 60 * 1000;
const DELIVERED_ENVELOPE_RETENTION_MS = 24 * 60 * 60 * 1000;

export interface SendEncryptedDirectEnvelopeInput {
  algorithm: string;
  ciphertext: string;
  clientMessageId: string;
  encryptedKeysByDevice: Record<string, string>;
  keyVersion: number;
  nonce: string;
  notificationPreviewByDevice?: Record<string, EncryptedNotificationPreviewRecord>;
  recipientDeviceIds: string[];
  senderDeviceId: string;
}

export interface EncryptedNotificationPreviewRecord {
  algorithm: 'x25519-sha256-aes-256-gcm+synzapp-notification-preview-v1';
  ciphertext: string;
  nonce: string;
  version: 1;
}

export interface EncryptedDirectEnvelopeResponse {
  algorithm: string;
  clientMessageId: string;
  conversationId: string;
  envelopeId: string;
  keyVersion: number;
  notificationPreviewByDevice?: Record<string, EncryptedNotificationPreviewRecord>;
  recipientDeviceIds: string[];
  senderDeviceId: string;
  senderKeyAgreementPublicKey: string;
  sentAt: string;
  tenantId: string;
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

export interface DirectEncryptionContextResponse {
  recipientDevices: EncryptionDevicePublicKey[];
  senderDevice: EncryptionDevicePublicKey;
}

export interface EncryptedDirectEnvelopeForDevice {
  algorithm: string;
  ciphertext: string;
  clientMessageId: string;
  deliveryStatus: 'delivered' | 'read' | 'sent' | null;
  encryptedKeyForDevice: string;
  envelopeId: string;
  keyVersion: number;
  nonce: string;
  senderDeviceId: string;
  senderKeyAgreementPublicKey: string;
  senderUid: string;
  sentAt: string;
}

interface OrganizationRecord {
  status?: string;
}

interface TenantUserRecord {
  role?: SynzappRole;
  status?: string;
}

interface DeviceKeyRecord {
  deviceId?: string;
  identityPublicKey?: string;
  keyAgreementPublicKey?: string;
  keyVersion?: number;
  platform?: string;
  signingPublicKey?: string;
  status?: string;
  tenantId?: string;
  uid?: string;
}

interface EncryptedEnvelopeRecord {
  algorithm?: string;
  ciphertext?: string;
  clientMessageId?: string;
  deliveredAtMsByDevice?: Record<string, number>;
  encryptedKeysByDevice?: Record<string, string>;
  envelopeId?: string;
  expiresAtMs?: number;
  keyVersion?: number;
  nonce?: string;
  notificationPreviewByDevice?: Record<string, EncryptedNotificationPreviewRecord>;
  readAtMsByDevice?: Record<string, number>;
  recipientDeviceIds?: string[];
  recipientUid?: string;
  senderDeviceId?: string;
  senderKeyAgreementPublicKey?: string;
  senderUid?: string;
  sentAtMs?: number;
}

interface EncryptedMessageMetadataRecord {
  clientMessageId?: string;
  envelopeId?: string;
  participantIds?: string[];
  recipientUid?: string;
  senderUid?: string;
  sentAtMs?: number;
  status?: string;
  tenantId?: string;
}

interface ListEncryptedDirectEnvelopeOptions {
  limit?: number;
  markAsDelivered?: boolean;
  markAsRead?: boolean;
}

export async function getDirectEncryptionContext(
  decodedToken: DecodedIdToken,
  contactId: string,
  senderDeviceId: string
): Promise<DirectEncryptionContextResponse> {
  const context = await getEncryptedDirectContext(decodedToken, contactId);
  const [senderDevice, recipientDevices] = await Promise.all([
    getActiveDevice(context.tenantId, decodedToken.uid, senderDeviceId),
    listActiveDevicesForUser(context.tenantId, context.contactId)
  ]);

  if (!senderDevice) {
    throw authorizationError('This device is not authorized.');
  }

  if (!recipientDevices.length) {
    throw validationError('The recipient does not have an active device yet.');
  }

  return {
    recipientDevices: recipientDevices.map(mapDevicePublicKey),
    senderDevice: mapDevicePublicKey(senderDevice)
  };
}

export async function listEncryptedDirectEnvelopesForDevice(
  decodedToken: DecodedIdToken,
  contactId: string,
  deviceId: string,
  options: ListEncryptedDirectEnvelopeOptions = {}
): Promise<EncryptedDirectEnvelopeForDevice[]> {
  const context = await getEncryptedDirectContext(decodedToken, contactId);
  const activeDevice = await getActiveDevice(context.tenantId, decodedToken.uid, deviceId);

  if (!activeDevice) {
    throw authorizationError('This device is not authorized.');
  }

  const shouldMarkDelivered = options.markAsDelivered !== false;
  const shouldMarkRead = options.markAsRead !== false;

  await cleanupRetainedEncryptedEnvelopes(context.chatRef);

  const envelopesSnapshot = await context.chatRef
    .collection('encryptedEnvelopes')
    .orderBy('sentAtMs', 'asc')
    .limit(options.limit || 100)
    .get();
  const nowMs = Date.now();
  const batch = firestore.batch();
  let hasBatchUpdates = false;
  const envelopes = envelopesSnapshot.docs
    .map((doc) => {
      const record = doc.data() as EncryptedEnvelopeRecord;
      const encryptedKeyForDevice = record.encryptedKeysByDevice?.[deviceId];

      if (!encryptedKeyForDevice) {
        return null;
      }

      if (record.senderUid !== decodedToken.uid) {
        const deliveredAtMs = record.deliveredAtMsByDevice?.[deviceId];
        const readAtMs = record.readAtMsByDevice?.[deviceId];
        const deliveryUpdate: {
          deliveredAtMsByDevice?: Record<string, number>;
          readAtMsByDevice?: Record<string, number>;
          status?: string;
          updatedAt: FirebaseFirestore.FieldValue;
        } = {
          updatedAt: fieldValue.serverTimestamp()
        };

        if (shouldMarkDelivered && !deliveredAtMs) {
          deliveryUpdate.deliveredAtMsByDevice = {
            [deviceId]: nowMs
          };
          deliveryUpdate.status = 'DELIVERED';
        }

        if (shouldMarkRead && !readAtMs) {
          deliveryUpdate.deliveredAtMsByDevice = {
            [deviceId]: deliveredAtMs || nowMs
          };
          deliveryUpdate.readAtMsByDevice = {
            [deviceId]: nowMs
          };
          deliveryUpdate.status = 'READ';
        }

        if (deliveryUpdate.deliveredAtMsByDevice || deliveryUpdate.readAtMsByDevice) {
          batch.set(doc.ref, deliveryUpdate, { merge: true });
          hasBatchUpdates = true;
        }
      }

      return mapEncryptedEnvelopeForDevice(decodedToken.uid, deviceId, doc.id, record, encryptedKeyForDevice);
    })
    .filter((envelope): envelope is EncryptedDirectEnvelopeForDevice => Boolean(envelope));

  if (hasBatchUpdates) {
    await batch.commit();
  }

  if (shouldMarkRead) {
    await context.chatRef.set({
      lastReadAtByUser: {
        [decodedToken.uid]: fieldValue.serverTimestamp()
      },
      unreadCounts: {
        [decodedToken.uid]: 0
      },
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });
  }

  await cleanupRetainedEncryptedEnvelopes(context.chatRef);

  return envelopes;
}

export async function markEncryptedDirectEnvelopesDeliveredForDevice(
  decodedToken: DecodedIdToken,
  contactId: string,
  deviceId: string
): Promise<EncryptedDirectEnvelopeForDevice[]> {
  return listEncryptedDirectEnvelopesForDevice(decodedToken, contactId, deviceId, {
    limit: 50,
    markAsDelivered: true,
    markAsRead: false
  });
}

export async function sendEncryptedDirectEnvelope(
  decodedToken: DecodedIdToken,
  contactId: string,
  input: SendEncryptedDirectEnvelopeInput
): Promise<EncryptedDirectEnvelopeResponse> {
  const context = await getEncryptedDirectContext(decodedToken, contactId);
  const uniqueRecipientDeviceIds = Array.from(new Set(input.recipientDeviceIds));

  if (uniqueRecipientDeviceIds.length !== input.recipientDeviceIds.length) {
    throw validationError('Recipient devices must be unique.');
  }

  await assertActiveDevice(context.tenantId, decodedToken.uid, input.senderDeviceId);
  await assertActiveRecipientDevices(context.tenantId, context.contactId, uniqueRecipientDeviceIds);
  const senderDevice = await getActiveDevice(context.tenantId, decodedToken.uid, input.senderDeviceId);

  if (!senderDevice?.keyAgreementPublicKey) {
    throw authorizationError('This device is not authorized.');
  }

  uniqueRecipientDeviceIds.forEach((deviceId) => {
    if (!input.encryptedKeysByDevice[deviceId]) {
      throw validationError('Encrypted key material is missing for a recipient device.');
    }

    if (input.notificationPreviewByDevice && !input.notificationPreviewByDevice[deviceId]) {
      throw validationError('Encrypted notification preview is missing for a recipient device.');
    }
  });

  const envelopeRef = context.chatRef.collection('encryptedEnvelopes').doc();
  const messageMetadataRef = context.chatRef.collection('messageMetadata').doc(envelopeRef.id);
  const sentAtMs = Date.now();
  const participantIds = [decodedToken.uid, context.contactId].sort();

  await firestore.runTransaction(async (transaction) => {
    const chatSnapshot = await transaction.get(context.chatRef);
    const chatCreateData = chatSnapshot.exists
      ? {}
      : {
          chatId: context.chatId,
          createdAt: fieldValue.serverTimestamp(),
          participantIds,
          participants: {
            [participantIds[0]]: true,
            [participantIds[1]]: true
          },
          tenantId: context.tenantId
        };

    transaction.set(envelopeRef, {
      algorithm: input.algorithm,
      ciphertext: input.ciphertext,
      clientMessageId: input.clientMessageId,
      createdAt: fieldValue.serverTimestamp(),
      encryptedKeysByDevice: input.encryptedKeysByDevice,
      envelopeId: envelopeRef.id,
      expiresAtMs: sentAtMs + ENCRYPTED_ENVELOPE_TTL_MS,
      keyVersion: input.keyVersion,
      nonce: input.nonce,
      ...(input.notificationPreviewByDevice
        ? { notificationPreviewByDevice: input.notificationPreviewByDevice }
        : {}),
      recipientDeviceIds: uniqueRecipientDeviceIds,
      recipientUid: context.contactId,
      senderDeviceId: input.senderDeviceId,
      senderKeyAgreementPublicKey: senderDevice.keyAgreementPublicKey,
      senderUid: decodedToken.uid,
      sentAtMs,
      status: 'PENDING_DELIVERY',
      tenantId: context.tenantId,
      updatedAt: fieldValue.serverTimestamp()
    });

    transaction.set(messageMetadataRef, {
      clientMessageId: input.clientMessageId,
      conversationId: context.chatId,
      createdAt: fieldValue.serverTimestamp(),
      envelopeId: envelopeRef.id,
      participantIds,
      recipientUid: context.contactId,
      senderUid: decodedToken.uid,
      sentAtMs,
      status: 'ACTIVE',
      tenantId: context.tenantId,
      updatedAt: fieldValue.serverTimestamp()
    } satisfies EncryptedMessageMetadataRecord & {
      conversationId: string;
      createdAt: FirebaseFirestore.FieldValue;
      updatedAt: FirebaseFirestore.FieldValue;
    });

    transaction.set(context.chatRef, {
      ...chatCreateData,
      encryptionMode: 'E2EE',
      lastEncryptedEnvelopeId: envelopeRef.id,
      lastMessageId: envelopeRef.id,
      lastMessageSenderUid: decodedToken.uid,
      lastMessageSentAtMs: sentAtMs,
      lastMessageText: null,
      serverEnvelopeExpiresAtMs: sentAtMs + ENCRYPTED_ENVELOPE_TTL_MS,
      unreadCounts: {
        [decodedToken.uid]: 0,
        [context.contactId]: fieldValue.increment(1)
      },
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });
  });

  return {
    algorithm: input.algorithm,
    clientMessageId: input.clientMessageId,
    conversationId: context.chatId,
    envelopeId: envelopeRef.id,
    keyVersion: input.keyVersion,
    notificationPreviewByDevice: input.notificationPreviewByDevice,
    recipientDeviceIds: uniqueRecipientDeviceIds,
    senderDeviceId: input.senderDeviceId,
    senderKeyAgreementPublicKey: senderDevice.keyAgreementPublicKey,
    sentAt: new Date(sentAtMs).toISOString(),
    tenantId: context.tenantId
  };
}

async function listActiveDevicesForUser(
  tenantId: string,
  uid: string
): Promise<DeviceKeyRecord[]> {
  const snapshot = await firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('deviceKeys')
    .where('uid', '==', uid)
    .where('status', '==', 'ACTIVE')
    .get();

  return snapshot.docs
    .map((doc) => ({ ...(doc.data() as DeviceKeyRecord), deviceId: (doc.data() as DeviceKeyRecord).deviceId || doc.id }))
    .filter((device) => Boolean(device.keyAgreementPublicKey));
}

async function getActiveDevice(
  tenantId: string,
  uid: string,
  deviceId: string
): Promise<DeviceKeyRecord | null> {
  const snapshot = await firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('deviceKeys')
    .doc(deviceId)
    .get();

  if (!snapshot.exists) {
    return null;
  }

  const device = snapshot.data() as DeviceKeyRecord;

  if (device.tenantId !== tenantId || device.uid !== uid || device.status !== 'ACTIVE') {
    return null;
  }

  return {
    ...device,
    deviceId: device.deviceId || snapshot.id
  };
}

async function cleanupRetainedEncryptedEnvelopes(chatRef: DocumentReference): Promise<void> {
  const nowMs = Date.now();
  const expiredSnapshot = await chatRef
    .collection('encryptedEnvelopes')
    .where('expiresAtMs', '<=', nowMs)
    .limit(50)
    .get();

  const recentSnapshot = await chatRef
    .collection('encryptedEnvelopes')
    .orderBy('sentAtMs', 'asc')
    .limit(100)
    .get();
  const refsToDelete = new Map<string, DocumentReference>();

  expiredSnapshot.docs.forEach((doc) => {
    refsToDelete.set(doc.ref.path, doc.ref);
  });

  recentSnapshot.docs.forEach((doc) => {
    const record = doc.data() as EncryptedEnvelopeRecord;

    if (shouldDeleteRetainedEnvelope(record, nowMs)) {
      refsToDelete.set(doc.ref.path, doc.ref);
    }
  });

  if (!refsToDelete.size) {
    return;
  }

  const batch = firestore.batch();

  refsToDelete.forEach((ref) => {
    batch.delete(ref);
  });

  await batch.commit();
}

function shouldDeleteRetainedEnvelope(record: EncryptedEnvelopeRecord, nowMs: number): boolean {
  if (record.expiresAtMs && record.expiresAtMs <= nowMs) {
    return true;
  }

  const recipientDeviceIds = record.recipientDeviceIds || [];

  if (!recipientDeviceIds.length) {
    return false;
  }

  const readAtMsByDevice = record.readAtMsByDevice || {};
  const readTimes = recipientDeviceIds.map((deviceId) => readAtMsByDevice[deviceId] || 0);

  if (
    readTimes.every(Boolean) &&
    Math.max(...readTimes) + READ_ENVELOPE_RECEIPT_GRACE_MS <= nowMs
  ) {
    return true;
  }

  const deliveredAtMsByDevice = record.deliveredAtMsByDevice || {};
  const deliveredTimes = recipientDeviceIds.map((deviceId) => deliveredAtMsByDevice[deviceId] || 0);

  return (
    deliveredTimes.every(Boolean) &&
    Math.max(...deliveredTimes) + DELIVERED_ENVELOPE_RETENTION_MS <= nowMs
  );
}

function mapDevicePublicKey(device: DeviceKeyRecord): EncryptionDevicePublicKey {
  return {
    deviceId: device.deviceId || '',
    identityPublicKey: device.identityPublicKey || '',
    keyAgreementPublicKey: device.keyAgreementPublicKey || '',
    keyVersion: device.keyVersion || 1,
    platform: device.platform || 'unknown',
    signingPublicKey: device.signingPublicKey || '',
    uid: device.uid || ''
  };
}

function mapEncryptedEnvelopeForDevice(
  currentUid: string,
  deviceId: string,
  fallbackId: string,
  record: EncryptedEnvelopeRecord,
  encryptedKeyForDevice: string
): EncryptedDirectEnvelopeForDevice {
  const sentAtMs = record.sentAtMs || Date.now();

  return {
    algorithm: record.algorithm || 'unknown',
    ciphertext: record.ciphertext || '',
    clientMessageId: record.clientMessageId || fallbackId,
    deliveryStatus: getEnvelopeDeliveryStatus(currentUid, record),
    encryptedKeyForDevice,
    envelopeId: record.envelopeId || fallbackId,
    keyVersion: record.keyVersion || 1,
    nonce: record.nonce || '',
    senderDeviceId: record.senderDeviceId || '',
    senderKeyAgreementPublicKey: record.senderKeyAgreementPublicKey || '',
    senderUid: record.senderUid || '',
    sentAt: new Date(sentAtMs).toISOString()
  };
}

function getEnvelopeDeliveryStatus(
  currentUid: string,
  record: EncryptedEnvelopeRecord
): EncryptedDirectEnvelopeForDevice['deliveryStatus'] {
  if (record.senderUid !== currentUid) {
    return null;
  }

  const recipientDeviceIds = record.recipientDeviceIds || [];

  if (!recipientDeviceIds.length) {
    return 'sent';
  }

  const readByDevice = record.readAtMsByDevice || {};
  const deliveredByDevice = record.deliveredAtMsByDevice || {};

  if (recipientDeviceIds.some((recipientDeviceId) => Boolean(readByDevice[recipientDeviceId]))) {
    return 'read';
  }

  if (recipientDeviceIds.some((recipientDeviceId) => Boolean(deliveredByDevice[recipientDeviceId]))) {
    return 'delivered';
  }

  return 'sent';
}

export async function getEncryptedDirectContext(decodedToken: DecodedIdToken, contactId: string) {
  const session = await buildAuthSession(decodedToken);
  const { role, status, tenantId } = session.user;

  if (session.access !== 'ACTIVE' || status !== 'ACTIVE' || !tenantId || !role) {
    throw authorizationError('Your profile is not active.');
  }

  const safeContactId = contactId.trim();

  if (!safeContactId || safeContactId === decodedToken.uid) {
    throw notFoundError('Chat was not found.');
  }

  const organizationRef = firestore.collection('organizations').doc(tenantId);
  const currentUserRef = organizationRef.collection('users').doc(decodedToken.uid);
  const contactRef = organizationRef.collection('users').doc(safeContactId);
  const [organizationSnapshot, currentUserSnapshot, contactSnapshot] = await Promise.all([
    organizationRef.get(),
    currentUserRef.get(),
    contactRef.get()
  ]);

  if (!organizationSnapshot.exists || !currentUserSnapshot.exists || !contactSnapshot.exists) {
    throw notFoundError('Chat was not found.');
  }

  const organization = organizationSnapshot.data() as OrganizationRecord;
  const currentUser = currentUserSnapshot.data() as TenantUserRecord;
  const contact = contactSnapshot.data() as TenantUserRecord;
  const visibleRoles = getVisibleChatContactRoles(role);

  if (
    organization.status !== 'ACTIVE' ||
    currentUser.status !== 'ACTIVE' ||
    contact.status !== 'ACTIVE' ||
    !contact.role ||
    !visibleRoles.includes(contact.role)
  ) {
    throw notFoundError('Chat was not found.');
  }

  const chatId = buildDirectChatId(decodedToken.uid, safeContactId);

  return {
    chatId,
    chatRef: organizationRef.collection('directChats').doc(chatId),
    contactId: safeContactId,
    tenantId
  };
}

async function assertActiveDevice(
  tenantId: string,
  uid: string,
  deviceId: string
): Promise<void> {
  const snapshot = await firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('deviceKeys')
    .doc(deviceId)
    .get();

  if (!snapshot.exists) {
    throw authorizationError('This device is not authorized.');
  }

  const device = snapshot.data() as DeviceKeyRecord;

  if (device.tenantId !== tenantId || device.uid !== uid || device.status !== 'ACTIVE') {
    throw authorizationError('This device is not authorized.');
  }
}

async function assertActiveRecipientDevices(
  tenantId: string,
  recipientUid: string,
  recipientDeviceIds: string[]
): Promise<void> {
  if (!recipientDeviceIds.length) {
    throw validationError('At least one recipient device is required.');
  }

  await Promise.all(recipientDeviceIds.map(async (deviceId) => {
    const snapshot = await firestore
      .collection('organizations')
      .doc(tenantId)
      .collection('deviceKeys')
      .doc(deviceId)
      .get();

    if (!snapshot.exists) {
      throw validationError('A recipient device is not available.');
    }

    const device = snapshot.data() as DeviceKeyRecord;

    if (device.tenantId !== tenantId || device.uid !== recipientUid || device.status !== 'ACTIVE') {
      throw validationError('A recipient device is not available.');
    }
  }));
}

function buildDirectChatId(uid: string, contactId: string): string {
  const participantKey = [uid, contactId].sort().join('|');
  return `direct_${createHash('sha256').update(participantKey).digest('hex')}`;
}

function getVisibleChatContactRoles(role: SynzappRole): SynzappRole[] {
  if (role === 'ORG_ADMIN') {
    return ['EMPLOYEE', 'DEPT_ADMIN'];
  }

  if (role === 'DEPT_ADMIN') {
    return ['ORG_ADMIN', 'EMPLOYEE'];
  }

  return ['ORG_ADMIN', 'DEPT_ADMIN'];
}

function authorizationError(message: string): Error {
  const error = new Error(message);
  error.name = 'AuthorizationError';
  return error;
}

function notFoundError(message: string): Error {
  const error = new Error(message);
  error.name = 'NotFoundError';
  return error;
}

function validationError(message: string): Error {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
}
