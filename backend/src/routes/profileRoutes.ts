import { Request, Router } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { z } from 'zod';
import {
  cancelScheduledMessage,
  dismissScheduledMessage,
  listMyScheduledMessages,
  scheduleDirectMessage,
  sendScheduledMessageNow
} from '../services/scheduledMessageService.js';
import { verifyAppCheck } from '../middleware/appCheck.js';
import { createOrgAdminProfile } from '../services/orgAdminProfileService.js';
import {
  createEmployeeProfile,
  getEmployeeOnboardingContext
} from '../services/employeeProfileService.js';
import {
  getChatContactProfilePhoto,
  getCurrentUserProfile,
  getCurrentUserProfilePhoto,
  getDirectChatContact,
  getDirectChatContactDetails,
  getDirectChatMessageReactions,
  listCurrentUserChatContacts,
  updateDirectChatPreferenceForCurrentUser,
  updateDirectChatMessageReaction,
  updateCurrentUserProfilePhoto
} from '../services/userProfileService.js';
import { verifyFirebaseSession } from '../services/authSessionService.js';
import {
  getCurrentDeviceSynzappAiStatus,
  listCurrentUserDevices,
  registerDeviceIdentity,
  revokeCurrentUserDevice,
  updateCurrentDeviceSynzappAiStatus,
  verifyActiveRegisteredDevice,
  verifyOwnedRegisteredDevice
} from '../services/deviceIdentityService.js';
import type {
  DevicePlatform,
  SynzappAiDeviceInstallStatus
} from '../services/deviceIdentityService.js';
import {
  getDirectEncryptionContext,
  listEncryptedDirectEnvelopesForDevice,
  markEncryptedDirectEnvelopesDeliveredForDevice,
  sendEncryptedDirectEnvelope
} from '../services/encryptedMessageEnvelopeService.js';
import {
  addGroupChatMember,
  createGroupChat,
  exitGroupChat,
  getGroupChatContact,
  getGroupChatPhoto,
  getGroupChatMemberProfilePhoto,
  getGroupChatMessageReactions,
  getGroupEncryptionContext,
  grantGroupChatHistoryKeys,
  listAddableGroupChatTargets,
  hideGroupChatMessageForCurrentUser,
  listCurrentUserGroupChatContacts,
  listEncryptedGroupEnvelopesForDevice,
  markEncryptedGroupEnvelopesDeliveredForDevice,
  sendEncryptedGroupEnvelope,
  updateGroupChatPhoto,
  updateGroupChatPreferenceForCurrentUser,
  updateGroupChatMessageReaction
} from '../services/groupChatService.js';
import {
  getLatestEncryptedChatBackup,
  saveEncryptedChatBackup
} from '../services/chatBackupService.js';
import {
  createEncryptedChatMediaDownloadSession,
  createEncryptedChatMediaUploadSession,
  markEncryptedChatMediaUploaded
} from '../services/chatMediaService.js';
import { getChatBackupPolicyForCurrentUser } from '../services/chatBackupPolicyService.js';
import {
  claimRestoreForCurrentUser,
  escrowBackupKeyForCurrentUser,
  requestRestoreForCurrentUser
} from '../services/chatBackupRestoreService.js';
import { listCurrentUserGroups } from '../services/groupService.js';
import {
  deactivateCurrentUserPushToken,
  getChatNotificationSettings,
  registerCurrentUserPushToken,
  sendChatMessagePushNotification,
  sendGroupChatMessagePushNotifications,
  updateChatNotificationSettings
} from '../services/notificationService.js';
import {
  getChatTranscriptLanguage,
  updateChatTranscriptLanguage,
  type ChatTranscriptLanguageCode
} from '../services/chatTranscriptLanguageService.js';
import {
  translateChatMessage,
  type ChatTranslationLanguageCode
} from '../services/chatTranslationService.js';
import {
  getChatArchiveSettings,
  updateChatArchiveSettings
} from '../services/chatArchiveSettingsService.js';
import {
  completeDeviceWipeCommand,
  listPendingDeviceWipeCommands
} from '../services/companyDataWipeService.js';
import { writeAuditEvent } from '../services/auditService.js';

const profileRouter = Router();

/**
 * The address, kept in its parts as well as written out.
 *
 * The written-out line is what people read, and it stays the field everything
 * already uses. The parts are what a system can act on: a country to bill in,
 * a state for a records request, a postal code to check. Storing only the
 * sentence would mean parsing it back out later, which never survives contact
 * with real addresses.
 */
const deliveryReceiptSchema = z.object({
  chatType: z.enum(['DIRECT', 'GROUP']).default('DIRECT'),
  /** The group for a group message, the sender for a direct one. */
  contactId: z.string().trim().min(1).max(200)
});

const companyAddressPartsSchema = z.object({
  city: z.string().trim().max(120).optional(),
  countryCode: z.enum(['US', 'CA', 'MX', 'GB']).optional(),
  line1: z.string().trim().max(200).optional(),
  line2: z.string().trim().max(200).optional(),
  postalCode: z.string().trim().max(20).optional(),
  region: z.string().trim().max(120).optional()
});

const orgAdminProfileBodySchema = z.object({
  adminFirstName: z.string().trim().min(2).max(80),
  adminLastName: z.string().trim().min(2).max(80),
  calendarYearStartDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  companyAddress: z.string().trim().min(5).max(240),
  // Optional so that a phone running the previous build still succeeds.
  companyAddressParts: companyAddressPartsSchema.optional(),
  companyEmail: z.string().trim().max(320).optional(),
  companyName: z.string().trim().min(2).max(120),
  profilePhotoDataUrl: z.string().max(1_500_000).optional()
});

const employeeProfileBodySchema = z.object({
  employeeFirstName: z.string().trim().min(2).max(80),
  employeeLastName: z.string().trim().min(2).max(80),
  profilePhotoDataUrl: z.string().max(1_500_000).optional()
});

const profilePhotoBodySchema = z.object({
  profilePhotoDataUrl: z.string().min(32).max(1_500_000)
});

const safeDeviceIdSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{16,128}$/);

const safeCommandIdSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{8,160}$/);

const devicePlatformSchema = z.enum(['android', 'ios', 'unknown', 'web']);

const deviceIdentityBodySchema = z.object({
  appInstallationId: z.string().trim().min(12).max(128),
  /** Sent only on the retry, after somebody confirmed the other phone goes. */
  claimFromMobileDeviceId: safeDeviceIdSchema.optional(),
  deviceTimeZone: z.string().trim().min(1).max(64).optional(),
  cryptoProvider: z.string().trim().min(2).max(40),
  deviceId: safeDeviceIdSchema,
  identityPublicKey: z.string().trim().min(32).max(256),
  keyAgreementPublicKey: z.string().trim().min(32).max(256),
  keyVersion: z.number().int().min(1).max(50),
  platform: devicePlatformSchema,
  protocolVersion: z.string().trim().min(2).max(80),
  signingPublicKey: z.string().trim().min(32).max(256)
});

const revokeOwnDeviceBodySchema = z.object({
  reason: z.string().trim().max(160).optional()
});

const synzappAiDeviceStatusBodySchema = z.object({
  modelId: z.string().trim().min(2).max(160).optional().nullable(),
  status: z.enum(['available', 'downloading', 'failed', 'installed'])
});

const pushTokenBodySchema = z.object({
  deviceId: safeDeviceIdSchema,
  platform: devicePlatformSchema,
  provider: z.enum(['apnsVoip', 'expo', 'fcm']),
  token: z.string().trim().min(20).max(4096)
});

const encryptedNotificationPreviewSchema = z.object({
  algorithm: z.literal('x25519-sha256-aes-256-gcm+synzapp-notification-preview-v1'),
  ciphertext: z.string().trim().min(16).max(4000),
  nonce: z.string().trim().min(8).max(256),
  version: z.literal(1)
});

const encryptedEnvelopeBodySchema = z.object({
  algorithm: z.string().trim().min(2).max(80),
  ciphertext: z.string().trim().min(16).max(1_000_000),
  clientMessageId: z.string().trim().min(8).max(120),
  encryptedKeysByDevice: z.record(
    safeDeviceIdSchema,
    z.string().trim().min(16).max(4000)
  ),
  keyVersion: z.number().int().min(1).max(50),
  // The media this message uses. Sent alongside because the ids live inside the
  // encrypted payload, which the server cannot read.
  mediaIds: z.array(z.string().trim().min(1).max(160)).max(20).optional(),
  nonce: z.string().trim().min(8).max(256),
  notificationPreviewByDevice: z.record(
    safeDeviceIdSchema,
    encryptedNotificationPreviewSchema
  ).optional(),
  recipientDeviceIds: z.array(safeDeviceIdSchema).min(1).max(50),
  senderDeviceId: safeDeviceIdSchema
});

