import { Request, Router } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { z } from 'zod';
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
  getDirectChatMessageReactions,
  listCurrentUserChatContacts,
  updateDirectChatMessageReaction,
  updateCurrentUserProfilePhoto
} from '../services/userProfileService.js';
import { verifyFirebaseSession } from '../services/authSessionService.js';
import {
  listCurrentUserDevices,
  registerDeviceIdentity,
  revokeCurrentUserDevice,
  verifyActiveRegisteredDevice
} from '../services/deviceIdentityService.js';
import type { DevicePlatform } from '../services/deviceIdentityService.js';
import {
  getDirectEncryptionContext,
  listEncryptedDirectEnvelopesForDevice,
  sendEncryptedDirectEnvelope
} from '../services/encryptedMessageEnvelopeService.js';
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
import { listCurrentUserGroups } from '../services/groupService.js';
import {
  deactivateCurrentUserPushToken,
  registerCurrentUserPushToken,
  sendChatMessagePushNotification
} from '../services/notificationService.js';
import { writeAuditEvent } from '../services/auditService.js';

const profileRouter = Router();

const orgAdminProfileBodySchema = z.object({
  adminFirstName: z.string().trim().min(2).max(80),
  adminLastName: z.string().trim().min(2).max(80),
  companyAddress: z.string().trim().min(5).max(240),
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

const devicePlatformSchema = z.enum(['android', 'ios', 'unknown', 'web']);

const deviceIdentityBodySchema = z.object({
  appInstallationId: z.string().trim().min(12).max(128),
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

const pushTokenBodySchema = z.object({
  deviceId: safeDeviceIdSchema,
  platform: devicePlatformSchema,
  provider: z.literal('expo'),
  token: z.string().trim().min(20).max(512)
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
  nonce: z.string().trim().min(8).max(256),
  recipientDeviceIds: z.array(safeDeviceIdSchema).min(1).max(50),
  senderDeviceId: safeDeviceIdSchema
});

const encryptedMediaUploadBodySchema = z.object({
  contentType: z.string().trim().min(3).max(120),
  encryptedSizeBytes: z.number().int().min(1).max(120 * 1024 * 1024),
  fileName: z.string().trim().min(1).max(180),
  kind: z.enum(['audio', 'file', 'image', 'video']),
  originalSizeBytes: z.number().int().min(0).max(250 * 1024 * 1024).optional()
});

const chatMessageReactionBodySchema = z.object({
  emoji: z.string().trim().max(16)
});

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
    const contacts = await listCurrentUserChatContacts(decodedToken);

    res.json({ contacts });
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

profileRouter.get('/chat/conversations/:contactId/encrypted-messages', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const activeDevice = await requireActiveRegisteredDevice(req, decodedToken);
    const contactId = Array.isArray(req.params.contactId)
      ? req.params.contactId[0] || ''
      : req.params.contactId || '';
    const envelopes = await listEncryptedDirectEnvelopesForDevice(
      decodedToken,
      contactId,
      activeDevice.deviceId
    );
    const [contact, messageReactions] = await Promise.all([
      getDirectChatContact(decodedToken, contactId),
      getDirectChatMessageReactions(decodedToken, contactId)
    ]);

    res.json({ contact, envelopes, messageReactions });
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
    void sendChatMessagePushNotification({
      conversationId: envelope.conversationId,
      envelopeId: envelope.envelopeId,
      recipientUid: contactId,
      senderUid: decodedToken.uid,
      sentAt: envelope.sentAt,
      tenantId: envelope.tenantId
    }).catch((error) => {
      console.warn('Chat push notification failed:', error instanceof Error ? error.message : error);
    });

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

function getDeviceIdFromHeader(req: Request): string {
  const parsedDeviceId = safeDeviceIdSchema.safeParse(req.header('X-Synzapp-Device-Id') || '');

  if (!parsedDeviceId.success) {
    throw authorizationError('This device is not authorized.');
  }

  return parsedDeviceId.data;
}

function authorizationError(message: string): Error {
  const error = new Error(message);
  error.name = 'AuthorizationError';
  return error;
}

export { profileRouter };
