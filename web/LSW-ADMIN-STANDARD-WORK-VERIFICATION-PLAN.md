# LSW Admin Standard Work Verification Plan

## Purpose

This document is the source of truth for verifying whether users are completing their Daily & Weekly Standard Tasks/Meetings and whether they are using the LSW workflow consistently during the week.

The dashboard must use backend data only. No hardcoded completion values, placeholder chart values, or demo-only signals are acceptable.

## Verification Scope

The primary company LSW verification score is based only on the Daily & Weekly Standard Tasks/Meetings section.

The score is calculated week-to-date:

- Count task checks for days from the selected week beginning through the current day.
- Do not count future days in the selected week.
- Count every active user in the administrator's scope.
- Organization Admins see the whole company.
- Department Admins see only users in their department.

## Core Metrics

### Company LSW Completion

Shows how many required daily standard work checks have been completed.

Formula:

`completed task checks / expected task checks through today`

Example:

If 10 users each have 5 daily tasks and it is Wednesday, the expected count is:

`10 users x 5 tasks x 3 elapsed work days = 150 expected checks`

If 120 checks are complete, the completion rate is 80%.

### On-Time Checkoff

Shows whether users are checking off work on the correct day rather than catching up later.

Formula:

`on-time completed checks / completed checks through today`

Completed late checks remain completed work, but they lower the on-time rate.

### Users Active

Shows how many users have at least one daily standard work checkoff in the elapsed portion of the week.

Formula:

`users with one or more completed daily standard work checks / users expected to participate`

This is a checkoff activity signal, not a login-session signal. If a future portal activity event stream is added, this metric can be expanded to include verified daily portal visits.

### Open Daily Checks

Shows how many expected daily standard work checks remain incomplete for elapsed days in the selected week.

Formula:

`expected checks through today - completed checks through today`

## Dashboard Requirements

- The main LSW card must be labeled clearly as Company LSW completion.
- The card must use a needle gauge as the primary visual.
- Supporting numbers must be secondary to the gauge.
- Future days must never reduce the score.
- Department and user filters may affect detailed charts, but the top company cards represent the selected admin scope and selected week.
- Text must be short and business-facing.
- The UI must be compact and readable.

## User Detail Requirements

The User Detail tab should help admins identify who is actually using the workflow.

Each user row should include:

- Daily standard work completion rate.
- On-time checkoff rate.
- Completed checks.
- Open elapsed checks.
- Late or backfilled checks.
- Last checkoff date when available.

## Backend Requirements

The backend owns all verification calculations.

The backend must return:

- Week-to-date expected checks.
- Week-to-date completed checks.
- Week-to-date completion percentage.
- On-time completed checks.
- Late or backfilled completed checks.
- Users with checkoff activity.
- Day-level completion metrics.
- User-level compliance metrics.

The frontend must render these values and must not recalculate core enterprise totals from unrelated dashboard sections.

## Future Enhancement

Add a dedicated portal activity event stream that records meaningful user activity such as opening the LSW page, loading the daily standard work section, and saving checkoffs. Once available, the dashboard can separate:

- Portal active users.
- Daily standard work checkoff users.
- Users who opened the portal but did not complete required work.
