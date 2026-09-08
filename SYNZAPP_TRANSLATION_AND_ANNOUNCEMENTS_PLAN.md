# Acknowledged Announcements — Implementation Plan

**Status:** In implementation.
**Owner:** Synzapp engineering.
**Created:** 2 September 2026. Revised the same day.
**Applies to:** iPhone, Android, and the web console.

An announcement is not a message. It is a notice that records **who has seen
and confirmed it**, in a form that survives an audit.

Nothing here is written from imagination. Every claim about the existing system
was checked against the code, and the file it came from is named.

---

## 0. Revision note

An earlier version of this document also specified chat translation. **That
feature was cut before any code was written** and its section has been removed.
It is not deferred, not paused: it is not being built.

One fact from that work is worth keeping, because it constrains anything future:
`backend/src/services/chatTranslationService.ts` deliberately refuses to
translate message text on the server, because the Privacy Policy and Terms both
state that Synzapp cannot read messages. **That refusal must stay.** Removing it
would make a published legal document false.

---

## 1. How to use this document

- Each part has **acceptance criteria**. A part is not finished until every one
  is demonstrated on a real device, not asserted.
- **The rules in section 5 are requirements.** Each exists because its absence
  causes a specific, foreseeable incident.
- **Performance rules in section 6 are requirements**, because the stated goal
  is that the app must not stall as staff numbers grow.
- Where this document conflicts with a habit or an older document, this
  document wins. If it is wrong, change it here first.

---

## 2. What already exists

Verified in the code on 2 September 2026.

| Thing | Where | State |
|---|---|---|
| `announcements.send` permission | `backend/src/services/permissionCatalog.ts` | Defined for both employee roles and department admins. **Nothing implements it** |
| `groups.create` permission | same file | Defined for both. Used by group creation |
| Org Admin authority | `ORG_ADMIN_PERMISSIONS` | By role, not by grant |
| Group chat and membership | `groupChatService.ts`, `groupService.ts` | Working |
| Retention, legal hold, disposition, export | `retentionEvaluatorService.ts`, `legalHoldService.ts`, `complianceExportService.ts` | Working, tested against a real emulator |
| Resumable job model to copy | `complianceExportService.ts` | Survives interruption; the pattern for fan-out |
| Audit | `auditService.ts` → `auditLogs` | Working |
| Interpreter, 245 languages | `interpreterService.ts` | **Out of scope. Do not modify.** |

---

## 3. What it does

- Someone with permission sends an announcement to their organization, a
  department, or a group.
- Recipients see it clearly marked, and press **Acknowledge**.
- The sender sees a live count: acknowledged, read but not acknowledged, not
  yet seen — and can chase the gaps.
- The result is a record that stands up in an audit: *"forty-two of forty-three
  staff confirmed the allergen change on 4 March, here is the list with times."*

**Why it matters commercially.** Food safety, workplace safety and healthcare
inspections all turn on proving people were told. Today that proof is a signed
paper sheet on a noticeboard, or nothing. Nobody buys a chat app for this. They
buy **this**, and the chat comes with it.

---

## 4. Who may send, and to whom

Authority comes from the session on the server. **Never from anything the
client sends.**

| Sender | May send to |
|---|---|
| **Org Admin** | The whole organization, any department, any group |
| **Department Admin** | Their own department, and groups within it |
| **Anyone holding `announcements.send`** | Groups they belong to |
| **Anyone holding `groups.create`** | Groups they belong to |

`groups.create` is included deliberately: a person trusted to form a team is
trusted to address it. It does not grant anything wider — a group creator
cannot announce to a department or the organization.

Everyone else may not send. The action is not shown to them, **and the server
refuses it anyway**. A hidden button is not a permission check.

---

## 5. The rules that protect you

Each exists because its absence causes a specific, foreseeable incident. **A
rule with no test is not a rule.**

1. **The recipient list is frozen at send time.** Somebody who joins tomorrow
   was not told today and must not appear as though they were.
