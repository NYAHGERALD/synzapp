import { describe, expect, it } from 'vitest';
import {
  audienceKey,
  findCoverageReason,
  summariseSelectionByKind,
  describeSelection,
  filterAudienceChoices,
  groupAudienceChoices,
  isAudienceSelected,
  toggleAudience,
  type AudienceChoice
} from './audiencePicker';

const choices: AudienceChoice[] = [
  {
    description: 'everyone at the company',
    kind: 'ORGANIZATION',
    section: 'SCOPE',
    targetId: null,
    targetName: 'Everyone at the company'
  },
  {
    description: 'everyone in Production',
    kind: 'DEPARTMENT',
    section: 'DEPARTMENTS',
    targetId: 'dept_production',
    targetName: 'Production'
  },
  {
    description: 'the 12 people in Line A',
    kind: 'GROUP',
    section: 'GROUPS',
    targetId: 'group_line_a',
    targetName: 'Line A'
  },
  {
    description: 'Warehouse · Operator',
    kind: 'GROUP',
    section: 'PEOPLE',
    targetId: 'user_fay',
    targetName: 'Fay Warehouse'
  }
];

describe('picking an audience', () => {
  it('ticks and unticks', () => {
    const first = toggleAudience([], choices[1]);

    expect(first).toHaveLength(1);
    expect(isAudienceSelected(first, choices[1])).toBe(true);
    expect(toggleAudience(first, choices[1])).toHaveLength(0);
  });

  it('cannot add the same choice twice', () => {
    const once = toggleAudience([], choices[1]);
    const again = toggleAudience(toggleAudience(once, choices[1]), choices[1]);

    expect(again).toHaveLength(1);
  });

  it('tells a department from a group with the same id', () => {
    // Ids are only unique within a kind, so the key must include the kind.
    const department = { kind: 'DEPARTMENT' as const, targetId: 'x', targetName: 'X' };
    const group = { kind: 'GROUP' as const, targetId: 'x', targetName: 'X' };

    expect(audienceKey(department)).not.toBe(audienceKey(group));
    expect(isAudienceSelected([department], group)).toBe(false);
  });
});

describe('searching', () => {
  it('matches the name', () => {
    expect(filterAudienceChoices(choices, 'line').map((c) => c.targetName)).toEqual(['Line A']);
  });

  it('matches the description too, so a department finds its people', () => {
    const found = filterAudienceChoices(choices, 'warehouse');

    expect(found.map((c) => c.targetName)).toEqual(['Fay Warehouse']);
  });

  it('ignores capitals and returns everything for an empty search', () => {
    expect(filterAudienceChoices(choices, 'PRODUCTION')).toHaveLength(1);
    expect(filterAudienceChoices(choices, '   ')).toHaveLength(4);
  });
});

describe('sections', () => {
  it('keeps them in a sensible order and drops empty ones', () => {
    expect(groupAudienceChoices(choices).map((s) => s.key)).toEqual([
      'SCOPE',
      'DEPARTMENTS',
      'GROUPS',
      'PEOPLE'
    ]);
    expect(groupAudienceChoices([choices[2]]).map((s) => s.key)).toEqual(['GROUPS']);
  });
});

describe('the line under the picker', () => {
  it('says nothing is chosen, then counts, then reports', () => {
    expect(describeSelection([], null)).toBe('Nobody chosen yet');
    expect(describeSelection([choices[1]], null)).toBe('Counting…');
    expect(describeSelection([choices[1]], 43)).toBe('Reaches 43 people');
    expect(describeSelection([choices[1]], 1)).toBe('Reaches 1 person');
  });

  it('says plainly when a choice reaches nobody', () => {
    // The exact case that used to surface only after writing the message.
    expect(describeSelection([choices[2]], 0)).toBe('This reaches nobody');
  });
});

describe('who is already covered', () => {
  const departmentBackedGroups = { group_production_default: 'dept_production' };

  it('says nothing when nothing overlapping is chosen', () => {
    expect(
      findCoverageReason({
        departmentBackedGroups,
        personDepartmentId: 'dept_production',
        selected: [{ kind: 'GROUP', targetId: 'group_line_a', targetName: 'Line A' }]
      })
    ).toBeNull();
  });

  it('covers everybody when the whole company is chosen', () => {
    expect(
      findCoverageReason({
        departmentBackedGroups,
        personDepartmentId: 'dept_warehouse',
        selected: [{ kind: 'ORGANIZATION', targetId: null, targetName: 'Everyone' }]
      })
    ).toMatch(/everyone at the company/i);
  });

  it('covers somebody in a chosen department, and names it', () => {
    expect(
      findCoverageReason({
        departmentBackedGroups,
        personDepartmentId: 'dept_production',
        selected: [{ kind: 'DEPARTMENT', targetId: 'dept_production', targetName: 'Production' }]
      })
    ).toBe('Already included via Production');
  });

  it('leaves somebody in a different department selectable', () => {
    expect(
      findCoverageReason({
        departmentBackedGroups,
        personDepartmentId: 'dept_warehouse',
        selected: [{ kind: 'DEPARTMENT', targetId: 'dept_production', targetName: 'Production' }]
      })
    ).toBeNull();
  });

  it('covers somebody through a group that holds their whole department', () => {
    expect(
      findCoverageReason({
        departmentBackedGroups,
        personDepartmentId: 'dept_production',
        selected: [
          { kind: 'GROUP', targetId: 'group_production_default', targetName: 'Production' }
        ]
      })
    ).toBe('Already included via Production');
  });

  it('claims nothing about a hand-picked group, because the phone cannot know', () => {
    // Saying "already included" wrongly is worse than saying nothing: the
    // sender would leave somebody out believing they were covered.
    expect(
      findCoverageReason({
        departmentBackedGroups: {},
        personDepartmentId: 'dept_production',
        selected: [{ kind: 'GROUP', targetId: 'group_line_a', targetName: 'Line A' }]
      })
    ).toBeNull();
  });
});

describe('summariseSelectionByKind', () => {
  it('counts each kind separately', () => {
    expect(
      summariseSelectionByKind([
        { kind: 'DEPARTMENT', targetId: 'd1', targetName: 'Production' },
        { kind: 'DEPARTMENT', targetId: 'd2', targetName: 'Warehouse' },
        { kind: 'GROUP', targetId: 'g1', targetName: 'Line A' },
        { kind: 'PERSON', targetId: 'u1', targetName: 'Gerald' }
      ])
    ).toBe('2 departments · 1 group · 1 person');
  });

  it('says so when nothing is chosen', () => {
    expect(summariseSelectionByKind([])).toBe('Nobody chosen yet');
  });
});
