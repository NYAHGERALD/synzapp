import { randomUUID } from 'node:crypto';
import { DecodedIdToken } from 'firebase-admin/auth';
import type { DocumentReference } from 'firebase-admin/firestore';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import { SynzappRole } from '../types/auth.js';
import {
  canDepartmentAdminUseScopedPermission,
  canOrgAdminUsePermission,
  isActiveTenantSession
} from './authorizationPolicy.js';
import { buildAuthSession } from './authSessionService.js';

interface CreateTenantGroupInput {
  departmentId?: string | null;
  description?: string;
  name: string;
}

interface TenantGroupAdminContext {
  departmentId?: string | null;
  permissions: string[];
  role: SynzappRole;
  tenantId: string;
  uid: string;
}

interface TenantDepartmentRecord {
  departmentId?: string;
  name?: string;
  status?: string;
  tenantId?: string;
}

interface TenantGroupRecord {
  autoMembershipDepartmentId?: string | null;
  createdAt?: unknown;
  createdBy?: string;
  departmentId?: string | null;
  departmentName?: string | null;
  description?: string | null;
  groupId?: string;
  isDepartmentDefault?: boolean;
  memberCount?: number;
  memberPolicy?: TenantGroupMemberPolicy;
  name?: string;
  scope?: TenantGroupScope;
  status?: string;
  systemManaged?: boolean;
  tenantId?: string;
}

interface TenantUserRecord {
  departmentId?: string | null;
  role?: SynzappRole;
  status?: string;
  tenantId?: string;
}

export type TenantGroupScope = 'COMPANY' | 'DEPARTMENT';
export type TenantGroupMemberPolicy = 'DEPARTMENT_PLUS_EXPLICIT' | 'EXPLICIT';

export interface TenantGroupResponse {
  autoMembershipDepartmentId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  description: string | null;
  groupId: string;
  isDepartmentDefault: boolean;
  memberCount: number;
  memberPolicy: TenantGroupMemberPolicy;
  name: string;
  scope: TenantGroupScope;
  status: string;
  systemManaged: boolean;
  tenantId: string;
}

export interface TenantGroupCreateResult {
  group: TenantGroupResponse;
  tenantId: string;
}

export async function listTenantGroups(decodedToken: DecodedIdToken): Promise<TenantGroupResponse[]> {
  const context = await requireGroupAdmin(decodedToken);
  await ensureDepartmentSystemGroupsForContext(context);
  const snapshot = await firestore
    .collection('organizations')
    .doc(context.tenantId)
    .collection('groups')
    .orderBy('name')
    .get();

  const visibleGroups = snapshot.docs
    .map((doc) => mapTenantGroup(doc.data() as TenantGroupRecord, doc.id))
    .filter((group) => (
      context.role === 'ORG_ADMIN' ||
      group.departmentId === context.departmentId
    ));

  return Promise.all(visibleGroups.map((group) => hydrateTenantGroupMemberCount(context.tenantId, group)));
}

export async function listCurrentUserGroups(decodedToken: DecodedIdToken): Promise<TenantGroupResponse[]> {
  const context = await requireGroupViewer(decodedToken);
  await ensureDepartmentSystemGroupsForContext(context);
  const snapshot = await firestore
    .collection('organizations')
    .doc(context.tenantId)
    .collection('groups')
    .orderBy('name')
    .get();
  const visibleGroups: TenantGroupResponse[] = [];

  for (const doc of snapshot.docs) {
    const group = mapTenantGroup(doc.data() as TenantGroupRecord, doc.id);

    if (group.status !== 'ACTIVE') {
      continue;
    }

    if (await isGroupVisibleToUser(context, group, doc.ref)) {
      visibleGroups.push(group);
    }
  }

  return Promise.all(visibleGroups.map((group) => hydrateTenantGroupMemberCount(context.tenantId, group)));
}

