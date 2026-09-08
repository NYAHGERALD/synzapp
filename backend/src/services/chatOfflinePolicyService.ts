import { DecodedIdToken } from 'firebase-admin/auth';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import {
  canOrgAdminUsePermission,
  isActiveTenantSession
} from './authorizationPolicy.js';
import { buildAuthSession } from './authSessionService.js';

export interface ChatOfflinePolicyResponse {
  cacheRetentionDays: number;
  fullMediaCacheBudgetBytes: number;
  mediaLimitBytes: ChatMediaLimitBytes;
  offlineMediaCacheAllowed: boolean;
  purgeOnSignOut: boolean;
  updatedAt: string | null;
  updatedByUid: string | null;
  wifiOnlyMediaPrefetch: boolean;
}

export interface UpdateChatOfflinePolicyInput {
  cacheRetentionDays: number;
  fullMediaCacheBudgetBytes: number;
  mediaLimitBytes?: Partial<ChatMediaLimitBytes>;
  offlineMediaCacheAllowed: boolean;
  purgeOnSignOut: boolean;
  wifiOnlyMediaPrefetch: boolean;
}

export interface ChatMediaLimitBytes {
  audio: number;
  file: number;
  image: number;
  video: number;
}

interface OrganizationRecord {
  chatOfflinePolicy?: Partial<ChatOfflinePolicyRecord>;
  status?: string;
}

interface TenantUserRecord {
  status?: string;
}

interface ChatOfflinePolicyRecord {
  cacheRetentionDays?: number;
  fullMediaCacheBudgetBytes?: number;
  mediaLimitBytes?: Partial<ChatMediaLimitBytes>;
  offlineMediaCacheAllowed?: boolean;
  purgeOnSignOut?: boolean;
  updatedAt?: FirebaseDateLike;
  updatedByUid?: string | null;
  wifiOnlyMediaPrefetch?: boolean;
}

interface FirebaseDateLike {
  toMillis?: () => number;
  seconds?: number;
}

const MIN_MEDIA_CACHE_BUDGET_BYTES = 256 * 1024 * 1024;
const MAX_MEDIA_CACHE_BUDGET_BYTES = 5 * 1024 * 1024 * 1024;
const MIN_CACHE_RETENTION_DAYS = 1;
const MAX_CACHE_RETENTION_DAYS = 365;
const MIN_MEDIA_LIMIT_BYTES = 1024 * 1024;
const DEFAULT_MEDIA_LIMIT_BYTES: ChatMediaLimitBytes = {
  audio: 16 * 1024 * 1024,
  file: 100 * 1024 * 1024,
  image: 100 * 1024 * 1024,
  video: 250 * 1024 * 1024
};
const MAX_MEDIA_LIMIT_BYTES: ChatMediaLimitBytes = {
  audio: 64 * 1024 * 1024,
  file: 500 * 1024 * 1024,
  image: 250 * 1024 * 1024,
  video: 1024 * 1024 * 1024
};

export const DEFAULT_CHAT_OFFLINE_POLICY: ChatOfflinePolicyResponse = {
  cacheRetentionDays: 30,
  fullMediaCacheBudgetBytes: 2 * 1024 * 1024 * 1024,
  mediaLimitBytes: DEFAULT_MEDIA_LIMIT_BYTES,
  offlineMediaCacheAllowed: true,
  purgeOnSignOut: true,
  updatedAt: null,
  updatedByUid: null,
  wifiOnlyMediaPrefetch: false
};

export async function getChatOfflinePolicyForCurrentUser(
  decodedToken: DecodedIdToken
): Promise<ChatOfflinePolicyResponse> {
  const context = await getActiveTenantUserContext(decodedToken);
  const organizationSnapshot = await firestore.collection('organizations').doc(context.tenantId).get();

  if (!organizationSnapshot.exists) {
    throw authorizationError('Your profile is not active.');
  }

  const organization = organizationSnapshot.data() as OrganizationRecord;

  if (organization.status !== 'ACTIVE') {
    throw authorizationError('Your profile is not active.');
  }

  return mapChatOfflinePolicy(organization.chatOfflinePolicy);
}

