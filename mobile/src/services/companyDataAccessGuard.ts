import { ACCESS_DENIED_MESSAGE } from './backendAuth';
import {
  blockCompanyDataScope,
  isCompanyDataScopeBlocked,
  type CompanyDataManifestScope
} from './companyDataManifest';
import { purgeTenantCompanyData } from './companyDataGovernance';

export function isCompanyAccessDeniedMessage(message: unknown): boolean {
  return typeof message === 'string' &&
    /access denied|not active|deactivated|suspended|archived|deleted|revoked|removed|contact your organization administrator/i.test(message);
}

export function isCompanyAccessDeniedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');

  return message === ACCESS_DENIED_MESSAGE || isCompanyAccessDeniedMessage(message);
}

export async function assertCompanyDataRenderable(scope: CompanyDataManifestScope): Promise<void> {
  if (await isCompanyDataScopeBlocked(scope)) {
    throw new Error(ACCESS_DENIED_MESSAGE);
  }
}

export async function purgeCompanyDataAfterAccessDenied(input: CompanyDataManifestScope & {
  clearBackupRecoveryKey?: boolean;
  clearDeviceIdentity?: boolean;
}): Promise<void> {
  await blockCompanyDataScope({
    ownerUid: input.ownerUid,
    reason: 'access-denied',
    tenantId: input.tenantId
  });
  await purgeTenantCompanyData({
    clearBackupRecoveryKey: input.clearBackupRecoveryKey ?? true,
    clearDeviceIdentity: input.clearDeviceIdentity ?? true,
    ownerUid: input.ownerUid,
    reason: 'access-denied',
    tenantId: input.tenantId
  });
}
