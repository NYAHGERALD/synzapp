import React from 'react';
import { getSynzappApiBaseUrl } from './config';
import { TenantDevicesPanel } from './TenantDevicesPanel';
import { PRIVACY_POLICY, SUBPROCESSORS, TERMS_OF_SERVICE } from './policyContent';
import { SUPPORTED_COUNTRIES, formatPostalCode, getCountryFormat } from './addressFormats';
import {
  ABOUT_PARAGRAPHS,
  ABOUT_PRINCIPLES,
  ASSURANCES,
  INTERPRETER_LANGUAGE_COUNT,
  INTERPRETER_SIMULTANEOUS_LANGUAGES,
  FOOTER_COLUMNS,
  PRODUCT_GROUPS,
  type ProductEntry
} from './marketingContent';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  DatabaseBackup,
  KeyRound,
  LockKeyhole,
  LogOut,
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
import { SupportWorkspace } from './SupportWorkspace';
import { RetentionConsole } from './RetentionConsole';
import { ActionConsole } from './ActionConsole';
import { AuditConsole } from './AuditConsole';
import { AnnouncementConsole } from './AnnouncementConsole';
import { AccountArtwork, SettingsArtwork, SignInArtwork } from './AccountArtwork';
import { formatPermissionLabel } from './permissionLabel';
import {
  CONTACT_STEPS,
  getContactProgress,
  validateContactStep,
  type ContactFormValues
} from './contactSteps';
import { Combobox } from './Combobox';
import { DashboardHome } from './DashboardHome';
import { SidePanel, type SidePanelGroup, type SidePanelItemId } from './SidePanel';
import './styles.css';


type DashboardModule = 'account' | 'actions' | 'announcements' | 'audit' | 'dashboard' | 'lsw' | 'rails' | 'rca' | 'retention' | 'settings' | 'support';
type AccountPanelTab = 'account' | 'settings';

const DASHBOARD_MODULES: DashboardModule[] = ['account', 'actions', 'announcements', 'audit', 'dashboard', 'lsw', 'rca', 'rails', 'retention', 'settings', 'support'];
const DASHBOARD_MODULE_HASHES: Record<DashboardModule, string> = {
  account: '#account',
  actions: '#actions',
  announcements: '#announcements',
  audit: '#audit',
  dashboard: '#dashboard',
  lsw: '#lsw',
  rails: '#rails',
  rca: '#rca',
  retention: '#compliance',
  settings: '#settings',
  support: '#support'
};
const DASHBOARD_MODULE_STORAGE_PREFIX = 'synzapp.dashboard.activeModule';
const PANEL_COLLAPSED_STORAGE_KEY = 'synzapp.workspace.panelCollapsed';


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
  /**
   * Sign-in is its own page, addressed by #sign-in so it can be linked to,
   * bookmarked, and left with the browser's own back button.
   */
  const [isSignInRoute, setIsSignInRoute] = React.useState(
    () => typeof window !== 'undefined' && window.location.hash === '#sign-in'
  );
  const [marketingRoute, setMarketingRoute] = React.useState(
    () => (typeof window !== 'undefined' ? window.location.hash : '')
  );

  React.useEffect(() => {
    const syncRoute = () => {
      setIsSignInRoute(window.location.hash === '#sign-in');
      setMarketingRoute(window.location.hash);
    };

    window.addEventListener('hashchange', syncRoute);

    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);

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
      setErrorMessage(getPhoneLoginErrorMessage(error, selectedCountry));
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
        <MarketingHeader />
        <SessionRestoreLoading />
      </main>
    );
  }

  if (isSignInRoute) {
    return (
    <div className="signin-shell">
      <MarketingHeader />
      <main className="signin-main">
        {/* The half of the screen that was empty now says who this is for and
            what is about to happen: a code, to a phone, and no password. */}
        <section className="signin-pitch">
          <p className="section-eyebrow">Sign in</p>
          <h1>Your organization's workplace, on your phone number.</h1>
          <p className="signin-pitch-lead">
            We text you a one-time code. There is no password to remember, and none to leak.
          </p>
          <SignInArtwork />
        </section>

        <aside className="login-card" aria-label="Sign in">
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

          <a className="privacy-link" href="#privacy">Privacy</a>
          <div id="synzapp-recaptcha" />
        </aside>

        <a className="signin-back" href="#top">Back to Synzapp</a>
      </main>
    </div>
    );
  }

  if (marketingRoute === '#privacy') {
    return <PolicyPage />;
  }

  if (marketingRoute === '#terms') {
    return <TermsPage />;
  }

  return (
    <div className="marketing-shell">
    {marketingRoute === '#contact' ? <ContactPage /> : null}
    <main className="landing-page">
      <MarketingHeader />

      <section className="hero" aria-label="Synzapp">
        <div className="hero-inner">
          <p className="hero-eyebrow">Enterprise Performance Suite</p>
          <h1>
            The work your company runs on,
            <br />
            and the record of it.
          </h1>
          <p className="hero-subtitle">
            Workplace chat the organization controls, a live interpreter across{' '}
            {INTERPRETER_LANGUAGE_COUNT} languages, and the operating routines that keep a business
            improving. Your legal and compliance teams keep control of the records.
          </p>

          <div className="hero-actions">
            <a className="button-primary" href="#sign-in">Sign in to your portal</a>
            <a className="button-secondary" href="#communication">See what it does</a>
          </div>

          <dl className="hero-facts">
            <div>
              <dt>Workplace chat</dt>
              <dd>Owned by the organization, not a consumer app</dd>
            </div>
            <div>
              <dt>{INTERPRETER_LANGUAGE_COUNT} languages</dt>
              <dd>Up to {INTERPRETER_SIMULTANEOUS_LANGUAGES} in the same meeting</dd>
            </div>
            <div>
              <dt>Records on request</dt>
              <dd>Freeze, search and produce what you are asked for</dd>
            </div>
          </dl>
        </div>
      </section>
    </main>

    <ProductSections />
    <AssuranceSection />
    <AboutSection />
    <MarketingFooter />
    </div>
  );
}

  // Sign-in lives on its own page, reached from the hero. A form competing with
  // the first sentence makes both worse: the person deciding whether this is
  // for them is not the person signing in, and the two were fighting for the
  // same space.

