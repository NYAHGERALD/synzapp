import { DecodedIdToken } from 'firebase-admin/auth';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import { SynzappRole } from '../types/auth.js';
import { buildAuthSession } from './authSessionService.js';
import { createDeviceWipeCommand } from './companyDataWipeService.js';
import {
  DormancyCandidate,
  RETIRED_DEVICE_STATUS,
  normalizeDormantDeviceRetirementDays,
  partitionDormantDevices
} from './deviceDormancy.js';

export type DevicePlatform = 'android' | 'ios' | 'unknown' | 'web';

export interface RegisterDeviceIdentityInput {
  appInstallationId: string;
  /**
   * The clock this phone is on.
   *
   * Optional, and used for one thing: an organization that has never had a time
   * zone recorded takes it from the first organization admin to open the app.
   * Without it "remind everybody at 08:00" means eight o'clock UTC, which is
   * the middle of the night in half the places Synzapp is sold.
   */
  deviceTimeZone?: string;
  cryptoProvider: string;
  deviceId: string;
  identityPublicKey: string;
  keyAgreementPublicKey: string;
  keyVersion: number;
  platform: DevicePlatform;
  protocolVersion: string;
  signingPublicKey: string;
}

export interface RegisteredDeviceIdentity {
  cryptoProvider: string;
  deviceId: string;
  keyVersion: number;
  platform: DevicePlatform;
  protocolVersion: string;
  status: 'ACTIVE';
  synzappAiModelId: string | null;
  synzappAiReadyAt: string | null;
  synzappAiStatus: SynzappAiDeviceInstallStatus;
  synzappAiUpdatedAt: string | null;
  tenantId: string;
  uid: string;
}

export type SynzappAiDeviceInstallStatus = 'available' | 'downloading' | 'failed' | 'installed';

export interface SynzappAiDeviceStatusResponse {
  askButtonVisible: boolean;
  modelId: string | null;
  readyAt: string | null;
  status: SynzappAiDeviceInstallStatus;
  updatedAt: string | null;
}

interface OrganizationRecord {
  actionReminderPolicy?: {
    timeZone?: string;
  };
  deviceSecurityPolicy?: {
    dormantDeviceRetirementDays?: number;
  };
  status?: string;
}

interface TenantUserRecord {
  role?: SynzappRole;
  status?: string;
}

interface DeviceRecord {
  createdAt?: FirebaseDateLike;
  cryptoProvider?: string;
  deviceId?: string;
  keyVersion?: number;
  lastSeenAt?: FirebaseDateLike;
  platform?: DevicePlatform;
  protocolVersion?: string;
  revokedAt?: FirebaseDateLike;
  revokedByUid?: string;
  revocationReason?: string | null;
  synzappAiModelId?: string | null;
  synzappAiReadyAt?: FirebaseDateLike | null;
  synzappAiStatus?: string;
  synzappAiUpdatedAt?: FirebaseDateLike | null;
  tenantId?: string;
  status?: string;
  uid?: string;
}

interface FirebaseDateLike {
  toMillis?: () => number;
  seconds?: number;
}

export interface CurrentUserDeviceResponse {
  createdAt: string | null;
  cryptoProvider: string;
  deviceId: string;
  displayName: string;
  isCurrentDevice: boolean;
  keyVersion: number;
  lastSeenAt: string | null;
  platform: DevicePlatform;
  protocolVersion: string;
  revokedAt: string | null;
  revokedByUid: string | null;
  revocationReason: string | null;
  roleName: string;
  status: string;
  tenantId: string;
  uid: string;
}

