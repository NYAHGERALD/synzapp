import type { TenantScheduledMessage } from './adminApi';

/**
 * Narrowing a list of waiting messages down to the ones somebody is looking for.
 *
 * Written for the size this reaches rather than the size it starts at. A company
 * of thirty people has a list you read; a company of three hundred across a
 * dozen departments has a list you search. The screen was built the first way
 * and would have quietly become useless.
 *
 * Pure, because "which day counts as today" and "does a search for a surname
 * find them" are the sort of questions that are answered wrongly in a component
 * and never noticed.
 */

export type ScheduledMessageDateFilter = 'ALL' | 'LATER' | 'TODAY' | 'TOMORROW' | 'WEEK';

export interface ScheduledMessageFilters {
  date: ScheduledMessageDateFilter;
  departmentId: string;
  search: string;
}

export const EMPTY_SCHEDULED_MESSAGE_FILTERS: ScheduledMessageFilters = {
  date: 'ALL',
  departmentId: '',
  search: ''
};

export function filterTenantScheduledMessages(
  scheduledMessages: TenantScheduledMessage[],
  filters: ScheduledMessageFilters,
  now: Date
): TenantScheduledMessage[] {
  const search = filters.search.trim().toLowerCase();

  return scheduledMessages.filter((message) => {
    if (filters.departmentId && message.departmentId !== filters.departmentId) {
      return false;
    }

    if (!matchesDateFilter(message.releaseAtMs, filters.date, now)) {
      return false;
    }

    if (!search) {
      return true;
    }

    // Either person matches, and the department too — somebody looking for
    // "bakery" means the team, and somebody typing a surname means a person.
    return [message.senderName, message.recipientName, message.departmentName]
      .some((value) => value.toLowerCase().includes(search));
  });
}

/**
 * The departments present in this list, for the filter row.
 *
 * Built from what is actually waiting rather than from the whole company, so
 * the row never offers a department with nothing behind it.
 */
export function listScheduledMessageDepartments(
  scheduledMessages: TenantScheduledMessage[]
): { id: string; name: string }[] {
  const byId = new Map<string, string>();

  for (const message of scheduledMessages) {
    if (message.departmentId) {
      byId.set(message.departmentId, message.departmentName);
    }
  }

  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((first, second) => first.name.localeCompare(second.name));
}

function matchesDateFilter(
  releaseAtMs: number,
  date: ScheduledMessageDateFilter,
  now: Date
): boolean {
  if (date === 'ALL') {
    return true;
  }

  const releaseAt = new Date(releaseAtMs);

  if (date === 'TODAY') {
    return isSameDay(releaseAt, now);
  }

  if (date === 'TOMORROW') {
    return isSameDay(releaseAt, addDays(now, 1));
  }

  if (date === 'WEEK') {
    // The next seven days from this moment, which is what somebody means by
    // "this week" when they are looking at a queue rather than a calendar.
    return releaseAtMs >= now.getTime() && releaseAtMs <= addDays(now, 7).getTime();
  }

  return releaseAtMs > addDays(now, 7).getTime();
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
