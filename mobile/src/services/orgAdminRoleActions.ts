/**
 * The two actions that change somebody's organization-admin status.
 *
 * Both were missing, and their absence showed up as a lie in this very list.
 * Every lifecycle service refuses a record whose role is already `ORG_ADMIN`,
 * but the employee sheet went on offering "Deactivate", "Archive", "Delete" and
 * "Change role" for one — and every single one came back "Employee was not
 * found." An admin could be seen in the directory and touched by nothing.
 *
 * So an organization admin is now offered exactly one action: stepping them
 * down. Everything else becomes available the moment they are an ordinary
 * employee again, through the services that already do it properly.
 *
 * No native import, so the wording and the rules can be tested.
 */

export type OrgAdminRoleAction = 'ASSIGN_ORG_ADMIN' | 'REMOVE_ORG_ADMIN';

/** Structurally the same as the sheet's own option, without importing it. */
export interface OrgAdminRoleActionOption {
  action: OrgAdminRoleAction;
  confirmButton: string;
  confirmMessage: (employeeName: string) => string;
  confirmTitle: string;
  label: string;
  successMessage: (employeeName: string) => string;
  successTitle: string;
}

export function isOrgAdminEmployee(baseRole?: string | null): boolean {
  return (baseRole || '').toUpperCase() === 'ORG_ADMIN';
}

/**
 * The one action offered for an organization admin, or the one offered for
 * somebody who could become one. Null when neither applies.
 *
 * Only ACTIVE and INVITED records qualify for promotion. Somebody deactivated,
 * archived or deleted is on their way out, and making them an administrator on
 * the way is not a thing anybody means to do.
 */
export function buildOrgAdminRoleOption(input: {
  baseRole?: string | null;
  status?: string | null;
  targetUid?: string | null;
  viewerUid?: string | null;
}): OrgAdminRoleActionOption | null {
  const status = (input.status || '').toUpperCase();

  /**
   * Never on your own row. The server refuses it — an admin who can demote
   * themselves strands a company by accident — so offering it would walk
   * somebody through a role picker and a confirmation to reach an error.
   */
  if (input.viewerUid && input.targetUid && input.viewerUid === input.targetUid) {
    return null;
  }

  if (isOrgAdminEmployee(input.baseRole)) {
    return {
      action: 'REMOVE_ORG_ADMIN',
      confirmButton: 'Step down',
      confirmMessage: (employeeName) =>
        `${employeeName} will go back to being an ordinary employee on the role you choose. ` +
        'They keep their account and their chats.',
      confirmTitle: 'Remove admin access?',
      label: 'Remove admin access',
      successMessage: (employeeName) => `${employeeName} is no longer an organization admin.`,
      successTitle: 'Admin access removed'
    };
  }

  if (status !== 'ACTIVE' && status !== 'INVITED') {
    return null;
  }

  return {
    action: 'ASSIGN_ORG_ADMIN',
    confirmButton: 'Make admin',
    confirmMessage: (employeeName) =>
      `${employeeName} will have the same access you do: inviting and removing people, ` +
      'changing roles, reading the audit log, placing legal holds, and changing how long ' +
      'the company keeps its records.',
    confirmTitle: 'Give this person admin access?',
    label: 'Make organization admin',
    successMessage: (employeeName) => `${employeeName} is now an organization admin.`,
    successTitle: 'Admin access given'
  };
}

/**
 * Whether the sheet should offer the ordinary lifecycle actions.
 *
 * It must not, for an organization admin: every one of them is refused by the
 * server, and a menu full of things that cannot work is worse than a short one.
 */
export function shouldOfferEmployeeLifecycleActions(baseRole?: string | null): boolean {
  return !isOrgAdminEmployee(baseRole);
}