export async function createTenantGroup(
  decodedToken: DecodedIdToken,
  input: CreateTenantGroupInput
): Promise<TenantGroupCreateResult> {
  const context = await requireGroupAdmin(decodedToken);
  const name = input.name.trim();
  const description = input.description?.trim() || null;
  const requestedDepartmentId = input.departmentId?.trim() || null;
  const departmentId = context.role === 'DEPT_ADMIN'
    ? context.departmentId || null
    : requestedDepartmentId;
  const scope: TenantGroupScope = departmentId ? 'DEPARTMENT' : 'COMPANY';
  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const departmentRef = departmentId
    ? organizationRef.collection('departments').doc(departmentId)
    : null;
  const groupId = buildGroupId(scope, departmentId, name);
  const groupRef = organizationRef.collection('groups').doc(groupId);
  let departmentName: string | null = null;

  if (context.role === 'DEPT_ADMIN' && requestedDepartmentId && requestedDepartmentId !== context.departmentId) {
    throw authorizationError('Department Admins can create groups only for their assigned department.');
  }

  await firestore.runTransaction(async (transaction) => {
    const [groupSnapshot, departmentSnapshot] = await Promise.all([
      transaction.get(groupRef),
      departmentRef ? transaction.get(departmentRef) : Promise.resolve(null)
    ]);

    if (groupSnapshot.exists) {
      throw conflictError('This group already exists.');
    }

    if (departmentRef) {
      if (!departmentSnapshot?.exists) {
        throw validationError('Select an active department before creating a group.');
      }

      const department = departmentSnapshot.data() as TenantDepartmentRecord;

      if (department.tenantId !== context.tenantId || department.status !== 'ACTIVE') {
        throw validationError('Select an active department before creating a group.');
      }

      departmentName = department.name || 'Department';
    }

	    transaction.set(groupRef, {
      autoMembershipDepartmentId: null,
      createdAt: fieldValue.serverTimestamp(),
      createdBy: context.uid,
      departmentId,
      departmentName,
      description,
      groupId,
      isDepartmentDefault: false,
      memberCount: 1,
      memberPolicy: 'EXPLICIT',
      name,
      scope,
      status: 'ACTIVE',
      systemManaged: false,
      tenantId: context.tenantId,
      updatedAt: fieldValue.serverTimestamp()
    });
    transaction.set(groupRef.collection('members').doc(context.uid), {
      addedAt: fieldValue.serverTimestamp(),
      addedBy: context.uid,
      role: 'OWNER',
      status: 'ACTIVE',
      tenantId: context.tenantId,
      uid: context.uid
    });
  });

	  return {
	    group: {
      autoMembershipDepartmentId: null,
	      departmentId,
	      departmentName,
	      description,
	      groupId,
      isDepartmentDefault: false,
	      memberCount: 1,
      memberPolicy: 'EXPLICIT',
	      name,
	      scope,
	      status: 'ACTIVE',
      systemManaged: false,
	      tenantId: context.tenantId
	    },
    tenantId: context.tenantId
  };
}

export function buildDepartmentSystemGroupId(departmentId: string): string {
  return `group_department_${safeIdPart(departmentId)}`;
}

export function buildDepartmentSystemGroupRecord(input: {
  createdBy: string;
  departmentId: string;
  departmentName: string;
  description?: string | null;
  tenantId: string;
}): Record<string, unknown> {
  const groupId = buildDepartmentSystemGroupId(input.departmentId);

  return {
    autoMembershipDepartmentId: input.departmentId,
    createdAt: fieldValue.serverTimestamp(),
    createdBy: input.createdBy,
    createdReason: 'DEPARTMENT_CREATED',
    departmentId: input.departmentId,
    departmentName: input.departmentName,
    description: input.description || `${input.departmentName} department group`,
    groupId,
    isDepartmentDefault: true,
    memberCount: 0,
    memberPolicy: 'DEPARTMENT_PLUS_EXPLICIT',
    name: input.departmentName,
    scope: 'DEPARTMENT',
    status: 'ACTIVE',
    systemManaged: true,
    tenantId: input.tenantId,
    updatedAt: fieldValue.serverTimestamp()
  };
}

