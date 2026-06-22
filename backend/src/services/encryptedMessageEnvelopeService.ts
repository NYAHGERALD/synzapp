import { createHash } from 'node:crypto';
import { DecodedIdToken } from 'firebase-admin/auth';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import { SynzappRole } from '../types/auth.js';
import { buildAuthSession } from './authSessionService.js';
import {
  getChatUserPreference,
  reviveChatUserPreferenceInTransaction
} from './chatUserPreferenceService.js';
import { getChatArchiveSettings } from './chatArchiveSettingsService.js';
import { pickNotificationPreviewsForRecipientDevices } from './encryptedNotificationPreviewPolicy.js';

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
  senderDevices: EncryptionDevicePublicKey[];
}

export interface EncryptedDirectEnvelopeForDevice {
  algorithm: string;
  ciphertext: string;
  clientMessageId: string;
  deliveryStatus: 'delivered' | 'read' | 'sent' | null;
  encryptedKeyForDevice: string;
  encryptedKeysForCurrentUser?: Record<string, string>;
  envelopeId: string;
  keyVersion: number;
  nonce: string;
  senderDeviceId: string;
  senderKeyAgreementPublicKey: string;
  senderUid: string;
  sentAt: string;
}

export function buildDirectChatParticipantData(currentUid: string, contactId: string): {
  participantIds: string[];
  participants: Record<string, true>;
} {
  const participantIds = [currentUid, contactId].sort();

  return {
    participantIds,
    participants: Object.fromEntries(participantIds.map((participantId) => [participantId, true]))
  };
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
  expiresAtMs?: number | null;
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
  trashSegmentId?: string | null;
}

