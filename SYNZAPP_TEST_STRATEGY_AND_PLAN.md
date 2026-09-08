# Synzapp Test Strategy & Plan

**Status:** Source of truth for how Synzapp is verified.
**Companion to:** [SYNZAPP_ENTERPRISE_PARITY_AND_HARDENING_PLAN.md](SYNZAPP_ENTERPRISE_PARITY_AND_HARDENING_PLAN.md) — this document is its Phase 1, expanded.

## Why this exists

A recent working session produced a run of defects found the same way every time: a human opened the app on a device and noticed something wrong. A vanishing message bubble, an unread badge that cleared itself, black thumbnails after restart, a progress ring on already-sent videos, a transcoder that hung. Several were introduced by the fix for the one before it.

None of them were subtle. **Every one was mechanically detectable:**

| Defect | The test that would have caught it |
|---|---|
| In-flight bubble vanished when a contact event arrived | "A queued message survives every path that rebuilds the thread" |
| Unread badge cleared without opening the chat | "Background hydration does not change unread state" |
| Thumbnails black after reinstall | "A media path written under a different container still resolves" |
| Progress ring on an already-sent video | "A message whose media is on disk shows no transfer state" |
| iOS transcode hung forever | "A transcode completes within a timeout" |

So the problem is not defect density. It is that **the only detector is a person**, and a person is slow, expensive, and only available for one build at a time.

## Current state

| | Reality |
|---|---|
| CI | **None.** No `.github/workflows`. Nothing runs on push. |
| Mobile unit tests | 7 files, ~36 tests, all small pure services (`chatOfflineSettings`, `chatMediaTransferProgress`, `chatMediaPathResolution`, …) |
| Backend tests | 21 files via `node --test`, including Firestore rules tests against emulators |
| `AdminChatScreen.tsx` | **47,381 lines, zero tests** — and it holds the outbox, reconciliation, and media pipeline |
| Integration tests | None |
| Device / E2E tests | None |
| Performance benchmarks | None |

The backend is in noticeably better shape than mobile. The gap is concentrated exactly where the defects are.

## Principles

1. **A defect that escapes twice is a process failure.** Every fixed bug gets a test that fails before the fix and passes after. Non-negotiable.
2. **Test the seam, not the screen.** The valuable tests are on outbox reconciliation, path resolution, and precedence — logic with rules. Pixel assertions are brittle and prove little.
3. **Characterize before refactoring.** Tests written against current correct behavior are what make decomposing a 47k-line file safe.
4. **A test that needs a device is a last resort, not a first.** Push each check to the cheapest layer that can catch it.
5. **Security invariants are tested like features.** "Tenant wipe removes every plaintext derivative" is a test, not a code review comment.
6. **Red means stopped.** A failing pipeline blocks merge. A quarantined flaky test is a bug with a deadline, not a permanent state.

## The layers

### Layer 1 — Unit (fast, most numerous)

Pure logic, no device, no network. Runs in under 30 seconds.

**Priority targets, in order:**

| Target | What it protects |
|---|---|
| Message identity & dedup | Duplicate bubbles, remounting rows, the flashing bubble |
| Outbox lifecycle | Messages lost between "sent" and "cached" |
| Media path resolution | Black thumbnails, vanished media across containers |
| Transfer state resolution | Phantom progress rings, stuck states |
| Retention precedence *(Phase 4)* | Wrong deletion outcome — the highest-consequence logic in the product |
| Media limits & policy clamping | Tenant policy silently not applied |
| Chunked crypto framing | Corrupt media, undecryptable history |

**Extraction note:** several of these currently live inside `AdminChatScreen.tsx` and cannot be imported. Pulling `uniqueChatMessages`, `mergeChatMessageWithLocalState`, and the outbox reconciliation helpers into importable modules is the first task — and it doubles as the first slice of Phase 2 decomposition.

### Layer 2 — Integration

Real SQLite, real service wiring, mocked network and native modules.

