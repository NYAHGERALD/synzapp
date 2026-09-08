import React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import {
  applyLegalHold,
  approveDisposition,
  createComplianceExport,
  explainRetention,
  extendDisposition,
  loadArchiveKeyStatus,
  listCompliancePeople,
  simulateRetentionPolicy,
  getComplianceExportDownloadUrl,
  listComplianceExports,
  loadComplianceOverview,
  PhoneVerificationRequiredError,
  releaseLegalHold,
  searchArchive,
  runRetentionEvaluation,
  saveRetentionPolicy,
  setRetentionPolicyState,
  type ComplianceOverview
} from './complianceApi';
import {
  describeConversation,
  describeOutcome,
  splitRules
} from './retentionExplainDisplay';
import {
  buildSimulationLines,
  describeAddedEffect,
  describeScanLimit,
  describeSimulationHeadline
} from './retentionSimulationDisplay';
import {
  describeExport,
  formatBytes,
  describeExportProgress,
  exportProgressFraction,
  formatPickedDate,
  isExportInProgress,
  formatSentAt,
  nameForUid,
  toDateOnlyValue,
  toSearchHitRow,
  validateSearchCriteria
} from './ediscoveryDisplay';
import {
  formatRelativeDay,
  splitDispositionQueue,
  toHoldRow,
  toPolicyRow,
  type HoldRow
} from './complianceDisplay';
import {
  createRetentionPolicyDraft,
  parseDurationDays,
  parseScopeTargets,
  describeDraft,
  getDraftBlockingError,
  getStepError,
  RETENTION_CONTENT_TYPES,
  toCreateInput,
  WIZARD_STEP_LABELS,
  type RetentionPolicyCreateInput,
  type RetentionPolicyDraft,
  type WizardStep
} from './retentionWizard';
import type {
  ArchiveKeyStatus,
  ConversationRetentionExplanation,
  RetentionSimulation,
  ArchivedMessageHit,
  CompliancePerson,
  ComplianceExportSummary,
  DispositionItem,
  LegalHoldSummary,
  RetentionAction,
  RetentionPolicy,
  RetentionScopeKind
} from './complianceApi';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  Download,
  FileSearch,
  Gavel,
  Layers,
  Plus,
  Scale,
  ShieldCheck,
  Trash2
} from 'lucide-react';

/**
 * Retention & Legal Hold admin console.
 *
 * Reads live tenant data from `/api/compliance`. The screens were designed ahead
 * of the backend so the model could be reviewed first; they now show what the
 * tenant actually has.
 *
 * Two ideas the screens exist to carry, and which should survive into the real
 * implementation:
 *
 * 1. Media retention is derived, never configured. An attachment inherits the
 *    longest retention of every message referencing it. That is why there is no
 *    media duration field anywhere in this UI, and why the policy list and the
 *    explainer both say so out loud.
 * 2. A legal hold outranks everything, including the Org Admin. Without that
 *    backstop, shortening a retention policy is a documented way to destroy
 *    discoverable evidence.
 *
 * Three actions here can destroy records and each asks the admin to verify their
 * phone again first: approving a destruction, releasing a hold, and switching a
 * policy on. Extending a deadline never does — the safe direction should never
 * be the harder one.
 */

type RetentionView = 'policies' | 'wizard' | 'holds' | 'explainer' | 'disposition' | 'ediscovery';

interface RetentionConsoleProps {
  adminName?: string;
}

const NAV_ITEMS: Array<{ id: RetentionView; icon: React.ElementType; label: string }> = [
  { id: 'policies', icon: Layers, label: 'Retention policies' },
  { id: 'holds', icon: Gavel, label: 'Legal holds' },
  { id: 'disposition', icon: Trash2, label: 'Disposition review' },
  { id: 'ediscovery', icon: Scale, label: 'Search & export' },
  { id: 'explainer', icon: FileSearch, label: 'Retention explainer' }
];