2. **Removing a person does not remove their record.** They stay on the list
   with the status they had. Deleting them destroys the proof that they were
   informed. This differs from a scheduled message, where removal cancels: a
   sent announcement is history, a scheduled one is an intention.
3. **A legal hold freezes an announcement and its receipts**, through
   `legalHoldService.ts`. Do not build a second mechanism.
4. **Retention applies to the body, not the receipts.** When a retention rule
   removes the message, **the proof that people acknowledged it survives**. A
   company that deleted a safety notice under its own rule must still be able to
   show it was issued and confirmed. This is the most important rule here.
5. **Acknowledgement is a person's own act.** It cannot be done on their behalf
   by anyone, including an administrator. A forged acknowledgement in a safety
   investigation is a criminal matter, not a feature.
6. **Acknowledgement cannot be withdrawn.** One that can be undone proves
   nothing.
7. **Acknowledging twice counts once.** Two devices, one person, one count.
8. **Every send, acknowledgement and reminder is audited** with who, when, and
   from which device.

---

## 6. Scale — requirements

An announcement to 5,000 staff is the case that breaks a naive design.

| Rule | Why |
|---|---|
| **Counts are stored counters**, updated in a transaction | Counting 5,000 rows to show one number, on every open, is how this dies |
| **The recipient list is paged, 50 at a time** | The phone never holds 5,000 rows |
| **Fan-out runs on the server in batches, resumable**, with a state field | Same job model as `complianceExportService.ts` |
| **A failed fan-out resumes**; it never half-sends and forgets | Half an announcement is worse than none |
| **Composite indexes declared in `firestore.indexes.json` before shipping** | We have been caught by this twice |
| The sender's progress view **polls sanely and stops when closed** | Not a live subscription per recipient |

**Budgets, demonstrated with a seeded organization of 5,000 people:**

- Announcement list opens: **under 500ms**.
- First page of recipients: **under 500ms**.
- Sending to 5,000 completes server-side; the sender may close the app.

---

## 7. Data model

```
organizations/{tenantId}/announcements/{announcementId}
  announcementId, tenantId
  createdAtMs, createdByUid, createdByName
  audience: { kind: 'ORGANIZATION' | 'DEPARTMENT' | 'GROUP', targetId, targetName }
  requiresAcknowledgement: boolean
  expectedRecipientCount   # frozen at send time
  deliveredCount, readCount, acknowledgedCount   # counters, never queries
  state: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED'
  fanOutCursor             # resume point
  bodyRemovedAtMs          # set by retention; receipts survive
  legalHoldIds: string[]

organizations/{tenantId}/announcements/{announcementId}/recipients/{uid}
  uid, displayName, departmentId
  deliveredAtMs, readAtMs, acknowledgedAtMs
  status: 'DELIVERED' | 'READ' | 'ACKNOWLEDGED'
```

**The body is a chat message, encrypted exactly like one.** Announcements are
not a second messaging system: they are a message with a receipt attached. The
receipt is metadata the organization is entitled to; the words stay sealed.

---

## 8. What the person sees

Native components only. No hand-drawn imitations.

**Receiving**
- Clearly distinct from an ordinary message: a banner style, not a coloured
  chat bubble.
- One **Acknowledge** button, minimum 48dp, set apart so a gloved hand cannot
  press it by accident.
- Once acknowledged: a quiet confirmation with the time. It cannot be undone.
- Unacknowledged announcements stay pinned at the top until dealt with.

**Sending**
- Compose, choose the audience, a switch for **Require acknowledgement**.
- A confirmation step stating **exactly how many people this reaches**. Sending
  to 5,000 by accident must be hard.
- Afterwards, a progress view: acknowledged, read, not yet seen, with names,
  paged.
- **Send a reminder** to those who have not acknowledged — once per day at
  most, enforced on the server.

**Web console**
- The same, plus **export the acknowledgement record** for an auditor. Reuse
  `complianceExportService.ts`; do not write a second exporter.

