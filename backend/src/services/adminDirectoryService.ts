import { DecodedIdToken } from 'firebase-admin/auth';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import { buildAuthSession } from './authSessionService.js';
import {
  buildDepartmentSystemGroupId,
  buildDepartmentSystemGroupRecord
} from './groupService.js';

interface CreateTenantRecordInput {
  description?: string;
  name: string;
}

interface TenantAdminContext {
  permissions: string[];
  role?: string;
  scopeDepartmentId?: string | null;
  tenantId: string;
  uid: string;
}

interface TenantDirectoryRecord {
  createdAt?: unknown;
  createdBy?: string;
  departmentId?: string;
  description?: string | null;
  name?: string;
  permissions?: string[];
  roleId?: string;
  slug?: string;
  status?: string;
  tenantId?: string;
  updatedAt?: unknown;
}

interface TenantUserRecord {
  departmentId?: string | null;
  role?: string;
  status?: string;
  tenantId?: string;
}

export interface TenantDepartmentResponse {
  departmentId: string;
  description: string | null;
  name: string;
  status: string;
  tenantId: string;
}

export interface TenantRoleResponse {
  description: string | null;
  name: string;
  permissions: string[];
  roleId: string;
  status: string;
  tenantId: string;
}

export async function listDepartments(decodedToken: DecodedIdToken): Promise<TenantDepartmentResponse[]> {
  const context = await requireOrgAdmin(decodedToken, 'departments.manage', 'users.invite');
  const snapshot = await firestore
    .collection('organizations')
    .doc(context.tenantId)
    .collection('departments')
    .orderBy('name')
    .get();

  return snapshot.docs
    .map((doc) => mapDepartment(doc.data() as TenantDirectoryRecord, doc.id))
    .filter((department) => (
      !context.scopeDepartmentId ||
      department.departmentId === context.scopeDepartmentId
    ));
}

export async function createDepartment(
  decodedToken: DecodedIdToken,
  input: CreateTenantRecordInput
): Promise<TenantDepartmentResponse> {
  const context = await requireOrgAdmin(decodedToken, 'departments.manage');
  const name = input.name.trim();
  const description = input.description?.trim() || null;
  const slug = slugifyName(name);
  const departmentId = `dept_${slug}`;
  const departmentRef = firestore
    .collection('organizations')
    .doc(context.tenantId)
    .collection('departments')
    .doc(departmentId);
  const organizationRef = firestore.collection('organizations').doc(context.tenantId);
  const groupRef = organizationRef
    .collection('groups')
    .doc(buildDepartmentSystemGroupId(departmentId));

  await firestore.runTransaction(async (transaction) => {
    const [snapshot, groupSnapshot] = await Promise.all([
      transaction.get(departmentRef),
      transaction.get(groupRef)
    ]);

    if (snapshot.exists) {
      throw conflictError('This department already exists.');
    }

    if (groupSnapshot.exists) {
      throw conflictError('This department group already exists.');
    }

    transaction.set(departmentRef, {
      createdAt: fieldValue.serverTimestamp(),
      createdBy: context.uid,
      departmentId,
      description,
      name,
      slug,
      status: 'ACTIVE',
      tenantId: context.tenantId,
      updatedAt: fieldValue.serverTimestamp()
    });
    transaction.set(groupRef, buildDepartmentSystemGroupRecord({
      createdBy: context.uid,
      departmentId,
      departmentName: name,
      description,
      tenantId: context.tenantId
    }));
  });

  return {
    departmentId,
    description,
    name,
    status: 'ACTIVE',
    tenantId: context.tenantId
  };
}

export async function listRoles(decodedToken: DecodedIdToken): Promise<TenantRoleResponse[]> {
  const context = await requireOrgAdmin(decodedToken, 'roles.manage', 'users.invite');
  const snapshot = await firestore
    .collection('organizations')
    .doc(context.tenantId)
    .collection('roles')
    .orderBy('name')
    .get();

  return snapshot.docs.map((doc) => mapRole(doc.data() as TenantDirectoryRecord, doc.id));
}

export async function createRole(
  decodedToken: DecodedIdToken,
  input: CreateTenantRecordInput
): Promise<TenantRoleResponse> {
  const context = await requireOrgAdmin(decodedToken, 'roles.manage');
  const name = input.name.trim();
  const description = input.description?.trim() || null;
  const slug = slugifyName(name);
  const roleId = `role_${slug}`;
  const roleRef = firestore
    .collection('organizations')
    .doc(context.tenantId)
    .collection('roles')
    .doc(roleId);

  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(roleRef);

    if (snapshot.exists) {
      throw conflictError('This role already exists.');
    }

    transaction.set(roleRef, {
      createdAt: fieldValue.serverTimestamp(),
      createdBy: context.uid,
      description,
      name,
      permissions: [],
      roleId,
      slug,
      status: 'ACTIVE',
      tenantId: context.tenantId,
      updatedAt: fieldValue.serverTimestamp()
    });
  });

  return {
    description,
    name,
    permissions: [],
    roleId,
    status: 'ACTIVE',
    tenantId: context.tenantId
  };
}

async function requireOrgAdmin(
  decodedToken: DecodedIdToken,
  permission: 'departments.manage' | 'roles.manage',
  fallbackPermission?: 'users.invite'
): Promise<TenantAdminContext> {
  const session = await buildAuthSession(decodedToken);
  const { permissions, role, status, tenantId } = session.user;

  if (session.access !== 'ACTIVE' || !tenantId || status !== 'ACTIVE') {
    throw authorizationError('Your admin session is not active.');
  }

  const hasPermission = permissions.includes(permission) ||
    Boolean(fallbackPermission && permissions.includes(fallbackPermission));

  if (!hasPermission) {
    throw authorizationError('You do not have permission to manage this setting.');
  }

  if (role === 'ORG_ADMIN') {
    return {
      permissions,
      role,
      scopeDepartmentId: null,
      tenantId,
      uid: decodedToken.uid
    };
  }

  if (role === 'DEPT_ADMIN' && fallbackPermission === 'users.invite') {
    const userSnapshot = await firestore
      .collection('organizations')
      .doc(tenantId)
      .collection('users')
      .doc(decodedToken.uid)
      .get();

    if (!userSnapshot.exists) {
      throw authorizationError('Your department admin profile is not active.');
    }

    const user = userSnapshot.data() as TenantUserRecord;

    if (
      user.tenantId !== tenantId ||
      user.status !== 'ACTIVE' ||
      user.role !== 'DEPT_ADMIN' ||
      !user.departmentId
    ) {
      throw authorizationError('Your department admin profile is not active.');
    }

    return {
      permissions,
      role,
      scopeDepartmentId: user.departmentId,
      tenantId,
      uid: decodedToken.uid
    };
  }

  throw authorizationError('You do not have permission to manage this setting.');
}

function mapDepartment(record: TenantDirectoryRecord, fallbackId: string): TenantDepartmentResponse {
  return {
    departmentId: record.departmentId || fallbackId,
    description: record.description || null,
    name: record.name || 'Untitled department',
    status: record.status || 'ACTIVE',
    tenantId: record.tenantId || ''
  };
}

function mapRole(record: TenantDirectoryRecord, fallbackId: string): TenantRoleResponse {
  return {
    description: record.description || null,
    name: record.name || 'Untitled role',
    permissions: record.permissions || [],
    roleId: record.roleId || fallbackId,
    status: record.status || 'ACTIVE',
    tenantId: record.tenantId || ''
  };
}

function slugifyName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

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
