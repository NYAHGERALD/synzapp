export const HUMAN_RESOURCES_DEPARTMENT_ID = 'dept_human-resources';
export const HUMAN_RESOURCES_DEPARTMENT_NAME = 'Human Resources';

/**
 * Whether this is *the* Human Resources department.
 *
 * Matched by id alone. It used to accept any department whose **name**
 * normalised to "human resources", and the invite path granted organization
 * admin from that answer — so creating or renaming a department was a way to
 * make yourself an administrator. The name clause is kept below, commented,
 * rather than deleted, so the reason it went is visible to whoever next wants
 * to make an HR check "more helpful".
 *
 * It has no callers today. Anything that needs it should be granting a
 * department from a role, never a role from a department.
 */
export function isHumanResourcesDepartment(input: {
  departmentId?: string | null;
  departmentName?: string | null;
  name?: string | null;
}): boolean {
  return input.departmentId === HUMAN_RESOURCES_DEPARTMENT_ID;
  // Never restore this: it made a department's name an authority decision.
  //   || normalizeDepartmentName(input.departmentName || input.name || '') ===
  //      normalizeDepartmentName(HUMAN_RESOURCES_DEPARTMENT_NAME);
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