async function requireGroupAdmin(decodedToken: DecodedIdToken): Promise<TenantGroupAdminContext> {
  const session = await buildAuthSession(decodedToken);
  const { permissions, role, status, tenantId } = session.user;
  const policyInput = {
    access: session.access,
    permissions,
    role,
    status,
    tenantId
  };

  if (!isActiveTenantSession(policyInput)) {
    throw authorizationError('Your admin session is not active.');
  }

  const activeTenantId = tenantId as string;

  if (canOrgAdminUsePermission(policyInput, 'groups.manage')) {
    return {
      permissions,
      role: 'ORG_ADMIN',
      tenantId: activeTenantId,
      uid: decodedToken.uid
    };
  }

  if (role === 'DEPT_ADMIN' && permissions.includes('groups.create')) {
    const userSnapshot = await firestore
      .collection('organizations')
      .doc(activeTenantId)
      .collection('users')
      .doc(decodedToken.uid)
      .get();

    if (!userSnapshot.exists) {
      throw authorizationError('Your department admin profile is not active.');
    }

    const user = userSnapshot.data() as TenantUserRecord;

    if (
      user.tenantId !== activeTenantId ||
      user.status !== 'ACTIVE' ||
      user.role !== 'DEPT_ADMIN' ||
      !user.departmentId
    ) {
      throw authorizationError('Your department admin profile is not active.');
    }

    const canCreateDepartmentGroups = canDepartmentAdminUseScopedPermission(
      {
        ...policyInput,
        resourceDepartmentId: user.departmentId,
        userDepartmentId: user.departmentId
      },
      'groups.create'
    );

    if (!canCreateDepartmentGroups) {
      throw authorizationError('You do not have permission to manage groups.');
    }

    return {
      departmentId: user.departmentId,
      permissions,
      role,
      tenantId: activeTenantId,
      uid: decodedToken.uid
    };
  }

  throw authorizationError('You do not have permission to manage groups.');
}

async function requireGroupViewer(decodedToken: DecodedIdToken): Promise<TenantGroupAdminContext> {
  const session = await buildAuthSession(decodedToken);
  const { permissions, role, status, tenantId } = session.user;
  const policyInput = {
    access: session.access,
    permissions,
    role,
    status,
    tenantId
  };

  if (!isActiveTenantSession(policyInput) || !role || !tenantId) {
    throw authorizationError('Your profile is not active.');
  }

  const userSnapshot = await firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('users')
    .doc(decodedToken.uid)
    .get();

  if (!userSnapshot.exists) {
    throw authorizationError('Your profile is not active.');
  }

  const user = userSnapshot.data() as TenantUserRecord;

  if (
    user.tenantId !== tenantId ||
    user.status !== 'ACTIVE' ||
    !user.role
  ) {
    throw authorizationError('Your profile is not active.');
  }

  return {
    departmentId: user.departmentId || null,
    permissions,
    role: user.role,
    tenantId,
    uid: decodedToken.uid
  };
}

async function isGroupVisibleToUser(
  context: TenantGroupAdminContext,
  group: TenantGroupResponse,
  groupRef: DocumentReference
): Promise<boolean> {
  if (context.role === 'ORG_ADMIN') {
    return true;
  }

  if (
    group.memberPolicy === 'DEPARTMENT_PLUS_EXPLICIT' &&
    group.autoMembershipDepartmentId &&
    context.departmentId === group.autoMembershipDepartmentId
  ) {
    return true;
  }

  const memberSnapshot = await groupRef.collection('members').doc(context.uid).get();

  if (!memberSnapshot.exists) {
    return false;
  }

  const member = memberSnapshot.data() as { status?: string; tenantId?: string };

  return member.tenantId === context.tenantId && member.status === 'ACTIVE';
}

