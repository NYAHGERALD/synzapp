import { Request, Router } from 'express';
import { getVerifiedDevice } from '../middleware/deviceBinding.js';
import { getDecodedTokenFromHeader as getDecodedToken } from '../middleware/requestAuth.js';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { z } from 'zod';
import {
  getAdminContactPolicyForCurrentUser,
  updateAdminContactPolicy
} from '../services/adminContactPolicyService.js';
import { verifyAppCheck } from '../middleware/appCheck.js';
import {
  createDepartment,
  createRole,
  listDepartments,
  listRoles
} from '../services/adminDirectoryService.js';
import {
  listRolePermissionCatalog,
  updateRolePermissions
} from '../services/rolePermissionService.js';
import {
  listTenantDevices,
  revokeTenantDevice
} from '../services/adminDeviceService.js';
import {
  getActionReminderPolicyForCurrentUser,
  updateActionReminderPolicy
} from '../services/actionReminderService.js';
import {
  cancelScheduledMessage,
  getScheduledMessagePolicyForCurrentUser,
  listTenantScheduledMessages,
  updateScheduledMessagePolicy
} from '../services/scheduledMessageService.js';
import { cleanupLegacyPlaintextChatMessages } from '../services/chatMaintenanceService.js';
import {
  getChatBackupPolicyForCurrentUser,
  updateChatBackupPolicy
} from '../services/chatBackupPolicyService.js';
import {
  decideRestoreRequestForAdmin,
  listRestoreRequestsForAdmin
} from '../services/chatBackupRestoreService.js';
import { listAuditEvents } from '../services/auditQueryService.js';
import {
  getChatOfflinePolicyForCurrentUser,
  updateChatOfflinePolicy
} from '../services/chatOfflinePolicyService.js';
import {
  getTenantAiPolicy,
  getTenantAiUsageDashboard,
  listTenantAiFeatureCatalog,
  updateTenantAiBudgetPolicy,
  updateTenantAiDepartmentPolicy,
  updateTenantAiEmployeePolicy,
  updateTenantAiFeaturePolicy,
  updateTenantCompanyAiPolicy
} from '../services/tenantAiPolicyService.js';
import {
  createTenantGroup,
  listTenantGroups
} from '../services/groupService.js';
import {
  getCompanyLogo,
  getCompanyProfile,
  updateCompanyLogo,
  updateCompanyProfile
} from '../services/companyProfileService.js';
import {
  getCompanyKeyResultsForAdmin,
  updateCompanyKeyResults
} from '../services/keyResultsService.js';
import {
  deleteOrganizationForTenantOwner,
  requestOrganizationDeletionChallenge
} from '../services/organizationDeletionService.js';
import {
  listDepartmentAdminPermissionCatalog,
  updateEmployeeDepartmentAdminPermissions
} from '../services/departmentAdminPermissionService.js';
import {
  getApprovedEmployeeProfilePhoto,
  inviteEmployeeContacts,
  listApprovedEmployees
} from '../services/employeeInviteService.js';
import {
  EmployeeLifecycleAction,
  updateEmployeeLifecycle
} from '../services/employeeLifecycleService.js';
import { updateEmployeeDepartmentAdminAssignment } from '../services/employeeDepartmentAdminService.js';
import {
  updateEmployeeCompanyRole,
  updateEmployeeOrgAdminRole
} from '../services/employeeRoleAssignmentService.js';
import { verifyActiveRegisteredDevice } from '../services/deviceIdentityService.js';
import { writeAuditEvent } from '../services/auditService.js';

const adminRouter = Router();

const tenantRecordBodySchema = z.object({
  description: z.string().trim().max(200).optional(),
  name: z.string().trim().min(2).max(80)
});

const tenantGroupBodySchema = z.object({
  departmentId: z.string().trim().min(2).max(120).nullable().optional(),
  description: z.string().trim().max(200).optional(),
  name: z.string().trim().min(2).max(80)
});

const inviteEmployeesBodySchema = z.object({
  contacts: z
    .array(z.object({
      displayName: z.string().trim().max(100).optional(),
      phoneNumber: z.string().trim().min(8).max(20)
    }))
    .min(1)
    .max(25),
  departmentId: z.string().trim().min(2).max(120),
  inviteAsOrgAdmin: z.boolean().optional(),
  roleId: z.string().trim().min(2).max(120)
});

const revokeDeviceBodySchema = z.object({
  reason: z.string().trim().max(160).optional()
});

const employeeLifecycleBodySchema = z.object({
  action: z.enum([
    'DEACTIVATE',
    'ARCHIVE',
    'DELETE',
    'ANONYMIZE',
    'PERMANENT_DELETE',
    'REMOVE_INVITE',
    'REACTIVATE'
  ]),
  reason: z.string().trim().max(160).optional()
});

const employeeRoleAssignmentBodySchema = z.object({
  roleId: z.string().trim().min(2).max(120)
});

const employeeOrgAdminBodySchema = z.object({
  grantOrgAdmin: z.boolean(),
  // Required when taking admin away: somebody has to land on an ordinary role.
  roleId: z.string().trim().min(2).max(120).optional()
});

const rolePermissionsBodySchema = z.object({
  permissions: z.array(z.string().trim().min(2).max(80)).max(20)
});

const departmentAdminAssignmentBodySchema = z.object({
  enabled: z.boolean()
});

const departmentAdminPermissionsBodySchema = z.object({
  permissions: z.array(z.string().trim().min(2).max(80)).max(20)
});

const legacyPlaintextCleanupBodySchema = z.object({
  limit: z.number().int().min(1).max(200).optional().default(100),
  mode: z.enum(['DELETE', 'DRY_RUN']).optional().default('DRY_RUN')
});

const auditEventQuerySchema = z.object({
  /** Comma separated, so a filter survives a URL without repeated keys. */
  actions: z.string().trim().max(2000).optional(),
  fromMs: z.coerce.number().int().nonnegative().optional(),
  startAfterId: z.string().trim().max(200).optional(),
  toMs: z.coerce.number().int().nonnegative().optional()
});
const chatBackupRestoreDecisionSchema = z.object({
  approve: z.boolean()
});
const chatBackupPolicyBodySchema = z.object({
  encryptedBackupsEnabled: z.boolean(),
  selfRestoreEnabled: z.boolean()
});

