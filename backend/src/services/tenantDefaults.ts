export const HUMAN_RESOURCES_DEPARTMENT_ID = 'dept_human-resources';
export const HUMAN_RESOURCES_DEPARTMENT_NAME = 'Human Resources';

export function isHumanResourcesDepartment(input: {
  departmentId?: string | null;
  departmentName?: string | null;
  name?: string | null;
}): boolean {
  return input.departmentId === HUMAN_RESOURCES_DEPARTMENT_ID ||
    normalizeDepartmentName(input.departmentName || input.name || '') === normalizeDepartmentName(HUMAN_RESOURCES_DEPARTMENT_NAME);
}

export function buildHumanResourcesDepartmentRecord(input: {
  createdBy: string;
  tenantId: string;
}): Record<string, unknown> {
  return {
    createdBy: input.createdBy,
    departmentId: HUMAN_RESOURCES_DEPARTMENT_ID,
    description: 'Default organization administration department',
    name: HUMAN_RESOURCES_DEPARTMENT_NAME,
    slug: 'human-resources',
    status: 'ACTIVE',
    systemManaged: true,
    tenantId: input.tenantId
  };
}

function normalizeDepartmentName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}
