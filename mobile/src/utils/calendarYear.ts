export const calendarYearMinimumDate = new Date(1900, 0, 1);
export const calendarYearMaximumDate = new Date(2100, 11, 31);

const dateLabelFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

export function formatCalendarYearStartDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getCalendarYearStartDateLabel(value?: string | null): string {
  const date = parseCalendarYearStartDate(value);

  return date ? dateLabelFormatter.format(date) : 'Not set';
}

export function isValidCalendarYearStartDate(value?: string | null): value is string {
  return Boolean(parseCalendarYearStartDate(value));
}

export function parseCalendarYearStartDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  if (date < calendarYearMinimumDate || date > calendarYearMaximumDate) {
    return null;
  }

  return date;
}

export function getDefaultCalendarYearStartDate(): string {
  const now = new Date();

  return formatCalendarYearStartDateInput(new Date(now.getFullYear(), 0, 1));
}
