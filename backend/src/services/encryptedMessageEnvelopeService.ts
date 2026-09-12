import { buildDirectChatId } from './conversationIdentity.js';
import { createHash } from 'node:crypto';
import { DecodedIdToken } from 'firebase-admin/auth';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import { SynzappRole } from '../types/auth.js';
import { buildAuthSession } from './authSessionService.js';
import type { DeviceActivityTimestamp } from './deviceDormancy.js';
import { selectDevicesForDelivery } from './deviceIdentityService.js';
import {
  getChatUserPreference,
  reviveChatUserPreferenceInTransaction
} from './chatUserPreferenceService.js';
import { getChatArchiveSettings } from './chatArchiveSettingsService.js';
import { pickNotificationPreviewsForRecipientDevices } from './encryptedNotificationPreviewPolicy.js';
import { registerChatMediaReferences } from './chatMediaRetentionService.js';
import { getTenantArchivePublicKey } from './tenantArchiveKeyService.js';

export interface SendEncryptedDirectEnvelopeInput {
  algorithm: string;
  ciphertext: string;
  clientMessageId: string;
  encryptedKeysByDevice: Record<string, string>;
  keyVersion: number;
  /**
   * The media this message uses.
   *
   * Sent alongside the message rather than read from it, because the media ids
   * live inside the encrypted payload and the server cannot see them. Without
   * this the server has no way to know a photo is still in use, which is why
   * photos used to disappear from conversations that still showed them.
   *
   * Only ids. Nothing about the content, and the photo itself stays unreadable.
   */
  mediaIds?: string[];
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
  isDuplicate?: boolean;
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
  /**
   * The company's compliance archive, presented as a device.
   *
   * Absent when the company has no archive key, in which case sending works
   * exactly as before. A sending app encrypts to it like any other recipient,
   * which is what gives the company a readable record without the server ever
   * seeing an unencrypted message.
   */
  archiveDevice?: EncryptionDevicePublicKey;
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
  createdAt?: DeviceActivityTimestamp | null;
  deviceId?: string;
  identityPublicKey?: string;
  keyAgreementPublicKey?: string;
  keyVersion?: number;
  lastSeenAt?: DeviceActivityTimestamp | null;
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
  afterSentAtMs?: number | null;
  beforeSentAtMs?: number | null;
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

  const archiveKey = await getTenantArchivePublicKey(context.tenantId);

  return {
    ...(archiveKey ? { archiveDevice: mapArchiveDevice(archiveKey) } : {}),
    recipientDevices: recipientDevices.map(mapDevicePublicKey),
    senderDevice: mapDevicePublicKey(senderDevice),
    senderDevices: senderDevices.map(mapDevicePublicKey)
  };
}

/**
 * Presents the archive key in the shape a device takes.
 *
 * The device id is prefixed so it is recognisable in an envelope's recipient
 * list — an operator reading a message record should be able to see at a glance
 * that the company archive was one of its readers.
 */
function mapArchiveDevice(archiveKey: {
  keyAgreementPublicKey: string;
  keyId: string;
}): EncryptionDevicePublicKey {
  return {
    deviceId: `archive_${archiveKey.keyId}`,
    identityPublicKey: '',
    keyAgreementPublicKey: archiveKey.keyAgreementPublicKey,
    keyVersion: 1,
    platform: 'compliance-archive',
    signingPublicKey: '',
    uid: ''
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

  const afterSentAtMs = normalizeEnvelopeCursorMs(options.afterSentAtMs);
  const beforeSentAtMs = normalizeEnvelopeCursorMs(options.beforeSentAtMs);

  if (afterSentAtMs !== null) {
    envelopesQuery = envelopesQuery.where('sentAtMs', '>', afterSentAtMs);
  }

  if (beforeSentAtMs !== null) {
    envelopesQuery = envelopesQuery.where('sentAtMs', '<', beforeSentAtMs);
  }

  envelopesQuery = envelopesQuery.orderBy('sentAtMs', 'asc');
  const envelopesSnapshot = await envelopesQuery
    .limit(normalizeEnvelopePageLimit(options.limit, 100))
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
  } else if (hasBatchUpdates) {
    /**
     * Touch the conversation so the sender hears about the delivery.
     *
     * The marks above are written onto the envelope documents, but the sender's
     * realtime socket watches this conversation document — not the envelopes
     * under it. Marking read already touches it, which is why "Seen" arrived
     * live while "Delivered" did not: the tick sat on "Sent" until the sender
     * happened to reopen the chat and refetch.
     *
     * This settles rather than loops. The snapshot reaches both parties, and
     * the recipient's own refresh marks only devices that are not marked
     * already — so the second pass finds nothing to write, commits nothing, and
     * touches nothing.
     */
    await context.chatRef.set({
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });
  }

  return envelopes;
}

