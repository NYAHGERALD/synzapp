# RAILS Guided Detail Workflow Plan

## Objective

Turn the RAILS Loop Detail panel into a controlled, paginated enterprise workflow instead of one long scrolling form. The feature must keep evidence centralized, preserve auditability, and keep backend workflow gates as the source of truth.

## Enterprise Workflow

1. Overview
   - Own the loop metadata, owner, due date, RCA decision, approver, and workflow gate status.
   - Show collaboration from the available company users.

2. Actions
   - Manage containment, corrective action, and effectiveness/standardization actions.
   - Require governed documentation before an action can be completed.
   - Use backend-created timestamps as official start and completion records.
   - Allow controlled correction only with a correction reason.

3. Evidence Library
   - Provide one centralized upload area for photos, PDFs, documents, screenshots, and pasted evidence.
   - Display uploaded evidence with thumbnails for photos and openable file rows for documents.
   - Let other workflow pages link evidence by checkbox instead of creating duplicate upload points.

4. Verification
   - Show readiness to move from action completion into verification.
   - Summarize gate blockers and action evidence requirements.
   - Keep backend gate enforcement authoritative.

5. Standardization
   - Manage the target, standardization type, owner, due date, verification method, document versioning, and formal verification.
   - Keep the final verification button disabled until every closure requirement is met.

6. Closure
   - Handle controlled cancel, archive, and reopen actions with a required disposition reason.
   - Show workflow completion and remaining blockers before final disposition.

## Controls

- Backend gates remain mandatory for status movement and action completion.
- The frontend may guide page navigation, but it must not be trusted as the only control.
- Evidence is uploaded once, then linked to the action, verification, or standardization step that needs it.
- The audit log remains separate and immutable in the Log tab.

## Implementation Steps

1. Add a guided detail page state and page definitions.
2. Add a compact detail stepper under the loop title/actions.
3. Split the Detail tab into paginated page groups.
4. Add footer navigation for Previous, Next, and standardization verification.
5. Keep the Evidence Library as the central upload point and keep evidence linking inside governed action records.
6. Add responsive, enterprise styling with normal font weights.
7. Run frontend typecheck and production build.
