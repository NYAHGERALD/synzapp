import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName, useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import {
  AppColorScheme,
  AppColors,
  appThemes
} from './colors';

export type AppThemePreference = 'dark' | 'light' | 'system';

interface AppTheme {
  colors: AppColors;
  isDark: boolean;
  preference: AppThemePreference;
  scheme: AppColorScheme;
  setPreference: (preference: AppThemePreference) => Promise<void>;
}

const APP_THEME_STORAGE_KEY = 'synzapp.themePreference.v1';
const AppThemeContext = createContext<AppTheme | null>(null);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<AppThemePreference>('system');
  const scheme = resolveColorScheme(preference, systemColorScheme);
  const colors = appThemes[scheme];

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(APP_THEME_STORAGE_KEY)
      .then((storedPreference) => {
        if (isMounted && isAppThemePreference(storedPreference)) {
          setPreferenceState(storedPreference);
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? null : preference);
  }, [preference]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
  }, [colors.background]);

  const setPreference = useMemo(() => async (nextPreference: AppThemePreference) => {
    setPreferenceState(nextPreference);
    await AsyncStorage.setItem(APP_THEME_STORAGE_KEY, nextPreference);
  }, []);

  const value = useMemo<AppTheme>(() => ({
    colors,
    isDark: scheme === 'dark',
    preference,
    scheme,
    setPreference
  }), [colors, preference, scheme, setPreference]);

  return (
    <AppThemeContext.Provider value={value}>
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme(): AppTheme {
  const theme = useContext(AppThemeContext);

  if (!theme) {
    throw new Error('useAppTheme must be used inside AppThemeProvider.');
  }

  return theme;
}

export function getThemePreferenceLabel(preference: AppThemePreference): string {
  if (preference === 'dark') {
    return 'Dark';
  }

  if (preference === 'light') {
    return 'Light';
  }

  return 'System';
}

function resolveColorScheme(
  preference: AppThemePreference,
  systemColorScheme: ColorSchemeName
): AppColorScheme {
  if (preference === 'dark' || preference === 'light') {
    return preference;
  }

  return systemColorScheme === 'dark' ? 'dark' : 'light';
}

function isAppThemePreference(value: string | null): value is AppThemePreference {
  return value === 'dark' || value === 'light' || value === 'system';
}