---

## 8a. Where an announcement appears

Decided 2 September 2026, after the first build put announcements only in a tab
of their own. A tab people must remember to visit is too passive for a safety
notice, and the people this is built for are not browsing an app.

### The three surfaces

| Surface | Purpose |
|---|---|
| **An amber banner pinned in the chat** | Unmissable where people already are |
| **The Announcements tab** | The one place to answer "what do I still owe?" |
| **The sender's chase list** | Where the pressure actually comes from |

### The banner

- Amber, pinned to the top of the chat, above the messages.
- **Cannot be scrolled away.** It stays until acknowledged.
- **It never blocks a message.** The composer, the send button and every
  existing action stay usable while it is showing.
- Shows the subject, who sent it, and one **Acknowledge** button.
- Tapping the subject opens the full text.

### Why it does not block the chat

A blocking modal was considered and rejected. Three reasons, recorded here so
the decision is not quietly reversed:

1. **It would destroy the evidence.** An acknowledgement obtained by locking
   somebody out of their work chat proves they wanted their chat back, not that
   they read anything. The first question in a tribunal is "did my client have
   a choice", and the answer would be no. The record is the product; coercing it
   empties it.
2. **It is a safety risk.** These are warehouses, sites and wards. Putting an
   administrative task on top of an emergency channel is an inversion that ends
   up in an incident report.
3. **Works councils.** In Germany, France and the Netherlands, a system that
   compels employee behaviour attracts formal objection, and one objection can
   stall a deployment.

**Mandatory sign-off, where a customer genuinely needs it, is a task with a
deadline. Not a modal on a chat.** That is a separate feature.

### Which chat a banner appears in

There is no company-wide chat. Every department gets a default group chat
automatically (`groupService.ts`, `isDepartmentDefault: true`); groups have
their own. Nothing exists for "everyone".

| Sent to | Pinned in |
|---|---|
| A group | That group's chat |
| A department | That department's default chat |
| **Everyone at the company** | **Each person's own department chat** |

Everybody belongs to a department and every department already has a chat, so
this needs no new plumbing and lands somewhere people actually open.

### What the sender sees

**No banner for an announcement they sent themselves.** Showing somebody their
own notice as something needing action is noise. It appears under "Sent", with
the counts.

### The tab

Two views on one screen, for everybody. Not role-dependent: a department admin
both sends and receives, and hiding either from them is backwards.

- **For me** — outstanding first, then confirmed.
- **Sent** — what I sent, with counts, and in time the names.

The tab holds **everything sent to me, outstanding included.** If it held only
confirmed ones, the only route to an unanswered announcement would be
remembering which chat it arrived in, and somebody in eight group chats cannot
answer "what do I still owe?".

### Performance

| Rule | Why |
|---|---|
| **Announcements are fetched once and shared**, not per chat opened | Opening a chat must not wait on a network call it did not need before |
| The banner is chosen **in memory**, by matching the chat against audiences already loaded | No round trip, no delay on a screen people open fifty times a day |
| Refreshed on app foreground and after acknowledging, **not on every chat open** | |

**Budget: opening a chat is no slower than before this feature existed.**

### Tests

1. A group announcement pins in that group's chat and nowhere else.
2. A department announcement pins in the department's default chat.
3. An organization announcement pins in the reader's **own** department chat.
4. The sender sees no banner for their own announcement.
5. An acknowledged announcement no longer pins anywhere.
6. With several outstanding for one chat, the newest is shown.

---

## 9. Failure modes

| What goes wrong | Required behaviour |
|---|---|
| Fan-out interrupted | Resumes; never half-sends silently |
| Recipient offline at send | Delivered when they return; status honest until then |
| Recipient removed before reading | Stays on the list, status unchanged |
| Two devices acknowledge at once | Counts once |
| Sender closes the app mid-send | Server continues |
| Retention removes the body | Receipts survive |
| Nobody in the audience | Refuse at send time and say so, rather than creating an empty announcement |