export async function registerDeviceIdentity(
  decodedToken: DecodedIdToken,
  input: RegisterDeviceIdentityInput
): Promise<RegisteredDeviceIdentity> {
  const session = await buildAuthSession(decodedToken);
  const { role, status, tenantId } = session.user;

  if (session.access !== 'ACTIVE' || status !== 'ACTIVE' || !tenantId || !role) {
    throw authorizationError('Your profile is not active.');
  }

  const organizationRef = firestore.collection('organizations').doc(tenantId);
  const userRef = organizationRef.collection('users').doc(decodedToken.uid);
  const userDeviceRef = userRef.collection('devices').doc(input.deviceId);
  const tenantDeviceKeyRef = organizationRef.collection('deviceKeys').doc(input.deviceId);

  await firestore.runTransaction(async (transaction) => {
    const [
      organizationSnapshot,
      userSnapshot,
      userDeviceSnapshot,
      tenantDeviceKeySnapshot
    ] = await Promise.all([
      transaction.get(organizationRef),
      transaction.get(userRef),
      transaction.get(userDeviceRef),
      transaction.get(tenantDeviceKeyRef)
    ]);

    if (!organizationSnapshot.exists || !userSnapshot.exists) {
      throw authorizationError('Your profile is not active.');
    }

    const organization = organizationSnapshot.data() as OrganizationRecord;
    const user = userSnapshot.data() as TenantUserRecord;

    if (organization.status !== 'ACTIVE' || user.status !== 'ACTIVE' || user.role !== role) {
      throw authorizationError('Your profile is not active.');
    }

    const existingUserDevice = userDeviceSnapshot.exists
      ? (userDeviceSnapshot.data() as DeviceRecord)
      : null;
    const existingTenantDeviceKey = tenantDeviceKeySnapshot.exists
      ? (tenantDeviceKeySnapshot.data() as DeviceRecord)
      : null;

    if (existingTenantDeviceKey?.uid && existingTenantDeviceKey.uid !== decodedToken.uid) {
      throw conflictError('This device identity is already registered.');
    }

    if (
      (existingUserDevice?.status === 'REVOKED' || existingTenantDeviceKey?.status === 'REVOKED') &&
      !canReactivateLifecycleRevokedDevice(existingUserDevice, existingTenantDeviceKey, decodedToken.uid)
    ) {
      throw authorizationError('This device is not authorized.');
    }

    const createFields = userDeviceSnapshot.exists ? {} : {
      createdAt: fieldValue.serverTimestamp(),
      registeredByUid: decodedToken.uid
    };
    const sharedDeviceRecord = {
      appInstallationId: input.appInstallationId,
      cryptoProvider: input.cryptoProvider,
      deviceId: input.deviceId,
      identityPublicKey: input.identityPublicKey,
      keyAgreementPublicKey: input.keyAgreementPublicKey,
      keyVersion: input.keyVersion,
      lastSeenAt: fieldValue.serverTimestamp(),
      platform: input.platform,
      protocolVersion: input.protocolVersion,
      // Registering is how a retired device comes back: the app was opened on
      // it, so it plainly exists. Clearing the retirement here rather than
      // leaving it beside an active status is what stops the record from
      // reading as two contradictory things at once.
      retiredAfterDays: null,
      retiredAt: null,
      retirementReason: null,
      revokedAt: null,
      revokedByUid: null,
      revocationReason: null,
      signingPublicKey: input.signingPublicKey,
      status: 'ACTIVE',
      tenantId,
      uid: decodedToken.uid,
      updatedAt: fieldValue.serverTimestamp()
    };

    // Teaches the organization its own clock, once, from an administrator's
    // phone. Written inside the transaction that already read the organization,
    // so it costs no extra read — and only when nothing has ever been set, so
    // an administrator who chose a zone is never overruled by somebody's phone
    // in an airport.
    if (
      role === 'ORG_ADMIN' &&
      input.deviceTimeZone &&
      !organization.actionReminderPolicy?.timeZone
    ) {
      transaction.set(organizationRef, {
        actionReminderPolicy: { timeZone: input.deviceTimeZone }
      }, { merge: true });
    }

    transaction.set(userDeviceRef, {
      ...createFields,
      ...sharedDeviceRecord
    }, { merge: true });
    transaction.set(tenantDeviceKeyRef, {
      ...(tenantDeviceKeySnapshot.exists ? {} : {
        createdAt: fieldValue.serverTimestamp(),
        registeredByUid: decodedToken.uid
      }),
      ...sharedDeviceRecord
    }, { merge: true });
  });

  return {
    cryptoProvider: input.cryptoProvider,
    deviceId: input.deviceId,
    keyVersion: input.keyVersion,
    platform: input.platform,
    protocolVersion: input.protocolVersion,
    status: 'ACTIVE',
    synzappAiModelId: null,
    synzappAiReadyAt: null,
    synzappAiStatus: 'available',
    synzappAiUpdatedAt: null,
    tenantId,
    uid: decodedToken.uid
  };
}

