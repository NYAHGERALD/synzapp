import * as SecureStore from 'expo-secure-store';
import type { CompanyDataPurgeReason } from './companyDataGovernance';

export interface CompanyDataManifestScope {
  ownerUid: string;
  tenantId: string;
}

export interface CompanyDataManifestRecord extends CompanyDataManifestScope {
  blockedAt?: string;
  lastPurgeAt?: string;
  lastPurgeErrors?: Array<{
    message: string;
    step: string;
  }>;
  reason?: CompanyDataPurgeReason;
  status: 'active' | 'blocked' | 'purged';
  updatedAt: string;
  version: 1;
}

const COMPANY_DATA_MANIFEST_KEY_PREFIX = 'synzapp.companyDataManifest.v1.';
const companyDataManifestSecureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: 'synzapp.company.data.manifest.v1'
};

export async function markCompanyDataScopeActive(scope: CompanyDataManifestScope): Promise<void> {
  if (!isValidScope(scope)) {
    return;
  }

  await saveCompanyDataManifest({
    ownerUid: scope.ownerUid,
    status: 'active',
    tenantId: scope.tenantId,
    updatedAt: new Date().toISOString(),
    version: 1
  });
}

export async function blockCompanyDataScope(input: CompanyDataManifestScope & {
  reason: CompanyDataPurgeReason;
}): Promise<void> {
  if (!isValidScope(input)) {
    return;
  }

  const nowIso = new Date().toISOString();

  await saveCompanyDataManifest({
    blockedAt: nowIso,
    ownerUid: input.ownerUid,
    reason: input.reason,
    status: 'blocked',
    tenantId: input.tenantId,
    updatedAt: nowIso,
    version: 1
  });
}

export async function markCompanyDataScopePurged(input: CompanyDataManifestScope & {
  errors?: Array<{
    message: string;
    step: string;
  }>;
  purgedAt: string;
  reason: CompanyDataPurgeReason;
}): Promise<void> {
  if (!isValidScope(input)) {
    return;
  }

  await saveCompanyDataManifest({
    blockedAt: input.purgedAt,
    lastPurgeAt: input.purgedAt,
    lastPurgeErrors: input.errors || [],
    ownerUid: input.ownerUid,
    reason: input.reason,
    status: 'purged',
    tenantId: input.tenantId,
    updatedAt: input.purgedAt,
    version: 1
  });
}

/**
 * Reasons a completed purge should keep the device locked out.
 *
 * A wipe ordered by the company, or one that followed a refusal, means this
 * device is not to hold the data again until the server says otherwise. An
 * ordinary sign-out means only that the local copy was cleaned up.
 */
const PURGE_REASONS_THAT_KEEP_A_DEVICE_BLOCKED: CompanyDataPurgeReason[] = [
  'access-denied',
  'device-revoked',
  'employee-removed',
  'organization-deleted',
  'remote-wipe',
  'session-invalid'
];

export async function isCompanyDataScopeBlocked(scope: CompanyDataManifestScope): Promise<boolean> {
  const manifest = await getCompanyDataManifest(scope);

  if (manifest?.status === 'blocked') {
    return true;
  }

  // 'purged' used to count as blocked on its own. Wiping local data at sign-out
  // is on by default, so every normal sign-out left this flag set, and the next
  // sign-in was refused with "Access denied" no matter what the server said.
  // Nothing on the server could clear it, so the device stayed locked out.
  return manifest?.status === 'purged' &&
    !!manifest.reason &&
    PURGE_REASONS_THAT_KEEP_A_DEVICE_BLOCKED.includes(manifest.reason);
}

export async function getCompanyDataManifest(
  scope: CompanyDataManifestScope
): Promise<CompanyDataManifestRecord | null> {
  if (!isValidScope(scope) || !await SecureStore.isAvailableAsync()) {
    return null;
  }

  const storedValue = await SecureStore.getItemAsync(
    getCompanyDataManifestKey(scope),
    companyDataManifestSecureStoreOptions
  );

  if (!storedValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(storedValue) as Partial<CompanyDataManifestRecord>;

    if (
      parsedValue.version === 1 &&
      parsedValue.ownerUid === scope.ownerUid &&
      parsedValue.tenantId === scope.tenantId &&
      (parsedValue.status === 'active' || parsedValue.status === 'blocked' || parsedValue.status === 'purged')
    ) {
      return parsedValue as CompanyDataManifestRecord;
    }
  } catch {
    return null;
  }

  return null;
}

async function saveCompanyDataManifest(record: CompanyDataManifestRecord): Promise<void> {
  if (!await SecureStore.isAvailableAsync()) {
    return;
  }

  await SecureStore.setItemAsync(
    getCompanyDataManifestKey(record),
    JSON.stringify(record),
    companyDataManifestSecureStoreOptions
  );
}

function getCompanyDataManifestKey(scope: CompanyDataManifestScope): string {
  return `${COMPANY_DATA_MANIFEST_KEY_PREFIX}${scope.tenantId}.${scope.ownerUid}`;
}

function isValidScope(scope: CompanyDataManifestScope): boolean {
  return Boolean(scope.ownerUid && scope.tenantId);
}