/**
 * A message written now and sent later.
 *
 * The ordinary envelope, sealed on the phone exactly as it would be for an
 * immediate send, plus when it should go and the zone its author chose in. The
 * moment itself is absolute — the zone is kept for display and for the audit
 * trail, never to recompute the time.
 */
const scheduledEnvelopeBodySchema = encryptedEnvelopeBodySchema.extend({
  releaseAtMs: z.number().int().min(0),
  timeZone: z.string().trim().min(1).max(64)
});

const groupHistoryKeyGrantBodySchema = z.object({
  grants: z.array(z.object({
    encryptedKeysByDevice: z.record(
      safeDeviceIdSchema,
      z.string().trim().min(16).max(4000)
    ),
    envelopeId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,160}$/)
  })).min(1).max(100)
});

const groupChatBodySchema = z.object({
  memberIds: z.array(z.string().trim().min(1).max(128)).min(1).max(49),
  messagePermissionMode: z.enum(['ADMINS', 'ALL_MEMBERS']).optional(),
  name: z.string().trim().min(1).max(120)
});

const groupChatMemberBodySchema = z.object({
  contactId: z.string().trim().min(1).max(128)
});

const encryptedMediaUploadBodySchema = z.object({
  chunkCount: z.number().int().min(2).max(320).optional(),
  chunkSizeBytes: z.number().int().min(512 * 1024).max(8 * 1024 * 1024).optional(),
  contentType: z.string().trim().min(3).max(120),
  encryptedSizeBytes: z.number().int().min(1).max(1100 * 1024 * 1024),
  fileName: z.string().trim().min(1).max(180),
  kind: z.enum(['audio', 'file', 'image', 'video']),
  originalSizeBytes: z.number().int().min(0).max(1024 * 1024 * 1024).optional()
});

const chatMessageReactionBodySchema = z.object({
  emoji: z.string().trim().max(16)
});

const chatNotificationSettingsBodySchema = z.object({
  alertTone: z.enum(['chime', 'default', 'pulse', 'silent']),
  muteMode: z.enum(['1w', '8h', 'always', 'off'])
});

const chatTranscriptLanguageCodeSchema = z.enum([
  'ar-SA',
  'da-DK',
  'de-DE',
  'en-AU',
  'en-CA',
  'en-GB',
  'en-IN',
  'en-US',
  'es-ES',
  'es-MX',
  'fr-CA',
  'fr-FR',
  'hi-IN',
  'it-IT',
  'ja-JP',
  'ko-KR',
  'nl-BE',
  'nl-NL',
  'pt-BR',
  'yue-CN',
  'zh-CN',
  'zh-HK',
  'zh-TW'
]);

const chatTranscriptLanguageBodySchema = z.object({
  languageCode: chatTranscriptLanguageCodeSchema
});

const chatTranslationBodySchema = z.object({
  messageId: z.string().trim().min(4).max(160),
  sourceLanguageCode: chatTranscriptLanguageCodeSchema,
  targetLanguageCode: chatTranscriptLanguageCodeSchema,
  text: z.string().trim().min(1).max(4_000)
});

const chatPreferenceBodySchema = z.object({
  clear: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  isSpam: z.boolean().optional(),
  permanentDelete: z.boolean().optional()
}).refine(
  (value) =>
    typeof value.clear === 'boolean' ||
    typeof value.isArchived === 'boolean' ||
    typeof value.isFavorite === 'boolean' ||
    typeof value.isPinned === 'boolean' ||
    typeof value.isSpam === 'boolean' ||
    typeof value.permanentDelete === 'boolean',
  'At least one chat preference is required.'
);

const chatArchiveSettingsBodySchema = z.object({
  adminControls: z.object({
    configureRetentionRequirements: z.boolean().optional(),
    preventArchivedChatDeletion: z.boolean().optional(),
    setCompanyWideArchivePolicies: z.boolean().optional(),
    viewArchivedCompanyChats: z.boolean().optional()
  }).optional(),
  archiveBadgeMode: z.enum(['HIDE', 'MENTIONS_ONLY', 'UNREAD_COUNT']).optional(),
  autoArchiveInactive: z.enum(['AFTER_30_DAYS', 'AFTER_7_DAYS', 'AFTER_90_DAYS', 'CUSTOM', 'NEVER']).optional(),
  archivedNotificationMode: z.enum(['ALL_MESSAGES', 'DIRECT_REPLIES_ONLY', 'MENTIONS_ONLY', 'NONE']).optional(),
  customAutoArchiveDays: z.number().int().min(1).max(365).nullable().optional(),
  keepArchivedWhenNewMessagesArrive: z.boolean().optional(),
  smartRules: z.object({
    archiveClosedProjectGroups: z.boolean().optional(),
    archiveDepartedEmployeeChats: z.boolean().optional(),
    archiveInactiveChats: z.boolean().optional(),
    archiveMutedGroupsAfterTime: z.boolean().optional()
  }).optional(),
  unreadDisplayMode: z.enum(['HIDE', 'MENTIONS_ONLY', 'TOTAL_UNREAD']).optional(),
  unarchiveBehavior: z.enum(['DIRECT_REPLY', 'MANUAL_ONLY', 'MENTION', 'NEW_MESSAGE']).optional()
}).refine(
  (value) => Object.keys(value).length > 0,
  'At least one archive setting is required.'
);

function getChatPreferenceAuditMetadata(
  idField: 'contactId' | 'groupId',
  idValue: string,
  body: z.infer<typeof chatPreferenceBodySchema>
) {
  return {
    ...(body.clear !== undefined ? { clear: body.clear === true } : {}),
    [idField]: idValue,
    ...(body.isArchived !== undefined ? { isArchived: body.isArchived } : {}),
    ...(body.isFavorite !== undefined ? { isFavorite: body.isFavorite } : {}),
    ...(body.isPinned !== undefined ? { isPinned: body.isPinned } : {}),
    ...(body.isSpam !== undefined ? { isSpam: body.isSpam } : {}),
    ...(body.permanentDelete !== undefined ? { permanentDelete: body.permanentDelete === true } : {})
  };
}

const encryptedChatBackupBodySchema = z.object({
  algorithm: z.literal('nacl-secretbox+synzapp-chat-backup-v1'),
  backupCreatedAt: z.string().datetime(),
  backupVersion: z.literal(1),
  ciphertext: z.string().trim().min(16).max(4_500_000),
  conversationCount: z.number().int().min(0).max(50_000),
  keyFingerprint: z.string().trim().min(16).max(128),
  messageCount: z.number().int().min(0).max(2_000_000),
  nonce: z.string().trim().min(8).max(256)
});

profileRouter.get('/me/company-data-wipe-commands', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    /**
     * Ownership, not authorisation. A revoked device is exactly the device that
     * needs to read this: revocation marks it REVOKED and then writes its wipe
     * order, so requiring ACTIVE here addressed the order to a device already
     * blocked from collecting it, and wiping a lost phone did nothing at all.
     */
    const ownedDevice = await requireOwnedRegisteredDevice(req, decodedToken);
    const commands = await listPendingDeviceWipeCommands({
      deviceId: ownedDevice.deviceId,
      tenantId: getTenantIdClaim(decodedToken),
      uid: decodedToken.uid
    });

    res.json({ commands });
  } catch (error) {
    next(error);
  }
});

profileRouter.post('/me/company-data-wipe-commands/:commandId/complete', verifyAppCheck, async (req, res, next) => {
  let decodedToken: DecodedIdToken | null = null;
  let deviceId: string | null = null;

  try {
    decodedToken = await getDecodedToken(req.header('Authorization') || '');
    // Same reason as the listing above: the device reporting a completed wipe
    // has, by definition, just been revoked.
    const ownedDevice = await requireOwnedRegisteredDevice(req, decodedToken);
    deviceId = ownedDevice.deviceId;
    const commandId = safeCommandIdSchema.parse(req.params.commandId);
    const tenantId = getTenantIdClaim(decodedToken);

    await completeDeviceWipeCommand({
      commandId,
      deviceId,
      tenantId,
      uid: decodedToken.uid
    });

    await writeAuditEvent({
      action: 'COMPANY_DATA_WIPE_COMMAND_COMPLETED',
      metadata: {
        commandId,
        deviceId
      },
      req,
      status: 'SUCCESS',
      tenantId: tenantId || undefined,
      uid: decodedToken.uid
    });

    res.json({ completed: true });
  } catch (error) {
    await writeAuditEvent({
      action: 'COMPANY_DATA_WIPE_COMMAND_COMPLETED',
      metadata: {
        deviceId
      },
      reason: error instanceof Error ? error.message : 'Company data wipe command completion failed',
      req,
      status: 'FAILED',
      tenantId: decodedToken ? getTenantIdClaim(decodedToken) || undefined : undefined,
      uid: decodedToken?.uid
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.get('/me', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const profile = await getCurrentUserProfile(decodedToken);

    res.json({ profile });
  } catch (error) {
    next(error);
  }
});

profileRouter.get('/me/devices', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const devices = await listCurrentUserDevices(decodedToken, activeDevice.deviceId);

    res.json({ devices });
  } catch (error) {
    next(error);
  }
});

profileRouter.get('/me/synzapp-ai/device-status', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const synzappAi = await getCurrentDeviceSynzappAiStatus(activeDevice);

    res.json({ synzappAi });
  } catch (error) {
    next(error);
  }
});

