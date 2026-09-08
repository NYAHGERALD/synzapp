# Synzapp Compliance — What Is Left To Finish

## What this document is for

The retention console works. An Org Admin can create a rule, freeze a chat for a
court case, approve a deletion, and see a record of who did what.

But the product does not yet do the two things it promises. **Nothing is
actually deleted, and nothing can be handed to a lawyer.**

This document lists everything still missing, in the order it should be built,
and says plainly what "finished" means for each one.

It is written to be read by the person deciding what to build next, not only by
whoever writes the code.

---

## The five gaps

| # | Gap | What an admin sees today | Why it matters |
|---|---|---|---|
| 1 | Nothing is deleted | A rule saying "delete after 1 year" saves, and keeps everything | The main screen promises something the app does not do |
| 2 | ~~No way to hand data to lawyers~~ **BUILT** | Search & export screen; export bundles messages, attachments and a manifest | Freezing without producing is half a feature |
| 3 | Nothing runs on its own | Someone must open the page and press a button | Real retention runs nightly without anyone remembering |
| 4 | No second copy | Only one copy exists; staff can delete before the rules see it | This is what makes retention real rather than a setting |
| 5 | Photo fix not switched on | Photos vanish from old chats after 30 days | The code is written and never connected — a live bug |

---

## Build order, and why

### Step 0 — Switch on the photo fix

**Smallest job, live bug.** `chatMediaRetentionService.ts` already stops a photo
being deleted while a message still shows it. Nothing calls it.

Three connections are needed:
- When a message is sent, record which photos it uses
- When a message is deleted, release that claim
- When a photo is requested, allow it if any message still uses it

**Done when:** a photo sent 31 days ago in a one-to-one chat still opens.

**Note the one decision this forces.** The server cannot see which photos a
message uses, because that is inside the encrypted message. Under the Teams
model this is not a problem — see step 4, where a readable second copy exists —
but until step 4 lands, the sending app must tell the server the photo ids
alongside the message. This is a small, deliberate disclosure and it should be
recorded, not slipped in.

---

---

## Scope boundary — do not cross

**This plan covers Chat and the Org Admin compliance console only.**

The Interpreter AI, and every other part of Synzapp that is already working, is
**out of scope for work done under this plan**.

*Amended 31 August 2026:* the interpreter's live session was worked on
separately, at the product owner's explicit direction, to stop recoverable
realtime events being shown to users mid-meeting. That work is recorded in
`SYNZAPP_INTERPRETER_LIVE_SESSION_NOTES.md`. The boundary above still stands for
anything done under this compliance plan. It is not part of Chat. Work under this plan must not read,
refactor, move or otherwise touch it — a previous attempt did, broke the build,
and had to be reverted.

The same rule is repeated as a code comment at the top of each service this plan
added, so the boundary is visible from inside the code and not only from here.

---

### Step 1 — Actually delete

**The gap that makes the product untrue.** Approving a batch marks it approved.
No bytes move.

What is needed:
- A **grace window** after approval. Seven days, recoverable, still searchable.
  A deletion approved by mistake must be recoverable.
- A **shredder** that destroys the encryption key for the content. Because every
  item is encrypted under its own key, destroying that key makes the content
  unreadable everywhere at once — including in backups and copies we cannot
  reach one by one.
- A **final check immediately before destroying.** A freeze applied during the
  grace window must win. The queue may have been sitting for days.

**Done when:** a rule set to 1 day results in that content being unreadable
within the 16 days we publish, and a freeze applied at any point stops it.

**Risk to respect:** this is the only part of Synzapp that destroys customer
data. It should ship behind a per-tenant switch that starts off, and the first
tenants to use it should be told they are first.

---

### Step 2 — Hand data to lawyers — **BUILT**

**The gap that loses deals.** A hold preserves content. There is no way to get
it out.

#### What was built

