/**
 * Values the Incident node can lend to Incident Details.
 *
 * They describe the same event, and retyping is how they drift apart. This
 * holds the rules for deciding what may be carried and in what shape; the
 * workspace applies them when the two nodes are connected and when the panel is
 * opened.
 *
 * No react import, so the rules can be tested — and the date one needs it: the
 * two fields are not the same kind. "Date of Incident" is a date, "When Did It
 * Happen?" is a date and a time together, and a date handed to a
 * datetime-local input is rejected outright.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})/;

/** Midnight, when the incident recorded a day but no clock time. */
const DEFAULT_TIME = '00:00';

/**
 * Joins the incident's date and time into what a datetime-local field expects.
 *
 * Returns null when there is no usable date. A time without a date cannot be
 * placed on the calendar, and guessing today's date for it would put the
 * incident on the wrong day.
 */
export function combineIncidentDateAndTime(
  date: string | undefined,
  time: string | undefined
): string | null {
  const safeDate = (date || '').trim();

  if (!DATE_PATTERN.test(safeDate)) {
    return null;
  }

  const timeMatch = TIME_PATTERN.exec((time || '').trim());
  // Seconds are dropped: a datetime-local field does not show them.
  const safeTime = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : DEFAULT_TIME;

  return `${safeDate}T${safeTime}`;
}

/**
 * Whether a field still holds what the product put there, rather than a person.
 *
 * `placeholders` covers the case where a field mirrors the node's title, so a
 * fresh node holds a default rather than nothing. Treating that as content
 * would mean the carry-over never fired.
 */
export function isUnwrittenField(value: string | undefined, placeholders: string[]): boolean {
  const safeValue = (value || '').trim();

  return !safeValue || placeholders.some((placeholder) => safeValue === (placeholder || '').trim());
}
