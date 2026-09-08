/**
 * Artwork for the account and settings pages.
 *
 * Drawn here rather than fetched, for three reasons: it stays in the brand's
 * own blue and green, it weighs a couple of kilobytes instead of a couple of
 * hundred, and it reads from the theme tokens, so it does not glow white on a
 * dark page the way a flat image would.
 *
 * Deliberately geometric. A badge, a shield, a set of controls: shapes that say
 * what the page is about without pretending to be a photograph of an office.
 */

/** Who you are: an identity card, checked and countersigned. */
export function AccountArtwork() {
  return (
    <svg
      aria-hidden="true"
      className="page-artwork"
      fill="none"
      role="presentation"
      viewBox="0 0 320 220"
    >
      <circle className="art-wash" cx="228" cy="72" r="86" />
      <circle className="art-wash-2" cx="96" cy="158" r="62" />

      {/* The card behind, tilted, to suggest a stack of records. */}
      <rect
        className="art-panel-back"
        height="118"
        rx="12"
        transform="rotate(-7 60 54)"
        width="176"
        x="60"
        y="54"
      />

      {/* The card in front. */}
      <rect className="art-panel" height="122" rx="13" width="182" x="66" y="52" />

      {/* Portrait square and the two lines of a name. */}
      <rect className="art-accent" height="42" rx="11" width="42" x="84" y="70" />
      <circle className="art-panel" cx="105" cy="85" r="7" />
      <path className="art-panel" d="M92 105c2.6-7 8-10.5 13-10.5S115.4 98 118 105z" />
      <rect className="art-line-strong" height="7" rx="3.5" width="82" x="138" y="76" />
      <rect className="art-line" height="6" rx="3" width="56" x="138" y="92" />

      {/* Field rows, the shape of the details listed below the artwork. */}
      <rect className="art-line" height="6" rx="3" width="146" x="84" y="126" />
      <rect className="art-line" height="6" rx="3" width="112" x="84" y="142" />

      {/* The verification mark, sitting proud of the card. */}
      <circle className="art-badge-ring" cx="232" cy="150" r="27" />
      <circle className="art-badge" cx="232" cy="150" r="21" />
      <path
        className="art-badge-tick"
        d="M223 150.5l6 6 12-12.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3.4"
      />
    </svg>
  );
}

/** What you can change: controls, and one that is locked. */
export function SettingsArtwork() {
  return (
    <svg
      aria-hidden="true"
      className="page-artwork"
      fill="none"
      role="presentation"
      viewBox="0 0 320 220"
    >
      <circle className="art-wash" cx="236" cy="82" r="80" />
      <circle className="art-wash-2" cx="88" cy="150" r="58" />

      <rect className="art-panel-back" height="112" rx="12" width="168" x="72" y="62" />
      <rect className="art-panel" height="118" rx="13" width="176" x="78" y="56" />

      {/* Three sliders, set to different positions. Controls that have been
          used, rather than a row of identical decorations. */}
      <rect className="art-line" height="6" rx="3" width="128" x="98" y="82" />
      <circle className="art-accent-dot" cx="188" cy="85" r="9" />

      <rect className="art-line" height="6" rx="3" width="128" x="98" y="110" />
      <circle className="art-accent-dot" cx="130" cy="113" r="9" />

      <rect className="art-line" height="6" rx="3" width="128" x="98" y="138" />
      <circle className="art-accent-dot" cx="160" cy="141" r="9" />

      {/* A padlock: some of these settings are not everybody's to change. */}
      <rect className="art-badge" height="34" rx="9" width="44" x="212" y="140" />
      <path
        className="art-badge-tick"
        d="M222 140v-8a12 12 0 0 1 24 0v8"
        strokeLinecap="round"
        strokeWidth="3.4"
      />
      <circle className="art-panel" cx="234" cy="156" r="4.5" />
    </svg>
  );
}

/**
 * Support, at the head of the page: a request going out, an answer coming
 * back, and the organization travelling with it.
 */
