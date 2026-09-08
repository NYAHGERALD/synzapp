# Synzapp Scheduled Messages Plan

## Purpose

Let somebody write a message now and have it arrive at a time they choose, and give an Org Admin the ability to see that one is waiting and stop it — **without ever being able to read it**.

The decision that shapes everything below: **the message waits on the server, not on the phone.** A scheduled message that does not send is worse than not having the feature, and neither iOS nor Android will wake an app at a chosen time to send one.

## What Synzapp has today

An honest inventory. Most of what this needs already exists and is proven in production.

| Capability | Status | Where |
|---|---|---|
| End-to-end encrypted send, sealed per recipient device | Exists | `sendEncryptedDirectEnvelope`, `encryptedMessageEnvelopeService.ts:432` |
| Idempotent send — a replayed message is not delivered twice | Exists | `messageMetadata/{sha256(senderUid:clientMessageId)}` dedupe, same file |
| Sender/recipient/organization all-active check on every send | Exists | `getEncryptedDirectContext`, same file |
| Cloud Scheduler → HTTP job with a shared secret, timing-safe, fails closed | Exists | `POST /api/compliance/retention/scheduled-run`, `complianceRoutes.ts:426` |
| Per-tenant policy document + admin GET/PATCH + `security.manage` | Exists | `chatOfflinePolicyService.ts`, `adminRoutes.ts:583` |
| Audit event writer | Exists | `writeAuditEvent`, `auditService.ts:16` |
| Native date and time pickers | Exists | `@react-native-community/datetimepicker`, used in `AdminChatScreen`, `OrgAdminOnboardingScreen` |
| Device outbox on the phone (SQLite, queue ids, retries) | Exists | `PendingChatMessage`, `localChatStore.ts:99` |
| Dormant device retirement | Exists | `deviceDormancy.ts` |
| **Scheduled send of any kind** | **Does not exist** | — |
| **Any scheduler route outside compliance** | **Does not exist** | — |

Nothing in this plan invents a new delivery mechanism. A scheduled message is an ordinary message whose send is replayed later, through the same function, with the same checks.

## The architecture decision, and why

### Why not hold it on the phone

The device outbox at `localChatStore.ts:99` already holds unsent messages and drains them. Adding a "not before" time to it is perhaps thirty lines.

**It would not work.** The drain only runs while the app runs. A message set for 09:00 Monday sends at 11:40 Monday when the phone is next unlocked and the app opened. Neither platform offers a guaranteed wake-up at a wall-clock time — iOS background refresh is discretionary and Android's exact alarms are restricted and killed by battery optimisation. Building on that produces a feature that works in testing and fails in the field, which is the worst outcome available.

### Why the server works

The send path takes an already-encrypted body. The phone seals the message exactly as it does today, and the server stores that sealed blob and replays it later through `sendEncryptedDirectEnvelope`. The server never holds plaintext and never gains the ability to read one.

### The consequence, stated plainly

The message is sealed to the recipient's devices **as they are at the moment it is scheduled**. If the recipient replaces or reinstalls their phone before release, the new device holds no key for it.

This is **not a new defect**. It is exactly what already happens to every message in the product: `listEncryptedDirectEnvelopesForDevice` looks up `encryptedKeysByDevice[deviceId]` and a device that was not sealed to gets the `decryptionFailed` placeholder. A scheduled message inherits the semantics of a message sent at the moment it was scheduled — which is a defensible thing for a scheduled message to be.

What we must not do is deliver it to nobody in silence. See **Release outcomes** below.

## Scope

**Phase 1 — this plan.**

- Direct chats only.
- Text only. Media is excluded deliberately: media has its own retention (`chatMediaRetentionService`) and an uploaded file could be expired before release, producing a message pointing at nothing. Media scheduling needs a reference hold, which is Phase 2 work.
- Schedule, list your own, cancel, send now.
- Org Admin: see metadata, cancel. **Never** read.
- Per-tenant policy.
- Audit at schedule, release, cancel and failure.

**Phase 2 — not this plan.** Group chats, media, editing a scheduled message before it goes.