profileRouter.put('/me/synzapp-ai/device-status', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const body = synzappAiDeviceStatusBodySchema.parse(req.body);
    const synzappAi = await updateCurrentDeviceSynzappAiStatus(decodedToken, activeDevice, {
      modelId: body.modelId || null,
      status: body.status as SynzappAiDeviceInstallStatus
    });

    await writeAuditEvent({
      action: 'SYNZAPP_AI_DEVICE_STATUS_UPDATED',
      metadata: {
        askButtonVisible: synzappAi.askButtonVisible,
        deviceId: activeDevice.deviceId,
        modelId: synzappAi.modelId,
        status: synzappAi.status
      },
      req,
      status: 'SUCCESS',
      tenantId: activeDevice.tenantId,
      uid: decodedToken.uid
    });

    res.json({ synzappAi });
  } catch (error) {
    await writeAuditEvent({
      action: 'SYNZAPP_AI_DEVICE_STATUS_UPDATED',
      reason: error instanceof Error ? error.message : 'Synzapp AI device status update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.post('/me/devices', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = deviceIdentityBodySchema.parse(req.body);
    const device = await registerDeviceIdentity(decodedToken, {
      ...body,
      platform: body.platform as DevicePlatform
    });

    await writeAuditEvent({
      action: 'DEVICE_IDENTITY_REGISTERED',
      metadata: {
        cryptoProvider: device.cryptoProvider,
        deviceId: device.deviceId,
        keyVersion: device.keyVersion,
        platform: device.platform,
        protocolVersion: device.protocolVersion
      },
      req,
      status: 'SUCCESS',
      tenantId: device.tenantId,
      uid: device.uid
    });

    res.status(201).json({ device });
  } catch (error) {
    await writeAuditEvent({
      action: 'DEVICE_IDENTITY_REGISTERED',
      reason: error instanceof Error ? error.message : 'Device registration failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.post('/me/devices/:deviceId/revoke', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const deviceId = safeDeviceIdSchema.parse(
      Array.isArray(req.params.deviceId)
        ? req.params.deviceId[0] || ''
        : req.params.deviceId || ''
    );
    const body = revokeOwnDeviceBodySchema.parse(req.body);
    const device = await revokeCurrentUserDevice(
      decodedToken,
      deviceId,
      activeDevice.deviceId,
      body.reason
    );

    await writeAuditEvent({
      action: 'USER_DEVICE_REVOKED',
      metadata: {
        deviceId: device.deviceId,
        platform: device.platform,
        reason: device.revocationReason
      },
      req,
      status: 'SUCCESS',
      tenantId: device.tenantId,
      uid: decodedToken.uid
    });

    res.json({ device });
  } catch (error) {
    await writeAuditEvent({
      action: 'USER_DEVICE_REVOKED',
      reason: error instanceof Error ? error.message : 'Device revocation failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.post('/me/push-token', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const body = pushTokenBodySchema.parse(req.body);

    if (body.deviceId !== activeDevice.deviceId) {
      throw authorizationError('This device is not authorized.');
    }

    const pushToken = await registerCurrentUserPushToken(decodedToken, {
      ...body,
      platform: body.platform as DevicePlatform
    });

    res.status(201).json({ pushToken });
  } catch (error) {
    next(error);
  }
});

profileRouter.delete('/me/push-token/:deviceId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const deviceId = safeDeviceIdSchema.parse(
      Array.isArray(req.params.deviceId)
        ? req.params.deviceId[0] || ''
        : req.params.deviceId || ''
    );

    if (deviceId !== activeDevice.deviceId) {
      throw authorizationError('This device is not authorized.');
    }

    await deactivateCurrentUserPushToken(decodedToken, deviceId);

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

profileRouter.get('/chat/contacts', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    // With includeDirectory the response also carries colleagues this user has
    // never messaged, so "New chat" can list the organization without needing
    // the admin-only employee directory. Role visibility is unchanged - the
    // service still decides who this user is allowed to see.
    const includeDirectory = req.query.includeDirectory === 'true';
    const contacts = await listCurrentUserChatContacts(decodedToken, {
      includeDirectoryContacts: includeDirectory
    });

    res.json({ contacts });
  } catch (error) {
    next(error);
  }
});

profileRouter.get('/chat/groups', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const contacts = await listCurrentUserGroupChatContacts(decodedToken, activeDevice.deviceId);

    res.json({ contacts });
  } catch (error) {
    next(error);
  }
});

profileRouter.post('/chat/groups', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const body = groupChatBodySchema.parse(req.body);
    const contact = await createGroupChat(decodedToken, body);

    await writeAuditEvent({
      action: 'GROUP_CHAT_CREATED',
      metadata: {
        groupId: contact.contactId,
        memberCount: contact.memberCount,
        messagePermissionMode: contact.messagePermissionMode,
        name: contact.displayName
      },
      req,
      status: 'SUCCESS',
      tenantId: contact.tenantId,
      uid: decodedToken.uid
    });

    res.status(201).json({ contact });
  } catch (error) {
    await writeAuditEvent({
      action: 'GROUP_CHAT_CREATED',
      reason: error instanceof Error ? error.message : 'Group chat creation failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.get('/chat/groups/:groupId/photo', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const groupId = Array.isArray(req.params.groupId)
      ? req.params.groupId[0] || ''
      : req.params.groupId || '';
    const profilePhoto = await getGroupChatPhoto(decodedToken, groupId);
    const etag = `"${profilePhoto.cacheKey}"`;

    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Content-Type', profilePhoto.contentType);
    res.setHeader('ETag', etag);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    profilePhoto.file
      .createReadStream()
      .on('error', next)
      .pipe(res);
  } catch (error) {
    next(error);
  }
});

