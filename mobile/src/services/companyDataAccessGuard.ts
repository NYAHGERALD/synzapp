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

/**
 * Chat is on another phone and this one may ask for it back.
 *
 * Deliberately *not* an access denial. A phone chat was moved away from still
 * carries a revoked record and is signed in on again precisely to take chat
 * back — treating that as being shut out made the app wipe itself and drop the
 * session, racing the registration that was raising the prompt to move chat
 * here. The person was signed out on their first attempt and it only worked on
 * the second, once the wipe had cleared the record away.
 */
export const DEVICE_NEEDS_RECLAIM_CODE = 'DEVICE_NEEDS_RECLAIM';

export function isDeviceNeedsReclaimError(error: unknown): boolean {
  return Boolean(error) &&
    typeof error === 'object' &&
    (error as { code?: unknown }).code === DEVICE_NEEDS_RECLAIM_CODE;
}

export function isCompanyAccessDeniedError(error: unknown): boolean {
  if (isDeviceNeedsReclaimError(error)) {
    return false;
  }

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
