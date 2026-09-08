# Synzapp Create Action Plan

Source of truth for the Create Action feature. Written before any code is
changed. If the code and this document disagree, one of them is wrong and it
must be settled here first.

Status: awaiting approval. Nothing has been built.
Written: 3 September 2026.

---

> What happens to an action **after** it is raised — who may see it, how it
> is cancelled, what is audited and for how long — is in
> [SYNZAPP_ACTIONS_GOVERNANCE_PLAN.md](SYNZAPP_ACTIONS_GOVERNANCE_PLAN.md).

## 1. What this feature is

A person in a group chat sends a message describing a problem:

> "Issue with tortillas on line 5"

Anybody can long press that message and choose **Create Action**. They pick the
department that owns the fix, optionally a named person, a priority and a due
date, attach photos or video, and send. The action appears immediately in the
responsible department's group as a distinct bubble. Somebody there works it,
marks it done with a note, and the result posts back into the chat where the
problem was first raised, time stamped and marked unverified. The person who
raised it, or a supervisor, verifies it. The bubble then reads Verified.

## 2. Why this is worth building

The value is not task management. Companies already have task tools and the
people on a plant floor do not log into them.

The value is **closing the loop**. Today a problem is spotted by the person
closest to it, typed into a chat, and then scrolls away. Nobody learns whether
it was fixed. Every industry Synzapp targets has this same hole: food
manufacturing, warehouse, construction, health, sanitation, maintenance.

Two properties make this different from a task feature bolted onto a chat:

1. **It starts from a message that already exists.** Nobody has to learn a new
   screen, choose a template, or describe the problem twice. The description is
   already written, by the right person, in their own words.
2. **The answer comes back to where the question was asked.** Slack and Teams
   can push a message into an external task tool, and the loop breaks there. Ours
   returns, with a time stamp and a verification.

That is the sentence a buyer understands: *the report, the fix and the proof are
in one thread.*

## 3. Hard boundary: what must never be touched

**RAILS and LSW are finished, working, shipped features. This work must not
change their behaviour in any way.**

Specifically off limits:

| Area | Files | Rule |
| --- | --- | --- |
| RAILS backend | `backend/src/services/railsService.ts` (6,225 lines), `backend/src/routes/railsRoutes.ts`, `backend/src/services/railsKnowledgeService.ts` | No edits |
| RAILS web | `web/src/RailsWorkspace.tsx` (8,288 lines), `web/src/railsApi.ts`, `web/src/EvidenceLibraryWindow.tsx` | No edits |
| LSW backend | `backend/src/services/lswService.ts`, `backend/src/routes/lswRoutes.ts`, `backend/src/services/lswExcelExportService.ts` | No edits |
| LSW web | `web/src/LswPrototype.tsx`, `web/src/lswApi.ts` | No edits |
| RCA | `backend/src/services/rcaService.ts`, `web/src/RcaWorkspace.tsx` | No edits |
| API routes | `/api/rails`, `/api/lsw` in `backend/src/app.ts` | Stay mounted, unchanged |
| Interpreter | Interpreter session code | No edits, as previously agreed |

The only RAILS related change anywhere in this plan is removing **one menu row**
from the chat long press sheet, plus the mobile-only code that row alone reaches.
The RAILS product keeps working exactly as it does now. A RAILS item can still be
created from the RAILS workspace on the web.

### 3.1 The trap, found before writing this

`mobile/src/components/rails/AddChatMessageToRailsModal.tsx` is **not** only a
RAILS modal. It is a shared file. It exports six things, and four of them are
used by features that have nothing to do with RAILS:

| Export | Used by |
| --- | --- |
| `AddChatMessageToRailsModal` | RAILS chat entry only |
| `ChatToRailsDraft` | RAILS chat entry only |
| `EditableChatActionText` | **LSW To Do modal, LSW Follow Ups modal** |
| `ChatLswDateControl` | **LSW To Do modal, LSW Follow Ups modal** |
| `formatScheduleDate` | **Calls: ScheduleCallPickerModal, CallHistoryRow** |
| `formatScheduleTime` | **Calls: ScheduleCallPickerModal, CallHistoryRow** |

**Deleting that file would break Add To Do, Add Follow Ups, the scheduled call
picker and the call history row.** Four working features, none of them RAILS.

This is why section 10 extracts the shared parts into a neutral file first, and
only then removes the RAILS specific parts. The removal is done in that order or
it is not done at all.

Also noted: `mobile/src/services/adminChatSupport.ts` exports
`getRailsOwnerLabel` and `truncateTextForRails`, typed against `RailsUserSummary`.
These are checked for other callers before anything is removed.

