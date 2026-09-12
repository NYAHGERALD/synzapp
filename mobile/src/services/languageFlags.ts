/**
 * A flag for a language the interpreter is working in.
 *
 * A language is not a country, and pretending otherwise is how flag pickers go
 * wrong: Spanish is not Spain to somebody in Mexico. So the flag here stands
 * for the **region in the language code**, which is a real thing the person
 * chose — `es-MX` really is Mexican Spanish, and `pt-BR` really is Brazilian
 * Portuguese.
 *
 * Where a code carries no region, a small table covers the languages that are
 * the national language of exactly one country. Everything else gets no flag
 * at all rather than a guess, and the screen shows a globe instead.
 */

const REGIONAL_INDICATOR_OFFSET = 0x1F1E6 - 'A'.charCodeAt(0);

/**
 * Languages whose home country is not in dispute.
 *
 * Each of these is the national language of exactly one country, so the flag
 * is a fact rather than a guess.
 *
 * Three kinds of language are deliberately left out, and they are the reason
 * some rows show a globe instead:
 *
 * - **No country to point at.** Hawaiian, Cherokee and Yiddish have no state
 *   of their own, and Hawaii is not a country, so no flag emoji exists for it.
 *   Esperanto has no country by design.
 * - **Spoken across borders.** Swahili, Catalan, Tigrinya, Fula, Kurdish and
 *   Quechua each belong to several countries that would each claim them.
 *   Choosing one is a political statement, not a label.
 * - **A people inside a larger state.** Tatar, Bashkir, Sakha, Chuvash and the
 *   rest would all resolve to one flag, which says where they are governed
 *   rather than who they are. A globe is the more honest mark.
 */
const SINGLE_COUNTRY_LANGUAGES: Record<string, string> = {
  af: 'ZA',
  ak: 'GH',
  am: 'ET',
  az: 'AZ',
  be: 'BY',
  bg: 'BG',
  bm: 'ML',
  bs: 'BA',
  ceb: 'PH',
  chk: 'FM',
  crs: 'SC',
  da: 'DK',
  dv: 'MV',
  dz: 'BT',
  el: 'GR',
  et: 'EE',
  fa: 'IR',
  fj: 'FJ',
  fo: 'FO',
  ga: 'IE',
  gaa: 'GH',
  gn: 'PY',
  he: 'IL',
  hil: 'PH',
  hr: 'HR',
  ht: 'HT',
  hy: 'AM',
  ilo: 'PH',
  is: 'IS',
  jam: 'JM',
  ka: 'GE',
  kk: 'KZ',
  kl: 'GL',
  km: 'KH',
  ky: 'KG',
  lb: 'LU',
  lg: 'UG',
  lo: 'LA',
  lt: 'LT',
  lv: 'LV',
  mfe: 'MU',
  mg: 'MG',
  mh: 'MH',
  mi: 'NZ',
  mk: 'MK',
  mn: 'MN',
  mt: 'MT',
  ne: 'NP',
  new: 'NP',
  no: 'NO',
  nr: 'ZA',
  nso: 'ZA',
  ny: 'MW',
  pag: 'PH',
  pam: 'PH',
  rn: 'BI',
  rw: 'RW',
  sg: 'CF',
  sl: 'SI',
  sm: 'WS',
  sn: 'ZW',
  so: 'SO',
  sq: 'AL',
  sr: 'RS',
  ss: 'SZ',
  st: 'LS',
  tg: 'TJ',
  tk: 'TM',
  tn: 'BW',
  to: 'TO',
  tpi: 'PG',
  ts: 'ZA',
  uk: 'UA',
  uz: 'UZ',
  ve: 'ZA',
  war: 'PH',
  wo: 'SN',
  xh: 'ZA',
  zu: 'ZA'
};

/**
 * The region a language code is asking for, or null when it does not say.
 *
 * Only a two-letter subtag is a region. Four letters is a script (`zh-Hans`,
 * `sat-Latn`) and three digits is a UN area code (`es-419`); reading either as
 * a country produces a flag for a place that does not exist.
 */
export function getLanguageRegionCode(languageCode: string): string | null {
  const trimmed = (languageCode || '').trim();

  if (!trimmed) {
    return null;
  }

  const [primary, ...rest] = trimmed.replace(/_/g, '-').split('-');

  for (const subtag of rest) {
    if (/^[A-Za-z]{2}$/.test(subtag)) {
      return subtag.toUpperCase();
    }
  }

  return SINGLE_COUNTRY_LANGUAGES[primary.toLowerCase()] || null;
}

/**
 * The flag for a language code, or null when no honest one exists.
 *
 * Built from regional indicator letters rather than an image, so it follows
 * whatever the phone already draws for a country and needs no assets, no
 * download and no licence.
 */
export function getLanguageFlagEmoji(languageCode: string): string | null {
  const region = getLanguageRegionCode(languageCode);

  if (!region) {
    return null;
  }

  return region
    .split('')
    .map((letter) => String.fromCodePoint(letter.charCodeAt(0) + REGIONAL_INDICATOR_OFFSET))
    .join('');
}
