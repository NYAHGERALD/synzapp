import { getCountries, getCountryCallingCode } from 'libphonenumber-js';

/**
 * Every country and territory a phone number can be verified from.
 *
 * Firebase Phone Authentication works against E.164 numbers rather than a fixed
 * list of countries, so limiting the picker limits the product and nothing
 * else. Four entries shipped, which meant anybody outside the United States,
 * Canada, Mexico or the United Kingdom could not sign in at all.
 *
 * **Only the names are held here.** Dialling codes are read from
 * libphonenumber, which is the reference for them and is already carried for
 * validating and formatting numbers — see `phoneNumberInput.ts`. A second
 * hand-written copy is a second thing to keep in step, and the country whose
 * code has drifted is the one nobody notices until somebody there cannot sign
 * in. The two hundred and forty codes that used to sit here were checked
 * against the reference before they were deleted, and all of them agreed; that
 * is what a copy looks like on the day it is still right.
 *
 * The flag is derived from the ISO code for the same reason, so a wrong pair
 * cannot put the wrong flag beside somebody's country.
 */

export interface CountryDialCode {
  /** ISO 3166-1 alpha-2. */
  code: string;
  dialCode: string;
  name: string;
}

/**
 * The flag for an ISO country code.
 *
 * Two regional indicator symbols, which every platform renders as that
 * country's flag. `US` becomes 🇺🇸 without anybody typing an emoji.
 */
export function flagForCountry(code: string): string {
  const upper = code.trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(upper)) {
    return '';
  }

  return String.fromCodePoint(
    ...[...upper].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65)
  );
}

/**
 * The name to show for each country the reference supports.
 *
 * A country missing from here would still be a country somebody can be reached
 * in, so the list is built from the reference and falls back to the ISO code
 * rather than dropping it.
 */
