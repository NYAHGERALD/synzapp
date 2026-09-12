import { describe, expect, it } from 'vitest';
import {
  orderLanguagesForSpokenOutput,
  resolveSpokenOutputLanguageCode
} from './interpreterOutputLanguage';

describe('orderLanguagesForSpokenOutput', () => {
  it('puts the chosen language first', () => {
    expect(orderLanguagesForSpokenOutput(['en-US', 'es-MX'], 'es-MX'))
      .toEqual(['es-MX', 'en-US']);
  });

  it('leaves the rest of the order alone', () => {
    expect(orderLanguagesForSpokenOutput(['en-US', 'fr-FR', 'es-MX'], 'es-MX'))
      .toEqual(['es-MX', 'en-US', 'fr-FR']);
  });

  it('changes nothing when the chosen language is already first', () => {
    expect(orderLanguagesForSpokenOutput(['es-MX', 'en-US'], 'es-MX'))
      .toEqual(['es-MX', 'en-US']);
  });

  it('never adds a language that is not on the meeting', () => {
    // The language was chosen and then deselected. Adding it back would put a
    // language on the meeting nobody asked for.
    expect(orderLanguagesForSpokenOutput(['en-US'], 'es-MX')).toEqual(['en-US']);
  });

  it('copes with nothing chosen', () => {
    expect(orderLanguagesForSpokenOutput(['en-US', 'es-MX'], null))
      .toEqual(['en-US', 'es-MX']);
    expect(orderLanguagesForSpokenOutput([], 'es-MX')).toEqual([]);
  });
});

describe('resolveSpokenOutputLanguageCode', () => {
  it('keeps the chosen language while it is still selected', () => {
    expect(resolveSpokenOutputLanguageCode(['en-US', 'es-MX'], 'es-MX')).toBe('es-MX');
  });

  it('falls back to the first when the chosen language is deselected', () => {
    // The meeting always has to have an answer for what it will speak.
    expect(resolveSpokenOutputLanguageCode(['en-US', 'fr-FR'], 'es-MX')).toBe('en-US');
  });

  it('answers nothing when there is nothing to choose from', () => {
    expect(resolveSpokenOutputLanguageCode([], 'es-MX')).toBeNull();
    expect(resolveSpokenOutputLanguageCode([], null)).toBeNull();
  });
});