## Data model

`organizations/{tenantId}/scheduledMessages/{scheduledMessageId}`

A tenant subcollection, so an Org Admin's list is one query, and a collection-group query serves the release worker across every tenant.

| Field | Type | Notes |
|---|---|---|
| `scheduledMessageId` | string | Document id, repeated in the body for collection-group reads |
| `tenantId` | string | |
| `senderUid` | string | |
| `senderDeviceId` | string | The device that sealed it |
| `chatType` | `'DIRECT'` | Phase 1 |
| `contactId` | string | Recipient uid |
| `conversationId` | string | For the admin list and for audit |
| `clientMessageId` | string | Generated at schedule time. **This is what makes release idempotent** |
| `envelope` | map | `algorithm`, `ciphertext`, `encryptedKeysByDevice`, `keyVersion`, `nonce`, `notificationPreviewByDevice`, `recipientDeviceIds` |
| `releaseAtMs` | number | The absolute instant |
| `timeZone` | string | IANA zone the sender chose in, for display and audit |
| `status` | string | `SCHEDULED` → `SENDING` → `SENT` \| `CANCELLED` \| `FAILED` |
| `attempts` | number | |
| `lastError` | string \| null | |
| `createdAt` / `updatedAt` | timestamp | |
| `sentAtMs` / `envelopeId` | number / string | Set on success |
| `cancelledAt` / `cancelledByUid` / `cancellationReason` | | Set on cancel |

Client access: none. `firestore.rules` ends in a catch-all `allow read, write: if false`, so a new collection is denied to every client by default. All access is through the API using the Admin SDK.

### The privacy rule, and why it needs enforcing in code

The Org Admin list must never return `envelope`.

This is not merely tidy. The archive key is one of the recipients of every message — `mapArchiveDevice` puts `archive_{keyId}` into `encryptedKeysByDevice`. A compliance admin holding the archive key could therefore decrypt a ciphertext they were handed. **Returning the envelope would be handing an admin the ability to read an unsent private message, days before its author committed to sending it.**

So the admin mapping function returns metadata only, and a test asserts that no ciphertext, key material or preview leaves through that path.

## Policy — `organizations/{tenantId}.scheduledMessagePolicy`

Set by an Org Admin holding `security.manage`, following `chatOfflinePolicyService` exactly.

| Setting | Default | Bounds | Meaning |
|---|---|---|---|
| `enabled` | `true` | — | Whether anyone in this company may schedule a message |
| `maxDaysAhead` | `30` | 1–365 | How far ahead a message may be set |
| `maxPendingPerUser` | `20` | 1–200 | How many one person may have waiting |
| `adminVisibilityEnabled` | `true` | — | Whether an Org Admin sees, and can cancel, pending messages |

`adminVisibilityEnabled` defaults **on** because that is the decision taken for this product: an admin can see that a message is waiting and stop it. It is a setting rather than a constant because what an admin may see of a private conversation is a judgement each company makes for itself, and the metadata — who, to whom, when — is real information about a private exchange. Turning it off leaves the sender in sole control.

Every value is read through a normalizer that falls back to the default on anything unusable, because these are read on the path that sends a message and a bad settings value must not stop a company talking to itself.

## The release worker

**Route.** A new router at `/api/scheduler`, in `backend/src/routes/schedulerRoutes.ts`.

It cannot live in `profileRoutes` or `adminRoutes`: `apiRouteGuardCoverage.test.ts` asserts that every route in both requires App Check and a Firebase session, and Cloud Scheduler can present neither. Rather than weaken that test, scheduler jobs get their own router with their own guard — and the guard test is extended to assert that **every** scheduler route checks the secret.

**Authorisation.** `X-Synzapp-Scheduler-Secret`, compared with `timingSafeEqual`, exactly as the retention run does. Reads `SYNZAPP_SCHEDULER_SECRET`, falling back to `SYNZAPP_RETENTION_SCHEDULER_SECRET` so this works on the current deployment without an environment change. **If neither is set the route returns 503 and does nothing** — a missing secret fails closed.

