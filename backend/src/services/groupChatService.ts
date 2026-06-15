import { randomUUID } from 'node:crypto';
import { DecodedIdToken } from 'firebase-admin/auth';
import type { DocumentReference } from 'firebase-admin/firestore';
import { fieldValue, firestore, storageBucket } from '../config/firebaseAdmin.js';
import { SynzappRole } from '../types/auth.js';
import { buildAuthSession } from './authSessionService.js';
import {
  EncryptedNotificationPreviewRecord,
  EncryptionDevicePublicKey,
  SendEncryptedDirectEnvelopeInput
} from './encryptedMessageEnvelopeService.js';
import {
  buildDepartmentSystemGroupId,
  buildDepartmentSystemGroupRecord
} from './groupService.js';
import type {
  ChatMessageReaction,
  ChatMessageReactionMap
} from './userProfileService.js';

const GROUP_HIDDEN_MESSAGE_LIMIT = 5000;
const GROUP_HISTORY_KEY_GRANT_DEVICE_LIMIT = 100;
const GROUP_HISTORY_KEY_GRANT_ENVELOPE_LIMIT = 100;

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
  isDepartmentDefault: boolean;
  isOnline: boolean;
  lastMessageAt: string | null;
  lastSeenAt: string | null;
  memberCount: number;
  members: GroupChatMember[];
  memberPolicy: 'DEPARTMENT_PLUS_EXPLICIT' | 'EXPLICIT';
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

export interface GroupChatMember {
  displayName: string;
  initials: string;
  profilePhotoCacheKey: string | null;
  profilePhotoUrl: string | null;
  role: SynzappRole;
  roleName: string;
  uid: string;
}

export interface GroupChatAddableGroup {
  autoMembershipDepartmentId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  description: string | null;
  groupId: string;
  isDepartmentDefault: boolean;
  memberCount: number;
  memberPolicy: 'DEPARTMENT_PLUS_EXPLICIT' | 'EXPLICIT';
  name: string;
  scope: 'COMPANY' | 'DEPARTMENT';
  status: string;
  systemManaged: boolean;
  tenantId: string;
}

export interface AddGroupChatMemberResult {
  added: boolean;
  group: GroupChatAddableGroup;
  groupId: string;
  memberId: string;
  tenantId: string;
}

export interface ExitGroupChatResult {
  exited: boolean;
  groupId: string;
  tenantId: string;
}

export interface GroupEncryptionContextResponse {
  recipientDevices: EncryptionDevicePublicKey[];
  senderDevice: EncryptionDevicePublicKey;
}

export interface GroupChatMemberProfilePhoto {
  cacheKey: string;
  contentType: string;
  file: ReturnType<typeof storageBucket.file>;
}

export interface EncryptedGroupEnvelopeForDevice {
  algorithm: string;
  ciphertext: string;
  clientMessageId: string;
  deliveryStatus: 'delivered' | 'read' | 'sent' | null;
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

export interface GroupHistoryKeyGrantInput {
  encryptedKeysByDevice: Record<string, string>;
  envelopeId: string;
}

export interface GroupHistoryKeyGrantResult {
  grantedDeviceCount: number;
  grantedEnvelopeCount: number;
  groupId: string;
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
  autoMembershipDepartmentId?: string | null;
  chatType?: string;
  createdBy?: string;
  departmentId?: string | null;
  departmentName?: string | null;
  description?: string | null;
  groupId?: string;
  isDepartmentDefault?: boolean;
  lastMessageSentAtMs?: number | null;
  memberCount?: number;
  memberPolicy?: 'DEPARTMENT_PLUS_EXPLICIT' | 'EXPLICIT';
  messageReactions?: GroupChatMessageReactionRecord;
  messagePermissionMode?: 'ADMINS' | 'ALL_MEMBERS';
  name?: string;
  scope?: 'COMPANY' | 'DEPARTMENT';
  status?: string;
  systemManaged?: boolean;
  tenantId?: string;
  unreadCounts?: Record<string, number>;
}

interface TenantUserRecord {
  departmentId?: string | null;
  departmentName?: string | null;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  profilePhotoContentType?: string | null;
  profilePhotoStoragePath?: string | null;
  profilePhotoVersion?: number | null;
  role?: SynzappRole;
  roleName?: string;
  status?: string;
  tenantId?: string;
  uid?: string;
}

interface TenantDepartmentRecord {
  departmentId?: string;
  description?: string | null;
  name?: string;
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
  expiresAtMs?: number | null;
  groupId?: string;
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
  tenantId?: string;
}

interface GroupHiddenMessageRecord {
  groupId?: string;
  hiddenAtMs?: number;
  messageId?: string;
  tenantId?: string;
  uid?: string;
}

interface GroupChatReactionRecord {
  emoji?: string;
  reactedAtMs?: number;
  uid?: string;
}

type GroupChatUserReactionRecord = GroupChatReactionRecord | GroupChatReactionRecord[];
type GroupChatMessageReactionRecord = Record<string, Record<string, GroupChatUserReactionRecord>>;

interface GroupChatMessageMetadataRecord {
  envelopeId?: string;
  groupId?: string;
  memberIds?: string[];
  recipientUids?: string[];
  senderUid?: string;
  status?: string;
  tenantId?: string;
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

