# Synzapp Enterprise Org Admin Guided Setup Plan

## Problem

After a new Org Admin creates an organization and opens Synzapp for the first time, the app lands on an empty Chat list. That is technically correct but operationally confusing: there are no departments, roles, employees, groups, or conversations yet, so the Admin has no clear next action.

## Goal

Create a professional in-app guided setup coach that moves a new Org Admin from an empty company workspace to the first usable chat path:

1. Create at least one department.
2. Create at least one role.
3. Invite at least one employee using the department and role.
4. Return to Chats ready for team communication.

The experience must feel enterprise-grade: contextual, dismissible, accessible, role-aware, progress-aware, and safe for repeat app launches.

## Product Principles

- Use a task coach, not a long tutorial.
- Drive existing production flows instead of creating a parallel wizard.
- Never block emergency use of the app; the coach can be skipped.
- Resume intelligently from current company state.
- Avoid animation-only instruction; every animation has text and controls.
- Store completion per `tenantId + uid + role + journeyVersion`.
- Respect reduced-motion settings.
- Focus the exact live control the Admin is expected to tap. The coach must measure rendered controls rather than guessing coordinates.
- Use a lightweight contextual hint, not a large modal. The background should dim softly, the active tap target should stay visually clear, and the hint should sit near the target without covering most of the screen.
- Motion should feel calm and precise: soft glow, small pulse range, no aggressive scaling, and no movement when the device requests reduced motion.

## Journey

Journey id: `ORG_ADMIN_COMPANY_SETUP_V1`

### Step 1: Department Required

Condition:

- Org Admin can manage directory.
- No active department exists other than the default Human Resources department.

Primary action:

- Open `Settings > Departments and roles` with the `Departments` filter selected.

Instruction:

- "Create your first department so employees can be organized correctly."

### Step 2: Role Required

Condition:

- At least one active department exists.
- No active role exists other than the default Org Admin role.

Primary action:

- Open `Settings > Departments and roles` with the `Roles` filter selected.

Instruction:

- "Create your first role so Synzapp can assign the right access to employees."

### Step 3: Employee Invite Required

Condition:

- At least one active department exists.
- At least one active role exists.
- No employee or invite exists.

Primary action:

- Open `Employees`, then start a manual invite.

Instruction:

- "Invite your first employee and assign the department and role you created."

### Step 4: Chat Ready

Condition:

- Setup prerequisites are present.

Primary action:

- Return to `Chats`.

Instruction:

- "Your company is ready for secure conversations. Chats will appear as your team joins."

## Implementation Plan

### Phase 1: Local Journey State

Status: Implemented.

- Add a scoped local store for guided setup state.
- Support dismissed, completed, and last step tracking.
- Key state by owner uid, tenant id, role, and journey id.

### Phase 2: Progress Detection

Status: Implemented.

- Bootstrap departments, roles, employees, and groups after Org Admin app entry.
- Recompute the active coach step when those records change.
- Do not show the coach when chats already exist or when the journey is completed/dismissed.

### Phase 3: Precision Guided Overlay

Status: Implemented.

- Add a reusable `GuidedSetupCoachOverlay`.
- Measure actual on-screen controls with root-relative layout measurement:
  - bottom navigation tabs
  - top-right menu/options button
  - floating add button
- Measure targets relative to the screen root that owns the overlay, so focus coordinates match the exact rendered button position instead of drifting between window and screen coordinate spaces.
- Use a single shaped spotlight mask rather than rectangular scrim pieces, so the target cutout is rounded/circular and does not leave a visible white square.
- Render a spotlight-style overlay where the active target remains clear and the rest of the screen is lightly dimmed.
- Use a compact glassmorphic hint box that follows the target position.
- Keep the hint far enough from the focus circle and bottom navigation that it never blocks the target or footer.
- Add a long, curved pointer/notch from the hint toward the focused target so the relationship is clear without overlapping the target.
- Keep typography quiet and enterprise-grade: no oversized bold modal title, no large body text, no full-width card unless the viewport requires it.
- Use smooth glow and pulse effects around the measured target.
- Respect reduced-motion settings.

### Phase 4: Action Routing

Status: Implemented.

- Route each step to the existing production flow:
  - department -> Settings directory Departments
  - role -> Settings directory Roles
  - employee -> Employees manual invite
  - chat ready -> Chats
- Complete journey once setup is ready and the Admin acknowledges the final step.

### Phase 5: Validation

Status: Code validation complete. Physical-device validation still required.

- Verify first-run Org Admin on iPhone.
- Verify returning Org Admin does not get stuck.
- Verify Skip suppresses the journey for the scoped tenant/user.
- Verify creating department, role, employee invite, and group advances the coach.
- Verify reduced-motion mode disables pulsing animation.

## Acceptance Criteria

- A new Org Admin landing on empty Chats receives a clear next action.
- The first suggested action is department creation, not employee invite.
- The focused ring sits on the exact visible button/icon/tab the Admin should tap.
- The inactive part of the screen is lightly darkened while the focused target remains clear.
- The hint feels like a small contextual glass prompt, not a blocking modal.
- The hint moves above/below the target based on available space and never covers the target.
- The hint has a curved pointer/notch to the focused control when separated from it.
- The animation is smooth, subtle, and disabled when reduced motion is enabled.
- The coach never appears for users without Org Admin setup permissions.
- The coach resumes at the correct step after app restart.
- The coach disappears once the setup is complete or dismissed.
- Existing department, role, employee, group, and chat behavior remains unchanged.

## Implemented Files

- `src/services/guidedSetupCoach.ts`
- `src/services/guidedSetupCoach.test.ts`
- `src/screens/AdminChatScreen.tsx`

## Verification

- `npm run test:unit` passes.
- `npm run typecheck` passes.

## Remaining Validation

- Run the first-organization flow on a physical iPhone.
- Confirm the coach starts with Department, then Role, Employee, and Chats.
- Confirm Skip persists for the same tenant/user/role.
- Confirm reduced-motion accessibility disables the pulsing loop.
