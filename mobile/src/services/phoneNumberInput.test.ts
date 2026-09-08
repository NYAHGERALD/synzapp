import { describe, expect, it } from 'vitest';
import { getCountries } from 'libphonenumber-js';
import {
  acceptPhoneNumberInput,
  callingCodesLongestFirst,
  formatInternationalInput,
  maxNationalDigits,
  maxNationalDigitsForCallingCode,
  toE164
} from './phoneNumberInput';

/** Types a number one keystroke at a time, the way somebody actually does. */
function typeDigits(country: string, digits: string) {
  let entry = acceptPhoneNumberInput({ country, text: '' });

  for (const digit of digits) {
    entry = acceptPhoneNumberInput({ country: entry.country, text: `${entry.text}${digit}` });
  }

  return entry;
}

describe('the number of digits a country allows', () => {
  it('stops at the country maximum however long somebody keeps typing', () => {
    // The screenshot that started this: a US field took `(972) 917 14811111`.
    const entry = typeDigits('US', '97291714811111');

    expect(entry.nationalDigits).toBe('9729171481');
    expect(entry.text).toBe('972 917 1481');
  });

  it('uses each country’s own limit, not one number for everybody', () => {
    expect(maxNationalDigits('US')).toBe(10);
    expect(maxNationalDigits('FR')).toBe(9);
    expect(maxNationalDigits('GB')).toBe(10);
    expect(maxNationalDigits('DE')).toBe(15);
  });

  it('never lets a country exceed what E.164 allows in total', () => {
    for (const country of getCountries()) {
      expect(maxNationalDigits(country)).toBeGreaterThan(0);
      expect(maxNationalDigits(country)).toBeLessThanOrEqual(15);
    }
  });

  it('measures a country whose numbers start with its own trunk prefix', () => {
    // Judged in international form, so a leading digit is never mistaken for a
    // trunk prefix and stripped, which would report one digit short.
    expect(typeDigits('IT', '0212345678').nationalDigits).toBe('0212345678');
  });

  it('shortens what is already typed when the country changes', () => {
    const german = typeDigits('DE', '15112345678');

    expect(german.nationalDigits).toHaveLength(11);

    const french = acceptPhoneNumberInput({ country: 'FR', text: german.nationalDigits });

    expect(french.nationalDigits).toHaveLength(9);
  });

  it('keeps the leading digits of an over-long paste rather than refusing it', () => {
    const entry = acceptPhoneNumberInput({ country: 'FR', text: '612345678 ext 4021' });

    expect(entry.nationalDigits).toBe('612345678');
  });
});

describe('whether a number can be sent', () => {
  it('accepts a real number of the ordinary length', () => {
    // This is the bug in the screenshot. The rule it replaces asked for exactly
    // fourteen digits, so this correct number left the button greyed out.
    expect(typeDigits('US', '9729171481').isValid).toBe(true);
  });

  it('refuses one that is merely the right length', () => {
    expect(typeDigits('US', '0000000000').isValid).toBe(false);
  });

  it('refuses a half-typed number', () => {
    expect(typeDigits('US', '97291').isValid).toBe(false);
  });

  it('refuses nothing at all', () => {
    expect(acceptPhoneNumberInput({ country: 'US', text: '' }).isValid).toBe(false);
  });

  it('gives E.164 only for a number that is really valid', () => {
    expect(toE164({ country: 'US', nationalDigits: '9729171481' })).toBe('+19729171481');
    expect(toE164({ country: 'US', nationalDigits: '97291' })).toBeNull();
    expect(toE164({ country: 'US', nationalDigits: '' })).toBeNull();
  });
});

describe('grouping the digits', () => {
  it('groups the way each country writes its numbers', () => {
    expect(typeDigits('US', '9729171481').text).toBe('972 917 1481');
    expect(typeDigits('FR', '612345678').text).toBe('6 12 34 56 78');
    expect(typeDigits('GB', '7911123456').text).toBe('7911 123456');
  });

  it('never shows the calling code, which sits in the picker beside it', () => {
    for (const [country, digits] of [['US', '9729171481'], ['GB', '7911123456'], ['NG', '8031234567']]) {
      expect(typeDigits(country, digits).text.startsWith('+')).toBe(false);
    }
  });

  it('leaves nothing behind when the field is cleared', () => {
    expect(acceptPhoneNumberInput({ country: 'US', text: '' }).text).toBe('');
  });
});

describe('a number that carries its own country', () => {
  it('moves the picker to match a pasted international number', () => {
    const entry = acceptPhoneNumberInput({ country: 'US', text: '+44 7911 123456' });

    expect(entry.country).toBe('GB');
    expect(entry.nationalDigits).toBe('7911123456');
    expect(entry.isValid).toBe(true);
  });

  it('reads a 00 trunk the same way', () => {
    expect(acceptPhoneNumberInput({ country: 'US', text: '00447911123456' }).country).toBe('GB');
  });

  it('holds a half-typed calling code instead of guessing from one digit', () => {
    const entry = acceptPhoneNumberInput({ country: 'US', text: '+4' });

    expect(entry.country).toBe('US');
    expect(entry.text).toBe('+4');
  });

  it('leaves somebody where they are when they share the calling code', () => {
    // Jersey is +44 too. Choosing it and then typing +44 must not move them
    // to Great Britain.
    expect(acceptPhoneNumberInput({ country: 'JE', text: '+447911123456' }).country).toBe('JE');
  });

  it('picks the main country when the code is shared and none is chosen yet', () => {
    expect(acceptPhoneNumberInput({ country: 'FR', text: '+1 972 917 1481' }).country).toBe('US');
  });

  it('is not thrown by a country the reference has never heard of', () => {
    expect(acceptPhoneNumberInput({ country: 'ZZ', text: '9729171481' }).country).toBe('US');
  });
});

describe('the calling code a keypad has to work from', () => {
  it('orders codes longest first, so +1 cannot claim a +1264 number', () => {
    const codes = callingCodesLongestFirst();

    expect(codes.indexOf('1264')).toBeLessThan(codes.indexOf('1'));
  });

  it('allows the most generous country behind a shared code', () => {
    // Truncating is the worse failure: it makes a different, real number.
    expect(maxNationalDigitsForCallingCode('44')).toBe(maxNationalDigits('GB'));
    expect(maxNationalDigitsForCallingCode('7')).toBe(
      Math.max(maxNationalDigits('RU'), maxNationalDigits('KZ'))
    );
  });

  it('accepts a code written with or without its plus', () => {
    expect(maxNationalDigitsForCallingCode('+49')).toBe(maxNationalDigitsForCallingCode('49'));
  });

  it('no longer truncates the numbers the old table cut short', () => {
    // The table this replaced capped +49 at 11 and +81 at 10.
    expect(maxNationalDigitsForCallingCode('49')).toBeGreaterThan(11);
    expect(maxNationalDigitsForCallingCode('81')).toBeGreaterThan(10);
  });

  it('formats a whole international number for a field that holds the code', () => {
    expect(formatInternationalInput('+447911123456')).toBe('+44 7911 123456');
    expect(formatInternationalInput('')).toBe('');
    expect(formatInternationalInput('+')).toBe('+');
  });
});