## 4. Where I changed the original idea, and why

The idea as described was sound. Seven changes, each with the reason, because a
plan that only records the conclusion is useless in six months.

### 4.1 Only the raiser or a supervisor can verify

**Original:** anyone in the group can long press and verify.

**Problem:** if anyone can verify, the person who did the work can sign off their
own work, and verification proves nothing. This is the first thing an auditor
looks for in food safety, maintenance and health.

**Change:** Verify is available to the person who raised the action, to an Org
Admin, to the Department Admin of the raising department, or to anybody holding a
new `actions.verify` permission. **Never to the person who marked it done**, even
if they otherwise hold the permission.

### 4.2 Department is required, person is optional

**Original:** a responsible party and a responsible department, both chosen.

**Problem:** an action owned by one named person dies quietly when that person is
sick, on holiday, on another shift, or has left the company.

**Change:** the department or group is required. The named person is optional.
The group always sees every action assigned to it, so nothing hides behind one
name. Somebody in the group can claim an unassigned action.

### 4.3 Due date, not start date

**Original:** add a start date when working the action.

**Problem:** a start date answers no question anybody asks. Due date drives
everything that matters: what is overdue, what gets chased, what a supervisor
reviews on Monday.

**Change:** due date is set when the action is created. Start date is kept as an
optional field recorded when work begins, because it is genuinely useful for
measuring how long things sit before anybody picks them up.

### 4.4 Five states, not two

**Original:** status becomes Done.

**Problem:** real maintenance work sits waiting on a part, an engineer, or a line
stop. With nowhere to record that, people either mark things Done that are not
done, or leave them Open forever until the list is noise nobody reads.

**Change:** `OPEN`, `IN_PROGRESS`, `BLOCKED`, `DONE`, `VERIFIED`. `BLOCKED`
requires a reason in words.

### 4.5 Completion posts back automatically

**Original:** mark Done, a Send button appears, tap it to forward back to the
originating chat.

**Problem:** that second tap is exactly where the loop breaks. Some people will
mark Done and never tap Send, and the chat that raised the problem never learns
it was fixed. The feature then fails at the one job it exists to do.

**Change:** marking Done opens a small completion box asking for a note and
optionally a photo. Posting back is automatic once that is confirmed. One step.
The note is the thing worth asking for, not the tap.

### 4.6 Actions are company records, not chat messages

**Original:** implied that the action travels like a message.

**Problem:** chat is end to end encrypted with per device envelopes. An action
created in group A and worked in group B crosses a group boundary, and the counts
at the top of the screen have to be counted somewhere. Counting encrypted records
on the phone works for ten and dies at ten thousand.

**Change:** actions follow the **announcement storage model**, not the chat
message model. See section 8. This is a deliberate, visible privacy decision, not
an accident.

### 4.7 One action per message

**Original:** not specified.

**Problem:** two people long press the same message and two actions exist for one
problem, assigned to two departments.

**Change:** if an action already exists for a message, the menu offers to open it
rather than create a second. Creating a deliberate second action is still
possible from inside the first.

## 5. Open decisions for Gerald

These change the work and are not mine to decide.

### 5.1 The long press menu: decided, one door

**Decided 3 September 2026. Create Action is the only row on the More page.**

The More page today offers Add to RAILS, Add To Do and Add Follow Ups. All three
are removed. Create Action replaces them.

The reason: three rows all meaning "somebody should deal with this" is one too
many, and a night shift operator will pick wrong or pick nothing.

**What this does not do.** It does not touch RAILS or LSW. Both keep every
feature they have today:

- RAILS items are still created from the RAILS workspace on the web.
- LSW To Do items are still created inside the LSW workspace, by
  `handleAddLswTodoTask` at `AdminChatScreen.tsx:2370`.
- LSW Follow Ups are still created inside the LSW workspace, by
  `handleAddLswFollowUp` at `AdminChatScreen.tsx:2414`.

**Verified before removal**, not assumed. Those two handlers call
`createLswTodoTask` and `createLswFollowUp` directly and do not go through the
chat menu at all. Removing the chat rows removes a shortcut from a message, not
the ability to create the item.

**What is genuinely lost.** Today somebody can turn a chat message straight into
an LSW To Do or Follow Up. After this they cannot, and would create an Action
instead, or add the item in the LSW workspace by hand. This is a deliberate trade
for one clear door into the chat, and it is recorded here so nobody is surprised
by it later.

### 5.2 Whether an action can also raise a RAILS item

