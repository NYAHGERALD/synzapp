# LSW Weekly Admin Verification Plan

## Purpose

Create a tenant-governed weekly verification workflow for Leader Standard Work so Department Admins and Organization Admins can confirm that users are completing their required LSW routines every week across web and mobile.

This workflow applies to:

- Daily & Weekly Standard Tasks/Meetings
- Plant Specific Cause RCA Triggers
- To Do Today & This Week
- Level 1, 2 & 3 Meeting Rails
- Improvement Projects and Updates
- Follow Ups
- Scheduled Tasks/Meetings
- Personal Objectives/Goals

## Access Model

Verification must respect tenancy and administrative scope.

- Employee: can complete and review only their own LSW records.
- Department Admin: can verify only users in their assigned department, including supervisors and employees within that department.
- Organization Admin: can verify all departments and all users in the tenant, including Department Admins.
- System Admin: may access support-level rollups only when explicitly authorized by the tenant policy.

All backend queries must be tenant-scoped under the authenticated organization. Department Admin requests must be filtered server-side by department ID, not only in the UI.

## Weekly Verification Model

The verification period is the selected LSW calendar week using the organization's configured Week 1 start date. The backend calculates a stable `weekKey`, such as `2026-W33`, and every dashboard metric is derived from that week.

Each verification item should carry:

- tenant ID
- department ID and department name
- owner user ID
- owner display name and role
- week key
- LSW section key
- expected count
- completed count
- late count
- missing count
- needs review count
- completion percentage
- current verification state
- last activity timestamp when available

## Section Rules

### Daily & Weekly Standard Tasks/Meetings

Expected work is calculated from active standard tasks multiplied by configured work days for the user. Completion comes from daily week status records. Late and early completions remain visible because they are operationally different from on-time completion.

### To Do Today & This Week

Expected work is the active to-do records visible for the selected week. Completion uses the `completed` field and completion timestamp.

### Level 1, 2 & 3 Meeting Rails

Expected work is active meeting rail records visible for the selected week. Completion uses the `completed` field. Missing meeting rails should be visible because they indicate gaps in the operating cadence.

### Plant Specific Cause RCA Triggers

Expected work is the trigger records whose event date falls inside the selected week. A trigger is considered ready for verification only when the trigger and comments are populated. A future enhancement should link these records directly to RCA projects and use RCA linkage as a stronger completion signal.

### Improvement Projects and Updates

Expected work is active improvement projects owned by users in scope. A project is verification-ready when it has a project title and at least one non-empty weekly update. A future enhancement should add explicit weekly update records with status, evidence, and admin sign-off.

### Follow Ups

Expected work is follow-up records due during or before the selected week. A follow-up is verification-ready when follow-up, responsible owner, and comments are populated. A future enhancement should add explicit completion status and verification status.

### Scheduled Tasks/Meetings

Expected work is active scheduled task records due inside the selected week or recurring into the selected week. A scheduled task is verification-ready when it has task text, due date, frequency, and planned minutes. A future enhancement should add explicit occurrence completion records for each due instance.

### Personal Objectives/Goals

Expected work is active goals due inside or before the selected week. A goal is verification-ready when objective is populated and progress is above zero. Completed goals require progress at 100 percent.

## Dashboard UX

The admin dashboard should include:

- Scope banner showing Department Admin or Organization Admin view.
- Week selector aligned with the LSW week controls.
- KPI tiles for users in scope, weekly completion, late work, missing work, and departments needing attention.
- Department performance cards for Organization Admins.
- Section compliance grid for all LSW verification categories.
- User verification table showing each user's weekly state and section-level gaps.
- Clear language that tells admins what is missing and where attention is needed.
- No cross-tenant leakage and no client-only scope filtering.

## Backend Controls

The backend must:

- authenticate the Firebase session
- verify tenant membership
- verify role-based admin scope
- enforce Department Admin department filtering server-side
- derive selected week from tenant calendar settings
- query only tenant-scoped LSW profiles and user records
- return summarized records, not raw unrestricted cross-user data

## Implementation Phases

### Phase 1 - Verification Visibility

Add a read-only weekly verification summary endpoint and an admin dashboard panel in the LSW web app. This phase uses existing completion/status fields and clearly identifies records that need data or explicit completion support.

### Phase 2 - Admin Sign-Off

Add explicit weekly verification records per user/section with reviewer, comments, approval state, rejection reason, and audit timestamps.

### Phase 3 - Mobile Parity

Add mobile admin verification views and push reminders so admins can verify weekly compliance from mobile.

### Phase 4 - Evidence and Escalation

Add evidence requirements, recurring task occurrence records, escalation policies, and automated overdue routing to Department Admins and Organization Admins.