const COUNTRY_NAMES: Record<string, string> = {
  AC: 'Ascension Island',
  AD: 'Andorra',
  AE: 'United Arab Emirates',
  AF: 'Afghanistan',
  AG: 'Antigua and Barbuda',
  AI: 'Anguilla',
  AL: 'Albania',
  AM: 'Armenia',
  AO: 'Angola',
  AR: 'Argentina',
  AS: 'American Samoa',
  AT: 'Austria',
  AU: 'Australia',
  AW: 'Aruba',
  AX: 'Åland Islands',
  AZ: 'Azerbaijan',
  BA: 'Bosnia and Herzegovina',
  BB: 'Barbados',
  BD: 'Bangladesh',
  BE: 'Belgium',
  BF: 'Burkina Faso',
  BG: 'Bulgaria',
  BH: 'Bahrain',
  BI: 'Burundi',
  BJ: 'Benin',
  BL: 'St. Barthélemy',
  BM: 'Bermuda',
  BN: 'Brunei',
  BO: 'Bolivia',
  BQ: 'Caribbean Netherlands',
  BR: 'Brazil',
  BS: 'Bahamas',
  BT: 'Bhutan',
  BW: 'Botswana',
  BY: 'Belarus',
  BZ: 'Belize',
  CA: 'Canada',
  CC: 'Cocos (Keeling) Islands',
  CD: 'Congo - Kinshasa',
  CF: 'Central African Republic',
  CG: 'Congo - Brazzaville',
  CH: 'Switzerland',
  CI: 'Côte d’Ivoire',
  CK: 'Cook Islands',
  CL: 'Chile',
  CM: 'Cameroon',
  CN: 'China',
  CO: 'Colombia',
  CR: 'Costa Rica',
  CU: 'Cuba',
  CV: 'Cape Verde',
  CW: 'Curaçao',
  CX: 'Christmas Island',
  CY: 'Cyprus',
  CZ: 'Czechia',
  DE: 'Germany',
  DJ: 'Djibouti',
  DK: 'Denmark',
  DM: 'Dominica',
  DO: 'Dominican Republic',
  DZ: 'Algeria',
  EC: 'Ecuador',
  EE: 'Estonia',
  EG: 'Egypt',
  EH: 'Western Sahara',
  ER: 'Eritrea',
  ES: 'Spain',
  ET: 'Ethiopia',
  FI: 'Finland',
  FJ: 'Fiji',
  FK: 'Falkland Islands',
  FM: 'Micronesia',
  FO: 'Faroe Islands',
  FR: 'France',
  GA: 'Gabon',
  GB: 'United Kingdom',
  GD: 'Grenada',
  GE: 'Georgia',
  GF: 'French Guiana',
  GG: 'Guernsey',
  GH: 'Ghana',
  GI: 'Gibraltar',
  GL: 'Greenland',
  GM: 'Gambia',
  GN: 'Guinea',
  GP: 'Guadeloupe',
  GQ: 'Equatorial Guinea',
  GR: 'Greece',
  GT: 'Guatemala',
  GU: 'Guam',
  GW: 'Guinea-Bissau',
  GY: 'Guyana',
  HK: 'Hong Kong SAR China',
  HN: 'Honduras',
  HR: 'Croatia',
  HT: 'Haiti',
  HU: 'Hungary',
  ID: 'Indonesia',
  IE: 'Ireland',
  IL: 'Israel',
  IM: 'Isle of Man',
  IN: 'India',
  IO: 'British Indian Ocean Territory',
  IQ: 'Iraq',
  IR: 'Iran',
  IS: 'Iceland',
  IT: 'Italy',
  JE: 'Jersey',
  JM: 'Jamaica',
  JO: 'Jordan',
  JP: 'Japan',
  KE: 'Kenya',
  KG: 'Kyrgyzstan',
  KH: 'Cambodia',
  KI: 'Kiribati',
  KM: 'Comoros',
  KN: 'St. Kitts and Nevis',
  KP: 'North Korea',
  KR: 'South Korea',
  KW: 'Kuwait',
  KY: 'Cayman Islands',
  KZ: 'Kazakhstan',
  LA: 'Laos',
  LB: 'Lebanon',
  LC: 'St. Lucia',
  LI: 'Liechtenstein',
  LK: 'Sri Lanka',
  LR: 'Liberia',
  LS: 'Lesotho',
  LT: 'Lithuania',
  LU: 'Luxembourg',
  LV: 'Latvia',
  LY: 'Libya',
  MA: 'Morocco',
  MC: 'Monaco',
  MD: 'Moldova',
  ME: 'Montenegro',
  MF: 'St. Martin',
  MG: 'Madagascar',
  MH: 'Marshall Islands',
  MK: 'North Macedonia',
  ML: 'Mali',
  MM: 'Myanmar',
  MN: 'Mongolia',
  MO: 'Macao SAR China',
  MP: 'Northern Mariana Islands',
  MQ: 'Martinique',
  MR: 'Mauritania',
  MS: 'Montserrat',
  MT: 'Malta',
  MU: 'Mauritius',
  MV: 'Maldives',
  MW: 'Malawi',
  MX: 'Mexico',
  MY: 'Malaysia',
  MZ: 'Mozambique',
  NA: 'Namibia',
  NC: 'New Caledonia',
  NE: 'Niger',
  NF: 'Norfolk Island',
  NG: 'Nigeria',
  NI: 'Nicaragua',
  NL: 'Netherlands',
  NO: 'Norway',
  NP: 'Nepal',
  NR: 'Nauru',
  NU: 'Niue',
  NZ: 'New Zealand',
  OM: 'Oman',
  PA: 'Panama',
  PE: 'Peru',
  PF: 'French Polynesia',
  PG: 'Papua New Guinea',
  PH: 'Philippines',
  PK: 'Pakistan',
  PL: 'Poland',
  PM: 'St. Pierre and Miquelon',
  PR: 'Puerto Rico',
  PS: 'Palestine',
  PT: 'Portugal',
  PW: 'Palau',
  PY: 'Paraguay',
  QA: 'Qatar',
  RE: 'Réunion',
  RO: 'Romania',
  RS: 'Serbia',
  RU: 'Russia',
  RW: 'Rwanda',
  SA: 'Saudi Arabia',
  SB: 'Solomon Islands',
  SC: 'Seychelles',
  SD: 'Sudan',
  SE: 'Sweden',
  SG: 'Singapore',
  SH: 'St. Helena',
  SI: 'Slovenia',
  SJ: 'Svalbard and Jan Mayen',
  SK: 'Slovakia',
  SL: 'Sierra Leone',
  SM: 'San Marino',
  SN: 'Senegal',
  SO: 'Somalia',
  SR: 'Suriname',
  SS: 'South Sudan',
  ST: 'São Tomé and Príncipe',
  SV: 'El Salvador',
  SX: 'Sint Maarten',
  SY: 'Syria',
  SZ: 'Eswatini',
  TA: 'Tristan da Cunha',
  TC: 'Turks and Caicos Islands',
  TD: 'Chad',
  TG: 'Togo',
  TH: 'Thailand',
  TJ: 'Tajikistan',
  TK: 'Tokelau',
  TL: 'Timor-Leste',
  TM: 'Turkmenistan',
  TN: 'Tunisia',
  TO: 'Tonga',
  TR: 'Türkiye',
  TT: 'Trinidad and Tobago',
  TV: 'Tuvalu',
  TW: 'Taiwan',
  TZ: 'Tanzania',
  UA: 'Ukraine',
  UG: 'Uganda',
  US: 'United States',
  UY: 'Uruguay',
  UZ: 'Uzbekistan',
  VA: 'Vatican City',
  VC: 'St. Vincent and Grenadines',
  VE: 'Venezuela',
  VG: 'British Virgin Islands',
  VI: 'U.S. Virgin Islands',
  VN: 'Vietnam',
  VU: 'Vanuatu',
  WF: 'Wallis and Futuna',
  WS: 'Samoa',
  XK: 'Kosovo',
  YE: 'Yemen',
  YT: 'Mayotte',
  ZA: 'South Africa',
  ZM: 'Zambia',
  ZW: 'Zimbabwe',};

/**
 * Sorted by name with `localeCompare`, so accented names land where somebody
 * looks for them. Plain string ordering puts Åland Islands and Côte d'Ivoire
 * after Zimbabwe, which a test caught.
 */
export const COUNTRY_DIAL_CODES: CountryDialCode[] = getCountries()
  .map((code) => ({
    code,
    dialCode: `+${getCountryCallingCode(code)}`,
    name: COUNTRY_NAMES[code] || code
  }))
  .sort((first, second) => first.name.localeCompare(second.name));

/**
 * Countries matching what somebody typed.
 *
 * Matches the name, the ISO code and the dialling code, with or without its
 * plus, because people search all three. Somebody typing "44" is looking for
 * the United Kingdom just as much as somebody typing "unit".
 */
export function searchCountries(query: string): CountryDialCode[] {
  const trimmed = query.trim().toLowerCase();

  if (!trimmed) {
    return COUNTRY_DIAL_CODES;
  }

  const bare = trimmed.replace(/^\+/, '');

  return COUNTRY_DIAL_CODES.filter((country) =>
    country.name.toLowerCase().includes(trimmed) ||
    country.code.toLowerCase() === trimmed ||
    country.dialCode.replace('+', '').startsWith(bare));
}
