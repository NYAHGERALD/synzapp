import { describe, expect, it } from 'vitest';
import { getLanguageFlagEmoji, getLanguageRegionCode } from './languageFlags';

describe('getLanguageRegionCode', () => {
  it('reads the region a code names', () => {
    expect(getLanguageRegionCode('en-US')).toBe('US');
    expect(getLanguageRegionCode('es-MX')).toBe('MX');
    expect(getLanguageRegionCode('pt-BR')).toBe('BR');
  });

  it('accepts an underscore and lower case, as some platforms report locales', () => {
    expect(getLanguageRegionCode('fr_fr')).toBe('FR');
  });

  it('never reads a script subtag as a country', () => {
    // 'Hans' is the writing system, not a place. Four letters is never a region.
    expect(getLanguageRegionCode('zh-Hans')).toBeNull();
    expect(getLanguageRegionCode('sat-Latn')).toBeNull();
    expect(getLanguageRegionCode('mni-Mtei')).toBeNull();
  });

  it('never reads a UN area code as a country', () => {
    expect(getLanguageRegionCode('es-419')).toBeNull();
  });

  it('finds the region even when a script comes first', () => {
    expect(getLanguageRegionCode('zh-Hant-TW')).toBe('TW');
  });

  it('falls back only for a language with one home country', () => {
    expect(getLanguageRegionCode('uk')).toBe('UA');
    expect(getLanguageRegionCode('el')).toBe('GR');
    expect(getLanguageRegionCode('no')).toBe('NO');
  });

  it('refuses to guess a country for a language spoken across borders', () => {
    // Swahili, Catalan and Tigrinya each belong to more than one country.
    expect(getLanguageRegionCode('sw')).toBeNull();
    expect(getLanguageRegionCode('ca')).toBeNull();
    expect(getLanguageRegionCode('ti')).toBeNull();
  });

  it('answers nothing for a language whose people have no country', () => {
    // Hawaii is a state, not a country, so no flag exists for it at all.
    expect(getLanguageRegionCode('haw')).toBeNull();
    // Esperanto has no country by design.
    expect(getLanguageRegionCode('eo')).toBeNull();
  });

  it('answers nothing rather than flying the flag of a larger state', () => {
    // Tatar and Sakha would both resolve to Russia, which says where they are
    // governed rather than who they are.
    expect(getLanguageRegionCode('tt')).toBeNull();
    expect(getLanguageRegionCode('sah')).toBeNull();
  });

  it('covers the languages that are one country\'s own', () => {
    expect(getLanguageRegionCode('ceb')).toBe('PH');
    expect(getLanguageRegionCode('mi')).toBe('NZ');
    expect(getLanguageRegionCode('sn')).toBe('ZW');
    expect(getLanguageRegionCode('jam')).toBe('JM');
    expect(getLanguageRegionCode('tpi')).toBe('PG');
  });

  it('answers nothing for an empty or unknown code', () => {
    expect(getLanguageRegionCode('')).toBeNull();
    expect(getLanguageRegionCode('   ')).toBeNull();
    expect(getLanguageRegionCode('xyz')).toBeNull();
  });
});

describe('getLanguageFlagEmoji', () => {
  it('builds the flag from regional indicator letters', () => {
    expect(getLanguageFlagEmoji('en-US')).toBe('\u{1F1FA}\u{1F1F8}');
    expect(getLanguageFlagEmoji('ja-JP')).toBe('\u{1F1EF}\u{1F1F5}');
    expect(getLanguageFlagEmoji('zu-ZA')).toBe('\u{1F1FF}\u{1F1E6}');
  });

  it('gives no flag rather than a wrong one', () => {
    expect(getLanguageFlagEmoji('sw')).toBeNull();
    expect(getLanguageFlagEmoji('zh-Hans')).toBeNull();
  });
});
