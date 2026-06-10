import { ACCESS_DENIED_MESSAGE } from './backendAuth';

interface FirebaseLikeError {
  code?: string;
  message?: string;
}

export function getUserAuthMessage(error: unknown, fallback = 'We could not complete sign-in. Please try again.'): string {
  if (__DEV__ && error instanceof Error) {
    console.warn('Phone sign-in failed:', error.message);
  }

  const authError = error as FirebaseLikeError;
  const code = authError?.code || '';
  const message = authError?.message || '';
  const combined = `${code} ${message}`.toLowerCase();

  if (/cancel/.test(combined)) {
    return 'Verification was cancelled.';
  }

  if (/invalid-phone-number/.test(combined)) {
    return 'Enter a valid phone number.';
  }

  if (/invalid-verification-code/.test(combined)) {
    return 'The code is incorrect. Please check it and try again.';
  }

  if (/code-expired|session-expired/.test(combined)) {
    return 'That code has expired. Please request a new one.';
  }

  if (/too-many-requests|blocked all requests|unusual activity|rate|429/.test(combined)) {
    return 'Too many attempts. Please wait before trying again.';
  }

  if (/quota|billing|blaze|sms.*not.*available|sms.*not.*enabled/.test(combined)) {
    return 'SMS verification is not available yet. Please contact support.';
  }

  if (/network|fetch|connection/.test(combined)) {
    return 'Network connection failed. Please check your connection and try again.';
  }

  if (/operation-not-allowed|phone.*provider|phone.*not.*enabled/.test(combined)) {
    return 'Phone sign-in is not enabled yet. Please contact support.';
  }

  if (/app verification|required|app-check|app-not-authorized|invalid-app-credential|missing-client-identifier|captcha|unauthorized-domain/.test(combined)) {
    return 'Secure phone verification could not be completed. Please contact support.';
  }

  if (/not active|deactivated|suspended|archived|deleted|access denied|contact/i.test(message)) {
    return ACCESS_DENIED_MESSAGE;
  }

  if (/not approved for employee access/i.test(message)) {
    return 'This phone number is not approved for employee access. Please contact your company administrator.';
  }

  if (/already linked to an organization/i.test(message)) {
    return message;
  }

  if (/company profile|company name|profile photo|employee profile|first name|last name|needs review/i.test(message)) {
    return message;
  }

  return fallback;
}
