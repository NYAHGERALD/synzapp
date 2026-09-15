/**
 * Who may hand out organization admin, and what an invite actually grants.
 *
 * This replaces a rule that decided both of those from a **department name**.
 * Inviting anybody into a department called "Human Resources" used to overwrite
 * the role the admin had chosen and grant all ten organization-admin
 * permissions instead. The match was on the normalised name, so creating or
 * renaming any department to "human resources" turned it on, and nothing in the
 * interface said so.
 *
 * Worse, the invite endpoint admits a department admin as well as an
 * organization admin, and only checks that the target department is the
 * department admin's own. A department admin of HR could therefore mint
 * unlimited full organization admins for the whole company.
 *
 * So the grant is explicit now, and it is asked for rather than inferred. Two
 * separate questions, kept apart on purpose:
 *
 *   - `canGrantOrgAdminOnInvite` — may this caller give away admin at all?
 *   - `resolveInviteRoleGrant` — given that answer, what does the invite write?
 *
 * No Firebase import, so both are testable without credentials or a network.
 */

import { SynzappRole } from '../types/auth.js';
import { ORG_ADMIN_PERMISSIONS, normalizeRolePermissions } from './permissionCatalog.js';
import { HUMAN_RESOURCES_DEPARTMENT_ID } from './tenantDefaults.js';

/** The name shown against an organization admin, in the directory and on the invite. */
export const ORG_ADMIN_ROLE_NAME = 'Organization Admin';

/**
 * The permission required to give somebody organization admin.
 *
 * Deliberately stronger than `users.invite`, which is the permission that opens
 * the endpoint itself and which department admins hold. Adding a colleague and
 * making a colleague your equal are different acts, and the second one is a
 * change to who runs the company.
 */
export const ORG_ADMIN_GRANT_PERMISSION = 'users.manage';

/**
 * Where an organization admin is placed.
 *
 * Note the direction, because it is the whole difference between this and the
 * rule it replaces. The old one read a department and decided a role from it,
 * matching on the department's **name**, which is what made renaming a
 * department an escalation. This reads a role and requires a department, by
 * **id** only.
 *
 * It exists because the product already insists on it elsewhere:
 * `userProfileService` moves any organization admin into Human Resources on
 * every profile request, while the approved-phone record puts them back where
 * the invite said. An admin invited anywhere else never settles — the two
 * writers disagree forever, costing a Firestore write and a fresh set of custom
 * claims on every request. Requiring it up front keeps the two in agreement.
 */
export const ORG_ADMIN_DEPARTMENT_ID = HUMAN_RESOURCES_DEPARTMENT_ID;

export interface OrgAdminGrantDecision {
  allowed: boolean;
  /** Plain wording for the refusal, or null when it is allowed. */
  reason: string | null;
}

export interface InviteRoleGrant {
  permissions: string[];
  role: SynzappRole;
  roleName: string;
}

export interface OrgAdminGrantInput {
  callerPermissions: string[];
  /** Where the invite places them. Compared by id, never by name. */
  departmentId?: string | null;
  /** The role as resolved by the caller's admin check, not the raw claim. */
  callerRole?: SynzappRole | null;
  /** Set when the caller is scoped to one department, which a real org admin never is. */
  callerScopeDepartmentId?: string | null;
}

/**
 * Whether this caller may grant organization admin on an invite.
 *
 * Four conditions, and all four have to hold. The scope check is the one that
 * closes the original escalation: the admin check hands back `ORG_ADMIN` for a
 * genuine organization admin with no scope, and `DEPT_ADMIN` with the
 * department attached for the fallback branch. A caller carrying a scope is a
 * department admin however their permissions read, so they are refused here
 * even if somebody later grants them `users.manage` by mistake.
 */
export function canGrantOrgAdminOnInvite(input: OrgAdminGrantInput): OrgAdminGrantDecision {
  // Scope first, so the commonest refusal says what is actually wrong rather
  // than the generic line below it.
  if (hasText(input.callerScopeDepartmentId)) {
    return {
      allowed: false,
      reason: 'A department admin cannot invite an organization admin.'
    };
  }

  if (input.callerRole !== 'ORG_ADMIN') {
    return {
      allowed: false,
      reason: 'Only an organization admin can invite another organization admin.'
    };
  }

  if (!input.callerPermissions.includes(ORG_ADMIN_GRANT_PERMISSION)) {
    return {
      allowed: false,
      reason: 'You do not have permission to invite an organization admin.'
    };
  }

  if (input.departmentId !== ORG_ADMIN_DEPARTMENT_ID) {
    return {
      allowed: false,
      reason: 'An organization admin is added to the Human Resources department.'
    };
  }

  return { allowed: true, reason: null };
}

export interface InviteRoleGrantInput {
  /** True only once `canGrantOrgAdminOnInvite` has allowed it. */
  grantOrgAdmin: boolean;
  tenantRoleName?: string | null;
  tenantRolePermissions?: string[] | null;
}

/**
 * What the invite writes onto the approved-phone record.
 *
 * An ordinary invite carries the selected role's own permissions, put through
 * `normalizeRolePermissions` on the way. That is defence in depth rather than
 * suspicion of the caller: role permissions are already checked against the
 * catalogue when they are saved, so anything outside it on a role document got
 * there some other way, and an invite is the wrong place to let it spread.
 *
 * A fresh invite never has department-admin permissions merged in — those are
 * added later, by their own service — so normalising here cannot strip a right
 * somebody already holds.
 */
export function resolveInviteRoleGrant(input: InviteRoleGrantInput): InviteRoleGrant {
  if (input.grantOrgAdmin) {
    return {
      permissions: [...ORG_ADMIN_PERMISSIONS],
      role: 'ORG_ADMIN',
      roleName: ORG_ADMIN_ROLE_NAME
    };
  }

  return {
    permissions: normalizeRolePermissions(input.tenantRolePermissions || []),
    role: 'EMPLOYEE',
    roleName: input.tenantRoleName?.trim() || 'Role'
  };
}

/**
 * Role names a tenant may not use, because something downstream reads them as
 * authority rather than as a label.
 *
 * `normalizeRailsTenantRole` turns a role *name* into a real role when the
 * stored role is missing or unrecognised, so a tenant role literally called
 * "Org Admin" is read as ORG_ADMIN when deciding who may approve a high-risk
 * RAILS loop. That is the same defect as the one this module replaces, one
 * level down. RAILS is a shipped feature and is not edited here, so the door is
 * shut on the side that creates the names instead.
 *
 * The normalisation deliberately matches the one RAILS applies, so the two
 * cannot drift into disagreeing about what a name means.
 */
const RESERVED_TENANT_ROLE_NAMES = [
  'organization admin',
  'org admin',
  'tenant admin',
  'department admin',
  'dept admin',
  // SYSTEM_ADMIN is the one worth noticing: nothing in the product assigns it,
  // yet it carries the same RAILS authority as an organization admin.
  'system admin'
];

export function isReservedTenantRoleName(name: string): boolean {
  const normalized = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  return RESERVED_TENANT_ROLE_NAMES.includes(normalized);
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