export function SupportArtwork() {
  return (
    <svg
      aria-hidden="true"
      className="page-artwork"
      fill="none"
      role="presentation"
      viewBox="0 0 320 220"
    >
      <circle className="art-wash" cx="222" cy="76" r="82" />
      <circle className="art-wash-2" cx="92" cy="156" r="58" />

      {/* The message being sent. */}
      <rect className="art-panel-back" height="92" rx="12" width="150" x="56" y="44" />
      <rect className="art-panel" height="94" rx="13" width="156" x="62" y="40" />
      <rect className="art-line-strong" height="7" rx="3.5" width="96" x="80" y="62" />
      <rect className="art-line" height="6" rx="3" width="118" x="80" y="80" />
      <rect className="art-line" height="6" rx="3" width="86" x="80" y="96" />
      {/* Its tail, so it reads as something spoken rather than a form. */}
      <path className="art-panel" d="M84 134v20l22-20z" />

      {/* The answer, coming back from the other side. */}
      <rect className="art-accent" height="66" rx="12" width="118" x="176" y="118" />
      <rect className="art-line" height="6" rx="3" width="76" x="192" y="138" />
      <rect className="art-line" height="6" rx="3" width="54" x="192" y="154" />

      {/* Who it came from, attached automatically. */}
      <circle className="art-badge-ring" cx="242" cy="66" r="26" />
      <circle className="art-badge" cx="242" cy="66" r="20" />
      <path
        className="art-badge-tick"
        d="M233 66.5l6 6 12-12.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3.4"
      />
    </svg>
  );
}

/**
 * Nothing asked yet.
 *
 * A tray with a dotted lip and one message resting above it: quiet, and clearly
 * a place where things will arrive, rather than a warning that something is
 * missing.
 */
export function SupportEmptyArtwork() {
  return (
    <svg
      aria-hidden="true"
      className="empty-artwork"
      fill="none"
      role="presentation"
      viewBox="0 0 200 140"
    >
      <circle className="art-wash" cx="100" cy="62" r="52" />

      <rect className="art-panel" height="46" rx="9" width="98" x="51" y="26" />
      <rect className="art-line" height="5" rx="2.5" width="62" x="63" y="40" />
      <rect className="art-line" height="5" rx="2.5" width="44" x="63" y="54" />

      {/* The tray. Dotted, because nothing has landed in it. */}
      <path
        className="art-tray"
        d="M40 88h34l8 12h36l8-12h34v22a8 8 0 0 1-8 8H48a8 8 0 0 1-8-8z"
        strokeDasharray="5 5"
        strokeWidth="2"
      />
    </svg>
  );
}

/**
 * Signing in: a phone, the code arriving on it, and a shield.
 *
 * The passcode digits carry a class each so they can be lit one after another,
 * which is the one thing on this page worth animating: it says what is about to
 * happen before it happens.
 */
export function SignInArtwork() {
  return (
    <svg
      aria-hidden="true"
      className="signin-artwork"
      fill="none"
      role="presentation"
      viewBox="0 0 320 300"
    >
      <circle className="art-wash" cx="212" cy="88" r="92" />
      <circle className="art-wash-2" cx="86" cy="214" r="72" />

      {/* The phone. */}
      <rect className="art-panel-back" height="212" rx="26" width="126" x="92" y="46" />
      <rect className="art-panel" height="206" rx="24" width="118" x="98" y="44" />
      <rect className="art-line" height="5" rx="2.5" width="30" x="142" y="60" />

      {/* The code, four boxes that fill one at a time. */}
      <rect className="art-code-box art-code-1" height="34" rx="8" width="24" x="114" y="120" />
      <rect className="art-code-box art-code-2" height="34" rx="8" width="24" x="144" y="120" />
      <rect className="art-code-box art-code-3" height="34" rx="8" width="24" x="174" y="120" />
      <rect className="art-code-box art-code-4" height="34" rx="8" width="24" x="204" y="120" />

      <rect className="art-line" height="6" rx="3" width="86" x="114" y="176" />
      <rect className="art-accent-dot" height="26" rx="13" width="104" x="114" y="196" />

      {/* The shield, sitting over the corner: the code is the lock. */}
      <path
        className="art-badge"
        d="M242 168c18-5 30-12 30-12s12 7 30 12v26c0 20-13 34-30 41-17-7-30-21-30-41z"
      />
      <path
        className="art-badge-tick"
        d="M262 194.5l6.5 6.5 13-13"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3.6"
      />
    </svg>
  );
}
