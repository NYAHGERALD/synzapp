# LSW Admin Workstream Health Plan

## Purpose

This document is the source of truth for the lower LSW scorecard section used by Organization Admins and Department Admins.

The goal is to help admins verify whether non-daily LSW workstreams are moving, blocked, late, or missing required information. This section must use real backend verification data and must respect the selected dashboard filter: Company, Department, or User.

## Workstreams Covered

- Follow Ups
- Improvement Projects and Updates
- Personal Objectives/Goals
- Plant Specific Cause RCA Trigger
- Scheduled Tasks/Meetings

Daily & Weekly Standard Tasks/Meetings, Level 1/2/3 Meeting Rails, and To Do Today & This Week remain day-by-day charts because their primary value is daily execution across the selected week.

## Admin Questions This Section Must Answer

- Which workstream needs attention first?
- How many people are fully complete for that workstream?
- How much work is complete?
- How much work is still open?
- What is late?
- What is missing required data?

## Enterprise UX Rules

- Use one compact decision panel instead of five isolated cards.
- Show every workstream in a consistent row so admins can compare them quickly.
- Use short business-facing labels.
- Avoid explanatory paragraphs and technical language.
- Completion, people complete, open work, missing data, and late work must be visible without opening another screen.
- Color should guide attention:
  - Green: complete or healthy.
  - Teal: in progress.
  - Amber: missing required data.
  - Red: late work.
  - Slate: unstarted or no activity.

## Data Rules

All values must come from the verification summary returned by the backend.

For each workstream:

- `completedCount` shows completed items.
- `expectedCount` shows expected items.
- `missingCount` shows required work that has not been completed.
- `needsReviewCount` shows items missing required detail.
- `lateCount` shows overdue items.
- `employeeCompletedCount` shows users who completed the workstream.
- `employeeExpectedCount` shows users expected to complete the workstream.

The displayed completion percentage follows the active filter:

- User view: item completion percentage.
- Department view: employee completion percentage.
- Company view: employee completion percentage.

## Action Guidance Rules

The panel should show a short next-action label for each row:

- If late work exists: `Review late work`.
- Else if required data is missing: `Complete required data`.
- Else if open work exists: `Close open items`.
- Else if expected work exists and completion is 100%: `On track`.
- Else: `No required work`.

## Implementation Boundaries

- Do not change backend totals unless the backend contract is missing a required field.
- Do not change the daily chart behavior.
- Do not change sidebar, top dashboard navigation, or the standard work compliance table.
- Do not add demo values.
- Do not hardcode counts or percentages.
