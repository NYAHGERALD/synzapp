import { DecodedIdToken } from 'firebase-admin/auth';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import { buildAuthSession } from './authSessionService.js';

type LegacyPlaintextCleanupMode = 'DELETE' | 'DRY_RUN';

interface CleanupLegacyPlaintextInput {
  limit: number;
  mode: LegacyPlaintextCleanupMode;
}

interface DirectChatMaintenanceRecord {
  lastMessageText?: string | null;
}

interface LegacyPlaintextMessageRecord {
  text?: string | null;
}

interface TenantAdminContext {
  permissions: string[];
  role?: string;
  tenantId: string;
  uid: string;
}

export interface CleanupLegacyPlaintextResult {
  chatsScanned: number;
  chatsWithLegacyPreview: number;
  deletedMessages: number;
  legacyPlaintextMessages: number;
  mode: LegacyPlaintextCleanupMode;
  tenantId: string;
}

export async function cleanupLegacyPlaintextChatMessages(
  decodedToken: DecodedIdToken,
  input: CleanupLegacyPlaintextInput
): Promise<CleanupLegacyPlaintextResult> {
  const context = await requireSecurityAdmin(decodedToken);
  const mode = input.mode;
  let remainingMessages = Math.min(Math.max(input.limit, 1), 200);
  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const directChatsSnapshot = await organizationRef
    .collection('directChats')
    .limit(100)
    .get();
  const batch = firestore.batch();
  let operationCount = 0;
  let chatsWithLegacyPreview = 0;
  let deletedMessages = 0;
  let legacyPlaintextMessages = 0;

  for (const chatDoc of directChatsSnapshot.docs) {
    const chat = chatDoc.data() as DirectChatMaintenanceRecord;

    if (typeof chat.lastMessageText === 'string' && chat.lastMessageText.trim()) {
      chatsWithLegacyPreview += 1;

      if (mode === 'DELETE') {
        batch.set(chatDoc.ref, {
          lastMessageText: null,
          legacyPlaintextCleanupAt: fieldValue.serverTimestamp(),
          updatedAt: fieldValue.serverTimestamp()
        }, { merge: true });
        operationCount += 1;
      }
    }

    if (remainingMessages <= 0) {
      continue;
    }

    const messagesSnapshot = await chatDoc.ref
      .collection('messages')
      .limit(remainingMessages)
      .get();

    for (const messageDoc of messagesSnapshot.docs) {
      const message = messageDoc.data() as LegacyPlaintextMessageRecord;

      if (typeof message.text !== 'string' || !message.text.trim()) {
        continue;
      }

      legacyPlaintextMessages += 1;
      remainingMessages -= 1;

      if (mode === 'DELETE') {
        batch.delete(messageDoc.ref);
        deletedMessages += 1;
        operationCount += 1;
      }
    }
  }

  if (operationCount > 0) {
    await batch.commit();
  }

  return {
    chatsScanned: directChatsSnapshot.size,
    chatsWithLegacyPreview,
    deletedMessages,
    legacyPlaintextMessages,
    mode,
    tenantId: context.tenantId
  };
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

function authorizationError(message: string): Error {
  const error = new Error(message);
  error.name = 'AuthorizationError';
  return error;
}
