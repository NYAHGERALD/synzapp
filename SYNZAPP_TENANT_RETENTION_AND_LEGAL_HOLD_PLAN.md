# Synzapp Tenant Retention & Legal Hold Plan

## Purpose

Give an Org Admin real control over how long their company's chat content lives, and give Synzapp an answer to an enterprise security questionnaire that survives scrutiny.

The specific failure this closes: **an export today can return conversations whose media is gone, and nothing tells the admin that happened.** A silent partial restore is worse than a failed one, because the admin signs off believing it was complete.

## What Synzapp has today

An honest inventory, because the gap is larger than it looks from the settings screen.

| Capability | Status | Where |
|---|---|---|
| Per-device media cache retention | Exists | `chatOfflinePolicyService.cacheRetentionDays` |
| Media cache budget, Wi-Fi-only prefetch, purge-on-sign-out | Exists | `chatOfflinePolicyService` |
| Per-type media size limits | Exists | `chatOfflinePolicyService.ChatMediaLimitBytes` |
| Tenant data wipe / offboarding purge | Exists | `companyDataGovernance`, `companyDataWipeApi` |
| Encrypted chat backup + restore, admin policy, recovery key | Exists | `chatBackup`, `/api/profile/chat/backups` |
| **Server-side retention policy** | **Does not exist** | — |
| **Legal hold** | **Does not exist** | — |
| **Disposition review** | **Does not exist** | — |
| **Export materialization / manifest** | **Does not exist** | — |
| **Retention audit log** | **Does not exist** | — |

The critical misreading to avoid: `cacheRetentionDays` sounds like a retention policy and is not one. It governs how long media stays on a phone. It says nothing about how long the organization keeps anything. A tenant reading that field as a data-lifecycle control is being misled by our own naming.

### Why the hollow restore happens

Message lifetime and media-blob lifetime are two independent facts. A message can outlive the bytes it points at, and `createEncryptedChatBackup` serializes conversations without any guarantee that the referenced blobs still exist. Nothing in the system prevents that, and nothing reports it.

Microsoft has the same split — in Microsoft 365, Teams message retention and Teams file retention are separate policies over separate locations, so a policy scoped to messages does not cover the files shared in them. That split is an artifact of their storage substrate. **We have no such constraint and should not inherit the flaw.**

## Architecture: follow Microsoft Teams, not WhatsApp

**Decided.** Synzapp Chat follows the Microsoft Teams and Purview model. This is the single most consequential decision in this plan, and it is worth stating why in terms a security questionnaire can be answered with.

### Why not the WhatsApp model

WhatsApp is consumer end-to-end encrypted messaging with **no server-side retention, no legal hold, and no eDiscovery**. Meta cannot produce message content because it cannot read it. That is not a gap in their product; it is their product.

It is also exactly why regulated organizations cannot use it, and why financial institutions have paid enormous fines for staff conducting business there. **WhatsApp is not the benchmark for this feature — it is the problem Synzapp is sold against.**

Signal is the same architecture and the same answer.

### Why Teams

| | Retention, hold, eDiscovery | Server can read content |
|---|---|---|
| Teams / Purview, Slack Enterprise Grid | Yes | Yes |
| WhatsApp, Signal | No | No |
| Wickr, Threema Work | Yes, via a compliance recipient | No |

The third row is real and was considered: enrol a tenant-controlled archive as an additional recipient device so every message is encrypted to it, and the server stays blind. It preserves end-to-end encryption against the vendor.

**It is not what we are building.** It moves the compliance boundary into a client the tenant must operate, makes eDiscovery latency depend on that client being online, and gives an admin no way to answer "what did we hold?" without it. Teams' model is what enterprise buyers, auditors and regulators already understand, and matching a recognised architecture is worth more here than a stronger cryptographic claim that complicates every compliance conversation.

### What "follow Teams" means concretely

Teams' central architectural idea is the **substrate**: every message is written to a compliance store separate from the live chat store, and retention operates there. Deleting a message in the client removes it from the live view; the substrate copy persists until retention says otherwise. eDiscovery, holds and exports all read the substrate, never the live store.

Mapped onto Synzapp, and reconciled with the three planes below:

