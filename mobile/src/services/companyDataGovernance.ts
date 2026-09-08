import { clearStoredChatBackupRecoveryKey } from './chatBackup';
import { clearChatMediaStorage } from './chatMediaApi';
import { incrementChatOfflineCounterMetric } from './chatOfflineMetrics';
import { clearRegisteredDeviceIdentity } from './deviceIdentity';
import {
  blockCompanyDataScope,
  markCompanyDataScopePurged
} from './companyDataManifest';
import { clearSynzappCallStore } from './localCallStore';
import { clearLocalChatDataForOwner } from './localChatStore';
import { clearProfilePhotoCache } from './profilePhotoCache';

export type CompanyDataPurgeReason =
  | 'access-denied'
  | 'device-revoked'
  | 'employee-removed'
  | 'organization-deleted'
  | 'remote-wipe'
  | 'session-invalid'
  | 'sign-out';

export interface CompanyDataPurgeInput {
  clearBackupRecoveryKey?: boolean;
  clearDeviceIdentity?: boolean;
  ownerUid: string;
  reason: CompanyDataPurgeReason;
  tenantId?: string;
}

export interface CompanyDataPurgeResult {
  errors: Array<{
    message: string;
    step: string;
  }>;
  purgedAt: string;
  reason: CompanyDataPurgeReason;
}

// Enterprise company-data cleanup entry point. Keep chat, file, media, profile-photo,
// and future FILE workspace purges centralized so offboarding/revocation paths do not drift.
export async function purgeTenantCompanyData(input: CompanyDataPurgeInput): Promise<CompanyDataPurgeResult> {
  const purgedAt = new Date().toISOString();
  const errors: CompanyDataPurgeResult['errors'] = [];

  if (input.tenantId) {
    await blockCompanyDataScope({
      ownerUid: input.ownerUid,
      reason: input.reason,
      tenantId: input.tenantId
    }).catch((error) => {
      errors.push({
        message: error instanceof Error ? error.message : 'Unable to block local company data.',
        step: 'company-data-manifest-block'
      });
    });
  }

  const steps: Array<[string, () => Promise<void>]> = [
    [
      'local-chat',
      () => clearLocalChatDataForOwner({
        ownerUid: input.ownerUid,
        tenantId: input.tenantId
      })
    ],
    [
      'chat-media',
      () => clearChatMediaStorage({ includeLegacyDocumentStorage: true })
    ],
    [
      'call-store',
      () => input.tenantId
        ? clearSynzappCallStore({
            ownerUid: input.ownerUid,
            tenantId: input.tenantId
          })
        : Promise.resolve()
    ],
    [
      'profile-photo-cache',
      () => clearProfilePhotoCache()
    ]
  ];

  if (input.clearBackupRecoveryKey) {
    steps.push([
      'chat-backup-recovery-key',
      () => clearStoredChatBackupRecoveryKey()
    ]);
  }

  if (input.clearDeviceIdentity) {
    steps.push([
      'device-identity',
      () => clearRegisteredDeviceIdentity({ ownerUid: input.ownerUid })
    ]);
  }

  for (const [step, runStep] of steps) {
    try {
      await runStep();
    } catch (error) {
      errors.push({
        message: error instanceof Error ? error.message : 'Cleanup step failed.',
        step
      });
    }
  }

  if (input.tenantId) {
    await markCompanyDataScopePurged({
      errors,
      ownerUid: input.ownerUid,
      purgedAt,
      reason: input.reason,
      tenantId: input.tenantId
    }).catch((error) => {
      errors.push({
        message: error instanceof Error ? error.message : 'Unable to record local company data purge.',
        step: 'company-data-manifest-purged'
      });
    });

    await incrementChatOfflineCounterMetric(
      { ownerUid: input.ownerUid, tenantId: input.tenantId },
      errors.length ? 'purgeFailureCount' : 'purgeSuccessCount'
    ).catch(() => undefined);
  }

  return {
    errors,
    purgedAt,
    reason: input.reason
  };
}
