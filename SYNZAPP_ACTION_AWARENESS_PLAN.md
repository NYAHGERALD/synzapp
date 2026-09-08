# Synzapp Action Awareness Plan

## Purpose

Make it hard to miss an action that is open, waiting to be verified, or overdue — **without teaching anybody to mute Synzapp.**

That second half is the whole design. The failure this closes is not "too few reminders". It is a person who turned notifications off in week two and therefore never saw the overdue escalation in week nine. Every decision below is made against that.

## What Synzapp has today

An honest inventory, checked against the code rather than remembered.

| Capability | Status | Where |
|---|---|---|
| Push on assign, done, verified, cancelled, reassign | Exists | `actionService.notifyAboutAction` |
| **Push when work is started** | **Does not exist** | — |
| **Push when work is blocked** | **Does not exist** | — |
| Sender's photo on a **chat** notification | Exists, both platforms | `notificationSenderProfilePhotoCacheKey`, `SynzappFirebaseMessagingService.kt`, `NotificationService.swift` |
| **Actor's photo on an action notification** | **Does not exist** | Gated out — see below |
| Counts bar above the messages **inside a thread** | Exists, per group | `ActionCountsBar`, off group counters |
| **Anything on the chat list** | **Does not exist** | — |
| Scheduler infrastructure (secret-guarded router, Cloud Scheduler) | Exists | `routes/schedulerRoutes.ts`, `synzapp-scheduled-messages` |
| Firestore aggregation counts | Exists, proven | `rcaService.ts` uses `.count().get()` |
| **Action reminders of any kind** | **Does not exist** | — |
| **A notification channel for actions** | **Does not exist** | Everything lands on the default channel |

## What must not break

Named explicitly, because three of these are shared and one is a standing instruction.

**`sendRailsPushNotification` is used by RAILS, Announcements and Actions.** RAILS and LSW are working sections that are not to be touched. So this function gains **optional** fields only, and every existing caller's payload stays byte-identical. Any new field is absent unless a caller passes it.

**The chat notification path is finished and correct.** On Android the custom path is gated by one line:

```kotlin
if (data["type"] != "chat.message") { return false }
```

Widening that gate is the single riskiest change in this plan. It is done by *adding* a branch for action notifications, not by loosening the chat condition — the chat path keeps its own entry test unchanged, so a mistake in the new branch cannot affect messages.

**The interpreter is not part of this.** Untouched.

## The four pieces

### 1. Notify on every change that somebody is waiting on

Two events are missing, and one of them matters a lot.

| Event | Today | After |
|---|---|---|
| Assigned | Notifies | Unchanged |
| **Started** | Silent | Notifies the raiser and the department admin |
| **Blocked** | Silent | Notifies the raiser and the department admin, **with the blocking reason** |
| Done | Notifies | Unchanged |
| Verified / Cancelled / Reassigned | Notifies | Unchanged |

Blocked is the one worth building this for. An action stuck behind a part nobody ordered looks identical to an action being worked on, and the person who could unstick it is never told.

Nobody is notified about their own act — `sendRailsPushNotification` already removes the actor from the recipients, and that behaviour is relied on rather than reimplemented.

### 2. The actor's photo — different on each platform, deliberately

**Android: the photo, on the left.** A large icon on an ordinary notification. No conversation machinery, no shortcut, no `MessagingStyle` — an action is not a conversation and pretending otherwise would put work alerts into the conversation section of the shade.

**iOS: a thumbnail, on the right.** The round avatar on the left of an iOS notification is *only* available through Communication Notifications — `INSendMessageIntent` — which Apple provides for person-to-person messaging. Using it for "an action was assigned" is a misuse with two real costs: App Review may reject it, and iOS files those notifications under Communication, where Focus modes and Notification Summary treat them differently from work alerts. A `UNNotificationAttachment` gives the photo without either risk.

**They will not look the same, and that is the honest outcome.** Matching them would mean either dropping the photo on Android or misusing an Apple API.

The photo travels the way it already does for chat: a cache key the phone resolves against photos it has already cached, never an image in the payload.

### 3. A line on the chat list

