import React from 'react';
import { HardDriveUpload, RefreshCw, X } from 'lucide-react';

import {
  getRailsEvidenceSizePolicy,
  updateRailsEvidenceSizePolicy,
  type RailsEvidenceSizePolicy
} from './railsApi';

const MB = 1024 * 1024;

/**
 * The sizes offered, rather than a free-text box.
 *
 * A number typed by hand invites 4194304, and somebody eventually types a
 * digit too many. The list is filtered to what Synzapp allows this
 * organization, so an unreachable choice is never shown at all.
 */
const SIZE_CHOICES = [4, 10, 25, 50, 100];

/**
 * How large an evidence file this organization allows.
 *
 * Chosen here, but only up to the ceiling Synzapp sets for this organization:
 * the storage is Synzapp's to commit, and which files are worth keeping is the
 * organization's to judge. Both numbers are shown, because a limit somebody
 * cannot raise is confusing until they know who can.
 */
export function EvidenceSizePanel({ onClose }: { onClose: () => void }) {
  const [policy, setPolicy] = React.useState<RailsEvidenceSizePolicy | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);

    try {
      setPolicy(await getRailsEvidenceSizePolicy());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'That setting could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function save(maxFileBytes: number) {
    setIsSaving(true);

    try {
      setPolicy(await updateRailsEvidenceSizePolicy(maxFileBytes));
      setError(null);
      setSavedAt(Date.now());
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'That limit could not be saved.');
      // Put back what the server actually holds, rather than leaving the
      // control showing a value that was refused.
      void load();
    } finally {
      setIsSaving(false);
    }
  }

  const allowedChoices = SIZE_CHOICES.filter(
    (megabytes) => !policy || megabytes * MB <= policy.maxAllowedFileBytes
  );

  return (
    <section className="page-section" aria-labelledby="evidence-size-title">
      <div className="page-section-head">
        <h2 id="evidence-size-title">
          <HardDriveUpload aria-hidden={true} size={18} /> Evidence uploads
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

      {isLoading && !policy ? <p className="tenant-devices-empty">Loading the current limit…</p> : null}

      {policy ? (
        <div className="evidence-size-body">
          <p className="evidence-size-lead">
            The largest single file anybody in this organization can add to the evidence library.
            It applies to RCA and RAILS alike, since they share one library.
          </p>

          <div className="evidence-size-choices" role="group" aria-label="Evidence file size limit">
            {allowedChoices.map((megabytes) => {
              const bytes = megabytes * MB;
              const isActive = policy.maxFileBytes === bytes;

              return (
                <button
                  aria-pressed={isActive}
                  className={`evidence-size-choice ${isActive ? 'is-active' : ''}`}
                  disabled={isSaving}
                  key={megabytes}
                  onClick={() => void save(bytes)}
                  type="button"
                >
                  {megabytes} MB
                </button>
              );
            })}
          </div>

          <p className="evidence-size-note">
            Synzapp allows this organization up to {describeMegabytes(policy.maxAllowedFileBytes)}.
            {policy.maxAllowedFileBytes < 100 * MB ? ' Ask Synzapp to raise it if you need more.' : ''}
          </p>

          {savedAt ? <p className="evidence-size-saved">Saved.</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function describeMegabytes(bytes: number): string {
  const megabytes = bytes / MB;

  return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`;
}
