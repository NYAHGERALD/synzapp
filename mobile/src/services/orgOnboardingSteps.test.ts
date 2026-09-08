import { describe, expect, it } from 'vitest';
import {
  EMPTY_ORG_ONBOARDING_DRAFT,
  ORG_ONBOARDING_STEPS,
  composeCompanyAddress,
  validateOrgOnboardingStep
} from './orgOnboardingSteps';
import type { OrgOnboardingDraft } from './orgOnboardingSteps';

function draft(overrides: Partial<OrgOnboardingDraft> = {}): OrgOnboardingDraft {
  return { ...EMPTY_ORG_ONBOARDING_DRAFT, ...overrides };
}

describe('validateOrgOnboardingStep', () => {
  it('asks for both names', () => {
    expect(validateOrgOnboardingStep(0, draft())).toMatch(/first name/i);
    expect(validateOrgOnboardingStep(0, draft({ adminFirstName: 'Gerald' }))).toMatch(/last name/i);
    expect(
      validateOrgOnboardingStep(0, draft({ adminFirstName: 'Gerald', adminLastName: 'Nyah' }))
    ).toBeNull();
  });

  it('asks for a company name and a company email that looks like one', () => {
    expect(validateOrgOnboardingStep(1, draft())).toMatch(/company name/i);
    expect(validateOrgOnboardingStep(1, draft({ companyName: 'Don Miguel' }))).toMatch(/email/i);
    expect(
      validateOrgOnboardingStep(1, draft({ companyEmail: 'nope', companyName: 'Don Miguel' }))
    ).toMatch(/does not look right/i);
    expect(
      validateOrgOnboardingStep(1, draft({ companyEmail: 'hello@donmiguel.com', companyName: 'Don Miguel' }))
    ).toBeNull();
  });

  it('checks the postal code against the country that was chosen', () => {
    const usAddress = { addressLine1: '11600 Audelia Road', city: 'Dallas' };

    expect(
      validateOrgOnboardingStep(2, draft({ ...usAddress, countryCode: 'US', postalCode: 'K1A 0B1' }))
    ).toMatch(/ZIP/);
    expect(
      validateOrgOnboardingStep(2, draft({ ...usAddress, countryCode: 'US', postalCode: '75243' }))
    ).toBeNull();
    expect(
      validateOrgOnboardingStep(2, draft({ ...usAddress, countryCode: 'CA', postalCode: 'K1A 0B1' }))
    ).toBeNull();
  });

  it('asks for the street, the city and the code before moving on', () => {
    expect(validateOrgOnboardingStep(2, draft())).toMatch(/street/i);
    expect(validateOrgOnboardingStep(2, draft({ addressLine1: '11600 Audelia Road' }))).toMatch(/city/i);
    expect(
      validateOrgOnboardingStep(2, draft({ addressLine1: '11600 Audelia Road', city: 'Dallas' }))
    ).toMatch(/postal code/i);
  });

  it('needs the year start before the company can be created', () => {
    expect(validateOrgOnboardingStep(3, draft())).toMatch(/work year/i);
    expect(validateOrgOnboardingStep(3, draft({ calendarYearStartDate: '2025-10-27' }))).toBeNull();
  });

  it('speaks plainly on every step', () => {
    // The whole point of the rewrite. "Tenant" is our word, not the customer's.
    const wording = ORG_ONBOARDING_STEPS.map((step) => `${step.title} ${step.subtitle}`).join(' ');

    expect(wording).not.toMatch(/tenant/i);
    expect(wording).not.toMatch(/—/);
  });
});

describe('composeCompanyAddress', () => {
  it('writes a US address the way a US address is written', () => {
    expect(
      composeCompanyAddress(
        draft({
          addressLine1: '11600 Audelia Road',
          addressLine2: 'Suite 154',
          city: 'Dallas',
          countryCode: 'US',
          postalCode: '75243',
          region: 'Texas'
        })
      )
    ).toBe('11600 Audelia Road, Suite 154, Dallas, Texas 75243, United States');
  });

  it('leaves out the parts nobody filled in', () => {
    expect(composeCompanyAddress(draft({ city: 'Toronto', countryCode: 'CA' }))).toBe(
      'Toronto, Canada'
    );
  });
});