| Piece | Where |
|---|---|
| Search by person, date, conversation and text | `backend/src/services/complianceSearchService.ts` |
| Export bundle with the real bytes | `backend/src/services/complianceExportService.ts` |
| Manifest of what is in and what is missing | `backend/src/services/complianceExportManifest.ts` |
| Server-side attachment decryption | `backend/src/services/archivedMediaDecryptor.ts` |
| API: `POST /search`, `POST /exports`, `GET /exports`, `GET /exports/:id/download` | `backend/src/routes/complianceRoutes.ts` |
| Admin screen "Search & export" | `web/src/RetentionConsole.tsx`, `web/src/ediscoveryDisplay.ts` |

**Decisions worth keeping:**

- **Search and export take identical criteria.** An administrator previews with
  a search and exports the same question. A preview that filtered differently
  from the export would be a trap.
- **Unreadable messages are returned, never dropped.** A search that hid them
  would show an empty period, and an administrator would report it as empty.
  They appear in results with the reason, and in the export marked as missing.
- **One unreadable item never fails the export.** It is recorded as an exclusion
  and the rest still arrives.
- **The export copies bytes, not links.** A link expires; an export has to open
  years later, possibly after the original was deleted under a retention policy.
- **Every search is audited** with the question that was asked, whether or not it
  matched anything. A search nobody can account for later is indistinguishable
  from a fishing expedition through colleagues' messages.
- **Download links last 24 hours.** The bundle holds an organization's readable
  messages; a permanent link is a copy of that archive in whatever inbox it was
  forwarded to.

**Limits, stated rather than hidden:** an export carries at most 5,000 messages
and skips any single attachment over 200 MB. Both are reported — the bundle's
README says the search was cut short, and an oversized attachment appears in the
manifest as `MEDIA_TOO_LARGE`. Messages sent before the organization had an
archive key cannot be produced and say so; that cannot be repaired after the
fact.

What is needed:
- **Search across a hold** — by person, by date, by conversation
- **An export that copies the actual bytes**, not links to them, so an export
  taken today stays complete no matter what happens to the original later
- **A manifest** listing exactly what is in the export, what was excluded, and
  why. An export that quietly misses items is worse than no export, because
  somebody will swear to its completeness

**Done when:** an admin can say "everything from these five people between these
dates" and receive a file, with a list of what is in it.

---

### Step 3 — Run on its own

**Small job, needed before any customer relies on it.**

- A nightly job that checks what has expired, for every tenant
- A record of each run: when, how long, what it found
- An alert when a run fails, because silent failure means content is kept or
  deleted with nobody noticing

**Done when:** the queue fills overnight with nobody logged in.

---

### Step 4 — The second copy

**Order corrected.** This was written as step 4, after exports. That was wrong:
**exports depend on this**, so this comes first. The server holds only scrambled
text and no key to unscramble it, so an export built before this step would hand
a lawyer a file of gibberish.

#### How the readable copy is made

The server cannot read messages, and that is deliberate. So the readable copy
cannot be made by the server decrypting something — it has to be created by the
sender, at the moment of sending.

Synzapp already encrypts each message key separately to every device that should
be able to read it. **The compliance archive becomes one more such recipient.**

1. Each company gets its own key pair, once.
2. The public half is handed to sending apps alongside the recipient devices.
3. The sending app encrypts the message key to it, exactly as it does for a
   phone.
4. The private half is held by the backend, wrapped by Google Cloud KMS.

Nothing about the message format changes. No new encryption scheme. The sender
is simply told there is one more reader.

#### Why the private key is wrapped by KMS, not stored directly

The private key that can read a company's messages is the most sensitive value
in the product. Stored plainly in the database, anyone with database access can
read every message that company has ever sent.

Wrapped by KMS, the database holds only an encrypted blob. Reading a message
requires both database access **and** permission to use the KMS key, and every
use is logged by Google outside our own logs.

It also delivers what the retention plan promises about destruction: **destroying
the KMS key destroys the archive**, everywhere, including in backups and copies
we cannot reach one by one. That is the crypto-shredding the plan describes, and
it is not achievable any other way.

#### What must be true before this ships

- A company that has not been given a key pair keeps working exactly as now.
  Adding this must not break existing conversations.
- A message sent before the key existed stays unreadable to the archive. It
  cannot be retrofitted, and the export manifest must say so rather than
  implying the archive is complete.
- Staff are told. An organization choosing Synzapp is choosing a workplace record
  system, and this is the point at which their messages become readable by their
  employer. Teams does this openly and so should we.

