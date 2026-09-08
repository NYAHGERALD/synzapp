import { randomUUID } from 'node:crypto';
import { KeyManagementServiceClient } from '@google-cloud/kms';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';

/**
 * Who can restore an employee's encrypted chat backup, and on whose say-so.
 *
 * A backup is sealed with a key the device makes. Before this existed, that key
 * lived in one place: the device's own secure storage. Reinstall the app and it
 * is gone, and with it every backup the person ever made — the ciphertext
 * uploads happily and can never be read again by anyone. The setting called
 * "Restore requires organization approval" described an approval that had
 * nothing behind it: the flag was stored, displayed, and read by no code.
 *
 * Handing the key to the employee instead is the consumer answer, and it is the
 * wrong one here. It is one permanent secret, with no rotation and no audit,
 * given to everybody. It ends up in a screenshot.
 *
 * So the key is escrowed to the organization, wrapped by Cloud KMS exactly as
 * the compliance archive key is. The database holds a blob that is useless on
 * its own; reading it needs database access *and* permission to use the KMS
 * key, and Google logs every use outside our own logs.
 *
 * Restoring is then an approval, not a secret:
 *
 *   1. A reinstalled device asks. It has nothing, so it can only ask.
 *   2. An admin approves, and that is recorded against their name.
 *   3. The device claims the key **once**, KMS unwraps it, and the claim is
 *      burned. A second attempt has to be approved again.
 *
 * The employee never sees key material at any point, and every restore in the
 * company's history is a named admin action with a KMS audit entry beside it.
 */

const KMS_LOCATION = process.env.SYNZAPP_KMS_LOCATION?.trim() || 'us-central1';
const KMS_KEYRING = process.env.SYNZAPP_KMS_KEYRING?.trim() || 'synzapp-compliance';
const KMS_KEY = process.env.SYNZAPP_BACKUP_ESCROW_KMS_KEY?.trim() || 'chat-backup-escrow-wrap';
/** An approval that is never used must not stay usable. */
const APPROVAL_VALID_MS = 24 * 60 * 60 * 1000;
const WRAP_ATTEMPTS = 3;
const WRAP_RETRY_DELAY_MS = 250;

let kmsClient: KeyManagementServiceClient | null = null;

export type ChatBackupRestoreStatus = 'approved' | 'claimed' | 'denied' | 'pending';

export interface ChatBackupRestoreRequest {
  approvedAtMs: number | null;
  approvedByName: string | null;
  approvedByUid: string | null;
  claimedAtMs: number | null;
  deviceId: string;
  deviceName: string | null;
  requestedAtMs: number;
  requestedByName: string;
  requestId: string;
  status: ChatBackupRestoreStatus;
  uid: string;
}

function getKmsClient(): KeyManagementServiceClient {
  if (!kmsClient) {
    kmsClient = new KeyManagementServiceClient();
  }

  return kmsClient;
}

/**
 * The KMS key that wraps escrowed backup keys.
 *
 * `FIREBASE_PROJECT_ID` is included because Cloud Run does not set
 * `GOOGLE_CLOUD_PROJECT`, the same trap the archive key hit: without it the
 * name becomes "projects//locations/..." and every wrap fails.
 */
function getWrappingKeyName(): string {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.GCLOUD_PROJECT?.trim() ||
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    '';

  if (!projectId) {
    throw new Error(
      'No Google Cloud project is configured, so a backup key cannot be protected.'
    );
  }

  return `projects/${projectId}/locations/${KMS_LOCATION}/keyRings/${KMS_KEYRING}/cryptoKeys/${KMS_KEY}`;
}

function escrowRef(tenantId: string, uid: string) {
  return firestore
    .collection('organizations').doc(tenantId)
    .collection('chatBackupEscrow').doc(uid);
}

function restoreRequestRef(tenantId: string, requestId: string) {
  return firestore
    .collection('organizations').doc(tenantId)
    .collection('chatBackupRestoreRequests').doc(requestId);
}

