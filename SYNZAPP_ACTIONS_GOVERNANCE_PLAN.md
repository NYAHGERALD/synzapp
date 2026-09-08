# Synzapp Actions Governance Plan

The source of truth for the Actions surface: who sees which actions, how an
action ends, what is written down when it does, and how long any of it is kept.

Written before the code so that nothing here is decided twice or quietly
dropped. Anything implemented that contradicts this document is a bug in one of
the two, and the disagreement gets settled here first.

Companion to [SYNZAPP_CREATE_ACTION_PLAN.md](SYNZAPP_CREATE_ACTION_PLAN.md),
which covers how an action is raised from a chat message. This one covers what
happens to it afterwards.

---

## 1. What this covers

- The **Actions** screen: every action a person is allowed to see, in one place
  rather than only inside the chat it came from
- **Department scoping**: who may see which actions
- **Cancellation**: the only way an action leaves the active list without being
  completed, and who may do it
- **The audit log**: what is written down, who reads it, who may never erase it
- **Retention**: two clocks, and why the second must outlive the first

## 2. What this must not touch

RAILS, LSW, RCA and the interpreter are shipped, working features. No file
belonging to them is edited by this work. See section 3 of the Create Action
plan.

**Already checked:** the `RAILS` entry in the main navigation menu was a dead
placeholder that showed a "will be available soon" alert. It was never wired to
the RAILS feature, which is reached elsewhere. Replacing that menu entry with
`ACTIONS` therefore removes nothing. This was verified before the change, not
assumed.

---

## 3. Who sees what

An action is **associated with a department** when either is true:

- `sourceDepartmentId` matches — somebody in that department raised it
- `responsibleDepartmentId` matches — that department, or somebody in it, is
  answerable for it

| Role | Sees |
| --- | --- |
| Employee | Actions associated with their own department |
| Department admin | Actions associated with their own department |
| Org admin | Every action in the tenant |

A person with no department sees only actions they raised themselves. That is
deliberate: an unassigned account should not quietly gain a view over an
organization's work.

### 3.1 Why a denormalised field, not two queries

Firestore cannot apply `OR` across two fields in one query, and running two
queries and merging breaks ordering, so a page boundary would drop or repeat
rows. The action record therefore carries a **`departmentIds` array** holding
the source and responsible departments, written when the action is written, and
queried with `array-contains`.

That is one query, one ordering, and pagination that holds at any size.

The field is derived, never authored: whenever `sourceDepartmentId` or
`responsibleDepartmentId` changes, `departmentIds` is rebuilt from them in the
same write. It must never be settable directly by a client.

### 3.2 An existing hole this closed, and one it did not

The tenant-wide branch of `listActions` had **no scoping at all**: any member
who called it without a chat or group returned every action in the tenant. No
screen did that, so nothing showed it, but the endpoint was reachable. Section 3
now narrows it.

The `chatId` and `groupId` branches took an id straight from the caller and
checked nothing, so a member could list the actions of any chat or group in
their tenant by naming its id. That is **Broken Object Level Authorization**,
first on the OWASP API Security Top 10, and it is a defect rather than a design
option: an id arriving from a caller is never permission to read what it names.

**`groupId` is fixed.** The caller must be in the group. Org admins already see
the whole tenant, so this constrains only everybody else.

**`chatId` is not, and the fix is to stop accepting one.** A direct chat id is
`direct_sha256(sorted(uidA|uidB))`, so there is no cheap way to ask "is this
person in that chat" from the id alone. The answer is to take the **counterparty
uid** and derive the chat id on the server. A caller can then only ever ask
about a conversation they are in, because the id is no longer theirs to choose.
That changes the request shape, so it is a small client change rather than a
server-only fix.

### 3.2.1 Authorization is per surface

Department scoping is deliberately **not** applied to the chat and group
branches. Those are a different surface with a different boundary:

- The **chat thread's** boundary is the conversation. Everybody in it already
  saw the message the action was raised from, so hiding the record derived from
  that message would be incoherent.
- The **Actions screen's** boundary is the department, because it is a view over
  work rather than over a conversation.

Applying one surface's rule to the other produces a leak in one direction or a
confusing hole in the other. Each surface keeps its own.

### 3.3 Existing actions

Actions written before this field exists have no `departmentIds`, so they would
vanish from every department view. A one-off backfill sets the field from the
two existing columns. Until it has run, the query falls back to the two-query
merge so nothing disappears in the meantime.

---

## 4. How an action ends

Statuses today: `OPEN → IN_PROGRESS → BLOCKED → DONE → VERIFIED`.

There is no way out of that chain, so a mistaken action stays open forever and
people learn to ignore the list. A list nobody trusts is worse than no list.

