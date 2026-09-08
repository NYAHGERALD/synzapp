# LSW Observe Standard Work Plan

## Objective

Add a governed read-only observation mode to the LSW page so Department Admins can review Standard Work for employees in their department, and Organization/System Admins can review Standard Work for every active user in the company.

## Enterprise Rules

- Observation is read-only. Admins must not create, edit, delete, reorder, or check off another user's Standard Work.
- Backend authorization is mandatory. The UI must not be the security boundary.
- Department Admin access is scoped to active users in the same department only.
- Organization Admin and System Admin access is scoped to active users in the same company.
- Employees cannot observe other users.
- Observed data must use the observed user's LSW profile, department, work-days setting, week selection, and records.
- The page must clearly show when the admin is observing someone else.
- Returning to personal data must be obvious through a `My Standard Work` action.

## UX Contract

- Add an `Observe Standard Work` button to the LSW page header for authorized admins.
- Clicking it opens a user selector with governed users only.
- Selecting a user reloads the LSW page in read-only observation mode.
- The button changes to `My Standard Work` while observing.
- Show a compact banner stating `Read-only observation: {User Name}`.
- Disable/hide write actions while observing:
  - Add buttons
  - Delete row menus
  - Checkboxes/checkoff controls
  - Inline editable inputs
  - Reordering handles
  - Settings changes
- Print/export/read actions may remain available.

## Backend Contract

- Add `observeUserId` to LSW read query options.
- Add an observation access resolver that:
  - authenticates the actor
  - resolves the target user inside the same tenant
  - checks active status
  - enforces role scope
  - returns the target user's LSW profile context
- Add an observation candidates endpoint:
  - `GET /api/lsw/observation-candidates`
- Read endpoints accept `observeUserId`:
  - context
  - daily tasks
  - to-do tasks
  - meeting rails
  - personal goals
  - improvement projects
  - scheduled tasks
  - follow ups
  - RCA triggers
- Write endpoints continue to use the actor's own context only and must reject observation query usage.

## Audit And Safety

- Observation access must be tenant-safe and department-safe.
- Observation candidates must not expose inactive users or users outside scope.
- The context response should include observation metadata so the UI can reliably enter read-only mode.
- Future audit logging can record observation sessions without changing this contract.

## Verification

- Backend typecheck must pass.
- Frontend typecheck must pass.
- Backend must be deployed after successful checks.
- Existing personal LSW behavior must remain unchanged when no `observeUserId` is supplied.