async function hydrateTenantGroupMemberCount(
  tenantId: string,
  group: TenantGroupResponse
): Promise<TenantGroupResponse> {
  if (!group.autoMembershipDepartmentId || group.memberPolicy !== 'DEPARTMENT_PLUS_EXPLICIT') {
    return group;
  }

  const [departmentUsersSnapshot, explicitMembersSnapshot] = await Promise.all([
    firestore
      .collection('organizations')
      .doc(tenantId)
      .collection('users')
      .where('status', '==', 'ACTIVE')
      .where('departmentId', '==', group.autoMembershipDepartmentId)
      .get(),
    firestore
      .collection('organizations')
      .doc(tenantId)
      .collection('groups')
      .doc(group.groupId)
      .collection('members')
      .where('status', '==', 'ACTIVE')
      .get()
  ]);
  const memberIds = new Set<string>();

  departmentUsersSnapshot.docs.forEach((doc) => memberIds.add(doc.id));
  explicitMembersSnapshot.docs.forEach((doc) => memberIds.add(doc.id));

  return {
    ...group,
    memberCount: memberIds.size
  };
}

async function ensureDepartmentSystemGroupsForContext(context: TenantGroupAdminContext): Promise<void> {
  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const departmentDocs = context.role === 'ORG_ADMIN'
    ? (await organizationRef.collection('departments').where('status', '==', 'ACTIVE').get()).docs
    : context.departmentId
      ? await firestore.getAll(organizationRef.collection('departments').doc(context.departmentId))
      : [];
  const activeDepartments = departmentDocs
    .filter((doc) => doc.exists)
    .map((doc) => doc.data() as TenantDepartmentRecord)
    .filter((department) => (
      department.tenantId === context.tenantId &&
      department.status === 'ACTIVE' &&
      Boolean(department.departmentId && department.name)
    ));

  if (!activeDepartments.length) {
    return;
  }

  const groupRefs = activeDepartments.map((department) =>
    organizationRef
      .collection('groups')
      .doc(buildDepartmentSystemGroupId(department.departmentId || ''))
  );
  const groupSnapshots = await Promise.all(groupRefs.map((groupRef) => groupRef.get()));
  const missingGroups = groupSnapshots
    .map((snapshot, index) => ({
      department: activeDepartments[index],
      ref: groupRefs[index],
      snapshot
    }))
    .filter(({ snapshot }) => !snapshot.exists);

  for (let index = 0; index < missingGroups.length; index += 450) {
    const batch = firestore.batch();
    const batchGroups = missingGroups.slice(index, index + 450);

    batchGroups.forEach(({ department, ref }) => {
      batch.set(ref, buildDepartmentSystemGroupRecord({
        createdBy: context.uid,
        departmentId: department.departmentId || '',
        departmentName: department.name || 'Department',
        tenantId: context.tenantId
      }));
    });

    await batch.commit();
  }
}

function mapTenantGroup(record: TenantGroupRecord, fallbackId: string): TenantGroupResponse {
  return {
    autoMembershipDepartmentId: record.autoMembershipDepartmentId || null,
    departmentId: record.departmentId || null,
    departmentName: record.departmentName || null,
    description: record.description || null,
    groupId: record.groupId || fallbackId,
    isDepartmentDefault: record.isDepartmentDefault === true,
    memberCount: record.memberCount || 0,
    memberPolicy: record.memberPolicy || 'EXPLICIT',
    name: record.name || 'Untitled group',
    scope: record.scope || 'COMPANY',
    status: record.status || 'ACTIVE',
    systemManaged: record.systemManaged === true,
    tenantId: record.tenantId || ''
  };
}

function buildGroupId(scope: TenantGroupScope, departmentId: string | null, name: string): string {
  const scopePart = scope === 'DEPARTMENT' && departmentId
    ? `dept_${safeIdPart(departmentId)}`
    : 'company';
  const slug = slugifyName(name);

  return `group_${scopePart}_${slug}`.slice(0, 140) || `group_${randomUUID().replace(/-/g, '')}`;
}

function safeIdPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .slice(0, 60) || 'department';
}

function slugifyName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return slug || `item-${Date.now()}`;
}

function authorizationError(message: string): Error {
  const error = new Error(message);
  error.name = 'AuthorizationError';
  return error;
}

function conflictError(message: string): Error {
  const error = new Error(message);
  error.name = 'ConflictError';
  return error;
}

function validationError(message: string): Error {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
}
