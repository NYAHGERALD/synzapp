import React from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  ClipboardCheck,
  Cpu,
  DatabaseBackup,
  KeyRound,
  LockKeyhole,
  LogOut,
  Menu,
  Network,
  SearchCheck,
  Settings,
  ShieldCheck,
  Smartphone,
  UserCircle,
  UsersRound,
  X
} from 'lucide-react';
import {
  getCurrentWebProfilePhotoObjectUrl,
  getCurrentWebUserProfile,
  sendPhoneLoginCode,
  verifyPhoneLoginCode,
  verifyBackendAuthSession,
  type BackendAuthSession,
  type PhoneLoginSession,
  type WebCurrentUserProfile
} from './auth';
import { AppLoadingProvider, useAppLoading } from './appLoading';
import { ensureSynzappAuthPersistence, getSynzappFirebaseAuth, isFirebaseConfigured } from './firebase';
import { LswPrototype } from './LswPrototype';
import { RailsWorkspace } from './RailsWorkspace';
import { RcaWorkspace } from './RcaWorkspace';
import './styles.css';

const features = [
  {
    description: 'Standardize routines, boost accountability, and drive sustained improvement through structured daily processes.',
    icon: ClipboardCheck,
    title: 'Leaders Standard Work'
  },
  {
    description: 'Identify underlying issues, prevent recurrence, and enhance system reliability with robust RCA tools.',
    icon: SearchCheck,
    title: 'Root Cause Analysis'
  },
  {
    description: 'Rapid Action & Improvement Looping System: streamline workflows, automate tracking, and accelerate efficiency across all levels.',
    icon: Network,
    title: 'RAILS'
  }
] as const;

type DashboardModule = 'lsw' | 'rails' | 'rca';
type AccountPanelTab = 'account' | 'settings';

const DASHBOARD_MODULES: DashboardModule[] = ['lsw', 'rca', 'rails'];
const DASHBOARD_MODULE_HASHES: Record<DashboardModule, string> = {
  lsw: '#lsw',
  rails: '#rails',
  rca: '#rca'
};
const DASHBOARD_MODULE_STORAGE_PREFIX = 'synzapp.dashboard.activeModule';

const countries = [
  {
    code: '+1',
    example: '(555) 123-4567',
    id: 'US',
    label: 'USA',
    nationalLength: 10
  },
  {
    code: '+1',
    example: '(416) 555-0198',
    id: 'CA',
    label: 'Canada',
    nationalLength: 10
  },
  {
    code: '+52',
    example: '55 1234 5678',
    id: 'MX',
    label: 'Mexico',
    nationalLength: 10
  },
  {
    code: '+44',
    example: '20 7946 0958',
    id: 'GB',
    label: 'United Kingdom',
    nationalLength: 10
  }
] as const;

type CountryId = typeof countries[number]['id'];
type CountryConfig = typeof countries[number];