function normalizeEnvelopeCursorMs(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.floor(value));
}

function normalizeEnvelopePageLimit(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.min(Math.floor(value), 500));
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

/**
 * Sends a message somebody has just written.
 *
 * The work itself is in `deliverEncryptedDirectEnvelope`; this only settles who
 * is sending, from their signed-in session.
 */
export async function sendEncryptedDirectEnvelope(
  decodedToken: DecodedIdToken,
  contactId: string,
  input: SendEncryptedDirectEnvelopeInput
): Promise<EncryptedDirectEnvelopeResponse> {
  const context = await getEncryptedDirectContext(decodedToken, contactId);

  return deliverEncryptedDirectEnvelope(context, decodedToken.uid, input);
}

/**
 * Sends a message written earlier, at the time its author asked for.
 *
 * Takes the sender as facts rather than as a token, because the worker that
 * calls this was woken by a scheduler and has nobody signed in. Everything
 * after that point is identical to an ordinary send — the same conversation
 * checks, the same duplicate protection, the same record written the same way.
 * That is deliberate: a scheduled message is not a second kind of message, and
 * anything that treated it as one would be a second thing to keep correct.
 */
export async function releaseEncryptedDirectEnvelope(input: {
  contactId: string;
  envelope: SendEncryptedDirectEnvelopeInput;
  role: SynzappRole;
  senderUid: string;
  tenantId: string;
}): Promise<EncryptedDirectEnvelopeResponse> {
  const context = await resolveEncryptedDirectContext({
    contactId: input.contactId,
    role: input.role,
    senderUid: input.senderUid,
    tenantId: input.tenantId
  });

  return deliverEncryptedDirectEnvelope(context, input.senderUid, input.envelope);
}

