import type { AnnouncementAudience } from './announcementApi';

/**
 * Choosing who an announcement is for.
 *
 * The list a sender scrolls, and the rules for filtering and selecting it.
 * Kept out of the screen so it can be tested without a phone: an audience
 * picker that quietly includes the wrong people is not a thing to discover
 * from a customer.
 */

export type AudienceSectionKey = 'SCOPE' | 'DEPARTMENTS' | 'GROUPS' | 'PEOPLE';

export interface AudienceChoice extends AnnouncementAudience {
  /** Shown under the name: "the 12 people in Line A". */
  description: string;
  section: AudienceSectionKey;
}

export const AUDIENCE_SECTION_TITLES: Record<AudienceSectionKey, string> = {
  DEPARTMENTS: 'Departments',
  GROUPS: 'Groups',
  PEOPLE: 'People',
  SCOPE: 'Everyone'
};

/** A stable key for one choice, since ids repeat across kinds. */
export function audienceKey(audience: AnnouncementAudience): string {
  return `${audience.kind}:${audience.targetId || 'all'}`;
}

export function isAudienceSelected(
  selected: AnnouncementAudience[],
  audience: AnnouncementAudience
): boolean {
  return selected.some((entry) => audienceKey(entry) === audienceKey(audience));
}

/** Tick and untick. The same choice cannot be added twice. */
export function toggleAudience(
  selected: AnnouncementAudience[],
  audience: AnnouncementAudience
): AnnouncementAudience[] {
  return isAudienceSelected(selected, audience)
    ? selected.filter((entry) => audienceKey(entry) !== audienceKey(audience))
    : [...selected, { kind: audience.kind, targetId: audience.targetId, targetName: audience.targetName }];
}

/**
 * Narrow the list to what somebody is typing.
 *
 * Matches the name and the description, so "warehouse" finds both the
 * department and the people in it.
 */
export function filterAudienceChoices(
  choices: AudienceChoice[],
  query: string
): AudienceChoice[] {
  const trimmed = query.trim().toLowerCase();

  if (!trimmed) {
    return choices;
  }

  return choices.filter(
    (choice) =>
      choice.targetName.toLowerCase().includes(trimmed) ||
      choice.description.toLowerCase().includes(trimmed)
  );
}

export interface AudienceSection {
  key: AudienceSectionKey;
  title: string;
  data: AudienceChoice[];
}

/** Grouped into sections, with empty ones left out entirely. */
export function groupAudienceChoices(choices: AudienceChoice[]): AudienceSection[] {
  const order: AudienceSectionKey[] = ['SCOPE', 'DEPARTMENTS', 'GROUPS', 'PEOPLE'];

  return order
    .map((key) => ({
      data: choices.filter((choice) => choice.section === key),
      key,
      title: AUDIENCE_SECTION_TITLES[key]
    }))
    .filter((section) => section.data.length > 0);
}

/**
 * The line under the picker while somebody is choosing.
 *
 * The count comes from the server, because only the server knows who is in a
 * department. Until it answers, this says so rather than guessing a number
 * somebody might act on.
 */
export function describeSelection(
  selected: AnnouncementAudience[],
  recipientCount: number | null
): string {
  if (!selected.length) {
    return 'Nobody chosen yet';
  }

  if (recipientCount === null) {
    return 'Counting…';
  }

  if (recipientCount === 0) {
    return 'This reaches nobody';
  }

  return `Reaches ${recipientCount} ${recipientCount === 1 ? 'person' : 'people'}`;
}

/**
 * The chosen audiences in words. Mirrors the sentence the server stores, so the
 * confirmation the sender reads and the record afterwards agree.
 */
export function describeAudiences(audiences: AnnouncementAudience[]): string {
  const names = audiences.map((audience) => audience.targetName);

  if (names.length <= 2) {
    return names.join(' and ');
  }

  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} others`;
}

export interface PersonCoverageInput {
  /** The audiences already chosen. */
  selected: AnnouncementAudience[];
  /** The department this person is in. */
  personDepartmentId: string | null;
  /**
   * Groups that automatically contain a whole department, as
   * { groupId: departmentId }. Every department gets one of these.
   */
  departmentBackedGroups: Record<string, string>;
}

/**
 * Whether this person is already reached by something else the sender picked.
 *
 * Returns the reason, or null. The row is then shown as already included rather
 * than hidden: somebody searching for a colleague who has silently vanished
 * from the list cannot tell whether it is a rule or a bug, and a list that
 * changes as other choices change is worse still.
 *
 * Only what can be known for certain is claimed here. The phone knows who is in
 * a department, and knows that a department-backed group contains that whole
 * department. It does not know who was hand-picked into an ordinary group, so
 * it says nothing about those rather than guessing.
 */
export function findCoverageReason(
  input: PersonCoverageInput
): string | null {
  for (const audience of input.selected) {
    if (audience.kind === 'ORGANIZATION') {
      return 'Already included: everyone at the company';
    }

    if (
      audience.kind === 'DEPARTMENT' &&
      input.personDepartmentId &&
      audience.targetId === input.personDepartmentId
    ) {
      return `Already included via ${audience.targetName}`;
    }

    if (audience.kind === 'GROUP' && audience.targetId) {
      const backingDepartment = input.departmentBackedGroups[audience.targetId];

      if (backingDepartment && backingDepartment === input.personDepartmentId) {
        return `Already included via ${audience.targetName}`;
      }
    }
  }

  return null;
}

/** A short summary for the compose screen: "2 departments · 1 group · 3 people". */
export function summariseSelectionByKind(selected: AnnouncementAudience[]): string {
  if (!selected.length) {
    return 'Nobody chosen yet';
  }

  const parts: string[] = [];
  const count = (kind: AnnouncementAudience['kind']) =>
    selected.filter((entry) => entry.kind === kind).length;

  if (count('ORGANIZATION')) {
    parts.push('Everyone at the company');
  }

  const departments = count('DEPARTMENT');
  const groups = count('GROUP');
  const people = count('PERSON');

  if (departments) {
    parts.push(`${departments} ${departments === 1 ? 'department' : 'departments'}`);
  }

  if (groups) {
    parts.push(`${groups} ${groups === 1 ? 'group' : 'groups'}`);
  }

  if (people) {
    parts.push(`${people} ${people === 1 ? 'person' : 'people'}`);
  }

  return parts.join(' · ');
}