/**
 * What the product does, grouped the way a buyer thinks about it.
 *
 * Three groups rather than one list of seven: an organization evaluating this
 * arrives with one of these problems, not all three, and a flat grid makes them
 * read everything to find the one they came for.
 */
function ProductSections() {
  return (
    <>
      {PRODUCT_GROUPS.map((group, index) => (
        <section
          className={index === 1 ? 'marketing-section is-tinted' : 'marketing-section'}
          id={group.id}
          key={group.id}
        >
          <div className="marketing-inner">
            <div className="section-head">
              <h2 className="section-title">{group.title}</h2>
              <p className="section-lead">{group.intro}</p>
            </div>

            <div className={group.products.length > 2 ? 'product-grid is-three' : 'product-grid is-two'}>
              {group.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      ))}
    </>
  );
}

function ProductCard({ product }: { product: ProductEntry }) {
  return (
    <article className="product-card" id={product.id}>
      <h3>{product.name}</h3>
      <p className="product-description">{product.description}</p>
      <ul className="product-capabilities">
        {product.capabilities.map((capability) => (
          <li key={capability}>{capability}</li>
        ))}
      </ul>
    </article>
  );
}

/**
 * Why an organization can rely on this.
 *
 * Commitments rather than technology: the reader here is legal, compliance or
 * the owner, and what they need is the outcome they can hold us to.
 */
function AssuranceSection() {
  return (
    <section className="marketing-section is-assurance" id="assurance">
      <div className="marketing-inner">
        <div className="section-head">
          <h2 className="section-title">Why you can rely on it</h2>
          <p className="section-lead">
            Six commitments an organization can hold us to. Each is something the product does
            today, not something planned.
          </p>
        </div>

        <div className="assurance-grid">
          {ASSURANCES.map((assurance, index) => (
            <article className="assurance-item" key={assurance.title}>
              <span className="assurance-index">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{assurance.title}</h3>
                <p>{assurance.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * About us.
 *
 * A portrait beside the text rather than a stock office photograph, and no
 * invented company history. The image is decorative here: the section is
 * readable without it, and it carries no caption claiming who it is.
 */
function AboutSection() {
  return (
    <section className="marketing-section is-about" id="about">
      <div className="marketing-inner">
        <div className="section-head">
          <h2 className="section-title">About us</h2>
          <p className="section-lead">
            Why Synzapp exists, and what we hold ourselves to while building it.
          </p>
        </div>

        <div className="about-grid">
          <div className="about-portrait">
            <img
              alt=""
              aria-hidden="true"
              height={1065}
              loading="lazy"
              sizes="(max-width: 900px) 100vw, 420px"
              src="/assets/about-portrait.jpg"
              srcSet="/assets/about-portrait.jpg 760w, /assets/about-portrait@2x.jpg 1520w"
              width={760}
            />
          </div>

          <div className="about-body">
            {ABOUT_PARAGRAPHS.map((paragraph) => (
              <p className="about-paragraph" key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}

            <div className="about-principles">
              {ABOUT_PRINCIPLES.map((principle) => (
                <article className="about-principle" key={principle.title}>
                  <h3>{principle.title}</h3>
                  <p>{principle.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <div className="marketing-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <a className="brand-lockup is-footer" href="#top" aria-label="Synzapp home">
              <img alt="" aria-hidden="true" className="brand-logo" src="/assets/notification.png" />
              <span className="brand-name">Synzapp</span>
            </a>
            <p>
              Workplace chat the organization controls, a live interpreter across{' '}
              {INTERPRETER_LANGUAGE_COUNT} languages, and the operating routines that keep a
              business improving.
            </p>
          </div>

          <nav className="footer-nav" aria-label="Footer">
            {FOOTER_COLUMNS.map((column) => (
              <div className="footer-column" key={column.title}>
                <h4>{column.title}</h4>
                <ul>
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <a href={link.href}>{link.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="footer-bottom">
          <p>&copy; 2026 Synzapp Inc. All rights reserved.</p>
          <p className="footer-note">
            Messages are end-to-end encrypted. Where an organization enables a compliance archive,
            its staff are told.
          </p>
        </div>
      </div>
    </footer>
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

/**
 * The top bar.
 *
 * Section links as plain text with a single button for the one action that
 * matters. Outlined pills for every link give each the same weight as signing
 * in, which leaves a reader with no idea what the page wants them to do.
 */
function MarketingHeader() {
  return (
    <header className="brand-bar" aria-label="Synzapp navigation">
      <a className="brand-lockup" href="#top" aria-label="Synzapp home">
        <img alt="" aria-hidden="true" className="brand-logo" src="/assets/notification.png" />
        <span className="brand-name">Synzapp</span>
        <span className="brand-divider" />
        <span className="brand-suite">Enterprise Performance Suite</span>
      </a>

      <nav className="nav-links" aria-label="Primary navigation">
        <a href="#communication">Communication</a>
        <a href="#operations">Operations</a>
        <a href="#governance">Records</a>
        <a href="#assurance">Security</a>
        <span className="nav-rule" aria-hidden="true" />
        <a href="#contact">Contact</a>
        <a className="nav-cta" href="#sign-in">Sign in</a>
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
  const [isProfileMenuOpen, setIsProfileMenuOpen] = React.useState(false);
  const [activeModule, setActiveModule] = React.useState<DashboardModule>(() => getInitialDashboardModule(session));
  // Remembered, because somebody who collapsed the panel meant it, and having
  // to do it again on every visit is how a preference becomes an annoyance.
  const [isPanelCollapsed, setIsPanelCollapsed] = React.useState<boolean>(() => (
    window.localStorage.getItem(PANEL_COLLAPSED_STORAGE_KEY) === 'true'
  ));
  const [rcaEntryKey, setRcaEntryKey] = React.useState(0);
  const profileButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const profileMenuRef = React.useRef<HTMLDivElement | null>(null);
  const displayName = profile?.displayName || session.user.displayName || session.user.phoneMasked;
  const role = profile?.roleName || formatRole(session.user.role);
  const roleCode = (profile?.role || session.user.role || 'EMPLOYEE').toUpperCase();
  const companyName = profile?.companyName || 'Synzapp workspace';
  const departmentName = profile?.departmentName || 'Enterprise portal';
  const profilePhotoUrl = profilePhotoObjectUrl || session.user.profilePhotoUrl || null;
  const canViewLswVerification = ['DEPT_ADMIN', 'ORG_ADMIN', 'SYSTEM_ADMIN'].includes(roleCode);
  // Retention and legal hold are tenant-wide controls, so they stay with the
  // Org Admin rather than following the LSW verification audience.
  const canManageRetention = ['ORG_ADMIN', 'SYSTEM_ADMIN'].includes(roleCode);

  /**
   * What the panel offers, grouped the way somebody thinks about the work.
   *
   * Operations is what people do; governance is how it is answered for. A
   * section this person cannot open is shown locked rather than removed — a
   * menu that changes shape from person to person cannot be described in a
   * training note or over the phone.
   */
  const sidePanelGroups = React.useMemo((): SidePanelGroup[] => [
    {
      items: [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'lsw', label: 'LSW' },
        { id: 'rca', label: 'RCA' },
        { id: 'rails', label: 'RAILS' },
        { id: 'actions', label: 'Actions' },
        { id: 'announcements', label: 'Announcements' }
      ],
      title: 'OPERATIONS'
    },
    {
      items: [
        { id: 'audit', label: 'Audit log' },
        { id: 'retention', label: 'Compliance', locked: !canManageRetention }
      ],
      title: 'GOVERNANCE'
    },
    {
      items: [{ id: 'support', label: 'Support' }],
      title: 'HELP'
    }
  ], [canManageRetention, canViewLswVerification]);
  const permissions = React.useMemo(() => {
    return [...new Set([...(session.user.permissions || []), ...((profile as WebCurrentUserProfile & { permissions?: string[] } | null)?.permissions || [])])];
  }, [profile, session.user.permissions]);
  const setDashboardModule = React.useCallback((module: DashboardModule, options: { refreshRca?: boolean } = {}) => {
    if (module === 'rca' && options.refreshRca) {
      setRcaEntryKey((currentKey) => currentKey + 1);
    }

    setActiveModule(module);
    persistDashboardModule(session, module);
    // The account menu belongs to the panel it hangs off, and going somewhere
    // else should not leave it open over the new page.
    setIsProfileMenuOpen(false);
  }, [session]);

  React.useEffect(() => {
    persistDashboardModule(session, activeModule);
  }, [activeModule, session]);

  React.useEffect(() => {
    window.localStorage.setItem(PANEL_COLLAPSED_STORAGE_KEY, String(isPanelCollapsed));
  }, [isPanelCollapsed]);

  React.useEffect(() => {
    function handleHashChange() {
      const nextModule = getDashboardModuleFromHash();

      if (!nextModule) {
        return;
      }

      setActiveModule(nextModule);
      persistDashboardModule(session, nextModule);
      setIsProfileMenuOpen(false);
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

  function openAccountPanel(tab: AccountPanelTab) {
    setIsProfileMenuOpen(false);
    setDashboardModule(tab === 'settings' ? 'settings' : 'account');
  }

  return (
    <main className="workspace-page">
      <SidePanel
        activeId={activeModule}
        avatar={<Avatar className="side-panel-account-avatar" name={displayName} photoUrl={profilePhotoUrl} />}
        companyName={companyName}
        departmentName={departmentName}
        displayName={displayName}
        groups={sidePanelGroups}
        isCollapsed={isPanelCollapsed}
        isSettingsActive={activeModule === 'settings' || activeModule === 'account'}
        onOpenAccount={() => setIsProfileMenuOpen((isOpen) => !isOpen)}
        onOpenSettings={() => setDashboardModule('settings')}
        onSelect={(id: SidePanelItemId) => setDashboardModule(id)}
        onToggleCollapsed={() => setIsPanelCollapsed((collapsed) => !collapsed)}
        role={role}
      />

      {isProfileMenuOpen ? createPortal((
        <div
          aria-label="Employee profile menu"
          className="dashboard-profile-menu side-panel-profile-menu"
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
          <button onClick={() => openAccountPanel('account')} role="menuitem" type="button">
            <UserCircle aria-hidden="true" size={16} />
            My account
          </button>
          <button onClick={() => openAccountPanel('settings')} role="menuitem" type="button">
            <Settings aria-hidden="true" size={16} />
            Settings
          </button>
          <button onClick={onSignOut} role="menuitem" type="button">
            <LogOut aria-hidden="true" size={16} />
            Log out
          </button>
        </div>
      ), document.body) : null}

      <section className="workspace-content" aria-label="Synzapp workspace">
        {activeModule === 'dashboard' ? (
          <DashboardHome
            companyName={companyName}
            displayName={displayName}
            groups={sidePanelGroups}
            onOpen={(id: SidePanelItemId) => setDashboardModule(id)}
          />
        ) : null}
        {activeModule === 'account' ? (
          <AccountPage
            departmentName={departmentName}
            displayName={displayName}
            permissions={permissions}
            phoneMasked={profile?.phoneFormatted || profile?.phoneMasked || session.user.phoneMasked}
            profilePhotoUrl={profilePhotoUrl}
            role={role}
            roleCode={(profile?.role || session.user.role || 'EMPLOYEE').toUpperCase()}
            status={profile?.status || session.user.status}
            tenantName={companyName}
          />
        ) : null}
        {activeModule === 'settings' ? (
          <SettingsPage
            onSignOut={onSignOut}
            permissions={permissions}
            roleCode={(profile?.role || session.user.role || 'EMPLOYEE').toUpperCase()}
            session={session}
          />
        ) : null}
        {activeModule === 'actions' ? <ActionConsole /> : null}
        {activeModule === 'announcements' ? <AnnouncementConsole /> : null}
        {activeModule === 'audit' ? <AuditConsole /> : null}
        {activeModule === 'lsw' ? <LswPrototype /> : null}
        {activeModule === 'rca' ? <RcaWorkspace key={rcaEntryKey} /> : null}
        {activeModule === 'rails' ? <RailsWorkspace /> : null}
        {activeModule === 'retention' && canManageRetention ? <RetentionConsole adminName={displayName} /> : null}
        {activeModule === 'support' ? (
          <SupportWorkspace adminName={displayName} organizationName={companyName} />
        ) : null}
      </section>
    </main>
  );
}

function getInitialDashboardModule(session: BackendAuthSession): DashboardModule {
  // Not LSW any more: it is one of the sections that takes the whole window,
  // so opening there would mean arriving with no navigation in sight.
  return getDashboardModuleFromHash() || getStoredDashboardModule(session) || 'dashboard';
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

/**
 * The account page: who this person is, and what they are allowed to do.
 *
 * Laid out as a page rather than a stack of cards. The identity leads, the
 * facts sit on plain ruled rows, and only the things that genuinely group
 * together are boxed. Boxing everything flattens the hierarchy until nothing
 * looks more important than anything else.
 */
function AccountPage({
  departmentName,
  displayName,
  permissions,
  phoneMasked,
  profilePhotoUrl,
  role,
  roleCode,
  status,
  tenantName
}: {
  departmentName: string;
  displayName: string;
  permissions: string[];
  phoneMasked: string;
  profilePhotoUrl: string | null;
  role: string;
  roleCode: string;
  status: string;
  tenantName: string;
}) {
  const isOrgAdmin = roleCode === 'ORG_ADMIN' || roleCode === 'SYSTEM_ADMIN';
  const isDepartmentAdmin = roleCode === 'DEPT_ADMIN';
  const visiblePermissions = permissions.length ? permissions : getDefaultRoleCapabilities(roleCode);

  return (
    <div className="account-page">
      <div className="page-inner">
        <header className="page-hero">
          <div className="page-hero-text">
            <span className="page-eyebrow">Employee account</span>
            <h1>{displayName}</h1>
            <p className="page-hero-lead">
              {role} in {departmentName}, at {tenantName}.
            </p>
            <div className="page-hero-meta">
              <span className={`status-pill${status.toUpperCase() === 'ACTIVE' ? ' is-active' : ''}`}>
                <ShieldCheck aria-hidden="true" size={14} />
                {formatAccountStatus(status)}
              </span>
              <span className="page-hero-note">Signed in with a verified Synzapp profile</span>
            </div>
          </div>
          <AccountArtwork />
        </header>

        <section className="page-section" aria-labelledby="account-details-title">
          <div className="page-section-head">
            <h2 id="account-details-title">Details</h2>
          </div>
          <dl className="fact-rows">
            <FactRow icon={UserCircle} label="Name" value={displayName} />
            <FactRow icon={BriefcaseBusiness} label="Role" value={role} />
            <FactRow icon={Building2} label="Department" value={departmentName} />
            <FactRow icon={KeyRound} label="Phone" value={phoneMasked} />
            <FactRow icon={Building2} label="Organization" value={tenantName} />
          </dl>
        </section>

        <section className="page-section" aria-labelledby="account-access-title">
          <div className="page-section-head">
            <h2 id="account-access-title">What you can do</h2>
            <span className="page-section-note">
              {visiblePermissions.length} {visiblePermissions.length === 1 ? 'capability' : 'capabilities'}
            </span>
          </div>
          <ul className="capability-chips">
            {visiblePermissions.map((permission) => (
              <li key={permission}>{formatPermissionLabel(permission)}</li>
            ))}
          </ul>
        </section>

        <section className="page-section" aria-labelledby="account-controls-title">
          <div className="page-section-head">
            <h2 id="account-controls-title">Protections in place</h2>
            <span className="page-section-note">
              {isOrgAdmin ? 'Organization scope' : isDepartmentAdmin ? 'Department scope' : 'Employee scope'}
            </span>
          </div>
          <div className="assurance-row">
            <ProtectionNote
              icon={Smartphone}
              label="Registered devices"
              value="Only devices registered to you can open this account."
            />
            <ProtectionNote
              icon={LockKeyhole}
              label="Audit trail"
              value="Searching records, producing them and approving a deletion are each written down."
            />
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * The settings page: what this person can change, and who is allowed to.
 *
 * Administration is only listed when the person actually has it, so nobody is
 * shown a row they cannot use.
 */
function SettingsPage({
  onSignOut,
  permissions,
  roleCode,
  session
}: {
  onSignOut: () => void;
  permissions: string[];
  roleCode: string;
  session: BackendAuthSession;
}) {
  const isOrgAdmin = roleCode === 'ORG_ADMIN' || roleCode === 'SYSTEM_ADMIN';
  const isDepartmentAdmin = roleCode === 'DEPT_ADMIN';
  const [isDevicesPanelOpen, setIsDevicesPanelOpen] = React.useState(false);
  const settingsSections = getAccountSettingsSections({
    isDepartmentAdmin,
    isOrgAdmin,
    permissions
  });

  return (
    <div className="account-page">
      <div className="page-inner">
        <header className="page-hero">
          <div className="page-hero-text">
            <span className="page-eyebrow">Settings</span>
            <h1>What you can change</h1>
            <p className="page-hero-lead">
              Your own preferences, and the company settings your role lets you reach.
            </p>
          </div>
          <SettingsArtwork />
        </header>

        <section className="page-section" aria-labelledby="settings-personal-title">
          <div className="page-section-head">
            <h2 id="settings-personal-title">Yours</h2>
            <span className="page-section-note">Available to every active user</span>
          </div>
          <div className="settings-rows">
            <SettingsRow
              icon={UserCircle}
              status="Active"
              subtitle="Name, photo, role, department, and phone identity"
              title="Profile"
            />
            <SettingsRow
              icon={Smartphone}
              status="Mobile-backed"
              subtitle="Registered devices for this account"
              title="My devices"
            />
            <SettingsRow
              icon={DatabaseBackup}
              status="Policy-backed"
              subtitle="Encrypted chat history and recovery readiness"
              title="Chat backup"
            />
          </div>
        </section>

        {isDevicesPanelOpen ? (
          <TenantDevicesPanel onClose={() => setIsDevicesPanelOpen(false)} />
        ) : null}

        {settingsSections.length ? (
          <section className="page-section" aria-labelledby="settings-admin-title">
            <div className="page-section-head">
              <h2 id="settings-admin-title">The company's</h2>
              <span className="page-section-note">{isOrgAdmin ? 'Org Admin' : 'Department Admin'}</span>
            </div>
            <div className="settings-rows">
              {settingsSections.map((section) => (
                <SettingsRow
                  // The only row that leads anywhere yet. Revoking a device is
                  // the one administrator job that may be needed because a phone
                  // is gone, so it cannot live only on a phone.
                  onOpen={section.title === 'Organization security'
                    ? () => setIsDevicesPanelOpen(true)
                    : undefined}
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

        <section className="session-band" aria-labelledby="settings-session-title">
          <div>
            <h2 id="settings-session-title">Session</h2>
            <p>
              {session.access === 'ACTIVE'
                ? 'Your web session is active and verified.'
                : `Session state: ${session.access}`}
            </p>
          </div>
          <button className="session-signout" onClick={onSignOut} type="button">
            <LogOut aria-hidden="true" size={16} />
            Log out
          </button>
        </section>
      </div>
    </div>
  );
}

/** One ruled row: a label, and the thing itself. No box. */
function FactRow({
  icon: Icon,
  label,
  value
}: {
  icon: React.ComponentType<{ 'aria-hidden': true; size: number }>;
  label: string;
  value: string;
}) {
  return (
    <div className="fact-row">
      <dt>
        <Icon aria-hidden={true} size={16} />
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

function ProtectionNote({
  icon: Icon,
  label,
  value
}: {
  icon: React.ComponentType<{ 'aria-hidden': true; size: number }>;
  label: string;
  value: string;
}) {
  return (
    <article className="assurance-note">
      <span className="assurance-icon">
        <Icon aria-hidden={true} size={18} />
      </span>
      <div>
        <h3>{label}</h3>
        <p>{value}</p>
      </div>
    </article>
  );
}

function SettingsRow({
  icon: Icon,
  onOpen,
  status,
  subtitle,
  title
}: {
  icon: React.ComponentType<{ 'aria-hidden': true; size: number }>;
  /** Given only to rows that lead somewhere. The rest stay plain labels. */
  onOpen?: () => void;
  status: string;
  subtitle: string;
  title: string;
}) {
  const body = (
    <>
      <span className="settings-row-icon">
        <Icon aria-hidden={true} size={18} />
      </span>
      <div className="settings-row-text">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <span className="settings-row-status">{status}</span>
    </>
  );

  if (!onOpen) {
    return <article className="settings-row">{body}</article>;
  }

  return (
    <button className="settings-row settings-row-button" onClick={onOpen} type="button">
      {body}
    </button>
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
    sections.push({ icon: LockKeyhole, status: 'Restricted', subtitle: 'Organization devices, revocation, encrypted backup policy, and access controls', title: 'Organization security' });
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

function getPhoneLoginErrorMessage(error: unknown, country: CountryConfig): string {
  const message = getErrorMessage(error);
  const code = getErrorCode(error);
  const normalizedMessage = message.toLowerCase();

  if (
    code === 'auth/operation-not-allowed' ||
    normalizedMessage.includes('auth/operation-not-allowed') ||
    normalizedMessage.includes('sms unable to be sent until this region')
  ) {
    return `SMS login is not enabled for ${country.label} (${country.code}) in Firebase Authentication. Choose an enabled country code, or ask an administrator to enable this SMS region in Firebase Console.`;
  }

  if (code === 'auth/invalid-phone-number' || normalizedMessage.includes('auth/invalid-phone-number')) {
    return `Enter a valid ${country.label} phone number for ${country.code}.`;
  }

  if (code === 'auth/too-many-requests' || normalizedMessage.includes('auth/too-many-requests')) {
    return 'Too many login attempts were made from this device. Please wait a few minutes, then try again.';
  }

  return message;
}

function getErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;

    return typeof code === 'string' ? code : '';
  }

  return '';
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppLoadingProvider>
      <App />
    </AppLoadingProvider>
  </React.StrictMode>
);

/**
 * The privacy policy, and the list of companies that process data on our behalf.
 *
 * Both on one page because they are asked for together: a buyer's security
 * review wants the policy and the sub-processor list in the same breath, and
 * splitting them means one of the two is always out of date.
 */
function TermsPage() {
  return (
    <div className="marketing-shell">
      <MarketingHeader />

      <article className="policy-page">
        <div className="policy-inner">
          <p className="section-eyebrow">Policies</p>
          <h1>{TERMS_OF_SERVICE.title}</h1>
          <p className="policy-intro">{TERMS_OF_SERVICE.intro}</p>
          <p className="policy-updated">Last updated {TERMS_OF_SERVICE.lastUpdated}</p>

          {TERMS_OF_SERVICE.sections.map((section) => (
            <section className="policy-section" key={section.heading}>
              <h2>{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}

          <p className="policy-updated">
            The Privacy Policy forms part of these terms. <a href="#privacy">Read it here</a>.
          </p>

          <a className="policy-back" href="#top">Back to Synzapp</a>
        </div>
      </article>

      <MarketingFooter />
    </div>
  );
}

function PolicyPage() {
  return (
    <div className="marketing-shell">
      <MarketingHeader />

      <article className="policy-page">
        <div className="policy-inner">
          <p className="section-eyebrow">Policies</p>
          <h1>{PRIVACY_POLICY.title}</h1>
          <p className="policy-intro">{PRIVACY_POLICY.intro}</p>
          <p className="policy-updated">Last updated {PRIVACY_POLICY.lastUpdated}</p>

          {PRIVACY_POLICY.sections.map((section) => (
            <section className="policy-section" key={section.heading}>
              <h2>{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}

          <section className="policy-section" id="subprocessors">
            <h2>Companies that process data for us</h2>
            <p>
              These are the only companies that handle information on our behalf. If this list
              changes, we update it here and tell affected organizations.
            </p>

            <div className="policy-table-wrap">
              <table className="policy-table">
                <thead>
                  <tr>
                    <th scope="col">Company</th>
                    <th scope="col">What they do</th>
                    <th scope="col">Where</th>
                  </tr>
                </thead>
                <tbody>
                  {SUBPROCESSORS.map((entry) => (
                    <tr key={entry.name}>
                      <td className="policy-cell-strong">{entry.name}</td>
                      <td>{entry.purpose}</td>
                      <td>{entry.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <a className="signin-back" href="#top">Back to Synzapp</a>
        </div>
      </article>

      <MarketingFooter />
    </div>
  );
}

/**
 * How somebody outside the product reaches us.
 *
 * Deliberately plain. A contact page that asks for a job title, a company size
 * and a budget before it will accept a sentence is a lead-capture form wearing
 * a contact page's clothes, and people with a real question give up on it.
 *//**
 * How somebody outside the product reaches us.
 *
 * Laid out in rows so the whole form — including the Send button — fits on one
 * screen. A contact form that has to be scrolled to find its own button loses
 * people who were ready to write.
 */
function ContactPage() {
  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [organizationName, setOrganizationName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [countryCode, setCountryCode] = React.useState('US');
  const [addressLine1, setAddressLine1] = React.useState('');
  const [addressLine2, setAddressLine2] = React.useState('');
  const [city, setCity] = React.useState('');
  const [region, setRegion] = React.useState('');
  const [postalCode, setPostalCode] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const firstFieldRef = React.useRef<HTMLInputElement | null>(null);

  const country = getCountryFormat(countryCode);
  const currentStep = CONTACT_STEPS[step];
  const values: ContactFormValues = {
    addressLine1,
    addressLine2,
    city,
    countryCode,
    email,
    message,
    name,
    organizationName,
    phone,
    postalCode,
    region,
    subject
  };

  // Each step puts the cursor in its first field, so somebody filling this in
  // from the keyboard never has to reach for the mouse between questions.
  React.useEffect(() => {
    firstFieldRef.current?.focus();
  }, [step]);

  /**
   * Clears the region and postal code when the country changes.
   *
   * A US state left behind after switching to Canada would be submitted as a
   * Canadian province, and a ZIP code would fail a postcode check with no
   * obvious reason why.
   */
  function handleCountryChange(nextCode: string) {
    setCountryCode(nextCode);
    setRegion('');
    setPostalCode('');
  }

  function handleBack() {
    setError(null);
    setStep((current) => Math.max(current - 1, 0));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const stepError = validateContactStep(step, values);

    if (stepError) {
      setError(stepError);

      return;
    }

    setError(null);

    if (step < CONTACT_STEPS.length - 1) {
      setStep(step + 1);

      return;
    }

    setIsSending(true);

    try {
      const response = await fetch(`${getSynzappApiBaseUrl()}/api/contact/enquiries`, {
        body: JSON.stringify({
          address: {
            city,
            countryCode,
            line1: addressLine1,
            line2: addressLine2,
            postalCode: postalCode.trim() ? formatPostalCode(countryCode, postalCode) : '',
            region
          },
          email,
          message,
          name,
          organizationName,
          phone: phone.trim() ? `${country.dialCode} ${phone.trim()}` : '',
          subject
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST'
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));

        throw new Error((payload as { message?: string }).message || 'Your message could not be sent.');
      }

      setSent(true);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Your message could not be sent.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="contact-overlay" role="dialog" aria-modal="true" aria-label="Contact Synzapp">
      {/* The page carries on behind the blur. Closing puts you back exactly
          where you were, rather than on a page you have to navigate out of. */}
      <a
        aria-label="Close"
        className="contact-overlay-close"
        href="#top"
      >
        <X aria-hidden="true" size={20} />
      </a>

      <div className="contact-overlay-inner">
          <p className="section-eyebrow">Contact</p>
          <h1>Talk to us</h1>

          {sent ? (
            <div className="retention-note is-signal" role="status">
              <ShieldCheck aria-hidden size={17} />
              <div>
                <p className="retention-note-title">Thank you. Your message has reached us.</p>
                <p>We reply to the address you gave. If this was urgent, say so in a follow-up.</p>
              </div>
            </div>
          ) : (
            <>
              <p className="contact-lead">
                Questions about whether Synzapp fits your organization, or anything else. If you
                already use Synzapp, raise it from inside your console instead. It reaches us with
                your organization attached.
              </p>

              <div className="contact-wizard">
                <div
                  aria-hidden="true"
                  className="contact-progress"
                  style={{ '--contact-progress': `${getContactProgress(step) * 100}%` } as React.CSSProperties}
                />

                <form className="contact-step" onSubmit={(event) => void handleSubmit(event)}>
                  <div className="contact-step-head">
                    {step > 0 ? (
                      <button
                        aria-label="Back to the previous question"
                        className="contact-back"
                        onClick={handleBack}
                        type="button"
                      >
                        <ArrowLeft aria-hidden="true" size={18} />
                      </button>
                    ) : null}
                    <h2>{currentStep.title}</h2>
                    <span className="contact-step-count">
                      Step {step + 1} of {CONTACT_STEPS.length}
                    </span>
                  </div>

                  {/* Announced when it changes, so somebody using a screen
                      reader is told they have moved on rather than finding
                      different fields under the same heading. */}
                  <div aria-live="polite" className="contact-step-body">
                    {currentStep.key === 'email' ? (
                      <label className="form-field">
                        <span>Work email</span>
                        <input
                          autoComplete="email"
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="you@yourcompany.com"
                          ref={firstFieldRef}
                          type="email"
                          value={email}
                        />
                      </label>
                    ) : null}

                    {currentStep.key === 'about' ? (
                      <>
                        <div className="contact-row">
                          <label className="form-field">
                            <span>Your name</span>
                            <input
                              autoComplete="name"
                              onChange={(event) => setName(event.target.value)}
                              ref={firstFieldRef}
                              type="text"
                              value={name}
                            />
                          </label>
                          <label className="form-field">
                            <span>Organization (optional)</span>
                            <input
                              autoComplete="organization"
                              onChange={(event) => setOrganizationName(event.target.value)}
                              type="text"
                              value={organizationName}
                            />
                          </label>
                        </div>
                        <div className="contact-row">
                          <div className="form-field">
                            <span id="contact-country-label">Country</span>
                            <Combobox
                              id="contact-country"
                              labelledBy="contact-country-label"
                              onChange={(label) => {
                                const match = SUPPORTED_COUNTRIES.find((option) => option.label === label);
                                handleCountryChange(match ? match.code : countryCode);
                              }}
                              options={SUPPORTED_COUNTRIES.map((option) => option.label)}
                              value={country.label}
                            />
                          </div>
                          <label className="form-field">
                            <span>Phone (optional)</span>
                            <div className="contact-phone">
                              <span className="contact-dial">{country.dialCode}</span>
                              <input
                                autoComplete="tel"
                                onChange={(event) => setPhone(event.target.value)}
                                type="tel"
                                value={phone}
                              />
                            </div>
                          </label>
                        </div>
                      </>
                    ) : null}

                    {currentStep.key === 'address' ? (
                      <>
                        <div className="contact-row">
                          <label className="form-field">
                            <span>Street address</span>
                            <input
                              autoComplete="address-line1"
                              onChange={(event) => setAddressLine1(event.target.value)}
                              ref={firstFieldRef}
                              type="text"
                              value={addressLine1}
                            />
                          </label>
                          <label className="form-field">
                            <span>Suite or floor (optional)</span>
                            <input
                              autoComplete="address-line2"
                              onChange={(event) => setAddressLine2(event.target.value)}
                              type="text"
                              value={addressLine2}
                            />
                          </label>
                        </div>
                        <div className="contact-row">
                          <label className="form-field">
                            <span>City</span>
                            <input
                              autoComplete="address-level2"
                              onChange={(event) => setCity(event.target.value)}
                              type="text"
                              value={city}
                            />
                          </label>
                          <div className="form-field">
                            <span id="contact-region-label">{country.regionLabel}</span>
                            {country.regionOptions.length ? (
                              <Combobox
                                id="contact-region"
                                labelledBy="contact-region-label"
                                onChange={setRegion}
                                options={country.regionOptions}
                                value={region}
                              />
                            ) : (
                              <input
                                aria-labelledby="contact-region-label"
                                onChange={(event) => setRegion(event.target.value)}
                                type="text"
                                value={region}
                              />
                            )}
                          </div>
                          <label className="form-field">
                            <span>{country.postalLabel}</span>
                            <input
                              autoComplete="postal-code"
                              onChange={(event) => setPostalCode(event.target.value)}
                              placeholder={country.postalPlaceholder}
                              type="text"
                              value={postalCode}
                            />
                          </label>
                        </div>
                        <p className="contact-step-note">
                          All optional. It helps us route you to the right team.
                        </p>
                      </>
                    ) : null}

                    {currentStep.key === 'message' ? (
                      <>
                        <label className="form-field">
                          <span>Subject</span>
                          <input
                            onChange={(event) => setSubject(event.target.value)}
                            placeholder="A short summary"
                            ref={firstFieldRef}
                            type="text"
                            value={subject}
                          />
                        </label>
                        <label className="form-field">
                          <span>Message</span>
                          <textarea
                            onChange={(event) => setMessage(event.target.value)}
                            placeholder="Tell us what you need. If it is urgent, say so."
                            rows={5}
                            value={message}
                          />
                        </label>
                      </>
                    ) : null}
                  </div>

                  {error ? (
                    <p className="contact-error" role="alert">{error}</p>
                  ) : null}

                  <div className="contact-step-actions">
                    <button className="button-primary" disabled={isSending} type="submit">
                      {isSending ? 'Sending…' : currentStep.nextLabel}
                      {step < CONTACT_STEPS.length - 1 ? <ArrowRight aria-hidden="true" size={16} /> : null}
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}

      </div>
    </div>
  );
}