| Teams concept | Synzapp equivalent |
|---|---|
| Substrate (compliance copy in the mailbox) | **Preservation plane** — written on message commit, unreachable by users |
| Live Teams chat store | **Live plane** — what the app renders, soft delete only |
| Retention labels and policies | `retention_policy`, versioned, never mutated in place |
| Principles of retention (precedence) | `resolveRetentionOutcome` — adopted verbatim |
| eDiscovery hold | `legal_hold`, overrides every policy |
| Disposition review | `disposition_item` queue |
| Purview compliance portal | The Compliance section of the Synzapp web admin dashboard |

**The one place we deliberately improve on Teams.** In Microsoft 365, Teams message retention and Teams file retention are separate policies over separate locations, so a policy scoped to messages does not cover the files shared in them. That split is an artifact of their storage substrate, not a design intent, and it is why files disappear from conversations that were supposed to be retained. Synzapp has no such constraint: **media retention is derived from the messages that reference it** (decision 1 below), so a retained conversation is retained whole.

### The encryption consequence, stated plainly

Following Teams means the preservation plane holds content the tenant's own systems can read. Message transport stays end-to-end encrypted between devices; the compliance copy is encrypted at rest under a **tenant-scoped key**, following Microsoft's Customer Key model, so the tenant — not Synzapp — controls the key that makes their archive readable, and destroying that key destroys the archive.

This must be said in the product, not buried here. An organization choosing Synzapp is choosing a workplace record system, and staff should be told their work conversations are retained by their employer, exactly as they are in Teams.

---

## Core design decisions

### 1. Media retention is derived, never configured

There is no media retention field. A blob's retention is computed:

```
media_blob.derived_retain_until = max(retain_until) over every referencing message
```

A blob is purgeable only when that date has passed **and** `live_ref_count = 0`. This is enforced in the purge job *and* as a database constraint — not application logic alone. This single invariant is what makes "your data is retained" true rather than aspirational.

A tenant wanting shorter media retention for storage cost gets a **tiering policy** — move blobs older than N days to cold storage — which changes retrieval latency, not existence. If true early media deletion is ever shipped, the tenant sees a permanent banner on the export screen and every affected export is stamped incomplete.

### 2. Deletion and destruction are different operations

Three planes, separated by a store users cannot reach:

- **Live plane** — what users see. Soft delete only.
- **Preservation plane** — immutable copy, unreachable by users, readable only by eDiscovery. A user deleting content that carries an unexpired obligation lands a copy here first.
- **Disposition** — obligations expired, in a grace window, still discoverable.

Nothing is destroyed on a request path. Destruction is always a background job that must pass an obligation check and, if one exists, a hold.

### 3. Destruction is crypto-shredding

Blobs are replicated, snapshotted and backed up. Chasing every copy to overwrite it is not achievable, and claiming it is a claim we cannot defend. Each object is encrypted under its own data key; destroying that key makes deletion provable and instant across every replica — and turns a whole-tenant wipe into a bounded operation.

### 4. Exports materialize their bytes

An export copies actual bytes into a self-contained artifact rather than storing pointers into live storage. The artifact carries its own retention, default 90 days, independent of the source.

The consequence is the one an admin needs: **an export taken today stays whole forever, regardless of what retention later does to the source.** Exports-as-references means every backup silently decays — the original problem, moved one layer out.

## Data model

| Entity | Key fields | Notes |
|---|---|---|
| `retention_policy` | id, tenant_id, name, scope_type (`static`\|`adaptive`), scope_query, content_types[], action (`retain`\|`retain_then_delete`\|`delete`), duration, anchor (`created`\|`last_modified`), state, version, created_by | Never mutated in place. Edits write a new version; the old one stays for audit reconstruction. |
| `legal_hold` | id, tenant_id, case_id, custodians[], sources[], query, applied_at, released_at, released_by, delay_until | Indefinite by default. Overrides every policy. `delay_until` implements the release grace period. |
| `message` | id, conversation_id, author_id, created_at, deleted_at, plane, **retain_until**, **purge_after** | Materialized by the evaluator, never computed at read time. |
| `media_blob` | id, storage_key, kms_key_id, bytes, **derived_retain_until**, live_ref_count | **No configurable TTL.** See decision 1. |
| `disposition_item` | id, subject_ref, eligible_at, state (`pending`\|`approved`\|`extended`\|`purged`), reviewer_id, decided_at | The queue between "obligation expired" and "bytes gone". |

