import { randomUUID } from 'node:crypto';
import { DecodedIdToken } from 'firebase-admin/auth';
import type { DocumentReference } from 'firebase-admin/firestore';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import { SynzappRole } from '../types/auth.js';
import { buildAuthSession } from './authSessionService.js';
import {
  EncryptedNotificationPreviewRecord,
  EncryptionDevicePublicKey,
  SendEncryptedDirectEnvelopeInput
} from './encryptedMessageEnvelopeService.js';

const ENCRYPTED_ENVELOPE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const READ_ENVELOPE_RECEIPT_GRACE_MS = 5 * 60 * 1000;
const DELIVERED_ENVELOPE_RETENTION_MS = 24 * 60 * 60 * 1000;

export interface CreateGroupChatInput {
  memberIds: string[];
  messagePermissionMode?: 'ADMINS' | 'ALL_MEMBERS';
  name: string;
}

export interface GroupChatContact {
  chatType: 'GROUP';
  contactId: string;
  conversationId: string;
  displayName: string;
  hasActiveDevice: boolean;
  initials: string;
  isOnline: boolean;
  lastMessageAt: string | null;
  lastSeenAt: string | null;
  memberCount: number;
  messagePermissionMode: 'ADMINS' | 'ALL_MEMBERS';
  preview: string;
  profilePhotoCacheKey: string | null;
  profilePhotoUrl: string | null;
  role: SynzappRole;
  roleName: string;
  status: string;
  tenantId: string;
  unreadCount: number;
}

export interface GroupEncryptionContextResponse {
  recipientDevices: EncryptionDevicePublicKey[];
  senderDevice: EncryptionDevicePublicKey;
}

