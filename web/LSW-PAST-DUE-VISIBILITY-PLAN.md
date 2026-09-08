# LSW Past Due Visibility Improvement Plan

## Objective

Make past due LSW work visible by default across every section. Users and leaders should not need to enable a filter before seeing overdue work that requires attention.

## Enterprise Behavior

- Remove the `Show past due` checkbox from LSW section headers.
- Always show current selected-week work and past due work in each affected section.
- Keep future-dated work hidden where the selected week is not yet due.
- Preserve amber/yellow row styling for past due work so exceptions remain immediately visible.
- Keep completed work out of the past due warning state.
- Use clear empty states that do not refer to hidden filters.

## Affected Sections

- Follow Ups
- Plant Specific Cause RCA Triggers
- Scheduled Tasks/Meetings
- To Do Today & This Week
- Level 1, 2 & 3 Meeting Rails
- Personal Objectives/Goals

## Implementation Steps

1. Remove local React state used only for past due filter toggles.
2. Replace conditional `visible*` filters with always-visible exception logic.
3. Remove `PastDueCheckbox` usage from all section headers.
4. Remove the unused `PastDueCheckbox` component.
5. Keep existing `is-past-due` row styling and date badges intact.
6. Build the frontend to verify TypeScript and production bundling.

## Validation

- Past due rows are visible without user action.
- Current selected-week rows remain visible.
- Future rows remain hidden where week-scoped behavior requires it.
- Past due rows use the existing amber/yellow visual treatment.
- No backend changes are required.
