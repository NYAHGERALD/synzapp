# Synzapp Interpreter Session List Management Plan

## Objective

Improve the Interpreter session list so creating a meeting returns the user to the list, shows the new session as not started, and lets the user deliberately enter the live room. Add professional list management: stronger swipe-to-delete, native list options, search, filters, multi-select delete, and native delete warnings.

## Guardrails

- Do not change the controlled GPT Live room behavior. The working Listen -> Respond gate must remain untouched.
- Do not start a realtime session during meeting creation.
- Keep deletion behind native confirmation alerts.
- Use the existing secure backend delete endpoint for each selected meeting.
- Keep live sessions protected from deletion until they are ended.
- Scheduled meeting notifications and reminders must continue to work.

## Backend Flow

- Newly created Interpreter meetings should stay in the not-started state until the user enters the room and starts live audio.
- Scheduled meetings keep their scheduled date and reminder behavior.
- The existing start endpoint promotes the session to `LIVE` when the live room actually starts.

## Mobile List Flow

- Create Session closes the create modal and leaves the user on the Interpreter list.
- The create modal closes immediately after the form is validated and submitted.
- A compact pending row appears on the list while the backend creates the session.
- The real session row replaces the pending state when the backend returns, then the list refreshes from the backend source of truth so the first created session cannot be lost by local state timing.
- The create button uses a dedicated create-in-progress state so list refresh, row opening, and other interpreter work cannot leave the create sheet stuck.
- The mobile create request is not aborted during token/device-header preparation. If the request takes longer than expected, the list performs a non-destructive recovery refresh while the original create request continues.
- Device identity headers are collected with a short bounded wait. If cold device registration is slow, the authenticated create request still reaches the backend and the device header is allowed to recover on later requests.
- Rows show:
  - Meeting name
  - Meeting type
  - Scheduled date/time when present
  - Status as `Not started`, `Live`, or `Ended`
- Tapping a row enters the live room.

## Create Response Reliability

- The backend create endpoint returns after the meeting record is saved.
- Audit and push-notification lifecycle work runs as controlled background side effects and logs failures without blocking the create response.
- This prevents the mobile sheet from spinning after the session already exists in the list.

## Session Actions

- Swipe left distance is increased so delete does not trigger accidentally.
- The red Delete action remains visible after a committed swipe and must be tapped.
- Native top-right options:
  - Search
  - Filter
  - Delete sessions
- Delete mode:
  - Shows a checkbox on every visible row.
  - Shows Select All for the visible filtered list.
  - Shows Delete only when one or more rows are selected.
  - Uses a native warning alert before deleting.

## Search And Filter

- Search is a floating rounded bar under the header.
- Search matches meeting name and meeting type.
- Filter sheet supports:
  - Name contains
  - Meeting type
  - Date created window

## Validation

- Mobile TypeScript typecheck.
- Backend TypeScript typecheck.
- Focused interpreter enterprise control test.
- Backend deployment is required because meeting creation status changes on the backend.
