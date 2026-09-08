import { SessionAccess, SynzappRole, SynzappUserStatus } from '../types/auth.js';

export interface ActiveSessionPolicyInput {
  access?: SessionAccess | string;
  permissions?: string[];
  role?: SynzappRole | string;
  status?: SynzappUserStatus | string;
  tenantId?: string | null;
}

export interface TenantResourcePolicyInput extends ActiveSessionPolicyInput {
  resourceTenantId?: string | null;
}

export interface DepartmentScopedPolicyInput extends TenantResourcePolicyInput {
  resourceDepartmentId?: string | null;
  userDepartmentId?: string | null;
}

export interface DirectChatPolicyInput extends TenantResourcePolicyInput {
  participantIds?: string[];
  requesterUid?: string | null;
}

export interface DirectEnvelopePolicyInput extends DirectChatPolicyInput {
  recipientUid?: string | null;
  senderUid?: string | null;
}

export interface GroupChatPolicyInput extends TenantResourcePolicyInput {
  memberIds?: string[];
  requesterUid?: string | null;
}

export interface GroupEnvelopePolicyInput extends GroupChatPolicyInput {
  recipientUids?: string[];
  senderUid?: string | null;
}

export type AnnouncementAudienceKind = 'ORGANIZATION' | 'DEPARTMENT' | 'GROUP' | 'PERSON';

export interface AnnouncementPolicyInput extends TenantResourcePolicyInput {
  audienceKind: AnnouncementAudienceKind;
  /** For a department audience, or the department a targeted group sits in. */
  audienceDepartmentId?: string | null;
  /** Members of the targeted group, when the audience is a group. */
  groupMemberIds?: string[];
  requesterUid?: string | null;
  userDepartmentId?: string | null;
}

export interface OwnResourcePolicyInput extends TenantResourcePolicyInput {
  ownerUid?: string | null;
  requesterUid?: string | null;
}

export function isActiveTenantSession(input: ActiveSessionPolicyInput): boolean {
  return (
    input.access === 'ACTIVE' &&
    input.status === 'ACTIVE' &&
    hasText(input.tenantId) &&
    isKnownRole(input.role)
  );
}

export function canAccessTenantResource(input: TenantResourcePolicyInput): boolean {
  return (
    isActiveTenantSession(input) &&
    hasText(input.resourceTenantId) &&
    input.tenantId === input.resourceTenantId
  );
}

export function canOrgAdminUsePermission(
  input: TenantResourcePolicyInput,
  permission: string
): boolean {
  return (
    canAccessTenantResource(defaultResourceTenant(input)) &&
    input.role === 'ORG_ADMIN' &&
    hasPermission(input.permissions, permission)
  );
}

export function canDepartmentAdminUseScopedPermission(
  input: DepartmentScopedPolicyInput,
  permission: string
): boolean {
  return (
    canAccessTenantResource(defaultResourceTenant(input)) &&
    input.role === 'DEPT_ADMIN' &&
    hasPermission(input.permissions, permission) &&
    hasText(input.userDepartmentId) &&
    hasText(input.resourceDepartmentId) &&
    input.userDepartmentId === input.resourceDepartmentId
  );
}

export function canManageTenantGroup(input: DepartmentScopedPolicyInput): boolean {
  return (
    canOrgAdminUsePermission(input, 'groups.manage') ||
    canDepartmentAdminUseScopedPermission(input, 'groups.create')
  );
}

export function canInviteEmployeeToDepartment(input: DepartmentScopedPolicyInput): boolean {
  return (
    canOrgAdminUsePermission(input, 'users.invite') ||
    canOrgAdminUsePermission(input, 'users.manage') ||
    canDepartmentAdminUseScopedPermission(input, 'users.invite')
  );
}

export function canViewDepartmentEmployees(input: DepartmentScopedPolicyInput): boolean {
  return (
    canOrgAdminUsePermission(input, 'users.manage') ||
    canOrgAdminUsePermission(input, 'users.invite') ||
    canDepartmentAdminUseScopedPermission(input, 'users.invite')
  );
}

