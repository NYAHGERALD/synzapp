import {
  AsYouType,
  getCountryCallingCode,
  isSupportedCountry,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
  type CountryCode
} from 'libphonenumber-js';
import metadata from 'libphonenumber-js/metadata.min.json';

/**
 * What a phone field accepts, decided by the country rather than by us.
 *
 * Every rule here — how many digits a country's numbers have, how they are
 * grouped, whether one is real — comes from **libphonenumber**, Google's
 * reference implementation of the ITU numbering plans. It is the same data
 * WhatsApp, Stripe and Twilio validate against, and it is revised as countries
 * actually change their numbering.
 *
 * Two hand-maintained versions of this shipped before it, and both were wrong
 * in the way hand-maintained numbering tables always end up wrong:
 *
 * - The sign-in field capped every country at fourteen digits, so a ten digit
 *   American number was rejected while `(972) 917 14811111` was accepted.
 * - The invite keypad carried a table of maximum lengths per calling code that
 *   disagreed with the reference in **69 of its 166 entries**, and had no entry
 *   at all for forty more. Nearly all of them were too short, so the number was
 *   silently truncated: a German mobile was cut at eleven digits when fifteen
 *   are legal, and the invite went to a number nobody owns.
 *
 * There is no table in this file, and there must never be one. A number that is
 * too long is not shortened by guesswork, and a country's grouping is not
 * invented — either the reference knows it or the digits stand unformatted.
 *
 * No React Native import, so all of it is testable. See the house rule about
 * pure logic in mobile/CLAUDE.md.
 */

/**
 * Every country sharing a calling code, **the main one first**.
 *
 * `+44` is Great Britain, Guernsey, the Isle of Man and Jersey; `+1` is
 * twenty-five countries. Somebody typing `+44` has not yet said which, so the
 * main one is assumed until the rest of the number settles it.
 */
const COUNTRIES_BY_CALLING_CODE = (
  metadata as unknown as { country_calling_codes: Record<string, string[]> }
).country_calling_codes;

/** Used only when a caller passes a country the reference does not know. */
const FALLBACK_COUNTRY: CountryCode = 'US';

export interface PhoneNumberEntry {
  /** ISO 3166-1 alpha-2. Changes when a full international number is entered. */
  country: CountryCode;
  /** No calling code and no punctuation. This is what gets sent. */
  nationalDigits: string;
  /** Grouped the way that country writes it, for the field to show. */
  text: string;
  /** A real, dialable number there — not merely a plausible length. */
  isValid: boolean;
}

/**
 * One keystroke or one paste, turned into what the field should now hold.
 *
 * The country decides the limit, so nothing past its longest legal number can
 * be typed at all. That is the whole point: a field that accepts a digit it
 * will later reject has already wasted the person's time.
 */
export function acceptPhoneNumberInput(input: {
  country: string;
  text: string;
}): PhoneNumberEntry {
  const country = toSupportedCountry(input.country) || FALLBACK_COUNTRY;
  const raw = input.text.trim();
  const digits = raw.replace(/\D/g, '');

  // A leading + or a 00 trunk means they are giving the country themselves,
  // usually by pasting. Believe them over the picker.
  if (raw.startsWith('+')) {
    return readInternationalDigits(digits, country);
  }

  if (digits.startsWith('00') && digits.length > 2) {
    return readInternationalDigits(digits.slice(2), country);
  }

  return buildEntry(country, digits);
}

/**
 * The longest a country's national number can be.
 *
 * Exposed for a field's `maxLength`, which stops the keyboard offering a
 * keystroke that would be thrown away. The value is measured from the reference
 * rather than stored, then remembered per country because the field asks on
 * every render.
 */
export function maxNationalDigits(country: string): number {
  const supported = toSupportedCountry(country);

  if (!supported) {
    // E.164 allows fifteen digits including the calling code, and nothing else
    // is known about a country the reference has never heard of.
    return 15;
  }

  const remembered = maximumDigitsByCountry.get(supported);

  if (remembered !== undefined) {
    return remembered;
  }

  let digits = '';

  // Possible lengths are a bounded set, so "too long" only ever starts being
  // true and never stops. Nine rather than zero: a leading zero is a national
  // trunk prefix in much of the world and gets stripped before the length is
  // judged, which reads as one digit more than a country really allows.
  while (digits.length < E164_MAX_DIGITS && !isTooLong(`${digits}9`, supported)) {
    digits += '9';
  }

  maximumDigitsByCountry.set(supported, digits.length);

  return digits.length;
}

/**
 * The longest national number behind a calling code.
 *
 * For fields that know only `+44` and not which of Great Britain, Guernsey, the
 * Isle of Man or Jersey is meant. It answers with the most generous of them,
 * because a shared code cannot rule out the country that allows more, and
 * cutting a number short is the worse failure: it produces a different number
 * that belongs to somebody else, silently.
 */
export function maxNationalDigitsForCallingCode(callingCode: string): number {
  const countries = COUNTRIES_BY_CALLING_CODE[callingCode.replace(/^\+/, '')];

  if (!countries?.length) {
    return Math.max(1, E164_MAX_DIGITS - callingCode.replace(/^\+/, '').length);
  }

  return Math.max(...countries.map((country) => maxNationalDigits(country)));
}

