import { getSynzappApiBaseUrl } from './config';
import { getAppCheckHeader, getSynzappFirebaseAuth } from './firebase';

/**
 * The devices registered to an organization, and signing one out.
 *
 * This exists because revoking a device is the one administrator job that may be
 * needed *because* a phone is gone. Both routes used to demand a working
 * registered phone, so the person who had just lost theirs could not revoke it,
 * and nobody could do it from a computer at all — a browser registers no device.
 *
 * The tenant scope is the server's to enforce, not this file's: it answers with
 * the caller's own organization and refuses any device outside it.
 */

export interface TenantDevice {
  createdAt: string | null;
  deviceId: string;
  displayName: string;
  lastSeenAt: string | null;
  platform: string;
  revokedAt: string | null;
  revocationReason: string | null;
  roleName: string;
  status: string;
  uid: string;
}

export async function listTenantDevices(): Promise<TenantDevice[]> {
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/admin/devices`, {
    headers: await buildHeaders(),
    method: 'GET'
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Devices could not be loaded.'));
  }

  const body = await response.json() as { devices?: TenantDevice[] };

  return body.devices || [];
}

/**
 * Signs a device out and orders it to destroy its copy of company data.
 *
 * The wipe is the server's to arrange. Worth knowing when reading the result:
 * the handset only carries it out once it next reaches the network, so a phone
 * that is switched off is signed out immediately and cleared later.
 */
export async function revokeTenantDevice(input: {
  deviceId: string;
  reason?: string;
}): Promise<TenantDevice> {
  const response = await fetch(
    `${getSynzappApiBaseUrl()}/api/admin/devices/${encodeURIComponent(input.deviceId)}/revoke`,
    {
      body: JSON.stringify(input.reason ? { reason: input.reason } : {}),
      headers: {
        ...await buildHeaders(),
        'Content-Type': 'application/json'
      },
      method: 'POST'
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'That device could not be signed out.'));
  }

  const body = await response.json() as { device?: TenantDevice };

  if (!body.device) {
    throw new Error('That device could not be signed out.');
  }

  return body.device;
}

async function buildHeaders(): Promise<Record<string, string>> {
  const user = getSynzappFirebaseAuth().currentUser;

  if (!user) {
    throw new Error('You are not signed in.');
  }

  return {
    Accept: 'application/json',
    Authorization: `Bearer ${await user.getIdToken()}`,
    ...await getAppCheckHeader()
  };
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json() as { error?: unknown };

    return typeof body?.error === 'string' && body.error.trim() ? body.error : fallback;
  } catch {
    return fallback;
  }
}
