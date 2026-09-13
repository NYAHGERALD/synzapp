import { getSynzappApiBaseUrl } from './apiConfig';
import { purgeTenantCompanyData } from './companyDataGovernance';
import {
  clearRegisteredDeviceIdentity,
  getLocalDeviceHeaders
} from './deviceIdentity';

export interface PendingCompanyDataWipeCommand {
  commandId: string;
  commandType: 'PURGE_TENANT_COMPANY_DATA';
  createdAt: string | null;
  deviceId: string;
  reason: string;
  status: 'REQUESTED';
  tenantId: string;
  uid: string;
}

export interface CompanyDataWipeSyncResult {
  processedCount: number;
}

export async function processPendingCompanyDataWipeCommands(input: {
  idToken: string;
  ownerUid: string;
  tenantId: string;
}): Promise<CompanyDataWipeSyncResult> {
  const deviceHeaders = await getLocalDeviceHeaders(input.idToken);
  const commands = await listPendingCompanyDataWipeCommands(input.idToken, deviceHeaders);

  if (commands.length === 0) {
    return { processedCount: 0 };
  }

  const tenantId = commands[0]?.tenantId || input.tenantId;

  await purgeTenantCompanyData({
    clearBackupRecoveryKey: true,
    clearDeviceIdentity: false,
    ownerUid: input.ownerUid,
    reason: 'remote-wipe',
    tenantId
  });

  for (const command of commands) {
    await completeCompanyDataWipeCommand({
      commandId: command.commandId,
      deviceHeaders,
      idToken: input.idToken
    });
  }

  await clearRegisteredDeviceIdentity({ ownerUid: input.ownerUid });

  return { processedCount: commands.length };
}

async function listPendingCompanyDataWipeCommands(
  idToken: string,
  deviceHeaders: Record<string, string>
): Promise<PendingCompanyDataWipeCommand[]> {
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/profile/me/company-data-wipe-commands`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...deviceHeaders
    },
    method: 'GET'
  });

  if (!response.ok) {
    throw await buildResponseError(response);
  }

  const body = await response.json() as { commands?: PendingCompanyDataWipeCommand[] };

  return Array.isArray(body.commands) ? body.commands : [];
}

async function completeCompanyDataWipeCommand(input: {
  commandId: string;
  deviceHeaders: Record<string, string>;
  idToken: string;
}): Promise<void> {
  const response = await fetch(
    `${getSynzappApiBaseUrl()}/api/profile/me/company-data-wipe-commands/${encodeURIComponent(input.commandId)}/complete`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.idToken}`,
        ...input.deviceHeaders
      },
      method: 'POST'
    }
  );

  if (!response.ok) {
    throw await buildResponseError(response);
  }
}

/**
 * The server's refusal, with its code kept.
 *
 * A refusal the app has to act on — a handset signed out of chat, for one —
 * carries a code, and flattening it to a message is how a revoked device ended
 * up not recognising itself and never wiping.
 */
async function buildResponseError(response: Response): Promise<Error> {
  const fallback = 'Unable to process company data cleanup.';

  try {
    const body = await response.json() as { code?: unknown; error?: unknown } | null;
    const message = typeof body?.error === 'string' && body.error.trim() ? body.error : fallback;
    const error = new Error(message);

    return typeof body?.code === 'string' && body.code
      ? Object.assign(error, { code: body.code })
      : error;
  } catch {
    return new Error(fallback);
  }
}