const chatOfflinePolicyBodySchema = z.object({
  cacheRetentionDays: z.number().int().min(1).max(365),
  fullMediaCacheBudgetBytes: z.number().int().min(256 * 1024 * 1024).max(5 * 1024 * 1024 * 1024),
  mediaLimitBytes: z.object({
    audio: z.number().int().min(1024 * 1024).max(64 * 1024 * 1024),
    file: z.number().int().min(1024 * 1024).max(500 * 1024 * 1024),
    image: z.number().int().min(1024 * 1024).max(250 * 1024 * 1024),
    video: z.number().int().min(1024 * 1024).max(1024 * 1024 * 1024)
  }).optional(),
  offlineMediaCacheAllowed: z.boolean(),
  purgeOnSignOut: z.boolean(),
  wifiOnlyMediaPrefetch: z.boolean()
});

/**
 * Stopping somebody's message needs a reason, because they are shown it.
 *
 * Validated again in the service, which is where the rule lives. This exists so
 * the request is refused at the edge with the same words, rather than reaching
 * a permission check first and failing for the wrong reason.
 */
const cancelScheduledMessageBodySchema = z.object({
  reason: z.string().trim().min(8).max(400)
});

const actionReminderPolicyBodySchema = z.object({
  escalateOverdueAfterHours: z.number().int().nullable(),
  firstReminderHour: z.number().int().min(0).max(23),
  frequency: z.enum(['OFF', 'ONCE', 'TWICE']),
  secondReminderHour: z.number().int().min(0).max(23),
  timeZone: z.string().trim().min(1).max(64),
  workingHoursEndHour: z.number().int().min(0).max(23),
  workingHoursStartHour: z.number().int().min(0).max(23)
});

const adminContactPolicyBodySchema = z.object({
  showAdminPhoneNumber: z.boolean()
});

const scheduledMessagePolicyBodySchema = z.object({
  adminVisibilityEnabled: z.boolean(),
  enabled: z.boolean(),
  maxDaysAhead: z.number().int().min(1).max(365),
  maxPendingPerUser: z.number().int().min(1).max(200)
});

const companyProfileBodySchema = z.object({
  calendarYearStartDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  companyAddress: z.string().trim().min(5).max(240),
  companyName: z.string().trim().min(2).max(120)
});

const companyLogoBodySchema = z.object({
  companyLogoDataUrl: z.string().min(32).max(1_500_000)
});

const keyResultUnitSchema = z.object({
  icon: z.string().trim().min(1).max(48),
  label: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).max(1_000_000_000).optional(),
  status: z.string().trim().max(24).optional(),
  suffix: z.string().trim().max(32).optional(),
  unitId: z.string().trim().regex(/^[A-Za-z0-9_-]{4,128}$/)
});

const keyResultMetricSchema = z.object({
  key: z.string().trim().max(160),
  metricId: z.string().trim().regex(/^[A-Za-z0-9_-]{4,128}$/),
  sortOrder: z.number().int().min(0).max(1_000_000_000).optional(),
  status: z.string().trim().max(24).optional(),
  unitId: z.string().trim().regex(/^[A-Za-z0-9_-]{4,128}$/),
  value: z.string().trim().max(80)
});

const keyResultGroupSchema = z.object({
  groupId: z.string().trim().regex(/^[A-Za-z0-9_-]{4,128}$/),
  metrics: z.array(keyResultMetricSchema).max(60).optional(),
  name: z.string().trim().max(120),
  sortOrder: z.number().int().min(0).max(1_000_000_000).optional(),
  status: z.string().trim().max(24).optional()
});

const keyResultsBodySchema = z.object({
  groups: z.array(keyResultGroupSchema).max(40).optional(),
  units: z.array(keyResultUnitSchema).max(40).optional()
});

const organizationDeletionBodySchema = z.object({
  challengeId: z.string().trim().min(8).max(80),
  confirmationText: z.string().trim().min(8).max(160)
});

const deviceIdParamSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{16,128}$/);
const aiFeatureIdParamSchema = z.enum([
  'chat_translation',
  'interpreter_realtime',
  'interpreter_segment_translation',
  'interpreter_spoken_summary',
  'interpreter_summary',
  'interpreter_transcript_audio',
  'interpreter_voice_preview',
  'lsw_ai',
  'rails_ai',
  'rca_ai'
]);
const aiMonthQuerySchema = z.object({
  month: z.string().trim().regex(/^\d{4}-\d{2}$/).optional()
});
const aiToggleBodySchema = z.object({
  enabled: z.boolean(),
  hardLimitEnabled: z.boolean().optional(),
  monthlyBudgetUsd: z.number().min(0).max(5_000_000).nullable().optional(),
  reason: z.string().trim().max(240).optional()
});
const aiBudgetBodySchema = z.object({
  hardLimitEnabled: z.boolean(),
  monthlyBudgetUsd: z.number().min(0).max(5_000_000).nullable(),
  softWarningPercent: z.number().int().min(50).max(100)
});
const aiScopeIdParamSchema = z.string().trim().min(2).max(160);