**Cadence.** Cloud Scheduler, every minute. A run claims at most 200 due messages.

**Claiming.** Each message is claimed `SCHEDULED → SENDING` in a transaction before any work, so two overlapping runs cannot both send it. Even without the claim the existing `clientMessageId` dedupe would prevent a duplicate arriving, but the claim also prevents a duplicate push and a wrong status.

### Release outcomes

| Situation | Outcome |
|---|---|
| Everything in order | `SENT`, with `envelopeId` and `sentAtMs` |
| Some sealed recipient devices no longer active | Send to those that are. This is normal and expected — a device retiring is not a reason to withhold a message |
| **No** sealed recipient device is still active | `FAILED`, `lastError: "No recipient device could receive this message."` Not retried. The sender is shown it |
| Sender deactivated, archived or deleted | `FAILED`. Comes for free: `getEncryptedDirectContext` refuses a sender whose user record is not `ACTIVE` |
| Recipient deactivated, or organization suspended | `FAILED`, same mechanism |
| Transient failure | Retried on the next run, up to 5 attempts, then `FAILED` |

Permanent versus transient is decided by error name — `AuthorizationError`, `NotFoundError` and `ValidationError` are permanent and are not retried. Anything else is transient.

Nothing is ever deleted by the worker. A `FAILED` message stays, with its reason, because a message that silently vanished is indistinguishable from one that was never scheduled.

## Endpoints

**Sender** — `profileRouter`, App Check + session + active device, as every other chat route.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/profile/chat/conversations/:contactId/scheduled-messages` | Schedule. Body is the ordinary encrypted envelope plus `releaseAtMs` and `timeZone` |
| `GET` | `/api/profile/chat/scheduled-messages` | Mine. Optional `contactId` filter for the in-thread banner |
| `POST` | `/api/profile/chat/scheduled-messages/:scheduledMessageId/cancel` | Cancel mine |
| `POST` | `/api/profile/chat/scheduled-messages/:scheduledMessageId/send-now` | Release mine immediately |

**Org Admin** — `adminRouter`, `security.manage`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/scheduled-messages` | Metadata only. 403 when `adminVisibilityEnabled` is false |
| `POST` | `/api/admin/scheduled-messages/:scheduledMessageId/cancel` | Cancel somebody's pending message |
| `GET` / `PATCH` | `/api/admin/scheduled-message-policy` | Read and set the policy |