- Save a conversation, restart the store, read it back — media paths still resolve.
- Queue a message offline, come online, confirm exactly one message is sent and one bubble remains.
- Interrupt an upload mid-flight, restart, confirm recovery does not duplicate or lose it.
- Wipe a tenant, confirm no plaintext derivative survives anywhere — messages, thumbnails, transcodes, decrypted cache, search index.
- Restore a backup taken on a different device, confirm media resolves.

### Layer 3 — Backend & contract

Extends the existing `node --test` suite.

- Retention precedence and the derived-blob invariant, including the database constraint — **assert the constraint rejects the write, not just that application code avoids it.**
- A legal hold blocks purge, blocks tenant deletion, and names the blocking cases in the error.
- Export manifests: `complete` is false whenever `excluded[]` is non-empty.
- `markRead=false` does not clear unread; the default does.
- Directory listing returns the right people per role, and never anyone outside the tenant.
- Firestore rules tests continue to run against emulators.

### Layer 4 — Device smoke

Small, slow, high-value. The checks that only a real device can answer.

Automate with Detox or Maestro where practical; keep a written manual script for what cannot be automated yet. **Run on physical hardware, both platforms, before any release.**

| Check | Why only on a device |
|---|---|
| Send a 1-minute video end to end | Real codecs, real hardware encoder, real timing |
| Receive and play it on a second device | Cross-device decryption and playback |
| Force-quit mid-upload, reopen | True process death, not a simulated unmount |
| Media survives an app update | Container identity changes only on a real install |
| Background/foreground during transfer | Real OS scheduling and background transfer behavior |
| Push arrives and hydrates without clearing unread | Real APNs/FCM delivery |
| Photo permission on a clean install | Real permission state machine |

### Layer 5 — Performance

Phase 3 of the parity plan. A seeded thread of 500 messages with 200 media items, measuring scroll frame rate, chat open time, input latency during three concurrent uploads, and memory ceiling — with a regression budget, run on a schedule rather than every push.

## CI

**This is the first thing to build. Nothing else in this document works without it.**

```
on: push, pull_request

mobile:   typecheck → lint → unit → build:preflight
backend:  typecheck → unit → rules (emulators)
web:      typecheck → build
```

**Rules:** red blocks merge; the pipeline stays under 10 minutes or people route around it; device smoke runs pre-release, not per-push; performance runs nightly.

## Regression suite — the recent defect run

Each of these becomes a permanent test. This table is the acceptance criteria for Phase 1.

| # | Defect | Assertion |
|---|---|---|
| R1 | Outbox wiped by contact events | A queued message survives every thread-rebuild path, including `chatContactUpdated` |
| R2 | Duplicate/remounting bubbles | A local message and its server echo reconcile to one row with a stable key |
| R3 | Outbox record removed before commit | A sent message is readable from cache or outbox at every point in the transition |
| R4 | History cached before `clientMessageId` | Messages agreeing on either identifier collapse to one |
| R5 | Badge cleared by background fetch | `markRead=false` leaves unread intact; opening a chat clears it permanently |
| R6 | Black thumbnails after reinstall | A path under a foreign container resolves to the current one |
| R7 | Media lost to cache purge | A missing file clears its stale path and re-downloads |
| R8 | Stale in-progress status | Media present on disk reports no transfer state |
| R9 | Upload completion not persisted | After upload, the cached message reads `available` |
| R10 | iOS transcoder deadlock | A transcode completes within a timeout |
| R11 | Transcode slower than the upload it saved | Compression stays within a time budget relative to duration |
| R12 | Absolute paths in backups | A backup payload contains no device-specific absolute path |
| R13 | Employees saw an empty directory | A non-admin gets colleagues including the Org Admin |
| R14 | Progress churned the whole list | A progress update re-renders one row, not the thread |

## Security tests

Treated as first-class, because each corresponds to a promise already made to a tenant.

