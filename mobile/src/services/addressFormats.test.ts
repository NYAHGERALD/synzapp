import { describe, expect, it } from 'vitest';
import {
  SUPPORTED_COUNTRIES,
  formatPostalAddress,
  formatPostalCode,
  getCountryFormat,
  validatePostalCode
} from './addressFormats';

describe('each country is asked for its own address', () => {
  it('uses the words each country uses', () => {
    // Asking a British visitor for their "State" and "ZIP code" tells them the
    // form was written for somebody else.
    expect(getCountryFormat('US').regionLabel).toBe('State');
    expect(getCountryFormat('US').postalLabel).toBe('ZIP code');
    expect(getCountryFormat('CA').regionLabel).toBe('Province or territory');
    expect(getCountryFormat('CA').postalLabel).toBe('Postal code');
    expect(getCountryFormat('GB').postalLabel).toBe('Postcode');
    expect(getCountryFormat('MX').postalLabel).toBe('Código postal');
  });

  it('offers a list where the country has one, free text where it does not', () => {
    expect(getCountryFormat('US').regionOptions.length).toBe(51);
    expect(getCountryFormat('CA').regionOptions.length).toBe(13);
    expect(getCountryFormat('MX').regionOptions.length).toBe(32);
    // UK counties are optional and often omitted; a list would be a search
    // through entries most people would not use.
    expect(getCountryFormat('GB').regionOptions).toEqual([]);
    expect(getCountryFormat('GB').regionRequired).toBe(false);
  });

  it('carries the right dialling code', () => {
    expect(getCountryFormat('US').dialCode).toBe('+1');
    expect(getCountryFormat('CA').dialCode).toBe('+1');
    expect(getCountryFormat('MX').dialCode).toBe('+52');
    expect(getCountryFormat('GB').dialCode).toBe('+44');
  });

  it('keeps an unknown country as itself rather than treating it as American', () => {
    // It used to return the US format for every code it did not recognise,
    // which asked somebody in Lagos for a State and a ZIP code.
    const unknown = getCountryFormat('ZZ');

    expect(unknown.code).toBe('ZZ');
    expect(unknown.regionOptions).toEqual([]);
    expect(unknown.postalRequired).toBe(false);
  });

  it('offers exactly the four countries asked for', () => {
    expect(SUPPORTED_COUNTRIES.map((country) => country.code)).toEqual(['US', 'CA', 'MX', 'GB']);
  });
});

describe('postal codes are checked against the country', () => {
  it('accepts real codes', () => {
    expect(validatePostalCode('US', '94105')).toBeNull();
    expect(validatePostalCode('US', '94105-1234')).toBeNull();
    expect(validatePostalCode('CA', 'K1A 0B1')).toBeNull();
    expect(validatePostalCode('CA', 'k1a0b1')).toBeNull();
    expect(validatePostalCode('MX', '06600')).toBeNull();
    expect(validatePostalCode('GB', 'SW1A 1AA')).toBeNull();
    expect(validatePostalCode('GB', 'M1 1AE')).toBeNull();
  });

  it('rejects a code from the wrong country', () => {
    expect(validatePostalCode('US', 'SW1A 1AA')).toMatch(/ZIP code/);
    expect(validatePostalCode('CA', '94105')).toMatch(/Postal code/);
  });

  it('says what shape is expected, not just "invalid"', () => {
    // "That is not valid" helps nobody. The person needs the shape.
    expect(validatePostalCode('CA', 'nonsense')).toMatch(/K1A 0B1/);
    expect(validatePostalCode('US', 'nonsense')).toMatch(/94105/);
  });

  it('asks for one when the country expects it', () => {
    // "ZIP" keeps its capitals — it is an acronym.
    expect(validatePostalCode('US', '')).toBe('Enter a ZIP code.');
  });
});

describe('postal codes are tidied to how each country writes them', () => {
  it('adds the space Canadians write', () => {
    expect(formatPostalCode('CA', 'k1a0b1')).toBe('K1A 0B1');
  });

  it('adds the space in a UK postcode', () => {
    expect(formatPostalCode('GB', 'sw1a1aa')).toBe('SW1A 1AA');
    expect(formatPostalCode('GB', 'm11ae')).toBe('M1 1AE');
  });

  it('leaves US and Mexican codes alone', () => {
    expect(formatPostalCode('US', '94105')).toBe('94105');
    expect(formatPostalCode('MX', '06600')).toBe('06600');
  });
});

describe('formatPostalAddress', () => {
  it('returns nothing when there is no address', () => {
    expect(formatPostalAddress(null)).toEqual([]);
  });

  it('writes a US address with city, state and ZIP on one line', () => {
    expect(
      formatPostalAddress({
        city: 'San Francisco',
        countryCode: 'US',
        line1: '1 Market Street',
        postalCode: '94105',
        region: 'California'
      })
    ).toEqual(['1 Market Street', 'San Francisco, California 94105', 'United States']);
  });

  it('keeps a UK postcode on its own line', () => {
    expect(
      formatPostalAddress({
        city: 'London',
        countryCode: 'GB',
        line1: '10 Downing Street',
        postalCode: 'SW1A 2AA'
      })
    ).toEqual(['10 Downing Street', 'London', 'SW1A 2AA', 'United Kingdom']);
  });

  it('puts the Mexican postal code before the city', () => {
    expect(
      formatPostalAddress({
        city: 'Ciudad de México',
        countryCode: 'MX',
        line1: 'Paseo de la Reforma 100',
        postalCode: '06600',
        region: 'Ciudad de México'
      })
    ).toEqual([
      'Paseo de la Reforma 100',
      '06600 Ciudad de México',
      'Ciudad de México',
      'Mexico'
    ]);
  });

  it('drops the pieces that were left blank', () => {
    expect(formatPostalAddress({ city: 'Toronto', countryCode: 'CA' })).toEqual([
      'Toronto',
      'Canada'
    ]);
  });
});

describe('countries we have not written rules for', () => {
  it('names them properly rather than falling back to the United States', () => {
    // Before, every unknown code silently became the US format, so somebody in
    // Nigeria was asked for a State and a ZIP code.
    expect(getCountryFormat('NG').label).toBe('Nigeria');
    expect(getCountryFormat('IN').label).toBe('India');
    expect(getCountryFormat('DE').label).toBe('Germany');
  });

  it('does not demand a postal code from a country that may not use one', () => {
    expect(getCountryFormat('AE').postalRequired).toBe(false);
    expect(validatePostalCode('AE', '')).toBeNull();
  });

  it('accepts whatever postal code they type', () => {
    expect(validatePostalCode('NG', '100001')).toBeNull();
    expect(validatePostalCode('IN', '110001')).toBeNull();
    expect(validatePostalCode('JP', '100-0001')).toBeNull();
  });

  it('still checks the four countries we do know', () => {
    expect(validatePostalCode('US', 'ABCDE')).toMatch(/ZIP/);
    expect(validatePostalCode('CA', '12345')).toMatch(/Postal code/);
  });

  it('leaves an unknown country code as typed instead of forcing capitals', () => {
    expect(formatPostalCode('NG', ' 100001 ')).toBe('100001');
    expect(formatPostalCode('CA', 'k1a0b1')).toBe('K1A 0B1');
  });
});
