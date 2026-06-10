import { DecodedIdToken } from 'firebase-admin/auth';
import { fieldValue, firestore, storageBucket } from '../config/firebaseAdmin.js';
import type { RegisteredDeviceIdentity } from './deviceIdentityService.js';
import { assertChatBackupOperationAllowed } from './chatBackupPolicyService.js';

export interface EncryptedChatBackupUploadInput {
  algorithm: 'nacl-secretbox+synzapp-chat-backup-v1';
  backupCreatedAt: string;
  backupVersion: 1;
  ciphertext: string;
  conversationCount: number;
  keyFingerprint: string;
  messageCount: number;
  nonce: string;
}

export interface EncryptedChatBackupMetadata {
  backupCreatedAt: string;
  backupId: 'latest';
  backupVersion: 1;
  conversationCount: number;
  keyFingerprint: string;
  messageCount: number;
  sizeBytes: number;
  uploadedAt: string;
}

export interface EncryptedChatBackupResponse {
  backup: {
    algorithm: EncryptedChatBackupUploadInput['algorithm'];
    backupCreatedAt: string;
    backupVersion: 1;
    ciphertext: string;
    conversationCount: number;
    keyFingerprint: string;
    messageCount: number;
    nonce: string;
    uploadedAt: string;
  } | null;
}

interface ChatBackupMetadataRecord {
  backupCreatedAt?: string;
  backupVersion?: number;
  conversationCount?: number;
  keyFingerprint?: string;
  messageCount?: number;
  sizeBytes?: number;
  storagePath?: string;
  uploadedAtMs?: number;
}

export async function saveEncryptedChatBackup(
  decodedToken: DecodedIdToken,
  activeDevice: RegisteredDeviceIdentity,
  input: EncryptedChatBackupUploadInput
): Promise<EncryptedChatBackupMetadata> {
  const context = await getActiveBackupContext(decodedToken, activeDevice);
  const uploadedAtMs = Date.now();
  const storagePath = getBackupStoragePath(context.tenantId, decodedToken.uid);
  const payload = JSON.stringify({
    ...input,
    uploadedAt: new Date(uploadedAtMs).toISOString()
  });
  const sizeBytes = Buffer.byteLength(payload, 'utf8');

  if (sizeBytes > 4_750_000) {
    throw validationError('Encrypted backup is too large for this backup path.');
  }

  try {
    await storageBucket.file(storagePath).save(payload, {
      contentType: 'application/json',
      metadata: {
        cacheControl: 'private, no-store',
        metadata: {
          backupVersion: String(input.backupVersion),
          keyFingerprint: input.keyFingerprint,
          tenantId: context.tenantId,
          uid: decodedToken.uid
        }
      },
      resumable: false
    });
  } catch (error) {
    if (isMissingStorageBucketError(error)) {
      throw validationError('Encrypted backup storage is not ready yet. Please try again later.');
    }

    throw error;
  }

  const metadata: EncryptedChatBackupMetadata = {
    backupCreatedAt: input.backupCreatedAt,
    backupId: 'latest',
    backupVersion: 1,
    conversationCount: input.conversationCount,
    keyFingerprint: input.keyFingerprint,
    messageCount: input.messageCount,
    sizeBytes,
    uploadedAt: new Date(uploadedAtMs).toISOString()
  };

  await getBackupMetadataRef(context.tenantId, decodedToken.uid).set({
    algorithm: input.algorithm,
    backupCreatedAt: input.backupCreatedAt,
    backupId: 'latest',
    backupVersion: input.backupVersion,
    conversationCount: input.conversationCount,
    createdAt: fieldValue.serverTimestamp(),
    keyFingerprint: input.keyFingerprint,
    lastUploadedByDeviceId: activeDevice.deviceId,
    messageCount: input.messageCount,
    sizeBytes,
    status: 'AVAILABLE',
    storagePath,
    tenantId: context.tenantId,
    uid: decodedToken.uid,
    updatedAt: fieldValue.serverTimestamp(),
    uploadedAtMs
  }, { merge: true });

  return metadata;
}

export async function getLatestEncryptedChatBackup(
  decodedToken: DecodedIdToken,
  activeDevice: RegisteredDeviceIdentity
): Promise<EncryptedChatBackupResponse> {
  const context = await getActiveBackupContext(decodedToken, activeDevice, 'RESTORE');
  const metadataSnapshot = await getBackupMetadataRef(context.tenantId, decodedToken.uid).get();

  if (!metadataSnapshot.exists) {
    return { backup: null };
  }

  const metadata = metadataSnapshot.data() as ChatBackupMetadataRecord;
  const storagePath = metadata.storagePath;

  if (!storagePath) {
    return { backup: null };
  }

  const file = storageBucket.file(storagePath);

  try {
    const [exists] = await file.exists();

    if (!exists) {
      return { backup: null };
    }

    const [contents] = await file.download();
    const parsedValue = JSON.parse(contents.toString('utf8')) as Partial<EncryptedChatBackupResponse['backup']>;

    if (!isEncryptedChatBackupPayload(parsedValue)) {
      return { backup: null };
    }

    return {
      backup: {
        ...parsedValue,
        uploadedAt: parsedValue.uploadedAt || new Date(metadata.uploadedAtMs || Date.now()).toISOString()
      }
    };
  } catch (error) {
    if (isMissingStorageBucketError(error)) {
      return { backup: null };
    }

    throw error;
  }
}

async function getActiveBackupContext(
  decodedToken: DecodedIdToken,
  activeDevice: RegisteredDeviceIdentity,
  operation: 'RESTORE' | 'UPLOAD' = 'UPLOAD'
): Promise<{ tenantId: string }> {
  const context = await assertChatBackupOperationAllowed(decodedToken, operation);

  if (
    activeDevice.uid !== decodedToken.uid ||
    activeDevice.tenantId !== context.tenantId
  ) {
    throw authorizationError('Your profile is not active.');
  }

  return { tenantId: context.tenantId };
}

function getBackupStoragePath(tenantId: string, uid: string): string {
  return `organizations/${tenantId}/users/${uid}/chat-backups/latest.synzappbackup`;
}

function getBackupMetadataRef(tenantId: string, uid: string) {
  return firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('users')
    .doc(uid)
    .collection('chatBackups')
    .doc('latest');
}

export function isEncryptedChatBackupPayload(
  value: Partial<EncryptedChatBackupResponse['backup']>
): value is NonNullable<EncryptedChatBackupResponse['backup']> {
  return Boolean(
    value &&
    value.algorithm === 'nacl-secretbox+synzapp-chat-backup-v1' &&
    value.backupVersion === 1 &&
    hasText(value.backupCreatedAt) &&
    hasText(value.ciphertext) &&
    isNonNegativeInteger(value.conversationCount) &&
    hasText(value.keyFingerprint) &&
    isNonNegativeInteger(value.messageCount) &&
    hasText(value.nonce)
  );
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isMissingStorageBucketError(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? (error as { code?: number | string }).code
    : undefined;
  const message = getErrorMessage(error);

  return (
    code === 404 &&
    /bucket|storage|not found|does not exist/i.test(message)
  ) || /specified bucket does not exist/i.test(message);
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

function validationError(message: string): Error {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
}