### 4.1 `CANCELLED` is added. Delete is not.

An action is the record that somebody reported a fault, somebody was made
answerable, somebody said it was finished, and somebody else agreed. In food
safety, maintenance and sanitation that record **is** what an auditor asks for.

A system where the person being held to account can make the account disappear
is worse than no system, because it looks like evidence and is not.

So `CANCELLED` is a **terminal state, not a deletion**. The action leaves the
active list. It stays in the record, stays in exports, and shows who cancelled
it and why.

**A reason is required.** A cancellation with no reason is indistinguishable
from a cover-up, and the whole point is to be able to tell the difference.

### 4.2 Who may cancel

| Who | When |
| --- | --- |
| The person who raised it | Only while still `OPEN`, the wrong-chat or duplicate case |
| A department admin | Their own department's actions, any state |
| Org admin | Any action in the tenant |
| **The responsible person** | **Never, on their own** |

That last row is the load-bearing one. If the person answerable for an action
can cancel it, the feature is decorative. They may ask; somebody else decides.

A `VERIFIED` action is not cancellable by anybody. It has been checked by a
second person, and unpicking that is a records change, not an operational one.

### 4.3 Hard deletion exists, but not as a button

One case is legitimate: a legal erasure obligation, or a tenant leaving. That
is a tenant-level administrative operation and belongs in the retention
machinery, beside `removeActionBody`, which already drops an action's body while
keeping the record of it. It is never a row action in a list.

---

## 5. The audit log

Every one of these writes an audit event through the existing `writeAuditEvent`:

| Event | Recorded |
| --- | --- |
| `ACTION_CREATED` | actor, department, source chat |
| `ACTION_STATUS_CHANGED` | actor, from, to |
| `ACTION_VERIFIED` | actor |
| `ACTION_CANCELLED` | actor, **reason**, previous status |
| `ACTION_BODY_DISPOSED` | retention job, policy that triggered it |

Each carries tenant, actor uid and name, action id, department, and timestamp.

### 5.1 Nobody clears it

There is no clear, no purge, no edit, and no admin screen that offers one. An
audit log an administrator can erase is a diary. It ages out automatically by
policy and by nothing else.

### 5.2 It is read on the web, not the phone

The audit view goes in the **web console**, beside `ActionConsole` and
`AnnouncementConsole`. It is wide tabular data read by a compliance person at a
desk, with filtering, date ranges and CSV export. The phone keeps the
operational list, used on a floor.

Splitting it that way is the point: the two audiences want different things and
neither is served by cramming both into a phone screen.

---

## 6. Retention: published, not compiled

An earlier draft of this document put a 7 year floor on audit retention. That
was wrong, and worth recording as wrong: **no single retention period is correct
across the industries Synzapp sells into.**

| Regime | Required retention |
| --- | --- |
| FDA 21 CFR 117.315, food preventive controls | 2 years |
| OSHA 29 CFR 1904.33, injury and illness | 5 years |
| HIPAA §164.316(b)(2) | 6 years |
| SOX §802, financial | 7 years |
| GDPR Art. 5(1)(e), storage limitation | **no longer than necessary** |

The last row pulls the opposite way from the rest. A hardcoded seven years would
be short of SOX in one tenant, and in another would be over-retention a works
council could challenge. A number compiled into the product cannot be right for
all of them, and cannot be changed by the person accountable for it.

### 6.1 Three layers

**Platform, on `admin.synzapp.com`** — Synzapp staff set the allowed range, the
industry templates, whether a tenant may go below a floor, and the legal hold
override. Published and versioned exactly as the policy text is: a change is a
save, not a deployment, and every past version stays readable with the name and
date of whoever published it.

**Tenant, in the admin settings** — an organization chooses its own period,
inside the range the platform allows.

**Code** — holds no periods at all. Only:

- the invariant that **audit retention is never shorter than record retention**,
  because audit ageing out first leaves actions that ended with no account of how
- a conservative fallback used when nothing has been published yet, which fails
  toward keeping rather than deleting

### 6.2 The general rule this comes from

**A decision that differs between tenants is a published policy, not a
constant.** If it needs a lawyer, a compliance officer or an account manager to
answer it, they must be able to change it without an engineer and without a
release.

This follows the precedent already set for policy text in
[SYNZAPP_STAFF_CONSOLE_PLAN.md](SYNZAPP_STAFF_CONSOLE_PLAN.md): version history
a buyer can compare, attribution for who approved a wording, and an editor who
is not required to write code.

Disposal itself stays automatic. There is no manual trigger, because a manual
trigger is a delete button wearing a different hat.

---

## 7. Work, in order

