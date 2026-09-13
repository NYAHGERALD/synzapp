import React from 'react';
import { LockKeyhole, RefreshCw, Smartphone, X } from 'lucide-react';

import { listTenantDevices, revokeTenantDevice, type TenantDevice } from './tenantDevicesApi';

/**
 * The organization's registered phones, and signing one out.
 *
 * Built because this is the one administrator job that may be needed *because* a
 * phone is gone. Until now both routes demanded a working registered phone, so
 * somebody who had just lost theirs could not revoke it, and nobody could do it
 * from a computer at all.
 *
 * Only ever shows this administrator's own organization — the server answers
 * with their tenant and refuses any device outside it, so the scope is not this
 * component's to decide or to display a filter for.
 */
export function TenantDevicesPanel({ onClose }: { onClose: () => void }) {
  const [devices, setDevices] = React.useState<TenantDevice[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [pendingDeviceId, setPendingDeviceId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);

    try {
      setDevices(await listTenantDevices());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Devices could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function signOutDevice(device: TenantDevice) {
    /**
     * Asked plainly, because it cannot be undone from here.
     *
     * The phone is signed out at once; it destroys its copy of company data when
     * it next reaches the network. Saying so avoids the reading that the data is
     * already gone the moment this returns.
     */
    const confirmed = window.confirm(
      `Sign ${device.displayName}'s ${describePlatform(device.platform)} out of Synzapp?\n\n` +
      'It loses access straight away, and clears its copy of company data the next ' +
      'time it reaches the network. This cannot be undone from here — they will ' +
      'have to sign in again on that phone.'
    );

    if (!confirmed) {
      return;
    }

    setPendingDeviceId(device.deviceId);

    try {
      const revoked = await revokeTenantDevice({
        deviceId: device.deviceId,
        reason: 'Signed out by an administrator'
      });

      setDevices((current) => current.map((entry) => (
        entry.deviceId === revoked.deviceId ? revoked : entry
      )));
      setError(null);
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'That device could not be signed out.');
    } finally {
      setPendingDeviceId(null);
    }
  }

  const activeDevices = devices.filter((device) => device.status === 'ACTIVE');
  const signedOutDevices = devices.filter((device) => device.status !== 'ACTIVE');

  return (
    <section className="page-section" aria-labelledby="tenant-devices-title">
      <div className="page-section-head">
        <h2 id="tenant-devices-title">
          <LockKeyhole aria-hidden={true} size={18} /> Organization devices
        </h2>
        <div className="tenant-devices-actions">
          <button className="tenant-devices-action" disabled={isLoading} onClick={() => void load()} type="button">
            <RefreshCw aria-hidden={true} size={14} /> Refresh
          </button>
          <button className="tenant-devices-action" onClick={onClose} type="button">
            <X aria-hidden={true} size={14} /> Close
          </button>
        </div>
      </div>

      {error ? <p className="tenant-devices-error">{error}</p> : null}

      {isLoading && !devices.length ? <p className="tenant-devices-empty">Loading devices…</p> : null}

      {!isLoading && !devices.length && !error ? (
        <p className="tenant-devices-empty">No devices are registered to this organization yet.</p>
      ) : null}

      {activeDevices.length ? (
        <div className="tenant-devices-list">
          {activeDevices.map((device) => (
            <article className="tenant-device" key={device.deviceId}>
              <span className="tenant-device-icon">
                <Smartphone aria-hidden={true} size={18} />
              </span>
              <div className="tenant-device-text">
                <h3>{device.displayName}</h3>
                <p>
                  {describePlatform(device.platform)} · {device.roleName} · last used {describeWhen(device.lastSeenAt)}
                </p>
              </div>
              <button
                className="tenant-device-revoke"
                disabled={pendingDeviceId === device.deviceId}
                onClick={() => void signOutDevice(device)}
                type="button"
              >
                {pendingDeviceId === device.deviceId ? 'Signing out…' : 'Sign out'}
              </button>
            </article>
          ))}
        </div>
      ) : null}

      {signedOutDevices.length ? (
        <div className="tenant-devices-list tenant-devices-list-revoked">
          <h3 className="tenant-devices-subhead">Signed out</h3>
          {signedOutDevices.map((device) => (
            <article className="tenant-device tenant-device-revoked" key={device.deviceId}>
              <span className="tenant-device-icon">
                <Smartphone aria-hidden={true} size={18} />
              </span>
              <div className="tenant-device-text">
                <h3>{device.displayName}</h3>
                <p>
                  {describePlatform(device.platform)} · signed out {describeWhen(device.revokedAt)}
                  {device.revocationReason ? ` · ${device.revocationReason}` : ''}
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function describePlatform(platform: string): string {
  if (platform === 'ios') {
    return 'iPhone';
  }

  if (platform === 'android') {
    return 'Android phone';
  }

  return 'Unknown device';
}

/** Says nothing rather than guessing when the server sent no date. */
function describeWhen(value: string | null): string {
  if (!value) {
    return 'never';
  }

  const time = Date.parse(value);

  if (!Number.isFinite(time)) {
    return 'never';
  }

  return new Date(time).toLocaleString();
}