profileRouter.put('/chat/groups/:groupId/photo', verifyAppCheck, async (req, res, next) => {
  const groupId = Array.isArray(req.params.groupId)
    ? req.params.groupId[0] || ''
    : req.params.groupId || '';

  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const body = profilePhotoBodySchema.parse(req.body);
    const contact = await updateGroupChatPhoto(decodedToken, groupId, body.profilePhotoDataUrl);

    await writeAuditEvent({
      action: 'GROUP_CHAT_PHOTO_UPDATED',
      metadata: {
        groupId: contact.contactId,
        name: contact.displayName
      },
      req,
      status: 'SUCCESS',
      tenantId: contact.tenantId,
      uid: decodedToken.uid
    });

    res.json({ contact });
  } catch (error) {
    await writeAuditEvent({
      action: 'GROUP_CHAT_PHOTO_UPDATED',
      metadata: { groupId },
      reason: error instanceof Error ? error.message : 'Group photo update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.post('/chat/groups/:groupId/members', verifyAppCheck, async (req, res, next) => {
  const groupId = Array.isArray(req.params.groupId)
    ? req.params.groupId[0] || ''
    : req.params.groupId || '';

  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const body = groupChatMemberBodySchema.parse(req.body);
    const result = await addGroupChatMember(decodedToken, groupId, body.contactId);

    await writeAuditEvent({
      action: 'GROUP_CHAT_MEMBER_ADDED',
      metadata: {
        added: result.added,
        groupId: result.groupId,
        memberId: result.memberId,
        name: result.group.name
      },
      req,
      status: 'SUCCESS',
      tenantId: result.tenantId,
      uid: decodedToken.uid
    });

    res.json(result);
  } catch (error) {
    await writeAuditEvent({
      action: 'GROUP_CHAT_MEMBER_ADDED',
      metadata: { groupId },
      reason: error instanceof Error ? error.message : 'Group member add failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.delete('/chat/groups/:groupId/members/me', verifyAppCheck, async (req, res, next) => {
  const groupId = Array.isArray(req.params.groupId)
    ? req.params.groupId[0] || ''
    : req.params.groupId || '';

  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const result = await exitGroupChat(decodedToken, groupId);

    await writeAuditEvent({
      action: 'GROUP_CHAT_EXITED',
      metadata: {
        exited: result.exited,
        groupId: result.groupId
      },
      req,
      status: 'SUCCESS',
      tenantId: result.tenantId,
      uid: decodedToken.uid
    });

    res.json(result);
  } catch (error) {
    await writeAuditEvent({
      action: 'GROUP_CHAT_EXITED',
      metadata: { groupId },
      reason: error instanceof Error ? error.message : 'Group exit failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.patch('/chat/groups/:groupId/preferences', verifyAppCheck, async (req, res, next) => {
  const groupId = Array.isArray(req.params.groupId)
    ? req.params.groupId[0] || ''
    : req.params.groupId || '';

  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const body = chatPreferenceBodySchema.parse(req.body);
    const contact = await updateGroupChatPreferenceForCurrentUser(decodedToken, groupId, body);

    await writeAuditEvent({
      action: 'GROUP_CHAT_PREFERENCE_UPDATED',
      metadata: getChatPreferenceAuditMetadata('groupId', groupId, body),
      req,
      status: 'SUCCESS',
      tenantId: activeDevice.tenantId,
      uid: decodedToken.uid
    });

    res.json({ contact });
  } catch (error) {
    await writeAuditEvent({
      action: 'GROUP_CHAT_PREFERENCE_UPDATED',
      reason: error instanceof Error ? error.message : 'Group chat preference update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.get('/chat/groups/:groupId/notification-settings', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const groupId = Array.isArray(req.params.groupId)
      ? req.params.groupId[0] || ''
      : req.params.groupId || '';

    await getGroupChatContact(decodedToken, groupId);
    const settings = await getChatNotificationSettings(activeDevice.tenantId, decodedToken.uid, groupId);

    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

profileRouter.put('/chat/groups/:groupId/notification-settings', verifyAppCheck, async (req, res, next) => {
  const groupId = Array.isArray(req.params.groupId)
    ? req.params.groupId[0] || ''
    : req.params.groupId || '';

  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const body = chatNotificationSettingsBodySchema.parse(req.body);

    await getGroupChatContact(decodedToken, groupId);
    const settings = await updateChatNotificationSettings(
      activeDevice.tenantId,
      decodedToken.uid,
      groupId,
      body
    );

    await writeAuditEvent({
      action: 'GROUP_CHAT_NOTIFICATION_SETTINGS_UPDATED',
      metadata: {
        alertTone: settings.alertTone,
        groupId,
        muteMode: settings.muteMode,
        mutedUntil: settings.mutedUntil
      },
      req,
      status: 'SUCCESS',
      tenantId: activeDevice.tenantId,
      uid: decodedToken.uid
    });

    res.json({ settings });
  } catch (error) {
    await writeAuditEvent({
      action: 'GROUP_CHAT_NOTIFICATION_SETTINGS_UPDATED',
      metadata: { groupId },
      reason: error instanceof Error ? error.message : 'Group notification settings update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.get('/chat/groups/:groupId/members/:memberUid/photo', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const groupId = Array.isArray(req.params.groupId)
      ? req.params.groupId[0] || ''
      : req.params.groupId || '';
    const memberUid = Array.isArray(req.params.memberUid)
      ? req.params.memberUid[0] || ''
      : req.params.memberUid || '';
    const profilePhoto = await getGroupChatMemberProfilePhoto(decodedToken, groupId, memberUid);
    const etag = `"${profilePhoto.cacheKey}"`;

    res.setHeader('Cache-Control', 'private, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('Content-Type', profilePhoto.contentType);
    res.setHeader('ETag', etag);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.header('If-None-Match') === etag) {
      res.status(304).end();
      return;
    }

    profilePhoto.file
      .createReadStream()
      .on('error', next)
      .pipe(res);
  } catch (error) {
    next(error);
  }
});

profileRouter.get('/groups', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const groups = await listCurrentUserGroups(decodedToken);

    res.json({ groups });
  } catch (error) {
    next(error);
  }
});

profileRouter.get('/chat/groups/:groupId/encryption-context', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const groupId = Array.isArray(req.params.groupId)
      ? req.params.groupId[0] || ''
      : req.params.groupId || '';
    const context = await getGroupEncryptionContext(decodedToken, groupId, activeDevice.deviceId);

    res.json({ context });
  } catch (error) {
    next(error);
  }
});

profileRouter.get('/chat/groups/:groupId/encrypted-messages', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const groupId = Array.isArray(req.params.groupId)
      ? req.params.groupId[0] || ''
      : req.params.groupId || '';
    const trashSegmentId = getOptionalQueryString(req.query.trashSegmentId);
    const syncQuery = getEncryptedMessageSyncQuery(req);
    // Same rule as direct chats: a background fetch must not count as the user
    // having read the group.
    const shouldMarkRead = req.query.markRead !== 'false';
    const envelopes = await listEncryptedGroupEnvelopesForDevice(
      decodedToken,
      groupId,
      activeDevice.deviceId,
      {
        afterSentAtMs: syncQuery.afterSentAtMs,
        beforeSentAtMs: syncQuery.beforeSentAtMs,
        limit: syncQuery.limit,
        markAsRead: shouldMarkRead,
        trashSegmentId
      }
    );
    const [contact, messageReactions] = await Promise.all([
      getGroupChatContact(decodedToken, groupId, activeDevice.deviceId),
      getGroupChatMessageReactions(decodedToken, groupId)
    ]);

    res.json({
      contact,
      envelopes,
      messageReactions,
      sync: buildEncryptedMessageSyncResponse(envelopes, syncQuery.limit)
    });
  } catch (error) {
    next(error);
  }
});

profileRouter.post('/chat/groups/:groupId/history-key-grants', verifyAppCheck, async (req, res, next) => {
  const groupId = Array.isArray(req.params.groupId)
    ? req.params.groupId[0] || ''
    : req.params.groupId || '';

  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const body = groupHistoryKeyGrantBodySchema.parse(req.body);
    const result = await grantGroupChatHistoryKeys(
      decodedToken,
      groupId,
      activeDevice.deviceId,
      body.grants
    );

    await writeAuditEvent({
      action: 'GROUP_CHAT_HISTORY_KEYS_GRANTED',
      metadata: {
        grantedDeviceCount: result.grantedDeviceCount,
        grantedEnvelopeCount: result.grantedEnvelopeCount,
        groupId
      },
      req,
      status: 'SUCCESS',
      tenantId: result.tenantId,
      uid: decodedToken.uid
    });

    res.json(result);
  } catch (error) {
    await writeAuditEvent({
      action: 'GROUP_CHAT_HISTORY_KEYS_GRANTED',
      reason: error instanceof Error ? error.message : 'Group history key grant failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.post('/chat/groups/:groupId/media/upload-session', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const groupId = Array.isArray(req.params.groupId)
      ? req.params.groupId[0] || ''
      : req.params.groupId || '';
    const body = encryptedMediaUploadBodySchema.parse(req.body);
    const session = await createEncryptedChatMediaUploadSession(decodedToken, activeDevice, groupId, body, 'GROUP');

    res.status(201).json({ session });
  } catch (error) {
    next(error);
  }
});

profileRouter.post('/chat/groups/:groupId/media/:mediaId/complete', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const groupId = Array.isArray(req.params.groupId)
      ? req.params.groupId[0] || ''
      : req.params.groupId || '';
    const mediaId = Array.isArray(req.params.mediaId)
      ? req.params.mediaId[0] || ''
      : req.params.mediaId || '';
    const result = await markEncryptedChatMediaUploaded(decodedToken, groupId, mediaId, 'GROUP');

    res.json(result);
  } catch (error) {
    next(error);
  }
});

profileRouter.get('/chat/groups/:groupId/media/:mediaId/download', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const groupId = Array.isArray(req.params.groupId)
      ? req.params.groupId[0] || ''
      : req.params.groupId || '';
    const mediaId = Array.isArray(req.params.mediaId)
      ? req.params.mediaId[0] || ''
      : req.params.mediaId || '';
    const session = await createEncryptedChatMediaDownloadSession(decodedToken, groupId, mediaId, 'GROUP');

    res.json({ session });
  } catch (error) {
    next(error);
  }
});

profileRouter.put('/chat/groups/:groupId/messages/:messageId/reaction', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const groupId = Array.isArray(req.params.groupId)
      ? req.params.groupId[0] || ''
      : req.params.groupId || '';
    const messageId = Array.isArray(req.params.messageId)
      ? req.params.messageId[0] || ''
      : req.params.messageId || '';
    const body = chatMessageReactionBodySchema.parse(req.body);
    const result = await updateGroupChatMessageReaction(
      decodedToken,
      groupId,
      messageId,
      body.emoji
    );

    res.json(result);
  } catch (error) {
    await writeAuditEvent({
      action: 'GROUP_CHAT_REACTION_UPDATED',
      reason: error instanceof Error ? error.message : 'Group message reaction failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.delete('/chat/groups/:groupId/messages/:messageId', verifyAppCheck, async (req, res, next) => {
  const groupId = Array.isArray(req.params.groupId)
    ? req.params.groupId[0] || ''
    : req.params.groupId || '';
  const messageId = Array.isArray(req.params.messageId)
    ? req.params.messageId[0] || ''
    : req.params.messageId || '';

  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const result = await hideGroupChatMessageForCurrentUser(decodedToken, groupId, messageId);

    await writeAuditEvent({
      action: 'GROUP_CHAT_MESSAGE_HIDDEN_FOR_USER',
      metadata: {
        groupId,
        messageId
      },
      req,
      status: 'SUCCESS',
      tenantId: result.contact.tenantId,
      uid: decodedToken.uid
    });

    res.json(result);
  } catch (error) {
    await writeAuditEvent({
      action: 'GROUP_CHAT_MESSAGE_HIDDEN_FOR_USER',
      reason: error instanceof Error ? error.message : 'Group message delete-for-me failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.post('/chat/groups/:groupId/encrypted-messages', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const groupId = Array.isArray(req.params.groupId)
      ? req.params.groupId[0] || ''
      : req.params.groupId || '';
    const body = encryptedEnvelopeBodySchema.parse(req.body);

    if (body.senderDeviceId !== activeDevice.deviceId) {
      throw authorizationError('This device is not authorized to send that message.');
    }

    const envelope = await sendEncryptedGroupEnvelope(decodedToken, groupId, body);
    const contact = await getGroupChatContact(decodedToken, groupId, activeDevice.deviceId);

    await writeAuditEvent({
      action: 'ENCRYPTED_GROUP_CHAT_ENVELOPE_SENT',
      metadata: {
        envelopeId: envelope.envelopeId,
        groupId,
        keyVersion: envelope.keyVersion,
        recipientDeviceCount: envelope.recipientDeviceIds.length,
        recipientUserCount: envelope.recipientUids.length,
        senderDeviceId: envelope.senderDeviceId
      },
      req,
      status: 'SUCCESS',
      tenantId: envelope.tenantId,
      uid: decodedToken.uid
    });
    if (!envelope.isDuplicate) {
      void sendGroupChatMessagePushNotifications({
        conversationId: envelope.conversationId,
        envelopeId: envelope.envelopeId,
        groupId,
        notificationPreviewByDevice: envelope.notificationPreviewByDevice,
        recipientDeviceIds: envelope.recipientDeviceIds,
        recipientUids: envelope.recipientUids,
        senderKeyAgreementPublicKey: envelope.senderKeyAgreementPublicKey,
        senderUid: decodedToken.uid,
        sentAt: envelope.sentAt,
        tenantId: envelope.tenantId
      }).catch((error) => {
        console.warn('Group chat push notification failed:', error instanceof Error ? error.message : error);
      });
    }

    res.status(201).json({ contact, envelope });
  } catch (error) {
    await writeAuditEvent({
      action: 'ENCRYPTED_GROUP_CHAT_ENVELOPE_SENT',
      reason: error instanceof Error ? error.message : 'Encrypted group message failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.get('/chat/conversations/:contactId/messages', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);

    res.status(410).json({ error: 'Encrypted messaging is required.' });
  } catch (error) {
    next(error);
  }
});

profileRouter.post('/chat/conversations/:contactId/messages', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);

    res.status(410).json({ error: 'Encrypted messaging is required.' });
  } catch (error) {
    await writeAuditEvent({
      action: 'DIRECT_CHAT_MESSAGE_SENT',
      reason: error instanceof Error ? error.message : 'Direct chat message failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.get('/chat/conversations/:contactId/encryption-context', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const contactId = Array.isArray(req.params.contactId)
      ? req.params.contactId[0] || ''
      : req.params.contactId || '';
    const context = await getDirectEncryptionContext(decodedToken, contactId, activeDevice.deviceId);

    res.json({ context });
  } catch (error) {
    next(error);
  }
});

profileRouter.get('/chat/conversations/:contactId/details', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const contactId = Array.isArray(req.params.contactId)
      ? req.params.contactId[0] || ''
      : req.params.contactId || '';
    const details = await getDirectChatContactDetails(decodedToken, contactId);

    res.json({ details });
  } catch (error) {
    next(error);
  }
});

profileRouter.get('/chat/conversations/:contactId/addable-groups', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const contactId = Array.isArray(req.params.contactId)
      ? req.params.contactId[0] || ''
      : req.params.contactId || '';
    const groups = await listAddableGroupChatTargets(decodedToken, contactId);

    res.json({ groups });
  } catch (error) {
    next(error);
  }
});

profileRouter.get('/chat/archive-settings', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const archiveSettings = await getChatArchiveSettings(activeDevice.tenantId, decodedToken.uid);

    res.json({ archiveSettings });
  } catch (error) {
    next(error);
  }
});