/**
 * A device this account owns, whether or not it is still authorised.
 *
 * For the one thing a revoked device must still be able to do: collect the order
 * telling it to wipe itself, and report that it did.
 *
 * Revocation marks the device REVOKED and *then* writes the wipe command, so
 * gating that command on the device still being ACTIVE addressed it to a device
 * already blocked from reading it. Wiping a lost phone therefore did nothing at
 * all, silently, while the console reported success.
 *
 * Ownership is the whole check: a signed-in account, and a device registered to
 * that account in this tenant. It deliberately does not refresh `lastSeenAt` —
 * a revoked handset collecting its own wipe order is not a device in use, and
 * recording it as one would misreport which devices are live.
 */
export async function verifyOwnedRegisteredDevice(
  decodedToken: DecodedIdToken,
  deviceId: string
): Promise<{ deviceId: string; status: string; tenantId: string; uid: string }> {
  const session = await buildAuthSession(decodedToken);
  const { tenantId } = session.user;

  if (!tenantId) {
    throw authorizationError('Your profile is not active.');
  }

  const organizationRef = firestore.collection('organizations').doc(tenantId);
  const [tenantDeviceKeySnapshot, userDeviceSnapshot] = await Promise.all([
    organizationRef.collection('deviceKeys').doc(deviceId).get(),
    organizationRef
      .collection('users')
      .doc(decodedToken.uid)
      .collection('devices')
      .doc(deviceId)
      .get()
  ]);

  if (!tenantDeviceKeySnapshot.exists || !userDeviceSnapshot.exists) {
    throw authorizationError('This device is not authorized.');
  }

  const tenantDevice = tenantDeviceKeySnapshot.data() as DeviceRecord;

  if (tenantDevice.tenantId !== tenantId || tenantDevice.uid !== decodedToken.uid) {
    throw authorizationError('This device is not authorized.');
  }

  return {
    deviceId: tenantDevice.deviceId || deviceId,
    status: tenantDevice.status || 'UNKNOWN',
    tenantId,
    uid: decodedToken.uid
  };
}

export async function verifyActiveRegisteredDevice(
  decodedToken: DecodedIdToken,
  deviceId: string
): Promise<RegisteredDeviceIdentity> {
  const session = await buildAuthSession(decodedToken);
  const { status, tenantId } = session.user;

  if (session.access !== 'ACTIVE' || status !== 'ACTIVE' || !tenantId) {
    throw authorizationError('Your profile is not active.');
  }

  const organizationRef = firestore.collection('organizations').doc(tenantId);
  const tenantDeviceKeyRef = organizationRef.collection('deviceKeys').doc(deviceId);
  const userDeviceRef = organizationRef
    .collection('users')
    .doc(decodedToken.uid)
    .collection('devices')
    .doc(deviceId);
  const [tenantDeviceKeySnapshot, userDeviceSnapshot] = await Promise.all([
    tenantDeviceKeyRef.get(),
    userDeviceRef.get()
  ]);

  if (!tenantDeviceKeySnapshot.exists || !userDeviceSnapshot.exists) {
    throw authorizationError('This device is not authorized.');
  }

  const tenantDevice = tenantDeviceKeySnapshot.data() as DeviceRecord;
  const userDevice = userDeviceSnapshot.data() as DeviceRecord;

  if (
    tenantDevice.tenantId !== tenantId ||
    tenantDevice.uid !== decodedToken.uid ||
    tenantDevice.status !== 'ACTIVE' ||
    userDevice.status !== 'ACTIVE'
  ) {
    throw authorizationError('This device is not authorized.');
  }

  const seenFields = {
    lastSeenAt: fieldValue.serverTimestamp(),
    updatedAt: fieldValue.serverTimestamp()
  };

  await Promise.all([
    tenantDeviceKeyRef.set(seenFields, { merge: true }),
    userDeviceRef.set(seenFields, { merge: true })
  ]);

  return {
    cryptoProvider: tenantDevice.cryptoProvider || 'unknown',
    deviceId: tenantDevice.deviceId || deviceId,
    keyVersion: tenantDevice.keyVersion || 1,
    platform: tenantDevice.platform || 'unknown',
    protocolVersion: tenantDevice.protocolVersion || 'unknown',
    status: 'ACTIVE',
    synzappAiModelId: tenantDevice.synzappAiModelId || null,
    synzappAiReadyAt: dateLikeToIso(tenantDevice.synzappAiReadyAt || undefined),
    synzappAiStatus: normalizeSynzappAiDeviceStatus(tenantDevice.synzappAiStatus),
    synzappAiUpdatedAt: dateLikeToIso(tenantDevice.synzappAiUpdatedAt || undefined),
    tenantId,
    uid: decodedToken.uid
  };
}

