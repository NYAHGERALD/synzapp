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
  input: string;
  ink: string;
  muted: string;
  mutedStrong: string;
  overlay: string;
  primary: string;
  primaryDark: string;
  primarySoft: string;
  red: string;
  redSoft: string;
  screen: string;
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
  footerActive: '#EEF2FF',
  input: '#FBFCFE',
  ink: '#111827',
  muted: '#5D6675',
  mutedStrong: '#334155',
  overlay: 'rgba(15, 23, 42, 0.24)',
  primary: '#0F766E',
  primaryDark: '#134E4A',
  primarySoft: '#DDF6F1',
  red: '#B91C1C',
  redSoft: '#FEE2E2',
  screen: '#FFFFFF',
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
  footerActive: '#063B34',
  input: '#111111',
  ink: '#F8FAFC',
  muted: '#A1A1AA',
  mutedStrong: '#D4D4D8',
  overlay: 'rgba(0, 0, 0, 0.62)',
  primary: '#00A884',
  primaryDark: '#008069',
  primarySoft: '#063B34',
  red: '#F87171',
  redSoft: '#2A0F0F',
  screen: '#000000',
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
