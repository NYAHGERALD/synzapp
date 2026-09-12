/**
 * Which language the interpreter speaks when a session opens.
 *
 * The room takes its spoken output from the **first** language on the meeting,
 * so the choice is carried by the order of the list rather than by a field of
 * its own — no new storage, and the backend keeps the order it is given.
 *
 * It belongs to the meeting because it is the person setting the meeting up
 * who knows which way round the room will be working. An app-wide default
 * would be one language imposed on every company using Synzapp.
 */

/**
 * Puts the chosen spoken language first, leaving everything else in order.
 *
 * A code that is not among the meeting's languages is ignored rather than
 * added: it means the language was chosen and then deselected, and adding it
 * back would quietly put a language on the meeting nobody asked for.
 */
export function orderLanguagesForSpokenOutput(
  languageCodes: string[],
  spokenOutputLanguageCode: string | null
): string[] {
  const ordered = languageCodes.filter(Boolean);

  if (!spokenOutputLanguageCode || !ordered.includes(spokenOutputLanguageCode)) {
    return ordered;
  }

  return [
    spokenOutputLanguageCode,
    ...ordered.filter((code) => code !== spokenOutputLanguageCode)
  ];
}

/**
 * The spoken language to show, given what is currently selected.
 *
 * Deselecting the language that was set as the spoken output has to leave the
 * meeting with an answer, so it falls back to the first one still selected.
 * Returns null only when there is nothing to choose from at all.
 */
export function resolveSpokenOutputLanguageCode(
  languageCodes: string[],
  spokenOutputLanguageCode: string | null
): string | null {
  const selected = languageCodes.filter(Boolean);

  if (spokenOutputLanguageCode && selected.includes(spokenOutputLanguageCode)) {
    return spokenOutputLanguageCode;
  }

  return selected[0] || null;
}
