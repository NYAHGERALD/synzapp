# RAILS to RCA Enterprise Linkage Plan

## Purpose

Make the RAILS `Link RCA` control a governed enterprise workflow, not a static dropdown value. A RAILS loop must be able to link an existing RCA, request RCA triage, mark RCA as not required with a controlled decision, or convert an accepted triage request into a real RCA project.

## Enterprise Principles

- RAILS owns the improvement loop.
- RCA owns root-cause investigation.
- The backend is the source of truth for every RCA decision.
- Every RCA decision must be auditable and tenant-scoped.
- Users must not be able to bypass the triage gate by editing display text.
- Legacy `linkedRca` text remains readable, but new decisions use structured RCA decision data.

## Flow

1. **No RCA Decision**
   - New loops start without a completed RCA decision.
   - The triage gate blocks advancement until a valid RCA decision exists.

2. **Link Existing RCA**
   - User selects an accessible RCA project from backend-provided candidates.
   - Backend validates tenant access before saving.
   - RAILS stores the RCA ID, display label, decision status, linked time, and actor.

3. **Request RCA Triage**
   - User requests RCA triage from the RAILS loop.
   - Backend creates a structured triage request with reason, assigned reviewer, due date, requester, timestamp, and status.
   - RAILS shows the request state and audit history.

4. **RCA Not Required**
   - User records a controlled decision that RCA is not required.
   - Backend stores the reason, actor, timestamp, and RCA decision state.

5. **Convert Triage to RCA**
   - User converts a requested RCA triage into a real RCA incident.
   - Backend creates the RCA project, links it back to the RAILS loop, and updates the triage request as converted.

## UI Requirements

- `Link RCA` dropdown must show:
  - Not linked
  - Request RCA triage
  - RCA not required
  - Existing RCA projects from backend candidates
- When triage is requested, show a governed triage panel with:
  - Status
  - Assigned reviewer
  - Due date
  - Reason
  - Create RCA project action
- When linked, show the real RCA display ID and title.

## Backend Requirements

- Add structured RCA decision fields to RAILS records.
- Validate all RCA links server-side.
- Create audit comments/events for triage request, not-required decision, link, unlink, and conversion.
- Create RCA incident from RAILS triage without exposing internal IDs as the source of truth.
- Keep workflow gates tied to structured state.

## Implementation Status

- [x] Plan documented.
- [x] Backend structured RCA decision model.
- [x] Backend RCA triage request endpoint.
- [x] Backend RCA conversion endpoint.
- [x] Backend gate tied to structured RCA decisions.
- [x] Frontend API contracts.
- [x] Frontend Link RCA enterprise controls.
- [x] Typecheck, build, and workflow policy tests.
