import React from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { AlertTriangle, Building2, Inbox, LogOut, ScrollText } from 'lucide-react';
import { getSynzappFirebaseAuth } from './firebase';
import { formatPostalAddress } from './addressFormats';
import {
  loadInbox,
  loadPolicy,
  listTenantEvidenceSizes,
  loadReplies,
  loadStaffContext,
  publishPolicy,
  savePolicyDraft,
  sendReply,
  setSubmissionState,
  setTenantEvidenceMaxAllowed,
  type ContactReply,
  type ContactSubmission,
  type PolicyVersion,
  type StaffContext,
  type TenantEvidenceSizeRow
} from './staffApi';
import './styles.css';

/**
 * Synzapp's own console.
 *
 * An internal tool, and it should look like one: dense, quick to scan, no
 * marketing. The people using it are answering a customer who is waiting.
 *
 * Built as a separate bundle from the customer app so that customers never
 * download staff code, and the public site never shows a staff sign-in.
 *
 * **Nothing here reaches customer conversations.** Support is answered about an
 * organization — that they asked, when, and what they wrote — never from inside
 * their messages.
 */

type StaffView = 'inbox' | 'policies' | 'tenants';

function StaffConsole() {
  const [staff, setStaff] = React.useState<StaffContext | null>(null);
  const [isChecking, setIsChecking] = React.useState(true);
  const [accessError, setAccessError] = React.useState<string | null>(null);
  const [view, setView] = React.useState<StaffView>('inbox');

  React.useEffect(() => {
    return onAuthStateChanged(getSynzappFirebaseAuth(), (user) => {
      if (!user) {
        setStaff(null);
        setAccessError(null);
        setIsChecking(false);

        return;
      }

      // Being signed in to Google is not access. The server decides, on every
      // load, whether this account is on the staff list.
      loadStaffContext()
        .then((result) => {
          setStaff(result.staff);
          setAccessError(null);
        })
        .catch((error: unknown) => {
          setStaff(null);
          setAccessError(error instanceof Error ? error.message : 'Access denied.');
        })
        .finally(() => setIsChecking(false));
    });
  }, []);

  async function handleSignIn() {
    setAccessError(null);

    try {
      await signInWithPopup(getSynzappFirebaseAuth(), new GoogleAuthProvider());
    } catch (signInError: unknown) {
      // The real reason, not a guess. Reporting every failure as "cancelled"
      // hid the actual cause — most often that Google sign-in has not been
      // switched on for the project, which looks identical to a closed popup.
      const code = (signInError as { code?: string })?.code || '';

      setAccessError(describeSignInFailure(code));
    }
  }

  if (isChecking) {
    return <div className="staff-centred"><p>Checking your access…</p></div>;
  }

  if (!staff) {
    return (
      <div className="staff-centred">
        <div className="staff-signin">
          <p className="staff-eyebrow">Synzapp</p>
          <h1>Staff console</h1>
          <p className="staff-signin-note">
            For Synzapp employees. Sign in with your Synzapp work account.
          </p>

          {accessError ? (
            <div className="staff-note is-warn" role="alert">
              <AlertTriangle aria-hidden size={16} />
              <p>{accessError}</p>
            </div>
          ) : null}

          <button className="staff-button is-primary" onClick={() => void handleSignIn()} type="button">
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-shell">
      <header className="staff-bar">
        <div className="staff-bar-left">
          <span className="staff-brand">Synzapp</span>
          <span className="staff-brand-divider" />
          <span className="staff-brand-sub">Staff console</span>
        </div>

        <nav className="staff-nav" aria-label="Sections">
          <button
            className={view === 'inbox' ? 'staff-tab is-active' : 'staff-tab'}
            onClick={() => setView('inbox')}
            type="button"
          >
            <Inbox aria-hidden size={15} /> Support
          </button>
          <button
            className={view === 'policies' ? 'staff-tab is-active' : 'staff-tab'}
            onClick={() => setView('policies')}
            type="button"
          >
            <ScrollText aria-hidden size={15} /> Policies
          </button>
          <button
            className={view === 'tenants' ? 'staff-tab is-active' : 'staff-tab'}
            onClick={() => setView('tenants')}
            type="button"
          >
            <Building2 aria-hidden size={15} /> Organizations
          </button>
        </nav>

        <div className="staff-bar-right">
          <span className="staff-whoami">
            {staff.displayName}
            <span className="staff-role">{staff.role === 'ADMIN' ? 'Administrator' : 'Support'}</span>
          </span>
          <button
            className="staff-button"
            onClick={() => void signOut(getSynzappFirebaseAuth())}
            type="button"
          >
            <LogOut aria-hidden size={15} /> Sign out
          </button>
        </div>
      </header>

      <main className="staff-main">
        {view === 'inbox' ? <InboxView /> : null}
        {view === 'policies' ? <PoliciesView staff={staff} /> : null}
        {view === 'tenants' ? <TenantsView /> : null}
      </main>
    </div>
  );
}

/* ---- Organizations ------------------------------------------------------- */

const MB = 1024 * 1024;

/** What a company may be allowed to reach. 100 MB is the hard stop in the API. */
const ALLOWANCE_CHOICES = [4, 10, 25, 50, 100];

/**
 * How large an evidence file each organization is allowed.
 *
 * The ceiling only. What a company actually sets within it is theirs, and is
 * shown here so raising a ceiling nobody asked for is visibly pointless — a
 * company sitting at 4 of an allowed 25 does not need 50.
 */
function TenantsView() {
  const [tenants, setTenants] = React.useState<TenantEvidenceSizeRow[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [pendingTenantId, setPendingTenantId] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);

    try {
      setTenants(await listTenantEvidenceSizes());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Organizations could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function setAllowance(tenant: TenantEvidenceSizeRow, maxAllowedFileBytes: number) {
    setPendingTenantId(tenant.tenantId);

    try {
      const saved = await setTenantEvidenceMaxAllowed({
        maxAllowedFileBytes,
        tenantId: tenant.tenantId
      });

      setTenants((current) => current.map((row) => (
        row.tenantId === saved.tenantId ? { ...row, ...saved } : row
      )));
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'That maximum could not be saved.');
    } finally {
      setPendingTenantId(null);
    }
  }

  return (
    <section className="staff-panel">
      <header className="staff-panel-head">
        <h2>Evidence upload allowance</h2>
        <p>
          The largest evidence file each organization may be allowed. Their own admin
          then chooses any limit up to what is set here.
        </p>
      </header>

      {error ? <p className="staff-error">{error}</p> : null}
      {isLoading && !tenants.length ? <p className="staff-empty">Loading organizations…</p> : null}
      {!isLoading && !tenants.length && !error ? <p className="staff-empty">No organizations yet.</p> : null}

      <div className="staff-tenant-list">
        {tenants.map((tenant) => (
          <article className="staff-tenant" key={tenant.tenantId}>
            <div className="staff-tenant-text">
              <h3>{tenant.companyName}</h3>
              <p>
                Using {describeMegabytes(tenant.maxFileBytes)} of {describeMegabytes(tenant.maxAllowedFileBytes)} allowed
              </p>
            </div>
            <div className="staff-tenant-choices">
              {ALLOWANCE_CHOICES.map((megabytes) => {
                const bytes = megabytes * MB;

                return (
                  <button
                    aria-pressed={tenant.maxAllowedFileBytes === bytes}
                    className={tenant.maxAllowedFileBytes === bytes ? 'staff-chip is-active' : 'staff-chip'}
                    disabled={pendingTenantId === tenant.tenantId}
                    key={megabytes}
                    onClick={() => void setAllowance(tenant, bytes)}
                    type="button"
                  >
                    {megabytes}
                  </button>
                );
              })}
              <span className="staff-chip-unit">MB</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function describeMegabytes(bytes: number): string {
  const megabytes = bytes / MB;

  return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`;
}

/* ---- Support inbox ------------------------------------------------------- */

function InboxView() {
  const [submissions, setSubmissions] = React.useState<ContactSubmission[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [replies, setReplies] = React.useState<ContactReply[]>([]);
  const [replyText, setReplyText] = React.useState('');
  const [stateFilter, setStateFilter] = React.useState<'NEW' | 'ACKNOWLEDGED' | 'CLOSED' | ''>('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);

    try {
      const result = await loadInbox(stateFilter ? { state: stateFilter } : {});

      setSubmissions(result.submissions);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'The inbox could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, [stateFilter]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (!selectedId) {
      setReplies([]);

      return;
    }

    void loadReplies(selectedId)
      .then((result) => setReplies(result.replies))
      .catch(() => setReplies([]));
  }, [selectedId]);

  const selected = submissions.find((item) => item.id === selectedId) || null;
  const addressLines = formatPostalAddress(selected?.address || null);

  async function handleReply() {
    if (!selected || !replyText.trim()) {
      return;
    }

    await sendReply(selected.id, replyText.trim());
    setReplyText('');
    await Promise.all([refresh(), loadReplies(selected.id).then((r) => setReplies(r.replies))]);
  }

  async function handleState(state: 'NEW' | 'ACKNOWLEDGED' | 'CLOSED') {
    if (!selected) {
      return;
    }

    await setSubmissionState(selected.id, state);
    await refresh();
  }

  return (
    <div className="staff-split">
      <section className="staff-list" aria-label="Support requests">
        <div className="staff-list-head">
          <h2>Support</h2>
          <select
            aria-label="Filter by state"
            onChange={(event) => setStateFilter(event.target.value as typeof stateFilter)}
            value={stateFilter}
          >
            <option value="">All</option>
            <option value="NEW">New</option>
            <option value="ACKNOWLEDGED">Answered</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>

        {error ? (
          <div className="staff-note is-warn" role="alert">
            <AlertTriangle aria-hidden size={16} />
            <p>{error}</p>
          </div>
        ) : null}

        {isLoading ? <p className="staff-muted">Loading…</p> : null}
        {!isLoading && !submissions.length ? <p className="staff-muted">Nothing here yet.</p> : null}

        {submissions.map((item) => (
          <button
            className={item.id === selectedId ? 'staff-row is-active' : 'staff-row'}
            key={item.id}
            onClick={() => setSelectedId(item.id)}
            type="button"
          >
            <span className="staff-row-top">
              <span className="staff-row-subject">{item.subject}</span>
              <StateTag state={item.state} />
            </span>
            <span className="staff-row-meta">
              {item.organizationName || item.name}
              {item.kind === 'SUPPORT_REQUEST' ? ' · Customer' : ' · Enquiry'}
              {' · '}
              {new Date(item.createdAtMs).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short'
              })}
            </span>
          </button>
        ))}
      </section>

      <section className="staff-detail" aria-label="Request detail">
        {!selected ? (
          <p className="staff-muted">Select a request to read it.</p>
        ) : (
          <>
            <h2>{selected.subject}</h2>
            <dl className="staff-facts">
              <div><dt>From</dt><dd>{selected.name} · {selected.email}</dd></div>
              <div><dt>Organization</dt><dd>{selected.organizationName || 'Not given'}</dd></div>
              <div><dt>Phone</dt><dd>{selected.phone || 'Not given'}</dd></div>
              <div>
                <dt>Address</dt>
                <dd>
                  {addressLines.length ? (
                    addressLines.map((line) => <div key={line}>{line}</div>)
                  ) : (
                    'Not given'
                  )}
                </dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{selected.kind === 'SUPPORT_REQUEST' ? 'Existing customer' : 'Public enquiry'}</dd>
              </div>
              <div>
                <dt>Received</dt>
                <dd>{new Date(selected.createdAtMs).toLocaleString()}</dd>
              </div>
            </dl>

            <p className="staff-message">{selected.message}</p>

            {replies.length ? (
              <div className="staff-replies">
                <h3>Replies</h3>
                {replies.map((reply) => (
                  <div className="staff-reply" key={`${reply.createdAtMs}-${reply.authorEmail}`}>
                    <p className="staff-reply-meta">
                      {reply.authorEmail} · {new Date(reply.createdAtMs).toLocaleString()}
                    </p>
                    <p>{reply.body}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <label className="staff-field">
              <span>Reply</span>
              <textarea
                onChange={(event) => setReplyText(event.target.value)}
                placeholder="Written to the address they gave."
                rows={5}
                value={replyText}
              />
            </label>

            <div className="staff-actions">
              <button
                className="staff-button is-primary"
                disabled={!replyText.trim()}
                onClick={() => void handleReply()}
                type="button"
              >
                Send reply
              </button>
              <button className="staff-button" onClick={() => void handleState('CLOSED')} type="button">
                Close
              </button>
              <button className="staff-button" onClick={() => void handleState('NEW')} type="button">
                Reopen
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/** Sign-in failures, said in a way that points at the fix. */
function describeSignInFailure(code: string): string {
  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not switched on for this project. Enable it in the'
        + ' Firebase console under Authentication, then try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Allow pop-ups for this page and try again.';
    case 'auth/unauthorized-domain':
      return 'This address is not on the allowed list in the Firebase console. Add it under'
        + ' Authentication, Settings, Authorized domains.';
    case 'auth/network-request-failed':
      return 'Could not reach Google. Check your connection and try again.';
    default:
      return code
        ? `Sign-in failed (${code}).`
        : 'Sign-in failed. Try again.';
  }
}

function StateTag({ state }: { state: ContactSubmission['state'] }) {
  const label = state === 'NEW' ? 'New' : state === 'ACKNOWLEDGED' ? 'Answered' : 'Closed';

  return <span className={`staff-tag is-${state.toLowerCase()}`}>{label}</span>;
}

/* ---- Policies ------------------------------------------------------------ */

function PoliciesView({ staff }: { staff: StaffContext }) {
  const [slug, setSlug] = React.useState<'privacy' | 'terms'>('privacy');
  const [published, setPublished] = React.useState<PolicyVersion | null>(null);
  const [versions, setVersions] = React.useState<PolicyVersion[]>([]);
  const [title, setTitle] = React.useState('');
  const [summary, setSummary] = React.useState('');
  const [body, setBody] = React.useState('');
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const result = await loadPolicy(slug);

      setPublished(result.published);
      setVersions(result.versions);

      const source = result.draft || result.published;

      setTitle(source?.title || (slug === 'privacy' ? 'Privacy' : 'Terms of service'));
      setSummary(result.draft?.summary || '');
      setBody(source?.body || '');
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'That could not be loaded.');
    }
  }, [slug]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleSave() {
    setError(null);
    setStatus(null);

    try {
      await savePolicyDraft(slug, { body, summary, title });
      setStatus('Draft saved. It is not public until you publish it.');
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'That could not be saved.');
    }
  }

  async function handlePublish() {
    setError(null);
    setStatus(null);

    try {
      const result = await publishPolicy(slug);

      setStatus(`Published version ${result.published.version}. It is live now.`);
      await refresh();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'That could not be published.');
    }
  }

  return (
    <div className="staff-split">
      <section className="staff-editor" aria-label="Policy editor">
        <div className="staff-list-head">
          <h2>Policies</h2>
          <select onChange={(event) => setSlug(event.target.value as typeof slug)} value={slug}>
            <option value="privacy">Privacy</option>
            <option value="terms">Terms of service</option>
          </select>
        </div>

        {error ? (
          <div className="staff-note is-warn" role="alert">
            <AlertTriangle aria-hidden size={16} />
            <p>{error}</p>
          </div>
        ) : null}

        {status ? <div className="staff-note is-ok" role="status"><p>{status}</p></div> : null}

        <label className="staff-field">
          <span>Title</span>
          <input onChange={(event) => setTitle(event.target.value)} type="text" value={title} />
        </label>

        <label className="staff-field">
          <span>What changed in this version</span>
          <input
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Read months from now, when somebody compares versions."
            type="text"
            value={summary}
          />
        </label>

        <label className="staff-field is-grow">
          <span>Policy text</span>
          <textarea onChange={(event) => setBody(event.target.value)} rows={22} value={body} />
        </label>

        <div className="staff-actions">
          <button className="staff-button" onClick={() => void handleSave()} type="button">
            Save draft
          </button>

          {/* Publishing is restricted: a published version becomes the document
              the company is held to, and can never be edited afterwards. */}
          {staff.role === 'ADMIN' ? (
            <button className="staff-button is-primary" onClick={() => void handlePublish()} type="button">
              Publish
            </button>
          ) : (
            <span className="staff-muted">Publishing needs an administrator.</span>
          )}
        </div>
      </section>

      <section className="staff-detail" aria-label="Version history">
        <h2>History</h2>
        <p className="staff-muted">
          {published
            ? `Version ${published.version} is live, published by ${published.publishedByEmail}.`
            : 'Nothing published yet. The website shows its built-in text until you publish.'}
        </p>

        {versions.map((version) => (
          <div className="staff-version" key={version.version}>
            <p className="staff-row-top">
              <span className="staff-row-subject">Version {version.version}</span>
              <span className={version.state === 'PUBLISHED' ? 'staff-tag is-new' : 'staff-tag'}>
                {version.state === 'PUBLISHED' ? 'Published' : 'Draft'}
              </span>
            </p>
            <p className="staff-row-meta">{version.summary || 'No summary given'}</p>
            {version.publishedAtMs ? (
              <p className="staff-row-meta">
                {new Date(version.publishedAtMs).toLocaleDateString()} · {version.publishedByEmail}
              </p>
            ) : null}
          </div>
        ))}
      </section>
    </div>
  );
}

const container = document.getElementById('root');

if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <StaffConsole />
    </React.StrictMode>
  );
}
