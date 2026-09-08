import { formatPostalAddress, validatePostalCode } from './addressFormats';

/**
 * Setting up a company, a few questions at a time.
 *
 * This was one screen holding a company name, a single free-text address line,
 * two name fields and a date. Asked all at once it reads as paperwork, and the
 * address arrived as one line of text that nothing could act on afterwards.
 *
 * The order follows what somebody can answer without looking anything up: who
 * they are, then their company, then where it is, then the one setting that
 * needs a decision.
 */

export interface OrgOnboardingDraft {
  addressLine1: string;
  addressLine2: string;
  adminFirstName: string;
  adminLastName: string;
  calendarYearStartDate: string | null;
  city: string;
  companyEmail: string;
  companyName: string;
  countryCode: string;
  postalCode: string;
  region: string;
}

export interface OrgOnboardingStep {
  key: 'you' | 'company' | 'address' | 'year';
  /** Plain words. Nobody setting up an account should have to decode a label. */
  subtitle: string;
  title: string;
}

export const ORG_ONBOARDING_STEPS: OrgOnboardingStep[] = [
  {
    key: 'you',
    subtitle: 'This is the name your team will see next to your messages.',
    title: 'What is your name?'
  },
  {
    key: 'company',
    subtitle: 'The name your staff will recognise, and an email we can reach the company on.',
    title: 'What is your company called?'
  },
  {
    key: 'address',
    subtitle: 'Where the company is based. Pick your country first so the boxes match how you write an address.',
    title: 'Where is your company?'
  },
  {
    key: 'year',
    subtitle: 'Week 1 starts on this date. Standard work weeks are counted from it.',
    title: 'When does your work year start?'
  }
];

export const EMPTY_ORG_ONBOARDING_DRAFT: OrgOnboardingDraft = {
  addressLine1: '',
  addressLine2: '',
  adminFirstName: '',
  adminLastName: '',
  calendarYearStartDate: null,
  city: '',
  companyEmail: '',
  companyName: '',
  countryCode: 'US',
  postalCode: '',
  region: ''
};

/**
 * What is missing from this step, said the way a person would say it.
 *
 * Returns null when the step is complete enough to move on from.
 */
export function validateOrgOnboardingStep(
  stepIndex: number,
  draft: OrgOnboardingDraft
): string | null {
  const step = ORG_ONBOARDING_STEPS[stepIndex];

  if (!step) {
    return null;
  }

  if (step.key === 'you') {
    if (draft.adminFirstName.trim().length < 2) {
      return 'Please enter your first name.';
    }

    return draft.adminLastName.trim().length < 2 ? 'Please enter your last name.' : null;
  }

  if (step.key === 'company') {
    if (draft.companyName.trim().length < 2) {
      return 'Please enter your company name.';
    }

    if (!draft.companyEmail.trim()) {
      return 'Please enter a company email address.';
    }

    // Deliberately loose. A stricter pattern rejects real addresses, and the
    // cost of a wrong rejection here is somebody unable to finish signing up.
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.companyEmail.trim())
      ? null
      : 'That email address does not look right. Please check it.';
  }

  if (step.key === 'address') {
    if (!draft.addressLine1.trim()) {
      return 'Please enter the street address.';
    }

    if (!draft.city.trim()) {
      return 'Please enter the city.';
    }

    if (!draft.postalCode.trim()) {
      return 'Please enter the postal code.';
    }

    return validatePostalCode(draft.countryCode, draft.postalCode);
  }

  return draft.calendarYearStartDate ? null : 'Please choose the date your work year starts.';
}

/**
 * The address as one line, for everything that already reads it that way.
 *
 * The parts are stored too. This is the readable version, not the record.
 */
export function composeCompanyAddress(draft: OrgOnboardingDraft): string {
  return formatPostalAddress({
    city: draft.city,
    countryCode: draft.countryCode,
    line1: draft.addressLine1,
    line2: draft.addressLine2,
    postalCode: draft.postalCode,
    region: draft.region
  }).join(', ');
}