---

## 10. Testing

Against the Firestore emulator, in the style of
`backend/test/complianceEmulator.test.ts`. Every rule in section 5 has a test
here, by number.

1. Acknowledging twice from two devices increments the count **once**. (5.7)
2. Retention removing the body **leaves the receipts intact**. (5.4)
3. A legal hold prevents removal of both. (5.3)
4. A Department Admin targeting another department is **refused by the
   server**. (4)
5. A group member with `groups.create` may announce to their group and **not**
   to the department. (4)
6. A person removed after acknowledging **remains** on the record. (5.2)
7. Someone who joins after the send **does not appear** on the list. (5.1)
8. Fan-out to a large audience completes, and completes correctly after being
   interrupted halfway. (6)
9. Counts match the recipient rows exactly after concurrent acknowledgements.
10. An acknowledgement cannot be made by anyone other than the recipient. (5.5)

---

## 11. Acceptance criteria

1. An Org Admin sends to 5,000 seeded staff; it completes server-side and the
   sender's phone is not doing the work.
2. Concurrent acknowledgements produce an exactly correct count.
3. Retention removes the body; the record survives and exports.
4. A legal hold freezes both.
5. A Department Admin is refused by the server when targeting another
   department.
6. A `groups.create` holder can announce to their group and is refused wider.
7. Both budgets in section 6 are met and recorded.
8. The auditor's export opens in Excel and is legible to a non-technical
   reader.

---

## 12. Order of work

| Step | Work | Gate | State |
|---|---|---|---|
| 1 | Permission rules, as a tested module | Unit tests for every row of section 4 | **Done** — 10 tests |
| 2 | Data model, create and fan-out job | Emulator tests | **Done** — `announcementService.ts` |
| 3 | Acknowledge, counts, paging | Emulator tests | **Done** |
| 4 | Retention body removal | Emulator test | **Done** |
| 5 | Routes and audit | Typecheck and suite | **Done** — `/api/announcements` |
| 6 | Mobile: receive, acknowledge, pinned | On a real device | **Built, not yet run on a device** |
| 7 | Mobile: compose, audience, confirm | On a real device | **Built, not yet run on a device** |
| 8 | Legal hold wiring | Emulator test 3 | **Outstanding** |
| 9 | Web console: same, plus export | Opens in Excel | **Outstanding** |
| 10 | 5,000-person performance run | Budgets in section 6 | **Outstanding** |

---

## 13. Explicitly not in scope

- **Chat translation.** Cut. See section 0.
- **Any change to the interpreter.** `interpreterService.ts`,
  `InterpreterScreen.tsx`, `synzapp-audio-session` and the realtime session
  code are off limits.
- Cloud translation of message text.
- Scheduling an announcement for later. That is the scheduled-send feature,
  deliberately deferred.
- Reactions, emoji or threads on announcements.
- Acknowledgement on someone's behalf. See rule 5.5.

---

## 14. Definition of done

- Every acceptance criterion demonstrated **on a real device**.
- Every rule in section 5 has a test that fails if the rule is removed.
- Performance budgets measured and recorded.
- Privacy Policy and Terms checked against what was built.
- `npm test` passes in `backend`, `mobile` and `web`, and the emulator suites
  pass.
- Nothing in section 13 was touched.

---

## 15. Amendment log

| Date | Change |
|---|---|
| 2 September 2026 | Created with two features. |
| 2 September 2026 | Chat translation cut before any code. Sender rules widened to include `groups.create` holders, scoped to their own groups. Implementation started. |
| 2 September 2026 | Section 8a added: banner in chat, no blocking modal, org-wide pins to the reader's own department chat, tab holds outstanding as well as confirmed. |
| 2 September 2026 | Steps 1–7 built. Backend complete with 16 emulator tests and 10 permission tests. Mobile receive, acknowledge and compose built, not yet run on a device. Legal hold, web console and the scale run remain. |