A tick box inside Create Action saying "also add to RAILS" would preserve today's
capability for anyone using it. It would call the existing RAILS API without
changing RAILS code.

**Not in this plan.** Recorded as a possible later addition, so removing the menu
row is reversible in effect if not in code.

### 5.3 Whether the completion post back is visible to the whole originating group

My assumption: yes, it posts into the originating chat where everyone sees it,
because public closure is the point. Say so if you want it private to the raiser.

## 6. Roles and permissions

New permission keys:

| Key | Meaning | Default holders |
| --- | --- | --- |
| `actions.create` | Can turn a message into an action | Every active employee |
| `actions.verify` | Can verify a completed action | Org Admin, Department Admin |

Rules enforced on the server, never only in the app:

1. To create an action you must be an active member of the chat the message came
   from. Removed employees are refused, consistent with existing behaviour.
2. You may assign to any department or group in your organization. Assignment is
   not restricted, because the person who spots a problem often does not know the
   org chart, and a misrouted action is better than an unreported one.
3. Only a member of the responsible group, a Department Admin of the responsible
   department, or an Org Admin may change status.
4. Verify: the raiser, an Org Admin, the raising Department Admin, or a holder of
   `actions.verify`. **Never the person who marked it done.**
5. Every state change records who and when. These are not editable.

## 7. Data model

Mirrors the announcements collections, which are already proven at 5,000 people.

```
organizations/{tenantId}/actions/{actionId}
  actionId
  tenantId
  title                     text, editable at creation, max 500
  sourceChatId              the chat the message came from
  sourceMessageId           the message it was created from
  sourceChatName            captured at creation so it survives a rename
  responsibleGroupId        required
  responsibleGroupName      captured at creation
  responsibleDepartmentId   nullable
  responsiblePersonUid      nullable
  responsiblePersonName     nullable
  priority                  CRITICAL | HIGH | MEDIUM | LOW
  status                    OPEN | IN_PROGRESS | BLOCKED | DONE | VERIFIED
  blockedReason             nullable, required when BLOCKED
  dueAtMs                   nullable
  startedAtMs               nullable
  createdByUid / createdByName / createdAtMs
  completedByUid / completedByName / completedAtMs
  completionNote            nullable
  verifiedByUid / verifiedByName / verifiedAtMs
  attachmentCount           number, for the collapsed bubble
  bodyRemovedAtMs           nullable, set by retention
  updatedAtMs

organizations/{tenantId}/actions/{actionId}/events/{eventId}
  eventId, kind, actorUid, actorName, atMs, fromStatus, toStatus, note

organizations/{tenantId}/actions/{actionId}/attachments/{attachmentId}
  attachmentId, kind (image | video), storagePath, sizeBytes,
  durationMs (video), uploadedByUid, uploadedAtMs
```

Counters held on the group document so the header counts are a read, never a
count over rows. This is the lesson already learned on announcements:

```
organizations/{tenantId}/groups/{groupId}
  openActionCount           incremented and decremented in a transaction
  unverifiedActionCount
```

Composite indexes required:

- `actions` by `responsibleGroupId` + `status` + `createdAtMs desc`
- `actions` by `sourceChatId` + `createdAtMs desc`
- `actions` by `responsiblePersonUid` + `status` + `dueAtMs asc`

These are added to `firestore.indexes.json` before the feature is deployed, not
after the first customer hits a missing index error.

## 8. Encryption and the privacy position

This must be stated plainly because it is a real change.

Chat messages are end to end encrypted. **Action records are not.** They follow
the announcement model: stored server side, so they can be counted, listed,
retained, held and exported.

Why this is the right line:

- Counts and lists must be instant for a group with thousands of actions. That is
  impossible if only the phone can read them.
- An action exists precisely to become a company record. That is what the user is
  asking for when they create one.
- It matches how announcements already work, so there is one rule to explain, not
  two.

What this obliges us to do:

1. **The Create Action screen says so, in plain words, before sending.** Something
   close to: "This becomes a company record. Your organization can see it, keep
   it, and export it." Not buried in settings.
2. **The privacy policy gains a sentence**, in `web/src/policyContent.ts` and
   `backend/scripts/policyDrafts/privacy.txt`, the same way announcements did.
3. **Retention, legal hold and export apply**, section 13.

The original chat message stays encrypted and untouched. Creating an action
copies its text into a record because a person deliberately chose to escalate it.

## 9. Backend

New files only. Nothing existing is edited except `app.ts` to mount the route.