#### Build order inside step 4

| | Work |
|---|---|
| 4a | Company key pair, wrapped by KMS, created on demand |

**4a correction (found in testing).** The key was never actually being created.
The project name was read from `GOOGLE_CLOUD_PROJECT`, which **Cloud Run does
not set**, so the key name was built with an empty project and every request
failed — silently, because the caller discarded the error. An organization
looked normal while keeping no readable copy of anything.

What changed:

- The project name now also reads `FIREBASE_PROJECT_ID`, which is set, and
  throws with a clear message when no project is configured at all.
- The failure is logged instead of discarded.
- Creation uses `create`, not `set`. Two people sending their first message at
  the same moment would both find no key and both write one; the loser's
  messages would be sealed to a key that no longer existed — unreadable forever
  and silent about it. The loser now adopts the winner's key.
- A momentary key-store failure is retried, because the message being sent at
  that instant would otherwise be sealed with no archive copy and could never be
  produced afterwards.

**No admin action, by design.** The key is created while building the sender's
encryption details — before the first message is sealed — so nothing is ever
missed and there is nothing to set up. The console reports the key's status
because an administrator answering a legal request has to know the date from
which records can be produced, but it offers no button: a status screen that
created the thing it reports on would hide the very misconfiguration it exists
to reveal.
| 4b | Public key returned with the encryption context |
| 4c | Sending apps encrypt to it, like any other device |
| 4d | Backend reads the archive copy for retention, holds and exports |

Only 4d gives the server the ability to read messages. Up to that point the
archive accumulates but nothing reads it, which is the safe order: the copies
exist before anything depends on them.

---

### Step 4 — original notes

**Largest job. Changes how messages are stored.**

Right now there is one copy of each message. A staff member deleting a message
removes it before the rules ever apply. Teams solves this by writing a second
copy that users cannot reach or delete, and applying retention to that copy.

What is needed:
- On sending, write a second copy to a store users cannot reach
- Deleting a message removes it from the user's view only
- Retention, freezing and exports all read the second copy
- The copy is encrypted with a key the **customer** controls, so they — not
  Synzapp — decide who can read their archive, and destroying that key destroys
  the archive

**Done when:** a staff member deletes a message, and it is still produced by an
export under a legal hold.

**This is the one to be honest with staff about.** An organization choosing
Synzapp is choosing a workplace record system. Staff should be told their work
conversations are kept by their employer, exactly as they are in Teams.

---

## Smaller items, worth listing

| Item | Why it can wait |
|---|---|
| Explainer for a single conversation | The rules are shown; resolving them for one chat is a convenience |
| Retention per message, not per conversation | Per-conversation is correct for most rules |
| A picker for people and chats instead of typing | Typing works; a picker prevents typos |
| Automated tests for the console screens | The logic behind them is tested; the screens are not |

---

## What can be said honestly today

**Can be demonstrated now:** creating rules, freezing for a court case, the
approval gate with phone verification, and the full record of who did what.

**Cannot yet be claimed:** that content is deleted on a schedule, or that
Synzapp can answer a legal request.

**Order matters.** The safety parts were built first on purpose. A retention
dial with nothing underneath it is a documented way to destroy evidence by
accident, so the freeze and the approval gate came before the deletion. That
sequencing is worth keeping when explaining the current state to a customer: it
is not an unfinished product so much as a deliberately half-built one, built
brakes first.

---

## Compliance audit — 30 August 2026

A full read of the compliance surface: routes, retention, holds, disposition,
the archive and eDiscovery. Eight real defects found and fixed.

**Correct already, worth recording:** every compliance route requires an Org
Admin with `security.manage`; destructive routes additionally require a phone
verification from the last few minutes; the scheduler route fails closed when
its secret is unset; and Firestore and Storage both deny clients all access to
`tenants/**` and the export bucket, so none of this data is reachable from an
app or a browser except through the API.

