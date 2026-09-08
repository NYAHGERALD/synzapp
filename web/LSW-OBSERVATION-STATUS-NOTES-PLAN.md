# LSW Observation Status and Coaching Notes Plan

## Objective
Give department and organization leaders a governed way to observe employee Leaders Standard Work, understand availability, and leave section-specific coaching notes without turning observation into a private messaging feature.

## Enterprise Rules
- Observation is role-scoped and backend-enforced.
- Department Admins can observe active users in their own department only.
- Organization Admins and System Admins can observe active users across the company.
- Users cannot hide their LSW from authorized leaders.
- Users can set an availability status so leaders understand context before reviewing:
  - Active
  - On leave
  - Temporarily unavailable
- Authorized leaders can still observe when availability is not active, with the status visible in the header.
- Observation notes are weekly, section-scoped, timestamped, and attributable.
- Notes are not chat messages. They are lightweight coaching and verification records tied to a selected week and LSW section.
- Deleting a note withdraws it from the active view while preserving backend metadata for audit safety.

## Backend Scope
- Extend the LSW context and observation candidate response with availability status.
- Add endpoints for:
  - Reading/updating the current user’s observation availability.
  - Recording an observation view for the selected week.
  - Listing section notes for the current week.
  - Creating section notes while observing another user.
  - Withdrawing notes created by the current observer or by an Org/System Admin.
- Keep all records under the observed user’s LSW profile.
- Keep all operations tenant-scoped and role-scoped.

## Frontend Scope
- Keep observation status in the existing LSW header, not a separate banner.
- Add a compact status button/dropdown that shows:
  - availability status,
  - last observed time,
  - selected-week observer visits,
  - leader notes count.
- Allow users to set their own availability from the header.
- In observation mode, show a small note button on each LSW section header.
- Notes panel shows existing notes for that section/week, lets leaders add a note, and allows valid note withdrawal.
- Refresh status and notes automatically while observing so leaders and users do not need manual refresh.

## UX Guardrails
- No large banner cards.
- No developer wording such as tenant or role assignment in end-user copy.
- No edit controls for observed Standard Work data.
- Header must remain responsive and compact.
- Notes should be readable but not dominate the LSW page.

## Verification
- Backend typecheck must pass.
- Web typecheck must pass.
- Backend deployment is required because new LSW APIs are added.
