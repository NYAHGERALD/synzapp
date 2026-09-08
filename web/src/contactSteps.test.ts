import { describe, expect, it } from 'vitest';
import { CONTACT_STEPS, getContactProgress, validateContactStep } from './contactSteps';
import type { ContactFormValues } from './contactSteps';

function values(overrides: Partial<ContactFormValues> = {}): ContactFormValues {
  return {
    addressLine1: '',
    addressLine2: '',
    city: '',
    countryCode: 'US',
    email: '',
    message: '',
    name: '',
    organizationName: '',
    phone: '',
    postalCode: '',
    region: '',
    subject: '',
    ...overrides
  };
}

describe('validateContactStep', () => {
  it('will not move on without an email address', () => {
    expect(validateContactStep(0, values())).toMatch(/email/i);
    expect(validateContactStep(0, values({ email: 'not-an-email' }))).toMatch(/does not look right/i);
    expect(validateContactStep(0, values({ email: 'someone@company.com' }))).toBeNull();
  });

  it('asks for a name, but not for an organization', () => {
    expect(validateContactStep(1, values())).toMatch(/name/i);
    expect(validateContactStep(1, values({ name: 'Gerald Nyah' }))).toBeNull();
  });

  it('lets somebody past the address step without giving one', () => {
    // An address is useful. Refusing the enquiry without one turns away the
    // enquiry we wanted.
    expect(validateContactStep(2, values())).toBeNull();
  });

  it('still checks a postal code that was given', () => {
    expect(validateContactStep(2, values({ countryCode: 'US', postalCode: 'SW1A 1AA' }))).toMatch(/ZIP/);
    expect(validateContactStep(2, values({ countryCode: 'US', postalCode: '94105' }))).toBeNull();
    expect(validateContactStep(2, values({ countryCode: 'GB', postalCode: 'SW1A 1AA' }))).toBeNull();
  });

  it('needs both a subject and a message on the last step', () => {
    expect(validateContactStep(3, values())).toMatch(/subject/i);
    expect(validateContactStep(3, values({ subject: 'Pricing' }))).toMatch(/what you need/i);
    expect(validateContactStep(3, values({ message: 'How much?', subject: 'Pricing' }))).toBeNull();
  });
});

describe('getContactProgress', () => {
  it('fills a quarter at a time and reaches full on the last step', () => {
    expect(getContactProgress(0)).toBeCloseTo(0.25);
    expect(getContactProgress(3)).toBe(1);
  });

  it('does not run past the end or before the start', () => {
    expect(getContactProgress(-4)).toBeCloseTo(0.25);
    expect(getContactProgress(99)).toBe(1);
  });

  it('has a label for the button on every step', () => {
    expect(CONTACT_STEPS.every((step) => step.nextLabel.length > 0)).toBe(true);
    expect(CONTACT_STEPS[CONTACT_STEPS.length - 1].nextLabel).toBe('Send message');
  });
});