- `backend/src/services/actionService.ts`
- `backend/src/routes/actionRoutes.ts`
- `backend/src/services/authorizationPolicy.ts` gains `canCreateAction`,
  `canChangeActionStatus`, `canVerifyAction`. Additive only, no existing function
  is changed.
- `backend/src/app.ts` gains one line: `app.use('/api/actions', actionRouter);`

Endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/actions` | Create from a message |
| GET | `/api/actions` | List, filtered by group, status, assignee |
| GET | `/api/actions/:id` | One action with its events |
| POST | `/api/actions/:id/status` | Change status, with note or blocked reason |
| POST | `/api/actions/:id/verify` | Verify a done action |
| GET | `/api/actions/counts` | Counters for a group header |
| GET | `/api/actions/:id/attachments` | Signed URLs for media |

Every write is a transaction that updates the action, appends an event, and
adjusts the group counters together. A status change that half applies is worse
than one that fails.

## 10. Removing Add to RAILS from the chat, safely

Done in this order. Each step is verified before the next begins.

**Step 1. Extract the shared parts.**
Create `mobile/src/components/chat/chatActionControls.tsx` holding
`EditableChatActionText`, `ChatLswDateControl`, `formatScheduleDate` and
`formatScheduleTime`, moved unchanged. Not rewritten, not improved, moved.

**Step 2. Repoint the five importers** to the new file:
`AdminChatScreen.tsx`, `ScheduleCallPickerModal.tsx`, `CallHistoryRow.tsx`,
`AddChatMessageToTodoModal.tsx`, `AddChatMessageToFollowUpModal.tsx`.

**Step 3. Verify nothing broke.** Typecheck, full mobile test run, and by hand:
open Add To Do, open Add Follow Ups, open the scheduled call picker, open call
history. All four must behave exactly as before. **If any of these is wrong, stop
and revert.**

**Step 4. Prove the LSW workspace can still create To Do items and Follow Ups
without the chat.** Open the LSW workspace on a device, add a To Do, add a Follow
Up. Both must work. **If either does not, stop.** The chat rows are the only other
path and they must not be removed until this is proven.

**Step 5. Remove the three chat entry points.**

RAILS:
- The `Add to RAILS` row in `MessageThread.tsx` around line 2119
- The `onAddToRails` prop and its wiring
- `AddChatMessageToRailsModal` and `ChatToRailsDraft`
- `handleAddThreadMessageToRails` and the RAILS draft state in
  `AdminChatScreen.tsx`, roughly lines 10046 to 10305
- `mobile/src/services/railsApi.ts` only if nothing else imports it after this
- `getRailsOwnerLabel` and `truncateTextForRails` in `adminChatSupport.ts` only if
  they have no other callers

LSW chat shortcuts:
- The `Add To Do` and `Add Follow Ups` rows in `MessageThread.tsx`
- The `onAddToTodo` and `onAddToFollowUp` props and their wiring
- `AddChatMessageToTodoModal.tsx` and `AddChatMessageToFollowUpModal.tsx`
- `chatTodoDraft` and `chatFollowUpDraft` state, and the chat-only handlers around
  lines 10365 to 10620 in `AdminChatScreen.tsx`

**Kept, deliberately:** `createLswTodoTask` and `createLswFollowUp` in
`lswApi.ts`, and `handleAddLswTodoTask` and `handleAddLswFollowUp` in
`AdminChatScreen.tsx`. These are the LSW workspace's own paths. They are not
chat code and they are not touched.

**Step 6. Confirm RAILS and LSW are untouched.**
`backend/src/services/railsService.ts`, `backend/src/routes/railsRoutes.ts`,
`backend/src/services/lswService.ts`, `backend/src/routes/lswRoutes.ts`,
`web/src/RailsWorkspace.tsx`, `web/src/railsApi.ts`, `web/src/LswPrototype.tsx`
and `web/src/lswApi.ts` show zero changes in `git diff`. Checked, not assumed.

**Step 7. Add the single Create Action row** where the three rows used to be.

## 11. Mobile UI

**Create Action sheet.** Full height modal. The message text shown and editable.
Department picker, required. Person picker, optional, filtered to the chosen
department but not limited to it. Priority. Due date. Attach photos and video.
The record notice from section 8.2. Send.

Sending is optimistic. The action appears immediately and uploads continue in the
background, matching how chat media already behaves. A failed upload shows on the
bubble with a retry, it does not lose the action.

**The action bubble** in the responsible group. Distinct from a message: a left
edge colour by priority, the title, the responsible person or "Unassigned", a
status pill, and collapsed media showing the first image with a count. Tapping
opens the detail sheet.

**Detail sheet.** Full height. Title, who raised it and from which chat, priority,
due date, media gallery, the full event history, and the status controls.

**Header counts.** Above the message list in a group: pending and unverified
counts, tapping filters to that list. Read from the counters, never counted.

**Long press to verify.** On a completed action bubble in the originating chat,
long press offers Verify to those allowed. Others do not see the option.

## 12. Notifications

- Action assigned to a person: push to that person.
- Action assigned to a group with no person: push to the group.
- Marked done: push to the raiser.
- Verified: push to whoever marked it done.
- Priority `CRITICAL`: push regardless of mute, matching announcement behaviour.

Uses the existing `notificationService`, adding an `actions` channel alongside
`rails`. The existing default of `'rails'` is left alone.

## 13. Retention, legal hold, export

Actions join the existing compliance machinery rather than inventing new rules.

- Retention clears the title, completion note and attachments, setting
  `bodyRemovedAtMs`. **The event history and who verified it are never cleared**,
  because that is the record the company needs.
- A legal hold covering the raiser, the assignee or the verifier freezes the
  action against retention, matching announcements.
- The web console gains an Actions view with a CSV export, reusing
  `announcementExport.ts` patterns including the formula injection guard.

## 14. Performance

Budgets, tested against the emulator like announcements were:

| Operation | Budget |
| --- | --- |
| Create an action | under 800ms server time |
| First page of a group's actions | under 200ms |
| Header counts | under 50ms, single document read |
| Detail sheet with 20 events | under 300ms |

Lists page at 30. The bubble in a chat renders from data already loaded with the
message page, so scrolling a chat with 200 actions costs nothing extra.

## 15. Build order

**Phase 1. Safe removal.** Section 10, steps 1 to 5. Nothing added. Ship and
confirm RAILS, LSW and calls all still work.

**Phase 2. Backend.** Service, routes, permissions, indexes, emulator tests
including permission tests and a 5,000 action scale test.

**Phase 3. Create and deliver.** The menu row, the create sheet, the bubble, the
push notification. An action can be raised and lands in the right group.

**Phase 3b. Attachments. Done, 5 September 2026.**

Discovered while building phase 3: the only upload path the phone had was
`uploadEncryptedChatMedia`, which seals media to one chat's device keys. An
action is read by a different group, so that path could not carry its photos.

Built instead:

- The phone asks for an upload and gets back an **opaque id and a short lived
  signed link**. It never sees or chooses a storage path. Creating an action
  names ids, and the server rebuilds the path from tenant, uploader and id, so
  a forged path is not something that can be sent.
- Each id is checked at attach time: it must belong to this tenant, it must
  have been reserved by this person, and the file must actually exist in
  storage. All three are tested.
- Storage rules deny clients both read and write on the attachment path. Every
  transfer goes through a signed link the backend issued.
- 50 MB per file, 10 files per action, enforced on the server and again on the
  phone so the refusal comes before the wait.
- Retention deletes the **files**, not only the rows pointing at them.
- `purgeStaleActionUploads` clears reservations nobody ever used, so a person
  who picks three photos and changes their mind does not leave them in storage.

**Phase 4. Work and close.** Detail sheet, status changes, blocked reason,
completion note, automatic post back.

**Phase 5. Verify and count.** Verification rules, the verified pill, header
counts, filtered lists.

**Phase 6. Compliance.** Retention, legal hold, web console view, CSV export,
privacy policy sentence.

Each phase ends with typecheck, the full test suite, and an install on a real
device. No phase begins before the previous one is confirmed working.

## 16. Testing

- Permission tests: every rule in section 6, including that the completer cannot
  verify their own work, and that a removed employee is refused.
- Emulator tests: full lifecycle, blocked reason required, counters correct after
  every transition, counters correct after a failed transaction.
- Scale test: 5,000 actions in one group, against the budgets in section 14.
- Mobile unit tests: status labels, bubble state, who may verify, media
  collapsing, duplicate action detection.
- Regression by hand after phase 1: the LSW workspace add To Do and add Follow Up,
  the scheduled call picker, call history, the RAILS web workspace, LSW web.

## 17. Out of scope

Not in this work, recorded so nobody adds them quietly:

- Overdue chasing and reminders
- Recurring or scheduled actions
- An org wide action dashboard
- Linking an action to a RAILS item, see 5.2
- Restoring a chat shortcut to LSW To Do or Follow Ups, see 5.1
- Any edit to RAILS, LSW, RCA or interpreter code, see section 3