| # | Defect | Effect before the fix |
|---|---|---|
| 1 | Export built entirely in memory, single attachment capped at 200 MB, container has 512 MB | The first export containing a video would run the instance out of memory — killing not just that export but every other request the instance was serving |
| 2 | Attachment bytes were never deleted, only their records | "Delete after 1 year" left every photo, video and voice note in storage for ever. The conversation looked deleted; its contents were not |
| 3 | Only direct chats were evaluated and destroyed | Group conversations were never queued, never expired, never deleted — kept for ever whatever the policy said. A group could even be approved and marked purged with nothing deleted |
| 4 | Per-conversation read took the **oldest** messages | In a conversation busier than the cap, recent messages — usually the ones being asked about — were invisible, and nothing said so |
| 5 | Group custodian match used the sender only | Everything a custodian *received* in a group was omitted. Under a legal hold that is an under-production |
| 6 | The archive key was unwrapped once per conversation | Hundreds of KMS calls for one question, and Google's key audit log filled with one entry per conversation instead of one per search |
| 7 | Export bundles never expired | Readable copies of an organization's messages accumulated in storage for ever — a second, unencrypted archive beside the real one |
| 8 | Scheduler secret compared with `!==` | Leaked the secret through comparison timing |

**Fixes.** Exports stream to storage, cap one file at 25 MB and the whole bundle
at 120 MB, and report both limits in the manifest. Destruction now deletes
stored bytes before their records, and handles groups. The evaluator walks
groups as well as direct chats, using one subject-reference format both sides
agree on. Search reads newest-first, reports which conversations it could only
partly examine, treats group membership as custodianship, and decrypts the whole
result in a single pass. Exports expire after 30 days and are cleared by the
nightly run. The scheduler secret is compared in constant time.

**Still open, deliberately.** Building an export does not require a fresh phone
verification, unlike releasing a hold or approving a destruction. An export
reads an organization's entire readable archive from a browser session, which is
arguably as sensitive as either. Microsoft relies on role assignment and audit
logging rather than re-verification, which is what Synzapp does today. Worth a
decision rather than a silent default.

---

## What an export actually contains — corrected after review

The first working export was a folder of JSON files. It was rejected, correctly:
nobody hands a lawyer a data dump, and a court will not accept a folder of
fragments as "the conversation". Microsoft produces a readable transcript, the
native files, and an index for review software. So do we now.

```
README.txt        Plain English: what this is and what to open first
transcripts/      START HERE - one readable page per conversation
attachments/      The original photos, videos and files
manifest.csv      One row per message, opens in Excel
data/             The same content structured, for review platforms
```

**The transcript is the deliverable.** Names, timestamps, messages in order,
attachments linked, opens in any browser, prints to PDF. Messages that could not
be read appear **in place** with the reason — skipping them would show an
unbroken conversation where there is a gap, which misrepresents the record.

**Everything is escaped.** Message text and file names are written by staff, and
the bundle is opened by somebody outside the organization. Tests prove a message
containing markup cannot run code on a reviewer's machine.

### Four defects found by using it

| Defect | Effect |
|---|---|
| Download named after the database id (`u0T7Fyhnv6wbnxtF4ieJ`) | Meaningless to the recipient, and several exports were indistinguishable. Now `Synzapp export - <who> - <date> (<id>).zip` |
| manifest.csv showed raw user ids while the transcript showed names | Same export speaking two languages, and the spreadsheet is the half people sort and filter |
| Attachments capped at 25 MB | A real video was reported as "too large to export" — not an answer a lawyer can accept. Attachments now decrypt **a chunk at a time as they stream**, so size no longer decides what can be produced. Only pre-chunking legacy attachments remain capped |
| Attachments were DEFLATE-compressed | One screen recording took an export from seconds to **287 seconds** for no size reduction, because the zip library compresses in plain JavaScript. Media is now stored; text still compresses |

### Deliberately not built: a percentage progress bar

The export runs inside one request, so the browser cannot see inside it. Any
percentage would be invented, and an invented progress bar on a compliance
screen is worse than none — it implies the system knows something it does not.
The console shows elapsed time and what is happening instead.

**A real progress bar requires the export to become a background job the page
polls**, which is how Microsoft does it and the right answer for large exports.
Not yet built; a deliberate choice, not an oversight.

---

## Simulation — made real