export function canAccessOwnResource(input: OwnResourcePolicyInput): boolean {
  return (
    canAccessTenantResource(defaultResourceTenant(input)) &&
    hasText(input.requesterUid) &&
    hasText(input.ownerUid) &&
    input.requesterUid === input.ownerUid
  );
}

export function canReadDirectChat(input: DirectChatPolicyInput): boolean {
  return (
    canAccessTenantResource(defaultResourceTenant(input)) &&
    hasText(input.requesterUid) &&
    Array.isArray(input.participantIds) &&
    input.participantIds.includes(input.requesterUid)
  );
}

export function canReadDirectEnvelope(input: DirectEnvelopePolicyInput): boolean {
  return (
    canReadDirectChat(input) &&
    hasText(input.requesterUid) &&
    (
      input.senderUid === input.requesterUid ||
      input.recipientUid === input.requesterUid
    )
  );
}

export function canReadGroupChat(input: GroupChatPolicyInput): boolean {
  return (
    canAccessTenantResource(defaultResourceTenant(input)) &&
    hasText(input.requesterUid) &&
    Array.isArray(input.memberIds) &&
    input.memberIds.includes(input.requesterUid)
  );
}

export function canReadGroupEnvelope(input: GroupEnvelopePolicyInput): boolean {
  return (
    canReadGroupChat(input) &&
    hasText(input.requesterUid) &&
    (
      input.senderUid === input.requesterUid ||
      Boolean(input.recipientUids?.includes(input.requesterUid))
    )
  );
}

function defaultResourceTenant<T extends TenantResourcePolicyInput>(input: T): T {
  if (hasText(input.resourceTenantId)) {
    return input;
  }

  return {
    ...input,
    resourceTenantId: input.tenantId
  };
}