## Precedence

Exactly one outcome must be computable, deterministically, in this order:

1. **A hold suspends everything.** An active hold blocks permanent deletion indefinitely, regardless of policy. Obligations keep accruing underneath; the hold prevents the exit.
2. **Retention beats deletion.** If any policy says retain and another says delete, the item is retained.
3. **The longest retention wins.** Among multiple retain obligations, the item survives to the end of the longest.
4. **Most specific scope wins; then shortest deletion.** A policy targeting named users or conversations beats an org-wide one.

These are Microsoft's principles of retention, and they are correct — adopt rather than invent.

Every one of these must be explainable for any given item. That is what the retention explainer screen is for, and it is the single feature most likely to win a compliance review: Purview computes precedence correctly but shows its work poorly.

## Pipeline

**Evaluator** — runs continuously and on every policy change. Resolves adaptive scopes into concrete subject sets, gathers applicable policies and holds, applies precedence, writes `retain_until` and `purge_after`, recomputes `derived_retain_until` for touched blobs.

Adaptive scope is a query, so "everyone in Legal" picks up new members with no admin action. Build it from the start; retrofitting means rewriting the evaluator.

**Disposer** — four phases:

1. **Eligible** — `retain_until` passed, no hold. Enters the queue. Still fully discoverable.
2. **Review** — if enabled for the tenant, a named reviewer approves or extends. Otherwise auto-advances after grace.
3. **Grace** — minimum 24 hours, default 7 days. Admin-recoverable, visible in the queue, included in exports taken during the window.
4. **Shred** — destroy the per-object key in KMS, mark the row purged, reclaim storage lazily.

**Publish the end-to-end SLA.** Microsoft's pipeline takes roughly 16 days to fully honor a 1-day delete policy and surfaces that nowhere. Pick a number, show it in the admin UI next to the retention field, and hold to it. "Deleted within 7 days of expiry" stated plainly beats "immediately" that isn't true.

## Legal hold

- **Structure** — a case holds custodians (people) and non-custodial sources (conversations, channels, whole tenant). Unbounded or date-scoped.
- **Apply is immediate on the deletion path.** Search indexing may lag 24 hours; the purge block takes effect on write. Never let a hold read as "applied" while a disposer run can still destroy content.
- **Release carries a 30-day delay.** An accidental or premature release must not be instantly irreversible.
- **Holds block tenant deletion.** Wipe and offboarding purge fail closed while any hold is active, and the error names the cases and who applied them.
- **Visible to admins, invisible to end users.** Custodians must not be able to infer they are under investigation from app behavior — no banners, no changed delete behavior in the client.

Without hold override, an Org Admin shortening a retention policy is a documented method for destroying discoverable evidence. **Do not ship the retention UI before hold override works.**

## Export manifest

| Field | Purpose |
|---|---|
| `requested_scope` | What was asked for — custodians, date range, conversations. |
| `included_count` / `included_bytes` | What is actually in the artifact. |
| `excluded[]` | Every item that could not be included, **with a reason**. |
| `complete` | Boolean. False if `excluded[]` is non-empty. Rendered prominently, not buried in a log. |
| `generated_at` / `generated_by` / `hash` | Chain of custody; the hash makes tampering detectable. |

A partial export is acceptable. A partial export presenting as complete is the failure being eliminated.

## Audit

Append-only, in its own store, explicitly not governed by the retention policies it records.

- Record policy create/edit/activate/delete, hold apply/release, disposition approve/extend, export create/download, and every purge run with counts and byte totals.
- Each entry captures actor, timestamp, source IP, and previous and new value. "What was the policy on this date" must be reconstructable from the log alone.
- Audit retention has a floor: an Org Admin may extend but never reduce below one year, and never below the longest active retention policy.
- Append-only at the storage layer, not by convention in application code.

## Build order

