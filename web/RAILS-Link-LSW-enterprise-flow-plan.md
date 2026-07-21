# RAILS Link LSW Enterprise Flow Plan

## Purpose

`Link LSW` makes the RAILS loop traceable to the Leaders Standard Work record that found the issue. RAILS should not treat the LSW value as free text. It should be a controlled, backend-validated source reference that proves where the loop came from.

## Enterprise Principle

Every RAILS loop must have a defensible origin before it can move from `New` to `Triaged`.

Accepted origin paths:

- `Linked LSW`: the loop is tied to a real LSW source record in the same company.
- `Linked RCA`: the loop is tied to a real RCA project in the same company.
- `Manual enterprise intake`: no LSW/RCA source exists, so the creator must document a clear source justification.

## Supported LSW Sources

Initial enterprise implementation links to existing LSW records already available in the backend:

- To-do task
- Meeting rail
- Follow-up
- RCA trigger
- Improvement project

The link stores source type, source ID, title, owner, department, date, and display label. The backend validates the record instead of trusting client text.

## RAILS Flow Integration

### New

The loop is created or received into RAILS. The owner must establish origin traceability:

- Select a valid LSW source, or
- Link a valid RCA project, or
- Enter a manual source justification.

### New To Triaged Gate

The backend blocks advancement until:

- Accountable owner is assigned.
- Department is assigned.
- Due date and priority are set.
- Problem statement and title are documented.
- Action plan exists.
- RCA decision is made.
- Origin source is valid: LSW, RCA, or manual justification.
- Evidence placeholders exist.

### In Progress

RAILS owns execution of the improvement work. The linked LSW source remains the discovery record and audit trail origin.

### Verification And Closure

When the loop closes, the audit history proves:

- LSW found the issue.
- RAILS controlled containment, corrective action, verification, and standardization.
- The new standard can be absorbed back into LSW through checklist/audit/training updates.

## Practical Example

A Bakery Supervisor performs LSW and records:

`Cooling conveyor guard missing after line stop`

The supervisor creates or links a RAILS loop:

- RAILS title: `Cooling conveyor guard missing after line stop`
- Linked LSW: `To-do task: Cooling conveyor guard missing after line stop`
- Department: `Bakery`
- Origin: `LSW`

The RAILS loop cannot move to `Triaged` until the source is verified and the RCA decision is made. After execution, verification, and standardization, the closed RAILS loop proves the issue was found, escalated, corrected, verified, standardized, and retained in history.

## Security And Governance

- Client cannot submit arbitrary LSW labels as truth.
- Backend validates source ID and source type.
- Source must belong to the same tenant and authorized LSW profile scope.
- Source changes are written to RAILS audit history.
- Manual intake requires justification so the absence of LSW/RCA is explicit.
- RAILS remains the governed improvement workflow; LSW remains the discovery/standard-work surface.

## Implementation Steps

1. Add backend LSW source candidate listing for RAILS.
2. Add structured `linkedLswSource` fields to RAILS item records and API responses.
3. Add backend validation when linking or clearing an LSW source.
4. Add New-to-Triaged origin gate.
5. Add frontend Link LSW selector and source summary.
6. Add manual source justification field.
7. Add audit summaries for LSW link changes.
8. Validate with typecheck, backend build, frontend build, and workflow tests.