function hasPermission(permissions: string[] | undefined, permission: string): boolean {
  return Boolean(permissions?.includes(permission));
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isKnownRole(role: string | null | undefined): role is SynzappRole {
  return (
    role === 'ORG_ADMIN' ||
    role === 'DEPT_ADMIN' ||
    role === 'EMPLOYEE' ||
    role === 'SYSTEM_ADMIN'
  );
}

/**
 * Who may send an announcement, and how widely.
 *
 * Authority comes from the session. Nothing here reads anything the caller
 * sent, because a permission check that trusts the client is decoration.
 *
 * An Org Admin is authorised by role rather than by a granted permission: they
 * own the organization, and requiring them to grant themselves a permission to
 * address their own staff would be a trap nobody would find until it bit them.
 *
 * Everyone else needs a grant, and reaches only as far as their scope:
 * a department admin their own department, and a person trusted to form a group
 * only the groups they are actually in. Trusting somebody to form a team is not
 * the same as trusting them to address the company.
 */
export function canSendAnnouncement(input: AnnouncementPolicyInput): boolean {
  const scoped = defaultResourceTenant(input);

  if (!canAccessTenantResource(scoped)) {
    return false;
  }

  const isOrgAdmin = input.role === 'ORG_ADMIN';

  if (input.audienceKind === 'ORGANIZATION') {
    return isOrgAdmin;
  }

  if (isOrgAdmin) {
    return true;
  }

  const sameDepartment = hasText(input.userDepartmentId) &&
    hasText(input.audienceDepartmentId) &&
    input.userDepartmentId === input.audienceDepartmentId;

  if (input.audienceKind === 'DEPARTMENT') {
    return (
      input.role === 'DEPT_ADMIN' &&
      hasPermission(input.permissions, 'announcements.send') &&
      sameDepartment
    );
  }

  // One named person. A department admin may address somebody in their own
  // department; nobody else may single an individual out. Somebody trusted to
  // run a group addresses the group, which is a different act: a notice to one
  // person, demanding a signature, is a management conversation and belongs to
  // whoever manages them.
  if (input.audienceKind === 'PERSON') {
    return (
      input.role === 'DEPT_ADMIN' &&
      hasPermission(input.permissions, 'announcements.send') &&
      sameDepartment
    );
  }

  // A group. A department admin reaches groups inside their own department.
  if (
    input.role === 'DEPT_ADMIN' &&
    hasPermission(input.permissions, 'announcements.send') &&
    hasText(input.userDepartmentId) &&
    hasText(input.audienceDepartmentId) &&
    input.userDepartmentId === input.audienceDepartmentId
  ) {
    return true;
  }

  // Anyone else must be a member of that very group, and hold a grant. The
  // group-creation grant counts: forming a team implies addressing it.
  const isMember = !!input.requesterUid &&
    (input.groupMemberIds || []).includes(input.requesterUid);

  return isMember && (
    hasPermission(input.permissions, 'announcements.send') ||
    hasPermission(input.permissions, 'groups.create')
  );
}

export interface ActionPolicyInput extends TenantResourcePolicyInput {
  /** Members of the group the action is assigned to. */
  responsibleGroupMemberIds?: string[];
  /** The department the responsible group sits in, when it has one. */
  responsibleDepartmentId?: string | null;
  requesterUid?: string | null;
  userDepartmentId?: string | null;
}

export interface ActionCancelPolicyInput extends ActionPolicyInput {
  /** Who raised the action. May withdraw it, but only before work starts. */
  createdByUid?: string | null;
  /** Who is answerable for it. May never cancel it alone. */
  responsiblePersonUid?: string | null;
  /** The department the action was raised from. */
  sourceDepartmentId?: string | null;
  /**
   * Where the action currently stands.
   *
   * Named apart from `status`, which this interface inherits and which means
   * the *person's* employment status. Reusing that name would have had the
   * policy read "ACTIVE employee" as "action state", and an active employee's
   * action would never have looked verified.
   */
  actionStatus?: string | null;
}

export interface ActionVerifyPolicyInput extends ActionPolicyInput {
  /** Who marked it done. Never allowed to verify their own work. */
  completedByUid?: string | null;
  /** Who raised the action in the first place. */
  createdByUid?: string | null;
  /** The department the action was raised from. */
  sourceDepartmentId?: string | null;
}

/**
 * Who may turn a message into an action.
 *
 * Deliberately broad: anybody with an active session in the organization. The
 * person who spots a problem is usually the person with the least authority,
 * and a permission gate here would mean the fault goes unreported. Assignment
 * is not restricted either, because the operator who sees a leak does not know
 * the org chart and a misrouted action beats a silent one.
 */
export function canCreateAction(input: ActionPolicyInput): boolean {
  return canAccessTenantResource(defaultResourceTenant(input));
}

/**
 * Who may move an action along.
 *
 * Narrower than creating one. Work is claimed and closed by the people who own
 * it, so this is the responsible group, that group's department admin, or an
 * Org Admin. Otherwise anybody in the company could close somebody else's job.
 */
export function canChangeActionStatus(input: ActionPolicyInput): boolean {
  const scoped = defaultResourceTenant(input);

  if (!canAccessTenantResource(scoped)) {
    return false;
  }

  if (input.role === 'ORG_ADMIN') {
    return true;
  }

  const isMember = !!input.requesterUid &&
    (input.responsibleGroupMemberIds || []).includes(input.requesterUid);

  if (isMember) {
    return true;
  }

  return (
    input.role === 'DEPT_ADMIN' &&
    hasText(input.userDepartmentId) &&
    hasText(input.responsibleDepartmentId) &&
    input.userDepartmentId === input.responsibleDepartmentId
  );
}

/**
 * Who may verify that a completed action is genuinely done.
 *
 * **The person who marked it done may never verify it**, whatever else they
 * hold. That single rule is what separates a record from a decoration: if the
 * doer can sign off their own work, verification proves only that somebody
 * tapped a button twice. It is checked first, before any grant is considered.
 *
 * Otherwise: the person who raised it, an Org Admin, the department admin of
 * the department it was raised from, or a holder of `actions.verify`.
 */
export function canVerifyAction(input: ActionVerifyPolicyInput): boolean {
  const scoped = defaultResourceTenant(input);

  if (!canAccessTenantResource(scoped)) {
    return false;
  }

  // Checked before anything else, so no role or grant can override it.
  if (
    hasText(input.completedByUid) &&
    hasText(input.requesterUid) &&
    input.completedByUid === input.requesterUid
  ) {
    return false;
  }

  if (
    hasText(input.createdByUid) &&
    hasText(input.requesterUid) &&
    input.createdByUid === input.requesterUid
  ) {
    return true;
  }

  if (input.role === 'ORG_ADMIN') {
    return true;
  }

  if (
    input.role === 'DEPT_ADMIN' &&
    hasText(input.userDepartmentId) &&
    hasText(input.sourceDepartmentId) &&
    input.userDepartmentId === input.sourceDepartmentId
  ) {
    return true;
  }

  return hasPermission(input.permissions, 'actions.verify');
}

/**
 * Who may cancel an action, and why not when they may not.
 *
 * Cancelling is not deleting. The action leaves the active list and stays in
 * the record with who ended it and why, because the record is what an auditor
 * asks for. See section 4 of SYNZAPP_ACTIONS_GOVERNANCE_PLAN.md.
 *
 * **The person answerable for an action may never cancel it alone**, checked
 * before any role or grant. That is the rule the whole feature rests on: the
 * only person with a motive to make the record disappear must not be the one
 * who can. They may ask; somebody else decides. It sits beside the matching
 * rule in `canVerifyAction`, where the doer may never sign off their own work.
 *
 * A verified action cannot be cancelled by anybody, including an Org Admin. It
 * has been checked by a second person, and unpicking that is a records change
 * rather than an operational one.
 *
 * The reason is returned rather than a bare false so a refusal can be shown to
 * the person instead of leaving them stuck at a button that does nothing.
 */
export function canCancelAction(
  input: ActionCancelPolicyInput
): { allowed: boolean; reason: string | null } {
  if (!canAccessTenantResource(defaultResourceTenant(input))) {
    return { allowed: false, reason: 'You do not have access to this action.' };
  }

  if (input.actionStatus === 'CANCELLED') {
    return { allowed: false, reason: 'This action has already been cancelled.' };
  }

  if (input.actionStatus === 'VERIFIED') {
    return {
      allowed: false,
      reason: 'A verified action cannot be cancelled. Raise a new action instead.'
    };
  }

  // Before any role or grant, so nothing below can override it.
  if (
    hasText(input.responsiblePersonUid) &&
    hasText(input.requesterUid) &&
    input.responsiblePersonUid === input.requesterUid
  ) {
    return {
      allowed: false,
      reason: 'The person responsible for an action cannot cancel it. Ask a department administrator.'
    };
  }

  if (input.role === 'ORG_ADMIN') {
    return { allowed: true, reason: null };
  }

  if (input.role === 'DEPT_ADMIN' && isActionInUserDepartment(input)) {
    return { allowed: true, reason: null };
  }

  // The wrong chat, or a duplicate, caught before anybody started on it. Once
  // work has begun the person who raised it no longer decides alone either.
  if (
    hasText(input.createdByUid) &&
    hasText(input.requesterUid) &&
    input.createdByUid === input.requesterUid &&
    input.actionStatus === 'OPEN'
  ) {
    return { allowed: true, reason: null };
  }

  return { allowed: false, reason: 'You do not have permission to cancel this action.' };
}

/** A department admin owns both the work their department raised and what it owes. */
function isActionInUserDepartment(input: ActionCancelPolicyInput): boolean {
  if (!hasText(input.userDepartmentId)) {
    return false;
  }

  return input.userDepartmentId === input.sourceDepartmentId ||
    input.userDepartmentId === input.responsibleDepartmentId;
}