export async function getCurrentDeviceSynzappAiStatus(
  activeDevice: RegisteredDeviceIdentity
): Promise<SynzappAiDeviceStatusResponse> {
  return mapSynzappAiDeviceStatus({
    synzappAiModelId: activeDevice.synzappAiModelId,
    synzappAiReadyAt: isoToDateLike(activeDevice.synzappAiReadyAt),
    synzappAiStatus: activeDevice.synzappAiStatus,
    synzappAiUpdatedAt: isoToDateLike(activeDevice.synzappAiUpdatedAt)
  });
}

export async function updateCurrentDeviceSynzappAiStatus(
  decodedToken: DecodedIdToken,
  activeDevice: RegisteredDeviceIdentity,
  input: {
    modelId?: string | null;
    status: SynzappAiDeviceInstallStatus;
  }
): Promise<SynzappAiDeviceStatusResponse> {
  if (activeDevice.uid !== decodedToken.uid) {
    throw authorizationError('This device is not authorized.');
  }

  const organizationRef = firestore.collection('organizations').doc(activeDevice.tenantId);
  const userDeviceRef = organizationRef
    .collection('users')
    .doc(decodedToken.uid)
    .collection('devices')
    .doc(activeDevice.deviceId);
  const tenantDeviceKeyRef = organizationRef.collection('deviceKeys').doc(activeDevice.deviceId);
  const isInstalled = input.status === 'installed';
  const safeModelId = isInstalled && input.modelId?.trim()
    ? input.modelId.trim().slice(0, 160)
    : null;
  const nextFields = {
    synzappAiModelId: safeModelId,
    synzappAiReadyAt: isInstalled ? fieldValue.serverTimestamp() : null,
    synzappAiStatus: input.status,
    synzappAiUpdatedAt: fieldValue.serverTimestamp(),
    updatedAt: fieldValue.serverTimestamp()
  };

  await Promise.all([
    userDeviceRef.set(nextFields, { merge: true }),
    tenantDeviceKeyRef.set(nextFields, { merge: true })
  ]);

  const refreshedDeviceSnapshot = await tenantDeviceKeyRef.get();
  const record = refreshedDeviceSnapshot.exists
    ? (refreshedDeviceSnapshot.data() as DeviceRecord)
    : {
        synzappAiModelId: safeModelId,
        synzappAiReadyAt: null,
        synzappAiStatus: input.status,
        synzappAiUpdatedAt: null
      };

  return mapSynzappAiDeviceStatus(record);
}

