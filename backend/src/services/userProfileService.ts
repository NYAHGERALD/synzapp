import { createHash } from 'node:crypto';
import { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth, fieldValue, firestore, storageBucket } from '../config/firebaseAdmin.js';
import { SynzappRole } from '../types/auth.js';
import { formatPhoneNumber, maskPhoneNumber, normalizeE164Phone } from '../utils/phone.js';
import { hashPhoneNumber } from '../utils/phoneHash.js';
import { buildAuthSession } from './authSessionService.js';
import { buildDepartmentSystemGroupId, buildDepartmentSystemGroupRecord } from './groupService.js';
import {
  buildChatPreferenceKey,
  ChatUserPreference,
  type ChatTrashSegment,
  getChatUserPreference,
  getDefaultChatUserPreference,
  listChatUserPreferences,
  updateChatUserPreference,
  type UpdateChatUserPreferenceInput
} from './chatUserPreferenceService.js';
import {
  ChatArchiveSettings,
  getChatArchiveSettings,
  shouldTreatChatAsArchived
} from './chatArchiveSettingsService.js';
import { getChatPresenceForUser } from './chatPresenceService.js';
import { mergePermissions } from './permissionCatalog.js';
import {
  buildHumanResourcesDepartmentRecord,
  HUMAN_RESOURCES_DEPARTMENT_ID,
  HUMAN_RESOURCES_DEPARTMENT_NAME
} from './tenantDefaults.js';

interface OrganizationRecord {
  companyName?: string;
  createdBy?: string;
  orgAdminName?: string;
  status?: string;
}

interface TenantUserRecord {
  departmentAdminPermissions?: string[];
  departmentId?: string | null;
  departmentName?: string | null;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  permissions?: string[];
  phoneHash?: string;
  phoneMasked?: string;
  profilePhotoContentType?: string | null;
  profilePhotoStoragePath?: string | null;
  profilePhotoVersion?: number | null;
  role?: SynzappRole;
  roleName?: string;
  status?: string;
  tenantId?: string;
}

interface TenantApprovedPhoneRecord {
  claimedByUid?: string | null;
  departmentAdminPermissions?: string[];
  departmentId?: string | null;
  employeeUid?: string | null;
  permissions?: string[];
  role?: SynzappRole;
  status?: string;
  tenantId?: string;
}

interface UploadedProfilePhoto {
  contentType: string;
  storagePath: string;
}

export interface ChatContact {
  clearedAt: string | null;
  contactId: string;
  conversationId: string;
  displayName: string;
  hasActiveDevice: boolean;
  initials: string;
  isArchived: boolean;
  isFavorite: boolean;
  isPinned: boolean;
  isSpam: boolean;
  isOnline: boolean;
  lastMessageAt: string | null;
  lastSeenAt: string | null;
  phoneFormatted: string | null;
  phoneMasked: string | null;
  preview: string;
  profilePhotoCacheKey: string | null;
  profilePhotoUrl: string | null;
  role: SynzappRole;
  roleName: string;
  spammedAt: string | null;
  status: string;
  trashSegments: Array<ChatTrashSegment & {
    deletedAt: string;
    expiresAt: string;
  }>;
  unreadCount: number;
}

export interface DirectChatContactDetails {
  companyName: string;
  contactId: string;
  departmentAdminName: string | null;
  departmentName: string | null;
  displayName: string;
  organizationAdminName: string | null;
  phoneFormatted: string;
  profilePhotoCacheKey: string | null;
  profilePhotoUrl: string | null;
  role: SynzappRole;
  roleName: string;
  status: string;
}

export interface CurrentUserProfile {
  companyName: string;
  departmentId: string | null;
  departmentName: string | null;
  displayName: string;
  isTenantOwner: boolean;
  phoneFormatted: string;
  phoneMasked: string;
  permissions: string[];
  profilePhotoCacheKey: string | null;
  profilePhotoUrl: string | null;
  role: SynzappRole;
  roleName: string;
  status: string;
  tenantId: string;
  uid: string;
}

interface CurrentUserProfilePhoto {
  cacheKey: string;
  contentType: string;
  file: ReturnType<typeof storageBucket.file>;
}

type StorageSaveOptions = NonNullable<Parameters<ReturnType<typeof storageBucket.file>['save']>[1]>;

export interface DirectChatRecord {
  lastMessageId?: string | null;
  lastMessageSenderUid?: string | null;
  lastMessageSentAtMs?: number | null;
  lastMessageText?: string | null;
  messageReactions?: DirectChatMessageReactionRecord;
  participantIds?: string[];
  unreadCounts?: Record<string, number>;
}

interface DirectChatReactionRecord {
  emoji?: string;
  reactedAtMs?: number;
  uid?: string;
}

type DirectChatUserReactionRecord = DirectChatReactionRecord | DirectChatReactionRecord[];
type DirectChatMessageReactionRecord = Record<string, Record<string, DirectChatUserReactionRecord>>;

interface DirectChatMessageMetadataRecord {
  envelopeId?: string;
  participantIds?: string[];
  recipientUid?: string;
  senderUid?: string;
  status?: string;
  tenantId?: string;
}

export interface ChatMessageReaction {
  emoji: string;
  reactedAt: string;
  uid: string;
}

export type ChatMessageReactionMap = Record<string, ChatMessageReaction[]>;

const PROFILE_PHOTO_STORAGE_SAVE_MAX_ATTEMPTS = 3;
const PROFILE_PHOTO_STORAGE_SAVE_RETRY_BASE_MS = 350;

