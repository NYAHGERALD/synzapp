/**
 * What the employees list says when it has nothing to show.
 *
 * "No employees yet" is true for a company that has invited nobody. It is a lie
 * to a department admin whose department contains one person — themselves —
 * because the directory never lists the reader, and subtracting yourself from a
 * list of one leaves nothing.
 *
 * That happened on a live tenant and read as a broken screen. The wording now
 * says which of the two situations it is.
 */

export interface EmployeesEmptyState {
  message: string;
  title: string;
}

export function describeEmployeesEmptyState(input: {
  canInviteEmployees: boolean;
  departmentName: string | null;
  /** True for a department admin, whose list only ever holds their department. */
  isDepartmentScoped: boolean;
}): EmployeesEmptyState {
  const department = (input.departmentName || '').trim();
  const invite = input.canInviteEmployees
    ? ' Invite somebody to add them here.'
    : '';

  if (input.isDepartmentScoped) {
    return {
      message: `This list shows the people you look after, and never you.${invite}`,
      title: department ? `Nobody else in ${department}` : 'Nobody else in your department'
    };
  }

  return {
    message: `Everybody who has been invited appears here.${invite}`,
    title: 'No employees yet'
  };
}
