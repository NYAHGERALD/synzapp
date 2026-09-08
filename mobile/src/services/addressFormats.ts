/**
 * Address formats, by country.
 *
 * Four countries, four different sets of words and rules. Asking a British
 * visitor for their "State" and "ZIP code" tells them the form was written for
 * somebody else — a small thing that costs credibility on the first page an
 * enterprise buyer fills in.
 *
 * Kept free of markup so the rules can be tested on their own.
 */

/**
 * Country address formats, shared in intent with the website's copy of this
 * file. Kept separate because the two build separately: the phone cannot import
 * from the web bundle, and a single copy behind a package is a bigger change
 * than this needs. If one changes, change both.
 */
import { getCountryLabel } from './countries';

export type SupportedCountryCode = 'US' | 'CA' | 'MX' | 'GB';

export interface CountryAddressFormat {
  code: SupportedCountryCode;
  /** International dialling prefix, shown beside the phone field. */
  dialCode: string;
  label: string;
  /** What a postal code is called here. */
  postalLabel: string;
  postalPlaceholder: string;
  /** Whether a postal code is expected at all. */
  postalRequired: boolean;
  /** What the region line is called here. */
  regionLabel: string;
  /** Fixed choices where the country has them, empty where it is free text. */
  regionOptions: string[];
  regionRequired: boolean;
}

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
  'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah',
  'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];

const CANADIAN_PROVINCES = [
  'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador',
  'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec',
  'Saskatchewan', 'Yukon'
];

const MEXICAN_STATES = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua',
  'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero',
  'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla',
  'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas',
  'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas'
];

export const COUNTRY_ADDRESS_FORMATS: Record<SupportedCountryCode, CountryAddressFormat> = {
  CA: {
    code: 'CA',
    dialCode: '+1',
    label: 'Canada',
    postalLabel: 'Postal code',
    postalPlaceholder: 'K1A 0B1',
    postalRequired: true,
    regionLabel: 'Province or territory',
    regionOptions: CANADIAN_PROVINCES,
    regionRequired: true
  },
  GB: {
    code: 'GB',
    dialCode: '+44',
    label: 'United Kingdom',
    postalLabel: 'Postcode',
    postalPlaceholder: 'SW1A 1AA',
    postalRequired: true,
    // Counties are optional in UK addresses and often omitted entirely, so this
    // is free text rather than a list somebody has to search for their entry in.
    regionLabel: 'County (optional)',
    regionOptions: [],
    regionRequired: false
  },
  MX: {
    code: 'MX',
    dialCode: '+52',
    label: 'Mexico',
    postalLabel: 'Código postal',
    postalPlaceholder: '06600',
    postalRequired: true,
    regionLabel: 'State',
    regionOptions: MEXICAN_STATES,
    regionRequired: true
  },
  US: {
    code: 'US',
    dialCode: '+1',
    label: 'United States',
    postalLabel: 'ZIP code',
    postalPlaceholder: '94105',
    postalRequired: true,
    regionLabel: 'State',
    regionOptions: US_STATES,
    regionRequired: true
  }
};

export const SUPPORTED_COUNTRIES: CountryAddressFormat[] = [
  COUNTRY_ADDRESS_FORMATS.US,
  COUNTRY_ADDRESS_FORMATS.CA,
  COUNTRY_ADDRESS_FORMATS.MX,
  COUNTRY_ADDRESS_FORMATS.GB
];

/**
 * The format for a country we have not written rules for.
 *
 * Four countries have real rules: their own word for a region, the list of
 * regions, and a postal code pattern that is checked. For the other two hundred
 * and forty-seven, the honest thing is to accept what the person types. A made
 * up rule for a country nobody here has checked will reject correct addresses,
 * and a wrongly rejected address is worse than an unvalidated one.
 */
function genericFormat(code: string): CountryAddressFormat {
  return {
    code: code.toUpperCase() as SupportedCountryCode,
    dialCode: '',
    label: getCountryLabel(code),
    postalLabel: 'Postal code',
    postalPlaceholder: '',
    // Not every country uses postal codes at all, so it cannot be demanded.
    postalRequired: false,
    regionLabel: 'State, province or region (optional)',
    regionOptions: [],
    regionRequired: false
  };
}

