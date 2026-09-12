/**
 * SYNZAPP COLOUR RULE. Read this before changing any screen.
 *
 *   The entire background is `groupedBackground`. Headers, footers, page
 *   bodies, empty space: all of it.
 *
 *   The ONLY things that are `groupedCard` are:
 *     - cards with rounded corners
 *     - the floating footer navigation bar
 *
 * Light: background #F2F2F6, cards #FFFFFF.
 * Dark:  background #000000, cards #1C1C1E.
 *
 * A screen with a white page and a grey panel on it is the rule applied
 * upside down, and has been shipped that way once already. If a surface is
 * not a rounded card, it is not white.
 *
 * The rest of the layout rules live in SYNZAPP_APP_STYLE.md at the repo root.
 */

export type AppColorScheme = 'dark' | 'light';

export interface AppColors {
  amber: string;
  amberSoft: string;
  appShell: string;
  background: string;
  border: string;
  blue: string;
  blueSoft: string;
  card: string;
  chatBackground: string;
  composer: string;
  destructive: string;
  divider: string;
  footer: string;
  footerActive: string;
  /** The tinted ground a grouped card list sits on. */
  groupedBackground: string;
  /** A card on that ground. Must stay clearly lighter than it in both themes. */
  groupedCard: string;
  input: string;
  ink: string;
  /** Tinted text that acts as a button. The platform's own link blue. */
  link: string;
  /**
   * The same blue, softened, for an outline.
   *
   * A line has far more of it on screen than a word does, so link blue at full
   * strength around a card shouts where the same colour on a label does not.
   */
  linkOutline: string;
  muted: string;
  mutedStrong: string;
  overlay: string;
  /**
   * A heavier scrim, for when something has to be genuinely out of focus.
   *
   * `overlay` is the dimming a modal uses to say "this is on top". This is for
   * the reply focus, where the conversation behind must read as set aside
   * rather than merely covered.
   */
  overlayStrong: string;
  primary: string;
  primaryDark: string;
  primarySoft: string;
  red: string;
  redSoft: string;
  screen: string;
  /** The hairline between rows in a card. Stronger than `divider`, which is
      used for heavier borders elsewhere. */
  separator: string;
  success: string;
  successSoft: string;
  surface: string;
  surfaceElevated: string;
}

export const lightColors: AppColors = {
  amber: '#A16207',
  amberSoft: '#FEF3C7',
  appShell: '#FFFFFF',
  background: '#F5F7FA',
  border: '#D8E0EA',
  blue: '#1D4ED8',
  blueSoft: '#E0ECFF',
  card: '#FFFFFF',
  chatBackground: '#ECE5DD',
  composer: '#FFFFFF',
  destructive: '#DC2626',
  divider: '#E5E7EB',
  footer: '#FFFFFF',
  footerActive: '#DBEAFE',
  groupedBackground: '#F2F2F6',
  groupedCard: '#FFFFFF',
  input: '#FBFCFE',
  ink: '#111827',
  link: '#0079FE',
  linkOutline: 'rgba(0, 121, 254, 0.4)',
  muted: '#5D6675',
  mutedStrong: '#334155',
  overlay: 'rgba(15, 23, 42, 0.24)',
  overlayStrong: 'rgba(15, 23, 42, 0.62)',
  primary: '#0F766E',
  primaryDark: '#134E4A',
  primarySoft: '#DDF6F1',
  red: '#B91C1C',
  redSoft: '#FEE2E2',
  screen: '#FFFFFF',
  separator: '#DCDCE0',
  success: '#047857',
  successSoft: '#DCFCE7',
  surface: '#F4F6F8',
  surfaceElevated: '#FFFFFF'
};

export const darkColors: AppColors = {
  amber: '#FBBF24',
  amberSoft: '#2A2108',
  appShell: '#000000',
  background: '#000000',
  border: '#242424',
  blue: '#60A5FA',
  blueSoft: '#0B2447',
  card: '#0B0B0B',
  chatBackground: '#000000',
  composer: '#101010',
  destructive: '#F87171',
  divider: '#242424',
  footer: '#080808',
  groupedBackground: '#000000',
  groupedCard: '#1C1C1E',
  footerActive: '#12304F',
  input: '#111111',
  ink: '#F8FAFC',
  link: '#0A84FF',
  linkOutline: 'rgba(10, 132, 255, 0.45)',
  muted: '#A1A1AA',
  mutedStrong: '#D4D4D8',
  overlay: 'rgba(0, 0, 0, 0.62)',
  overlayStrong: 'rgba(0, 0, 0, 0.78)',
  primary: '#00A884',
  primaryDark: '#008069',
  primarySoft: '#063B34',
  red: '#F87171',
  redSoft: '#2A0F0F',
  screen: '#000000',
  separator: '#2C2C2E',
  success: '#22C55E',
  successSoft: '#052E1B',
  surface: '#0A0A0A',
  surfaceElevated: '#111111'
};

export const appThemes: Record<AppColorScheme, AppColors> = {
  dark: darkColors,
  light: lightColors
};

export const colors = lightColors;