export async function listCurrentUserDevices(
  decodedToken: DecodedIdToken,
  currentDeviceId: string
): Promise<CurrentUserDeviceResponse[]> {
  const session = await buildAuthSession(decodedToken);
  const { role, status, tenantId } = session.user;

  if (session.access !== 'ACTIVE' || status !== 'ACTIVE' || !tenantId || !role) {
    throw authorizationError('Your profile is not active.');
  }

  const devicesSnapshot = await firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('users')
    .doc(decodedToken.uid)
    .collection('devices')
    .get();
  const devices = devicesSnapshot.docs.map((doc) => mapCurrentUserDevice(
    doc.data() as DeviceRecord,
    doc.id,
    currentDeviceId,
    formatRoleName(role)
  ));

  return devices.sort((first, second) => {
    if (first.isCurrentDevice) {
      return -1;
    }

    if (second.isCurrentDevice) {
      return 1;
    }

    const firstTime = first.lastSeenAt || first.createdAt || '';
    const secondTime = second.lastSeenAt || second.createdAt || '';

    return secondTime.localeCompare(firstTime);
  });
}

export async function revokeCurrentUserDevice(
  decodedToken: DecodedIdToken,
  targetDeviceId: string,
  currentDeviceId: string,
  reason?: string
): Promise<CurrentUserDeviceResponse> {
  const session = await buildAuthSession(decodedToken);
  const { role, status, tenantId } = session.user;

  if (session.access !== 'ACTIVE' || status !== 'ACTIVE' || !tenantId || !role) {
    throw authorizationError('Your profile is not active.');
  }

  const safeTargetDeviceId = targetDeviceId.trim();

  if (safeTargetDeviceId === currentDeviceId) {
    throw validationError('Use sign out to leave this device.');
  }

  const organizationRef = firestore.collection('organizations').doc(tenantId);
  const userDeviceRef = organizationRef
    .collection('users')
    .doc(decodedToken.uid)
    .collection('devices')
    .doc(safeTargetDeviceId);
  const tenantDeviceKeyRef = organizationRef.collection('deviceKeys').doc(safeTargetDeviceId);
  const cleanReason = reason?.trim() || 'Revoked by device owner';

  await firestore.runTransaction(async (transaction) => {
    const [userDeviceSnapshot, tenantDeviceSnapshot] = await Promise.all([
      transaction.get(userDeviceRef),
      transaction.get(tenantDeviceKeyRef)
    ]);

    if (!userDeviceSnapshot.exists || !tenantDeviceSnapshot.exists) {
      throw notFoundError('Device was not found.');
    }

    const userDevice = userDeviceSnapshot.data() as DeviceRecord;
    const tenantDevice = tenantDeviceSnapshot.data() as DeviceRecord;

    if (
      userDevice.tenantId !== tenantId ||
      tenantDevice.tenantId !== tenantId ||
      userDevice.uid !== decodedToken.uid ||
      tenantDevice.uid !== decodedToken.uid
    ) {
      throw notFoundError('Device was not found.');
    }

    /**
     * Idempotent per document, not per pair.
     *
     * This used to return if *either* copy was already REVOKED. The two copies
     * do drift — dormancy retirement and push-token cleanup write them
     * separately and unatomically — so a device revoked in one and active in the
     * other could never be finished off, and went on passing the device gate
     * that reads them both.
     */
    const revokedFields = {
      revocationReason: cleanReason,
      revokedAt: fieldValue.serverTimestamp(),
      revokedByUid: decodedToken.uid,
      status: 'REVOKED',
      updatedAt: fieldValue.serverTimestamp()
    };

    if (userDevice.status !== 'REVOKED') {
      transaction.set(userDeviceRef, revokedFields, { merge: true });
    }

    if (tenantDevice.status !== 'REVOKED') {
      transaction.set(tenantDeviceKeyRef, revokedFields, { merge: true });
    }
  });

  /**
   * Tell the handset to destroy its copy of company data.
   *
   * Only the admin path ever wrote one of these, so revoking your own lost phone
   * marked it revoked and left everything on it readable. Not awaited into the
   * caller's failure: the revoke itself has already committed, and a wipe order
   * that could not be written is retried the next time the device is revoked
   * rather than undoing a revocation somebody asked for.
   */
  await createDeviceWipeCommand({
    deviceId: safeTargetDeviceId,
    reason: 'DEVICE_REVOKED',
    requestedByUid: decodedToken.uid,
    tenantId,
    uid: decodedToken.uid
  }).catch((error) => {
    console.warn('Unable to create company data wipe command for revoked device:', error);
  });

  const refreshedDeviceSnapshot = await userDeviceRef.get();

  if (!refreshedDeviceSnapshot.exists) {
    throw notFoundError('Device was not found.');
  }

  return mapCurrentUserDevice(
    refreshedDeviceSnapshot.data() as DeviceRecord,
    refreshedDeviceSnapshot.id,
    currentDeviceId,
    formatRoleName(role)
  );
}

