# LSW Admin Daily Verification Charts Plan

## Purpose

This document is the source of truth for the three daily verification charts on the LSW Scorecards tab.

The charts must help Organization Admins and Department Admins verify whether users are completing time-based LSW work in the selected week. The charts must not make future days look like failures, and they must clearly separate complete, partial, late, overdue, no-work, and not-due states.

## Sections Covered

- Daily & Weekly Standard Tasks/Meetings
- Level 1, 2 & 3 Meeting Rails
- To Do Today & This Week

## Enterprise Verification Rules

### Daily & Weekly Standard Tasks/Meetings

This chart verifies daily standard work discipline.

For each elapsed work day:

- Count every required task for every user in the selected scope.
- Completed on the correct day is healthy.
- Completed late is still completed, but it must be visible as a warning signal.
- Unchecked work from elapsed days is open work.
- Future days must be shown as not due and must not reduce the percentage.

### Level 1, 2 & 3 Meeting Rails

This chart verifies scheduled meeting discipline.

For each day in the selected week:

- Count meeting rails due on that day.
- A completed rail is healthy.
- An incomplete rail after the due time is overdue.
- A future rail is not due yet.
- A day with no rails due is no required work, not a failure.

### To Do Today & This Week

This chart verifies assigned weekly execution.

For each day in the selected week:

- Count to-do items due on that day.
- Completed items are healthy.
- Incomplete items after the due time are overdue.
- Future due items are not due yet.
- A day with no due items is no required work.

## Visual Rules

- Green: complete.
- Teal: partial progress without late work.
- Amber: completed late or needs attention.
- Red: overdue.
- Gray: no required work.
- Light gray: not due yet.

Each bar should show a tooltip with the real counts behind the percentage.

## Data Rules

The backend must provide a `dueState` field for each day metric:

- `complete`
- `partial`
- `late`
- `overdue`
- `no_work`
- `not_due`

The frontend must render the state and counts. It must not invent hardcoded values or treat missing backend data as completed work.

## Implementation Boundaries

- Do not change the top company KPI cards.
- Do not change the lower Workstream Health panel.
- Do not change existing tenancy or admin scoping rules.
- Keep the charts compact and dashboard-ready.
