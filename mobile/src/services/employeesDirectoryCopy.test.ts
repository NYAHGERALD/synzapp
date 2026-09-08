import { describe, expect, it } from 'vitest';
import { describeEmployeesEmptyState } from './employeesDirectoryCopy';

describe('the empty employees list', () => {
  it('names the department when the reader only ever sees one', () => {
    const state = describeEmployeesEmptyState({
      canInviteEmployees: true,
      departmentName: 'Bakery',
      isDepartmentScoped: true
    });

    expect(state.title).toBe('Nobody else in Bakery');
    expect(state.message).toContain('never you');
  });

  it('still explains itself when the department has no name', () => {
    const state = describeEmployeesEmptyState({
      canInviteEmployees: false,
      departmentName: null,
      isDepartmentScoped: true
    });

    expect(state.title).toBe('Nobody else in your department');
    expect(state.message).not.toContain('Invite');
  });

  it('says nobody has been invited when that is what is true', () => {
    const state = describeEmployeesEmptyState({
      canInviteEmployees: true,
      departmentName: 'Human Resources',
      isDepartmentScoped: false
    });

    expect(state.title).toBe('No employees yet');
    expect(state.message).toContain('Invite somebody');
  });

  it('never offers an invitation to somebody who cannot send one', () => {
    const state = describeEmployeesEmptyState({
      canInviteEmployees: false,
      departmentName: null,
      isDepartmentScoped: false
    });

    expect(state.message).not.toContain('Invite');
  });
});
