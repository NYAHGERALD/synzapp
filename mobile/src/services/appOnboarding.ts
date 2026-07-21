import AsyncStorage from '@react-native-async-storage/async-storage';

const APP_ONBOARDING_COMPLETE_KEY = 'synzapp.appOnboardingComplete.v1';

export async function hasCompletedAppOnboarding(): Promise<boolean> {
  const value = await AsyncStorage.getItem(APP_ONBOARDING_COMPLETE_KEY);

  return value === 'true';
}

export async function markAppOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(APP_ONBOARDING_COMPLETE_KEY, 'true');
}