The wizard's Simulation panel described the rule being drafted and said counts
would appear "once the evaluator has run against this scope". They never could:
`listEnforceableRetentionPolicies` filters to `state === 'ACTIVE'`, so a draft
policy was examined by nothing, ever. The panel was a safety label wearing the
clothes of a simulation.

It now runs the real evaluation against the draft and reports what would happen.

**Three decisions worth keeping.**

**The draft is judged alongside the rules already running.** A policy never acts
alone — an existing seven-year retention outranks a new ninety-day deletion — so
simulating the draft by itself would promise deletions that can never occur. The
result separates what this rule *adds* from what was already due, because that
difference is what the administrator is deciding.

**Legal holds are counted and shown, but only when some exist.** A line reading
"0 protected" reassures about a question nobody asked.

**An incomplete count says so.** The scan reads at most 500 conversations of
each kind; beyond that the panel states the real numbers are higher. A number
that looks complete when it is not is the most damaging possible error here,
because somebody deletes records on the strength of it.

**It writes nothing.** No queue entry, no policy, no state change. Tests fail if
a write is ever added to that file.

| Endpoint | `POST /api/compliance/retention/simulate` |
|---|---|
| Service | `backend/src/services/retentionSimulationService.ts` |
| Wording | `web/src/retentionSimulationDisplay.ts` |

---

## Open decision: storage and compute are in different regions

The storage bucket is in **US-EAST1**; the backend runs in **us-central1**. Every
attachment crosses the country to be read and crosses back to be written — for a
73 MB export, roughly 146 MB of cross-region traffic. This affects all chat
media, not only exports, and cross-region egress is billed differently.

Measured for context: the export pipeline itself handles 73 MB in **649 ms**
locally, and an export with no attachment completes in **1.16 seconds** on the
server. The same export carrying the 73 MB video took **347 seconds**. The code
is not the slow part.

Resolving it means moving the service to us-east1 — which changes the URL the
mobile apps depend on — or migrating the bucket. Both are coordinated changes
with client impact, so this is recorded as a decision for the product owner
rather than something to be done quietly.

---

## The worst bug found so far: a rule's chosen people were ignored

A retention policy stores which people or chats it covers. **Nothing read it.**
`toEvaluatorPolicy` passed only action, duration, id and scope *kind* into the
decision — the targets were dropped — so every policy was judged as though it
covered the whole organization.

**A rule written to delete three colleagues' chats after ninety days would have
deleted everyone's.**

It survived because every surface showed it correctly: the wizard collected the
people, the record stored them, the policy list displayed them. Only the code
that decides what to delete ignored them, and that is the only one that matters.
No test caught it because no test asked the question "does a narrow policy leave
other people's chats alone?"

**The fix** is `backend/src/services/retentionScope.ts`, applied by both the
nightly evaluator and the simulation so the preview matches what will happen.

**An empty target list now covers nothing.** The dangerous reading — "no filter,
therefore everything" — would turn an unfinished rule into an organization-wide
deletion.

---

## Words on the compliance screens

These pages are used by Org Admins, not developers. Every phrase that assumed
otherwise was replaced.

| Was | Now |
|---|---|
| "This reaches every conversation in the tenant" | "This covers every chat in your company" |
| "A narrower scope wins over a broader one when two policies disagree" | "If two rules disagree about the same chat, the more specific rule wins" |
| "Tenant deletion and user offboarding purges are blocked while this hold is active" | "While this hold is on, this company's data cannot be deleted, and staff who leave cannot have their chats removed" |
| "Case-scoped preservation. Overrides every retention policy, indefinitely" | "Freezes chats for a legal case. Nothing is deleted while a freeze is on" |
| "A policy in simulation deletes nothing" | "This rule is off. It deletes nothing until you turn it on yourself" |

The word "tenant" no longer appears anywhere an administrator can see it.

**People are chosen from a list, never typed.** The scope step used a free-text
box; nothing validated it, so a misspelled name produced a rule that silently
covered nobody while the administrator believed those chats were on a schedule.
On a screen that deletes company records, a typo must not be able to change what
a rule means.

Still typed: "Named conversations", which needs chat references. The better
answer is a "use this chat" action on a search result, not a paste box.
