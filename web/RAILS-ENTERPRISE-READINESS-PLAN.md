# RAILS Enterprise Readiness Implementation Plan

This plan tracks the remaining work required for Synzapp RAILS to become a durable enterprise system of record for rapid action and improvement loops.

## Current Readiness Verdict

RAILS has a strong workflow foundation: backend-enforced status gates, real company users, evidence upload, collaboration, standardization controls, controlled reopen, and a manager-focused board/detail UI.

It is not yet complete as a large-company "only RAILS app" until the gaps below are implemented, tested, and verified end to end.

## Workstreams

### 1. Immutable Audit Events

Goal: replace comment-only audit history with structured, immutable events.

Deliverables:
- Tenant-scoped RAILS audit event records.
- Loop-scoped activity records.
- Event types for create, status change, assignment, collaborator change, action change, evidence upload, standardization change, verification, approval, close, reopen, cancel, archive, export, and bulk action.
- Actor, tenant, loop, before/after values, reason, timestamp, and request metadata where available.
- UI activity feed sourced from audit events instead of free-form comments alone.

Acceptance criteria:
- Every state-changing RAILS backend operation writes an audit event.
- Audit events cannot be edited by normal update flows.
- Reopen, close, approval, standardization verification, and document replacement preserve before/after values.

Status: Foundation implemented.

Implementation notes:
- Added structured `railsAuditEvents` records under each tenant.
- Added loop-scoped `activity` records under each RAILS item.
- Wired audit events for create, update, status changes, reopen/cancel/archive, collaborators, actions, evidence, comments, standardization changes, and standardization verification.
- Added secured loop activity endpoint and switched the UI Log tab to immutable audit events instead of comment-only history.
- Added explicit Firestore rules that deny direct client reads/writes to backend-owned RAILS items, activity, audit events, notification queue, and notification event records.
- Added source-level regression coverage in `backend/test/railsEnterpriseReadiness.test.ts`.

### 2. Role-Specific Approval Policy

Goal: prevent approval from being a generic user selection.

Deliverables:
- Approval rules based on role, priority, category, department, and risk.
- High-risk approval constraints for safety, food safety, quality, and critical priority.
- Backend validation that approver is eligible.
- UI explains why a selected approver is valid or blocked.

Acceptance criteria:
- Critical/high-risk loops cannot be approved by ineligible users.
- Owner cannot approve their own high-risk loop unless policy explicitly allows it.
- Approval decision is auditable with actor, time, and decision.

Status: Backend foundation implemented.

Implementation notes:
- Added backend approver eligibility validation.
- Blocks self-approval.
- Requires admin-level approver for high-risk loops.
- Limits Department Admin high-risk approval to their own department.
- Enforces approval eligibility before a loop can move to `Approved`.

### 3. Escalation and Notifications

Goal: ensure loops do not quietly stall.

Deliverables:
- Overdue detection by loop due date, action due date, verification due date, and standardization due date.
- Escalation records with level, owner, due date, and reason.
- Notification hooks for owner assignment, collaborator assignment, approver request, evidence requirement, overdue, escalation, reopen, close, and blocked gate.
- UI escalation state on cards and detail panel.

Acceptance criteria:
- Overdue and blocked loops surface without manual filtering.
- Escalations write audit events.
- Notification calls are centralized and testable even if delivery providers vary.

Status: Backend/UI foundation implemented.

Implementation notes:
- Added backend-computed escalation summary per loop.
- Added overdue/escalated counts to workspace summary.
- Switched Overdue filtering to backend escalation state.
- Added escalation card badges and detail-panel reasons.
- Added guarded backend escalation recording that writes `RAILS_ESCALATED` audit events when loops first move into Overdue or Critical escalation.
- Added centralized `railsNotificationQueue` hook records for assignment, approver request, evidence requirement, close, reopen, standardization proof updates, and bulk operations.
- Connected RAILS notification intents to the existing push-token delivery infrastructure through a generic `sendRailsPushNotification` adapter.
- Durable queue records remain the source of truth; delivery status/errors are written back without weakening workflow enforcement.

### 4. Enterprise Reporting

Goal: make RAILS a management operating system, not only a board.

Deliverables:
- Summary metrics for open, overdue, critical, verification, closure rate, action progress, aging, reopen rate, standardization compliance, and RCA linkage.
- Department/owner/category breakdowns.
- Aging buckets and trend-friendly data shape.
- Reporting panel or dashboard view.

Acceptance criteria:
- Managers can identify bottlenecks by owner, department, priority, and stage.
- Reporting data is produced from backend records, not hardcoded frontend values.

Status: Backend/UI foundation implemented.

Implementation notes:
- Added secured backend enterprise report endpoint.
- Added management metrics for open/closed/archived/cancelled/reopened, closure rate, reopen rate, overdue, escalation, action progress, RCA linkage, and standardization compliance.
- Added breakdowns by status, priority, category, department, owner, and open-loop aging buckets.
- Added a RAILS Report view in the command center that renders backend-produced metrics.

### 5. Archive, Search, and Export

Goal: support enterprise history, audits, and reviews.

Deliverables:
- Archive/history view for closed, archived, cancelled, and reopened loops.
- Search by title, display ID, owner, department, category, priority, RCA, and date.
- CSV/JSON export for filtered loop sets.
- Export audit events.