Each step lands with its tests. Nothing is marked done from a code read: it is
done when the test passes and, where it is user-visible, when it has been seen
on a device.

1. **Data model** — `departmentIds` derived on write; `CANCELLED` status;
   `cancelledAtMs`, `cancelledByUid`, `cancelledByName`, `cancellationReason`
2. **Backfill** — set `departmentIds` on existing actions; two-query fallback
   until it has run
3. **Authorization** — `canCancelAction` in `authorizationPolicy.ts`, beside the
   existing `canCreateAction` / `canChangeActionStatus` / `canVerifyAction`
4. **Scoped list endpoint** — `GET /actions` honouring section 3
5. **Cancel endpoint** — reason required, audit event written
6. **Mobile Actions screen** — the scoped list, cancel where permitted
7. **Web audit console** — filters, date range, CSV export
8. **Retention** — audit floor, disposal job wired

---

## 8. Testing

Three things have to be proven, not assumed. Each has bitten this codebase
before in some form.

### 8.1 Tenant isolation

The one that must never fail. Every one of these is a test, not a review note:

- An action created in tenant A is **not** returned to any caller in tenant B,
  including an org admin of B
- A cancel request naming an action id from another tenant is refused, and the
  refusal does not reveal whether that id exists
- The audit log for tenant A never returns an event belonging to tenant B
- A user whose `tenantId` is missing or empty gets nothing, never everything —
  an absent scope must fail closed

### 8.2 Department scoping

- An employee sees an action their department raised
- An employee sees an action their department is responsible for
- An employee does **not** see an action associated with a different department
- An org admin sees both
- A user with no department sees only what they raised themselves
- Changing an action's responsible department moves it between views, in the
  same write

### 8.3 Cancellation rules

One test per row of the table in section 4.2, plus:

- The responsible person is refused even when they also raised it and it has
  moved past `OPEN`
- A `VERIFIED` action cannot be cancelled by anybody, including an org admin
- A cancellation with an empty or whitespace reason is refused
- A successful cancellation writes exactly one audit event carrying the reason
- Cancelling twice does not write a second event or overwrite the first actor

### 8.4 Scale

The list must not degrade as a tenant grows. What matters is that cost is
bounded by the page, never by the tenant.

- The scoped query uses `array-contains` on `departmentIds` **plus** the
  ordering index, and the composite index is committed with the code. A missing
  index fails loudly in Firestore, so the test asserts the query shape rather
  than waiting to find out in production
- Page size is fixed and the endpoint returns a cursor; a tenant with 50,000
  actions costs the same per page as one with 50
- No endpoint reads every action to compute a count. Counters are stored and
  incremented, the way announcement acknowledgement counts already are
- The mobile list is virtualised, and a page of actions carries no payload that
  grows with history — **no base64, no thumbnails, no bodies.** This is the
  mistake that made the chat thread freeze; it does not get repeated here

### 8.5 What the tests run against

Backend logic tests run under the existing `node --test` suite. Firestore rules
and query shapes run against the emulator, as the compliance tests already do.
Pure display and permission rules live in modules with no native imports, so
they are testable without rendering anything, per the mobile rule file.

---

## 9. Decisions, and the standard each follows

These are settled by established practice rather than preference. Each names
what it follows so it can be checked rather than taken on trust.

### 9.1 A cancelled action is never reopened

A new action is raised and linked, through `supersedesActionId` and
`supersededByActionId`.

ISO 9001:2015 clause 10.2 requires records of the nature of a nonconformity and
the action taken. FDA 21 CFR Part 11 requires electronic records to be
attributable and contemporaneous. Reopening a closed record makes "when was this
closed, and by whom" ambiguous, which is exactly what both are there to prevent.
ITSM tools allow reopening incidents; quality and safety records are not
incidents, and the audited practice there is supersession.

### 9.2 Cancelling posts back to the originating chat

ISO 45001 clause 10.2 requires that workers who report a hazard are told what was
done about it. ISO 22000 and HACCP require corrective action verification to
close the loop with the originator.

Somebody who reports a fault and hears nothing stops reporting faults. Closing
the loop is the requirement, not a courtesy, and it applies to a cancellation
at least as much as to a completion — arguably more, because a cancellation is
the outcome most likely to be disputed.

### 9.3 Retention is published, never compiled

See section 6. The platform sets the bounds on `admin.synzapp.com`, the tenant
chooses within them, and the code holds only the invariant.

### 9.4 What still needs a person

Nothing in this plan. The three questions an earlier draft raised are answered
above by standard. What does need deciding is **which industry templates ship
first** on the staff console — a starting set of ranges for food safety,
maintenance, healthcare and general — and that is a commercial call for whoever
owns the customer list, made in the console rather than here.
