/**
 * The words and icons on the main menu.
 *
 * Kept out of the component so they can be tested: what a card is headed, and
 * whether it is honest about who it is naming, is a rule rather than a layout.
 *
 * See SYNZAPP_MAIN_MENU_PLAN.md.
 */

export type MainNavigationKey =
  | 'ACTIONS'
  | 'RECORD MEETING'
  | 'LEADERS STANDARD WORK'
  | 'INTERPRETER'
  | 'LIBRARY';

export interface MainNavigationItem {
  icon: 'book-open' | 'check-square' | 'clipboard' | 'globe' | 'mic';
  key: MainNavigationKey;
  label: string;
}

/**
 * Sentence case, with an icon each.
 *
 * The keys stay in capitals because that is what the screen behind this menu
 * switches on; only what a person reads has changed. Capitals are slower to
 * read and carry no more meaning, and the icon is what people navigate by
 * once they have used the app twice.
 */
export const MAIN_NAVIGATION_ITEMS: MainNavigationItem[] = [
  { icon: 'check-square', key: 'ACTIONS', label: 'Actions' },
  { icon: 'mic', key: 'RECORD MEETING', label: 'Record meeting' },
  { icon: 'clipboard', key: 'LEADERS STANDARD WORK', label: 'Leaders standard work' },
  { icon: 'globe', key: 'INTERPRETER', label: 'Interpreter' },
  { icon: 'book-open', key: 'LIBRARY', label: 'Library' }
];

export function listMainNavigationItems(keys: readonly MainNavigationKey[]): MainNavigationItem[] {
  return MAIN_NAVIGATION_ITEMS.filter((item) => keys.includes(item.key));
}

/**
 * What the admin card is called.
 *
 * A department admin is the nearer answer and is named as one. Where there is
 * none — or where the reader is the department admin — the card falls back to
 * the organization admin and **says so**. Calling that person "your department
 * admin" would be a lie told to every person in a department that has none.
 */
export function describeAdminContactHeading(scope: 'DEPARTMENT' | 'ORGANIZATION'): string {
  return scope === 'ORGANIZATION' ? 'Your organization admin' : 'Your department admin';
}

/**
 * The line under their name.
 *
 * Their role, and a count of anybody else who could have been named instead.
 * The others are counted rather than listed: one tappable row cannot open a
 * chat with three people, and a name you cannot act on is clutter.
 */
export function describeAdminContactSubtitle(input: {
  otherAdminCount: number;
  roleName: string;
}): string {
  const role = input.roleName.trim() || 'Admin';
  const others = Math.max(0, Math.round(input.otherAdminCount || 0));

  if (others <= 0) {
    return role;
  }

  return others === 1 ? `${role} · and 1 other` : `${role} · and ${others} others`;
}

/**
 * The two lines under your own name.
 *
 * Role first, because it is what changes what the app lets you do. The
 * department only appears when there is one; "Department: none" tells nobody
 * anything they can use.
 */
export function describeOwnIdentityLines(input: {
  departmentName: string | null;
  phoneFormatted: string;
  roleName: string;
}): string[] {
  const lines: string[] = [];
  const role = input.roleName.trim();
  const department = (input.departmentName || '').trim();
  const phone = input.phoneFormatted.trim();

  if (role && department) {
    lines.push(`${role} · ${department}`);
  } else if (role) {
    lines.push(role);
  } else if (department) {
    lines.push(department);
  }

  if (phone) {
    lines.push(phone);
  }

  return lines;
}