profileRouter.put('/chat/archive-settings', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const body = chatArchiveSettingsBodySchema.parse(req.body);
    const archiveSettings = await updateChatArchiveSettings(activeDevice.tenantId, decodedToken.uid, body);

    await writeAuditEvent({
      action: 'CHAT_ARCHIVE_SETTINGS_UPDATED',
      metadata: body,
      req,
      status: 'SUCCESS',
      tenantId: activeDevice.tenantId,
      uid: decodedToken.uid
    });

    res.json({ archiveSettings });
  } catch (error) {
    await writeAuditEvent({
      action: 'CHAT_ARCHIVE_SETTINGS_UPDATED',
      reason: error instanceof Error ? error.message : 'Chat archive settings update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.patch('/chat/conversations/:contactId/preferences', verifyAppCheck, async (req, res, next) => {
  const contactId = Array.isArray(req.params.contactId)
    ? req.params.contactId[0] || ''
    : req.params.contactId || '';

  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const body = chatPreferenceBodySchema.parse(req.body);
    const contact = await updateDirectChatPreferenceForCurrentUser(decodedToken, contactId, body);

    await writeAuditEvent({
      action: 'DIRECT_CHAT_PREFERENCE_UPDATED',
      metadata: getChatPreferenceAuditMetadata('contactId', contactId, body),
      req,
      status: 'SUCCESS',
      tenantId: activeDevice.tenantId,
      uid: decodedToken.uid
    });

    res.json({ contact });
  } catch (error) {
    await writeAuditEvent({
      action: 'DIRECT_CHAT_PREFERENCE_UPDATED',
      reason: error instanceof Error ? error.message : 'Direct chat preference update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.get('/chat/conversations/:contactId/notification-settings', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const contactId = Array.isArray(req.params.contactId)
      ? req.params.contactId[0] || ''
      : req.params.contactId || '';

    await getDirectChatContact(decodedToken, contactId);
    const settings = await getChatNotificationSettings(activeDevice.tenantId, decodedToken.uid, contactId);

    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

profileRouter.put('/chat/conversations/:contactId/notification-settings', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const contactId = Array.isArray(req.params.contactId)
      ? req.params.contactId[0] || ''
      : req.params.contactId || '';
    const body = chatNotificationSettingsBodySchema.parse(req.body);

    await getDirectChatContact(decodedToken, contactId);
    const settings = await updateChatNotificationSettings(
      activeDevice.tenantId,
      decodedToken.uid,
      contactId,
      body
    );

    await writeAuditEvent({
      action: 'DIRECT_CHAT_NOTIFICATION_SETTINGS_UPDATED',
      metadata: {
        alertTone: settings.alertTone,
        contactId,
        muteMode: settings.muteMode,
        mutedUntil: settings.mutedUntil
      },
      req,
      status: 'SUCCESS',
      tenantId: activeDevice.tenantId,
      uid: decodedToken.uid
    });

    res.json({ settings });
  } catch (error) {
    await writeAuditEvent({
      action: 'DIRECT_CHAT_NOTIFICATION_SETTINGS_UPDATED',
      reason: error instanceof Error ? error.message : 'Notification settings update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.get('/chat/conversations/:contactId/transcript-language', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const contactId = Array.isArray(req.params.contactId)
      ? req.params.contactId[0] || ''
      : req.params.contactId || '';

    await getDirectChatContact(decodedToken, contactId);
    const transcriptLanguage = await getChatTranscriptLanguage(activeDevice.tenantId, decodedToken.uid, contactId);

    res.json({ transcriptLanguage });
  } catch (error) {
    next(error);
  }
});

profileRouter.put('/chat/conversations/:contactId/transcript-language', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const contactId = Array.isArray(req.params.contactId)
      ? req.params.contactId[0] || ''
      : req.params.contactId || '';
    const body = chatTranscriptLanguageBodySchema.parse(req.body);

    await getDirectChatContact(decodedToken, contactId);
    const transcriptLanguage = await updateChatTranscriptLanguage(
      activeDevice.tenantId,
      decodedToken.uid,
      contactId,
      body.languageCode as ChatTranscriptLanguageCode
    );

    await writeAuditEvent({
      action: 'DIRECT_CHAT_TRANSCRIPT_LANGUAGE_UPDATED',
      metadata: {
        contactId,
        languageCode: transcriptLanguage.languageCode
      },
      req,
      status: 'SUCCESS',
      tenantId: activeDevice.tenantId,
      uid: decodedToken.uid
    });

    res.json({ transcriptLanguage });
  } catch (error) {
    await writeAuditEvent({
      action: 'DIRECT_CHAT_TRANSCRIPT_LANGUAGE_UPDATED',
      reason: error instanceof Error ? error.message : 'Transcript language update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.post('/chat/conversations/:contactId/messages/:messageId/translate', verifyAppCheck, async (req, res, next) => {
  const contactId = Array.isArray(req.params.contactId)
    ? req.params.contactId[0] || ''
    : req.params.contactId || '';
  const messageId = Array.isArray(req.params.messageId)
    ? req.params.messageId[0] || ''
    : req.params.messageId || '';

  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const body = chatTranslationBodySchema.parse({
      ...req.body,
      messageId
    });

    await getDirectChatContact(decodedToken, contactId);
    const translation = await translateChatMessage(decodedToken, {
      messageId: body.messageId,
      sourceLanguageCode: body.sourceLanguageCode as ChatTranslationLanguageCode,
      targetLanguageCode: body.targetLanguageCode as ChatTranslationLanguageCode,
      text: body.text
    });

    await writeAuditEvent({
      action: 'DIRECT_CHAT_MESSAGE_TRANSLATED',
      metadata: {
        contactId,
        messageId,
        sourceLanguageCode: translation.sourceLanguageCode,
        targetLanguageCode: translation.targetLanguageCode,
        textLength: body.text.length
      },
      req,
      status: 'SUCCESS',
      tenantId: activeDevice.tenantId,
      uid: decodedToken.uid
    });

    res.json({ translation });
  } catch (error) {
    await writeAuditEvent({
      action: 'DIRECT_CHAT_MESSAGE_TRANSLATED',
      metadata: {
        contactId,
        messageId
      },
      reason: error instanceof Error ? error.message : 'Direct chat translation failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.post('/chat/groups/:groupId/messages/:messageId/translate', verifyAppCheck, async (req, res, next) => {
  const groupId = Array.isArray(req.params.groupId)
    ? req.params.groupId[0] || ''
    : req.params.groupId || '';
  const messageId = Array.isArray(req.params.messageId)
    ? req.params.messageId[0] || ''
    : req.params.messageId || '';

  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const body = chatTranslationBodySchema.parse({
      ...req.body,
      messageId
    });

    await getGroupChatContact(decodedToken, groupId);
    const translation = await translateChatMessage(decodedToken, {
      messageId: body.messageId,
      sourceLanguageCode: body.sourceLanguageCode as ChatTranslationLanguageCode,
      targetLanguageCode: body.targetLanguageCode as ChatTranslationLanguageCode,
      text: body.text
    });

    await writeAuditEvent({
      action: 'GROUP_CHAT_MESSAGE_TRANSLATED',
      metadata: {
        groupId,
        messageId,
        sourceLanguageCode: translation.sourceLanguageCode,
        targetLanguageCode: translation.targetLanguageCode,
        textLength: body.text.length
      },
      req,
      status: 'SUCCESS',
      tenantId: activeDevice.tenantId,
      uid: decodedToken.uid
    });

    res.json({ translation });
  } catch (error) {
    await writeAuditEvent({
      action: 'GROUP_CHAT_MESSAGE_TRANSLATED',
      metadata: {
        groupId,
        messageId
      },
      reason: error instanceof Error ? error.message : 'Group chat translation failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

/**
 * One device saying it now holds a conversation's messages.
 *
 * This is what turns a single tick into a double tick, and it exists because
 * every other way of learning it needed the recipient's app to be **running**.
 * Delivery used to be recorded in exactly two places: opening a thread, and the
 * live socket updating the chat list. Both require an open app, so a message to
 * somebody whose app was shut stayed on "Sent" no matter what the push did.
 *
 * **The receipt comes from the phone, never from the push result.** Handing a
 * message to Google's push service only tells us Google accepted it, not that
 * any handset received it; its real delivery reports arrive in bulk hours later
 * and are meant for statistics. A tick driven off the send result would show
 * two ticks for a phone that is switched off, and a tick that lies is worse
 * than a tick that is late.
 *
 * So the worst a failed push can do is make the tick **late**: the receipt is
 * sent again the next time the device reaches us. That is what WhatsApp does
 * when a phone is off — one tick, then two the moment it comes back.
 *
 * Idempotent: the marker is only written where one is not already set, so a
 * phone may send this as often as it likes.
 */
profileRouter.post('/chat/delivery-receipts', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const body = deliveryReceiptSchema.parse(req.body);

    // The id a push carries: the group for a group message, the sender for a
    // direct one. Whichever it is, it names a conversation this caller must
    // already be a party to — both services check that before writing.
    if (body.chatType === 'GROUP') {
      await markEncryptedGroupEnvelopesDeliveredForDevice(
        decodedToken,
        body.contactId,
        activeDevice.deviceId
      );
    } else {
      await markEncryptedDirectEnvelopesDeliveredForDevice(
        decodedToken,
        body.contactId,
        activeDevice.deviceId
      );
    }

    res.json({ recorded: true });
  } catch (error) {
    next(error);
  }
});

profileRouter.get('/chat/conversations/:contactId/encrypted-messages', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const contactId = Array.isArray(req.params.contactId)
      ? req.params.contactId[0] || ''
      : req.params.contactId || '';
    const trashSegmentId = getOptionalQueryString(req.query.trashSegmentId);
    const syncQuery = getEncryptedMessageSyncQuery(req);
    // Reading a conversation is something the user does, not something a fetch
    // does. Background sync passes markRead=false so warming the offline cache
    // after a push cannot silently clear the unread badge for a chat the user
    // never opened. Default stays true so existing clients are unaffected.
    const shouldMarkRead = req.query.markRead !== 'false';
    const envelopes = await listEncryptedDirectEnvelopesForDevice(
      decodedToken,
      contactId,
      activeDevice.deviceId,
      {
        afterSentAtMs: syncQuery.afterSentAtMs,
        beforeSentAtMs: syncQuery.beforeSentAtMs,
        limit: syncQuery.limit,
        markAsRead: shouldMarkRead,
        trashSegmentId
      }
    );
    const [contact, messageReactions] = await Promise.all([
      getDirectChatContact(decodedToken, contactId),
      getDirectChatMessageReactions(decodedToken, contactId)
    ]);

    res.json({
      contact,
      envelopes,
      messageReactions,
      sync: buildEncryptedMessageSyncResponse(envelopes, syncQuery.limit)
    });
  } catch (error) {
    next(error);
  }
});

profileRouter.post('/chat/conversations/:contactId/encrypted-messages', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const contactId = Array.isArray(req.params.contactId)
      ? req.params.contactId[0] || ''
      : req.params.contactId || '';
    const body = encryptedEnvelopeBodySchema.parse(req.body);

    if (body.senderDeviceId !== activeDevice.deviceId) {
      throw authorizationError('This device is not authorized to send that message.');
    }

    const envelope = await sendEncryptedDirectEnvelope(decodedToken, contactId, body);
    const contact = await getDirectChatContact(decodedToken, contactId);

    await writeAuditEvent({
      action: 'ENCRYPTED_DIRECT_CHAT_ENVELOPE_SENT',
      metadata: {
        contactId,
        conversationId: envelope.conversationId,
        envelopeId: envelope.envelopeId,
        keyVersion: envelope.keyVersion,
        recipientDeviceCount: envelope.recipientDeviceIds.length,
        senderDeviceId: envelope.senderDeviceId
      },
      req,
      status: 'SUCCESS',
      tenantId: envelope.tenantId,
      uid: decodedToken.uid
    });
    if (!envelope.isDuplicate) {
      void sendChatMessagePushNotification({
        conversationId: envelope.conversationId,
        envelopeId: envelope.envelopeId,
        notificationPreviewByDevice: envelope.notificationPreviewByDevice,
        recipientDeviceIds: envelope.recipientDeviceIds,
        recipientUid: contactId,
        senderUid: decodedToken.uid,
        senderKeyAgreementPublicKey: envelope.senderKeyAgreementPublicKey,
        sentAt: envelope.sentAt,
        tenantId: envelope.tenantId
      }).catch((error) => {
        console.warn('Chat push notification failed:', error instanceof Error ? error.message : error);
      });
    }

    res.status(201).json({ contact, envelope });
  } catch (error) {
    await writeAuditEvent({
      action: 'ENCRYPTED_DIRECT_CHAT_ENVELOPE_SENT',
      reason: error instanceof Error ? error.message : 'Encrypted message failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.post('/chat/conversations/:contactId/scheduled-messages', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const contactId = Array.isArray(req.params.contactId)
      ? req.params.contactId[0] || ''
      : req.params.contactId || '';
    const body = scheduledEnvelopeBodySchema.parse(req.body);

    if (body.senderDeviceId !== activeDevice.deviceId) {
      throw authorizationError('This device is not authorized to send that message.');
    }

    const scheduledMessage = await scheduleDirectMessage(decodedToken, contactId, body);

    await writeAuditEvent({
      action: 'CHAT_MESSAGE_SCHEDULED',
      metadata: {
        conversationId: scheduledMessage.conversationId,
        recipientUid: scheduledMessage.contactId,
        releaseAtMs: scheduledMessage.releaseAtMs,
        scheduledMessageId: scheduledMessage.scheduledMessageId,
        timeZone: scheduledMessage.timeZone
      },
      req,
      status: 'SUCCESS',
      uid: decodedToken.uid
    });

    res.status(201).json({ scheduledMessage });
  } catch (error) {
    await writeAuditEvent({
      action: 'CHAT_MESSAGE_SCHEDULED',
      reason: error instanceof Error ? error.message : 'Scheduling failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.get('/chat/scheduled-messages', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const contactId = typeof req.query.contactId === 'string' ? req.query.contactId : undefined;
    const scheduledMessages = await listMyScheduledMessages(decodedToken, { contactId });

    res.json({ scheduledMessages });
  } catch (error) {
    next(error);
  }
});

profileRouter.post('/chat/scheduled-messages/:scheduledMessageId/cancel', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const scheduledMessageId = Array.isArray(req.params.scheduledMessageId)
      ? req.params.scheduledMessageId[0] || ''
      : req.params.scheduledMessageId || '';
    const scheduledMessage = await cancelScheduledMessage(decodedToken, scheduledMessageId);

    await writeAuditEvent({
      action: 'CHAT_MESSAGE_SCHEDULE_CANCELLED',
      metadata: {
        byOrgAdmin: false,
        conversationId: scheduledMessage.conversationId,
        scheduledMessageId: scheduledMessage.scheduledMessageId
      },
      req,
      status: 'SUCCESS',
      uid: decodedToken.uid
    });

    res.json({ scheduledMessage });
  } catch (error) {
    next(error);
  }
});

profileRouter.post('/chat/scheduled-messages/:scheduledMessageId/dismiss', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const scheduledMessageId = Array.isArray(req.params.scheduledMessageId)
      ? req.params.scheduledMessageId[0] || ''
      : req.params.scheduledMessageId || '';

    await dismissScheduledMessage(decodedToken, scheduledMessageId);

    res.json({ dismissed: true });
  } catch (error) {
    next(error);
  }
});

profileRouter.post('/chat/scheduled-messages/:scheduledMessageId/send-now', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const scheduledMessageId = Array.isArray(req.params.scheduledMessageId)
      ? req.params.scheduledMessageId[0] || ''
      : req.params.scheduledMessageId || '';
    const scheduledMessage = await sendScheduledMessageNow(decodedToken, scheduledMessageId, req);

    res.json({ scheduledMessage });
  } catch (error) {
    next(error);
  }
});

profileRouter.post('/chat/conversations/:contactId/media/upload-session', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const contactId = Array.isArray(req.params.contactId)
      ? req.params.contactId[0] || ''
      : req.params.contactId || '';
    const body = encryptedMediaUploadBodySchema.parse(req.body);
    const session = await createEncryptedChatMediaUploadSession(decodedToken, activeDevice, contactId, body);

    res.status(201).json({ session });
  } catch (error) {
    next(error);
  }
});

profileRouter.post('/chat/conversations/:contactId/media/:mediaId/complete', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const contactId = Array.isArray(req.params.contactId)
      ? req.params.contactId[0] || ''
      : req.params.contactId || '';
    const mediaId = Array.isArray(req.params.mediaId)
      ? req.params.mediaId[0] || ''
      : req.params.mediaId || '';
    const result = await markEncryptedChatMediaUploaded(decodedToken, contactId, mediaId);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

profileRouter.get('/chat/conversations/:contactId/media/:mediaId/download', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const contactId = Array.isArray(req.params.contactId)
      ? req.params.contactId[0] || ''
      : req.params.contactId || '';
    const mediaId = Array.isArray(req.params.mediaId)
      ? req.params.mediaId[0] || ''
      : req.params.mediaId || '';
    const session = await createEncryptedChatMediaDownloadSession(decodedToken, contactId, mediaId);

    res.json({ session });
  } catch (error) {
    next(error);
  }
});

profileRouter.put('/chat/conversations/:contactId/messages/:messageId/reaction', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const contactId = Array.isArray(req.params.contactId)
      ? req.params.contactId[0] || ''
      : req.params.contactId || '';
    const messageId = Array.isArray(req.params.messageId)
      ? req.params.messageId[0] || ''
      : req.params.messageId || '';
    const body = chatMessageReactionBodySchema.parse(req.body);
    const result = await updateDirectChatMessageReaction(
      decodedToken,
      contactId,
      messageId,
      body.emoji
    );

    res.json(result);
  } catch (error) {
    await writeAuditEvent({
      action: 'DIRECT_CHAT_REACTION_UPDATED',
      reason: error instanceof Error ? error.message : 'Message reaction failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

/** A device id is how a restore is scoped; a key is what is being protected. */
const chatBackupEscrowSchema = z.object({
  deviceId: z.string().trim().min(1).max(200),
  recoveryKey: z.string().trim().min(16).max(512)
});
const chatBackupRestoreRequestSchema = z.object({
  deviceId: z.string().trim().min(1).max(200),
  deviceName: z.string().trim().max(120).nullish()
});
const chatBackupRestoreClaimSchema = z.object({
  deviceId: z.string().trim().min(1).max(200)
});

/**
 * Backup key escrow, from the device that made the backup.
 *
 * The key is wrapped by Cloud KMS before it is stored, so what lands in the
 * database is useless on its own. This is the copy that survives the device:
 * without it, reinstalling the app leaves every backup permanently unreadable.
 */
profileRouter.post('/chat/backups/escrow', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const body = chatBackupEscrowSchema.parse(req.body);

    await escrowBackupKeyForCurrentUser(decodedToken, body);

    res.json({ escrowed: true });
  } catch (error) {
    next(error);
  }
});

/** A device with no key asking to be let back in. */
profileRouter.post('/chat/backups/restore-requests', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const body = chatBackupRestoreRequestSchema.parse(req.body);
    const request = await requestRestoreForCurrentUser(decodedToken, body);

    res.json({ request });
  } catch (error) {
    next(error);
  }
});

