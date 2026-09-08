import { DecodedIdToken } from 'firebase-admin/auth';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import {
  canOrgAdminUsePermission,
  isActiveTenantSession
} from './authorizationPolicy.js';
import { buildAuthSession } from './authSessionService.js';

export interface ChatBackupPolicyResponse {
  adminApprovalRequired: boolean;
  encryptedBackupsEnabled: boolean;
  recoveryKeyRequired: boolean;
  selfRestoreEnabled: boolean;
  updatedAt: string | null;
  updatedByUid: string | null;
}

export interface UpdateChatBackupPolicyInput {
  encryptedBackupsEnabled: boolean;
  selfRestoreEnabled: boolean;
}

interface OrganizationRecord {
  chatBackupPolicy?: Partial<ChatBackupPolicyRecord>;
  status?: string;
}

interface TenantUserRecord {
  status?: string;
}

interface ChatBackupPolicyRecord {
  adminApprovalRequired?: boolean;
  encryptedBackupsEnabled?: boolean;
  recoveryKeyRequired?: boolean;
  selfRestoreEnabled?: boolean;
  updatedAt?: FirebaseDateLike;
  updatedByUid?: string | null;
}

interface FirebaseDateLike {
  toMillis?: () => number;
  seconds?: number;
}

export const DEFAULT_CHAT_BACKUP_POLICY: ChatBackupPolicyResponse = {
  adminApprovalRequired: true,
  encryptedBackupsEnabled: false,
  recoveryKeyRequired: true,
  selfRestoreEnabled: false,
  updatedAt: null,
  updatedByUid: null
};

export async function getChatBackupPolicyForCurrentUser(
  decodedToken: DecodedIdToken
): Promise<ChatBackupPolicyResponse> {
  const context = await getActiveTenantUserContext(decodedToken);
  const organizationSnapshot = await firestore.collection('organizations').doc(context.tenantId).get();

  if (!organizationSnapshot.exists) {
    throw authorizationError('Your profile is not active.');
  }

  const organization = organizationSnapshot.data() as OrganizationRecord;

  if (organization.status !== 'ACTIVE') {
    throw authorizationError('Your profile is not active.');
  }

  return mapChatBackupPolicy(organization.chatBackupPolicy);
}

export async function updateChatBackupPolicy(
  decodedToken: DecodedIdToken,
  input: UpdateChatBackupPolicyInput
): Promise<ChatBackupPolicyResponse> {
  const context = await requireSecurityAdmin(decodedToken);
  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const encryptedBackupsEnabled = input.encryptedBackupsEnabled;
  const selfRestoreEnabled = encryptedBackupsEnabled && input.selfRestoreEnabled;

  await organizationRef.set({
    chatBackupPolicy: {
      adminApprovalRequired: !selfRestoreEnabled,
      encryptedBackupsEnabled,
      recoveryKeyRequired: true,
      selfRestoreEnabled,
      updatedAt: fieldValue.serverTimestamp(),
      updatedByUid: decodedToken.uid
    },
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });

  const refreshedSnapshot = await organizationRef.get();
  const organization = refreshedSnapshot.data() as OrganizationRecord | undefined;

  return mapChatBackupPolicy(organization?.chatBackupPolicy);
}

export async function assertChatBackupOperationAllowed(
  decodedToken: DecodedIdToken,
  operation: 'RESTORE' | 'UPLOAD'
): Promise<{ policy: ChatBackupPolicyResponse; tenantId: string }> {
  const context = await getActiveTenantUserContext(decodedToken);
  const organizationSnapshot = await firestore.collection('organizations').doc(context.tenantId).get();

  if (!organizationSnapshot.exists) {
    throw authorizationError('Your profile is not active.');
  }

  const organization = organizationSnapshot.data() as OrganizationRecord;

  if (organization.status !== 'ACTIVE') {
    throw authorizationError('Your profile is not active.');
  }

  const policy = mapChatBackupPolicy(organization.chatBackupPolicy);

  if (!policy.encryptedBackupsEnabled) {
    throw authorizationError('Encrypted chat backup is disabled by your organization.');
  }

  if (operation === 'RESTORE' && !policy.selfRestoreEnabled) {
    throw authorizationError('Encrypted chat restore requires organization approval.');
  }

  return {
    policy,
    tenantId: context.tenantId
  };
}

async function getActiveTenantUserContext(decodedToken: DecodedIdToken): Promise<{ tenantId: string }> {
  const session = await buildAuthSession(decodedToken);
  const { status, tenantId } = session.user;

  if (session.access !== 'ACTIVE' || status !== 'ACTIVE' || !tenantId) {
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
  const user = userSnapshot.data() as TenantUserRecord;

  if (organization.status !== 'ACTIVE' || user.status !== 'ACTIVE') {
    throw authorizationError('Your profile is not active.');
  }

  return { tenantId };
}

async function requireSecurityAdmin(decodedToken: DecodedIdToken): Promise<{ tenantId: string }> {
  const session = await buildAuthSession(decodedToken);
  const { permissions, role, status, tenantId } = session.user;
  const policyInput = {
    access: session.access,
    permissions,
    role,
    status,
    tenantId
  };

  if (!isActiveTenantSession(policyInput)) {
    throw authorizationError('Your admin session is not active.');
  }

  if (!canOrgAdminUsePermission(policyInput, 'security.manage')) {
    throw authorizationError('You do not have permission to manage security settings.');
  }

  return { tenantId: tenantId as string };
}

/**
 * The policy an organization has, and what it means when it has never set one.
 *
 * **Both are on unless somebody turned them off.** They used to be off unless
 * somebody turned them on, and no organization ever had a policy written until
 * an admin opened the screen and saved one — so the ordinary state of a live
 * tenant was backups disabled and self-restore disabled, silently.
 *
 * That is the wrong way round. An employee who reinstalls their app expects
 * their history back; losing it is the surprising outcome, and it should not be
 * what happens to an organization that never went looking for a setting. An
 * organization that wants it off can still turn it off, and that choice is
 * stored and respected.
 */
function mapChatBackupPolicy(policy?: Partial<ChatBackupPolicyRecord>): ChatBackupPolicyResponse {
  const encryptedBackupsEnabled = policy?.encryptedBackupsEnabled !== false;
  const selfRestoreEnabled = encryptedBackupsEnabled && policy?.selfRestoreEnabled !== false;

  return {
    adminApprovalRequired: policy?.adminApprovalRequired ?? !selfRestoreEnabled,
    encryptedBackupsEnabled,
    recoveryKeyRequired: policy?.recoveryKeyRequired !== false,
    selfRestoreEnabled,
    updatedAt: dateLikeToIso(policy?.updatedAt),
    updatedByUid: policy?.updatedByUid || null
  };
}

function dateLikeToIso(dateLike?: FirebaseDateLike): string | null {
  const milliseconds = dateLike?.toMillis?.() || ((dateLike?.seconds || 0) * 1000);

  if (!milliseconds) {
    return null;
  }

  return new Date(milliseconds).toISOString();
}

function authorizationError(message: string): Error {
  const error = new Error(message);
  error.name = 'AuthorizationError';
  return error;
}