One line above the chat list: **"3 open · 1 waiting to be verified · 1 overdue"** with a text link, **Actions**, that opens the Actions screen.

Three rules:

- **It counts the reader's own work**, not the company's. A number that is not yours is a number you learn to ignore.
- **It is absent when there is nothing.** A bar that shows zeroes is a bar people stop seeing — the existing `ActionCountsBar` already works this way and this follows it.
- **Overdue is coloured differently from the rest**, because it is the only part that needs somebody today.

Counted with a Firestore aggregation query, capped, not by reading rows and not by adding per-user counters. Counters would need maintaining on every write and backfilling for existing actions; `.count()` is exact, cheap, and already used in `rcaService.ts`.

### 4. Reminders — a digest, and an escalation

**This is where the plan disagrees with the request, and it was accepted on that basis.**

The request was: every day, twice a day, custom times per day, plus escalations. That is more configuration than the problem needs and more notification than a person tolerates. What is built instead:

| Setting | Default | Options |
|---|---|---|
| Reminder | On | Off · Once a day · Twice a day |
| First reminder time | 08:00 | Any hour |
| Second reminder time | 15:00 | Any hour, only when twice a day |
| Escalate overdue to department admin after | 24 hours | 4 / 8 / 24 / 48 hours, or never |
| Working hours | 07:00–19:00 | Any range |

**One notification, not one per action.** *"You have 3 open actions, 1 waiting to be verified, and 1 overdue."* Ten actions produce one reminder.

**Nothing is sent when there is nothing outstanding.** A digest that says "0 open" is exactly what teaches somebody to swipe it away without reading.

**Only the reader's own work.** Never a reminder about somebody else's action.

**Overdue is the only thing that escalates.** It goes first to the person, and after the configured period to their department admin. A reminder somebody has ignored twice will be ignored a third time; a message to their supervisor will not. This is the part of the plan that actually stops things being missed.

**Nothing outside working hours**, unless an action is overdue *and* critical.

**A separate notification channel.** Reminders get their own Android channel and their own iOS category, so somebody can mute reminders without muting chat. Without this the only way to escape reminders is to mute Synzapp, which loses the escalation too — the failure this whole plan exists to prevent.

Custom times per day are deliberately **not** built. If a tenant asks for 06:00 and 14:00 because of shift patterns, that is a real reason and it gets added. Building it first invites configuring rather than deciding.

## Data model

**`organizations/{tenantId}.actionReminderPolicy`** — the settings table above, read through a normalizer that falls back on anything unusable, exactly as `scheduledMessagePolicy` does.

**`organizations/{tenantId}/users/{uid}.actionReminderState`** — the last digest sent and the last escalation sent per action, so a run that repeats does not notify twice. Nothing is deleted; a run that has already happened is skipped rather than re-done.

Client access: none. `firestore.rules` ends in a catch-all deny.

## The reminder worker

A second route on the existing scheduler router — `POST /api/scheduler/actions/reminders/run` — guarded by the same shared secret, compared in constant time, failing closed when unset. Cloud Scheduler calls it **every 15 minutes**; each run sends only to tenants whose configured time has arrived in their own time zone and who have not already been sent that slot.

Fifteen minutes rather than every minute because a reminder is not time-critical to the second, and a job that wakes 96 times a day is cheaper to reason about than one that wakes 1,440 times.

## Audit

`ACTION_STATUS_CHANGED` already covers started and blocked. New events:

| Action | When |
|---|---|
| `ACTION_REMINDER_SENT` | A digest goes out, with the counts it carried |
| `ACTION_ESCALATED` | An overdue action reaches a department admin |
| `ACTION_REMINDER_POLICY_UPDATED` | Settings changed, with the values |

## Build order

Each step finished, typechecked and tested before the next.