export function getCountryFormat(code: string): CountryAddressFormat {
  return COUNTRY_ADDRESS_FORMATS[code.toUpperCase() as SupportedCountryCode] ||
    genericFormat(code);
}

/**
 * Checks a postal code against the country's own format.
 *
 * Returns a message rather than a boolean, because "that is not a valid postal
 * code" helps nobody — the person needs to know what shape is expected.
 */
export function validatePostalCode(countryCode: string, value: string): string | null {
  const format = getCountryFormat(countryCode);
  const cleaned = value.trim().toUpperCase();

  if (!cleaned) {
    // The label keeps its own casing. Lowercasing it produced "zip code",
    // which is wrong — ZIP is an acronym, and getting it wrong on a form
    // written for Americans is exactly the kind of detail that reads as
    // careless.
    return format.postalRequired ? `Enter a ${format.postalLabel}.` : null;
  }

  const patterns: Record<SupportedCountryCode, RegExp> = {
    // Five digits, optionally the four-digit extension.
    US: /^\d{5}(-\d{4})?$/,
    // Letter-digit-letter, space optional, digit-letter-digit.
    CA: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/,
    MX: /^\d{5}$/,
    // Deliberately permissive. UK postcodes have more shapes than a tidy
    // pattern captures, and rejecting a real address is worse than accepting
    // an odd one on a contact form.
    GB: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/
  };

  const pattern = patterns[format.code];

  // A country we have no pattern for. Accept what was typed rather than
  // inventing a rule: a wrongly rejected address is worse than an unchecked
  // one, and this reaches people in two hundred countries we have not studied.
  if (!pattern) {
    return null;
  }

  if (!pattern.test(cleaned)) {
    return `That does not look like a ${format.label} ${format.postalLabel}. Example: ${format.postalPlaceholder}`;
  }

  return null;
}

/** Normalises a postal code to how the country writes it. */
export function formatPostalCode(countryCode: string, value: string): string {
  const format = getCountryFormat(countryCode);

  // Only tidy the countries whose shape we actually know. Forcing another
  // country's code into capitals is a guess about a convention nobody here
  // has checked.
  if (!['US', 'CA', 'MX', 'GB'].includes(format.code)) {
    return value.trim();
  }

  const cleaned = value.trim().toUpperCase().replace(/\s+/g, '');

  if (format.code === 'CA' && cleaned.length === 6) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  }

  if (format.code === 'GB' && cleaned.length >= 5) {
    return `${cleaned.slice(0, cleaned.length - 3)} ${cleaned.slice(-3)}`;
  }

  return value.trim().toUpperCase();
}

export interface PostalAddressParts {
  city?: string;
  countryCode?: string;
  line1?: string;
  line2?: string;
  postalCode?: string;
  region?: string;
}

/**
 * Lay an address out the way its own country writes it.
 *
 * A Mexican address puts the postal code before the city; a British one puts
 * the postcode on its own line; American and Canadian ones run city, region and
 * code together. Printing every address in one house style makes them all look
 * slightly wrong to the person who lives there.
 *
 * Returns one line per line of the address, with empty pieces dropped.
 */
export function formatPostalAddress(address: PostalAddressParts | null): string[] {
  if (!address) {
    return [];
  }

  const city = (address.city || '').trim();
  const region = (address.region || '').trim();
  const postalCode = (address.postalCode || '').trim();
  const format = getCountryFormat(address.countryCode || 'US');

  const lines = [(address.line1 || '').trim(), (address.line2 || '').trim()];

  if (format.code === 'GB') {
    // Town on one line, postcode alone beneath it — the British convention.
    lines.push(city, postalCode);
  } else if (format.code === 'MX') {
    lines.push([postalCode, city].filter(Boolean).join(' '), region);
  } else {
    // US and Canada: "San Francisco, CA 94105".
    const tail = [region, postalCode].filter(Boolean).join(' ');
    lines.push([city, tail].filter(Boolean).join(city && tail ? ', ' : ''));
  }

  lines.push(format.label);

  return lines.filter((line) => line.length > 0);
}