async function wrapWithRetry(wrappingKeyName: string, plaintext: string) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= WRAP_ATTEMPTS; attempt += 1) {
    try {
      return await getKmsClient().encrypt({
        name: wrappingKeyName,
        plaintext: Buffer.from(plaintext, 'utf8')
      });
    } catch (error) {
      lastError = error;

      if (attempt < WRAP_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, WRAP_RETRY_DELAY_MS * attempt));
      }
    }
  }

  throw lastError;
}

/**
 * Puts a device's backup key into escrow.
 *
 * Called when a backup is made. The device keeps its own copy for its own
 * restores; this is the copy that survives the device.
 */
export async function escrowChatBackupKey(input: {
  deviceId: string;
  recoveryKey: string;
  tenantId: string;
  uid: string;
}): Promise<void> {
  const wrappingKeyName = getWrappingKeyName();
  const [wrapped] = await wrapWithRetry(wrappingKeyName, input.recoveryKey);

  if (!wrapped.ciphertext) {
    throw new Error('The backup key could not be protected.');
  }

  await escrowRef(input.tenantId, input.uid).set({
    deviceId: input.deviceId,
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtMs: Date.now(),
    wrappedRecoveryKey: Buffer.from(wrapped.ciphertext).toString('base64'),
    wrappingKeyName
  }, { merge: true });
}

/** Whether this person has anything in escrow to restore from. */
export async function hasEscrowedChatBackupKey(tenantId: string, uid: string): Promise<boolean> {
  const snapshot = await escrowRef(tenantId, uid).get().catch(() => null);

  return Boolean(snapshot?.exists && snapshot.data()?.wrappedRecoveryKey);
}

/**
 * Asks to restore. A device with no key can do nothing else.
 *
 * One open request per device: asking twice while an admin has not answered
 * should not fill their queue with the same ask.
 */
export async function createChatBackupRestoreRequest(input: {
  deviceId: string;
  deviceName?: string | null;
  requestedByName: string;
  tenantId: string;
  uid: string;
}): Promise<ChatBackupRestoreRequest> {
  const existing = await firestore
    .collection('organizations').doc(input.tenantId)
    .collection('chatBackupRestoreRequests')
    .where('uid', '==', input.uid)
    .where('deviceId', '==', input.deviceId)
    .where('status', 'in', ['pending', 'approved'])
    .limit(1)
    .get()
    .catch(() => null);

  if (existing && !existing.empty) {
    return existing.docs[0].data() as ChatBackupRestoreRequest;
  }

  const request: ChatBackupRestoreRequest = {
    approvedAtMs: null,
    approvedByName: null,
    approvedByUid: null,
    claimedAtMs: null,
    deviceId: input.deviceId,
    deviceName: input.deviceName?.trim() || null,
    requestedAtMs: Date.now(),
    requestedByName: input.requestedByName,
    requestId: randomUUID(),
    status: 'pending',
    uid: input.uid
  };

  await restoreRequestRef(input.tenantId, request.requestId).set(request);

  return request;
}

/** What an admin has waiting. Newest first, because that is what gets chased. */
export async function listChatBackupRestoreRequests(
  tenantId: string,
  limit = 50
): Promise<ChatBackupRestoreRequest[]> {
  const snapshot = await firestore
    .collection('organizations').doc(tenantId)
    .collection('chatBackupRestoreRequests')
    .orderBy('requestedAtMs', 'desc')
    .limit(Math.min(Math.max(limit, 1), 200))
    .get()
    .catch(() => null);

  return snapshot ? snapshot.docs.map((doc) => doc.data() as ChatBackupRestoreRequest) : [];
}

/** Records who decided, so a restore is never anonymous. */
export async function decideChatBackupRestoreRequest(input: {
  approve: boolean;
  decidedByName: string;
  decidedByUid: string;
  requestId: string;
  tenantId: string;
}): Promise<ChatBackupRestoreRequest | null> {
  const ref = restoreRequestRef(input.tenantId, input.requestId);

  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);

    if (!snapshot.exists) {
      return null;
    }

    const request = snapshot.data() as ChatBackupRestoreRequest;

    // Already used or already refused. Deciding again would either re-open a
    // spent approval or overwrite somebody else's refusal.
    if (request.status === 'claimed' || request.status === 'denied') {
      return request;
    }

    const decided: ChatBackupRestoreRequest = {
      ...request,
      approvedAtMs: input.approve ? Date.now() : null,
      approvedByName: input.decidedByName,
      approvedByUid: input.decidedByUid,
      status: input.approve ? 'approved' : 'denied'
    };

    transaction.set(ref, decided);

    return decided;
  });
}