1. `actionReminderPolicy.ts` — pure normalizers, bounds, and "is this slot due in this zone", with tests.
2. `actionDigest.ts` — pure: what a person's digest says, and whether it is worth sending at all. Tests.
3. Notify on started and blocked. Smallest change, immediate value.
4. Optional photo fields on `sendRailsPushNotification`, with a test asserting RAILS and Announcement payloads are unchanged.
5. Android: the action branch beside the chat gate, never inside it.
6. iOS: thumbnail attachment in the notification service extension.
7. Per-user counts endpoint, then the chat-list line.
8. Reminder worker and scheduler route; extend the scheduler guard test.
9. Admin settings screen.
10. Full backend and mobile suites, typecheck both, then deploy and create the Cloud Scheduler job.

## Risks, and what is done about each

| Risk | What is done |
|---|---|
| Breaking RAILS or Announcement pushes | New fields are optional; a test pins that both payloads are unchanged when they are not passed |
| Breaking chat notifications | The action branch is added beside the chat gate, never by loosening it; the chat entry test stays byte-identical |
| iOS review rejection for misused Communication Notifications | Not used. Thumbnail attachment instead |
| Notification fatigue | One digest, silent when empty, own channel, working hours, only your own work |
| A scheduler run repeating | Per-user, per-slot state, checked before sending |
| Counting rows for every chat list load | Aggregation query, capped, no new counters and no backfill |

## What this plan does not do

- No custom reminder times per day. Added when a tenant gives a shift-pattern reason.
- No per-action reminders. The digest is the unit.
- No reminders about other people's work, at any setting.
- No change to how any existing notification looks or reads.

---

## Status — built and deployed, 7 September 2026

Backend 644 tests, mobile 653, both typecheck clean. Android compiles, Swift parses. Revision `synzapp-backend-00161-n6w`.

| Step | State | Where |
|---|---|---|
| 1. Reminder policy rules | Done — 35 tests | `actionReminderPolicy.ts` |
| 2. Digest builder | Done — 19 tests | `actionDigest.ts` |
| 3. Started and blocked notify | Done | `actionService.notifyAboutAction` |
| 4. Actor's photo, own channel | Done — 11 tests | `notificationService.ts`, `actionService.ts` |
| 5. Android branch | Done, compiles | `SynzappFirebaseMessagingService.kt` |
| 6. iOS thumbnail | Done | `NotificationService.swift` |
| 7. Personal counts and the chat-list line | Done — 7 tests | `getPersonalActionCounts`, `ActionAttentionBanner` |
| 8. Reminder worker and route | Done | `actionReminderService.ts`, `/api/scheduler/actions/reminders/run` |
| 9. Admin settings | Done | `ActionRemindersSettings.tsx` |
| 10. Deploy and schedule | Done | `synzapp-action-reminders`, every 15 minutes |

First live run: `{"digestsSent":0,"escalationsSent":0,"tenantsFailed":0,"tenantsRun":2}` — both tenants read, nothing due, which is the correct answer outside a reminder hour.

### Decisions taken during the build

**Escalation is marked on the action, not on a person.** The plan proposed per-user state for both. Putting the flag on the action makes "only once" true by construction: it cannot be escalated twice by two runs reading different records.

**The reminder slot is claimed before the notification is sent.** A crash between the two costs one reminder rather than sending a second. Somebody reminded twice trusts the next one less, so that is the safer way round.

**`GET /api/actions/my-counts` sits above `/:actionId`.** Express matches in order, and the route was briefly declared below the parameter — where it answered "that action was not found". A comment now says why it must stay put.

**Android action pushes are data-only.** A payload carrying a `notification` block is drawn by Android itself while the app is backgrounded, and the app's code never runs — so the actor's photo, which lives on the phone, could never be attached. The payload also carries a plain title and body for Expo's own handler, and the custom handler returns false on anything unexpected: a fault costs the photo, never the notification.

**RAILS and Announcements are untouched.** They share the push sender with Actions. Every new field is optional and absent for them, and `actionNotificationPayload.test.ts` fails if either ever starts passing one.

## Open

**No tenant has set a time zone.** The policy defaults to UTC, so a company that leaves it will be reminded at 08:00 UTC. The admin screen writes the administrator's own zone the first time they change any setting, which is the point at which "08:00" starts meaning the clock they are looking at.

**The mobile app is not built.** Nothing on the phone — the chat-list line, the reminder settings, the photo on a notification — exists until it is.