/**
 * Collecting the key after an approval.
 *
 * Answers with null while nothing has been approved, which is the ordinary case
 * between asking and being answered, rather than treating it as an error. The
 * approval is spent here, so restoring again needs approving again.
 */
profileRouter.post('/chat/backups/restore-requests/claim', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const body = chatBackupRestoreClaimSchema.parse(req.body);
    const claimed = await claimRestoreForCurrentUser(decodedToken, body);

    // Written whichever way the key came back. An automatic release has no
    // approver to point at afterwards, so the record of it is the only thing
    // that shows a history was handed to a device — and that is exactly what an
    // auditor asks about first.
    if (claimed) {
      await writeAuditEvent({
        action: claimed.automatic
          ? 'chat.backup.restore.released'
          : 'chat.backup.restore.claimed',
        metadata: { automatic: claimed.automatic, deviceId: body.deviceId },
        req,
        status: 'SUCCESS',
        tenantId: (decodedToken as { tenantId?: string }).tenantId,
        uid: decodedToken.uid
      }).catch(() => undefined);
    }

    res.json({ recoveryKey: claimed?.recoveryKey || null });
  } catch (error) {
    next(error);
  }
});

profileRouter.get('/chat/backups/policy', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const policy = await getChatBackupPolicyForCurrentUser(decodedToken);

    res.json({ policy });
  } catch (error) {
    next(error);
  }
});

