/**
 * Offering — and confirming — an invite that hands somebody organization admin.
 *
 * This used to happen by itself. Choosing a department named "Human Resources"
 * silently overrode the role the admin had picked and granted full organization
 * admin instead, and nothing on the screen said so. The backend now refuses to
 * infer it: the request has to ask, and only a genuine organization admin may.
 *
 * So the app has to ask out loud. Two rules, and both matter:
 *
 *   - The switch is only offered to somebody who can actually use it. A control
 *     that always fails is worse than no control.
 *   - Turning it on is confirmed before anything is sent, in words that say what
 *     the person being invited will be able to do. "Organization admin" means
 *     nothing to somebody who has not read the permission catalogue.
 *
 * No native import, so the wording and the rule can be tested.
 */

/** The permission the backend requires before it will grant admin on an invite. */
export const ORG_ADMIN_GRANT_PERMISSION = 'users.manage';

/**
 * The one department an organization admin can be invited into.
 *
 * Mirrors `ORG_ADMIN_DEPARTMENT_ID` on the server, which is where the rule is
 * actually enforced; this copy only decides whether to draw the switch. The
 * server insists on it because it already moves every organization admin into
 * Human Resources on each profile request, so an admin invited anywhere else
 * never settles.
 *
 * Matched by id. A department merely *named* "Human Resources" is not this one
 * — reading the name is what the original defect did.
 */
export const ORG_ADMIN_DEPARTMENT_ID = 'dept_human-resources';

export interface OrgAdminInviteViewer {
  /** The department the draft invite would place them in. */
  departmentId?: string | null;
  permissions?: string[] | null;
  role?: string | null;
}

/**
 * Whether to show the switch at all.
 *
 * Mirrors the backend rule deliberately. A department admin holds `users.invite`
 * and is refused there, so offering them the switch would only produce an error
 * they cannot act on.
 */
export function canOfferOrgAdminInvite(viewer: OrgAdminInviteViewer): boolean {
  if (viewer.role !== 'ORG_ADMIN') {
    return false;
  }

  if (viewer.departmentId !== ORG_ADMIN_DEPARTMENT_ID) {
    return false;
  }

  return (viewer.permissions || []).includes(ORG_ADMIN_GRANT_PERMISSION);
}

export const ORG_ADMIN_INVITE_LABEL = 'Invite as organization admin';

/** What the draft shows as the granted role. Mirrors the server's own label. */
export const ORG_ADMIN_ROLE_NAME = 'Organization Admin';

/** What sits under the switch, so the choice is understood before it is made. */
export function describeOrgAdminInviteHint(): string {
  return 'They will be able to invite and remove people, change roles, read the audit log and delete the organization.';
}

export interface OrgAdminInviteConfirmation {
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  title: string;
}

/**
 * The question asked before an admin invite is sent.
 *
 * Names what the person will be able to do rather than the role, and says the
 * access matches the sender's own — which is the part that makes people stop
 * and check they meant it.
 */
export function describeOrgAdminInviteConfirmation(input: {
  contactCount: number;
  departmentName?: string | null;
}): OrgAdminInviteConfirmation {
  const who = input.contactCount === 1
    ? 'This person'
    : `These ${input.contactCount} people`;
  const verb = input.contactCount === 1 ? 'will have' : 'will each have';
  const department = input.departmentName?.trim();
  const placement = department ? ` They are being added to ${department}.` : '';

  return {
    /**
     * Names the two nobody expects — deleting the whole organization, and
     * placing a legal hold — because "organization admin" sounds like a title
     * rather than a set of powers. The last line is the honest part: there is
     * no way to take this back from inside the app yet.
     */
    body: `${who} ${verb} the same access you do: inviting and removing people, changing roles, reading the audit log, placing legal holds, and deleting the whole organization.${placement} This cannot be undone from the app yet.`,
    cancelLabel: 'Cancel',
    confirmLabel: input.contactCount === 1 ? 'Invite as admin' : 'Invite as admins',
    title: input.contactCount === 1
      ? 'Give this person admin access?'
      : 'Give these people admin access?'
  };
}