| Invariant | Test |
|---|---|
| No plaintext derivative survives a wipe | Seed messages, media, thumbnails, transcodes, search index → wipe → assert nothing remains |
| Media excluded from device backup | Assert the exclusion flag on iOS; assert the no-backup directory on Android |
| Server stores no local paths | Assert outgoing envelopes carry no `localUri` |
| Hold outranks admin | Attempt policy-driven purge and tenant deletion under hold; both fail closed |
| Holds invisible to end users | Client behavior is byte-identical with and without a hold |
| Audit is append-only | Attempt update and delete against the audit store; both rejected at the storage layer |
| Search index never leaves the device | No network call carries index content; index is wiped with tenant data |

## Test data & environments

- **Fixtures over live data.** A seeded tenant with known conversations, media of every kind, and multiple roles. No production data in tests, ever.
- **Media fixtures** committed small: a short 1080p clip, a 4K clip, a portrait clip, an HDR clip, a HEIC photo, a large PDF. Large binaries via LFS or generated at setup.
- **Emulators for backend**, already in use for rules tests — extend to retention and hold tests.
- **Two physical devices minimum**, one iOS and one Android, one of them mid-tier rather than flagship. Performance targets are meaningless measured only on the newest hardware.

## Rollout

| Step | Work | Exit |
|---|---|---|
| 1 | CI pipeline running existing tests | Green on push; red blocks merge |
| 2 | Extract testable logic from `AdminChatScreen` | Identity, outbox, media path, transfer state importable |
| 3 | Write R1–R14 | All pass; each demonstrably fails against the pre-fix commit |
| 4 | Integration layer with real SQLite | Offline→online, restart recovery, wipe completeness |
| 5 | Device smoke, written and scripted | Runs before every release |
| 6 | Security invariant suite | All pass |
| 7 | Performance benchmarks and budget | Numbers published; regressions flagged nightly |

**Step 3 is the proof point.** Each regression test must be shown to fail against the commit before its fix. A regression test that has never been red has proven nothing.

## Progress

| Step | State |
|---|---|
| 1 — CI | **Done.** [.github/workflows/ci.yml](.github/workflows/ci.yml) |
| 2 — Extract testable logic | **Done for reconciliation and the outbox handover.** [chatMessageReconciliation.ts](mobile/src/services/chatMessageReconciliation.ts), [chatOutboxReconciliation.ts](mobile/src/services/chatOutboxReconciliation.ts). Send orchestration I/O and media upload remain in the screen. |
| 3 — R1–R14 | **12 of 14**, and proven red before green. R10 and R11 (transcoder timing) need a device or native harness. |
| 4 — Integration layer | Not started |
| 5 — Device smoke | Not started |
| 6 — Security invariants | Not started |
| 7 — Performance | Not started |

Counts: mobile 36 → 69 tests, backend 96 → 102.

### A test earning its keep on day one

Writing R14 exposed a live defect in the identity-preservation optimisation it was meant to protect. `keepChatMessageIdentity` compared key counts, and the merge always writes `media`, `mediaItems` and `image` — even for a plain text message that has none. Every text message therefore reported as changed, so the optimisation did nothing for the messages there are most of in a thread.

The fix treats absent, null and empty as one value. Nobody would have found this by reading the code; it was invisible until something asserted the behaviour.

### Proving the suite has teeth

Each of R2/R14, R3 and R7 was re-run against its pre-fix logic and observed to fail, then to pass once the fix was restored:

| Reverted behaviour | Result |
|---|---|
| Accepted message does not inherit the client identity | 1 failed / 13 passed |
| A stored media path is trusted without checking the file | 3 failed / 11 passed |
| Message identity compared by key count | 1 failed / 11 passed |

This is the step that separates a regression suite from decoration.

## What this does not cover

Stated so the boundary is deliberate:

- **Calling, Interpreter, LSW, RAILS, RCA** — unassessed here. They need their own strategies; this document covers chat, media, and tenant governance only.
- **Load and soak testing** of backend services at tenant scale.
- **Penetration testing.** Independent, and outside a test suite.
- **Accessibility auditing.** Named in the parity plan; needs its own tooling.
