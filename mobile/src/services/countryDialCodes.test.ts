import { describe, expect, it } from 'vitest';
import {
  COUNTRY_DIAL_CODES,
  flagForCountry,
  searchCountries
} from './countryDialCodes';

describe('the country list', () => {
  it('covers the world rather than four countries', () => {
    // Four shipped, which meant anybody outside them could not sign in at all.
    expect(COUNTRY_DIAL_CODES.length).toBeGreaterThan(200);
  });

  it('has no duplicate country codes', () => {
    const codes = COUNTRY_DIAL_CODES.map((country) => country.code);

    expect(new Set(codes).size).toBe(codes.length);
  });

  it('gives every entry a usable dialling code', () => {
    for (const country of COUNTRY_DIAL_CODES) {
      expect(country.dialCode).toMatch(/^\+\d{1,4}$/);
      expect(country.name.length).toBeGreaterThan(1);
      expect(country.code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('is sorted by name, the way somebody reads down it', () => {
    const names = COUNTRY_DIAL_CODES.map((country) => country.name);

    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });

  it('keeps the countries that already worked', () => {
    for (const code of ['US', 'CA', 'MX', 'GB']) {
      expect(COUNTRY_DIAL_CODES.some((country) => country.code === code)).toBe(true);
    }
  });

  it('includes places that share a dialling code', () => {
    // +1 is not only the United States, and a list that assumes it is will send
    // somebody in Jamaica to the wrong country.
    const plusOne = COUNTRY_DIAL_CODES.filter((country) => country.dialCode === '+1');

    expect(plusOne.length).toBeGreaterThan(5);
  });
});

describe('the flag beside a country', () => {
  it('is derived from the code, so it cannot fall out of step', () => {
    expect(flagForCountry('US')).toBe('🇺🇸');
    expect(flagForCountry('GB')).toBe('🇬🇧');
    expect(flagForCountry('JP')).toBe('🇯🇵');
  });

  it('copes with lower case', () => {
    expect(flagForCountry('de')).toBe(flagForCountry('DE'));
  });

  it('shows nothing rather than mojibake for a bad code', () => {
    expect(flagForCountry('')).toBe('');
    expect(flagForCountry('USA')).toBe('');
    expect(flagForCountry('1')).toBe('');
  });

  it('produces one for every country in the list', () => {
    for (const country of COUNTRY_DIAL_CODES) {
      expect(flagForCountry(country.code)).not.toBe('');
    }
  });
});

describe('searching for a country', () => {
  it('returns everything when nothing is typed', () => {
    expect(searchCountries('  ')).toHaveLength(COUNTRY_DIAL_CODES.length);
  });

  it('finds by part of the name', () => {
    expect(searchCountries('king').some((c) => c.code === 'GB')).toBe(true);
  });

  it('finds by dialling code, with or without the plus', () => {
    // Somebody typing "44" is looking for the United Kingdom just as much as
    // somebody typing "unit".
    expect(searchCountries('44').some((c) => c.code === 'GB')).toBe(true);
    expect(searchCountries('+44').some((c) => c.code === 'GB')).toBe(true);
  });

  it('finds by ISO code', () => {
    expect(searchCountries('jp').some((c) => c.code === 'JP')).toBe(true);
  });

  it('returns nothing for a query that matches nothing', () => {
    expect(searchCountries('zzzzzz')).toHaveLength(0);
  });
});