export interface EncryptedGroupEnvelopeForDevice {
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

export interface EncryptedGroupEnvelopeResponse {
  algorithm: string;
  clientMessageId: string;
  conversationId: string;
  envelopeId: string;
  keyVersion: number;
  notificationPreviewByDevice?: Record<string, EncryptedNotificationPreviewRecord>;
  recipientDeviceIds: string[];
  recipientUids: string[];
  senderDeviceId: string;
  senderKeyAgreementPublicKey: string;
  sentAt: string;
  tenantId: string;
}

interface GroupChatContext {
  group: TenantGroupRecord;
  groupId: string;
  groupRef: DocumentReference;
  memberIds: string[];
  tenantId: string;
}

interface TenantGroupRecord {
  chatType?: string;
  createdBy?: string;
  groupId?: string;
  lastMessageSentAtMs?: number | null;
  memberCount?: number;
  messagePermissionMode?: 'ADMINS' | 'ALL_MEMBERS';
  name?: string;
  status?: string;
  tenantId?: string;
  unreadCounts?: Record<string, number>;
}

interface TenantUserRecord {
  departmentId?: string | null;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  role?: SynzappRole;
  status?: string;
  tenantId?: string;
}

interface GroupMemberRecord {
  role?: 'ADMIN' | 'MEMBER' | 'OWNER';
  status?: string;
  tenantId?: string;
  uid?: string;
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

interface EncryptedGroupEnvelopeRecord {
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
  recipientUids?: string[];
  senderDeviceId?: string;
  senderKeyAgreementPublicKey?: string;
  senderUid?: string;
  sentAtMs?: number;
}

interface ListEncryptedGroupEnvelopeOptions {
  limit?: number;
  markAsDelivered?: boolean;
  markAsRead?: boolean;
}

export async function createGroupChat(
  decodedToken: DecodedIdToken,
  input: CreateGroupChatInput
): Promise<GroupChatContact> {
  const context = await getActiveUserContext(decodedToken);
  const name = input.name.trim();
  const memberIds = Array.from(new Set([
    decodedToken.uid,
    ...input.memberIds.map((memberId) => memberId.trim()).filter(Boolean)
  ]));
  const selectedMemberIds = memberIds.filter((memberId) => memberId !== decodedToken.uid);

  if (!name) {
    throw validationError('Enter a group name.');
  }

  if (!selectedMemberIds.length) {
    throw validationError('Select at least one group member.');
  }

  if (memberIds.length > 50) {
    throw validationError('Group chats can include up to 50 members for now.');
  }

  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const memberSnapshots = await Promise.all(memberIds.map((memberId) =>
    organizationRef.collection('users').doc(memberId).get()
  ));
  const visibleRoles = getVisibleChatContactRoles(context.role);

  memberSnapshots.forEach((snapshot) => {
    if (!snapshot.exists) {
      throw validationError('One or more selected members are not active.');
    }

    const member = snapshot.data() as TenantUserRecord;

    if (
      member.tenantId !== context.tenantId ||
      member.status !== 'ACTIVE' ||
      !member.role ||
      (
        snapshot.id !== decodedToken.uid &&
        !visibleRoles.includes(member.role)
      )
    ) {
      throw validationError('One or more selected members are not active.');
    }
  });

  const groupId = `group_chat_${randomUUID().replace(/-/g, '')}`;
  const groupRef = organizationRef.collection('groups').doc(groupId);
  const messagePermissionMode = input.messagePermissionMode === 'ADMINS'
    ? 'ADMINS'
    : 'ALL_MEMBERS';

  await firestore.runTransaction(async (transaction) => {
    transaction.set(groupRef, {
      autoMembershipDepartmentId: null,
      chatType: 'GROUP_CHAT',
      createdAt: fieldValue.serverTimestamp(),
      createdBy: decodedToken.uid,
      departmentId: null,
      departmentName: null,
      description: null,
      groupId,
      isDepartmentDefault: false,
      lastMessageText: null,
      memberCount: memberIds.length,
      memberPolicy: 'EXPLICIT',
      messagePermissionMode,
      name,
      scope: 'COMPANY',
      status: 'ACTIVE',
      systemManaged: false,
      tenantId: context.tenantId,
      unreadCounts: Object.fromEntries(memberIds.map((memberId) => [memberId, 0])),
      updatedAt: fieldValue.serverTimestamp()
    });

    memberIds.forEach((memberId) => {
      transaction.set(groupRef.collection('members').doc(memberId), {
        addedAt: fieldValue.serverTimestamp(),
        addedBy: decodedToken.uid,
        role: memberId === decodedToken.uid ? 'OWNER' : 'MEMBER',
        status: 'ACTIVE',
        tenantId: context.tenantId,
        uid: memberId
      });
    });
  });

  const groupSnapshot = await groupRef.get();
  const group = groupSnapshot.data() as TenantGroupRecord;

  return buildGroupChatContact(decodedToken.uid, groupId, group, memberIds, await countActiveRecipientDevices(
    context.tenantId,
    memberIds,
    decodedToken.uid
  ));
}

export async function listCurrentUserGroupChatContacts(
  decodedToken: DecodedIdToken
): Promise<GroupChatContact[]> {
  const context = await getActiveUserContext(decodedToken);
  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const snapshot = await organizationRef
    .collection('groups')
    .where('status', '==', 'ACTIVE')
    .get();
  const contacts: GroupChatContact[] = [];

  for (const doc of snapshot.docs) {
    const group = doc.data() as TenantGroupRecord;

    if (group.tenantId !== context.tenantId || group.chatType !== 'GROUP_CHAT') {
      continue;
    }

    const memberIds = await getActiveGroupMemberIds(organizationRef.collection('groups').doc(doc.id));

    if (!memberIds.includes(decodedToken.uid)) {
      continue;
    }

    contacts.push(buildGroupChatContact(
      decodedToken.uid,
      doc.id,
      group,
      memberIds,
      await countActiveRecipientDevices(context.tenantId, memberIds, decodedToken.uid)
    ));
  }

  return contacts.sort((first, second) => {
    if (first.lastMessageAt && second.lastMessageAt) {
      return second.lastMessageAt.localeCompare(first.lastMessageAt);
    }

    if (first.lastMessageAt) {
      return -1;
    }

    if (second.lastMessageAt) {
      return 1;
    }

    return first.displayName.localeCompare(second.displayName);
  });
}

export async function getGroupEncryptionContext(
  decodedToken: DecodedIdToken,
  groupId: string,
  senderDeviceId: string
): Promise<GroupEncryptionContextResponse> {
  const context = await getGroupChatContext(decodedToken, groupId);
  const [senderDevice, recipientDevices] = await Promise.all([
    getActiveDevice(context.tenantId, decodedToken.uid, senderDeviceId),
    listActiveDevicesForGroupMembers(context.tenantId, context.memberIds, senderDeviceId)
  ]);

  if (!senderDevice) {
    throw authorizationError('This device is not authorized.');
  }

  if (!recipientDevices.some((device) => device.uid !== decodedToken.uid)) {
    throw validationError('Group members need to open Synzapp once before encrypted group chat is available.');
  }

  return {
    recipientDevices: recipientDevices.map(mapDevicePublicKey),
    senderDevice: mapDevicePublicKey(senderDevice)
  };
}

export async function listEncryptedGroupEnvelopesForDevice(
  decodedToken: DecodedIdToken,
  groupId: string,
  deviceId: string,
  options: ListEncryptedGroupEnvelopeOptions = {}
): Promise<EncryptedGroupEnvelopeForDevice[]> {
  const context = await getGroupChatContext(decodedToken, groupId);
  const activeDevice = await getActiveDevice(context.tenantId, decodedToken.uid, deviceId);

  if (!activeDevice) {
    throw authorizationError('This device is not authorized.');
  }

  const shouldMarkDelivered = options.markAsDelivered !== false;
  const shouldMarkRead = options.markAsRead !== false;

  await cleanupRetainedEncryptedEnvelopes(context.groupRef);

  const envelopesSnapshot = await context.groupRef
    .collection('encryptedEnvelopes')
    .orderBy('sentAtMs', 'asc')
    .limit(options.limit || 100)
    .get();
  const nowMs = Date.now();
  const batch = firestore.batch();
  let hasBatchUpdates = false;
  const envelopes = envelopesSnapshot.docs
    .map((doc) => {
      const record = doc.data() as EncryptedGroupEnvelopeRecord;
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

      return mapEncryptedGroupEnvelopeForDevice(decodedToken.uid, deviceId, doc.id, record, encryptedKeyForDevice);
    })
    .filter((envelope): envelope is EncryptedGroupEnvelopeForDevice => Boolean(envelope));

  if (hasBatchUpdates) {
    await batch.commit();
  }

  if (shouldMarkRead) {
    await context.groupRef.set({
      lastReadAtByUser: {
        [decodedToken.uid]: fieldValue.serverTimestamp()
      },
      unreadCounts: {
        [decodedToken.uid]: 0
      },
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });
  }

  await cleanupRetainedEncryptedEnvelopes(context.groupRef);

  return envelopes;
}

export async function sendEncryptedGroupEnvelope(
  decodedToken: DecodedIdToken,
  groupId: string,
  input: SendEncryptedDirectEnvelopeInput
): Promise<EncryptedGroupEnvelopeResponse> {
  const context = await getGroupChatContext(decodedToken, groupId);
  const uniqueRecipientDeviceIds = Array.from(new Set(input.recipientDeviceIds));

  if (uniqueRecipientDeviceIds.length !== input.recipientDeviceIds.length) {
    throw validationError('Recipient devices must be unique.');
  }

  const [senderDevice, expectedRecipientDevices] = await Promise.all([
    getActiveDevice(context.tenantId, decodedToken.uid, input.senderDeviceId),
    listActiveDevicesForGroupMembers(context.tenantId, context.memberIds, input.senderDeviceId)
  ]);

  if (!senderDevice?.keyAgreementPublicKey) {
    throw authorizationError('This device is not authorized.');
  }

  assertExactRecipientDevices(
    uniqueRecipientDeviceIds,
    expectedRecipientDevices.map((device) => device.deviceId || ''),
    expectedRecipientDevices.some((device) => device.uid !== decodedToken.uid)
  );
  uniqueRecipientDeviceIds.forEach((deviceId) => {
    if (!input.encryptedKeysByDevice[deviceId]) {
      throw validationError('Encrypted key material is missing for a recipient device.');
    }

    if (input.notificationPreviewByDevice && !input.notificationPreviewByDevice[deviceId]) {
      throw validationError('Encrypted notification preview is missing for a recipient device.');
    }
  });

  const envelopeRef = context.groupRef.collection('encryptedEnvelopes').doc();
  const messageMetadataRef = context.groupRef.collection('messageMetadata').doc(envelopeRef.id);
  const sentAtMs = Date.now();
  const recipientUids = Array.from(new Set(
    expectedRecipientDevices
      .map((device) => device.uid || '')
      .filter((uid) => uid && uid !== decodedToken.uid)
  ));
  const unreadCounts = Object.fromEntries(
    context.memberIds.map((memberId) => [
      memberId,
      memberId === decodedToken.uid ? 0 : fieldValue.increment(1)
    ])
  );

  await firestore.runTransaction(async (transaction) => {
    transaction.set(envelopeRef, {
      algorithm: input.algorithm,
      ciphertext: input.ciphertext,
      clientMessageId: input.clientMessageId,
      createdAt: fieldValue.serverTimestamp(),
      encryptedKeysByDevice: input.encryptedKeysByDevice,
      envelopeId: envelopeRef.id,
      expiresAtMs: sentAtMs + ENCRYPTED_ENVELOPE_TTL_MS,
      groupId: context.groupId,
      keyVersion: input.keyVersion,
      nonce: input.nonce,
      ...(input.notificationPreviewByDevice
        ? { notificationPreviewByDevice: input.notificationPreviewByDevice }
        : {}),
      recipientDeviceIds: uniqueRecipientDeviceIds,
      recipientUids,
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
      conversationId: context.groupId,
      createdAt: fieldValue.serverTimestamp(),
      envelopeId: envelopeRef.id,
      groupId: context.groupId,
      memberIds: context.memberIds,
      recipientUids,
      senderUid: decodedToken.uid,
      sentAtMs,
      status: 'ACTIVE',
      tenantId: context.tenantId,
      updatedAt: fieldValue.serverTimestamp()
    });

    transaction.set(context.groupRef, {
      encryptionMode: 'E2EE',
      lastEncryptedEnvelopeId: envelopeRef.id,
      lastMessageId: envelopeRef.id,
      lastMessageSenderUid: decodedToken.uid,
      lastMessageSentAtMs: sentAtMs,
      lastMessageText: null,
      serverEnvelopeExpiresAtMs: sentAtMs + ENCRYPTED_ENVELOPE_TTL_MS,
      unreadCounts,
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });
  });

  return {
    algorithm: input.algorithm,
    clientMessageId: input.clientMessageId,
    conversationId: context.groupId,
    envelopeId: envelopeRef.id,
    keyVersion: input.keyVersion,
    notificationPreviewByDevice: input.notificationPreviewByDevice,
    recipientDeviceIds: uniqueRecipientDeviceIds,
    recipientUids,
    senderDeviceId: input.senderDeviceId,
    senderKeyAgreementPublicKey: senderDevice.keyAgreementPublicKey,
    sentAt: new Date(sentAtMs).toISOString(),
    tenantId: context.tenantId
  };
}

export async function getGroupChatContact(
  decodedToken: DecodedIdToken,
  groupId: string
): Promise<GroupChatContact> {
  const context = await getGroupChatContext(decodedToken, groupId);
  const activeRecipientDeviceCount = await countActiveRecipientDevices(
    context.tenantId,
    context.memberIds,
    decodedToken.uid
  );

  return buildGroupChatContact(
    decodedToken.uid,
    context.groupId,
    context.group,
    context.memberIds,
    activeRecipientDeviceCount
  );
}

async function getActiveUserContext(decodedToken: DecodedIdToken) {
  const session = await buildAuthSession(decodedToken);
  const { role, status, tenantId } = session.user;

  if (session.access !== 'ACTIVE' || status !== 'ACTIVE' || !tenantId || !role) {
    throw authorizationError('Your profile is not active.');
  }

  const organizationRef = firestore.collection('organizations').doc(tenantId);
  const userSnapshot = await organizationRef.collection('users').doc(decodedToken.uid).get();

  if (!userSnapshot.exists) {
    throw authorizationError('Your profile is not active.');
  }

  const user = userSnapshot.data() as TenantUserRecord;

  if (user.tenantId !== tenantId || user.status !== 'ACTIVE' || !user.role) {
    throw authorizationError('Your profile is not active.');
  }

  return {
    role: user.role,
    tenantId,
    user
  };
}

async function getGroupChatContext(decodedToken: DecodedIdToken, groupId: string): Promise<GroupChatContext> {
  const context = await getActiveUserContext(decodedToken);
  const safeGroupId = groupId.trim();

  if (!safeGroupId || !/^group_[A-Za-z0-9_-]{8,160}$/.test(safeGroupId)) {
    throw notFoundError('Group chat was not found.');
  }

  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const groupRef = organizationRef.collection('groups').doc(safeGroupId);
  const groupSnapshot = await groupRef.get();

  if (!groupSnapshot.exists) {
    throw notFoundError('Group chat was not found.');
  }

  const group = groupSnapshot.data() as TenantGroupRecord;

  if (group.tenantId !== context.tenantId || group.status !== 'ACTIVE' || group.chatType !== 'GROUP_CHAT') {
    throw notFoundError('Group chat was not found.');
  }

  const memberIds = await getActiveGroupMemberIds(groupRef);

  if (!memberIds.includes(decodedToken.uid)) {
    throw notFoundError('Group chat was not found.');
  }

  return {
    group,
    groupId: safeGroupId,
    groupRef,
    memberIds,
    tenantId: context.tenantId
  };
}

async function getActiveGroupMemberIds(groupRef: DocumentReference): Promise<string[]> {
  const snapshot = await groupRef
    .collection('members')
    .where('status', '==', 'ACTIVE')
    .get();

  return snapshot.docs
    .map((doc) => {
      const member = doc.data() as GroupMemberRecord;

      return member.uid || doc.id;
    })
    .filter(Boolean)
    .sort();
}

async function listActiveDevicesForGroupMembers(
  tenantId: string,
  memberIds: string[],
  excludedDeviceId: string
): Promise<DeviceKeyRecord[]> {
  const deviceSnapshots = await Promise.all(memberIds.map((uid) =>
    firestore
      .collection('organizations')
      .doc(tenantId)
      .collection('deviceKeys')
      .where('uid', '==', uid)
      .where('status', '==', 'ACTIVE')
      .get()
  ));

  return deviceSnapshots
    .flatMap((snapshot) => snapshot.docs)
    .map((doc) => ({ ...(doc.data() as DeviceKeyRecord), deviceId: (doc.data() as DeviceKeyRecord).deviceId || doc.id }))
    .filter((device) => (
      device.tenantId === tenantId &&
      Boolean(device.uid && memberIds.includes(device.uid)) &&
      Boolean(device.keyAgreementPublicKey) &&
      device.deviceId !== excludedDeviceId
    ));
}

async function countActiveRecipientDevices(
  tenantId: string,
  memberIds: string[],
  currentUid: string
): Promise<number> {
  const devices = await listActiveDevicesForGroupMembers(tenantId, memberIds, '');

  return devices.filter((device) => device.uid !== currentUid).length;
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

async function cleanupRetainedEncryptedEnvelopes(groupRef: DocumentReference): Promise<void> {
  const nowMs = Date.now();
  const expiredSnapshot = await groupRef
    .collection('encryptedEnvelopes')
    .where('expiresAtMs', '<=', nowMs)
    .limit(50)
    .get();
  const recentSnapshot = await groupRef
    .collection('encryptedEnvelopes')
    .orderBy('sentAtMs', 'asc')
    .limit(100)
    .get();
  const refsToDelete = new Map<string, DocumentReference>();

  expiredSnapshot.docs.forEach((doc) => {
    refsToDelete.set(doc.ref.path, doc.ref);
  });
  recentSnapshot.docs.forEach((doc) => {
    const record = doc.data() as EncryptedGroupEnvelopeRecord;

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

function shouldDeleteRetainedEnvelope(record: EncryptedGroupEnvelopeRecord, nowMs: number): boolean {
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

function buildGroupChatContact(
  currentUid: string,
  groupId: string,
  group: TenantGroupRecord,
  memberIds: string[],
  activeRecipientDeviceCount: number
): GroupChatContact {
  const name = group.name || 'Group chat';
  const lastMessageSentAtMs = group.lastMessageSentAtMs || null;

  return {
    chatType: 'GROUP',
    contactId: groupId,
    conversationId: groupId,
    displayName: name,
    hasActiveDevice: activeRecipientDeviceCount > 0,
    initials: getInitials(name),
    isOnline: false,
    lastMessageAt: lastMessageSentAtMs ? new Date(lastMessageSentAtMs).toISOString() : null,
    lastSeenAt: null,
    memberCount: group.memberCount || memberIds.length,
    messagePermissionMode: group.messagePermissionMode || 'ALL_MEMBERS',
    preview: '',
    profilePhotoCacheKey: null,
    profilePhotoUrl: null,
    role: 'EMPLOYEE',
    roleName: memberIds.length === 1 ? 'Group chat - 1 member' : `Group chat - ${memberIds.length} members`,
    status: group.status || 'ACTIVE',
    tenantId: group.tenantId || '',
    unreadCount: group.unreadCounts?.[currentUid] || 0
  };
}

function mapEncryptedGroupEnvelopeForDevice(
  currentUid: string,
  deviceId: string,
  fallbackId: string,
  record: EncryptedGroupEnvelopeRecord,
  encryptedKeyForDevice: string
): EncryptedGroupEnvelopeForDevice {
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
  record: EncryptedGroupEnvelopeRecord
): EncryptedGroupEnvelopeForDevice['deliveryStatus'] {
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

function assertExactRecipientDevices(
  providedDeviceIds: string[],
  expectedDeviceIds: string[],
  hasActiveOtherMemberDevice: boolean
): void {
  const provided = new Set(providedDeviceIds);
  const expected = new Set(expectedDeviceIds.filter(Boolean));

  if (!expected.size || !hasActiveOtherMemberDevice) {
    throw validationError('Group members need to open Synzapp once before encrypted group chat is available.');
  }

  if (provided.size !== expected.size) {
    throw validationError('Recipient device list is stale. Reload the group chat and try again.');
  }

  expected.forEach((deviceId) => {
    if (!provided.has(deviceId)) {
      throw validationError('Recipient device list is stale. Reload the group chat and try again.');
    }
  });
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

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'G';
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