  return buildHydratedGroupChatContact(
    decodedToken.uid,
    context.tenantId,
    groupId,
    group,
    memberIds,
    await countActiveRecipientDevices(context.tenantId, memberIds, decodedToken.uid)
  );
}

export async function listCurrentUserGroupChatContacts(
  decodedToken: DecodedIdToken
): Promise<GroupChatContact[]> {
  const context = await getActiveUserContext(decodedToken);
  const organizationRef = firestore.collection('organizations').doc(context.tenantId);

  await ensureDepartmentSystemGroupsForUser(context);

  const snapshot = await organizationRef
    .collection('groups')
    .where('status', '==', 'ACTIVE')
    .get();
  const contacts: GroupChatContact[] = [];

  for (const doc of snapshot.docs) {
    const group = doc.data() as TenantGroupRecord;

    if (group.tenantId !== context.tenantId || !isChatEnabledGroup(group)) {
      continue;
    }

    const memberIds = await getActiveGroupMemberIds(context.tenantId, doc.ref, group);

    if (!memberIds.includes(decodedToken.uid)) {
      continue;
    }

    contacts.push(await buildHydratedGroupChatContact(
      decodedToken.uid,
      context.tenantId,
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

export async function listAddableGroupChatTargets(
  decodedToken: DecodedIdToken,
  memberUid: string
): Promise<GroupChatAddableGroup[]> {
  const context = await getActiveUserContext(decodedToken);
  const member = await getVisibleGroupAddMember(context, memberUid);
  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const groups: GroupChatAddableGroup[] = [];

  await ensureDepartmentSystemGroupsForUser(context);

  const snapshot = await organizationRef
    .collection('groups')
    .where('status', '==', 'ACTIVE')
    .get();

  for (const doc of snapshot.docs) {
    const group = doc.data() as TenantGroupRecord;

    if (group.tenantId !== context.tenantId || !isChatEnabledGroup(group)) {
      continue;
    }

    const memberIds = await getActiveGroupMemberIds(context.tenantId, doc.ref, group);
    const safeMemberUid = member.uid || memberUid.trim();

    if (
      memberIds.includes(safeMemberUid) ||
      !canAddMemberToGroup(context, group, memberIds) ||
      memberIds.length >= 50
    ) {
      continue;
    }

    groups.push(mapGroupChatAddableGroup(context.tenantId, doc.id, group, memberIds.length));
  }

  return groups.sort((first, second) => first.name.localeCompare(second.name));
}

export async function addGroupChatMember(
  decodedToken: DecodedIdToken,
  groupId: string,
  memberUid: string
): Promise<AddGroupChatMemberResult> {
  const context = await getActiveUserContext(decodedToken);
  const safeGroupId = normalizeGroupId(groupId);
  const member = await getVisibleGroupAddMember(context, memberUid);
  const safeMemberUid = member.uid || memberUid.trim();
  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const groupRef = organizationRef.collection('groups').doc(safeGroupId);
  const groupSnapshot = await groupRef.get();

  if (!groupSnapshot.exists) {
    throw notFoundError('Group chat was not found.');
  }

  const group = groupSnapshot.data() as TenantGroupRecord;

  if (group.tenantId !== context.tenantId || group.status !== 'ACTIVE' || !isChatEnabledGroup(group)) {
    throw notFoundError('Group chat was not found.');
  }

  const memberIds = await getActiveGroupMemberIds(context.tenantId, groupRef, group);

  if (!canAddMemberToGroup(context, group, memberIds)) {
    throw authorizationError('You do not have permission to add members to this group.');
  }

  if (memberIds.includes(safeMemberUid)) {
    return {
      added: false,
      group: mapGroupChatAddableGroup(context.tenantId, safeGroupId, group, memberIds.length),
      groupId: safeGroupId,
      memberId: safeMemberUid,
      tenantId: context.tenantId
    };
  }

  if (memberIds.length >= 50) {
    throw validationError('Group chats can include up to 50 members for now.');
  }

  let added = true;

  await firestore.runTransaction(async (transaction) => {
    const [freshGroupSnapshot, explicitMemberSnapshot] = await Promise.all([
      transaction.get(groupRef),
      transaction.get(groupRef.collection('members').doc(safeMemberUid))
    ]);

    if (!freshGroupSnapshot.exists) {
      throw notFoundError('Group chat was not found.');
    }

    const freshGroup = freshGroupSnapshot.data() as TenantGroupRecord;

    if (
      freshGroup.tenantId !== context.tenantId ||
      freshGroup.status !== 'ACTIVE' ||
      !isChatEnabledGroup(freshGroup)
    ) {
      throw notFoundError('Group chat was not found.');
    }

    const explicitMember = explicitMemberSnapshot.exists
      ? explicitMemberSnapshot.data() as GroupMemberRecord
      : null;

    if (explicitMember?.tenantId === context.tenantId && explicitMember.status === 'ACTIVE') {
      added = false;
      return;
    }

    transaction.set(groupRef.collection('members').doc(safeMemberUid), {
      addedAt: fieldValue.serverTimestamp(),
      addedBy: context.uid,
      role: 'MEMBER',
      status: 'ACTIVE',
      tenantId: context.tenantId,
      uid: safeMemberUid
    }, { merge: true });

    transaction.set(groupRef, {
      memberCount: fieldValue.increment(1),
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });
  });

  const updatedGroupSnapshot = await groupRef.get();
  const updatedGroup = updatedGroupSnapshot.data() as TenantGroupRecord;
  const updatedMemberIds = await getActiveGroupMemberIds(context.tenantId, groupRef, updatedGroup);

  return {
    added,
    group: mapGroupChatAddableGroup(context.tenantId, safeGroupId, updatedGroup, updatedMemberIds.length),
    groupId: safeGroupId,
    memberId: safeMemberUid,
    tenantId: context.tenantId
  };
}

export async function exitGroupChat(
  decodedToken: DecodedIdToken,
  groupId: string
): Promise<ExitGroupChatResult> {
  const context = await getActiveUserContext(decodedToken);
  const safeGroupId = normalizeGroupId(groupId);
  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const groupRef = organizationRef.collection('groups').doc(safeGroupId);
  const memberRef = groupRef.collection('members').doc(context.uid);
  let exited = false;

  await firestore.runTransaction(async (transaction) => {
    const [groupSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(groupRef),
      transaction.get(memberRef)
    ]);

    if (!groupSnapshot.exists) {
      throw notFoundError('Group chat was not found.');
    }

    const group = groupSnapshot.data() as TenantGroupRecord;

    if (group.tenantId !== context.tenantId || group.status !== 'ACTIVE' || !isChatEnabledGroup(group)) {
      throw notFoundError('Group chat was not found.');
    }

    if (!canCurrentUserExitGroupChat(group)) {
      throw authorizationError('Department group chats cannot be exited.');
    }

    if (!memberSnapshot.exists) {
      throw authorizationError('You are not a member of this group.');
    }

    const member = memberSnapshot.data() as GroupMemberRecord;

    if (member.tenantId !== context.tenantId || member.status === 'LEFT' || member.status === 'REMOVED') {
      throw authorizationError('You are not an active member of this group.');
    }

    const nextMemberCount = Math.max((group.memberCount || 1) - 1, 0);

    transaction.set(memberRef, {
      leftAt: fieldValue.serverTimestamp(),
      leftBy: context.uid,
      status: 'LEFT',
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });

    transaction.set(groupRef, {
      memberCount: nextMemberCount,
      unreadCounts: {
        [context.uid]: 0
      },
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });

    exited = true;
  });

  return {
    exited,
    groupId: safeGroupId,
    tenantId: context.tenantId
  };
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

  const [envelopesSnapshot, hiddenMessageIds, activeGroupDevices] = await Promise.all([
    context.groupRef
      .collection('encryptedEnvelopes')
      .orderBy('sentAtMs', 'asc')
      .limit(options.limit || 500)
      .get(),
    getHiddenGroupMessageIds(context.groupRef, context.tenantId, decodedToken.uid),
    listActiveDevicesForGroupMembers(context.tenantId, context.memberIds, '')
  ]);
  const activeGroupDevicesById = new Map(activeGroupDevices
    .filter((device) => Boolean(device.deviceId && device.keyAgreementPublicKey))
    .map((device) => [device.deviceId || '', device]));
  const nowMs = Date.now();
  const batch = firestore.batch();
  let hasBatchUpdates = false;
  const envelopes = envelopesSnapshot.docs
    .map((doc) => {
      const record = doc.data() as EncryptedGroupEnvelopeRecord;
      const encryptedKeyForDevice = record.encryptedKeysByDevice?.[deviceId];

      if (hiddenMessageIds.has(record.envelopeId || doc.id)) {
        return null;
      }

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

      return mapEncryptedGroupEnvelopeForDevice(
        decodedToken.uid,
        deviceId,
        doc.id,
        record,
        encryptedKeyForDevice,
        getMissingHistoryKeyRecipientDevices(record, activeGroupDevicesById, deviceId)
      );
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

  return envelopes;
}

export async function grantGroupChatHistoryKeys(
  decodedToken: DecodedIdToken,
  groupId: string,
  grantingDeviceId: string,
  grants: GroupHistoryKeyGrantInput[]
): Promise<GroupHistoryKeyGrantResult> {
  const context = await getGroupChatContext(decodedToken, groupId);
  const grantingDevice = await getActiveDevice(context.tenantId, decodedToken.uid, grantingDeviceId);

  if (!grantingDevice) {
    throw authorizationError('This device is not authorized.');
  }

  const activeGroupDevices = await listActiveDevicesForGroupMembers(context.tenantId, context.memberIds, '');
  const activeGroupDevicesById = new Map(activeGroupDevices
    .filter((device) => Boolean(device.deviceId && device.keyAgreementPublicKey))
    .map((device) => [device.deviceId || '', device]));
  const normalizedGrants = grants
    .map(normalizeGroupHistoryKeyGrant)
    .filter((grant): grant is GroupHistoryKeyGrantInput => Boolean(grant))
    .slice(0, GROUP_HISTORY_KEY_GRANT_ENVELOPE_LIMIT);

  if (!normalizedGrants.length) {
    return {
      grantedDeviceCount: 0,
      grantedEnvelopeCount: 0,
      groupId: context.groupId,
      tenantId: context.tenantId
    };
  }

  let grantedDeviceCount = 0;
  let grantedEnvelopeCount = 0;

  await firestore.runTransaction(async (transaction) => {
    const grantRefs = normalizedGrants.map((grant) => ({
      grant,
      ref: context.groupRef.collection('encryptedEnvelopes').doc(grant.envelopeId)
    }));
    const snapshots = await Promise.all(grantRefs.map(({ ref }) => transaction.get(ref)));

    snapshots.forEach((snapshot, index) => {
      if (!snapshot.exists) {
        return;
      }

      const { grant } = grantRefs[index];
      const record = snapshot.data() as EncryptedGroupEnvelopeRecord;

      if (
        record.tenantId !== context.tenantId ||
        record.groupId !== context.groupId ||
        !record.encryptedKeysByDevice?.[grantingDeviceId]
      ) {
        return;
      }

      const existingKeysByDevice = record.encryptedKeysByDevice || {};
      const nextKeysByDevice = {
        ...existingKeysByDevice
      };
      const nextRecipientDeviceIds = new Set(record.recipientDeviceIds || []);
      let nextGrantedDeviceCount = 0;

      Object.entries(grant.encryptedKeysByDevice)
        .slice(0, GROUP_HISTORY_KEY_GRANT_DEVICE_LIMIT)
        .forEach(([deviceId, encryptedKey]) => {
          const targetDevice = activeGroupDevicesById.get(deviceId);

          if (
            !targetDevice ||
            existingKeysByDevice[deviceId] ||
            deviceId === grantingDeviceId ||
            !isEncryptedGroupHistoryKeyGrantPayload(encryptedKey)
          ) {
            return;
          }

          nextKeysByDevice[deviceId] = encryptedKey;
          nextRecipientDeviceIds.add(deviceId);
          nextGrantedDeviceCount += 1;
        });

      if (!nextGrantedDeviceCount) {
        return;
      }

      transaction.set(snapshot.ref, {
        encryptedKeysByDevice: nextKeysByDevice,
        historyKeyGrantedAt: fieldValue.serverTimestamp(),
        historyKeyGrantedByDeviceId: grantingDeviceId,
        recipientDeviceIds: [...nextRecipientDeviceIds],
        updatedAt: fieldValue.serverTimestamp()
      }, { merge: true });

      grantedDeviceCount += nextGrantedDeviceCount;
      grantedEnvelopeCount += 1;
    });
  });

  return {
    grantedDeviceCount,
    grantedEnvelopeCount,
    groupId: context.groupId,
    tenantId: context.tenantId
  };
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
      expiresAtMs: null,
      groupId: context.groupId,
      historyRetentionPolicy: 'DURABLE_GROUP_HISTORY',
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
      serverEnvelopeExpiresAtMs: null,
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

  return buildHydratedGroupChatContact(
    decodedToken.uid,
    context.tenantId,
    context.groupId,
    context.group,
    context.memberIds,
    activeRecipientDeviceCount
  );
}

export async function getGroupChatMessageReactions(
  decodedToken: DecodedIdToken,
  groupId: string
): Promise<ChatMessageReactionMap> {
  const context = await getGroupChatContext(decodedToken, groupId);

  return mapGroupChatMessageReactions(context.group);
}

export async function updateGroupChatMessageReaction(
  decodedToken: DecodedIdToken,
  groupId: string,
  messageId: string,
  emoji: string
): Promise<{ contact: GroupChatContact; messageReactions: ChatMessageReactionMap }> {
  const context = await getGroupChatContext(decodedToken, groupId);
  const safeMessageId = normalizeGroupMessageId(messageId);
  const safeEmoji = emoji.trim();

  if (safeEmoji.length > 16) {
    throw validationError('Reaction is not valid.');
  }

  const messageEnvelopeRef = context.groupRef.collection('encryptedEnvelopes').doc(safeMessageId);
  const messageMetadataRef = context.groupRef.collection('messageMetadata').doc(safeMessageId);
  let nextGroup: TenantGroupRecord | null = null;

  await firestore.runTransaction(async (transaction) => {
    const [groupSnapshot, messageMetadataSnapshot, messageEnvelopeSnapshot] = await Promise.all([
      transaction.get(context.groupRef),
      transaction.get(messageMetadataRef),
      transaction.get(messageEnvelopeRef)
    ]);

    if (!groupSnapshot.exists) {
      throw notFoundError('Group chat was not found.');
    }

    if (messageMetadataSnapshot.exists) {
      const messageMetadata = messageMetadataSnapshot.data() as GroupChatMessageMetadataRecord;

      if (
        messageMetadata.tenantId !== context.tenantId ||
        messageMetadata.groupId !== context.groupId ||
        (
          Array.isArray(messageMetadata.memberIds) &&
          !messageMetadata.memberIds.includes(decodedToken.uid)
        ) ||
        (
          messageMetadata.status &&
          messageMetadata.status !== 'ACTIVE'
        )
      ) {
        throw notFoundError('Message was not found.');
      }
    } else if (safeEmoji) {
      const messageEnvelope = messageEnvelopeSnapshot.exists
        ? messageEnvelopeSnapshot.data() as EncryptedGroupEnvelopeRecord
        : null;

      transaction.set(messageMetadataRef, {
        createdAt: fieldValue.serverTimestamp(),
        envelopeId: safeMessageId,
        groupId: context.groupId,
        legacyLocalHistoryIndexedAt: messageEnvelopeSnapshot.exists
          ? null
          : fieldValue.serverTimestamp(),
        memberIds: context.memberIds,
        recipientUids: messageEnvelope?.recipientUids || [],
        senderUid: messageEnvelope?.senderUid || null,
        sentAtMs: messageEnvelope?.sentAtMs || null,
        status: 'ACTIVE',
        tenantId: context.tenantId,
        updatedAt: fieldValue.serverTimestamp()
      }, { merge: true });
    }

    const group = groupSnapshot.data() as TenantGroupRecord;
    const messageReactions = cloneGroupChatMessageReactionRecord(group.messageReactions);
    const reactionsForMessage = {
      ...(messageReactions[safeMessageId] || {})
    };

    if (safeEmoji) {
      const existingUserReactions = normalizeGroupChatUserReactions(
        reactionsForMessage[decodedToken.uid],
        decodedToken.uid
      );
      const hasExistingEmoji = existingUserReactions.some((reaction) => reaction.emoji === safeEmoji);
      const nextUserReactions = hasExistingEmoji
        ? existingUserReactions.filter((reaction) => reaction.emoji !== safeEmoji)
        : [
            ...existingUserReactions,
            {
              emoji: safeEmoji,
              reactedAtMs: Date.now(),
              uid: decodedToken.uid
            }
          ].slice(-12);

      if (nextUserReactions.length) {
        reactionsForMessage[decodedToken.uid] = nextUserReactions;
      } else {
        delete reactionsForMessage[decodedToken.uid];
      }
    } else {
      delete reactionsForMessage[decodedToken.uid];
    }

    if (Object.keys(reactionsForMessage).length) {
      messageReactions[safeMessageId] = reactionsForMessage;
    } else {
      delete messageReactions[safeMessageId];
    }

    nextGroup = {
      ...group,
      messageReactions
    };

    transaction.set(context.groupRef, {
      messageReactions,
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });
  });

  return {
    contact: await getGroupChatContact(decodedToken, context.groupId),
    messageReactions: mapGroupChatMessageReactions(nextGroup || context.group)
  };
}

export async function hideGroupChatMessageForCurrentUser(
  decodedToken: DecodedIdToken,
  groupId: string,
  messageId: string
): Promise<{ contact: GroupChatContact; hiddenMessageIds: string[] }> {
  const context = await getGroupChatContext(decodedToken, groupId);
  const safeMessageId = normalizeGroupMessageId(messageId);
  const messageEnvelopeRef = context.groupRef.collection('encryptedEnvelopes').doc(safeMessageId);
  const messageMetadataRef = context.groupRef.collection('messageMetadata').doc(safeMessageId);
  const hiddenMessageRef = context.groupRef
    .collection('memberMessageVisibility')
    .doc(decodedToken.uid)
    .collection('hiddenMessages')
    .doc(safeMessageId);
  const nowMs = Date.now();

  await firestore.runTransaction(async (transaction) => {
    const [messageEnvelopeSnapshot, messageMetadataSnapshot] = await Promise.all([
      transaction.get(messageEnvelopeRef),
      transaction.get(messageMetadataRef)
    ]);

    if (!messageEnvelopeSnapshot.exists && !messageMetadataSnapshot.exists) {
      throw notFoundError('Message was not found.');
    }

    if (messageMetadataSnapshot.exists) {
      const messageMetadata = messageMetadataSnapshot.data() as GroupChatMessageMetadataRecord;

      if (
        messageMetadata.tenantId !== context.tenantId ||
        messageMetadata.groupId !== context.groupId ||
        (
          Array.isArray(messageMetadata.memberIds) &&
          !messageMetadata.memberIds.includes(decodedToken.uid)
        ) ||
        (
          messageMetadata.status &&
          messageMetadata.status !== 'ACTIVE'
        )
      ) {
        throw notFoundError('Message was not found.');
      }
    }

    transaction.set(hiddenMessageRef, {
      createdAt: fieldValue.serverTimestamp(),
      groupId: context.groupId,
      hiddenAt: fieldValue.serverTimestamp(),
      hiddenAtMs: nowMs,
      messageId: safeMessageId,
      tenantId: context.tenantId,
      uid: decodedToken.uid,
      updatedAt: fieldValue.serverTimestamp()
    });
  });

  return {
    contact: await getGroupChatContact(decodedToken, context.groupId),
    hiddenMessageIds: [safeMessageId]
  };
}

export async function getGroupChatMediaContext(
  decodedToken: DecodedIdToken,
  groupId: string
) {
  return getGroupChatRealtimeContext(decodedToken, groupId);
}

export async function getGroupChatRealtimeContext(
  decodedToken: DecodedIdToken,
  groupId: string
) {
  const context = await getGroupChatContext(decodedToken, groupId);

  return {
    chatId: context.groupId,
    chatRef: context.groupRef,
    groupId: context.groupId,
    memberIds: context.memberIds,
    tenantId: context.tenantId
  };
}

export async function getGroupChatMemberProfilePhoto(
  decodedToken: DecodedIdToken,
  groupId: string,
  memberUid: string
): Promise<GroupChatMemberProfilePhoto> {
  const context = await getGroupChatContext(decodedToken, groupId);
  const safeMemberUid = memberUid.trim();

  if (!safeMemberUid || !context.memberIds.includes(safeMemberUid)) {
    throw notFoundError('Profile photo not found.');
  }

  const memberSnapshot = await firestore
    .collection('organizations')
    .doc(context.tenantId)
    .collection('users')
    .doc(safeMemberUid)
    .get();

  if (!memberSnapshot.exists) {
    throw notFoundError('Profile photo not found.');
  }

  const member = memberSnapshot.data() as TenantUserRecord;

  if (
    member.tenantId !== context.tenantId ||
    member.status !== 'ACTIVE' ||
    !member.profilePhotoStoragePath
  ) {
    throw notFoundError('Profile photo not found.');
  }

  const file = storageBucket.file(member.profilePhotoStoragePath);

  try {
    const [exists] = await file.exists();

    if (!exists) {
      throw notFoundError('Profile photo not found.');
    }
  } catch (error) {
    if (isMissingStorageBucketError(error)) {
      throw notFoundError('Profile photo storage is not ready yet.');
    }

    throw error;
  }

  return {
    cacheKey: buildGroupMemberProfilePhotoCacheKey(context.groupId, safeMemberUid, member.profilePhotoVersion),
    contentType: member.profilePhotoContentType || 'image/jpeg',
    file
  };
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
    uid: decodedToken.uid,
    user
  };
}

async function getGroupChatContext(decodedToken: DecodedIdToken, groupId: string): Promise<GroupChatContext> {
  const context = await getActiveUserContext(decodedToken);
  const safeGroupId = normalizeGroupId(groupId);

  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const groupRef = organizationRef.collection('groups').doc(safeGroupId);
  const groupSnapshot = await groupRef.get();

  if (!groupSnapshot.exists) {
    throw notFoundError('Group chat was not found.');
  }

  const group = groupSnapshot.data() as TenantGroupRecord;

  if (group.tenantId !== context.tenantId || group.status !== 'ACTIVE' || !isChatEnabledGroup(group)) {
    throw notFoundError('Group chat was not found.');
  }

  const memberIds = await getActiveGroupMemberIds(context.tenantId, groupRef, group);

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

function normalizeGroupId(groupId: string): string {
  const safeGroupId = groupId.trim();

  if (!safeGroupId || !/^group_[A-Za-z0-9_-]{8,160}$/.test(safeGroupId)) {
    throw notFoundError('Group chat was not found.');
  }

  return safeGroupId;
}

async function getVisibleGroupAddMember(
  context: Awaited<ReturnType<typeof getActiveUserContext>>,
  memberUid: string
): Promise<TenantUserRecord> {
  const safeMemberUid = memberUid.trim();

  if (!safeMemberUid || safeMemberUid === context.uid) {
    throw validationError('Select a contact to add.');
  }

  const memberSnapshot = await firestore
    .collection('organizations')
    .doc(context.tenantId)
    .collection('users')
    .doc(safeMemberUid)
    .get();

  if (!memberSnapshot.exists) {
    throw validationError('This contact is not available to add to groups.');
  }

  const member = memberSnapshot.data() as TenantUserRecord;
  const visibleRoles = getVisibleChatContactRoles(context.role);

  if (
    member.tenantId !== context.tenantId ||
    member.status !== 'ACTIVE' ||
    !member.role ||
    !visibleRoles.includes(member.role)
  ) {
    throw validationError('This contact is not available to add to groups.');
  }

  return {
    ...member,
    uid: safeMemberUid
  };
}

function canAddMemberToGroup(
  context: Awaited<ReturnType<typeof getActiveUserContext>>,
  group: TenantGroupRecord,
  memberIds: string[]
): boolean {
  if (memberIds.includes(context.uid)) {
    return true;
  }

  if (context.role !== 'ORG_ADMIN') {
    return false;
  }

  if (
    group.isDepartmentDefault === true &&
    group.memberPolicy === 'DEPARTMENT_PLUS_EXPLICIT'
  ) {
    return true;
  }

  return group.createdBy === context.uid;
}

function canCurrentUserExitGroupChat(group: TenantGroupRecord): boolean {
  return group.isDepartmentDefault !== true &&
    group.systemManaged !== true &&
    group.memberPolicy !== 'DEPARTMENT_PLUS_EXPLICIT';
}

function mapGroupChatAddableGroup(
  tenantId: string,
  groupId: string,
  group: TenantGroupRecord,
  memberCount: number
): GroupChatAddableGroup {
  return {
    autoMembershipDepartmentId: group.autoMembershipDepartmentId || null,
    departmentId: group.departmentId || null,
    departmentName: group.departmentName || null,
    description: group.description || null,
    groupId: group.groupId || groupId,
    isDepartmentDefault: group.isDepartmentDefault === true,
    memberCount,
    memberPolicy: group.memberPolicy === 'DEPARTMENT_PLUS_EXPLICIT'
      ? 'DEPARTMENT_PLUS_EXPLICIT'
      : 'EXPLICIT',
    name: group.name || 'Group chat',
    scope: group.scope === 'DEPARTMENT' ? 'DEPARTMENT' : 'COMPANY',
    status: group.status || 'ACTIVE',
    systemManaged: group.systemManaged === true,
    tenantId
  };
}

async function ensureDepartmentSystemGroupsForUser(context: Awaited<ReturnType<typeof getActiveUserContext>>): Promise<void> {
  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const departmentSnapshots = context.role === 'ORG_ADMIN'
    ? (await organizationRef.collection('departments').where('status', '==', 'ACTIVE').get()).docs
    : context.user.departmentId
      ? await firestore.getAll(organizationRef.collection('departments').doc(context.user.departmentId))
      : [];
  const activeDepartments = departmentSnapshots
    .filter((doc) => doc.exists)
    .map((doc) => doc.data() as TenantDepartmentRecord)
    .filter((department) => (
      department.tenantId === context.tenantId &&
      department.status === 'ACTIVE' &&
      Boolean(department.departmentId && department.name)
    ));

  if (!activeDepartments.length) {
    return;
  }

  const groupRefs = activeDepartments.map((department) =>
    organizationRef
      .collection('groups')
      .doc(buildDepartmentSystemGroupId(department.departmentId || ''))
  );
  const groupSnapshots = await Promise.all(groupRefs.map((groupRef) => groupRef.get()));
  const missingGroups = groupSnapshots
    .map((snapshot, index) => ({
      department: activeDepartments[index],
      ref: groupRefs[index],
      snapshot
    }))
    .filter(({ snapshot }) => !snapshot.exists);

  for (let index = 0; index < missingGroups.length; index += 450) {
    const batch = firestore.batch();
    const batchGroups = missingGroups.slice(index, index + 450);

    batchGroups.forEach(({ department, ref }) => {
      batch.set(ref, buildDepartmentSystemGroupRecord({
        createdBy: context.uid,
        departmentId: department.departmentId || '',
        departmentName: department.name || 'Department',
        description: department.description || null,
        tenantId: context.tenantId
      }));
    });

    await batch.commit();
  }
}

function isChatEnabledGroup(group: TenantGroupRecord): boolean {
  return group.chatType === 'GROUP_CHAT' || group.memberPolicy === 'EXPLICIT' || group.memberPolicy === 'DEPARTMENT_PLUS_EXPLICIT';
}

async function getActiveGroupMemberIds(
  tenantId: string,
  groupRef: DocumentReference,
  group: TenantGroupRecord
): Promise<string[]> {
  const explicitMembersSnapshot = await groupRef
    .collection('members')
    .get();
  const memberIds = new Set<string>();

  explicitMembersSnapshot.docs.forEach((doc) => {
    const member = doc.data() as GroupMemberRecord;
    const uid = member.uid || doc.id;
    const isActiveMember = !member.status || member.status === 'ACTIVE';
    const isSameTenant = !member.tenantId || member.tenantId === tenantId;

    if (uid && isActiveMember && isSameTenant) {
      memberIds.add(uid);
    }
  });

  if (
    group.memberPolicy === 'DEPARTMENT_PLUS_EXPLICIT' &&
    group.autoMembershipDepartmentId
  ) {
    const departmentUsersSnapshot = await firestore
      .collection('organizations')
      .doc(tenantId)
      .collection('users')
      .where('status', '==', 'ACTIVE')
      .where('departmentId', '==', group.autoMembershipDepartmentId)
      .get();

    departmentUsersSnapshot.docs.forEach((doc) => {
      const user = doc.data() as TenantUserRecord;

      if (user.tenantId === tenantId && user.role) {
        memberIds.add(doc.id);
      }
    });
  }

  return [...memberIds].sort();
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

async function getHiddenGroupMessageIds(
  groupRef: DocumentReference,
  tenantId: string,
  uid: string
): Promise<Set<string>> {
  const snapshot = await groupRef
    .collection('memberMessageVisibility')
    .doc(uid)
    .collection('hiddenMessages')
    .limit(GROUP_HIDDEN_MESSAGE_LIMIT)
    .get();
  const hiddenMessageIds = new Set<string>();

  snapshot.docs.forEach((doc) => {
    const record = doc.data() as GroupHiddenMessageRecord;
    const messageId = record.messageId || doc.id;

    if (record.tenantId === tenantId && record.uid === uid && messageId) {
      hiddenMessageIds.add(messageId);
    }
  });

  return hiddenMessageIds;
}

function normalizeGroupMessageId(messageId: string): string {
  const safeMessageId = messageId.trim();

  if (!safeMessageId || !/^[A-Za-z0-9_-]{8,160}$/.test(safeMessageId)) {
    throw notFoundError('Message was not found.');
  }

  return safeMessageId;
}

async function buildHydratedGroupChatContact(
  currentUid: string,
  tenantId: string,
  groupId: string,
  group: TenantGroupRecord,
  memberIds: string[],
  activeRecipientDeviceCount: number
): Promise<GroupChatContact> {
  const members = await listGroupChatMemberProfiles(tenantId, groupId, memberIds);

  return buildGroupChatContact(
    currentUid,
    groupId,
    group,
    memberIds,
    members,
    activeRecipientDeviceCount
  );
}

async function listGroupChatMemberProfiles(
  tenantId: string,
  groupId: string,
  memberIds: string[]
): Promise<GroupChatMember[]> {
  if (!memberIds.length) {
    return [];
  }

  const snapshots = await firestore.getAll(...memberIds.map((memberId) =>
    firestore
      .collection('organizations')
      .doc(tenantId)
      .collection('users')
      .doc(memberId)
  ));

  return snapshots
    .map((snapshot) => {
      if (!snapshot.exists) {
        return null;
      }

      const user = snapshot.data() as TenantUserRecord;

      if (user.tenantId !== tenantId || user.status !== 'ACTIVE' || !user.role) {
        return null;
      }

      return buildGroupChatMember(groupId, snapshot.id, user);
    })
    .filter((member): member is GroupChatMember => Boolean(member))
    .sort((first, second) => first.displayName.localeCompare(second.displayName));
}

function buildGroupChatMember(groupId: string, uid: string, user: TenantUserRecord): GroupChatMember {
  const displayName = getDisplayName(user);
  const role = user.role || 'EMPLOYEE';

  return {
    displayName,
    initials: getInitials(displayName),
    profilePhotoCacheKey: user.profilePhotoStoragePath
      ? buildGroupMemberProfilePhotoCacheKey(groupId, uid, user.profilePhotoVersion)
      : null,
    profilePhotoUrl: getGroupMemberProfilePhotoUrl(groupId, uid, user.profilePhotoStoragePath, user.profilePhotoVersion),
    role,
    roleName: user.roleName || formatRoleName(role),
    uid
  };
}

function buildGroupChatContact(
  currentUid: string,
  groupId: string,
  group: TenantGroupRecord,
  memberIds: string[],
  members: GroupChatMember[],
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
    isDepartmentDefault: group.isDepartmentDefault === true,
    isOnline: false,
    lastMessageAt: lastMessageSentAtMs ? new Date(lastMessageSentAtMs).toISOString() : null,
    lastSeenAt: null,
    memberCount: memberIds.length,
    members,
    memberPolicy: group.memberPolicy || 'EXPLICIT',
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

function cloneGroupChatMessageReactionRecord(
  reactions?: GroupChatMessageReactionRecord
): GroupChatMessageReactionRecord {
  const cloned: GroupChatMessageReactionRecord = {};

  Object.entries(reactions || {}).forEach(([messageId, reactionsByUid]) => {
    const safeReactionsByUid: Record<string, GroupChatReactionRecord[]> = {};

    Object.entries(reactionsByUid || {}).forEach(([uid, reaction]) => {
      const userReactions = normalizeGroupChatUserReactions(reaction, uid);

      if (uid && userReactions.length) {
        safeReactionsByUid[uid] = userReactions;
      }
    });

    if (Object.keys(safeReactionsByUid).length) {
      cloned[messageId] = safeReactionsByUid;
    }
  });

  return cloned;
}

function normalizeGroupChatUserReactions(
  reaction: GroupChatUserReactionRecord | undefined,
  fallbackUid?: string
): GroupChatReactionRecord[] {
  const reactions = Array.isArray(reaction)
    ? reaction
    : reaction
      ? [reaction]
      : [];
  const dedupedReactions: GroupChatReactionRecord[] = [];
  const seenEmojis = new Set<string>();

  reactions.forEach((userReaction) => {
    const emoji = typeof userReaction?.emoji === 'string' ? userReaction.emoji.trim() : '';

    if (!emoji || seenEmojis.has(emoji)) {
      return;
    }

    seenEmojis.add(emoji);
    dedupedReactions.push({
      emoji,
      reactedAtMs: typeof userReaction.reactedAtMs === 'number' ? userReaction.reactedAtMs : Date.now(),
      uid: userReaction.uid || fallbackUid
    });
  });

  return dedupedReactions
    .sort((first, second) => (first.reactedAtMs || 0) - (second.reactedAtMs || 0))
    .slice(-12);
}

function mapGroupChatMessageReactions(group?: TenantGroupRecord | null): ChatMessageReactionMap {
  const reactionMap: ChatMessageReactionMap = {};

  Object.entries(group?.messageReactions || {}).forEach(([messageId, reactionsByUid]) => {
    const reactions = Object.entries(reactionsByUid || {})
      .flatMap(([uid, reaction]) =>
        normalizeGroupChatUserReactions(reaction, uid).map((userReaction) => ({
          emoji: userReaction.emoji || '',
          reactedAt: new Date(userReaction.reactedAtMs || Date.now()).toISOString(),
          uid: userReaction.uid || uid
        }))
      )
      .filter((reaction): reaction is ChatMessageReaction => Boolean(reaction.emoji && reaction.uid))
      .sort((first, second) => first.reactedAt.localeCompare(second.reactedAt));

    if (reactions.length) {
      reactionMap[messageId] = reactions;
    }
  });

  return reactionMap;
}

function mapEncryptedGroupEnvelopeForDevice(
  currentUid: string,
  deviceId: string,
  fallbackId: string,
  record: EncryptedGroupEnvelopeRecord,
  encryptedKeyForDevice: string,
  historyKeyRecipientDevices?: EncryptionDevicePublicKey[]
): EncryptedGroupEnvelopeForDevice {
  const sentAtMs = record.sentAtMs || Date.now();

  return {
    algorithm: record.algorithm || 'unknown',
    ciphertext: record.ciphertext || '',
    clientMessageId: record.clientMessageId || fallbackId,
    deliveryStatus: getEnvelopeDeliveryStatus(currentUid, record),
    encryptedKeyForDevice,
    envelopeId: record.envelopeId || fallbackId,
    ...(historyKeyRecipientDevices?.length ? { historyKeyRecipientDevices } : {}),
    keyVersion: record.keyVersion || 1,
    nonce: record.nonce || '',
    senderDeviceId: record.senderDeviceId || '',
    senderKeyAgreementPublicKey: record.senderKeyAgreementPublicKey || '',
    senderUid: record.senderUid || '',
    sentAt: new Date(sentAtMs).toISOString()
  };
}

function getMissingHistoryKeyRecipientDevices(
  record: EncryptedGroupEnvelopeRecord,
  activeGroupDevicesById: Map<string, DeviceKeyRecord>,
  currentDeviceId: string
): EncryptionDevicePublicKey[] {
  const encryptedKeysByDevice = record.encryptedKeysByDevice || {};

  return [...activeGroupDevicesById.values()]
    .filter((device) => {
      const deviceId = device.deviceId || '';

      return Boolean(
        deviceId &&
        deviceId !== currentDeviceId &&
        !encryptedKeysByDevice[deviceId] &&
        device.keyAgreementPublicKey
      );
    })
    .slice(0, GROUP_HISTORY_KEY_GRANT_DEVICE_LIMIT)
    .map(mapDevicePublicKey);
}

function normalizeGroupHistoryKeyGrant(
  grant: GroupHistoryKeyGrantInput
): GroupHistoryKeyGrantInput | null {
  const envelopeId = normalizeOptionalGroupMessageId(grant.envelopeId);

  if (!envelopeId) {
    return null;
  }

  const encryptedKeysByDevice = Object.fromEntries(
    Object.entries(grant.encryptedKeysByDevice || {})
      .filter(([deviceId, encryptedKey]) => (
        isSafeDeviceId(deviceId) &&
        isEncryptedGroupHistoryKeyGrantPayload(encryptedKey)
      ))
      .slice(0, GROUP_HISTORY_KEY_GRANT_DEVICE_LIMIT)
  );

  if (!Object.keys(encryptedKeysByDevice).length) {
    return null;
  }

  return {
    encryptedKeysByDevice,
    envelopeId
  };
}

export function isEncryptedGroupHistoryKeyGrantPayload(value: string): boolean {
  try {
    const payload = JSON.parse(value) as Partial<{
      ciphertext: unknown;
      nonce: unknown;
      version: unknown;
    }>;

    return (
      payload.version === 1 &&
      typeof payload.ciphertext === 'string' &&
      payload.ciphertext.trim().length >= 16 &&
      typeof payload.nonce === 'string' &&
      payload.nonce.trim().length >= 8
    );
  } catch {
    return false;
  }
}

function normalizeOptionalGroupMessageId(messageId: string): string | null {
  const safeMessageId = messageId.trim();

  return /^[A-Za-z0-9_-]{8,160}$/.test(safeMessageId) ? safeMessageId : null;
}

function isSafeDeviceId(deviceId: string): boolean {
  return /^[A-Za-z0-9_-]{16,128}$/.test(deviceId.trim());
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

function getDisplayName(user: TenantUserRecord): string {
  const displayName = user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim();

  return displayName || 'Synzapp user';
}

function formatRoleName(role: SynzappRole): string {
  if (role === 'ORG_ADMIN') {
    return 'Organization Admin';
  }

  if (role === 'DEPT_ADMIN') {
    return 'Department Admin';
  }

  if (role === 'SYSTEM_ADMIN') {
    return 'System Admin';
  }

  return 'Employee';
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'G';
}

function buildGroupMemberProfilePhotoCacheKey(
  groupId: string,
  uid: string,
  version?: number | null
): string {
  return `group-member-photo-${groupId}-${uid}-${version || 1}`;
}

function getGroupMemberProfilePhotoUrl(
  groupId: string,
  uid: string,
  storagePath?: string | null,
  version?: number | null
): string | null {
  if (!storagePath) {
    return null;
  }

  return `/api/profile/chat/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(uid)}/photo?v=${encodeURIComponent(String(version || 1))}`;
}

function isMissingStorageBucketError(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? (error as { code?: number | string }).code
    : undefined;
  const message = getErrorMessage(error);

  return (
    code === 404 ||
    code === '404' ||
    message.includes('bucket does not exist') ||
    message.includes('could not load the default credentials')
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
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
