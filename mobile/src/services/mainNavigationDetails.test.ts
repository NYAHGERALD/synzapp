import { describe, expect, it } from 'vitest';
import {
  describeAdminContactHeading,
  describeAdminContactSubtitle,
  describeOwnIdentityLines,
  listMainNavigationItems,
  MAIN_NAVIGATION_ITEMS
} from './mainNavigationDetails';

describe('main navigation items', () => {
  it('reads as sentence case and keeps the keys the screen switches on', () => {
    expect(MAIN_NAVIGATION_ITEMS.map((item) => item.label)).toEqual([
      'Actions',
      'Record meeting',
      'Leaders standard work',
      'Interpreter',
      'Library'
    ]);
    expect(MAIN_NAVIGATION_ITEMS.map((item) => item.key)).toEqual([
      'ACTIONS',
      'RECORD MEETING',
      'LEADERS STANDARD WORK',
      'INTERPRETER',
      'LIBRARY'
    ]);
  });

  it('gives every destination an icon', () => {
    MAIN_NAVIGATION_ITEMS.forEach((item) => {
      expect(item.icon.length).toBeGreaterThan(0);
    });
  });

  it('shows only the destinations it was given, in the app order', () => {
    const items = listMainNavigationItems(['LIBRARY', 'ACTIONS']);

    expect(items.map((item) => item.key)).toEqual(['ACTIONS', 'LIBRARY']);
  });
});

describe('the admin card wording', () => {
  it('names a department admin as one', () => {
    expect(describeAdminContactHeading('DEPARTMENT')).toBe('Your department admin');
  });

  it('says plainly when it has fallen back to the organization admin', () => {
    expect(describeAdminContactHeading('ORGANIZATION')).toBe('Your organization admin');
  });

  it('shows the role alone when there is nobody else it could have named', () => {
    expect(describeAdminContactSubtitle({ otherAdminCount: 0, roleName: 'Department Admin' }))
      .toBe('Department Admin');
  });

  it('counts the others rather than naming them', () => {
    expect(describeAdminContactSubtitle({ otherAdminCount: 1, roleName: 'Department Admin' }))
      .toBe('Department Admin · and 1 other');
    expect(describeAdminContactSubtitle({ otherAdminCount: 3, roleName: 'Department Admin' }))
      .toBe('Department Admin · and 3 others');
  });

  it('never leaves the line empty', () => {
    expect(describeAdminContactSubtitle({ otherAdminCount: 0, roleName: '   ' })).toBe('Admin');
  });
});

describe('your own lines', () => {
  it('puts the role and department together, then the number', () => {
    expect(describeOwnIdentityLines({
      departmentName: 'Bakery',
      phoneFormatted: '+1 (469) 716 1494',
      roleName: 'Department Admin'
    })).toEqual(['Department Admin · Bakery', '+1 (469) 716 1494']);
  });

  it('leaves the department out rather than saying there is none', () => {
    expect(describeOwnIdentityLines({
      departmentName: null,
      phoneFormatted: '+1 (469) 716 1494',
      roleName: 'Employee'
    })).toEqual(['Employee', '+1 (469) 716 1494']);
  });

  it('says nothing at all rather than showing empty lines', () => {
    expect(describeOwnIdentityLines({
      departmentName: '  ',
      phoneFormatted: '  ',
      roleName: '  '
    })).toEqual([]);
  });
});