**Scheduler** — `schedulerRouter`, shared secret.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/scheduler/chat/scheduled-messages/run` | Release everything due |

## Validation

Decided in a pure module so the rules can be argued with in a test.

- **Not sooner than 60 seconds ahead.** A message due inside the current release cycle would race it.
- **Not further than `maxDaysAhead`.**
- **Not more than `maxPendingPerUser` waiting.** Counted at schedule time.
- **No media.** `mediaIds` must be absent or empty in Phase 1.
- **Refused entirely when `enabled` is false.**
- Cancel and send-now require the caller to be the sender, or an Org Admin with `security.manage` **and** `adminVisibilityEnabled`.
- Only a `SCHEDULED` message may be cancelled or released. Cancelling an already-cancelled one succeeds quietly; cancelling a sent one fails.

### Time zones and daylight saving

`releaseAtMs` is an absolute instant. The native picker resolves the wall-clock time somebody chose using the zone's rules **for that future date**, so "09:00 on 26 October" set from London two weeks before the clocks change is stored as the instant that is 09:00 local on the day. The IANA zone is stored beside it for display and for audit, never for recomputation.

## Audit

Written through the existing `writeAuditEvent`, so these appear in the same log an admin already reads.

| Action | When | Metadata |
|---|---|---|
| `CHAT_MESSAGE_SCHEDULED` | Created | conversation, recipient, `releaseAtMs`, zone |
| `CHAT_MESSAGE_SCHEDULE_RELEASED` | Sent | plus `envelopeId`, attempts |
| `CHAT_MESSAGE_SCHEDULE_CANCELLED` | Cancelled | plus who cancelled and whether by admin |
| `CHAT_MESSAGE_SCHEDULE_FAILED` | Given up on | plus the reason |

Never the ciphertext, never the preview, never a key.

## The phone

**Gesture.** Long-press the send button. The button already exists in `MessageThread.tsx` and already switches between send and voice; a `onLongPress` is added to it.

**Sheet.** Quick choices first — *Later today*, *Tomorrow 9am*, *Monday 9am* — then *Pick a time*, which opens `DateTimePicker` on iOS and `DateTimePickerAndroid` on Android. These are the platform's own pickers, already used elsewhere in the app, so the wheel and the clock are the real ones rather than a lookalike.

**Waiting messages.** A row above the composer — *1 message scheduled* — opening a list with **Send now** and **Cancel** against each. A scheduled message is not drawn in the thread, because it has not been sent and a bubble would say otherwise.

**Offline.** Scheduling requires the network, like sending does. The sheet reports failure rather than pretending.

## Build order

Each step is finished, typechecked and tested before the next begins.

1. `scheduledMessagePolicy.ts` — pure normalizers and defaults, with tests.
2. `scheduledMessageRules.ts` — pure validation and release decisions, with tests.
3. Refactor `getEncryptedDirectContext` into a token path and a `(uid, tenantId, role)` path so the worker can reuse every existing check. No behaviour change.
4. `scheduledMessageService.ts` — create, list, cancel, send-now, release.
5. `schedulerRoutes.ts` plus the guard-coverage test extension.
6. Sender and admin routes.
7. Mobile API client.
8. Mobile UI — long-press, sheet, banner, list.
9. Full backend and mobile suites, typecheck both.

## What this plan does not do

- It does not schedule group messages or media. Phase 2.
- It does not let anybody edit a scheduled message. Cancel and rewrite.
- It does not re-seal at release. That would require the server to read the message.
- It does not create the Cloud Scheduler job itself. That is one console command, recorded in the runbook, and it is stated here rather than assumed done.

---

## Status — Phase 1 built

Written on 7 September 2026. Backend 537 tests pass, mobile 603 pass, both typecheck clean.

| Step | State | Where |
|---|---|---|
| Rules and policy, pure and tested | Done — 40 tests | `scheduledMessageRules.ts`, `test/scheduledMessageRules.test.ts` |
| Context resolver split so the worker reuses every check | Done, no behaviour change | `encryptedMessageEnvelopeService.resolveEncryptedDirectContext` |
| Send split into a token path and an identity path | Done | `sendEncryptedDirectEnvelope`, `releaseEncryptedDirectEnvelope`, `deliverEncryptedDirectEnvelope` |
| Service — schedule, list, cancel, send now, release | Done | `scheduledMessageService.ts` |
| Scheduler router with its own secret guard | Done | `routes/schedulerRoutes.ts`, mounted at `/api/scheduler` |
| Sender routes | Done | `profileRoutes.ts` |
| Admin routes and policy | Done | `adminRoutes.ts` |
| Security properties pinned against the source | Done — 19 tests | `test/scheduledMessageSecurity.test.ts` |
| Mobile API client | Done | `chatApi.ts` |
| Times offered, pure and tested | Done — 22 tests | `scheduleMessageTimes.ts` |
| Long-press, sheet, banner, list | Done | `ScheduleMessageSheet.tsx`, `ScheduledMessagesSheet.tsx`, `MessageThread.tsx` |

### Decisions taken during the build, and why

**One single-field index, declared and created.** The release worker queries one field — `pendingReleaseAtMs`, present only while a message is waiting and removed the moment it is sent, cancelled or given up on. This was chosen over a `status` + `releaseAtMs` composite deliberately: a finished message leaves the queue entirely rather than being scanned past forever.

It was first built believing this needed **no** index, on the reasoning that Firestore's automatic single-field indexes cover collection-group queries. **That is wrong, and the first live call proved it:**

> `The query requires a COLLECTION_GROUP_ASC index for collection scheduledMessages and field pendingReleaseAtMs.`

Automatic single-field indexes have collection scope only. A collection-group query needs the field's index configuration set explicitly, which `gcloud firestore indexes fields update` cannot do — it accepts `order` and `array-config` but not a query scope — so it was set through the Firestore Admin API and recorded in `firestore.indexes.json` under `fieldOverrides`.

The lesson worth keeping: this was asserted in a plan, written into a comment and pinned by a test, and none of that made it true. It took one real request.

The field is **removed**, never set to null. In Firestore `null` sorts before every number, so a nulled field would still match `<= now` and a sent message would be picked up again on the next run. A test pins this.

**The counting and listing queries use equality filters only**, with sorting done in memory. Two equality clauses are served by merging single-field indexes; adding an `orderBy` would have required a composite index for each.

**The sealing device's public key is stored with the message.** Opening a message means combining your own private key with the sender's public one, and an unsent message has no envelope record to take it from. Without this, a person's second phone could not show them the message it was offering to cancel.

**An audit test caught a real gap.** `auditCoverage.test.ts` requires every admin mutation route to record both success and failure; the admin cancel route recorded only success. An admin reaching for somebody's pending message and being refused is exactly what an audit log is for.

**The scheduler's secret check is written out in `schedulerRoutes.ts` rather than shared with the retention run.** `retentionSchedule.test.ts` asserts that the constant-time comparison appears within the retention handler itself. Moving it to a shared module would have meant editing a passing security test to accommodate a refactor, which is the wrong way round.

## Operational setup

None of these is a code change.

1. **Scheduler secret** — done. `SYNZAPP_RETENTION_SCHEDULER_SECRET` was already set on `synzapp-backend`, so the fallback applies and no environment variable was added or changed.
2. **Cloud Scheduler job** — done. `synzapp-scheduled-messages`, every minute, `POST /api/scheduler/chat/scheduled-messages/run`, in `us-central1`.
3. **Collection-group index** — created through the Firestore Admin API and declared in `firestore.indexes.json`.

The backend is deployed: revision `synzapp-backend-00157-qxf`, all 44 environment variables intact.

**The mobile app is not.** Scheduling is a phone feature, so nobody can use it until a new build is installed. The backend change is invisible to everyone until then.

---

## Corrections after the first real use, 7 September 2026

Three defects found by using it, not by testing it.

**The banner went stale.** A message was scheduled, the server sent it on time, and the phone went on saying "1 message scheduled" with *Send now* and *Cancel* still offered for a message that had already gone. The app only asked what was scheduled when the chat was opened, and a scheduled message is sent by the server, so nothing ever told it. It now asks again once a waiting message comes due — about twenty seconds after its time, since the worker runs on the minute — and the check re-arms itself until nothing is left waiting.

**A failure disappeared in silence.** `listMyScheduledMessages` asked only for `SCHEDULED`, so a message that could not be sent vanished from its author's list. They would have believed it went. This plan said the sender is shown it; they were not. Failures now stay in the list with their reason until cleared, the banner says so in words rather than folding them into a count, and clearing one sets a `dismissedAt` flag rather than deleting anything — a list somebody can edit by tapping is not an audit trail.

**The re-check would have polled forever.** Once failures joined the list, the timer that re-arms on every change had nothing to stop it, because a failure never resolves. It now watches only messages still waiting.

## The three gaps, now closed

**The Org Admin screen exists.** Settings → Organization security → *Scheduled messages*, behind the same `security.manage` permission as the rest of that section. It lists who has a message waiting, to whom and when, with **Stop** against each, and carries the two switches that matter: whether people may schedule at all, and whether admins may see and stop what is waiting. It shows no message text, and cannot: the type it renders has no field for one.

**The chat list is marked.** A small clock where a conversation has a message waiting, and a red alert where one failed. Built from the same fetch the banner uses, refreshed when the chats load and whenever a conversation is opened. This is what makes a failure findable — before it, a message that could not be sent, in a thread nobody opened, was invisible.

**Long-pressing send in a group says why.** Holding a button and getting nothing reads as a broken button; it now explains that scheduling is for one-to-one chats and suggests what to do instead.