export async function getDirectEncryptionContext(
  decodedToken: DecodedIdToken,
  contactId: string,
  senderDeviceId: string
): Promise<DirectEncryptionContextResponse> {
  const context = await getEncryptedDirectContext(decodedToken, contactId);
  const [senderDevice, recipientDevices, senderDevices] = await Promise.all([
    getActiveDevice(context.tenantId, decodedToken.uid, senderDeviceId),
    listActiveDevicesForUser(context.tenantId, context.contactId),
    listActiveDevicesForUser(context.tenantId, decodedToken.uid)
  ]);

  if (!senderDevice) {
    throw authorizationError('This device is not authorized.');
  }

  if (!recipientDevices.length) {
    throw validationError('The recipient does not have an active device yet.');
  }

  return {
    recipientDevices: recipientDevices.map(mapDevicePublicKey),
    senderDevice: mapDevicePublicKey(senderDevice),
    senderDevices: senderDevices.map(mapDevicePublicKey)
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
  const [preference, currentUserDevices] = await Promise.all([
    getChatUserPreference(context.tenantId, decodedToken.uid, 'DIRECT', context.contactId),
    listActiveDevicesForUser(context.tenantId, decodedToken.uid)
  ]);
  const trashSegment = options.trashSegmentId
    ? preference.trashSegments.find((segment) => segment.segmentId === options.trashSegmentId)
    : null;
  const currentUserDeviceIds = currentUserDevices
    .map((device) => device.deviceId || '')
    .filter(Boolean);

  const envelopesCollection = context.chatRef.collection('encryptedEnvelopes');
  let envelopesQuery: FirebaseFirestore.Query = envelopesCollection;

  if (options.trashSegmentId) {
    if (!trashSegment) {
      return [];
    }

    if (trashSegment.startAtMs) {
      envelopesQuery = envelopesQuery.where('sentAtMs', '>', trashSegment.startAtMs);
    }

    if (trashSegment.endAtMs) {
      envelopesQuery = envelopesQuery.where('sentAtMs', '<=', trashSegment.endAtMs);
    }
  } else if (preference.clearedAtMs) {
    envelopesQuery = envelopesQuery.where('sentAtMs', '>', preference.clearedAtMs);
  }

  envelopesQuery = envelopesQuery.orderBy('sentAtMs', 'asc');
  const envelopesSnapshot = await envelopesQuery
    .limit(options.limit || 100)
    .get();
  const nowMs = Date.now();
  const batch = firestore.batch();
  let hasBatchUpdates = false;
  const envelopes = envelopesSnapshot.docs
    .map((doc) => {
      const record = doc.data() as EncryptedEnvelopeRecord;
      const encryptedKeyForDevice = record.encryptedKeysByDevice?.[deviceId];
      const encryptedKeysForCurrentUser = pickEncryptedKeysForDevices(
        record.encryptedKeysByDevice,
        currentUserDeviceIds
      );
      const fallbackEncryptedKeyForDevice = encryptedKeyForDevice ||
        Object.values(encryptedKeysForCurrentUser)[0] ||
        '';

      if (!options.trashSegmentId && preference.clearedAtMs && record.sentAtMs && record.sentAtMs <= preference.clearedAtMs) {
        return null;
      }

      if (trashSegment?.endAtMs && record.sentAtMs && record.sentAtMs > trashSegment.endAtMs) {
        return null;
      }

      if (!fallbackEncryptedKeyForDevice) {
        return null;
      }

      if (record.senderUid !== decodedToken.uid) {
        const deliveryMarkerDeviceIds = getRecipientDeliveryMarkerDeviceIds(record, encryptedKeysForCurrentUser);
        const deliveredByDevice = record.deliveredAtMsByDevice || {};
        const readByDevice = record.readAtMsByDevice || {};
        const deliveryUpdate: {
          deliveredAtMsByDevice?: Record<string, number>;
          readAtMsByDevice?: Record<string, number>;
          status?: string;
          updatedAt: FirebaseFirestore.FieldValue;
        } = {
          updatedAt: fieldValue.serverTimestamp()
        };

        if (shouldMarkDelivered) {
          const nextDeliveredAtMsByDevice = Object.fromEntries(
            deliveryMarkerDeviceIds
              .filter((markerDeviceId) => !deliveredByDevice[markerDeviceId])
              .map((markerDeviceId) => [markerDeviceId, nowMs])
          );

          if (Object.keys(nextDeliveredAtMsByDevice).length) {
            deliveryUpdate.deliveredAtMsByDevice = nextDeliveredAtMsByDevice;
          }
          deliveryUpdate.status = 'DELIVERED';
        }

        if (shouldMarkRead) {
          const nextDeliveredAtMsByDevice = Object.fromEntries(
            deliveryMarkerDeviceIds
              .filter((markerDeviceId) => !deliveredByDevice[markerDeviceId])
              .map((markerDeviceId) => [markerDeviceId, nowMs])
          );
          const nextReadAtMsByDevice = Object.fromEntries(
            deliveryMarkerDeviceIds
              .filter((markerDeviceId) => !readByDevice[markerDeviceId])
              .map((markerDeviceId) => [markerDeviceId, nowMs])
          );

          if (Object.keys(nextDeliveredAtMsByDevice).length) {
            deliveryUpdate.deliveredAtMsByDevice = {
              ...(deliveryUpdate.deliveredAtMsByDevice || {}),
              ...nextDeliveredAtMsByDevice
            };
          }

          if (Object.keys(nextReadAtMsByDevice).length) {
            deliveryUpdate.readAtMsByDevice = nextReadAtMsByDevice;
          }
          deliveryUpdate.status = 'READ';
        }

        if (deliveryUpdate.deliveredAtMsByDevice || deliveryUpdate.readAtMsByDevice) {
          batch.set(doc.ref, deliveryUpdate, { merge: true });
          hasBatchUpdates = true;
        }
      }

      return mapEncryptedEnvelopeForDevice(
        decodedToken.uid,
        doc.id,
        record,
        fallbackEncryptedKeyForDevice,
        encryptedKeysForCurrentUser
      );
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

  const notificationPreviewByDevice = pickNotificationPreviewsForRecipientDevices(
    input.notificationPreviewByDevice,
    uniqueRecipientDeviceIds
  );

  await assertActiveDevice(context.tenantId, decodedToken.uid, input.senderDeviceId);
  await assertActiveRecipientDevices(context.tenantId, context.contactId, uniqueRecipientDeviceIds);
  const [senderDevice, senderArchiveSettings, recipientArchiveSettings] = await Promise.all([
    getActiveDevice(context.tenantId, decodedToken.uid, input.senderDeviceId),
    getChatArchiveSettings(context.tenantId, decodedToken.uid),
    getChatArchiveSettings(context.tenantId, context.contactId)
  ]);

  if (!senderDevice?.keyAgreementPublicKey) {
    throw authorizationError('This device is not authorized.');
  }

  uniqueRecipientDeviceIds.forEach((deviceId) => {
    if (!input.encryptedKeysByDevice[deviceId]) {
      throw validationError('Encrypted key material is missing for a recipient device.');
    }
  });

  const envelopeRef = context.chatRef.collection('encryptedEnvelopes').doc();
  const messageMetadataRef = context.chatRef.collection('messageMetadata').doc(envelopeRef.id);
  const sentAtMs = Date.now();
  const { participantIds, participants } = buildDirectChatParticipantData(decodedToken.uid, context.contactId);

  await firestore.runTransaction(async (transaction) => {
    const chatSnapshot = await transaction.get(context.chatRef);
    const chatCreateData = chatSnapshot.exists
      ? {}
      : {
          createdAt: fieldValue.serverTimestamp()
        };

    reviveChatUserPreferenceInTransaction(
      transaction,
      context.tenantId,
      decodedToken.uid,
      'DIRECT',
      context.contactId,
      { unarchive: shouldUnarchiveDirectChatOnNewMessage(senderArchiveSettings) }
    );

    reviveChatUserPreferenceInTransaction(
      transaction,
      context.tenantId,
      context.contactId,
      'DIRECT',
      decodedToken.uid,
      { unarchive: shouldUnarchiveDirectChatOnNewMessage(recipientArchiveSettings) }
    );

    transaction.set(envelopeRef, {
      algorithm: input.algorithm,
      ciphertext: input.ciphertext,
      clientMessageId: input.clientMessageId,
      createdAt: fieldValue.serverTimestamp(),
      encryptedKeysByDevice: input.encryptedKeysByDevice,
      envelopeId: envelopeRef.id,
      expiresAtMs: null,
      keyVersion: input.keyVersion,
      nonce: input.nonce,
      ...(Object.keys(notificationPreviewByDevice).length
        ? { notificationPreviewByDevice }
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
      chatId: context.chatId,
      encryptionMode: 'E2EE',
      lastEncryptedEnvelopeId: envelopeRef.id,
      lastMessageId: envelopeRef.id,
      lastMessageSenderUid: decodedToken.uid,
      lastMessageSentAtMs: sentAtMs,
      lastMessageText: null,
      participantIds,
      participants,
      serverEnvelopeExpiresAtMs: null,
      tenantId: context.tenantId,
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
    notificationPreviewByDevice: Object.keys(notificationPreviewByDevice).length
      ? notificationPreviewByDevice
      : undefined,
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

function shouldUnarchiveDirectChatOnNewMessage(settings: {
  keepArchivedWhenNewMessagesArrive: boolean;
  unarchiveBehavior: string;
}): boolean {
  return !settings.keepArchivedWhenNewMessagesArrive && settings.unarchiveBehavior === 'NEW_MESSAGE';
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
  fallbackId: string,
  record: EncryptedEnvelopeRecord,
  encryptedKeyForDevice: string,
  encryptedKeysForCurrentUser?: Record<string, string>
): EncryptedDirectEnvelopeForDevice {
  const sentAtMs = record.sentAtMs || Date.now();

  return {
    algorithm: record.algorithm || 'unknown',
    ciphertext: record.ciphertext || '',
    clientMessageId: record.clientMessageId || fallbackId,
    deliveryStatus: getEnvelopeDeliveryStatus(currentUid, record),
    encryptedKeyForDevice,
    ...(encryptedKeysForCurrentUser && Object.keys(encryptedKeysForCurrentUser).length
      ? { encryptedKeysForCurrentUser }
      : {}),
    envelopeId: record.envelopeId || fallbackId,
    keyVersion: record.keyVersion || 1,
    nonce: record.nonce || '',
    senderDeviceId: record.senderDeviceId || '',
    senderKeyAgreementPublicKey: record.senderKeyAgreementPublicKey || '',
    senderUid: record.senderUid || '',
    sentAt: new Date(sentAtMs).toISOString()
  };
}

function pickEncryptedKeysForDevices(
  encryptedKeysByDevice: Record<string, string> | undefined,
  deviceIds: string[]
): Record<string, string> {
  if (!encryptedKeysByDevice || !deviceIds.length) {
    return {};
  }

  const keys: Record<string, string> = {};

  deviceIds.forEach((deviceId) => {
    const encryptedKey = encryptedKeysByDevice[deviceId];

    if (encryptedKey) {
      keys[deviceId] = encryptedKey;
    }
  });

  return keys;
}

function getRecipientDeliveryMarkerDeviceIds(
  record: EncryptedEnvelopeRecord,
  encryptedKeysForCurrentUser: Record<string, string>
): string[] {
  const recipientDeviceIds = new Set(record.recipientDeviceIds || []);

  return Object.keys(encryptedKeysForCurrentUser)
    .filter((deviceId) => recipientDeviceIds.has(deviceId));
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
  return ['ORG_ADMIN', 'DEPT_ADMIN', 'EMPLOYEE'];
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
