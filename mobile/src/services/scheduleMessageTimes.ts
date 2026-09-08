/**
 * The times offered when somebody schedules a message.
 *
 * Almost nobody wants an arbitrary moment. They want this evening, tomorrow
 * morning, or the start of the week — so those are offered as one tap each and
 * the picker is there for the rest. An emoji grid people scroll past and a time
 * picker people fight with are the same mistake.
 *
 * Everything here works in the phone's own time zone, deliberately. "Nine in the
 * morning" means nine where the person standing there is, and the `Date` it
 * produces carries the right absolute moment for that wall clock — including
 * across a daylight-saving change, because the platform applies the rules for
 * the date in question rather than today's offset.
 *
 * Pure, so the awkward cases — late at night, on a Monday, over a weekend — can
 * be checked without waiting for one.
 */

export interface ScheduleQuickOption {
  at: Date;
  id: 'later-today' | 'monday-morning' | 'tomorrow-morning';
  label: string;
}

/**
 * The hour a working message is expected to land on.
 *
 * Nine is when the day starts for the shifts this is sold into, and a message
 * timed for it reads as deliberate rather than as something sent overnight.
 */
export const MORNING_HOUR = 9;

/** Far enough ahead that it is plainly later, near enough to still be today. */
const LATER_TODAY_HOURS = 3;

/** Past this, "later today" is not later today, it is the middle of the night. */
const LATEST_TODAY_HOUR = 21;

const MINUTES_ROUNDING = 15;

/**
 * The one-tap choices, in the order they are offered.
 *
 * "Later today" disappears in the evening rather than offering a time nobody
 * wants a work message to arrive at. The list is never empty: tomorrow morning
 * always exists.
 */
export function buildScheduleQuickOptions(now: Date): ScheduleQuickOption[] {
  const options: ScheduleQuickOption[] = [];
  const laterToday = buildLaterToday(now);

  if (laterToday) {
    options.push({
      at: laterToday,
      id: 'later-today',
      label: `Later today, ${formatClockTime(laterToday)}`
    });
  }

  const tomorrowMorning = buildMorningOn(now, 1);

  options.push({
    at: tomorrowMorning,
    id: 'tomorrow-morning',
    label: `Tomorrow, ${formatClockTime(tomorrowMorning)}`
  });

  const mondayMorning = buildNextMondayMorning(now);

  // Offered only when it is a different day from tomorrow — on a Sunday the two
  // are the same moment, and a list with the same time twice looks broken.
  if (mondayMorning.getTime() !== tomorrowMorning.getTime()) {
    options.push({
      at: mondayMorning,
      id: 'monday-morning',
      label: `Monday, ${formatClockTime(mondayMorning)}`
    });
  }

  return options;
}

/**
 * A few hours from now, on a tidy quarter hour, or null once it is too late.
 *
 * Rounded because "later today, 17:00" is a time somebody chose and "later
 * today, 16:53" is a time a computer chose.
 */
export function buildLaterToday(now: Date): Date | null {
  const at = new Date(now.getTime());

  at.setHours(at.getHours() + LATER_TODAY_HOURS, at.getMinutes(), 0, 0);

  const remainder = at.getMinutes() % MINUTES_ROUNDING;

  if (remainder) {
    at.setMinutes(at.getMinutes() + (MINUTES_ROUNDING - remainder));
  }

  if (at.getDate() !== now.getDate() || at.getHours() >= LATEST_TODAY_HOUR) {
    return null;
  }

  return at;
}

/** Nine in the morning, this many days from now, in the phone's own zone. */
export function buildMorningOn(now: Date, daysAhead: number): Date {
  const at = new Date(now.getTime());

  at.setDate(at.getDate() + daysAhead);
  at.setHours(MORNING_HOUR, 0, 0, 0);

  return at;
}

/**
 * The next Monday morning.
 *
 * On a Monday this is next Monday rather than a moment that has already passed,
 * which is the case that a naive "day 1 minus today" gets wrong.
 */
export function buildNextMondayMorning(now: Date): Date {
  const daysUntilMonday = ((8 - now.getDay()) % 7) || 7;

  return buildMorningOn(now, daysUntilMonday);
}

/**
 * How a scheduled time is written out.
 *
 * Today and tomorrow are named rather than dated, because a date somebody has
 * to work out is a date they will misread.
 */
export function formatScheduledTime(at: Date, now: Date): string {
  const clock = formatClockTime(at);

  if (isSameDay(at, now)) {
    return `Today at ${clock}`;
  }

  if (isSameDay(at, addDays(now, 1))) {
    return `Tomorrow at ${clock}`;
  }

  const sameYear = at.getFullYear() === now.getFullYear();
  const day = at.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
    ...(sameYear ? {} : { year: 'numeric' })
  });

  return `${day} at ${clock}`;
}

function formatClockTime(at: Date): string {
  return at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function isSameDay(first: Date, second: Date): boolean {
  return first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate();
}

function addDays(from: Date, days: number): Date {
  const next = new Date(from.getTime());

  next.setDate(next.getDate() + days);

  return next;
}
