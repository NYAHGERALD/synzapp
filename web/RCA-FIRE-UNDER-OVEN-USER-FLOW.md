# RCA User Flow: Fire Observed Under Oven From Flour Dust Accumulation

## Scenario

Problem statement:

> A fire was observed under the oven as a result of dust flour accumulation under the oven coming from the Die Cut production line.

Primary user:

- Plant Manager responsible for restoring production, protecting people, and preserving audit-ready evidence.

Supporting users:

- QA Manager
- Maintenance Manager
- Safety Lead
- Production Supervisor
- Sanitation Lead

Desired experience:

- The user should not feel like they are filling out an endless form.
- The user should feel like they entered a live investigation room.
- The canvas is the center of the entire RCA workflow.
- Forms only appear as focused overlays, drawers, or contextual panels when needed.

## Alignment With The Plant Manager Experience Brief

The attached plant-manager brief aligns with this direction, but it makes the required experience more explicit and stronger than the first draft. This file is adjusted to make those points non-negotiable:

- The user enters from operational pressure, not calm administration: production is down, OEE is at risk, and the RCA tool must feel like the last stop for resolution.
- The user lands directly in a full-screen canvas, not a list page or an endless form.
- The default canvas behavior is a modern industrial war room: pan, zoom, dot-grid surface, glass panels, live presence, and visible collaborator cursor movement.
- The methodology toolbar is the command center at the bottom of the screen, with `5 Whys`, `Fishbone`, and `Fault Tree`.
- For this incident, `Fishbone` is the starting method because the cause families span machine, method, material, people, measurement, and environment.
- Node cards must feel tactile: hover lift, drag movement, snap positioning, evidence count, root-cause styling, and active edit locks.
- Evidence must attach to the node it proves, not only to the incident header.
- Evidence uploads must show immutable hash feedback, specifically a SHA-256 ledger entry.
- Root cause selection must be visually obvious with red treatment and must require supporting evidence.
- CAPA actions must be created from verified causes and show enterprise execution feedback such as `SYNCING`, `VERIFIED`, and work-order references.
- Closing the investigation must run a pre-flight audit check before e-signature.
- E-signature must require re-authentication and an explicit consent phrase.
- After signing, the project becomes sealed, read-only, and exportable.
- The final audit package must include the canvas logic, evidence ledger, CAPA records, signature record, and package hash.

The implemented reference project on the RCA canvas follows that brief as a full start-to-finish example. It is intentionally not a blank demo: it opens as a sealed fire-under-oven RCA project with a dense Fishbone, verified root causes, hashed evidence, CAPA execution records, journey steps, movable canvas nodes, reset layout, and a downloadable audit package.

## End-To-End Flow Summary

1. The incident is opened from an alert or created manually from the RCA canvas.
2. The user lands directly in the RCA war-room canvas.
3. The user selects the best RCA methodology, most likely Fishbone for this event.
4. The canvas creates a guided visual structure for the investigation.
5. Users add cause nodes to the right categories.
6. Users attach evidence to specific nodes.
7. Users identify and verify the root cause.
8. Users create CAPA actions from the verified root cause.
9. CAPA actions sync to maintenance or execution systems.
10. The investigation passes a pre-flight audit check.
11. The user performs electronic sign-off.
12. The RCA is sealed and frozen.
13. The user downloads the audit package.

## 1. Incident Entry

### Option A: Incident Comes From An Alert

The plant manager receives a dashboard alert:

- Text: `New RCA incident - RPN 27`
- Context: `Fire observed under oven`
- Asset: `Die Cut production line / oven area`
- Risk: `Safety / fire / food safety exposure`

User action:

- Clicks the alert.

System response:

- Opens the RCA page.
- Bypasses any long incident form.
- Drops the user directly into the RCA canvas.
- Loads the incident header as a floating glass panel at the top-left of the canvas.

Animation:

- Canvas fades in over 180ms.
- Incident header slides down from the top-left with a subtle blur reveal.
- Bottom methodology toolbar rises from the bottom of the viewport.

### Option B: User Creates The Incident Manually

User action:

- Opens the Synzapp web app.
- Clicks `RCA` in the top navigation.
- Clicks the floating `Incident` button in the war-room header or bottom toolbar.

System response:

- Opens a centered `Initialize war room` modal.
- Background canvas dims and blurs.
- The modal asks only for the minimum needed to start the RCA:
  - Incident title
  - Asset, line, or process
  - Severity
  - Occurrence
  - Detection

User enters:

- Incident title: `Fire observed under oven`
- Asset/process: `Die Cut production line - oven area`
- Severity: high
- Occurrence: medium
- Detection: medium

System response:

- Calculates RPN live as the user changes values.
- If RPN is `>= 25`, the primary button reads `Open on canvas`.

User action:

- Clicks `Open on canvas`.

Animation:

- Modal compresses slightly and fades out.
- Canvas zooms gently toward the center.
- A new investigation session appears on the canvas.

## 2. War-Room Canvas Opens

The full screen becomes the RCA canvas.

Visible UI:

- Dot-grid canvas background.
- Top-left floating incident panel:
  - `New RCA incident - RPN 27`
  - `Fire observed under oven`
  - Asset: `Die Cut production line - oven area`
  - Department/site context
- Top-right live presence panel:
  - Plant Manager avatar
  - QA Manager avatar if online
  - Maintenance Manager avatar if online
- Bottom dark glass toolbar:
  - `Incident`
  - `5 Whys`
  - `Fishbone`
  - `Fault Tree`
  - `Add Node`
  - Later: `Close Investigation`

User mental model:

- The page is not a form.
- The page is a board where the investigation is built visually.

## 3. Choosing The Methodology

For this problem statement, Fishbone is the best starting methodology because the event can involve multiple cause families:

- People
- Machine
- Method
- Material
- Measurement
- Environment

User action:

- Clicks `Fishbone` on the bottom toolbar.

System response:

- The toolbar selected state moves to `Fishbone`.
- The canvas draws a horizontal spine.
- Category bones appear at angles:
  - People
  - Machine
  - Method
  - Material
  - Measurement
  - Environment

Animation:

- Spine draws from left to right in about 350ms.
- Category bones fade and slide into place.
- Existing nodes, if any, animate into their Fishbone positions.

## 4. Adding The First Cause Nodes

The plant manager begins building the logic.

User action:

- Clicks `Add Node`.

System response:

- A new node card appears near the active canvas area.
- The card is in edit-ready state.
- The card has a subtle white glass surface and a shadow.

User enters first node:

- `Flour dust accumulation observed under oven`

User action:

- Drags the node to the `Material` or `Environment` bone.

System response:

- The node snaps to the closest valid Fishbone branch.
- The node stores:
  - node type
  - parent category
  - canvas position
  - user who created it

Animation:

- Card lifts on drag.
- Branch highlight appears when hovering over a valid target.
- Card snaps into place with a 160ms easing motion.

## 5. Real-Time Collaboration And Edit Locking

The QA Manager joins the same RCA session.

System response:

- QA Manager avatar appears in the top-right presence panel.
- QA Manager cursor appears on the canvas with a name label.

User action:

- Plant Manager clicks the node text.

System response:

- Node enters locked editing mode.
- A small lock indicator appears on the node.
- Other users can see the lock and cannot edit that node until released.

User updates node:

- `Flour dust accumulation under oven from Die Cut production line`

System response:

- Changes are saved.
- On blur, the lock clears.

Animation:

- Lock chip fades in.
- Node border brightens while active.
- Lock chip fades out when released.

## 6. Expanding The Investigation

The team adds more nodes across the Fishbone.

### Machine

Possible nodes:

- `Oven lower panel not sealed properly`
- `Airflow pulled flour dust beneath oven`
- `Heat source exposed dust accumulation`

### Method

Possible nodes:

- `Cleaning frequency under oven not adequate`
- `No standard check for dust under oven before startup`
- `Die Cut line changeover did not include under-oven inspection`

### Material

Possible nodes:

- `Fine flour dust migrated from Die Cut process`
- `Dust particle size increased ignition risk`

### People

Possible nodes:

- `Operators were not assigned ownership for under-oven inspection`
- `Sanitation handoff did not call out flour dust under oven`

### Environment

Possible nodes:

- `Air movement carried flour dust toward oven area`
- `Restricted access made under-oven dust hard to see`

User interaction:

- User clicks `Add Node`.
- User types the cause.
- User drags it to the correct category.
- User connects it under a parent cause if it is a deeper cause.

System response:

- Parent-child relationships create graph edges.
- Fishbone layout updates without requiring manual line drawing.
- Nodes remain movable for investigation flexibility.

## 7. Switching To 5 Whys For A Specific Cause

The team wants to drill into one branch:

- `Flour dust accumulation under oven from Die Cut production line`

User action:

- Selects the node.
- Opens the inspector drawer.
- Clicks `Start 5 Whys from this cause`.

System response:

- A focused 5 Whys chain appears on the same canvas.
- The original Fishbone stays available.
- The selected cause becomes the starting point.

Example 5 Whys chain:

1. Why was there fire under the oven?
   - Flour dust accumulated near a heat source.
2. Why did flour dust accumulate there?
   - Dust migrated from the Die Cut production line and settled under the oven.
3. Why was the dust not removed?
   - Under-oven cleaning was not part of the daily sanitation verification.
4. Why was it not part of daily verification?
   - The standard work checklist did not identify the under-oven area as a dust collection point.
5. Why was the checklist missing that area?
   - No prior RCA or risk assessment linked Die Cut flour dust migration to oven fire risk.

System response:

- The 5 Whys chain is stored as linked nodes.
- The chain can be viewed inside the same canvas.

## 8. Opening The Slide-Out Inspector

User action:

- Clicks the node: `Flour dust accumulation under oven from Die Cut production line`.

System response:

- Right-side inspector drawer slides in.
- Canvas dims slightly but remains visible.
- The selected node is highlighted on the canvas.

Drawer sections:

- Node summary
- Cause description
- Parent relationship
- Root cause toggle
- Evidence locker
- CAPA actions
- Audit history

Animation:

- Drawer slides in from the right over 260ms.
- Canvas gets a subtle blur and dark overlay.
- Selected node pulses once.

## 9. Adding Evidence

The plant manager needs proof.

Evidence examples:

- Photo of burnt area under oven
- Photo of flour dust accumulation before cleanup
- Sanitation checklist showing missing under-oven inspection
- Maintenance inspection record
- Thermal image of hot area
- Production line dust migration observation

User action:

- Opens the selected node inspector.
- Drags a photo into the `Evidence Locker` dropzone.

System response:

- Upload begins.
- Progress bar appears.
- File is stored in immutable evidence storage.
- Backend calculates SHA-256 hash.
- Evidence log is attached to the selected node.

Animation:

- Dropzone border changes from dashed gray to cyan.
- Upload progress fills left to right.
- On completion, a green verification badge appears.

After upload, the evidence item shows:

- File name
- Uploaded by
- Upload timestamp
- SHA-256 hash
- Node linked to evidence
- Status: `Verified`

Canvas response:

- Node card now shows an evidence icon or evidence count.
- Node can now be marked as a verified root cause.

## 10. Marking The Root Cause

The team agrees the verified root cause is:

`Daily sanitation standard work did not include under-oven dust verification for flour migration from Die Cut production line.`

User action:

- In the inspector, toggles `Confirmed root cause`.

System validation:

- If no evidence is attached:
  - Toggle is blocked.
  - Message appears: `A verified root cause must contain supporting evidence.`
- If evidence exists:
  - Root cause is accepted.

System response:

- Node gets a thick red left border.
- Node background gets a subtle red tint.
- A `Root Cause` chip appears on the node.
- The RCA pre-flight checklist updates.

Animation:

- Node border animates from slate to red.
- Root cause chip fades in.
- The root cause appears in the investigation summary.

## 11. Creating CAPA From The Root Cause

Finding the cause is not enough. The user now creates corrective and preventive actions.

User action:

- In the inspector, scrolls to `Actions`.
- Clicks `Add Corrective Action`.

System response:

- Inline CAPA composer opens inside the drawer.

User enters corrective action:

- `Remove flour dust under oven and inspect lower oven panel for heat damage.`

User assigns:

- Owner: `Maintenance`
- Due date: today
- Target system: `SAP PM` or `Maximo`

User action:

- Clicks `Sync work order`.

System response:

- CAPA status changes to `SYNCING`.
- Backend sends work order payload to the target system.
- When accepted, status changes to `EXTERNAL_PENDING`.
- External ticket ID appears.

Example:

- `SAP-WO-88912`

User creates preventive action:

- `Update daily sanitation standard work to include under-oven dust inspection after Die Cut production.`

Additional preventive action:

- `Add weekly airflow and dust migration inspection between Die Cut line and oven area.`

System response:

- CAPAs are linked to the verified root cause node.
- Canvas node displays CAPA count.
- CAPA matrix updates in the inspector.

## 12. Verifying CAPA Completion

Maintenance completes the work order.

System response:

- External system sends status update back.
- CAPA status changes:
  - `EXTERNAL_PENDING` to `COMPLETED`
  - Then `VERIFIED` after internal verification

User action:

- Maintenance Manager or Plant Manager opens CAPA row.
- Reviews completion evidence.
- Clicks `Verify`.

System response:

- CAPA row turns green.
- Root cause node now shows:
  - Evidence count
  - CAPA count
  - Verified actions

## 13. Closing The Investigation

User action:

- Clicks `Close Investigation` from the top-right or bottom toolbar.

System response:

- Opens `Audit Pre-Flight` modal.
- Canvas is visible behind the modal.
- Modal checks investigation requirements.

Pre-flight checklist:

- Incident has a problem statement.
- At least one methodology was used.
- At least one root cause is confirmed.
- Every confirmed root cause has evidence.
- Every CAPA is completed or verified.
- Required participants are recorded.
- Audit trail is complete.

If something is missing:

- The failed item is red.
- The close button is disabled.
- Clicking the failed item pans the canvas to the missing node or opens the relevant drawer section.

If everything passes:

- `Proceed to E-Signature` becomes active.

Animation:

- Checklist rows animate in one by one.
- Passed rows show green status.
- Failed rows show red status and a jump-to-action control.

## 14. Electronic Signature

User action:

- Clicks `Proceed to E-Signature`.

System response:

- Opens sign-off modal.
- Requires re-authentication.
- Requires typed consent phrase.

Consent phrase:

- `I approve these findings`

User enters:

- Password or re-auth method
- Consent phrase

User action:

- Clicks `Seal RCA`.

System response:

- Backend verifies recent authentication.
- Backend serializes RCA data:
  - Incident
  - Session
  - Nodes
  - Evidence hashes
  - CAPA records
  - Participants
  - Audit trail
- Backend generates SHA-512 audit hash.
- RCA session status changes to `CLOSED`.
- Firestore rules prevent future edits.

Animation:

- Modal shows sealing progress.
- Canvas freezes.
- Toolbar editing controls disappear.
- Node hover and drag states are disabled.
- A sealed banner appears at the top of the canvas.

## 15. Downloading The Audit Package

After sealing, the user sees:

- `Download Audit Package`
- `View Audit Hash`
- `Read-only RCA`

User action:

- Clicks `Download Audit Package`.

System response:

- Generates a watermarked PDF or audit package.
- Package includes:
  - Problem statement
  - Incident metadata
  - Fishbone diagram snapshot
  - 5 Whys chain if used
  - Fault Tree if used
  - Confirmed root causes
  - Evidence list with SHA-256 hashes
  - CAPA actions and external ticket IDs
  - Signatures
  - SHA-512 final RCA seal hash
  - Date and time closed

Animation:

- Button shows `Generating...`
- Progress indicator appears.
- When ready, button changes to `Download Ready`.

## 16. Final Read-Only State

The closed RCA is now immutable.

Canvas behavior:

- User can pan and zoom.
- User can click nodes to inspect.
- User cannot edit, drag, delete, or add nodes.
- Evidence is viewable but not replaceable.
- CAPA records are viewable but not editable.

Visual state:

- Top banner: `Sealed RCA - Read Only`
- Audit hash visible in summary panel.
- Download package button remains available.

## Feature Tools Used In This Flow

### Canvas Tools

- Pan
- Zoom
- Fit view
- Mini map
- Methodology switcher
- Add node
- Drag node
- Connect node
- Select node
- Inspect node

### Investigation Tools

- Fishbone categories
- 5 Whys chain
- Fault Tree branch logic
- Root cause toggle
- Evidence locker
- CAPA action matrix
- Audit pre-flight
- Electronic signature
- Audit package export

### Collaboration Tools

- Live presence avatars
- Live cursor
- Node edit lock
- User activity trail
- Participant audit record

## Critical UX Rules

- The RCA page must never become an endless form.
- The canvas must be the primary workspace from beginning to end.
- Forms must appear only as overlays, drawers, or contextual composers.
- Every node action should happen from the canvas or inspector.
- Evidence must attach to a specific node, not just the incident generally.
- CAPA must attach to a verified root cause node.
- Closing must be impossible until evidence and CAPA requirements are satisfied.
- After sealing, the RCA must become read-only.

## Implementation Gaps To Build Next

These are required to complete this full user flow:

- Real-time Firestore node sync using `onSnapshot`.
- Live cursor and presence heartbeat.
- Node-level edit lock on focus and release on blur.
- Drag-and-drop evidence upload.
- SHA-256 evidence hashing backend.
- Evidence log UI inside inspector.
- CAPA action model and UI.
- External SAP/Maximo/Jira sync adapters.
- Audit pre-flight modal.
- Re-authenticated electronic signature.
- SHA-512 final seal function.
- PDF audit package generation.