/**
 * The registrations of these people that are still worth sealing a copy for.
 *
 * Called wherever a message is about to be encrypted once per recipient device.
 * It removes the registrations that have gone quiet past the organization's
 * window, and retires them on the way past so that the device list an owner and
 * an admin look at stops claiming a wiped handset is in somebody's pocket.
 *
 * The retirement itself is not waited for. A person pressing send is owed their
 * message, not the tidying up behind it, and a retirement that fails is simply
 * made again the next time somebody writes to the same person.
 *
 * Rules about what may be retired live in `deviceDormancy.ts`, away from
 * Firestore, so they can be argued with in a test.
 */
export async function selectDevicesForDelivery<T extends DormancyCandidate>(
  tenantId: string,
  devices: T[]
): Promise<T[]> {
  if (devices.length < 2) {
    // Nothing to choose between, and the rule never takes somebody's last
    // device anyway, so this is the whole answer without reading a policy.
    return devices;
  }

  const retirementDays = await getDormantDeviceRetirementDays(tenantId);
  const { dormant, live } = partitionDormantDevices(devices, {
    nowMs: Date.now(),
    retirementDays
  });

  if (dormant.length) {
    void retireDormantDevices(tenantId, dormant, retirementDays);
  }

  return live;
}

/**
 * Marks these registrations retired, in both places a device is recorded.
 *
 * `RETIRED` rather than `REVOKED`: nobody decided this device was untrustworthy,
 * it only stopped appearing. Registering again puts it straight back to active,
 * which is what happens the moment the app is opened on it — see the
 * registration path above, which refuses a revoked device and lets this one
 * through.
 */
async function retireDormantDevices(
  tenantId: string,
  devices: DormancyCandidate[],
  retirementDays: number
): Promise<void> {
  const organizationRef = firestore.collection('organizations').doc(tenantId);
  const retirementFields = {
    retiredAfterDays: retirementDays,
    retiredAt: fieldValue.serverTimestamp(),
    retirementReason: `No activity for more than ${retirementDays} days`,
    status: RETIRED_DEVICE_STATUS,
    updatedAt: fieldValue.serverTimestamp()
  };

  await Promise.all(devices.flatMap((device) => {
    if (!device.deviceId || !device.uid) {
      return [];
    }

    return [
      organizationRef
        .collection('deviceKeys')
        .doc(device.deviceId)
        .set(retirementFields, { merge: true }),
      organizationRef
        .collection('users')
        .doc(device.uid)
        .collection('devices')
        .doc(device.deviceId)
        .set(retirementFields, { merge: true })
    ];
  })).catch(() => undefined);
}

/**
 * How long a device may stay quiet in this organization before it is retired.
 *
 * Kept briefly in memory because it is read on the path that sends a message
 * and it changes about once a year. Five minutes is short enough that an
 * administrator who changes it sees it take effect while they are still looking
 * at the screen, and long enough that a busy conversation is not paying for a
 * settings read per message.
 */
async function getDormantDeviceRetirementDays(tenantId: string): Promise<number> {
  const cached = dormancyWindowCache.get(tenantId);

  if (cached && cached.expiresAtMs > Date.now()) {
    return cached.retirementDays;
  }

  const snapshot = await firestore
    .collection('organizations')
    .doc(tenantId)
    .get()
    .catch(() => null);
  const organization = snapshot?.data() as OrganizationRecord | undefined;
  const retirementDays = normalizeDormantDeviceRetirementDays(
    organization?.deviceSecurityPolicy?.dormantDeviceRetirementDays
  );

  dormancyWindowCache.set(tenantId, {
    expiresAtMs: Date.now() + DORMANCY_WINDOW_CACHE_MS,
    retirementDays
  });

  return retirementDays;
}