export async function getCurrentUserProfile(decodedToken: DecodedIdToken): Promise<CurrentUserProfile> {
  const context = await getCurrentUserContext(decodedToken);

  return buildCurrentUserProfile(decodedToken, context);
}

export async function listCurrentUserChatContacts(decodedToken: DecodedIdToken): Promise<ChatContact[]> {
  const context = await getCurrentUserContext(decodedToken);
  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const usersSnapshot = await firestore
    .collection('organizations')
    .doc(context.tenantId)
    .collection('users')
    .where('status', '==', 'ACTIVE')
    .get();

  const visibleRoles = getVisibleChatContactRoles(context.role);
  const [preferences, archiveSettings] = await Promise.all([
    listChatUserPreferences(context.tenantId, decodedToken.uid),
    getChatArchiveSettings(context.tenantId, decodedToken.uid)
  ]);

  const visibleContacts = usersSnapshot.docs
    .filter((doc) => {
      const user = doc.data() as TenantUserRecord;

      return doc.id !== decodedToken.uid && Boolean(user.role && visibleRoles.includes(user.role));
    });
  const contactIds = visibleContacts.map((doc) => doc.id);
  const [activeDeviceUserIds, formattedPhoneByUid] = await Promise.all([
    getActiveDeviceUserIds(context.tenantId),
    getAuthPhoneFormattedByUid(contactIds)
  ]);
  const contacts = await Promise.all(visibleContacts.map(async (doc) => {
    const chatId = buildDirectChatId(decodedToken.uid, doc.id);
    const chatSnapshot = await organizationRef.collection('directChats').doc(chatId).get();
    const directChat = chatSnapshot.exists ? (chatSnapshot.data() as DirectChatRecord) : null;

    return buildChatContact(
      decodedToken.uid,
      doc.id,
      doc.data() as TenantUserRecord,
      directChat,
      activeDeviceUserIds.has(doc.id),
      preferences.get(buildChatPreferenceKey('DIRECT', doc.id)),
      archiveSettings,
      formattedPhoneByUid.get(doc.id) || null
    );
  }));

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

export async function markDirectChatRead(
  decodedToken: DecodedIdToken,
  contactId: string
): Promise<ChatContact> {
  const chatContext = await getDirectChatContext(decodedToken, contactId);
  const [hasActiveDevice, preference, archiveSettings] = await Promise.all([
    hasActiveDeviceForUser(chatContext.tenantId, chatContext.contactId),
    getChatUserPreference(chatContext.tenantId, decodedToken.uid, 'DIRECT', chatContext.contactId),
    getChatArchiveSettings(chatContext.tenantId, decodedToken.uid)
  ]);

  await chatContext.chatRef.set({
    lastReadAtByUser: {
      [decodedToken.uid]: fieldValue.serverTimestamp()
    },
    unreadCounts: {
      [decodedToken.uid]: 0
    },
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });

  return buildChatContact(decodedToken.uid, chatContext.contactId, chatContext.contact, {
    ...(chatContext.directChat || {}),
    unreadCounts: {
      ...(chatContext.directChat?.unreadCounts || {}),
      [decodedToken.uid]: 0
    }
  }, hasActiveDevice, preference, archiveSettings);
}

export async function getDirectChatContact(
  decodedToken: DecodedIdToken,
  contactId: string,
  directChat?: DirectChatRecord | null
): Promise<ChatContact> {
  const chatContext = await getDirectChatContext(decodedToken, contactId);
  const [hasActiveDevice, preference, archiveSettings] = await Promise.all([
    hasActiveDeviceForUser(chatContext.tenantId, chatContext.contactId),
    getChatUserPreference(chatContext.tenantId, decodedToken.uid, 'DIRECT', chatContext.contactId),
    getChatArchiveSettings(chatContext.tenantId, decodedToken.uid)
  ]);

  return buildChatContact(
    decodedToken.uid,
    chatContext.contactId,
    chatContext.contact,
    directChat === undefined ? chatContext.directChat : directChat,
    hasActiveDevice,
    preference,
    archiveSettings
  );
}

export async function updateDirectChatPreferenceForCurrentUser(
  decodedToken: DecodedIdToken,
  contactId: string,
  input: UpdateChatUserPreferenceInput
): Promise<ChatContact> {
  const chatContext = await getDirectChatContext(decodedToken, contactId);
  const preference = await updateChatUserPreference(
    chatContext.tenantId,
    decodedToken.uid,
    'DIRECT',
    chatContext.contactId,
    {
      ...input,
      trashSegmentEndAtMs: input.isSpam === true
        ? chatContext.directChat?.lastMessageSentAtMs || Date.now()
        : input.trashSegmentEndAtMs
    }
  );
  const [hasActiveDevice, archiveSettings] = await Promise.all([
    hasActiveDeviceForUser(chatContext.tenantId, chatContext.contactId),
    getChatArchiveSettings(chatContext.tenantId, decodedToken.uid)
  ]);
  const shouldResetUnread = input.clear === true || input.permanentDelete === true || input.isSpam === true;
  const directChat = shouldResetUnread
    ? {
        ...(chatContext.directChat || {}),
        unreadCounts: {
          ...(chatContext.directChat?.unreadCounts || {}),
          [decodedToken.uid]: 0
        }
      }
    : chatContext.directChat;

  if (shouldResetUnread) {
    await chatContext.chatRef.set({
      lastReadAtByUser: {
        [decodedToken.uid]: fieldValue.serverTimestamp()
      },
      unreadCounts: {
        [decodedToken.uid]: 0
      },
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });
  }

  return buildChatContact(
    decodedToken.uid,
    chatContext.contactId,
    chatContext.contact,
    directChat,
    hasActiveDevice,
    preference,
    archiveSettings
  );
}

export async function getDirectChatContactDetails(
  decodedToken: DecodedIdToken,
  contactId: string
): Promise<DirectChatContactDetails> {
  const chatContext = await getDirectChatContext(decodedToken, contactId);
  const organizationRef = firestore.collection('organizations').doc(chatContext.tenantId);
  const organizationSnapshot = await organizationRef.get();
  const organization = organizationSnapshot.exists
    ? organizationSnapshot.data() as OrganizationRecord
    : {};
  const [authUser, departmentAdminName] = await Promise.all([
    adminAuth.getUser(chatContext.contactId).catch(() => null),
    getDepartmentAdminName(organizationRef, chatContext.contact)
  ]);
  const normalizedPhone = authUser?.phoneNumber ? normalizeE164Phone(authUser.phoneNumber) : '';
  const displayName = getDisplayName(chatContext.contact);

  return {
    companyName: organization.companyName || 'Your organization',
    contactId: chatContext.contactId,
    departmentAdminName,
    departmentName: chatContext.contact.departmentName || null,
    displayName,
    organizationAdminName: organization.orgAdminName || null,
    phoneFormatted: normalizedPhone
      ? formatPhoneNumber(normalizedPhone)
      : chatContext.contact.phoneMasked || '*****',
    profilePhotoCacheKey: chatContext.contact.profilePhotoStoragePath
      ? buildProfilePhotoCacheKey(chatContext.contactId, chatContext.contact.profilePhotoVersion)
      : null,
    profilePhotoUrl: getChatContactProfilePhotoUrl(
      chatContext.contactId,
      chatContext.contact.profilePhotoStoragePath,
      chatContext.contact.profilePhotoVersion
    ),
    role: chatContext.contact.role || 'EMPLOYEE',
    roleName: formatProfileRoleName(chatContext.contact.roleName, chatContext.contact.role || 'EMPLOYEE'),
    status: chatContext.contact.status || 'ACTIVE'
  };
}

export async function getDirectChatRealtimeContext(
  decodedToken: DecodedIdToken,
  contactId: string
) {
  const chatContext = await getDirectChatContext(decodedToken, contactId);

  return {
    chatId: chatContext.chatId,
    chatRef: chatContext.chatRef,
    contactId: chatContext.contactId,
    tenantId: chatContext.tenantId
  };
}

export async function getDirectChatMessageReactions(
  decodedToken: DecodedIdToken,
  contactId: string
): Promise<ChatMessageReactionMap> {
  const chatContext = await getDirectChatContext(decodedToken, contactId);

  return mapDirectChatMessageReactions(chatContext.directChat);
}

export async function updateDirectChatMessageReaction(
  decodedToken: DecodedIdToken,
  contactId: string,
  messageId: string,
  emoji: string
): Promise<{ contact: ChatContact; messageReactions: ChatMessageReactionMap }> {
  const chatContext = await getDirectChatContext(decodedToken, contactId);
  const safeMessageId = messageId.trim();
  const safeEmoji = emoji.trim();

  if (!safeMessageId || !/^[A-Za-z0-9_-]{8,160}$/.test(safeMessageId)) {
    throw notFoundError('Message was not found.');
  }

  if (safeEmoji.length > 16) {
    throw validationError('Reaction is not valid.');
  }

  const messageEnvelopeRef = chatContext.chatRef.collection('encryptedEnvelopes').doc(safeMessageId);
  const messageMetadataRef = chatContext.chatRef.collection('messageMetadata').doc(safeMessageId);
  let nextDirectChat: DirectChatRecord | null = null;

  await firestore.runTransaction(async (transaction) => {
    const [chatSnapshot, messageMetadataSnapshot, messageEnvelopeSnapshot] = await Promise.all([
      transaction.get(chatContext.chatRef),
      transaction.get(messageMetadataRef),
      transaction.get(messageEnvelopeRef)
    ]);

    if (messageMetadataSnapshot.exists) {
      const messageMetadata = messageMetadataSnapshot.data() as DirectChatMessageMetadataRecord;

      if (
        messageMetadata.tenantId !== chatContext.tenantId ||
        (
          Array.isArray(messageMetadata.participantIds) &&
          !messageMetadata.participantIds.includes(decodedToken.uid)
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
        ? messageEnvelopeSnapshot.data() as {
            recipientUid?: string;
            senderUid?: string;
            sentAtMs?: number;
          }
        : null;

      transaction.set(messageMetadataRef, {
        createdAt: fieldValue.serverTimestamp(),
        envelopeId: safeMessageId,
        legacyLocalHistoryIndexedAt: messageEnvelopeSnapshot.exists
          ? null
          : fieldValue.serverTimestamp(),
        participantIds: [decodedToken.uid, chatContext.contactId].sort(),
        recipientUid: messageEnvelope?.recipientUid || null,
        senderUid: messageEnvelope?.senderUid || null,
        sentAtMs: messageEnvelope?.sentAtMs || null,
        status: 'ACTIVE',
        tenantId: chatContext.tenantId,
        updatedAt: fieldValue.serverTimestamp()
      }, { merge: true });
    }

    const directChat = chatSnapshot.exists ? (chatSnapshot.data() as DirectChatRecord) : {};
    const messageReactions = cloneDirectChatMessageReactionRecord(directChat.messageReactions);
    const reactionsForMessage = {
      ...(messageReactions[safeMessageId] || {})
    };

    if (safeEmoji) {
      const existingUserReactions = normalizeDirectChatUserReactions(
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

    nextDirectChat = {
      ...directChat,
      messageReactions
    };

    transaction.set(chatContext.chatRef, {
      messageReactions,
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });
  });

  const [hasActiveDevice, preference, archiveSettings] = await Promise.all([
    hasActiveDeviceForUser(chatContext.tenantId, chatContext.contactId),
    getChatUserPreference(chatContext.tenantId, decodedToken.uid, 'DIRECT', chatContext.contactId),
    getChatArchiveSettings(chatContext.tenantId, decodedToken.uid)
  ]);

  return {
    contact: buildChatContact(
      decodedToken.uid,
      chatContext.contactId,
      chatContext.contact,
      nextDirectChat || chatContext.directChat,
      hasActiveDevice,
      preference,
      archiveSettings
    ),
    messageReactions: mapDirectChatMessageReactions(nextDirectChat || chatContext.directChat)
  };
}


export async function getCurrentUserProfilePhoto(
  decodedToken: DecodedIdToken
): Promise<CurrentUserProfilePhoto> {
  const context = await getCurrentUserContext(decodedToken);
  const storagePath = context.user.profilePhotoStoragePath;

  if (!storagePath) {
    throw notFoundError('Profile photo not found.');
  }

  const file = storageBucket.file(storagePath);

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
    cacheKey: buildProfilePhotoCacheKey(decodedToken.uid, context.user.profilePhotoVersion),
    contentType: context.user.profilePhotoContentType || 'image/jpeg',
    file
  };
}

export async function getChatContactProfilePhoto(
  decodedToken: DecodedIdToken,
  contactId: string
): Promise<CurrentUserProfilePhoto> {
  const context = await getCurrentUserContext(decodedToken);
  const safeContactId = contactId.trim();

  if (!safeContactId) {
    throw notFoundError('Profile photo not found.');
  }

  const userSnapshot = await firestore
    .collection('organizations')
    .doc(context.tenantId)
    .collection('users')
    .doc(safeContactId)
    .get();

  if (!userSnapshot.exists) {
    throw notFoundError('Profile photo not found.');
  }

  const user = userSnapshot.data() as TenantUserRecord;
  const visibleRoles = getVisibleChatContactRoles(context.role);

  if (user.status !== 'ACTIVE' || !user.role || !visibleRoles.includes(user.role) || !user.profilePhotoStoragePath) {
    throw notFoundError('Profile photo not found.');
  }

  const file = storageBucket.file(user.profilePhotoStoragePath);

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
    cacheKey: buildProfilePhotoCacheKey(safeContactId, user.profilePhotoVersion),
    contentType: user.profilePhotoContentType || 'image/jpeg',
    file
  };
}

export async function updateCurrentUserProfilePhoto(
  decodedToken: DecodedIdToken,
  profilePhotoDataUrl: string
): Promise<CurrentUserProfile> {
  const context = await getCurrentUserContext(decodedToken);
  const uploadedPhoto = await uploadProfilePhoto(context.tenantId, decodedToken.uid, profilePhotoDataUrl);
  const profilePhotoVersion = Date.now();
  const userRef = firestore
    .collection('organizations')
    .doc(context.tenantId)
    .collection('users')
    .doc(decodedToken.uid);

  await userRef.set({
    profilePhotoContentType: uploadedPhoto.contentType,
    profilePhotoStoragePath: uploadedPhoto.storagePath,
    profilePhotoVersion,
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });

  await firestore.collection('identityDirectory').doc(decodedToken.uid).set({
    profilePhotoContentType: uploadedPhoto.contentType,
    profilePhotoStoragePath: uploadedPhoto.storagePath,
    profilePhotoVersion,
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });

  if ((context.role === 'EMPLOYEE' || context.role === 'DEPT_ADMIN') && context.user.phoneHash) {
    await firestore
      .collection('organizations')
      .doc(context.tenantId)
      .collection('approvedPhones')
      .doc(context.user.phoneHash)
      .set({
        profilePhotoContentType: uploadedPhoto.contentType,
        profilePhotoStoragePath: uploadedPhoto.storagePath,
        profilePhotoVersion,
        updatedAt: fieldValue.serverTimestamp()
      }, { merge: true });
  }

  const refreshedContext = await getCurrentUserContext(decodedToken);

  return buildCurrentUserProfile(decodedToken, refreshedContext);
}

async function getCurrentUserContext(decodedToken: DecodedIdToken) {
  const session = await buildAuthSession(decodedToken);
  const { role, status, tenantId } = session.user;

  if (session.access !== 'ACTIVE' || status !== 'ACTIVE' || !tenantId || !role) {
    throw authorizationError('Your profile is not active.');
  }

  const organizationRef = firestore.collection('organizations').doc(tenantId);
  const userRef = organizationRef.collection('users').doc(decodedToken.uid);
  const [organizationSnapshot, userSnapshot] = await Promise.all([
    organizationRef.get(),
    userRef.get()
  ]);

  if (!organizationSnapshot.exists || !userSnapshot.exists) {
    throw authorizationError('Your profile is not active.');
  }

  const organization = organizationSnapshot.data() as OrganizationRecord;
  let user = userSnapshot.data() as TenantUserRecord;

  if (organization.status !== 'ACTIVE' || user.status !== 'ACTIVE') {
    throw authorizationError('Your profile is not active.');
  }

  if (user.role === 'ORG_ADMIN' && user.departmentId !== HUMAN_RESOURCES_DEPARTMENT_ID) {
    await ensureOrgAdminHumanResourcesMembership(tenantId, decodedToken.uid);
    user = {
      ...user,
      departmentId: HUMAN_RESOURCES_DEPARTMENT_ID,
      departmentName: HUMAN_RESOURCES_DEPARTMENT_NAME
    };
  }

  let effectiveRole = user.role || role;
  let effectivePermissions = mergePermissions(session.user.permissions || [], user.permissions || []);
  const approvedPhone = await getCurrentUserApprovedPhone(tenantId, decodedToken, user);

  if (approvedPhone?.role && isEmployeeAccessRole(approvedPhone.role)) {
    const approvedPermissions = approvedPhone.permissions || [];
    const approvedDepartmentAdminPermissions = approvedPhone.departmentAdminPermissions || [];
    const nextUser: TenantUserRecord = {
      ...user,
      departmentAdminPermissions: approvedDepartmentAdminPermissions,
      departmentId: approvedPhone.departmentId || user.departmentId || null,
      permissions: approvedPermissions,
      role: approvedPhone.role,
      tenantId
    };

    if (shouldSyncUserAccess(user, nextUser)) {
      const claimsVersion = Date.now();

      await Promise.all([
        userRef.set({
          departmentAdminPermissions: nextUser.departmentAdminPermissions,
          departmentId: nextUser.departmentId || null,
          permissions: nextUser.permissions || [],
          role: nextUser.role,
          roleUpdatedAt: fieldValue.serverTimestamp(),
          updatedAt: fieldValue.serverTimestamp()
        }, { merge: true }),
        firestore.collection('identityDirectory').doc(decodedToken.uid).set({
          claimsVersion,
          departmentAdminPermissions: nextUser.departmentAdminPermissions,
          departmentId: nextUser.departmentId || null,
          permissions: nextUser.permissions || [],
          role: nextUser.role,
          roleUpdatedAt: fieldValue.serverTimestamp(),
          updatedAt: fieldValue.serverTimestamp()
        }, { merge: true }),
        adminAuth.setCustomUserClaims(decodedToken.uid, {
          claimsVersion,
          permissions: nextUser.permissions || [],
          role: nextUser.role,
          status: 'ACTIVE',
          tenantId
        })
      ]);
    }

    user = nextUser;
    effectiveRole = approvedPhone.role;
    effectivePermissions = approvedPermissions;
  }

  return {
    organization,
    permissions: effectivePermissions,
    role: effectiveRole,
    tenantId,
    user
  };
}

async function ensureOrgAdminHumanResourcesMembership(tenantId: string, uid: string): Promise<void> {
  const organizationRef = firestore.collection('organizations').doc(tenantId);
  const departmentRef = organizationRef
    .collection('departments')
    .doc(HUMAN_RESOURCES_DEPARTMENT_ID);
  const groupRef = organizationRef
    .collection('groups')
    .doc(buildDepartmentSystemGroupId(HUMAN_RESOURCES_DEPARTMENT_ID));
  const userRef = organizationRef.collection('users').doc(uid);
  const identityRef = firestore.collection('identityDirectory').doc(uid);

  await firestore.runTransaction(async (transaction) => {
    const [departmentSnapshot, groupSnapshot] = await Promise.all([
      transaction.get(departmentRef),
      transaction.get(groupRef)
    ]);

    if (!departmentSnapshot.exists) {
      transaction.set(departmentRef, {
        ...buildHumanResourcesDepartmentRecord({
          createdBy: uid,
          tenantId
        }),
        createdAt: fieldValue.serverTimestamp(),
        updatedAt: fieldValue.serverTimestamp()
      });
    }

    if (!groupSnapshot.exists) {
      transaction.set(groupRef, buildDepartmentSystemGroupRecord({
        createdBy: uid,
        departmentId: HUMAN_RESOURCES_DEPARTMENT_ID,
        departmentName: HUMAN_RESOURCES_DEPARTMENT_NAME,
        description: 'Default organization administration department group',
        tenantId
      }));
    }

    transaction.set(userRef, {
      departmentId: HUMAN_RESOURCES_DEPARTMENT_ID,
      departmentName: HUMAN_RESOURCES_DEPARTMENT_NAME,
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });

    transaction.set(identityRef, {
      departmentId: HUMAN_RESOURCES_DEPARTMENT_ID,
      updatedAt: fieldValue.serverTimestamp()
    }, { merge: true });
  });
}

async function getCurrentUserApprovedPhone(
  tenantId: string,
  decodedToken: DecodedIdToken,
  user: TenantUserRecord
): Promise<TenantApprovedPhoneRecord | null> {
  if (!decodedToken.phone_number && !user.phoneHash) {
    return null;
  }

  const phoneHash = user.phoneHash || hashPhoneNumber(normalizeE164Phone(decodedToken.phone_number || ''));
  const snapshot = await firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('approvedPhones')
    .doc(phoneHash)
    .get();

  if (!snapshot.exists) {
    return null;
  }

  const approvedPhone = snapshot.data() as TenantApprovedPhoneRecord;
  const linkedUid = approvedPhone.employeeUid || approvedPhone.claimedByUid || null;

  if (
    approvedPhone.tenantId !== tenantId ||
    approvedPhone.status !== 'ACTIVE' ||
    (linkedUid && linkedUid !== decodedToken.uid)
  ) {
    return null;
  }

  return approvedPhone;
}

function shouldSyncUserAccess(currentUser: TenantUserRecord, nextUser: TenantUserRecord): boolean {
  return currentUser.role !== nextUser.role ||
    currentUser.departmentId !== nextUser.departmentId ||
    !areStringArraysEqual(currentUser.permissions || [], nextUser.permissions || []) ||
    !areStringArraysEqual(
      currentUser.departmentAdminPermissions || [],
      nextUser.departmentAdminPermissions || []
    );
}

function areStringArraysEqual(first: string[], second: string[]): boolean {
  const normalizedFirst = [...first].sort();
  const normalizedSecond = [...second].sort();

  return normalizedFirst.length === normalizedSecond.length &&
    normalizedFirst.every((value, index) => value === normalizedSecond[index]);
}

function isEmployeeAccessRole(role: SynzappRole): boolean {
  return role === 'EMPLOYEE' || role === 'DEPT_ADMIN' || role === 'ORG_ADMIN';
}

async function buildCurrentUserProfile(
  decodedToken: DecodedIdToken,
  context: Awaited<ReturnType<typeof getCurrentUserContext>>
): Promise<CurrentUserProfile> {
  const normalizedPhone = decodedToken.phone_number
    ? normalizeE164Phone(decodedToken.phone_number)
    : '';

  return {
    companyName: context.organization.companyName || 'Your organization',
    departmentId: context.user.departmentId || null,
    departmentName: context.user.departmentName || null,
    displayName: getDisplayName(context.user),
    isTenantOwner: context.organization.createdBy === decodedToken.uid,
    phoneFormatted: normalizedPhone ? formatPhoneNumber(normalizedPhone) : context.user.phoneMasked || '*****',
    phoneMasked: context.user.phoneMasked || maskPhoneNumber(normalizedPhone),
    permissions: context.permissions,
    profilePhotoCacheKey: context.user.profilePhotoStoragePath
      ? buildProfilePhotoCacheKey(decodedToken.uid, context.user.profilePhotoVersion)
      : null,
    profilePhotoUrl: getProfilePhotoUrl(context.user.profilePhotoStoragePath, context.user.profilePhotoVersion),
    role: context.role,
    roleName: formatProfileRoleName(context.user.roleName, context.role),
    status: context.user.status || 'ACTIVE',
    tenantId: context.tenantId,
    uid: decodedToken.uid
  };
}

function getProfilePhotoUrl(storagePath?: string | null, version?: number | null): string | null {
  if (!storagePath) {
    return null;
  }

  return `/api/profile/me/photo?v=${encodeURIComponent(String(version || 1))}`;
}

function getChatContactProfilePhotoUrl(
  contactId: string,
  storagePath?: string | null,
  version?: number | null
): string | null {
  if (!storagePath) {
    return null;
  }

  return `/api/profile/chat/contacts/${encodeURIComponent(contactId)}/photo?v=${encodeURIComponent(String(version || 1))}`;
}

function buildProfilePhotoCacheKey(uid: string, version?: number | null): string {
  return `profile-photo-${uid}-${version || 1}`;
}

function cloneDirectChatMessageReactionRecord(
  reactions?: DirectChatMessageReactionRecord
): DirectChatMessageReactionRecord {
  const cloned: DirectChatMessageReactionRecord = {};

  Object.entries(reactions || {}).forEach(([messageId, reactionsByUid]) => {
    const safeReactionsByUid: Record<string, DirectChatReactionRecord[]> = {};

    Object.entries(reactionsByUid || {}).forEach(([uid, reaction]) => {
      const userReactions = normalizeDirectChatUserReactions(reaction, uid);

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

function normalizeDirectChatUserReactions(
  reaction: DirectChatUserReactionRecord | undefined,
  fallbackUid?: string
): DirectChatReactionRecord[] {
  const reactions = Array.isArray(reaction)
    ? reaction
    : reaction
      ? [reaction]
      : [];
  const dedupedReactions: DirectChatReactionRecord[] = [];
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

export function mapDirectChatMessageReactions(
  directChat?: DirectChatRecord | null
): ChatMessageReactionMap {
  const reactionMap: ChatMessageReactionMap = {};

  Object.entries(directChat?.messageReactions || {}).forEach(([messageId, reactionsByUid]) => {
    const reactions = Object.entries(reactionsByUid || {})
      .flatMap(([uid, reaction]) =>
        normalizeDirectChatUserReactions(reaction, uid).map((userReaction) => ({
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

function buildChatContact(
  currentUid: string,
  contactId: string,
  user: TenantUserRecord,
  directChat?: DirectChatRecord | null,
  hasActiveDevice = false,
  preference?: ChatUserPreference,
  archiveSettings?: ChatArchiveSettings,
  phoneFormatted?: string | null
): ChatContact {
  const displayName = getDisplayName(user);
  const roleName = user.roleName || formatRoleName(user.role || 'EMPLOYEE');
  const lastMessageSentAtMs = directChat?.lastMessageSentAtMs || null;
  const effectivePreference = preference || getDefaultChatUserPreference('', currentUid, 'DIRECT', contactId);
  const isCleared = Boolean(
    lastMessageSentAtMs &&
    effectivePreference.clearedAtMs &&
    lastMessageSentAtMs <= effectivePreference.clearedAtMs
  );
  const visibleLastMessageSentAtMs = isCleared ? null : lastMessageSentAtMs;
  const unreadCount = isCleared ? 0 : directChat?.unreadCounts?.[currentUid] || 0;
  const isArchived = shouldTreatChatAsArchived(effectivePreference, lastMessageSentAtMs, archiveSettings);
  const presence = getChatPresenceForUser(contactId);

  return {
    clearedAt: effectivePreference.clearedAtMs ? new Date(effectivePreference.clearedAtMs).toISOString() : null,
    contactId,
    conversationId: buildDirectChatId(currentUid, contactId),
    displayName,
    hasActiveDevice,
    initials: getInitials(displayName),
    isArchived,
    isFavorite: effectivePreference.isFavorite,
    isPinned: effectivePreference.isPinned,
    isSpam: effectivePreference.isSpam,
    isOnline: presence.isOnline,
    lastMessageAt: visibleLastMessageSentAtMs ? new Date(visibleLastMessageSentAtMs).toISOString() : null,
    lastSeenAt: presence.lastSeenAt,
    phoneFormatted: phoneFormatted || null,
    phoneMasked: user.phoneMasked || null,
    preview: visibleLastMessageSentAtMs ? directChat?.lastMessageText || '' : '',
    profilePhotoCacheKey: user.profilePhotoStoragePath
      ? buildProfilePhotoCacheKey(contactId, user.profilePhotoVersion)
      : null,
    profilePhotoUrl: getChatContactProfilePhotoUrl(contactId, user.profilePhotoStoragePath, user.profilePhotoVersion),
    role: user.role || 'EMPLOYEE',
    roleName,
    spammedAt: effectivePreference.spammedAtMs ? new Date(effectivePreference.spammedAtMs).toISOString() : null,
    status: user.status || 'ACTIVE',
    trashSegments: mapTrashSegments(effectivePreference.trashSegments),
    unreadCount
  };
}

function mapTrashSegments(trashSegments: ChatTrashSegment[]): Array<ChatTrashSegment & {
  deletedAt: string;
  expiresAt: string;
}> {
  return trashSegments.map((segment) => ({
    ...segment,
    deletedAt: new Date(segment.deletedAtMs).toISOString(),
    expiresAt: new Date(segment.expiresAtMs).toISOString()
  }));
}

async function getActiveDeviceUserIds(tenantId: string): Promise<Set<string>> {
  const snapshot = await firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('deviceKeys')
    .where('status', '==', 'ACTIVE')
    .get();
  const userIds = new Set<string>();

  snapshot.docs.forEach((doc) => {
    const uid = (doc.data() as { uid?: string }).uid;

    if (uid) {
      userIds.add(uid);
    }
  });

  return userIds;
}

async function getAuthPhoneFormattedByUid(uids: string[]): Promise<Map<string, string>> {
  const phoneByUid = new Map<string, string>();

  for (let index = 0; index < uids.length; index += 100) {
    const uidBatch = uids.slice(index, index + 100);

    if (!uidBatch.length) {
      continue;
    }

    const result = await adminAuth
      .getUsers(uidBatch.map((uid) => ({ uid })))
      .catch(() => null);

    result?.users.forEach((user) => {
      const normalizedPhone = user.phoneNumber ? normalizeE164Phone(user.phoneNumber) : '';

      if (normalizedPhone) {
        phoneByUid.set(user.uid, formatPhoneNumber(normalizedPhone));
      }
    });
  }

  return phoneByUid;
}

async function hasActiveDeviceForUser(tenantId: string, uid: string): Promise<boolean> {
  const snapshot = await firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('deviceKeys')
    .where('uid', '==', uid)
    .where('status', '==', 'ACTIVE')
    .limit(1)
    .get();

  return !snapshot.empty;
}

async function getDepartmentAdminName(
  organizationRef: FirebaseFirestore.DocumentReference,
  contact: TenantUserRecord
): Promise<string | null> {
  if (!contact.departmentId) {
    return null;
  }

  const snapshot = await organizationRef
    .collection('users')
    .where('status', '==', 'ACTIVE')
    .where('departmentId', '==', contact.departmentId)
    .get();
  const adminNames = snapshot.docs
    .map((doc) => doc.data() as TenantUserRecord)
    .filter((user) => user.role === 'DEPT_ADMIN')
    .map((user) => getDisplayName(user))
    .filter(Boolean);

  if (!adminNames.length) {
    return null;
  }

  if (adminNames.length === 1) {
    return adminNames[0];
  }

  return `${adminNames[0]} + ${adminNames.length - 1} more`;
}

async function getDirectChatContext(decodedToken: DecodedIdToken, contactId: string) {
  const context = await getCurrentUserContext(decodedToken);
  const safeContactId = contactId.trim();

  if (!safeContactId || safeContactId === decodedToken.uid) {
    throw notFoundError('Chat was not found.');
  }

  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const contactSnapshot = await organizationRef.collection('users').doc(safeContactId).get();

  if (!contactSnapshot.exists) {
    throw notFoundError('Chat was not found.');
  }

  const contact = contactSnapshot.data() as TenantUserRecord;
  const visibleRoles = getVisibleChatContactRoles(context.role);

  if (contact.status !== 'ACTIVE' || !contact.role || !visibleRoles.includes(contact.role)) {
    throw notFoundError('Chat was not found.');
  }

  const chatId = buildDirectChatId(decodedToken.uid, safeContactId);
  const chatRef = organizationRef.collection('directChats').doc(chatId);
  const chatSnapshot = await chatRef.get();

  return {
    chatId,
    chatRef,
    contact,
    contactId: safeContactId,
    directChat: chatSnapshot.exists ? (chatSnapshot.data() as DirectChatRecord) : null,
    tenantId: context.tenantId
  };
}

function buildDirectChatId(uid: string, contactId: string): string {
  const participantKey = [uid, contactId].sort().join('|');
  return `direct_${createHash('sha256').update(participantKey).digest('hex')}`;
}

function getVisibleChatContactRoles(role: SynzappRole): SynzappRole[] {
  return ['ORG_ADMIN', 'DEPT_ADMIN', 'EMPLOYEE'];
}

async function uploadProfilePhoto(
  tenantId: string,
  uid: string,
  dataUrl: string
): Promise<UploadedProfilePhoto> {
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);

  if (!match) {
    throw validationError('Profile photo must be a JPEG, PNG, or WebP image.');
  }

  const contentType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  const bytes = Buffer.from(match[2], 'base64');

  if (bytes.length > 1 * 1024 * 1024) {
    throw validationError('Profile photo must be smaller than 1 MB.');
  }

  const extension = contentType === 'image/png'
    ? 'png'
    : contentType === 'image/webp'
      ? 'webp'
      : 'jpg';
  const storagePath = `organizations/${tenantId}/users/${uid}/profile/profile-photo.${extension}`;
  const saveOptions: StorageSaveOptions = {
    contentType,
    metadata: {
      cacheControl: 'private, max-age=3600',
      metadata: {
        tenantId,
        uid
      }
    },
    resumable: false
  };

  try {
    await saveProfilePhotoWithRetry(storagePath, bytes, saveOptions);
  } catch (error) {
    logProfilePhotoStorageFailure(error);

    if (isMissingStorageBucketError(error)) {
      throw validationError('Profile photo storage is not ready yet. Please try again later.');
    }

    if (isProfilePhotoStorageUnavailableError(error)) {
      throw validationError('Profile photo could not be saved right now. Please try again later.');
    }

    throw error;
  }

  return {
    contentType,
    storagePath
  };
}

async function saveProfilePhotoWithRetry(
  storagePath: string,
  bytes: Buffer,
  options: StorageSaveOptions
): Promise<void> {
  for (let attempt = 1; attempt <= PROFILE_PHOTO_STORAGE_SAVE_MAX_ATTEMPTS; attempt += 1) {
    try {
      await storageBucket.file(storagePath).save(bytes, options);
      return;
    } catch (error) {
      if (attempt >= PROFILE_PHOTO_STORAGE_SAVE_MAX_ATTEMPTS || !isRetryableProfilePhotoStorageError(error)) {
        throw error;
      }

      const delayMs = PROFILE_PHOTO_STORAGE_SAVE_RETRY_BASE_MS * attempt * attempt;
      console.warn('Profile photo storage save retrying', {
        bucket: storageBucket.name,
        attempt,
        maxAttempts: PROFILE_PHOTO_STORAGE_SAVE_MAX_ATTEMPTS,
        code: getStorageErrorCode(error) ?? null,
        message: sanitizeStorageErrorMessage(getErrorMessage(error))
      });
      await delay(delayMs);
    }
  }
}

function getDisplayName(user: TenantUserRecord): string {
  const displayName = user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim();

  return displayName || 'Synzapp user';
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'S';
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

function formatProfileRoleName(roleName: string | undefined, role: SynzappRole): string {
  const trimmedRoleName = roleName?.trim();
  const baseRoleName = formatRoleName(role);

  if (!trimmedRoleName || trimmedRoleName === baseRoleName) {
    return baseRoleName;
  }

  if (role === 'DEPT_ADMIN') {
    return `${trimmedRoleName} · ${baseRoleName}`;
  }

  return trimmedRoleName;
}

function isMissingStorageBucketError(error: unknown): boolean {
  const code = getStorageErrorCode(error);
  const message = getErrorMessage(error);

  return (
    code === 404 &&
    /bucket|storage|not found|does not exist/i.test(message)
  ) || /specified bucket does not exist|bucket name|storage bucket|bucket is needed|invalid bucket/i.test(message);
}

function isProfilePhotoStorageUnavailableError(error: unknown): boolean {
  const code = getStorageErrorCode(error);
  const message = getErrorMessage(error);

  return code === 403 ||
    code === 429 ||
    code === 500 ||
    code === 502 ||
    code === 503 ||
    /access denied|forbidden|permission|credential|oauth|token|fetch failed|socket hang up|econnreset|etimedout|timeout|temporarily unavailable/i.test(message);
}

function isRetryableProfilePhotoStorageError(error: unknown): boolean {
  const code = getStorageErrorCode(error);
  const message = getErrorMessage(error);

  return code === 429 ||
    code === 500 ||
    code === 502 ||
    code === 503 ||
    code === 504 ||
    code === 'ERR_STREAM_PREMATURE_CLOSE' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    /premature close|invalid response body while trying to fetch|fetch failed|socket hang up|econnreset|etimedout|timeout|temporarily unavailable/i.test(message);
}

function logProfilePhotoStorageFailure(error: unknown): void {
  console.warn('Profile photo storage save failed', {
    bucket: storageBucket.name,
    code: getStorageErrorCode(error) ?? null,
    message: sanitizeStorageErrorMessage(getErrorMessage(error))
  });
}

function getStorageErrorCode(error: unknown): number | string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return (error as { code?: number | string }).code;
  }

  return undefined;
}

function sanitizeStorageErrorMessage(message: string): string {
  return message.replace(/\s+/g, ' ').slice(0, 400);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error';
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