export function RetentionConsole({ adminName = 'Org Admin' }: RetentionConsoleProps) {
  const [view, setView] = React.useState<RetentionView>('policies');
  const [overview, setOverview] = React.useState<ComplianceOverview | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [needsPhoneVerification, setNeedsPhoneVerification] = React.useState(false);
  const [evaluationNote, setEvaluationNote] = React.useState<string | null>(null);
  /**
   * How many conversations the last evaluation examined.
   *
   * Null until one has run. Showing a made-up total on a compliance screen is
   * worse than showing nothing: an administrator has no way to tell an estimate
   * from a fact, and this page is read to decide whether records are protected.
   */
  const [governedCount, setGovernedCount] = React.useState<number | null>(null);

  const nowMs = Date.now();
  const activeHoldCount = (overview?.holds || [])
    .filter((hold) => !hold.releasedAtMs || (hold.delayUntilMs || 0) > nowMs)
    .length;
  const pendingCount = (overview?.dispositionQueue || [])
    .filter((item) => item.state === 'PENDING' || item.state === 'EXTENDED')
    .length;

  const reload = React.useCallback(async () => {
    try {
      setLoadError(null);
      setOverview(await loadComplianceOverview());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Compliance data could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * Runs an action and reloads, separating "verify your phone" from a real
   * failure.
   *
   * A stale phone verification is not an error the admin caused, and telling
   * them to sign in again would be wrong — they are signed in.
   */
  const runAction = React.useCallback(async (action: () => Promise<unknown>) => {
    setActionError(null);
    setNeedsPhoneVerification(false);

    try {
      await action();
      await reload();
    } catch (error) {
      if (error instanceof PhoneVerificationRequiredError) {
        setNeedsPhoneVerification(true);
        return;
      }

      setActionError(error instanceof Error ? error.message : 'That action could not be completed.');
    }
  }, [reload]);

  return (
    <div className="retention-console">
      <div className="retention-body">
        {/* Tabs, not a second sidebar. The workspace already has one on the
            left, and two columns of navigation either side of the content ask
            somebody to work out which list a thing belongs to before they can
            look for it. */}
        <nav aria-label="Compliance sections" className="retention-tabs">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;

            return (
              <button
                aria-current={view === item.id ? 'page' : undefined}
                className={view === item.id || (view === 'wizard' && item.id === 'policies')
                  ? 'retention-tab is-active'
                  : 'retention-tab'}
                key={item.id}
                onClick={() => setView(item.id)}
                type="button"
              >
                <Icon aria-hidden size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {needsPhoneVerification ? (
          <div className="retention-note is-warn" role="alert">
            <ShieldCheck aria-hidden size={17} />
            <div>
              <p className="retention-note-title">Verify your phone number to continue</p>
              <p>
                Approving a deletion, releasing a hold or switching a policy on all need a
                phone verification from the last few minutes. Sign in again, then retry.
              </p>
            </div>
          </div>
        ) : null}

        {actionError ? (
          <div className="retention-note is-warn" role="alert">
            <AlertTriangle aria-hidden size={17} />
            <div>
              <p className="retention-note-title">That action could not be completed</p>
              <p>{actionError}</p>
            </div>
          </div>
        ) : null}

        {loadError ? (
          <div className="retention-note is-warn" role="alert">
            <AlertTriangle aria-hidden size={17} />
            <div>
              <p className="retention-note-title">Compliance data could not be loaded</p>
              <p>{loadError}</p>
            </div>
          </div>
        ) : null}

        {view === 'policies' ? (
          <PoliciesScreen
            activeHoldCount={activeHoldCount}
            evaluationNote={evaluationNote}
            governedCount={governedCount}
            pendingCount={pendingCount}
            isLoading={isLoading}
            onEvaluate={() => void runAction(async () => {
              const { summary } = await runRetentionEvaluation();

              setGovernedCount(summary.examined);
              setEvaluationNote(
                summary.queued
                  ? `${summary.queued} conversation(s) added to Disposition review. ${summary.withheld} withheld by a legal hold.`
                  : `Nothing has expired. ${summary.examined} conversation(s) checked, ${summary.withheld} withheld by a legal hold.`
              );
            })}
            onActivate={(policyId) => void runAction(() => setRetentionPolicyState(policyId, 'ACTIVE'))}
            onNewPolicy={() => setView('wizard')}
            policies={overview?.policies || []}
            slaDays={overview?.slaDays || 0}
          />
        ) : null}
        {view === 'wizard' ? (
          <WizardScreen
            onBack={() => setView('policies')}
            onCreated={async (input) => {
              await saveRetentionPolicy(input);
              await reload();
              setView('policies');
            }}
            slaDays={overview?.slaDays || 0}
          />
        ) : null}
        {view === 'holds' ? (
          <HoldsScreen
            holds={overview?.holds || []}
            isLoading={isLoading}
            onApply={(input) => void runAction(() => applyLegalHold(input))}
            onRelease={(holdId) => void runAction(() => releaseLegalHold(holdId))}
          />
        ) : null}
        {view === 'ediscovery' ? (
          <EdiscoveryScreen holds={overview?.holds || []} />
        ) : null}
        {view === 'explainer' ? (
          <ExplainerScreen holds={overview?.holds || []} policies={overview?.policies || []} />
        ) : null}
        {view === 'disposition' ? (
          <DispositionScreen
            adminName={adminName}
            isLoading={isLoading}
            items={overview?.dispositionQueue || []}
            onApprove={(itemId) => void runAction(() => approveDisposition(itemId))}
            onExtend={(itemId) => void runAction(() => extendDisposition(itemId, 30))}
            slaDays={overview?.slaDays || 0}
          />
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Screen 1 — Retention policies                                       */
/* ------------------------------------------------------------------ */

function PoliciesScreen({
  activeHoldCount,
  evaluationNote,
  governedCount,
  isLoading,
  onActivate,
  onEvaluate,
  onNewPolicy,
  pendingCount,
  policies,
  slaDays
}: {
  activeHoldCount: number;
  evaluationNote: string | null;
  /** Null until an evaluation has run — the count is not known before then. */
  governedCount: number | null;
  isLoading: boolean;
  onActivate: (policyId: string) => void;
  onEvaluate: () => void;
  onNewPolicy: () => void;
  pendingCount: number;
  policies: RetentionPolicy[];
  slaDays: number;
}) {
  const rows = policies.map(toPolicyRow);
  const activeCount = policies.filter((policy) => policy.state === 'ACTIVE').length;
  const simulationCount = policies.filter((policy) => policy.state === 'SIMULATION').length;

  return (
    <>
      <ScreenHeader
        actions={
          <>
            <button className="retention-btn" onClick={onEvaluate} type="button">
              Check what has expired
            </button>
            <button className="retention-btn is-primary" onClick={onNewPolicy} type="button">
              <Plus aria-hidden size={15} />
              New policy
            </button>
          </>
        }
        subtitle="Rules that decide how long content lives. Legal holds override every policy on this page."
        title="Retention policies"
      />

      {evaluationNote ? (
        <div className="retention-note is-signal" role="status">
          <Clock aria-hidden size={17} />
          <div>
            <p className="retention-note-title">Retention checked</p>
            <p>{evaluationNote}</p>
          </div>
        </div>
      ) : null}

      {/* The single most important claim in the product, stated before any
          control the admin might otherwise misread. */}
      <div className="retention-note is-signal">
        <ShieldCheck aria-hidden size={17} />
        <div>
          <p className="retention-note-title">Media retention is derived, not configured.</p>
          <p>
            An attachment inherits the longest retention of every message that references it, so no
            policy on this page can delete media while its conversation is still retained.
          </p>
        </div>
      </div>

      <div className="retention-stat-row">
        <StatCard
          caption={simulationCount ? `${simulationCount} in simulation` : 'None in simulation'}
          label="Active policies"
          value={String(activeCount)}
        />
        <StatCard
          caption={activeCount ? 'Covered by an active policy' : 'Nothing is on a schedule yet'}
          label="Conversations governed"
          value={governedCount === null ? '—' : String(governedCount)}
        />
        <StatCard
          caption={activeHoldCount ? 'Blocking all deletion they cover' : 'Nothing is preserved'}
          label="Active legal holds"
          tone={activeHoldCount ? 'signal' : undefined}
          value={String(activeHoldCount)}
        />
        <StatCard
          caption={pendingCount ? 'Waiting on your decision' : 'Nothing to review'}
          label="Awaiting disposition"
          value={String(pendingCount)}
        />
      </div>

      <div className="retention-table-wrap">
        <table className="retention-table">
          <thead>
            <tr>
              <th>Policy</th>
              <th>Scope</th>
              <th>Action</th>
              <th>Duration</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((policy) => (
              <tr key={policy.id}>
                <td className="retention-cell-strong">{policy.name}</td>
                <td>
                  <span className="retention-scope">{policy.scopeSummary}</span>
                  <span className="retention-scope-detail">{policy.scopeDetail}</span>
                </td>
                <td>{policy.action}</td>
                <td className="retention-cell-num">{policy.duration}</td>
                <td><StateBadge state={policy.state} /></td>
                <td>
                  {policy.state === 'Simulation' ? (
                    <button
                      className="retention-btn"
                      onClick={() => onActivate(policy.id)}
                      type="button"
                    >
                      Activate
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {!rows.length && !isLoading ? (
              <tr>
                <td colSpan={6}>
                  No retention policies yet. Until one exists, nothing is deleted on a schedule.
                </td>
              </tr>
            ) : null}
            {isLoading ? (
              <tr><td colSpan={6}>Loading retention policies…</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Screen 2 — New policy wizard, step 4                                */
/* ------------------------------------------------------------------ */

const RETENTION_ACTIONS = [
  {
    description: 'Keep content for the full period and never delete it automatically. Users can still delete from their own view.',
    id: 'retain',
    label: 'Retain only'
  },
  {
    description: 'Keep for the period, then permanently delete. The default for most policies.',
    id: 'retain_then_delete',
    label: 'Retain, then delete'
  },
  {
    description: 'Delete after the period with no retention guarantee. Suspended whenever another policy retains the same content.',
    id: 'delete',
    label: 'Delete only'
  }
];

function WizardScreen({
  onBack,
  onCreated,
  slaDays
}: {
  onBack: () => void;
  onCreated: (input: RetentionPolicyCreateInput) => Promise<void>;
  slaDays: number;
}) {
  const [step, setStep] = React.useState<WizardStep>(0);
  const [draft, setDraft] = React.useState(createRetentionPolicyDraft);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const stepError = getStepError(draft, step);
  const blockingError = getDraftBlockingError(draft);

  function update(changes: Partial<RetentionPolicyDraft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  async function handleCreate() {
    if (blockingError) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await onCreated(toCreateInput(draft));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'The policy could not be created.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <ScreenHeader
        actions={<button className="retention-btn" onClick={onBack} type="button">Cancel</button>}
        subtitle={`Step ${step + 1} of ${WIZARD_STEP_LABELS.length}: ${WIZARD_STEP_LABELS[step]}`}
        title="New retention policy"
      />

      <ol className="retention-steps">
        {WIZARD_STEP_LABELS.map((label, index) => (
          <li
            className={index === step ? 'is-current' : index < step ? 'is-done' : ''}
            key={label}
          >
            <span className="retention-step-mark">
              {index < step ? <Check aria-hidden size={13} /> : index + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      <div className="retention-split">
        <section className="retention-panel">
          {step === 0 ? (
            <>
              <h3>What is this policy called?</h3>
              <p className="retention-panel-sub">
                Colleagues reviewing a deletion months from now will see this name, so make it
                describe the obligation rather than the mechanism.
              </p>
              <label className="retention-field">
                <span>Policy name</span>
                <input
                  onChange={(event) => update({ name: event.target.value })}
                  placeholder="Contractor conversations"
                  type="text"
                  value={draft.name}
                />
              </label>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <h3>What does it cover?</h3>
              <p className="retention-panel-sub">
                If two rules disagree about the same chat, the more specific rule wins.
              </p>
              <label className="retention-field">
                <span>Scope</span>
                <select
                  onChange={(event) => update({ scopeKind: event.target.value as RetentionScopeKind })}
                  value={draft.scopeKind}
                >
                  <option value="organization">The whole organization</option>
                  <option value="user">Named people</option>
                  <option value="conversation">Named conversations</option>
                </select>
              </label>

              {draft.scopeKind === 'user' ? (
                <ScopePeoplePicker
                  onChange={(uids) => update({ scopeTargetsText: uids.join('\n') })}
                  selected={parseScopeTargets(draft.scopeTargetsText)}
                />
              ) : null}

              {draft.scopeKind === 'conversation' ? (
                <label className="retention-field">
                  <span>Chats, one per line</span>
                  <textarea
                    onChange={(event) => update({ scopeTargetsText: event.target.value })}
                    rows={5}
                    value={draft.scopeTargetsText}
                  />
                  <span className="retention-panel-sub">
                    Paste chat references from a search result. A reference that matches nothing is
                    reported below before you can continue.
                  </span>
                </label>
              ) : null}

              {draft.scopeKind === 'organization' ? (
                <div className="retention-note is-warn">
                  <AlertTriangle aria-hidden size={17} />
                  <div>
                    <p className="retention-note-title">This covers every chat in your company.</p>
                    <p>Only a legal hold can stop it.</p>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {step === 2 ? (
            <>
              <h3>Which content?</h3>
              <p className="retention-panel-sub">
                Leave everything unticked to cover all content.
              </p>
              <div className="retention-choices">
                {RETENTION_CONTENT_TYPES.map((option) => (
                  <label className="retention-choice" key={option.id}>
                    <input
                      checked={draft.contentTypes.includes(option.id)}
                      onChange={(event) => update({
                        contentTypes: event.target.checked
                          ? [...draft.contentTypes, option.id]
                          : draft.contentTypes.filter((id) => id !== option.id)
                      })}
                      type="checkbox"
                    />
                    <span><span className="retention-choice-label">{option.label}</span></span>
                  </label>
                ))}
              </div>

              {/* Restated here because this is the screen where an admin would
                  otherwise conclude that unticking attachments protects them. */}
              <div className="retention-note is-signal">
                <ShieldCheck aria-hidden size={17} />
                <div>
                  <p className="retention-note-title">Attachments follow their messages.</p>
                  <p>
                    An attachment inherits the longest retention of every message referencing it, so
                    it is never deleted while one of those messages is still kept.
                  </p>
                </div>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <h3>What should happen to this content?</h3>
              <div className="retention-choices">
                {RETENTION_ACTIONS.map((option) => (
                  <label
                    className={draft.action === option.id ? 'retention-choice is-selected' : 'retention-choice'}
                    key={option.id}
                  >
                    <input
                      checked={draft.action === option.id}
                      name="retention-action"
                      onChange={() => update({ action: option.id as RetentionAction })}
                      type="radio"
                      value={option.id}
                    />
                    <span>
                      <span className="retention-choice-label">{option.label}</span>
                      <span className="retention-choice-desc">{option.description}</span>
                    </span>
                  </label>
                ))}
              </div>

              {draft.action !== 'retain' ? (
                <div className="retention-field-row">
                  <label className="retention-field">
                    <span>Duration</span>
                    <span className="retention-input-group">
                      <input
                        inputMode="numeric"
                        onChange={(event) => update({ durationDays: event.target.value })}
                        type="text"
                        value={draft.durationDays}
                      />
                      <span className="retention-input-suffix">days</span>
                    </span>
                  </label>
                  <label className="retention-field">
                    <span>Period starts</span>
                    <select
                      onChange={(event) => update({ anchor: event.target.value as 'created' | 'last_modified' })}
                      value={draft.anchor}
                    >
                      <option value="created">When the content was created</option>
                      <option value="last_modified">When the content was last modified</option>
                    </select>
                  </label>
                </div>
              ) : null}

              <p className="retention-sla">
                <Clock aria-hidden size={14} />
                Deletion completes within {slaDays} days of expiry.
              </p>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <h3>Review</h3>
              <p className="retention-panel-sub">{describeDraft(draft)}</p>

              <dl className="retention-sim-list">
                <DetailRow label="Name" value={draft.name} />
                <DetailRow
                  label="Scope"
                  value={draft.scopeKind === 'organization'
                    ? 'The whole organization'
                    : `${parseScopeTargets(draft.scopeTargetsText).length} ${draft.scopeKind === 'user' ? 'people' : 'conversations'}`}
                />
                <DetailRow
                  label="Content"
                  value={draft.contentTypes.length ? draft.contentTypes.join(', ') : 'All content'}
                />
                <DetailRow label="Completes within" value={`${slaDays} days of expiry`} />
              </dl>

              {/* Every policy is created switched off. Saying so here prevents an
                  admin leaving this screen believing deletion has begun. */}
              <div className="retention-note is-signal">
                <ShieldCheck aria-hidden size={17} />
                <div>
                  <p className="retention-note-title">This policy starts in simulation.</p>
                  <p>
                    It deletes nothing until you activate it from the policy list, which asks you to
                    verify your phone number first.
                  </p>
                </div>
              </div>

              {saveError ? (
                <div className="retention-note is-warn" role="alert">
                  <AlertTriangle aria-hidden size={17} />
                  <div>
                    <p className="retention-note-title">The policy could not be created</p>
                    <p>{saveError}</p>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {stepError ? (
            <p className="retention-panel-sub" role="alert">{stepError}</p>
          ) : null}

          <div className="retention-actions">
            <button
              className="retention-btn"
              onClick={() => (step === 0 ? onBack() : setStep((step - 1) as WizardStep))}
              type="button"
            >
              <ArrowLeft aria-hidden size={15} />
              Back
            </button>

            {step < 4 ? (
              <button
                className="retention-btn is-primary"
                disabled={Boolean(stepError)}
                onClick={() => setStep((step + 1) as WizardStep)}
                type="button"
              >
                Continue
                <ChevronRight aria-hidden size={15} />
              </button>
            ) : (
              <button
                className="retention-btn is-primary"
                disabled={Boolean(blockingError) || isSaving}
                onClick={() => void handleCreate()}
                type="button"
              >
                {isSaving ? 'Creating…' : 'Create policy'}
              </button>
            )}
          </div>
        </section>

        <aside className="retention-panel is-muted">
          <div className="retention-sim-head">
            <h3>Simulation</h3>
            <span className="retention-pill">Not yet active</span>
          </div>
          <p className="retention-panel-sub">
            This rule is off. It deletes nothing until you turn it on yourself.
          </p>

          <dl className="retention-sim-list">
            <DetailRow label="Action" value={describeDraft(draft)} />
          </dl>

          <SimulationResult draft={draft} />
        </aside>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Screen 3 — Legal holds                                              */
/* ------------------------------------------------------------------ */

function HoldsScreen({
  holds,
  isLoading,
  onApply,
  onRelease
}: {
  holds: LegalHoldSummary[];
  isLoading: boolean;
  onApply: (input: { caseId: string; description: string }) => void;
  onRelease: (holdId: string) => void;
}) {
  const nowMs = Date.now();
  const rows = holds.map((hold) => toHoldRow(hold, nowMs));
  const [selectedCase, setSelectedCase] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [caseId, setCaseId] = React.useState('');
  const [description, setDescription] = React.useState('');
  const activeCase: HoldRow | null = rows.find((item) => item.id === selectedCase) || rows[0] || null;
  const activeHold = holds.find((hold) => hold.id === activeCase?.id) || null;
  const canCreate = Boolean(caseId.trim() && description.trim());

  function handleApply() {
    if (!canCreate) {
      return;
    }

    onApply({ caseId: caseId.trim(), description: description.trim() });
    setCaseId('');
    setDescription('');
    setIsCreating(false);
  }

  return (
    <>
      <ScreenHeader
        actions={
          <button
            className="retention-btn is-primary"
            onClick={() => setIsCreating((current) => !current)}
            type="button"
          >
            <Plus aria-hidden size={15} />
            New case
          </button>
        }
        subtitle="Freezes chats for a legal case. Nothing is deleted while a freeze is on, however long it lasts."
        title="Legal holds"
      />

      {isCreating ? (
        <section className="retention-panel">
          <h3>New legal hold</h3>
          <p className="retention-panel-sub">
            A hold takes effect immediately and outranks every retention policy. Releasing it later
            starts a delay before anything it covers can be deleted.
          </p>

          <label className="retention-field">
            <span>Case reference</span>
            <input
              onChange={(event) => setCaseId(event.target.value)}
              placeholder="CASE-2026-0114"
              type="text"
              value={caseId}
            />
          </label>

          <label className="retention-field">
            <span>What this preserves</span>
            <textarea
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Finance conversations relating to the Q3 audit"
              rows={3}
              value={description}
            />
          </label>

          {/* A hold routinely outlives whoever applied it, so the reason has to
              be recorded with it rather than remembered. */}
          <p className="retention-panel-sub">
            Both fields are required. Whoever reviews this months from now will only have what you
            write here.
          </p>

          <div className="retention-actions">
            <button className="retention-btn" onClick={() => setIsCreating(false)} type="button">
              Cancel
            </button>
            <button
              className="retention-btn is-primary"
              disabled={!canCreate}
              onClick={handleApply}
              type="button"
            >
              Apply hold
            </button>
          </div>
        </section>
      ) : null}

      <div className="retention-split is-holds">
        <section className="retention-case-list" aria-label="Hold cases">
          {rows.map((holdCase) => (
            <button
              aria-pressed={activeCase?.id === holdCase.id}
              className={activeCase?.id === holdCase.id ? 'retention-case is-active' : 'retention-case'}
              key={holdCase.id}
              onClick={() => setSelectedCase(holdCase.id)}
              type="button"
            >
              <span className="retention-case-top">
                <span className="retention-case-name">{holdCase.name}</span>
                <StateBadge state={holdCase.state} />
              </span>
              <span className="retention-case-id">{holdCase.caseId}</span>
              <span className="retention-case-detail">{holdCase.detail}</span>
            </button>
          ))}

          {!rows.length && !isLoading ? (
            <p className="retention-case-detail">
              No legal holds. Nothing is currently protected from a retention policy.
            </p>
          ) : null}
          {isLoading ? <p className="retention-case-detail">Loading holds…</p> : null}

          <div className="retention-note is-signal">
            <Scale aria-hidden size={17} />
            <div>
              <p>
                Holds outrank every retention policy. While one is active, no policy change and no
                admin action can delete the content it covers.
              </p>
            </div>
          </div>
        </section>

        <section className="retention-panel">
          {!activeCase ? (
            <p className="retention-panel-sub">
              Select a case, or apply a hold to preserve content against every retention policy.
            </p>
          ) : null}
          {activeCase && activeHold ? (
            <>
            <div className="retention-case-head">
              <div>
                <h3>{activeCase.name}</h3>
                <p className="retention-case-id">{activeCase.caseId}</p>
              </div>
              <div className="retention-actions">
                <button className="retention-btn" type="button">
                  <Download aria-hidden size={15} />
                  Export for review
                </button>
                {activeCase.state === 'Active' ? (
                  <button
                    className="retention-btn is-danger"
                    onClick={() => onRelease(activeCase.id)}
                    type="button"
                  >
                    Release hold
                  </button>
                ) : null}
              </div>
            </div>

            <dl className="retention-detail-grid">
              <DetailRow label="Applied" value={new Date(activeHold.appliedAtMs).toLocaleString()} />
              <DetailRow
                label="Duration"
                value={activeHold.releasedAtMs
                  ? `Released, protected until ${new Date(activeHold.delayUntilMs || 0).toLocaleDateString()}`
                  : 'Indefinite, until released'}
              />
              <DetailRow
                label="Custodians"
                value={activeHold.custodianUids.length
                  ? `${activeHold.custodianUids.length} named`
                  : 'Everyone in the organization'}
              />
              <DetailRow label="Visible to custodians" value="No" />
            </dl>

            <div className="retention-chip-block">
              <p className="retention-chip-label">What this preserves</p>
              <p className="retention-panel-sub">{activeHold.description}</p>
            </div>

            {/* No item counts here. They require an evaluation pass against this
                hold's scope, and an invented number on a legal-hold screen is
                the kind of thing an administrator would repeat to a regulator. */}
            <div className="retention-note is-signal">
              <Scale aria-hidden size={17} />
              <div>
                <p className="retention-note-title">
                  Everything this hold covers is preserved while it stands.
                </p>
                <p>
                  Item counts appear once an evaluation has run against this scope.
                </p>
              </div>
            </div>

            <div className="retention-note is-warn">
              <AlertTriangle aria-hidden size={17} />
              <div>
                <p>
                  While this hold is on, this company's data cannot be deleted and staff who leave
                  cannot have their chats removed.
                </p>
                <p>
                  Releasing starts a 30-day delay before covered content becomes eligible for deletion
                  again, so an accidental release is recoverable.
                </p>
              </div>
            </div>
            </>
          ) : null}
</section>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Screen 4 — Why is this retained?                                    */
/* ------------------------------------------------------------------ */

function ExplainerScreen({
  holds,
  policies
}: {
  holds: LegalHoldSummary[];
  policies: RetentionPolicy[];
}) {
  const nowMs = Date.now();
  const activeHolds = holds.filter((hold) => !hold.releasedAtMs || (hold.delayUntilMs || 0) > nowMs);
  const activePolicies = policies.filter((policy) => policy.state === 'ACTIVE');

  return (
    <>
      <ScreenHeader
        subtitle="The rules that decide how long content lives, and the order they are applied in."
        title="Why is content retained?"
      />

      {/* This screen shows the rules in force. Resolving them for one named
          conversation needs the evaluator to run against a chosen subject, and
          that is not built — so this says what applies to everything rather
          than inventing an answer for a specific chat. */}
      <ConversationLookup />

      <section className="retention-panel">
        <h3>The order rules are applied in</h3>
        <p className="retention-panel-sub">
          When two rules disagree, the one higher in this list decides the outcome.
        </p>

        <ol className="retention-precedence">
          <li>
            <strong>A legal hold suspends everything.</strong> While a hold covers content, nothing
            deletes it. No policy, and no administrator.
            {activeHolds.length ? (
              <> {activeHolds.length} hold{activeHolds.length === 1 ? '' : 's'} currently active.</>
            ) : (
              <> No holds are currently active.</>
            )}
          </li>
          <li>
            <strong>Keeping beats deleting.</strong> If one rule says keep and another says delete,
            the content is kept.
          </li>
          <li>
            <strong>The longest keep wins.</strong> Among several keep rules, content survives to
            the end of the longest one.
          </li>
          <li>
            <strong>The narrowest rule wins.</strong> A rule naming specific people or conversations
            beats one covering the whole organization.
          </li>
        </ol>
      </section>

      <section className="retention-panel">
        <h3>Rules currently in force</h3>

        {activeHolds.map((hold) => (
          <div className="retention-rule" key={hold.id}>
            <div>
              <p className="retention-cell-strong">{hold.caseId}</p>
              <p className="retention-scope-detail">{hold.description}</p>
            </div>
            <VerdictBadge verdict="Suspends all deletion" />
          </div>
        ))}

        {activePolicies.map((policy) => (
          <div className="retention-rule" key={policy.id}>
            <div>
              <p className="retention-cell-strong">{policy.name}</p>
              <p className="retention-scope-detail">
                {policy.scopeKind === 'organization'
                  ? 'Every conversation in the organization'
                  : `${policy.scopeTargets.length} ${policy.scopeKind === 'user' ? 'people' : 'conversations'}`}
              </p>
            </div>
            <VerdictBadge verdict={policy.action === 'retain' ? 'Keeps indefinitely' : `${policy.durationDays} days`} />
          </div>
        ))}

        {!activeHolds.length && !activePolicies.length ? (
          <p className="retention-panel-sub">
            No rules are in force. Nothing is deleted on a schedule, and nothing is preserved
            against one.
          </p>
        ) : null}
      </section>

      <div className="retention-note is-signal">
        <Layers aria-hidden size={17} />
        <div>
          <p className="retention-note-title">Attachments follow their messages.</p>
          <p>
            An attachment is kept for as long as the longest-kept message that references it, so a
            retained conversation is never missing its files.
          </p>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Screen 5 — Disposition review                                       */
/* ------------------------------------------------------------------ */

function DispositionScreen({
  adminName,
  isLoading,
  items,
  onApprove,
  onExtend,
  slaDays
}: {
  adminName: string;
  isLoading: boolean;
  items: DispositionItem[];
  onApprove: (itemId: string) => void;
  onExtend: (itemId: string) => void;
  slaDays: number;
}) {
  const nowMs = Date.now();
  const { reviewable, withheldCount } = splitDispositionQueue(items, nowMs);
  const eligibleItemCount = items
    .filter((entry) => entry.state !== 'PURGED' && entry.state !== 'WITHHELD')
    .reduce((total, entry) => total + entry.itemCount, 0);
  const oldestEligibleMs = items
    .filter((entry) => entry.state !== 'PURGED')
    .reduce<number | null>(
      (oldest, entry) => oldest === null ? entry.eligibleAtMs : Math.min(oldest, entry.eligibleAtMs),
      null
    );
  const oldestEligible = oldestEligibleMs === null ? '—' : formatRelativeDay(oldestEligibleMs, nowMs);

  return (
    <>
      <ScreenHeader
        actions={
          <>
            <button className="retention-btn" type="button">Filter</button>
            <button className="retention-btn" type="button">Review settings</button>
          </>
        }
        subtitle="Content whose retention has expired, waiting on a human decision before it is destroyed."
        title="Disposition review"
      />

      {/* Destruction is irreversible and crypto-shredded. Say so before the
          admin reaches the Approve buttons, not after. */}
      <div className="retention-note is-warn">
        <AlertTriangle aria-hidden size={17} />
        <div>
          <p className="retention-note-title">
            Approving starts a 7-day grace window, then the encryption key is destroyed.
          </p>
          <p>
            Items are recoverable and still discoverable during the window. After that they cannot be
            recovered by anyone, including Synzapp.
          </p>
        </div>
      </div>

      <div className="retention-stat-row">
        <StatCard
          caption={reviewable.length ? 'Waiting on your decision' : 'Nothing to review'}
          label="Batches pending"
          value={String(reviewable.length)}
        />
        <StatCard label="Items eligible" value={eligibleItemCount.toLocaleString()} />
        <StatCard
          caption={withheldCount ? 'Held content is never offered here' : 'None held'}
          label="Withheld by a hold"
          tone={withheldCount ? 'signal' : undefined}
          value={String(withheldCount)}
        />
        <StatCard
          caption="No deadline, review at your pace"
          label="Oldest eligible"
          value={oldestEligible}
        />
      </div>

      <div className="retention-table-wrap">
        <table className="retention-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Items</th>
              <th>Size</th>
              <th>Eligible since</th>
              <th>Governing policy</th>
              <th aria-label={`Decision, reviewed by ${adminName}`}>Decision</th>
            </tr>
          </thead>
          <tbody>
            {reviewable.map((batch) => (
              <tr key={batch.id}>
                <td>
                  <span className="retention-cell-strong">{batch.subject}</span>
                  <span className="retention-scope-detail">{batch.subtitle}</span>
                </td>
                <td className="retention-cell-num">{batch.items}</td>
                <td className="retention-cell-num">{batch.purgeBy}</td>
                <td>{batch.eligible}</td>
                <td>{batch.policy}</td>
                <td>
                  <div className="retention-row-actions">
                    <button
                      className="retention-btn is-small"
                      onClick={() => onExtend(batch.id)}
                      type="button"
                    >
                      Extend
                    </button>
                    <button
                      className="retention-btn is-small is-danger"
                      onClick={() => onApprove(batch.id)}
                      type="button"
                    >
                      Approve
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!reviewable.length && !isLoading ? (
              <tr>
                <td colSpan={6}>
                  {withheldCount
                    ? `Nothing to review. ${withheldCount} batch(es) are withheld by a legal hold.`
                    : 'Nothing has reached the end of its retention period.'}
                </td>
              </tr>
            ) : null}
            {isLoading ? <tr><td colSpan={6}>Loading the queue…</td></tr> : null}
          </tbody>
        </table>
      </div>

      {/* Held content is never offered as reviewable. Stating the count avoids
          an admin assuming the queue is the whole picture. */}
      <div className="retention-note is-signal">
        <Gavel aria-hidden size={17} />
        <div>
          <p className="retention-note-title">
            6 further batches are withheld from this queue by an active legal hold.
          </p>
          <p>Held content never becomes eligible for disposition, and is not shown here as reviewable.</p>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function ScreenHeader({
  actions,
  subtitle,
  title
}: {
  actions?: React.ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <header className="retention-header">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {actions ? <div className="retention-actions">{actions}</div> : null}
    </header>
  );
}

function StatCard({
  caption,
  label,
  tone,
  value
}: {
  caption?: string;
  label: string;
  tone?: 'signal';
  value: string;
}) {
  return (
    <div className={tone === 'signal' ? 'retention-stat is-signal' : 'retention-stat'}>
      <p className="retention-stat-label">{label}</p>
      <p className="retention-stat-value">{value}</p>
      {caption ? <p className="retention-stat-caption">{caption}</p> : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="retention-detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function StateBadge({ state }: { state: 'Active' | 'Draft' | 'Released' | 'Releasing' | 'Simulation' }) {
  const modifier = state === 'Active'
    ? 'is-active-state'
    : state === 'Releasing'
      ? 'is-releasing'
      : state === 'Simulation'
        ? 'is-simulation'
        : 'is-draft';

  return <span className={`retention-badge ${modifier}`}>{state}</span>;
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const modifier = verdict === 'Wins'
    ? 'is-wins'
    : verdict === 'Binding if released'
      ? 'is-binding'
      : 'is-inert';

  return <span className={`retention-verdict-badge ${modifier}`}>{verdict}</span>;
}

/* ------------------------------------------------------------------ */
/* Screen 5 - Search & export (eDiscovery)                             */
/* ------------------------------------------------------------------ */

/**
 * Finding preserved conversations and handing them over.
 *
 * A legal hold preserves content, which is only half of a legal obligation: it
 * then has to be produced. This screen is the other half.
 *
 * The search and the export take the same criteria deliberately. An
 * administrator previews with a search and exports the identical question, so
 * what they saw is what the lawyer receives — a preview that filtered
 * differently from the export would be a trap.
 *
 * **An unreadable message still appears in the results.** A search that hid
 * them would show an empty period and an administrator would report it as such.
 */
function EdiscoveryScreen({ holds }: { holds: LegalHoldSummary[] }) {
  const [holdId, setHoldId] = React.useState('');
  const [people, setPeople] = React.useState<CompliancePerson[]>([]);
  const [selectedUids, setSelectedUids] = React.useState<string[]>([]);
  const [peopleFilter, setPeopleFilter] = React.useState('');
  const [keyStatus, setKeyStatus] = React.useState<ArchiveKeyStatus | null>(null);
  const [includeAttachments, setIncludeAttachments] = React.useState(true);
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [text, setText] = React.useState('');
  const [hits, setHits] = React.useState<ArchivedMessageHit[] | null>(null);
  const [truncated, setTruncated] = React.useState(false);
  const [cappedConversations, setCappedConversations] = React.useState(0);
  const [exports, setExports] = React.useState<ComplianceExportSummary[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const nowMs = Date.now();

  const criteria = React.useCallback(() => ({
    custodianUids: selectedUids,
    includeAttachments,
    fromMs: fromDate ? new Date(`${fromDate}T00:00:00Z`).getTime() : null,
    holdId: holdId || null,
    text: text.trim() || null,
    // The end date is inclusive of the whole day. A lawyer asking for "up to the
    // 30th" means the end of the 30th, and taking midnight would silently drop
    // that day's messages.
    toMs: toDate ? new Date(`${toDate}T23:59:59Z`).getTime() : null
  }), [fromDate, holdId, includeAttachments, selectedUids, text, toDate]);

  const refreshExports = React.useCallback(async () => {
    try {
      setExports((await listComplianceExports()).exports);
    } catch {
      // The exports list is secondary to the search on this screen. Failing to
      // load it must not replace search results with an error.
    }
  }, []);

  React.useEffect(() => {
    void refreshExports();
  }, [refreshExports]);

  const hasRunningExport = exports.some(isExportInProgress);

  React.useEffect(() => {
    if (!hasRunningExport) {
      return undefined;
    }

    // Polled only while something is actually running, and stopped as soon as
    // it finishes, so an idle console is not calling the server for ever.
    const timer = window.setInterval(() => void refreshExports(), 2000);

    return () => window.clearInterval(timer);
  }, [hasRunningExport, refreshExports]);

  const refreshKeyStatus = React.useCallback(async () => {
    try {
      setKeyStatus((await loadArchiveKeyStatus()).status);
    } catch {
      // Leaves the banner hidden rather than blocking the search.
    }
  }, []);

  React.useEffect(() => {
    void refreshKeyStatus();
  }, [refreshKeyStatus]);

  React.useEffect(() => {
    void (async () => {
      try {
        setPeople((await listCompliancePeople()).people);
      } catch {
        // The picker degrades to "everyone" rather than blocking the screen.
        // A search with no one selected is still a valid search.
      }
    })();
  }, []);

  async function handleSearch() {
    const next = criteria();
    const validationError = validateSearchCriteria({ fromMs: next.fromMs, toMs: next.toMs });

    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSearching(true);

    try {
      const result = await searchArchive(next);

      setHits(result.hits);
      setTruncated(result.truncated);
      // Defensive: a response missing this field must not throw after results
      // are already on screen, which is exactly what it did.
      setCappedConversations(result.cappedConversationIds?.length || 0);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'The search could not be run.');
    } finally {
      setIsSearching(false);
    }
  }

  async function handleExport() {
    setError(null);
    setIsExporting(true);

    try {
      await createComplianceExport(criteria());
      await refreshExports();
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'The export could not be built.');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDownload(exportId: string) {
    try {
      const { downloadUrl } = await getComplianceExportDownloadUrl(exportId);

      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'That export could not be opened.');
    }
  }

  function togglePerson(uid: string) {
    setSelectedUids((current) => (current.includes(uid)
      ? current.filter((value) => value !== uid)
      : [...current, uid]));
  }

  const needle = peopleFilter.trim().toLowerCase();
  const visiblePeople = needle
    ? people.filter((person) => person.displayName.toLowerCase().includes(needle)
      || person.departmentName.toLowerCase().includes(needle))
    : people;
  const rows = (hits || []).map((hit) => toSearchHitRow(hit, nowMs));
  const unreadableCount = (hits || []).filter((hit) => hit.unreadableReason !== null).length;

  return (
    <>
      <ScreenHeader
        subtitle="Find preserved conversations and produce them as a single file."
        title="Search & export"
      />

      {keyStatus && !keyStatus.exists ? (
        <div className="retention-note is-warn" role="alert">
          <AlertTriangle aria-hidden size={17} />
          <div>
            <p className="retention-note-title">
              {keyStatus.problem
                ? 'The compliance archive is not working'
                : 'Nothing can be produced yet'}
            </p>
            {keyStatus.problem ? (
              <>
                <p>
                  Messages are being sent, but no readable copy is being kept, so none of them can
                  ever be searched or exported. This needs fixing before anyone relies on it.
                </p>
                <p><strong>Reason:</strong> {keyStatus.problem}</p>
              </>
            ) : (
              <p>
                This organization has no compliance key yet. It is created on its own the first time
                a message is sent, so there is nothing to set up. Send a message, then search again.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {keyStatus?.exists ? (
        <div className="retention-note is-signal" role="status">
          <ShieldCheck aria-hidden size={17} />
          <div>
            <p className="retention-note-title">Compliance key is in place</p>
            <p>
              Messages sent since{' '}
              {keyStatus.createdAtMs
                ? new Date(keyStatus.createdAtMs).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })
                : 'the key was created'}{' '}
              can be searched and exported. Anything older cannot be read and will show as missing.
            </p>
          </div>
        </div>
      ) : null}

      <section className="retention-panel">
        <h3>What to look for</h3>
        <p className="retention-panel-sub">
          Leave a field empty to include everything. Choosing a case limits the search to the people
          that case preserves.
        </p>

        <label className="retention-field">
          <span>Case (optional)</span>
          <select onChange={(event) => setHoldId(event.target.value)} value={holdId}>
            <option value="">Every conversation</option>
            {holds.map((hold) => (
              <option key={hold.id} value={hold.id}>{hold.caseId}</option>
            ))}
          </select>
        </label>

        <div className="retention-field">
          <span>People (optional)</span>
          {people.length ? (
            <>
              <input
                aria-label="Filter people"
                className="retention-people-filter"
                onChange={(event) => setPeopleFilter(event.target.value)}
                placeholder="Type a name to narrow this list"
                type="text"
                value={peopleFilter}
              />
              <div className="retention-people" role="group" aria-label="People to search">
                {visiblePeople.map((person) => (
                  <label className="retention-person" key={person.uid}>
                    <input
                      checked={selectedUids.includes(person.uid)}
                      onChange={() => togglePerson(person.uid)}
                      type="checkbox"
                    />
                    <span className="retention-person-name">{person.displayName}</span>
                    {person.departmentName ? (
                      <span className="retention-person-detail">{person.departmentName}</span>
                    ) : null}
                  </label>
                ))}
                {visiblePeople.length ? null : (
                  <p className="retention-panel-sub">Nobody matches that name.</p>
                )}
              </div>
              {/* Said plainly because the results look wrong otherwise: picking
                  one person returns messages from the people they were talking
                  to as well, and an admin has no way to know that is intended. */}
              <p className="retention-panel-sub">
                {selectedUids.length
                  ? `Searching ${selectedUids.length} selected ${selectedUids.length === 1 ? 'person' : 'people'}. `
                    + 'This returns their whole conversation, both what they sent and what they '
                    + 'were sent, because both are part of their record.'
                  : 'Nobody selected, so this searches everyone.'}
              </p>
            </>
          ) : (
            <p className="retention-panel-sub">
              The staff list could not be loaded, so this search covers everyone.
            </p>
          )}
        </div>

        <div className="retention-split">
          <div className="retention-field">
            <span>From</span>
            <DateField onChange={setFromDate} placeholder="Earliest message" value={fromDate} />
          </div>
          <div className="retention-field">
            <span>To</span>
            <DateField onChange={setToDate} placeholder="Most recent message" value={toDate} />
          </div>
        </div>

        <label className="retention-field">
          <span>Containing the words (optional)</span>
          <input
            onChange={(event) => setText(event.target.value)}
            placeholder="invoice"
            type="text"
            value={text}
          />
        </label>

        {error ? (
          <div className="retention-note is-warn" role="alert">
            <AlertTriangle aria-hidden size={17} />
            <div>
              <p className="retention-note-title">That did not work</p>
              <p>{error}</p>
            </div>
          </div>
        ) : null}

        <label className="retention-person" style={{ border: 0, paddingLeft: 0 }}>
          <input
            checked={includeAttachments}
            onChange={(event) => setIncludeAttachments(event.target.checked)}
            type="checkbox"
          />
          <span className="retention-person-name">Include attachments in the export</span>
        </label>
        <p className="retention-panel-sub">
          {includeAttachments
            ? 'Photos, videos and files are copied into the export. Anything left out is listed in '
              + 'the manifest with the reason.'
            : 'Messages only. Attachments are listed in the manifest as not included, so nothing '
              + 'goes missing without a record.'}
        </p>

        <div className="retention-actions">
          <button
            className="retention-btn"
            disabled={isSearching}
            onClick={() => void handleSearch()}
            type="button"
          >
            <FileSearch aria-hidden size={15} />
            {isSearching ? 'Searching...' : 'Search'}
          </button>
          <button
            className="retention-btn is-primary"
            disabled={isExporting}
            onClick={() => void handleExport()}
            type="button"
          >
            <Download aria-hidden size={15} />
            {isExporting ? 'Starting…' : 'Export these results'}
          </button>
        </div>

        {isExporting || hasRunningExport ? (
          <p className="retention-panel-sub">
            The export is being built below. You can close this page. It keeps going, and the
            finished file appears in the list whenever you come back.
          </p>
        ) : null}
      </section>

      {hits ? (
        <section className="retention-panel">
          <h3>{hits.length} message{hits.length === 1 ? '' : 's'} found</h3>

          {truncated ? (
            <div className="retention-note is-warn" role="status">
              <AlertTriangle aria-hidden size={17} />
              <div>
                <p className="retention-note-title">There are more than this</p>
                <p>
                  This search hit the maximum it can show at once. Narrow the dates or the people to
                  see the rest.
                </p>
              </div>
            </div>
          ) : null}

          {cappedConversations ? (
            <div className="retention-note is-warn" role="status">
              <AlertTriangle aria-hidden size={17} />
              <div>
                <p className="retention-note-title">
                  {cappedConversations} conversation{cappedConversations === 1 ? '' : 's'} only
                  partly examined
                </p>
                <p>
                  {cappedConversations === 1 ? 'It holds' : 'They hold'} more messages than one
                  search can read, so the most recent were taken. Narrow the dates to cover
                  {cappedConversations === 1 ? ' it' : ' them'} fully before relying on this.
                </p>
              </div>
            </div>
          ) : null}

          {unreadableCount ? (
            <div className="retention-note is-signal" role="status">
              <AlertTriangle aria-hidden size={17} />
              <div>
                <p className="retention-note-title">
                  {unreadableCount} of these cannot be read
                </p>
                <p>
                  They are listed below with the reason. They will also appear in an export, marked
                  as missing, so nothing is quietly left out.
                </p>
              </div>
            </div>
          ) : null}

          <div className="retention-table-wrap">
            <table className="retention-table">
              <thead>
                <tr>
                  <th scope="col">Sent</th>
                  <th scope="col">Conversation</th>
                  <th scope="col">From</th>
                  <th scope="col">Message</th>
                  <th scope="col">Files</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={(hits[index] || {}).envelopeId || index}>
                    <td>{row.sentAt}</td>
                    <td>{row.conversation}</td>
                    <td>{nameForUid(people, row.sender)}</td>
                    <td className={row.isReadable ? 'retention-cell-strong' : ''}>{row.preview}</td>
                    <td>{row.attachments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="retention-panel">
        <h3>Exports</h3>
        <p className="retention-panel-sub">
          Each export is a single file containing the messages, their attachments and a manifest
          listing exactly what is inside and what is not. Download links last 24 hours.
        </p>

        {exports.length ? (
          <div className="retention-table-wrap">
            <table className="retention-table">
              <thead>
                <tr>
                  <th scope="col">Built</th>
                  <th scope="col">Contents</th>
                  <th scope="col">Size</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {exports.map((summary) => {
                  const running = isExportInProgress(summary);
                  const fraction = exportProgressFraction(summary);

                  return (
                    <tr key={summary.id}>
                      <td>{formatSentAt(summary.createdAtMs, nowMs)}</td>
                      <td className={
                        summary.state === 'READY' && summary.completeness !== 'PARTIAL'
                          ? 'retention-cell-strong'
                          : ''
                      }>
                        {summary.state === 'READY' ? describeExport(summary) : describeExportProgress(summary)}
                        {running ? (
                          <div
                            aria-label="Export progress"
                            aria-valuemax={100}
                            aria-valuemin={0}
                            aria-valuenow={fraction === null ? undefined : Math.round(fraction * 100)}
                            className={fraction === null
                              ? 'retention-progress is-indeterminate'
                              : 'retention-progress'}
                            role="progressbar"
                          >
                            <span style={fraction === null
                              ? undefined
                              : { width: `${Math.round(fraction * 100)}%` }} />
                          </div>
                        ) : null}
                      </td>
                      <td className="retention-cell-num">
                        {summary.state === 'READY' ? formatBytes(summary.sizeBytes) : ''}
                      </td>
                      <td>
                        {summary.state === 'READY' ? (
                          <button
                            className="retention-btn"
                            onClick={() => void handleDownload(summary.id)}
                            type="button"
                          >
                            <Download aria-hidden size={15} />
                            Download
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="retention-panel-sub">No exports yet.</p>
        )}
      </section>
    </>
  );
}

/**
 * A date field with a proper calendar.
 *
 * The browser's own date input was being used, which renders differently in
 * every browser, shows mm/dd/yyyy regardless of where the admin is, and gives
 * no way to clear a date once set. This uses the same calendar as the rest of
 * the product so the compliance console does not look like a different app.
 */
function DateField({
  onChange,
  placeholder,
  value
}: {
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const selected = value ? new Date(`${value}T00:00:00`) : undefined;

  return (
    <Popover.Root onOpenChange={setIsOpen} open={isOpen}>
      <Popover.Trigger asChild>
        <button className="retention-date-trigger" type="button">
          <span className={value ? '' : 'is-placeholder'}>
            {value ? formatPickedDate(value) : placeholder}
          </span>
          <Clock aria-hidden size={14} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          className="rails-date-picker-popover"
          collisionPadding={14}
          sideOffset={8}
        >
          <DayPicker
            defaultMonth={selected || new Date()}
            fixedWeeks
            mode="single"
            onSelect={(date) => {
              onChange(date ? toDateOnlyValue(date) : '');
              setIsOpen(false);
            }}
            selected={selected}
            showOutsideDays
          />
          <div className="rails-date-picker-actions">
            <button
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              type="button"
            >
              Clear
            </button>
            <button
              onClick={() => {
                onChange(toDateOnlyValue(new Date()));
                setIsOpen(false);
              }}
              type="button"
            >
              Today
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * What the rule being drafted would actually do.
 *
 * The panel used to describe the rule and promise that counts would appear
 * later. They never could: the job that counts conversations only looks at
 * policies that are switched on, so a draft was never examined by anything.
 *
 * It now runs the real evaluation — same precedence, same legal holds — against
 * the draft, and shows the result. Nothing is saved, queued or deleted by
 * looking.
 */
function SimulationResult({ draft }: { draft: RetentionPolicyDraft }) {
  const [simulation, setSimulation] = React.useState<RetentionSimulation | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const durationDays = parseDurationDays(draft.durationDays);

  React.useEffect(() => {
    if (!durationDays) {
      setSimulation(null);

      return undefined;
    }

    let cancelled = false;
    // Debounced: the duration field changes on every keystroke, and each change
    // would otherwise start a scan of the organization.
    const timer = window.setTimeout(() => {
      setIsRunning(true);
      setError(null);

      simulateRetentionPolicy({
        action: draft.action,
        durationDays,
        scopeKind: draft.scopeKind
      })
        .then((result) => {
          if (!cancelled) {
            setSimulation(result.simulation);
          }
        })
        .catch((simulationError: unknown) => {
          if (!cancelled) {
            setError(simulationError instanceof Error
              ? simulationError.message
              : 'This rule could not be checked.');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsRunning(false);
          }
        });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [draft.action, draft.scopeKind, durationDays]);

  if (error) {
    return (
      <div className="retention-note is-warn" role="alert">
        <AlertTriangle aria-hidden size={17} />
        <div>
          <p className="retention-note-title">This rule could not be checked</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!simulation) {
    return (
      <p className="retention-panel-sub">
        {isRunning ? 'Checking what this rule would do…' : 'Set a keep-for period to see what this rule would do.'}
      </p>
    );
  }

  const lines = buildSimulationLines(simulation);
  const added = describeAddedEffect(simulation);
  const scanLimit = describeScanLimit(simulation);

  return (
    <>
      <div
        className={simulation.wouldDeleteNow ? 'retention-note is-warn' : 'retention-note is-signal'}
        role="status"
      >
        {simulation.wouldDeleteNow
          ? <AlertTriangle aria-hidden size={17} />
          : <ShieldCheck aria-hidden size={17} />}
        <div>
          <p className="retention-note-title">
            {simulation.wouldDeleteNow ? 'This would delete data' : 'Nothing would be deleted'}
          </p>
          <p>{describeSimulationHeadline(simulation)}</p>
          {added ? <p>{added}</p> : null}
        </div>
      </div>

      <dl className="retention-sim-list">
        {lines.map((line) => (
          <div className="retention-sim-row" key={line.label}>
            <dt>{line.label}</dt>
            <dd className={line.tone === 'danger' ? 'is-danger' : line.tone === 'safe' ? 'is-safe' : ''}>
              {line.value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="retention-panel-sub">
        Checked against {simulation.examined.toLocaleString()} conversation
        {simulation.examined === 1 ? '' : 's'}. Nothing was changed by this check.
        {scanLimit ? ` ${scanLimit}` : ''}
      </p>
    </>
  );
}

/**
 * Choosing the people a rule covers.
 *
 * This replaced a box an administrator typed names into. Nothing checked what
 * was typed, so a misspelling produced a rule that silently covered nobody —
 * and the administrator would have believed those chats were being kept to a
 * schedule. On a screen that deletes company records, a typo must not be able
 * to change what the rule means.
 */
function ScopePeoplePicker({
  onChange,
  selected
}: {
  onChange: (uids: string[]) => void;
  selected: string[];
}) {
  const [people, setPeople] = React.useState<CompliancePerson[]>([]);
  const [filter, setFilter] = React.useState('');
  const [loadFailed, setLoadFailed] = React.useState(false);

  React.useEffect(() => {
    void (async () => {
      try {
        setPeople((await listCompliancePeople()).people);
      } catch {
        setLoadFailed(true);
      }
    })();
  }, []);

  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? people.filter((person) => person.displayName.toLowerCase().includes(needle)
      || person.departmentName.toLowerCase().includes(needle))
    : people;

  function toggle(uid: string) {
    onChange(selected.includes(uid)
      ? selected.filter((value) => value !== uid)
      : [...selected, uid]);
  }

  if (loadFailed) {
    return (
      <div className="retention-note is-warn" role="alert">
        <AlertTriangle aria-hidden size={17} />
        <div>
          <p className="retention-note-title">The staff list could not be loaded</p>
          <p>Try again before choosing who this rule covers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="retention-field">
      <span>Who does this cover?</span>
      <input
        aria-label="Filter people"
        className="retention-people-filter"
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Type a name to narrow this list"
        type="text"
        value={filter}
      />
      <div className="retention-people" role="group" aria-label="People this rule covers">
        {visible.map((person) => (
          <label className="retention-person" key={person.uid}>
            <input
              checked={selected.includes(person.uid)}
              onChange={() => toggle(person.uid)}
              type="checkbox"
            />
            <span className="retention-person-name">{person.displayName}</span>
            {person.departmentName ? (
              <span className="retention-person-detail">{person.departmentName}</span>
            ) : null}
          </label>
        ))}
        {visible.length ? null : (
          <p className="retention-panel-sub">Nobody matches that name.</p>
        )}
      </div>
      <span className="retention-panel-sub">
        {selected.length
          ? `This rule covers ${selected.length} ${selected.length === 1 ? 'person' : 'people'}, and the chats they are part of.`
          : 'Nobody chosen yet. A rule covering nobody deletes nothing.'}
      </span>
    </div>
  );
}

/**
 * Why a particular chat is kept or deleted.
 *
 * This replaced a note saying the lookup "is still being built". It was not:
 * the engine has always returned its reasoning step by step and the id of the
 * rule that decided, and nothing read them.
 *
 * The answer is given in full before any table of rules. Somebody using this is
 * usually mid-conversation with a person waiting to know what happened to a
 * message, and assembling the answer from a precedence list is not something
 * they can do in that moment.
 */
function ConversationLookup() {
  const [people, setPeople] = React.useState<CompliancePerson[]>([]);
  const [custodianUid, setCustodianUid] = React.useState('');
  const [results, setResults] = React.useState<ConversationRetentionExplanation[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const nowMs = Date.now();

  React.useEffect(() => {
    void (async () => {
      try {
        setPeople((await listCompliancePeople()).people);
      } catch {
        // The lookup still works without names; it simply cannot offer a list
        // to pick from.
      }
    })();
  }, []);

  async function lookUp(uid: string) {
    setCustodianUid(uid);
    setError(null);
    setIsLoading(true);

    try {
      const result = await explainRetention({ custodianUid: uid || null });

      setResults(result.conversations);
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : 'That could not be looked up.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="retention-panel">
      <h3>Why is this chat kept or deleted?</h3>
      <p className="retention-panel-sub">
        Pick a person to see each of their chats, what happens to it, and which rule decided.
      </p>

      <label className="retention-field">
        <span>Person</span>
        <select onChange={(event) => void lookUp(event.target.value)} value={custodianUid}>
          <option value="">Choose someone…</option>
          {people.map((person) => (
            <option key={person.uid} value={person.uid}>{person.displayName}</option>
          ))}
        </select>
      </label>

      {error ? (
        <div className="retention-note is-warn" role="alert">
          <AlertTriangle aria-hidden size={17} />
          <div>
            <p className="retention-note-title">That could not be looked up</p>
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      {isLoading ? <p className="retention-panel-sub">Working it out…</p> : null}

      {results && !results.length && !isLoading ? (
        <p className="retention-panel-sub">This person has no chats yet.</p>
      ) : null}

      {(results || []).map((item) => {
        const outcome = describeOutcome(item, nowMs);
        const { applied, notApplied } = splitRules(item);
        const isOpen = expandedId === item.conversationId;

        return (
          <div className="retention-explain-card" key={item.conversationId}>
            <div className="retention-explain-head">
              <span className="retention-cell-strong">{describeConversation(item)}</span>
              <span className={`retention-explain-verdict is-${outcome.tone}`}>
                {outcome.headline}
              </span>
            </div>
            <p className="retention-panel-sub">{outcome.detail}</p>

            <button
              className="retention-btn"
              onClick={() => setExpandedId(isOpen ? null : item.conversationId)}
              type="button"
            >
              {isOpen ? 'Hide the reasoning' : 'Show the reasoning'}
            </button>

            {isOpen ? (
              <div className="retention-explain-detail">
                {item.steps.length ? (
                  <>
                    <p className="retention-cell-strong">How this was decided</p>
                    <ol className="retention-explain-steps">
                      {item.steps.map((step) => <li key={step}>{step}</li>)}
                    </ol>
                  </>
                ) : null}

                {applied.length ? (
                  <>
                    <p className="retention-cell-strong">Rules that apply</p>
                    <ul className="retention-explain-steps">
                      {applied.map((rule) => (
                        <li key={rule.name}><strong>{rule.name}</strong>: {rule.reason}</li>
                      ))}
                    </ul>
                  </>
                ) : null}

                {/* Shown because "why did this rule NOT affect it?" is asked as
                    often as the opposite, and a list of matches cannot answer it. */}
                {notApplied.length ? (
                  <>
                    <p className="retention-cell-strong">Rules that do not apply</p>
                    <ul className="retention-explain-steps">
                      {notApplied.map((rule) => (
                        <li key={rule.name}><strong>{rule.name}</strong>: {rule.reason}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