async function deliverEncryptedDirectEnvelope(
  context: Awaited<ReturnType<typeof resolveEncryptedDirectContext>>,
  senderUid: string,
  input: SendEncryptedDirectEnvelopeInput
): Promise<EncryptedDirectEnvelopeResponse> {
  const uniqueRecipientDeviceIds = Array.from(new Set(input.recipientDeviceIds));

  if (uniqueRecipientDeviceIds.length !== input.recipientDeviceIds.length) {
    throw validationError('Recipient devices must be unique.');
  }

  const notificationPreviewByDevice = pickNotificationPreviewsForRecipientDevices(
    input.notificationPreviewByDevice,
    uniqueRecipientDeviceIds
  );

  await assertActiveDevice(context.tenantId, senderUid, input.senderDeviceId);
  await assertActiveRecipientDevices(context.tenantId, context.contactId, uniqueRecipientDeviceIds);
  const [senderDevice, senderArchiveSettings, recipientArchiveSettings] = await Promise.all([
    getActiveDevice(context.tenantId, senderUid, input.senderDeviceId),
    getChatArchiveSettings(context.tenantId, senderUid),
    getChatArchiveSettings(context.tenantId, context.contactId)
  ]);

  if (!senderDevice?.keyAgreementPublicKey) {
    throw authorizationError('This device is not authorized.');
  }

  const existingEnvelope = await findExistingDirectEnvelopeByClientMessageId({
    chatRef: context.chatRef,
    clientMessageId: input.clientMessageId,
    conversationId: context.chatId,
    senderKeyAgreementPublicKey: senderDevice.keyAgreementPublicKey,
    senderUid: senderUid,
    tenantId: context.tenantId
  });

  if (existingEnvelope) {
    return existingEnvelope;
  }

  uniqueRecipientDeviceIds.forEach((deviceId) => {
    if (!input.encryptedKeysByDevice[deviceId]) {
      throw validationError('Encrypted key material is missing for a recipient device.');
    }
  });

  const envelopeRef = context.chatRef.collection('encryptedEnvelopes').doc();
  const messageMetadataRef = context.chatRef
    .collection('messageMetadata')
    .doc(buildClientMessageMetadataId(senderUid, input.clientMessageId));
  const sentAtMs = Date.now();
  const { participantIds, participants } = buildDirectChatParticipantData(senderUid, context.contactId);
  let transactionDuplicateEnvelope: EncryptedDirectEnvelopeResponse | null = null;

  await firestore.runTransaction(async (transaction) => {
    const existingMetadataSnapshot = await transaction.get(messageMetadataRef);

    if (existingMetadataSnapshot.exists) {
      const metadata = existingMetadataSnapshot.data() as EncryptedMessageMetadataRecord;
      const existingEnvelopeId = metadata.envelopeId || '';
      const existingEnvelopeSnapshot = existingEnvelopeId
        ? await transaction.get(context.chatRef.collection('encryptedEnvelopes').doc(existingEnvelopeId))
        : null;

      if (existingEnvelopeSnapshot?.exists) {
        const record = existingEnvelopeSnapshot.data() as EncryptedEnvelopeRecord;

        if (record.senderUid === senderUid && record.clientMessageId === input.clientMessageId) {
          transactionDuplicateEnvelope = mapExistingDirectEnvelopeResponse({
            conversationId: context.chatId,
            envelopeId: existingEnvelopeSnapshot.id,
            record,
            senderKeyAgreementPublicKey: senderDevice.keyAgreementPublicKey || '',
            tenantId: context.tenantId
          });
          return;
        }
      }
    }

    const chatSnapshot = await transaction.get(context.chatRef);
    const chatCreateData = chatSnapshot.exists
      ? {}
      : {
          createdAt: fieldValue.serverTimestamp()
        };

    reviveChatUserPreferenceInTransaction(
      transaction,
      context.tenantId,
      senderUid,
      'DIRECT',
      context.contactId,
      { unarchive: shouldUnarchiveDirectChatOnNewMessage(senderArchiveSettings) }
    );

    reviveChatUserPreferenceInTransaction(
      transaction,
      context.tenantId,
      context.contactId,
      'DIRECT',
      senderUid,
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
      mediaIds: input.mediaIds || [],
      nonce: input.nonce,
      ...(Object.keys(notificationPreviewByDevice).length
        ? { notificationPreviewByDevice }
        : {}),
      recipientDeviceIds: uniqueRecipientDeviceIds,
      recipientUid: context.contactId,
      senderDeviceId: input.senderDeviceId,
      senderKeyAgreementPublicKey: senderDevice.keyAgreementPublicKey,
      senderUid: senderUid,
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
      senderUid: senderUid,
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
      lastMessageSenderUid: senderUid,
      lastMessageSentAtMs: sentAtMs,
      lastMessageText: null,
      participantIds,
      participants,
      serverEnvelopeExpiresAtMs: null,
      tenantId: context.tenantId,
      unreadCounts: {
        [senderUid]: 0,
        [context.contactId]: fieldValue.increment(1)
      },
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });
  });

  if (transactionDuplicateEnvelope) {
    return transactionDuplicateEnvelope;
  }

  // After the message is stored, not inside the transaction: a failure to claim
  // media must not lose the message. The claim is retried by the next send and
  // the media keeps its original expiry in the meantime.
  await registerChatMediaReferences({
    chatRef: context.chatRef,
    envelopeId: envelopeRef.id,
    mediaIds: input.mediaIds || [],
    // Kept for as long as the message. There is no separate media expiry, which
    // is the whole point: a conversation that is kept keeps its photos.
    purgeAfterMs: null,
    retainUntilMs: sentAtMs
  }).catch(() => undefined);

  return {
    algorithm: input.algorithm,
    clientMessageId: input.clientMessageId,
    conversationId: context.chatId,
    envelopeId: envelopeRef.id,
    isDuplicate: false,
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

async function findExistingDirectEnvelopeByClientMessageId(input: {
  chatRef: FirebaseFirestore.DocumentReference;
  clientMessageId: string;
  conversationId: string;
  senderKeyAgreementPublicKey: string;
  senderUid: string;
  tenantId: string;
}): Promise<EncryptedDirectEnvelopeResponse | null> {
  const metadataSnapshot = await input.chatRef
    .collection('messageMetadata')
    .where('senderUid', '==', input.senderUid)
    .where('clientMessageId', '==', input.clientMessageId)
    .limit(1)
    .get();

  const metadataDoc = metadataSnapshot.docs[0];

  if (!metadataDoc) {
    return null;
  }

  const metadata = metadataDoc.data() as EncryptedMessageMetadataRecord;
  const envelopeId = metadata.envelopeId || metadataDoc.id;
  const envelopeSnapshot = await input.chatRef
    .collection('encryptedEnvelopes')
    .doc(envelopeId)
    .get();

  if (!envelopeSnapshot.exists) {
    return null;
  }

  const record = envelopeSnapshot.data() as EncryptedEnvelopeRecord;

  if (record.senderUid !== input.senderUid || record.clientMessageId !== input.clientMessageId) {
    return null;
  }

  return mapExistingDirectEnvelopeResponse({
    conversationId: input.conversationId,
    envelopeId: envelopeSnapshot.id,
    record,
    senderKeyAgreementPublicKey: input.senderKeyAgreementPublicKey,
    tenantId: input.tenantId
  });
}

function mapExistingDirectEnvelopeResponse(input: {
  conversationId: string;
  envelopeId: string;
  record: EncryptedEnvelopeRecord;
  senderKeyAgreementPublicKey: string;
  tenantId: string;
}): EncryptedDirectEnvelopeResponse {
  return {
    algorithm: input.record.algorithm || 'unknown',
    clientMessageId: input.record.clientMessageId || input.envelopeId,
    conversationId: input.conversationId,
    envelopeId: input.record.envelopeId || input.envelopeId,
    isDuplicate: true,
    keyVersion: input.record.keyVersion || 1,
    notificationPreviewByDevice: undefined,
    recipientDeviceIds: input.record.recipientDeviceIds || [],
    senderDeviceId: input.record.senderDeviceId || '',
    senderKeyAgreementPublicKey: input.record.senderKeyAgreementPublicKey || input.senderKeyAgreementPublicKey,
    sentAt: new Date(input.record.sentAtMs || Date.now()).toISOString(),
    tenantId: input.tenantId
  };
}

function buildClientMessageMetadataId(senderUid: string, clientMessageId: string): string {
  return createHash('sha256')
    .update(`${senderUid}:${clientMessageId}`)
    .digest('hex');
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

  const registeredDevices = snapshot.docs
    .map((doc) => ({ ...(doc.data() as DeviceKeyRecord), deviceId: (doc.data() as DeviceKeyRecord).deviceId || doc.id }))
    .filter((device) => Boolean(device.keyAgreementPublicKey));

  // A phone that was wiped or reinstalled left its registration behind, and
  // without this every message to this person is still sealed for it forever.
  return selectDevicesForDelivery(tenantId, registeredDevices);
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

  return resolveEncryptedDirectContext({
    contactId,
    role,
    senderUid: decodedToken.uid,
    tenantId
  });
}

/**
 * The same conversation checks, for a sender identified without a token.
 *
 * A scheduled message is released by a worker that Cloud Scheduler woke, with
 * nobody signed in. It still has to answer every question an ordinary send
 * answers — is the organization active, is the sender still employed, is the
 * recipient, are they allowed to talk to each other — and the only safe way to
 * answer them the same way is to run the same code.
 *
 * This is where the offboarding guarantee actually lives: somebody deactivated
 * at three o'clock fails `currentUser.status !== 'ACTIVE'` here, and a message
 * they scheduled for five o'clock never goes.
 */
export async function resolveEncryptedDirectContext(input: {
  contactId: string;
  role: SynzappRole;
  senderUid: string;
  tenantId: string;
}) {
  const { role, senderUid, tenantId } = input;
  const safeContactId = input.contactId.trim();

  if (!safeContactId || safeContactId === senderUid) {
    throw notFoundError('Chat was not found.');
  }

  const organizationRef = firestore.collection('organizations').doc(tenantId);
  const currentUserRef = organizationRef.collection('users').doc(senderUid);
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

  const chatId = buildDirectChatId(senderUid, safeContactId);

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