adminRouter.get('/company-profile', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const companyProfile = await getCompanyProfile(decodedToken);

    res.json({ companyProfile });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/company-profile', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const body = companyProfileBodySchema.parse(req.body);
    const companyProfile = await updateCompanyProfile(decodedToken, body);

    await writeAuditEvent({
      action: 'COMPANY_PROFILE_UPDATED',
      metadata: {
        calendarYearStartDate: companyProfile.calendarYearStartDate,
        companyName: companyProfile.companyName
      },
      req,
      status: 'SUCCESS',
      tenantId: companyProfile.tenantId,
      uid: decodedToken.uid
    });

    res.json({ companyProfile });
  } catch (error) {
    await writeAuditEvent({
      action: 'COMPANY_PROFILE_UPDATED',
      reason: error instanceof Error ? error.message : 'Company profile update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

adminRouter.get('/company-profile/logo', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const logo = await getCompanyLogo(decodedToken);
    const etag = `"${logo.cacheKey}"`;

    res.setHeader('Cache-Control', 'private, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('Content-Type', logo.contentType);
    res.setHeader('ETag', etag);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.header('If-None-Match') === etag) {
      res.status(304).end();
      return;
    }

    logo.file
      .createReadStream()
      .on('error', next)
      .pipe(res);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/company-profile/logo', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const body = companyLogoBodySchema.parse(req.body);
    const companyProfile = await updateCompanyLogo(decodedToken, body);

    await writeAuditEvent({
      action: 'COMPANY_LOGO_UPDATED',
      metadata: {
        companyName: companyProfile.companyName
      },
      req,
      status: 'SUCCESS',
      tenantId: companyProfile.tenantId,
      uid: decodedToken.uid
    });

    res.json({ companyProfile });
  } catch (error) {
    await writeAuditEvent({
      action: 'COMPANY_LOGO_UPDATED',
      reason: error instanceof Error ? error.message : 'Company logo update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

adminRouter.get('/key-results', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const keyResults = await getCompanyKeyResultsForAdmin(decodedToken);

    res.json({ keyResults });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/key-results', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const body = keyResultsBodySchema.parse(req.body);
    const keyResults = await updateCompanyKeyResults(decodedToken, body);

    await writeAuditEvent({
      action: 'COMPANY_KEY_RESULTS_UPDATED',
      metadata: {
        groupCount: keyResults.groups.length,
        unitCount: keyResults.units.length
      },
      req,
      status: 'SUCCESS',
      tenantId: decodedToken.tenantId as string | undefined,
      uid: decodedToken.uid
    });

    res.json({ keyResults });
  } catch (error) {
    await writeAuditEvent({
      action: 'COMPANY_KEY_RESULTS_UPDATED',
      reason: error instanceof Error ? error.message : 'Company key results update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

adminRouter.post('/organization-deletion/challenge', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const challenge = await requestOrganizationDeletionChallenge(decodedToken);

    await writeAuditEvent({
      action: 'ORGANIZATION_DELETION_CHALLENGE_CREATED',
      metadata: {
        challengeId: challenge.challengeId,
        expiresAt: challenge.expiresAt
      },
      req,
      status: 'SUCCESS',
      tenantId: challenge.tenantId,
      uid: decodedToken.uid
    });

    res.status(201).json({ challenge });
  } catch (error) {
    await writeAuditEvent({
      action: 'ORGANIZATION_DELETION_CHALLENGE_CREATED',
      reason: error instanceof Error ? error.message : 'Organization deletion challenge failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

adminRouter.post('/organization-deletion/confirm', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const body = organizationDeletionBodySchema.parse(req.body);
    const result = await deleteOrganizationForTenantOwner(decodedToken, body);

    await writeAuditEvent({
      action: 'ORGANIZATION_DELETED',
      metadata: {
        tenantId: result.tenantId,
        revokedUserCount: result.revokedUserCount
      },
      req,
      status: 'SUCCESS',
      uid: decodedToken.uid
    });

    res.json({ result });
  } catch (error) {
    await writeAuditEvent({
      action: 'ORGANIZATION_DELETED',
      reason: error instanceof Error ? error.message : 'Organization deletion failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

/**
 * Backup restore requests.
 *
 * A reinstalled device has no key and can only ask. Approving one hands that
 * device the key to somebody's whole chat history, so it is held to the same
 * bar as changing the backup policy: an org admin with `security.manage`. The
 * decision and the name behind it go to the audit log, because a restore nobody
 * can be asked about is not a control.
 */
/**
 * The audit log, read only.
 *
 * There is no companion route that deletes, edits or clears one of these, and
 * there must never be. An audit log an administrator can erase is a diary.
 * Events age out by retention policy and by nothing else.
 */
adminRouter.get('/audit-events', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const query = auditEventQuerySchema.parse(req.query);
    const page = await listAuditEvents(decodedToken, {
      actions: query.actions ? query.actions.split(',') : undefined,
      fromMs: query.fromMs ?? null,
      startAfterId: query.startAfterId,
      toMs: query.toMs ?? null
    });

    res.json(page);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/chat-backup/restore-requests', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const requests = await listRestoreRequestsForAdmin(decodedToken);

    res.json({ requests });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/chat-backup/restore-requests/:requestId/decide', verifyAppCheck, async (req, res, next) => {
  const requestId = String(req.params.requestId || '');

  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const body = chatBackupRestoreDecisionSchema.parse(req.body);
    const request = await decideRestoreRequestForAdmin(decodedToken, {
      approve: body.approve,
      requestId
    });

    await writeAuditEvent({
      action: body.approve ? 'CHAT_BACKUP_RESTORE_APPROVED' : 'CHAT_BACKUP_RESTORE_DENIED',
      metadata: {
        deviceId: request?.deviceId,
        requestId,
        subjectUid: request?.uid
      },
      req,
      status: 'SUCCESS',
      tenantId: decodedToken.tenantId as string | undefined,
      uid: decodedToken.uid
    });

    res.json({ request });
  } catch (error) {
    await writeAuditEvent({
      action: 'CHAT_BACKUP_RESTORE_APPROVED',
      metadata: { requestId },
      reason: error instanceof Error ? error.message : 'Backup restore decision failed',
      req,
      status: 'FAILED'
    });
    next(error);
  }
});

adminRouter.get('/chat-backup-policy', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const policy = await getChatBackupPolicyForCurrentUser(decodedToken);

    res.json({ policy });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/chat-backup-policy', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const body = chatBackupPolicyBodySchema.parse(req.body);
    const policy = await updateChatBackupPolicy(decodedToken, body);

    await writeAuditEvent({
      action: 'CHAT_BACKUP_POLICY_UPDATED',
      metadata: {
        adminApprovalRequired: policy.adminApprovalRequired,
        encryptedBackupsEnabled: policy.encryptedBackupsEnabled,
        selfRestoreEnabled: policy.selfRestoreEnabled
      },
      req,
      status: 'SUCCESS',
      tenantId: decodedToken.tenantId as string | undefined,
      uid: decodedToken.uid
    });

    res.json({ policy });
  } catch (error) {
    await writeAuditEvent({
      action: 'CHAT_BACKUP_POLICY_UPDATED',
      reason: error instanceof Error ? error.message : 'Chat backup policy update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

adminRouter.get('/chat-offline-policy', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const policy = await getChatOfflinePolicyForCurrentUser(decodedToken);

    res.json({ policy });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/chat-offline-policy', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const body = chatOfflinePolicyBodySchema.parse(req.body);
    const policy = await updateChatOfflinePolicy(decodedToken, body);

    await writeAuditEvent({
      action: 'CHAT_OFFLINE_POLICY_UPDATED',
      metadata: {
        cacheRetentionDays: policy.cacheRetentionDays,
        fullMediaCacheBudgetBytes: policy.fullMediaCacheBudgetBytes,
        mediaLimitBytes: policy.mediaLimitBytes,
        offlineMediaCacheAllowed: policy.offlineMediaCacheAllowed,
        purgeOnSignOut: policy.purgeOnSignOut,
        wifiOnlyMediaPrefetch: policy.wifiOnlyMediaPrefetch
      },
      req,
      status: 'SUCCESS',
      tenantId: decodedToken.tenantId as string | undefined,
      uid: decodedToken.uid
    });

    res.json({ policy });
  } catch (error) {
    await writeAuditEvent({
      action: 'CHAT_OFFLINE_POLICY_UPDATED',
      reason: error instanceof Error ? error.message : 'Offline chat policy update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

adminRouter.get('/action-reminder-policy', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const policy = await getActionReminderPolicyForCurrentUser(decodedToken);

    res.json({ policy });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/action-reminder-policy', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const body = actionReminderPolicyBodySchema.parse(req.body);
    const policy = await updateActionReminderPolicy(decodedToken, body);

    await writeAuditEvent({
      action: 'ACTION_REMINDER_POLICY_UPDATED',
      metadata: {
        escalateOverdueAfterHours: policy.escalateOverdueAfterHours ?? 'never',
        firstReminderHour: policy.firstReminderHour,
        frequency: policy.frequency,
        secondReminderHour: policy.secondReminderHour,
        timeZone: policy.timeZone,
        workingHours: `${policy.workingHoursStartHour}-${policy.workingHoursEndHour}`
      },
      req,
      status: 'SUCCESS',
      tenantId: decodedToken.tenantId as string | undefined,
      uid: decodedToken.uid
    });

    res.json({ policy });
  } catch (error) {
    await writeAuditEvent({
      action: 'ACTION_REMINDER_POLICY_UPDATED',
      reason: error instanceof Error ? error.message : 'Reminder policy update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

/**
 * Whether an admin's phone number reaches the people they look after.
 *
 * Read by anybody in the tenant, because the main menu asks for it on every
 * open; written only by an admin who may manage security. See section 4 of
 * SYNZAPP_MAIN_MENU_PLAN.md.
 */
adminRouter.get('/admin-contact-policy', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const policy = await getAdminContactPolicyForCurrentUser(decodedToken);

    res.json({ policy });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/admin-contact-policy', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const body = adminContactPolicyBodySchema.parse(req.body);
    const policy = await updateAdminContactPolicy(decodedToken, body);

    await writeAuditEvent({
      action: 'ADMIN_CONTACT_POLICY_UPDATED',
      metadata: {
        showAdminPhoneNumber: policy.showAdminPhoneNumber
      },
      req,
      status: 'SUCCESS',
      tenantId: decodedToken.tenantId as string | undefined,
      uid: decodedToken.uid
    });

    res.json({ policy });
  } catch (error) {
    await writeAuditEvent({
      action: 'ADMIN_CONTACT_POLICY_UPDATED',
      reason: error instanceof Error ? error.message : 'Admin contact policy update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

adminRouter.get('/scheduled-message-policy', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const policy = await getScheduledMessagePolicyForCurrentUser(decodedToken);

    res.json({ policy });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/scheduled-message-policy', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const body = scheduledMessagePolicyBodySchema.parse(req.body);
    const policy = await updateScheduledMessagePolicy(decodedToken, body);

    await writeAuditEvent({
      action: 'SCHEDULED_MESSAGE_POLICY_UPDATED',
      metadata: {
        adminVisibilityEnabled: policy.adminVisibilityEnabled,
        enabled: policy.enabled,
        maxDaysAhead: policy.maxDaysAhead,
        maxPendingPerUser: policy.maxPendingPerUser
      },
      req,
      status: 'SUCCESS',
      tenantId: decodedToken.tenantId as string | undefined,
      uid: decodedToken.uid
    });

    res.json({ policy });
  } catch (error) {
    await writeAuditEvent({
      action: 'SCHEDULED_MESSAGE_POLICY_UPDATED',
      reason: error instanceof Error ? error.message : 'Scheduled message policy update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

/**
 * What is waiting to be sent across the organization.
 *
 * Metadata only. The response type carries no ciphertext and no key material,
 * so an admin can see that a message is waiting, from whom and when — and
 * cannot read it. That distinction is the whole point of the feature, and it is
 * enforced by the shape of `TenantScheduledMessageResponse` rather than by
 * remembering to strip fields here.
 */
adminRouter.get('/scheduled-messages', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const scheduledMessages = await listTenantScheduledMessages(decodedToken);

    res.json({ scheduledMessages });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/scheduled-messages/:scheduledMessageId/cancel', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const scheduledMessageId = Array.isArray(req.params.scheduledMessageId)
      ? req.params.scheduledMessageId[0] || ''
      : req.params.scheduledMessageId || '';
    const body = cancelScheduledMessageBodySchema.parse(req.body);
    const scheduledMessage = await cancelScheduledMessage(decodedToken, scheduledMessageId, {
      asOrgAdmin: true,
      reason: body.reason
    });

    await writeAuditEvent({
      action: 'CHAT_MESSAGE_SCHEDULE_CANCELLED',
      metadata: {
        byOrgAdmin: true,
        conversationId: scheduledMessage.conversationId,
        // The reason is recorded because the audit answers "why", not only
        // "who". A stop nobody can account for later is the thing this whole
        // permission was written to avoid.
        reasonGiven: scheduledMessage.cancellationReason,
        scheduledMessageId: scheduledMessage.scheduledMessageId,
        senderUid: scheduledMessage.senderUid
      },
      req,
      status: 'SUCCESS',
      tenantId: decodedToken.tenantId as string | undefined,
      uid: decodedToken.uid
    });

    res.json({
      scheduledMessage: {
        scheduledMessageId: scheduledMessage.scheduledMessageId,
        status: scheduledMessage.status
      }
    });
  } catch (error) {
    // A refused attempt is recorded too. An admin reaching for somebody's
    // pending message and being turned away is exactly the event an audit log
    // exists to hold.
    await writeAuditEvent({
      action: 'CHAT_MESSAGE_SCHEDULE_CANCELLED',
      reason: error instanceof Error ? error.message : 'Scheduled message cancellation failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

/**
 * Reachable from a browser, deliberately, unlike every other admin route.
 *
 * Managing devices is the one job an administrator may have to do *because* a
 * phone is gone. Requiring a working registered phone meant the person who had
 * just lost theirs could not revoke it, and nobody could revoke anybody's from a
 * computer — the browser registers no device at all.
 *
 * Nothing is weakened by dropping it: `requireSecurityAdmin` inside the service
 * demands an active ORG_ADMIN holding `security.manage`, and refuses any device
 * outside the caller's own tenant. The device header never carried authority
 * here, only the assumption that an administrator is holding a phone.
 */
adminRouter.get('/devices', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const devices = await listTenantDevices(decodedToken);

    res.json({ devices });
  } catch (error) {
    next(error);
  }
});

/** Also reachable from a browser, for the reason given above. */
adminRouter.post('/devices/:deviceId/revoke', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const deviceId = deviceIdParamSchema.parse(
      Array.isArray(req.params.deviceId)
        ? req.params.deviceId[0] || ''
        : req.params.deviceId || ''
    );
    const body = revokeDeviceBodySchema.parse(req.body);
    const device = await revokeTenantDevice(decodedToken, deviceId, body.reason);

    await writeAuditEvent({
      action: 'DEVICE_REVOKED',
      metadata: {
        deviceId: device.deviceId,
        platform: device.platform,
        reason: device.revocationReason,
        targetUid: device.uid
      },
      req,
      status: 'SUCCESS',
      tenantId: device.tenantId,
      uid: decodedToken.uid
    });

    res.json({ device });
  } catch (error) {
    await writeAuditEvent({
      action: 'DEVICE_REVOKED',
      reason: error instanceof Error ? error.message : 'Device revocation failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

adminRouter.post('/chat/legacy-plaintext-cleanup', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const body = legacyPlaintextCleanupBodySchema.parse(req.body);
    const result = await cleanupLegacyPlaintextChatMessages(decodedToken, body);

    await writeAuditEvent({
      action: 'LEGACY_PLAINTEXT_CHAT_CLEANUP',
      metadata: { ...result },
      req,
      status: 'SUCCESS',
      tenantId: result.tenantId,
      uid: decodedToken.uid
    });

    res.json({ result });
  } catch (error) {
    await writeAuditEvent({
      action: 'LEGACY_PLAINTEXT_CHAT_CLEANUP',
      reason: error instanceof Error ? error.message : 'Legacy plaintext cleanup failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

adminRouter.get('/groups', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const groups = await listTenantGroups(decodedToken);

    res.json({ groups });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/groups', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const body = tenantGroupBodySchema.parse(req.body);
    const result = await createTenantGroup(decodedToken, body);

    await writeAuditEvent({
      action: 'GROUP_CREATED',
      metadata: {
        departmentId: result.group.departmentId,
        groupId: result.group.groupId,
        name: result.group.name,
        scope: result.group.scope
      },
      req,
      status: 'SUCCESS',
      tenantId: result.tenantId,
      uid: decodedToken.uid
    });

    res.status(201).json({ group: result.group });
  } catch (error) {
    await writeAuditEvent({
      action: 'GROUP_CREATED',
      reason: error instanceof Error ? error.message : 'Group creation failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

adminRouter.get('/departments', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const departments = await listDepartments(decodedToken);

    res.json({ departments });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/departments', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const body = tenantRecordBodySchema.parse(req.body);
    const department = await createDepartment(decodedToken, body);

    await writeAuditEvent({
      action: 'DEPARTMENT_CREATED',
      metadata: {
        departmentId: department.departmentId,
        name: department.name
      },
      req,
      status: 'SUCCESS',
      tenantId: department.tenantId,
      uid: decodedToken.uid
    });

    res.status(201).json({ department });
  } catch (error) {
    await writeAuditEvent({
      action: 'DEPARTMENT_CREATED',
      reason: error instanceof Error ? error.message : 'Department creation failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

adminRouter.get('/roles', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const roles = await listRoles(decodedToken);

    res.json({ roles });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/role-permissions', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const permissions = await listRolePermissionCatalog(decodedToken);

    res.json({ permissions });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/department-admin-permissions', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const permissions = await listDepartmentAdminPermissionCatalog(decodedToken);

    res.json({ permissions });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/roles', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const body = tenantRecordBodySchema.parse(req.body);
    const role = await createRole(decodedToken, body);

    await writeAuditEvent({
      action: 'ROLE_CREATED',
      metadata: {
        name: role.name,
        roleId: role.roleId
      },
      req,
      status: 'SUCCESS',
      tenantId: role.tenantId,
      uid: decodedToken.uid
    });

    res.status(201).json({ role });
  } catch (error) {
    await writeAuditEvent({
      action: 'ROLE_CREATED',
      reason: error instanceof Error ? error.message : 'Role creation failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

adminRouter.patch('/roles/:roleId/permissions', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const roleId = Array.isArray(req.params.roleId)
      ? req.params.roleId[0] || ''
      : req.params.roleId || '';
    const body = rolePermissionsBodySchema.parse(req.body);
    const result = await updateRolePermissions(decodedToken, roleId, body.permissions);

    await writeAuditEvent({
      action: 'ROLE_PERMISSIONS_UPDATED',
      metadata: {
        permissions: result.role.permissions,
        roleId: result.role.roleId,
        roleName: result.role.name,
        updatedEmployeeCount: result.updatedEmployeeCount,
        updatedUserCount: result.updatedUserCount
      },
      req,
      status: 'SUCCESS',
      tenantId: result.tenantId,
      uid: decodedToken.uid
    });

    res.json({ role: result.role });
  } catch (error) {
    await writeAuditEvent({
      action: 'ROLE_PERMISSIONS_UPDATED',
      reason: error instanceof Error ? error.message : 'Role permission update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

adminRouter.get('/employees', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const employees = await listApprovedEmployees(decodedToken);

    res.json({ employees });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/employees/:approvedPhoneId/photo', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const approvedPhoneId = Array.isArray(req.params.approvedPhoneId)
      ? req.params.approvedPhoneId[0] || ''
      : req.params.approvedPhoneId || '';
    const profilePhoto = await getApprovedEmployeeProfilePhoto(
      decodedToken,
      approvedPhoneId
    );
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

adminRouter.post('/employees/invite', verifyAppCheck, async (req, res, next) => {
  // Hoisted so a refusal can be attributed. A refused attempt to grant
  // organization admin is exactly the event a tenant needs to see, and an audit
  // record with no uid and no tenant never reaches their console at all.
  let auditToken: Awaited<ReturnType<typeof getDecodedToken>> | null = null;

  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');

    auditToken = decodedToken;
    await requireActiveRegisteredDevice(req, decodedToken);
    const body = inviteEmployeesBodySchema.parse(req.body);
    const employees = await inviteEmployeeContacts(decodedToken, body);

    await writeAuditEvent({
      action: 'EMPLOYEE_INVITES_CREATED',
      metadata: {
        departmentId: body.departmentId,
        employeeCount: employees.length,
        // The role actually granted, not only the one that was asked for. The
        // two used to differ silently, so the log read "invited as Forklift
        // Operator" for somebody who had just been made an organization admin.
        grantedPermissions: employees[0]?.permissions || [],
        grantedRole: employees[0]?.role || 'EMPLOYEE',
        grantedRoleName: employees[0]?.roleName || null,
        // Who received it. A count cannot answer "who was made an admin", and
        // every sibling employee route already names its subject.
        invitedApprovedPhoneIds: employees.map((employee) => employee.approvedPhoneId),
        invitedPhonesMasked: employees.map((employee) => employee.phoneMasked),
        orgAdminGrantRequested: Boolean(body.inviteAsOrgAdmin),
        roleId: body.roleId
      },
      req,
      status: 'SUCCESS',
      tenantId: employees[0]?.tenantId,
      uid: decodedToken.uid
      // The invite has already committed. A failure writing the record of it
      // must not reach the catch below and report the grant as refused — but it
      // must not disappear either, or a grant lands with no record anywhere.
    }).catch((error) => {
      console.error('[SynzappInvite] could not write the invite audit event', {
        error,
        tenantId: employees[0]?.tenantId,
        uid: decodedToken.uid
      });
    });

    res.status(201).json({ employees });
  } catch (error) {
    await writeAuditEvent({
      action: 'EMPLOYEE_INVITES_CREATED',
      metadata: {
        orgAdminGrantRequested: Boolean((req.body as { inviteAsOrgAdmin?: unknown } | undefined)?.inviteAsOrgAdmin)
      },
      reason: error instanceof Error ? error.message : 'Employee invite failed',
      req,
      status: 'FAILED',
      tenantId: auditToken?.tenantId as string | undefined,
      uid: auditToken?.uid
    }).catch(() => undefined);

    next(error);
  }
});

adminRouter.patch('/employees/:approvedPhoneId/lifecycle', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const approvedPhoneId = Array.isArray(req.params.approvedPhoneId)
      ? req.params.approvedPhoneId[0] || ''
      : req.params.approvedPhoneId || '';
    const body = employeeLifecycleBodySchema.parse(req.body);
    const result = await updateEmployeeLifecycle(
      decodedToken,
      approvedPhoneId,
      body.action as EmployeeLifecycleAction,
      body.reason
    );

    await writeAuditEvent({
      action: getEmployeeLifecycleAuditAction(body.action as EmployeeLifecycleAction),
      metadata: {
        approvedPhoneId: result.employee.approvedPhoneId,
        employeeUid: result.employeeUid,
        reason: body.reason || null,
        status: result.employee.status
      },
      req,
      status: 'SUCCESS',
      tenantId: result.tenantId,
      uid: decodedToken.uid
    });

    res.json({ employee: result.employee });
  } catch (error) {
    await writeAuditEvent({
      action: 'EMPLOYEE_LIFECYCLE_UPDATED',
      reason: error instanceof Error ? error.message : 'Employee lifecycle update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

adminRouter.patch('/employees/:approvedPhoneId/role', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const approvedPhoneId = Array.isArray(req.params.approvedPhoneId)
      ? req.params.approvedPhoneId[0] || ''
      : req.params.approvedPhoneId || '';
    const body = employeeRoleAssignmentBodySchema.parse(req.body);
    const result = await updateEmployeeCompanyRole(
      decodedToken,
      approvedPhoneId,
      body.roleId
    );

    await writeAuditEvent({
      action: 'EMPLOYEE_ROLE_CHANGED',
      metadata: {
        approvedPhoneId: result.employee.approvedPhoneId,
        employeeUid: result.employeeUid,
        roleId: result.employee.roleId,
        roleName: result.employee.roleName,
        status: result.employee.status
      },
      req,
      status: 'SUCCESS',
      tenantId: result.tenantId,
      uid: decodedToken.uid
    });

    res.json({ employee: result.employee });
  } catch (error) {
    await writeAuditEvent({
      action: 'EMPLOYEE_ROLE_CHANGED',
      reason: error instanceof Error ? error.message : 'Employee role update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

adminRouter.patch('/employees/:approvedPhoneId/org-admin', verifyAppCheck, async (req, res, next) => {
  // Hoisted so a refusal can be attributed. An attempt to hand out or take away
  // organization admin is precisely what a tenant needs to see in their own log.
  let auditToken: Awaited<ReturnType<typeof getDecodedToken>> | null = null;

  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');

    auditToken = decodedToken;
    await requireActiveRegisteredDevice(req, decodedToken);

    const approvedPhoneId = Array.isArray(req.params.approvedPhoneId)
      ? req.params.approvedPhoneId[0] || ''
      : req.params.approvedPhoneId || '';
    const body = employeeOrgAdminBodySchema.parse(req.body);
    const result = await updateEmployeeOrgAdminRole(decodedToken, approvedPhoneId, {
      grantOrgAdmin: body.grantOrgAdmin,
      roleId: body.roleId
    });

    await writeAuditEvent({
      action: 'EMPLOYEE_ORG_ADMIN_CHANGED',
      metadata: {
        approvedPhoneId: result.employee.approvedPhoneId,
        employeeUid: result.employeeUid,
        // The role and permissions actually held afterwards, so the trail can be
        // read without knowing what the request asked for.
        grantedPermissions: result.employee.permissions,
        grantedRole: result.employee.role,
        grantedRoleName: result.employee.roleName,
        orgAdminGranted: body.grantOrgAdmin,
        phoneMasked: result.employee.phoneMasked,
        status: result.employee.status
      },
      req,
      status: 'SUCCESS',
      tenantId: result.tenantId,
      uid: decodedToken.uid
    }).catch((error) => {
      console.error('[SynzappOrgAdmin] could not write the role change audit event', {
        error,
        tenantId: result.tenantId,
        uid: decodedToken.uid
      });
    });

    res.json({ employee: result.employee });
  } catch (error) {
    await writeAuditEvent({
      action: 'EMPLOYEE_ORG_ADMIN_CHANGED',
      metadata: {
        orgAdminGranted: Boolean((req.body as { grantOrgAdmin?: unknown } | undefined)?.grantOrgAdmin)
      },
      reason: error instanceof Error ? error.message : 'Organization admin change failed',
      req,
      status: 'FAILED',
      tenantId: auditToken?.tenantId as string | undefined,
      uid: auditToken?.uid
    }).catch(() => undefined);

    next(error);
  }
});

adminRouter.patch('/employees/:approvedPhoneId/department-admin', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const approvedPhoneId = Array.isArray(req.params.approvedPhoneId)
      ? req.params.approvedPhoneId[0] || ''
      : req.params.approvedPhoneId || '';
    const body = departmentAdminAssignmentBodySchema.parse(req.body);
    const result = await updateEmployeeDepartmentAdminAssignment(
      decodedToken,
      approvedPhoneId,
      body.enabled
    );

    await writeAuditEvent({
      action: body.enabled ? 'DEPARTMENT_ADMIN_ASSIGNED' : 'DEPARTMENT_ADMIN_REMOVED',
      metadata: {
        approvedPhoneId: result.employee.approvedPhoneId,
        departmentId: result.employee.departmentId,
        employeeUid: result.employeeUid,
        role: result.employee.role,
        status: result.employee.status
      },
      req,
      status: 'SUCCESS',
      tenantId: result.tenantId,
      uid: decodedToken.uid
    });

    res.json({ employee: result.employee });
  } catch (error) {
    await writeAuditEvent({
      action: 'DEPARTMENT_ADMIN_ASSIGNMENT_UPDATED',
      reason: error instanceof Error ? error.message : 'Department admin assignment failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

adminRouter.patch('/employees/:approvedPhoneId/department-admin-permissions', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const approvedPhoneId = Array.isArray(req.params.approvedPhoneId)
      ? req.params.approvedPhoneId[0] || ''
      : req.params.approvedPhoneId || '';
    const body = departmentAdminPermissionsBodySchema.parse(req.body);
    const result = await updateEmployeeDepartmentAdminPermissions(
      decodedToken,
      approvedPhoneId,
      body.permissions
    );

    await writeAuditEvent({
      action: 'DEPARTMENT_ADMIN_PERMISSIONS_UPDATED',
      metadata: {
        approvedPhoneId: result.employee.approvedPhoneId,
        departmentId: result.employee.departmentId,
        employeeUid: result.employeeUid,
        permissions: result.permissions
      },
      req,
      status: 'SUCCESS',
      tenantId: result.tenantId,
      uid: decodedToken.uid
    });

    res.json({ employee: result.employee });
  } catch (error) {
    await writeAuditEvent({
      action: 'DEPARTMENT_ADMIN_PERMISSIONS_UPDATED',
      reason: error instanceof Error ? error.message : 'Department admin permission update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

adminRouter.get('/ai-usage/summary', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const query = aiMonthQuerySchema.parse(req.query);
    const dashboard = await getTenantAiUsageDashboard({
      decodedToken,
      month: query.month
    });

    res.json({ dashboard });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/ai-policy', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const [policy, features] = await Promise.all([
      getTenantAiPolicy(decodedToken),
      Promise.resolve(listTenantAiFeatureCatalog())
    ]);

    res.json({ features, policy });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/ai-policy/company', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const body = aiToggleBodySchema.parse(req.body);
    const policy = await updateTenantCompanyAiPolicy({
      decodedToken,
      enabled: body.enabled,
      reason: body.reason
    });

    await writeAuditEvent({
      action: body.enabled ? 'TENANT_AI_ENABLED' : 'TENANT_AI_DISABLED',
      metadata: {
        reason: body.reason || null
      },
      req,
      status: 'SUCCESS',
      tenantId: policy.tenantId,
      uid: decodedToken.uid
    });

    res.json({ policy });
  } catch (error) {
    await writeAuditEvent({
      action: 'TENANT_AI_POLICY_UPDATED',
      reason: error instanceof Error ? error.message : 'AI company policy update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

adminRouter.patch('/ai-policy/budget', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const body = aiBudgetBodySchema.parse(req.body);
    const policy = await updateTenantAiBudgetPolicy({
      decodedToken,
      hardLimitEnabled: body.hardLimitEnabled,
      monthlyBudgetUsd: body.monthlyBudgetUsd,
      softWarningPercent: body.softWarningPercent
    });

    await writeAuditEvent({
      action: 'TENANT_AI_BUDGET_UPDATED',
      metadata: {
        hardLimitEnabled: body.hardLimitEnabled,
        monthlyBudgetUsd: body.monthlyBudgetUsd,
        softWarningPercent: body.softWarningPercent
      },
      req,
      status: 'SUCCESS',
      tenantId: policy.tenantId,
      uid: decodedToken.uid
    });

    res.json({ policy });
  } catch (error) {
    await writeAuditEvent({
      action: 'TENANT_AI_BUDGET_UPDATED',
      reason: error instanceof Error ? error.message : 'AI budget policy update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

adminRouter.patch('/ai-policy/features/:featureId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const featureId = aiFeatureIdParamSchema.parse(req.params.featureId);
    const body = aiToggleBodySchema.parse(req.body);
    const policy = await updateTenantAiFeaturePolicy({
      decodedToken,
      enabled: body.enabled,
      featureId,
      hardLimitEnabled: body.hardLimitEnabled,
      monthlyBudgetUsd: body.monthlyBudgetUsd
    });

    await writeAuditEvent({
      action: body.enabled ? 'TENANT_AI_FEATURE_ENABLED' : 'TENANT_AI_FEATURE_DISABLED',
      metadata: { featureId },
      req,
      status: 'SUCCESS',
      tenantId: policy.tenantId,
      uid: decodedToken.uid
    });

    res.json({ policy });
  } catch (error) {
    await writeAuditEvent({
      action: 'TENANT_AI_FEATURE_POLICY_UPDATED',
      reason: error instanceof Error ? error.message : 'AI feature policy update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

adminRouter.patch('/ai-policy/departments/:departmentId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const departmentId = aiScopeIdParamSchema.parse(req.params.departmentId);
    const body = aiToggleBodySchema.parse(req.body);
    const policy = await updateTenantAiDepartmentPolicy({
      decodedToken,
      departmentId,
      enabled: body.enabled,
      hardLimitEnabled: body.hardLimitEnabled,
      monthlyBudgetUsd: body.monthlyBudgetUsd
    });

    await writeAuditEvent({
      action: body.enabled ? 'TENANT_AI_DEPARTMENT_ENABLED' : 'TENANT_AI_DEPARTMENT_DISABLED',
      metadata: { departmentId },
      req,
      status: 'SUCCESS',
      tenantId: policy.tenantId,
      uid: decodedToken.uid
    });

    res.json({ policy });
  } catch (error) {
    await writeAuditEvent({
      action: 'TENANT_AI_DEPARTMENT_POLICY_UPDATED',
      reason: error instanceof Error ? error.message : 'AI department policy update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

adminRouter.patch('/ai-policy/employees/:employeeUid', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const employeeUid = aiScopeIdParamSchema.parse(req.params.employeeUid);
    const body = aiToggleBodySchema.parse(req.body);
    const policy = await updateTenantAiEmployeePolicy({
      decodedToken,
      employeeUid,
      enabled: body.enabled,
      hardLimitEnabled: body.hardLimitEnabled,
      monthlyBudgetUsd: body.monthlyBudgetUsd
    });

    await writeAuditEvent({
      action: body.enabled ? 'TENANT_AI_EMPLOYEE_ENABLED' : 'TENANT_AI_EMPLOYEE_DISABLED',
      metadata: { employeeUid },
      req,
      status: 'SUCCESS',
      tenantId: policy.tenantId,
      uid: decodedToken.uid
    });

    res.json({ policy });
  } catch (error) {
    await writeAuditEvent({
      action: 'TENANT_AI_EMPLOYEE_POLICY_UPDATED',
      reason: error instanceof Error ? error.message : 'AI employee policy update failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});


async function requireActiveRegisteredDevice(req: Request, decodedToken: DecodedIdToken) {
  const parsedDeviceId = deviceIdParamSchema.safeParse(req.header('X-Synzapp-Device-Id') || '');

  if (!parsedDeviceId.success) {
    throw authorizationError('This device is not authorized.');
  }

  // enforceDeviceBinding already proved this device for this request, and
  // proving it again is not free: each check stamps lastSeenAt on two
  // documents.
  const alreadyVerified = getVerifiedDevice(req, parsedDeviceId.data);

  return alreadyVerified || verifyActiveRegisteredDevice(decodedToken, parsedDeviceId.data);
}

function authorizationError(message: string): Error {
  const error = new Error(message);
  error.name = 'AuthorizationError';
  return error;
}

function getEmployeeLifecycleAuditAction(action: EmployeeLifecycleAction): string {
  if (action === 'DEACTIVATE') {
    return 'EMPLOYEE_DEACTIVATED';
  }

  if (action === 'REACTIVATE') {
    return 'EMPLOYEE_REACTIVATED';
  }

  if (action === 'ARCHIVE') {
    return 'EMPLOYEE_ARCHIVED';
  }

  if (action === 'DELETE') {
    return 'EMPLOYEE_DELETED';
  }

  if (action === 'PERMANENT_DELETE') {
    return 'EMPLOYEE_PERMANENTLY_REMOVED';
  }

  if (action === 'REMOVE_INVITE') {
    return 'EMPLOYEE_INVITE_REMOVED';
  }

  return 'EMPLOYEE_ANONYMIZED';
}

export { adminRouter };