| Phase | Work | Why here |
|---|---|---|
| 1 | **Move media out of Caches** into Application Support with backup exclusion; store relative paths | Nothing below matters while iOS can delete the media |
| 2 | **Derived blob retention** — `derived_retain_until` + refcount invariant | Stops hollow restores before any admin UI exists |
| 3 | **Preservation plane and disposer**, hardcoded default policy | Gets destruction off the request path |
| 4 | **Legal hold with override**, plus audit log | The point at which a security questionnaire can be answered honestly |
| 5 | **Admin console** — policies, holds, disposition queue, explainer | Configurable policy comes last, because it is only safe once the backstop exists |

Phases 2 and 4 change what can be claimed in a sales conversation. Phase 5 is what gets demoed — but shipping it first hands admins a control with no backstop underneath it.

### Status against this plan

- [x] **Phase 1 — complete.** Media moved to iOS Application Support (`isExcludedFromBackup`) and Android `noBackupFilesDir`, with existing files migrated by rename. Persisted paths are now portable (`synzapp-media://<file>`), rebuilt at read time, and the backup payload is portabilised so a restore onto a new device resolves correctly. Device validation still outstanding.
- [~] **Phase 2 — derived retention built, wiring outstanding.**
  - `retentionEvaluation.ts` — Purview's precedence rules as pure functions: hold suspends everything, retention beats deletion, longest wins, most specific scope then shortest deletion. Plus `deriveBlobRetention` / `isBlobPurgeable`. **26 tests.**
  - `chatMediaRetentionService.ts` — reference counting on blobs, transactional and idempotent in both directions. **16 tests.**
  - **The hollow restore is located.** Direct-chat media carried a flat 30-day TTL (`CHAT_MEDIA_TTL_MS`) and the download was refused once it passed, while the referencing message remained forever. Group media was already durable. `isChatMediaRetrievable` now serves any blob with a live reference regardless of that TTL, and falls back to the legacy TTL for blobs predating retention so nothing breaks on deploy.
  - **Outstanding:** message commit must call `registerChatMediaReferences`, deletion must call `releaseChatMediaReferences`, and the media download path must use `isChatMediaRetrievable`.
- [ ] Phase 3 — not started. Deletion is still immediate on the request path.
- [~] **Phase 4 — legal hold built and wired; audit log outstanding.**
  - `retentionPolicyService.ts` — versioned policies, never mutated in place; every write lands in `SIMULATION` and only an explicit activation makes a policy enforceable. **11 tests.**
  - `legalHoldService.ts` — apply, release with a 7-day delay, list active. **7 tests.**
  - **The backstop is live.** `deleteOrganizationForTenantOwner` now refuses while any hold is active, checked after the typed confirmation so the operator learns of it when they genuinely mean to delete. This is the plan's hard rule satisfied: the console cannot ship a retention dial with nothing underneath it, and now it does not have to.
  - **Outstanding:** the append-only audit log, and HTTP routes for the console to call.

## Admin console

Five screens, built in the Synzapp web app under **Compliance**:

| Screen | Purpose |
|---|---|
| Retention policies | The policy list, with the derived-media banner stated up front |
| New policy wizard | Five steps; step 4 carries the simulation panel and the attachment-inheritance note |
| Legal holds | Case list and detail, with release-delay and tenant-deletion-block warnings |
| Why is this retained? | Precedence resolved for one subject, in order, with the losing rules shown and why they lost |
| Disposition review | The queue between expiry and destruction, with extend/approve per batch |

Two rules the UI enforces:

- **Simulation before activation.** A policy in simulation deletes nothing; activation requires typing the policy name.
- **Held content is never offered for disposition.** It does not appear in the queue as reviewable, and the count of withheld batches is stated.

## Open decisions

1. **Published SLA number.** The plan requires stating one. It has not been chosen.
2. **Disposition review default** — on or off for a new tenant. The grace window is not optional; the review step is.
3. **Tiering vs. true early media deletion.** Recommendation is tiering only. Shipping real early deletion requires the incomplete-export banner and manifest stamping.
4. **Audit retention floor** at the standard tier — one year is proposed, not settled.

## Reference

Behavioral reference drawn from Microsoft Purview: principles of retention, retention for Teams, and eDiscovery holds. Where this plan departs — derived media retention, export materialization — the departure is deliberate and noted above.