const DORMANCY_WINDOW_CACHE_MS = 5 * 60 * 1000;
const dormancyWindowCache = new Map<string, { expiresAtMs: number; retirementDays: number }>();

function canReactivateLifecycleRevokedDevice(
  userDevice: DeviceRecord | null,
  tenantDevice: DeviceRecord | null,
  uid: string
): boolean {
  const deviceRecords = [userDevice, tenantDevice].filter((record): record is DeviceRecord => Boolean(record));

  if (!deviceRecords.length) {
    return false;
  }

  return deviceRecords.every((record) => (
    record.uid === uid &&
    (
      record.status !== 'REVOKED' ||
      isLifecycleRevokedDevice(record)
    )
  ));
}

function isLifecycleRevokedDevice(record: DeviceRecord): boolean {
  return record.status === 'REVOKED' &&
    /employee (deactivated|archived) by organization admin/i.test(record.revocationReason || '');
}

function mapCurrentUserDevice(
  record: DeviceRecord,
  fallbackDeviceId: string,
  currentDeviceId: string,
  roleName: string
): CurrentUserDeviceResponse {
  const deviceId = record.deviceId || fallbackDeviceId;

  return {
    createdAt: dateLikeToIso(record.createdAt),
    cryptoProvider: record.cryptoProvider || 'unknown',
    deviceId,
    displayName: deviceId === currentDeviceId ? 'This device' : formatDevicePlatform(record.platform || 'unknown'),
    isCurrentDevice: deviceId === currentDeviceId,
    keyVersion: record.keyVersion || 1,
    lastSeenAt: dateLikeToIso(record.lastSeenAt),
    platform: record.platform || 'unknown',
    protocolVersion: record.protocolVersion || 'unknown',
    revokedAt: dateLikeToIso(record.revokedAt),
    revokedByUid: record.revokedByUid || null,
    revocationReason: record.revocationReason || null,
    roleName,
    status: record.status || 'ACTIVE',
    tenantId: record.tenantId || '',
    uid: record.uid || ''
  };
}

function formatDevicePlatform(platform: DevicePlatform): string {
  if (platform === 'ios') {
    return 'iPhone or iPad';
  }

  if (platform === 'android') {
    return 'Android device';
  }

  if (platform === 'web') {
    return 'Web browser';
  }

  return 'Unknown device';
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

function isoToDateLike(value?: string | null): FirebaseDateLike | undefined {
  if (!value) {
    return undefined;
  }

  const milliseconds = Date.parse(value);

  if (!Number.isFinite(milliseconds)) {
    return undefined;
  }

  return {
    toMillis: () => milliseconds
  };
}

function normalizeSynzappAiDeviceStatus(value?: string | null): SynzappAiDeviceInstallStatus {
  return value === 'installed' ||
    value === 'downloading' ||
    value === 'failed' ||
    value === 'available'
    ? value
    : 'available';
}

function mapSynzappAiDeviceStatus(record: Pick<DeviceRecord, 'synzappAiModelId' | 'synzappAiReadyAt' | 'synzappAiStatus' | 'synzappAiUpdatedAt'>): SynzappAiDeviceStatusResponse {
  const status = normalizeSynzappAiDeviceStatus(record.synzappAiStatus);

  return {
    askButtonVisible: status === 'installed',
    modelId: record.synzappAiModelId || null,
    readyAt: dateLikeToIso(record.synzappAiReadyAt || undefined),
    status,
    updatedAt: dateLikeToIso(record.synzappAiUpdatedAt || undefined)
  };
}

function authorizationError(message: string): Error {
  const error = new Error(message);
  error.name = 'AuthorizationError';
  return error;
}

function conflictError(message: string): Error {
  const error = new Error(message);
  error.name = 'ConflictError';
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
