import type { Announcement } from './announcementApi';

/**
 * Finding one notice among a year of them.
 *
 * A company sends these steadily and never deletes them, so the list only grows.
 * Searching has to cover the three ways somebody actually remembers a notice:
 * **who it went to** (a department or a group), **who sent it**, and **what it
 * said**.
 *
 * The audience is searched by name rather than by id, because "Bakery" is what
 * a person types and `dept_bakery` is not. The body is included even though the
 * list does not show it: half-remembering a phrase from a notice is the most
 * common way of looking for one.
 */

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Everything about one notice that a search should be able to reach. */
export function buildAnnouncementSearchText(announcement: Announcement): string {
  return [
    announcement.subject,
    announcement.body,
    announcement.audienceSummary,
    announcement.createdByName,
    ...(announcement.audiences || []).map((audience) => audience.targetName)
  ]
    .filter(Boolean)
    .join(' ');
}

export function filterAnnouncements(
  announcements: Announcement[],
  query: string
): Announcement[] {
  const needle = normalise(query);

  if (!needle) {
    return announcements;
  }

  // Every word has to appear somewhere, in any order. "bakery oven" finds the
  // oven notice sent to Bakery without needing the words to sit together.
  const words = needle.split(' ');

  return announcements.filter((announcement) => {
    const haystack = normalise(buildAnnouncementSearchText(announcement));

    return words.every((word) => haystack.includes(word));
  });
}