profileRouter.get('/chat/backups/latest', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const result = await getLatestEncryptedChatBackup(decodedToken, activeDevice);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

profileRouter.post('/chat/backups/latest', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const body = encryptedChatBackupBodySchema.parse(req.body);
    const metadata = await saveEncryptedChatBackup(decodedToken, activeDevice, body);

    await writeAuditEvent({
      action: 'ENCRYPTED_CHAT_BACKUP_UPLOADED',
      metadata: {
        backupVersion: metadata.backupVersion,
        conversationCount: metadata.conversationCount,
        keyFingerprint: metadata.keyFingerprint,
        messageCount: metadata.messageCount,
        sizeBytes: metadata.sizeBytes,
        uploadedByDeviceId: activeDevice.deviceId
      },
      req,
      status: 'SUCCESS',
      tenantId: activeDevice.tenantId,
      uid: decodedToken.uid
    });

    res.status(201).json({ metadata });
  } catch (error) {
    await writeAuditEvent({
      action: 'ENCRYPTED_CHAT_BACKUP_UPLOADED',
      reason: error instanceof Error ? error.message : 'Encrypted chat backup failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.get('/chat/contacts/:contactId/photo', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const contactId = Array.isArray(req.params.contactId)
      ? req.params.contactId[0] || ''
      : req.params.contactId || '';
    const profilePhoto = await getChatContactProfilePhoto(decodedToken, contactId);
    const etag = `"${profilePhoto.cacheKey}"`;

    res.setHeader('Cache-Control', 'private, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('Content-Type', profilePhoto.contentType);
    res.setHeader('ETag', etag);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.header('If-None-Match') === etag) {
      res.status(304).end();
      return;
    }

    profilePhoto.file
      .createReadStream()
      .on('error', next)
      .pipe(res);
  } catch (error) {
    next(error);
  }
});

profileRouter.get('/me/photo', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const profilePhoto = await getCurrentUserProfilePhoto(decodedToken);
    const etag = `"${profilePhoto.cacheKey}"`;

    res.setHeader('Cache-Control', 'private, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('Content-Type', profilePhoto.contentType);
    res.setHeader('ETag', etag);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.header('If-None-Match') === etag) {
      res.status(304).end();
      return;
    }

    profilePhoto.file
      .createReadStream()
      .on('error', next)
      .pipe(res);
  } catch (error) {
    next(error);
  }
});

