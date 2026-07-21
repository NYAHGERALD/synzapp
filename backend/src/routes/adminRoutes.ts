import { Request, Router } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { z } from 'zod';
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
import { cleanupLegacyPlaintextChatMessages } from '../services/chatMaintenanceService.js';
import {
  getChatBackupPolicyForCurrentUser,
  updateChatBackupPolicy
} from '../services/chatBackupPolicyService.js';
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
import { updateEmployeeCompanyRole } from '../services/employeeRoleAssignmentService.js';
import { verifyFirebaseSession } from '../services/authSessionService.js';
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

const chatBackupPolicyBodySchema = z.object({
  encryptedBackupsEnabled: z.boolean(),
  selfRestoreEnabled: z.boolean()
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

adminRouter.get('/devices', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const devices = await listTenantDevices(decodedToken);

    res.json({ devices });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/devices/:deviceId/revoke', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
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
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    await requireActiveRegisteredDevice(req, decodedToken);
    const body = inviteEmployeesBodySchema.parse(req.body);
    const employees = await inviteEmployeeContacts(decodedToken, body);

    await writeAuditEvent({
      action: 'EMPLOYEE_INVITES_CREATED',
      metadata: {
        departmentId: body.departmentId,
        employeeCount: employees.length,
        roleId: body.roleId
      },
      req,
      status: 'SUCCESS',
      tenantId: employees[0]?.tenantId,
      uid: decodedToken.uid
    });

    res.status(201).json({ employees });
  } catch (error) {
    await writeAuditEvent({
      action: 'EMPLOYEE_INVITES_CREATED',
      reason: error instanceof Error ? error.message : 'Employee invite failed',
      req,
      status: 'FAILED'
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
  const parsedDeviceId = deviceIdParamSchema.safeParse(req.header('X-Synzapp-Device-Id') || '');

  if (!parsedDeviceId.success) {
    throw authorizationError('This device is not authorized.');
  }

  return verifyActiveRegisteredDevice(decodedToken, parsedDeviceId.data);
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