/** Every calling code in use, longest first so `+1` cannot claim a `+1264`. */
export function callingCodesLongestFirst(): string[] {
  return Object.keys(COUNTRIES_BY_CALLING_CODE).sort((first, second) => second.length - first.length);
}

/**
 * The number in the form everything downstream wants.
 *
 * Null unless it is genuinely valid, because E.164 is what gets sent to
 * Firebase and to the invite endpoint, and a malformed one there fails far from
 * the field that produced it.
 */
export function toE164(input: { country: string; nationalDigits: string }): string | null {
  const country = toSupportedCountry(input.country);

  if (!country || !input.nationalDigits) {
    return null;
  }

  const parsed = parsePhoneNumberFromString(input.nationalDigits, country);

  return parsed?.isValid() ? parsed.number : null;
}

/**
 * A whole international number, grouped as it is typed.
 *
 * For fields that hold the calling code themselves rather than beside them in a
 * picker, such as the invite keypad.
 */
export function formatInternationalInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');

  if (!digits) {
    return raw.trim().startsWith('+') ? '+' : '';
  }

  const entry = acceptPhoneNumberInput({ country: FALLBACK_COUNTRY, text: `+${digits}` });
  const callingCode = getCountryCallingCode(entry.country);

  if (!entry.nationalDigits) {
    return `+${digits}`;
  }

  return `+${callingCode} ${entry.text}`.trimEnd();
}

/** E.164 allows no more than fifteen digits in total, calling code included. */
const E164_MAX_DIGITS = 15;

const maximumDigitsByCountry = new Map<CountryCode, number>();

function toSupportedCountry(country: string): CountryCode | null {
  const upper = country.trim().toUpperCase();

  return isSupportedCountry(upper) ? (upper as CountryCode) : null;
}

/**
 * Digits that begin with a calling code.
 *
 * While it is still short — `+4` names no country — what was typed is kept
 * as-is so the next keystroke can finish it. Deciding early would pick a
 * country from one digit and then refuse the digits that would have corrected
 * it.
 */
function readInternationalDigits(digits: string, current: CountryCode): PhoneNumberEntry {
  const formatter = new AsYouType();

  formatter.input(`+${digits}`);

  const callingCode = formatter.getCallingCode();

  if (!callingCode) {
    return { country: current, nationalDigits: '', text: `+${digits}`, isValid: false };
  }

  return buildEntry(
    resolveCountryForCallingCode(String(callingCode), current),
    digits.slice(String(callingCode).length)
  );
}

/**
 * Which country a calling code means.
 *
 * The one already chosen wins when it shares the code, so somebody on Jersey
 * typing `+44` is not quietly moved to Great Britain. Otherwise the main
 * country for that code, which is what the reference lists first.
 */
function resolveCountryForCallingCode(callingCode: string, current: CountryCode): CountryCode {
  if (getCountryCallingCode(current) === callingCode) {
    return current;
  }

  const [main] = COUNTRIES_BY_CALLING_CODE[callingCode] || [];

  return toSupportedCountry(main || '') || current;
}

function buildEntry(country: CountryCode, digits: string): PhoneNumberEntry {
  const nationalDigits = capToCountryLength(digits, country);

  return {
    country,
    nationalDigits,
    text: formatNationalDigits(nationalDigits, country),
    isValid: nationalDigits.length > 0 && isValidPhoneNumber(nationalDigits, country)
  };
}

/**
 * Drops whatever will not fit in that country's numbering plan.
 *
 * Trimming from the end rather than refusing the whole entry, so a pasted
 * number with a stray extension still leaves a usable number in the field.
 */
function capToCountryLength(digits: string, country: CountryCode): string {
  let capped = digits;

  while (capped.length > 0 && isTooLong(capped, country)) {
    capped = capped.slice(0, -1);
  }

  return capped;
}

/**
 * Judged in international form on purpose.
 *
 * Given a bare national string the reference first strips anything that looks
 * like a national trunk prefix, so a number starting with one is measured a
 * digit short and the field stops accepting input too early.
 */
function isTooLong(digits: string, country: CountryCode): boolean {
  return validatePhoneNumberLength(`+${getCountryCallingCode(country)}${digits}`) === 'TOO_LONG';
}

/**
 * Grouped the way the country writes it.
 *
 * Formatted internationally and then stripped of the calling code, rather than
 * formatted nationally. Most countries' national format is written around a
 * trunk prefix — a British number is `07911 123456`, not `7911 123456` — so
 * asking for the national form of a number typed without one returns it
 * unformatted. The international form has no such gap, and the calling code is
 * already shown in the picker beside the field.
 */
function formatNationalDigits(digits: string, country: CountryCode): string {
  if (!digits) {
    return '';
  }

  const prefix = `+${getCountryCallingCode(country)}`;
  const international = new AsYouType().input(`${prefix}${digits}`);

  // Unformatted digits rather than a half-applied pattern, on the rare
  // partial the reference has no grouping for.
  return international.startsWith(prefix) ? international.slice(prefix.length).trim() : digits;
}
