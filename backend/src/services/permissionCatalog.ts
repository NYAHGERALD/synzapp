export interface PermissionCatalogItem {
  description: string;
  permission: string;
  title: string;
}

export const ORG_ADMIN_PERMISSIONS = [
  'tenant.read',
  'tenant.update',
  'users.invite',
  'users.manage',
  'departments.manage',
  'roles.manage',
  'groups.manage',
  'audit.read',
  'security.manage'
];

export const ROLE_PERMISSION_CATALOG: PermissionCatalogItem[] = [
  {
    description: 'Create department-scoped chat groups where allowed by role and scope.',
    permission: 'groups.create',
    title: 'Create groups'
  },
  {
    description: 'Send announcements where allowed by role and scope.',
    permission: 'announcements.send',
    title: 'Send announcements'
  },
  {
    description: 'Create work orders where allowed by role and scope.',
    permission: 'work_orders.create',
    title: 'Create work orders'
  },
  {
    description: 'Create action plans where allowed by role and scope.',
    permission: 'action_plans.create',
    title: 'Create action plans'
  },
  {
    description: 'View department-level activity where allowed by role and scope.',
    permission: 'department.activity.read',
    title: 'View department activity'
  }
];

export const DEPARTMENT_ADMIN_PERMISSION_CATALOG: PermissionCatalogItem[] = [
  {
    description: 'Add approved employees only inside the assigned department.',
    permission: 'users.invite',
    title: 'Invite employees'
  },
  {
    description: 'Create department-scoped chat groups for the assigned department.',
    permission: 'groups.create',
    title: 'Create department groups'
  },
  {
    description: 'Send announcements to the assigned department.',
    permission: 'announcements.send',
    title: 'Send department announcements'
  },
  {
    description: 'Create work orders for the assigned department.',
    permission: 'work_orders.create',
    title: 'Create work orders'
  },
  {
    description: 'Create action plans for the assigned department.',
    permission: 'action_plans.create',
    title: 'Create action plans'
  },
  {
    description: 'View department-level activity for the assigned department.',
    permission: 'department.activity.read',
    title: 'View department activity'
  }
];

export const DEPARTMENT_ADMIN_DEFAULT_PERMISSIONS = [
  'users.invite',
  'groups.create'
];

const DEPARTMENT_ADMIN_PERMISSION_SET = new Set(
  DEPARTMENT_ADMIN_PERMISSION_CATALOG.map((item) => item.permission)
);
const ROLE_PERMISSION_SET = new Set(
  ROLE_PERMISSION_CATALOG.map((item) => item.permission)
);

export function normalizeRolePermissions(permissions: string[]): string[] {
  return [...new Set(permissions)]
    .map((permission) => permission.trim())
    .filter((permission) => ROLE_PERMISSION_SET.has(permission))
    .sort();
}

export function assertRolePermissions(permissions: string[]): string[] {
  const normalizedPermissions = normalizeRolePermissions(permissions);
  const invalidPermissions = permissions
    .map((permission) => permission.trim())
    .filter((permission) => permission && !ROLE_PERMISSION_SET.has(permission));

  if (invalidPermissions.length) {
    const error = new Error('One or more selected role permissions are not supported.');
    error.name = 'ValidationError';
    throw error;
  }

  return normalizedPermissions;
}

export function normalizeDepartmentAdminPermissions(permissions: string[]): string[] {
  return [...new Set(permissions)]
    .map((permission) => permission.trim())
    .filter((permission) => DEPARTMENT_ADMIN_PERMISSION_SET.has(permission))
    .sort();
}

export function assertDepartmentAdminPermissions(permissions: string[]): string[] {
  const normalizedPermissions = normalizeDepartmentAdminPermissions(permissions);
  const invalidPermissions = permissions
    .map((permission) => permission.trim())
    .filter((permission) => permission && !DEPARTMENT_ADMIN_PERMISSION_SET.has(permission));

  if (invalidPermissions.length) {
    const error = new Error('One or more selected permissions are not supported.');
    error.name = 'ValidationError';
    throw error;
  }

  return normalizedPermissions;
}

export function mergePermissions(...permissionGroups: string[][]): string[] {
  return [...new Set(permissionGroups.flat())].sort();
}
