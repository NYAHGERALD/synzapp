import type { DecodedIdToken } from 'firebase-admin/auth';
import { firestore } from '../config/firebaseAdmin.js';
import { buildAuthSession } from './authSessionService.js';
import { getChatBackupPolicyForCurrentUser } from './chatBackupPolicyService.js';
import {
  claimApprovedChatBackupKey,
  releaseChatBackupKeyToOwner,
  createChatBackupRestoreRequest,
  decideChatBackupRestoreRequest,
  escrowChatBackupKey,
  listChatBackupRestoreRequests,
  type ChatBackupRestoreRequest
} from './chatBackupEscrowService.js';

/**
 * The authorization around backup escrow.
 *
 * Deciding a restore is a security-admin action, held to the same bar as
 * changing the backup policy itself: approving one hands a device the key to a
 * person's entire chat history.
 *
 * Everything else here is a person acting on their **own** backup, so it is
 * scoped to the caller's uid rather than taken from the request. A device
 * cannot ask about, or claim, anybody else's.
 */

/** Matches the shape used elsewhere, so the API surfaces the same 403. */
function authorizationError(message: string): Error {
  const error = new Error(message);

  error.name = 'AuthorizationError';

  return error;
}

async function requireActiveMember(decodedToken: DecodedIdToken) {
  const session = await buildAuthSession(decodedToken);
  const { status, tenantId } = session.user;

  if (session.access !== 'ACTIVE' || !tenantId || status !== 'ACTIVE') {
    throw authorizationError('Your session is not active.');
  }

  return {
    displayName: await readDisplayName(tenantId, decodedToken.uid),
    tenantId,
    uid: decodedToken.uid
  };
}

/** A request an admin cannot put a name to is not much of an approval. */
async function readDisplayName(tenantId: string, uid: string): Promise<string> {
  const snapshot = await firestore
    .collection('organizations').doc(tenantId)
    .collection('users').doc(uid)
    .get()
    .catch(() => null);
  const user = snapshot?.data() as
    { displayName?: string; firstName?: string; lastName?: string } | undefined;
  const name = user?.displayName ||
    `${user?.firstName || ''} ${user?.lastName || ''}`.trim();

  return name || 'Unknown user';
}

async function requireSecurityAdmin(decodedToken: DecodedIdToken) {
  const session = await buildAuthSession(decodedToken);
  const { permissions, role, status, tenantId } = session.user;

  if (session.access !== 'ACTIVE' || !tenantId || status !== 'ACTIVE') {
    throw authorizationError('Your admin session is not active.');
  }

  if (role !== 'ORG_ADMIN' || !permissions.includes('security.manage')) {
    throw authorizationError('You do not have permission to decide backup restores.');
  }

  return {
    displayName: await readDisplayName(tenantId, decodedToken.uid),
    tenantId,
    uid: decodedToken.uid
  };
}

export async function escrowBackupKeyForCurrentUser(
  decodedToken: DecodedIdToken,
  input: { deviceId: string; recoveryKey: string }
): Promise<void> {
  const caller = await requireActiveMember(decodedToken);

  await escrowChatBackupKey({
    deviceId: input.deviceId,
    recoveryKey: input.recoveryKey,
    tenantId: caller.tenantId,
    uid: caller.uid
  });
}

export async function requestRestoreForCurrentUser(
  decodedToken: DecodedIdToken,
  input: { deviceId: string; deviceName?: string | null }
): Promise<ChatBackupRestoreRequest> {
  const caller = await requireActiveMember(decodedToken);

  return createChatBackupRestoreRequest({
    deviceId: input.deviceId,
    deviceName: input.deviceName,
    requestedByName: caller.displayName,
    tenantId: caller.tenantId,
    uid: caller.uid
  });
}

/**
 * Getting your own chat history back after reinstalling.
 *
 * Where the organization allows self-restore — which is the default — an active
 * employee gets their key straight back, the same as an organization admin
 * always effectively did by approving their own request. Waiting on somebody
 * else to approve reinstalling your own app is friction that ends with people
 * either losing their history or avoiding a reinstall they needed.
 *
 * Where an organization has turned self-restore off, the old path still
 * applies and an admin must approve. That switch is the organization's to make;
 * this only stops treating every employee as though it were always off.
 *
 * Either way it is refused to anybody who is not an active member, so somebody
 * removed from the company cannot get their history back.
 */
export async function claimRestoreForCurrentUser(
  decodedToken: DecodedIdToken,
  input: { deviceId: string }
): Promise<{ automatic: boolean; recoveryKey: string } | null> {
  const caller = await requireActiveMember(decodedToken);
  const policy = await getChatBackupPolicyForCurrentUser(decodedToken);

  if (policy.selfRestoreEnabled) {
    const released = await releaseChatBackupKeyToOwner({
      deviceId: input.deviceId,
      tenantId: caller.tenantId,
      uid: caller.uid
    });

    if (released) {
      return { automatic: true, recoveryKey: released.recoveryKey };
    }
  }

  const approved = await claimApprovedChatBackupKey({
    deviceId: input.deviceId,
    tenantId: caller.tenantId,
    uid: caller.uid
  });

  return approved ? { automatic: false, recoveryKey: approved.recoveryKey } : null;
}

export async function listRestoreRequestsForAdmin(
  decodedToken: DecodedIdToken
): Promise<ChatBackupRestoreRequest[]> {
  const admin = await requireSecurityAdmin(decodedToken);

  return listChatBackupRestoreRequests(admin.tenantId);
}

export async function decideRestoreRequestForAdmin(
  decodedToken: DecodedIdToken,
  input: { approve: boolean; requestId: string }
): Promise<ChatBackupRestoreRequest | null> {
  const admin = await requireSecurityAdmin(decodedToken);

  return decideChatBackupRestoreRequest({
    approve: input.approve,
    decidedByName: admin.displayName,
    decidedByUid: admin.uid,
    requestId: input.requestId,
    tenantId: admin.tenantId
  });
}
