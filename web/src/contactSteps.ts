import { validatePostalCode } from './addressFormats';

/**
 * The contact form, asked a few questions at a time.
 *
 * One long form of eleven fields reads as paperwork and gets abandoned. The
 * same eleven fields, four questions at a time, reads as a conversation.
 *
 * The order matters: the email address comes first on its own, because it is
 * the one thing that makes an enquiry answerable. If somebody stops after that
 * step we have nothing yet, but if they stop after the last one we have
 * everything, so the most valuable answer is never the one left until the end.
 */

export interface ContactFormValues {
  addressLine1: string;
  addressLine2: string;
  city: string;
  countryCode: string;
  email: string;
  message: string;
  name: string;
  organizationName: string;
  phone: string;
  postalCode: string;
  region: string;
  subject: string;
}

export interface ContactStep {
  key: 'email' | 'about' | 'address' | 'message';
  /** The button that moves on from this step. */
  nextLabel: string;
  title: string;
}

export const CONTACT_STEPS: ContactStep[] = [
  { key: 'email', nextLabel: 'Next', title: 'What is your work email?' },
  { key: 'about', nextLabel: 'Next', title: 'Tell us a bit about yourself' },
  { key: 'address', nextLabel: 'Next', title: 'Where are you based?' },
  { key: 'message', nextLabel: 'Send message', title: 'How can we help?' }
];

/**
 * What is wrong with this step, if anything.
 *
 * Returns the message to show, or null when the step is complete enough to
 * move on from. Only the answers that make an enquiry answerable are required:
 * an address is useful, but refusing to accept a question without one turns
 * away the enquiry we wanted.
 */
export function validateContactStep(
  stepIndex: number,
  values: ContactFormValues
): string | null {
  const step = CONTACT_STEPS[stepIndex];

  if (!step) {
    return null;
  }

  if (step.key === 'email') {
    if (!values.email.trim()) {
      return 'Please give us an email address so we can reply.';
    }

    // Deliberately loose. A stricter pattern rejects real addresses, and the
    // cost of a wrong rejection here is an enquiry that never reaches anybody.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      return 'That email address does not look right. Please check it.';
    }

    return null;
  }

  if (step.key === 'about') {
    return values.name.trim() ? null : 'Please tell us your name.';
  }

  if (step.key === 'address') {
    return values.postalCode.trim()
      ? validatePostalCode(values.countryCode, values.postalCode)
      : null;
  }

  if (!values.subject.trim()) {
    return 'Please give your message a subject.';
  }

  return values.message.trim() ? null : 'Please tell us what you need.';
}

/** How far along the form is, as a fraction, for the bar across the top. */
export function getContactProgress(stepIndex: number): number {
  const clamped = Math.min(Math.max(stepIndex, 0), CONTACT_STEPS.length - 1);

  return (clamped + 1) / CONTACT_STEPS.length;
}
