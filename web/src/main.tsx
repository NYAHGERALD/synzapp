import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  Building2,
  ChevronDown,
  ClipboardCheck,
  LogOut,
  Network,
  SearchCheck,
  ShieldCheck,
  UserRound
} from 'lucide-react';
import {
  getCurrentWebProfilePhotoObjectUrl,
  getCurrentWebUserProfile,
  sendPhoneLoginCode,
  verifyPhoneLoginCode,
  type BackendAuthSession,
  type PhoneLoginSession,
  type WebCurrentUserProfile
} from './auth';
import { isFirebaseConfigured } from './firebase';
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
      setBackendSession(session);
      setStatusMessage(getSignedInMessage(session));

      try {
        const profile = await getCurrentWebUserProfile();
        setCurrentProfile(profile);

        if (profile.profilePhotoUrl) {
          try {
            const nextProfilePhotoObjectUrl = await getCurrentWebProfilePhotoObjectUrl();
            setProfilePhotoObjectUrl(nextProfilePhotoObjectUrl);
          } catch {
            setProfilePhotoObjectUrl(null);
          }
        }
      } catch {
        setCurrentProfile(null);
        setProfilePhotoObjectUrl(null);
      }
    } catch (error) {
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
  const displayName = profile?.displayName || session.user.displayName || session.user.phoneMasked;
  const role = profile?.roleName || formatRole(session.user.role);
  const companyName = profile?.companyName || 'Synzapp workspace';
  const departmentName = profile?.departmentName || 'Enterprise portal';
  const profilePhotoUrl = profilePhotoObjectUrl || session.user.profilePhotoUrl || null;

  return (
    <main className="dashboard-page">
      <header className="dashboard-topbar" aria-label="Synzapp dashboard navigation">
        <div className="brand-lockup">
          <img alt="Synzapp" className="brand-logo" src="/assets/notification.png" />
          <span className="brand-name">Synzapp</span>
        </div>
        <nav className="dashboard-nav" aria-label="Workspace modules">
          <a href="#lsw">LSW</a>
          <a href="#rca">RCA</a>
          <a href="#rails">RAILS</a>
        </nav>
        <button className="dashboard-signout" onClick={onSignOut} type="button">
          <LogOut aria-hidden="true" size={16} />
          Sign out
        </button>
      </header>

      <section className="dashboard-shell" aria-label="Synzapp dashboard">
        <aside className="dashboard-profile-card" aria-label="Signed in user profile">
          <Avatar name={displayName} photoUrl={profilePhotoUrl} />
          <p className="profile-eyebrow">Signed in</p>
          <h1>{displayName}</h1>
          <p className="profile-role">{role}</p>

          <div className="profile-detail-list">
            <span>
              <Building2 aria-hidden="true" size={16} />
              {companyName}
            </span>
            <span>
              <UserRound aria-hidden="true" size={16} />
              {departmentName}
            </span>
            <span>
              <ShieldCheck aria-hidden="true" size={16} />
              {session.access === 'ACTIVE' ? 'Active secure session' : 'Profile setup required'}
            </span>
          </div>
        </aside>

        <div className="dashboard-main">
          <div className="dashboard-hero">
            <p className="dashboard-eyebrow">Enterprise Performance Suite</p>
            <h2>Welcome to your Synzapp web portal.</h2>
            <p>
              Continue operational work across Leaders Standard Work, Root Cause Analysis,
              and RAILS from one secure workspace.
            </p>
          </div>

          <div className="dashboard-module-grid">
            <DashboardModule
              description="Plan, verify, and sustain leader routines with visible ownership."
              icon={ClipboardCheck}
              id="lsw"
              title="LSW"
            />
            <DashboardModule
              description="Investigate recurring issues and document corrective actions."
              icon={SearchCheck}
              id="rca"
              title="RCA"
            />
            <DashboardModule
              description="Track rapid actions and improvement loops across the organization."
              icon={Network}
              id="rails"
              title="RAILS"
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function DashboardModule({
  description,
  icon: ModuleIcon,
  id,
  title
}: {
  description: string;
  icon: typeof ClipboardCheck;
  id: string;
  title: string;
}) {
  return (
    <a className="dashboard-module-card" href={`#${id}`}>
      <div className="dashboard-module-icon">
        <ModuleIcon aria-hidden="true" size={28} strokeWidth={1.6} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </a>
  );
}

function Avatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const initials = getInitials(name);

  return (
    <div className="dashboard-avatar">
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
    <App />
  </React.StrictMode>
);