function App() {
  const [selectedCountryId, setSelectedCountryId] = React.useState<CountryId>('US');
  const [phoneDigits, setPhoneDigits] = React.useState('');
  const [verificationCode, setVerificationCode] = React.useState('');
  const [phoneSession, setPhoneSession] = React.useState<PhoneLoginSession | null>(null);
  const [backendSession, setBackendSession] = React.useState<BackendAuthSession | null>(null);
  const [currentProfile, setCurrentProfile] = React.useState<WebCurrentUserProfile | null>(null);
  const [profilePhotoObjectUrl, setProfilePhotoObjectUrl] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isRestoringSession, setIsRestoringSession] = React.useState(() => isFirebaseConfigured());

  const selectedCountry = getCountryById(selectedCountryId);
  const formattedPhone = formatPhoneNumber(phoneDigits, selectedCountry);
  const isCodeStep = Boolean(phoneSession);

  React.useEffect(() => {
    return () => {
      if (profilePhotoObjectUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(profilePhotoObjectUrl);
      }
    };
  }, [profilePhotoObjectUrl]);

  React.useEffect(() => {
    if (!isFirebaseConfigured()) {
      setIsRestoringSession(false);
      return undefined;
    }

    let isActive = true;
    const auth = getSynzappFirebaseAuth();

    void ensureSynzappAuthPersistence().catch(() => undefined);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      void (async () => {
        if (!isActive) {
          return;
        }

        setIsRestoringSession(true);

        if (!user) {
          setBackendSession(null);
          setCurrentProfile(null);
          setProfilePhotoObjectUrl(null);
          setIsRestoringSession(false);
          return;
        }

        try {
          const idToken = await user.getIdToken();
          const session = await verifyBackendAuthSession(idToken, 'restore');
          assertCanOpenPortal(session);

          const profile = await getCurrentWebUserProfile();

          if (profile.status !== 'ACTIVE') {
            throw new Error('Your profile is not active. Please contact your organization administrator.');
          }

          const nextProfilePhotoObjectUrl = profile.profilePhotoUrl
            ? await getCurrentWebProfilePhotoObjectUrl().catch(() => null)
            : null;

          if (!isActive) {
            return;
          }

          setBackendSession(session);
          setCurrentProfile(profile);
          setProfilePhotoObjectUrl(nextProfilePhotoObjectUrl);
          setPhoneSession(null);
          setVerificationCode('');
          setErrorMessage('');
          setStatusMessage('');
        } catch (error) {
          await signOut(auth).catch(() => undefined);

          if (!isActive) {
            return;
          }

          setBackendSession(null);
          setCurrentProfile(null);
          setProfilePhotoObjectUrl(null);
          setErrorMessage(getErrorMessage(error));
        } finally {
          if (isActive) {
            setIsRestoringSession(false);
          }
        }
      })();
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage('');
    setStatusMessage('');

    if (!isFirebaseConfigured()) {
      setErrorMessage('Firebase web configuration is missing. Add the web environment values before logging in.');
      return;
    }

    try {
      setIsSubmitting(true);

      if (!phoneSession) {
        if (phoneDigits.length !== selectedCountry.nationalLength) {
          setErrorMessage(`Enter a complete ${selectedCountry.label} phone number.`);
          return;
        }

        const fullPhoneNumber = buildE164PhoneNumber(phoneDigits, selectedCountry);
        const nextPhoneSession = await sendPhoneLoginCode(fullPhoneNumber);
        setPhoneSession(nextPhoneSession);
        setStatusMessage(`Secure code sent to ${selectedCountry.code} ${formattedPhone}.`);
        return;
      }

      if (verificationCode.trim().length < 6) {
        setErrorMessage('Enter the verification code sent to your phone.');
        return;
      }

      const session = await verifyPhoneLoginCode(phoneSession, verificationCode);
      assertCanOpenPortal(session);

      const profile = await getCurrentWebUserProfile();
      if (profile.status !== 'ACTIVE') {
        throw new Error('Your profile is not active. Please contact your organization administrator.');
      }

      setCurrentProfile(profile);

      if (profile.profilePhotoUrl) {
        try {
          const nextProfilePhotoObjectUrl = await getCurrentWebProfilePhotoObjectUrl();
          setProfilePhotoObjectUrl(nextProfilePhotoObjectUrl);
        } catch {
          setProfilePhotoObjectUrl(null);
        }
      } else {
        setProfilePhotoObjectUrl(null);
      }

      setBackendSession(session);
      setStatusMessage(getSignedInMessage(session));
    } catch (error) {
      await signOut(getSynzappFirebaseAuth()).catch(() => undefined);
      setBackendSession(null);
      setCurrentProfile(null);
      setProfilePhotoObjectUrl(null);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCountryChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const countryId = event.target.value as CountryId;
    setSelectedCountryId(countryId);
    setPhoneDigits('');
    handleUseDifferentPhone();
  }

  function handleUseDifferentPhone() {
    setBackendSession(null);
    setCurrentProfile(null);
    setProfilePhotoObjectUrl(null);
    setErrorMessage('');
    setPhoneSession(null);
    setStatusMessage('');
    setVerificationCode('');
  }

  function handleSignOut() {
    void signOut(getSynzappFirebaseAuth()).catch(() => undefined);
    setBackendSession(null);
    setCurrentProfile(null);
    setProfilePhotoObjectUrl(null);
    setErrorMessage('');
    setPhoneDigits('');
    setPhoneSession(null);
    setStatusMessage('');
    setVerificationCode('');
  }

  if (backendSession) {
    return (
      <Dashboard
        onSignOut={handleSignOut}
        profile={currentProfile}
        profilePhotoObjectUrl={profilePhotoObjectUrl}
        session={backendSession}
      />
    );
  }

  if (isRestoringSession) {
    return (
      <main className="landing-page">
        <img
          alt=""
          aria-hidden="true"
          className="hero-image"
          src="/assets/landing-page-background.png"
        />
        <MarketingHeader />
        <SessionRestoreLoading />
      </main>
    );
  }

  return (
    <main className="landing-page">
      <img
        alt=""
        aria-hidden="true"
        className="hero-image"
        src="/assets/landing-page-background.png"
      />

      <MarketingHeader />

      <section className="hero-content" aria-label="Synzapp enterprise performance landing page">
        <div className="hero-copy">
          <div>
            <h1>Transforming Enterprise Operations</h1>
            <p className="hero-subtitle">
              Unlock productivity with Leaders Standard Work, RCA, and RAILS.
            </p>
          </div>

          <div className="feature-grid" aria-label="Synzapp features">
            {features.map((feature) => {
              const FeatureIcon = feature.icon;

              return (
                <article className="feature-card" key={feature.title}>
                  <div className="feature-icon">
                    <FeatureIcon aria-hidden="true" size={34} strokeWidth={1.55} />
                  </div>
                  <h2>{feature.title}</h2>
                  <p>{feature.description}</p>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="login-card" aria-label="Phone number login">
          <h2>Log In to Your Portal</h2>

          <form className="login-form" onSubmit={(event) => void handleSubmit(event)}>
            <label className="field-label" htmlFor="country-code">Country Code</label>
            <div className="country-select-shell">
              <select
                className="country-select"
                disabled={isCodeStep}
                id="country-code"
                onChange={handleCountryChange}
                value={selectedCountryId}
              >
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.label} {country.code}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" size={18} />
            </div>

            <label className="field-label" htmlFor="phone-number">Phone Number</label>
            <input
              autoComplete="tel-national"
              className="login-input"
              disabled={isCodeStep}
              id="phone-number"
              inputMode="tel"
              onChange={(event) => setPhoneDigits(getPhoneDigits(event.target.value, selectedCountry))}
              placeholder={selectedCountry.example}
              type="tel"
              value={formattedPhone}
            />

            {isCodeStep ? (
              <>
                <label className="field-label" htmlFor="verification-code">OTP Code</label>
                <input
                  autoComplete="one-time-code"
                  className="login-input"
                  id="verification-code"
                  inputMode="numeric"
                  maxLength={8}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="Enter secure code"
                  type="text"
                  value={verificationCode}
                />
              </>
            ) : null}

            {statusMessage ? (
              <p className="form-message success" role="status">{statusMessage}</p>
            ) : null}

            {errorMessage ? (
              <p className="form-message error" role="alert">{errorMessage}</p>
            ) : null}

            <button className="login-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'PLEASE WAIT' : isCodeStep ? 'VERIFY CODE' : 'LOG IN'}
            </button>

            {isCodeStep ? (
              <button className="secondary-action" onClick={handleUseDifferentPhone} type="button">
                Use a different phone
              </button>
            ) : null}
          </form>

          <a className="privacy-link" href="/privacy">Privacy Policy</a>
          <div id="synzapp-recaptcha" />
        </aside>
      </section>

      <footer className="landing-footer">
        &copy; 2026 Synzapp Inc. All rights reserved.
      </footer>
    </main>
  );
}

function SessionRestoreLoading() {
  const { beginLoading } = useAppLoading();

  React.useEffect(() => beginLoading({
    detail: 'Verifying profile, permissions, company, and department context',
    message: 'Opening your Synzapp workspace',
    scope: 'app',
    title: 'Restoring secure session'
  }), [beginLoading]);

  return null;
}

function MarketingHeader() {
  return (
    <header className="brand-bar" aria-label="Synzapp navigation">
      <div className="brand-lockup">
        <img alt="Synzapp" className="brand-logo" src="/assets/notification.png" />
        <span className="brand-name">Synzapp</span>
        <span className="brand-divider" />
        <span className="brand-suite">Enterprise Performance Suite</span>
      </div>
      <nav className="nav-links" aria-label="Primary navigation">
        <a href="#contact">Contact</a>
        <a href="#about">About us</a>
      </nav>
    </header>
  );
}

function Dashboard({
  onSignOut,
  profile,
  profilePhotoObjectUrl,
  session
}: {
  onSignOut: () => void;
  profile: WebCurrentUserProfile | null;
  profilePhotoObjectUrl: string | null;
  session: BackendAuthSession;
}) {
  const [isMobileNavOpen, setIsMobileNavOpen] = React.useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = React.useState(false);
  const [accountPanelTab, setAccountPanelTab] = React.useState<AccountPanelTab>('account');
  const [isAccountPanelOpen, setIsAccountPanelOpen] = React.useState(false);
  const [activeModule, setActiveModule] = React.useState<DashboardModule>(() => getInitialDashboardModule(session));
  const [rcaEntryKey, setRcaEntryKey] = React.useState(0);
  const profileButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const profileMenuRef = React.useRef<HTMLDivElement | null>(null);
  const displayName = profile?.displayName || session.user.displayName || session.user.phoneMasked;
  const role = profile?.roleName || formatRole(session.user.role);
  const companyName = profile?.companyName || 'Synzapp workspace';
  const departmentName = profile?.departmentName || 'Enterprise portal';
  const profilePhotoUrl = profilePhotoObjectUrl || session.user.profilePhotoUrl || null;
  const permissions = React.useMemo(() => {
    return [...new Set([...(session.user.permissions || []), ...((profile as WebCurrentUserProfile & { permissions?: string[] } | null)?.permissions || [])])];
  }, [profile, session.user.permissions]);
  const setDashboardModule = React.useCallback((module: DashboardModule, options: { refreshRca?: boolean } = {}) => {
    if (module === 'rca' && options.refreshRca) {
      setRcaEntryKey((currentKey) => currentKey + 1);
    }

    setActiveModule(module);
    persistDashboardModule(session, module);
    setIsMobileNavOpen(false);
  }, [session]);

  React.useEffect(() => {
    persistDashboardModule(session, activeModule);
  }, [activeModule, session]);

  React.useEffect(() => {
    function handleHashChange() {
      const nextModule = getDashboardModuleFromHash();

      if (!nextModule) {
        return;
      }

      setActiveModule(nextModule);
      persistDashboardModule(session, nextModule);
      setIsMobileNavOpen(false);
    }

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [session]);

  React.useEffect(() => {
    if (!isProfileMenuOpen) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (profileButtonRef.current?.contains(target) || profileMenuRef.current?.contains(target)) {
        return;
      }

      setIsProfileMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false);
        profileButtonRef.current?.focus();
      }
    }

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileMenuOpen]);

  React.useEffect(() => {
    if (!isAccountPanelOpen) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsAccountPanelOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAccountPanelOpen]);

  function openAccountPanel(tab: AccountPanelTab) {
    setAccountPanelTab(tab);
    setIsProfileMenuOpen(false);
    setIsAccountPanelOpen(true);
  }

  const renderModuleLinks = () => (
    <>
      <button
        className={activeModule === 'lsw' ? 'is-active' : ''}
        onClick={() => {
          setDashboardModule('lsw');
        }}
        type="button"
      >
        LSW
      </button>
      <button
        className={activeModule === 'rca' ? 'is-active' : ''}
        onClick={() => {
          setDashboardModule('rca', { refreshRca: true });
        }}
        type="button"
      >
        RCA
      </button>
      <button
        className={activeModule === 'rails' ? 'is-active' : ''}
        onClick={() => {
          setDashboardModule('rails');
        }}
        type="button"
      >
        RAILS
      </button>
    </>
  );

  return (
    <main className="dashboard-page">
      <header className="dashboard-topbar" aria-label="Synzapp dashboard navigation">
        <div className="brand-lockup">
          <img alt="Synzapp" className="brand-logo" src="/assets/notification.png" />
          <div className="dashboard-brand-text">
            <span className="brand-name">Synzapp</span>
            <span className="dashboard-company-name">{companyName}</span>
          </div>
        </div>
        <nav className="dashboard-nav" aria-label="Workspace modules">
          {renderModuleLinks()}
        </nav>
        <div className="dashboard-account">
          <div className="dashboard-user-meta" aria-label="Signed in user role and department">
            <span>{role}</span>
            <span>{departmentName}</span>
          </div>
          <button
            aria-controls="dashboard-profile-menu"
            aria-expanded={isProfileMenuOpen}
            aria-haspopup="menu"
            aria-label={`Open employee profile menu for ${displayName}`}
            className="dashboard-profile-trigger"
            onClick={() => setIsProfileMenuOpen((isOpen) => !isOpen)}
            ref={profileButtonRef}
            type="button"
          >
            <Avatar className="dashboard-nav-avatar" name={displayName} photoUrl={profilePhotoUrl} />
          </button>
          <button
            aria-controls="dashboard-module-menu"
            aria-expanded={isMobileNavOpen}
            aria-label={isMobileNavOpen ? 'Close workspace module menu' : 'Open workspace module menu'}
            className="dashboard-menu-button"
            onClick={() => setIsMobileNavOpen((isOpen) => !isOpen)}
            type="button"
          >
            {isMobileNavOpen ? <X aria-hidden="true" size={22} /> : <Menu aria-hidden="true" size={22} />}
          </button>
        </div>
        {isMobileNavOpen ? createPortal((
          <nav
            className="dashboard-mobile-nav is-open"
            id="dashboard-module-menu"
            aria-label="Workspace modules"
          >
            {renderModuleLinks()}
          </nav>
        ), document.body) : null}
        {isProfileMenuOpen ? createPortal((
          <div
            aria-label="Employee profile menu"
            className="dashboard-profile-menu"
            id="dashboard-profile-menu"
            ref={profileMenuRef}
            role="menu"
          >
            <div className="dashboard-profile-menu-card">
              <Avatar className="dashboard-profile-menu-avatar" name={displayName} photoUrl={profilePhotoUrl} />
              <div>
                <span>{displayName}</span>
                <strong>{role}</strong>
                <small>{departmentName}</small>
              </div>
            </div>
            <button
              onClick={() => openAccountPanel('settings')}
              role="menuitem"
              type="button"
            >
              <Settings aria-hidden="true" size={16} />
              Settings
            </button>
            <button
              onClick={() => openAccountPanel('account')}
              role="menuitem"
              type="button"
            >
              <UserCircle aria-hidden="true" size={16} />
              Account
            </button>
            <button
              className="is-danger"
              onClick={() => {
                setIsProfileMenuOpen(false);
                onSignOut();
              }}
              role="menuitem"
              type="button"
            >
              <LogOut aria-hidden="true" size={16} />
              Log out
            </button>
          </div>
        ), document.body) : null}
        {isAccountPanelOpen ? createPortal((
          <AccountPanel
            activeTab={accountPanelTab}
            departmentName={departmentName}
            displayName={displayName}
            onClose={() => setIsAccountPanelOpen(false)}
            onSignOut={onSignOut}
            permissions={permissions}
            phoneMasked={profile?.phoneFormatted || profile?.phoneMasked || session.user.phoneMasked}
            profilePhotoUrl={profilePhotoUrl}
            role={role}
            roleCode={(profile?.role || session.user.role || 'EMPLOYEE').toUpperCase()}
            session={session}
            setActiveTab={setAccountPanelTab}
            status={profile?.status || session.user.status}
            tenantName={companyName}
            uid={profile?.uid || session.user.uid}
          />
        ), document.body) : null}
      </header>

      <section className="dashboard-shell" aria-label="Synzapp dashboard">
        {activeModule === 'lsw' ? <LswPrototype /> : null}
        {activeModule === 'rca' ? <RcaWorkspace key={rcaEntryKey} /> : null}
        {activeModule === 'rails' ? <RailsWorkspace /> : null}
      </section>
    </main>
  );
}

function getInitialDashboardModule(session: BackendAuthSession): DashboardModule {
  return getDashboardModuleFromHash() || getStoredDashboardModule(session) || 'lsw';
}

function getDashboardModuleFromHash(): DashboardModule | null {
  const normalizedHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  return isDashboardModule(normalizedHash) ? normalizedHash : null;
}

function getStoredDashboardModule(session: BackendAuthSession): DashboardModule | null {
  try {
    const storedModule = window.localStorage.getItem(getDashboardModuleStorageKey(session));
    return isDashboardModule(storedModule) ? storedModule : null;
  } catch {
    return null;
  }
}

function persistDashboardModule(session: BackendAuthSession, module: DashboardModule): void {
  try {
    window.localStorage.setItem(getDashboardModuleStorageKey(session), module);
  } catch {
    // Local storage can be unavailable in restricted browser contexts.
  }

  const nextHash = DASHBOARD_MODULE_HASHES[module];
  if (window.location.hash !== nextHash) {
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${nextHash}`);
  }
}

function getDashboardModuleStorageKey(session: BackendAuthSession): string {
  return `${DASHBOARD_MODULE_STORAGE_PREFIX}:${session.user.uid}`;
}

function isDashboardModule(value: unknown): value is DashboardModule {
  return typeof value === 'string' && DASHBOARD_MODULES.includes(value as DashboardModule);
}

function AccountPanel({
  activeTab,
  departmentName,
  displayName,
  onClose,
  onSignOut,
  permissions,
  phoneMasked,
  profilePhotoUrl,
  role,
  roleCode,
  session,
  setActiveTab,
  status,
  tenantName,
  uid
}: {
  activeTab: AccountPanelTab;
  departmentName: string;
  displayName: string;
  onClose: () => void;
  onSignOut: () => void;
  permissions: string[];
  phoneMasked: string;
  profilePhotoUrl: string | null;
  role: string;
  roleCode: string;
  session: BackendAuthSession;
  setActiveTab: (tab: AccountPanelTab) => void;
  status: string;
  tenantName: string;
  uid: string;
}) {
  const isOrgAdmin = roleCode === 'ORG_ADMIN' || roleCode === 'SYSTEM_ADMIN';
  const isDepartmentAdmin = roleCode === 'DEPT_ADMIN';
  const visiblePermissions = permissions.length ? permissions : getDefaultRoleCapabilities(roleCode);
  const settingsSections = getAccountSettingsSections({
    isDepartmentAdmin,
    isOrgAdmin,
    permissions
  });

  return (
    <div
      aria-labelledby="account-panel-title"
      aria-modal="true"
      className="account-panel-overlay"
      onClick={onClose}
      role="dialog"
    >
      <section className="account-panel" onClick={(event) => event.stopPropagation()}>
        <header className="account-panel-header">
          <div className="account-panel-profile">
            <Avatar className="account-panel-avatar" name={displayName} photoUrl={profilePhotoUrl} />
            <div>
              <span>Employee account</span>
              <h2 id="account-panel-title">{displayName}</h2>
              <p>{role} · {departmentName}</p>
            </div>
          </div>
          <button aria-label="Close account" onClick={onClose} type="button">
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        <div className="account-panel-tabs" role="tablist" aria-label="Account sections">
          <button
            aria-selected={activeTab === 'account'}
            className={activeTab === 'account' ? 'is-active' : ''}
            onClick={() => setActiveTab('account')}
            role="tab"
            type="button"
          >
            <UserCircle aria-hidden="true" size={16} />
            Account
          </button>
          <button
            aria-selected={activeTab === 'settings'}
            className={activeTab === 'settings' ? 'is-active' : ''}
            onClick={() => setActiveTab('settings')}
            role="tab"
            type="button"
          >
            <Settings aria-hidden="true" size={16} />
            Settings
          </button>
        </div>

        <div className="account-panel-body">
          {activeTab === 'account' ? (
            <>
              <section className="account-hero-card">
                <div>
                  <span>{status}</span>
                  <h3>{tenantName}</h3>
                  <p>Signed in with a verified Synzapp profile and tenant role assignment.</p>
                </div>
                <BadgeCheck aria-hidden="true" size={34} />
              </section>

              <div className="account-detail-list">
                <AccountFact icon={UserCircle} label="Name" value={displayName} />
                <AccountFact icon={BriefcaseBusiness} label="Role" value={role} />
                <AccountFact icon={Building2} label="Department" value={departmentName} />
                <AccountFact icon={KeyRound} label="Phone" value={phoneMasked} />
                <AccountFact icon={ShieldCheck} label="Status" value={formatAccountStatus(status)} />
              </div>

              <section className="account-section">
                <div className="account-section-title">
                  <h3>Access Profile</h3>
                  <span>{visiblePermissions.length} capability{visiblePermissions.length === 1 ? '' : 'ies'}</span>
                </div>
                <div className="account-permission-list">
                  {visiblePermissions.slice(0, 12).map((permission) => (
                    <span key={permission}>{formatPermissionLabel(permission)}</span>
                  ))}
                </div>
              </section>

              <section className="account-section">
                <div className="account-section-title">
                  <h3>Enterprise Controls</h3>
                  <span>{isOrgAdmin ? 'Organization scope' : isDepartmentAdmin ? 'Department scope' : 'Employee scope'}</span>
                </div>
                <div className="account-control-list">
                  <AccountControlCard icon={Smartphone} label="Registered devices" value="Protected by device identity" />
                  <AccountControlCard icon={DatabaseBackup} label="Encrypted backup" value="Tenant policy controlled" />
                  <AccountControlCard icon={Cpu} label="Synzapp AI" value="Device readiness tracked" />
                  <AccountControlCard icon={LockKeyhole} label="Audit trail" value="Sensitive actions audited" />
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="account-section">
                <div className="account-section-title">
                  <h3>Personal Settings</h3>
                  <span>Available to every active user</span>
                </div>
                <div className="account-settings-list">
                  <AccountSettingsRow icon={UserCircle} title="Profile" subtitle="Name, photo, role, department, and phone identity" status="Active" />
                  <AccountSettingsRow icon={Smartphone} title="My devices" subtitle="Registered devices for this account" status="Mobile-backed" />
                  <AccountSettingsRow icon={DatabaseBackup} title="Chat backup" subtitle="Encrypted chat history and recovery readiness" status="Policy-backed" />
                  <AccountSettingsRow icon={Cpu} title="Synzapp AI" subtitle="Offline AI status and device readiness" status="Device-backed" />
                </div>
              </section>

              {settingsSections.length ? (
                <section className="account-section">
                  <div className="account-section-title">
                    <h3>Administration</h3>
                    <span>{isOrgAdmin ? 'Org Admin' : 'Department Admin'}</span>
                  </div>
                  <div className="account-settings-list">
                    {settingsSections.map((section) => (
                      <AccountSettingsRow
                        icon={section.icon}
                        key={section.title}
                        status={section.status}
                        subtitle={section.subtitle}
                        title={section.title}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="account-section account-session-section">
                <div>
                  <h3>Session</h3>
                  <p>{session.access === 'ACTIVE' ? 'Your web session is active and verified.' : `Session state: ${session.access}`}</p>
                </div>
                <button onClick={onSignOut} type="button">
                  <LogOut aria-hidden="true" size={16} />
                  Log out
                </button>
              </section>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function AccountFact({
  icon: Icon,
  label,
  value
}: {
  icon: React.ComponentType<{ 'aria-hidden': true; size: number }>;
  label: string;
  value: string;
}) {
  return (
    <article className="account-fact">
      <Icon aria-hidden={true} size={16} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function AccountControlCard({
  icon: Icon,
  label,
  value
}: {
  icon: React.ComponentType<{ 'aria-hidden': true; size: number }>;
  label: string;
  value: string;
}) {
  return (
    <article className="account-control-card">
      <Icon aria-hidden={true} size={17} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function AccountSettingsRow({
  icon: Icon,
  status,
  subtitle,
  title
}: {
  icon: React.ComponentType<{ 'aria-hidden': true; size: number }>;
  status: string;
  subtitle: string;
  title: string;
}) {
  return (
    <article className="account-settings-row">
      <span>
        <Icon aria-hidden={true} size={17} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{subtitle}</p>
      </div>
      <em>{status}</em>
    </article>
  );
}

function getAccountSettingsSections({
  isDepartmentAdmin,
  isOrgAdmin,
  permissions
}: {
  isDepartmentAdmin: boolean;
  isOrgAdmin: boolean;
  permissions: string[];
}) {
  const hasPermission = (permission: string) => permissions.includes(permission);
  const sections: Array<{
    icon: React.ComponentType<{ 'aria-hidden': true; size: number }>;
    status: string;
    subtitle: string;
    title: string;
  }> = [];

  if (isOrgAdmin || hasPermission('tenant.update')) {
    sections.push(
      { icon: Building2, status: 'Org Admin', subtitle: 'Company details, logo, calendar year, retention, and security mode', title: 'Company profile' },
      { icon: BarChart3, status: 'Org Admin', subtitle: 'Company LSW metrics and key result configuration', title: 'Key results' }
    );
  }

  if (isOrgAdmin || hasPermission('departments.manage') || hasPermission('roles.manage')) {
    sections.push(
      { icon: BriefcaseBusiness, status: 'Admin', subtitle: 'Departments, company roles, and role-based access bundles', title: 'Departments and roles' },
      { icon: ShieldCheck, status: 'Admin', subtitle: 'Role permission catalog and permission bundle governance', title: 'Role permissions' }
    );
  }

  if (isOrgAdmin || isDepartmentAdmin || hasPermission('users.manage') || hasPermission('users.invite')) {
    sections.push(
      { icon: UsersRound, status: isOrgAdmin ? 'Org scope' : 'Dept scope', subtitle: 'Employee invites, lifecycle state, and department admin assignment', title: 'Employees' },
      { icon: BadgeCheck, status: isOrgAdmin ? 'Org scope' : 'Dept scope', subtitle: 'Scoped department admin capabilities and approval boundaries', title: 'Department admin permissions' }
    );
  }

  if (isOrgAdmin || isDepartmentAdmin || hasPermission('groups.manage') || hasPermission('groups.create')) {
    sections.push({ icon: UsersRound, status: isOrgAdmin ? 'Org scope' : 'Dept scope', subtitle: 'Company and department group management', title: 'Groups' });
  }

  if (isOrgAdmin || hasPermission('security.manage')) {
    sections.push({ icon: LockKeyhole, status: 'Restricted', subtitle: 'Tenant devices, revocation, encrypted backup policy, and access controls', title: 'Organization security' });
  }

  return sections;
}

function getDefaultRoleCapabilities(roleCode: string): string[] {
  if (roleCode === 'ORG_ADMIN' || roleCode === 'SYSTEM_ADMIN') {
    return ['tenant.update', 'users.manage', 'departments.manage', 'roles.manage', 'groups.manage', 'security.manage'];
  }

  if (roleCode === 'DEPT_ADMIN') {
    return ['users.invite', 'groups.create', 'department.scope'];
  }

  return ['profile.view', 'chat.use', 'lsw.use', 'rca.use', 'rails.use'];
}

function formatPermissionLabel(permission: string): string {
  return permission
    .replace(/\./g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatAccountStatus(status: string): string {
  return status
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function Avatar({
  className = '',
  name,
  photoUrl
}: {
  className?: string;
  name: string;
  photoUrl: string | null;
}) {
  const initials = getInitials(name);

  return (
    <div className={`dashboard-avatar ${className}`.trim()}>
      {photoUrl ? (
        <img alt={name} src={photoUrl} />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

function getCountryById(countryId: CountryId): CountryConfig {
  return countries.find((country) => country.id === countryId) || countries[0];
}

function getPhoneDigits(value: string, country: CountryConfig): string {
  const digits = value.replace(/\D/g, '');
  const nationalDigits = country.id === 'GB' && digits.startsWith('0')
    ? digits.slice(1)
    : digits;

  return nationalDigits.slice(0, country.nationalLength);
}

function buildE164PhoneNumber(digits: string, country: CountryConfig): string {
  return `${country.code}${digits}`;
}

function formatPhoneNumber(digits: string, country: CountryConfig): string {
  if (!digits) {
    return '';
  }

  if (country.id === 'US' || country.id === 'CA') {
    return formatNorthAmericanPhoneNumber(digits);
  }

  if (country.id === 'MX') {
    return formatGroupedPhoneNumber(digits, [2, 4, 4]);
  }

  return formatGroupedPhoneNumber(digits, [2, 4, 4]);
}

function formatNorthAmericanPhoneNumber(digits: string): string {
  if (digits.length <= 3) {
    return `(${digits}`;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatGroupedPhoneNumber(digits: string, groups: number[]): string {
  const parts: string[] = [];
  let cursor = 0;

  for (const groupLength of groups) {
    const nextPart = digits.slice(cursor, cursor + groupLength);

    if (nextPart) {
      parts.push(nextPart);
    }

    cursor += groupLength;
  }

  return parts.join(' ');
}

function getSignedInMessage(session: BackendAuthSession): string {
  const name = session.user.displayName?.trim();
  const identity = name || session.user.phoneMasked;

  return `${identity} signed in. Portal routing: ${session.nextStep}.`;
}

function assertCanOpenPortal(session: BackendAuthSession): void {
  if (
    session.access === 'ACTIVE' &&
    session.nextStep === 'OPEN_APP' &&
    session.user.status === 'ACTIVE' &&
    session.user.tenantId &&
    session.user.role
  ) {
    return;
  }

  if (session.nextStep === 'CREATE_PROFILE' || session.access === 'PROFILE_REQUIRED') {
    throw new Error('Your profile has not been verified yet. Please contact your organization administrator.');
  }

  if (session.nextStep === 'CONTACT_ADMIN' || session.access === 'BLOCKED') {
    throw new Error('Access denied. Please contact your organization administrator.');
  }

  throw new Error('Your profile is not active. Please contact your organization administrator.');
}

function getInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || 'S';
}

function formatRole(role?: string): string {
  if (!role) {
    return 'Synzapp user';
  }

  return role
    .split('_')
    .map((part) => `${part.slice(0, 1)}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppLoadingProvider>
      <App />
    </AppLoadingProvider>
  </React.StrictMode>
);