/**
 * Hands the key to a device an admin has approved, once.
 *
 * The claim is burned in the same transaction that reads it, before KMS is ever
 * asked to unwrap, so an approval cannot be spent twice even by two requests
 * arriving together. Restoring again means being approved again.
 */
/**
 * Hands a person their own backup key back, with nobody's permission needed.
 *
 * Reinstalling the app is not a security event; it is Tuesday. On Android an
 * uninstall takes the keystore with it, so without this the employee's history
 * is gone — while the same person on an iPhone keeps it, because that keychain
 * survives. Losing your work depending on which phone you carry is not a policy,
 * it is an accident.
 *
 * **What still protects it** is that only an active member of the organization
 * ever reaches this. Somebody removed from the company fails that check, so
 * their key is never released again and their history stays sealed — which is
 * the boundary asked for: the device is only cut off when the person is.
 *
 * Recorded on the escrow itself, and audited by the caller. Taking away an
 * approval step is only defensible if what replaces it is a trail somebody can
 * read afterwards.
 */
export async function releaseChatBackupKeyToOwner(input: {
  deviceId: string;
  tenantId: string;
  uid: string;
}): Promise<{ recoveryKey: string } | null> {
  const escrow = await escrowRef(input.tenantId, input.uid).get().catch(() => null);
  const wrappedRecoveryKey = escrow?.data()?.wrappedRecoveryKey as string | undefined;

  if (!wrappedRecoveryKey) {
    return null;
  }

  const [unwrapped] = await getKmsClient().decrypt({
    ciphertext: Buffer.from(wrappedRecoveryKey, 'base64'),
    name: (escrow?.data()?.wrappingKeyName as string | undefined) || getWrappingKeyName()
  });

  if (!unwrapped.plaintext) {
    return null;
  }

  await escrowRef(input.tenantId, input.uid).set({
    lastReleasedAtMs: Date.now(),
    lastReleasedToDeviceId: input.deviceId
  }, { merge: true }).catch(() => undefined);

  return { recoveryKey: Buffer.from(unwrapped.plaintext).toString('utf8') };
}

export async function claimApprovedChatBackupKey(input: {
  deviceId: string;
  tenantId: string;
  uid: string;
}): Promise<{ recoveryKey: string } | null> {
  const snapshot = await firestore
    .collection('organizations').doc(input.tenantId)
    .collection('chatBackupRestoreRequests')
    .where('uid', '==', input.uid)
    .where('deviceId', '==', input.deviceId)
    .where('status', '==', 'approved')
    .limit(1)
    .get()
    .catch(() => null);

  if (!snapshot || snapshot.empty) {
    return null;
  }

  const ref = snapshot.docs[0].ref;
  const burned = await firestore.runTransaction(async (transaction) => {
    const current = await transaction.get(ref);
    const request = current.data() as ChatBackupRestoreRequest | undefined;

    if (!request || request.status !== 'approved') {
      return null;
    }

    if (!request.approvedAtMs || Date.now() - request.approvedAtMs > APPROVAL_VALID_MS) {
      transaction.set(ref, { ...request, status: 'denied' });

      return null;
    }

    transaction.set(ref, { ...request, claimedAtMs: Date.now(), status: 'claimed' });

    return request;
  });

  if (!burned) {
    return null;
  }

  const escrow = await escrowRef(input.tenantId, input.uid).get().catch(() => null);
  const wrappedRecoveryKey = escrow?.data()?.wrappedRecoveryKey as string | undefined;

  if (!wrappedRecoveryKey) {
    return null;
  }

  const [unwrapped] = await getKmsClient().decrypt({
    ciphertext: Buffer.from(wrappedRecoveryKey, 'base64'),
    name: (escrow?.data()?.wrappingKeyName as string | undefined) || getWrappingKeyName()
  });

  if (!unwrapped.plaintext) {
    return null;
  }

  return { recoveryKey: Buffer.from(unwrapped.plaintext).toString('utf8') };
}