export async function updateChatOfflinePolicy(
  decodedToken: DecodedIdToken,
  input: UpdateChatOfflinePolicyInput
): Promise<ChatOfflinePolicyResponse> {
  const context = await requireSecurityAdmin(decodedToken);
  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const policy = normalizeChatOfflinePolicy(input);

  await organizationRef.set({
    chatOfflinePolicy: {
      ...policy,
      updatedAt: fieldValue.serverTimestamp(),
      updatedByUid: decodedToken.uid
    },
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });

  const refreshedSnapshot = await organizationRef.get();
  const organization = refreshedSnapshot.data() as OrganizationRecord | undefined;

  return mapChatOfflinePolicy(organization?.chatOfflinePolicy);
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

function mapChatOfflinePolicy(policy?: Partial<ChatOfflinePolicyRecord>): ChatOfflinePolicyResponse {
  const normalizedPolicy = normalizeChatOfflinePolicy(policy || {});

  return {
    ...normalizedPolicy,
    updatedAt: dateLikeToIso(policy?.updatedAt),
    updatedByUid: policy?.updatedByUid || null
  };
}

function normalizeChatOfflinePolicy(
  input: Partial<UpdateChatOfflinePolicyInput>
): Omit<ChatOfflinePolicyResponse, 'updatedAt' | 'updatedByUid'> {
  return {
    cacheRetentionDays: clampInteger(
      input.cacheRetentionDays,
      MIN_CACHE_RETENTION_DAYS,
      MAX_CACHE_RETENTION_DAYS,
      DEFAULT_CHAT_OFFLINE_POLICY.cacheRetentionDays
    ),
    fullMediaCacheBudgetBytes: clampInteger(
      input.fullMediaCacheBudgetBytes,
      MIN_MEDIA_CACHE_BUDGET_BYTES,
      MAX_MEDIA_CACHE_BUDGET_BYTES,
      DEFAULT_CHAT_OFFLINE_POLICY.fullMediaCacheBudgetBytes
    ),
    mediaLimitBytes: normalizeMediaLimitBytes(input.mediaLimitBytes),
    offlineMediaCacheAllowed: typeof input.offlineMediaCacheAllowed === 'boolean'
      ? input.offlineMediaCacheAllowed
      : DEFAULT_CHAT_OFFLINE_POLICY.offlineMediaCacheAllowed,
    purgeOnSignOut: typeof input.purgeOnSignOut === 'boolean'
      ? input.purgeOnSignOut
      : DEFAULT_CHAT_OFFLINE_POLICY.purgeOnSignOut,
    wifiOnlyMediaPrefetch: typeof input.wifiOnlyMediaPrefetch === 'boolean'
      ? input.wifiOnlyMediaPrefetch
      : DEFAULT_CHAT_OFFLINE_POLICY.wifiOnlyMediaPrefetch
  };
}

function normalizeMediaLimitBytes(input?: Partial<ChatMediaLimitBytes>): ChatMediaLimitBytes {
  return {
    audio: clampInteger(input?.audio, MIN_MEDIA_LIMIT_BYTES, MAX_MEDIA_LIMIT_BYTES.audio, DEFAULT_MEDIA_LIMIT_BYTES.audio),
    file: clampInteger(input?.file, MIN_MEDIA_LIMIT_BYTES, MAX_MEDIA_LIMIT_BYTES.file, DEFAULT_MEDIA_LIMIT_BYTES.file),
    image: clampInteger(input?.image, MIN_MEDIA_LIMIT_BYTES, MAX_MEDIA_LIMIT_BYTES.image, DEFAULT_MEDIA_LIMIT_BYTES.image),
    video: clampInteger(input?.video, MIN_MEDIA_LIMIT_BYTES, MAX_MEDIA_LIMIT_BYTES.video, DEFAULT_MEDIA_LIMIT_BYTES.video)
  };
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(Math.round(value), min), max)
    : fallback;
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