profileRouter.post('/me/photo', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const body = profilePhotoBodySchema.parse(req.body);
    const profile = await updateCurrentUserProfilePhoto(decodedToken, body.profilePhotoDataUrl);

    await writeAuditEvent({
      action: 'USER_PROFILE_PHOTO_UPDATED',
      phoneMasked: profile.phoneMasked,
      req,
      status: 'SUCCESS',
      tenantId: profile.tenantId,
      uid: profile.uid
    });

    res.json({ profile });
  } catch (error) {
    await writeAuditEvent({
      action: 'USER_PROFILE_PHOTO_UPDATED',
      reason: error instanceof Error ? error.message : 'Profile photo update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.get('/employee/context', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const context = await getEmployeeOnboardingContext(decodedToken);

    await writeAuditEvent({
      action: 'EMPLOYEE_ONBOARDING_CONTEXT_VIEWED',
      metadata: {
        departmentId: context.departmentId,
        roleId: context.roleId
      },
      phoneMasked: context.phoneMasked,
      req,
      status: 'SUCCESS',
      tenantId: context.tenantId,
      uid: decodedToken.uid
    });

    res.json({ context });
  } catch (error) {
    await writeAuditEvent({
      action: 'EMPLOYEE_ONBOARDING_CONTEXT_VIEWED',
      reason: error instanceof Error ? error.message : 'Employee onboarding context failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.post('/employee', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = employeeProfileBodySchema.parse(req.body);
    const result = await createEmployeeProfile(decodedToken, body);

    await writeAuditEvent({
      action: 'EMPLOYEE_PROFILE_CREATED',
      metadata: {
        profileComplete: true,
        warnings: result.warnings
      },
      phoneMasked: result.session.user.phoneMasked,
      req,
      status: 'SUCCESS',
      tenantId: result.session.user.tenantId,
      uid: result.session.user.uid
    });

    res.status(201).json({
      session: result.session,
      warnings: result.warnings
    });
  } catch (error) {
    await writeAuditEvent({
      action: 'EMPLOYEE_PROFILE_CREATED',
      reason: error instanceof Error ? error.message : 'Employee profile creation failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

profileRouter.post('/org-admin', verifyAppCheck, async (req, res, next) => {
  try {
    const body = orgAdminProfileBodySchema.parse(req.body);
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const result = await createOrgAdminProfile(decodedToken, body);

    await writeAuditEvent({
      action: 'TENANT_CREATED',
      metadata: {
        calendarYearStartDate: body.calendarYearStartDate,
        companyName: body.companyName,
        createdByRole: 'ORG_ADMIN',
        warnings: result.warnings
      },
      phoneMasked: result.session.user.phoneMasked,
      req,
      status: 'SUCCESS',
      tenantId: result.session.user.tenantId,
      uid: result.session.user.uid
    });

    await writeAuditEvent({
      action: 'ORG_ADMIN_PROFILE_CREATED',
      metadata: {
        profileComplete: true,
        warnings: result.warnings
      },
      phoneMasked: result.session.user.phoneMasked,
      req,
      status: 'SUCCESS',
      tenantId: result.session.user.tenantId,
      uid: result.session.user.uid
    });

    res.status(201).json({
      session: result.session,
      warnings: result.warnings
    });
  } catch (error) {
    await writeAuditEvent({
      action: 'ORG_ADMIN_PROFILE_CREATED',
      reason: error instanceof Error ? error.message : 'Org Admin profile creation failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

async function getDecodedToken(authorizationHeader: string) {
  const idToken = authorizationHeader.startsWith('Bearer ')
    ? authorizationHeader.slice('Bearer '.length)
    : '';

  if (!idToken) {
    const error = new Error('Missing Firebase ID token.');
    error.name = 'AuthenticationError';
    throw error;
  }

  return verifyFirebaseSession(idToken);
}

async function requireActiveRegisteredDevice(req: Request, decodedToken: DecodedIdToken) {
  const deviceId = getDeviceIdFromHeader(req);

  return verifyActiveRegisteredDevice(decodedToken, deviceId);
}

/** For the wipe endpoints only: a device this account owns, revoked or not. */
async function requireOwnedRegisteredDevice(req: Request, decodedToken: DecodedIdToken) {
  const deviceId = getDeviceIdFromHeader(req);

  return verifyOwnedRegisteredDevice(decodedToken, deviceId);
}

function getDeviceIdFromHeader(req: Request): string {
  const parsedDeviceId = safeDeviceIdSchema.safeParse(req.header('X-Synzapp-Device-Id') || '');

  if (!parsedDeviceId.success) {
    throw authorizationError('This device is not authorized.');
  }

  return parsedDeviceId.data;
}

function getTenantIdClaim(decodedToken: DecodedIdToken): string | null {
  const value = (decodedToken as Record<string, unknown>).tenantId;

  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getOptionalQueryString(value: unknown): string | null {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return typeof rawValue === 'string' && rawValue.trim()
    ? rawValue.trim().slice(0, 160)
    : null;
}

function getEncryptedMessageSyncQuery(req: Request): {
  afterSentAtMs: number | null;
  beforeSentAtMs: number | null;
  limit: number;
} {
  return {
    afterSentAtMs: getOptionalPositiveIntegerQuery(req.query.afterSentAtMs),
    beforeSentAtMs: getOptionalPositiveIntegerQuery(req.query.beforeSentAtMs),
    limit: getOptionalBoundedIntegerQuery(req.query.limit, 100, 1, 500)
  };
}

function getOptionalPositiveIntegerQuery(value: unknown): number | null {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return null;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : null;
}

function getOptionalBoundedIntegerQuery(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return fallback;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.max(min, Math.min(Math.floor(parsedValue), max));
}

function buildEncryptedMessageSyncResponse(
  envelopes: Array<{ envelopeId: string; sentAt: string }>,
  requestedLimit: number
): {
  hasMore: boolean;
  latestSentAtMs: number | null;
  oldestSentAtMs: number | null;
} {
  const sentAtValues = envelopes
    .map((envelope) => Date.parse(envelope.sentAt))
    .filter((sentAtMs) => Number.isFinite(sentAtMs));

  if (!sentAtValues.length) {
    return {
      hasMore: false,
      latestSentAtMs: null,
      oldestSentAtMs: null
    };
  }

  return {
    hasMore: envelopes.length >= requestedLimit,
    latestSentAtMs: Math.max(...sentAtValues),
    oldestSentAtMs: Math.min(...sentAtValues)
  };
}

function authorizationError(message: string): Error {
  const error = new Error(message);
  error.name = 'AuthorizationError';
  return error;
}

export { profileRouter };
