import { DecodedIdToken } from 'firebase-admin/auth';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import { SynzappRole } from '../types/auth.js';
import { buildAuthSession } from './authSessionService.js';

interface TenantAdminContext {
  permissions: string[];
  role?: string;
  tenantId: string;
  uid: string;
}

interface DeviceKeyRecord {
  appInstallationId?: string;
  createdAt?: FirebaseDateLike;
  cryptoProvider?: string;
  deviceId?: string;
  keyVersion?: number;
  lastSeenAt?: FirebaseDateLike;
  platform?: string;
  protocolVersion?: string;
  revokedAt?: FirebaseDateLike;
  revokedByUid?: string;
  revocationReason?: string | null;
  status?: string;
  tenantId?: string;
  uid?: string;
  updatedAt?: FirebaseDateLike;
}

interface FirebaseDateLike {
  toMillis?: () => number;
  seconds?: number;
}

interface TenantUserRecord {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  role?: SynzappRole;
  roleName?: string;
  status?: string;
}

export interface TenantDeviceResponse {
  createdAt: string | null;
  cryptoProvider: string;
  deviceId: string;
  displayName: string;
  keyVersion: number;
  lastSeenAt: string | null;
  platform: string;
  protocolVersion: string;
  revokedAt: string | null;
  revokedByUid: string | null;
  revocationReason: string | null;
  roleName: string;
  status: string;
  tenantId: string;
  uid: string;
}

export async function listTenantDevices(decodedToken: DecodedIdToken): Promise<TenantDeviceResponse[]> {
  const context = await requireSecurityAdmin(decodedToken);
  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const devicesSnapshot = await organizationRef.collection('deviceKeys').get();
  const userIds = Array.from(new Set(devicesSnapshot.docs
    .map((doc) => (doc.data() as DeviceKeyRecord).uid)
    .filter((uid): uid is string => Boolean(uid))));
  const users = await getTenantUsersById(context.tenantId, userIds);
  const devices = devicesSnapshot.docs.map((doc) => {
    const record = doc.data() as DeviceKeyRecord;
    const uid = record.uid || '';
    const user = users.get(uid);

    return mapTenantDevice(record, doc.id, user);
  });

  return devices.sort((first, second) => {
    const firstTime = first.lastSeenAt || first.createdAt || '';
    const secondTime = second.lastSeenAt || second.createdAt || '';

    return secondTime.localeCompare(firstTime);
  });
}

export async function revokeTenantDevice(
  decodedToken: DecodedIdToken,
  deviceId: string,
  reason?: string
): Promise<TenantDeviceResponse> {
  const context = await requireSecurityAdmin(decodedToken);
  const safeDeviceId = deviceId.trim();
  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const tenantDeviceKeyRef = organizationRef.collection('deviceKeys').doc(safeDeviceId);
  const cleanReason = reason?.trim() || null;
  let targetUid = '';

  await firestore.runTransaction(async (transaction) => {
    const tenantDeviceSnapshot = await transaction.get(tenantDeviceKeyRef);

    if (!tenantDeviceSnapshot.exists) {
      throw notFoundError('Device was not found.');
    }

    const device = tenantDeviceSnapshot.data() as DeviceKeyRecord;

    if (device.tenantId && device.tenantId !== context.tenantId) {
      throw notFoundError('Device was not found.');
    }

    if (!device.uid) {
      throw validationError('Device owner is missing.');
    }

    targetUid = device.uid;

    const userDeviceRef = organizationRef
      .collection('users')
      .doc(device.uid)
      .collection('devices')
      .doc(safeDeviceId);
    const revokedFields = {
      revocationReason: cleanReason,
      revokedAt: fieldValue.serverTimestamp(),
      revokedByUid: context.uid,
      status: 'REVOKED',
      updatedAt: fieldValue.serverTimestamp()
    };

    transaction.set(tenantDeviceKeyRef, revokedFields, { merge: true });
    transaction.set(userDeviceRef, revokedFields, { merge: true });
  });

  const [refreshedDeviceSnapshot, userSnapshot] = await Promise.all([
    tenantDeviceKeyRef.get(),
    organizationRef.collection('users').doc(targetUid).get()
  ]);

  if (!refreshedDeviceSnapshot.exists) {
    throw notFoundError('Device was not found.');
  }

  return mapTenantDevice(
    refreshedDeviceSnapshot.data() as DeviceKeyRecord,
    refreshedDeviceSnapshot.id,
    userSnapshot.exists ? (userSnapshot.data() as TenantUserRecord) : undefined
  );
}

async function requireSecurityAdmin(decodedToken: DecodedIdToken): Promise<TenantAdminContext> {
  const session = await buildAuthSession(decodedToken);
  const { permissions, role, status, tenantId } = session.user;

  if (session.access !== 'ACTIVE' || !tenantId || status !== 'ACTIVE') {
    throw authorizationError('Your admin session is not active.');
  }

  if (role !== 'ORG_ADMIN' || !permissions.includes('security.manage')) {
    throw authorizationError('You do not have permission to manage security settings.');
  }

  return {
    permissions,
    role,
    tenantId,
    uid: decodedToken.uid
  };
}

async function getTenantUsersById(
  tenantId: string,
  userIds: string[]
): Promise<Map<string, TenantUserRecord>> {
  const users = new Map<string, TenantUserRecord>();

  await Promise.all(userIds.map(async (uid) => {
    const snapshot = await firestore
      .collection('organizations')
      .doc(tenantId)
      .collection('users')
      .doc(uid)
      .get();

    if (snapshot.exists) {
      users.set(uid, snapshot.data() as TenantUserRecord);
    }
  }));

  return users;
}

function mapTenantDevice(
  record: DeviceKeyRecord,
  fallbackDeviceId: string,
  user?: TenantUserRecord
): TenantDeviceResponse {
  const displayName = getDisplayName(user);

  return {
    createdAt: dateLikeToIso(record.createdAt),
    cryptoProvider: record.cryptoProvider || 'unknown',
    deviceId: record.deviceId || fallbackDeviceId,
    displayName,
    keyVersion: record.keyVersion || 1,
    lastSeenAt: dateLikeToIso(record.lastSeenAt),
    platform: record.platform || 'unknown',
    protocolVersion: record.protocolVersion || 'unknown',
    revokedAt: dateLikeToIso(record.revokedAt),
    revokedByUid: record.revokedByUid || null,
    revocationReason: record.revocationReason || null,
    roleName: user?.roleName || formatRoleName(user?.role || 'EMPLOYEE'),
    status: record.status || 'ACTIVE',
    tenantId: record.tenantId || '',
    uid: record.uid || ''
  };
}

function getDisplayName(user?: TenantUserRecord): string {
  if (!user) {
    return 'Unknown user';
  }

  const displayName = user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim();

  return displayName || 'Unknown user';
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