Acceptance criteria:
- Closed/archived loops remain discoverable.
- Exports include enough fields for operational review.
- Export actions are audited.

Status: Backend/UI foundation implemented.

Implementation notes:
- Added secured backend history endpoint with filters for status, priority, category, owner, department, date range, and text search.
- Added secured CSV and JSON export endpoints for filtered RAILS history.
- Added tenant-level `RAILS_EXPORT_CREATED` audit event for exports.
- Added History and Archive UI with search, status filtering, row drill-in, CSV export, and JSON export.

### 6. Standardization Document Versioning

Goal: preserve standardization proof over time.

Deliverables:
- Version records for standardization documents.
- Current document pointer plus historical versions.
- Replacement reason required when verified document changes.
- Verification reset on replacement.
- UI version list and open/download controls.

Acceptance criteria:
- Replacing a standardization document never destroys previous proof.
- Verification state resets when current proof changes.
- Version history is auditable.

Status: Backend/UI foundation implemented.

Implementation notes:
- Added version records for standardization document uploads.
- Added current-version pointer and secured version download endpoint.
- Replacing a standardization document preserves historical proof.
- Verification resets when verified standardization proof changes.
- Added UI version history with current-version badge and open/download controls.
- Added explicit Storage rules that deny direct client access to backend-owned RAILS evidence files.

### 7. Manager Bulk Workflows

Goal: make the board efficient for high-volume managers.

Deliverables:
- Multi-select loops.
- Bulk assign owner, due date, priority, category, collaborator, and archive where policy allows.
- Bulk action audit events.
- Partial success/error reporting.

Acceptance criteria:
- Bulk changes respect the same backend policies as single-loop changes.
- Bulk operations clearly report what succeeded and what failed.

Status: Backend/UI foundation implemented.

Implementation notes:
- Added secured bulk update endpoint for selected loops.
- Bulk updates reuse single-loop backend policy and audit behavior.
- Added tenant-level `RAILS_BULK_ACTION_COMPLETED` audit event with succeeded/failed counts.
- Added manager bulk controls in History and Archive for owner, due date, priority, category, collaborator, and archive actions with partial failure reporting.

### 8. Workflow Tests

Goal: make enterprise gates provable.

Deliverables:
- Unit tests for status transitions and blockers.
- Integration-style tests for create, triage, action progress, verification, approval, close, reopen, cancel, archive, evidence, and standardization verification.
- Tests for approval eligibility and audit event writing.

Acceptance criteria:
- RAILS gate regressions fail tests.
- Reopen cannot bypass reason/audit requirements.
- Standardization cannot be verified without required proof.

Status: Expanded foundation implemented.

Implementation notes:
- Added regression coverage for audit events, controlled reopen, approval policy, reporting/history/export, standardization document versioning, bulk workflows, and notification hooks.
- Added behavior-level workflow policy tests for triage blockers, closure readiness, standardization verification, reopen reason, and backward-transition prevention.
- Added Firestore and Storage emulator rule coverage for backend-owned RAILS records and evidence paths.
- Added emulator-backed RAILS service integration coverage for create, persisted loop state, audit activity, notification queue/event records, evidence updates, standardization updates, and backend blocker enforcement.

## Implementation Order

1. Immutable audit event foundation.
2. Wire audit events into all existing backend mutations.
3. Add role-specific approval policy.
4. Add escalation/notification foundation.
5. Add reporting summaries and UI.
6. Add archive/search/export.
7. Add document versioning.
8. Add bulk workflows.
9. Add complete workflow tests.

## Definition of Enterprise Ready

RAILS is enterprise ready when:
- Backend policy, not frontend state, controls every important workflow gate.
- Every meaningful change is audit-evented.
- Managers can find, report, escalate, export, and govern loops at scale.
- Standardization proof is versioned and verifiable.
- Approval and reopen flows are role-aware and reason-controlled.
- Tests cover the core lifecycle and prevent silent regressions.

## Verification Evidence

Completed on July 15, 2026:

- `npm run emulators:rules` from `backend`: passed 13/13 Firestore and Storage security rule tests, including direct-client denial for backend-owned RAILS items, item activity, tenant audit events, notification queue records, notification events, and evidence storage files.
- `npm run emulators:rails` from `backend`: passed 1/1 emulator-backed RAILS service integration test for real service writes, audit activity, notification records, evidence updates, standardization updates, and blocker enforcement.
- `node --import tsx --test test/railsEnterpriseReadiness.test.ts test/railsWorkflowPolicy.test.ts` from `backend`: passed 14/14 enterprise readiness and workflow policy tests.
- `node --import tsx --test test/railsEnterpriseReadiness.test.ts test/railsWorkflowPolicy.test.ts test/railsServiceEmulator.test.ts` from `backend`: passed 14/14 with the emulator-only integration suite intentionally skipped outside emulator execution.
- `npm run typecheck` from `backend`: passed.
- `npm run build` from `backend`: passed.
- `npm run typecheck` from `web`: passed.
- `npm run build` from `web`: passed. Vite reported large chunk warnings, which are performance hardening work rather than a failed build.

Remaining production hardening:

- Add broader end-to-end emulator scenarios for the full lifecycle across triage, action progress, verification, approval, close, reopen, cancel, archive, document upload, reporting, and export.
- Add performance tuning/code splitting for the existing large frontend chunks.
