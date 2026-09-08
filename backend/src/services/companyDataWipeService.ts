import { fieldValue, firestore } from '../config/firebaseAdmin.js';

export type CompanyDataWipeReason =
  | 'DEVICE_REVOKED'
  | 'EMPLOYEE_ANONYMIZED'
  | 'EMPLOYEE_ARCHIVED'
  | 'EMPLOYEE_DEACTIVATED'
  | 'EMPLOYEE_DELETED'
  | 'EMPLOYEE_PERMANENTLY_REMOVED'
  | 'MANUAL_SECURITY_ACTION';

interface DeviceWipeCommandInput {
  deviceId: string;
  reason: CompanyDataWipeReason;
  requestedByUid: string;
  tenantId: string;
  uid: string;
}

interface DeviceWipeCommandRecord extends DeviceWipeCommandInput {
  commandType: 'PURGE_TENANT_COMPANY_DATA';
  commandRefPath?: string;
  completedAt?: FirebaseDateLike | null;
  createdAt: FirebaseFirestore.FieldValue | FirebaseDateLike;
  status: 'REQUESTED' | 'COMPLETED';
  updatedAt: FirebaseFirestore.FieldValue | FirebaseDateLike;
}

interface FirebaseDateLike {
  toDate?: () => Date;
  toMillis?: () => number;
  seconds?: number;
}

interface IdentityDirectoryTenantRecord {
  tenantId?: string;
}

export interface PendingCompanyDataWipeCommand {
  commandId: string;
  commandType: 'PURGE_TENANT_COMPANY_DATA';
  createdAt: string | null;
  deviceId: string;
  reason: CompanyDataWipeReason;
  status: 'REQUESTED';
  tenantId: string;
  uid: string;
}

export async function createDeviceWipeCommand(input: DeviceWipeCommandInput): Promise<string> {
  const batch = firestore.batch();
  const commandId = addDeviceWipeCommandToBatch(batch, input);

  await batch.commit();

  return commandId;
}

export function addDeviceWipeCommandToBatch(
  batch: FirebaseFirestore.WriteBatch,
  input: DeviceWipeCommandInput
): string {
  const organizationRef = firestore.collection('organizations').doc(input.tenantId);
  const commandRef = organizationRef.collection('companyDataWipeCommands').doc();
  const deviceCommandRef = organizationRef
    .collection('users')
    .doc(input.uid)
    .collection('devices')
    .doc(input.deviceId)
    .collection('wipeCommands')
    .doc(commandRef.id);
  const command: DeviceWipeCommandRecord = {
    commandType: 'PURGE_TENANT_COMPANY_DATA',
    createdAt: fieldValue.serverTimestamp(),
    deviceId: input.deviceId,
    reason: input.reason,
    requestedByUid: input.requestedByUid,
    status: 'REQUESTED',
    tenantId: input.tenantId,
    uid: input.uid,
    updatedAt: fieldValue.serverTimestamp()
  };

  batch.set(commandRef, command);
  batch.set(deviceCommandRef, {
    ...command,
    commandRefPath: commandRef.path
  });

  return commandRef.id;
}

export async function listPendingDeviceWipeCommands(input: {
  deviceId: string;
  tenantId?: string | null;
  uid: string;
}): Promise<PendingCompanyDataWipeCommand[]> {
  const tenantId = await resolveTenantId(input.uid, input.tenantId);

  if (!tenantId) {
    return [];
  }

  const snapshot = await firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('users')
    .doc(input.uid)
    .collection('devices')
    .doc(input.deviceId)
    .collection('wipeCommands')
    .where('status', '==', 'REQUESTED')
    .where('commandType', '==', 'PURGE_TENANT_COMPANY_DATA')
    .limit(25)
    .get();

  return snapshot.docs
    .map((doc) => {
      const command = doc.data() as DeviceWipeCommandRecord;

      if (
        command.deviceId !== input.deviceId ||
        command.tenantId !== tenantId ||
        command.uid !== input.uid ||
        command.status !== 'REQUESTED'
      ) {
        return null;
      }

      return {
        commandId: doc.id,
        commandType: 'PURGE_TENANT_COMPANY_DATA' as const,
        createdAt: toIsoString(command.createdAt),
        deviceId: command.deviceId,
        reason: command.reason,
        status: 'REQUESTED' as const,
        tenantId: command.tenantId,
        uid: command.uid
      };
    })
    .filter((command): command is PendingCompanyDataWipeCommand => Boolean(command))
    .sort((first, second) => (first.createdAt || '').localeCompare(second.createdAt || ''));
}

export async function completeDeviceWipeCommand(input: {
  commandId: string;
  deviceId: string;
  tenantId?: string | null;
  uid: string;
}): Promise<void> {
  const tenantId = await resolveTenantId(input.uid, input.tenantId);

  if (!tenantId) {
    throw authorizationError('This device is not authorized.');
  }

  const deviceCommandRef = firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('users')
    .doc(input.uid)
    .collection('devices')
    .doc(input.deviceId)
    .collection('wipeCommands')
    .doc(input.commandId);

  await firestore.runTransaction(async (transaction) => {
    const deviceCommandSnapshot = await transaction.get(deviceCommandRef);

    if (!deviceCommandSnapshot.exists) {
      throw authorizationError('This wipe command was not found.');
    }

    const command = deviceCommandSnapshot.data() as DeviceWipeCommandRecord;

    if (
      command.commandType !== 'PURGE_TENANT_COMPANY_DATA' ||
      command.deviceId !== input.deviceId ||
      command.tenantId !== tenantId ||
      command.uid !== input.uid
    ) {
      throw authorizationError('This device is not authorized.');
    }

    const completionFields = {
      acknowledgedByDeviceId: input.deviceId,
      completedAt: fieldValue.serverTimestamp(),
      status: 'COMPLETED',
      updatedAt: fieldValue.serverTimestamp()
    };

    transaction.set(deviceCommandRef, completionFields, { merge: true });

    const commandRefPath = command.commandRefPath ||
      `organizations/${tenantId}/companyDataWipeCommands/${input.commandId}`;
    transaction.set(firestore.doc(commandRefPath), completionFields, { merge: true });
  });
}

async function resolveTenantId(uid: string, tenantId?: string | null): Promise<string | null> {
  if (tenantId) {
    return tenantId;
  }

  const identitySnapshot = await firestore.collection('identityDirectory').doc(uid).get();
  const identity = identitySnapshot.exists
    ? (identitySnapshot.data() as IdentityDirectoryTenantRecord)
    : null;

  return identity?.tenantId || null;
}

function toIsoString(value: FirebaseFirestore.FieldValue | FirebaseDateLike | undefined): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  if ('toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }

  if ('toMillis' in value && typeof value.toMillis === 'function') {
    return new Date(value.toMillis()).toISOString();
  }

  if ('seconds' in value && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000).toISOString();
  }

  return null;
}

function authorizationError(message: string): Error {
  const error = new Error(message);
  error.name = 'AuthorizationError';
  return error;
}
