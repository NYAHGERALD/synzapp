import { ACCESS_DENIED_MESSAGE } from './backendAuth';
import {
  blockCompanyDataScope,
  isCompanyDataScopeBlocked,
  type CompanyDataManifestScope
} from './companyDataManifest';
import { purgeTenantCompanyData } from './companyDataGovernance';

/**
 * What the server says when this handset has been signed out of chat.
 *
 * A code, because the wording check below could never have caught it: the
 * backend's message was "This device is not authorized." and none of those words
 * appear in the pattern. A revoked handset therefore failed every request,
 * showed a generic error, and never destroyed its copy of company data — while
 * the console reported the wipe as done.
 */
export const DEVICE_REVOKED_CODE = 'DEVICE_REVOKED';

export function isDeviceRevokedError(error: unknown): boolean {
  return Boolean(error) &&
    typeof error === 'object' &&
    (error as { code?: unknown }).code === DEVICE_REVOKED_CODE;
}

export function isCompanyAccessDeniedMessage(message: unknown): boolean {
  return typeof message === 'string' &&
    /access denied|not active|deactivated|suspended|archived|deleted|revoked|removed|contact your organization administrator/i.test(message);
}

export function isCompanyAccessDeniedError(error: unknown): boolean {
  if (isDeviceRevokedError(error)) {
    return true;
  }

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
